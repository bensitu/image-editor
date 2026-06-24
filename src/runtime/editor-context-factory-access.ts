/**
 * Builds editor context factories from the shared runtime state.
 *
 * This adapter keeps module-facing context objects explicit while avoiding
 * duplicated state forwarding code inside the ImageEditor facade.
 */

import type * as FabricNS from 'fabric';

import { cloneResolvedMosaicConfig } from '../core/default-options.js';
import { resolveDomElement } from '../core/editor-elements.js';
import type { OperationToken } from '../core/operation-guard.js';
import type {
    AnnotationObject,
    ImageEditorCallbackContext,
    ImageEditorOperation,
    LoadImageOptions,
    MaskObject,
} from '../core/public-types.js';
import { setPlaceholderVisible as setPlaceholderVisibleImpl } from '../ui/visibility-state.js';
import { EditorContextFactory } from './editor-contexts.js';
import type { EditorRuntime } from './editor-runtime.js';

export interface EditorContextFactoryCallbacks {
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
    setCanvasSize(widthPx: number, heightPx: number): void;
    updateCanvasSizeToImageBounds(): void;
    alignObjectBoundingBoxToCanvasTopLeft(object: FabricNS.FabricObject): void;
    syncMaskLabel(mask: MaskObject): void;
    removeLabelForMask(mask: MaskObject): void;
    hideAllMaskLabels(): void;
    updateMaskList(): void;
    updateAnnotationList(): void;
    updateUi(): void;
    updateInputs(): void;
    handleSelectionChanged(selected: FabricNS.FabricObject[]): void;
    getMasks(): MaskObject[];
    getAnnotations(): AnnotationObject[];
    emitImageChanged(context: ImageEditorCallbackContext): void;
    emitAnnotationsChanged(context: ImageEditorCallbackContext): void;
    emitBusyChangeIfChanged(context: ImageEditorCallbackContext): void;
    buildCallbackContext(
        operation: ImageEditorOperation,
        isInternalOperation?: boolean,
    ): ImageEditorCallbackContext;
}

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
