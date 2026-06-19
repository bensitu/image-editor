import { enterDrawMode as enterDrawModeImpl, exitDrawMode as exitDrawModeImpl, } from './draw-controller.js';
import { createTextAnnotation as createTextAnnotationImpl, enterTextMode as enterTextModeImpl, exitTextMode as exitTextModeImpl, } from './text-controller.js';
export function enterTextModeAction(access) {
    if (!access.getCanvas())
        return;
    if (!access.canRunIdleOperation('enterTextMode'))
        return;
    if (access.isToolModeActive())
        return;
    enterTextModeImpl(access.buildTextControllerContext());
    const callbackContext = access.buildCallbackContext('enterTextMode', false);
    access.emitBusyChangeIfChanged(callbackContext);
    access.emitImageChanged(callbackContext);
}
export function exitTextModeAction(access) {
    if (!access.getCanvas() || !access.getTextSession())
        return;
    if (!access.canRunIdleOperation('exitTextMode'))
        return;
    exitTextModeImpl(access.buildTextControllerContext());
    const callbackContext = access.buildCallbackContext('exitTextMode', false);
    access.emitBusyChangeIfChanged(callbackContext);
    access.emitImageChanged(callbackContext);
}
export function createTextAnnotationAction(access, config = {}) {
    if (!access.getCanvas())
        return null;
    if (!access.canRunIdleOperation('createTextAnnotation'))
        return null;
    return createTextAnnotationImpl(access.buildTextControllerContext(), config);
}
export function enterDrawModeAction(access) {
    if (!access.getCanvas())
        return;
    if (!access.canRunIdleOperation('enterDrawMode'))
        return;
    if (access.isToolModeActive())
        return;
    enterDrawModeImpl(access.buildDrawControllerContext());
    const callbackContext = access.buildCallbackContext('enterDrawMode', false);
    access.emitBusyChangeIfChanged(callbackContext);
    access.emitImageChanged(callbackContext);
}
export function exitDrawModeAction(access) {
    if (!access.getCanvas() || !access.getDrawSession())
        return;
    if (!access.canRunIdleOperation('exitDrawMode'))
        return;
    exitDrawModeImpl(access.buildDrawControllerContext());
    const callbackContext = access.buildCallbackContext('exitDrawMode', false);
    access.emitBusyChangeIfChanged(callbackContext);
    access.emitImageChanged(callbackContext);
}
//# sourceMappingURL=annotation-mode-actions.js.map