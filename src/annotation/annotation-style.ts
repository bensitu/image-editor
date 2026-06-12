import type * as FabricNS from 'fabric';

import {
    isTextAnnotationObject,
    type AnnotationObject,
    type TextAnnotationObject,
} from '../core/public-types.js';

function setObjectProps(
    object: FabricNS.FabricObject,
    props: Partial<FabricNS.FabricObjectProps>,
): void {
    try {
        object.set(props);
    } catch {
        Object.assign(object, props);
    }
}

function syncTextEditability(annotation: TextAnnotationObject, editable: boolean): void {
    const textObject = annotation as TextAnnotationObject & { editable?: boolean };
    textObject.editable = editable;
}

export function syncAnnotationRuntimeState(annotation: AnnotationObject): void {
    const hidden = annotation.annotationHidden === true;
    const locked = annotation.annotationLocked === true;

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
    annotation.setCoords?.();
}

export function syncAnnotationRuntimeStates(annotations: AnnotationObject[]): void {
    annotations.forEach(syncAnnotationRuntimeState);
}
