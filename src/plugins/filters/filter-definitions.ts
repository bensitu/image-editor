/**
 * Normalizes bounded Filter definitions and compares their semantic configuration.
 *
 * @module
 */

import { isDangerousStateKey as isUnsafeObjectKey } from '../../plugin-kernel/plugin-identifier.js';
import { FilterDefinitionError } from './filters-errors.js';

export interface BrightnessFilter {
    readonly type: 'brightness';
    readonly value: number;
}

export interface ContrastFilter {
    readonly type: 'contrast';
    readonly value: number;
}

export interface SaturationFilter {
    readonly type: 'saturation';
    readonly value: number;
}

export interface BlurFilter {
    readonly type: 'blur';
    readonly value: number;
}

export interface SharpenFilter {
    readonly type: 'sharpen';
    readonly value: number;
}

export interface GrayscaleFilter {
    readonly type: 'grayscale';
}

export interface SepiaFilter {
    readonly type: 'sepia';
}

export interface VintageFilter {
    readonly type: 'vintage';
}

/** Closed serializable union supported by the Filters Plugin. */
export type FilterDefinition =
    | BrightnessFilter
    | ContrastFilter
    | SaturationFilter
    | GrayscaleFilter
    | SepiaFilter
    | VintageFilter
    | BlurFilter
    | SharpenFilter;

export type FilterType = FilterDefinition['type'];

export interface FilterDefinitionLimits {
    readonly maxFilterCount?: number;
}

export const MAX_SUPPORTED_FILTER_COUNT = 8;

export const SUPPORTED_FILTER_TYPES: readonly FilterType[] = Object.freeze([
    'brightness',
    'contrast',
    'saturation',
    'grayscale',
    'sepia',
    'vintage',
    'blur',
    'sharpen',
]);

const numericRanges: Readonly<
    Record<
        Extract<FilterType, 'brightness' | 'contrast' | 'saturation' | 'blur' | 'sharpen'>,
        readonly [number, number]
    >
> = Object.freeze({
    brightness: [-1, 1] as const,
    contrast: [-1, 1] as const,
    saturation: [-1, 1] as const,
    blur: [0, 1] as const,
    sharpen: [0, 1] as const,
});

function isRecord(value: unknown): value is Record<string, unknown> {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}

function validateKeys(
    value: Record<string, unknown>,
    allowed: readonly string[],
    path: string,
): void {
    for (const key of Reflect.ownKeys(value)) {
        if (typeof key !== 'string') {
            throw new FilterDefinitionError(
                'Filter definition contains an unsupported symbol key.',
                path,
            );
        }
        if (isUnsafeObjectKey(key)) {
            throw new FilterDefinitionError(
                `Filter definition contains dangerous key "${key}".`,
                path,
            );
        }
        if (!allowed.includes(key)) {
            throw new FilterDefinitionError(
                `Filter definition contains unknown key "${key}".`,
                path,
            );
        }
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (!descriptor || !('value' in descriptor)) {
            throw new FilterDefinitionError(
                `Filter definition property "${key}" must be a data property.`,
                path,
            );
        }
    }
}

function normalizeMaxFilterCount(value: number | undefined): number {
    const maxFilterCount = value ?? MAX_SUPPORTED_FILTER_COUNT;
    if (
        !Number.isSafeInteger(maxFilterCount) ||
        maxFilterCount < 1 ||
        maxFilterCount > MAX_SUPPORTED_FILTER_COUNT
    ) {
        throw new FilterDefinitionError(
            `maxFilterCount must be an integer from 1 to ${MAX_SUPPORTED_FILTER_COUNT}.`,
            '$.maxFilterCount',
        );
    }
    return maxFilterCount;
}

function normalizeDefinition(value: unknown, index: number): FilterDefinition | null {
    const path = `$[${index}]`;
    if (!isRecord(value)) {
        throw new FilterDefinitionError('Each Filter definition must be a plain object.', path);
    }
    validateKeys(value, ['type', 'value'], path);
    const type = value.type;
    if (typeof type !== 'string' || !SUPPORTED_FILTER_TYPES.includes(type as FilterType)) {
        throw new FilterDefinitionError(`Unknown Filter type "${String(type)}".`, `${path}.type`);
    }
    if (type === 'grayscale' || type === 'sepia' || type === 'vintage') {
        validateKeys(value, ['type'], path);
        return Object.freeze({ type });
    }
    if (typeof value.value !== 'number' || !Number.isFinite(value.value)) {
        throw new FilterDefinitionError('Filter value must be finite.', `${path}.value`);
    }
    const numericType = type as keyof typeof numericRanges;
    const [minimum, maximum] = numericRanges[numericType];
    if (value.value < minimum || value.value > maximum) {
        throw new FilterDefinitionError(
            `${type} value must be within [${minimum}, ${maximum}].`,
            `${path}.value`,
        );
    }
    if (value.value === 0) return null;
    return Object.freeze({ type: numericType, value: value.value }) as FilterDefinition;
}

/**
 * Validates and normalizes Filter definitions without mutating caller input.
 *
 * @remarks
 * Definitions are returned in the stable application order used by Fabric.
 * Neutral numeric definitions are omitted and duplicate types are rejected.
 */
export function normalizeFilterDefinitions(
    value: unknown,
    limits: FilterDefinitionLimits = {},
): readonly FilterDefinition[] {
    if (!Array.isArray(value)) {
        throw new FilterDefinitionError('Filter definitions must be an array.');
    }
    const maxFilterCount = normalizeMaxFilterCount(limits.maxFilterCount);
    if (value.length > maxFilterCount) {
        throw new FilterDefinitionError(`Filter count exceeds ${maxFilterCount}.`);
    }
    const definitionByType = new Map<FilterType, FilterDefinition>();
    const seenTypes = new Set<FilterType>();
    for (let index = 0; index < value.length; index += 1) {
        const definition = normalizeDefinition(value[index], index);
        const type = (value[index] as Readonly<{ type: FilterType }>).type;
        if (seenTypes.has(type)) {
            throw new FilterDefinitionError(
                `Duplicate Filter type "${type}" is not supported.`,
                `$[${index}].type`,
            );
        }
        seenTypes.add(type);
        if (definition) definitionByType.set(definition.type, definition);
    }
    return Object.freeze(
        SUPPORTED_FILTER_TYPES.flatMap((type) => {
            const definition = definitionByType.get(type);
            return definition ? [definition] : [];
        }),
    );
}

export function areFilterDefinitionsEqual(
    left: readonly FilterDefinition[],
    right: readonly FilterDefinition[],
): boolean {
    if (left.length !== right.length) return false;
    return left.every((definition, index) => {
        const candidate = right[index];
        if (!candidate || definition.type !== candidate.type) return false;
        return (
            !('value' in definition) ||
            ('value' in candidate && definition.value === candidate.value)
        );
    });
}
