export function reportWarning(options, error, message) {
    const cb = options.onWarning;
    if (typeof cb !== 'function')
        return;
    try {
        cb(error, message);
    }
    catch (callbackError) {
        console.warn('[ImageEditor] onWarning callback threw', callbackError);
    }
}
export function reportError(options, error, message) {
    const cb = options.onError;
    if (typeof cb !== 'function')
        return;
    try {
        cb(error, message);
    }
    catch (callbackError) {
        console.error('[ImageEditor] onError callback threw', callbackError);
    }
}
//# sourceMappingURL=callback-reporter.js.map