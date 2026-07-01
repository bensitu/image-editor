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
        return Promise.resolve();
    try {
        return Promise.resolve(canvas.dispose())
            .then(() => undefined)
            .catch(() => {
        });
    }
    catch {
        return Promise.resolve();
    }
}
export function safelyExitActiveSession(hasSession, canvas, exitSession, clearSession) {
    if (!hasSession || !canvas)
        return;
    try {
        exitSession();
    }
    catch {
    }
    clearSession();
}
//# sourceMappingURL=editor-dispose.js.map