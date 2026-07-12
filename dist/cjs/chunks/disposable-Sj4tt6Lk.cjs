'use strict';

function reportErrorSafely(errorSink, error) {
    if (!errorSink)
        return;
    try {
        errorSink(error);
    }
    catch {
    }
}
function reportWarningSafely(warningSink, errorSink, warning) {
    if (!warningSink)
        return;
    try {
        warningSink(warning);
    }
    catch (error) {
        reportErrorSafely(errorSink, error);
    }
}

function isPromiseLike(value) {
    return ((typeof value === 'object' || typeof value === 'function') &&
        value !== null &&
        typeof value.then === 'function');
}
function disposeInReverseSync(disposables, options = {}) {
    var _a;
    const errors = [];
    for (let index = disposables.length - 1; index >= 0; index -= 1) {
        try {
            const result = (_a = disposables[index]) === null || _a === void 0 ? void 0 : _a.dispose();
            if (isPromiseLike(result)) {
                const error = new Error(`Synchronous cleanup item ${index} returned a Promise. Use the asynchronous disposal path.`);
                errors.push(error);
                void Promise.resolve(result).catch((cleanupError) => {
                    reportWarningSafely(options.warningSink, options.errorSink, {
                        code: 'PLUGIN_CLEANUP_FAILED',
                        message: `Asynchronous cleanup item ${index} failed after synchronous disposal returned.`,
                        pluginId: options.pluginId,
                        cause: cleanupError,
                        details: { cleanupIndex: index },
                    });
                });
            }
        }
        catch (error) {
            errors.push(error);
            reportWarningSafely(options.warningSink, options.errorSink, {
                code: 'PLUGIN_CLEANUP_FAILED',
                message: `Plugin cleanup item ${index} failed; remaining cleanup continued.`,
                pluginId: options.pluginId,
                cause: error,
                details: { cleanupIndex: index },
            });
        }
    }
    return Object.freeze(errors);
}
function createDisposable(cleanup) {
    let state = 'active';
    let pending = null;
    return {
        dispose() {
            if (state === 'disposed')
                return undefined;
            if (state === 'disposing')
                return pending !== null && pending !== void 0 ? pending : undefined;
            state = 'disposing';
            try {
                const result = cleanup();
                if (isPromiseLike(result)) {
                    pending = Promise.resolve(result).finally(() => {
                        state = 'disposed';
                    });
                    return pending;
                }
                state = 'disposed';
                return undefined;
            }
            catch (error) {
                state = 'disposed';
                throw error;
            }
        },
    };
}
function createNoopDisposable() {
    return createDisposable(() => undefined);
}
async function disposeInReverse(disposables, options = {}) {
    var _a;
    const errors = [];
    for (let index = disposables.length - 1; index >= 0; index -= 1) {
        try {
            await ((_a = disposables[index]) === null || _a === void 0 ? void 0 : _a.dispose());
        }
        catch (error) {
            errors.push(error);
            reportWarningSafely(options.warningSink, options.errorSink, {
                code: 'PLUGIN_CLEANUP_FAILED',
                message: `Plugin cleanup item ${index} failed; remaining cleanup continued.`,
                pluginId: options.pluginId,
                cause: error,
                details: { cleanupIndex: index },
            });
        }
    }
    return errors;
}

exports.createDisposable = createDisposable;
exports.createNoopDisposable = createNoopDisposable;
exports.disposeInReverse = disposeInReverse;
exports.disposeInReverseSync = disposeInReverseSync;
exports.isPromiseLike = isPromiseLike;
exports.reportErrorSafely = reportErrorSafely;
exports.reportWarningSafely = reportWarningSafely;
//# sourceMappingURL=disposable-Sj4tt6Lk.cjs.map
