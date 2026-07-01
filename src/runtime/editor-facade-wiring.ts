/**
 * Builds runtime wiring for the ImageEditor facade.
 *
 * The facade supplies small hook groups for behavior that must stay on the
 * public coordinator. This module owns the repetitive context/action access
 * maps so `ImageEditor` can remain focused on public API and lifecycle order.
 */

import type * as FabricNS from 'fabric';

import type { OperationToken } from '../core/operation-guard.js';
import type {
    AnnotationObject,
    AnnotationUpdateConfig,
    ImageEditorCallbackContext,
    ImageEditorOperation,
    ImageEditorSelection,
    LoadImageOptions,
    MaskObject,
} from '../core/public-types.js';
import type { ImageDisplayGeometry } from '../image/display-geometry.js';
import { EditorActionAccessFactory, type EditorActionCallbacks } from './editor-action-access.js';
import { createEditorContextFactory } from './editor-context-factory-access.js';
import type { EditorContextFactory } from './editor-contexts.js';
import type { EditorRuntime } from './editor-runtime.js';

export interface EditorRuntimeOperationHooks {
    canRunIdleOperation(operation: ImageEditorOperation, options?: object | null): boolean;
    assertIdleForOperation(operation: ImageEditorOperation, options?: object | null): void;
    assertCanQueueAnimation(operation: ImageEditorOperation): void;
    finalizeActiveTextEditingIfNeeded(): void;
    withSelectionChangeContext<T>(context: ImageEditorCallbackContext, callback: () => T): T;
    withInternalOperationOptions<T extends object>(
        token: OperationToken | null | undefined,
        options?: T,
    ): T & object;
    withAnimationQueueBypass<T extends object>(options?: T): T & object;
}

export interface EditorRuntimeStateHooks {
    saveCanvasState(options?: object | null): void;
    captureSnapshot(): string;
    loadImage(base64: string, options: LoadImageOptions & object): Promise<void>;
    loadFromState(snapshot: string, options?: object | null): Promise<void>;
}

export interface EditorRuntimeDisplayHooks {
    inferCurrentImageMimeType(): ReturnType<EditorActionCallbacks['inferCurrentImageMimeType']>;
    shouldNormalizeCanvasSizeAfterStateRestore(): boolean;
    updateCanvasSizeToImageBounds(options?: { stabilizeContainedViewport?: boolean }): void;
    alignObjectBoundingBoxToCanvasTopLeft(object: FabricNS.FabricObject): void;
    settleFitCoverScrollbarsAfterStateRestore(): void;
    setCanvasSize(widthPx: number, heightPx: number): void;
    captureImageDisplayGeometry(): ImageDisplayGeometry | null;
    restoreMergedImageDisplayGeometry(geometry: ImageDisplayGeometry | null): void;
}

export interface EditorRuntimeSelectionHooks {
    buildSelection(selected: FabricNS.FabricObject[]): ImageEditorSelection;
    handleSelectionChanged(selected: FabricNS.FabricObject[]): void;
    getMasks(): MaskObject[];
    getAnnotations(): AnnotationObject[];
    getMaskCollectionSignature(): string;
    getAnnotationCollectionSignature(): string;
}

export interface EditorRuntimeUiHooks {
    refreshUiAfterQueuedAnimation(): void;
    updateInputs(): void;
    updateMaskList(): void;
    updateMaskListSelection(mask: MaskObject | null): void;
    updateAnnotationList(): void;
    updateAnnotationListSelection(annotation: AnnotationObject | null): void;
    updateUi(): void;
}

export interface EditorRuntimeLabelHooks {
    removeLabelForMask(mask: MaskObject): void;
    showLabelForMask(mask: MaskObject): void;
    syncMaskLabel(mask: MaskObject): void;
    hideAllMaskLabels(): void;
}

export interface EditorRuntimeConfigHooks {
    updateSelectedAnnotation(config: AnnotationUpdateConfig): void;
    setTextColor(color: string): void;
    setTextFontSize(size: number): void;
    setDrawColor(color: string): void;
    setDrawBrushSize(size: number): void;
}

export interface EditorRuntimeCallbackHooks {
    buildCallbackContext(
        operation: ImageEditorOperation,
        isInternalOperation: boolean,
    ): ImageEditorCallbackContext;
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
}

