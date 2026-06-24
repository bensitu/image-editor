/**
 * Runtime Fabric flag synchronization for editor-owned annotations.
 *
 * `annotationHidden` and `annotationLocked` are business-level state. The
 * `annotationSelectable` / `annotationEvented` / `annotationHasControls` /
 * `annotationEditable` fields preserve the annotation's base interactivity so
 * locking can temporarily disable interaction without destroying user intent.
 *
 * @module
 */

import type * as FabricNS from 'fabric';

import {
    isTextAnnotationObject,
    type AnnotationObject,
    type TextAnnotationObject,
} from '../core/public-types.js';
import { isAnnotationLocked } from './annotation-lock.js';

function setObjectProps(
    object: FabricNS.FabricObject,
    props: Partial<FabricNS.FabricObjectProps>,
): void {
    object.set(props);
}

function readBoolean(value: unknown, fallback: boolean): boolean {
    return typeof value === 'boolean' ? value : fallback;
}

function getBaseSelectable(annotation: AnnotationObject): boolean {
    return readBoolean(annotation.annotationSelectable, readBoolean(annotation.selectable, true));
}

function getBaseEvented(annotation: AnnotationObject): boolean {
    return readBoolean(annotation.annotationEvented, readBoolean(annotation.evented, true));
}

function getBaseHasControls(annotation: AnnotationObject): boolean {
    return readBoolean(annotation.annotationHasControls, readBoolean(annotation.hasControls, true));
}

function getBaseEditable(annotation: TextAnnotationObject): boolean {
    return readBoolean(
        annotation.annotationEditable,
        readBoolean((annotation as TextAnnotationObject & { editable?: unknown }).editable, true),
    );
}

function syncTextEditability(annotation: TextAnnotationObject, editable: boolean): void {
    const textObject = annotation as TextAnnotationObject & { editable?: boolean };
    textObject.editable = editable;
}

function ensureBaseInteractivityMetadata(annotation: AnnotationObject): void {
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

export function syncAnnotationRuntimeState(annotation: AnnotationObject): void {
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
        annotation.setCoords?.();
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
    annotation.setCoords?.();
}

export function syncAnnotationRuntimeStates(annotations: AnnotationObject[]): void {
    annotations.forEach(syncAnnotationRuntimeState);
}
