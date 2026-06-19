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

export function safelyDisposeCanvas(canvas: FabricNS.Canvas | null): void {
    if (!canvas) return;
    try {
        void Promise.resolve(canvas.dispose()).catch(() => {
            /* ignore */
        });
    } catch {
        /* ignore */
    }
}
