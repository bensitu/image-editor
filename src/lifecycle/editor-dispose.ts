/**
 * Defensive cleanup helpers for ImageEditor disposal.
 *
 * These functions isolate best-effort teardown paths so dispose remains
 * idempotent even when Fabric or DOM cleanup throws.
 */

import type * as FabricNS from 'fabric';

export function safelyRemoveKeyboardListener(
    keyboardDocument: Document | null,
    keyboardHandler: ((event: KeyboardEvent) => void) | null,
): void {
    if (!keyboardDocument || !keyboardHandler) return;
    try {
        keyboardDocument.removeEventListener('keydown', keyboardHandler);
    } catch {
        /* ignore */
    }
}

export function safelyDisposeCanvas(canvas: FabricNS.Canvas | null): Promise<void> {
    if (!canvas) return Promise.resolve();
    try {
        return Promise.resolve(canvas.dispose())
            .then(() => undefined)
            .catch(() => {
                /* ignore */
            });
    } catch {
        /* ignore */
        return Promise.resolve();
    }
}

export function safelyExitActiveSession(
    hasSession: boolean,
    canvas: FabricNS.Canvas | null,
    exitSession: () => void,
    clearSession: () => void,
): void {
    if (!hasSession || !canvas) return;
    try {
        exitSession();
    } catch {
        /* ignore */
    }
    clearSession();
}
