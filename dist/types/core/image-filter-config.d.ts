import type { ImageFilterConfig, ResolvedImageFilterConfig } from './public-types.js';
export declare const DEFAULT_IMAGE_FILTER_CONFIG: Readonly<ResolvedImageFilterConfig>;
export interface ImageFilterConfigNormalizationResult {
    config: ResolvedImageFilterConfig;
    warnings: string[];
}
export declare function cloneResolvedImageFilterConfig(config: ResolvedImageFilterConfig): ResolvedImageFilterConfig;
export declare function mergeImageFilterConfigPatch(current: ResolvedImageFilterConfig, patch: Partial<ImageFilterConfig>): ImageFilterConfigNormalizationResult;
export declare function normalizeImageFilterConfigSnapshot(value: unknown): ResolvedImageFilterConfig;
export declare function areResolvedImageFilterConfigsEqual(left: ResolvedImageFilterConfig, right: ResolvedImageFilterConfig): boolean;
export declare function hasActiveImageFilters(config: ResolvedImageFilterConfig): boolean;
