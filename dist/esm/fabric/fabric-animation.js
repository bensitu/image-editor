const ANIMATION_SETTLE_GRACE_MS = 1000;
const ANIMATION_ABORT_QUIESCENCE_MS = 50;
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
        let abortDeadlineId = null;
        let quiescenceTimeoutId = null;
        let unregisterAborter = null;
        let aborting = false;
        let abortedHandleCount = 0;
        const cleanup = () => {
            if (timeoutId !== null) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
            if (abortDeadlineId !== null) {
                clearTimeout(abortDeadlineId);
                abortDeadlineId = null;
            }
            if (quiescenceTimeoutId !== null) {
                clearTimeout(quiescenceTimeoutId);
                quiescenceTimeoutId = null;
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
        const abortAnimationHandles = () => {
            for (let index = abortedHandleCount; index < aborters.length; index += 1, abortedHandleCount += 1) {
                const abort = aborters[index];
                if (!abort)
                    continue;
                try {
                    abort();
                }
                catch {
                }
            }
        };
        const scheduleQuiescenceSettlement = () => {
            if (quiescenceTimeoutId !== null)
                clearTimeout(quiescenceTimeoutId);
            quiescenceTimeoutId = setTimeout(settle, ANIMATION_ABORT_QUIESCENCE_MS);
        };
        const abortAndQuiesce = () => {
            if (settled)
                return;
            if (!aborting) {
                aborting = true;
                if (timeoutId !== null) {
                    clearTimeout(timeoutId);
                    timeoutId = null;
                }
                abortDeadlineId = setTimeout(settle, ANIMATION_SETTLE_GRACE_MS);
            }
            abortAnimationHandles();
            scheduleQuiescenceSettlement();
        };
        const duration = Number.isFinite(options.duration) ? Math.max(0, options.duration) : 0;
        timeoutId = setTimeout(abortAndQuiesce, duration + ANIMATION_SETTLE_GRACE_MS);
        unregisterAborter = guard.registerAnimationAborter(abortAndQuiesce);
        try {
            const animationResult = object.animate(props, {
                duration,
                onChange: () => {
                    var _a;
                    if (aborting) {
                        scheduleQuiescenceSettlement();
                        return;
                    }
                    if (guard.isDisposed())
                        return;
                    (_a = options.onChange) === null || _a === void 0 ? void 0 : _a.call(options);
                },
                onComplete: () => {
                    if (aborting) {
                        scheduleQuiescenceSettlement();
                        return;
                    }
                    if (++completed >= propCount)
                        settle();
                },
            });
            aborters = collectAnimationAborters(animationResult);
            if (aborting)
                abortAnimationHandles();
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