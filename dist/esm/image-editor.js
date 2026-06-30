import { reportError, reportWarning } from './core/callback-reporter.js';
import { IdleGuardError } from './core/errors.js';
import { resolveDomElement, resolveElementTargets, } from './core/editor-elements.js';
import { cloneResolvedMosaicConfig, cloneResolvedDrawConfig, cloneResolvedTextAnnotationConfig, isLayoutMode, resolveOptions, } from './core/default-options.js';
import { captureSnapshotAction, loadFromStateAction, saveStateAction, } from './history/editor-state-actions.js';
import { detectFabric } from './fabric/fabric-adapter.js';
import { isAnnotationObject, isMaskObject } from './core/public-types.js';
import { getActiveSelectionObjects, getAnnotations as getAnnotationsImpl, renderAnnotationList, updateAnnotationListSelection, } from './annotation/annotation-manager.js';
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
import { captureImageDisplayGeometry as captureImageDisplayGeometryImpl, measureLayoutViewport as measureLayoutViewportImpl, restoreMergedImageDisplayGeometry as restoreMergedImageDisplayGeometryImpl, settleFitCoverScrollbarsAfterStateRestore as settleFitCoverScrollbarsAfterStateRestoreImpl, shouldNormalizeCanvasSizeAfterStateRestore as shouldNormalizeCanvasSizeAfterStateRestoreImpl, updateCanvasSizeToImageBounds as updateCanvasSizeToImageBoundsImpl, } from './image/display-geometry.js';
import { applyCanvasDimensions } from './image/layout-manager.js';
import { TransformController } from './image/transform-controller.js';
import { flipHorizontalAction, flipVerticalAction, resetImageTransformAction, rotateImageAction, scaleImageAction, } from './image/transform-actions.js';
import { createEditorRuntimeWiring, } from './runtime/editor-facade-wiring.js';
import { EditorRuntime } from './runtime/editor-runtime.js';
import { handleObjectModified as handleObjectModifiedImpl, handleObjectMovingScalingRotating as handleObjectMovingScalingRotatingImpl, handleSelectionChanged as handleSelectionChangedImpl, } from './selection/editor-selection-controller.js';
import { deleteSelectedEditableObjects, moveSelectedEditableObject as moveSelectedEditableObjectImpl, removeAllAnnotationsAction, removeSelectedAnnotationAction, updateAnnotationAction, updateSelectedAnnotationAction, } from './overlay/editable-object-actions.js';
import { createMaskAction, removeAllMasksAction as removeAllMasksActionImpl, removeSelectedMaskAction, } from './mask/mask-actions.js';
import { hideAllMaskLabels, removeLabelForMask, showLabelForMask, syncMaskLabel, } from './mask/mask-label-manager.js';
import { renderMaskList, updateMaskListSelection } from './mask/mask-list.js';
import { safelyDisposeCanvas, safelyExitActiveSession, safelyRemoveKeyboardListener, } from './lifecycle/editor-dispose.js';
import { DomBindings } from './ui/dom-bindings.js';
import { applyEditorControlState } from './ui/editor-control-state.js';
import { buildEditorControlSnapshot } from './ui/editor-control-snapshot.js';
import { restoreEditorControlOriginalStates, setEditorControlEnabled, } from './ui/editor-control-elements.js';
import { bindEditorDomEvents } from './ui/editor-dom-events.js';
import { createEditorDomEventActions } from './ui/editor-dom-actions.js';
import { applyEditorInputState } from './ui/editor-input-state.js';
import { bindEditorKeyboardEvents, handleEditorKeyboardEvent, isFabricTextEditingActive, } from './ui/editor-keyboard-events.js';
import { setPlaceholderVisible as setPlaceholderVisibleImpl } from './ui/visibility-state.js';
import { canRunOperationInToolMode, getActiveToolMode as getActiveToolModeFromSnapshot, isImageEditorOperation, isToolModeActive as isToolModeActiveFromSnapshot, } from './tool-mode/tool-mode-policy.js';
import { isSupportedImageDataUrl } from './utils/file.js';
import { detectSourceMimeType } from './image/image-resampler.js';
const INTERNAL_OPERATION_TOKEN = Symbol('ImageEditorInternalOperation');
const INTERNAL_ALLOW_DURING_ANIMATION_QUEUE = Symbol('ImageEditorAllowDuringAnimationQueue');
function getRuntimeDocument(canvasElement) {
    var _a;
    return (_a = canvasElement === null || canvasElement === void 0 ? void 0 : canvasElement.ownerDocument) !== null && _a !== void 0 ? _a : (typeof document !== 'undefined' ? document : null);
}
function isHtmlCanvasElement(element) {
    var _a, _b;
    if (!element)
        return false;
    const ownerWindow = (_a = element.ownerDocument) === null || _a === void 0 ? void 0 : _a.defaultView;
    const CanvasCtor = (_b = ownerWindow === null || ownerWindow === void 0 ? void 0 : ownerWindow.HTMLCanvasElement) !== null && _b !== void 0 ? _b : globalThis.HTMLCanvasElement;
    if (typeof CanvasCtor === 'function')
        return element instanceof CanvasCtor;
    return element.tagName.toLowerCase() === 'canvas';
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
export class ImageEditor {
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
        const canvasCandidate = resolveDomElement(canvasTarget, getRuntimeDocument(null));
        if (!isHtmlCanvasElement(canvasCandidate)) {
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
    resolveElement(key, ownerDocument = getRuntimeDocument(this.runtime.canvasElement)) {
        return resolveDomElement(this.runtime.elements[key], ownerDocument);
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
                const element = this.resolveElement(key, ownerDocument);
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
        await loadImageFileImpl({
            options: this.runtime.options,
            getInputElement: () => this.resolveElement('imageInput'),
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
            await loadImageImpl(loadImageContext, base64, options);
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
        return getAnnotationsImpl(this.runtime.canvas);
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
        return measureLayoutViewportImpl(this.buildDisplayGeometryContext(), scrollbarSize);
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
        removeAllMasksActionImpl(this.actionAccessFactory.buildMaskActionAccess(), options);
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
        handleObjectMovingScalingRotatingImpl(this.actionAccessFactory.buildSelectionControllerAccess(), target);
    }
    handleObjectModified(target) {
        handleObjectModifiedImpl(this.actionAccessFactory.buildSelectionControllerAccess(), target);
    }
    handleSelectionChanged(selected) {
        handleSelectionChangedImpl(this.actionAccessFactory.buildSelectionControllerAccess(), selected);
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
    applyTextConfigPatch(config, operation) {
        applyTextConfigPatchAction(this.actionAccessFactory.buildAnnotationConfigActionAccess(), config, operation);
    }
    applyDrawConfigPatch(config, operation) {
        applyDrawConfigPatchAction(this.actionAccessFactory.buildAnnotationConfigActionAccess(), config, operation);
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
        moveSelectedEditableObjectImpl(this.actionAccessFactory.buildEditableObjectActionAccess(), operation);
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
        }, (key) => this.resolveElement(key));
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
        setPlaceholderVisibleImpl(this.runtime.placeholderElement, this.runtime.containerElement, this.runtime.options.showPlaceholder ? !this.runtime.originalImage : false);
    }
    dispose() {
        var _a;
        if (this.runtime.isDisposed)
            return;
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
        safelyExitActiveSession(this.runtime.cropSession !== null, this.runtime.canvas, () => cancelCropImpl(this.buildCropControllerContext()), () => {
            this.runtime.cropSession = null;
        });
        safelyExitActiveSession(this.runtime.mosaicSession !== null, this.runtime.canvas, () => exitMosaicModeImpl(this.buildMosaicControllerContext()), () => {
            this.runtime.mosaicSession = null;
        });
        safelyExitActiveSession(this.runtime.textSession !== null, this.runtime.canvas, () => exitTextModeImpl(this.buildTextControllerContext()), () => {
            this.runtime.textSession = null;
        });
        safelyExitActiveSession(this.runtime.drawSession !== null, this.runtime.canvas, () => exitDrawModeImpl(this.buildDrawControllerContext()), () => {
            this.runtime.drawSession = null;
        });
        if (this.runtime.canvas) {
            safelyDisposeCanvas(this.runtime.canvas);
        }
        this.runtime.resetAfterDispose();
        if (previousImage) {
            this.emitOptionCallback('onImageCleared', [previousImage, context]);
        }
        this.emitImageChanged(context);
        this.emitBusyChangeIfChanged(context);
        this.emitOptionCallback('onEditorDisposed', [context]);
    }
}
//# sourceMappingURL=image-editor.js.map