/**
 * Draw annotation mode controller.
 *
 * Owns Fabric free-drawing setup, draw-session teardown, and conversion of
 * completed paths into editor-owned annotation objects.
 *
 * @module
 */

import type * as FabricNS from 'fabric';

import { markAnnotationObject } from '../core/editor-object-kind.js';
import { placeAnnotationObject } from '../core/layer-order.js';
import {
    type DrawAnnotationObject,
    type FabricModule,
    type ImageEditorCallbackContext,
    type ResolvedDrawConfig,
    type ResolvedOptions,
} from '../core/public-types.js';
import { syncAnnotationRuntimeState } from './annotation-style.js';

export interface DrawSession {
    mode: 'draw';
    previousDrawingMode: boolean;
    previousBrush: unknown;
    previousCanvasSelection: boolean;
    previousDefaultCursor: string | undefined;
    handlers: Array<{ eventName: string; callback: (event: unknown) => void }>;
    dispose(): void;
}

export interface DrawControllerContext {
    readonly fabric: FabricModule;
    readonly canvas: FabricNS.Canvas;
    readonly options: ResolvedOptions;
    getDrawConfig(): ResolvedDrawConfig;
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
    buildCallbackContext(operation: 'enterDrawMode' | 'exitDrawMode'): ImageEditorCallbackContext;
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
    const callbackContext = context.buildCallbackContext('enterDrawMode');
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
    const previousDefaultCursor = canvas.defaultCursor;

    canvas.selection = false;
    canvas.defaultCursor = 'crosshair';
    canvasWithDrawing.isDrawingMode = true;
    configureBrush(context);

    const callback = (event: unknown): void => handlePathCreated(context, event);
    (canvas as unknown as { on(event: string, handler: (event: unknown) => void): void }).on(
        'path:created',
        callback,
    );

    const session: DrawSession = {
        mode: 'draw',
        previousDrawingMode,
        previousBrush,
        previousCanvasSelection,
        previousDefaultCursor,
        handlers: [{ eventName: 'path:created', callback }],
        dispose: () => {
            try {
                (
                    canvas as unknown as {
                        off(event: string, handler: (event: unknown) => void): void;
                    }
                ).off('path:created', callback);
            } catch {
                /* ignore */
            }
            canvasWithDrawing.isDrawingMode = previousDrawingMode;
            canvasWithDrawing.freeDrawingBrush = previousBrush;
            canvas.selection = previousCanvasSelection;
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
