function bindElement(context, key, eventType, handler) {
    context.bindings.bindIfExists(key, eventType, handler);
}
function parseInputNumber(context, key) {
    return parseFloat(context.getInputValue(key));
}
function parseEventInputNumber(event) {
    return parseFloat(event.target.value);
}
function getEventInputValue(event) {
    return event.target.value;
}
function bindUploadEvents(context) {
    bindElement(context, 'uploadArea', 'click', () => {
        context.actions.openImagePicker();
    });
    bindElement(context, 'imageInput', 'change', (event) => {
        var _a;
        const file = (_a = event.target.files) === null || _a === void 0 ? void 0 : _a[0];
        if (file)
            void context.actions.loadImageFile(file);
    });
}
function bindTransformEvents(context) {
    bindElement(context, 'zoomInButton', 'click', () => {
        void context.actions.zoomIn();
    });
    bindElement(context, 'zoomOutButton', 'click', () => {
        void context.actions.zoomOut();
    });
    bindElement(context, 'resetImageTransformButton', 'click', () => {
        void context.actions.resetImageTransform();
    });
    bindElement(context, 'flipHorizontalButton', 'click', () => {
        void context.actions.flipHorizontal();
    });
    bindElement(context, 'flipVerticalButton', 'click', () => {
        void context.actions.flipVertical();
    });
    bindElement(context, 'rotateLeftButton', 'click', () => {
        const parsedStep = parseInputNumber(context, 'rotateLeftDegreesInput');
        const step = Number.isNaN(parsedStep) ? context.rotationStep : parsedStep;
        void context.actions.rotateLeft(step);
    });
    bindElement(context, 'rotateRightButton', 'click', () => {
        const parsedStep = parseInputNumber(context, 'rotateRightDegreesInput');
        const step = Number.isNaN(parsedStep) ? context.rotationStep : parsedStep;
        void context.actions.rotateRight(step);
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
        void context.actions.mergeMasks();
    });
}
function bindAnnotationEvents(context) {
    bindElement(context, 'mergeAnnotationsButton', 'click', () => {
        void context.actions.mergeAnnotations();
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
}
function bindHistoryEvents(context) {
    bindElement(context, 'downloadImageButton', 'click', () => {
        void context.actions.downloadImage();
    });
    bindElement(context, 'undoButton', 'click', () => {
        void context.actions.undo();
    });
    bindElement(context, 'redoButton', 'click', () => {
        void context.actions.redo();
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
    const handler = (event) => {
        applyValue(getEventInputValue(event));
    };
    bindElement(context, key, 'input', handler);
    bindElement(context, key, 'change', handler);
}
function bindNumberInput(context, key, applyValue) {
    const handler = (event) => {
        applyValue(parseEventInputNumber(event));
    };
    bindElement(context, key, 'input', handler);
    bindElement(context, key, 'change', handler);
}
export function bindEditorDomEvents(context) {
    bindUploadEvents(context);
    bindTransformEvents(context);
    bindMaskEvents(context);
    bindAnnotationEvents(context);
    bindHistoryEvents(context);
    bindCropEvents(context);
    bindMosaicEvents(context);
}
//# sourceMappingURL=editor-dom-events.js.map