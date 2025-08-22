/**
 * @file image-editor.js
 * @module image-editor
 * @version 1.0.0
 * @author Ben Situ
 * @license MIT
 * @description Lightweight canvas-based image editor with masking/transform/export support.
 *
 * This source file is free software, available under the MIT license.
 * It is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY;
 * without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the license files for details.
 */

(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD / RequireJS
        define([], factory)
    } else if (typeof module === 'object' && module.exports) {
        // CommonJS / Node / webpack (target=commonjs)
        module.exports = factory()
    } else {
        // Browser normal <script> method, hanging to the global
        root.ImageEditor = factory()
    }
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict'
    /**
     * ImageEditor
     * 
     * A lightweight wrapper around fabric.js providing masking, scaling, rotation,
     * merging/export helpers, and UI integrations for image editing.
     *
     * <b>Note:</b> Requires fabric.js (v5.x) to be loaded on the page before use.
     *
     * <pre>
     * Example usage:
     * const editor = new ImageEditor({ canvasWidth: 1024, canvasHeight: 768 });
     * editor.init();
     * </pre>
     *
     * @class ImageEditor
     * @classdesc Fabric.js-based image editor with simple mask, transform, export and UI features.
     *
     * @param {Object} [options={}] - Customization options to override defaults.
     * @param {number} [options.canvasWidth=800] - The initial canvas width in pixels.
     * @param {number} [options.canvasHeight=600] - The initial canvas height in pixels.
     * @param {string} [options.backgroundColor='#ffffff'] - The canvas background color.
     * @param {number} [options.animationDuration=300] - Duration in ms for scale/rotate animations.
     * @param {number} [options.minScale=0.1] - Minimum image scaling factor.
     * @param {number} [options.maxScale=5.0] - Maximum image scaling factor.
     * @param {number} [options.scaleStep=0.05] - Scale increment/decrement per step.
     * @param {number} [options.rotationStep=90] - Rotation step in degrees.
     * @param {boolean} [options.expandCanvasToImage=true] - If true, expands the canvas to fit image/mask.
     * @param {boolean} [options.fitImageToCanvas=false] - If true, fits loaded image inside canvas.
     * @param {boolean} [options.downsampleOnLoad=true] - Whether to downsample very large images on load.
     * @param {number} [options.downsampleMaxWidth=4000] - Max width for downsampling.
     * @param {number} [options.downsampleMaxHeight=3000] - Max height for downsampling.
     * @param {number} [options.downsampleQuality=0.92] - JPEG quality for downsampling/export.
     * @param {number} [options.exportMultiplier=1] - Scale output image by this multiplier on export.
     * @param {boolean} [options.exportImageAreaByDefault=true] - Export only the image area (clipped to masks).
     * @param {number} [options.defaultMaskWidth=50] - Default width of new mask rectangles.
     * @param {number} [options.defaultMaskHeight=80] - Default height of new masks.
     * @param {boolean} [options.maskRotatable=false] - If true, masks can be rotated.
     * @param {boolean} [options.maskLabelOnSelect=true] - Show label on selected mask.
     * @param {number} [options.maskLabelOffset=3] - Offset for mask labels from top-left corner.
     * @param {string} [options.maskName='mask'] - Prefix for mask names/labels.
     * @param {boolean} [options.showPlaceholder=true] - If true, shows placeholder when no image is loaded.
     * @param {string|null} [options.initialImageBase64=null] - Base64 string to auto-load as initial image, if any.
     * @param {string} [options.defaultDownloadFileName='edited_image.jpg'] - Default file name for downloads.
     * @param {function} [options.onImageLoaded] - Optional callback to invoke after an image loads.
     * 
     * @constructor
     */
    class ImageEditor {
        constructor(options = {}) {
            // Verify that fabric.js is present
            this._fabricLoaded = typeof fabric !== 'undefined';
            if (!this._fabricLoaded) {
                console.error('fabric.js is not loaded. Please include fabric.js first. Initialization will be aborted.');
            }
            // Default options (can be overridden via ctor param)
            this.options = {
                canvasWidth: 800,
                canvasHeight: 600,
                backgroundColor: '#ffffff',

                animationDuration: 300,
                minScale: 0.1,
                maxScale: 5.0,
                scaleStep: 0.05,
                rotationStep: 90,

                expandCanvasToImage: true,
                fitImageToCanvas: false,

                downsampleOnLoad: true,
                downsampleMaxWidth: 4000,
                downsampleMaxHeight: 3000,
                downsampleQuality: 0.92,

                exportMultiplier: 1,
                exportImageAreaByDefault: true,

                defaultMaskWidth: 50,
                defaultMaskHeight: 80,
                maskRotatable: false,
                maskLabelOnSelect: true,
                maskLabelOffset: 3,
                maskName: 'mask',

                groupSelection: false,

                showPlaceholder: true,
                initialImageBase64: null, // Provide a base64 'data:image/...' string here if you want auto-load

                defaultDownloadFileName: 'edited_image.jpg',

                ...options
            };
            this.options.label = {
                getText: (mask, maskIndex) => mask.maskName,
                textOptions: {
                    fontSize: 12,
                    fill: '#fff',
                    backgroundColor: 'rgba(0,0,0,0.7)',
                    padding: 2,
                    fontFamily: "monospace",
                    fontWeight: "bold",
                    selectable: false,
                    evented: false,
                    originX: 'left',
                    originY: 'top',
                }
            };

            // Runtime state
            this.canvas = null;
            this.canvasEl = null;
            this.containerEl = null;
            this.placeholderEl = null;

            this.originalImage = null; // fabric.Image
            this.baseImageScale = 1;
            this.currentScale = 1;
            this.currentRotation = 0;
            this.maskCounter = 0;
            this.isAnimating = false;
            this.elements = {};
            this.isImageLoadedToCanvas = false;
            this.maxHistorySize = 50;

            this._boundHandlers = {};

            this._lastMaskInitialLeft = null;
            this._lastMaskInitialTop = null;
            this._lastMaskInitialWidth = null;

            this.onImageLoaded = typeof options.onImageLoaded === 'function' ? options.onImageLoaded : null;

            this.animQueue = new AnimationQueue();
            this.historyManager = new HistoryManager(this.maxHistorySize);
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
            if (!this._fabricLoaded) return;

            const defaults = {
                canvas: 'fabricCanvas',
                canvasContainer: null, // Pass an ID here if you have a scrollable viewport container
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
                imageInput: 'imageInput'
            };

            this.elements = { ...defaults, ...idMap };

            this._initCanvas();
            this._bindEvents();
            this._updateInputs();
            this._updateMaskList();
            this._updateUI();

            // Auto-load initial image if provided
            if (this.options.initialImageBase64) {
                this.loadImage(this.options.initialImageBase64);
            } else {
                this._updatePlaceholderStatus();
            }
        }

        /**
         * Canvas setup helpers
         * @private
         */
        _initCanvas() {
            const canvasEl = document.getElementById(this.elements.canvas);
            if (!canvasEl) throw new Error('Canvas is not found: ' + this.elements.canvas);
            this.canvasEl = canvasEl;

            // Decide which element acts as "viewport" (for width/height fallback)
            if (this.elements.canvasContainer) {
                const ce = document.getElementById(this.elements.canvasContainer);
                this.containerEl = ce || canvasEl.parentElement;
            } else {
                this.containerEl = canvasEl.parentElement;
            }

            this.placeholderEl = document.getElementById(this.elements.imgPlaceholder) || null;

            // Initial size — take container size if available
            let initialW = this.options.canvasWidth;
            let initialH = this.options.canvasHeight;
            if (this.containerEl) {
                const cw = Math.floor(this.containerEl.clientWidth);
                const ch = Math.floor(this.containerEl.clientHeight);
                if (cw > 0 && ch > 0) { initialW = cw; initialH = ch; }
            }

            this.canvas = new fabric.Canvas(canvasEl, {
                width: initialW,
                height: initialH,
                backgroundColor: this.options.backgroundColor,
                selection: this.options.groupSelection,
                preserveObjectStacking: true
            });

            // Fabric event wiring
            this.canvas.on('selection:created', (e) => this._onSelectionChanged(e.selected));
            this.canvas.on('selection:updated', (e) => this._onSelectionChanged(e.selected));
            this.canvas.on('selection:cleared', () => this._onSelectionChanged([]));
            this.canvas.on('object:moving', (e) => { if (e.target && e.target.maskId) this._syncMaskLabel(e.target); });
            this.canvas.on('object:scaling', (e) => { if (e.target && e.target.maskId) this._syncMaskLabel(e.target); });
            this.canvas.on('object:rotating', (e) => { if (e.target && e.target.maskId) this._syncMaskLabel(e.target); });
            this.canvas.on('object:modified', (e) => { if (e.target && e.target.maskId) this._syncMaskLabel(e.target); });

            // Avoid inline-element whitespace artefacts
            this.canvasEl.style.display = 'block';
        }

        /** 
         * DOM / UI bindings
         * @private
         */
        _bindEvents() {
            // Click anywhere on the upload area opens the native file dialog
            this._bindIfExists('uploadArea', 'click', () => document.getElementById(this.elements.imageInput)?.click());
            // File-input change
            const inputEl = document.getElementById(this.elements.imageInput);
            if (inputEl) {
                inputEl.addEventListener('change', (e) => {
                    const f = e.target.files && e.target.files[0];
                    if (f) this._loadImageFile(f);
                });
            }
            // Zoom & reset
            this._bindIfExists('zoomInBtn', 'click', () => this.scaleImage(this.currentScale + this.options.scaleStep));
            this._bindIfExists('zoomOutBtn', 'click', () => this.scaleImage(this.currentScale - this.options.scaleStep));
            this._bindIfExists('resetBtn', 'click', () => { this.reset(); });
            // Mask management
            this._bindIfExists('addMaskBtn', 'click', () => this.addMask());
            this._bindIfExists('removeMaskBtn', 'click', () => this.removeSelectedMask());
            this._bindIfExists('removeAllMasksBtn', 'click', () => this.removeAllMasks());
            // Merge + download
            this._bindIfExists('mergeBtn', 'click', () => this.merge());
            this._bindIfExists('downloadBtn', 'click', () => this.downloadImage());
            // Undo + Redo
            this._bindIfExists('undoBtn', 'click', () => this.undo());
            this._bindIfExists('redoBtn', 'click', () => this.redo());

            // Rotation buttons (step can be overridden by two input fields)
            const rotLeftBtn = document.getElementById(this.elements.rotateLeftBtn);
            const rotRightBtn = document.getElementById(this.elements.rotateRightBtn);
            if (rotLeftBtn) rotLeftBtn.addEventListener('click', () => {
                const el = document.getElementById(this.elements.rotationLeftInput);
                let step = this.options.rotationStep;
                if (el) { const p = parseFloat(el.value); if (!isNaN(p)) step = p; }
                this.rotateImage(this.currentRotation - step);
            });
            if (rotRightBtn) rotRightBtn.addEventListener('click', () => {
                const el = document.getElementById(this.elements.rotationRightInput);
                let step = this.options.rotationStep;
                if (el) { const p = parseFloat(el.value); if (!isNaN(p)) step = p; }
                this.rotateImage(this.currentRotation + step);
            });
        }

        /** 
         * Event binding element check
         * 
         * @param {*} event 
         * @param {*} handler 
         * @param {*} key 
         * @private
         */
        _bindIfExists(key, event, handler) {
            const el = document.getElementById(this.elements[key]);
            if (el) {
                el.addEventListener(event, handler);
                this._boundHandlers = this._boundHandlers || {};
                if (!this._boundHandlers[key]) this._boundHandlers[key] = [];
                this._boundHandlers[key].push({ event, handler });
            }
        }

        /** 
         * Image loading helpers
         * 
         * @param {File} file 
         * @private
         */
        _loadImageFile(file) {
            if (!file || !file.type.startsWith('image/')) return;
            const reader = new FileReader();
            reader.onload = (e) => this.loadImage(e.target.result);
            reader.onerror = (e) => { console.error(`[ImageEditor: fileReadError]`, e); }
            reader.readAsDataURL(file);
        }

        /**
        * Load a base64 encoded image string into fabric.
        * @async
        * @param {String} base64 
        */
        async loadImage(base64) {
            if (!this._fabricLoaded) return;
            if (!base64 || typeof base64 !== 'string' || !base64.startsWith('data:image/')) return;

            this._setPlaceholderVisible(false);

            const imgEl = await this._createImageElement(base64);

            let loadSrc = base64;
            if (this.options.downsampleOnLoad) {
                const needResize =
                    imgEl.naturalWidth > this.options.downsampleMaxWidth ||
                    imgEl.naturalHeight > this.options.downsampleMaxHeight;
                if (needResize) {
                    const ratio = Math.min(
                        this.options.downsampleMaxWidth / imgEl.naturalWidth,
                        this.options.downsampleMaxHeight / imgEl.naturalHeight
                    );
                    const tw = Math.round(imgEl.naturalWidth * ratio);
                    const th = Math.round(imgEl.naturalHeight * ratio);
                    loadSrc = this._resampleImageToDataURL(imgEl, tw, th, this.options.downsampleQuality);
                }
            }

            // Create fabric.Image from URL
            fabric.Image.fromURL(loadSrc, (fimg) => {
                this.canvas.discardActiveObject();
                this._hideAllMaskLabels();
                this.canvas.clear();
                this.canvas.setBackgroundColor(this.options.backgroundColor, this.canvas.renderAll.bind(this.canvas));

                fimg.set({ originX: 'left', originY: 'top', selectable: false, evented: false });

                const imgW = fimg.width;
                const imgH = fimg.height;

                const minW = this.containerEl ? Math.floor(this.containerEl.clientWidth || this.options.canvasWidth) : this.options.canvasWidth;
                const minH = this.containerEl ? Math.floor(this.containerEl.clientHeight || this.options.canvasHeight) : this.options.canvasHeight;

                if (this.options.fitImageToCanvas) {
                    // Fit into current canvas (shrink only)
                    const cw = Math.max(this.options.canvasWidth, minW);
                    const ch = Math.max(this.options.canvasHeight, minH);
                    this._setCanvasSizeInt(cw, ch);
                    const fitScale = Math.min(cw / imgW, ch / imgH, 1);
                    fimg.set({ left: (cw - imgW * fitScale) / 2, top: (ch - imgH * fitScale) / 2 });
                    fimg.scale(fitScale);
                    this.baseImageScale = fimg.scaleX || 1;
                } else if (this.options.expandCanvasToImage) {
                    // Expand canvas so that it fully contains the image
                    const cw = Math.max(minW, Math.floor(imgW));
                    const ch = Math.max(minH, Math.floor(imgH));
                    this._setCanvasSizeInt(cw, ch);
                    fimg.set({ left: 0, top: 0 });
                    fimg.scale(1);
                    this.baseImageScale = 1;
                } else {
                    // Keep existing canvas size and center the image
                    const cw = Math.max(this.options.canvasWidth, minW);
                    const ch = Math.max(this.options.canvasHeight, minH);
                    this._setCanvasSizeInt(cw, ch);
                    const fitScale = Math.min(cw / imgW, ch / imgH, 1);
                    fimg.set({ left: (cw - imgW * fitScale) / 2, top: (ch - imgH * fitScale) / 2 });
                    fimg.scale(fitScale);
                    this.baseImageScale = fimg.scaleX || 1;
                }
                // Put the image onto the canvas
                this.originalImage = fimg;
                this.canvas.add(fimg);
                this.canvas.sendToBack(fimg);

                // Reset mask placement memory
                this._lastMaskInitialLeft = null;
                this._lastMaskInitialTop = null;
                this._lastMaskInitialWidth = null;

                this.maskCounter = 0;
                this.currentScale = 1;
                this.currentRotation = 0;

                this._updateInputs();
                this._updateMaskList();
                this._updateUI();
                this.canvas.renderAll();
                this.isImageLoadedToCanvas = true;

                if (typeof this.onImageLoaded === 'function') {
                    this.onImageLoaded();
                }
            }, { crossOrigin: 'anonymous' });
        }

        /**
         * Checks whether there is a loaded image on the current canvas.
         * @returns {boolean} true if loaded, false if not
         */
        isImageLoaded() {
            return !!(
                this.originalImage &&
                this.originalImage instanceof fabric.Image &&
                this.originalImage.width > 0 &&
                this.originalImage.height > 0
            );
        }

        /**
         * Creates an HTMLImageElement from a given data URL.
         * 
         * @param {string} dataURL - A data URL representing the image (e.g., "data:image/png;base64,...").
         * @returns {Promise<HTMLImageElement>} A promise that resolves to the created image element when loaded, or rejects on error.
         * @private
         */
        _createImageElement(dataURL) {
            return new Promise((res, rej) => {
                const img = new Image();
                img.onload = () => {
                    img.onload = null;
                    img.onerror = null;
                    res(img);
                };
                img.onerror = (e) => {
                    img.onload = null;
                    img.onerror = null;
                    rej(e);
                };
                img.src = dataURL;
            });
        }

        /**
         * Resamples the given image element to a new width and height and returns the result as a JPEG data URL.
         * 
         * @param {HTMLImageElement} imgEl - The image element to resample.
         * @param {number} w - Target width (in pixels) for the resampled image.
         * @param {number} h - Target height (in pixels) for the resampled image.
         * @param {number} [quality=0.92] - JPEG image quality between 0 and 1 (optional, default 0.92).
         * @returns {string} A data URL representing the resampled image as JPEG.
         * @private
         */
        _resampleImageToDataURL(imgEl, w, h, quality = 0.92) {
            const oc = document.createElement('canvas');
            oc.width = w;
            oc.height = h;
            const ctx = oc.getContext('2d');
            ctx.drawImage(imgEl, 0, 0, imgEl.naturalWidth, imgEl.naturalHeight, 0, 0, w, h);
            return oc.toDataURL('image/jpeg', quality);
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
            // Set fabric internal and also style attributes to keep DOM consistent
            this.canvas.setWidth(iw);
            this.canvas.setHeight(ih);
            if (typeof this.canvas.calcOffset === 'function') this.canvas.calcOffset();
            // Keep DOM element in sync (avoid fractional CSS pixels)
            if (this.canvasEl) {
                this.canvasEl.style.width = iw + 'px';
                this.canvasEl.style.height = ih + 'px';
                this.canvasEl.style.maxWidth = 'none';
            }
        }

        /** 
         * Gets the top-left corner coordinates of the given object.
         * Used for geometry calculations (e.g., scale, rotate).
         * 
         * @param {Object} obj - The object for which to get the top-left coordinates. Should support setCoords and getCoords/getBoundingRect methods.
         * @returns {{x: number, y: number}} The top-left corner point as an object with x and y properties.
         * @private
         */
        _getObjectTopLeftPoint(obj) {
            if (!obj) return { x: 0, y: 0 };
            obj.setCoords();
            const coords = typeof obj.getCoords === 'function' ? obj.getCoords() : null;
            if (coords && coords.length) return coords[0];
            const br = obj.getBoundingRect(true, true);
            return { x: br.left, y: br.top };
        }

        /**
         * Sets the object's origin at the specified origin point, keeping a reference point fixed in position.
         * 
         * @param {Object} obj - The object to modify. Should support set, setPositionByOrigin, and setCoords.
         * @param {string} originX - The new originX ("left", "center", "right", etc.).
         * @param {string} originY - The new originY ("top", "center", "bottom", etc.).
         * @param {{x: number, y: number}} refPoint - The point to keep fixed while setting the new origins.
         * @private
         */
        _setObjectOriginKeepingPosition(obj, originX, originY, refPoint) {
            if (!obj || !refPoint || !obj.setPositionByOrigin) return;
            obj.set({ originX, originY });
            obj.setPositionByOrigin(refPoint, originX, originY);
            obj.setCoords();
        }

        /**
         * Moves the object so its bounding box aligns with the canvas's top-left corner (0, 0).
         * 
         * @param {Object} obj - The object to align.
         * @private
         */
        _alignObjectBoundingBoxToCanvasTopLeft(obj) {
            if (!obj) return;
            obj.setCoords();
            const br = obj.getBoundingRect(true, true);
            const dx = br.left;
            const dy = br.top;
            obj.set({ left: (obj.left || 0) - dx, top: (obj.top || 0) - dy });
            obj.setCoords();
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
            const br = this.originalImage.getBoundingRect(true, true);

            // Container integer sizes
            const containerW = this.containerEl ? Math.ceil(this.containerEl.clientWidth || 0) : 0;
            const containerH = this.containerEl ? Math.ceil(this.containerEl.clientHeight || 0) : 0;

            // If image smaller or equal than container in BOTH dims => keep canvas equal to container
            if (containerW > 0 && containerH > 0 && br.width <= containerW && br.height <= containerH) {
                this._setCanvasSizeInt(containerW, containerH);
                return;
            }

            // Else canvas follows image bounding box but not smaller than container dims individually
            const newW = Math.max(containerW || 0, Math.floor(br.width));
            const newH = Math.max(containerH || 0, Math.floor(br.height));
            this._setCanvasSizeInt(newW, newH);
        }

        /** 
         * Scales the original image by a given factor, with animation.
         * Returns a promise that resolves when the scale animation is complete.
         * @param {number} factor - The scaling factor (will be clamped between `options.minScale` and `options.maxScale`).
         * @returns {Promise<void>} Promise that resolves once the scaling animation finishes.
         * @public
         */
        scaleImage(factor) {
            return this.animQueue.add(() => this._scaleImageImpl(factor));
        }

        /** 
         * Scales the original image by a given factor, with animation.
         * Returns a promise that resolves when the scale animation is complete.
         * @param {number} factor - The scaling factor (will be clamped between `options.minScale` and `options.maxScale`).
         * @returns {Promise<void>} Promise that resolves once the scaling animation finishes.
         * @private
         */
        _scaleImageImpl(factor) {
            if (!this.originalImage) return Promise.resolve();
            if (this.isAnimating) return Promise.resolve();
            factor = Math.max(this.options.minScale, Math.min(this.options.maxScale, factor));
            this.currentScale = factor;
            this.isAnimating = true;
            this._updateUI();

            const targetAbs = this.baseImageScale * factor;

            // Scale around current top-left (recompute)
            const topLeft = this._getObjectTopLeftPoint(this.originalImage);
            this._setObjectOriginKeepingPosition(this.originalImage, 'left', 'top', topLeft);

            const p1 = new Promise((res) => {
                this.originalImage.animate('scaleX', targetAbs, {
                    duration: this.options.animationDuration,
                    onChange: this.canvas.renderAll.bind(this.canvas),
                    onComplete: res
                });
            });
            const p2 = new Promise((res) => {
                this.originalImage.animate('scaleY', targetAbs, {
                    duration: this.options.animationDuration,
                    onChange: this.canvas.renderAll.bind(this.canvas),
                    onComplete: res
                });
            });

            return Promise.all([p1, p2]).then(() => {
                this.originalImage.set({ scaleX: targetAbs, scaleY: targetAbs });
                this.originalImage.setCoords();

                if (this.options.expandCanvasToImage) this._updateCanvasSizeToImageBounds();

                this._alignObjectBoundingBoxToCanvasTopLeft(this.originalImage);

                // Sync mask labels
                this.canvas.getObjects().forEach(o => { if (o.maskId) this._syncMaskLabel(o); });

                this.isAnimating = false;
                this._updateInputs();
                this._updateUI();
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
        rotateImage(deg) {
            return this.animQueue.add(() => this._rotateImageImpl(deg));
        }

        /** 
         * Rotates the original image by a given number of degrees, with animation.
         * Returns a promise that resolves when the rotation animation is complete.
         * @param {number} degrees - The angle in degrees to rotate the image.
         * @returns {Promise<void>} Promise that resolves once the rotation animation finishes.
         * @private
         */
        _rotateImageImpl(degrees) {
            if (!this.originalImage) return Promise.resolve();
            if (this.isAnimating) return Promise.resolve();
            if (isNaN(degrees)) return Promise.resolve();
            this.currentRotation = degrees;
            this.isAnimating = true;
            this._updateUI();

            const center = this.originalImage.getCenterPoint();
            this._setObjectOriginKeepingPosition(this.originalImage, 'center', 'center', center);

            const p = new Promise((res) => {
                this.originalImage.animate('angle', degrees, {
                    duration: this.options.animationDuration,
                    onChange: this.canvas.renderAll.bind(this.canvas),
                    onComplete: res
                });
            });

            return p.then(() => {
                this.originalImage.set('angle', degrees);
                this.originalImage.setCoords();

                if (this.options.expandCanvasToImage) this._updateCanvasSizeToImageBounds();

                this._alignObjectBoundingBoxToCanvasTopLeft(this.originalImage);

                const newTopLeft = this._getObjectTopLeftPoint(this.originalImage);
                this._setObjectOriginKeepingPosition(this.originalImage, 'left', 'top', newTopLeft);

                // Sync mask labels
                this.canvas.getObjects().forEach(o => { if (o.maskId) this._syncMaskLabel(o); });

                this.isAnimating = false;
                this._updateInputs();
                this._updateUI();
                this.saveState();
            }).catch(() => {
                this.isAnimating = false;
                this._updateUI();
            });
        }

        /**
         * Resets the image: scales to 1 and rotates to 0 degrees.
         * @returns {Promise<void>} Promise that resolves when reset is complete.
         */
        reset() {
            if (!this.originalImage) return Promise.resolve();

            return this.scaleImage(1)
                .then(() => this.rotateImage(0))
                .then(() => {
                    this.saveState();
                })
                .catch(err => {
                    console.error('reset() failed', err);
                });
        }

        /**
         * Restores a canvas state that was previously stored by saveState().
         * @param {string} jsonString - the JSON string returned by fabric.toJSON().
         */
        loadFromState(jsonString) {
            if (!jsonString || !this.canvas) return;

            try {
                const json = (typeof jsonString === 'string')
                    ? JSON.parse(jsonString)
                    : jsonString;

                this.canvas.loadFromJSON(json, () => {
                    this._hideAllMaskLabels();
                    const objs = this.canvas.getObjects();
                    this.originalImage = objs.find(o => o.type === 'image' && !o.maskId) || null;

                    this.originalImage.set({ originX: 'left', originY: 'top', selectable: false, evented: false, hasControls: false, hoverCursor: 'default' });
                    this.canvas.sendToBack(this.originalImage);

                    const masks = objs.filter(o => o.maskId);
                    this.maskCounter = masks.reduce((max, m) =>
                        Math.max(max, m.maskId), 0);

                    this.canvas.renderAll();
                    this._updateMaskList();
                    this._updateUI();
                });

            } catch (e) {
                console.error('loadFromState() failed', e);
            }
        }

        /**
         * Saves the current state of the canvas to history, storing any mask/raster label information.
         */
        saveState() {
            if (!this.canvas) return;
            const activeObj = this.canvas.getActiveObject();
            this._hideAllMaskLabels();
            const after = JSON.stringify(this.canvas.toJSON(['maskId', 'maskName']));
            const before = this._lastSnapshot || after;
            let executedOnce = false;

            const cmd = new Command(
                () => {
                    if (executedOnce) {
                        // this.canvas.clear();
                        this.loadFromState(after);
                    }
                    executedOnce = true;
                },
                () => {
                    // this.canvas.clear();
                    this.loadFromState(before);
                }
            );

            this.historyManager.execute(cmd);
            this._lastSnapshot = after;
            if (activeObj && activeObj.maskId) {
                this._showLabelForMask(activeObj);
            }
            this._updateUI();
        }

        /**
         * Undo the last state change, if possible.
         */
        undo() {
            this.historyManager.undo();
        }

        /**
         * Redo the next state change, if possible.
         */
        redo() {
            this.historyManager.redo();
        }

        /** 
         * Adds a rectangular mask to the canvas.
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
         *   @param {function} [config.fabricGenerator] - (cfg) => new FabricObj
         * @returns {fabric.Rect|null} The created mask object, or null if canvas is not available.
         * @public
         */
        addMask(config = {}) {
            if (!this.canvas) return null;
            const shapeType = config.shape || 'rect';
            // Default config
            const cfg = {
                shape: shapeType,
                width: this.options.defaultMaskWidth,
                height: this.options.defaultMaskHeight,
                color: 'rgba(0,0,0,0.5)',
                alpha: 0.5,
                gap: 5,
                left: undefined,
                top: undefined,
                angle: 0,
                selectable: true,
                ...config
            };

            // Always start placement relative to canvas left/top.
            const firstOffset = 10;
            let left = firstOffset;
            let top = firstOffset;

            const resolveValue = (val, fallback) => {
                if (typeof val === 'function')
                    return val(this.canvas, this.options); // This context is this of addMask
                if (typeof val === 'string' && val.endsWith('%')) {
                    const percent = parseFloat(val) / 100;
                    return Math.floor((this.canvas ? this.canvas.getWidth() : 0) * percent);
                }
                return val != null ? val : fallback;
            }

            if (cfg.left === undefined && this._lastMask) {
                const prev = this._lastMask;
                let prevRight = prev.left;

                if (prev.getScaledWidth) {
                    prevRight += prev.getScaledWidth();
                } else if (prev.width) {
                    prevRight += prev.width * (prev.scaleX ?? 1);
                }
                left = Math.round(prevRight + cfg.gap);
                top = prev.top ?? firstOffset;
            } else {
                left = resolveValue(cfg.left, firstOffset);
                top = resolveValue(cfg.top, firstOffset);
            }

            cfg.width = resolveValue(cfg.width, this.options.defaultMaskWidth);
            cfg.height = resolveValue(cfg.height, this.options.defaultMaskHeight);

            // If expandCanvasToImage mode, ensure canvas large enough to hold mask initial placement
            if (this.options.expandCanvasToImage && shapeType === 'rect') {
                const requiredW = Math.ceil(left + cfg.width + 10);
                const requiredH = Math.ceil(top + cfg.height + 10);
                const minW = this.containerEl ? Math.floor(this.containerEl.clientWidth || 0) : 0;
                const minH = this.containerEl ? Math.floor(this.containerEl.clientHeight || 0) : 0;
                const newW = Math.max(this.canvas.getWidth(), minW, requiredW);
                const newH = Math.max(this.canvas.getHeight(), minH, requiredH);
                this._setCanvasSizeInt(newW, newH);
            }

            let mask;
            if (typeof cfg.fabricGenerator === 'function') {
                mask = cfg.fabricGenerator(cfg, this.canvas, this.options);
            } else {
                switch (shapeType) {
                    case 'circle':
                        mask = new fabric.Circle({
                            left, top,
                            radius: resolveValue(cfg.radius, Math.min(cfg.width, cfg.height) / 2),
                            fill: cfg.color,
                            opacity: cfg.alpha,
                            angle: cfg.angle,
                            ...cfg.styles
                        });
                        break;
                    case 'ellipse':
                        mask = new fabric.Ellipse({
                            left, top,
                            rx: resolveValue(cfg.rx, cfg.width / 2),
                            ry: resolveValue(cfg.ry, cfg.height / 2),
                            fill: cfg.color,
                            opacity: cfg.alpha,
                            angle: cfg.angle,
                            ...cfg.styles
                        });
                        break;
                    case 'polygon':
                        let polyPoints = cfg.points || [];
                        if (Array.isArray(polyPoints) && polyPoints.length && typeof polyPoints[0] === 'object') {
                            // Ensure numeric {x,y} objects for fabric.Polygon
                            polyPoints = polyPoints.map(pt => ({ x: Number(pt.x), y: Number(pt.y) }));
                        }
                        mask = new fabric.Polygon(polyPoints, {
                            left, top,
                            fill: cfg.color,
                            opacity: cfg.alpha,
                            angle: cfg.angle,
                            ...cfg.styles
                        });
                        break;
                    case 'rect':
                    default:
                        mask = new fabric.Rect({
                            left, top,
                            width: resolveValue(cfg.width, this.options.defaultMaskWidth),
                            height: resolveValue(cfg.height, this.options.defaultMaskHeight),
                            fill: cfg.color,
                            opacity: cfg.alpha,
                            angle: cfg.angle,
                            rx: cfg.rx, // Rounded Corners
                            ry: cfg.ry,
                            ...cfg.styles
                        });
                }
            }

            mask.selectable = cfg.selectable !== false;
            mask.hasControls = ('hasControls' in cfg) ? cfg.hasControls : true;
            mask.lockRotation = !this.options.maskRotatable;
            mask.borderColor = cfg.borderColor || 'red';
            mask.cornerColor = cfg.cornerColor || 'black';
            mask.cornerSize = cfg.cornerSize || 8;
            mask.transparentCorners = ('transparentCorners' in cfg) ? cfg.transparentCorners : false;
            mask.stroke = (cfg.styles && cfg.styles.stroke) || '#ccc';
            mask.strokeWidth = (cfg.styles && cfg.styles.strokeWidth) || 1;
            mask.strokeUniform = ('strokeUniform' in cfg) ? cfg.strokeUniform : true;
            if (cfg.styles && cfg.styles.strokeDashArray) mask.strokeDashArray = cfg.styles.strokeDashArray;

            mask.originalAlpha = cfg.alpha;
            const normalStyle = { stroke: mask.stroke, strokeWidth: mask.strokeWidth, opacity: mask.originalAlpha };
            const hoverStyle = { stroke: '#ff5500', strokeWidth: 2, opacity: Math.min(mask.originalAlpha + 0.2, 1) };

            mask.on('mouseover', () => {
                mask.set(hoverStyle);
                mask.canvas.requestRenderAll();
            });

            mask.on('mouseout', () => {
                mask.set(normalStyle);
                mask.canvas.requestRenderAll();
            });

            // Remember initial for next one
            this._lastMaskInitialLeft = left;
            this._lastMaskInitialTop = top;
            this._lastMaskInitialWidth = resolveValue(cfg.width, this.options.defaultMaskWidth);

            mask.maskId = ++this.maskCounter;
            mask.maskName = `${this.options.maskName}${mask.maskId}`;
            this._lastMask = mask;

            this.canvas.add(mask);
            this.canvas.bringToFront(mask);
            if (cfg.selectable) this.canvas.setActiveObject(mask);
            this._onSelectionChanged([mask]);
            this._updateMaskList();
            this._updateUI();
            this.canvas.renderAll();
            this.saveState();

            if (typeof cfg.onCreate === 'function') cfg.onCreate(mask, this.canvas);
            return mask;
        }

        /**
         * Removes the currently selected mask from the canvas, if any.
         * The associated label is also removed. UI and mask list are updated.
         */
        removeSelectedMask() {
            const active = this.canvas.getActiveObject();
            if (!active || !active.maskId) return;
            this._removeLabelForMask(active);
            this.canvas.remove(active);
            this.canvas.discardActiveObject();
            this._updateMaskList();
            this._updateUI();
            this.canvas.renderAll();
            this.saveState();
        }

        /**
         * Removes all masks from the canvas, including their labels.
         * UI and internal mask placement memory are reset.
         */
        removeAllMasks() {
            const masks = this.canvas.getObjects().filter(o => o.maskId);
            masks.forEach(m => this._removeLabelForMask(m));
            masks.forEach(m => this.canvas.remove(m));
            this.canvas.discardActiveObject();
            this._lastMaskInitialLeft = null;
            this._lastMaskInitialTop = null;
            this._lastMaskInitialWidth = null;
            this._updateMaskList();
            this._updateUI();
            this.canvas.renderAll();
            this.saveState();
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
                    const objs = this.canvas.getObjects();
                    if (objs.includes(mask.__label)) {
                        this.canvas.remove(mask.__label);
                    }
                } catch (e) { /* ignore */ }
                try { delete mask.__label; } catch (e) { }
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
            if (!mask || !this.options.maskLabelOnSelect) return;
            this._removeLabelForMask(mask);
            let textObj = null;
            if (this.options.label && typeof this.options.label.create === 'function') {
                textObj = this.options.label.create(mask, fabric);
            }
            if (!textObj) {
                let txt = mask.maskName; // Default
                let textOptions = {
                    left: 0,
                    top: 0,
                    fontSize: 12,
                    fill: '#fff',
                    backgroundColor: 'rgba(0,0,0,0.7)',
                    selectable: false,
                    evented: false,
                    padding: 2,
                    originX: 'left',
                    originY: 'top'
                };
                if (this.options.label) {
                    if (typeof this.options.label.getText === 'function') {
                        txt = this.options.label.getText(mask, this.maskCounter);
                    }
                    // Merge external styles
                    if (this.options.label.textOptions) {
                        Object.assign(textOptions, this.options.label.textOptions);
                    }
                }
                textObj = new fabric.Text(txt, textOptions);
            }

            textObj.maskLabel = true;
            mask.__label = textObj;
            this.canvas.add(textObj);
            this.canvas.bringToFront(textObj);
            this._syncMaskLabel(mask);
        }

        /**
         * Hides (removes) all mask labels from the canvas.
         * Internal label references on mask objects are also deleted.
         * @private
         */
        _hideAllMaskLabels() {
            if (!this.canvas) return;
            const objs = this.canvas.getObjects();
            const labels = objs.filter(o => o.maskLabel);
            labels.forEach(l => {
                try {
                    if (objs.includes(l)) this.canvas.remove(l);
                } catch (e) { }
            });
            objs.forEach(o => { if (o.maskId && o.__label) { try { delete o.__label; } catch (e) { } } });
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

            const coords = mask.getCoords ? mask.getCoords() : null;
            if (!coords || coords.length < 4) return;

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
                originX: 'left',
                originY: 'top',
                visible: true
            });
            mask.__label.setCoords();
            this.canvas.renderAll();
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
            mask.__label.visible = true;
            this._syncMaskLabel(mask);
        }

        /**
         * Handles changes to the selection of canvas objects (masks),
         * updates mask stroke and label display, and syncs mask list selection.
         *
         * @param {Array<Object>} selected - The currently selected objects (e.g. [mask] or []).
         * @private
         */
        _onSelectionChanged(selected) {
            const selectedMask = (selected || []).find(o => o.maskId);
            const masks = this.canvas.getObjects().filter(o => o.maskId);
            masks.forEach(m => {
                if (m !== selectedMask) {
                    if (m.__label) {
                        try { this.canvas.remove(m.__label); } catch (e) { }
                        delete m.__label;
                    }
                    m.set({ stroke: '#ccc', strokeWidth: 1 });
                } else {
                    m.set({ stroke: '#ff0000', strokeWidth: 1 });
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
            const listEl = document.getElementById(this.elements.maskList);
            if (!listEl) return;
            listEl.innerHTML = '';
            const masks = this.canvas.getObjects().filter(o => o.maskId);
            masks.forEach(mask => {
                const li = document.createElement('li');
                li.className = 'list-group-item mask-item';
                li.textContent = mask.maskName;
                li.onclick = () => { this.canvas.setActiveObject(mask); this._onSelectionChanged([mask]); };
                listEl.appendChild(li);
            });
        }

        /**
         * Updates the visual selection (CSS 'active') state for the mask list in the DOM.
         * 
         * @param {Object|null} selectedMask - The currently selected mask, or null if none selected.
         * @private
         */
        _updateMaskListSelection(selectedMask) {
            const listEl = document.getElementById(this.elements.maskList);
            if (!listEl) return;
            const items = listEl.querySelectorAll('.mask-item');
            items.forEach(item => {
                const isSelected = !!selectedMask && item.textContent === selectedMask.maskName;
                item.classList.toggle('active', isSelected);
            });
        }

        /**
         * Merges current masks into the image: exports a masked/cropped image, removes all masks, and re-imports the merged image.
         * Will not run if no original image or no masks exist.
         * @async
         * @returns {Promise<void>} Resolves when merge and load are complete.
         */
        async merge() {
            if (!this.originalImage) return;
            const masks = this.canvas.getObjects().filter(o => o.maskId);
            if (!masks.length) return;

            this.canvas.discardActiveObject();
            this.canvas.renderAll();

            try {
                const merged = await this.getImageBase64({ exportImageArea: true, multiplier: this.options.exportMultiplier });
                this.removeAllMasks();
                await this.loadImage(merged);
                this.saveState();
            } catch (err) {
                console.error('merge error', err);
                if (this.canvasEl) this.canvasEl.style.visibility = '';
            }
        }

        /**
         * Triggers a JPEG image download of the current canvas (image plus masks if configured).
         * The image area and multiplier are controlled by options.
         * @param {string} [fileName=this.options.defaultDownloadFileName] - Desired download file name.
         */
        downloadImage(fileName = this.options.defaultDownloadFileName) {
            if (!this.originalImage) return;
            const exportImageArea = this.options.exportImageAreaByDefault;
            this.getImageBase64({ exportImageArea, multiplier: this.options.exportMultiplier })
                .then(base64 => {
                    const link = document.createElement('a');
                    link.download = fileName;
                    link.href = base64;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                })
                .catch(err => console.error('download error', err));
        }

        /**
         * Exports the image as a Base64-encoded JPEG.
         * Can export either the original, or the current view including masks (clipped/cropped).
         * Will restore masks' state after temporary modifications for export.
         * @async
         * @param {Object} [opts={}] - Export options.
         * @param {boolean} [opts.exportImageArea] - If true, exports only the image bounding area with masks cropped and blended.
         * @param {number} [opts.multiplier=1] - Scaling multiplier for output (resolution).
         * @returns {Promise<string>} Promise resolving to a JPEG image data URL.
         * @throws {Error} If there is no image loaded.
         */
        async getImageBase64(opts = {}) {
            if (!this.originalImage) throw new Error('No image loaded');
            const exportImageArea = typeof opts.exportImageArea === 'boolean' ? opts.exportImageArea : this.options.exportImageAreaByDefault;
            const multiplier = opts.multiplier || this.options.exportMultiplier || 1;

            if (!exportImageArea) {
                // Export original image pixels
                const imgEl = this.originalImage.getElement ? this.originalImage.getElement() : (this.originalImage._element || null);
                if (!imgEl) return this.canvas.toDataURL({ format: 'jpeg', quality: this.options.downsampleQuality, multiplier });
                const w = this.originalImage.width;
                const h = this.originalImage.height;
                const oc = document.createElement('canvas');
                oc.width = w;
                oc.height = h;
                const ctx = oc.getContext('2d');
                ctx.drawImage(imgEl, 0, 0, w, h);
                return oc.toDataURL('image/jpeg', this.options.downsampleQuality);
            }

            // Export current scaled image area (masks clipped)
            const masks = this.canvas.getObjects().filter(o => o.maskId);
            const masksBackup = masks.map(m => ({
                obj: m,
                opacity: m.opacity,
                fill: m.fill,
                strokeWidth: m.strokeWidth,
                stroke: m.stroke,
                selectable: m.selectable,
                lockRotation: m.lockRotation
            }));

            // Remove labels, deselect
            masks.forEach(m => this._removeLabelForMask(m));
            this.canvas.discardActiveObject();
            this.canvas.renderAll();

            // Set masks to opaque black no border
            masks.forEach(m => {
                m.set({ opacity: 1, fill: '#000000', strokeWidth: 0, stroke: null, selectable: false });
                m.setCoords();
            });
            this.canvas.renderAll();

            // Compute integer bounding box for image
            this.originalImage.setCoords();
            const imgBr = this.originalImage.getBoundingRect(true, true);
            const sx = Math.max(0, Math.round(imgBr.left));
            const sy = Math.max(0, Math.round(imgBr.top));
            const sw = Math.max(1, Math.round(imgBr.width));
            const sh = Math.max(1, Math.round(imgBr.height));

            // Crop precisely in offscreen canvas
            const finalBase64 = await new Promise((resolve, reject) => {
                try {
                    const fullDataUrl = this.canvas.toDataURL({
                        format: 'jpeg',
                        quality: this.options.downsampleQuality,
                        multiplier: multiplier
                    });

                    const img = new Image();
                    img.onload = () => {
                        try {
                            const sxM = Math.round(sx * multiplier);
                            const syM = Math.round(sy * multiplier);
                            const swM = Math.round(sw * multiplier);
                            const shM = Math.round(sh * multiplier);

                            const oc = document.createElement('canvas');
                            oc.width = swM;
                            oc.height = shM;
                            const ctx = oc.getContext('2d');

                            ctx.drawImage(img, sxM, syM, swM, shM, 0, 0, swM, shM);
                            const out = oc.toDataURL('image/jpeg', this.options.downsampleQuality);
                            resolve(out);
                        } catch (e) { reject(e); }
                    };
                    img.onerror = reject;
                    img.src = fullDataUrl;
                } catch (e) { reject(e); }
            });

            // Restore masks
            masksBackup.forEach(b => {
                try {
                    b.obj.set({
                        opacity: b.opacity,
                        fill: b.fill,
                        strokeWidth: b.strokeWidth,
                        stroke: b.stroke,
                        selectable: b.selectable,
                        lockRotation: b.lockRotation
                    });
                    b.obj.setCoords();
                } catch (e) { }
            });

            this.canvas.renderAll();
            return finalBase64;
        }

        /**
         * Exports the current canvas (with or without masks) as a File object.
         * Allows you to choose whether to merge masks and specify file type (jpeg/png/webp).
         * 
         * @async
         * @param {Object} [opts={}] - Export options.
         * @param {boolean} [opts.mergeMask=true] - If true, export image area with masks merged; if false, export the plain image without masks.
         * @param {string} [opts.fileType='jpeg'] - Output file type ('jpeg' | 'png' | 'webp'). Defaults to 'jpeg' on invalid input.
         * @param {number} [opts.quality=0.92] - Image quality for lossy types (0-1, default based on options.downsampleQuality).
         * @param {number} [opts.multiplier=1] - Output resolution multiplier.
         * @param {string} [opts.fileName] - Optional file name (only used for download).
         * @returns {Promise<File>} Resolves with the exported image as a File object.
         * 
         * @example
         *   const file = await this.exportImageFile({ mergeMask: false, fileType: 'png' });
         */
        async exportImageFile(opts = {}) {
            if (!this.originalImage) throw new Error('No image loaded');
            const {
                mergeMask = true,
                fileType = 'jpeg',
                quality = this.options.downsampleQuality ?? 0.92,
                multiplier = this.options.exportMultiplier ?? 1,
                fileName = this.options.defaultDownloadFileName ?? 'exported_image.jpg'
            } = opts;

            const typeMapping = {
                'jpeg': 'jpeg',
                'jpg': 'jpeg',
                'image/jpeg': 'jpeg',
                'png': 'png',
                'image/png': 'png',
                'webp': 'webp',
                'image/webp': 'webp'
            };
            const safeFileType = typeMapping[String(fileType).toLowerCase()] || 'jpeg';

            // Get Base64
            let base64;
            if (mergeMask) {
                base64 = await this.getImageBase64({
                    exportImageArea: true,
                    multiplier,
                });
            } else {
                base64 = await this.getImageBase64({
                    exportImageArea: false,
                    multiplier,
                });
            }

            // Convert to the required image format
            let imageDataUrl = base64;
            if (!imageDataUrl.startsWith(`data:image/${safeFileType}`)) {
                // Redraw if not required format
                imageDataUrl = await new Promise((resolve, reject) => {
                    const img = new window.Image();
                    img.crossOrigin = "Anonymous";
                    img.onload = () => {
                        try {
                            const oc = document.createElement('canvas');
                            oc.width = img.width;
                            oc.height = img.height;
                            const ctx = oc.getContext('2d');
                            ctx.drawImage(img, 0, 0);
                            const durl = oc.toDataURL(`image/${safeFileType}`, quality);
                            resolve(durl);
                        } catch (e) { reject(e); }
                    };
                    img.onerror = reject;
                    img.src = base64;
                });
            }

            // Convert DataURL to Blob and then to File
            const bstr = atob(imageDataUrl.split(',')[1]);
            const mime = `image/${safeFileType}`;
            let n = bstr.length;
            const u8arr = new Uint8Array(n);
            while (n--) {
                u8arr[n] = bstr.charCodeAt(n);
            }
            const file = new File([u8arr], fileName, { type: mime });
            return file;
        }

        /* ---------- Misc / UI ---------- */

        /**
         * Updates the scale input field in the UI to reflect the current scale.
         * Sets the value (as percentage) if the element is present.
         * @private
         */
        _updateInputs() {
            const scaleEl = document.getElementById(this.elements.scaleRate);
            if (scaleEl) scaleEl.value = Math.round(this.currentScale * 100);
        }

        /**
         * Updates the enabled/disabled state of various UI controls (buttons)
         * based on the current application state (image/mask presence, animation, etc).
         * @private
         */
        _updateUI() {
            const hasImg = !!this.originalImage;
            const masks = hasImg ? this.canvas.getObjects().filter(o => o.maskId) : [];
            const hasMasks = masks.length > 0;
            const active = this.canvas.getActiveObject();
            const hasSelectedMask = active && active.maskId;
            const isDefault = this.currentScale === 1 && this.currentRotation === 0;
            const canUndo = this.historyManager?.canUndo();
            const canRedo = this.historyManager?.canRedo();

            this._setDisabled('zoomInBtn', !hasImg || this.isAnimating || this.currentScale >= this.options.maxScale);
            this._setDisabled('zoomOutBtn', !hasImg || this.isAnimating || this.currentScale <= this.options.minScale);
            this._setDisabled('addMaskBtn', !hasImg || this.isAnimating);
            this._setDisabled('removeMaskBtn', !hasSelectedMask || this.isAnimating);
            this._setDisabled('removeAllMasksBtn', !hasMasks || this.isAnimating);
            this._setDisabled('mergeBtn', !hasImg || !hasMasks || this.isAnimating);
            this._setDisabled('downloadBtn', !hasImg || this.isAnimating);
            this._setDisabled('resetBtn', !hasImg || isDefault || this.isAnimating);
            this._setDisabled('undoBtn', !hasImg || this.isAnimating || !canUndo);
            this._setDisabled('redoBtn', !hasImg || this.isAnimating || !canRedo);
        }

        /**
         * Enables or disables a specific UI element (typically a button) by its key.
         * 
         * @param {string} key - Key of the element in this.elements (e.g. 'zoomInBtn').
         * @param {boolean} disabled - If true, disables the element; otherwise enables.
         * @private
         */
        _setDisabled(key, disabled) {
            const el = document.getElementById(this.elements[key]);
            if (el) el.disabled = !!disabled;
        }

        /**
         * Automatically display and hide placeholders and containers based on the current image content
         * @private
         */
        _updatePlaceholderStatus() {
            if (!this.options.showPlaceholder) return;
            this._setPlaceholderVisible(!this.originalImage);
        }

        /**
         * Controls the display/hiding of the Placeholder and Canvas container.
         * @param {boolean} show - true displays the placeholder, false displays the canvas container
         * @private
         */
        _setPlaceholderVisible(show) {
            if (!this.placeholderEl) return;
            if (show) {
                this.placeholderEl.classList.remove('d-none');
                this.placeholderEl.classList.add('d-flex');
                this.containerEl.classList.add('d-none');
            } else {
                this.placeholderEl.classList.remove('d-flex');
                this.placeholderEl.classList.add('d-none');
                this.containerEl.classList.remove('d-none');
            }
        }

        /**
         * Cleans up and disposes of the canvas and related references.
         * Call this method to free memory and remove canvas listeners when the editor is no longer needed.
         * @public
         */
        dispose() {
            // Remove bound DOM event listeners
            try {
                for (const key in (this._boundHandlers || {})) {
                    const handlers = this._boundHandlers[key] || [];
                    const el = document.getElementById(this.elements[key]);
                    if (!el) continue;
                    handlers.forEach(h => {
                        try { el.removeEventListener(h.event, h.handler); } catch (e) { }
                    });
                }
            } catch (e) { }

            if (this.canvas) {
                try { this.canvas.dispose(); } catch (e) { }
                this.canvas = null;
                this.canvasEl = null;
                this.isImageLoadedToCanvas = false;
            }
            this._boundHandlers = {};
        }
    }

    /**
     * A simple FIFO queue that guarantees animations are executed sequentially.
     * @class AnimationQueue
     */
    class AnimationQueue {
        /**
         * Creates a new AnimationQueue.
         *
         * @constructor
         */
        constructor() {
            /**
             * Internal queue holding animation descriptors.
             * @type {Array<{fn: Function, resolve: Function, reject: Function}>}
             */
            this.queue = [];
            /**
             * Flag indicating whether an animation is currently running.
             * @type {boolean}
             */
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
                // Push the animation into the queue.
                this.queue.push({ fn: animationFn, resolve, reject });
                // Start processing if it's not already running.
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
    }

    /**
     * Command object encapsulating an executable action and its corresponding undo operation.
     * @class Command
     */
    class Command {
        /**
         * @param {Function} execute  The function that performs the action.
         * @param {Function} undo     The function that reverts the action.
         */
        constructor(execute, undo) {
            /**
             * Executes the command.
             * @type {Function}
             */
            this.execute = execute;
            /**
             * Undoes the command.
             * @type {Function}
             */
            this.undo = undo;
        }
    }

    /**
     * Manages a history of Command objects enabling undo/redo functionality.
     * @class HistoryManager
     */
    class HistoryManager {
        /**
         * @param {number} [maxSize=50]  Maximum number of commands to keep in history.
         */
        constructor(maxSize = 50) {
            this.history = [];
            this.currentIndex = -1;
            this.maxSize = maxSize;
        }

        /**
         * Executes a new command and pushes it onto the history stack.
         * Truncates any "future" history when branching.
         *
         * @param {Command} command  The command to execute.
         * @returns {void}
         */
        execute(command) {
            // Perform the command.
            command.execute();

            // Remove any commands that are ahead of the current index.
            if (this.currentIndex < this.history.length - 1) {
                this.history = this.history.slice(0, this.currentIndex + 1);
            }

            // Add the new command.
            this.history.push(command);

            // Maintain the max size of the buffer.
            if (this.history.length > this.maxSize) {
                this.history.shift(); // Remove the oldest command.
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
            if (this.currentIndex >= 0) {
                this.history[this.currentIndex].undo();
                this.currentIndex--;
            }
        }

        /**
         * Redoes the next command in history if possible.
         *
         * @returns {void}
         */
        redo() {
            if (this.currentIndex < this.history.length - 1) {
                this.currentIndex++;
                this.history[this.currentIndex].execute();
            }
        }
    }

    return ImageEditor
})
