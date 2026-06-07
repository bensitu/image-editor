import { reportError, reportWarning } from '../core/callback-reporter.js';
import { ImageDecodeError } from '../core/errors.js';
import { saveState, SNAPSHOT_CUSTOM_KEYS } from '../core/state-serializer.js';
import { withTimeout } from '../utils/timeout.js';
import { computeCoverLayout, computeExpandLayout, computeFitLayout, selectLayoutStrategy, applyCanvasDimensions, measureScrollbarSize, } from './layout-manager.js';
import { computeDownsampleDimensions, detectSourceMimeType, resampleImage, } from './image-resampler.js';
export async function loadImage(context, imageBase64, loadOptions = {}) {
    if (typeof imageBase64 !== 'string' || !imageBase64.startsWith('data:image/')) {
        return;
    }
    const placeholderHidden = context.placeholderElement
        ? !!context.placeholderElement.hidden
        : null;
    const containerScrollTop = context.containerElement ? context.containerElement.scrollTop : null;
    const containerScrollLeft = context.containerElement
        ? context.containerElement.scrollLeft
        : null;
    const bundle = {
        placeholderHidden,
        containerScrollTop,
        containerScrollLeft,
        originalImage: context.getOriginalImage(),
        isImageLoadedToCanvas: context.getIsImageLoadedToCanvas(),
        lastSnapshot: context.getLastSnapshot(),
        canvasJson: serializeCanvas(context.canvas),
        maskCounter: context.getMaskCounter(),
        currentScale: context.getCurrentScale(),
        currentRotation: context.getCurrentRotation(),
        baseImageScale: context.getBaseImageScale(),
        currentImageMimeType: context.getCurrentImageMimeType(),
    };
    try {
        context.setPlaceholderVisible(false);
        const decode = startImageDecode(imageBase64);
        let imageElement;
        try {
            imageElement = await withTimeout(decode.promise, context.options.imageLoadTimeoutMs, 'image decode');
        }
        catch (error) {
            decode.cleanup(true);
            throw error;
        }
        const loadSource = maybeDownsample(imageElement, imageBase64, context.options);
        const fabricImage = await withTimeout(context.fabric.FabricImage.fromURL(loadSource.dataUrl, { crossOrigin: 'anonymous' }), context.options.imageLoadTimeoutMs, 'FabricImage.fromURL');
        context.canvas.discardActiveObject();
        context.canvas.clear();
        context.canvas.backgroundColor = context.options.backgroundColor;
        fabricImage.set({
            originX: 'left',
            originY: 'top',
            selectable: false,
            evented: false,
        });
        const layout = computeLayout(context, fabricImage);
        applyCanvasDimensions(context.canvas, layout.canvasWidth, layout.canvasHeight, context.containerElement);
        fabricImage.set({ left: layout.imageLeft, top: layout.imageTop });
        fabricImage.scale(layout.imageScale);
        context.canvas.add(fabricImage);
        context.canvas.sendObjectToBack(fabricImage);
        context.setOriginalImage(fabricImage);
        context.setBaseImageScale(layout.baseImageScale);
        context.setCurrentScale(1);
        context.setCurrentRotation(0);
        context.setMaskCounter(0);
        context.setIsImageLoadedToCanvas(true);
        context.setCurrentImageMimeType(loadSource.mimeType);
        context.canvas.renderAll();
        context.setLastSnapshot(saveState({
            canvas: context.canvas,
            currentScale: 1,
            currentRotation: 0,
            baseImageScale: layout.baseImageScale,
            currentImageMimeType: loadSource.mimeType,
        }));
        if (loadOptions.preserveScroll === true && context.containerElement) {
            try {
                if (bundle.containerScrollTop !== null) {
                    context.containerElement.scrollTop = bundle.containerScrollTop;
                }
                if (bundle.containerScrollLeft !== null) {
                    context.containerElement.scrollLeft = bundle.containerScrollLeft;
                }
            }
            catch (error) {
                console.warn('[ImageEditor] preserveScroll restore failed', error);
            }
        }
    }
    catch (error) {
        await replayRollback(context, bundle);
        const errorMessage = error instanceof Error ? `loadImage failed: ${error.message}` : 'loadImage failed';
        reportError(context.options, error, errorMessage);
        throw error;
    }
}
function startImageDecode(dataUrl) {
    const imageElement = new Image();
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
            imageElement.src = '';
        }
    };
    const handleLoad = () => {
        if (!hasNaturalImageDimensions(imageElement)) {
            cleanup(true);
            rejectImage(new ImageDecodeError('Failed to decode image data URL: image has no natural dimensions.', null));
            return;
        }
        cleanup(false);
        resolveImage(imageElement);
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
function hasNaturalImageDimensions(imageElement) {
    return (Number.isFinite(imageElement.naturalWidth) &&
        Number.isFinite(imageElement.naturalHeight) &&
        imageElement.naturalWidth > 0 &&
        imageElement.naturalHeight > 0);
}
function isPositiveFinite(value) {
    return Number.isFinite(value) && value > 0;
}
function toSupportedImageMimeType(mimeType) {
    return mimeType === 'image/jpeg' || mimeType === 'image/png' || mimeType === 'image/webp'
        ? mimeType
        : null;
}
function maybeDownsample(imageElement, originalDataUrl, options) {
    const originalMimeType = toSupportedImageMimeType(detectSourceMimeType(originalDataUrl));
    if (!options.downsampleOnLoad) {
        return { dataUrl: originalDataUrl, mimeType: originalMimeType };
    }
    if (!isPositiveFinite(options.downsampleMaxWidth) ||
        !isPositiveFinite(options.downsampleMaxHeight)) {
        reportWarning(options, null, 'loadImage skipped downsampling because downsample bounds are invalid.');
        return { dataUrl: originalDataUrl, mimeType: originalMimeType };
    }
    const downsampleDimensions = computeDownsampleDimensions(imageElement.naturalWidth, imageElement.naturalHeight, options.downsampleMaxWidth, options.downsampleMaxHeight);
    if (!downsampleDimensions.needsResize) {
        return { dataUrl: originalDataUrl, mimeType: originalMimeType };
    }
    const sourceMime = detectSourceMimeType(originalDataUrl);
    const resampledImage = resampleImage(imageElement, options.downsampleMaxWidth, options.downsampleMaxHeight, sourceMime, options.preserveSourceFormat, options.downsampleMimeType, options.downsampleQuality);
    const actualMimeType = toSupportedImageMimeType(detectSourceMimeType(resampledImage.dataUrl));
    return {
        dataUrl: resampledImage.dataUrl,
        mimeType: actualMimeType !== null && actualMimeType !== void 0 ? actualMimeType : resampledImage.mimeType,
    };
}
function computeLayout(context, fabricImage) {
    var _a, _b, _c, _d;
    const imageWidth = (_a = fabricImage.width) !== null && _a !== void 0 ? _a : 0;
    const imageHeight = (_b = fabricImage.height) !== null && _b !== void 0 ? _b : 0;
    const scrollbarSize = measureScrollbarSize((_d = (_c = context.containerElement) === null || _c === void 0 ? void 0 : _c.ownerDocument) !== null && _d !== void 0 ? _d : null);
    const viewport = context.viewportCache.measure(context.containerElement, {
        width: context.options.canvasWidth,
        height: context.options.canvasHeight,
    }, scrollbarSize);
    const strategy = selectLayoutStrategy(context.options.layoutMode);
    if (strategy === 'fit') {
        return computeFitLayout(imageWidth, imageHeight, context.options.canvasWidth, context.options.canvasHeight, viewport);
    }
    if (strategy === 'cover') {
        return computeCoverLayout(imageWidth, imageHeight, context.options.canvasWidth, context.options.canvasHeight, viewport, scrollbarSize);
    }
    return computeExpandLayout(imageWidth, imageHeight, context.options.canvasWidth, context.options.canvasHeight, viewport);
}
function serializeCanvas(canvas) {
    canvas.discardActiveObject();
    const json = canvas.toJSON(SNAPSHOT_CUSTOM_KEYS);
    return JSON.stringify(json);
}
async function replayRollback(context, bundle) {
    try {
        await context.canvas.loadFromJSON(JSON.parse(bundle.canvasJson));
        context.canvas.renderAll();
    }
    catch (rollbackError) {
        console.warn('[ImageEditor] rollback: loadFromJSON failed', rollbackError);
    }
    context.setOriginalImage(bundle.originalImage);
    context.setIsImageLoadedToCanvas(bundle.isImageLoadedToCanvas);
    context.setLastSnapshot(bundle.lastSnapshot);
    context.setMaskCounter(bundle.maskCounter);
    context.setCurrentScale(bundle.currentScale);
    context.setCurrentRotation(bundle.currentRotation);
    context.setBaseImageScale(bundle.baseImageScale);
    context.setCurrentImageMimeType(bundle.currentImageMimeType);
    if (context.containerElement) {
        try {
            if (bundle.containerScrollTop !== null) {
                context.containerElement.scrollTop = bundle.containerScrollTop;
            }
            if (bundle.containerScrollLeft !== null) {
                context.containerElement.scrollLeft = bundle.containerScrollLeft;
            }
        }
        catch (rollbackError) {
            console.warn('[ImageEditor] rollback: scroll restore failed', rollbackError);
        }
    }
    if (bundle.placeholderHidden !== null) {
        context.setPlaceholderVisible(!bundle.placeholderHidden);
    }
}
//# sourceMappingURL=image-loader.js.map