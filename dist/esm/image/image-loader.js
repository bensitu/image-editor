import { reportError, reportWarning } from '../core/callback-reporter.js';
import { markBaseImageObject } from '../core/editor-object-kind.js';
import { ImageDecodeError } from '../core/errors.js';
import { loadFromState, saveState } from '../core/state-serializer.js';
import { isSupportedImageDataUrl } from '../utils/file.js';
import { startImageElementLoad } from '../utils/image-element-loader.js';
import { withTimeout } from '../utils/timeout.js';
import { computeCoverLayout, computeExpandLayout, computeFitLayout, selectLayoutStrategy, applyCanvasDimensions, measureScrollbarSize, } from './layout-manager.js';
import { computeDownsampleDimensions, detectSourceMimeType, resampleImage, } from './image-resampler.js';
export async function loadImage(context, imageBase64, loadOptions = {}) {
    if (!isSupportedImageDataUrl(imageBase64))
        return;
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
        isImageLoadedToCanvas: context.getIsImageLoadedToCanvas(),
        lastSnapshot: context.getLastSnapshot(),
        stateJson: captureRollbackState(context),
        maskCounter: context.getMaskCounter(),
        annotationCounter: context.getAnnotationCounter(),
        currentScale: context.getCurrentScale(),
        currentRotation: context.getCurrentRotation(),
        baseImageScale: context.getBaseImageScale(),
        currentImageMimeType: context.getCurrentImageMimeType(),
    };
    try {
        const loadDeadline = Date.now() + context.options.imageLoadTimeoutMs;
        context.setPlaceholderVisible(false);
        const decode = startImageDecode(imageBase64);
        let imageElement;
        try {
            imageElement = await withTimeout(decode.promise, getRemainingLoadTimeout(loadDeadline), 'image decode');
        }
        catch (error) {
            decode.cleanup(true);
            throw error;
        }
        const loadSource = maybeDownsample(imageElement, imageBase64, context.options, getCanvasDocument(context.canvas));
        const fabricAbort = createAbortController();
        const fabricCrossOrigin = 'anonymous';
        const fabricLoadOptions = fabricAbort
            ? { crossOrigin: fabricCrossOrigin, signal: fabricAbort.signal }
            : { crossOrigin: fabricCrossOrigin };
        const fabricImage = await withTimeout(context.fabric.FabricImage.fromURL(loadSource.dataUrl, fabricLoadOptions), getRemainingLoadTimeout(loadDeadline), 'FabricImage.fromURL', () => {
            fabricAbort === null || fabricAbort === void 0 ? void 0 : fabricAbort.abort();
        });
        context.canvas.discardActiveObject();
        context.canvas.clear();
        context.canvas.backgroundColor = context.options.backgroundColor;
        const baseImage = markBaseImageObject(fabricImage);
        baseImage.set({
            originX: 'left',
            originY: 'top',
            selectable: false,
            evented: false,
        });
        const layout = computeLayout(context, baseImage);
        applyCanvasDimensions(context.canvas, layout.canvasWidth, layout.canvasHeight, context.containerElement);
        baseImage.set({ left: layout.imageLeft, top: layout.imageTop });
        baseImage.scale(layout.imageScale);
        context.canvas.add(baseImage);
        context.canvas.sendObjectToBack(baseImage);
        context.setOriginalImage(baseImage);
        context.setBaseImageScale(layout.baseImageScale);
        context.setCurrentScale(1);
        context.setCurrentRotation(0);
        context.setMaskCounter(0);
        context.setAnnotationCounter(0);
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
    return startImageElementLoad(dataUrl, {
        validate: (imageElement) => hasNaturalImageDimensions(imageElement)
            ? null
            : new ImageDecodeError('Failed to decode image data URL: image has no natural dimensions.', null),
        createError: (event) => new ImageDecodeError('Failed to decode image data URL.', event),
    });
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
function maybeDownsample(imageElement, originalDataUrl, options, ownerDocument) {
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
    const resampledImage = resampleImage(imageElement, options.downsampleMaxWidth, options.downsampleMaxHeight, sourceMime, options.preserveSourceFormat, options.downsampleMimeType, options.downsampleQuality, ownerDocument);
    const actualMimeType = toSupportedImageMimeType(detectSourceMimeType(resampledImage.dataUrl));
    return {
        dataUrl: resampledImage.dataUrl,
        mimeType: actualMimeType !== null && actualMimeType !== void 0 ? actualMimeType : resampledImage.mimeType,
    };
}
function getCanvasDocument(canvas) {
    var _a, _b, _c, _d;
    const canvasLike = canvas;
    return (_c = (_b = (_a = canvasLike.getElement) === null || _a === void 0 ? void 0 : _a.call(canvasLike)) === null || _b === void 0 ? void 0 : _b.ownerDocument) !== null && _c !== void 0 ? _c : (_d = canvasLike.lowerCanvasEl) === null || _d === void 0 ? void 0 : _d.ownerDocument;
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
    return computeExpandLayout(imageWidth, imageHeight, viewport);
}
function captureRollbackState(context) {
    return saveState({
        canvas: context.canvas,
        currentScale: context.getCurrentScale(),
        currentRotation: context.getCurrentRotation(),
        baseImageScale: context.getBaseImageScale(),
        currentImageMimeType: context.getCurrentImageMimeType(),
    });
}
function getRemainingLoadTimeout(deadline) {
    return Math.max(1, deadline - Date.now());
}
function createAbortController() {
    return typeof AbortController === 'function' ? new AbortController() : null;
}
async function replayRollback(context, bundle) {
    try {
        const restoredState = await loadFromState({
            canvas: context.canvas,
            jsonString: bundle.stateJson,
            setCanvasSize: (width, height) => {
                context.setCanvasSize(width, height);
            },
            maxCanvasPixels: context.options.maxExportPixels,
        });
        context.applyRollbackRestoredState(restoredState);
        context.setOriginalImage(restoredState.originalImage);
        context.setIsImageLoadedToCanvas(bundle.isImageLoadedToCanvas && restoredState.originalImage !== null);
        context.setLastSnapshot(bundle.lastSnapshot);
        context.setMaskCounter(Math.max(bundle.maskCounter, restoredState.maxMaskId));
        context.setAnnotationCounter(Math.max(bundle.annotationCounter, restoredState.maxAnnotationId));
        context.setCurrentScale(bundle.currentScale);
        context.setCurrentRotation(bundle.currentRotation);
        context.setBaseImageScale(bundle.baseImageScale);
        context.setCurrentImageMimeType(bundle.currentImageMimeType);
        context.canvas.renderAll();
    }
    catch (rollbackError) {
        reportWarning(context.options, rollbackError, 'loadImage rollback failed while restoring the previous canvas state; editor state was cleared.');
        context.resetAfterRollbackFailure();
    }
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