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
function computeExportRegion(ctx, exportImageArea) {
    if (!exportImageArea)
        return { region: null, partialEdges: null };
    const originalImage = ctx.getOriginalImage();
    if (!originalImage)
        return { region: null, partialEdges: null };
    const bounds = getObjectBBox(originalImage);
    const canvasLike = ctx.canvas;
    const canvasWidth = typeof canvasLike.getWidth === 'function'
        ? canvasLike.getWidth()
        : canvasLike.width;
    const canvasHeight = typeof canvasLike.getHeight === 'function'
        ? canvasLike.getHeight()
        : canvasLike.height;
    return {
        region: getClampedCanvasRegion(bounds, canvasWidth, canvasHeight, { includePartialPixels: true }),
        partialEdges: getPartialExportEdges(bounds, Number(originalImage.angle) || 0),
    };
}
async function bakeMasksForExport(ctx, exportImageArea, fn) {
    if (!exportImageArea)
        return fn();
    return withMaskStyleBackup({ canvas: ctx.canvas, options: ctx.options }, applyExportBakeInStyle, fn);
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
    if (!value || value === 'transparent')
        return '#ffffff';
    if (/^rgba\([^)]*,\s*0(?:\.0+)?\s*\)$/i.test(value))
        return '#ffffff';
    return value;
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
    const commaAt = dataUrl.indexOf(',');
    const base64 = commaAt >= 0 ? dataUrl.slice(commaAt + 1) : dataUrl;
    const binary = atob(base64);
    const buffer = new ArrayBuffer(binary.length);
    const bytes = new Uint8Array(buffer);
    for (let i = binary.length - 1; i >= 0; i -= 1) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
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
    const opts = options !== null && options !== void 0 ? options : {};
    const exportImageArea = typeof opts.exportImageArea === 'boolean'
        ? opts.exportImageArea
        : ctx.options.exportImageAreaByDefault;
    ctx.canvas.discardActiveObject();
    const resolved = resolveExportFormat(opts, ctx.options.downsampleQuality);
    const multiplier = resolveMultiplier(opts.multiplier, ctx.options.exportMultiplier);
    const { region, partialEdges } = computeExportRegion(ctx, exportImageArea);
    const renderFormat = region && resolved.format === 'jpeg' ? 'png' : resolved.format;
    const renderQuality = renderFormat === 'png' ? undefined : resolved.quality;
    let dataUrl = await bakeMasksForExport(ctx, exportImageArea, async () => renderCanvasToDataURL(ctx.canvas, renderFormat, renderQuality, multiplier, region));
    if (region) {
        dataUrl = await sealPartialTransparentEdges(dataUrl, partialEdges);
        if (resolved.format === 'jpeg') {
            dataUrl = await convertDataUrlToOpaqueJpeg(dataUrl, ctx.options.backgroundColor, resolved.quality);
        }
    }
    return dataUrl;
}
export async function exportImageFile(ctx, options) {
    var _a;
    if (!ctx.isImageLoaded()) {
        warnNoImageLoaded('exportImageFile');
        throw new ExportNotReadyError('exportImageFile');
    }
    const opts = options !== null && options !== void 0 ? options : {};
    const mergeMask = opts.mergeMask !== false;
    const fileName = (_a = opts.fileName) !== null && _a !== void 0 ? _a : ctx.options.defaultDownloadFileName;
    const resolved = resolveExportFormat(opts, ctx.options.downsampleQuality);
    const base64 = await exportImageBase64(ctx, {
        exportImageArea: mergeMask,
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
        exportImageArea: ctx.options.exportImageAreaByDefault,
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
    const masks = ctx.canvas.getObjects().filter((o) => 'maskId' in o &&
        typeof o.maskId === 'number');
    if (masks.length === 0)
        return;
    ctx.canvas.discardActiveObject();
    ctx.canvas.renderAll();
    const beforeSnapshot = ctx.saveState();
    const preScrollTop = ctx.containerElement ? ctx.containerElement.scrollTop : null;
    const preScrollLeft = ctx.containerElement ? ctx.containerElement.scrollLeft : null;
    try {
        const merged = await exportImageBase64(ctx, {
            exportImageArea: true,
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
            catch (scrollErr) {
                console.warn('[ImageEditor] mergeMasks: scroll restore failed', scrollErr);
            }
        }
        if (beforeSnapshot && afterSnapshot && beforeSnapshot !== afterSnapshot) {
            ctx.historyManager.push(new Command(() => ctx.loadFromState(afterSnapshot), () => ctx.loadFromState(beforeSnapshot)));
        }
    }
    catch (err) {
        try {
            await ctx.loadFromState(beforeSnapshot);
        }
        catch (rollbackErr) {
            console.warn('[ImageEditor] mergeMasks: rollback failed', rollbackErr);
        }
        if (err instanceof MergeMasksError)
            throw err;
        const message = err instanceof Error
            ? `mergeMasks failed: ${err.message}`
            : 'mergeMasks failed';
        throw new MergeMasksError(message, err);
    }
}
//# sourceMappingURL=export-service.js.map