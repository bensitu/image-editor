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

import type {
    CropAspectRatio,
    CropConfig,
    CropExportFileType,
    DefaultMaskConfig,
    DrawConfig,
    ExportArea,
    ImageEditorOptions,
    ImageMimeType,
    LabelConfig,
    LayoutMode,
    MosaicConfig,
    MosaicOutputFileType,
    OverlayListOrder,
    ResolvedCropConfig,
    ResolvedDrawConfig,
    ResolvedMosaicConfig,
    ResolvedOptions,
    ResolvedTextAnnotationConfig,
    TextAnnotationConfig,
} from './public-types.js';
import { tryNormalizeImageFormat } from '../export/export-format.js';

// ─── Defaults ────────────────────────────────────────────────────────────────

const EMPTY_DEFAULT_MASK_CONFIG = Object.freeze({}) as DefaultMaskConfig;
const DEFAULT_LAYOUT_MODE: LayoutMode = 'expand';
const DEFAULT_OVERLAY_LIST_ORDER: OverlayListOrder = 'front-to-back';

/**
 * Documented defaults for every top-level option except the nested
 * {@link LabelConfig} and {@link CropConfig} configs, which are owned by
 * {@link DEFAULT_LABEL} and {@link DEFAULT_CROP} respectively.
 *
 * Values are the runtime defaults used when callers omit an option.
 * Nested label and crop defaults are carried by {@link DEFAULT_LABEL} and
 * {@link DEFAULT_CROP}.
 */
export const DEFAULT_OPTIONS: Omit<
    ResolvedOptions,
    'label' | 'crop' | 'defaultMosaicConfig' | 'defaultTextConfig' | 'defaultDrawConfig'
> = {
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

    // Layout
    defaultLayoutMode: DEFAULT_LAYOUT_MODE,
    layoutMode: DEFAULT_LAYOUT_MODE,

    // Down-sampling
    downsampleOnLoad: true,
    downsampleMaxWidth: 4000,
    downsampleMaxHeight: 3000,
    downsampleQuality: 0.92,
    preserveSourceFormat: true,
    downsampleMimeType: null,

    // File loading
    autoOrientImage: true,
    autoOrientImageQuality: null,
    maxInputBytes: 50000000,
    maxInputPixels: 50000000,

    // Image-load timeout
    imageLoadTimeoutMs: 30000,
    maxHistorySize: 50,

    // Export
    exportMultiplier: 1,
    maxExportPixels: 50000000,
    maxExportDimension: 16384,
    exportAreaByDefault: 'image',
    mergeMasksByDefault: true,
    mergeAnnotationsByDefault: true,

    // Mask defaults
    defaultMaskWidth: 50,
    defaultMaskHeight: 80,
    defaultMaskConfig: EMPTY_DEFAULT_MASK_CONFIG,
    maskRotatable: false,
    maskLabelOnSelect: true,
    maskLabelOffset: 3,
    maskName: 'mask',
    textAnnotationName: 'text',
    drawAnnotationName: 'draw',
    maskListOrder: DEFAULT_OVERLAY_LIST_ORDER,
    annotationListOrder: DEFAULT_OVERLAY_LIST_ORDER,

    groupSelection: false,

    // Placeholder
    showPlaceholder: true,

    initialImageBase64: null,
    defaultDownloadFileName: 'edited_image',

    // Callbacks.  Defaults are `null`; non-function
    // user values are coerced to `null` in `resolveOptions`.
    onImageLoadStart: null,
    onImageLoaded: null,
    onImageCleared: null,
    onImageChanged: null,
    onBusyChange: null,
    onToolModeChange: null,
    onHistoryChange: null,
    onEditorDisposed: null,
    onMasksChanged: null,
    onAnnotationsChanged: null,
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
    aspectRatio: 'free',
    minWidth: 100,
    minHeight: 100,
    padding: 10,
    hideMasksDuringCrop: true,
    preserveMasksAfterCrop: false,
    allowRotationOfCropRect: false,
    exportFileType: 'source',
    exportQuality: undefined,
};

/**
 * Default Mosaic configuration used to seed each editor's current runtime
 * Mosaic tool config.
 */
export const DEFAULT_MOSAIC_CONFIG: ResolvedMosaicConfig = Object.freeze({
    brushSize: 48,
    blockSize: 8,
    previewStroke: '#333',
    previewStrokeWidth: 1,
    previewStrokeDashArray: Object.freeze([4, 4]),
    previewFill: 'rgba(0,0,0,0)',
    outputFileType: 'source',
    outputQuality: undefined,
});

export const DEFAULT_TEXT_ANNOTATION_CONFIG: ResolvedTextAnnotationConfig = Object.freeze({
    text: 'Text',
    left: undefined,
    top: undefined,
    width: 200,
    fontSize: 32,
    fontFamily: 'sans-serif',
    fontWeight: 'normal',
    fill: '#ff0000',
    backgroundColor: 'rgba(255,255,255,0)',
    textAlign: 'left',
    angle: 0,
    selectable: true,
    evented: true,
    editable: true,
    enterEditing: true,
    annotationHidden: false,
    annotationLocked: false,
    styles: Object.freeze({}) as Partial<import('fabric').TextboxProps>,
});

