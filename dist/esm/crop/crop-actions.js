import { runBusyOperation } from '../runtime/editor-operation-runner.js';
import { applyCrop as applyCropImpl, cancelCrop as cancelCropImpl, enterCropMode as enterCropModeImpl, setCropAspectRatio as setCropAspectRatioImpl, } from './crop-controller.js';
export function enterCropModeAction(access, options = {}) {
    if (!access.getCanvas() || !access.getOriginalImage())
        return;
    if (access.getCropSession())
        return;
    if (!access.isImageLoaded())
        return;
    if (!access.canRunIdleOperation('enterCropMode'))
        return;
    enterCropModeImpl(access.buildCropControllerContext(), options);
    access.updateUi();
    const callbackContext = access.buildCallbackContext('enterCropMode', false);
    access.emitBusyChangeIfChanged(callbackContext);
    access.emitImageChanged(callbackContext);
}
export function setCropAspectRatioAction(access, aspectRatio) {
    if (!access.getCanvas() || !access.getCropSession())
        return;
    if (!access.canRunIdleOperation('setCropAspectRatio'))
        return;
    setCropAspectRatioImpl(access.buildCropControllerContext(), aspectRatio);
    access.updateUi();
    const callbackContext = access.buildCallbackContext('setCropAspectRatio', false);
    access.emitImageChanged(callbackContext);
}
export function cancelCropAction(access) {
    const canvas = access.getCanvas();
    if (!canvas || !access.getCropSession())
        return;
    if (!access.canRunIdleOperation('cancelCrop'))
        return;
    cancelCropImpl(access.buildCropControllerContext());
    access.setCropSession(null);
    access.updateUi();
    canvas.requestRenderAll();
    const callbackContext = access.buildCallbackContext('cancelCrop', false);
    access.emitBusyChangeIfChanged(callbackContext);
    access.emitImageChanged(callbackContext);
}
export async function applyCropAction(access) {
    if (!access.getCanvas() || !access.getCropSession())
        return;
    if (!access.canRunIdleOperation('applyCrop'))
        return;
    const hadMasks = access.getMasks().length > 0;
    await runBusyOperation(access.buildBusyOperationAccess(), 'applyCrop', async (callbackContext, operationToken) => {
        await applyCropImpl(access.buildCropControllerContext(operationToken));
        access.updateInputs();
        access.updateMaskList();
        if (hadMasks || access.getMasks().length > 0) {
            access.emitMasksChanged(callbackContext);
        }
        access.emitImageChanged(callbackContext);
    });
}
//# sourceMappingURL=crop-actions.js.map