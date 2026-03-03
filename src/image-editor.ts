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

import type * as FabricNS from 'fabric';
import { AnimationQueue } from './animation-queue.js';
import { Command, HistoryManager } from './history.js';
import type {
    BoundHandler,
    CropConfig,
    CropHandler,
    CropPrevEvented,
    ElementIdMap,
    ExportFileOptions,
    ExportOptions,
    FabricModule,
    ImageEditorOptions,
    LabelConfig,
    MaskBackup,
    MaskConfig,
    MaskNumericProp,
    MaskObject,
    ResolvedMaskConfig,
    ResolvedOptions,
} from './types.js';
import { isMaskObject } from './types.js';

// ─── Internal element-key type ────────────────────────────────────────────────

type ElementKey = keyof Required<ElementIdMap>;

// ─── Resolved element ID map (all keys guaranteed present) ───────────────────

type ResolvedElementIdMap = Record<ElementKey, string | null>;

// ─── Canvas JSON shape ────────────────────────────────────────────────────────

interface CanvasJSONObject {
    isCropRect?: boolean;
    maskId?: number;
    maskName?: string;
    type?: string;
    [key: string]: unknown;
}

interface CanvasJSON {
    objects?: CanvasJSONObject[];
    [key: string]: unknown;
}

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
export class ImageEditor {
    // ── Fabric injection ────────────────────────────────────────────────────
    /** @internal */ private readonly _fabric: FabricModule;
    /** @internal */ private readonly _fabricLoaded: boolean;

    // ── Resolved options ────────────────────────────────────────────────────
    /** @internal */ readonly options: ResolvedOptions;

    // ── Canvas / DOM ────────────────────────────────────────────────────────
    /** The underlying Fabric.js Canvas instance (available after {@link init}). */
    canvas: FabricNS.Canvas | null = null;
    /** @internal */ private canvasEl: HTMLCanvasElement | null = null;
    /** @internal */ private containerEl: HTMLElement | null = null;
    /** @internal */ private placeholderEl: HTMLElement | null = null;
    /** @internal */ private elements: ResolvedElementIdMap = {} as ResolvedElementIdMap;

    // ── Image state ─────────────────────────────────────────────────────────
    /** The primary image object on the canvas (set after a successful {@link loadImage}). */
    originalImage: FabricNS.FabricImage | null = null;
    /** @internal */ private baseImageScale = 1;
    /** Current scale factor (1 = original size). */
    currentScale = 1;
    /** Current rotation angle in degrees. */
    currentRotation = 0;
    /** Whether a valid image is currently rendered on the canvas. */
    isImageLoadedToCanvas = false;

    // ── Mask state ──────────────────────────────────────────────────────────
    /** @internal */ private maskCounter = 0;
    /** @internal */ private _lastMask: MaskObject | null = null;
    /** @internal */ private _lastMaskInitialLeft: number | null = null;
    /** @internal */ private _lastMaskInitialTop: number | null = null;
    /** @internal */ private _lastMaskInitialWidth: number | null = null;

    // ── History ─────────────────────────────────────────────────────────────
    /** @internal */ private _lastSnapshot: string | null = null;
    /** @internal */ readonly historyManager: HistoryManager;
    /** Maximum history entries retained. */
    readonly maxHistorySize: number;

    // ── Animation ───────────────────────────────────────────────────────────
    /** @internal */ private isAnimating = false;
    /** @internal */ private readonly animQueue: AnimationQueue;

    // ── Crop ────────────────────────────────────────────────────────────────
    /** @internal */ private _cropMode = false;
    /** @internal */ private _cropRect: FabricNS.Rect | null = null;
    /** @internal */ private _cropHandlers: CropHandler[] = [];
    /** @internal */ private _cropPrevEvented: CropPrevEvented[] | null = null;
    /** @internal */ private _prevSelectionSetting: boolean | undefined;

    // ── DOM event cleanup ───────────────────────────────────────────────────
    /** @internal */ private _boundHandlers: Partial<Record<ElementKey, BoundHandler[]>> = {};

