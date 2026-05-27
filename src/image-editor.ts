/**
 * @file image-editor.ts
 * @module image-editor
 * @author Ben Situ
 * @license MIT
 * @description Lightweight canvas-based image editor built on Fabric.js v7.
 *              Provides masking, animated scale/rotate, crop, undo/redo, and export.
 */

import type * as FabricNS from 'fabric';
import { AnimationQueue } from './animation/animation-queue.js';
import { reportError, reportWarning } from './core/callback-reporter.js';
import { resolveOptions } from './core/default-options.js';
import { OperationGuard } from './core/operation-guard.js';
import {
    SNAPSHOT_CUSTOM_KEYS,
    loadFromState as loadFromStateImpl,
    saveState as saveStateImpl,
    type CanvasJSON,
} from './core/state-serializer.js';
import { Command, HistoryManager } from './history/history-manager.js';
import { detectFabric } from './fabric/fabric-adapter.js';
import type {
    Base64ExportOptions,
    ElementIdMap,
    FabricModule,
    ImageEditorOptions,
    ImageFileExportOptions,
    LoadImageOptions,
    MaskConfig,
    MaskObject,
    RemoveAllMasksOptions,
    ResolvedOptions,
} from './core/public-types.js';
import { isMaskObject } from './core/public-types.js';
import {
    applyCrop as applyCropImpl,
    cancelCrop as cancelCropImpl,
    enterCropMode as enterCropModeImpl,
    type CropControllerContext,
    type CropSession,
} from './crop/crop-controller.js';
import {
    downloadImage as downloadImageImpl,
    exportImageBase64 as exportImageBase64Impl,
    exportImageFile as exportImageFileImpl,
    mergeMasks as mergeMasksImpl,
    type ExportServiceContext,
    type MergeMasksContext,
} from './export/export-service.js';
import { loadImage as loadImageImpl, type LoadImageContext } from './image/image-loader.js';
import {
    ViewportCache,
    applyCanvasDimensions,
    detectLayoutConflict,
} from './image/layout-manager.js';
import {
    TransformController,
    type TransformContext,
} from './image/transform-controller.js';
import {
    createMask as createMaskImpl,
    removeAllMasks as removeAllMasksImpl,
    removeSelectedMask as removeSelectedMaskImpl,
    type CreateMaskContext,
    type RemoveMaskContext,
} from './mask/mask-factory.js';
import {
    createLabelForMask,
    hideAllMaskLabels,
    removeLabelForMask,
    showLabelForMask,
    syncMaskLabel,
    type MaskLabelManagerContext,
} from './mask/mask-label-manager.js';
import {
    renderMaskList,
    updateMaskListSelection,
    type MaskListContext,
} from './mask/mask-list.js';
import {
    applyMaskSelectedStyle,
    applyMaskUnselectedStyle,
    reattachMaskHoverHandlers,
} from './mask/mask-style.js';
import { DomBindings } from './ui/dom-bindings.js';
import { setPlaceholderVisible as setPlaceholderVisibleImpl } from './ui/visibility-state.js';
import {
    inferImageMimeType,
    readFileAsDataURL,
    resetFileInput,
} from './utils/file.js';

// ─── Internal element-key type ────────────────────────────────────────────────

type ElementKey = keyof Required<ElementIdMap>;

// ─── Resolved element ID map (all keys guaranteed present) ───────────────────

type ResolvedElementIdMap = Record<ElementKey, string | null>;

// Crop mode freezes both toolbar buttons and form controls that can
// start competing editor actions while a crop session owns the canvas.
const CROP_MODE_CONTROL_KEYS: readonly ElementKey[] = [
    'scaleRate',
    'rotationLeftInput',
    'rotationRightInput',
    'rotateLeftBtn',
    'rotateRightBtn',
    'addMaskBtn',
    'removeMaskBtn',
    'removeAllMasksBtn',
    'mergeBtn',
    'downloadBtn',
    'zoomInBtn',
    'zoomOutBtn',
    'resetBtn',
    'undoBtn',
    'redoBtn',
    'imageInput',
    'cropBtn',
    'applyCropBtn',
    'cancelCropBtn',
];

const CROP_MODE_ENABLED_KEYS: readonly ElementKey[] = [
    'applyCropBtn',
    'cancelCropBtn',
];

// ─── ImageEditor ─────────────────────────────────────────────────────────────

/**
 * Lightweight Fabric.js v7 image editor with masking, animated transforms,
 * crop, undo/redo, and multi-format export.
 *
 * ## Quick start (ESM)
 * ```ts
 * import * as fabric from 'fabric';
 * import { ImageEditor} from 'image-editor';
 *
 * const editor = new ImageEditor(fabric, { canvasWidth: 1024, canvasHeight: 768});
 * editor.init({ canvas: 'myCanvas'});
 * ```
 *
 * ## Quick start (CDN / `<script>` tag)
 * ```ts
 * // Assumes window.fabric is populated by a Fabric.js CDN script
 * const editor = new ImageEditor({ canvasWidth: 1024});
 * editor.init;
 * ```
 */
export class ImageEditor {
    // ── Fabric injection ────────────────────────────────────────────────────
    /** @internal */ private readonly _fabric: FabricModule;
    /** @internal */ private readonly _fabricLoaded: boolean;

    // ── Resolved options ────────────────────────────────────────────────────
    /** @internal */ private readonly options: ResolvedOptions;

    // ── Canvas / DOM ────────────────────────────────────────────────────────
    /** @internal */ private canvas: FabricNS.Canvas | null = null;
    /** @internal */ private canvasElement: HTMLCanvasElement | null = null;
    /** @internal */ private containerElement: HTMLElement | null = null;
    /** @internal */ private placeholderElement: HTMLElement | null = null;
    /** @internal */ private elements: ResolvedElementIdMap = {} as ResolvedElementIdMap;

    // ── Image state ─────────────────────────────────────────────────────────
    /** @internal */ private originalImage: FabricNS.FabricImage | null = null;
    /** @internal */ private baseImageScale = 1;
    /** @internal */ private currentScale = 1;
    /** @internal */ private currentRotation = 0;
    /** @internal */ private isImageLoadedToCanvas = false;

    // ── Mask state ──────────────────────────────────────────────────────────
    /** @internal */ private maskCounter = 0;
    /** @internal */ private _lastMask: MaskObject | null = null;

    // ── History ─────────────────────────────────────────────────────────────
    /** @internal */ private _lastSnapshot: string | null = null;
    /** @internal */ private readonly historyManager: HistoryManager;

    // ── Animation ───────────────────────────────────────────────────────────
    /**
     * Single source of truth for `isAnimating` and `_disposed` flags
     * shared between the facade, the transform controller, and the
     * Fabric animation wrapper. The transform controller calls
     * `runAnimation` to bracket each Fabric tween so the flag is
     * cleared inside a `finally`; the facade reads
     * `isAnimating` for the per-method guard rejections; and the
     * dispose path forwards to
     * `markDisposed` so in-flight animation callbacks short-circuit.
     * @internal
     */
    private readonly _guard: OperationGuard;
    /** @internal */ private readonly animQueue: AnimationQueue;
    /**
     * Owns animated `scaleImage`, `rotateImage`, and
     * `resetImageTransform`. The facade enqueues each public method on
     * {@link animQueue} and the controller drives
     * the per-Fabric-animation `runAnimation` bracket through
     * {@link _guard}. The controller is constructed in {@link init}
     * once `canvas` is available so its `TransformContext` can hold a
     * stable Fabric canvas reference.
     * @internal
     */
    private _transformController: TransformController | null = null;

