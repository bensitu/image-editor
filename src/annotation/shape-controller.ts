/**
 * Creates shape annotation objects and manages interactive Shape mode sessions.
 *
 * @module
 */

import type * as FabricNS from 'fabric';

import { markAnnotationObject, markSessionObject } from '../core/editor-object-kind.js';
import { placeAnnotationObject, placeSessionObject } from '../core/layer-order.js';
import { mergeShapeAnnotationConfigPatch } from '../core/default-options.js';
import {
    type FabricModule,
    type ImageEditorCallbackContext,
    type ResolvedOptions,
    type ResolvedShapeAnnotationConfig,
    type ShapeAnnotationConfig,
    type ShapeAnnotationKind,
    type ShapeAnnotationObject,
} from '../core/public-types.js';
import { getObjectBBox } from '../utils/canvas-region.js';
import { resolveNumeric } from '../utils/number.js';
import { getPointerFromFabricEvent } from '../utils/pointer.js';
import { syncAnnotationRuntimeState } from './annotation-style.js';
import { isAnnotationUnlocked } from './annotation-lock.js';

export interface ShapeSession {
    mode: 'shape';
    shape: ShapeAnnotationKind;
    previousCanvasSelection: boolean;
    previousDefaultCursor: string | undefined;
    startPoint: { x: number; y: number } | null;
    previewObject: FabricNS.FabricObject | null;
    handlers: Array<{ eventName: string; callback: (event: unknown) => void }>;
    dispose(): void;
}

export interface ShapeControllerContext {
    readonly fabric: FabricModule;
    readonly canvas: FabricNS.Canvas;
    readonly options: ResolvedOptions;
    getOriginalImage(): FabricNS.FabricImage | null;
    getShapeConfig(): ResolvedShapeAnnotationConfig;
    isImageLoaded(): boolean;
    getAnnotationCounter(): number;
    setAnnotationCounter(value: number): void;
    getShapeSession(): ShapeSession | null;
    setShapeSession(session: ShapeSession | null): void;
    saveCanvasState(): void;
    updateAnnotationList(): void;
    updateUi(): void;
    emitAnnotationsChanged(context: ImageEditorCallbackContext): void;
    emitImageChanged(context: ImageEditorCallbackContext): void;
    buildCallbackContext(
        operation: 'createShapeAnnotation' | 'enterShapeMode' | 'exitShapeMode',
    ): ImageEditorCallbackContext;
}

interface ShapeGeometry {
    left: number;
    top: number;
    width: number;
    height: number;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
}

const MIN_INTERACTIVE_SHAPE_SIZE = 2;

function resolveDefaultShapePosition(context: ShapeControllerContext): {
    left: number;
    top: number;
} {
    const image = context.getOriginalImage();
    if (image) {
        const bounds = getObjectBBox(image);
        return { left: Math.round(bounds.left + 16), top: Math.round(bounds.top + 16) };
    }
    return { left: 16, top: 16 };
}

function resolveShapeCreationConfig(
    context: ShapeControllerContext,
    config: ShapeAnnotationConfig,
): ResolvedShapeAnnotationConfig {
    const base = mergeShapeAnnotationConfigPatch(context.getShapeConfig(), config);
    const fallback = resolveDefaultShapePosition(context);
    const leftInput = config.left ?? base.left;
    const topInput = config.top ?? base.top;
    const x1Input = config.x1 ?? base.x1 ?? leftInput;
    const y1Input = config.y1 ?? base.y1 ?? topInput;
    const x2Input = config.x2 ?? base.x2;
    const y2Input = config.y2 ?? base.y2;

    const left = resolveNumeric(leftInput, 'x', fallback.left, context.canvas, context.options);
    const top = resolveNumeric(topInput, 'y', fallback.top, context.canvas, context.options);
    const x1 = resolveNumeric(x1Input, 'x', left, context.canvas, context.options);
    const y1 = resolveNumeric(y1Input, 'y', top, context.canvas, context.options);
    return {
        ...base,
        left,
        top,
        x1,
        y1,
        x2: resolveNumeric(x2Input, 'x', x1 + base.width, context.canvas, context.options),
        y2: resolveNumeric(y2Input, 'y', y1 + base.height, context.canvas, context.options),
    };
}

function geometryFromResolved(config: ResolvedShapeAnnotationConfig): ShapeGeometry {
    const x1 = config.x1 ?? config.left ?? 0;
    const y1 = config.y1 ?? config.top ?? 0;
    const x2 = config.x2 ?? x1 + config.width;
    const y2 = config.y2 ?? y1 + config.height;
    return {
        left: config.left ?? Math.min(x1, x2),
        top: config.top ?? Math.min(y1, y2),
        width: config.width,
        height: config.height,
        x1,
        y1,
        x2,
        y2,
    };
}

function geometryFromPoints(
    start: { x: number; y: number },
    end: { x: number; y: number },
): ShapeGeometry {
    return {
        left: Math.min(start.x, end.x),
        top: Math.min(start.y, end.y),
        width: Math.abs(end.x - start.x),
        height: Math.abs(end.y - start.y),
        x1: start.x,
        y1: start.y,
        x2: end.x,
        y2: end.y,
    };
}

