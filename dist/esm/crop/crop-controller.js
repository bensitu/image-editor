import { CropApplyError } from '../core/errors.js';
import { isMaskObject } from '../core/public-types.js';
import { Command } from '../history/history-manager.js';
import { applyCropHideMaskStyle, attachMaskHoverHandlers, captureMaskStyleBackup, restoreMaskStyleBackup, } from '../mask/mask-style.js';
import { getClampedCanvasRegion, getObjectBBox } from '../utils/canvas-region.js';
import { clampQuality as clampExportQuality, mimeTypeFor, tryNormalizeImageFormat, } from '../export/export-format.js';
const CROP_RECT_FILL = 'rgba(0,0,0,0.12)';
const CROP_RECT_STROKE = '#00aaff';
const CROP_RECT_DASH = [6, 4];
const CROP_RECT_CORNER_SIZE = 8;
const CROP_DEFAULT_PADDING = 10;
const CROPPED_EXPORT_QUALITY_FALLBACK = 0.92;
function imageMimeToFormat(mimeType) {
    if (mimeType === 'image/jpeg')
        return 'jpeg';
    if (mimeType === 'image/png')
        return 'png';
    if (mimeType === 'image/webp')
        return 'webp';
    return null;
}
function resolveLossyCropQuality(cropExportQuality, downsampleQuality) {
    const cropQuality = Number(cropExportQuality);
    if (Number.isFinite(cropQuality)) {
        return clampExportQuality(cropQuality, CROPPED_EXPORT_QUALITY_FALLBACK);
    }
    const fallbackQuality = Number(downsampleQuality);
    if (Number.isFinite(fallbackQuality)) {
        return clampExportQuality(fallbackQuality, CROPPED_EXPORT_QUALITY_FALLBACK);
    }
    return CROPPED_EXPORT_QUALITY_FALLBACK;
}
function resolveCropExportFormat(input) {
    var _a, _b;
    const requested = input.cropExportFileType;
    const format = requested === undefined || requested === null || requested === 'source'
        ? ((_a = imageMimeToFormat(input.currentImageMimeType)) !== null && _a !== void 0 ? _a : 'png')
        : ((_b = tryNormalizeImageFormat(String(requested))) !== null && _b !== void 0 ? _b : 'png');
    const mimeType = mimeTypeFor(format);
    if (format === 'png')
        return { format, mimeType };
    return {
        format,
        mimeType,
        quality: resolveLossyCropQuality(input.cropExportQuality, input.downsampleQuality),
    };
}
function getCropRectContentBounds(cropRect) {
    const angle = Number(cropRect.angle) || 0;
    const normalizedAngle = Math.abs(angle % 360);
    if (normalizedAngle > 0.01 && Math.abs(normalizedAngle - 360) > 0.01) {
        return getObjectBBox(cropRect);
    }
    return {
        left: Number(cropRect.left) || 0,
        top: Number(cropRect.top) || 0,
        width: Math.max(0, (Number(cropRect.width) || 0) * Math.abs(Number(cropRect.scaleX) || 1)),
        height: Math.max(0, (Number(cropRect.height) || 0) * Math.abs(Number(cropRect.scaleY) || 1)),
    };
}
function removeCropRect(ctx, session) {
    for (const targetHandlers of session.handlers) {
        for (const rec of targetHandlers.handlers) {
            try {
                targetHandlers.target.off(rec.evt, rec.fn);
            }
            catch {
            }
        }
    }
    session.handlers = [];
    if (session.cropRect) {
        try {
            ctx.canvas.remove(session.cropRect);
        }
        catch {
        }
        session.cropRect = null;
    }
}
function restoreCropObjectState(session) {
    for (const rec of session.prevEvented) {
        try {
            rec.obj.set({ evented: rec.evented, selectable: rec.selectable });
        }
        catch {
        }
    }
    session.prevEvented = [];
}
function restoreCropMaskBackups(session) {
    for (const backup of session.maskBackups) {
        restoreMaskStyleBackup(backup);
    }
    session.maskBackups = [];
}
function teardownSession(ctx, session) {
    removeCropRect(ctx, session);
    restoreCropObjectState(session);
    restoreCropMaskBackups(session);
    try {
        ctx.canvas.selection = !!session.prevSelection;
    }
    catch {
    }
}
function maskIntersectsRegion(mask, region) {
    const bbox = getObjectBBox(mask);
    return (bbox.left < region.left + region.width &&
        bbox.left + bbox.width > region.left &&
        bbox.top < region.top + region.height &&
        bbox.top + bbox.height > region.top);
}
function capturePreservedMasks(canvas, cropRegion) {
    const records = [];
    const masks = canvas.getObjects().filter(isMaskObject);
    for (const mask of masks) {
        try {
            mask.setCoords();
            const intersects = maskIntersectsRegion(mask, cropRegion);
            if (intersects) {
                records.push({
                    mask,
                    left: Number(mask.left) || 0,
                    top: Number(mask.top) || 0,
                    angle: Number(mask.angle) || 0,
                    scaleX: Number(mask.scaleX) || 1,
                    scaleY: Number(mask.scaleY) || 1,
                });
            }
            canvas.remove(mask);
        }
        catch {
        }
    }
    return records;
}
function reapplyPreservedMasks(ctx, cropRegion, records) {
    var _a;
    if (records.length === 0)
        return;
    const { canvas } = ctx;
    let maxRestoredId = 0;
    for (const record of records) {
        try {
            record.mask.set({
                left: record.left - cropRegion.left,
                top: record.top - cropRegion.top,
                angle: record.angle,
                scaleX: record.scaleX,
                scaleY: record.scaleY,
                visible: true,
            });
            record.mask.setCoords();
            canvas.add(record.mask);
            canvas.bringObjectToFront(record.mask);
            attachMaskHoverHandlers(record.mask);
            const id = Number(record.mask.maskId);
            if (Number.isFinite(id) && id > maxRestoredId)
                maxRestoredId = id;
        }
        catch {
        }
    }
    if (typeof ctx.getMaskCounter === 'function' && typeof ctx.setMaskCounter === 'function') {
        const liveCounter = Number(ctx.getMaskCounter());
        const safeCounter = Number.isFinite(liveCounter) ? liveCounter : 0;
        ctx.setMaskCounter(Math.max(safeCounter, maxRestoredId));
    }
    try {
        (_a = ctx.updateMaskList) === null || _a === void 0 ? void 0 : _a.call(ctx);
    }
    catch {
    }
}
export function enterCropMode(ctx) {
    const { canvas, options } = ctx;
    if (ctx.getCropSession())
        return;
    const originalImage = ctx.getOriginalImage();
    if (!originalImage)
        return;
    if (!ctx.isImageLoaded())
        return;
    canvas.discardActiveObject();
    const beforeJson = ctx.saveState();
    const prevSelection = !!canvas.selection;
    canvas.selection = false;
    originalImage.setCoords();
    const imageBounds = originalImage.getBoundingRect();
    const padding = Number.isFinite(Number(options.crop.padding))
        ? Number(options.crop.padding)
        : CROP_DEFAULT_PADDING;
    const boundsLeft = Math.max(0, Math.floor(imageBounds.left));
    const boundsTop = Math.max(0, Math.floor(imageBounds.top));
    const maxCropWidth = Math.max(1, Math.floor(imageBounds.width));
    const maxCropHeight = Math.max(1, Math.floor(imageBounds.height));
    const rectLeft = Math.min(boundsLeft + maxCropWidth - 1, Math.max(boundsLeft, Math.floor(imageBounds.left + padding)));
    const rectTop = Math.min(boundsTop + maxCropHeight - 1, Math.max(boundsTop, Math.floor(imageBounds.top + padding)));
    const configuredMinWidth = Math.max(1, Number(options.crop.minWidth) || 1);
    const configuredMinHeight = Math.max(1, Number(options.crop.minHeight) || 1);
    const minCropWidth = Math.min(configuredMinWidth, maxCropWidth);
    const minCropHeight = Math.min(configuredMinHeight, maxCropHeight);
    const allowRotation = !!options.crop.allowRotationOfCropRect;
    const cropRect = new ctx.fabric.Rect({
        left: rectLeft,
        top: rectTop,
        width: minCropWidth,
        height: minCropHeight,
        originX: 'left',
        originY: 'top',
        fill: CROP_RECT_FILL,
        stroke: CROP_RECT_STROKE,
        strokeDashArray: CROP_RECT_DASH,
        strokeWidth: 1,
        strokeUniform: true,
        selectable: true,
        lockRotation: !allowRotation,
        cornerSize: CROP_RECT_CORNER_SIZE,
        objectCaching: false,
        lockScalingFlip: true,
    });
    if (!allowRotation) {
        cropRect.setControlVisible('mtr', false);
    }
    canvas.add(cropRect);
    cropRect.isCropRect = true;
    canvas.bringObjectToFront(cropRect);
    canvas.setActiveObject(cropRect);
    const hideMasks = !!options.crop.hideMasksDuringCrop;
    const maskBackups = [];
    if (hideMasks) {
        canvas.getObjects().forEach((obj) => {
            if (obj === cropRect)
                return;
            if (!isMaskObject(obj))
                return;
            maskBackups.push(captureMaskStyleBackup(obj));
        });
    }
    const prevEvented = [];
    canvas.getObjects().forEach((obj) => {
        var _a, _b;
        if (obj === cropRect)
            return;
        prevEvented.push({
            obj,
            evented: (_a = obj.evented) !== null && _a !== void 0 ? _a : true,
            selectable: (_b = obj.selectable) !== null && _b !== void 0 ? _b : true,
        });
        try {
            obj.set({ evented: false, selectable: false });
        }
        catch {
        }
    });
    if (hideMasks) {
        for (const backup of maskBackups) {
            applyCropHideMaskStyle(backup.obj);
        }
    }
    const handleCropRectModified = () => {
        try {
            const cropWidth = Math.max(1, Number(cropRect.width) || 1);
            const cropHeight = Math.max(1, Number(cropRect.height) || 1);
            const nextScaleX = Math.min(maxCropWidth / cropWidth, Math.max(minCropWidth / cropWidth, Number(cropRect.scaleX) || 1));
            const nextScaleY = Math.min(maxCropHeight / cropHeight, Math.max(minCropHeight / cropHeight, Number(cropRect.scaleY) || 1));
            const scaledWidth = cropWidth * nextScaleX;
            const scaledHeight = cropHeight * nextScaleY;
            const maxLeft = Math.max(boundsLeft, boundsLeft + maxCropWidth - scaledWidth);
            const maxTop = Math.max(boundsTop, boundsTop + maxCropHeight - scaledHeight);
            const nextLeft = Math.min(maxLeft, Math.max(boundsLeft, Number(cropRect.left) || boundsLeft));
            const nextTop = Math.min(maxTop, Math.max(boundsTop, Number(cropRect.top) || boundsTop));
            cropRect.set({
                left: nextLeft,
                top: nextTop,
                scaleX: nextScaleX,
                scaleY: nextScaleY,
            });
            cropRect.setCoords();
            canvas.requestRenderAll();
        }
        catch {
        }
    };
    cropRect.on('modified', handleCropRectModified);
    cropRect.on('moving', handleCropRectModified);
    cropRect.on('scaling', handleCropRectModified);
    const session = {
        beforeJson,
        prevSelection,
        prevEvented,
        maskBackups,
        cropRect,
        handlers: [
            {
                target: cropRect,
                handlers: [
                    { evt: 'modified', fn: handleCropRectModified },
                    { evt: 'moving', fn: handleCropRectModified },
                    { evt: 'scaling', fn: handleCropRectModified },
                ],
            },
        ],
    };
    ctx.setCropSession(session);
    canvas.renderAll();
}
export function cancelCrop(ctx) {
    const session = ctx.getCropSession();
    if (!session)
        return;
    ctx.canvas.discardActiveObject();
    teardownSession(ctx, session);
    ctx.setCropSession(null);
    try {
        ctx.canvas.renderAll();
    }
    catch {
    }
}
export async function applyCrop(ctx) {
    var _a, _b;
    const session = ctx.getCropSession();
    if (!session || !session.cropRect)
        return;
    const { canvas } = ctx;
    canvas.discardActiveObject();
    const beforeJson = session.beforeJson;
    const cropRect = session.cropRect;
    const preserveMasks = !!ctx.options.crop.preserveMasksAfterCrop;
    try {
        cropRect.setCoords();
        const cropAngle = Number(cropRect.angle) || 0;
        if (!ctx.options.crop.allowRotationOfCropRect && Math.abs(cropAngle % 360) > 0.01) {
            throw new CropApplyError('applyCrop failed: rotated crop rectangles are disabled.');
        }
        const rectBounds = getCropRectContentBounds(cropRect);
        const cropRegion = getClampedCanvasRegion(rectBounds, canvas.getWidth(), canvas.getHeight(), { includePartialPixels: false });
        const preservedRecords = preserveMasks
            ? capturePreservedMasks(canvas, cropRegion)
            : [];
        restoreCropObjectState(session);
        removeCropRect(ctx, session);
        canvas.selection = !!session.prevSelection;
        const cropFormat = resolveCropExportFormat({
            cropExportFileType: ctx.options.crop.exportFileType,
            currentImageMimeType: (_b = (_a = ctx.getCurrentImageMimeType) === null || _a === void 0 ? void 0 : _a.call(ctx)) !== null && _b !== void 0 ? _b : null,
            cropExportQuality: ctx.options.crop.exportQuality,
            downsampleQuality: ctx.options.downsampleQuality,
        });
        const exportOptions = {
            format: cropFormat.format,
            multiplier: 1,
            left: cropRegion.left,
            top: cropRegion.top,
            width: cropRegion.width,
            height: cropRegion.height,
        };
        if (cropFormat.quality !== undefined) {
            exportOptions.quality = cropFormat.quality;
        }
        const croppedBase64 = canvas.toDataURL(exportOptions);
        await ctx.loadImage(croppedBase64);
        if (preservedRecords.length > 0) {
            reapplyPreservedMasks(ctx, cropRegion, preservedRecords);
            canvas.renderAll();
        }
        const afterJson = ctx.saveState();
        ctx.setCropSession(null);
        if (beforeJson && afterJson && beforeJson !== afterJson) {
            ctx.historyManager.push(new Command(() => ctx.loadFromState(afterJson), () => ctx.loadFromState(beforeJson)));
        }
    }
    catch (error) {
        teardownSession(ctx, session);
        ctx.setCropSession(null);
        try {
            await ctx.loadFromState(beforeJson);
        }
        catch (rollbackError) {
            console.warn('[ImageEditor] applyCrop: rollback failed', rollbackError);
        }
        if (error instanceof CropApplyError)
            throw error;
        const message = error instanceof Error ? `applyCrop failed: ${error.message}` : 'applyCrop failed';
        throw new CropApplyError(message, error);
    }
}
//# sourceMappingURL=crop-controller.js.map