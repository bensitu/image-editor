/**
 * Queued transform action adapters for scale, rotate, flip, and reset.
 *
 * The facade uses these helpers to enforce animation queue ordering and
 * busy-state callbacks before calling the transform controller.
 */

import type { ImageEditorCallbackContext, ImageEditorOperation } from '../core/public-types.js';

export interface TransformControllerPort {
    scaleImage(factor: number): Promise<void>;
    rotateImage(degrees: number): Promise<void>;
    flipHorizontal(): Promise<void>;
    flipVertical(): Promise<void>;
    resetImageTransform(): Promise<void>;
}

export interface TransformActionAccess {
    isDisposed(): boolean;
    getTransformController(): TransformControllerPort | null;
    assertCanQueueAnimation(operation: ImageEditorOperation): void;
    buildCallbackContext(
        operation: ImageEditorOperation,
        isInternalOperation: boolean,
    ): ImageEditorCallbackContext;
    enqueueAnimation(body: () => Promise<void>): Promise<void>;
    updateInputs(): void;
    updateUi(): void;
    refreshUiAfterQueuedAnimation(): void;
    emitImageChanged(context: ImageEditorCallbackContext): void;
    emitBusyChangeIfChanged(context: ImageEditorCallbackContext): void;
}

type TransformControllerAction = (controller: TransformControllerPort) => Promise<void>;

export function scaleImageAction(access: TransformActionAccess, factor: number): Promise<void> {
    if (!Number.isFinite(factor)) return Promise.resolve();
    return runQueuedTransformAction(access, 'scaleImage', (controller) =>
        controller.scaleImage(factor),
    );
}

export function rotateImageAction(access: TransformActionAccess, degrees: number): Promise<void> {
    if (!Number.isFinite(degrees)) return Promise.resolve();
    return runQueuedTransformAction(access, 'rotateImage', (controller) =>
        controller.rotateImage(degrees),
    );
}

export function flipHorizontalAction(access: TransformActionAccess): Promise<void> {
    return runQueuedTransformAction(access, 'flipHorizontal', (controller) =>
        controller.flipHorizontal(),
    );
}

export function flipVerticalAction(access: TransformActionAccess): Promise<void> {
    return runQueuedTransformAction(access, 'flipVertical', (controller) =>
        controller.flipVertical(),
    );
}

export function resetImageTransformAction(access: TransformActionAccess): Promise<void> {
    return runQueuedTransformAction(access, 'resetImageTransform', (controller) =>
        controller.resetImageTransform(),
    );
}

function runQueuedTransformAction(
    access: TransformActionAccess,
    operation: ImageEditorOperation,
    runControllerAction: TransformControllerAction,
): Promise<void> {
    const controller = access.getTransformController();
    if (access.isDisposed() || !controller) return Promise.resolve();
    try {
        access.assertCanQueueAnimation(operation);
    } catch (error) {
        return Promise.reject(error);
    }

    const context = access.buildCallbackContext(operation, false);
    const job = access.enqueueAnimation(async () => {
        if (access.isDisposed()) return;
        access.updateUi();
        try {
            await runControllerAction(controller);
            if (!access.isDisposed()) access.emitImageChanged(context);
        } finally {
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
