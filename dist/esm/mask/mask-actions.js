import { createMask as createMaskImpl, removeAllMasks as removeAllMasksImpl, removeSelectedMask as removeSelectedMaskImpl, } from './mask-factory.js';
export function createMaskAction(access, config = {}) {
    if (!access.getCanvas())
        return null;
    if (!access.canRunIdleOperation('createMask'))
        return null;
    const callbackContext = access.buildCallbackContext('createMask', false);
    const mask = access.withSelectionChangeContext(callbackContext, () => createMaskImpl(access.buildCreateMaskContext(), config));
    if (mask) {
        access.emitMasksChanged(callbackContext);
        access.emitImageChanged(callbackContext);
    }
    return mask;
}
export function removeSelectedMaskAction(access) {
    if (!access.getCanvas())
        return;
    if (!access.canRunIdleOperation('removeSelectedMask'))
        return;
    const before = access.getMasks().length;
    const callbackContext = access.buildCallbackContext('removeSelectedMask', false);
    access.withSelectionChangeContext(callbackContext, () => removeSelectedMaskImpl(access.buildRemoveMaskContext()));
    access.updateUi();
    if (access.getMasks().length !== before) {
        access.emitMasksChanged(callbackContext);
        access.emitImageChanged(callbackContext);
    }
}
export function removeAllMasksAction(access, options = {}) {
    if (!access.getCanvas())
        return;
    if (!access.canRunIdleOperation('removeAllMasks', options))
        return;
    const before = access.getMasks().length;
    const callbackContext = access.buildCallbackContext('removeAllMasks', false);
    access.withSelectionChangeContext(callbackContext, () => removeAllMasksImpl(access.buildRemoveMaskContext(), options));
    access.updateUi();
    if (access.getMasks().length !== before) {
        access.emitMasksChanged(callbackContext);
        access.emitImageChanged(callbackContext);
    }
}
//# sourceMappingURL=mask-actions.js.map