export function animateProps(obj, props, options, guard) {
    return new Promise((resolve, reject) => {
        const propCount = Object.keys(props).length;
        if (propCount === 0) {
            resolve();
            return;
        }
        let completed = 0;
        try {
            obj.animate(props, {
                duration: options.duration,
                onChange: () => {
                    var _a;
                    if (guard.isDisposed())
                        return;
                    (_a = options.onChange) === null || _a === void 0 ? void 0 : _a.call(options);
                },
                onComplete: () => {
                    if (++completed >= propCount)
                        resolve();
                },
            });
        }
        catch (err) {
            reject(err);
        }
    });
}
export function restoreOrigin(obj, originX, originY) {
    try {
        obj.set({ originX, originY });
        obj.setCoords();
    }
    catch {
    }
}
//# sourceMappingURL=fabric-animation.js.map