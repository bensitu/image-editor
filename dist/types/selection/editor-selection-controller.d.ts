/**
 * Selection and object-modification handlers for editor-owned canvas objects.
 *
 * The facade delegates Fabric selection events here so mask labels, lists,
 * history, and lifecycle callbacks stay synchronized.
 */
import type * as FabricNS from 'fabric';
import { type AnnotationObject, type ImageEditorCallbackContext, type ImageEditorOperation, type ImageEditorSelection, type MaskObject } from '../core/public-types.js';
export interface EditorSelectionControllerAccess {
    getCanvas(): FabricNS.Canvas | null;
    removeLabelForMask(mask: MaskObject): void;
    showLabelForMask(mask: MaskObject): void;
    syncMaskLabel(mask: MaskObject): void;
    updateMaskListSelection(mask: MaskObject | null): void;
    updateAnnotationListSelection(annotation: AnnotationObject | null): void;
    updateUi(): void;
    saveState(): void;
    getNextSelectionChangeContext(): ImageEditorCallbackContext | null;
    getActiveStateRestoreOperation(): ImageEditorOperation | null;
    buildSelection(selected: FabricNS.FabricObject[]): ImageEditorSelection;
    buildCallbackContext(operation: ImageEditorOperation, isHistoryRestore: boolean): ImageEditorCallbackContext;
    emitSelectionChange(selection: ImageEditorSelection, context: ImageEditorCallbackContext): void;
    emitMasksChanged(context: ImageEditorCallbackContext): void;
    emitAnnotationsChanged(context: ImageEditorCallbackContext): void;
    emitImageChanged(context: ImageEditorCallbackContext): void;
}
export declare function handleSelectionChanged(access: EditorSelectionControllerAccess, selected: FabricNS.FabricObject[]): void;
export declare function handleObjectMovingScalingRotating(access: EditorSelectionControllerAccess, target: FabricNS.FabricObject): void;
export declare function handleObjectModified(access: EditorSelectionControllerAccess, target: FabricNS.FabricObject): void;
//# sourceMappingURL=editor-selection-controller.d.ts.map