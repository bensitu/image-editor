import { isAnnotationLocked } from '../annotation/annotation-lock.js';
import { isAnnotationObject, isMaskObject, isTextAnnotationObject, } from '../core/public-types.js';
import { applyMaskSelectedStyle, applyMaskUnselectedStyle } from '../mask/mask-style.js';
export function handleSelectionChanged(access, selected) {
    var _a, _b, _c;
    const canvas = access.getCanvas();
    if (!canvas)
        return;
    const selectedMask = (_a = selected.find(isMaskObject)) !== null && _a !== void 0 ? _a : null;
    const selectedAnnotation = (_b = selected.find(isAnnotationObject)) !== null && _b !== void 0 ? _b : null;
    const masks = canvas.getObjects().filter(isMaskObject);
    masks.forEach((maskObject) => {
        if (maskObject !== selectedMask) {
            if (maskObject.labelObject) {
                access.removeLabelForMask(maskObject);
            }
            applyMaskUnselectedStyle(maskObject);
        }
        else {
            applyMaskSelectedStyle(maskObject);
        }
    });
    if (selectedMask)
        access.showLabelForMask(selectedMask);
    access.updateMaskListSelection(selectedMask);
    access.updateAnnotationListSelection(selectedAnnotation);
    canvas.requestRenderAll();
    access.updateUi();
    const activeStateRestoreOperation = access.getActiveStateRestoreOperation();
    const context = (_c = access.getNextSelectionChangeContext()) !== null && _c !== void 0 ? _c : access.buildCallbackContext(activeStateRestoreOperation !== null && activeStateRestoreOperation !== void 0 ? activeStateRestoreOperation : 'createMask', activeStateRestoreOperation === 'undo' || activeStateRestoreOperation === 'redo');
    access.emitSelectionChange(access.buildSelection(selected), context);
}
export function handleObjectMovingScalingRotating(access, target) {
    if (isMaskObject(target)) {
        access.syncMaskLabel(target);
    }
}
export function handleObjectModified(access, target) {
    if (isMaskObject(target)) {
        access.syncMaskLabel(target);
        const context = access.buildCallbackContext('saveState', false);
        access.saveState();
        access.emitMasksChanged(context);
        access.emitImageChanged(context);
        return;
    }
    if (isAnnotationObject(target)) {
        if (isAnnotationLocked(target))
            return;
        if (isTextAnnotationObject(target)) {
            const textTarget = target;
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
//# sourceMappingURL=editor-selection-controller.js.map