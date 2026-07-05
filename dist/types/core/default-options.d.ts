/**
 * Resolves user-supplied {@link ImageEditorOptions} into the
 * runtime {@link ResolvedOptions} object used by the editor.
 *
 * Behavior is defined by the documented option-resolution rules: every
 * required option falls back to a default, runtime values normalize to the
 * supported public value space, nested config objects merge with their
 * defaults, callback values normalize to a function or `null`, unknown
 * top-level keys are ignored, and returned option objects are frozen.
 *
 * @module
 */
import type { DrawConfig, EraserConfig, ImageEditorOptions, LabelConfig, LayoutMode, MosaicConfig, ResolvedCropConfig, ResolvedDrawConfig, ResolvedEraserConfig, ResolvedMosaicConfig, ResolvedShapeAnnotationConfig, ResolvedOptions, ResolvedTextAnnotationConfig, ShapeAnnotationConfig, TextAnnotationConfig } from './public-types.js';
/**
 * Documented defaults for every top-level option except the nested
 * {@link LabelConfig} and {@link CropConfig} configs, which are owned by
 * {@link DEFAULT_LABEL} and {@link DEFAULT_CROP} respectively.
 *
 * Values are the runtime defaults used when callers omit an option.
 * Nested label and crop defaults are carried by {@link DEFAULT_LABEL} and
 * {@link DEFAULT_CROP}.
 */
export declare const DEFAULT_OPTIONS: Omit<ResolvedOptions, 'label' | 'crop' | 'defaultMosaicConfig' | 'defaultTextConfig' | 'defaultDrawConfig' | 'defaultEraserConfig' | 'defaultShapeConfig'>;
/**
 * Default {@link LabelConfig}. Consumers can override `getText`, supply a
 * `create` factory, or provide partial `textOptions` — unspecified keys fall
 * back to {@link DEFAULT_LABEL_TEXT_OPTIONS}.
 */
export declare const DEFAULT_LABEL: LabelConfig;
/**
 * Default {@link CropConfig}.
 */
export declare const DEFAULT_CROP: ResolvedCropConfig;
/**
 * Default Mosaic configuration used to seed each editor's current runtime
 * Mosaic tool config.
 */
export declare const DEFAULT_MOSAIC_CONFIG: ResolvedMosaicConfig;
export declare const DEFAULT_TEXT_ANNOTATION_CONFIG: ResolvedTextAnnotationConfig;
export declare const DEFAULT_DRAW_CONFIG: ResolvedDrawConfig;
export declare const DEFAULT_ERASER_CONFIG: ResolvedEraserConfig;
export declare const DEFAULT_SHAPE_ANNOTATION_CONFIG: ResolvedShapeAnnotationConfig;
export declare function isLayoutMode(value: unknown): value is LayoutMode;
/**
 * Return a mutable defensive copy of a resolved Mosaic config.
 */
export declare function cloneResolvedMosaicConfig(config: ResolvedMosaicConfig): ResolvedMosaicConfig;
/**
 * Normalize a constructor-level Mosaic config against a resolved fallback.
 */
export declare function normalizeMosaicConfig(input: unknown, fallback: ResolvedMosaicConfig): ResolvedMosaicConfig;
/**
 * Merge a runtime Mosaic config patch into the current resolved config.
 * Omitted fields remain unchanged; invalid fields fall back to `current`.
 */
export declare function mergeMosaicConfigPatch(current: ResolvedMosaicConfig, patch: MosaicConfig, fallback?: ResolvedMosaicConfig): ResolvedMosaicConfig;
/**
 * Returns invalid Mosaic config field names for warning/reporting paths.
 */
export declare function getInvalidMosaicConfigFields(input: MosaicConfig): string[];
/**
 * Strict value equality for resolved Mosaic configs.
 */
