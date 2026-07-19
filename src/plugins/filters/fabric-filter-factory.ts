/**
 * Maps validated Filter definitions to Fabric filter instances and applies them to images.
 *
 * @module
 */

import type * as FabricNS from 'fabric';

import type { FabricModule } from '../../core/index.js';
import type { FilterDefinition, FilterType } from './filter-definitions.js';
import { FilterImplementationError } from './filters-errors.js';

type FabricFilter = NonNullable<FabricNS.FabricImage['filters']>[number];
type FabricFilterConstructor = new (options?: Record<string, unknown>) => FabricFilter;
type FabricFilterRegistry = Record<string, FabricFilterConstructor | undefined>;

function getFilterRegistry(fabric: FabricModule): FabricFilterRegistry {
    return (fabric as unknown as { filters?: FabricFilterRegistry }).filters ?? {};
}

function createFilter(registry: FabricFilterRegistry, definition: FilterDefinition): FabricFilter {
    let constructorName: string;
    let options: Record<string, unknown> | undefined;
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
    if (!FilterConstructor) throw new FilterImplementationError(definition.type);
    try {
        return new FilterConstructor(options);
    } catch (error) {
        throw new FilterImplementationError(definition.type, error);
    }
}

/** Creates the complete Fabric implementation for normalized definitions. */
export function createFabricFilters(
    fabric: FabricModule,
    definitions: readonly FilterDefinition[],
): readonly FabricFilter[] {
    const registry = getFilterRegistry(fabric);
    return definitions.map((definition) => createFilter(registry, definition));
}

/** Replaces any inherited Fabric Filters with Plugin-owned implementations. */
export function applyFilterDefinitions(
    fabric: FabricModule,
    image: FabricNS.FabricImage,
    definitions: readonly FilterDefinition[],
): void {
    image.filters = [...createFabricFilters(fabric, definitions)];
    try {
        image.applyFilters();
        image.dirty = true;
    } catch (error) {
        const type: FilterType = definitions[definitions.length - 1]?.type ?? 'brightness';
        image.filters = [];
        throw new FilterImplementationError(type, error);
    }
}
