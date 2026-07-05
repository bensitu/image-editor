import { markAnnotationObject, markSessionObject } from '../core/editor-object-kind.js';
import { placeAnnotationObject, placeSessionObject } from '../core/layer-order.js';
import { isDrawAnnotationObject, } from '../core/public-types.js';
import { getObjectBBox } from '../utils/canvas-region.js';
import { getPointerFromFabricEvent } from '../utils/pointer.js';
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
function setDrawingMode(context, enabled) {
    const canvasWithDrawing = context.canvas;
    canvasWithDrawing.isDrawingMode = enabled;
}
function createEraserPreview(context) {
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
    });
    return markSessionObject(circle, 'eraserPreview');
}
function ensureEraserPreview(context, session) {
    var _a;
    const preview = (_a = session.eraserPreview) !== null && _a !== void 0 ? _a : createEraserPreview(context);
    session.eraserPreview = preview;
    const config = context.getEraserConfig();
    preview.set({
        radius: config.brushSize / 2,
        fill: config.previewFill,
        stroke: config.previewStroke,
        strokeWidth: config.previewStrokeWidth,
    });
    if (!context.canvas.getObjects().includes(preview)) {
        context.canvas.add(preview);
    }
    placeSessionObject(context.canvas, preview);
    return preview;
}
function hideEraserPreview(context, session) {
    if (!session.eraserPreview)
        return;
    session.eraserPreview.set({ visible: false });
    context.canvas.requestRenderAll();
}
function removeEraserPreview(context, session) {
    if (!session.eraserPreview)
        return;
    try {
        context.canvas.remove(session.eraserPreview);
    }
    catch {
    }
    session.eraserPreview = null;
}
function moveEraserPreview(context, session, point) {
    const preview = ensureEraserPreview(context, session);
    preview.set({ left: point.x, top: point.y, visible: session.subMode === 'erase' });
    context.canvas.requestRenderAll();
}
function pushEraserPoint(context, session, point) {
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
function pointIntersectsExpandedBounds(point, bounds, radius) {
    return (point.x >= bounds.left - radius &&
        point.x <= bounds.left + bounds.width + radius &&
        point.y >= bounds.top - radius &&
        point.y <= bounds.top + bounds.height + radius);
}
function getIntersectedDrawAnnotations(context, points) {
    if (points.length === 0)
        return [];
    const radius = Math.max(1, context.getEraserConfig().brushSize / 2);
    return context.canvas
        .getObjects()
        .filter(isDrawAnnotationObject)
        .filter((annotation) => {
        const bounds = getObjectBBox(annotation);
        return points.some((point) => pointIntersectsExpandedBounds(point, bounds, radius));
    });
}
function commitEraserStroke(context, session) {
    const removed = getIntersectedDrawAnnotations(context, session.eraserPoints);
    session.eraserPoints = [];
    session.isErasing = false;
    if (removed.length === 0)
        return;
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
function handleEraserPointerDown(context, event) {
    const session = context.getDrawSession();
    if (!session || session.subMode !== 'erase')
        return;
    const pointer = getPointerFromFabricEvent(context.canvas, event);
    if (!pointer)
        return;
    session.isErasing = true;
    session.eraserPoints = [];
    pushEraserPoint(context, session, pointer);
    moveEraserPreview(context, session, pointer);
}
function handleEraserPointerMove(context, event) {
    const session = context.getDrawSession();
    if (!session || session.subMode !== 'erase')
        return;
    const pointer = getPointerFromFabricEvent(context.canvas, event);
    if (!pointer) {
        hideEraserPreview(context, session);
        return;
    }
    moveEraserPreview(context, session, pointer);
    if (session.isErasing)
        pushEraserPoint(context, session, pointer);
}
function handleEraserPointerUp(context, event) {
    const session = context.getDrawSession();
    if (!session || session.subMode !== 'erase')
        return;
    const pointer = getPointerFromFabricEvent(context.canvas, event);
    if (pointer) {
        pushEraserPoint(context, session, pointer);
        moveEraserPreview(context, session, pointer);
    }
    commitEraserStroke(context, session);
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
    const pathCreatedCallback = (event) => handlePathCreated(context, event);
    canvas.on('path:created', pathCreatedCallback);
    const mouseDownCallback = (event) => handleEraserPointerDown(context, event);
    const mouseMoveCallback = (event) => handleEraserPointerMove(context, event);
    const mouseUpCallback = (event) => handleEraserPointerUp(context, event);
    const mouseOutCallback = () => {
        const session = context.getDrawSession();
        if (session)
            hideEraserPreview(context, session);
    };
    canvas.on('mouse:down', mouseDownCallback);
    canvas.on('mouse:move', mouseMoveCallback);
    canvas.on('mouse:up', mouseUpCallback);
    canvas.on('mouse:out', mouseOutCallback);
    const session = {
        mode: 'draw',
        subMode: 'brush',
        previousDrawingMode,
        previousBrush,
        previousCanvasSelection,
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
                    canvas.off(record.eventName, record.callback);
                }
                catch {
                }
            }
            removeEraserPreview(context, session);
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
export function setDrawSubMode(context, subMode) {
    const session = context.getDrawSession();
    if (!session)
        return;
    if (session.subMode === subMode)
        return;
    session.subMode = subMode;
    session.isErasing = false;
    session.eraserPoints = [];
    if (subMode === 'brush') {
        hideEraserPreview(context, session);
        configureBrush(context);
        setDrawingMode(context, true);
    }
    else {
        setDrawingMode(context, false);
        ensureEraserPreview(context, session).set({ visible: false });
    }
    context.canvas.requestRenderAll();
    context.updateUi();
}
export function updateEraserPreview(context) {
    const session = context.getDrawSession();
    if (!session || session.subMode !== 'erase')
        return;
    const preview = ensureEraserPreview(context, session);
    preview.set({ visible: false });
    context.canvas.requestRenderAll();
}
//# sourceMappingURL=draw-controller.js.map