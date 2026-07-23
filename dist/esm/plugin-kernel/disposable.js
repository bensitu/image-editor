import { PluginAggregateError } from './errors.js';
import { reportWarningSafely } from './reporting.js';
export function isPromiseLike(value) {
    return ((typeof value === 'object' || typeof value === 'function') &&
        value !== null &&
        typeof value.then === 'function');
}
export function observePromise(promise, onRejected) {
    Promise.resolve(promise).catch(onRejected);
}
export function disposeInReverseSync(disposables, options = {}) {
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
                        ...(options.pluginId ? { pluginId: options.pluginId } : {}),
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
                ...(options.pluginId ? { pluginId: options.pluginId } : {}),
                cause: error,
                details: { cleanupIndex: index },
            });
        }
    }
    return Object.freeze(errors);
}
export function createDisposable(cleanup) {
    let state = 'active';
    let pending = null;
    return {
        dispose() {
            if (state === 'disposed')
                return undefined;
            if (state === 'disposing')
                return pending !== null && pending !== void 0 ? pending : undefined;
            state = 'disposing';
            let resolvePending = () => undefined;
            let rejectPending = () => undefined;
            const deferred = new Promise((resolve, reject) => {
                resolvePending = resolve;
                rejectPending = reject;
            });
            pending = deferred.finally(() => {
                state = 'disposed';
            });
            void pending.catch(() => undefined);
            try {
                const result = cleanup();
                if (isPromiseLike(result)) {
                    void Promise.resolve(result).then(resolvePending, rejectPending);
                    return pending;
                }
                state = 'disposed';
                resolvePending();
                return undefined;
            }
            catch (error) {
                state = 'disposed';
                rejectPending(error);
                throw error;
            }
        },
    };
}
export function createNoopDisposable() {
    return createDisposable(() => undefined);
}
export async function disposeInReverse(disposables, options = {}) {
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
                ...(options.pluginId ? { pluginId: options.pluginId } : {}),
                cause: error,
                details: { cleanupIndex: index },
            });
        }
    }
    return errors;
}
export function createCompositeDisposable(disposables, options = {}) {
    return createDisposable(async () => {
        const errors = await disposeInReverse(disposables, options);
        if (errors.length > 0) {
            throw new PluginAggregateError('One or more composite cleanup items failed.', errors, options.pluginId ? { pluginId: options.pluginId } : {});
        }
    });
}
//# sourceMappingURL=disposable.js.map