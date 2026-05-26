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

import type {
    CropConfig,
    ImageEditorOptions,
    LabelConfig,
    ResolvedOptions,
} from './public-types.js';

// ─── Defaults ────────────────────────────────────────────────────────────────

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
export const DEFAULT_OPTIONS: Required<Omit<ImageEditorOptions, 'label' | 'crop'>> = {
    // Canvas size
    canvasWidth: 800,
    canvasHeight: 600,
    backgroundColor: 'transparent',

    // Animation
    animationDuration: 300,
    minScale: 0.1,
    maxScale: 5.0,
    scaleStep: 0.05,
    rotationStep: 90,

    // Layout (precedence: fit > cover > expand)
    expandCanvasToImage: true,
    fitImageToCanvas: false,
    coverImageToCanvas: false,

    // Down-sampling
    downsampleOnLoad: true,
    downsampleMaxWidth: 4000,
    downsampleMaxHeight: 3000,
    downsampleQuality: 0.92,
    preserveSourceFormat: true,
    downsampleMimeType: null,

    // Image-load timeout
    imageLoadTimeoutMs: 30000,

    // Export
    exportMultiplier: 1,
    exportImageAreaByDefault: true,

    // Mask defaults
    defaultMaskWidth: 50,
    defaultMaskHeight: 80,
    maskRotatable: false,
    maskLabelOnSelect: true,
    maskLabelOffset: 3,
    maskName: 'mask',

    groupSelection: false,

    // Placeholder
    showPlaceholder: true,

    initialImageBase64: null,
    defaultDownloadFileName: 'edited_image.jpg',

    // Callbacks.  Defaults are `null`; non-function
    // user values are coerced to `null` in `resolveOptions`.
    onImageLoaded: null as unknown as () => void,
    onError: null as unknown as (error: unknown, message: string) => void,
    onWarning: null as unknown as (error: unknown, message: string) => void,
};

/**
 * Default text options applied to the auto-generated mask label. These are
 * deep-merged with `label.textOptions`.
 */
const DEFAULT_LABEL_TEXT_OPTIONS = {
    fontSize: 12,
    fill: '#fff',
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 2,
    fontFamily: 'monospace',
    fontWeight: 'bold',
    selectable: false,
    evented: false,
    originX: 'left',
    originY: 'top',
} as const;

/**
 * Default {@link LabelConfig}. Consumers can override `getText`, supply a
 * `create` factory, or provide partial `textOptions` — unspecified keys fall
 * back to {@link DEFAULT_LABEL_TEXT_OPTIONS}.
 */
export const DEFAULT_LABEL: LabelConfig = {
    getText: (mask) => mask.maskName,
    textOptions: {...DEFAULT_LABEL_TEXT_OPTIONS},
};

/**
 * Default {@link CropConfig}. `preserveMasksAfterCrop` is `false` in v2.0.0
 * (the only documented default change carried over from v1).
 */
export const DEFAULT_CROP: Required<CropConfig> = {
    minWidth: 100,
    minHeight: 100,
    padding: 10,
    hideMasksDuringCrop: true,
    preserveMasksAfterCrop: false,
    allowRotationOfCropRect: false,
};

// ─── Resolver ────────────────────────────────────────────────────────────────

/**
 * Set of recognized top-level keys on {@link ImageEditorOptions}. Used by
 * {@link resolveOptions} to drop unknown keys silently.
 */
const KNOWN_TOP_LEVEL_KEYS = new Set<keyof ImageEditorOptions>([
    'canvasWidth',
    'canvasHeight',
    'backgroundColor',
    'animationDuration',
    'minScale',
    'maxScale',
    'scaleStep',
    'rotationStep',
    'expandCanvasToImage',
    'fitImageToCanvas',
    'coverImageToCanvas',
    'downsampleOnLoad',
    'downsampleMaxWidth',
    'downsampleMaxHeight',
    'downsampleQuality',
    'preserveSourceFormat',
    'downsampleMimeType',
    'imageLoadTimeoutMs',
    'exportMultiplier',
    'exportImageAreaByDefault',
    'defaultMaskWidth',
    'defaultMaskHeight',
    'maskRotatable',
    'maskLabelOnSelect',
    'maskLabelOffset',
    'maskName',
    'groupSelection',
    'showPlaceholder',
    'initialImageBase64',
    'defaultDownloadFileName',
    'onImageLoaded',
    'onError',
    'onWarning',
    'label',
    'crop',
]);

