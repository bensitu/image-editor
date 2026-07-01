/**
 * Public mask action adapters for the ImageEditor facade.
 *
 * This module applies operation guards, callback emission, and UI refreshes
 * around the lower-level mask factory helpers.
 */
import type * as FabricNS from 'fabric';
import type { ImageEditorCallbackContext, ImageEditorOperation, MaskConfig, MaskObject, RemoveAllMasksOptions } from '../core/public-types.js';
import { type CreateMaskContext, type RemoveMaskContext } from './mask-factory.js';
export interface MaskActionAccess {
    getCanvas(): FabricNS.Canvas | null;
    getMasks(): MaskObject[];
    canRunIdleOperation(operation: ImageEditorOperation, options?: object | null): boolean;
    buildCallbackContext(operation: ImageEditorOperation, isInternalOperation: boolean): ImageEditorCallbackContext;
    buildCreateMaskContext(): CreateMaskContext;
    buildRemoveMaskContext(): RemoveMaskContext;
    withSelectionChangeContext<T>(context: ImageEditorCallbackContext, callback: () => T): T;
    updateUi(): void;
    emitMasksChanged(context: ImageEditorCallbackContext): void;
    emitImageChanged(context: ImageEditorCallbackContext): void;
}
export declare function createMaskAction(access: MaskActionAccess, config?: MaskConfig): MaskObject | null;
export declare function removeSelectedMaskAction(access: MaskActionAccess): void;
export declare function removeAllMasksAction(access: MaskActionAccess, options?: RemoveAllMasksOptions): void;
