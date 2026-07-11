import { tryNormalizeImageFormat } from '../export/export-format.js';
import { canCopySafeObjectKey, copySafeOwnProperties } from './safe-object-copy.js';
const EMPTY_DEFAULT_MASK_CONFIG = Object.freeze({});
const DEFAULT_LAYOUT_MODE = 'expand';
const DEFAULT_OVERLAY_LIST_ORDER = 'front-to-back';
export const DEFAULT_OPTIONS = {
    canvasWidth: 800,
    canvasHeight: 600,
    backgroundColor: 'transparent',
    animationDuration: 300,
    minScale: 0.1,
    maxScale: 5.0,
    scaleStep: 0.05,
    rotationStep: 90,
    bindMasksToImageTransform: false,
    bindAnnotationsToImageTransform: false,
    textAnnotationFlipBehavior: 'preserve-readable',
    defaultLayoutMode: DEFAULT_LAYOUT_MODE,
    layoutMode: DEFAULT_LAYOUT_MODE,
    downsampleOnLoad: true,
    downsampleMaxWidth: 4000,
    downsampleMaxHeight: 3000,
    downsampleQuality: 0.92,
    preserveSourceFormat: true,
    downsampleMimeType: null,
    autoOrientImage: true,
    autoOrientImageQuality: null,
    maxInputBytes: 50000000,
    maxInputPixels: 50000000,
    imageLoadTimeoutMs: 30000,
    maxHistorySize: 50,
    exportMultiplier: 1,
    maxExportPixels: 50000000,
    maxExportDimension: 16384,
    exportAreaByDefault: 'image',
    mergeMasksByDefault: true,
    mergeAnnotationsByDefault: true,
    defaultMaskWidth: 50,
    defaultMaskHeight: 80,
    defaultMaskConfig: EMPTY_DEFAULT_MASK_CONFIG,
    maskRotatable: false,
    maskLabelOnSelect: true,
    maskLabelOffset: 3,
    maskName: 'mask',
    textAnnotationName: 'text',
    drawAnnotationName: 'draw',
    shapeAnnotationName: 'shape',
    maskListOrder: DEFAULT_OVERLAY_LIST_ORDER,
    annotationListOrder: DEFAULT_OVERLAY_LIST_ORDER,
    groupSelection: false,
    showPlaceholder: true,
    initialImageBase64: null,
    defaultDownloadFileName: 'edited_image',
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
};
export const DEFAULT_LABEL = {
    getText: (mask) => mask.maskName,
    textOptions: { ...DEFAULT_LABEL_TEXT_OPTIONS },
};
export const DEFAULT_CROP = {
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
export const DEFAULT_MOSAIC_CONFIG = Object.freeze({
    brushSize: 48,
    blockSize: 8,
    previewStroke: '#333',
    previewStrokeWidth: 1,
    previewStrokeDashArray: Object.freeze([4, 4]),
    previewFill: 'rgba(0,0,0,0)',
    outputFileType: 'source',
    outputQuality: undefined,
});
export const DEFAULT_TEXT_ANNOTATION_CONFIG = Object.freeze({
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
    styles: Object.freeze({}),
});
export const DEFAULT_DRAW_CONFIG = Object.freeze({
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
export const DEFAULT_ERASER_CONFIG = Object.freeze({
    brushSize: 18,
    target: 'drawAnnotations',
    previewStroke: '#111',
    previewStrokeWidth: 1,
    previewFill: 'rgba(255,255,255,0.28)',
});
export const DEFAULT_SHAPE_ANNOTATION_CONFIG = Object.freeze({
    shape: 'rect',
    left: undefined,
    top: undefined,
    width: 120,
    height: 80,
    x1: undefined,
    y1: undefined,
    x2: undefined,
    y2: undefined,
    stroke: '#ff0000',
    strokeWidth: 3,
    fill: 'rgba(255,0,0,0.08)',
    opacity: 1,
    angle: 0,
    selectable: true,
    evented: true,
    annotationHidden: false,
    annotationLocked: false,
    strokeDashArray: null,
    arrowHeadLength: 18,
    styles: Object.freeze({}),
});
const KNOWN_TOP_LEVEL_KEYS = new Set([
    'canvasWidth',
    'canvasHeight',
    'backgroundColor',
    'animationDuration',
    'minScale',
    'maxScale',
    'scaleStep',
    'rotationStep',
    'bindMasksToImageTransform',
    'bindAnnotationsToImageTransform',
    'textAnnotationFlipBehavior',
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
    'shapeAnnotationName',
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
    'defaultEraserConfig',
    'defaultShapeConfig',
]);
function normalizeCallback(value) {
    return typeof value === 'function' ? value : null;
}
export function isLayoutMode(value) {
    return value === 'fit' || value === 'cover' || value === 'expand';
}
function normalizeLayoutMode(value) {
    return isLayoutMode(value) ? value : DEFAULT_LAYOUT_MODE;
}
function isConfigObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function canCopyObjectConfigKey(key) {
    return canCopySafeObjectKey(key);
}
function copyDefaultMaskConfigValue(value) {
    if (Array.isArray(value)) {
        return Object.freeze(value.map((item) => copyDefaultMaskConfigValue(item)));
    }
    if (!isConfigObject(value))
        return value;
    const copy = Object.create(null);
    for (const [key, nestedValue] of Object.entries(value)) {
        if (!canCopyObjectConfigKey(key))
            continue;
        copy[key] = copyDefaultMaskConfigValue(nestedValue);
    }
    return Object.freeze(copy);
}
function normalizeDefaultMaskConfig(value) {
    if (!isConfigObject(value))
        return EMPTY_DEFAULT_MASK_CONFIG;
    const normalized = Object.create(null);
    for (const [key, optionValue] of Object.entries(value)) {
        if (!canCopyObjectConfigKey(key))
            continue;
        if (key === 'onCreate' || key === 'fabricGenerator' || key === 'styles')
            continue;
        normalized[key] = copyDefaultMaskConfigValue(optionValue);
    }
    const styles = value.styles;
    if (isConfigObject(styles)) {
        const copiedStyles = Object.create(null);
        for (const [key, styleValue] of Object.entries(styles)) {
            if (!canCopyObjectConfigKey(key))
                continue;
            copiedStyles[key] = copyDefaultMaskConfigValue(styleValue);
        }
        Object.freeze(copiedStyles);
        normalized.styles = copiedStyles;
    }
    Object.freeze(normalized);
    return normalized;
}
function normalizePositiveInteger(value, fallback) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0)
        return fallback;
    return Math.max(1, Math.floor(numeric));
}
function normalizePositiveFiniteNumber(value, fallback) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0)
        return fallback;
    return numeric;
}
function normalizeNonNegativeFiniteNumber(value, fallback) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0)
        return fallback;
    return numeric;
}
function normalizeFiniteNumber(value, fallback) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric))
        return fallback;
    return numeric;
}
function normalizeMaxHistorySize(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric))
        return DEFAULT_OPTIONS.maxHistorySize;
    return Math.max(1, Math.floor(numeric));
}
function normalizeQualityOption(value) {
    if (value == null)
        return DEFAULT_OPTIONS.downsampleQuality;
    const numeric = Number(value);
    if (!Number.isFinite(numeric))
        return DEFAULT_OPTIONS.downsampleQuality;
    return Math.max(0, Math.min(1, numeric));
}
function normalizeNullableQualityOption(value) {
    if (value == null)
        return null;
    const numeric = Number(value);
    if (!Number.isFinite(numeric))
        return null;
    return Math.max(0, Math.min(1, numeric));
}
function normalizeMaxExportPixels(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0)
        return DEFAULT_OPTIONS.maxExportPixels;
    return Math.max(1, Math.floor(numeric));
}
function normalizeMaxExportDimension(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0)
        return DEFAULT_OPTIONS.maxExportDimension;
    return Math.max(1, Math.floor(numeric));
}
function normalizeMaxInputBytes(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0)
        return DEFAULT_OPTIONS.maxInputBytes;
    return Math.max(1, Math.floor(numeric));
}
function normalizeMaxInputPixels(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0)
        return DEFAULT_OPTIONS.maxInputPixels;
    return Math.max(1, Math.floor(numeric));
}
function normalizeExportArea(value) {
    return value === 'canvas' || value === 'image' ? value : DEFAULT_OPTIONS.exportAreaByDefault;
}
function normalizeOverlayListOrder(value, fallback) {
    return value === 'front-to-back' || value === 'back-to-front' ? value : fallback;
}
function isImageMimeType(value) {
    return value === 'image/jpeg' || value === 'image/png' || value === 'image/webp';
}
function normalizeImageMimeTypeOption(value, fallback) {
    if (value === null)
        return null;
    return isImageMimeType(value) ? value : fallback;
}
function normalizeNullableString(value, fallback) {
    if (value === null)
        return null;
    return typeof value === 'string' ? value : fallback;
}
const CROP_ASPECT_RATIO_PRESETS = new Set([
    'free',
    '1:1',
    '3:4',
    '4:3',
    '3:2',
    '2:3',
    '9:16',
    '16:9',
]);
function hasValidCropRatioParts(width, height) {
    return (typeof width === 'number' &&
        typeof height === 'number' &&
        Number.isFinite(width) &&
        Number.isFinite(height) &&
        width > 0 &&
        height > 0);
}
function normalizeCropAspectRatioOption(value) {
    if (value === undefined || value === null)
        return DEFAULT_CROP.aspectRatio;
    if (typeof value === 'number') {
        return Number.isFinite(value) && value > 0 ? value : DEFAULT_CROP.aspectRatio;
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (CROP_ASPECT_RATIO_PRESETS.has(trimmed))
            return trimmed;
        const parts = trimmed.split(':');
        if (parts.length === 2) {
            const width = Number(parts[0]);
            const height = Number(parts[1]);
            if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
                return trimmed;
            }
        }
        return DEFAULT_CROP.aspectRatio;
    }
    if (isConfigObject(value) && hasValidCropRatioParts(value.width, value.height)) {
        return { width: value.width, height: value.height };
    }
    return DEFAULT_CROP.aspectRatio;
}
function normalizeCropExportFileTypeOption(value) {
    if (value === undefined || value === null)
        return DEFAULT_CROP.exportFileType;
    if (value === 'source')
        return 'source';
    const normalized = typeof value === 'string' ? tryNormalizeImageFormat(value) : null;
    return normalized !== null && normalized !== void 0 ? normalized : DEFAULT_CROP.exportFileType;
}
function normalizeOptionalQuality(value) {
    if (value === undefined || value === null)
        return undefined;
    const numeric = Number(value);
    if (!Number.isFinite(numeric))
        return undefined;
    return Math.max(0, Math.min(1, numeric));
}
function hasOwn(object, key) {
    return Object.prototype.hasOwnProperty.call(object, key);
}
function isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
}
function normalizeMosaicPositiveNumber(value, fallback) {
    return isFiniteNumber(value) && value > 0 ? value : fallback;
}
function normalizeMosaicBlockSize(value, fallback) {
    return isFiniteNumber(value) && value > 0 ? Math.max(1, Math.floor(value)) : fallback;
}
function normalizeMosaicNonNegativeNumber(value, fallback) {
    return isFiniteNumber(value) && value >= 0 ? value : fallback;
}
function normalizeMosaicDashArray(value, fallback) {
    if (value === null)
        return null;
    if (Array.isArray(value) &&
        value.every((entry) => typeof entry === 'number' && Number.isFinite(entry) && entry >= 0)) {
        return [...value];
    }
    return fallback ? [...fallback] : null;
}
function normalizeMosaicOutputFileType(value, fallback) {
    var _a;
    if (value === 'source')
        return 'source';
    if (typeof value !== 'string')
        return fallback;
    return (_a = tryNormalizeImageFormat(value)) !== null && _a !== void 0 ? _a : fallback;
}
function normalizeMosaicOutputQuality(value, fallback) {
    if (value === undefined || value === null)
        return undefined;
    if (!isFiniteNumber(value))
        return fallback;
    return Math.max(0, Math.min(1, value));
}
export function cloneResolvedMosaicConfig(config) {
    return {
        ...config,
        previewStrokeDashArray: config.previewStrokeDashArray
            ? [...config.previewStrokeDashArray]
            : null,
    };
}
export function normalizeMosaicConfig(input, fallback) {
    if (!isConfigObject(input))
        return cloneResolvedMosaicConfig(fallback);
    return mergeMosaicConfigPatch(fallback, input);
}
export function mergeMosaicConfigPatch(current, patch, fallback = current) {
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
        next.previewStrokeWidth = normalizeMosaicNonNegativeNumber(raw.previewStrokeWidth, fallback.previewStrokeWidth);
    }
    if (hasOwn(raw, 'previewStrokeDashArray')) {
        next.previewStrokeDashArray = normalizeMosaicDashArray(raw.previewStrokeDashArray, fallback.previewStrokeDashArray);
    }
    if (hasOwn(raw, 'previewFill')) {
        next.previewFill =
            typeof raw.previewFill === 'string' ? raw.previewFill : fallback.previewFill;
    }
    if (hasOwn(raw, 'outputFileType')) {
        next.outputFileType = normalizeMosaicOutputFileType(raw.outputFileType, fallback.outputFileType);
    }
    if (hasOwn(raw, 'outputQuality')) {
        next.outputQuality = normalizeMosaicOutputQuality(raw.outputQuality, fallback.outputQuality);
    }
    return next;
}
export function getInvalidMosaicConfigFields(input) {
    const raw = isConfigObject(input) ? input : {};
    const invalid = [];
    if (hasOwn(raw, 'brushSize') &&
        !(typeof raw.brushSize === 'number' && Number.isFinite(raw.brushSize) && raw.brushSize > 0)) {
        invalid.push('brushSize');
    }
    if (hasOwn(raw, 'blockSize') &&
        !(typeof raw.blockSize === 'number' && Number.isFinite(raw.blockSize) && raw.blockSize > 0)) {
        invalid.push('blockSize');
    }
    if (hasOwn(raw, 'previewStroke') && typeof raw.previewStroke !== 'string') {
        invalid.push('previewStroke');
    }
    if (hasOwn(raw, 'previewStrokeWidth') &&
        !(typeof raw.previewStrokeWidth === 'number' &&
            Number.isFinite(raw.previewStrokeWidth) &&
            raw.previewStrokeWidth >= 0)) {
        invalid.push('previewStrokeWidth');
    }
    if (hasOwn(raw, 'previewStrokeDashArray')) {
        const value = raw.previewStrokeDashArray;
        const valid = value === null ||
            (Array.isArray(value) &&
                value.every((entry) => typeof entry === 'number' && Number.isFinite(entry) && entry >= 0));
        if (!valid)
            invalid.push('previewStrokeDashArray');
    }
    if (hasOwn(raw, 'previewFill') && typeof raw.previewFill !== 'string') {
        invalid.push('previewFill');
    }
    if (hasOwn(raw, 'outputFileType')) {
        const value = raw.outputFileType;
        const valid = value === 'source' || (typeof value === 'string' && tryNormalizeImageFormat(value));
        if (!valid)
            invalid.push('outputFileType');
    }
    if (hasOwn(raw, 'outputQuality') &&
        raw.outputQuality !== undefined &&
        raw.outputQuality !== null &&
        !(typeof raw.outputQuality === 'number' && Number.isFinite(raw.outputQuality))) {
        invalid.push('outputQuality');
    }
    return invalid;
}
export function areResolvedMosaicConfigsEqual(left, right) {
    const leftDash = left.previewStrokeDashArray;
    const rightDash = right.previewStrokeDashArray;
    const dashEqual = leftDash === rightDash ||
        (Array.isArray(leftDash) &&
            Array.isArray(rightDash) &&
            leftDash.length === rightDash.length &&
            leftDash.every((value, index) => value === rightDash[index]));
    return (left.brushSize === right.brushSize &&
        left.blockSize === right.blockSize &&
        left.previewStroke === right.previewStroke &&
        left.previewStrokeWidth === right.previewStrokeWidth &&
        dashEqual &&
        left.previewFill === right.previewFill &&
        left.outputFileType === right.outputFileType &&
        left.outputQuality === right.outputQuality);
}
export function cloneResolvedTextAnnotationConfig(config) {
    return {
        ...config,
        styles: { ...config.styles },
    };
}
export function cloneResolvedDrawConfig(config) {
    return { ...config };
}
export function cloneResolvedEraserConfig(config) {
    return { ...config };
}
export function cloneResolvedShapeAnnotationConfig(config) {
    return {
        ...config,
        strokeDashArray: config.strokeDashArray ? [...config.strokeDashArray] : null,
        styles: { ...config.styles },
    };
}
function normalizeTextAlign(value, fallback) {
    return value === 'left' || value === 'center' || value === 'right' || value === 'justify'
        ? value
        : fallback;
}
function normalizePositiveNumber(value, fallback) {
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}
function normalizeBoolean(value, fallback) {
    return typeof value === 'boolean' ? value : fallback;
}
function normalizeString(value, fallback) {
    return typeof value === 'string' ? value : fallback;
}
function normalizeTextLeftTop(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}
function normalizeTextboxStyles(value) {
    return copySafeOwnProperties(value);
}
function normalizeFabricObjectStyles(value) {
    return copySafeOwnProperties(value);
}
export function mergeTextAnnotationConfigPatch(current, patch, fallback = current) {
    const raw = isConfigObject(patch) ? patch : {};
    const next = cloneResolvedTextAnnotationConfig(current);
    if (hasOwn(raw, 'text'))
        next.text = normalizeString(raw.text, fallback.text);
    if (hasOwn(raw, 'left'))
        next.left = normalizeTextLeftTop(raw.left);
    if (hasOwn(raw, 'top'))
        next.top = normalizeTextLeftTop(raw.top);
    if (hasOwn(raw, 'width'))
        next.width = normalizePositiveNumber(raw.width, fallback.width);
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
    if (hasOwn(raw, 'fill'))
        next.fill = normalizeString(raw.fill, fallback.fill);
    if (hasOwn(raw, 'backgroundColor')) {
        next.backgroundColor = normalizeString(raw.backgroundColor, fallback.backgroundColor);
    }
    if (hasOwn(raw, 'textAlign'))
        next.textAlign = normalizeTextAlign(raw.textAlign, fallback.textAlign);
    if (hasOwn(raw, 'angle'))
        next.angle = normalizeFiniteNumber(raw.angle, fallback.angle);
    if (hasOwn(raw, 'selectable'))
        next.selectable = normalizeBoolean(raw.selectable, fallback.selectable);
    if (hasOwn(raw, 'evented'))
        next.evented = normalizeBoolean(raw.evented, fallback.evented);
    if (hasOwn(raw, 'editable'))
        next.editable = normalizeBoolean(raw.editable, fallback.editable);
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
export function normalizeTextAnnotationConfig(input, fallback) {
    if (!isConfigObject(input))
        return cloneResolvedTextAnnotationConfig(fallback);
    return mergeTextAnnotationConfigPatch(fallback, input);
}
function normalizeLineCap(value, fallback) {
    return value === 'butt' || value === 'round' || value === 'square' ? value : fallback;
}
function normalizeLineJoin(value, fallback) {
    return value === 'bevel' || value === 'round' || value === 'miter' ? value : fallback;
}
function normalizeOpacity(value, fallback) {
    if (typeof value !== 'number' || !Number.isFinite(value))
        return fallback;
    return Math.max(0, Math.min(1, value));
}
export function mergeDrawConfigPatch(current, patch, fallback = current) {
    const raw = isConfigObject(patch) ? patch : {};
    const next = cloneResolvedDrawConfig(current);
    if (hasOwn(raw, 'brushSize')) {
        next.brushSize = normalizePositiveNumber(raw.brushSize, fallback.brushSize);
    }
    if (hasOwn(raw, 'color'))
        next.color = normalizeString(raw.color, fallback.color);
    if (hasOwn(raw, 'opacity'))
        next.opacity = normalizeOpacity(raw.opacity, fallback.opacity);
    if (hasOwn(raw, 'lineCap'))
        next.lineCap = normalizeLineCap(raw.lineCap, fallback.lineCap);
    if (hasOwn(raw, 'lineJoin'))
        next.lineJoin = normalizeLineJoin(raw.lineJoin, fallback.lineJoin);
    if (hasOwn(raw, 'selectable'))
        next.selectable = normalizeBoolean(raw.selectable, fallback.selectable);
    if (hasOwn(raw, 'evented'))
        next.evented = normalizeBoolean(raw.evented, fallback.evented);
    if (hasOwn(raw, 'annotationHidden')) {
        next.annotationHidden = normalizeBoolean(raw.annotationHidden, fallback.annotationHidden);
    }
    if (hasOwn(raw, 'annotationLocked')) {
        next.annotationLocked = normalizeBoolean(raw.annotationLocked, fallback.annotationLocked);
    }
    return next;
}
export function normalizeDrawConfig(input, fallback) {
    if (!isConfigObject(input))
        return cloneResolvedDrawConfig(fallback);
    return mergeDrawConfigPatch(fallback, input);
}
export function mergeEraserConfigPatch(current, patch, fallback = current) {
    const raw = isConfigObject(patch) ? patch : {};
    const next = cloneResolvedEraserConfig(current);
    if (hasOwn(raw, 'brushSize')) {
        next.brushSize = normalizePositiveNumber(raw.brushSize, fallback.brushSize);
    }
    if (hasOwn(raw, 'target')) {
        next.target = raw.target === 'drawAnnotations' ? 'drawAnnotations' : fallback.target;
    }
    if (hasOwn(raw, 'previewStroke')) {
        next.previewStroke = normalizeString(raw.previewStroke, fallback.previewStroke);
    }
    if (hasOwn(raw, 'previewStrokeWidth')) {
        next.previewStrokeWidth = normalizeMosaicNonNegativeNumber(raw.previewStrokeWidth, fallback.previewStrokeWidth);
    }
    if (hasOwn(raw, 'previewFill')) {
        next.previewFill = normalizeString(raw.previewFill, fallback.previewFill);
    }
    return next;
}
export function normalizeEraserConfig(input, fallback) {
    if (!isConfigObject(input))
        return cloneResolvedEraserConfig(fallback);
    return mergeEraserConfigPatch(fallback, input);
}
function normalizeShapeKind(value, fallback) {
    return value === 'rect' || value === 'line' || value === 'arrow' ? value : fallback;
}
function normalizeNullableDashArray(value, fallback) {
    if (value === null)
        return null;
    if (Array.isArray(value) &&
        value.every((entry) => typeof entry === 'number' && Number.isFinite(entry) && entry >= 0)) {
        return [...value];
    }
    return fallback ? [...fallback] : null;
}
export function mergeShapeAnnotationConfigPatch(current, patch, fallback = current) {
    const raw = isConfigObject(patch) ? patch : {};
    const next = cloneResolvedShapeAnnotationConfig(current);
    if (hasOwn(raw, 'shape'))
        next.shape = normalizeShapeKind(raw.shape, fallback.shape);
    if (hasOwn(raw, 'left'))
        next.left = normalizeTextLeftTop(raw.left);
    if (hasOwn(raw, 'top'))
        next.top = normalizeTextLeftTop(raw.top);
    if (hasOwn(raw, 'width'))
        next.width = normalizePositiveNumber(raw.width, fallback.width);
    if (hasOwn(raw, 'height'))
        next.height = normalizePositiveNumber(raw.height, fallback.height);
    if (hasOwn(raw, 'x1'))
        next.x1 = normalizeTextLeftTop(raw.x1);
    if (hasOwn(raw, 'y1'))
        next.y1 = normalizeTextLeftTop(raw.y1);
    if (hasOwn(raw, 'x2'))
        next.x2 = normalizeTextLeftTop(raw.x2);
    if (hasOwn(raw, 'y2'))
        next.y2 = normalizeTextLeftTop(raw.y2);
    if (hasOwn(raw, 'stroke'))
        next.stroke = normalizeString(raw.stroke, fallback.stroke);
    if (hasOwn(raw, 'strokeWidth')) {
        next.strokeWidth = normalizePositiveNumber(raw.strokeWidth, fallback.strokeWidth);
    }
    if (hasOwn(raw, 'fill'))
        next.fill = normalizeString(raw.fill, fallback.fill);
    if (hasOwn(raw, 'opacity'))
        next.opacity = normalizeOpacity(raw.opacity, fallback.opacity);
    if (hasOwn(raw, 'angle'))
        next.angle = normalizeFiniteNumber(raw.angle, fallback.angle);
    if (hasOwn(raw, 'selectable')) {
        next.selectable = normalizeBoolean(raw.selectable, fallback.selectable);
    }
    if (hasOwn(raw, 'evented'))
        next.evented = normalizeBoolean(raw.evented, fallback.evented);
    if (hasOwn(raw, 'annotationHidden')) {
        next.annotationHidden = normalizeBoolean(raw.annotationHidden, fallback.annotationHidden);
    }
    if (hasOwn(raw, 'annotationLocked')) {
        next.annotationLocked = normalizeBoolean(raw.annotationLocked, fallback.annotationLocked);
    }
    if (hasOwn(raw, 'strokeDashArray')) {
        next.strokeDashArray = normalizeNullableDashArray(raw.strokeDashArray, fallback.strokeDashArray);
    }
    if (hasOwn(raw, 'arrowHeadLength')) {
        next.arrowHeadLength = normalizePositiveNumber(raw.arrowHeadLength, fallback.arrowHeadLength);
    }
    if (hasOwn(raw, 'styles')) {
        next.styles = {
            ...next.styles,
            ...normalizeFabricObjectStyles(raw.styles),
        };
    }
    return next;
}
export function normalizeShapeAnnotationConfig(input, fallback) {
    if (!isConfigObject(input))
        return cloneResolvedShapeAnnotationConfig(fallback);
    return mergeShapeAnnotationConfigPatch(fallback, input);
}
export function areResolvedTextAnnotationConfigsEqual(left, right) {
    return (left.text === right.text &&
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
        areStyleRecordsEqual(left.styles, right.styles));
}
function areStyleRecordsEqual(left, right) {
    return areStyleValuesEqual(left, right, new WeakMap());
}
function areStyleValuesEqual(left, right, seen) {
    if (Object.is(left, right))
        return true;
    if (!left || !right || typeof left !== 'object' || typeof right !== 'object')
        return false;
    let seenRights = seen.get(left);
    if (seenRights === null || seenRights === void 0 ? void 0 : seenRights.has(right))
        return true;
    if (!seenRights) {
        seenRights = new WeakSet();
        seen.set(left, seenRights);
    }
    seenRights.add(right);
    if (Array.isArray(left) || Array.isArray(right)) {
        return (Array.isArray(left) &&
            Array.isArray(right) &&
            left.length === right.length &&
            left.every((value, index) => areStyleValuesEqual(value, right[index], seen)));
    }
    const leftRecord = left;
    const rightRecord = right;
    const leftKeys = Object.keys(leftRecord);
    const rightKeys = Object.keys(rightRecord);
    if (leftKeys.length !== rightKeys.length)
        return false;
    return leftKeys.every((key) => {
        if (!hasOwn(rightRecord, key))
            return false;
        return areStyleValuesEqual(leftRecord[key], rightRecord[key], seen);
    });
}
export function areResolvedDrawConfigsEqual(left, right) {
    return (left.brushSize === right.brushSize &&
        left.color === right.color &&
        left.opacity === right.opacity &&
        left.lineCap === right.lineCap &&
        left.lineJoin === right.lineJoin &&
        left.selectable === right.selectable &&
        left.evented === right.evented &&
        left.annotationHidden === right.annotationHidden &&
        left.annotationLocked === right.annotationLocked);
}
export function areResolvedEraserConfigsEqual(left, right) {
    return (left.brushSize === right.brushSize &&
        left.target === right.target &&
        left.previewStroke === right.previewStroke &&
        left.previewStrokeWidth === right.previewStrokeWidth &&
        left.previewFill === right.previewFill);
}
export function areResolvedShapeAnnotationConfigsEqual(left, right) {
    const leftDash = left.strokeDashArray;
    const rightDash = right.strokeDashArray;
    const dashEqual = leftDash === rightDash ||
        (Array.isArray(leftDash) &&
            Array.isArray(rightDash) &&
            leftDash.length === rightDash.length &&
            leftDash.every((value, index) => value === rightDash[index]));
    return (left.shape === right.shape &&
        left.left === right.left &&
        left.top === right.top &&
        left.width === right.width &&
        left.height === right.height &&
        left.x1 === right.x1 &&
        left.y1 === right.y1 &&
        left.x2 === right.x2 &&
        left.y2 === right.y2 &&
        left.stroke === right.stroke &&
        left.strokeWidth === right.strokeWidth &&
        left.fill === right.fill &&
        left.opacity === right.opacity &&
        left.angle === right.angle &&
        left.selectable === right.selectable &&
        left.evented === right.evented &&
        left.annotationHidden === right.annotationHidden &&
        left.annotationLocked === right.annotationLocked &&
        dashEqual &&
        left.arrowHeadLength === right.arrowHeadLength &&
        areStyleRecordsEqual(left.styles, right.styles));
}
export function getInvalidTextAnnotationConfigFields(input) {
    const raw = isConfigObject(input) ? input : {};
    const invalid = [];
    if (hasOwn(raw, 'text') && typeof raw.text !== 'string')
        invalid.push('text');
    if (hasOwn(raw, 'width') && !isFiniteNumber(raw.width))
        invalid.push('width');
    if (hasOwn(raw, 'fontSize') && !isFiniteNumber(raw.fontSize))
        invalid.push('fontSize');
    if (hasOwn(raw, 'fontFamily') && typeof raw.fontFamily !== 'string')
        invalid.push('fontFamily');
    if (hasOwn(raw, 'fill') && typeof raw.fill !== 'string') {
        invalid.push('fill');
    }
    return invalid;
}
export function getInvalidDrawConfigFields(input) {
    const raw = isConfigObject(input) ? input : {};
    const invalid = [];
    if (hasOwn(raw, 'brushSize') && !isFiniteNumber(raw.brushSize))
        invalid.push('brushSize');
    if (hasOwn(raw, 'color') && typeof raw.color !== 'string')
        invalid.push('color');
    if (hasOwn(raw, 'opacity') && !isFiniteNumber(raw.opacity))
        invalid.push('opacity');
    return invalid;
}
export function getInvalidEraserConfigFields(input) {
    const raw = isConfigObject(input) ? input : {};
    const invalid = [];
    if (hasOwn(raw, 'brushSize') && !isFiniteNumber(raw.brushSize))
        invalid.push('brushSize');
    if (hasOwn(raw, 'target') && raw.target !== 'drawAnnotations')
        invalid.push('target');
    if (hasOwn(raw, 'previewStroke') && typeof raw.previewStroke !== 'string') {
        invalid.push('previewStroke');
    }
    if (hasOwn(raw, 'previewStrokeWidth') && !isFiniteNumber(raw.previewStrokeWidth)) {
        invalid.push('previewStrokeWidth');
    }
    if (hasOwn(raw, 'previewFill') && typeof raw.previewFill !== 'string') {
        invalid.push('previewFill');
    }
    return invalid;
}
export function getInvalidShapeAnnotationConfigFields(input) {
    const raw = isConfigObject(input) ? input : {};
    const invalid = [];
    if (hasOwn(raw, 'shape') &&
        raw.shape !== 'rect' &&
        raw.shape !== 'line' &&
        raw.shape !== 'arrow') {
        invalid.push('shape');
    }
    if (hasOwn(raw, 'width') && !isFiniteNumber(raw.width))
        invalid.push('width');
    if (hasOwn(raw, 'height') && !isFiniteNumber(raw.height))
        invalid.push('height');
    if (hasOwn(raw, 'stroke') && typeof raw.stroke !== 'string')
        invalid.push('stroke');
    if (hasOwn(raw, 'strokeWidth') && !isFiniteNumber(raw.strokeWidth)) {
        invalid.push('strokeWidth');
    }
    if (hasOwn(raw, 'fill') && typeof raw.fill !== 'string')
        invalid.push('fill');
    if (hasOwn(raw, 'opacity') && !isFiniteNumber(raw.opacity))
        invalid.push('opacity');
    if (hasOwn(raw, 'arrowHeadLength') && !isFiniteNumber(raw.arrowHeadLength)) {
        invalid.push('arrowHeadLength');
    }
    if (hasOwn(raw, 'strokeDashArray')) {
        const value = raw.strokeDashArray;
        const valid = value === null ||
            (Array.isArray(value) &&
                value.every((entry) => typeof entry === 'number' && Number.isFinite(entry) && entry >= 0));
        if (!valid)
            invalid.push('strokeDashArray');
    }
    return invalid;
}
export function resolveOptions(input) {
    const raw = input !== null && input !== void 0 ? input : {};
    const resolved = { ...DEFAULT_OPTIONS };
    for (const key of Object.keys(raw)) {
        if (!KNOWN_TOP_LEVEL_KEYS.has(key))
            continue;
        if (key === 'label' ||
            key === 'crop' ||
            key === 'defaultMosaicConfig' ||
            key === 'defaultTextConfig' ||
            key === 'defaultDrawConfig' ||
            key === 'defaultEraserConfig' ||
            key === 'defaultShapeConfig') {
            continue;
        }
        if (key === 'onImageLoadStart' ||
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
            key === 'onWarning') {
            continue;
        }
        const value = raw[key];
        if (value === undefined)
            continue;
        if (key === 'backgroundColor') {
            resolved.backgroundColor = normalizeString(value, DEFAULT_OPTIONS.backgroundColor);
            continue;
        }
        if (key === 'bindMasksToImageTransform') {
            resolved.bindMasksToImageTransform = normalizeBoolean(value, DEFAULT_OPTIONS.bindMasksToImageTransform);
            continue;
        }
        if (key === 'bindAnnotationsToImageTransform') {
            resolved.bindAnnotationsToImageTransform = normalizeBoolean(value, DEFAULT_OPTIONS.bindAnnotationsToImageTransform);
            continue;
        }
        if (key === 'textAnnotationFlipBehavior') {
            resolved.textAnnotationFlipBehavior =
                value === 'mirror' ? 'mirror' : 'preserve-readable';
            continue;
        }
        if (key === 'downsampleOnLoad') {
            resolved.downsampleOnLoad = normalizeBoolean(value, DEFAULT_OPTIONS.downsampleOnLoad);
            continue;
        }
        if (key === 'preserveSourceFormat') {
            resolved.preserveSourceFormat = normalizeBoolean(value, DEFAULT_OPTIONS.preserveSourceFormat);
            continue;
        }
        if (key === 'downsampleMimeType') {
            resolved.downsampleMimeType = normalizeImageMimeTypeOption(value, DEFAULT_OPTIONS.downsampleMimeType);
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
            resolved.mergeMasksByDefault = normalizeBoolean(value, DEFAULT_OPTIONS.mergeMasksByDefault);
            continue;
        }
        if (key === 'mergeAnnotationsByDefault') {
            resolved.mergeAnnotationsByDefault = normalizeBoolean(value, DEFAULT_OPTIONS.mergeAnnotationsByDefault);
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
            resolved.textAnnotationName = normalizeString(value, DEFAULT_OPTIONS.textAnnotationName);
            continue;
        }
        if (key === 'drawAnnotationName') {
            resolved.drawAnnotationName = normalizeString(value, DEFAULT_OPTIONS.drawAnnotationName);
            continue;
        }
        if (key === 'shapeAnnotationName') {
            resolved.shapeAnnotationName = normalizeString(value, DEFAULT_OPTIONS.shapeAnnotationName);
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
            resolved.initialImageBase64 = normalizeNullableString(value, DEFAULT_OPTIONS.initialImageBase64);
            continue;
        }
        if (key === 'defaultDownloadFileName') {
            resolved.defaultDownloadFileName = normalizeString(value, DEFAULT_OPTIONS.defaultDownloadFileName);
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
            resolved.maskListOrder = normalizeOverlayListOrder(value, DEFAULT_OPTIONS.maskListOrder);
            continue;
        }
        if (key === 'annotationListOrder') {
            resolved.annotationListOrder = normalizeOverlayListOrder(value, DEFAULT_OPTIONS.annotationListOrder);
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
            resolved.animationDuration = normalizeNonNegativeFiniteNumber(value, DEFAULT_OPTIONS.animationDuration);
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
            resolved.downsampleMaxWidth = normalizePositiveInteger(value, DEFAULT_OPTIONS.downsampleMaxWidth);
            continue;
        }
        if (key === 'downsampleMaxHeight') {
            resolved.downsampleMaxHeight = normalizePositiveInteger(value, DEFAULT_OPTIONS.downsampleMaxHeight);
            continue;
        }
        if (key === 'imageLoadTimeoutMs') {
            resolved.imageLoadTimeoutMs = normalizePositiveInteger(value, DEFAULT_OPTIONS.imageLoadTimeoutMs);
            continue;
        }
        if (key === 'exportMultiplier') {
            resolved.exportMultiplier = normalizePositiveFiniteNumber(value, DEFAULT_OPTIONS.exportMultiplier);
            continue;
        }
        if (key === 'defaultMaskWidth') {
            resolved.defaultMaskWidth = normalizePositiveFiniteNumber(value, DEFAULT_OPTIONS.defaultMaskWidth);
            continue;
        }
        if (key === 'defaultMaskHeight') {
            resolved.defaultMaskHeight = normalizePositiveFiniteNumber(value, DEFAULT_OPTIONS.defaultMaskHeight);
            continue;
        }
        if (key === 'defaultMaskConfig') {
            resolved.defaultMaskConfig = normalizeDefaultMaskConfig(value);
            continue;
        }
        if (key === 'maskLabelOffset') {
            resolved.maskLabelOffset = normalizeNonNegativeFiniteNumber(value, DEFAULT_OPTIONS.maskLabelOffset);
            continue;
        }
        resolved[key] = value;
    }
    resolved.onImageLoadStart = normalizeCallback(raw.onImageLoadStart);
    resolved.onImageLoaded = normalizeCallback(raw.onImageLoaded);
    resolved.onImageCleared = normalizeCallback(raw.onImageCleared);
    resolved.onImageChanged = normalizeCallback(raw.onImageChanged);
    resolved.onBusyChange = normalizeCallback(raw.onBusyChange);
    resolved.onToolModeChange = normalizeCallback(raw.onToolModeChange);
    resolved.onHistoryChange = normalizeCallback(raw.onHistoryChange);
    resolved.onEditorDisposed = normalizeCallback(raw.onEditorDisposed);
    resolved.onMasksChanged = normalizeCallback(raw.onMasksChanged);
    resolved.onAnnotationsChanged = normalizeCallback(raw.onAnnotationsChanged);
    resolved.onSelectionChange = normalizeCallback(raw.onSelectionChange);
    resolved.onError = normalizeCallback(raw.onError);
    resolved.onWarning = normalizeCallback(raw.onWarning);
    resolved.maxHistorySize = normalizeMaxHistorySize(resolved.maxHistorySize);
    if (resolved.minScale > resolved.maxScale) {
        const minScale = resolved.minScale;
        resolved.minScale = resolved.maxScale;
        resolved.maxScale = minScale;
    }
    const userLabel = raw.label && typeof raw.label === 'object' ? raw.label : {};
    const mergedTextOptions = {
        ...DEFAULT_LABEL_TEXT_OPTIONS,
        ...(userLabel.textOptions && typeof userLabel.textOptions === 'object'
            ? userLabel.textOptions
            : {}),
    };
    const label = {
        getText: typeof userLabel.getText === 'function' ? userLabel.getText : DEFAULT_LABEL.getText,
        textOptions: mergedTextOptions,
    };
    if (typeof userLabel.create === 'function') {
        label.create = userLabel.create;
    }
    Object.freeze(label.textOptions);
    Object.freeze(label);
    const userCrop = raw.crop && typeof raw.crop === 'object' ? raw.crop : {};
    const crop = {
        aspectRatio: normalizeCropAspectRatioOption(userCrop.aspectRatio),
        minWidth: normalizePositiveFiniteNumber(userCrop.minWidth, DEFAULT_CROP.minWidth),
        minHeight: normalizePositiveFiniteNumber(userCrop.minHeight, DEFAULT_CROP.minHeight),
        padding: normalizeNonNegativeFiniteNumber(userCrop.padding, DEFAULT_CROP.padding),
        hideMasksDuringCrop: normalizeBoolean(userCrop.hideMasksDuringCrop, DEFAULT_CROP.hideMasksDuringCrop),
        preserveMasksAfterCrop: normalizeBoolean(userCrop.preserveMasksAfterCrop, DEFAULT_CROP.preserveMasksAfterCrop),
        allowRotationOfCropRect: normalizeBoolean(userCrop.allowRotationOfCropRect, DEFAULT_CROP.allowRotationOfCropRect),
        exportFileType: normalizeCropExportFileTypeOption(userCrop.exportFileType),
        exportQuality: normalizeOptionalQuality(userCrop.exportQuality),
    };
    Object.freeze(crop);
    const defaultMosaicConfig = normalizeMosaicConfig(raw.defaultMosaicConfig, DEFAULT_MOSAIC_CONFIG);
    if (defaultMosaicConfig.previewStrokeDashArray) {
        Object.freeze(defaultMosaicConfig.previewStrokeDashArray);
    }
    Object.freeze(defaultMosaicConfig);
    const defaultTextConfig = normalizeTextAnnotationConfig(raw.defaultTextConfig, DEFAULT_TEXT_ANNOTATION_CONFIG);
    Object.freeze(defaultTextConfig.styles);
    Object.freeze(defaultTextConfig);
    const defaultDrawConfig = normalizeDrawConfig(raw.defaultDrawConfig, DEFAULT_DRAW_CONFIG);
    Object.freeze(defaultDrawConfig);
    const defaultEraserConfig = normalizeEraserConfig(raw.defaultEraserConfig, DEFAULT_ERASER_CONFIG);
    Object.freeze(defaultEraserConfig);
    const defaultShapeConfig = normalizeShapeAnnotationConfig(raw.defaultShapeConfig, DEFAULT_SHAPE_ANNOTATION_CONFIG);
    Object.freeze(defaultShapeConfig.styles);
    Object.freeze(defaultShapeConfig);
    return Object.freeze({
        ...resolved,
        label,
        crop,
        defaultMosaicConfig,
        defaultTextConfig,
        defaultDrawConfig,
        defaultEraserConfig,
        defaultShapeConfig,
    });
}
//# sourceMappingURL=default-options.js.map