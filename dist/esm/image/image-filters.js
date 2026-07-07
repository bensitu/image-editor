import { hasActiveImageFilters } from '../core/image-filter-config.js';
function getFiltersRegistry(fabric) {
    var _a;
    return ((_a = fabric.filters) !== null && _a !== void 0 ? _a : {});
}
function createFilter(registry, name, options) {
    const FilterConstructor = registry[name];
    return FilterConstructor ? new FilterConstructor(options) : null;
}
function createMissingFilterError(missing) {
    return new TypeError(`[ImageEditor] Fabric image filter constructor(s) unavailable: ${missing.join(', ')}.`);
}
function reportMissingImageFilters(missing, reportMissing) {
    if (missing.length === 0 || !reportMissing)
        return;
    reportMissing(createMissingFilterError(missing), `Image filter(s) not supported by the active Fabric build: ${missing.join(', ')}.`);
}
export function buildFabricImageFilters(fabric, config) {
    const registry = getFiltersRegistry(fabric);
    const filters = [];
    const missing = [];
    const push = (configKey, filterName, options) => {
        const filter = createFilter(registry, filterName, options);
        if (filter)
            filters.push(filter);
        else
            missing.push(configKey);
    };
    if (config.brightness !== 0) {
        push('brightness', 'Brightness', { brightness: config.brightness });
    }
    if (config.contrast !== 0) {
        push('contrast', 'Contrast', { contrast: config.contrast });
    }
    if (config.saturation !== 0) {
        push('saturation', 'Saturation', { saturation: config.saturation });
    }
    if (config.grayscale)
        push('grayscale', 'Grayscale');
    if (config.sepia)
        push('sepia', 'Sepia');
    if (config.vintage)
        push('vintage', 'Vintage');
    if (config.blur > 0)
        push('blur', 'Blur', { blur: config.blur });
    if (config.sharpen > 0) {
        const s = config.sharpen;
        push('sharpen', 'Convolute', {
            matrix: [0, -s, 0, -s, 1 + 4 * s, -s, 0, -s, 0],
        });
    }
    return { filters, missing };
}
export function applyImageFilterConfigToImage(fabric, image, config, reportMissing) {
    var _a;
    const imageWithFilters = image;
    const result = buildFabricImageFilters(fabric, config);
    imageWithFilters.filters = result.filters;
    (_a = imageWithFilters.applyFilters) === null || _a === void 0 ? void 0 : _a.call(imageWithFilters);
    imageWithFilters.dirty = true;
    reportMissingImageFilters(result.missing, reportMissing);
    return result;
}
export function getFilteredBaseImageDataUrl(image, config, fallback) {
    if (!hasActiveImageFilters(config))
        return fallback;
    try {
        return image.toDataURL({ format: 'png', multiplier: 1 });
    }
    catch {
        return fallback;
    }
}
//# sourceMappingURL=image-filters.js.map