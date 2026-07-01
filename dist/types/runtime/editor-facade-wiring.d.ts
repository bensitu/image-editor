/**
 * Builds runtime wiring for the ImageEditor facade.
 *
 * The facade supplies small hook groups for behavior that must stay on the
 * public coordinator. This module owns the repetitive context/action access
 * maps so `ImageEditor` can remain focused on public API and lifecycle order.
 */
import type * as FabricNS from 'fabric';
import type { OperationToken } from '../core/operation-guard.js';
import type { AnnotationObject, AnnotationUpdateConfig, ImageEditorCallbackContext, ImageEditorOperation, ImageEditorSelection, LoadImageOptions, MaskObject } from '../core/public-types.js';
import type { ImageDisplayGeometry } from '../image/display-geometry.js';
import { EditorActionAccessFactory, type EditorActionCallbacks } from './editor-action-access.js';
import type { EditorContextFactory } from './editor-contexts.js';
import type { EditorRuntime } from './editor-runtime.js';
export interface EditorRuntimeOperationHooks {
    canRunIdleOperation(operation: ImageEditorOperation, options?: object | null): boolean;
    assertIdleForOperation(operation: ImageEditorOperation, options?: object | null): void;
    assertCanQueueAnimation(operation: ImageEditorOperation): void;
    finalizeActiveTextEditingIfNeeded(): void;
    withSelectionChangeContext<T>(context: ImageEditorCallbackContext, callback: () => T): T;
    withInternalOperationOptions<T extends object>(token: OperationToken | null | undefined, options?: T): T & object;
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
    updateCanvasSizeToImageBounds(options?: {
        stabilizeContainedViewport?: boolean;
    }): void;
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
    buildCallbackContext(operation: ImageEditorOperation, isInternalOperation: boolean): ImageEditorCallbackContext;
    emitImageCleared(image: NonNullable<EditorRuntime['originalImage']>, context: ImageEditorCallbackContext): void;
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
export declare function createEditorRuntimeWiring(runtime: EditorRuntime, hooks: EditorRuntimeWiringHooks): EditorRuntimeWiring;
