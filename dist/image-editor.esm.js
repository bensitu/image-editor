// src/esm.js
import fabricModule from "fabric";

// src/image-editor.js
/**
 * @file image-editor.js
 * @module image-editor
 * @version 1.4.2
 * @author Ben Situ
 * @license MIT
 * @description Lightweight canvas-based image editor with masking/transform/export support.
 */
var fabric = null;
var INTERNAL_OPERATION_TOKEN = /* @__PURE__ */ Symbol.for("ImageEditorInternalOperation");
function getGlobalScope() {
  if (typeof globalThis !== "undefined") return globalThis;
  if (typeof self !== "undefined") return self;
  if (typeof window !== "undefined") return window;
  return null;
}
function getGlobalFabric() {
  const scope = getGlobalScope();
  return scope && scope.fabric ? scope.fabric : null;
}
function setFabric(fabricInstance2) {
  fabric = fabricInstance2 || getGlobalFabric();
  return fabric;
}
function ensureFabric() {
  if (!fabric) setFabric();
  return fabric;
}
var ImageEditor = class {
  constructor(options = {}) {
    const defaultLabel = {
      getText: (mask) => mask.maskName,
      textOptions: {
        fontSize: 12,
        fill: "#fff",
        backgroundColor: "rgba(0,0,0,0.7)",
        padding: 2,
        fontFamily: "monospace",
        fontWeight: "bold",
        selectable: false,
        evented: false,
        originX: "left",
        originY: "top"
      }
    };
    const defaultCrop = {
      minWidth: 100,
      minHeight: 100,
      padding: 10,
      hideMasksDuringCrop: true,
      preserveMasksAfterCrop: false,
      allowRotationOfCropRect: false
    };
    const userLabel = options.label || {};
    const userCrop = options.crop || {};
    this.options = {
      canvasWidth: 800,
      canvasHeight: 600,
      backgroundColor: "transparent",
      animationDuration: 300,
      minScale: 0.1,
      maxScale: 5,
      scaleStep: 0.05,
      rotationStep: 90,
      expandCanvasToImage: true,
      fitImageToCanvas: false,
      coverImageToCanvas: false,
      downsampleOnLoad: true,
      downsampleMaxWidth: 4e3,
      downsampleMaxHeight: 3e3,
      downsampleQuality: 0.92,
      preserveSourceFormat: true,
      downsampleMimeType: null,
      imageLoadTimeoutMs: 3e4,
      exportMultiplier: 1,
      exportImageAreaByDefault: true,
      defaultMaskWidth: 50,
      defaultMaskHeight: 80,
      maskRotatable: false,
      maskLabelOnSelect: true,
      maskLabelOffset: 3,
      maskName: "mask",
      groupSelection: false,
      showPlaceholder: true,
      initialImageBase64: null,
      // Provide a base64 'data:image/...' string here if you want auto-load
      defaultDownloadFileName: "edited_image.jpg",
      onError: null,
      onWarning: null,
      ...options,
      label: {
        ...defaultLabel,
        ...userLabel,
        textOptions: {
          ...defaultLabel.textOptions,
          ...userLabel.textOptions || {}
        }
      },
      crop: {
        ...defaultCrop,
        ...userCrop
      }
    };
    this._fabricLoaded = !!ensureFabric();
    if (!this._fabricLoaded) {
      this._reportError("fabric.js is not loaded. Please include fabric.js first. Initialization will be aborted.");
    }
    this.canvas = null;
    this.canvasElement = null;
    this.containerElement = null;
    this.placeholderElement = null;
    this.originalImage = null;
    this.baseImageScale = 1;
    this.currentScale = 1;
    this.currentRotation = 0;
    this.maskCounter = 0;
    this.isAnimating = false;
    this._isLoading = false;
    this._activeOperationName = null;
    this._activeOperationToken = null;
    this.elements = {};
    this.isImageLoadedToCanvas = false;
    this.maxHistorySize = 50;
    this._handlersByElementKey = {};
    this._elementCache = {};
    this._elementOriginalPointerEvents = /* @__PURE__ */ new Map();
    this._lastMask = null;
    this._lastMaskInitialLeft = null;
    this._lastMaskInitialTop = null;
    this._lastMaskInitialWidth = null;
    this._lastSnapshot = null;
    this._cropMode = false;
    this._cropRect = null;
    this._cropHandlers = [];
    this._cropPrevEvented = null;
    this._prevSelectionSetting = void 0;
    this._containerOriginalOverflow = null;
    this._lastContainerViewportSize = null;
    this._canvasElementOriginalStyle = null;
    this._visibilityStateByElement = /* @__PURE__ */ new WeakMap();
    this._scrollbarSizeCache = null;
    this._activeAnimationRejectors = /* @__PURE__ */ new Set();
    this._disposed = false;
    this._initialized = false;
    this.onImageLoaded = typeof options.onImageLoaded === "function" ? options.onImageLoaded : null;
    this.animationQueue = new AnimationQueue();
    this.historyManager = new HistoryManager(this.maxHistorySize);
  }
  /**
   * Backward-compatible alias for {@link ImageEditor#canvasElement}.
   *
   * @deprecated Use canvasElement instead. This alias will be removed in v2.0.0.
   * @returns {HTMLCanvasElement|null} The canvas element currently owned by the editor.
   */
  get canvasEl() {
    return this.canvasElement;
  }
  set canvasEl(value) {
    this.canvasElement = value;
  }
  /**
   * Backward-compatible alias for {@link ImageEditor#containerElement}.
   *
   * @deprecated Use containerElement instead. This alias will be removed in v2.0.0.
   * @returns {HTMLElement|null} The canvas viewport/container element.
   */
  get containerEl() {
    return this.containerElement;
  }
  set containerEl(value) {
    this.containerElement = value;
  }
  /**
   * Backward-compatible alias for {@link ImageEditor#placeholderElement}.
   *
   * @deprecated Use placeholderElement instead. This alias will be removed in v2.0.0.
   * @returns {HTMLElement|null} The placeholder element shown before an image loads.
   */
  get placeholderEl() {
    return this.placeholderElement;
  }
  set placeholderEl(value) {
    this.placeholderElement = value;
  }
  /**
   * Initializes the editor, binds to DOM elements, sets up event handlers,
   * and (optionally) loads an initial image.
   * Use this method to set up the editor UI before interacting with it.
   *
   * @param {Object} [idMap={}] - Optional mapping from logical element names to actual DOM element IDs.
   *   Supported keys include: canvas, canvasContainer, imgPlaceholder, scaleRate, rotationLeftInput,
   *   rotationRightInput, rotateLeftBtn, rotateRightBtn, addMaskBtn, removeMaskBtn, removeAllMasksBtn,
   *   mergeBtn, downloadBtn, maskList, zoomInBtn, zoomOutBtn, resetBtn, undoBtn, redoBtn, imageInput,
   *   uploadArea, cropBtn, applyCropBtn, and cancelCropBtn. Unknown keys are ignored.
   *
   * @returns {void}
   *
   * @public
   *
   * @example
   * editor.init({
   *   canvas: 'myFabricCanvasId',
   *   downloadBtn: 'myDownloadButtonId'
   * });
   */
  init(idMap = {}) {
    if (!this._fabricLoaded) return;
    if (this._initialized || this.canvas) this.dispose();
    this._disposed = false;
    this._initialized = true;
    this.animationQueue = new AnimationQueue();
    this.historyManager = new HistoryManager(this.maxHistorySize);
    this._visibilityStateByElement = /* @__PURE__ */ new WeakMap();
    this._activeAnimationRejectors = /* @__PURE__ */ new Set();
    this._isLoading = false;
    this._activeOperationName = null;
    this._activeOperationToken = null;
    this._elementOriginalPointerEvents = /* @__PURE__ */ new Map();
    this._containerOriginalOverflow = null;
    this._lastContainerViewportSize = null;
    this._canvasElementOriginalStyle = null;
    const defaults = {
      canvas: "fabricCanvas",
      canvasContainer: null,
      // Pass an ID here if you have a scrollable viewport container
      imgPlaceholder: "imgPlaceholder",
      scaleRate: "scaleRate",
      rotationLeftInput: "rotationLeftInput",
      rotationRightInput: "rotationRightInput",
      rotateLeftBtn: "rotateLeftBtn",
      rotateRightBtn: "rotateRightBtn",
      addMaskBtn: "addMaskBtn",
      removeMaskBtn: "removeMaskBtn",
      removeAllMasksBtn: "removeAllMasksBtn",
      mergeBtn: "mergeBtn",
      downloadBtn: "downloadBtn",
      maskList: "maskList",
      zoomInBtn: "zoomInBtn",
      zoomOutBtn: "zoomOutBtn",
      resetBtn: "resetBtn",
      undoBtn: "undoBtn",
      redoBtn: "redoBtn",
      imageInput: "imageInput",
      cropBtn: "cropBtn",
      applyCropBtn: "applyCropBtn",
      cancelCropBtn: "cancelCropBtn"
    };
    this.elements = { ...defaults, ...idMap };
    this._elementCache = {};
    this._initCanvas();
    this._bindEvents();
    this._updateInputs();
    this._updateMaskList();
    this._updateUI();
    if (this.options.initialImageBase64) {
      this.loadImage(this.options.initialImageBase64);
    } else {
      this._updatePlaceholderStatus();
    }
  }
  _reportError(message, error = null) {
    const handler = this.options && this.options.onError;
    if (typeof handler !== "function") return;
    try {
      handler(error, message);
    } catch {
    }
  }
  _reportWarning(message, error = null) {
    const handler = this.options && this.options.onWarning;
    if (typeof handler !== "function") return;
    try {
      handler(error, message);
    } catch {
    }
  }
  /**
   * Initializes the Fabric canvas, viewport elements, and selection event handlers.
   *
   * @returns {void}
   * @private
   */
  _initCanvas() {
    const canvasElement = this._getElement("canvas");
    if (!canvasElement) throw new Error("Canvas is not found: " + this.elements.canvas);
    this.canvasElement = canvasElement;
    this._canvasElementOriginalStyle = {
      display: canvasElement.style.display || "",
      width: canvasElement.style.width || "",
      height: canvasElement.style.height || "",
      maxWidth: canvasElement.style.maxWidth || ""
    };
    if (this.elements.canvasContainer) {
      const containerElement = this._getElement("canvasContainer");
      this.containerElement = containerElement || canvasElement.parentElement;
    } else {
      this.containerElement = canvasElement.parentElement;
    }
    this.placeholderElement = this._getElement("imgPlaceholder") || null;
    let initialWidth = this.options.canvasWidth;
    let initialHeight = this.options.canvasHeight;
    if (this.containerElement) {
      const containerWidth = Math.floor(this.containerElement.clientWidth);
      const containerHeight = Math.floor(this.containerElement.clientHeight);
      if (containerWidth > 0 && containerHeight > 0) {
        initialWidth = containerWidth;
        initialHeight = containerHeight;
        this._lastContainerViewportSize = {
          width: containerWidth,
          height: containerHeight
        };
      }
    }
    this.canvas = new fabric.Canvas(canvasElement, {
      width: initialWidth,
      height: initialHeight,
      backgroundColor: this.options.backgroundColor,
      selection: this.options.groupSelection,
      preserveObjectStacking: true
    });
    this.canvas.on("selection:created", (event) => this._handleSelectionChanged(event.selected));
    this.canvas.on("selection:updated", (event) => this._handleSelectionChanged(event.selected));
    this.canvas.on("selection:cleared", () => this._handleSelectionChanged([]));
    this.canvas.on("object:moving", (event) => {
      if (event.target && event.target.maskId) this._syncMaskLabel(event.target);
    });
    this.canvas.on("object:scaling", (event) => {
      if (event.target && event.target.maskId) this._syncMaskLabel(event.target);
    });
    this.canvas.on("object:rotating", (event) => {
      if (event.target && event.target.maskId) this._syncMaskLabel(event.target);
    });
    this.canvas.on("object:modified", (event) => this._handleObjectModified(event.target));
    this.canvasElement.style.display = "block";
  }
  /**
   * Returns a configured DOM element and caches lookups for hot UI paths.
   *
   * @param {string} key - Key in the configured element map.
   * @returns {HTMLElement|null} The configured element, or null when missing.
   * @private
   */
  _getElement(key) {
    const id = this.elements && this.elements[key];
    if (!id) return null;
    if (this._elementCache && Object.prototype.hasOwnProperty.call(this._elementCache, key)) {
      return this._elementCache[key];
    }
    const element = document.getElementById(id);
    if (this._elementCache) this._elementCache[key] = element || null;
    return element || null;
  }
  /**
   * Records a history entry after Fabric finishes modifying one or more masks.
   *
   * @param {fabric.Object|fabric.ActiveSelection|null} target - Modified Fabric object or selection.
   * @returns {void}
   * @private
   */
  _handleObjectModified(target) {
    const masks = this._getModifiedMasks(target);
    if (!masks.length) return;
    masks.forEach((mask) => {
      if (typeof mask.setCoords === "function") mask.setCoords();
      this._syncMaskLabel(mask);
    });
    this._expandCanvasToFitObjects(masks);
    this.saveState();
  }
  /**
   * Extracts editable mask objects from a Fabric modification target.
   *
   * @param {fabric.Object|fabric.ActiveSelection|null} target - Fabric object or active selection.
   * @returns {Array<fabric.Object>} Modified mask objects.
   * @private
   */
  _getModifiedMasks(target) {
    if (!target) return [];
    if (target.maskId) return [target];
    const objects = typeof target.getObjects === "function" ? target.getObjects() : [];
    return Array.isArray(objects) ? objects.filter((object) => object && object.maskId) : [];
  }
  /**
   * Updates container overflow behavior for fit and cover image modes.
   *
   * @param {Object} [options={}] - Overflow update options.
   * @param {boolean} [options.preserveScroll=false] - If true, keeps the current scroll offsets.
   * @returns {void}
   * @private
   */
  _syncContainerOverflow(options = {}) {
    if (!this.containerElement || !this.containerElement.style) return;
    this._captureContainerOverflowState();
    const shouldPreserveScroll = options.preserveScroll === true;
    if (this.options.coverImageToCanvas) {
      this.containerElement.style.overflow = "scroll";
      if (!shouldPreserveScroll) {
        this.containerElement.scrollLeft = 0;
        this.containerElement.scrollTop = 0;
      }
    } else if (this.options.fitImageToCanvas) {
      this.containerElement.style.overflow = "auto";
      if (!shouldPreserveScroll) {
        this.containerElement.scrollLeft = 0;
        this.containerElement.scrollTop = 0;
      }
    } else {
      this._restoreContainerOverflowState();
    }
  }
  _captureContainerOverflowState() {
    if (!this.containerElement || !this.containerElement.style || this._containerOriginalOverflow) return;
    this._containerOriginalOverflow = {
      overflow: this.containerElement.style.overflow || "",
      overflowX: this.containerElement.style.overflowX || "",
      overflowY: this.containerElement.style.overflowY || ""
    };
  }
  _restoreContainerOverflowState() {
    if (!this.containerElement || !this.containerElement.style || !this._containerOriginalOverflow) return;
    this.containerElement.style.overflow = this._containerOriginalOverflow.overflow;
    this.containerElement.style.overflowX = this._containerOriginalOverflow.overflowX;
    this.containerElement.style.overflowY = this._containerOriginalOverflow.overflowY;
  }
  _restoreContainerOverflowSnapshot(snapshot) {
    if (!this.containerElement || !this.containerElement.style || !snapshot) return;
    this.containerElement.style.overflow = snapshot.overflow || "";
    this.containerElement.style.overflowX = snapshot.overflowX || "";
    this.containerElement.style.overflowY = snapshot.overflowY || "";
  }
  /** 
   * DOM / UI bindings
   * @private
   */
  _bindEvents() {
    this._bindIfExists("uploadArea", "click", () => {
      const uploadAreaElement = this._getElement("uploadArea");
      if (this._isElementDisabled(uploadAreaElement)) return;
      this._getElement("imageInput")?.click();
    });
    this._bindIfExists("imageInput", "change", (event) => {
      const file = event.target.files && event.target.files[0];
      if (file) {
        this._loadImageFile(file).catch((error) => this._reportError("Image file could not be loaded", error)).finally(() => {
          event.target.value = "";
        });
      }
    });
    this._bindIfExists("zoomInBtn", "click", () => this.scaleImage(this.currentScale + this.options.scaleStep).catch((error) => this._reportError("scaleImage failed", error)));
    this._bindIfExists("zoomOutBtn", "click", () => this.scaleImage(this.currentScale - this.options.scaleStep).catch((error) => this._reportError("scaleImage failed", error)));
    this._bindIfExists("resetBtn", "click", () => {
      this.resetImageTransform().catch((error) => this._reportError("resetImageTransform failed", error));
    });
    this._bindIfExists("addMaskBtn", "click", () => this.createMask());
    this._bindIfExists("removeMaskBtn", "click", () => this.removeSelectedMask());
    this._bindIfExists("removeAllMasksBtn", "click", () => this.removeAllMasks());
    this._bindIfExists("mergeBtn", "click", () => this.mergeMasks().catch((error) => this._reportError("merge error", error)));
    this._bindIfExists("downloadBtn", "click", () => this.downloadImage());
    this._bindIfExists("undoBtn", "click", () => this.undo().catch((error) => this._reportError("undo failed", error)));
    this._bindIfExists("redoBtn", "click", () => this.redo().catch((error) => this._reportError("redo failed", error)));
    this._bindIfExists("rotateLeftBtn", "click", () => {
      const rotationInputElement = this._getElement("rotationLeftInput");
      let step = this.options.rotationStep;
      if (rotationInputElement) {
        const parsedStep = parseFloat(rotationInputElement.value);
        if (!isNaN(parsedStep)) step = parsedStep;
      }
      this.rotateImage(this.currentRotation - step).catch((error) => this._reportError("rotateImage failed", error));
    });
    this._bindIfExists("rotateRightBtn", "click", () => {
      const rotationInputElement = this._getElement("rotationRightInput");
      let step = this.options.rotationStep;
      if (rotationInputElement) {
        const parsedStep = parseFloat(rotationInputElement.value);
        if (!isNaN(parsedStep)) step = parsedStep;
      }
      this.rotateImage(this.currentRotation + step).catch((error) => this._reportError("rotateImage failed", error));
    });
    this._bindIfExists("cropBtn", "click", () => this.enterCropMode());
    this._bindIfExists("applyCropBtn", "click", () => {
      this.applyCrop().catch((error) => this._reportError("applyCrop failed", error));
    });
    this._bindIfExists("cancelCropBtn", "click", () => this.cancelCrop());
    this._bindIfExists("maskList", "click", (event) => this._handleMaskListClick(event));
  }
  /**
   * Binds a DOM event listener when the configured element exists and records it for disposal.
   *
   * @param {string} key - Key in this.elements for the target DOM element.
   * @param {string} eventName - DOM event name to listen for.
   * @param {EventListener} handler - Event listener callback.
   * @private
   */
  _bindIfExists(key, eventName, handler) {
    const element = this._getElement(key);
    if (element) {
      element.addEventListener(eventName, handler);
      this._handlersByElementKey = this._handlersByElementKey || {};
      if (!this._handlersByElementKey[key]) this._handlersByElementKey[key] = [];
      this._handlersByElementKey[key].push({ eventName, handler });
    }
  }
  /**
   * Reads an image File as a data URL and loads it into the Fabric canvas.
   *
   * @param {File} file - Image file selected by the user.
   * @returns {Promise<void>} Resolves after the selected file is loaded.
   * @private
   */
  _loadImageFile(file) {
    if (!this._isSupportedImageFile(file)) {
      const error = new Error("Selected file is not a supported image");
      this._reportError("Selected file is not a supported image", error);
      return Promise.reject(error);
    }
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        this.loadImage(event.target.result).then(resolve).catch(reject);
      };
      reader.onerror = (event) => {
        const error = new Error("Image file could not be read");
        this._reportError("Image file could not be read", event);
        reject(error);
      };
      reader.readAsDataURL(file);
    });
  }
  _isSupportedImageFile(file) {
    if (!file) return false;
    if (typeof file.type === "string" && file.type.startsWith("image/")) return true;
    const fileName = String(file.name || "");
    return /\.(avif|bmp|gif|jpe?g|png|webp)$/i.test(fileName);
  }
  /**
   * Warns when more than one mutually exclusive image layout mode is enabled.
   *
   * @returns {void}
   * @private
   */
  _warnOnImageLayoutOptionConflict() {
    const activeModes = [
      ["fitImageToCanvas", this.options.fitImageToCanvas],
      ["coverImageToCanvas", this.options.coverImageToCanvas],
      ["expandCanvasToImage", this.options.expandCanvasToImage]
    ].filter(([, isEnabled]) => !!isEnabled).map(([name]) => name);
    if (activeModes.length <= 1) return;
    this._reportWarning(
      `Only one image layout mode should be enabled. Active modes: ${activeModes.join(", ")}.`
    );
  }
  /**
   * Loads a base64 data URL into the Fabric canvas as the base image.
   *
   * @async
   * @param {string} imageBase64 - Image data URL beginning with `data:image/`.
   * @param {LoadImageOptions} [options={}] - Optional load behavior.
   * @returns {Promise<void>} Resolves after the Fabric image is added to the canvas.
   * @public
   */
  async loadImage(imageBase64, options = {}) {
    if (!this._fabricLoaded) return;
    if (!this.canvas || this._disposed) return;
    if (!imageBase64 || typeof imageBase64 !== "string" || !imageBase64.startsWith("data:image/")) return;
    this._assertIdleForOperation("loadImage", options);
    this._isLoading = true;
    this._updateUI();
    this._warnOnImageLayoutOptionConflict();
    const transaction = this._captureLoadImageTransaction();
    try {
      const imageElement = await this._createImageElement(imageBase64);
      if (this._disposed || !this.canvas) throw new Error("Editor was disposed while loading image");
      let loadSource = imageBase64;
      const downsampleMaxWidth = Number(this.options.downsampleMaxWidth);
      const downsampleMaxHeight = Number(this.options.downsampleMaxHeight);
      if (this.options.downsampleOnLoad && downsampleMaxWidth > 0 && downsampleMaxHeight > 0) {
        const shouldResize = imageElement.naturalWidth > downsampleMaxWidth || imageElement.naturalHeight > downsampleMaxHeight;
        if (shouldResize) {
          const ratio = Math.min(
            downsampleMaxWidth / imageElement.naturalWidth,
            downsampleMaxHeight / imageElement.naturalHeight
          );
          const targetWidth = Math.round(imageElement.naturalWidth * ratio);
          const targetHeight = Math.round(imageElement.naturalHeight * ratio);
          loadSource = this._resampleImageToDataURL(
            imageElement,
            targetWidth,
            targetHeight,
            this._normalizeQuality(this.options.downsampleQuality),
            imageBase64
          );
        }
      } else if (this.options.downsampleOnLoad) {
        this._reportWarning("loadImage: downsample limits must be positive numbers; using the original image");
      }
      const fabricImage = await this._createFabricImageFromURL(loadSource);
      if (this._disposed || !this.canvas) throw new Error("Editor was disposed while loading image");
      this.canvas.discardActiveObject();
      this._hideAllMaskLabels();
      this.canvas.clear();
      this.canvas.setBackgroundColor(this.options.backgroundColor, this.canvas.renderAll.bind(this.canvas));
      fabricImage.set({ originX: "left", originY: "top", selectable: false, evented: false });
      this._setPlaceholderVisible(false);
      this._syncContainerOverflow({ preserveScroll: options.preserveScroll === true });
      const imageWidth = fabricImage.width;
      const imageHeight = fabricImage.height;
      const viewport = this._getContainerViewportSize();
      const minWidth = viewport.width;
      const minHeight = viewport.height;
      if (this.options.fitImageToCanvas) {
        const canvasWidth = Math.max(1, minWidth - 1);
        const canvasHeight = Math.max(1, minHeight - 1);
        this._setCanvasSizeInt(canvasWidth, canvasHeight);
        const fitScale = Math.min(canvasWidth / imageWidth, canvasHeight / imageHeight, 1);
        fabricImage.set({ left: 0, top: 0 });
        fabricImage.scale(fitScale);
        this.baseImageScale = fabricImage.scaleX || 1;
      } else if (this.options.coverImageToCanvas) {
        const layout = this._calculateCoverCanvasLayout(imageWidth, imageHeight);
        this._setCanvasSizeInt(layout.canvasWidth, layout.canvasHeight);
        fabricImage.set({ left: 0, top: 0 });
        fabricImage.scale(layout.scale);
        this.baseImageScale = fabricImage.scaleX || 1;
      } else if (this.options.expandCanvasToImage) {
        const canvasWidth = Math.max(minWidth, Math.floor(imageWidth));
        const canvasHeight = Math.max(minHeight, Math.floor(imageHeight));
        this._setCanvasSizeInt(canvasWidth, canvasHeight);
        fabricImage.set({ left: 0, top: 0 });
        fabricImage.scale(1);
        this.baseImageScale = 1;
      } else {
        const canvasWidth = Math.max(this.options.canvasWidth, minWidth);
        const canvasHeight = Math.max(this.options.canvasHeight, minHeight);
        this._setCanvasSizeInt(canvasWidth, canvasHeight);
        const fitScale = Math.min(canvasWidth / imageWidth, canvasHeight / imageHeight, 1);
        fabricImage.set({ left: 0, top: 0 });
        fabricImage.scale(fitScale);
        this.baseImageScale = fabricImage.scaleX || 1;
      }
      this.originalImage = fabricImage;
      this.canvas.add(fabricImage);
      this.canvas.sendToBack(fabricImage);
      this._clearMaskPlacementMemory();
      if (options.resetMaskCounter !== false) this.maskCounter = 0;
      this.currentScale = 1;
      this.currentRotation = 0;
      this._updateInputs();
      this._updateMaskList();
      this.isImageLoadedToCanvas = true;
      this._updateUI();
      this.canvas.renderAll();
      this._lastSnapshot = this._captureCanvasStateOrThrow("loadImage");
      if (typeof this.onImageLoaded === "function") {
        this.onImageLoaded();
      }
    } catch (error) {
      await this._rollbackLoadImageTransaction(transaction);
      throw error;
    } finally {
      this._isLoading = false;
      if (!this._disposed && this.canvas) this._updateUI();
    }
  }
  /**
   * Checks whether there is a loaded image on the current canvas.
   * @returns {boolean} true if loaded, false if not
   */
  isImageLoaded() {
    const fabricInstance2 = ensureFabric();
    return !!(this.originalImage && fabricInstance2 && this.originalImage instanceof fabricInstance2.Image && this.originalImage.width > 0 && this.originalImage.height > 0);
  }
  /**
   * Checks whether the editor is in a temporary non-mutating state.
   *
   * @returns {boolean} True while loading, animating, cropping, or running a compound operation.
   * @public
   */
  isBusy() {
    return !!(this.isAnimating || this._cropMode || this._isLoading || this._activeOperationToken || this.animationQueue && this.animationQueue.isBusy());
  }
  /**
   * Creates an HTMLImageElement from a given data URL.
   * 
   * @param {string} dataUrl - A data URL representing the image (e.g., "data:image/png;base64,...").
   * @param {number} [timeoutMs=this.options.imageLoadTimeoutMs] - Maximum decode time before rejecting.
   * @returns {Promise<HTMLImageElement>} A promise that resolves to the created image element when loaded, or rejects on error.
   * @private
   */
  _createImageElement(dataUrl, timeoutMs = this.options.imageLoadTimeoutMs) {
    return new Promise((resolve, reject) => {
      const imageElement = new Image();
      let isSettled = false;
      const safeTimeoutMs = Number.isFinite(Number(timeoutMs)) && Number(timeoutMs) > 0 ? Number(timeoutMs) : 3e4;
      let timerId;
      const settle = (callback) => {
        if (isSettled) return;
        isSettled = true;
        clearTimeout(timerId);
        imageElement.onload = null;
        imageElement.onerror = null;
        callback();
      };
      timerId = setTimeout(() => {
        settle(() => reject(new Error("Image load timed out")));
        try {
          imageElement.src = "";
        } catch (error) {
          void error;
        }
      }, safeTimeoutMs);
      imageElement.onload = () => settle(() => resolve(imageElement));
      imageElement.onerror = (error) => settle(() => reject(error));
      imageElement.src = dataUrl;
    });
  }
  _createFabricImageFromURL(dataUrl, timeoutMs = this.options.imageLoadTimeoutMs) {
    return new Promise((resolve, reject) => {
      const safeTimeoutMs = this._getSafeTimeoutMs(timeoutMs);
      let isSettled = false;
      let timerId;
      const settle = (callback) => {
        if (isSettled) return;
        isSettled = true;
        clearTimeout(timerId);
        callback();
      };
      timerId = setTimeout(() => {
        settle(() => reject(new Error("Fabric image load timed out")));
      }, safeTimeoutMs);
      try {
        fabric.Image.fromURL(dataUrl, (fabricImage) => {
          settle(() => {
            if (!fabricImage) {
              reject(new Error("Image could not be loaded"));
              return;
            }
            resolve(fabricImage);
          });
        }, { crossOrigin: "anonymous" });
      } catch (error) {
        settle(() => reject(error));
      }
    });
  }
  _getSafeTimeoutMs(timeoutMs) {
    const safeTimeoutMs = Number(timeoutMs);
    return Number.isFinite(safeTimeoutMs) && safeTimeoutMs > 0 ? safeTimeoutMs : 3e4;
  }
  _captureLoadImageTransaction() {
    return {
      canvasState: this._serializeCanvasState(),
      baseImageScale: this.baseImageScale,
      currentScale: this.currentScale,
      currentRotation: this.currentRotation,
      maskCounter: this.maskCounter,
      isImageLoadedToCanvas: this.isImageLoadedToCanvas,
      lastSnapshot: this._lastSnapshot,
      lastMask: this._lastMask,
      lastMaskInitialLeft: this._lastMaskInitialLeft,
      lastMaskInitialTop: this._lastMaskInitialTop,
      lastMaskInitialWidth: this._lastMaskInitialWidth,
      containerOverflow: this.containerElement && this.containerElement.style ? {
        overflow: this.containerElement.style.overflow || "",
        overflowX: this.containerElement.style.overflowX || "",
        overflowY: this.containerElement.style.overflowY || ""
      } : null,
      scrollLeft: this.containerElement ? this.containerElement.scrollLeft : 0,
      scrollTop: this.containerElement ? this.containerElement.scrollTop : 0,
      placeholderVisibility: this._captureElementVisibility(this.placeholderElement),
      canvasVisibility: this._captureElementVisibility(this._getCanvasVisibilityElement())
    };
  }
  async _rollbackLoadImageTransaction(transaction) {
    if (!transaction || !this.canvas || this._disposed) return;
    let didRestoreCanvasState = false;
    try {
      if (transaction.canvasState) {
        await this.loadFromState(transaction.canvasState);
        didRestoreCanvasState = true;
      }
    } catch (error) {
      this._lastMask = null;
      this._reportError("loadImage rollback failed", error);
    }
    this.baseImageScale = transaction.baseImageScale;
    this.currentScale = transaction.currentScale;
    this.currentRotation = transaction.currentRotation;
    this.maskCounter = transaction.maskCounter;
    this.isImageLoadedToCanvas = transaction.isImageLoadedToCanvas;
    this._lastSnapshot = transaction.lastSnapshot;
    if (didRestoreCanvasState) {
      this._restoreLastMaskReference(transaction.lastMask);
    } else {
      this._lastMask = null;
    }
    this._lastMaskInitialLeft = transaction.lastMaskInitialLeft;
    this._lastMaskInitialTop = transaction.lastMaskInitialTop;
    this._lastMaskInitialWidth = transaction.lastMaskInitialWidth;
    this._restoreElementVisibility(this.placeholderElement, transaction.placeholderVisibility);
    this._restoreElementVisibility(this._getCanvasVisibilityElement(), transaction.canvasVisibility);
    if (this.containerElement) {
      this.containerElement.scrollLeft = transaction.scrollLeft;
      this.containerElement.scrollTop = transaction.scrollTop;
      this._restoreContainerOverflowSnapshot(transaction.containerOverflow);
    }
    this._updateInputs();
    this._updateMaskList();
    this._updateUI();
    if (this.canvas) this.canvas.renderAll();
  }
  _restoreLastMaskReference(previousLastMask) {
    if (!this.canvas) {
      this._lastMask = null;
      return;
    }
    const masks = this.canvas.getObjects().filter((object) => object.maskId);
    const previousMaskId = previousLastMask && previousLastMask.maskId;
    this._lastMask = masks.find((mask) => mask.maskId === previousMaskId) || masks[masks.length - 1] || null;
    if (!this._lastMask) {
      this._lastMaskInitialLeft = null;
      this._lastMaskInitialTop = null;
      this._lastMaskInitialWidth = null;
    }
  }
  /**
   * Resamples the given image element to a new width and height and returns the result as a data URL.
   * 
   * @param {HTMLImageElement} imageElement - The image element to resample.
   * @param {number} targetWidth - Target width (in pixels) for the resampled image.
   * @param {number} targetHeight - Target height (in pixels) for the resampled image.
   * @param {number} [quality=0.92] - Image quality between 0 and 1 for lossy formats.
   * @param {string|null} [sourceDataUrl=null] - Source data URL used to preserve alpha-capable formats.
   * @returns {string} A data URL representing the resampled image.
   * @private
   */
  _resampleImageToDataURL(imageElement, targetWidth, targetHeight, quality = 0.92, sourceDataUrl = null) {
    const sourceWidth = Math.max(1, Number(imageElement && (imageElement.naturalWidth || imageElement.width)) || 0);
    const sourceHeight = Math.max(1, Number(imageElement && (imageElement.naturalHeight || imageElement.height)) || 0);
    const safeTargetWidth = Math.round(Number(targetWidth));
    const safeTargetHeight = Math.round(Number(targetHeight));
    if (!Number.isFinite(safeTargetWidth) || !Number.isFinite(safeTargetHeight) || safeTargetWidth <= 0 || safeTargetHeight <= 0) {
      throw new Error("Invalid image resample target dimensions");
    }
    const offscreenCanvas = document.createElement("canvas");
    offscreenCanvas.width = safeTargetWidth;
    offscreenCanvas.height = safeTargetHeight;
    const context = offscreenCanvas.getContext("2d");
    if (!context) throw new Error("2D canvas context is unavailable");
    context.drawImage(imageElement, 0, 0, sourceWidth, sourceHeight, 0, 0, safeTargetWidth, safeTargetHeight);
    return offscreenCanvas.toDataURL(this._getDownsampleMimeType(sourceDataUrl), quality);
  }
  _getDataUrlMimeType(dataUrl) {
    const match = String(dataUrl || "").match(/^data:([^;,]+)[;,]/i);
    return match ? match[1].toLowerCase() : "";
  }
  _getDownsampleMimeType(sourceDataUrl) {
    if (this.options.downsampleMimeType) {
      const requestedFormat = this._normalizeImageFormat(this.options.downsampleMimeType);
      return `image/${requestedFormat}`;
    }
    const sourceMimeType = this._getDataUrlMimeType(sourceDataUrl);
    if (this.options.preserveSourceFormat !== false && (sourceMimeType === "image/png" || sourceMimeType === "image/webp")) {
      return sourceMimeType;
    }
    return "image/jpeg";
  }
  _captureCanvasStateOrThrow(context) {
    const snapshot = this._serializeCanvasState();
    if (!snapshot) throw new Error(`${context}: canvas state is unavailable`);
    return snapshot;
  }
  /** 
   * Sets canvas size to integer width and height values to prevent scrollbars due to sub-pixel rendering.
   * Also updates the corresponding style attributes.
   * 
   * @param {number} width - Canvas width in pixels.
   * @param {number} height - Canvas height in pixels.
   * @private
   */
  _setCanvasSizeInt(width, height) {
    const integerWidth = Math.max(1, Math.round(Number(width) || 1));
    const integerHeight = Math.max(1, Math.round(Number(height) || 1));
    this.canvas.setWidth(integerWidth);
    this.canvas.setHeight(integerHeight);
    if (typeof this.canvas.calcOffset === "function") this.canvas.calcOffset();
    if (this.canvasElement) {
      this.canvasElement.style.width = integerWidth + "px";
      this.canvasElement.style.height = integerHeight + "px";
    }
  }
  _ceilCanvasDimension(value) {
    const numericValue = Number(value) || 0;
    const roundedValue = Math.round(numericValue);
    if (Math.abs(numericValue - roundedValue) < 0.01) return roundedValue;
    return Math.ceil(numericValue);
  }
  _getContainerViewportSize() {
    if (!this.containerElement) {
      return {
        width: Math.max(1, Math.floor(this.options.canvasWidth || 1)),
        height: Math.max(1, Math.floor(this.options.canvasHeight || 1))
      };
    }
    const measuredWidth = Math.floor(this.containerElement.clientWidth || 0);
    const measuredHeight = Math.floor(this.containerElement.clientHeight || 0);
    let width = Math.max(1, measuredWidth || this._lastContainerViewportSize?.width || this.options.canvasWidth || 1);
    let height = Math.max(1, measuredHeight || this._lastContainerViewportSize?.height || this.options.canvasHeight || 1);
    if (measuredWidth > 0 && measuredHeight > 0) {
      this._lastContainerViewportSize = { width: measuredWidth, height: measuredHeight };
    }
    if (this._hasFixedContainerScrollbars()) {
      return { width, height };
    }
    const overflow = this._getContainerOverflowValues();
    const canScrollX = overflow.x.some((value) => value === "auto" || value === "scroll");
    const canScrollY = overflow.y.some((value) => value === "auto" || value === "scroll");
    const hasHorizontalScrollbar = canScrollX && this.containerElement.scrollWidth > this.containerElement.clientWidth;
    const hasVerticalScrollbar = canScrollY && this.containerElement.scrollHeight > this.containerElement.clientHeight;
    if (hasHorizontalScrollbar || hasVerticalScrollbar) {
      const scrollbar = this._getScrollbarSize();
      if (hasVerticalScrollbar) width += scrollbar.width;
      if (hasHorizontalScrollbar) height += scrollbar.height;
    }
    return { width, height };
  }
  /**
   * Reads inline and computed overflow values for both scroll axes.
   *
   * @returns {{x:string[], y:string[]}} Overflow values grouped by axis.
   * @private
   */
  _getContainerOverflowValues() {
    if (!this.containerElement) return { x: [], y: [] };
    const inlineOverflow = this.containerElement.style.overflow;
    const inlineOverflowX = this.containerElement.style.overflowX;
    const inlineOverflowY = this.containerElement.style.overflowY;
    let computedOverflow = "";
    let computedOverflowX = "";
    let computedOverflowY = "";
    if (typeof window !== "undefined" && typeof window.getComputedStyle === "function") {
      const style = window.getComputedStyle(this.containerElement);
      computedOverflow = style.overflow;
      computedOverflowX = style.overflowX;
      computedOverflowY = style.overflowY;
    }
    return {
      x: [inlineOverflow, inlineOverflowX, computedOverflow, computedOverflowX],
      y: [inlineOverflow, inlineOverflowY, computedOverflow, computedOverflowY]
    };
  }
  _hasFixedContainerScrollbars() {
    if (!this.containerElement) return false;
    const overflow = this._getContainerOverflowValues();
    return [...overflow.x, ...overflow.y].some((value) => value === "scroll");
  }
  _getScrollbarSize() {
    if (this._scrollbarSizeCache) {
      return { ...this._scrollbarSizeCache };
    }
    if (typeof document === "undefined" || !document.createElement || !document.body) {
      return { width: 0, height: 0 };
    }
    const probe = document.createElement("div");
    probe.style.position = "absolute";
    probe.style.visibility = "hidden";
    probe.style.overflow = "scroll";
    probe.style.width = "100px";
    probe.style.height = "100px";
    probe.style.top = "-9999px";
    document.body.appendChild(probe);
    const width = Math.max(0, probe.offsetWidth - probe.clientWidth);
    const height = Math.max(0, probe.offsetHeight - probe.clientHeight);
    document.body.removeChild(probe);
    this._scrollbarSizeCache = { width, height };
    return { ...this._scrollbarSizeCache };
  }
  _getScrollSafetyMargin() {
    return 2;
  }
  _getScrollableCanvasSize(contentWidth, contentHeight, viewport = this._getContainerViewportSize()) {
    if (this._hasFixedContainerScrollbars()) {
      const safetyMargin = this._getScrollSafetyMargin();
      const safeWidth = Math.max(1, viewport.width - safetyMargin);
      const safeHeight = Math.max(1, viewport.height - safetyMargin);
      return {
        width: contentWidth > viewport.width + 0.5 ? this._ceilCanvasDimension(contentWidth) : safeWidth,
        height: contentHeight > viewport.height + 0.5 ? this._ceilCanvasDimension(contentHeight) : safeHeight,
        viewportWidth: viewport.width,
        viewportHeight: viewport.height,
        hasHorizontal: true,
        hasVertical: true
      };
    }
    const scrollbar = this._getScrollbarSize();
    let hasVertical = false;
    let hasHorizontal = false;
    let effectiveWidth;
    let effectiveHeight;
    for (let i = 0; i < 4; i += 1) {
      effectiveWidth = Math.max(1, viewport.width - (hasVertical ? scrollbar.width : 0));
      effectiveHeight = Math.max(1, viewport.height - (hasHorizontal ? scrollbar.height : 0));
      const nextHasVertical = contentHeight > effectiveHeight + 0.5;
      const nextHasHorizontal = contentWidth > effectiveWidth + 0.5;
      if (nextHasVertical === hasVertical && nextHasHorizontal === hasHorizontal) break;
      hasVertical = nextHasVertical;
      hasHorizontal = nextHasHorizontal;
    }
    effectiveWidth = Math.max(1, viewport.width - (hasVertical ? scrollbar.width : 0));
    effectiveHeight = Math.max(1, viewport.height - (hasHorizontal ? scrollbar.height : 0));
    return {
      width: hasHorizontal ? this._ceilCanvasDimension(contentWidth) : effectiveWidth,
      height: hasVertical ? this._ceilCanvasDimension(contentHeight) : effectiveHeight,
      viewportWidth: effectiveWidth,
      viewportHeight: effectiveHeight,
      hasHorizontal,
      hasVertical
    };
  }
  _calculateCoverCanvasLayout(imageWidth, imageHeight) {
    const viewport = this._getContainerViewportSize();
    if (this._hasFixedContainerScrollbars()) {
      const safetyMargin = this._getScrollSafetyMargin();
      const targetWidth = Math.max(1, viewport.width - safetyMargin);
      const targetHeight = Math.max(1, viewport.height - safetyMargin);
      const scale2 = Math.min(1, Math.max(targetWidth / imageWidth, targetHeight / imageHeight));
      const contentWidth2 = imageWidth * scale2;
      const contentHeight2 = imageHeight * scale2;
      const canvasSize2 = this._getScrollableCanvasSize(contentWidth2, contentHeight2, viewport);
      return {
        scale: scale2,
        canvasWidth: canvasSize2.width,
        canvasHeight: canvasSize2.height
      };
    }
    const scrollbar = this._getScrollbarSize();
    let hasVertical = false;
    let hasHorizontal = false;
    let scale = 1;
    let contentWidth = imageWidth;
    let contentHeight = imageHeight;
    let effectiveWidth;
    let effectiveHeight;
    for (let i = 0; i < 4; i += 1) {
      effectiveWidth = Math.max(1, viewport.width - (hasVertical ? scrollbar.width : 0));
      effectiveHeight = Math.max(1, viewport.height - (hasHorizontal ? scrollbar.height : 0));
      scale = Math.min(1, Math.max(effectiveWidth / imageWidth, effectiveHeight / imageHeight));
      contentWidth = imageWidth * scale;
      contentHeight = imageHeight * scale;
      const nextHasVertical = contentHeight > effectiveHeight + 0.5;
      const nextHasHorizontal = contentWidth > effectiveWidth + 0.5;
      if (nextHasVertical === hasVertical && nextHasHorizontal === hasHorizontal) break;
      hasVertical = nextHasVertical;
      hasHorizontal = nextHasHorizontal;
    }
    const canvasSize = this._getScrollableCanvasSize(contentWidth, contentHeight, viewport);
    return {
      scale,
      canvasWidth: canvasSize.width,
      canvasHeight: canvasSize.height
    };
  }
  _getStateProperties() {
    return [
      "maskId",
      "maskName",
      "maskLabel",
      "isCropRect",
      "originalAlpha",
      "originalStroke",
      "originalStrokeWidth",
      "selectable",
      "evented",
      "hasControls",
      "lockRotation",
      "borderColor",
      "cornerColor",
      "cornerSize",
      "transparentCorners",
      "strokeUniform",
      "strokeDashArray"
    ];
  }
  _getMaskNormalStyle(mask) {
    const strokeWidth = Number(mask && mask.originalStrokeWidth);
    const opacity = Number(mask && mask.originalAlpha);
    const style = {
      stroke: mask && mask.originalStroke || "#ccc",
      strokeWidth: Number.isFinite(strokeWidth) ? strokeWidth : 1
    };
    if (Number.isFinite(opacity)) style.opacity = opacity;
    return style;
  }
  _withNormalizedMaskStyles(callback) {
    if (!this.canvas) return callback();
    const masks = this.canvas.getObjects().filter((object) => object.maskId);
    const maskStyleBackups = [];
    try {
      masks.forEach((mask) => {
        const normalStyle = this._getMaskNormalStyle(mask);
        const stylePatch = {};
        Object.keys(normalStyle).forEach((property) => {
          if (mask[property] !== normalStyle[property]) {
            stylePatch[property] = normalStyle[property];
          }
        });
        const changedProperties = Object.keys(stylePatch);
        if (!changedProperties.length) return;
        const backup = { object: mask };
        changedProperties.forEach((property) => {
          backup[property] = mask[property];
        });
        maskStyleBackups.push(backup);
        mask.set(stylePatch);
      });
      const result = callback();
      if (result && typeof result.then === "function") {
        throw new Error("_withNormalizedMaskStyles callback must be synchronous");
      }
      return result;
    } finally {
      maskStyleBackups.forEach((backup) => {
        try {
          const restorePatch = {};
          Object.keys(backup).forEach((property) => {
            if (property !== "object") restorePatch[property] = backup[property];
          });
          backup.object.set(restorePatch);
        } catch (error) {
          void error;
        }
      });
    }
  }
  _restoreMaskControls(mask) {
    if (!mask) return;
    const cornerSize = Number(mask.cornerSize);
    mask.set({
      selectable: mask.selectable !== false,
      evented: mask.evented !== false,
      hasControls: mask.hasControls !== false,
      lockRotation: typeof mask.lockRotation === "boolean" ? mask.lockRotation : !this.options.maskRotatable,
      borderColor: mask.borderColor || "red",
      cornerColor: mask.cornerColor || "black",
      cornerSize: Number.isFinite(cornerSize) ? cornerSize : 8,
      transparentCorners: mask.transparentCorners === true,
      strokeUniform: mask.strokeUniform !== false
    });
    if (typeof mask.setCoords === "function") mask.setCoords();
  }
  /**
   * Captures editor-owned runtime state that Fabric does not include in canvas JSON.
   *
   * @returns {{version:number, baseImageScale:number, currentScale:number, currentRotation:number, maskCounter:number}} Serializable editor metadata.
   * @private
   */
  _serializeEditorMetadata() {
    const baseImageScale = Number(this.baseImageScale);
    const currentScale = Number(this.currentScale);
    const currentRotation = Number(this.currentRotation);
    const maskCounter = Number(this.maskCounter);
    return {
      version: 1,
      baseImageScale: Number.isFinite(baseImageScale) && baseImageScale > 0 ? baseImageScale : 1,
      currentScale: Number.isFinite(currentScale) && currentScale > 0 ? currentScale : 1,
      currentRotation: Number.isFinite(currentRotation) ? currentRotation : 0,
      maskCounter: Number.isFinite(maskCounter) && maskCounter > 0 ? Math.floor(maskCounter) : 0
    };
  }
  _serializeCanvasState() {
    if (!this.canvas) return null;
    return this._withNormalizedMaskStyles(() => {
      const jsonObject = this.canvas.toJSON(this._getStateProperties());
      if (Array.isArray(jsonObject.objects)) {
        jsonObject.objects = jsonObject.objects.filter((object) => !object.isCropRect && !object.maskLabel);
      }
      jsonObject.imageEditorMetadata = this._serializeEditorMetadata();
      return JSON.stringify(jsonObject);
    });
  }
  /**
   * Normalizes a lossy image quality value to Fabric/canvas's 0..1 range.
   *
   * @param {number} quality - Requested image quality.
   * @returns {number} A finite quality value between 0 and 1.
   * @private
   */
  _normalizeQuality(quality, fallback = void 0) {
    const fallbackQuality = fallback == null ? this.options.downsampleQuality : fallback;
    const numericFallback = fallbackQuality == null ? NaN : Number(fallbackQuality);
    const safeFallback = Number.isFinite(numericFallback) ? Math.max(0, Math.min(1, numericFallback)) : 0.92;
    if (quality == null) return safeFallback;
    const numericQuality = Number(quality);
    if (!Number.isFinite(numericQuality)) return safeFallback;
    return Math.max(0, Math.min(1, numericQuality));
  }
  /**
   * Normalizes public image format aliases to canvas export format names.
   *
   * @param {string} format - Requested image format or MIME type.
   * @returns {'jpeg'|'png'|'webp'} Canvas-compatible image format.
   * @private
   */
  _normalizeImageFormat(format) {
    const typeMapping = {
      "jpeg": "jpeg",
      "jpg": "jpeg",
      "image/jpeg": "jpeg",
      "png": "png",
      "image/png": "png",
      "webp": "webp",
      "image/webp": "webp"
    };
    return typeMapping[String(format || "jpeg").toLowerCase()] || "jpeg";
  }
  /**
   * Converts a bounding rectangle into a canvas-safe integer source region.
   *
   * @param {{left:number, top:number, width:number, height:number}} bounds - Bounds in canvas coordinates.
   * @param {Object} [options={}] - Region rounding options.
   * @param {boolean} [options.includePartialPixels=true] - If false, excludes partially covered trailing pixels.
   * @returns {{sourceX:number, sourceY:number, sourceWidth:number, sourceHeight:number}} Clamped source region.
   * @private
   */
  _getClampedCanvasRegion(bounds, options = {}) {
    const canvasWidth = Math.max(1, Math.round(this.canvas.getWidth()));
    const canvasHeight = Math.max(1, Math.round(this.canvas.getHeight()));
    const left = Number(bounds.left) || 0;
    const top = Number(bounds.top) || 0;
    const width = Math.max(0, Number(bounds.width) || 0);
    const height = Math.max(0, Number(bounds.height) || 0);
    const includePartialPixels = options.includePartialPixels !== false;
    const roundEnd = includePartialPixels ? Math.ceil : Math.floor;
    const sourceX = Math.min(canvasWidth - 1, Math.max(0, Math.floor(left)));
    const sourceY = Math.min(canvasHeight - 1, Math.max(0, Math.floor(top)));
    const endX = Math.min(canvasWidth, Math.max(sourceX + 1, roundEnd(left + width)));
    const endY = Math.min(canvasHeight, Math.max(sourceY + 1, roundEnd(top + height)));
    return {
      sourceX,
      sourceY,
      sourceWidth: Math.max(1, endX - sourceX),
      sourceHeight: Math.max(1, endY - sourceY)
    };
  }
  _hasFractionalCanvasEdge(value) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return false;
    return Math.abs(numericValue - Math.round(numericValue)) > 0.01;
  }
  _getPartialExportEdges(bounds) {
    if (!bounds) return null;
    const angle = Math.abs((Number(this.originalImage && this.originalImage.angle) || 0) % 90);
    const isAxisAligned = angle < 0.01 || Math.abs(angle - 90) < 0.01;
    if (!isAxisAligned) return null;
    return {
      left: this._hasFractionalCanvasEdge(bounds.left),
      top: this._hasFractionalCanvasEdge(bounds.top),
      right: this._hasFractionalCanvasEdge((Number(bounds.left) || 0) + (Number(bounds.width) || 0)),
      bottom: this._hasFractionalCanvasEdge((Number(bounds.top) || 0) + (Number(bounds.height) || 0))
    };
  }
  async _sealPartialTransparentEdges(dataUrl, edges) {
    if (!edges || !Object.values(edges).some(Boolean)) return dataUrl;
    const imageElement = await this._createImageElement(dataUrl);
    const width = Math.max(1, imageElement.naturalWidth || imageElement.width || 1);
    const height = Math.max(1, imageElement.naturalHeight || imageElement.height || 1);
    const offscreenCanvas = document.createElement("canvas");
    offscreenCanvas.width = width;
    offscreenCanvas.height = height;
    const context = offscreenCanvas.getContext("2d");
    if (!context) throw new Error("2D canvas context is unavailable");
    context.drawImage(imageElement, 0, 0, width, height);
    const imageData = context.getImageData(0, 0, width, height);
    const pixels = imageData.data;
    const sealPixel = (x, y, fallbackX, fallbackY) => {
      const index = (y * width + x) * 4;
      const fallbackIndex = (fallbackY * width + fallbackX) * 4;
      if (pixels[index + 3] === 0 && pixels[fallbackIndex + 3] > 0) {
        pixels[index] = pixels[fallbackIndex];
        pixels[index + 1] = pixels[fallbackIndex + 1];
        pixels[index + 2] = pixels[fallbackIndex + 2];
        pixels[index + 3] = pixels[fallbackIndex + 3];
      }
      if (pixels[index + 3] > 0 && pixels[index + 3] < 255) {
        pixels[index + 3] = 255;
      }
    };
    if (edges.left && width > 1) {
      for (let y = 0; y < height; y += 1) sealPixel(0, y, 1, y);
    }
    if (edges.right && width > 1) {
      for (let y = 0; y < height; y += 1) sealPixel(width - 1, y, width - 2, y);
    }
    if (edges.top && height > 1) {
      for (let x = 0; x < width; x += 1) sealPixel(x, 0, x, 1);
    }
    if (edges.bottom && height > 1) {
      for (let x = 0; x < width; x += 1) sealPixel(x, height - 1, x, height - 2);
    }
    context.putImageData(imageData, 0, 0);
    return offscreenCanvas.toDataURL("image/png");
  }
  /**
   * Exports a source region directly through Fabric's region export options.
   *
   * @param {Object} region - Canvas source region and export options.
   * @param {number} region.sourceX - Source region x coordinate.
   * @param {number} region.sourceY - Source region y coordinate.
   * @param {number} region.sourceWidth - Source region width.
   * @param {number} region.sourceHeight - Source region height.
   * @param {number} [region.multiplier=1] - Export multiplier.
   * @param {number} [region.quality=0.92] - Output image quality for lossy formats.
   * @param {'jpeg'|'png'|'webp'} [region.format='jpeg'] - Output image format.
   * @param {Object|null} [region.sealPartialEdges=null] - Fractional canvas edges whose alpha should be sealed.
   * @returns {Promise<string>} Resolves with an image data URL for the cropped region.
   * @private
   */
  async _exportCanvasRegionToDataURL({ sourceX, sourceY, sourceWidth, sourceHeight, multiplier = 1, quality = 0.92, format = "jpeg", sealPartialEdges = null }) {
    const safeMultiplier = Math.max(1, Number(multiplier) || 1);
    const safeFormat = this._normalizeImageFormat(format);
    const exportFormat = safeFormat === "jpeg" ? "png" : safeFormat;
    let regionDataUrl = this.canvas.toDataURL({
      format: exportFormat,
      quality,
      multiplier: safeMultiplier,
      left: sourceX,
      top: sourceY,
      width: sourceWidth,
      height: sourceHeight
    });
    regionDataUrl = await this._sealPartialTransparentEdges(regionDataUrl, sealPartialEdges);
    if (safeFormat !== "jpeg") return regionDataUrl;
    return this._convertDataUrlToOpaqueJpeg(regionDataUrl, quality);
  }
  async _convertDataUrlToOpaqueJpeg(dataUrl, quality = 0.92) {
    const imageElement = await this._createImageElement(dataUrl);
    const width = Math.max(1, imageElement.naturalWidth || imageElement.width || 1);
    const height = Math.max(1, imageElement.naturalHeight || imageElement.height || 1);
    const offscreenCanvas = document.createElement("canvas");
    offscreenCanvas.width = width;
    offscreenCanvas.height = height;
    const context = offscreenCanvas.getContext("2d");
    if (!context) throw new Error("2D canvas context is unavailable");
    context.fillStyle = this._getJpegBackgroundColor();
    context.fillRect(0, 0, width, height);
    context.drawImage(imageElement, 0, 0, width, height);
    return offscreenCanvas.toDataURL("image/jpeg", this._normalizeQuality(quality));
  }
  _getJpegBackgroundColor() {
    const backgroundColor = String(this.options.backgroundColor || "").trim();
    if (!backgroundColor || this._isTransparentCssColor(backgroundColor)) return "#ffffff";
    return backgroundColor;
  }
  _isTransparentCssColor(color) {
    const normalizedColor = String(color || "").trim().toLowerCase();
    if (!normalizedColor || normalizedColor === "transparent") return true;
    const hexAlphaMatch = normalizedColor.match(/^#(?:[0-9a-f]{3}([0-9a-f])|[0-9a-f]{6}([0-9a-f]{2}))$/i);
    if (hexAlphaMatch) {
      const alpha = hexAlphaMatch[1] || hexAlphaMatch[2];
      return alpha === "0" || alpha === "00";
    }
    const slashAlphaMatch = normalizedColor.match(/^(?:rgba?|hsla?)\([^)]*\/\s*([^)]+)\)$/i);
    if (slashAlphaMatch) return this._isZeroCssAlpha(slashAlphaMatch[1]);
    const commaAlphaMatch = normalizedColor.match(/^(?:rgba|hsla)\((.*)\)$/i);
    if (commaAlphaMatch) {
      const parts = commaAlphaMatch[1].split(",");
      if (parts.length >= 4) return this._isZeroCssAlpha(parts[parts.length - 1]);
    }
    return false;
  }
  _isZeroCssAlpha(alphaValue) {
    const normalizedAlpha = String(alphaValue || "").trim();
    if (!normalizedAlpha) return false;
    if (normalizedAlpha.endsWith("%")) return Number.parseFloat(normalizedAlpha) === 0;
    return Number(normalizedAlpha) === 0;
  }
  _decodeBase64Payload(base64Payload) {
    const payload = String(base64Payload || "");
    if (typeof atob === "function") {
      return Uint8Array.from(atob(payload), (char) => char.charCodeAt(0));
    }
    if (typeof Buffer !== "undefined" && typeof Buffer.from === "function") {
      return new Uint8Array(Buffer.from(payload, "base64"));
    }
    throw new Error("Base64 decoding is unavailable");
  }
  /** 
   * Gets the top-left corner coordinates of the given object.
   * Used for geometry calculations (e.g., scale, rotate).
   * 
   * @param {Object} fabricObject - The object for which to get the top-left coordinates. Should support setCoords and getCoords/getBoundingRect methods.
   * @returns {{x: number, y: number}} The top-left corner point as an object with x and y properties.
   * @private
   */
  _getObjectTopLeftPoint(fabricObject) {
    if (!fabricObject) return { x: 0, y: 0 };
    fabricObject.setCoords();
    const boundingRect = fabricObject.getBoundingRect(true, true);
    return { x: boundingRect.left, y: boundingRect.top };
  }
  _getObjectCoordinateTopLeftPoint(fabricObject) {
    if (!fabricObject) return { x: 0, y: 0 };
    fabricObject.setCoords();
    const coords = typeof fabricObject.getCoords === "function" ? fabricObject.getCoords() : null;
    if (coords && coords.length) return coords[0];
    return this._getObjectTopLeftPoint(fabricObject);
  }
  _getObjectOriginPoint(fabricObject, originX, originY) {
    if (!fabricObject) return { x: 0, y: 0 };
    if (typeof fabricObject.getPointByOrigin === "function") {
      return fabricObject.getPointByOrigin(originX, originY);
    }
    return this._getObjectTopLeftPoint(fabricObject);
  }
  _translateObjectByCanvasOffset(fabricObject, deltaX, deltaY) {
    if (!fabricObject) return;
    if (typeof fabricObject.getCenterPoint === "function" && typeof fabricObject.setPositionByOrigin === "function") {
      const center = fabricObject.getCenterPoint();
      const nextCenter = new fabric.Point(center.x + deltaX, center.y + deltaY);
      fabricObject.setPositionByOrigin(nextCenter, "center", "center");
    } else {
      fabricObject.set({
        left: (fabricObject.left || 0) + deltaX,
        top: (fabricObject.top || 0) + deltaY
      });
    }
    fabricObject.setCoords();
  }
  /**
   * Sets the object's origin at the specified origin point, keeping a reference point fixed in position.
   * 
   * @param {Object} fabricObject - The object to modify. Should support set, setPositionByOrigin, and setCoords.
   * @param {string} originX - The new originX ("left", "center", "right", etc.).
   * @param {string} originY - The new originY ("top", "center", "bottom", etc.).
   * @param {{x: number, y: number}} refPoint - The point to keep fixed while setting the new origins.
   * @private
   */
  _setObjectOriginKeepingPosition(fabricObject, originX, originY, refPoint) {
    if (!fabricObject || !refPoint || !fabricObject.setPositionByOrigin) return;
    fabricObject.set({ originX, originY });
    fabricObject.setPositionByOrigin(refPoint, originX, originY);
    fabricObject.setCoords();
  }
  /**
   * Moves the object so its bounding box aligns with the canvas's top-left corner (0, 0).
   * 
   * @param {Object} fabricObject - The object to align.
   * @private
   */
  _alignObjectBoundingBoxToCanvasTopLeft(fabricObject) {
    if (!fabricObject) return;
    fabricObject.setCoords();
    const boundingRect = fabricObject.getBoundingRect(true, true);
    const deltaX = boundingRect.left;
    const deltaY = boundingRect.top;
    fabricObject.set({ left: (fabricObject.left || 0) - deltaX, top: (fabricObject.top || 0) - deltaY });
    fabricObject.setCoords();
    this.canvas.renderAll();
  }
  /**
   * Updates the canvas size to match the bounding box of the original image,
   * ensuring that the canvas is always at least as large as its container.
   * @private
   */
  _updateCanvasSizeToImageBounds() {
    if (!this.originalImage) return;
    this.originalImage.setCoords();
    const imageBounds = this.originalImage.getBoundingRect(true, true);
    const size = this._getScrollableCanvasSize(imageBounds.width, imageBounds.height);
    this._setCanvasSizeInt(size.width, size.height);
  }
  /**
   * Whether post-load edits should resize the canvas to keep transformed content visible.
   *
   * @returns {boolean} True when canvas bounds should follow edited image or mask bounds.
   * @private
   */
  _shouldResizeCanvasToContentBounds() {
    return !!(this.options.expandCanvasToImage || this.options.coverImageToCanvas || this.options.fitImageToCanvas);
  }
  /**
   * Expands the canvas once so all provided objects remain visible after an edit.
   *
   * @param {Array<fabric.Object>} fabricObjects - Objects whose bounds should fit inside the canvas.
   * @param {number} [padding=10] - Extra canvas space after the farthest object edge.
   * @returns {void}
   * @private
   */
  _expandCanvasToFitObjects(fabricObjects, padding = 10) {
    if (!this.canvas || !Array.isArray(fabricObjects) || !fabricObjects.length || !this._shouldResizeCanvasToContentBounds()) return;
    try {
      const currentWidth = this.canvas.getWidth();
      const currentHeight = this.canvas.getHeight();
      let requiredWidth = currentWidth;
      let requiredHeight = currentHeight;
      fabricObjects.forEach((fabricObject) => {
        if (!fabricObject) return;
        if (typeof fabricObject.setCoords === "function") fabricObject.setCoords();
        const boundingRect = fabricObject.getBoundingRect(true, true);
        requiredWidth = Math.max(requiredWidth, Math.ceil(boundingRect.left + boundingRect.width + padding));
        requiredHeight = Math.max(requiredHeight, Math.ceil(boundingRect.top + boundingRect.height + padding));
      });
      const shouldUseScrollSafeViewport = this.options.fitImageToCanvas || this.options.coverImageToCanvas;
      let minWidth = 0;
      let minHeight = 0;
      if (shouldUseScrollSafeViewport) {
        const viewport = this._getContainerViewportSize();
        const safetyMargin = this._getScrollSafetyMargin();
        minWidth = Math.max(1, viewport.width - safetyMargin);
        minHeight = Math.max(1, viewport.height - safetyMargin);
      } else if (this.containerElement) {
        minWidth = Math.floor(this.containerElement.clientWidth || 0);
        minHeight = Math.floor(this.containerElement.clientHeight || 0);
      }
      const newWidth = Math.max(currentWidth, minWidth, requiredWidth);
      const newHeight = Math.max(currentHeight, minHeight, requiredHeight);
      if (newWidth !== currentWidth || newHeight !== currentHeight) {
        this._setCanvasSizeInt(newWidth, newHeight);
      }
    } catch (error) {
      this._reportWarning("expandCanvasToFitObjects: failed to expand canvas", error);
    }
  }
  /**
   * Expands the canvas so one object remains visible after an edit.
   *
   * @param {fabric.Object} fabricObject - Object whose bounds should fit inside the canvas.
   * @param {number} [padding=10] - Extra canvas space after the object edge.
   * @returns {void}
   * @private
   */
  _expandCanvasToFitObject(fabricObject, padding = 10) {
    this._expandCanvasToFitObjects([fabricObject], padding);
  }
  /** 
   * Scales the original image by a given factor, with animation.
   * Returns a promise that resolves when the scale animation is complete.
   * @param {number} factor - The scaling factor (will be clamped between `options.minScale` and `options.maxScale`).
   * @returns {Promise<void>} Promise that resolves once the scaling animation finishes.
   * @public
   */
  scaleImage(factor, options = {}) {
    try {
      this._assertCanQueueAnimation("scaleImage", options);
    } catch (error) {
      return Promise.reject(error);
    }
    return this.animationQueue.add(() => this._scaleImageImpl(factor, options)).finally(() => {
      if (!this._disposed && this.canvas) this._updateUI();
    });
  }
  _getInternalOperationToken(options) {
    return options && options[INTERNAL_OPERATION_TOKEN];
  }
  _isOwnInternalOperation(options) {
    const token = this._getInternalOperationToken(options);
    return !!token && token === this._activeOperationToken;
  }
  _beginBusyOperation(operationName) {
    const token = Symbol(operationName);
    this._activeOperationName = operationName;
    this._activeOperationToken = token;
    this._updateUI();
    return token;
  }
  _endBusyOperation(token) {
    if (token && token === this._activeOperationToken) {
      this._activeOperationName = null;
      this._activeOperationToken = null;
      this._updateUI();
    }
  }
  _withInternalOperationOptions(token, options = {}) {
    return {
      ...options,
      [INTERNAL_OPERATION_TOKEN]: token
    };
  }
  _assertEditorAvailable(operationName) {
    if (this._disposed || !this.canvas) throw new Error(`${operationName} cannot run after the editor has been disposed`);
  }
  _assertIdleForOperation(operationName, options = {}) {
    this._assertEditorAvailable(operationName);
    const isOwnInternalOperation = this._isOwnInternalOperation(options);
    if (this.isAnimating || this.animationQueue && this.animationQueue.isBusy()) {
      throw new Error(`${operationName} cannot run while an animation is running`);
    }
    if (this._isLoading && !isOwnInternalOperation) {
      throw new Error(`${operationName} cannot run while an image is loading`);
    }
    if (this._activeOperationToken && !isOwnInternalOperation) {
      throw new Error(`${operationName} cannot run while ${this._activeOperationName || "another operation"} is running`);
    }
  }
  _assertCanQueueAnimation(operationName, options = {}) {
    this._assertEditorAvailable(operationName);
    if (this._isLoading && !this._isOwnInternalOperation(options)) {
      throw new Error(`${operationName} cannot run while an image is loading`);
    }
    if (this._activeOperationToken && !this._isOwnInternalOperation(options)) {
      throw new Error(`${operationName} cannot run while ${this._activeOperationName || "another operation"} is running`);
    }
  }
  _canMutateNow(operationName, options = {}) {
    try {
      this._assertIdleForOperation(operationName, options);
      return true;
    } catch (error) {
      this._reportError(`${operationName} blocked`, error);
      return false;
    }
  }
  _rejectActiveAnimations(reason) {
    const error = reason instanceof Error ? reason : new Error(String(reason || "Animation cancelled"));
    this._activeAnimationRejectors.forEach((reject) => {
      try {
        reject(error);
      } catch (rejectError) {
        void rejectError;
      }
    });
    this._activeAnimationRejectors.clear();
  }
  _animateFabricProperty(fabricObject, property, value) {
    return new Promise((resolve, reject) => {
      if (this._disposed || !this.canvas || !fabricObject) {
        reject(new Error("Animation cannot start after editor disposal"));
        return;
      }
      let isSettled = false;
      const duration = Math.max(0, Number(this.options.animationDuration) || 0);
      const timeoutMs = Math.max(1e3, duration + 1e3);
      let timerId;
      const settle = (callback) => {
        if (isSettled) return;
        isSettled = true;
        clearTimeout(timerId);
        this._activeAnimationRejectors.delete(reject);
        callback();
      };
      this._activeAnimationRejectors.add(reject);
      timerId = setTimeout(() => {
        settle(() => reject(new Error(`Animation timed out while changing ${property}`)));
      }, timeoutMs);
      try {
        fabricObject.animate(property, value, {
          duration,
          onChange: () => {
            if (!this._disposed && this.canvas) this.canvas.renderAll();
          },
          onComplete: () => settle(resolve)
        });
      } catch (error) {
        settle(() => reject(error));
      }
    });
  }
  /** 
   * Scales the original image by a given factor, with animation.
   * Returns a promise that resolves when the scale animation is complete.
   * @param {number} factor - The scaling factor (will be clamped between `options.minScale` and `options.maxScale`).
   * @returns {Promise<void>} Promise that resolves once the scaling animation finishes.
   * @private
   */
  async _scaleImageImpl(factor, options = {}) {
    if (!this.originalImage || this._disposed) return;
    if (this.isAnimating) return;
    const saveHistory = options.saveHistory !== false;
    let didStartAnimation = false;
    try {
      factor = Math.max(this.options.minScale, Math.min(this.options.maxScale, factor));
      this.currentScale = factor;
      this.isAnimating = true;
      didStartAnimation = true;
      this._updateUI();
      const targetScale = this.baseImageScale * factor;
      const topLeft = this._getObjectTopLeftPoint(this.originalImage);
      this._setObjectOriginKeepingPosition(this.originalImage, "left", "top", topLeft);
      await Promise.all([
        this._animateFabricProperty(this.originalImage, "scaleX", targetScale),
        this._animateFabricProperty(this.originalImage, "scaleY", targetScale)
      ]);
      if (this._disposed || !this.canvas || !this.originalImage) throw new Error("Editor was disposed during scale animation");
      this.originalImage.set({ scaleX: targetScale, scaleY: targetScale });
      this.originalImage.setCoords();
      if (this._shouldResizeCanvasToContentBounds()) {
        this._updateCanvasSizeToImageBounds();
      }
      this._alignObjectBoundingBoxToCanvasTopLeft(this.originalImage);
      this.canvas.getObjects().forEach((object) => {
        if (object.maskId) this._syncMaskLabel(object);
      });
      this._updateInputs();
      if (saveHistory) this.saveState();
    } finally {
      if (didStartAnimation) {
        this.isAnimating = false;
        this._updateInputs();
        this._updateUI();
      }
    }
  }
  /** 
   * Rotates the original image by a given number of degrees, with animation.
   * Returns a promise that resolves when the rotation animation is complete.
   * @param {number} degrees - The angle in degrees to rotate the image.
   * @returns {Promise<void>} Promise that resolves once the rotation animation finishes.
   * @public
   */
  rotateImage(degrees, options = {}) {
    try {
      this._assertCanQueueAnimation("rotateImage", options);
    } catch (error) {
      return Promise.reject(error);
    }
    return this.animationQueue.add(() => this._rotateImageImpl(degrees, options)).finally(() => {
      if (!this._disposed && this.canvas) this._updateUI();
    });
  }
  /** 
   * Rotates the original image by a given number of degrees, with animation.
   * Returns a promise that resolves when the rotation animation is complete.
   * @param {number} degrees - The angle in degrees to rotate the image.
   * @returns {Promise<void>} Promise that resolves once the rotation animation finishes.
   * @private
   */
  async _rotateImageImpl(degrees, options = {}) {
    if (!this.originalImage || this._disposed) return;
    if (this.isAnimating) return;
    if (isNaN(degrees)) return;
    const saveHistory = options.saveHistory !== false;
    const image = this.originalImage;
    const previousOriginX = image.originX || "left";
    const previousOriginY = image.originY || "top";
    const previousOriginPoint = this._getObjectOriginPoint(image, previousOriginX, previousOriginY);
    let didStartAnimation = false;
    let didCompleteRotation = false;
    try {
      this.currentRotation = degrees;
      this.isAnimating = true;
      didStartAnimation = true;
      this._updateUI();
      const center = image.getCenterPoint();
      this._setObjectOriginKeepingPosition(image, "center", "center", center);
      await this._animateFabricProperty(image, "angle", degrees);
      if (this._disposed || !this.canvas || !this.originalImage) throw new Error("Editor was disposed during rotation animation");
      this.originalImage.set("angle", degrees);
      this.originalImage.setCoords();
      if (this._shouldResizeCanvasToContentBounds()) {
        this._updateCanvasSizeToImageBounds();
      }
      this._alignObjectBoundingBoxToCanvasTopLeft(this.originalImage);
      const newTopLeft = this._getObjectCoordinateTopLeftPoint(this.originalImage);
      this._setObjectOriginKeepingPosition(this.originalImage, "left", "top", newTopLeft);
      this.canvas.getObjects().forEach((object) => {
        if (object.maskId) this._syncMaskLabel(object);
      });
      this._updateInputs();
      if (saveHistory) this.saveState();
      didCompleteRotation = true;
    } finally {
      if (!didCompleteRotation && !this._disposed && image) {
        this._setObjectOriginKeepingPosition(image, previousOriginX, previousOriginY, previousOriginPoint);
      }
      if (didStartAnimation) {
        this.isAnimating = false;
        this._updateInputs();
        this._updateUI();
      }
    }
  }
  /**
   * Resets the image transform: scales to 1 and rotates to 0 degrees.
   *
   * @returns {Promise<void>} Resolves when the reset history transition has been recorded.
   * @public
   */
  resetImageTransform() {
    if (!this.originalImage) return Promise.resolve();
    try {
      this._assertCanQueueAnimation("resetImageTransform");
    } catch (error) {
      return Promise.reject(error);
    }
    return this.animationQueue.add(async () => {
      const before = this._lastSnapshot || this._captureCanvasStateOrThrow("resetImageTransform");
      await this._scaleImageImpl(1, { saveHistory: false });
      await this._rotateImageImpl(0, { saveHistory: false });
      const after = this._captureCanvasStateOrThrow("resetImageTransform");
      this._pushStateTransition(before, after);
    }).finally(() => {
      if (!this._disposed && this.canvas) this._updateUI();
    }).catch((error) => {
      this._reportError("resetImageTransform() failed", error);
      throw error;
    });
  }
  /**
   * Backward-compatible alias for {@link ImageEditor#resetImageTransform}.
   *
   * @deprecated Use resetImageTransform() instead. This alias will be removed in v2.0.0.
   * @returns {Promise<void>} Resolves when the image transform reset is complete.
   */
  reset() {
    return this.resetImageTransform();
  }
  /**
   * Restores a serialized canvas state and rebinds editor-specific mask/image metadata.
   *
   * @param {string|Object} serializedState - State returned by `_serializeCanvasState()` as a JSON string or object.
   * @returns {Promise<void>} Resolves after Fabric has loaded the state and UI state has been refreshed.
   * @public
   */
  loadFromState(serializedState) {
    if (!serializedState || !this.canvas || this._disposed) return Promise.resolve();
    if (this._cropMode || this._cropRect) {
      this._removeCropRect();
      this._restoreCropObjectState();
      this._cropMode = false;
      if (this._prevSelectionSetting !== void 0 && this.canvas) {
        this.canvas.selection = !!this._prevSelectionSetting;
      }
      this._prevSelectionSetting = void 0;
    }
    return new Promise((resolve, reject) => {
      try {
        const state = typeof serializedState === "string" ? JSON.parse(serializedState) : serializedState;
        const editorMetadata = state && state.imageEditorMetadata ? state.imageEditorMetadata : null;
        if (editorMetadata && Object.prototype.hasOwnProperty.call(editorMetadata, "version") && Number(editorMetadata.version) !== 1) {
          this._reportWarning(`loadFromState: unsupported editor metadata version ${editorMetadata.version}`);
        }
        this.canvas.loadFromJSON(state, async () => {
          try {
            if (this._disposed || !this.canvas) {
              reject(new Error("Editor was disposed while loading state"));
              return;
            }
            await this._waitForFabricImagesReady(this.canvas.getObjects());
            if (this._disposed || !this.canvas) {
              reject(new Error("Editor was disposed while loading state"));
              return;
            }
            this._hideAllMaskLabels();
            const canvasObjects = this.canvas.getObjects();
            this.originalImage = canvasObjects.find((object) => object.type === "image" && !object.maskId) || null;
            if (this.originalImage) {
              this.originalImage.set({ originX: "left", originY: "top", selectable: false, evented: false, hasControls: false, hoverCursor: "default" });
              this.canvas.sendToBack(this.originalImage);
              const restoredBaseScale = Number(editorMetadata && editorMetadata.baseImageScale);
              const restoredCurrentScale = Number(editorMetadata && editorMetadata.currentScale);
              const restoredCurrentRotation = Number(editorMetadata && editorMetadata.currentRotation);
              if (Number.isFinite(restoredBaseScale) && restoredBaseScale > 0) {
                this.baseImageScale = restoredBaseScale;
              }
              if (Number.isFinite(restoredCurrentScale) && restoredCurrentScale > 0) {
                this.currentScale = restoredCurrentScale;
              } else {
                const baseScale = Number(this.baseImageScale) || 1;
                const imageScale = Number(this.originalImage.scaleX) || baseScale;
                this.currentScale = imageScale / baseScale;
              }
              this.currentRotation = Number.isFinite(restoredCurrentRotation) ? restoredCurrentRotation : Number(this.originalImage.angle) || 0;
            } else {
              this.baseImageScale = 1;
              this.currentScale = 1;
              this.currentRotation = 0;
            }
            const masks = canvasObjects.filter((object) => object.maskId);
            masks.forEach((mask) => {
              this._restoreMaskControls(mask);
              this._rebindMaskEvents(mask);
              mask.set(this._getMaskNormalStyle(mask));
            });
            const restoredMaskCounter = Number(editorMetadata && editorMetadata.maskCounter);
            const maxMaskId = masks.reduce((max, mask) => Math.max(max, mask.maskId), 0);
            this.maskCounter = Number.isFinite(restoredMaskCounter) && restoredMaskCounter >= maxMaskId ? Math.floor(restoredMaskCounter) : maxMaskId;
            this._lastMask = masks.length ? masks[masks.length - 1] : null;
            if (!this._lastMask) {
              this._lastMaskInitialLeft = null;
              this._lastMaskInitialTop = null;
              this._lastMaskInitialWidth = null;
            }
            this.isImageLoadedToCanvas = !!this.originalImage;
            this.canvas.renderAll();
            this._updateInputs();
            this._updateMaskList();
            this._updatePlaceholderStatus();
            this._lastSnapshot = this._serializeCanvasState();
            this._updateUI();
            resolve();
          } catch (callbackError) {
            this._reportError("loadFromState() failed", callbackError);
            reject(callbackError);
          }
        });
      } catch (error) {
        this._reportError("loadFromState() failed", error);
        reject(error);
      }
    });
  }
  async _waitForFabricImagesReady(canvasObjects) {
    const imageObjects = (canvasObjects || []).filter((object) => object && object.type === "image");
    await Promise.all(imageObjects.map((object) => this._waitForImageElementReady(
      typeof object.getElement === "function" ? object.getElement() : object._element
    )));
  }
  _waitForImageElementReady(imageElement) {
    if (!imageElement) return Promise.resolve();
    const hasLoadedDimensions = (Number(imageElement.naturalWidth) > 0 || Number(imageElement.width) > 0) && (Number(imageElement.naturalHeight) > 0 || Number(imageElement.height) > 0);
    if (hasLoadedDimensions) return Promise.resolve();
    if (imageElement.complete) return Promise.reject(new Error("Image could not be loaded while restoring state"));
    return new Promise((resolve, reject) => {
      let isSettled = false;
      let timerId;
      const settle = (callback) => {
        if (isSettled) return;
        isSettled = true;
        clearTimeout(timerId);
        if (typeof imageElement.removeEventListener === "function") {
          imageElement.removeEventListener("load", handleLoad);
          imageElement.removeEventListener("error", handleError);
        } else {
          imageElement.onload = null;
          imageElement.onerror = null;
        }
        callback();
      };
      const handleLoad = () => {
        const didLoad = (Number(imageElement.naturalWidth) > 0 || Number(imageElement.width) > 0) && (Number(imageElement.naturalHeight) > 0 || Number(imageElement.height) > 0);
        settle(() => {
          if (didLoad) {
            resolve();
          } else {
            reject(new Error("Image could not be loaded while restoring state"));
          }
        });
      };
      const handleError = (error) => settle(() => reject(error instanceof Error ? error : new Error("Image could not be loaded while restoring state")));
      timerId = setTimeout(() => {
        settle(() => reject(new Error("Image load timed out while restoring state")));
      }, this._getSafeTimeoutMs(this.options.imageLoadTimeoutMs));
      if (typeof imageElement.addEventListener === "function") {
        imageElement.addEventListener("load", handleLoad, { once: true });
        imageElement.addEventListener("error", handleError, { once: true });
      } else {
        imageElement.onload = handleLoad;
        imageElement.onerror = handleError;
      }
    });
  }
  /**
   * Saves the current editable canvas state as an undoable history transition.
   *
   * Labels are hidden before serialization because labels are UI overlays, while mask metadata is kept on
   * mask objects and restored by `loadFromState()`.
   *
   * @returns {void}
   * @public
   */
  saveState() {
    if (!this.canvas) return;
    try {
      const after = this._captureCanvasStateOrThrow("saveState");
      const before = this._lastSnapshot || after;
      if (after === before) return;
      let executedOnce = false;
      const command = new Command(
        () => {
          if (executedOnce) {
            return this.loadFromState(after);
          }
          executedOnce = true;
          return void 0;
        },
        () => this.loadFromState(before)
      );
      this.historyManager.execute(command);
      this._lastSnapshot = after;
    } catch (error) {
      this._reportWarning("saveState: failed to save canvas snapshot", error);
    } finally {
      this._updateUI();
    }
  }
  /**
   * Pushes a precomputed before/after state transition into history.
   *
   * Use this for operations such as crop and merge that build their snapshots around asynchronous image
   * loading, where the "after" state is already applied before the history command is recorded.
   *
   * @param {string} before - Serialized state before the operation.
   * @param {string} after - Serialized state after the operation.
   * @returns {void}
   * @private
   */
  _pushStateTransition(before, after) {
    if (!before || !after) {
      this._reportWarning("History transition skipped because a canvas snapshot is unavailable");
      return;
    }
    if (before === after) return;
    if (!this.historyManager) this.historyManager = new HistoryManager(this.maxHistorySize || 50);
    const command = new Command(
      () => this.loadFromState(after),
      () => this.loadFromState(before)
    );
    this.historyManager.push(command);
    this._lastSnapshot = after;
    this._updateUI();
  }
  /**
   * Undo the last state change, if possible.
   *
   * @returns {Promise<void>} Resolves after the history manager finishes the queued undo.
   * @public
   */
  undo() {
    return this.historyManager.undo().then(() => {
      this._updateUI();
    }).catch((error) => {
      this._reportError("undo failed", error);
      throw error;
    });
  }
  /**
   * Redo the next state change, if possible.
   *
   * @returns {Promise<void>} Resolves after the history manager finishes the queued redo.
   * @public
   */
  redo() {
    return this.historyManager.redo().then(() => {
      this._updateUI();
    }).catch((error) => {
      this._reportError("redo failed", error);
      throw error;
    });
  }
  _rebindMaskEvents(mask) {
    if (!mask) return;
    if (mask.__imageEditorMaskHandlers) {
      try {
        mask.off("mouseover", mask.__imageEditorMaskHandlers.mouseover);
        mask.off("mouseout", mask.__imageEditorMaskHandlers.mouseout);
      } catch (error) {
        void error;
      }
    }
    const metadata = {};
    if (!Number.isFinite(Number(mask.originalAlpha))) {
      metadata.originalAlpha = Number.isFinite(Number(mask.opacity)) ? Number(mask.opacity) : 0.5;
    }
    if (!mask.originalStroke) metadata.originalStroke = mask.stroke || "#ccc";
    if (!Number.isFinite(Number(mask.originalStrokeWidth))) {
      metadata.originalStrokeWidth = Number.isFinite(Number(mask.strokeWidth)) ? Number(mask.strokeWidth) : 1;
    }
    if (Object.keys(metadata).length) mask.set(metadata);
    const mouseover = () => {
      const opacity = Number(mask.originalAlpha);
      mask.set({
        stroke: "#ff5500",
        strokeWidth: 2,
        opacity: Math.min((Number.isFinite(opacity) ? opacity : 0.5) + 0.2, 1)
      });
      if (mask.canvas) mask.canvas.requestRenderAll();
    };
    const mouseout = () => {
      mask.set(this._getMaskNormalStyle(mask));
      if (mask.canvas) mask.canvas.requestRenderAll();
    };
    mask.on("mouseover", mouseover);
    mask.on("mouseout", mouseout);
    mask.__imageEditorMaskHandlers = { mouseover, mouseout };
  }
  /**
   * Creates a mask and adds it to the canvas.
   *
   * Placement is based on explicit `left`/`top` values when provided; otherwise each new mask is placed
   * after the previously created mask. Fabric object properties are applied through `set()` and `setCoords()`
   * so controls and hit testing stay in sync with Fabric 5.x behavior.
   *
   * @param {Object} [config={}] - Optional mask configuration overrides.
   * @param {string} [config.shape='rect'] - Mask shape: `rect`, `circle`, `ellipse`, `polygon`, or a custom shape handled by `fabricGenerator`.
   * @param {Array<{x:number,y:number}>|Array<Array<number>>} [config.points] - Polygon points.
   * @param {number|string|MaskValueResolver} [config.width] - Width in pixels, percentage string, or resolver callback.
   * @param {number|string|MaskValueResolver} [config.height] - Height in pixels, percentage string, or resolver callback.
   * @param {number|string|MaskValueResolver} [config.radius] - Circle radius in pixels, percentage string, or resolver callback.
   * @param {number|string|MaskValueResolver} [config.rx] - Ellipse horizontal radius or rectangle corner radius.
   * @param {number|string|MaskValueResolver} [config.ry] - Ellipse vertical radius or rectangle corner radius.
   * @param {number|string|MaskValueResolver} [config.left] - Left position in pixels, percentage string, or resolver callback.
   * @param {number|string|MaskValueResolver} [config.top] - Top position in pixels, percentage string, or resolver callback.
   * @param {number} [config.angle=0] - Rotation angle in degrees.
   * @param {string} [config.color='rgba(0,0,0,0.5)'] - Fill color.
   * @param {number} [config.alpha=0.5] - Opacity from 0 to 1.
   * @param {boolean} [config.selectable=true] - Whether the mask can be selected.
   * @param {boolean} [config.hasControls=true] - Whether Fabric transform controls are shown.
   * @param {Object} [config.styles] - Additional Fabric style properties, such as `stroke` or `strokeDashArray`.
   * @param {MaskFabricGenerator} [config.fabricGenerator] - Factory callback that returns a custom Fabric object.
   * @param {MaskCreateCallback} [config.onCreate] - Callback invoked after the mask is added to the canvas.
   * @returns {fabric.Object|null} The created mask object, or null if the canvas is not initialized.
   * @public
   */
  createMask(config = {}) {
    if (!this.canvas) return null;
    if (!this._canMutateNow("createMask")) return null;
    const shapeType = config.shape || "rect";
    const maskConfig = {
      shape: shapeType,
      width: this.options.defaultMaskWidth,
      height: this.options.defaultMaskHeight,
      color: "rgba(0,0,0,0.5)",
      alpha: 0.5,
      gap: 5,
      left: void 0,
      top: void 0,
      angle: 0,
      selectable: true,
      ...config
    };
    const firstOffset = 10;
    let left;
    let top;
    const getCanvasBasis = (axis) => {
      const canvasWidth = this.canvas ? this.canvas.getWidth() : 0;
      const canvasHeight = this.canvas ? this.canvas.getHeight() : 0;
      if (axis === "height") return canvasHeight;
      if (axis === "min") return Math.min(canvasWidth, canvasHeight);
      return canvasWidth;
    };
    const resolveValue = (value, fallback, axis = "width") => {
      if (typeof value === "function")
        return value(this.canvas, this.options);
      if (typeof value === "string" && value.endsWith("%")) {
        const percent = Number.parseFloat(value) / 100;
        if (!Number.isFinite(percent)) return fallback;
        return Math.floor(getCanvasBasis(axis) * percent);
      }
      return value != null ? value : fallback;
    };
    if (maskConfig.left === void 0 && this._lastMask) {
      const previousMask = this._lastMask;
      if (typeof previousMask.setCoords === "function") previousMask.setCoords();
      const previousBounds = typeof previousMask.getBoundingRect === "function" ? previousMask.getBoundingRect(true, true) : { left: previousMask.left || firstOffset, top: previousMask.top || firstOffset, width: previousMask.width || 0 };
      left = Math.round(previousBounds.left + previousBounds.width + maskConfig.gap);
      top = Math.round(previousBounds.top ?? firstOffset);
    } else {
      left = resolveValue(maskConfig.left, firstOffset, "width");
      top = resolveValue(maskConfig.top, firstOffset, "height");
    }
    maskConfig.width = resolveValue(maskConfig.width, this.options.defaultMaskWidth, "width");
    maskConfig.height = resolveValue(maskConfig.height, this.options.defaultMaskHeight, "height");
    maskConfig.left = left;
    maskConfig.top = top;
    let mask;
    if (typeof maskConfig.fabricGenerator === "function") {
      mask = maskConfig.fabricGenerator(maskConfig, this.canvas, this.options);
    } else {
      switch (shapeType) {
        case "circle":
          mask = new fabric.Circle({
            left,
            top,
            radius: resolveValue(maskConfig.radius, Math.min(maskConfig.width, maskConfig.height) / 2, "min"),
            fill: maskConfig.color,
            opacity: maskConfig.alpha,
            angle: maskConfig.angle,
            ...maskConfig.styles
          });
          break;
        case "ellipse":
          mask = new fabric.Ellipse({
            left,
            top,
            rx: resolveValue(maskConfig.rx, maskConfig.width / 2, "width"),
            ry: resolveValue(maskConfig.ry, maskConfig.height / 2, "height"),
            fill: maskConfig.color,
            opacity: maskConfig.alpha,
            angle: maskConfig.angle,
            ...maskConfig.styles
          });
          break;
        case "polygon": {
          let polygonPoints = maskConfig.points || [];
          if (Array.isArray(polygonPoints) && polygonPoints.length) {
            polygonPoints = polygonPoints.map((point) => Array.isArray(point) ? { x: Number(point[0]), y: Number(point[1]) } : { x: Number(point.x), y: Number(point.y) });
          }
          mask = new fabric.Polygon(polygonPoints, {
            left,
            top,
            fill: maskConfig.color,
            opacity: maskConfig.alpha,
            angle: maskConfig.angle,
            ...maskConfig.styles
          });
          break;
        }
        case "rect":
        default:
          mask = new fabric.Rect({
            left,
            top,
            width: resolveValue(maskConfig.width, this.options.defaultMaskWidth, "width"),
            height: resolveValue(maskConfig.height, this.options.defaultMaskHeight, "height"),
            fill: maskConfig.color,
            opacity: maskConfig.alpha,
            angle: maskConfig.angle,
            rx: maskConfig.rx,
            ry: maskConfig.ry,
            ...maskConfig.styles
          });
      }
    }
    if (!mask || typeof mask.set !== "function" || typeof mask.setCoords !== "function") {
      this._reportWarning("fabricGenerator returned an invalid Fabric object");
      return null;
    }
    const styles = maskConfig.styles || {};
    const hasStyle = (property) => Object.prototype.hasOwnProperty.call(styles, property);
    const maskSettings = {
      selectable: maskConfig.selectable !== false,
      hasControls: "hasControls" in maskConfig ? maskConfig.hasControls : true,
      lockRotation: !this.options.maskRotatable,
      borderColor: "borderColor" in maskConfig ? maskConfig.borderColor : "red",
      cornerColor: "cornerColor" in maskConfig ? maskConfig.cornerColor : "black",
      cornerSize: "cornerSize" in maskConfig ? maskConfig.cornerSize : 8,
      transparentCorners: "transparentCorners" in maskConfig ? maskConfig.transparentCorners : false,
      stroke: hasStyle("stroke") ? styles.stroke : "#ccc",
      strokeWidth: hasStyle("strokeWidth") ? styles.strokeWidth : 1,
      opacity: hasStyle("opacity") ? styles.opacity : maskConfig.alpha,
      strokeUniform: "strokeUniform" in maskConfig ? maskConfig.strokeUniform : hasStyle("strokeUniform") ? styles.strokeUniform : true
    };
    if (hasStyle("strokeDashArray")) maskSettings.strokeDashArray = styles.strokeDashArray;
    mask.set(maskSettings);
    mask.setCoords();
    mask.set({
      originalAlpha: Number.isFinite(Number(mask.opacity)) ? Number(mask.opacity) : maskConfig.alpha,
      originalStroke: mask.stroke || "#ccc",
      originalStrokeWidth: Number.isFinite(Number(mask.strokeWidth)) ? Number(mask.strokeWidth) : 1
    });
    this._rebindMaskEvents(mask);
    this._expandCanvasToFitObject(mask);
    this._lastMaskInitialLeft = left;
    this._lastMaskInitialTop = top;
    this._lastMaskInitialWidth = resolveValue(maskConfig.width, this.options.defaultMaskWidth, "width");
    const maskId = ++this.maskCounter;
    mask.set({
      maskId,
      maskName: `${this.options.maskName}${maskId}`
    });
    this._lastMask = mask;
    this.canvas.add(mask);
    this.canvas.bringToFront(mask);
    if (maskConfig.selectable) this.canvas.setActiveObject(mask);
    this._handleSelectionChanged([mask]);
    this._updateMaskList();
    this._updateUI();
    this.canvas.renderAll();
    this.saveState();
    if (typeof maskConfig.onCreate === "function") maskConfig.onCreate(mask, this.canvas);
    return mask;
  }
  /**
   * Backward-compatible alias for {@link ImageEditor#createMask}.
   *
   * @deprecated Use createMask() instead. This alias will be removed in v2.0.0.
   * @param {Object} [config={}] - Mask configuration passed to createMask().
   * @returns {fabric.Object|null} The created mask object, or null if the canvas is not initialized.
   */
  addMask(config = {}) {
    return this.createMask(config);
  }
  /**
   * Removes the currently selected mask from the canvas, if any.
   * The associated label is also removed. UI and mask list are updated.
   */
  removeSelectedMask() {
    if (!this.canvas) return;
    if (!this._canMutateNow("removeSelectedMask")) return;
    const activeObject = this.canvas.getActiveObject();
    const selectedMasks = this._getModifiedMasks(activeObject);
    if (!selectedMasks.length) return;
    this.canvas.discardActiveObject();
    selectedMasks.forEach((mask) => {
      this._removeLabelForMask(mask);
      this.canvas.remove(mask);
    });
    const masks = this.canvas.getObjects().filter((object) => object.maskId);
    this._lastMask = masks.length ? masks[masks.length - 1] : null;
    if (!this._lastMask) {
      this._lastMaskInitialLeft = null;
      this._lastMaskInitialTop = null;
      this._lastMaskInitialWidth = null;
    }
    this._updateMaskList();
    this._updateUI();
    this.canvas.renderAll();
    this.saveState();
  }
  /**
   * Removes all masks from the canvas, including their labels.
   * UI and internal mask placement memory are reset.
   */
  removeAllMasks(options = {}) {
    if (!this.canvas) return;
    if (!this._canMutateNow("removeAllMasks", options)) return;
    const saveHistory = options.saveHistory !== false;
    const masks = this.canvas.getObjects().filter((object) => object.maskId);
    masks.forEach((mask) => this._removeLabelForMask(mask));
    masks.forEach((mask) => this.canvas.remove(mask));
    this.canvas.discardActiveObject();
    this._lastMask = null;
    this._lastMaskInitialLeft = null;
    this._lastMaskInitialTop = null;
    this._lastMaskInitialWidth = null;
    this._updateMaskList();
    this._updateUI();
    this.canvas.renderAll();
    if (saveHistory) this.saveState();
  }
  /**
   * Removes the label associated with the specified mask object, if it exists.
   * 
   * @param {fabric.Object} mask - The mask object whose label should be removed.
   * @private
   */
  _removeLabelForMask(mask) {
    if (!mask || !this.canvas) return;
    if (mask.__label) {
      try {
        const canvasObjects = this.canvas.getObjects();
        if (canvasObjects.includes(mask.__label)) {
          this.canvas.remove(mask.__label);
        }
      } catch (error) {
        void error;
      }
      try {
        delete mask.__label;
      } catch (error) {
        void error;
      }
    }
  }
  _captureMaskLabelBackups(masks) {
    if (!this.canvas) return [];
    const canvasObjects = new Set(this.canvas.getObjects());
    return (masks || []).map((mask) => {
      const label = mask && mask.__label ? mask.__label : null;
      return {
        mask,
        label,
        hadLabel: !!label,
        labelInCanvas: !!label && canvasObjects.has(label),
        visible: label ? label.visible : void 0
      };
    });
  }
  _restoreMaskLabelBackups(labelBackups) {
    if (!this.canvas || !Array.isArray(labelBackups)) return;
    const canvasObjects = new Set(this.canvas.getObjects());
    labelBackups.forEach((backup) => {
      if (!backup || !backup.mask) return;
      try {
        if (!backup.hadLabel) {
          if (backup.mask.__label) this._removeLabelForMask(backup.mask);
          return;
        }
        backup.mask.__label = backup.label;
        if (!backup.label) return;
        if (backup.labelInCanvas && !canvasObjects.has(backup.label)) {
          this.canvas.add(backup.label);
          canvasObjects.add(backup.label);
        }
        if (backup.visible !== void 0) backup.label.set({ visible: backup.visible });
        if (backup.labelInCanvas) this.canvas.bringToFront(backup.label);
        this._syncMaskLabel(backup.mask);
      } catch (error) {
        void error;
      }
    });
  }
  _captureActiveObjectBackup() {
    if (!this.canvas) return null;
    const activeObject = this.canvas.getActiveObject();
    if (!activeObject) return null;
    const selectedObjects = typeof activeObject.getObjects === "function" ? activeObject.getObjects() : [activeObject];
    return { activeObject, selectedObjects };
  }
  _restoreActiveObjectBackup(activeObjectBackup) {
    if (!this.canvas || !activeObjectBackup || !activeObjectBackup.activeObject) return;
    const canvasObjects = this.canvas.getObjects();
    const selectedObjects = Array.isArray(activeObjectBackup.selectedObjects) ? activeObjectBackup.selectedObjects : [];
    const canRestore = selectedObjects.length ? selectedObjects.every((object) => canvasObjects.includes(object)) : canvasObjects.includes(activeObjectBackup.activeObject);
    if (!canRestore) return;
    try {
      this.canvas.setActiveObject(activeObjectBackup.activeObject);
    } catch (error) {
      void error;
    }
  }
  _captureMaskExportBackups(masks) {
    return (masks || []).map((mask) => ({
      object: mask,
      visible: mask.visible,
      opacity: mask.opacity,
      fill: mask.fill,
      strokeWidth: mask.strokeWidth,
      stroke: mask.stroke,
      selectable: mask.selectable,
      lockRotation: mask.lockRotation
    }));
  }
  _restoreMaskExportBackups(maskBackups) {
    (maskBackups || []).forEach((backup) => {
      try {
        backup.object.set({
          visible: backup.visible,
          opacity: backup.opacity,
          fill: backup.fill,
          strokeWidth: backup.strokeWidth,
          stroke: backup.stroke,
          selectable: backup.selectable,
          lockRotation: backup.lockRotation
        });
        backup.object.setCoords();
      } catch (error) {
        void error;
      }
    });
  }
  /**
   * Returns a stable zero-based creation index for label callbacks.
   *
   * Mask ids are one-based and are not renumbered after deletion, so this value remains stable for the
   * lifetime of a mask.
   *
   * @param {fabric.Object} mask - Mask object.
   * @returns {number} Stable zero-based creation index.
   * @private
   */
  _getMaskCreationIndex(mask) {
    const maskId = Number(mask && mask.maskId);
    if (Number.isFinite(maskId) && maskId > 0) return Math.floor(maskId) - 1;
    const masks = this.canvas ? this.canvas.getObjects().filter((object) => object.maskId) : [];
    return Math.max(0, masks.indexOf(mask));
  }
  /**
   * Creates and adds a custom label (fabric.Text or fabric.IText) for the mask.
   * The label is default bound to the top-left of the mask and managed as a non-interactive overlay.
   * 
   * @param {fabric.Object} mask - The mask to create a label for.
   * @private
   */
  _createLabelForMask(mask) {
    if (!mask || !this.options.maskLabelOnSelect) return;
    this._removeLabelForMask(mask);
    let textObject = null;
    if (this.options.label && typeof this.options.label.create === "function") {
      textObject = this.options.label.create(mask, fabric);
      if (!textObject || typeof textObject.set !== "function") {
        this._reportWarning("label.create() returned an invalid Fabric object; using the default label");
        textObject = null;
      }
    }
    if (!textObject) {
      let labelText = mask.maskName;
      let textOptions = {
        left: 0,
        top: 0,
        fontSize: 12,
        fill: "#fff",
        backgroundColor: "rgba(0,0,0,0.7)",
        selectable: false,
        evented: false,
        padding: 2,
        originX: "left",
        originY: "top"
      };
      if (this.options.label) {
        if (typeof this.options.label.getText === "function") {
          labelText = this.options.label.getText(mask, this._getMaskCreationIndex(mask));
        }
        if (this.options.label.textOptions) {
          Object.assign(textOptions, this.options.label.textOptions);
        }
      }
      textObject = new fabric.Text(labelText, textOptions);
    }
    textObject.maskLabel = true;
    mask.__label = textObject;
    this.canvas.add(textObject);
    this.canvas.bringToFront(textObject);
    this._syncMaskLabel(mask);
  }
  /**
   * Hides (removes) all mask labels from the canvas.
   * Internal label references on mask objects are also deleted.
   * @private
   */
  _hideAllMaskLabels() {
    if (!this.canvas) return;
    const canvasObjects = this.canvas.getObjects();
    const canvasObjectSet = new Set(canvasObjects);
    const labels = canvasObjects.filter((object) => object.maskLabel);
    labels.forEach((label) => {
      try {
        if (canvasObjectSet.has(label)) {
          this.canvas.remove(label);
          canvasObjectSet.delete(label);
        }
      } catch (error) {
        void error;
      }
    });
    canvasObjects.forEach((object) => {
      if (object.maskId && object.__label) {
        try {
          delete object.__label;
        } catch (error) {
          void error;
        }
      }
    });
  }
  /**
   * Synchronizes the position, angle, and visibility of the mask's label so that it appears properly above the mask.
   * 
   * @param {fabric.Object} mask - The mask whose label should be repositioned.
   * @private
   */
  _syncMaskLabel(mask) {
    if (!mask) return;
    if (!this.options.maskLabelOnSelect) return;
    if (!mask.__label) return;
    if (typeof mask.setCoords === "function") mask.setCoords();
    const bounds = mask.getBoundingRect ? mask.getBoundingRect(true, true) : null;
    if (!bounds) return;
    const tl = { x: bounds.left, y: bounds.top };
    const center = mask.getCenterPoint();
    const vx = center.x - tl.x;
    const vy = center.y - tl.y;
    const dist = Math.sqrt(vx * vx + vy * vy) || 1;
    const ux = vx / dist;
    const uy = vy / dist;
    const offset = Math.max(0, this.options.maskLabelOffset ?? 3);
    const px = tl.x + ux * offset;
    const py = tl.y + uy * offset;
    mask.__label.set({
      left: Math.round(px),
      top: Math.round(py),
      angle: mask.angle || 0,
      originX: "left",
      originY: "top",
      visible: true
    });
    mask.__label.setCoords();
    if (typeof this.canvas.requestRenderAll === "function") {
      this.canvas.requestRenderAll();
    } else {
      this.canvas.renderAll();
    }
  }
  /**
   * Shows the label for the given mask, creating it if necessary and synchronizing its position.
   * 
   * @param {fabric.Object} mask - The mask whose label should be shown.
   * @private
   */
  _showLabelForMask(mask) {
    if (!mask) return;
    if (!this.options.maskLabelOnSelect) return;
    if (!mask.__label) this._createLabelForMask(mask);
    mask.__label.set({ visible: true });
    this._syncMaskLabel(mask);
  }
  /**
   * Handles changes to the selection of canvas objects (masks),
   * updates mask stroke and label display, and syncs mask list selection.
   *
   * @param {Array<Object>} selected - The currently selected objects (e.g. [mask] or []).
   * @private
   */
  _handleSelectionChanged(selected) {
    const selectedMask = (selected || []).find((object) => object.maskId);
    const masks = this.canvas.getObjects().filter((object) => object.maskId);
    masks.forEach((mask) => {
      if (mask !== selectedMask) {
        if (mask.__label) {
          try {
            this.canvas.remove(mask.__label);
          } catch (error) {
            void error;
          }
          delete mask.__label;
        }
        const originalStrokeWidth = Number(mask.originalStrokeWidth);
        mask.set({
          stroke: mask.originalStroke || "#ccc",
          strokeWidth: Number.isFinite(originalStrokeWidth) ? originalStrokeWidth : 1
        });
      } else {
        mask.set({ stroke: "#ff0000", strokeWidth: 1 });
      }
    });
    if (selectedMask) this._showLabelForMask(selectedMask);
    this._updateMaskListSelection(selectedMask);
    this.canvas.renderAll();
    this._updateUI();
  }
  /**
   * Updates the mask list in the DOM to reflect the current masks on the canvas.
   * Each list entry becomes a clickable element for mask selection.
   * @private
   */
  _updateMaskList() {
    const maskListElement = this._getElement("maskList");
    if (!maskListElement) return;
    maskListElement.innerHTML = "";
    const masks = this.canvas.getObjects().filter((object) => object.maskId);
    masks.forEach((mask) => {
      const listItemElement = document.createElement("li");
      listItemElement.className = "list-group-item mask-item";
      listItemElement.textContent = mask.maskName;
      listItemElement.dataset.maskId = String(mask.maskId);
      maskListElement.appendChild(listItemElement);
    });
  }
  _handleMaskListClick(event) {
    if (!this.canvas) return;
    const itemElement = event.target && event.target.closest ? event.target.closest(".mask-item") : null;
    if (!itemElement || !itemElement.dataset) return;
    const maskId = Number(itemElement.dataset.maskId);
    const mask = this.canvas.getObjects().find((object) => Number(object.maskId) === maskId);
    if (!mask) return;
    this.canvas.setActiveObject(mask);
    this._handleSelectionChanged([mask]);
  }
  /**
   * Updates the visual selection (CSS 'active') state for the mask list in the DOM.
   * 
   * @param {Object|null} selectedMask - The currently selected mask, or null if none selected.
   * @private
   */
  _updateMaskListSelection(selectedMask) {
    const maskListElement = this._getElement("maskList");
    if (!maskListElement) return;
    const maskItems = maskListElement.querySelectorAll(".mask-item");
    maskItems.forEach((item) => {
      const isSelected = !!selectedMask && Number(item.dataset.maskId) === Number(selectedMask.maskId);
      item.classList.toggle("active", isSelected);
      item.classList.toggle("selected", isSelected);
    });
  }
  /**
   * Flattens the current masks into the base image and reloads the flattened image.
   *
   * This removes editable mask objects after export and records the operation as one undoable history transition.
   * It does nothing when no base image or no masks exist.
   *
   * @async
   * @returns {Promise<void>} Resolves when the flattened image has been loaded.
   * @public
   */
  async mergeMasks() {
    if (!this.originalImage) return;
    this._assertIdleForOperation("mergeMasks");
    const masks = this.canvas.getObjects().filter((object) => object.maskId);
    if (!masks.length) return;
    const beforeJson = this._serializeCanvasState();
    const operationToken = this._beginBusyOperation("mergeMasks");
    this.canvas.discardActiveObject();
    this.canvas.renderAll();
    try {
      const merged = await this.exportImageBase64(this._withInternalOperationOptions(operationToken, {
        exportImageArea: true,
        multiplier: this.options.exportMultiplier,
        fileType: "png"
      }));
      this.removeAllMasks(this._withInternalOperationOptions(operationToken, { saveHistory: false }));
      if (this.canvas.getObjects().some((object) => object.maskId)) {
        throw new Error("Masks could not be removed during merge");
      }
      await this.loadImage(merged, this._withInternalOperationOptions(operationToken, {
        preserveScroll: true,
        resetMaskCounter: false
      }));
      const afterJson = this._serializeCanvasState();
      this._pushStateTransition(beforeJson, afterJson);
    } catch (error) {
      this._reportError("merge error", error);
      try {
        await this.loadFromState(beforeJson);
      } catch (restoreError) {
        this._reportError("mergeMasks rollback failed", restoreError);
      }
      throw error;
    } finally {
      this._endBusyOperation(operationToken);
    }
  }
  /**
   * Backward-compatible alias for {@link ImageEditor#mergeMasks}.
   *
   * @deprecated Use mergeMasks() instead. This alias will be removed in v2.0.0.
   * @returns {Promise<void>} Resolves when mask flattening is complete.
   */
  async merge() {
    return this.mergeMasks();
  }
  /**
   * Triggers a JPEG image download of the current canvas.
   *
   * The image area and multiplier are controlled by options.
   * @param {string} [fileName=this.options.defaultDownloadFileName] - Desired download file name.
   * @returns {void}
   * @public
   */
  downloadImage(fileName = this.options.defaultDownloadFileName) {
    if (!this.originalImage) return;
    if (!this._canMutateNow("downloadImage")) return;
    const exportImageArea = this.options.exportImageAreaByDefault;
    this.exportImageBase64({ exportImageArea, multiplier: this.options.exportMultiplier }).then((imageBase64) => {
      const link = document.createElement("a");
      link.download = fileName;
      link.href = imageBase64;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }).catch((error) => this._reportError("download error", error));
  }
  /**
   * Exports the current image as a Base64-encoded data URL.
   *
   * When `exportImageArea` is false, the export omits masks and labels. When it is true, masks are
   * temporarily rendered as opaque export shapes and then restored, so editable mask state is not mutated.
   *
   * @async
   * @param {Object} [options={}] - Export options.
   * @param {boolean} [options.exportImageArea] - If true, exports only the image bounding area with masks cropped and blended.
   * @param {number} [options.multiplier=1] - Scaling multiplier for output (resolution).
   * @param {number} [options.quality=0.92] - Image quality between 0 and 1 for lossy formats.
   * @param {string} [options.fileType='jpeg'] - Output file type ('jpeg' | 'png' | 'webp').
   * @returns {Promise<string>} Resolves with an image data URL.
   * @throws {Error} If there is no image loaded.
   * @public
   */
  async exportImageBase64(options = {}) {
    if (!this.originalImage) throw new Error("No image loaded");
    this._assertIdleForOperation("exportImageBase64", options);
    const exportImageArea = typeof options.exportImageArea === "boolean" ? options.exportImageArea : this.options.exportImageAreaByDefault;
    const multiplier = options.multiplier || this.options.exportMultiplier || 1;
    const quality = this._normalizeQuality(options.quality ?? this.options.downsampleQuality);
    const format = this._normalizeImageFormat(options.fileType || options.format);
    if (!exportImageArea) {
      const masks2 = this.canvas.getObjects().filter((object) => object.maskId || object.maskLabel);
      const editableMasks = this.canvas.getObjects().filter((object) => object.maskId);
      const maskVisibilityBackups = masks2.map((mask) => ({ object: mask, visible: mask.visible }));
      const maskStyleBackups2 = this._captureMaskExportBackups(editableMasks);
      const labelBackups2 = this._captureMaskLabelBackups(editableMasks);
      const activeObjectBackup2 = this._captureActiveObjectBackup();
      try {
        masks2.forEach((mask) => {
          mask.set({ visible: false });
        });
        this.canvas.discardActiveObject();
        this.canvas.renderAll();
        this.originalImage.setCoords();
        const imageBounds = this.originalImage.getBoundingRect(true, true);
        const exportRegion = this._getClampedCanvasRegion(imageBounds);
        return await this._exportCanvasRegionToDataURL({
          ...exportRegion,
          multiplier,
          quality,
          format,
          sealPartialEdges: this._getPartialExportEdges(imageBounds)
        });
      } finally {
        maskVisibilityBackups.forEach((backup) => {
          try {
            backup.object.set({ visible: backup.visible });
          } catch (error) {
            void error;
          }
        });
        this._restoreMaskExportBackups(maskStyleBackups2);
        this._restoreMaskLabelBackups(labelBackups2);
        this._restoreActiveObjectBackup(activeObjectBackup2);
        this.canvas.renderAll();
      }
    }
    const masks = this.canvas.getObjects().filter((object) => object.maskId);
    const maskStyleBackups = this._captureMaskExportBackups(masks);
    const labelBackups = this._captureMaskLabelBackups(masks);
    const activeObjectBackup = this._captureActiveObjectBackup();
    let finalBase64;
    try {
      masks.forEach((mask) => this._removeLabelForMask(mask));
      this.canvas.discardActiveObject();
      this.canvas.renderAll();
      masks.forEach((mask) => {
        mask.set({ opacity: 1, fill: "#000000", strokeWidth: 0, stroke: null, selectable: false });
        mask.setCoords();
      });
      this.canvas.renderAll();
      this.originalImage.setCoords();
      const imageBounds = this.originalImage.getBoundingRect(true, true);
      const exportRegion = this._getClampedCanvasRegion(imageBounds);
      finalBase64 = await this._exportCanvasRegionToDataURL({
        ...exportRegion,
        multiplier,
        quality,
        format,
        sealPartialEdges: this._getPartialExportEdges(imageBounds)
      });
    } finally {
      this._restoreMaskExportBackups(maskStyleBackups);
      this._restoreMaskLabelBackups(labelBackups);
      this._restoreActiveObjectBackup(activeObjectBackup);
      this.canvas.renderAll();
    }
    return finalBase64;
  }
  /**
   * Backward-compatible alias for {@link ImageEditor#exportImageBase64}.
   *
   * @deprecated Use exportImageBase64() instead. This alias will be removed in v2.0.0.
   * @param {Object} [options={}] - Export options passed to exportImageBase64().
   * @returns {Promise<string>} Resolves with an image data URL.
   */
  async getImageBase64(options = {}) {
    return this.exportImageBase64(options);
  }
  /**
   * Exports the current image as a File object.
   *
   * The export can include flattened masks (`mergeMask: true`) or only the plain base image (`mergeMask: false`).
   * Supported output formats are JPEG, PNG, and WebP.
   * 
   * @async
   * @param {Object} [options={}] - Export options.
   * @param {boolean} [options.mergeMask=true] - If true, export image area with masks merged; if false, export the plain image without masks.
   * @param {string} [options.fileType='jpeg'] - Output file type ('jpeg' | 'png' | 'webp'). Defaults to 'jpeg' on invalid input.
   * @param {number} [options.quality=0.92] - Image quality for lossy types (0-1, default based on options.downsampleQuality).
   * @param {number} [options.multiplier=1] - Output resolution multiplier.
   * @param {string} [options.fileName] - Optional file name (only used for download).
   * @returns {Promise<File>} Resolves with the exported image as a File object.
   * 
   * @example
   *   const file = await this.exportImageFile({ mergeMask: false, fileType: 'png' });
   */
  async exportImageFile(options = {}) {
    if (!this.originalImage) throw new Error("No image loaded");
    this._assertIdleForOperation("exportImageFile");
    const {
      mergeMask = true,
      fileType = "jpeg",
      quality = this.options.downsampleQuality ?? 0.92,
      multiplier = this.options.exportMultiplier ?? 1,
      fileName = this.options.defaultDownloadFileName ?? "exported_image.jpg"
    } = options;
    const safeFileType = this._normalizeImageFormat(fileType);
    const normalizedQuality = this._normalizeQuality(quality);
    let imageBase64;
    if (mergeMask) {
      imageBase64 = await this.exportImageBase64({
        exportImageArea: true,
        multiplier,
        quality: normalizedQuality,
        fileType: safeFileType
      });
    } else {
      imageBase64 = await this.exportImageBase64({
        exportImageArea: false,
        multiplier,
        quality: normalizedQuality,
        fileType: safeFileType
      });
    }
    let imageDataUrl = imageBase64;
    if (!imageDataUrl.startsWith(`data:image/${safeFileType}`)) {
      imageDataUrl = await new Promise((resolve, reject) => {
        const imageElement = new window.Image();
        imageElement.crossOrigin = "Anonymous";
        imageElement.onload = () => {
          try {
            const offscreenCanvas = document.createElement("canvas");
            offscreenCanvas.width = imageElement.width;
            offscreenCanvas.height = imageElement.height;
            const context = offscreenCanvas.getContext("2d");
            if (!context) throw new Error("Unable to create 2D canvas context for export conversion");
            context.drawImage(imageElement, 0, 0);
            const convertedDataUrl = offscreenCanvas.toDataURL(`image/${safeFileType}`, normalizedQuality);
            resolve(convertedDataUrl);
          } catch (error) {
            reject(error);
          }
        };
        imageElement.onerror = reject;
        imageElement.src = imageBase64;
      });
    }
    const bytes = this._decodeBase64Payload(imageDataUrl.split(",")[1]);
    const mime = `image/${safeFileType}`;
    return new File([bytes], fileName, { type: mime });
  }
  _clearMaskPlacementMemory() {
    this._lastMask = null;
    this._lastMaskInitialLeft = null;
    this._lastMaskInitialTop = null;
    this._lastMaskInitialWidth = null;
  }
  async _restoreStateAfterCropFailure(beforeJson, message, error) {
    this._reportError(message, error);
    if (this._cropRect && this.canvas) this._removeCropRect();
    this._cropRect = null;
    this._cropMode = false;
    if (this.canvas && this._prevSelectionSetting !== void 0) {
      this.canvas.selection = !!this._prevSelectionSetting;
    }
    this._prevSelectionSetting = void 0;
    if (beforeJson) {
      try {
        await this.loadFromState(beforeJson);
      } catch (restoreError) {
        this._reportError("applyCrop: rollback failed", restoreError);
      }
    }
    this._updateUI();
    if (this.canvas) this.canvas.renderAll();
  }
  _restoreCropObjectState() {
    if (Array.isArray(this._cropPrevEvented)) {
      this._cropPrevEvented.forEach((state) => {
        try {
          state.object.set({
            evented: state.evented,
            selectable: state.selectable,
            visible: state.visible
          });
        } catch (error) {
          void error;
        }
      });
    }
    this._cropPrevEvented = null;
  }
  _removeCropRect() {
    if (!this._cropRect) return;
    try {
      if (this._cropHandlers && this._cropHandlers.length) {
        this._cropHandlers.forEach((targetHandlers) => {
          targetHandlers.handlers.forEach((handlerRecord) => {
            if (targetHandlers.target && typeof targetHandlers.target.off === "function") {
              targetHandlers.target.off(handlerRecord.eventName, handlerRecord.handler);
            }
          });
        });
      }
    } catch (error) {
      void error;
    }
    try {
      if (this.canvas) this.canvas.remove(this._cropRect);
    } catch (error) {
      void error;
    }
    this._cropRect = null;
    this._cropHandlers = [];
  }
  /**
   * Enters crop mode by creating a resizable crop rectangle above the base image.
   *
   * Other canvas objects are made non-interactive while crop mode is active. Masks can be hidden during
   * cropping when `crop.hideMasksDuringCrop` is enabled.
   *
   * @returns {void}
   * @public
   */
  enterCropMode() {
    if (!this.canvas || !this.originalImage || this._cropMode) return;
    if (!this._canMutateNow("enterCropMode")) return;
    if (!this.isImageLoaded()) return;
    this._removeCropRect();
    this._cropMode = true;
    this._prevSelectionSetting = this.canvas.selection;
    this.canvas.selection = false;
    this.canvas.discardActiveObject();
    this.originalImage.setCoords();
    const imageBounds = this.originalImage.getBoundingRect(true, true);
    const padding = this.options.crop && this.options.crop.padding ? this.options.crop.padding : 10;
    const left = Math.max(0, Math.floor(imageBounds.left + padding));
    const top = Math.max(0, Math.floor(imageBounds.top + padding));
    const maxCropWidth = Math.max(1, Math.floor(imageBounds.width - padding * 2));
    const maxCropHeight = Math.max(1, Math.floor(imageBounds.height - padding * 2));
    const configuredMinWidth = Math.max(1, Number(this.options.crop.minWidth) || 50);
    const configuredMinHeight = Math.max(1, Number(this.options.crop.minHeight) || 50);
    const minCropWidth = Math.min(configuredMinWidth, maxCropWidth);
    const minCropHeight = Math.min(configuredMinHeight, maxCropHeight);
    const width = minCropWidth;
    const height = minCropHeight;
    const cropRect = new fabric.Rect({
      left,
      top,
      width,
      height,
      fill: "rgba(0,0,0,0.12)",
      stroke: "#00aaff",
      strokeDashArray: [6, 4],
      strokeWidth: 1,
      strokeUniform: true,
      selectable: true,
      hasRotatingPoint: !!(this.options.crop && this.options.crop.allowRotationOfCropRect),
      lockRotation: !(this.options.crop && this.options.crop.allowRotationOfCropRect),
      cornerSize: 8,
      objectCaching: false,
      originX: "left",
      originY: "top",
      lockScalingFlip: true
    });
    this.canvas.add(cropRect);
    cropRect.isCropRect = true;
    this.canvas.bringToFront(cropRect);
    this.canvas.setActiveObject(cropRect);
    this._cropRect = cropRect;
    this._cropPrevEvented = [];
    const shouldHideMasks = !!(this.options.crop && this.options.crop.hideMasksDuringCrop);
    this.canvas.getObjects().forEach((object) => {
      if (object !== cropRect) {
        this._cropPrevEvented.push({ object, evented: object.evented, selectable: object.selectable, visible: object.visible });
        try {
          const updates = {
            evented: false,
            selectable: false
          };
          if (shouldHideMasks && (object.maskId || object.maskLabel)) updates.visible = false;
          object.set(updates);
        } catch (error) {
          void error;
        }
      }
    });
    const handleCropRectModified = () => {
      try {
        const cropWidth = Math.max(1, Number(cropRect.width) || 1);
        const cropHeight = Math.max(1, Number(cropRect.height) || 1);
        const nextScaleX = Math.min(maxCropWidth / cropWidth, Math.max(minCropWidth / cropWidth, Number(cropRect.scaleX) || 1));
        const nextScaleY = Math.min(maxCropHeight / cropHeight, Math.max(minCropHeight / cropHeight, Number(cropRect.scaleY) || 1));
        cropRect.set({ scaleX: nextScaleX, scaleY: nextScaleY });
        cropRect.setCoords();
        const cropBounds = cropRect.getBoundingRect(true, true);
        const imageLeft = Number(imageBounds.left) || 0;
        const imageTop = Number(imageBounds.top) || 0;
        const imageRight = imageLeft + (Number(imageBounds.width) || 0);
        const imageBottom = imageTop + (Number(imageBounds.height) || 0);
        let deltaX = 0;
        let deltaY = 0;
        if (cropBounds.left < imageLeft) {
          deltaX = imageLeft - cropBounds.left;
        } else if (cropBounds.left + cropBounds.width > imageRight) {
          deltaX = imageRight - (cropBounds.left + cropBounds.width);
        }
        if (cropBounds.top < imageTop) {
          deltaY = imageTop - cropBounds.top;
        } else if (cropBounds.top + cropBounds.height > imageBottom) {
          deltaY = imageBottom - (cropBounds.top + cropBounds.height);
        }
        if (deltaX || deltaY) {
          cropRect.set({
            left: (Number(cropRect.left) || 0) + deltaX,
            top: (Number(cropRect.top) || 0) + deltaY
          });
          cropRect.setCoords();
        }
        this.canvas.requestRenderAll();
      } catch (error) {
        void error;
      }
    };
    cropRect.on("modified", handleCropRectModified);
    cropRect.on("moving", handleCropRectModified);
    cropRect.on("scaling", handleCropRectModified);
    this._cropHandlers.push({
      target: cropRect,
      handlers: [
        { eventName: "modified", handler: handleCropRectModified },
        { eventName: "moving", handler: handleCropRectModified },
        { eventName: "scaling", handler: handleCropRectModified }
      ]
    });
    this._updateUI();
    this.canvas.renderAll();
  }
  /**
   * Cancels crop mode and removes the temporary crop rectangle.
   *
   * @returns {void}
   * @public
   */
  cancelCrop() {
    if (!this.canvas || !this._cropMode) return;
    this._removeCropRect();
    this._restoreCropObjectState();
    this._cropMode = false;
    this.canvas.selection = !!this._prevSelectionSetting;
    this._prevSelectionSetting = void 0;
    this.canvas.discardActiveObject();
    this._updateUI();
    this.canvas.renderAll();
  }
  /**
   * Applies the current crop rectangle to the base image.
   *
   * Masks are removed by default. When `crop.preserveMasksAfterCrop` is true, masks that intersect the crop
   * region are shifted into the cropped coordinate space and remain editable. The operation is recorded as a
   * single undoable history transition.
   *
   * @async
   * @returns {Promise<void>} Resolves after the cropped image has been loaded and history is updated.
   * @public
   */
  async applyCrop() {
    if (!this.canvas || !this._cropMode || !this._cropRect) return;
    this._assertIdleForOperation("applyCrop");
    this._cropRect.setCoords();
    const rectBounds = this._cropRect.getBoundingRect(true, true);
    const cropRegion = this._getClampedCanvasRegion(rectBounds, { includePartialPixels: false });
    const shouldPreserveMasks = !!(this.options.crop && this.options.crop.preserveMasksAfterCrop);
    this._restoreCropObjectState();
    let beforeJson;
    try {
      beforeJson = this._serializeCanvasState();
    } catch (error) {
      this._reportWarning("applyCrop: could not serialize before state", error);
      beforeJson = null;
    }
    const preservedMasks = [];
    try {
      const masks = this.canvas.getObjects().filter((object) => object.maskId);
      if (masks && masks.length) {
        masks.forEach((mask) => {
          mask.setCoords();
          const maskBounds = mask.getBoundingRect(true, true);
          const intersectsCrop = maskBounds.left < cropRegion.sourceX + cropRegion.sourceWidth && maskBounds.left + maskBounds.width > cropRegion.sourceX && maskBounds.top < cropRegion.sourceY + cropRegion.sourceHeight && maskBounds.top + maskBounds.height > cropRegion.sourceY;
          this._removeLabelForMask(mask);
          this.canvas.remove(mask);
          if (shouldPreserveMasks && intersectsCrop) {
            this._translateObjectByCanvasOffset(mask, -cropRegion.sourceX, -cropRegion.sourceY);
            mask.set({ visible: true });
            preservedMasks.push(mask);
          }
        });
        this._clearMaskPlacementMemory();
        this.canvas.discardActiveObject();
        this.canvas.renderAll();
      }
    } catch (error) {
      await this._restoreStateAfterCropFailure(beforeJson, "applyCrop: failed to prepare masks", error);
      return;
    }
    this._removeCropRect();
    this._cropMode = false;
    this.canvas.selection = !!this._prevSelectionSetting;
    this._prevSelectionSetting = void 0;
    let croppedBase64;
    try {
      croppedBase64 = await this._exportCanvasRegionToDataURL({
        ...cropRegion,
        multiplier: 1,
        quality: this._normalizeQuality(this.options.downsampleQuality),
        format: "jpeg"
      });
    } catch (error) {
      await this._restoreStateAfterCropFailure(beforeJson, "applyCrop: failed to create cropped image", error);
      return;
    }
    try {
      await this.loadImage(croppedBase64, { resetMaskCounter: false });
      if (preservedMasks.length) {
        preservedMasks.forEach((mask) => {
          this._rebindMaskEvents(mask);
          this.canvas.add(mask);
          this.canvas.bringToFront(mask);
        });
        this._lastMask = preservedMasks[preservedMasks.length - 1];
        this.maskCounter = preservedMasks.reduce((max, mask) => Math.max(max, mask.maskId || 0), this.maskCounter);
        this._updateMaskList();
        this.canvas.renderAll();
      }
    } catch (error) {
      await this._restoreStateAfterCropFailure(beforeJson, "applyCrop: loadImage(croppedBase64) failed", error);
      return;
    }
    let afterJson;
    try {
      afterJson = preservedMasks.length ? this._serializeCanvasState() : this._lastSnapshot;
    } catch (error) {
      this._reportWarning("applyCrop: failed to serialize after state", error);
      afterJson = null;
    }
    try {
      this._pushStateTransition(beforeJson, afterJson);
    } catch (error) {
      this._reportWarning("applyCrop: failed to push history command", error);
    }
    this._updateUI();
    this.canvas.renderAll();
  }
  /* ---------- Misc / UI ---------- */
  /**
   * Updates the scale input field in the UI to reflect the current scale.
   * Sets the value (as percentage) if the element is present.
   * @private
   */
  _updateInputs() {
    const scaleInputElement = this._getElement("scaleRate");
    if (scaleInputElement) scaleInputElement.value = Math.round(this.currentScale * 100);
  }
  /**
   * Updates the enabled/disabled state of various UI controls (buttons)
   * based on the current application state (image/mask presence, animation, etc).
   * @private
   */
  _updateUI() {
    if (!this.canvas) return;
    const hasImage = !!this.originalImage;
    const masks = hasImage ? this.canvas.getObjects().filter((object) => object.maskId) : [];
    const hasMasks = masks.length > 0;
    const activeObject = this.canvas.getActiveObject();
    const hasSelectedMask = activeObject && activeObject.maskId;
    const isDefaultTransform = this.currentScale === 1 && this.currentRotation === 0;
    const canUndo = this.historyManager?.canUndo();
    const canRedo = this.historyManager?.canRedo();
    const isInCropMode = !!this._cropMode;
    const isBusy = this.isBusy();
    if (isInCropMode) {
      for (const key of Object.keys(this.elements || {})) {
        const element = this._getElement(key);
        if (!element) continue;
        if (key === "applyCropBtn" || key === "cancelCropBtn") {
          this._setDisabled(key, false);
        } else {
          this._setDisabled(key, true);
        }
      }
      return;
    }
    this._setDisabled("zoomInBtn", !hasImage || isBusy || this.currentScale >= this.options.maxScale);
    this._setDisabled("zoomOutBtn", !hasImage || isBusy || this.currentScale <= this.options.minScale);
    this._setDisabled("rotateLeftBtn", !hasImage || isBusy);
    this._setDisabled("rotateRightBtn", !hasImage || isBusy);
    this._setDisabled("addMaskBtn", !hasImage || isBusy);
    this._setDisabled("removeMaskBtn", !hasSelectedMask || isBusy);
    this._setDisabled("removeAllMasksBtn", !hasMasks || isBusy);
    this._setDisabled("mergeBtn", !hasImage || !hasMasks || isBusy);
    this._setDisabled("downloadBtn", !hasImage || isBusy);
    this._setDisabled("resetBtn", !hasImage || isDefaultTransform || isBusy);
    this._setDisabled("undoBtn", !hasImage || isBusy || !canUndo);
    this._setDisabled("redoBtn", !hasImage || isBusy || !canRedo);
    this._setDisabled("cropBtn", !hasImage || isBusy);
    this._setDisabled("applyCropBtn", true);
    this._setDisabled("cancelCropBtn", true);
    this._setDisabled("scaleRate", !hasImage || isBusy);
    this._setDisabled("rotationLeftInput", !hasImage || isBusy);
    this._setDisabled("rotationRightInput", !hasImage || isBusy);
    this._setDisabled("maskList", !hasImage || isBusy);
    this._setDisabled("imageInput", isBusy);
    this._setDisabled("uploadArea", isBusy);
  }
  /**
   * Enables or disables a specific UI element (typically a button) by its key.
   * 
   * @param {string} key - Key of the element in this.elements (e.g. 'zoomInBtn').
   * @param {boolean} disabled - If true, disables the element; otherwise enables.
   * @private
   */
  _setDisabled(key, disabled) {
    const element = this._getElement(key);
    if (!element) return;
    if ("disabled" in element) {
      element.disabled = !!disabled;
      return;
    }
    if (!this._elementOriginalPointerEvents) this._elementOriginalPointerEvents = /* @__PURE__ */ new Map();
    if (!this._elementOriginalPointerEvents.has(key)) {
      this._elementOriginalPointerEvents.set(key, element.style.pointerEvents || "");
    }
    if (disabled) {
      element.setAttribute("aria-disabled", "true");
      element.style.pointerEvents = "none";
    } else {
      element.removeAttribute("aria-disabled");
      element.style.pointerEvents = this._elementOriginalPointerEvents.get(key) ?? "";
    }
  }
  _isElementDisabled(element) {
    if (!element) return false;
    if ("disabled" in element) return !!element.disabled;
    return element.getAttribute("aria-disabled") === "true";
  }
  /**
   * Updates placeholder and canvas container visibility based on whether an image is loaded.
   * @private
   */
  _updatePlaceholderStatus() {
    if (!this.options.showPlaceholder) return;
    this._setPlaceholderVisible(!this.originalImage);
  }
  /**
   * Shows or hides the placeholder and canvas container.
   *
   * @param {boolean} show - If true, displays the placeholder; otherwise displays the canvas container.
   * @private
   */
  _setPlaceholderVisible(show) {
    if (this.placeholderElement) this._setElementVisible(this.placeholderElement, show);
    const canvasVisibilityElement = this._getCanvasVisibilityElement();
    if (canvasVisibilityElement && canvasVisibilityElement !== this.placeholderElement) {
      this._setElementVisible(canvasVisibilityElement, !show);
    }
  }
  _getCanvasVisibilityElement() {
    const wrapperElement = this.canvas && this.canvas.wrapperEl ? this.canvas.wrapperEl : null;
    if (this.containerElement && this.placeholderElement && (this.containerElement === this.placeholderElement || this.containerElement.contains(this.placeholderElement))) {
      return wrapperElement || this.canvasElement;
    }
    return this.containerElement || wrapperElement || this.canvasElement;
  }
  /**
   * Updates element visibility.
   *
   * @param {HTMLElement} element - Element whose visibility should be updated.
   * @param {boolean} isVisible - If true, removes the hidden state.
   * @returns {void}
   * @private
   */
  _setElementVisible(element, isVisible) {
    if (!element) return;
    this._rememberElementVisibility(element);
    element.hidden = !isVisible;
    element.setAttribute("aria-hidden", isVisible ? "false" : "true");
    if (element.classList) {
      element.classList.toggle("d-none", !isVisible);
    }
  }
  _rememberElementVisibility(element) {
    if (!element || this._visibilityStateByElement.has(element)) return;
    this._visibilityStateByElement.set(element, this._captureElementVisibility(element));
  }
  _captureElementVisibility(element) {
    if (!element) return null;
    return {
      hidden: element.hidden,
      ariaHidden: element.getAttribute("aria-hidden"),
      className: element.className
    };
  }
  _restoreElementVisibility(element, state) {
    if (!element || !state) return;
    element.hidden = !!state.hidden;
    if (state.ariaHidden === null) {
      element.removeAttribute("aria-hidden");
    } else {
      element.setAttribute("aria-hidden", state.ariaHidden);
    }
    element.className = state.className || "";
  }
  /**
   * Cleans up and disposes of the canvas and related references.
   * Call this method to free memory and remove canvas listeners when the editor is no longer needed.
   * @public
   */
  dispose() {
    this._disposed = true;
    this._rejectActiveAnimations(new Error("Editor disposed during animation"));
    if (this.animationQueue) {
      this.animationQueue.cancelAll(new Error("Editor disposed"));
    }
    this._isLoading = false;
    this._activeOperationName = null;
    this._activeOperationToken = null;
    try {
      for (const [key, handlers] of Object.entries(this._handlersByElementKey || {})) {
        const element = this._getElement(key);
        if (!element) continue;
        handlers.forEach((handlerRecord) => {
          try {
            element.removeEventListener(handlerRecord.eventName, handlerRecord.handler);
          } catch (error) {
            void error;
          }
        });
      }
    } catch (error) {
      void error;
    }
    if (this._cropRect) {
      try {
        this.canvas.remove(this._cropRect);
      } catch (error) {
        void error;
      }
      this._cropRect = null;
    }
    if (this.containerElement && this._containerOriginalOverflow) {
      try {
        this._restoreContainerOverflowState();
      } catch (error) {
        void error;
      }
    }
    if (this._visibilityStateByElement) {
      try {
        [this.placeholderElement, this._getCanvasVisibilityElement()].forEach((element) => {
          const state = element ? this._visibilityStateByElement.get(element) : null;
          if (state) this._restoreElementVisibility(element, state);
        });
      } catch (error) {
        void error;
      }
    }
    if (this.canvasElement && this._canvasElementOriginalStyle) {
      try {
        this.canvasElement.style.display = this._canvasElementOriginalStyle.display;
        this.canvasElement.style.width = this._canvasElementOriginalStyle.width;
        this.canvasElement.style.height = this._canvasElementOriginalStyle.height;
      } catch (error) {
        void error;
      }
    }
    if (this.canvas) {
      try {
        this.canvas.dispose();
      } catch (error) {
        void error;
      }
      this.canvas = null;
      this.canvasElement = null;
      this.isImageLoadedToCanvas = false;
    }
    this._handlersByElementKey = {};
    this._elementCache = {};
    this._elementOriginalPointerEvents = /* @__PURE__ */ new Map();
    this._clearMaskPlacementMemory();
    this.originalImage = null;
    this.baseImageScale = 1;
    this.currentScale = 1;
    this.currentRotation = 0;
    this.isAnimating = false;
    this._isLoading = false;
    this._cropMode = false;
    this._cropRect = null;
    this._cropHandlers = [];
    this._cropPrevEvented = null;
    this._prevSelectionSetting = void 0;
    this._lastContainerViewportSize = null;
    this._initialized = false;
  }
};
var AnimationQueue = class {
  /**
   * Creates an empty animation queue.
   */
  constructor() {
    this.animationTasks = [];
    this.isRunning = false;
    this.currentTask = null;
    this._generation = 0;
  }
  /**
   * Adds an animation function to the queue.
   *
   * @param {AnimationTaskCallback} animationFn - Function that returns a value, Promise, or awaitable animation result.
   * @returns {Promise<unknown>} Resolves or rejects with the queued animation result.
   */
  async add(animationFn) {
    return new Promise((resolve, reject) => {
      this.animationTasks.push({ animationFn, resolve, reject, isSettled: false });
      if (!this.isRunning) {
        this._drainQueue();
      }
    });
  }
  isBusy() {
    return this.isRunning || this.animationTasks.length > 0;
  }
  cancelAll(reason = new Error("Animation queue cancelled")) {
    this._generation += 1;
    const cancellationError = reason instanceof Error ? reason : new Error(String(reason));
    const tasks = [
      ...this.currentTask ? [this.currentTask] : [],
      ...this.animationTasks.splice(0)
    ];
    tasks.forEach((task) => {
      if (!task || task.isSettled) return;
      task.isSettled = true;
      task.reject(cancellationError);
    });
    this.isRunning = false;
    this.currentTask = null;
  }
  /**
   * Runs queued animation tasks sequentially until the queue is empty.
   *
   * @private
   * @returns {Promise<void>}
   */
  async _drainQueue() {
    if (this.isRunning) return;
    const generation = this._generation;
    this.isRunning = true;
    try {
      while (this.animationTasks.length > 0 && generation === this._generation) {
        const task = this.animationTasks.shift();
        this.currentTask = task;
        try {
          const result = await task.animationFn();
          if (generation === this._generation && !task.isSettled) {
            task.isSettled = true;
            task.resolve(result);
          }
        } catch (error) {
          if (generation === this._generation && !task.isSettled) {
            task.isSettled = true;
            task.reject(error);
          }
        } finally {
          if (generation === this._generation && this.currentTask === task) this.currentTask = null;
        }
      }
    } finally {
      if (generation === this._generation) {
        this.isRunning = false;
        this.currentTask = null;
      }
    }
  }
};
var Command = class {
  /**
   * @param {HistoryTaskCallback} execute - Function that performs the action.
   * @param {HistoryTaskCallback} undo - Function that reverts the action.
   */
  constructor(execute, undo) {
    this.execute = execute;
    this.undo = undo;
  }
};
var HistoryManager = class {
  /**
   * @param {number} [maxSize=50] - Maximum number of commands to keep in history.
   */
  constructor(maxSize = 50) {
    this.history = [];
    this.currentIndex = -1;
    this.maxSize = maxSize;
    this.pending = Promise.resolve();
  }
  /**
   * Queues a history task after the previously queued undo/redo task completes.
   *
   * @param {HistoryTaskCallback} task - Task to run after earlier history work settles.
   * @returns {Promise<void>} Resolves or rejects with the queued task result.
   * @private
   */
  enqueue(task) {
    const nextTask = this.pending.then(() => Promise.resolve().then(task));
    this.pending = nextTask.catch(() => void 0);
    return nextTask;
  }
  /**
   * Executes a new command and pushes it onto the history stack.
   * Truncates any "future" history when branching.
   *
   * @param {Command} command  The command to execute.
   * @returns {void}
   */
  execute(command) {
    const result = command.execute();
    if (result && typeof result.then === "function") {
      return this.enqueue(() => Promise.resolve(result).then(() => {
        this.push(command);
      }));
    }
    this.push(command);
    return result;
  }
  /**
   * Pushes an already-applied command onto the history stack.
   * Truncates any "future" history when branching.
   *
   * @param {Command} command  The command to push.
   * @returns {void}
   */
  push(command) {
    if (this.currentIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.currentIndex + 1);
    }
    this.history.push(command);
    if (this.history.length > this.maxSize) {
      this.history.shift();
    }
    this.currentIndex = this.history.length - 1;
  }
  /**
   * Checks whether an undo operation is possible.
   *
   * @returns {boolean}  True if undo can be performed.
   */
  canUndo() {
    return this.currentIndex >= 0;
  }
  /**
   * Checks whether a redo operation is possible.
   *
   * @returns {boolean}  True if redo can be performed.
   */
  canRedo() {
    return this.currentIndex < this.history.length - 1;
  }
  /**
   * Undoes the last executed command if possible.
   *
   * @returns {Promise<void>} Resolves after the undo task completes.
   */
  undo() {
    return this.enqueue(async () => {
      if (this.currentIndex >= 0) {
        const index = this.currentIndex;
        await this.history[index].undo();
        this.currentIndex = index - 1;
      }
    });
  }
  /**
   * Redoes the next command in history if possible.
   *
   * @returns {Promise<void>} Resolves after the redo task completes.
   */
  redo() {
    return this.enqueue(async () => {
      if (this.currentIndex < this.history.length - 1) {
        const index = this.currentIndex + 1;
        await this.history[index].execute();
        this.currentIndex = index;
      }
    });
  }
};
var image_editor_default = ImageEditor;

// src/esm.js
var fabricInstance = fabricModule && (fabricModule.fabric || fabricModule.default || fabricModule);
setFabric(fabricInstance);
var esm_default = image_editor_default;
export {
  image_editor_default as ImageEditor,
  esm_default as default
};
//# sourceMappingURL=image-editor.esm.js.map
