/**
 * Draw annotation mode controller.
 *
 * Owns Fabric free-drawing setup, draw-session teardown, and conversion of
 * completed paths into editor-owned annotation objects.
 *
 * @module
 */

import type * as FabricNS from 'fabric';

import { markAnnotationObject, markSessionObject } from '../core/editor-object-kind.js';
import { placeAnnotationObject, placeSessionObject } from '../core/layer-order.js';
import {
    isDrawAnnotationObject,
    type DrawSubMode,
    type DrawAnnotationObject,
    type FabricModule,
    type ImageEditorCallbackContext,
    type ResolvedDrawConfig,
    type ResolvedEraserConfig,
    type ResolvedOptions,
    type SessionObject,
} from '../core/public-types.js';
import { getObjectBBox } from '../utils/canvas-region.js';
import { getPointerFromFabricEvent } from '../utils/pointer.js';
import { syncAnnotationRuntimeState } from './annotation-style.js';
import {
    getPathSegments,
    type PathPoint as Point,
    type PathSegment as Segment,
} from './path-segments.js';

export interface DrawSession {
    mode: 'draw';
    subMode: DrawSubMode;
    previousDrawingMode: boolean;
    previousBrush: unknown;
    previousCanvasSelection: boolean;
    previousSkipTargetFind: boolean;
    previousDefaultCursor: string | undefined;
    eraserPreview: (FabricNS.Circle & SessionObject) | null;
    eraserPoints: Array<{ x: number; y: number }>;
    isErasing: boolean;
    handlers: Array<{ eventName: string; callback: (event: unknown) => void }>;
    dispose(): void;
}

export interface DrawControllerContext {
    readonly fabric: FabricModule;
    readonly canvas: FabricNS.Canvas;
    readonly options: ResolvedOptions;
    getDrawConfig(): ResolvedDrawConfig;
    getEraserConfig(): ResolvedEraserConfig;
    isImageLoaded(): boolean;
    getAnnotationCounter(): number;
    setAnnotationCounter(value: number): void;
    getDrawSession(): DrawSession | null;
    setDrawSession(session: DrawSession | null): void;
    saveCanvasState(): void;
    updateAnnotationList(): void;
    updateUi(): void;
    emitAnnotationsChanged(context: ImageEditorCallbackContext): void;
    emitImageChanged(context: ImageEditorCallbackContext): void;
    buildCallbackContext(
        operation: 'enterDrawMode' | 'exitDrawMode' | 'createDrawAnnotation' | 'commitEraserStroke',
    ): ImageEditorCallbackContext;
}

function colorWithOpacity(color: string, opacity: number): string {
    const alpha = Math.max(0, Math.min(1, opacity));
    if (alpha >= 1) return color;
    if (/^#([0-9a-f]{6})$/i.test(color)) {
        const hex = color.slice(1);
        const r = Number.parseInt(hex.slice(0, 2), 16);
        const g = Number.parseInt(hex.slice(2, 4), 16);
        const b = Number.parseInt(hex.slice(4, 6), 16);
        return `rgba(${r},${g},${b},${alpha})`;
    }
    return color;
}

function configureBrush(context: DrawControllerContext): void {
    const config = context.getDrawConfig();
    const canvasWithBrush = context.canvas as FabricNS.Canvas & {
        freeDrawingBrush?: {
            width?: number;
            color?: string;
            strokeLineCap?: CanvasLineCap;
            strokeLineJoin?: CanvasLineJoin;
        };
    };
    canvasWithBrush.freeDrawingBrush = new context.fabric.PencilBrush(context.canvas);
    canvasWithBrush.freeDrawingBrush.width = config.brushSize;
    canvasWithBrush.freeDrawingBrush.color = colorWithOpacity(config.color, config.opacity);
    canvasWithBrush.freeDrawingBrush.strokeLineCap = config.lineCap;
    canvasWithBrush.freeDrawingBrush.strokeLineJoin = config.lineJoin;
}

