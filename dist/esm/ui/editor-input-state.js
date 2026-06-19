function syncInputValue(inputElement, value) {
    if (!inputElement)
        return;
    const ownerDocument = inputElement.ownerDocument;
    if (ownerDocument.activeElement === inputElement && !inputElement.readOnly)
        return;
    if (inputElement.value !== value)
        inputElement.value = value;
}
function syncInput(getInputElement, key, value) {
    syncInputValue(getInputElement(key), value);
}
export function applyEditorInputState(snapshot, getInputElement) {
    syncInput(getInputElement, 'scalePercentageInput', String(Math.round(snapshot.currentScale * 100)));
    syncInput(getInputElement, 'mosaicBrushSizeInput', String(snapshot.mosaicConfig.brushSize));
    syncInput(getInputElement, 'mosaicBlockSizeInput', String(snapshot.mosaicConfig.blockSize));
    syncInput(getInputElement, 'textColorInput', snapshot.textConfig.fill);
    syncInput(getInputElement, 'textFontSizeInput', String(snapshot.textConfig.fontSize));
    syncInput(getInputElement, 'drawColorInput', snapshot.drawConfig.color);
    syncInput(getInputElement, 'drawBrushSizeInput', String(snapshot.drawConfig.brushSize));
}
//# sourceMappingURL=editor-input-state.js.map