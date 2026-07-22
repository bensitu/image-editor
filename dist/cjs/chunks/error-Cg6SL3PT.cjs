'use strict';

function settleAbortable(task, signal, disposeLateResult) {
    return new Promise((resolve, reject) => {
        let settled = false;
        const finish = (body) => {
            if (settled)
                return;
            settled = true;
            signal.removeEventListener('abort', abort);
            body();
        };
        const abort = () => finish(() => {
            var _a;
            return reject((_a = signal.reason) !== null && _a !== void 0 ? _a : new DOMException('The asynchronous task was aborted.', 'AbortError'));
        });
        signal.addEventListener('abort', abort, { once: true });
        if (signal.aborted)
            abort();
        task.then((value) => {
            if (settled) {
                try {
                    disposeLateResult === null || disposeLateResult === void 0 ? void 0 : disposeLateResult(value);
                }
                catch {
                }
                return;
            }
            finish(() => resolve(value));
        }, (error) => finish(() => reject(error)));
    });
}

function hasErrorName(error, expectedName) {
    if ((typeof error !== 'object' && typeof error !== 'function') || error === null) {
        return false;
    }
    try {
        return Reflect.get(error, 'name') === expectedName;
    }
    catch {
        return false;
    }
}

exports.hasErrorName = hasErrorName;
exports.settleAbortable = settleAbortable;
//# sourceMappingURL=error-Cg6SL3PT.cjs.map
