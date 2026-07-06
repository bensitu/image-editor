'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

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
class StateRestoreError extends Error {
    constructor(message = 'Failed to restore editor state.', originalError = null) {
        super(message);
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'StateRestoreError'
        });
        Object.defineProperty(this, "originalError", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.originalError = originalError;
        fixPrototype(this, StateRestoreError);
    }
}
class IdleGuardError extends Error {
    constructor(operation, reason) {
        super(`[ImageEditor] Cannot run "${operation}" ${reason}.`);
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'IdleGuardError'
        });
        Object.defineProperty(this, "operation", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.operation = operation;
        fixPrototype(this, IdleGuardError);
    }
}
class ExportNotReadyError extends Error {
    constructor(operation = 'exportImageFile', reason = 'no image is loaded on the canvas') {
        super(`Cannot ${operation}: ${reason}.`);
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

const DEFAULT_ELEMENT_TARGETS = Object.freeze({
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
});
const ELEMENT_KEYS = Object.freeze(Object.keys(DEFAULT_ELEMENT_TARGETS));
const ELEMENT_KEY_SET = new Set(ELEMENT_KEYS);
function isElementKey(value) {
    return ELEMENT_KEY_SET.has(value);
}
function isHTMLElementTarget(value) {
    return (!!value &&
        typeof value === 'object' &&
        value.nodeType === 1 &&
        typeof value.addEventListener === 'function');
}
function getFallbackDocument() {
    return typeof document !== 'undefined' ? document : null;
}
function hasTagName(element, tagName) {
    return element.tagName.toLowerCase() === tagName;
}
function isCanvasElement(element) {
    return hasTagName(element, 'canvas');
}
function isInputElement(element) {
    return hasTagName(element, 'input');
}
function isSelectElement(element) {
    return hasTagName(element, 'select');
}
function isInputOrSelectElement(element) {
    return isInputElement(element) || isSelectElement(element);
}
function resolveDomElement(target, ownerDocument, guard) {
    var _a;
    if (target === null || target === undefined)
        return null;
    const element = isHTMLElementTarget(target)
        ? target
        : (_a = (ownerDocument !== null && ownerDocument !== void 0 ? ownerDocument : getFallbackDocument())) === null || _a === void 0 ? void 0 : _a.getElementById(target);
    if (!element)
        return null;
    if (guard && !guard(element))
        return null;
    return element;
}
function resolveElementTargets(elementMap = {}) {
    const resolved = { ...DEFAULT_ELEMENT_TARGETS };
    for (const [key, value] of Object.entries(elementMap)) {
        if (!isElementKey(key))
            continue;
        resolved[key] = value === undefined ? null : value;
    }
    return resolved;
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
const DEFAULT_OVERLAY_LIST_ORDER = 'front-to-back';
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
const DEFAULT_ERASER_CONFIG = Object.freeze({
    brushSize: 18,
    target: 'drawAnnotations',
    previewStroke: '#111',
    previewStrokeWidth: 1,
    previewFill: 'rgba(255,255,255,0.28)',
});
const DEFAULT_SHAPE_ANNOTATION_CONFIG = Object.freeze({
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
const UNSAFE_OBJECT_COPY_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
function normalizeCallback(value) {
    return typeof value === 'function' ? value : null;
}
function isLayoutMode(value) {
    return value === 'fit' || value === 'cover' || value === 'expand';
}
function normalizeLayoutMode(value) {
    return isLayoutMode(value) ? value : DEFAULT_LAYOUT_MODE;
}
function isConfigObject$1(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function canCopyObjectConfigKey(key) {
    return !UNSAFE_OBJECT_COPY_KEYS.has(key);
}
function copyDefaultMaskConfigValue(value) {
    if (Array.isArray(value)) {
        return Object.freeze(value.map((item) => copyDefaultMaskConfigValue(item)));
    }
    if (!isConfigObject$1(value))
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
    if (!isConfigObject$1(value))
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
    if (isConfigObject$1(styles)) {
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
const CROP_ASPECT_RATIO_PRESETS$1 = new Set([
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
        if (CROP_ASPECT_RATIO_PRESETS$1.has(trimmed))
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
    if (isConfigObject$1(value) && hasValidCropRatioParts(value.width, value.height)) {
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
function hasOwn$1(object, key) {
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
    if (!isConfigObject$1(input))
        return cloneResolvedMosaicConfig(fallback);
    return mergeMosaicConfigPatch(fallback, input);
}
function mergeMosaicConfigPatch(current, patch, fallback = current) {
    const raw = isConfigObject$1(patch) ? patch : {};
    const next = cloneResolvedMosaicConfig(current);
    if (hasOwn$1(raw, 'brushSize')) {
        next.brushSize = normalizeMosaicPositiveNumber(raw.brushSize, fallback.brushSize);
    }
    if (hasOwn$1(raw, 'blockSize')) {
        next.blockSize = normalizeMosaicBlockSize(raw.blockSize, fallback.blockSize);
    }
    if (hasOwn$1(raw, 'previewStroke')) {
        next.previewStroke =
            typeof raw.previewStroke === 'string' ? raw.previewStroke : fallback.previewStroke;
    }
    if (hasOwn$1(raw, 'previewStrokeWidth')) {
        next.previewStrokeWidth = normalizeMosaicNonNegativeNumber(raw.previewStrokeWidth, fallback.previewStrokeWidth);
    }
    if (hasOwn$1(raw, 'previewStrokeDashArray')) {
        next.previewStrokeDashArray = normalizeMosaicDashArray(raw.previewStrokeDashArray, fallback.previewStrokeDashArray);
    }
    if (hasOwn$1(raw, 'previewFill')) {
        next.previewFill =
            typeof raw.previewFill === 'string' ? raw.previewFill : fallback.previewFill;
    }
    if (hasOwn$1(raw, 'outputFileType')) {
        next.outputFileType = normalizeMosaicOutputFileType(raw.outputFileType, fallback.outputFileType);
    }
    if (hasOwn$1(raw, 'outputQuality')) {
        next.outputQuality = normalizeMosaicOutputQuality(raw.outputQuality, fallback.outputQuality);
    }
    return next;
}
function getInvalidMosaicConfigFields(input) {
    const raw = isConfigObject$1(input) ? input : {};
    const invalid = [];
    if (hasOwn$1(raw, 'brushSize') &&
        !(typeof raw.brushSize === 'number' && Number.isFinite(raw.brushSize) && raw.brushSize > 0)) {
        invalid.push('brushSize');
    }
    if (hasOwn$1(raw, 'blockSize') &&
        !(typeof raw.blockSize === 'number' && Number.isFinite(raw.blockSize) && raw.blockSize > 0)) {
        invalid.push('blockSize');
    }
    if (hasOwn$1(raw, 'previewStroke') && typeof raw.previewStroke !== 'string') {
        invalid.push('previewStroke');
    }
    if (hasOwn$1(raw, 'previewStrokeWidth') &&
        !(typeof raw.previewStrokeWidth === 'number' &&
            Number.isFinite(raw.previewStrokeWidth) &&
            raw.previewStrokeWidth >= 0)) {
        invalid.push('previewStrokeWidth');
    }
    if (hasOwn$1(raw, 'previewStrokeDashArray')) {
        const value = raw.previewStrokeDashArray;
        const valid = value === null ||
            (Array.isArray(value) &&
                value.every((entry) => typeof entry === 'number' && Number.isFinite(entry) && entry >= 0));
        if (!valid)
            invalid.push('previewStrokeDashArray');
    }
    if (hasOwn$1(raw, 'previewFill') && typeof raw.previewFill !== 'string') {
        invalid.push('previewFill');
    }
    if (hasOwn$1(raw, 'outputFileType')) {
        const value = raw.outputFileType;
        const valid = value === 'source' || (typeof value === 'string' && tryNormalizeImageFormat(value));
        if (!valid)
            invalid.push('outputFileType');
    }
    if (hasOwn$1(raw, 'outputQuality') &&
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
function cloneResolvedEraserConfig(config) {
    return { ...config };
}
function cloneResolvedShapeAnnotationConfig(config) {
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
    if (!isConfigObject$1(value))
        return {};
    return { ...value };
}
function normalizeFabricObjectStyles(value) {
    if (!isConfigObject$1(value))
        return {};
    return { ...value };
}
function mergeTextAnnotationConfigPatch(current, patch, fallback = current) {
    const raw = isConfigObject$1(patch) ? patch : {};
    const next = cloneResolvedTextAnnotationConfig(current);
    if (hasOwn$1(raw, 'text'))
        next.text = normalizeString(raw.text, fallback.text);
    if (hasOwn$1(raw, 'left'))
        next.left = normalizeTextLeftTop(raw.left);
    if (hasOwn$1(raw, 'top'))
        next.top = normalizeTextLeftTop(raw.top);
    if (hasOwn$1(raw, 'width'))
        next.width = normalizePositiveNumber(raw.width, fallback.width);
    if (hasOwn$1(raw, 'fontSize')) {
        next.fontSize = normalizePositiveNumber(raw.fontSize, fallback.fontSize);
    }
    if (hasOwn$1(raw, 'fontFamily')) {
        next.fontFamily = normalizeString(raw.fontFamily, fallback.fontFamily);
    }
    if (hasOwn$1(raw, 'fontWeight')) {
        next.fontWeight =
            typeof raw.fontWeight === 'string' || typeof raw.fontWeight === 'number'
                ? raw.fontWeight
                : fallback.fontWeight;
    }
    if (hasOwn$1(raw, 'fill'))
        next.fill = normalizeString(raw.fill, fallback.fill);
    if (hasOwn$1(raw, 'backgroundColor')) {
        next.backgroundColor = normalizeString(raw.backgroundColor, fallback.backgroundColor);
    }
    if (hasOwn$1(raw, 'textAlign'))
        next.textAlign = normalizeTextAlign(raw.textAlign, fallback.textAlign);
    if (hasOwn$1(raw, 'angle'))
        next.angle = normalizeFiniteNumber(raw.angle, fallback.angle);
    if (hasOwn$1(raw, 'selectable'))
        next.selectable = normalizeBoolean(raw.selectable, fallback.selectable);
    if (hasOwn$1(raw, 'evented'))
        next.evented = normalizeBoolean(raw.evented, fallback.evented);
    if (hasOwn$1(raw, 'editable'))
        next.editable = normalizeBoolean(raw.editable, fallback.editable);
    if (hasOwn$1(raw, 'enterEditing')) {
        next.enterEditing = normalizeBoolean(raw.enterEditing, fallback.enterEditing);
    }
    if (hasOwn$1(raw, 'annotationHidden')) {
        next.annotationHidden = normalizeBoolean(raw.annotationHidden, fallback.annotationHidden);
    }
    if (hasOwn$1(raw, 'annotationLocked')) {
        next.annotationLocked = normalizeBoolean(raw.annotationLocked, fallback.annotationLocked);
    }
    if (hasOwn$1(raw, 'styles')) {
        next.styles = {
            ...next.styles,
            ...normalizeTextboxStyles(raw.styles),
        };
    }
    return next;
}
function normalizeTextAnnotationConfig(input, fallback) {
    if (!isConfigObject$1(input))
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
    const raw = isConfigObject$1(patch) ? patch : {};
    const next = cloneResolvedDrawConfig(current);
    if (hasOwn$1(raw, 'brushSize')) {
        next.brushSize = normalizePositiveNumber(raw.brushSize, fallback.brushSize);
    }
    if (hasOwn$1(raw, 'color'))
        next.color = normalizeString(raw.color, fallback.color);
    if (hasOwn$1(raw, 'opacity'))
        next.opacity = normalizeOpacity(raw.opacity, fallback.opacity);
    if (hasOwn$1(raw, 'lineCap'))
        next.lineCap = normalizeLineCap(raw.lineCap, fallback.lineCap);
    if (hasOwn$1(raw, 'lineJoin'))
        next.lineJoin = normalizeLineJoin(raw.lineJoin, fallback.lineJoin);
    if (hasOwn$1(raw, 'selectable'))
        next.selectable = normalizeBoolean(raw.selectable, fallback.selectable);
    if (hasOwn$1(raw, 'evented'))
        next.evented = normalizeBoolean(raw.evented, fallback.evented);
    if (hasOwn$1(raw, 'annotationHidden')) {
        next.annotationHidden = normalizeBoolean(raw.annotationHidden, fallback.annotationHidden);
    }
    if (hasOwn$1(raw, 'annotationLocked')) {
        next.annotationLocked = normalizeBoolean(raw.annotationLocked, fallback.annotationLocked);
    }
    return next;
}
function normalizeDrawConfig(input, fallback) {
    if (!isConfigObject$1(input))
        return cloneResolvedDrawConfig(fallback);
    return mergeDrawConfigPatch(fallback, input);
}
function mergeEraserConfigPatch(current, patch, fallback = current) {
    const raw = isConfigObject$1(patch) ? patch : {};
    const next = cloneResolvedEraserConfig(current);
    if (hasOwn$1(raw, 'brushSize')) {
        next.brushSize = normalizePositiveNumber(raw.brushSize, fallback.brushSize);
    }
    if (hasOwn$1(raw, 'target')) {
        next.target = raw.target === 'drawAnnotations' ? 'drawAnnotations' : fallback.target;
    }
    if (hasOwn$1(raw, 'previewStroke')) {
        next.previewStroke = normalizeString(raw.previewStroke, fallback.previewStroke);
    }
    if (hasOwn$1(raw, 'previewStrokeWidth')) {
        next.previewStrokeWidth = normalizeMosaicNonNegativeNumber(raw.previewStrokeWidth, fallback.previewStrokeWidth);
    }
    if (hasOwn$1(raw, 'previewFill')) {
        next.previewFill = normalizeString(raw.previewFill, fallback.previewFill);
    }
    return next;
}
function normalizeEraserConfig(input, fallback) {
    if (!isConfigObject$1(input))
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
function mergeShapeAnnotationConfigPatch(current, patch, fallback = current) {
    const raw = isConfigObject$1(patch) ? patch : {};
    const next = cloneResolvedShapeAnnotationConfig(current);
    if (hasOwn$1(raw, 'shape'))
        next.shape = normalizeShapeKind(raw.shape, fallback.shape);
    if (hasOwn$1(raw, 'left'))
        next.left = normalizeTextLeftTop(raw.left);
    if (hasOwn$1(raw, 'top'))
        next.top = normalizeTextLeftTop(raw.top);
    if (hasOwn$1(raw, 'width'))
        next.width = normalizePositiveNumber(raw.width, fallback.width);
    if (hasOwn$1(raw, 'height'))
        next.height = normalizePositiveNumber(raw.height, fallback.height);
    if (hasOwn$1(raw, 'x1'))
        next.x1 = normalizeTextLeftTop(raw.x1);
    if (hasOwn$1(raw, 'y1'))
        next.y1 = normalizeTextLeftTop(raw.y1);
    if (hasOwn$1(raw, 'x2'))
        next.x2 = normalizeTextLeftTop(raw.x2);
    if (hasOwn$1(raw, 'y2'))
        next.y2 = normalizeTextLeftTop(raw.y2);
    if (hasOwn$1(raw, 'stroke'))
        next.stroke = normalizeString(raw.stroke, fallback.stroke);
    if (hasOwn$1(raw, 'strokeWidth')) {
        next.strokeWidth = normalizePositiveNumber(raw.strokeWidth, fallback.strokeWidth);
    }
    if (hasOwn$1(raw, 'fill'))
        next.fill = normalizeString(raw.fill, fallback.fill);
    if (hasOwn$1(raw, 'opacity'))
        next.opacity = normalizeOpacity(raw.opacity, fallback.opacity);
    if (hasOwn$1(raw, 'angle'))
        next.angle = normalizeFiniteNumber(raw.angle, fallback.angle);
    if (hasOwn$1(raw, 'selectable')) {
        next.selectable = normalizeBoolean(raw.selectable, fallback.selectable);
    }
    if (hasOwn$1(raw, 'evented'))
        next.evented = normalizeBoolean(raw.evented, fallback.evented);
    if (hasOwn$1(raw, 'annotationHidden')) {
        next.annotationHidden = normalizeBoolean(raw.annotationHidden, fallback.annotationHidden);
    }
    if (hasOwn$1(raw, 'annotationLocked')) {
        next.annotationLocked = normalizeBoolean(raw.annotationLocked, fallback.annotationLocked);
    }
    if (hasOwn$1(raw, 'strokeDashArray')) {
        next.strokeDashArray = normalizeNullableDashArray(raw.strokeDashArray, fallback.strokeDashArray);
    }
    if (hasOwn$1(raw, 'arrowHeadLength')) {
        next.arrowHeadLength = normalizePositiveNumber(raw.arrowHeadLength, fallback.arrowHeadLength);
    }
    if (hasOwn$1(raw, 'styles')) {
        next.styles = {
            ...next.styles,
            ...normalizeFabricObjectStyles(raw.styles),
        };
    }
    return next;
}
function normalizeShapeAnnotationConfig(input, fallback) {
    if (!isConfigObject$1(input))
        return cloneResolvedShapeAnnotationConfig(fallback);
    return mergeShapeAnnotationConfigPatch(fallback, input);
}
function areResolvedTextAnnotationConfigsEqual(left, right) {
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
        if (!hasOwn$1(rightRecord, key))
            return false;
        return areStyleValuesEqual(leftRecord[key], rightRecord[key], seen);
    });
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
function areResolvedEraserConfigsEqual(left, right) {
    return (left.brushSize === right.brushSize &&
        left.target === right.target &&
        left.previewStroke === right.previewStroke &&
        left.previewStrokeWidth === right.previewStrokeWidth &&
        left.previewFill === right.previewFill);
}
function areResolvedShapeAnnotationConfigsEqual(left, right) {
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
function getInvalidTextAnnotationConfigFields(input) {
    const raw = isConfigObject$1(input) ? input : {};
    const invalid = [];
    if (hasOwn$1(raw, 'text') && typeof raw.text !== 'string')
        invalid.push('text');
    if (hasOwn$1(raw, 'width') && !isFiniteNumber$1(raw.width))
        invalid.push('width');
    if (hasOwn$1(raw, 'fontSize') && !isFiniteNumber$1(raw.fontSize))
        invalid.push('fontSize');
    if (hasOwn$1(raw, 'fontFamily') && typeof raw.fontFamily !== 'string')
        invalid.push('fontFamily');
    if (hasOwn$1(raw, 'fill') && typeof raw.fill !== 'string') {
        invalid.push('fill');
    }
    return invalid;
}
function getInvalidDrawConfigFields(input) {
    const raw = isConfigObject$1(input) ? input : {};
    const invalid = [];
    if (hasOwn$1(raw, 'brushSize') && !isFiniteNumber$1(raw.brushSize))
        invalid.push('brushSize');
    if (hasOwn$1(raw, 'color') && typeof raw.color !== 'string')
        invalid.push('color');
    if (hasOwn$1(raw, 'opacity') && !isFiniteNumber$1(raw.opacity))
        invalid.push('opacity');
    return invalid;
}
function getInvalidEraserConfigFields(input) {
    const raw = isConfigObject$1(input) ? input : {};
    const invalid = [];
    if (hasOwn$1(raw, 'brushSize') && !isFiniteNumber$1(raw.brushSize))
        invalid.push('brushSize');
    if (hasOwn$1(raw, 'target') && raw.target !== 'drawAnnotations')
        invalid.push('target');
    if (hasOwn$1(raw, 'previewStroke') && typeof raw.previewStroke !== 'string') {
        invalid.push('previewStroke');
    }
    if (hasOwn$1(raw, 'previewStrokeWidth') && !isFiniteNumber$1(raw.previewStrokeWidth)) {
        invalid.push('previewStrokeWidth');
    }
    if (hasOwn$1(raw, 'previewFill') && typeof raw.previewFill !== 'string') {
        invalid.push('previewFill');
    }
    return invalid;
}
function getInvalidShapeAnnotationConfigFields(input) {
    const raw = isConfigObject$1(input) ? input : {};
    const invalid = [];
    if (hasOwn$1(raw, 'shape') &&
        raw.shape !== 'rect' &&
        raw.shape !== 'line' &&
        raw.shape !== 'arrow') {
        invalid.push('shape');
    }
    if (hasOwn$1(raw, 'width') && !isFiniteNumber$1(raw.width))
        invalid.push('width');
    if (hasOwn$1(raw, 'height') && !isFiniteNumber$1(raw.height))
        invalid.push('height');
    if (hasOwn$1(raw, 'stroke') && typeof raw.stroke !== 'string')
        invalid.push('stroke');
    if (hasOwn$1(raw, 'strokeWidth') && !isFiniteNumber$1(raw.strokeWidth)) {
        invalid.push('strokeWidth');
    }
    if (hasOwn$1(raw, 'fill') && typeof raw.fill !== 'string')
        invalid.push('fill');
    if (hasOwn$1(raw, 'opacity') && !isFiniteNumber$1(raw.opacity))
        invalid.push('opacity');
    if (hasOwn$1(raw, 'arrowHeadLength') && !isFiniteNumber$1(raw.arrowHeadLength)) {
        invalid.push('arrowHeadLength');
    }
    if (hasOwn$1(raw, 'strokeDashArray')) {
        const value = raw.strokeDashArray;
        const valid = value === null ||
            (Array.isArray(value) &&
                value.every((entry) => typeof entry === 'number' && Number.isFinite(entry) && entry >= 0));
        if (!valid)
            invalid.push('strokeDashArray');
    }
    return invalid;
}
function resolveOptions(input) {
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

const DEFAULT_IMAGE_FILTER_CONFIG = Object.freeze({
    brightness: 0,
    contrast: 0,
    saturation: 0,
    blur: 0,
    sharpen: 0,
    grayscale: false,
    sepia: false,
    vintage: false,
});
function isConfigObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function hasOwn(object, key) {
    return Object.prototype.hasOwnProperty.call(object, key);
}
function normalizeNumberField(raw, key, fallback, min, max, warnings) {
    if (!hasOwn(raw, key))
        return fallback;
    const value = raw[key];
    if (value === undefined || value === null)
        return 0;
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        warnings.push(key);
        return fallback;
    }
    if (value < min || value > max) {
        warnings.push(key);
        return Math.max(min, Math.min(max, value));
    }
    return value;
}
function normalizeBooleanField(raw, key, fallback, warnings) {
    if (!hasOwn(raw, key))
        return fallback;
    const value = raw[key];
    if (value === undefined || value === null)
        return false;
    if (typeof value !== 'boolean') {
        warnings.push(key);
        return fallback;
    }
    return value;
}
function cloneResolvedImageFilterConfig(config) {
    return { ...config };
}
function mergeImageFilterConfigPatch(current, patch) {
    const raw = isConfigObject(patch) ? patch : {};
    const warnings = [];
    const config = {
        brightness: normalizeNumberField(raw, 'brightness', current.brightness, -1, 1, warnings),
        contrast: normalizeNumberField(raw, 'contrast', current.contrast, -1, 1, warnings),
        saturation: normalizeNumberField(raw, 'saturation', current.saturation, -1, 1, warnings),
        blur: normalizeNumberField(raw, 'blur', current.blur, 0, 1, warnings),
        sharpen: normalizeNumberField(raw, 'sharpen', current.sharpen, 0, 1, warnings),
        grayscale: normalizeBooleanField(raw, 'grayscale', current.grayscale, warnings),
        sepia: normalizeBooleanField(raw, 'sepia', current.sepia, warnings),
        vintage: normalizeBooleanField(raw, 'vintage', current.vintage, warnings),
    };
    return { config, warnings };
}
function normalizeImageFilterConfigSnapshot(value) {
    if (!isConfigObject(value))
        return cloneResolvedImageFilterConfig(DEFAULT_IMAGE_FILTER_CONFIG);
    return mergeImageFilterConfigPatch(cloneResolvedImageFilterConfig(DEFAULT_IMAGE_FILTER_CONFIG), value).config;
}
function areResolvedImageFilterConfigsEqual(left, right) {
    return (left.brightness === right.brightness &&
        left.contrast === right.contrast &&
        left.saturation === right.saturation &&
        left.blur === right.blur &&
        left.sharpen === right.sharpen &&
        left.grayscale === right.grayscale &&
        left.sepia === right.sepia &&
        left.vintage === right.vintage);
}
function hasActiveImageFilters(config) {
    return (config.brightness !== 0 ||
        config.contrast !== 0 ||
        config.saturation !== 0 ||
        config.blur !== 0 ||
        config.sharpen !== 0 ||
        config.grayscale ||
        config.sepia ||
        config.vintage);
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
function isShapeAnnotationObject(object) {
    const candidate = object;
    return (isAnnotationObject(candidate) &&
        candidate.annotationType === 'shape' &&
        (candidate.shapeAnnotationKind === 'rect' ||
            candidate.shapeAnnotationKind === 'line' ||
            candidate.shapeAnnotationKind === 'arrow'));
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
    if (meta.originalStroke !== undefined)
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
    if (typeof meta.annotationSelectable === 'boolean') {
        annotation.annotationSelectable = meta.annotationSelectable;
    }
    if (typeof meta.annotationEvented === 'boolean') {
        annotation.annotationEvented = meta.annotationEvented;
    }
    if (typeof meta.annotationHasControls === 'boolean') {
        annotation.annotationHasControls = meta.annotationHasControls;
    }
    if (typeof meta.annotationEditable === 'boolean') {
        annotation.annotationEditable = meta.annotationEditable;
    }
    if (meta.shapeAnnotationKind) {
        annotation.shapeAnnotationKind = meta.shapeAnnotationKind;
    }
    return annotation;
}
function markSessionObject(object, sessionObjectType) {
    const sessionObject = object;
    sessionObject.editorObjectKind = 'session';
    sessionObject.sessionObjectType = sessionObjectType;
    return sessionObject;
}

const DEFAULT_MAX_RESTORE_CANVAS_PIXELS = 50000000;
const SNAPSHOT_CUSTOM_KEYS = Object.freeze([
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
    'shapeAnnotationKind',
    'annotationName',
    'annotationHidden',
    'annotationLocked',
    'annotationSelectable',
    'annotationEvented',
    'annotationHasControls',
    'annotationEditable',
]);
function readFiniteNumber(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
}
function serializedTypeMatches(liveObject, jsonObject) {
    const jsonType = typeof jsonObject.type === 'string' ? jsonObject.type.toLowerCase() : '';
    const liveType = typeof liveObject.type === 'string' ? liveObject.type.toLowerCase() : '';
    return !jsonType || liveType === jsonType;
}
function serializedPositionMatches(liveObject, jsonObject) {
    var _a, _b;
    const jsonLeft = readFiniteNumber(jsonObject.left);
    const jsonTop = readFiniteNumber(jsonObject.top);
    if (jsonLeft === null || jsonTop === null)
        return true;
    return (Math.abs(((_a = liveObject.left) !== null && _a !== void 0 ? _a : 0) - jsonLeft) < 0.5 &&
        Math.abs(((_b = liveObject.top) !== null && _b !== void 0 ? _b : 0) - jsonTop) < 0.5);
}
function serializedNumberMatches(liveValue, jsonValue, fallback, tolerance) {
    var _a;
    const jsonNumber = readFiniteNumber(jsonValue);
    if (jsonNumber === null)
        return true;
    const liveNumber = (_a = readFiniteNumber(liveValue)) !== null && _a !== void 0 ? _a : fallback;
    return Math.abs(liveNumber - jsonNumber) < tolerance;
}
function serializedTransformMatches(liveObject, jsonObject) {
    return (serializedNumberMatches(liveObject.angle, jsonObject.angle, 0, 0.5) &&
        serializedNumberMatches(liveObject.scaleX, jsonObject.scaleX, 1, 0.0001) &&
        serializedNumberMatches(liveObject.scaleY, jsonObject.scaleY, 1, 0.0001));
}
function serializedObjectMatches(liveObject, jsonObject) {
    const live = liveObject;
    if (typeof jsonObject.maskUid === 'string' && typeof live.maskUid === 'string') {
        return live.maskUid === jsonObject.maskUid;
    }
    if (typeof jsonObject.maskId === 'number' && typeof live.maskId === 'number') {
        return live.maskId === jsonObject.maskId;
    }
    if (typeof jsonObject.annotationId === 'number' && typeof live.annotationId === 'number') {
        return live.annotationId === jsonObject.annotationId;
    }
    if (typeof jsonObject.sessionObjectType === 'string' &&
        typeof live.sessionObjectType === 'string') {
        return live.sessionObjectType === jsonObject.sessionObjectType;
    }
    if (typeof jsonObject.editorObjectKind === 'string' &&
        typeof live.editorObjectKind === 'string' &&
        live.editorObjectKind !== jsonObject.editorObjectKind) {
        return false;
    }
    return (serializedTypeMatches(liveObject, jsonObject) &&
        serializedPositionMatches(liveObject, jsonObject) &&
        serializedTransformMatches(liveObject, jsonObject));
}
function findCanvasObjectForJson(canvasObjects, jsonObject, preferredIndex, consumedIndexes) {
    const preferred = canvasObjects[preferredIndex];
    if (preferred &&
        !consumedIndexes.has(preferredIndex) &&
        serializedObjectMatches(preferred, jsonObject)) {
        consumedIndexes.add(preferredIndex);
        return { object: preferred, index: preferredIndex };
    }
    const matchedIndex = canvasObjects.findIndex((candidate, index) => !consumedIndexes.has(index) && serializedObjectMatches(candidate, jsonObject));
    if (matchedIndex < 0)
        return null;
    consumedIndexes.add(matchedIndex);
    return { object: canvasObjects[matchedIndex], index: matchedIndex };
}
function copySnapshotCustomPropsFromCanvas(canvasObjects, jsonObjects) {
    if (!Array.isArray(jsonObjects))
        return;
    const consumedIndexes = new Set();
    for (let index = 0; index < jsonObjects.length; index += 1) {
        const jsonObject = jsonObjects[index];
        if (!jsonObject)
            continue;
        const match = findCanvasObjectForJson(canvasObjects, jsonObject, index, consumedIndexes);
        if (!match)
            continue;
        const liveObject = match.object;
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
        if (liveObject.originalStroke !== undefined) {
            jsonObject.originalStroke = liveObject.originalStroke;
        }
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
        if (typeof liveObject.shapeAnnotationKind === 'string') {
            jsonObject.shapeAnnotationKind = liveObject.shapeAnnotationKind;
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
        if (typeof liveObject.annotationSelectable === 'boolean') {
            jsonObject.annotationSelectable = liveObject.annotationSelectable;
        }
        if (typeof liveObject.annotationEvented === 'boolean') {
            jsonObject.annotationEvented = liveObject.annotationEvented;
        }
        if (typeof liveObject.annotationHasControls === 'boolean') {
            jsonObject.annotationHasControls = liveObject.annotationHasControls;
        }
        if (typeof liveObject.annotationEditable === 'boolean') {
            jsonObject.annotationEditable = liveObject.annotationEditable;
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
    var _a, _b, _c, _d;
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
    const imageFilterConfig = cloneResolvedImageFilterConfig((_d = input.imageFilterConfig) !== null && _d !== void 0 ? _d : DEFAULT_IMAGE_FILTER_CONFIG);
    if (hasActiveImageFilters(imageFilterConfig)) {
        jsonObj._editorState.imageFilterConfig = imageFilterConfig;
    }
    if (activeMaskId !== null)
        jsonObj._editorState.activeMaskId = activeMaskId;
    if (activeAnnotationId !== null) {
        jsonObj._editorState.activeAnnotationId = activeAnnotationId;
    }
    return JSON.stringify(jsonObj);
}
async function loadFromState(input) {
    var _a, _b, _c;
    const { canvas, jsonString: snapshotInput, setCanvasSize } = input;
    const jsonString = typeof snapshotInput === 'string' ? snapshotInput : JSON.stringify(snapshotInput);
    let json;
    try {
        json = JSON.parse(jsonString);
    }
    catch (error) {
        throw new StateRestoreError('loadFromState: snapshot JSON is malformed.', error);
    }
    if (typeof json.width === 'number' &&
        json.width > 0 &&
        typeof json.height === 'number' &&
        json.height > 0) {
        assertRestoredCanvasSizeAllowed(json.width, json.height, (_a = input.maxCanvasPixels) !== null && _a !== void 0 ? _a : DEFAULT_MAX_RESTORE_CANVAS_PIXELS);
        setCanvasSize(json.width, json.height);
    }
    await canvas.loadFromJSON(json);
    const objects = canvas.getObjects();
    restoreEditorObjectPropsFromJson(objects, (_b = json.objects) !== null && _b !== void 0 ? _b : []);
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
    if (editorState && json._editorState && 'imageFilterConfig' in json._editorState) {
        editorState.imageFilterConfig = normalizeImageFilterConfigSnapshot(json._editorState.imageFilterConfig);
    }
    const maxMaskId = objects
        .filter(isMaskObject)
        .reduce((max, maskObject) => Math.max(max, maskObject.maskId), 0);
    const maxAnnotationId = objects
        .filter(isAnnotationObject)
        .reduce((max, annotationObject) => Math.max(max, annotationObject.annotationId), 0);
    const masks = objects.filter(isMaskObject);
    const annotations = objects.filter(isAnnotationObject);
    const originalImage = (_c = objects.find(isBaseImageObject)) !== null && _c !== void 0 ? _c : null;
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
function assertRestoredCanvasSizeAllowed(width, height, maxCanvasPixels) {
    const safeMaxCanvasPixels = Number.isFinite(maxCanvasPixels) && maxCanvasPixels > 0
        ? Math.floor(maxCanvasPixels)
        : DEFAULT_MAX_RESTORE_CANVAS_PIXELS;
    const pixelCount = width * height;
    if (!Number.isFinite(pixelCount) || pixelCount > safeMaxCanvasPixels) {
        throw new StateRestoreError(`loadFromState: snapshot canvas size ${width}x${height} exceeds maxCanvasPixels (${safeMaxCanvasPixels}).`);
    }
}
function restoreEditorObjectPropsFromJson(canvasObjs, jsonObjs) {
    var _a, _b, _c, _d;
    const consumedMetadataIndexes = new Set();
    jsonObjs.forEach((jObj, index) => {
        if (jObj.editorObjectKind !== 'baseImage' &&
            jObj.editorObjectKind !== 'annotation' &&
            jObj.editorObjectKind !== 'session') {
            return;
        }
        const match = findCanvasObjectForJson(canvasObjs, jObj, index, consumedMetadataIndexes);
        const canvasObj = match === null || match === void 0 ? void 0 : match.object;
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
            const annotationType = jObj.annotationType === 'draw'
                ? 'draw'
                : jObj.annotationType === 'shape'
                    ? 'shape'
                    : 'text';
            const shapeAnnotationKind = jObj.shapeAnnotationKind === 'line' || jObj.shapeAnnotationKind === 'arrow'
                ? jObj.shapeAnnotationKind
                : 'rect';
            markAnnotationObject(canvasObj, {
                annotationId: jObj.annotationId,
                annotationType,
                annotationName: jObj.annotationName,
                annotationHidden: typeof jObj.annotationHidden === 'boolean' ? jObj.annotationHidden : false,
                annotationLocked: typeof jObj.annotationLocked === 'boolean' ? jObj.annotationLocked : false,
                annotationSelectable: typeof jObj.annotationSelectable === 'boolean'
                    ? jObj.annotationSelectable
                    : undefined,
                annotationEvented: typeof jObj.annotationEvented === 'boolean'
                    ? jObj.annotationEvented
                    : undefined,
                annotationHasControls: typeof jObj.annotationHasControls === 'boolean'
                    ? jObj.annotationHasControls
                    : undefined,
                annotationEditable: typeof jObj.annotationEditable === 'boolean'
                    ? jObj.annotationEditable
                    : undefined,
                shapeAnnotationKind: annotationType === 'shape' ? shapeAnnotationKind : undefined,
            });
            return;
        }
        if (jObj.editorObjectKind === 'session' && typeof jObj.sessionObjectType === 'string') {
            canvasObj.editorObjectKind = 'session';
            canvasObj.sessionObjectType = jObj.sessionObjectType;
        }
    });
    const consumedCanvasIndexes = new Set();
    const canvasIndexesByMaskUid = new Map();
    canvasObjs.forEach((canvasObj, index) => {
        const maskUid = canvasObj.maskUid;
        if (typeof maskUid !== 'string')
            return;
        const indexes = canvasIndexesByMaskUid.get(maskUid);
        if (indexes) {
            indexes.push(index);
        }
        else {
            canvasIndexesByMaskUid.set(maskUid, [index]);
        }
    });
    const takeUnconsumedCanvasIndex = (indexes) => {
        if (!indexes)
            return -1;
        while (indexes.length > 0) {
            const index = indexes.shift();
            if (!consumedCanvasIndexes.has(index))
                return index;
        }
        return -1;
    };
    for (const jObj of jsonObjs) {
        if (jObj.editorObjectKind !== 'mask' || typeof jObj.maskId !== 'number')
            continue;
        const jType = String((_a = jObj.type) !== null && _a !== void 0 ? _a : '');
        const jLeft = Number((_b = jObj.left) !== null && _b !== void 0 ? _b : 0);
        const jTop = Number((_c = jObj.top) !== null && _c !== void 0 ? _c : 0);
        const jUid = typeof jObj.maskUid === 'string' ? jObj.maskUid : null;
        let matchIndex = -1;
        if (jUid) {
            matchIndex = takeUnconsumedCanvasIndex(canvasIndexesByMaskUid.get(jUid));
        }
        if (matchIndex < 0) {
            matchIndex = canvasObjs.findIndex((o, index) => {
                var _a, _b;
                if (consumedCanvasIndexes.has(index))
                    return false;
                if (jType && o.type !== jType)
                    return false;
                return (Math.abs(((_a = o.left) !== null && _a !== void 0 ? _a : 0) - jLeft) < 0.5 &&
                    Math.abs(((_b = o.top) !== null && _b !== void 0 ? _b : 0) - jTop) < 0.5 &&
                    serializedTransformMatches(o, jObj));
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

function isAnnotationLocked(annotation) {
    return annotation.annotationLocked === true;
}
function isAnnotationUnlocked(annotation) {
    return !isAnnotationLocked(annotation);
}

function setObjectProps(object, props) {
    object.set(props);
}
function readBoolean(value, fallback) {
    return typeof value === 'boolean' ? value : fallback;
}
function getBaseSelectable(annotation) {
    return readBoolean(annotation.annotationSelectable, readBoolean(annotation.selectable, true));
}
function getBaseEvented(annotation) {
    return readBoolean(annotation.annotationEvented, readBoolean(annotation.evented, true));
}
function getBaseHasControls(annotation) {
    return readBoolean(annotation.annotationHasControls, readBoolean(annotation.hasControls, true));
}
function getBaseEditable(annotation) {
    return readBoolean(annotation.annotationEditable, readBoolean(annotation.editable, true));
}
function syncTextEditability(annotation, editable) {
    const textObject = annotation;
    textObject.editable = editable;
}
function ensureBaseInteractivityMetadata(annotation) {
    if (typeof annotation.annotationSelectable !== 'boolean') {
        annotation.annotationSelectable = readBoolean(annotation.selectable, true);
    }
    if (typeof annotation.annotationEvented !== 'boolean') {
        annotation.annotationEvented = readBoolean(annotation.evented, true);
    }
    if (typeof annotation.annotationHasControls !== 'boolean') {
        annotation.annotationHasControls = readBoolean(annotation.hasControls, true);
    }
    if (isTextAnnotationObject(annotation) && typeof annotation.annotationEditable !== 'boolean') {
        annotation.annotationEditable = getBaseEditable(annotation);
    }
}
function syncAnnotationRuntimeState(annotation) {
    var _a, _b;
    const hidden = annotation.annotationHidden === true;
    const locked = isAnnotationLocked(annotation);
    if (locked) {
        ensureBaseInteractivityMetadata(annotation);
        setObjectProps(annotation, {
            visible: !hidden,
            selectable: false,
            evented: false,
            hasControls: false,
            lockMovementX: true,
            lockMovementY: true,
            lockScalingX: true,
            lockScalingY: true,
            lockRotation: true,
        });
        if (isTextAnnotationObject(annotation)) {
            syncTextEditability(annotation, false);
        }
        (_a = annotation.setCoords) === null || _a === void 0 ? void 0 : _a.call(annotation);
        return;
    }
    setObjectProps(annotation, {
        visible: !hidden,
        selectable: getBaseSelectable(annotation),
        evented: getBaseEvented(annotation),
        hasControls: getBaseHasControls(annotation),
        lockMovementX: false,
        lockMovementY: false,
        lockScalingX: false,
        lockScalingY: false,
        lockRotation: false,
    });
    if (isTextAnnotationObject(annotation)) {
        syncTextEditability(annotation, getBaseEditable(annotation));
    }
    (_b = annotation.setCoords) === null || _b === void 0 ? void 0 : _b.call(annotation);
}
function syncAnnotationRuntimeStates(annotations) {
    annotations.forEach(syncAnnotationRuntimeState);
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
function placeSessionObject(canvas, sessionObject) {
    ensureOnCanvas(canvas, sessionObject);
    moveObjectTo(canvas, sessionObject, withoutObject(canvas, sessionObject).length);
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
        delete textObject.imageEditorTextEditingHandledChange;
    };
    const exited = () => {
        var _a;
        const initial = textObject.imageEditorTextEditingInitialText;
        const finalText = String((_a = textObject.text) !== null && _a !== void 0 ? _a : '');
        const cancel = textObject.imageEditorTextEditingCancel === true;
        if (initial !== undefined) {
            textObject.imageEditorTextEditingHandledChange = true;
            queueMicrotask(() => {
                if (textObject.imageEditorTextEditingHandledChange === true) {
                    delete textObject.imageEditorTextEditingHandledChange;
                }
            });
        }
        if (cancel && initial !== undefined) {
            textObject.set({ text: initial });
        }
        delete textObject.imageEditorTextEditingInitialText;
        delete textObject.imageEditorTextEditingCancel;
        if (!cancel && initial !== undefined && initial !== finalText) {
            context.saveCanvasState();
            const callbackContext = context.buildCallbackContext('updateAnnotation');
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
        annotationSelectable: resolved.selectable,
        annotationEvented: resolved.evented,
        annotationHasControls: textbox.hasControls !== false,
        annotationEditable: resolved.editable,
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
    if (target && isTextAnnotationObject(target) && isAnnotationUnlocked(target)) {
        context.canvas.setActiveObject(target);
        (_b = (_a = target).enterEditing) === null || _b === void 0 ? void 0 : _b.call(_a);
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
    context.setTextSession(session);
    context.updateUi();
}
function exitTextMode(context) {
    const session = context.getTextSession();
    if (!session)
        return;
    finalizeActiveTextEditing(context, { commit: true });
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
        Object.defineProperty(this, "queuedExecuteCount", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "executeTail", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: Promise.resolve()
        });
        Object.defineProperty(this, "maxSize", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        const normalizedMaxSize = Number.isFinite(maxSize) ? Math.floor(maxSize) : 50;
        this.maxSize = Math.max(1, normalizedMaxSize);
    }
    async execute(command) {
        this.queuedExecuteCount += 1;
        const execution = this.executeTail.then(async () => {
            try {
                if (this.isProcessing) {
                    throw new Error('Cannot push to history while undo/redo is in flight.');
                }
                this.isProcessing = true;
                try {
                    await command.execute();
                    this.pushAndTrim(command, { skipProcessingCheck: true });
                }
                finally {
                    this.isProcessing = false;
                }
            }
            finally {
                this.queuedExecuteCount -= 1;
            }
        });
        this.executeTail = execution.catch(() => { });
        return execution;
    }
    push(command) {
        this.pushAndTrim(command);
    }
    clear() {
        this.history = [];
        this.currentIndex = -1;
        this.isProcessing = false;
        this.queuedExecuteCount = 0;
        this.executeTail = Promise.resolve();
    }
    canUndo() {
        return this.currentIndex >= 0;
    }
    canRedo() {
        return this.currentIndex < this.history.length - 1;
    }
    async undo() {
        if (this.isProcessing || this.queuedExecuteCount > 0 || !this.canUndo())
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
        if (this.isProcessing || this.queuedExecuteCount > 0 || !this.canRedo())
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
    assertCanPush() {
        if (!this.isProcessing && this.queuedExecuteCount === 0)
            return;
        throw new Error('Cannot push to history while undo/redo is in flight.');
    }
    pushAndTrim(command, options) {
        if (!(options === null || options === void 0 ? void 0 : options.skipProcessingCheck))
            this.assertCanPush();
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

async function loadFromStateAction(access, jsonString, options) {
    var _a, _b, _c, _d;
    const canvas = access.getCanvas();
    if (!jsonString || !canvas)
        return;
    if (access.isDisposed())
        return;
    if (!access.canRunIdleOperation('loadFromState', options))
        return;
    const activeRestoreOperation = access.getActiveStateRestoreOperation();
    const context = access.buildCallbackContext(activeRestoreOperation !== null && activeRestoreOperation !== void 0 ? activeRestoreOperation : 'loadFromState', activeRestoreOperation === 'undo' || activeRestoreOperation === 'redo');
    const previousImage = access.getOriginalImage();
    const previousMaskSignature = access.getMaskCollectionSignature();
    const previousAnnotationSignature = access.getAnnotationCollectionSignature();
    try {
        const restoredState = await loadFromState({
            canvas,
            jsonString,
            setCanvasSize: (widthPx, heightPx) => access.setCanvasSize(widthPx, heightPx),
            maxCanvasPixels: access.getOptions().maxExportPixels,
        });
        if (access.isDisposed() || !access.getCanvas())
            return;
        access.hideAllMaskLabels();
        access.setOriginalImage(restoredState.originalImage);
        const originalImage = restoredState.originalImage;
        if (originalImage) {
            originalImage.set({
                originX: 'left',
                originY: 'top',
                selectable: false,
                evented: false,
                hasControls: false,
                hoverCursor: 'default',
            });
            (_a = access.getCanvas()) === null || _a === void 0 ? void 0 : _a.sendObjectToBack(originalImage);
        }
        access.setMaskCounter(restoredState.maxMaskId);
        access.setAnnotationCounter(restoredState.maxAnnotationId);
        const editorState = restoredState.editorState;
        if (editorState) {
            access.setCurrentScale(editorState.currentScale);
            access.setCurrentRotation(editorState.currentRotation);
            access.setBaseImageScale(editorState.baseImageScale);
        }
        if (originalImage) {
            access.setCurrentImageMimeType(editorState && 'currentImageMimeType' in editorState
                ? ((_b = editorState.currentImageMimeType) !== null && _b !== void 0 ? _b : null)
                : access.inferCurrentImageMimeType());
            access.restoreImageFilterConfig((_c = editorState === null || editorState === void 0 ? void 0 : editorState.imageFilterConfig) !== null && _c !== void 0 ? _c : null);
        }
        else {
            access.setCurrentImageMimeType(null);
            access.restoreImageFilterConfig(null);
        }
        access.setIsImageLoadedToCanvas(!!originalImage);
        if (originalImage && access.shouldNormalizeCanvasSizeAfterStateRestore()) {
            access.updateCanvasSizeToImageBounds({ stabilizeContainedViewport: false });
            access.alignObjectBoundingBoxToCanvasTopLeft(originalImage);
        }
        if (originalImage)
            access.settleFitCoverScrollbarsAfterStateRestore();
        const restoredMasks = restoredState.masks;
        access.setLastMask(restoredMasks.reduce((lastMask, maskObject) => !lastMask || maskObject.maskId > lastMask.maskId ? maskObject : lastMask, null));
        restoredMasks.forEach((maskObject) => {
            applyMaskUnselectedStyle(maskObject);
            reattachMaskHoverHandlers(maskObject);
        });
        syncAnnotationRuntimeStates(restoredState.annotations);
        attachTextEditingHandlersToAnnotations(access.buildTextControllerContext(), restoredState.annotations);
        access.setLastSnapshot(captureSnapshotAction(access));
        (_d = access.getCanvas()) === null || _d === void 0 ? void 0 : _d.renderAll();
        access.updateInputs();
        access.updateMaskList();
        access.updateAnnotationList();
        access.updateUi();
        if (previousImage && previousImage !== access.getOriginalImage()) {
            access.emitImageCleared(previousImage, context);
        }
        if (previousMaskSignature !== access.getMaskCollectionSignature()) {
            access.emitMasksChanged(context);
        }
        if (previousAnnotationSignature !== access.getAnnotationCollectionSignature()) {
            access.emitAnnotationsChanged(context);
        }
        access.emitImageChanged(context);
        restoreActiveSelection(access, restoredState, editorState, context);
    }
    catch (error) {
        reportError(access.getOptions(), error, 'Failed to restore canvas state.');
        throw error;
    }
}
function saveStateAction(access, options) {
    var _a, _b, _c;
    const canvas = access.getCanvas();
    if (!canvas || access.shouldSuppressSaveState())
        return;
    if (!access.canRunIdleOperation('saveState', options))
        return;
    const activeObj = canvas.getActiveObject();
    const activeMask = getActiveMaskForSnapshot(canvas);
    const activeAnnotation = getActiveAnnotationForSnapshot(canvas);
    access.hideAllMaskLabels();
    try {
        const after = saveState({
            canvas,
            activeMaskId: (_a = activeMask === null || activeMask === void 0 ? void 0 : activeMask.maskId) !== null && _a !== void 0 ? _a : null,
            activeAnnotationId: (_b = activeAnnotation === null || activeAnnotation === void 0 ? void 0 : activeAnnotation.annotationId) !== null && _b !== void 0 ? _b : null,
            currentScale: access.getCurrentScale(),
            currentRotation: access.getCurrentRotation(),
            baseImageScale: access.getBaseImageScale(),
            currentImageMimeType: access.getCurrentImageMimeType(),
            imageFilterConfig: access.getCurrentImageFilterConfig(),
        });
        const before = (_c = access.getLastSnapshot()) !== null && _c !== void 0 ? _c : after;
        if (after === before)
            return;
        const cmd = new Command(async () => {
            await loadFromStateAction(access, after, access.withAnimationQueueBypass());
        }, async () => {
            await loadFromStateAction(access, before, access.withAnimationQueueBypass());
        });
        access.getHistoryManager().push(cmd);
        access.setLastSnapshot(after);
    }
    catch (error) {
        reportWarning(access.getOptions(), error, 'Failed to capture canvas snapshot.');
    }
    finally {
        restoreActiveObjectAfterSnapshot(access, activeObj, activeMask, activeAnnotation);
        access.updateUi();
    }
}
function captureSnapshotAction(access) {
    var _a, _b;
    const canvas = access.getCanvas();
    if (!canvas) {
        throw new Error('[ImageEditor] Cannot capture canvas snapshot before init or after dispose.');
    }
    const activeMask = getActiveMaskForSnapshot(canvas);
    const activeAnnotation = getActiveAnnotationForSnapshot(canvas);
    access.hideAllMaskLabels();
    return saveState({
        canvas,
        activeMaskId: (_a = activeMask === null || activeMask === void 0 ? void 0 : activeMask.maskId) !== null && _a !== void 0 ? _a : null,
        activeAnnotationId: (_b = activeAnnotation === null || activeAnnotation === void 0 ? void 0 : activeAnnotation.annotationId) !== null && _b !== void 0 ? _b : null,
        currentScale: access.getCurrentScale(),
        currentRotation: access.getCurrentRotation(),
        baseImageScale: access.getBaseImageScale(),
        currentImageMimeType: access.getCurrentImageMimeType(),
        imageFilterConfig: access.getCurrentImageFilterConfig(),
    });
}
function restoreActiveSelection(access, restoredState, editorState, context) {
    const canvas = access.getLiveCanvas('loadFromState');
    const activeMaskId = editorState === null || editorState === void 0 ? void 0 : editorState.activeMaskId;
    const activeAnnotationId = editorState === null || editorState === void 0 ? void 0 : editorState.activeAnnotationId;
    if ((editorState === null || editorState === void 0 ? void 0 : editorState.activeObjectKind) === 'mask' && typeof activeMaskId === 'number') {
        const activeMask = restoredState.masks.find((maskObject) => maskObject.maskId === activeMaskId);
        if (activeMask) {
            access.withSelectionChangeContext(context, () => {
                canvas.setActiveObject(activeMask);
                access.handleSelectionChanged([activeMask]);
            });
        }
    }
    else if ((editorState === null || editorState === void 0 ? void 0 : editorState.activeObjectKind) === 'annotation' &&
        typeof activeAnnotationId === 'number') {
        const activeAnnotation = restoredState.annotations.find((annotation) => annotation.annotationId === activeAnnotationId);
        if (activeAnnotation) {
            access.withSelectionChangeContext(context, () => {
                canvas.setActiveObject(activeAnnotation);
                access.handleSelectionChanged([activeAnnotation]);
            });
        }
    }
}
function getActiveMaskForSnapshot(canvas) {
    const activeObject = canvas.getActiveObject();
    return activeObject && isMaskObject(activeObject) ? activeObject : null;
}
function getActiveAnnotationForSnapshot(canvas) {
    const activeObject = canvas.getActiveObject();
    return activeObject && isAnnotationObject(activeObject) ? activeObject : null;
}
function restoreActiveObjectAfterSnapshot(access, activeObj, activeMask, activeAnnotation) {
    const canvas = access.getCanvas();
    if (!canvas)
        return;
    const maskToRestore = activeObj && isMaskObject(activeObj) ? activeObj : activeMask;
    const annotationToRestore = activeObj && isAnnotationObject(activeObj) ? activeObj : activeAnnotation;
    if (maskToRestore && canvas.getObjects().includes(maskToRestore)) {
        canvas.setActiveObject(maskToRestore);
        access.showLabelForMask(maskToRestore);
        access.updateMaskListSelection(maskToRestore);
        return;
    }
    if (annotationToRestore && canvas.getObjects().includes(annotationToRestore)) {
        canvas.setActiveObject(annotationToRestore);
        access.updateAnnotationListSelection(annotationToRestore);
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
function orderAnnotationsForList(annotations, order) {
    const ordered = annotations.slice();
    return order === 'back-to-front' ? ordered : ordered.reverse();
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
        hasControls: annotation.hasControls,
        editable: isTextAnnotationObject(annotation)
            ? annotation.editable
            : undefined,
        annotationHidden: annotation.annotationHidden,
        annotationLocked: annotation.annotationLocked,
        annotationSelectable: annotation.annotationSelectable,
        annotationEvented: annotation.annotationEvented,
        annotationHasControls: annotation.annotationHasControls,
        annotationEditable: annotation.annotationEditable,
    });
}
function setAnnotationProps(annotation, props) {
    annotation.set(props);
}
function getCurrentAnnotationListCanvas(context) {
    var _a, _b;
    return (_b = (_a = context.getCanvas) === null || _a === void 0 ? void 0 : _a.call(context)) !== null && _b !== void 0 ? _b : context.canvas;
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
function updateShapeAnnotation(annotation, config) {
    const props = {};
    const raw = config;
    if (typeof raw.stroke === 'string')
        props.stroke = raw.stroke;
    if (typeof raw.strokeWidth === 'number' &&
        Number.isFinite(raw.strokeWidth) &&
        raw.strokeWidth > 0) {
        props.strokeWidth = raw.strokeWidth;
    }
    if (typeof raw.fill === 'string')
        props.fill = raw.fill;
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
        if (typeof raw.selectable === 'boolean') {
            annotation.annotationSelectable = raw.selectable;
        }
        if (typeof raw.evented === 'boolean') {
            annotation.annotationEvented = raw.evented;
        }
        if (typeof raw.hasControls === 'boolean') {
            annotation.annotationHasControls = raw.hasControls;
        }
        if (isTextAnnotationObject(annotation)) {
            if (typeof raw.editable === 'boolean') {
                annotation.annotationEditable = raw.editable;
            }
            updateTextAnnotation(annotation, config);
        }
        if (isDrawAnnotationObject(annotation))
            updateDrawAnnotation(annotation, config);
        if (isShapeAnnotationObject(annotation))
            updateShapeAnnotation(annotation, config);
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
function renderAnnotationList(context) {
    const listEl = context.getListElement();
    const canvas = getCurrentAnnotationListCanvas(context);
    if (!listEl || !canvas)
        return;
    const ownerDocument = listEl.ownerDocument;
    listEl.innerHTML = '';
    orderAnnotationsForList(getAnnotations(canvas), context.listOrder).forEach((annotation) => {
        const item = ownerDocument.createElement('li');
        item.className = 'list-group-item annotation-item';
        item.textContent = annotation.annotationName;
        item.dataset.annotationId = String(annotation.annotationId);
        item.addEventListener('click', () => {
            const id = Number(item.dataset.annotationId);
            if (!Number.isFinite(id))
                return;
            const liveCanvas = getCurrentAnnotationListCanvas(context);
            if (!liveCanvas)
                return;
            const target = getAnnotations(liveCanvas).find((candidate) => candidate.annotationId === id);
            if (!target)
                return;
            liveCanvas.setActiveObject(target);
            context.onAnnotationSelected(target);
        });
        listEl.appendChild(item);
    });
}
function updateAnnotationListSelection(context, selectedAnnotation) {
    const listEl = context.getListElement();
    if (!listEl)
        return;
    const selectedId = selectedAnnotation ? String(selectedAnnotation.annotationId) : null;
    listEl.querySelectorAll('.annotation-item').forEach((item) => {
        item.classList.toggle('active', selectedId !== null && item.dataset.annotationId === selectedId);
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
function setDrawingMode(context, enabled) {
    const canvasWithDrawing = context.canvas;
    canvasWithDrawing.isDrawingMode = enabled;
}
function createEraserPreview(context) {
    const config = context.getEraserConfig();
    const circle = new context.fabric.Circle({
        left: 0,
        top: 0,
        radius: config.brushSize / 2,
        originX: 'center',
        originY: 'center',
        fill: config.previewFill,
        stroke: config.previewStroke,
        strokeWidth: config.previewStrokeWidth,
        selectable: false,
        evented: false,
        excludeFromExport: true,
        objectCaching: false,
        visible: false,
    });
    return markSessionObject(circle, 'eraserPreview');
}
function ensureEraserPreview(context, session) {
    var _a;
    const preview = (_a = session.eraserPreview) !== null && _a !== void 0 ? _a : createEraserPreview(context);
    session.eraserPreview = preview;
    const config = context.getEraserConfig();
    preview.set({
        radius: config.brushSize / 2,
        fill: config.previewFill,
        stroke: config.previewStroke,
        strokeWidth: config.previewStrokeWidth,
    });
    if (!context.canvas.getObjects().includes(preview)) {
        context.canvas.add(preview);
    }
    placeSessionObject(context.canvas, preview);
    return preview;
}
function hideEraserPreview(context, session) {
    if (!session.eraserPreview)
        return;
    session.eraserPreview.set({ visible: false });
    context.canvas.requestRenderAll();
}
function removeEraserPreview(context, session) {
    if (!session.eraserPreview)
        return;
    try {
        context.canvas.remove(session.eraserPreview);
    }
    catch {
    }
    session.eraserPreview = null;
}
function moveEraserPreview(context, session, point) {
    const preview = ensureEraserPreview(context, session);
    preview.set({ left: point.x, top: point.y, visible: session.subMode === 'erase' });
    context.canvas.requestRenderAll();
}
function pushEraserPoint(context, session, point) {
    const previous = session.eraserPoints[session.eraserPoints.length - 1];
    if (!previous) {
        session.eraserPoints.push(point);
        return;
    }
    const radius = Math.max(1, context.getEraserConfig().brushSize / 2);
    const spacing = Math.max(1, radius / 2);
    const distance = Math.hypot(point.x - previous.x, point.y - previous.y);
    const steps = Math.max(1, Math.ceil(distance / spacing));
    for (let index = 1; index <= steps; index += 1) {
        const t = index / steps;
        session.eraserPoints.push({
            x: previous.x + (point.x - previous.x) * t,
            y: previous.y + (point.y - previous.y) * t,
        });
    }
}
function pointIntersectsExpandedBounds(point, bounds, radius) {
    return (point.x >= bounds.left - radius &&
        point.x <= bounds.left + bounds.width + radius &&
        point.y >= bounds.top - radius &&
        point.y <= bounds.top + bounds.height + radius);
}
function getIntersectedDrawAnnotations(context, points) {
    if (points.length === 0)
        return [];
    const radius = Math.max(1, context.getEraserConfig().brushSize / 2);
    return context.canvas
        .getObjects()
        .filter(isDrawAnnotationObject)
        .filter((annotation) => {
        const bounds = getObjectBBox(annotation);
        return points.some((point) => pointIntersectsExpandedBounds(point, bounds, radius));
    });
}
function commitEraserStroke(context, session) {
    const removed = getIntersectedDrawAnnotations(context, session.eraserPoints);
    session.eraserPoints = [];
    session.isErasing = false;
    if (removed.length === 0)
        return;
    removed.forEach((annotation) => {
        context.canvas.remove(annotation);
    });
    context.canvas.discardActiveObject();
    context.canvas.renderAll();
    context.saveCanvasState();
    context.updateAnnotationList();
    context.updateUi();
    const callbackContext = context.buildCallbackContext('commitEraserStroke');
    context.emitAnnotationsChanged(callbackContext);
    context.emitImageChanged(callbackContext);
}
function handleEraserPointerDown(context, event) {
    const session = context.getDrawSession();
    if (!session || session.subMode !== 'erase')
        return;
    const pointer = getPointerFromFabricEvent(context.canvas, event);
    if (!pointer)
        return;
    session.isErasing = true;
    session.eraserPoints = [];
    pushEraserPoint(context, session, pointer);
    moveEraserPreview(context, session, pointer);
}
function handleEraserPointerMove(context, event) {
    const session = context.getDrawSession();
    if (!session || session.subMode !== 'erase')
        return;
    const pointer = getPointerFromFabricEvent(context.canvas, event);
    if (!pointer) {
        hideEraserPreview(context, session);
        return;
    }
    moveEraserPreview(context, session, pointer);
    if (session.isErasing)
        pushEraserPoint(context, session, pointer);
}
function handleEraserPointerUp(context, event) {
    const session = context.getDrawSession();
    if (!session || session.subMode !== 'erase')
        return;
    const pointer = getPointerFromFabricEvent(context.canvas, event);
    if (pointer) {
        pushEraserPoint(context, session, pointer);
        moveEraserPreview(context, session, pointer);
    }
    commitEraserStroke(context, session);
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
        annotationSelectable: config.selectable,
        annotationEvented: config.evented,
        annotationHasControls: path.hasControls !== false,
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
    const pathCreatedCallback = (event) => handlePathCreated(context, event);
    canvas.on('path:created', pathCreatedCallback);
    const mouseDownCallback = (event) => handleEraserPointerDown(context, event);
    const mouseMoveCallback = (event) => handleEraserPointerMove(context, event);
    const mouseUpCallback = (event) => handleEraserPointerUp(context, event);
    const mouseOutCallback = () => {
        const session = context.getDrawSession();
        if (session)
            hideEraserPreview(context, session);
    };
    canvas.on('mouse:down', mouseDownCallback);
    canvas.on('mouse:move', mouseMoveCallback);
    canvas.on('mouse:up', mouseUpCallback);
    canvas.on('mouse:out', mouseOutCallback);
    const session = {
        mode: 'draw',
        subMode: 'brush',
        previousDrawingMode,
        previousBrush,
        previousCanvasSelection,
        previousDefaultCursor,
        eraserPreview: null,
        eraserPoints: [],
        isErasing: false,
        handlers: [
            { eventName: 'path:created', callback: pathCreatedCallback },
            { eventName: 'mouse:down', callback: mouseDownCallback },
            { eventName: 'mouse:move', callback: mouseMoveCallback },
            { eventName: 'mouse:up', callback: mouseUpCallback },
            { eventName: 'mouse:out', callback: mouseOutCallback },
        ],
        dispose: () => {
            for (const record of session.handlers) {
                try {
                    canvas.off(record.eventName, record.callback);
                }
                catch {
                }
            }
            removeEraserPreview(context, session);
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
function setDrawSubMode(context, subMode) {
    const session = context.getDrawSession();
    if (!session)
        return;
    if (session.subMode === subMode)
        return;
    session.subMode = subMode;
    session.isErasing = false;
    session.eraserPoints = [];
    if (subMode === 'brush') {
        hideEraserPreview(context, session);
        configureBrush(context);
        setDrawingMode(context, true);
    }
    else {
        setDrawingMode(context, false);
        ensureEraserPreview(context, session).set({ visible: false });
    }
    context.canvas.requestRenderAll();
    context.updateUi();
}
function updateEraserPreview(context) {
    const session = context.getDrawSession();
    if (!session || session.subMode !== 'erase')
        return;
    const preview = ensureEraserPreview(context, session);
    preview.set({ visible: false });
    context.canvas.requestRenderAll();
}

const MIN_INTERACTIVE_SHAPE_SIZE = 2;
function resolveDefaultShapePosition(context) {
    const image = context.getOriginalImage();
    if (image) {
        const bounds = getObjectBBox(image);
        return { left: Math.round(bounds.left + 16), top: Math.round(bounds.top + 16) };
    }
    return { left: 16, top: 16 };
}
function resolveShapeCreationConfig(context, config) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const base = mergeShapeAnnotationConfigPatch(context.getShapeConfig(), config);
    const fallback = resolveDefaultShapePosition(context);
    const leftInput = (_a = config.left) !== null && _a !== void 0 ? _a : base.left;
    const topInput = (_b = config.top) !== null && _b !== void 0 ? _b : base.top;
    const x1Input = (_d = (_c = config.x1) !== null && _c !== void 0 ? _c : base.x1) !== null && _d !== void 0 ? _d : leftInput;
    const y1Input = (_f = (_e = config.y1) !== null && _e !== void 0 ? _e : base.y1) !== null && _f !== void 0 ? _f : topInput;
    const x2Input = (_g = config.x2) !== null && _g !== void 0 ? _g : base.x2;
    const y2Input = (_h = config.y2) !== null && _h !== void 0 ? _h : base.y2;
    const left = resolveNumeric(leftInput, 'x', fallback.left, context.canvas, context.options);
    const top = resolveNumeric(topInput, 'y', fallback.top, context.canvas, context.options);
    const x1 = resolveNumeric(x1Input, 'x', left, context.canvas, context.options);
    const y1 = resolveNumeric(y1Input, 'y', top, context.canvas, context.options);
    return {
        ...base,
        left,
        top,
        x1,
        y1,
        x2: resolveNumeric(x2Input, 'x', x1 + base.width, context.canvas, context.options),
        y2: resolveNumeric(y2Input, 'y', y1 + base.height, context.canvas, context.options),
    };
}
function geometryFromResolved(config) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const x1 = (_b = (_a = config.x1) !== null && _a !== void 0 ? _a : config.left) !== null && _b !== void 0 ? _b : 0;
    const y1 = (_d = (_c = config.y1) !== null && _c !== void 0 ? _c : config.top) !== null && _d !== void 0 ? _d : 0;
    const x2 = (_e = config.x2) !== null && _e !== void 0 ? _e : x1 + config.width;
    const y2 = (_f = config.y2) !== null && _f !== void 0 ? _f : y1 + config.height;
    return {
        left: (_g = config.left) !== null && _g !== void 0 ? _g : Math.min(x1, x2),
        top: (_h = config.top) !== null && _h !== void 0 ? _h : Math.min(y1, y2),
        width: config.width,
        height: config.height,
        x1,
        y1,
        x2,
        y2,
    };
}
function geometryFromPoints(start, end) {
    return {
        left: Math.min(start.x, end.x),
        top: Math.min(start.y, end.y),
        width: Math.abs(end.x - start.x),
        height: Math.abs(end.y - start.y),
        x1: start.x,
        y1: start.y,
        x2: end.x,
        y2: end.y,
    };
}
function buildArrowPath(geometry, headLength) {
    const { x1, y1, x2, y2 } = geometry;
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const length = Math.max(1, headLength);
    const wingAngle = Math.PI / 7;
    const head1x = x2 - length * Math.cos(angle - wingAngle);
    const head1y = y2 - length * Math.sin(angle - wingAngle);
    const head2x = x2 - length * Math.cos(angle + wingAngle);
    const head2y = y2 - length * Math.sin(angle + wingAngle);
    return `M ${x1} ${y1} L ${x2} ${y2} M ${x2} ${y2} L ${head1x} ${head1y} M ${x2} ${y2} L ${head2x} ${head2y}`;
}
function createShapeFabricObject(context, shape, geometry, config) {
    const common = {
        stroke: config.stroke,
        strokeWidth: config.strokeWidth,
        strokeDashArray: config.strokeDashArray ? [...config.strokeDashArray] : undefined,
        opacity: config.opacity,
        angle: config.angle,
        selectable: config.selectable,
        evented: config.evented,
        originX: 'left',
        originY: 'top',
        ...config.styles,
    };
    if (shape === 'rect') {
        return new context.fabric.Rect({
            left: geometry.left,
            top: geometry.top,
            width: Math.max(MIN_INTERACTIVE_SHAPE_SIZE, geometry.width),
            height: Math.max(MIN_INTERACTIVE_SHAPE_SIZE, geometry.height),
            fill: config.fill,
            ...common,
        });
    }
    const path = shape === 'arrow'
        ? buildArrowPath(geometry, config.arrowHeadLength)
        : `M ${geometry.x1} ${geometry.y1} L ${geometry.x2} ${geometry.y2}`;
    return new context.fabric.Path(path, {
        fill: '',
        strokeLineCap: 'round',
        strokeLineJoin: 'round',
        objectCaching: false,
        ...common,
    });
}
function nextShapeAnnotationMeta(context, config) {
    const annotationId = context.getAnnotationCounter() + 1;
    context.setAnnotationCounter(annotationId);
    return {
        annotationId,
        annotationName: `${context.options.shapeAnnotationName}${annotationId}`,
        annotationHidden: config.annotationHidden,
        annotationLocked: config.annotationLocked,
    };
}
function markShapeAnnotation(context, object, config) {
    const meta = nextShapeAnnotationMeta(context, config);
    const annotation = markAnnotationObject(object, {
        annotationId: meta.annotationId,
        annotationType: 'shape',
        annotationName: meta.annotationName,
        annotationHidden: meta.annotationHidden,
        annotationLocked: meta.annotationLocked,
        annotationSelectable: config.selectable,
        annotationEvented: config.evented,
        annotationHasControls: object.hasControls !== false,
    });
    annotation.shapeAnnotationKind = config.shape;
    syncAnnotationRuntimeState(annotation);
    return annotation;
}
function createShapeAnnotation(context, config = {}) {
    if (!context.isImageLoaded())
        return null;
    const resolved = resolveShapeCreationConfig(context, config);
    const geometry = geometryFromResolved(resolved);
    const object = createShapeFabricObject(context, resolved.shape, geometry, resolved);
    const annotation = markShapeAnnotation(context, object, resolved);
    placeAnnotationObject(context.canvas, annotation);
    if (resolved.selectable !== false && isAnnotationUnlocked(annotation)) {
        context.canvas.setActiveObject(annotation);
    }
    context.canvas.renderAll();
    context.updateAnnotationList();
    context.saveCanvasState();
    const callbackContext = context.buildCallbackContext('createShapeAnnotation');
    context.emitAnnotationsChanged(callbackContext);
    context.emitImageChanged(callbackContext);
    return annotation;
}
function isMeaningfulGeometry(shape, geometry) {
    if (shape === 'rect') {
        return (geometry.width >= MIN_INTERACTIVE_SHAPE_SIZE &&
            geometry.height >= MIN_INTERACTIVE_SHAPE_SIZE);
    }
    return (Math.hypot(geometry.x2 - geometry.x1, geometry.y2 - geometry.y1) >=
        MIN_INTERACTIVE_SHAPE_SIZE);
}
function createPreviewObject(context, shape, geometry) {
    const config = { ...context.getShapeConfig()};
    const preview = createShapeFabricObject(context, shape, geometry, config);
    preview.set({
        selectable: false,
        evented: false,
        excludeFromExport: true,
        objectCaching: false,
    });
    markSessionObject(preview, 'shapePreview');
    return preview;
}
function removePreview(context, session) {
    if (!session.previewObject)
        return;
    try {
        context.canvas.remove(session.previewObject);
    }
    catch {
    }
    session.previewObject = null;
}
function updateActiveSessionShape(context, session, shape) {
    const changed = session.shape !== shape;
    session.shape = shape;
    session.startPoint = null;
    removePreview(context, session);
    if (changed) {
        context.canvas.requestRenderAll();
        context.updateUi();
    }
}
function updatePreview(context, session, pointer) {
    if (!session.startPoint)
        return;
    const geometry = geometryFromPoints(session.startPoint, pointer);
    removePreview(context, session);
    if (!isMeaningfulGeometry(session.shape, geometry)) {
        context.canvas.requestRenderAll();
        return;
    }
    const preview = createPreviewObject(context, session.shape, geometry);
    session.previewObject = preview;
    placeSessionObject(context.canvas, preview);
    context.canvas.requestRenderAll();
}
function completeInteractiveShape(context, session, pointer) {
    if (!session.startPoint)
        return;
    const geometry = geometryFromPoints(session.startPoint, pointer);
    session.startPoint = null;
    removePreview(context, session);
    if (!isMeaningfulGeometry(session.shape, geometry)) {
        context.canvas.requestRenderAll();
        return;
    }
    if (session.shape === 'rect') {
        createShapeAnnotation(context, {
            shape: 'rect',
            left: geometry.left,
            top: geometry.top,
            width: geometry.width,
            height: geometry.height,
        });
        return;
    }
    createShapeAnnotation(context, {
        shape: session.shape,
        x1: geometry.x1,
        y1: geometry.y1,
        x2: geometry.x2,
        y2: geometry.y2,
    });
}
function attachCanvasHandler$1(context, session, eventName, callback) {
    context.canvas.on(eventName, callback);
    session.handlers.push({ eventName, callback });
}
function detachCanvasHandlers$1(context, session) {
    for (const record of session.handlers) {
        try {
            context.canvas.off(record.eventName, record.callback);
        }
        catch {
        }
    }
    session.handlers = [];
}
function enterShapeMode(context, shape) {
    const existingSession = context.getShapeSession();
    if (existingSession) {
        updateActiveSessionShape(context, existingSession, shape);
        return;
    }
    if (!context.isImageLoaded())
        return;
    const { canvas } = context;
    const previousCanvasSelection = !!canvas.selection;
    const previousDefaultCursor = canvas.defaultCursor;
    canvas.selection = false;
    canvas.defaultCursor = 'crosshair';
    const session = {
        mode: 'shape',
        shape,
        previousCanvasSelection,
        previousDefaultCursor,
        startPoint: null,
        previewObject: null,
        handlers: [],
        dispose: () => {
            detachCanvasHandlers$1(context, session);
            removePreview(context, session);
            canvas.selection = previousCanvasSelection;
            canvas.defaultCursor = previousDefaultCursor !== null && previousDefaultCursor !== void 0 ? previousDefaultCursor : 'default';
        },
    };
    attachCanvasHandler$1(context, session, 'mouse:down', (event) => {
        const pointer = getPointerFromFabricEvent(canvas, event);
        if (!pointer)
            return;
        canvas.discardActiveObject();
        session.startPoint = pointer;
    });
    attachCanvasHandler$1(context, session, 'mouse:move', (event) => {
        const pointer = getPointerFromFabricEvent(canvas, event);
        if (!pointer || !session.startPoint)
            return;
        updatePreview(context, session, pointer);
    });
    attachCanvasHandler$1(context, session, 'mouse:up', (event) => {
        const pointer = getPointerFromFabricEvent(canvas, event);
        if (!pointer) {
            session.startPoint = null;
            removePreview(context, session);
            return;
        }
        completeInteractiveShape(context, session, pointer);
    });
    context.setShapeSession(session);
    context.updateUi();
}
function syncShapeModeConfig(context) {
    const session = context.getShapeSession();
    if (!session)
        return;
    updateActiveSessionShape(context, session, context.getShapeConfig().shape);
}
function exitShapeMode(context) {
    const session = context.getShapeSession();
    if (!session)
        return;
    session.dispose();
    context.setShapeSession(null);
    context.canvas.requestRenderAll();
    context.updateUi();
}

function enterTextModeAction(access) {
    if (!access.getCanvas())
        return;
    if (!access.canRunIdleOperation('enterTextMode'))
        return;
    if (access.isToolModeActive())
        return;
    enterTextMode(access.buildTextControllerContext());
    const callbackContext = access.buildCallbackContext('enterTextMode', false);
    access.emitBusyChangeIfChanged(callbackContext);
    access.emitImageChanged(callbackContext);
}
function exitTextModeAction(access) {
    if (!access.getCanvas() || !access.getTextSession())
        return;
    if (!access.canRunIdleOperation('exitTextMode'))
        return;
    exitTextMode(access.buildTextControllerContext());
    const callbackContext = access.buildCallbackContext('exitTextMode', false);
    access.emitBusyChangeIfChanged(callbackContext);
    access.emitImageChanged(callbackContext);
}
function createTextAnnotationAction(access, config = {}) {
    if (!access.getCanvas())
        return null;
    if (!access.canRunIdleOperation('createTextAnnotation'))
        return null;
    return createTextAnnotation(access.buildTextControllerContext(), config);
}
function enterDrawModeAction(access) {
    if (!access.getCanvas())
        return;
    if (!access.canRunIdleOperation('enterDrawMode'))
        return;
    if (access.isToolModeActive())
        return;
    enterDrawMode(access.buildDrawControllerContext());
    const callbackContext = access.buildCallbackContext('enterDrawMode', false);
    access.emitBusyChangeIfChanged(callbackContext);
    access.emitImageChanged(callbackContext);
}
function exitDrawModeAction(access) {
    if (!access.getCanvas() || !access.getDrawSession())
        return;
    if (!access.canRunIdleOperation('exitDrawMode'))
        return;
    exitDrawMode(access.buildDrawControllerContext());
    const callbackContext = access.buildCallbackContext('exitDrawMode', false);
    access.emitBusyChangeIfChanged(callbackContext);
    access.emitImageChanged(callbackContext);
}

function applyTextConfigPatchAction(access, config, operation) {
    if (!access.canRunIdleOperation(operation))
        return;
    const invalidFields = getInvalidTextAnnotationConfigFields(config);
    if (invalidFields.length > 0) {
        access.reportWarning(null, `${operation} ignored invalid Text config fields: ${invalidFields.join(', ')}.`);
    }
    const next = mergeTextAnnotationConfigPatch(access.getCurrentTextConfig(), config, access.getDefaultTextConfig());
    if (areResolvedTextAnnotationConfigsEqual(access.getCurrentTextConfig(), next))
        return;
    access.setCurrentTextConfig(next);
    access.updateInputs();
    access.updateUi();
    access.emitImageChanged(access.buildCallbackContext(operation, false));
}
function applyDrawConfigPatchAction(access, config, operation) {
    if (!access.canRunIdleOperation(operation))
        return;
    const invalidFields = getInvalidDrawConfigFields(config);
    if (invalidFields.length > 0) {
        access.reportWarning(null, `${operation} ignored invalid Draw config fields: ${invalidFields.join(', ')}.`);
    }
    const next = mergeDrawConfigPatch(access.getCurrentDrawConfig(), config, access.getDefaultDrawConfig());
    if (areResolvedDrawConfigsEqual(access.getCurrentDrawConfig(), next))
        return;
    access.setCurrentDrawConfig(next);
    updateDrawBrush(access.buildDrawControllerContext());
    access.updateInputs();
    access.updateUi();
    access.emitImageChanged(access.buildCallbackContext(operation, false));
}
function applyTextColorInputAction(access, color) {
    var _a;
    if (access.isTextMode()) {
        access.setTextColor(color);
        return;
    }
    const selected = (_a = access.getCanvas()) === null || _a === void 0 ? void 0 : _a.getActiveObject();
    if (selected && isTextAnnotationObject(selected)) {
        access.updateSelectedAnnotation({ fill: color });
        return;
    }
    access.setTextColor(color);
}
function applyTextFontSizeInputAction(access, size) {
    var _a;
    if (access.isTextMode()) {
        access.setTextFontSize(size);
        return;
    }
    const selected = (_a = access.getCanvas()) === null || _a === void 0 ? void 0 : _a.getActiveObject();
    if (selected && isTextAnnotationObject(selected)) {
        access.updateSelectedAnnotation({ fontSize: size });
        return;
    }
    access.setTextFontSize(size);
}
function applyDrawColorInputAction(access, color) {
    var _a;
    if (access.isDrawMode()) {
        access.setDrawColor(color);
        return;
    }
    const selected = (_a = access.getCanvas()) === null || _a === void 0 ? void 0 : _a.getActiveObject();
    if (selected && isDrawAnnotationObject(selected)) {
        access.updateSelectedAnnotation({ stroke: color });
        return;
    }
    access.setDrawColor(color);
}
function applyDrawBrushSizeInputAction(access, size) {
    var _a;
    if (access.isDrawMode()) {
        access.setDrawBrushSize(size);
        return;
    }
    const selected = (_a = access.getCanvas()) === null || _a === void 0 ? void 0 : _a.getActiveObject();
    if (selected && isDrawAnnotationObject(selected)) {
        access.updateSelectedAnnotation({ strokeWidth: size });
        return;
    }
    access.setDrawBrushSize(size);
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
function finitePositiveRatio(numerator, denominator) {
    const ratio = Number(numerator) / Number(denominator);
    return Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
}
function resolvePostCropMaskPlacement(context, cropRegion) {
    const postCropImage = context.getOriginalImage();
    if (!postCropImage) {
        return { left: 0, top: 0, scaleX: 1, scaleY: 1 };
    }
    postCropImage.setCoords();
    const imageBounds = postCropImage.getBoundingRect();
    return {
        left: finiteNumberOrFallback(imageBounds.left, 0),
        top: finiteNumberOrFallback(imageBounds.top, 0),
        scaleX: finitePositiveRatio(imageBounds.width, cropRegion.width),
        scaleY: finitePositiveRatio(imageBounds.height, cropRegion.height),
    };
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
    const placement = resolvePostCropMaskPlacement(context, cropRegion);
    let maxRestoredId = 0;
    for (const record of records) {
        try {
            restoreMaskStyleBackup(record.styleBackup);
            record.mask.set({
                left: placement.left + (record.left - cropRegion.left) * placement.scaleX,
                top: placement.top + (record.top - cropRegion.top) * placement.scaleY,
                angle: record.angle,
                scaleX: record.scaleX * placement.scaleX,
                scaleY: record.scaleY * placement.scaleY,
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
    const available = resolvePaddedCropArea(boundsLeft, boundsTop, maxCropWidth, maxCropHeight, padding);
    if (aspectRatio === null) {
        rectWidth = Math.max(minCropWidth, available.width);
        rectHeight = Math.max(minCropHeight, available.height);
        rectLeft = Math.min(boundsLeft + maxCropWidth - rectWidth, Math.max(boundsLeft, available.left + (available.width - rectWidth) / 2));
        rectTop = Math.min(boundsTop + maxCropHeight - rectHeight, Math.max(boundsTop, available.top + (available.height - rectHeight) / 2));
    }
    else {
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
            reportWarning(context.options, rollbackError, 'applyCrop rollback failed.');
        }
        if (error instanceof CropApplyError)
            throw error;
        const message = error instanceof Error ? `applyCrop failed: ${error.message}` : 'applyCrop failed';
        throw new CropApplyError(message, error);
    }
}

async function runBusyOperation(access, operation, body) {
    const context = access.buildCallbackContext(operation, false);
    const token = access.beginBusyOperation(operation);
    access.emitBusyChangeIfChanged(context);
    access.updateUi();
    try {
        return await body(context, token);
    }
    finally {
        access.endBusyOperation(token);
        access.emitBusyChangeIfChanged(context);
        access.updateUi();
    }
}
async function runBusyOperationWithoutUi(access, operation, body) {
    const context = access.buildCallbackContext(operation, false);
    const token = access.beginBusyOperation(operation);
    access.emitBusyChangeIfChanged(context);
    try {
        return await body(context, token);
    }
    finally {
        access.endBusyOperation(token);
        access.emitBusyChangeIfChanged(context);
    }
}

function enterCropModeAction(access, options = {}) {
    if (!access.getCanvas() || !access.getOriginalImage())
        return;
    if (access.getCropSession())
        return;
    if (!access.isImageLoaded())
        return;
    if (!access.canRunIdleOperation('enterCropMode'))
        return;
    enterCropMode(access.buildCropControllerContext(), options);
    access.updateUi();
    const callbackContext = access.buildCallbackContext('enterCropMode', false);
    access.emitBusyChangeIfChanged(callbackContext);
    access.emitImageChanged(callbackContext);
}
function setCropAspectRatioAction(access, aspectRatio) {
    if (!access.getCanvas() || !access.getCropSession())
        return;
    if (!access.canRunIdleOperation('setCropAspectRatio'))
        return;
    setCropAspectRatio(access.buildCropControllerContext(), aspectRatio);
    access.updateUi();
    const callbackContext = access.buildCallbackContext('setCropAspectRatio', false);
    access.emitImageChanged(callbackContext);
}
function cancelCropAction(access) {
    const canvas = access.getCanvas();
    if (!canvas || !access.getCropSession())
        return;
    if (!access.canRunIdleOperation('cancelCrop'))
        return;
    cancelCrop(access.buildCropControllerContext());
    access.setCropSession(null);
    access.updateUi();
    canvas.requestRenderAll();
    const callbackContext = access.buildCallbackContext('cancelCrop', false);
    access.emitBusyChangeIfChanged(callbackContext);
    access.emitImageChanged(callbackContext);
}
async function applyCropAction(access) {
    if (!access.getCanvas() || !access.getCropSession())
        return;
    if (!access.canRunIdleOperation('applyCrop'))
        return;
    const hadMasks = access.getMasks().length > 0;
    await runBusyOperation(access.buildBusyOperationAccess(), 'applyCrop', async (callbackContext, operationToken) => {
        await applyCrop(access.buildCropControllerContext(operationToken));
        access.updateInputs();
        access.updateMaskList();
        if (hadMasks || access.getMasks().length > 0) {
            access.emitMasksChanged(callbackContext);
        }
        access.emitImageChanged(callbackContext);
    });
}

function getFiltersRegistry(fabric) {
    var _a;
    return ((_a = fabric.filters) !== null && _a !== void 0 ? _a : {});
}
function createFilter(registry, name, options) {
    const FilterConstructor = registry[name];
    return FilterConstructor ? new FilterConstructor(options) : null;
}
function buildFabricImageFilters(fabric, config) {
    const registry = getFiltersRegistry(fabric);
    const filters = [];
    const push = (filter) => {
        if (filter)
            filters.push(filter);
    };
    if (config.brightness !== 0) {
        push(createFilter(registry, 'Brightness', { brightness: config.brightness }));
    }
    if (config.contrast !== 0) {
        push(createFilter(registry, 'Contrast', { contrast: config.contrast }));
    }
    if (config.saturation !== 0) {
        push(createFilter(registry, 'Saturation', { saturation: config.saturation }));
    }
    if (config.grayscale)
        push(createFilter(registry, 'Grayscale'));
    if (config.sepia)
        push(createFilter(registry, 'Sepia'));
    if (config.vintage)
        push(createFilter(registry, 'Vintage'));
    if (config.blur > 0)
        push(createFilter(registry, 'Blur', { blur: config.blur }));
    if (config.sharpen > 0) {
        const s = config.sharpen;
        push(createFilter(registry, 'Convolute', {
            matrix: [0, -s, 0, -s, 1 + 4 * s, -s, 0, -s, 0],
        }));
    }
    return filters;
}
function applyImageFilterConfigToImage(fabric, image, config) {
    var _a;
    const imageWithFilters = image;
    imageWithFilters.filters = buildFabricImageFilters(fabric, config);
    (_a = imageWithFilters.applyFilters) === null || _a === void 0 ? void 0 : _a.call(imageWithFilters);
    imageWithFilters.dirty = true;
}
function getFilteredBaseImageDataUrl(image, config, fallback) {
    if (!hasActiveImageFilters(config))
        return fallback;
    try {
        return image.toDataURL({ format: 'png', multiplier: 1 });
    }
    catch {
        return fallback;
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
    const documentForCanvas = (_a = ownerDocument !== null && ownerDocument !== void 0 ? ownerDocument : imageElement.ownerDocument) !== null && _a !== void 0 ? _a : null;
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

function withTimeout(promise, ms, label, onTimeout) {
    return new Promise((resolve, reject) => {
        const start = Date.now();
        const timeoutId = setTimeout(() => {
            try {
                onTimeout === null || onTimeout === void 0 ? void 0 : onTimeout();
            }
            catch {
            }
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
function getCanvasDocument$3(context) {
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
async function refreshMosaicRasterCacheFromSource(context, session, source) {
    const rasterCache = session.rasterCache;
    if (!rasterCache)
        return;
    const ownerDocument = getCanvasDocument$3(context);
    const decoded = await decodeImageSource(ownerDocument, source);
    rasterCache.offscreenCanvas.width = decoded.width;
    rasterCache.offscreenCanvas.height = decoded.height;
    const renderingContext = rasterCache.offscreenCanvas.getContext('2d');
    if (!renderingContext) {
        releaseMosaicRasterCache(session);
        return;
    }
    renderingContext.clearRect(0, 0, decoded.width, decoded.height);
    renderingContext.drawImage(decoded.element, 0, 0, decoded.width, decoded.height);
    rasterCache.renderingContext = renderingContext;
    rasterCache.imageData = renderingContext.getImageData(0, 0, decoded.width, decoded.height);
    rasterCache.source = source;
    rasterCache.width = decoded.width;
    rasterCache.height = decoded.height;
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
function getMosaicImageSource(context, image) {
    return getFilteredBaseImageDataUrl(image, context.getCurrentImageFilterConfig(), getImageSource(image));
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
    if (session.rasterCache) {
        if (session.rasterCache.source === source)
            return session.rasterCache;
        releaseMosaicRasterCache(session);
    }
    const ownerDocument = getCanvasDocument$3(context);
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
    const source = getMosaicImageSource(context, originalImage);
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
    const source = (_a = getMosaicImageSource(context, originalImage)) !== null && _a !== void 0 ? _a : session.rasterCache.source;
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
        context.resetImageFilterState();
        const after = context.captureSnapshot();
        pushMosaicHistory(context, after);
        try {
            await refreshMosaicRasterCacheFromSource(context, session, nextDataUrl);
        }
        catch (error) {
            releaseMosaicRasterCache(session);
            reportWarning(context.options, error, 'Mosaic cache refresh failed after commit; the next stroke will rebuild it.');
        }
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

function enterMosaicModeAction(access) {
    if (!access.getCanvas() || !access.getOriginalImage())
        return;
    if (access.getMosaicSession())
        return;
    if (!access.isImageLoaded())
        return;
    if (!access.canRunIdleOperation('enterMosaicMode'))
        return;
    enterMosaicMode(access.buildMosaicControllerContext());
    access.updateInputs();
    access.updateUi();
    const callbackContext = access.buildCallbackContext('enterMosaicMode', false);
    access.emitBusyChangeIfChanged(callbackContext);
    access.emitImageChanged(callbackContext);
}
function exitMosaicModeAction(access) {
    if (!access.getCanvas() || !access.getMosaicSession())
        return;
    if (!access.canRunIdleOperation('exitMosaicMode'))
        return;
    exitMosaicMode(access.buildMosaicControllerContext());
    access.updateInputs();
    access.updateUi();
    const callbackContext = access.buildCallbackContext('exitMosaicMode', false);
    access.emitBusyChangeIfChanged(callbackContext);
    access.emitImageChanged(callbackContext);
}
function resetMosaicConfigAction(access) {
    if (access.isDisposed())
        return;
    const nextConfig = cloneResolvedMosaicConfig(access.getDefaultMosaicConfig());
    if (areResolvedMosaicConfigsEqual(access.getMosaicConfig(), nextConfig))
        return;
    access.setMosaicConfig(nextConfig);
    updateActivePreview(access);
    access.updateInputs();
    access.updateUi();
    access.emitImageChanged(access.buildCallbackContext('resetMosaicConfig', false));
}
function applyMosaicConfigPatchAction(access, config, operation) {
    if (access.isDisposed())
        return;
    if (config === null || typeof config !== 'object' || Array.isArray(config)) {
        reportWarning(access.getOptions(), new TypeError('[ImageEditor] Invalid Mosaic config object.'), 'Ignored invalid Mosaic config.');
        return;
    }
    const invalidFields = getInvalidMosaicConfigFields(config);
    if (invalidFields.length > 0) {
        reportWarning(access.getOptions(), new TypeError(`[ImageEditor] Ignored invalid Mosaic config field(s): ` +
            `${invalidFields.join(', ')}.`), 'Ignored invalid Mosaic config fields.');
    }
    const nextConfig = mergeMosaicConfigPatch(access.getMosaicConfig(), config);
    if (areResolvedMosaicConfigsEqual(access.getMosaicConfig(), nextConfig))
        return;
    access.setMosaicConfig(nextConfig);
    updateActivePreview(access);
    access.updateInputs();
    access.updateUi();
    access.emitImageChanged(access.buildCallbackContext(operation, false));
}
function updateActivePreview(access) {
    if (access.getMosaicSession() && access.getCanvas()) {
        updateMosaicPreview(access.buildMosaicControllerContext());
    }
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
        const detachPreservedObjects = async () => {
            detachObjects(context.canvas, preservedObjects);
        };
        if (context.withSelectionChangeSuppressed) {
            await context.withSelectionChangeSuppressed(detachPreservedObjects);
        }
        else {
            await detachPreservedObjects();
        }
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
                reportWarning(context.options, scrollError, `${options.operation}: scroll restore failed.`);
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
            reportWarning(context.options, rollbackError, `${options.operation}: rollback failed.`);
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
    const maxDimension = context.options.maxExportDimension;
    if (!Number.isFinite(pixelCount) || pixelCount > maxPixels) {
        throw new RangeError(`[ImageEditor] Export size ${outputWidth}x${outputHeight} ` +
            `(${pixelCount} pixels) exceeds maxExportPixels (${maxPixels}).`);
    }
    if (outputWidth > maxDimension || outputHeight > maxDimension) {
        throw new RangeError(`[ImageEditor] Export size ${outputWidth}x${outputHeight} ` +
            `exceeds maxExportDimension (${maxDimension}).`);
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
        .map((object) => {
        var _a;
        return ({
            object,
            visible: (_a = object.visible) !== null && _a !== void 0 ? _a : true,
        });
    });
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
    var _a;
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
            visible: (_a = label.visible) !== null && _a !== void 0 ? _a : true,
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
    if (!canvas.getObjects().includes(activeObject))
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
function sealPartialTransparentEdges(canvasContext, width, height, edges) {
    if (!hasPartialEdges(edges))
        return;
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
    if ((edges === null || edges === void 0 ? void 0 : edges.left) && (edges === null || edges === void 0 ? void 0 : edges.top) && width > 1 && height > 1) {
        sealPixel(0, 0, 1, 1);
    }
    if ((edges === null || edges === void 0 ? void 0 : edges.right) && (edges === null || edges === void 0 ? void 0 : edges.top) && width > 1 && height > 1) {
        sealPixel(width - 1, 0, width - 2, 1);
    }
    if ((edges === null || edges === void 0 ? void 0 : edges.left) && (edges === null || edges === void 0 ? void 0 : edges.bottom) && width > 1 && height > 1) {
        sealPixel(0, height - 1, 1, height - 2);
    }
    if ((edges === null || edges === void 0 ? void 0 : edges.right) && (edges === null || edges === void 0 ? void 0 : edges.bottom) && width > 1 && height > 1) {
        sealPixel(width - 1, height - 1, width - 2, height - 2);
    }
    canvasContext.putImageData(imageData, 0, 0);
}
function getJpegBackgroundColor(backgroundColor, ownerDocument) {
    return resolveCanvasFillStyle(backgroundColor, ownerDocument);
}
const colorValidationContexts = new WeakMap();
function resolveCanvasFillStyle(backgroundColor, ownerDocument, fallback = '#ffffff') {
    var _a, _b;
    const value = String(backgroundColor !== null && backgroundColor !== void 0 ? backgroundColor : '').trim();
    if (!value || isTransparentCssColor(value))
        return '#ffffff';
    const css = (_b = (_a = ownerDocument.defaultView) === null || _a === void 0 ? void 0 : _a.CSS) !== null && _b !== void 0 ? _b : globalThis.CSS;
    const supportsColor = typeof (css === null || css === void 0 ? void 0 : css.supports) === 'function' ? css.supports('color', value) : null;
    if (supportsColor === false)
        return fallback;
    const context = createColorValidationContext(ownerDocument);
    if (!context)
        return supportsColor === true ? value : fallback;
    if (supportsColor === true) {
        context.fillStyle = value;
        return context.fillStyle;
    }
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
    var _a;
    if (colorValidationContexts.has(ownerDocument)) {
        return (_a = colorValidationContexts.get(ownerDocument)) !== null && _a !== void 0 ? _a : null;
    }
    try {
        const context = ownerDocument.createElement('canvas').getContext('2d');
        colorValidationContexts.set(ownerDocument, context);
        return context;
    }
    catch {
        colorValidationContexts.set(ownerDocument, null);
        return null;
    }
}
function detectDataUrlMimeType(dataUrl) {
    var _a, _b;
    const match = /^data:([^;,]+)(?:[;,])/i.exec(dataUrl);
    return (_b = (_a = match === null || match === void 0 ? void 0 : match[1]) === null || _a === void 0 ? void 0 : _a.toLowerCase()) !== null && _b !== void 0 ? _b : null;
}
function assertDataUrlMimeType(dataUrl, target, operation) {
    const actualMimeType = detectDataUrlMimeType(dataUrl);
    if (actualMimeType !== target.mimeType) {
        throw new ExportError(`${operation} failed: browser encoded ${actualMimeType !== null && actualMimeType !== void 0 ? actualMimeType : 'unknown MIME'} instead of requested ${target.mimeType}.`);
    }
}
function encodeCanvasAsDataUrl(canvas, target, operation) {
    const encoded = target.quality === undefined
        ? canvas.toDataURL(target.mimeType)
        : canvas.toDataURL(target.mimeType, target.quality);
    assertDataUrlMimeType(encoded, target, operation);
    return encoded;
}
function getCanvasDocument$2(canvas) {
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
    const commaAlpha = normalized.match(/^(?:rgba|hsla)\(([^)]{0,200}),\s*([^,/)]{0,50})\)$/i);
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
async function postProcessRegionDataUrl(dataUrl, edges, target, backgroundColor, ownerDocument) {
    const shouldSealEdges = hasPartialEdges(edges);
    const shouldCompositeJpegBackground = target.format === 'jpeg';
    if (!shouldSealEdges && !shouldCompositeJpegBackground)
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
    if (shouldSealEdges) {
        sealPartialTransparentEdges(canvasContext, width, height, edges);
    }
    if (shouldCompositeJpegBackground) {
        canvasContext.globalCompositeOperation = 'destination-over';
        canvasContext.fillStyle = getJpegBackgroundColor(backgroundColor, ownerDocument);
        canvasContext.fillRect(0, 0, width, height);
        canvasContext.globalCompositeOperation = 'source-over';
    }
    return encodeCanvasAsDataUrl(offscreenCanvas, target, 'exportImageBase64');
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
        const bytes = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index += 1) {
            bytes[index] = binary.charCodeAt(index);
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
    if (detectDataUrlMimeType(sourceDataUrl) === target.mimeType) {
        return sourceDataUrl;
    }
    const imageElement = await loadImageElement(sourceDataUrl);
    const { width, height } = getImageDimensions(imageElement);
    const ownerDocument = getCanvasDocument$2(canvas);
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
    return encodeCanvasAsDataUrl(offscreenCanvas, target, 'exportImageFile');
}
function warnNoImageLoaded(options, operation) {
    reportWarning(options, null, `${operation} skipped: no image is loaded on the canvas.`);
}
function extensionForFormat(format) {
    return format === 'jpeg' ? 'jpg' : format;
}
const MAX_EXPORT_FILE_BASENAME_LENGTH = 120;
function replaceUnsafeFileNameCharacters(value) {
    let output = '';
    let lastWasReplacement = false;
    for (const char of value) {
        const code = char.charCodeAt(0);
        const unsafe = code <= 31 || code === 127 || '<>:"|?*'.includes(char);
        if (unsafe) {
            if (!lastWasReplacement)
                output += '_';
            lastWasReplacement = true;
            continue;
        }
        output += char;
        lastWasReplacement = false;
    }
    return output;
}
function sanitizeFileNameBase(value) {
    const withoutPathSeparators = value.replace(/[\\/]+/g, '_');
    const sanitized = replaceUnsafeFileNameCharacters(withoutPathSeparators)
        .replace(/\.\.+/g, '.')
        .replace(/^\.+|\.+$/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, MAX_EXPORT_FILE_BASENAME_LENGTH)
        .trim();
    return sanitized || 'edited_image';
}
function resolveFileName(baseName, format) {
    const fallback = 'edited_image';
    const trimmed = String(baseName || fallback).trim() || fallback;
    const ext = extensionForFormat(format.format);
    const baseWithoutExtension = trimmed.replace(/\.(jpe?g|png|webp)$/i, '');
    const safeBase = sanitizeFileNameBase(baseWithoutExtension);
    return `${safeBase}.${ext}`;
}
async function renderExportDataUrl(context, resolved, validateMimeType = true) {
    const render = async () => {
        const activeObject = captureActiveObject(context.canvas);
        const labelBackups = captureMaskLabelBackups(context.canvas);
        try {
            context.canvas.discardActiveObject();
            const { region, partialEdges } = computeExportRegion(context, resolved.exportArea);
            assertExportPixelBudget(context, resolved.multiplier, region);
            const renderFormat = region && resolved.format.format === 'jpeg' ? 'png' : resolved.format.format;
            const renderQuality = renderFormat === 'png' ? undefined : resolved.format.quality;
            let dataUrl = await withSessionObjectsHidden(context, async () => withMaskExportState(context, resolved.mergeMasks, async () => withAnnotationsExportState(context, resolved.mergeAnnotations, async () => renderCanvasToDataUrl(context.canvas, renderFormat, renderQuality, resolved.multiplier, region))));
            if (region && (hasPartialEdges(partialEdges) || resolved.format.format === 'jpeg')) {
                dataUrl = await postProcessRegionDataUrl(dataUrl, partialEdges, resolved.format, context.options.backgroundColor, getCanvasDocument$2(context.canvas));
            }
            if (validateMimeType) {
                assertDataUrlMimeType(dataUrl, resolved.format, 'exportImageBase64');
            }
            return dataUrl;
        }
        finally {
            restoreMaskLabelBackups(context.canvas, labelBackups);
            restoreActiveObject(context.canvas, activeObject);
            requestRender(context.canvas);
        }
    };
    return context.withSelectionChangeSuppressed
        ? context.withSelectionChangeSuppressed(render)
        : render();
}
async function exportImageBase64(context, options) {
    if (!context.isImageLoaded()) {
        warnNoImageLoaded(context.options, 'exportImageBase64');
        throw new ExportNotReadyError('exportImageBase64');
    }
    const resolved = resolveExportOptions(context, options);
    return renderExportDataUrl(context, resolved);
}
async function exportImageFile(context, options) {
    var _a;
    if (!context.isImageLoaded()) {
        warnNoImageLoaded(context.options, 'exportImageFile');
        throw new ExportNotReadyError('exportImageFile');
    }
    const providedOptions = options !== null && options !== void 0 ? options : {};
    const resolved = resolveExportOptions(context, providedOptions);
    const rawDataUrl = await renderExportDataUrl(context, resolved, false);
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
        warnNoImageLoaded(context.options, 'downloadImage');
        return;
    }
    if (options !== undefined && options !== null && typeof options !== 'object') {
        throw new TypeError('[ImageEditor] downloadImage(options) expects an ImageExportOptions object.');
    }
    const file = await exportImageFile(context, options);
    triggerFileDownload(context, file);
}
function triggerFileDownload(context, file) {
    var _a;
    const ownerDocument = getCanvasDocument$2(context.canvas);
    const objectUrl = URL.createObjectURL(file);
    const link = ownerDocument.createElement('a');
    link.download = file.name;
    link.href = objectUrl;
    const body = (_a = ownerDocument.body) !== null && _a !== void 0 ? _a : ownerDocument.documentElement;
    if (!body)
        throw new Error('Document body is unavailable for download trigger.');
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

async function mergeMasksAction(access) {
    const canvas = access.getCanvas();
    if (!canvas)
        return;
    if (!access.canRunIdleOperation('mergeMasks'))
        return;
    access.finalizeActiveTextEditingIfNeeded();
    const hasMasks = canvas.getObjects().some(isMaskObject);
    if (!hasMasks)
        return;
    await runBusyOperation(access.buildBusyOperationAccess(), 'mergeMasks', async (callbackContext, operationToken) => {
        await mergeMasks(access.buildMergeMasksContext(operationToken));
        access.updateInputs();
        access.updateMaskList();
        access.updateAnnotationList();
        access.emitMasksChanged(callbackContext);
        if (access.getAnnotations().length > 0) {
            access.emitAnnotationsChanged(callbackContext);
        }
        access.emitImageChanged(callbackContext);
    });
}
async function mergeAnnotationsAction(access) {
    const canvas = access.getCanvas();
    if (!canvas)
        return;
    if (!access.canRunIdleOperation('mergeAnnotations'))
        return;
    access.finalizeActiveTextEditingIfNeeded();
    const hasAnnotations = canvas.getObjects().some(isAnnotationObject);
    if (!hasAnnotations)
        return;
    await runBusyOperation(access.buildBusyOperationAccess(), 'mergeAnnotations', async (callbackContext, operationToken) => {
        await mergeAnnotations(access.buildMergeAnnotationsContext(operationToken));
        access.updateInputs();
        access.updateMaskList();
        access.updateAnnotationList();
        access.emitAnnotationsChanged(callbackContext);
        if (access.getMasks().length > 0)
            access.emitMasksChanged(callbackContext);
        access.emitImageChanged(callbackContext);
    });
}
async function downloadImageAction(access, options) {
    if (!access.getCanvas())
        return;
    if (!access.canRunIdleOperation('downloadImage'))
        return;
    access.finalizeActiveTextEditingIfNeeded();
    await runBusyOperationWithoutUi(access.buildBusyOperationAccess(), 'downloadImage', async () => {
        await downloadImage(access.buildExportServiceContext(), options);
    });
}
async function exportImageBase64Action(access, options) {
    if (!access.getCanvas()) {
        throw new ExportNotReadyError('exportImageBase64', 'editor is not initialized');
    }
    access.assertIdleForOperation('exportImageBase64', options);
    access.finalizeActiveTextEditingIfNeeded();
    return runBusyOperationWithoutUi(access.buildBusyOperationAccess(), 'exportImageBase64', () => exportImageBase64(access.buildExportServiceContext(), options));
}
async function exportImageFileAction(access, options) {
    if (!access.getCanvas()) {
        throw new ExportNotReadyError('exportImageFile', 'editor is not initialized');
    }
    access.assertIdleForOperation('exportImageFile', options);
    access.finalizeActiveTextEditingIfNeeded();
    return runBusyOperationWithoutUi(access.buildBusyOperationAccess(), 'exportImageFile', () => exportImageFile(access.buildExportServiceContext(), options));
}

const SUPPORTED_IMAGE_EXTENSIONS = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
};
const SUPPORTED_IMAGE_MIME_TYPES = new Set(Object.values(SUPPORTED_IMAGE_EXTENSIONS));
function isSupportedImageDataUrl(value) {
    if (typeof value !== 'string')
        return false;
    if (!value.toLowerCase().startsWith('data:image/'))
        return false;
    const match = /^data:(image\/[^;,]+)(?:[;,])/i.exec(value);
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
function readFileAsArrayBuffer(file) {
    if (typeof file.arrayBuffer === 'function') {
        return file.arrayBuffer();
    }
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result;
            if (result instanceof ArrayBuffer) {
                resolve(result);
            }
            else {
                reject(new Error('FileReader returned a non-ArrayBuffer result'));
            }
        };
        reader.onerror = () => {
            var _a;
            reject((_a = reader.error) !== null && _a !== void 0 ? _a : new Error('FileReader error'));
        };
        reader.onabort = () => {
            reject(new Error('FileReader read aborted'));
        };
        reader.readAsArrayBuffer(file);
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
function computeExpandLayout(imageWidth, imageHeight, containerSize) {
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

const HEADER_PROBE_BYTES = 256 * 1024;
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
function hasPositiveDimensions$1(width, height) {
    return Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0;
}
function readUint16BE(bytes, offset) {
    if (offset < 0 || offset + 2 > bytes.length)
        return null;
    return (bytes[offset] << 8) | bytes[offset + 1];
}
function readUint32BE(bytes, offset) {
    if (offset < 0 || offset + 4 > bytes.length)
        return null;
    return (bytes[offset] * 0x1000000 +
        ((bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]));
}
function readUint16LE(bytes, offset) {
    if (offset < 0 || offset + 2 > bytes.length)
        return null;
    return bytes[offset] | (bytes[offset + 1] << 8);
}
function readUint24LE(bytes, offset) {
    if (offset < 0 || offset + 3 > bytes.length)
        return null;
    return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}
function matchesAscii(bytes, offset, value) {
    if (offset < 0 || offset + value.length > bytes.length)
        return false;
    for (let index = 0; index < value.length; index += 1) {
        if (bytes[offset + index] !== value.charCodeAt(index))
            return false;
    }
    return true;
}
function readPngDimensions(bytes) {
    if (bytes.length < 24)
        return null;
    if (!PNG_SIGNATURE.every((byte, index) => bytes[index] === byte))
        return null;
    if (!matchesAscii(bytes, 12, 'IHDR'))
        return null;
    const width = readUint32BE(bytes, 16);
    const height = readUint32BE(bytes, 20);
    return width !== null && height !== null && hasPositiveDimensions$1(width, height)
        ? { width, height }
        : null;
}
function isJpegStartOfFrame(marker) {
    return ((marker >= 0xc0 && marker <= 0xc3) ||
        (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) ||
        (marker >= 0xcd && marker <= 0xcf));
}
function isStandaloneJpegMarker(marker) {
    return marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7);
}
function readJpegDimensions(bytes) {
    if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8)
        return null;
    let offset = 2;
    while (offset + 1 < bytes.length) {
        while (offset < bytes.length && bytes[offset] === 0xff)
            offset += 1;
        if (offset >= bytes.length)
            return null;
        const marker = bytes[offset];
        offset += 1;
        if (marker === 0xda || marker === 0xd9)
            return null;
        if (isStandaloneJpegMarker(marker))
            continue;
        const segmentLength = readUint16BE(bytes, offset);
        if (segmentLength === null || segmentLength < 2)
            return null;
        const segmentStart = offset + 2;
        const segmentEnd = offset + segmentLength;
        if (segmentEnd > bytes.length)
            return null;
        if (isJpegStartOfFrame(marker)) {
            const height = readUint16BE(bytes, segmentStart + 1);
            const width = readUint16BE(bytes, segmentStart + 3);
            return width !== null && height !== null && hasPositiveDimensions$1(width, height)
                ? { width, height }
                : null;
        }
        offset = segmentEnd;
    }
    return null;
}
function readWebpDimensions(bytes) {
    if (bytes.length < 20 || !matchesAscii(bytes, 0, 'RIFF') || !matchesAscii(bytes, 8, 'WEBP')) {
        return null;
    }
    if (matchesAscii(bytes, 12, 'VP8X') && bytes.length >= 30) {
        const rawWidth = readUint24LE(bytes, 24);
        const rawHeight = readUint24LE(bytes, 27);
        if (rawWidth === null || rawHeight === null)
            return null;
        return { width: rawWidth + 1, height: rawHeight + 1 };
    }
    if (matchesAscii(bytes, 12, 'VP8 ') && bytes.length >= 30) {
        if (bytes[23] !== 0x9d || bytes[24] !== 0x01 || bytes[25] !== 0x2a)
            return null;
        const rawWidth = readUint16LE(bytes, 26);
        const rawHeight = readUint16LE(bytes, 28);
        if (rawWidth === null || rawHeight === null)
            return null;
        return { width: rawWidth & 0x3fff, height: rawHeight & 0x3fff };
    }
    if (matchesAscii(bytes, 12, 'VP8L') && bytes.length >= 25 && bytes[20] === 0x2f) {
        const byte1 = bytes[21];
        const byte2 = bytes[22];
        const byte3 = bytes[23];
        const byte4 = bytes[24];
        return {
            width: 1 + byte1 + ((byte2 & 0x3f) << 8),
            height: 1 + (byte2 >> 6) + (byte3 << 2) + ((byte4 & 0x0f) << 10),
        };
    }
    return null;
}
function readImageHeaderDimensions(bytes) {
    var _a, _b;
    return (_b = (_a = readPngDimensions(bytes)) !== null && _a !== void 0 ? _a : readJpegDimensions(bytes)) !== null && _b !== void 0 ? _b : readWebpDimensions(bytes);
}
function estimateBase64PayloadBytes(dataUrl) {
    const commaIndex = dataUrl.indexOf(',');
    if (commaIndex < 0)
        return null;
    const header = dataUrl.slice(0, commaIndex).toLowerCase();
    if (!header.endsWith(';base64'))
        return null;
    const base64 = dataUrl.slice(commaIndex + 1).replace(/\s+/g, '');
    if (!base64)
        return 0;
    const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
    return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}
function decodeBase64Prefix(dataUrl, maxBytes) {
    const commaIndex = dataUrl.indexOf(',');
    if (commaIndex < 0)
        return null;
    const header = dataUrl.slice(0, commaIndex).toLowerCase();
    if (!header.endsWith(';base64'))
        return null;
    const encodedLength = Math.ceil(maxBytes / 3) * 4;
    const base64 = dataUrl
        .slice(commaIndex + 1, commaIndex + 1 + encodedLength)
        .replace(/\s+/g, '');
    if (!base64)
        return new Uint8Array(0);
    const paddedBase64 = padBase64(base64);
    if (paddedBase64 === null)
        return null;
    const bufferCtor = globalThis.Buffer;
    if (bufferCtor && typeof bufferCtor.from === 'function') {
        return bufferCtor.from(paddedBase64, 'base64');
    }
    if (typeof globalThis.atob === 'function') {
        const binary = globalThis.atob(paddedBase64);
        const bytes = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index += 1) {
            bytes[index] = binary.charCodeAt(index);
        }
        return bytes;
    }
    return null;
}
function padBase64(base64) {
    const remainder = base64.length % 4;
    if (remainder === 0)
        return base64;
    if (remainder === 1)
        return null;
    return `${base64}${'='.repeat(4 - remainder)}`;
}
async function readBlobAsArrayBuffer(blob) {
    if (typeof blob.arrayBuffer === 'function') {
        return blob.arrayBuffer();
    }
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result;
            if (result instanceof ArrayBuffer) {
                resolve(result);
            }
            else {
                reject(new Error('FileReader returned a non-ArrayBuffer result'));
            }
        };
        reader.onerror = () => {
            var _a;
            reject((_a = reader.error) !== null && _a !== void 0 ? _a : new Error('FileReader error'));
        };
        reader.onabort = () => {
            reject(new Error('FileReader read aborted'));
        };
        reader.readAsArrayBuffer(blob);
    });
}
function assertInputByteBudget(bytes, maxInputBytes) {
    if (bytes === null)
        return;
    if (bytes > maxInputBytes) {
        throw new ImageDecodeError(`Image input byte length ${bytes} exceeds maxInputBytes (${maxInputBytes}).`);
    }
}
function assertInputPixelBudget(dimensions, maxInputPixels) {
    if (!dimensions)
        return;
    const pixels = dimensions.width * dimensions.height;
    if (pixels > maxInputPixels) {
        throw new ImageDecodeError(`Image input dimensions ${dimensions.width}x${dimensions.height} exceed maxInputPixels (${maxInputPixels}).`);
    }
}
function assertImageDataUrlInputBudget(dataUrl, options) {
    assertInputByteBudget(estimateBase64PayloadBytes(dataUrl), options.maxInputBytes);
    const headerBytes = decodeBase64Prefix(dataUrl, HEADER_PROBE_BYTES);
    assertInputPixelBudget(headerBytes ? readImageHeaderDimensions(headerBytes) : null, options.maxInputPixels);
}
async function assertImageFileInputBudget(file, options) {
    assertInputByteBudget(file.size, options.maxInputBytes);
    const probeBlob = typeof file.slice === 'function' ? file.slice(0, HEADER_PROBE_BYTES) : file;
    const probeBuffer = await readBlobAsArrayBuffer(probeBlob);
    assertInputPixelBudget(readImageHeaderDimensions(new Uint8Array(probeBuffer)), options.maxInputPixels);
}

async function loadImage(context, imageBase64, loadOptions = {}) {
    if (!isSupportedImageDataUrl(imageBase64))
        return;
    try {
        assertImageDataUrlInputBudget(imageBase64, context.options);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? `loadImage failed: ${error.message}` : 'loadImage failed';
        reportError(context.options, error, errorMessage);
        throw error;
    }
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
        isImageLoadedToCanvas: context.getIsImageLoadedToCanvas(),
        lastSnapshot: context.getLastSnapshot(),
        stateJson: captureRollbackState(context),
        maskCounter: context.getMaskCounter(),
        annotationCounter: context.getAnnotationCounter(),
        currentScale: context.getCurrentScale(),
        currentRotation: context.getCurrentRotation(),
        baseImageScale: context.getBaseImageScale(),
        currentImageMimeType: context.getCurrentImageMimeType(),
        currentImageFilterConfig: context.getCurrentImageFilterConfig(),
    };
    try {
        const loadDeadline = Date.now() + context.options.imageLoadTimeoutMs;
        context.setPlaceholderVisible(false);
        const decode = startImageDecode(imageBase64);
        let imageElement;
        try {
            imageElement = await withTimeout(decode.promise, getRemainingLoadTimeout(loadDeadline), 'image decode');
        }
        catch (error) {
            decode.cleanup(true);
            throw error;
        }
        const loadSource = maybeDownsample(imageElement, imageBase64, context.options, getCanvasDocument$1(context.canvas));
        const fabricAbort = createAbortController();
        const fabricCrossOrigin = 'anonymous';
        const fabricLoadOptions = fabricAbort
            ? { crossOrigin: fabricCrossOrigin, signal: fabricAbort.signal }
            : { crossOrigin: fabricCrossOrigin };
        const fabricImage = await withTimeout(context.fabric.FabricImage.fromURL(loadSource.dataUrl, fabricLoadOptions), getRemainingLoadTimeout(loadDeadline), 'FabricImage.fromURL', () => {
            fabricAbort === null || fabricAbort === void 0 ? void 0 : fabricAbort.abort();
        });
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
        baseImage.set({
            left: layout.imageLeft,
            top: layout.imageTop,
            scaleX: layout.imageScale,
            scaleY: layout.imageScale,
        });
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
        context.resetImageFilterState();
        context.canvas.renderAll();
        context.setLastSnapshot(saveState({
            canvas: context.canvas,
            currentScale: 1,
            currentRotation: 0,
            baseImageScale: layout.baseImageScale,
            currentImageMimeType: loadSource.mimeType,
            imageFilterConfig: context.getCurrentImageFilterConfig(),
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
                reportWarning(context.options, error, 'preserveScroll restore failed.');
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
function getCanvasDocument$1(canvas) {
    var _a, _b, _c, _d;
    const canvasLike = canvas;
    return (_c = (_b = (_a = canvasLike.getElement) === null || _a === void 0 ? void 0 : _a.call(canvasLike)) === null || _b === void 0 ? void 0 : _b.ownerDocument) !== null && _c !== void 0 ? _c : (_d = canvasLike.lowerCanvasEl) === null || _d === void 0 ? void 0 : _d.ownerDocument;
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
    return computeExpandLayout(imageWidth, imageHeight, viewport);
}
function captureRollbackState(context) {
    return saveState({
        canvas: context.canvas,
        currentScale: context.getCurrentScale(),
        currentRotation: context.getCurrentRotation(),
        baseImageScale: context.getBaseImageScale(),
        currentImageMimeType: context.getCurrentImageMimeType(),
        imageFilterConfig: context.getCurrentImageFilterConfig(),
    });
}
function getRemainingLoadTimeout(deadline) {
    return Math.max(1, deadline - Date.now());
}
function createAbortController() {
    return typeof AbortController === 'function' ? new AbortController() : null;
}
async function replayRollback(context, bundle) {
    var _a, _b;
    try {
        const restoredState = await loadFromState({
            canvas: context.canvas,
            jsonString: bundle.stateJson,
            setCanvasSize: (width, height) => {
                context.setCanvasSize(width, height);
            },
            maxCanvasPixels: context.options.maxExportPixels,
        });
        context.applyRollbackRestoredState(restoredState);
        context.setOriginalImage(restoredState.originalImage);
        context.setIsImageLoadedToCanvas(bundle.isImageLoadedToCanvas && restoredState.originalImage !== null);
        context.setLastSnapshot(bundle.lastSnapshot);
        context.setMaskCounter(Math.max(bundle.maskCounter, restoredState.maxMaskId));
        context.setAnnotationCounter(Math.max(bundle.annotationCounter, restoredState.maxAnnotationId));
        context.setCurrentScale(bundle.currentScale);
        context.setCurrentRotation(bundle.currentRotation);
        context.setBaseImageScale(bundle.baseImageScale);
        context.setCurrentImageMimeType(bundle.currentImageMimeType);
        context.restoreImageFilterConfig((_b = (_a = restoredState.editorState) === null || _a === void 0 ? void 0 : _a.imageFilterConfig) !== null && _b !== void 0 ? _b : bundle.currentImageFilterConfig);
        context.canvas.renderAll();
    }
    catch (rollbackError) {
        reportWarning(context.options, rollbackError, 'loadImage rollback failed while restoring the previous canvas state; editor state was cleared.');
        context.resetAfterRollbackFailure();
    }
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
            reportWarning(context.options, rollbackError, 'loadImage rollback scroll restore failed.');
        }
    }
    if (bundle.placeholderHidden !== null) {
        context.setPlaceholderVisible(!bundle.placeholderHidden);
    }
}

const JPEG_MARKER_PREFIX = 0xff;
const JPEG_SOI = 0xd8;
const JPEG_SOS = 0xda;
const JPEG_EOI = 0xd9;
const JPEG_APP1 = 0xe1;
const TIFF_TAG_ORIENTATION = 0x0112;
const TIFF_TYPE_SHORT = 3;
const TIFF_TYPE_LONG = 4;
const EXIF_HEADER = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00];
function isValidOrientation(value) {
    return Number.isInteger(value) && value >= 1 && value <= 8;
}
function readUint16(view, offset, littleEndian) {
    if (offset < 0 || offset + 2 > view.byteLength)
        return null;
    return view.getUint16(offset, littleEndian);
}
function readUint32(view, offset, littleEndian) {
    if (offset < 0 || offset + 4 > view.byteLength)
        return null;
    return view.getUint32(offset, littleEndian);
}
function hasExifHeader(view, offset, end) {
    if (offset + EXIF_HEADER.length > end)
        return false;
    return EXIF_HEADER.every((byte, index) => view.getUint8(offset + index) === byte);
}
function isStandaloneMarker(marker) {
    return marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7);
}
function readJpegExifOrientation(buffer) {
    const view = new DataView(buffer);
    if (view.byteLength < 4)
        return null;
    if (view.getUint8(0) !== JPEG_MARKER_PREFIX || view.getUint8(1) !== JPEG_SOI) {
        return null;
    }
    let offset = 2;
    while (offset < view.byteLength) {
        if (view.getUint8(offset) !== JPEG_MARKER_PREFIX)
            return null;
        while (offset < view.byteLength && view.getUint8(offset) === JPEG_MARKER_PREFIX) {
            offset += 1;
        }
        if (offset >= view.byteLength)
            return null;
        const marker = view.getUint8(offset);
        offset += 1;
        if (marker === JPEG_SOS || marker === JPEG_EOI)
            return null;
        if (isStandaloneMarker(marker))
            continue;
        if (offset + 2 > view.byteLength)
            return null;
        const segmentLength = view.getUint16(offset, false);
        if (segmentLength < 2)
            return null;
        const segmentStart = offset + 2;
        const segmentEnd = offset + segmentLength;
        if (segmentEnd > view.byteLength)
            return null;
        if (marker === JPEG_APP1 && hasExifHeader(view, segmentStart, segmentEnd)) {
            return readExifSegmentOrientation(view, segmentStart + EXIF_HEADER.length, segmentEnd);
        }
        offset = segmentEnd;
    }
    return null;
}
function readExifSegmentOrientation(view, tiffStart, segmentEnd) {
    if (tiffStart + 8 > segmentEnd)
        return null;
    const byteOrderA = view.getUint8(tiffStart);
    const byteOrderB = view.getUint8(tiffStart + 1);
    const littleEndian = byteOrderA === 0x49 && byteOrderB === 0x49
        ? true
        : byteOrderA === 0x4d && byteOrderB === 0x4d
            ? false
            : null;
    if (littleEndian === null)
        return null;
    const tiffMagic = readUint16(view, tiffStart + 2, littleEndian);
    if (tiffMagic !== 0x002a)
        return null;
    const ifdOffset = readUint32(view, tiffStart + 4, littleEndian);
    if (ifdOffset === null)
        return null;
    const ifdStart = tiffStart + ifdOffset;
    if (ifdStart < tiffStart || ifdStart + 2 > segmentEnd)
        return null;
    const entryCount = readUint16(view, ifdStart, littleEndian);
    if (entryCount === null)
        return null;
    const entriesStart = ifdStart + 2;
    const entriesEnd = entriesStart + entryCount * 12;
    if (entriesEnd > segmentEnd)
        return null;
    for (let index = 0; index < entryCount; index += 1) {
        const entryOffset = entriesStart + index * 12;
        const tag = readUint16(view, entryOffset, littleEndian);
        if (tag !== TIFF_TAG_ORIENTATION)
            continue;
        const type = readUint16(view, entryOffset + 2, littleEndian);
        const count = readUint32(view, entryOffset + 4, littleEndian);
        if (count !== 1)
            return null;
        const value = type === TIFF_TYPE_SHORT
            ? readUint16(view, entryOffset + 8, littleEndian)
            : type === TIFF_TYPE_LONG
                ? readUint32(view, entryOffset + 8, littleEndian)
                : null;
        if (value === null)
            return null;
        return isValidOrientation(value) ? value : null;
    }
    return null;
}
function isJpegFile(file) {
    var _a, _b;
    const type = (_b = (_a = file.type) === null || _a === void 0 ? void 0 : _a.toLowerCase()) !== null && _b !== void 0 ? _b : '';
    if (type)
        return type === 'image/jpeg';
    return /\.(?:jpe?g)$/i.test(file.name);
}
async function readFileOrientation(file) {
    try {
        return readJpegExifOrientation(await readFileAsArrayBuffer(file));
    }
    catch {
        return null;
    }
}
async function createRawImageBitmap(file) {
    if (typeof createImageBitmap !== 'function') {
        throw new Error('createImageBitmap with imageOrientation: "none" is required for safe EXIF orientation normalization.');
    }
    try {
        const bitmap = await createImageBitmap(file, { imageOrientation: 'none' });
        if (!hasPositiveDimensions(bitmap.width, bitmap.height)) {
            bitmap.close();
            throw new Error('Decoded image bitmap has no dimensions.');
        }
        return {
            source: bitmap,
            width: bitmap.width,
            height: bitmap.height,
            close: () => {
                bitmap.close();
            },
        };
    }
    catch (error) {
        throw Object.assign(new Error(error instanceof Error
            ? `createImageBitmap EXIF orientation decode failed: ${error.message}`
            : 'createImageBitmap EXIF orientation decode failed.'), { cause: error });
    }
}
function hasPositiveDimensions(width, height) {
    return Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0;
}
function getCanvasDocument(ownerDocument) {
    const resolvedDocument = ownerDocument !== null && ownerDocument !== void 0 ? ownerDocument : (typeof document !== 'undefined' ? document : null);
    if (!resolvedDocument) {
        throw new Error('A document is required to normalize JPEG EXIF orientation.');
    }
    return resolvedDocument;
}
function createCanvas(ownerDocument) {
    return getCanvasDocument(ownerDocument).createElement('canvas');
}
function isRotatedRightAngle(orientation) {
    return orientation >= 5 && orientation <= 8;
}
function applyOrientationTransform(context, orientation, width, height) {
    switch (orientation) {
        case 2:
            context.transform(-1, 0, 0, 1, width, 0);
            break;
        case 3:
            context.transform(-1, 0, 0, -1, width, height);
            break;
        case 4:
            context.transform(1, 0, 0, -1, 0, height);
            break;
        case 5:
            context.transform(0, 1, 1, 0, 0, 0);
            break;
        case 6:
            context.transform(0, 1, -1, 0, height, 0);
            break;
        case 7:
            context.transform(0, -1, -1, 0, height, width);
            break;
        case 8:
            context.transform(0, -1, 1, 0, 0, width);
            break;
    }
}
function drawOrientedImage(decoded, orientation, options, ownerDocument) {
    var _a;
    const canvas = createCanvas(ownerDocument);
    const outputWidth = isRotatedRightAngle(orientation) ? decoded.height : decoded.width;
    const outputHeight = isRotatedRightAngle(orientation) ? decoded.width : decoded.height;
    canvas.width = outputWidth;
    canvas.height = outputHeight;
    const context = canvas.getContext('2d');
    if (!context) {
        throw new Error('Unable to create a canvas context for JPEG EXIF orientation.');
    }
    applyOrientationTransform(context, orientation, decoded.width, decoded.height);
    context.drawImage(decoded.source, 0, 0, decoded.width, decoded.height);
    return canvas.toDataURL('image/jpeg', (_a = options.autoOrientImageQuality) !== null && _a !== void 0 ? _a : options.downsampleQuality);
}
async function normalizeJpegOrientationIfNeeded(file, dataUrl, options, ownerDocument) {
    if (!options.autoOrientImage || !isJpegFile(file))
        return null;
    const orientation = await readFileOrientation(file);
    if (orientation === null || orientation === 1)
        return null;
    const decoded = await createRawImageBitmap(file);
    try {
        return drawOrientedImage(decoded, orientation, options, ownerDocument);
    }
    finally {
        decoded.close();
    }
}

async function loadImageFile(context, file) {
    var _a;
    const inputElement = context.getInputElement();
    const mime = inferImageMimeType(file);
    if (!mime) {
        reportWarning(context.options, null, `Unsupported image file type: ${file.type || file.name || 'unknown'}.`);
        resetFileInput(inputElement);
        return;
    }
    try {
        await assertImageFileInputBudget(file, context.options);
    }
    catch (error) {
        reportWarning(context.options, error, error instanceof Error ? error.message : 'Image file exceeds configured input limits.');
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
        try {
            dataUrl =
                (_a = (await normalizeJpegOrientationIfNeeded(file, dataUrl, context.options, inputElement === null || inputElement === void 0 ? void 0 : inputElement.ownerDocument))) !== null && _a !== void 0 ? _a : dataUrl;
        }
        catch (error) {
            reportWarning(context.options, error, 'JPEG EXIF orientation normalization failed; loading the original file data.');
        }
        await context.loadImage(dataUrl);
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
                duration,
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
        const previousScale = this.context.getCurrentScale();
        const previousScaleX = imageObject.scaleX;
        const previousScaleY = imageObject.scaleY;
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
            reportWarning(this.context.options, error, 'scaleImage origin pre-anchor failed.');
        }
        try {
            await this.context.guard.runAnimation(() => animateProps(imageObject, { scaleX: targetAbs, scaleY: targetAbs }, {
                duration: this.context.options.animationDuration,
                onChange: () => this.context.canvas.requestRenderAll(),
            }, this.context.guard));
        }
        catch (error) {
            this.context.setCurrentScale(previousScale);
            if (!this.context.guard.isDisposed()) {
                imageObject.set({ scaleX: previousScaleX, scaleY: previousScaleY });
                imageObject.setCoords();
                if (this.context.afterTransformSnap)
                    this.context.afterTransformSnap();
            }
            reportWarning(this.context.options, error, 'scaleImage animation failed.');
            return;
        }
        if (this.context.guard.isDisposed())
            return;
        imageObject.set({ scaleX: targetAbs, scaleY: targetAbs });
        imageObject.setCoords();
        try {
            if (this.context.afterTransformSnap)
                this.context.afterTransformSnap();
        }
        finally {
            this.context.saveCanvasState();
        }
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
        const previousRotation = this.context.getCurrentRotation();
        const previousAngle = imageObject.angle;
        this.context.setCurrentRotation(degrees);
        try {
            const centre = imageObject.getCenterPoint();
            imageObject.set({ originX: 'center', originY: 'center' });
            imageObject.setPositionByOrigin(centre, 'center', 'center');
            imageObject.setCoords();
        }
        catch (error) {
            reportWarning(this.context.options, error, 'rotateImage origin pre-anchor failed.');
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
            this.context.setCurrentRotation(previousRotation);
            if (!this.context.guard.isDisposed()) {
                imageObject.set('angle', previousAngle !== null && previousAngle !== void 0 ? previousAngle : previousRotation);
                imageObject.setCoords();
                restoreOrigin(imageObject, 'left', 'top');
                if (this.context.afterTransformSnap)
                    this.context.afterTransformSnap();
            }
            reportWarning(this.context.options, error, 'rotateImage animation failed.');
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
        try {
            const newTopLeft = computeTopLeftPoint(imageObject);
            imageObject.set({ originX: 'left', originY: 'top' });
            imageObject.setPositionByOrigin(newTopLeft, 'left', 'top');
            imageObject.setCoords();
        }
        catch (error) {
            reportWarning(this.context.options, error, 'rotateImage origin post-restore failed.');
        }
        try {
            if (this.context.afterTransformSnap)
                this.context.afterTransformSnap();
        }
        finally {
            this.context.saveCanvasState();
        }
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
            reportWarning(this.context.options, error, `${property === 'flipX' ? 'flipHorizontal' : 'flipVertical'} failed.`);
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

function scaleImageAction(access, factor) {
    if (!Number.isFinite(factor))
        return Promise.resolve();
    return runQueuedTransformAction(access, 'scaleImage', (controller) => controller.scaleImage(factor));
}
function rotateImageAction(access, degrees) {
    if (!Number.isFinite(degrees))
        return Promise.resolve();
    return runQueuedTransformAction(access, 'rotateImage', (controller) => controller.rotateImage(degrees));
}
function flipHorizontalAction(access) {
    return runQueuedTransformAction(access, 'flipHorizontal', (controller) => controller.flipHorizontal());
}
function flipVerticalAction(access) {
    return runQueuedTransformAction(access, 'flipVertical', (controller) => controller.flipVertical());
}
function resetImageTransformAction(access) {
    return runQueuedTransformAction(access, 'resetImageTransform', (controller) => controller.resetImageTransform());
}
function runQueuedTransformAction(access, operation, runControllerAction) {
    const controller = access.getTransformController();
    if (access.isDisposed() || !controller)
        return Promise.resolve();
    try {
        access.assertCanQueueAnimation(operation);
    }
    catch (error) {
        return Promise.reject(error);
    }
    const context = access.buildCallbackContext(operation, false);
    const job = access.enqueueAnimation(async () => {
        if (access.isDisposed())
            return;
        access.updateUi();
        try {
            await runControllerAction(controller);
            if (!access.isDisposed())
                access.emitImageChanged(context);
        }
        finally {
            if (!access.isDisposed()) {
                access.updateInputs();
            }
        }
    });
    access.emitBusyChangeIfChanged(context);
    return job.finally(() => {
        if (!access.isDisposed()) {
            access.refreshUiAfterQueuedAnimation();
            access.emitBusyChangeIfChanged(context);
        }
    });
}

class EditorActionAccessFactory {
    constructor(runtime, callbacks, contextFactory) {
        Object.defineProperty(this, "runtime", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: runtime
        });
        Object.defineProperty(this, "callbacks", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: callbacks
        });
        Object.defineProperty(this, "contextFactory", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: contextFactory
        });
    }
    buildBusyOperationAccess() {
        const { runtime, callbacks } = this;
        return {
            beginBusyOperation: (operation) => runtime.operationGuard.beginBusyOperation(operation),
            endBusyOperation: (token) => {
                runtime.operationGuard.endBusyOperation(token);
            },
            buildCallbackContext: (operation, isInternalOperation) => callbacks.buildCallbackContext(operation, isInternalOperation),
            emitBusyChangeIfChanged: (context) => {
                callbacks.emitBusyChangeIfChanged(context);
            },
            updateUi: () => {
                callbacks.updateUi();
            },
        };
    }
    buildTransformActionAccess() {
        const { runtime, callbacks } = this;
        return {
            isDisposed: () => runtime.isDisposed,
            getTransformController: () => runtime.transformController,
            assertCanQueueAnimation: (operation) => {
                callbacks.assertCanQueueAnimation(operation);
            },
            buildCallbackContext: (operation, isInternalOperation) => callbacks.buildCallbackContext(operation, isInternalOperation),
            enqueueAnimation: (body) => runtime.animQueue.add(body),
            updateInputs: () => {
                callbacks.updateInputs();
            },
            updateUi: () => {
                callbacks.updateUi();
            },
            refreshUiAfterQueuedAnimation: () => {
                callbacks.refreshUiAfterQueuedAnimation();
            },
            emitImageChanged: (context) => {
                callbacks.emitImageChanged(context);
            },
            emitBusyChangeIfChanged: (context) => {
                callbacks.emitBusyChangeIfChanged(context);
            },
        };
    }
    buildEditorStateActionAccess() {
        const { runtime, callbacks } = this;
        return {
            getCanvas: () => runtime.canvas,
            getLiveCanvas: (operationName) => runtime.getLiveCanvasOrThrow(operationName),
            getOptions: () => runtime.options,
            isDisposed: () => runtime.isDisposed,
            canRunIdleOperation: (operation, options) => callbacks.canRunIdleOperation(operation, options),
            getActiveStateRestoreOperation: () => runtime.activeStateRestoreOperation,
            buildCallbackContext: (operation, isInternalOperation) => callbacks.buildCallbackContext(operation, isInternalOperation),
            getOriginalImage: () => runtime.originalImage,
            setOriginalImage: (image) => {
                runtime.originalImage = image;
            },
            getMaskCollectionSignature: () => callbacks.getMaskCollectionSignature(),
            getAnnotationCollectionSignature: () => callbacks.getAnnotationCollectionSignature(),
            setCanvasSize: (widthPx, heightPx) => {
                callbacks.setCanvasSize(widthPx, heightPx);
            },
            hideAllMaskLabels: () => {
                callbacks.hideAllMaskLabels();
            },
            inferCurrentImageMimeType: () => callbacks.inferCurrentImageMimeType(),
            setCurrentImageMimeType: (mimeType) => {
                runtime.currentImageMimeType = mimeType;
            },
            getCurrentImageFilterConfig: () => runtime.currentImageFilterConfig,
            restoreImageFilterConfig: (config) => {
                const next = cloneResolvedImageFilterConfig(config !== null && config !== void 0 ? config : DEFAULT_IMAGE_FILTER_CONFIG);
                runtime.currentImageFilterConfig = next;
                runtime.lastCommittedImageFilterConfig = cloneResolvedImageFilterConfig(next);
                if (runtime.originalImage) {
                    applyImageFilterConfigToImage(runtime.fabricModule, runtime.originalImage, next);
                }
            },
            setIsImageLoadedToCanvas: (value) => {
                runtime.isImageLoadedToCanvas = value;
            },
            setMaskCounter: (value) => {
                runtime.maskCounter = value;
            },
            setAnnotationCounter: (value) => {
                runtime.annotationCounter = value;
            },
            setCurrentScale: (value) => {
                runtime.currentScale = value;
            },
            setCurrentRotation: (value) => {
                runtime.currentRotation = value;
            },
            setBaseImageScale: (value) => {
                runtime.baseImageScale = value;
            },
            setLastMask: (mask) => {
                runtime.lastMask = mask;
            },
            getLastSnapshot: () => runtime.lastSnapshot,
            setLastSnapshot: (snapshot) => {
                runtime.lastSnapshot = snapshot;
            },
            shouldNormalizeCanvasSizeAfterStateRestore: () => callbacks.shouldNormalizeCanvasSizeAfterStateRestore(),
            updateCanvasSizeToImageBounds: (options) => {
                callbacks.updateCanvasSizeToImageBounds(options);
            },
            alignObjectBoundingBoxToCanvasTopLeft: (object) => {
                callbacks.alignObjectBoundingBoxToCanvasTopLeft(object);
            },
            settleFitCoverScrollbarsAfterStateRestore: () => {
                callbacks.settleFitCoverScrollbarsAfterStateRestore();
            },
            buildTextControllerContext: () => this.contextFactory.buildTextControllerContext(),
            updateInputs: () => {
                callbacks.updateInputs();
            },
            updateMaskList: () => {
                callbacks.updateMaskList();
            },
            updateAnnotationList: () => {
                callbacks.updateAnnotationList();
            },
            updateUi: () => {
                callbacks.updateUi();
            },
            emitImageCleared: (image, context) => {
                callbacks.emitImageCleared(image, context);
            },
            emitMasksChanged: (context) => {
                callbacks.emitMasksChanged(context);
            },
            emitAnnotationsChanged: (context) => {
                callbacks.emitAnnotationsChanged(context);
            },
            emitImageChanged: (context) => {
                callbacks.emitImageChanged(context);
            },
            withSelectionChangeContext: (context, callback) => callbacks.withSelectionChangeContext(context, callback),
            handleSelectionChanged: (selected) => {
                callbacks.handleSelectionChanged(selected);
            },
            shouldSuppressSaveState: () => runtime.shouldSuppressSaveState,
            getCurrentScale: () => runtime.currentScale,
            getCurrentRotation: () => runtime.currentRotation,
            getBaseImageScale: () => runtime.baseImageScale,
            getCurrentImageMimeType: () => runtime.currentImageMimeType,
            getHistoryManager: () => runtime.historyManager,
            withAnimationQueueBypass: () => callbacks.withAnimationQueueBypass(),
            showLabelForMask: (mask) => {
                callbacks.showLabelForMask(mask);
            },
            updateMaskListSelection: (mask) => {
                callbacks.updateMaskListSelection(mask);
            },
            updateAnnotationListSelection: (annotation) => {
                callbacks.updateAnnotationListSelection(annotation);
            },
        };
    }
    buildMaskActionAccess() {
        const { runtime, callbacks } = this;
        return {
            getCanvas: () => runtime.canvas,
            getMasks: () => callbacks.getMasks(),
            canRunIdleOperation: (operation, options) => callbacks.canRunIdleOperation(operation, options),
            buildCallbackContext: (operation, isInternalOperation) => callbacks.buildCallbackContext(operation, isInternalOperation),
            buildCreateMaskContext: () => this.contextFactory.buildCreateMaskContext(),
            buildRemoveMaskContext: () => this.contextFactory.buildRemoveMaskContext(),
            withSelectionChangeContext: (context, callback) => callbacks.withSelectionChangeContext(context, callback),
            updateUi: () => {
                callbacks.updateUi();
            },
            emitMasksChanged: (context) => {
                callbacks.emitMasksChanged(context);
            },
            emitImageChanged: (context) => {
                callbacks.emitImageChanged(context);
            },
        };
    }
    buildSelectionControllerAccess() {
        const { runtime, callbacks } = this;
        return {
            getCanvas: () => runtime.canvas,
            removeLabelForMask: (mask) => {
                callbacks.removeLabelForMask(mask);
            },
            showLabelForMask: (mask) => {
                callbacks.showLabelForMask(mask);
            },
            syncMaskLabel: (mask) => {
                callbacks.syncMaskLabel(mask);
            },
            updateMaskListSelection: (mask) => {
                callbacks.updateMaskListSelection(mask);
            },
            updateAnnotationListSelection: (annotation) => {
                callbacks.updateAnnotationListSelection(annotation);
            },
            updateUi: () => {
                callbacks.updateUi();
            },
            saveState: () => {
                callbacks.saveState();
            },
            getNextSelectionChangeContext: () => runtime.nextSelectionChangeContext,
            getActiveStateRestoreOperation: () => runtime.activeStateRestoreOperation,
            shouldSuppressSelectionChange: () => runtime.shouldSuppressSelectionChange,
            buildSelection: (selected) => callbacks.buildSelection(selected),
            buildCallbackContext: (operation, isHistoryRestore) => callbacks.buildCallbackContext(operation, isHistoryRestore),
            emitSelectionChange: (selection, context) => {
                callbacks.emitSelectionChange(selection, context);
            },
            emitMasksChanged: (context) => {
                callbacks.emitMasksChanged(context);
            },
            emitAnnotationsChanged: (context) => {
                callbacks.emitAnnotationsChanged(context);
            },
            emitImageChanged: (context) => {
                callbacks.emitImageChanged(context);
            },
        };
    }
    buildAnnotationModeActionAccess() {
        const { runtime, callbacks } = this;
        return {
            getCanvas: () => runtime.canvas,
            getTextSession: () => runtime.textSession,
            getDrawSession: () => runtime.drawSession,
            isToolModeActive: () => runtime.cropSession !== null ||
                runtime.mosaicSession !== null ||
                runtime.textSession !== null ||
                runtime.drawSession !== null ||
                runtime.shapeSession !== null,
            canRunIdleOperation: (operation, options) => callbacks.canRunIdleOperation(operation, options),
            buildTextControllerContext: () => this.contextFactory.buildTextControllerContext(),
            buildDrawControllerContext: () => this.contextFactory.buildDrawControllerContext(),
            buildCallbackContext: (operation, isInternalOperation) => callbacks.buildCallbackContext(operation, isInternalOperation),
            emitBusyChangeIfChanged: (context) => {
                callbacks.emitBusyChangeIfChanged(context);
            },
            emitImageChanged: (context) => {
                callbacks.emitImageChanged(context);
            },
        };
    }
    buildEditableObjectActionAccess() {
        const { runtime, callbacks } = this;
        return {
            getCanvas: () => runtime.canvas,
            getLiveCanvas: (operationName) => runtime.getLiveCanvasOrThrow(operationName),
            buildAnnotationManagerContext: () => this.contextFactory.buildAnnotationManagerContext(),
            getMasks: () => callbacks.getMasks(),
            getAnnotations: () => callbacks.getAnnotations(),
            removeLabelForMask: (mask) => {
                callbacks.removeLabelForMask(mask);
            },
            withSelectionChangeContext: (context, callback) => callbacks.withSelectionChangeContext(context, callback),
            buildCallbackContext: (operation, isInternalOperation) => callbacks.buildCallbackContext(operation, isInternalOperation),
            saveState: () => {
                callbacks.saveState();
            },
            updateMaskList: () => {
                callbacks.updateMaskList();
            },
            updateMaskListSelection: (mask) => {
                callbacks.updateMaskListSelection(mask);
            },
            updateAnnotationList: () => {
                callbacks.updateAnnotationList();
            },
            updateAnnotationListSelection: (annotation) => {
                callbacks.updateAnnotationListSelection(annotation);
            },
            updateUi: () => {
                callbacks.updateUi();
            },
            emitMasksChanged: (context) => {
                callbacks.emitMasksChanged(context);
            },
            emitAnnotationsChanged: (context) => {
                callbacks.emitAnnotationsChanged(context);
            },
            emitImageChanged: (context) => {
                callbacks.emitImageChanged(context);
            },
            reportWarning: (message) => {
                callbacks.reportWarning(null, message);
            },
        };
    }
    buildAnnotationConfigActionAccess() {
        const { runtime, callbacks } = this;
        return {
            getCanvas: () => runtime.canvas,
            isTextMode: () => runtime.textSession !== null,
            isDrawMode: () => runtime.drawSession !== null,
            getCurrentTextConfig: () => runtime.currentTextConfig,
            setCurrentTextConfig: (config) => {
                runtime.currentTextConfig = config;
            },
            getDefaultTextConfig: () => runtime.defaultTextConfig,
            getCurrentDrawConfig: () => runtime.currentDrawConfig,
            setCurrentDrawConfig: (config) => {
                runtime.currentDrawConfig = config;
            },
            getDefaultDrawConfig: () => runtime.defaultDrawConfig,
            canRunIdleOperation: (operation, options) => callbacks.canRunIdleOperation(operation, options),
            buildDrawControllerContext: () => this.contextFactory.buildDrawControllerContext(),
            buildCallbackContext: (operation, isInternalOperation) => callbacks.buildCallbackContext(operation, isInternalOperation),
            updateSelectedAnnotation: (config) => {
                callbacks.updateSelectedAnnotation(config);
            },
            setTextColor: (color) => {
                callbacks.setTextColor(color);
            },
            setTextFontSize: (size) => {
                callbacks.setTextFontSize(size);
            },
            setDrawColor: (color) => {
                callbacks.setDrawColor(color);
            },
            setDrawBrushSize: (size) => {
                callbacks.setDrawBrushSize(size);
            },
            reportWarning: (error, message) => {
                callbacks.reportWarning(error, message);
            },
            updateInputs: () => {
                callbacks.updateInputs();
            },
            updateUi: () => {
                callbacks.updateUi();
            },
            emitImageChanged: (context) => {
                callbacks.emitImageChanged(context);
            },
        };
    }
    buildExportActionAccess() {
        const { runtime, callbacks } = this;
        return {
            getCanvas: () => runtime.canvas,
            getAnnotations: () => callbacks.getAnnotations(),
            getMasks: () => callbacks.getMasks(),
            canRunIdleOperation: (operation, options) => callbacks.canRunIdleOperation(operation, options),
            assertIdleForOperation: (operation, options) => {
                callbacks.assertIdleForOperation(operation, options);
            },
            finalizeActiveTextEditingIfNeeded: () => {
                callbacks.finalizeActiveTextEditingIfNeeded();
            },
            buildExportServiceContext: () => this.contextFactory.buildExportServiceContext(),
            buildMergeMasksContext: (token) => this.contextFactory.buildMergeMasksContext(token),
            buildMergeAnnotationsContext: (token) => this.contextFactory.buildMergeAnnotationsContext(token),
            buildBusyOperationAccess: () => this.buildBusyOperationAccess(),
            updateInputs: () => {
                callbacks.updateInputs();
            },
            updateMaskList: () => {
                callbacks.updateMaskList();
            },
            updateAnnotationList: () => {
                callbacks.updateAnnotationList();
            },
            emitMasksChanged: (context) => {
                callbacks.emitMasksChanged(context);
            },
            emitAnnotationsChanged: (context) => {
                callbacks.emitAnnotationsChanged(context);
            },
            emitImageChanged: (context) => {
                callbacks.emitImageChanged(context);
            },
        };
    }
    buildMosaicActionAccess() {
        const { runtime, callbacks } = this;
        return {
            getCanvas: () => runtime.canvas,
            getOriginalImage: () => runtime.originalImage,
            getMosaicSession: () => runtime.mosaicSession,
            getMosaicConfig: () => runtime.currentMosaicConfig,
            setMosaicConfig: (config) => {
                runtime.currentMosaicConfig = config;
            },
            getDefaultMosaicConfig: () => runtime.defaultMosaicConfig,
            getOptions: () => runtime.options,
            isDisposed: () => runtime.isDisposed,
            isImageLoaded: () => runtime.isImageLoaded(),
            canRunIdleOperation: (operation, options) => callbacks.canRunIdleOperation(operation, options),
            buildMosaicControllerContext: () => this.contextFactory.buildMosaicControllerContext(),
            buildCallbackContext: (operation, isInternalOperation) => callbacks.buildCallbackContext(operation, isInternalOperation),
            updateInputs: () => {
                callbacks.updateInputs();
            },
            updateUi: () => {
                callbacks.updateUi();
            },
            emitImageChanged: (context) => {
                callbacks.emitImageChanged(context);
            },
            emitBusyChangeIfChanged: (context) => {
                callbacks.emitBusyChangeIfChanged(context);
            },
        };
    }
    buildCropActionAccess() {
        const { runtime, callbacks } = this;
        return {
            getCanvas: () => runtime.canvas,
            getOriginalImage: () => runtime.originalImage,
            getCropSession: () => runtime.cropSession,
            setCropSession: (session) => {
                runtime.cropSession = session;
            },
            isImageLoaded: () => runtime.isImageLoaded(),
            canRunIdleOperation: (operation, options) => callbacks.canRunIdleOperation(operation, options),
            buildCropControllerContext: (token) => this.contextFactory.buildCropControllerContext(token),
            buildBusyOperationAccess: () => this.buildBusyOperationAccess(),
            buildCallbackContext: (operation, isInternalOperation) => callbacks.buildCallbackContext(operation, isInternalOperation),
            getMasks: () => callbacks.getMasks(),
            updateInputs: () => {
                callbacks.updateInputs();
            },
            updateMaskList: () => {
                callbacks.updateMaskList();
            },
            updateUi: () => {
                callbacks.updateUi();
            },
            emitMasksChanged: (context) => {
                callbacks.emitMasksChanged(context);
            },
            emitImageChanged: (context) => {
                callbacks.emitImageChanged(context);
            },
            emitBusyChangeIfChanged: (context) => {
                callbacks.emitBusyChangeIfChanged(context);
            },
        };
    }
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
function resolveMaskNumericField(options, fieldName, value, axis, fallback, canvas) {
    try {
        return resolveNumeric(value, axis, fallback, canvas, options);
    }
    catch (error) {
        reportWarning(options, error, `createMask skipped: ${fieldName} resolver threw.`);
        return null;
    }
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
function resizeMaskCanvas(context, width, height) {
    if (context.expandCanvasIfNeeded) {
        context.expandCanvasIfNeeded(width, height);
    }
    else {
        context.canvas.setDimensions({ width, height });
    }
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
        const resolvedLeft = resolveMaskNumericField(options, 'left', mergedConfig.left, 'x', firstOffset, canvas);
        const resolvedTop = resolveMaskNumericField(options, 'top', mergedConfig.top, 'y', firstOffset, canvas);
        if (resolvedLeft === null || resolvedTop === null)
            return null;
        left = resolvedLeft;
        top = resolvedTop;
    }
    const resolvedWidth = resolveMaskNumericField(options, 'width', mergedConfig.width, 'x', options.defaultMaskWidth, canvas);
    const resolvedHeight = resolveMaskNumericField(options, 'height', mergedConfig.height, 'y', options.defaultMaskHeight, canvas);
    if (resolvedWidth === null || resolvedHeight === null)
        return null;
    resolvedConfig.width = resolvedWidth;
    resolvedConfig.height = resolvedHeight;
    let rx;
    if (mergedConfig.rx !== undefined) {
        const resolvedRx = resolveMaskNumericField(options, 'rx', mergedConfig.rx, 'x', 0, canvas);
        if (resolvedRx === null)
            return null;
        rx = resolvedRx;
    }
    let ry;
    if (mergedConfig.ry !== undefined) {
        const resolvedRy = resolveMaskNumericField(options, 'ry', mergedConfig.ry, 'y', 0, canvas);
        if (resolvedRy === null)
            return null;
        ry = resolvedRy;
    }
    let radius;
    if (shapeType === 'circle') {
        const resolvedRadius = resolveMaskNumericField(options, 'radius', mergedConfig.radius, 'x', Math.min(resolvedConfig.width, resolvedConfig.height) / 2, canvas);
        if (resolvedRadius === null)
            return null;
        radius = resolvedRadius;
    }
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
    let preExpandCanvasSize = null;
    if (options.layoutMode === 'expand') {
        const requiredWidth = Math.ceil(left + resolvedConfig.width + 10);
        const requiredHeight = Math.ceil(top + resolvedConfig.height + 10);
        const nextWidth = Math.max(canvas.getWidth(), requiredWidth);
        const nextHeight = Math.max(canvas.getHeight(), requiredHeight);
        if (nextWidth !== canvas.getWidth() || nextHeight !== canvas.getHeight()) {
            preExpandCanvasSize = { width: canvas.getWidth(), height: canvas.getHeight() };
            resizeMaskCanvas(context, nextWidth, nextHeight);
        }
    }
    const rollbackCanvasExpansion = () => {
        if (!preExpandCanvasSize)
            return;
        try {
            resizeMaskCanvas(context, preExpandCanvasSize.width, preExpandCanvasSize.height);
        }
        catch (error) {
            reportWarning(options, error, 'createMask rollback canvas size failed.');
        }
    };
    let mask;
    if (typeof config.fabricGenerator === 'function') {
        let generated;
        try {
            generated = config.fabricGenerator(resolvedConfig, canvas, options);
        }
        catch (error) {
            rollbackCanvasExpansion();
            reportWarning(options, error, 'createMask skipped: fabricGenerator threw.');
            return null;
        }
        if (!isFabricObjectLike(generated)) {
            rollbackCanvasExpansion();
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
            withSelectionChangeSuppressed: (callback) => access.withSelectionChangeSuppressed(callback),
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
            getCurrentImageFilterConfig: () => access.getCurrentImageFilterConfig(),
            resetImageFilterState: () => {
                access.resetImageFilterState();
            },
            restoreImageFilterConfig: (config) => {
                access.restoreImageFilterConfig(config);
            },
            setCanvasSize: (width, height) => {
                access.setCanvasSize(width, height);
            },
            applyRollbackRestoredState: (restoredState) => {
                var _a, _b;
                access.hideAllMaskLabels();
                const canvas = access.getCanvas();
                const originalImage = restoredState.originalImage;
                access.setOriginalImage(originalImage);
                if (originalImage) {
                    originalImage.set({
                        originX: 'left',
                        originY: 'top',
                        selectable: false,
                        evented: false,
                        hasControls: false,
                        hoverCursor: 'default',
                    });
                    canvas === null || canvas === void 0 ? void 0 : canvas.sendObjectToBack(originalImage);
                }
                access.restoreImageFilterConfig((_b = (_a = restoredState.editorState) === null || _a === void 0 ? void 0 : _a.imageFilterConfig) !== null && _b !== void 0 ? _b : null);
                const restoredMasks = restoredState.masks;
                access.setLastMask(restoredMasks.reduce((lastMask, maskObject) => !lastMask || maskObject.maskId > lastMask.maskId
                    ? maskObject
                    : lastMask, null));
                restoredMasks.forEach((maskObject) => {
                    applyMaskUnselectedStyle(maskObject);
                    reattachMaskHoverHandlers(maskObject);
                });
                syncAnnotationRuntimeStates(restoredState.annotations);
                attachTextEditingHandlersToAnnotations(this.buildTextControllerContext(), restoredState.annotations);
                access.updateMaskList();
                access.updateAnnotationList();
                access.updateInputs();
                access.updateUi();
            },
            resetAfterRollbackFailure: () => {
                const canvas = access.getCanvas();
                try {
                    canvas === null || canvas === void 0 ? void 0 : canvas.clear();
                    if (canvas) {
                        canvas.backgroundColor = access.getOptions().backgroundColor;
                        canvas.renderAll();
                    }
                }
                catch {
                }
                access.setOriginalImage(null);
                access.setIsImageLoadedToCanvas(false);
                access.setCurrentImageMimeType(null);
                access.resetImageFilterState();
                access.setLastSnapshot(null);
                access.setLastMask(null);
                access.setMaskCounter(0);
                access.setAnnotationCounter(0);
                access.setCurrentScale(1);
                access.setCurrentRotation(0);
                access.setBaseImageScale(1);
                access.updateMaskList();
                access.updateAnnotationList();
                access.updateInputs();
                access.updateUi();
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
            getCanvas: () => access.getCanvas(),
            getListElement: () => access.getMaskListElement(),
            listOrder: access.getOptions().maskListOrder,
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
            getCanvas: () => access.getCanvas(),
            getListElement: () => access.getAnnotationListElement(),
            listOrder: access.getOptions().annotationListOrder,
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
            getEraserConfig: () => access.getEraserConfig(),
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
    buildShapeControllerContext() {
        const access = this.access;
        return {
            fabric: access.getFabric(),
            canvas: access.getLiveCanvas('shapeController'),
            options: access.getOptions(),
            getOriginalImage: () => access.getOriginalImage(),
            getShapeConfig: () => access.getShapeConfig(),
            isImageLoaded: () => access.isImageLoaded(),
            getAnnotationCounter: () => access.getAnnotationCounter(),
            setAnnotationCounter: (value) => {
                access.setAnnotationCounter(value);
            },
            getShapeSession: () => access.getShapeSession(),
            setShapeSession: (session) => {
                access.setShapeSession(session);
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
            getCurrentImageFilterConfig: () => access.getCurrentImageFilterConfig(),
            resetImageFilterState: () => {
                access.resetImageFilterState();
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

function createEditorContextFactory(runtime, callbacks) {
    return new EditorContextFactory({
        getFabric: () => runtime.fabricModule,
        getOptions: () => runtime.options,
        getRuntimeOptions: () => runtime.getRuntimeOptions(),
        getHistoryManager: () => runtime.historyManager,
        getOperationGuard: () => runtime.operationGuard,
        getCanvas: () => runtime.canvas,
        getLiveCanvas: (operationName) => runtime.getLiveCanvasOrThrow(operationName),
        getContainerElement: () => runtime.containerElement,
        getPlaceholderElement: () => runtime.placeholderElement,
        getViewportCache: () => runtime.viewportCache,
        isDisposed: () => runtime.isDisposed,
        isImageLoaded: () => runtime.isImageLoaded(),
        getOriginalImage: () => runtime.originalImage,
        setOriginalImage: (image) => {
            runtime.originalImage = image;
        },
        getIsImageLoadedToCanvas: () => runtime.isImageLoadedToCanvas,
        setIsImageLoadedToCanvas: (value) => {
            runtime.isImageLoadedToCanvas = value;
        },
        getCurrentImageMimeType: () => runtime.currentImageMimeType,
        setCurrentImageMimeType: (mimeType) => {
            runtime.currentImageMimeType = mimeType;
        },
        getCurrentImageFilterConfig: () => cloneResolvedImageFilterConfig(runtime.currentImageFilterConfig),
        resetImageFilterState: () => {
            const next = cloneResolvedImageFilterConfig(DEFAULT_IMAGE_FILTER_CONFIG);
            runtime.currentImageFilterConfig = next;
            runtime.lastCommittedImageFilterConfig = cloneResolvedImageFilterConfig(next);
            if (runtime.originalImage) {
                applyImageFilterConfigToImage(runtime.fabricModule, runtime.originalImage, next);
            }
        },
        restoreImageFilterConfig: (config) => {
            const next = cloneResolvedImageFilterConfig(config !== null && config !== void 0 ? config : DEFAULT_IMAGE_FILTER_CONFIG);
            runtime.currentImageFilterConfig = next;
            runtime.lastCommittedImageFilterConfig = cloneResolvedImageFilterConfig(next);
            if (runtime.originalImage) {
                applyImageFilterConfigToImage(runtime.fabricModule, runtime.originalImage, next);
            }
        },
        getLastSnapshot: () => runtime.lastSnapshot,
        setLastSnapshot: (snapshot) => {
            runtime.lastSnapshot = snapshot;
        },
        getCurrentScale: () => runtime.currentScale,
        setCurrentScale: (scale) => {
            runtime.currentScale = scale;
        },
        getCurrentRotation: () => runtime.currentRotation,
        setCurrentRotation: (rotation) => {
            runtime.currentRotation = rotation;
        },
        getBaseImageScale: () => runtime.baseImageScale,
        setBaseImageScale: (scale) => {
            runtime.baseImageScale = scale;
        },
        getMaskCounter: () => runtime.maskCounter,
        setMaskCounter: (value) => {
            runtime.maskCounter = value;
        },
        getLastMask: () => runtime.lastMask,
        setLastMask: (mask) => {
            runtime.lastMask = mask;
        },
        getAnnotationCounter: () => runtime.annotationCounter,
        setAnnotationCounter: (value) => {
            runtime.annotationCounter = value;
        },
        getTextConfig: () => runtime.currentTextConfig,
        getDrawConfig: () => runtime.currentDrawConfig,
        getEraserConfig: () => cloneResolvedEraserConfig(runtime.currentEraserConfig),
        getShapeConfig: () => cloneResolvedShapeAnnotationConfig(runtime.currentShapeConfig),
        getMosaicConfig: () => cloneResolvedMosaicConfig(runtime.currentMosaicConfig),
        getTextSession: () => runtime.textSession,
        setTextSession: (session) => {
            runtime.textSession = session;
        },
        getDrawSession: () => runtime.drawSession,
        setDrawSession: (session) => {
            runtime.drawSession = session;
        },
        getShapeSession: () => runtime.shapeSession,
        setShapeSession: (session) => {
            runtime.shapeSession = session;
        },
        getMosaicSession: () => runtime.mosaicSession,
        setMosaicSession: (session) => {
            runtime.mosaicSession = session;
        },
        getCropSession: () => runtime.cropSession,
        setCropSession: (session) => {
            runtime.cropSession = session;
        },
        saveCanvasState: () => callbacks.saveCanvasState(),
        saveCanvasStateWithAnimationBypass: () => callbacks.saveCanvasStateWithAnimationBypass(),
        setSuppressSaveState: (suppress) => {
            runtime.shouldSuppressSaveState = suppress;
        },
        withSelectionChangeSuppressed: async (callback) => {
            const previous = runtime.shouldSuppressSelectionChange;
            runtime.shouldSuppressSelectionChange = true;
            try {
                return await callback();
            }
            finally {
                runtime.shouldSuppressSelectionChange = previous;
            }
        },
        captureSnapshot: () => callbacks.captureSnapshot(),
        loadImageForOperation: (operationToken, base64, providedOptions) => callbacks.loadImageForOperation(operationToken, base64, providedOptions),
        loadMergedImage: (operationToken, base64, providedOptions) => callbacks.loadMergedImage(operationToken, base64, providedOptions),
        loadFromStateForOperation: (operationToken, snapshot) => callbacks.loadFromStateForOperation(operationToken, snapshot),
        setCanvasSize: (widthPx, heightPx) => {
            callbacks.setCanvasSize(widthPx, heightPx);
        },
        updateCanvasSizeToImageBounds: () => callbacks.updateCanvasSizeToImageBounds(),
        alignObjectBoundingBoxToCanvasTopLeft: (object) => {
            callbacks.alignObjectBoundingBoxToCanvasTopLeft(object);
        },
        syncMaskLabel: (mask) => {
            callbacks.syncMaskLabel(mask);
        },
        removeLabelForMask: (mask) => {
            callbacks.removeLabelForMask(mask);
        },
        hideAllMaskLabels: () => {
            callbacks.hideAllMaskLabels();
        },
        setPlaceholderVisible: (show) => {
            setPlaceholderVisible(runtime.placeholderElement, runtime.containerElement, runtime.options.showPlaceholder ? show : false);
        },
        updateMaskList: () => callbacks.updateMaskList(),
        updateAnnotationList: () => callbacks.updateAnnotationList(),
        updateUi: () => callbacks.updateUi(),
        updateInputs: () => callbacks.updateInputs(),
        getMaskListElement: () => {
            var _a;
            return resolveDomElement(runtime.elements.maskList, (_a = runtime.canvasElement) === null || _a === void 0 ? void 0 : _a.ownerDocument);
        },
        handleMaskSelected: (mask) => callbacks.handleSelectionChanged([mask]),
        getAnnotationListElement: () => {
            var _a;
            return resolveDomElement(runtime.elements.annotationList, (_a = runtime.canvasElement) === null || _a === void 0 ? void 0 : _a.ownerDocument);
        },
        handleAnnotationSelected: (annotation) => callbacks.handleSelectionChanged([annotation]),
        getMasks: () => callbacks.getMasks(),
        getAnnotations: () => callbacks.getAnnotations(),
        emitImageChanged: (context) => {
            callbacks.emitImageChanged(context);
        },
        emitAnnotationsChanged: (context) => {
            callbacks.emitAnnotationsChanged(context);
        },
        emitBusyChangeIfChanged: (context) => {
            callbacks.emitBusyChangeIfChanged(context);
        },
        buildCallbackContext: (operation, isInternalOperation) => callbacks.buildCallbackContext(operation, isInternalOperation),
    });
}

function createEditorRuntimeWiring(runtime, hooks) {
    const contextFactory = createContextFactory(runtime, hooks);
    return {
        contextFactory,
        actionAccessFactory: new EditorActionAccessFactory(runtime, createActionCallbacks(hooks), contextFactory),
    };
}
function createContextFactory(runtime, hooks) {
    return createEditorContextFactory(runtime, {
        saveCanvasState: () => {
            hooks.state.saveCanvasState();
        },
        saveCanvasStateWithAnimationBypass: () => {
            hooks.state.saveCanvasState(hooks.operations.withAnimationQueueBypass());
        },
        captureSnapshot: () => hooks.state.captureSnapshot(),
        loadImageForOperation: (operationToken, base64, providedOptions) => hooks.state.loadImage(base64, hooks.operations.withInternalOperationOptions(operationToken, providedOptions !== null && providedOptions !== void 0 ? providedOptions : {})),
        loadMergedImage: async (operationToken, base64, providedOptions) => {
            const geometry = hooks.display.captureImageDisplayGeometry();
            try {
                await hooks.state.loadImage(base64, hooks.operations.withInternalOperationOptions(operationToken, providedOptions !== null && providedOptions !== void 0 ? providedOptions : {}));
            }
            finally {
                hooks.display.restoreMergedImageDisplayGeometry(geometry);
            }
        },
        loadFromStateForOperation: (operationToken, snapshot) => hooks.state.loadFromState(snapshot, hooks.operations.withInternalOperationOptions(operationToken, hooks.operations.withAnimationQueueBypass())),
        setCanvasSize: (widthPx, heightPx) => {
            hooks.display.setCanvasSize(widthPx, heightPx);
        },
        updateCanvasSizeToImageBounds: () => hooks.display.updateCanvasSizeToImageBounds(),
        alignObjectBoundingBoxToCanvasTopLeft: (object) => {
            hooks.display.alignObjectBoundingBoxToCanvasTopLeft(object);
        },
        syncMaskLabel: (mask) => {
            hooks.labels.syncMaskLabel(mask);
        },
        removeLabelForMask: (mask) => {
            hooks.labels.removeLabelForMask(mask);
        },
        hideAllMaskLabels: () => {
            hooks.labels.hideAllMaskLabels();
        },
        updateMaskList: () => {
            hooks.ui.updateMaskList();
        },
        updateAnnotationList: () => {
            hooks.ui.updateAnnotationList();
        },
        updateUi: () => {
            hooks.ui.updateUi();
        },
        updateInputs: () => {
            hooks.ui.updateInputs();
        },
        handleSelectionChanged: (selected) => {
            hooks.selection.handleSelectionChanged(selected);
        },
        getMasks: () => hooks.selection.getMasks(),
        getAnnotations: () => hooks.selection.getAnnotations(),
        emitImageChanged: (context) => {
            hooks.callbacks.emitImageChanged(context);
        },
        emitAnnotationsChanged: (context) => {
            hooks.callbacks.emitAnnotationsChanged(context);
        },
        emitBusyChangeIfChanged: (context) => {
            hooks.callbacks.emitBusyChangeIfChanged(context);
        },
        buildCallbackContext: (operation, isInternalOperation) => hooks.callbacks.buildCallbackContext(operation, isInternalOperation !== null && isInternalOperation !== void 0 ? isInternalOperation : false),
    });
}
function createActionCallbacks(hooks) {
    return {
        canRunIdleOperation: (operation, options) => hooks.operations.canRunIdleOperation(operation, options),
        assertIdleForOperation: (operation, options) => {
            hooks.operations.assertIdleForOperation(operation, options);
        },
        assertCanQueueAnimation: (operation) => {
            hooks.operations.assertCanQueueAnimation(operation);
        },
        finalizeActiveTextEditingIfNeeded: () => {
            hooks.operations.finalizeActiveTextEditingIfNeeded();
        },
        buildCallbackContext: (operation, isInternalOperation) => hooks.callbacks.buildCallbackContext(operation, isInternalOperation),
        withSelectionChangeContext: (context, callback) => hooks.operations.withSelectionChangeContext(context, callback),
        buildSelection: (selected) => hooks.selection.buildSelection(selected),
        getMasks: () => hooks.selection.getMasks(),
        getAnnotations: () => hooks.selection.getAnnotations(),
        getMaskCollectionSignature: () => hooks.selection.getMaskCollectionSignature(),
        getAnnotationCollectionSignature: () => hooks.selection.getAnnotationCollectionSignature(),
        inferCurrentImageMimeType: () => hooks.display.inferCurrentImageMimeType(),
        shouldNormalizeCanvasSizeAfterStateRestore: () => hooks.display.shouldNormalizeCanvasSizeAfterStateRestore(),
        updateCanvasSizeToImageBounds: (options) => {
            hooks.display.updateCanvasSizeToImageBounds(options);
        },
        alignObjectBoundingBoxToCanvasTopLeft: (object) => {
            hooks.display.alignObjectBoundingBoxToCanvasTopLeft(object);
        },
        settleFitCoverScrollbarsAfterStateRestore: () => {
            hooks.display.settleFitCoverScrollbarsAfterStateRestore();
        },
        setCanvasSize: (widthPx, heightPx) => {
            hooks.display.setCanvasSize(widthPx, heightPx);
        },
        refreshUiAfterQueuedAnimation: () => {
            hooks.ui.refreshUiAfterQueuedAnimation();
        },
        updateInputs: () => {
            hooks.ui.updateInputs();
        },
        updateMaskList: () => {
            hooks.ui.updateMaskList();
        },
        updateMaskListSelection: (mask) => {
            hooks.ui.updateMaskListSelection(mask);
        },
        updateAnnotationList: () => {
            hooks.ui.updateAnnotationList();
        },
        updateAnnotationListSelection: (annotation) => {
            hooks.ui.updateAnnotationListSelection(annotation);
        },
        updateUi: () => {
            hooks.ui.updateUi();
        },
        saveState: () => {
            hooks.state.saveCanvasState();
        },
        removeLabelForMask: (mask) => {
            hooks.labels.removeLabelForMask(mask);
        },
        showLabelForMask: (mask) => {
            hooks.labels.showLabelForMask(mask);
        },
        syncMaskLabel: (mask) => {
            hooks.labels.syncMaskLabel(mask);
        },
        hideAllMaskLabels: () => {
            hooks.labels.hideAllMaskLabels();
        },
        handleSelectionChanged: (selected) => {
            hooks.selection.handleSelectionChanged(selected);
        },
        updateSelectedAnnotation: (config) => {
            hooks.config.updateSelectedAnnotation(config);
        },
        setTextColor: (color) => {
            hooks.config.setTextColor(color);
        },
        setTextFontSize: (size) => {
            hooks.config.setTextFontSize(size);
        },
        setDrawColor: (color) => {
            hooks.config.setDrawColor(color);
        },
        setDrawBrushSize: (size) => {
            hooks.config.setDrawBrushSize(size);
        },
        emitImageCleared: (image, context) => {
            hooks.callbacks.emitImageCleared(image, context);
        },
        emitSelectionChange: (selection, context) => {
            hooks.callbacks.emitSelectionChange(selection, context);
        },
        emitMasksChanged: (context) => {
            hooks.callbacks.emitMasksChanged(context);
        },
        emitAnnotationsChanged: (context) => {
            hooks.callbacks.emitAnnotationsChanged(context);
        },
        emitImageChanged: (context) => {
            hooks.callbacks.emitImageChanged(context);
        },
        emitBusyChangeIfChanged: (context) => {
            hooks.callbacks.emitBusyChangeIfChanged(context);
        },
        reportWarning: (error, message) => {
            hooks.callbacks.reportWarning(error, message);
        },
        withAnimationQueueBypass: () => hooks.operations.withAnimationQueueBypass(),
    };
}

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
        var _a;
        if (this.currentOperationToken !== null) {
            throw new IdleGuardError(operationName, `while ${(_a = this.currentOperationName) !== null && _a !== void 0 ? _a : 'another operation'} is running`);
        }
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
            throw new IdleGuardError(operationLabel, 'while an animation is in progress');
        }
    }
    assertIdleForOperation(operationLabel, token) {
        var _a;
        if (this.isDisposedFlag) {
            throw new IdleGuardError(operationLabel, 'after dispose');
        }
        const ownOperation = this.isOwnOperation(token);
        if (this.isAnimationActive) {
            throw new IdleGuardError(operationLabel, 'while an animation is in progress');
        }
        if (this.isLoadingActive && !ownOperation) {
            throw new IdleGuardError(operationLabel, 'while an image is loading');
        }
        if (this.currentOperationToken && !ownOperation) {
            throw new IdleGuardError(operationLabel, `while ${(_a = this.currentOperationName) !== null && _a !== void 0 ? _a : 'another operation'} is running`);
        }
    }
    assertCanQueueAnimation(operationLabel, token) {
        var _a;
        if (this.isDisposedFlag) {
            throw new IdleGuardError(operationLabel, 'after dispose');
        }
        const ownOperation = this.isOwnOperation(token);
        if (this.isLoadingActive && !ownOperation) {
            throw new IdleGuardError(operationLabel, 'while an image is loading');
        }
        if (this.currentOperationToken && !ownOperation) {
            throw new IdleGuardError(operationLabel, `while ${(_a = this.currentOperationName) !== null && _a !== void 0 ? _a : 'another operation'} is running`);
        }
    }
}

class EditorRuntime {
    constructor(fabricModule, isFabricLoaded, options) {
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
            value: void 0
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
        Object.defineProperty(this, "defaultEraserConfig", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "currentEraserConfig", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "defaultShapeConfig", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "currentShapeConfig", {
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
        Object.defineProperty(this, "currentImageFilterConfig", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "lastCommittedImageFilterConfig", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
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
            value: new OperationGuard()
        });
        Object.defineProperty(this, "animQueue", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new AnimationQueue()
        });
        Object.defineProperty(this, "transformController", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
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
        Object.defineProperty(this, "shapeSession", {
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
        Object.defineProperty(this, "shouldSuppressSelectionChange", {
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
        Object.defineProperty(this, "lastEmittedToolMode", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "lastEmittedHistoryState", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
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
        this.fabricModule = fabricModule;
        this.isFabricLoaded = isFabricLoaded;
        this.options = options;
        this.currentLayoutMode = options.layoutMode;
        this.defaultMosaicConfig = options.defaultMosaicConfig;
        this.currentMosaicConfig = cloneResolvedMosaicConfig(this.defaultMosaicConfig);
        this.defaultTextConfig = options.defaultTextConfig;
        this.currentTextConfig = cloneResolvedTextAnnotationConfig(this.defaultTextConfig);
        this.defaultDrawConfig = options.defaultDrawConfig;
        this.currentDrawConfig = cloneResolvedDrawConfig(this.defaultDrawConfig);
        this.defaultEraserConfig = options.defaultEraserConfig;
        this.currentEraserConfig = cloneResolvedEraserConfig(this.defaultEraserConfig);
        this.defaultShapeConfig = options.defaultShapeConfig;
        this.currentShapeConfig = cloneResolvedShapeAnnotationConfig(this.defaultShapeConfig);
        this.currentImageFilterConfig = cloneResolvedImageFilterConfig(DEFAULT_IMAGE_FILTER_CONFIG);
        this.lastCommittedImageFilterConfig = cloneResolvedImageFilterConfig(DEFAULT_IMAGE_FILTER_CONFIG);
        this.historyManager = new HistoryManager(options.maxHistorySize);
        this.lastEmittedHistoryState = {
            canUndo: this.historyManager.canUndo(),
            canRedo: this.historyManager.canRedo(),
        };
    }
    getRuntimeOptions() {
        if (this.currentLayoutMode === this.options.layoutMode)
            return this.options;
        return Object.freeze({
            ...this.options,
            layoutMode: this.currentLayoutMode,
        });
    }
    getLiveCanvasOrThrow(operationName) {
        if (this.isDisposed || !this.canvas) {
            throw new Error(`[ImageEditor] Cannot run "${operationName}" after dispose.`);
        }
        return this.canvas;
    }
    isImageLoaded() {
        var _a, _b;
        const FabricImageCtor = this.fabricModule.FabricImage;
        return !!(this.originalImage &&
            typeof FabricImageCtor === 'function' &&
            this.originalImage instanceof FabricImageCtor &&
            ((_a = this.originalImage.width) !== null && _a !== void 0 ? _a : 0) > 0 &&
            ((_b = this.originalImage.height) !== null && _b !== void 0 ? _b : 0) > 0);
    }
    isBusy(isToolModeActive = false) {
        return this.operationGuard.isBusy() || this.animQueue.isBusy() || isToolModeActive;
    }
    resetAfterDispose() {
        this.canvas = null;
        this.canvasElement = null;
        this.containerElement = null;
        this.placeholderElement = null;
        this.elements = {};
        this.elementOriginalDisabledMap.clear();
        this.elementOriginalAriaDisabledMap.clear();
        this.elementOriginalPointerEventsMap.clear();
        this.isImageLoadedToCanvas = false;
        this.originalImage = null;
        this.currentImageMimeType = null;
        this.currentImageFilterConfig = cloneResolvedImageFilterConfig(DEFAULT_IMAGE_FILTER_CONFIG);
        this.lastCommittedImageFilterConfig = cloneResolvedImageFilterConfig(DEFAULT_IMAGE_FILTER_CONFIG);
        this.lastMask = null;
        this.maskCounter = 0;
        this.annotationCounter = 0;
        this.currentScale = 1;
        this.currentRotation = 0;
        this.baseImageScale = 1;
        this.lastSnapshot = null;
        this.historyManager.clear();
        this.transformController = null;
        this.cropSession = null;
        this.mosaicSession = null;
        this.textSession = null;
        this.drawSession = null;
        this.shapeSession = null;
        this.domBindings = null;
        this.keyboardDocument = null;
        this.keyboardHandler = null;
        this.currentMosaicConfig = cloneResolvedMosaicConfig(this.defaultMosaicConfig);
        this.currentTextConfig = cloneResolvedTextAnnotationConfig(this.defaultTextConfig);
        this.currentDrawConfig = cloneResolvedDrawConfig(this.defaultDrawConfig);
        this.currentEraserConfig = cloneResolvedEraserConfig(this.defaultEraserConfig);
        this.currentShapeConfig = cloneResolvedShapeAnnotationConfig(this.defaultShapeConfig);
        this.shouldSuppressSaveState = false;
        this.shouldSuppressSelectionChange = false;
        this.lastEmittedIsBusy = null;
        this.lastEmittedToolMode = null;
        this.lastEmittedHistoryState = { canUndo: false, canRedo: false };
        this.activeStateRestoreOperation = null;
        this.nextSelectionChangeContext = null;
        this.viewportCache.clear();
    }
}

function handleSelectionChanged(access, selected) {
    var _a, _b, _c;
    const canvas = access.getCanvas();
    if (!canvas)
        return;
    const selectedMask = (_a = selected.find(isMaskObject)) !== null && _a !== void 0 ? _a : null;
    const selectedAnnotation = (_b = selected.find(isAnnotationObject)) !== null && _b !== void 0 ? _b : null;
    const masks = canvas.getObjects().filter(isMaskObject);
    masks.forEach((maskObject) => {
        if (maskObject !== selectedMask) {
            if (maskObject.labelObject) {
                access.removeLabelForMask(maskObject);
            }
            applyMaskUnselectedStyle(maskObject);
        }
        else {
            applyMaskSelectedStyle(maskObject);
        }
    });
    if (selectedMask)
        access.showLabelForMask(selectedMask);
    access.updateMaskListSelection(selectedMask);
    access.updateAnnotationListSelection(selectedAnnotation);
    canvas.requestRenderAll();
    access.updateUi();
    if (access.shouldSuppressSelectionChange())
        return;
    const activeStateRestoreOperation = access.getActiveStateRestoreOperation();
    const context = (_c = access.getNextSelectionChangeContext()) !== null && _c !== void 0 ? _c : access.buildCallbackContext(activeStateRestoreOperation !== null && activeStateRestoreOperation !== void 0 ? activeStateRestoreOperation : 'createMask', activeStateRestoreOperation === 'undo' || activeStateRestoreOperation === 'redo');
    access.emitSelectionChange(access.buildSelection(selected), context);
}
function handleObjectMovingScalingRotating(access, target) {
    if (isMaskObject(target)) {
        access.syncMaskLabel(target);
    }
}
function handleObjectModified(access, target) {
    if (isMaskObject(target)) {
        access.syncMaskLabel(target);
        const context = access.buildCallbackContext('saveState', false);
        access.saveState();
        access.emitMasksChanged(context);
        access.emitImageChanged(context);
        return;
    }
    if (isAnnotationObject(target)) {
        if (isAnnotationLocked(target))
            return;
        if (isTextAnnotationObject(target)) {
            const textTarget = target;
            if (textTarget.imageEditorTextEditingHandledChange === true) {
                delete textTarget.imageEditorTextEditingHandledChange;
                return;
            }
        }
        const context = access.buildCallbackContext('updateAnnotation', false);
        access.saveState();
        access.emitAnnotationsChanged(context);
        access.emitImageChanged(context);
    }
}

function getSelectedCanvasObjects(canvas) {
    var _a, _b, _c;
    const activeObject = canvas.getActiveObject();
    if (!activeObject)
        return [];
    const type = typeof activeObject.type === 'string' ? activeObject.type.toLowerCase() : '';
    const isActiveSelection = type === 'activeselection' ||
        ((_c = (_b = (_a = activeObject).isType) === null || _b === void 0 ? void 0 : _b.call(_a, 'ActiveSelection')) !== null && _c !== void 0 ? _c : false);
    if (!isActiveSelection)
        return [activeObject];
    const getObjects = activeObject.getObjects;
    return typeof getObjects === 'function' ? getObjects.call(activeObject) : [];
}
function removeSelectedAnnotationAction(access, context) {
    const before = access.getAnnotations().length;
    access.withSelectionChangeContext(context, () => {
        removeSelectedAnnotation(access.buildAnnotationManagerContext());
    });
    access.updateAnnotationList();
    access.updateUi();
    if (access.getAnnotations().length !== before) {
        access.emitAnnotationsChanged(context);
        access.emitImageChanged(context);
    }
}
function removeAllAnnotationsAction(access, options, context) {
    const before = access.getAnnotations().length;
    access.withSelectionChangeContext(context, () => {
        removeAllAnnotations(access.buildAnnotationManagerContext(), options);
    });
    access.updateAnnotationList();
    access.updateUi();
    if (access.getAnnotations().length !== before) {
        access.emitAnnotationsChanged(context);
        access.emitImageChanged(context);
    }
}
function updateAnnotationAction(access, annotationId, config, context) {
    const changed = updateAnnotation(access.buildAnnotationManagerContext(), annotationId, config);
    if (changed) {
        access.updateAnnotationList();
        access.emitAnnotationsChanged(context);
        access.emitImageChanged(context);
    }
}
function updateSelectedAnnotationAction(access, config, context) {
    const changed = updateSelectedAnnotation(access.buildAnnotationManagerContext(), config);
    if (changed) {
        access.updateAnnotationList();
        access.emitAnnotationsChanged(context);
        access.emitImageChanged(context);
    }
}
function deleteSelectedEditableObjects(access, context) {
    const canvas = access.getCanvas();
    if (!canvas)
        return;
    const selectedObjects = getSelectedCanvasObjects(canvas);
    const selectedMasks = selectedObjects.filter(isMaskObject);
    const selectedAnnotations = selectedObjects.filter((object) => isAnnotationObject(object) && isAnnotationUnlocked(object));
    if (selectedMasks.length === 0 && selectedAnnotations.length === 0)
        return;
    const liveCanvas = access.getLiveCanvas('deleteSelectedObject');
    access.withSelectionChangeContext(context, () => {
        for (const mask of selectedMasks) {
            access.removeLabelForMask(mask);
            liveCanvas.remove(mask);
        }
        removeAnnotationObjects(access.buildAnnotationManagerContext(), selectedAnnotations, {
            saveHistory: false,
            force: true,
        });
        liveCanvas.discardActiveObject();
        liveCanvas.renderAll();
        access.saveState();
    });
    access.updateMaskList();
    access.updateAnnotationList();
    access.updateUi();
    if (selectedMasks.length > 0)
        access.emitMasksChanged(context);
    if (selectedAnnotations.length > 0)
        access.emitAnnotationsChanged(context);
    access.emitImageChanged(context);
}
function moveSelectedEditableObject(access, operation) {
    const canvas = access.getCanvas();
    if (!canvas)
        return;
    const selected = getSelectedCanvasObjects(canvas).filter(isEditableOverlayObject);
    if (selected.length !== 1) {
        if (selected.length > 1) {
            access.reportWarning(`${operation} skipped: ActiveSelection layer moves are not supported.`);
        }
        return;
    }
    const object = selected[0];
    const range = getEditableOverlayRange(canvas);
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
        (_b = (_a = canvas).moveObjectTo) === null || _b === void 0 ? void 0 : _b.call(_a, overlay, range.start + index);
    });
    normalizeLayerOrder(canvas);
    canvas.setActiveObject(object);
    canvas.renderAll();
    access.saveState();
    access.updateMaskList();
    access.updateAnnotationList();
    if (isMaskObject(object)) {
        access.updateMaskListSelection(object);
    }
    else if (isAnnotationObject(object)) {
        access.updateAnnotationListSelection(object);
    }
    access.updateUi();
    const context = access.buildCallbackContext(operation, false);
    if (isMaskObject(object))
        access.emitMasksChanged(context);
    if (isAnnotationObject(object))
        access.emitAnnotationsChanged(context);
    access.emitImageChanged(context);
}

function createMaskAction(access, config = {}) {
    if (!access.getCanvas())
        return null;
    if (!access.canRunIdleOperation('createMask'))
        return null;
    const callbackContext = access.buildCallbackContext('createMask', false);
    const mask = access.withSelectionChangeContext(callbackContext, () => createMask(access.buildCreateMaskContext(), config));
    if (mask) {
        access.emitMasksChanged(callbackContext);
        access.emitImageChanged(callbackContext);
    }
    return mask;
}
function removeSelectedMaskAction(access) {
    if (!access.getCanvas())
        return;
    if (!access.canRunIdleOperation('removeSelectedMask'))
        return;
    const before = access.getMasks().length;
    const callbackContext = access.buildCallbackContext('removeSelectedMask', false);
    access.withSelectionChangeContext(callbackContext, () => removeSelectedMask(access.buildRemoveMaskContext()));
    access.updateUi();
    if (access.getMasks().length !== before) {
        access.emitMasksChanged(callbackContext);
        access.emitImageChanged(callbackContext);
    }
}
function removeAllMasksAction(access, options = {}) {
    if (!access.getCanvas())
        return;
    if (!access.canRunIdleOperation('removeAllMasks', options))
        return;
    const before = access.getMasks().length;
    const callbackContext = access.buildCallbackContext('removeAllMasks', false);
    access.withSelectionChangeContext(callbackContext, () => removeAllMasks(access.buildRemoveMaskContext(), options));
    access.updateUi();
    if (access.getMasks().length !== before) {
        access.emitMasksChanged(callbackContext);
        access.emitImageChanged(callbackContext);
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
        const indexForGetText = Math.max(0, mask.maskId - 1);
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

function getCurrentMaskListCanvas(context) {
    var _a, _b;
    return (_b = (_a = context.getCanvas) === null || _a === void 0 ? void 0 : _a.call(context)) !== null && _b !== void 0 ? _b : context.canvas;
}
function orderMasksForList(masks, order) {
    const ordered = masks.slice();
    return order === 'back-to-front' ? ordered : ordered.reverse();
}
function renderMaskList(context) {
    const listEl = context.getListElement();
    const canvas = getCurrentMaskListCanvas(context);
    if (!listEl || !canvas)
        return;
    const ownerDocument = listEl.ownerDocument;
    listEl.innerHTML = '';
    orderMasksForList(canvas.getObjects().filter(isMaskObject), context.listOrder).forEach((mask) => {
        const listItemElement = ownerDocument.createElement('li');
        listItemElement.className = 'list-group-item mask-item';
        listItemElement.textContent = mask.maskName;
        listItemElement.dataset.maskId = String(mask.maskId);
        listItemElement.addEventListener('click', () => {
            const id = Number(listItemElement.dataset.maskId);
            if (!Number.isFinite(id))
                return;
            const liveCanvas = getCurrentMaskListCanvas(context);
            if (!liveCanvas)
                return;
            const target = liveCanvas
                .getObjects()
                .find((o) => isMaskObject(o) && o.maskId === id);
            if (!target)
                return;
            liveCanvas.setActiveObject(target);
            context.onMaskSelected(target);
        });
        listEl.appendChild(listItemElement);
    });
}
function updateMaskListSelection(context, selectedMask) {
    const listEl = context.getListElement();
    if (!listEl)
        return;
    const selectedId = selectedMask ? String(selectedMask.maskId) : null;
    listEl.querySelectorAll('.mask-item').forEach((item) => {
        const isSelected = selectedId !== null && item.dataset.maskId === selectedId;
        item.classList.toggle('active', isSelected);
    });
}

function safelyRemoveKeyboardListener(keyboardDocument, keyboardHandler) {
    if (!keyboardDocument || !keyboardHandler)
        return;
    try {
        keyboardDocument.removeEventListener('keydown', keyboardHandler);
    }
    catch {
    }
}
function safelyDisposeCanvas(canvas) {
    if (!canvas)
        return Promise.resolve();
    try {
        return Promise.resolve(canvas.dispose())
            .then(() => undefined)
            .catch(() => {
        });
    }
    catch {
        return Promise.resolve();
    }
}
function safelyExitActiveSession(hasSession, canvas, exitSession, clearSession) {
    if (!hasSession || !canvas)
        return;
    try {
        exitSession();
    }
    catch {
    }
    clearSession();
}

class DomBindings {
    constructor(resolveElement, isDisposed) {
        Object.defineProperty(this, "registry", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "resolveElement", {
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
        this.resolveElement = resolveElement;
        this.isDisposed = isDisposed;
    }
    bindIfExists(key, eventType, handler) {
        const element = this.resolveElement(key);
        if (!element)
            return false;
        const wrapped = (event) => {
            if (this.isDisposed())
                return;
            handler(event);
        };
        element.addEventListener(eventType, wrapped);
        this.registry.push({ elementKey: key, element, eventType, handler: wrapped });
        return true;
    }
    removeAll() {
        for (const entry of this.registry) {
            try {
                entry.element.removeEventListener(entry.eventType, entry.handler);
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
    if (snapshot.isDisposed) {
        CROP_MODE_CONTROL_KEYS.forEach((key) => {
            setEnabled(key, false);
        });
        return;
    }
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

function buildEditorControlSnapshot(runtime) {
    var _a, _b, _c;
    if (!runtime.canvas)
        return null;
    const hasImage = !!runtime.originalImage;
    const masks = hasImage ? runtime.canvas.getObjects().filter(isMaskObject) : [];
    const annotations = hasImage ? runtime.canvas.getObjects().filter(isAnnotationObject) : [];
    const activeObject = runtime.canvas.getActiveObject();
    return {
        hasImage,
        hasMasks: masks.length > 0,
        hasAnnotations: annotations.length > 0,
        hasSelectedMask: !!(activeObject && isMaskObject(activeObject)),
        hasSelectedAnnotation: !!(activeObject && isAnnotationObject(activeObject)),
        hasSelectedEditableObject: !!activeObject && isEditableOverlayObject(activeObject),
        isDefaultTransform: runtime.currentScale === 1 &&
            runtime.currentRotation === 0 &&
            !((_a = runtime.originalImage) === null || _a === void 0 ? void 0 : _a.flipX) &&
            !((_b = runtime.originalImage) === null || _b === void 0 ? void 0 : _b.flipY),
        currentScale: runtime.currentScale,
        minScale: runtime.options.minScale,
        maxScale: runtime.options.maxScale,
        canUndo: runtime.historyManager.canUndo(),
        canRedo: runtime.historyManager.canRedo(),
        isBusy: runtime.operationGuard.isBusy() || runtime.animQueue.isBusy(),
        isDisposed: runtime.isDisposed,
        isInCropMode: runtime.cropSession !== null,
        isInMosaicMode: runtime.mosaicSession !== null,
        isInTextMode: runtime.textSession !== null,
        isInDrawMode: runtime.drawSession !== null,
        isMosaicApplying: ((_c = runtime.mosaicSession) === null || _c === void 0 ? void 0 : _c.isApplying) === true,
    };
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
function handleAsyncAction(context, operation, action) {
    try {
        void Promise.resolve(action()).catch((error) => {
            context.actions.reportAsyncActionError(operation, error);
        });
    }
    catch (error) {
        context.actions.reportAsyncActionError(operation, error);
    }
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
        if (file) {
            handleAsyncAction(context, 'loadImageFile', () => context.actions.loadImageFile(file));
        }
    });
}
function bindTransformEvents(context) {
    bindElement(context, 'zoomInButton', 'click', () => {
        handleAsyncAction(context, 'zoomIn', () => context.actions.zoomIn());
    });
    bindElement(context, 'zoomOutButton', 'click', () => {
        handleAsyncAction(context, 'zoomOut', () => context.actions.zoomOut());
    });
    bindElement(context, 'resetImageTransformButton', 'click', () => {
        handleAsyncAction(context, 'resetImageTransform', () => context.actions.resetImageTransform());
    });
    bindElement(context, 'flipHorizontalButton', 'click', () => {
        handleAsyncAction(context, 'flipHorizontal', () => context.actions.flipHorizontal());
    });
    bindElement(context, 'flipVerticalButton', 'click', () => {
        handleAsyncAction(context, 'flipVertical', () => context.actions.flipVertical());
    });
    bindElement(context, 'rotateLeftButton', 'click', () => {
        const parsedStep = parseInputNumber(context, 'rotateLeftDegreesInput');
        const step = Number.isNaN(parsedStep) ? context.rotationStep : parsedStep;
        handleAsyncAction(context, 'rotateLeft', () => context.actions.rotateLeft(step));
    });
    bindElement(context, 'rotateRightButton', 'click', () => {
        const parsedStep = parseInputNumber(context, 'rotateRightDegreesInput');
        const step = Number.isNaN(parsedStep) ? context.rotationStep : parsedStep;
        handleAsyncAction(context, 'rotateRight', () => context.actions.rotateRight(step));
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
        handleAsyncAction(context, 'mergeMasks', () => context.actions.mergeMasks());
    });
}
function bindAnnotationEvents(context) {
    bindElement(context, 'mergeAnnotationsButton', 'click', () => {
        handleAsyncAction(context, 'mergeAnnotations', () => context.actions.mergeAnnotations());
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
        handleAsyncAction(context, 'downloadImage', () => context.actions.downloadImage());
    });
    bindElement(context, 'undoButton', 'click', () => {
        handleAsyncAction(context, 'undo', () => context.actions.undo());
    });
    bindElement(context, 'redoButton', 'click', () => {
        handleAsyncAction(context, 'redo', () => context.actions.redo());
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
    let lastAppliedValue = null;
    const handler = (event) => {
        const value = getEventInputValue(event);
        if (value === lastAppliedValue)
            return;
        lastAppliedValue = value;
        applyValue(value);
    };
    bindElement(context, key, 'input', handler);
    bindElement(context, key, 'change', handler);
}
function bindNumberInput(context, key, applyValue) {
    let lastAppliedValue = null;
    const handler = (event) => {
        const value = parseEventInputNumber(event);
        if (lastAppliedValue !== null && Object.is(value, lastAppliedValue))
            return;
        lastAppliedValue = value;
        applyValue(value);
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

function normalizeStepScale(value) {
    const rounded = Math.round(value * 1000000) / 1000000;
    return Number.isFinite(rounded) ? rounded : 1;
}
function createEditorDomEventActions(runtime, ownerDocument, host) {
    return {
        reportAsyncActionError: (operation, error) => {
            host.reportAsyncActionError(operation, error);
        },
        openImagePicker: () => {
            var _a;
            (_a = resolveDomElement(runtime.elements.imageInput, ownerDocument, isInputElement)) === null || _a === void 0 ? void 0 : _a.click();
        },
        loadImageFile: (file) => host.loadImageFile(file),
        zoomIn: () => host.scaleImage(normalizeStepScale(runtime.currentScale + runtime.options.scaleStep)),
        zoomOut: () => host.scaleImage(normalizeStepScale(runtime.currentScale - runtime.options.scaleStep)),
        resetImageTransform: () => host.resetImageTransform(),
        flipHorizontal: () => host.flipHorizontal(),
        flipVertical: () => host.flipVertical(),
        rotateLeft: (degrees) => host.rotateImage(runtime.currentRotation - degrees),
        rotateRight: (degrees) => host.rotateImage(runtime.currentRotation + degrees),
        createMask: () => {
            host.createMask();
        },
        removeSelectedMask: () => {
            host.removeSelectedMask();
        },
        removeAllMasks: () => {
            host.removeAllMasks();
        },
        mergeMasks: () => host.mergeMasks(),
        mergeAnnotations: () => host.mergeAnnotations(),
        enterTextMode: () => {
            host.enterTextMode();
        },
        exitTextMode: () => {
            host.exitTextMode();
        },
        enterDrawMode: () => {
            host.enterDrawMode();
        },
        exitDrawMode: () => {
            host.exitDrawMode();
        },
        removeSelectedAnnotation: () => {
            host.removeSelectedAnnotation();
        },
        removeAllAnnotations: () => {
            host.removeAllAnnotations();
        },
        deleteSelectedObject: () => {
            host.deleteSelectedObject();
        },
        bringSelectedObjectForward: () => {
            host.bringSelectedObjectForward();
        },
        sendSelectedObjectBackward: () => {
            host.sendSelectedObjectBackward();
        },
        bringSelectedObjectToFront: () => {
            host.bringSelectedObjectToFront();
        },
        sendSelectedObjectToBack: () => {
            host.sendSelectedObjectToBack();
        },
        downloadImage: () => host.downloadImage(),
        undo: () => host.undo(),
        redo: () => host.redo(),
        enterCropMode: () => {
            host.enterCropMode({ aspectRatio: getSelectedCropAspectRatio(runtime, ownerDocument) });
        },
        updateSelectedCropAspectRatio: () => {
            if (runtime.cropSession) {
                host.setCropAspectRatio(getSelectedCropAspectRatio(runtime, ownerDocument));
            }
        },
        applyCrop: () => host.applyCrop(),
        reportCropApplyError: (error) => {
            host.reportCropApplyError(error);
        },
        cancelCrop: () => {
            host.cancelCrop();
        },
        enterMosaicMode: () => {
            host.enterMosaicMode();
        },
        exitMosaicMode: () => {
            host.exitMosaicMode();
        },
        setMosaicBrushSize: (size) => {
            host.setMosaicBrushSize(size);
        },
        setMosaicBlockSize: (size) => {
            host.setMosaicBlockSize(size);
        },
        setTextColor: (color) => {
            host.setTextColor(color);
        },
        setTextFontSize: (size) => {
            host.setTextFontSize(size);
        },
        setDrawColor: (color) => {
            host.setDrawColor(color);
        },
        setDrawBrushSize: (size) => {
            host.setDrawBrushSize(size);
        },
    };
}
function getSelectedCropAspectRatio(runtime, ownerDocument) {
    const inputEl = resolveDomElement(runtime.elements.cropAspectRatioSelect, ownerDocument, isInputOrSelectElement);
    const value = inputEl && 'value' in inputEl ? String(inputEl.value).trim() : '';
    return (value || 'free');
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

function bindEditorKeyboardEvents(access) {
    const ownerDocument = access.getOwnerDocument();
    const keyboardDocument = access.getKeyboardDocument();
    const keyboardHandler = access.getKeyboardHandler();
    if (keyboardHandler && keyboardDocument) {
        access.removeKeyboardListener(keyboardDocument, keyboardHandler);
    }
    const handler = (event) => {
        access.handleKeyboardEvent(event);
    };
    access.setKeyboardBinding(ownerDocument, handler);
    ownerDocument.addEventListener('keydown', handler);
}
function isNativeEditableElement(element) {
    var _a;
    if (!element)
        return false;
    const activeElement = element;
    const tagName = String((_a = activeElement.tagName) !== null && _a !== void 0 ? _a : '').toLowerCase();
    return (tagName === 'input' ||
        tagName === 'textarea' ||
        tagName === 'select' ||
        activeElement.isContentEditable === true);
}
function getDeepActiveElement(root) {
    var _a, _b;
    let activeElement = (_a = root === null || root === void 0 ? void 0 : root.activeElement) !== null && _a !== void 0 ? _a : null;
    while ((_b = activeElement === null || activeElement === void 0 ? void 0 : activeElement.shadowRoot) === null || _b === void 0 ? void 0 : _b.activeElement) {
        activeElement = activeElement.shadowRoot.activeElement;
    }
    return activeElement;
}
function isNativeTextInputActive(keyboardDocument, event) {
    const composedPath = typeof (event === null || event === void 0 ? void 0 : event.composedPath) === 'function' ? event.composedPath() : undefined;
    if (composedPath === null || composedPath === void 0 ? void 0 : composedPath.some(isNativeEditableElement))
        return true;
    return isNativeEditableElement(getDeepActiveElement(keyboardDocument));
}
function isFabricTextEditingActive(canvas) {
    const activeObject = canvas === null || canvas === void 0 ? void 0 : canvas.getActiveObject();
    return !!(activeObject &&
        isTextAnnotationObject(activeObject) &&
        activeObject.isEditing === true);
}
function handleEditorKeyboardEvent(access, event) {
    if (access.isDisposed())
        return;
    const canvas = access.getCanvas();
    if (event.key === 'Delete' || event.key === 'Backspace') {
        if (isNativeTextInputActive(access.getKeyboardDocument(), event) ||
            isFabricTextEditingActive(canvas)) {
            return;
        }
        event.preventDefault();
        access.deleteSelectedObject();
        return;
    }
    if (event.key !== 'Escape')
        return;
    if (isFabricTextEditingActive(canvas) && canvas) {
        access.finalizeActiveTextEditing(false);
        event.preventDefault();
        return;
    }
    if (access.hasTextSession()) {
        event.preventDefault();
        access.exitTextMode();
    }
    else if (access.hasDrawSession()) {
        event.preventDefault();
        access.exitDrawMode();
    }
    else if (access.hasMosaicSession()) {
        event.preventDefault();
        access.exitMosaicMode();
    }
    else if (access.hasCropSession()) {
        event.preventDefault();
        access.cancelCrop();
    }
}

const CROP_SESSION_ALLOWED_OPERATIONS = new Set([
    'setCropAspectRatio',
    'applyCrop',
    'cancelCrop',
    'saveState',
]);
const MOSAIC_SESSION_ALLOWED_OPERATIONS = new Set([
    'exitMosaicMode',
    'applyMosaic',
    'setMosaicConfig',
    'resetMosaicConfig',
    'setMosaicBrushSize',
    'setMosaicBlockSize',
    'saveState',
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
        'setDrawSubMode',
        'setEraserConfig',
        'resetEraserConfig',
        'commitEraserStroke',
        'saveState',
    ]),
    shape: new Set([
        'enterShapeMode',
        'exitShapeMode',
        'createShapeAnnotation',
        'setShapeConfig',
        'resetShapeConfig',
        'saveState',
    ]),
};
const IMAGE_EDITOR_OPERATIONS = new Set([
    'init',
    'loadImage',
    'loadFromState',
    'saveState',
    'setCanvasSize',
    'resizeToContainer',
    'relayout',
    'scaleImage',
    'rotateImage',
    'flipHorizontal',
    'flipVertical',
    'resetImageTransform',
    'setImageFilterConfig',
    'resetImageFilterConfig',
    'clearImageFilters',
    'commitImageFilters',
    'createMask',
    'removeSelectedMask',
    'removeAllMasks',
    'mergeMasks',
    'createTextAnnotation',
    'createShapeAnnotation',
    'enterTextMode',
    'exitTextMode',
    'enterShapeMode',
    'exitShapeMode',
    'setShapeConfig',
    'resetShapeConfig',
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
    'setDrawSubMode',
    'setEraserConfig',
    'resetEraserConfig',
    'commitEraserStroke',
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
function getActiveToolMode(snapshot) {
    if (snapshot.hasCropSession)
        return 'crop';
    if (snapshot.hasMosaicSession)
        return 'mosaic';
    if (snapshot.hasTextSession)
        return 'text';
    if (snapshot.hasDrawSession)
        return 'draw';
    if (snapshot.hasShapeSession)
        return 'shape';
    return null;
}
function isToolModeActive(snapshot) {
    return getActiveToolMode(snapshot) !== null;
}
function getAllowedOperationsForToolMode(mode) {
    return TOOL_MODE_ALLOWED_OPERATIONS[mode];
}
function canRunOperationInToolMode(activeMode, operationName) {
    return !activeMode || getAllowedOperationsForToolMode(activeMode).has(operationName);
}
function isImageEditorOperation(value) {
    return value !== null && IMAGE_EDITOR_OPERATIONS.has(value);
}

const INTERNAL_OPERATION_TOKEN = Symbol('ImageEditorInternalOperation');
const INTERNAL_ALLOW_DURING_ANIMATION_QUEUE = Symbol('ImageEditorAllowDuringAnimationQueue');
function getRuntimeDocument(canvasElement) {
    var _a;
    return (_a = canvasElement === null || canvasElement === void 0 ? void 0 : canvasElement.ownerDocument) !== null && _a !== void 0 ? _a : (typeof document !== 'undefined' ? document : null);
}
function describeElementTarget(target) {
    if (typeof target === 'string')
        return `"${target}"`;
    if (target === null)
        return 'null';
    if (target === undefined)
        return 'undefined';
    return 'provided element';
}
function captureContainerScroll(container) {
    return container ? { left: container.scrollLeft, top: container.scrollTop } : null;
}
function restoreContainerScroll(container, scroll, options) {
    if (!container || !scroll)
        return;
    try {
        container.scrollLeft = scroll.left;
        container.scrollTop = scroll.top;
    }
    catch (error) {
        reportWarning(options, error, 'Scroll restore failed.');
    }
}
function isPositiveFiniteDimension(value) {
    return Number.isFinite(value) && value > 0;
}
class ImageEditor {
    constructor(fabricModuleOrOptions = {}, options = {}) {
        var _a;
        Object.defineProperty(this, "runtime", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "contextFactory", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "actionAccessFactory", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        const detected = detectFabric(fabricModuleOrOptions, options);
        const resolvedOptions = resolveOptions(detected.options);
        this.runtime = new EditorRuntime((_a = detected.fabric) !== null && _a !== void 0 ? _a : {}, detected.isFabricLoaded, resolvedOptions);
        const rawDefaultLayoutMode = detected.options
            .defaultLayoutMode;
        if (rawDefaultLayoutMode !== undefined && !isLayoutMode(rawDefaultLayoutMode)) {
            reportWarning(this.runtime.options, new TypeError(`[ImageEditor] Unsupported defaultLayoutMode ` +
                `${JSON.stringify(rawDefaultLayoutMode)}. ` +
                'Expected "fit", "cover", or "expand".'), 'Invalid defaultLayoutMode fell back to "expand".');
        }
        const rawDefaultMaskConfig = detected.options
            .defaultMaskConfig;
        if (rawDefaultMaskConfig &&
            typeof rawDefaultMaskConfig === 'object' &&
            !Array.isArray(rawDefaultMaskConfig) &&
            ('onCreate' in rawDefaultMaskConfig || 'fabricGenerator' in rawDefaultMaskConfig)) {
            reportWarning(this.runtime.options, new TypeError('[ImageEditor] defaultMaskConfig does not support onCreate or fabricGenerator. Pass those fields to createMask() instead.'), 'Ignored unsupported defaultMaskConfig lifecycle/factory fields.');
        }
        const wiring = this.createRuntimeWiring();
        this.contextFactory = wiring.contextFactory;
        this.actionAccessFactory = wiring.actionAccessFactory;
    }
    createRuntimeWiring() {
        return createEditorRuntimeWiring(this.runtime, {
            operations: {
                canRunIdleOperation: (operation, options) => this.canRunIdleOperation(operation, options),
                assertIdleForOperation: (operation, options) => {
                    this.assertIdleForOperation(operation, options);
                },
                assertCanQueueAnimation: (operation) => {
                    this.assertCanQueueAnimation(operation);
                },
                finalizeActiveTextEditingIfNeeded: () => {
                    this.finalizeActiveTextEditingIfNeeded();
                },
                withSelectionChangeContext: (context, callback) => this.withSelectionChangeContext(context, callback),
                withInternalOperationOptions: (token, options = {}) => this.withInternalOperationOptions(token, options),
                withAnimationQueueBypass: (options = {}) => this.withAnimationQueueBypass(options),
            },
            state: {
                saveCanvasState: (options) => {
                    this.saveStateInternal(options);
                },
                captureSnapshot: () => this.captureSnapshotInternal(),
                loadImage: (base64, options) => this.loadImageInternal(base64, options),
                loadFromState: (snapshot, options) => this.loadFromStateInternal(snapshot, options),
            },
            display: {
                inferCurrentImageMimeType: () => this.inferCurrentImageMimeType(),
                shouldNormalizeCanvasSizeAfterStateRestore: () => this.shouldNormalizeCanvasSizeAfterStateRestore(),
                updateCanvasSizeToImageBounds: (options) => this.updateCanvasSizeToImageBounds(options),
                alignObjectBoundingBoxToCanvasTopLeft: (object) => {
                    this.alignObjectBoundingBoxToCanvasTopLeft(object);
                },
                settleFitCoverScrollbarsAfterStateRestore: () => {
                    this.settleFitCoverScrollbarsAfterStateRestore();
                },
                setCanvasSize: (widthPx, heightPx) => {
                    this.setCanvasSizePx(widthPx, heightPx);
                },
                captureImageDisplayGeometry: () => this.captureImageDisplayGeometry(),
                restoreMergedImageDisplayGeometry: (geometry) => {
                    this.restoreMergedImageDisplayGeometry(geometry);
                },
            },
            selection: {
                buildSelection: (selected) => this.buildSelection(selected),
                handleSelectionChanged: (selected) => {
                    this.handleSelectionChanged(selected);
                },
                getMasks: () => this.getMasks(),
                getAnnotations: () => this.getAnnotations(),
                getMaskCollectionSignature: () => this.getMaskCollectionSignature(),
                getAnnotationCollectionSignature: () => this.getAnnotationCollectionSignature(),
            },
            ui: {
                refreshUiAfterQueuedAnimation: () => {
                    this.refreshUiAfterQueuedAnimation();
                },
                updateInputs: () => {
                    this.updateInputs();
                },
                updateMaskList: () => {
                    this.updateMaskList();
                },
                updateMaskListSelection: (mask) => {
                    this.updateMaskListSelection(mask);
                },
                updateAnnotationList: () => {
                    this.updateAnnotationList();
                },
                updateAnnotationListSelection: (annotation) => {
                    this.updateAnnotationListSelection(annotation);
                },
                updateUi: () => {
                    this.updateUi();
                },
            },
            labels: {
                removeLabelForMask: (mask) => {
                    this.removeLabelForMask(mask);
                },
                showLabelForMask: (mask) => {
                    this.showLabelForMask(mask);
                },
                syncMaskLabel: (mask) => {
                    this.syncMaskLabel(mask);
                },
                hideAllMaskLabels: () => {
                    this.hideAllMaskLabels();
                },
            },
            config: {
                updateSelectedAnnotation: (config) => {
                    this.updateSelectedAnnotation(config);
                },
                setTextColor: (color) => {
                    this.setTextColor(color);
                },
                setTextFontSize: (size) => {
                    this.setTextFontSize(size);
                },
                setDrawColor: (color) => {
                    this.setDrawColor(color);
                },
                setDrawBrushSize: (size) => {
                    this.setDrawBrushSize(size);
                },
            },
            callbacks: {
                buildCallbackContext: (operation, isInternalOperation) => this.buildCallbackContext(operation, isInternalOperation),
                emitImageCleared: (image, context) => {
                    this.emitOptionCallback('onImageCleared', [image, context]);
                },
                emitSelectionChange: (selection, context) => {
                    this.emitOptionCallback('onSelectionChange', [selection, context]);
                },
                emitMasksChanged: (context) => {
                    this.emitMasksChanged(context);
                },
                emitAnnotationsChanged: (context) => {
                    this.emitAnnotationsChanged(context);
                },
                emitImageChanged: (context) => {
                    this.emitImageChanged(context);
                },
                emitBusyChangeIfChanged: (context) => {
                    this.emitBusyChangeIfChanged(context);
                },
                reportWarning: (error, message) => {
                    reportWarning(this.runtime.options, error, message);
                },
            },
        });
    }
    init(elementMap = {}) {
        if (!this.runtime.isFabricLoaded) {
            const globalFabric = globalThis.fabric;
            if (!globalFabric ||
                typeof globalFabric.Canvas !== 'function') {
                reportWarning(this.runtime.options, null, '[ImageEditor] init() skipped: fabric.js is not loaded. Pass a Fabric module or load Fabric before init().');
                return;
            }
            this.runtime.fabricModule = globalFabric;
            this.runtime.isFabricLoaded = true;
        }
        if (this.runtime.isDisposed)
            return;
        if (this.runtime.canvas || this.runtime.domBindings || this.runtime.keyboardHandler) {
            reportWarning(this.runtime.options, null, '[ImageEditor] init() skipped: editor is already initialized. Call dispose() before reinitializing.');
            return;
        }
        this.runtime.elements = resolveElementTargets(elementMap);
        this.initCanvas();
        this.runtime.domBindings = new DomBindings((key) => this.resolveElement(key), () => this.runtime.isDisposed);
        this.runtime.transformController = new TransformController(this.buildTransformContext());
        this.bindDomEvents();
        this.updateInputs();
        this.updateMaskList();
        this.updateAnnotationList();
        this.updateUi();
        if (this.runtime.options.initialImageBase64) {
            void this.loadImage(this.runtime.options.initialImageBase64).catch(() => {
            });
        }
        else {
            this.updatePlaceholderStatus();
        }
    }
    initCanvas() {
        var _a;
        const canvasTarget = this.runtime.elements.canvas;
        const canvasCandidate = resolveDomElement(canvasTarget, getRuntimeDocument(null), isCanvasElement);
        if (!canvasCandidate) {
            throw new Error(`[ImageEditor] Canvas element not found: ${describeElementTarget(canvasTarget)}`);
        }
        const canvasElement = canvasCandidate;
        this.runtime.canvasElement = canvasElement;
        const ownerDocument = canvasElement.ownerDocument;
        this.runtime.containerElement =
            (_a = resolveDomElement(this.runtime.elements.canvasContainer, ownerDocument)) !== null && _a !== void 0 ? _a : canvasElement.parentElement;
        this.runtime.placeholderElement = resolveDomElement(this.runtime.elements.imagePlaceholder, ownerDocument);
        let initialWidth = this.runtime.options.canvasWidth;
        let initialHeight = this.runtime.options.canvasHeight;
        if (this.runtime.containerElement) {
            const containerWidth = Math.floor(this.runtime.containerElement.clientWidth);
            const containerHeight = Math.floor(this.runtime.containerElement.clientHeight);
            if (containerWidth > 0 && containerHeight > 0) {
                initialWidth = containerWidth;
                initialHeight = containerHeight;
            }
        }
        this.runtime.canvas = new this.runtime.fabricModule.Canvas(canvasElement, {
            width: initialWidth,
            height: initialHeight,
            backgroundColor: this.runtime.options.backgroundColor,
            selection: this.runtime.options.groupSelection,
            preserveObjectStacking: true,
        });
        this.runtime.canvas.on('selection:created', (e) => {
            this.handleSelectionChanged(e.selected);
        });
        this.runtime.canvas.on('selection:updated', (e) => {
            this.handleSelectionChanged(e.selected);
        });
        this.runtime.canvas.on('selection:cleared', () => this.handleSelectionChanged([]));
        const onObjectEvent = (e) => {
            if (e.target)
                this.handleObjectMovingScalingRotating(e.target);
        };
        const onObjectModified = (e) => {
            if (e.target)
                this.handleObjectModified(e.target);
        };
        this.runtime.canvas.on('object:moving', onObjectEvent);
        this.runtime.canvas.on('object:scaling', onObjectEvent);
        this.runtime.canvas.on('object:rotating', onObjectEvent);
        this.runtime.canvas.on('object:modified', onObjectModified);
    }
    resolveElement(key, ownerDocument = getRuntimeDocument(this.runtime.canvasElement), guard) {
        return resolveDomElement(this.runtime.elements[key], ownerDocument, guard);
    }
    bindDomEvents() {
        if (!this.runtime.domBindings)
            return;
        const ownerDocument = getRuntimeDocument(this.runtime.canvasElement);
        if (!ownerDocument)
            return;
        bindEditorDomEvents({
            bindings: this.runtime.domBindings,
            rotationStep: this.runtime.options.rotationStep,
            getInputValue: (key) => {
                var _a;
                const element = this.resolveElement(key, ownerDocument, isInputOrSelectElement);
                return (_a = element === null || element === void 0 ? void 0 : element.value) !== null && _a !== void 0 ? _a : '';
            },
            actions: createEditorDomEventActions(this.runtime, ownerDocument, {
                reportAsyncActionError: (operation, error) => {
                    reportError(this.runtime.options, error, `${operation} failed.`);
                },
                loadImageFile: (file) => this.loadImageFile(file),
                scaleImage: (scale) => this.scaleImage(scale),
                rotateImage: (rotation) => this.rotateImage(rotation),
                resetImageTransform: () => this.resetImageTransform(),
                flipHorizontal: () => this.flipHorizontal(),
                flipVertical: () => this.flipVertical(),
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
                enterCropMode: (options) => {
                    this.enterCropMode(options);
                },
                setCropAspectRatio: (aspectRatio) => {
                    this.setCropAspectRatio(aspectRatio);
                },
                applyCrop: () => this.applyCrop(),
                reportCropApplyError: (error) => {
                    reportError(this.runtime.options, error, 'Crop apply failed.');
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
            }),
        });
        this.bindKeyboardEvents(ownerDocument);
    }
    bindKeyboardEvents(ownerDocument) {
        bindEditorKeyboardEvents({
            getOwnerDocument: () => ownerDocument,
            getKeyboardDocument: () => this.runtime.keyboardDocument,
            getKeyboardHandler: () => this.runtime.keyboardHandler,
            setKeyboardBinding: (keyboardDocument, keyboardHandler) => {
                this.runtime.keyboardDocument = keyboardDocument;
                this.runtime.keyboardHandler = keyboardHandler;
            },
            removeKeyboardListener: (keyboardDocument, keyboardHandler) => {
                safelyRemoveKeyboardListener(keyboardDocument, keyboardHandler);
            },
            handleKeyboardEvent: (event) => {
                this.handleKeyboardEvent(event);
            },
        });
    }
    handleKeyboardEvent(event) {
        handleEditorKeyboardEvent({
            isDisposed: () => this.runtime.isDisposed,
            getCanvas: () => this.runtime.canvas,
            getKeyboardDocument: () => this.runtime.keyboardDocument,
            hasTextSession: () => this.runtime.textSession !== null,
            hasDrawSession: () => this.runtime.drawSession !== null,
            hasMosaicSession: () => this.runtime.mosaicSession !== null,
            hasCropSession: () => this.runtime.cropSession !== null,
            deleteSelectedObject: () => {
                this.deleteSelectedObject();
            },
            finalizeActiveTextEditing: (commit) => {
                finalizeActiveTextEditing(this.buildTextControllerContext(), { commit });
            },
            exitTextMode: () => {
                this.exitTextMode();
            },
            exitDrawMode: () => {
                this.exitDrawMode();
            },
            exitMosaicMode: () => {
                this.exitMosaicMode();
            },
            cancelCrop: () => {
                this.cancelCrop();
            },
        }, event);
    }
    finalizeActiveTextEditingIfNeeded() {
        if (!this.runtime.canvas || !isFabricTextEditingActive(this.runtime.canvas))
            return;
        finalizeActiveTextEditing(this.buildTextControllerContext(), { commit: true });
    }
    async loadImageFile(file) {
        await loadImageFile({
            options: this.runtime.options,
            getInputElement: () => this.resolveElement('imageInput', undefined, isInputElement),
            loadImage: (dataUrl) => this.loadImage(dataUrl),
        }, file);
    }
    async loadImage(base64, options = {}) {
        return this.loadImageInternal(base64, options);
    }
    async loadImageInternal(base64, options = {}) {
        if (!this.runtime.isFabricLoaded || !this.runtime.canvas) {
            reportWarning(this.runtime.options, null, 'loadImage skipped: editor is not initialized.');
            return;
        }
        if (this.runtime.isDisposed) {
            reportWarning(this.runtime.options, null, 'loadImage skipped: editor is disposed.');
            return;
        }
        if (!isSupportedImageDataUrl(base64)) {
            reportWarning(this.runtime.options, new TypeError('[ImageEditor] Unsupported image Data URL.'), 'loadImage skipped: input is not a supported PNG, JPEG, or WebP Data URL.');
            return;
        }
        try {
            this.assertIdleForOperation('loadImage', options);
        }
        catch (error) {
            if (this.isExpectedIdleGuardError(error, 'loadImage')) {
                reportWarning(this.runtime.options, error, error.message);
                return;
            }
            throw error;
        }
        this.finalizeActiveTextEditingIfNeeded();
        const callbackContext = this.getOperationContext('loadImage', options);
        const previousImage = this.runtime.originalImage;
        const hadMasks = this.getMasks().length > 0;
        const hadAnnotations = this.getAnnotations().length > 0;
        this.emitOptionCallback('onImageLoadStart', [callbackContext]);
        this.runtime.operationGuard.beginLoading();
        this.emitBusyChangeIfChanged(callbackContext);
        this.updateUi();
        this.hideAllMaskLabels();
        const loadImageContext = this.contextFactory.buildLoadImageContext();
        try {
            await loadImage(loadImageContext, base64, options);
        }
        finally {
            this.runtime.operationGuard.endLoading();
            this.emitBusyChangeIfChanged(callbackContext);
            if (!this.runtime.isDisposed && this.runtime.canvas)
                this.updateUi();
        }
        this.runtime.lastMask = null;
        this.updateInputs();
        this.updateMaskList();
        this.updateAnnotationList();
        this.updateUi();
        if (previousImage && previousImage !== this.runtime.originalImage) {
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
        this.runtime.operationGuard.assertIdleForOperation(operationName, token);
        const activeToolMode = this.getActiveToolMode();
        if (activeToolMode &&
            !this.runtime.operationGuard.isOwnOperation(token) &&
            !canRunOperationInToolMode(activeToolMode, operationName)) {
            throw new IdleGuardError(operationName, `while ${activeToolMode} mode is active`);
        }
        if (this.runtime.animQueue.isBusy() && !this.canRunDuringAnimationQueue(options)) {
            throw new IdleGuardError(operationName, 'while an animation is queued');
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
    isExpectedIdleGuardError(error, operationName) {
        return error instanceof IdleGuardError && error.operation === operationName;
    }
    assertCanQueueAnimation(operationName, options) {
        const token = this.getInternalOperationToken(options);
        this.runtime.operationGuard.assertCanQueueAnimation(operationName, token);
        const activeToolMode = this.getActiveToolMode();
        if (activeToolMode &&
            !this.runtime.operationGuard.isOwnOperation(token) &&
            !canRunOperationInToolMode(activeToolMode, operationName)) {
            throw new Error(`[ImageEditor] Cannot run "${operationName}" while ${activeToolMode} mode is active.`);
        }
    }
    isImageLoaded() {
        var _a, _b;
        return !!(this.runtime.originalImage &&
            this.runtime.originalImage instanceof this.runtime.fabricModule.FabricImage &&
            ((_a = this.runtime.originalImage.width) !== null && _a !== void 0 ? _a : 0) > 0 &&
            ((_b = this.runtime.originalImage.height) !== null && _b !== void 0 ? _b : 0) > 0);
    }
    isBusy() {
        return (this.runtime.operationGuard.isBusy() ||
            this.runtime.animQueue.isBusy() ||
            this.isToolModeActive());
    }
    isProcessing() {
        return this.runtime.operationGuard.isBusy() || this.runtime.animQueue.isBusy();
    }
    setImageFilterConfig(config) {
        if (!this.runtime.canvas || !this.runtime.originalImage)
            return;
        if (!this.canRunIdleOperation('setImageFilterConfig'))
            return;
        const result = mergeImageFilterConfigPatch(this.runtime.currentImageFilterConfig, config);
        if (result.warnings.length > 0) {
            reportWarning(this.runtime.options, new TypeError(`[ImageEditor] Invalid or out-of-range image filter field(s): ${result.warnings.join(', ')}.`), 'Image filter config was normalized.');
        }
        if (areResolvedImageFilterConfigsEqual(this.runtime.currentImageFilterConfig, result.config)) {
            return;
        }
        this.runtime.currentImageFilterConfig = cloneResolvedImageFilterConfig(result.config);
        this.applyCurrentImageFilters();
        this.runtime.canvas.requestRenderAll();
        this.emitImageChanged(this.buildCallbackContext('setImageFilterConfig', false));
    }
    getImageFilterConfig() {
        return cloneResolvedImageFilterConfig(this.runtime.currentImageFilterConfig);
    }
    resetImageFilterConfig() {
        if (!this.runtime.canvas || !this.runtime.originalImage)
            return;
        if (!this.canRunIdleOperation('resetImageFilterConfig'))
            return;
        const next = cloneResolvedImageFilterConfig(this.runtime.lastCommittedImageFilterConfig);
        if (areResolvedImageFilterConfigsEqual(this.runtime.currentImageFilterConfig, next))
            return;
        this.runtime.currentImageFilterConfig = next;
        this.applyCurrentImageFilters();
        this.runtime.canvas.requestRenderAll();
        this.emitImageChanged(this.buildCallbackContext('resetImageFilterConfig', false));
    }
    clearImageFilters() {
        if (!this.runtime.canvas || !this.runtime.originalImage)
            return;
        if (!this.canRunIdleOperation('clearImageFilters'))
            return;
        this.runtime.currentImageFilterConfig = cloneResolvedImageFilterConfig(DEFAULT_IMAGE_FILTER_CONFIG);
        this.applyCurrentImageFilters();
        this.commitImageFiltersInternal('clearImageFilters');
    }
    commitImageFilters() {
        this.commitImageFiltersInternal('commitImageFilters');
    }
    commitImageFiltersInternal(operation) {
        if (!this.runtime.canvas || !this.runtime.originalImage)
            return;
        if (!this.canRunIdleOperation(operation))
            return;
        if (areResolvedImageFilterConfigsEqual(this.runtime.currentImageFilterConfig, this.runtime.lastCommittedImageFilterConfig)) {
            return;
        }
        this.saveStateInternal();
        this.runtime.lastCommittedImageFilterConfig = cloneResolvedImageFilterConfig(this.runtime.currentImageFilterConfig);
        const context = this.buildCallbackContext(operation, false);
        this.emitHistoryChangeIfChanged(context);
        this.emitImageChanged(context);
    }
    applyCurrentImageFilters() {
        const image = this.runtime.originalImage;
        if (!image)
            return;
        applyImageFilterConfigToImage(this.runtime.fabricModule, image, this.runtime.currentImageFilterConfig);
    }
    setLayoutMode(mode) {
        if (!isLayoutMode(mode)) {
            reportWarning(this.runtime.options, new TypeError(`[ImageEditor] Unsupported layout mode ${JSON.stringify(mode)}. ` +
                'Expected "fit", "cover", or "expand".'), 'Ignored invalid layout mode.');
            return;
        }
        this.runtime.currentLayoutMode = mode;
    }
    setCanvasSize(widthPx, heightPx) {
        this.applyPublicCanvasSize(widthPx, heightPx, 'setCanvasSize');
    }
    resizeToContainer(options = {}) {
        if (!this.canRunPublicLayoutOperation('resizeToContainer'))
            return;
        const size = this.resolveContainerResizeSize(options);
        if (!size) {
            reportWarning(this.runtime.options, new TypeError('[ImageEditor] Container dimensions are not available.'), 'resizeToContainer ignored because no valid container or fallback size was available.');
            return;
        }
        this.applyPublicCanvasSize(size.width, size.height, 'resizeToContainer', {
            skipGuard: true,
            preserveScroll: true,
        });
    }
    relayout(options = {}) {
        var _a;
        if (!this.canRunPublicLayoutOperation('relayout'))
            return;
        if (options.mode !== undefined) {
            if (!isLayoutMode(options.mode)) {
                reportWarning(this.runtime.options, new TypeError(`[ImageEditor] Unsupported relayout mode ${JSON.stringify(options.mode)}. ` +
                    'Expected "fit", "cover", or "expand".'), 'Ignored invalid relayout mode.');
                return;
            }
            this.runtime.currentLayoutMode = options.mode;
        }
        const scroll = options.preserveScroll
            ? captureContainerScroll(this.runtime.containerElement)
            : null;
        const viewport = this.runtime.containerElement ? this.measureLayoutViewport() : null;
        if (viewport)
            this.setCanvasSizePx(viewport.width, viewport.height);
        if (this.runtime.originalImage) {
            this.updateCanvasSizeToImageBounds();
        }
        restoreContainerScroll(this.runtime.containerElement, scroll, this.runtime.options);
        (_a = this.runtime.canvas) === null || _a === void 0 ? void 0 : _a.renderAll();
        this.refreshAfterCanvasLayoutChange('relayout');
    }
    buildCallbackContext(operation, isInternalOperation = false) {
        return { operation, isInternalOperation };
    }
    getOperationContext(fallback, options) {
        const internal = this.getInternalOperationToken(options);
        const activeOperation = this.runtime.operationGuard.activeOperationName();
        if (internal && activeOperation) {
            return this.buildCallbackContext(isImageEditorOperation(activeOperation) ? activeOperation : fallback, true);
        }
        return this.buildCallbackContext(fallback, false);
    }
    emitOptionCallback(callbackName, args) {
        const callback = this.runtime.options[callbackName];
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
        if (!this.runtime.canvas || !this.runtime.originalImage || !this.isImageLoaded()) {
            return null;
        }
        const canvasWidth = this.runtime.canvas.getWidth();
        const canvasHeight = this.runtime.canvas.getHeight();
        let displayWidth;
        let displayHeight;
        try {
            this.runtime.originalImage.setCoords();
            const bounds = this.runtime.originalImage.getBoundingRect();
            displayWidth = Math.max(0, Number(bounds.width) || 0);
            displayHeight = Math.max(0, Number(bounds.height) || 0);
        }
        catch (error) {
            reportWarning(this.runtime.options, error, 'getImageInfo used fallback dimensions because Fabric getBoundingRect failed.');
            displayWidth = Math.max(0, (Number(this.runtime.originalImage.width) || 0) *
                Math.abs(Number(this.runtime.originalImage.scaleX) || 1));
            displayHeight = Math.max(0, (Number(this.runtime.originalImage.height) || 0) *
                Math.abs(Number(this.runtime.originalImage.scaleY) || 1));
        }
        return {
            width: Math.max(0, Number(this.runtime.originalImage.width) || 0),
            height: Math.max(0, Number(this.runtime.originalImage.height) || 0),
            displayWidth,
            displayHeight,
            scale: this.runtime.currentScale,
            rotation: this.runtime.currentRotation,
            canvasWidth,
            canvasHeight,
        };
    }
    getMasks() {
        if (!this.runtime.canvas)
            return [];
        return this.runtime.canvas.getObjects().filter(isMaskObject).slice();
    }
    getAnnotations() {
        if (!this.runtime.canvas)
            return [];
        return getAnnotations(this.runtime.canvas);
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
    buildToolModeSnapshot() {
        return {
            hasCropSession: this.runtime.cropSession !== null,
            hasMosaicSession: this.runtime.mosaicSession !== null,
            hasTextSession: this.runtime.textSession !== null,
            hasDrawSession: this.runtime.drawSession !== null,
            hasShapeSession: this.runtime.shapeSession !== null,
        };
    }
    getActiveToolMode() {
        return getActiveToolMode(this.buildToolModeSnapshot());
    }
    isToolModeActive() {
        return isToolModeActive(this.buildToolModeSnapshot());
    }
    getEditorState() {
        var _a, _b;
        const canvasWidth = this.runtime.canvas ? this.runtime.canvas.getWidth() : 0;
        const canvasHeight = this.runtime.canvas ? this.runtime.canvas.getHeight() : 0;
        const image = this.getImageInfo();
        return {
            hasImage: image !== null,
            image,
            maskCount: this.getMasks().length,
            annotationCount: this.getAnnotations().length,
            currentScale: this.runtime.currentScale,
            currentRotation: this.runtime.currentRotation,
            isFlippedHorizontally: !!((_a = this.runtime.originalImage) === null || _a === void 0 ? void 0 : _a.flipX),
            isFlippedVertically: !!((_b = this.runtime.originalImage) === null || _b === void 0 ? void 0 : _b.flipY),
            isBusy: this.isBusy(),
            activeToolMode: this.getActiveToolMode(),
            isCropMode: this.runtime.cropSession !== null,
            isMosaicMode: this.runtime.mosaicSession !== null,
            isTextMode: this.runtime.textSession !== null,
            isDrawMode: this.runtime.drawSession !== null,
            isShapeMode: this.runtime.shapeSession !== null,
            canUndo: this.runtime.historyManager.canUndo(),
            canRedo: this.runtime.historyManager.canRedo(),
            canvasWidth,
            canvasHeight,
        };
    }
    emitImageChanged(context) {
        this.emitOptionCallback('onImageChanged', [this.getEditorState(), context]);
        this.emitToolModeChangeIfChanged(context);
        this.emitHistoryChangeIfChanged(context);
    }
    emitMasksChanged(context) {
        this.emitOptionCallback('onMasksChanged', [this.getMasks(), context]);
    }
    emitAnnotationsChanged(context) {
        this.emitOptionCallback('onAnnotationsChanged', [this.getAnnotations(), context]);
    }
    emitBusyChangeIfChanged(context) {
        const isBusy = this.isBusy();
        if (this.runtime.lastEmittedIsBusy === isBusy)
            return;
        this.runtime.lastEmittedIsBusy = isBusy;
        this.emitOptionCallback('onBusyChange', [isBusy, context]);
    }
    emitToolModeChangeIfChanged(context) {
        const activeToolMode = this.getActiveToolMode();
        const previousToolMode = this.runtime.lastEmittedToolMode;
        if (previousToolMode === activeToolMode)
            return;
        this.runtime.lastEmittedToolMode = activeToolMode;
        this.emitOptionCallback('onToolModeChange', [activeToolMode, previousToolMode, context]);
    }
    emitHistoryChangeIfChanged(context) {
        const history = {
            canUndo: this.runtime.historyManager.canUndo(),
            canRedo: this.runtime.historyManager.canRedo(),
        };
        const previous = this.runtime.lastEmittedHistoryState;
        if (previous.canUndo === history.canUndo && previous.canRedo === history.canRedo)
            return;
        this.runtime.lastEmittedHistoryState = history;
        this.emitOptionCallback('onHistoryChange', [history, context]);
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
    getSelection() {
        if (!this.runtime.canvas)
            return this.buildSelection([]);
        return this.buildSelection(getActiveSelectionObjects(this.runtime.canvas));
    }
    withSelectionChangeContext(context, callback) {
        const previous = this.runtime.nextSelectionChangeContext;
        this.runtime.nextSelectionChangeContext = context;
        try {
            return callback();
        }
        finally {
            this.runtime.nextSelectionChangeContext = previous;
        }
    }
    isSupportedImageMimeType(mimeType) {
        return mimeType === 'image/jpeg' || mimeType === 'image/png' || mimeType === 'image/webp';
    }
    inferCurrentImageMimeType() {
        const image = this.runtime.originalImage;
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
    canRunPublicLayoutOperation(operation) {
        if (this.runtime.isDisposed || !this.runtime.canvas)
            return false;
        return this.canRunIdleOperation(operation);
    }
    normalizeCanvasDimension(value, operation) {
        const numericValue = Number(value);
        if (isPositiveFiniteDimension(numericValue))
            return Math.round(numericValue);
        reportWarning(this.runtime.options, new TypeError(`[ImageEditor] ${operation} expected positive finite canvas dimensions.`), `${operation} ignored invalid canvas dimensions.`);
        return null;
    }
    applyPublicCanvasSize(widthPx, heightPx, operation, options = {}) {
        var _a;
        if (!options.skipGuard && !this.canRunPublicLayoutOperation(operation))
            return false;
        const width = this.normalizeCanvasDimension(widthPx, operation);
        const height = this.normalizeCanvasDimension(heightPx, operation);
        if (width === null || height === null)
            return false;
        const scroll = options.preserveScroll
            ? captureContainerScroll(this.runtime.containerElement)
            : null;
        this.setCanvasSizePx(width, height);
        restoreContainerScroll(this.runtime.containerElement, scroll, this.runtime.options);
        (_a = this.runtime.canvas) === null || _a === void 0 ? void 0 : _a.renderAll();
        this.refreshAfterCanvasLayoutChange(operation);
        return true;
    }
    resolveContainerResizeSize(options) {
        var _a, _b;
        const container = this.runtime.containerElement;
        const containerWidth = Math.floor((_a = container === null || container === void 0 ? void 0 : container.clientWidth) !== null && _a !== void 0 ? _a : 0);
        const containerHeight = Math.floor((_b = container === null || container === void 0 ? void 0 : container.clientHeight) !== null && _b !== void 0 ? _b : 0);
        if (containerWidth > 0 && containerHeight > 0) {
            return { width: containerWidth, height: containerHeight };
        }
        const fallbackWidth = Number(options.fallbackWidth);
        const fallbackHeight = Number(options.fallbackHeight);
        if (isPositiveFiniteDimension(fallbackWidth) && isPositiveFiniteDimension(fallbackHeight)) {
            return { width: Math.round(fallbackWidth), height: Math.round(fallbackHeight) };
        }
        return null;
    }
    refreshAfterCanvasLayoutChange(operation) {
        const context = this.buildCallbackContext(operation, false);
        this.updateInputs();
        this.updateUi();
        this.updatePlaceholderStatus();
        this.emitImageChanged(context);
        this.emitBusyChangeIfChanged(context);
    }
    setCanvasSizePx(widthPx, heightPx) {
        if (!this.runtime.canvas)
            return;
        applyCanvasDimensions(this.runtime.canvas, widthPx, heightPx, this.runtime.containerElement);
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
        (_c = this.runtime.canvas) === null || _c === void 0 ? void 0 : _c.renderAll();
    }
    buildDisplayGeometryContext() {
        return {
            canvas: this.runtime.canvas,
            containerElement: this.runtime.containerElement,
            options: this.runtime.options,
            currentLayoutMode: this.runtime.currentLayoutMode,
            viewportCache: this.runtime.viewportCache,
            getOriginalImage: () => this.runtime.originalImage,
            setCanvasSize: (widthPx, heightPx) => {
                this.setCanvasSizePx(widthPx, heightPx);
            },
            setCurrentScale: (scale) => {
                this.runtime.currentScale = scale;
            },
            setCurrentRotation: (rotation) => {
                this.runtime.currentRotation = rotation;
            },
            setBaseImageScale: (scale) => {
                this.runtime.baseImageScale = scale;
            },
            captureSnapshot: () => this.captureSnapshotInternal(),
            setLastSnapshot: (snapshot) => {
                this.runtime.lastSnapshot = snapshot;
            },
        };
    }
    measureLayoutViewport(scrollbarSize) {
        return measureLayoutViewport(this.buildDisplayGeometryContext(), scrollbarSize);
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
        return scaleImageAction(this.actionAccessFactory.buildTransformActionAccess(), factor);
    }
    rotateImage(degrees) {
        return rotateImageAction(this.actionAccessFactory.buildTransformActionAccess(), degrees);
    }
    flipHorizontal() {
        return flipHorizontalAction(this.actionAccessFactory.buildTransformActionAccess());
    }
    flipVertical() {
        return flipVerticalAction(this.actionAccessFactory.buildTransformActionAccess());
    }
    resetImageTransform() {
        return resetImageTransformAction(this.actionAccessFactory.buildTransformActionAccess());
    }
    refreshUiAfterQueuedAnimation() {
        if (this.runtime.isDisposed || !this.runtime.canvas)
            return;
        this.updateInputs();
        this.updateUi();
    }
    async loadFromState(jsonString) {
        return this.loadFromStateInternal(jsonString);
    }
    async loadFromStateInternal(jsonString, options) {
        await loadFromStateAction(this.actionAccessFactory.buildEditorStateActionAccess(), jsonString, options);
    }
    saveState() {
        this.saveStateInternal();
        this.emitHistoryChangeIfChanged(this.buildCallbackContext('saveState', false));
    }
    saveStateInternal(options) {
        saveStateAction(this.actionAccessFactory.buildEditorStateActionAccess(), options);
    }
    undo() {
        if (this.runtime.isDisposed)
            return Promise.resolve();
        if (!this.canRunIdleOperation('undo'))
            return Promise.resolve();
        this.finalizeActiveTextEditingIfNeeded();
        const context = this.buildCallbackContext('undo', true);
        const job = this.runtime.animQueue.add(async () => {
            if (this.runtime.isDisposed)
                return;
            this.runtime.activeStateRestoreOperation = 'undo';
            try {
                await this.runtime.historyManager.undo();
                this.emitHistoryChangeIfChanged(context);
            }
            finally {
                this.runtime.activeStateRestoreOperation = null;
            }
        });
        this.emitBusyChangeIfChanged(context);
        return job.finally(() => {
            this.refreshUiAfterQueuedAnimation();
            this.emitBusyChangeIfChanged(context);
        });
    }
    redo() {
        if (this.runtime.isDisposed)
            return Promise.resolve();
        if (!this.canRunIdleOperation('redo'))
            return Promise.resolve();
        this.finalizeActiveTextEditingIfNeeded();
        const context = this.buildCallbackContext('redo', true);
        const job = this.runtime.animQueue.add(async () => {
            if (this.runtime.isDisposed)
                return;
            this.runtime.activeStateRestoreOperation = 'redo';
            try {
                await this.runtime.historyManager.redo();
                this.emitHistoryChangeIfChanged(context);
            }
            finally {
                this.runtime.activeStateRestoreOperation = null;
            }
        });
        this.emitBusyChangeIfChanged(context);
        return job.finally(() => {
            this.refreshUiAfterQueuedAnimation();
            this.emitBusyChangeIfChanged(context);
        });
    }
    createMask(config = {}) {
        return createMaskAction(this.actionAccessFactory.buildMaskActionAccess(), config);
    }
    removeSelectedMask() {
        removeSelectedMaskAction(this.actionAccessFactory.buildMaskActionAccess());
    }
    removeAllMasks(options = {}) {
        removeAllMasksAction(this.actionAccessFactory.buildMaskActionAccess(), options);
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
        handleObjectMovingScalingRotating(this.actionAccessFactory.buildSelectionControllerAccess(), target);
    }
    handleObjectModified(target) {
        handleObjectModified(this.actionAccessFactory.buildSelectionControllerAccess(), target);
    }
    handleSelectionChanged(selected) {
        handleSelectionChanged(this.actionAccessFactory.buildSelectionControllerAccess(), selected);
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
        enterTextModeAction(this.actionAccessFactory.buildAnnotationModeActionAccess());
    }
    exitTextMode() {
        exitTextModeAction(this.actionAccessFactory.buildAnnotationModeActionAccess());
    }
    isTextMode() {
        return this.runtime.textSession !== null;
    }
    createTextAnnotation(config = {}) {
        return createTextAnnotationAction(this.actionAccessFactory.buildAnnotationModeActionAccess(), config);
    }
    enterDrawMode() {
        enterDrawModeAction(this.actionAccessFactory.buildAnnotationModeActionAccess());
    }
    exitDrawMode() {
        exitDrawModeAction(this.actionAccessFactory.buildAnnotationModeActionAccess());
    }
    isDrawMode() {
        return this.runtime.drawSession !== null;
    }
    getTextConfig() {
        return cloneResolvedTextAnnotationConfig(this.runtime.currentTextConfig);
    }
    setTextConfig(config) {
        this.applyTextConfigPatch(config, 'setTextConfig');
    }
    resetTextConfig() {
        this.applyTextConfigPatch(this.runtime.defaultTextConfig, 'resetTextConfig');
    }
    setTextColor(color) {
        this.applyTextConfigPatch({ fill: color }, 'setTextColor');
    }
    setTextFontSize(size) {
        this.applyTextConfigPatch({ fontSize: size }, 'setTextFontSize');
    }
    getDrawConfig() {
        return cloneResolvedDrawConfig(this.runtime.currentDrawConfig);
    }
    setDrawConfig(config) {
        this.applyDrawConfigPatch(config, 'setDrawConfig');
    }
    resetDrawConfig() {
        this.applyDrawConfigPatch(this.runtime.defaultDrawConfig, 'resetDrawConfig');
    }
    setDrawColor(color) {
        this.applyDrawConfigPatch({ color }, 'setDrawColor');
    }
    setDrawBrushSize(size) {
        this.applyDrawConfigPatch({ brushSize: size }, 'setDrawBrushSize');
    }
    setDrawSubMode(mode) {
        if (!this.runtime.canvas || !this.runtime.drawSession)
            return;
        if (!this.canRunIdleOperation('setDrawSubMode'))
            return;
        if (mode !== 'brush' && mode !== 'erase') {
            reportWarning(this.runtime.options, new TypeError('[ImageEditor] setDrawSubMode expected "brush" or "erase".'), 'Ignored invalid Draw sub-mode.');
            return;
        }
        setDrawSubMode(this.buildDrawControllerContext(), mode);
        this.emitImageChanged(this.buildCallbackContext('setDrawSubMode', false));
    }
    getDrawSubMode() {
        var _a, _b;
        return (_b = (_a = this.runtime.drawSession) === null || _a === void 0 ? void 0 : _a.subMode) !== null && _b !== void 0 ? _b : null;
    }
    getEraserConfig() {
        return cloneResolvedEraserConfig(this.runtime.currentEraserConfig);
    }
    setEraserConfig(config) {
        this.applyEraserConfigPatch(config, 'setEraserConfig');
    }
    resetEraserConfig() {
        this.applyEraserConfigPatch(this.runtime.defaultEraserConfig, 'resetEraserConfig');
    }
    createShapeAnnotation(config = {}) {
        if (!this.runtime.canvas)
            return null;
        if (!this.canRunIdleOperation('createShapeAnnotation'))
            return null;
        return createShapeAnnotation(this.buildShapeControllerContext(), config);
    }
    enterShapeMode(shape = this.runtime.currentShapeConfig.shape) {
        if (!this.runtime.canvas)
            return;
        if (!this.canRunIdleOperation('enterShapeMode'))
            return;
        enterShapeMode(this.buildShapeControllerContext(), shape);
        const callbackContext = this.buildCallbackContext('enterShapeMode', false);
        this.emitBusyChangeIfChanged(callbackContext);
        this.emitImageChanged(callbackContext);
    }
    exitShapeMode() {
        if (!this.runtime.canvas || !this.runtime.shapeSession)
            return;
        if (!this.canRunIdleOperation('exitShapeMode'))
            return;
        exitShapeMode(this.buildShapeControllerContext());
        const callbackContext = this.buildCallbackContext('exitShapeMode', false);
        this.emitBusyChangeIfChanged(callbackContext);
        this.emitImageChanged(callbackContext);
    }
    isShapeMode() {
        return this.runtime.shapeSession !== null;
    }
    getShapeConfig() {
        return cloneResolvedShapeAnnotationConfig(this.runtime.currentShapeConfig);
    }
    setShapeConfig(config) {
        this.applyShapeConfigPatch(config, 'setShapeConfig');
    }
    resetShapeConfig() {
        this.applyShapeConfigPatch(this.runtime.defaultShapeConfig, 'resetShapeConfig');
    }
    removeSelectedAnnotation() {
        if (!this.runtime.canvas)
            return;
        if (!this.canRunIdleOperation('removeSelectedAnnotation'))
            return;
        const callbackContext = this.buildCallbackContext('removeSelectedAnnotation', false);
        removeSelectedAnnotationAction(this.actionAccessFactory.buildEditableObjectActionAccess(), callbackContext);
    }
    removeAllAnnotations(options = {}) {
        if (!this.runtime.canvas)
            return;
        if (!this.canRunIdleOperation('removeAllAnnotations', options))
            return;
        const callbackContext = this.buildCallbackContext('removeAllAnnotations', false);
        removeAllAnnotationsAction(this.actionAccessFactory.buildEditableObjectActionAccess(), options, callbackContext);
    }
    updateAnnotation(annotationId, config) {
        if (!this.runtime.canvas)
            return;
        if (!this.canRunIdleOperation('updateAnnotation'))
            return;
        const callbackContext = this.buildCallbackContext('updateAnnotation', false);
        updateAnnotationAction(this.actionAccessFactory.buildEditableObjectActionAccess(), annotationId, config, callbackContext);
    }
    updateSelectedAnnotation(config) {
        if (!this.runtime.canvas)
            return;
        if (!this.canRunIdleOperation('updateSelectedAnnotation'))
            return;
        const callbackContext = this.buildCallbackContext('updateSelectedAnnotation', false);
        updateSelectedAnnotationAction(this.actionAccessFactory.buildEditableObjectActionAccess(), config, callbackContext);
    }
    deleteSelectedObject() {
        if (!this.runtime.canvas)
            return;
        if (!this.canRunIdleOperation('deleteSelectedObject'))
            return;
        this.finalizeActiveTextEditingIfNeeded();
        const callbackContext = this.buildCallbackContext('deleteSelectedObject', false);
        deleteSelectedEditableObjects(this.actionAccessFactory.buildEditableObjectActionAccess(), callbackContext);
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
    buildShapeControllerContext() {
        return this.contextFactory.buildShapeControllerContext();
    }
    applyTextConfigPatch(config, operation) {
        applyTextConfigPatchAction(this.actionAccessFactory.buildAnnotationConfigActionAccess(), config, operation);
    }
    applyDrawConfigPatch(config, operation) {
        applyDrawConfigPatchAction(this.actionAccessFactory.buildAnnotationConfigActionAccess(), config, operation);
    }
    applyEraserConfigPatch(config, operation) {
        if (!this.runtime.canvas)
            return;
        if (!this.canRunIdleOperation(operation))
            return;
        const invalidFields = getInvalidEraserConfigFields(config);
        if (invalidFields.length > 0) {
            reportWarning(this.runtime.options, null, `${operation} ignored invalid Eraser config fields: ${invalidFields.join(', ')}.`);
        }
        const next = mergeEraserConfigPatch(this.runtime.currentEraserConfig, config, this.runtime.defaultEraserConfig);
        if (areResolvedEraserConfigsEqual(this.runtime.currentEraserConfig, next))
            return;
        this.runtime.currentEraserConfig = next;
        updateEraserPreview(this.buildDrawControllerContext());
        this.updateInputs();
        this.updateUi();
        this.emitImageChanged(this.buildCallbackContext(operation, false));
    }
    applyShapeConfigPatch(config, operation) {
        if (!this.runtime.canvas)
            return;
        if (!this.canRunIdleOperation(operation))
            return;
        const invalidFields = getInvalidShapeAnnotationConfigFields(config);
        if (invalidFields.length > 0) {
            reportWarning(this.runtime.options, null, `${operation} ignored invalid Shape config fields: ${invalidFields.join(', ')}.`);
        }
        const next = mergeShapeAnnotationConfigPatch(this.runtime.currentShapeConfig, config, this.runtime.defaultShapeConfig);
        if (areResolvedShapeAnnotationConfigsEqual(this.runtime.currentShapeConfig, next))
            return;
        this.runtime.currentShapeConfig = next;
        syncShapeModeConfig(this.buildShapeControllerContext());
        this.updateInputs();
        this.updateUi();
        this.emitImageChanged(this.buildCallbackContext(operation, false));
    }
    applyTextColorInput(color) {
        applyTextColorInputAction(this.actionAccessFactory.buildAnnotationConfigActionAccess(), color);
    }
    applyTextFontSizeInput(size) {
        applyTextFontSizeInputAction(this.actionAccessFactory.buildAnnotationConfigActionAccess(), size);
    }
    applyDrawColorInput(color) {
        applyDrawColorInputAction(this.actionAccessFactory.buildAnnotationConfigActionAccess(), color);
    }
    applyDrawBrushSizeInput(size) {
        applyDrawBrushSizeInputAction(this.actionAccessFactory.buildAnnotationConfigActionAccess(), size);
    }
    moveSelectedEditableObject(operation) {
        if (!this.runtime.canvas)
            return;
        if (!this.canRunIdleOperation(operation))
            return;
        moveSelectedEditableObject(this.actionAccessFactory.buildEditableObjectActionAccess(), operation);
    }
    async mergeMasks() {
        await mergeMasksAction(this.actionAccessFactory.buildExportActionAccess());
    }
    async downloadImage(options) {
        await downloadImageAction(this.actionAccessFactory.buildExportActionAccess(), options);
    }
    async exportImageBase64(options) {
        return exportImageBase64Action(this.actionAccessFactory.buildExportActionAccess(), options);
    }
    async exportImageFile(options) {
        return exportImageFileAction(this.actionAccessFactory.buildExportActionAccess(), options);
    }
    captureSnapshotInternal() {
        return captureSnapshotAction(this.actionAccessFactory.buildEditorStateActionAccess());
    }
    enterMosaicMode() {
        enterMosaicModeAction(this.actionAccessFactory.buildMosaicActionAccess());
    }
    exitMosaicMode() {
        exitMosaicModeAction(this.actionAccessFactory.buildMosaicActionAccess());
    }
    isMosaicMode() {
        return this.runtime.mosaicSession !== null;
    }
    getMosaicConfig() {
        return cloneResolvedMosaicConfig(this.runtime.currentMosaicConfig);
    }
    setMosaicConfig(config) {
        this.applyMosaicConfigPatch(config, 'setMosaicConfig');
    }
    resetMosaicConfig() {
        resetMosaicConfigAction(this.actionAccessFactory.buildMosaicActionAccess());
    }
    setMosaicBrushSize(size) {
        this.applyMosaicConfigPatch({ brushSize: size }, 'setMosaicBrushSize');
    }
    setMosaicBlockSize(size) {
        this.applyMosaicConfigPatch({ blockSize: size }, 'setMosaicBlockSize');
    }
    applyMosaicConfigPatch(config, operation) {
        applyMosaicConfigPatchAction(this.actionAccessFactory.buildMosaicActionAccess(), config, operation);
    }
    buildMosaicControllerContext() {
        return this.contextFactory.buildMosaicControllerContext();
    }
    enterCropMode(options = {}) {
        enterCropModeAction(this.actionAccessFactory.buildCropActionAccess(), options);
    }
    setCropAspectRatio(aspectRatio) {
        setCropAspectRatioAction(this.actionAccessFactory.buildCropActionAccess(), aspectRatio);
    }
    cancelCrop() {
        cancelCropAction(this.actionAccessFactory.buildCropActionAccess());
    }
    async applyCrop() {
        await applyCropAction(this.actionAccessFactory.buildCropActionAccess());
    }
    buildCropControllerContext(operationToken) {
        return this.contextFactory.buildCropControllerContext(operationToken);
    }
    updateInputs() {
        applyEditorInputState({
            currentScale: this.runtime.currentScale,
            mosaicConfig: this.getMosaicConfig(),
            textConfig: this.getTextConfig(),
            drawConfig: this.getDrawConfig(),
        }, (key) => this.resolveElement(key, undefined, isInputElement));
    }
    async mergeAnnotations() {
        await mergeAnnotationsAction(this.actionAccessFactory.buildExportActionAccess());
    }
    updateUi() {
        const snapshot = buildEditorControlSnapshot(this.runtime);
        if (!snapshot)
            return;
        applyEditorControlState(snapshot, (key, enabled) => {
            this.setControlEnabled(key, enabled);
        });
    }
    buildControlElementContext() {
        return {
            elements: this.runtime.elements,
            originalDisabledMap: this.runtime.elementOriginalDisabledMap,
            originalAriaDisabledMap: this.runtime.elementOriginalAriaDisabledMap,
            originalPointerEventsMap: this.runtime.elementOriginalPointerEventsMap,
            getElement: (key) => this.resolveElement(key),
        };
    }
    setControlEnabled(key, isEnabled) {
        setEditorControlEnabled(this.buildControlElementContext(), key, isEnabled);
    }
    restoreElementOriginalStates() {
        restoreEditorControlOriginalStates(this.buildControlElementContext());
    }
    updatePlaceholderStatus() {
        setPlaceholderVisible(this.runtime.placeholderElement, this.runtime.containerElement, this.runtime.options.showPlaceholder ? !this.runtime.originalImage : false);
    }
    dispose() {
        void this.disposeInternal(false);
    }
    async disposeAsync() {
        await this.disposeInternal(true);
    }
    disposeInternal(waitForCanvasDispose) {
        var _a;
        if (this.runtime.isDisposed) {
            return waitForCanvasDispose ? Promise.resolve() : undefined;
        }
        const context = this.buildCallbackContext('dispose', false);
        const previousImage = this.runtime.originalImage;
        this.runtime.isDisposed = true;
        this.runtime.operationGuard.markDisposed();
        this.runtime.animQueue.clear();
        (_a = this.runtime.domBindings) === null || _a === void 0 ? void 0 : _a.removeAll();
        safelyRemoveKeyboardListener(this.runtime.keyboardDocument, this.runtime.keyboardHandler);
        this.runtime.keyboardHandler = null;
        this.runtime.keyboardDocument = null;
        this.restoreElementOriginalStates();
        safelyExitActiveSession(this.runtime.cropSession !== null, this.runtime.canvas, () => cancelCrop(this.buildCropControllerContext()), () => {
            this.runtime.cropSession = null;
        });
        safelyExitActiveSession(this.runtime.mosaicSession !== null, this.runtime.canvas, () => exitMosaicMode(this.buildMosaicControllerContext()), () => {
            this.runtime.mosaicSession = null;
        });
        safelyExitActiveSession(this.runtime.textSession !== null, this.runtime.canvas, () => exitTextMode(this.buildTextControllerContext()), () => {
            this.runtime.textSession = null;
        });
        safelyExitActiveSession(this.runtime.drawSession !== null, this.runtime.canvas, () => exitDrawMode(this.buildDrawControllerContext()), () => {
            this.runtime.drawSession = null;
        });
        safelyExitActiveSession(this.runtime.shapeSession !== null, this.runtime.canvas, () => exitShapeMode(this.buildShapeControllerContext()), () => {
            this.runtime.shapeSession = null;
        });
        const canvasDispose = this.runtime.canvas
            ? safelyDisposeCanvas(this.runtime.canvas)
            : Promise.resolve();
        this.runtime.resetAfterDispose();
        if (previousImage) {
            this.emitOptionCallback('onImageCleared', [previousImage, context]);
        }
        this.emitImageChanged(context);
        this.emitBusyChangeIfChanged(context);
        this.emitOptionCallback('onEditorDisposed', [context]);
        if (waitForCanvasDispose)
            return canvasDispose;
        return undefined;
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
exports.isShapeAnnotationObject = isShapeAnnotationObject;
exports.isTextAnnotationObject = isTextAnnotationObject;
//# sourceMappingURL=index.cjs.map