    // ── Callbacks ───────────────────────────────────────────────────────────
    /** Optional callback invoked once each time an image finishes loading. */
    onImageLoaded: (() => void) | null;

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
    constructor(
        fabricModuleOrOptions: FabricModule | ImageEditorOptions = {},
        options: ImageEditorOptions = {},
    ) {
        // Detect whether the first argument is the fabric module or options
        if (
            fabricModuleOrOptions &&
            typeof (fabricModuleOrOptions as FabricModule).Canvas === 'function'
        ) {
            this._fabric = fabricModuleOrOptions as FabricModule;
        } else {
            // CDN global fallback
            const g = typeof globalThis !== 'undefined' ? globalThis : window;
            this._fabric = (g as Record<string, unknown>)['fabric'] as FabricModule;
            options = (fabricModuleOrOptions as ImageEditorOptions) ?? {};
        }

        this._fabricLoaded = !!(
            this._fabric && typeof this._fabric.Canvas === 'function'
        );

        if (!this._fabricLoaded) {
            console.error(
                '[ImageEditor] fabric.js v7 is not available. ' +
                'Pass it as the first constructor argument (ESM) or ' +
                'load it as a global <script> before instantiation.',
            );
        }

        // ── Resolve options ───────────────────────────────────────────────
        const base: Required<ImageEditorOptions> = {
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
            onImageLoaded: undefined as unknown as () => void,
        };

        const defaultLabel: LabelConfig = {
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

        const defaultCrop: Required<CropConfig> = {
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
        } as ResolvedOptions;

        // ── Internal state ────────────────────────────────────────────────
        this.maxHistorySize = 50;
        this.animQueue = new AnimationQueue();
        this.historyManager = new HistoryManager(this.maxHistorySize);
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
    init(idMap: ElementIdMap = {}): void {
        if (!this._fabricLoaded) return;

        const defaults: ResolvedElementIdMap = {
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

        this.elements = { ...defaults, ...idMap } as ResolvedElementIdMap;

        this._initCanvas();
        this._bindEvents();
        this._updateInputs();
        this._updateMaskList();
        this._updateUI();

        if (this.options.initialImageBase64) {
            void this.loadImage(this.options.initialImageBase64);
        } else {
            this._updatePlaceholderStatus();
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PRIVATE — canvas setup
    // ═══════════════════════════════════════════════════════════════════════

    /** @internal */
    private _initCanvas(): void {
        const id = this.elements.canvas;
        const canvasEl = id ? (document.getElementById(id) as HTMLCanvasElement | null) : null;
        if (!canvasEl) throw new Error(`[ImageEditor] Canvas element not found: "${id}"`);
        this.canvasEl = canvasEl;

        const containerId = this.elements.canvasContainer;
        if (containerId) {
            this.containerEl = document.getElementById(containerId) ?? canvasEl.parentElement;
        } else {
            this.containerEl = canvasEl.parentElement;
        }

        const phId = this.elements.imgPlaceholder;
        this.placeholderEl = phId ? document.getElementById(phId) : null;

        let initialW = this.options.canvasWidth;
        let initialH = this.options.canvasHeight;
        if (this.containerEl) {
            const cw = Math.floor(this.containerEl.clientWidth);
            const ch = Math.floor(this.containerEl.clientHeight);
            if (cw > 0 && ch > 0) { initialW = cw; initialH = ch; }
        }

        this.canvas = new this._fabric.Canvas(canvasEl, {
            width: initialW,
            height: initialH,
            backgroundColor: this.options.backgroundColor,
            selection: this.options.groupSelection,
            preserveObjectStacking: true,
        });

        this.canvas.on('selection:created', (e) => {
            this._onSelectionChanged((e as { selected: FabricNS.FabricObject[] }).selected);
        });
        this.canvas.on('selection:updated', (e) => {
            this._onSelectionChanged((e as { selected: FabricNS.FabricObject[] }).selected);
        });
        this.canvas.on('selection:cleared', () => this._onSelectionChanged([]));

        const onObjectEvent = (e: { target?: FabricNS.FabricObject }) => {
            if (e.target && isMaskObject(e.target)) this._syncMaskLabel(e.target);
        };
        this.canvas.on('object:moving',   onObjectEvent);
        this.canvas.on('object:scaling',  onObjectEvent);
        this.canvas.on('object:rotating', onObjectEvent);
        this.canvas.on('object:modified', onObjectEvent);

        canvasEl.style.display = 'block';
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PRIVATE — DOM / UI bindings
    // ═══════════════════════════════════════════════════════════════════════

    /** @internal */
    private _bindEvents(): void {
        this._bindIfExists('uploadArea', 'click', () => {
            const inputId = this.elements.imageInput;
            if (inputId) document.getElementById(inputId)?.click();
        });

        const inputId = this.elements.imageInput;
        const inputEl = inputId ? document.getElementById(inputId) as HTMLInputElement | null : null;
        if (inputEl) {
            inputEl.addEventListener('change', (e) => {
                const f = (e.target as HTMLInputElement).files?.[0];
                if (f) this._loadImageFile(f);
            });
        }

        this._bindIfExists('zoomInBtn',  'click', () => { void this.scaleImage(this.currentScale + this.options.scaleStep); });
        this._bindIfExists('zoomOutBtn', 'click', () => { void this.scaleImage(this.currentScale - this.options.scaleStep); });
        this._bindIfExists('resetBtn',   'click', () => { void this.reset(); });

        this._bindIfExists('addMaskBtn',        'click', () => { this.addMask(); });
        this._bindIfExists('removeMaskBtn',     'click', () => { this.removeSelectedMask(); });
        this._bindIfExists('removeAllMasksBtn', 'click', () => { this.removeAllMasks(); });

        this._bindIfExists('mergeBtn',    'click', () => { void this.merge(); });
        this._bindIfExists('downloadBtn', 'click', () => { this.downloadImage(); });

        this._bindIfExists('undoBtn', 'click', () => { this.undo(); });
        this._bindIfExists('redoBtn', 'click', () => { this.redo(); });

        const rotLeftId  = this.elements.rotateLeftBtn;
        const rotRightId = this.elements.rotateRightBtn;

        const rotLeftEl  = rotLeftId  ? document.getElementById(rotLeftId)  : null;
        const rotRightEl = rotRightId ? document.getElementById(rotRightId) : null;

        if (rotLeftEl) {
            rotLeftEl.addEventListener('click', () => {
                const el = this.elements.rotationLeftInput
                    ? document.getElementById(this.elements.rotationLeftInput) as HTMLInputElement | null
                    : null;
                let step = this.options.rotationStep;
                if (el) { const p = parseFloat(el.value); if (!isNaN(p)) step = p; }
                void this.rotateImage(this.currentRotation - step);
            });
        }
        if (rotRightEl) {
            rotRightEl.addEventListener('click', () => {
                const el = this.elements.rotationRightInput
                    ? document.getElementById(this.elements.rotationRightInput) as HTMLInputElement | null
                    : null;
                let step = this.options.rotationStep;
                if (el) { const p = parseFloat(el.value); if (!isNaN(p)) step = p; }
                void this.rotateImage(this.currentRotation + step);
            });
        }

        this._bindIfExists('cropBtn',       'click', () => { this.enterCropMode(); });
        this._bindIfExists('applyCropBtn',  'click', () => { void this.applyCrop().catch(e => console.error('[ImageEditor] applyCrop failed', e)); });
        this._bindIfExists('cancelCropBtn', 'click', () => { this.cancelCrop(); });
    }

    /** @internal */
    private _bindIfExists(key: ElementKey, event: string, handler: EventListener): void {
        const id = this.elements[key];
        if (!id) return;
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener(event, handler);
        if (!this._boundHandlers[key]) this._boundHandlers[key] = [];
        this._boundHandlers[key]!.push({ event, handler });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PRIVATE — image loading
    // ═══════════════════════════════════════════════════════════════════════

    /** @internal */
    private _loadImageFile(file: File): void {
        if (!file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload  = (e) => { if (e.target?.result) void this.loadImage(e.target.result as string); };
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
    async loadImage(base64: string): Promise<void> {
        if (!this._fabricLoaded || !this.canvas) return;
        if (!base64.startsWith('data:image/')) return;

        this._setPlaceholderVisible(false);

        const imgEl = await this._createImageElement(base64);

        let loadSrc = base64;
        if (this.options.downsampleOnLoad) {
            const needResize =
                imgEl.naturalWidth  > this.options.downsampleMaxWidth ||
                imgEl.naturalHeight > this.options.downsampleMaxHeight;
            if (needResize) {
                const ratio = Math.min(
                    this.options.downsampleMaxWidth  / imgEl.naturalWidth,
                    this.options.downsampleMaxHeight / imgEl.naturalHeight,
                );
                loadSrc = this._resampleImageToDataURL(
                    imgEl,
                    Math.round(imgEl.naturalWidth  * ratio),
                    Math.round(imgEl.naturalHeight * ratio),
                    this.options.downsampleQuality,
                );
            }
        }

        let fimg: FabricNS.FabricImage;
        try {
            // v7: fromURL returns a Promise
            fimg = await this._fabric.Image.fromURL(loadSrc, { crossOrigin: 'anonymous' });
        } catch (err) {
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

        const imgW = fimg.width  ?? 0;
        const imgH = fimg.height ?? 0;
        const minW = this.containerEl
            ? Math.floor(this.containerEl.clientWidth  || this.options.canvasWidth)
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
            this.baseImageScale = fimg.scaleX ?? 1;

        } else if (this.options.coverImageToCanvas) {
            const cw = Math.max(this.options.canvasWidth, minW);
            const ch = Math.max(this.options.canvasHeight, minH);
            this._setCanvasSizeInt(cw, ch);
            const coverScale = Math.min(1, Math.max(cw / imgW, ch / imgH));
            fimg.set({ left: 0, top: 0 });
            fimg.scale(coverScale);
            this.baseImageScale = fimg.scaleX ?? 1;

        } else if (this.options.expandCanvasToImage) {
            const cw = Math.max(minW, Math.floor(imgW));
            const ch = Math.max(minH, Math.floor(imgH));
            this._setCanvasSizeInt(cw, ch);
            fimg.set({ left: 0, top: 0 });
            fimg.scale(1);
            this.baseImageScale = 1;

        } else {
            const cw = Math.max(this.options.canvasWidth, minW);
            const ch = Math.max(this.options.canvasHeight, minH);
            this._setCanvasSizeInt(cw, ch);
            const fitScale = Math.min(cw / imgW, ch / imgH, 1);
            fimg.set({ left: 0, top: 0 });
            fimg.scale(fitScale);
            this.baseImageScale = fimg.scaleX ?? 1;
        }

        this.originalImage = fimg;
        this.canvas.add(fimg);
        // v7: sendObjectToBack()
        this.canvas.sendObjectToBack(fimg);

        this._lastMask              = null;
        this._lastMaskInitialLeft   = null;
        this._lastMaskInitialTop    = null;
        this._lastMaskInitialWidth  = null;

        this.maskCounter          = 0;
        this.currentScale         = 1;
        this.currentRotation      = 0;

        this._updateInputs();
        this._updateMaskList();
        this._updateUI();
        this.canvas.renderAll();
        this.isImageLoadedToCanvas = true;

        this.onImageLoaded?.();
    }

    /**
     * Returns `true` if a valid image is currently loaded on the canvas.
     */
    isImageLoaded(): boolean {
        return !!(
            this.originalImage &&
            this.originalImage instanceof this._fabric.Image &&
            (this.originalImage.width ?? 0) > 0 &&
            (this.originalImage.height ?? 0) > 0
        );
    }

    /** @internal */
    private _createImageElement(dataURL: string): Promise<HTMLImageElement> {
        return new Promise((res, rej) => {
            const img = new Image();
            img.onload  = () => { img.onload = img.onerror = null; res(img); };
            img.onerror = (e) => { img.onload = img.onerror = null; rej(e);  };
            img.src = dataURL;
        });
    }

    /** @internal */
    private _resampleImageToDataURL(
        imgEl: HTMLImageElement,
        w: number,
        h: number,
        quality = 0.92,
    ): string {
        const oc = document.createElement('canvas');
        oc.width  = w;
        oc.height = h;
        oc.getContext('2d')!.drawImage(
            imgEl, 0, 0, imgEl.naturalWidth, imgEl.naturalHeight, 0, 0, w, h,
        );
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
    private _setCanvasSizeInt(w: number, h: number): void {
        const iw = Math.max(1, Math.round(Number(w) || 1));
        const ih = Math.max(1, Math.round(Number(h) || 1));
        this.canvas!.setDimensions({ width: iw, height: ih });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PRIVATE — geometry helpers
    // ═══════════════════════════════════════════════════════════════════════

    /** @internal */
    private _getObjectTopLeftPoint(obj: FabricNS.FabricObject): FabricNS.Point {
        obj.setCoords();
        const coords = obj.getCoords();
        const first = coords[0];
        if (first) return first as unknown as FabricNS.Point;
        // Fallback: top-left of bounding rect (v7: no params)
        const br = obj.getBoundingRect();
        return new this._fabric.Point(br.left, br.top);
    }

    /** @internal */
    private _setObjectOriginKeepingPosition(
        obj: FabricNS.FabricObject,
        originX: FabricNS.TOriginX,
        originY: FabricNS.TOriginY,
        refPoint: FabricNS.Point,
    ): void {
        obj.set({ originX, originY });
        obj.setPositionByOrigin(refPoint, originX, originY);
        obj.setCoords();
    }

    /** @internal */
    private _alignObjectBoundingBoxToCanvasTopLeft(obj: FabricNS.FabricObject): void {
        obj.setCoords();
        const br = obj.getBoundingRect(); // v7: always absolute, no params
        obj.set({ left: (obj.left ?? 0) - br.left, top: (obj.top ?? 0) - br.top });
        obj.setCoords();
        this.canvas!.renderAll();
    }

    /** @internal */
    private _updateCanvasSizeToImageBounds(): void {
        if (!this.originalImage) return;
        this.originalImage.setCoords();
        const br = this.originalImage.getBoundingRect();

        const containerW = this.containerEl ? Math.ceil(this.containerEl.clientWidth  || 0) : 0;
        const containerH = this.containerEl ? Math.ceil(this.containerEl.clientHeight || 0) : 0;

        // If image fits inside the viewport, keep the canvas viewport-sized
        if (containerW > 0 && containerH > 0 && br.width <= containerW && br.height <= containerH) {
            this._setCanvasSizeInt(containerW, containerH);
            return;
        }

        this._setCanvasSizeInt(
            Math.max(containerW || 0, Math.floor(br.width)),
            Math.max(containerH || 0, Math.floor(br.height)),
        );
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
    scaleImage(factor: number): Promise<void> {
        return this.animQueue.add(() => this._scaleImageImpl(factor));
    }

    /** @internal */
    private async _scaleImageImpl(factor: number): Promise<void> {
        if (!this.originalImage || !this.canvas || this.isAnimating) return;

        factor = Math.max(this.options.minScale, Math.min(this.options.maxScale, factor));
        this.currentScale = factor;
        this.isAnimating  = true;
        this._updateUI();

        const targetAbs = this.baseImageScale * factor;
        const topLeft   = this._getObjectTopLeftPoint(this.originalImage);
        this._setObjectOriginKeepingPosition(this.originalImage, 'left', 'top', topLeft);

        try {
            // v7: animate() returns Animation[], NOT a Promise.
            // Multi-prop animation fires onComplete once per property;
            // we count both completions before resolving.
            await new Promise<void>((resolve, reject) => {
                let completed = 0;
                const onComplete = () => { if (++completed >= 2) resolve(); };
                try {
                    this.originalImage!.animate(
                        { scaleX: targetAbs, scaleY: targetAbs },
                        {
                            duration: this.options.animationDuration,
                            onChange: () => this.canvas!.requestRenderAll(),
                            onComplete,
                        },
                    );
                } catch (e) { reject(e); }
            });

            this.originalImage.set({ scaleX: targetAbs, scaleY: targetAbs });
            this.originalImage.setCoords();

            if (this.options.expandCanvasToImage) this._updateCanvasSizeToImageBounds();
            this._alignObjectBoundingBoxToCanvasTopLeft(this.originalImage);

            this.canvas.getObjects()
                .filter(isMaskObject)
                .forEach(m => this._syncMaskLabel(m));

            this.isAnimating = false;
            this._updateInputs();
            this._updateUI();
            this.saveState();
        } catch (err) {
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
    rotateImage(degrees: number): Promise<void> {
        return this.animQueue.add(() => this._rotateImageImpl(degrees));
    }

    /** @internal */
    private async _rotateImageImpl(degrees: number): Promise<void> {
        if (!this.originalImage || !this.canvas || this.isAnimating || isNaN(degrees)) return;

        this.currentRotation = degrees;
        this.isAnimating     = true;
        this._updateUI();

        const center = this.originalImage.getCenterPoint();
        this._setObjectOriginKeepingPosition(this.originalImage, 'center', 'center', center);

        try {
            // v7: single-prop animate(), onComplete used as Promise hook
            await new Promise<void>((resolve, reject) => {
                try {
                    this.originalImage!.animate(
                        { angle: degrees },
                        {
                            duration: this.options.animationDuration,
                            onChange: () => this.canvas!.requestRenderAll(),
                            onComplete: () => resolve(),
                        },
                    );
                } catch (e) { reject(e); }
            });

            this.originalImage.set('angle', degrees);
            this.originalImage.setCoords();

            if (this.options.expandCanvasToImage) this._updateCanvasSizeToImageBounds();
            this._alignObjectBoundingBoxToCanvasTopLeft(this.originalImage);

            const newTopLeft = this._getObjectTopLeftPoint(this.originalImage);
            this._setObjectOriginKeepingPosition(this.originalImage, 'left', 'top', newTopLeft);

            this.canvas.getObjects()
                .filter(isMaskObject)
                .forEach(m => this._syncMaskLabel(m));

            this.isAnimating = false;
            this._updateInputs();
            this._updateUI();
            this.saveState();
        } catch (err) {
            console.warn('[ImageEditor] rotateImage animation error', err);
            this.isAnimating = false;
            this._updateUI();
        }
    }

    /**
     * Resets the image to scale 1 and rotation 0 (animated).
     * @returns Promise that resolves when complete.
     */
    reset(): Promise<void> {
        if (!this.originalImage) return Promise.resolve();
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
    async loadFromState(jsonString: string | CanvasJSON): Promise<void> {
        if (!jsonString || !this.canvas) return;

        try {
            const json: CanvasJSON = typeof jsonString === 'string'
                ? (JSON.parse(jsonString) as CanvasJSON)
                : jsonString;

            // v7: loadFromJSON returns a Promise
            await this.canvas.loadFromJSON(json as Parameters<FabricNS.Canvas['loadFromJSON']>[0]);

            this._hideAllMaskLabels();
            const objs = this.canvas.getObjects();

            this.originalImage = (
                objs.find(o => o.type === 'image' && !isMaskObject(o)) ?? null
            ) as FabricNS.FabricImage | null;

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
                .filter(isMaskObject)
                .reduce((max, m) => Math.max(max, m.maskId), 0);

            this.canvas.renderAll();
            this._updateMaskList();
            this._updateUI();
        } catch (e) {
            console.error('[ImageEditor] loadFromState() failed', e);
        }
    }

    /**
     * Captures the current canvas state into the undo/redo history.
     * Called automatically after transforms, mask operations, and crop.
     */
    saveState(): void {
        if (!this.canvas) return;
        const activeObj = this.canvas.getActiveObject();
        this._hideAllMaskLabels();

        try {
            const jsonObj = (this.canvas as any).toJSON(['maskId', 'maskName', 'isCropRect']) as CanvasJSON;
            if (Array.isArray(jsonObj.objects)) {
                jsonObj.objects = jsonObj.objects.filter(o => !o.isCropRect);
            }

            const after  = JSON.stringify(jsonObj);
            const before = this._lastSnapshot ?? after;
            let executedOnce = false;

            const cmd = new Command(
                () => { if (executedOnce) { void this.loadFromState(after); } executedOnce = true; },
                () => { void this.loadFromState(before); },
            );

            this.historyManager.execute(cmd);
            this._lastSnapshot = after;

            if (activeObj && isMaskObject(activeObj)) this._showLabelForMask(activeObj);
            this._updateUI();
        } catch (err) {
            console.warn('[ImageEditor] saveState: failed to save canvas snapshot', err);
        }
    }

    /** Undoes the last recorded action. */
    undo(): void { this.historyManager.undo(); }

    /** Redoes the next recorded action. */
    redo(): void { this.historyManager.redo(); }

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
    addMask(config: MaskConfig = {}): MaskObject | null {
        if (!this.canvas) return null;

        const shapeType = config.shape ?? 'rect';
        const cfg: ResolvedMaskConfig = {
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
        } as ResolvedMaskConfig;

        const firstOffset = 10;
        const canvas = this.canvas;

        const resolveNumeric = (
            val: MaskNumericProp | undefined,
            fallback: number,
        ): number => {
            if (typeof val === 'function') return val(canvas, this.options);
            if (typeof val === 'string' && val.endsWith('%')) {
                return Math.floor(canvas.getWidth() * (parseFloat(val) / 100));
            }
            return typeof val === 'number' ? val : fallback;
        };

        let left: number;
        let top: number;

        if (config.left === undefined && this._lastMask) {
            const prev    = this._lastMask;
            const prevRight = (prev.left ?? 0) + (
                typeof prev.getScaledWidth === 'function'
                    ? prev.getScaledWidth()
                    : (prev.width ?? 0) * (prev.scaleX ?? 1)
            );
            left = Math.round(prevRight + (cfg.gap ?? 5));
            top  = prev.top ?? firstOffset;
        } else {
            left = resolveNumeric(config.left, firstOffset);
            top  = resolveNumeric(config.top,  firstOffset);
        }

        cfg.width  = resolveNumeric(config.width,  this.options.defaultMaskWidth);
        cfg.height = resolveNumeric(config.height, this.options.defaultMaskHeight);

        // Expand canvas only if mask placement exceeds the current canvas size.
        // Never use containerEl dimensions as a floor here — that would shrink
        // a wider-than-viewport canvas (removing its scrollbar).
        if (this.options.expandCanvasToImage) {
            const reqW = Math.ceil(left + cfg.width  + 10);
            const reqH = Math.ceil(top  + cfg.height + 10);
            const newW = Math.max(canvas.getWidth(),  reqW);
            const newH = Math.max(canvas.getHeight(), reqH);
            if (newW !== canvas.getWidth() || newH !== canvas.getHeight()) {
                this._setCanvasSizeInt(newW, newH);
            }
        }

        // ── Build the Fabric shape ─────────────────────────────────────────
        const fb = this._fabric;
        let mask: FabricNS.FabricObject;

        if (typeof cfg.fabricGenerator === 'function') {
            mask = cfg.fabricGenerator(cfg, canvas, this.options);
        } else {
            // v7: All new objects default to originX/Y 'center'/'center'.
            //     We declare 'left'/'top' so coordinates refer to the top-left corner,
            //     matching the v5 behavior and the placement logic above.
            const originProps = { originX: 'left' as FabricNS.TOriginX, originY: 'top' as FabricNS.TOriginY };
            const rx = config.rx !== undefined ? resolveNumeric(config.rx, 0) : undefined;
            const ry = config.ry !== undefined ? resolveNumeric(config.ry, 0) : undefined;

            switch (shapeType) {
                case 'circle':
                    mask = new fb.Circle({
                        left, top, ...originProps,
                        radius: resolveNumeric(config.radius, Math.min(cfg.width, cfg.height) / 2),
                        fill: cfg.color, opacity: cfg.alpha, angle: cfg.angle ?? 0,
                        ...cfg.styles,
                    });
                    break;
                case 'ellipse':
                    mask = new fb.Ellipse({
                        left, top, ...originProps,
                        rx: rx ?? cfg.width  / 2,
                        ry: ry ?? cfg.height / 2,
                        fill: cfg.color, opacity: cfg.alpha, angle: cfg.angle ?? 0,
                        ...cfg.styles,
                    });
                    break;
                case 'polygon': {
                    const pts = (config.points ?? []).map(pt => ({
                        x: Number(pt.x), y: Number(pt.y),
                    }));
                    mask = new fb.Polygon(pts, {
                        left, top, ...originProps,
                        fill: cfg.color, opacity: cfg.alpha, angle: cfg.angle ?? 0,
                        ...cfg.styles,
                    });
                    break;
                }
                case 'rect':
                default:
                    mask = new fb.Rect({
                        left, top, ...originProps,
                        width:  cfg.width,
                        height: cfg.height,
                        fill: cfg.color, opacity: cfg.alpha, angle: cfg.angle ?? 0,
                        ...(rx !== undefined ? { rx } : {}),
                        ...(ry !== undefined ? { ry } : {}),
                        ...cfg.styles,
                    });
            }
        }

        // ── Common mask properties ─────────────────────────────────────────
        const m = mask as MaskObject;
        m.selectable         = cfg.selectable !== false;
        m.hasControls        = 'hasControls' in cfg ? !!cfg.hasControls : true;
        m.lockRotation       = !this.options.maskRotatable;
        m.borderColor        = config.borderColor  ?? 'red';
        m.cornerColor        = config.cornerColor  ?? 'black';
        m.cornerSize         = config.cornerSize   ?? 8;
        m.transparentCorners = config.transparentCorners ?? false;
        m.stroke             = cfg.styles?.stroke      as string ?? '#ccc';
        m.strokeWidth        = cfg.styles?.strokeWidth as number ?? 1;
        m.strokeUniform      = config.strokeUniform ?? true;
        if (cfg.styles?.strokeDashArray) m.strokeDashArray = cfg.styles.strokeDashArray as number[];

        m.originalAlpha = cfg.alpha;
        const normalStyle = { stroke: m.stroke, strokeWidth: m.strokeWidth, opacity: m.originalAlpha };
        const hoverStyle  = {
            stroke: '#ff5500', strokeWidth: 2,
            opacity: Math.min(m.originalAlpha + 0.2, 1),
        };

        m.on('mouseover', () => { m.set(hoverStyle);  m.canvas?.requestRenderAll(); });
        m.on('mouseout',  () => { m.set(normalStyle); m.canvas?.requestRenderAll(); });

        m.maskId   = ++this.maskCounter;
        m.maskName = `${this.options.maskName}${m.maskId}`;
        this._lastMask             = m;
        this._lastMaskInitialLeft  = left;
        this._lastMaskInitialTop   = top;
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

        cfg.onCreate?.(m, canvas);
        return m;
    }

    /**
     * Removes the currently selected mask (and its label).
     */
    removeSelectedMask(): void {
        if (!this.canvas) return;
        const active = this.canvas.getActiveObject();
        if (!active || !isMaskObject(active)) return;
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
    removeAllMasks(): void {
        if (!this.canvas) return;
        this.canvas.getObjects().filter(isMaskObject).forEach(m => {
            this._removeLabelForMask(m);
            this.canvas!.remove(m);
        });
        this.canvas.discardActiveObject();
        this._lastMask             = null;
        this._lastMaskInitialLeft  = null;
        this._lastMaskInitialTop   = null;
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
    private _removeLabelForMask(mask: MaskObject): void {
        if (!this.canvas || !mask.__label) return;
        try {
            if (this.canvas.getObjects().includes(mask.__label)) {
                this.canvas.remove(mask.__label);
            }
        } catch { /* ignore */ }
        try { delete mask.__label; } catch { /* ignore */ }
    }

    /** @internal */
    private _createLabelForMask(mask: MaskObject): void {
        if (!this.canvas || !this.options.maskLabelOnSelect) return;
        this._removeLabelForMask(mask);

        let textObj: FabricNS.FabricText | null = null;

        if (typeof this.options.label.create === 'function') {
            textObj = this.options.label.create(mask, this._fabric);
        }

        if (!textObj) {
            const txt = typeof this.options.label.getText === 'function'
                ? this.options.label.getText(mask, this.maskCounter)
                : mask.maskName;

            const textOptions: Partial<FabricNS.TextProps> = {
                left: 0, top: 0,
                fontSize: 12, fill: '#fff',
                backgroundColor: 'rgba(0,0,0,0.7)',
                selectable: false, evented: false,
                padding: 2, originX: 'left', originY: 'top',
                ...this.options.label.textOptions,
            };

            textObj = new this._fabric.Text(txt, textOptions);
        }

        (textObj as FabricNS.FabricText & { maskLabel?: boolean }).maskLabel = true;
        mask.__label = textObj;
        this.canvas.add(textObj);
        // v7: bringObjectToFront()
        this.canvas.bringObjectToFront(textObj);
        this._syncMaskLabel(mask);
    }

    /** @internal */
    private _hideAllMaskLabels(): void {
        if (!this.canvas) return;
        const objs = this.canvas.getObjects();
        objs
            .filter(o => (o as FabricNS.FabricObject & { maskLabel?: boolean }).maskLabel)
            .forEach(l => { try { this.canvas!.remove(l); } catch { /* ignore */ } });
        objs
            .filter(isMaskObject)
            .forEach(o => { try { delete o.__label; } catch { /* ignore */ } });
    }

    /** @internal */
    private _syncMaskLabel(mask: MaskObject): void {
        if (!this.canvas || !this.options.maskLabelOnSelect || !mask.__label) return;
        const coords = mask.getCoords?.();
        if (!coords?.length) return;

        const tl     = coords[0];
        if (!tl) return;
        const center = mask.getCenterPoint();
        const vx     = center.x - tl.x;
        const vy     = center.y - tl.y;
        const dist   = Math.sqrt(vx * vx + vy * vy) || 1;
        const offset = Math.max(0, this.options.maskLabelOffset ?? 3);

        mask.__label.set({
            left:    Math.round(tl.x + (vx / dist) * offset),
            top:     Math.round(tl.y + (vy / dist) * offset),
            angle:   mask.angle ?? 0,
            originX: 'left',
            originY: 'top',
            visible: true,
        });
        mask.__label.setCoords();
        this.canvas.renderAll();
    }

    /** @internal */
    private _showLabelForMask(mask: MaskObject): void {
        if (!this.options.maskLabelOnSelect) return;
        if (!mask.__label) this._createLabelForMask(mask);
        if (mask.__label) { mask.__label.visible = true; this._syncMaskLabel(mask); }
    }

    /** @internal */
    private _onSelectionChanged(selected: FabricNS.FabricObject[]): void {
        if (!this.canvas) return;
        const selectedMask = selected.find(isMaskObject) ?? null;
        const masks = this.canvas.getObjects().filter(isMaskObject);

        masks.forEach(m => {
            if (m !== selectedMask) {
                if (m.__label) {
                    try { this.canvas!.remove(m.__label); } catch { /* ignore */ }
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

    // ═══════════════════════════════════════════════════════════════════════
    // PRIVATE — mask list DOM
    // ═══════════════════════════════════════════════════════════════════════

    /** @internal */
    private _updateMaskList(): void {
        const listId = this.elements.maskList;
        if (!listId) return;
        const listEl = document.getElementById(listId);
        if (!listEl || !this.canvas) return;
        listEl.innerHTML = '';

        this.canvas.getObjects().filter(isMaskObject).forEach(mask => {
            const li = document.createElement('li');
            li.className   = 'list-group-item mask-item';
            li.textContent = mask.maskName;
            li.onclick     = () => {
                this.canvas!.setActiveObject(mask);
                this._onSelectionChanged([mask]);
            };
            listEl.appendChild(li);
        });
    }

    /** @internal */
    private _updateMaskListSelection(selectedMask: MaskObject | null): void {
        const listId = this.elements.maskList;
        if (!listId) return;
        const listEl = document.getElementById(listId);
        if (!listEl) return;
        listEl.querySelectorAll<HTMLElement>('.mask-item').forEach(item => {
            item.classList.toggle(
                'active',
                !!(selectedMask && item.textContent === selectedMask.maskName),
            );
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
    async merge(): Promise<void> {
        if (!this.originalImage || !this.canvas) return;
        const masks = this.canvas.getObjects().filter(isMaskObject);
        if (!masks.length) return;

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
        } catch (err) {
            console.error('[ImageEditor] merge error', err);
        }
    }

    /**
     * Triggers a browser download of the current canvas as a JPEG.
     *
     * @param fileName Filename for the downloaded file.
     *   @default `options.defaultDownloadFileName`
     */
    downloadImage(fileName = this.options.defaultDownloadFileName): void {
        if (!this.originalImage) return;
        this.getImageBase64({
            exportImageArea: this.options.exportImageAreaByDefault,
            multiplier: this.options.exportMultiplier,
        }).then(base64 => {
            const link = document.createElement('a');
            link.download = fileName;
            link.href     = base64;
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
    async getImageBase64(options: ExportOptions = {}): Promise<string> {
        if (!this.originalImage || !this.canvas) throw new Error('[ImageEditor] No image loaded');

        const exportImageArea = options.exportImageArea ?? this.options.exportImageAreaByDefault;
        const multiplier      = options.multiplier      ?? this.options.exportMultiplier ?? 1;

        // Plain export (no mask overlay)
        if (!exportImageArea) {
            const imgEl = (this.originalImage.getElement?.() ??
                (this.originalImage as unknown as { _element?: HTMLImageElement })._element) as
                HTMLImageElement | null;

            if (!imgEl) {
                return this.canvas.toDataURL({
                    format: 'jpeg',
                    quality: this.options.downsampleQuality,
                    multiplier,
                });
            }
            const oc  = document.createElement('canvas');
            oc.width  = this.originalImage.width  ?? 0;
            oc.height = this.originalImage.height ?? 0;
            oc.getContext('2d')!.drawImage(imgEl, 0, 0, oc.width, oc.height);
            return oc.toDataURL('image/jpeg', this.options.downsampleQuality);
        }

        // Export with masks baked in
        const masks = this.canvas.getObjects().filter(isMaskObject);

        const masksBackup: MaskBackup[] = masks.map(m => ({
            obj: m,
            opacity:      m.opacity ?? 1,
            fill:         m.fill    ?? null,
            strokeWidth:  m.strokeWidth ?? 0,
            stroke:       m.stroke  ?? null,
            selectable:   m.selectable ?? true,
            lockRotation: m.lockRotation ?? false,
        }));

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

        const finalBase64 = await new Promise<string>((resolve, reject) => {
            const fullDataUrl = this.canvas!.toDataURL({
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
                    const oc  = document.createElement('canvas');
                    oc.width  = swM; oc.height = shM;
                    oc.getContext('2d')!.drawImage(img, sxM, syM, swM, shM, 0, 0, swM, shM);
                    resolve(oc.toDataURL('image/jpeg', this.options.downsampleQuality));
                } catch (e) { reject(e); }
            };
            img.onerror = reject;
            img.src     = fullDataUrl;
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
            } catch { /* ignore */ }
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
    async exportImageFile(options: ExportFileOptions = {}): Promise<File> {
        if (!this.originalImage) throw new Error('[ImageEditor] No image loaded');

        const {
            mergeMask  = true,
            fileType   = 'jpeg',
            quality    = this.options.downsampleQuality,
            multiplier = this.options.exportMultiplier,
            fileName   = this.options.defaultDownloadFileName,
        } = options;

        const typeMap: Record<string, string> = {
            jpeg: 'jpeg', jpg: 'jpeg', 'image/jpeg': 'jpeg',
            png:  'png',  'image/png':  'png',
            webp: 'webp', 'image/webp': 'webp',
        };
        const safeType = typeMap[fileType.toLowerCase()] ?? 'jpeg';

        let base64 = await this.getImageBase64({ exportImageArea: mergeMask, multiplier });

        if (!base64.startsWith(`data:image/${safeType}`)) {
            base64 = await new Promise<string>((resolve, reject) => {
                const img = new window.Image();
                img.crossOrigin = 'Anonymous';
                img.onload = () => {
                    try {
                        const oc = document.createElement('canvas');
                        oc.width  = img.width;
                        oc.height = img.height;
                        oc.getContext('2d')!.drawImage(img, 0, 0);
                        resolve(oc.toDataURL(`image/${safeType}`, quality));
                    } catch (e) { reject(e); }
                };
                img.onerror = reject;
                img.src     = base64;
            });
        }

        const bstr  = atob(base64.split(',').slice(1).join(','));
        const u8arr = new Uint8Array(bstr.length);
        for (let n = bstr.length - 1; n >= 0; n--) u8arr[n] = bstr.charCodeAt(n);
        return new File([u8arr], fileName, { type: `image/${safeType}` });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PUBLIC — crop mode
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Enters crop mode: adds a resizable selection rect to the canvas.
     * All other controls are disabled until {@link applyCrop} or {@link cancelCrop} is called.
     */
    enterCropMode(): void {
        if (!this.canvas || !this.originalImage || this._cropMode) return;
        if (!this.isImageLoaded()) return;

        this._cropMode             = true;
        this._prevSelectionSetting = this.canvas.selection;
        this.canvas.selection      = false;
        this.canvas.discardActiveObject();

        this.originalImage.setCoords();
        const imgBr  = this.originalImage.getBoundingRect();
        const padding = this.options.crop?.padding ?? 10;

        const left   = Math.max(0, Math.floor(imgBr.left + padding));
        const top    = Math.max(0, Math.floor(imgBr.top  + padding));
        const width  = Math.max(this.options.crop.minWidth,  Math.floor(imgBr.width  - padding * 2));
        const height = Math.max(this.options.crop.minHeight, Math.floor(imgBr.height - padding * 2));

        const cropRect = new this._fabric.Rect({
            left, top, width, height,
            originX: 'left', originY: 'top',
            fill:            'rgba(0,0,0,0.12)',
            stroke:          '#00aaff',
            strokeDashArray: [6, 4],
            strokeWidth:     1,
            strokeUniform:   true,
            selectable:      true,
            hasRotatingPoint: !!(this.options.crop?.allowRotationOfCropRect),
            lockRotation:    !(this.options.crop?.allowRotationOfCropRect),
            cornerSize:      8,
            objectCaching:   false,
        });

        this.canvas.add(cropRect);
        (cropRect as FabricNS.Rect & { isCropRect?: boolean }).isCropRect = true;
        this.canvas.bringObjectToFront(cropRect);
        this.canvas.setActiveObject(cropRect);
        this._cropRect = cropRect;

        // Freeze all other objects during crop
        this._cropPrevEvented = [];
        this.canvas.getObjects().forEach(o => {
            if (o !== cropRect) {
                this._cropPrevEvented!.push({
                    obj: o,
                    evented:    o.evented ?? true,
                    selectable: o.selectable ?? true,
                });
                try { o.evented = false; o.selectable = false; } catch { /* ignore */ }
            }
        });

        const onModified = () => {
            try { cropRect.setCoords(); this.canvas!.requestRenderAll(); } catch { /* ignore */ }
        };
        cropRect.on('modified', onModified);
        cropRect.on('moving',   onModified);
        cropRect.on('scaling',  onModified);

        this._cropHandlers = [{
            target: cropRect as unknown as MaskObject,
            handlers: [
                { evt: 'modified', fn: onModified },
                { evt: 'moving',   fn: onModified },
                { evt: 'scaling',  fn: onModified },
            ],
        }];

        this._updateUI();
        this.canvas.renderAll();
    }

    /**
     * Cancels crop mode and removes the crop rectangle without applying it.
     */
    cancelCrop(): void {
        if (!this.canvas || !this._cropMode) return;

        if (this._cropRect) {
            this._cropHandlers.forEach(h => {
                h.handlers.forEach(rec => {
                    try { h.target.off(rec.evt as keyof FabricNS.ObjectEvents, rec.fn as () => void); } catch { /* ignore */ }
                });
            });
            try { this.canvas.remove(this._cropRect); } catch { /* ignore */ }
            this._cropRect = null;
        }

        this._cropPrevEvented?.forEach(i => {
            try { i.obj.evented = i.evented; i.obj.selectable = i.selectable; } catch { /* ignore */ }
        });
        this._cropPrevEvented = null;
        this._cropHandlers    = [];
        this._cropMode        = false;

        this.canvas.selection = this._prevSelectionSetting ?? false;
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
    async applyCrop(): Promise<void> {
        if (!this.canvas || !this._cropMode || !this._cropRect) return;

        this._cropRect.setCoords();
        const rectBounds = this._cropRect.getBoundingRect();

        const sx = Math.max(0, Math.round(rectBounds.left));
        const sy = Math.max(0, Math.round(rectBounds.top));
        const sw = Math.max(1, Math.round(Math.min(rectBounds.width,  this.canvas.getWidth()  - sx)));
        const sh = Math.max(1, Math.round(Math.min(rectBounds.height, this.canvas.getHeight() - sy)));

        // Snapshot before
        let beforeJson: string | null = null;
        try {
            const jsonObj = (this.canvas as any).toJSON(['maskId', 'maskName', 'isCropRect']) as CanvasJSON;
            if (Array.isArray(jsonObj.objects)) jsonObj.objects = jsonObj.objects.filter(o => !o.isCropRect);
            beforeJson = JSON.stringify(jsonObj);
        } catch (e) { console.warn('[ImageEditor] applyCrop: could not serialize before state', e); }

        // Remove masks
        try {
            this.canvas.getObjects().filter(isMaskObject).forEach(m => {
                try { this._removeLabelForMask(m); this.canvas!.remove(m); } catch { /* ignore */ }
            });
            this.canvas.discardActiveObject();
            this.canvas.renderAll();
        } catch (e) { console.warn('[ImageEditor] applyCrop: error removing masks', e); }

        // Remove crop rect
        this._cropHandlers.forEach(h => {
            h.handlers.forEach(rec => {
                try { h.target.off(rec.evt as keyof FabricNS.ObjectEvents, rec.fn as () => void); } catch { /* ignore */ }
            });
        });
        try { this.canvas.remove(this._cropRect); } catch { /* ignore */ }
        this._cropRect = null;

        this._cropMode = false;
        this.canvas.selection = this._prevSelectionSetting ?? false;
        this._prevSelectionSetting = undefined;

        // Crop on off-screen canvas
        let croppedBase64: string;
        try {
            const fullDataUrl = this.canvas.toDataURL({
                format: 'jpeg',
                quality: this.options.downsampleQuality || 0.92,
                multiplier: 1,
            });
            croppedBase64 = await new Promise<string>((resolve, reject) => {
                const img = new Image();
                img.onload = () => {
                    try {
                        const oc = document.createElement('canvas');
                        oc.width = sw; oc.height = sh;
                        oc.getContext('2d')!.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
                        resolve(oc.toDataURL('image/jpeg', this.options.downsampleQuality || 0.92));
                    } catch (err) { reject(err); }
                };
                img.onerror = reject;
                img.src     = fullDataUrl;
            });
        } catch (e) {
            console.error('[ImageEditor] applyCrop: failed to create cropped image', e);
            this._updateUI();
            return;
        }

        try {
            await this.loadImage(croppedBase64);
        } catch (e) {
            console.error('[ImageEditor] applyCrop: loadImage failed', e);
            this._updateUI();
            return;
        }

        // Snapshot after + push history command
        let afterJson: string | null = null;
        try {
            const jsonObj2 = (this.canvas as any).toJSON(['maskId', 'maskName', 'isCropRect']) as CanvasJSON;
            if (Array.isArray(jsonObj2.objects)) jsonObj2.objects = jsonObj2.objects.filter(o => !o.isCropRect);
            afterJson = JSON.stringify(jsonObj2);
        } catch (e) { console.warn('[ImageEditor] applyCrop: failed to serialize after state', e); }

        try {
            const cmd = new Command(
                () => { if (afterJson)  void this.loadFromState(afterJson); },
                () => { if (beforeJson) void this.loadFromState(beforeJson); },
            );

            // Trim redo history, then push
            if (this.historyManager.currentIndex < this.historyManager.history.length - 1) {
                this.historyManager.history = this.historyManager.history.slice(
                    0, this.historyManager.currentIndex + 1,
                );
            }
            this.historyManager.history.push(cmd);
            if (this.historyManager.history.length > this.historyManager.maxSize) {
                this.historyManager.history.shift();
            } else {
                this.historyManager.currentIndex++;
            }
        } catch (e) { console.warn('[ImageEditor] applyCrop: failed to push history', e); }

        this._updateUI();
        this.canvas.renderAll();
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PRIVATE — UI helpers
    // ═══════════════════════════════════════════════════════════════════════

    /** @internal */
    private _updateInputs(): void {
        const scaleId = this.elements.scaleRate;
        if (!scaleId) return;
        const scaleEl = document.getElementById(scaleId) as HTMLInputElement | null;
        if (scaleEl) scaleEl.value = String(Math.round(this.currentScale * 100));
    }

    /** @internal */
    private _updateUI(): void {
        if (!this.canvas) return;

        const hasImg          = !!this.originalImage;
        const masks           = hasImg ? this.canvas.getObjects().filter(isMaskObject) : [];
        const hasMasks        = masks.length > 0;
        const active          = this.canvas.getActiveObject();
        const hasSelectedMask = !!(active && isMaskObject(active));
        const isDefault       = this.currentScale === 1 && this.currentRotation === 0;
        const canUndo         = this.historyManager.canUndo();
        const canRedo         = this.historyManager.canRedo();
        const inCrop          = this._cropMode;

        if (inCrop) {
            (Object.keys(this.elements) as ElementKey[]).forEach(k => {
                const id = this.elements[k];
                if (!id) return;
                const el = document.getElementById(id) as HTMLButtonElement | null;
                if (!el) return;
                el.disabled = !(k === 'applyCropBtn' || k === 'cancelCropBtn');
            });
            return;
        }

        this._setDisabled('zoomInBtn',        !hasImg || this.isAnimating || this.currentScale >= this.options.maxScale);
        this._setDisabled('zoomOutBtn',        !hasImg || this.isAnimating || this.currentScale <= this.options.minScale);
        this._setDisabled('rotateLeftBtn',     !hasImg || this.isAnimating);
        this._setDisabled('rotateRightBtn',    !hasImg || this.isAnimating);
        this._setDisabled('addMaskBtn',        !hasImg || this.isAnimating);
        this._setDisabled('removeMaskBtn',     !hasSelectedMask || this.isAnimating);
        this._setDisabled('removeAllMasksBtn', !hasMasks || this.isAnimating);
        this._setDisabled('mergeBtn',          !hasImg || !hasMasks || this.isAnimating);
        this._setDisabled('downloadBtn',       !hasImg || this.isAnimating);
        this._setDisabled('resetBtn',          !hasImg || isDefault || this.isAnimating);
        this._setDisabled('undoBtn',           !hasImg || this.isAnimating || !canUndo);
        this._setDisabled('redoBtn',           !hasImg || this.isAnimating || !canRedo);
        this._setDisabled('cropBtn',           !hasImg || this.isAnimating);
        this._setDisabled('applyCropBtn',      true);
        this._setDisabled('cancelCropBtn',     true);
    }

    /** @internal */
    private _setDisabled(key: ElementKey, disabled: boolean): void {
        const id = this.elements[key];
        if (!id) return;
        const el = document.getElementById(id) as HTMLButtonElement | null;
        if (el) el.disabled = disabled;
    }

    /** @internal */
    private _updatePlaceholderStatus(): void {
        if (!this.options.showPlaceholder) return;
        this._setPlaceholderVisible(!this.originalImage);
    }

    /** @internal */
    private _setPlaceholderVisible(show: boolean): void {
        if (!this.placeholderEl) return;
        if (show) {
            this.placeholderEl.classList.remove('d-none');
            this.placeholderEl.classList.add('d-flex');
            this.containerEl?.classList.add('d-none');
        } else {
            this.placeholderEl.classList.remove('d-flex');
            this.placeholderEl.classList.add('d-none');
            this.containerEl?.classList.remove('d-none');
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PUBLIC — dispose
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Cleans up all DOM event listeners and disposes the Fabric.js Canvas.
     * Call this when the editor is no longer needed to prevent memory leaks.
     */
    dispose(): void {
        // Remove all bound DOM listeners
        (Object.keys(this._boundHandlers) as ElementKey[]).forEach(key => {
            const id = this.elements[key];
            if (!id) return;
            const el = document.getElementById(id);
            if (!el) return;
            (this._boundHandlers[key] ?? []).forEach(h => {
                try { el.removeEventListener(h.event, h.handler); } catch { /* ignore */ }
            });
        });

        if (this._cropRect && this.canvas) {
            try { this.canvas.remove(this._cropRect); } catch { /* ignore */ }
            this._cropRect = null;
        }

        if (this.canvas) {
            try { this.canvas.dispose(); } catch { /* ignore */ }
            this.canvas               = null;
            this.canvasEl             = null;
            this.isImageLoadedToCanvas = false;
        }

        this._boundHandlers = {};
    }
}
