export const DEFAULT_OPTIONS = {
    canvasWidth: 800,
    canvasHeight: 600,
    backgroundColor: 'transparent',
    animationDuration: 300,
    minScale: 0.1,
    maxScale: 5.0,
    scaleStep: 0.05,
    rotationStep: 90,
    expandCanvasToImage: true,
    fitImageToCanvas: false,
    coverImageToCanvas: false,
    downsampleOnLoad: true,
    downsampleMaxWidth: 4000,
    downsampleMaxHeight: 3000,
    downsampleQuality: 0.92,
    preserveSourceFormat: true,
    downsampleMimeType: null,
    imageLoadTimeoutMs: 30000,
    maxHistorySize: 50,
    exportMultiplier: 1,
    exportImageAreaByDefault: true,
    defaultMaskWidth: 50,
    defaultMaskHeight: 80,
    maskRotatable: false,
    maskLabelOnSelect: true,
    maskLabelOffset: 3,
    maskName: 'mask',
    groupSelection: false,
    showPlaceholder: true,
    initialImageBase64: null,
    defaultDownloadFileName: 'edited_image.jpg',
    onImageLoaded: null,
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
};
const KNOWN_TOP_LEVEL_KEYS = new Set([
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
function normalizeCallback(value) {
    return typeof value === 'function' ? value : null;
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
export function resolveOptions(input) {
    var _a, _b, _c, _d, _e, _f;
    const raw = input !== null && input !== void 0 ? input : {};
    const resolved = { ...DEFAULT_OPTIONS };
    for (const key of Object.keys(raw)) {
        if (!KNOWN_TOP_LEVEL_KEYS.has(key))
            continue;
        if (key === 'label' || key === 'crop')
            continue;
        if (key === 'onImageLoaded' || key === 'onError' || key === 'onWarning')
            continue;
        const value = raw[key];
        if (value === undefined)
            continue;
        if (key === 'downsampleQuality') {
            resolved.downsampleQuality = normalizeQualityOption(value);
            continue;
        }
        resolved[key] = value;
    }
    resolved.onImageLoaded = normalizeCallback(raw.onImageLoaded);
    resolved.onError =
        normalizeCallback(raw.onError);
    resolved.onWarning =
        normalizeCallback(raw.onWarning);
    resolved.maxHistorySize = normalizeMaxHistorySize(resolved.maxHistorySize);
    const userLabel = (raw.label && typeof raw.label === 'object') ? raw.label : {};
    const mergedTextOptions = {
        ...DEFAULT_LABEL_TEXT_OPTIONS,
        ...(userLabel.textOptions && typeof userLabel.textOptions === 'object'
            ? userLabel.textOptions
            : {}),
    };
    const label = {
        getText: typeof userLabel.getText === 'function'
            ? userLabel.getText
            : DEFAULT_LABEL.getText,
        textOptions: mergedTextOptions,
    };
    if (typeof userLabel.create === 'function') {
        label.create = userLabel.create;
    }
    Object.freeze(label.textOptions);
    Object.freeze(label);
    const userCrop = (raw.crop && typeof raw.crop === 'object') ? raw.crop : {};
    const crop = {
        minWidth: (_a = userCrop.minWidth) !== null && _a !== void 0 ? _a : DEFAULT_CROP.minWidth,
        minHeight: (_b = userCrop.minHeight) !== null && _b !== void 0 ? _b : DEFAULT_CROP.minHeight,
        padding: (_c = userCrop.padding) !== null && _c !== void 0 ? _c : DEFAULT_CROP.padding,
        hideMasksDuringCrop: (_d = userCrop.hideMasksDuringCrop) !== null && _d !== void 0 ? _d : DEFAULT_CROP.hideMasksDuringCrop,
        preserveMasksAfterCrop: (_e = userCrop.preserveMasksAfterCrop) !== null && _e !== void 0 ? _e : DEFAULT_CROP.preserveMasksAfterCrop,
        allowRotationOfCropRect: (_f = userCrop.allowRotationOfCropRect) !== null && _f !== void 0 ? _f : DEFAULT_CROP.allowRotationOfCropRect,
    };
    Object.freeze(crop);
    return {
        ...resolved,
        label,
        crop,
    };
}
//# sourceMappingURL=default-options.js.map