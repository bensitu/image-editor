import { EditorActionAccessFactory } from './editor-action-access.js';
import { createEditorContextFactory } from './editor-context-factory-access.js';
export function createEditorRuntimeWiring(runtime, hooks) {
    const contextFactory = createContextFactory(runtime, hooks);
    return {
        contextFactory,
        actionAccessFactory: new EditorActionAccessFactory(runtime, createActionCallbacks(hooks), contextFactory),
    };
}
function createContextFactory(runtime, hooks) {
    return createEditorContextFactory(runtime, {
        saveCanvasState: () => {
            hooks.state.saveCanvasState();
        },
        saveCanvasStateWithAnimationBypass: () => {
            hooks.state.saveCanvasState(hooks.operations.withAnimationQueueBypass());
        },
        captureSnapshot: () => hooks.state.captureSnapshot(),
        loadImageForOperation: (operationToken, base64, providedOptions) => hooks.state.loadImage(base64, hooks.operations.withInternalOperationOptions(operationToken, providedOptions !== null && providedOptions !== void 0 ? providedOptions : {})),
        loadMergedImage: async (operationToken, base64, providedOptions) => {
            const geometry = hooks.display.captureImageDisplayGeometry();
            try {
                await hooks.state.loadImage(base64, hooks.operations.withInternalOperationOptions(operationToken, providedOptions !== null && providedOptions !== void 0 ? providedOptions : {}));
            }
            finally {
                hooks.display.restoreMergedImageDisplayGeometry(geometry);
            }
        },
        loadFromStateForOperation: (operationToken, snapshot) => hooks.state.loadFromState(snapshot, hooks.operations.withInternalOperationOptions(operationToken, hooks.operations.withAnimationQueueBypass())),
        setCanvasSize: (widthPx, heightPx) => {
            hooks.display.setCanvasSize(widthPx, heightPx);
        },
        updateCanvasSizeToImageBounds: () => hooks.display.updateCanvasSizeToImageBounds(),
        alignObjectBoundingBoxToCanvasTopLeft: (object) => {
            hooks.display.alignObjectBoundingBoxToCanvasTopLeft(object);
        },
        syncMaskLabel: (mask) => {
            hooks.labels.syncMaskLabel(mask);
        },
        removeLabelForMask: (mask) => {
            hooks.labels.removeLabelForMask(mask);
        },
        hideAllMaskLabels: () => {
            hooks.labels.hideAllMaskLabels();
        },
        updateMaskList: () => {
            hooks.ui.updateMaskList();
        },
        updateAnnotationList: () => {
            hooks.ui.updateAnnotationList();
        },
        updateUi: () => {
            hooks.ui.updateUi();
        },
        updateInputs: () => {
            hooks.ui.updateInputs();
        },
        handleSelectionChanged: (selected) => {
            hooks.selection.handleSelectionChanged(selected);
        },
        getMasks: () => hooks.selection.getMasks(),
        getAnnotations: () => hooks.selection.getAnnotations(),
        emitImageChanged: (context) => {
            hooks.callbacks.emitImageChanged(context);
        },
        emitAnnotationsChanged: (context) => {
            hooks.callbacks.emitAnnotationsChanged(context);
        },
        emitBusyChangeIfChanged: (context) => {
            hooks.callbacks.emitBusyChangeIfChanged(context);
        },
        reportWarning: (error, message) => {
            hooks.callbacks.reportWarning(error, message);
        },
        buildCallbackContext: (operation, isInternalOperation) => hooks.callbacks.buildCallbackContext(operation, isInternalOperation !== null && isInternalOperation !== void 0 ? isInternalOperation : false),
    });
}
function createActionCallbacks(hooks) {
    return {
        canRunIdleOperation: (operation, options) => hooks.operations.canRunIdleOperation(operation, options),
        assertIdleForOperation: (operation, options) => {
            hooks.operations.assertIdleForOperation(operation, options);
        },
        assertCanQueueAnimation: (operation) => {
            hooks.operations.assertCanQueueAnimation(operation);
        },
        finalizeActiveTextEditingIfNeeded: () => {
            hooks.operations.finalizeActiveTextEditingIfNeeded();
        },
        buildCallbackContext: (operation, isInternalOperation) => hooks.callbacks.buildCallbackContext(operation, isInternalOperation),
        withSelectionChangeContext: (context, callback) => hooks.operations.withSelectionChangeContext(context, callback),
        buildSelection: (selected) => hooks.selection.buildSelection(selected),
        getMasks: () => hooks.selection.getMasks(),
        getAnnotations: () => hooks.selection.getAnnotations(),
        getMaskCollectionSignature: () => hooks.selection.getMaskCollectionSignature(),
        getAnnotationCollectionSignature: () => hooks.selection.getAnnotationCollectionSignature(),
        inferCurrentImageMimeType: () => hooks.display.inferCurrentImageMimeType(),
        shouldNormalizeCanvasSizeAfterStateRestore: () => hooks.display.shouldNormalizeCanvasSizeAfterStateRestore(),
        updateCanvasSizeToImageBounds: (options) => {
            hooks.display.updateCanvasSizeToImageBounds(options);
        },
        alignObjectBoundingBoxToCanvasTopLeft: (object) => {
            hooks.display.alignObjectBoundingBoxToCanvasTopLeft(object);
        },
        settleFitCoverScrollbarsAfterStateRestore: () => {
            hooks.display.settleFitCoverScrollbarsAfterStateRestore();
        },
        setCanvasSize: (widthPx, heightPx) => {
            hooks.display.setCanvasSize(widthPx, heightPx);
        },
        refreshUiAfterQueuedAnimation: () => {
            hooks.ui.refreshUiAfterQueuedAnimation();
        },
        updateInputs: () => {
            hooks.ui.updateInputs();
        },
        updateMaskList: () => {
            hooks.ui.updateMaskList();
        },
        updateMaskListSelection: (mask) => {
            hooks.ui.updateMaskListSelection(mask);
        },
        updateAnnotationList: () => {
            hooks.ui.updateAnnotationList();
        },
        updateAnnotationListSelection: (annotation) => {
            hooks.ui.updateAnnotationListSelection(annotation);
        },
        updateUi: () => {
            hooks.ui.updateUi();
        },
        saveState: () => {
            hooks.state.saveCanvasState();
        },
        removeLabelForMask: (mask) => {
            hooks.labels.removeLabelForMask(mask);
        },
        showLabelForMask: (mask) => {
            hooks.labels.showLabelForMask(mask);
        },
        syncMaskLabel: (mask) => {
            hooks.labels.syncMaskLabel(mask);
        },
        hideAllMaskLabels: () => {
            hooks.labels.hideAllMaskLabels();
        },
        handleSelectionChanged: (selected) => {
            hooks.selection.handleSelectionChanged(selected);
        },
        updateSelectedAnnotation: (config) => {
            hooks.config.updateSelectedAnnotation(config);
        },
        setTextColor: (color) => {
            hooks.config.setTextColor(color);
        },
        setTextFontSize: (size) => {
            hooks.config.setTextFontSize(size);
        },
        setDrawColor: (color) => {
            hooks.config.setDrawColor(color);
        },
        setDrawBrushSize: (size) => {
            hooks.config.setDrawBrushSize(size);
        },
        emitImageCleared: (image, context) => {
            hooks.callbacks.emitImageCleared(image, context);
        },
        emitSelectionChange: (selection, context) => {
            hooks.callbacks.emitSelectionChange(selection, context);
        },
        emitMasksChanged: (context) => {
            hooks.callbacks.emitMasksChanged(context);
        },
        emitAnnotationsChanged: (context) => {
            hooks.callbacks.emitAnnotationsChanged(context);
        },
        emitImageChanged: (context) => {
            hooks.callbacks.emitImageChanged(context);
        },
        emitBusyChangeIfChanged: (context) => {
            hooks.callbacks.emitBusyChangeIfChanged(context);
        },
        reportWarning: (error, message) => {
            hooks.callbacks.reportWarning(error, message);
        },
        withAnimationQueueBypass: () => hooks.operations.withAnimationQueueBypass(),
    };
}
//# sourceMappingURL=editor-facade-wiring.js.map