function buildArrowPath(geometry: ShapeGeometry, headLength: number): string {
    const { x1, y1, x2, y2 } = geometry;
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const length = Math.max(1, headLength);
    const wingAngle = Math.PI / 7;
    const head1x = x2 - length * Math.cos(angle - wingAngle);
    const head1y = y2 - length * Math.sin(angle - wingAngle);
    const head2x = x2 - length * Math.cos(angle + wingAngle);
    const head2y = y2 - length * Math.sin(angle + wingAngle);
    return `M ${x1} ${y1} L ${x2} ${y2} M ${x2} ${y2} L ${head1x} ${head1y} M ${x2} ${y2} L ${head2x} ${head2y}`;
}

function createShapeFabricObject(
    context: ShapeControllerContext,
    shape: ShapeAnnotationKind,
    geometry: ShapeGeometry,
    config: ResolvedShapeAnnotationConfig,
): FabricNS.FabricObject {
    const common = {
        stroke: config.stroke,
        strokeWidth: config.strokeWidth,
        strokeDashArray: config.strokeDashArray ? [...config.strokeDashArray] : undefined,
        opacity: config.opacity,
        angle: config.angle,
        selectable: config.selectable,
        evented: config.evented,
        originX: 'left',
        originY: 'top',
        ...config.styles,
    } as Partial<FabricNS.FabricObjectProps>;

    if (shape === 'rect') {
        return new context.fabric.Rect({
            left: geometry.left,
            top: geometry.top,
            width: Math.max(MIN_INTERACTIVE_SHAPE_SIZE, geometry.width),
            height: Math.max(MIN_INTERACTIVE_SHAPE_SIZE, geometry.height),
            fill: config.fill,
            ...common,
        } as Partial<FabricNS.RectProps>);
    }

    const path =
        shape === 'arrow'
            ? buildArrowPath(geometry, config.arrowHeadLength)
            : `M ${geometry.x1} ${geometry.y1} L ${geometry.x2} ${geometry.y2}`;
    return new context.fabric.Path(path, {
        fill: '',
        strokeLineCap: 'round',
        strokeLineJoin: 'round',
        objectCaching: false,
        ...common,
    } as Partial<FabricNS.PathProps>);
}

function nextShapeAnnotationMeta(
    context: ShapeControllerContext,
    config: ResolvedShapeAnnotationConfig,
): {
    annotationId: number;
    annotationName: string;
    annotationHidden: boolean;
    annotationLocked: boolean;
} {
    const annotationId = context.getAnnotationCounter() + 1;
    context.setAnnotationCounter(annotationId);
    return {
        annotationId,
        annotationName: `${context.options.shapeAnnotationName}${annotationId}`,
        annotationHidden: config.annotationHidden,
        annotationLocked: config.annotationLocked,
    };
}

function markShapeAnnotation(
    context: ShapeControllerContext,
    object: FabricNS.FabricObject,
    config: ResolvedShapeAnnotationConfig,
): ShapeAnnotationObject {
    const meta = nextShapeAnnotationMeta(context, config);
    const annotation = markAnnotationObject(object, {
        annotationId: meta.annotationId,
        annotationType: 'shape',
        annotationName: meta.annotationName,
        annotationHidden: meta.annotationHidden,
        annotationLocked: meta.annotationLocked,
        annotationSelectable: config.selectable,
        annotationEvented: config.evented,
        annotationHasControls: object.hasControls !== false,
    }) as ShapeAnnotationObject;
    annotation.shapeAnnotationKind = config.shape;
    syncAnnotationRuntimeState(annotation);
    return annotation;
}

export function createShapeAnnotation(
    context: ShapeControllerContext,
    config: ShapeAnnotationConfig = {},
): ShapeAnnotationObject | null {
    if (!context.isImageLoaded()) return null;
    const resolved = resolveShapeCreationConfig(context, config);
    const geometry = geometryFromResolved(resolved);
    const object = createShapeFabricObject(context, resolved.shape, geometry, resolved);
    const annotation = markShapeAnnotation(context, object, resolved);
    placeAnnotationObject(context.canvas, annotation);
    if (resolved.selectable !== false && isAnnotationUnlocked(annotation)) {
        context.canvas.setActiveObject(annotation);
    }
    context.canvas.renderAll();
    context.updateAnnotationList();
    context.saveCanvasState();
    const callbackContext = context.buildCallbackContext('createShapeAnnotation');
    context.emitAnnotationsChanged(callbackContext);
    context.emitImageChanged(callbackContext);
    return annotation;
}

function isMeaningfulGeometry(shape: ShapeAnnotationKind, geometry: ShapeGeometry): boolean {
    if (shape === 'rect') {
        return (
            geometry.width >= MIN_INTERACTIVE_SHAPE_SIZE &&
            geometry.height >= MIN_INTERACTIVE_SHAPE_SIZE
        );
    }
    return (
        Math.hypot(geometry.x2 - geometry.x1, geometry.y2 - geometry.y1) >=
        MIN_INTERACTIVE_SHAPE_SIZE
    );
}

