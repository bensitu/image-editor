/**
 * Public mask action adapters for the ImageEditor facade.
 *
 * This module applies operation guards, callback emission, and UI refreshes
 * around the lower-level mask factory helpers.
 */

import type * as FabricNS from 'fabric';

import type {
    ImageEditorCallbackContext,
    ImageEditorOperation,
    MaskConfig,
    MaskObject,
    RemoveAllMasksOptions,
} from '../core/public-types.js';
import {
    createMask as createMaskImpl,
    removeAllMasks as removeAllMasksImpl,
    removeSelectedMask as removeSelectedMaskImpl,
    type CreateMaskContext,
    type RemoveMaskContext,
} from './mask-factory.js';

export interface MaskActionAccess {
    getCanvas(): FabricNS.Canvas | null;
    getMasks(): MaskObject[];
    canRunIdleOperation(operation: ImageEditorOperation, options?: object | null): boolean;
    buildCallbackContext(
        operation: ImageEditorOperation,
        isInternalOperation: boolean,
    ): ImageEditorCallbackContext;
    buildCreateMaskContext(): CreateMaskContext;
    buildRemoveMaskContext(): RemoveMaskContext;
    withSelectionChangeContext<T>(context: ImageEditorCallbackContext, callback: () => T): T;
    updateUi(): void;
    emitMasksChanged(context: ImageEditorCallbackContext): void;
    emitImageChanged(context: ImageEditorCallbackContext): void;
}

export function createMaskAction(
    access: MaskActionAccess,
    config: MaskConfig = {},
): MaskObject | null {
    if (!access.getCanvas()) return null;
    if (!access.canRunIdleOperation('createMask')) return null;
    const callbackContext = access.buildCallbackContext('createMask', false);
    const mask = access.withSelectionChangeContext(callbackContext, () =>
        createMaskImpl(access.buildCreateMaskContext(), config),
    );
    if (mask) {
        access.emitMasksChanged(callbackContext);
        access.emitImageChanged(callbackContext);
    }
    return mask;
}

export function removeSelectedMaskAction(access: MaskActionAccess): void {
    if (!access.getCanvas()) return;
    if (!access.canRunIdleOperation('removeSelectedMask')) return;
    const before = access.getMasks().length;
    const callbackContext = access.buildCallbackContext('removeSelectedMask', false);
    access.withSelectionChangeContext(callbackContext, () =>
        removeSelectedMaskImpl(access.buildRemoveMaskContext()),
    );
    access.updateUi();
    if (access.getMasks().length !== before) {
        access.emitMasksChanged(callbackContext);
        access.emitImageChanged(callbackContext);
    }
}

export function removeAllMasksAction(
    access: MaskActionAccess,
    options: RemoveAllMasksOptions = {},
): void {
    if (!access.getCanvas()) return;
    if (!access.canRunIdleOperation('removeAllMasks', options)) return;
    const before = access.getMasks().length;
    const callbackContext = access.buildCallbackContext('removeAllMasks', false);
    access.withSelectionChangeContext(callbackContext, () =>
        removeAllMasksImpl(access.buildRemoveMaskContext(), options),
    );
    access.updateUi();
    if (access.getMasks().length !== before) {
        access.emitMasksChanged(callbackContext);
        access.emitImageChanged(callbackContext);
    }
}
