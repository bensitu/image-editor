import { DownsampleError } from '../core/errors.js';
export function computeDownsampleDimensions(srcWidth, srcHeight, maxWidth, maxHeight) {
    if (!isPositiveFinite(srcWidth) ||
        !isPositiveFinite(srcHeight) ||
        !isPositiveFinite(maxWidth) ||
        !isPositiveFinite(maxHeight)) {
        return {
            width: Math.max(1, Math.round(srcWidth) || 1),
            height: Math.max(1, Math.round(srcHeight) || 1),
            needsResize: false,
        };
    }
    const needsResize = srcWidth > maxWidth || srcHeight > maxHeight;
    if (!needsResize) {
        return { width: srcWidth, height: srcHeight, needsResize: false };
    }
    const ratio = Math.min(maxWidth / srcWidth, maxHeight / srcHeight);
    return {
        width: Math.max(1, Math.round(srcWidth * ratio)),
        height: Math.max(1, Math.round(srcHeight * ratio)),
        needsResize: true,
    };
}
function isPositiveFinite(value) {
    return Number.isFinite(value) && value > 0;
}
export function selectDownsampleMimeType(sourceMime, preserveSourceFormat, downsampleMimeType) {
    if (downsampleMimeType)
        return downsampleMimeType;
    if (preserveSourceFormat && (sourceMime === 'image/png' || sourceMime === 'image/webp')) {
        return sourceMime;
    }
    return 'image/jpeg';
}
export function detectSourceMimeType(dataUrl) {
    const match = /^data:(image\/[a-z0-9+\-.]+)\s*;/i.exec(dataUrl);
    return match ? match[1].toLowerCase() : null;
}
export function resampleImage(imgEl, maxWidth, maxHeight, sourceMime, preserveSourceFormat, downsampleMimeType, quality) {
    const { width, height } = computeDownsampleDimensions(imgEl.naturalWidth, imgEl.naturalHeight, maxWidth, maxHeight);
    const mimeType = selectDownsampleMimeType(sourceMime, preserveSourceFormat, downsampleMimeType);
    const oc = document.createElement('canvas');
    oc.width = width;
    oc.height = height;
    const ctx = oc.getContext('2d');
    if (!ctx) {
        throw new DownsampleError('Failed to obtain a 2D context for downsampling.');
    }
    ctx.drawImage(imgEl, 0, 0, imgEl.naturalWidth, imgEl.naturalHeight, 0, 0, width, height);
    const dataUrl = mimeType === 'image/png' ? oc.toDataURL(mimeType) : oc.toDataURL(mimeType, quality);
    return { dataUrl, width, height, mimeType };
}
//# sourceMappingURL=image-resampler.js.map