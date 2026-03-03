"use strict";
/**
 * @file image-editor.ts
 * @module image-editor
 * @version 2.0.0
 * @author Ben Situ
 * @license MIT
 * @description Lightweight canvas-based image editor built on Fabric.js v7.
 *              Provides masking, animated scale/rotate, crop, undo/redo, and export.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Fabric.js v5 → v7 migration notes (kept here for historical reference)
 * ─────────────────────────────────────────────────────────────────────────────
 *  1. Image.fromURL()           — now Promise-based; no callback parameter.
 *  2. Canvas.loadFromJSON()     — now Promise-based; no callback parameter.
 *  3. FabricObject.animate()    — returns Animation[] (NOT a Promise).
 *                                 Wrap with new Promise() + onComplete callback.
 *                                 Multi-prop animation fires onComplete per prop;
 *                                 count completions to detect full finish.
 *  4. canvas.bringToFront(o)    → canvas.bringObjectToFront(o)
 *     canvas.sendToBack(o)      → canvas.sendObjectToBack(o)
 *  5. canvas.calcOffset()       — removed; managed internally.
 *  6. canvas.setBackgroundColor(c, cb) → `canvas.backgroundColor = c`
 *  7. getBoundingRect(abs,calc) — signature removed; always returns absolute rect.
 *  8. canvas.renderAll()        — replaced with requestRenderAll() in animation loop.
 *  9. canvas.setWidth()/setHeight() → canvas.setDimensions({ width, height })
 *     CRITICAL: setDimensions keeps the upper (event) canvas in sync with the
 *     lower (render) canvas. Manual style mutation breaks pointer-event mapping.
 * 10. All new FabricObject origins now default to 'center'/'center'.
 *     Masks must declare originX:'left', originY:'top' explicitly to keep the
 *     left/top coordinate system matching the top-left corner of the shape.
 * ─────────────────────────────────────────────────────────────────────────────
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImageEditor = void 0;
const animation_queue_js_1 = require("./animation-queue.js");
const history_js_1 = require("./history.js");
const types_js_1 = require("./types.js");
// ─── ImageEditor ─────────────────────────────────────────────────────────────
/**
 * Lightweight Fabric.js v7 image editor with masking, animated transforms,
 * crop, undo/redo, and multi-format export.
 *
 * ## Quick start (ESM)
 * ```ts
 * import * as fabric from 'fabric';
 * import { ImageEditor } from 'image-editor';
 *
 * const editor = new ImageEditor(fabric, { canvasWidth: 1024, canvasHeight: 768 });
 * editor.init({ canvas: 'myCanvas' });
 * ```
 *
 * ## Quick start (CDN / `<script>` tag)
 * ```ts
 * // Assumes window.fabric is populated by a Fabric.js CDN script
 * const editor = new ImageEditor({ canvasWidth: 1024 });
 * editor.init();
 * ```
 */
