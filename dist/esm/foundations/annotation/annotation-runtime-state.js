function booleanOr(value, fallback) {
    return typeof value === 'boolean' ? value : fallback;
}
export function captureAnnotationInteraction(object) {
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
export function applyAnnotationInteraction(object, interaction) {
    object.editorAnnotationSelectable = interaction.selectable;
    object.editorAnnotationEvented = interaction.evented;
    object.editorAnnotationHasControls = interaction.hasControls;
    if (typeof interaction.editable === 'boolean') {
        object.editorAnnotationEditable = interaction.editable;
    }
    synchronizeAnnotationRuntimeState(object);
}
export function synchronizeAnnotationRuntimeState(object) {
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
//# sourceMappingURL=annotation-runtime-state.js.map