export declare function areResolvedMosaicConfigsEqual(left: ResolvedMosaicConfig, right: ResolvedMosaicConfig): boolean;
export declare function cloneResolvedTextAnnotationConfig(config: ResolvedTextAnnotationConfig): ResolvedTextAnnotationConfig;
export declare function cloneResolvedDrawConfig(config: ResolvedDrawConfig): ResolvedDrawConfig;
export declare function cloneResolvedEraserConfig(config: ResolvedEraserConfig): ResolvedEraserConfig;
export declare function cloneResolvedShapeAnnotationConfig(config: ResolvedShapeAnnotationConfig): ResolvedShapeAnnotationConfig;
export declare function mergeTextAnnotationConfigPatch(current: ResolvedTextAnnotationConfig, patch: TextAnnotationConfig, fallback?: ResolvedTextAnnotationConfig): ResolvedTextAnnotationConfig;
export declare function normalizeTextAnnotationConfig(input: unknown, fallback: ResolvedTextAnnotationConfig): ResolvedTextAnnotationConfig;
export declare function mergeDrawConfigPatch(current: ResolvedDrawConfig, patch: DrawConfig, fallback?: ResolvedDrawConfig): ResolvedDrawConfig;
export declare function normalizeDrawConfig(input: unknown, fallback: ResolvedDrawConfig): ResolvedDrawConfig;
export declare function mergeEraserConfigPatch(current: ResolvedEraserConfig, patch: EraserConfig, fallback?: ResolvedEraserConfig): ResolvedEraserConfig;
export declare function normalizeEraserConfig(input: unknown, fallback: ResolvedEraserConfig): ResolvedEraserConfig;
export declare function mergeShapeAnnotationConfigPatch(current: ResolvedShapeAnnotationConfig, patch: ShapeAnnotationConfig, fallback?: ResolvedShapeAnnotationConfig): ResolvedShapeAnnotationConfig;
export declare function normalizeShapeAnnotationConfig(input: unknown, fallback: ResolvedShapeAnnotationConfig): ResolvedShapeAnnotationConfig;
export declare function areResolvedTextAnnotationConfigsEqual(left: ResolvedTextAnnotationConfig, right: ResolvedTextAnnotationConfig): boolean;
export declare function areResolvedDrawConfigsEqual(left: ResolvedDrawConfig, right: ResolvedDrawConfig): boolean;
export declare function areResolvedEraserConfigsEqual(left: ResolvedEraserConfig, right: ResolvedEraserConfig): boolean;
export declare function areResolvedShapeAnnotationConfigsEqual(left: ResolvedShapeAnnotationConfig, right: ResolvedShapeAnnotationConfig): boolean;
export declare function getInvalidTextAnnotationConfigFields(input: TextAnnotationConfig): string[];
export declare function getInvalidDrawConfigFields(input: DrawConfig): string[];
export declare function getInvalidEraserConfigFields(input: EraserConfig): string[];
export declare function getInvalidShapeAnnotationConfigFields(input: ShapeAnnotationConfig): string[];
/**
 * Resolves a partial {@link ImageEditorOptions} into a fully populated
 * {@link ResolvedOptions} object.
 *
 * Behavior matrix:
 *  - Every recognized top-level key starts from {@link DEFAULT_OPTIONS}; user
 *    values override it only after type / value normalization.
 *  - Invalid scalar, enum, and boolean runtime values fall back to the
 *    documented defaults instead of entering the resolved runtime options.
 *  - `label.textOptions` is deep-merged with {@link DEFAULT_LABEL_TEXT_OPTIONS}
 *    so user keys override defaults and unspecified keys remain.
 *  - `crop.*` is shallow-merged with {@link DEFAULT_CROP}; invalid field values
 *    fall back to their documented defaults.
 *  - Callback values are normalized: function values are kept, anything
 *    else becomes `null`.
 *  - Unknown top-level keys are silently dropped.
 *  - The returned options object plus its `label` and `crop` references
 *    are frozen so mutating `input` after the call cannot affect the
 *    live editor.
 *
 * @param input - Optional partial options object. Defaults to `{}`.
 */
export declare function resolveOptions(input?: ImageEditorOptions | null): ResolvedOptions;
