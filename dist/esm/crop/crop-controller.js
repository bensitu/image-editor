import { CropApplyError } from '../core/errors.js';
import { isMaskObject } from '../core/public-types.js';
import { Command } from '../history/history-manager.js';
import { applyCropHideMaskStyle, attachMaskHoverHandlers, captureMaskStyleBackup, restoreMaskStyleBackup, } from '../mask/mask-style.js';
import { clampRegionToCanvas, floorRegion, getObjectBBox, } from '../utils/canvas-region.js';
const CROP_RECT_FILL = 'rgba(0,0,0,0.12)';
const CROP_RECT_STROKE = '#00aaff';
const CROP_RECT_DASH = [6, 4];
const CROP_RECT_CORNER_SIZE = 8;
const CROP_DEFAULT_PADDING = 10;
const CROPPED_EXPORT_FORMAT = 'jpeg';
const CROPPED_EXPORT_QUALITY_FALLBACK = 0.92;
function clampQuality(quality) {
    const num = Number(quality);
    if (!Number.isFinite(num))
        return CROPPED_EXPORT_QUALITY_FALLBACK;
    return Math.max(0, Math.min(1, num));
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
    const rectLeft = Math.max(0, Math.floor(imageBounds.left + padding));
    const rectTop = Math.max(0, Math.floor(imageBounds.top + padding));
    const maxCropWidth = Math.max(1, Math.floor(imageBounds.width - padding * 2));
    const maxCropHeight = Math.max(1, Math.floor(imageBounds.height - padding * 2));
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
        canvas.getObjects().forEach(obj => {
            if (obj === cropRect)
                return;
            if (!isMaskObject(obj))
                return;
            maskBackups.push(captureMaskStyleBackup(obj));
        });
    }
    const prevEvented = [];
    canvas.getObjects().forEach(obj => {
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
            cropRect.set({ scaleX: nextScaleX, scaleY: nextScaleY });
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
        const rectBounds = cropRect.getBoundingRect();
        const cropRegion = clampRegionToCanvas(floorRegion(rectBounds), canvas.getWidth(), canvas.getHeight());
        const preservedRecords = preserveMasks
            ? capturePreservedMasks(canvas, cropRegion)
            : [];
        restoreCropObjectState(session);
        removeCropRect(ctx, session);
        canvas.selection = !!session.prevSelection;
        const quality = clampQuality(ctx.options.downsampleQuality);
        const exportOptions = {
            format: CROPPED_EXPORT_FORMAT,
            quality,
            multiplier: 1,
            left: cropRegion.left,
            top: cropRegion.top,
            width: cropRegion.width,
            height: cropRegion.height,
        };
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
    catch (err) {
        teardownSession(ctx, session);
        ctx.setCropSession(null);
        try {
            await ctx.loadFromState(beforeJson);
        }
        catch (rollbackErr) {
            console.warn('[ImageEditor] applyCrop: rollback failed', rollbackErr);
        }
        if (err instanceof CropApplyError)
            throw err;
        const message = err instanceof Error
            ? `applyCrop failed: ${err.message}`
            : 'applyCrop failed';
        throw new CropApplyError(message, err);
    }
}
//# sourceMappingURL=crop-controller.js.map