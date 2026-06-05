import { isMaskObject } from '../core/public-types.js';
import { reportError } from '../core/callback-reporter.js';
import { ExportError, ExportNotReadyError, MergeMasksError } from '../core/errors.js';
import { Command } from '../history/history-manager.js';
import { withMaskStyleBackup } from '../mask/mask-style.js';
import { getClampedCanvasRegion, getObjectBBox, getPartialExportEdges, hasMeaningfulCanvasRegion, } from '../utils/canvas-region.js';
import { resolveExportFormat } from './export-format.js';
function resolveMultiplier(requested, fallback) {
    const num = Number(requested);
    if (Number.isFinite(num) && num > 0)
        return num;
    const fallbackValue = Number(fallback);
    return Number.isFinite(fallbackValue) && fallbackValue > 0 ? fallbackValue : 1;
}
function resolveExportArea(requested, fallback) {
    if (requested === 'canvas' || requested === 'image')
        return requested;
    return fallback === 'canvas' ? 'canvas' : 'image';
}
function resolveExportOptions(context, options) {
    const providedOptions = options !== null && options !== void 0 ? options : {};
    return {
        exportArea: resolveExportArea(providedOptions.exportArea, context.options.exportAreaByDefault),
        mergeMask: typeof providedOptions.mergeMask === 'boolean'
            ? providedOptions.mergeMask
            : context.options.mergeMaskByDefault,
        multiplier: resolveMultiplier(providedOptions.multiplier, context.options.exportMultiplier),
        format: resolveExportFormat(providedOptions, context.options.downsampleQuality),
    };
}
function readCanvasDimension(canvas, getterName, propertyName) {
    const canvasLike = canvas;
    const getter = canvasLike[getterName];
    const value = typeof getter === 'function' ? getter.call(canvasLike) : canvasLike[propertyName];
    return Math.max(1, Math.ceil(Number.isFinite(value) ? Number(value) : 1));
}
function assertExportPixelBudget(context, multiplier, region) {
    var _a, _b;
    const sourceWidth = (_a = region === null || region === void 0 ? void 0 : region.width) !== null && _a !== void 0 ? _a : readCanvasDimension(context.canvas, 'getWidth', 'width');
    const sourceHeight = (_b = region === null || region === void 0 ? void 0 : region.height) !== null && _b !== void 0 ? _b : readCanvasDimension(context.canvas, 'getHeight', 'height');
    const outputWidth = Math.max(1, Math.ceil(sourceWidth * multiplier));
    const outputHeight = Math.max(1, Math.ceil(sourceHeight * multiplier));
    const pixelCount = outputWidth * outputHeight;
    const maxPixels = context.options.maxExportPixels;
    if (!Number.isFinite(pixelCount) || pixelCount > maxPixels) {
        throw new RangeError(`[ImageEditor] Export size ${outputWidth}x${outputHeight} ` +
            `(${pixelCount} pixels) exceeds maxExportPixels (${maxPixels}).`);
    }
}
function computeExportRegion(context, exportArea) {
    if (exportArea === 'canvas')
        return { region: null, partialEdges: null };
    const originalImage = context.getOriginalImage();
    if (!originalImage)
        return { region: null, partialEdges: null };
    const bounds = getObjectBBox(originalImage);
    const canvasLike = context.canvas;
    const canvasWidth = typeof canvasLike.getWidth === 'function' ? canvasLike.getWidth() : canvasLike.width;
    const canvasHeight = typeof canvasLike.getHeight === 'function' ? canvasLike.getHeight() : canvasLike.height;
    if (!hasMeaningfulCanvasRegion(bounds, canvasWidth, canvasHeight)) {
        throw new ExportError('exportImageBase64 failed: image export region is empty.');
    }
    return {
        region: getClampedCanvasRegion(bounds, canvasWidth, canvasHeight, {
            includePartialPixels: true,
        }),
        partialEdges: getPartialExportEdges(bounds, Number(originalImage.angle) || 0),
    };
}
async function withMaskExportState(context, mergeMask, callback) {
    if (!mergeMask)
        return withMasksHidden(context, callback);
    return withMaskStyleBackup({ canvas: context.canvas, options: context.options }, applyExportBakeInStyle, callback);
}
async function withMasksHidden(context, callback) {
    const backups = getCanvasObjects(context.canvas)
        .filter(isMaskObject)
        .map((mask) => ({
        mask,
        visible: mask.visible,
    }));
    for (const backup of backups) {
        try {
            if (typeof backup.mask.set === 'function') {
                backup.mask.set({ visible: false });
            }
            else {
                backup.mask.visible = false;
            }
        }
        catch {
        }
    }
    try {
        return await callback();
    }
    finally {
        for (const backup of backups) {
            try {
                if (typeof backup.mask.set === 'function') {
                    backup.mask.set({ visible: backup.visible });
                }
                else {
                    backup.mask.visible = backup.visible;
                }
            }
            catch {
            }
        }
    }
}
function getCanvasObjects(canvas) {
    try {
        return canvas.getObjects();
    }
    catch {
        return [];
    }
}
function isObjectOnCanvas(canvas, object) {
    return getCanvasObjects(canvas).includes(object);
}
function captureMaskLabelBackups(canvas) {
    const backups = [];
    for (const object of getCanvasObjects(canvas)) {
        if (!isMaskObject(object))
            continue;
        const label = object.labelObject;
        if (!label)
            continue;
        const wasOnCanvas = isObjectOnCanvas(canvas, label);
        backups.push({
            mask: object,
            label,
            wasOnCanvas,
            visible: label.visible,
        });
        try {
            if (typeof label.set === 'function')
                label.set({ visible: false });
            if (wasOnCanvas)
                canvas.remove(label);
        }
        catch {
        }
    }
    return backups;
}
function restoreMaskLabelBackups(canvas, backups) {
    for (const backup of backups) {
        try {
            backup.mask.labelObject = backup.label;
            if (typeof backup.label.set === 'function') {
                backup.label.set({ visible: backup.visible });
            }
            else {
                backup.label.visible = backup.visible;
            }
            if (backup.wasOnCanvas && !isObjectOnCanvas(canvas, backup.label)) {
                canvas.add(backup.label);
                canvas.bringObjectToFront(backup.label);
            }
        }
        catch {
        }
    }
}
function captureActiveObject(canvas) {
    var _a;
    try {
        const canvasWithSelection = canvas;
        if (typeof canvasWithSelection.getActiveObject !== 'function')
            return null;
        return (_a = canvasWithSelection.getActiveObject()) !== null && _a !== void 0 ? _a : null;
    }
    catch {
        return null;
    }
}
function restoreActiveObject(canvas, activeObject) {
    if (!activeObject)
        return;
    try {
        const canvasWithSelection = canvas;
        if (typeof canvasWithSelection.setActiveObject === 'function') {
            canvasWithSelection.setActiveObject(activeObject);
        }
    }
    catch {
    }
}
function requestRender(canvas) {
    try {
        if (typeof canvas.requestRenderAll === 'function') {
            canvas.requestRenderAll();
        }
        else {
            canvas.renderAll();
        }
    }
    catch {
    }
}
function applyExportBakeInStyle(mask) {
    try {
        mask.set({
            opacity: 1,
            fill: '#000',
            strokeWidth: 0,
            stroke: null,
            selectable: false,
        });
        if (typeof mask.setCoords === 'function')
            mask.setCoords();
    }
    catch {
    }
}
function renderCanvasToDataUrl(canvas, format, quality, multiplier, region) {
    const fabricOptions = {
        format,
        multiplier,
    };
    if (quality !== undefined)
        fabricOptions.quality = quality;
    if (region) {
        fabricOptions.left = region.left;
        fabricOptions.top = region.top;
        fabricOptions.width = region.width;
        fabricOptions.height = region.height;
    }
    return canvas.toDataURL(fabricOptions);
}
function hasPartialEdges(edges) {
    return !!edges && (edges.left || edges.top || edges.right || edges.bottom);
}
function getImageDimensions(imageElement) {
    return {
        width: Math.max(1, imageElement.naturalWidth || imageElement.width || 1),
        height: Math.max(1, imageElement.naturalHeight || imageElement.height || 1),
    };
}
function loadImageElement(dataUrl) {
    return new Promise((resolve, reject) => {
        const imageElement = new Image();
        imageElement.crossOrigin = 'anonymous';
        const cleanup = () => {
            if (typeof imageElement.removeEventListener === 'function') {
                imageElement.removeEventListener('load', handleLoad);
                imageElement.removeEventListener('error', handleError);
            }
            else {
                imageElement.onload = null;
                imageElement.onerror = null;
            }
        };
        const handleLoad = () => {
            cleanup();
            resolve(imageElement);
        };
        const handleError = () => {
            cleanup();
            reject(new Error('Failed to decode export data URL'));
        };
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
}
async function sealPartialTransparentEdges(dataUrl, edges) {
    if (!hasPartialEdges(edges))
        return dataUrl;
    const imageElement = await loadImageElement(dataUrl);
    const { width, height } = getImageDimensions(imageElement);
    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = width;
    offscreenCanvas.height = height;
    const canvasContext = offscreenCanvas.getContext('2d');
    if (!canvasContext)
        throw new Error('2D canvas context is unavailable');
    canvasContext.drawImage(imageElement, 0, 0, width, height);
    const imageData = canvasContext.getImageData(0, 0, width, height);
    const pixels = imageData.data;
    const sealPixel = (x, y, fallbackX, fallbackY) => {
        var _a, _b, _c, _d, _e, _f;
        const index = (y * width + x) * 4;
        const fallbackIndex = (fallbackY * width + fallbackX) * 4;
        const alpha = (_a = pixels[index + 3]) !== null && _a !== void 0 ? _a : 0;
        const fallbackAlpha = (_b = pixels[fallbackIndex + 3]) !== null && _b !== void 0 ? _b : 0;
        if (alpha === 0 && fallbackAlpha > 0) {
            pixels[index] = (_c = pixels[fallbackIndex]) !== null && _c !== void 0 ? _c : 0;
            pixels[index + 1] = (_d = pixels[fallbackIndex + 1]) !== null && _d !== void 0 ? _d : 0;
            pixels[index + 2] = (_e = pixels[fallbackIndex + 2]) !== null && _e !== void 0 ? _e : 0;
            pixels[index + 3] = fallbackAlpha;
        }
        const nextAlpha = (_f = pixels[index + 3]) !== null && _f !== void 0 ? _f : 0;
        if (nextAlpha > 0 && nextAlpha < 255) {
            pixels[index + 3] = 255;
        }
    };
    if ((edges === null || edges === void 0 ? void 0 : edges.left) && width > 1) {
        for (let y = 0; y < height; y += 1)
            sealPixel(0, y, 1, y);
    }
    if ((edges === null || edges === void 0 ? void 0 : edges.right) && width > 1) {
        for (let y = 0; y < height; y += 1)
            sealPixel(width - 1, y, width - 2, y);
    }
    if ((edges === null || edges === void 0 ? void 0 : edges.top) && height > 1) {
        for (let x = 0; x < width; x += 1)
            sealPixel(x, 0, x, 1);
    }
    if ((edges === null || edges === void 0 ? void 0 : edges.bottom) && height > 1) {
        for (let x = 0; x < width; x += 1)
            sealPixel(x, height - 1, x, height - 2);
    }
    canvasContext.putImageData(imageData, 0, 0);
    return offscreenCanvas.toDataURL('image/png');
}
function getJpegBackgroundColor(backgroundColor) {
    return resolveCanvasFillStyle(backgroundColor);
}
function resolveCanvasFillStyle(backgroundColor, fallback = '#ffffff') {
    const value = String(backgroundColor !== null && backgroundColor !== void 0 ? backgroundColor : '').trim();
    if (!value || isTransparentCssColor(value))
        return '#ffffff';
    const context = createColorValidationContext();
    if (!context)
        return fallback;
    context.fillStyle = '#000001';
    const firstSentinel = context.fillStyle;
    context.fillStyle = value;
    const firstResolved = context.fillStyle;
    if (firstResolved !== firstSentinel)
        return firstResolved;
    context.fillStyle = '#000002';
    const secondSentinel = context.fillStyle;
    context.fillStyle = value;
    const secondResolved = context.fillStyle;
    if (secondResolved !== secondSentinel)
        return secondResolved;
    return fallback;
}
function createColorValidationContext() {
    try {
        if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
            return null;
        }
        return document.createElement('canvas').getContext('2d');
    }
    catch {
        return null;
    }
}
function isTransparentCssColor(value) {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'transparent')
        return true;
    const hex = normalized.match(/^#([0-9a-f]{4}|[0-9a-f]{8})$/i);
    if (hex) {
        const digits = hex[1];
        const alpha = digits.length === 4 ? digits[3] : digits.slice(6, 8);
        return /^0+$/.test(alpha);
    }
    const commaAlpha = normalized.match(/^(?:rgba|hsla)\((.*),\s*([^,/)]+)\)$/i);
    if (commaAlpha && isZeroCssAlpha(commaAlpha[2]))
        return true;
    const slashAlpha = normalized.match(/^[a-z][a-z0-9-]*\([^/]+\/\s*([^)]+)\)$/i);
    if (slashAlpha && isZeroCssAlpha(slashAlpha[1]))
        return true;
    return false;
}
function isZeroCssAlpha(value) {
    const alpha = value.trim();
    if (alpha.endsWith('%')) {
        const numericPercent = Number.parseFloat(alpha.slice(0, -1));
        return Number.isFinite(numericPercent) && numericPercent === 0;
    }
    const numericAlpha = Number.parseFloat(alpha);
    return Number.isFinite(numericAlpha) && numericAlpha === 0;
}
async function convertDataUrlToOpaqueJpeg(dataUrl, backgroundColor, quality) {
    const imageElement = await loadImageElement(dataUrl);
    const { width, height } = getImageDimensions(imageElement);
    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = width;
    offscreenCanvas.height = height;
    const canvasContext = offscreenCanvas.getContext('2d');
    if (!canvasContext)
        throw new Error('2D canvas context is unavailable');
    canvasContext.fillStyle = getJpegBackgroundColor(backgroundColor);
    canvasContext.fillRect(0, 0, width, height);
    canvasContext.drawImage(imageElement, 0, 0, width, height);
    return offscreenCanvas.toDataURL('image/jpeg', quality);
}
function dataUrlToBytes(dataUrl) {
    var _a;
    const match = /^data:image\/[a-z0-9.+-]+;base64,([A-Za-z0-9+/=\s]+)$/i.exec(dataUrl);
    if (!match || !((_a = match[1]) === null || _a === void 0 ? void 0 : _a.trim())) {
        throw new Error('exportImageFile received a malformed or empty image data URL.');
    }
    const commaAt = dataUrl.indexOf(',');
    const base64 = dataUrl.slice(commaAt + 1).replace(/\s/g, '');
    if (typeof globalThis.atob === 'function') {
        const binary = globalThis.atob(base64);
        const buffer = new ArrayBuffer(binary.length);
        const bytes = new Uint8Array(buffer);
        for (let i = binary.length - 1; i >= 0; i -= 1) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    }
    const bufferCtor = globalThis.Buffer;
    if (bufferCtor && typeof bufferCtor.from === 'function') {
        const source = bufferCtor.from(base64, 'base64');
        const buffer = new ArrayBuffer(source.length);
        const bytes = new Uint8Array(buffer);
        bytes.set(source);
        return bytes;
    }
    throw new Error('No base64 decoder is available for exportImageFile.');
}
async function reencodeDataUrlAs(sourceDataUrl, target, backgroundColor) {
    if (sourceDataUrl.startsWith(`data:${target.mimeType}`)) {
        return sourceDataUrl;
    }
    const imageElement = await loadImageElement(sourceDataUrl);
    const { width, height } = getImageDimensions(imageElement);
    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = width;
    offscreenCanvas.height = height;
    const canvasContext = offscreenCanvas.getContext('2d');
    if (!canvasContext) {
        throw new Error('Unable to acquire 2D context for export conversion');
    }
    if (target.format === 'jpeg') {
        canvasContext.fillStyle = getJpegBackgroundColor(backgroundColor);
        canvasContext.fillRect(0, 0, width, height);
    }
    canvasContext.drawImage(imageElement, 0, 0, width, height);
    return offscreenCanvas.toDataURL(target.mimeType, target.quality);
}
function warnNoImageLoaded(operation) {
    console.warn(`[ImageEditor] ${operation} skipped: no image is loaded on the canvas.`);
}
export async function exportImageBase64(context, options) {
    if (!context.isImageLoaded()) {
        warnNoImageLoaded('exportImageBase64');
        return '';
    }
    const activeObject = captureActiveObject(context.canvas);
    const labelBackups = captureMaskLabelBackups(context.canvas);
    try {
        context.canvas.discardActiveObject();
        const resolved = resolveExportOptions(context, options);
        const { region, partialEdges } = computeExportRegion(context, resolved.exportArea);
        assertExportPixelBudget(context, resolved.multiplier, region);
        const renderFormat = region && resolved.format.format === 'jpeg' ? 'png' : resolved.format.format;
        const renderQuality = renderFormat === 'png' ? undefined : resolved.format.quality;
        let dataUrl = await withMaskExportState(context, resolved.mergeMask, async () => renderCanvasToDataUrl(context.canvas, renderFormat, renderQuality, resolved.multiplier, region));
        if (region) {
            dataUrl = await sealPartialTransparentEdges(dataUrl, partialEdges);
            if (resolved.format.format === 'jpeg') {
                dataUrl = await convertDataUrlToOpaqueJpeg(dataUrl, context.options.backgroundColor, resolved.format.quality);
            }
        }
        return dataUrl;
    }
    finally {
        restoreMaskLabelBackups(context.canvas, labelBackups);
        restoreActiveObject(context.canvas, activeObject);
        requestRender(context.canvas);
    }
}
export async function exportImageFile(context, options) {
    var _a;
    if (!context.isImageLoaded()) {
        warnNoImageLoaded('exportImageFile');
        throw new ExportNotReadyError('exportImageFile');
    }
    const providedOptions = options !== null && options !== void 0 ? options : {};
    const fileName = (_a = providedOptions.fileName) !== null && _a !== void 0 ? _a : context.options.defaultDownloadFileName;
    const resolved = resolveExportFormat(providedOptions, context.options.downsampleQuality);
    const base64 = await exportImageBase64(context, {
        exportArea: providedOptions.exportArea,
        mergeMask: providedOptions.mergeMask,
        multiplier: providedOptions.multiplier,
        quality: providedOptions.quality,
        fileType: providedOptions.fileType,
    });
    if (!base64) {
        throw new ExportNotReadyError('exportImageFile');
    }
    const finalDataUrl = await reencodeDataUrlAs(base64, resolved, context.options.backgroundColor);
    let bytes;
    try {
        bytes = dataUrlToBytes(finalDataUrl);
    }
    catch (error) {
        throw new ExportError('exportImageFile failed to decode rendered data URL.', error);
    }
    return new File([bytes], fileName, { type: resolved.mimeType });
}
export function downloadImage(context, fileName) {
    if (!context.isImageLoaded()) {
        warnNoImageLoaded('downloadImage');
        return;
    }
    const resolvedFileName = fileName !== null && fileName !== void 0 ? fileName : context.options.defaultDownloadFileName;
    void exportImageBase64(context, {
        exportArea: context.options.exportAreaByDefault,
        mergeMask: context.options.mergeMaskByDefault,
        multiplier: context.options.exportMultiplier,
    })
        .then((dataUrl) => {
        if (!dataUrl)
            return;
        const link = document.createElement('a');
        link.download = resolvedFileName;
        link.href = dataUrl;
        document.body.appendChild(link);
        try {
            link.click();
        }
        finally {
            document.body.removeChild(link);
        }
    })
        .catch((error) => {
        reportError(context.options, error, 'downloadImage failed.');
        console.error('[ImageEditor] downloadImage failed', error);
    });
}
export async function mergeMasks(context) {
    if (!context.isImageLoaded())
        return;
    const masks = context.canvas
        .getObjects()
        .filter((o) => 'maskId' in o && typeof o.maskId === 'number');
    if (masks.length === 0)
        return;
    const beforeSnapshot = context.saveState();
    context.canvas.discardActiveObject();
    context.canvas.renderAll();
    const preScrollTop = context.containerElement ? context.containerElement.scrollTop : null;
    const preScrollLeft = context.containerElement ? context.containerElement.scrollLeft : null;
    try {
        const merged = await exportImageBase64(context, {
            exportArea: 'image',
            mergeMask: true,
            multiplier: context.options.exportMultiplier,
            fileType: 'png',
        });
        if (!merged) {
            throw new MergeMasksError('mergeMasks: exportImageBase64 returned an empty data URL.');
        }
        context.removeAllMasksNoHistory();
        await context.loadImage(merged, { preserveScroll: true });
        const afterSnapshot = context.saveState();
        if (context.containerElement) {
            try {
                if (preScrollTop !== null) {
                    context.containerElement.scrollTop = preScrollTop;
                }
                if (preScrollLeft !== null) {
                    context.containerElement.scrollLeft = preScrollLeft;
                }
            }
            catch (scrollError) {
                console.warn('[ImageEditor] mergeMasks: scroll restore failed', scrollError);
            }
        }
        if (beforeSnapshot && afterSnapshot && beforeSnapshot !== afterSnapshot) {
            context.historyManager.push(new Command(() => context.loadFromState(afterSnapshot), () => context.loadFromState(beforeSnapshot)));
        }
    }
    catch (error) {
        try {
            await context.loadFromState(beforeSnapshot);
        }
        catch (rollbackError) {
            console.warn('[ImageEditor] mergeMasks: rollback failed', rollbackError);
        }
        if (error instanceof MergeMasksError)
            throw error;
        const message = error instanceof Error ? `mergeMasks failed: ${error.message}` : 'mergeMasks failed';
        throw new MergeMasksError(message, error);
    }
}
//# sourceMappingURL=export-service.js.map