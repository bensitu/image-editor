import { AnimationQueue } from './animation/animation-queue.js';
import { reportError, reportWarning } from './core/callback-reporter.js';
import { areResolvedMosaicConfigsEqual, cloneResolvedMosaicConfig, getInvalidMosaicConfigFields, isLayoutMode, mergeMosaicConfigPatch, resolveOptions, } from './core/default-options.js';
import { OperationGuard } from './core/operation-guard.js';
import { loadFromState as loadFromStateImpl, saveState as saveStateImpl, } from './core/state-serializer.js';
import { Command, HistoryManager } from './history/history-manager.js';
import { detectFabric } from './fabric/fabric-adapter.js';
import { isMaskObject } from './core/public-types.js';
import { applyCrop as applyCropImpl, cancelCrop as cancelCropImpl, enterCropMode as enterCropModeImpl, } from './crop/crop-controller.js';
import { enterMosaicMode as enterMosaicModeImpl, exitMosaicMode as exitMosaicModeImpl, updateMosaicPreview, } from './mosaic/mosaic-controller.js';
import { downloadImage as downloadImageImpl, exportImageBase64 as exportImageBase64Impl, exportImageFile as exportImageFileImpl, mergeMasks as mergeMasksImpl, } from './export/export-service.js';
import { loadImage as loadImageImpl } from './image/image-loader.js';
import { ViewportCache, applyCanvasDimensions, computeScrollableCanvasSize, measureScrollbarSize, } from './image/layout-manager.js';
import { TransformController } from './image/transform-controller.js';
import { createMask as createMaskImpl, removeAllMasks as removeAllMasksImpl, removeSelectedMask as removeSelectedMaskImpl, } from './mask/mask-factory.js';
import { createLabelForMask, hideAllMaskLabels, removeLabelForMask, showLabelForMask, syncMaskLabel, } from './mask/mask-label-manager.js';
import { renderMaskList, updateMaskListSelection } from './mask/mask-list.js';
import { applyMaskSelectedStyle, applyMaskUnselectedStyle, reattachMaskHoverHandlers, } from './mask/mask-style.js';
import { DomBindings } from './ui/dom-bindings.js';
import { setPlaceholderVisible as setPlaceholderVisibleImpl } from './ui/visibility-state.js';
import { inferImageMimeType, readFileAsDataUrl, resetFileInput } from './utils/file.js';
import { detectSourceMimeType } from './image/image-resampler.js';
const LAYOUT_EPSILON = 0.5;
const INTERNAL_OPERATION_TOKEN = Symbol('ImageEditorInternalOperation');
const INTERNAL_ALLOW_DURING_ANIMATION_QUEUE = Symbol('ImageEditorAllowDuringAnimationQueue');
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
    'enterMosaicModeButton',
    'exitMosaicModeButton',
    'mosaicBrushSizeInput',
    'mosaicBlockSizeInput',
];
const CROP_MODE_ENABLED_KEYS = ['applyCropButton', 'cancelCropButton'];
const CROP_SESSION_ALLOWED_OPERATIONS = new Set(['applyCrop', 'cancelCrop']);
const MOSAIC_MODE_CONTROL_KEYS = [
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
const MOSAIC_SESSION_ALLOWED_OPERATIONS = new Set([
    'exitMosaicMode',
    'applyMosaic',
    'setMosaicConfig',
    'resetMosaicConfig',
    'setMosaicBrushSize',
    'setMosaicBlockSize',
    'saveState',
]);
const SCROLLBAR_SETTLE_EPSILON = 1;
const IMAGE_EDITOR_OPERATIONS = new Set([
    'init',
    'loadImage',
    'loadFromState',
    'saveState',
    'scaleImage',
    'rotateImage',
    'resetImageTransform',
    'createMask',
    'removeSelectedMask',
    'removeAllMasks',
    'mergeMasks',
    'enterCropMode',
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
function isImageEditorOperation(value) {
    return value !== null && IMAGE_EDITOR_OPERATIONS.has(value);
}
export class ImageEditor {
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
        Object.defineProperty(this, "mosaicSession", {
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
        this.currentLayoutMode = this.options.layoutMode;
        this.defaultMosaicConfig = this.options.defaultMosaicConfig;
        this.currentMosaicConfig = cloneResolvedMosaicConfig(this.defaultMosaicConfig);
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
            enterMosaicModeButton: 'enterMosaicModeButton',
            exitMosaicModeButton: 'exitMosaicModeButton',
            mosaicBrushSizeInput: 'mosaicBrushSizeInput',
            mosaicBlockSizeInput: 'mosaicBlockSizeInput',
            uploadArea: 'uploadArea',
        };
        this.elements = { ...defaults, ...idMap };
        this.domBindings = new DomBindings((key) => this.elements[key], () => this.isDisposed, () => { var _a, _b; return (_b = (_a = this.canvasElement) === null || _a === void 0 ? void 0 : _a.ownerDocument) !== null && _b !== void 0 ? _b : document; });
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
        this.bindElementIfExists('enterMosaicModeButton', 'click', () => {
            this.enterMosaicMode();
        });
        this.bindElementIfExists('exitMosaicModeButton', 'click', () => {
            this.exitMosaicMode();
        });
        const bindMosaicSizeInput = (key, applyValue) => {
            const handler = (event) => {
                const parsed = parseFloat(event.target.value);
                applyValue(parsed);
            };
            this.bindElementIfExists(key, 'input', handler);
            this.bindElementIfExists(key, 'change', handler);
        };
        bindMosaicSizeInput('mosaicBrushSizeInput', (value) => {
            this.setMosaicBrushSize(value);
        });
        bindMosaicSizeInput('mosaicBlockSizeInput', (value) => {
            this.setMosaicBlockSize(value);
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
        return this.loadImageInternal(base64, options);
    }
    async loadImageInternal(base64, options = {}) {
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
            options: this.getRuntimeOptions(),
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
                setPlaceholderVisibleImpl(this.placeholderElement, this.containerElement, this.options.showPlaceholder ? show : false);
            },
        };
        try {
            await loadImageImpl(loadImageContext, base64, options);
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
        if (this.mosaicSession &&
            !this.operationGuard.isOwnOperation(token) &&
            !MOSAIC_SESSION_ALLOWED_OPERATIONS.has(operationName)) {
            throw new Error(`[ImageEditor] Cannot run "${operationName}" while mosaic mode is active.`);
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
    isExpectedIdleGuardError(error, operationName) {
        return (error instanceof Error &&
            error.message.startsWith(`[ImageEditor] Cannot run "${operationName}" `));
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
        return (this.operationGuard.isBusy() ||
            this.animQueue.isBusy() ||
            this.cropSession !== null ||
            this.mosaicSession !== null);
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
            isMosaicMode: this.mosaicSession !== null,
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
        if (this.currentLayoutMode === 'fit' || this.currentLayoutMode === 'cover') {
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
        if (this.currentLayoutMode === 'fit' || this.currentLayoutMode === 'cover') {
            const staleOverflowWidth = canvasW > viewport.width + LAYOUT_EPSILON &&
                boundingRect.width <= viewport.width + LAYOUT_EPSILON;
            const staleOverflowHeight = canvasH > viewport.height + LAYOUT_EPSILON &&
                boundingRect.height <= viewport.height + LAYOUT_EPSILON;
            return clipsImage || staleOverflowWidth || staleOverflowHeight;
        }
        if (this.currentLayoutMode === 'expand') {
            const expectedW = Math.max(viewport.width, Math.ceil(boundingRect.width));
            const expectedH = Math.max(viewport.height, Math.ceil(boundingRect.height));
            return (Math.abs(canvasW - expectedW) > LAYOUT_EPSILON ||
                Math.abs(canvasH - expectedH) > LAYOUT_EPSILON);
        }
        return clipsImage;
    }
    settleFitCoverScrollbarsAfterStateRestore() {
        if (!this.canvas ||
            !this.containerElement ||
            (this.currentLayoutMode !== 'fit' && this.currentLayoutMode !== 'cover')) {
            return;
        }
        const canvasW = Math.ceil(this.canvas.getWidth());
        const canvasH = Math.ceil(this.canvas.getHeight());
        if (canvasW <= 1 || canvasH <= 1)
            return;
        const clientW = Math.floor(this.containerElement.clientWidth || 0);
        const clientH = Math.floor(this.containerElement.clientHeight || 0);
        if (clientW <= 0 || clientH <= 0)
            return;
        const scrollW = Math.ceil(this.containerElement.scrollWidth || 0);
        const scrollH = Math.ceil(this.containerElement.scrollHeight || 0);
        const hasHorizontalScrollbar = scrollW > clientW + LAYOUT_EPSILON;
        const hasVerticalScrollbar = scrollH > clientH + LAYOUT_EPSILON;
        if (!hasHorizontalScrollbar && !hasVerticalScrollbar)
            return;
        const nudgeWidth = hasVerticalScrollbar && Math.abs(canvasW - clientW) <= SCROLLBAR_SETTLE_EPSILON;
        const nudgeHeight = hasHorizontalScrollbar && Math.abs(canvasH - clientH) <= SCROLLBAR_SETTLE_EPSILON;
        if (!nudgeWidth && !nudgeHeight)
            return;
        this.setCanvasSizePx(nudgeWidth ? canvasW - 1 : canvasW, nudgeHeight ? canvasH - 1 : canvasH);
        this.setCanvasSizePx(canvasW, canvasH);
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
            const restoredState = await loadFromStateImpl({
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
            if (this.originalImage) {
                this.settleFitCoverScrollbarsAfterStateRestore();
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
            const after = saveStateImpl({
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
        const mask = this.withSelectionChangeContext(callbackContext, () => createMaskImpl(createMaskContext, config));
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
        this.withSelectionChangeContext(callbackContext, () => removeSelectedMaskImpl(removeMaskContext));
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
        this.withSelectionChangeContext(callbackContext, () => removeAllMasksImpl(removeMaskContext, options));
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
            options: this.getRuntimeOptions(),
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
            await mergeMasksImpl(mergeMasksContext);
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
            downloadImageImpl(exportContext, fileName);
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
            return await exportImageBase64Impl(exportContext, options);
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
            return await exportImageFileImpl(exportContext, options);
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
                await this.loadImageInternal(base64, this.withInternalOperationOptions(operationToken, providedOptions !== null && providedOptions !== void 0 ? providedOptions : {}));
                this.restoreMergedImageDisplayGeometry(geometry);
            },
            saveState: () => this.captureSnapshotInternal(),
            loadFromState: (snapshot) => this.loadFromStateInternal(snapshot, this.withInternalOperationOptions(operationToken, this.withAnimationQueueBypass())),
            removeAllMasksNoHistory: () => {
                const context = this.buildRemoveMaskContext();
                removeAllMasksImpl(context, { saveHistory: false });
            },
        };
    }
    captureSnapshotInternal() {
        var _a;
        if (!this.canvas) {
            throw new Error('[ImageEditor] Cannot capture canvas snapshot before init or after dispose.');
        }
        const activeMask = this.getActiveMaskForSnapshot();
        this.hideAllMaskLabels();
        return saveStateImpl({
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
        const labeledMasks = this.canvas
            .getObjects()
            .filter((object) => isMaskObject(object) && !!object.labelObject);
        return labeledMasks.length === 1 ? ((_a = labeledMasks[0]) !== null && _a !== void 0 ? _a : null) : null;
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
        enterMosaicModeImpl(this.buildMosaicControllerContext());
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
        exitMosaicModeImpl(this.buildMosaicControllerContext());
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
        return {
            fabric: this.fabricModule,
            canvas: this.canvas,
            options: this.options,
            historyManager: this.historyManager,
            getMosaicConfig: () => cloneResolvedMosaicConfig(this.currentMosaicConfig),
            isImageLoaded: () => this.isImageLoaded(),
            getOriginalImage: () => this.originalImage,
            setOriginalImage: (image) => {
                this.originalImage = image;
            },
            getCurrentImageMimeType: () => this.currentImageMimeType,
            setCurrentImageMimeType: (mimeType) => {
                this.currentImageMimeType = mimeType;
            },
            getLastSnapshot: () => this.lastSnapshot,
            setLastSnapshot: (snapshot) => {
                this.lastSnapshot = snapshot;
            },
            captureSnapshot: () => this.captureSnapshotInternal(),
            loadFromState: (snapshot) => this.loadFromStateInternal(snapshot, this.withAnimationQueueBypass()),
            updateUi: () => {
                this.updateUi();
            },
            updateInputs: () => {
                this.updateInputs();
            },
            hideAllMaskLabels: () => {
                this.hideAllMaskLabels();
            },
            emitImageChanged: (context) => {
                this.emitImageChanged(context);
            },
            emitBusyChangeIfChanged: (context) => {
                this.emitBusyChangeIfChanged(context);
            },
            buildCallbackContext: (operation, isInternal) => this.buildCallbackContext(operation, isInternal),
            getMosaicSession: () => this.mosaicSession,
            setMosaicSession: (session) => {
                this.mosaicSession = session;
            },
        };
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
        enterCropModeImpl(cropControllerContext);
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
        cancelCropImpl(cropControllerContext);
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
            await applyCropImpl(cropControllerContext);
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
            loadImage: (base64, providedOptions) => this.loadImageInternal(base64, this.withInternalOperationOptions(operationToken, providedOptions !== null && providedOptions !== void 0 ? providedOptions : {})),
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
        if (scaleId) {
            const scaleInputElement = document.getElementById(scaleId);
            if (scaleInputElement) {
                scaleInputElement.value = String(Math.round(this.currentScale * 100));
            }
        }
        const mosaicConfig = this.getMosaicConfig();
        const mosaicBrushSizeInputId = this.elements.mosaicBrushSizeInput;
        if (mosaicBrushSizeInputId) {
            const brushInput = document.getElementById(mosaicBrushSizeInputId);
            if (brushInput)
                brushInput.value = String(mosaicConfig.brushSize);
        }
        const mosaicBlockSizeInputId = this.elements.mosaicBlockSizeInput;
        if (mosaicBlockSizeInputId) {
            const blockInput = document.getElementById(mosaicBlockSizeInputId);
            if (blockInput)
                blockInput.value = String(mosaicConfig.blockSize);
        }
    }
    updateUi() {
        var _a;
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
        const isInMosaicMode = this.mosaicSession !== null;
        const isBusy = this.operationGuard.isBusy() || this.animQueue.isBusy();
        const isMosaicApplying = ((_a = this.mosaicSession) === null || _a === void 0 ? void 0 : _a.isApplying) === true;
        if (isInCropMode) {
            CROP_MODE_CONTROL_KEYS.forEach((key) => {
                this.setControlEnabled(key, !isBusy && CROP_MODE_ENABLED_KEYS.includes(key));
            });
            return;
        }
        if (isInMosaicMode) {
            MOSAIC_MODE_CONTROL_KEYS.forEach((key) => {
                this.setControlEnabled(key, !isBusy && !isMosaicApplying && MOSAIC_MODE_ENABLED_KEYS.includes(key));
            });
            this.setControlEnabled('imageInput', false);
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
        this.setControlEnabled('enterMosaicModeButton', hasImage && !isBusy);
        this.setControlEnabled('exitMosaicModeButton', false);
        this.setControlEnabled('mosaicBrushSizeInput', !this.isDisposed);
        this.setControlEnabled('mosaicBlockSizeInput', !this.isDisposed);
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
        setPlaceholderVisibleImpl(this.placeholderElement, this.containerElement, this.options.showPlaceholder ? !this.originalImage : false);
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
                cancelCropImpl(context);
            }
            catch {
            }
            this.cropSession = null;
        }
        if (this.mosaicSession && this.canvas) {
            try {
                exitMosaicModeImpl(this.buildMosaicControllerContext());
            }
            catch {
            }
            this.mosaicSession = null;
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
//# sourceMappingURL=image-editor.js.map