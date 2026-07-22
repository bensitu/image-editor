import { settleAbortable } from '../../utils/abortable-promise.js';
import { hasErrorName } from '../../utils/error.js';
import { isPixelAreaWithinBudget } from '../../utils/image-budget.js';
import { CropValidationError } from './crop-errors.js';
function isRecord(value) {
    if (typeof value !== 'object' || value === null || Array.isArray(value))
        return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}
export function normalizeCropApplyOptions(value, sourceMimeType) {
    var _a;
    if (value !== undefined && !isRecord(value)) {
        throw new CropValidationError('Crop apply options must be an object.');
    }
    const record = (value !== null && value !== void 0 ? value : {});
    const allowedKeys = new Set(['format', 'quality', 'bakeVisibleFilters']);
    if (Object.keys(record).some((key) => !allowedKeys.has(key))) {
        throw new CropValidationError('Crop apply options contain unknown keys.');
    }
    const sourceFormat = sourceMimeType === 'image/jpeg' ? 'jpeg' : sourceMimeType === 'image/webp' ? 'webp' : 'png';
    const format = (_a = record.format) !== null && _a !== void 0 ? _a : sourceFormat;
    if (format !== 'png' && format !== 'jpeg' && format !== 'webp') {
        throw new CropValidationError('Crop output format must be png, jpeg, or webp.');
    }
    const quality = record.quality;
    if (quality !== undefined &&
        (typeof quality !== 'number' || !Number.isFinite(quality) || quality < 0 || quality > 1)) {
        throw new CropValidationError('Crop output quality must be within [0, 1].');
    }
    if (record.bakeVisibleFilters !== undefined && typeof record.bakeVisibleFilters !== 'boolean') {
        throw new CropValidationError('bakeVisibleFilters must be a boolean.');
    }
    return Object.freeze({
        format,
        quality: format === 'png' ? undefined : quality,
        mimeType: format === 'jpeg' ? 'image/jpeg' : `image/${format}`,
        bakeVisibleFilters: record.bakeVisibleFilters !== false,
    });
}
function encodedBytes(dataUrl, expectedMimeType) {
    const commaIndex = dataUrl.indexOf(',');
    if (commaIndex < 0 || !/;base64$/i.test(dataUrl.slice(0, commaIndex))) {
        throw new CropValidationError('Crop output is not a base64 Data URL.');
    }
    const mimeType = dataUrl.slice(5, dataUrl.indexOf(';'));
    if (mimeType !== expectedMimeType) {
        throw new CropValidationError(`Crop encoder returned ${mimeType || 'an unknown MIME'} instead of ${expectedMimeType}.`);
    }
    const payload = dataUrl.slice(commaIndex + 1);
    const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0;
    return Math.floor((payload.length * 3) / 4) - padding;
}
async function decodeCropImage(fabric, dataUrl, timeoutMs, signal) {
    var _a;
    const controller = new AbortController();
    const abort = () => controller.abort(signal.reason);
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted)
        abort();
    const timeout = setTimeout(() => controller.abort(new CropValidationError('Crop decode timed out.')), timeoutMs);
    try {
        return await settleAbortable(fabric.FabricImage.fromURL(dataUrl, {
            crossOrigin: 'anonymous',
            signal: controller.signal,
        }), controller.signal, (lateImage) => lateImage.dispose());
    }
    catch (error) {
        if (controller.signal.aborted)
            throw (_a = controller.signal.reason) !== null && _a !== void 0 ? _a : error;
        void error;
        throw new CropValidationError('Crop decode failed.');
    }
    finally {
        clearTimeout(timeout);
        signal.removeEventListener('abort', abort);
    }
}
function applyCropPresentation(source, target, rect) {
    const matrix = source.calcTransformMatrix();
    const offsetX = rect.leftPx + rect.widthPx / 2 - Number(source.width) / 2;
    const offsetY = rect.topPx + rect.heightPx / 2 - Number(source.height) / 2;
    const centerX = matrix[0] * offsetX + matrix[2] * offsetY + matrix[4];
    const centerY = matrix[1] * offsetX + matrix[3] * offsetY + matrix[5];
    target.set({
        left: centerX,
        top: centerY,
        originX: 'center',
        originY: 'center',
        scaleX: source.scaleX,
        scaleY: source.scaleY,
        angle: source.angle,
        skewX: source.skewX,
        skewY: source.skewY,
        flipX: source.flipX,
        flipY: source.flipY,
        opacity: source.opacity,
        visible: source.visible,
        selectable: false,
        evented: false,
        hasControls: false,
        hoverCursor: source.hoverCursor,
        excludeFromExport: source.excludeFromExport,
        backgroundColor: source.backgroundColor,
    });
    target.setCoords();
}
export async function renderCropImage(host, source, rect, options, signal) {
    var _a, _b;
    if (signal.aborted)
        throw signal.reason;
    const policy = host.getImageResourcePolicy();
    const pixelBudget = Math.min(policy.maxInputPixels, policy.maxExportPixels);
    if (rect.widthPx > policy.maxExportDimension ||
        rect.heightPx > policy.maxExportDimension ||
        !isPixelAreaWithinBudget(rect.widthPx, rect.heightPx, pixelBudget)) {
        throw new CropValidationError('Crop dimensions exceed the Core resource policy.');
    }
    const ownerDocument = (_a = source.getElement().ownerDocument) !== null && _a !== void 0 ? _a : globalThis.document;
    if (!ownerDocument)
        throw new CropValidationError('Crop rendering document is unavailable.');
    const surface = ownerDocument.createElement('canvas');
    surface.width = rect.widthPx;
    surface.height = rect.heightPx;
    const context = surface.getContext('2d');
    if (!context)
        throw new CropValidationError('Crop rendering context is unavailable.');
    let dataUrl;
    try {
        context.drawImage(source.getElement(), rect.leftPx, rect.topPx, rect.widthPx, rect.heightPx, 0, 0, rect.widthPx, rect.heightPx);
        if (signal.aborted)
            throw signal.reason;
        dataUrl = surface.toDataURL(options.mimeType, options.format === 'png' ? undefined : options.quality);
    }
    catch (error) {
        if (signal.aborted)
            throw (_b = signal.reason) !== null && _b !== void 0 ? _b : error;
        if (hasErrorName(error, 'SecurityError')) {
            throw new CropValidationError('Crop pixels cannot be exported because canvas access is blocked.');
        }
        throw error;
    }
    if (encodedBytes(dataUrl, options.mimeType) > policy.maxInputBytes) {
        throw new CropValidationError('Crop output exceeds the Core input budget.');
    }
    const image = await decodeCropImage(host.fabric, dataUrl, policy.imageLoadTimeoutMs, signal);
    try {
        if (image.width !== rect.widthPx || image.height !== rect.heightPx) {
            throw new CropValidationError('Crop dimensions changed during decode.');
        }
        applyCropPresentation(source, image, rect);
        return Object.freeze({ image, mimeType: options.mimeType });
    }
    catch (error) {
        image.dispose();
        throw error;
    }
}
//# sourceMappingURL=crop-renderer.js.map