class ImageEditor {
    // ═══════════════════════════════════════════════════════════════════════
    // Constructor
    // ═══════════════════════════════════════════════════════════════════════
    /**
     * @param fabricModuleOrOptions
     *   Pass the Fabric.js **module** (`import * as fabric from 'fabric'`) when
     *   using ESM, or pass the **options** object directly when using a CDN global
     *   (`window.fabric`).
     * @param options
     *   Editor options. Only used when `fabricModuleOrOptions` is the fabric module.
     */
    constructor(fabricModuleOrOptions = {}, options = {}) {
        var _a;
        // ── Fabric injection ────────────────────────────────────────────────────
        /** @internal */ Object.defineProperty(this, "_fabric", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        /** @internal */ Object.defineProperty(this, "_fabricLoaded", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        // ── Resolved options ────────────────────────────────────────────────────
        /** @internal */ Object.defineProperty(this, "options", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        // ── Canvas / DOM ────────────────────────────────────────────────────────
        /** The underlying Fabric.js Canvas instance (available after {@link init}). */
        Object.defineProperty(this, "canvas", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        /** @internal */ Object.defineProperty(this, "canvasEl", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        /** @internal */ Object.defineProperty(this, "containerEl", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        /** @internal */ Object.defineProperty(this, "placeholderEl", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        /** @internal */ Object.defineProperty(this, "elements", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: {}
        });
        // ── Image state ─────────────────────────────────────────────────────────
        /** The primary image object on the canvas (set after a successful {@link loadImage}). */
        Object.defineProperty(this, "originalImage", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        /** @internal */ Object.defineProperty(this, "baseImageScale", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 1
        });
        /** Current scale factor (1 = original size). */
        Object.defineProperty(this, "currentScale", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 1
        });
        /** Current rotation angle in degrees. */
        Object.defineProperty(this, "currentRotation", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        /** Whether a valid image is currently rendered on the canvas. */
        Object.defineProperty(this, "isImageLoadedToCanvas", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        // ── Mask state ──────────────────────────────────────────────────────────
        /** @internal */ Object.defineProperty(this, "maskCounter", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        /** @internal */ Object.defineProperty(this, "_lastMask", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        /** @internal */ Object.defineProperty(this, "_lastMaskInitialLeft", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        /** @internal */ Object.defineProperty(this, "_lastMaskInitialTop", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        /** @internal */ Object.defineProperty(this, "_lastMaskInitialWidth", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        // ── History ─────────────────────────────────────────────────────────────
        /** @internal */ Object.defineProperty(this, "_lastSnapshot", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        /** @internal */ Object.defineProperty(this, "historyManager", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        /** Maximum history entries retained. */
        Object.defineProperty(this, "maxHistorySize", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        // ── Animation ───────────────────────────────────────────────────────────
        /** @internal */ Object.defineProperty(this, "isAnimating", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        /** @internal */ Object.defineProperty(this, "animQueue", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        // ── Crop ────────────────────────────────────────────────────────────────
        /** @internal */ Object.defineProperty(this, "_cropMode", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        /** @internal */ Object.defineProperty(this, "_cropRect", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        /** @internal */ Object.defineProperty(this, "_cropHandlers", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        /** @internal */ Object.defineProperty(this, "_cropPrevEvented", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        /** @internal */ Object.defineProperty(this, "_prevSelectionSetting", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        // ── DOM event cleanup ───────────────────────────────────────────────────
        /** @internal */ Object.defineProperty(this, "_boundHandlers", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: {}
        });
        // ── Callbacks ───────────────────────────────────────────────────────────
        /** Optional callback invoked once each time an image finishes loading. */
        Object.defineProperty(this, "onImageLoaded", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        // Detect whether the first argument is the fabric module or options
        if (fabricModuleOrOptions &&
            typeof fabricModuleOrOptions.Canvas === 'function') {
            this._fabric = fabricModuleOrOptions;
        }
        else {
            // CDN global fallback
            const g = typeof globalThis !== 'undefined' ? globalThis : window;
            this._fabric = g['fabric'];
            options = (_a = fabricModuleOrOptions) !== null && _a !== void 0 ? _a : {};
        }
        this._fabricLoaded = !!(this._fabric && typeof this._fabric.Canvas === 'function');
        if (!this._fabricLoaded) {
            console.error('[ImageEditor] fabric.js v7 is not available. ' +
                'Pass it as the first constructor argument (ESM) or ' +
                'load it as a global <script> before instantiation.');
        }
        // ── Resolve options ───────────────────────────────────────────────
        const base = {
            canvasWidth: 800,
            canvasHeight: 600,
            backgroundColor: 'transparent',
            animationDuration: 300,
            minScale: 0.1,
            maxScale: 5.0,
            scaleStep: 0.05,
            rotationStep: 90,
            expandCanvasToImage: true,
            fitImageToCanvas: false,
            coverImageToCanvas: false,
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
            initialImageBase64: null,
            defaultDownloadFileName: 'edited_image.jpg',
            onImageLoaded: undefined,
        };
        const defaultLabel = {
            getText: (mask) => mask.maskName,
            textOptions: {
                fontSize: 12,
                fill: '#fff',
                backgroundColor: 'rgba(0,0,0,0.7)',
                padding: 2,
                fontFamily: 'monospace',
                fontWeight: 'bold',
                selectable: false,
                evented: false,
                originX: 'left',
                originY: 'top',
            },
        };
        const defaultCrop = {
            minWidth: 100,
            minHeight: 100,
            padding: 10,
            hideMasksDuringCrop: true,
            preserveMasksAfterCrop: true,
            allowRotationOfCropRect: false,
        };
        this.options = {
            ...base,
            ...options,
            label: defaultLabel,
            crop: defaultCrop,
        };
        // ── Internal state ────────────────────────────────────────────────
        this.maxHistorySize = 50;
        this.animQueue = new animation_queue_js_1.AnimationQueue();
        this.historyManager = new history_js_1.HistoryManager(this.maxHistorySize);
        this.onImageLoaded = typeof options.onImageLoaded === 'function'
            ? options.onImageLoaded
            : null;
    }
    // ═══════════════════════════════════════════════════════════════════════
    // PUBLIC — init
    // ═══════════════════════════════════════════════════════════════════════
    /**
     * Initializes the editor: connects to DOM elements, wires events,
     * and optionally loads the `initialImageBase64` from options.
     *
     * Must be called once before any other method is used.
     *
     * @param idMap Optional mapping from logical names to DOM element IDs.
     *
     * @example
     * ```ts
     * editor.init({ canvas: 'myCanvas', downloadBtn: 'dlBtn' });
     * ```
     */
    init(idMap = {}) {
        if (!this._fabricLoaded)
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
        this._initCanvas();
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
    // ═══════════════════════════════════════════════════════════════════════
    // PRIVATE — canvas setup
    // ═══════════════════════════════════════════════════════════════════════
    /** @internal */
    _initCanvas() {
        var _a;
        const id = this.elements.canvas;
        const canvasEl = id ? document.getElementById(id) : null;
        if (!canvasEl)
            throw new Error(`[ImageEditor] Canvas element not found: "${id}"`);
        this.canvasEl = canvasEl;
        const containerId = this.elements.canvasContainer;
        if (containerId) {
            this.containerEl = (_a = document.getElementById(containerId)) !== null && _a !== void 0 ? _a : canvasEl.parentElement;
        }
        else {
            this.containerEl = canvasEl.parentElement;
        }
        const phId = this.elements.imgPlaceholder;
        this.placeholderEl = phId ? document.getElementById(phId) : null;
        let initialW = this.options.canvasWidth;
        let initialH = this.options.canvasHeight;
        if (this.containerEl) {
            const cw = Math.floor(this.containerEl.clientWidth);
            const ch = Math.floor(this.containerEl.clientHeight);
            if (cw > 0 && ch > 0) {
                initialW = cw;
                initialH = ch;
            }
        }
        this.canvas = new this._fabric.Canvas(canvasEl, {
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
            if (e.target && (0, types_js_1.isMaskObject)(e.target))
                this._syncMaskLabel(e.target);
        };
        this.canvas.on('object:moving', onObjectEvent);
        this.canvas.on('object:scaling', onObjectEvent);
        this.canvas.on('object:rotating', onObjectEvent);
        this.canvas.on('object:modified', onObjectEvent);
        canvasEl.style.display = 'block';
    }
    // ═══════════════════════════════════════════════════════════════════════
    // PRIVATE — DOM / UI bindings
    // ═══════════════════════════════════════════════════════════════════════
    /** @internal */
    _bindEvents() {
        this._bindIfExists('uploadArea', 'click', () => {
            var _a;
            const inputId = this.elements.imageInput;
            if (inputId)
                (_a = document.getElementById(inputId)) === null || _a === void 0 ? void 0 : _a.click();
        });
        const inputId = this.elements.imageInput;
        const inputEl = inputId ? document.getElementById(inputId) : null;
        if (inputEl) {
            inputEl.addEventListener('change', (e) => {
                var _a;
                const f = (_a = e.target.files) === null || _a === void 0 ? void 0 : _a[0];
                if (f)
                    this._loadImageFile(f);
            });
        }
        this._bindIfExists('zoomInBtn', 'click', () => { void this.scaleImage(this.currentScale + this.options.scaleStep); });
        this._bindIfExists('zoomOutBtn', 'click', () => { void this.scaleImage(this.currentScale - this.options.scaleStep); });
        this._bindIfExists('resetBtn', 'click', () => { void this.reset(); });
        this._bindIfExists('addMaskBtn', 'click', () => { this.addMask(); });
        this._bindIfExists('removeMaskBtn', 'click', () => { this.removeSelectedMask(); });
        this._bindIfExists('removeAllMasksBtn', 'click', () => { this.removeAllMasks(); });
        this._bindIfExists('mergeBtn', 'click', () => { void this.merge(); });
        this._bindIfExists('downloadBtn', 'click', () => { this.downloadImage(); });
        this._bindIfExists('undoBtn', 'click', () => { this.undo(); });
        this._bindIfExists('redoBtn', 'click', () => { this.redo(); });
        const rotLeftId = this.elements.rotateLeftBtn;
        const rotRightId = this.elements.rotateRightBtn;
        const rotLeftEl = rotLeftId ? document.getElementById(rotLeftId) : null;
        const rotRightEl = rotRightId ? document.getElementById(rotRightId) : null;
        if (rotLeftEl) {
            rotLeftEl.addEventListener('click', () => {
                const el = this.elements.rotationLeftInput
                    ? document.getElementById(this.elements.rotationLeftInput)
                    : null;
                let step = this.options.rotationStep;
                if (el) {
                    const p = parseFloat(el.value);
                    if (!isNaN(p))
                        step = p;
                }
                void this.rotateImage(this.currentRotation - step);
            });
        }
        if (rotRightEl) {
            rotRightEl.addEventListener('click', () => {
                const el = this.elements.rotationRightInput
                    ? document.getElementById(this.elements.rotationRightInput)
                    : null;
                let step = this.options.rotationStep;
                if (el) {
                    const p = parseFloat(el.value);
                    if (!isNaN(p))
                        step = p;
                }
                void this.rotateImage(this.currentRotation + step);
            });
        }
        this._bindIfExists('cropBtn', 'click', () => { this.enterCropMode(); });
        this._bindIfExists('applyCropBtn', 'click', () => { void this.applyCrop().catch(e => console.error('[ImageEditor] applyCrop failed', e)); });
        this._bindIfExists('cancelCropBtn', 'click', () => { this.cancelCrop(); });
    }
    /** @internal */
    _bindIfExists(key, event, handler) {
        const id = this.elements[key];
        if (!id)
            return;
        const el = document.getElementById(id);
        if (!el)
            return;
        el.addEventListener(event, handler);
        if (!this._boundHandlers[key])
            this._boundHandlers[key] = [];
        this._boundHandlers[key].push({ event, handler });
    }
    // ═══════════════════════════════════════════════════════════════════════
    // PRIVATE — image loading
    // ═══════════════════════════════════════════════════════════════════════
    /** @internal */
    _loadImageFile(file) {
        if (!file.type.startsWith('image/'))
            return;
        const reader = new FileReader();
        reader.onload = (e) => { var _a; if ((_a = e.target) === null || _a === void 0 ? void 0 : _a.result)
            void this.loadImage(e.target.result); };
        reader.onerror = (e) => { console.error('[ImageEditor] fileReadError', e); };
        reader.readAsDataURL(file);
    }
    /**
     * Loads a Base64-encoded image data URL onto the canvas.
     * Clears any existing image, masks and resets transform state.
     *
     * @param base64 Data URL string starting with `data:image/…`.
     * @returns Promise that resolves once the image is on the canvas.
     */
    async loadImage(base64) {
        var _a, _b, _c, _d, _e, _f;
        if (!this._fabricLoaded || !this.canvas)
            return;
        if (!base64.startsWith('data:image/'))
            return;
        this._setPlaceholderVisible(false);
        const imgEl = await this._createImageElement(base64);
        let loadSrc = base64;
        if (this.options.downsampleOnLoad) {
            const needResize = imgEl.naturalWidth > this.options.downsampleMaxWidth ||
                imgEl.naturalHeight > this.options.downsampleMaxHeight;
            if (needResize) {
                const ratio = Math.min(this.options.downsampleMaxWidth / imgEl.naturalWidth, this.options.downsampleMaxHeight / imgEl.naturalHeight);
                loadSrc = this._resampleImageToDataURL(imgEl, Math.round(imgEl.naturalWidth * ratio), Math.round(imgEl.naturalHeight * ratio), this.options.downsampleQuality);
            }
        }
        let fimg;
        try {
            // v7: fromURL returns a Promise
            fimg = await this._fabric.Image.fromURL(loadSrc, { crossOrigin: 'anonymous' });
        }
        catch (err) {
            console.error('[ImageEditor] fabric.Image.fromURL failed', err);
            return;
        }
        this.canvas.discardActiveObject();
        this._hideAllMaskLabels();
        this.canvas.clear();
        // v7: backgroundColor is a plain property
        this.canvas.backgroundColor = this.options.backgroundColor;
        this.canvas.requestRenderAll();
        fimg.set({ originX: 'left', originY: 'top', selectable: false, evented: false });
        const imgW = (_a = fimg.width) !== null && _a !== void 0 ? _a : 0;
        const imgH = (_b = fimg.height) !== null && _b !== void 0 ? _b : 0;
        const minW = this.containerEl
            ? Math.floor(this.containerEl.clientWidth || this.options.canvasWidth)
            : this.options.canvasWidth;
        const minH = this.containerEl
            ? Math.floor(this.containerEl.clientHeight || this.options.canvasHeight)
            : this.options.canvasHeight;
        if (this.options.fitImageToCanvas) {
            const cw = Math.max(1, Math.min(this.options.canvasWidth, minW) - 1);
            const ch = Math.max(1, Math.min(this.options.canvasHeight, minH) - 1);
            this._setCanvasSizeInt(cw, ch);
            const fitScale = Math.min(cw / imgW, ch / imgH, 1);
            fimg.set({ left: 0, top: 0 });
            fimg.scale(fitScale);
            this.baseImageScale = (_c = fimg.scaleX) !== null && _c !== void 0 ? _c : 1;
        }
        else if (this.options.coverImageToCanvas) {
            const cw = Math.max(this.options.canvasWidth, minW);
            const ch = Math.max(this.options.canvasHeight, minH);
            this._setCanvasSizeInt(cw, ch);
            const coverScale = Math.min(1, Math.max(cw / imgW, ch / imgH));
            fimg.set({ left: 0, top: 0 });
            fimg.scale(coverScale);
            this.baseImageScale = (_d = fimg.scaleX) !== null && _d !== void 0 ? _d : 1;
        }
        else if (this.options.expandCanvasToImage) {
            const cw = Math.max(minW, Math.floor(imgW));
            const ch = Math.max(minH, Math.floor(imgH));
            this._setCanvasSizeInt(cw, ch);
            fimg.set({ left: 0, top: 0 });
            fimg.scale(1);
            this.baseImageScale = 1;
        }
        else {
            const cw = Math.max(this.options.canvasWidth, minW);
            const ch = Math.max(this.options.canvasHeight, minH);
            this._setCanvasSizeInt(cw, ch);
            const fitScale = Math.min(cw / imgW, ch / imgH, 1);
            fimg.set({ left: 0, top: 0 });
            fimg.scale(fitScale);
            this.baseImageScale = (_e = fimg.scaleX) !== null && _e !== void 0 ? _e : 1;
        }
        this.originalImage = fimg;
        this.canvas.add(fimg);
        // v7: sendObjectToBack()
        this.canvas.sendObjectToBack(fimg);
        this._lastMask = null;
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
        (_f = this.onImageLoaded) === null || _f === void 0 ? void 0 : _f.call(this);
    }
    /**
     * Returns `true` if a valid image is currently loaded on the canvas.
     */
    isImageLoaded() {
        var _a, _b;
        return !!(this.originalImage &&
            this.originalImage instanceof this._fabric.Image &&
            ((_a = this.originalImage.width) !== null && _a !== void 0 ? _a : 0) > 0 &&
            ((_b = this.originalImage.height) !== null && _b !== void 0 ? _b : 0) > 0);
    }
    /** @internal */
    _createImageElement(dataURL) {
        return new Promise((res, rej) => {
            const img = new Image();
            img.onload = () => { img.onload = img.onerror = null; res(img); };
            img.onerror = (e) => { img.onload = img.onerror = null; rej(e); };
            img.src = dataURL;
        });
    }
    /** @internal */
    _resampleImageToDataURL(imgEl, w, h, quality = 0.92) {
        const oc = document.createElement('canvas');
        oc.width = w;
        oc.height = h;
        oc.getContext('2d').drawImage(imgEl, 0, 0, imgEl.naturalWidth, imgEl.naturalHeight, 0, 0, w, h);
        return oc.toDataURL('image/jpeg', quality);
    }
    /**
     * Resizes the Fabric.js Canvas using `setDimensions()`.
     *
     * CRITICAL: In Fabric.js v7 the canvas is split into two `<canvas>` elements:
     * - **lowerCanvasEl** — renders objects
     * - **upperCanvasEl** — captures pointer events (invisible overlay)
     *
     * `setDimensions({ width, height })` updates **both** layers atomically and
     * keeps their CSS in sync.  Manually mutating `canvasEl.style.width/height`
     * only touches the lower layer → the upper layer's hit-test regions become
     * misaligned → objects appear unselectable and click positions drift.
     *
     * @internal
     */
    _setCanvasSizeInt(w, h) {
        const iw = Math.max(1, Math.round(Number(w) || 1));
        const ih = Math.max(1, Math.round(Number(h) || 1));
        this.canvas.setDimensions({ width: iw, height: ih });
    }
    // ═══════════════════════════════════════════════════════════════════════
    // PRIVATE — geometry helpers
    // ═══════════════════════════════════════════════════════════════════════
    /** @internal */
    _getObjectTopLeftPoint(obj) {
        obj.setCoords();
        const coords = obj.getCoords();
        const first = coords[0];
        if (first)
            return first;
        // Fallback: top-left of bounding rect (v7: no params)
        const br = obj.getBoundingRect();
        return new this._fabric.Point(br.left, br.top);
    }
    /** @internal */
    _setObjectOriginKeepingPosition(obj, originX, originY, refPoint) {
        obj.set({ originX, originY });
        obj.setPositionByOrigin(refPoint, originX, originY);
        obj.setCoords();
    }
    /** @internal */
    _alignObjectBoundingBoxToCanvasTopLeft(obj) {
        var _a, _b;
        obj.setCoords();
        const br = obj.getBoundingRect(); // v7: always absolute, no params
        obj.set({ left: ((_a = obj.left) !== null && _a !== void 0 ? _a : 0) - br.left, top: ((_b = obj.top) !== null && _b !== void 0 ? _b : 0) - br.top });
        obj.setCoords();
        this.canvas.renderAll();
    }
    /** @internal */
    _updateCanvasSizeToImageBounds() {
        if (!this.originalImage)
            return;
        this.originalImage.setCoords();
        const br = this.originalImage.getBoundingRect();
        const containerW = this.containerEl ? Math.ceil(this.containerEl.clientWidth || 0) : 0;
        const containerH = this.containerEl ? Math.ceil(this.containerEl.clientHeight || 0) : 0;
        // If image fits inside the viewport, keep the canvas viewport-sized
        if (containerW > 0 && containerH > 0 && br.width <= containerW && br.height <= containerH) {
            this._setCanvasSizeInt(containerW, containerH);
            return;
        }
        this._setCanvasSizeInt(Math.max(containerW || 0, Math.floor(br.width)), Math.max(containerH || 0, Math.floor(br.height)));
    }
    // ═══════════════════════════════════════════════════════════════════════
    // PUBLIC — scale / rotate / reset
    // ═══════════════════════════════════════════════════════════════════════
    /**
     * Animates the image to the given scale factor.
     * The factor is clamped to `[options.minScale, options.maxScale]`.
     * Queued — concurrent calls are serialized.
     *
     * @returns Promise that resolves when the animation finishes.
     */
    scaleImage(factor) {
        return this.animQueue.add(() => this._scaleImageImpl(factor));
    }
    /** @internal */
    async _scaleImageImpl(factor) {
        if (!this.originalImage || !this.canvas || this.isAnimating)
            return;
        factor = Math.max(this.options.minScale, Math.min(this.options.maxScale, factor));
        this.currentScale = factor;
        this.isAnimating = true;
        this._updateUI();
        const targetAbs = this.baseImageScale * factor;
        const topLeft = this._getObjectTopLeftPoint(this.originalImage);
        this._setObjectOriginKeepingPosition(this.originalImage, 'left', 'top', topLeft);
        try {
            // v7: animate() returns Animation[], NOT a Promise.
            // Multi-prop animation fires onComplete once per property;
            // we count both completions before resolving.
            await new Promise((resolve, reject) => {
                let completed = 0;
                const onComplete = () => { if (++completed >= 2)
                    resolve(); };
                try {
                    this.originalImage.animate({ scaleX: targetAbs, scaleY: targetAbs }, {
                        duration: this.options.animationDuration,
                        onChange: () => this.canvas.requestRenderAll(),
                        onComplete,
                    });
                }
                catch (e) {
                    reject(e);
                }
            });
            this.originalImage.set({ scaleX: targetAbs, scaleY: targetAbs });
            this.originalImage.setCoords();
            if (this.options.expandCanvasToImage)
                this._updateCanvasSizeToImageBounds();
            this._alignObjectBoundingBoxToCanvasTopLeft(this.originalImage);
            this.canvas.getObjects()
                .filter(types_js_1.isMaskObject)
                .forEach(m => this._syncMaskLabel(m));
            this.isAnimating = false;
            this._updateInputs();
            this._updateUI();
            this.saveState();
        }
        catch (err) {
            console.warn('[ImageEditor] scaleImage animation error', err);
            this.isAnimating = false;
            this._updateUI();
        }
    }
    /**
     * Animates the image to the given rotation angle.
     * Queued — concurrent calls are serialized.
     *
     * @param degrees Target rotation angle in degrees.
     * @returns Promise that resolves when the animation finishes.
     */
    rotateImage(degrees) {
        return this.animQueue.add(() => this._rotateImageImpl(degrees));
    }
    /** @internal */
    async _rotateImageImpl(degrees) {
        if (!this.originalImage || !this.canvas || this.isAnimating || isNaN(degrees))
            return;
        this.currentRotation = degrees;
        this.isAnimating = true;
        this._updateUI();
        const center = this.originalImage.getCenterPoint();
        this._setObjectOriginKeepingPosition(this.originalImage, 'center', 'center', center);
        try {
            // v7: single-prop animate(), onComplete used as Promise hook
            await new Promise((resolve, reject) => {
                try {
                    this.originalImage.animate({ angle: degrees }, {
                        duration: this.options.animationDuration,
                        onChange: () => this.canvas.requestRenderAll(),
                        onComplete: () => resolve(),
                    });
                }
                catch (e) {
                    reject(e);
                }
            });
            this.originalImage.set('angle', degrees);
            this.originalImage.setCoords();
            if (this.options.expandCanvasToImage)
                this._updateCanvasSizeToImageBounds();
            this._alignObjectBoundingBoxToCanvasTopLeft(this.originalImage);
            const newTopLeft = this._getObjectTopLeftPoint(this.originalImage);
            this._setObjectOriginKeepingPosition(this.originalImage, 'left', 'top', newTopLeft);
            this.canvas.getObjects()
                .filter(types_js_1.isMaskObject)
                .forEach(m => this._syncMaskLabel(m));
            this.isAnimating = false;
            this._updateInputs();
            this._updateUI();
            this.saveState();
        }
        catch (err) {
            console.warn('[ImageEditor] rotateImage animation error', err);
            this.isAnimating = false;
            this._updateUI();
        }
    }
    /**
     * Resets the image to scale 1 and rotation 0 (animated).
     * @returns Promise that resolves when complete.
     */
    reset() {
        if (!this.originalImage)
            return Promise.resolve();
        return this.scaleImage(1)
            .then(() => this.rotateImage(0))
            .then(() => { this.saveState(); })
            .catch(err => { console.error('[ImageEditor] reset() failed', err); });
    }
    // ═══════════════════════════════════════════════════════════════════════
    // PUBLIC — history
    // ═══════════════════════════════════════════════════════════════════════
    /**
     * Restores a previously serialized canvas state.
     *
     * @param jsonString JSON string returned by `canvas.toJSON()` (or parsed object).
     */
    async loadFromState(jsonString) {
        var _a;
        if (!jsonString || !this.canvas)
            return;
        try {
            const json = typeof jsonString === 'string'
                ? JSON.parse(jsonString)
                : jsonString;
            // v7: loadFromJSON returns a Promise
            await this.canvas.loadFromJSON(json);
            this._hideAllMaskLabels();
            const objs = this.canvas.getObjects();
            this.originalImage = ((_a = objs.find(o => o.type === 'image' && !(0, types_js_1.isMaskObject)(o))) !== null && _a !== void 0 ? _a : null);
            if (this.originalImage) {
                this.originalImage.set({
                    originX: 'left', originY: 'top',
                    selectable: false, evented: false,
                    hasControls: false,
                    hoverCursor: 'default',
                });
                this.canvas.sendObjectToBack(this.originalImage);
            }
            this.maskCounter = objs
                .filter(types_js_1.isMaskObject)
                .reduce((max, m) => Math.max(max, m.maskId), 0);
            this.canvas.renderAll();
            this._updateMaskList();
            this._updateUI();
        }
        catch (e) {
            console.error('[ImageEditor] loadFromState() failed', e);
        }
    }
    /**
     * Captures the current canvas state into the undo/redo history.
     * Called automatically after transforms, mask operations, and crop.
     */
    saveState() {
        var _a;
        if (!this.canvas)
            return;
        const activeObj = this.canvas.getActiveObject();
        this._hideAllMaskLabels();
        try {
            const jsonObj = this.canvas.toJSON(['maskId', 'maskName', 'isCropRect']);
            if (Array.isArray(jsonObj.objects)) {
                jsonObj.objects = jsonObj.objects.filter(o => !o.isCropRect);
            }
            const after = JSON.stringify(jsonObj);
            const before = (_a = this._lastSnapshot) !== null && _a !== void 0 ? _a : after;
            let executedOnce = false;
            const cmd = new history_js_1.Command(() => { if (executedOnce) {
                void this.loadFromState(after);
            } executedOnce = true; }, () => { void this.loadFromState(before); });
            this.historyManager.execute(cmd);
            this._lastSnapshot = after;
            if (activeObj && (0, types_js_1.isMaskObject)(activeObj))
                this._showLabelForMask(activeObj);
            this._updateUI();
        }
        catch (err) {
            console.warn('[ImageEditor] saveState: failed to save canvas snapshot', err);
        }
    }
    /** Undoes the last recorded action. */
    undo() { this.historyManager.undo(); }
    /** Redoes the next recorded action. */
    redo() { this.historyManager.redo(); }
    // ═══════════════════════════════════════════════════════════════════════
    // PUBLIC — mask management
    // ═══════════════════════════════════════════════════════════════════════
    /**
     * Creates and adds a mask shape to the canvas.
     *
     * @param config  Shape type, dimensions, position, style, and callbacks.
     * @returns The created mask object, or `null` if the canvas is unavailable.
     *
     * @example
     * ```ts
     * // Simple rect mask
     * editor.addMask();
     *
     * // Circle with custom size
     * editor.addMask({ shape: 'circle', radius: 60, color: 'rgba(255,0,0,0.4)' });
     *
     * // Positioned at 20% from the left
     * editor.addMask({ left: '20%', top: 40 });
     * ```
     */
    addMask(config = {}) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x;
        if (!this.canvas)
            return null;
        const shapeType = (_a = config.shape) !== null && _a !== void 0 ? _a : 'rect';
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
            ...config,
        };
        const firstOffset = 10;
        const canvas = this.canvas;
        const resolveNumeric = (val, fallback) => {
            if (typeof val === 'function')
                return val(canvas, this.options);
            if (typeof val === 'string' && val.endsWith('%')) {
                return Math.floor(canvas.getWidth() * (parseFloat(val) / 100));
            }
            return typeof val === 'number' ? val : fallback;
        };
        let left;
        let top;
        if (config.left === undefined && this._lastMask) {
            const prev = this._lastMask;
            const prevRight = ((_b = prev.left) !== null && _b !== void 0 ? _b : 0) + (typeof prev.getScaledWidth === 'function'
                ? prev.getScaledWidth()
                : ((_c = prev.width) !== null && _c !== void 0 ? _c : 0) * ((_d = prev.scaleX) !== null && _d !== void 0 ? _d : 1));
            left = Math.round(prevRight + ((_e = cfg.gap) !== null && _e !== void 0 ? _e : 5));
            top = (_f = prev.top) !== null && _f !== void 0 ? _f : firstOffset;
        }
        else {
            left = resolveNumeric(config.left, firstOffset);
            top = resolveNumeric(config.top, firstOffset);
        }
        cfg.width = resolveNumeric(config.width, this.options.defaultMaskWidth);
        cfg.height = resolveNumeric(config.height, this.options.defaultMaskHeight);
        // Expand canvas only if mask placement exceeds the current canvas size.
        // Never use containerEl dimensions as a floor here — that would shrink
        // a wider-than-viewport canvas (removing its scrollbar).
        if (this.options.expandCanvasToImage) {
            const reqW = Math.ceil(left + cfg.width + 10);
            const reqH = Math.ceil(top + cfg.height + 10);
            const newW = Math.max(canvas.getWidth(), reqW);
            const newH = Math.max(canvas.getHeight(), reqH);
            if (newW !== canvas.getWidth() || newH !== canvas.getHeight()) {
                this._setCanvasSizeInt(newW, newH);
            }
        }
        // ── Build the Fabric shape ─────────────────────────────────────────
        const fb = this._fabric;
        let mask;
        if (typeof cfg.fabricGenerator === 'function') {
            mask = cfg.fabricGenerator(cfg, canvas, this.options);
        }
        else {
            // v7: All new objects default to originX/Y 'center'/'center'.
            //     We declare 'left'/'top' so coordinates refer to the top-left corner,
            //     matching the v5 behavior and the placement logic above.
            const originProps = { originX: 'left', originY: 'top' };
            const rx = config.rx !== undefined ? resolveNumeric(config.rx, 0) : undefined;
            const ry = config.ry !== undefined ? resolveNumeric(config.ry, 0) : undefined;
            switch (shapeType) {
                case 'circle':
                    mask = new fb.Circle({
                        left, top, ...originProps,
                        radius: resolveNumeric(config.radius, Math.min(cfg.width, cfg.height) / 2),
                        fill: cfg.color, opacity: cfg.alpha, angle: (_g = cfg.angle) !== null && _g !== void 0 ? _g : 0,
                        ...cfg.styles,
                    });
                    break;
                case 'ellipse':
                    mask = new fb.Ellipse({
                        left, top, ...originProps,
                        rx: rx !== null && rx !== void 0 ? rx : cfg.width / 2,
                        ry: ry !== null && ry !== void 0 ? ry : cfg.height / 2,
                        fill: cfg.color, opacity: cfg.alpha, angle: (_h = cfg.angle) !== null && _h !== void 0 ? _h : 0,
                        ...cfg.styles,
                    });
                    break;
                case 'polygon': {
                    const pts = ((_j = config.points) !== null && _j !== void 0 ? _j : []).map(pt => ({
                        x: Number(pt.x), y: Number(pt.y),
                    }));
                    mask = new fb.Polygon(pts, {
                        left, top, ...originProps,
                        fill: cfg.color, opacity: cfg.alpha, angle: (_k = cfg.angle) !== null && _k !== void 0 ? _k : 0,
                        ...cfg.styles,
                    });
                    break;
                }
                case 'rect':
                default:
                    mask = new fb.Rect({
                        left, top, ...originProps,
                        width: cfg.width,
                        height: cfg.height,
                        fill: cfg.color, opacity: cfg.alpha, angle: (_l = cfg.angle) !== null && _l !== void 0 ? _l : 0,
                        ...(rx !== undefined ? { rx } : {}),
                        ...(ry !== undefined ? { ry } : {}),
                        ...cfg.styles,
                    });
            }
        }
        // ── Common mask properties ─────────────────────────────────────────
        const m = mask;
        m.selectable = cfg.selectable !== false;
        m.hasControls = 'hasControls' in cfg ? !!cfg.hasControls : true;
        m.lockRotation = !this.options.maskRotatable;
        m.borderColor = (_m = config.borderColor) !== null && _m !== void 0 ? _m : 'red';
        m.cornerColor = (_o = config.cornerColor) !== null && _o !== void 0 ? _o : 'black';
        m.cornerSize = (_p = config.cornerSize) !== null && _p !== void 0 ? _p : 8;
        m.transparentCorners = (_q = config.transparentCorners) !== null && _q !== void 0 ? _q : false;
        m.stroke = (_s = (_r = cfg.styles) === null || _r === void 0 ? void 0 : _r.stroke) !== null && _s !== void 0 ? _s : '#ccc';
        m.strokeWidth = (_u = (_t = cfg.styles) === null || _t === void 0 ? void 0 : _t.strokeWidth) !== null && _u !== void 0 ? _u : 1;
        m.strokeUniform = (_v = config.strokeUniform) !== null && _v !== void 0 ? _v : true;
        if ((_w = cfg.styles) === null || _w === void 0 ? void 0 : _w.strokeDashArray)
            m.strokeDashArray = cfg.styles.strokeDashArray;
        m.originalAlpha = cfg.alpha;
        const normalStyle = { stroke: m.stroke, strokeWidth: m.strokeWidth, opacity: m.originalAlpha };
        const hoverStyle = {
            stroke: '#ff5500', strokeWidth: 2,
            opacity: Math.min(m.originalAlpha + 0.2, 1),
        };
        m.on('mouseover', () => { var _a; m.set(hoverStyle); (_a = m.canvas) === null || _a === void 0 ? void 0 : _a.requestRenderAll(); });
        m.on('mouseout', () => { var _a; m.set(normalStyle); (_a = m.canvas) === null || _a === void 0 ? void 0 : _a.requestRenderAll(); });
        m.maskId = ++this.maskCounter;
        m.maskName = `${this.options.maskName}${m.maskId}`;
        this._lastMask = m;
        this._lastMaskInitialLeft = left;
        this._lastMaskInitialTop = top;
        this._lastMaskInitialWidth = cfg.width;
        canvas.add(m);
        // v7: bringObjectToFront()
        canvas.bringObjectToFront(m);
        if (cfg.selectable !== false) {
            // setActiveObject fires 'selection:created' → _onSelectionChanged().
            // Do NOT call _onSelectionChanged manually — that would double-invoke it,
            // causing the label to be destroyed and recreated in the same tick.
            canvas.setActiveObject(m);
        }
        this._updateMaskList();
        this._updateUI();
        canvas.renderAll();
        this.saveState();
        (_x = cfg.onCreate) === null || _x === void 0 ? void 0 : _x.call(cfg, m, canvas);
        return m;
    }
    /**
     * Removes the currently selected mask (and its label).
     */
    removeSelectedMask() {
        if (!this.canvas)
            return;
        const active = this.canvas.getActiveObject();
        if (!active || !(0, types_js_1.isMaskObject)(active))
            return;
        this._removeLabelForMask(active);
        this.canvas.remove(active);
        this.canvas.discardActiveObject();
        this._updateMaskList();
        this._updateUI();
        this.canvas.renderAll();
        this.saveState();
    }
    /**
     * Removes all masks and their labels.
     */
    removeAllMasks() {
        if (!this.canvas)
            return;
        this.canvas.getObjects().filter(types_js_1.isMaskObject).forEach(m => {
            this._removeLabelForMask(m);
            this.canvas.remove(m);
        });
        this.canvas.discardActiveObject();
        this._lastMask = null;
        this._lastMaskInitialLeft = null;
        this._lastMaskInitialTop = null;
        this._lastMaskInitialWidth = null;
        this._updateMaskList();
        this._updateUI();
        this.canvas.renderAll();
        this.saveState();
    }
    // ═══════════════════════════════════════════════════════════════════════
    // PRIVATE — mask label helpers
    // ═══════════════════════════════════════════════════════════════════════
    /** @internal */
    _removeLabelForMask(mask) {
        if (!this.canvas || !mask.__label)
            return;
        try {
            if (this.canvas.getObjects().includes(mask.__label)) {
                this.canvas.remove(mask.__label);
            }
        }
        catch { /* ignore */ }
        try {
            delete mask.__label;
        }
        catch { /* ignore */ }
    }
    /** @internal */
    _createLabelForMask(mask) {
        if (!this.canvas || !this.options.maskLabelOnSelect)
            return;
        this._removeLabelForMask(mask);
        let textObj = null;
        if (typeof this.options.label.create === 'function') {
            textObj = this.options.label.create(mask, this._fabric);
        }
        if (!textObj) {
            const txt = typeof this.options.label.getText === 'function'
                ? this.options.label.getText(mask, this.maskCounter)
                : mask.maskName;
            const textOptions = {
                left: 0, top: 0,
                fontSize: 12, fill: '#fff',
                backgroundColor: 'rgba(0,0,0,0.7)',
                selectable: false, evented: false,
                padding: 2, originX: 'left', originY: 'top',
                ...this.options.label.textOptions,
            };
            textObj = new this._fabric.Text(txt, textOptions);
        }
        textObj.maskLabel = true;
        mask.__label = textObj;
        this.canvas.add(textObj);
        // v7: bringObjectToFront()
        this.canvas.bringObjectToFront(textObj);
        this._syncMaskLabel(mask);
    }
    /** @internal */
    _hideAllMaskLabels() {
        if (!this.canvas)
            return;
        const objs = this.canvas.getObjects();
        objs
            .filter(o => o.maskLabel)
            .forEach(l => { try {
            this.canvas.remove(l);
        }
        catch { /* ignore */ } });
        objs
            .filter(types_js_1.isMaskObject)
            .forEach(o => { try {
            delete o.__label;
        }
        catch { /* ignore */ } });
    }
    /** @internal */
    _syncMaskLabel(mask) {
        var _a, _b, _c;
        if (!this.canvas || !this.options.maskLabelOnSelect || !mask.__label)
            return;
        const coords = (_a = mask.getCoords) === null || _a === void 0 ? void 0 : _a.call(mask);
        if (!(coords === null || coords === void 0 ? void 0 : coords.length))
            return;
        const tl = coords[0];
        if (!tl)
            return;
        const center = mask.getCenterPoint();
        const vx = center.x - tl.x;
        const vy = center.y - tl.y;
        const dist = Math.sqrt(vx * vx + vy * vy) || 1;
        const offset = Math.max(0, (_b = this.options.maskLabelOffset) !== null && _b !== void 0 ? _b : 3);
        mask.__label.set({
            left: Math.round(tl.x + (vx / dist) * offset),
            top: Math.round(tl.y + (vy / dist) * offset),
            angle: (_c = mask.angle) !== null && _c !== void 0 ? _c : 0,
            originX: 'left',
            originY: 'top',
            visible: true,
        });
        mask.__label.setCoords();
        this.canvas.renderAll();
    }
    /** @internal */
    _showLabelForMask(mask) {
        if (!this.options.maskLabelOnSelect)
            return;
        if (!mask.__label)
            this._createLabelForMask(mask);
        if (mask.__label) {
            mask.__label.visible = true;
            this._syncMaskLabel(mask);
        }
    }
    /** @internal */
    _onSelectionChanged(selected) {
        var _a;
        if (!this.canvas)
            return;
        const selectedMask = (_a = selected.find(types_js_1.isMaskObject)) !== null && _a !== void 0 ? _a : null;
        const masks = this.canvas.getObjects().filter(types_js_1.isMaskObject);
        masks.forEach(m => {
            if (m !== selectedMask) {
                if (m.__label) {
                    try {
                        this.canvas.remove(m.__label);
                    }
                    catch { /* ignore */ }
                    delete m.__label;
                }
                m.set({ stroke: '#ccc', strokeWidth: 1 });
            }
            else {
                m.set({ stroke: '#ff0000', strokeWidth: 1 });
            }
        });
        if (selectedMask)
            this._showLabelForMask(selectedMask);
        this._updateMaskListSelection(selectedMask);
        this.canvas.renderAll();
        this._updateUI();
    }
    // ═══════════════════════════════════════════════════════════════════════
    // PRIVATE — mask list DOM
    // ═══════════════════════════════════════════════════════════════════════
    /** @internal */
    _updateMaskList() {
        const listId = this.elements.maskList;
        if (!listId)
            return;
        const listEl = document.getElementById(listId);
        if (!listEl || !this.canvas)
            return;
        listEl.innerHTML = '';
        this.canvas.getObjects().filter(types_js_1.isMaskObject).forEach(mask => {
            const li = document.createElement('li');
            li.className = 'list-group-item mask-item';
            li.textContent = mask.maskName;
            li.onclick = () => {
                this.canvas.setActiveObject(mask);
                this._onSelectionChanged([mask]);
            };
            listEl.appendChild(li);
        });
    }
    /** @internal */
    _updateMaskListSelection(selectedMask) {
        const listId = this.elements.maskList;
        if (!listId)
            return;
        const listEl = document.getElementById(listId);
        if (!listEl)
            return;
        listEl.querySelectorAll('.mask-item').forEach(item => {
            item.classList.toggle('active', !!(selectedMask && item.textContent === selectedMask.maskName));
        });
    }
    // ═══════════════════════════════════════════════════════════════════════
    // PUBLIC — merge / export / download
    // ═══════════════════════════════════════════════════════════════════════
    /**
     * Bakes all current masks into the image:
     * exports the masked image, removes the masks, and re-imports the result
     * as the new base image.
     *
     * @returns Promise that resolves when the merge is complete.
     */
    async merge() {
        if (!this.originalImage || !this.canvas)
            return;
        const masks = this.canvas.getObjects().filter(types_js_1.isMaskObject);
        if (!masks.length)
            return;
        this.canvas.discardActiveObject();
        this.canvas.renderAll();
        try {
            const merged = await this.getImageBase64({
                exportImageArea: true,
                multiplier: this.options.exportMultiplier,
            });
            this.removeAllMasks();
            await this.loadImage(merged);
            this.saveState();
        }
        catch (err) {
            console.error('[ImageEditor] merge error', err);
        }
    }
    /**
     * Triggers a browser download of the current canvas as a JPEG.
     *
     * @param fileName Filename for the downloaded file.
     *   @default `options.defaultDownloadFileName`
     */
    downloadImage(fileName = this.options.defaultDownloadFileName) {
        if (!this.originalImage)
            return;
        this.getImageBase64({
            exportImageArea: this.options.exportImageAreaByDefault,
            multiplier: this.options.exportMultiplier,
        }).then(base64 => {
            const link = document.createElement('a');
            link.download = fileName;
            link.href = base64;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }).catch(err => console.error('[ImageEditor] download error', err));
    }
    /**
     * Exports the canvas as a Base64-encoded JPEG data URL.
     *
     * When `exportImageArea` is `true`, the canvas is rendered with masks
     * baked in as solid black overlays and cropped to the image bounding box.
     * When `false`, the raw image pixels are returned without any masks.
     *
     * @param options Export options.
     * @returns Promise resolving to a JPEG data URL.
     * @throws If no image is loaded.
     */
    async getImageBase64(options = {}) {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        if (!this.originalImage || !this.canvas)
            throw new Error('[ImageEditor] No image loaded');
        const exportImageArea = (_a = options.exportImageArea) !== null && _a !== void 0 ? _a : this.options.exportImageAreaByDefault;
        const multiplier = (_c = (_b = options.multiplier) !== null && _b !== void 0 ? _b : this.options.exportMultiplier) !== null && _c !== void 0 ? _c : 1;
        // Plain export (no mask overlay)
        if (!exportImageArea) {
            const imgEl = ((_f = (_e = (_d = this.originalImage).getElement) === null || _e === void 0 ? void 0 : _e.call(_d)) !== null && _f !== void 0 ? _f : this.originalImage._element);
            if (!imgEl) {
                return this.canvas.toDataURL({
                    format: 'jpeg',
                    quality: this.options.downsampleQuality,
                    multiplier,
                });
            }
            const oc = document.createElement('canvas');
            oc.width = (_g = this.originalImage.width) !== null && _g !== void 0 ? _g : 0;
            oc.height = (_h = this.originalImage.height) !== null && _h !== void 0 ? _h : 0;
            oc.getContext('2d').drawImage(imgEl, 0, 0, oc.width, oc.height);
            return oc.toDataURL('image/jpeg', this.options.downsampleQuality);
        }
        // Export with masks baked in
        const masks = this.canvas.getObjects().filter(types_js_1.isMaskObject);
        const masksBackup = masks.map(m => {
            var _a, _b, _c, _d, _e, _f;
            return ({
                obj: m,
                opacity: (_a = m.opacity) !== null && _a !== void 0 ? _a : 1,
                fill: (_b = m.fill) !== null && _b !== void 0 ? _b : null,
                strokeWidth: (_c = m.strokeWidth) !== null && _c !== void 0 ? _c : 0,
                stroke: (_d = m.stroke) !== null && _d !== void 0 ? _d : null,
                selectable: (_e = m.selectable) !== null && _e !== void 0 ? _e : true,
                lockRotation: (_f = m.lockRotation) !== null && _f !== void 0 ? _f : false,
            });
        });
        masks.forEach(m => this._removeLabelForMask(m));
        this.canvas.discardActiveObject();
        this.canvas.renderAll();
        masks.forEach(m => {
            m.set({ opacity: 1, fill: '#000000', strokeWidth: 0, stroke: null, selectable: false });
            m.setCoords();
        });
        this.canvas.renderAll();
        // Image bounding box (v7: no params)
        this.originalImage.setCoords();
        const imgBr = this.originalImage.getBoundingRect();
        const sx = Math.max(0, Math.round(imgBr.left));
        const sy = Math.max(0, Math.round(imgBr.top));
        const sw = Math.max(1, Math.round(imgBr.width));
        const sh = Math.max(1, Math.round(imgBr.height));
        const finalBase64 = await new Promise((resolve, reject) => {
            const fullDataUrl = this.canvas.toDataURL({
                format: 'jpeg',
                quality: this.options.downsampleQuality,
                multiplier,
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
                    oc.getContext('2d').drawImage(img, sxM, syM, swM, shM, 0, 0, swM, shM);
                    resolve(oc.toDataURL('image/jpeg', this.options.downsampleQuality));
                }
                catch (e) {
                    reject(e);
                }
            };
            img.onerror = reject;
            img.src = fullDataUrl;
        });
        // Restore masks
        masksBackup.forEach(b => {
            try {
                b.obj.set({
                    opacity: b.opacity, fill: b.fill,
                    strokeWidth: b.strokeWidth, stroke: b.stroke,
                    selectable: b.selectable, lockRotation: b.lockRotation,
                });
                b.obj.setCoords();
            }
            catch { /* ignore */ }
        });
        this.canvas.renderAll();
        return finalBase64;
    }
    /**
     * Exports the canvas as a browser `File` object.
     *
     * @param options Export and file options.
     * @returns Promise resolving to a `File`.
     * @throws If no image is loaded.
     *
     * @example
     * ```ts
     * const file = await editor.exportImageFile({ fileType: 'png', mergeMask: false });
     * const formData = new FormData();
     * formData.append('image', file);
     * ```
     */
    async exportImageFile(options = {}) {
        var _a;
        if (!this.originalImage)
            throw new Error('[ImageEditor] No image loaded');
        const { mergeMask = true, fileType = 'jpeg', quality = this.options.downsampleQuality, multiplier = this.options.exportMultiplier, fileName = this.options.defaultDownloadFileName, } = options;
        const typeMap = {
            jpeg: 'jpeg', jpg: 'jpeg', 'image/jpeg': 'jpeg',
            png: 'png', 'image/png': 'png',
            webp: 'webp', 'image/webp': 'webp',
        };
        const safeType = (_a = typeMap[fileType.toLowerCase()]) !== null && _a !== void 0 ? _a : 'jpeg';
        let base64 = await this.getImageBase64({ exportImageArea: mergeMask, multiplier });
        if (!base64.startsWith(`data:image/${safeType}`)) {
            base64 = await new Promise((resolve, reject) => {
                const img = new window.Image();
                img.crossOrigin = 'Anonymous';
                img.onload = () => {
                    try {
                        const oc = document.createElement('canvas');
                        oc.width = img.width;
                        oc.height = img.height;
                        oc.getContext('2d').drawImage(img, 0, 0);
                        resolve(oc.toDataURL(`image/${safeType}`, quality));
                    }
                    catch (e) {
                        reject(e);
                    }
                };
                img.onerror = reject;
                img.src = base64;
            });
        }
        const bstr = atob(base64.split(',').slice(1).join(','));
        const u8arr = new Uint8Array(bstr.length);
        for (let n = bstr.length - 1; n >= 0; n--)
            u8arr[n] = bstr.charCodeAt(n);
        return new File([u8arr], fileName, { type: `image/${safeType}` });
    }
    // ═══════════════════════════════════════════════════════════════════════
    // PUBLIC — crop mode
    // ═══════════════════════════════════════════════════════════════════════
    /**
     * Enters crop mode: adds a resizable selection rect to the canvas.
     * All other controls are disabled until {@link applyCrop} or {@link cancelCrop} is called.
     */
    enterCropMode() {
        var _a, _b, _c, _d;
        if (!this.canvas || !this.originalImage || this._cropMode)
            return;
        if (!this.isImageLoaded())
            return;
        this._cropMode = true;
        this._prevSelectionSetting = this.canvas.selection;
        this.canvas.selection = false;
        this.canvas.discardActiveObject();
        this.originalImage.setCoords();
        const imgBr = this.originalImage.getBoundingRect();
        const padding = (_b = (_a = this.options.crop) === null || _a === void 0 ? void 0 : _a.padding) !== null && _b !== void 0 ? _b : 10;
        const left = Math.max(0, Math.floor(imgBr.left + padding));
        const top = Math.max(0, Math.floor(imgBr.top + padding));
        const width = Math.max(this.options.crop.minWidth, Math.floor(imgBr.width - padding * 2));
        const height = Math.max(this.options.crop.minHeight, Math.floor(imgBr.height - padding * 2));
        const cropRect = new this._fabric.Rect({
            left, top, width, height,
            originX: 'left', originY: 'top',
            fill: 'rgba(0,0,0,0.12)',
            stroke: '#00aaff',
            strokeDashArray: [6, 4],
            strokeWidth: 1,
            strokeUniform: true,
            selectable: true,
            hasRotatingPoint: !!((_c = this.options.crop) === null || _c === void 0 ? void 0 : _c.allowRotationOfCropRect),
            lockRotation: !((_d = this.options.crop) === null || _d === void 0 ? void 0 : _d.allowRotationOfCropRect),
            cornerSize: 8,
            objectCaching: false,
        });
        this.canvas.add(cropRect);
        cropRect.isCropRect = true;
        this.canvas.bringObjectToFront(cropRect);
        this.canvas.setActiveObject(cropRect);
        this._cropRect = cropRect;
        // Freeze all other objects during crop
        this._cropPrevEvented = [];
        this.canvas.getObjects().forEach(o => {
            var _a, _b;
            if (o !== cropRect) {
                this._cropPrevEvented.push({
                    obj: o,
                    evented: (_a = o.evented) !== null && _a !== void 0 ? _a : true,
                    selectable: (_b = o.selectable) !== null && _b !== void 0 ? _b : true,
                });
                try {
                    o.evented = false;
                    o.selectable = false;
                }
                catch { /* ignore */ }
            }
        });
        const onModified = () => {
            try {
                cropRect.setCoords();
                this.canvas.requestRenderAll();
            }
            catch { /* ignore */ }
        };
        cropRect.on('modified', onModified);
        cropRect.on('moving', onModified);
        cropRect.on('scaling', onModified);
        this._cropHandlers = [{
                target: cropRect,
                handlers: [
                    { evt: 'modified', fn: onModified },
                    { evt: 'moving', fn: onModified },
                    { evt: 'scaling', fn: onModified },
                ],
            }];
        this._updateUI();
        this.canvas.renderAll();
    }
    /**
     * Cancels crop mode and removes the crop rectangle without applying it.
     */
    cancelCrop() {
        var _a, _b;
        if (!this.canvas || !this._cropMode)
            return;
        if (this._cropRect) {
            this._cropHandlers.forEach(h => {
                h.handlers.forEach(rec => {
                    try {
                        h.target.off(rec.evt, rec.fn);
                    }
                    catch { /* ignore */ }
                });
            });
            try {
                this.canvas.remove(this._cropRect);
            }
            catch { /* ignore */ }
            this._cropRect = null;
        }
        (_a = this._cropPrevEvented) === null || _a === void 0 ? void 0 : _a.forEach(i => {
            try {
                i.obj.evented = i.evented;
                i.obj.selectable = i.selectable;
            }
            catch { /* ignore */ }
        });
        this._cropPrevEvented = null;
        this._cropHandlers = [];
        this._cropMode = false;
        this.canvas.selection = (_b = this._prevSelectionSetting) !== null && _b !== void 0 ? _b : false;
        this._prevSelectionSetting = undefined;
        this.canvas.discardActiveObject();
        this._updateUI();
        this.canvas.renderAll();
    }
    /**
     * Applies the current crop rectangle: crops the image and reloads it.
     * Pushes the operation onto the undo/redo history.
     *
     * @returns Promise that resolves when the cropped image is loaded.
     */
    async applyCrop() {
        var _a;
        if (!this.canvas || !this._cropMode || !this._cropRect)
            return;
        this._cropRect.setCoords();
        const rectBounds = this._cropRect.getBoundingRect();
        const sx = Math.max(0, Math.round(rectBounds.left));
        const sy = Math.max(0, Math.round(rectBounds.top));
        const sw = Math.max(1, Math.round(Math.min(rectBounds.width, this.canvas.getWidth() - sx)));
        const sh = Math.max(1, Math.round(Math.min(rectBounds.height, this.canvas.getHeight() - sy)));
        // Snapshot before
        let beforeJson = null;
        try {
            const jsonObj = this.canvas.toJSON(['maskId', 'maskName', 'isCropRect']);
            if (Array.isArray(jsonObj.objects))
                jsonObj.objects = jsonObj.objects.filter(o => !o.isCropRect);
            beforeJson = JSON.stringify(jsonObj);
        }
        catch (e) {
            console.warn('[ImageEditor] applyCrop: could not serialize before state', e);
        }
        // Remove masks
        try {
            this.canvas.getObjects().filter(types_js_1.isMaskObject).forEach(m => {
                try {
                    this._removeLabelForMask(m);
                    this.canvas.remove(m);
                }
                catch { /* ignore */ }
            });
            this.canvas.discardActiveObject();
            this.canvas.renderAll();
        }
        catch (e) {
            console.warn('[ImageEditor] applyCrop: error removing masks', e);
        }
        // Remove crop rect
        this._cropHandlers.forEach(h => {
            h.handlers.forEach(rec => {
                try {
                    h.target.off(rec.evt, rec.fn);
                }
                catch { /* ignore */ }
            });
        });
        try {
            this.canvas.remove(this._cropRect);
        }
        catch { /* ignore */ }
        this._cropRect = null;
        this._cropMode = false;
        this.canvas.selection = (_a = this._prevSelectionSetting) !== null && _a !== void 0 ? _a : false;
        this._prevSelectionSetting = undefined;
        // Crop on off-screen canvas
        let croppedBase64;
        try {
            const fullDataUrl = this.canvas.toDataURL({
                format: 'jpeg',
                quality: this.options.downsampleQuality || 0.92,
                multiplier: 1,
            });
            croppedBase64 = await new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => {
                    try {
                        const oc = document.createElement('canvas');
                        oc.width = sw;
                        oc.height = sh;
                        oc.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
                        resolve(oc.toDataURL('image/jpeg', this.options.downsampleQuality || 0.92));
                    }
                    catch (err) {
                        reject(err);
                    }
                };
                img.onerror = reject;
                img.src = fullDataUrl;
            });
        }
        catch (e) {
            console.error('[ImageEditor] applyCrop: failed to create cropped image', e);
            this._updateUI();
            return;
        }
        try {
            await this.loadImage(croppedBase64);
        }
        catch (e) {
            console.error('[ImageEditor] applyCrop: loadImage failed', e);
            this._updateUI();
            return;
        }
        // Snapshot after + push history command
        let afterJson = null;
        try {
            const jsonObj2 = this.canvas.toJSON(['maskId', 'maskName', 'isCropRect']);
            if (Array.isArray(jsonObj2.objects))
                jsonObj2.objects = jsonObj2.objects.filter(o => !o.isCropRect);
            afterJson = JSON.stringify(jsonObj2);
        }
        catch (e) {
            console.warn('[ImageEditor] applyCrop: failed to serialize after state', e);
        }
        try {
            const cmd = new history_js_1.Command(() => { if (afterJson)
                void this.loadFromState(afterJson); }, () => { if (beforeJson)
                void this.loadFromState(beforeJson); });
            // Trim redo history, then push
            if (this.historyManager.currentIndex < this.historyManager.history.length - 1) {
                this.historyManager.history = this.historyManager.history.slice(0, this.historyManager.currentIndex + 1);
            }
            this.historyManager.history.push(cmd);
            if (this.historyManager.history.length > this.historyManager.maxSize) {
                this.historyManager.history.shift();
            }
            else {
                this.historyManager.currentIndex++;
            }
        }
        catch (e) {
            console.warn('[ImageEditor] applyCrop: failed to push history', e);
        }
        this._updateUI();
        this.canvas.renderAll();
    }
    // ═══════════════════════════════════════════════════════════════════════
    // PRIVATE — UI helpers
    // ═══════════════════════════════════════════════════════════════════════
    /** @internal */
    _updateInputs() {
        const scaleId = this.elements.scaleRate;
        if (!scaleId)
            return;
        const scaleEl = document.getElementById(scaleId);
        if (scaleEl)
            scaleEl.value = String(Math.round(this.currentScale * 100));
    }
    /** @internal */
    _updateUI() {
        if (!this.canvas)
            return;
        const hasImg = !!this.originalImage;
        const masks = hasImg ? this.canvas.getObjects().filter(types_js_1.isMaskObject) : [];
        const hasMasks = masks.length > 0;
        const active = this.canvas.getActiveObject();
        const hasSelectedMask = !!(active && (0, types_js_1.isMaskObject)(active));
        const isDefault = this.currentScale === 1 && this.currentRotation === 0;
        const canUndo = this.historyManager.canUndo();
        const canRedo = this.historyManager.canRedo();
        const inCrop = this._cropMode;
        if (inCrop) {
            Object.keys(this.elements).forEach(k => {
                const id = this.elements[k];
                if (!id)
                    return;
                const el = document.getElementById(id);
                if (!el)
                    return;
                el.disabled = !(k === 'applyCropBtn' || k === 'cancelCropBtn');
            });
            return;
        }
        this._setDisabled('zoomInBtn', !hasImg || this.isAnimating || this.currentScale >= this.options.maxScale);
        this._setDisabled('zoomOutBtn', !hasImg || this.isAnimating || this.currentScale <= this.options.minScale);
        this._setDisabled('rotateLeftBtn', !hasImg || this.isAnimating);
        this._setDisabled('rotateRightBtn', !hasImg || this.isAnimating);
        this._setDisabled('addMaskBtn', !hasImg || this.isAnimating);
        this._setDisabled('removeMaskBtn', !hasSelectedMask || this.isAnimating);
        this._setDisabled('removeAllMasksBtn', !hasMasks || this.isAnimating);
        this._setDisabled('mergeBtn', !hasImg || !hasMasks || this.isAnimating);
        this._setDisabled('downloadBtn', !hasImg || this.isAnimating);
        this._setDisabled('resetBtn', !hasImg || isDefault || this.isAnimating);
        this._setDisabled('undoBtn', !hasImg || this.isAnimating || !canUndo);
        this._setDisabled('redoBtn', !hasImg || this.isAnimating || !canRedo);
        this._setDisabled('cropBtn', !hasImg || this.isAnimating);
        this._setDisabled('applyCropBtn', true);
        this._setDisabled('cancelCropBtn', true);
    }
    /** @internal */
    _setDisabled(key, disabled) {
        const id = this.elements[key];
        if (!id)
            return;
        const el = document.getElementById(id);
        if (el)
            el.disabled = disabled;
    }
    /** @internal */
    _updatePlaceholderStatus() {
        if (!this.options.showPlaceholder)
            return;
        this._setPlaceholderVisible(!this.originalImage);
    }
    /** @internal */
    _setPlaceholderVisible(show) {
        var _a, _b;
        if (!this.placeholderEl)
            return;
        if (show) {
            this.placeholderEl.classList.remove('d-none');
            this.placeholderEl.classList.add('d-flex');
            (_a = this.containerEl) === null || _a === void 0 ? void 0 : _a.classList.add('d-none');
        }
        else {
            this.placeholderEl.classList.remove('d-flex');
            this.placeholderEl.classList.add('d-none');
            (_b = this.containerEl) === null || _b === void 0 ? void 0 : _b.classList.remove('d-none');
        }
    }
    // ═══════════════════════════════════════════════════════════════════════
    // PUBLIC — dispose
    // ═══════════════════════════════════════════════════════════════════════
    /**
     * Cleans up all DOM event listeners and disposes the Fabric.js Canvas.
     * Call this when the editor is no longer needed to prevent memory leaks.
     */
    dispose() {
        // Remove all bound DOM listeners
        Object.keys(this._boundHandlers).forEach(key => {
            var _a;
            const id = this.elements[key];
            if (!id)
                return;
            const el = document.getElementById(id);
            if (!el)
                return;
            ((_a = this._boundHandlers[key]) !== null && _a !== void 0 ? _a : []).forEach(h => {
                try {
                    el.removeEventListener(h.event, h.handler);
                }
                catch { /* ignore */ }
            });
        });
        if (this._cropRect && this.canvas) {
            try {
                this.canvas.remove(this._cropRect);
            }
            catch { /* ignore */ }
            this._cropRect = null;
        }
        if (this.canvas) {
            try {
                this.canvas.dispose();
            }
            catch { /* ignore */ }
            this.canvas = null;
            this.canvasEl = null;
            this.isImageLoadedToCanvas = false;
        }
        this._boundHandlers = {};
    }
}
exports.ImageEditor = ImageEditor;
//# sourceMappingURL=image-editor.js.map