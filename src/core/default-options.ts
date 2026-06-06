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

import type {
    CropConfig,
    DefaultMaskConfig,
    ExportArea,
    ImageEditorOptions,
    LabelConfig,
    ResolvedCropConfig,
    ResolvedOptions,
} from './public-types.js';

// ─── Defaults ────────────────────────────────────────────────────────────────

const EMPTY_DEFAULT_MASK_CONFIG = Object.freeze({}) as DefaultMaskConfig;

/**
 * Documented defaults for every top-level option except the nested
 * {@link LabelConfig} and {@link CropConfig} configs, which are owned by
 * {@link DEFAULT_LABEL} and {@link DEFAULT_CROP} respectively.
 *
 * Values are the runtime defaults used when callers omit an option.
 * Nested label and crop defaults are carried by {@link DEFAULT_LABEL} and
 * {@link DEFAULT_CROP}.
 */
export const DEFAULT_OPTIONS: Omit<ResolvedOptions, 'label' | 'crop'> = {
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
    maxHistorySize: 50,

    // Export
    exportMultiplier: 1,
    maxExportPixels: 50000000,
    exportAreaByDefault: 'image',
    mergeMaskByDefault: true,

    // Mask defaults
    defaultMaskWidth: 50,
    defaultMaskHeight: 80,
    defaultMaskConfig: EMPTY_DEFAULT_MASK_CONFIG,
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
    onImageLoadStart: null,
    onImageLoaded: null,
    onImageCleared: null,
    onImageChanged: null,
    onBusyChange: null,
    onEditorDisposed: null,
    onMasksChanged: null,
    onSelectionChange: null,
    onError: null,
    onWarning: null,
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
    textOptions: { ...DEFAULT_LABEL_TEXT_OPTIONS },
};

/**
 * Default {@link CropConfig}.
 */
