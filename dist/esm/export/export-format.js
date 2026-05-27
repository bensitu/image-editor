const FORMAT_ALIAS_TABLE = Object.freeze({
    jpeg: 'jpeg',
    jpg: 'jpeg',
    'image/jpeg': 'jpeg',
    png: 'png',
    'image/png': 'png',
    webp: 'webp',
    'image/webp': 'webp',
});
const MIME_TABLE = Object.freeze({
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
});
export function normalizeImageFormat(input) {
    var _a;
    const key = String(input || 'jpeg').toLowerCase();
    if (Object.prototype.hasOwnProperty.call(FORMAT_ALIAS_TABLE, key)) {
        return (_a = FORMAT_ALIAS_TABLE[key]) !== null && _a !== void 0 ? _a : 'jpeg';
    }
    return 'jpeg';
}
export function mimeTypeFor(format) {
    return MIME_TABLE[format];
}
export function clampQuality(quality, fallback) {
    const numeric = Number(quality);
    if (!Number.isFinite(numeric))
        return fallback;
    return Math.max(0, Math.min(1, numeric));
}
export function resolveExportFormat(options, downsampleQuality) {
    var _a;
    const opts = options !== null && options !== void 0 ? options : {};
    const fileType = opts.fileType;
    const formatAlias = opts.format;
    const requested = fileType || formatAlias;
    const format = normalizeImageFormat(requested);
    const mimeType = mimeTypeFor(format);
    if (format === 'png') {
        return { format, mimeType, quality: undefined };
    }
    const rawQuality = (_a = opts.quality) !== null && _a !== void 0 ? _a : downsampleQuality;
    const quality = clampQuality(rawQuality, downsampleQuality);
    return { format, mimeType, quality };
}
//# sourceMappingURL=export-format.js.map