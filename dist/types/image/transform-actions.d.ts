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
    buildCallbackContext(operation: ImageEditorOperation, isInternalOperation: boolean): ImageEditorCallbackContext;
    enqueueAnimation(body: () => Promise<void>): Promise<void>;
    updateInputs(): void;
    updateUi(): void;
    refreshUiAfterQueuedAnimation(): void;
    emitImageChanged(context: ImageEditorCallbackContext): void;
    emitBusyChangeIfChanged(context: ImageEditorCallbackContext): void;
}
export declare function scaleImageAction(access: TransformActionAccess, factor: number): Promise<void>;
export declare function rotateImageAction(access: TransformActionAccess, degrees: number): Promise<void>;
export declare function flipHorizontalAction(access: TransformActionAccess): Promise<void>;
export declare function flipVerticalAction(access: TransformActionAccess): Promise<void>;
export declare function resetImageTransformAction(access: TransformActionAccess): Promise<void>;
