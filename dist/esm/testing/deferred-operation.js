export function createDeferredOperation() {
    let settled = false;
    let resolvePromise;
    let rejectPromise;
    const promise = new Promise((resolve, reject) => {
        resolvePromise = resolve;
        rejectPromise = reject;
    });
    return Object.freeze({
        promise,
        get settled() {
            return settled;
        },
        resolve(value) {
            if (settled)
                return;
            settled = true;
            resolvePromise(value);
        },
        reject(reason) {
            if (settled)
                return;
            settled = true;
            rejectPromise(reason);
        },
    });
}
function createAbortError() {
    const error = new Error('Image decoding was aborted.');
    error.name = 'AbortError';
    return error;
}
export function createControlledImageDecoder() {
    const pending = [];
    const remove = (entry) => {
        var _a;
        const index = pending.indexOf(entry);
        if (index >= 0)
            pending.splice(index, 1);
        (_a = entry.signal) === null || _a === void 0 ? void 0 : _a.removeEventListener('abort', entry.abortListener);
    };
    const takeNext = () => {
        const entry = pending[0];
        if (!entry)
            throw new Error('No controlled image decode is pending.');
        remove(entry);
        return entry;
    };
    return Object.freeze({
        get pendingInputs() {
            return Object.freeze(pending.map((entry) => entry.input));
        },
        decode(input, signal) {
            const deferred = createDeferredOperation();
            const abortListener = () => {
                const index = pending.findIndex((entry) => entry.deferred === deferred);
                if (index >= 0)
                    pending.splice(index, 1);
                deferred.reject(createAbortError());
            };
            const entry = { input, deferred, signal, abortListener };
            if (signal === null || signal === void 0 ? void 0 : signal.aborted) {
                deferred.reject(createAbortError());
            }
            else {
                pending.push(entry);
                signal === null || signal === void 0 ? void 0 : signal.addEventListener('abort', abortListener, { once: true });
            }
            return deferred.promise;
        },
        resolveNext(image) {
            takeNext().deferred.resolve(image);
        },
        rejectNext(reason) {
            takeNext().deferred.reject(reason);
        },
    });
}
//# sourceMappingURL=deferred-operation.js.map