export const DEFAULT_DRAW_CONFIG: ResolvedDrawConfig = Object.freeze({
    brushSize: 8,
    color: '#ff0000',
    opacity: 1,
    lineCap: 'round',
    lineJoin: 'round',
    selectable: true,
    evented: true,
    annotationHidden: false,
    annotationLocked: false,
});

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
    'defaultLayoutMode',
    'downsampleOnLoad',
    'downsampleMaxWidth',
    'downsampleMaxHeight',
    'downsampleQuality',
    'preserveSourceFormat',
    'downsampleMimeType',
    'autoOrientImage',
    'autoOrientImageQuality',
    'maxInputBytes',
    'maxInputPixels',
    'imageLoadTimeoutMs',
    'maxHistorySize',
    'exportMultiplier',
    'maxExportPixels',
    'maxExportDimension',
    'exportAreaByDefault',
    'mergeMasksByDefault',
    'mergeAnnotationsByDefault',
    'defaultMaskWidth',
    'defaultMaskHeight',
    'defaultMaskConfig',
    'maskRotatable',
    'maskLabelOnSelect',
    'maskLabelOffset',
    'maskName',
    'textAnnotationName',
    'drawAnnotationName',
    'maskListOrder',
    'annotationListOrder',
    'groupSelection',
    'showPlaceholder',
    'initialImageBase64',
    'defaultDownloadFileName',
    'onImageLoadStart',
    'onImageLoaded',
    'onImageCleared',
    'onImageChanged',
    'onBusyChange',
    'onToolModeChange',
    'onHistoryChange',
    'onEditorDisposed',
    'onMasksChanged',
    'onAnnotationsChanged',
    'onSelectionChange',
    'onError',
    'onWarning',
    'label',
    'crop',
    'defaultMosaicConfig',
    'defaultTextConfig',
    'defaultDrawConfig',
]);

const UNSAFE_OBJECT_COPY_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Coerces a callback option to a function or `null`.
 * Non-function values — `undefined`, `null`, primitives, plain objects — all
 * collapse to `null`. The function form is returned as-is so its public
 * signature is preserved.
 */
function normalizeCallback<F extends (...args: never[]) => unknown>(value: unknown): F | null {
    return typeof value === 'function' ? (value as F) : null;
}

export function isLayoutMode(value: unknown): value is LayoutMode {
    return value === 'fit' || value === 'cover' || value === 'expand';
}

function normalizeLayoutMode(value: unknown): LayoutMode {
    return isLayoutMode(value) ? value : DEFAULT_LAYOUT_MODE;
}

