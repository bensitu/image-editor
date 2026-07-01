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
    buildCallbackContext(operation: ImageEditorOperation, isInternalOperation: boolean): ImageEditorCallbackContext;
    emitBusyChangeIfChanged(context: ImageEditorCallbackContext): void;
    updateUi(): void;
}
export declare function runBusyOperation<T>(access: BusyOperationAccess, operation: ImageEditorOperation, body: (context: ImageEditorCallbackContext, token: OperationToken) => Promise<T>): Promise<T>;
export declare function runBusyOperationWithoutUi<T>(access: BusyOperationAccess, operation: ImageEditorOperation, body: (context: ImageEditorCallbackContext, token: OperationToken) => Promise<T>): Promise<T>;
