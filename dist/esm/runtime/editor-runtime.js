import { AnimationQueue } from '../animation/animation-queue.js';
import { cloneResolvedDrawConfig, cloneResolvedEraserConfig, cloneResolvedMosaicConfig, cloneResolvedShapeAnnotationConfig, cloneResolvedTextAnnotationConfig, } from '../core/default-options.js';
import { cloneResolvedImageFilterConfig, DEFAULT_IMAGE_FILTER_CONFIG, } from '../core/image-filter-config.js';
import { OperationGuard } from '../core/operation-guard.js';
import { isBaseImageObject } from '../core/public-types.js';
import { DeferredHistoryPort } from '../compatibility/plugin-history-adapter.js';
import { ViewportCache } from '../image/layout-manager.js';
export class EditorRuntime {
    constructor(fabricModule, isFabricLoaded, options, historyManager = new DeferredHistoryPort(options.maxHistorySize)) {
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
        this.historyManager = historyManager;
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
        return !!(this.originalImage &&
            isBaseImageObject(this.originalImage) &&
            Number(this.originalImage.width) > 0 &&
            Number(this.originalImage.height) > 0);
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
//# sourceMappingURL=editor-runtime.js.map