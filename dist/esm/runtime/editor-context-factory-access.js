import { cloneResolvedMosaicConfig } from '../core/default-options.js';
import { resolveDomElement } from '../core/editor-elements.js';
import { setPlaceholderVisible as setPlaceholderVisibleImpl } from '../ui/visibility-state.js';
import { EditorContextFactory } from './editor-contexts.js';
export function createEditorContextFactory(runtime, callbacks) {
    return new EditorContextFactory({
        getFabric: () => runtime.fabricModule,
        getOptions: () => runtime.options,
        getRuntimeOptions: () => runtime.getRuntimeOptions(),
        getHistoryManager: () => runtime.historyManager,
        getOperationGuard: () => runtime.operationGuard,
        getCanvas: () => runtime.canvas,
        getLiveCanvas: (operationName) => runtime.getLiveCanvasOrThrow(operationName),
        getContainerElement: () => runtime.containerElement,
        getPlaceholderElement: () => runtime.placeholderElement,
        getViewportCache: () => runtime.viewportCache,
        isDisposed: () => runtime.isDisposed,
        isImageLoaded: () => runtime.isImageLoaded(),
        getOriginalImage: () => runtime.originalImage,
        setOriginalImage: (image) => {
            runtime.originalImage = image;
        },
        getIsImageLoadedToCanvas: () => runtime.isImageLoadedToCanvas,
        setIsImageLoadedToCanvas: (value) => {
            runtime.isImageLoadedToCanvas = value;
        },
        getCurrentImageMimeType: () => runtime.currentImageMimeType,
        setCurrentImageMimeType: (mimeType) => {
            runtime.currentImageMimeType = mimeType;
        },
        getLastSnapshot: () => runtime.lastSnapshot,
        setLastSnapshot: (snapshot) => {
            runtime.lastSnapshot = snapshot;
        },
        getCurrentScale: () => runtime.currentScale,
        setCurrentScale: (scale) => {
            runtime.currentScale = scale;
        },
        getCurrentRotation: () => runtime.currentRotation,
        setCurrentRotation: (rotation) => {
            runtime.currentRotation = rotation;
        },
        getBaseImageScale: () => runtime.baseImageScale,
        setBaseImageScale: (scale) => {
            runtime.baseImageScale = scale;
        },
        getMaskCounter: () => runtime.maskCounter,
        setMaskCounter: (value) => {
            runtime.maskCounter = value;
        },
        getLastMask: () => runtime.lastMask,
        setLastMask: (mask) => {
            runtime.lastMask = mask;
        },
        getAnnotationCounter: () => runtime.annotationCounter,
        setAnnotationCounter: (value) => {
            runtime.annotationCounter = value;
        },
        getTextConfig: () => runtime.currentTextConfig,
        getDrawConfig: () => runtime.currentDrawConfig,
        getMosaicConfig: () => cloneResolvedMosaicConfig(runtime.currentMosaicConfig),
        getTextSession: () => runtime.textSession,
        setTextSession: (session) => {
            runtime.textSession = session;
        },
        getDrawSession: () => runtime.drawSession,
        setDrawSession: (session) => {
            runtime.drawSession = session;
        },
        getMosaicSession: () => runtime.mosaicSession,
        setMosaicSession: (session) => {
            runtime.mosaicSession = session;
        },
        getCropSession: () => runtime.cropSession,
        setCropSession: (session) => {
            runtime.cropSession = session;
        },
        saveCanvasState: () => callbacks.saveCanvasState(),
        saveCanvasStateWithAnimationBypass: () => callbacks.saveCanvasStateWithAnimationBypass(),
        setSuppressSaveState: (suppress) => {
            runtime.shouldSuppressSaveState = suppress;
        },
        withSelectionChangeSuppressed: async (callback) => {
            const previous = runtime.shouldSuppressSelectionChange;
            runtime.shouldSuppressSelectionChange = true;
            try {
                return await callback();
            }
            finally {
                runtime.shouldSuppressSelectionChange = previous;
            }
        },
        captureSnapshot: () => callbacks.captureSnapshot(),
        loadImageForOperation: (operationToken, base64, providedOptions) => callbacks.loadImageForOperation(operationToken, base64, providedOptions),
        loadMergedImage: (operationToken, base64, providedOptions) => callbacks.loadMergedImage(operationToken, base64, providedOptions),
        loadFromStateForOperation: (operationToken, snapshot) => callbacks.loadFromStateForOperation(operationToken, snapshot),
        setCanvasSize: (widthPx, heightPx) => {
            callbacks.setCanvasSize(widthPx, heightPx);
        },
        updateCanvasSizeToImageBounds: () => callbacks.updateCanvasSizeToImageBounds(),
        alignObjectBoundingBoxToCanvasTopLeft: (object) => {
            callbacks.alignObjectBoundingBoxToCanvasTopLeft(object);
        },
        syncMaskLabel: (mask) => {
            callbacks.syncMaskLabel(mask);
        },
        removeLabelForMask: (mask) => {
            callbacks.removeLabelForMask(mask);
        },
        hideAllMaskLabels: () => {
            callbacks.hideAllMaskLabels();
        },
        setPlaceholderVisible: (show) => {
            setPlaceholderVisibleImpl(runtime.placeholderElement, runtime.containerElement, runtime.options.showPlaceholder ? show : false);
        },
        updateMaskList: () => callbacks.updateMaskList(),
        updateAnnotationList: () => callbacks.updateAnnotationList(),
        updateUi: () => callbacks.updateUi(),
        updateInputs: () => callbacks.updateInputs(),
        getMaskListElement: () => {
            var _a;
            return resolveDomElement(runtime.elements.maskList, (_a = runtime.canvasElement) === null || _a === void 0 ? void 0 : _a.ownerDocument);
        },
        handleMaskSelected: (mask) => callbacks.handleSelectionChanged([mask]),
        getAnnotationListElement: () => {
            var _a;
            return resolveDomElement(runtime.elements.annotationList, (_a = runtime.canvasElement) === null || _a === void 0 ? void 0 : _a.ownerDocument);
        },
        handleAnnotationSelected: (annotation) => callbacks.handleSelectionChanged([annotation]),
        getMasks: () => callbacks.getMasks(),
        getAnnotations: () => callbacks.getAnnotations(),
        emitImageChanged: (context) => {
            callbacks.emitImageChanged(context);
        },
        emitAnnotationsChanged: (context) => {
            callbacks.emitAnnotationsChanged(context);
        },
        emitBusyChangeIfChanged: (context) => {
            callbacks.emitBusyChangeIfChanged(context);
        },
        buildCallbackContext: (operation, isInternalOperation) => callbacks.buildCallbackContext(operation, isInternalOperation),
    });
}
//# sourceMappingURL=editor-context-factory-access.js.map