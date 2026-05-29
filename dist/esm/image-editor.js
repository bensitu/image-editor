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
const LAYOUT_EPSILON = 0.5;
const INTERNAL_OPERATION_TOKEN = Symbol.for('ImageEditorInternalOperation');
const CROP_MODE_CONTROL_KEYS = [
    'scaleRate',
    'rotationLeftInput',
    'rotationRightInput',
    'rotateLeftBtn',
    'rotateRightBtn',
    'addMaskBtn',
    'removeMaskBtn',
    'removeAllMasksBtn',
    'mergeBtn',
    'downloadBtn',
    'zoomInBtn',
    'zoomOutBtn',
    'resetBtn',
    'undoBtn',
    'redoBtn',
    'imageInput',
    'cropBtn',
    'applyCropBtn',
    'cancelCropBtn',
];
const CROP_MODE_ENABLED_KEYS = ['applyCropBtn', 'cancelCropBtn'];
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
        if (!this._fabricLoaded)
            return;
        if (this._disposed)
            return;
        const defaults = {
            canvas: 'fabricCanvas',
            canvasContainer: null,
            imgPlaceholder: 'imgPlaceholder',
            scaleRate: 'scaleRate',
            rotationLeftInput: 'rotationLeftInput',
            rotationRightInput: 'rotationRightInput',
            rotateLeftBtn: 'rotateLeftBtn',
            rotateRightBtn: 'rotateRightBtn',
            addMaskBtn: 'addMaskBtn',
            removeMaskBtn: 'removeMaskBtn',
            removeAllMasksBtn: 'removeAllMasksBtn',
            mergeBtn: 'mergeBtn',
            downloadBtn: 'downloadBtn',
            maskList: 'maskList',
            zoomInBtn: 'zoomInBtn',
            zoomOutBtn: 'zoomOutBtn',
            resetBtn: 'resetBtn',
            undoBtn: 'undoBtn',
            redoBtn: 'redoBtn',
            imageInput: 'imageInput',
            cropBtn: 'cropBtn',
            applyCropBtn: 'applyCropBtn',
            cancelCropBtn: 'cancelCropBtn',
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
            void this.loadImage(this.options.initialImageBase64);
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
        const phId = this.elements.imgPlaceholder;
        this.placeholderElement = phId ? document.getElementById(phId) : null;
        let initialW = this.options.canvasWidth;
        let initialH = this.options.canvasHeight;
        if (this.containerElement) {
            const cw = Math.floor(this.containerElement.clientWidth);
            const ch = Math.floor(this.containerElement.clientHeight);
            if (cw > 0 && ch > 0) {
                initialW = cw;
                initialH = ch;
            }
        }
        this.canvas = new this._fabric.Canvas(canvasElement, {
            width: initialW,
            height: initialH,
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
        this.canvas.on('object:moving', onObjectEvent);
        this.canvas.on('object:scaling', onObjectEvent);
        this.canvas.on('object:rotating', onObjectEvent);
        this.canvas.on('object:modified', onObjectEvent);
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
            const f = (_a = e.target.files) === null || _a === void 0 ? void 0 : _a[0];
            if (f)
                void this._loadImageFile(f);
        });
        this._bindIfExists('zoomInBtn', 'click', () => {
            void this.scaleImage(this.currentScale + this.options.scaleStep);
        });
        this._bindIfExists('zoomOutBtn', 'click', () => {
            void this.scaleImage(this.currentScale - this.options.scaleStep);
        });
        this._bindIfExists('resetBtn', 'click', () => {
            void this.resetImageTransform();
        });
        this._bindIfExists('addMaskBtn', 'click', () => {
            this.createMask();
        });
        this._bindIfExists('removeMaskBtn', 'click', () => {
            this.removeSelectedMask();
        });
        this._bindIfExists('removeAllMasksBtn', 'click', () => {
            this.removeAllMasks();
        });
        this._bindIfExists('mergeBtn', 'click', () => {
            void this.mergeMasks();
        });
        this._bindIfExists('downloadBtn', 'click', () => {
            this.downloadImage();
        });
        this._bindIfExists('undoBtn', 'click', () => {
            this.undo();
        });
        this._bindIfExists('redoBtn', 'click', () => {
            this.redo();
        });
        this._bindIfExists('rotateLeftBtn', 'click', () => {
            const inputId = this.elements.rotationLeftInput;
            const inputEl = inputId
                ? document.getElementById(inputId)
                : null;
            let step = this.options.rotationStep;
            if (inputEl) {
                const p = parseFloat(inputEl.value);
                if (!isNaN(p))
                    step = p;
            }
            void this.rotateImage(this.currentRotation - step);
        });
        this._bindIfExists('rotateRightBtn', 'click', () => {
            const inputId = this.elements.rotationRightInput;
            const inputEl = inputId
                ? document.getElementById(inputId)
                : null;
            let step = this.options.rotationStep;
            if (inputEl) {
                const p = parseFloat(inputEl.value);
                if (!isNaN(p))
                    step = p;
            }
            void this.rotateImage(this.currentRotation + step);
        });
        this._bindIfExists('cropBtn', 'click', () => {
            this.enterCropMode();
        });
        this._bindIfExists('applyCropBtn', 'click', () => {
            void this.applyCrop().catch((err) => {
                reportError(this.options, err, 'Crop apply failed.');
            });
        });
        this._bindIfExists('cancelCropBtn', 'click', () => {
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
        try {
            const dataUrl = await readFileAsDataURL(file);
            await this.loadImage(dataUrl);
        }
        catch (err) {
            reportError(this.options, err, 'Failed to read selected image file.');
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
                setPlaceholderVisibleImpl(this.placeholderElement, this.containerElement, show);
            },
        };
        try {
            await loadImageImpl(ctx, base64, options);
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
    _withInternalOperationOptions(token, options = {}) {
        return {
            ...options,
            ...(token ? { [INTERNAL_OPERATION_TOKEN]: token } : {}),
        };
    }
    _assertIdleForOperation(operationName, options) {
        const token = this._getInternalOperationToken(options);
        this._guard.assertIdleForOperation(operationName, token);
        if (this.animQueue.isBusy()) {
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
                this.saveState();
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
        catch (err) {
            return Promise.reject(err);
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
        catch (err) {
            return Promise.reject(err);
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
        catch (err) {
            return Promise.reject(err);
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
        if (!jsonString || !this.canvas)
            return;
        if (this._disposed)
            return;
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
            this.isImageLoadedToCanvas = !!this.originalImage;
            if (this.originalImage &&
                (this.options.expandCanvasToImage ||
                    this.options.coverImageToCanvas ||
                    this.options.fitImageToCanvas) &&
                this._shouldNormalizeCanvasSizeAfterStateRestore()) {
                this._updateCanvasSizeToImageBounds();
                this._alignObjectBoundingBoxToCanvasTopLeft(this.originalImage);
            }
            result.objects.filter(isMaskObject).forEach((maskObject) => {
                applyMaskUnselectedStyle(maskObject);
                reattachMaskHoverHandlers(maskObject);
            });
            this._lastSnapshot = this._captureSnapshot();
            this.canvas.renderAll();
            this._updateInputs();
            this._updateMaskList();
            this._updateUI();
        }
        catch (err) {
            reportError(this.options, err, 'Failed to restore canvas state.');
            throw err;
        }
    }
    saveState() {
        var _a;
        if (!this.canvas || this._suppressSaveState)
            return;
        const activeObj = this.canvas.getActiveObject();
        this._hideAllMaskLabels();
        try {
            const after = saveStateImpl({
                canvas: this.canvas,
                currentScale: this.currentScale,
                currentRotation: this.currentRotation,
                baseImageScale: this.baseImageScale,
            });
            const before = (_a = this._lastSnapshot) !== null && _a !== void 0 ? _a : after;
            let executedOnce = false;
            const cmd = new Command(async () => {
                if (executedOnce) {
                    await this.loadFromState(after);
                }
                executedOnce = true;
            }, async () => {
                await this.loadFromState(before);
            });
            this.historyManager.execute(cmd);
            this._lastSnapshot = after;
            if (activeObj && isMaskObject(activeObj))
                this._showLabelForMask(activeObj);
            this._updateUI();
        }
        catch (err) {
            reportWarning(this.options, err, 'Failed to capture canvas snapshot.');
        }
    }
    undo() {
        if (this._disposed)
            return Promise.resolve();
        const job = this.animQueue.add(() => this._disposed ? Promise.resolve() : this.historyManager.undo());
        return job.finally(() => this._refreshUiAfterQueuedAnimation());
    }
    redo() {
        if (this._disposed)
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
        return createMaskImpl(ctx, config);
    }
    removeSelectedMask() {
        if (!this.canvas)
            return;
        if (!this._canRunIdleOperation('removeSelectedMask'))
            return;
        const ctx = this._buildRemoveMaskContext();
        removeSelectedMaskImpl(ctx);
        this._updateUI();
    }
    removeAllMasks(options = {}) {
        if (!this.canvas)
            return;
        if (!this._canRunIdleOperation('removeAllMasks', options))
            return;
        const ctx = this._buildRemoveMaskContext();
        removeAllMasksImpl(ctx, options);
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
            await mergeMasksImpl(ctx);
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
        downloadImageImpl(ctx, fileName);
    }
    async exportImageBase64(options) {
        if (!this.canvas)
            return '';
        if (!this._canRunIdleOperation('exportImageBase64', options))
            return '';
        const ctx = this._buildExportServiceContext();
        return exportImageBase64Impl(ctx, options);
    }
    async exportImageFile(options) {
        this._assertIdleForOperation('exportImageFile', options);
        const ctx = this._buildExportServiceContext();
        return exportImageFileImpl(ctx, options);
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
            loadFromState: (snapshot) => this.loadFromState(snapshot),
            removeAllMasksNoHistory: () => {
                const ctx = this._buildRemoveMaskContext();
                removeAllMasksImpl(ctx, { saveHistory: false });
            },
        };
    }
    _captureSnapshot() {
        if (!this.canvas)
            return '';
        this._hideAllMaskLabels();
        return saveStateImpl({
            canvas: this.canvas,
            currentScale: this.currentScale,
            currentRotation: this.currentRotation,
            baseImageScale: this.baseImageScale,
        });
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
            await applyCropImpl(ctx);
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
            loadFromState: (snapshot) => this.loadFromState(snapshot),
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
        const scaleId = this.elements.scaleRate;
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
        this._setDisabled('scaleRate', !hasImg || isBusy);
        this._setDisabled('rotationLeftInput', !hasImg || isBusy);
        this._setDisabled('rotationRightInput', !hasImg || isBusy);
        this._setDisabled('zoomInBtn', !hasImg || isBusy || this.currentScale >= this.options.maxScale);
        this._setDisabled('zoomOutBtn', !hasImg || isBusy || this.currentScale <= this.options.minScale);
        this._setDisabled('rotateLeftBtn', !hasImg || isBusy);
        this._setDisabled('rotateRightBtn', !hasImg || isBusy);
        this._setDisabled('addMaskBtn', !hasImg || isBusy);
        this._setDisabled('removeMaskBtn', !hasSelectedMask || isBusy);
        this._setDisabled('removeAllMasksBtn', !hasMasks || isBusy);
        this._setDisabled('mergeBtn', !hasImg || !hasMasks || isBusy);
        this._setDisabled('downloadBtn', !hasImg || isBusy);
        this._setDisabled('resetBtn', !hasImg || isDefault || isBusy);
        this._setDisabled('undoBtn', !hasImg || isBusy || !canUndo);
        this._setDisabled('redoBtn', !hasImg || isBusy || !canRedo);
        this._setDisabled('cropBtn', !hasImg || isBusy);
        this._setDisabled('imageInput', isBusy);
        this._setDisabled('applyCropBtn', true);
        this._setDisabled('cancelCropBtn', true);
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
        this._transformController = null;
        this._viewportCache.clear();
    }
}
//# sourceMappingURL=image-editor.js.map