function isConfigObject(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function copyDefaultMaskConfigValue(value: unknown): unknown {
    return Array.isArray(value) ? [...value] : value;
}

function canCopyObjectConfigKey(key: string): boolean {
    return !UNSAFE_OBJECT_COPY_KEYS.has(key);
}

function normalizeDefaultMaskConfig(value: unknown): DefaultMaskConfig {
    if (!isConfigObject(value)) return EMPTY_DEFAULT_MASK_CONFIG;

    const normalized = Object.create(null) as Record<string, unknown>;
    for (const [key, optionValue] of Object.entries(value)) {
        if (!canCopyObjectConfigKey(key)) continue;
        if (key === 'onCreate' || key === 'fabricGenerator' || key === 'styles') continue;
        normalized[key] = copyDefaultMaskConfigValue(optionValue);
    }

    const styles = value.styles;
    if (isConfigObject(styles)) {
        const copiedStyles = Object.create(null) as Record<string, unknown>;
        for (const [key, styleValue] of Object.entries(styles)) {
            if (!canCopyObjectConfigKey(key)) continue;
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

function normalizeNullableQualityOption(value: unknown): number | null {
    if (value == null) return null;
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return null;
    return Math.max(0, Math.min(1, numeric));
}

function normalizeMaxExportPixels(value: unknown): number {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return DEFAULT_OPTIONS.maxExportPixels;
    return Math.max(1, Math.floor(numeric));
}

function normalizeMaxExportDimension(value: unknown): number {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return DEFAULT_OPTIONS.maxExportDimension;
    return Math.max(1, Math.floor(numeric));
}

function normalizeMaxInputBytes(value: unknown): number {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return DEFAULT_OPTIONS.maxInputBytes;
    return Math.max(1, Math.floor(numeric));
}

function normalizeMaxInputPixels(value: unknown): number {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return DEFAULT_OPTIONS.maxInputPixels;
    return Math.max(1, Math.floor(numeric));
}

function normalizeExportArea(value: unknown): ExportArea {
    return value === 'canvas' || value === 'image' ? value : DEFAULT_OPTIONS.exportAreaByDefault;
}

function normalizeOverlayListOrder(value: unknown, fallback: OverlayListOrder): OverlayListOrder {
    return value === 'front-to-back' || value === 'back-to-front' ? value : fallback;
}

function isImageMimeType(value: unknown): value is ImageMimeType {
    return value === 'image/jpeg' || value === 'image/png' || value === 'image/webp';
}

function normalizeImageMimeTypeOption(
    value: unknown,
    fallback: ImageMimeType | null,
): ImageMimeType | null {
    if (value === null) return null;
    return isImageMimeType(value) ? value : fallback;
}

function normalizeNullableString(value: unknown, fallback: string | null): string | null {
    if (value === null) return null;
    return typeof value === 'string' ? value : fallback;
}

const CROP_ASPECT_RATIO_PRESETS: ReadonlySet<string> = new Set([
    'free',
    '1:1',
    '3:4',
    '4:3',
    '3:2',
    '2:3',
    '9:16',
    '16:9',
]);

function hasValidCropRatioParts(width: unknown, height: unknown): boolean {
    return (
        typeof width === 'number' &&
        typeof height === 'number' &&
        Number.isFinite(width) &&
        Number.isFinite(height) &&
        width > 0 &&
        height > 0
    );
}

function normalizeCropAspectRatioOption(value: unknown): CropAspectRatio {
    if (value === undefined || value === null) return DEFAULT_CROP.aspectRatio;

    if (typeof value === 'number') {
        return Number.isFinite(value) && value > 0 ? value : DEFAULT_CROP.aspectRatio;
    }

    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (CROP_ASPECT_RATIO_PRESETS.has(trimmed)) return trimmed as CropAspectRatio;

        const parts = trimmed.split(':');
        if (parts.length === 2) {
            const width = Number(parts[0]);
            const height = Number(parts[1]);
            if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
                return trimmed as CropAspectRatio;
            }
        }

        return DEFAULT_CROP.aspectRatio;
    }

    if (isConfigObject(value) && hasValidCropRatioParts(value.width, value.height)) {
        return { width: value.width as number, height: value.height as number };
    }

    return DEFAULT_CROP.aspectRatio;
}

function normalizeCropExportFileTypeOption(value: unknown): CropExportFileType {
    if (value === undefined || value === null) return DEFAULT_CROP.exportFileType;
    if (value === 'source') return 'source';
    return typeof value === 'string' && tryNormalizeImageFormat(value)
        ? (value as CropExportFileType)
        : DEFAULT_CROP.exportFileType;
}

function normalizeOptionalQuality(value: unknown): number | undefined {
    if (value === undefined || value === null) return undefined;
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return undefined;
    return Math.max(0, Math.min(1, numeric));
}

function hasOwn(object: Record<string, unknown>, key: string): boolean {
    return Object.prototype.hasOwnProperty.call(object, key);
}

function isFiniteNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}

function normalizeMosaicPositiveNumber(value: unknown, fallback: number): number {
    return isFiniteNumber(value) && value > 0 ? value : fallback;
}

function normalizeMosaicBlockSize(value: unknown, fallback: number): number {
    return isFiniteNumber(value) && value > 0 ? Math.max(1, Math.floor(value)) : fallback;
}

function normalizeMosaicNonNegativeNumber(value: unknown, fallback: number): number {
    return isFiniteNumber(value) && value >= 0 ? value : fallback;
}

function normalizeMosaicDashArray(
    value: unknown,
    fallback: readonly number[] | null,
): number[] | null {
    if (value === null) return null;
    if (
        Array.isArray(value) &&
        value.every((entry) => typeof entry === 'number' && Number.isFinite(entry) && entry >= 0)
    ) {
        return [...value];
    }
    return fallback ? [...fallback] : null;
}

function normalizeMosaicOutputFileType(
    value: unknown,
    fallback: MosaicOutputFileType,
): MosaicOutputFileType {
    if (value === 'source') return 'source';
    if (typeof value !== 'string') return fallback;
    return tryNormalizeImageFormat(value) ?? fallback;
}

function normalizeMosaicOutputQuality(
    value: unknown,
    fallback: number | undefined,
): number | undefined {
    if (value === undefined || value === null) return undefined;
    if (!isFiniteNumber(value)) return fallback;
    return Math.max(0, Math.min(1, value));
}

/**
 * Return a mutable defensive copy of a resolved Mosaic config.
 */
export function cloneResolvedMosaicConfig(config: ResolvedMosaicConfig): ResolvedMosaicConfig {
    return {
        ...config,
        previewStrokeDashArray: config.previewStrokeDashArray
            ? [...config.previewStrokeDashArray]
            : null,
    };
}

/**
 * Normalize a constructor-level Mosaic config against a resolved fallback.
 */
export function normalizeMosaicConfig(
    input: unknown,
    fallback: ResolvedMosaicConfig,
): ResolvedMosaicConfig {
    if (!isConfigObject(input)) return cloneResolvedMosaicConfig(fallback);
    return mergeMosaicConfigPatch(fallback, input as MosaicConfig);
}

/**
 * Merge a runtime Mosaic config patch into the current resolved config.
 * Omitted fields remain unchanged; invalid fields fall back to `current`.
 */
export function mergeMosaicConfigPatch(
    current: ResolvedMosaicConfig,
    patch: MosaicConfig,
    fallback: ResolvedMosaicConfig = current,
): ResolvedMosaicConfig {
    const raw = isConfigObject(patch) ? patch : {};
    const next = cloneResolvedMosaicConfig(current);

    if (hasOwn(raw, 'brushSize')) {
        next.brushSize = normalizeMosaicPositiveNumber(raw.brushSize, fallback.brushSize);
    }
    if (hasOwn(raw, 'blockSize')) {
        next.blockSize = normalizeMosaicBlockSize(raw.blockSize, fallback.blockSize);
    }
    if (hasOwn(raw, 'previewStroke')) {
        next.previewStroke =
            typeof raw.previewStroke === 'string' ? raw.previewStroke : fallback.previewStroke;
    }
    if (hasOwn(raw, 'previewStrokeWidth')) {
        next.previewStrokeWidth = normalizeMosaicNonNegativeNumber(
            raw.previewStrokeWidth,
            fallback.previewStrokeWidth,
        );
    }
    if (hasOwn(raw, 'previewStrokeDashArray')) {
        next.previewStrokeDashArray = normalizeMosaicDashArray(
            raw.previewStrokeDashArray,
            fallback.previewStrokeDashArray,
        );
    }
    if (hasOwn(raw, 'previewFill')) {
        next.previewFill =
            typeof raw.previewFill === 'string' ? raw.previewFill : fallback.previewFill;
    }
    if (hasOwn(raw, 'outputFileType')) {
        next.outputFileType = normalizeMosaicOutputFileType(
            raw.outputFileType,
            fallback.outputFileType,
        );
    }
    if (hasOwn(raw, 'outputQuality')) {
        next.outputQuality = normalizeMosaicOutputQuality(
            raw.outputQuality,
            fallback.outputQuality,
        );
    }

    return next;
}

/**
 * Returns invalid Mosaic config field names for warning/reporting paths.
 */
export function getInvalidMosaicConfigFields(input: MosaicConfig): string[] {
    const raw = isConfigObject(input) ? input : {};
    const invalid: string[] = [];

    if (
        hasOwn(raw, 'brushSize') &&
        !(typeof raw.brushSize === 'number' && Number.isFinite(raw.brushSize) && raw.brushSize > 0)
    ) {
        invalid.push('brushSize');
    }
    if (
        hasOwn(raw, 'blockSize') &&
        !(typeof raw.blockSize === 'number' && Number.isFinite(raw.blockSize) && raw.blockSize > 0)
    ) {
        invalid.push('blockSize');
    }
    if (hasOwn(raw, 'previewStroke') && typeof raw.previewStroke !== 'string') {
        invalid.push('previewStroke');
    }
    if (
        hasOwn(raw, 'previewStrokeWidth') &&
        !(
            typeof raw.previewStrokeWidth === 'number' &&
            Number.isFinite(raw.previewStrokeWidth) &&
            raw.previewStrokeWidth >= 0
        )
    ) {
        invalid.push('previewStrokeWidth');
    }
    if (hasOwn(raw, 'previewStrokeDashArray')) {
        const value = raw.previewStrokeDashArray;
        const valid =
            value === null ||
            (Array.isArray(value) &&
                value.every(
                    (entry) => typeof entry === 'number' && Number.isFinite(entry) && entry >= 0,
                ));
        if (!valid) invalid.push('previewStrokeDashArray');
    }
    if (hasOwn(raw, 'previewFill') && typeof raw.previewFill !== 'string') {
        invalid.push('previewFill');
    }
    if (hasOwn(raw, 'outputFileType')) {
        const value = raw.outputFileType;
        const valid =
            value === 'source' || (typeof value === 'string' && tryNormalizeImageFormat(value));
        if (!valid) invalid.push('outputFileType');
    }
    if (
        hasOwn(raw, 'outputQuality') &&
        raw.outputQuality !== undefined &&
        raw.outputQuality !== null &&
        !(typeof raw.outputQuality === 'number' && Number.isFinite(raw.outputQuality))
    ) {
        invalid.push('outputQuality');
    }

    return invalid;
}

/**
 * Strict value equality for resolved Mosaic configs.
 */
export function areResolvedMosaicConfigsEqual(
    left: ResolvedMosaicConfig,
    right: ResolvedMosaicConfig,
): boolean {
    const leftDash = left.previewStrokeDashArray;
    const rightDash = right.previewStrokeDashArray;
    const dashEqual =
        leftDash === rightDash ||
        (Array.isArray(leftDash) &&
            Array.isArray(rightDash) &&
            leftDash.length === rightDash.length &&
            leftDash.every((value, index) => value === rightDash[index]));

    return (
        left.brushSize === right.brushSize &&
        left.blockSize === right.blockSize &&
        left.previewStroke === right.previewStroke &&
        left.previewStrokeWidth === right.previewStrokeWidth &&
        dashEqual &&
        left.previewFill === right.previewFill &&
        left.outputFileType === right.outputFileType &&
        left.outputQuality === right.outputQuality
    );
}

export function cloneResolvedTextAnnotationConfig(
    config: ResolvedTextAnnotationConfig,
): ResolvedTextAnnotationConfig {
    return {
        ...config,
        styles: { ...config.styles },
    };
}

export function cloneResolvedDrawConfig(config: ResolvedDrawConfig): ResolvedDrawConfig {
    return { ...config };
}

function normalizeTextAlign(
    value: unknown,
    fallback: ResolvedTextAnnotationConfig['textAlign'],
): ResolvedTextAnnotationConfig['textAlign'] {
    return value === 'left' || value === 'center' || value === 'right' || value === 'justify'
        ? value
        : fallback;
}

function normalizePositiveNumber(value: unknown, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
    return typeof value === 'boolean' ? value : fallback;
}

function normalizeString(value: unknown, fallback: string): string {
    return typeof value === 'string' ? value : fallback;
}

function normalizeTextLeftTop(value: unknown): number | undefined {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function normalizeTextboxStyles(value: unknown): Partial<import('fabric').TextboxProps> {
    if (!isConfigObject(value)) return {};
    return { ...value } as Partial<import('fabric').TextboxProps>;
}

export function mergeTextAnnotationConfigPatch(
    current: ResolvedTextAnnotationConfig,
    patch: TextAnnotationConfig,
    fallback: ResolvedTextAnnotationConfig = current,
): ResolvedTextAnnotationConfig {
    const raw = isConfigObject(patch) ? patch : {};
    const next = cloneResolvedTextAnnotationConfig(current);

    if (hasOwn(raw, 'text')) next.text = normalizeString(raw.text, fallback.text);
    if (hasOwn(raw, 'left')) next.left = normalizeTextLeftTop(raw.left);
    if (hasOwn(raw, 'top')) next.top = normalizeTextLeftTop(raw.top);
    if (hasOwn(raw, 'width')) next.width = normalizePositiveNumber(raw.width, fallback.width);
    if (hasOwn(raw, 'fontSize')) {
        next.fontSize = normalizePositiveNumber(raw.fontSize, fallback.fontSize);
    }
    if (hasOwn(raw, 'fontFamily')) {
        next.fontFamily = normalizeString(raw.fontFamily, fallback.fontFamily);
    }
    if (hasOwn(raw, 'fontWeight')) {
        next.fontWeight =
            typeof raw.fontWeight === 'string' || typeof raw.fontWeight === 'number'
                ? raw.fontWeight
                : fallback.fontWeight;
    }
    if (hasOwn(raw, 'fill')) next.fill = normalizeString(raw.fill, fallback.fill);
    if (hasOwn(raw, 'backgroundColor')) {
        next.backgroundColor = normalizeString(raw.backgroundColor, fallback.backgroundColor);
    }
    if (hasOwn(raw, 'textAlign'))
        next.textAlign = normalizeTextAlign(raw.textAlign, fallback.textAlign);
    if (hasOwn(raw, 'angle')) next.angle = normalizeFiniteNumber(raw.angle, fallback.angle);
    if (hasOwn(raw, 'selectable'))
        next.selectable = normalizeBoolean(raw.selectable, fallback.selectable);
    if (hasOwn(raw, 'evented')) next.evented = normalizeBoolean(raw.evented, fallback.evented);
    if (hasOwn(raw, 'editable')) next.editable = normalizeBoolean(raw.editable, fallback.editable);
    if (hasOwn(raw, 'enterEditing')) {
        next.enterEditing = normalizeBoolean(raw.enterEditing, fallback.enterEditing);
    }
    if (hasOwn(raw, 'annotationHidden')) {
        next.annotationHidden = normalizeBoolean(raw.annotationHidden, fallback.annotationHidden);
    }
    if (hasOwn(raw, 'annotationLocked')) {
        next.annotationLocked = normalizeBoolean(raw.annotationLocked, fallback.annotationLocked);
    }
    if (hasOwn(raw, 'styles')) {
        next.styles = {
            ...next.styles,
            ...normalizeTextboxStyles(raw.styles),
        };
    }

    return next;
}

export function normalizeTextAnnotationConfig(
    input: unknown,
    fallback: ResolvedTextAnnotationConfig,
): ResolvedTextAnnotationConfig {
    if (!isConfigObject(input)) return cloneResolvedTextAnnotationConfig(fallback);
    return mergeTextAnnotationConfigPatch(fallback, input as TextAnnotationConfig);
}

function normalizeLineCap(value: unknown, fallback: CanvasLineCap): CanvasLineCap {
    return value === 'butt' || value === 'round' || value === 'square' ? value : fallback;
}

function normalizeLineJoin(value: unknown, fallback: CanvasLineJoin): CanvasLineJoin {
    return value === 'bevel' || value === 'round' || value === 'miter' ? value : fallback;
}

function normalizeOpacity(value: unknown, fallback: number): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
    return Math.max(0, Math.min(1, value));
}

export function mergeDrawConfigPatch(
    current: ResolvedDrawConfig,
    patch: DrawConfig,
    fallback: ResolvedDrawConfig = current,
): ResolvedDrawConfig {
    const raw = isConfigObject(patch) ? patch : {};
    const next = cloneResolvedDrawConfig(current);

    if (hasOwn(raw, 'brushSize')) {
        next.brushSize = normalizePositiveNumber(raw.brushSize, fallback.brushSize);
    }
    if (hasOwn(raw, 'color')) next.color = normalizeString(raw.color, fallback.color);
    if (hasOwn(raw, 'opacity')) next.opacity = normalizeOpacity(raw.opacity, fallback.opacity);
    if (hasOwn(raw, 'lineCap')) next.lineCap = normalizeLineCap(raw.lineCap, fallback.lineCap);
    if (hasOwn(raw, 'lineJoin')) next.lineJoin = normalizeLineJoin(raw.lineJoin, fallback.lineJoin);
    if (hasOwn(raw, 'selectable'))
        next.selectable = normalizeBoolean(raw.selectable, fallback.selectable);
    if (hasOwn(raw, 'evented')) next.evented = normalizeBoolean(raw.evented, fallback.evented);
    if (hasOwn(raw, 'annotationHidden')) {
        next.annotationHidden = normalizeBoolean(raw.annotationHidden, fallback.annotationHidden);
    }
    if (hasOwn(raw, 'annotationLocked')) {
        next.annotationLocked = normalizeBoolean(raw.annotationLocked, fallback.annotationLocked);
    }

    return next;
}

export function normalizeDrawConfig(
    input: unknown,
    fallback: ResolvedDrawConfig,
): ResolvedDrawConfig {
    if (!isConfigObject(input)) return cloneResolvedDrawConfig(fallback);
    return mergeDrawConfigPatch(fallback, input as DrawConfig);
}

export function areResolvedTextAnnotationConfigsEqual(
    left: ResolvedTextAnnotationConfig,
    right: ResolvedTextAnnotationConfig,
): boolean {
    return (
        left.text === right.text &&
        left.left === right.left &&
        left.top === right.top &&
        left.width === right.width &&
        left.fontSize === right.fontSize &&
        left.fontFamily === right.fontFamily &&
        left.fontWeight === right.fontWeight &&
        left.fill === right.fill &&
        left.backgroundColor === right.backgroundColor &&
        left.textAlign === right.textAlign &&
        left.angle === right.angle &&
        left.selectable === right.selectable &&
        left.evented === right.evented &&
        left.editable === right.editable &&
        left.enterEditing === right.enterEditing &&
        left.annotationHidden === right.annotationHidden &&
        left.annotationLocked === right.annotationLocked &&
        areStyleRecordsEqual(left.styles, right.styles)
    );
}

function areStyleRecordsEqual(left: unknown, right: unknown): boolean {
    return areStyleValuesEqual(left, right, new WeakMap<object, WeakSet<object>>());
}

function areStyleValuesEqual(
    left: unknown,
    right: unknown,
    seen: WeakMap<object, WeakSet<object>>,
): boolean {
    if (Object.is(left, right)) return true;
    if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false;

    let seenRights = seen.get(left);
    if (seenRights?.has(right)) return true;
    if (!seenRights) {
        seenRights = new WeakSet<object>();
        seen.set(left, seenRights);
    }
    seenRights.add(right);

    if (Array.isArray(left) || Array.isArray(right)) {
        return (
            Array.isArray(left) &&
            Array.isArray(right) &&
            left.length === right.length &&
            left.every((value, index) => areStyleValuesEqual(value, right[index], seen))
        );
    }

    const leftRecord = left as Record<string, unknown>;
    const rightRecord = right as Record<string, unknown>;
    const leftKeys = Object.keys(leftRecord);
    const rightKeys = Object.keys(rightRecord);
    if (leftKeys.length !== rightKeys.length) return false;

    return leftKeys.every((key) => {
        if (!hasOwn(rightRecord, key)) return false;
        return areStyleValuesEqual(leftRecord[key], rightRecord[key], seen);
    });
}

export function areResolvedDrawConfigsEqual(
    left: ResolvedDrawConfig,
    right: ResolvedDrawConfig,
): boolean {
    return (
        left.brushSize === right.brushSize &&
        left.color === right.color &&
        left.opacity === right.opacity &&
        left.lineCap === right.lineCap &&
        left.lineJoin === right.lineJoin &&
        left.selectable === right.selectable &&
        left.evented === right.evented &&
        left.annotationHidden === right.annotationHidden &&
        left.annotationLocked === right.annotationLocked
    );
}

export function getInvalidTextAnnotationConfigFields(input: TextAnnotationConfig): string[] {
    const raw = isConfigObject(input) ? input : {};
    const invalid: string[] = [];
    if (hasOwn(raw, 'text') && typeof raw.text !== 'string') invalid.push('text');
    if (hasOwn(raw, 'width') && !isFiniteNumber(raw.width)) invalid.push('width');
    if (hasOwn(raw, 'fontSize') && !isFiniteNumber(raw.fontSize)) invalid.push('fontSize');
    if (hasOwn(raw, 'fontFamily') && typeof raw.fontFamily !== 'string') invalid.push('fontFamily');
    if (hasOwn(raw, 'fill') && typeof raw.fill !== 'string') {
        invalid.push('fill');
    }
    return invalid;
}

export function getInvalidDrawConfigFields(input: DrawConfig): string[] {
    const raw = isConfigObject(input) ? input : {};
    const invalid: string[] = [];
    if (hasOwn(raw, 'brushSize') && !isFiniteNumber(raw.brushSize)) invalid.push('brushSize');
    if (hasOwn(raw, 'color') && typeof raw.color !== 'string') invalid.push('color');
    if (hasOwn(raw, 'opacity') && !isFiniteNumber(raw.opacity)) invalid.push('opacity');
    return invalid;
}

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
export function resolveOptions(input?: ImageEditorOptions | null): ResolvedOptions {
    const raw: Partial<ImageEditorOptions> = input ?? {};

    // ── Top-level scalar / non-callback keys ────────────────────────────────
    // Start from the defaults, then overlay user-supplied values for keys we
    // recognize. Unknown keys are not copied.
    const resolved = { ...DEFAULT_OPTIONS } as Omit<ResolvedOptions, 'label' | 'crop'>;

    for (const key of Object.keys(raw) as Array<keyof ImageEditorOptions>) {
        if (!KNOWN_TOP_LEVEL_KEYS.has(key)) continue;
        // Nested configs are handled separately below.
        if (
            key === 'label' ||
            key === 'crop' ||
            key === 'defaultMosaicConfig' ||
            key === 'defaultTextConfig' ||
            key === 'defaultDrawConfig'
        ) {
            continue;
        }
        // Callbacks are normalized after this loop.
        if (
            key === 'onImageLoadStart' ||
            key === 'onImageLoaded' ||
            key === 'onImageCleared' ||
            key === 'onImageChanged' ||
            key === 'onBusyChange' ||
            key === 'onToolModeChange' ||
            key === 'onHistoryChange' ||
            key === 'onEditorDisposed' ||
            key === 'onMasksChanged' ||
            key === 'onAnnotationsChanged' ||
            key === 'onSelectionChange' ||
            key === 'onError' ||
            key === 'onWarning'
        ) {
            continue;
        }

        const value = raw[key];
        if (value === undefined) continue;
        if (key === 'backgroundColor') {
            resolved.backgroundColor = normalizeString(value, DEFAULT_OPTIONS.backgroundColor);
            continue;
        }
        if (key === 'downsampleOnLoad') {
            resolved.downsampleOnLoad = normalizeBoolean(value, DEFAULT_OPTIONS.downsampleOnLoad);
            continue;
        }
        if (key === 'preserveSourceFormat') {
            resolved.preserveSourceFormat = normalizeBoolean(
                value,
                DEFAULT_OPTIONS.preserveSourceFormat,
            );
            continue;
        }
        if (key === 'downsampleMimeType') {
            resolved.downsampleMimeType = normalizeImageMimeTypeOption(
                value,
                DEFAULT_OPTIONS.downsampleMimeType,
            );
            continue;
        }
        if (key === 'autoOrientImage') {
            resolved.autoOrientImage = normalizeBoolean(value, DEFAULT_OPTIONS.autoOrientImage);
            continue;
        }
        if (key === 'autoOrientImageQuality') {
            resolved.autoOrientImageQuality = normalizeNullableQualityOption(value);
            continue;
        }
        if (key === 'maxInputBytes') {
            resolved.maxInputBytes = normalizeMaxInputBytes(value);
            continue;
        }
        if (key === 'maxInputPixels') {
            resolved.maxInputPixels = normalizeMaxInputPixels(value);
            continue;
        }
        if (key === 'mergeMasksByDefault') {
            resolved.mergeMasksByDefault = normalizeBoolean(
                value,
                DEFAULT_OPTIONS.mergeMasksByDefault,
            );
            continue;
        }
        if (key === 'mergeAnnotationsByDefault') {
            resolved.mergeAnnotationsByDefault = normalizeBoolean(
                value,
                DEFAULT_OPTIONS.mergeAnnotationsByDefault,
            );
            continue;
        }
        if (key === 'maskRotatable') {
            resolved.maskRotatable = normalizeBoolean(value, DEFAULT_OPTIONS.maskRotatable);
            continue;
        }
        if (key === 'maskLabelOnSelect') {
            resolved.maskLabelOnSelect = normalizeBoolean(value, DEFAULT_OPTIONS.maskLabelOnSelect);
            continue;
        }
        if (key === 'maskName') {
            resolved.maskName = normalizeString(value, DEFAULT_OPTIONS.maskName);
            continue;
        }
        if (key === 'textAnnotationName') {
            resolved.textAnnotationName = normalizeString(
                value,
                DEFAULT_OPTIONS.textAnnotationName,
            );
            continue;
        }
        if (key === 'drawAnnotationName') {
            resolved.drawAnnotationName = normalizeString(
                value,
                DEFAULT_OPTIONS.drawAnnotationName,
            );
            continue;
        }
        if (key === 'groupSelection') {
            resolved.groupSelection = normalizeBoolean(value, DEFAULT_OPTIONS.groupSelection);
            continue;
        }
        if (key === 'showPlaceholder') {
            resolved.showPlaceholder = normalizeBoolean(value, DEFAULT_OPTIONS.showPlaceholder);
            continue;
        }
        if (key === 'initialImageBase64') {
            resolved.initialImageBase64 = normalizeNullableString(
                value,
                DEFAULT_OPTIONS.initialImageBase64,
            );
            continue;
        }
        if (key === 'defaultDownloadFileName') {
            resolved.defaultDownloadFileName = normalizeString(
                value,
                DEFAULT_OPTIONS.defaultDownloadFileName,
            );
            continue;
        }
        if (key === 'downsampleQuality') {
            resolved.downsampleQuality = normalizeQualityOption(value);
            continue;
        }
        if (key === 'maxExportPixels') {
            resolved.maxExportPixels = normalizeMaxExportPixels(value);
            continue;
        }
        if (key === 'maxExportDimension') {
            resolved.maxExportDimension = normalizeMaxExportDimension(value);
            continue;
        }
        if (key === 'exportAreaByDefault') {
            resolved.exportAreaByDefault = normalizeExportArea(value);
            continue;
        }
        if (key === 'maskListOrder') {
            resolved.maskListOrder = normalizeOverlayListOrder(
                value,
                DEFAULT_OPTIONS.maskListOrder,
            );
            continue;
        }
        if (key === 'annotationListOrder') {
            resolved.annotationListOrder = normalizeOverlayListOrder(
                value,
                DEFAULT_OPTIONS.annotationListOrder,
            );
            continue;
        }
        if (key === 'defaultLayoutMode') {
            const layoutMode = normalizeLayoutMode(value);
            resolved.defaultLayoutMode = layoutMode;
            resolved.layoutMode = layoutMode;
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
    resolved.onToolModeChange = normalizeCallback<
        NonNullable<ImageEditorOptions['onToolModeChange']>
    >(raw.onToolModeChange);
    resolved.onHistoryChange = normalizeCallback<
        NonNullable<ImageEditorOptions['onHistoryChange']>
    >(raw.onHistoryChange);
    resolved.onEditorDisposed = normalizeCallback<
        NonNullable<ImageEditorOptions['onEditorDisposed']>
    >(raw.onEditorDisposed);
    resolved.onMasksChanged = normalizeCallback<NonNullable<ImageEditorOptions['onMasksChanged']>>(
        raw.onMasksChanged,
    );
    resolved.onAnnotationsChanged = normalizeCallback<
        NonNullable<ImageEditorOptions['onAnnotationsChanged']>
    >(raw.onAnnotationsChanged);
    resolved.onSelectionChange = normalizeCallback<
        NonNullable<ImageEditorOptions['onSelectionChange']>
    >(raw.onSelectionChange);
    resolved.onError = normalizeCallback<(error: unknown, message: string) => void>(raw.onError);
    resolved.onWarning = normalizeCallback<(error: unknown, message: string) => void>(
        raw.onWarning,
    );
    resolved.maxHistorySize = normalizeMaxHistorySize(resolved.maxHistorySize);
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
        aspectRatio: normalizeCropAspectRatioOption(userCrop.aspectRatio),
        minWidth: normalizePositiveFiniteNumber(userCrop.minWidth, DEFAULT_CROP.minWidth),
        minHeight: normalizePositiveFiniteNumber(userCrop.minHeight, DEFAULT_CROP.minHeight),
        padding: normalizeNonNegativeFiniteNumber(userCrop.padding, DEFAULT_CROP.padding),
        hideMasksDuringCrop: normalizeBoolean(
            userCrop.hideMasksDuringCrop,
            DEFAULT_CROP.hideMasksDuringCrop,
        ),
        preserveMasksAfterCrop: normalizeBoolean(
            userCrop.preserveMasksAfterCrop,
            DEFAULT_CROP.preserveMasksAfterCrop,
        ),
        allowRotationOfCropRect: normalizeBoolean(
            userCrop.allowRotationOfCropRect,
            DEFAULT_CROP.allowRotationOfCropRect,
        ),
        exportFileType: normalizeCropExportFileTypeOption(userCrop.exportFileType),
        exportQuality: normalizeOptionalQuality(userCrop.exportQuality),
    };
    Object.freeze(crop);

    // ── Mosaic ───────────────────────────────────────────
    const defaultMosaicConfig = normalizeMosaicConfig(
        raw.defaultMosaicConfig,
        DEFAULT_MOSAIC_CONFIG,
    );
    if (defaultMosaicConfig.previewStrokeDashArray) {
        Object.freeze(defaultMosaicConfig.previewStrokeDashArray);
    }
    Object.freeze(defaultMosaicConfig);

    // ── Text annotation ─────────────────────────────────────────────────
    const defaultTextConfig = normalizeTextAnnotationConfig(
        raw.defaultTextConfig,
        DEFAULT_TEXT_ANNOTATION_CONFIG,
    );
    Object.freeze(defaultTextConfig.styles);
    Object.freeze(defaultTextConfig);

    // ── Draw annotation ─────────────────────────────────────────────────
    const defaultDrawConfig = normalizeDrawConfig(raw.defaultDrawConfig, DEFAULT_DRAW_CONFIG);
    Object.freeze(defaultDrawConfig);

    return Object.freeze({
        ...resolved,
        label,
        crop,
        defaultMosaicConfig,
        defaultTextConfig,
        defaultDrawConfig,
    }) as ResolvedOptions;
}
