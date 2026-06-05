/**
 * Resolves user-supplied {@link ImageEditorOptions} into the
 * runtime {@link ResolvedOptions} object used by the editor.
 *
 * Behavior is defined by the documented option-resolution rules: every
 * required option falls back to a default, nested `label.textOptions` and
 * `crop` values merge with their defaults, callback values normalize to a
 * function or `null`, unknown top-level keys are ignored, top-level scalar
 * values remain internally mutable for controlled updates such as
 * `setLayoutMode()`, and returned nested config objects are frozen.
 *
 * @module
 */
import type { ImageEditorOptions, LabelConfig, ResolvedCropConfig, ResolvedOptions } from './public-types.js';
/**
 * Documented defaults for every top-level option except the nested
 * {@link LabelConfig} and {@link CropConfig} configs, which are owned by
 * {@link DEFAULT_LABEL} and {@link DEFAULT_CROP} respectively.
 *
 * Values are the runtime defaults used when callers omit an option.
 * Nested label and crop defaults are carried by {@link DEFAULT_LABEL} and
 * {@link DEFAULT_CROP}.
 */
export declare const DEFAULT_OPTIONS: Omit<ResolvedOptions, 'label' | 'crop'>;
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
 * Resolves a partial {@link ImageEditorOptions} into a fully populated
 * {@link ResolvedOptions} object.
 *
 * Behavior matrix:
 *  - Every top-level key is taken from `input` when supplied, else from
 *    {@link DEFAULT_OPTIONS}.
 *  - `label.textOptions` is deep-merged with {@link DEFAULT_LABEL_TEXT_OPTIONS}
 *    so user keys override defaults and unspecified keys remain.
 *  - `crop.*` is shallow-merged with {@link DEFAULT_CROP} so each field falls
 *    back to its documented default when unspecified.
 *  - Callback values are normalized: function values are kept, anything
 *    else becomes `null`.
 *  - Unknown top-level keys are silently dropped.
 *  - The returned `label` and `crop` references are frozen so that mutating
 *    `input.label`, `input.label.textOptions`, or `input.crop` after the call
 *    cannot affect the live editor.
 *
 * @param input - Optional partial options object. Defaults to `{}`.
 */
export declare function resolveOptions(input?: ImageEditorOptions | null): ResolvedOptions;
//# sourceMappingURL=default-options.d.ts.map