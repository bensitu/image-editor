const CROP_SESSION_ALLOWED_OPERATIONS = new Set([
    'setCropAspectRatio',
    'applyCrop',
    'cancelCrop',
    'saveState',
]);
const MOSAIC_SESSION_ALLOWED_OPERATIONS = new Set([
    'exitMosaicMode',
    'applyMosaic',
    'setMosaicConfig',
    'resetMosaicConfig',
    'setMosaicBrushSize',
    'setMosaicBlockSize',
    'saveState',
]);
const TOOL_MODE_ALLOWED_OPERATIONS = {
    crop: CROP_SESSION_ALLOWED_OPERATIONS,
    mosaic: MOSAIC_SESSION_ALLOWED_OPERATIONS,
    text: new Set([
        'exitTextMode',
        'createTextAnnotation',
        'setTextConfig',
        'resetTextConfig',
        'setTextColor',
        'setTextFontSize',
        'saveState',
    ]),
    draw: new Set([
        'exitDrawMode',
        'setDrawConfig',
        'resetDrawConfig',
        'setDrawColor',
        'setDrawBrushSize',
        'setDrawSubMode',
        'setEraserConfig',
        'resetEraserConfig',
        'commitEraserStroke',
        'saveState',
    ]),
    shape: new Set([
        'exitShapeMode',
        'createShapeAnnotation',
        'setShapeConfig',
        'resetShapeConfig',
        'saveState',
    ]),
};
const IMAGE_EDITOR_OPERATIONS = new Set([
    'init',
    'loadImage',
    'loadFromState',
    'saveState',
    'setCanvasSize',
    'resizeToContainer',
    'relayout',
    'scaleImage',
    'rotateImage',
    'flipHorizontal',
    'flipVertical',
    'resetImageTransform',
    'setImageFilterConfig',
    'resetImageFilterConfig',
    'clearImageFilters',
    'commitImageFilters',
    'createMask',
    'removeSelectedMask',
    'removeAllMasks',
    'mergeMasks',
    'createTextAnnotation',
    'createShapeAnnotation',
    'enterTextMode',
    'exitTextMode',
    'enterShapeMode',
    'exitShapeMode',
    'setShapeConfig',
    'resetShapeConfig',
    'setTextConfig',
    'resetTextConfig',
    'setTextColor',
    'setTextFontSize',
    'enterDrawMode',
    'exitDrawMode',
    'setDrawConfig',
    'resetDrawConfig',
    'setDrawColor',
    'setDrawBrushSize',
    'setDrawSubMode',
    'setEraserConfig',
    'resetEraserConfig',
    'commitEraserStroke',
    'updateSelectedAnnotation',
    'updateAnnotation',
    'removeSelectedAnnotation',
    'removeAllAnnotations',
    'deleteSelectedObject',
    'mergeAnnotations',
    'bringSelectedObjectForward',
    'sendSelectedObjectBackward',
    'bringSelectedObjectToFront',
    'sendSelectedObjectToBack',
    'enterCropMode',
    'setCropAspectRatio',
    'applyCrop',
    'cancelCrop',
    'enterMosaicMode',
    'exitMosaicMode',
    'applyMosaic',
    'setMosaicConfig',
    'resetMosaicConfig',
    'setMosaicBrushSize',
    'setMosaicBlockSize',
    'undo',
    'redo',
    'exportImageBase64',
    'exportImageFile',
    'downloadImage',
    'dispose',
]);
export function getActiveToolMode(snapshot) {
    if (snapshot.hasCropSession)
        return 'crop';
    if (snapshot.hasMosaicSession)
        return 'mosaic';
    if (snapshot.hasTextSession)
        return 'text';
    if (snapshot.hasDrawSession)
        return 'draw';
    if (snapshot.hasShapeSession)
        return 'shape';
    return null;
}
export function isToolModeActive(snapshot) {
    return getActiveToolMode(snapshot) !== null;
}
export function getAllowedOperationsForToolMode(mode) {
    return TOOL_MODE_ALLOWED_OPERATIONS[mode];
}
export function canRunOperationInToolMode(activeMode, operationName) {
    return !activeMode || getAllowedOperationsForToolMode(activeMode).has(operationName);
}
export function isImageEditorOperation(value) {
    return value !== null && IMAGE_EDITOR_OPERATIONS.has(value);
}
//# sourceMappingURL=tool-mode-policy.js.map