/**
 * Selection and object-modification handlers for editor-owned canvas objects.
 *
 * The facade delegates Fabric selection events here so mask labels, lists,
 * history, and lifecycle callbacks stay synchronized.
 */

import type * as FabricNS from 'fabric';

import { isAnnotationLocked } from '../annotation/annotation-lock.js';
import {
    isAnnotationObject,
    isMaskObject,
    isTextAnnotationObject,
    type AnnotationObject,
    type ImageEditorCallbackContext,
    type ImageEditorOperation,
    type ImageEditorSelection,
    type MaskObject,
} from '../core/public-types.js';
import { applyMaskSelectedStyle, applyMaskUnselectedStyle } from '../mask/mask-style.js';

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
    buildCallbackContext(
        operation: ImageEditorOperation,
        isHistoryRestore: boolean,
    ): ImageEditorCallbackContext;

    emitSelectionChange(selection: ImageEditorSelection, context: ImageEditorCallbackContext): void;
    emitMasksChanged(context: ImageEditorCallbackContext): void;
    emitAnnotationsChanged(context: ImageEditorCallbackContext): void;
    emitImageChanged(context: ImageEditorCallbackContext): void;
}

export function handleSelectionChanged(
    access: EditorSelectionControllerAccess,
    selected: FabricNS.FabricObject[],
): void {
    const canvas = access.getCanvas();
    if (!canvas) return;

    const selectedMask = selected.find(isMaskObject) ?? null;
    const selectedAnnotation = selected.find(isAnnotationObject) ?? null;
    const masks = canvas.getObjects().filter(isMaskObject);

    masks.forEach((maskObject) => {
        if (maskObject !== selectedMask) {
            if (maskObject.labelObject) {
                access.removeLabelForMask(maskObject);
            }
            applyMaskUnselectedStyle(maskObject);
        } else {
            applyMaskSelectedStyle(maskObject);
        }
    });

    if (selectedMask) access.showLabelForMask(selectedMask);
    access.updateMaskListSelection(selectedMask);
    access.updateAnnotationListSelection(selectedAnnotation);
    canvas.requestRenderAll();
    access.updateUi();

    const activeStateRestoreOperation = access.getActiveStateRestoreOperation();
    const context =
        access.getNextSelectionChangeContext() ??
        access.buildCallbackContext(
            activeStateRestoreOperation ?? 'createMask',
            activeStateRestoreOperation === 'undo' || activeStateRestoreOperation === 'redo',
        );
    access.emitSelectionChange(access.buildSelection(selected), context);
}

export function handleObjectMovingScalingRotating(
    access: EditorSelectionControllerAccess,
    target: FabricNS.FabricObject,
): void {
    if (isMaskObject(target)) {
        access.syncMaskLabel(target);
    }
}

export function handleObjectModified(
    access: EditorSelectionControllerAccess,
    target: FabricNS.FabricObject,
): void {
    if (isMaskObject(target)) {
        access.syncMaskLabel(target);
        const context = access.buildCallbackContext('saveState', false);
        access.saveState();
        access.emitMasksChanged(context);
        access.emitImageChanged(context);
        return;
    }

    if (isAnnotationObject(target)) {
        if (isAnnotationLocked(target)) return;
        if (isTextAnnotationObject(target)) {
            const textTarget = target as typeof target & {
                imageEditorTextEditingHandledChange?: boolean;
            };
            if (textTarget.imageEditorTextEditingHandledChange === true) {
                delete textTarget.imageEditorTextEditingHandledChange;
                return;
            }
        }
        const context = access.buildCallbackContext('updateAnnotation', false);
        access.saveState();
        access.emitAnnotationsChanged(context);
        access.emitImageChanged(context);
    }
}
