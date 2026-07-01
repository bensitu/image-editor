export function scaleImageAction(access, factor) {
    if (!Number.isFinite(factor))
        return Promise.resolve();
    return runQueuedTransformAction(access, 'scaleImage', (controller) => controller.scaleImage(factor));
}
export function rotateImageAction(access, degrees) {
    if (!Number.isFinite(degrees))
        return Promise.resolve();
    return runQueuedTransformAction(access, 'rotateImage', (controller) => controller.rotateImage(degrees));
}
export function flipHorizontalAction(access) {
    return runQueuedTransformAction(access, 'flipHorizontal', (controller) => controller.flipHorizontal());
}
export function flipVerticalAction(access) {
    return runQueuedTransformAction(access, 'flipVertical', (controller) => controller.flipVertical());
}
export function resetImageTransformAction(access) {
    return runQueuedTransformAction(access, 'resetImageTransform', (controller) => controller.resetImageTransform());
}
function runQueuedTransformAction(access, operation, runControllerAction) {
    const controller = access.getTransformController();
    if (access.isDisposed() || !controller)
        return Promise.resolve();
    try {
        access.assertCanQueueAnimation(operation);
    }
    catch (error) {
        return Promise.reject(error);
    }
    const context = access.buildCallbackContext(operation, false);
    const job = access.enqueueAnimation(async () => {
        if (access.isDisposed())
            return;
        access.updateUi();
        try {
            await runControllerAction(controller);
            if (!access.isDisposed())
                access.emitImageChanged(context);
        }
        finally {
            if (!access.isDisposed()) {
                access.updateInputs();
            }
        }
    });
    access.emitBusyChangeIfChanged(context);
    return job.finally(() => {
        if (!access.isDisposed()) {
            access.refreshUiAfterQueuedAnimation();
            access.emitBusyChangeIfChanged(context);
        }
    });
}
//# sourceMappingURL=transform-actions.js.map