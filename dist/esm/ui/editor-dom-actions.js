import { isInputElement, isInputOrSelectElement, resolveDomElement, } from '../core/editor-elements.js';
function normalizeStepScale(value) {
    const rounded = Math.round(value * 1000000) / 1000000;
    return Number.isFinite(rounded) ? rounded : 1;
}
export function createEditorDomEventActions(runtime, ownerDocument, host) {
    return {
        reportAsyncActionError: (operation, error) => {
            host.reportAsyncActionError(operation, error);
        },
        openImagePicker: () => {
            var _a;
            (_a = resolveDomElement(runtime.elements.imageInput, ownerDocument, isInputElement)) === null || _a === void 0 ? void 0 : _a.click();
        },
        loadImageFile: (file) => host.loadImageFile(file),
        zoomIn: () => host.scaleImage(normalizeStepScale(runtime.currentScale + runtime.options.scaleStep)),
        zoomOut: () => host.scaleImage(normalizeStepScale(runtime.currentScale - runtime.options.scaleStep)),
        resetImageTransform: () => host.resetImageTransform(),
        flipHorizontal: () => host.flipHorizontal(),
        flipVertical: () => host.flipVertical(),
        rotateLeft: (degrees) => host.rotateImage(runtime.currentRotation - degrees),
        rotateRight: (degrees) => host.rotateImage(runtime.currentRotation + degrees),
        createMask: () => {
            host.createMask();
        },
        removeSelectedMask: () => {
            host.removeSelectedMask();
        },
        removeAllMasks: () => {
            host.removeAllMasks();
        },
        mergeMasks: () => host.mergeMasks(),
        mergeAnnotations: () => host.mergeAnnotations(),
        enterTextMode: () => {
            host.enterTextMode();
        },
        exitTextMode: () => {
            host.exitTextMode();
        },
        enterDrawMode: () => {
            host.enterDrawMode();
        },
        exitDrawMode: () => {
            host.exitDrawMode();
        },
        removeSelectedAnnotation: () => {
            host.removeSelectedAnnotation();
        },
        removeAllAnnotations: () => {
            host.removeAllAnnotations();
        },
        deleteSelectedObject: () => {
            host.deleteSelectedObject();
        },
        bringSelectedObjectForward: () => {
            host.bringSelectedObjectForward();
        },
        sendSelectedObjectBackward: () => {
            host.sendSelectedObjectBackward();
        },
        bringSelectedObjectToFront: () => {
            host.bringSelectedObjectToFront();
        },
        sendSelectedObjectToBack: () => {
            host.sendSelectedObjectToBack();
        },
        downloadImage: () => host.downloadImage(),
        undo: () => host.undo(),
        redo: () => host.redo(),
        enterCropMode: () => {
            host.enterCropMode({ aspectRatio: getSelectedCropAspectRatio(runtime, ownerDocument) });
        },
        updateSelectedCropAspectRatio: () => {
            if (runtime.cropSession) {
                host.setCropAspectRatio(getSelectedCropAspectRatio(runtime, ownerDocument));
            }
        },
        applyCrop: () => host.applyCrop(),
        reportCropApplyError: (error) => {
            host.reportCropApplyError(error);
        },
        cancelCrop: () => {
            host.cancelCrop();
        },
        enterMosaicMode: () => {
            host.enterMosaicMode();
        },
        exitMosaicMode: () => {
            host.exitMosaicMode();
        },
        setMosaicBrushSize: (size) => {
            host.setMosaicBrushSize(size);
        },
        setMosaicBlockSize: (size) => {
            host.setMosaicBlockSize(size);
        },
        setTextColor: (color) => {
            host.setTextColor(color);
        },
        setTextFontSize: (size) => {
            host.setTextFontSize(size);
        },
        setDrawColor: (color) => {
            host.setDrawColor(color);
        },
        setDrawBrushSize: (size) => {
            host.setDrawBrushSize(size);
        },
    };
}
function getSelectedCropAspectRatio(runtime, ownerDocument) {
    const inputEl = resolveDomElement(runtime.elements.cropAspectRatioSelect, ownerDocument, isInputOrSelectElement);
    const value = inputEl && 'value' in inputEl ? String(inputEl.value).trim() : '';
    return (value || 'free');
}
//# sourceMappingURL=editor-dom-actions.js.map