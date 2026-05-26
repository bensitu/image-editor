/**
 * @file core/default-options.ts
 * @description Resolves user-supplied {@link ImageEditorOptions} into the
 * frozen {@link ResolvedOptions} object used at runtime.
 *
 * Behavior is defined by the documented option-resolution rules:
 *
 *   3.1  Every required top-level option falls back to the documented default.
 *   3.2  `label.textOptions` is deep-merged with the default text options.
 *   3.3  `crop.*` is deep-merged with the documented defaults.
 *   3.4  `crop.preserveMasksAfterCrop` defaults to `false` in v2.0.0.
 *   3.5  `preserveSourceFormat` defaults to `true`.
 *   3.6  `imageLoadTimeoutMs` defaults to `30000`.
 *   3.7  `onImageLoaded`, `onError`, `onWarning` are normalized — function
 *        values are kept, anything else (including `undefined`) becomes `null`.
 *   3.8  Callback signatures are preserved: `onImageLoaded: void`,
 *        `onError(error, message)`, `onWarning(error, message)`.
 *   3.9  Unknown top-level keys are ignored without throwing.
 *   3.10 The returned `label` and `crop` references are frozen so that
 *        post-construction mutation cannot leak into the live editor.
 */
import type { CropConfig, ImageEditorOptions, LabelConfig, ResolvedOptions } from './public-types.js';
/**
 * Documented defaults for every top-level option except the nested
 * {@link LabelConfig} and {@link CropConfig} configs, which are owned by
 * {@link DEFAULT_LABEL} and {@link DEFAULT_CROP} respectively.
 *
 * Values mirror the v1 constructor (see `baseline.md`) with two documented
 * v2 changes captured:
 *  - `preserveSourceFormat` is `true` (was effectively `false` in v1's
 *    JPEG-only resampler).
 *  - `crop.preserveMasksAfterCrop` is `false` (carried by {@link DEFAULT_CROP}).
 */
export declare const DEFAULT_OPTIONS: Required<Omit<ImageEditorOptions, 'label' | 'crop'>>;
/**
 * Default {@link LabelConfig}. Consumers can override `getText`, supply a
 * `create` factory, or provide partial `textOptions` — unspecified keys fall
 * back to {@link DEFAULT_LABEL_TEXT_OPTIONS}.
 */
export declare const DEFAULT_LABEL: LabelConfig;
/**
 * Default {@link CropConfig}. `preserveMasksAfterCrop` is `false` in v2.0.0
 * (the only documented default change carried over from v1).
 */
export declare const DEFAULT_CROP: Required<CropConfig>;
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
 *  - `onImageLoaded`, `onError`, and `onWarning` are normalized: function
 *    values are kept, anything else becomes `null`.
 *  - Unknown top-level keys are silently dropped.
 *  - The returned `label` and `crop` references are frozen so that mutating
 *    `input.label`, `input.label.textOptions`, or `input.crop` after the call
 *    cannot affect the live editor.
 *
 * @param input Optional partial options object. Defaults to `{}`.
 */
export declare function resolveOptions(input?: ImageEditorOptions | null): ResolvedOptions;
//# sourceMappingURL=default-options.d.ts.map