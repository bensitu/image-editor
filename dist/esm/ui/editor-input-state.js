function isValueControl(element) {
    return !!element && 'value' in element;
}
function isCheckedInput(element) {
    return !!element && 'checked' in element;
}
function isReadOnlyControl(element) {
    return 'readOnly' in element && element.readOnly;
}
function syncInputValue(element, value) {
    if (!isValueControl(element))
        return;
    const ownerDocument = element.ownerDocument;
    if (ownerDocument.activeElement === element && !isReadOnlyControl(element))
        return;
    if (element.value !== value)
        element.value = value;
}
function syncInputChecked(element, checked) {
    if (!isCheckedInput(element))
        return;
    if (element.checked !== checked)
        element.checked = checked;
}
function syncToggleButton(element, pressed) {
    if (!element)
        return;
    const next = pressed ? 'true' : 'false';
    if (element.getAttribute('aria-pressed') !== next) {
        element.setAttribute('aria-pressed', next);
    }
}
function syncValue(getElement, key, value) {
    syncInputValue(getElement(key), value);
}
function syncChecked(getElement, key, checked) {
    syncInputChecked(getElement(key), checked);
}
function syncPressed(getElement, key, pressed) {
    syncToggleButton(getElement(key), pressed);
}
export function applyEditorInputState(snapshot, getElement) {
    syncValue(getElement, 'scalePercentageInput', String(Math.round(snapshot.currentScale * 100)));
    syncValue(getElement, 'imageBrightnessInput', String(snapshot.imageFilterConfig.brightness));
    syncValue(getElement, 'imageContrastInput', String(snapshot.imageFilterConfig.contrast));
    syncValue(getElement, 'imageSaturationInput', String(snapshot.imageFilterConfig.saturation));
    syncValue(getElement, 'imageBlurInput', String(snapshot.imageFilterConfig.blur));
    syncValue(getElement, 'imageSharpenInput', String(snapshot.imageFilterConfig.sharpen));
    syncChecked(getElement, 'imageGrayscaleInput', snapshot.imageFilterConfig.grayscale);
    syncChecked(getElement, 'imageSepiaInput', snapshot.imageFilterConfig.sepia);
    syncChecked(getElement, 'imageVintageInput', snapshot.imageFilterConfig.vintage);
    syncValue(getElement, 'mosaicBrushSizeInput', String(snapshot.mosaicConfig.brushSize));
    syncValue(getElement, 'mosaicBlockSizeInput', String(snapshot.mosaicConfig.blockSize));
    syncValue(getElement, 'textColorInput', snapshot.textConfig.fill);
    syncValue(getElement, 'textFontSizeInput', String(snapshot.textConfig.fontSize));
    syncValue(getElement, 'drawColorInput', snapshot.drawConfig.color);
    syncValue(getElement, 'drawBrushSizeInput', String(snapshot.drawConfig.brushSize));
    syncPressed(getElement, 'drawBrushSubModeButton', snapshot.drawSubMode === 'brush');
    syncPressed(getElement, 'drawEraseSubModeButton', snapshot.drawSubMode === 'erase');
    syncValue(getElement, 'eraserBrushSizeInput', String(snapshot.eraserConfig.brushSize));
    syncValue(getElement, 'shapeKindSelect', snapshot.shapeConfig.shape);
    syncValue(getElement, 'shapeStrokeInput', snapshot.shapeConfig.stroke);
    syncValue(getElement, 'shapeStrokeWidthInput', String(snapshot.shapeConfig.strokeWidth));
    syncValue(getElement, 'shapeFillInput', snapshot.shapeConfig.fill);
}
//# sourceMappingURL=editor-input-state.js.map