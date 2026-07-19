/**
 * Publishes the Filters Plugin factory, definitions, errors, bake options, and API contracts.
 *
 * @module
 */
import type { CoreEventMap } from '../../core/index.js';
import { type SynchronousEditorPlugin } from '../../sdk/index.js';
import { type FiltersPluginApi, type FiltersPluginOptions } from './filters-controller.js';
export declare const filtersPluginRef: import("../../index.js").PluginRef<FiltersPluginApi>;
export declare function filtersPlugin(options?: FiltersPluginOptions): SynchronousEditorPlugin<FiltersPluginApi, CoreEventMap>;
export { MAX_SUPPORTED_FILTER_COUNT, SUPPORTED_FILTER_TYPES, areFilterDefinitionsEqual, normalizeFilterDefinitions, type BlurFilter, type BrightnessFilter, type ContrastFilter, type FilterDefinition, type FilterDefinitionLimits, type FilterType, type GrayscaleFilter, type SaturationFilter, type SepiaFilter, type SharpenFilter, type VintageFilter, } from './filter-definitions.js';
export { FilterBakeValidationError, FilterDefinitionError, FilterImplementationError, FiltersPluginDisposedError, FiltersPreviewMissingError, } from './filters-errors.js';
export type { FilterBakeOptions } from './filtered-image-renderer.js';
export type { FiltersConfiguration, FiltersPluginApi, FiltersPluginOptions, FiltersState, FiltersStatus, FiltersStatusListener, } from './filters-controller.js';
