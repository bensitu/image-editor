export function animateProps(object, props, options, guard) {
    return new Promise((resolve, reject) => {
        const propCount = Object.keys(props).length;
        if (propCount === 0) {
            resolve();
            return;
        }
        let completed = 0;
        try {
            object.animate(props, {
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
        catch (error) {
            reject(error);
        }
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