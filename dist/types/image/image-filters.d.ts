/**
 * Maps resolved image filter config onto Fabric image filters and filtered snapshots.
 *
 * @module
 */
import type * as FabricNS from 'fabric';
import type { FabricModule, ResolvedImageFilterConfig } from '../core/public-types.js';
type FabricFilter = unknown;
export interface BuiltFabricImageFilters {
    filters: FabricFilter[];
    missing: string[];
}
type MissingImageFilterReporter = (error: unknown, message: string) => void;
export declare function buildFabricImageFilters(fabric: FabricModule, config: ResolvedImageFilterConfig): BuiltFabricImageFilters;
export declare function applyImageFilterConfigToImage(fabric: FabricModule, image: FabricNS.FabricImage, config: ResolvedImageFilterConfig, reportMissing?: MissingImageFilterReporter): BuiltFabricImageFilters;
export declare function getFilteredBaseImageDataUrl(image: FabricNS.FabricImage, config: ResolvedImageFilterConfig, fallback: string | null): string | null;
export {};
