/**
 * Maps resolved image filter config onto Fabric image filters and filtered snapshots.
 *
 * @module
 */

import type * as FabricNS from 'fabric';

import type { FabricModule, ResolvedImageFilterConfig } from '../core/public-types.js';
import { hasActiveImageFilters } from '../core/image-filter-config.js';

type FabricFilter = unknown;
type FabricFilterConstructor = new (options?: Record<string, unknown>) => FabricFilter;
type FabricFiltersRegistry = Record<string, FabricFilterConstructor | undefined>;

function getFiltersRegistry(fabric: FabricModule): FabricFiltersRegistry {
    return ((fabric as unknown as { filters?: FabricFiltersRegistry }).filters ??
        {}) as FabricFiltersRegistry;
}

function createFilter(
    registry: FabricFiltersRegistry,
    name: string,
    options?: Record<string, unknown>,
): FabricFilter | null {
    const FilterConstructor = registry[name];
    return FilterConstructor ? new FilterConstructor(options) : null;
}

export function buildFabricImageFilters(
    fabric: FabricModule,
    config: ResolvedImageFilterConfig,
): FabricFilter[] {
    const registry = getFiltersRegistry(fabric);
    const filters: FabricFilter[] = [];

    const push = (filter: FabricFilter | null): void => {
        if (filter) filters.push(filter);
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
    if (config.grayscale) push(createFilter(registry, 'Grayscale'));
    if (config.sepia) push(createFilter(registry, 'Sepia'));
    if (config.vintage) push(createFilter(registry, 'Vintage'));
    if (config.blur > 0) push(createFilter(registry, 'Blur', { blur: config.blur }));
    if (config.sharpen > 0) {
        const s = config.sharpen;
        push(
            createFilter(registry, 'Convolute', {
                matrix: [0, -s, 0, -s, 1 + 4 * s, -s, 0, -s, 0],
            }),
        );
    }

    return filters;
}

export function applyImageFilterConfigToImage(
    fabric: FabricModule,
    image: FabricNS.FabricImage,
    config: ResolvedImageFilterConfig,
): void {
    const imageWithFilters = image as unknown as {
        filters?: FabricFilter[];
        applyFilters?: () => void;
        dirty?: boolean;
    };
    imageWithFilters.filters = buildFabricImageFilters(fabric, config);
    imageWithFilters.applyFilters?.();
    imageWithFilters.dirty = true;
}

export function getFilteredBaseImageDataUrl(
    image: FabricNS.FabricImage,
    config: ResolvedImageFilterConfig,
    fallback: string | null,
): string | null {
    if (!hasActiveImageFilters(config)) return fallback;
    try {
        return image.toDataURL({ format: 'png', multiplier: 1 });
    } catch {
        return fallback;
    }
}
