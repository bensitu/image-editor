import { hasActiveImageFilters } from '../core/image-filter-config.js';
function getFiltersRegistry(fabric) {
    var _a;
    return ((_a = fabric.filters) !== null && _a !== void 0 ? _a : {});
}
function createFilter(registry, name, options) {
    const FilterConstructor = registry[name];
    return FilterConstructor ? new FilterConstructor(options) : null;
}
export function buildFabricImageFilters(fabric, config) {
    const registry = getFiltersRegistry(fabric);
    const filters = [];
    const push = (filter) => {
        if (filter)
            filters.push(filter);
    };
    if (config.brightness !== 0) {
        push(createFilter(registry, 'Brightness', { brightness: config.brightness }));
    }
    if (config.contrast !== 0) {
        push(createFilter(registry, 'Contrast', { contrast: config.contrast }));
    }
    if (config.saturation !== 0) {
        push(createFilter(registry, 'Saturation', { saturation: config.saturation }));
    }
    if (config.grayscale)
        push(createFilter(registry, 'Grayscale'));
    if (config.sepia)
        push(createFilter(registry, 'Sepia'));
    if (config.vintage)
        push(createFilter(registry, 'Vintage'));
    if (config.blur > 0)
        push(createFilter(registry, 'Blur', { blur: config.blur }));
    if (config.sharpen > 0) {
        const s = config.sharpen;
        push(createFilter(registry, 'Convolute', {
            matrix: [0, -s, 0, -s, 1 + 4 * s, -s, 0, -s, 0],
        }));
    }
    return filters;
}
export function applyImageFilterConfigToImage(fabric, image, config) {
    var _a;
    const imageWithFilters = image;
    imageWithFilters.filters = buildFabricImageFilters(fabric, config);
    (_a = imageWithFilters.applyFilters) === null || _a === void 0 ? void 0 : _a.call(imageWithFilters);
    imageWithFilters.dirty = true;
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