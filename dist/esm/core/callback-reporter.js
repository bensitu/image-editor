export function reportWarning(options, error, message) {
    const warningCallback = options.onWarning;
    if (typeof warningCallback !== 'function')
        return;
    try {
        warningCallback(error, message);
    }
    catch (callbackError) {
        console.warn('[ImageEditor] onWarning callback threw', callbackError);
    }
}
export function reportError(options, error, message) {
    const errorCallback = options.onError;
    if (typeof errorCallback !== 'function')
        return;
    try {
        errorCallback(error, message);
    }
    catch (callbackError) {
        console.error('[ImageEditor] onError callback threw', callbackError);
    }
}
//# sourceMappingURL=callback-reporter.js.map