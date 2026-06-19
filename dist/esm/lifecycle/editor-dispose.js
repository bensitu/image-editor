export function safelyRemoveKeyboardListener(keyboardDocument, keyboardHandler) {
    if (!keyboardDocument || !keyboardHandler)
        return;
    try {
        keyboardDocument.removeEventListener('keydown', keyboardHandler);
    }
    catch {
    }
}
export function safelyDisposeCanvas(canvas) {
    if (!canvas)
        return;
    try {
        void Promise.resolve(canvas.dispose()).catch(() => {
        });
    }
    catch {
    }
}
//# sourceMappingURL=editor-dispose.js.map