/**
 * Coerces a callback option to a function or `null`.
 * Non-function values — `undefined`, `null`, primitives, plain objects — all
 * collapse to `null`. The function form is returned as-is so its public
 * signature is preserved.
 */
function normalizeCallback<F extends (...args: never[]) => unknown>(value: unknown): F | null {
    return typeof value === 'function' ? (value as F) : null;
}

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
export function resolveOptions(input?: ImageEditorOptions | null): ResolvedOptions {
    const raw: Partial<ImageEditorOptions> = input ?? {};

    // ── Top-level scalar / non-callback keys ────────────────────────────────
    // Start from the defaults, then overlay user-supplied values for keys we
    // recognize. Unknown keys are not copied.
    const resolved = {...DEFAULT_OPTIONS} as Required<Omit<ImageEditorOptions, 'label' | 'crop'>>;

    for (const key of Object.keys(raw) as Array<keyof ImageEditorOptions>) {
        if (!KNOWN_TOP_LEVEL_KEYS.has(key)) continue;
        // `label` and `crop` are handled separately below.
        if (key === 'label' || key === 'crop') continue;
        // Callbacks are normalized after this loop.
        if (key === 'onImageLoaded' || key === 'onError' || key === 'onWarning') continue;

        const value = raw[key];
        if (value === undefined) continue;
        // Type-system note: `resolved[key] = value` is sound here because
        // `KNOWN_TOP_LEVEL_KEYS` and the per-key `value` come from the same
        // `ImageEditorOptions` shape; the cast satisfies the indexed write.
        (resolved as Record<string, unknown>)[key as string] = value;
}

    // ── Callbacks ───────────────────────────────────
    resolved.onImageLoaded =
        normalizeCallback<() => void>(raw.onImageLoaded) ?? (null as unknown as () => void);
    resolved.onError =
        normalizeCallback<(error: unknown, message: string) => void>(raw.onError)
        ?? (null as unknown as (error: unknown, message: string) => void);
    resolved.onWarning =
        normalizeCallback<(error: unknown, message: string) => void>(raw.onWarning)
        ?? (null as unknown as (error: unknown, message: string) => void);

    // ── Label ─────────────────────────────────────────────
    // Deep-merge `textOptions` so user keys override defaults while leaving
    // unspecified default keys in place. Both `getText` and `create` must be
    // functions to be honored; otherwise the defaults apply.
    const userLabel: LabelConfig = (raw.label && typeof raw.label === 'object') ? raw.label : {};

    const mergedTextOptions = {
...DEFAULT_LABEL_TEXT_OPTIONS,
...(userLabel.textOptions && typeof userLabel.textOptions === 'object'
            ? userLabel.textOptions
            : {}),
};

    const label: LabelConfig = {
        getText: typeof userLabel.getText === 'function'
            ? userLabel.getText
            : DEFAULT_LABEL.getText,
        textOptions: mergedTextOptions,
};
    if (typeof userLabel.create === 'function') {
        label.create = userLabel.create;
}
    // Freeze the label reference and its textOptions sub-object so that
    // post-construction mutation of `input.label` or `input.label.textOptions`
    // cannot affect the live editor.
    Object.freeze(label.textOptions);
    Object.freeze(label);

    // ── Crop ──────────────────────────────────────────────
    const userCrop: CropConfig = (raw.crop && typeof raw.crop === 'object') ? raw.crop : {};
    const crop: Required<CropConfig> = {
        minWidth: userCrop.minWidth ?? DEFAULT_CROP.minWidth,
        minHeight: userCrop.minHeight ?? DEFAULT_CROP.minHeight,
        padding: userCrop.padding ?? DEFAULT_CROP.padding,
        hideMasksDuringCrop: userCrop.hideMasksDuringCrop ?? DEFAULT_CROP.hideMasksDuringCrop,
        preserveMasksAfterCrop: userCrop.preserveMasksAfterCrop ?? DEFAULT_CROP.preserveMasksAfterCrop,
        allowRotationOfCropRect: userCrop.allowRotationOfCropRect ?? DEFAULT_CROP.allowRotationOfCropRect,
};
    Object.freeze(crop);

    return {
...resolved,
        label,
        crop,
} as ResolvedOptions;
}
