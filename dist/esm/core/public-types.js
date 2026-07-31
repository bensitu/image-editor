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
export function isSessionObject(object) {
    const candidate = object;
    return (!!candidate &&
        candidate.editorObjectKind === 'session' &&
        typeof candidate.sessionObjectType === 'string');
}
//# sourceMappingURL=public-types.js.map