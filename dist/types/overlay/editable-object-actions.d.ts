/**
 * Editable overlay actions for annotations, masks, and layer ordering.
 *
 * The facade routes selected-object commands here so annotation updates,
 * mask label cleanup, history, and callbacks share one guarded path.
 */
import type * as FabricNS from 'fabric';
import { type AnnotationManagerContext } from '../annotation/annotation-manager.js';
import { type AnnotationObject, type AnnotationUpdateConfig, type ImageEditorCallbackContext, type ImageEditorOperation, type MaskObject, type RemoveAllAnnotationsOptions } from '../core/public-types.js';
export interface EditableObjectActionAccess {
    getCanvas(): FabricNS.Canvas | null;
    getLiveCanvas(operationName: string): FabricNS.Canvas;
    buildAnnotationManagerContext(): AnnotationManagerContext;
    getMasks(): MaskObject[];
    getAnnotations(): AnnotationObject[];
    removeLabelForMask(mask: MaskObject): void;
    withSelectionChangeContext<T>(context: ImageEditorCallbackContext, callback: () => T): T;
    buildCallbackContext(operation: ImageEditorOperation, isInternalOperation: boolean): ImageEditorCallbackContext;
    saveState(): void;
    updateMaskList(): void;
    updateMaskListSelection(mask: MaskObject | null): void;
    updateAnnotationList(): void;
    updateAnnotationListSelection(annotation: AnnotationObject | null): void;
    updateUi(): void;
    emitMasksChanged(context: ImageEditorCallbackContext): void;
    emitAnnotationsChanged(context: ImageEditorCallbackContext): void;
    emitImageChanged(context: ImageEditorCallbackContext): void;
    reportWarning(message: string): void;
}
export declare function removeSelectedAnnotationAction(access: EditableObjectActionAccess, context: ImageEditorCallbackContext): void;
export declare function removeAllAnnotationsAction(access: EditableObjectActionAccess, options: RemoveAllAnnotationsOptions, context: ImageEditorCallbackContext): void;
export declare function updateAnnotationAction(access: EditableObjectActionAccess, annotationId: number, config: AnnotationUpdateConfig, context: ImageEditorCallbackContext): void;
export declare function updateSelectedAnnotationAction(access: EditableObjectActionAccess, config: AnnotationUpdateConfig, context: ImageEditorCallbackContext): void;
export declare function deleteSelectedEditableObjects(access: EditableObjectActionAccess, context: ImageEditorCallbackContext): void;
export declare function moveSelectedEditableObject(access: EditableObjectActionAccess, operation: ImageEditorOperation): void;
//# sourceMappingURL=editable-object-actions.d.ts.map