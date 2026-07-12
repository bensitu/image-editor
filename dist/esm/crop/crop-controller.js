import { reportWarning } from '../core/callback-reporter.js';
import { CropApplyError } from '../core/errors.js';
import { markSessionObject } from '../core/editor-object-kind.js';
import { isMaskObject } from '../core/public-types.js';
import { Command } from '../history/history-port.js';
import { applyCropHideMaskStyle, captureMaskStyleBackup, reattachMaskHoverHandlers, restoreMaskStyleBackup, } from '../mask/mask-style.js';
import { getClampedCanvasRegion, getObjectBBox, hasMeaningfulCanvasRegion, } from '../utils/canvas-region.js';
import { clampQuality as clampExportQuality, mimeTypeFor, tryNormalizeImageFormat, } from '../export/export-format.js';
const CROP_RECT_FILL = 'rgba(0,0,0,0.12)';
const CROP_RECT_STROKE = '#00aaff';
const CROP_RECT_DASH = [6, 4];
const CROP_RECT_CORNER_SIZE = 8;
const CROP_DEFAULT_PADDING = 10;
const CROPPED_EXPORT_QUALITY_FALLBACK = 0.92;
function finiteNumberOrFallback(value, fallback) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
}
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
function removeCropRect(context, session) {
    for (const targetHandlers of session.handlers) {
        for (const record of targetHandlers.handlers) {
            try {
                targetHandlers.target.off(record.eventName, record.callback);
            }
            catch {
            }
        }
    }
    session.handlers = [];
    if (session.cropRect) {
        try {
            context.canvas.remove(session.cropRect);
        }
        catch {
        }
        session.cropRect = null;
    }
}
function restoreCropObjectState(session) {
    for (const record of session.prevEvented) {
        try {
            record.object.set({ evented: record.evented, selectable: record.selectable });
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
function teardownSession(context, session) {
    removeCropRect(context, session);
    restoreCropObjectState(session);
    restoreCropMaskBackups(session);
    try {
        context.canvas.selection = !!session.prevSelection;
    }
    catch {
    }
}
function finitePositiveRatio(numerator, denominator) {
    const ratio = Number(numerator) / Number(denominator);
    return Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
}
function resolvePostCropMaskPlacement(context, cropRegion) {
    const postCropImage = context.getOriginalImage();
    if (!postCropImage) {
        return { left: 0, top: 0, scaleX: 1, scaleY: 1 };
    }
    postCropImage.setCoords();
    const imageBounds = postCropImage.getBoundingRect();
    return {
        left: finiteNumberOrFallback(imageBounds.left, 0),
        top: finiteNumberOrFallback(imageBounds.top, 0),
        scaleX: finitePositiveRatio(imageBounds.width, cropRegion.width),
        scaleY: finitePositiveRatio(imageBounds.height, cropRegion.height),
    };
}
function maskIntersectsRegion(mask, region) {
    const bbox = getObjectBBox(mask);
    return (bbox.left < region.left + region.width &&
        bbox.left + bbox.width > region.left &&
        bbox.top < region.top + region.height &&
        bbox.top + bbox.height > region.top);
}
function capturePreservedMasks(canvas, cropRegion, maskBackups = []) {
    var _a;
    const records = [];
    const styleBackupByMask = maskBackups.length > 0
        ? new Map(maskBackups.map((backup) => [backup.object, backup]))
        : null;
    const masks = canvas.getObjects().filter(isMaskObject);
    for (const mask of masks) {
        try {
            mask.setCoords();
            const intersects = maskIntersectsRegion(mask, cropRegion);
            if (intersects) {
                const styleBackup = (_a = styleBackupByMask === null || styleBackupByMask === void 0 ? void 0 : styleBackupByMask.get(mask)) !== null && _a !== void 0 ? _a : captureMaskStyleBackup(mask);
                records.push({
                    mask,
                    left: finiteNumberOrFallback(mask.left, 0),
                    top: finiteNumberOrFallback(mask.top, 0),
                    angle: finiteNumberOrFallback(mask.angle, 0),
                    scaleX: finiteNumberOrFallback(mask.scaleX, 1),
                    scaleY: finiteNumberOrFallback(mask.scaleY, 1),
                    styleBackup,
                });
            }
            canvas.remove(mask);
        }
        catch {
        }
    }
    return records;
}
function reapplyPreservedMasks(context, cropRegion, records) {
    var _a;
    if (records.length === 0)
        return;
    const { canvas } = context;
    const placement = resolvePostCropMaskPlacement(context, cropRegion);
    let maxRestoredId = 0;
    for (const record of records) {
        try {
            restoreMaskStyleBackup(record.styleBackup);
            record.mask.set({
                left: placement.left + (record.left - cropRegion.left) * placement.scaleX,
                top: placement.top + (record.top - cropRegion.top) * placement.scaleY,
                angle: record.angle,
                scaleX: record.scaleX * placement.scaleX,
                scaleY: record.scaleY * placement.scaleY,
                visible: true,
            });
            record.mask.setCoords();
            canvas.add(record.mask);
            canvas.bringObjectToFront(record.mask);
            reattachMaskHoverHandlers(record.mask);
            const id = Number(record.mask.maskId);
            if (Number.isFinite(id) && id > maxRestoredId)
                maxRestoredId = id;
        }
        catch {
        }
    }
    if (typeof context.getMaskCounter === 'function' &&
        typeof context.setMaskCounter === 'function') {
        const liveCounter = Number(context.getMaskCounter());
        const safeCounter = Number.isFinite(liveCounter) ? liveCounter : 0;
        context.setMaskCounter(Math.max(safeCounter, maxRestoredId));
    }
    try {
        (_a = context.updateMaskList) === null || _a === void 0 ? void 0 : _a.call(context);
    }
    catch {
    }
}
const CROP_ASPECT_RATIO_PRESETS = Object.freeze({
    free: null,
    '1:1': 1,
    '3:4': 3 / 4,
    '4:3': 4 / 3,
    '3:2': 3 / 2,
    '2:3': 2 / 3,
    '9:16': 9 / 16,
    '16:9': 16 / 9,
});
export function normalizeCropAspectRatio(input) {
    var _a;
    if (input === null || input === undefined)
        return null;
    if (typeof input === 'number') {
        return Number.isFinite(input) && input > 0 ? input : null;
    }
    if (typeof input === 'string') {
        const trimmed = input.trim();
        if (Object.prototype.hasOwnProperty.call(CROP_ASPECT_RATIO_PRESETS, trimmed)) {
            return (_a = CROP_ASPECT_RATIO_PRESETS[trimmed]) !== null && _a !== void 0 ? _a : null;
        }
        const parts = trimmed.split(':');
        if (parts.length !== 2)
            return null;
        const width = Number(parts[0]);
        const height = Number(parts[1]);
        return Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0
            ? width / height
            : null;
    }
    if (typeof input === 'object') {
        const width = Number(input.width);
        const height = Number(input.height);
        return Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0
            ? width / height
            : null;
    }
    return null;
}
function fitAspectRatioInside(maxWidth, maxHeight, aspectRatio) {
    const safeMaxWidth = Math.max(1, maxWidth);
    const safeMaxHeight = Math.max(1, maxHeight);
    let width = safeMaxWidth;
    let height = width / aspectRatio;
    if (height > safeMaxHeight) {
        height = safeMaxHeight;
        width = height * aspectRatio;
    }
    return {
        width: Math.max(1, width),
        height: Math.max(1, height),
    };
}
function minimumAspectRatioSizeThatFits(minWidth, minHeight, maxWidth, maxHeight, aspectRatio) {
    let width = Math.max(1, minWidth);
    let height = width / aspectRatio;
    if (height < minHeight) {
        height = Math.max(1, minHeight);
        width = height * aspectRatio;
    }
    return width <= maxWidth && height <= maxHeight ? { width, height } : null;
}
function chooseAspectRatioResizeBasis(canvas, cropRect, scaleX, scaleY) {
    var _a, _b, _c;
    const corner = String((_c = (_a = cropRect.__corner) !== null && _a !== void 0 ? _a : (_b = canvas._currentTransform) === null || _b === void 0 ? void 0 : _b.corner) !== null && _c !== void 0 ? _c : '').toLowerCase();
    if (corner === 'mt' || corner === 'mb')
        return 'height';
    if (corner === 'ml' || corner === 'mr')
        return 'width';
    return Math.abs(scaleY - 1) > Math.abs(scaleX - 1) ? 'height' : 'width';
}
function constrainAspectRatioSize(requestedWidth, requestedHeight, basis, aspectRatio, minWidth, minHeight, maxWidth, maxHeight) {
    var _a;
    const maxSize = fitAspectRatioInside(maxWidth, maxHeight, aspectRatio);
    const minSize = (_a = minimumAspectRatioSizeThatFits(minWidth, minHeight, maxSize.width, maxSize.height, aspectRatio)) !== null && _a !== void 0 ? _a : maxSize;
    let width = basis === 'height' ? requestedHeight * aspectRatio : requestedWidth;
    let height = basis === 'height' ? requestedHeight : requestedWidth / aspectRatio;
    if (width > maxSize.width || height > maxSize.height) {
        ({ width, height } = maxSize);
    }
    if (width < minSize.width || height < minSize.height) {
        ({ width, height } = minSize);
    }
    return { width, height };
}
function resolvePaddedCropArea(boundsLeft, boundsTop, maxCropWidth, maxCropHeight, padding) {
    const insetX = padding * 2 < maxCropWidth ? padding : 0;
    const insetY = padding * 2 < maxCropHeight ? padding : 0;
    return {
        left: boundsLeft + insetX,
        top: boundsTop + insetY,
        width: Math.max(1, maxCropWidth - insetX * 2),
        height: Math.max(1, maxCropHeight - insetY * 2),
    };
}
function resolveCropBounds(context) {
    const originalImage = context.getOriginalImage();
    if (!originalImage)
        return null;
    originalImage.setCoords();
    const { options } = context;
    const imageBounds = originalImage.getBoundingRect();
    const padding = Number.isFinite(Number(options.crop.padding))
        ? Number(options.crop.padding)
        : CROP_DEFAULT_PADDING;
    const boundsLeft = Math.max(0, Math.floor(imageBounds.left));
    const boundsTop = Math.max(0, Math.floor(imageBounds.top));
    const maxCropWidth = Math.max(1, Math.floor(imageBounds.width));
    const maxCropHeight = Math.max(1, Math.floor(imageBounds.height));
    const configuredMinWidth = Math.max(1, Number(options.crop.minWidth) || 1);
    const configuredMinHeight = Math.max(1, Number(options.crop.minHeight) || 1);
    return {
        boundsLeft,
        boundsTop,
        maxCropWidth,
        maxCropHeight,
        minCropWidth: Math.min(configuredMinWidth, maxCropWidth),
        minCropHeight: Math.min(configuredMinHeight, maxCropHeight),
        padding,
        imageBounds,
    };
}
function clampCropRectIntoBounds(cropRect, bounds) {
    const width = Math.min(bounds.maxCropWidth, Math.max(bounds.minCropWidth, (Number(cropRect.width) || 1) * (Number(cropRect.scaleX) || 1)));
    const height = Math.min(bounds.maxCropHeight, Math.max(bounds.minCropHeight, (Number(cropRect.height) || 1) * (Number(cropRect.scaleY) || 1)));
    const left = Math.min(bounds.boundsLeft + bounds.maxCropWidth - width, Math.max(bounds.boundsLeft, Number(cropRect.left) || bounds.boundsLeft));
    const top = Math.min(bounds.boundsTop + bounds.maxCropHeight - height, Math.max(bounds.boundsTop, Number(cropRect.top) || bounds.boundsTop));
    cropRect.set({ left, top, width, height, scaleX: 1, scaleY: 1 });
}
function resizeCropRectToAspectRatio(context, cropRect, aspectRatio) {
    const bounds = resolveCropBounds(context);
    if (!bounds)
        return;
    if (aspectRatio === null) {
        clampCropRectIntoBounds(cropRect, bounds);
        cropRect.setCoords();
        return;
    }
    const available = resolvePaddedCropArea(bounds.boundsLeft, bounds.boundsTop, bounds.maxCropWidth, bounds.maxCropHeight, bounds.padding);
    const fitted = fitAspectRatioInside(available.width, available.height, aspectRatio);
    cropRect.set({
        left: available.left + (available.width - fitted.width) / 2,
        top: available.top + (available.height - fitted.height) / 2,
        width: fitted.width,
        height: fitted.height,
        scaleX: 1,
        scaleY: 1,
    });
    cropRect.setCoords();
}
function updateCropRectControlVisibility(cropRect, aspectRatio, allowRotationOfCropRect) {
    const lockedRatio = aspectRatio !== null;
    cropRect.setControlsVisibility({
        tl: true,
        tr: true,
        br: true,
        bl: true,
        mt: !lockedRatio,
        mb: !lockedRatio,
        ml: !lockedRatio,
        mr: !lockedRatio,
        mtr: allowRotationOfCropRect,
    });
    cropRect.setCoords();
}
export function enterCropMode(context, cropModeOptions = {}) {
    var _a;
    const { canvas, options } = context;
    if (context.getCropSession())
        return;
    const originalImage = context.getOriginalImage();
    if (!originalImage)
        return;
    if (!context.isImageLoaded())
        return;
    canvas.discardActiveObject();
    const beforeJson = context.saveState();
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
    const configuredMinWidth = Math.max(1, Number(options.crop.minWidth) || 1);
    const configuredMinHeight = Math.max(1, Number(options.crop.minHeight) || 1);
    const minCropWidth = Math.min(configuredMinWidth, maxCropWidth);
    const minCropHeight = Math.min(configuredMinHeight, maxCropHeight);
    const allowRotation = !!options.crop.allowRotationOfCropRect;
    const aspectRatio = normalizeCropAspectRatio((_a = cropModeOptions.aspectRatio) !== null && _a !== void 0 ? _a : options.crop.aspectRatio);
    let rectLeft;
    let rectTop;
    let rectWidth;
    let rectHeight;
    const available = resolvePaddedCropArea(boundsLeft, boundsTop, maxCropWidth, maxCropHeight, padding);
    if (aspectRatio === null) {
        rectWidth = Math.max(minCropWidth, available.width);
        rectHeight = Math.max(minCropHeight, available.height);
        rectLeft = Math.min(boundsLeft + maxCropWidth - rectWidth, Math.max(boundsLeft, available.left + (available.width - rectWidth) / 2));
        rectTop = Math.min(boundsTop + maxCropHeight - rectHeight, Math.max(boundsTop, available.top + (available.height - rectHeight) / 2));
    }
    else {
        const fitted = fitAspectRatioInside(available.width, available.height, aspectRatio);
        rectWidth = fitted.width;
        rectHeight = fitted.height;
        rectLeft = available.left + (available.width - rectWidth) / 2;
        rectTop = available.top + (available.height - rectHeight) / 2;
    }
    const cropRect = new context.fabric.Rect({
        left: rectLeft,
        top: rectTop,
        width: rectWidth,
        height: rectHeight,
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
    updateCropRectControlVisibility(cropRect, aspectRatio, allowRotation);
    canvas.add(cropRect);
    markSessionObject(cropRect, 'cropRect');
    cropRect.isCropRect = true;
    canvas.bringObjectToFront(cropRect);
    canvas.setActiveObject(cropRect);
    const hideMasks = !!options.crop.hideMasksDuringCrop;
    const maskBackups = [];
    if (hideMasks) {
        canvas.getObjects().forEach((object) => {
            if (object === cropRect)
                return;
            if (!isMaskObject(object))
                return;
            maskBackups.push(captureMaskStyleBackup(object));
        });
    }
    const prevEvented = [];
    canvas.getObjects().forEach((object) => {
        var _a, _b;
        if (object === cropRect)
            return;
        prevEvented.push({
            object,
            evented: (_a = object.evented) !== null && _a !== void 0 ? _a : true,
            selectable: (_b = object.selectable) !== null && _b !== void 0 ? _b : true,
        });
        try {
            object.set({ evented: false, selectable: false });
        }
        catch {
        }
    });
    if (hideMasks) {
        for (const backup of maskBackups) {
            applyCropHideMaskStyle(backup.object);
        }
    }
    const handleCropRectModified = () => {
        try {
            const cropWidth = Math.max(1, Number(cropRect.width) || 1);
            const cropHeight = Math.max(1, Number(cropRect.height) || 1);
            let nextScaleX;
            let nextScaleY;
            const activeSession = context.getCropSession();
            const activeAspectRatio = activeSession ? activeSession.aspectRatio : aspectRatio;
            if (activeAspectRatio === null) {
                nextScaleX = Math.min(maxCropWidth / cropWidth, Math.max(minCropWidth / cropWidth, Number(cropRect.scaleX) || 1));
                nextScaleY = Math.min(maxCropHeight / cropHeight, Math.max(minCropHeight / cropHeight, Number(cropRect.scaleY) || 1));
            }
            else {
                const rawScaleX = Math.max(0.0001, Number(cropRect.scaleX) || 1);
                const rawScaleY = Math.max(0.0001, Number(cropRect.scaleY) || 1);
                const basis = chooseAspectRatioResizeBasis(canvas, cropRect, rawScaleX, rawScaleY);
                const constrained = constrainAspectRatioSize(cropWidth * rawScaleX, cropHeight * rawScaleY, basis, activeAspectRatio, minCropWidth, minCropHeight, maxCropWidth, maxCropHeight);
                nextScaleX = constrained.width / cropWidth;
                nextScaleY = constrained.height / cropHeight;
            }
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
        aspectRatio,
        handlers: [
            {
                target: cropRect,
                handlers: [
                    { eventName: 'modified', callback: handleCropRectModified },
                    { eventName: 'moving', callback: handleCropRectModified },
                    { eventName: 'scaling', callback: handleCropRectModified },
                ],
            },
        ],
    };
    context.setCropSession(session);
    canvas.renderAll();
}
export function setCropAspectRatio(context, aspectRatioInput) {
    const session = context.getCropSession();
    if (!(session === null || session === void 0 ? void 0 : session.cropRect))
        return;
    const aspectRatio = normalizeCropAspectRatio(aspectRatioInput);
    session.aspectRatio = aspectRatio;
    resizeCropRectToAspectRatio(context, session.cropRect, aspectRatio);
    updateCropRectControlVisibility(session.cropRect, aspectRatio, !!context.options.crop.allowRotationOfCropRect);
    context.canvas.setActiveObject(session.cropRect);
    context.canvas.requestRenderAll();
}
export function cancelCrop(context) {
    const session = context.getCropSession();
    if (!session)
        return;
    context.canvas.discardActiveObject();
    teardownSession(context, session);
    context.setCropSession(null);
    try {
        context.canvas.renderAll();
    }
    catch {
    }
}
export async function applyCrop(context) {
    var _a, _b;
    const session = context.getCropSession();
    if (!session || !session.cropRect)
        return;
    const { canvas } = context;
    canvas.discardActiveObject();
    const beforeJson = session.beforeJson;
    const cropRect = session.cropRect;
    const preserveMasks = !!context.options.crop.preserveMasksAfterCrop;
    try {
        cropRect.setCoords();
        const cropAngle = Number(cropRect.angle) || 0;
        if (!context.options.crop.allowRotationOfCropRect && Math.abs(cropAngle % 360) > 0.01) {
            throw new CropApplyError('applyCrop failed: rotated crop rectangles are disabled.');
        }
        const rectBounds = getCropRectContentBounds(cropRect);
        if (!hasMeaningfulCanvasRegion(rectBounds, canvas.getWidth(), canvas.getHeight())) {
            throw new CropApplyError('applyCrop failed: crop region is empty or outside the canvas.');
        }
        const cropRegion = getClampedCanvasRegion(rectBounds, canvas.getWidth(), canvas.getHeight(), { includePartialPixels: false });
        const preservedRecords = preserveMasks
            ? capturePreservedMasks(canvas, cropRegion, session.maskBackups)
            : [];
        restoreCropObjectState(session);
        removeCropRect(context, session);
        canvas.selection = !!session.prevSelection;
        const cropFormat = resolveCropExportFormat({
            cropExportFileType: context.options.crop.exportFileType,
            currentImageMimeType: (_b = (_a = context.getCurrentImageMimeType) === null || _a === void 0 ? void 0 : _a.call(context)) !== null && _b !== void 0 ? _b : null,
            cropExportQuality: context.options.crop.exportQuality,
            downsampleQuality: context.options.downsampleQuality,
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
        await context.loadImage(croppedBase64);
        if (preservedRecords.length > 0) {
            reapplyPreservedMasks(context, cropRegion, preservedRecords);
            canvas.renderAll();
        }
        const afterJson = context.saveState();
        context.setCropSession(null);
        if (beforeJson && afterJson && beforeJson !== afterJson) {
            context.historyManager.push(new Command(() => context.loadFromState(afterJson), () => context.loadFromState(beforeJson)));
        }
    }
    catch (error) {
        teardownSession(context, session);
        context.setCropSession(null);
        try {
            await context.loadFromState(beforeJson);
        }
        catch (rollbackError) {
            reportWarning(context.options, rollbackError, 'applyCrop rollback failed.');
        }
        if (error instanceof CropApplyError)
            throw error;
        const message = error instanceof Error ? `applyCrop failed: ${error.message}` : 'applyCrop failed';
        throw new CropApplyError(message, error);
    }
}
//# sourceMappingURL=crop-controller.js.map