import { markAnnotationObject } from '../core/editor-object-kind.js';
import { placeAnnotationObject } from '../core/layer-order.js';
import { isTextAnnotationObject, } from '../core/public-types.js';
import { mergeTextAnnotationConfigPatch } from '../core/default-options.js';
import { getObjectBBox } from '../utils/canvas-region.js';
import { resolveNumeric } from '../utils/number.js';
import { getPointerFromFabricEvent } from '../utils/pointer.js';
import { syncAnnotationRuntimeState } from './annotation-style.js';
import { isAnnotationUnlocked } from './annotation-lock.js';
function resolveDefaultTextPosition(context) {
    const image = context.getOriginalImage();
    if (image) {
        const bounds = getObjectBBox(image);
        return { left: Math.round(bounds.left + 10), top: Math.round(bounds.top + 10) };
    }
    return { left: 10, top: 10 };
}
function resolveTextCreationConfig(context, config) {
    var _a, _b;
    const base = mergeTextAnnotationConfigPatch(context.getTextConfig(), config);
    const fallback = resolveDefaultTextPosition(context);
    const leftInput = (_a = config.left) !== null && _a !== void 0 ? _a : base.left;
    const topInput = (_b = config.top) !== null && _b !== void 0 ? _b : base.top;
    return {
        ...base,
        left: resolveNumeric(leftInput, 'x', fallback.left, context.canvas, context.options),
        top: resolveNumeric(topInput, 'y', fallback.top, context.canvas, context.options),
    };
}
function nextAnnotationMeta(context, config) {
    const annotationId = context.getAnnotationCounter() + 1;
    context.setAnnotationCounter(annotationId);
    return {
        annotationId,
        annotationName: `${context.options.textAnnotationName}${annotationId}`,
        annotationHidden: config.annotationHidden,
        annotationLocked: config.annotationLocked,
    };
}
export function attachTextEditingHandlers(context, annotation) {
    const textObject = annotation;
    if (textObject.imageEditorTextEditingHandlers) {
        try {
            textObject.off('editing:entered', textObject.imageEditorTextEditingHandlers.entered);
            textObject.off('editing:exited', textObject.imageEditorTextEditingHandlers.exited);
        }
        catch {
        }
    }
    const entered = () => {
        var _a;
        textObject.imageEditorTextEditingInitialText = String((_a = textObject.text) !== null && _a !== void 0 ? _a : '');
        textObject.imageEditorTextEditingCancel = false;
        delete textObject.imageEditorTextEditingHandledChange;
    };
    const exited = () => {
        var _a;
        const initial = textObject.imageEditorTextEditingInitialText;
        const finalText = String((_a = textObject.text) !== null && _a !== void 0 ? _a : '');
        const cancel = textObject.imageEditorTextEditingCancel === true;
        if (initial !== undefined) {
            textObject.imageEditorTextEditingHandledChange = true;
            queueMicrotask(() => {
                if (textObject.imageEditorTextEditingHandledChange === true) {
                    delete textObject.imageEditorTextEditingHandledChange;
                }
            });
        }
        if (cancel && initial !== undefined) {
            textObject.set({ text: initial });
        }
        delete textObject.imageEditorTextEditingInitialText;
        delete textObject.imageEditorTextEditingCancel;
        if (!cancel && initial !== undefined && initial !== finalText) {
            context.saveCanvasState();
            const callbackContext = context.buildCallbackContext('updateAnnotation');
            context.emitAnnotationsChanged(callbackContext);
            context.emitImageChanged(callbackContext);
        }
    };
    textObject.on('editing:entered', entered);
    textObject.on('editing:exited', exited);
    textObject.imageEditorTextEditingHandlers = { entered, exited };
}
function selectAllText(annotation) {
    var _a;
    const textObject = annotation;
    const textLength = String((_a = textObject.text) !== null && _a !== void 0 ? _a : '').length;
    if (textLength <= 0)
        return;
    if (typeof textObject.selectAll === 'function') {
        textObject.selectAll();
        return;
    }
    if (typeof textObject.setSelectionStart === 'function' &&
        typeof textObject.setSelectionEnd === 'function') {
        textObject.setSelectionStart(0);
        textObject.setSelectionEnd(textLength);
        return;
    }
    textObject.selectionStart = 0;
    textObject.selectionEnd = textLength;
}
export function createTextAnnotation(context, config = {}) {
    var _a, _b;
    if (!context.isImageLoaded())
        return null;
    const resolved = resolveTextCreationConfig(context, config);
    const textbox = new context.fabric.Textbox(resolved.text, {
        left: resolved.left,
        top: resolved.top,
        width: resolved.width,
        fontSize: resolved.fontSize,
        fontFamily: resolved.fontFamily,
        fontWeight: resolved.fontWeight,
        fill: resolved.fill,
        backgroundColor: resolved.backgroundColor,
        textAlign: resolved.textAlign,
        angle: resolved.angle,
        selectable: resolved.selectable,
        evented: resolved.evented,
        editable: resolved.editable,
        originX: 'left',
        originY: 'top',
        ...resolved.styles,
    });
    const meta = nextAnnotationMeta(context, resolved);
    const annotation = markAnnotationObject(textbox, {
        annotationId: meta.annotationId,
        annotationType: 'text',
        annotationName: meta.annotationName,
        annotationHidden: meta.annotationHidden,
        annotationLocked: meta.annotationLocked,
        annotationSelectable: resolved.selectable,
        annotationEvented: resolved.evented,
        annotationHasControls: textbox.hasControls !== false,
        annotationEditable: resolved.editable,
    });
    syncAnnotationRuntimeState(annotation);
    attachTextEditingHandlers(context, annotation);
    placeAnnotationObject(context.canvas, annotation);
    if (resolved.selectable !== false && isAnnotationUnlocked(annotation)) {
        context.canvas.setActiveObject(annotation);
    }
    context.canvas.renderAll();
    context.updateAnnotationList();
    context.saveCanvasState();
    const callbackContext = context.buildCallbackContext('createTextAnnotation');
    context.emitAnnotationsChanged(callbackContext);
    context.emitImageChanged(callbackContext);
    if (resolved.enterEditing && isAnnotationUnlocked(annotation)) {
        (_b = (_a = annotation).enterEditing) === null || _b === void 0 ? void 0 : _b.call(_a);
        selectAllText(annotation);
    }
    return annotation;
}
function handleTextModePointer(context, event) {
    var _a, _b;
    const fabricEvent = event;
    const target = fabricEvent.target;
    if (target && isTextAnnotationObject(target) && isAnnotationUnlocked(target)) {
        context.canvas.setActiveObject(target);
        (_b = (_a = target).enterEditing) === null || _b === void 0 ? void 0 : _b.call(_a);
        return;
    }
    const pointer = getPointerFromFabricEvent(context.canvas, event);
    if (!pointer)
        return;
    createTextAnnotation(context, {
        left: pointer.x,
        top: pointer.y,
    });
}
export function enterTextMode(context) {
    if (context.getTextSession())
        return;
    if (!context.isImageLoaded())
        return;
    const { canvas } = context;
    const previousCanvasSelection = !!canvas.selection;
    const previousDefaultCursor = canvas.defaultCursor;
    canvas.selection = true;
    canvas.defaultCursor = 'text';
    const callback = (event) => handleTextModePointer(context, event);
    canvas.on('mouse:down', callback);
    const session = {
        mode: 'text',
        previousCanvasSelection,
        previousDefaultCursor,
        handlers: [{ eventName: 'mouse:down', callback }],
        dispose: () => {
            try {
                canvas.off('mouse:down', callback);
            }
            catch {
            }
            canvas.selection = previousCanvasSelection;
            canvas.defaultCursor = previousDefaultCursor !== null && previousDefaultCursor !== void 0 ? previousDefaultCursor : 'default';
        },
    };
    context.setTextSession(session);
    context.updateUi();
}
export function exitTextMode(context) {
    const session = context.getTextSession();
    if (!session)
        return;
    finalizeActiveTextEditing(context, { commit: true });
    session.dispose();
    context.setTextSession(null);
    context.canvas.requestRenderAll();
    context.updateUi();
}
export function finalizeActiveTextEditing(context, options) {
    var _a;
    const active = context.canvas.getActiveObject();
    if (!active || !isTextAnnotationObject(active))
        return;
    const textObject = active;
    if (textObject.isEditing !== true)
        return;
    textObject.imageEditorTextEditingCancel = !options.commit;
    (_a = textObject.exitEditing) === null || _a === void 0 ? void 0 : _a.call(textObject);
    context.canvas.requestRenderAll();
}
export function attachTextEditingHandlersToAnnotations(context, annotations) {
    annotations.filter(isTextAnnotationObject).forEach((annotation) => {
        attachTextEditingHandlers(context, annotation);
    });
}
//# sourceMappingURL=text-controller.js.map