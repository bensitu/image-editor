export class EditorActionAccessFactory {
    constructor(runtime, callbacks, contextFactory) {
        Object.defineProperty(this, "runtime", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: runtime
        });
        Object.defineProperty(this, "callbacks", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: callbacks
        });
        Object.defineProperty(this, "contextFactory", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: contextFactory
        });
    }
    buildBusyOperationAccess() {
        const { runtime, callbacks } = this;
        return {
            beginBusyOperation: (operation) => runtime.operationGuard.beginBusyOperation(operation),
            endBusyOperation: (token) => {
                runtime.operationGuard.endBusyOperation(token);
            },
            buildCallbackContext: (operation, isInternalOperation) => callbacks.buildCallbackContext(operation, isInternalOperation),
            emitBusyChangeIfChanged: (context) => {
                callbacks.emitBusyChangeIfChanged(context);
            },
            updateUi: () => {
                callbacks.updateUi();
            },
        };
    }
    buildTransformActionAccess() {
        const { runtime, callbacks } = this;
        return {
            isDisposed: () => runtime.isDisposed,
            getTransformController: () => runtime.transformController,
            assertCanQueueAnimation: (operation) => {
                callbacks.assertCanQueueAnimation(operation);
            },
            buildCallbackContext: (operation, isInternalOperation) => callbacks.buildCallbackContext(operation, isInternalOperation),
            enqueueAnimation: (body) => runtime.animQueue.add(body),
            updateInputs: () => {
                callbacks.updateInputs();
            },
            updateUi: () => {
                callbacks.updateUi();
            },
            refreshUiAfterQueuedAnimation: () => {
                callbacks.refreshUiAfterQueuedAnimation();
            },
            emitImageChanged: (context) => {
                callbacks.emitImageChanged(context);
            },
            emitBusyChangeIfChanged: (context) => {
                callbacks.emitBusyChangeIfChanged(context);
            },
        };
    }
    buildEditorStateActionAccess() {
        const { runtime, callbacks } = this;
        return {
            getCanvas: () => runtime.canvas,
            getLiveCanvas: (operationName) => runtime.getLiveCanvasOrThrow(operationName),
            getOptions: () => runtime.options,
            isDisposed: () => runtime.isDisposed,
            canRunIdleOperation: (operation, options) => callbacks.canRunIdleOperation(operation, options),
            getActiveStateRestoreOperation: () => runtime.activeStateRestoreOperation,
            buildCallbackContext: (operation, isInternalOperation) => callbacks.buildCallbackContext(operation, isInternalOperation),
            getOriginalImage: () => runtime.originalImage,
            setOriginalImage: (image) => {
                runtime.originalImage = image;
            },
            getMaskCollectionSignature: () => callbacks.getMaskCollectionSignature(),
            getAnnotationCollectionSignature: () => callbacks.getAnnotationCollectionSignature(),
            setCanvasSize: (widthPx, heightPx) => {
                callbacks.setCanvasSize(widthPx, heightPx);
            },
            hideAllMaskLabels: () => {
                callbacks.hideAllMaskLabels();
            },
            inferCurrentImageMimeType: () => callbacks.inferCurrentImageMimeType(),
            setCurrentImageMimeType: (mimeType) => {
                runtime.currentImageMimeType = mimeType;
            },
            setIsImageLoadedToCanvas: (value) => {
                runtime.isImageLoadedToCanvas = value;
            },
            setMaskCounter: (value) => {
                runtime.maskCounter = value;
            },
            setAnnotationCounter: (value) => {
                runtime.annotationCounter = value;
            },
            setCurrentScale: (value) => {
                runtime.currentScale = value;
            },
            setCurrentRotation: (value) => {
                runtime.currentRotation = value;
            },
            setBaseImageScale: (value) => {
                runtime.baseImageScale = value;
            },
            setLastMask: (mask) => {
                runtime.lastMask = mask;
            },
            getLastSnapshot: () => runtime.lastSnapshot,
            setLastSnapshot: (snapshot) => {
                runtime.lastSnapshot = snapshot;
            },
            shouldNormalizeCanvasSizeAfterStateRestore: () => callbacks.shouldNormalizeCanvasSizeAfterStateRestore(),
            updateCanvasSizeToImageBounds: (options) => {
                callbacks.updateCanvasSizeToImageBounds(options);
            },
            alignObjectBoundingBoxToCanvasTopLeft: (object) => {
                callbacks.alignObjectBoundingBoxToCanvasTopLeft(object);
            },
            settleFitCoverScrollbarsAfterStateRestore: () => {
                callbacks.settleFitCoverScrollbarsAfterStateRestore();
            },
            buildTextControllerContext: () => this.contextFactory.buildTextControllerContext(),
            updateInputs: () => {
                callbacks.updateInputs();
            },
            updateMaskList: () => {
                callbacks.updateMaskList();
            },
            updateAnnotationList: () => {
                callbacks.updateAnnotationList();
            },
            updateUi: () => {
                callbacks.updateUi();
            },
            emitImageCleared: (image, context) => {
                callbacks.emitImageCleared(image, context);
            },
            emitMasksChanged: (context) => {
                callbacks.emitMasksChanged(context);
            },
            emitAnnotationsChanged: (context) => {
                callbacks.emitAnnotationsChanged(context);
            },
            emitImageChanged: (context) => {
                callbacks.emitImageChanged(context);
            },
            withSelectionChangeContext: (context, callback) => callbacks.withSelectionChangeContext(context, callback),
            handleSelectionChanged: (selected) => {
                callbacks.handleSelectionChanged(selected);
            },
            shouldSuppressSaveState: () => runtime.shouldSuppressSaveState,
            getCurrentScale: () => runtime.currentScale,
            getCurrentRotation: () => runtime.currentRotation,
            getBaseImageScale: () => runtime.baseImageScale,
            getCurrentImageMimeType: () => runtime.currentImageMimeType,
            getHistoryManager: () => runtime.historyManager,
            withAnimationQueueBypass: () => callbacks.withAnimationQueueBypass(),
            showLabelForMask: (mask) => {
                callbacks.showLabelForMask(mask);
            },
            updateMaskListSelection: (mask) => {
                callbacks.updateMaskListSelection(mask);
            },
            updateAnnotationListSelection: (annotation) => {
                callbacks.updateAnnotationListSelection(annotation);
            },
        };
    }
    buildMaskActionAccess() {
        const { runtime, callbacks } = this;
        return {
            getCanvas: () => runtime.canvas,
            getMasks: () => callbacks.getMasks(),
            canRunIdleOperation: (operation, options) => callbacks.canRunIdleOperation(operation, options),
            buildCallbackContext: (operation, isInternalOperation) => callbacks.buildCallbackContext(operation, isInternalOperation),
            buildCreateMaskContext: () => this.contextFactory.buildCreateMaskContext(),
            buildRemoveMaskContext: () => this.contextFactory.buildRemoveMaskContext(),
            withSelectionChangeContext: (context, callback) => callbacks.withSelectionChangeContext(context, callback),
            updateUi: () => {
                callbacks.updateUi();
            },
            emitMasksChanged: (context) => {
                callbacks.emitMasksChanged(context);
            },
            emitImageChanged: (context) => {
                callbacks.emitImageChanged(context);
            },
        };
    }
    buildSelectionControllerAccess() {
        const { runtime, callbacks } = this;
        return {
            getCanvas: () => runtime.canvas,
            removeLabelForMask: (mask) => {
                callbacks.removeLabelForMask(mask);
            },
            showLabelForMask: (mask) => {
                callbacks.showLabelForMask(mask);
            },
            syncMaskLabel: (mask) => {
                callbacks.syncMaskLabel(mask);
            },
            updateMaskListSelection: (mask) => {
                callbacks.updateMaskListSelection(mask);
            },
            updateAnnotationListSelection: (annotation) => {
                callbacks.updateAnnotationListSelection(annotation);
            },
            updateUi: () => {
                callbacks.updateUi();
            },
            saveState: () => {
                callbacks.saveState();
            },
            getNextSelectionChangeContext: () => runtime.nextSelectionChangeContext,
            getActiveStateRestoreOperation: () => runtime.activeStateRestoreOperation,
            buildSelection: (selected) => callbacks.buildSelection(selected),
            buildCallbackContext: (operation, isHistoryRestore) => callbacks.buildCallbackContext(operation, isHistoryRestore),
            emitSelectionChange: (selection, context) => {
                callbacks.emitSelectionChange(selection, context);
            },
            emitMasksChanged: (context) => {
                callbacks.emitMasksChanged(context);
            },
            emitAnnotationsChanged: (context) => {
                callbacks.emitAnnotationsChanged(context);
            },
            emitImageChanged: (context) => {
                callbacks.emitImageChanged(context);
            },
        };
    }
    buildAnnotationModeActionAccess() {
        const { runtime, callbacks } = this;
        return {
            getCanvas: () => runtime.canvas,
            getTextSession: () => runtime.textSession,
            getDrawSession: () => runtime.drawSession,
            isToolModeActive: () => runtime.cropSession !== null ||
                runtime.mosaicSession !== null ||
                runtime.textSession !== null ||
                runtime.drawSession !== null,
            canRunIdleOperation: (operation) => callbacks.canRunIdleOperation(operation),
            buildTextControllerContext: () => this.contextFactory.buildTextControllerContext(),
            buildDrawControllerContext: () => this.contextFactory.buildDrawControllerContext(),
            buildCallbackContext: (operation, isInternalOperation) => callbacks.buildCallbackContext(operation, isInternalOperation),
            emitBusyChangeIfChanged: (context) => {
                callbacks.emitBusyChangeIfChanged(context);
            },
            emitImageChanged: (context) => {
                callbacks.emitImageChanged(context);
            },
        };
    }
    buildEditableObjectActionAccess() {
        const { runtime, callbacks } = this;
        return {
            getCanvas: () => runtime.canvas,
            getLiveCanvas: (operationName) => runtime.getLiveCanvasOrThrow(operationName),
            buildAnnotationManagerContext: () => this.contextFactory.buildAnnotationManagerContext(),
            getMasks: () => callbacks.getMasks(),
            getAnnotations: () => callbacks.getAnnotations(),
            removeLabelForMask: (mask) => {
                callbacks.removeLabelForMask(mask);
            },
            withSelectionChangeContext: (context, callback) => callbacks.withSelectionChangeContext(context, callback),
            buildCallbackContext: (operation, isInternalOperation) => callbacks.buildCallbackContext(operation, isInternalOperation),
            saveState: () => {
                callbacks.saveState();
            },
            updateMaskList: () => {
                callbacks.updateMaskList();
            },
            updateMaskListSelection: (mask) => {
                callbacks.updateMaskListSelection(mask);
            },
            updateAnnotationList: () => {
                callbacks.updateAnnotationList();
            },
            updateAnnotationListSelection: (annotation) => {
                callbacks.updateAnnotationListSelection(annotation);
            },
            updateUi: () => {
                callbacks.updateUi();
            },
            emitMasksChanged: (context) => {
                callbacks.emitMasksChanged(context);
            },
            emitAnnotationsChanged: (context) => {
                callbacks.emitAnnotationsChanged(context);
            },
            emitImageChanged: (context) => {
                callbacks.emitImageChanged(context);
            },
            reportWarning: (message) => {
                callbacks.reportWarning(null, message);
            },
        };
    }
    buildAnnotationConfigActionAccess() {
        const { runtime, callbacks } = this;
        return {
            getCanvas: () => runtime.canvas,
            isTextMode: () => runtime.textSession !== null,
            isDrawMode: () => runtime.drawSession !== null,
            getCurrentTextConfig: () => runtime.currentTextConfig,
            setCurrentTextConfig: (config) => {
                runtime.currentTextConfig = config;
            },
            getDefaultTextConfig: () => runtime.defaultTextConfig,
            getCurrentDrawConfig: () => runtime.currentDrawConfig,
            setCurrentDrawConfig: (config) => {
                runtime.currentDrawConfig = config;
            },
            getDefaultDrawConfig: () => runtime.defaultDrawConfig,
            canRunIdleOperation: (operation) => callbacks.canRunIdleOperation(operation),
            buildDrawControllerContext: () => this.contextFactory.buildDrawControllerContext(),
            buildCallbackContext: (operation, isInternalOperation) => callbacks.buildCallbackContext(operation, isInternalOperation),
            updateSelectedAnnotation: (config) => {
                callbacks.updateSelectedAnnotation(config);
            },
            setTextColor: (color) => {
                callbacks.setTextColor(color);
            },
            setTextFontSize: (size) => {
                callbacks.setTextFontSize(size);
            },
            setDrawColor: (color) => {
                callbacks.setDrawColor(color);
            },
            setDrawBrushSize: (size) => {
                callbacks.setDrawBrushSize(size);
            },
            reportWarning: (error, message) => {
                callbacks.reportWarning(error, message);
            },
            updateInputs: () => {
                callbacks.updateInputs();
            },
            updateUi: () => {
                callbacks.updateUi();
            },
            emitImageChanged: (context) => {
                callbacks.emitImageChanged(context);
            },
        };
    }
    buildExportActionAccess() {
        const { runtime, callbacks } = this;
        return {
            getCanvas: () => runtime.canvas,
            getAnnotations: () => callbacks.getAnnotations(),
            getMasks: () => callbacks.getMasks(),
            canRunIdleOperation: (operation, options) => callbacks.canRunIdleOperation(operation, options),
            assertIdleForOperation: (operation, options) => {
                callbacks.assertIdleForOperation(operation, options);
            },
            finalizeActiveTextEditingIfNeeded: () => {
                callbacks.finalizeActiveTextEditingIfNeeded();
            },
            buildExportServiceContext: () => this.contextFactory.buildExportServiceContext(),
            buildMergeMasksContext: (token) => this.contextFactory.buildMergeMasksContext(token),
            buildMergeAnnotationsContext: (token) => this.contextFactory.buildMergeAnnotationsContext(token),
            buildBusyOperationAccess: () => this.buildBusyOperationAccess(),
            updateInputs: () => {
                callbacks.updateInputs();
            },
            updateMaskList: () => {
                callbacks.updateMaskList();
            },
            updateAnnotationList: () => {
                callbacks.updateAnnotationList();
            },
            emitMasksChanged: (context) => {
                callbacks.emitMasksChanged(context);
            },
            emitAnnotationsChanged: (context) => {
                callbacks.emitAnnotationsChanged(context);
            },
            emitImageChanged: (context) => {
                callbacks.emitImageChanged(context);
            },
        };
    }
    buildMosaicActionAccess() {
        const { runtime, callbacks } = this;
        return {
            getCanvas: () => runtime.canvas,
            getOriginalImage: () => runtime.originalImage,
            getMosaicSession: () => runtime.mosaicSession,
            getMosaicConfig: () => runtime.currentMosaicConfig,
            setMosaicConfig: (config) => {
                runtime.currentMosaicConfig = config;
            },
            getDefaultMosaicConfig: () => runtime.defaultMosaicConfig,
            getOptions: () => runtime.options,
            isDisposed: () => runtime.isDisposed,
            isImageLoaded: () => runtime.isImageLoaded(),
            canRunIdleOperation: (operation) => callbacks.canRunIdleOperation(operation),
            buildMosaicControllerContext: () => this.contextFactory.buildMosaicControllerContext(),
            buildCallbackContext: (operation, isInternalOperation) => callbacks.buildCallbackContext(operation, isInternalOperation),
            updateInputs: () => {
                callbacks.updateInputs();
            },
            updateUi: () => {
                callbacks.updateUi();
            },
            emitImageChanged: (context) => {
                callbacks.emitImageChanged(context);
            },
            emitBusyChangeIfChanged: (context) => {
                callbacks.emitBusyChangeIfChanged(context);
            },
        };
    }
    buildCropActionAccess() {
        const { runtime, callbacks } = this;
        return {
            getCanvas: () => runtime.canvas,
            getOriginalImage: () => runtime.originalImage,
            getCropSession: () => runtime.cropSession,
            setCropSession: (session) => {
                runtime.cropSession = session;
            },
            isImageLoaded: () => runtime.isImageLoaded(),
            canRunIdleOperation: (operation) => callbacks.canRunIdleOperation(operation),
            buildCropControllerContext: (token) => this.contextFactory.buildCropControllerContext(token),
            buildBusyOperationAccess: () => this.buildBusyOperationAccess(),
            buildCallbackContext: (operation, isInternalOperation) => callbacks.buildCallbackContext(operation, isInternalOperation),
            getMasks: () => callbacks.getMasks(),
            updateInputs: () => {
                callbacks.updateInputs();
            },
            updateMaskList: () => {
                callbacks.updateMaskList();
            },
            updateUi: () => {
                callbacks.updateUi();
            },
            emitMasksChanged: (context) => {
                callbacks.emitMasksChanged(context);
            },
            emitImageChanged: (context) => {
                callbacks.emitImageChanged(context);
            },
            emitBusyChangeIfChanged: (context) => {
                callbacks.emitBusyChangeIfChanged(context);
            },
        };
    }
}
//# sourceMappingURL=editor-action-access.js.map