export interface EditorRuntimeWiringHooks {
    operations: EditorRuntimeOperationHooks;
    state: EditorRuntimeStateHooks;
    display: EditorRuntimeDisplayHooks;
    selection: EditorRuntimeSelectionHooks;
    ui: EditorRuntimeUiHooks;
    labels: EditorRuntimeLabelHooks;
    config: EditorRuntimeConfigHooks;
    callbacks: EditorRuntimeCallbackHooks;
}

export interface EditorRuntimeWiring {
    contextFactory: EditorContextFactory;
    actionAccessFactory: EditorActionAccessFactory;
}

export function createEditorRuntimeWiring(
    runtime: EditorRuntime,
    hooks: EditorRuntimeWiringHooks,
): EditorRuntimeWiring {
    const contextFactory = createContextFactory(runtime, hooks);
    return {
        contextFactory,
        actionAccessFactory: new EditorActionAccessFactory(
            runtime,
            createActionCallbacks(hooks),
            contextFactory,
        ),
    };
}

function createContextFactory(
    runtime: EditorRuntime,
    hooks: EditorRuntimeWiringHooks,
): EditorContextFactory {
    return createEditorContextFactory(runtime, {
        saveCanvasState: () => {
            hooks.state.saveCanvasState();
        },
        saveCanvasStateWithAnimationBypass: () => {
            hooks.state.saveCanvasState(hooks.operations.withAnimationQueueBypass());
        },
        captureSnapshot: () => hooks.state.captureSnapshot(),
        loadImageForOperation: (operationToken, base64, providedOptions) =>
            hooks.state.loadImage(
                base64,
                hooks.operations.withInternalOperationOptions(
                    operationToken,
                    providedOptions ?? {},
                ),
            ),
        loadMergedImage: async (operationToken, base64, providedOptions) => {
            const geometry = hooks.display.captureImageDisplayGeometry();
            try {
                await hooks.state.loadImage(
                    base64,
                    hooks.operations.withInternalOperationOptions(
                        operationToken,
                        providedOptions ?? {},
                    ),
                );
            } finally {
                hooks.display.restoreMergedImageDisplayGeometry(geometry);
            }
        },
        loadFromStateForOperation: (operationToken, snapshot) =>
            hooks.state.loadFromState(
                snapshot,
                hooks.operations.withInternalOperationOptions(
                    operationToken,
                    hooks.operations.withAnimationQueueBypass(),
                ),
            ),
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
        buildCallbackContext: (operation, isInternalOperation) =>
            hooks.callbacks.buildCallbackContext(operation, isInternalOperation ?? false),
    });
}

function createActionCallbacks(hooks: EditorRuntimeWiringHooks): EditorActionCallbacks {
    return {
        canRunIdleOperation: (operation, options) =>
            hooks.operations.canRunIdleOperation(operation, options),
        assertIdleForOperation: (operation, options) => {
            hooks.operations.assertIdleForOperation(operation, options);
        },
        assertCanQueueAnimation: (operation) => {
            hooks.operations.assertCanQueueAnimation(operation);
        },
        finalizeActiveTextEditingIfNeeded: () => {
            hooks.operations.finalizeActiveTextEditingIfNeeded();
        },
        buildCallbackContext: (operation, isInternalOperation) =>
            hooks.callbacks.buildCallbackContext(operation, isInternalOperation),
        withSelectionChangeContext: (context, callback) =>
            hooks.operations.withSelectionChangeContext(context, callback),
        buildSelection: (selected) => hooks.selection.buildSelection(selected),
        getMasks: () => hooks.selection.getMasks(),
        getAnnotations: () => hooks.selection.getAnnotations(),
        getMaskCollectionSignature: () => hooks.selection.getMaskCollectionSignature(),
        getAnnotationCollectionSignature: () => hooks.selection.getAnnotationCollectionSignature(),
        inferCurrentImageMimeType: () => hooks.display.inferCurrentImageMimeType(),
        shouldNormalizeCanvasSizeAfterStateRestore: () =>
            hooks.display.shouldNormalizeCanvasSizeAfterStateRestore(),
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
