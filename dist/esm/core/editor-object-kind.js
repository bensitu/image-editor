export function markBaseImageObject(image) {
    const baseImage = image;
    baseImage.editorObjectKind = 'baseImage';
    return baseImage;
}
export function markMaskObject(object, meta) {
    const mask = object;
    mask.editorObjectKind = 'mask';
    mask.maskId = meta.maskId;
    mask.maskUid = meta.maskUid;
    mask.maskName = meta.maskName;
    mask.originalAlpha = meta.originalAlpha;
    if (meta.originalStroke !== undefined)
        mask.originalStroke = meta.originalStroke;
    if (typeof meta.originalStrokeWidth === 'number') {
        mask.originalStrokeWidth = meta.originalStrokeWidth;
    }
    return mask;
}
export function markAnnotationObject(object, meta) {
    var _a, _b;
    const annotation = object;
    annotation.editorObjectKind = 'annotation';
    annotation.annotationId = meta.annotationId;
    annotation.annotationType = meta.annotationType;
    annotation.annotationName = meta.annotationName;
    annotation.annotationHidden = (_a = meta.annotationHidden) !== null && _a !== void 0 ? _a : false;
    annotation.annotationLocked = (_b = meta.annotationLocked) !== null && _b !== void 0 ? _b : false;
    if (typeof meta.annotationSelectable === 'boolean') {
        annotation.annotationSelectable = meta.annotationSelectable;
    }
    if (typeof meta.annotationEvented === 'boolean') {
        annotation.annotationEvented = meta.annotationEvented;
    }
    if (typeof meta.annotationHasControls === 'boolean') {
        annotation.annotationHasControls = meta.annotationHasControls;
    }
    if (typeof meta.annotationEditable === 'boolean') {
        annotation.annotationEditable = meta.annotationEditable;
    }
    if (meta.shapeAnnotationKind) {
        annotation.shapeAnnotationKind = meta.shapeAnnotationKind;
    }
    return annotation;
}
export function markSessionObject(object, sessionObjectType) {
    const sessionObject = object;
    sessionObject.editorObjectKind = 'session';
    sessionObject.sessionObjectType = sessionObjectType;
    return sessionObject;
}
//# sourceMappingURL=editor-object-kind.js.map