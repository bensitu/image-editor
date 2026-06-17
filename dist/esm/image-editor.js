import { AnimationQueue } from './animation/animation-queue.js';
import { reportError, reportWarning } from './core/callback-reporter.js';
import { areResolvedMosaicConfigsEqual, areResolvedDrawConfigsEqual, areResolvedTextAnnotationConfigsEqual, cloneResolvedMosaicConfig, cloneResolvedDrawConfig, cloneResolvedTextAnnotationConfig, getInvalidDrawConfigFields, getInvalidMosaicConfigFields, getInvalidTextAnnotationConfigFields, isLayoutMode, mergeDrawConfigPatch, mergeMosaicConfigPatch, mergeTextAnnotationConfigPatch, resolveOptions, } from './core/default-options.js';
import { OperationGuard } from './core/operation-guard.js';
import { loadFromState as loadFromStateImpl, saveState as saveStateImpl, } from './core/state-serializer.js';
import { Command, HistoryManager } from './history/history-manager.js';
import { detectFabric } from './fabric/fabric-adapter.js';
import { isAnnotationObject, isDrawAnnotationObject, isEditableOverlayObject, isMaskObject, isTextAnnotationObject, } from './core/public-types.js';
import { getAnnotations as getAnnotationsImpl, removeAllAnnotations as removeAllAnnotationsImpl, removeAnnotationObjects, removeSelectedAnnotation as removeSelectedAnnotationImpl, renderAnnotationList, updateAnnotation as updateAnnotationImpl, updateAnnotationListSelection, updateSelectedAnnotation as updateSelectedAnnotationImpl, } from './annotation/annotation-manager.js';
import { attachTextEditingHandlersToAnnotations, createTextAnnotation as createTextAnnotationImpl, enterTextMode as enterTextModeImpl, exitTextMode as exitTextModeImpl, finalizeActiveTextEditing, } from './annotation/text-controller.js';
import { enterDrawMode as enterDrawModeImpl, exitDrawMode as exitDrawModeImpl, updateDrawBrush, } from './annotation/draw-controller.js';
import { isAnnotationLocked, isAnnotationUnlocked } from './annotation/annotation-lock.js';
import { syncAnnotationRuntimeStates } from './annotation/annotation-style.js';
import { normalizeLayerOrder, getEditableOverlayRange } from './core/layer-order.js';
import { applyCrop as applyCropImpl, cancelCrop as cancelCropImpl, enterCropMode as enterCropModeImpl, setCropAspectRatio as setCropAspectRatioImpl, } from './crop/crop-controller.js';
import { enterMosaicMode as enterMosaicModeImpl, exitMosaicMode as exitMosaicModeImpl, updateMosaicPreview, } from './mosaic/mosaic-controller.js';
import { downloadImage as downloadImageImpl, exportImageBase64 as exportImageBase64Impl, exportImageFile as exportImageFileImpl, mergeAnnotations as mergeAnnotationsImpl, mergeMasks as mergeMasksImpl, } from './export/export-service.js';
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
const CROP_SESSION_ALLOWED_OPERATIONS = new Set(['setCropAspectRatio', 'applyCrop', 'cancelCrop']);
const TEXT_MODE_ENABLED_KEYS = [
    'exitTextModeButton',
    'textColorInput',
    'textFontSizeInput',
];
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
        this.bindElementIfExists('flipHorizontalButton', 'click', () => {
            void this.flipHorizontal();
        });
        this.bindElementIfExists('flipVerticalButton', 'click', () => {
            void this.flipVertical();
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
        this.bindElementIfExists('mergeAnnotationsButton', 'click', () => {
            void this.mergeAnnotations();
        });
        this.bindElementIfExists('enterTextModeButton', 'click', () => {
            this.enterTextMode();
        });
        this.bindElementIfExists('exitTextModeButton', 'click', () => {
            this.exitTextMode();
        });
        this.bindElementIfExists('enterDrawModeButton', 'click', () => {
            this.enterDrawMode();
        });
        this.bindElementIfExists('exitDrawModeButton', 'click', () => {
            this.exitDrawMode();
        });
        this.bindElementIfExists('removeSelectedAnnotationButton', 'click', () => {
            this.removeSelectedAnnotation();
        });
        this.bindElementIfExists('removeAllAnnotationsButton', 'click', () => {
            this.removeAllAnnotations();
        });
        this.bindElementIfExists('deleteSelectedObjectButton', 'click', () => {
            this.deleteSelectedObject();
        });
        this.bindElementIfExists('bringSelectedObjectForwardButton', 'click', () => {
            this.bringSelectedObjectForward();
        });
        this.bindElementIfExists('sendSelectedObjectBackwardButton', 'click', () => {
            this.sendSelectedObjectBackward();
        });
        this.bindElementIfExists('bringSelectedObjectToFrontButton', 'click', () => {
            this.bringSelectedObjectToFront();
        });
        this.bindElementIfExists('sendSelectedObjectToBackButton', 'click', () => {
            this.sendSelectedObjectToBack();
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
            this.enterCropMode({ aspectRatio: this.getSelectedCropAspectRatio() });
        });
        this.bindElementIfExists('cropAspectRatioSelect', 'change', () => {
            if (this.cropSession)
                this.setCropAspectRatio(this.getSelectedCropAspectRatio());
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
        const bindStringInput = (key, applyValue) => {
            const handler = (event) => {
                applyValue(event.target.value);
            };
            this.bindElementIfExists(key, 'input', handler);
            this.bindElementIfExists(key, 'change', handler);
        };
        const bindNumberInput = (key, applyValue) => {
            const handler = (event) => {
                applyValue(parseFloat(event.target.value));
            };
            this.bindElementIfExists(key, 'input', handler);
            this.bindElementIfExists(key, 'change', handler);
        };
        bindStringInput('textColorInput', (value) => this.applyTextColorInput(value));
        bindNumberInput('textFontSizeInput', (value) => this.applyTextFontSizeInput(value));
        bindStringInput('drawColorInput', (value) => this.applyDrawColorInput(value));
        bindNumberInput('drawBrushSizeInput', (value) => this.applyDrawBrushSizeInput(value));
        this.bindKeyboardEvents();
    }
    bindElementIfExists(key, event, handler) {
        var _a;
        (_a = this.domBindings) === null || _a === void 0 ? void 0 : _a.bindIfExists(key, event, handler);
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
            getAnnotationCounter: () => this.annotationCounter,
            setAnnotationCounter: (v) => {
                this.annotationCounter = v;
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
        return getAnnotationsImpl(this.canvas);
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
    measureLayoutViewport(scrollbarSize) {
        return this.viewportCache.measure(this.containerElement, {
            width: this.options.canvasWidth,
            height: this.options.canvasHeight,
        }, scrollbarSize);
    }
    getScrollbarStableViewportCanvasSize(viewport) {
        return {
            width: Math.max(1, viewport.width - 1),
            height: Math.max(1, viewport.height - 1),
        };
    }
    updateCanvasSizeToImageBounds(options = {}) {
        var _a, _b;
        if (!this.originalImage)
            return;
        this.originalImage.setCoords();
        const boundingRect = this.originalImage.getBoundingRect();
        const scrollbarSize = measureScrollbarSize((_b = (_a = this.containerElement) === null || _a === void 0 ? void 0 : _a.ownerDocument) !== null && _b !== void 0 ? _b : null);
        const viewport = this.measureLayoutViewport(scrollbarSize);
        const shouldStabilizeContainedViewport = options.stabilizeContainedViewport !== false;
        const imageFitsViewport = boundingRect.width <= viewport.width + LAYOUT_EPSILON &&
            boundingRect.height <= viewport.height + LAYOUT_EPSILON;
        if (this.currentLayoutMode === 'fit' || this.currentLayoutMode === 'cover') {
            if (imageFitsViewport) {
                const canvasSize = shouldStabilizeContainedViewport
                    ? this.getScrollbarStableViewportCanvasSize(viewport)
                    : viewport;
                this.setCanvasSizePx(canvasSize.width, canvasSize.height);
                return;
            }
            const canvasSize = computeScrollableCanvasSize(boundingRect.width, boundingRect.height, viewport, scrollbarSize);
            this.setCanvasSizePx(canvasSize.width, canvasSize.height);
            return;
        }
        if (imageFitsViewport) {
            const canvasSize = shouldStabilizeContainedViewport
                ? this.getScrollbarStableViewportCanvasSize(viewport)
                : viewport;
            this.setCanvasSizePx(canvasSize.width, canvasSize.height);
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
            canvas: this.getLiveCanvasOrThrow('buildTransformContext'),
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
            const after = saveStateImpl({
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
            canvas: this.getLiveCanvasOrThrow('createMask'),
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
            canvas: this.getLiveCanvasOrThrow('removeMask'),
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
    enterTextMode() {
        if (!this.canvas)
            return;
        if (!this.canRunIdleOperation('enterTextMode'))
            return;
        if (this.isToolModeActive())
            return;
        enterTextModeImpl(this.buildTextControllerContext());
        const callbackContext = this.buildCallbackContext('enterTextMode', false);
        this.emitBusyChangeIfChanged(callbackContext);
        this.emitImageChanged(callbackContext);
    }
    exitTextMode() {
        if (!this.canvas || !this.textSession)
            return;
        if (!this.canRunIdleOperation('exitTextMode'))
            return;
        exitTextModeImpl(this.buildTextControllerContext());
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
        return createTextAnnotationImpl(this.buildTextControllerContext(), config);
    }
    enterDrawMode() {
        if (!this.canvas)
            return;
        if (!this.canRunIdleOperation('enterDrawMode'))
            return;
        if (this.isToolModeActive())
            return;
        enterDrawModeImpl(this.buildDrawControllerContext());
        const callbackContext = this.buildCallbackContext('enterDrawMode', false);
        this.emitBusyChangeIfChanged(callbackContext);
        this.emitImageChanged(callbackContext);
    }
    exitDrawMode() {
        if (!this.canvas || !this.drawSession)
            return;
        if (!this.canRunIdleOperation('exitDrawMode'))
            return;
        exitDrawModeImpl(this.buildDrawControllerContext());
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
            removeSelectedAnnotationImpl(this.buildAnnotationManagerContext());
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
            removeAllAnnotationsImpl(this.buildAnnotationManagerContext(), options);
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
        const changed = updateAnnotationImpl(this.buildAnnotationManagerContext(), annotationId, config);
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
        const changed = updateSelectedAnnotationImpl(this.buildAnnotationManagerContext(), config);
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
        return {
            canvas: this.getLiveCanvasOrThrow('annotationManager'),
            saveCanvasState: () => this.saveState(),
            updateUi: () => this.updateUi(),
        };
    }
    buildAnnotationListContext() {
        return {
            canvas: this.canvas,
            getListElementId: () => this.elements.annotationList,
            onAnnotationSelected: (annotation) => this.handleSelectionChanged([annotation]),
        };
    }
    updateAnnotationList() {
        renderAnnotationList(this.buildAnnotationListContext());
    }
    updateAnnotationListSelection(selectedAnnotation) {
        updateAnnotationListSelection(this.buildAnnotationListContext(), selectedAnnotation);
    }
    buildTextControllerContext() {
        return {
            fabric: this.fabricModule,
            canvas: this.getLiveCanvasOrThrow('textController'),
            options: this.options,
            getOriginalImage: () => this.originalImage,
            getTextConfig: () => this.currentTextConfig,
            isImageLoaded: () => this.isImageLoaded(),
            getAnnotationCounter: () => this.annotationCounter,
            setAnnotationCounter: (value) => {
                this.annotationCounter = value;
            },
            getTextSession: () => this.textSession,
            setTextSession: (session) => {
                this.textSession = session;
            },
            saveCanvasState: () => this.saveState(),
            updateAnnotationList: () => this.updateAnnotationList(),
            updateUi: () => this.updateUi(),
            emitAnnotationsChanged: (context) => this.emitAnnotationsChanged(context),
            emitImageChanged: (context) => this.emitImageChanged(context),
            buildCallbackContext: (operation) => this.buildCallbackContext(operation, false),
        };
    }
    buildDrawControllerContext() {
        return {
            fabric: this.fabricModule,
            canvas: this.getLiveCanvasOrThrow('drawController'),
            options: this.options,
            getDrawConfig: () => this.currentDrawConfig,
            isImageLoaded: () => this.isImageLoaded(),
            getAnnotationCounter: () => this.annotationCounter,
            setAnnotationCounter: (value) => {
                this.annotationCounter = value;
            },
            getDrawSession: () => this.drawSession,
            setDrawSession: (session) => {
                this.drawSession = session;
            },
            saveCanvasState: () => this.saveState(),
            updateAnnotationList: () => this.updateAnnotationList(),
            updateUi: () => this.updateUi(),
            emitAnnotationsChanged: (context) => this.emitAnnotationsChanged(context),
            emitImageChanged: (context) => this.emitImageChanged(context),
            buildCallbackContext: (operation) => this.buildCallbackContext(operation, false),
        };
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
            await mergeMasksImpl(mergeMasksContext);
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
            await downloadImageImpl(exportContext, options);
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
            return await exportImageBase64Impl(exportContext, options);
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
            canvas: this.getLiveCanvasOrThrow('export'),
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
            captureSnapshot: () => this.captureSnapshotInternal(),
            loadFromState: (snapshot) => this.loadFromStateInternal(snapshot, this.withInternalOperationOptions(operationToken, this.withAnimationQueueBypass())),
            exportImageBase64: (options) => exportImageBase64Impl(this.buildExportServiceContext(), options),
            updateUi: () => this.updateUi(),
            updateInputs: () => this.updateInputs(),
            removeAllMasksNoHistory: () => {
                const context = this.buildRemoveMaskContext();
                removeAllMasksImpl(context, { saveHistory: false });
            },
            getAnnotations: () => this.getAnnotations(),
            restoreAnnotations: (objects) => {
                const canvas = this.getLiveCanvasOrThrow('restoreAnnotations');
                objects.forEach((annotation) => {
                    canvas.add(annotation);
                });
                syncAnnotationRuntimeStates(objects);
                attachTextEditingHandlersToAnnotations(this.buildTextControllerContext(), objects);
                this.annotationCounter = Math.max(this.annotationCounter, ...objects.map((annotation) => annotation.annotationId), 0);
                this.updateAnnotationList();
            },
        };
    }
    buildMergeAnnotationsContext(operationToken) {
        return {
            ...this.buildExportServiceContext(),
            historyManager: this.historyManager,
            containerElement: this.containerElement,
            loadImage: async (base64, providedOptions) => {
                const geometry = this.captureImageDisplayGeometry();
                await this.loadImageInternal(base64, this.withInternalOperationOptions(operationToken, providedOptions !== null && providedOptions !== void 0 ? providedOptions : {}));
                this.restoreMergedImageDisplayGeometry(geometry);
            },
            captureSnapshot: () => this.captureSnapshotInternal(),
            loadFromState: (snapshot) => this.loadFromStateInternal(snapshot, this.withInternalOperationOptions(operationToken, this.withAnimationQueueBypass())),
            exportImageBase64: (options) => exportImageBase64Impl(this.buildExportServiceContext(), options),
            updateUi: () => this.updateUi(),
            updateInputs: () => this.updateInputs(),
            removeAllAnnotationsNoHistory: () => {
                removeAllAnnotationsImpl(this.buildAnnotationManagerContext(), {
                    saveHistory: false,
                    force: true,
                });
            },
            getMasks: () => this.getMasks(),
            restoreMasks: (objects) => {
                const canvas = this.getLiveCanvasOrThrow('restoreMasks');
                objects.forEach((mask) => {
                    canvas.add(mask);
                    reattachMaskHoverHandlers(mask);
                });
                this.lastMask = objects.reduce((lastMask, mask) => !lastMask || mask.maskId > lastMask.maskId ? mask : lastMask, null);
                this.maskCounter = Math.max(this.maskCounter, ...objects.map((mask) => mask.maskId), 0);
                this.updateMaskList();
            },
        };
    }
    captureSnapshotInternal() {
        var _a, _b;
        if (!this.canvas) {
            throw new Error('[ImageEditor] Cannot capture canvas snapshot before init or after dispose.');
        }
        const activeMask = this.getActiveMaskForSnapshot();
        const activeAnnotation = this.getActiveAnnotationForSnapshot();
        this.hideAllMaskLabels();
        return saveStateImpl({
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
            canvas: this.getLiveCanvasOrThrow('mosaicController'),
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
        enterCropModeImpl(cropControllerContext, options);
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
        setCropAspectRatioImpl(cropControllerContext, aspectRatio);
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
            canvas: this.getLiveCanvasOrThrow('cropController'),
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
    syncInputValue(inputElement, value) {
        if (!inputElement)
            return;
        const ownerDocument = inputElement.ownerDocument;
        if (ownerDocument.activeElement === inputElement && !inputElement.readOnly)
            return;
        if (inputElement.value !== value)
            inputElement.value = value;
    }
    updateInputs() {
        const scaleId = this.elements.scalePercentageInput;
        if (scaleId) {
            const scaleInputElement = document.getElementById(scaleId);
            this.syncInputValue(scaleInputElement, String(Math.round(this.currentScale * 100)));
        }
        const mosaicConfig = this.getMosaicConfig();
        const mosaicBrushSizeInputId = this.elements.mosaicBrushSizeInput;
        if (mosaicBrushSizeInputId) {
            const brushInput = document.getElementById(mosaicBrushSizeInputId);
            this.syncInputValue(brushInput, String(mosaicConfig.brushSize));
        }
        const mosaicBlockSizeInputId = this.elements.mosaicBlockSizeInput;
        if (mosaicBlockSizeInputId) {
            const blockInput = document.getElementById(mosaicBlockSizeInputId);
            this.syncInputValue(blockInput, String(mosaicConfig.blockSize));
        }
        const textConfig = this.getTextConfig();
        const textColorInputId = this.elements.textColorInput;
        if (textColorInputId) {
            const textColorInput = document.getElementById(textColorInputId);
            this.syncInputValue(textColorInput, textConfig.fill);
        }
        const textFontSizeInputId = this.elements.textFontSizeInput;
        if (textFontSizeInputId) {
            const fontInput = document.getElementById(textFontSizeInputId);
            this.syncInputValue(fontInput, String(textConfig.fontSize));
        }
        const drawConfig = this.getDrawConfig();
        const drawColorInputId = this.elements.drawColorInput;
        if (drawColorInputId) {
            const drawColorInput = document.getElementById(drawColorInputId);
            this.syncInputValue(drawColorInput, drawConfig.color);
        }
        const drawBrushSizeInputId = this.elements.drawBrushSizeInput;
        if (drawBrushSizeInputId) {
            const brushInput = document.getElementById(drawBrushSizeInputId);
            this.syncInputValue(brushInput, String(drawConfig.brushSize));
        }
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
            await mergeAnnotationsImpl(this.buildMergeAnnotationsContext(operationToken));
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
        var _a, _b, _c;
        if (!this.canvas)
            return;
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
        if (isInCropMode) {
            CROP_MODE_CONTROL_KEYS.forEach((key) => {
                this.setControlEnabled(key, !isBusy && CROP_MODE_ENABLED_KEYS.includes(key));
            });
            return;
        }
        if (isInTextMode) {
            CROP_MODE_CONTROL_KEYS.forEach((key) => {
                this.setControlEnabled(key, !isBusy && TEXT_MODE_ENABLED_KEYS.includes(key));
            });
            return;
        }
        if (isInDrawMode) {
            CROP_MODE_CONTROL_KEYS.forEach((key) => {
                this.setControlEnabled(key, !isBusy && DRAW_MODE_ENABLED_KEYS.includes(key));
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
        this.setControlEnabled('flipHorizontalButton', hasImage && !isBusy);
        this.setControlEnabled('flipVerticalButton', hasImage && !isBusy);
        this.setControlEnabled('createMaskButton', hasImage && !isBusy);
        this.setControlEnabled('removeSelectedMaskButton', hasSelectedMask && !isBusy);
        this.setControlEnabled('removeAllMasksButton', hasMasks && !isBusy);
        this.setControlEnabled('mergeMasksButton', hasImage && hasMasks && !isBusy);
        this.setControlEnabled('removeSelectedAnnotationButton', hasSelectedAnnotation && !isBusy);
        this.setControlEnabled('removeAllAnnotationsButton', hasAnnotations && !isBusy);
        this.setControlEnabled('deleteSelectedObjectButton', hasSelectedEditableObject && !isBusy);
        this.setControlEnabled('mergeAnnotationsButton', hasImage && hasAnnotations && !isBusy);
        this.setControlEnabled('bringSelectedObjectForwardButton', hasSelectedEditableObject && !isBusy);
        this.setControlEnabled('sendSelectedObjectBackwardButton', hasSelectedEditableObject && !isBusy);
        this.setControlEnabled('bringSelectedObjectToFrontButton', hasSelectedEditableObject && !isBusy);
        this.setControlEnabled('sendSelectedObjectToBackButton', hasSelectedEditableObject && !isBusy);
        this.setControlEnabled('downloadImageButton', hasImage && !isBusy);
        this.setControlEnabled('resetImageTransformButton', hasImage && !isDefaultTransform && !isBusy);
        this.setControlEnabled('undoButton', hasImage && !isBusy && canUndo);
        this.setControlEnabled('redoButton', hasImage && !isBusy && canRedo);
        this.setControlEnabled('enterCropModeButton', hasImage && !isBusy);
        this.setControlEnabled('cropAspectRatioSelect', hasImage && !isBusy);
        this.setControlEnabled('enterMosaicModeButton', hasImage && !isBusy);
        this.setControlEnabled('enterTextModeButton', hasImage && !isBusy);
        this.setControlEnabled('enterDrawModeButton', hasImage && !isBusy);
        this.setControlEnabled('exitMosaicModeButton', false);
        this.setControlEnabled('exitTextModeButton', false);
        this.setControlEnabled('exitDrawModeButton', false);
        this.setControlEnabled('mosaicBrushSizeInput', !this.isDisposed);
        this.setControlEnabled('mosaicBlockSizeInput', !this.isDisposed);
        this.setControlEnabled('textColorInput', !this.isDisposed);
        this.setControlEnabled('textFontSizeInput', !this.isDisposed);
        this.setControlEnabled('drawColorInput', !this.isDisposed);
        this.setControlEnabled('drawBrushSizeInput', !this.isDisposed);
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
        if (this.textSession && this.canvas) {
            try {
                exitTextModeImpl(this.buildTextControllerContext());
            }
            catch {
            }
            this.textSession = null;
        }
        if (this.drawSession && this.canvas) {
            try {
                exitDrawModeImpl(this.buildDrawControllerContext());
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
//# sourceMappingURL=image-editor.js.map