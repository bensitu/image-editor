/**
 * Normalizes bounded Filter definitions and compares their semantic configuration.
 *
 * @module
 */
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
export type FilterDefinition = BrightnessFilter | ContrastFilter | SaturationFilter | GrayscaleFilter | SepiaFilter | VintageFilter | BlurFilter | SharpenFilter;
export type FilterType = FilterDefinition['type'];
export interface FilterDefinitionLimits {
    readonly maxFilterCount?: number;
}
export declare const MAX_SUPPORTED_FILTER_COUNT = 8;
export declare const SUPPORTED_FILTER_TYPES: readonly FilterType[];
/**
 * Validates and normalizes Filter definitions without mutating caller input.
 *
 * @remarks
 * Definitions are returned in the stable application order used by Fabric.
 * Neutral numeric definitions are omitted and duplicate types are rejected.
 */
export declare function normalizeFilterDefinitions(value: unknown, limits?: FilterDefinitionLimits): readonly FilterDefinition[];
export declare function areFilterDefinitionsEqual(left: readonly FilterDefinition[], right: readonly FilterDefinition[]): boolean;
