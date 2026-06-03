import { isMaskObject } from '../core/public-types.js';
import { ExportNotReadyError, MergeMasksError } from '../core/errors.js';
import { Command } from '../history/history-manager.js';
import { withMaskStyleBackup } from '../mask/mask-style.js';
import { getClampedCanvasRegion, getObjectBBox, getPartialExportEdges, } from '../utils/canvas-region.js';
import { resolveExportFormat } from './export-format.js';
function resolveMultiplier(requested, fallback) {
    const num = Number(requested);
    if (Number.isFinite(num) && num > 0)
        return num;
    const fb = Number(fallback);
    return Number.isFinite(fb) && fb > 0 ? fb : 1;
}
function resolveExportArea(requested, fallback) {
    if (requested === 'canvas' || requested === 'image')
        return requested;
    return fallback === 'canvas' ? 'canvas' : 'image';
}
function resolveExportOptions(ctx, options) {
    const opts = options !== null && options !== void 0 ? options : {};
    return {
        exportArea: resolveExportArea(opts.exportArea, ctx.options.exportAreaByDefault),
        mergeMask: typeof opts.mergeMask === 'boolean' ? opts.mergeMask : ctx.options.mergeMaskByDefault,
        multiplier: resolveMultiplier(opts.multiplier, ctx.options.exportMultiplier),
        format: resolveExportFormat(opts, ctx.options.downsampleQuality),
    };
}
function readCanvasDimension(canvas, getterName, propertyName) {
    const canvasLike = canvas;
    const getter = canvasLike[getterName];
    const value = typeof getter === 'function' ? getter.call(canvasLike) : canvasLike[propertyName];
    return Math.max(1, Math.ceil(Number.isFinite(value) ? Number(value) : 1));
}
function assertExportPixelBudget(ctx, multiplier, region) {
    var _a, _b;
    const sourceWidth = (_a = region === null || region === void 0 ? void 0 : region.width) !== null && _a !== void 0 ? _a : readCanvasDimension(ctx.canvas, 'getWidth', 'width');
    const sourceHeight = (_b = region === null || region === void 0 ? void 0 : region.height) !== null && _b !== void 0 ? _b : readCanvasDimension(ctx.canvas, 'getHeight', 'height');
    const outputWidth = Math.max(1, Math.ceil(sourceWidth * multiplier));
    const outputHeight = Math.max(1, Math.ceil(sourceHeight * multiplier));
    const pixelCount = outputWidth * outputHeight;
    const maxPixels = ctx.options.maxExportPixels;
    if (!Number.isFinite(pixelCount) || pixelCount > maxPixels) {
        throw new RangeError(`[ImageEditor] Export size ${outputWidth}x${outputHeight} ` +
            `(${pixelCount} pixels) exceeds maxExportPixels (${maxPixels}).`);
    }
}
function computeExportRegion(ctx, exportArea) {
    if (exportArea === 'canvas')
        return { region: null, partialEdges: null };
    const originalImage = ctx.getOriginalImage();
    if (!originalImage)
        return { region: null, partialEdges: null };
    const bounds = getObjectBBox(originalImage);
    const canvasLike = ctx.canvas;
    const canvasWidth = typeof canvasLike.getWidth === 'function' ? canvasLike.getWidth() : canvasLike.width;
    const canvasHeight = typeof canvasLike.getHeight === 'function' ? canvasLike.getHeight() : canvasLike.height;
    return {
        region: getClampedCanvasRegion(bounds, canvasWidth, canvasHeight, {
            includePartialPixels: true,
        }),
        partialEdges: getPartialExportEdges(bounds, Number(originalImage.angle) || 0),
    };
}
async function withMaskExportState(ctx, mergeMask, fn) {
    if (!mergeMask)
        return withMasksHidden(ctx, fn);
    return withMaskStyleBackup({ canvas: ctx.canvas, options: ctx.options }, applyExportBakeInStyle, fn);
}
async function withMasksHidden(ctx, fn) {
    const backups = getCanvasObjects(ctx.canvas)
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
        return await fn();
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
        const label = object.__label;
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
            backup.mask.__label = backup.label;
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
function renderCanvasToDataURL(canvas, format, quality, multiplier, region) {
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
        const img = new Image();
        img.crossOrigin = 'anonymous';
        const cleanup = () => {
            if (typeof img.removeEventListener === 'function') {
                img.removeEventListener('load', handleLoad);
                img.removeEventListener('error', handleError);
            }
            else {
                img.onload = null;
                img.onerror = null;
            }
        };
        const handleLoad = () => {
            cleanup();
            resolve(img);
        };
        const handleError = () => {
            cleanup();
            reject(new Error('Failed to decode export data URL'));
        };
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
}
async function sealPartialTransparentEdges(dataUrl, edges) {
    if (!hasPartialEdges(edges))
        return dataUrl;
    const imageElement = await loadImageElement(dataUrl);
    const { width, height } = getImageDimensions(imageElement);
    const off = document.createElement('canvas');
    off.width = width;
    off.height = height;
    const ctx2d = off.getContext('2d');
    if (!ctx2d)
        throw new Error('2D canvas context is unavailable');
    ctx2d.drawImage(imageElement, 0, 0, width, height);
    const imageData = ctx2d.getImageData(0, 0, width, height);
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
    ctx2d.putImageData(imageData, 0, 0);
    return off.toDataURL('image/png');
}
function getJpegBackgroundColor(backgroundColor) {
    const value = String(backgroundColor !== null && backgroundColor !== void 0 ? backgroundColor : '').trim();
    if (!value || isTransparentCssColor(value))
        return '#ffffff';
    return value;
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
    const slashAlpha = normalized.match(/^(?:rgb|rgba|hsl|hsla)\([^/]+\/\s*([^)]+)\)$/i);
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
    const off = document.createElement('canvas');
    off.width = width;
    off.height = height;
    const ctx2d = off.getContext('2d');
    if (!ctx2d)
        throw new Error('2D canvas context is unavailable');
    ctx2d.fillStyle = getJpegBackgroundColor(backgroundColor);
    ctx2d.fillRect(0, 0, width, height);
    ctx2d.drawImage(imageElement, 0, 0, width, height);
    return off.toDataURL('image/jpeg', quality);
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
function reencodeDataUrlAs(sourceDataUrl, target, backgroundColor) {
    if (sourceDataUrl.startsWith(`data:${target.mimeType}`)) {
        return Promise.resolve(sourceDataUrl);
    }
    return loadImageElement(sourceDataUrl).then((img) => {
        const { width, height } = getImageDimensions(img);
        const off = document.createElement('canvas');
        off.width = width;
        off.height = height;
        const ctx2d = off.getContext('2d');
        if (!ctx2d)
            throw new Error('Unable to acquire 2D context for export conversion');
        if (target.format === 'jpeg') {
            ctx2d.fillStyle = getJpegBackgroundColor(backgroundColor);
            ctx2d.fillRect(0, 0, width, height);
        }
        ctx2d.drawImage(img, 0, 0, width, height);
        return off.toDataURL(target.mimeType, target.quality);
    });
}
function warnNoImageLoaded(operation) {
    console.warn(`[ImageEditor] ${operation} skipped: no image is loaded on the canvas.`);
}
export async function exportImageBase64(ctx, options) {
    if (!ctx.isImageLoaded()) {
        warnNoImageLoaded('exportImageBase64');
        return '';
    }
    const activeObject = captureActiveObject(ctx.canvas);
    const labelBackups = captureMaskLabelBackups(ctx.canvas);
    try {
        ctx.canvas.discardActiveObject();
        const resolved = resolveExportOptions(ctx, options);
        const { region, partialEdges } = computeExportRegion(ctx, resolved.exportArea);
        assertExportPixelBudget(ctx, resolved.multiplier, region);
        const renderFormat = region && resolved.format.format === 'jpeg' ? 'png' : resolved.format.format;
        const renderQuality = renderFormat === 'png' ? undefined : resolved.format.quality;
        let dataUrl = await withMaskExportState(ctx, resolved.mergeMask, async () => renderCanvasToDataURL(ctx.canvas, renderFormat, renderQuality, resolved.multiplier, region));
        if (region) {
            dataUrl = await sealPartialTransparentEdges(dataUrl, partialEdges);
            if (resolved.format.format === 'jpeg') {
                dataUrl = await convertDataUrlToOpaqueJpeg(dataUrl, ctx.options.backgroundColor, resolved.format.quality);
            }
        }
        return dataUrl;
    }
    finally {
        restoreMaskLabelBackups(ctx.canvas, labelBackups);
        restoreActiveObject(ctx.canvas, activeObject);
        requestRender(ctx.canvas);
    }
}
export async function exportImageFile(ctx, options) {
    var _a;
    if (!ctx.isImageLoaded()) {
        warnNoImageLoaded('exportImageFile');
        throw new ExportNotReadyError('exportImageFile');
    }
    const opts = options !== null && options !== void 0 ? options : {};
    const fileName = (_a = opts.fileName) !== null && _a !== void 0 ? _a : ctx.options.defaultDownloadFileName;
    const resolved = resolveExportFormat(opts, ctx.options.downsampleQuality);
    const base64 = await exportImageBase64(ctx, {
        exportArea: opts.exportArea,
        mergeMask: opts.mergeMask,
        multiplier: opts.multiplier,
        quality: opts.quality,
        fileType: opts.fileType,
    });
    if (!base64) {
        throw new ExportNotReadyError('exportImageFile');
    }
    const finalDataUrl = await reencodeDataUrlAs(base64, resolved, ctx.options.backgroundColor);
    const bytes = dataUrlToBytes(finalDataUrl);
    return new File([bytes], fileName, { type: resolved.mimeType });
}
export function downloadImage(ctx, fileName) {
    if (!ctx.isImageLoaded()) {
        warnNoImageLoaded('downloadImage');
        return;
    }
    const resolvedFileName = fileName !== null && fileName !== void 0 ? fileName : ctx.options.defaultDownloadFileName;
    void exportImageBase64(ctx, {
        exportArea: ctx.options.exportAreaByDefault,
        mergeMask: ctx.options.mergeMaskByDefault,
        multiplier: ctx.options.exportMultiplier,
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
        console.error('[ImageEditor] downloadImage failed', error);
    });
}
export async function mergeMasks(ctx) {
    if (!ctx.isImageLoaded())
        return;
    const masks = ctx.canvas
        .getObjects()
        .filter((o) => 'maskId' in o && typeof o.maskId === 'number');
    if (masks.length === 0)
        return;
    const beforeSnapshot = ctx.saveState();
    ctx.canvas.discardActiveObject();
    ctx.canvas.renderAll();
    const preScrollTop = ctx.containerElement ? ctx.containerElement.scrollTop : null;
    const preScrollLeft = ctx.containerElement ? ctx.containerElement.scrollLeft : null;
    try {
        const merged = await exportImageBase64(ctx, {
            exportArea: 'image',
            mergeMask: true,
            multiplier: ctx.options.exportMultiplier,
            fileType: 'png',
        });
        if (!merged) {
            throw new MergeMasksError('mergeMasks: exportImageBase64 returned an empty data URL.');
        }
        ctx.removeAllMasksNoHistory();
        await ctx.loadImage(merged, { preserveScroll: true });
        const afterSnapshot = ctx.saveState();
        if (ctx.containerElement) {
            try {
                if (preScrollTop !== null) {
                    ctx.containerElement.scrollTop = preScrollTop;
                }
                if (preScrollLeft !== null) {
                    ctx.containerElement.scrollLeft = preScrollLeft;
                }
            }
            catch (scrollError) {
                console.warn('[ImageEditor] mergeMasks: scroll restore failed', scrollError);
            }
        }
        if (beforeSnapshot && afterSnapshot && beforeSnapshot !== afterSnapshot) {
            ctx.historyManager.push(new Command(() => ctx.loadFromState(afterSnapshot), () => ctx.loadFromState(beforeSnapshot)));
        }
    }
    catch (error) {
        try {
            await ctx.loadFromState(beforeSnapshot);
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