import { isTextAnnotationObject, } from '../core/public-types.js';
import { isAnnotationLocked } from './annotation-lock.js';
function setObjectProps(object, props) {
    try {
        object.set(props);
    }
    catch {
        Object.assign(object, props);
    }
}
function readBoolean(value, fallback) {
    return typeof value === 'boolean' ? value : fallback;
}
function getBaseSelectable(annotation) {
    return readBoolean(annotation.annotationSelectable, readBoolean(annotation.selectable, true));
}
function getBaseEvented(annotation) {
    return readBoolean(annotation.annotationEvented, readBoolean(annotation.evented, true));
}
function getBaseHasControls(annotation) {
    return readBoolean(annotation.annotationHasControls, readBoolean(annotation.hasControls, true));
}
function getBaseEditable(annotation) {
    return readBoolean(annotation.annotationEditable, readBoolean(annotation.editable, true));
}
function syncTextEditability(annotation, editable) {
    const textObject = annotation;
    textObject.editable = editable;
}
function ensureBaseInteractivityMetadata(annotation) {
    if (typeof annotation.annotationSelectable !== 'boolean') {
        annotation.annotationSelectable = readBoolean(annotation.selectable, true);
    }
    if (typeof annotation.annotationEvented !== 'boolean') {
        annotation.annotationEvented = readBoolean(annotation.evented, true);
    }
    if (typeof annotation.annotationHasControls !== 'boolean') {
        annotation.annotationHasControls = readBoolean(annotation.hasControls, true);
    }
    if (isTextAnnotationObject(annotation) && typeof annotation.annotationEditable !== 'boolean') {
        annotation.annotationEditable = getBaseEditable(annotation);
    }
}
export function syncAnnotationRuntimeState(annotation) {
    var _a, _b;
    const hidden = annotation.annotationHidden === true;
    const locked = isAnnotationLocked(annotation);
    if (locked) {
        ensureBaseInteractivityMetadata(annotation);
        setObjectProps(annotation, {
            visible: !hidden,
            selectable: false,
            evented: false,
            hasControls: false,
            lockMovementX: true,
            lockMovementY: true,
            lockScalingX: true,
            lockScalingY: true,
            lockRotation: true,
        });
        if (isTextAnnotationObject(annotation)) {
            syncTextEditability(annotation, false);
        }
        (_a = annotation.setCoords) === null || _a === void 0 ? void 0 : _a.call(annotation);
        return;
    }
    setObjectProps(annotation, {
        visible: !hidden,
        selectable: getBaseSelectable(annotation),
        evented: getBaseEvented(annotation),
        hasControls: getBaseHasControls(annotation),
        lockMovementX: false,
        lockMovementY: false,
        lockScalingX: false,
        lockScalingY: false,
        lockRotation: false,
    });
    if (isTextAnnotationObject(annotation)) {
        syncTextEditability(annotation, getBaseEditable(annotation));
    }
    (_b = annotation.setCoords) === null || _b === void 0 ? void 0 : _b.call(annotation);
}
export function syncAnnotationRuntimeStates(annotations) {
    annotations.forEach(syncAnnotationRuntimeState);
}
//# sourceMappingURL=annotation-style.js.map