    // ── Image-loader viewport cache ─────────────────────────────────────────
    /**
     * Hidden-container viewport cache shared across `loadImage` calls. Owned
     * by the facade so the layout manager can reuse the last visible
     * measurement when the editor is hidden inside a tab, modal, or
     * accordion.
     * @internal
     */
    private readonly _viewportCache: ViewportCache = new ViewportCache();

    // ── Crop ────────────────────────────────────────────────────────────────
    /**
     * Live crop session pointer owned by the facade. The crop controller
     * (`crop/crop-controller.ts`) reads and writes this slot through the
     * `getCropSession`/`setCropSession` callbacks bundled into the
     * controller's context, so the controller has no class state of its
     * own and multiple editors on the same page do not share crop state.
     * @internal
     */
    private _cropSession: CropSession | null = null;

    // ── DOM event cleanup ───────────────────────────────────────────────────
    /**
     * Managed registry of DOM event listeners owned by this editor.
     *
     * Constructed lazily by {@link init} so the registry can read the
     * editor's `_disposed` flag through a closure that captures `this`.
     * `dispose` drains the registry via {@link DomBindings.removeAll}
     * and the wrapped handlers exit early while
     * `_disposed === true`.
     * @internal
     */
    private _bindings: DomBindings | null = null;
    /** @internal */ private _disposed = false;
    /**
     * When `true`, {@link saveState} is a no-op.  Used by
     * {@link resetImageTransform} (via the transform controller) to
     * suppress the intermediate history entries from {@link scaleImage}
     * and {@link rotateImage} so the entire reset is a single undoable
     * step.
     * @internal
     */
    private _suppressSaveState = false;


    // ── Callbacks ───────────────────────────────────────────────────────────
    // The `onImageLoaded`, `onError`, and `onWarning` callbacks live on
    // `this.options` after `resolveOptions` and are read directly by the
    // pipeline modules (`image/image-loader.ts`, `core/callback-reporter.ts`).
    // The facade does not cache them on a separate field so a single source
    // of truth survives the module decomposition.