function setDrawingMode(context: DrawControllerContext, enabled: boolean): void {
    const canvasWithDrawing = context.canvas as FabricNS.Canvas & {
        isDrawingMode?: boolean;
    };
    canvasWithDrawing.isDrawingMode = enabled;
}

function createEraserPreview(context: DrawControllerContext): FabricNS.Circle & SessionObject {
    const config = context.getEraserConfig();
    const circle = new context.fabric.Circle({
        left: 0,
        top: 0,
        radius: config.brushSize / 2,
        originX: 'center',
        originY: 'center',
        fill: config.previewFill,
        stroke: config.previewStroke,
        strokeWidth: config.previewStrokeWidth,
        selectable: false,
        evented: false,
        excludeFromExport: true,
        objectCaching: false,
        visible: false,
    } as Partial<FabricNS.CircleProps>);
    return markSessionObject(circle, 'eraserPreview');
}

function ensureEraserPreview(
    context: DrawControllerContext,
    session: DrawSession,
): FabricNS.Circle & SessionObject {
    const preview = session.eraserPreview ?? createEraserPreview(context);
    session.eraserPreview = preview;
    const config = context.getEraserConfig();
    preview.set({
        radius: config.brushSize / 2,
        fill: config.previewFill,
        stroke: config.previewStroke,
        strokeWidth: config.previewStrokeWidth,
    } as Partial<FabricNS.CircleProps>);
    if (!context.canvas.getObjects().includes(preview)) {
        context.canvas.add(preview);
    }
    placeSessionObject(context.canvas, preview);
    return preview;
}

function hideEraserPreview(context: DrawControllerContext, session: DrawSession): void {
    if (!session.eraserPreview) return;
    session.eraserPreview.set({ visible: false });
    context.canvas.requestRenderAll();
}

function removeEraserPreview(context: DrawControllerContext, session: DrawSession): void {
    if (!session.eraserPreview) return;
    try {
        context.canvas.remove(session.eraserPreview);
    } catch {
        /* ignore */
    }
    session.eraserPreview = null;
}

function moveEraserPreview(
    context: DrawControllerContext,
    session: DrawSession,
    point: { x: number; y: number },
): void {
    const preview = ensureEraserPreview(context, session);
    preview.set({ left: point.x, top: point.y, visible: session.subMode === 'erase' });
    context.canvas.requestRenderAll();
}

function pushEraserPoint(
    context: DrawControllerContext,
    session: DrawSession,
    point: { x: number; y: number },
): void {
    const previous = session.eraserPoints[session.eraserPoints.length - 1];
    if (!previous) {
        session.eraserPoints.push(point);
        return;
    }

    const radius = Math.max(1, context.getEraserConfig().brushSize / 2);
    const spacing = Math.max(1, radius / 2);
    const distance = Math.hypot(point.x - previous.x, point.y - previous.y);
    const steps = Math.max(1, Math.ceil(distance / spacing));
    for (let index = 1; index <= steps; index += 1) {
        const t = index / steps;
        session.eraserPoints.push({
            x: previous.x + (point.x - previous.x) * t,
            y: previous.y + (point.y - previous.y) * t,
        });
    }
}

function pointIntersectsExpandedBounds(
    point: { x: number; y: number },
    bounds: { left: number; top: number; width: number; height: number },
    radius: number,
): boolean {
    return (
        point.x >= bounds.left - radius &&
        point.x <= bounds.left + bounds.width + radius &&
        point.y >= bounds.top - radius &&
        point.y <= bounds.top + bounds.height + radius
    );
}

