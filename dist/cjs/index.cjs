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
        if (this.queue.length === 0) {
            this.running = false;
            return;
        }
        this.running = true;
        const entry = this.queue.shift();
        try {
            await entry.run();
            entry.resolve();
        }
        catch (error) {
            entry.reject(error);
        }
        void this.drainQueue();
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
    mergeMaskByDefault: true,
    defaultMaskWidth: 50,
    defaultMaskHeight: 80,
    defaultMaskConfig: EMPTY_DEFAULT_MASK_CONFIG,
    maskRotatable: false,
    maskLabelOnSelect: true,
    maskLabelOffset: 3,
    maskName: 'mask',
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
    minWidth: 100,
    minHeight: 100,
    padding: 10,
    hideMasksDuringCrop: true,
    preserveMasksAfterCrop: false,
    allowRotationOfCropRect: false,
    exportFileType: 'source'};
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
function resolveOptions(input) {
    var _a, _b, _c, _d;
    const raw = input !== null && input !== void 0 ? input : {};
    const resolved = { ...DEFAULT_OPTIONS };
    for (const key of Object.keys(raw)) {
        if (!KNOWN_TOP_LEVEL_KEYS.has(key))
            continue;
        if (key === 'label' || key === 'crop')
            continue;
        if (key === 'onImageLoadStart' ||
            key === 'onImageLoaded' ||
            key === 'onImageCleared' ||
            key === 'onImageChanged' ||
            key === 'onBusyChange' ||
            key === 'onEditorDisposed' ||
            key === 'onMasksChanged' ||
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
    return {
        ...resolved,
        label,
        crop,
    };
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

function isMaskObject(object) {
    return 'maskId' in object && typeof object.maskId === 'number';
}

const SNAPSHOT_CUSTOM_KEYS = [
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
];
function copySnapshotCustomPropsFromCanvas(canvasObjects, jsonObjects) {
    if (!Array.isArray(jsonObjects))
        return;
    for (let index = 0; index < jsonObjects.length; index += 1) {
        const liveObject = canvasObjects[index];
        const jsonObject = jsonObjects[index];
        if (!liveObject || !jsonObject)
            continue;
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
        if (liveObject.isCropRect === true)
            jsonObject.isCropRect = true;
        if (liveObject.maskLabel === true)
            jsonObject.maskLabel = true;
    }
}
function isActiveSelectionObject(object) {
    if (!object)
        return false;
    const type = typeof object.type === 'string' ? object.type.toLowerCase() : '';
    if (type === 'activeselection')
        return true;
    const isType = object.isType;
    return (typeof isType === 'function' &&
        (isType.call(object, 'ActiveSelection') ||
            isType.call(object, 'activeSelection') ||
            isType.call(object, 'activeselection')));
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
    if (isActiveSelectionObject(activeObject)) {
        canvas.discardActiveObject();
    }
    const jsonObj = canvas.toJSON(SNAPSHOT_CUSTOM_KEYS);
    copySnapshotCustomPropsFromCanvas(canvas.getObjects(), jsonObj.objects);
    if (Array.isArray(jsonObj.objects)) {
        jsonObj.objects = jsonObj.objects.filter((o) => o.isCropRect !== true && o.maskLabel !== true);
    }
    jsonObj._editorState = {
        currentScale,
        currentRotation,
        baseImageScale,
        currentImageMimeType: (_c = input.currentImageMimeType) !== null && _c !== void 0 ? _c : null,
    };
    if (activeMaskId !== null)
        jsonObj._editorState.activeMaskId = activeMaskId;
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
    restoreMaskPropsFromJson(objects, (_a = json.objects) !== null && _a !== void 0 ? _a : []);
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
    const originalImage = ((_b = objects.find(isOriginalImageObject)) !== null && _b !== void 0 ? _b : null);
    return {
        editorState,
        maxMaskId,
        originalImage,
        objects,
        jsonString,
    };
}
function isOriginalImageObject(object) {
    if (isMaskObject(object))
        return false;
    const type = typeof object.type === 'string' ? object.type.toLowerCase() : '';
    if (type === 'image')
        return true;
    const isType = object.isType;
    return typeof isType === 'function' && isType.call(object, 'image');
}
function restoreMaskPropsFromJson(canvasObjs, jsonObjs) {
    var _a, _b, _c, _d, _e;
    const consumedCanvasIndexes = new Set();
    for (const jObj of jsonObjs) {
        if (typeof jObj.maskId !== 'number')
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
        maskObject.maskId = jObj.maskId;
        if (typeof jObj.maskUid === 'string') {
            maskObject.maskUid = jObj.maskUid;
        }
        maskObject.maskName = String((_d = jObj.maskName) !== null && _d !== void 0 ? _d : '');
        maskObject.originalAlpha =
            typeof jObj.originalAlpha === 'number'
                ? jObj.originalAlpha
                : ((_e = maskObject.opacity) !== null && _e !== void 0 ? _e : 0.5);
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
    execute(command) {
        void command.execute();
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
    const styleBackupByMask = new Map(maskBackups.map((backup) => [backup.object, backup]));
    const masks = canvas.getObjects().filter(isMaskObject);
    for (const mask of masks) {
        try {
            mask.setCoords();
            const intersects = maskIntersectsRegion(mask, cropRegion);
            if (intersects) {
                const styleBackup = (_a = styleBackupByMask.get(mask)) !== null && _a !== void 0 ? _a : captureMaskStyleBackup(mask);
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
function enterCropMode(context) {
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
    const rectLeft = Math.min(boundsLeft + maxCropWidth - 1, Math.max(boundsLeft, Math.floor(imageBounds.left + padding)));
    const rectTop = Math.min(boundsTop + maxCropHeight - 1, Math.max(boundsTop, Math.floor(imageBounds.top + padding)));
    const configuredMinWidth = Math.max(1, Number(options.crop.minWidth) || 1);
    const configuredMinHeight = Math.max(1, Number(options.crop.minHeight) || 1);
    const minCropWidth = Math.min(configuredMinWidth, maxCropWidth);
    const minCropHeight = Math.min(configuredMinHeight, maxCropHeight);
    const allowRotation = !!options.crop.allowRotationOfCropRect;
    const cropRect = new context.fabric.Rect({
        left: rectLeft,
        top: rectTop,
        width: minCropWidth,
        height: minCropHeight,
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
    if (!allowRotation) {
        cropRect.setControlVisible('mtr', false);
    }
    canvas.add(cropRect);
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
            const nextScaleX = Math.min(maxCropWidth / cropWidth, Math.max(minCropWidth / cropWidth, Number(cropRect.scaleX) || 1));
            const nextScaleY = Math.min(maxCropHeight / cropHeight, Math.max(minCropHeight / cropHeight, Number(cropRect.scaleY) || 1));
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
        mergeMask: typeof providedOptions.mergeMask === 'boolean'
            ? providedOptions.mergeMask
            : context.options.mergeMaskByDefault,
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
async function withMaskExportState(context, mergeMask, callback) {
    if (!mergeMask)
        return withMasksHidden(context, callback);
    return withMaskStyleBackup({ canvas: context.canvas, options: context.options }, applyExportBakeInStyle, callback);
}
async function withMasksHidden(context, callback) {
    const backups = getCanvasObjects(context.canvas)
        .filter(isMaskObject)
        .map((mask) => ({
        mask,
        visible: mask.visible,
    }));
    for (const backup of backups) {
        try {
            if (typeof backup.mask.set === 'function') {
                backup.mask.set({ visible: false });
            }
            else {
                backup.mask.visible = false;
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
                if (typeof backup.mask.set === 'function') {
                    backup.mask.set({ visible: backup.visible });
                }
                else {
                    backup.mask.visible = backup.visible;
                }
            }
            catch {
            }
        }
    }
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
    return new Promise((resolve, reject) => {
        const imageElement = new Image();
        imageElement.crossOrigin = 'anonymous';
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
            cleanup();
            resolve(imageElement);
        };
        const handleError = () => {
            cleanup();
            reject(new Error('Failed to decode export data URL'));
        };
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
}
async function sealPartialTransparentEdges(dataUrl, edges) {
    if (!hasPartialEdges(edges))
        return dataUrl;
    const imageElement = await loadImageElement(dataUrl);
    const { width, height } = getImageDimensions(imageElement);
    const offscreenCanvas = document.createElement('canvas');
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
    return offscreenCanvas.toDataURL('image/png');
}
function getJpegBackgroundColor(backgroundColor) {
    return resolveCanvasFillStyle(backgroundColor);
}
function resolveCanvasFillStyle(backgroundColor, fallback = '#ffffff') {
    const value = String(backgroundColor !== null && backgroundColor !== void 0 ? backgroundColor : '').trim();
    if (!value || isTransparentCssColor(value))
        return '#ffffff';
    const context = createColorValidationContext();
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
function createColorValidationContext() {
    try {
        if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
            return null;
        }
        return document.createElement('canvas').getContext('2d');
    }
    catch {
        return null;
    }
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
async function convertDataUrlToOpaqueJpeg(dataUrl, backgroundColor, quality) {
    const imageElement = await loadImageElement(dataUrl);
    const { width, height } = getImageDimensions(imageElement);
    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = width;
    offscreenCanvas.height = height;
    const canvasContext = offscreenCanvas.getContext('2d');
    if (!canvasContext)
        throw new Error('2D canvas context is unavailable');
    canvasContext.fillStyle = getJpegBackgroundColor(backgroundColor);
    canvasContext.fillRect(0, 0, width, height);
    canvasContext.drawImage(imageElement, 0, 0, width, height);
    return offscreenCanvas.toDataURL('image/jpeg', quality);
}
function dataUrlToBytes(dataUrl) {
    var _a;
    const match = /^data:image\/[a-z0-9.+-]+;base64,([A-Za-z0-9+/=\s]+)$/i.exec(dataUrl);
    if (!match || !((_a = match[1]) === null || _a === void 0 ? void 0 : _a.trim())) {
        throw new Error('exportImageFile received a malformed or empty image data URL.');
    }
    const commaAt = dataUrl.indexOf(',');
    const base64 = dataUrl.slice(commaAt + 1).replace(/\s/g, '');
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
async function reencodeDataUrlAs(sourceDataUrl, target, backgroundColor) {
    if (sourceDataUrl.startsWith(`data:${target.mimeType}`)) {
        return sourceDataUrl;
    }
    const imageElement = await loadImageElement(sourceDataUrl);
    const { width, height } = getImageDimensions(imageElement);
    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = width;
    offscreenCanvas.height = height;
    const canvasContext = offscreenCanvas.getContext('2d');
    if (!canvasContext) {
        throw new Error('Unable to acquire 2D context for export conversion');
    }
    if (target.format === 'jpeg') {
        canvasContext.fillStyle = getJpegBackgroundColor(backgroundColor);
        canvasContext.fillRect(0, 0, width, height);
    }
    canvasContext.drawImage(imageElement, 0, 0, width, height);
    return offscreenCanvas.toDataURL(target.mimeType, target.quality);
}
function warnNoImageLoaded(operation) {
    console.warn(`[ImageEditor] ${operation} skipped: no image is loaded on the canvas.`);
}
async function exportImageBase64(context, options) {
    if (!context.isImageLoaded()) {
        warnNoImageLoaded('exportImageBase64');
        return '';
    }
    const activeObject = captureActiveObject(context.canvas);
    const labelBackups = captureMaskLabelBackups(context.canvas);
    try {
        context.canvas.discardActiveObject();
        const resolved = resolveExportOptions(context, options);
        const { region, partialEdges } = computeExportRegion(context, resolved.exportArea);
        assertExportPixelBudget(context, resolved.multiplier, region);
        const renderFormat = region && resolved.format.format === 'jpeg' ? 'png' : resolved.format.format;
        const renderQuality = renderFormat === 'png' ? undefined : resolved.format.quality;
        let dataUrl = await withMaskExportState(context, resolved.mergeMask, async () => renderCanvasToDataUrl(context.canvas, renderFormat, renderQuality, resolved.multiplier, region));
        if (region) {
            dataUrl = await sealPartialTransparentEdges(dataUrl, partialEdges);
            if (resolved.format.format === 'jpeg') {
                dataUrl = await convertDataUrlToOpaqueJpeg(dataUrl, context.options.backgroundColor, resolved.format.quality);
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
async function exportImageFile(context, options) {
    var _a;
    if (!context.isImageLoaded()) {
        warnNoImageLoaded('exportImageFile');
        throw new ExportNotReadyError('exportImageFile');
    }
    const providedOptions = options !== null && options !== void 0 ? options : {};
    const fileName = (_a = providedOptions.fileName) !== null && _a !== void 0 ? _a : context.options.defaultDownloadFileName;
    const resolved = resolveExportFormat(providedOptions, context.options.downsampleQuality);
    const base64 = await exportImageBase64(context, {
        exportArea: providedOptions.exportArea,
        mergeMask: providedOptions.mergeMask,
        multiplier: providedOptions.multiplier,
        quality: providedOptions.quality,
        fileType: providedOptions.fileType,
    });
    if (!base64) {
        throw new ExportNotReadyError('exportImageFile');
    }
    const finalDataUrl = await reencodeDataUrlAs(base64, resolved, context.options.backgroundColor);
    let bytes;
    try {
        bytes = dataUrlToBytes(finalDataUrl);
    }
    catch (error) {
        throw new ExportError('exportImageFile failed to decode rendered data URL.', error);
    }
    return new File([bytes], fileName, { type: resolved.mimeType });
}
function downloadImage(context, fileName) {
    if (!context.isImageLoaded()) {
        warnNoImageLoaded('downloadImage');
        return;
    }
    const resolvedFileName = fileName !== null && fileName !== void 0 ? fileName : context.options.defaultDownloadFileName;
    void exportImageBase64(context, {
        exportArea: context.options.exportAreaByDefault,
        mergeMask: context.options.mergeMaskByDefault,
        multiplier: context.options.exportMultiplier,
    })
        .then((dataUrl) => {
        if (!dataUrl)
            return;
        const link = document.createElement('a');
        link.download = resolvedFileName;
        link.href = dataUrl;
        document.body.appendChild(link);
        try {
            link.click();
        }
        finally {
            document.body.removeChild(link);
        }
    })
        .catch((error) => {
        reportError(context.options, error, 'downloadImage failed.');
        console.error('[ImageEditor] downloadImage failed', error);
    });
}
async function mergeMasks(context) {
    if (!context.isImageLoaded())
        return;
    const masks = context.canvas
        .getObjects()
        .filter((o) => 'maskId' in o && typeof o.maskId === 'number');
    if (masks.length === 0)
        return;
    const beforeSnapshot = context.saveState();
    context.canvas.discardActiveObject();
    context.canvas.renderAll();
    const preScrollTop = context.containerElement ? context.containerElement.scrollTop : null;
    const preScrollLeft = context.containerElement ? context.containerElement.scrollLeft : null;
    try {
        const merged = await exportImageBase64(context, {
            exportArea: 'image',
            mergeMask: true,
            multiplier: context.options.exportMultiplier,
            fileType: 'png',
        });
        if (!merged) {
            throw new MergeMasksError('mergeMasks: exportImageBase64 returned an empty data URL.');
        }
        context.removeAllMasksNoHistory();
        await context.loadImage(merged, { preserveScroll: true });
        const afterSnapshot = context.saveState();
        if (context.containerElement) {
            try {
                if (preScrollTop !== null) {
                    context.containerElement.scrollTop = preScrollTop;
                }
                if (preScrollLeft !== null) {
                    context.containerElement.scrollLeft = preScrollLeft;
                }
            }
            catch (scrollError) {
                console.warn('[ImageEditor] mergeMasks: scroll restore failed', scrollError);
            }
        }
        if (beforeSnapshot && afterSnapshot && beforeSnapshot !== afterSnapshot) {
            context.historyManager.push(new Command(() => context.loadFromState(afterSnapshot), () => context.loadFromState(beforeSnapshot)));
        }
    }
    catch (error) {
        try {
            await context.loadFromState(beforeSnapshot);
        }
        catch (rollbackError) {
            console.warn('[ImageEditor] mergeMasks: rollback failed', rollbackError);
        }
        if (error instanceof MergeMasksError)
            throw error;
        const message = error instanceof Error ? `mergeMasks failed: ${error.message}` : 'mergeMasks failed';
        throw new MergeMasksError(message, error);
    }
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
function resampleImage(imageElement, maxWidth, maxHeight, sourceMime, preserveSourceFormat, downsampleMimeType, quality) {
    const { width, height } = computeDownsampleDimensions(imageElement.naturalWidth, imageElement.naturalHeight, maxWidth, maxHeight);
    const mimeType = selectDownsampleMimeType(sourceMime, preserveSourceFormat, downsampleMimeType);
    const offscreenCanvas = document.createElement('canvas');
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

async function loadImage(context, imageBase64, loadOptions = {}) {
    if (typeof imageBase64 !== 'string' || !imageBase64.startsWith('data:image/')) {
        return;
    }
    const placeholderHidden = context.placeholderElement
        ? !!context.placeholderElement.hidden
        : null;
    const containerScrollTop = context.containerElement ? context.containerElement.scrollTop : null;
    const containerScrollLeft = context.containerElement
        ? context.containerElement.scrollLeft
        : null;
    const containerOverflow = context.containerElement
        ? context.containerElement.style.overflow
        : null;
    const bundle = {
        placeholderHidden,
        containerScrollTop,
        containerScrollLeft,
        containerOverflow,
        originalImage: context.getOriginalImage(),
        isImageLoadedToCanvas: context.getIsImageLoadedToCanvas(),
        lastSnapshot: context.getLastSnapshot(),
        canvasJson: serializeCanvas(context.canvas),
        maskCounter: context.getMaskCounter(),
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
        const loadSource = maybeDownsample(imageElement, imageBase64, context.options);
        const fabricImage = await withTimeout(context.fabric.FabricImage.fromURL(loadSource.dataUrl, { crossOrigin: 'anonymous' }), context.options.imageLoadTimeoutMs, 'FabricImage.fromURL');
        context.canvas.discardActiveObject();
        context.canvas.clear();
        context.canvas.backgroundColor = context.options.backgroundColor;
        fabricImage.set({
            originX: 'left',
            originY: 'top',
            selectable: false,
            evented: false,
        });
        const layout = computeLayout(context, fabricImage);
        applyCanvasDimensions(context.canvas, layout.canvasWidth, layout.canvasHeight, context.containerElement);
        fabricImage.set({ left: layout.imageLeft, top: layout.imageTop });
        fabricImage.scale(layout.imageScale);
        context.canvas.add(fabricImage);
        context.canvas.sendObjectToBack(fabricImage);
        context.setOriginalImage(fabricImage);
        context.setBaseImageScale(layout.baseImageScale);
        context.setCurrentScale(1);
        context.setCurrentRotation(0);
        context.setMaskCounter(0);
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
    const imageElement = new Image();
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
            imageElement.src = '';
        }
    };
    const handleLoad = () => {
        if (!hasNaturalImageDimensions(imageElement)) {
            cleanup(true);
            rejectImage(new ImageDecodeError('Failed to decode image data URL: image has no natural dimensions.', null));
            return;
        }
        cleanup(false);
        resolveImage(imageElement);
    };
    const handleError = (e) => {
        cleanup(true);
        rejectImage(new ImageDecodeError('Failed to decode image data URL.', e));
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
function maybeDownsample(imageElement, originalDataUrl, options) {
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
    const resampledImage = resampleImage(imageElement, options.downsampleMaxWidth, options.downsampleMaxHeight, sourceMime, options.preserveSourceFormat, options.downsampleMimeType, options.downsampleQuality);
    const actualMimeType = toSupportedImageMimeType(detectSourceMimeType(resampledImage.dataUrl));
    return {
        dataUrl: resampledImage.dataUrl,
        mimeType: actualMimeType !== null && actualMimeType !== void 0 ? actualMimeType : resampledImage.mimeType,
    };
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
    if (context.containerElement && bundle.containerOverflow !== null) {
        try {
            context.containerElement.style.overflow = bundle.containerOverflow;
        }
        catch (rollbackError) {
            console.warn('[ImageEditor] rollback: overflow restore failed', rollbackError);
        }
    }
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

function animateProps(object, props, options, guard) {
    return new Promise((resolve, reject) => {
        const propCount = Object.keys(props).length;
        if (propCount === 0) {
            resolve();
            return;
        }
        let completed = 0;
        try {
            object.animate(props, {
                duration: options.duration,
                onChange: () => {
                    var _a;
                    if (guard.isDisposed())
                        return;
                    (_a = options.onChange) === null || _a === void 0 ? void 0 : _a.call(options);
                },
                onComplete: () => {
                    if (++completed >= propCount)
                        resolve();
                },
            });
        }
        catch (error) {
            reject(error);
        }
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
    async resetImageTransform() {
        if (!this.context.getOriginalImage())
            return;
        this.context.setSuppressSaveState(true);
        try {
            await this.scaleImage(1);
            await this.rotateImage(0);
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

const POLYGON_AREA_EPSILON = 1e-6;
let nextMaskUid = 0;
function createMaskUid(maskId) {
    nextMaskUid += 1;
    return `mask-${maskId}-${nextMaskUid}`;
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
    maskObject.originalAlpha = resolvedConfig.alpha;
    maskObject.originalStroke = maskObject.stroke;
    maskObject.originalStrokeWidth = maskObject.strokeWidth;
    attachMaskHoverHandlers(maskObject);
    const nextId = context.getMaskCounter() + 1;
    context.setMaskCounter(nextId);
    maskObject.maskId = nextId;
    maskObject.maskUid = createMaskUid(nextId);
    maskObject.maskName = `${options.maskName}${nextId}`;
    context.setLastMask(maskObject);
    canvas.add(maskObject);
    canvas.bringObjectToFront(maskObject);
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
function removeSelectedMask(context) {
    const active = context.canvas.getActiveObject();
    if (!active || !isMaskObject(active))
        return;
    context.removeLabelForMask(active);
    detachMaskHoverHandlers(active);
    context.canvas.remove(active);
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

function renderMaskList(context) {
    const listId = context.getListElementId();
    if (!listId)
        return;
    const listEl = document.getElementById(listId);
    if (!listEl || !context.canvas)
        return;
    listEl.innerHTML = '';
    const canvas = context.canvas;
    canvas
        .getObjects()
        .filter(isMaskObject)
        .forEach((mask) => {
        const listItemElement = document.createElement('li');
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
    const listEl = document.getElementById(listId);
    if (!listEl)
        return;
    const selectedId = selectedMask ? String(selectedMask.maskId) : null;
    listEl.querySelectorAll('.mask-item').forEach((item) => {
        const isSelected = selectedId !== null && item.dataset.maskId === selectedId;
        item.classList.toggle('active', isSelected);
    });
}

class DomBindings {
    constructor(resolveElementId, isDisposed) {
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
        this.resolveElementId = resolveElementId;
        this.isDisposed = isDisposed;
    }
    bindIfExists(key, eventType, handler) {
        const id = this.resolveElementId(key);
        if (!id)
            return false;
        const element = document.getElementById(id);
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
            const element = document.getElementById(id);
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

const SUPPORTED_IMAGE_EXTENSIONS = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif',
    bmp: 'image/bmp',
};
const SUPPORTED_IMAGE_MIME_TYPES = new Set(Object.values(SUPPORTED_IMAGE_EXTENSIONS));
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

const LAYOUT_EPSILON = 0.5;
const INTERNAL_OPERATION_TOKEN = Symbol.for('ImageEditorInternalOperation');
const INTERNAL_ALLOW_DURING_ANIMATION_QUEUE = Symbol.for('ImageEditorAllowDuringAnimationQueue');
const CROP_MODE_CONTROL_KEYS = [
    'scalePercentageInput',
    'rotateLeftDegreesInput',
    'rotateRightDegreesInput',
    'rotateLeftButton',
    'rotateRightButton',
    'createMaskButton',
    'removeSelectedMaskButton',
    'removeAllMasksButton',
    'mergeMasksButton',
    'downloadImageButton',
    'zoomInButton',
    'zoomOutButton',
    'resetImageTransformButton',
    'undoButton',
    'redoButton',
    'imageInput',
    'enterCropModeButton',
    'applyCropButton',
    'cancelCropButton',
];
const CROP_MODE_ENABLED_KEYS = ['applyCropButton', 'cancelCropButton'];
const CROP_SESSION_ALLOWED_OPERATIONS = new Set(['applyCrop', 'cancelCrop']);
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
        Object.defineProperty(this, "domBindings", {
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
            createMaskButton: 'createMaskButton',
            removeSelectedMaskButton: 'removeSelectedMaskButton',
            removeAllMasksButton: 'removeAllMasksButton',
            mergeMasksButton: 'mergeMasksButton',
            downloadImageButton: 'downloadImageButton',
            maskList: 'maskList',
            zoomInButton: 'zoomInButton',
            zoomOutButton: 'zoomOutButton',
            resetImageTransformButton: 'resetImageTransformButton',
            undoButton: 'undoButton',
            redoButton: 'redoButton',
            imageInput: 'imageInput',
            enterCropModeButton: 'enterCropModeButton',
            applyCropButton: 'applyCropButton',
            cancelCropButton: 'cancelCropButton',
            uploadArea: 'uploadArea',
        };
        this.elements = { ...defaults, ...idMap };
        this.domBindings = new DomBindings((key) => this.elements[key], () => this.isDisposed);
        this.initCanvas();
        this.transformController = new TransformController(this.buildTransformContext());
        this.bindDomEvents();
        this.updateInputs();
        this.updateMaskList();
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
            if (e.target && isMaskObject(e.target))
                this.syncMaskLabel(e.target);
        };
        const onObjectModified = (e) => {
            if (!e.target || !isMaskObject(e.target))
                return;
            this.syncMaskLabel(e.target);
            this.saveState();
        };
        this.canvas.on('object:moving', onObjectEvent);
        this.canvas.on('object:scaling', onObjectEvent);
        this.canvas.on('object:rotating', onObjectEvent);
        this.canvas.on('object:modified', onObjectModified);
    }
    bindDomEvents() {
        this.bindElementIfExists('uploadArea', 'click', () => {
            var _a;
            const inputId = this.elements.imageInput;
            if (inputId)
                (_a = document.getElementById(inputId)) === null || _a === void 0 ? void 0 : _a.click();
        });
        this.bindElementIfExists('imageInput', 'change', (e) => {
            var _a;
            const file = (_a = e.target.files) === null || _a === void 0 ? void 0 : _a[0];
            if (file)
                void this.loadImageFile(file);
        });
        this.bindElementIfExists('zoomInButton', 'click', () => {
            void this.scaleImage(this.currentScale + this.options.scaleStep);
        });
        this.bindElementIfExists('zoomOutButton', 'click', () => {
            void this.scaleImage(this.currentScale - this.options.scaleStep);
        });
        this.bindElementIfExists('resetImageTransformButton', 'click', () => {
            void this.resetImageTransform();
        });
        this.bindElementIfExists('createMaskButton', 'click', () => {
            this.createMask();
        });
        this.bindElementIfExists('removeSelectedMaskButton', 'click', () => {
            this.removeSelectedMask();
        });
        this.bindElementIfExists('removeAllMasksButton', 'click', () => {
            this.removeAllMasks();
        });
        this.bindElementIfExists('mergeMasksButton', 'click', () => {
            void this.mergeMasks();
        });
        this.bindElementIfExists('downloadImageButton', 'click', () => {
            this.downloadImage();
        });
        this.bindElementIfExists('undoButton', 'click', () => {
            this.undo();
        });
        this.bindElementIfExists('redoButton', 'click', () => {
            this.redo();
        });
        this.bindElementIfExists('rotateLeftButton', 'click', () => {
            const inputId = this.elements.rotateLeftDegreesInput;
            const inputEl = inputId
                ? document.getElementById(inputId)
                : null;
            let step = this.options.rotationStep;
            if (inputEl) {
                const parsedStep = parseFloat(inputEl.value);
                if (!isNaN(parsedStep))
                    step = parsedStep;
            }
            void this.rotateImage(this.currentRotation - step);
        });
        this.bindElementIfExists('rotateRightButton', 'click', () => {
            const inputId = this.elements.rotateRightDegreesInput;
            const inputEl = inputId
                ? document.getElementById(inputId)
                : null;
            let step = this.options.rotationStep;
            if (inputEl) {
                const parsedStep = parseFloat(inputEl.value);
                if (!isNaN(parsedStep))
                    step = parsedStep;
            }
            void this.rotateImage(this.currentRotation + step);
        });
        this.bindElementIfExists('enterCropModeButton', 'click', () => {
            this.enterCropMode();
        });
        this.bindElementIfExists('applyCropButton', 'click', () => {
            void this.applyCrop().catch((error) => {
                reportError(this.options, error, 'Crop apply failed.');
            });
        });
        this.bindElementIfExists('cancelCropButton', 'click', () => {
            this.cancelCrop();
        });
    }
    bindElementIfExists(key, event, handler) {
        var _a;
        (_a = this.domBindings) === null || _a === void 0 ? void 0 : _a.bindIfExists(key, event, handler);
    }
    async loadImageFile(file) {
        const inputId = this.elements.imageInput;
        const inputEl = inputId
            ? document.getElementById(inputId)
            : null;
        const mime = inferImageMimeType(file);
        if (!mime) {
            reportWarning(this.options, null, `Unsupported image file type: ${file.type || file.name || 'unknown'}.`);
            resetFileInput(inputEl);
            return;
        }
        let dataUrl;
        try {
            dataUrl = await readFileAsDataUrl(file);
        }
        catch (error) {
            reportError(this.options, error, 'Failed to read selected image file.');
            resetFileInput(inputEl);
            return;
        }
        try {
            await this.loadImage(dataUrl);
        }
        catch {
        }
        finally {
            resetFileInput(inputEl);
        }
    }
    async loadImage(base64, options = {}) {
        if (!this.isFabricLoaded || !this.canvas)
            return;
        if (this.isDisposed)
            return;
        if (typeof base64 !== 'string' || !base64.startsWith('data:image/'))
            return;
        if (!this.canRunIdleOperation('loadImage', options))
            return;
        const callbackContext = this.getOperationContext('loadImage', options);
        const previousImage = this.originalImage;
        const hadMasks = this.getMasks().length > 0;
        this.emitOptionCallback('onImageLoadStart', [callbackContext]);
        this.operationGuard.beginLoading();
        this.emitBusyChangeIfChanged(callbackContext);
        this.updateUi();
        this.hideAllMaskLabels();
        const loadImageContext = {
            fabric: this.fabricModule,
            canvas: this.canvas,
            options: this.options,
            containerElement: this.containerElement,
            placeholderElement: this.placeholderElement,
            viewportCache: this.viewportCache,
            getOriginalImage: () => this.originalImage,
            setOriginalImage: (v) => {
                this.originalImage = v;
            },
            getIsImageLoadedToCanvas: () => this.isImageLoadedToCanvas,
            setIsImageLoadedToCanvas: (v) => {
                this.isImageLoadedToCanvas = v;
            },
            getLastSnapshot: () => this.lastSnapshot,
            setLastSnapshot: (v) => {
                this.lastSnapshot = v;
            },
            getMaskCounter: () => this.maskCounter,
            setMaskCounter: (v) => {
                this.maskCounter = v;
            },
            getCurrentScale: () => this.currentScale,
            setCurrentScale: (v) => {
                this.currentScale = v;
            },
            getCurrentRotation: () => this.currentRotation,
            setCurrentRotation: (v) => {
                this.currentRotation = v;
            },
            getBaseImageScale: () => this.baseImageScale,
            setBaseImageScale: (v) => {
                this.baseImageScale = v;
            },
            getCurrentImageMimeType: () => this.currentImageMimeType,
            setCurrentImageMimeType: (v) => {
                this.currentImageMimeType = v;
            },
            setPlaceholderVisible: (show) => {
                setPlaceholderVisible(this.placeholderElement, this.containerElement, this.options.showPlaceholder ? show : false);
            },
        };
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
        if (this.cropSession &&
            !this.operationGuard.isOwnOperation(token) &&
            !CROP_SESSION_ALLOWED_OPERATIONS.has(operationName)) {
            throw new Error(`[ImageEditor] Cannot run "${operationName}" while crop mode is active.`);
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
        catch {
            return false;
        }
    }
    assertCanQueueAnimation(operationName, options) {
        this.operationGuard.assertCanQueueAnimation(operationName, this.getInternalOperationToken(options));
    }
    isImageLoaded() {
        var _a, _b;
        return !!(this.originalImage &&
            this.originalImage instanceof this.fabricModule.FabricImage &&
            ((_a = this.originalImage.width) !== null && _a !== void 0 ? _a : 0) > 0 &&
            ((_b = this.originalImage.height) !== null && _b !== void 0 ? _b : 0) > 0);
    }
    isBusy() {
        return this.operationGuard.isBusy() || this.animQueue.isBusy() || this.cropSession !== null;
    }
    setLayoutMode(mode) {
        if (!isLayoutMode(mode)) {
            reportWarning(this.options, new TypeError(`[ImageEditor] Unsupported layout mode ${JSON.stringify(mode)}. ` +
                'Expected "fit", "cover", or "expand".'), 'Ignored invalid layout mode.');
            return;
        }
        this.options.layoutMode = mode;
    }
    buildCallbackContext(operation, isInternalOperation = false) {
        return { operation, isInternalOperation };
    }
    getOperationContext(fallback, options) {
        const internal = this.getInternalOperationToken(options);
        const activeOperation = this.operationGuard.activeOperationName();
        if (internal && activeOperation) {
            return this.buildCallbackContext(activeOperation, true);
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
    getMaskCollectionSignature() {
        return this.getMasks()
            .map((mask) => `${mask.maskId}:${mask.maskName}`)
            .join('|');
    }
    getEditorState() {
        const canvasWidth = this.canvas ? this.canvas.getWidth() : 0;
        const canvasHeight = this.canvas ? this.canvas.getHeight() : 0;
        const image = this.getImageInfo();
        return {
            hasImage: image !== null,
            image,
            maskCount: this.getMasks().length,
            currentScale: this.currentScale,
            currentRotation: this.currentRotation,
            isBusy: this.isBusy(),
            isCropMode: this.cropSession !== null,
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
    emitBusyChangeIfChanged(context) {
        const isBusy = this.isBusy();
        if (this.lastEmittedIsBusy === isBusy)
            return;
        this.lastEmittedIsBusy = isBusy;
        this.emitOptionCallback('onBusyChange', [isBusy, context]);
    }
    buildSelection(selected) {
        var _a;
        const selectedMasks = selected.filter(isMaskObject);
        return {
            selectedMask: (_a = selectedMasks[0]) !== null && _a !== void 0 ? _a : null,
            selectedMasks,
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
        var _a, _b;
        object.setCoords();
        const boundingRect = object.getBoundingRect();
        object.set({
            left: ((_a = object.left) !== null && _a !== void 0 ? _a : 0) - boundingRect.left,
            top: ((_b = object.top) !== null && _b !== void 0 ? _b : 0) - boundingRect.top,
        });
        object.setCoords();
        this.canvas.renderAll();
    }
    measureLayoutViewport(scrollbarSize) {
        return this.viewportCache.measure(this.containerElement, {
            width: this.options.canvasWidth,
            height: this.options.canvasHeight,
        }, scrollbarSize);
    }
    updateCanvasSizeToImageBounds() {
        var _a, _b;
        if (!this.originalImage)
            return;
        this.originalImage.setCoords();
        const boundingRect = this.originalImage.getBoundingRect();
        const scrollbarSize = measureScrollbarSize((_b = (_a = this.containerElement) === null || _a === void 0 ? void 0 : _a.ownerDocument) !== null && _b !== void 0 ? _b : null);
        const viewport = this.measureLayoutViewport(scrollbarSize);
        if (this.options.layoutMode === 'fit' || this.options.layoutMode === 'cover') {
            const canvasSize = computeScrollableCanvasSize(boundingRect.width, boundingRect.height, viewport, scrollbarSize);
            this.setCanvasSizePx(canvasSize.width, canvasSize.height);
            return;
        }
        if (boundingRect.width <= viewport.width && boundingRect.height <= viewport.height) {
            this.setCanvasSizePx(viewport.width, viewport.height);
            return;
        }
        this.setCanvasSizePx(Math.max(viewport.width, Math.ceil(boundingRect.width)), Math.max(viewport.height, Math.ceil(boundingRect.height)));
    }
    shouldNormalizeCanvasSizeAfterStateRestore() {
        var _a, _b;
        if (!this.canvas || !this.originalImage)
            return false;
        this.originalImage.setCoords();
        const boundingRect = this.originalImage.getBoundingRect();
        const viewport = this.measureLayoutViewport(measureScrollbarSize((_b = (_a = this.containerElement) === null || _a === void 0 ? void 0 : _a.ownerDocument) !== null && _b !== void 0 ? _b : null));
        const canvasW = Math.ceil(this.canvas.getWidth());
        const canvasH = Math.ceil(this.canvas.getHeight());
        const clipsImage = boundingRect.width > canvasW + LAYOUT_EPSILON ||
            boundingRect.height > canvasH + LAYOUT_EPSILON;
        if (this.options.layoutMode === 'fit' || this.options.layoutMode === 'cover') {
            const staleOverflowWidth = canvasW > viewport.width + LAYOUT_EPSILON &&
                boundingRect.width <= viewport.width + LAYOUT_EPSILON;
            const staleOverflowHeight = canvasH > viewport.height + LAYOUT_EPSILON &&
                boundingRect.height <= viewport.height + LAYOUT_EPSILON;
            return clipsImage || staleOverflowWidth || staleOverflowHeight;
        }
        if (this.options.layoutMode === 'expand') {
            const expectedW = Math.max(viewport.width, Math.ceil(boundingRect.width));
            const expectedH = Math.max(viewport.height, Math.ceil(boundingRect.height));
            return (Math.abs(canvasW - expectedW) > LAYOUT_EPSILON ||
                Math.abs(canvasH - expectedH) > LAYOUT_EPSILON);
        }
        return clipsImage;
    }
    captureImageDisplayGeometry() {
        if (!this.canvas || !this.originalImage)
            return null;
        this.originalImage.setCoords();
        const boundingRect = this.originalImage.getBoundingRect();
        return {
            canvasWidth: this.canvas.getWidth(),
            canvasHeight: this.canvas.getHeight(),
            imageDisplayWidth: Math.max(1, boundingRect.width),
            imageDisplayHeight: Math.max(1, boundingRect.height),
        };
    }
    restoreMergedImageDisplayGeometry(geometry) {
        if (!geometry || !this.canvas || !this.originalImage)
            return;
        this.setCanvasSizePx(geometry.canvasWidth, geometry.canvasHeight);
        const sourceW = Math.max(1, this.originalImage.width || geometry.imageDisplayWidth);
        const sourceH = Math.max(1, this.originalImage.height || geometry.imageDisplayHeight);
        const scale = Math.min(geometry.imageDisplayWidth / sourceW, geometry.imageDisplayHeight / sourceH);
        this.originalImage.set({
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
        this.originalImage.setCoords();
        this.canvas.sendObjectToBack(this.originalImage);
        this.currentScale = 1;
        this.currentRotation = 0;
        this.baseImageScale = scale;
        this.lastSnapshot = this.captureSnapshotInternal();
        this.canvas.renderAll();
    }
    buildTransformContext() {
        return {
            canvas: this.canvas,
            options: this.options,
            guard: this.operationGuard,
            getOriginalImage: () => this.originalImage,
            getCurrentScale: () => this.currentScale,
            setCurrentScale: (n) => {
                this.currentScale = n;
            },
            getCurrentRotation: () => this.currentRotation,
            setCurrentRotation: (n) => {
                this.currentRotation = n;
            },
            getBaseImageScale: () => this.baseImageScale,
            saveCanvasState: () => {
                this.saveStateInternal(this.withAnimationQueueBypass());
            },
            setSuppressSaveState: (suppress) => {
                this.shouldSuppressSaveState = suppress;
            },
            afterTransformSnap: () => {
                if (this.isDisposed || !this.canvas || !this.originalImage)
                    return;
                this.updateCanvasSizeToImageBounds();
                this.alignObjectBoundingBoxToCanvasTopLeft(this.originalImage);
                this.canvas
                    .getObjects()
                    .filter(isMaskObject)
                    .forEach((maskObject) => this.syncMaskLabel(maskObject));
            },
        };
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
                this.updateCanvasSizeToImageBounds();
                this.alignObjectBoundingBoxToCanvasTopLeft(this.originalImage);
            }
            const restoredMasks = restoredState.objects.filter(isMaskObject);
            this.lastMask = restoredMasks.reduce((lastMask, maskObject) => !lastMask || maskObject.maskId > lastMask.maskId ? maskObject : lastMask, null);
            restoredMasks.forEach((maskObject) => {
                applyMaskUnselectedStyle(maskObject);
                reattachMaskHoverHandlers(maskObject);
            });
            this.lastSnapshot = this.captureSnapshotInternal();
            this.canvas.renderAll();
            this.updateInputs();
            this.updateMaskList();
            this.updateUi();
            if (previousImage && previousImage !== this.originalImage) {
                this.emitOptionCallback('onImageCleared', [previousImage, context]);
            }
            if (previousMaskSignature !== this.getMaskCollectionSignature()) {
                this.emitMasksChanged(context);
            }
            this.emitImageChanged(context);
            const activeMaskId = editorState === null || editorState === void 0 ? void 0 : editorState.activeMaskId;
            if (typeof activeMaskId === 'number') {
                const activeMask = restoredMasks.find((maskObject) => maskObject.maskId === activeMaskId);
                if (activeMask) {
                    this.withSelectionChangeContext(context, () => {
                        this.canvas.setActiveObject(activeMask);
                        this.handleSelectionChanged([activeMask]);
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
        var _a, _b;
        if (!this.canvas || this.shouldSuppressSaveState)
            return;
        if (!this.canRunIdleOperation('saveState', options))
            return;
        const activeObj = this.canvas.getActiveObject();
        const activeMask = this.getActiveMaskForSnapshot();
        this.hideAllMaskLabels();
        try {
            const after = saveState({
                canvas: this.canvas,
                activeMaskId: (_a = activeMask === null || activeMask === void 0 ? void 0 : activeMask.maskId) !== null && _a !== void 0 ? _a : null,
                currentScale: this.currentScale,
                currentRotation: this.currentRotation,
                baseImageScale: this.baseImageScale,
                currentImageMimeType: this.currentImageMimeType,
            });
            const before = (_b = this.lastSnapshot) !== null && _b !== void 0 ? _b : after;
            if (after === before) {
                return;
            }
            let executedOnce = false;
            const cmd = new Command(async () => {
                if (executedOnce) {
                    await this.loadFromStateInternal(after, this.withAnimationQueueBypass());
                }
                executedOnce = true;
            }, async () => {
                await this.loadFromStateInternal(before, this.withAnimationQueueBypass());
            });
            this.historyManager.execute(cmd);
            this.lastSnapshot = after;
        }
        catch (error) {
            reportWarning(this.options, error, 'Failed to capture canvas snapshot.');
        }
        finally {
            this.restoreActiveMaskAfterSnapshot(activeObj, activeMask);
            this.updateUi();
        }
    }
    restoreActiveMaskAfterSnapshot(activeObj, activeMask) {
        if (!this.canvas)
            return;
        const maskToRestore = activeObj && isMaskObject(activeObj) ? activeObj : activeMask;
        if (!maskToRestore || !this.canvas.getObjects().includes(maskToRestore))
            return;
        this.canvas.setActiveObject(maskToRestore);
        this.showLabelForMask(maskToRestore);
        this.updateMaskListSelection(maskToRestore);
    }
    undo() {
        if (this.isDisposed)
            return Promise.resolve();
        if (!this.canRunIdleOperation('undo'))
            return Promise.resolve();
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
        return {
            fabric: this.fabricModule,
            canvas: this.canvas,
            options: this.options,
            getLastMask: () => this.lastMask,
            setLastMask: (maskObject) => {
                this.lastMask = maskObject;
            },
            getMaskCounter: () => this.maskCounter,
            setMaskCounter: (n) => {
                this.maskCounter = n;
            },
            updateMaskList: () => {
                this.updateMaskList();
            },
            saveCanvasState: () => {
                this.saveState();
            },
            expandCanvasIfNeeded: (widthPx, heightPx) => {
                this.setCanvasSizePx(widthPx, heightPx);
            },
        };
    }
    buildRemoveMaskContext() {
        return {
            canvas: this.canvas,
            removeLabelForMask: (mask) => {
                this.removeLabelForMask(mask);
            },
            updateMaskList: () => {
                this.updateMaskList();
            },
            saveCanvasState: () => {
                this.saveState();
            },
            setLastMask: (maskObject) => {
                this.lastMask = maskObject;
            },
        };
    }
    buildMaskLabelContext() {
        if (!this.canvas)
            return null;
        return { fabric: this.fabricModule, canvas: this.canvas, options: this.options };
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
    handleSelectionChanged(selected) {
        var _a, _b, _c;
        if (!this.canvas)
            return;
        const selectedMask = (_a = selected.find(isMaskObject)) !== null && _a !== void 0 ? _a : null;
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
        this.canvas.requestRenderAll();
        this.updateUi();
        const context = (_b = this.nextSelectionChangeContext) !== null && _b !== void 0 ? _b : this.buildCallbackContext((_c = this.activeStateRestoreOperation) !== null && _c !== void 0 ? _c : 'createMask', this.activeStateRestoreOperation === 'undo' ||
            this.activeStateRestoreOperation === 'redo');
        this.emitOptionCallback('onSelectionChange', [this.buildSelection(selected), context]);
    }
    buildMaskListContext() {
        return {
            canvas: this.canvas,
            getListElementId: () => this.elements.maskList,
            onMaskSelected: (mask) => this.handleSelectionChanged([mask]),
        };
    }
    updateMaskList() {
        renderMaskList(this.buildMaskListContext());
    }
    updateMaskListSelection(selectedMask) {
        updateMaskListSelection(this.buildMaskListContext(), selectedMask);
    }
    async mergeMasks() {
        if (!this.canvas)
            return;
        if (!this.canRunIdleOperation('mergeMasks'))
            return;
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
            this.emitMasksChanged(callbackContext);
            this.emitImageChanged(callbackContext);
        }
        finally {
            this.operationGuard.endBusyOperation(operationToken);
            this.emitBusyChangeIfChanged(callbackContext);
            this.updateUi();
        }
    }
    downloadImage(fileName) {
        if (!this.canvas)
            return;
        if (!this.canRunIdleOperation('downloadImage'))
            return;
        const callbackContext = this.buildCallbackContext('downloadImage', false);
        const operationToken = this.operationGuard.beginBusyOperation('downloadImage');
        this.emitBusyChangeIfChanged(callbackContext);
        const exportContext = this.buildExportServiceContext();
        try {
            downloadImage(exportContext, fileName);
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
        return {
            fabric: this.fabricModule,
            canvas: this.canvas,
            options: this.options,
            isImageLoaded: () => this.isImageLoaded(),
            getOriginalImage: () => this.originalImage,
        };
    }
    buildMergeMasksContext(operationToken) {
        return {
            ...this.buildExportServiceContext(),
            historyManager: this.historyManager,
            containerElement: this.containerElement,
            loadImage: async (base64, providedOptions) => {
                const geometry = this.captureImageDisplayGeometry();
                await this.loadImage(base64, this.withInternalOperationOptions(operationToken, providedOptions));
                this.restoreMergedImageDisplayGeometry(geometry);
            },
            saveState: () => this.captureSnapshotInternal(),
            loadFromState: (snapshot) => this.loadFromStateInternal(snapshot, this.withInternalOperationOptions(operationToken, this.withAnimationQueueBypass())),
            removeAllMasksNoHistory: () => {
                const context = this.buildRemoveMaskContext();
                removeAllMasks(context, { saveHistory: false });
            },
        };
    }
    captureSnapshotInternal() {
        var _a;
        if (!this.canvas)
            return '';
        const activeMask = this.getActiveMaskForSnapshot();
        this.hideAllMaskLabels();
        return saveState({
            canvas: this.canvas,
            activeMaskId: (_a = activeMask === null || activeMask === void 0 ? void 0 : activeMask.maskId) !== null && _a !== void 0 ? _a : null,
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
        return ((_a = this.canvas
            .getObjects()
            .find((object) => isMaskObject(object) && !!object.labelObject)) !== null && _a !== void 0 ? _a : null);
    }
    enterCropMode() {
        if (!this.canvas || !this.originalImage)
            return;
        if (this.cropSession)
            return;
        if (!this.isImageLoaded())
            return;
        if (!this.canRunIdleOperation('enterCropMode'))
            return;
        const cropControllerContext = this.buildCropControllerContext();
        enterCropMode(cropControllerContext);
        this.updateUi();
        const callbackContext = this.buildCallbackContext('enterCropMode', false);
        this.emitBusyChangeIfChanged(callbackContext);
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
        return {
            fabric: this.fabricModule,
            canvas: this.canvas,
            options: this.options,
            historyManager: this.historyManager,
            isImageLoaded: () => this.isImageLoaded(),
            getOriginalImage: () => this.originalImage,
            getCurrentImageMimeType: () => this.currentImageMimeType,
            getCropSession: () => this.cropSession,
            setCropSession: (s) => {
                this.cropSession = s;
            },
            saveState: () => this.captureSnapshotInternal(),
            loadFromState: (snapshot) => this.loadFromStateInternal(snapshot, this.withInternalOperationOptions(operationToken, this.withAnimationQueueBypass())),
            loadImage: (base64, providedOptions) => this.loadImage(base64, this.withInternalOperationOptions(operationToken, providedOptions)),
            getMaskCounter: () => this.maskCounter,
            setMaskCounter: (n) => {
                this.maskCounter = n;
            },
            updateMaskList: () => {
                this.updateMaskList();
            },
        };
    }
    updateInputs() {
        const scaleId = this.elements.scalePercentageInput;
        if (!scaleId)
            return;
        const scaleInputElement = document.getElementById(scaleId);
        if (scaleInputElement)
            scaleInputElement.value = String(Math.round(this.currentScale * 100));
    }
    updateUi() {
        if (!this.canvas)
            return;
        const hasImage = !!this.originalImage;
        const masks = hasImage ? this.canvas.getObjects().filter(isMaskObject) : [];
        const hasMasks = masks.length > 0;
        const activeObject = this.canvas.getActiveObject();
        const hasSelectedMask = !!(activeObject && isMaskObject(activeObject));
        const isDefaultTransform = this.currentScale === 1 && this.currentRotation === 0;
        const canUndo = this.historyManager.canUndo();
        const canRedo = this.historyManager.canRedo();
        const isInCropMode = this.cropSession !== null;
        const isBusy = this.operationGuard.isBusy() || this.animQueue.isBusy();
        if (isInCropMode) {
            CROP_MODE_CONTROL_KEYS.forEach((key) => {
                this.setControlEnabled(key, !isBusy && CROP_MODE_ENABLED_KEYS.includes(key));
            });
            return;
        }
        this.setControlEnabled('scalePercentageInput', hasImage && !isBusy);
        this.setControlEnabled('rotateLeftDegreesInput', hasImage && !isBusy);
        this.setControlEnabled('rotateRightDegreesInput', hasImage && !isBusy);
        this.setControlEnabled('zoomInButton', hasImage && !isBusy && this.currentScale < this.options.maxScale);
        this.setControlEnabled('zoomOutButton', hasImage && !isBusy && this.currentScale > this.options.minScale);
        this.setControlEnabled('rotateLeftButton', hasImage && !isBusy);
        this.setControlEnabled('rotateRightButton', hasImage && !isBusy);
        this.setControlEnabled('createMaskButton', hasImage && !isBusy);
        this.setControlEnabled('removeSelectedMaskButton', hasSelectedMask && !isBusy);
        this.setControlEnabled('removeAllMasksButton', hasMasks && !isBusy);
        this.setControlEnabled('mergeMasksButton', hasImage && hasMasks && !isBusy);
        this.setControlEnabled('downloadImageButton', hasImage && !isBusy);
        this.setControlEnabled('resetImageTransformButton', hasImage && !isDefaultTransform && !isBusy);
        this.setControlEnabled('undoButton', hasImage && !isBusy && canUndo);
        this.setControlEnabled('redoButton', hasImage && !isBusy && canRedo);
        this.setControlEnabled('enterCropModeButton', hasImage && !isBusy);
        this.setControlEnabled('imageInput', !isBusy);
        this.setControlEnabled('applyCropButton', false);
        this.setControlEnabled('cancelCropButton', false);
    }
    setControlEnabled(key, isEnabled) {
        var _a;
        const id = this.elements[key];
        if (!id)
            return;
        const controlElement = document.getElementById(id);
        if (!controlElement)
            return;
        this.recordElementOriginalState(key, controlElement);
        if ('disabled' in controlElement) {
            controlElement.disabled = !isEnabled;
            return;
        }
        if (!isEnabled) {
            controlElement.setAttribute('aria-disabled', 'true');
            controlElement.style.pointerEvents = 'none';
        }
        else {
            const originalAria = this.elementOriginalAriaDisabledMap.get(key);
            if (originalAria === null || originalAria === undefined) {
                controlElement.removeAttribute('aria-disabled');
            }
            else {
                controlElement.setAttribute('aria-disabled', originalAria);
            }
            controlElement.style.pointerEvents =
                (_a = this.elementOriginalPointerEventsMap.get(key)) !== null && _a !== void 0 ? _a : '';
        }
    }
    recordElementOriginalState(key, element) {
        if (!this.elementOriginalAriaDisabledMap.has(key)) {
            this.elementOriginalAriaDisabledMap.set(key, element.getAttribute('aria-disabled'));
        }
        if (!this.elementOriginalPointerEventsMap.has(key)) {
            this.elementOriginalPointerEventsMap.set(key, element.style.pointerEvents || '');
        }
        if ('disabled' in element && !this.elementOriginalDisabledMap.has(key)) {
            this.elementOriginalDisabledMap.set(key, !!element.disabled);
        }
    }
    restoreElementOriginalStates() {
        var _a, _b;
        for (const key of Object.keys(this.elements)) {
            const id = this.elements[key];
            if (!id)
                continue;
            const element = document.getElementById(id);
            if (!element)
                continue;
            if ('disabled' in element && this.elementOriginalDisabledMap.has(key)) {
                element.disabled =
                    (_a = this.elementOriginalDisabledMap.get(key)) !== null && _a !== void 0 ? _a : false;
            }
            if (this.elementOriginalAriaDisabledMap.has(key)) {
                const originalAria = this.elementOriginalAriaDisabledMap.get(key);
                if (originalAria === null || originalAria === undefined) {
                    element.removeAttribute('aria-disabled');
                }
                else {
                    element.setAttribute('aria-disabled', originalAria);
                }
            }
            if (this.elementOriginalPointerEventsMap.has(key)) {
                element.style.pointerEvents = (_b = this.elementOriginalPointerEventsMap.get(key)) !== null && _b !== void 0 ? _b : '';
            }
        }
        this.elementOriginalDisabledMap.clear();
        this.elementOriginalAriaDisabledMap.clear();
        this.elementOriginalPointerEventsMap.clear();
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
exports.isMaskObject = isMaskObject;
//# sourceMappingURL=index.cjs.map
