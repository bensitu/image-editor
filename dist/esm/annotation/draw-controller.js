import { markAnnotationObject } from '../core/editor-object-kind.js';
import { placeAnnotationObject } from '../core/layer-order.js';
import { syncAnnotationRuntimeState } from './annotation-style.js';
function colorWithOpacity(color, opacity) {
    const alpha = Math.max(0, Math.min(1, opacity));
    if (alpha >= 1)
        return color;
    if (/^#([0-9a-f]{6})$/i.test(color)) {
        const hex = color.slice(1);
        const r = Number.parseInt(hex.slice(0, 2), 16);
        const g = Number.parseInt(hex.slice(2, 4), 16);
        const b = Number.parseInt(hex.slice(4, 6), 16);
        return `rgba(${r},${g},${b},${alpha})`;
    }
    return color;
}
function configureBrush(context) {
    const config = context.getDrawConfig();
    const canvasWithBrush = context.canvas;
    canvasWithBrush.freeDrawingBrush = new context.fabric.PencilBrush(context.canvas);
    canvasWithBrush.freeDrawingBrush.width = config.brushSize;
    canvasWithBrush.freeDrawingBrush.color = colorWithOpacity(config.color, config.opacity);
    canvasWithBrush.freeDrawingBrush.strokeLineCap = config.lineCap;
    canvasWithBrush.freeDrawingBrush.strokeLineJoin = config.lineJoin;
}
function markPathAsDrawAnnotation(context, path) {
    const config = context.getDrawConfig();
    const annotationId = context.getAnnotationCounter() + 1;
    context.setAnnotationCounter(annotationId);
    path.set({
        selectable: config.selectable,
        evented: config.evented,
        opacity: config.opacity,
        stroke: config.color,
        strokeWidth: config.brushSize,
    });
    const annotation = markAnnotationObject(path, {
        annotationId,
        annotationType: 'draw',
        annotationName: `${context.options.drawAnnotationName}${annotationId}`,
        annotationHidden: config.annotationHidden,
        annotationLocked: config.annotationLocked,
        annotationSelectable: config.selectable,
        annotationEvented: config.evented,
        annotationHasControls: path.hasControls !== false,
    });
    syncAnnotationRuntimeState(annotation);
    return annotation;
}
function handlePathCreated(context, event) {
    const path = event.path;
    if (!path)
        return;
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
export function enterDrawMode(context) {
    if (context.getDrawSession())
        return;
    if (!context.isImageLoaded())
        return;
    const { canvas } = context;
    const canvasWithDrawing = canvas;
    const previousDrawingMode = !!canvasWithDrawing.isDrawingMode;
    const previousBrush = canvasWithDrawing.freeDrawingBrush;
    const previousCanvasSelection = !!canvas.selection;
    const previousDefaultCursor = canvas.defaultCursor;
    canvas.selection = false;
    canvas.defaultCursor = 'crosshair';
    canvasWithDrawing.isDrawingMode = true;
    configureBrush(context);
    const callback = (event) => handlePathCreated(context, event);
    canvas.on('path:created', callback);
    const session = {
        mode: 'draw',
        previousDrawingMode,
        previousBrush,
        previousCanvasSelection,
        previousDefaultCursor,
        handlers: [{ eventName: 'path:created', callback }],
        dispose: () => {
            try {
                canvas.off('path:created', callback);
            }
            catch {
            }
            canvasWithDrawing.isDrawingMode = previousDrawingMode;
            canvasWithDrawing.freeDrawingBrush = previousBrush;
            canvas.selection = previousCanvasSelection;
            canvas.defaultCursor = previousDefaultCursor !== null && previousDefaultCursor !== void 0 ? previousDefaultCursor : 'default';
        },
    };
    context.setDrawSession(session);
    context.updateUi();
}
export function exitDrawMode(context) {
    const session = context.getDrawSession();
    if (!session)
        return;
    session.dispose();
    context.setDrawSession(null);
    context.canvas.requestRenderAll();
    context.updateUi();
}
export function updateDrawBrush(context) {
    if (!context.getDrawSession())
        return;
    configureBrush(context);
}
//# sourceMappingURL=draw-controller.js.map