    // ═══════════════════════════════════════════════════════════════════════
    // Constructor
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Creates a new image editor instance.
     *
     * The constructor accepts two argument shapes so the same source ships
     * to both ESM and UMD consumers:
     *
     * - **ESM form** — `new ImageEditor(fabric, options?)`. The first
     *   argument is the imported Fabric.js v7 module
     *   (`import * as fabric from 'fabric'`).
     * - **UMD / CDN form** — `new ImageEditor(options?)`. The Fabric module
     *   is read from `globalThis.fabric` and the first argument is treated
     *   as `ImageEditorOptions`.
     *
     * Detection is delegated to `fabric/fabric-adapter.ts`. When neither
     * form yields a usable Fabric module, the adapter logs a single
     * descriptive `console.error` and the constructor returns a degraded
     * instance whose `init` and `loadImage` calls become no-ops
     * resolving to `undefined`.
     *
     * Options are normalized through `core/default-options.ts#resolveOptions`,
     * which deep-merges nested `label`/`crop` configs with the documented
     * defaults, drops unknown keys, and freezes the nested references so
     * post-construction mutation cannot affect the live editor
     * The resolved options object is held on the
     * instance as an internal facade field; nothing on the public surface
     * exposes it directly.
     *
     * @param fabricModuleOrOptions Fabric.js module (ESM) or options (UMD).
     * @param options               Editor options when the first argument
     *                              is the Fabric module. Ignored otherwise.
     */
    constructor(
        fabricModuleOrOptions: FabricModule | ImageEditorOptions = {},
        options: ImageEditorOptions = {},
    ) {
        // detect the Fabric module and
        // separate it from the user's options partial. The adapter logs a
        // single `console.error` on a miss; we then surface that miss via
        // `_fabricLoaded === false` so `init` and `loadImage` can
        // short-circuit.
        const detected = detectFabric(fabricModuleOrOptions, options);

        // The adapter returns `null` on a miss; the public field type is
        // `FabricModule`, so the cast keeps the rest of the class typed
        // exactly as before. The `_fabricLoaded` flag is the single
        // source of truth for "is Fabric usable?" — every public method
        // that touches Fabric checks it before mutating canvas state.
        this._fabric = (detected.fabric ?? ({} as FabricModule));
        this._fabricLoaded = detected._fabricLoaded;

        // resolve options through the canonical
        // resolver. `resolveOptions` applies defaults for every top-level
        // key, deep-merges `label.textOptions` and `crop`, normalizes
        // callbacks to functions or `null`, drops unknown top-level keys,
        // and freezes the returned `label`/`crop` references so a later
        // mutation of `userInput.label.textOptions` cannot affect the
        // live editor.
        this.options = resolveOptions(detected.options);

        // Surface mutually-exclusive layout flags through `onWarning`.
        // The selected strategy still follows precedence
        // (`fit > cover > expand`) inside `selectLayoutStrategy`; this
        // surfaces the conflict so integrators can tell their `fit` and
        // `cover` flags fight without silent suppression.
        const layoutConflict = detectLayoutConflict(this.options);
        if (layoutConflict) {
            reportWarning(this.options, null, layoutConflict.message);
        }

        // ── Internal facade state ─────────────────────────────────────────
        // `historyManager`, `animQueue`, `_guard`, and the callbacks on
        // `options` stay implementation-owned. The public read-only
        // introspection point is `isImageLoaded`.
        //
        // The `_guard` is shared between the facade (for the
        // animation per-method guards), the transform controller
        // (for `runAnimation` bracketing), and the
        // Fabric animation wrapper (for `_disposed`-aware callbacks).
        // The `_transformController` is constructed
        // lazily in {@link init} once a canvas is available.
        this._guard = new OperationGuard();
        this.animQueue = new AnimationQueue();
        this.historyManager = new HistoryManager(this.options.maxHistorySize);
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
     * editor.init({ canvas: 'myCanvas', downloadBtn: 'dlBtn'});
     * ```
     */
    init(idMap: ElementIdMap = {}): void {
        if (!this._fabricLoaded) return;
        // Idempotency on the dispose side is mirrored
        // here: a post-dispose `init` would otherwise re-create the
        // canvas without the bindings registry the dispose path drained,
        // and would also leak Fabric resources. Returning early matches
        // the dispose contract in `core/operation-guard.ts`.
        if (this._disposed) return;

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

        // Construct the bindings registry now that `elements` is populated.
        // The resolver closes over `this.elements` so subsequent ID-map
        // mutations are reflected without rebuilding the registry; the
        // disposed-flag closure routes through the operation guard's single
        // source of truth.
        this._bindings = new DomBindings(
            (key) => this.elements[key],
            () => this._disposed,
        );

        this._initCanvas();
        // Construct the transform controller now that the Fabric canvas
        // is available. The context binds back to facade fields so the
        // controller does not duplicate state.
        this._transformController = new TransformController(
            this._buildTransformContext(),
        );
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
        const canvasElement = id ? (document.getElementById(id) as HTMLCanvasElement | null) : null;
        if (!canvasElement) throw new Error(`[ImageEditor] Canvas element not found: "${id}"`);
        this.canvasElement = canvasElement;

        const containerId = this.elements.canvasContainer;
        if (containerId) {
            this.containerElement = document.getElementById(containerId) ?? canvasElement.parentElement;
        } else {
            this.containerElement = canvasElement.parentElement;
        }

        const phId = this.elements.imgPlaceholder;
        this.placeholderElement = phId ? document.getElementById(phId) : null;

        let initialW = this.options.canvasWidth;
        let initialH = this.options.canvasHeight;
        if (this.containerElement) {
            const cw = Math.floor(this.containerElement.clientWidth);
            const ch = Math.floor(this.containerElement.clientHeight);
            if (cw > 0 && ch > 0) { initialW = cw; initialH = ch; }
        }

        this.canvas = new this._fabric.Canvas(canvasElement, {
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
        this.canvas.on('object:moving', onObjectEvent);
        this.canvas.on('object:scaling', onObjectEvent);
        this.canvas.on('object:rotating', onObjectEvent);
        this.canvas.on('object:modified', onObjectEvent);
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

        this._bindIfExists('imageInput', 'change', (e) => {
            const f = (e.target as HTMLInputElement).files?.[0];
            if (f) void this._loadImageFile(f);
        });

        this._bindIfExists('zoomInBtn', 'click', () => { void this.scaleImage(this.currentScale + this.options.scaleStep); });
        this._bindIfExists('zoomOutBtn', 'click', () => { void this.scaleImage(this.currentScale - this.options.scaleStep); });
        this._bindIfExists('resetBtn', 'click', () => { void this.resetImageTransform(); });

        this._bindIfExists('addMaskBtn', 'click', () => { this.createMask(); });
        this._bindIfExists('removeMaskBtn', 'click', () => { this.removeSelectedMask(); });
        this._bindIfExists('removeAllMasksBtn', 'click', () => { this.removeAllMasks(); });

        this._bindIfExists('mergeBtn', 'click', () => { void this.mergeMasks(); });
        this._bindIfExists('downloadBtn', 'click', () => { this.downloadImage(); });

        this._bindIfExists('undoBtn', 'click', () => { this.undo(); });
        this._bindIfExists('redoBtn', 'click', () => { this.redo(); });

        this._bindIfExists('rotateLeftBtn', 'click', () => {
            const inputId = this.elements.rotationLeftInput;
            const inputEl = inputId ? document.getElementById(inputId) as HTMLInputElement | null : null;
            let step = this.options.rotationStep;
            if (inputEl) { const p = parseFloat(inputEl.value); if (!isNaN(p)) step = p; }
            void this.rotateImage(this.currentRotation - step);
        });
        this._bindIfExists('rotateRightBtn', 'click', () => {
            const inputId = this.elements.rotationRightInput;
            const inputEl = inputId ? document.getElementById(inputId) as HTMLInputElement | null : null;
            let step = this.options.rotationStep;
            if (inputEl) { const p = parseFloat(inputEl.value); if (!isNaN(p)) step = p; }
            void this.rotateImage(this.currentRotation + step);
        });

        this._bindIfExists('cropBtn', 'click', () => { this.enterCropMode(); });
        this._bindIfExists('applyCropBtn', 'click', () => {
            void this.applyCrop().catch(err => {
                reportError(this.options, err, 'Crop apply failed.');
            });
        });
        this._bindIfExists('cancelCropBtn', 'click', () => { this.cancelCrop(); });
    }

    /** @internal */
    private _bindIfExists(key: ElementKey, event: string, handler: EventListener): void {
        // Routed through the managed registry so `dispose` can detach
        // every listener with a single `removeAll` call. The registry
        // also wraps the handler in a `_disposed`-aware shim so handlers
        // stop firing once dispose has run.
        this._bindings?.bindIfExists(key, event, handler);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PRIVATE — image loading
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Read a `File` selected via the upload control as a base64 data URL
     * and route it through the transactional `loadImage` pipeline.
     *
     * Routes through `utils/file.ts` so MIME inference (including the
     * empty-`file.type` extension fallback), `FileReader` plumbing, and
     * input reset live in one place. The input is reset on both success
     * and failure so re-selecting the same file fires a fresh `change`
     * event.
     * @internal
     */
    private async _loadImageFile(file: File): Promise<void> {
        const inputId = this.elements.imageInput;
        const inputEl = inputId
            ? document.getElementById(inputId) as HTMLInputElement | null
            : null;

        const mime = inferImageMimeType(file);
        if (!mime) {
            reportWarning(
                this.options,
                null,
                `Unsupported image file type: ${file.type || file.name || 'unknown'}.`,
            );
            resetFileInput(inputEl);
            return;
        }

        try {
            const dataUrl = await readFileAsDataURL(file);
            await this.loadImage(dataUrl);
        } catch (err) {
            // The transactional loader has already routed the error
            // through `onError` and replayed the rollback bundle. We
            // surface the file-read failure separately so a FileReader
            // failure (which never reaches the loader) still fires
            // `onError`.
            reportError(this.options, err, 'Failed to read selected image file.');
        } finally {
            resetFileInput(inputEl);
        }
    }

    /**
     * Loads a Base64-encoded image data URL onto the canvas.
     *
     * The transactional pipeline lives in `image/image-loader.ts`; this
     * facade method delegates to it so all rollback, downsample, layout,
     * and `onImageLoaded` ordering rules are owned in one place.
     *
     * Pipeline contract preserved end-to-end (5.3,
     * 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 7.1, 7.2, 7.3, 8.4, 18.1):
     *
     * - Non-`data:image/` strings resolve without mutation.
     * - On a valid data URL, the loader captures a rollback bundle BEFORE
     *   the first mutation. Decode, downsample, Fabric, timeout, or layout
     *   failures replay the bundle and reject with the original error.
     * - On commit, the loader sets `originalImage`, `currentScale = 1`,
     *   `currentRotation = 0`, `baseImageScale`, `maskCounter = 0`,
     *   `_lastSnapshot`, and `isImageLoadedToCanvas = true`. It also
     *   honours `LoadImageOptions.preserveScroll` and invokes
     *   `onImageLoaded` exactly once after every scalar is committed.
     *
     * Operation guard: `loadImage` is one of the
     * guarded operations. While `isAnimating === true` the facade rejects
     * the call as a documented no-op so a queued scale/rotate animation
     * cannot be torn down by a concurrent reload.
     *
     * @param base64  Data URL string starting with `data:image/…`.
     * @param options Optional {@link LoadImageOptions}; currently only
     *                `preserveScroll` is consulted.
     * @returns Promise that resolves once the image is on the canvas, or
     *          rejects with the original error after a transactional
     *          rollback. Non-data:image inputs and Fabric-unavailable /
     *          disposed states resolve without observable mutation.
     */
    async loadImage(base64: string, options: LoadImageOptions = {}): Promise<void> {
        // Fabric-unavailable and disposed gates mirror "init and
        // loadImage are no-ops" contract.
        if (!this._fabricLoaded || !this.canvas) return;
        if (this._disposed) return;

        // `loadImage` is a guarded operation. Reject
        // with the documented no-op shape while an animation is in flight
        // so the in-flight scale/rotate is not torn down by a reload.
        if (this._guard.isAnimating()) return;

        // Drop any stale label objects BEFORE the loader clears the
        // canvas. The loader does call `canvas.clear` itself, but the
        // facade also tracks `mask.__label` references on the mask
        // objects and will leak those references onto stale objects
        // unless we hide them up-front.
        this._hideAllMaskLabels();

        // Build the dependency bundle the loader consumes. Each closure
        // reads/writes the canonical facade state so the loader has no
        // class state of its own.
        const ctx: LoadImageContext = {
            fabric: this._fabric,
            canvas: this.canvas,
            options: this.options,
            containerElement: this.containerElement,
            placeholderElement: this.placeholderElement,
            viewportCache: this._viewportCache,

            getOriginalImage: () => this.originalImage,
            setOriginalImage: v => { this.originalImage = v; },
            getIsImageLoadedToCanvas: () => this.isImageLoadedToCanvas,
            setIsImageLoadedToCanvas: v => { this.isImageLoadedToCanvas = v; },
            getLastSnapshot: () => this._lastSnapshot,
            setLastSnapshot: v => { this._lastSnapshot = v; },
            getMaskCounter: () => this.maskCounter,
            setMaskCounter: v => { this.maskCounter = v; },
            getCurrentScale: () => this.currentScale,
            setCurrentScale: v => { this.currentScale = v; },
            getCurrentRotation: () => this.currentRotation,
            setCurrentRotation: v => { this.currentRotation = v; },
            getBaseImageScale: () => this.baseImageScale,
            setBaseImageScale: v => { this.baseImageScale = v; },

            // Route placeholder visibility through the canonical helper
            // (`ui/visibility-state.ts`) so the loader's rollback path
            // restores the placeholder using the same standard-DOM-state
            // transition as every other code path.
            setPlaceholderVisible: show => {
                setPlaceholderVisibleImpl(this.placeholderElement, this.containerElement, show);
            },
        };

        try {
            await loadImageImpl(ctx, base64, options);
        } catch (err) {
            // The loader has already replayed the rollback bundle and
            // routed the error through `onError`. Re-throw so the
            // returned promise rejects with the original error
            //.
            throw err;
        }

        // ── Facade-only post-commit bookkeeping ─────────────────────────
        // The loader owns canvas state, transform scalars, _lastSnapshot,
        // and the onImageLoaded callback. Everything below is facade-
        // specific UI / mask-placement memo state that the loader has no
        // visibility into. The block runs only when the load committed —
        // a thrown error short-circuits it via the `throw` above, which
        // matches the loader's "no observable change on rollback"
        // contract.
        this._lastMask = null;

        this._updateInputs();
        this._updateMaskList();
        this._updateUI();
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

    /**
     * Atomically resize the Fabric canvas. Routes through
     * {@link applyCanvasDimensions} so the canvas's lower (render) and
     * upper (event) layers stay in sync and the surrounding container is
     * reflowed before the next paint — matching the contract enforced
     * across the rest of the layout pipeline (see
     * `image/layout-manager.ts`).
     * @internal
     */
    private _setCanvasSizeInt(w: number, h: number): void {
        if (!this.canvas) return;
        applyCanvasDimensions(this.canvas, w, h, this.containerElement);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PRIVATE — geometry helpers
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Re-align an object so its bounding-box top-left maps to the
     * object's `(left, top)` reference. Used by the transform pipeline's
     * `afterTransformSnap` hook to absorb floating-point drift on the
     * final animation tick.
     * @internal
     */
    private _alignObjectBoundingBoxToCanvasTopLeft(obj: FabricNS.FabricObject): void {
        obj.setCoords();
        const boundingRect = obj.getBoundingRect(); // v7: always absolute, no params
        obj.set({
            left: (obj.left ?? 0) - boundingRect.left,
            top: (obj.top ?? 0) - boundingRect.top,
        });
        obj.setCoords();
        // Flush the final snapped geometry before the transform promise
        // settles; callers may read layout immediately after awaiting it.
        this.canvas!.renderAll();
    }

    /**
     * Resize the canvas to fit the image when `expandCanvasToImage` is
     * `true`. Used by the transform pipeline's `afterTransformSnap` hook
     * so a post-rotation/scale image that exceeds the viewport gets
     * scrollbars.
     * @internal
     */
    private _updateCanvasSizeToImageBounds(): void {
        if (!this.originalImage) return;
        this.originalImage.setCoords();
        const boundingRect = this.originalImage.getBoundingRect();

        const containerW = this.containerElement ? Math.ceil(this.containerElement.clientWidth || 0) : 0;
        const containerH = this.containerElement ? Math.ceil(this.containerElement.clientHeight || 0) : 0;

        // If image fits inside the viewport, keep the canvas viewport-sized
        if (
            containerW > 0 &&
            containerH > 0 &&
            boundingRect.width <= containerW &&
            boundingRect.height <= containerH
        ) {
            this._setCanvasSizeInt(containerW, containerH);
            return;
        }

        this._setCanvasSizeInt(
            Math.max(containerW || 0, Math.floor(boundingRect.width)),
            Math.max(containerH || 0, Math.floor(boundingRect.height)),
        );
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PRIVATE — transform controller wiring
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Build the {@link TransformContext} the controller reads/writes
     * through. The facade is the single owner of `currentScale`,
     * `currentRotation`, `baseImageScale`, `_suppressSaveState`, and
     * the {@link OperationGuard}, so the context's accessors all bind
     * back to `this` rather than duplicating state.
     *
     * The `saveCanvasState` callback delegates to {@link saveState},
     * which already honors `_suppressSaveState`. That lets
     * {@link resetImageTransform} reuse the public scale and rotate paths
     * while suppressing intermediate saves and emitting one final history
     * entry.
     *
     * The `afterTransformSnap` hook re-runs the post-animation UI helpers:
     * expand-to-image canvas sizing, bounding-box re-alignment, and mask
     * label sync.
     *
     * @internal
     */
    private _buildTransformContext(): TransformContext {
        return {
            canvas: this.canvas!,
            options: this.options,
            guard: this._guard,

            getOriginalImage: () => this.originalImage,

            getCurrentScale: () => this.currentScale,
            setCurrentScale: (n) => { this.currentScale = n; },

            getCurrentRotation: () => this.currentRotation,
            setCurrentRotation: (n) => { this.currentRotation = n; },

            getBaseImageScale: () => this.baseImageScale,

            saveCanvasState: () => { this.saveState(); },
            setSuppressSaveState: (suppress) => { this._suppressSaveState = suppress; },

            afterTransformSnap: () => {
                if (this._disposed || !this.canvas || !this.originalImage) return;
                if (this.options.expandCanvasToImage) this._updateCanvasSizeToImageBounds();
                this._alignObjectBoundingBoxToCanvasTopLeft(this.originalImage);
                this.canvas.getObjects()
                    .filter(isMaskObject)
                    .forEach(maskObject => this._syncMaskLabel(maskObject));
            },
        };
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PUBLIC — scale / rotate / reset
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Animates the image to the given scale factor.
     * The factor is clamped to `[options.minScale, options.maxScale]`.
     *
     * Routed through the {@link animQueue} so concurrent calls are
     * serialized. The actual animation lives
     * in {@link TransformController.scaleImage}, which brackets the
     * Fabric tween in {@link OperationGuard.runAnimation} so
     * `isAnimating` is `false` before this Promise settles
     * and calls {@link saveState} on success.
     *
     * @returns Promise that resolves when the animation finishes.
     */
    scaleImage(factor: number): Promise<void> {
        if (this._disposed || !this._transformController) return Promise.resolve();
        const controller = this._transformController;
        return this.animQueue.add(async () => {
            if (this._disposed) return;
            // Disable buttons up front so the toolbar reflects the
            // pending animation while it runs.
            this._updateUI();
            try {
                await controller.scaleImage(factor);
            } finally {
                if (!this._disposed) {
                    this._updateInputs();
                    this._updateUI();
                }
            }
        });
    }

    /**
     * Animates the image to the given rotation angle.
     *
     * Routed through the {@link animQueue}.
     * `NaN` is a documented no-op; the controller
     * short-circuits without modifying canvas state.
     *
     * @param degrees Target rotation angle in degrees.
     * @returns Promise that resolves when the animation finishes.
     */
    rotateImage(degrees: number): Promise<void> {
        if (this._disposed || !this._transformController) return Promise.resolve();
        const controller = this._transformController;
        return this.animQueue.add(async () => {
            if (this._disposed) return;
            this._updateUI();
            try {
                await controller.rotateImage(degrees);
            } finally {
                if (!this._disposed) {
                    this._updateInputs();
                    this._updateUI();
                }
            }
        });
    }

    /**
     * Resets the image to scale `1` and rotation `0` (animated) and
     * records exactly one history entry covering the entire reset.
     *
     * Routed through the {@link animQueue} so the chained
     * `scaleImage(1)` and `rotateImage(0)` sub-animations are serialized
     * with any other queued transform. The
     * controller toggles `_suppressSaveState` around the chain so the
     * inner per-operation `saveState` calls collapse into a single
     * post-reset save.
     *
     * @returns Promise that resolves when both sub-animations have
     *          settled and the single history entry has been recorded.
     */
    resetImageTransform(): Promise<void> {
        if (this._disposed || !this._transformController) return Promise.resolve();
        const controller = this._transformController;
        return this.animQueue.add(async () => {
            if (this._disposed) return;
            this._updateUI();
            try {
                await controller.resetImageTransform();
            } finally {
                if (!this._disposed) {
                    this._updateInputs();
                    this._updateUI();
                }
            }
        });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PUBLIC — history
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Restores a previously serialized canvas state.
     *
     * Delegates the snapshot-format-aware steps (parse, canvas resize,
     * `loadFromJSON`, position-based mask metadata restore) to
     * {@link loadFromStateImpl} in `core/state-serializer.ts` so the
     * facade and the merge/crop pipelines share one production path.
     *
     * Errors are routed through the documented `onError` callback. The
     * promise rejects with the original error so the history manager
     * leaves `currentIndex` untouched on a failed undo/redo restore.
     *
     * @param jsonString JSON string returned by `saveState` (or parsed object).
     */
    async loadFromState(jsonString: string | CanvasJSON): Promise<void> {
        if (!jsonString || !this.canvas) return;
        // After-dispose calls resolve as a no-op so a queued undo/redo
        // entry that fires post-dispose does not touch the canvas.
        if (this._disposed) return;

        try {
            const result = await loadFromStateImpl({
                canvas: this.canvas,
                jsonString,
                setCanvasSize: (w, h) => this._setCanvasSizeInt(w, h),
            });

            // Defend against dispose racing with the awaited
            // `loadFromJSON`: the canvas may have been torn down between
            // the call and the resolution.
            if (this._disposed || !this.canvas) return;

            // Drop any lingering label texts the snapshot did not filter.
            // The serializer's snapshot already excludes labels, but a
            // hand-built or older payload may include them.
            this._hideAllMaskLabels();

            this.originalImage = result.originalImage;
            if (this.originalImage) {
                this.originalImage.set({
                    originX: 'left', originY: 'top',
                    selectable: false, evented: false,
                    hasControls: false,
                    hoverCursor: 'default',
                });
                this.canvas.sendObjectToBack(this.originalImage);
            }

            this.maskCounter = result.maxMaskId;

            const es = result.editorState;
            if (es) {
                this.currentScale = es.currentScale;
                this.currentRotation = es.currentRotation;
                this.baseImageScale = es.baseImageScale;
            }

            this.isImageLoadedToCanvas = !!this.originalImage;

            // Update _lastSnapshot so the NEXT saveState correctly
            // uses this restored state as its "before" baseline.
            this._lastSnapshot = result.jsonString;

            // Re-attach mouseover/mouseout hover handlers (Fabric never
            // serializes event listeners).
            result.objects
                .filter(isMaskObject)
                .forEach(maskObject => {
                    applyMaskUnselectedStyle(maskObject);
                    reattachMaskHoverHandlers(maskObject);
                });

            // Undo/redo callers await this method and should settle after
            // Fabric has painted the restored state.
            this.canvas.renderAll();
            this._updateInputs();
            this._updateMaskList();
            this._updateUI();
        } catch (err) {
            reportError(this.options, err, 'Failed to restore canvas state.');
            // Propagate so `Command.undo`/`Command.execute` reject and
            // `HistoryManager` leaves `currentIndex` untouched on a
            // failed restore.
            throw err;
        }
    }

    /**
     * Captures the current canvas state into the undo/redo history.
     * Called automatically after transforms, mask operations, and crop.
     */
    saveState(): void {
        if (!this.canvas || this._suppressSaveState) return;
        const activeObj = this.canvas.getActiveObject();
        this._hideAllMaskLabels();

        try {
            const after = saveStateImpl({
                canvas: this.canvas,
                currentScale: this.currentScale,
                currentRotation: this.currentRotation,
                baseImageScale: this.baseImageScale,
            });
            const before = this._lastSnapshot ?? after;
            let executedOnce = false;

            // HistoryManager.execute() always invokes command.execute()
            // before storing the command. saveState() is called after the
            // canvas already reached `after`, so that first invocation only
            // arms the latch. Later redo() calls use the same closure after
            // an undo and must restore the captured `after` snapshot.
            const cmd = new Command(
                async () => {
                    if (executedOnce) {
                        await this.loadFromState(after);
                    }
                    executedOnce = true;
                },
                async () => { await this.loadFromState(before); },
            );

            this.historyManager.execute(cmd);
            this._lastSnapshot = after;

            if (activeObj && isMaskObject(activeObj)) this._showLabelForMask(activeObj);
            this._updateUI();
        } catch (err) {
            reportWarning(this.options, err, 'Failed to capture canvas snapshot.');
        }
    }

    /**
     * Undoes the last recorded action.
     *
     * Routed through {@link animQueue} so that undo is serialized with any
     * in-progress animation and rapid clicks cannot interleave canvas restores.
     * The {@link HistoryManager._processing} lock provides a second line of
     * defence inside the history layer itself.
     *
     * After {@link dispose} the call resolves without touching the canvas.
     * The early return covers the case where dispose has already happened;
     * the inner check covers the case where dispose happens while waiting
     * in the animation queue.
     */
    undo(): Promise<void> {
        if (this._disposed) return Promise.resolve();
        return this.animQueue.add(() =>
            this._disposed ? Promise.resolve() : this.historyManager.undo(),
        );
    }

    /**
     * Redoes the next recorded action.
     *
     * Same serialization and dispose guarantees as {@link undo}.
     */
    redo(): Promise<void> {
        if (this._disposed) return Promise.resolve();
        return this.animQueue.add(() =>
            this._disposed ? Promise.resolve() : this.historyManager.redo(),
        );
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PUBLIC — mask management
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Creates and adds a mask shape to the canvas.
     *
     * Delegates to {@link createMask} in `mask/mask-factory.ts`, which
     * owns the resolved-config build, polygon bounding-box realignment,
     * falsy-style preservation, monotonic `maskCounter` bookkeeping,
     * and the post-create ordering contract: add to canvas → update
     * list DOM → `setActiveObject` (when `selectable !== false`) →
     * `saveState` → `config.onCreate(mask, canvas)`
     * (19.1–19.5, 21.1, 21.2, 22.1, 22.2).
     *
     * @param config  Shape type, dimensions, position, style, and callbacks.
     * @returns The created mask object, or `null` if the canvas is unavailable.
     *
     * @example
     * ```ts
     * // Simple rect mask
     * editor.createMask;
     *
     * // Circle with custom size
     * editor.createMask({ shape: 'circle', radius: 60, color: 'rgba(255,0,0,0.4)'});
     *
     * // Positioned at 20% from the left
     * editor.createMask({ left: '20%', top: 40});
     * ```
     */
    createMask(config: MaskConfig = {}): MaskObject | null {
        if (!this.canvas) return null;
        const ctx = this._buildCreateMaskContext();
        return createMaskImpl(ctx, config);
    }

    /**
     * Removes the currently selected mask (and its label).
     *
     * Delegates to {@link removeSelectedMask} in `mask/mask-factory.ts`,
     * which removes the active mask, clears the canvas selection,
     * re-renders the mask list DOM, and pushes a single history entry.
     */
    removeSelectedMask(): void {
        if (!this.canvas) return;
        const ctx = this._buildRemoveMaskContext();
        removeSelectedMaskImpl(ctx);
        this._updateUI();
    }

    /**
     * Removes all masks and their labels.
     *
     * Delegates to {@link removeAllMasks} in `mask/mask-factory.ts`,
     * which removes every mask and label in canvas order, clears the
     * `_lastMask` reference, re-renders the mask list
     * DOM, and pushes a single history entry by default. Callers can
     * pass `{ saveHistory: false}` to skip the history push — used by
     * the merge and crop pipelines, which already record their own
     * enclosing history entry.
     *
     * Operation guard: while `isAnimating === true`
     * the call is a documented no-op so an in-flight scale/rotate
     * animation cannot have its mask layer torn out from under it. The
     * guard mirrors the loadImage pattern (silent no-op, no throw, no
     * DOM mutation) so the canvas, history stack, and mask list are
     * left untouched.
     */
    removeAllMasks(options: RemoveAllMasksOptions = {}): void {
        if (!this.canvas) return;
        // guarded operation. No DOM action while an
        // animation is in flight. Mirrors loadImage's silent-no-op shape.
        if (this._guard.isAnimating()) return;
        const ctx = this._buildRemoveMaskContext();
        removeAllMasksImpl(ctx, options);
        this._updateUI();
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PRIVATE — mask context builders
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Build the {@link CreateMaskContext} the mask factory reads/writes
     * through. The facade is the single owner of `maskCounter`,
     * `_lastMask`, the canvas, and `saveState`, so the context's
     * accessors all bind back to `this` rather than duplicating state.
     * @internal
     */
    private _buildCreateMaskContext(): CreateMaskContext {
        return {
            fabric: this._fabric,
            canvas: this.canvas!,
            options: this.options,
            getLastMask: () => this._lastMask,
            setLastMask: (maskObject) => { this._lastMask = maskObject; },
            getMaskCounter: () => this.maskCounter,
            setMaskCounter: (n) => { this.maskCounter = n; },
            updateMaskList: () => { this._updateMaskList(); },
            saveCanvasState: () => { this.saveState(); },
            expandCanvasIfNeeded: (w, h) => { this._setCanvasSizeInt(w, h); },
        };
    }

    /**
     * Build the {@link RemoveMaskContext} the mask factory reads/writes
     * through for `removeSelectedMask` / `removeAllMasks`. The facade
     * is the single owner of the canvas, mask label DOM, mask list
     * DOM, history, and `_lastMask`, so the context's accessors bind
     * back to `this`.
     * @internal
     */
    private _buildRemoveMaskContext(): RemoveMaskContext {
        return {
            canvas: this.canvas!,
            removeLabelForMask: (mask) => { this._removeLabelForMask(mask); },
            updateMaskList: () => { this._updateMaskList(); },
            saveCanvasState: () => { this.saveState(); },
            setLastMask: (maskObject) => { this._lastMask = maskObject; },
        };
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PRIVATE — mask label helpers
    // ═══════════════════════════════════════════════════════════════════════

    /** @internal */
    private _maskLabelContext(): MaskLabelManagerContext | null {
        if (!this.canvas) return null;
        return { fabric: this._fabric, canvas: this.canvas, options: this.options };
    }

    /** @internal */
    private _removeLabelForMask(mask: MaskObject): void {
        const ctx = this._maskLabelContext();
        if (!ctx) return;
        removeLabelForMask(ctx, mask);
    }

    /** @internal */
    private _createLabelForMask(mask: MaskObject): void {
        const ctx = this._maskLabelContext();
        if (!ctx) return;
        createLabelForMask(ctx, mask);
    }

    /** @internal */
    private _hideAllMaskLabels(): void {
        const ctx = this._maskLabelContext();
        if (!ctx) return;
        hideAllMaskLabels(ctx);
    }

    /** @internal */
    private _syncMaskLabel(mask: MaskObject): void {
        const ctx = this._maskLabelContext();
        if (!ctx) return;
        syncMaskLabel(ctx, mask);
    }

    /** @internal */
    private _showLabelForMask(mask: MaskObject): void {
        const ctx = this._maskLabelContext();
        if (!ctx) return;
        showLabelForMask(ctx, mask);
    }

    /** @internal */
    private _onSelectionChanged(selected: FabricNS.FabricObject[]): void {
        if (!this.canvas) return;
        const selectedMask = selected.find(isMaskObject) ?? null;
        const masks = this.canvas.getObjects().filter(isMaskObject);

        masks.forEach(maskObject => {
            if (maskObject !== selectedMask) {
                if (maskObject.__label) {
                    this._removeLabelForMask(maskObject);
                }
                applyMaskUnselectedStyle(maskObject);
            } else {
                applyMaskSelectedStyle(maskObject);
            }
        });

        if (selectedMask) this._showLabelForMask(selectedMask);
        this._updateMaskListSelection(selectedMask);
        this.canvas.requestRenderAll();
        this._updateUI();
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PRIVATE — mask list DOM
    // ═══════════════════════════════════════════════════════════════════════

    /** @internal */
    private _maskListContext(): MaskListContext {
        return {
            canvas: this.canvas,
            getListElementId: () => this.elements.maskList,
            onMaskSelected: (mask) => this._onSelectionChanged([mask]),
        };
    }

    /** @internal */
    private _updateMaskList(): void {
        renderMaskList(this._maskListContext());
    }

    /** @internal */
    private _updateMaskListSelection(selectedMask: MaskObject | null): void {
        updateMaskListSelection(this._maskListContext(), selectedMask);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PUBLIC — merge / export / download
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Bakes all current masks into the image:
     * exports the masked image, removes the masks, and re-imports the result
     * as the new base image.
     *
     * Operation guard: while `isAnimating === true`
     * the call resolves without mutation so a queued scale/rotate
     * animation cannot have the original image swapped out mid-flight.
     *
     * Delegates the merge pipeline to {@link mergeMasks} in
     * `export/export-service.ts`, which captures the pre-merge snapshot,
     * renders the merged bitmap via the export bake-in bracket, removes
     * masks without history, reloads the merged image transactionally,
     * preserves container scroll, and pushes exactly one history entry.
     * On any failure it restores the pre-merge snapshot and rejects with
     * `MergeMasksError`.
     *
     * @returns Promise that resolves when the merge is complete.
     */
    async mergeMasks(): Promise<void> {
        if (!this.canvas) return;
        // Guarded operation: leave the canvas, history stack, and masks
        // unchanged while an animation is in flight.
        if (this._guard.isAnimating()) return;
        const ctx = this._buildMergeMasksContext();
        await mergeMasksImpl(ctx);
        this._updateInputs();
        this._updateMaskList();
        this._updateUI();
    }

    /**
     * Triggers a browser download of the current canvas.
     *
     * Operation guard: while `isAnimating === true`
     * the call is a no-op (no DOM action, no download triggered).
     *
     * Delegates to {@link downloadImage} in `export/export-service.ts`,
     * which builds the data URL through the same pipeline used by
     * {@link exportImageBase64} and triggers the anchor-driven download.
     *
     * @param fileName Filename for the downloaded file.
     *   @default `options.defaultDownloadFileName`
     */
    downloadImage(fileName?: string): void {
        if (!this.canvas) return;
        // guarded operation. Silent DOM-no-op shape
        // so a queued scale/rotate animation does not get its export
        // pipeline run concurrently.
        if (this._guard.isAnimating()) return;
        const ctx = this._buildExportServiceContext();
        downloadImageImpl(ctx, fileName);
    }

    /**
     * Exports the canvas as a Base64-encoded data URL.
     *
     * Delegates to {@link exportImageBase64} in `export/export-service.ts`,
     * which discards any active selection, runs the bake-in/restore
     * bracket for `exportImageArea === true` exports, and emits a single
     * `canvas.toDataURL` call with the floored image-bounding-box region
     * after temporarily baking masks into the export when requested.
     *
     * Operation guard: while `isAnimating === true`
     * the call resolves to an empty string so an in-flight scale/rotate
     * animation does not see a mid-frame export of the canvas.
     *
     * @param options Export options.
     * @returns Promise resolving to a data URL on success, or `''` when
     *          no image is loaded.
     */
    async exportImageBase64(options?: Base64ExportOptions): Promise<string> {
        if (!this.canvas) return '';
        // Guarded operation: the canvas, mask styles, and active-object
        // selection are left untouched while an animation is in flight.
        if (this._guard.isAnimating()) return '';
        const ctx = this._buildExportServiceContext();
        return exportImageBase64Impl(ctx, options);
    }

    /**
     * Exports the canvas as a browser `File` object.
     *
     * Delegates to {@link exportImageFile} in `export/export-service.ts`,
     * which reuses the base64 pipeline, repaints through an offscreen
     * canvas only when the resulting MIME type does not match the
     * requested `fileType`, and resolves with a `File` whose `type`
     * matches the requested format (25.4,
     * 26.1–26.4).
     *
     * Operation guard: while `isAnimating === true`
     * the call rejects via `OperationGuard.assertNotAnimating` because
     * `Promise<File>` has no natural no-op shape. The thrown error
     * embeds the operation label so callers can distinguish the guard
     * rejection from an underlying export failure.
     *
     * @param options Export and file options.
     * @returns Promise resolving to a `File`.
     * @throws  `ExportNotReadyError` when no image is loaded.
     *
     * @example
     * ```ts
     * const file = await editor.exportImageFile({ fileType: 'png', mergeMask: false});
     * const formData = new FormData;
     * formData.append('image', file);
     * ```
     */
    async exportImageFile(options?: ImageFileExportOptions): Promise<File> {
        // Guarded operation: `Promise<File>` has no empty no-op shape, so
        // the operation guard rejects without mutating canvas state.
        this._guard.assertNotAnimating('exportImageFile');
        const ctx = this._buildExportServiceContext();
        return exportImageFileImpl(ctx, options);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PRIVATE — export / merge context builders
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Build the {@link ExportServiceContext} the export service reads
     * through. The facade is the single owner of the canvas, options,
     * and the `originalImage` reference.
     * @internal
     */
    private _buildExportServiceContext(): ExportServiceContext {
        return {
            fabric: this._fabric,
            canvas: this.canvas!,
            options: this.options,
            isImageLoaded: () => this.isImageLoaded(),
            getOriginalImage: () => this.originalImage,
        };
    }

    /**
     * Build the {@link MergeMasksContext} the merge pipeline reads
     * through. Extends the export-service context with the history
     * manager, container element, transactional `loadImage`, and the
     * `saveState`/`loadFromState`/`removeAllMasksNoHistory` callbacks
     * the merge needs.
     * @internal
     */
    private _buildMergeMasksContext(): MergeMasksContext {
        return {
            ...this._buildExportServiceContext(),
            historyManager: this.historyManager,
            containerElement: this.containerElement,
            loadImage: (base64, opts) => this.loadImage(base64, opts),
            saveState: () => this._captureSnapshot(),
            loadFromState: (snapshot) => this.loadFromState(snapshot),
            removeAllMasksNoHistory: () => {
                const ctx = this._buildRemoveMaskContext();
                removeAllMasksImpl(ctx, { saveHistory: false });
            },
        };
    }

    /**
     * Capture a snapshot string suitable for `loadFromState` without
     * pushing it onto the history stack. Used by the merge and crop
     * pipelines, which manage their own enclosing history entries and
     * need the same wire format `saveState` writes to history.
     *
     * Routes through `core/state-serializer.ts` so the snapshot wire
     * format has one production path. Does NOT push a history entry
     * and does NOT update `_lastSnapshot`.
     * @internal
     */
    private _captureSnapshot(): string {
        if (!this.canvas) return '';
        this._hideAllMaskLabels();
        return saveStateImpl({
            canvas: this.canvas,
            currentScale: this.currentScale,
            currentRotation: this.currentRotation,
            baseImageScale: this.baseImageScale,
        });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PUBLIC — crop mode
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Enters crop mode: adds a resizable selection rect to the canvas.
     * All other controls are disabled until {@link applyCrop} or
     * {@link cancelCrop} is called.
     *
     * Operation guard: while `isAnimating === true`
     * the call is a silent no-op; opening a crop session in the middle
     * of a queued scale/rotate animation would otherwise allow the
     * animation to mutate `originalImage` while a crop rect is bound to
     * the prior coordinate system.
     *
     * Delegates to {@link enterCropMode} in `crop/crop-controller.ts`,
     * which captures the pre-crop canvas snapshot, freezes every other
     * canvas object's `evented`/`selectable`, captures per-mask style
     * backups when `crop.hideMasksDuringCrop` is `true`, and adds the
     * interactive crop rectangle.
     */
    enterCropMode(): void {
        if (!this.canvas || !this.originalImage) return;
        if (this._cropSession) return;
        if (!this.isImageLoaded()) return;
        // guarded operation. No DOM action while an
        // animation is in flight: the canvas, selection state, and
        // pre-crop snapshot remain untouched.
        if (this._guard.isAnimating()) return;
        const ctx = this._buildCropControllerContext();
        enterCropModeImpl(ctx);
        this._updateUI();
    }

    /**
     * Cancels crop mode and removes the crop rectangle without applying
     * it.
     *
     * Delegates to {@link cancelCrop} in `crop/crop-controller.ts`,
     * which restores the per-object `evented`/`selectable`, restores
     * per-mask style backups, removes the crop rectangle, detaches
     * every crop-bound Fabric handler, and drops the session WITHOUT
     * pushing a history entry.
     */
    cancelCrop(): void {
        if (!this.canvas || !this._cropSession) return;
        const ctx = this._buildCropControllerContext();
        cancelCropImpl(ctx);
        this._cropSession = null;
        this._updateUI();
        this.canvas.requestRenderAll();
    }

    /**
     * Applies the current crop rectangle: crops the image and reloads
     * it. Pushes the operation onto the undo/redo history.
     *
     * Operation guard: while `isAnimating === true`
     * the call resolves without mutation. The crop session is left
     * intact so the user can retry once the queued animation settles.
     *
     * Delegates to {@link applyCrop} in `crop/crop-controller.ts`,
     * which reads the crop region, optionally captures intersecting
     * masks for `crop.preserveMasksAfterCrop`, exports the cropped
     * region, reloads it through the transactional loader, and pushes
     * exactly one history entry. On any failure it restores the
     * pre-crop snapshot and rejects with `CropApplyError`.
     *
     * @returns Promise that resolves when the cropped image is loaded.
     */
    async applyCrop(): Promise<void> {
        if (!this.canvas || !this._cropSession) return;
        // guarded operation. Resolved-promise no-op
        // shape: leave the open crop session alone so the user can
        // re-issue `applyCrop` after the in-flight scale/rotate
        // animation settles. Do not call `cancelCrop` here: the guard must
        // leave editor state untouched.
        if (this._guard.isAnimating()) return;
        const ctx = this._buildCropControllerContext();
        await applyCropImpl(ctx);
        this._updateInputs();
        this._updateMaskList();
        this._updateUI();
    }

    /**
     * Build the {@link CropControllerContext} the crop controller reads
     * through. The facade is the single owner of the live crop session
     * pointer (`_cropSession`), the canvas, the resolved options, the
     * history manager, and the transactional loader, so the context's
     * accessors all bind back to `this`.
     * @internal
     */
    private _buildCropControllerContext(): CropControllerContext {
        return {
            fabric: this._fabric,
            canvas: this.canvas!,
            options: this.options,
            historyManager: this.historyManager,
            isImageLoaded: () => this.isImageLoaded(),
            getOriginalImage: () => this.originalImage,
            getCropSession: () => this._cropSession,
            setCropSession: (s) => { this._cropSession = s; },
            saveState: () => this._captureSnapshot(),
            loadFromState: (snapshot) => this.loadFromState(snapshot),
            loadImage: (base64, opts) => this.loadImage(base64, opts),
            getMaskCounter: () => this.maskCounter,
            setMaskCounter: (n) => { this.maskCounter = n; },
            updateMaskList: () => { this._updateMaskList(); },
        };
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

        const hasImg = !!this.originalImage;
        const masks = hasImg ? this.canvas.getObjects().filter(isMaskObject) : [];
        const hasMasks = masks.length > 0;
        const active = this.canvas.getActiveObject();
        const hasSelectedMask = !!(active && isMaskObject(active));
        const isDefault = this.currentScale === 1 && this.currentRotation === 0;
        const canUndo = this.historyManager.canUndo();
        const canRedo = this.historyManager.canRedo();
        const inCrop = this._cropSession !== null;
        const isAnimating = this._guard.isAnimating();

        if (inCrop) {
            CROP_MODE_CONTROL_KEYS.forEach(key => {
                const id = this.elements[key];
                if (!id) return;
                const el = document.getElementById(id);
                if (!el || !('disabled' in el)) return;
                (el as HTMLButtonElement | HTMLInputElement).disabled =
                    !CROP_MODE_ENABLED_KEYS.includes(key);
            });
            return;
        }

        this._setDisabled('scaleRate', !hasImg || isAnimating);
        this._setDisabled('rotationLeftInput', !hasImg || isAnimating);
        this._setDisabled('rotationRightInput', !hasImg || isAnimating);
        this._setDisabled('zoomInBtn', !hasImg || isAnimating || this.currentScale >= this.options.maxScale);
        this._setDisabled('zoomOutBtn', !hasImg || isAnimating || this.currentScale <= this.options.minScale);
        this._setDisabled('rotateLeftBtn', !hasImg || isAnimating);
        this._setDisabled('rotateRightBtn', !hasImg || isAnimating);
        this._setDisabled('addMaskBtn', !hasImg || isAnimating);
        this._setDisabled('removeMaskBtn', !hasSelectedMask || isAnimating);
        this._setDisabled('removeAllMasksBtn', !hasMasks || isAnimating);
        this._setDisabled('mergeBtn', !hasImg || !hasMasks || isAnimating);
        this._setDisabled('downloadBtn', !hasImg || isAnimating);
        this._setDisabled('resetBtn', !hasImg || isDefault || isAnimating);
        this._setDisabled('undoBtn', !hasImg || isAnimating || !canUndo);
        this._setDisabled('redoBtn', !hasImg || isAnimating || !canRedo);
        this._setDisabled('cropBtn', !hasImg || isAnimating);
        this._setDisabled('imageInput', isAnimating);
        this._setDisabled('applyCropBtn', true);
        this._setDisabled('cancelCropBtn', true);
    }

    /** @internal */
    private _setDisabled(key: ElementKey, disabled: boolean): void {
        const id = this.elements[key];
        if (!id) return;
        const el = document.getElementById(id);
        if (el && 'disabled' in el) {
            (el as HTMLButtonElement | HTMLInputElement).disabled = disabled;
        }
    }

    /** @internal */
    private _updatePlaceholderStatus(): void {
        if (!this.options.showPlaceholder) return;
        setPlaceholderVisibleImpl(
            this.placeholderElement,
            this.containerElement,
            !this.originalImage,
        );
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PUBLIC — dispose
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Cleans up all DOM event listeners and disposes the Fabric.js Canvas.
     * Call this when the editor is no longer needed to prevent memory leaks.
     *
     * Teardown sequence:
     *
     * 1. Short-circuit on a second call so `dispose` is idempotent
     *. This also guards against re-running
     *    the teardown path after the canvas reference has already been
     *    nulled.
     * 2. Set `_disposed = true` so in-flight animation `onChange`/
     *    `onComplete` callbacks bail before touching the canvas
     * and so disposed-aware DOM handlers
     *    exit early.
     * 3. Drain the {@link AnimationQueue} so callers awaiting an enqueued
     *    slot do not hang after teardown.
     *    The currently-executing entry, if any, is not interrupted but
     *    settles promptly because its disposed-aware callbacks see the
     *    flag and exit.
     * 4. Detach every DOM listener via the bindings registry's
     *    `removeAll`, wrapped in try/catch
     *    inside the registry so already-detached listeners do not throw.
     * 5. Drop the crop rectangle if a crop session was open and dispose
     *    the underlying Fabric canvas, matching teardown order.
     */
    dispose(): void {
        // (1) Idempotent: a second `dispose` is a no-op.
        if (this._disposed) return;

        // (2) Signal in-flight animations and bound handlers to stop
        //     touching the canvas. Set BEFORE draining the queue so the
        //     active animation's disposed-aware callbacks see `true` on
        //     their next tick. The {@link OperationGuard} mirrors the
        //     same flag so the transform controller and Fabric animation
        //     wrapper short-circuit through the shared guard
        //.
        this._disposed = true;
        this._guard.markDisposed();

        // (3) Settle every queued animation. `clear` resolves pending
        //     entries (no rejection reason — the orchestrator's own
        //     dispose guards already prevent further canvas access) so
        //     `await editor.scaleImage(2)` callers do not hang.
        this.animQueue.clear();

        // (4) Detach every recorded DOM listener. The registry handles
        //     missing/already-detached elements internally.
        this._bindings?.removeAll();

        if (this._cropSession && this.canvas) {
            // (5) Drop the crop session if one was open. The crop
            //     controller's teardownSession is best-effort because
            //     Fabric may have already disposed the rect during a
            //     `loadFromState` rollback.
            try {
                const ctx = this._buildCropControllerContext();
                cancelCropImpl(ctx);
            } catch { /* ignore */ }
            this._cropSession = null;
        }

        if (this.canvas) {
            try { this.canvas.dispose(); } catch { /* ignore */ }
            this.canvas = null;
            this.canvasElement = null;
            this.isImageLoadedToCanvas = false;
        }

        // Drop the transform controller — the Fabric canvas reference
        // it captured via `TransformContext.canvas` is now disposed, so
        // the controller would crash if a queued entry somehow ran
        // after dispose. The animQueue.clear above already settles
        // pending entries, but null'ing the controller defends against
        // re-init paths that recreate state after dispose.
        this._transformController = null;

        // Clear the layout-manager viewport cache so a re-instantiation of
        // the editor on the same DOM does not inherit stale measurements.
        this._viewportCache.clear();
    }
}
