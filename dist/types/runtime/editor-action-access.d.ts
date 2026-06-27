/**
 * Builds action access objects from the shared runtime state.
 *
 * Public ImageEditor methods use these adapters to call focused action modules
 * without exposing the runtime object as each module's direct dependency.
 */
import type * as FabricNS from 'fabric';
import type { AnnotationConfigActionAccess } from '../annotation/annotation-config-actions.js';
import type { AnnotationModeActionAccess } from '../annotation/annotation-mode-actions.js';
import type { AnnotationObject, AnnotationUpdateConfig, ImageEditorCallbackContext, ImageEditorOperation, ImageEditorSelection, MaskObject } from '../core/public-types.js';
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
export interface EditorActionOperationCallbacks {
    canRunIdleOperation(operation: ImageEditorOperation, options?: object | null): boolean;
    assertIdleForOperation(operation: ImageEditorOperation, options?: object | null): void;
    assertCanQueueAnimation(operation: ImageEditorOperation): void;
    finalizeActiveTextEditingIfNeeded(): void;
    withSelectionChangeContext<T>(context: ImageEditorCallbackContext, callback: () => T): T;
    withAnimationQueueBypass(): object;
}
export interface EditorActionCallbackEmitters {
    buildCallbackContext(operation: ImageEditorOperation, isInternalOperation: boolean): ImageEditorCallbackContext;
    emitImageCleared(image: NonNullable<EditorRuntime['originalImage']>, context: ImageEditorCallbackContext): void;
    emitSelectionChange(selection: ImageEditorSelection, context: ImageEditorCallbackContext): void;
    emitMasksChanged(context: ImageEditorCallbackContext): void;
    emitAnnotationsChanged(context: ImageEditorCallbackContext): void;
    emitImageChanged(context: ImageEditorCallbackContext): void;
    emitBusyChangeIfChanged(context: ImageEditorCallbackContext): void;
    reportWarning(error: unknown, message: string): void;
}
export interface EditorActionSelectionCallbacks {
    buildSelection(selected: FabricNS.FabricObject[]): ImageEditorSelection;
    handleSelectionChanged(selected: FabricNS.FabricObject[]): void;
    getMasks(): MaskObject[];
    getAnnotations(): AnnotationObject[];
    getMaskCollectionSignature(): string;
    getAnnotationCollectionSignature(): string;
}
export interface EditorActionDisplayCallbacks {
    inferCurrentImageMimeType(): ReturnType<EditorStateActionAccess['getCurrentImageMimeType']>;
    shouldNormalizeCanvasSizeAfterStateRestore(): boolean;
    updateCanvasSizeToImageBounds(options: {
        stabilizeContainedViewport?: boolean;
    }): void;
    alignObjectBoundingBoxToCanvasTopLeft(object: FabricNS.FabricObject): void;
    settleFitCoverScrollbarsAfterStateRestore(): void;
    setCanvasSize(widthPx: number, heightPx: number): void;
}
export interface EditorActionUiCallbacks {
    refreshUiAfterQueuedAnimation(): void;
    updateInputs(): void;
    updateMaskList(): void;
    updateMaskListSelection(mask: MaskObject | null): void;
    updateAnnotationList(): void;
    updateAnnotationListSelection(annotation: AnnotationObject | null): void;
    updateUi(): void;
}
export interface EditorActionMaskLabelCallbacks {
    removeLabelForMask(mask: MaskObject): void;
    showLabelForMask(mask: MaskObject): void;
    syncMaskLabel(mask: MaskObject): void;
    hideAllMaskLabels(): void;
}
export interface EditorActionConfigCallbacks {
    updateSelectedAnnotation(config: AnnotationUpdateConfig): void;
    setTextColor(color: string): void;
    setTextFontSize(size: number): void;
    setDrawColor(color: string): void;
    setDrawBrushSize(size: number): void;
}
export interface EditorActionHistoryCallbacks {
    saveState(): void;
}
export interface EditorActionCallbacks extends EditorActionOperationCallbacks, EditorActionCallbackEmitters, EditorActionSelectionCallbacks, EditorActionDisplayCallbacks, EditorActionUiCallbacks, EditorActionMaskLabelCallbacks, EditorActionConfigCallbacks, EditorActionHistoryCallbacks {
}
export declare class EditorActionAccessFactory {
    private readonly runtime;
    private readonly callbacks;
    private readonly contextFactory;
    constructor(runtime: EditorRuntime, callbacks: EditorActionCallbacks, contextFactory: EditorContextFactory);
    buildBusyOperationAccess(): BusyOperationAccess;
    buildTransformActionAccess(): TransformActionAccess;
    buildEditorStateActionAccess(): EditorStateActionAccess;
    buildMaskActionAccess(): MaskActionAccess;
    buildSelectionControllerAccess(): EditorSelectionControllerAccess;
    buildAnnotationModeActionAccess(): AnnotationModeActionAccess;
    buildEditableObjectActionAccess(): EditableObjectActionAccess;
    buildAnnotationConfigActionAccess(): AnnotationConfigActionAccess;
    buildExportActionAccess(): ExportActionAccess;
    buildMosaicActionAccess(): MosaicActionAccess;
    buildCropActionAccess(): CropActionAccess;
}
//# sourceMappingURL=editor-action-access.d.ts.map