function transformPathPoint(annotation: DrawAnnotationObject, point: Point): Point {
    const pathLike = annotation as DrawAnnotationObject & {
        pathOffset?: Partial<Point>;
        calcTransformMatrix?: () => number[];
    };
    const offset = pathLike.pathOffset ?? { x: 0, y: 0 };
    const x = point.x - (Number(offset.x) || 0);
    const y = point.y - (Number(offset.y) || 0);
    const matrix = pathLike.calcTransformMatrix?.();
    if (!Array.isArray(matrix) || matrix.length < 6) return { x: point.x, y: point.y };
    const [a = 1, b = 0, c = 0, d = 1, e = 0, f = 0] = matrix;
    return {
        x: a * x + c * y + e,
        y: b * x + d * y + f,
    };
}

function getDrawAnnotationPathSegments(annotation: DrawAnnotationObject): Segment[] {
    const pathData = (annotation as DrawAnnotationObject & { path?: unknown }).path;
    return getPathSegments(pathData, (point) => transformPathPoint(annotation, point));
}

type ScalableStrokeObject = DrawAnnotationObject & {
    getObjectScaling?: () => Partial<Point>;
    strokeUniform?: boolean;
};

function getEffectiveStrokeRadius(annotation: DrawAnnotationObject): number {
    const scalable = annotation as ScalableStrokeObject;
    const strokeWidth = Number(annotation.strokeWidth) || 0;
    const scale = scalable.getObjectScaling?.();
    if (scalable.strokeUniform) {
        return Math.max(0, strokeWidth / 2);
    }
    const scaleX = Math.abs(Number(scale?.x) || Number(annotation.scaleX) || 1);
    const scaleY = Math.abs(Number(scale?.y) || Number(annotation.scaleY) || 1);
    return Math.max(0, (strokeWidth * Math.max(scaleX, scaleY)) / 2);
}

function pointDistanceToSegment(point: Point, segment: Segment): number {
    const dx = segment.end.x - segment.start.x;
    const dy = segment.end.y - segment.start.y;
    const lengthSquared = dx * dx + dy * dy;
    if (lengthSquared === 0) {
        return Math.hypot(point.x - segment.start.x, point.y - segment.start.y);
    }
    const t = Math.max(
        0,
        Math.min(
            1,
            ((point.x - segment.start.x) * dx + (point.y - segment.start.y) * dy) / lengthSquared,
        ),
    );
    const nearest = {
        x: segment.start.x + t * dx,
        y: segment.start.y + t * dy,
    };
    return Math.hypot(point.x - nearest.x, point.y - nearest.y);
}

function annotationIntersectsEraserPath(
    annotation: DrawAnnotationObject,
    points: readonly Point[],
    eraserRadius: number,
): boolean {
    const hitRadius = eraserRadius + getEffectiveStrokeRadius(annotation);
    const bounds = getObjectBBox(annotation);
    if (!points.some((point) => pointIntersectsExpandedBounds(point, bounds, hitRadius))) {
        return false;
    }

    const segments = getDrawAnnotationPathSegments(annotation);
    if (segments.length === 0) return false;
    return points.some((point) =>
        segments.some((segment) => pointDistanceToSegment(point, segment) <= hitRadius),
    );
}

function getIntersectedDrawAnnotations(
    context: DrawControllerContext,
    points: Array<{ x: number; y: number }>,
): DrawAnnotationObject[] {
    if (points.length === 0) return [];
    const radius = Math.max(1, context.getEraserConfig().brushSize / 2);
    return context.canvas
        .getObjects()
        .filter(isDrawAnnotationObject)
        .filter((annotation) => annotationIntersectsEraserPath(annotation, points, radius));
}

function commitEraserStroke(context: DrawControllerContext, session: DrawSession): void {
    const removed = getIntersectedDrawAnnotations(context, session.eraserPoints);
    session.eraserPoints = [];
    session.isErasing = false;
    if (removed.length === 0) return;

    removed.forEach((annotation) => {
        context.canvas.remove(annotation);
    });
    context.canvas.discardActiveObject();
    context.canvas.renderAll();
    context.saveCanvasState();
    context.updateAnnotationList();
    context.updateUi();
    const callbackContext = context.buildCallbackContext('commitEraserStroke');
    context.emitAnnotationsChanged(callbackContext);
    context.emitImageChanged(callbackContext);
}

