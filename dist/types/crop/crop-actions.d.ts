/**
 * Crop mode action adapters for the ImageEditor facade.
 *
 * These helpers enforce crop operation guards, busy-state emission, and UI
 * refreshes around the crop controller.
 */
import type * as FabricNS from 'fabric';
import type { OperationToken } from '../core/operation-guard.js';
import type { BaseImageObject, CropAspectRatio, CropModeOptions, ImageEditorCallbackContext, ImageEditorOperation, MaskObject } from '../core/public-types.js';
import type { BusyOperationAccess } from '../runtime/editor-operation-runner.js';
import { type CropControllerContext, type CropSession } from './crop-controller.js';
export interface CropActionAccess {
    getCanvas(): FabricNS.Canvas | null;
    getOriginalImage(): BaseImageObject | null;
    getCropSession(): CropSession | null;
    setCropSession(session: CropSession | null): void;
    isImageLoaded(): boolean;
    canRunIdleOperation(operation: ImageEditorOperation, options?: object | null): boolean;
    buildCropControllerContext(token?: OperationToken): CropControllerContext;
    buildBusyOperationAccess(): BusyOperationAccess;
    buildCallbackContext(operation: ImageEditorOperation, isInternalOperation: boolean): ImageEditorCallbackContext;
    getMasks(): MaskObject[];
    updateInputs(): void;
    updateMaskList(): void;
    updateUi(): void;
    emitMasksChanged(context: ImageEditorCallbackContext): void;
    emitImageChanged(context: ImageEditorCallbackContext): void;
    emitBusyChangeIfChanged(context: ImageEditorCallbackContext): void;
}
export declare function enterCropModeAction(access: CropActionAccess, options?: CropModeOptions): void;
export declare function setCropAspectRatioAction(access: CropActionAccess, aspectRatio: CropAspectRatio): void;
export declare function cancelCropAction(access: CropActionAccess): void;
export declare function applyCropAction(access: CropActionAccess): Promise<void>;
