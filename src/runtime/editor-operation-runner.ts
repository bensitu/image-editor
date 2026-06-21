/**
 * Busy-operation wrappers shared by export, merge, and crop actions.
 *
 * These helpers bracket async work with OperationGuard tokens, busy callbacks,
 * and optional UI refreshes.
 */

import type { OperationToken } from '../core/operation-guard.js';
import type { ImageEditorCallbackContext, ImageEditorOperation } from '../core/public-types.js';

export interface BusyOperationAccess {
    beginBusyOperation(operation: ImageEditorOperation): OperationToken;
    endBusyOperation(token: OperationToken): void;
    buildCallbackContext(
        operation: ImageEditorOperation,
        isInternalOperation: boolean,
    ): ImageEditorCallbackContext;
    emitBusyChangeIfChanged(context: ImageEditorCallbackContext): void;
    updateUi(): void;
}

export async function runBusyOperation<T>(
    access: BusyOperationAccess,
    operation: ImageEditorOperation,
    body: (context: ImageEditorCallbackContext, token: OperationToken) => Promise<T>,
): Promise<T> {
    const context = access.buildCallbackContext(operation, false);
    const token = access.beginBusyOperation(operation);
    access.emitBusyChangeIfChanged(context);
    access.updateUi();
    try {
        return await body(context, token);
    } finally {
        access.endBusyOperation(token);
        access.emitBusyChangeIfChanged(context);
        access.updateUi();
    }
}

export async function runBusyOperationWithoutUi<T>(
    access: BusyOperationAccess,
    operation: ImageEditorOperation,
    body: (context: ImageEditorCallbackContext, token: OperationToken) => Promise<T>,
): Promise<T> {
    const context = access.buildCallbackContext(operation, false);
    const token = access.beginBusyOperation(operation);
    access.emitBusyChangeIfChanged(context);
    try {
        return await body(context, token);
    } finally {
        access.endBusyOperation(token);
        access.emitBusyChangeIfChanged(context);
    }
}
