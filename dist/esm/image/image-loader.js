import { reportError, reportWarning } from '../core/callback-reporter.js';
import { ImageDecodeError } from '../core/errors.js';
import { saveState, SNAPSHOT_CUSTOM_KEYS } from '../core/state-serializer.js';
import { withTimeout } from '../utils/timeout.js';
import { computeCoverLayout, computeExpandLayout, computeFitLayout, selectLayoutStrategy, applyCanvasDimensions, } from './layout-manager.js';
import { computeDownsampleDimensions, detectSourceMimeType, resampleImage, } from './image-resampler.js';
export async function loadImage(ctx, imageBase64, loadOptions = {}) {
    if (typeof imageBase64 !== 'string' || !imageBase64.startsWith('data:image/')) {
        return;
    }
    const placeholderHidden = ctx.placeholderElement ? !!ctx.placeholderElement.hidden : null;
    const containerScrollTop = ctx.containerElement ? ctx.containerElement.scrollTop : null;
    const containerScrollLeft = ctx.containerElement ? ctx.containerElement.scrollLeft : null;
    const containerOverflow = ctx.containerElement ? ctx.containerElement.style.overflow : null;
    const bundle = {
        placeholderHidden,
        containerScrollTop,
        containerScrollLeft,
        containerOverflow,
        originalImage: ctx.getOriginalImage(),
        isImageLoadedToCanvas: ctx.getIsImageLoadedToCanvas(),
        lastSnapshot: ctx.getLastSnapshot(),
        canvasJson: serializeCanvas(ctx.canvas),
        maskCounter: ctx.getMaskCounter(),
        currentScale: ctx.getCurrentScale(),
        currentRotation: ctx.getCurrentRotation(),
        baseImageScale: ctx.getBaseImageScale(),
    };
    try {
        ctx.setPlaceholderVisible(false);
        const decode = startImageDecode(imageBase64);
        let imgEl;
        try {
            imgEl = await withTimeout(decode.promise, ctx.options.imageLoadTimeoutMs, 'image decode');
        }
        catch (error) {
            decode.cleanup(true);
            throw error;
        }
        const loadSrc = maybeDownsample(imgEl, imageBase64, ctx.options);
        const fimg = await withTimeout(ctx.fabric.FabricImage.fromURL(loadSrc, { crossOrigin: 'anonymous' }), ctx.options.imageLoadTimeoutMs, 'FabricImage.fromURL');
        ctx.canvas.discardActiveObject();
        ctx.canvas.clear();
        ctx.canvas.backgroundColor = ctx.options.backgroundColor;
        fimg.set({
            originX: 'left',
            originY: 'top',
            selectable: false,
            evented: false,
        });
        const layout = computeLayout(ctx, fimg);
        applyCanvasDimensions(ctx.canvas, layout.canvasWidth, layout.canvasHeight, ctx.containerElement);
        fimg.set({ left: layout.imageLeft, top: layout.imageTop });
        fimg.scale(layout.imageScale);
        ctx.canvas.add(fimg);
        ctx.canvas.sendObjectToBack(fimg);
        ctx.setOriginalImage(fimg);
        ctx.setBaseImageScale(layout.baseImageScale);
        ctx.setCurrentScale(1);
        ctx.setCurrentRotation(0);
        ctx.setMaskCounter(0);
        ctx.setIsImageLoadedToCanvas(true);
        ctx.canvas.renderAll();
        ctx.setLastSnapshot(saveState({
            canvas: ctx.canvas,
            currentScale: 1,
            currentRotation: 0,
            baseImageScale: layout.baseImageScale,
        }));
        if (loadOptions.preserveScroll === true && ctx.containerElement) {
            try {
                if (bundle.containerScrollTop !== null) {
                    ctx.containerElement.scrollTop = bundle.containerScrollTop;
                }
                if (bundle.containerScrollLeft !== null) {
                    ctx.containerElement.scrollLeft = bundle.containerScrollLeft;
                }
            }
            catch (err) {
                console.warn('[ImageEditor] preserveScroll restore failed', err);
            }
        }
        const cb = ctx.options.onImageLoaded;
        if (typeof cb === 'function') {
            try {
                cb();
            }
            catch (err) {
                console.error('[ImageEditor] onImageLoaded callback threw', err);
            }
        }
    }
    catch (err) {
        await replayRollback(ctx, bundle);
        const errorMessage = err instanceof Error ? `loadImage failed: ${err.message}` : 'loadImage failed';
        reportError(ctx.options, err, errorMessage);
        throw err;
    }
}
function startImageDecode(dataUrl) {
    const img = new Image();
    const cleanup = (clearSource = false) => {
        if (typeof img.removeEventListener === 'function') {
            img.removeEventListener('load', handleLoad);
            img.removeEventListener('error', handleError);
        }
        else {
            img.onload = null;
            img.onerror = null;
        }
        if (clearSource) {
            img.src = '';
        }
    };
    const handleLoad = () => {
        if (!hasNaturalImageDimensions(img)) {
            cleanup(true);
            rejectImage(new ImageDecodeError('Failed to decode image data URL: image has no natural dimensions.', null));
            return;
        }
        cleanup(false);
        resolveImage(img);
    };
    const handleError = (e) => {
        cleanup(true);
        rejectImage(new ImageDecodeError('Failed to decode image data URL.', e));
    };
    let resolveImage;
    let rejectImage;
    const promise = new Promise((resolve, reject) => {
        resolveImage = resolve;
        rejectImage = reject;
        if (typeof img.addEventListener === 'function') {
            img.addEventListener('load', handleLoad, { once: true });
            img.addEventListener('error', handleError, { once: true });
        }
        else {
            img.onload = handleLoad;
            img.onerror = handleError;
        }
        img.src = dataUrl;
    });
    return { promise, cleanup };
}
function hasNaturalImageDimensions(img) {
    return (Number.isFinite(img.naturalWidth) &&
        Number.isFinite(img.naturalHeight) &&
        img.naturalWidth > 0 &&
        img.naturalHeight > 0);
}
function isPositiveFinite(value) {
    return Number.isFinite(value) && value > 0;
}
function maybeDownsample(imgEl, originalDataUrl, options) {
    if (!options.downsampleOnLoad)
        return originalDataUrl;
    if (!isPositiveFinite(options.downsampleMaxWidth) ||
        !isPositiveFinite(options.downsampleMaxHeight)) {
        reportWarning(options, null, 'loadImage skipped downsampling because downsample bounds are invalid.');
        return originalDataUrl;
    }
    const dims = computeDownsampleDimensions(imgEl.naturalWidth, imgEl.naturalHeight, options.downsampleMaxWidth, options.downsampleMaxHeight);
    if (!dims.needsResize)
        return originalDataUrl;
    const sourceMime = detectSourceMimeType(originalDataUrl);
    return resampleImage(imgEl, options.downsampleMaxWidth, options.downsampleMaxHeight, sourceMime, options.preserveSourceFormat, options.downsampleMimeType, options.downsampleQuality).dataUrl;
}
function computeLayout(ctx, fimg) {
    var _a, _b;
    const imgW = (_a = fimg.width) !== null && _a !== void 0 ? _a : 0;
    const imgH = (_b = fimg.height) !== null && _b !== void 0 ? _b : 0;
    const viewport = ctx.viewportCache.measure(ctx.containerElement, {
        width: ctx.options.canvasWidth,
        height: ctx.options.canvasHeight,
    });
    const strategy = selectLayoutStrategy(ctx.options);
    if (strategy === 'fit') {
        return computeFitLayout(imgW, imgH, ctx.options.canvasWidth, ctx.options.canvasHeight, viewport);
    }
    if (strategy === 'cover') {
        return computeCoverLayout(imgW, imgH, ctx.options.canvasWidth, ctx.options.canvasHeight, viewport);
    }
    return computeExpandLayout(imgW, imgH, ctx.options.canvasWidth, ctx.options.canvasHeight, viewport);
}
function serializeCanvas(canvas) {
    canvas.discardActiveObject();
    const json = canvas.toJSON(SNAPSHOT_CUSTOM_KEYS);
    return JSON.stringify(json);
}
async function replayRollback(ctx, bundle) {
    if (ctx.containerElement && bundle.containerOverflow !== null) {
        try {
            ctx.containerElement.style.overflow = bundle.containerOverflow;
        }
        catch (err) {
            console.warn('[ImageEditor] rollback: overflow restore failed', err);
        }
    }
    try {
        await ctx.canvas.loadFromJSON(JSON.parse(bundle.canvasJson));
        ctx.canvas.renderAll();
    }
    catch (err) {
        console.warn('[ImageEditor] rollback: loadFromJSON failed', err);
    }
    ctx.setOriginalImage(bundle.originalImage);
    ctx.setIsImageLoadedToCanvas(bundle.isImageLoadedToCanvas);
    ctx.setLastSnapshot(bundle.lastSnapshot);
    ctx.setMaskCounter(bundle.maskCounter);
    ctx.setCurrentScale(bundle.currentScale);
    ctx.setCurrentRotation(bundle.currentRotation);
    ctx.setBaseImageScale(bundle.baseImageScale);
    if (ctx.containerElement) {
        try {
            if (bundle.containerScrollTop !== null) {
                ctx.containerElement.scrollTop = bundle.containerScrollTop;
            }
            if (bundle.containerScrollLeft !== null) {
                ctx.containerElement.scrollLeft = bundle.containerScrollLeft;
            }
        }
        catch (err) {
            console.warn('[ImageEditor] rollback: scroll restore failed', err);
        }
    }
    if (bundle.placeholderHidden !== null) {
        ctx.setPlaceholderVisible(!bundle.placeholderHidden);
    }
}
//# sourceMappingURL=image-loader.js.map