import { isDangerousStateKey as isUnsafeObjectKey } from '../../plugin-kernel/plugin-identifier.js';
import { applyFilterDefinitions } from './fabric-filter-factory.js';
import { FilterBakeValidationError } from './filters-errors.js';
function abortError(message) {
    return new DOMException(message, 'AbortError');
}
function throwIfAborted(signal) {
    var _a;
    if (signal.aborted)
        throw (_a = signal.reason) !== null && _a !== void 0 ? _a : abortError('Filter rendering was aborted.');
}
export function disposeFabricImage(image) {
    if (!image)
        return;
    image.dispose();
}
export function copyBaseImagePresentation(source, target, options = {}) {
    var _a;
    target.set({
        left: source.left,
        top: source.top,
        scaleX: source.scaleX,
        scaleY: source.scaleY,
        angle: source.angle,
        skewX: source.skewX,
        skewY: source.skewY,
        flipX: source.flipX,
        flipY: source.flipY,
        originX: source.originX,
        originY: source.originY,
        opacity: source.opacity,
        visible: source.visible,
        selectable: options.transient ? false : source.selectable,
        evented: options.transient ? false : source.evented,
        hasControls: options.transient ? false : source.hasControls,
        hoverCursor: source.hoverCursor,
        excludeFromExport: source.excludeFromExport,
        backgroundColor: (_a = options.backgroundColor) !== null && _a !== void 0 ? _a : source.backgroundColor,
    });
    target.setCoords();
}
export async function createFilteredImageClone(fabric, baseImage, definitions, signal, backgroundColor) {
    throwIfAborted(signal);
    const clone = await baseImage.clone();
    try {
        throwIfAborted(signal);
        applyFilterDefinitions(fabric, clone, definitions);
        copyBaseImagePresentation(baseImage, clone, { backgroundColor, transient: true });
        throwIfAborted(signal);
        return clone;
    }
    catch (error) {
        disposeFabricImage(clone);
        throw error;
    }
}
export function normalizeFilterBakeOptions(options, sourceMimeType) {
    var _a;
    if (options !== undefined && (typeof options !== 'object' || options === null)) {
        throw new FilterBakeValidationError('Filter bake options must be an object.');
    }
    const record = (options !== null && options !== void 0 ? options : {});
    for (const key of Object.keys(record)) {
        if (isUnsafeObjectKey(key)) {
            throw new FilterBakeValidationError(`Filter bake options contain dangerous key "${key}".`);
        }
        if (key !== 'format' && key !== 'quality') {
            throw new FilterBakeValidationError(`Filter bake options contain unknown key "${key}".`);
        }
    }
    const sourceFormat = sourceMimeType === 'image/jpeg' ? 'jpeg' : sourceMimeType === 'image/webp' ? 'webp' : 'png';
    const format = (_a = record.format) !== null && _a !== void 0 ? _a : sourceFormat;
    if (format !== 'png' && format !== 'jpeg' && format !== 'webp') {
        throw new FilterBakeValidationError('Filter bake format must be png, jpeg, or webp.');
    }
    const quality = record.quality;
    if (quality !== undefined && (typeof quality !== 'number' || !Number.isFinite(quality))) {
        throw new FilterBakeValidationError('Filter bake quality must be finite.');
    }
    if (typeof quality === 'number' && (quality < 0 || quality > 1)) {
        throw new FilterBakeValidationError('Filter bake quality must be within [0, 1].');
    }
    return Object.freeze({
        format,
        quality: quality,
        mimeType: format === 'jpeg' ? 'image/jpeg' : `image/${format}`,
    });
}
function encodedBytes(dataUrl) {
    const commaIndex = dataUrl.indexOf(',');
    if (commaIndex < 0 || !/;base64$/i.test(dataUrl.slice(0, commaIndex))) {
        throw new FilterBakeValidationError('Filtered Raster output is not a base64 Data URL.');
    }
    const payload = dataUrl.slice(commaIndex + 1);
    const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0;
    return Math.floor((payload.length * 3) / 4) - padding;
}
async function decodeBakedImage(fabric, dataUrl, timeoutMs, signal) {
    var _a;
    const controller = new AbortController();
    const abort = () => controller.abort(signal.reason);
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted)
        abort();
    const timeout = setTimeout(() => controller.abort(new FilterBakeValidationError('Filtered Raster decode timed out.')), timeoutMs);
    try {
        return await fabric.FabricImage.fromURL(dataUrl, {
            crossOrigin: 'anonymous',
            signal: controller.signal,
        });
    }
    catch (error) {
        if (controller.signal.aborted)
            throw (_a = controller.signal.reason) !== null && _a !== void 0 ? _a : error;
        throw new FilterBakeValidationError('Filtered Raster decode failed.', error);
    }
    finally {
        clearTimeout(timeout);
        signal.removeEventListener('abort', abort);
    }
}
export async function renderBakedImage(fabric, baseImage, definitions, options, imageInfo, policy, signal) {
    var _a;
    const normalizedOptions = normalizeFilterBakeOptions(options, (_a = imageInfo === null || imageInfo === void 0 ? void 0 : imageInfo.mimeType) !== null && _a !== void 0 ? _a : null);
    const width = Number(baseImage.width);
    const height = Number(baseImage.height);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
        throw new FilterBakeValidationError('Base Image dimensions are invalid.');
    }
    if (width > policy.maxExportDimension ||
        height > policy.maxExportDimension ||
        width * height > Math.min(policy.maxInputPixels, policy.maxExportPixels)) {
        throw new FilterBakeValidationError('Filtered Raster dimensions exceed the Core policy.');
    }
    const clone = await createFilteredImageClone(fabric, baseImage, definitions, signal);
    let replacement = null;
    try {
        throwIfAborted(signal);
        const dataUrl = clone.toDataURL({
            format: normalizedOptions.format,
            quality: normalizedOptions.quality,
            multiplier: 1,
            withoutTransform: true,
            withoutShadow: true,
            enableRetinaScaling: false,
        });
        if (encodedBytes(dataUrl) > policy.maxInputBytes) {
            throw new FilterBakeValidationError('Filtered Raster exceeds the Core input budget.');
        }
        replacement = await decodeBakedImage(fabric, dataUrl, policy.imageLoadTimeoutMs, signal);
        throwIfAborted(signal);
        if (replacement.width !== width || replacement.height !== height) {
            throw new FilterBakeValidationError('Filtered Raster dimensions changed during decode.');
        }
        copyBaseImagePresentation(baseImage, replacement);
        return Object.freeze({ image: replacement, mimeType: normalizedOptions.mimeType });
    }
    catch (error) {
        disposeFabricImage(replacement);
        throw error;
    }
    finally {
        disposeFabricImage(clone);
    }
}
//# sourceMappingURL=filtered-image-renderer.js.map