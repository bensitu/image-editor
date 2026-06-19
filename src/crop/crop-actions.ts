import type * as FabricNS from 'fabric';

import type { OperationToken } from '../core/operation-guard.js';
import type {
    BaseImageObject,
    CropAspectRatio,
    CropModeOptions,
    ImageEditorCallbackContext,
    ImageEditorOperation,
    MaskObject,
} from '../core/public-types.js';
import type { BusyOperationAccess } from '../runtime/editor-operation-runner.js';
import { runBusyOperation } from '../runtime/editor-operation-runner.js';
import {
    applyCrop as applyCropImpl,
    cancelCrop as cancelCropImpl,
    enterCropMode as enterCropModeImpl,
    setCropAspectRatio as setCropAspectRatioImpl,
    type CropControllerContext,
    type CropSession,
} from './crop-controller.js';

export interface CropActionAccess {
    getCanvas(): FabricNS.Canvas | null;
    getOriginalImage(): BaseImageObject | null;
    getCropSession(): CropSession | null;
    setCropSession(session: CropSession | null): void;

    isImageLoaded(): boolean;
    canRunIdleOperation(operation: ImageEditorOperation): boolean;
    buildCropControllerContext(token?: OperationToken): CropControllerContext;
    buildBusyOperationAccess(): BusyOperationAccess;
    buildCallbackContext(
        operation: ImageEditorOperation,
        isInternalOperation: boolean,
    ): ImageEditorCallbackContext;

    getMasks(): MaskObject[];
    updateInputs(): void;
    updateMaskList(): void;
    updateUi(): void;

    emitMasksChanged(context: ImageEditorCallbackContext): void;
    emitImageChanged(context: ImageEditorCallbackContext): void;
    emitBusyChangeIfChanged(context: ImageEditorCallbackContext): void;
}

export function enterCropModeAction(access: CropActionAccess, options: CropModeOptions = {}): void {
    if (!access.getCanvas() || !access.getOriginalImage()) return;
    if (access.getCropSession()) return;
    if (!access.isImageLoaded()) return;
    if (!access.canRunIdleOperation('enterCropMode')) return;

    enterCropModeImpl(access.buildCropControllerContext(), options);
    access.updateUi();
    const callbackContext = access.buildCallbackContext('enterCropMode', false);
    access.emitBusyChangeIfChanged(callbackContext);
    access.emitImageChanged(callbackContext);
}

export function setCropAspectRatioAction(
    access: CropActionAccess,
    aspectRatio: CropAspectRatio,
): void {
    if (!access.getCanvas() || !access.getCropSession()) return;
    if (!access.canRunIdleOperation('setCropAspectRatio')) return;

    setCropAspectRatioImpl(access.buildCropControllerContext(), aspectRatio);
    access.updateUi();
    const callbackContext = access.buildCallbackContext('setCropAspectRatio', false);
    access.emitImageChanged(callbackContext);
}

export function cancelCropAction(access: CropActionAccess): void {
    const canvas = access.getCanvas();
    if (!canvas || !access.getCropSession()) return;
    if (!access.canRunIdleOperation('cancelCrop')) return;

    cancelCropImpl(access.buildCropControllerContext());
    access.setCropSession(null);
    access.updateUi();
    canvas.requestRenderAll();
    const callbackContext = access.buildCallbackContext('cancelCrop', false);
    access.emitBusyChangeIfChanged(callbackContext);
    access.emitImageChanged(callbackContext);
}

export async function applyCropAction(access: CropActionAccess): Promise<void> {
    if (!access.getCanvas() || !access.getCropSession()) return;
    if (!access.canRunIdleOperation('applyCrop')) return;

    const hadMasks = access.getMasks().length > 0;
    await runBusyOperation(
        access.buildBusyOperationAccess(),
        'applyCrop',
        async (callbackContext, operationToken) => {
            await applyCropImpl(access.buildCropControllerContext(operationToken));
            access.updateInputs();
            access.updateMaskList();
            if (hadMasks || access.getMasks().length > 0) {
                access.emitMasksChanged(callbackContext);
            }
            access.emitImageChanged(callbackContext);
        },
    );
}
