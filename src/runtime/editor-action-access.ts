/**
 * Builds action access objects from the shared runtime state.
 *
 * Public ImageEditor methods use these adapters to call focused action modules
 * without exposing the runtime object as each module's direct dependency.
 */

import type * as FabricNS from 'fabric';

import type { AnnotationConfigActionAccess } from '../annotation/annotation-config-actions.js';
import type { AnnotationModeActionAccess } from '../annotation/annotation-mode-actions.js';
import type { AnnotationObject, ImageEditorSelection } from '../core/public-types.js';
import type {
    ImageEditorCallbackContext,
    ImageEditorOperation,
    MaskObject,
} from '../core/public-types.js';
import type { CropActionAccess } from '../crop/crop-actions.js';
import type { ExportActionAccess } from '../export/export-actions.js';
import type { EditorStateActionAccess } from '../history/editor-state-actions.js';
import type { TransformActionAccess } from '../image/transform-actions.js';
import type { MaskActionAccess } from '../mask/mask-actions.js';
import type { MosaicActionAccess } from '../mosaic/mosaic-actions.js';
import type { EditableObjectActionAccess } from '../overlay/editable-object-actions.js';
import type { EditorSelectionControllerAccess } from '../selection/editor-selection-controller.js';
import type { BusyOperationAccess } from './editor-operation-runner.js';
import type { EditorContextFactory } from './editor-contexts.js';
import type { EditorRuntime } from './editor-runtime.js';

export interface EditorActionCallbacks {
    canRunIdleOperation(operation: ImageEditorOperation, options?: object | null): boolean;
    assertIdleForOperation(operation: ImageEditorOperation, options?: object | null): void;
    assertCanQueueAnimation(operation: ImageEditorOperation): void;
    finalizeActiveTextEditingIfNeeded(): void;
    buildCallbackContext(
        operation: ImageEditorOperation,
        isInternalOperation: boolean,
    ): ImageEditorCallbackContext;
    withSelectionChangeContext<T>(context: ImageEditorCallbackContext, callback: () => T): T;
    buildSelection(selected: FabricNS.FabricObject[]): ImageEditorSelection;
    getMasks(): MaskObject[];
    getAnnotations(): AnnotationObject[];
    getMaskCollectionSignature(): string;
    getAnnotationCollectionSignature(): string;
    inferCurrentImageMimeType(): ReturnType<EditorStateActionAccess['getCurrentImageMimeType']>;
    shouldNormalizeCanvasSizeAfterStateRestore(): boolean;
    updateCanvasSizeToImageBounds(options: { stabilizeContainedViewport?: boolean }): void;
    alignObjectBoundingBoxToCanvasTopLeft(object: FabricNS.FabricObject): void;
    settleFitCoverScrollbarsAfterStateRestore(): void;
    setCanvasSize(widthPx: number, heightPx: number): void;
    refreshUiAfterQueuedAnimation(): void;
    updateInputs(): void;
    updateMaskList(): void;
    updateMaskListSelection(mask: MaskObject | null): void;
    updateAnnotationList(): void;
    updateAnnotationListSelection(annotation: AnnotationObject | null): void;
    updateUi(): void;
    saveState(): void;
    removeLabelForMask(mask: MaskObject): void;
    showLabelForMask(mask: MaskObject): void;
    syncMaskLabel(mask: MaskObject): void;
    hideAllMaskLabels(): void;
    handleSelectionChanged(selected: FabricNS.FabricObject[]): void;
    updateSelectedAnnotation(config: object): void;
    setTextColor(color: string): void;
    setTextFontSize(size: number): void;
    setDrawColor(color: string): void;
    setDrawBrushSize(size: number): void;
    emitImageCleared(
        image: NonNullable<EditorRuntime['originalImage']>,
        context: ImageEditorCallbackContext,
    ): void;
    emitSelectionChange(selection: ImageEditorSelection, context: ImageEditorCallbackContext): void;
    emitMasksChanged(context: ImageEditorCallbackContext): void;
    emitAnnotationsChanged(context: ImageEditorCallbackContext): void;
    emitImageChanged(context: ImageEditorCallbackContext): void;
    emitBusyChangeIfChanged(context: ImageEditorCallbackContext): void;
    reportWarning(error: unknown, message: string): void;
    withAnimationQueueBypass(): object;
}

export class EditorActionAccessFactory {
    constructor(
        private readonly runtime: EditorRuntime,
        private readonly callbacks: EditorActionCallbacks,
        private readonly contextFactory: EditorContextFactory,
    ) {}

    buildBusyOperationAccess(): BusyOperationAccess {
        const { runtime, callbacks } = this;
        return {
            beginBusyOperation: (operation) => runtime.operationGuard.beginBusyOperation(operation),
            endBusyOperation: (token) => {
                runtime.operationGuard.endBusyOperation(token);
            },
            buildCallbackContext: (operation, isInternalOperation) =>
                callbacks.buildCallbackContext(operation, isInternalOperation),
            emitBusyChangeIfChanged: (context) => {
                callbacks.emitBusyChangeIfChanged(context);
            },
            updateUi: () => {
                callbacks.updateUi();
            },
        };
    }

