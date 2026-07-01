const DEFAULT_ELEMENT_TARGETS = Object.freeze({
    canvas: 'canvas',
    canvasContainer: null,
    imagePlaceholder: 'imagePlaceholder',
    scalePercentageInput: 'scalePercentageInput',
    rotateLeftDegreesInput: 'rotateLeftDegreesInput',
    rotateRightDegreesInput: 'rotateRightDegreesInput',
    rotateLeftButton: 'rotateLeftButton',
    rotateRightButton: 'rotateRightButton',
    flipHorizontalButton: 'flipHorizontalButton',
    flipVerticalButton: 'flipVerticalButton',
    createMaskButton: 'createMaskButton',
    removeSelectedMaskButton: 'removeSelectedMaskButton',
    removeAllMasksButton: 'removeAllMasksButton',
    mergeMasksButton: 'mergeMasksButton',
    annotationList: 'annotationList',
    enterTextModeButton: 'enterTextModeButton',
    exitTextModeButton: 'exitTextModeButton',
    textColorInput: 'textColorInput',
    textFontSizeInput: 'textFontSizeInput',
    enterDrawModeButton: 'enterDrawModeButton',
    exitDrawModeButton: 'exitDrawModeButton',
    drawColorInput: 'drawColorInput',
    drawBrushSizeInput: 'drawBrushSizeInput',
    removeSelectedAnnotationButton: 'removeSelectedAnnotationButton',
    removeAllAnnotationsButton: 'removeAllAnnotationsButton',
    deleteSelectedObjectButton: 'deleteSelectedObjectButton',
    mergeAnnotationsButton: 'mergeAnnotationsButton',
    bringSelectedObjectForwardButton: 'bringSelectedObjectForwardButton',
    sendSelectedObjectBackwardButton: 'sendSelectedObjectBackwardButton',
    bringSelectedObjectToFrontButton: 'bringSelectedObjectToFrontButton',
    sendSelectedObjectToBackButton: 'sendSelectedObjectToBackButton',
    downloadImageButton: 'downloadImageButton',
    maskList: 'maskList',
    zoomInButton: 'zoomInButton',
    zoomOutButton: 'zoomOutButton',
    resetImageTransformButton: 'resetImageTransformButton',
    undoButton: 'undoButton',
    redoButton: 'redoButton',
    imageInput: 'imageInput',
    enterCropModeButton: 'enterCropModeButton',
    cropAspectRatioSelect: 'cropAspectRatioSelect',
    applyCropButton: 'applyCropButton',
    cancelCropButton: 'cancelCropButton',
    enterMosaicModeButton: 'enterMosaicModeButton',
    exitMosaicModeButton: 'exitMosaicModeButton',
    mosaicBrushSizeInput: 'mosaicBrushSizeInput',
    mosaicBlockSizeInput: 'mosaicBlockSizeInput',
    uploadArea: 'uploadArea',
});
const ELEMENT_KEYS = Object.freeze(Object.keys(DEFAULT_ELEMENT_TARGETS));
const ELEMENT_KEY_SET = new Set(ELEMENT_KEYS);
function isElementKey(value) {
    return ELEMENT_KEY_SET.has(value);
}
function isHTMLElementTarget(value) {
    return (!!value &&
        typeof value === 'object' &&
        value.nodeType === 1 &&
        typeof value.addEventListener === 'function');
}
function getFallbackDocument() {
    return typeof document !== 'undefined' ? document : null;
}
function hasTagName(element, tagName) {
    return element.tagName.toLowerCase() === tagName;
}
export function isCanvasElement(element) {
    return hasTagName(element, 'canvas');
}
export function isInputElement(element) {
    return hasTagName(element, 'input');
}
export function isSelectElement(element) {
    return hasTagName(element, 'select');
}
export function isInputOrSelectElement(element) {
    return isInputElement(element) || isSelectElement(element);
}
export function resolveDomElement(target, ownerDocument, guard) {
    var _a;
    if (target === null || target === undefined)
        return null;
    const element = isHTMLElementTarget(target)
        ? target
        : (_a = (ownerDocument !== null && ownerDocument !== void 0 ? ownerDocument : getFallbackDocument())) === null || _a === void 0 ? void 0 : _a.getElementById(target);
    if (!element)
        return null;
    if (guard && !guard(element))
        return null;
    return element;
}
export function resolveElementTargets(elementMap = {}) {
    const resolved = { ...DEFAULT_ELEMENT_TARGETS };
    for (const [key, value] of Object.entries(elementMap)) {
        if (!isElementKey(key))
            continue;
        resolved[key] = value === undefined ? null : value;
    }
    return resolved;
}
//# sourceMappingURL=editor-elements.js.map