function bindElement(context, key, eventType, handler) {
    context.bindings.bindIfExists(key, eventType, handler);
}
function parseInputNumber(context, key) {
    return parseFloat(context.getInputValue(key));
}
function parseEventInputNumber(event) {
    return parseFloat(event.target.value);
}
function handleAsyncAction(context, operation, action) {
    try {
        void Promise.resolve(action()).catch((error) => {
            context.actions.reportAsyncActionError(operation, error);
        });
    }
    catch (error) {
        context.actions.reportAsyncActionError(operation, error);
    }
}
function getEventInputValue(event) {
    return event.target.value;
}
function getEventInputChecked(event) {
    return event.target.checked;
}
function parseShapeKind(value) {
    return value === 'line' || value === 'arrow' ? value : 'rect';
}
function bindUploadEvents(context) {
    bindElement(context, 'uploadArea', 'click', () => {
        context.actions.openImagePicker();
    });
    bindElement(context, 'imageInput', 'change', (event) => {
        var _a;
        const file = (_a = event.target.files) === null || _a === void 0 ? void 0 : _a[0];
        if (file) {
            handleAsyncAction(context, 'loadImageFile', () => context.actions.loadImageFile(file));
        }
    });
}
function bindImageFilterEvents(context) {
    bindNumberInput(context, 'imageBrightnessInput', (value) => {
        context.actions.setImageFilterConfig({ brightness: value });
    });
    bindNumberInput(context, 'imageContrastInput', (value) => {
        context.actions.setImageFilterConfig({ contrast: value });
    });
    bindNumberInput(context, 'imageSaturationInput', (value) => {
        context.actions.setImageFilterConfig({ saturation: value });
    });
    bindNumberInput(context, 'imageBlurInput', (value) => {
        context.actions.setImageFilterConfig({ blur: value });
    });
    bindNumberInput(context, 'imageSharpenInput', (value) => {
        context.actions.setImageFilterConfig({ sharpen: value });
    });
    bindBooleanInput(context, 'imageGrayscaleInput', (value) => {
        context.actions.setImageFilterConfig({ grayscale: value });
    });
    bindBooleanInput(context, 'imageSepiaInput', (value) => {
        context.actions.setImageFilterConfig({ sepia: value });
    });
    bindBooleanInput(context, 'imageVintageInput', (value) => {
        context.actions.setImageFilterConfig({ vintage: value });
    });
    bindElement(context, 'applyImageFiltersButton', 'click', () => {
        context.actions.commitImageFilters();
    });
    bindElement(context, 'resetImageFiltersButton', 'click', () => {
        context.actions.resetImageFilterConfig();
    });
    bindElement(context, 'clearImageFiltersButton', 'click', () => {
        context.actions.clearImageFilters();
    });
}
function bindTransformEvents(context) {
    bindElement(context, 'zoomInButton', 'click', () => {
        handleAsyncAction(context, 'zoomIn', () => context.actions.zoomIn());
    });
    bindElement(context, 'zoomOutButton', 'click', () => {
        handleAsyncAction(context, 'zoomOut', () => context.actions.zoomOut());
    });
    bindElement(context, 'resetImageTransformButton', 'click', () => {
        handleAsyncAction(context, 'resetImageTransform', () => context.actions.resetImageTransform());
    });
    bindElement(context, 'flipHorizontalButton', 'click', () => {
        handleAsyncAction(context, 'flipHorizontal', () => context.actions.flipHorizontal());
    });
    bindElement(context, 'flipVerticalButton', 'click', () => {
        handleAsyncAction(context, 'flipVertical', () => context.actions.flipVertical());
    });
    bindElement(context, 'rotateLeftButton', 'click', () => {
        const parsedStep = parseInputNumber(context, 'rotateLeftDegreesInput');
        const step = Number.isNaN(parsedStep) ? context.rotationStep : parsedStep;
        handleAsyncAction(context, 'rotateLeft', () => context.actions.rotateLeft(step));
    });
    bindElement(context, 'rotateRightButton', 'click', () => {
        const parsedStep = parseInputNumber(context, 'rotateRightDegreesInput');
        const step = Number.isNaN(parsedStep) ? context.rotationStep : parsedStep;
        handleAsyncAction(context, 'rotateRight', () => context.actions.rotateRight(step));
    });
}
function bindMaskEvents(context) {
    bindElement(context, 'createMaskButton', 'click', () => {
        context.actions.createMask();
    });
    bindElement(context, 'removeSelectedMaskButton', 'click', () => {
        context.actions.removeSelectedMask();
    });
    bindElement(context, 'removeAllMasksButton', 'click', () => {
        context.actions.removeAllMasks();
    });
    bindElement(context, 'mergeMasksButton', 'click', () => {
        handleAsyncAction(context, 'mergeMasks', () => context.actions.mergeMasks());
    });
}
function bindAnnotationEvents(context) {
    bindElement(context, 'mergeAnnotationsButton', 'click', () => {
        handleAsyncAction(context, 'mergeAnnotations', () => context.actions.mergeAnnotations());
    });
    bindElement(context, 'enterTextModeButton', 'click', () => {
        context.actions.enterTextMode();
    });
    bindElement(context, 'exitTextModeButton', 'click', () => {
        context.actions.exitTextMode();
    });
    bindElement(context, 'enterDrawModeButton', 'click', () => {
        context.actions.enterDrawMode();
    });
    bindElement(context, 'exitDrawModeButton', 'click', () => {
        context.actions.exitDrawMode();
    });
    bindElement(context, 'createShapeAnnotationButton', 'click', () => {
        context.actions.createShapeAnnotation();
    });
    bindElement(context, 'enterShapeModeButton', 'click', () => {
        context.actions.enterShapeMode(parseShapeKind(context.getInputValue('shapeKindSelect')));
    });
    bindElement(context, 'exitShapeModeButton', 'click', () => {
        context.actions.exitShapeMode();
    });
    bindElement(context, 'removeSelectedAnnotationButton', 'click', () => {
        context.actions.removeSelectedAnnotation();
    });
    bindElement(context, 'removeAllAnnotationsButton', 'click', () => {
        context.actions.removeAllAnnotations();
    });
    bindElement(context, 'deleteSelectedObjectButton', 'click', () => {
        context.actions.deleteSelectedObject();
    });
    bindElement(context, 'bringSelectedObjectForwardButton', 'click', () => {
        context.actions.bringSelectedObjectForward();
    });
    bindElement(context, 'sendSelectedObjectBackwardButton', 'click', () => {
        context.actions.sendSelectedObjectBackward();
    });
    bindElement(context, 'bringSelectedObjectToFrontButton', 'click', () => {
        context.actions.bringSelectedObjectToFront();
    });
    bindElement(context, 'sendSelectedObjectToBackButton', 'click', () => {
        context.actions.sendSelectedObjectToBack();
    });
    bindStringInput(context, 'textColorInput', (value) => {
        context.actions.setTextColor(value);
    });
    bindNumberInput(context, 'textFontSizeInput', (value) => {
        context.actions.setTextFontSize(value);
    });
    bindStringInput(context, 'drawColorInput', (value) => {
        context.actions.setDrawColor(value);
    });
    bindNumberInput(context, 'drawBrushSizeInput', (value) => {
        context.actions.setDrawBrushSize(value);
    });
    bindElement(context, 'drawBrushSubModeButton', 'click', () => {
        context.actions.setDrawSubMode('brush');
    });
    bindElement(context, 'drawEraseSubModeButton', 'click', () => {
        context.actions.setDrawSubMode('erase');
    });
    bindNumberInput(context, 'eraserBrushSizeInput', (value) => {
        context.actions.setEraserBrushSize(value);
    });
    bindStringInput(context, 'shapeKindSelect', (value) => {
        context.actions.setShapeConfig({ shape: parseShapeKind(value) });
    });
    bindStringInput(context, 'shapeStrokeInput', (value) => {
        context.actions.setShapeConfig({ stroke: value });
    });
    bindNumberInput(context, 'shapeStrokeWidthInput', (value) => {
        context.actions.setShapeConfig({ strokeWidth: value });
    });
    bindStringInput(context, 'shapeFillInput', (value) => {
        context.actions.setShapeConfig({ fill: value });
    });
}
function bindHistoryEvents(context) {
    bindElement(context, 'downloadImageButton', 'click', () => {
        handleAsyncAction(context, 'downloadImage', () => context.actions.downloadImage());
    });
    bindElement(context, 'undoButton', 'click', () => {
        handleAsyncAction(context, 'undo', () => context.actions.undo());
    });
    bindElement(context, 'redoButton', 'click', () => {
        handleAsyncAction(context, 'redo', () => context.actions.redo());
    });
}
function bindCropEvents(context) {
    bindElement(context, 'enterCropModeButton', 'click', () => {
        context.actions.enterCropMode();
    });
    bindElement(context, 'cropAspectRatioSelect', 'change', () => {
        context.actions.updateSelectedCropAspectRatio();
    });
    bindElement(context, 'applyCropButton', 'click', () => {
        void context.actions.applyCrop().catch((error) => {
            context.actions.reportCropApplyError(error);
        });
    });
    bindElement(context, 'cancelCropButton', 'click', () => {
        context.actions.cancelCrop();
    });
}
function bindMosaicEvents(context) {
    bindElement(context, 'enterMosaicModeButton', 'click', () => {
        context.actions.enterMosaicMode();
    });
    bindElement(context, 'exitMosaicModeButton', 'click', () => {
        context.actions.exitMosaicMode();
    });
    bindNumberInput(context, 'mosaicBrushSizeInput', (value) => {
        context.actions.setMosaicBrushSize(value);
    });
    bindNumberInput(context, 'mosaicBlockSizeInput', (value) => {
        context.actions.setMosaicBlockSize(value);
    });
}
function bindStringInput(context, key, applyValue) {
    let lastAppliedValue = null;
    const handler = (event) => {
        const value = getEventInputValue(event);
        if (value === lastAppliedValue)
            return;
        lastAppliedValue = value;
        applyValue(value);
    };
    bindElement(context, key, 'input', handler);
    bindElement(context, key, 'change', handler);
}
function bindNumberInput(context, key, applyValue) {
    let lastAppliedValue = null;
    const handler = (event) => {
        const value = parseEventInputNumber(event);
        if (lastAppliedValue !== null && Object.is(value, lastAppliedValue))
            return;
        lastAppliedValue = value;
        applyValue(value);
    };
    bindElement(context, key, 'input', handler);
    bindElement(context, key, 'change', handler);
}
function bindBooleanInput(context, key, applyValue) {
    let lastAppliedValue = null;
    const handler = (event) => {
        const value = getEventInputChecked(event);
        if (lastAppliedValue !== null && value === lastAppliedValue)
            return;
        lastAppliedValue = value;
        applyValue(value);
    };
    bindElement(context, key, 'input', handler);
    bindElement(context, key, 'change', handler);
}
export function bindEditorDomEvents(context) {
    bindUploadEvents(context);
    bindImageFilterEvents(context);
    bindTransformEvents(context);
    bindMaskEvents(context);
    bindAnnotationEvents(context);
    bindHistoryEvents(context);
    bindCropEvents(context);
    bindMosaicEvents(context);
}
//# sourceMappingURL=editor-dom-events.js.map