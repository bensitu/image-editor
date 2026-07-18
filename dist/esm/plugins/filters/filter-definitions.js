import { FilterDefinitionError } from './filters-errors.js';
export const MAX_SUPPORTED_FILTER_COUNT = 8;
export const SUPPORTED_FILTER_TYPES = Object.freeze([
    'brightness',
    'contrast',
    'saturation',
    'grayscale',
    'sepia',
    'vintage',
    'blur',
    'sharpen',
]);
const dangerousKeys = new Set(['__proto__', 'constructor', 'prototype']);
const numericRanges = Object.freeze({
    brightness: [-1, 1],
    contrast: [-1, 1],
    saturation: [-1, 1],
    blur: [0, 1],
    sharpen: [0, 1],
});
function isRecord(value) {
    if (typeof value !== 'object' || value === null || Array.isArray(value))
        return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}
function validateKeys(value, allowed, path) {
    for (const key of Reflect.ownKeys(value)) {
        if (typeof key !== 'string') {
            throw new FilterDefinitionError('Filter definition contains an unsupported symbol key.', path);
        }
        if (dangerousKeys.has(key)) {
            throw new FilterDefinitionError(`Filter definition contains dangerous key "${key}".`, path);
        }
        if (!allowed.includes(key)) {
            throw new FilterDefinitionError(`Filter definition contains unknown key "${key}".`, path);
        }
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (!descriptor || !('value' in descriptor)) {
            throw new FilterDefinitionError(`Filter definition property "${key}" must be a data property.`, path);
        }
    }
}
function normalizeMaxFilterCount(value) {
    const maxFilterCount = value !== null && value !== void 0 ? value : MAX_SUPPORTED_FILTER_COUNT;
    if (!Number.isSafeInteger(maxFilterCount) ||
        maxFilterCount < 1 ||
        maxFilterCount > MAX_SUPPORTED_FILTER_COUNT) {
        throw new FilterDefinitionError(`maxFilterCount must be an integer from 1 to ${MAX_SUPPORTED_FILTER_COUNT}.`, '$.maxFilterCount');
    }
    return maxFilterCount;
}
function normalizeDefinition(value, index) {
    const path = `$[${index}]`;
    if (!isRecord(value)) {
        throw new FilterDefinitionError('Each Filter definition must be a plain object.', path);
    }
    validateKeys(value, ['type', 'value'], path);
    const type = value.type;
    if (typeof type !== 'string' || !SUPPORTED_FILTER_TYPES.includes(type)) {
        throw new FilterDefinitionError(`Unknown Filter type "${String(type)}".`, `${path}.type`);
    }
    if (type === 'grayscale' || type === 'sepia' || type === 'vintage') {
        validateKeys(value, ['type'], path);
        return Object.freeze({ type });
    }
    if (typeof value.value !== 'number' || !Number.isFinite(value.value)) {
        throw new FilterDefinitionError('Filter value must be finite.', `${path}.value`);
    }
    const numericType = type;
    const [minimum, maximum] = numericRanges[numericType];
    if (value.value < minimum || value.value > maximum) {
        throw new FilterDefinitionError(`${type} value must be within [${minimum}, ${maximum}].`, `${path}.value`);
    }
    if (value.value === 0)
        return null;
    return Object.freeze({ type: numericType, value: value.value });
}
export function normalizeFilterDefinitions(value, limits = {}) {
    if (!Array.isArray(value)) {
        throw new FilterDefinitionError('Filter definitions must be an array.');
    }
    const maxFilterCount = normalizeMaxFilterCount(limits.maxFilterCount);
    if (value.length > maxFilterCount) {
        throw new FilterDefinitionError(`Filter count exceeds ${maxFilterCount}.`);
    }
    const definitionByType = new Map();
    const seenTypes = new Set();
    for (let index = 0; index < value.length; index += 1) {
        const definition = normalizeDefinition(value[index], index);
        const type = value[index].type;
        if (seenTypes.has(type)) {
            throw new FilterDefinitionError(`Duplicate Filter type "${type}" is not supported.`, `$[${index}].type`);
        }
        seenTypes.add(type);
        if (definition)
            definitionByType.set(definition.type, definition);
    }
    return Object.freeze(SUPPORTED_FILTER_TYPES.flatMap((type) => {
        const definition = definitionByType.get(type);
        return definition ? [definition] : [];
    }));
}
export function areFilterDefinitionsEqual(left, right) {
    if (left.length !== right.length)
        return false;
    return left.every((definition, index) => {
        const candidate = right[index];
        if (!candidate || definition.type !== candidate.type)
            return false;
        return (!('value' in definition) ||
            ('value' in candidate && definition.value === candidate.value));
    });
}
//# sourceMappingURL=filter-definitions.js.map