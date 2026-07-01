/**
 * Defensive cleanup helpers for ImageEditor disposal.
 *
 * These functions isolate best-effort teardown paths so dispose remains
 * idempotent even when Fabric or DOM cleanup throws.
 */
import type * as FabricNS from 'fabric';
export declare function safelyRemoveKeyboardListener(keyboardDocument: Document | null, keyboardHandler: ((event: KeyboardEvent) => void) | null): void;
export declare function safelyDisposeCanvas(canvas: FabricNS.Canvas | null): Promise<void>;
export declare function safelyExitActiveSession(hasSession: boolean, canvas: FabricNS.Canvas | null, exitSession: () => void, clearSession: () => void): void;
