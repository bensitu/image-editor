export function isBaseImageObject(object) {
    return (!!object &&
        typeof object === 'object' &&
        object.editorObjectKind === 'baseImage');
}
export function isMaskObject(object) {
    const candidate = object;
    return (!!candidate &&
        candidate.editorObjectKind === 'mask' &&
        typeof candidate.maskId === 'number' &&
        typeof candidate.maskUid === 'string' &&
        typeof candidate.maskName === 'string');
}
export function isAnnotationObject(object) {
    const candidate = object;
    return (!!candidate &&
        candidate.editorObjectKind === 'annotation' &&
        typeof candidate.annotationId === 'number' &&
        typeof candidate.annotationType === 'string' &&
        typeof candidate.annotationName === 'string');
}
export function isSessionObject(object) {
    const candidate = object;
    return (!!candidate &&
        candidate.editorObjectKind === 'session' &&
        typeof candidate.sessionObjectType === 'string');
}
export function isEditableOverlayObject(object) {
    return isMaskObject(object) || isAnnotationObject(object);
}
//# sourceMappingURL=public-types.js.map