import { FilterImplementationError } from './filters-errors.js';
function getFilterRegistry(fabric) {
    var _a;
    return (_a = fabric.filters) !== null && _a !== void 0 ? _a : {};
}
function createFilter(registry, definition) {
    let constructorName;
    let options;
    switch (definition.type) {
        case 'brightness':
            constructorName = 'Brightness';
            options = { brightness: definition.value };
            break;
        case 'contrast':
            constructorName = 'Contrast';
            options = { contrast: definition.value };
            break;
        case 'saturation':
            constructorName = 'Saturation';
            options = { saturation: definition.value };
            break;
        case 'grayscale':
            constructorName = 'Grayscale';
            break;
        case 'sepia':
            constructorName = 'Sepia';
            break;
        case 'vintage':
            constructorName = 'Vintage';
            break;
        case 'blur':
            constructorName = 'Blur';
            options = { blur: definition.value };
            break;
        case 'sharpen': {
            constructorName = 'Convolute';
            const strength = definition.value;
            options = {
                matrix: [0, -strength, 0, -strength, 1 + 4 * strength, -strength, 0, -strength, 0],
            };
            break;
        }
    }
    const FilterConstructor = registry[constructorName];
    if (!FilterConstructor)
        throw new FilterImplementationError(definition.type);
    try {
        return new FilterConstructor(options);
    }
    catch (error) {
        throw new FilterImplementationError(definition.type, error);
    }
}
export function createFabricFilters(fabric, definitions) {
    const registry = getFilterRegistry(fabric);
    return definitions.map((definition) => createFilter(registry, definition));
}
export function applyFilterDefinitions(fabric, image, definitions) {
    var _a, _b;
    image.filters = [...createFabricFilters(fabric, definitions)];
    try {
        image.applyFilters();
        image.dirty = true;
    }
    catch (error) {
        const type = (_b = (_a = definitions[definitions.length - 1]) === null || _a === void 0 ? void 0 : _a.type) !== null && _b !== void 0 ? _b : 'brightness';
        image.filters = [];
        throw new FilterImplementationError(type, error);
    }
}
//# sourceMappingURL=fabric-filter-factory.js.map