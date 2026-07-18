import type * as FabricNS from 'fabric';

import type { AnnotationMetadata } from './annotation-definition.js';

export type AnnotationFabricObject = FabricNS.FabricObject & {
    editorAnnotationKind?: string;
    editorAnnotationName?: string;
    editorAnnotationMetadata?: AnnotationMetadata;
    editorAnnotationSelectable?: boolean;
    editorAnnotationEvented?: boolean;
    editorAnnotationHasControls?: boolean;
    editorAnnotationEditable?: boolean;
    editorOverlayKind?: string;
    editorOverlayId?: string;
    editorOverlayHidden?: boolean;
    editorOverlayLocked?: boolean;
    editable?: boolean;
};

export interface AnnotationInteractionState {
    readonly selectable: boolean;
    readonly evented: boolean;
    readonly hasControls: boolean;
    readonly editable?: boolean;
}

function booleanOr(value: unknown, fallback: boolean): boolean {
    return typeof value === 'boolean' ? value : fallback;
}

export function captureAnnotationInteraction(
    object: AnnotationFabricObject,
): AnnotationInteractionState {
    return Object.freeze({
        selectable: booleanOr(object.editorAnnotationSelectable, object.selectable !== false),
        evented: booleanOr(object.editorAnnotationEvented, object.evented !== false),
        hasControls: booleanOr(object.editorAnnotationHasControls, object.hasControls !== false),
        ...(typeof object.editorAnnotationEditable === 'boolean' ||
        typeof object.editable === 'boolean'
            ? {
                  editable: booleanOr(object.editorAnnotationEditable, object.editable !== false),
              }
            : {}),
    });
}

export function applyAnnotationInteraction(
    object: AnnotationFabricObject,
    interaction: AnnotationInteractionState,
): void {
    object.editorAnnotationSelectable = interaction.selectable;
    object.editorAnnotationEvented = interaction.evented;
    object.editorAnnotationHasControls = interaction.hasControls;
    if (typeof interaction.editable === 'boolean') {
        object.editorAnnotationEditable = interaction.editable;
    }
    synchronizeAnnotationRuntimeState(object);
}

export function synchronizeAnnotationRuntimeState(object: AnnotationFabricObject): void {
    const hidden = object.editorOverlayHidden === true;
    const locked = object.editorOverlayLocked === true;
    const interaction = captureAnnotationInteraction(object);
    object.set({
        visible: !hidden,
        selectable: locked ? false : interaction.selectable,
        evented: locked ? false : interaction.evented,
        hasControls: locked ? false : interaction.hasControls,
        lockMovementX: locked,
        lockMovementY: locked,
        lockScalingX: locked,
        lockScalingY: locked,
        lockRotation: locked,
    });
    if (typeof interaction.editable === 'boolean') {
        object.editable = locked ? false : interaction.editable;
    }
    object.setCoords();
}
