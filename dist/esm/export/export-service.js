import { ExportNotReadyError, MergeMasksError } from '../core/errors.js';
import { Command } from '../history/history-manager.js';
import { withMaskStyleBackup } from '../mask/mask-style.js';
import { floorRegion, getObjectBBox } from '../utils/canvas-region.js';
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
        return null;
    const originalImage = ctx.getOriginalImage();
    if (!originalImage)
        return null;
    return floorRegion(getObjectBBox(originalImage));
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
function reencodeDataUrlAs(sourceDataUrl, target) {
    if (sourceDataUrl.startsWith(`data:${target.mimeType}`)) {
        return Promise.resolve(sourceDataUrl);
    }
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            try {
                const off = document.createElement('canvas');
                off.width = img.naturalWidth || img.width;
                off.height = img.naturalHeight || img.height;
                const ctx2d = off.getContext('2d');
                if (!ctx2d)
                    throw new Error('Unable to acquire 2D context for export conversion');
                ctx2d.drawImage(img, 0, 0);
                resolve(off.toDataURL(target.mimeType, target.quality));
            }
            catch (error) {
                reject(error);
            }
        };
        img.onerror = () => {
            reject(new Error('Failed to decode export data URL during MIME conversion'));
        };
        img.src = sourceDataUrl;
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
    const region = computeExportRegion(ctx, exportImageArea);
    return bakeMasksForExport(ctx, exportImageArea, async () => renderCanvasToDataURL(ctx.canvas, resolved.format, resolved.quality, multiplier, region));
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
    const finalDataUrl = await reencodeDataUrlAs(base64, resolved);
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