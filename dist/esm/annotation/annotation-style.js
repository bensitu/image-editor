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
function syncTextEditability(annotation, editable) {
    const textObject = annotation;
    textObject.editable = editable;
}
export function syncAnnotationRuntimeState(annotation) {
    var _a;
    const hidden = annotation.annotationHidden === true;
    const locked = isAnnotationLocked(annotation);
    setObjectProps(annotation, {
        visible: !hidden,
        selectable: locked ? false : true,
        evented: locked ? false : true,
        hasControls: !locked,
        lockMovementX: locked,
        lockMovementY: locked,
        lockScalingX: locked,
        lockScalingY: locked,
        lockRotation: locked,
    });
    if (!locked) {
        setObjectProps(annotation, {
            selectable: true,
            evented: true,
            hasControls: true,
            lockMovementX: false,
            lockMovementY: false,
            lockScalingX: false,
            lockScalingY: false,
            lockRotation: false,
        });
    }
    if (isTextAnnotationObject(annotation)) {
        syncTextEditability(annotation, !locked);
    }
    (_a = annotation.setCoords) === null || _a === void 0 ? void 0 : _a.call(annotation);
}
export function syncAnnotationRuntimeStates(annotations) {
    annotations.forEach(syncAnnotationRuntimeState);
}
//# sourceMappingURL=annotation-style.js.map