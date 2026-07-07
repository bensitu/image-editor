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

export interface BuiltFabricImageFilters {
    filters: FabricFilter[];
    missing: string[];
}

type MissingImageFilterReporter = (error: unknown, message: string) => void;

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

function createMissingFilterError(missing: readonly string[]): TypeError {
    return new TypeError(
        `[ImageEditor] Fabric image filter constructor(s) unavailable: ${missing.join(', ')}.`,
    );
}

function reportMissingImageFilters(
    missing: readonly string[],
    reportMissing?: MissingImageFilterReporter,
): void {
    if (missing.length === 0 || !reportMissing) return;
    reportMissing(
        createMissingFilterError(missing),
        `Image filter(s) not supported by the active Fabric build: ${missing.join(', ')}.`,
    );
}

export function buildFabricImageFilters(
    fabric: FabricModule,
    config: ResolvedImageFilterConfig,
): BuiltFabricImageFilters {
    const registry = getFiltersRegistry(fabric);
    const filters: FabricFilter[] = [];
    const missing: string[] = [];

    const push = (
        configKey: keyof ResolvedImageFilterConfig,
        filterName: string,
        options?: Record<string, unknown>,
    ): void => {
        const filter = createFilter(registry, filterName, options);
        if (filter) filters.push(filter);
        else missing.push(configKey);
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
    if (config.grayscale) push('grayscale', 'Grayscale');
    if (config.sepia) push('sepia', 'Sepia');
    if (config.vintage) push('vintage', 'Vintage');
    if (config.blur > 0) push('blur', 'Blur', { blur: config.blur });
    if (config.sharpen > 0) {
        const s = config.sharpen;
        push('sharpen', 'Convolute', {
            matrix: [0, -s, 0, -s, 1 + 4 * s, -s, 0, -s, 0],
        });
    }

    return { filters, missing };
}

export function applyImageFilterConfigToImage(
    fabric: FabricModule,
    image: FabricNS.FabricImage,
    config: ResolvedImageFilterConfig,
    reportMissing?: MissingImageFilterReporter,
): BuiltFabricImageFilters {
    const imageWithFilters = image as unknown as {
        filters?: FabricFilter[];
        applyFilters?: () => void;
        dirty?: boolean;
    };
    const result = buildFabricImageFilters(fabric, config);
    imageWithFilters.filters = result.filters;
    imageWithFilters.applyFilters?.();
    imageWithFilters.dirty = true;
    reportMissingImageFilters(result.missing, reportMissing);
    return result;
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
