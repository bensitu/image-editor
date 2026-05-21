(() => {
  // src/image-editor.js
  /**
   * @file image-editor.js
   * @module image-editor
   * @version 1.2.2
   * @author Ben Situ
   * @license MIT
   * @description Lightweight canvas-based image editor with masking/transform/export support.
   */
  var fabric = null;
  function getGlobalScope() {
    if (typeof globalThis !== "undefined")
      return globalThis;
    if (typeof self !== "undefined")
      return self;
    if (typeof window !== "undefined")
      return window;
    return null;
  }
  function getGlobalFabric() {
    const scope2 = getGlobalScope();
    return scope2 && scope2.fabric ? scope2.fabric : null;
  }
  function setFabric(fabricInstance) {
    fabric = fabricInstance || getGlobalFabric();
    return fabric;
  }
  function ensureFabric() {
    if (!fabric)
      setFabric();
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
      this.elements = {};
      this.isImageLoadedToCanvas = false;
      this.maxHistorySize = 50;
      this._handlersByElementKey = {};
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
      this._containerOriginalOverflow = void 0;
      this.onImageLoaded = typeof options.onImageLoaded === "function" ? options.onImageLoaded : null;
      this.animQueue = new AnimationQueue();
      this.historyManager = new HistoryManager(this.maxHistorySize);
    }
    /**
     * @deprecated Use canvasElement instead.
     */
    get canvasEl() {
      return this.canvasElement;
    }
    set canvasEl(value) {
      this.canvasElement = value;
    }
    /**
     * @deprecated Use containerElement instead.
     */
    get containerEl() {
      return this.containerElement;
    }
    set containerEl(value) {
      this.containerElement = value;
    }
    /**
     * @deprecated Use placeholderElement instead.
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
     *   Supported keys include: canvas, canvasContainer, imgPlaceholder, scaleRate, rotationLeftInput, rotationRightInput,
     *   rotateLeftBtn, rotateRightBtn, addMaskBtn, removeMaskBtn, removeAllMasksBtn, mergeBtn, downloadBtn, maskList,
     *   zoomInBtn, zoomOutBtn, resetBtn, imageInput. Unknown keys are ignored.
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
      if (!this._fabricLoaded)
        return;
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
      if (typeof handler !== "function")
        return;
      try {
        handler(error, message);
      } catch {
      }
    }
    _reportWarning(message, error = null) {
      const handler = this.options && this.options.onWarning;
      if (typeof handler !== "function")
        return;
      try {
        handler(error, message);
      } catch {
      }
    }
    /**
     * Canvas setup helpers
     * @private
     */
    _initCanvas() {
      const canvasElement = document.getElementById(this.elements.canvas);
      if (!canvasElement)
        throw new Error("Canvas is not found: " + this.elements.canvas);
      this.canvasElement = canvasElement;
      if (this.elements.canvasContainer) {
        const containerElement = document.getElementById(this.elements.canvasContainer);
        this.containerElement = containerElement || canvasElement.parentElement;
      } else {
        this.containerElement = canvasElement.parentElement;
      }
      this.placeholderElement = document.getElementById(this.elements.imgPlaceholder) || null;
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
        if (event.target && event.target.maskId)
          this._syncMaskLabel(event.target);
      });
      this.canvas.on("object:scaling", (event) => {
        if (event.target && event.target.maskId)
          this._syncMaskLabel(event.target);
      });
      this.canvas.on("object:rotating", (event) => {
        if (event.target && event.target.maskId)
          this._syncMaskLabel(event.target);
      });
      this.canvas.on("object:modified", (event) => this._handleObjectModified(event.target));
      this.canvasElement.style.display = "block";
    }
    _handleObjectModified(target) {
      const masks = this._getModifiedMasks(target);
      if (!masks.length)
        return;
      masks.forEach((mask) => {
        if (typeof mask.setCoords === "function")
          mask.setCoords();
        this._syncMaskLabel(mask);
        this._expandCanvasToFitObject(mask);
      });
      this.saveState();
    }
    _getModifiedMasks(target) {
      if (!target)
        return [];
      if (target.maskId)
        return [target];
      const objects = typeof target.getObjects === "function" ? target.getObjects() : [];
      return Array.isArray(objects) ? objects.filter((object) => object && object.maskId) : [];
    }
    _syncContainerOverflow() {
      if (!this.containerElement || !this.containerElement.style)
        return;
      if (this._containerOriginalOverflow === void 0) {
        this._containerOriginalOverflow = this.containerElement.style.overflow || "";
      }
      if (this.options.coverImageToCanvas) {
        const shouldResetScroll = !this.isImageLoadedToCanvas;
        this.containerElement.style.overflow = "scroll";
        if (shouldResetScroll) {
          this.containerElement.scrollLeft = 0;
          this.containerElement.scrollTop = 0;
        }
      } else if (this.options.fitImageToCanvas) {
        this.containerElement.style.overflow = "auto";
        this.containerElement.scrollLeft = 0;
        this.containerElement.scrollTop = 0;
      } else {
        this.containerElement.style.overflow = this._containerOriginalOverflow;
      }
    }
    /** 
     * DOM / UI bindings
     * @private
     */
    _bindEvents() {
      this._bindIfExists("uploadArea", "click", () => {
        const uploadAreaElement = document.getElementById(this.elements.uploadArea);
        if (this._isElementDisabled(uploadAreaElement))
          return;
        document.getElementById(this.elements.imageInput)?.click();
      });
      this._bindIfExists("imageInput", "change", (event) => {
        const file = event.target.files && event.target.files[0];
        if (file)
          this._loadImageFile(file);
      });
      this._bindIfExists("zoomInBtn", "click", () => this.scaleImage(this.currentScale + this.options.scaleStep));
      this._bindIfExists("zoomOutBtn", "click", () => this.scaleImage(this.currentScale - this.options.scaleStep));
      this._bindIfExists("resetBtn", "click", () => {
        this.resetImageTransform();
      });
      this._bindIfExists("addMaskBtn", "click", () => this.createMask());
      this._bindIfExists("removeMaskBtn", "click", () => this.removeSelectedMask());
      this._bindIfExists("removeAllMasksBtn", "click", () => this.removeAllMasks());
      this._bindIfExists("mergeBtn", "click", () => this.mergeMasks());
      this._bindIfExists("downloadBtn", "click", () => this.downloadImage());
      this._bindIfExists("undoBtn", "click", () => this.undo());
      this._bindIfExists("redoBtn", "click", () => this.redo());
      this._bindIfExists("rotateLeftBtn", "click", () => {
        const rotationInputElement = document.getElementById(this.elements.rotationLeftInput);
        let step = this.options.rotationStep;
        if (rotationInputElement) {
          const parsedStep = parseFloat(rotationInputElement.value);
          if (!isNaN(parsedStep))
            step = parsedStep;
        }
        this.rotateImage(this.currentRotation - step);
      });
      this._bindIfExists("rotateRightBtn", "click", () => {
        const rotationInputElement = document.getElementById(this.elements.rotationRightInput);
        let step = this.options.rotationStep;
        if (rotationInputElement) {
          const parsedStep = parseFloat(rotationInputElement.value);
          if (!isNaN(parsedStep))
            step = parsedStep;
        }
        this.rotateImage(this.currentRotation + step);
      });
      this._bindIfExists("cropBtn", "click", () => this.enterCropMode());
      this._bindIfExists("applyCropBtn", "click", () => {
        this.applyCrop().catch((error) => this._reportError("applyCrop failed", error));
      });
      this._bindIfExists("cancelCropBtn", "click", () => this.cancelCrop());
    }
    /** 
     * Event binding element check
     * 
     * @param {*} eventName
     * @param {*} handler 
     * @param {*} key 
     * @private
     */
    _bindIfExists(key, eventName, handler) {
      const element = document.getElementById(this.elements[key]);
      if (element) {
        element.addEventListener(eventName, handler);
        this._handlersByElementKey = this._handlersByElementKey || {};
        if (!this._handlersByElementKey[key])
          this._handlersByElementKey[key] = [];
        this._handlersByElementKey[key].push({ eventName, handler });
      }
    }
    /** 
     * Image loading helpers
     * 
     * @param {File} file 
     * @private
     */
    _loadImageFile(file) {
      if (!file || !file.type.startsWith("image/"))
        return;
      const reader = new FileReader();
      reader.onload = (event) => this.loadImage(event.target.result);
      reader.onerror = (event) => {
        this._reportError("Image file could not be read", event);
      };
      reader.readAsDataURL(file);
    }
    /**
    * Load a base64 encoded image string into fabric.
    * @async
     * @param {String} imageBase64
     */
    async loadImage(imageBase64) {
      if (!this._fabricLoaded)
        return;
      if (!this.canvas)
        return;
      if (!imageBase64 || typeof imageBase64 !== "string" || !imageBase64.startsWith("data:image/"))
        return;
      this._setPlaceholderVisible(false);
      this._syncContainerOverflow();
      const imageElement = await this._createImageElement(imageBase64);
      let loadSource = imageBase64;
      if (this.options.downsampleOnLoad) {
        const shouldResize = imageElement.naturalWidth > this.options.downsampleMaxWidth || imageElement.naturalHeight > this.options.downsampleMaxHeight;
        if (shouldResize) {
          const ratio = Math.min(
            this.options.downsampleMaxWidth / imageElement.naturalWidth,
            this.options.downsampleMaxHeight / imageElement.naturalHeight
          );
          const targetWidth = Math.round(imageElement.naturalWidth * ratio);
          const targetHeight = Math.round(imageElement.naturalHeight * ratio);
          loadSource = this._resampleImageToDataURL(imageElement, targetWidth, targetHeight, this.options.downsampleQuality);
        }
      }
      return new Promise((resolve, reject) => {
        fabric.Image.fromURL(loadSource, (fabricImage) => {
          try {
            if (!fabricImage)
              throw new Error("Image could not be loaded");
            this.canvas.discardActiveObject();
            this._hideAllMaskLabels();
            this.canvas.clear();
            this.canvas.setBackgroundColor(this.options.backgroundColor, this.canvas.renderAll.bind(this.canvas));
            fabricImage.set({ originX: "left", originY: "top", selectable: false, evented: false });
            const imageWidth = fabricImage.width;
            const imageHeight = fabricImage.height;
            const viewport = this._getContainerViewportSize();
            const minWidth = viewport.width;
            const minHeight = viewport.height;
            if (this.options.fitImageToCanvas) {
              const canvasWidth = Math.max(1, Math.min(this.options.canvasWidth, minWidth) - 1);
              const canvasHeight = Math.max(1, Math.min(this.options.canvasHeight, minHeight) - 1);
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
            this._lastMask = null;
            this._lastMaskInitialLeft = null;
            this._lastMaskInitialTop = null;
            this._lastMaskInitialWidth = null;
            this.maskCounter = 0;
            this.currentScale = 1;
            this.currentRotation = 0;
            this._updateInputs();
            this._updateMaskList();
            this.isImageLoadedToCanvas = true;
            this._updateUI();
            this.canvas.renderAll();
            try {
              this._lastSnapshot = this._serializeCanvasState();
            } catch (error) {
              this._reportWarning("loadImage: failed to capture initial canvas snapshot", error);
            }
            if (typeof this.onImageLoaded === "function") {
              this.onImageLoaded();
            }
            resolve();
          } catch (error) {
            reject(error);
          }
        }, { crossOrigin: "anonymous" });
      });
    }
    /**
     * Checks whether there is a loaded image on the current canvas.
     * @returns {boolean} true if loaded, false if not
     */
    isImageLoaded() {
      const fabricInstance = ensureFabric();
      return !!(this.originalImage && fabricInstance && this.originalImage instanceof fabricInstance.Image && this.originalImage.width > 0 && this.originalImage.height > 0);
    }
    /**
     * Creates an HTMLImageElement from a given data URL.
     * 
     * @param {string} dataUrl - A data URL representing the image (e.g., "data:image/png;base64,...").
     * @returns {Promise<HTMLImageElement>} A promise that resolves to the created image element when loaded, or rejects on error.
     * @private
     */
    _createImageElement(dataUrl) {
      return new Promise((resolve, reject) => {
        const imageElement = new Image();
        imageElement.onload = () => {
          imageElement.onload = null;
          imageElement.onerror = null;
          resolve(imageElement);
        };
        imageElement.onerror = (error) => {
          imageElement.onload = null;
          imageElement.onerror = null;
          reject(error);
        };
        imageElement.src = dataUrl;
      });
    }
    /**
     * Resamples the given image element to a new width and height and returns the result as a JPEG data URL.
     * 
     * @param {HTMLImageElement} imageElement - The image element to resample.
     * @param {number} targetWidth - Target width (in pixels) for the resampled image.
     * @param {number} targetHeight - Target height (in pixels) for the resampled image.
     * @param {number} [quality=0.92] - JPEG image quality between 0 and 1 (optional, default 0.92).
     * @returns {string} A data URL representing the resampled image as JPEG.
     * @private
     */
    _resampleImageToDataURL(imageElement, targetWidth, targetHeight, quality = 0.92) {
      const offscreenCanvas = document.createElement("canvas");
      offscreenCanvas.width = targetWidth;
      offscreenCanvas.height = targetHeight;
      const context = offscreenCanvas.getContext("2d");
      context.drawImage(imageElement, 0, 0, imageElement.naturalWidth, imageElement.naturalHeight, 0, 0, targetWidth, targetHeight);
      return offscreenCanvas.toDataURL("image/jpeg", quality);
    }
    /** 
     * Sets canvas size to integer width and height values to prevent scrollbars due to sub-pixel rendering.
     * Also updates the corresponding style attributes.
     * 
     * @param {number} w - Canvas width (in pixels).
     * @param {number} h - Canvas height (in pixels).
     * @private
     */
    _setCanvasSizeInt(w, h) {
      const iw = Math.max(1, Math.round(Number(w) || 1));
      const ih = Math.max(1, Math.round(Number(h) || 1));
      this.canvas.setWidth(iw);
      this.canvas.setHeight(ih);
      if (typeof this.canvas.calcOffset === "function")
        this.canvas.calcOffset();
      if (this.canvasElement) {
        this.canvasElement.style.width = iw + "px";
        this.canvasElement.style.height = ih + "px";
        this.canvasElement.style.maxWidth = "none";
      }
    }
    _ceilCanvasDimension(value) {
      const numericValue = Number(value) || 0;
      const roundedValue = Math.round(numericValue);
      if (Math.abs(numericValue - roundedValue) < 0.01)
        return roundedValue;
      return Math.ceil(numericValue);
    }
    _getContainerViewportSize() {
      if (!this.containerElement) {
        return {
          width: Math.max(1, Math.floor(this.options.canvasWidth || 1)),
          height: Math.max(1, Math.floor(this.options.canvasHeight || 1))
        };
      }
      if (this._hasFixedContainerScrollbars()) {
        return {
          width: Math.max(1, Math.floor(this.containerElement.clientWidth || this.options.canvasWidth || 1)),
          height: Math.max(1, Math.floor(this.containerElement.clientHeight || this.options.canvasHeight || 1))
        };
      }
      const previousOverflow = this.containerElement.style.overflow;
      this.containerElement.style.overflow = "hidden";
      const width = Math.max(1, Math.floor(this.containerElement.clientWidth || this.options.canvasWidth || 1));
      const height = Math.max(1, Math.floor(this.containerElement.clientHeight || this.options.canvasHeight || 1));
      this.containerElement.style.overflow = previousOverflow;
      return { width, height };
    }
    _hasFixedContainerScrollbars() {
      if (!this.containerElement)
        return false;
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
      return [inlineOverflow, inlineOverflowX, inlineOverflowY, computedOverflow, computedOverflowX, computedOverflowY].some((value) => value === "scroll");
    }
    _getScrollbarSize() {
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
      return { width, height };
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
      let effectiveWidth = viewport.width;
      let effectiveHeight = viewport.height;
      for (let i = 0; i < 4; i += 1) {
        effectiveWidth = Math.max(1, viewport.width - (hasVertical ? scrollbar.width : 0));
        effectiveHeight = Math.max(1, viewport.height - (hasHorizontal ? scrollbar.height : 0));
        const nextHasVertical = contentHeight > effectiveHeight + 0.5;
        const nextHasHorizontal = contentWidth > effectiveWidth + 0.5;
        if (nextHasVertical === hasVertical && nextHasHorizontal === hasHorizontal)
          break;
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
      let effectiveWidth = viewport.width;
      let effectiveHeight = viewport.height;
      for (let i = 0; i < 4; i += 1) {
        effectiveWidth = Math.max(1, viewport.width - (hasVertical ? scrollbar.width : 0));
        effectiveHeight = Math.max(1, viewport.height - (hasHorizontal ? scrollbar.height : 0));
        scale = Math.min(1, Math.max(effectiveWidth / imageWidth, effectiveHeight / imageHeight));
        contentWidth = imageWidth * scale;
        contentHeight = imageHeight * scale;
        const nextHasVertical = contentHeight > effectiveHeight + 0.5;
        const nextHasHorizontal = contentWidth > effectiveWidth + 0.5;
        if (nextHasVertical === hasVertical && nextHasHorizontal === hasHorizontal)
          break;
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
      if (Number.isFinite(opacity))
        style.opacity = opacity;
      return style;
    }
    _withNormalizedMaskStyles(callback) {
      if (!this.canvas)
        return callback();
      const masks = this.canvas.getObjects().filter((object) => object.maskId);
      const maskStyleBackups = masks.map((mask) => ({
        object: mask,
        stroke: mask.stroke,
        strokeWidth: mask.strokeWidth,
        opacity: mask.opacity
      }));
      try {
        masks.forEach((mask) => {
          mask.set(this._getMaskNormalStyle(mask));
        });
        return callback();
      } finally {
        maskStyleBackups.forEach((backup) => {
          try {
            backup.object.set({
              stroke: backup.stroke,
              strokeWidth: backup.strokeWidth,
              opacity: backup.opacity
            });
          } catch (error) {
          }
        });
      }
    }
    _restoreMaskControls(mask) {
      if (!mask)
        return;
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
      if (typeof mask.setCoords === "function")
        mask.setCoords();
    }
    _serializeCanvasState() {
      if (!this.canvas)
        return null;
      return this._withNormalizedMaskStyles(() => {
        const jsonObject = this.canvas.toJSON(this._getStateProperties());
        if (Array.isArray(jsonObject.objects)) {
          jsonObject.objects = jsonObject.objects.filter((object) => !object.isCropRect && !object.maskLabel);
        }
        return JSON.stringify(jsonObject);
      });
    }
    _normalizeQuality(quality) {
      const numericQuality = Number(quality);
      if (!Number.isFinite(numericQuality))
        return this.options.downsampleQuality ?? 0.92;
      return Math.max(0, Math.min(1, numericQuality));
    }
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
        sx: sourceX,
        sy: sourceY,
        sw: Math.max(1, endX - sourceX),
        sh: Math.max(1, endY - sourceY)
      };
    }
    async _cropDataUrl(dataUrl, sourceX, sourceY, sourceWidth, sourceHeight, multiplier, format = "jpeg", quality = 0.92) {
      return new Promise((resolve, reject) => {
        const imageElement = new Image();
        imageElement.onload = () => {
          try {
            const safeMultiplier = Math.max(1, Number(multiplier) || 1);
            const scaledSourceX = Math.round(sourceX * safeMultiplier);
            const scaledSourceY = Math.round(sourceY * safeMultiplier);
            const scaledSourceWidth = Math.max(1, Math.round(sourceWidth * safeMultiplier));
            const scaledSourceHeight = Math.max(1, Math.round(sourceHeight * safeMultiplier));
            const offscreenCanvas = document.createElement("canvas");
            offscreenCanvas.width = scaledSourceWidth;
            offscreenCanvas.height = scaledSourceHeight;
            const context = offscreenCanvas.getContext("2d");
            context.drawImage(imageElement, scaledSourceX, scaledSourceY, scaledSourceWidth, scaledSourceHeight, 0, 0, scaledSourceWidth, scaledSourceHeight);
            resolve(offscreenCanvas.toDataURL(`image/${format}`, quality));
          } catch (error) {
            reject(error);
          }
        };
        imageElement.onerror = reject;
        imageElement.src = dataUrl;
      });
    }
    async _exportCanvasRegionToDataURL({ sx, sy, sw, sh, multiplier = 1, quality = 0.92, format = "jpeg" }) {
      const safeMultiplier = Math.max(1, Number(multiplier) || 1);
      const fullDataUrl = this.canvas.toDataURL({
        format,
        quality,
        multiplier: safeMultiplier
      });
      return this._cropDataUrl(fullDataUrl, sx, sy, sw, sh, safeMultiplier, format, quality);
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
      if (!fabricObject)
        return { x: 0, y: 0 };
      fabricObject.setCoords();
      const coords = typeof fabricObject.getCoords === "function" ? fabricObject.getCoords() : null;
      if (coords && coords.length)
        return coords[0];
      const boundingRect = fabricObject.getBoundingRect(true, true);
      return { x: boundingRect.left, y: boundingRect.top };
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
      if (!fabricObject || !refPoint || !fabricObject.setPositionByOrigin)
        return;
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
      if (!fabricObject)
        return;
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
      if (!this.originalImage)
        return;
      this.originalImage.setCoords();
      const imageBounds = this.originalImage.getBoundingRect(true, true);
      const size = this._getScrollableCanvasSize(imageBounds.width, imageBounds.height);
      this._setCanvasSizeInt(size.width, size.height);
    }
    _expandCanvasToFitObject(fabricObject, padding = 10) {
      if (!this.canvas || !fabricObject || !this.options.expandCanvasToImage)
        return;
      try {
        fabricObject.setCoords();
        const boundingRect = fabricObject.getBoundingRect(true, true);
        const requiredWidth = Math.ceil(boundingRect.left + boundingRect.width + padding);
        const requiredHeight = Math.ceil(boundingRect.top + boundingRect.height + padding);
        const minWidth = this.containerElement ? Math.floor(this.containerElement.clientWidth || 0) : 0;
        const minHeight = this.containerElement ? Math.floor(this.containerElement.clientHeight || 0) : 0;
        const newWidth = Math.max(this.canvas.getWidth(), minWidth, requiredWidth);
        const newHeight = Math.max(this.canvas.getHeight(), minHeight, requiredHeight);
        this._setCanvasSizeInt(newWidth, newHeight);
      } catch (error) {
        this._reportWarning("expandCanvasToFitObject: failed to expand canvas", error);
      }
    }
    /** 
     * Scales the original image by a given factor, with animation.
     * Returns a promise that resolves when the scale animation is complete.
     * @param {number} factor - The scaling factor (will be clamped between `options.minScale` and `options.maxScale`).
     * @returns {Promise<void>} Promise that resolves once the scaling animation finishes.
     * @public
     */
    scaleImage(factor, options = {}) {
      return this.animQueue.add(() => this._scaleImageImpl(factor, options));
    }
    /** 
     * Scales the original image by a given factor, with animation.
     * Returns a promise that resolves when the scale animation is complete.
     * @param {number} factor - The scaling factor (will be clamped between `options.minScale` and `options.maxScale`).
     * @returns {Promise<void>} Promise that resolves once the scaling animation finishes.
     * @private
     */
    _scaleImageImpl(factor, options = {}) {
      if (!this.originalImage)
        return Promise.resolve();
      if (this.isAnimating)
        return Promise.resolve();
      const saveHistory = options.saveHistory !== false;
      factor = Math.max(this.options.minScale, Math.min(this.options.maxScale, factor));
      this.currentScale = factor;
      this.isAnimating = true;
      this._updateUI();
      const targetScale = this.baseImageScale * factor;
      const topLeft = this._getObjectTopLeftPoint(this.originalImage);
      this._setObjectOriginKeepingPosition(this.originalImage, "left", "top", topLeft);
      const scaleXAnimation = new Promise((resolve) => {
        this.originalImage.animate("scaleX", targetScale, {
          duration: this.options.animationDuration,
          onChange: this.canvas.renderAll.bind(this.canvas),
          onComplete: resolve
        });
      });
      const scaleYAnimation = new Promise((resolve) => {
        this.originalImage.animate("scaleY", targetScale, {
          duration: this.options.animationDuration,
          onChange: this.canvas.renderAll.bind(this.canvas),
          onComplete: resolve
        });
      });
      return Promise.all([scaleXAnimation, scaleYAnimation]).then(() => {
        this.originalImage.set({ scaleX: targetScale, scaleY: targetScale });
        this.originalImage.setCoords();
        if (this.options.expandCanvasToImage || this.options.coverImageToCanvas) {
          this._updateCanvasSizeToImageBounds();
        }
        this._alignObjectBoundingBoxToCanvasTopLeft(this.originalImage);
        this.canvas.getObjects().forEach((object) => {
          if (object.maskId)
            this._syncMaskLabel(object);
        });
        this.isAnimating = false;
        this._updateInputs();
        this._updateUI();
        if (saveHistory)
          this.saveState();
      }).catch(() => {
        this.isAnimating = false;
        this._updateUI();
      });
    }
    /** 
     * Rotates the original image by a given number of degrees, with animation.
     * Returns a promise that resolves when the rotation animation is complete.
     * @param {number} degrees - The angle in degrees to rotate the image.
     * @returns {Promise<void>} Promise that resolves once the rotation animation finishes.
     * @public
     */
    rotateImage(degrees, options = {}) {
      return this.animQueue.add(() => this._rotateImageImpl(degrees, options));
    }
    /** 
     * Rotates the original image by a given number of degrees, with animation.
     * Returns a promise that resolves when the rotation animation is complete.
     * @param {number} degrees - The angle in degrees to rotate the image.
     * @returns {Promise<void>} Promise that resolves once the rotation animation finishes.
     * @private
     */
    _rotateImageImpl(degrees, options = {}) {
      if (!this.originalImage)
        return Promise.resolve();
      if (this.isAnimating)
        return Promise.resolve();
      if (isNaN(degrees))
        return Promise.resolve();
      const saveHistory = options.saveHistory !== false;
      this.currentRotation = degrees;
      this.isAnimating = true;
      this._updateUI();
      const center = this.originalImage.getCenterPoint();
      this._setObjectOriginKeepingPosition(this.originalImage, "center", "center", center);
      const rotationAnimation = new Promise((resolve) => {
        this.originalImage.animate("angle", degrees, {
          duration: this.options.animationDuration,
          onChange: this.canvas.renderAll.bind(this.canvas),
          onComplete: resolve
        });
      });
      return rotationAnimation.then(() => {
        this.originalImage.set("angle", degrees);
        this.originalImage.setCoords();
        if (this.options.expandCanvasToImage || this.options.coverImageToCanvas) {
          this._updateCanvasSizeToImageBounds();
        }
        this._alignObjectBoundingBoxToCanvasTopLeft(this.originalImage);
        const newTopLeft = this._getObjectTopLeftPoint(this.originalImage);
        this._setObjectOriginKeepingPosition(this.originalImage, "left", "top", newTopLeft);
        this.canvas.getObjects().forEach((object) => {
          if (object.maskId)
            this._syncMaskLabel(object);
        });
        this.isAnimating = false;
        this._updateInputs();
        this._updateUI();
        if (saveHistory)
          this.saveState();
      }).catch(() => {
        this.isAnimating = false;
        this._updateUI();
      });
    }
    /**
     * Resets the image transform: scales to 1 and rotates to 0 degrees.
     * @returns {Promise<void>} Promise that resolves when reset is complete.
     */
    resetImageTransform() {
      if (!this.originalImage)
        return Promise.resolve();
      return this.animQueue.add(async () => {
        const before = this._serializeCanvasState();
        await this._scaleImageImpl(1, { saveHistory: false });
        await this._rotateImageImpl(0, { saveHistory: false });
        const after = this._serializeCanvasState();
        this._pushStateTransition(before, after);
      }).catch((err) => {
        this._reportError("resetImageTransform() failed", err);
      });
    }
    /**
     * @deprecated Use resetImageTransform() instead.
     */
    reset() {
      return this.resetImageTransform();
    }
    /**
     * Restores a canvas state that was previously stored by saveState().
     * @param {string} jsonString - the JSON string returned by fabric.toJSON().
     */
    loadFromState(jsonString) {
      if (!jsonString || !this.canvas)
        return Promise.resolve();
      return new Promise((resolve) => {
        try {
          const json = typeof jsonString === "string" ? JSON.parse(jsonString) : jsonString;
          this.canvas.loadFromJSON(json, () => {
            try {
              this._hideAllMaskLabels();
              const canvasObjects = this.canvas.getObjects();
              this.originalImage = canvasObjects.find((object) => object.type === "image" && !object.maskId) || null;
              if (this.originalImage) {
                this.originalImage.set({ originX: "left", originY: "top", selectable: false, evented: false, hasControls: false, hoverCursor: "default" });
                this.canvas.sendToBack(this.originalImage);
                this.currentRotation = Number(this.originalImage.angle) || 0;
                const baseScale = Number(this.baseImageScale) || 1;
                const imageScale = Number(this.originalImage.scaleX) || baseScale;
                this.currentScale = imageScale / baseScale;
              } else {
                this.currentScale = 1;
                this.currentRotation = 0;
              }
              const masks = canvasObjects.filter((object) => object.maskId);
              masks.forEach((mask) => {
                this._restoreMaskControls(mask);
                this._rebindMaskEvents(mask);
                mask.set(this._getMaskNormalStyle(mask));
              });
              this.maskCounter = masks.reduce((max, mask) => Math.max(max, mask.maskId), 0);
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
            } catch (callbackError) {
              this._reportError("loadFromState() failed", callbackError);
            } finally {
              resolve();
            }
          });
        } catch (e) {
          this._reportError("loadFromState() failed", e);
          resolve();
        }
      });
    }
    /**
     * Saves the current state of the canvas to history, storing any mask/raster label information.
     */
    saveState() {
      if (!this.canvas)
        return;
      const activeObj = this.canvas.getActiveObject();
      this._hideAllMaskLabels();
      try {
        const after = this._serializeCanvasState();
        const before = this._lastSnapshot || after;
        if (after === before)
          return;
        let executedOnce = false;
        const cmd = new Command(
          () => {
            if (executedOnce) {
              return this.loadFromState(after);
            }
            executedOnce = true;
            return void 0;
          },
          () => this.loadFromState(before)
        );
        this.historyManager.execute(cmd);
        this._lastSnapshot = after;
      } catch (err) {
        this._reportWarning("saveState: failed to save canvas snapshot", err);
      } finally {
        if (activeObj && activeObj.maskId && this.canvas.getObjects().includes(activeObj)) {
          this._handleSelectionChanged([activeObj]);
        }
        this._updateUI();
      }
    }
    _pushStateTransition(before, after) {
      if (!before || !after)
        return;
      if (before === after)
        return;
      if (!this.historyManager)
        this.historyManager = new HistoryManager(this.maxHistorySize || 50);
      const cmd = new Command(
        () => this.loadFromState(after),
        () => this.loadFromState(before)
      );
      this.historyManager.push(cmd);
      this._lastSnapshot = after;
      this._updateUI();
    }
    /**
     * Undo the last state change, if possible.
     */
    undo() {
      return this.historyManager.undo().then(() => {
        this._updateUI();
      }).catch((err) => {
        this._reportError("undo failed", err);
      });
    }
    /**
     * Redo the next state change, if possible.
     */
    redo() {
      return this.historyManager.redo().then(() => {
        this._updateUI();
      }).catch((err) => {
        this._reportError("redo failed", err);
      });
    }
    _rebindMaskEvents(mask) {
      if (!mask)
        return;
      if (mask.__imageEditorMaskHandlers) {
        try {
          mask.off("mouseover", mask.__imageEditorMaskHandlers.mouseover);
          mask.off("mouseout", mask.__imageEditorMaskHandlers.mouseout);
        } catch (e) {
        }
      }
      const metadata = {};
      if (!Number.isFinite(Number(mask.originalAlpha))) {
        metadata.originalAlpha = Number.isFinite(Number(mask.opacity)) ? Number(mask.opacity) : 0.5;
      }
      if (!mask.originalStroke)
        metadata.originalStroke = mask.stroke || "#ccc";
      if (!Number.isFinite(Number(mask.originalStrokeWidth))) {
        metadata.originalStrokeWidth = Number.isFinite(Number(mask.strokeWidth)) ? Number(mask.strokeWidth) : 1;
      }
      if (Object.keys(metadata).length)
        mask.set(metadata);
      const normalStyle = {
        stroke: mask.originalStroke || "#ccc",
        strokeWidth: mask.originalStrokeWidth,
        opacity: mask.originalAlpha
      };
      const hoverStyle = {
        stroke: "#ff5500",
        strokeWidth: 2,
        opacity: Math.min(mask.originalAlpha + 0.2, 1)
      };
      const mouseover = () => {
        mask.set(hoverStyle);
        if (mask.canvas)
          mask.canvas.requestRenderAll();
      };
      const mouseout = () => {
        mask.set(normalStyle);
        if (mask.canvas)
          mask.canvas.requestRenderAll();
      };
      mask.on("mouseover", mouseover);
      mask.on("mouseout", mouseout);
      mask.__imageEditorMaskHandlers = { mouseover, mouseout };
    }
    /** 
     * Creates a mask and adds it to the canvas.
     * Mask placement and properties are determined by the provided config and instance options.
     * Canvas and list UI are updated accordingly.
     * @param {Object} [config={}] - Optional mask configuration overrides:
     *   @param {string} [config.shape='rect'] - 'rect', 'circle', 'ellipse', 'polygon', ...
     *   @param {Object|Array} [config.points] - Required for polygon: [{x, y}, ...] or [[x, y], ...]
     *   @param {number|function} [config.width/height/rx/ry/radius] - Can be number or function(canvas, options) 
     *   @param {number|string|function} [config.left/top] - Absolute, %, or function
     *   @param {number|string} [config.angle] - Rotation angle (degree)
     *   @param {string} [config.color] - Fill color in CSS color format (default 'rgba(0,0,0,0.5)')
     *   @param {number} [config.alpha] - Opacity, from 0 to 1 (default 0.5)
     *   @param {boolean} [config.selectable=true]
     *   @param {Object} [config.styles] - Custom styles (stroke, dashArray, etc)
     *   @param {function} [config.onCreate] - Callback after mask created (receives Fabric object)
     *   @param {function} [config.fabricGenerator] - (maskConfig) => new FabricObj
     * @returns {fabric.Rect|null} The created mask object, or null if canvas is not available.
     * @public
     */
    createMask(config = {}) {
      if (!this.canvas)
        return null;
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
      let left = firstOffset;
      let top = firstOffset;
      const resolveValue = (value, fallback) => {
        if (typeof value === "function")
          return value(this.canvas, this.options);
        if (typeof value === "string" && value.endsWith("%")) {
          const percent = parseFloat(value) / 100;
          return Math.floor((this.canvas ? this.canvas.getWidth() : 0) * percent);
        }
        return value != null ? value : fallback;
      };
      if (maskConfig.left === void 0 && this._lastMask) {
        const previousMask = this._lastMask;
        let previousMaskRight = previousMask.left;
        if (previousMask.getScaledWidth) {
          previousMaskRight += previousMask.getScaledWidth();
        } else if (previousMask.width) {
          previousMaskRight += previousMask.width * (previousMask.scaleX ?? 1);
        }
        left = Math.round(previousMaskRight + maskConfig.gap);
        top = previousMask.top ?? firstOffset;
      } else {
        left = resolveValue(maskConfig.left, firstOffset);
        top = resolveValue(maskConfig.top, firstOffset);
      }
      maskConfig.width = resolveValue(maskConfig.width, this.options.defaultMaskWidth);
      maskConfig.height = resolveValue(maskConfig.height, this.options.defaultMaskHeight);
      let mask;
      if (typeof maskConfig.fabricGenerator === "function") {
        mask = maskConfig.fabricGenerator(maskConfig, this.canvas, this.options);
      } else {
        switch (shapeType) {
          case "circle":
            mask = new fabric.Circle({
              left,
              top,
              radius: resolveValue(maskConfig.radius, Math.min(maskConfig.width, maskConfig.height) / 2),
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
              rx: resolveValue(maskConfig.rx, maskConfig.width / 2),
              ry: resolveValue(maskConfig.ry, maskConfig.height / 2),
              fill: maskConfig.color,
              opacity: maskConfig.alpha,
              angle: maskConfig.angle,
              ...maskConfig.styles
            });
            break;
          case "polygon": {
            let polygonPoints = maskConfig.points || [];
            if (Array.isArray(polygonPoints) && polygonPoints.length && typeof polygonPoints[0] === "object") {
              polygonPoints = polygonPoints.map((point) => ({ x: Number(point.x), y: Number(point.y) }));
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
              width: resolveValue(maskConfig.width, this.options.defaultMaskWidth),
              height: resolveValue(maskConfig.height, this.options.defaultMaskHeight),
              fill: maskConfig.color,
              opacity: maskConfig.alpha,
              angle: maskConfig.angle,
              rx: maskConfig.rx,
              // Rounded Corners
              ry: maskConfig.ry,
              ...maskConfig.styles
            });
        }
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
        strokeUniform: "strokeUniform" in maskConfig ? maskConfig.strokeUniform : hasStyle("strokeUniform") ? styles.strokeUniform : true
      };
      if (hasStyle("strokeDashArray"))
        maskSettings.strokeDashArray = styles.strokeDashArray;
      mask.set(maskSettings);
      mask.setCoords();
      mask.set({
        originalAlpha: maskConfig.alpha,
        originalStroke: mask.stroke || "#ccc",
        originalStrokeWidth: Number.isFinite(Number(mask.strokeWidth)) ? Number(mask.strokeWidth) : 1
      });
      this._rebindMaskEvents(mask);
      this._expandCanvasToFitObject(mask);
      this._lastMaskInitialLeft = left;
      this._lastMaskInitialTop = top;
      this._lastMaskInitialWidth = resolveValue(maskConfig.width, this.options.defaultMaskWidth);
      const maskId = ++this.maskCounter;
      mask.set({
        maskId,
        maskName: `${this.options.maskName}${maskId}`
      });
      this._lastMask = mask;
      this.canvas.add(mask);
      this.canvas.bringToFront(mask);
      if (maskConfig.selectable)
        this.canvas.setActiveObject(mask);
      this._handleSelectionChanged([mask]);
      this._updateMaskList();
      this._updateUI();
      this.canvas.renderAll();
      this.saveState();
      if (typeof maskConfig.onCreate === "function")
        maskConfig.onCreate(mask, this.canvas);
      return mask;
    }
    /**
     * @deprecated Use createMask() instead.
     */
    addMask(config = {}) {
      return this.createMask(config);
    }
    /**
     * Removes the currently selected mask from the canvas, if any.
     * The associated label is also removed. UI and mask list are updated.
     */
    removeSelectedMask() {
      const activeObject = this.canvas.getActiveObject();
      const selectedMasks = this._getModifiedMasks(activeObject);
      if (!selectedMasks.length)
        return;
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
      if (saveHistory)
        this.saveState();
    }
    /**
     * Removes the label associated with the specified mask object, if it exists.
     * 
     * @param {fabric.Object} mask - The mask object whose label should be removed.
     * @private
     */
    _removeLabelForMask(mask) {
      if (!mask || !this.canvas)
        return;
      if (mask.__label) {
        try {
          const canvasObjects = this.canvas.getObjects();
          if (canvasObjects.includes(mask.__label)) {
            this.canvas.remove(mask.__label);
          }
        } catch (error) {
        }
        try {
          delete mask.__label;
        } catch (error) {
        }
      }
    }
    /**
     * Creates and adds a custom label (fabric.Text or fabric.IText) for the mask.
     * The label is default bound to the top-left of the mask and managed as a non-interactive overlay.
     * 
     * @param {fabric.Object} mask - The mask to create a label for.
     * @private
     */
    _createLabelForMask(mask) {
      if (!mask || !this.options.maskLabelOnSelect)
        return;
      this._removeLabelForMask(mask);
      let textObject = null;
      if (this.options.label && typeof this.options.label.create === "function") {
        textObject = this.options.label.create(mask, fabric);
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
            const masks = this.canvas ? this.canvas.getObjects().filter((object) => object.maskId) : [];
            const maskIndex = Math.max(0, masks.indexOf(mask));
            labelText = this.options.label.getText(mask, maskIndex);
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
      if (!this.canvas)
        return;
      const canvasObjects = this.canvas.getObjects();
      const labels = canvasObjects.filter((object) => object.maskLabel);
      labels.forEach((label) => {
        try {
          if (canvasObjects.includes(label))
            this.canvas.remove(label);
        } catch (error) {
        }
      });
      canvasObjects.forEach((object) => {
        if (object.maskId && object.__label) {
          try {
            delete object.__label;
          } catch (error) {
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
      if (!mask)
        return;
      if (!this.options.maskLabelOnSelect)
        return;
      if (!mask.__label)
        return;
      const coords = mask.getCoords ? mask.getCoords() : null;
      if (!coords || coords.length < 4)
        return;
      const tl = coords[0];
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
      if (!mask)
        return;
      if (!this.options.maskLabelOnSelect)
        return;
      if (!mask.__label)
        this._createLabelForMask(mask);
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
      if (selectedMask)
        this._showLabelForMask(selectedMask);
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
      const maskListElement = document.getElementById(this.elements.maskList);
      if (!maskListElement)
        return;
      maskListElement.innerHTML = "";
      const masks = this.canvas.getObjects().filter((object) => object.maskId);
      masks.forEach((mask) => {
        const listItemElement = document.createElement("li");
        listItemElement.className = "list-group-item mask-item";
        listItemElement.textContent = mask.maskName;
        listItemElement.onclick = () => {
          this.canvas.setActiveObject(mask);
          this._handleSelectionChanged([mask]);
        };
        maskListElement.appendChild(listItemElement);
      });
    }
    /**
     * Updates the visual selection (CSS 'active') state for the mask list in the DOM.
     * 
     * @param {Object|null} selectedMask - The currently selected mask, or null if none selected.
     * @private
     */
    _updateMaskListSelection(selectedMask) {
      const maskListElement = document.getElementById(this.elements.maskList);
      if (!maskListElement)
        return;
      const maskItems = maskListElement.querySelectorAll(".mask-item");
      maskItems.forEach((item) => {
        const isSelected = !!selectedMask && item.textContent === selectedMask.maskName;
        item.classList.toggle("active", isSelected);
      });
    }
    /**
     * Merges current masks into the image: exports a masked/cropped image, removes all masks, and re-imports the merged image.
     * Will not run if no original image or no masks exist.
     * @async
     * @returns {Promise<void>} Resolves when merge and load are complete.
     */
    async mergeMasks() {
      if (!this.originalImage)
        return;
      const masks = this.canvas.getObjects().filter((object) => object.maskId);
      if (!masks.length)
        return;
      this.canvas.discardActiveObject();
      this.canvas.renderAll();
      try {
        const beforeJson = this._serializeCanvasState();
        const merged = await this.exportImageBase64({ exportImageArea: true, multiplier: this.options.exportMultiplier });
        this.removeAllMasks({ saveHistory: false });
        await this.loadImage(merged);
        const afterJson = this._serializeCanvasState();
        this._pushStateTransition(beforeJson, afterJson);
      } catch (err) {
        this._reportError("merge error", err);
      }
    }
    /**
     * @deprecated Use mergeMasks() instead.
     */
    async merge() {
      return this.mergeMasks();
    }
    /**
     * Triggers a JPEG image download of the current canvas (image plus masks if configured).
     * The image area and multiplier are controlled by options.
     * @param {string} [fileName=this.options.defaultDownloadFileName] - Desired download file name.
     */
    downloadImage(fileName = this.options.defaultDownloadFileName) {
      if (!this.originalImage)
        return;
      const exportImageArea = this.options.exportImageAreaByDefault;
      this.exportImageBase64({ exportImageArea, multiplier: this.options.exportMultiplier }).then((base64) => {
        const link = document.createElement("a");
        link.download = fileName;
        link.href = base64;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }).catch((err) => this._reportError("download error", err));
    }
    /**
     * Exports the image as a Base64-encoded image data URL.
     * Can export either the original, or the current view including masks (clipped/cropped).
     * Will restore masks' state after temporary modifications for export.
     * @async
     * @param {Object} [options={}] - Export options.
     * @param {boolean} [options.exportImageArea] - If true, exports only the image bounding area with masks cropped and blended.
     * @param {number} [options.multiplier=1] - Scaling multiplier for output (resolution).
     * @param {number} [options.quality=0.92] - Image quality between 0 and 1 for lossy formats.
     * @param {string} [options.fileType='jpeg'] - Output file type ('jpeg' | 'png' | 'webp').
     * @returns {Promise<string>} Promise resolving to an image data URL.
     * @throws {Error} If there is no image loaded.
     */
    async exportImageBase64(options = {}) {
      if (!this.originalImage)
        throw new Error("No image loaded");
      const exportImageArea = typeof options.exportImageArea === "boolean" ? options.exportImageArea : this.options.exportImageAreaByDefault;
      const multiplier = options.multiplier || this.options.exportMultiplier || 1;
      const quality = this._normalizeQuality(options.quality ?? this.options.downsampleQuality);
      const format = this._normalizeImageFormat(options.fileType || options.format);
      if (!exportImageArea) {
        const masks2 = this.canvas.getObjects().filter((object) => object.maskId || object.maskLabel);
        const maskVisibilityBackups = masks2.map((mask) => ({ object: mask, visible: mask.visible }));
        try {
          masks2.forEach((mask) => {
            mask.set({ visible: false });
          });
          this.canvas.discardActiveObject();
          this.canvas.renderAll();
          this.originalImage.setCoords();
          const imageBounds = this.originalImage.getBoundingRect(true, true);
          const { sx, sy, sw, sh } = this._getClampedCanvasRegion(imageBounds, { includePartialPixels: false });
          return await this._exportCanvasRegionToDataURL({
            sx,
            sy,
            sw,
            sh,
            multiplier,
            quality,
            format
          });
        } finally {
          maskVisibilityBackups.forEach((backup) => {
            try {
              backup.object.set({ visible: backup.visible });
            } catch (error) {
            }
          });
          this.canvas.renderAll();
        }
      }
      const masks = this.canvas.getObjects().filter((object) => object.maskId);
      const maskStyleBackups = masks.map((mask) => ({
        object: mask,
        opacity: mask.opacity,
        fill: mask.fill,
        strokeWidth: mask.strokeWidth,
        stroke: mask.stroke,
        selectable: mask.selectable,
        lockRotation: mask.lockRotation
      }));
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
        const { sx, sy, sw, sh } = this._getClampedCanvasRegion(imageBounds, { includePartialPixels: false });
        finalBase64 = await this._exportCanvasRegionToDataURL({
          sx,
          sy,
          sw,
          sh,
          multiplier,
          quality,
          format
        });
      } finally {
        maskStyleBackups.forEach((backup) => {
          try {
            backup.object.set({
              opacity: backup.opacity,
              fill: backup.fill,
              strokeWidth: backup.strokeWidth,
              stroke: backup.stroke,
              selectable: backup.selectable,
              lockRotation: backup.lockRotation
            });
            backup.object.setCoords();
          } catch (error) {
          }
        });
        this.canvas.renderAll();
      }
      return finalBase64;
    }
    /**
     * @deprecated Use exportImageBase64() instead.
     */
    async getImageBase64(options = {}) {
      return this.exportImageBase64(options);
    }
    /**
     * Exports the current canvas (with or without masks) as a File object.
     * Allows you to choose whether to merge masks and specify file type (jpeg/png/webp).
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
      if (!this.originalImage)
        throw new Error("No image loaded");
      const {
        mergeMask = true,
        fileType = "jpeg",
        quality = this.options.downsampleQuality ?? 0.92,
        multiplier = this.options.exportMultiplier ?? 1,
        fileName = this.options.defaultDownloadFileName ?? "exported_image.jpg"
      } = options;
      const safeFileType = this._normalizeImageFormat(fileType);
      let base64;
      if (mergeMask) {
        base64 = await this.exportImageBase64({
          exportImageArea: true,
          multiplier,
          quality,
          fileType: safeFileType
        });
      } else {
        base64 = await this.exportImageBase64({
          exportImageArea: false,
          multiplier,
          quality,
          fileType: safeFileType
        });
      }
      let imageDataUrl = base64;
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
              context.drawImage(imageElement, 0, 0);
              const convertedDataUrl = offscreenCanvas.toDataURL(`image/${safeFileType}`, quality);
              resolve(convertedDataUrl);
            } catch (error) {
              reject(error);
            }
          };
          imageElement.onerror = reject;
          imageElement.src = base64;
        });
      }
      const binaryString = atob(imageDataUrl.split(",")[1]);
      const mime = `image/${safeFileType}`;
      let byteIndex = binaryString.length;
      const bytes = new Uint8Array(byteIndex);
      while (byteIndex--) {
        bytes[byteIndex] = binaryString.charCodeAt(byteIndex);
      }
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
      if (this._cropRect && this.canvas)
        this._removeCropRect();
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
      if (this.canvas)
        this.canvas.renderAll();
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
          }
        });
      }
      this._cropPrevEvented = null;
    }
    _removeCropRect() {
      if (!this._cropRect)
        return;
      try {
        if (this._cropHandlers && this._cropHandlers.length) {
          this._cropHandlers.forEach((targetHandlers) => {
            targetHandlers.handlers.forEach((handlerRecord) => {
              targetHandlers.target.off(handlerRecord.eventName, handlerRecord.handler);
            });
          });
        }
      } catch (error) {
      }
      try {
        this.canvas.remove(this._cropRect);
      } catch (error) {
      }
      this._cropRect = null;
      this._cropHandlers = [];
    }
    /**
     * Enter crop mode: create a resizable/movable selection rect on top of the image.
     * @public
     */
    enterCropMode() {
      if (!this.canvas || !this.originalImage || this._cropMode)
        return;
      if (!this.isImageLoaded())
        return;
      this._cropMode = true;
      this._prevSelectionSetting = this.canvas.selection;
      this.canvas.selection = false;
      this.canvas.discardActiveObject();
      this.originalImage.setCoords();
      const imageBounds = this.originalImage.getBoundingRect(true, true);
      const padding = this.options.crop && this.options.crop.padding ? this.options.crop.padding : 10;
      const left = Math.max(0, Math.floor(imageBounds.left + padding));
      const top = Math.max(0, Math.floor(imageBounds.top + padding));
      const width = Math.min(this.options.crop.minWidth || 50, Math.floor(imageBounds.width - padding * 2));
      const height = Math.min(this.options.crop.minHeight || 50, Math.floor(imageBounds.height - padding * 2));
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
        originY: "top"
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
            if (shouldHideMasks && (object.maskId || object.maskLabel))
              updates.visible = false;
            object.set(updates);
          } catch (error) {
          }
        }
      });
      const handleCropRectModified = () => {
        try {
          cropRect.setCoords();
          this.canvas.requestRenderAll();
        } catch (error) {
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
     * Cancel crop mode and remove the temporary selection rect.
     * @public
     */
    cancelCrop() {
      if (!this.canvas || !this._cropMode)
        return;
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
     * Apply the current crop rectangle.
     * remove all masks and export canvas snapshot and crop via offscreen canvas
     * @public
     */
    async applyCrop() {
      if (!this.canvas || !this._cropMode || !this._cropRect)
        return;
      this._cropRect.setCoords();
      const rectBounds = this._cropRect.getBoundingRect(true, true);
      const { sx, sy, sw, sh } = this._getClampedCanvasRegion(rectBounds);
      const shouldPreserveMasks = !!(this.options.crop && this.options.crop.preserveMasksAfterCrop);
      this._restoreCropObjectState();
      let beforeJson = null;
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
            try {
              mask.setCoords();
              const maskBounds = mask.getBoundingRect(true, true);
              const intersectsCrop = maskBounds.left < sx + sw && maskBounds.left + maskBounds.width > sx && maskBounds.top < sy + sh && maskBounds.top + maskBounds.height > sy;
              this._removeLabelForMask(mask);
              this.canvas.remove(mask);
              if (shouldPreserveMasks && intersectsCrop) {
                mask.set({
                  left: (mask.left || 0) - sx,
                  top: (mask.top || 0) - sy,
                  visible: true
                });
                mask.setCoords();
                preservedMasks.push(mask);
              }
            } catch (error) {
              this._reportWarning("applyCrop: failed to remove mask", error);
            }
          });
          this._clearMaskPlacementMemory();
          this.canvas.discardActiveObject();
          this.canvas.renderAll();
        }
      } catch (error) {
        this._reportWarning("applyCrop: error while removing masks", error);
      }
      this._removeCropRect();
      this._cropMode = false;
      this.canvas.selection = !!this._prevSelectionSetting;
      this._prevSelectionSetting = void 0;
      let croppedBase64;
      try {
        croppedBase64 = await this._exportCanvasRegionToDataURL({
          sx,
          sy,
          sw,
          sh,
          multiplier: 1,
          quality: this._normalizeQuality(this.options.downsampleQuality),
          format: "jpeg"
        });
      } catch (error) {
        await this._restoreStateAfterCropFailure(beforeJson, "applyCrop: failed to create cropped image", error);
        return;
      }
      try {
        await this.loadImage(croppedBase64);
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
      } catch (e) {
        await this._restoreStateAfterCropFailure(beforeJson, "applyCrop: loadImage(croppedBase64) failed", e);
        return;
      }
      let afterJson = null;
      try {
        afterJson = this._serializeCanvasState();
      } catch (e) {
        this._reportWarning("applyCrop: failed to serialize after state", e);
        afterJson = null;
      }
      try {
        this._pushStateTransition(beforeJson, afterJson);
      } catch (e) {
        this._reportWarning("applyCrop: failed to push history command", e);
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
      const scaleInputElement = document.getElementById(this.elements.scaleRate);
      if (scaleInputElement)
        scaleInputElement.value = Math.round(this.currentScale * 100);
    }
    /**
     * Updates the enabled/disabled state of various UI controls (buttons)
     * based on the current application state (image/mask presence, animation, etc).
     * @private
     */
    _updateUI() {
      const hasImage = !!this.originalImage;
      const masks = hasImage ? this.canvas.getObjects().filter((object) => object.maskId) : [];
      const hasMasks = masks.length > 0;
      const activeObject = this.canvas.getActiveObject();
      const hasSelectedMask = activeObject && activeObject.maskId;
      const isDefaultTransform = this.currentScale === 1 && this.currentRotation === 0;
      const canUndo = this.historyManager?.canUndo();
      const canRedo = this.historyManager?.canRedo();
      const isInCropMode = !!this._cropMode;
      if (isInCropMode) {
        for (const key of Object.keys(this.elements || {})) {
          const element = document.getElementById(this.elements[key]);
          if (!element)
            continue;
          if (key === "applyCropBtn" || key === "cancelCropBtn") {
            this._setDisabled(key, false);
          } else {
            this._setDisabled(key, true);
          }
        }
        return;
      }
      this._setDisabled("zoomInBtn", !hasImage || this.isAnimating || this.currentScale >= this.options.maxScale);
      this._setDisabled("zoomOutBtn", !hasImage || this.isAnimating || this.currentScale <= this.options.minScale);
      this._setDisabled("rotateLeftBtn", !hasImage || this.isAnimating);
      this._setDisabled("rotateRightBtn", !hasImage || this.isAnimating);
      this._setDisabled("addMaskBtn", !hasImage || this.isAnimating);
      this._setDisabled("removeMaskBtn", !hasSelectedMask || this.isAnimating);
      this._setDisabled("removeAllMasksBtn", !hasMasks || this.isAnimating);
      this._setDisabled("mergeBtn", !hasImage || !hasMasks || this.isAnimating);
      this._setDisabled("downloadBtn", !hasImage || this.isAnimating);
      this._setDisabled("resetBtn", !hasImage || isDefaultTransform || this.isAnimating);
      this._setDisabled("undoBtn", !hasImage || this.isAnimating || !canUndo);
      this._setDisabled("redoBtn", !hasImage || this.isAnimating || !canRedo);
      this._setDisabled("cropBtn", !hasImage || this.isAnimating);
      this._setDisabled("applyCropBtn", true);
      this._setDisabled("cancelCropBtn", true);
      this._setDisabled("imageInput", this.isAnimating);
      this._setDisabled("uploadArea", this.isAnimating);
    }
    /**
     * Enables or disables a specific UI element (typically a button) by its key.
     * 
     * @param {string} key - Key of the element in this.elements (e.g. 'zoomInBtn').
     * @param {boolean} disabled - If true, disables the element; otherwise enables.
     * @private
     */
    _setDisabled(key, disabled) {
      const element = document.getElementById(this.elements[key]);
      if (!element)
        return;
      if ("disabled" in element) {
        element.disabled = !!disabled;
        return;
      }
      if (disabled) {
        element.setAttribute("aria-disabled", "true");
        element.style.pointerEvents = "none";
      } else {
        element.removeAttribute("aria-disabled");
        element.style.pointerEvents = "";
      }
    }
    _isElementDisabled(element) {
      if (!element)
        return false;
      if ("disabled" in element)
        return !!element.disabled;
      return element.getAttribute("aria-disabled") === "true";
    }
    /**
     * Automatically display and hide placeholders and containers based on the current image content
     * @private
     */
    _updatePlaceholderStatus() {
      if (!this.options.showPlaceholder)
        return;
      this._setPlaceholderVisible(!this.originalImage);
    }
    /**
     * Controls the display/hiding of the Placeholder and Canvas container.
     * @param {boolean} show - true displays the placeholder, false displays the canvas container
     * @private
     */
    _setPlaceholderVisible(show) {
      if (!this.placeholderElement)
        return;
      if (show) {
        this.placeholderElement.classList.remove("d-none");
        this.placeholderElement.classList.add("d-flex");
        this.containerElement.classList.add("d-none");
      } else {
        this.placeholderElement.classList.remove("d-flex");
        this.placeholderElement.classList.add("d-none");
        this.containerElement.classList.remove("d-none");
      }
    }
    /**
     * Cleans up and disposes of the canvas and related references.
     * Call this method to free memory and remove canvas listeners when the editor is no longer needed.
     * @public
     */
    dispose() {
      try {
        for (const key in this._handlersByElementKey || {}) {
          const handlers = this._handlersByElementKey[key] || [];
          const element = document.getElementById(this.elements[key]);
          if (!element)
            continue;
          handlers.forEach((handlerRecord) => {
            try {
              element.removeEventListener(handlerRecord.eventName, handlerRecord.handler);
            } catch (error) {
            }
          });
        }
      } catch (error) {
      }
      if (this._cropRect) {
        try {
          this.canvas.remove(this._cropRect);
        } catch (e) {
        }
        this._cropRect = null;
      }
      if (this.containerElement && this._containerOriginalOverflow !== void 0) {
        try {
          this.containerElement.style.overflow = this._containerOriginalOverflow;
        } catch (e) {
        }
      }
      if (this.canvas) {
        try {
          this.canvas.dispose();
        } catch (e) {
        }
        this.canvas = null;
        this.canvasElement = null;
        this.isImageLoadedToCanvas = false;
      }
      this._handlersByElementKey = {};
    }
  };
  var AnimationQueue = class {
    /**
     * Creates a new AnimationQueue.
     *
     * @constructor
     */
    constructor() {
      this.queue = [];
      this.running = false;
    }
    /**
     * Adds an animation function to the queue.
     *
     * @param   {Function} animationFn  A function that returns a Promise or any await-able.
     * @returns {Promise<*>}            A Promise that resolves/rejects with the animation result.
     */
    async add(animationFn) {
      return new Promise((resolve, reject) => {
        this.queue.push({ fn: animationFn, resolve, reject });
        if (!this.running) {
          this.processQueue();
        }
      });
    }
    /**
     * Internal helper that processes the animation queue sequentially until it is empty.
     *
     * @private
     * @returns {Promise<void>}
     */
    async processQueue() {
      if (this.queue.length === 0) {
        this.running = false;
        return;
      }
      this.running = true;
      const { fn, resolve, reject } = this.queue.shift();
      try {
        const result = await fn();
        resolve(result);
      } catch (error) {
        reject(error);
      }
      this.processQueue();
    }
  };
  var Command = class {
    /**
     * @param {Function} execute  The function that performs the action.
     * @param {Function} undo     The function that reverts the action.
     */
    constructor(execute, undo) {
      this.execute = execute;
      this.undo = undo;
    }
  };
  var HistoryManager = class {
    /**
     * @param {number} [maxSize=50]  Maximum number of commands to keep in history.
     */
    constructor(maxSize = 50) {
      this.history = [];
      this.currentIndex = -1;
      this.maxSize = maxSize;
      this.pending = Promise.resolve();
    }
    enqueue(task) {
      const run = this.pending.then(task, task);
      this.pending = run.catch(() => {
      });
      return run;
    }
    /**
     * Executes a new command and pushes it onto the history stack.
     * Truncates any "future" history when branching.
     *
     * @param {Command} command  The command to execute.
     * @returns {void}
     */
    execute(command) {
      command.execute();
      this.push(command);
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
      } else {
        this.currentIndex++;
      }
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
     * @returns {void}
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
     * @returns {void}
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

  // src/browser.js
  var scope = typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : null;
  setFabric(scope && scope.fabric);
  if (scope) {
    scope.ImageEditor = image_editor_default;
  }
})();
//# sourceMappingURL=image-editor.js.map
