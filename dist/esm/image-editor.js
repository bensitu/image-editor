import { AnimationQueue } from './animation/animation-queue.js';
import { reportError, reportWarning } from './core/callback-reporter.js';
import { resolveOptions } from './core/default-options.js';
import { OperationGuard } from './core/operation-guard.js';
import { loadFromState as loadFromStateImpl, saveState as saveStateImpl, } from './core/state-serializer.js';
import { Command, HistoryManager } from './history/history-manager.js';
import { detectFabric } from './fabric/fabric-adapter.js';
import { isMaskObject } from './core/public-types.js';
import { applyCrop as applyCropImpl, cancelCrop as cancelCropImpl, enterCropMode as enterCropModeImpl, } from './crop/crop-controller.js';
import { downloadImage as downloadImageImpl, exportImageBase64 as exportImageBase64Impl, exportImageFile as exportImageFileImpl, mergeMasks as mergeMasksImpl, } from './export/export-service.js';
import { loadImage as loadImageImpl } from './image/image-loader.js';
import { ViewportCache, applyCanvasDimensions, computeScrollableCanvasSize, detectLayoutConflict, measureScrollbarSize, } from './image/layout-manager.js';
import { TransformController } from './image/transform-controller.js';
import { createMask as createMaskImpl, removeAllMasks as removeAllMasksImpl, removeSelectedMask as removeSelectedMaskImpl, } from './mask/mask-factory.js';
import { createLabelForMask, hideAllMaskLabels, removeLabelForMask, showLabelForMask, syncMaskLabel, } from './mask/mask-label-manager.js';
import { renderMaskList, updateMaskListSelection } from './mask/mask-list.js';
import { applyMaskSelectedStyle, applyMaskUnselectedStyle, reattachMaskHoverHandlers, } from './mask/mask-style.js';
import { DomBindings } from './ui/dom-bindings.js';
import { setPlaceholderVisible as setPlaceholderVisibleImpl } from './ui/visibility-state.js';
import { inferImageMimeType, readFileAsDataURL, resetFileInput } from './utils/file.js';
import { detectSourceMimeType } from './image/image-resampler.js';
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
export class ImageEditor {
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
        Object.defineProperty(this, "_lastEmittedBusyState", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "_activeStateRestoreOperation", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "_nextSelectionChangeContext", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
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
        const context = this._getOperationContext('loadImage', options);
        const previousImage = this.originalImage;
        const hadMasks = this._getMasks().length > 0;
        this._emitOptionCallback('onImageLoadStart', [context]);
        this._guard.beginLoading();
        this._emitBusyChangeIfChanged(context);
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
            getCurrentImageMimeType: () => this.currentImageMimeType,
            setCurrentImageMimeType: (v) => {
                this.currentImageMimeType = v;
            },
            setPlaceholderVisible: (show) => {
                setPlaceholderVisibleImpl(this.placeholderElement, this.containerElement, show);
            },
        };
        try {
            await loadImageImpl(ctx, base64, options);
        }
        finally {
            this._guard.endLoading();
            this._emitBusyChangeIfChanged(context);
            if (!this._disposed && this.canvas)
                this._updateUI();
        }
        this._lastMask = null;
        this._updateInputs();
        this._updateMaskList();
        this._updateUI();
        if (previousImage && previousImage !== this.originalImage) {
            this._emitOptionCallback('onImageCleared', [previousImage, context]);
        }
        const imageInfo = this._getImageInfo();
        if (imageInfo) {
            this._emitOptionCallback('onImageLoaded', [imageInfo, context]);
        }
        if (hadMasks) {
            this._emitMasksChanged(context);
        }
        this._emitImageChanged(context);
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
    _buildCallbackContext(operation, isInternalOperation = false) {
        return { operation, isInternalOperation };
    }
    _getOperationContext(fallback, options) {
        const internal = this._getInternalOperationToken(options);
        const activeOperation = this._guard.activeOperationName();
        if (internal && activeOperation) {
            return this._buildCallbackContext(activeOperation, true);
        }
        return this._buildCallbackContext(fallback, false);
    }
    _emitOptionCallback(callbackName, args) {
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
    _getImageInfo() {
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
    _getMasks() {
        if (!this.canvas)
            return [];
        return this.canvas.getObjects().filter(isMaskObject).slice();
    }
    _getMaskCollectionSignature() {
        return this._getMasks()
            .map((mask) => `${mask.maskId}:${mask.maskName}`)
            .join('|');
    }
    _getEditorState() {
        const canvasWidth = this.canvas ? this.canvas.getWidth() : 0;
        const canvasHeight = this.canvas ? this.canvas.getHeight() : 0;
        const image = this._getImageInfo();
        return {
            hasImage: image !== null,
            image,
            maskCount: this._getMasks().length,
            currentScale: this.currentScale,
            currentRotation: this.currentRotation,
            isBusy: this.isBusy(),
            isCropMode: this._cropSession !== null,
            canUndo: this.historyManager.canUndo(),
            canRedo: this.historyManager.canRedo(),
            canvasWidth,
            canvasHeight,
        };
    }
    _emitImageChanged(context) {
        this._emitOptionCallback('onImageChanged', [this._getEditorState(), context]);
    }
    _emitMasksChanged(context) {
        this._emitOptionCallback('onMasksChanged', [this._getMasks(), context]);
    }
    _emitBusyChangeIfChanged(context) {
        const isBusy = this.isBusy();
        if (this._lastEmittedBusyState === isBusy)
            return;
        this._lastEmittedBusyState = isBusy;
        this._emitOptionCallback('onBusyChange', [isBusy, context]);
    }
    _buildSelection(selected) {
        var _a;
        const selectedMasks = selected.filter(isMaskObject);
        return {
            selectedMask: (_a = selectedMasks[0]) !== null && _a !== void 0 ? _a : null,
            selectedMasks,
        };
    }
    _withSelectionChangeContext(context, fn) {
        const previous = this._nextSelectionChangeContext;
        this._nextSelectionChangeContext = context;
        try {
            return fn();
        }
        finally {
            this._nextSelectionChangeContext = previous;
        }
    }
    _isSupportedImageMimeType(mimeType) {
        return mimeType === 'image/jpeg' || mimeType === 'image/png' || mimeType === 'image/webp';
    }
    _inferCurrentImageMimeType() {
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
        return this._isSupportedImageMimeType(mimeType) ? mimeType : null;
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
        const context = this._buildCallbackContext('scaleImage', false);
        const job = this.animQueue.add(async () => {
            if (this._disposed)
                return;
            this._updateUI();
            try {
                await controller.scaleImage(factor);
                if (!this._disposed)
                    this._emitImageChanged(context);
            }
            finally {
                if (!this._disposed) {
                    this._updateInputs();
                }
            }
        });
        this._emitBusyChangeIfChanged(context);
        return job.finally(() => {
            this._refreshUiAfterQueuedAnimation();
            this._emitBusyChangeIfChanged(context);
        });
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
        const context = this._buildCallbackContext('rotateImage', false);
        const job = this.animQueue.add(async () => {
            if (this._disposed)
                return;
            this._updateUI();
            try {
                await controller.rotateImage(degrees);
                if (!this._disposed)
                    this._emitImageChanged(context);
            }
            finally {
                if (!this._disposed) {
                    this._updateInputs();
                }
            }
        });
        this._emitBusyChangeIfChanged(context);
        return job.finally(() => {
            this._refreshUiAfterQueuedAnimation();
            this._emitBusyChangeIfChanged(context);
        });
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
        const context = this._buildCallbackContext('resetImageTransform', false);
        const job = this.animQueue.add(async () => {
            if (this._disposed)
                return;
            this._updateUI();
            try {
                await controller.resetImageTransform();
                if (!this._disposed)
                    this._emitImageChanged(context);
            }
            finally {
                if (!this._disposed) {
                    this._updateInputs();
                }
            }
        });
        this._emitBusyChangeIfChanged(context);
        return job.finally(() => {
            this._refreshUiAfterQueuedAnimation();
            this._emitBusyChangeIfChanged(context);
        });
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
        var _a;
        if (!jsonString || !this.canvas)
            return;
        if (this._disposed)
            return;
        if (!this._canRunIdleOperation('loadFromState', options))
            return;
        const activeRestoreOperation = this._activeStateRestoreOperation;
        const context = this._buildCallbackContext(activeRestoreOperation !== null && activeRestoreOperation !== void 0 ? activeRestoreOperation : 'loadFromState', activeRestoreOperation === 'undo' || activeRestoreOperation === 'redo');
        const previousImage = this.originalImage;
        const previousMaskSignature = this._getMaskCollectionSignature();
        try {
            const result = await loadFromStateImpl({
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
            if (this.originalImage) {
                this.currentImageMimeType =
                    es && 'currentImageMimeType' in es
                        ? ((_a = es.currentImageMimeType) !== null && _a !== void 0 ? _a : null)
                        : this._inferCurrentImageMimeType();
            }
            else {
                this.currentImageMimeType = null;
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
            if (previousImage && previousImage !== this.originalImage) {
                this._emitOptionCallback('onImageCleared', [previousImage, context]);
            }
            if (previousMaskSignature !== this._getMaskCollectionSignature()) {
                this._emitMasksChanged(context);
            }
            this._emitImageChanged(context);
            const activeMaskId = es === null || es === void 0 ? void 0 : es.activeMaskId;
            if (typeof activeMaskId === 'number') {
                const activeMask = restoredMasks.find((maskObject) => maskObject.maskId === activeMaskId);
                if (activeMask) {
                    this._withSelectionChangeContext(context, () => {
                        this.canvas.setActiveObject(activeMask);
                        this._onSelectionChanged([activeMask]);
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
            const after = saveStateImpl({
                canvas: this.canvas,
                activeMaskId: (_a = activeMask === null || activeMask === void 0 ? void 0 : activeMask.maskId) !== null && _a !== void 0 ? _a : null,
                currentScale: this.currentScale,
                currentRotation: this.currentRotation,
                baseImageScale: this.baseImageScale,
                currentImageMimeType: this.currentImageMimeType,
            });
            const before = (_b = this._lastSnapshot) !== null && _b !== void 0 ? _b : after;
            if (after === before) {
                const maskToRestore = activeObj && isMaskObject(activeObj) ? activeObj : activeMask;
                if (maskToRestore && this.canvas.getObjects().includes(maskToRestore)) {
                    this.canvas.setActiveObject(maskToRestore);
                    this._showLabelForMask(maskToRestore);
                    this._updateMaskListSelection(maskToRestore);
                }
                this._updateUI();
                return;
            }
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
        const context = this._buildCallbackContext('undo', true);
        const job = this.animQueue.add(async () => {
            if (this._disposed)
                return;
            this._activeStateRestoreOperation = 'undo';
            try {
                await this.historyManager.undo();
            }
            finally {
                this._activeStateRestoreOperation = null;
            }
        });
        this._emitBusyChangeIfChanged(context);
        return job.finally(() => {
            this._refreshUiAfterQueuedAnimation();
            this._emitBusyChangeIfChanged(context);
        });
    }
    redo() {
        if (this._disposed)
            return Promise.resolve();
        if (!this._canRunIdleOperation('redo'))
            return Promise.resolve();
        const context = this._buildCallbackContext('redo', true);
        const job = this.animQueue.add(async () => {
            if (this._disposed)
                return;
            this._activeStateRestoreOperation = 'redo';
            try {
                await this.historyManager.redo();
            }
            finally {
                this._activeStateRestoreOperation = null;
            }
        });
        this._emitBusyChangeIfChanged(context);
        return job.finally(() => {
            this._refreshUiAfterQueuedAnimation();
            this._emitBusyChangeIfChanged(context);
        });
    }
    createMask(config = {}) {
        if (!this.canvas)
            return null;
        if (!this._canRunIdleOperation('createMask'))
            return null;
        const context = this._buildCallbackContext('createMask', false);
        const ctx = this._buildCreateMaskContext();
        const mask = this._withSelectionChangeContext(context, () => createMaskImpl(ctx, config));
        if (mask) {
            this._emitMasksChanged(context);
            this._emitImageChanged(context);
        }
        return mask;
    }
    removeSelectedMask() {
        if (!this.canvas)
            return;
        if (!this._canRunIdleOperation('removeSelectedMask'))
            return;
        const before = this._getMasks().length;
        const context = this._buildCallbackContext('removeSelectedMask', false);
        const ctx = this._buildRemoveMaskContext();
        this._withSelectionChangeContext(context, () => removeSelectedMaskImpl(ctx));
        this._updateUI();
        if (this._getMasks().length !== before) {
            this._emitMasksChanged(context);
            this._emitImageChanged(context);
        }
    }
    removeAllMasks(options = {}) {
        if (!this.canvas)
            return;
        if (!this._canRunIdleOperation('removeAllMasks', options))
            return;
        const before = this._getMasks().length;
        const context = this._buildCallbackContext('removeAllMasks', false);
        const ctx = this._buildRemoveMaskContext();
        this._withSelectionChangeContext(context, () => removeAllMasksImpl(ctx, options));
        this._updateUI();
        if (this._getMasks().length !== before) {
            this._emitMasksChanged(context);
            this._emitImageChanged(context);
        }
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
        var _a, _b, _c;
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
        const context = (_b = this._nextSelectionChangeContext) !== null && _b !== void 0 ? _b : this._buildCallbackContext((_c = this._activeStateRestoreOperation) !== null && _c !== void 0 ? _c : 'createMask', this._activeStateRestoreOperation === 'undo' ||
            this._activeStateRestoreOperation === 'redo');
        this._emitOptionCallback('onSelectionChange', [this._buildSelection(selected), context]);
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
        const context = this._buildCallbackContext('mergeMasks', false);
        const operationToken = this._guard.beginBusyOperation('mergeMasks');
        this._emitBusyChangeIfChanged(context);
        this._updateUI();
        try {
            const ctx = this._buildMergeMasksContext(operationToken);
            await mergeMasksImpl(ctx);
            this._updateInputs();
            this._updateMaskList();
            this._emitMasksChanged(context);
            this._emitImageChanged(context);
        }
        finally {
            this._guard.endBusyOperation(operationToken);
            this._emitBusyChangeIfChanged(context);
            this._updateUI();
        }
    }
    downloadImage(fileName) {
        if (!this.canvas)
            return;
        if (!this._canRunIdleOperation('downloadImage'))
            return;
        const context = this._buildCallbackContext('downloadImage', false);
        const operationToken = this._guard.beginBusyOperation('downloadImage');
        this._emitBusyChangeIfChanged(context);
        const ctx = this._buildExportServiceContext();
        try {
            downloadImageImpl(ctx, fileName);
        }
        finally {
            this._guard.endBusyOperation(operationToken);
            this._emitBusyChangeIfChanged(context);
        }
    }
    async exportImageBase64(options) {
        if (!this.canvas)
            return '';
        if (!this._canRunIdleOperation('exportImageBase64', options))
            return '';
        const context = this._buildCallbackContext('exportImageBase64', false);
        const operationToken = this._guard.beginBusyOperation('exportImageBase64');
        this._emitBusyChangeIfChanged(context);
        const ctx = this._buildExportServiceContext();
        try {
            return await exportImageBase64Impl(ctx, options);
        }
        finally {
            this._guard.endBusyOperation(operationToken);
            this._emitBusyChangeIfChanged(context);
        }
    }
    async exportImageFile(options) {
        this._assertIdleForOperation('exportImageFile', options);
        const context = this._buildCallbackContext('exportImageFile', false);
        const operationToken = this._guard.beginBusyOperation('exportImageFile');
        this._emitBusyChangeIfChanged(context);
        const ctx = this._buildExportServiceContext();
        try {
            return await exportImageFileImpl(ctx, options);
        }
        finally {
            this._guard.endBusyOperation(operationToken);
            this._emitBusyChangeIfChanged(context);
        }
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
                removeAllMasksImpl(ctx, { saveHistory: false });
            },
        };
    }
    _captureSnapshot() {
        var _a;
        if (!this.canvas)
            return '';
        const activeMask = this._activeMaskForSnapshot();
        this._hideAllMaskLabels();
        return saveStateImpl({
            canvas: this.canvas,
            activeMaskId: (_a = activeMask === null || activeMask === void 0 ? void 0 : activeMask.maskId) !== null && _a !== void 0 ? _a : null,
            currentScale: this.currentScale,
            currentRotation: this.currentRotation,
            baseImageScale: this.baseImageScale,
            currentImageMimeType: this.currentImageMimeType,
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
        enterCropModeImpl(ctx);
        this._updateUI();
        const context = this._buildCallbackContext('enterCropMode', false);
        this._emitBusyChangeIfChanged(context);
        this._emitImageChanged(context);
    }
    cancelCrop() {
        if (!this.canvas || !this._cropSession)
            return;
        if (!this._canRunIdleOperation('cancelCrop'))
            return;
        const ctx = this._buildCropControllerContext();
        cancelCropImpl(ctx);
        this._cropSession = null;
        this._updateUI();
        this.canvas.requestRenderAll();
        const context = this._buildCallbackContext('cancelCrop', false);
        this._emitBusyChangeIfChanged(context);
        this._emitImageChanged(context);
    }
    async applyCrop() {
        if (!this.canvas || !this._cropSession)
            return;
        if (!this._canRunIdleOperation('applyCrop'))
            return;
        const context = this._buildCallbackContext('applyCrop', false);
        const hadMasks = this._getMasks().length > 0;
        const operationToken = this._guard.beginBusyOperation('applyCrop');
        this._emitBusyChangeIfChanged(context);
        this._updateUI();
        try {
            const ctx = this._buildCropControllerContext(operationToken);
            await applyCropImpl(ctx);
            this._updateInputs();
            this._updateMaskList();
            if (hadMasks || this._getMasks().length > 0) {
                this._emitMasksChanged(context);
            }
            this._emitImageChanged(context);
        }
        finally {
            this._guard.endBusyOperation(operationToken);
            this._emitBusyChangeIfChanged(context);
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
            getCurrentImageMimeType: () => this.currentImageMimeType,
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
        setPlaceholderVisibleImpl(this.placeholderElement, this.containerElement, !this.originalImage);
    }
    dispose() {
        var _a;
        if (this._disposed)
            return;
        const context = this._buildCallbackContext('dispose', false);
        const previousImage = this.originalImage;
        this._disposed = true;
        this._guard.markDisposed();
        this.animQueue.clear();
        (_a = this._bindings) === null || _a === void 0 ? void 0 : _a.removeAll();
        if (this._cropSession && this.canvas) {
            try {
                const ctx = this._buildCropControllerContext();
                cancelCropImpl(ctx);
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
        this.originalImage = null;
        this.currentImageMimeType = null;
        this._lastMask = null;
        this.maskCounter = 0;
        this.currentScale = 1;
        this.currentRotation = 0;
        this.baseImageScale = 1;
        this._lastSnapshot = null;
        this._transformController = null;
        this._viewportCache.clear();
        if (previousImage) {
            this._emitOptionCallback('onImageCleared', [previousImage, context]);
        }
        this._emitImageChanged(context);
        this._emitBusyChangeIfChanged(context);
        this._emitOptionCallback('onEditorDisposed', [context]);
    }
}
//# sourceMappingURL=image-editor.js.map