/**
 * Builds editor context factories from the shared runtime state.
 *
 * The facade wiring module supplies callback groups to this adapter, keeping
 * module-facing context objects explicit while avoiding duplicated state
 * forwarding code in ImageEditor.
 */

import type * as FabricNS from 'fabric';

import {
    cloneResolvedMosaicConfig,
    cloneResolvedEraserConfig,
    cloneResolvedShapeAnnotationConfig,
} from '../core/default-options.js';
import { resolveDomElement } from '../core/editor-elements.js';
import {
    cloneResolvedImageFilterConfig,
    DEFAULT_IMAGE_FILTER_CONFIG,
} from '../core/image-filter-config.js';
import type { OperationToken } from '../core/operation-guard.js';
import type {
    AnnotationObject,
    ImageEditorCallbackContext,
    ImageEditorOperation,
    LoadImageOptions,
    MaskObject,
    ResolvedImageFilterConfig,
} from '../core/public-types.js';
import { applyImageFilterConfigToImage } from '../image/image-filters.js';
import { setPlaceholderVisible as setPlaceholderVisibleImpl } from '../ui/visibility-state.js';
import { EditorContextFactory } from './editor-contexts.js';
import type { EditorRuntime } from './editor-runtime.js';

export interface EditorContextStateCallbacks {
    saveCanvasState(): void;
    saveCanvasStateWithAnimationBypass(): void;
    captureSnapshot(): string;
    loadImageForOperation(
        operationToken: OperationToken | undefined,
        imageBase64: string,
        options?: LoadImageOptions,
    ): Promise<void>;
    loadMergedImage(
        operationToken: OperationToken | undefined,
        imageBase64: string,
        options?: LoadImageOptions,
    ): Promise<void>;
    loadFromStateForOperation(
        operationToken: OperationToken | undefined,
        snapshot: string,
    ): Promise<void>;
}

export interface EditorContextDisplayCallbacks {
    setCanvasSize(widthPx: number, heightPx: number): void;
    updateCanvasSizeToImageBounds(): void;
    alignObjectBoundingBoxToCanvasTopLeft(object: FabricNS.FabricObject): void;
}

export interface EditorContextMaskLabelCallbacks {
    syncMaskLabel(mask: MaskObject): void;
    removeLabelForMask(mask: MaskObject): void;
    hideAllMaskLabels(): void;
}

export interface EditorContextUiCallbacks {
    updateMaskList(): void;
    updateAnnotationList(): void;
    updateUi(): void;
    updateInputs(): void;
}

export interface EditorContextSelectionCallbacks {
    handleSelectionChanged(selected: FabricNS.FabricObject[]): void;
    getMasks(): MaskObject[];
    getAnnotations(): AnnotationObject[];
}

export interface EditorContextCallbackEmitters {
    emitImageChanged(context: ImageEditorCallbackContext): void;
    emitAnnotationsChanged(context: ImageEditorCallbackContext): void;
    emitBusyChangeIfChanged(context: ImageEditorCallbackContext): void;
    reportWarning(error: unknown, message: string): void;
    buildCallbackContext(
        operation: ImageEditorOperation,
        isInternalOperation?: boolean,
    ): ImageEditorCallbackContext;
}

export interface EditorContextFactoryCallbacks
    extends
        EditorContextStateCallbacks,
        EditorContextDisplayCallbacks,
        EditorContextMaskLabelCallbacks,
        EditorContextUiCallbacks,
        EditorContextSelectionCallbacks,
        EditorContextCallbackEmitters {}

export function createEditorContextFactory(
    runtime: EditorRuntime,
    callbacks: EditorContextFactoryCallbacks,
): EditorContextFactory {
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
        getCurrentImageFilterConfig: () =>
            cloneResolvedImageFilterConfig(runtime.currentImageFilterConfig),
        resetImageFilterState: () => {
            const next = cloneResolvedImageFilterConfig(DEFAULT_IMAGE_FILTER_CONFIG);
            runtime.currentImageFilterConfig = next;
            runtime.lastCommittedImageFilterConfig = cloneResolvedImageFilterConfig(next);
            if (runtime.originalImage) {
                applyImageFilterConfigToImage(
                    runtime.fabricModule,
                    runtime.originalImage,
                    next,
                    (error, message) => {
                        callbacks.reportWarning(error, message);
                    },
                );
            }
        },
        restoreImageFilterConfig: (config: ResolvedImageFilterConfig | null) => {
            const next = cloneResolvedImageFilterConfig(config ?? DEFAULT_IMAGE_FILTER_CONFIG);
            runtime.currentImageFilterConfig = next;
            runtime.lastCommittedImageFilterConfig = cloneResolvedImageFilterConfig(next);
            if (runtime.originalImage) {
                applyImageFilterConfigToImage(
                    runtime.fabricModule,
                    runtime.originalImage,
                    next,
                    (error, message) => {
                        callbacks.reportWarning(error, message);
                    },
                );
            }
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
        getEraserConfig: () => cloneResolvedEraserConfig(runtime.currentEraserConfig),
        getShapeConfig: () => cloneResolvedShapeAnnotationConfig(runtime.currentShapeConfig),
        getMosaicConfig: () => cloneResolvedMosaicConfig(runtime.currentMosaicConfig),
        getTextSession: () => runtime.textSession,
        setTextSession: (session) => {
            runtime.textSession = session;
        },
        getDrawSession: () => runtime.drawSession,
        setDrawSession: (session) => {
            runtime.drawSession = session;
        },
        getShapeSession: () => runtime.shapeSession,
        setShapeSession: (session) => {
            runtime.shapeSession = session;
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
            } finally {
                runtime.shouldSuppressSelectionChange = previous;
            }
        },
        captureSnapshot: () => callbacks.captureSnapshot(),
        loadImageForOperation: (operationToken, base64, providedOptions) =>
            callbacks.loadImageForOperation(operationToken, base64, providedOptions),
        loadMergedImage: (operationToken, base64, providedOptions) =>
            callbacks.loadMergedImage(operationToken, base64, providedOptions),
        loadFromStateForOperation: (operationToken, snapshot) =>
            callbacks.loadFromStateForOperation(operationToken, snapshot),
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
            setPlaceholderVisibleImpl(
                runtime.placeholderElement,
                runtime.containerElement,
                runtime.options.showPlaceholder ? show : false,
            );
        },
        updateMaskList: () => callbacks.updateMaskList(),
        updateAnnotationList: () => callbacks.updateAnnotationList(),
        updateUi: () => callbacks.updateUi(),
        updateInputs: () => callbacks.updateInputs(),
        getMaskListElement: () =>
            resolveDomElement<HTMLElement>(
                runtime.elements.maskList,
                runtime.canvasElement?.ownerDocument,
            ),
        handleMaskSelected: (mask) => callbacks.handleSelectionChanged([mask]),
        getAnnotationListElement: () =>
            resolveDomElement<HTMLElement>(
                runtime.elements.annotationList,
                runtime.canvasElement?.ownerDocument,
            ),
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
        buildCallbackContext: (operation, isInternalOperation) =>
            callbacks.buildCallbackContext(operation, isInternalOperation),
    });
}
