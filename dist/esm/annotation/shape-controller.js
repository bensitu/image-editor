import { markAnnotationObject, markSessionObject } from '../core/editor-object-kind.js';
import { placeAnnotationObject, placeSessionObject } from '../core/layer-order.js';
import { mergeShapeAnnotationConfigPatch } from '../core/default-options.js';
import { getObjectBBox } from '../utils/canvas-region.js';
import { resolveNumeric } from '../utils/number.js';
import { getPointerFromFabricEvent } from '../utils/pointer.js';
import { syncAnnotationRuntimeState } from './annotation-style.js';
import { isAnnotationUnlocked } from './annotation-lock.js';
const MIN_INTERACTIVE_SHAPE_SIZE = 2;
function resolveDefaultShapePosition(context) {
    const image = context.getOriginalImage();
    if (image) {
        const bounds = getObjectBBox(image);
        return { left: Math.round(bounds.left + 16), top: Math.round(bounds.top + 16) };
    }
    return { left: 16, top: 16 };
}
function resolveShapeCreationConfig(context, config) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const base = mergeShapeAnnotationConfigPatch(context.getShapeConfig(), config);
    const fallback = resolveDefaultShapePosition(context);
    const leftInput = (_a = config.left) !== null && _a !== void 0 ? _a : base.left;
    const topInput = (_b = config.top) !== null && _b !== void 0 ? _b : base.top;
    const x1Input = (_d = (_c = config.x1) !== null && _c !== void 0 ? _c : base.x1) !== null && _d !== void 0 ? _d : leftInput;
    const y1Input = (_f = (_e = config.y1) !== null && _e !== void 0 ? _e : base.y1) !== null && _f !== void 0 ? _f : topInput;
    const x2Input = (_g = config.x2) !== null && _g !== void 0 ? _g : base.x2;
    const y2Input = (_h = config.y2) !== null && _h !== void 0 ? _h : base.y2;
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
function geometryFromResolved(config) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const x1 = (_b = (_a = config.x1) !== null && _a !== void 0 ? _a : config.left) !== null && _b !== void 0 ? _b : 0;
    const y1 = (_d = (_c = config.y1) !== null && _c !== void 0 ? _c : config.top) !== null && _d !== void 0 ? _d : 0;
    const x2 = (_e = config.x2) !== null && _e !== void 0 ? _e : x1 + config.width;
    const y2 = (_f = config.y2) !== null && _f !== void 0 ? _f : y1 + config.height;
    return {
        left: (_g = config.left) !== null && _g !== void 0 ? _g : Math.min(x1, x2),
        top: (_h = config.top) !== null && _h !== void 0 ? _h : Math.min(y1, y2),
        width: config.width,
        height: config.height,
        x1,
        y1,
        x2,
        y2,
    };
}
function geometryFromPoints(start, end) {
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
function buildArrowPath(geometry, headLength) {
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
function createShapeFabricObject(context, shape, geometry, config) {
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
    };
    if (shape === 'rect') {
        return new context.fabric.Rect({
            left: geometry.left,
            top: geometry.top,
            width: Math.max(MIN_INTERACTIVE_SHAPE_SIZE, geometry.width),
            height: Math.max(MIN_INTERACTIVE_SHAPE_SIZE, geometry.height),
            fill: config.fill,
            ...common,
        });
    }
    const path = shape === 'arrow'
        ? buildArrowPath(geometry, config.arrowHeadLength)
        : `M ${geometry.x1} ${geometry.y1} L ${geometry.x2} ${geometry.y2}`;
    return new context.fabric.Path(path, {
        fill: '',
        strokeLineCap: 'round',
        strokeLineJoin: 'round',
        objectCaching: false,
        ...common,
    });
}
function nextShapeAnnotationMeta(context, config) {
    const annotationId = context.getAnnotationCounter() + 1;
    context.setAnnotationCounter(annotationId);
    return {
        annotationId,
        annotationName: `${context.options.shapeAnnotationName}${annotationId}`,
        annotationHidden: config.annotationHidden,
        annotationLocked: config.annotationLocked,
    };
}
function markShapeAnnotation(context, object, config) {
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
    });
    annotation.shapeAnnotationKind = config.shape;
    syncAnnotationRuntimeState(annotation);
    return annotation;
}
export function createShapeAnnotation(context, config = {}) {
    if (!context.isImageLoaded())
        return null;
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
function isMeaningfulGeometry(shape, geometry) {
    if (shape === 'rect') {
        return (geometry.width >= MIN_INTERACTIVE_SHAPE_SIZE &&
            geometry.height >= MIN_INTERACTIVE_SHAPE_SIZE);
    }
    return (Math.hypot(geometry.x2 - geometry.x1, geometry.y2 - geometry.y1) >=
        MIN_INTERACTIVE_SHAPE_SIZE);
}
function createPreviewObject(context, shape, geometry) {
    const config = { ...context.getShapeConfig(), shape };
    const preview = createShapeFabricObject(context, shape, geometry, config);
    preview.set({
        selectable: false,
        evented: false,
        excludeFromExport: true,
        objectCaching: false,
    });
    markSessionObject(preview, 'shapePreview');
    return preview;
}
function removePreview(context, session) {
    if (!session.previewObject)
        return;
    try {
        context.canvas.remove(session.previewObject);
    }
    catch {
    }
    session.previewObject = null;
}
function updatePreview(context, session, pointer) {
    if (!session.startPoint)
        return;
    const geometry = geometryFromPoints(session.startPoint, pointer);
    removePreview(context, session);
    if (!isMeaningfulGeometry(session.shape, geometry)) {
        context.canvas.requestRenderAll();
        return;
    }
    const preview = createPreviewObject(context, session.shape, geometry);
    session.previewObject = preview;
    placeSessionObject(context.canvas, preview);
    context.canvas.requestRenderAll();
}
function completeInteractiveShape(context, session, pointer) {
    if (!session.startPoint)
        return;
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
function attachCanvasHandler(context, session, eventName, callback) {
    context.canvas.on(eventName, callback);
    session.handlers.push({ eventName, callback });
}
function detachCanvasHandlers(context, session) {
    for (const record of session.handlers) {
        try {
            context.canvas.off(record.eventName, record.callback);
        }
        catch {
        }
    }
    session.handlers = [];
}
export function enterShapeMode(context, shape) {
    if (context.getShapeSession())
        return;
    if (!context.isImageLoaded())
        return;
    const { canvas } = context;
    const previousCanvasSelection = !!canvas.selection;
    const previousDefaultCursor = canvas.defaultCursor;
    canvas.selection = false;
    canvas.defaultCursor = 'crosshair';
    const session = {
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
            canvas.defaultCursor = previousDefaultCursor !== null && previousDefaultCursor !== void 0 ? previousDefaultCursor : 'default';
        },
    };
    attachCanvasHandler(context, session, 'mouse:down', (event) => {
        const pointer = getPointerFromFabricEvent(canvas, event);
        if (!pointer)
            return;
        canvas.discardActiveObject();
        session.startPoint = pointer;
    });
    attachCanvasHandler(context, session, 'mouse:move', (event) => {
        const pointer = getPointerFromFabricEvent(canvas, event);
        if (!pointer || !session.startPoint)
            return;
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
export function exitShapeMode(context) {
    const session = context.getShapeSession();
    if (!session)
        return;
    session.dispose();
    context.setShapeSession(null);
    context.canvas.requestRenderAll();
    context.updateUi();
}
//# sourceMappingURL=shape-controller.js.map