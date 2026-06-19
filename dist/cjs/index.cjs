'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

class AnimationQueue {
    constructor() {
        Object.defineProperty(this, "queue", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "running", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
    }
    add(animationFn) {
        return new Promise((resolve, reject) => {
            this.queue.push({ run: animationFn, resolve, reject });
            if (!this.running) {
                void this.drainQueue();
            }
        });
    }
    clear(reason) {
        const pending = this.queue;
        this.queue = [];
        if (reason !== undefined) {
            for (const entry of pending) {
                entry.reject(reason);
            }
        }
        else {
            for (const entry of pending) {
                entry.resolve();
            }
        }
    }
    isRunning() {
        return this.running;
    }
    isBusy() {
        return this.running || this.queue.length > 0;
    }
    waitForIdle() {
        if (!this.running && this.queue.length === 0) {
            return Promise.resolve();
        }
        return this.add(() => Promise.resolve()).then(() => undefined, () => undefined);
    }
    async drainQueue() {
        if (this.running)
            return;
        this.running = true;
        try {
            while (this.queue.length > 0) {
                const entry = this.queue.shift();
                try {
                    await entry.run();
                    entry.resolve();
                }
                catch (error) {
                    entry.reject(error);
                }
            }
        }
        finally {
            this.running = false;
            if (this.queue.length > 0) {
                void this.drainQueue();
            }
        }
    }
}

function reportWarning(options, error, message) {
    const warningCallback = options.onWarning;
    if (typeof warningCallback !== 'function')
        return;
    try {
        warningCallback(error, message);
    }
    catch (callbackError) {
        console.warn('[ImageEditor] onWarning callback threw', callbackError);
    }
}
function reportError(options, error, message) {
    const errorCallback = options.onError;
    if (typeof errorCallback !== 'function')
        return;
    try {
        errorCallback(error, message);
    }
    catch (callbackError) {
        console.error('[ImageEditor] onError callback threw', callbackError);
    }
}

const FORMAT_ALIAS_TABLE = Object.freeze({
    jpeg: 'jpeg',
    jpg: 'jpeg',
    'image/jpeg': 'jpeg',
    png: 'png',
    'image/png': 'png',
    webp: 'webp',
    'image/webp': 'webp',
});
const MIME_TABLE = Object.freeze({
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
});
function normalizeImageFormat(input) {
    var _a;
    return (_a = tryNormalizeImageFormat(input)) !== null && _a !== void 0 ? _a : 'jpeg';
}
function tryNormalizeImageFormat(input) {
    var _a;
    if (!input)
        return null;
    const key = String(input).toLowerCase();
    if (Object.prototype.hasOwnProperty.call(FORMAT_ALIAS_TABLE, key)) {
        return (_a = FORMAT_ALIAS_TABLE[key]) !== null && _a !== void 0 ? _a : null;
    }
    return null;
}
function mimeTypeFor(format) {
    return MIME_TABLE[format];
}
function clampQuality(quality, fallback) {
    const numeric = Number(quality);
    if (!Number.isFinite(numeric))
        return fallback;
    return Math.max(0, Math.min(1, numeric));
}
function resolveExportFormat(options, downsampleQuality) {
    var _a;
    const providedOptions = options !== null && options !== void 0 ? options : {};
    const fileType = providedOptions.fileType;
    const formatAlias = providedOptions.format;
    const requested = fileType || formatAlias;
    const format = normalizeImageFormat(requested);
    const mimeType = mimeTypeFor(format);
    if (format === 'png') {
        return { format, mimeType, quality: undefined };
    }
    const rawQuality = (_a = providedOptions.quality) !== null && _a !== void 0 ? _a : downsampleQuality;
    const quality = clampQuality(rawQuality, downsampleQuality);
    return { format, mimeType, quality };
}

const EMPTY_DEFAULT_MASK_CONFIG = Object.freeze({});
const DEFAULT_LAYOUT_MODE = 'expand';
const DEFAULT_OPTIONS = {
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
    defaultDownloadFileName: 'edited_image',
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
const DEFAULT_LABEL = {
    getText: (mask) => mask.maskName};
const DEFAULT_CROP = {
    aspectRatio: 'free',
    minWidth: 100,
    minHeight: 100,
    padding: 10,
    hideMasksDuringCrop: true,
    preserveMasksAfterCrop: false,
    allowRotationOfCropRect: false,
    exportFileType: 'source'};
const DEFAULT_MOSAIC_CONFIG = Object.freeze({
    brushSize: 48,
    blockSize: 8,
    previewStroke: '#333',
    previewStrokeWidth: 1,
    previewStrokeDashArray: Object.freeze([4, 4]),
    previewFill: 'rgba(0,0,0,0)',
    outputFileType: 'source',
    outputQuality: undefined,
});
const DEFAULT_TEXT_ANNOTATION_CONFIG = Object.freeze({
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
const DEFAULT_DRAW_CONFIG = Object.freeze({
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
function isLayoutMode(value) {
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
function isFiniteNumber$1(value) {
    return typeof value === 'number' && Number.isFinite(value);
}
function normalizeMosaicPositiveNumber(value, fallback) {
    return isFiniteNumber$1(value) && value > 0 ? value : fallback;
}
function normalizeMosaicBlockSize(value, fallback) {
    return isFiniteNumber$1(value) && value > 0 ? Math.max(1, Math.floor(value)) : fallback;
}
function normalizeMosaicNonNegativeNumber(value, fallback) {
    return isFiniteNumber$1(value) && value >= 0 ? value : fallback;
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
    if (!isFiniteNumber$1(value))
        return fallback;
    return Math.max(0, Math.min(1, value));
}
function cloneResolvedMosaicConfig(config) {
    return {
        ...config,
        previewStrokeDashArray: config.previewStrokeDashArray
            ? [...config.previewStrokeDashArray]
            : null,
    };
}
function normalizeMosaicConfig(input, fallback) {
    if (!isConfigObject(input))
        return cloneResolvedMosaicConfig(fallback);
    return mergeMosaicConfigPatch(fallback, input);
}
function mergeMosaicConfigPatch(current, patch, fallback = current) {
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
function getInvalidMosaicConfigFields(input) {
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
function areResolvedMosaicConfigsEqual(left, right) {
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
function cloneResolvedTextAnnotationConfig(config) {
    return {
        ...config,
        styles: { ...config.styles },
    };
}
function cloneResolvedDrawConfig(config) {
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
function mergeTextAnnotationConfigPatch(current, patch, fallback = current) {
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
function normalizeTextAnnotationConfig(input, fallback) {
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
function mergeDrawConfigPatch(current, patch, fallback = current) {
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
function normalizeDrawConfig(input, fallback) {
    if (!isConfigObject(input))
        return cloneResolvedDrawConfig(fallback);
    return mergeDrawConfigPatch(fallback, input);
}
function areResolvedTextAnnotationConfigsEqual(left, right) {
    return JSON.stringify(left) === JSON.stringify(right);
}
function areResolvedDrawConfigsEqual(left, right) {
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
function getInvalidTextAnnotationConfigFields(input) {
    const raw = isConfigObject(input) ? input : {};
    const invalid = [];
    if (hasOwn(raw, 'text') && typeof raw.text !== 'string')
        invalid.push('text');
    if (hasOwn(raw, 'width') && !isFiniteNumber$1(raw.width))
        invalid.push('width');
    if (hasOwn(raw, 'fontSize') && !isFiniteNumber$1(raw.fontSize))
        invalid.push('fontSize');
    if (hasOwn(raw, 'fontFamily') && typeof raw.fontFamily !== 'string')
        invalid.push('fontFamily');
    if (hasOwn(raw, 'fill') && typeof raw.fill !== 'string') {
        invalid.push('fill');
    }
    return invalid;
}
function getInvalidDrawConfigFields(input) {
    const raw = isConfigObject(input) ? input : {};
    const invalid = [];
    if (hasOwn(raw, 'brushSize') && !isFiniteNumber$1(raw.brushSize))
        invalid.push('brushSize');
    if (hasOwn(raw, 'color') && typeof raw.color !== 'string')
        invalid.push('color');
    if (hasOwn(raw, 'opacity') && !isFiniteNumber$1(raw.opacity))
        invalid.push('opacity');
    return invalid;
}
function resolveOptions(input) {
    var _a, _b, _c, _d, _e;
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
        aspectRatio: (_a = userCrop.aspectRatio) !== null && _a !== void 0 ? _a : DEFAULT_CROP.aspectRatio,
        minWidth: normalizePositiveFiniteNumber(userCrop.minWidth, DEFAULT_CROP.minWidth),
        minHeight: normalizePositiveFiniteNumber(userCrop.minHeight, DEFAULT_CROP.minHeight),
        padding: normalizeNonNegativeFiniteNumber(userCrop.padding, DEFAULT_CROP.padding),
        hideMasksDuringCrop: (_b = userCrop.hideMasksDuringCrop) !== null && _b !== void 0 ? _b : DEFAULT_CROP.hideMasksDuringCrop,
        preserveMasksAfterCrop: (_c = userCrop.preserveMasksAfterCrop) !== null && _c !== void 0 ? _c : DEFAULT_CROP.preserveMasksAfterCrop,
        allowRotationOfCropRect: (_d = userCrop.allowRotationOfCropRect) !== null && _d !== void 0 ? _d : DEFAULT_CROP.allowRotationOfCropRect,
        exportFileType: (_e = userCrop.exportFileType) !== null && _e !== void 0 ? _e : DEFAULT_CROP.exportFileType,
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

class OperationGuard {
    constructor() {
        Object.defineProperty(this, "isAnimationActive", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "isDisposedFlag", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "isLoadingActive", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "currentOperationName", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "currentOperationToken", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "animationAborters", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Set()
        });
    }
    isAnimating() {
        return this.isAnimationActive;
    }
    isDisposed() {
        return this.isDisposedFlag;
    }
    isLoading() {
        return this.isLoadingActive;
    }
    activeOperationName() {
        return this.currentOperationName;
    }
    isBusy() {
        return (this.isAnimationActive || this.isLoadingActive || this.currentOperationToken !== null);
    }
    beginAnimation() {
        this.isAnimationActive = true;
    }
    endAnimation() {
        this.isAnimationActive = false;
    }
    markDisposed() {
        this.isDisposedFlag = true;
        this.isAnimationActive = false;
        this.isLoadingActive = false;
        this.currentOperationName = null;
        this.currentOperationToken = null;
        for (const abort of this.animationAborters) {
            try {
                abort();
            }
            catch {
            }
        }
        this.animationAborters.clear();
    }
    registerAnimationAborter(abort) {
        if (this.isDisposedFlag) {
            try {
                abort();
            }
            catch {
            }
            return () => undefined;
        }
        this.animationAborters.add(abort);
        return () => {
            this.animationAborters.delete(abort);
        };
    }
    beginLoading() {
        this.isLoadingActive = true;
    }
    endLoading() {
        this.isLoadingActive = false;
    }
    beginBusyOperation(operationName) {
        const token = Symbol(operationName);
        this.currentOperationName = operationName;
        this.currentOperationToken = token;
        return token;
    }
    endBusyOperation(token) {
        if (token && token === this.currentOperationToken) {
            this.currentOperationName = null;
            this.currentOperationToken = null;
        }
    }
    isOwnOperation(token) {
        return !!token && token === this.currentOperationToken;
    }
    async runAnimation(animationTask) {
        this.beginAnimation();
        try {
            return await animationTask();
        }
        finally {
            this.endAnimation();
        }
    }
    assertNotAnimating(operationLabel) {
        if (this.isAnimationActive) {
            throw new Error(`[ImageEditor] Cannot run "${operationLabel}" while an animation is in progress.`);
        }
    }
    assertIdleForOperation(operationLabel, token) {
        var _a;
        if (this.isDisposedFlag) {
            throw new Error(`[ImageEditor] Cannot run "${operationLabel}" after dispose.`);
        }
        const ownOperation = this.isOwnOperation(token);
        if (this.isAnimationActive) {
            throw new Error(`[ImageEditor] Cannot run "${operationLabel}" while an animation is in progress.`);
        }
        if (this.isLoadingActive && !ownOperation) {
            throw new Error(`[ImageEditor] Cannot run "${operationLabel}" while an image is loading.`);
        }
        if (this.currentOperationToken && !ownOperation) {
            throw new Error(`[ImageEditor] Cannot run "${operationLabel}" while ` +
                `${(_a = this.currentOperationName) !== null && _a !== void 0 ? _a : 'another operation'} is running.`);
        }
    }
    assertCanQueueAnimation(operationLabel, token) {
        var _a;
        if (this.isDisposedFlag) {
            throw new Error(`[ImageEditor] Cannot run "${operationLabel}" after dispose.`);
        }
        const ownOperation = this.isOwnOperation(token);
        if (this.isLoadingActive && !ownOperation) {
            throw new Error(`[ImageEditor] Cannot run "${operationLabel}" while an image is loading.`);
        }
        if (this.currentOperationToken && !ownOperation) {
            throw new Error(`[ImageEditor] Cannot run "${operationLabel}" while ` +
                `${(_a = this.currentOperationName) !== null && _a !== void 0 ? _a : 'another operation'} is running.`);
        }
    }
}

function isBaseImageObject(object) {
    return (!!object &&
        typeof object === 'object' &&
        object.editorObjectKind === 'baseImage');
}
function isMaskObject(object) {
    const candidate = object;
    return (!!candidate &&
        candidate.editorObjectKind === 'mask' &&
        typeof candidate.maskId === 'number' &&
        typeof candidate.maskUid === 'string' &&
        typeof candidate.maskName === 'string');
}
function isAnnotationObject(object) {
    const candidate = object;
    return (!!candidate &&
        candidate.editorObjectKind === 'annotation' &&
        typeof candidate.annotationId === 'number' &&
        typeof candidate.annotationType === 'string' &&
        typeof candidate.annotationName === 'string');
}
function isTextAnnotationObject(object) {
    return isAnnotationObject(object) && object.annotationType === 'text';
}
function isDrawAnnotationObject(object) {
    return isAnnotationObject(object) && object.annotationType === 'draw';
}
function isSessionObject(object) {
    const candidate = object;
    return (!!candidate &&
        candidate.editorObjectKind === 'session' &&
        typeof candidate.sessionObjectType === 'string');
}
function isEditableOverlayObject(object) {
    return isMaskObject(object) || isAnnotationObject(object);
}

function markBaseImageObject(image) {
    const baseImage = image;
    baseImage.editorObjectKind = 'baseImage';
    return baseImage;
}
function markMaskObject(object, meta) {
    const mask = object;
    mask.editorObjectKind = 'mask';
    mask.maskId = meta.maskId;
    mask.maskUid = meta.maskUid;
    mask.maskName = meta.maskName;
    mask.originalAlpha = meta.originalAlpha;
    if ('originalStroke' in meta)
        mask.originalStroke = meta.originalStroke;
    if (typeof meta.originalStrokeWidth === 'number') {
        mask.originalStrokeWidth = meta.originalStrokeWidth;
    }
    return mask;
}
function markAnnotationObject(object, meta) {
    var _a, _b;
    const annotation = object;
    annotation.editorObjectKind = 'annotation';
    annotation.annotationId = meta.annotationId;
    annotation.annotationType = meta.annotationType;
    annotation.annotationName = meta.annotationName;
    annotation.annotationHidden = (_a = meta.annotationHidden) !== null && _a !== void 0 ? _a : false;
    annotation.annotationLocked = (_b = meta.annotationLocked) !== null && _b !== void 0 ? _b : false;
    return annotation;
}
function markSessionObject(object, sessionObjectType) {
    const sessionObject = object;
    sessionObject.editorObjectKind = 'session';
    sessionObject.sessionObjectType = sessionObjectType;
    return sessionObject;
}

const SNAPSHOT_CUSTOM_KEYS = [
    'editorObjectKind',
    'sessionObjectType',
    'maskId',
    'maskUid',
    'maskName',
    'isCropRect',
    'maskLabel',
    'originalAlpha',
    'originalStroke',
    'originalStrokeWidth',
    'hasControls',
    'selectable',
    'strokeUniform',
    'lockRotation',
    'transparentCorners',
    'borderColor',
    'cornerColor',
    'cornerSize',
    'flipX',
    'flipY',
    'isMosaicPreview',
    'annotationId',
    'annotationType',
    'annotationName',
    'annotationHidden',
    'annotationLocked',
];
function copySnapshotCustomPropsFromCanvas(canvasObjects, jsonObjects) {
    if (!Array.isArray(jsonObjects))
        return;
    for (let index = 0; index < jsonObjects.length; index += 1) {
        const liveObject = canvasObjects[index];
        const jsonObject = jsonObjects[index];
        if (!liveObject || !jsonObject)
            continue;
        if (typeof liveObject.editorObjectKind === 'string') {
            jsonObject.editorObjectKind = liveObject.editorObjectKind;
        }
        if (typeof liveObject.sessionObjectType === 'string') {
            jsonObject.sessionObjectType = liveObject.sessionObjectType;
        }
        if (typeof liveObject.maskId === 'number')
            jsonObject.maskId = liveObject.maskId;
        if (typeof liveObject.maskUid === 'string')
            jsonObject.maskUid = liveObject.maskUid;
        if (typeof liveObject.maskName === 'string')
            jsonObject.maskName = liveObject.maskName;
        if (typeof liveObject.originalAlpha === 'number') {
            jsonObject.originalAlpha = liveObject.originalAlpha;
        }
        if ('originalStroke' in liveObject)
            jsonObject.originalStroke = liveObject.originalStroke;
        if (typeof liveObject.originalStrokeWidth === 'number') {
            jsonObject.originalStrokeWidth = liveObject.originalStrokeWidth;
        }
        if (typeof liveObject.hasControls === 'boolean') {
            jsonObject.hasControls = liveObject.hasControls;
        }
        if (typeof liveObject.selectable === 'boolean') {
            jsonObject.selectable = liveObject.selectable;
        }
        if (typeof liveObject.strokeUniform === 'boolean') {
            jsonObject.strokeUniform = liveObject.strokeUniform;
        }
        if (typeof liveObject.lockRotation === 'boolean') {
            jsonObject.lockRotation = liveObject.lockRotation;
        }
        if (typeof liveObject.transparentCorners === 'boolean') {
            jsonObject.transparentCorners = liveObject.transparentCorners;
        }
        if (typeof liveObject.borderColor === 'string') {
            jsonObject.borderColor = liveObject.borderColor;
        }
        if (typeof liveObject.cornerColor === 'string') {
            jsonObject.cornerColor = liveObject.cornerColor;
        }
        if (typeof liveObject.cornerSize === 'number') {
            jsonObject.cornerSize = liveObject.cornerSize;
        }
        if (typeof liveObject.flipX === 'boolean') {
            jsonObject.flipX = liveObject.flipX;
        }
        if (typeof liveObject.flipY === 'boolean') {
            jsonObject.flipY = liveObject.flipY;
        }
        if (liveObject.isCropRect === true)
            jsonObject.isCropRect = true;
        if (liveObject.maskLabel === true)
            jsonObject.maskLabel = true;
        if (liveObject.isMosaicPreview === true)
            jsonObject.isMosaicPreview = true;
        if (typeof liveObject.annotationId === 'number') {
            jsonObject.annotationId = liveObject.annotationId;
        }
        if (typeof liveObject.annotationType === 'string') {
            jsonObject.annotationType = liveObject.annotationType;
        }
        if (typeof liveObject.annotationName === 'string') {
            jsonObject.annotationName = liveObject.annotationName;
        }
        if (typeof liveObject.annotationHidden === 'boolean') {
            jsonObject.annotationHidden = liveObject.annotationHidden;
        }
        if (typeof liveObject.annotationLocked === 'boolean') {
            jsonObject.annotationLocked = liveObject.annotationLocked;
        }
    }
}
function isActiveSelectionObject$2(object) {
    if (!object)
        return false;
    const type = typeof object.type === 'string' ? object.type.toLowerCase() : '';
    if (type === 'activeselection')
        return true;
    const isType = object.isType;
    return (typeof isType === 'function' &&
        (isType.call(object, 'ActiveSelection') || isType.call(object, 'activeSelection')));
}
function saveState(input) {
    var _a, _b, _c;
    const { canvas, currentScale, currentRotation, baseImageScale } = input;
    const activeObject = (_b = (_a = canvas).getActiveObject) === null || _b === void 0 ? void 0 : _b.call(_a);
    const activeMaskId = activeObject && isMaskObject(activeObject)
        ? activeObject.maskId
        : typeof input.activeMaskId === 'number'
            ? input.activeMaskId
            : null;
    const activeAnnotationId = activeObject && isAnnotationObject(activeObject)
        ? activeObject.annotationId
        : typeof input.activeAnnotationId === 'number'
            ? input.activeAnnotationId
            : null;
    if (isActiveSelectionObject$2(activeObject)) {
        canvas.discardActiveObject();
    }
    const jsonObj = canvas.toJSON(SNAPSHOT_CUSTOM_KEYS);
    copySnapshotCustomPropsFromCanvas(canvas.getObjects(), jsonObj.objects);
    if (Array.isArray(jsonObj.objects)) {
        jsonObj.objects = jsonObj.objects.filter((o) => o.editorObjectKind !== 'session' &&
            o.isCropRect !== true &&
            o.maskLabel !== true &&
            o.isMosaicPreview !== true);
    }
    jsonObj._editorState = {
        currentScale,
        currentRotation,
        baseImageScale,
        currentImageMimeType: (_c = input.currentImageMimeType) !== null && _c !== void 0 ? _c : null,
        activeObjectKind: activeMaskId !== null ? 'mask' : activeAnnotationId !== null ? 'annotation' : null,
    };
    if (activeMaskId !== null)
        jsonObj._editorState.activeMaskId = activeMaskId;
    if (activeAnnotationId !== null) {
        jsonObj._editorState.activeAnnotationId = activeAnnotationId;
    }
    return JSON.stringify(jsonObj);
}
async function loadFromState(input) {
    var _a, _b;
    const { canvas, jsonString: snapshotInput, setCanvasSize } = input;
    const jsonString = typeof snapshotInput === 'string' ? snapshotInput : JSON.stringify(snapshotInput);
    const json = JSON.parse(jsonString);
    if (typeof json.width === 'number' &&
        json.width > 0 &&
        typeof json.height === 'number' &&
        json.height > 0) {
        setCanvasSize(json.width, json.height);
    }
    await canvas.loadFromJSON(json);
    const objects = canvas.getObjects();
    restoreEditorObjectPropsFromJson(objects, (_a = json.objects) !== null && _a !== void 0 ? _a : []);
    const editorState = json._editorState && typeof json._editorState === 'object'
        ? {
            currentScale: typeof json._editorState.currentScale === 'number'
                ? json._editorState.currentScale
                : 1,
            currentRotation: typeof json._editorState.currentRotation === 'number'
                ? json._editorState.currentRotation
                : 0,
            baseImageScale: typeof json._editorState.baseImageScale === 'number'
                ? json._editorState.baseImageScale
                : 1,
        }
        : null;
    if (editorState && json._editorState && typeof json._editorState.activeMaskId === 'number') {
        editorState.activeMaskId = json._editorState.activeMaskId;
    }
    if (editorState &&
        json._editorState &&
        typeof json._editorState.activeAnnotationId === 'number') {
        editorState.activeAnnotationId = json._editorState.activeAnnotationId;
    }
    if (editorState && json._editorState && 'activeObjectKind' in json._editorState) {
        const kind = json._editorState.activeObjectKind;
        editorState.activeObjectKind =
            kind === 'mask' || kind === 'annotation' || kind === null ? kind : null;
    }
    if (editorState && json._editorState && 'currentImageMimeType' in json._editorState) {
        const mimeType = json._editorState.currentImageMimeType;
        editorState.currentImageMimeType =
            mimeType === 'image/jpeg' || mimeType === 'image/png' || mimeType === 'image/webp'
                ? mimeType
                : null;
    }
    const maxMaskId = objects
        .filter(isMaskObject)
        .reduce((max, maskObject) => Math.max(max, maskObject.maskId), 0);
    const maxAnnotationId = objects
        .filter(isAnnotationObject)
        .reduce((max, annotationObject) => Math.max(max, annotationObject.annotationId), 0);
    const masks = objects.filter(isMaskObject);
    const annotations = objects.filter(isAnnotationObject);
    const originalImage = (_b = objects.find(isBaseImageObject)) !== null && _b !== void 0 ? _b : null;
    return {
        editorState,
        maxMaskId,
        maxAnnotationId,
        originalImage,
        objects,
        masks,
        annotations,
        jsonString,
    };
}
function restoreEditorObjectPropsFromJson(canvasObjs, jsonObjs) {
    var _a, _b, _c, _d;
    jsonObjs.forEach((jObj, index) => {
        const canvasObj = canvasObjs[index];
        if (!canvasObj)
            return;
        if (jObj.editorObjectKind === 'baseImage') {
            markBaseImageObject(canvasObj);
            return;
        }
        if (jObj.editorObjectKind === 'annotation' &&
            typeof jObj.annotationId === 'number' &&
            typeof jObj.annotationType === 'string' &&
            typeof jObj.annotationName === 'string') {
            markAnnotationObject(canvasObj, {
                annotationId: jObj.annotationId,
                annotationType: jObj.annotationType === 'draw' ? 'draw' : 'text',
                annotationName: jObj.annotationName,
                annotationHidden: typeof jObj.annotationHidden === 'boolean' ? jObj.annotationHidden : false,
                annotationLocked: typeof jObj.annotationLocked === 'boolean' ? jObj.annotationLocked : false,
            });
            return;
        }
        if (jObj.editorObjectKind === 'session' && typeof jObj.sessionObjectType === 'string') {
            canvasObj.editorObjectKind = 'session';
            canvasObj.sessionObjectType = jObj.sessionObjectType;
        }
    });
    const consumedCanvasIndexes = new Set();
    for (const jObj of jsonObjs) {
        if (jObj.editorObjectKind !== 'mask' || typeof jObj.maskId !== 'number')
            continue;
        const jType = String((_a = jObj.type) !== null && _a !== void 0 ? _a : '');
        const jLeft = Number((_b = jObj.left) !== null && _b !== void 0 ? _b : 0);
        const jTop = Number((_c = jObj.top) !== null && _c !== void 0 ? _c : 0);
        const jUid = typeof jObj.maskUid === 'string' ? jObj.maskUid : null;
        let matchIndex = -1;
        if (jUid) {
            matchIndex = canvasObjs.findIndex((o, index) => {
                if (consumedCanvasIndexes.has(index))
                    return false;
                return o.maskUid === jUid;
            });
        }
        if (matchIndex < 0) {
            matchIndex = canvasObjs.findIndex((o, index) => {
                var _a, _b;
                if (consumedCanvasIndexes.has(index))
                    return false;
                if (jType && o.type !== jType)
                    return false;
                return Math.abs(((_a = o.left) !== null && _a !== void 0 ? _a : 0) - jLeft) < 0.5 && Math.abs(((_b = o.top) !== null && _b !== void 0 ? _b : 0) - jTop) < 0.5;
            });
        }
        if (matchIndex < 0)
            continue;
        consumedCanvasIndexes.add(matchIndex);
        const match = canvasObjs[matchIndex];
        const maskObject = match;
        const originalStroke = 'originalStroke' in jObj
            ? jObj.originalStroke
            : undefined;
        markMaskObject(maskObject, {
            maskId: jObj.maskId,
            maskUid: typeof jObj.maskUid === 'string' ? jObj.maskUid : `mask-${jObj.maskId}`,
            maskName: typeof jObj.maskName === 'string' ? jObj.maskName : '',
            originalAlpha: typeof jObj.originalAlpha === 'number'
                ? jObj.originalAlpha
                : ((_d = maskObject.opacity) !== null && _d !== void 0 ? _d : 0.5),
            originalStroke,
            originalStrokeWidth: typeof jObj.originalStrokeWidth === 'number' ? jObj.originalStrokeWidth : undefined,
        });
        if ('originalStroke' in jObj) {
            maskObject.originalStroke = jObj.originalStroke;
        }
        if (typeof jObj.originalStrokeWidth === 'number') {
            maskObject.originalStrokeWidth = jObj.originalStrokeWidth;
        }
        if (typeof jObj.hasControls === 'boolean') {
            maskObject.hasControls = jObj.hasControls;
        }
        if (typeof jObj.selectable === 'boolean') {
            maskObject.selectable = jObj.selectable;
        }
        if (typeof jObj.strokeUniform === 'boolean') {
            maskObject.strokeUniform = jObj.strokeUniform;
        }
        if (typeof jObj.lockRotation === 'boolean') {
            maskObject.lockRotation = jObj.lockRotation;
        }
        if (typeof jObj.transparentCorners === 'boolean') {
            maskObject.transparentCorners = jObj.transparentCorners;
        }
        if (typeof jObj.borderColor === 'string') {
            maskObject.borderColor = jObj.borderColor;
        }
        if (typeof jObj.cornerColor === 'string') {
            maskObject.cornerColor = jObj.cornerColor;
        }
        if (typeof jObj.cornerSize === 'number') {
            maskObject.cornerSize = jObj.cornerSize;
        }
    }
    jsonObjs.forEach((jObj, index) => {
        if (jObj.maskLabel !== true)
            return;
        const canvasObj = canvasObjs[index];
        if (canvasObj) {
            canvasObj.maskLabel = true;
        }
    });
}

class Command {
    constructor(execute, undo) {
        Object.defineProperty(this, "execute", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "undo", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.execute = execute;
        this.undo = undo;
    }
}
class HistoryManager {
    constructor(maxSize = 50) {
        Object.defineProperty(this, "history", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "currentIndex", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: -1
        });
        Object.defineProperty(this, "isProcessing", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "maxSize", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.maxSize = maxSize;
    }
    async execute(command) {
        await command.execute();
        this.pushAndTrim(command);
    }
    push(command) {
        this.pushAndTrim(command);
    }
    canUndo() {
        return this.currentIndex >= 0;
    }
    canRedo() {
        return this.currentIndex < this.history.length - 1;
    }
    async undo() {
        if (this.isProcessing || !this.canUndo())
            return;
        this.isProcessing = true;
        try {
            const cmd = this.history[this.currentIndex];
            if (!cmd)
                return;
            await cmd.undo();
            this.currentIndex--;
        }
        finally {
            this.isProcessing = false;
        }
    }
    async redo() {
        if (this.isProcessing || !this.canRedo())
            return;
        this.isProcessing = true;
        try {
            const cmd = this.history[this.currentIndex + 1];
            if (!cmd)
                return;
            await cmd.execute();
            this.currentIndex++;
        }
        finally {
            this.isProcessing = false;
        }
    }
    pushAndTrim(command) {
        if (this.currentIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.currentIndex + 1);
        }
        this.history.push(command);
        if (this.history.length > this.maxSize) {
            this.history.shift();
        }
        else {
            this.currentIndex++;
        }
    }
}

function looksLikeFabricModule(value) {
    if (value === null || typeof value !== 'object')
        return false;
    const candidate = value.Canvas;
    return typeof candidate === 'function';
}
function readGlobalFabric(globalScope) {
    return globalScope.fabric;
}
function detectFabric(fabricOrOptions, maybeOptions, globalScope = globalThis) {
    var _a;
    if (looksLikeFabricModule(fabricOrOptions)) {
        return {
            fabric: fabricOrOptions,
            isFabricLoaded: true,
            options: maybeOptions !== null && maybeOptions !== void 0 ? maybeOptions : {},
        };
    }
    const options = (_a = fabricOrOptions) !== null && _a !== void 0 ? _a : {};
    const globalFabric = readGlobalFabric(globalScope);
    if (looksLikeFabricModule(globalFabric)) {
        return {
            fabric: globalFabric,
            isFabricLoaded: true,
            options,
        };
    }
    console.error('[ImageEditor] fabric.js v7 is not available. ' +
        'Pass it as the first constructor argument (ESM) or ' +
        'load it as a global <script> before instantiation.');
    return {
        fabric: null,
        isFabricLoaded: false,
        options,
    };
}

function isAnnotationLocked(annotation) {
    return annotation.annotationLocked === true;
}
function isAnnotationUnlocked(annotation) {
    return !isAnnotationLocked(annotation);
}

function setObjectProps(object, props) {
    try {
        object.set(props);
    }
    catch {
        Object.assign(object, props);
    }
}
function syncTextEditability(annotation, editable) {
    const textObject = annotation;
    textObject.editable = editable;
}
function syncAnnotationRuntimeState(annotation) {
    var _a;
    const hidden = annotation.annotationHidden === true;
    const locked = isAnnotationLocked(annotation);
    setObjectProps(annotation, {
        visible: !hidden,
        selectable: locked ? false : true,
        evented: locked ? false : true,
        hasControls: !locked,
        lockMovementX: locked,
        lockMovementY: locked,
        lockScalingX: locked,
        lockScalingY: locked,
        lockRotation: locked,
    });
    if (!locked) {
        setObjectProps(annotation, {
            selectable: true,
            evented: true,
            hasControls: true,
            lockMovementX: false,
            lockMovementY: false,
            lockScalingX: false,
            lockScalingY: false,
            lockRotation: false,
        });
    }
    if (isTextAnnotationObject(annotation)) {
        syncTextEditability(annotation, !locked);
    }
    (_a = annotation.setCoords) === null || _a === void 0 ? void 0 : _a.call(annotation);
}
function syncAnnotationRuntimeStates(annotations) {
    annotations.forEach(syncAnnotationRuntimeState);
}

function isActiveSelectionObject$1(object) {
    if (!object)
        return false;
    const type = typeof object.type === 'string' ? object.type.toLowerCase() : '';
    if (type === 'activeselection')
        return true;
    const isType = object.isType;
    return (typeof isType === 'function' &&
        (isType.call(object, 'ActiveSelection') || isType.call(object, 'activeSelection')));
}
function getActiveSelectionObjects(canvas) {
    const active = canvas.getActiveObject();
    if (!active)
        return [];
    if (!isActiveSelectionObject$1(active))
        return [active];
    const getObjects = active.getObjects;
    return typeof getObjects === 'function' ? getObjects.call(active) : [];
}
function getAnnotations(canvas) {
    return canvas.getObjects().filter(isAnnotationObject).slice();
}
function getSelectedAnnotations(canvas) {
    return getActiveSelectionObjects(canvas).filter(isAnnotationObject);
}
function snapshotAnnotation(annotation) {
    return JSON.stringify({
        text: annotation.text,
        fontSize: annotation.fontSize,
        fontFamily: annotation.fontFamily,
        fontWeight: annotation.fontWeight,
        fill: annotation.fill,
        backgroundColor: annotation.backgroundColor,
        textAlign: annotation.textAlign,
        width: annotation.width,
        stroke: annotation.stroke,
        strokeWidth: annotation.strokeWidth,
        opacity: annotation.opacity,
        visible: annotation.visible,
        selectable: annotation.selectable,
        evented: annotation.evented,
        annotationHidden: annotation.annotationHidden,
        annotationLocked: annotation.annotationLocked,
    });
}
function setAnnotationProps(annotation, props) {
    try {
        annotation.set(props);
    }
    catch {
        Object.assign(annotation, props);
    }
}
function updateTextAnnotation(annotation, config) {
    const props = {};
    const raw = config;
    if (typeof raw.text === 'string')
        props.text = raw.text;
    if (typeof raw.fontSize === 'number' && Number.isFinite(raw.fontSize) && raw.fontSize > 0) {
        props.fontSize = raw.fontSize;
    }
    if (typeof raw.fontFamily === 'string')
        props.fontFamily = raw.fontFamily;
    if (typeof raw.fontWeight === 'string' || typeof raw.fontWeight === 'number') {
        props.fontWeight = raw.fontWeight;
    }
    if (typeof raw.fill === 'string')
        props.fill = raw.fill;
    if (typeof raw.backgroundColor === 'string')
        props.backgroundColor = raw.backgroundColor;
    if (raw.textAlign === 'left' ||
        raw.textAlign === 'center' ||
        raw.textAlign === 'right' ||
        raw.textAlign === 'justify') {
        props.textAlign = raw.textAlign;
    }
    if (typeof raw.width === 'number' && Number.isFinite(raw.width) && raw.width > 0) {
        props.width = raw.width;
    }
    if (Object.keys(props).length > 0)
        setAnnotationProps(annotation, props);
}
function updateDrawAnnotation(annotation, config) {
    const props = {};
    const raw = config;
    if (typeof raw.stroke === 'string')
        props.stroke = raw.stroke;
    if (typeof raw.strokeWidth === 'number' &&
        Number.isFinite(raw.strokeWidth) &&
        raw.strokeWidth > 0) {
        props.strokeWidth = raw.strokeWidth;
    }
    if (typeof raw.opacity === 'number' && Number.isFinite(raw.opacity)) {
        props.opacity = Math.max(0, Math.min(1, raw.opacity));
    }
    if (Object.keys(props).length > 0)
        setAnnotationProps(annotation, props);
}
function updateAnnotationObject(annotation, config) {
    const before = snapshotAnnotation(annotation);
    const raw = config;
    if (typeof raw.annotationHidden === 'boolean') {
        annotation.annotationHidden = raw.annotationHidden;
    }
    if (typeof raw.annotationLocked === 'boolean') {
        annotation.annotationLocked = raw.annotationLocked;
    }
    const lockedAfter = isAnnotationLocked(annotation);
    if (!lockedAfter) {
        if (typeof raw.selectable === 'boolean')
            annotation.selectable = raw.selectable;
        if (typeof raw.evented === 'boolean')
            annotation.evented = raw.evented;
        if (isTextAnnotationObject(annotation))
            updateTextAnnotation(annotation, config);
        if (isDrawAnnotationObject(annotation))
            updateDrawAnnotation(annotation, config);
    }
    syncAnnotationRuntimeState(annotation);
    return snapshotAnnotation(annotation) !== before;
}
function updateAnnotation(context, annotationId, config) {
    const target = getAnnotations(context.canvas).find((annotation) => annotation.annotationId === annotationId);
    if (!target)
        return false;
    const changed = updateAnnotationObject(target, config);
    if (!changed)
        return false;
    context.canvas.requestRenderAll();
    context.saveCanvasState();
    context.updateUi();
    return true;
}
function updateSelectedAnnotation(context, config) {
    const selectedAnnotations = getSelectedAnnotations(context.canvas);
    if (selectedAnnotations.length === 0)
        return false;
    const changed = selectedAnnotations
        .map((annotation) => updateAnnotationObject(annotation, config))
        .some(Boolean);
    if (!changed)
        return false;
    context.canvas.requestRenderAll();
    context.saveCanvasState();
    context.updateUi();
    return true;
}
function removeAnnotationObjects(context, objects, options = {}) {
    const force = options.force === true;
    const removable = objects.filter((annotation) => force || isAnnotationUnlocked(annotation));
    if (removable.length === 0)
        return 0;
    for (const annotation of removable) {
        context.canvas.remove(annotation);
    }
    context.canvas.discardActiveObject();
    context.canvas.renderAll();
    if (options.saveHistory !== false)
        context.saveCanvasState();
    context.updateUi();
    return removable.length;
}
function removeSelectedAnnotation(context) {
    return removeAnnotationObjects(context, getSelectedAnnotations(context.canvas));
}
function removeAllAnnotations(context, options = {}) {
    return removeAnnotationObjects(context, getAnnotations(context.canvas), options);
}
function getAnnotationListDocument(context) {
    var _a, _b, _c, _d, _e;
    const canvasLike = context.canvas;
    return ((_e = (_c = (_b = (_a = canvasLike === null || canvasLike === void 0 ? void 0 : canvasLike.getElement) === null || _a === void 0 ? void 0 : _a.call(canvasLike)) === null || _b === void 0 ? void 0 : _b.ownerDocument) !== null && _c !== void 0 ? _c : (_d = canvasLike === null || canvasLike === void 0 ? void 0 : canvasLike.lowerCanvasEl) === null || _d === void 0 ? void 0 : _d.ownerDocument) !== null && _e !== void 0 ? _e : document);
}
function renderAnnotationList(context) {
    const listId = context.getListElementId();
    if (!listId)
        return;
    const ownerDocument = getAnnotationListDocument(context);
    const listEl = ownerDocument.getElementById(listId);
    if (!listEl || !context.canvas)
        return;
    listEl.innerHTML = '';
    const canvas = context.canvas;
    getAnnotations(canvas).forEach((annotation) => {
        const item = ownerDocument.createElement('li');
        item.className = 'list-group-item annotation-item';
        item.textContent = annotation.annotationName;
        item.dataset.annotationId = String(annotation.annotationId);
        item.onclick = () => {
            const id = Number(item.dataset.annotationId);
            if (!Number.isFinite(id))
                return;
            const target = getAnnotations(canvas).find((candidate) => candidate.annotationId === id);
            if (!target)
                return;
            canvas.setActiveObject(target);
            context.onAnnotationSelected(target);
        };
        listEl.appendChild(item);
    });
}
function updateAnnotationListSelection(context, selectedAnnotation) {
    const listId = context.getListElementId();
    if (!listId)
        return;
    const listEl = getAnnotationListDocument(context).getElementById(listId);
    if (!listEl)
        return;
    const selectedId = selectedAnnotation ? String(selectedAnnotation.annotationId) : null;
    listEl.querySelectorAll('.annotation-item').forEach((item) => {
        item.classList.toggle('active', selectedId !== null && item.dataset.annotationId === selectedId);
    });
}

function isLegacySessionObject(object) {
    const candidate = object;
    return (candidate.isCropRect === true ||
        candidate.maskLabel === true ||
        candidate.isMosaicPreview === true);
}
function moveObjectTo(canvas, object, index) {
    const canvasWithLayerApi = canvas;
    if (typeof canvasWithLayerApi.moveObjectTo === 'function') {
        canvasWithLayerApi.moveObjectTo(object, index);
        return;
    }
    try {
        canvas.remove(object);
        canvas.insertAt(index, object);
    }
    catch {
        canvas.add(object);
    }
}
function ensureOnCanvas(canvas, object) {
    if (!canvas.getObjects().includes(object)) {
        canvas.add(object);
    }
}
function withoutObject(canvas, object) {
    return canvas.getObjects().filter((candidate) => candidate !== object);
}
function findFirstSessionIndex(objects) {
    return objects.findIndex((object) => isSessionObject(object) || isLegacySessionObject(object));
}
function getOrderedGroups(canvas) {
    const baseImages = [];
    const overlays = [];
    const sessions = [];
    const others = [];
    for (const object of canvas.getObjects()) {
        if (isBaseImageObject(object)) {
            baseImages.push(object);
        }
        else if (isEditableOverlayObject(object)) {
            overlays.push(object);
        }
        else if (isSessionObject(object) || isLegacySessionObject(object)) {
            sessions.push(object);
        }
        else {
            others.push(object);
        }
    }
    return { baseImages, overlays, sessions, others };
}
function normalizeLayerOrder(canvas) {
    const groups = getOrderedGroups(canvas);
    const ordered = [
        ...groups.baseImages,
        ...groups.others,
        ...groups.overlays,
        ...groups.sessions,
    ];
    ordered.forEach((object, index) => {
        moveObjectTo(canvas, object, index);
    });
}
function placeMaskObject(canvas, mask) {
    ensureOnCanvas(canvas, mask);
    const objects = withoutObject(canvas, mask);
    const firstSessionIndex = findFirstSessionIndex(objects);
    moveObjectTo(canvas, mask, firstSessionIndex === -1 ? objects.length : firstSessionIndex);
}
function placeAnnotationObject(canvas, annotation) {
    ensureOnCanvas(canvas, annotation);
    const objects = withoutObject(canvas, annotation);
    const firstSessionIndex = findFirstSessionIndex(objects);
    moveObjectTo(canvas, annotation, firstSessionIndex === -1 ? objects.length : firstSessionIndex);
}
function getEditableOverlayRange(canvas) {
    const objects = canvas.getObjects();
    const overlayIndexes = objects
        .map((object, index) => ({ object, index }))
        .filter(({ object }) => isEditableOverlayObject(object));
    if (overlayIndexes.length === 0)
        return { start: -1, end: -1, overlays: [] };
    return {
        start: overlayIndexes[0].index,
        end: overlayIndexes[overlayIndexes.length - 1].index,
        overlays: overlayIndexes.map(({ object }) => object),
    };
}

function hasMeaningfulCanvasRegion(rect, canvasWidth, canvasHeight) {
    const left = Number(rect.left);
    const top = Number(rect.top);
    const width = Number(rect.width);
    const height = Number(rect.height);
    if (!Number.isFinite(left) ||
        !Number.isFinite(top) ||
        !Number.isFinite(width) ||
        !Number.isFinite(height) ||
        width <= 0 ||
        height <= 0) {
        return false;
    }
    const right = left + width;
    const bottom = top + height;
    if (!Number.isFinite(right) || !Number.isFinite(bottom))
        return false;
    const safeCanvasWidth = Number(canvasWidth);
    const safeCanvasHeight = Number(canvasHeight);
    if (!Number.isFinite(safeCanvasWidth) ||
        !Number.isFinite(safeCanvasHeight) ||
        safeCanvasWidth <= 0 ||
        safeCanvasHeight <= 0) {
        return true;
    }
    const overlapWidth = Math.min(right, safeCanvasWidth) - Math.max(left, 0);
    const overlapHeight = Math.min(bottom, safeCanvasHeight) - Math.max(top, 0);
    return overlapWidth > 0 && overlapHeight > 0;
}
function getClampedCanvasRegion(rect, canvasWidth, canvasHeight, options = {}) {
    const safeLeft = Number.isFinite(rect.left) ? rect.left : 0;
    const safeTop = Number.isFinite(rect.top) ? rect.top : 0;
    const safeWidth = Math.max(0, Number.isFinite(rect.width) ? rect.width : 0);
    const safeHeight = Math.max(0, Number.isFinite(rect.height) ? rect.height : 0);
    const includePartialPixels = options.includePartialPixels !== false;
    const roundEnd = includePartialPixels ? Math.ceil : Math.floor;
    const hasCanvasWidth = Number.isFinite(canvasWidth);
    const hasCanvasHeight = Number.isFinite(canvasHeight);
    const safeCanvasWidth = hasCanvasWidth
        ? Math.max(1, Math.round(Number(canvasWidth)))
        : Number.POSITIVE_INFINITY;
    const safeCanvasHeight = hasCanvasHeight
        ? Math.max(1, Math.round(Number(canvasHeight)))
        : Number.POSITIVE_INFINITY;
    const left = Math.min(safeCanvasWidth - 1, Math.max(0, Math.floor(safeLeft)));
    const top = Math.min(safeCanvasHeight - 1, Math.max(0, Math.floor(safeTop)));
    const right = Math.min(safeCanvasWidth, Math.max(left + 1, roundEnd(safeLeft + safeWidth)));
    const bottom = Math.min(safeCanvasHeight, Math.max(top + 1, roundEnd(safeTop + safeHeight)));
    return {
        left,
        top,
        width: Math.max(1, right - left),
        height: Math.max(1, bottom - top),
    };
}
function hasFractionalCanvasEdge(value) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue))
        return false;
    return Math.abs(numericValue - Math.round(numericValue)) > 0.01;
}
function getPartialExportEdges(bounds, angle = 0) {
    if (!bounds)
        return null;
    const normalizedAngle = Math.abs((Number(angle) || 0) % 90);
    const isAxisAligned = normalizedAngle < 0.01 || Math.abs(normalizedAngle - 90) < 0.01;
    if (!isAxisAligned)
        return null;
    const left = Number(bounds.left) || 0;
    const top = Number(bounds.top) || 0;
    return {
        left: hasFractionalCanvasEdge(left),
        top: hasFractionalCanvasEdge(top),
        right: hasFractionalCanvasEdge(left + (Number(bounds.width) || 0)),
        bottom: hasFractionalCanvasEdge(top + (Number(bounds.height) || 0)),
    };
}
function getObjectBBox(object) {
    object.setCoords();
    const boundingRect = object.getBoundingRect();
    return {
        left: boundingRect.left,
        top: boundingRect.top,
        width: boundingRect.width,
        height: boundingRect.height,
    };
}

function resolveNumeric(val, axis, fallback, canvas, options) {
    if (typeof val === 'number') {
        return val;
    }
    if (typeof val === 'function') {
        return val(canvas, options);
    }
    if (typeof val === 'string' && val.endsWith('%')) {
        const pct = parseFloat(val);
        if (!Number.isFinite(pct)) {
            return fallback;
        }
        const dim = axis === 'x' ? canvas.getWidth() : canvas.getHeight();
        return Math.floor(dim * (pct / 100));
    }
    return fallback;
}
function coercePoint(pt) {
    if (Array.isArray(pt)) {
        return { x: Number(pt[0]), y: Number(pt[1]) };
    }
    return { x: Number(pt.x), y: Number(pt.y) };
}

function isFinitePoint(value) {
    const point = value;
    return (!!point &&
        typeof point.x === 'number' &&
        Number.isFinite(point.x) &&
        typeof point.y === 'number' &&
        Number.isFinite(point.y));
}
function getPointerFromFabricEvent(canvas, event) {
    const fabricEvent = event && typeof event === 'object'
        ? event
        : null;
    if (!fabricEvent)
        return null;
    if (isFinitePoint(fabricEvent.scenePoint))
        return { ...fabricEvent.scenePoint };
    if (isFinitePoint(fabricEvent.pointer))
        return { ...fabricEvent.pointer };
    if (isFinitePoint(fabricEvent.absolutePointer))
        return { ...fabricEvent.absolutePointer };
    if (fabricEvent.e && typeof canvas.getPointer === 'function') {
        const pointer = canvas.getPointer(fabricEvent.e);
        if (isFinitePoint(pointer))
            return { ...pointer };
    }
    return null;
}

function resolveDefaultTextPosition(context) {
    const image = context.getOriginalImage();
    if (image) {
        const bounds = getObjectBBox(image);
        return { left: Math.round(bounds.left + 10), top: Math.round(bounds.top + 10) };
    }
    return { left: 10, top: 10 };
}
function resolveTextCreationConfig(context, config) {
    var _a, _b;
    const base = mergeTextAnnotationConfigPatch(context.getTextConfig(), config);
    const fallback = resolveDefaultTextPosition(context);
    const leftInput = (_a = config.left) !== null && _a !== void 0 ? _a : base.left;
    const topInput = (_b = config.top) !== null && _b !== void 0 ? _b : base.top;
    return {
        ...base,
        left: resolveNumeric(leftInput, 'x', fallback.left, context.canvas, context.options),
        top: resolveNumeric(topInput, 'y', fallback.top, context.canvas, context.options),
    };
}
function nextAnnotationMeta(context, config) {
    const annotationId = context.getAnnotationCounter() + 1;
    context.setAnnotationCounter(annotationId);
    return {
        annotationId,
        annotationName: `${context.options.textAnnotationName}${annotationId}`,
        annotationHidden: config.annotationHidden,
        annotationLocked: config.annotationLocked,
    };
}
function attachTextEditingHandlers(context, annotation) {
    const textObject = annotation;
    if (textObject.imageEditorTextEditingHandlers) {
        try {
            textObject.off('editing:entered', textObject.imageEditorTextEditingHandlers.entered);
            textObject.off('editing:exited', textObject.imageEditorTextEditingHandlers.exited);
        }
        catch {
        }
    }
    const entered = () => {
        var _a;
        textObject.imageEditorTextEditingInitialText = String((_a = textObject.text) !== null && _a !== void 0 ? _a : '');
        textObject.imageEditorTextEditingCancel = false;
    };
    const exited = () => {
        var _a;
        const initial = textObject.imageEditorTextEditingInitialText;
        const finalText = String((_a = textObject.text) !== null && _a !== void 0 ? _a : '');
        const cancel = textObject.imageEditorTextEditingCancel === true;
        if (cancel && initial !== undefined) {
            textObject.set({ text: initial });
        }
        delete textObject.imageEditorTextEditingInitialText;
        delete textObject.imageEditorTextEditingCancel;
        if (!cancel && initial !== undefined && initial !== finalText) {
            context.saveCanvasState();
            const callbackContext = context.buildCallbackContext('createTextAnnotation');
            context.emitAnnotationsChanged(callbackContext);
            context.emitImageChanged(callbackContext);
        }
    };
    textObject.on('editing:entered', entered);
    textObject.on('editing:exited', exited);
    textObject.imageEditorTextEditingHandlers = { entered, exited };
}
function selectAllText(annotation) {
    var _a;
    const textObject = annotation;
    const textLength = String((_a = textObject.text) !== null && _a !== void 0 ? _a : '').length;
    if (textLength <= 0)
        return;
    if (typeof textObject.selectAll === 'function') {
        textObject.selectAll();
        return;
    }
    if (typeof textObject.setSelectionStart === 'function' &&
        typeof textObject.setSelectionEnd === 'function') {
        textObject.setSelectionStart(0);
        textObject.setSelectionEnd(textLength);
        return;
    }
    textObject.selectionStart = 0;
    textObject.selectionEnd = textLength;
}
function createTextAnnotation(context, config = {}) {
    var _a, _b;
    if (!context.isImageLoaded())
        return null;
    const resolved = resolveTextCreationConfig(context, config);
    const textbox = new context.fabric.Textbox(resolved.text, {
        left: resolved.left,
        top: resolved.top,
        width: resolved.width,
        fontSize: resolved.fontSize,
        fontFamily: resolved.fontFamily,
        fontWeight: resolved.fontWeight,
        fill: resolved.fill,
        backgroundColor: resolved.backgroundColor,
        textAlign: resolved.textAlign,
        angle: resolved.angle,
        selectable: resolved.selectable,
        evented: resolved.evented,
        editable: resolved.editable,
        originX: 'left',
        originY: 'top',
        ...resolved.styles,
    });
    const meta = nextAnnotationMeta(context, resolved);
    const annotation = markAnnotationObject(textbox, {
        annotationId: meta.annotationId,
        annotationType: 'text',
        annotationName: meta.annotationName,
        annotationHidden: meta.annotationHidden,
        annotationLocked: meta.annotationLocked,
    });
    syncAnnotationRuntimeState(annotation);
    attachTextEditingHandlers(context, annotation);
    placeAnnotationObject(context.canvas, annotation);
    if (resolved.selectable !== false && isAnnotationUnlocked(annotation)) {
        context.canvas.setActiveObject(annotation);
    }
    context.canvas.renderAll();
    context.updateAnnotationList();
    context.saveCanvasState();
    const callbackContext = context.buildCallbackContext('createTextAnnotation');
    context.emitAnnotationsChanged(callbackContext);
    context.emitImageChanged(callbackContext);
    if (resolved.enterEditing && isAnnotationUnlocked(annotation)) {
        (_b = (_a = annotation).enterEditing) === null || _b === void 0 ? void 0 : _b.call(_a);
        selectAllText(annotation);
    }
    return annotation;
}
function handleTextModePointer(context, event) {
    var _a, _b;
    const fabricEvent = event;
    const target = fabricEvent.target;
    if (target) {
        if (isTextAnnotationObject(target) && isAnnotationUnlocked(target)) {
            context.canvas.setActiveObject(target);
            (_b = (_a = target).enterEditing) === null || _b === void 0 ? void 0 : _b.call(_a);
        }
        else if (isEditableOverlayObject(target)) {
            context.canvas.setActiveObject(target);
        }
        return;
    }
    const pointer = getPointerFromFabricEvent(context.canvas, event);
    if (!pointer)
        return;
    createTextAnnotation(context, {
        left: pointer.x,
        top: pointer.y,
    });
}
function enterTextMode(context) {
    if (context.getTextSession())
        return;
    if (!context.isImageLoaded())
        return;
    const { canvas } = context;
    const previousCanvasSelection = !!canvas.selection;
    const previousDefaultCursor = canvas.defaultCursor;
    canvas.selection = true;
    canvas.defaultCursor = 'text';
    const callback = (event) => handleTextModePointer(context, event);
    canvas.on('mouse:down', callback);
    const session = {
        mode: 'text',
        previousCanvasSelection,
        previousDefaultCursor,
        handlers: [{ eventName: 'mouse:down', callback }],
        dispose: () => {
            try {
                canvas.off('mouse:down', callback);
            }
            catch {
            }
            canvas.selection = previousCanvasSelection;
            canvas.defaultCursor = previousDefaultCursor !== null && previousDefaultCursor !== void 0 ? previousDefaultCursor : 'default';
        },
    };
    const preview = new context.fabric.Rect({
        left: -1,
        top: -1,
        width: 1,
        height: 1,
        selectable: false,
        evented: false,
        visible: false,
        excludeFromExport: true,
    });
    markSessionObject(preview, 'textPreview');
    context.setTextSession(session);
    context.updateUi();
}
function exitTextMode(context) {
    const session = context.getTextSession();
    if (!session)
        return;
    session.dispose();
    context.setTextSession(null);
    context.canvas.requestRenderAll();
    context.updateUi();
}
function finalizeActiveTextEditing(context, options) {
    var _a;
    const active = context.canvas.getActiveObject();
    if (!active || !isTextAnnotationObject(active))
        return;
    const textObject = active;
    if (textObject.isEditing !== true)
        return;
    textObject.imageEditorTextEditingCancel = !options.commit;
    (_a = textObject.exitEditing) === null || _a === void 0 ? void 0 : _a.call(textObject);
    context.canvas.requestRenderAll();
}
function attachTextEditingHandlersToAnnotations(context, annotations) {
    annotations.filter(isTextAnnotationObject).forEach((annotation) => {
        attachTextEditingHandlers(context, annotation);
    });
}

function colorWithOpacity(color, opacity) {
    const alpha = Math.max(0, Math.min(1, opacity));
    if (alpha >= 1)
        return color;
    if (/^#([0-9a-f]{6})$/i.test(color)) {
        const hex = color.slice(1);
        const r = Number.parseInt(hex.slice(0, 2), 16);
        const g = Number.parseInt(hex.slice(2, 4), 16);
        const b = Number.parseInt(hex.slice(4, 6), 16);
        return `rgba(${r},${g},${b},${alpha})`;
    }
    return color;
}
function configureBrush(context) {
    const config = context.getDrawConfig();
    const canvasWithBrush = context.canvas;
    canvasWithBrush.freeDrawingBrush = new context.fabric.PencilBrush(context.canvas);
    canvasWithBrush.freeDrawingBrush.width = config.brushSize;
    canvasWithBrush.freeDrawingBrush.color = colorWithOpacity(config.color, config.opacity);
    canvasWithBrush.freeDrawingBrush.strokeLineCap = config.lineCap;
    canvasWithBrush.freeDrawingBrush.strokeLineJoin = config.lineJoin;
}
function markPathAsDrawAnnotation(context, path) {
    const config = context.getDrawConfig();
    const annotationId = context.getAnnotationCounter() + 1;
    context.setAnnotationCounter(annotationId);
    path.set({
        selectable: config.selectable,
        evented: config.evented,
        opacity: config.opacity,
        stroke: config.color,
        strokeWidth: config.brushSize,
    });
    const annotation = markAnnotationObject(path, {
        annotationId,
        annotationType: 'draw',
        annotationName: `${context.options.drawAnnotationName}${annotationId}`,
        annotationHidden: config.annotationHidden,
        annotationLocked: config.annotationLocked,
    });
    syncAnnotationRuntimeState(annotation);
    return annotation;
}
function handlePathCreated(context, event) {
    const path = event.path;
    if (!path)
        return;
    const annotation = markPathAsDrawAnnotation(context, path);
    placeAnnotationObject(context.canvas, annotation);
    context.canvas.setActiveObject(annotation);
    context.canvas.renderAll();
    context.updateAnnotationList();
    context.saveCanvasState();
    const callbackContext = context.buildCallbackContext('enterDrawMode');
    context.emitAnnotationsChanged(callbackContext);
    context.emitImageChanged(callbackContext);
}
function enterDrawMode(context) {
    if (context.getDrawSession())
        return;
    if (!context.isImageLoaded())
        return;
    const { canvas } = context;
    const canvasWithDrawing = canvas;
    const previousDrawingMode = !!canvasWithDrawing.isDrawingMode;
    const previousBrush = canvasWithDrawing.freeDrawingBrush;
    const previousCanvasSelection = !!canvas.selection;
    const previousDefaultCursor = canvas.defaultCursor;
    canvas.selection = false;
    canvas.defaultCursor = 'crosshair';
    canvasWithDrawing.isDrawingMode = true;
    configureBrush(context);
    const callback = (event) => handlePathCreated(context, event);
    canvas.on('path:created', callback);
    const session = {
        mode: 'draw',
        previousDrawingMode,
        previousBrush,
        previousCanvasSelection,
        previousDefaultCursor,
        handlers: [{ eventName: 'path:created', callback }],
        dispose: () => {
            try {
                canvas.off('path:created', callback);
            }
            catch {
            }
            canvasWithDrawing.isDrawingMode = previousDrawingMode;
            canvasWithDrawing.freeDrawingBrush = previousBrush;
            canvas.selection = previousCanvasSelection;
            canvas.defaultCursor = previousDefaultCursor !== null && previousDefaultCursor !== void 0 ? previousDefaultCursor : 'default';
        },
    };
    context.setDrawSession(session);
    context.updateUi();
}
function exitDrawMode(context) {
    const session = context.getDrawSession();
    if (!session)
        return;
    session.dispose();
    context.setDrawSession(null);
    context.canvas.requestRenderAll();
    context.updateUi();
}
function updateDrawBrush(context) {
    if (!context.getDrawSession())
        return;
    configureBrush(context);
}

function fixPrototype(self, ctor) {
    Object.setPrototypeOf(self, ctor.prototype);
}
class ImageDecodeError extends Error {
    constructor(message = 'Failed to decode image data URL.', originalError = null) {
        super(message);
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'ImageDecodeError'
        });
        Object.defineProperty(this, "originalError", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.originalError = originalError;
        fixPrototype(this, ImageDecodeError);
    }
}
class ImageLoadTimeoutError extends Error {
    constructor(label, elapsedMs) {
        super(`Image load timed out after ${elapsedMs}ms during ${label}`);
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'ImageLoadTimeoutError'
        });
        Object.defineProperty(this, "label", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "elapsedMs", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.label = label;
        this.elapsedMs = elapsedMs;
        fixPrototype(this, ImageLoadTimeoutError);
    }
}
class DownsampleError extends Error {
    constructor(message = 'Failed to obtain a 2D context for downsampling.', originalError = null) {
        super(message);
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'DownsampleError'
        });
        Object.defineProperty(this, "originalError", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.originalError = originalError;
        fixPrototype(this, DownsampleError);
    }
}
class MergeMasksError extends Error {
    constructor(message = 'Failed to merge masks into the image.', originalError = null) {
        super(message);
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'MergeMasksError'
        });
        Object.defineProperty(this, "originalError", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.originalError = originalError;
        fixPrototype(this, MergeMasksError);
    }
}
class MergeAnnotationsError extends Error {
    constructor(message = 'Failed to merge annotations into the image.', originalError = null) {
        super(message);
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'MergeAnnotationsError'
        });
        Object.defineProperty(this, "originalError", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.originalError = originalError;
        fixPrototype(this, MergeAnnotationsError);
    }
}
class CropApplyError extends Error {
    constructor(message = 'Failed to apply crop to the image.', originalError = null) {
        super(message);
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'CropApplyError'
        });
        Object.defineProperty(this, "originalError", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.originalError = originalError;
        fixPrototype(this, CropApplyError);
    }
}
class ExportNotReadyError extends Error {
    constructor(operation = 'exportImageFile') {
        super(`Cannot ${operation}: no image is loaded on the canvas.`);
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'ExportNotReadyError'
        });
        Object.defineProperty(this, "operation", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.operation = operation;
        fixPrototype(this, ExportNotReadyError);
    }
}
class ExportError extends Error {
    constructor(message = 'Failed to export image.', originalError = null) {
        super(message);
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'ExportError'
        });
        Object.defineProperty(this, "originalError", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.originalError = originalError;
        fixPrototype(this, ExportError);
    }
}

const SELECTED_STROKE = '#ff0000';
const SELECTED_STROKE_WIDTH = 1;
const HOVER_STROKE = '#ff5500';
const HOVER_STROKE_WIDTH = 2;
const HOVER_OPACITY_BUMP = 0.2;
const DEFAULT_STROKE_FALLBACK = '#ccc';
const DEFAULT_STROKE_WIDTH_FALLBACK = 1;
const DEFAULT_ALPHA_FALLBACK = 0.5;
function getMaskNormalStyle(mask) {
    var _a;
    const strokeWidth = Number(mask.originalStrokeWidth);
    const opacity = Number(mask.originalAlpha);
    return {
        stroke: (_a = mask.originalStroke) !== null && _a !== void 0 ? _a : DEFAULT_STROKE_FALLBACK,
        strokeWidth: Number.isFinite(strokeWidth) ? strokeWidth : DEFAULT_STROKE_WIDTH_FALLBACK,
        opacity: Number.isFinite(opacity) ? opacity : DEFAULT_ALPHA_FALLBACK,
    };
}
function getMaskHoverStyle(mask) {
    const opacity = Number(mask.originalAlpha);
    const baseAlpha = Number.isFinite(opacity) ? opacity : DEFAULT_ALPHA_FALLBACK;
    return {
        stroke: HOVER_STROKE,
        strokeWidth: HOVER_STROKE_WIDTH,
        opacity: Math.min(baseAlpha + HOVER_OPACITY_BUMP, 1),
    };
}
function applyMaskSelectedStyle(mask) {
    mask.set({ stroke: SELECTED_STROKE, strokeWidth: SELECTED_STROKE_WIDTH });
}
function applyMaskUnselectedStyle(mask) {
    var _a;
    const strokeWidth = Number(mask.originalStrokeWidth);
    mask.set({
        stroke: (_a = mask.originalStroke) !== null && _a !== void 0 ? _a : DEFAULT_STROKE_FALLBACK,
        strokeWidth: Number.isFinite(strokeWidth) ? strokeWidth : DEFAULT_STROKE_WIDTH_FALLBACK,
    });
}
function attachMaskHoverHandlers(mask) {
    const tagged = mask;
    const mouseover = () => {
        var _a;
        tagged.set(getMaskHoverStyle(tagged));
        (_a = tagged.canvas) === null || _a === void 0 ? void 0 : _a.requestRenderAll();
    };
    const mouseout = () => {
        var _a;
        tagged.set(getMaskNormalStyle(tagged));
        (_a = tagged.canvas) === null || _a === void 0 ? void 0 : _a.requestRenderAll();
    };
    tagged.on('mouseover', mouseover);
    tagged.on('mouseout', mouseout);
    tagged.imageEditorMaskHandlers = { mouseover, mouseout };
}
function reattachMaskHoverHandlers(mask) {
    var _a;
    const tagged = mask;
    if (tagged.imageEditorMaskHandlers) {
        try {
            tagged.off('mouseover', tagged.imageEditorMaskHandlers.mouseover);
            tagged.off('mouseout', tagged.imageEditorMaskHandlers.mouseout);
        }
        catch {
        }
        delete tagged.imageEditorMaskHandlers;
    }
    const patch = {};
    if (!Number.isFinite(Number(tagged.originalAlpha))) {
        const opacity = Number(tagged.opacity);
        patch.originalAlpha = Number.isFinite(opacity) ? opacity : DEFAULT_ALPHA_FALLBACK;
    }
    if (tagged.originalStroke == null) {
        patch.originalStroke = (_a = tagged.stroke) !== null && _a !== void 0 ? _a : DEFAULT_STROKE_FALLBACK;
    }
    if (!Number.isFinite(Number(tagged.originalStrokeWidth))) {
        const sw = Number(tagged.strokeWidth);
        patch.originalStrokeWidth = Number.isFinite(sw) ? sw : DEFAULT_STROKE_WIDTH_FALLBACK;
    }
    if (Object.keys(patch).length > 0)
        tagged.set(patch);
    attachMaskHoverHandlers(tagged);
}
function detachMaskHoverHandlers(mask) {
    const tagged = mask;
    if (!tagged.imageEditorMaskHandlers)
        return;
    try {
        tagged.off('mouseover', tagged.imageEditorMaskHandlers.mouseover);
        tagged.off('mouseout', tagged.imageEditorMaskHandlers.mouseout);
    }
    catch {
    }
    delete tagged.imageEditorMaskHandlers;
}
function captureMaskStyleBackup(mask) {
    var _a, _b, _c, _d, _e, _f, _g;
    return {
        object: mask,
        opacity: (_a = mask.opacity) !== null && _a !== void 0 ? _a : 1,
        fill: ((_b = mask.fill) !== null && _b !== void 0 ? _b : null),
        strokeWidth: (_c = mask.strokeWidth) !== null && _c !== void 0 ? _c : 0,
        stroke: ((_d = mask.stroke) !== null && _d !== void 0 ? _d : null),
        selectable: (_e = mask.selectable) !== null && _e !== void 0 ? _e : true,
        evented: (_f = mask.evented) !== null && _f !== void 0 ? _f : true,
        lockRotation: (_g = mask.lockRotation) !== null && _g !== void 0 ? _g : false,
    };
}
function restoreMaskStyleBackup(backup) {
    try {
        backup.object.set({
            opacity: backup.opacity,
            fill: backup.fill,
            strokeWidth: backup.strokeWidth,
            stroke: backup.stroke,
            selectable: backup.selectable,
            evented: backup.evented,
            lockRotation: backup.lockRotation,
        });
        if (typeof backup.object.setCoords === 'function') {
            backup.object.setCoords();
        }
    }
    catch {
    }
}
async function withMaskStyleBackup(context, mutator, callback) {
    if (!context.canvas)
        return await callback();
    const masks = context.canvas.getObjects().filter(isMaskObject);
    const backups = masks.map(captureMaskStyleBackup);
    try {
        masks.forEach((mask, index) => mutator(mask, index));
        return await callback();
    }
    finally {
        for (const backup of backups)
            restoreMaskStyleBackup(backup);
    }
}
function applyCropHideMaskStyle(mask) {
    try {
        mask.set({ opacity: 0, evented: false, selectable: false });
    }
    catch {
    }
}

const CROP_RECT_FILL = 'rgba(0,0,0,0.12)';
const CROP_RECT_STROKE = '#00aaff';
const CROP_RECT_DASH = [6, 4];
const CROP_RECT_CORNER_SIZE = 8;
const CROP_DEFAULT_PADDING = 10;
const CROPPED_EXPORT_QUALITY_FALLBACK = 0.92;
function finiteNumberOrFallback(value, fallback) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
}
function imageMimeToFormat(mimeType) {
    if (mimeType === 'image/jpeg')
        return 'jpeg';
    if (mimeType === 'image/png')
        return 'png';
    if (mimeType === 'image/webp')
        return 'webp';
    return null;
}
function resolveLossyCropQuality(cropExportQuality, downsampleQuality) {
    const cropQuality = Number(cropExportQuality);
    if (Number.isFinite(cropQuality)) {
        return clampQuality(cropQuality, CROPPED_EXPORT_QUALITY_FALLBACK);
    }
    const fallbackQuality = Number(downsampleQuality);
    if (Number.isFinite(fallbackQuality)) {
        return clampQuality(fallbackQuality, CROPPED_EXPORT_QUALITY_FALLBACK);
    }
    return CROPPED_EXPORT_QUALITY_FALLBACK;
}
function resolveCropExportFormat(input) {
    var _a, _b;
    const requested = input.cropExportFileType;
    const format = requested === undefined || requested === null || requested === 'source'
        ? ((_a = imageMimeToFormat(input.currentImageMimeType)) !== null && _a !== void 0 ? _a : 'png')
        : ((_b = tryNormalizeImageFormat(String(requested))) !== null && _b !== void 0 ? _b : 'png');
    const mimeType = mimeTypeFor(format);
    if (format === 'png')
        return { format, mimeType };
    return {
        format,
        mimeType,
        quality: resolveLossyCropQuality(input.cropExportQuality, input.downsampleQuality),
    };
}
function getCropRectContentBounds(cropRect) {
    const angle = Number(cropRect.angle) || 0;
    const normalizedAngle = Math.abs(angle % 360);
    if (normalizedAngle > 0.01 && Math.abs(normalizedAngle - 360) > 0.01) {
        return getObjectBBox(cropRect);
    }
    return {
        left: Number(cropRect.left) || 0,
        top: Number(cropRect.top) || 0,
        width: Math.max(0, (Number(cropRect.width) || 0) * Math.abs(Number(cropRect.scaleX) || 1)),
        height: Math.max(0, (Number(cropRect.height) || 0) * Math.abs(Number(cropRect.scaleY) || 1)),
    };
}
function removeCropRect(context, session) {
    for (const targetHandlers of session.handlers) {
        for (const record of targetHandlers.handlers) {
            try {
                targetHandlers.target.off(record.eventName, record.callback);
            }
            catch {
            }
        }
    }
    session.handlers = [];
    if (session.cropRect) {
        try {
            context.canvas.remove(session.cropRect);
        }
        catch {
        }
        session.cropRect = null;
    }
}
function restoreCropObjectState(session) {
    for (const record of session.prevEvented) {
        try {
            record.object.set({ evented: record.evented, selectable: record.selectable });
        }
        catch {
        }
    }
    session.prevEvented = [];
}
function restoreCropMaskBackups(session) {
    for (const backup of session.maskBackups) {
        restoreMaskStyleBackup(backup);
    }
    session.maskBackups = [];
}
function teardownSession(context, session) {
    removeCropRect(context, session);
    restoreCropObjectState(session);
    restoreCropMaskBackups(session);
    try {
        context.canvas.selection = !!session.prevSelection;
    }
    catch {
    }
}
function maskIntersectsRegion(mask, region) {
    const bbox = getObjectBBox(mask);
    return (bbox.left < region.left + region.width &&
        bbox.left + bbox.width > region.left &&
        bbox.top < region.top + region.height &&
        bbox.top + bbox.height > region.top);
}
function capturePreservedMasks(canvas, cropRegion, maskBackups = []) {
    var _a;
    const records = [];
    const styleBackupByMask = maskBackups.length > 0
        ? new Map(maskBackups.map((backup) => [backup.object, backup]))
        : null;
    const masks = canvas.getObjects().filter(isMaskObject);
    for (const mask of masks) {
        try {
            mask.setCoords();
            const intersects = maskIntersectsRegion(mask, cropRegion);
            if (intersects) {
                const styleBackup = (_a = styleBackupByMask === null || styleBackupByMask === void 0 ? void 0 : styleBackupByMask.get(mask)) !== null && _a !== void 0 ? _a : captureMaskStyleBackup(mask);
                records.push({
                    mask,
                    left: finiteNumberOrFallback(mask.left, 0),
                    top: finiteNumberOrFallback(mask.top, 0),
                    angle: finiteNumberOrFallback(mask.angle, 0),
                    scaleX: finiteNumberOrFallback(mask.scaleX, 1),
                    scaleY: finiteNumberOrFallback(mask.scaleY, 1),
                    styleBackup,
                });
            }
            canvas.remove(mask);
        }
        catch {
        }
    }
    return records;
}
function reapplyPreservedMasks(context, cropRegion, records) {
    var _a;
    if (records.length === 0)
        return;
    const { canvas } = context;
    let maxRestoredId = 0;
    for (const record of records) {
        try {
            restoreMaskStyleBackup(record.styleBackup);
            record.mask.set({
                left: record.left - cropRegion.left,
                top: record.top - cropRegion.top,
                angle: record.angle,
                scaleX: record.scaleX,
                scaleY: record.scaleY,
                visible: true,
            });
            record.mask.setCoords();
            canvas.add(record.mask);
            canvas.bringObjectToFront(record.mask);
            reattachMaskHoverHandlers(record.mask);
            const id = Number(record.mask.maskId);
            if (Number.isFinite(id) && id > maxRestoredId)
                maxRestoredId = id;
        }
        catch {
        }
    }
    if (typeof context.getMaskCounter === 'function' &&
        typeof context.setMaskCounter === 'function') {
        const liveCounter = Number(context.getMaskCounter());
        const safeCounter = Number.isFinite(liveCounter) ? liveCounter : 0;
        context.setMaskCounter(Math.max(safeCounter, maxRestoredId));
    }
    try {
        (_a = context.updateMaskList) === null || _a === void 0 ? void 0 : _a.call(context);
    }
    catch {
    }
}
const CROP_ASPECT_RATIO_PRESETS = Object.freeze({
    free: null,
    '1:1': 1,
    '3:4': 3 / 4,
    '4:3': 4 / 3,
    '3:2': 3 / 2,
    '2:3': 2 / 3,
    '9:16': 9 / 16,
    '16:9': 16 / 9,
});
function normalizeCropAspectRatio(input) {
    var _a;
    if (input === null || input === undefined)
        return null;
    if (typeof input === 'number') {
        return Number.isFinite(input) && input > 0 ? input : null;
    }
    if (typeof input === 'string') {
        const trimmed = input.trim();
        if (Object.prototype.hasOwnProperty.call(CROP_ASPECT_RATIO_PRESETS, trimmed)) {
            return (_a = CROP_ASPECT_RATIO_PRESETS[trimmed]) !== null && _a !== void 0 ? _a : null;
        }
        const parts = trimmed.split(':');
        if (parts.length !== 2)
            return null;
        const width = Number(parts[0]);
        const height = Number(parts[1]);
        return Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0
            ? width / height
            : null;
    }
    if (typeof input === 'object') {
        const width = Number(input.width);
        const height = Number(input.height);
        return Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0
            ? width / height
            : null;
    }
    return null;
}
function fitAspectRatioInside(maxWidth, maxHeight, aspectRatio) {
    const safeMaxWidth = Math.max(1, maxWidth);
    const safeMaxHeight = Math.max(1, maxHeight);
    let width = safeMaxWidth;
    let height = width / aspectRatio;
    if (height > safeMaxHeight) {
        height = safeMaxHeight;
        width = height * aspectRatio;
    }
    return {
        width: Math.max(1, width),
        height: Math.max(1, height),
    };
}
function minimumAspectRatioSizeThatFits(minWidth, minHeight, maxWidth, maxHeight, aspectRatio) {
    let width = Math.max(1, minWidth);
    let height = width / aspectRatio;
    if (height < minHeight) {
        height = Math.max(1, minHeight);
        width = height * aspectRatio;
    }
    return width <= maxWidth && height <= maxHeight ? { width, height } : null;
}
function chooseAspectRatioResizeBasis(canvas, cropRect, scaleX, scaleY) {
    var _a, _b, _c;
    const corner = String((_c = (_a = cropRect.__corner) !== null && _a !== void 0 ? _a : (_b = canvas._currentTransform) === null || _b === void 0 ? void 0 : _b.corner) !== null && _c !== void 0 ? _c : '').toLowerCase();
    if (corner === 'mt' || corner === 'mb')
        return 'height';
    if (corner === 'ml' || corner === 'mr')
        return 'width';
    return Math.abs(scaleY - 1) > Math.abs(scaleX - 1) ? 'height' : 'width';
}
function constrainAspectRatioSize(requestedWidth, requestedHeight, basis, aspectRatio, minWidth, minHeight, maxWidth, maxHeight) {
    var _a;
    const maxSize = fitAspectRatioInside(maxWidth, maxHeight, aspectRatio);
    const minSize = (_a = minimumAspectRatioSizeThatFits(minWidth, minHeight, maxSize.width, maxSize.height, aspectRatio)) !== null && _a !== void 0 ? _a : maxSize;
    let width = basis === 'height' ? requestedHeight * aspectRatio : requestedWidth;
    let height = basis === 'height' ? requestedHeight : requestedWidth / aspectRatio;
    if (width > maxSize.width || height > maxSize.height) {
        ({ width, height } = maxSize);
    }
    if (width < minSize.width || height < minSize.height) {
        ({ width, height } = minSize);
    }
    return { width, height };
}
function resolvePaddedCropArea(boundsLeft, boundsTop, maxCropWidth, maxCropHeight, padding) {
    const insetX = padding * 2 < maxCropWidth ? padding : 0;
    const insetY = padding * 2 < maxCropHeight ? padding : 0;
    return {
        left: boundsLeft + insetX,
        top: boundsTop + insetY,
        width: Math.max(1, maxCropWidth - insetX * 2),
        height: Math.max(1, maxCropHeight - insetY * 2),
    };
}
function resolveCropBounds(context) {
    const originalImage = context.getOriginalImage();
    if (!originalImage)
        return null;
    originalImage.setCoords();
    const { options } = context;
    const imageBounds = originalImage.getBoundingRect();
    const padding = Number.isFinite(Number(options.crop.padding))
        ? Number(options.crop.padding)
        : CROP_DEFAULT_PADDING;
    const boundsLeft = Math.max(0, Math.floor(imageBounds.left));
    const boundsTop = Math.max(0, Math.floor(imageBounds.top));
    const maxCropWidth = Math.max(1, Math.floor(imageBounds.width));
    const maxCropHeight = Math.max(1, Math.floor(imageBounds.height));
    const configuredMinWidth = Math.max(1, Number(options.crop.minWidth) || 1);
    const configuredMinHeight = Math.max(1, Number(options.crop.minHeight) || 1);
    return {
        boundsLeft,
        boundsTop,
        maxCropWidth,
        maxCropHeight,
        minCropWidth: Math.min(configuredMinWidth, maxCropWidth),
        minCropHeight: Math.min(configuredMinHeight, maxCropHeight),
        padding,
        imageBounds,
    };
}
function clampCropRectIntoBounds(cropRect, bounds) {
    const width = Math.min(bounds.maxCropWidth, Math.max(bounds.minCropWidth, (Number(cropRect.width) || 1) * (Number(cropRect.scaleX) || 1)));
    const height = Math.min(bounds.maxCropHeight, Math.max(bounds.minCropHeight, (Number(cropRect.height) || 1) * (Number(cropRect.scaleY) || 1)));
    const left = Math.min(bounds.boundsLeft + bounds.maxCropWidth - width, Math.max(bounds.boundsLeft, Number(cropRect.left) || bounds.boundsLeft));
    const top = Math.min(bounds.boundsTop + bounds.maxCropHeight - height, Math.max(bounds.boundsTop, Number(cropRect.top) || bounds.boundsTop));
    cropRect.set({ left, top, width, height, scaleX: 1, scaleY: 1 });
}
function resizeCropRectToAspectRatio(context, cropRect, aspectRatio) {
    const bounds = resolveCropBounds(context);
    if (!bounds)
        return;
    if (aspectRatio === null) {
        clampCropRectIntoBounds(cropRect, bounds);
        cropRect.setCoords();
        return;
    }
    const available = resolvePaddedCropArea(bounds.boundsLeft, bounds.boundsTop, bounds.maxCropWidth, bounds.maxCropHeight, bounds.padding);
    const fitted = fitAspectRatioInside(available.width, available.height, aspectRatio);
    cropRect.set({
        left: available.left + (available.width - fitted.width) / 2,
        top: available.top + (available.height - fitted.height) / 2,
        width: fitted.width,
        height: fitted.height,
        scaleX: 1,
        scaleY: 1,
    });
    cropRect.setCoords();
}
function updateCropRectControlVisibility(cropRect, aspectRatio, allowRotationOfCropRect) {
    const lockedRatio = aspectRatio !== null;
    cropRect.setControlsVisibility({
        tl: true,
        tr: true,
        br: true,
        bl: true,
        mt: !lockedRatio,
        mb: !lockedRatio,
        ml: !lockedRatio,
        mr: !lockedRatio,
        mtr: allowRotationOfCropRect,
    });
    cropRect.setCoords();
}
function enterCropMode(context, cropModeOptions = {}) {
    var _a;
    const { canvas, options } = context;
    if (context.getCropSession())
        return;
    const originalImage = context.getOriginalImage();
    if (!originalImage)
        return;
    if (!context.isImageLoaded())
        return;
    canvas.discardActiveObject();
    const beforeJson = context.saveState();
    const prevSelection = !!canvas.selection;
    canvas.selection = false;
    originalImage.setCoords();
    const imageBounds = originalImage.getBoundingRect();
    const padding = Number.isFinite(Number(options.crop.padding))
        ? Number(options.crop.padding)
        : CROP_DEFAULT_PADDING;
    const boundsLeft = Math.max(0, Math.floor(imageBounds.left));
    const boundsTop = Math.max(0, Math.floor(imageBounds.top));
    const maxCropWidth = Math.max(1, Math.floor(imageBounds.width));
    const maxCropHeight = Math.max(1, Math.floor(imageBounds.height));
    const configuredMinWidth = Math.max(1, Number(options.crop.minWidth) || 1);
    const configuredMinHeight = Math.max(1, Number(options.crop.minHeight) || 1);
    const minCropWidth = Math.min(configuredMinWidth, maxCropWidth);
    const minCropHeight = Math.min(configuredMinHeight, maxCropHeight);
    const allowRotation = !!options.crop.allowRotationOfCropRect;
    const aspectRatio = normalizeCropAspectRatio((_a = cropModeOptions.aspectRatio) !== null && _a !== void 0 ? _a : options.crop.aspectRatio);
    let rectLeft;
    let rectTop;
    let rectWidth;
    let rectHeight;
    if (aspectRatio === null) {
        rectLeft = Math.min(boundsLeft + maxCropWidth - 1, Math.max(boundsLeft, Math.floor(imageBounds.left + padding)));
        rectTop = Math.min(boundsTop + maxCropHeight - 1, Math.max(boundsTop, Math.floor(imageBounds.top + padding)));
        rectWidth = minCropWidth;
        rectHeight = minCropHeight;
    }
    else {
        const available = resolvePaddedCropArea(boundsLeft, boundsTop, maxCropWidth, maxCropHeight, padding);
        const fitted = fitAspectRatioInside(available.width, available.height, aspectRatio);
        rectWidth = fitted.width;
        rectHeight = fitted.height;
        rectLeft = available.left + (available.width - rectWidth) / 2;
        rectTop = available.top + (available.height - rectHeight) / 2;
    }
    const cropRect = new context.fabric.Rect({
        left: rectLeft,
        top: rectTop,
        width: rectWidth,
        height: rectHeight,
        originX: 'left',
        originY: 'top',
        fill: CROP_RECT_FILL,
        stroke: CROP_RECT_STROKE,
        strokeDashArray: CROP_RECT_DASH,
        strokeWidth: 1,
        strokeUniform: true,
        selectable: true,
        lockRotation: !allowRotation,
        cornerSize: CROP_RECT_CORNER_SIZE,
        objectCaching: false,
        lockScalingFlip: true,
    });
    updateCropRectControlVisibility(cropRect, aspectRatio, allowRotation);
    canvas.add(cropRect);
    markSessionObject(cropRect, 'cropRect');
    cropRect.isCropRect = true;
    canvas.bringObjectToFront(cropRect);
    canvas.setActiveObject(cropRect);
    const hideMasks = !!options.crop.hideMasksDuringCrop;
    const maskBackups = [];
    if (hideMasks) {
        canvas.getObjects().forEach((object) => {
            if (object === cropRect)
                return;
            if (!isMaskObject(object))
                return;
            maskBackups.push(captureMaskStyleBackup(object));
        });
    }
    const prevEvented = [];
    canvas.getObjects().forEach((object) => {
        var _a, _b;
        if (object === cropRect)
            return;
        prevEvented.push({
            object,
            evented: (_a = object.evented) !== null && _a !== void 0 ? _a : true,
            selectable: (_b = object.selectable) !== null && _b !== void 0 ? _b : true,
        });
        try {
            object.set({ evented: false, selectable: false });
        }
        catch {
        }
    });
    if (hideMasks) {
        for (const backup of maskBackups) {
            applyCropHideMaskStyle(backup.object);
        }
    }
    const handleCropRectModified = () => {
        try {
            const cropWidth = Math.max(1, Number(cropRect.width) || 1);
            const cropHeight = Math.max(1, Number(cropRect.height) || 1);
            let nextScaleX;
            let nextScaleY;
            const activeSession = context.getCropSession();
            const activeAspectRatio = activeSession ? activeSession.aspectRatio : aspectRatio;
            if (activeAspectRatio === null) {
                nextScaleX = Math.min(maxCropWidth / cropWidth, Math.max(minCropWidth / cropWidth, Number(cropRect.scaleX) || 1));
                nextScaleY = Math.min(maxCropHeight / cropHeight, Math.max(minCropHeight / cropHeight, Number(cropRect.scaleY) || 1));
            }
            else {
                const rawScaleX = Math.max(0.0001, Number(cropRect.scaleX) || 1);
                const rawScaleY = Math.max(0.0001, Number(cropRect.scaleY) || 1);
                const basis = chooseAspectRatioResizeBasis(canvas, cropRect, rawScaleX, rawScaleY);
                const constrained = constrainAspectRatioSize(cropWidth * rawScaleX, cropHeight * rawScaleY, basis, activeAspectRatio, minCropWidth, minCropHeight, maxCropWidth, maxCropHeight);
                nextScaleX = constrained.width / cropWidth;
                nextScaleY = constrained.height / cropHeight;
            }
            const scaledWidth = cropWidth * nextScaleX;
            const scaledHeight = cropHeight * nextScaleY;
            const maxLeft = Math.max(boundsLeft, boundsLeft + maxCropWidth - scaledWidth);
            const maxTop = Math.max(boundsTop, boundsTop + maxCropHeight - scaledHeight);
            const nextLeft = Math.min(maxLeft, Math.max(boundsLeft, Number(cropRect.left) || boundsLeft));
            const nextTop = Math.min(maxTop, Math.max(boundsTop, Number(cropRect.top) || boundsTop));
            cropRect.set({
                left: nextLeft,
                top: nextTop,
                scaleX: nextScaleX,
                scaleY: nextScaleY,
            });
            cropRect.setCoords();
            canvas.requestRenderAll();
        }
        catch {
        }
    };
    cropRect.on('modified', handleCropRectModified);
    cropRect.on('moving', handleCropRectModified);
    cropRect.on('scaling', handleCropRectModified);
    const session = {
        beforeJson,
        prevSelection,
        prevEvented,
        maskBackups,
        cropRect,
        aspectRatio,
        handlers: [
            {
                target: cropRect,
                handlers: [
                    { eventName: 'modified', callback: handleCropRectModified },
                    { eventName: 'moving', callback: handleCropRectModified },
                    { eventName: 'scaling', callback: handleCropRectModified },
                ],
            },
        ],
    };
    context.setCropSession(session);
    canvas.renderAll();
}
function setCropAspectRatio(context, aspectRatioInput) {
    const session = context.getCropSession();
    if (!(session === null || session === void 0 ? void 0 : session.cropRect))
        return;
    const aspectRatio = normalizeCropAspectRatio(aspectRatioInput);
    session.aspectRatio = aspectRatio;
    resizeCropRectToAspectRatio(context, session.cropRect, aspectRatio);
    updateCropRectControlVisibility(session.cropRect, aspectRatio, !!context.options.crop.allowRotationOfCropRect);
    context.canvas.setActiveObject(session.cropRect);
    context.canvas.requestRenderAll();
}
function cancelCrop(context) {
    const session = context.getCropSession();
    if (!session)
        return;
    context.canvas.discardActiveObject();
    teardownSession(context, session);
    context.setCropSession(null);
    try {
        context.canvas.renderAll();
    }
    catch {
    }
}
async function applyCrop(context) {
    var _a, _b;
    const session = context.getCropSession();
    if (!session || !session.cropRect)
        return;
    const { canvas } = context;
    canvas.discardActiveObject();
    const beforeJson = session.beforeJson;
    const cropRect = session.cropRect;
    const preserveMasks = !!context.options.crop.preserveMasksAfterCrop;
    try {
        cropRect.setCoords();
        const cropAngle = Number(cropRect.angle) || 0;
        if (!context.options.crop.allowRotationOfCropRect && Math.abs(cropAngle % 360) > 0.01) {
            throw new CropApplyError('applyCrop failed: rotated crop rectangles are disabled.');
        }
        const rectBounds = getCropRectContentBounds(cropRect);
        if (!hasMeaningfulCanvasRegion(rectBounds, canvas.getWidth(), canvas.getHeight())) {
            throw new CropApplyError('applyCrop failed: crop region is empty or outside the canvas.');
        }
        const cropRegion = getClampedCanvasRegion(rectBounds, canvas.getWidth(), canvas.getHeight(), { includePartialPixels: false });
        const preservedRecords = preserveMasks
            ? capturePreservedMasks(canvas, cropRegion, session.maskBackups)
            : [];
        restoreCropObjectState(session);
        removeCropRect(context, session);
        canvas.selection = !!session.prevSelection;
        const cropFormat = resolveCropExportFormat({
            cropExportFileType: context.options.crop.exportFileType,
            currentImageMimeType: (_b = (_a = context.getCurrentImageMimeType) === null || _a === void 0 ? void 0 : _a.call(context)) !== null && _b !== void 0 ? _b : null,
            cropExportQuality: context.options.crop.exportQuality,
            downsampleQuality: context.options.downsampleQuality,
        });
        const exportOptions = {
            format: cropFormat.format,
            multiplier: 1,
            left: cropRegion.left,
            top: cropRegion.top,
            width: cropRegion.width,
            height: cropRegion.height,
        };
        if (cropFormat.quality !== undefined) {
            exportOptions.quality = cropFormat.quality;
        }
        const croppedBase64 = canvas.toDataURL(exportOptions);
        await context.loadImage(croppedBase64);
        if (preservedRecords.length > 0) {
            reapplyPreservedMasks(context, cropRegion, preservedRecords);
            canvas.renderAll();
        }
        const afterJson = context.saveState();
        context.setCropSession(null);
        if (beforeJson && afterJson && beforeJson !== afterJson) {
            context.historyManager.push(new Command(() => context.loadFromState(afterJson), () => context.loadFromState(beforeJson)));
        }
    }
    catch (error) {
        teardownSession(context, session);
        context.setCropSession(null);
        try {
            await context.loadFromState(beforeJson);
        }
        catch (rollbackError) {
            console.warn('[ImageEditor] applyCrop: rollback failed', rollbackError);
        }
        if (error instanceof CropApplyError)
            throw error;
        const message = error instanceof Error ? `applyCrop failed: ${error.message}` : 'applyCrop failed';
        throw new CropApplyError(message, error);
    }
}

function computeDownsampleDimensions(srcWidth, srcHeight, maxWidth, maxHeight) {
    if (!isPositiveFinite$1(srcWidth) ||
        !isPositiveFinite$1(srcHeight) ||
        !isPositiveFinite$1(maxWidth) ||
        !isPositiveFinite$1(maxHeight)) {
        return {
            width: Math.max(1, Math.round(srcWidth) || 1),
            height: Math.max(1, Math.round(srcHeight) || 1),
            needsResize: false,
        };
    }
    const needsResize = srcWidth > maxWidth || srcHeight > maxHeight;
    if (!needsResize) {
        return { width: srcWidth, height: srcHeight, needsResize: false };
    }
    const ratio = Math.min(maxWidth / srcWidth, maxHeight / srcHeight);
    return {
        width: Math.max(1, Math.round(srcWidth * ratio)),
        height: Math.max(1, Math.round(srcHeight * ratio)),
        needsResize: true,
    };
}
function isPositiveFinite$1(value) {
    return Number.isFinite(value) && value > 0;
}
function selectDownsampleMimeType(sourceMime, preserveSourceFormat, downsampleMimeType) {
    if (downsampleMimeType)
        return downsampleMimeType;
    if (preserveSourceFormat && (sourceMime === 'image/png' || sourceMime === 'image/webp')) {
        return sourceMime;
    }
    return 'image/jpeg';
}
function detectSourceMimeType(dataUrl) {
    const match = /^data:(image\/[a-z0-9+\-.]+)\s*;/i.exec(dataUrl);
    return match ? match[1].toLowerCase() : null;
}
function resampleImage(imageElement, maxWidth, maxHeight, sourceMime, preserveSourceFormat, downsampleMimeType, quality, ownerDocument) {
    var _a;
    const { width, height } = computeDownsampleDimensions(imageElement.naturalWidth, imageElement.naturalHeight, maxWidth, maxHeight);
    const mimeType = selectDownsampleMimeType(sourceMime, preserveSourceFormat, downsampleMimeType);
    const documentForCanvas = (_a = ownerDocument !== null && ownerDocument !== void 0 ? ownerDocument : imageElement.ownerDocument) !== null && _a !== void 0 ? _a : (typeof document !== 'undefined' ? document : null);
    if (!documentForCanvas) {
        throw new DownsampleError('Failed to obtain an owner document for downsampling.');
    }
    const offscreenCanvas = documentForCanvas.createElement('canvas');
    offscreenCanvas.width = width;
    offscreenCanvas.height = height;
    const context = offscreenCanvas.getContext('2d');
    if (!context) {
        throw new DownsampleError('Failed to obtain a 2D context for downsampling.');
    }
    context.drawImage(imageElement, 0, 0, imageElement.naturalWidth, imageElement.naturalHeight, 0, 0, width, height);
    const dataUrl = mimeType === 'image/png'
        ? offscreenCanvas.toDataURL(mimeType)
        : offscreenCanvas.toDataURL(mimeType, quality);
    return { dataUrl, width, height, mimeType };
}

function withTimeout(promise, ms, label) {
    return new Promise((resolve, reject) => {
        const start = Date.now();
        const timeoutId = setTimeout(() => {
            reject(new ImageLoadTimeoutError(label, Date.now() - start));
        }, ms);
        promise.then((value) => {
            clearTimeout(timeoutId);
            resolve(value);
        }, (err) => {
            clearTimeout(timeoutId);
            reject(err);
        });
    });
}

const MATRIX_DETERMINANT_EPSILON = 1e-8;
const MATRIX_SCALE_EPSILON = 1e-8;
function toMatrix2D(matrix) {
    if (matrix.length < 6)
        return null;
    const a = matrix[0];
    const b = matrix[1];
    const c = matrix[2];
    const d = matrix[3];
    const e = matrix[4];
    const f = matrix[5];
    if (!Number.isFinite(a) ||
        !Number.isFinite(b) ||
        !Number.isFinite(c) ||
        !Number.isFinite(d) ||
        !Number.isFinite(e) ||
        !Number.isFinite(f)) {
        return null;
    }
    return { a: a, b: b, c: c, d: d, e: e, f: f };
}
function invertMatrix(matrix) {
    const determinant = matrix.a * matrix.d - matrix.b * matrix.c;
    if (!Number.isFinite(determinant) || Math.abs(determinant) < MATRIX_DETERMINANT_EPSILON) {
        return null;
    }
    return {
        a: matrix.d / determinant,
        b: -matrix.b / determinant,
        c: -matrix.c / determinant,
        d: matrix.a / determinant,
        e: (matrix.c * matrix.f - matrix.d * matrix.e) / determinant,
        f: (matrix.b * matrix.e - matrix.a * matrix.f) / determinant,
    };
}
function transformPoint(point, matrix) {
    return {
        x: matrix.a * point.x + matrix.c * point.y + matrix.e,
        y: matrix.b * point.x + matrix.d * point.y + matrix.f,
    };
}
function getSourceRadiusFromMatrix(matrix, canvasRadius) {
    const scaleX = Math.hypot(matrix.a, matrix.b);
    const scaleY = Math.hypot(matrix.c, matrix.d);
    const minScale = Math.min(scaleX > MATRIX_SCALE_EPSILON ? scaleX : Number.POSITIVE_INFINITY, scaleY > MATRIX_SCALE_EPSILON ? scaleY : Number.POSITIVE_INFINITY);
    if (!Number.isFinite(minScale) || minScale <= 0)
        return canvasRadius;
    return canvasRadius / minScale;
}
function getMosaicImagePoint(fabric, image, canvasPoint, brushDiameterCanvasPx) {
    const width = Number(image.width) || 0;
    const height = Number(image.height) || 0;
    const brushDiameter = Number(brushDiameterCanvasPx);
    if (width <= 0 ||
        height <= 0 ||
        !Number.isFinite(canvasPoint.x) ||
        !Number.isFinite(canvasPoint.y) ||
        !Number.isFinite(brushDiameter) ||
        brushDiameter <= 0) {
        return null;
    }
    const matrix = toMatrix2D(image.calcTransformMatrix());
    if (!matrix)
        return null;
    const inverse = invertMatrix(matrix);
    if (!inverse)
        return null;
    const localPoint = transformPoint(canvasPoint, inverse);
    const sourceX = localPoint.x + width / 2;
    const sourceY = localPoint.y + height / 2;
    if (sourceX < 0 || sourceY < 0 || sourceX > width || sourceY > height) {
        return null;
    }
    return {
        sourceX,
        sourceY,
        sourceRadius: getSourceRadiusFromMatrix(matrix, brushDiameter / 2),
    };
}

function normalizeBlockSize(value) {
    return Number.isFinite(value) && value > 0 ? Math.max(1, Math.floor(value)) : 1;
}
function isInsideCircle(x, y, centerX, centerY, radiusSquared) {
    const dx = x - centerX;
    const dy = y - centerY;
    return dx * dx + dy * dy <= radiusSquared;
}
function pixelOffset(width, x, y) {
    return (y * width + x) * 4;
}
function applyCircularMosaicToImageData(options) {
    var _a, _b, _c, _d;
    const { imageData } = options;
    const { width, height, data } = imageData;
    const centerX = Number(options.centerX);
    const centerY = Number(options.centerY);
    const radius = Number(options.radius);
    if (!Number.isFinite(centerX) ||
        !Number.isFinite(centerY) ||
        !Number.isFinite(radius) ||
        radius <= 0 ||
        width <= 0 ||
        height <= 0) {
        return false;
    }
    const blockSize = normalizeBlockSize(options.blockSize);
    const minX = Math.max(0, Math.floor(centerX - radius));
    const maxX = Math.min(width - 1, Math.ceil(centerX + radius));
    const minY = Math.max(0, Math.floor(centerY - radius));
    const maxY = Math.min(height - 1, Math.ceil(centerY + radius));
    if (minX > maxX || minY > maxY)
        return false;
    const radiusSquared = radius * radius;
    let processed = false;
    for (let blockY = minY; blockY <= maxY; blockY += blockSize) {
        for (let blockX = minX; blockX <= maxX; blockX += blockSize) {
            const blockMaxX = Math.min(maxX, blockX + blockSize - 1);
            const blockMaxY = Math.min(maxY, blockY + blockSize - 1);
            let sampleOffset = -1;
            for (let y = blockY; y <= blockMaxY && sampleOffset < 0; y += 1) {
                for (let x = blockX; x <= blockMaxX; x += 1) {
                    if (!isInsideCircle(x, y, centerX, centerY, radiusSquared))
                        continue;
                    sampleOffset = pixelOffset(width, x, y);
                    break;
                }
            }
            if (sampleOffset < 0)
                continue;
            const red = (_a = data[sampleOffset]) !== null && _a !== void 0 ? _a : 0;
            const green = (_b = data[sampleOffset + 1]) !== null && _b !== void 0 ? _b : 0;
            const blue = (_c = data[sampleOffset + 2]) !== null && _c !== void 0 ? _c : 0;
            const alpha = (_d = data[sampleOffset + 3]) !== null && _d !== void 0 ? _d : 0;
            for (let y = blockY; y <= blockMaxY; y += 1) {
                for (let x = blockX; x <= blockMaxX; x += 1) {
                    if (!isInsideCircle(x, y, centerX, centerY, radiusSquared))
                        continue;
                    const offset = pixelOffset(width, x, y);
                    data[offset] = red;
                    data[offset + 1] = green;
                    data[offset + 2] = blue;
                    data[offset + 3] = alpha;
                    processed = true;
                }
            }
        }
    }
    return processed;
}

const MAX_PENDING_MOSAIC_POINTS = 4096;
function getCanvasDocument$2(context) {
    var _a, _b, _c, _d, _e;
    const element = (_b = (_a = context.canvas).getElement) === null || _b === void 0 ? void 0 : _b.call(_a);
    return ((_e = (_c = element === null || element === void 0 ? void 0 : element.ownerDocument) !== null && _c !== void 0 ? _c : (_d = context.canvas.lowerCanvasEl) === null || _d === void 0 ? void 0 : _d.ownerDocument) !== null && _e !== void 0 ? _e : document);
}
function safeRender(canvas) {
    try {
        canvas.requestRenderAll();
    }
    catch {
        try {
            canvas.renderAll();
        }
        catch {
        }
    }
}
function createPreviewCircle(context) {
    const config = context.getMosaicConfig();
    const circle = new context.fabric.Circle({
        left: 0,
        top: 0,
        radius: config.brushSize / 2,
        originX: 'center',
        originY: 'center',
        fill: config.previewFill,
        stroke: config.previewStroke,
        strokeWidth: config.previewStrokeWidth,
        strokeDashArray: config.previewStrokeDashArray
            ? [...config.previewStrokeDashArray]
            : undefined,
        selectable: false,
        evented: false,
        excludeFromExport: true,
        objectCaching: false,
        visible: false,
    });
    markSessionObject(circle, 'mosaicPreviewCircle');
    circle.isMosaicPreview = true;
    return circle;
}
function ensurePreviewCircle(context, session) {
    var _a;
    const { canvas } = context;
    const circle = (_a = session.previewCircle) !== null && _a !== void 0 ? _a : createPreviewCircle(context);
    session.previewCircle = circle;
    if (!canvas.getObjects().includes(circle)) {
        canvas.add(circle);
    }
    canvas.bringObjectToFront(circle);
    updateMosaicPreview(context);
    return circle;
}
function removePreviewCircle(context, session) {
    const circle = session.previewCircle;
    if (!circle)
        return;
    try {
        context.canvas.remove(circle);
    }
    catch {
    }
    session.previewCircle = null;
}
function createPreviewImage(context, sourceImage, rasterCache) {
    const image = new context.fabric.FabricImage(rasterCache.offscreenCanvas, {
        selectable: false,
        evented: false,
        excludeFromExport: true,
        objectCaching: false,
        visible: true,
    });
    copyBaseImageProperties(image, sourceImage);
    image.set({
        selectable: false,
        evented: false,
        excludeFromExport: true,
        objectCaching: false,
        visible: true,
    });
    markSessionObject(image, 'mosaicPreviewImage');
    image.isMosaicPreview = true;
    return image;
}
function placePreviewImageAfterBase(context, previewImage, sourceImage) {
    var _a, _b;
    const sourceIndex = context.canvas.getObjects().indexOf(sourceImage);
    if (sourceIndex < 0)
        return;
    try {
        (_b = (_a = context.canvas).moveObjectTo) === null || _b === void 0 ? void 0 : _b.call(_a, previewImage, sourceIndex + 1);
    }
    catch {
    }
}
function ensurePreviewImage(context, session, sourceImage) {
    var _a;
    const rasterCache = session.rasterCache;
    if (!rasterCache)
        return null;
    const previewImage = (_a = session.previewImage) !== null && _a !== void 0 ? _a : createPreviewImage(context, sourceImage, rasterCache);
    session.previewImage = previewImage;
    copyBaseImageProperties(previewImage, sourceImage);
    previewImage.set({
        selectable: false,
        evented: false,
        excludeFromExport: true,
        objectCaching: false,
        visible: true,
    });
    previewImage.dirty = true;
    if (!context.canvas.getObjects().includes(previewImage)) {
        context.canvas.add(previewImage);
    }
    placePreviewImageAfterBase(context, previewImage, sourceImage);
    const circle = session.previewCircle;
    if (circle && context.canvas.getObjects().includes(circle)) {
        context.canvas.bringObjectToFront(circle);
    }
    return previewImage;
}
function removePreviewImage(context, session) {
    const image = session.previewImage;
    if (!image)
        return;
    try {
        context.canvas.remove(image);
    }
    catch {
    }
    session.previewImage = null;
}
function releaseMosaicRasterCache(session) {
    const cache = session.rasterCache;
    if (!cache)
        return;
    try {
        cache.offscreenCanvas.width = 0;
        cache.offscreenCanvas.height = 0;
    }
    catch {
    }
    session.rasterCache = null;
}
function hidePreview(context) {
    var _a;
    const circle = (_a = context.getMosaicSession()) === null || _a === void 0 ? void 0 : _a.previewCircle;
    if (!circle)
        return;
    circle.set({ visible: false });
    safeRender(context.canvas);
}
function movePreview(context, point) {
    const session = context.getMosaicSession();
    if (!session)
        return;
    const circle = ensurePreviewCircle(context, session);
    circle.set({ left: point.x, top: point.y, visible: true });
    safeRender(context.canvas);
}
function attachCanvasHandler(context, session, eventName, callback) {
    context.canvas.on(eventName, callback);
    session.handlers.push({ eventName, callback });
}
function detachCanvasHandlers(context, session) {
    for (const record of session.handlers) {
        try {
            context.canvas.off(record.eventName, record.callback);
        }
        catch {
        }
    }
    session.handlers = [];
}
function restoreObjectStates(session) {
    for (const record of session.prevObjectStates) {
        try {
            record.object.set({ evented: record.evented, selectable: record.selectable });
        }
        catch {
        }
    }
    session.prevObjectStates = [];
}
function getImageSource(image) {
    var _a;
    const imageWithSource = image;
    try {
        const src = (_a = imageWithSource.getSrc) === null || _a === void 0 ? void 0 : _a.call(imageWithSource);
        if (typeof src === 'string' && src.length > 0)
            return src;
    }
    catch {
    }
    return typeof imageWithSource.src === 'string' && imageWithSource.src.length > 0
        ? imageWithSource.src
        : null;
}
function imageDimension(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : 0;
}
function decodeImageSource(ownerDocument, source) {
    return new Promise((resolve, reject) => {
        const imageElement = ownerDocument.createElement('img');
        const cleanup = () => {
            if (typeof imageElement.removeEventListener === 'function') {
                imageElement.removeEventListener('load', handleLoad);
                imageElement.removeEventListener('error', handleError);
            }
            else {
                imageElement.onload = null;
                imageElement.onerror = null;
            }
        };
        const handleLoad = () => {
            const width = imageDimension(imageElement.naturalWidth || imageElement.width);
            const height = imageDimension(imageElement.naturalHeight || imageElement.height);
            cleanup();
            if (width <= 0 || height <= 0) {
                reject(new Error('Mosaic image decode failed: source image has no dimensions.'));
                return;
            }
            resolve({ element: imageElement, width, height });
        };
        const handleError = (event) => {
            cleanup();
            const message = typeof event === 'string'
                ? `Mosaic image decode failed: ${event}`
                : 'Mosaic image decode failed.';
            reject(new Error(message));
        };
        if (!source.startsWith('data:')) {
            imageElement.crossOrigin = 'anonymous';
        }
        if (typeof imageElement.addEventListener === 'function') {
            imageElement.addEventListener('load', handleLoad, { once: true });
            imageElement.addEventListener('error', handleError, { once: true });
        }
        else {
            imageElement.onload = handleLoad;
            imageElement.onerror = handleError;
        }
        imageElement.src = source;
    });
}
function toSupportedMimeType(mimeType) {
    return mimeType === 'image/jpeg' || mimeType === 'image/png' || mimeType === 'image/webp'
        ? mimeType
        : null;
}
function mimeToFormat(mimeType) {
    if (mimeType === 'image/jpeg')
        return 'jpeg';
    if (mimeType === 'image/webp')
        return 'webp';
    return 'png';
}
function resolveMosaicOutputFormat(context, source) {
    var _a, _b, _c, _d;
    const config = context.getMosaicConfig();
    const requested = config.outputFileType;
    const format = requested === 'source'
        ? mimeToFormat((_b = (_a = context.getCurrentImageMimeType()) !== null && _a !== void 0 ? _a : toSupportedMimeType(detectSourceMimeType(source))) !== null && _b !== void 0 ? _b : 'image/png')
        : ((_c = tryNormalizeImageFormat(String(requested))) !== null && _c !== void 0 ? _c : 'png');
    const mimeType = mimeTypeFor(format);
    if (format === 'png')
        return { mimeType };
    return {
        mimeType,
        quality: (_d = config.outputQuality) !== null && _d !== void 0 ? _d : context.options.downsampleQuality,
    };
}
async function createFabricImageFromDataUrl(context, dataUrl) {
    return await withTimeout(context.fabric.FabricImage.fromURL(dataUrl, { crossOrigin: 'anonymous' }), context.options.imageLoadTimeoutMs, 'Mosaic FabricImage.fromURL');
}
function copyBaseImageProperties(target, source) {
    target.set({
        left: source.left,
        top: source.top,
        scaleX: source.scaleX,
        scaleY: source.scaleY,
        angle: source.angle,
        skewX: source.skewX,
        skewY: source.skewY,
        flipX: source.flipX,
        flipY: source.flipY,
        originX: source.originX,
        originY: source.originY,
        selectable: source.selectable,
        evented: source.evented,
        hasControls: source.hasControls,
        hoverCursor: source.hoverCursor,
    });
    target.setCoords();
}
function replaceBaseImage(context, oldImage, newImage, mimeType) {
    const { canvas } = context;
    let oldRemoved = false;
    let newAdded = false;
    try {
        copyBaseImageProperties(newImage, oldImage);
        canvas.remove(oldImage);
        oldRemoved = true;
        canvas.add(newImage);
        newAdded = true;
        canvas.sendObjectToBack(newImage);
        context.setOriginalImage(markBaseImageObject(newImage));
        context.setCurrentImageMimeType(mimeType);
        canvas.renderAll();
    }
    catch (error) {
        try {
            if (newAdded)
                canvas.remove(newImage);
            if (oldRemoved && !canvas.getObjects().includes(oldImage)) {
                canvas.add(oldImage);
                canvas.sendObjectToBack(oldImage);
            }
            context.setOriginalImage(oldImage);
        }
        catch {
        }
        throw error;
    }
}
function pushMosaicHistory(context, after) {
    var _a;
    const before = (_a = context.getLastSnapshot()) !== null && _a !== void 0 ? _a : after;
    if (!before || !after || before === after)
        return;
    context.historyManager.push(new Command(async () => {
        await context.loadFromState(after);
    }, async () => {
        await context.loadFromState(before);
    }));
    context.setLastSnapshot(after);
}
async function getOrCreateRasterCache(context, session, source) {
    if (session.rasterCache)
        return session.rasterCache;
    const ownerDocument = getCanvasDocument$2(context);
    const decoded = await decodeImageSource(ownerDocument, source);
    const offscreenCanvas = ownerDocument.createElement('canvas');
    offscreenCanvas.width = decoded.width;
    offscreenCanvas.height = decoded.height;
    const renderingContext = offscreenCanvas.getContext('2d');
    if (!renderingContext) {
        reportError(context.options, new Error('Mosaic could not obtain a 2D canvas context.'), 'Mosaic apply failed.');
        return null;
    }
    renderingContext.drawImage(decoded.element, 0, 0, decoded.width, decoded.height);
    let imageData;
    try {
        imageData = renderingContext.getImageData(0, 0, decoded.width, decoded.height);
    }
    catch (error) {
        reportError(context.options, error, 'Mosaic apply failed because the source image pixels could not be read.');
        return null;
    }
    const rasterCache = {
        offscreenCanvas,
        renderingContext,
        imageData,
        source,
        width: decoded.width,
        height: decoded.height,
    };
    session.rasterCache = rasterCache;
    return rasterCache;
}
function applyMosaicImagePoint(context, session, sourceImage, imagePoint) {
    const rasterCache = session.rasterCache;
    if (!rasterCache)
        return false;
    const config = context.getMosaicConfig();
    const previousPoint = session.lastImagePoint;
    const points = previousPoint
        ? interpolateMosaicPoints(previousPoint, imagePoint)
        : [imagePoint];
    let changed = false;
    for (const point of points) {
        changed =
            applyCircularMosaicToImageData({
                imageData: rasterCache.imageData,
                centerX: point.sourceX,
                centerY: point.sourceY,
                radius: point.sourceRadius,
                blockSize: config.blockSize,
            }) || changed;
    }
    session.lastImagePoint = imagePoint;
    if (changed) {
        session.hasUncommittedChanges = true;
        rasterCache.renderingContext.putImageData(rasterCache.imageData, 0, 0);
        ensurePreviewImage(context, session, sourceImage);
        safeRender(context.canvas);
    }
    return changed;
}
function interpolateMosaicPoints(start, end) {
    const dx = end.sourceX - start.sourceX;
    const dy = end.sourceY - start.sourceY;
    const distance = Math.hypot(dx, dy);
    const minRadius = Math.min(start.sourceRadius, end.sourceRadius);
    const spacing = Math.max(1, minRadius / 2);
    const steps = Math.max(1, Math.ceil(distance / spacing));
    const points = [];
    for (let index = 1; index <= steps; index += 1) {
        const t = index / steps;
        points.push({
            sourceX: start.sourceX + dx * t,
            sourceY: start.sourceY + dy * t,
            sourceRadius: start.sourceRadius + (end.sourceRadius - start.sourceRadius) * t,
        });
    }
    return points;
}
async function applyMosaicPointToCache(context, expectedSession, canvasPoint) {
    const session = context.getMosaicSession();
    if (!session || session !== expectedSession)
        return;
    const originalImage = context.getOriginalImage();
    if (!originalImage || !context.isImageLoaded())
        return;
    const config = context.getMosaicConfig();
    const imagePoint = getMosaicImagePoint(context.fabric, originalImage, canvasPoint, config.brushSize);
    if (!imagePoint) {
        session.lastImagePoint = null;
        return;
    }
    const source = getImageSource(originalImage);
    if (!source) {
        reportWarning(context.options, new Error('Mosaic cannot read the current image source.'), 'Mosaic skipped because the image source is unavailable.');
        return;
    }
    const rasterCache = await getOrCreateRasterCache(context, session, source);
    if (!rasterCache)
        return;
    applyMosaicImagePoint(context, session, originalImage, imagePoint);
}
async function commitMosaicChanges(context, session, callbackContext) {
    var _a;
    session.commitRequested = false;
    session.lastImagePoint = null;
    if (!session.hasUncommittedChanges || !session.rasterCache)
        return;
    const originalImage = context.getOriginalImage();
    if (!originalImage || !context.isImageLoaded())
        return;
    const source = (_a = getImageSource(originalImage)) !== null && _a !== void 0 ? _a : session.rasterCache.source;
    const rasterCache = session.rasterCache;
    rasterCache.renderingContext.putImageData(rasterCache.imageData, 0, 0);
    const output = resolveMosaicOutputFormat(context, source);
    const nextDataUrl = output.quality === undefined
        ? rasterCache.offscreenCanvas.toDataURL(output.mimeType)
        : rasterCache.offscreenCanvas.toDataURL(output.mimeType, output.quality);
    const nextImage = await createFabricImageFromDataUrl(context, nextDataUrl);
    removePreviewCircle(context, session);
    removePreviewImage(context, session);
    try {
        replaceBaseImage(context, originalImage, nextImage, output.mimeType);
        const after = context.captureSnapshot();
        pushMosaicHistory(context, after);
        rasterCache.source = nextDataUrl;
        session.hasUncommittedChanges = false;
    }
    finally {
        if (context.getMosaicSession() === session) {
            ensurePreviewCircle(context, session);
        }
    }
    context.updateInputs();
    context.updateUi();
    context.emitImageChanged(callbackContext);
}
async function drainMosaicQueue(context, expectedSession) {
    const session = context.getMosaicSession();
    if (!session || session !== expectedSession || session.isApplying)
        return;
    session.isApplying = true;
    const callbackContext = context.buildCallbackContext('applyMosaic', false);
    context.emitBusyChangeIfChanged(callbackContext);
    context.updateUi();
    try {
        while (context.getMosaicSession() === session && session.pendingCanvasPoints.length > 0) {
            const point = session.pendingCanvasPoints.shift();
            if (point) {
                await applyMosaicPointToCache(context, session, point);
            }
        }
        if (context.getMosaicSession() === session && session.commitRequested) {
            await commitMosaicChanges(context, session, callbackContext);
        }
    }
    finally {
        if (context.getMosaicSession() === session) {
            session.isApplying = false;
        }
        context.emitBusyChangeIfChanged(callbackContext);
        context.updateUi();
        if (context.getMosaicSession() === session &&
            (session.pendingCanvasPoints.length > 0 || session.commitRequested)) {
            void drainMosaicQueue(context, session).catch((error) => {
                reportError(context.options, error, 'Mosaic apply failed.');
            });
        }
    }
}
function enqueueMosaicPoint(context, canvasPoint) {
    const session = context.getMosaicSession();
    if (!session)
        return;
    session.pendingCanvasPoints.push(canvasPoint);
    if (session.pendingCanvasPoints.length > MAX_PENDING_MOSAIC_POINTS) {
        session.pendingCanvasPoints.splice(0, session.pendingCanvasPoints.length - MAX_PENDING_MOSAIC_POINTS);
    }
    void drainMosaicQueue(context, session).catch((error) => {
        reportError(context.options, error, 'Mosaic apply failed.');
    });
}
function requestMosaicCommit(context, session) {
    session.commitRequested = true;
    void drainMosaicQueue(context, session).catch((error) => {
        reportError(context.options, error, 'Mosaic apply failed.');
    });
}
function installMosaicHandlers(context, session) {
    attachCanvasHandler(context, session, 'mouse:move', (event) => {
        const pointer = getPointerFromFabricEvent(context.canvas, event);
        if (!pointer) {
            hidePreview(context);
            return;
        }
        movePreview(context, pointer);
        const currentSession = context.getMosaicSession();
        if (currentSession === null || currentSession === void 0 ? void 0 : currentSession.isPointerDown) {
            enqueueMosaicPoint(context, pointer);
        }
    });
    attachCanvasHandler(context, session, 'mouse:out', () => {
        hidePreview(context);
        const currentSession = context.getMosaicSession();
        if (currentSession === null || currentSession === void 0 ? void 0 : currentSession.isPointerDown) {
            currentSession.isPointerDown = false;
            requestMosaicCommit(context, currentSession);
        }
    });
    attachCanvasHandler(context, session, 'mouse:down', (event) => {
        const pointer = getPointerFromFabricEvent(context.canvas, event);
        if (!pointer)
            return;
        const currentSession = context.getMosaicSession();
        if (!currentSession)
            return;
        currentSession.isPointerDown = true;
        currentSession.lastImagePoint = null;
        enqueueMosaicPoint(context, pointer);
    });
    attachCanvasHandler(context, session, 'mouse:up', (event) => {
        const currentSession = context.getMosaicSession();
        if (!currentSession)
            return;
        const pointer = getPointerFromFabricEvent(context.canvas, event);
        if (pointer) {
            movePreview(context, pointer);
            enqueueMosaicPoint(context, pointer);
        }
        currentSession.isPointerDown = false;
        requestMosaicCommit(context, currentSession);
    });
}
function enterMosaicMode(context) {
    if (context.getMosaicSession())
        return;
    if (!context.isImageLoaded() || !context.getOriginalImage())
        return;
    const { canvas } = context;
    context.hideAllMaskLabels();
    canvas.discardActiveObject();
    const prevSelection = !!canvas.selection;
    const prevDefaultCursor = canvas.defaultCursor;
    const prevObjectStates = canvas.getObjects().map((object) => {
        var _a, _b;
        return ({
            object,
            evented: (_a = object.evented) !== null && _a !== void 0 ? _a : true,
            selectable: (_b = object.selectable) !== null && _b !== void 0 ? _b : true,
        });
    });
    for (const record of prevObjectStates) {
        try {
            record.object.set({ evented: false, selectable: false });
        }
        catch {
        }
    }
    canvas.selection = false;
    canvas.defaultCursor = 'crosshair';
    const session = {
        previewCircle: null,
        previewImage: null,
        prevSelection,
        prevDefaultCursor,
        prevObjectStates,
        handlers: [],
        rasterCache: null,
        pendingCanvasPoints: [],
        isPointerDown: false,
        isApplying: false,
        commitRequested: false,
        hasUncommittedChanges: false,
        lastImagePoint: null,
    };
    context.setMosaicSession(session);
    ensurePreviewCircle(context, session);
    installMosaicHandlers(context, session);
    canvas.renderAll();
}
function exitMosaicMode(context) {
    var _a;
    const session = context.getMosaicSession();
    if (!session)
        return;
    detachCanvasHandlers(context, session);
    removePreviewCircle(context, session);
    removePreviewImage(context, session);
    releaseMosaicRasterCache(session);
    restoreObjectStates(session);
    context.canvas.selection = !!session.prevSelection;
    context.canvas.defaultCursor = (_a = session.prevDefaultCursor) !== null && _a !== void 0 ? _a : 'default';
    context.setMosaicSession(null);
    context.canvas.renderAll();
}
function updateMosaicPreview(context) {
    const session = context.getMosaicSession();
    const circle = session === null || session === void 0 ? void 0 : session.previewCircle;
    if (!session || !circle)
        return;
    const config = context.getMosaicConfig();
    circle.set({
        radius: config.brushSize / 2,
        fill: config.previewFill,
        stroke: config.previewStroke,
        strokeWidth: config.previewStrokeWidth,
        strokeDashArray: config.previewStrokeDashArray
            ? [...config.previewStrokeDashArray]
            : undefined,
    });
    context.canvas.bringObjectToFront(circle);
    safeRender(context.canvas);
}

function startImageElementLoad(dataUrl, options) {
    const imageElement = new Image();
    if (options.crossOrigin !== undefined) {
        imageElement.crossOrigin = options.crossOrigin;
    }
    const cleanup = (clearSource = false) => {
        if (typeof imageElement.removeEventListener === 'function') {
            imageElement.removeEventListener('load', handleLoad);
            imageElement.removeEventListener('error', handleError);
        }
        else {
            imageElement.onload = null;
            imageElement.onerror = null;
        }
        if (clearSource) {
            try {
                imageElement.src = '';
            }
            catch {
            }
        }
    };
    const handleLoad = () => {
        var _a, _b;
        const validationError = (_b = (_a = options.validate) === null || _a === void 0 ? void 0 : _a.call(options, imageElement)) !== null && _b !== void 0 ? _b : null;
        if (validationError) {
            cleanup(true);
            rejectImage(validationError);
            return;
        }
        cleanup(false);
        resolveImage(imageElement);
    };
    const handleError = (event) => {
        cleanup(true);
        rejectImage(options.createError(event));
    };
    let resolveImage;
    let rejectImage;
    const promise = new Promise((resolve, reject) => {
        resolveImage = resolve;
        rejectImage = reject;
        if (typeof imageElement.addEventListener === 'function') {
            imageElement.addEventListener('load', handleLoad, { once: true });
            imageElement.addEventListener('error', handleError, { once: true });
        }
        else {
            imageElement.onload = handleLoad;
            imageElement.onerror = handleError;
        }
        imageElement.src = dataUrl;
    });
    return { promise, cleanup };
}

function createMergeError(operation, error) {
    if (operation === 'mergeAnnotations') {
        if (error instanceof MergeAnnotationsError)
            return error;
        const message = error instanceof Error
            ? `mergeAnnotations failed: ${error.message}`
            : 'mergeAnnotations failed';
        return new MergeAnnotationsError(message, error);
    }
    if (error instanceof MergeMasksError)
        return error;
    const message = error instanceof Error ? `mergeMasks failed: ${error.message}` : 'mergeMasks failed';
    return new MergeMasksError(message, error);
}
function detachObjects(canvas, objects) {
    for (const object of objects) {
        if (!canvas.getObjects().includes(object))
            continue;
        canvas.remove(object);
    }
    canvas.discardActiveObject();
    canvas.renderAll();
}
async function flattenOverlayGroupToBaseImage(context, options) {
    if (!context.isImageLoaded())
        return;
    if (options.getTargets().length === 0)
        return;
    const beforeSnapshot = context.captureSnapshot();
    const preservedObjects = options.getPreservedObjects();
    const preScrollTop = context.containerElement ? context.containerElement.scrollTop : null;
    const preScrollLeft = context.containerElement ? context.containerElement.scrollLeft : null;
    try {
        detachObjects(context.canvas, preservedObjects);
        const exportedDataUrl = await context.exportImageBase64(options.exportOptions);
        if (!exportedDataUrl) {
            throw createMergeError(options.operation, `${options.operation}: exportImageBase64 returned an empty data URL.`);
        }
        options.removeTargetsNoHistory();
        await context.loadImage(exportedDataUrl, { preserveScroll: true });
        await options.restorePreservedObjects(preservedObjects);
        normalizeLayerOrder(context.canvas);
        context.canvas.renderAll();
        context.updateInputs();
        context.updateUi();
        if (context.containerElement) {
            try {
                if (preScrollTop !== null)
                    context.containerElement.scrollTop = preScrollTop;
                if (preScrollLeft !== null)
                    context.containerElement.scrollLeft = preScrollLeft;
            }
            catch (scrollError) {
                console.warn(`[ImageEditor] ${options.operation}: scroll restore failed`, scrollError);
            }
        }
        const afterSnapshot = context.captureSnapshot();
        if (beforeSnapshot && afterSnapshot && beforeSnapshot !== afterSnapshot) {
            context.historyManager.push(new Command(() => context.loadFromState(afterSnapshot), () => context.loadFromState(beforeSnapshot)));
        }
    }
    catch (error) {
        try {
            await context.loadFromState(beforeSnapshot);
        }
        catch (rollbackError) {
            console.warn(`[ImageEditor] ${options.operation}: rollback failed`, rollbackError);
        }
        throw createMergeError(options.operation, error);
    }
}

function resolveMultiplier(requested, fallback) {
    const num = Number(requested);
    if (Number.isFinite(num) && num > 0)
        return num;
    const fallbackValue = Number(fallback);
    return Number.isFinite(fallbackValue) && fallbackValue > 0 ? fallbackValue : 1;
}
function resolveExportArea(requested, fallback) {
    if (requested === 'canvas' || requested === 'image')
        return requested;
    return fallback === 'canvas' ? 'canvas' : 'image';
}
function resolveExportOptions(context, options) {
    const providedOptions = options !== null && options !== void 0 ? options : {};
    return {
        exportArea: resolveExportArea(providedOptions.exportArea, context.options.exportAreaByDefault),
        mergeMasks: typeof providedOptions.mergeMasks === 'boolean'
            ? providedOptions.mergeMasks
            : context.options.mergeMasksByDefault,
        mergeAnnotations: typeof providedOptions.mergeAnnotations === 'boolean'
            ? providedOptions.mergeAnnotations
            : context.options.mergeAnnotationsByDefault,
        multiplier: resolveMultiplier(providedOptions.multiplier, context.options.exportMultiplier),
        format: resolveExportFormat(providedOptions, context.options.downsampleQuality),
    };
}
function readCanvasDimension(canvas, getterName, propertyName) {
    const canvasLike = canvas;
    const getter = canvasLike[getterName];
    const value = typeof getter === 'function' ? getter.call(canvasLike) : canvasLike[propertyName];
    return Math.max(1, Math.ceil(Number.isFinite(value) ? Number(value) : 1));
}
function assertExportPixelBudget(context, multiplier, region) {
    var _a, _b;
    const sourceWidth = (_a = region === null || region === void 0 ? void 0 : region.width) !== null && _a !== void 0 ? _a : readCanvasDimension(context.canvas, 'getWidth', 'width');
    const sourceHeight = (_b = region === null || region === void 0 ? void 0 : region.height) !== null && _b !== void 0 ? _b : readCanvasDimension(context.canvas, 'getHeight', 'height');
    const outputWidth = Math.max(1, Math.ceil(sourceWidth * multiplier));
    const outputHeight = Math.max(1, Math.ceil(sourceHeight * multiplier));
    const pixelCount = outputWidth * outputHeight;
    const maxPixels = context.options.maxExportPixels;
    if (!Number.isFinite(pixelCount) || pixelCount > maxPixels) {
        throw new RangeError(`[ImageEditor] Export size ${outputWidth}x${outputHeight} ` +
            `(${pixelCount} pixels) exceeds maxExportPixels (${maxPixels}).`);
    }
}
function computeExportRegion(context, exportArea) {
    if (exportArea === 'canvas')
        return { region: null, partialEdges: null };
    const originalImage = context.getOriginalImage();
    if (!originalImage)
        return { region: null, partialEdges: null };
    const bounds = getObjectBBox(originalImage);
    const canvasLike = context.canvas;
    const canvasWidth = typeof canvasLike.getWidth === 'function' ? canvasLike.getWidth() : canvasLike.width;
    const canvasHeight = typeof canvasLike.getHeight === 'function' ? canvasLike.getHeight() : canvasLike.height;
    if (!hasMeaningfulCanvasRegion(bounds, canvasWidth, canvasHeight)) {
        throw new ExportError('exportImageBase64 failed: image export region is empty.');
    }
    return {
        region: getClampedCanvasRegion(bounds, canvasWidth, canvasHeight, {
            includePartialPixels: true,
        }),
        partialEdges: getPartialExportEdges(bounds, Number(originalImage.angle) || 0),
    };
}
async function withMaskExportState(context, mergeMasks, callback) {
    if (!mergeMasks) {
        return withObjectsHidden(context.canvas, isMaskObject, callback);
    }
    return withMaskStyleBackup({ canvas: context.canvas, options: context.options }, applyExportBakeInStyle, callback);
}
async function withObjectsHidden(canvas, predicate, callback) {
    const backups = getCanvasObjects(canvas)
        .filter(predicate)
        .map((object) => ({
        object,
        visible: object.visible,
    }));
    for (const backup of backups) {
        try {
            if (typeof backup.object.set === 'function') {
                backup.object.set({ visible: false });
            }
            else {
                backup.object.visible = false;
            }
        }
        catch {
        }
    }
    try {
        return await callback();
    }
    finally {
        for (const backup of backups) {
            try {
                if (typeof backup.object.set === 'function') {
                    backup.object.set({ visible: backup.visible });
                }
                else {
                    backup.object.visible = backup.visible;
                }
            }
            catch {
            }
        }
        requestRender(canvas);
    }
}
async function withSessionObjectsHidden(context, callback) {
    return withObjectsHidden(context.canvas, (object) => isSessionObject(object) ||
        object.isCropRect === true ||
        object.maskLabel === true ||
        object.isMosaicPreview === true, callback);
}
async function withAnnotationsExportState(context, mergeAnnotations, callback) {
    if (!mergeAnnotations) {
        return withObjectsHidden(context.canvas, isAnnotationObject, callback);
    }
    return withObjectsHidden(context.canvas, (object) => isAnnotationObject(object) && object.annotationHidden === true, callback);
}
function getCanvasObjects(canvas) {
    try {
        return canvas.getObjects();
    }
    catch {
        return [];
    }
}
function isObjectOnCanvas(canvas, object) {
    return getCanvasObjects(canvas).includes(object);
}
function captureMaskLabelBackups(canvas) {
    const backups = [];
    for (const object of getCanvasObjects(canvas)) {
        if (!isMaskObject(object))
            continue;
        const label = object.labelObject;
        if (!label)
            continue;
        const wasOnCanvas = isObjectOnCanvas(canvas, label);
        backups.push({
            mask: object,
            label,
            wasOnCanvas,
            visible: label.visible,
        });
        try {
            if (typeof label.set === 'function')
                label.set({ visible: false });
            if (wasOnCanvas)
                canvas.remove(label);
        }
        catch {
        }
    }
    return backups;
}
function restoreMaskLabelBackups(canvas, backups) {
    for (const backup of backups) {
        try {
            backup.mask.labelObject = backup.label;
            if (typeof backup.label.set === 'function') {
                backup.label.set({ visible: backup.visible });
            }
            else {
                backup.label.visible = backup.visible;
            }
            if (backup.wasOnCanvas && !isObjectOnCanvas(canvas, backup.label)) {
                canvas.add(backup.label);
                canvas.bringObjectToFront(backup.label);
            }
        }
        catch {
        }
    }
}
function captureActiveObject(canvas) {
    var _a;
    try {
        const canvasWithSelection = canvas;
        if (typeof canvasWithSelection.getActiveObject !== 'function')
            return null;
        return (_a = canvasWithSelection.getActiveObject()) !== null && _a !== void 0 ? _a : null;
    }
    catch {
        return null;
    }
}
function restoreActiveObject(canvas, activeObject) {
    if (!activeObject)
        return;
    try {
        const canvasWithSelection = canvas;
        if (typeof canvasWithSelection.setActiveObject === 'function') {
            canvasWithSelection.setActiveObject(activeObject);
        }
    }
    catch {
    }
}
function requestRender(canvas) {
    try {
        if (typeof canvas.requestRenderAll === 'function') {
            canvas.requestRenderAll();
        }
        else {
            canvas.renderAll();
        }
    }
    catch {
    }
}
function applyExportBakeInStyle(mask) {
    try {
        mask.set({
            opacity: 1,
            fill: '#000',
            strokeWidth: 0,
            stroke: null,
            selectable: false,
        });
        if (typeof mask.setCoords === 'function')
            mask.setCoords();
    }
    catch {
    }
}
function renderCanvasToDataUrl(canvas, format, quality, multiplier, region) {
    const fabricOptions = {
        format,
        multiplier,
    };
    if (quality !== undefined)
        fabricOptions.quality = quality;
    if (region) {
        fabricOptions.left = region.left;
        fabricOptions.top = region.top;
        fabricOptions.width = region.width;
        fabricOptions.height = region.height;
    }
    return canvas.toDataURL(fabricOptions);
}
function hasPartialEdges(edges) {
    return !!edges && (edges.left || edges.top || edges.right || edges.bottom);
}
function getImageDimensions(imageElement) {
    return {
        width: Math.max(1, imageElement.naturalWidth || imageElement.width || 1),
        height: Math.max(1, imageElement.naturalHeight || imageElement.height || 1),
    };
}
function loadImageElement(dataUrl) {
    return startImageElementLoad(dataUrl, {
        crossOrigin: 'anonymous',
        createError: () => new Error('Failed to decode export data URL'),
    }).promise;
}
async function sealPartialTransparentEdges(dataUrl, edges, target, ownerDocument) {
    if (!hasPartialEdges(edges))
        return dataUrl;
    const imageElement = await loadImageElement(dataUrl);
    const { width, height } = getImageDimensions(imageElement);
    const offscreenCanvas = ownerDocument.createElement('canvas');
    offscreenCanvas.width = width;
    offscreenCanvas.height = height;
    const canvasContext = offscreenCanvas.getContext('2d');
    if (!canvasContext)
        throw new Error('2D canvas context is unavailable');
    canvasContext.drawImage(imageElement, 0, 0, width, height);
    const imageData = canvasContext.getImageData(0, 0, width, height);
    const pixels = imageData.data;
    const sealPixel = (x, y, fallbackX, fallbackY) => {
        var _a, _b, _c, _d, _e, _f;
        const index = (y * width + x) * 4;
        const fallbackIndex = (fallbackY * width + fallbackX) * 4;
        const alpha = (_a = pixels[index + 3]) !== null && _a !== void 0 ? _a : 0;
        const fallbackAlpha = (_b = pixels[fallbackIndex + 3]) !== null && _b !== void 0 ? _b : 0;
        if (alpha === 0 && fallbackAlpha > 0) {
            pixels[index] = (_c = pixels[fallbackIndex]) !== null && _c !== void 0 ? _c : 0;
            pixels[index + 1] = (_d = pixels[fallbackIndex + 1]) !== null && _d !== void 0 ? _d : 0;
            pixels[index + 2] = (_e = pixels[fallbackIndex + 2]) !== null && _e !== void 0 ? _e : 0;
            pixels[index + 3] = fallbackAlpha;
        }
        const nextAlpha = (_f = pixels[index + 3]) !== null && _f !== void 0 ? _f : 0;
        if (nextAlpha > 0 && nextAlpha < 255) {
            pixels[index + 3] = 255;
        }
    };
    if ((edges === null || edges === void 0 ? void 0 : edges.left) && width > 1) {
        for (let y = 0; y < height; y += 1)
            sealPixel(0, y, 1, y);
    }
    if ((edges === null || edges === void 0 ? void 0 : edges.right) && width > 1) {
        for (let y = 0; y < height; y += 1)
            sealPixel(width - 1, y, width - 2, y);
    }
    if ((edges === null || edges === void 0 ? void 0 : edges.top) && height > 1) {
        for (let x = 0; x < width; x += 1)
            sealPixel(x, 0, x, 1);
    }
    if ((edges === null || edges === void 0 ? void 0 : edges.bottom) && height > 1) {
        for (let x = 0; x < width; x += 1)
            sealPixel(x, height - 1, x, height - 2);
    }
    canvasContext.putImageData(imageData, 0, 0);
    return target.quality === undefined
        ? offscreenCanvas.toDataURL(target.mimeType)
        : offscreenCanvas.toDataURL(target.mimeType, target.quality);
}
function getJpegBackgroundColor(backgroundColor, ownerDocument) {
    return resolveCanvasFillStyle(backgroundColor, ownerDocument);
}
function resolveCanvasFillStyle(backgroundColor, ownerDocument, fallback = '#ffffff') {
    const value = String(backgroundColor !== null && backgroundColor !== void 0 ? backgroundColor : '').trim();
    if (!value || isTransparentCssColor(value))
        return '#ffffff';
    const context = createColorValidationContext(ownerDocument);
    if (!context)
        return fallback;
    context.fillStyle = '#000001';
    const firstSentinel = context.fillStyle;
    context.fillStyle = value;
    const firstResolved = context.fillStyle;
    if (firstResolved !== firstSentinel)
        return firstResolved;
    context.fillStyle = '#000002';
    const secondSentinel = context.fillStyle;
    context.fillStyle = value;
    const secondResolved = context.fillStyle;
    if (secondResolved !== secondSentinel)
        return secondResolved;
    return fallback;
}
function createColorValidationContext(ownerDocument) {
    try {
        return ownerDocument.createElement('canvas').getContext('2d');
    }
    catch {
        return null;
    }
}
function getCanvasDocument$1(canvas) {
    var _a, _b, _c, _d;
    const canvasLike = canvas;
    const ownerDocument = (_c = (_b = (_a = canvasLike.getElement) === null || _a === void 0 ? void 0 : _a.call(canvasLike)) === null || _b === void 0 ? void 0 : _b.ownerDocument) !== null && _c !== void 0 ? _c : (_d = canvasLike.lowerCanvasEl) === null || _d === void 0 ? void 0 : _d.ownerDocument;
    if (ownerDocument)
        return ownerDocument;
    if (typeof document !== 'undefined')
        return document;
    throw new Error('Document is unavailable for export canvas creation.');
}
function isTransparentCssColor(value) {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'transparent')
        return true;
    const hex = normalized.match(/^#([0-9a-f]{4}|[0-9a-f]{8})$/i);
    if (hex) {
        const digits = hex[1];
        const alpha = digits.length === 4 ? digits[3] : digits.slice(6, 8);
        return /^0+$/.test(alpha);
    }
    const commaAlpha = normalized.match(/^(?:rgba|hsla)\((.*),\s*([^,/)]+)\)$/i);
    if (commaAlpha && isZeroCssAlpha(commaAlpha[2]))
        return true;
    const slashAlpha = normalized.match(/^[a-z][a-z0-9-]*\([^/]+\/\s*([^)]+)\)$/i);
    if (slashAlpha && isZeroCssAlpha(slashAlpha[1]))
        return true;
    return false;
}
function isZeroCssAlpha(value) {
    const alpha = value.trim();
    if (alpha.endsWith('%')) {
        const numericPercent = Number.parseFloat(alpha.slice(0, -1));
        return Number.isFinite(numericPercent) && numericPercent === 0;
    }
    const numericAlpha = Number.parseFloat(alpha);
    return Number.isFinite(numericAlpha) && numericAlpha === 0;
}
async function convertDataUrlToOpaqueJpeg(dataUrl, backgroundColor, quality, ownerDocument) {
    const imageElement = await loadImageElement(dataUrl);
    const { width, height } = getImageDimensions(imageElement);
    const offscreenCanvas = ownerDocument.createElement('canvas');
    offscreenCanvas.width = width;
    offscreenCanvas.height = height;
    const canvasContext = offscreenCanvas.getContext('2d');
    if (!canvasContext)
        throw new Error('2D canvas context is unavailable');
    canvasContext.fillStyle = getJpegBackgroundColor(backgroundColor, ownerDocument);
    canvasContext.fillRect(0, 0, width, height);
    canvasContext.drawImage(imageElement, 0, 0, width, height);
    return offscreenCanvas.toDataURL('image/jpeg', quality);
}
function dataUrlToBytes(dataUrl) {
    var _a;
    const match = /^data:image\/[a-z0-9.+-]+;base64,([A-Za-z0-9+/=]+)$/i.exec(dataUrl);
    const base64 = (_a = match === null || match === void 0 ? void 0 : match[1]) !== null && _a !== void 0 ? _a : '';
    if (!base64) {
        throw new Error('exportImageFile received a malformed or empty image data URL.');
    }
    if (typeof globalThis.atob === 'function') {
        const binary = globalThis.atob(base64);
        const buffer = new ArrayBuffer(binary.length);
        const bytes = new Uint8Array(buffer);
        for (let i = binary.length - 1; i >= 0; i -= 1) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    }
    const bufferCtor = globalThis.Buffer;
    if (bufferCtor && typeof bufferCtor.from === 'function') {
        const source = bufferCtor.from(base64, 'base64');
        const buffer = new ArrayBuffer(source.length);
        const bytes = new Uint8Array(buffer);
        bytes.set(source);
        return bytes;
    }
    throw new Error('No base64 decoder is available for exportImageFile.');
}
async function reencodeDataUrlAs(sourceDataUrl, target, backgroundColor, canvas) {
    if (sourceDataUrl.startsWith(`data:${target.mimeType}`)) {
        return sourceDataUrl;
    }
    const imageElement = await loadImageElement(sourceDataUrl);
    const { width, height } = getImageDimensions(imageElement);
    const ownerDocument = getCanvasDocument$1(canvas);
    const offscreenCanvas = ownerDocument.createElement('canvas');
    offscreenCanvas.width = width;
    offscreenCanvas.height = height;
    const canvasContext = offscreenCanvas.getContext('2d');
    if (!canvasContext) {
        throw new Error('Unable to acquire 2D context for export conversion');
    }
    if (target.format === 'jpeg') {
        canvasContext.fillStyle = getJpegBackgroundColor(backgroundColor, ownerDocument);
        canvasContext.fillRect(0, 0, width, height);
    }
    canvasContext.drawImage(imageElement, 0, 0, width, height);
    return offscreenCanvas.toDataURL(target.mimeType, target.quality);
}
function warnNoImageLoaded(operation) {
    console.warn(`[ImageEditor] ${operation} skipped: no image is loaded on the canvas.`);
}
function extensionForFormat(format) {
    return format === 'jpeg' ? 'jpg' : format;
}
function resolveFileName(baseName, format) {
    const fallback = 'edited_image';
    const trimmed = String(baseName || fallback).trim() || fallback;
    const ext = extensionForFormat(format.format);
    if (/\.(jpe?g|png|webp)$/i.test(trimmed)) {
        return trimmed.replace(/\.(jpe?g|png|webp)$/i, `.${ext}`);
    }
    return `${trimmed}.${ext}`;
}
async function renderExportDataUrl(context, resolved) {
    const activeObject = captureActiveObject(context.canvas);
    const labelBackups = captureMaskLabelBackups(context.canvas);
    try {
        context.canvas.discardActiveObject();
        const { region, partialEdges } = computeExportRegion(context, resolved.exportArea);
        assertExportPixelBudget(context, resolved.multiplier, region);
        const renderFormat = region && resolved.format.format === 'jpeg' ? 'png' : resolved.format.format;
        const renderQuality = renderFormat === 'png' ? undefined : resolved.format.quality;
        let dataUrl = await withSessionObjectsHidden(context, async () => withMaskExportState(context, resolved.mergeMasks, async () => withAnnotationsExportState(context, resolved.mergeAnnotations, async () => renderCanvasToDataUrl(context.canvas, renderFormat, renderQuality, resolved.multiplier, region))));
        if (region) {
            const sealedFormat = resolved.format.format === 'jpeg'
                ? { format: 'png', mimeType: 'image/png', quality: undefined }
                : resolved.format;
            if (hasPartialEdges(partialEdges)) {
                dataUrl = await sealPartialTransparentEdges(dataUrl, partialEdges, sealedFormat, getCanvasDocument$1(context.canvas));
            }
            if (resolved.format.format === 'jpeg') {
                dataUrl = await convertDataUrlToOpaqueJpeg(dataUrl, context.options.backgroundColor, resolved.format.quality, getCanvasDocument$1(context.canvas));
            }
        }
        return dataUrl;
    }
    finally {
        restoreMaskLabelBackups(context.canvas, labelBackups);
        restoreActiveObject(context.canvas, activeObject);
        requestRender(context.canvas);
    }
}
async function exportImageBase64(context, options) {
    if (!context.isImageLoaded()) {
        warnNoImageLoaded('exportImageBase64');
        return '';
    }
    const resolved = resolveExportOptions(context, options);
    return renderExportDataUrl(context, resolved);
}
async function exportImageFile(context, options) {
    var _a;
    if (!context.isImageLoaded()) {
        warnNoImageLoaded('exportImageFile');
        throw new ExportNotReadyError('exportImageFile');
    }
    const providedOptions = options !== null && options !== void 0 ? options : {};
    const resolved = resolveExportOptions(context, providedOptions);
    const rawDataUrl = await renderExportDataUrl(context, resolved);
    const finalDataUrl = await reencodeDataUrlAs(rawDataUrl, resolved.format, context.options.backgroundColor, context.canvas);
    let bytes;
    try {
        bytes = dataUrlToBytes(finalDataUrl);
    }
    catch (error) {
        throw new ExportError('exportImageFile failed to decode rendered data URL.', error);
    }
    const fileName = resolveFileName((_a = providedOptions.fileName) !== null && _a !== void 0 ? _a : context.options.defaultDownloadFileName, resolved.format);
    return new File([bytes], fileName, { type: resolved.format.mimeType });
}
async function downloadImage(context, options) {
    if (!context.isImageLoaded()) {
        warnNoImageLoaded('downloadImage');
        return;
    }
    if (options !== undefined && options !== null && typeof options !== 'object') {
        throw new TypeError('[ImageEditor] downloadImage(options) expects an ImageExportOptions object.');
    }
    try {
        const file = await exportImageFile(context, options);
        triggerFileDownload(context, file);
    }
    catch (error) {
        reportError(context.options, error, 'downloadImage failed.');
        console.error('[ImageEditor] downloadImage failed', error);
        throw error;
    }
}
function triggerFileDownload(context, file) {
    const ownerDocument = getCanvasDocument$1(context.canvas);
    const objectUrl = URL.createObjectURL(file);
    const link = ownerDocument.createElement('a');
    link.download = file.name;
    link.href = objectUrl;
    const body = ownerDocument.body;
    body.appendChild(link);
    try {
        link.click();
    }
    finally {
        body.removeChild(link);
        if (typeof globalThis.setTimeout === 'function') {
            globalThis.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
        }
        else {
            URL.revokeObjectURL(objectUrl);
        }
    }
}
async function mergeMasks(context) {
    await flattenOverlayGroupToBaseImage(context, {
        operation: 'mergeMasks',
        exportOptions: {
            exportArea: 'image',
            mergeMasks: true,
            mergeAnnotations: false,
            multiplier: context.options.exportMultiplier,
            fileType: 'png',
        },
        getTargets: () => context.canvas.getObjects().filter(isMaskObject),
        getPreservedObjects: () => context.getAnnotations(),
        removeTargetsNoHistory: () => {
            context.removeAllMasksNoHistory();
        },
        restorePreservedObjects: (objects) => context.restoreAnnotations(objects),
    });
}
async function mergeAnnotations(context) {
    await flattenOverlayGroupToBaseImage(context, {
        operation: 'mergeAnnotations',
        exportOptions: {
            exportArea: 'image',
            mergeMasks: false,
            mergeAnnotations: true,
            multiplier: context.options.exportMultiplier,
            fileType: 'png',
        },
        getTargets: () => context.canvas.getObjects().filter(isAnnotationObject),
        getPreservedObjects: () => context.getMasks(),
        removeTargetsNoHistory: () => {
            context.removeAllAnnotationsNoHistory();
        },
        restorePreservedObjects: (objects) => context.restoreMasks(objects),
    });
}

const SUPPORTED_IMAGE_EXTENSIONS = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif',
    bmp: 'image/bmp',
};
const SUPPORTED_IMAGE_MIME_TYPES = new Set(Object.values(SUPPORTED_IMAGE_EXTENSIONS));
function isSupportedImageDataUrl(value) {
    if (typeof value !== 'string')
        return false;
    if (!value.startsWith('data:image/'))
        return false;
    const match = /^data:(image\/[^;,]+)(?:[;,])/.exec(value);
    if (!match)
        return false;
    return SUPPORTED_IMAGE_MIME_TYPES.has(match[1].toLowerCase());
}
function inferImageMimeType(file) {
    var _a, _b;
    if (file.type && SUPPORTED_IMAGE_MIME_TYPES.has(file.type))
        return file.type;
    if (file.type)
        return null;
    const match = /\.([a-z0-9]+)$/i.exec(file.name);
    const ext = (_a = match === null || match === void 0 ? void 0 : match[1]) === null || _a === void 0 ? void 0 : _a.toLowerCase();
    if (!ext)
        return null;
    return (_b = SUPPORTED_IMAGE_EXTENSIONS[ext]) !== null && _b !== void 0 ? _b : null;
}
function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const fileReaderResult = reader.result;
            if (typeof fileReaderResult === 'string') {
                resolve(fileReaderResult);
            }
            else {
                reject(new Error('FileReader returned a non-string result'));
            }
        };
        reader.onerror = () => {
            var _a;
            reject((_a = reader.error) !== null && _a !== void 0 ? _a : new Error('FileReader error'));
        };
        reader.onabort = () => {
            reject(new Error('FileReader read aborted'));
        };
        reader.readAsDataURL(file);
    });
}
function resetFileInput(input) {
    if (!input)
        return;
    try {
        input.value = '';
    }
    catch {
    }
}

function forceReflow(element) {
    if (!element)
        return;
    void element.offsetWidth;
}

function selectLayoutStrategy(mode) {
    return mode;
}
class ViewportCache {
    constructor() {
        Object.defineProperty(this, "lastVisible", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
    }
    measure(container, fallback, scrollbarSize) {
        var _a;
        if (!container)
            return fallback;
        const containerWidth = Math.floor(container.clientWidth);
        const containerHeight = Math.floor(container.clientHeight);
        if (containerWidth > 0 && containerHeight > 0) {
            this.lastVisible = measureContainerViewport(container, fallback, scrollbarSize);
            return this.lastVisible;
        }
        return (_a = this.lastVisible) !== null && _a !== void 0 ? _a : fallback;
    }
    peek() {
        return this.lastVisible;
    }
    clear() {
        this.lastVisible = null;
    }
}
const OVERFLOW_EPSILON = 0.5;
function normalizeOverflowValue(value) {
    return String(value !== null && value !== void 0 ? value : '')
        .trim()
        .toLowerCase();
}
function getContainerOverflowValues(container) {
    var _a, _b;
    const style = container.style;
    let computedOverflow = '';
    let computedOverflowX = '';
    let computedOverflowY = '';
    const view = (_b = (_a = container.ownerDocument) === null || _a === void 0 ? void 0 : _a.defaultView) !== null && _b !== void 0 ? _b : (typeof window === 'undefined' ? null : window);
    if (typeof (view === null || view === void 0 ? void 0 : view.getComputedStyle) === 'function') {
        const computed = view.getComputedStyle(container);
        computedOverflow = computed.overflow;
        computedOverflowX = computed.overflowX;
        computedOverflowY = computed.overflowY;
    }
    const x = [
        normalizeOverflowValue(style === null || style === void 0 ? void 0 : style.overflow),
        normalizeOverflowValue(style === null || style === void 0 ? void 0 : style.overflowX),
        normalizeOverflowValue(computedOverflow),
        normalizeOverflowValue(computedOverflowX),
    ];
    const y = [
        normalizeOverflowValue(style === null || style === void 0 ? void 0 : style.overflow),
        normalizeOverflowValue(style === null || style === void 0 ? void 0 : style.overflowY),
        normalizeOverflowValue(computedOverflow),
        normalizeOverflowValue(computedOverflowY),
    ];
    return { x, y, all: [...x, ...y] };
}
function isAutoScrollableOverflow(value) {
    return value === 'auto' || value === 'overlay';
}
function measureScrollbarSize(ownerDocument) {
    const doc = ownerDocument !== null && ownerDocument !== void 0 ? ownerDocument : (typeof document === 'undefined' ? null : document);
    if (!(doc === null || doc === void 0 ? void 0 : doc.body))
        return { width: 0, height: 0 };
    const probe = doc.createElement('div');
    probe.style.position = 'absolute';
    probe.style.left = '-9999px';
    probe.style.top = '-9999px';
    probe.style.width = '100px';
    probe.style.height = '100px';
    probe.style.overflow = 'scroll';
    probe.style.visibility = 'hidden';
    probe.style.pointerEvents = 'none';
    doc.body.appendChild(probe);
    const width = Math.max(0, probe.offsetWidth - probe.clientWidth);
    const height = Math.max(0, probe.offsetHeight - probe.clientHeight);
    probe.remove();
    return { width, height };
}
function normalizeScrollbarSize(scrollbarSize) {
    return {
        width: Math.max(0, Number(scrollbarSize === null || scrollbarSize === void 0 ? void 0 : scrollbarSize.width) || 0),
        height: Math.max(0, Number(scrollbarSize === null || scrollbarSize === void 0 ? void 0 : scrollbarSize.height) || 0),
    };
}
function measureContainerViewport(container, fallback, scrollbarSize) {
    if (!container)
        return fallback;
    const clientWidth = Math.floor(container.clientWidth || 0);
    const clientHeight = Math.floor(container.clientHeight || 0);
    if (clientWidth <= 0 || clientHeight <= 0)
        return fallback;
    const overflow = getContainerOverflowValues(container);
    if (overflow.all.includes('scroll')) {
        return { width: clientWidth, height: clientHeight };
    }
    const scrollbar = normalizeScrollbarSize(scrollbarSize);
    const canAutoScrollX = overflow.x.some(isAutoScrollableOverflow);
    const canAutoScrollY = overflow.y.some(isAutoScrollableOverflow);
    const scrollWidth = Math.ceil(container.scrollWidth || 0);
    const scrollHeight = Math.ceil(container.scrollHeight || 0);
    const hasHorizontalScrollbar = canAutoScrollX && scrollWidth > clientWidth + OVERFLOW_EPSILON;
    const hasVerticalScrollbar = canAutoScrollY && scrollHeight > clientHeight + OVERFLOW_EPSILON;
    return {
        width: clientWidth + (hasVerticalScrollbar ? scrollbar.width : 0),
        height: clientHeight + (hasHorizontalScrollbar ? scrollbar.height : 0),
    };
}
function computeScrollableCanvasSize(contentWidth, contentHeight, viewport, scrollbarSize) {
    const viewportW = Math.max(1, viewport.width || 1);
    const viewportH = Math.max(1, viewport.height || 1);
    const scrollbar = normalizeScrollbarSize(scrollbarSize);
    let hasHorizontal = false;
    let hasVertical = false;
    for (let i = 0; i < 4; i += 1) {
        const effectiveW = Math.max(1, viewportW - (hasVertical ? scrollbar.width : 0));
        const effectiveH = Math.max(1, viewportH - (hasHorizontal ? scrollbar.height : 0));
        const nextHorizontal = contentWidth > effectiveW + OVERFLOW_EPSILON;
        const nextVertical = contentHeight > effectiveH + OVERFLOW_EPSILON;
        if (nextHorizontal === hasHorizontal && nextVertical === hasVertical)
            break;
        hasHorizontal = nextHorizontal;
        hasVertical = nextVertical;
    }
    const effectiveW = Math.max(1, viewportW - (hasVertical ? scrollbar.width : 0));
    const effectiveH = Math.max(1, viewportH - (hasHorizontal ? scrollbar.height : 0));
    return {
        width: hasHorizontal ? Math.ceil(contentWidth) : effectiveW,
        height: hasVertical ? Math.ceil(contentHeight) : effectiveH,
    };
}
function computeFitLayout(imageWidth, imageHeight, optionsCanvasWidth, optionsCanvasHeight, containerSize) {
    const canvasWidth = Math.max(1, (containerSize.width || optionsCanvasWidth) - 1);
    const canvasHeight = Math.max(1, (containerSize.height || optionsCanvasHeight) - 1);
    const fitScale = Math.min(canvasWidth / imageWidth, canvasHeight / imageHeight, 1);
    return {
        canvasWidth,
        canvasHeight,
        imageScale: fitScale,
        imageLeft: 0,
        imageTop: 0,
        baseImageScale: fitScale,
    };
}
function computeCoverLayout(imageWidth, imageHeight, optionsCanvasWidth, optionsCanvasHeight, containerSize, scrollbarSize) {
    const viewportW = containerSize.width || optionsCanvasWidth;
    const viewportH = containerSize.height || optionsCanvasHeight;
    const scrollbar = normalizeScrollbarSize(scrollbarSize);
    let hasHorizontal = false;
    let hasVertical = false;
    let coverScale = 1;
    let scaledW = imageWidth;
    let scaledH = imageHeight;
    for (let i = 0; i < 4; i += 1) {
        const effectiveW = Math.max(1, viewportW - (hasVertical ? scrollbar.width : 0));
        const effectiveH = Math.max(1, viewportH - (hasHorizontal ? scrollbar.height : 0));
        coverScale = Math.min(1, Math.max(effectiveW / imageWidth, effectiveH / imageHeight));
        scaledW = imageWidth * coverScale;
        scaledH = imageHeight * coverScale;
        const nextHasHorizontal = scaledW > effectiveW + OVERFLOW_EPSILON;
        const nextHasVertical = scaledH > effectiveH + OVERFLOW_EPSILON;
        if (nextHasHorizontal === hasHorizontal && nextHasVertical === hasVertical)
            break;
        hasHorizontal = nextHasHorizontal;
        hasVertical = nextHasVertical;
    }
    const canvasSize = computeScrollableCanvasSize(scaledW, scaledH, {
        width: viewportW,
        height: viewportH,
    }, scrollbar);
    return {
        canvasWidth: canvasSize.width,
        canvasHeight: canvasSize.height,
        imageScale: coverScale,
        imageLeft: 0,
        imageTop: 0,
        baseImageScale: coverScale,
    };
}
function computeExpandLayout(imageWidth, imageHeight, optionsCanvasWidth, optionsCanvasHeight, containerSize) {
    const canvasWidth = Math.max(containerSize.width, Math.floor(imageWidth));
    const canvasHeight = Math.max(containerSize.height, Math.floor(imageHeight));
    return {
        canvasWidth,
        canvasHeight,
        imageScale: 1,
        imageLeft: 0,
        imageTop: 0,
        baseImageScale: 1,
    };
}
function applyCanvasDimensions(canvas, width, height, containerElement) {
    const integerWidth = Math.max(1, Math.round(Number(width) || 1));
    const integerHeight = Math.max(1, Math.round(Number(height) || 1));
    canvas.setDimensions({ width: integerWidth, height: integerHeight });
    forceReflow(containerElement);
}

async function loadImage(context, imageBase64, loadOptions = {}) {
    if (!isSupportedImageDataUrl(imageBase64))
        return;
    const placeholderHidden = context.placeholderElement
        ? !!context.placeholderElement.hidden
        : null;
    const containerScrollTop = context.containerElement ? context.containerElement.scrollTop : null;
    const containerScrollLeft = context.containerElement
        ? context.containerElement.scrollLeft
        : null;
    const bundle = {
        placeholderHidden,
        containerScrollTop,
        containerScrollLeft,
        originalImage: context.getOriginalImage(),
        isImageLoadedToCanvas: context.getIsImageLoadedToCanvas(),
        lastSnapshot: context.getLastSnapshot(),
        canvasJson: serializeCanvas(context.canvas),
        maskCounter: context.getMaskCounter(),
        annotationCounter: context.getAnnotationCounter(),
        currentScale: context.getCurrentScale(),
        currentRotation: context.getCurrentRotation(),
        baseImageScale: context.getBaseImageScale(),
        currentImageMimeType: context.getCurrentImageMimeType(),
    };
    try {
        context.setPlaceholderVisible(false);
        const decode = startImageDecode(imageBase64);
        let imageElement;
        try {
            imageElement = await withTimeout(decode.promise, context.options.imageLoadTimeoutMs, 'image decode');
        }
        catch (error) {
            decode.cleanup(true);
            throw error;
        }
        const loadSource = maybeDownsample(imageElement, imageBase64, context.options, getCanvasDocument(context.canvas));
        const fabricImage = await withTimeout(context.fabric.FabricImage.fromURL(loadSource.dataUrl, { crossOrigin: 'anonymous' }), context.options.imageLoadTimeoutMs, 'FabricImage.fromURL');
        context.canvas.discardActiveObject();
        context.canvas.clear();
        context.canvas.backgroundColor = context.options.backgroundColor;
        const baseImage = markBaseImageObject(fabricImage);
        baseImage.set({
            originX: 'left',
            originY: 'top',
            selectable: false,
            evented: false,
        });
        const layout = computeLayout(context, baseImage);
        applyCanvasDimensions(context.canvas, layout.canvasWidth, layout.canvasHeight, context.containerElement);
        baseImage.set({ left: layout.imageLeft, top: layout.imageTop });
        baseImage.scale(layout.imageScale);
        context.canvas.add(baseImage);
        context.canvas.sendObjectToBack(baseImage);
        context.setOriginalImage(baseImage);
        context.setBaseImageScale(layout.baseImageScale);
        context.setCurrentScale(1);
        context.setCurrentRotation(0);
        context.setMaskCounter(0);
        context.setAnnotationCounter(0);
        context.setIsImageLoadedToCanvas(true);
        context.setCurrentImageMimeType(loadSource.mimeType);
        context.canvas.renderAll();
        context.setLastSnapshot(saveState({
            canvas: context.canvas,
            currentScale: 1,
            currentRotation: 0,
            baseImageScale: layout.baseImageScale,
            currentImageMimeType: loadSource.mimeType,
        }));
        if (loadOptions.preserveScroll === true && context.containerElement) {
            try {
                if (bundle.containerScrollTop !== null) {
                    context.containerElement.scrollTop = bundle.containerScrollTop;
                }
                if (bundle.containerScrollLeft !== null) {
                    context.containerElement.scrollLeft = bundle.containerScrollLeft;
                }
            }
            catch (error) {
                console.warn('[ImageEditor] preserveScroll restore failed', error);
            }
        }
    }
    catch (error) {
        await replayRollback(context, bundle);
        const errorMessage = error instanceof Error ? `loadImage failed: ${error.message}` : 'loadImage failed';
        reportError(context.options, error, errorMessage);
        throw error;
    }
}
function startImageDecode(dataUrl) {
    return startImageElementLoad(dataUrl, {
        validate: (imageElement) => hasNaturalImageDimensions(imageElement)
            ? null
            : new ImageDecodeError('Failed to decode image data URL: image has no natural dimensions.', null),
        createError: (event) => new ImageDecodeError('Failed to decode image data URL.', event),
    });
}
function hasNaturalImageDimensions(imageElement) {
    return (Number.isFinite(imageElement.naturalWidth) &&
        Number.isFinite(imageElement.naturalHeight) &&
        imageElement.naturalWidth > 0 &&
        imageElement.naturalHeight > 0);
}
function isPositiveFinite(value) {
    return Number.isFinite(value) && value > 0;
}
function toSupportedImageMimeType(mimeType) {
    return mimeType === 'image/jpeg' || mimeType === 'image/png' || mimeType === 'image/webp'
        ? mimeType
        : null;
}
function maybeDownsample(imageElement, originalDataUrl, options, ownerDocument) {
    const originalMimeType = toSupportedImageMimeType(detectSourceMimeType(originalDataUrl));
    if (!options.downsampleOnLoad) {
        return { dataUrl: originalDataUrl, mimeType: originalMimeType };
    }
    if (!isPositiveFinite(options.downsampleMaxWidth) ||
        !isPositiveFinite(options.downsampleMaxHeight)) {
        reportWarning(options, null, 'loadImage skipped downsampling because downsample bounds are invalid.');
        return { dataUrl: originalDataUrl, mimeType: originalMimeType };
    }
    const downsampleDimensions = computeDownsampleDimensions(imageElement.naturalWidth, imageElement.naturalHeight, options.downsampleMaxWidth, options.downsampleMaxHeight);
    if (!downsampleDimensions.needsResize) {
        return { dataUrl: originalDataUrl, mimeType: originalMimeType };
    }
    const sourceMime = detectSourceMimeType(originalDataUrl);
    const resampledImage = resampleImage(imageElement, options.downsampleMaxWidth, options.downsampleMaxHeight, sourceMime, options.preserveSourceFormat, options.downsampleMimeType, options.downsampleQuality, ownerDocument);
    const actualMimeType = toSupportedImageMimeType(detectSourceMimeType(resampledImage.dataUrl));
    return {
        dataUrl: resampledImage.dataUrl,
        mimeType: actualMimeType !== null && actualMimeType !== void 0 ? actualMimeType : resampledImage.mimeType,
    };
}
function getCanvasDocument(canvas) {
    var _a, _b, _c, _d, _e;
    const canvasLike = canvas;
    return ((_e = (_c = (_b = (_a = canvasLike.getElement) === null || _a === void 0 ? void 0 : _a.call(canvasLike)) === null || _b === void 0 ? void 0 : _b.ownerDocument) !== null && _c !== void 0 ? _c : (_d = canvasLike.lowerCanvasEl) === null || _d === void 0 ? void 0 : _d.ownerDocument) !== null && _e !== void 0 ? _e : (typeof document !== 'undefined' ? document : undefined));
}
function computeLayout(context, fabricImage) {
    var _a, _b, _c, _d;
    const imageWidth = (_a = fabricImage.width) !== null && _a !== void 0 ? _a : 0;
    const imageHeight = (_b = fabricImage.height) !== null && _b !== void 0 ? _b : 0;
    const scrollbarSize = measureScrollbarSize((_d = (_c = context.containerElement) === null || _c === void 0 ? void 0 : _c.ownerDocument) !== null && _d !== void 0 ? _d : null);
    const viewport = context.viewportCache.measure(context.containerElement, {
        width: context.options.canvasWidth,
        height: context.options.canvasHeight,
    }, scrollbarSize);
    const strategy = selectLayoutStrategy(context.options.layoutMode);
    if (strategy === 'fit') {
        return computeFitLayout(imageWidth, imageHeight, context.options.canvasWidth, context.options.canvasHeight, viewport);
    }
    if (strategy === 'cover') {
        return computeCoverLayout(imageWidth, imageHeight, context.options.canvasWidth, context.options.canvasHeight, viewport, scrollbarSize);
    }
    return computeExpandLayout(imageWidth, imageHeight, context.options.canvasWidth, context.options.canvasHeight, viewport);
}
function serializeCanvas(canvas) {
    canvas.discardActiveObject();
    const json = canvas.toJSON(SNAPSHOT_CUSTOM_KEYS);
    return JSON.stringify(json);
}
async function replayRollback(context, bundle) {
    try {
        await context.canvas.loadFromJSON(JSON.parse(bundle.canvasJson));
        context.canvas.renderAll();
    }
    catch (rollbackError) {
        console.warn('[ImageEditor] rollback: loadFromJSON failed', rollbackError);
    }
    context.setOriginalImage(bundle.originalImage);
    context.setIsImageLoadedToCanvas(bundle.isImageLoadedToCanvas);
    context.setLastSnapshot(bundle.lastSnapshot);
    context.setMaskCounter(bundle.maskCounter);
    context.setAnnotationCounter(bundle.annotationCounter);
    context.setCurrentScale(bundle.currentScale);
    context.setCurrentRotation(bundle.currentRotation);
    context.setBaseImageScale(bundle.baseImageScale);
    context.setCurrentImageMimeType(bundle.currentImageMimeType);
    if (context.containerElement) {
        try {
            if (bundle.containerScrollTop !== null) {
                context.containerElement.scrollTop = bundle.containerScrollTop;
            }
            if (bundle.containerScrollLeft !== null) {
                context.containerElement.scrollLeft = bundle.containerScrollLeft;
            }
        }
        catch (rollbackError) {
            console.warn('[ImageEditor] rollback: scroll restore failed', rollbackError);
        }
    }
    if (bundle.placeholderHidden !== null) {
        context.setPlaceholderVisible(!bundle.placeholderHidden);
    }
}

async function loadImageFile(context, file) {
    const inputElement = context.getInputElement();
    const mime = inferImageMimeType(file);
    if (!mime) {
        reportWarning(context.options, null, `Unsupported image file type: ${file.type || file.name || 'unknown'}.`);
        resetFileInput(inputElement);
        return;
    }
    let dataUrl;
    try {
        dataUrl = await readFileAsDataUrl(file);
    }
    catch (error) {
        reportError(context.options, error, 'Failed to read selected image file.');
        resetFileInput(inputElement);
        return;
    }
    try {
        await context.loadImage(dataUrl);
    }
    catch {
    }
    finally {
        resetFileInput(inputElement);
    }
}

const LAYOUT_EPSILON = 0.5;
const SCROLLBAR_SETTLE_EPSILON = 1;
function measureLayoutViewport(context, scrollbarSize) {
    return context.viewportCache.measure(context.containerElement, {
        width: context.options.canvasWidth,
        height: context.options.canvasHeight,
    }, scrollbarSize);
}
function getScrollbarStableViewportCanvasSize(viewport) {
    return {
        width: Math.max(1, viewport.width - 1),
        height: Math.max(1, viewport.height - 1),
    };
}
function updateCanvasSizeToImageBounds(context, options = {}) {
    var _a, _b;
    const originalImage = context.getOriginalImage();
    if (!originalImage)
        return;
    originalImage.setCoords();
    const boundingRect = originalImage.getBoundingRect();
    const scrollbarSize = measureScrollbarSize((_b = (_a = context.containerElement) === null || _a === void 0 ? void 0 : _a.ownerDocument) !== null && _b !== void 0 ? _b : null);
    const viewport = measureLayoutViewport(context, scrollbarSize);
    const shouldStabilizeContainedViewport = options.stabilizeContainedViewport !== false;
    const imageFitsViewport = boundingRect.width <= viewport.width + LAYOUT_EPSILON &&
        boundingRect.height <= viewport.height + LAYOUT_EPSILON;
    if (context.currentLayoutMode === 'fit' || context.currentLayoutMode === 'cover') {
        if (imageFitsViewport) {
            const canvasSize = shouldStabilizeContainedViewport
                ? getScrollbarStableViewportCanvasSize(viewport)
                : viewport;
            context.setCanvasSize(canvasSize.width, canvasSize.height);
            return;
        }
        const canvasSize = computeScrollableCanvasSize(boundingRect.width, boundingRect.height, viewport, scrollbarSize);
        context.setCanvasSize(canvasSize.width, canvasSize.height);
        return;
    }
    if (imageFitsViewport) {
        const canvasSize = shouldStabilizeContainedViewport
            ? getScrollbarStableViewportCanvasSize(viewport)
            : viewport;
        context.setCanvasSize(canvasSize.width, canvasSize.height);
        return;
    }
    context.setCanvasSize(Math.max(viewport.width, Math.ceil(boundingRect.width)), Math.max(viewport.height, Math.ceil(boundingRect.height)));
}
function shouldNormalizeCanvasSizeAfterStateRestore(context) {
    var _a, _b;
    const originalImage = context.getOriginalImage();
    if (!context.canvas || !originalImage)
        return false;
    originalImage.setCoords();
    const boundingRect = originalImage.getBoundingRect();
    const viewport = measureLayoutViewport(context, measureScrollbarSize((_b = (_a = context.containerElement) === null || _a === void 0 ? void 0 : _a.ownerDocument) !== null && _b !== void 0 ? _b : null));
    const canvasW = Math.ceil(context.canvas.getWidth());
    const canvasH = Math.ceil(context.canvas.getHeight());
    const clipsImage = boundingRect.width > canvasW + LAYOUT_EPSILON ||
        boundingRect.height > canvasH + LAYOUT_EPSILON;
    if (context.currentLayoutMode === 'fit' || context.currentLayoutMode === 'cover') {
        const staleOverflowWidth = canvasW > viewport.width + LAYOUT_EPSILON &&
            boundingRect.width <= viewport.width + LAYOUT_EPSILON;
        const staleOverflowHeight = canvasH > viewport.height + LAYOUT_EPSILON &&
            boundingRect.height <= viewport.height + LAYOUT_EPSILON;
        return clipsImage || staleOverflowWidth || staleOverflowHeight;
    }
    if (context.currentLayoutMode === 'expand') {
        const expectedW = Math.max(viewport.width, Math.ceil(boundingRect.width));
        const expectedH = Math.max(viewport.height, Math.ceil(boundingRect.height));
        return (Math.abs(canvasW - expectedW) > LAYOUT_EPSILON ||
            Math.abs(canvasH - expectedH) > LAYOUT_EPSILON);
    }
    return clipsImage;
}
function settleFitCoverScrollbarsAfterStateRestore(context) {
    if (!context.canvas ||
        !context.containerElement ||
        (context.currentLayoutMode !== 'fit' && context.currentLayoutMode !== 'cover')) {
        return;
    }
    const canvasW = Math.ceil(context.canvas.getWidth());
    const canvasH = Math.ceil(context.canvas.getHeight());
    if (canvasW <= 1 || canvasH <= 1)
        return;
    const clientW = Math.floor(context.containerElement.clientWidth || 0);
    const clientH = Math.floor(context.containerElement.clientHeight || 0);
    if (clientW <= 0 || clientH <= 0)
        return;
    const scrollW = Math.ceil(context.containerElement.scrollWidth || 0);
    const scrollH = Math.ceil(context.containerElement.scrollHeight || 0);
    const hasHorizontalScrollbar = scrollW > clientW + LAYOUT_EPSILON;
    const hasVerticalScrollbar = scrollH > clientH + LAYOUT_EPSILON;
    if (!hasHorizontalScrollbar && !hasVerticalScrollbar)
        return;
    const nudgeWidth = hasVerticalScrollbar && Math.abs(canvasW - clientW) <= SCROLLBAR_SETTLE_EPSILON;
    const nudgeHeight = hasHorizontalScrollbar && Math.abs(canvasH - clientH) <= SCROLLBAR_SETTLE_EPSILON;
    if (!nudgeWidth && !nudgeHeight)
        return;
    context.setCanvasSize(nudgeWidth ? canvasW - 1 : canvasW, nudgeHeight ? canvasH - 1 : canvasH);
    context.setCanvasSize(canvasW, canvasH);
}
function captureImageDisplayGeometry(context) {
    const originalImage = context.getOriginalImage();
    if (!context.canvas || !originalImage)
        return null;
    originalImage.setCoords();
    const boundingRect = originalImage.getBoundingRect();
    return {
        canvasWidth: context.canvas.getWidth(),
        canvasHeight: context.canvas.getHeight(),
        imageDisplayWidth: Math.max(1, boundingRect.width),
        imageDisplayHeight: Math.max(1, boundingRect.height),
    };
}
function restoreMergedImageDisplayGeometry(context, geometry) {
    const originalImage = context.getOriginalImage();
    if (!geometry || !context.canvas || !originalImage)
        return;
    context.setCanvasSize(geometry.canvasWidth, geometry.canvasHeight);
    const sourceW = Math.max(1, originalImage.width || geometry.imageDisplayWidth);
    const sourceH = Math.max(1, originalImage.height || geometry.imageDisplayHeight);
    const scale = Math.min(geometry.imageDisplayWidth / sourceW, geometry.imageDisplayHeight / sourceH);
    originalImage.set({
        left: 0,
        top: 0,
        angle: 0,
        scaleX: scale,
        scaleY: scale,
        originX: 'left',
        originY: 'top',
        selectable: false,
        evented: false,
        hasControls: false,
        hoverCursor: 'default',
    });
    originalImage.setCoords();
    context.canvas.sendObjectToBack(originalImage);
    context.setCurrentScale(1);
    context.setCurrentRotation(0);
    context.setBaseImageScale(scale);
    context.setLastSnapshot(context.captureSnapshot());
    context.canvas.renderAll();
}

const ANIMATION_SETTLE_GRACE_MS = 1000;
function animateProps(object, props, options, guard) {
    return new Promise((resolve, reject) => {
        const propCount = Object.keys(props).length;
        if (propCount === 0 || guard.isDisposed()) {
            resolve();
            return;
        }
        let completed = 0;
        let settled = false;
        let aborters = [];
        let timeoutId = null;
        let unregisterAborter = null;
        const cleanup = () => {
            if (timeoutId !== null) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
            unregisterAborter === null || unregisterAborter === void 0 ? void 0 : unregisterAborter();
            unregisterAborter = null;
        };
        const settle = () => {
            if (settled)
                return;
            settled = true;
            cleanup();
            resolve();
        };
        const fail = (error) => {
            if (settled)
                return;
            settled = true;
            cleanup();
            reject(error);
        };
        const abortAndSettle = () => {
            for (const abort of aborters) {
                try {
                    abort();
                }
                catch {
                }
            }
            settle();
        };
        const duration = Number.isFinite(options.duration) ? Math.max(0, options.duration) : 0;
        timeoutId = setTimeout(abortAndSettle, duration + ANIMATION_SETTLE_GRACE_MS);
        unregisterAborter = guard.registerAnimationAborter(abortAndSettle);
        try {
            const animationResult = object.animate(props, {
                duration: options.duration,
                onChange: () => {
                    var _a;
                    if (guard.isDisposed())
                        return;
                    (_a = options.onChange) === null || _a === void 0 ? void 0 : _a.call(options);
                },
                onComplete: () => {
                    if (++completed >= propCount)
                        settle();
                },
            });
            aborters = collectAnimationAborters(animationResult);
        }
        catch (error) {
            fail(error);
        }
    });
}
function collectAnimationAborters(animationResult) {
    const handles = Array.isArray(animationResult)
        ? animationResult
        : animationResult && typeof animationResult === 'object'
            ? Object.values(animationResult)
            : [animationResult];
    return handles.flatMap((handle) => {
        const abort = handle === null || handle === void 0 ? void 0 : handle.abort;
        return typeof abort === 'function' ? [() => abort.call(handle)] : [];
    });
}
function restoreOrigin(object, originX, originY) {
    try {
        object.set({ originX, originY });
        object.setCoords();
    }
    catch {
    }
}

class TransformController {
    constructor(context) {
        Object.defineProperty(this, "context", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.context = context;
    }
    async scaleImage(factor) {
        if (!Number.isFinite(factor))
            return;
        const imageObject = this.context.getOriginalImage();
        if (!imageObject)
            return;
        if (this.context.guard.isAnimating())
            return;
        if (this.context.guard.isDisposed())
            return;
        const clamped = Math.max(this.context.options.minScale, Math.min(this.context.options.maxScale, factor));
        this.context.setCurrentScale(clamped);
        const targetAbs = this.context.getBaseImageScale() * clamped;
        try {
            const topLeft = computeTopLeftPoint(imageObject);
            imageObject.set({ originX: 'left', originY: 'top' });
            imageObject.setPositionByOrigin(topLeft, 'left', 'top');
            imageObject.setCoords();
        }
        catch (error) {
            console.warn('[ImageEditor] scaleImage: origin pre-anchor failed', error);
        }
        try {
            await this.context.guard.runAnimation(() => animateProps(imageObject, { scaleX: targetAbs, scaleY: targetAbs }, {
                duration: this.context.options.animationDuration,
                onChange: () => this.context.canvas.requestRenderAll(),
            }, this.context.guard));
        }
        catch (error) {
            console.warn('[ImageEditor] scaleImage animation error', error);
            return;
        }
        if (this.context.guard.isDisposed())
            return;
        imageObject.set({ scaleX: targetAbs, scaleY: targetAbs });
        imageObject.setCoords();
        if (this.context.afterTransformSnap)
            this.context.afterTransformSnap();
        this.context.saveCanvasState();
    }
    async rotateImage(degrees) {
        if (!Number.isFinite(degrees))
            return;
        const imageObject = this.context.getOriginalImage();
        if (!imageObject)
            return;
        if (this.context.guard.isAnimating())
            return;
        if (this.context.guard.isDisposed())
            return;
        this.context.setCurrentRotation(degrees);
        try {
            const centre = imageObject.getCenterPoint();
            imageObject.set({ originX: 'center', originY: 'center' });
            imageObject.setPositionByOrigin(centre, 'center', 'center');
            imageObject.setCoords();
        }
        catch (error) {
            console.warn('[ImageEditor] rotateImage: origin pre-anchor failed', error);
        }
        let animationFailed = false;
        try {
            await this.context.guard.runAnimation(() => animateProps(imageObject, { angle: degrees }, {
                duration: this.context.options.animationDuration,
                onChange: () => this.context.canvas.requestRenderAll(),
            }, this.context.guard));
        }
        catch (error) {
            animationFailed = true;
            console.warn('[ImageEditor] rotateImage animation error', error);
        }
        finally {
            if (this.context.guard.isDisposed()) {
                restoreOrigin(imageObject, 'left', 'top');
            }
        }
        if (animationFailed)
            return;
        if (this.context.guard.isDisposed())
            return;
        imageObject.set('angle', degrees);
        imageObject.setCoords();
        if (this.context.afterTransformSnap)
            this.context.afterTransformSnap();
        try {
            const newTopLeft = computeTopLeftPoint(imageObject);
            imageObject.set({ originX: 'left', originY: 'top' });
            imageObject.setPositionByOrigin(newTopLeft, 'left', 'top');
            imageObject.setCoords();
        }
        catch (error) {
            console.warn('[ImageEditor] rotateImage: origin post-restore failed', error);
        }
        this.context.saveCanvasState();
    }
    async flipHorizontal() {
        await this.flipImage('flipX');
    }
    async flipVertical() {
        await this.flipImage('flipY');
    }
    async flipImage(property) {
        const imageObject = this.context.getOriginalImage();
        if (!imageObject)
            return;
        if (this.context.guard.isAnimating())
            return;
        if (this.context.guard.isDisposed())
            return;
        try {
            const centre = imageObject.getCenterPoint();
            imageObject.set({ originX: 'center', originY: 'center' });
            imageObject.setPositionByOrigin(centre, 'center', 'center');
            imageObject.set({ [property]: !imageObject[property] });
            imageObject.setCoords();
            const newTopLeft = computeTopLeftPoint(imageObject);
            imageObject.set({ originX: 'left', originY: 'top' });
            imageObject.setPositionByOrigin(newTopLeft, 'left', 'top');
            imageObject.setCoords();
        }
        catch (error) {
            console.warn(`[ImageEditor] ${property === 'flipX' ? 'flipHorizontal' : 'flipVertical'} failed`, error);
            return;
        }
        if (this.context.guard.isDisposed())
            return;
        if (this.context.afterTransformSnap)
            this.context.afterTransformSnap();
        this.context.saveCanvasState();
    }
    async resetImageTransform() {
        if (!this.context.getOriginalImage())
            return;
        this.context.setSuppressSaveState(true);
        try {
            await this.scaleImage(1);
            await this.rotateImage(0);
            const imageObject = this.context.getOriginalImage();
            if (imageObject && !this.context.guard.isDisposed()) {
                imageObject.set({ flipX: false, flipY: false });
                imageObject.setCoords();
                if (this.context.afterTransformSnap)
                    this.context.afterTransformSnap();
            }
        }
        finally {
            this.context.setSuppressSaveState(false);
        }
        if (this.context.guard.isDisposed())
            return;
        this.context.saveCanvasState();
    }
}
function computeTopLeftPoint(object) {
    object.setCoords();
    const coords = object.getCoords();
    const first = coords[0];
    if (first)
        return first;
    const boundingRect = object.getBoundingRect();
    return { x: boundingRect.left, y: boundingRect.top };
}

const POLYGON_AREA_EPSILON = 1e-6;
function createMaskUid(maskId) {
    return `mask-${maskId}`;
}
function isFabricObjectLike(value) {
    if (!value || typeof value !== 'object')
        return false;
    const candidate = value;
    return typeof candidate.set === 'function' && typeof candidate.on === 'function';
}
function isStyleObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function mergeMaskConfig(defaultMaskConfig, config) {
    const safeDefaultConfig = { ...defaultMaskConfig };
    const defaultStyles = safeDefaultConfig.styles;
    delete safeDefaultConfig.onCreate;
    delete safeDefaultConfig.fabricGenerator;
    delete safeDefaultConfig.styles;
    const configStyles = isStyleObject(config.styles) ? config.styles : {};
    const safeDefaultStyles = isStyleObject(defaultStyles) ? defaultStyles : {};
    return {
        ...safeDefaultConfig,
        ...config,
        styles: {
            ...safeDefaultStyles,
            ...configStyles,
        },
    };
}
function warnInvalidMask(options, reason) {
    reportWarning(options, null, `createMask skipped: ${reason}.`);
}
function isResolvableNumericInput(value) {
    if (value === undefined)
        return true;
    if (typeof value === 'number')
        return Number.isFinite(value);
    if (typeof value === 'function')
        return true;
    if (typeof value === 'string' && value.endsWith('%')) {
        return Number.isFinite(Number.parseFloat(value));
    }
    return false;
}
function isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
}
function validateFiniteField(options, fieldName, value) {
    if (isFiniteNumber(value))
        return true;
    warnInvalidMask(options, `${fieldName} must resolve to a finite number`);
    return false;
}
function validatePositiveField(options, fieldName, value) {
    if (isFiniteNumber(value) && value > 0)
        return true;
    warnInvalidMask(options, `${fieldName} must resolve to a positive number`);
    return false;
}
function validateNonNegativeField(options, fieldName, value) {
    if (isFiniteNumber(value) && value >= 0)
        return true;
    warnInvalidMask(options, `${fieldName} must resolve to a non-negative number`);
    return false;
}
function validateNumericInputs(options, config) {
    const fields = [
        ['width', config.width],
        ['height', config.height],
        ['rx', config.rx],
        ['ry', config.ry],
        ['radius', config.radius],
        ['left', config.left],
        ['top', config.top],
    ];
    for (const [fieldName, value] of fields) {
        if (!isResolvableNumericInput(value)) {
            warnInvalidMask(options, `${fieldName} is not a supported numeric value`);
            return false;
        }
    }
    return true;
}
function resolvePolygonPoints(options, points) {
    if (!Array.isArray(points) || points.length < 3) {
        warnInvalidMask(options, 'polygon masks require at least three points');
        return null;
    }
    const resolvedPoints = points.map(coercePoint);
    const allFinite = resolvedPoints.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
    if (!allFinite) {
        warnInvalidMask(options, 'polygon points must contain finite x/y values');
        return null;
    }
    if (polygonArea(resolvedPoints) <= POLYGON_AREA_EPSILON) {
        warnInvalidMask(options, 'polygon points must describe a non-zero area');
        return null;
    }
    return resolvedPoints;
}
function polygonArea(points) {
    let area = 0;
    for (let index = 0; index < points.length; index += 1) {
        const current = points[index];
        const next = points[(index + 1) % points.length];
        area += current.x * next.y - next.x * current.y;
    }
    return Math.abs(area) / 2;
}
function createMask(context, config = {}) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r;
    const { canvas, options, fabric: fabricModule } = context;
    if (!canvas)
        return null;
    const mergedConfig = mergeMaskConfig(options.defaultMaskConfig, config);
    const shapeType = (_a = mergedConfig.shape) !== null && _a !== void 0 ? _a : 'rect';
    if (!validateNumericInputs(options, mergedConfig))
        return null;
    const resolvedConfig = {
        width: options.defaultMaskWidth,
        height: options.defaultMaskHeight,
        color: 'rgba(0,0,0,0.5)',
        alpha: 0.5,
        gap: 5,
        left: undefined,
        top: undefined,
        angle: 0,
        selectable: true,
        ...mergedConfig,
        shape: shapeType,
    };
    const firstOffset = 10;
    let left;
    let top;
    const previousMask = context.getLastMask();
    if (mergedConfig.left === undefined && previousMask) {
        const previousRight = ((_b = previousMask.left) !== null && _b !== void 0 ? _b : 0) +
            (typeof previousMask.getScaledWidth === 'function'
                ? previousMask.getScaledWidth()
                : ((_c = previousMask.width) !== null && _c !== void 0 ? _c : 0) * ((_d = previousMask.scaleX) !== null && _d !== void 0 ? _d : 1));
        left = Math.round(previousRight + ((_e = resolvedConfig.gap) !== null && _e !== void 0 ? _e : 5));
        top = (_f = previousMask.top) !== null && _f !== void 0 ? _f : firstOffset;
    }
    else {
        left = resolveNumeric(mergedConfig.left, 'x', firstOffset, canvas, options);
        top = resolveNumeric(mergedConfig.top, 'y', firstOffset, canvas, options);
    }
    resolvedConfig.width = resolveNumeric(mergedConfig.width, 'x', options.defaultMaskWidth, canvas, options);
    resolvedConfig.height = resolveNumeric(mergedConfig.height, 'y', options.defaultMaskHeight, canvas, options);
    const rx = mergedConfig.rx !== undefined
        ? resolveNumeric(mergedConfig.rx, 'x', 0, canvas, options)
        : undefined;
    const ry = mergedConfig.ry !== undefined
        ? resolveNumeric(mergedConfig.ry, 'y', 0, canvas, options)
        : undefined;
    const radius = shapeType === 'circle'
        ? resolveNumeric(mergedConfig.radius, 'x', Math.min(resolvedConfig.width, resolvedConfig.height) / 2, canvas, options)
        : undefined;
    const polygonPoints = shapeType === 'polygon' ? resolvePolygonPoints(options, mergedConfig.points) : null;
    if (!validateFiniteField(options, 'left', left) ||
        !validateFiniteField(options, 'top', top) ||
        !validatePositiveField(options, 'width', resolvedConfig.width) ||
        !validatePositiveField(options, 'height', resolvedConfig.height) ||
        !validateFiniteField(options, 'gap', resolvedConfig.gap) ||
        !validateFiniteField(options, 'angle', resolvedConfig.angle) ||
        !validateFiniteField(options, 'alpha', resolvedConfig.alpha)) {
        return null;
    }
    if ((rx !== undefined && !validateNonNegativeField(options, 'rx', rx)) ||
        (ry !== undefined && !validateNonNegativeField(options, 'ry', ry)) ||
        (radius !== undefined && !validatePositiveField(options, 'radius', radius)) ||
        (shapeType === 'polygon' && polygonPoints === null)) {
        return null;
    }
    if (options.layoutMode === 'expand') {
        const requiredWidth = Math.ceil(left + resolvedConfig.width + 10);
        const requiredHeight = Math.ceil(top + resolvedConfig.height + 10);
        const nextWidth = Math.max(canvas.getWidth(), requiredWidth);
        const nextHeight = Math.max(canvas.getHeight(), requiredHeight);
        if (nextWidth !== canvas.getWidth() || nextHeight !== canvas.getHeight()) {
            if (context.expandCanvasIfNeeded) {
                context.expandCanvasIfNeeded(nextWidth, nextHeight);
            }
            else {
                canvas.setDimensions({ width: nextWidth, height: nextHeight });
            }
        }
    }
    let mask;
    if (typeof config.fabricGenerator === 'function') {
        const generated = config.fabricGenerator(resolvedConfig, canvas, options);
        if (!isFabricObjectLike(generated)) {
            reportWarning(options, generated, 'createMask skipped: fabricGenerator did not return a Fabric object.');
            return null;
        }
        mask = generated;
    }
    else {
        const originProps = {
            originX: 'left',
            originY: 'top',
        };
        switch (shapeType) {
            case 'circle':
                mask = new fabricModule.Circle({
                    left,
                    top,
                    ...originProps,
                    radius,
                    fill: resolvedConfig.color,
                    opacity: resolvedConfig.alpha,
                    angle: (_g = resolvedConfig.angle) !== null && _g !== void 0 ? _g : 0,
                    ...resolvedConfig.styles,
                });
                break;
            case 'ellipse':
                mask = new fabricModule.Ellipse({
                    left,
                    top,
                    ...originProps,
                    rx: rx !== null && rx !== void 0 ? rx : resolvedConfig.width / 2,
                    ry: ry !== null && ry !== void 0 ? ry : resolvedConfig.height / 2,
                    fill: resolvedConfig.color,
                    opacity: resolvedConfig.alpha,
                    angle: (_h = resolvedConfig.angle) !== null && _h !== void 0 ? _h : 0,
                    ...resolvedConfig.styles,
                });
                break;
            case 'polygon': {
                const polygon = new fabricModule.Polygon(polygonPoints, {
                    ...originProps,
                    fill: resolvedConfig.color,
                    opacity: resolvedConfig.alpha,
                    angle: (_j = resolvedConfig.angle) !== null && _j !== void 0 ? _j : 0,
                    ...resolvedConfig.styles,
                });
                polygon.setCoords();
                const boundingRect = polygon.getBoundingRect();
                const deltaX = left - boundingRect.left;
                const deltaY = top - boundingRect.top;
                polygon.set({
                    left: ((_k = polygon.left) !== null && _k !== void 0 ? _k : 0) + deltaX,
                    top: ((_l = polygon.top) !== null && _l !== void 0 ? _l : 0) + deltaY,
                });
                polygon.setCoords();
                mask = polygon;
                break;
            }
            case 'rect':
            default:
                mask = new fabricModule.Rect({
                    left,
                    top,
                    ...originProps,
                    width: resolvedConfig.width,
                    height: resolvedConfig.height,
                    fill: resolvedConfig.color,
                    opacity: resolvedConfig.alpha,
                    angle: (_m = resolvedConfig.angle) !== null && _m !== void 0 ? _m : 0,
                    ...(rx !== undefined ? { rx } : {}),
                    ...(ry !== undefined ? { ry } : {}),
                    ...resolvedConfig.styles,
                });
        }
    }
    const maskObject = mask;
    maskObject.selectable = 'selectable' in mergedConfig ? !!mergedConfig.selectable : true;
    maskObject.evented = 'evented' in mergedConfig ? !!mergedConfig.evented : true;
    maskObject.hasControls = 'hasControls' in mergedConfig ? !!mergedConfig.hasControls : true;
    maskObject.transparentCorners =
        'transparentCorners' in mergedConfig ? !!mergedConfig.transparentCorners : false;
    maskObject.strokeUniform =
        'strokeUniform' in mergedConfig ? !!mergedConfig.strokeUniform : true;
    maskObject.lockRotation = !options.maskRotatable;
    maskObject.borderColor = (_o = mergedConfig.borderColor) !== null && _o !== void 0 ? _o : 'red';
    maskObject.cornerColor = (_p = mergedConfig.cornerColor) !== null && _p !== void 0 ? _p : 'black';
    maskObject.cornerSize = (_q = mergedConfig.cornerSize) !== null && _q !== void 0 ? _q : 8;
    const styles = ((_r = resolvedConfig.styles) !== null && _r !== void 0 ? _r : {});
    if ('stroke' in styles) {
        maskObject.stroke = styles.stroke;
    }
    else {
        maskObject.stroke = '#ccc';
    }
    if ('strokeWidth' in styles) {
        maskObject.strokeWidth = styles.strokeWidth;
    }
    else {
        maskObject.strokeWidth = 1;
    }
    if ('strokeDashArray' in styles) {
        maskObject.strokeDashArray = styles.strokeDashArray;
    }
    const nextId = context.getMaskCounter() + 1;
    context.setMaskCounter(nextId);
    markMaskObject(maskObject, {
        maskId: nextId,
        maskUid: createMaskUid(nextId),
        maskName: `${options.maskName}${nextId}`,
        originalAlpha: resolvedConfig.alpha,
        originalStroke: maskObject.stroke,
        originalStrokeWidth: maskObject.strokeWidth,
    });
    attachMaskHoverHandlers(maskObject);
    context.setLastMask(maskObject);
    placeMaskObject(canvas, maskObject);
    context.updateMaskList();
    if (resolvedConfig.selectable !== false) {
        canvas.setActiveObject(maskObject);
    }
    canvas.renderAll();
    context.saveCanvasState();
    if (typeof config.onCreate === 'function') {
        try {
            config.onCreate(maskObject, canvas);
        }
        catch (error) {
            reportWarning(options, error, 'createMask onCreate callback threw.');
        }
    }
    return maskObject;
}
function isActiveSelectionObject(object) {
    if (!object)
        return false;
    const type = typeof object.type === 'string' ? object.type.toLowerCase() : '';
    if (type === 'activeselection')
        return true;
    const isType = object.isType;
    return (typeof isType === 'function' &&
        (isType.call(object, 'ActiveSelection') || isType.call(object, 'activeSelection')));
}
function getSelectedMaskObjects(canvas) {
    const active = canvas.getActiveObject();
    if (!active)
        return [];
    if (!isActiveSelectionObject(active))
        return isMaskObject(active) ? [active] : [];
    const getObjects = active.getObjects;
    const objects = typeof getObjects === 'function' ? getObjects.call(active) : [];
    return objects.filter(isMaskObject);
}
function removeSelectedMask(context) {
    const selectedMasks = getSelectedMaskObjects(context.canvas);
    if (selectedMasks.length === 0)
        return;
    for (const mask of selectedMasks) {
        context.removeLabelForMask(mask);
        detachMaskHoverHandlers(mask);
        context.canvas.remove(mask);
    }
    context.canvas.discardActiveObject();
    context.updateMaskList();
    context.canvas.renderAll();
    context.saveCanvasState();
}
function removeAllMasks(context, options = {}) {
    const masks = context.canvas.getObjects().filter(isMaskObject);
    if (masks.length === 0)
        return;
    for (const maskObject of masks) {
        context.removeLabelForMask(maskObject);
        detachMaskHoverHandlers(maskObject);
        context.canvas.remove(maskObject);
    }
    context.canvas.discardActiveObject();
    context.setLastMask(null);
    context.updateMaskList();
    context.canvas.renderAll();
    if (options.saveHistory !== false) {
        context.saveCanvasState();
    }
}

class EditorContextFactory {
    constructor(access) {
        Object.defineProperty(this, "access", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: access
        });
    }
    buildExportServiceContext() {
        const access = this.access;
        return {
            fabric: access.getFabric(),
            canvas: access.getLiveCanvas('export'),
            options: access.getOptions(),
            isImageLoaded: () => access.isImageLoaded(),
            getOriginalImage: () => access.getOriginalImage(),
        };
    }
    buildLoadImageContext() {
        const access = this.access;
        return {
            fabric: access.getFabric(),
            canvas: access.getLiveCanvas('loadImage'),
            options: access.getRuntimeOptions(),
            containerElement: access.getContainerElement(),
            placeholderElement: access.getPlaceholderElement(),
            viewportCache: access.getViewportCache(),
            getOriginalImage: () => access.getOriginalImage(),
            setOriginalImage: (image) => {
                access.setOriginalImage(image);
            },
            getIsImageLoadedToCanvas: () => access.getIsImageLoadedToCanvas(),
            setIsImageLoadedToCanvas: (value) => {
                access.setIsImageLoadedToCanvas(value);
            },
            getLastSnapshot: () => access.getLastSnapshot(),
            setLastSnapshot: (snapshot) => {
                access.setLastSnapshot(snapshot);
            },
            getMaskCounter: () => access.getMaskCounter(),
            setMaskCounter: (value) => {
                access.setMaskCounter(value);
            },
            getAnnotationCounter: () => access.getAnnotationCounter(),
            setAnnotationCounter: (value) => {
                access.setAnnotationCounter(value);
            },
            getCurrentScale: () => access.getCurrentScale(),
            setCurrentScale: (scale) => {
                access.setCurrentScale(scale);
            },
            getCurrentRotation: () => access.getCurrentRotation(),
            setCurrentRotation: (rotation) => {
                access.setCurrentRotation(rotation);
            },
            getBaseImageScale: () => access.getBaseImageScale(),
            setBaseImageScale: (scale) => {
                access.setBaseImageScale(scale);
            },
            getCurrentImageMimeType: () => access.getCurrentImageMimeType(),
            setCurrentImageMimeType: (mimeType) => {
                access.setCurrentImageMimeType(mimeType);
            },
            setPlaceholderVisible: (show) => {
                access.setPlaceholderVisible(show);
            },
        };
    }
    buildTransformContext() {
        const access = this.access;
        return {
            canvas: access.getLiveCanvas('buildTransformContext'),
            options: access.getOptions(),
            guard: access.getOperationGuard(),
            getOriginalImage: () => access.getOriginalImage(),
            getCurrentScale: () => access.getCurrentScale(),
            setCurrentScale: (scale) => {
                access.setCurrentScale(scale);
            },
            getCurrentRotation: () => access.getCurrentRotation(),
            setCurrentRotation: (rotation) => {
                access.setCurrentRotation(rotation);
            },
            getBaseImageScale: () => access.getBaseImageScale(),
            saveCanvasState: () => {
                access.saveCanvasStateWithAnimationBypass();
            },
            setSuppressSaveState: (suppress) => {
                access.setSuppressSaveState(suppress);
            },
            afterTransformSnap: () => {
                const canvas = access.getCanvas();
                const originalImage = access.getOriginalImage();
                if (access.isDisposed() || !canvas || !originalImage)
                    return;
                access.updateCanvasSizeToImageBounds();
                access.alignObjectBoundingBoxToCanvasTopLeft(originalImage);
                canvas
                    .getObjects()
                    .filter(isMaskObject)
                    .forEach((maskObject) => {
                    access.syncMaskLabel(maskObject);
                });
            },
        };
    }
    buildCreateMaskContext() {
        const access = this.access;
        return {
            fabric: access.getFabric(),
            canvas: access.getLiveCanvas('createMask'),
            options: access.getRuntimeOptions(),
            getLastMask: () => access.getLastMask(),
            setLastMask: (maskObject) => {
                access.setLastMask(maskObject);
            },
            getMaskCounter: () => access.getMaskCounter(),
            setMaskCounter: (value) => {
                access.setMaskCounter(value);
            },
            updateMaskList: () => {
                access.updateMaskList();
            },
            saveCanvasState: () => {
                access.saveCanvasState();
            },
            expandCanvasIfNeeded: (widthPx, heightPx) => {
                access.setCanvasSize(widthPx, heightPx);
            },
        };
    }
    buildRemoveMaskContext() {
        const access = this.access;
        return {
            canvas: access.getLiveCanvas('removeMask'),
            removeLabelForMask: (mask) => {
                access.removeLabelForMask(mask);
            },
            updateMaskList: () => {
                access.updateMaskList();
            },
            saveCanvasState: () => {
                access.saveCanvasState();
            },
            setLastMask: (maskObject) => {
                access.setLastMask(maskObject);
            },
        };
    }
    buildMaskLabelContext() {
        const canvas = this.access.getCanvas();
        if (!canvas)
            return null;
        return {
            fabric: this.access.getFabric(),
            canvas,
            options: this.access.getOptions(),
        };
    }
    buildMaskListContext() {
        const access = this.access;
        return {
            canvas: access.getCanvas(),
            getListElementId: () => access.getMaskListElementId(),
            onMaskSelected: (mask) => {
                access.handleMaskSelected(mask);
            },
        };
    }
    buildAnnotationManagerContext() {
        const access = this.access;
        return {
            canvas: access.getLiveCanvas('annotationManager'),
            saveCanvasState: () => access.saveCanvasState(),
            updateUi: () => access.updateUi(),
        };
    }
    buildAnnotationListContext() {
        const access = this.access;
        return {
            canvas: access.getCanvas(),
            getListElementId: () => access.getAnnotationListElementId(),
            onAnnotationSelected: (annotation) => {
                access.handleAnnotationSelected(annotation);
            },
        };
    }
    buildTextControllerContext() {
        const access = this.access;
        return {
            fabric: access.getFabric(),
            canvas: access.getLiveCanvas('textController'),
            options: access.getOptions(),
            getOriginalImage: () => access.getOriginalImage(),
            getTextConfig: () => access.getTextConfig(),
            isImageLoaded: () => access.isImageLoaded(),
            getAnnotationCounter: () => access.getAnnotationCounter(),
            setAnnotationCounter: (value) => {
                access.setAnnotationCounter(value);
            },
            getTextSession: () => access.getTextSession(),
            setTextSession: (session) => {
                access.setTextSession(session);
            },
            saveCanvasState: () => access.saveCanvasState(),
            updateAnnotationList: () => access.updateAnnotationList(),
            updateUi: () => access.updateUi(),
            emitAnnotationsChanged: (context) => access.emitAnnotationsChanged(context),
            emitImageChanged: (context) => access.emitImageChanged(context),
            buildCallbackContext: (operation) => access.buildCallbackContext(operation, false),
        };
    }
    buildDrawControllerContext() {
        const access = this.access;
        return {
            fabric: access.getFabric(),
            canvas: access.getLiveCanvas('drawController'),
            options: access.getOptions(),
            getDrawConfig: () => access.getDrawConfig(),
            isImageLoaded: () => access.isImageLoaded(),
            getAnnotationCounter: () => access.getAnnotationCounter(),
            setAnnotationCounter: (value) => {
                access.setAnnotationCounter(value);
            },
            getDrawSession: () => access.getDrawSession(),
            setDrawSession: (session) => {
                access.setDrawSession(session);
            },
            saveCanvasState: () => access.saveCanvasState(),
            updateAnnotationList: () => access.updateAnnotationList(),
            updateUi: () => access.updateUi(),
            emitAnnotationsChanged: (context) => access.emitAnnotationsChanged(context),
            emitImageChanged: (context) => access.emitImageChanged(context),
            buildCallbackContext: (operation) => access.buildCallbackContext(operation, false),
        };
    }
    buildMosaicControllerContext() {
        const access = this.access;
        return {
            fabric: access.getFabric(),
            canvas: access.getLiveCanvas('mosaicController'),
            options: access.getOptions(),
            historyManager: access.getHistoryManager(),
            getMosaicConfig: () => access.getMosaicConfig(),
            isImageLoaded: () => access.isImageLoaded(),
            getOriginalImage: () => access.getOriginalImage(),
            setOriginalImage: (image) => {
                access.setOriginalImage(image);
            },
            getCurrentImageMimeType: () => access.getCurrentImageMimeType(),
            setCurrentImageMimeType: (mimeType) => {
                access.setCurrentImageMimeType(mimeType);
            },
            getLastSnapshot: () => access.getLastSnapshot(),
            setLastSnapshot: (snapshot) => {
                access.setLastSnapshot(snapshot);
            },
            captureSnapshot: () => access.captureSnapshot(),
            loadFromState: (snapshot) => access.loadFromStateForOperation(undefined, snapshot),
            updateUi: () => access.updateUi(),
            updateInputs: () => access.updateInputs(),
            hideAllMaskLabels: () => access.hideAllMaskLabels(),
            emitImageChanged: (context) => {
                access.emitImageChanged(context);
            },
            emitBusyChangeIfChanged: (context) => {
                access.emitBusyChangeIfChanged(context);
            },
            buildCallbackContext: (operation, isInternal) => access.buildCallbackContext(operation, isInternal),
            getMosaicSession: () => access.getMosaicSession(),
            setMosaicSession: (session) => {
                access.setMosaicSession(session);
            },
        };
    }
    buildCropControllerContext(operationToken) {
        const access = this.access;
        return {
            fabric: access.getFabric(),
            canvas: access.getLiveCanvas('cropController'),
            options: access.getOptions(),
            historyManager: access.getHistoryManager(),
            isImageLoaded: () => access.isImageLoaded(),
            getOriginalImage: () => access.getOriginalImage(),
            getCurrentImageMimeType: () => access.getCurrentImageMimeType(),
            getCropSession: () => access.getCropSession(),
            setCropSession: (session) => {
                access.setCropSession(session);
            },
            saveState: () => access.captureSnapshot(),
            loadFromState: (snapshot) => access.loadFromStateForOperation(operationToken, snapshot),
            loadImage: (base64, providedOptions) => access.loadImageForOperation(operationToken, base64, providedOptions),
            getMaskCounter: () => access.getMaskCounter(),
            setMaskCounter: (value) => {
                access.setMaskCounter(value);
            },
            updateMaskList: () => {
                access.updateMaskList();
            },
        };
    }
    buildMergeMasksContext(operationToken) {
        const access = this.access;
        return {
            ...this.buildExportServiceContext(),
            historyManager: access.getHistoryManager(),
            containerElement: access.getContainerElement(),
            loadImage: (base64, providedOptions) => access.loadMergedImage(operationToken, base64, providedOptions),
            captureSnapshot: () => access.captureSnapshot(),
            loadFromState: (snapshot) => access.loadFromStateForOperation(operationToken, snapshot),
            exportImageBase64: (options) => exportImageBase64(this.buildExportServiceContext(), options),
            updateUi: () => access.updateUi(),
            updateInputs: () => access.updateInputs(),
            removeAllMasksNoHistory: () => {
                removeAllMasks(this.buildRemoveMaskContext(), { saveHistory: false });
            },
            getAnnotations: () => access.getAnnotations(),
            restoreAnnotations: (objects) => {
                const canvas = access.getLiveCanvas('restoreAnnotations');
                objects.forEach((annotation) => {
                    canvas.add(annotation);
                });
                syncAnnotationRuntimeStates(objects);
                attachTextEditingHandlersToAnnotations(this.buildTextControllerContext(), objects);
                access.setAnnotationCounter(Math.max(access.getAnnotationCounter(), ...objects.map((annotation) => annotation.annotationId), 0));
                access.updateAnnotationList();
            },
        };
    }
    buildMergeAnnotationsContext(operationToken) {
        const access = this.access;
        return {
            ...this.buildExportServiceContext(),
            historyManager: access.getHistoryManager(),
            containerElement: access.getContainerElement(),
            loadImage: (base64, providedOptions) => access.loadMergedImage(operationToken, base64, providedOptions),
            captureSnapshot: () => access.captureSnapshot(),
            loadFromState: (snapshot) => access.loadFromStateForOperation(operationToken, snapshot),
            exportImageBase64: (options) => exportImageBase64(this.buildExportServiceContext(), options),
            updateUi: () => access.updateUi(),
            updateInputs: () => access.updateInputs(),
            removeAllAnnotationsNoHistory: () => {
                removeAllAnnotations(this.buildAnnotationManagerContext(), {
                    saveHistory: false,
                    force: true,
                });
            },
            getMasks: () => access.getMasks(),
            restoreMasks: (objects) => {
                const canvas = access.getLiveCanvas('restoreMasks');
                objects.forEach((mask) => {
                    canvas.add(mask);
                    reattachMaskHoverHandlers(mask);
                });
                access.setLastMask(objects.reduce((lastMask, mask) => !lastMask || mask.maskId > lastMask.maskId ? mask : lastMask, null));
                access.setMaskCounter(Math.max(access.getMaskCounter(), ...objects.map((mask) => mask.maskId), 0));
                access.updateMaskList();
            },
        };
    }
}

function removeLabelForMask(context, mask) {
    if (!context.canvas || !mask.labelObject)
        return;
    try {
        if (context.canvas.getObjects().includes(mask.labelObject)) {
            context.canvas.remove(mask.labelObject);
        }
    }
    catch {
    }
    try {
        delete mask.labelObject;
    }
    catch {
    }
}
function createLabelForMask(context, mask) {
    var _a;
    const { canvas, options, fabric: fabricModule } = context;
    if (!canvas || !options.maskLabelOnSelect)
        return;
    removeLabelForMask(context, mask);
    let labelTextObject = null;
    if (typeof options.label.create === 'function') {
        try {
            labelTextObject = options.label.create(mask, fabricModule);
        }
        catch (error) {
            reportWarning(options, error, 'label.create callback threw.');
            labelTextObject = null;
        }
    }
    if (!labelTextObject) {
        const indexForGetText = mask.maskId - 1;
        let labelText = mask.maskName;
        if (typeof options.label.getText === 'function') {
            try {
                labelText = options.label.getText(mask, indexForGetText);
            }
            catch (error) {
                reportWarning(options, error, 'label.getText callback threw.');
                labelText = mask.maskName;
            }
        }
        const textOptions = {
            left: 0,
            top: 0,
            ...((_a = options.label.textOptions) !== null && _a !== void 0 ? _a : {}),
            originX: 'left',
            originY: 'top',
        };
        labelTextObject = new fabricModule.FabricText(labelText, textOptions);
    }
    markSessionObject(labelTextObject, 'maskLabel');
    labelTextObject.maskLabel = true;
    mask.labelObject = labelTextObject;
    canvas.add(labelTextObject);
    canvas.bringObjectToFront(labelTextObject);
    syncMaskLabel(context, mask);
}
function syncMaskLabel(context, mask) {
    var _a, _b, _c;
    const { canvas, options } = context;
    if (!canvas || !options.maskLabelOnSelect || !mask.labelObject)
        return;
    const coords = (_a = mask.getCoords) === null || _a === void 0 ? void 0 : _a.call(mask);
    if (!(coords === null || coords === void 0 ? void 0 : coords.length))
        return;
    const tl = coords[0];
    if (!tl)
        return;
    const center = mask.getCenterPoint();
    const vx = center.x - tl.x;
    const vy = center.y - tl.y;
    const dist = Math.sqrt(vx * vx + vy * vy) || 1;
    const offset = Math.max(0, (_b = options.maskLabelOffset) !== null && _b !== void 0 ? _b : 3);
    mask.labelObject.set({
        left: Math.round(tl.x + (vx / dist) * offset),
        top: Math.round(tl.y + (vy / dist) * offset),
        angle: (_c = mask.angle) !== null && _c !== void 0 ? _c : 0,
        originX: 'left',
        originY: 'top',
        visible: true,
    });
    mask.labelObject.setCoords();
    canvas.renderAll();
}
function showLabelForMask(context, mask) {
    if (!context.options.maskLabelOnSelect)
        return;
    if (!mask.labelObject) {
        createLabelForMask(context, mask);
    }
    if (mask.labelObject) {
        mask.labelObject.visible = true;
        syncMaskLabel(context, mask);
    }
}
function hideAllMaskLabels(context) {
    const { canvas } = context;
    if (!canvas)
        return;
    const objs = canvas.getObjects();
    objs.filter((o) => o.maskLabel).forEach((l) => {
        try {
            canvas.remove(l);
        }
        catch {
        }
    });
    objs.filter(isMaskObject).forEach((o) => {
        try {
            delete o.labelObject;
        }
        catch {
        }
    });
}

function getMaskListDocument(context) {
    var _a, _b, _c, _d, _e;
    const canvasLike = context.canvas;
    return ((_e = (_c = (_b = (_a = canvasLike === null || canvasLike === void 0 ? void 0 : canvasLike.getElement) === null || _a === void 0 ? void 0 : _a.call(canvasLike)) === null || _b === void 0 ? void 0 : _b.ownerDocument) !== null && _c !== void 0 ? _c : (_d = canvasLike === null || canvasLike === void 0 ? void 0 : canvasLike.lowerCanvasEl) === null || _d === void 0 ? void 0 : _d.ownerDocument) !== null && _e !== void 0 ? _e : document);
}
function renderMaskList(context) {
    const listId = context.getListElementId();
    if (!listId)
        return;
    const ownerDocument = getMaskListDocument(context);
    const listEl = ownerDocument.getElementById(listId);
    if (!listEl || !context.canvas)
        return;
    listEl.innerHTML = '';
    const canvas = context.canvas;
    canvas
        .getObjects()
        .filter(isMaskObject)
        .forEach((mask) => {
        const listItemElement = ownerDocument.createElement('li');
        listItemElement.className = 'list-group-item mask-item';
        listItemElement.textContent = mask.maskName;
        listItemElement.dataset.maskId = String(mask.maskId);
        listItemElement.onclick = () => {
            const id = Number(listItemElement.dataset.maskId);
            if (!Number.isFinite(id))
                return;
            const target = canvas
                .getObjects()
                .find((o) => isMaskObject(o) && o.maskId === id);
            if (!target)
                return;
            canvas.setActiveObject(target);
            context.onMaskSelected(target);
        };
        listEl.appendChild(listItemElement);
    });
}
function updateMaskListSelection(context, selectedMask) {
    const listId = context.getListElementId();
    if (!listId)
        return;
    const listEl = getMaskListDocument(context).getElementById(listId);
    if (!listEl)
        return;
    const selectedId = selectedMask ? String(selectedMask.maskId) : null;
    listEl.querySelectorAll('.mask-item').forEach((item) => {
        const isSelected = selectedId !== null && item.dataset.maskId === selectedId;
        item.classList.toggle('active', isSelected);
    });
}

class DomBindings {
    constructor(resolveElementId, isDisposed, resolveDocument = () => document) {
        Object.defineProperty(this, "registry", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "resolveElementId", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "isDisposed", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "resolveDocument", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.resolveElementId = resolveElementId;
        this.isDisposed = isDisposed;
        this.resolveDocument = resolveDocument;
    }
    bindIfExists(key, eventType, handler) {
        const id = this.resolveElementId(key);
        if (!id)
            return false;
        const element = this.resolveDocument().getElementById(id);
        if (!element)
            return false;
        const wrapped = (event) => {
            if (this.isDisposed())
                return;
            handler(event);
        };
        element.addEventListener(eventType, wrapped);
        this.registry.push({ elementKey: key, eventType, handler: wrapped });
        return true;
    }
    removeAll() {
        for (const entry of this.registry) {
            const id = this.resolveElementId(entry.elementKey);
            if (!id)
                continue;
            const element = this.resolveDocument().getElementById(id);
            if (!element)
                continue;
            try {
                element.removeEventListener(entry.eventType, entry.handler);
            }
            catch {
            }
        }
        this.registry = [];
    }
    size() {
        return this.registry.length;
    }
}

const CROP_MODE_CONTROL_KEYS = [
    'scalePercentageInput',
    'rotateLeftDegreesInput',
    'rotateRightDegreesInput',
    'rotateLeftButton',
    'rotateRightButton',
    'flipHorizontalButton',
    'flipVerticalButton',
    'createMaskButton',
    'removeSelectedMaskButton',
    'removeAllMasksButton',
    'mergeMasksButton',
    'mergeAnnotationsButton',
    'enterTextModeButton',
    'exitTextModeButton',
    'textColorInput',
    'textFontSizeInput',
    'enterDrawModeButton',
    'exitDrawModeButton',
    'drawColorInput',
    'drawBrushSizeInput',
    'removeSelectedAnnotationButton',
    'removeAllAnnotationsButton',
    'deleteSelectedObjectButton',
    'bringSelectedObjectForwardButton',
    'sendSelectedObjectBackwardButton',
    'bringSelectedObjectToFrontButton',
    'sendSelectedObjectToBackButton',
    'downloadImageButton',
    'zoomInButton',
    'zoomOutButton',
    'resetImageTransformButton',
    'undoButton',
    'redoButton',
    'imageInput',
    'enterCropModeButton',
    'cropAspectRatioSelect',
    'applyCropButton',
    'cancelCropButton',
    'enterMosaicModeButton',
    'exitMosaicModeButton',
    'mosaicBrushSizeInput',
    'mosaicBlockSizeInput',
];
const CROP_MODE_ENABLED_KEYS = [
    'cropAspectRatioSelect',
    'applyCropButton',
    'cancelCropButton',
];
const TEXT_MODE_CONTROL_KEYS = CROP_MODE_CONTROL_KEYS;
const TEXT_MODE_ENABLED_KEYS = [
    'exitTextModeButton',
    'textColorInput',
    'textFontSizeInput',
];
const DRAW_MODE_CONTROL_KEYS = CROP_MODE_CONTROL_KEYS;
const DRAW_MODE_ENABLED_KEYS = [
    'exitDrawModeButton',
    'drawColorInput',
    'drawBrushSizeInput',
];
const MOSAIC_MODE_CONTROL_KEYS = [
    'scalePercentageInput',
    'rotateLeftDegreesInput',
    'rotateRightDegreesInput',
    'rotateLeftButton',
    'rotateRightButton',
    'flipHorizontalButton',
    'flipVerticalButton',
    'createMaskButton',
    'removeSelectedMaskButton',
    'removeAllMasksButton',
    'mergeMasksButton',
    'mergeAnnotationsButton',
    'enterTextModeButton',
    'exitTextModeButton',
    'textColorInput',
    'textFontSizeInput',
    'enterDrawModeButton',
    'exitDrawModeButton',
    'drawColorInput',
    'drawBrushSizeInput',
    'removeSelectedAnnotationButton',
    'removeAllAnnotationsButton',
    'deleteSelectedObjectButton',
    'bringSelectedObjectForwardButton',
    'sendSelectedObjectBackwardButton',
    'bringSelectedObjectToFrontButton',
    'sendSelectedObjectToBackButton',
    'downloadImageButton',
    'zoomInButton',
    'zoomOutButton',
    'resetImageTransformButton',
    'undoButton',
    'redoButton',
    'imageInput',
    'enterCropModeButton',
    'cropAspectRatioSelect',
    'applyCropButton',
    'cancelCropButton',
    'enterMosaicModeButton',
    'exitMosaicModeButton',
    'mosaicBrushSizeInput',
    'mosaicBlockSizeInput',
];
const MOSAIC_MODE_ENABLED_KEYS = [
    'exitMosaicModeButton',
    'mosaicBrushSizeInput',
    'mosaicBlockSizeInput',
];
function setModeControlState(controlKeys, enabledKeys, snapshot, setEnabled) {
    controlKeys.forEach((key) => {
        setEnabled(key, !snapshot.isBusy && enabledKeys.includes(key));
    });
}
function applyEditorControlState(snapshot, setEnabled) {
    if (snapshot.isInCropMode) {
        setModeControlState(CROP_MODE_CONTROL_KEYS, CROP_MODE_ENABLED_KEYS, snapshot, setEnabled);
        return;
    }
    if (snapshot.isInTextMode) {
        setModeControlState(TEXT_MODE_CONTROL_KEYS, TEXT_MODE_ENABLED_KEYS, snapshot, setEnabled);
        return;
    }
    if (snapshot.isInDrawMode) {
        setModeControlState(DRAW_MODE_CONTROL_KEYS, DRAW_MODE_ENABLED_KEYS, snapshot, setEnabled);
        return;
    }
    if (snapshot.isInMosaicMode) {
        MOSAIC_MODE_CONTROL_KEYS.forEach((key) => {
            setEnabled(key, !snapshot.isBusy &&
                !snapshot.isMosaicApplying &&
                MOSAIC_MODE_ENABLED_KEYS.includes(key));
        });
        setEnabled('imageInput', false);
        return;
    }
    setEnabled('scalePercentageInput', snapshot.hasImage && !snapshot.isBusy);
    setEnabled('rotateLeftDegreesInput', snapshot.hasImage && !snapshot.isBusy);
    setEnabled('rotateRightDegreesInput', snapshot.hasImage && !snapshot.isBusy);
    setEnabled('zoomInButton', snapshot.hasImage && !snapshot.isBusy && snapshot.currentScale < snapshot.maxScale);
    setEnabled('zoomOutButton', snapshot.hasImage && !snapshot.isBusy && snapshot.currentScale > snapshot.minScale);
    setEnabled('rotateLeftButton', snapshot.hasImage && !snapshot.isBusy);
    setEnabled('rotateRightButton', snapshot.hasImage && !snapshot.isBusy);
    setEnabled('flipHorizontalButton', snapshot.hasImage && !snapshot.isBusy);
    setEnabled('flipVerticalButton', snapshot.hasImage && !snapshot.isBusy);
    setEnabled('createMaskButton', snapshot.hasImage && !snapshot.isBusy);
    setEnabled('removeSelectedMaskButton', snapshot.hasSelectedMask && !snapshot.isBusy);
    setEnabled('removeAllMasksButton', snapshot.hasMasks && !snapshot.isBusy);
    setEnabled('mergeMasksButton', snapshot.hasImage && snapshot.hasMasks && !snapshot.isBusy);
    setEnabled('removeSelectedAnnotationButton', snapshot.hasSelectedAnnotation && !snapshot.isBusy);
    setEnabled('removeAllAnnotationsButton', snapshot.hasAnnotations && !snapshot.isBusy);
    setEnabled('deleteSelectedObjectButton', snapshot.hasSelectedEditableObject && !snapshot.isBusy);
    setEnabled('mergeAnnotationsButton', snapshot.hasImage && snapshot.hasAnnotations && !snapshot.isBusy);
    setEnabled('bringSelectedObjectForwardButton', snapshot.hasSelectedEditableObject && !snapshot.isBusy);
    setEnabled('sendSelectedObjectBackwardButton', snapshot.hasSelectedEditableObject && !snapshot.isBusy);
    setEnabled('bringSelectedObjectToFrontButton', snapshot.hasSelectedEditableObject && !snapshot.isBusy);
    setEnabled('sendSelectedObjectToBackButton', snapshot.hasSelectedEditableObject && !snapshot.isBusy);
    setEnabled('downloadImageButton', snapshot.hasImage && !snapshot.isBusy);
    setEnabled('resetImageTransformButton', snapshot.hasImage && !snapshot.isDefaultTransform && !snapshot.isBusy);
    setEnabled('undoButton', snapshot.hasImage && !snapshot.isBusy && snapshot.canUndo);
    setEnabled('redoButton', snapshot.hasImage && !snapshot.isBusy && snapshot.canRedo);
    setEnabled('enterCropModeButton', snapshot.hasImage && !snapshot.isBusy);
    setEnabled('cropAspectRatioSelect', snapshot.hasImage && !snapshot.isBusy);
    setEnabled('enterMosaicModeButton', snapshot.hasImage && !snapshot.isBusy);
    setEnabled('enterTextModeButton', snapshot.hasImage && !snapshot.isBusy);
    setEnabled('enterDrawModeButton', snapshot.hasImage && !snapshot.isBusy);
    setEnabled('exitMosaicModeButton', false);
    setEnabled('exitTextModeButton', false);
    setEnabled('exitDrawModeButton', false);
    setEnabled('mosaicBrushSizeInput', !snapshot.isDisposed);
    setEnabled('mosaicBlockSizeInput', !snapshot.isDisposed);
    setEnabled('textColorInput', !snapshot.isDisposed);
    setEnabled('textFontSizeInput', !snapshot.isDisposed);
    setEnabled('drawColorInput', !snapshot.isDisposed);
    setEnabled('drawBrushSizeInput', !snapshot.isDisposed);
    setEnabled('imageInput', !snapshot.isBusy);
    setEnabled('applyCropButton', false);
    setEnabled('cancelCropButton', false);
}

function recordElementOriginalState(context, key, element) {
    if (!context.originalAriaDisabledMap.has(key)) {
        context.originalAriaDisabledMap.set(key, element.getAttribute('aria-disabled'));
    }
    if (!context.originalPointerEventsMap.has(key)) {
        context.originalPointerEventsMap.set(key, element.style.pointerEvents || '');
    }
    if ('disabled' in element && !context.originalDisabledMap.has(key)) {
        context.originalDisabledMap.set(key, !!element.disabled);
    }
}
function setEditorControlEnabled(context, key, isEnabled) {
    var _a;
    const controlElement = context.getElement(key);
    if (!controlElement)
        return;
    recordElementOriginalState(context, key, controlElement);
    if ('disabled' in controlElement) {
        const formControl = controlElement;
        const nextDisabled = !isEnabled;
        if (formControl.disabled !== nextDisabled)
            formControl.disabled = nextDisabled;
        return;
    }
    if (!isEnabled) {
        controlElement.setAttribute('aria-disabled', 'true');
        controlElement.style.pointerEvents = 'none';
    }
    else {
        const originalAria = context.originalAriaDisabledMap.get(key);
        if (originalAria === null || originalAria === undefined) {
            controlElement.removeAttribute('aria-disabled');
        }
        else {
            controlElement.setAttribute('aria-disabled', originalAria);
        }
        controlElement.style.pointerEvents = (_a = context.originalPointerEventsMap.get(key)) !== null && _a !== void 0 ? _a : '';
    }
}
function restoreEditorControlOriginalStates(context) {
    var _a, _b;
    for (const key of Object.keys(context.elements)) {
        const element = context.getElement(key);
        if (!element)
            continue;
        if ('disabled' in element && context.originalDisabledMap.has(key)) {
            element.disabled =
                (_a = context.originalDisabledMap.get(key)) !== null && _a !== void 0 ? _a : false;
        }
        if (context.originalAriaDisabledMap.has(key)) {
            const originalAria = context.originalAriaDisabledMap.get(key);
            if (originalAria === null || originalAria === undefined) {
                element.removeAttribute('aria-disabled');
            }
            else {
                element.setAttribute('aria-disabled', originalAria);
            }
        }
        if (context.originalPointerEventsMap.has(key)) {
            element.style.pointerEvents = (_b = context.originalPointerEventsMap.get(key)) !== null && _b !== void 0 ? _b : '';
        }
    }
    context.originalDisabledMap.clear();
    context.originalAriaDisabledMap.clear();
    context.originalPointerEventsMap.clear();
}

function bindElement(context, key, eventType, handler) {
    context.bindings.bindIfExists(key, eventType, handler);
}
function parseInputNumber(context, key) {
    return parseFloat(context.getInputValue(key));
}
function parseEventInputNumber(event) {
    return parseFloat(event.target.value);
}
function getEventInputValue(event) {
    return event.target.value;
}
function bindUploadEvents(context) {
    bindElement(context, 'uploadArea', 'click', () => {
        context.actions.openImagePicker();
    });
    bindElement(context, 'imageInput', 'change', (event) => {
        var _a;
        const file = (_a = event.target.files) === null || _a === void 0 ? void 0 : _a[0];
        if (file)
            void context.actions.loadImageFile(file);
    });
}
function bindTransformEvents(context) {
    bindElement(context, 'zoomInButton', 'click', () => {
        void context.actions.zoomIn();
    });
    bindElement(context, 'zoomOutButton', 'click', () => {
        void context.actions.zoomOut();
    });
    bindElement(context, 'resetImageTransformButton', 'click', () => {
        void context.actions.resetImageTransform();
    });
    bindElement(context, 'flipHorizontalButton', 'click', () => {
        void context.actions.flipHorizontal();
    });
    bindElement(context, 'flipVerticalButton', 'click', () => {
        void context.actions.flipVertical();
    });
    bindElement(context, 'rotateLeftButton', 'click', () => {
        const parsedStep = parseInputNumber(context, 'rotateLeftDegreesInput');
        const step = Number.isNaN(parsedStep) ? context.rotationStep : parsedStep;
        void context.actions.rotateLeft(step);
    });
    bindElement(context, 'rotateRightButton', 'click', () => {
        const parsedStep = parseInputNumber(context, 'rotateRightDegreesInput');
        const step = Number.isNaN(parsedStep) ? context.rotationStep : parsedStep;
        void context.actions.rotateRight(step);
    });
}
function bindMaskEvents(context) {
    bindElement(context, 'createMaskButton', 'click', () => {
        context.actions.createMask();
    });
    bindElement(context, 'removeSelectedMaskButton', 'click', () => {
        context.actions.removeSelectedMask();
    });
    bindElement(context, 'removeAllMasksButton', 'click', () => {
        context.actions.removeAllMasks();
    });
    bindElement(context, 'mergeMasksButton', 'click', () => {
        void context.actions.mergeMasks();
    });
}
function bindAnnotationEvents(context) {
    bindElement(context, 'mergeAnnotationsButton', 'click', () => {
        void context.actions.mergeAnnotations();
    });
    bindElement(context, 'enterTextModeButton', 'click', () => {
        context.actions.enterTextMode();
    });
    bindElement(context, 'exitTextModeButton', 'click', () => {
        context.actions.exitTextMode();
    });
    bindElement(context, 'enterDrawModeButton', 'click', () => {
        context.actions.enterDrawMode();
    });
    bindElement(context, 'exitDrawModeButton', 'click', () => {
        context.actions.exitDrawMode();
    });
    bindElement(context, 'removeSelectedAnnotationButton', 'click', () => {
        context.actions.removeSelectedAnnotation();
    });
    bindElement(context, 'removeAllAnnotationsButton', 'click', () => {
        context.actions.removeAllAnnotations();
    });
    bindElement(context, 'deleteSelectedObjectButton', 'click', () => {
        context.actions.deleteSelectedObject();
    });
    bindElement(context, 'bringSelectedObjectForwardButton', 'click', () => {
        context.actions.bringSelectedObjectForward();
    });
    bindElement(context, 'sendSelectedObjectBackwardButton', 'click', () => {
        context.actions.sendSelectedObjectBackward();
    });
    bindElement(context, 'bringSelectedObjectToFrontButton', 'click', () => {
        context.actions.bringSelectedObjectToFront();
    });
    bindElement(context, 'sendSelectedObjectToBackButton', 'click', () => {
        context.actions.sendSelectedObjectToBack();
    });
    bindStringInput(context, 'textColorInput', (value) => {
        context.actions.setTextColor(value);
    });
    bindNumberInput(context, 'textFontSizeInput', (value) => {
        context.actions.setTextFontSize(value);
    });
    bindStringInput(context, 'drawColorInput', (value) => {
        context.actions.setDrawColor(value);
    });
    bindNumberInput(context, 'drawBrushSizeInput', (value) => {
        context.actions.setDrawBrushSize(value);
    });
}
function bindHistoryEvents(context) {
    bindElement(context, 'downloadImageButton', 'click', () => {
        void context.actions.downloadImage();
    });
    bindElement(context, 'undoButton', 'click', () => {
        void context.actions.undo();
    });
    bindElement(context, 'redoButton', 'click', () => {
        void context.actions.redo();
    });
}
function bindCropEvents(context) {
    bindElement(context, 'enterCropModeButton', 'click', () => {
        context.actions.enterCropMode();
    });
    bindElement(context, 'cropAspectRatioSelect', 'change', () => {
        context.actions.updateSelectedCropAspectRatio();
    });
    bindElement(context, 'applyCropButton', 'click', () => {
        void context.actions.applyCrop().catch((error) => {
            context.actions.reportCropApplyError(error);
        });
    });
    bindElement(context, 'cancelCropButton', 'click', () => {
        context.actions.cancelCrop();
    });
}
function bindMosaicEvents(context) {
    bindElement(context, 'enterMosaicModeButton', 'click', () => {
        context.actions.enterMosaicMode();
    });
    bindElement(context, 'exitMosaicModeButton', 'click', () => {
        context.actions.exitMosaicMode();
    });
    bindNumberInput(context, 'mosaicBrushSizeInput', (value) => {
        context.actions.setMosaicBrushSize(value);
    });
    bindNumberInput(context, 'mosaicBlockSizeInput', (value) => {
        context.actions.setMosaicBlockSize(value);
    });
}
function bindStringInput(context, key, applyValue) {
    const handler = (event) => {
        applyValue(getEventInputValue(event));
    };
    bindElement(context, key, 'input', handler);
    bindElement(context, key, 'change', handler);
}
function bindNumberInput(context, key, applyValue) {
    const handler = (event) => {
        applyValue(parseEventInputNumber(event));
    };
    bindElement(context, key, 'input', handler);
    bindElement(context, key, 'change', handler);
}
function bindEditorDomEvents(context) {
    bindUploadEvents(context);
    bindTransformEvents(context);
    bindMaskEvents(context);
    bindAnnotationEvents(context);
    bindHistoryEvents(context);
    bindCropEvents(context);
    bindMosaicEvents(context);
}

function syncInputValue(inputElement, value) {
    if (!inputElement)
        return;
    const ownerDocument = inputElement.ownerDocument;
    if (ownerDocument.activeElement === inputElement && !inputElement.readOnly)
        return;
    if (inputElement.value !== value)
        inputElement.value = value;
}
function syncInput(getInputElement, key, value) {
    syncInputValue(getInputElement(key), value);
}
function applyEditorInputState(snapshot, getInputElement) {
    syncInput(getInputElement, 'scalePercentageInput', String(Math.round(snapshot.currentScale * 100)));
    syncInput(getInputElement, 'mosaicBrushSizeInput', String(snapshot.mosaicConfig.brushSize));
    syncInput(getInputElement, 'mosaicBlockSizeInput', String(snapshot.mosaicConfig.blockSize));
    syncInput(getInputElement, 'textColorInput', snapshot.textConfig.fill);
    syncInput(getInputElement, 'textFontSizeInput', String(snapshot.textConfig.fontSize));
    syncInput(getInputElement, 'drawColorInput', snapshot.drawConfig.color);
    syncInput(getInputElement, 'drawBrushSizeInput', String(snapshot.drawConfig.brushSize));
}

function setPlaceholderVisible(placeholderElement, containerElement, show) {
    if (placeholderElement) {
        placeholderElement.hidden = !show;
        placeholderElement.setAttribute('aria-hidden', show ? 'false' : 'true');
    }
    if (containerElement) {
        containerElement.hidden = show;
        containerElement.setAttribute('aria-hidden', show ? 'true' : 'false');
    }
}

const INTERNAL_OPERATION_TOKEN = Symbol('ImageEditorInternalOperation');
const INTERNAL_ALLOW_DURING_ANIMATION_QUEUE = Symbol('ImageEditorAllowDuringAnimationQueue');
const CROP_SESSION_ALLOWED_OPERATIONS = new Set(['setCropAspectRatio', 'applyCrop', 'cancelCrop']);
const MOSAIC_SESSION_ALLOWED_OPERATIONS = new Set([
    'exitMosaicMode',
    'applyMosaic',
    'setMosaicConfig',
    'resetMosaicConfig',
    'setMosaicBrushSize',
    'setMosaicBlockSize',
    'saveState',
]);
const IMAGE_EDITOR_OPERATIONS = new Set([
    'init',
    'loadImage',
    'loadFromState',
    'saveState',
    'scaleImage',
    'rotateImage',
    'flipHorizontal',
    'flipVertical',
    'resetImageTransform',
    'createMask',
    'removeSelectedMask',
    'removeAllMasks',
    'mergeMasks',
    'createTextAnnotation',
    'enterTextMode',
    'exitTextMode',
    'setTextConfig',
    'resetTextConfig',
    'setTextColor',
    'setTextFontSize',
    'enterDrawMode',
    'exitDrawMode',
    'setDrawConfig',
    'resetDrawConfig',
    'setDrawColor',
    'setDrawBrushSize',
    'updateSelectedAnnotation',
    'updateAnnotation',
    'removeSelectedAnnotation',
    'removeAllAnnotations',
    'deleteSelectedObject',
    'mergeAnnotations',
    'bringSelectedObjectForward',
    'sendSelectedObjectBackward',
    'bringSelectedObjectToFront',
    'sendSelectedObjectToBack',
    'enterCropMode',
    'setCropAspectRatio',
    'applyCrop',
    'cancelCrop',
    'enterMosaicMode',
    'exitMosaicMode',
    'applyMosaic',
    'setMosaicConfig',
    'resetMosaicConfig',
    'setMosaicBrushSize',
    'setMosaicBlockSize',
    'undo',
    'redo',
    'exportImageBase64',
    'exportImageFile',
    'downloadImage',
    'dispose',
]);
const TOOL_MODE_ALLOWED_OPERATIONS = {
    crop: CROP_SESSION_ALLOWED_OPERATIONS,
    mosaic: MOSAIC_SESSION_ALLOWED_OPERATIONS,
    text: new Set([
        'exitTextMode',
        'createTextAnnotation',
        'setTextConfig',
        'resetTextConfig',
        'setTextColor',
        'setTextFontSize',
        'saveState',
    ]),
    draw: new Set([
        'exitDrawMode',
        'setDrawConfig',
        'resetDrawConfig',
        'setDrawColor',
        'setDrawBrushSize',
        'saveState',
    ]),
};
function isImageEditorOperation(value) {
    return value !== null && IMAGE_EDITOR_OPERATIONS.has(value);
}
class ImageEditor {
    constructor(fabricModuleOrOptions = {}, options = {}) {
        var _a;
        Object.defineProperty(this, "fabricModule", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "isFabricLoaded", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "options", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "currentLayoutMode", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'expand'
        });
        Object.defineProperty(this, "defaultMosaicConfig", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "currentMosaicConfig", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "defaultTextConfig", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "currentTextConfig", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "defaultDrawConfig", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "currentDrawConfig", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "canvas", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "canvasElement", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "containerElement", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "placeholderElement", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "elements", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: {}
        });
        Object.defineProperty(this, "elementOriginalDisabledMap", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "elementOriginalAriaDisabledMap", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "elementOriginalPointerEventsMap", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "originalImage", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "baseImageScale", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 1
        });
        Object.defineProperty(this, "currentScale", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 1
        });
        Object.defineProperty(this, "currentRotation", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "isImageLoadedToCanvas", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "currentImageMimeType", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "maskCounter", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "lastMask", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "annotationCounter", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "lastSnapshot", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "historyManager", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "operationGuard", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "animQueue", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "transformController", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "contextFactory", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "viewportCache", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new ViewportCache()
        });
        Object.defineProperty(this, "cropSession", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "mosaicSession", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "textSession", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "drawSession", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "domBindings", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "keyboardDocument", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "keyboardHandler", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "isDisposed", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "shouldSuppressSaveState", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "lastEmittedIsBusy", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "activeStateRestoreOperation", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "nextSelectionChangeContext", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        const detected = detectFabric(fabricModuleOrOptions, options);
        this.fabricModule = (_a = detected.fabric) !== null && _a !== void 0 ? _a : {};
        this.isFabricLoaded = detected.isFabricLoaded;
        this.options = resolveOptions(detected.options);
        this.currentLayoutMode = this.options.layoutMode;
        this.defaultMosaicConfig = this.options.defaultMosaicConfig;
        this.currentMosaicConfig = cloneResolvedMosaicConfig(this.defaultMosaicConfig);
        this.defaultTextConfig = this.options.defaultTextConfig;
        this.currentTextConfig = cloneResolvedTextAnnotationConfig(this.defaultTextConfig);
        this.defaultDrawConfig = this.options.defaultDrawConfig;
        this.currentDrawConfig = cloneResolvedDrawConfig(this.defaultDrawConfig);
        const rawDefaultLayoutMode = detected.options
            .defaultLayoutMode;
        if (rawDefaultLayoutMode !== undefined && !isLayoutMode(rawDefaultLayoutMode)) {
            reportWarning(this.options, new TypeError(`[ImageEditor] Unsupported defaultLayoutMode ` +
                `${JSON.stringify(rawDefaultLayoutMode)}. ` +
                'Expected "fit", "cover", or "expand".'), 'Invalid defaultLayoutMode fell back to "expand".');
        }
        this.operationGuard = new OperationGuard();
        this.animQueue = new AnimationQueue();
        this.historyManager = new HistoryManager(this.options.maxHistorySize);
        this.contextFactory = this.createContextFactory();
    }
    createContextFactory() {
        return new EditorContextFactory({
            getFabric: () => this.fabricModule,
            getOptions: () => this.options,
            getRuntimeOptions: () => this.getRuntimeOptions(),
            getHistoryManager: () => this.historyManager,
            getOperationGuard: () => this.operationGuard,
            getCanvas: () => this.canvas,
            getLiveCanvas: (operationName) => this.getLiveCanvasOrThrow(operationName),
            getContainerElement: () => this.containerElement,
            getPlaceholderElement: () => this.placeholderElement,
            getViewportCache: () => this.viewportCache,
            isDisposed: () => this.isDisposed,
            isImageLoaded: () => this.isImageLoaded(),
            getOriginalImage: () => this.originalImage,
            setOriginalImage: (image) => {
                this.originalImage = image;
            },
            getIsImageLoadedToCanvas: () => this.isImageLoadedToCanvas,
            setIsImageLoadedToCanvas: (value) => {
                this.isImageLoadedToCanvas = value;
            },
            getCurrentImageMimeType: () => this.currentImageMimeType,
            setCurrentImageMimeType: (mimeType) => {
                this.currentImageMimeType = mimeType;
            },
            getLastSnapshot: () => this.lastSnapshot,
            setLastSnapshot: (snapshot) => {
                this.lastSnapshot = snapshot;
            },
            getCurrentScale: () => this.currentScale,
            setCurrentScale: (scale) => {
                this.currentScale = scale;
            },
            getCurrentRotation: () => this.currentRotation,
            setCurrentRotation: (rotation) => {
                this.currentRotation = rotation;
            },
            getBaseImageScale: () => this.baseImageScale,
            setBaseImageScale: (scale) => {
                this.baseImageScale = scale;
            },
            getMaskCounter: () => this.maskCounter,
            setMaskCounter: (value) => {
                this.maskCounter = value;
            },
            getLastMask: () => this.lastMask,
            setLastMask: (mask) => {
                this.lastMask = mask;
            },
            getAnnotationCounter: () => this.annotationCounter,
            setAnnotationCounter: (value) => {
                this.annotationCounter = value;
            },
            getTextConfig: () => this.currentTextConfig,
            getDrawConfig: () => this.currentDrawConfig,
            getMosaicConfig: () => cloneResolvedMosaicConfig(this.currentMosaicConfig),
            getTextSession: () => this.textSession,
            setTextSession: (session) => {
                this.textSession = session;
            },
            getDrawSession: () => this.drawSession,
            setDrawSession: (session) => {
                this.drawSession = session;
            },
            getMosaicSession: () => this.mosaicSession,
            setMosaicSession: (session) => {
                this.mosaicSession = session;
            },
            getCropSession: () => this.cropSession,
            setCropSession: (session) => {
                this.cropSession = session;
            },
            saveCanvasState: () => this.saveState(),
            saveCanvasStateWithAnimationBypass: () => {
                this.saveStateInternal(this.withAnimationQueueBypass());
            },
            setSuppressSaveState: (suppress) => {
                this.shouldSuppressSaveState = suppress;
            },
            captureSnapshot: () => this.captureSnapshotInternal(),
            loadImageForOperation: (operationToken, base64, providedOptions) => this.loadImageInternal(base64, this.withInternalOperationOptions(operationToken, providedOptions !== null && providedOptions !== void 0 ? providedOptions : {})),
            loadMergedImage: async (operationToken, base64, providedOptions) => {
                const geometry = this.captureImageDisplayGeometry();
                await this.loadImageInternal(base64, this.withInternalOperationOptions(operationToken, providedOptions !== null && providedOptions !== void 0 ? providedOptions : {}));
                this.restoreMergedImageDisplayGeometry(geometry);
            },
            loadFromStateForOperation: (operationToken, snapshot) => this.loadFromStateInternal(snapshot, this.withInternalOperationOptions(operationToken, this.withAnimationQueueBypass())),
            setCanvasSize: (widthPx, heightPx) => {
                this.setCanvasSizePx(widthPx, heightPx);
            },
            updateCanvasSizeToImageBounds: () => this.updateCanvasSizeToImageBounds(),
            alignObjectBoundingBoxToCanvasTopLeft: (object) => {
                this.alignObjectBoundingBoxToCanvasTopLeft(object);
            },
            syncMaskLabel: (mask) => {
                this.syncMaskLabel(mask);
            },
            removeLabelForMask: (mask) => {
                this.removeLabelForMask(mask);
            },
            hideAllMaskLabels: () => {
                this.hideAllMaskLabels();
            },
            setPlaceholderVisible: (show) => {
                setPlaceholderVisible(this.placeholderElement, this.containerElement, this.options.showPlaceholder ? show : false);
            },
            updateMaskList: () => {
                this.updateMaskList();
            },
            updateAnnotationList: () => {
                this.updateAnnotationList();
            },
            updateUi: () => {
                this.updateUi();
            },
            updateInputs: () => {
                this.updateInputs();
            },
            getMaskListElementId: () => this.elements.maskList,
            handleMaskSelected: (mask) => this.handleSelectionChanged([mask]),
            getAnnotationListElementId: () => this.elements.annotationList,
            handleAnnotationSelected: (annotation) => this.handleSelectionChanged([annotation]),
            getMasks: () => this.getMasks(),
            getAnnotations: () => this.getAnnotations(),
            emitImageChanged: (context) => {
                this.emitImageChanged(context);
            },
            emitAnnotationsChanged: (context) => {
                this.emitAnnotationsChanged(context);
            },
            emitBusyChangeIfChanged: (context) => {
                this.emitBusyChangeIfChanged(context);
            },
            buildCallbackContext: (operation, isInternalOperation) => this.buildCallbackContext(operation, isInternalOperation),
        });
    }
    init(idMap = {}) {
        if (!this.isFabricLoaded) {
            const globalFabric = globalThis.fabric;
            if (!globalFabric ||
                typeof globalFabric.Canvas !== 'function') {
                return;
            }
            this.fabricModule = globalFabric;
            this.isFabricLoaded = true;
        }
        if (this.isDisposed)
            return;
        const defaults = {
            canvas: 'canvas',
            canvasContainer: null,
            imagePlaceholder: 'imagePlaceholder',
            scalePercentageInput: 'scalePercentageInput',
            rotateLeftDegreesInput: 'rotateLeftDegreesInput',
            rotateRightDegreesInput: 'rotateRightDegreesInput',
            rotateLeftButton: 'rotateLeftButton',
            rotateRightButton: 'rotateRightButton',
            flipHorizontalButton: 'flipHorizontalButton',
            flipVerticalButton: 'flipVerticalButton',
            createMaskButton: 'createMaskButton',
            removeSelectedMaskButton: 'removeSelectedMaskButton',
            removeAllMasksButton: 'removeAllMasksButton',
            mergeMasksButton: 'mergeMasksButton',
            annotationList: 'annotationList',
            enterTextModeButton: 'enterTextModeButton',
            exitTextModeButton: 'exitTextModeButton',
            textColorInput: 'textColorInput',
            textFontSizeInput: 'textFontSizeInput',
            enterDrawModeButton: 'enterDrawModeButton',
            exitDrawModeButton: 'exitDrawModeButton',
            drawColorInput: 'drawColorInput',
            drawBrushSizeInput: 'drawBrushSizeInput',
            removeSelectedAnnotationButton: 'removeSelectedAnnotationButton',
            removeAllAnnotationsButton: 'removeAllAnnotationsButton',
            deleteSelectedObjectButton: 'deleteSelectedObjectButton',
            mergeAnnotationsButton: 'mergeAnnotationsButton',
            bringSelectedObjectForwardButton: 'bringSelectedObjectForwardButton',
            sendSelectedObjectBackwardButton: 'sendSelectedObjectBackwardButton',
            bringSelectedObjectToFrontButton: 'bringSelectedObjectToFrontButton',
            sendSelectedObjectToBackButton: 'sendSelectedObjectToBackButton',
            downloadImageButton: 'downloadImageButton',
            maskList: 'maskList',
            zoomInButton: 'zoomInButton',
            zoomOutButton: 'zoomOutButton',
            resetImageTransformButton: 'resetImageTransformButton',
            undoButton: 'undoButton',
            redoButton: 'redoButton',
            imageInput: 'imageInput',
            enterCropModeButton: 'enterCropModeButton',
            cropAspectRatioSelect: 'cropAspectRatioSelect',
            applyCropButton: 'applyCropButton',
            cancelCropButton: 'cancelCropButton',
            enterMosaicModeButton: 'enterMosaicModeButton',
            exitMosaicModeButton: 'exitMosaicModeButton',
            mosaicBrushSizeInput: 'mosaicBrushSizeInput',
            mosaicBlockSizeInput: 'mosaicBlockSizeInput',
            uploadArea: 'uploadArea',
        };
        this.elements = { ...defaults, ...idMap };
        this.initCanvas();
        this.domBindings = new DomBindings((key) => this.elements[key], () => this.isDisposed, () => { var _a, _b; return (_b = (_a = this.canvasElement) === null || _a === void 0 ? void 0 : _a.ownerDocument) !== null && _b !== void 0 ? _b : document; });
        this.transformController = new TransformController(this.buildTransformContext());
        this.bindDomEvents();
        this.updateInputs();
        this.updateMaskList();
        this.updateAnnotationList();
        this.updateUi();
        if (this.options.initialImageBase64) {
            void this.loadImage(this.options.initialImageBase64).catch(() => {
            });
        }
        else {
            this.updatePlaceholderStatus();
        }
    }
    initCanvas() {
        var _a;
        const id = this.elements.canvas;
        const canvasElement = id ? document.getElementById(id) : null;
        if (!canvasElement)
            throw new Error(`[ImageEditor] Canvas element not found: "${id}"`);
        this.canvasElement = canvasElement;
        const containerId = this.elements.canvasContainer;
        if (containerId) {
            this.containerElement =
                (_a = document.getElementById(containerId)) !== null && _a !== void 0 ? _a : canvasElement.parentElement;
        }
        else {
            this.containerElement = canvasElement.parentElement;
        }
        const placeholderId = this.elements.imagePlaceholder;
        this.placeholderElement = placeholderId ? document.getElementById(placeholderId) : null;
        let initialWidth = this.options.canvasWidth;
        let initialHeight = this.options.canvasHeight;
        if (this.containerElement) {
            const containerWidth = Math.floor(this.containerElement.clientWidth);
            const containerHeight = Math.floor(this.containerElement.clientHeight);
            if (containerWidth > 0 && containerHeight > 0) {
                initialWidth = containerWidth;
                initialHeight = containerHeight;
            }
        }
        this.canvas = new this.fabricModule.Canvas(canvasElement, {
            width: initialWidth,
            height: initialHeight,
            backgroundColor: this.options.backgroundColor,
            selection: this.options.groupSelection,
            preserveObjectStacking: true,
        });
        this.canvas.on('selection:created', (e) => {
            this.handleSelectionChanged(e.selected);
        });
        this.canvas.on('selection:updated', (e) => {
            this.handleSelectionChanged(e.selected);
        });
        this.canvas.on('selection:cleared', () => this.handleSelectionChanged([]));
        const onObjectEvent = (e) => {
            if (e.target)
                this.handleObjectMovingScalingRotating(e.target);
        };
        const onObjectModified = (e) => {
            if (e.target)
                this.handleObjectModified(e.target);
        };
        this.canvas.on('object:moving', onObjectEvent);
        this.canvas.on('object:scaling', onObjectEvent);
        this.canvas.on('object:rotating', onObjectEvent);
        this.canvas.on('object:modified', onObjectModified);
    }
    getLiveCanvasOrThrow(operationName) {
        if (this.isDisposed || !this.canvas) {
            throw new Error(`[ImageEditor] Cannot run "${operationName}" after dispose.`);
        }
        return this.canvas;
    }
    bindDomEvents() {
        var _a, _b;
        if (!this.domBindings)
            return;
        const ownerDocument = (_b = (_a = this.canvasElement) === null || _a === void 0 ? void 0 : _a.ownerDocument) !== null && _b !== void 0 ? _b : document;
        bindEditorDomEvents({
            bindings: this.domBindings,
            rotationStep: this.options.rotationStep,
            getInputValue: (key) => {
                var _a;
                const id = this.elements[key];
                const element = id
                    ? ownerDocument.getElementById(id)
                    : null;
                return (_a = element === null || element === void 0 ? void 0 : element.value) !== null && _a !== void 0 ? _a : '';
            },
            actions: {
                openImagePicker: () => {
                    var _a;
                    const inputId = this.elements.imageInput;
                    if (inputId)
                        (_a = ownerDocument.getElementById(inputId)) === null || _a === void 0 ? void 0 : _a.click();
                },
                loadImageFile: (file) => this.loadImageFile(file),
                zoomIn: () => this.scaleImage(this.currentScale + this.options.scaleStep),
                zoomOut: () => this.scaleImage(this.currentScale - this.options.scaleStep),
                resetImageTransform: () => this.resetImageTransform(),
                flipHorizontal: () => this.flipHorizontal(),
                flipVertical: () => this.flipVertical(),
                rotateLeft: (degrees) => this.rotateImage(this.currentRotation - degrees),
                rotateRight: (degrees) => this.rotateImage(this.currentRotation + degrees),
                createMask: () => {
                    this.createMask();
                },
                removeSelectedMask: () => {
                    this.removeSelectedMask();
                },
                removeAllMasks: () => {
                    this.removeAllMasks();
                },
                mergeMasks: () => this.mergeMasks(),
                mergeAnnotations: () => this.mergeAnnotations(),
                enterTextMode: () => {
                    this.enterTextMode();
                },
                exitTextMode: () => {
                    this.exitTextMode();
                },
                enterDrawMode: () => {
                    this.enterDrawMode();
                },
                exitDrawMode: () => {
                    this.exitDrawMode();
                },
                removeSelectedAnnotation: () => {
                    this.removeSelectedAnnotation();
                },
                removeAllAnnotations: () => {
                    this.removeAllAnnotations();
                },
                deleteSelectedObject: () => {
                    this.deleteSelectedObject();
                },
                bringSelectedObjectForward: () => {
                    this.bringSelectedObjectForward();
                },
                sendSelectedObjectBackward: () => {
                    this.sendSelectedObjectBackward();
                },
                bringSelectedObjectToFront: () => {
                    this.bringSelectedObjectToFront();
                },
                sendSelectedObjectToBack: () => {
                    this.sendSelectedObjectToBack();
                },
                downloadImage: () => this.downloadImage(),
                undo: () => this.undo(),
                redo: () => this.redo(),
                enterCropMode: () => {
                    this.enterCropMode({ aspectRatio: this.getSelectedCropAspectRatio() });
                },
                updateSelectedCropAspectRatio: () => {
                    if (this.cropSession)
                        this.setCropAspectRatio(this.getSelectedCropAspectRatio());
                },
                applyCrop: () => this.applyCrop(),
                reportCropApplyError: (error) => {
                    reportError(this.options, error, 'Crop apply failed.');
                },
                cancelCrop: () => {
                    this.cancelCrop();
                },
                enterMosaicMode: () => {
                    this.enterMosaicMode();
                },
                exitMosaicMode: () => {
                    this.exitMosaicMode();
                },
                setMosaicBrushSize: (size) => {
                    this.setMosaicBrushSize(size);
                },
                setMosaicBlockSize: (size) => {
                    this.setMosaicBlockSize(size);
                },
                setTextColor: (color) => {
                    this.applyTextColorInput(color);
                },
                setTextFontSize: (size) => {
                    this.applyTextFontSizeInput(size);
                },
                setDrawColor: (color) => {
                    this.applyDrawColorInput(color);
                },
                setDrawBrushSize: (size) => {
                    this.applyDrawBrushSizeInput(size);
                },
            },
        });
        this.bindKeyboardEvents();
    }
    bindKeyboardEvents() {
        var _a, _b;
        const ownerDocument = (_b = (_a = this.canvasElement) === null || _a === void 0 ? void 0 : _a.ownerDocument) !== null && _b !== void 0 ? _b : document;
        if (this.keyboardHandler && this.keyboardDocument) {
            this.keyboardDocument.removeEventListener('keydown', this.keyboardHandler);
        }
        this.keyboardDocument = ownerDocument;
        this.keyboardHandler = (event) => this.handleKeyboardEvent(event);
        ownerDocument.addEventListener('keydown', this.keyboardHandler);
    }
    isNativeTextInputActive() {
        var _a;
        const activeElement = (_a = this.keyboardDocument) === null || _a === void 0 ? void 0 : _a.activeElement;
        if (!activeElement)
            return false;
        const tagName = activeElement.tagName.toLowerCase();
        return (tagName === 'input' ||
            tagName === 'textarea' ||
            tagName === 'select' ||
            activeElement.isContentEditable === true);
    }
    isFabricTextEditingActive() {
        var _a;
        const activeObject = (_a = this.canvas) === null || _a === void 0 ? void 0 : _a.getActiveObject();
        return !!(activeObject &&
            isTextAnnotationObject(activeObject) &&
            activeObject.isEditing === true);
    }
    handleKeyboardEvent(event) {
        if (this.isDisposed)
            return;
        if (event.key === 'Delete' || event.key === 'Backspace') {
            if (this.isNativeTextInputActive() || this.isFabricTextEditingActive())
                return;
            this.deleteSelectedObject();
            return;
        }
        if (event.key !== 'Escape')
            return;
        if (this.isFabricTextEditingActive() && this.canvas) {
            finalizeActiveTextEditing(this.buildTextControllerContext(), { commit: false });
            event.preventDefault();
            return;
        }
        if (this.textSession) {
            this.exitTextMode();
        }
        else if (this.drawSession) {
            this.exitDrawMode();
        }
        else if (this.mosaicSession) {
            this.exitMosaicMode();
        }
        else if (this.cropSession) {
            this.cancelCrop();
        }
    }
    finalizeActiveTextEditingIfNeeded() {
        if (!this.canvas || !this.isFabricTextEditingActive())
            return;
        finalizeActiveTextEditing(this.buildTextControllerContext(), { commit: true });
    }
    async loadImageFile(file) {
        await loadImageFile({
            options: this.options,
            getInputElement: () => {
                const inputId = this.elements.imageInput;
                return inputId
                    ? document.getElementById(inputId)
                    : null;
            },
            loadImage: (dataUrl) => this.loadImage(dataUrl),
        }, file);
    }
    async loadImage(base64, options = {}) {
        return this.loadImageInternal(base64, options);
    }
    async loadImageInternal(base64, options = {}) {
        if (!this.isFabricLoaded || !this.canvas)
            return;
        if (this.isDisposed)
            return;
        if (!isSupportedImageDataUrl(base64))
            return;
        if (!this.canRunIdleOperation('loadImage', options))
            return;
        this.finalizeActiveTextEditingIfNeeded();
        const callbackContext = this.getOperationContext('loadImage', options);
        const previousImage = this.originalImage;
        const hadMasks = this.getMasks().length > 0;
        const hadAnnotations = this.getAnnotations().length > 0;
        this.emitOptionCallback('onImageLoadStart', [callbackContext]);
        this.operationGuard.beginLoading();
        this.emitBusyChangeIfChanged(callbackContext);
        this.updateUi();
        this.hideAllMaskLabels();
        const loadImageContext = this.contextFactory.buildLoadImageContext();
        try {
            await loadImage(loadImageContext, base64, options);
        }
        finally {
            this.operationGuard.endLoading();
            this.emitBusyChangeIfChanged(callbackContext);
            if (!this.isDisposed && this.canvas)
                this.updateUi();
        }
        this.lastMask = null;
        this.updateInputs();
        this.updateMaskList();
        this.updateAnnotationList();
        this.updateUi();
        if (previousImage && previousImage !== this.originalImage) {
            this.emitOptionCallback('onImageCleared', [previousImage, callbackContext]);
        }
        const imageInfo = this.getImageInfo();
        if (imageInfo) {
            this.emitOptionCallback('onImageLoaded', [imageInfo, callbackContext]);
        }
        if (hadMasks) {
            this.emitMasksChanged(callbackContext);
        }
        if (hadAnnotations) {
            this.emitAnnotationsChanged(callbackContext);
        }
        this.emitImageChanged(callbackContext);
    }
    getInternalOperationToken(options) {
        var _a;
        return ((_a = options === null || options === void 0 ? void 0 : options[INTERNAL_OPERATION_TOKEN]) !== null && _a !== void 0 ? _a : null);
    }
    canRunDuringAnimationQueue(options) {
        return !!(options === null || options === void 0 ? void 0 : options[INTERNAL_ALLOW_DURING_ANIMATION_QUEUE]);
    }
    withInternalOperationOptions(token, options = {}) {
        return {
            ...options,
            ...(token ? { [INTERNAL_OPERATION_TOKEN]: token } : {}),
        };
    }
    withAnimationQueueBypass(options = {}) {
        return {
            ...options,
            [INTERNAL_ALLOW_DURING_ANIMATION_QUEUE]: true,
        };
    }
    assertIdleForOperation(operationName, options) {
        const token = this.getInternalOperationToken(options);
        this.operationGuard.assertIdleForOperation(operationName, token);
        const activeToolMode = this.getActiveToolMode();
        if (activeToolMode &&
            !this.operationGuard.isOwnOperation(token) &&
            !TOOL_MODE_ALLOWED_OPERATIONS[activeToolMode].has(operationName)) {
            throw new Error(`[ImageEditor] Cannot run "${operationName}" while ${activeToolMode} mode is active.`);
        }
        if (this.animQueue.isBusy() && !this.canRunDuringAnimationQueue(options)) {
            throw new Error(`[ImageEditor] Cannot run "${operationName}" while an animation is queued.`);
        }
    }
    canRunIdleOperation(operationName, options) {
        try {
            this.assertIdleForOperation(operationName, options);
            return true;
        }
        catch (error) {
            if (!this.isExpectedIdleGuardError(error, operationName)) {
                throw error;
            }
            return false;
        }
    }
    getSelectedCropAspectRatio() {
        const inputId = this.elements.cropAspectRatioSelect;
        const inputEl = inputId
            ? document.getElementById(inputId)
            : null;
        const value = inputEl && 'value' in inputEl ? String(inputEl.value).trim() : '';
        return (value || 'free');
    }
    isExpectedIdleGuardError(error, operationName) {
        return (error instanceof Error &&
            error.message.startsWith(`[ImageEditor] Cannot run "${operationName}" `));
    }
    assertCanQueueAnimation(operationName, options) {
        const token = this.getInternalOperationToken(options);
        this.operationGuard.assertCanQueueAnimation(operationName, token);
        const activeToolMode = this.getActiveToolMode();
        if (activeToolMode &&
            !this.operationGuard.isOwnOperation(token) &&
            !TOOL_MODE_ALLOWED_OPERATIONS[activeToolMode].has(operationName)) {
            throw new Error(`[ImageEditor] Cannot run "${operationName}" while ${activeToolMode} mode is active.`);
        }
    }
    isImageLoaded() {
        var _a, _b;
        return !!(this.originalImage &&
            this.originalImage instanceof this.fabricModule.FabricImage &&
            ((_a = this.originalImage.width) !== null && _a !== void 0 ? _a : 0) > 0 &&
            ((_b = this.originalImage.height) !== null && _b !== void 0 ? _b : 0) > 0);
    }
    isBusy() {
        return this.operationGuard.isBusy() || this.animQueue.isBusy() || this.isToolModeActive();
    }
    setLayoutMode(mode) {
        if (!isLayoutMode(mode)) {
            reportWarning(this.options, new TypeError(`[ImageEditor] Unsupported layout mode ${JSON.stringify(mode)}. ` +
                'Expected "fit", "cover", or "expand".'), 'Ignored invalid layout mode.');
            return;
        }
        this.currentLayoutMode = mode;
    }
    getRuntimeOptions() {
        if (this.currentLayoutMode === this.options.layoutMode)
            return this.options;
        return Object.freeze({
            ...this.options,
            layoutMode: this.currentLayoutMode,
        });
    }
    buildCallbackContext(operation, isInternalOperation = false) {
        return { operation, isInternalOperation };
    }
    getOperationContext(fallback, options) {
        const internal = this.getInternalOperationToken(options);
        const activeOperation = this.operationGuard.activeOperationName();
        if (internal && activeOperation) {
            return this.buildCallbackContext(isImageEditorOperation(activeOperation) ? activeOperation : fallback, true);
        }
        return this.buildCallbackContext(fallback, false);
    }
    emitOptionCallback(callbackName, args) {
        const callback = this.options[callbackName];
        if (typeof callback !== 'function')
            return;
        try {
            callback(...args);
        }
        catch (error) {
            console.error(`[ImageEditor] ${callbackName} callback threw`, error);
        }
    }
    getImageInfo() {
        if (!this.canvas || !this.originalImage)
            return null;
        const canvasWidth = this.canvas.getWidth();
        const canvasHeight = this.canvas.getHeight();
        let displayWidth;
        let displayHeight;
        try {
            this.originalImage.setCoords();
            const bounds = this.originalImage.getBoundingRect();
            displayWidth = Math.max(0, Number(bounds.width) || 0);
            displayHeight = Math.max(0, Number(bounds.height) || 0);
        }
        catch {
            displayWidth = Math.max(0, (Number(this.originalImage.width) || 0) *
                Math.abs(Number(this.originalImage.scaleX) || 1));
            displayHeight = Math.max(0, (Number(this.originalImage.height) || 0) *
                Math.abs(Number(this.originalImage.scaleY) || 1));
        }
        return {
            width: Math.max(0, Number(this.originalImage.width) || 0),
            height: Math.max(0, Number(this.originalImage.height) || 0),
            displayWidth,
            displayHeight,
            scale: this.currentScale,
            rotation: this.currentRotation,
            canvasWidth,
            canvasHeight,
        };
    }
    getMasks() {
        if (!this.canvas)
            return [];
        return this.canvas.getObjects().filter(isMaskObject).slice();
    }
    getAnnotations() {
        if (!this.canvas)
            return [];
        return getAnnotations(this.canvas);
    }
    getMaskCollectionSignature() {
        return this.getMasks()
            .map((mask) => `${mask.maskId}:${mask.maskName}`)
            .join('|');
    }
    getAnnotationCollectionSignature() {
        return this.getAnnotations()
            .map((annotation) => `${annotation.annotationId}:${annotation.annotationName}`)
            .join('|');
    }
    getActiveToolMode() {
        if (this.cropSession)
            return 'crop';
        if (this.mosaicSession)
            return 'mosaic';
        if (this.textSession)
            return 'text';
        if (this.drawSession)
            return 'draw';
        return null;
    }
    isToolModeActive() {
        return this.getActiveToolMode() !== null;
    }
    getEditorState() {
        var _a, _b;
        const canvasWidth = this.canvas ? this.canvas.getWidth() : 0;
        const canvasHeight = this.canvas ? this.canvas.getHeight() : 0;
        const image = this.getImageInfo();
        return {
            hasImage: image !== null,
            image,
            maskCount: this.getMasks().length,
            annotationCount: this.getAnnotations().length,
            currentScale: this.currentScale,
            currentRotation: this.currentRotation,
            isFlippedHorizontally: !!((_a = this.originalImage) === null || _a === void 0 ? void 0 : _a.flipX),
            isFlippedVertically: !!((_b = this.originalImage) === null || _b === void 0 ? void 0 : _b.flipY),
            isBusy: this.isBusy(),
            activeToolMode: this.getActiveToolMode(),
            isCropMode: this.cropSession !== null,
            isMosaicMode: this.mosaicSession !== null,
            isTextMode: this.textSession !== null,
            isDrawMode: this.drawSession !== null,
            canUndo: this.historyManager.canUndo(),
            canRedo: this.historyManager.canRedo(),
            canvasWidth,
            canvasHeight,
        };
    }
    emitImageChanged(context) {
        this.emitOptionCallback('onImageChanged', [this.getEditorState(), context]);
    }
    emitMasksChanged(context) {
        this.emitOptionCallback('onMasksChanged', [this.getMasks(), context]);
    }
    emitAnnotationsChanged(context) {
        this.emitOptionCallback('onAnnotationsChanged', [this.getAnnotations(), context]);
    }
    emitBusyChangeIfChanged(context) {
        const isBusy = this.isBusy();
        if (this.lastEmittedIsBusy === isBusy)
            return;
        this.lastEmittedIsBusy = isBusy;
        this.emitOptionCallback('onBusyChange', [isBusy, context]);
    }
    buildSelection(selected) {
        var _a, _b;
        const selectedMasks = selected.filter(isMaskObject);
        const selectedAnnotations = selected.filter(isAnnotationObject);
        const selectedObjectKind = selectedMasks.length === 1 && selectedAnnotations.length === 0
            ? 'mask'
            : selectedAnnotations.length === 1 && selectedMasks.length === 0
                ? 'annotation'
                : null;
        return {
            selectedMask: (_a = selectedMasks[0]) !== null && _a !== void 0 ? _a : null,
            selectedMasks,
            selectedAnnotation: (_b = selectedAnnotations[0]) !== null && _b !== void 0 ? _b : null,
            selectedAnnotations,
            selectedObjectKind,
        };
    }
    withSelectionChangeContext(context, callback) {
        const previous = this.nextSelectionChangeContext;
        this.nextSelectionChangeContext = context;
        try {
            return callback();
        }
        finally {
            this.nextSelectionChangeContext = previous;
        }
    }
    isSupportedImageMimeType(mimeType) {
        return mimeType === 'image/jpeg' || mimeType === 'image/png' || mimeType === 'image/webp';
    }
    inferCurrentImageMimeType() {
        const image = this.originalImage;
        if (!image)
            return null;
        let source = null;
        try {
            if (typeof image.getSrc === 'function')
                source = image.getSrc();
            else if (typeof image.src === 'string')
                source = image.src;
        }
        catch {
            source = null;
        }
        const mimeType = source ? detectSourceMimeType(source) : null;
        return this.isSupportedImageMimeType(mimeType) ? mimeType : null;
    }
    setCanvasSizePx(widthPx, heightPx) {
        if (!this.canvas)
            return;
        applyCanvasDimensions(this.canvas, widthPx, heightPx, this.containerElement);
    }
    alignObjectBoundingBoxToCanvasTopLeft(object) {
        var _a, _b, _c;
        object.setCoords();
        const boundingRect = object.getBoundingRect();
        object.set({
            left: ((_a = object.left) !== null && _a !== void 0 ? _a : 0) - boundingRect.left,
            top: ((_b = object.top) !== null && _b !== void 0 ? _b : 0) - boundingRect.top,
        });
        object.setCoords();
        (_c = this.canvas) === null || _c === void 0 ? void 0 : _c.renderAll();
    }
    buildDisplayGeometryContext() {
        return {
            canvas: this.canvas,
            containerElement: this.containerElement,
            options: this.options,
            currentLayoutMode: this.currentLayoutMode,
            viewportCache: this.viewportCache,
            getOriginalImage: () => this.originalImage,
            setCanvasSize: (widthPx, heightPx) => {
                this.setCanvasSizePx(widthPx, heightPx);
            },
            setCurrentScale: (scale) => {
                this.currentScale = scale;
            },
            setCurrentRotation: (rotation) => {
                this.currentRotation = rotation;
            },
            setBaseImageScale: (scale) => {
                this.baseImageScale = scale;
            },
            captureSnapshot: () => this.captureSnapshotInternal(),
            setLastSnapshot: (snapshot) => {
                this.lastSnapshot = snapshot;
            },
        };
    }
    measureLayoutViewport(scrollbarSize) {
        return measureLayoutViewport(this.buildDisplayGeometryContext(), scrollbarSize);
    }
    getScrollbarStableViewportCanvasSize(viewport) {
        return getScrollbarStableViewportCanvasSize(viewport);
    }
    updateCanvasSizeToImageBounds(options = {}) {
        updateCanvasSizeToImageBounds(this.buildDisplayGeometryContext(), options);
    }
    shouldNormalizeCanvasSizeAfterStateRestore() {
        return shouldNormalizeCanvasSizeAfterStateRestore(this.buildDisplayGeometryContext());
    }
    settleFitCoverScrollbarsAfterStateRestore() {
        settleFitCoverScrollbarsAfterStateRestore(this.buildDisplayGeometryContext());
    }
    captureImageDisplayGeometry() {
        return captureImageDisplayGeometry(this.buildDisplayGeometryContext());
    }
    restoreMergedImageDisplayGeometry(geometry) {
        restoreMergedImageDisplayGeometry(this.buildDisplayGeometryContext(), geometry);
    }
    buildTransformContext() {
        return this.contextFactory.buildTransformContext();
    }
    scaleImage(factor) {
        if (this.isDisposed || !this.transformController)
            return Promise.resolve();
        if (!Number.isFinite(factor))
            return Promise.resolve();
        try {
            this.assertCanQueueAnimation('scaleImage');
        }
        catch (error) {
            return Promise.reject(error);
        }
        const controller = this.transformController;
        const context = this.buildCallbackContext('scaleImage', false);
        const job = this.animQueue.add(async () => {
            if (this.isDisposed)
                return;
            this.updateUi();
            try {
                await controller.scaleImage(factor);
                if (!this.isDisposed)
                    this.emitImageChanged(context);
            }
            finally {
                if (!this.isDisposed) {
                    this.updateInputs();
                }
            }
        });
        this.emitBusyChangeIfChanged(context);
        return job.finally(() => {
            this.refreshUiAfterQueuedAnimation();
            this.emitBusyChangeIfChanged(context);
        });
    }
    rotateImage(degrees) {
        if (this.isDisposed || !this.transformController)
            return Promise.resolve();
        if (!Number.isFinite(degrees))
            return Promise.resolve();
        try {
            this.assertCanQueueAnimation('rotateImage');
        }
        catch (error) {
            return Promise.reject(error);
        }
        const controller = this.transformController;
        const context = this.buildCallbackContext('rotateImage', false);
        const job = this.animQueue.add(async () => {
            if (this.isDisposed)
                return;
            this.updateUi();
            try {
                await controller.rotateImage(degrees);
                if (!this.isDisposed)
                    this.emitImageChanged(context);
            }
            finally {
                if (!this.isDisposed) {
                    this.updateInputs();
                }
            }
        });
        this.emitBusyChangeIfChanged(context);
        return job.finally(() => {
            this.refreshUiAfterQueuedAnimation();
            this.emitBusyChangeIfChanged(context);
        });
    }
    flipHorizontal() {
        if (this.isDisposed || !this.transformController)
            return Promise.resolve();
        try {
            this.assertCanQueueAnimation('flipHorizontal');
        }
        catch (error) {
            return Promise.reject(error);
        }
        const controller = this.transformController;
        const context = this.buildCallbackContext('flipHorizontal', false);
        const job = this.animQueue.add(async () => {
            if (this.isDisposed)
                return;
            this.updateUi();
            try {
                await controller.flipHorizontal();
                if (!this.isDisposed)
                    this.emitImageChanged(context);
            }
            finally {
                if (!this.isDisposed) {
                    this.updateInputs();
                }
            }
        });
        this.emitBusyChangeIfChanged(context);
        return job.finally(() => {
            this.refreshUiAfterQueuedAnimation();
            this.emitBusyChangeIfChanged(context);
        });
    }
    flipVertical() {
        if (this.isDisposed || !this.transformController)
            return Promise.resolve();
        try {
            this.assertCanQueueAnimation('flipVertical');
        }
        catch (error) {
            return Promise.reject(error);
        }
        const controller = this.transformController;
        const context = this.buildCallbackContext('flipVertical', false);
        const job = this.animQueue.add(async () => {
            if (this.isDisposed)
                return;
            this.updateUi();
            try {
                await controller.flipVertical();
                if (!this.isDisposed)
                    this.emitImageChanged(context);
            }
            finally {
                if (!this.isDisposed) {
                    this.updateInputs();
                }
            }
        });
        this.emitBusyChangeIfChanged(context);
        return job.finally(() => {
            this.refreshUiAfterQueuedAnimation();
            this.emitBusyChangeIfChanged(context);
        });
    }
    resetImageTransform() {
        if (this.isDisposed || !this.transformController)
            return Promise.resolve();
        try {
            this.assertCanQueueAnimation('resetImageTransform');
        }
        catch (error) {
            return Promise.reject(error);
        }
        const controller = this.transformController;
        const context = this.buildCallbackContext('resetImageTransform', false);
        const job = this.animQueue.add(async () => {
            if (this.isDisposed)
                return;
            this.updateUi();
            try {
                await controller.resetImageTransform();
                if (!this.isDisposed)
                    this.emitImageChanged(context);
            }
            finally {
                if (!this.isDisposed) {
                    this.updateInputs();
                }
            }
        });
        this.emitBusyChangeIfChanged(context);
        return job.finally(() => {
            this.refreshUiAfterQueuedAnimation();
            this.emitBusyChangeIfChanged(context);
        });
    }
    refreshUiAfterQueuedAnimation() {
        if (this.isDisposed || !this.canvas)
            return;
        this.updateInputs();
        this.updateUi();
    }
    async loadFromState(jsonString) {
        return this.loadFromStateInternal(jsonString);
    }
    async loadFromStateInternal(jsonString, options) {
        var _a;
        if (!jsonString || !this.canvas)
            return;
        if (this.isDisposed)
            return;
        if (!this.canRunIdleOperation('loadFromState', options))
            return;
        const activeRestoreOperation = this.activeStateRestoreOperation;
        const context = this.buildCallbackContext(activeRestoreOperation !== null && activeRestoreOperation !== void 0 ? activeRestoreOperation : 'loadFromState', activeRestoreOperation === 'undo' || activeRestoreOperation === 'redo');
        const previousImage = this.originalImage;
        const previousMaskSignature = this.getMaskCollectionSignature();
        const previousAnnotationSignature = this.getAnnotationCollectionSignature();
        try {
            const restoredState = await loadFromState({
                canvas: this.canvas,
                jsonString,
                setCanvasSize: (widthPx, heightPx) => this.setCanvasSizePx(widthPx, heightPx),
            });
            if (this.isDisposed || !this.canvas)
                return;
            this.hideAllMaskLabels();
            this.originalImage = restoredState.originalImage;
            if (this.originalImage) {
                this.originalImage.set({
                    originX: 'left',
                    originY: 'top',
                    selectable: false,
                    evented: false,
                    hasControls: false,
                    hoverCursor: 'default',
                });
                this.canvas.sendObjectToBack(this.originalImage);
            }
            this.maskCounter = restoredState.maxMaskId;
            this.annotationCounter = restoredState.maxAnnotationId;
            const editorState = restoredState.editorState;
            if (editorState) {
                this.currentScale = editorState.currentScale;
                this.currentRotation = editorState.currentRotation;
                this.baseImageScale = editorState.baseImageScale;
            }
            if (this.originalImage) {
                this.currentImageMimeType =
                    editorState && 'currentImageMimeType' in editorState
                        ? ((_a = editorState.currentImageMimeType) !== null && _a !== void 0 ? _a : null)
                        : this.inferCurrentImageMimeType();
            }
            else {
                this.currentImageMimeType = null;
            }
            this.isImageLoadedToCanvas = !!this.originalImage;
            if (this.originalImage && this.shouldNormalizeCanvasSizeAfterStateRestore()) {
                this.updateCanvasSizeToImageBounds({ stabilizeContainedViewport: false });
                this.alignObjectBoundingBoxToCanvasTopLeft(this.originalImage);
            }
            if (this.originalImage) {
                this.settleFitCoverScrollbarsAfterStateRestore();
            }
            const restoredMasks = restoredState.masks;
            this.lastMask = restoredMasks.reduce((lastMask, maskObject) => !lastMask || maskObject.maskId > lastMask.maskId ? maskObject : lastMask, null);
            restoredMasks.forEach((maskObject) => {
                applyMaskUnselectedStyle(maskObject);
                reattachMaskHoverHandlers(maskObject);
            });
            syncAnnotationRuntimeStates(restoredState.annotations);
            attachTextEditingHandlersToAnnotations(this.buildTextControllerContext(), restoredState.annotations);
            this.lastSnapshot = this.captureSnapshotInternal();
            this.canvas.renderAll();
            this.updateInputs();
            this.updateMaskList();
            this.updateAnnotationList();
            this.updateUi();
            if (previousImage && previousImage !== this.originalImage) {
                this.emitOptionCallback('onImageCleared', [previousImage, context]);
            }
            if (previousMaskSignature !== this.getMaskCollectionSignature()) {
                this.emitMasksChanged(context);
            }
            if (previousAnnotationSignature !== this.getAnnotationCollectionSignature()) {
                this.emitAnnotationsChanged(context);
            }
            this.emitImageChanged(context);
            const canvas = this.getLiveCanvasOrThrow('loadFromState');
            const activeMaskId = editorState === null || editorState === void 0 ? void 0 : editorState.activeMaskId;
            const activeAnnotationId = editorState === null || editorState === void 0 ? void 0 : editorState.activeAnnotationId;
            if ((editorState === null || editorState === void 0 ? void 0 : editorState.activeObjectKind) === 'mask' && typeof activeMaskId === 'number') {
                const activeMask = restoredMasks.find((maskObject) => maskObject.maskId === activeMaskId);
                if (activeMask) {
                    this.withSelectionChangeContext(context, () => {
                        canvas.setActiveObject(activeMask);
                        this.handleSelectionChanged([activeMask]);
                    });
                }
            }
            else if ((editorState === null || editorState === void 0 ? void 0 : editorState.activeObjectKind) === 'annotation' &&
                typeof activeAnnotationId === 'number') {
                const activeAnnotation = restoredState.annotations.find((annotation) => annotation.annotationId === activeAnnotationId);
                if (activeAnnotation) {
                    this.withSelectionChangeContext(context, () => {
                        canvas.setActiveObject(activeAnnotation);
                        this.handleSelectionChanged([activeAnnotation]);
                    });
                }
            }
        }
        catch (error) {
            reportError(this.options, error, 'Failed to restore canvas state.');
            throw error;
        }
    }
    saveState() {
        this.saveStateInternal();
    }
    saveStateInternal(options) {
        var _a, _b, _c;
        if (!this.canvas || this.shouldSuppressSaveState)
            return;
        if (!this.canRunIdleOperation('saveState', options))
            return;
        const activeObj = this.canvas.getActiveObject();
        const activeMask = this.getActiveMaskForSnapshot();
        const activeAnnotation = this.getActiveAnnotationForSnapshot();
        this.hideAllMaskLabels();
        try {
            const after = saveState({
                canvas: this.canvas,
                activeMaskId: (_a = activeMask === null || activeMask === void 0 ? void 0 : activeMask.maskId) !== null && _a !== void 0 ? _a : null,
                activeAnnotationId: (_b = activeAnnotation === null || activeAnnotation === void 0 ? void 0 : activeAnnotation.annotationId) !== null && _b !== void 0 ? _b : null,
                currentScale: this.currentScale,
                currentRotation: this.currentRotation,
                baseImageScale: this.baseImageScale,
                currentImageMimeType: this.currentImageMimeType,
            });
            const before = (_c = this.lastSnapshot) !== null && _c !== void 0 ? _c : after;
            if (after === before) {
                return;
            }
            const cmd = new Command(async () => {
                await this.loadFromStateInternal(after, this.withAnimationQueueBypass());
            }, async () => {
                await this.loadFromStateInternal(before, this.withAnimationQueueBypass());
            });
            this.historyManager.push(cmd);
            this.lastSnapshot = after;
        }
        catch (error) {
            reportWarning(this.options, error, 'Failed to capture canvas snapshot.');
        }
        finally {
            this.restoreActiveObjectAfterSnapshot(activeObj, activeMask, activeAnnotation);
            this.updateUi();
        }
    }
    restoreActiveObjectAfterSnapshot(activeObj, activeMask, activeAnnotation) {
        if (!this.canvas)
            return;
        const maskToRestore = activeObj && isMaskObject(activeObj) ? activeObj : activeMask;
        const annotationToRestore = activeObj && isAnnotationObject(activeObj) ? activeObj : activeAnnotation;
        if (maskToRestore && this.canvas.getObjects().includes(maskToRestore)) {
            this.canvas.setActiveObject(maskToRestore);
            this.showLabelForMask(maskToRestore);
            this.updateMaskListSelection(maskToRestore);
            return;
        }
        if (annotationToRestore && this.canvas.getObjects().includes(annotationToRestore)) {
            this.canvas.setActiveObject(annotationToRestore);
            this.updateAnnotationListSelection(annotationToRestore);
        }
    }
    undo() {
        if (this.isDisposed)
            return Promise.resolve();
        if (!this.canRunIdleOperation('undo'))
            return Promise.resolve();
        this.finalizeActiveTextEditingIfNeeded();
        const context = this.buildCallbackContext('undo', true);
        const job = this.animQueue.add(async () => {
            if (this.isDisposed)
                return;
            this.activeStateRestoreOperation = 'undo';
            try {
                await this.historyManager.undo();
            }
            finally {
                this.activeStateRestoreOperation = null;
            }
        });
        this.emitBusyChangeIfChanged(context);
        return job.finally(() => {
            this.refreshUiAfterQueuedAnimation();
            this.emitBusyChangeIfChanged(context);
        });
    }
    redo() {
        if (this.isDisposed)
            return Promise.resolve();
        if (!this.canRunIdleOperation('redo'))
            return Promise.resolve();
        this.finalizeActiveTextEditingIfNeeded();
        const context = this.buildCallbackContext('redo', true);
        const job = this.animQueue.add(async () => {
            if (this.isDisposed)
                return;
            this.activeStateRestoreOperation = 'redo';
            try {
                await this.historyManager.redo();
            }
            finally {
                this.activeStateRestoreOperation = null;
            }
        });
        this.emitBusyChangeIfChanged(context);
        return job.finally(() => {
            this.refreshUiAfterQueuedAnimation();
            this.emitBusyChangeIfChanged(context);
        });
    }
    createMask(config = {}) {
        if (!this.canvas)
            return null;
        if (!this.canRunIdleOperation('createMask'))
            return null;
        const callbackContext = this.buildCallbackContext('createMask', false);
        const createMaskContext = this.buildCreateMaskContext();
        const mask = this.withSelectionChangeContext(callbackContext, () => createMask(createMaskContext, config));
        if (mask) {
            this.emitMasksChanged(callbackContext);
            this.emitImageChanged(callbackContext);
        }
        return mask;
    }
    removeSelectedMask() {
        if (!this.canvas)
            return;
        if (!this.canRunIdleOperation('removeSelectedMask'))
            return;
        const before = this.getMasks().length;
        const callbackContext = this.buildCallbackContext('removeSelectedMask', false);
        const removeMaskContext = this.buildRemoveMaskContext();
        this.withSelectionChangeContext(callbackContext, () => removeSelectedMask(removeMaskContext));
        this.updateUi();
        if (this.getMasks().length !== before) {
            this.emitMasksChanged(callbackContext);
            this.emitImageChanged(callbackContext);
        }
    }
    removeAllMasks(options = {}) {
        if (!this.canvas)
            return;
        if (!this.canRunIdleOperation('removeAllMasks', options))
            return;
        const before = this.getMasks().length;
        const callbackContext = this.buildCallbackContext('removeAllMasks', false);
        const removeMaskContext = this.buildRemoveMaskContext();
        this.withSelectionChangeContext(callbackContext, () => removeAllMasks(removeMaskContext, options));
        this.updateUi();
        if (this.getMasks().length !== before) {
            this.emitMasksChanged(callbackContext);
            this.emitImageChanged(callbackContext);
        }
    }
    buildCreateMaskContext() {
        return this.contextFactory.buildCreateMaskContext();
    }
    buildRemoveMaskContext() {
        return this.contextFactory.buildRemoveMaskContext();
    }
    buildMaskLabelContext() {
        return this.contextFactory.buildMaskLabelContext();
    }
    removeLabelForMask(mask) {
        const context = this.buildMaskLabelContext();
        if (!context)
            return;
        removeLabelForMask(context, mask);
    }
    createLabelForMask(mask) {
        const context = this.buildMaskLabelContext();
        if (!context)
            return;
        createLabelForMask(context, mask);
    }
    hideAllMaskLabels() {
        const context = this.buildMaskLabelContext();
        if (!context)
            return;
        hideAllMaskLabels(context);
    }
    syncMaskLabel(mask) {
        const context = this.buildMaskLabelContext();
        if (!context)
            return;
        syncMaskLabel(context, mask);
    }
    showLabelForMask(mask) {
        const context = this.buildMaskLabelContext();
        if (!context)
            return;
        showLabelForMask(context, mask);
    }
    handleObjectMovingScalingRotating(target) {
        if (isMaskObject(target)) {
            this.syncMaskLabel(target);
        }
    }
    handleObjectModified(target) {
        if (isMaskObject(target)) {
            this.syncMaskLabel(target);
            const context = this.buildCallbackContext('saveState', false);
            this.saveState();
            this.emitMasksChanged(context);
            this.emitImageChanged(context);
            return;
        }
        if (isAnnotationObject(target)) {
            if (isAnnotationLocked(target))
                return;
            const context = this.buildCallbackContext('updateAnnotation', false);
            this.saveState();
            this.emitAnnotationsChanged(context);
            this.emitImageChanged(context);
        }
    }
    handleSelectionChanged(selected) {
        var _a, _b, _c, _d;
        if (!this.canvas)
            return;
        const selectedMask = (_a = selected.find(isMaskObject)) !== null && _a !== void 0 ? _a : null;
        const selectedAnnotation = (_b = selected.find(isAnnotationObject)) !== null && _b !== void 0 ? _b : null;
        const masks = this.canvas.getObjects().filter(isMaskObject);
        masks.forEach((maskObject) => {
            if (maskObject !== selectedMask) {
                if (maskObject.labelObject) {
                    this.removeLabelForMask(maskObject);
                }
                applyMaskUnselectedStyle(maskObject);
            }
            else {
                applyMaskSelectedStyle(maskObject);
            }
        });
        if (selectedMask)
            this.showLabelForMask(selectedMask);
        this.updateMaskListSelection(selectedMask);
        this.updateAnnotationListSelection(selectedAnnotation);
        this.canvas.requestRenderAll();
        this.updateUi();
        const context = (_c = this.nextSelectionChangeContext) !== null && _c !== void 0 ? _c : this.buildCallbackContext((_d = this.activeStateRestoreOperation) !== null && _d !== void 0 ? _d : 'createMask', this.activeStateRestoreOperation === 'undo' ||
            this.activeStateRestoreOperation === 'redo');
        this.emitOptionCallback('onSelectionChange', [this.buildSelection(selected), context]);
    }
    buildMaskListContext() {
        return this.contextFactory.buildMaskListContext();
    }
    updateMaskList() {
        renderMaskList(this.buildMaskListContext());
    }
    updateMaskListSelection(selectedMask) {
        updateMaskListSelection(this.buildMaskListContext(), selectedMask);
    }
    enterTextMode() {
        if (!this.canvas)
            return;
        if (!this.canRunIdleOperation('enterTextMode'))
            return;
        if (this.isToolModeActive())
            return;
        enterTextMode(this.buildTextControllerContext());
        const callbackContext = this.buildCallbackContext('enterTextMode', false);
        this.emitBusyChangeIfChanged(callbackContext);
        this.emitImageChanged(callbackContext);
    }
    exitTextMode() {
        if (!this.canvas || !this.textSession)
            return;
        if (!this.canRunIdleOperation('exitTextMode'))
            return;
        exitTextMode(this.buildTextControllerContext());
        const callbackContext = this.buildCallbackContext('exitTextMode', false);
        this.emitBusyChangeIfChanged(callbackContext);
        this.emitImageChanged(callbackContext);
    }
    isTextMode() {
        return this.textSession !== null;
    }
    createTextAnnotation(config = {}) {
        if (!this.canvas)
            return null;
        if (!this.canRunIdleOperation('createTextAnnotation'))
            return null;
        return createTextAnnotation(this.buildTextControllerContext(), config);
    }
    enterDrawMode() {
        if (!this.canvas)
            return;
        if (!this.canRunIdleOperation('enterDrawMode'))
            return;
        if (this.isToolModeActive())
            return;
        enterDrawMode(this.buildDrawControllerContext());
        const callbackContext = this.buildCallbackContext('enterDrawMode', false);
        this.emitBusyChangeIfChanged(callbackContext);
        this.emitImageChanged(callbackContext);
    }
    exitDrawMode() {
        if (!this.canvas || !this.drawSession)
            return;
        if (!this.canRunIdleOperation('exitDrawMode'))
            return;
        exitDrawMode(this.buildDrawControllerContext());
        const callbackContext = this.buildCallbackContext('exitDrawMode', false);
        this.emitBusyChangeIfChanged(callbackContext);
        this.emitImageChanged(callbackContext);
    }
    isDrawMode() {
        return this.drawSession !== null;
    }
    getTextConfig() {
        return cloneResolvedTextAnnotationConfig(this.currentTextConfig);
    }
    setTextConfig(config) {
        this.applyTextConfigPatch(config, 'setTextConfig');
    }
    resetTextConfig() {
        this.applyTextConfigPatch(this.defaultTextConfig, 'resetTextConfig');
    }
    setTextColor(color) {
        this.applyTextConfigPatch({ fill: color }, 'setTextColor');
    }
    setTextFontSize(size) {
        this.applyTextConfigPatch({ fontSize: size }, 'setTextFontSize');
    }
    getDrawConfig() {
        return cloneResolvedDrawConfig(this.currentDrawConfig);
    }
    setDrawConfig(config) {
        this.applyDrawConfigPatch(config, 'setDrawConfig');
    }
    resetDrawConfig() {
        this.applyDrawConfigPatch(this.defaultDrawConfig, 'resetDrawConfig');
    }
    setDrawColor(color) {
        this.applyDrawConfigPatch({ color }, 'setDrawColor');
    }
    setDrawBrushSize(size) {
        this.applyDrawConfigPatch({ brushSize: size }, 'setDrawBrushSize');
    }
    removeSelectedAnnotation() {
        if (!this.canvas)
            return;
        if (!this.canRunIdleOperation('removeSelectedAnnotation'))
            return;
        const before = this.getAnnotations().length;
        const callbackContext = this.buildCallbackContext('removeSelectedAnnotation', false);
        this.withSelectionChangeContext(callbackContext, () => {
            removeSelectedAnnotation(this.buildAnnotationManagerContext());
        });
        this.updateAnnotationList();
        this.updateUi();
        if (this.getAnnotations().length !== before) {
            this.emitAnnotationsChanged(callbackContext);
            this.emitImageChanged(callbackContext);
        }
    }
    removeAllAnnotations(options = {}) {
        if (!this.canvas)
            return;
        if (!this.canRunIdleOperation('removeAllAnnotations', options))
            return;
        const before = this.getAnnotations().length;
        const callbackContext = this.buildCallbackContext('removeAllAnnotations', false);
        this.withSelectionChangeContext(callbackContext, () => {
            removeAllAnnotations(this.buildAnnotationManagerContext(), options);
        });
        this.updateAnnotationList();
        this.updateUi();
        if (this.getAnnotations().length !== before) {
            this.emitAnnotationsChanged(callbackContext);
            this.emitImageChanged(callbackContext);
        }
    }
    updateAnnotation(annotationId, config) {
        if (!this.canvas)
            return;
        if (!this.canRunIdleOperation('updateAnnotation'))
            return;
        const callbackContext = this.buildCallbackContext('updateAnnotation', false);
        const changed = updateAnnotation(this.buildAnnotationManagerContext(), annotationId, config);
        if (changed) {
            this.updateAnnotationList();
            this.emitAnnotationsChanged(callbackContext);
            this.emitImageChanged(callbackContext);
        }
    }
    updateSelectedAnnotation(config) {
        if (!this.canvas)
            return;
        if (!this.canRunIdleOperation('updateSelectedAnnotation'))
            return;
        const callbackContext = this.buildCallbackContext('updateSelectedAnnotation', false);
        const changed = updateSelectedAnnotation(this.buildAnnotationManagerContext(), config);
        if (changed) {
            this.updateAnnotationList();
            this.emitAnnotationsChanged(callbackContext);
            this.emitImageChanged(callbackContext);
        }
    }
    deleteSelectedObject() {
        if (!this.canvas)
            return;
        if (!this.canRunIdleOperation('deleteSelectedObject'))
            return;
        this.finalizeActiveTextEditingIfNeeded();
        const selectedObjects = this.getSelectedCanvasObjects();
        const selectedMasks = selectedObjects.filter(isMaskObject);
        const selectedAnnotations = selectedObjects.filter((object) => isAnnotationObject(object) && isAnnotationUnlocked(object));
        if (selectedMasks.length === 0 && selectedAnnotations.length === 0)
            return;
        const canvas = this.getLiveCanvasOrThrow('deleteSelectedObject');
        const callbackContext = this.buildCallbackContext('deleteSelectedObject', false);
        this.withSelectionChangeContext(callbackContext, () => {
            for (const mask of selectedMasks) {
                this.removeLabelForMask(mask);
                canvas.remove(mask);
            }
            removeAnnotationObjects(this.buildAnnotationManagerContext(), selectedAnnotations, {
                saveHistory: false,
                force: true,
            });
            canvas.discardActiveObject();
            canvas.renderAll();
            this.saveState();
        });
        this.updateMaskList();
        this.updateAnnotationList();
        this.updateUi();
        if (selectedMasks.length > 0)
            this.emitMasksChanged(callbackContext);
        if (selectedAnnotations.length > 0)
            this.emitAnnotationsChanged(callbackContext);
        this.emitImageChanged(callbackContext);
    }
    bringSelectedObjectForward() {
        this.moveSelectedEditableObject('bringSelectedObjectForward');
    }
    sendSelectedObjectBackward() {
        this.moveSelectedEditableObject('sendSelectedObjectBackward');
    }
    bringSelectedObjectToFront() {
        this.moveSelectedEditableObject('bringSelectedObjectToFront');
    }
    sendSelectedObjectToBack() {
        this.moveSelectedEditableObject('sendSelectedObjectToBack');
    }
    buildAnnotationManagerContext() {
        return this.contextFactory.buildAnnotationManagerContext();
    }
    buildAnnotationListContext() {
        return this.contextFactory.buildAnnotationListContext();
    }
    updateAnnotationList() {
        renderAnnotationList(this.buildAnnotationListContext());
    }
    updateAnnotationListSelection(selectedAnnotation) {
        updateAnnotationListSelection(this.buildAnnotationListContext(), selectedAnnotation);
    }
    buildTextControllerContext() {
        return this.contextFactory.buildTextControllerContext();
    }
    buildDrawControllerContext() {
        return this.contextFactory.buildDrawControllerContext();
    }
    applyTextConfigPatch(config, operation) {
        if (!this.canRunIdleOperation(operation))
            return;
        const invalidFields = getInvalidTextAnnotationConfigFields(config);
        if (invalidFields.length > 0) {
            reportWarning(this.options, null, `${operation} ignored invalid Text config fields: ${invalidFields.join(', ')}.`);
        }
        const next = mergeTextAnnotationConfigPatch(this.currentTextConfig, config, this.defaultTextConfig);
        if (areResolvedTextAnnotationConfigsEqual(this.currentTextConfig, next))
            return;
        this.currentTextConfig = next;
        this.updateInputs();
        this.updateUi();
        this.emitImageChanged(this.buildCallbackContext(operation, false));
    }
    applyDrawConfigPatch(config, operation) {
        if (!this.canRunIdleOperation(operation))
            return;
        const invalidFields = getInvalidDrawConfigFields(config);
        if (invalidFields.length > 0) {
            reportWarning(this.options, null, `${operation} ignored invalid Draw config fields: ${invalidFields.join(', ')}.`);
        }
        const next = mergeDrawConfigPatch(this.currentDrawConfig, config, this.defaultDrawConfig);
        if (areResolvedDrawConfigsEqual(this.currentDrawConfig, next))
            return;
        this.currentDrawConfig = next;
        updateDrawBrush(this.buildDrawControllerContext());
        this.updateInputs();
        this.updateUi();
        this.emitImageChanged(this.buildCallbackContext(operation, false));
    }
    applyTextColorInput(color) {
        var _a;
        if (this.isTextMode()) {
            this.setTextColor(color);
            return;
        }
        const selected = (_a = this.canvas) === null || _a === void 0 ? void 0 : _a.getActiveObject();
        if (selected && isTextAnnotationObject(selected)) {
            this.updateSelectedAnnotation({ fill: color });
            return;
        }
        this.setTextColor(color);
    }
    applyTextFontSizeInput(size) {
        var _a;
        if (this.isTextMode()) {
            this.setTextFontSize(size);
            return;
        }
        const selected = (_a = this.canvas) === null || _a === void 0 ? void 0 : _a.getActiveObject();
        if (selected && isTextAnnotationObject(selected)) {
            this.updateSelectedAnnotation({ fontSize: size });
            return;
        }
        this.setTextFontSize(size);
    }
    applyDrawColorInput(color) {
        var _a;
        if (this.isDrawMode()) {
            this.setDrawColor(color);
            return;
        }
        const selected = (_a = this.canvas) === null || _a === void 0 ? void 0 : _a.getActiveObject();
        if (selected && isDrawAnnotationObject(selected)) {
            this.updateSelectedAnnotation({ stroke: color });
            return;
        }
        this.setDrawColor(color);
    }
    applyDrawBrushSizeInput(size) {
        var _a;
        if (this.isDrawMode()) {
            this.setDrawBrushSize(size);
            return;
        }
        const selected = (_a = this.canvas) === null || _a === void 0 ? void 0 : _a.getActiveObject();
        if (selected && isDrawAnnotationObject(selected)) {
            this.updateSelectedAnnotation({ strokeWidth: size });
            return;
        }
        this.setDrawBrushSize(size);
    }
    getSelectedCanvasObjects() {
        var _a, _b, _c;
        if (!this.canvas)
            return [];
        const activeObject = this.canvas.getActiveObject();
        if (!activeObject)
            return [];
        const type = typeof activeObject.type === 'string' ? activeObject.type.toLowerCase() : '';
        const isActiveSelection = type === 'activeselection' ||
            ((_c = (_b = (_a = activeObject).isType) === null || _b === void 0 ? void 0 : _b.call(_a, 'ActiveSelection')) !== null && _c !== void 0 ? _c : false);
        if (!isActiveSelection)
            return [activeObject];
        const getObjects = activeObject
            .getObjects;
        return typeof getObjects === 'function' ? getObjects.call(activeObject) : [];
    }
    moveSelectedEditableObject(operation) {
        if (!this.canvas)
            return;
        if (!this.canRunIdleOperation(operation))
            return;
        const selected = this.getSelectedCanvasObjects().filter(isEditableOverlayObject);
        if (selected.length !== 1) {
            if (selected.length > 1) {
                reportWarning(this.options, null, `${operation} skipped: ActiveSelection layer moves are not supported.`);
            }
            return;
        }
        const object = selected[0];
        const range = getEditableOverlayRange(this.canvas);
        const overlays = range.overlays;
        const currentOverlayIndex = overlays.indexOf(object);
        if (currentOverlayIndex < 0)
            return;
        let nextOverlayIndex = currentOverlayIndex;
        if (operation === 'bringSelectedObjectForward') {
            nextOverlayIndex = Math.min(overlays.length - 1, currentOverlayIndex + 1);
        }
        else if (operation === 'sendSelectedObjectBackward') {
            nextOverlayIndex = Math.max(0, currentOverlayIndex - 1);
        }
        else if (operation === 'bringSelectedObjectToFront') {
            nextOverlayIndex = overlays.length - 1;
        }
        else if (operation === 'sendSelectedObjectToBack') {
            nextOverlayIndex = 0;
        }
        if (nextOverlayIndex === currentOverlayIndex)
            return;
        const reordered = overlays.slice();
        reordered.splice(currentOverlayIndex, 1);
        reordered.splice(nextOverlayIndex, 0, object);
        reordered.forEach((overlay, index) => {
            var _a, _b;
            (_b = (_a = this.canvas).moveObjectTo) === null || _b === void 0 ? void 0 : _b.call(_a, overlay, range.start + index);
        });
        normalizeLayerOrder(this.canvas);
        this.canvas.setActiveObject(object);
        this.canvas.renderAll();
        this.saveState();
        this.updateMaskList();
        this.updateAnnotationList();
        this.updateUi();
        const context = this.buildCallbackContext(operation, false);
        if (isMaskObject(object))
            this.emitMasksChanged(context);
        if (isAnnotationObject(object))
            this.emitAnnotationsChanged(context);
        this.emitImageChanged(context);
    }
    async mergeMasks() {
        if (!this.canvas)
            return;
        if (!this.canRunIdleOperation('mergeMasks'))
            return;
        this.finalizeActiveTextEditingIfNeeded();
        const hasMasks = this.canvas.getObjects().some(isMaskObject);
        if (!hasMasks)
            return;
        const callbackContext = this.buildCallbackContext('mergeMasks', false);
        const operationToken = this.operationGuard.beginBusyOperation('mergeMasks');
        this.emitBusyChangeIfChanged(callbackContext);
        this.updateUi();
        try {
            const mergeMasksContext = this.buildMergeMasksContext(operationToken);
            await mergeMasks(mergeMasksContext);
            this.updateInputs();
            this.updateMaskList();
            this.updateAnnotationList();
            this.emitMasksChanged(callbackContext);
            if (this.getAnnotations().length > 0) {
                this.emitAnnotationsChanged(callbackContext);
            }
            this.emitImageChanged(callbackContext);
        }
        finally {
            this.operationGuard.endBusyOperation(operationToken);
            this.emitBusyChangeIfChanged(callbackContext);
            this.updateUi();
        }
    }
    async downloadImage(options) {
        if (!this.canvas)
            return;
        if (!this.canRunIdleOperation('downloadImage'))
            return;
        this.finalizeActiveTextEditingIfNeeded();
        const callbackContext = this.buildCallbackContext('downloadImage', false);
        const operationToken = this.operationGuard.beginBusyOperation('downloadImage');
        this.emitBusyChangeIfChanged(callbackContext);
        const exportContext = this.buildExportServiceContext();
        try {
            await downloadImage(exportContext, options);
        }
        finally {
            this.operationGuard.endBusyOperation(operationToken);
            this.emitBusyChangeIfChanged(callbackContext);
        }
    }
    async exportImageBase64(options) {
        if (!this.canvas)
            return '';
        if (!this.canRunIdleOperation('exportImageBase64', options))
            return '';
        this.finalizeActiveTextEditingIfNeeded();
        const callbackContext = this.buildCallbackContext('exportImageBase64', false);
        const operationToken = this.operationGuard.beginBusyOperation('exportImageBase64');
        this.emitBusyChangeIfChanged(callbackContext);
        const exportContext = this.buildExportServiceContext();
        try {
            return await exportImageBase64(exportContext, options);
        }
        finally {
            this.operationGuard.endBusyOperation(operationToken);
            this.emitBusyChangeIfChanged(callbackContext);
        }
    }
    async exportImageFile(options) {
        this.assertIdleForOperation('exportImageFile', options);
        this.finalizeActiveTextEditingIfNeeded();
        const callbackContext = this.buildCallbackContext('exportImageFile', false);
        const operationToken = this.operationGuard.beginBusyOperation('exportImageFile');
        this.emitBusyChangeIfChanged(callbackContext);
        const exportContext = this.buildExportServiceContext();
        try {
            return await exportImageFile(exportContext, options);
        }
        finally {
            this.operationGuard.endBusyOperation(operationToken);
            this.emitBusyChangeIfChanged(callbackContext);
        }
    }
    buildExportServiceContext() {
        return this.contextFactory.buildExportServiceContext();
    }
    buildMergeMasksContext(operationToken) {
        return this.contextFactory.buildMergeMasksContext(operationToken);
    }
    buildMergeAnnotationsContext(operationToken) {
        return this.contextFactory.buildMergeAnnotationsContext(operationToken);
    }
    captureSnapshotInternal() {
        var _a, _b;
        if (!this.canvas) {
            throw new Error('[ImageEditor] Cannot capture canvas snapshot before init or after dispose.');
        }
        const activeMask = this.getActiveMaskForSnapshot();
        const activeAnnotation = this.getActiveAnnotationForSnapshot();
        this.hideAllMaskLabels();
        return saveState({
            canvas: this.canvas,
            activeMaskId: (_a = activeMask === null || activeMask === void 0 ? void 0 : activeMask.maskId) !== null && _a !== void 0 ? _a : null,
            activeAnnotationId: (_b = activeAnnotation === null || activeAnnotation === void 0 ? void 0 : activeAnnotation.annotationId) !== null && _b !== void 0 ? _b : null,
            currentScale: this.currentScale,
            currentRotation: this.currentRotation,
            baseImageScale: this.baseImageScale,
            currentImageMimeType: this.currentImageMimeType,
        });
    }
    getActiveMaskForSnapshot() {
        var _a;
        if (!this.canvas)
            return null;
        const activeObject = this.canvas.getActiveObject();
        if (activeObject && isMaskObject(activeObject))
            return activeObject;
        const labeledMasks = this.canvas
            .getObjects()
            .filter((object) => isMaskObject(object) && !!object.labelObject);
        return labeledMasks.length === 1 ? ((_a = labeledMasks[0]) !== null && _a !== void 0 ? _a : null) : null;
    }
    getActiveAnnotationForSnapshot() {
        if (!this.canvas)
            return null;
        const activeObject = this.canvas.getActiveObject();
        return activeObject && isAnnotationObject(activeObject) ? activeObject : null;
    }
    enterMosaicMode() {
        if (!this.canvas || !this.originalImage)
            return;
        if (this.mosaicSession)
            return;
        if (!this.isImageLoaded())
            return;
        if (!this.canRunIdleOperation('enterMosaicMode'))
            return;
        enterMosaicMode(this.buildMosaicControllerContext());
        this.updateInputs();
        this.updateUi();
        const callbackContext = this.buildCallbackContext('enterMosaicMode', false);
        this.emitBusyChangeIfChanged(callbackContext);
        this.emitImageChanged(callbackContext);
    }
    exitMosaicMode() {
        if (!this.canvas || !this.mosaicSession)
            return;
        if (!this.canRunIdleOperation('exitMosaicMode'))
            return;
        exitMosaicMode(this.buildMosaicControllerContext());
        this.updateInputs();
        this.updateUi();
        const callbackContext = this.buildCallbackContext('exitMosaicMode', false);
        this.emitBusyChangeIfChanged(callbackContext);
        this.emitImageChanged(callbackContext);
    }
    isMosaicMode() {
        return this.mosaicSession !== null;
    }
    getMosaicConfig() {
        return cloneResolvedMosaicConfig(this.currentMosaicConfig);
    }
    setMosaicConfig(config) {
        this.applyMosaicConfigPatch(config, 'setMosaicConfig');
    }
    resetMosaicConfig() {
        if (this.isDisposed)
            return;
        const nextConfig = cloneResolvedMosaicConfig(this.defaultMosaicConfig);
        if (areResolvedMosaicConfigsEqual(this.currentMosaicConfig, nextConfig))
            return;
        this.currentMosaicConfig = nextConfig;
        if (this.mosaicSession && this.canvas) {
            updateMosaicPreview(this.buildMosaicControllerContext());
        }
        this.updateInputs();
        this.updateUi();
        this.emitImageChanged(this.buildCallbackContext('resetMosaicConfig', false));
    }
    setMosaicBrushSize(size) {
        this.applyMosaicConfigPatch({ brushSize: size }, 'setMosaicBrushSize');
    }
    setMosaicBlockSize(size) {
        this.applyMosaicConfigPatch({ blockSize: size }, 'setMosaicBlockSize');
    }
    applyMosaicConfigPatch(config, operation) {
        if (this.isDisposed)
            return;
        if (config === null || typeof config !== 'object' || Array.isArray(config)) {
            reportWarning(this.options, new TypeError('[ImageEditor] Invalid Mosaic config object.'), 'Ignored invalid Mosaic config.');
            return;
        }
        const invalidFields = getInvalidMosaicConfigFields(config);
        if (invalidFields.length > 0) {
            reportWarning(this.options, new TypeError(`[ImageEditor] Ignored invalid Mosaic config field(s): ` +
                `${invalidFields.join(', ')}.`), 'Ignored invalid Mosaic config fields.');
        }
        const nextConfig = mergeMosaicConfigPatch(this.currentMosaicConfig, config);
        if (areResolvedMosaicConfigsEqual(this.currentMosaicConfig, nextConfig))
            return;
        this.currentMosaicConfig = nextConfig;
        if (this.mosaicSession && this.canvas) {
            updateMosaicPreview(this.buildMosaicControllerContext());
        }
        this.updateInputs();
        this.updateUi();
        this.emitImageChanged(this.buildCallbackContext(operation, false));
    }
    buildMosaicControllerContext() {
        return this.contextFactory.buildMosaicControllerContext();
    }
    enterCropMode(options = {}) {
        if (!this.canvas || !this.originalImage)
            return;
        if (this.cropSession)
            return;
        if (!this.isImageLoaded())
            return;
        if (!this.canRunIdleOperation('enterCropMode'))
            return;
        const cropControllerContext = this.buildCropControllerContext();
        enterCropMode(cropControllerContext, options);
        this.updateUi();
        const callbackContext = this.buildCallbackContext('enterCropMode', false);
        this.emitBusyChangeIfChanged(callbackContext);
        this.emitImageChanged(callbackContext);
    }
    setCropAspectRatio(aspectRatio) {
        if (!this.canvas || !this.cropSession)
            return;
        if (!this.canRunIdleOperation('setCropAspectRatio'))
            return;
        const cropControllerContext = this.buildCropControllerContext();
        setCropAspectRatio(cropControllerContext, aspectRatio);
        this.updateUi();
        const callbackContext = this.buildCallbackContext('setCropAspectRatio', false);
        this.emitImageChanged(callbackContext);
    }
    cancelCrop() {
        if (!this.canvas || !this.cropSession)
            return;
        if (!this.canRunIdleOperation('cancelCrop'))
            return;
        const cropControllerContext = this.buildCropControllerContext();
        cancelCrop(cropControllerContext);
        this.cropSession = null;
        this.updateUi();
        this.canvas.requestRenderAll();
        const callbackContext = this.buildCallbackContext('cancelCrop', false);
        this.emitBusyChangeIfChanged(callbackContext);
        this.emitImageChanged(callbackContext);
    }
    async applyCrop() {
        if (!this.canvas || !this.cropSession)
            return;
        if (!this.canRunIdleOperation('applyCrop'))
            return;
        const callbackContext = this.buildCallbackContext('applyCrop', false);
        const hadMasks = this.getMasks().length > 0;
        const operationToken = this.operationGuard.beginBusyOperation('applyCrop');
        this.emitBusyChangeIfChanged(callbackContext);
        this.updateUi();
        try {
            const cropControllerContext = this.buildCropControllerContext(operationToken);
            await applyCrop(cropControllerContext);
            this.updateInputs();
            this.updateMaskList();
            if (hadMasks || this.getMasks().length > 0) {
                this.emitMasksChanged(callbackContext);
            }
            this.emitImageChanged(callbackContext);
        }
        finally {
            this.operationGuard.endBusyOperation(operationToken);
            this.emitBusyChangeIfChanged(callbackContext);
            this.updateUi();
        }
    }
    buildCropControllerContext(operationToken) {
        return this.contextFactory.buildCropControllerContext(operationToken);
    }
    updateInputs() {
        applyEditorInputState({
            currentScale: this.currentScale,
            mosaicConfig: this.getMosaicConfig(),
            textConfig: this.getTextConfig(),
            drawConfig: this.getDrawConfig(),
        }, (key) => {
            const id = this.elements[key];
            return id ? document.getElementById(id) : null;
        });
    }
    async mergeAnnotations() {
        if (!this.canvas)
            return;
        if (!this.canRunIdleOperation('mergeAnnotations'))
            return;
        this.finalizeActiveTextEditingIfNeeded();
        const hasAnnotations = this.canvas.getObjects().some(isAnnotationObject);
        if (!hasAnnotations)
            return;
        const callbackContext = this.buildCallbackContext('mergeAnnotations', false);
        const operationToken = this.operationGuard.beginBusyOperation('mergeAnnotations');
        this.emitBusyChangeIfChanged(callbackContext);
        this.updateUi();
        try {
            await mergeAnnotations(this.buildMergeAnnotationsContext(operationToken));
            this.updateInputs();
            this.updateMaskList();
            this.updateAnnotationList();
            this.emitAnnotationsChanged(callbackContext);
            if (this.getMasks().length > 0)
                this.emitMasksChanged(callbackContext);
            this.emitImageChanged(callbackContext);
        }
        finally {
            this.operationGuard.endBusyOperation(operationToken);
            this.emitBusyChangeIfChanged(callbackContext);
            this.updateUi();
        }
    }
    updateUi() {
        const snapshot = this.buildControlSnapshot();
        if (!snapshot)
            return;
        applyEditorControlState(snapshot, (key, enabled) => {
            this.setControlEnabled(key, enabled);
        });
    }
    buildControlSnapshot() {
        var _a, _b, _c;
        if (!this.canvas)
            return null;
        const hasImage = !!this.originalImage;
        const masks = hasImage ? this.canvas.getObjects().filter(isMaskObject) : [];
        const annotations = hasImage ? this.canvas.getObjects().filter(isAnnotationObject) : [];
        const hasMasks = masks.length > 0;
        const hasAnnotations = annotations.length > 0;
        const activeObject = this.canvas.getActiveObject();
        const hasSelectedMask = !!(activeObject && isMaskObject(activeObject));
        const hasSelectedAnnotation = !!(activeObject && isAnnotationObject(activeObject));
        const hasSelectedEditableObject = !!activeObject && isEditableOverlayObject(activeObject);
        const isDefaultTransform = this.currentScale === 1 &&
            this.currentRotation === 0 &&
            !((_a = this.originalImage) === null || _a === void 0 ? void 0 : _a.flipX) &&
            !((_b = this.originalImage) === null || _b === void 0 ? void 0 : _b.flipY);
        const canUndo = this.historyManager.canUndo();
        const canRedo = this.historyManager.canRedo();
        const isInCropMode = this.cropSession !== null;
        const isInMosaicMode = this.mosaicSession !== null;
        const isInTextMode = this.textSession !== null;
        const isInDrawMode = this.drawSession !== null;
        const isBusy = this.operationGuard.isBusy() || this.animQueue.isBusy();
        const isMosaicApplying = ((_c = this.mosaicSession) === null || _c === void 0 ? void 0 : _c.isApplying) === true;
        return {
            hasImage,
            hasMasks,
            hasAnnotations,
            hasSelectedMask,
            hasSelectedAnnotation,
            hasSelectedEditableObject,
            isDefaultTransform,
            currentScale: this.currentScale,
            minScale: this.options.minScale,
            maxScale: this.options.maxScale,
            canUndo,
            canRedo,
            isBusy,
            isDisposed: this.isDisposed,
            isInCropMode,
            isInMosaicMode,
            isInTextMode,
            isInDrawMode,
            isMosaicApplying,
        };
    }
    buildControlElementContext() {
        return {
            elements: this.elements,
            originalDisabledMap: this.elementOriginalDisabledMap,
            originalAriaDisabledMap: this.elementOriginalAriaDisabledMap,
            originalPointerEventsMap: this.elementOriginalPointerEventsMap,
            getElement: (key) => {
                const id = this.elements[key];
                return id ? document.getElementById(id) : null;
            },
        };
    }
    setControlEnabled(key, isEnabled) {
        setEditorControlEnabled(this.buildControlElementContext(), key, isEnabled);
    }
    restoreElementOriginalStates() {
        restoreEditorControlOriginalStates(this.buildControlElementContext());
    }
    updatePlaceholderStatus() {
        setPlaceholderVisible(this.placeholderElement, this.containerElement, this.options.showPlaceholder ? !this.originalImage : false);
    }
    dispose() {
        var _a;
        if (this.isDisposed)
            return;
        const context = this.buildCallbackContext('dispose', false);
        const previousImage = this.originalImage;
        this.isDisposed = true;
        this.operationGuard.markDisposed();
        this.animQueue.clear();
        (_a = this.domBindings) === null || _a === void 0 ? void 0 : _a.removeAll();
        if (this.keyboardHandler && this.keyboardDocument) {
            try {
                this.keyboardDocument.removeEventListener('keydown', this.keyboardHandler);
            }
            catch {
            }
        }
        this.keyboardHandler = null;
        this.keyboardDocument = null;
        this.restoreElementOriginalStates();
        if (this.cropSession && this.canvas) {
            try {
                const context = this.buildCropControllerContext();
                cancelCrop(context);
            }
            catch {
            }
            this.cropSession = null;
        }
        if (this.mosaicSession && this.canvas) {
            try {
                exitMosaicMode(this.buildMosaicControllerContext());
            }
            catch {
            }
            this.mosaicSession = null;
        }
        if (this.textSession && this.canvas) {
            try {
                exitTextMode(this.buildTextControllerContext());
            }
            catch {
            }
            this.textSession = null;
        }
        if (this.drawSession && this.canvas) {
            try {
                exitDrawMode(this.buildDrawControllerContext());
            }
            catch {
            }
            this.drawSession = null;
        }
        if (this.canvas) {
            try {
                void Promise.resolve(this.canvas.dispose()).catch(() => {
                });
            }
            catch {
            }
            this.canvas = null;
            this.canvasElement = null;
            this.isImageLoadedToCanvas = false;
        }
        this.originalImage = null;
        this.currentImageMimeType = null;
        this.lastMask = null;
        this.maskCounter = 0;
        this.annotationCounter = 0;
        this.currentScale = 1;
        this.currentRotation = 0;
        this.baseImageScale = 1;
        this.lastSnapshot = null;
        this.transformController = null;
        this.viewportCache.clear();
        if (previousImage) {
            this.emitOptionCallback('onImageCleared', [previousImage, context]);
        }
        this.emitImageChanged(context);
        this.emitBusyChangeIfChanged(context);
        this.emitOptionCallback('onEditorDisposed', [context]);
    }
}

exports.ImageEditor = ImageEditor;
exports.default = ImageEditor;
exports.isAnnotationObject = isAnnotationObject;
exports.isBaseImageObject = isBaseImageObject;
exports.isDrawAnnotationObject = isDrawAnnotationObject;
exports.isEditableOverlayObject = isEditableOverlayObject;
exports.isMaskObject = isMaskObject;
exports.isSessionObject = isSessionObject;
exports.isTextAnnotationObject = isTextAnnotationObject;
//# sourceMappingURL=index.cjs.map
