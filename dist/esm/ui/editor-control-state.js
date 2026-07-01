const CROP_MODE_CONTROL_KEYS = [
    'scalePercentageInput',
    'rotateLeftDegreesInput',
    'rotateRightDegreesInput',
    'rotateLeftButton',
    'rotateRightButton',
    'flipHorizontalButton',
    'flipVerticalButton',
    'createMaskButton',
    'removeSelectedMaskButton',
    'removeAllMasksButton',
    'mergeMasksButton',
    'mergeAnnotationsButton',
    'enterTextModeButton',
    'exitTextModeButton',
    'textColorInput',
    'textFontSizeInput',
    'enterDrawModeButton',
    'exitDrawModeButton',
    'drawColorInput',
    'drawBrushSizeInput',
    'removeSelectedAnnotationButton',
    'removeAllAnnotationsButton',
    'deleteSelectedObjectButton',
    'bringSelectedObjectForwardButton',
    'sendSelectedObjectBackwardButton',
    'bringSelectedObjectToFrontButton',
    'sendSelectedObjectToBackButton',
    'downloadImageButton',
    'zoomInButton',
    'zoomOutButton',
    'resetImageTransformButton',
    'undoButton',
    'redoButton',
    'imageInput',
    'enterCropModeButton',
    'cropAspectRatioSelect',
    'applyCropButton',
    'cancelCropButton',
    'enterMosaicModeButton',
    'exitMosaicModeButton',
    'mosaicBrushSizeInput',
    'mosaicBlockSizeInput',
];
const CROP_MODE_ENABLED_KEYS = [
    'cropAspectRatioSelect',
    'applyCropButton',
    'cancelCropButton',
];
const TEXT_MODE_CONTROL_KEYS = CROP_MODE_CONTROL_KEYS;
const TEXT_MODE_ENABLED_KEYS = [
    'exitTextModeButton',
    'textColorInput',
    'textFontSizeInput',
];
const DRAW_MODE_CONTROL_KEYS = CROP_MODE_CONTROL_KEYS;
const DRAW_MODE_ENABLED_KEYS = [
    'exitDrawModeButton',
    'drawColorInput',
    'drawBrushSizeInput',
];
const MOSAIC_MODE_CONTROL_KEYS = [
    'scalePercentageInput',
    'rotateLeftDegreesInput',
    'rotateRightDegreesInput',
    'rotateLeftButton',
    'rotateRightButton',
    'flipHorizontalButton',
    'flipVerticalButton',
    'createMaskButton',
    'removeSelectedMaskButton',
    'removeAllMasksButton',
    'mergeMasksButton',
    'mergeAnnotationsButton',
    'enterTextModeButton',
    'exitTextModeButton',
    'textColorInput',
    'textFontSizeInput',
    'enterDrawModeButton',
    'exitDrawModeButton',
    'drawColorInput',
    'drawBrushSizeInput',
    'removeSelectedAnnotationButton',
    'removeAllAnnotationsButton',
    'deleteSelectedObjectButton',
    'bringSelectedObjectForwardButton',
    'sendSelectedObjectBackwardButton',
    'bringSelectedObjectToFrontButton',
    'sendSelectedObjectToBackButton',
    'downloadImageButton',
    'zoomInButton',
    'zoomOutButton',
    'resetImageTransformButton',
    'undoButton',
    'redoButton',
    'imageInput',
    'enterCropModeButton',
    'cropAspectRatioSelect',
    'applyCropButton',
    'cancelCropButton',
    'enterMosaicModeButton',
    'exitMosaicModeButton',
    'mosaicBrushSizeInput',
    'mosaicBlockSizeInput',
];
const MOSAIC_MODE_ENABLED_KEYS = [
    'exitMosaicModeButton',
    'mosaicBrushSizeInput',
    'mosaicBlockSizeInput',
];
function setModeControlState(controlKeys, enabledKeys, snapshot, setEnabled) {
    controlKeys.forEach((key) => {
        setEnabled(key, !snapshot.isBusy && enabledKeys.includes(key));
    });
}
export function applyEditorControlState(snapshot, setEnabled) {
    if (snapshot.isDisposed) {
        CROP_MODE_CONTROL_KEYS.forEach((key) => {
            setEnabled(key, false);
        });
        return;
    }
    if (snapshot.isInCropMode) {
        setModeControlState(CROP_MODE_CONTROL_KEYS, CROP_MODE_ENABLED_KEYS, snapshot, setEnabled);
        return;
    }
    if (snapshot.isInTextMode) {
        setModeControlState(TEXT_MODE_CONTROL_KEYS, TEXT_MODE_ENABLED_KEYS, snapshot, setEnabled);
        return;
    }
    if (snapshot.isInDrawMode) {
        setModeControlState(DRAW_MODE_CONTROL_KEYS, DRAW_MODE_ENABLED_KEYS, snapshot, setEnabled);
        return;
    }
    if (snapshot.isInMosaicMode) {
        MOSAIC_MODE_CONTROL_KEYS.forEach((key) => {
            setEnabled(key, !snapshot.isBusy &&
                !snapshot.isMosaicApplying &&
                MOSAIC_MODE_ENABLED_KEYS.includes(key));
        });
        setEnabled('imageInput', false);
        return;
    }
    setEnabled('scalePercentageInput', snapshot.hasImage && !snapshot.isBusy);
    setEnabled('rotateLeftDegreesInput', snapshot.hasImage && !snapshot.isBusy);
    setEnabled('rotateRightDegreesInput', snapshot.hasImage && !snapshot.isBusy);
    setEnabled('zoomInButton', snapshot.hasImage && !snapshot.isBusy && snapshot.currentScale < snapshot.maxScale);
    setEnabled('zoomOutButton', snapshot.hasImage && !snapshot.isBusy && snapshot.currentScale > snapshot.minScale);
    setEnabled('rotateLeftButton', snapshot.hasImage && !snapshot.isBusy);
    setEnabled('rotateRightButton', snapshot.hasImage && !snapshot.isBusy);
    setEnabled('flipHorizontalButton', snapshot.hasImage && !snapshot.isBusy);
    setEnabled('flipVerticalButton', snapshot.hasImage && !snapshot.isBusy);
    setEnabled('createMaskButton', snapshot.hasImage && !snapshot.isBusy);
    setEnabled('removeSelectedMaskButton', snapshot.hasSelectedMask && !snapshot.isBusy);
    setEnabled('removeAllMasksButton', snapshot.hasMasks && !snapshot.isBusy);
    setEnabled('mergeMasksButton', snapshot.hasImage && snapshot.hasMasks && !snapshot.isBusy);
    setEnabled('removeSelectedAnnotationButton', snapshot.hasSelectedAnnotation && !snapshot.isBusy);
    setEnabled('removeAllAnnotationsButton', snapshot.hasAnnotations && !snapshot.isBusy);
    setEnabled('deleteSelectedObjectButton', snapshot.hasSelectedEditableObject && !snapshot.isBusy);
    setEnabled('mergeAnnotationsButton', snapshot.hasImage && snapshot.hasAnnotations && !snapshot.isBusy);
    setEnabled('bringSelectedObjectForwardButton', snapshot.hasSelectedEditableObject && !snapshot.isBusy);
    setEnabled('sendSelectedObjectBackwardButton', snapshot.hasSelectedEditableObject && !snapshot.isBusy);
    setEnabled('bringSelectedObjectToFrontButton', snapshot.hasSelectedEditableObject && !snapshot.isBusy);
    setEnabled('sendSelectedObjectToBackButton', snapshot.hasSelectedEditableObject && !snapshot.isBusy);
    setEnabled('downloadImageButton', snapshot.hasImage && !snapshot.isBusy);
    setEnabled('resetImageTransformButton', snapshot.hasImage && !snapshot.isDefaultTransform && !snapshot.isBusy);
    setEnabled('undoButton', snapshot.hasImage && !snapshot.isBusy && snapshot.canUndo);
    setEnabled('redoButton', snapshot.hasImage && !snapshot.isBusy && snapshot.canRedo);
    setEnabled('enterCropModeButton', snapshot.hasImage && !snapshot.isBusy);
    setEnabled('cropAspectRatioSelect', snapshot.hasImage && !snapshot.isBusy);
    setEnabled('enterMosaicModeButton', snapshot.hasImage && !snapshot.isBusy);
    setEnabled('enterTextModeButton', snapshot.hasImage && !snapshot.isBusy);
    setEnabled('enterDrawModeButton', snapshot.hasImage && !snapshot.isBusy);
    setEnabled('exitMosaicModeButton', false);
    setEnabled('exitTextModeButton', false);
    setEnabled('exitDrawModeButton', false);
    setEnabled('mosaicBrushSizeInput', !snapshot.isDisposed);
    setEnabled('mosaicBlockSizeInput', !snapshot.isDisposed);
    setEnabled('textColorInput', !snapshot.isDisposed);
    setEnabled('textFontSizeInput', !snapshot.isDisposed);
    setEnabled('drawColorInput', !snapshot.isDisposed);
    setEnabled('drawBrushSizeInput', !snapshot.isDisposed);
    setEnabled('imageInput', !snapshot.isBusy);
    setEnabled('applyCropButton', false);
    setEnabled('cancelCropButton', false);
}
//# sourceMappingURL=editor-control-state.js.map