function createPreviewObject(
    context: ShapeControllerContext,
    shape: ShapeAnnotationKind,
    geometry: ShapeGeometry,
): FabricNS.FabricObject {
    const config = { ...context.getShapeConfig(), shape };
    const preview = createShapeFabricObject(context, shape, geometry, config);
    preview.set({
        selectable: false,
        evented: false,
        excludeFromExport: true,
        objectCaching: false,
    } as Partial<FabricNS.FabricObjectProps>);
    markSessionObject(preview, 'shapePreview');
    return preview;
}

function removePreview(context: ShapeControllerContext, session: ShapeSession): void {
    if (!session.previewObject) return;
    try {
        context.canvas.remove(session.previewObject);
    } catch {
        /* ignore */
    }
    session.previewObject = null;
}

function updatePreview(
    context: ShapeControllerContext,
    session: ShapeSession,
    pointer: { x: number; y: number },
): void {
    if (!session.startPoint) return;
    const geometry = geometryFromPoints(session.startPoint, pointer);
    removePreview(context, session);
    if (!isMeaningfulGeometry(session.shape, geometry)) {
        context.canvas.requestRenderAll();
        return;
    }
    const preview = createPreviewObject(context, session.shape, geometry);
    session.previewObject = preview;
    placeSessionObject(
        context.canvas,
        preview as FabricNS.FabricObject & {
            editorObjectKind: 'session';
            sessionObjectType: 'shapePreview';
        },
    );
    context.canvas.requestRenderAll();
}

function completeInteractiveShape(
    context: ShapeControllerContext,
    session: ShapeSession,
    pointer: { x: number; y: number },
): void {
    if (!session.startPoint) return;
    const geometry = geometryFromPoints(session.startPoint, pointer);
    session.startPoint = null;
    removePreview(context, session);
    if (!isMeaningfulGeometry(session.shape, geometry)) {
        context.canvas.requestRenderAll();
        return;
    }

    if (session.shape === 'rect') {
        createShapeAnnotation(context, {
            shape: 'rect',
            left: geometry.left,
            top: geometry.top,
            width: geometry.width,
            height: geometry.height,
        });
        return;
    }

    createShapeAnnotation(context, {
        shape: session.shape,
        x1: geometry.x1,
        y1: geometry.y1,
        x2: geometry.x2,
        y2: geometry.y2,
    });
}

function attachCanvasHandler(
    context: ShapeControllerContext,
    session: ShapeSession,
    eventName: string,
    callback: (event: unknown) => void,
): void {
    (
        context.canvas as unknown as { on(event: string, handler: (event: unknown) => void): void }
    ).on(eventName, callback);
    session.handlers.push({ eventName, callback });
}

function detachCanvasHandlers(context: ShapeControllerContext, session: ShapeSession): void {
    for (const record of session.handlers) {
        try {
            (
                context.canvas as unknown as {
                    off(event: string, handler: (event: unknown) => void): void;
                }
            ).off(record.eventName, record.callback);
        } catch {
            /* ignore */
        }
    }
    session.handlers = [];
}

export function enterShapeMode(context: ShapeControllerContext, shape: ShapeAnnotationKind): void {
    if (context.getShapeSession()) return;
    if (!context.isImageLoaded()) return;

    const { canvas } = context;
    const previousCanvasSelection = !!canvas.selection;
    const previousDefaultCursor = canvas.defaultCursor;
    canvas.selection = false;
    canvas.defaultCursor = 'crosshair';

    const session: ShapeSession = {
        mode: 'shape',
        shape,
        previousCanvasSelection,
        previousDefaultCursor,
        startPoint: null,
        previewObject: null,
        handlers: [],
        dispose: () => {
            detachCanvasHandlers(context, session);
            removePreview(context, session);
            canvas.selection = previousCanvasSelection;
            canvas.defaultCursor = previousDefaultCursor ?? 'default';
        },
    };

    attachCanvasHandler(context, session, 'mouse:down', (event) => {
        const pointer = getPointerFromFabricEvent(canvas, event);
        if (!pointer) return;
        canvas.discardActiveObject();
        session.startPoint = pointer;
    });
    attachCanvasHandler(context, session, 'mouse:move', (event) => {
        const pointer = getPointerFromFabricEvent(canvas, event);
        if (!pointer || !session.startPoint) return;
        updatePreview(context, session, pointer);
    });
    attachCanvasHandler(context, session, 'mouse:up', (event) => {
        const pointer = getPointerFromFabricEvent(canvas, event);
        if (!pointer) {
            session.startPoint = null;
            removePreview(context, session);
            return;
        }
        completeInteractiveShape(context, session, pointer);
    });

    context.setShapeSession(session);
    context.updateUi();
}

export function exitShapeMode(context: ShapeControllerContext): void {
    const session = context.getShapeSession();
    if (!session) return;
    session.dispose();
    context.setShapeSession(null);
    context.canvas.requestRenderAll();
    context.updateUi();
}
