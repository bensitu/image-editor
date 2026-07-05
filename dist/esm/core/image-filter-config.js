export const DEFAULT_IMAGE_FILTER_CONFIG = Object.freeze({
    brightness: 0,
    contrast: 0,
    saturation: 0,
    blur: 0,
    sharpen: 0,
    grayscale: false,
    sepia: false,
    vintage: false,
});
function isConfigObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function hasOwn(object, key) {
    return Object.prototype.hasOwnProperty.call(object, key);
}
function normalizeNumberField(raw, key, fallback, min, max, warnings) {
    if (!hasOwn(raw, key))
        return fallback;
    const value = raw[key];
    if (value === undefined || value === null)
        return 0;
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        warnings.push(key);
        return fallback;
    }
    if (value < min || value > max) {
        warnings.push(key);
        return Math.max(min, Math.min(max, value));
    }
    return value;
}
function normalizeBooleanField(raw, key, fallback, warnings) {
    if (!hasOwn(raw, key))
        return fallback;
    const value = raw[key];
    if (value === undefined || value === null)
        return false;
    if (typeof value !== 'boolean') {
        warnings.push(key);
        return fallback;
    }
    return value;
}
export function cloneResolvedImageFilterConfig(config) {
    return { ...config };
}
export function mergeImageFilterConfigPatch(current, patch) {
    const raw = isConfigObject(patch) ? patch : {};
    const warnings = [];
    const config = {
        brightness: normalizeNumberField(raw, 'brightness', current.brightness, -1, 1, warnings),
        contrast: normalizeNumberField(raw, 'contrast', current.contrast, -1, 1, warnings),
        saturation: normalizeNumberField(raw, 'saturation', current.saturation, -1, 1, warnings),
        blur: normalizeNumberField(raw, 'blur', current.blur, 0, 1, warnings),
        sharpen: normalizeNumberField(raw, 'sharpen', current.sharpen, 0, 1, warnings),
        grayscale: normalizeBooleanField(raw, 'grayscale', current.grayscale, warnings),
        sepia: normalizeBooleanField(raw, 'sepia', current.sepia, warnings),
        vintage: normalizeBooleanField(raw, 'vintage', current.vintage, warnings),
    };
    return { config, warnings };
}
export function normalizeImageFilterConfigSnapshot(value) {
    if (!isConfigObject(value))
        return cloneResolvedImageFilterConfig(DEFAULT_IMAGE_FILTER_CONFIG);
    return mergeImageFilterConfigPatch(cloneResolvedImageFilterConfig(DEFAULT_IMAGE_FILTER_CONFIG), value).config;
}
export function areResolvedImageFilterConfigsEqual(left, right) {
    return (left.brightness === right.brightness &&
        left.contrast === right.contrast &&
        left.saturation === right.saturation &&
        left.blur === right.blur &&
        left.sharpen === right.sharpen &&
        left.grayscale === right.grayscale &&
        left.sepia === right.sepia &&
        left.vintage === right.vintage);
}
export function hasActiveImageFilters(config) {
    return (config.brightness !== 0 ||
        config.contrast !== 0 ||
        config.saturation !== 0 ||
        config.blur !== 0 ||
        config.sharpen !== 0 ||
        config.grayscale ||
        config.sepia ||
        config.vintage);
}
//# sourceMappingURL=image-filter-config.js.map