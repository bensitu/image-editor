export function startImageElementLoad(dataUrl, options) {
    const imageElement = new Image();
    if (options.crossOrigin !== undefined) {
        imageElement.crossOrigin = options.crossOrigin;
    }
    const cleanup = (clearSource = false) => {
        if (typeof imageElement.removeEventListener === 'function') {
            imageElement.removeEventListener('load', handleLoad);
            imageElement.removeEventListener('error', handleError);
        }
        else {
            imageElement.onload = null;
            imageElement.onerror = null;
        }
        if (clearSource) {
            try {
                imageElement.src = '';
            }
            catch {
            }
        }
    };
    const handleLoad = () => {
        var _a, _b;
        const validationError = (_b = (_a = options.validate) === null || _a === void 0 ? void 0 : _a.call(options, imageElement)) !== null && _b !== void 0 ? _b : null;
        if (validationError) {
            cleanup(true);
            rejectImage(validationError);
            return;
        }
        cleanup(false);
        resolveImage(imageElement);
    };
    const handleError = (event) => {
        cleanup(true);
        rejectImage(options.createError(event));
    };
    let resolveImage;
    let rejectImage;
    const promise = new Promise((resolve, reject) => {
        resolveImage = resolve;
        rejectImage = reject;
        if (typeof imageElement.addEventListener === 'function') {
            imageElement.addEventListener('load', handleLoad, { once: true });
            imageElement.addEventListener('error', handleError, { once: true });
        }
        else {
            imageElement.onload = handleLoad;
            imageElement.onerror = handleError;
        }
        imageElement.src = dataUrl;
    });
    return { promise, cleanup };
}
//# sourceMappingURL=image-element-loader.js.map