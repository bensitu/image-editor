import { ImageLoadTimeoutError } from '../core/errors.js';
export function withTimeout(promise, ms, label, onTimeout) {
    return new Promise((resolve, reject) => {
        const start = Date.now();
        const timeoutId = setTimeout(() => {
            try {
                onTimeout === null || onTimeout === void 0 ? void 0 : onTimeout();
            }
            catch {
            }
            reject(new ImageLoadTimeoutError(label, Date.now() - start));
        }, ms);
        promise.then((value) => {
            clearTimeout(timeoutId);
            resolve(value);
        }, (err) => {
            clearTimeout(timeoutId);
            reject(err);
        });
    });
}
//# sourceMappingURL=timeout.js.map