    buildTransformActionAccess(): TransformActionAccess {
        const { runtime, callbacks } = this;
        return {
            isDisposed: () => runtime.isDisposed,
            getTransformController: () => runtime.transformController,
            assertCanQueueAnimation: (operation) => {
                callbacks.assertCanQueueAnimation(operation);
            },
            buildCallbackContext: (operation, isInternalOperation) =>
                callbacks.buildCallbackContext(operation, isInternalOperation),
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

    buildEditorStateActionAccess(): EditorStateActionAccess {
        const { runtime, callbacks } = this;
        return {
            getCanvas: () => runtime.canvas,
            getLiveCanvas: (operationName) => runtime.getLiveCanvasOrThrow(operationName),
            getOptions: () => runtime.options,
            isDisposed: () => runtime.isDisposed,
            canRunIdleOperation: (operation, options) =>
                callbacks.canRunIdleOperation(operation, options),
            getActiveStateRestoreOperation: () => runtime.activeStateRestoreOperation,
            buildCallbackContext: (operation, isInternalOperation) =>
                callbacks.buildCallbackContext(operation, isInternalOperation),
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
            shouldNormalizeCanvasSizeAfterStateRestore: () =>
                callbacks.shouldNormalizeCanvasSizeAfterStateRestore(),
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
            withSelectionChangeContext: (context, callback) =>
                callbacks.withSelectionChangeContext(context, callback),
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

    buildMaskActionAccess(): MaskActionAccess {
        const { runtime, callbacks } = this;
        return {
            getCanvas: () => runtime.canvas,
            getMasks: () => callbacks.getMasks(),
            canRunIdleOperation: (operation, options) =>
                callbacks.canRunIdleOperation(operation, options),
            buildCallbackContext: (operation, isInternalOperation) =>
                callbacks.buildCallbackContext(operation, isInternalOperation),
            buildCreateMaskContext: () => this.contextFactory.buildCreateMaskContext(),
            buildRemoveMaskContext: () => this.contextFactory.buildRemoveMaskContext(),
            withSelectionChangeContext: (context, callback) =>
                callbacks.withSelectionChangeContext(context, callback),
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

    buildSelectionControllerAccess(): EditorSelectionControllerAccess {
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
            buildCallbackContext: (operation, isHistoryRestore) =>
                callbacks.buildCallbackContext(operation, isHistoryRestore),
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

    buildAnnotationModeActionAccess(): AnnotationModeActionAccess {
        const { runtime, callbacks } = this;
        return {
            getCanvas: () => runtime.canvas,
            getTextSession: () => runtime.textSession,
            getDrawSession: () => runtime.drawSession,
            isToolModeActive: () =>
                runtime.cropSession !== null ||
                runtime.mosaicSession !== null ||
                runtime.textSession !== null ||
                runtime.drawSession !== null,
            canRunIdleOperation: (operation) => callbacks.canRunIdleOperation(operation),
            buildTextControllerContext: () => this.contextFactory.buildTextControllerContext(),
            buildDrawControllerContext: () => this.contextFactory.buildDrawControllerContext(),
            buildCallbackContext: (operation, isInternalOperation) =>
                callbacks.buildCallbackContext(operation, isInternalOperation),
            emitBusyChangeIfChanged: (context) => {
                callbacks.emitBusyChangeIfChanged(context);
            },
            emitImageChanged: (context) => {
                callbacks.emitImageChanged(context);
            },
        };
    }

    buildEditableObjectActionAccess(): EditableObjectActionAccess {
        const { runtime, callbacks } = this;
        return {
            getCanvas: () => runtime.canvas,
            getLiveCanvas: (operationName) => runtime.getLiveCanvasOrThrow(operationName),
            buildAnnotationManagerContext: () =>
                this.contextFactory.buildAnnotationManagerContext(),
            getMasks: () => callbacks.getMasks(),
            getAnnotations: () => callbacks.getAnnotations(),
            removeLabelForMask: (mask) => {
                callbacks.removeLabelForMask(mask);
            },
            withSelectionChangeContext: (context, callback) =>
                callbacks.withSelectionChangeContext(context, callback),
            buildCallbackContext: (operation, isInternalOperation) =>
                callbacks.buildCallbackContext(operation, isInternalOperation),
            saveState: () => {
                callbacks.saveState();
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

    buildAnnotationConfigActionAccess(): AnnotationConfigActionAccess {
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
            buildCallbackContext: (operation, isInternalOperation) =>
                callbacks.buildCallbackContext(operation, isInternalOperation),
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

    buildExportActionAccess(): ExportActionAccess {
        const { runtime, callbacks } = this;
        return {
            getCanvas: () => runtime.canvas,
            getAnnotations: () => callbacks.getAnnotations(),
            getMasks: () => callbacks.getMasks(),
            canRunIdleOperation: (operation, options) =>
                callbacks.canRunIdleOperation(operation, options),
            assertIdleForOperation: (operation, options) => {
                callbacks.assertIdleForOperation(operation, options);
            },
            finalizeActiveTextEditingIfNeeded: () => {
                callbacks.finalizeActiveTextEditingIfNeeded();
            },
            buildExportServiceContext: () => this.contextFactory.buildExportServiceContext(),
            buildMergeMasksContext: (token) => this.contextFactory.buildMergeMasksContext(token),
            buildMergeAnnotationsContext: (token) =>
                this.contextFactory.buildMergeAnnotationsContext(token),
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

    buildMosaicActionAccess(): MosaicActionAccess {
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
            buildCallbackContext: (operation, isInternalOperation) =>
                callbacks.buildCallbackContext(operation, isInternalOperation),
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

    buildCropActionAccess(): CropActionAccess {
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
            buildCropControllerContext: (token) =>
                this.contextFactory.buildCropControllerContext(token),
            buildBusyOperationAccess: () => this.buildBusyOperationAccess(),
            buildCallbackContext: (operation, isInternalOperation) =>
                callbacks.buildCallbackContext(operation, isInternalOperation),
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