export const DEFAULT_CROP: ResolvedCropConfig = {
    minWidth: 100,
    minHeight: 100,
    padding: 10,
    hideMasksDuringCrop: true,
    preserveMasksAfterCrop: false,
    allowRotationOfCropRect: false,
    exportFileType: 'source',
    exportQuality: undefined,
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
    'maxHistorySize',
    'exportMultiplier',
    'maxExportPixels',
    'exportAreaByDefault',
    'mergeMaskByDefault',
    'defaultMaskWidth',
    'defaultMaskHeight',
    'defaultMaskConfig',
    'maskRotatable',
    'maskLabelOnSelect',
    'maskLabelOffset',
    'maskName',
    'groupSelection',
    'showPlaceholder',
    'initialImageBase64',
    'defaultDownloadFileName',
    'onImageLoadStart',
    'onImageLoaded',
    'onImageCleared',
    'onImageChanged',
    'onBusyChange',
    'onEditorDisposed',
    'onMasksChanged',
    'onSelectionChange',
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

function isConfigObject(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function copyDefaultMaskConfigValue(value: unknown): unknown {
    return Array.isArray(value) ? [...value] : value;
}

function normalizeDefaultMaskConfig(value: unknown): DefaultMaskConfig {
    if (!isConfigObject(value)) return EMPTY_DEFAULT_MASK_CONFIG;

    const normalized: Record<string, unknown> = {};
    for (const [key, optionValue] of Object.entries(value)) {
        if (key === 'onCreate' || key === 'fabricGenerator' || key === 'styles') continue;
        normalized[key] = copyDefaultMaskConfigValue(optionValue);
    }

    const styles = value.styles;
    if (isConfigObject(styles)) {
        const copiedStyles: Record<string, unknown> = {};
        for (const [key, styleValue] of Object.entries(styles)) {
            copiedStyles[key] = copyDefaultMaskConfigValue(styleValue);
        }
        Object.freeze(copiedStyles);
        normalized.styles = copiedStyles;
    }

    Object.freeze(normalized);
    return normalized as DefaultMaskConfig;
}

function normalizePositiveInteger(value: unknown, fallback: number): number {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
    return Math.max(1, Math.floor(numeric));
}

function normalizePositiveFiniteNumber(value: unknown, fallback: number): number {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
    return numeric;
}

function normalizeNonNegativeFiniteNumber(value: unknown, fallback: number): number {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0) return fallback;
    return numeric;
}

function normalizeFiniteNumber(value: unknown, fallback: number): number {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return numeric;
}

function normalizeMaxHistorySize(value: unknown): number {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return DEFAULT_OPTIONS.maxHistorySize;
    return Math.max(1, Math.floor(numeric));
}

function normalizeQualityOption(value: unknown): number {
    if (value == null) return DEFAULT_OPTIONS.downsampleQuality;
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return DEFAULT_OPTIONS.downsampleQuality;
    return Math.max(0, Math.min(1, numeric));
}

function normalizeMaxExportPixels(value: unknown): number {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return DEFAULT_OPTIONS.maxExportPixels;
    return Math.max(1, Math.floor(numeric));
}

function normalizeExportArea(value: unknown): ExportArea {
    return value === 'canvas' || value === 'image' ? value : DEFAULT_OPTIONS.exportAreaByDefault;
}

function normalizeOptionalQuality(value: unknown): number | undefined {
    if (value === undefined || value === null) return undefined;
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return undefined;
    return Math.max(0, Math.min(1, numeric));
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
 *  - Callback values are normalized: function values are kept, anything
 *    else becomes `null`.
 *  - Unknown top-level keys are silently dropped.
 *  - The returned `label` and `crop` references are frozen so that mutating
 *    `input.label`, `input.label.textOptions`, or `input.crop` after the call
 *    cannot affect the live editor.
 *
 * @param input - Optional partial options object. Defaults to `{}`.
 */
export function resolveOptions(input?: ImageEditorOptions | null): ResolvedOptions {
    const raw: Partial<ImageEditorOptions> = input ?? {};

    // ── Top-level scalar / non-callback keys ────────────────────────────────
    // Start from the defaults, then overlay user-supplied values for keys we
    // recognize. Unknown keys are not copied.
    const resolved = { ...DEFAULT_OPTIONS } as Omit<ResolvedOptions, 'label' | 'crop'>;

    for (const key of Object.keys(raw) as Array<keyof ImageEditorOptions>) {
        if (!KNOWN_TOP_LEVEL_KEYS.has(key)) continue;
        // `label` and `crop` are handled separately below.
        if (key === 'label' || key === 'crop') continue;
        // Callbacks are normalized after this loop.
        if (
            key === 'onImageLoadStart' ||
            key === 'onImageLoaded' ||
            key === 'onImageCleared' ||
            key === 'onImageChanged' ||
            key === 'onBusyChange' ||
            key === 'onEditorDisposed' ||
            key === 'onMasksChanged' ||
            key === 'onSelectionChange' ||
            key === 'onError' ||
            key === 'onWarning'
        ) {
            continue;
        }

        const value = raw[key];
        if (value === undefined) continue;
        if (key === 'downsampleQuality') {
            resolved.downsampleQuality = normalizeQualityOption(value);
            continue;
        }
        if (key === 'maxExportPixels') {
            resolved.maxExportPixels = normalizeMaxExportPixels(value);
            continue;
        }
        if (key === 'exportAreaByDefault') {
            resolved.exportAreaByDefault = normalizeExportArea(value);
            continue;
        }
        if (key === 'canvasWidth') {
            resolved.canvasWidth = normalizePositiveInteger(value, DEFAULT_OPTIONS.canvasWidth);
            continue;
        }
        if (key === 'canvasHeight') {
            resolved.canvasHeight = normalizePositiveInteger(value, DEFAULT_OPTIONS.canvasHeight);
            continue;
        }
        if (key === 'animationDuration') {
            resolved.animationDuration = normalizeNonNegativeFiniteNumber(
                value,
                DEFAULT_OPTIONS.animationDuration,
            );
            continue;
        }
        if (key === 'minScale') {
            resolved.minScale = normalizePositiveFiniteNumber(value, DEFAULT_OPTIONS.minScale);
            continue;
        }
        if (key === 'maxScale') {
            resolved.maxScale = normalizePositiveFiniteNumber(value, DEFAULT_OPTIONS.maxScale);
            continue;
        }
        if (key === 'scaleStep') {
            resolved.scaleStep = normalizePositiveFiniteNumber(value, DEFAULT_OPTIONS.scaleStep);
            continue;
        }
        if (key === 'rotationStep') {
            resolved.rotationStep = normalizeFiniteNumber(value, DEFAULT_OPTIONS.rotationStep);
            continue;
        }
        if (key === 'downsampleMaxWidth') {
            resolved.downsampleMaxWidth = normalizePositiveInteger(
                value,
                DEFAULT_OPTIONS.downsampleMaxWidth,
            );
            continue;
        }
        if (key === 'downsampleMaxHeight') {
            resolved.downsampleMaxHeight = normalizePositiveInteger(
                value,
                DEFAULT_OPTIONS.downsampleMaxHeight,
            );
            continue;
        }
        if (key === 'imageLoadTimeoutMs') {
            resolved.imageLoadTimeoutMs = normalizePositiveInteger(
                value,
                DEFAULT_OPTIONS.imageLoadTimeoutMs,
            );
            continue;
        }
        if (key === 'exportMultiplier') {
            resolved.exportMultiplier = normalizePositiveFiniteNumber(
                value,
                DEFAULT_OPTIONS.exportMultiplier,
            );
            continue;
        }
        if (key === 'defaultMaskWidth') {
            resolved.defaultMaskWidth = normalizePositiveFiniteNumber(
                value,
                DEFAULT_OPTIONS.defaultMaskWidth,
            );
            continue;
        }
        if (key === 'defaultMaskHeight') {
            resolved.defaultMaskHeight = normalizePositiveFiniteNumber(
                value,
                DEFAULT_OPTIONS.defaultMaskHeight,
            );
            continue;
        }
        if (key === 'defaultMaskConfig') {
            resolved.defaultMaskConfig = normalizeDefaultMaskConfig(value);
            continue;
        }
        if (key === 'maskLabelOffset') {
            resolved.maskLabelOffset = normalizeNonNegativeFiniteNumber(
                value,
                DEFAULT_OPTIONS.maskLabelOffset,
            );
            continue;
        }
        // Type-system note: `resolved[key] = value` is sound here because
        // `KNOWN_TOP_LEVEL_KEYS` and the per-key `value` come from the same
        // `ImageEditorOptions` shape; the cast satisfies the indexed write.
        (resolved as Record<string, unknown>)[key as string] = value;
    }

    // ── Callbacks ───────────────────────────────────
    resolved.onImageLoadStart = normalizeCallback<
        NonNullable<ImageEditorOptions['onImageLoadStart']>
    >(raw.onImageLoadStart);
    resolved.onImageLoaded = normalizeCallback<NonNullable<ImageEditorOptions['onImageLoaded']>>(
        raw.onImageLoaded,
    );
    resolved.onImageCleared = normalizeCallback<NonNullable<ImageEditorOptions['onImageCleared']>>(
        raw.onImageCleared,
    );
    resolved.onImageChanged = normalizeCallback<NonNullable<ImageEditorOptions['onImageChanged']>>(
        raw.onImageChanged,
    );
    resolved.onBusyChange = normalizeCallback<NonNullable<ImageEditorOptions['onBusyChange']>>(
        raw.onBusyChange,
    );
    resolved.onEditorDisposed = normalizeCallback<
        NonNullable<ImageEditorOptions['onEditorDisposed']>
    >(raw.onEditorDisposed);
    resolved.onMasksChanged = normalizeCallback<NonNullable<ImageEditorOptions['onMasksChanged']>>(
        raw.onMasksChanged,
    );
    resolved.onSelectionChange = normalizeCallback<
        NonNullable<ImageEditorOptions['onSelectionChange']>
    >(raw.onSelectionChange);
    resolved.onError = normalizeCallback<(error: unknown, message: string) => void>(raw.onError);
    resolved.onWarning = normalizeCallback<(error: unknown, message: string) => void>(
        raw.onWarning,
    );
    resolved.maxHistorySize = normalizeMaxHistorySize(resolved.maxHistorySize);
    resolved.maxExportPixels = normalizeMaxExportPixels(resolved.maxExportPixels);
    if (resolved.minScale > resolved.maxScale) {
        const minScale = resolved.minScale;
        resolved.minScale = resolved.maxScale;
        resolved.maxScale = minScale;
    }

    // ── Label ─────────────────────────────────────────────
    // Deep-merge `textOptions` so user keys override defaults while leaving
    // unspecified default keys in place. Both `getText` and `create` must be
    // functions to be honored; otherwise the defaults apply.
    const userLabel: LabelConfig = raw.label && typeof raw.label === 'object' ? raw.label : {};

    const mergedTextOptions = {
        ...DEFAULT_LABEL_TEXT_OPTIONS,
        ...(userLabel.textOptions && typeof userLabel.textOptions === 'object'
            ? userLabel.textOptions
            : {}),
    };

    const label: LabelConfig = {
        getText:
            typeof userLabel.getText === 'function' ? userLabel.getText : DEFAULT_LABEL.getText,
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
    const userCrop: CropConfig = raw.crop && typeof raw.crop === 'object' ? raw.crop : {};
    const crop: ResolvedCropConfig = {
        minWidth: normalizePositiveFiniteNumber(userCrop.minWidth, DEFAULT_CROP.minWidth),
        minHeight: normalizePositiveFiniteNumber(userCrop.minHeight, DEFAULT_CROP.minHeight),
        padding: normalizeNonNegativeFiniteNumber(userCrop.padding, DEFAULT_CROP.padding),
        hideMasksDuringCrop: userCrop.hideMasksDuringCrop ?? DEFAULT_CROP.hideMasksDuringCrop,
        preserveMasksAfterCrop:
            userCrop.preserveMasksAfterCrop ?? DEFAULT_CROP.preserveMasksAfterCrop,
        allowRotationOfCropRect:
            userCrop.allowRotationOfCropRect ?? DEFAULT_CROP.allowRotationOfCropRect,
        exportFileType: userCrop.exportFileType ?? DEFAULT_CROP.exportFileType,
        exportQuality: normalizeOptionalQuality(userCrop.exportQuality),
    };
    Object.freeze(crop);

    return {
        ...resolved,
        label,
        crop,
    } as ResolvedOptions;
}
