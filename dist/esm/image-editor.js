import { AnimationQueue } from './animation/animation-queue.js';
import { reportError, reportWarning } from './core/callback-reporter.js';
import { resolveElementIds, } from './core/editor-elements.js';
import { cloneResolvedMosaicConfig, cloneResolvedDrawConfig, cloneResolvedTextAnnotationConfig, isLayoutMode, resolveOptions, } from './core/default-options.js';
import { OperationGuard } from './core/operation-guard.js';
import { HistoryManager } from './history/history-manager.js';
import { captureSnapshotAction, loadFromStateAction, saveStateAction, } from './history/editor-state-actions.js';
import { detectFabric } from './fabric/fabric-adapter.js';
import { isAnnotationObject, isEditableOverlayObject, isMaskObject } from './core/public-types.js';
import { getAnnotations as getAnnotationsImpl, renderAnnotationList, updateAnnotationListSelection, } from './annotation/annotation-manager.js';
import { exitTextMode as exitTextModeImpl, finalizeActiveTextEditing, } from './annotation/text-controller.js';
import { exitDrawMode as exitDrawModeImpl, } from './annotation/draw-controller.js';
import { createTextAnnotationAction, enterDrawModeAction, enterTextModeAction, exitDrawModeAction, exitTextModeAction, } from './annotation/annotation-mode-actions.js';
import { applyDrawBrushSizeInputAction, applyDrawColorInputAction, applyDrawConfigPatchAction, applyTextColorInputAction, applyTextConfigPatchAction, applyTextFontSizeInputAction, } from './annotation/annotation-config-actions.js';
import { cancelCrop as cancelCropImpl, } from './crop/crop-controller.js';
import { applyCropAction, cancelCropAction, enterCropModeAction, setCropAspectRatioAction, } from './crop/crop-actions.js';
import { exitMosaicMode as exitMosaicModeImpl, } from './mosaic/mosaic-controller.js';
import { applyMosaicConfigPatchAction, enterMosaicModeAction, exitMosaicModeAction, resetMosaicConfigAction, } from './mosaic/mosaic-actions.js';
import { downloadImageAction, exportImageBase64Action, exportImageFileAction, mergeAnnotationsAction, mergeMasksAction, } from './export/export-actions.js';
import { loadImage as loadImageImpl } from './image/image-loader.js';
import { loadImageFile as loadImageFileImpl } from './image/image-file-loader.js';
import { captureImageDisplayGeometry as captureImageDisplayGeometryImpl, getScrollbarStableViewportCanvasSize as getScrollbarStableViewportCanvasSizeImpl, measureLayoutViewport as measureLayoutViewportImpl, restoreMergedImageDisplayGeometry as restoreMergedImageDisplayGeometryImpl, settleFitCoverScrollbarsAfterStateRestore as settleFitCoverScrollbarsAfterStateRestoreImpl, shouldNormalizeCanvasSizeAfterStateRestore as shouldNormalizeCanvasSizeAfterStateRestoreImpl, updateCanvasSizeToImageBounds as updateCanvasSizeToImageBoundsImpl, } from './image/display-geometry.js';
import { ViewportCache, applyCanvasDimensions } from './image/layout-manager.js';
import { TransformController } from './image/transform-controller.js';
import { flipHorizontalAction, flipVerticalAction, resetImageTransformAction, rotateImageAction, scaleImageAction, } from './image/transform-actions.js';
import { EditorContextFactory } from './runtime/editor-contexts.js';
import { handleObjectModified as handleObjectModifiedImpl, handleObjectMovingScalingRotating as handleObjectMovingScalingRotatingImpl, handleSelectionChanged as handleSelectionChangedImpl, } from './selection/editor-selection-controller.js';
import { deleteSelectedEditableObjects, moveSelectedEditableObject as moveSelectedEditableObjectImpl, removeAllAnnotationsAction, removeSelectedAnnotationAction, updateAnnotationAction, updateSelectedAnnotationAction, } from './overlay/editable-object-actions.js';
import { createMaskAction, removeAllMasksAction as removeAllMasksActionImpl, removeSelectedMaskAction, } from './mask/mask-actions.js';
import { createLabelForMask, hideAllMaskLabels, removeLabelForMask, showLabelForMask, syncMaskLabel, } from './mask/mask-label-manager.js';
import { renderMaskList, updateMaskListSelection } from './mask/mask-list.js';
import { safelyDisposeCanvas, safelyExitActiveSession, safelyRemoveKeyboardListener, } from './lifecycle/editor-dispose.js';
import { DomBindings } from './ui/dom-bindings.js';
import { applyEditorControlState } from './ui/editor-control-state.js';
import { restoreEditorControlOriginalStates, setEditorControlEnabled, } from './ui/editor-control-elements.js';
import { bindEditorDomEvents } from './ui/editor-dom-events.js';
import { applyEditorInputState } from './ui/editor-input-state.js';
import { bindEditorKeyboardEvents, handleEditorKeyboardEvent, isFabricTextEditingActive, } from './ui/editor-keyboard-events.js';
import { setPlaceholderVisible as setPlaceholderVisibleImpl } from './ui/visibility-state.js';
import { canRunOperationInToolMode, getActiveToolMode as getActiveToolModeFromSnapshot, isImageEditorOperation, isToolModeActive as isToolModeActiveFromSnapshot, } from './tool-mode/tool-mode-policy.js';
import { isSupportedImageDataUrl } from './utils/file.js';
import { detectSourceMimeType } from './image/image-resampler.js';
const INTERNAL_OPERATION_TOKEN = Symbol('ImageEditorInternalOperation');
const INTERNAL_ALLOW_DURING_ANIMATION_QUEUE = Symbol('ImageEditorAllowDuringAnimationQueue');
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
                setPlaceholderVisibleImpl(this.placeholderElement, this.containerElement, this.options.showPlaceholder ? show : false);
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
        this.elements = resolveElementIds(idMap);
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
        bindEditorKeyboardEvents({
            getOwnerDocument: () => { var _a, _b; return (_b = (_a = this.canvasElement) === null || _a === void 0 ? void 0 : _a.ownerDocument) !== null && _b !== void 0 ? _b : document; },
            getKeyboardDocument: () => this.keyboardDocument,
            getKeyboardHandler: () => this.keyboardHandler,
            setKeyboardBinding: (keyboardDocument, keyboardHandler) => {
                this.keyboardDocument = keyboardDocument;
                this.keyboardHandler = keyboardHandler;
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
            isDisposed: () => this.isDisposed,
            getCanvas: () => this.canvas,
            getKeyboardDocument: () => this.keyboardDocument,
            hasTextSession: () => this.textSession !== null,
            hasDrawSession: () => this.drawSession !== null,
            hasMosaicSession: () => this.mosaicSession !== null,
            hasCropSession: () => this.cropSession !== null,
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
        if (!this.canvas || !isFabricTextEditingActive(this.canvas))
            return;
        finalizeActiveTextEditing(this.buildTextControllerContext(), { commit: true });
    }
    async loadImageFile(file) {
        await loadImageFileImpl({
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
            !canRunOperationInToolMode(activeToolMode, operationName)) {
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
            !canRunOperationInToolMode(activeToolMode, operationName)) {
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
    buildBusyOperationAccess() {
        return {
            beginBusyOperation: (operation) => this.operationGuard.beginBusyOperation(operation),
            endBusyOperation: (token) => {
                this.operationGuard.endBusyOperation(token);
            },
            buildCallbackContext: (operation, isInternalOperation) => this.buildCallbackContext(operation, isInternalOperation),
            emitBusyChangeIfChanged: (context) => {
                this.emitBusyChangeIfChanged(context);
            },
            updateUi: () => {
                this.updateUi();
            },
        };
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
    buildToolModeSnapshot() {
        return {
            hasCropSession: this.cropSession !== null,
            hasMosaicSession: this.mosaicSession !== null,
            hasTextSession: this.textSession !== null,
            hasDrawSession: this.drawSession !== null,
        };
    }
    getActiveToolMode() {
        return getActiveToolModeFromSnapshot(this.buildToolModeSnapshot());
    }
    isToolModeActive() {
        return isToolModeActiveFromSnapshot(this.buildToolModeSnapshot());
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
        return measureLayoutViewportImpl(this.buildDisplayGeometryContext(), scrollbarSize);
    }
    getScrollbarStableViewportCanvasSize(viewport) {
        return getScrollbarStableViewportCanvasSizeImpl(viewport);
    }
    updateCanvasSizeToImageBounds(options = {}) {
        updateCanvasSizeToImageBoundsImpl(this.buildDisplayGeometryContext(), options);
    }
    shouldNormalizeCanvasSizeAfterStateRestore() {
        return shouldNormalizeCanvasSizeAfterStateRestoreImpl(this.buildDisplayGeometryContext());
    }
    settleFitCoverScrollbarsAfterStateRestore() {
        settleFitCoverScrollbarsAfterStateRestoreImpl(this.buildDisplayGeometryContext());
    }
    captureImageDisplayGeometry() {
        return captureImageDisplayGeometryImpl(this.buildDisplayGeometryContext());
    }
    restoreMergedImageDisplayGeometry(geometry) {
        restoreMergedImageDisplayGeometryImpl(this.buildDisplayGeometryContext(), geometry);
    }
    buildTransformContext() {
        return this.contextFactory.buildTransformContext();
    }
    buildTransformActionAccess() {
        return {
            isDisposed: () => this.isDisposed,
            getTransformController: () => this.transformController,
            assertCanQueueAnimation: (operation) => {
                this.assertCanQueueAnimation(operation);
            },
            buildCallbackContext: (operation, isInternalOperation) => this.buildCallbackContext(operation, isInternalOperation),
            enqueueAnimation: (body) => this.animQueue.add(body),
            updateInputs: () => {
                this.updateInputs();
            },
            updateUi: () => {
                this.updateUi();
            },
            refreshUiAfterQueuedAnimation: () => {
                this.refreshUiAfterQueuedAnimation();
            },
            emitImageChanged: (context) => {
                this.emitImageChanged(context);
            },
            emitBusyChangeIfChanged: (context) => {
                this.emitBusyChangeIfChanged(context);
            },
        };
    }
    scaleImage(factor) {
        return scaleImageAction(this.buildTransformActionAccess(), factor);
    }
    rotateImage(degrees) {
        return rotateImageAction(this.buildTransformActionAccess(), degrees);
    }
    flipHorizontal() {
        return flipHorizontalAction(this.buildTransformActionAccess());
    }
    flipVertical() {
        return flipVerticalAction(this.buildTransformActionAccess());
    }
    resetImageTransform() {
        return resetImageTransformAction(this.buildTransformActionAccess());
    }
    refreshUiAfterQueuedAnimation() {
        if (this.isDisposed || !this.canvas)
            return;
        this.updateInputs();
        this.updateUi();
    }
    buildEditorStateActionAccess() {
        return {
            getCanvas: () => this.canvas,
            getLiveCanvas: (operationName) => this.getLiveCanvasOrThrow(operationName),
            getOptions: () => this.options,
            isDisposed: () => this.isDisposed,
            canRunIdleOperation: (operation, options) => this.canRunIdleOperation(operation, options),
            getActiveStateRestoreOperation: () => this.activeStateRestoreOperation,
            buildCallbackContext: (operation, isInternalOperation) => this.buildCallbackContext(operation, isInternalOperation),
            getOriginalImage: () => this.originalImage,
            setOriginalImage: (image) => {
                this.originalImage = image;
            },
            getMaskCollectionSignature: () => this.getMaskCollectionSignature(),
            getAnnotationCollectionSignature: () => this.getAnnotationCollectionSignature(),
            setCanvasSize: (widthPx, heightPx) => {
                this.setCanvasSizePx(widthPx, heightPx);
            },
            hideAllMaskLabels: () => {
                this.hideAllMaskLabels();
            },
            inferCurrentImageMimeType: () => this.inferCurrentImageMimeType(),
            setCurrentImageMimeType: (mimeType) => {
                this.currentImageMimeType = mimeType;
            },
            setIsImageLoadedToCanvas: (value) => {
                this.isImageLoadedToCanvas = value;
            },
            setMaskCounter: (value) => {
                this.maskCounter = value;
            },
            setAnnotationCounter: (value) => {
                this.annotationCounter = value;
            },
            setCurrentScale: (value) => {
                this.currentScale = value;
            },
            setCurrentRotation: (value) => {
                this.currentRotation = value;
            },
            setBaseImageScale: (value) => {
                this.baseImageScale = value;
            },
            setLastMask: (mask) => {
                this.lastMask = mask;
            },
            getLastSnapshot: () => this.lastSnapshot,
            setLastSnapshot: (snapshot) => {
                this.lastSnapshot = snapshot;
            },
            shouldNormalizeCanvasSizeAfterStateRestore: () => this.shouldNormalizeCanvasSizeAfterStateRestore(),
            updateCanvasSizeToImageBounds: (options) => {
                this.updateCanvasSizeToImageBounds(options);
            },
            alignObjectBoundingBoxToCanvasTopLeft: (object) => {
                this.alignObjectBoundingBoxToCanvasTopLeft(object);
            },
            settleFitCoverScrollbarsAfterStateRestore: () => {
                this.settleFitCoverScrollbarsAfterStateRestore();
            },
            buildTextControllerContext: () => this.buildTextControllerContext(),
            updateInputs: () => {
                this.updateInputs();
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
            emitImageCleared: (image, context) => {
                this.emitOptionCallback('onImageCleared', [image, context]);
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
            withSelectionChangeContext: (context, callback) => this.withSelectionChangeContext(context, callback),
            handleSelectionChanged: (selected) => {
                this.handleSelectionChanged(selected);
            },
            shouldSuppressSaveState: () => this.shouldSuppressSaveState,
            getCurrentScale: () => this.currentScale,
            getCurrentRotation: () => this.currentRotation,
            getBaseImageScale: () => this.baseImageScale,
            getCurrentImageMimeType: () => this.currentImageMimeType,
            getHistoryManager: () => this.historyManager,
            withAnimationQueueBypass: () => this.withAnimationQueueBypass(),
            showLabelForMask: (mask) => {
                this.showLabelForMask(mask);
            },
            updateMaskListSelection: (mask) => {
                this.updateMaskListSelection(mask);
            },
            updateAnnotationListSelection: (annotation) => {
                this.updateAnnotationListSelection(annotation);
            },
        };
    }
    async loadFromState(jsonString) {
        return this.loadFromStateInternal(jsonString);
    }
    async loadFromStateInternal(jsonString, options) {
        await loadFromStateAction(this.buildEditorStateActionAccess(), jsonString, options);
    }
    saveState() {
        this.saveStateInternal();
    }
    saveStateInternal(options) {
        saveStateAction(this.buildEditorStateActionAccess(), options);
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
    buildMaskActionAccess() {
        return {
            getCanvas: () => this.canvas,
            getMasks: () => this.getMasks(),
            canRunIdleOperation: (operation, options) => this.canRunIdleOperation(operation, options),
            buildCallbackContext: (operation, isInternalOperation) => this.buildCallbackContext(operation, isInternalOperation),
            buildCreateMaskContext: () => this.buildCreateMaskContext(),
            buildRemoveMaskContext: () => this.buildRemoveMaskContext(),
            withSelectionChangeContext: (context, callback) => this.withSelectionChangeContext(context, callback),
            updateUi: () => {
                this.updateUi();
            },
            emitMasksChanged: (context) => {
                this.emitMasksChanged(context);
            },
            emitImageChanged: (context) => {
                this.emitImageChanged(context);
            },
        };
    }
    createMask(config = {}) {
        return createMaskAction(this.buildMaskActionAccess(), config);
    }
    removeSelectedMask() {
        removeSelectedMaskAction(this.buildMaskActionAccess());
    }
    removeAllMasks(options = {}) {
        removeAllMasksActionImpl(this.buildMaskActionAccess(), options);
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
    buildSelectionControllerAccess() {
        return {
            getCanvas: () => this.canvas,
            removeLabelForMask: (mask) => {
                this.removeLabelForMask(mask);
            },
            showLabelForMask: (mask) => {
                this.showLabelForMask(mask);
            },
            syncMaskLabel: (mask) => {
                this.syncMaskLabel(mask);
            },
            updateMaskListSelection: (mask) => {
                this.updateMaskListSelection(mask);
            },
            updateAnnotationListSelection: (annotation) => {
                this.updateAnnotationListSelection(annotation);
            },
            updateUi: () => {
                this.updateUi();
            },
            saveState: () => {
                this.saveState();
            },
            getNextSelectionChangeContext: () => this.nextSelectionChangeContext,
            getActiveStateRestoreOperation: () => this.activeStateRestoreOperation,
            buildSelection: (selected) => this.buildSelection(selected),
            buildCallbackContext: (operation, isHistoryRestore) => this.buildCallbackContext(operation, isHistoryRestore),
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
        };
    }
    handleObjectMovingScalingRotating(target) {
        handleObjectMovingScalingRotatingImpl(this.buildSelectionControllerAccess(), target);
    }
    handleObjectModified(target) {
        handleObjectModifiedImpl(this.buildSelectionControllerAccess(), target);
    }
    handleSelectionChanged(selected) {
        handleSelectionChangedImpl(this.buildSelectionControllerAccess(), selected);
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
    buildAnnotationModeActionAccess() {
        return {
            getCanvas: () => this.canvas,
            getTextSession: () => this.textSession,
            getDrawSession: () => this.drawSession,
            isToolModeActive: () => this.isToolModeActive(),
            canRunIdleOperation: (operation) => this.canRunIdleOperation(operation),
            buildTextControllerContext: () => this.buildTextControllerContext(),
            buildDrawControllerContext: () => this.buildDrawControllerContext(),
            buildCallbackContext: (operation, isInternalOperation) => this.buildCallbackContext(operation, isInternalOperation),
            emitBusyChangeIfChanged: (context) => {
                this.emitBusyChangeIfChanged(context);
            },
            emitImageChanged: (context) => {
                this.emitImageChanged(context);
            },
        };
    }
    enterTextMode() {
        enterTextModeAction(this.buildAnnotationModeActionAccess());
    }
    exitTextMode() {
        exitTextModeAction(this.buildAnnotationModeActionAccess());
    }
    isTextMode() {
        return this.textSession !== null;
    }
    createTextAnnotation(config = {}) {
        return createTextAnnotationAction(this.buildAnnotationModeActionAccess(), config);
    }
    enterDrawMode() {
        enterDrawModeAction(this.buildAnnotationModeActionAccess());
    }
    exitDrawMode() {
        exitDrawModeAction(this.buildAnnotationModeActionAccess());
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
    buildEditableObjectActionAccess() {
        return {
            getCanvas: () => this.canvas,
            getLiveCanvas: (operationName) => this.getLiveCanvasOrThrow(operationName),
            buildAnnotationManagerContext: () => this.buildAnnotationManagerContext(),
            getMasks: () => this.getMasks(),
            getAnnotations: () => this.getAnnotations(),
            removeLabelForMask: (mask) => {
                this.removeLabelForMask(mask);
            },
            withSelectionChangeContext: (context, callback) => this.withSelectionChangeContext(context, callback),
            buildCallbackContext: (operation, isInternalOperation) => this.buildCallbackContext(operation, isInternalOperation),
            saveState: () => {
                this.saveState();
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
            emitMasksChanged: (context) => {
                this.emitMasksChanged(context);
            },
            emitAnnotationsChanged: (context) => {
                this.emitAnnotationsChanged(context);
            },
            emitImageChanged: (context) => {
                this.emitImageChanged(context);
            },
            reportWarning: (message) => {
                reportWarning(this.options, null, message);
            },
        };
    }
    removeSelectedAnnotation() {
        if (!this.canvas)
            return;
        if (!this.canRunIdleOperation('removeSelectedAnnotation'))
            return;
        const callbackContext = this.buildCallbackContext('removeSelectedAnnotation', false);
        removeSelectedAnnotationAction(this.buildEditableObjectActionAccess(), callbackContext);
    }
    removeAllAnnotations(options = {}) {
        if (!this.canvas)
            return;
        if (!this.canRunIdleOperation('removeAllAnnotations', options))
            return;
        const callbackContext = this.buildCallbackContext('removeAllAnnotations', false);
        removeAllAnnotationsAction(this.buildEditableObjectActionAccess(), options, callbackContext);
    }
    updateAnnotation(annotationId, config) {
        if (!this.canvas)
            return;
        if (!this.canRunIdleOperation('updateAnnotation'))
            return;
        const callbackContext = this.buildCallbackContext('updateAnnotation', false);
        updateAnnotationAction(this.buildEditableObjectActionAccess(), annotationId, config, callbackContext);
    }
    updateSelectedAnnotation(config) {
        if (!this.canvas)
            return;
        if (!this.canRunIdleOperation('updateSelectedAnnotation'))
            return;
        const callbackContext = this.buildCallbackContext('updateSelectedAnnotation', false);
        updateSelectedAnnotationAction(this.buildEditableObjectActionAccess(), config, callbackContext);
    }
    deleteSelectedObject() {
        if (!this.canvas)
            return;
        if (!this.canRunIdleOperation('deleteSelectedObject'))
            return;
        this.finalizeActiveTextEditingIfNeeded();
        const callbackContext = this.buildCallbackContext('deleteSelectedObject', false);
        deleteSelectedEditableObjects(this.buildEditableObjectActionAccess(), callbackContext);
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
    buildAnnotationConfigActionAccess() {
        return {
            getCanvas: () => this.canvas,
            isTextMode: () => this.isTextMode(),
            isDrawMode: () => this.isDrawMode(),
            getCurrentTextConfig: () => this.currentTextConfig,
            setCurrentTextConfig: (config) => {
                this.currentTextConfig = config;
            },
            getDefaultTextConfig: () => this.defaultTextConfig,
            getCurrentDrawConfig: () => this.currentDrawConfig,
            setCurrentDrawConfig: (config) => {
                this.currentDrawConfig = config;
            },
            getDefaultDrawConfig: () => this.defaultDrawConfig,
            canRunIdleOperation: (operation) => this.canRunIdleOperation(operation),
            buildDrawControllerContext: () => this.buildDrawControllerContext(),
            buildCallbackContext: (operation, isInternalOperation) => this.buildCallbackContext(operation, isInternalOperation),
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
            reportWarning: (error, message) => {
                reportWarning(this.options, error, message);
            },
            updateInputs: () => {
                this.updateInputs();
            },
            updateUi: () => {
                this.updateUi();
            },
            emitImageChanged: (context) => {
                this.emitImageChanged(context);
            },
        };
    }
    applyTextConfigPatch(config, operation) {
        applyTextConfigPatchAction(this.buildAnnotationConfigActionAccess(), config, operation);
    }
    applyDrawConfigPatch(config, operation) {
        applyDrawConfigPatchAction(this.buildAnnotationConfigActionAccess(), config, operation);
    }
    applyTextColorInput(color) {
        applyTextColorInputAction(this.buildAnnotationConfigActionAccess(), color);
    }
    applyTextFontSizeInput(size) {
        applyTextFontSizeInputAction(this.buildAnnotationConfigActionAccess(), size);
    }
    applyDrawColorInput(color) {
        applyDrawColorInputAction(this.buildAnnotationConfigActionAccess(), color);
    }
    applyDrawBrushSizeInput(size) {
        applyDrawBrushSizeInputAction(this.buildAnnotationConfigActionAccess(), size);
    }
    moveSelectedEditableObject(operation) {
        if (!this.canvas)
            return;
        if (!this.canRunIdleOperation(operation))
            return;
        moveSelectedEditableObjectImpl(this.buildEditableObjectActionAccess(), operation);
    }
    buildExportActionAccess() {
        return {
            getCanvas: () => this.canvas,
            getAnnotations: () => this.getAnnotations(),
            getMasks: () => this.getMasks(),
            canRunIdleOperation: (operation, options) => this.canRunIdleOperation(operation, options),
            assertIdleForOperation: (operation, options) => {
                this.assertIdleForOperation(operation, options);
            },
            finalizeActiveTextEditingIfNeeded: () => {
                this.finalizeActiveTextEditingIfNeeded();
            },
            buildExportServiceContext: () => this.buildExportServiceContext(),
            buildMergeMasksContext: (token) => this.buildMergeMasksContext(token),
            buildMergeAnnotationsContext: (token) => this.buildMergeAnnotationsContext(token),
            buildBusyOperationAccess: () => this.buildBusyOperationAccess(),
            updateInputs: () => {
                this.updateInputs();
            },
            updateMaskList: () => {
                this.updateMaskList();
            },
            updateAnnotationList: () => {
                this.updateAnnotationList();
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
        };
    }
    async mergeMasks() {
        await mergeMasksAction(this.buildExportActionAccess());
    }
    async downloadImage(options) {
        await downloadImageAction(this.buildExportActionAccess(), options);
    }
    async exportImageBase64(options) {
        return await exportImageBase64Action(this.buildExportActionAccess(), options);
    }
    async exportImageFile(options) {
        return await exportImageFileAction(this.buildExportActionAccess(), options);
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
        return captureSnapshotAction(this.buildEditorStateActionAccess());
    }
    buildMosaicActionAccess() {
        return {
            getCanvas: () => this.canvas,
            getOriginalImage: () => this.originalImage,
            getMosaicSession: () => this.mosaicSession,
            getMosaicConfig: () => this.currentMosaicConfig,
            setMosaicConfig: (config) => {
                this.currentMosaicConfig = config;
            },
            getDefaultMosaicConfig: () => this.defaultMosaicConfig,
            getOptions: () => this.options,
            isDisposed: () => this.isDisposed,
            isImageLoaded: () => this.isImageLoaded(),
            canRunIdleOperation: (operation) => this.canRunIdleOperation(operation),
            buildMosaicControllerContext: () => this.buildMosaicControllerContext(),
            buildCallbackContext: (operation, isInternalOperation) => this.buildCallbackContext(operation, isInternalOperation),
            updateInputs: () => {
                this.updateInputs();
            },
            updateUi: () => {
                this.updateUi();
            },
            emitImageChanged: (context) => {
                this.emitImageChanged(context);
            },
            emitBusyChangeIfChanged: (context) => {
                this.emitBusyChangeIfChanged(context);
            },
        };
    }
    enterMosaicMode() {
        enterMosaicModeAction(this.buildMosaicActionAccess());
    }
    exitMosaicMode() {
        exitMosaicModeAction(this.buildMosaicActionAccess());
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
        resetMosaicConfigAction(this.buildMosaicActionAccess());
    }
    setMosaicBrushSize(size) {
        this.applyMosaicConfigPatch({ brushSize: size }, 'setMosaicBrushSize');
    }
    setMosaicBlockSize(size) {
        this.applyMosaicConfigPatch({ blockSize: size }, 'setMosaicBlockSize');
    }
    applyMosaicConfigPatch(config, operation) {
        applyMosaicConfigPatchAction(this.buildMosaicActionAccess(), config, operation);
    }
    buildMosaicControllerContext() {
        return this.contextFactory.buildMosaicControllerContext();
    }
    buildCropActionAccess() {
        return {
            getCanvas: () => this.canvas,
            getOriginalImage: () => this.originalImage,
            getCropSession: () => this.cropSession,
            setCropSession: (session) => {
                this.cropSession = session;
            },
            isImageLoaded: () => this.isImageLoaded(),
            canRunIdleOperation: (operation) => this.canRunIdleOperation(operation),
            buildCropControllerContext: (token) => this.buildCropControllerContext(token),
            buildBusyOperationAccess: () => this.buildBusyOperationAccess(),
            buildCallbackContext: (operation, isInternalOperation) => this.buildCallbackContext(operation, isInternalOperation),
            getMasks: () => this.getMasks(),
            updateInputs: () => {
                this.updateInputs();
            },
            updateMaskList: () => {
                this.updateMaskList();
            },
            updateUi: () => {
                this.updateUi();
            },
            emitMasksChanged: (context) => {
                this.emitMasksChanged(context);
            },
            emitImageChanged: (context) => {
                this.emitImageChanged(context);
            },
            emitBusyChangeIfChanged: (context) => {
                this.emitBusyChangeIfChanged(context);
            },
        };
    }
    enterCropMode(options = {}) {
        enterCropModeAction(this.buildCropActionAccess(), options);
    }
    setCropAspectRatio(aspectRatio) {
        setCropAspectRatioAction(this.buildCropActionAccess(), aspectRatio);
    }
    cancelCrop() {
        cancelCropAction(this.buildCropActionAccess());
    }
    async applyCrop() {
        await applyCropAction(this.buildCropActionAccess());
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
        await mergeAnnotationsAction(this.buildExportActionAccess());
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
        safelyRemoveKeyboardListener(this.keyboardDocument, this.keyboardHandler);
        this.keyboardHandler = null;
        this.keyboardDocument = null;
        this.restoreElementOriginalStates();
        safelyExitActiveSession(this.cropSession !== null, this.canvas, () => cancelCropImpl(this.buildCropControllerContext()), () => {
            this.cropSession = null;
        });
        safelyExitActiveSession(this.mosaicSession !== null, this.canvas, () => exitMosaicModeImpl(this.buildMosaicControllerContext()), () => {
            this.mosaicSession = null;
        });
        safelyExitActiveSession(this.textSession !== null, this.canvas, () => exitTextModeImpl(this.buildTextControllerContext()), () => {
            this.textSession = null;
        });
        safelyExitActiveSession(this.drawSession !== null, this.canvas, () => exitDrawModeImpl(this.buildDrawControllerContext()), () => {
            this.drawSession = null;
        });
        if (this.canvas) {
            safelyDisposeCanvas(this.canvas);
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