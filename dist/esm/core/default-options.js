import { tryNormalizeImageFormat } from '../export/export-format.js';
const EMPTY_DEFAULT_MASK_CONFIG = Object.freeze({});
const DEFAULT_LAYOUT_MODE = 'expand';
export const DEFAULT_OPTIONS = {
    canvasWidth: 800,
    canvasHeight: 600,
    backgroundColor: 'transparent',
    animationDuration: 300,
    minScale: 0.1,
    maxScale: 5.0,
    scaleStep: 0.05,
    rotationStep: 90,
    defaultLayoutMode: DEFAULT_LAYOUT_MODE,
    layoutMode: DEFAULT_LAYOUT_MODE,
    downsampleOnLoad: true,
    downsampleMaxWidth: 4000,
    downsampleMaxHeight: 3000,
    downsampleQuality: 0.92,
    preserveSourceFormat: true,
    downsampleMimeType: null,
    imageLoadTimeoutMs: 30000,
    maxHistorySize: 50,
    exportMultiplier: 1,
    maxExportPixels: 50000000,
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
    groupSelection: false,
    showPlaceholder: true,
    initialImageBase64: null,
    defaultDownloadFileName: 'edited_image.jpg',
    onImageLoadStart: null,
    onImageLoaded: null,
    onImageCleared: null,
    onImageChanged: null,
    onBusyChange: null,
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
const KNOWN_TOP_LEVEL_KEYS = new Set([
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
    'imageLoadTimeoutMs',
    'maxHistorySize',
    'exportMultiplier',
    'maxExportPixels',
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
function copyDefaultMaskConfigValue(value) {
    return Array.isArray(value) ? [...value] : value;
}
function normalizeDefaultMaskConfig(value) {
    if (!isConfigObject(value))
        return EMPTY_DEFAULT_MASK_CONFIG;
    const normalized = {};
    for (const [key, optionValue] of Object.entries(value)) {
        if (key === 'onCreate' || key === 'fabricGenerator' || key === 'styles')
            continue;
        normalized[key] = copyDefaultMaskConfigValue(optionValue);
    }
    const styles = value.styles;
    if (isConfigObject(styles)) {
        const copiedStyles = {};
        for (const [key, styleValue] of Object.entries(styles)) {
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
function normalizeMaxExportPixels(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0)
        return DEFAULT_OPTIONS.maxExportPixels;
    return Math.max(1, Math.floor(numeric));
}
function normalizeExportArea(value) {
    return value === 'canvas' || value === 'image' ? value : DEFAULT_OPTIONS.exportAreaByDefault;
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
    if (!isConfigObject(value))
        return {};
    return { ...value };
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
export function areResolvedTextAnnotationConfigsEqual(left, right) {
    return JSON.stringify(left) === JSON.stringify(right);
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
export function resolveOptions(input) {
    var _a, _b, _c, _d;
    const raw = input !== null && input !== void 0 ? input : {};
    const resolved = { ...DEFAULT_OPTIONS };
    for (const key of Object.keys(raw)) {
        if (!KNOWN_TOP_LEVEL_KEYS.has(key))
            continue;
        if (key === 'label' ||
            key === 'crop' ||
            key === 'defaultMosaicConfig' ||
            key === 'defaultTextConfig' ||
            key === 'defaultDrawConfig') {
            continue;
        }
        if (key === 'onImageLoadStart' ||
            key === 'onImageLoaded' ||
            key === 'onImageCleared' ||
            key === 'onImageChanged' ||
            key === 'onBusyChange' ||
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
    resolved.onEditorDisposed = normalizeCallback(raw.onEditorDisposed);
    resolved.onMasksChanged = normalizeCallback(raw.onMasksChanged);
    resolved.onAnnotationsChanged = normalizeCallback(raw.onAnnotationsChanged);
    resolved.onSelectionChange = normalizeCallback(raw.onSelectionChange);
    resolved.onError = normalizeCallback(raw.onError);
    resolved.onWarning = normalizeCallback(raw.onWarning);
    resolved.maxHistorySize = normalizeMaxHistorySize(resolved.maxHistorySize);
    resolved.maxExportPixels = normalizeMaxExportPixels(resolved.maxExportPixels);
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
        minWidth: normalizePositiveFiniteNumber(userCrop.minWidth, DEFAULT_CROP.minWidth),
        minHeight: normalizePositiveFiniteNumber(userCrop.minHeight, DEFAULT_CROP.minHeight),
        padding: normalizeNonNegativeFiniteNumber(userCrop.padding, DEFAULT_CROP.padding),
        hideMasksDuringCrop: (_a = userCrop.hideMasksDuringCrop) !== null && _a !== void 0 ? _a : DEFAULT_CROP.hideMasksDuringCrop,
        preserveMasksAfterCrop: (_b = userCrop.preserveMasksAfterCrop) !== null && _b !== void 0 ? _b : DEFAULT_CROP.preserveMasksAfterCrop,
        allowRotationOfCropRect: (_c = userCrop.allowRotationOfCropRect) !== null && _c !== void 0 ? _c : DEFAULT_CROP.allowRotationOfCropRect,
        exportFileType: (_d = userCrop.exportFileType) !== null && _d !== void 0 ? _d : DEFAULT_CROP.exportFileType,
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
    return Object.freeze({
        ...resolved,
        label,
        crop,
        defaultMosaicConfig,
        defaultTextConfig,
        defaultDrawConfig,
    });
}
//# sourceMappingURL=default-options.js.map