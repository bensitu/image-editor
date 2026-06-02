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
            this.queue.push({ fn: animationFn, resolve, reject });
            if (!this.running) {
                void this._process();
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
    async _process() {
        if (this.queue.length === 0) {
            this.running = false;
            return;
        }
        this.running = true;
        const entry = this.queue.shift();
        try {
            await entry.fn();
            entry.resolve();
        }
        catch (error) {
            entry.reject(error);
        }
        void this._process();
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

const DEFAULT_OPTIONS = {
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
    maxExportPixels: 50000000,
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
const DEFAULT_LABEL = {
    getText: (mask) => mask.maskName};
const DEFAULT_CROP = {
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
    'maxExportPixels',
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
function normalizeMaxExportPixels(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0)
        return DEFAULT_OPTIONS.maxExportPixels;
    return Math.max(1, Math.floor(numeric));
}
function resolveOptions(input) {
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
        if (key === 'maxExportPixels') {
            resolved.maxExportPixels = normalizeMaxExportPixels(value);
            continue;
        }
        resolved[key] = value;
    }
    resolved.onImageLoaded = normalizeCallback(raw.onImageLoaded);
    resolved.onError = normalizeCallback(raw.onError);
    resolved.onWarning = normalizeCallback(raw.onWarning);
    resolved.maxHistorySize = normalizeMaxHistorySize(resolved.maxHistorySize);
    resolved.maxExportPixels = normalizeMaxExportPixels(resolved.maxExportPixels);
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

class OperationGuard {
    constructor() {
        Object.defineProperty(this, "_isAnimating", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "_isDisposed", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "_isLoading", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "_activeOperationName", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "_activeOperationToken", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
    }
    isAnimating() {
        return this._isAnimating;
    }
    isDisposed() {
        return this._isDisposed;
    }
    isLoading() {
        return this._isLoading;
    }
    activeOperationName() {
        return this._activeOperationName;
    }
    isBusy() {
        return this._isAnimating || this._isLoading || this._activeOperationToken !== null;
    }
    beginAnimation() {
        this._isAnimating = true;
    }
    endAnimation() {
        this._isAnimating = false;
    }
    markDisposed() {
        this._isDisposed = true;
        this._isAnimating = false;
        this._isLoading = false;
        this._activeOperationName = null;
        this._activeOperationToken = null;
    }
    beginLoading() {
        this._isLoading = true;
    }
    endLoading() {
        this._isLoading = false;
    }
    beginBusyOperation(operationName) {
        const token = Symbol(operationName);
        this._activeOperationName = operationName;
        this._activeOperationToken = token;
        return token;
    }
    endBusyOperation(token) {
        if (token && token === this._activeOperationToken) {
            this._activeOperationName = null;
            this._activeOperationToken = null;
        }
    }
    isOwnOperation(token) {
        return !!token && token === this._activeOperationToken;
    }
    async runAnimation(fn) {
        this.beginAnimation();
        try {
            return await fn();
        }
        finally {
            this.endAnimation();
        }
    }
    assertNotAnimating(operationLabel) {
        if (this._isAnimating) {
            throw new Error(`[ImageEditor] Cannot run "${operationLabel}" while an animation is in progress.`);
        }
    }
    assertIdleForOperation(operationLabel, token) {
        var _a;
        if (this._isDisposed) {
            throw new Error(`[ImageEditor] Cannot run "${operationLabel}" after dispose.`);
        }
        const ownOperation = this.isOwnOperation(token);
        if (this._isAnimating) {
            throw new Error(`[ImageEditor] Cannot run "${operationLabel}" while an animation is in progress.`);
        }
        if (this._isLoading && !ownOperation) {
            throw new Error(`[ImageEditor] Cannot run "${operationLabel}" while an image is loading.`);
        }
        if (this._activeOperationToken && !ownOperation) {
            throw new Error(`[ImageEditor] Cannot run "${operationLabel}" while ` +
                `${(_a = this._activeOperationName) !== null && _a !== void 0 ? _a : 'another operation'} is running.`);
        }
    }
    assertCanQueueAnimation(operationLabel, token) {
        var _a;
        if (this._isDisposed) {
            throw new Error(`[ImageEditor] Cannot run "${operationLabel}" after dispose.`);
        }
        const ownOperation = this.isOwnOperation(token);
        if (this._isLoading && !ownOperation) {
            throw new Error(`[ImageEditor] Cannot run "${operationLabel}" while an image is loading.`);
        }
        if (this._activeOperationToken && !ownOperation) {
            throw new Error(`[ImageEditor] Cannot run "${operationLabel}" while ` +
                `${(_a = this._activeOperationName) !== null && _a !== void 0 ? _a : 'another operation'} is running.`);
        }
    }
}

function isMaskObject(obj) {
    return 'maskId' in obj && typeof obj.maskId === 'number';
}

const SNAPSHOT_CUSTOM_KEYS = [
    'maskId',
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
function saveState(input) {
    var _a, _b;
    const { canvas, currentScale, currentRotation, baseImageScale } = input;
    const activeObject = (_b = (_a = canvas).getActiveObject) === null || _b === void 0 ? void 0 : _b.call(_a);
    const activeMaskId = activeObject && isMaskObject(activeObject)
        ? activeObject.maskId
        : typeof input.activeMaskId === 'number'
            ? input.activeMaskId
            : null;
    canvas.discardActiveObject();
    const jsonObj = canvas.toJSON(SNAPSHOT_CUSTOM_KEYS);
    copySnapshotCustomPropsFromCanvas(canvas.getObjects(), jsonObj.objects);
    if (Array.isArray(jsonObj.objects)) {
        jsonObj.objects = jsonObj.objects.filter((o) => o.isCropRect !== true && o.maskLabel !== true);
    }
    jsonObj._editorState = {
        currentScale,
        currentRotation,
        baseImageScale,
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
    restoreMaskPropsFromJSON(objects, (_a = json.objects) !== null && _a !== void 0 ? _a : []);
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
function restoreMaskPropsFromJSON(canvasObjs, jsonObjs) {
    var _a, _b, _c, _d, _e;
    const consumedCanvasIndexes = new Set();
    for (const jObj of jsonObjs) {
        if (typeof jObj.maskId !== 'number')
            continue;
        const jType = String((_a = jObj.type) !== null && _a !== void 0 ? _a : '');
        const jLeft = Number((_b = jObj.left) !== null && _b !== void 0 ? _b : 0);
        const jTop = Number((_c = jObj.top) !== null && _c !== void 0 ? _c : 0);
        const matchIndex = canvasObjs.findIndex((o, index) => {
            var _a, _b;
            if (consumedCanvasIndexes.has(index))
                return false;
            if (jType && o.type !== jType)
                return false;
            return Math.abs(((_a = o.left) !== null && _a !== void 0 ? _a : 0) - jLeft) < 0.5 && Math.abs(((_b = o.top) !== null && _b !== void 0 ? _b : 0) - jTop) < 0.5;
        });
        if (matchIndex < 0)
            continue;
        consumedCanvasIndexes.add(matchIndex);
        const match = canvasObjs[matchIndex];
        const maskObject = match;
        maskObject.maskId = jObj.maskId;
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
    jsonObjs.forEach((jObj, idx) => {
        if (jObj.maskLabel !== true)
            return;
        const canvasObj = canvasObjs[idx];
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
        Object.defineProperty(this, "_processing", {
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
        this._pushAndTrim(command);
    }
    push(command) {
        this._pushAndTrim(command);
    }
    canUndo() {
        return this.currentIndex >= 0;
    }
    canRedo() {
        return this.currentIndex < this.history.length - 1;
    }
    async undo() {
        if (this._processing || !this.canUndo())
            return;
        this._processing = true;
        try {
            const cmd = this.history[this.currentIndex];
            if (!cmd)
                return;
            await cmd.undo();
            this.currentIndex--;
        }
        finally {
            this._processing = false;
        }
    }
    async redo() {
        if (this._processing || !this.canRedo())
            return;
        this._processing = true;
        try {
            const cmd = this.history[this.currentIndex + 1];
            if (!cmd)
                return;
            await cmd.execute();
            this.currentIndex++;
        }
        finally {
            this._processing = false;
        }
    }
    _pushAndTrim(command) {
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
            _fabricLoaded: true,
            options: maybeOptions !== null && maybeOptions !== void 0 ? maybeOptions : {},
        };
    }
    const options = (_a = fabricOrOptions) !== null && _a !== void 0 ? _a : {};
    const globalFabric = readGlobalFabric(globalScope);
    if (looksLikeFabricModule(globalFabric)) {
        return {
            fabric: globalFabric,
            _fabricLoaded: true,
            options,
        };
    }
    console.error('[ImageEditor] fabric.js v7 is not available. ' +
        'Pass it as the first constructor argument (ESM) or ' +
        'load it as a global <script> before instantiation.');
    return {
        fabric: null,
        _fabricLoaded: false,
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
    tagged.__imageEditorMaskHandlers = { mouseover, mouseout };
}
function reattachMaskHoverHandlers(mask) {
    var _a;
    const tagged = mask;
    if (tagged.__imageEditorMaskHandlers) {
        try {
            tagged.off('mouseover', tagged.__imageEditorMaskHandlers.mouseover);
            tagged.off('mouseout', tagged.__imageEditorMaskHandlers.mouseout);
        }
        catch {
        }
        delete tagged.__imageEditorMaskHandlers;
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
    if (!tagged.__imageEditorMaskHandlers)
        return;
    try {
        tagged.off('mouseover', tagged.__imageEditorMaskHandlers.mouseover);
        tagged.off('mouseout', tagged.__imageEditorMaskHandlers.mouseout);
    }
    catch {
    }
    delete tagged.__imageEditorMaskHandlers;
}
function captureMaskStyleBackup(mask) {
    var _a, _b, _c, _d, _e, _f;
    return {
        obj: mask,
        opacity: (_a = mask.opacity) !== null && _a !== void 0 ? _a : 1,
        fill: ((_b = mask.fill) !== null && _b !== void 0 ? _b : null),
        strokeWidth: (_c = mask.strokeWidth) !== null && _c !== void 0 ? _c : 0,
        stroke: ((_d = mask.stroke) !== null && _d !== void 0 ? _d : null),
        selectable: (_e = mask.selectable) !== null && _e !== void 0 ? _e : true,
        lockRotation: (_f = mask.lockRotation) !== null && _f !== void 0 ? _f : false,
    };
}
function restoreMaskStyleBackup(backup) {
    try {
        backup.obj.set({
            opacity: backup.opacity,
            fill: backup.fill,
            strokeWidth: backup.strokeWidth,
            stroke: backup.stroke,
            selectable: backup.selectable,
            lockRotation: backup.lockRotation,
        });
        if (typeof backup.obj.setCoords === 'function') {
            backup.obj.setCoords();
        }
    }
    catch {
    }
}
async function withMaskStyleBackup(ctx, mutator, callback) {
    if (!ctx.canvas)
        return await callback();
    const masks = ctx.canvas.getObjects().filter(isMaskObject);
    const backups = masks.map(captureMaskStyleBackup);
    try {
        masks.forEach((mask, idx) => mutator(mask, idx));
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
function getObjectBBox(obj) {
    obj.setCoords();
    const br = obj.getBoundingRect();
    return { left: br.left, top: br.top, width: br.width, height: br.height };
}

const CROP_RECT_FILL = 'rgba(0,0,0,0.12)';
const CROP_RECT_STROKE = '#00aaff';
const CROP_RECT_DASH = [6, 4];
const CROP_RECT_CORNER_SIZE = 8;
const CROP_DEFAULT_PADDING = 10;
const CROPPED_EXPORT_FORMAT = 'jpeg';
const CROPPED_EXPORT_QUALITY_FALLBACK = 0.92;
function clampQuality$1(quality) {
    const num = Number(quality);
    if (!Number.isFinite(num))
        return CROPPED_EXPORT_QUALITY_FALLBACK;
    return Math.max(0, Math.min(1, num));
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
function removeCropRect(ctx, session) {
    for (const targetHandlers of session.handlers) {
        for (const rec of targetHandlers.handlers) {
            try {
                targetHandlers.target.off(rec.evt, rec.fn);
            }
            catch {
            }
        }
    }
    session.handlers = [];
    if (session.cropRect) {
        try {
            ctx.canvas.remove(session.cropRect);
        }
        catch {
        }
        session.cropRect = null;
    }
}
function restoreCropObjectState(session) {
    for (const rec of session.prevEvented) {
        try {
            rec.obj.set({ evented: rec.evented, selectable: rec.selectable });
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
function teardownSession(ctx, session) {
    removeCropRect(ctx, session);
    restoreCropObjectState(session);
    restoreCropMaskBackups(session);
    try {
        ctx.canvas.selection = !!session.prevSelection;
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
function capturePreservedMasks(canvas, cropRegion) {
    const records = [];
    const masks = canvas.getObjects().filter(isMaskObject);
    for (const mask of masks) {
        try {
            mask.setCoords();
            const intersects = maskIntersectsRegion(mask, cropRegion);
            if (intersects) {
                records.push({
                    mask,
                    left: Number(mask.left) || 0,
                    top: Number(mask.top) || 0,
                    angle: Number(mask.angle) || 0,
                    scaleX: Number(mask.scaleX) || 1,
                    scaleY: Number(mask.scaleY) || 1,
                });
            }
            canvas.remove(mask);
        }
        catch {
        }
    }
    return records;
}
function reapplyPreservedMasks(ctx, cropRegion, records) {
    var _a;
    if (records.length === 0)
        return;
    const { canvas } = ctx;
    let maxRestoredId = 0;
    for (const record of records) {
        try {
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
            attachMaskHoverHandlers(record.mask);
            const id = Number(record.mask.maskId);
            if (Number.isFinite(id) && id > maxRestoredId)
                maxRestoredId = id;
        }
        catch {
        }
    }
    if (typeof ctx.getMaskCounter === 'function' && typeof ctx.setMaskCounter === 'function') {
        const liveCounter = Number(ctx.getMaskCounter());
        const safeCounter = Number.isFinite(liveCounter) ? liveCounter : 0;
        ctx.setMaskCounter(Math.max(safeCounter, maxRestoredId));
    }
    try {
        (_a = ctx.updateMaskList) === null || _a === void 0 ? void 0 : _a.call(ctx);
    }
    catch {
    }
}
function enterCropMode(ctx) {
    const { canvas, options } = ctx;
    if (ctx.getCropSession())
        return;
    const originalImage = ctx.getOriginalImage();
    if (!originalImage)
        return;
    if (!ctx.isImageLoaded())
        return;
    canvas.discardActiveObject();
    const beforeJson = ctx.saveState();
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
    const cropRect = new ctx.fabric.Rect({
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
        canvas.getObjects().forEach((obj) => {
            if (obj === cropRect)
                return;
            if (!isMaskObject(obj))
                return;
            maskBackups.push(captureMaskStyleBackup(obj));
        });
    }
    const prevEvented = [];
    canvas.getObjects().forEach((obj) => {
        var _a, _b;
        if (obj === cropRect)
            return;
        prevEvented.push({
            obj,
            evented: (_a = obj.evented) !== null && _a !== void 0 ? _a : true,
            selectable: (_b = obj.selectable) !== null && _b !== void 0 ? _b : true,
        });
        try {
            obj.set({ evented: false, selectable: false });
        }
        catch {
        }
    });
    if (hideMasks) {
        for (const backup of maskBackups) {
            applyCropHideMaskStyle(backup.obj);
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
                    { evt: 'modified', fn: handleCropRectModified },
                    { evt: 'moving', fn: handleCropRectModified },
                    { evt: 'scaling', fn: handleCropRectModified },
                ],
            },
        ],
    };
    ctx.setCropSession(session);
    canvas.renderAll();
}
function cancelCrop(ctx) {
    const session = ctx.getCropSession();
    if (!session)
        return;
    ctx.canvas.discardActiveObject();
    teardownSession(ctx, session);
    ctx.setCropSession(null);
    try {
        ctx.canvas.renderAll();
    }
    catch {
    }
}
async function applyCrop(ctx) {
    const session = ctx.getCropSession();
    if (!session || !session.cropRect)
        return;
    const { canvas } = ctx;
    canvas.discardActiveObject();
    const beforeJson = session.beforeJson;
    const cropRect = session.cropRect;
    const preserveMasks = !!ctx.options.crop.preserveMasksAfterCrop;
    try {
        cropRect.setCoords();
        const cropAngle = Number(cropRect.angle) || 0;
        if (!ctx.options.crop.allowRotationOfCropRect && Math.abs(cropAngle % 360) > 0.01) {
            throw new CropApplyError('applyCrop failed: rotated crop rectangles are disabled.');
        }
        const rectBounds = getCropRectContentBounds(cropRect);
        const cropRegion = getClampedCanvasRegion(rectBounds, canvas.getWidth(), canvas.getHeight(), { includePartialPixels: false });
        const preservedRecords = preserveMasks
            ? capturePreservedMasks(canvas, cropRegion)
            : [];
        restoreCropObjectState(session);
        removeCropRect(ctx, session);
        canvas.selection = !!session.prevSelection;
        const quality = clampQuality$1(ctx.options.downsampleQuality);
        const exportOptions = {
            format: CROPPED_EXPORT_FORMAT,
            quality,
            multiplier: 1,
            left: cropRegion.left,
            top: cropRegion.top,
            width: cropRegion.width,
            height: cropRegion.height,
        };
        const croppedBase64 = canvas.toDataURL(exportOptions);
        await ctx.loadImage(croppedBase64);
        if (preservedRecords.length > 0) {
            reapplyPreservedMasks(ctx, cropRegion, preservedRecords);
            canvas.renderAll();
        }
        const afterJson = ctx.saveState();
        ctx.setCropSession(null);
        if (beforeJson && afterJson && beforeJson !== afterJson) {
            ctx.historyManager.push(new Command(() => ctx.loadFromState(afterJson), () => ctx.loadFromState(beforeJson)));
        }
    }
    catch (error) {
        teardownSession(ctx, session);
        ctx.setCropSession(null);
        try {
            await ctx.loadFromState(beforeJson);
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
    const key = String(input || 'jpeg').toLowerCase();
    if (Object.prototype.hasOwnProperty.call(FORMAT_ALIAS_TABLE, key)) {
        return (_a = FORMAT_ALIAS_TABLE[key]) !== null && _a !== void 0 ? _a : 'jpeg';
    }
    return 'jpeg';
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
    const opts = options !== null && options !== void 0 ? options : {};
    const fileType = opts.fileType;
    const formatAlias = opts.format;
    const requested = fileType || formatAlias;
    const format = normalizeImageFormat(requested);
    const mimeType = mimeTypeFor(format);
    if (format === 'png') {
        return { format, mimeType, quality: undefined };
    }
    const rawQuality = (_a = opts.quality) !== null && _a !== void 0 ? _a : downsampleQuality;
    const quality = clampQuality(rawQuality, downsampleQuality);
    return { format, mimeType, quality };
}

function resolveMultiplier(requested, fallback) {
    const num = Number(requested);
    if (Number.isFinite(num) && num > 0)
        return num;
    const fb = Number(fallback);
    return Number.isFinite(fb) && fb > 0 ? fb : 1;
}
function readCanvasDimension(canvas, getterName, propertyName) {
    const canvasLike = canvas;
    const getter = canvasLike[getterName];
    const value = typeof getter === 'function' ? getter.call(canvasLike) : canvasLike[propertyName];
    return Math.max(1, Math.ceil(Number.isFinite(value) ? Number(value) : 1));
}
function assertExportPixelBudget(ctx, multiplier, region) {
    var _a, _b;
    const sourceWidth = (_a = region === null || region === void 0 ? void 0 : region.width) !== null && _a !== void 0 ? _a : readCanvasDimension(ctx.canvas, 'getWidth', 'width');
    const sourceHeight = (_b = region === null || region === void 0 ? void 0 : region.height) !== null && _b !== void 0 ? _b : readCanvasDimension(ctx.canvas, 'getHeight', 'height');
    const outputWidth = Math.max(1, Math.ceil(sourceWidth * multiplier));
    const outputHeight = Math.max(1, Math.ceil(sourceHeight * multiplier));
    const pixelCount = outputWidth * outputHeight;
    const maxPixels = ctx.options.maxExportPixels;
    if (!Number.isFinite(pixelCount) || pixelCount > maxPixels) {
        throw new RangeError(`[ImageEditor] Export size ${outputWidth}x${outputHeight} ` +
            `(${pixelCount} pixels) exceeds maxExportPixels (${maxPixels}).`);
    }
}
function computeExportRegion(ctx, exportImageArea) {
    if (!exportImageArea)
        return { region: null, partialEdges: null };
    const originalImage = ctx.getOriginalImage();
    if (!originalImage)
        return { region: null, partialEdges: null };
    const bounds = getObjectBBox(originalImage);
    const canvasLike = ctx.canvas;
    const canvasWidth = typeof canvasLike.getWidth === 'function' ? canvasLike.getWidth() : canvasLike.width;
    const canvasHeight = typeof canvasLike.getHeight === 'function' ? canvasLike.getHeight() : canvasLike.height;
    return {
        region: getClampedCanvasRegion(bounds, canvasWidth, canvasHeight, {
            includePartialPixels: true,
        }),
        partialEdges: getPartialExportEdges(bounds, Number(originalImage.angle) || 0),
    };
}
async function bakeMasksForExport(ctx, exportImageArea, fn) {
    if (!exportImageArea)
        return fn();
    return withMaskStyleBackup({ canvas: ctx.canvas, options: ctx.options }, applyExportBakeInStyle, fn);
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
        const label = object.__label;
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
            backup.mask.__label = backup.label;
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
function renderCanvasToDataURL(canvas, format, quality, multiplier, region) {
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
        const img = new Image();
        img.crossOrigin = 'anonymous';
        const cleanup = () => {
            if (typeof img.removeEventListener === 'function') {
                img.removeEventListener('load', handleLoad);
                img.removeEventListener('error', handleError);
            }
            else {
                img.onload = null;
                img.onerror = null;
            }
        };
        const handleLoad = () => {
            cleanup();
            resolve(img);
        };
        const handleError = () => {
            cleanup();
            reject(new Error('Failed to decode export data URL'));
        };
        if (typeof img.addEventListener === 'function') {
            img.addEventListener('load', handleLoad, { once: true });
            img.addEventListener('error', handleError, { once: true });
        }
        else {
            img.onload = handleLoad;
            img.onerror = handleError;
        }
        img.src = dataUrl;
    });
}
async function sealPartialTransparentEdges(dataUrl, edges) {
    if (!hasPartialEdges(edges))
        return dataUrl;
    const imageElement = await loadImageElement(dataUrl);
    const { width, height } = getImageDimensions(imageElement);
    const off = document.createElement('canvas');
    off.width = width;
    off.height = height;
    const ctx2d = off.getContext('2d');
    if (!ctx2d)
        throw new Error('2D canvas context is unavailable');
    ctx2d.drawImage(imageElement, 0, 0, width, height);
    const imageData = ctx2d.getImageData(0, 0, width, height);
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
    ctx2d.putImageData(imageData, 0, 0);
    return off.toDataURL('image/png');
}
function getJpegBackgroundColor(backgroundColor) {
    const value = String(backgroundColor !== null && backgroundColor !== void 0 ? backgroundColor : '').trim();
    if (!value || isTransparentCssColor(value))
        return '#ffffff';
    return value;
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
    const slashAlpha = normalized.match(/^(?:rgb|rgba|hsl|hsla)\([^/]+\/\s*([^)]+)\)$/i);
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
    const off = document.createElement('canvas');
    off.width = width;
    off.height = height;
    const ctx2d = off.getContext('2d');
    if (!ctx2d)
        throw new Error('2D canvas context is unavailable');
    ctx2d.fillStyle = getJpegBackgroundColor(backgroundColor);
    ctx2d.fillRect(0, 0, width, height);
    ctx2d.drawImage(imageElement, 0, 0, width, height);
    return off.toDataURL('image/jpeg', quality);
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
function reencodeDataUrlAs(sourceDataUrl, target, backgroundColor) {
    if (sourceDataUrl.startsWith(`data:${target.mimeType}`)) {
        return Promise.resolve(sourceDataUrl);
    }
    return loadImageElement(sourceDataUrl).then((img) => {
        const { width, height } = getImageDimensions(img);
        const off = document.createElement('canvas');
        off.width = width;
        off.height = height;
        const ctx2d = off.getContext('2d');
        if (!ctx2d)
            throw new Error('Unable to acquire 2D context for export conversion');
        if (target.format === 'jpeg') {
            ctx2d.fillStyle = getJpegBackgroundColor(backgroundColor);
            ctx2d.fillRect(0, 0, width, height);
        }
        ctx2d.drawImage(img, 0, 0, width, height);
        return off.toDataURL(target.mimeType, target.quality);
    });
}
function warnNoImageLoaded(operation) {
    console.warn(`[ImageEditor] ${operation} skipped: no image is loaded on the canvas.`);
}
async function exportImageBase64(ctx, options) {
    if (!ctx.isImageLoaded()) {
        warnNoImageLoaded('exportImageBase64');
        return '';
    }
    const opts = options !== null && options !== void 0 ? options : {};
    const exportImageArea = typeof opts.exportImageArea === 'boolean'
        ? opts.exportImageArea
        : ctx.options.exportImageAreaByDefault;
    const activeObject = captureActiveObject(ctx.canvas);
    const labelBackups = captureMaskLabelBackups(ctx.canvas);
    try {
        ctx.canvas.discardActiveObject();
        const resolved = resolveExportFormat(opts, ctx.options.downsampleQuality);
        const multiplier = resolveMultiplier(opts.multiplier, ctx.options.exportMultiplier);
        const { region, partialEdges } = computeExportRegion(ctx, exportImageArea);
        assertExportPixelBudget(ctx, multiplier, region);
        const renderFormat = region && resolved.format === 'jpeg' ? 'png' : resolved.format;
        const renderQuality = renderFormat === 'png' ? undefined : resolved.quality;
        let dataUrl = await bakeMasksForExport(ctx, exportImageArea, async () => renderCanvasToDataURL(ctx.canvas, renderFormat, renderQuality, multiplier, region));
        if (region) {
            dataUrl = await sealPartialTransparentEdges(dataUrl, partialEdges);
            if (resolved.format === 'jpeg') {
                dataUrl = await convertDataUrlToOpaqueJpeg(dataUrl, ctx.options.backgroundColor, resolved.quality);
            }
        }
        return dataUrl;
    }
    finally {
        restoreMaskLabelBackups(ctx.canvas, labelBackups);
        restoreActiveObject(ctx.canvas, activeObject);
        requestRender(ctx.canvas);
    }
}
async function exportImageFile(ctx, options) {
    var _a;
    if (!ctx.isImageLoaded()) {
        warnNoImageLoaded('exportImageFile');
        throw new ExportNotReadyError('exportImageFile');
    }
    const opts = options !== null && options !== void 0 ? options : {};
    const mergeMask = opts.mergeMask !== false;
    const fileName = (_a = opts.fileName) !== null && _a !== void 0 ? _a : ctx.options.defaultDownloadFileName;
    const resolved = resolveExportFormat(opts, ctx.options.downsampleQuality);
    const base64 = await exportImageBase64(ctx, {
        exportImageArea: mergeMask,
        multiplier: opts.multiplier,
        quality: opts.quality,
        fileType: opts.fileType,
    });
    if (!base64) {
        throw new ExportNotReadyError('exportImageFile');
    }
    const finalDataUrl = await reencodeDataUrlAs(base64, resolved, ctx.options.backgroundColor);
    const bytes = dataUrlToBytes(finalDataUrl);
    return new File([bytes], fileName, { type: resolved.mimeType });
}
function downloadImage(ctx, fileName) {
    if (!ctx.isImageLoaded()) {
        warnNoImageLoaded('downloadImage');
        return;
    }
    const resolvedFileName = fileName !== null && fileName !== void 0 ? fileName : ctx.options.defaultDownloadFileName;
    void exportImageBase64(ctx, {
        exportImageArea: ctx.options.exportImageAreaByDefault,
        multiplier: ctx.options.exportMultiplier,
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
        console.error('[ImageEditor] downloadImage failed', error);
    });
}
async function mergeMasks(ctx) {
    if (!ctx.isImageLoaded())
        return;
    const masks = ctx.canvas
        .getObjects()
        .filter((o) => 'maskId' in o && typeof o.maskId === 'number');
    if (masks.length === 0)
        return;
    const beforeSnapshot = ctx.saveState();
    ctx.canvas.discardActiveObject();
    ctx.canvas.renderAll();
    const preScrollTop = ctx.containerElement ? ctx.containerElement.scrollTop : null;
    const preScrollLeft = ctx.containerElement ? ctx.containerElement.scrollLeft : null;
    try {
        const merged = await exportImageBase64(ctx, {
            exportImageArea: true,
            multiplier: ctx.options.exportMultiplier,
            fileType: 'png',
        });
        if (!merged) {
            throw new MergeMasksError('mergeMasks: exportImageBase64 returned an empty data URL.');
        }
        ctx.removeAllMasksNoHistory();
        await ctx.loadImage(merged, { preserveScroll: true });
        const afterSnapshot = ctx.saveState();
        if (ctx.containerElement) {
            try {
                if (preScrollTop !== null) {
                    ctx.containerElement.scrollTop = preScrollTop;
                }
                if (preScrollLeft !== null) {
                    ctx.containerElement.scrollLeft = preScrollLeft;
                }
            }
            catch (scrollError) {
                console.warn('[ImageEditor] mergeMasks: scroll restore failed', scrollError);
            }
        }
        if (beforeSnapshot && afterSnapshot && beforeSnapshot !== afterSnapshot) {
            ctx.historyManager.push(new Command(() => ctx.loadFromState(afterSnapshot), () => ctx.loadFromState(beforeSnapshot)));
        }
    }
    catch (error) {
        try {
            await ctx.loadFromState(beforeSnapshot);
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

function forceReflow(el) {
    if (!el)
        return;
    void el.offsetWidth;
}

function selectLayoutStrategy(options) {
    if (options.fitImageToCanvas)
        return 'fit';
    if (options.coverImageToCanvas)
        return 'cover';
    return 'expand';
}
function detectLayoutConflict(options) {
    if (!options.fitImageToCanvas || !options.coverImageToCanvas)
        return null;
    const enabled = ['fit', 'cover'];
    if (options.expandCanvasToImage)
        enabled.push('expand');
    const selected = selectLayoutStrategy(options);
    return {
        enabled,
        selected,
        message: `Layout flags ${enabled.map((s) => `\`${s}\``).join(', ')} are enabled simultaneously. ` +
            `Using precedence \`fit > cover > expand\`; selected \`${selected}\`.`,
    };
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
function computeExpandLayout(imageWidth, imageHeight, _optionsCanvasWidth, _optionsCanvasHeight, containerSize) {
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
function resampleImage(imgEl, maxWidth, maxHeight, sourceMime, preserveSourceFormat, downsampleMimeType, quality) {
    const { width, height } = computeDownsampleDimensions(imgEl.naturalWidth, imgEl.naturalHeight, maxWidth, maxHeight);
    const mimeType = selectDownsampleMimeType(sourceMime, preserveSourceFormat, downsampleMimeType);
    const oc = document.createElement('canvas');
    oc.width = width;
    oc.height = height;
    const ctx = oc.getContext('2d');
    if (!ctx) {
        throw new DownsampleError('Failed to obtain a 2D context for downsampling.');
    }
    ctx.drawImage(imgEl, 0, 0, imgEl.naturalWidth, imgEl.naturalHeight, 0, 0, width, height);
    const dataUrl = mimeType === 'image/png' ? oc.toDataURL(mimeType) : oc.toDataURL(mimeType, quality);
    return { dataUrl, width, height, mimeType };
}

async function loadImage(ctx, imageBase64, loadOptions = {}) {
    if (typeof imageBase64 !== 'string' || !imageBase64.startsWith('data:image/')) {
        return;
    }
    const placeholderHidden = ctx.placeholderElement ? !!ctx.placeholderElement.hidden : null;
    const containerScrollTop = ctx.containerElement ? ctx.containerElement.scrollTop : null;
    const containerScrollLeft = ctx.containerElement ? ctx.containerElement.scrollLeft : null;
    const containerOverflow = ctx.containerElement ? ctx.containerElement.style.overflow : null;
    const bundle = {
        placeholderHidden,
        containerScrollTop,
        containerScrollLeft,
        containerOverflow,
        originalImage: ctx.getOriginalImage(),
        isImageLoadedToCanvas: ctx.getIsImageLoadedToCanvas(),
        lastSnapshot: ctx.getLastSnapshot(),
        canvasJson: serializeCanvas(ctx.canvas),
        maskCounter: ctx.getMaskCounter(),
        currentScale: ctx.getCurrentScale(),
        currentRotation: ctx.getCurrentRotation(),
        baseImageScale: ctx.getBaseImageScale(),
    };
    try {
        ctx.setPlaceholderVisible(false);
        const decode = startImageDecode(imageBase64);
        let imgEl;
        try {
            imgEl = await withTimeout(decode.promise, ctx.options.imageLoadTimeoutMs, 'image decode');
        }
        catch (error) {
            decode.cleanup(true);
            throw error;
        }
        const loadSrc = maybeDownsample(imgEl, imageBase64, ctx.options);
        const fimg = await withTimeout(ctx.fabric.FabricImage.fromURL(loadSrc, { crossOrigin: 'anonymous' }), ctx.options.imageLoadTimeoutMs, 'FabricImage.fromURL');
        ctx.canvas.discardActiveObject();
        ctx.canvas.clear();
        ctx.canvas.backgroundColor = ctx.options.backgroundColor;
        fimg.set({
            originX: 'left',
            originY: 'top',
            selectable: false,
            evented: false,
        });
        const layout = computeLayout(ctx, fimg);
        applyCanvasDimensions(ctx.canvas, layout.canvasWidth, layout.canvasHeight, ctx.containerElement);
        fimg.set({ left: layout.imageLeft, top: layout.imageTop });
        fimg.scale(layout.imageScale);
        ctx.canvas.add(fimg);
        ctx.canvas.sendObjectToBack(fimg);
        ctx.setOriginalImage(fimg);
        ctx.setBaseImageScale(layout.baseImageScale);
        ctx.setCurrentScale(1);
        ctx.setCurrentRotation(0);
        ctx.setMaskCounter(0);
        ctx.setIsImageLoadedToCanvas(true);
        ctx.canvas.renderAll();
        ctx.setLastSnapshot(saveState({
            canvas: ctx.canvas,
            currentScale: 1,
            currentRotation: 0,
            baseImageScale: layout.baseImageScale,
        }));
        if (loadOptions.preserveScroll === true && ctx.containerElement) {
            try {
                if (bundle.containerScrollTop !== null) {
                    ctx.containerElement.scrollTop = bundle.containerScrollTop;
                }
                if (bundle.containerScrollLeft !== null) {
                    ctx.containerElement.scrollLeft = bundle.containerScrollLeft;
                }
            }
            catch (error) {
                console.warn('[ImageEditor] preserveScroll restore failed', error);
            }
        }
        const imageLoadedCallback = ctx.options.onImageLoaded;
        if (typeof imageLoadedCallback === 'function') {
            try {
                imageLoadedCallback();
            }
            catch (error) {
                console.error('[ImageEditor] onImageLoaded callback threw', error);
            }
        }
    }
    catch (error) {
        await replayRollback(ctx, bundle);
        const errorMessage = error instanceof Error ? `loadImage failed: ${error.message}` : 'loadImage failed';
        reportError(ctx.options, error, errorMessage);
        throw error;
    }
}
function startImageDecode(dataUrl) {
    const img = new Image();
    const cleanup = (clearSource = false) => {
        if (typeof img.removeEventListener === 'function') {
            img.removeEventListener('load', handleLoad);
            img.removeEventListener('error', handleError);
        }
        else {
            img.onload = null;
            img.onerror = null;
        }
        if (clearSource) {
            img.src = '';
        }
    };
    const handleLoad = () => {
        if (!hasNaturalImageDimensions(img)) {
            cleanup(true);
            rejectImage(new ImageDecodeError('Failed to decode image data URL: image has no natural dimensions.', null));
            return;
        }
        cleanup(false);
        resolveImage(img);
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
        if (typeof img.addEventListener === 'function') {
            img.addEventListener('load', handleLoad, { once: true });
            img.addEventListener('error', handleError, { once: true });
        }
        else {
            img.onload = handleLoad;
            img.onerror = handleError;
        }
        img.src = dataUrl;
    });
    return { promise, cleanup };
}
function hasNaturalImageDimensions(img) {
    return (Number.isFinite(img.naturalWidth) &&
        Number.isFinite(img.naturalHeight) &&
        img.naturalWidth > 0 &&
        img.naturalHeight > 0);
}
function isPositiveFinite(value) {
    return Number.isFinite(value) && value > 0;
}
function maybeDownsample(imgEl, originalDataUrl, options) {
    if (!options.downsampleOnLoad)
        return originalDataUrl;
    if (!isPositiveFinite(options.downsampleMaxWidth) ||
        !isPositiveFinite(options.downsampleMaxHeight)) {
        reportWarning(options, null, 'loadImage skipped downsampling because downsample bounds are invalid.');
        return originalDataUrl;
    }
    const dims = computeDownsampleDimensions(imgEl.naturalWidth, imgEl.naturalHeight, options.downsampleMaxWidth, options.downsampleMaxHeight);
    if (!dims.needsResize)
        return originalDataUrl;
    const sourceMime = detectSourceMimeType(originalDataUrl);
    return resampleImage(imgEl, options.downsampleMaxWidth, options.downsampleMaxHeight, sourceMime, options.preserveSourceFormat, options.downsampleMimeType, options.downsampleQuality).dataUrl;
}
function computeLayout(ctx, fimg) {
    var _a, _b, _c, _d;
    const imgW = (_a = fimg.width) !== null && _a !== void 0 ? _a : 0;
    const imgH = (_b = fimg.height) !== null && _b !== void 0 ? _b : 0;
    const scrollbarSize = measureScrollbarSize((_d = (_c = ctx.containerElement) === null || _c === void 0 ? void 0 : _c.ownerDocument) !== null && _d !== void 0 ? _d : null);
    const viewport = ctx.viewportCache.measure(ctx.containerElement, {
        width: ctx.options.canvasWidth,
        height: ctx.options.canvasHeight,
    }, scrollbarSize);
    const strategy = selectLayoutStrategy(ctx.options);
    if (strategy === 'fit') {
        return computeFitLayout(imgW, imgH, ctx.options.canvasWidth, ctx.options.canvasHeight, viewport);
    }
    if (strategy === 'cover') {
        return computeCoverLayout(imgW, imgH, ctx.options.canvasWidth, ctx.options.canvasHeight, viewport, scrollbarSize);
    }
    return computeExpandLayout(imgW, imgH, ctx.options.canvasWidth, ctx.options.canvasHeight, viewport);
}
function serializeCanvas(canvas) {
    canvas.discardActiveObject();
    const json = canvas.toJSON(SNAPSHOT_CUSTOM_KEYS);
    return JSON.stringify(json);
}
async function replayRollback(ctx, bundle) {
    if (ctx.containerElement && bundle.containerOverflow !== null) {
        try {
            ctx.containerElement.style.overflow = bundle.containerOverflow;
        }
        catch (rollbackError) {
            console.warn('[ImageEditor] rollback: overflow restore failed', rollbackError);
        }
    }
    try {
        await ctx.canvas.loadFromJSON(JSON.parse(bundle.canvasJson));
        ctx.canvas.renderAll();
    }
    catch (rollbackError) {
        console.warn('[ImageEditor] rollback: loadFromJSON failed', rollbackError);
    }
    ctx.setOriginalImage(bundle.originalImage);
    ctx.setIsImageLoadedToCanvas(bundle.isImageLoadedToCanvas);
    ctx.setLastSnapshot(bundle.lastSnapshot);
    ctx.setMaskCounter(bundle.maskCounter);
    ctx.setCurrentScale(bundle.currentScale);
    ctx.setCurrentRotation(bundle.currentRotation);
    ctx.setBaseImageScale(bundle.baseImageScale);
    if (ctx.containerElement) {
        try {
            if (bundle.containerScrollTop !== null) {
                ctx.containerElement.scrollTop = bundle.containerScrollTop;
            }
            if (bundle.containerScrollLeft !== null) {
                ctx.containerElement.scrollLeft = bundle.containerScrollLeft;
            }
        }
        catch (rollbackError) {
            console.warn('[ImageEditor] rollback: scroll restore failed', rollbackError);
        }
    }
    if (bundle.placeholderHidden !== null) {
        ctx.setPlaceholderVisible(!bundle.placeholderHidden);
    }
}

function animateProps(obj, props, options, guard) {
    return new Promise((resolve, reject) => {
        const propCount = Object.keys(props).length;
        if (propCount === 0) {
            resolve();
            return;
        }
        let completed = 0;
        try {
            obj.animate(props, {
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
function restoreOrigin(obj, originX, originY) {
    try {
        obj.set({ originX, originY });
        obj.setCoords();
    }
    catch {
    }
}

class TransformController {
    constructor(ctx) {
        Object.defineProperty(this, "ctx", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.ctx = ctx;
    }
    async scaleImage(factor) {
        const img = this.ctx.getOriginalImage();
        if (!img)
            return;
        if (this.ctx.guard.isAnimating())
            return;
        if (this.ctx.guard.isDisposed())
            return;
        const clamped = Math.max(this.ctx.options.minScale, Math.min(this.ctx.options.maxScale, factor));
        this.ctx.setCurrentScale(clamped);
        const targetAbs = this.ctx.getBaseImageScale() * clamped;
        try {
            const topLeft = computeTopLeftPoint(img);
            img.set({ originX: 'left', originY: 'top' });
            img.setPositionByOrigin(topLeft, 'left', 'top');
            img.setCoords();
        }
        catch (error) {
            console.warn('[ImageEditor] scaleImage: origin pre-anchor failed', error);
        }
        try {
            await this.ctx.guard.runAnimation(() => animateProps(img, { scaleX: targetAbs, scaleY: targetAbs }, {
                duration: this.ctx.options.animationDuration,
                onChange: () => this.ctx.canvas.requestRenderAll(),
            }, this.ctx.guard));
        }
        catch (error) {
            console.warn('[ImageEditor] scaleImage animation error', error);
            return;
        }
        if (this.ctx.guard.isDisposed())
            return;
        img.set({ scaleX: targetAbs, scaleY: targetAbs });
        img.setCoords();
        if (this.ctx.afterTransformSnap)
            this.ctx.afterTransformSnap();
        this.ctx.saveCanvasState();
    }
    async rotateImage(degrees) {
        if (Number.isNaN(degrees))
            return;
        const img = this.ctx.getOriginalImage();
        if (!img)
            return;
        if (this.ctx.guard.isAnimating())
            return;
        if (this.ctx.guard.isDisposed())
            return;
        this.ctx.setCurrentRotation(degrees);
        try {
            const centre = img.getCenterPoint();
            img.set({ originX: 'center', originY: 'center' });
            img.setPositionByOrigin(centre, 'center', 'center');
            img.setCoords();
        }
        catch (error) {
            console.warn('[ImageEditor] rotateImage: origin pre-anchor failed', error);
        }
        let animationFailed = false;
        try {
            await this.ctx.guard.runAnimation(() => animateProps(img, { angle: degrees }, {
                duration: this.ctx.options.animationDuration,
                onChange: () => this.ctx.canvas.requestRenderAll(),
            }, this.ctx.guard));
        }
        catch (error) {
            animationFailed = true;
            console.warn('[ImageEditor] rotateImage animation error', error);
        }
        finally {
            if (this.ctx.guard.isDisposed()) {
                restoreOrigin(img, 'left', 'top');
            }
        }
        if (animationFailed)
            return;
        if (this.ctx.guard.isDisposed())
            return;
        img.set('angle', degrees);
        img.setCoords();
        if (this.ctx.afterTransformSnap)
            this.ctx.afterTransformSnap();
        try {
            const newTopLeft = computeTopLeftPoint(img);
            img.set({ originX: 'left', originY: 'top' });
            img.setPositionByOrigin(newTopLeft, 'left', 'top');
            img.setCoords();
        }
        catch (error) {
            console.warn('[ImageEditor] rotateImage: origin post-restore failed', error);
        }
        this.ctx.saveCanvasState();
    }
    async resetImageTransform() {
        if (!this.ctx.getOriginalImage())
            return;
        this.ctx.setSuppressSaveState(true);
        try {
            await this.scaleImage(1);
            await this.rotateImage(0);
        }
        finally {
            this.ctx.setSuppressSaveState(false);
        }
        if (this.ctx.guard.isDisposed())
            return;
        this.ctx.saveCanvasState();
    }
}
function computeTopLeftPoint(obj) {
    obj.setCoords();
    const coords = obj.getCoords();
    const first = coords[0];
    if (first)
        return first;
    const br = obj.getBoundingRect();
    return { x: br.left, y: br.top };
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

function isFabricObjectLike(value) {
    if (!value || typeof value !== 'object')
        return false;
    const candidate = value;
    return typeof candidate.set === 'function' && typeof candidate.on === 'function';
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
    return resolvedPoints;
}
function createMask(ctx, config = {}) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s;
    const { canvas, options, fabric: fabricModule } = ctx;
    if (!canvas)
        return null;
    const shapeType = (_a = config.shape) !== null && _a !== void 0 ? _a : 'rect';
    if (!validateNumericInputs(options, config))
        return null;
    const resolvedConfig = {
        shape: shapeType,
        width: options.defaultMaskWidth,
        height: options.defaultMaskHeight,
        color: 'rgba(0,0,0,0.5)',
        alpha: 0.5,
        gap: 5,
        left: undefined,
        top: undefined,
        angle: 0,
        selectable: true,
        ...config,
    };
    const firstOffset = 10;
    let left;
    let top;
    const previousMask = ctx.getLastMask();
    if (config.left === undefined && previousMask) {
        const previousRight = ((_b = previousMask.left) !== null && _b !== void 0 ? _b : 0) +
            (typeof previousMask.getScaledWidth === 'function'
                ? previousMask.getScaledWidth()
                : ((_c = previousMask.width) !== null && _c !== void 0 ? _c : 0) * ((_d = previousMask.scaleX) !== null && _d !== void 0 ? _d : 1));
        left = Math.round(previousRight + ((_e = resolvedConfig.gap) !== null && _e !== void 0 ? _e : 5));
        top = (_f = previousMask.top) !== null && _f !== void 0 ? _f : firstOffset;
    }
    else {
        left = resolveNumeric(config.left, 'x', firstOffset, canvas, options);
        top = resolveNumeric(config.top, 'y', firstOffset, canvas, options);
    }
    resolvedConfig.width = resolveNumeric(config.width, 'x', options.defaultMaskWidth, canvas, options);
    resolvedConfig.height = resolveNumeric(config.height, 'y', options.defaultMaskHeight, canvas, options);
    const rx = config.rx !== undefined ? resolveNumeric(config.rx, 'x', 0, canvas, options) : undefined;
    const ry = config.ry !== undefined ? resolveNumeric(config.ry, 'y', 0, canvas, options) : undefined;
    const radius = shapeType === 'circle'
        ? resolveNumeric(config.radius, 'x', Math.min(resolvedConfig.width, resolvedConfig.height) / 2, canvas, options)
        : undefined;
    const polygonPoints = shapeType === 'polygon' ? resolvePolygonPoints(options, config.points) : null;
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
    if (options.expandCanvasToImage) {
        const requiredWidth = Math.ceil(left + resolvedConfig.width + 10);
        const requiredHeight = Math.ceil(top + resolvedConfig.height + 10);
        const nextWidth = Math.max(canvas.getWidth(), requiredWidth);
        const nextHeight = Math.max(canvas.getHeight(), requiredHeight);
        if (nextWidth !== canvas.getWidth() || nextHeight !== canvas.getHeight()) {
            if (ctx.expandCanvasIfNeeded) {
                ctx.expandCanvasIfNeeded(nextWidth, nextHeight);
            }
            else {
                canvas.setDimensions({ width: nextWidth, height: nextHeight });
            }
        }
    }
    let mask;
    if (typeof resolvedConfig.fabricGenerator === 'function') {
        const generated = resolvedConfig.fabricGenerator(resolvedConfig, canvas, options);
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
    maskObject.selectable = 'selectable' in config ? !!config.selectable : true;
    maskObject.hasControls = 'hasControls' in config ? !!config.hasControls : true;
    maskObject.transparentCorners =
        'transparentCorners' in config ? !!config.transparentCorners : false;
    maskObject.strokeUniform = 'strokeUniform' in config ? !!config.strokeUniform : true;
    maskObject.lockRotation = !options.maskRotatable;
    maskObject.borderColor = (_o = config.borderColor) !== null && _o !== void 0 ? _o : 'red';
    maskObject.cornerColor = (_p = config.cornerColor) !== null && _p !== void 0 ? _p : 'black';
    maskObject.cornerSize = (_q = config.cornerSize) !== null && _q !== void 0 ? _q : 8;
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
    const nextId = ctx.getMaskCounter() + 1;
    ctx.setMaskCounter(nextId);
    maskObject.maskId = nextId;
    maskObject.maskName = `${options.maskName}${nextId}`;
    ctx.setLastMask(maskObject);
    canvas.add(maskObject);
    canvas.bringObjectToFront(maskObject);
    ctx.updateMaskList();
    if (resolvedConfig.selectable !== false) {
        canvas.setActiveObject(maskObject);
    }
    canvas.renderAll();
    ctx.saveCanvasState();
    (_s = resolvedConfig.onCreate) === null || _s === void 0 ? void 0 : _s.call(resolvedConfig, maskObject, canvas);
    return maskObject;
}
function removeSelectedMask(ctx) {
    const active = ctx.canvas.getActiveObject();
    if (!active || !isMaskObject(active))
        return;
    ctx.removeLabelForMask(active);
    detachMaskHoverHandlers(active);
    ctx.canvas.remove(active);
    ctx.canvas.discardActiveObject();
    ctx.updateMaskList();
    ctx.canvas.renderAll();
    ctx.saveCanvasState();
}
function removeAllMasks(ctx, options = {}) {
    const masks = ctx.canvas.getObjects().filter(isMaskObject);
    if (masks.length === 0)
        return;
    for (const maskObject of masks) {
        ctx.removeLabelForMask(maskObject);
        detachMaskHoverHandlers(maskObject);
        ctx.canvas.remove(maskObject);
    }
    ctx.canvas.discardActiveObject();
    ctx.setLastMask(null);
    ctx.updateMaskList();
    ctx.canvas.renderAll();
    if (options.saveHistory !== false) {
        ctx.saveCanvasState();
    }
}

function removeLabelForMask(ctx, mask) {
    if (!ctx.canvas || !mask.__label)
        return;
    try {
        if (ctx.canvas.getObjects().includes(mask.__label)) {
            ctx.canvas.remove(mask.__label);
        }
    }
    catch {
    }
    try {
        delete mask.__label;
    }
    catch {
    }
}
function createLabelForMask(ctx, mask) {
    var _a;
    const { canvas, options, fabric: fb } = ctx;
    if (!canvas || !options.maskLabelOnSelect)
        return;
    removeLabelForMask(ctx, mask);
    let textObj = null;
    if (typeof options.label.create === 'function') {
        textObj = options.label.create(mask, fb);
    }
    if (!textObj) {
        const indexForGetText = mask.maskId - 1;
        const txt = typeof options.label.getText === 'function'
            ? options.label.getText(mask, indexForGetText)
            : mask.maskName;
        const textOptions = {
            left: 0,
            top: 0,
            ...((_a = options.label.textOptions) !== null && _a !== void 0 ? _a : {}),
            originX: 'left',
            originY: 'top',
        };
        textObj = new fb.FabricText(txt, textOptions);
    }
    textObj.maskLabel = true;
    mask.__label = textObj;
    canvas.add(textObj);
    canvas.bringObjectToFront(textObj);
    syncMaskLabel(ctx, mask);
}
function syncMaskLabel(ctx, mask) {
    var _a, _b, _c;
    const { canvas, options } = ctx;
    if (!canvas || !options.maskLabelOnSelect || !mask.__label)
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
    mask.__label.set({
        left: Math.round(tl.x + (vx / dist) * offset),
        top: Math.round(tl.y + (vy / dist) * offset),
        angle: (_c = mask.angle) !== null && _c !== void 0 ? _c : 0,
        originX: 'left',
        originY: 'top',
        visible: true,
    });
    mask.__label.setCoords();
    canvas.renderAll();
}
function showLabelForMask(ctx, mask) {
    if (!ctx.options.maskLabelOnSelect)
        return;
    if (!mask.__label) {
        createLabelForMask(ctx, mask);
    }
    if (mask.__label) {
        mask.__label.visible = true;
        syncMaskLabel(ctx, mask);
    }
}
function hideAllMaskLabels(ctx) {
    const { canvas } = ctx;
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
            delete o.__label;
        }
        catch {
        }
    });
}

function renderMaskList(ctx) {
    const listId = ctx.getListElementId();
    if (!listId)
        return;
    const listEl = document.getElementById(listId);
    if (!listEl || !ctx.canvas)
        return;
    listEl.innerHTML = '';
    const canvas = ctx.canvas;
    canvas
        .getObjects()
        .filter(isMaskObject)
        .forEach((mask) => {
        const li = document.createElement('li');
        li.className = 'list-group-item mask-item';
        li.textContent = mask.maskName;
        li.dataset.maskId = String(mask.maskId);
        li.onclick = () => {
            const id = Number(li.dataset.maskId);
            if (!Number.isFinite(id))
                return;
            const target = canvas
                .getObjects()
                .find((o) => isMaskObject(o) && o.maskId === id);
            if (!target)
                return;
            canvas.setActiveObject(target);
            ctx.onMaskSelected(target);
        };
        listEl.appendChild(li);
    });
}
function updateMaskListSelection(ctx, selectedMask) {
    const listId = ctx.getListElementId();
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
        const el = document.getElementById(id);
        if (!el)
            return false;
        const wrapped = (event) => {
            if (this.isDisposed())
                return;
            handler(event);
        };
        el.addEventListener(eventType, wrapped);
        this.registry.push({ elementKey: key, eventType, handler: wrapped });
        return true;
    }
    removeAll() {
        for (const entry of this.registry) {
            const id = this.resolveElementId(entry.elementKey);
            if (!id)
                continue;
            const el = document.getElementById(id);
            if (!el)
                continue;
            try {
                el.removeEventListener(entry.eventType, entry.handler);
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
function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result;
            if (typeof result === 'string') {
                resolve(result);
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
        Object.defineProperty(this, "_fabric", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_fabricLoaded", {
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
        Object.defineProperty(this, "_elementOriginalPointerEvents", {
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
        Object.defineProperty(this, "maskCounter", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "_lastMask", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "_lastSnapshot", {
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
        Object.defineProperty(this, "_guard", {
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
        Object.defineProperty(this, "_transformController", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "_viewportCache", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new ViewportCache()
        });
        Object.defineProperty(this, "_cropSession", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "_bindings", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "_disposed", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "_suppressSaveState", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        const detected = detectFabric(fabricModuleOrOptions, options);
        this._fabric = (_a = detected.fabric) !== null && _a !== void 0 ? _a : {};
        this._fabricLoaded = detected._fabricLoaded;
        this.options = resolveOptions(detected.options);
        const layoutConflict = detectLayoutConflict(this.options);
        if (layoutConflict) {
            reportWarning(this.options, null, layoutConflict.message);
        }
        this._guard = new OperationGuard();
        this.animQueue = new AnimationQueue();
        this.historyManager = new HistoryManager(this.options.maxHistorySize);
    }
    init(idMap = {}) {
        if (!this._fabricLoaded) {
            const globalFabric = globalThis.fabric;
            if (!globalFabric ||
                typeof globalFabric.Canvas !== 'function') {
                return;
            }
            this._fabric = globalFabric;
            this._fabricLoaded = true;
        }
        if (this._disposed)
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
        this._bindings = new DomBindings((key) => this.elements[key], () => this._disposed);
        this._initCanvas();
        this._transformController = new TransformController(this._buildTransformContext());
        this._bindEvents();
        this._updateInputs();
        this._updateMaskList();
        this._updateUI();
        if (this.options.initialImageBase64) {
            void this.loadImage(this.options.initialImageBase64).catch(() => {
            });
        }
        else {
            this._updatePlaceholderStatus();
        }
    }
    _initCanvas() {
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
        this.canvas = new this._fabric.Canvas(canvasElement, {
            width: initialWidth,
            height: initialHeight,
            backgroundColor: this.options.backgroundColor,
            selection: this.options.groupSelection,
            preserveObjectStacking: true,
        });
        this.canvas.on('selection:created', (e) => {
            this._onSelectionChanged(e.selected);
        });
        this.canvas.on('selection:updated', (e) => {
            this._onSelectionChanged(e.selected);
        });
        this.canvas.on('selection:cleared', () => this._onSelectionChanged([]));
        const onObjectEvent = (e) => {
            if (e.target && isMaskObject(e.target))
                this._syncMaskLabel(e.target);
        };
        const onObjectModified = (e) => {
            if (!e.target || !isMaskObject(e.target))
                return;
            this._syncMaskLabel(e.target);
            this.saveState();
        };
        this.canvas.on('object:moving', onObjectEvent);
        this.canvas.on('object:scaling', onObjectEvent);
        this.canvas.on('object:rotating', onObjectEvent);
        this.canvas.on('object:modified', onObjectModified);
    }
    _bindEvents() {
        this._bindIfExists('uploadArea', 'click', () => {
            var _a;
            const inputId = this.elements.imageInput;
            if (inputId)
                (_a = document.getElementById(inputId)) === null || _a === void 0 ? void 0 : _a.click();
        });
        this._bindIfExists('imageInput', 'change', (e) => {
            var _a;
            const file = (_a = e.target.files) === null || _a === void 0 ? void 0 : _a[0];
            if (file)
                void this._loadImageFile(file);
        });
        this._bindIfExists('zoomInButton', 'click', () => {
            void this.scaleImage(this.currentScale + this.options.scaleStep);
        });
        this._bindIfExists('zoomOutButton', 'click', () => {
            void this.scaleImage(this.currentScale - this.options.scaleStep);
        });
        this._bindIfExists('resetImageTransformButton', 'click', () => {
            void this.resetImageTransform();
        });
        this._bindIfExists('createMaskButton', 'click', () => {
            this.createMask();
        });
        this._bindIfExists('removeSelectedMaskButton', 'click', () => {
            this.removeSelectedMask();
        });
        this._bindIfExists('removeAllMasksButton', 'click', () => {
            this.removeAllMasks();
        });
        this._bindIfExists('mergeMasksButton', 'click', () => {
            void this.mergeMasks();
        });
        this._bindIfExists('downloadImageButton', 'click', () => {
            this.downloadImage();
        });
        this._bindIfExists('undoButton', 'click', () => {
            this.undo();
        });
        this._bindIfExists('redoButton', 'click', () => {
            this.redo();
        });
        this._bindIfExists('rotateLeftButton', 'click', () => {
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
        this._bindIfExists('rotateRightButton', 'click', () => {
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
        this._bindIfExists('enterCropModeButton', 'click', () => {
            this.enterCropMode();
        });
        this._bindIfExists('applyCropButton', 'click', () => {
            void this.applyCrop().catch((error) => {
                reportError(this.options, error, 'Crop apply failed.');
            });
        });
        this._bindIfExists('cancelCropButton', 'click', () => {
            this.cancelCrop();
        });
    }
    _bindIfExists(key, event, handler) {
        var _a;
        (_a = this._bindings) === null || _a === void 0 ? void 0 : _a.bindIfExists(key, event, handler);
    }
    async _loadImageFile(file) {
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
            dataUrl = await readFileAsDataURL(file);
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
        if (!this._fabricLoaded || !this.canvas)
            return;
        if (this._disposed)
            return;
        if (typeof base64 !== 'string' || !base64.startsWith('data:image/'))
            return;
        if (!this._canRunIdleOperation('loadImage', options))
            return;
        this._guard.beginLoading();
        this._updateUI();
        this._hideAllMaskLabels();
        const ctx = {
            fabric: this._fabric,
            canvas: this.canvas,
            options: this.options,
            containerElement: this.containerElement,
            placeholderElement: this.placeholderElement,
            viewportCache: this._viewportCache,
            getOriginalImage: () => this.originalImage,
            setOriginalImage: (v) => {
                this.originalImage = v;
            },
            getIsImageLoadedToCanvas: () => this.isImageLoadedToCanvas,
            setIsImageLoadedToCanvas: (v) => {
                this.isImageLoadedToCanvas = v;
            },
            getLastSnapshot: () => this._lastSnapshot,
            setLastSnapshot: (v) => {
                this._lastSnapshot = v;
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
            setPlaceholderVisible: (show) => {
                setPlaceholderVisible(this.placeholderElement, this.containerElement, show);
            },
        };
        try {
            await loadImage(ctx, base64, options);
        }
        finally {
            this._guard.endLoading();
            if (!this._disposed && this.canvas)
                this._updateUI();
        }
        this._lastMask = null;
        this._updateInputs();
        this._updateMaskList();
        this._updateUI();
    }
    _getInternalOperationToken(options) {
        var _a;
        return ((_a = options === null || options === void 0 ? void 0 : options[INTERNAL_OPERATION_TOKEN]) !== null && _a !== void 0 ? _a : null);
    }
    _canRunDuringAnimationQueue(options) {
        return !!(options === null || options === void 0 ? void 0 : options[INTERNAL_ALLOW_DURING_ANIMATION_QUEUE]);
    }
    _withInternalOperationOptions(token, options = {}) {
        return {
            ...options,
            ...(token ? { [INTERNAL_OPERATION_TOKEN]: token } : {}),
        };
    }
    _withAnimationQueueBypass(options = {}) {
        return {
            ...options,
            [INTERNAL_ALLOW_DURING_ANIMATION_QUEUE]: true,
        };
    }
    _assertIdleForOperation(operationName, options) {
        const token = this._getInternalOperationToken(options);
        this._guard.assertIdleForOperation(operationName, token);
        if (this._cropSession &&
            !this._guard.isOwnOperation(token) &&
            !CROP_SESSION_ALLOWED_OPERATIONS.has(operationName)) {
            throw new Error(`[ImageEditor] Cannot run "${operationName}" while crop mode is active.`);
        }
        if (this.animQueue.isBusy() && !this._canRunDuringAnimationQueue(options)) {
            throw new Error(`[ImageEditor] Cannot run "${operationName}" while an animation is queued.`);
        }
    }
    _canRunIdleOperation(operationName, options) {
        try {
            this._assertIdleForOperation(operationName, options);
            return true;
        }
        catch {
            return false;
        }
    }
    _assertCanQueueAnimation(operationName, options) {
        this._guard.assertCanQueueAnimation(operationName, this._getInternalOperationToken(options));
    }
    isImageLoaded() {
        var _a, _b;
        return !!(this.originalImage &&
            this.originalImage instanceof this._fabric.FabricImage &&
            ((_a = this.originalImage.width) !== null && _a !== void 0 ? _a : 0) > 0 &&
            ((_b = this.originalImage.height) !== null && _b !== void 0 ? _b : 0) > 0);
    }
    isBusy() {
        return this._guard.isBusy() || this.animQueue.isBusy() || this._cropSession !== null;
    }
    _setCanvasSizeInt(w, h) {
        if (!this.canvas)
            return;
        applyCanvasDimensions(this.canvas, w, h, this.containerElement);
    }
    _alignObjectBoundingBoxToCanvasTopLeft(obj) {
        var _a, _b;
        obj.setCoords();
        const boundingRect = obj.getBoundingRect();
        obj.set({
            left: ((_a = obj.left) !== null && _a !== void 0 ? _a : 0) - boundingRect.left,
            top: ((_b = obj.top) !== null && _b !== void 0 ? _b : 0) - boundingRect.top,
        });
        obj.setCoords();
        this.canvas.renderAll();
    }
    _measureLayoutViewport(scrollbarSize) {
        return this._viewportCache.measure(this.containerElement, {
            width: this.options.canvasWidth,
            height: this.options.canvasHeight,
        }, scrollbarSize);
    }
    _updateCanvasSizeToImageBounds() {
        var _a, _b;
        if (!this.originalImage)
            return;
        this.originalImage.setCoords();
        const boundingRect = this.originalImage.getBoundingRect();
        const scrollbarSize = measureScrollbarSize((_b = (_a = this.containerElement) === null || _a === void 0 ? void 0 : _a.ownerDocument) !== null && _b !== void 0 ? _b : null);
        const viewport = this._measureLayoutViewport(scrollbarSize);
        if (this.options.fitImageToCanvas || this.options.coverImageToCanvas) {
            const canvasSize = computeScrollableCanvasSize(boundingRect.width, boundingRect.height, viewport, scrollbarSize);
            this._setCanvasSizeInt(canvasSize.width, canvasSize.height);
            return;
        }
        if (boundingRect.width <= viewport.width && boundingRect.height <= viewport.height) {
            this._setCanvasSizeInt(viewport.width, viewport.height);
            return;
        }
        this._setCanvasSizeInt(Math.max(viewport.width, Math.ceil(boundingRect.width)), Math.max(viewport.height, Math.ceil(boundingRect.height)));
    }
    _shouldNormalizeCanvasSizeAfterStateRestore() {
        var _a, _b;
        if (!this.canvas || !this.originalImage)
            return false;
        this.originalImage.setCoords();
        const boundingRect = this.originalImage.getBoundingRect();
        const viewport = this._measureLayoutViewport(measureScrollbarSize((_b = (_a = this.containerElement) === null || _a === void 0 ? void 0 : _a.ownerDocument) !== null && _b !== void 0 ? _b : null));
        const canvasW = Math.ceil(this.canvas.getWidth());
        const canvasH = Math.ceil(this.canvas.getHeight());
        const clipsImage = boundingRect.width > canvasW + LAYOUT_EPSILON ||
            boundingRect.height > canvasH + LAYOUT_EPSILON;
        if (this.options.fitImageToCanvas || this.options.coverImageToCanvas) {
            const staleOverflowWidth = canvasW > viewport.width + LAYOUT_EPSILON &&
                boundingRect.width <= viewport.width + LAYOUT_EPSILON;
            const staleOverflowHeight = canvasH > viewport.height + LAYOUT_EPSILON &&
                boundingRect.height <= viewport.height + LAYOUT_EPSILON;
            return clipsImage || staleOverflowWidth || staleOverflowHeight;
        }
        if (this.options.expandCanvasToImage) {
            const expectedW = Math.max(viewport.width, Math.ceil(boundingRect.width));
            const expectedH = Math.max(viewport.height, Math.ceil(boundingRect.height));
            return (Math.abs(canvasW - expectedW) > LAYOUT_EPSILON ||
                Math.abs(canvasH - expectedH) > LAYOUT_EPSILON);
        }
        return clipsImage;
    }
    _captureImageDisplayGeometry() {
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
    _restoreMergedImageDisplayGeometry(geometry) {
        if (!geometry || !this.canvas || !this.originalImage)
            return;
        this._setCanvasSizeInt(geometry.canvasWidth, geometry.canvasHeight);
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
        this._lastSnapshot = this._captureSnapshot();
        this.canvas.renderAll();
    }
    _buildTransformContext() {
        return {
            canvas: this.canvas,
            options: this.options,
            guard: this._guard,
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
                this._saveState(this._withAnimationQueueBypass());
            },
            setSuppressSaveState: (suppress) => {
                this._suppressSaveState = suppress;
            },
            afterTransformSnap: () => {
                if (this._disposed || !this.canvas || !this.originalImage)
                    return;
                if (this.options.expandCanvasToImage ||
                    this.options.coverImageToCanvas ||
                    this.options.fitImageToCanvas) {
                    this._updateCanvasSizeToImageBounds();
                }
                this._alignObjectBoundingBoxToCanvasTopLeft(this.originalImage);
                this.canvas
                    .getObjects()
                    .filter(isMaskObject)
                    .forEach((maskObject) => this._syncMaskLabel(maskObject));
            },
        };
    }
    scaleImage(factor) {
        if (this._disposed || !this._transformController)
            return Promise.resolve();
        try {
            this._assertCanQueueAnimation('scaleImage');
        }
        catch (error) {
            return Promise.reject(error);
        }
        const controller = this._transformController;
        const job = this.animQueue.add(async () => {
            if (this._disposed)
                return;
            this._updateUI();
            try {
                await controller.scaleImage(factor);
            }
            finally {
                if (!this._disposed) {
                    this._updateInputs();
                }
            }
        });
        return job.finally(() => this._refreshUiAfterQueuedAnimation());
    }
    rotateImage(degrees) {
        if (this._disposed || !this._transformController)
            return Promise.resolve();
        try {
            this._assertCanQueueAnimation('rotateImage');
        }
        catch (error) {
            return Promise.reject(error);
        }
        const controller = this._transformController;
        const job = this.animQueue.add(async () => {
            if (this._disposed)
                return;
            this._updateUI();
            try {
                await controller.rotateImage(degrees);
            }
            finally {
                if (!this._disposed) {
                    this._updateInputs();
                }
            }
        });
        return job.finally(() => this._refreshUiAfterQueuedAnimation());
    }
    resetImageTransform() {
        if (this._disposed || !this._transformController)
            return Promise.resolve();
        try {
            this._assertCanQueueAnimation('resetImageTransform');
        }
        catch (error) {
            return Promise.reject(error);
        }
        const controller = this._transformController;
        const job = this.animQueue.add(async () => {
            if (this._disposed)
                return;
            this._updateUI();
            try {
                await controller.resetImageTransform();
            }
            finally {
                if (!this._disposed) {
                    this._updateInputs();
                }
            }
        });
        return job.finally(() => this._refreshUiAfterQueuedAnimation());
    }
    _refreshUiAfterQueuedAnimation() {
        if (this._disposed || !this.canvas)
            return;
        this._updateInputs();
        this._updateUI();
    }
    async loadFromState(jsonString) {
        return this._loadFromState(jsonString);
    }
    async _loadFromState(jsonString, options) {
        if (!jsonString || !this.canvas)
            return;
        if (this._disposed)
            return;
        if (!this._canRunIdleOperation('loadFromState', options))
            return;
        try {
            const result = await loadFromState({
                canvas: this.canvas,
                jsonString,
                setCanvasSize: (w, h) => this._setCanvasSizeInt(w, h),
            });
            if (this._disposed || !this.canvas)
                return;
            this._hideAllMaskLabels();
            this.originalImage = result.originalImage;
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
            this.maskCounter = result.maxMaskId;
            const es = result.editorState;
            if (es) {
                this.currentScale = es.currentScale;
                this.currentRotation = es.currentRotation;
                this.baseImageScale = es.baseImageScale;
            }
            this.isImageLoadedToCanvas = !!this.originalImage;
            if (this.originalImage &&
                (this.options.expandCanvasToImage ||
                    this.options.coverImageToCanvas ||
                    this.options.fitImageToCanvas) &&
                this._shouldNormalizeCanvasSizeAfterStateRestore()) {
                this._updateCanvasSizeToImageBounds();
                this._alignObjectBoundingBoxToCanvasTopLeft(this.originalImage);
            }
            const restoredMasks = result.objects.filter(isMaskObject);
            this._lastMask = restoredMasks.reduce((lastMask, maskObject) => !lastMask || maskObject.maskId > lastMask.maskId ? maskObject : lastMask, null);
            restoredMasks.forEach((maskObject) => {
                applyMaskUnselectedStyle(maskObject);
                reattachMaskHoverHandlers(maskObject);
            });
            this._lastSnapshot = this._captureSnapshot();
            this.canvas.renderAll();
            this._updateInputs();
            this._updateMaskList();
            this._updateUI();
            const activeMaskId = es === null || es === void 0 ? void 0 : es.activeMaskId;
            if (typeof activeMaskId === 'number') {
                const activeMask = restoredMasks.find((maskObject) => maskObject.maskId === activeMaskId);
                if (activeMask) {
                    this.canvas.setActiveObject(activeMask);
                    this._onSelectionChanged([activeMask]);
                }
            }
        }
        catch (error) {
            reportError(this.options, error, 'Failed to restore canvas state.');
            throw error;
        }
    }
    saveState() {
        this._saveState();
    }
    _saveState(options) {
        var _a, _b;
        if (!this.canvas || this._suppressSaveState)
            return;
        if (!this._canRunIdleOperation('saveState', options))
            return;
        const activeObj = this.canvas.getActiveObject();
        const activeMask = this._activeMaskForSnapshot();
        this._hideAllMaskLabels();
        try {
            const after = saveState({
                canvas: this.canvas,
                activeMaskId: (_a = activeMask === null || activeMask === void 0 ? void 0 : activeMask.maskId) !== null && _a !== void 0 ? _a : null,
                currentScale: this.currentScale,
                currentRotation: this.currentRotation,
                baseImageScale: this.baseImageScale,
            });
            const before = (_b = this._lastSnapshot) !== null && _b !== void 0 ? _b : after;
            let executedOnce = false;
            const cmd = new Command(async () => {
                if (executedOnce) {
                    await this._loadFromState(after, this._withAnimationQueueBypass());
                }
                executedOnce = true;
            }, async () => {
                await this._loadFromState(before, this._withAnimationQueueBypass());
            });
            this.historyManager.execute(cmd);
            this._lastSnapshot = after;
            const maskToRestore = activeObj && isMaskObject(activeObj) ? activeObj : activeMask;
            if (maskToRestore && this.canvas.getObjects().includes(maskToRestore)) {
                this.canvas.setActiveObject(maskToRestore);
                this._showLabelForMask(maskToRestore);
                this._updateMaskListSelection(maskToRestore);
            }
            this._updateUI();
        }
        catch (error) {
            reportWarning(this.options, error, 'Failed to capture canvas snapshot.');
        }
    }
    undo() {
        if (this._disposed)
            return Promise.resolve();
        if (!this._canRunIdleOperation('undo'))
            return Promise.resolve();
        const job = this.animQueue.add(() => this._disposed ? Promise.resolve() : this.historyManager.undo());
        return job.finally(() => this._refreshUiAfterQueuedAnimation());
    }
    redo() {
        if (this._disposed)
            return Promise.resolve();
        if (!this._canRunIdleOperation('redo'))
            return Promise.resolve();
        const job = this.animQueue.add(() => this._disposed ? Promise.resolve() : this.historyManager.redo());
        return job.finally(() => this._refreshUiAfterQueuedAnimation());
    }
    createMask(config = {}) {
        if (!this.canvas)
            return null;
        if (!this._canRunIdleOperation('createMask'))
            return null;
        const ctx = this._buildCreateMaskContext();
        return createMask(ctx, config);
    }
    removeSelectedMask() {
        if (!this.canvas)
            return;
        if (!this._canRunIdleOperation('removeSelectedMask'))
            return;
        const ctx = this._buildRemoveMaskContext();
        removeSelectedMask(ctx);
        this._updateUI();
    }
    removeAllMasks(options = {}) {
        if (!this.canvas)
            return;
        if (!this._canRunIdleOperation('removeAllMasks', options))
            return;
        const ctx = this._buildRemoveMaskContext();
        removeAllMasks(ctx, options);
        this._updateUI();
    }
    _buildCreateMaskContext() {
        return {
            fabric: this._fabric,
            canvas: this.canvas,
            options: this.options,
            getLastMask: () => this._lastMask,
            setLastMask: (maskObject) => {
                this._lastMask = maskObject;
            },
            getMaskCounter: () => this.maskCounter,
            setMaskCounter: (n) => {
                this.maskCounter = n;
            },
            updateMaskList: () => {
                this._updateMaskList();
            },
            saveCanvasState: () => {
                this.saveState();
            },
            expandCanvasIfNeeded: (w, h) => {
                this._setCanvasSizeInt(w, h);
            },
        };
    }
    _buildRemoveMaskContext() {
        return {
            canvas: this.canvas,
            removeLabelForMask: (mask) => {
                this._removeLabelForMask(mask);
            },
            updateMaskList: () => {
                this._updateMaskList();
            },
            saveCanvasState: () => {
                this.saveState();
            },
            setLastMask: (maskObject) => {
                this._lastMask = maskObject;
            },
        };
    }
    _maskLabelContext() {
        if (!this.canvas)
            return null;
        return { fabric: this._fabric, canvas: this.canvas, options: this.options };
    }
    _removeLabelForMask(mask) {
        const ctx = this._maskLabelContext();
        if (!ctx)
            return;
        removeLabelForMask(ctx, mask);
    }
    _createLabelForMask(mask) {
        const ctx = this._maskLabelContext();
        if (!ctx)
            return;
        createLabelForMask(ctx, mask);
    }
    _hideAllMaskLabels() {
        const ctx = this._maskLabelContext();
        if (!ctx)
            return;
        hideAllMaskLabels(ctx);
    }
    _syncMaskLabel(mask) {
        const ctx = this._maskLabelContext();
        if (!ctx)
            return;
        syncMaskLabel(ctx, mask);
    }
    _showLabelForMask(mask) {
        const ctx = this._maskLabelContext();
        if (!ctx)
            return;
        showLabelForMask(ctx, mask);
    }
    _onSelectionChanged(selected) {
        var _a;
        if (!this.canvas)
            return;
        const selectedMask = (_a = selected.find(isMaskObject)) !== null && _a !== void 0 ? _a : null;
        const masks = this.canvas.getObjects().filter(isMaskObject);
        masks.forEach((maskObject) => {
            if (maskObject !== selectedMask) {
                if (maskObject.__label) {
                    this._removeLabelForMask(maskObject);
                }
                applyMaskUnselectedStyle(maskObject);
            }
            else {
                applyMaskSelectedStyle(maskObject);
            }
        });
        if (selectedMask)
            this._showLabelForMask(selectedMask);
        this._updateMaskListSelection(selectedMask);
        this.canvas.requestRenderAll();
        this._updateUI();
    }
    _maskListContext() {
        return {
            canvas: this.canvas,
            getListElementId: () => this.elements.maskList,
            onMaskSelected: (mask) => this._onSelectionChanged([mask]),
        };
    }
    _updateMaskList() {
        renderMaskList(this._maskListContext());
    }
    _updateMaskListSelection(selectedMask) {
        updateMaskListSelection(this._maskListContext(), selectedMask);
    }
    async mergeMasks() {
        if (!this.canvas)
            return;
        if (!this._canRunIdleOperation('mergeMasks'))
            return;
        const hasMasks = this.canvas.getObjects().some(isMaskObject);
        if (!hasMasks)
            return;
        const operationToken = this._guard.beginBusyOperation('mergeMasks');
        this._updateUI();
        try {
            const ctx = this._buildMergeMasksContext(operationToken);
            await mergeMasks(ctx);
            this._updateInputs();
            this._updateMaskList();
        }
        finally {
            this._guard.endBusyOperation(operationToken);
            this._updateUI();
        }
    }
    downloadImage(fileName) {
        if (!this.canvas)
            return;
        if (!this._canRunIdleOperation('downloadImage'))
            return;
        const ctx = this._buildExportServiceContext();
        downloadImage(ctx, fileName);
    }
    async exportImageBase64(options) {
        if (!this.canvas)
            return '';
        if (!this._canRunIdleOperation('exportImageBase64', options))
            return '';
        const ctx = this._buildExportServiceContext();
        return exportImageBase64(ctx, options);
    }
    async exportImageFile(options) {
        this._assertIdleForOperation('exportImageFile', options);
        const ctx = this._buildExportServiceContext();
        return exportImageFile(ctx, options);
    }
    _buildExportServiceContext() {
        return {
            fabric: this._fabric,
            canvas: this.canvas,
            options: this.options,
            isImageLoaded: () => this.isImageLoaded(),
            getOriginalImage: () => this.originalImage,
        };
    }
    _buildMergeMasksContext(operationToken) {
        return {
            ...this._buildExportServiceContext(),
            historyManager: this.historyManager,
            containerElement: this.containerElement,
            loadImage: async (base64, opts) => {
                const geometry = this._captureImageDisplayGeometry();
                await this.loadImage(base64, this._withInternalOperationOptions(operationToken, opts));
                this._restoreMergedImageDisplayGeometry(geometry);
            },
            saveState: () => this._captureSnapshot(),
            loadFromState: (snapshot) => this._loadFromState(snapshot, this._withInternalOperationOptions(operationToken, this._withAnimationQueueBypass())),
            removeAllMasksNoHistory: () => {
                const ctx = this._buildRemoveMaskContext();
                removeAllMasks(ctx, { saveHistory: false });
            },
        };
    }
    _captureSnapshot() {
        var _a;
        if (!this.canvas)
            return '';
        const activeMask = this._activeMaskForSnapshot();
        this._hideAllMaskLabels();
        return saveState({
            canvas: this.canvas,
            activeMaskId: (_a = activeMask === null || activeMask === void 0 ? void 0 : activeMask.maskId) !== null && _a !== void 0 ? _a : null,
            currentScale: this.currentScale,
            currentRotation: this.currentRotation,
            baseImageScale: this.baseImageScale,
        });
    }
    _activeMaskForSnapshot() {
        var _a;
        if (!this.canvas)
            return null;
        const activeObject = this.canvas.getActiveObject();
        if (activeObject && isMaskObject(activeObject))
            return activeObject;
        return ((_a = this.canvas
            .getObjects()
            .find((object) => isMaskObject(object) && !!object.__label)) !== null && _a !== void 0 ? _a : null);
    }
    enterCropMode() {
        if (!this.canvas || !this.originalImage)
            return;
        if (this._cropSession)
            return;
        if (!this.isImageLoaded())
            return;
        if (!this._canRunIdleOperation('enterCropMode'))
            return;
        const ctx = this._buildCropControllerContext();
        enterCropMode(ctx);
        this._updateUI();
    }
    cancelCrop() {
        if (!this.canvas || !this._cropSession)
            return;
        if (!this._canRunIdleOperation('cancelCrop'))
            return;
        const ctx = this._buildCropControllerContext();
        cancelCrop(ctx);
        this._cropSession = null;
        this._updateUI();
        this.canvas.requestRenderAll();
    }
    async applyCrop() {
        if (!this.canvas || !this._cropSession)
            return;
        if (!this._canRunIdleOperation('applyCrop'))
            return;
        const operationToken = this._guard.beginBusyOperation('applyCrop');
        this._updateUI();
        try {
            const ctx = this._buildCropControllerContext(operationToken);
            await applyCrop(ctx);
            this._updateInputs();
            this._updateMaskList();
        }
        finally {
            this._guard.endBusyOperation(operationToken);
            this._updateUI();
        }
    }
    _buildCropControllerContext(operationToken) {
        return {
            fabric: this._fabric,
            canvas: this.canvas,
            options: this.options,
            historyManager: this.historyManager,
            isImageLoaded: () => this.isImageLoaded(),
            getOriginalImage: () => this.originalImage,
            getCropSession: () => this._cropSession,
            setCropSession: (s) => {
                this._cropSession = s;
            },
            saveState: () => this._captureSnapshot(),
            loadFromState: (snapshot) => this._loadFromState(snapshot, this._withInternalOperationOptions(operationToken, this._withAnimationQueueBypass())),
            loadImage: (base64, opts) => this.loadImage(base64, this._withInternalOperationOptions(operationToken, opts)),
            getMaskCounter: () => this.maskCounter,
            setMaskCounter: (n) => {
                this.maskCounter = n;
            },
            updateMaskList: () => {
                this._updateMaskList();
            },
        };
    }
    _updateInputs() {
        const scaleId = this.elements.scalePercentageInput;
        if (!scaleId)
            return;
        const scaleEl = document.getElementById(scaleId);
        if (scaleEl)
            scaleEl.value = String(Math.round(this.currentScale * 100));
    }
    _updateUI() {
        if (!this.canvas)
            return;
        const hasImg = !!this.originalImage;
        const masks = hasImg ? this.canvas.getObjects().filter(isMaskObject) : [];
        const hasMasks = masks.length > 0;
        const active = this.canvas.getActiveObject();
        const hasSelectedMask = !!(active && isMaskObject(active));
        const isDefault = this.currentScale === 1 && this.currentRotation === 0;
        const canUndo = this.historyManager.canUndo();
        const canRedo = this.historyManager.canRedo();
        const inCrop = this._cropSession !== null;
        const isBusy = this._guard.isBusy() || this.animQueue.isBusy();
        if (inCrop) {
            CROP_MODE_CONTROL_KEYS.forEach((key) => {
                const id = this.elements[key];
                if (!id)
                    return;
                const el = document.getElementById(id);
                if (!el || !('disabled' in el))
                    return;
                el.disabled =
                    isBusy || !CROP_MODE_ENABLED_KEYS.includes(key);
            });
            return;
        }
        this._setDisabled('scalePercentageInput', !hasImg || isBusy);
        this._setDisabled('rotateLeftDegreesInput', !hasImg || isBusy);
        this._setDisabled('rotateRightDegreesInput', !hasImg || isBusy);
        this._setDisabled('zoomInButton', !hasImg || isBusy || this.currentScale >= this.options.maxScale);
        this._setDisabled('zoomOutButton', !hasImg || isBusy || this.currentScale <= this.options.minScale);
        this._setDisabled('rotateLeftButton', !hasImg || isBusy);
        this._setDisabled('rotateRightButton', !hasImg || isBusy);
        this._setDisabled('createMaskButton', !hasImg || isBusy);
        this._setDisabled('removeSelectedMaskButton', !hasSelectedMask || isBusy);
        this._setDisabled('removeAllMasksButton', !hasMasks || isBusy);
        this._setDisabled('mergeMasksButton', !hasImg || !hasMasks || isBusy);
        this._setDisabled('downloadImageButton', !hasImg || isBusy);
        this._setDisabled('resetImageTransformButton', !hasImg || isDefault || isBusy);
        this._setDisabled('undoButton', !hasImg || isBusy || !canUndo);
        this._setDisabled('redoButton', !hasImg || isBusy || !canRedo);
        this._setDisabled('enterCropModeButton', !hasImg || isBusy);
        this._setDisabled('imageInput', isBusy);
        this._setDisabled('applyCropButton', true);
        this._setDisabled('cancelCropButton', true);
    }
    _setDisabled(key, disabled) {
        var _a;
        const id = this.elements[key];
        if (!id)
            return;
        const el = document.getElementById(id);
        if (el && 'disabled' in el) {
            el.disabled = disabled;
            return;
        }
        if (!el)
            return;
        if (!this._elementOriginalPointerEvents.has(key)) {
            this._elementOriginalPointerEvents.set(key, el.style.pointerEvents || '');
        }
        if (disabled) {
            el.setAttribute('aria-disabled', 'true');
            el.style.pointerEvents = 'none';
        }
        else {
            el.removeAttribute('aria-disabled');
            el.style.pointerEvents = (_a = this._elementOriginalPointerEvents.get(key)) !== null && _a !== void 0 ? _a : '';
        }
    }
    _updatePlaceholderStatus() {
        if (!this.options.showPlaceholder)
            return;
        setPlaceholderVisible(this.placeholderElement, this.containerElement, !this.originalImage);
    }
    dispose() {
        var _a;
        if (this._disposed)
            return;
        this._disposed = true;
        this._guard.markDisposed();
        this.animQueue.clear();
        (_a = this._bindings) === null || _a === void 0 ? void 0 : _a.removeAll();
        if (this._cropSession && this.canvas) {
            try {
                const ctx = this._buildCropControllerContext();
                cancelCrop(ctx);
            }
            catch {
            }
            this._cropSession = null;
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
        this._transformController = null;
        this._viewportCache.clear();
    }
}

exports.ImageEditor = ImageEditor;
exports.default = ImageEditor;
exports.isMaskObject = isMaskObject;
//# sourceMappingURL=index.cjs.map