function handleEraserPointerDown(context: DrawControllerContext, event: unknown): void {
    const session = context.getDrawSession();
    if (!session || session.subMode !== 'erase') return;
    const pointer = getPointerFromFabricEvent(context.canvas, event);
    if (!pointer) return;
    session.isErasing = true;
    session.eraserPoints = [];
    pushEraserPoint(context, session, pointer);
    moveEraserPreview(context, session, pointer);
}

function handleEraserPointerMove(context: DrawControllerContext, event: unknown): void {
    const session = context.getDrawSession();
    if (!session || session.subMode !== 'erase') return;
    const pointer = getPointerFromFabricEvent(context.canvas, event);
    if (!pointer) {
        hideEraserPreview(context, session);
        return;
    }
    moveEraserPreview(context, session, pointer);
    if (session.isErasing) pushEraserPoint(context, session, pointer);
}

function handleEraserPointerUp(context: DrawControllerContext, event: unknown): void {
    const session = context.getDrawSession();
    if (!session || session.subMode !== 'erase') return;
    const pointer = getPointerFromFabricEvent(context.canvas, event);
    if (pointer) {
        pushEraserPoint(context, session, pointer);
        moveEraserPreview(context, session, pointer);
    }
    commitEraserStroke(context, session);
}

function markPathAsDrawAnnotation(
    context: DrawControllerContext,
    path: FabricNS.FabricObject,
): DrawAnnotationObject {
    const config = context.getDrawConfig();
    const annotationId = context.getAnnotationCounter() + 1;
    context.setAnnotationCounter(annotationId);
    path.set({
        selectable: config.selectable,
        evented: config.evented,
        opacity: config.opacity,
        stroke: config.color,
        strokeWidth: config.brushSize,
    } as Partial<FabricNS.FabricObjectProps>);
    const annotation = markAnnotationObject(path, {
        annotationId,
        annotationType: 'draw',
        annotationName: `${context.options.drawAnnotationName}${annotationId}`,
        annotationHidden: config.annotationHidden,
        annotationLocked: config.annotationLocked,
        annotationSelectable: config.selectable,
        annotationEvented: config.evented,
        annotationHasControls: path.hasControls !== false,
    }) as DrawAnnotationObject;
    syncAnnotationRuntimeState(annotation);
    return annotation;
}

function handlePathCreated(context: DrawControllerContext, event: unknown): void {
    const path = (event as { path?: FabricNS.FabricObject }).path;
    if (!path) return;
    const annotation = markPathAsDrawAnnotation(context, path);
    placeAnnotationObject(context.canvas, annotation);
    context.canvas.setActiveObject(annotation);
    context.canvas.renderAll();
    context.updateAnnotationList();
    context.saveCanvasState();
    const callbackContext = context.buildCallbackContext('createDrawAnnotation');
    context.emitAnnotationsChanged(callbackContext);
    context.emitImageChanged(callbackContext);
}

