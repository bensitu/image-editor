const ANIMATION_SETTLE_GRACE_MS = 1000;
export function animateProps(object, props, options, guard) {
    return new Promise((resolve, reject) => {
        const propCount = Object.keys(props).length;
        if (propCount === 0 || guard.isDisposed()) {
            resolve();
            return;
        }
        let completed = 0;
        let settled = false;
        let aborters = [];
        let timeoutId = null;
        let unregisterAborter = null;
        const cleanup = () => {
            if (timeoutId !== null) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
            unregisterAborter === null || unregisterAborter === void 0 ? void 0 : unregisterAborter();
            unregisterAborter = null;
        };
        const settle = () => {
            if (settled)
                return;
            settled = true;
            cleanup();
            resolve();
        };
        const fail = (error) => {
            if (settled)
                return;
            settled = true;
            cleanup();
            reject(error);
        };
        const abortAndSettle = () => {
            for (const abort of aborters) {
                try {
                    abort();
                }
                catch {
                }
            }
            settle();
        };
        const duration = Number.isFinite(options.duration) ? Math.max(0, options.duration) : 0;
        timeoutId = setTimeout(abortAndSettle, duration + ANIMATION_SETTLE_GRACE_MS);
        unregisterAborter = guard.registerAnimationAborter(abortAndSettle);
        try {
            const animationResult = object.animate(props, {
                duration,
                onChange: () => {
                    var _a;
                    if (guard.isDisposed())
                        return;
                    (_a = options.onChange) === null || _a === void 0 ? void 0 : _a.call(options);
                },
                onComplete: () => {
                    if (++completed >= propCount)
                        settle();
                },
            });
            aborters = collectAnimationAborters(animationResult);
        }
        catch (error) {
            fail(error);
        }
    });
}
function collectAnimationAborters(animationResult) {
    const handles = Array.isArray(animationResult)
        ? animationResult
        : animationResult && typeof animationResult === 'object'
            ? Object.values(animationResult)
            : [animationResult];
    return handles.flatMap((handle) => {
        const abort = handle === null || handle === void 0 ? void 0 : handle.abort;
        return typeof abort === 'function' ? [() => abort.call(handle)] : [];
    });
}
export function restoreOrigin(object, originX, originY) {
    try {
        object.set({ originX, originY });
        object.setCoords();
    }
    catch {
    }
}
//# sourceMappingURL=fabric-animation.js.map