export function enterDrawMode(context: DrawControllerContext): void {
    if (context.getDrawSession()) return;
    if (!context.isImageLoaded()) return;
    const { canvas } = context;
    const canvasWithDrawing = canvas as FabricNS.Canvas & {
        isDrawingMode?: boolean;
        freeDrawingBrush?: unknown;
    };
    const previousDrawingMode = !!canvasWithDrawing.isDrawingMode;
    const previousBrush = canvasWithDrawing.freeDrawingBrush;
    const previousCanvasSelection = !!canvas.selection;
    const previousSkipTargetFind = !!canvas.skipTargetFind;
    const previousDefaultCursor = canvas.defaultCursor;

    canvas.selection = false;
    canvas.defaultCursor = 'crosshair';
    canvasWithDrawing.isDrawingMode = true;
    configureBrush(context);

    const pathCreatedCallback = (event: unknown): void => handlePathCreated(context, event);
    (canvas as unknown as { on(event: string, handler: (event: unknown) => void): void }).on(
        'path:created',
        pathCreatedCallback,
    );
    const mouseDownCallback = (event: unknown): void => handleEraserPointerDown(context, event);
    const mouseMoveCallback = (event: unknown): void => handleEraserPointerMove(context, event);
    const mouseUpCallback = (event: unknown): void => handleEraserPointerUp(context, event);
    const mouseOutCallback = (): void => {
        const session = context.getDrawSession();
        if (session) hideEraserPreview(context, session);
    };
    (canvas as unknown as { on(event: string, handler: (event: unknown) => void): void }).on(
        'mouse:down',
        mouseDownCallback,
    );
    (canvas as unknown as { on(event: string, handler: (event: unknown) => void): void }).on(
        'mouse:move',
        mouseMoveCallback,
    );
    (canvas as unknown as { on(event: string, handler: (event: unknown) => void): void }).on(
        'mouse:up',
        mouseUpCallback,
    );
    (canvas as unknown as { on(event: string, handler: () => void): void }).on(
        'mouse:out',
        mouseOutCallback,
    );

    const session: DrawSession = {
        mode: 'draw',
        subMode: 'brush',
        previousDrawingMode,
        previousBrush,
        previousCanvasSelection,
        previousSkipTargetFind,
        previousDefaultCursor,
        eraserPreview: null,
        eraserPoints: [],
        isErasing: false,
        handlers: [
            { eventName: 'path:created', callback: pathCreatedCallback },
            { eventName: 'mouse:down', callback: mouseDownCallback },
            { eventName: 'mouse:move', callback: mouseMoveCallback },
            { eventName: 'mouse:up', callback: mouseUpCallback },
            { eventName: 'mouse:out', callback: mouseOutCallback },
        ],
        dispose: () => {
            for (const record of session.handlers) {
                try {
                    (
                        canvas as unknown as {
                            off(event: string, handler: (event: unknown) => void): void;
                        }
                    ).off(record.eventName, record.callback);
                } catch {
                    /* ignore */
                }
            }
            removeEraserPreview(context, session);
            canvasWithDrawing.isDrawingMode = previousDrawingMode;
            canvasWithDrawing.freeDrawingBrush = previousBrush;
            canvas.selection = previousCanvasSelection;
            canvas.skipTargetFind = previousSkipTargetFind;
            canvas.defaultCursor = previousDefaultCursor ?? 'default';
        },
    };
    context.setDrawSession(session);
    context.updateUi();
}

export function exitDrawMode(context: DrawControllerContext): void {
    const session = context.getDrawSession();
    if (!session) return;
    session.dispose();
    context.setDrawSession(null);
    context.canvas.requestRenderAll();
    context.updateUi();
}

export function updateDrawBrush(context: DrawControllerContext): void {
    if (!context.getDrawSession()) return;
    configureBrush(context);
}

export function setDrawSubMode(context: DrawControllerContext, subMode: DrawSubMode): void {
    const session = context.getDrawSession();
    if (!session) return;
    if (session.subMode === subMode) return;
    session.subMode = subMode;
    session.isErasing = false;
    session.eraserPoints = [];
    if (subMode === 'brush') {
        context.canvas.skipTargetFind = session.previousSkipTargetFind;
        hideEraserPreview(context, session);
        configureBrush(context);
        setDrawingMode(context, true);
    } else {
        context.canvas.discardActiveObject();
        context.canvas.skipTargetFind = true;
        setDrawingMode(context, false);
        ensureEraserPreview(context, session).set({ visible: false });
    }
    context.canvas.requestRenderAll();
    context.updateUi();
}

export function updateEraserPreview(context: DrawControllerContext): void {
    const session = context.getDrawSession();
    if (!session || session.subMode !== 'erase') return;
    const preview = ensureEraserPreview(context, session);
    preview.set({ visible: false });
    context.canvas.requestRenderAll();
}
