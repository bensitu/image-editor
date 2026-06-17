/**
 * @author Ben Situ
 * @license MIT
 * Lightweight canvas-based image editor built on Fabric.js v7.
 * Provides masks, annotations, animated transforms, crop, mosaic, undo/redo,
 * serialization, and export.
 *
 * @module
 */

import type * as FabricNS from 'fabric';
import { AnimationQueue } from './animation/animation-queue.js';
import { reportError, reportWarning } from './core/callback-reporter.js';
import {
    areResolvedMosaicConfigsEqual,
    areResolvedDrawConfigsEqual,
    areResolvedTextAnnotationConfigsEqual,
    cloneResolvedMosaicConfig,
    cloneResolvedDrawConfig,
    cloneResolvedTextAnnotationConfig,
    getInvalidDrawConfigFields,
    getInvalidMosaicConfigFields,
    getInvalidTextAnnotationConfigFields,
    isLayoutMode,
    mergeDrawConfigPatch,
    mergeMosaicConfigPatch,
    mergeTextAnnotationConfigPatch,
    resolveOptions,
} from './core/default-options.js';
import { OperationGuard, type OperationToken } from './core/operation-guard.js';
import {
    loadFromState as loadFromStateImpl,
    saveState as saveStateImpl,
    type CanvasJson,
} from './core/state-serializer.js';
import { Command, HistoryManager } from './history/history-manager.js';
import { detectFabric } from './fabric/fabric-adapter.js';
import type {
    AnnotationObject,
    AnnotationUpdateConfig,
    BaseImageObject,
    CropAspectRatio,
    CropModeOptions,
    DrawConfig,
    EditorToolMode,
    ElementIdMap,
    FabricModule,
    ImageEditorCallbackContext,
    ImageEditorOperation,
    ImageEditorSelection,
    ImageEditorState,
    ImageEditorOptions,
    ImageExportOptions,
    ImageInfo,
    ImageMimeType,
    LayoutMode,
    LoadImageOptions,
    MaskConfig,
    MaskObject,
    MosaicConfig,
    RemoveAllAnnotationsOptions,
    RemoveAllMasksOptions,
    ResolvedDrawConfig,
    ResolvedMosaicConfig,
    ResolvedOptions,
    ResolvedTextAnnotationConfig,
    TextAnnotationConfig,
    TextAnnotationObject,
} from './core/public-types.js';
import {
    isAnnotationObject,
    isDrawAnnotationObject,
    isEditableOverlayObject,
    isMaskObject,
    isTextAnnotationObject,
} from './core/public-types.js';
import {
    getAnnotations as getAnnotationsImpl,
    removeAllAnnotations as removeAllAnnotationsImpl,
    removeAnnotationObjects,
    removeSelectedAnnotation as removeSelectedAnnotationImpl,
    renderAnnotationList,
    updateAnnotation as updateAnnotationImpl,
    updateAnnotationListSelection,
    updateSelectedAnnotation as updateSelectedAnnotationImpl,
    type AnnotationListContext,
    type AnnotationManagerContext,
} from './annotation/annotation-manager.js';
import {
    attachTextEditingHandlersToAnnotations,
    createTextAnnotation as createTextAnnotationImpl,
    enterTextMode as enterTextModeImpl,
    exitTextMode as exitTextModeImpl,
    finalizeActiveTextEditing,
    type TextControllerContext,
    type TextSession,
} from './annotation/text-controller.js';
import {
    enterDrawMode as enterDrawModeImpl,
    exitDrawMode as exitDrawModeImpl,
    updateDrawBrush,
    type DrawControllerContext,
    type DrawSession,
} from './annotation/draw-controller.js';
import { isAnnotationLocked, isAnnotationUnlocked } from './annotation/annotation-lock.js';
import { syncAnnotationRuntimeStates } from './annotation/annotation-style.js';
import { normalizeLayerOrder, getEditableOverlayRange } from './core/layer-order.js';
import {
    applyCrop as applyCropImpl,
    cancelCrop as cancelCropImpl,
    enterCropMode as enterCropModeImpl,
    setCropAspectRatio as setCropAspectRatioImpl,
    type CropControllerContext,
    type CropSession,
} from './crop/crop-controller.js';
import {
    enterMosaicMode as enterMosaicModeImpl,
    exitMosaicMode as exitMosaicModeImpl,
    updateMosaicPreview,
    type MosaicControllerContext,
    type MosaicSession,
} from './mosaic/mosaic-controller.js';
import {
    downloadImage as downloadImageImpl,
    exportImageBase64 as exportImageBase64Impl,
    exportImageFile as exportImageFileImpl,
    mergeAnnotations as mergeAnnotationsImpl,
    mergeMasks as mergeMasksImpl,
    type ExportServiceContext,
    type MergeAnnotationsContext,
    type MergeMasksContext,
} from './export/export-service.js';
import { loadImage as loadImageImpl, type LoadImageContext } from './image/image-loader.js';
import {
    ViewportCache,
    applyCanvasDimensions,
    computeScrollableCanvasSize,
    measureScrollbarSize,
    type ViewportSize,
} from './image/layout-manager.js';
import { TransformController, type TransformContext } from './image/transform-controller.js';
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
import { renderMaskList, updateMaskListSelection, type MaskListContext } from './mask/mask-list.js';
import {
    applyMaskSelectedStyle,
    applyMaskUnselectedStyle,
    reattachMaskHoverHandlers,
} from './mask/mask-style.js';
import { DomBindings } from './ui/dom-bindings.js';
import { setPlaceholderVisible as setPlaceholderVisibleImpl } from './ui/visibility-state.js';
import { inferImageMimeType, readFileAsDataUrl, resetFileInput } from './utils/file.js';
import { detectSourceMimeType } from './image/image-resampler.js';

// ─── Internal element-key type ────────────────────────────────────────────────

type ElementKey = keyof Required<ElementIdMap>;

// ─── Resolved element ID map (all keys guaranteed present) ───────────────────

type ResolvedElementIdMap = Record<ElementKey, string | null>;

const LAYOUT_EPSILON = 0.5;

interface ImageDisplayGeometry {
    canvasWidth: number;
    canvasHeight: number;
    imageDisplayWidth: number;
    imageDisplayHeight: number;
}

const INTERNAL_OPERATION_TOKEN = Symbol('ImageEditorInternalOperation');
const INTERNAL_ALLOW_DURING_ANIMATION_QUEUE = Symbol('ImageEditorAllowDuringAnimationQueue');

type InternalOperationOptions = {
    [INTERNAL_OPERATION_TOKEN]?: OperationToken;
    [INTERNAL_ALLOW_DURING_ANIMATION_QUEUE]?: true;
};

// Crop mode freezes both toolbar buttons and form controls that can
// start competing editor actions while a crop session owns the canvas.
const CROP_MODE_CONTROL_KEYS: readonly ElementKey[] = [
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

const CROP_MODE_ENABLED_KEYS: readonly ElementKey[] = [
    'cropAspectRatioSelect',
    'applyCropButton',
    'cancelCropButton',
];
const CROP_SESSION_ALLOWED_OPERATIONS = new Set(['setCropAspectRatio', 'applyCrop', 'cancelCrop']);
const TEXT_MODE_ENABLED_KEYS: readonly ElementKey[] = [
    'exitTextModeButton',
    'textColorInput',
    'textFontSizeInput',
];
const DRAW_MODE_ENABLED_KEYS: readonly ElementKey[] = [
    'exitDrawModeButton',
    'drawColorInput',
    'drawBrushSizeInput',
];

// Mosaic mode owns pointer interaction on the canvas. While active, controls
// that could replace objects, mutate masks, or restore history are disabled;
// only Mosaic config controls and the exit action remain enabled.
const MOSAIC_MODE_CONTROL_KEYS: readonly ElementKey[] = [
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

const MOSAIC_MODE_ENABLED_KEYS: readonly ElementKey[] = [
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

const IMAGE_EDITOR_OPERATIONS: ReadonlySet<ImageEditorOperation> = new Set([
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

const TOOL_MODE_ALLOWED_OPERATIONS: Record<EditorToolMode, ReadonlySet<string>> = {
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

function isImageEditorOperation(value: string | null): value is ImageEditorOperation {
    return value !== null && IMAGE_EDITOR_OPERATIONS.has(value as ImageEditorOperation);
}

// ─── ImageEditor ─────────────────────────────────────────────────────────────

/**
 * Lightweight Fabric.js v7 image editor with masking, animated transforms,
 * crop, undo/redo, and multi-format export.
 *
 * ## Quick start (ESM)
 * ```ts
 * import * as fabric from 'fabric';
 * import { ImageEditor } from '@bensitu/image-editor';
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
    private fabricModule: FabricModule;
    private isFabricLoaded: boolean;

    // ── Resolved options ────────────────────────────────────────────────────
    private readonly options: ResolvedOptions;
    private currentLayoutMode: LayoutMode = 'expand';
    private readonly defaultMosaicConfig: ResolvedMosaicConfig;
    private currentMosaicConfig: ResolvedMosaicConfig;
    private readonly defaultTextConfig: ResolvedTextAnnotationConfig;
    private currentTextConfig: ResolvedTextAnnotationConfig;
    private readonly defaultDrawConfig: ResolvedDrawConfig;
    private currentDrawConfig: ResolvedDrawConfig;

    // ── Canvas / DOM ────────────────────────────────────────────────────────
    private canvas: FabricNS.Canvas | null = null;
    private canvasElement: HTMLCanvasElement | null = null;
    private containerElement: HTMLElement | null = null;
    private placeholderElement: HTMLElement | null = null;
    private elements: ResolvedElementIdMap = {} as ResolvedElementIdMap;
    private readonly elementOriginalDisabledMap = new Map<ElementKey, boolean>();
    private readonly elementOriginalAriaDisabledMap = new Map<ElementKey, string | null>();
    private readonly elementOriginalPointerEventsMap = new Map<ElementKey, string>();

    // ── Image state ─────────────────────────────────────────────────────────
    private originalImage: BaseImageObject | null = null;
    private baseImageScale = 1;
    private currentScale = 1;
    private currentRotation = 0;
    private isImageLoadedToCanvas = false;
    private currentImageMimeType: ImageMimeType | null = null;

    // ── Mask state ──────────────────────────────────────────────────────────
    private maskCounter = 0;
    private lastMask: MaskObject | null = null;
    private annotationCounter = 0;

    // ── History ─────────────────────────────────────────────────────────────
    private lastSnapshot: string | null = null;
    private readonly historyManager: HistoryManager;

    // ── Animation ───────────────────────────────────────────────────────────
    /**
     * Single source of truth for `isAnimating` and `isDisposed` flags
     * shared between the facade, the transform controller, and the
     * Fabric animation wrapper. The transform controller calls
     * `runAnimation` to bracket each Fabric tween so the flag is
     * cleared inside a `finally`; the facade reads
     * `isAnimating` for the per-method guard rejections; and the
     * dispose path forwards to
     * `markDisposed` so in-flight animation callbacks short-circuit.
     */
    private readonly operationGuard: OperationGuard;
    private readonly animQueue: AnimationQueue;
    /**
     * Owns animated `scaleImage`, `rotateImage`, and
     * `resetImageTransform`. The facade enqueues each public method on
     * {@link animQueue} and the controller drives
     * the per-Fabric-animation `runAnimation` bracket through
     * {@link operationGuard}. The controller is constructed in {@link init}
     * once `canvas` is available so its `TransformContext` can hold a
     * stable Fabric canvas reference.
     */
    private transformController: TransformController | null = null;

    // ── Image-loader viewport cache ─────────────────────────────────────────
    /**
     * Hidden-container viewport cache shared across `loadImage` calls. Owned
     * by the facade so the layout manager can reuse the last visible
     * measurement when the editor is hidden inside a tab, modal, or
     * accordion.
     */
    private readonly viewportCache: ViewportCache = new ViewportCache();

    // ── Crop ────────────────────────────────────────────────────────────────
    /**
     * Live crop session pointer owned by the facade. The crop controller
     * (`crop/crop-controller.ts`) reads and writes this slot through the
     * `getCropSession`/`setCropSession` callbacks bundled into the
     * controller's context, so the controller has no class state of its
     * own and multiple editors on the same page do not share crop state.
     */
    private cropSession: CropSession | null = null;

    // ── Mosaic ──────────────────────────────────────────────────────────────
    private mosaicSession: MosaicSession | null = null;
    private textSession: TextSession | null = null;
    private drawSession: DrawSession | null = null;

    // ── DOM event cleanup ───────────────────────────────────────────────────
    /**
     * Managed registry of DOM event listeners owned by this editor.
     *
     * Constructed lazily by {@link init} so the registry can read the
     * editor's `isDisposed` flag through a closure that captures `this`.
     * `dispose` drains the registry via {@link DomBindings.removeAll}
     * and the wrapped handlers exit early while
     * `isDisposed === true`.
     */
    private domBindings: DomBindings | null = null;
    private keyboardDocument: Document | null = null;
    private keyboardHandler: ((event: KeyboardEvent) => void) | null = null;
    private isDisposed = false;
    /**
     * When `true`, {@link saveState} is a no-op.  Used by
     * {@link resetImageTransform} (via the transform controller) to
     * suppress the intermediate history entries from {@link scaleImage}
     * and {@link rotateImage} so the entire reset is a single undoable
     * step.
     */
    private shouldSuppressSaveState = false;
    private lastEmittedIsBusy: boolean | null = null;
    private activeStateRestoreOperation: ImageEditorOperation | null = null;
    private nextSelectionChangeContext: ImageEditorCallbackContext | null = null;

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
     * @param fabricModuleOrOptions - Fabric.js module (ESM) or options (UMD).
     * @param options - Editor options when the first argument
     *                              is the Fabric module. Ignored otherwise.
     */
    constructor(
        fabricModuleOrOptions: FabricModule | ImageEditorOptions = {},
        options: ImageEditorOptions = {},
    ) {
        // detect the Fabric module and
        // separate it from the user's options partial. The adapter logs a
        // single `console.error` on a miss; we then surface that miss via
        // `isFabricLoaded === false` so `init` and `loadImage` can
        // short-circuit.
        const detected = detectFabric(fabricModuleOrOptions, options);

        // The adapter returns `null` on a miss; the public field type is
        // `FabricModule`, so the cast keeps the rest of the class typed
        // exactly as before. The `isFabricLoaded` flag is the single
        // source of truth for "is Fabric usable?" — every public method
        // that touches Fabric checks it before mutating canvas state.
        this.fabricModule = detected.fabric ?? ({} as FabricModule);
        this.isFabricLoaded = detected.isFabricLoaded;

        // resolve options through the canonical
        // resolver. `resolveOptions` applies defaults for every top-level
        // key, deep-merges `label.textOptions` and `crop`, normalizes
        // callbacks to functions or `null`, drops unknown top-level keys,
        // and freezes the returned `label`/`crop` references so a later
        // mutation of `userInput.label.textOptions` cannot affect the
        // live editor.
        this.options = resolveOptions(detected.options);
        this.currentLayoutMode = this.options.layoutMode;
        this.defaultMosaicConfig = this.options.defaultMosaicConfig;
        this.currentMosaicConfig = cloneResolvedMosaicConfig(this.defaultMosaicConfig);
        this.defaultTextConfig = this.options.defaultTextConfig;
        this.currentTextConfig = cloneResolvedTextAnnotationConfig(this.defaultTextConfig);
        this.defaultDrawConfig = this.options.defaultDrawConfig;
        this.currentDrawConfig = cloneResolvedDrawConfig(this.defaultDrawConfig);

        const rawDefaultLayoutMode = (detected.options as Record<string, unknown>)
            .defaultLayoutMode;
        if (rawDefaultLayoutMode !== undefined && !isLayoutMode(rawDefaultLayoutMode)) {
            reportWarning(
                this.options,
                new TypeError(
                    `[ImageEditor] Unsupported defaultLayoutMode ` +
                        `${JSON.stringify(rawDefaultLayoutMode)}. ` +
                        'Expected "fit", "cover", or "expand".',
                ),
                'Invalid defaultLayoutMode fell back to "expand".',
            );
        }

        // ── Internal facade state ─────────────────────────────────────────
        // `historyManager`, `animQueue`, `operationGuard`, and the callbacks on
        // `options` stay implementation-owned. The public read-only
        // introspection point is `isImageLoaded`.
        //
        // The `operationGuard` is shared between the facade (for the
        // animation per-method guards), the transform controller
        // (for `runAnimation` bracketing), and the
        // Fabric animation wrapper (for `isDisposed`-aware callbacks).
        // The `transformController` is constructed
        // lazily in {@link init} once a canvas is available.
        this.operationGuard = new OperationGuard();
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
     * @param idMap - Optional mapping from logical names to DOM element IDs.
     *
     * @example
     * ```ts
     * editor.init({ canvas: 'myCanvas', downloadImageButton: 'dlBtn'});
     * ```
     */
    init(idMap: ElementIdMap = {}): void {
        if (!this.isFabricLoaded) {
            const globalFabric = (globalThis as unknown as { fabric?: unknown }).fabric;
            if (
                !globalFabric ||
                typeof (globalFabric as { Canvas?: unknown }).Canvas !== 'function'
            ) {
                return;
            }
            this.fabricModule = globalFabric as FabricModule;
            this.isFabricLoaded = true;
        }
        // Idempotency on the dispose side is mirrored
        // here: a post-dispose `init` would otherwise re-create the
        // canvas without the bindings registry the dispose path drained,
        // and would also leak Fabric resources. Returning early matches
        // the dispose contract in `core/operation-guard.ts`.
        if (this.isDisposed) return;

        const defaults: ResolvedElementIdMap = {
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

        this.elements = { ...defaults, ...idMap } as ResolvedElementIdMap;

        this.initCanvas();
        // Construct the bindings registry after `initCanvas` so document
        // resolution is anchored to the actual canvas owner document.
        // The resolver closes over `this.elements` so subsequent ID-map
        // mutations are reflected without rebuilding the registry; the
        // disposed-flag closure routes through the operation guard's single
        // source of truth.
        this.domBindings = new DomBindings(
            (key) => this.elements[key],
            () => this.isDisposed,
            () => this.canvasElement?.ownerDocument ?? document,
        );
        // Construct the transform controller now that the Fabric canvas
        // is available. The context binds back to facade fields so the
        // controller does not duplicate state.
        this.transformController = new TransformController(this.buildTransformContext());
        this.bindDomEvents();
        this.updateInputs();
        this.updateMaskList();
        this.updateAnnotationList();
        this.updateUi();

        if (this.options.initialImageBase64) {
            void this.loadImage(this.options.initialImageBase64).catch(() => {
                // loadImage already restores state and routes the error through onError.
            });
        } else {
            this.updatePlaceholderStatus();
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PRIVATE — canvas setup
    // ═══════════════════════════════════════════════════════════════════════

    private initCanvas(): void {
        const id = this.elements.canvas;
        const canvasElement = id ? (document.getElementById(id) as HTMLCanvasElement | null) : null;
        if (!canvasElement) throw new Error(`[ImageEditor] Canvas element not found: "${id}"`);
        this.canvasElement = canvasElement;

        const containerId = this.elements.canvasContainer;
        if (containerId) {
            this.containerElement =
                document.getElementById(containerId) ?? canvasElement.parentElement;
        } else {
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
            this.handleSelectionChanged((e as { selected: FabricNS.FabricObject[] }).selected);
        });
        this.canvas.on('selection:updated', (e) => {
            this.handleSelectionChanged((e as { selected: FabricNS.FabricObject[] }).selected);
        });
        this.canvas.on('selection:cleared', () => this.handleSelectionChanged([]));

        const onObjectEvent = (e: { target?: FabricNS.FabricObject }) => {
            if (e.target) this.handleObjectMovingScalingRotating(e.target);
        };
        const onObjectModified = (e: { target?: FabricNS.FabricObject }) => {
            if (e.target) this.handleObjectModified(e.target);
        };
        this.canvas.on('object:moving', onObjectEvent);
        this.canvas.on('object:scaling', onObjectEvent);
        this.canvas.on('object:rotating', onObjectEvent);
        this.canvas.on('object:modified', onObjectModified);
    }

    private getLiveCanvasOrThrow(operationName: string): FabricNS.Canvas {
        if (this.isDisposed || !this.canvas) {
            throw new Error(`[ImageEditor] Cannot run "${operationName}" after dispose.`);
        }
        return this.canvas;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PRIVATE — DOM / UI bindings
    // ═══════════════════════════════════════════════════════════════════════

    private bindDomEvents(): void {
        this.bindElementIfExists('uploadArea', 'click', () => {
            const inputId = this.elements.imageInput;
            if (inputId) document.getElementById(inputId)?.click();
        });

        this.bindElementIfExists('imageInput', 'change', (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) void this.loadImageFile(file);
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
                ? (document.getElementById(inputId) as HTMLInputElement | null)
                : null;
            let step = this.options.rotationStep;
            if (inputEl) {
                const parsedStep = parseFloat(inputEl.value);
                if (!isNaN(parsedStep)) step = parsedStep;
            }
            void this.rotateImage(this.currentRotation - step);
        });
        this.bindElementIfExists('rotateRightButton', 'click', () => {
            const inputId = this.elements.rotateRightDegreesInput;
            const inputEl = inputId
                ? (document.getElementById(inputId) as HTMLInputElement | null)
                : null;
            let step = this.options.rotationStep;
            if (inputEl) {
                const parsedStep = parseFloat(inputEl.value);
                if (!isNaN(parsedStep)) step = parsedStep;
            }
            void this.rotateImage(this.currentRotation + step);
        });

        this.bindElementIfExists('enterCropModeButton', 'click', () => {
            this.enterCropMode({ aspectRatio: this.getSelectedCropAspectRatio() });
        });
        this.bindElementIfExists('cropAspectRatioSelect', 'change', () => {
            if (this.cropSession) this.setCropAspectRatio(this.getSelectedCropAspectRatio());
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

        const bindMosaicSizeInput = (
            key: 'mosaicBrushSizeInput' | 'mosaicBlockSizeInput',
            applyValue: (value: number) => void,
        ): void => {
            const handler: EventListener = (event) => {
                const parsed = parseFloat((event.target as HTMLInputElement).value);
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

        const bindStringInput = (
            key: 'textColorInput' | 'drawColorInput',
            applyValue: (value: string) => void,
        ): void => {
            const handler: EventListener = (event) => {
                applyValue((event.target as HTMLInputElement).value);
            };
            this.bindElementIfExists(key, 'input', handler);
            this.bindElementIfExists(key, 'change', handler);
        };
        const bindNumberInput = (
            key: 'textFontSizeInput' | 'drawBrushSizeInput',
            applyValue: (value: number) => void,
        ): void => {
            const handler: EventListener = (event) => {
                applyValue(parseFloat((event.target as HTMLInputElement).value));
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

    private bindElementIfExists(key: ElementKey, event: string, handler: EventListener): void {
        // Routed through the managed registry so `dispose` can detach
        // every listener with a single `removeAll` call. The registry
        // also wraps the handler in a `isDisposed`-aware shim so handlers
        // stop firing once dispose has run.
        this.domBindings?.bindIfExists(key, event, handler);
    }

    private bindKeyboardEvents(): void {
        const ownerDocument = this.canvasElement?.ownerDocument ?? document;
        if (this.keyboardHandler && this.keyboardDocument) {
            this.keyboardDocument.removeEventListener('keydown', this.keyboardHandler);
        }
        this.keyboardDocument = ownerDocument;
        this.keyboardHandler = (event: KeyboardEvent) => this.handleKeyboardEvent(event);
        ownerDocument.addEventListener('keydown', this.keyboardHandler);
    }

    private isNativeTextInputActive(): boolean {
        const activeElement = this.keyboardDocument?.activeElement;
        if (!activeElement) return false;
        const tagName = activeElement.tagName.toLowerCase();
        return (
            tagName === 'input' ||
            tagName === 'textarea' ||
            tagName === 'select' ||
            (activeElement as HTMLElement).isContentEditable === true
        );
    }

    private isFabricTextEditingActive(): boolean {
        const activeObject = this.canvas?.getActiveObject();
        return !!(
            activeObject &&
            isTextAnnotationObject(activeObject) &&
            (activeObject as { isEditing?: boolean }).isEditing === true
        );
    }

    private handleKeyboardEvent(event: KeyboardEvent): void {
        if (this.isDisposed) return;
        if (event.key === 'Delete' || event.key === 'Backspace') {
            if (this.isNativeTextInputActive() || this.isFabricTextEditingActive()) return;
            this.deleteSelectedObject();
            return;
        }
        if (event.key !== 'Escape') return;
        if (this.isFabricTextEditingActive() && this.canvas) {
            finalizeActiveTextEditing(this.buildTextControllerContext(), { commit: false });
            event.preventDefault();
            return;
        }
        if (this.textSession) {
            this.exitTextMode();
        } else if (this.drawSession) {
            this.exitDrawMode();
        } else if (this.mosaicSession) {
            this.exitMosaicMode();
        } else if (this.cropSession) {
            this.cancelCrop();
        }
    }

    private finalizeActiveTextEditingIfNeeded(): void {
        if (!this.canvas || !this.isFabricTextEditingActive()) return;
        finalizeActiveTextEditing(this.buildTextControllerContext(), { commit: true });
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
     */
    private async loadImageFile(file: File): Promise<void> {
        const inputId = this.elements.imageInput;
        const inputEl = inputId
            ? (document.getElementById(inputId) as HTMLInputElement | null)
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

        let dataUrl: string;
        try {
            dataUrl = await readFileAsDataUrl(file);
        } catch (error) {
            reportError(this.options, error, 'Failed to read selected image file.');
            resetFileInput(inputEl);
            return;
        }

        try {
            await this.loadImage(dataUrl);
        } catch {
            // loadImage already reports transactional load failures through onError.
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
     * Pipeline contract preserved end-to-end:
     *
     * - Non-`data:image/` strings resolve without mutation.
     * - On a valid data URL, the loader captures a rollback bundle BEFORE
     *   the first mutation. Decode, downsample, Fabric, timeout, or layout
     *   failures replay the bundle and reject with the original error.
     * - On commit, the loader sets `originalImage`, `currentScale = 1`,
     *   `currentRotation = 0`, `baseImageScale`, `maskCounter = 0`,
     *   `lastSnapshot`, and `isImageLoadedToCanvas = true`. It also
     *   honours `LoadImageOptions.preserveScroll` and invokes
     *   `onImageLoaded` exactly once after every scalar is committed.
     *
     * Operation guard: `loadImage` is one of the
     * guarded operations. While `isAnimating === true` the facade rejects
     * the call as a documented no-op so a queued scale/rotate animation
     * cannot be torn down by a concurrent reload.
     *
     * @param base64 - Data URL string starting with `data:image/…`.
     * @param options - Optional {@link LoadImageOptions}; currently only
     *                `preserveScroll` is consulted.
     * @returns A promise that resolves once the image is on the canvas, or
     *          rejects with the original error after a transactional
     *          rollback. Non-data:image inputs and Fabric-unavailable /
     *          disposed states resolve without observable mutation.
     */
    async loadImage(base64: string, options: LoadImageOptions = {}): Promise<void> {
        return this.loadImageInternal(
            base64,
            options as LoadImageOptions & InternalOperationOptions,
        );
    }

    private async loadImageInternal(
        base64: string,
        options: LoadImageOptions & InternalOperationOptions = {},
    ): Promise<void> {
        // Fabric-unavailable and disposed gates mirror "init and
        // loadImage are no-ops" contract.
        if (!this.isFabricLoaded || !this.canvas) return;
        if (this.isDisposed) return;
        if (typeof base64 !== 'string' || !base64.startsWith('data:image/')) return;

        if (!this.canRunIdleOperation('loadImage', options)) return;
        this.finalizeActiveTextEditingIfNeeded();
        const callbackContext = this.getOperationContext('loadImage', options);
        const previousImage = this.originalImage;
        const hadMasks = this.getMasks().length > 0;
        const hadAnnotations = this.getAnnotations().length > 0;
        this.emitOptionCallback('onImageLoadStart', [callbackContext]);
        this.operationGuard.beginLoading();
        this.emitBusyChangeIfChanged(callbackContext);
        this.updateUi();

        // Drop any stale label objects BEFORE the loader clears the
        // canvas. The loader does call `canvas.clear` itself, but the
        // facade also tracks `mask.labelObject` references on the mask
        // objects and will leak those references onto stale objects
        // unless we hide them up-front.
        this.hideAllMaskLabels();

        // Build the dependency bundle the loader consumes. Each closure
        // reads/writes the canonical facade state so the loader has no
        // class state of its own.
        const loadImageContext: LoadImageContext = {
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

            // Route placeholder visibility through the canonical helper
            // (`ui/visibility-state.ts`) so the loader's rollback path
            // restores the placeholder using the same standard-DOM-state
            // transition as every other code path.
            setPlaceholderVisible: (show) => {
                setPlaceholderVisibleImpl(
                    this.placeholderElement,
                    this.containerElement,
                    this.options.showPlaceholder ? show : false,
                );
            },
        };

        try {
            await loadImageImpl(loadImageContext, base64, options);
        } finally {
            this.operationGuard.endLoading();
            this.emitBusyChangeIfChanged(callbackContext);
            if (!this.isDisposed && this.canvas) this.updateUi();
        }

        // ── Facade-only post-commit bookkeeping ─────────────────────────
        // The loader owns canvas state, transform scalars, and
        // lastSnapshot. Everything below is facade-specific UI,
        // lifecycle-callback, and mask-placement memo state that the
        // loader has no visibility into. The block runs only when the
        // load committed — a thrown error short-circuits it via the
        // `throw` above, which matches the loader's "no observable
        // change on rollback" contract.
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

    private getInternalOperationToken(options?: object | null): OperationToken | null {
        return (
            (options as InternalOperationOptions | null | undefined)?.[INTERNAL_OPERATION_TOKEN] ??
            null
        );
    }

    private canRunDuringAnimationQueue(options?: object | null): boolean {
        return !!(options as InternalOperationOptions | null | undefined)?.[
            INTERNAL_ALLOW_DURING_ANIMATION_QUEUE
        ];
    }

    private withInternalOperationOptions<T extends object>(
        token: OperationToken | null | undefined,
        options: T = {} as T,
    ): T & InternalOperationOptions {
        return {
            ...options,
            ...(token ? { [INTERNAL_OPERATION_TOKEN]: token } : {}),
        } as T & InternalOperationOptions;
    }

    private withAnimationQueueBypass<T extends object>(
        options: T = {} as T,
    ): T & InternalOperationOptions {
        return {
            ...options,
            [INTERNAL_ALLOW_DURING_ANIMATION_QUEUE]: true,
        } as T & InternalOperationOptions;
    }

    private assertIdleForOperation(operationName: string, options?: object | null): void {
        const token = this.getInternalOperationToken(options);
        this.operationGuard.assertIdleForOperation(operationName, token);
        const activeToolMode = this.getActiveToolMode();
        if (
            activeToolMode &&
            !this.operationGuard.isOwnOperation(token) &&
            !TOOL_MODE_ALLOWED_OPERATIONS[activeToolMode].has(operationName)
        ) {
            throw new Error(
                `[ImageEditor] Cannot run "${operationName}" while ${activeToolMode} mode is active.`,
            );
        }
        if (this.animQueue.isBusy() && !this.canRunDuringAnimationQueue(options)) {
            throw new Error(
                `[ImageEditor] Cannot run "${operationName}" while an animation is queued.`,
            );
        }
    }

    private canRunIdleOperation(operationName: string, options?: object | null): boolean {
        try {
            this.assertIdleForOperation(operationName, options);
            return true;
        } catch (error) {
            if (!this.isExpectedIdleGuardError(error, operationName)) {
                throw error;
            }
            return false;
        }
    }

    private getSelectedCropAspectRatio(): CropAspectRatio {
        const inputId = this.elements.cropAspectRatioSelect;
        const inputEl = inputId
            ? (document.getElementById(inputId) as HTMLInputElement | HTMLSelectElement | null)
            : null;
        const value = inputEl && 'value' in inputEl ? String(inputEl.value).trim() : '';
        return (value || 'free') as CropAspectRatio;
    }

    private isExpectedIdleGuardError(error: unknown, operationName: string): boolean {
        return (
            error instanceof Error &&
            error.message.startsWith(`[ImageEditor] Cannot run "${operationName}" `)
        );
    }

    private assertCanQueueAnimation(operationName: string, options?: object | null): void {
        const token = this.getInternalOperationToken(options);
        this.operationGuard.assertCanQueueAnimation(operationName, token);
        const activeToolMode = this.getActiveToolMode();
        if (
            activeToolMode &&
            !this.operationGuard.isOwnOperation(token) &&
            !TOOL_MODE_ALLOWED_OPERATIONS[activeToolMode].has(operationName)
        ) {
            throw new Error(
                `[ImageEditor] Cannot run "${operationName}" while ${activeToolMode} mode is active.`,
            );
        }
    }

    /**
     * Returns `true` if a valid image is currently loaded on the canvas.
     */
    isImageLoaded(): boolean {
        return !!(
            this.originalImage &&
            this.originalImage instanceof this.fabricModule.FabricImage &&
            (this.originalImage.width ?? 0) > 0 &&
            (this.originalImage.height ?? 0) > 0
        );
    }

    /**
     * Returns `true` while the editor is loading, animating, or in crop mode.
     */
    isBusy(): boolean {
        return this.operationGuard.isBusy() || this.animQueue.isBusy() || this.isToolModeActive();
    }

    /**
     * Selects the layout strategy used by subsequent image loads.
     *
     * The current canvas is not re-laid out immediately; call this before
     * `loadImage()` to choose how the next image is placed.
     *
     * @param mode - Layout mode to use for future image loads.
     */
    setLayoutMode(mode: LayoutMode): void {
        if (!isLayoutMode(mode)) {
            reportWarning(
                this.options,
                new TypeError(
                    `[ImageEditor] Unsupported layout mode ${JSON.stringify(mode)}. ` +
                        'Expected "fit", "cover", or "expand".',
                ),
                'Ignored invalid layout mode.',
            );
            return;
        }

        this.currentLayoutMode = mode;
    }

    private getRuntimeOptions(): ResolvedOptions {
        if (this.currentLayoutMode === this.options.layoutMode) return this.options;
        return Object.freeze({
            ...this.options,
            layoutMode: this.currentLayoutMode,
        }) as ResolvedOptions;
    }

    private buildCallbackContext(
        operation: ImageEditorOperation,
        isInternalOperation = false,
    ): ImageEditorCallbackContext {
        return { operation, isInternalOperation };
    }

    private getOperationContext(
        fallback: ImageEditorOperation,
        options?: object | null,
    ): ImageEditorCallbackContext {
        const internal = this.getInternalOperationToken(options as InternalOperationOptions | null);
        const activeOperation = this.operationGuard.activeOperationName();
        if (internal && activeOperation) {
            return this.buildCallbackContext(
                isImageEditorOperation(activeOperation) ? activeOperation : fallback,
                true,
            );
        }
        return this.buildCallbackContext(fallback, false);
    }

    private emitOptionCallback(
        callbackName:
            | 'onImageLoadStart'
            | 'onImageLoaded'
            | 'onImageCleared'
            | 'onImageChanged'
            | 'onBusyChange'
            | 'onEditorDisposed'
            | 'onMasksChanged'
            | 'onAnnotationsChanged'
            | 'onSelectionChange',
        args: unknown[],
    ): void {
        const callback = this.options[callbackName] as
            | ((...callbackArgs: never[]) => unknown)
            | null;
        if (typeof callback !== 'function') return;
        try {
            callback(...(args as never[]));
        } catch (error) {
            console.error(`[ImageEditor] ${callbackName} callback threw`, error);
        }
    }

    private getImageInfo(): ImageInfo | null {
        if (!this.canvas || !this.originalImage) return null;
        const canvasWidth = this.canvas.getWidth();
        const canvasHeight = this.canvas.getHeight();
        let displayWidth: number;
        let displayHeight: number;
        try {
            this.originalImage.setCoords();
            const bounds = this.originalImage.getBoundingRect();
            displayWidth = Math.max(0, Number(bounds.width) || 0);
            displayHeight = Math.max(0, Number(bounds.height) || 0);
        } catch {
            displayWidth = Math.max(
                0,
                (Number(this.originalImage.width) || 0) *
                    Math.abs(Number(this.originalImage.scaleX) || 1),
            );
            displayHeight = Math.max(
                0,
                (Number(this.originalImage.height) || 0) *
                    Math.abs(Number(this.originalImage.scaleY) || 1),
            );
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

    private getMasks(): MaskObject[] {
        if (!this.canvas) return [];
        return this.canvas.getObjects().filter(isMaskObject).slice();
    }

    getAnnotations(): AnnotationObject[] {
        if (!this.canvas) return [];
        return getAnnotationsImpl(this.canvas);
    }

    private getMaskCollectionSignature(): string {
        return this.getMasks()
            .map((mask) => `${mask.maskId}:${mask.maskName}`)
            .join('|');
    }

    private getAnnotationCollectionSignature(): string {
        return this.getAnnotations()
            .map((annotation) => `${annotation.annotationId}:${annotation.annotationName}`)
            .join('|');
    }

    private getActiveToolMode(): EditorToolMode | null {
        if (this.cropSession) return 'crop';
        if (this.mosaicSession) return 'mosaic';
        if (this.textSession) return 'text';
        if (this.drawSession) return 'draw';
        return null;
    }

    private isToolModeActive(): boolean {
        return this.getActiveToolMode() !== null;
    }

    private getEditorState(): ImageEditorState {
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
            isFlippedHorizontally: !!this.originalImage?.flipX,
            isFlippedVertically: !!this.originalImage?.flipY,
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

    private emitImageChanged(context: ImageEditorCallbackContext): void {
        this.emitOptionCallback('onImageChanged', [this.getEditorState(), context]);
    }

    private emitMasksChanged(context: ImageEditorCallbackContext): void {
        this.emitOptionCallback('onMasksChanged', [this.getMasks(), context]);
    }

    private emitAnnotationsChanged(context: ImageEditorCallbackContext): void {
        this.emitOptionCallback('onAnnotationsChanged', [this.getAnnotations(), context]);
    }

    private emitBusyChangeIfChanged(context: ImageEditorCallbackContext): void {
        const isBusy = this.isBusy();
        if (this.lastEmittedIsBusy === isBusy) return;
        this.lastEmittedIsBusy = isBusy;
        this.emitOptionCallback('onBusyChange', [isBusy, context]);
    }

    private buildSelection(selected: FabricNS.FabricObject[]): ImageEditorSelection {
        const selectedMasks = selected.filter(isMaskObject);
        const selectedAnnotations = selected.filter(isAnnotationObject);
        const selectedObjectKind =
            selectedMasks.length === 1 && selectedAnnotations.length === 0
                ? 'mask'
                : selectedAnnotations.length === 1 && selectedMasks.length === 0
                  ? 'annotation'
                  : null;
        return {
            selectedMask: selectedMasks[0] ?? null,
            selectedMasks,
            selectedAnnotation: selectedAnnotations[0] ?? null,
            selectedAnnotations,
            selectedObjectKind,
        };
    }

    private withSelectionChangeContext<T>(
        context: ImageEditorCallbackContext,
        callback: () => T,
    ): T {
        const previous = this.nextSelectionChangeContext;
        this.nextSelectionChangeContext = context;
        try {
            return callback();
        } finally {
            this.nextSelectionChangeContext = previous;
        }
    }

    private isSupportedImageMimeType(mimeType: string | null): mimeType is ImageMimeType {
        return mimeType === 'image/jpeg' || mimeType === 'image/png' || mimeType === 'image/webp';
    }

    private inferCurrentImageMimeType(): ImageMimeType | null {
        const image = this.originalImage as
            | (FabricNS.FabricImage & {
                  getSrc?: () => string;
                  src?: string;
              })
            | null;
        if (!image) return null;
        let source: string | null = null;
        try {
            if (typeof image.getSrc === 'function') source = image.getSrc();
            else if (typeof image.src === 'string') source = image.src;
        } catch {
            source = null;
        }
        const mimeType = source ? detectSourceMimeType(source) : null;
        return this.isSupportedImageMimeType(mimeType) ? mimeType : null;
    }

    /**
     * Atomically resize the Fabric canvas. Routes through
     * {@link applyCanvasDimensions} so the canvas's lower (render) and
     * upper (event) layers stay in sync and the surrounding container is
     * reflowed before the next paint — matching the contract enforced
     * across the rest of the layout pipeline (see
     * `image/layout-manager.ts`).
     */
    private setCanvasSizePx(widthPx: number, heightPx: number): void {
        if (!this.canvas) return;
        applyCanvasDimensions(this.canvas, widthPx, heightPx, this.containerElement);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PRIVATE — geometry helpers
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Re-align an object so its bounding-box top-left maps to the
     * object's `(left, top)` reference. Used by the transform pipeline's
     * `afterTransformSnap` hook to absorb floating-point drift on the
     * final animation tick.
     */
    private alignObjectBoundingBoxToCanvasTopLeft(object: FabricNS.FabricObject): void {
        object.setCoords();
        const boundingRect = object.getBoundingRect(); // v7: always absolute, no params
        object.set({
            left: (object.left ?? 0) - boundingRect.left,
            top: (object.top ?? 0) - boundingRect.top,
        });
        object.setCoords();
        // Flush the final snapped geometry before the transform promise
        // settles; callers may read layout immediately after awaiting it.
        this.canvas?.renderAll();
    }

    private measureLayoutViewport(scrollbarSize?: { width: number; height: number }): ViewportSize {
        return this.viewportCache.measure(
            this.containerElement,
            {
                width: this.options.canvasWidth,
                height: this.options.canvasHeight,
            },
            scrollbarSize,
        );
    }

    private getScrollbarStableViewportCanvasSize(viewport: ViewportSize): ViewportSize {
        return {
            width: Math.max(1, viewport.width - 1),
            height: Math.max(1, viewport.height - 1),
        };
    }

    /**
     * Resize the canvas to fit the transformed image bounds. Used by the
     * transform pipeline's `afterTransformSnap` hook so a post-rotation/scale
     * image that exceeds the viewport gets a real scroll range.
     */
    private updateCanvasSizeToImageBounds(
        options: { stabilizeContainedViewport?: boolean } = {},
    ): void {
        if (!this.originalImage) return;
        this.originalImage.setCoords();
        const boundingRect = this.originalImage.getBoundingRect();

        const scrollbarSize = measureScrollbarSize(this.containerElement?.ownerDocument ?? null);
        const viewport = this.measureLayoutViewport(scrollbarSize);
        const shouldStabilizeContainedViewport = options.stabilizeContainedViewport !== false;
        const imageFitsViewport =
            boundingRect.width <= viewport.width + LAYOUT_EPSILON &&
            boundingRect.height <= viewport.height + LAYOUT_EPSILON;

        if (this.currentLayoutMode === 'fit' || this.currentLayoutMode === 'cover') {
            if (imageFitsViewport) {
                const canvasSize = shouldStabilizeContainedViewport
                    ? this.getScrollbarStableViewportCanvasSize(viewport)
                    : viewport;
                this.setCanvasSizePx(canvasSize.width, canvasSize.height);
                return;
            }

            const canvasSize = computeScrollableCanvasSize(
                boundingRect.width,
                boundingRect.height,
                viewport,
                scrollbarSize,
            );
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

        this.setCanvasSizePx(
            Math.max(viewport.width, Math.ceil(boundingRect.width)),
            Math.max(viewport.height, Math.ceil(boundingRect.height)),
        );
    }

    private shouldNormalizeCanvasSizeAfterStateRestore(): boolean {
        if (!this.canvas || !this.originalImage) return false;

        this.originalImage.setCoords();
        const boundingRect = this.originalImage.getBoundingRect();
        const viewport = this.measureLayoutViewport(
            measureScrollbarSize(this.containerElement?.ownerDocument ?? null),
        );
        const canvasW = Math.ceil(this.canvas.getWidth());
        const canvasH = Math.ceil(this.canvas.getHeight());

        const clipsImage =
            boundingRect.width > canvasW + LAYOUT_EPSILON ||
            boundingRect.height > canvasH + LAYOUT_EPSILON;

        if (this.currentLayoutMode === 'fit' || this.currentLayoutMode === 'cover') {
            const staleOverflowWidth =
                canvasW > viewport.width + LAYOUT_EPSILON &&
                boundingRect.width <= viewport.width + LAYOUT_EPSILON;
            const staleOverflowHeight =
                canvasH > viewport.height + LAYOUT_EPSILON &&
                boundingRect.height <= viewport.height + LAYOUT_EPSILON;

            return clipsImage || staleOverflowWidth || staleOverflowHeight;
        }

        if (this.currentLayoutMode === 'expand') {
            const expectedW = Math.max(viewport.width, Math.ceil(boundingRect.width));
            const expectedH = Math.max(viewport.height, Math.ceil(boundingRect.height));
            return (
                Math.abs(canvasW - expectedW) > LAYOUT_EPSILON ||
                Math.abs(canvasH - expectedH) > LAYOUT_EPSILON
            );
        }

        return clipsImage;
    }

    private settleFitCoverScrollbarsAfterStateRestore(): void {
        if (
            !this.canvas ||
            !this.containerElement ||
            (this.currentLayoutMode !== 'fit' && this.currentLayoutMode !== 'cover')
        ) {
            return;
        }

        const canvasW = Math.ceil(this.canvas.getWidth());
        const canvasH = Math.ceil(this.canvas.getHeight());
        if (canvasW <= 1 || canvasH <= 1) return;

        const clientW = Math.floor(this.containerElement.clientWidth || 0);
        const clientH = Math.floor(this.containerElement.clientHeight || 0);
        if (clientW <= 0 || clientH <= 0) return;

        const scrollW = Math.ceil(this.containerElement.scrollWidth || 0);
        const scrollH = Math.ceil(this.containerElement.scrollHeight || 0);
        const hasHorizontalScrollbar = scrollW > clientW + LAYOUT_EPSILON;
        const hasVerticalScrollbar = scrollH > clientH + LAYOUT_EPSILON;
        if (!hasHorizontalScrollbar && !hasVerticalScrollbar) return;

        const nudgeWidth =
            hasVerticalScrollbar && Math.abs(canvasW - clientW) <= SCROLLBAR_SETTLE_EPSILON;
        const nudgeHeight =
            hasHorizontalScrollbar && Math.abs(canvasH - clientH) <= SCROLLBAR_SETTLE_EPSILON;
        if (!nudgeWidth && !nudgeHeight) return;

        this.setCanvasSizePx(
            nudgeWidth ? canvasW - 1 : canvasW,
            nudgeHeight ? canvasH - 1 : canvasH,
        );
        this.setCanvasSizePx(canvasW, canvasH);
    }

    private captureImageDisplayGeometry(): ImageDisplayGeometry | null {
        if (!this.canvas || !this.originalImage) return null;
        this.originalImage.setCoords();
        const boundingRect = this.originalImage.getBoundingRect();
        return {
            canvasWidth: this.canvas.getWidth(),
            canvasHeight: this.canvas.getHeight(),
            imageDisplayWidth: Math.max(1, boundingRect.width),
            imageDisplayHeight: Math.max(1, boundingRect.height),
        };
    }

    private restoreMergedImageDisplayGeometry(geometry: ImageDisplayGeometry | null): void {
        if (!geometry || !this.canvas || !this.originalImage) return;

        this.setCanvasSizePx(geometry.canvasWidth, geometry.canvasHeight);

        const sourceW = Math.max(1, this.originalImage.width || geometry.imageDisplayWidth);
        const sourceH = Math.max(1, this.originalImage.height || geometry.imageDisplayHeight);
        const scale = Math.min(
            geometry.imageDisplayWidth / sourceW,
            geometry.imageDisplayHeight / sourceH,
        );

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

    // ═══════════════════════════════════════════════════════════════════════
    // PRIVATE — transform controller wiring
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Build the {@link TransformContext} the controller reads/writes
     * through. The facade is the single owner of `currentScale`,
     * `currentRotation`, `baseImageScale`, `shouldSuppressSaveState`, and
     * the {@link OperationGuard}, so the context's accessors all bind
     * back to `this` rather than duplicating state.
     *
     * The `saveCanvasState` callback delegates to {@link saveState},
     * which already honors `shouldSuppressSaveState`. That lets
     * {@link resetImageTransform} reuse the public scale and rotate paths
     * while suppressing intermediate saves and emitting one final history
     * entry.
     *
     * The `afterTransformSnap` hook re-runs the post-animation UI helpers:
     * expand-to-image canvas sizing, bounding-box re-alignment, and mask
     * label sync.
     *
     */
    private buildTransformContext(): TransformContext {
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
                if (this.isDisposed || !this.canvas || !this.originalImage) return;
                this.updateCanvasSizeToImageBounds();
                this.alignObjectBoundingBoxToCanvasTopLeft(this.originalImage);
                this.canvas
                    .getObjects()
                    .filter(isMaskObject)
                    .forEach((maskObject) => this.syncMaskLabel(maskObject));
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
     * @returns A promise that resolves when the animation finishes.
     */
    scaleImage(factor: number): Promise<void> {
        if (this.isDisposed || !this.transformController) return Promise.resolve();
        if (!Number.isFinite(factor)) return Promise.resolve();
        try {
            this.assertCanQueueAnimation('scaleImage');
        } catch (error) {
            return Promise.reject(error);
        }
        const controller = this.transformController;
        const context = this.buildCallbackContext('scaleImage', false);
        const job = this.animQueue.add(async () => {
            if (this.isDisposed) return;
            // Disable buttons up front so the toolbar reflects the
            // pending animation while it runs.
            this.updateUi();
            try {
                await controller.scaleImage(factor);
                if (!this.isDisposed) this.emitImageChanged(context);
            } finally {
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

    /**
     * Animates the image to the given rotation angle.
     *
     * Routed through the {@link animQueue}.
     * Non-finite input is a documented no-op; the controller
     * short-circuits without modifying canvas state.
     *
     * @param degrees - Target rotation angle in degrees.
     * @returns A promise that resolves when the animation finishes.
     */
    rotateImage(degrees: number): Promise<void> {
        if (this.isDisposed || !this.transformController) return Promise.resolve();
        if (!Number.isFinite(degrees)) return Promise.resolve();
        try {
            this.assertCanQueueAnimation('rotateImage');
        } catch (error) {
            return Promise.reject(error);
        }
        const controller = this.transformController;
        const context = this.buildCallbackContext('rotateImage', false);
        const job = this.animQueue.add(async () => {
            if (this.isDisposed) return;
            this.updateUi();
            try {
                await controller.rotateImage(degrees);
                if (!this.isDisposed) this.emitImageChanged(context);
            } finally {
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

    flipHorizontal(): Promise<void> {
        if (this.isDisposed || !this.transformController) return Promise.resolve();
        try {
            this.assertCanQueueAnimation('flipHorizontal');
        } catch (error) {
            return Promise.reject(error);
        }
        const controller = this.transformController;
        const context = this.buildCallbackContext('flipHorizontal', false);
        const job = this.animQueue.add(async () => {
            if (this.isDisposed) return;
            this.updateUi();
            try {
                await controller.flipHorizontal();
                if (!this.isDisposed) this.emitImageChanged(context);
            } finally {
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

    flipVertical(): Promise<void> {
        if (this.isDisposed || !this.transformController) return Promise.resolve();
        try {
            this.assertCanQueueAnimation('flipVertical');
        } catch (error) {
            return Promise.reject(error);
        }
        const controller = this.transformController;
        const context = this.buildCallbackContext('flipVertical', false);
        const job = this.animQueue.add(async () => {
            if (this.isDisposed) return;
            this.updateUi();
            try {
                await controller.flipVertical();
                if (!this.isDisposed) this.emitImageChanged(context);
            } finally {
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

    /**
     * Resets the image to scale `1`, rotation `0`, and unflipped state and
     * records exactly one history entry covering the entire reset.
     *
     * Routed through the {@link animQueue} so the chained
     * `scaleImage(1)` and `rotateImage(0)` sub-animations are serialized
     * with any other queued transform. The
     * controller toggles `shouldSuppressSaveState` around the chain so the
     * inner per-operation `saveState` calls collapse into a single
     * post-reset save.
     *
     * @returns A promise that resolves when both sub-animations have
     *          settled and the single history entry has been recorded.
     */
    resetImageTransform(): Promise<void> {
        if (this.isDisposed || !this.transformController) return Promise.resolve();
        try {
            this.assertCanQueueAnimation('resetImageTransform');
        } catch (error) {
            return Promise.reject(error);
        }
        const controller = this.transformController;
        const context = this.buildCallbackContext('resetImageTransform', false);
        const job = this.animQueue.add(async () => {
            if (this.isDisposed) return;
            this.updateUi();
            try {
                await controller.resetImageTransform();
                if (!this.isDisposed) this.emitImageChanged(context);
            } finally {
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

    private refreshUiAfterQueuedAnimation(): void {
        if (this.isDisposed || !this.canvas) return;
        this.updateInputs();
        this.updateUi();
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
     * @param jsonString - JSON string returned by `saveState` (or parsed object).
     */
    async loadFromState(jsonString: string | CanvasJson): Promise<void> {
        return this.loadFromStateInternal(jsonString);
    }

    private async loadFromStateInternal(
        jsonString: string | CanvasJson,
        options?: InternalOperationOptions | null,
    ): Promise<void> {
        if (!jsonString || !this.canvas) return;
        // After-dispose calls resolve as a no-op so a queued undo/redo
        // entry that fires post-dispose does not touch the canvas.
        if (this.isDisposed) return;
        if (!this.canRunIdleOperation('loadFromState', options)) return;
        const activeRestoreOperation = this.activeStateRestoreOperation;
        const context = this.buildCallbackContext(
            activeRestoreOperation ?? 'loadFromState',
            activeRestoreOperation === 'undo' || activeRestoreOperation === 'redo',
        );
        const previousImage = this.originalImage;
        const previousMaskSignature = this.getMaskCollectionSignature();
        const previousAnnotationSignature = this.getAnnotationCollectionSignature();

        try {
            const restoredState = await loadFromStateImpl({
                canvas: this.canvas,
                jsonString,
                setCanvasSize: (widthPx, heightPx) => this.setCanvasSizePx(widthPx, heightPx),
            });

            // Defend against dispose racing with the awaited
            // `loadFromJSON`: the canvas may have been torn down between
            // the call and the resolution.
            if (this.isDisposed || !this.canvas) return;

            // Drop any lingering label texts the snapshot did not filter.
            // The serializer's snapshot already excludes labels, but a
            // hand-built or older payload may include them.
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
                        ? (editorState.currentImageMimeType ?? null)
                        : this.inferCurrentImageMimeType();
            } else {
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

            // Re-attach mouseover/mouseout hover handlers (Fabric never
            // serializes event listeners).
            const restoredMasks = restoredState.masks;
            this.lastMask = restoredMasks.reduce<MaskObject | null>(
                (lastMask, maskObject) =>
                    !lastMask || maskObject.maskId > lastMask.maskId ? maskObject : lastMask,
                null,
            );
            restoredMasks.forEach((maskObject) => {
                applyMaskUnselectedStyle(maskObject);
                reattachMaskHoverHandlers(maskObject);
            });
            syncAnnotationRuntimeStates(restoredState.annotations);
            attachTextEditingHandlersToAnnotations(
                this.buildTextControllerContext(),
                restoredState.annotations,
            );

            // Update lastSnapshot so the NEXT saveState correctly
            // uses the restored and layout-normalized state as its
            // "before" baseline.
            this.lastSnapshot = this.captureSnapshotInternal();

            // Undo/redo callers await this method and should settle after
            // Fabric has painted the restored state.
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
            const activeMaskId = editorState?.activeMaskId;
            const activeAnnotationId = editorState?.activeAnnotationId;
            if (editorState?.activeObjectKind === 'mask' && typeof activeMaskId === 'number') {
                const activeMask = restoredMasks.find(
                    (maskObject) => maskObject.maskId === activeMaskId,
                );
                if (activeMask) {
                    this.withSelectionChangeContext(context, () => {
                        canvas.setActiveObject(activeMask);
                        this.handleSelectionChanged([activeMask]);
                    });
                }
            } else if (
                editorState?.activeObjectKind === 'annotation' &&
                typeof activeAnnotationId === 'number'
            ) {
                const activeAnnotation = restoredState.annotations.find(
                    (annotation) => annotation.annotationId === activeAnnotationId,
                );
                if (activeAnnotation) {
                    this.withSelectionChangeContext(context, () => {
                        canvas.setActiveObject(activeAnnotation);
                        this.handleSelectionChanged([activeAnnotation]);
                    });
                }
            }
        } catch (error) {
            reportError(this.options, error, 'Failed to restore canvas state.');
            // Propagate so `Command.undo`/`Command.execute` reject and
            // `HistoryManager` leaves `currentIndex` untouched on a
            // failed restore.
            throw error;
        }
    }

    /**
     * Captures the current canvas state into the undo/redo history.
     * Called automatically after transforms, mask operations, and crop.
     */
    saveState(): void {
        this.saveStateInternal();
    }

    private saveStateInternal(options?: InternalOperationOptions | null): void {
        if (!this.canvas || this.shouldSuppressSaveState) return;
        if (!this.canRunIdleOperation('saveState', options)) return;
        const activeObj = this.canvas.getActiveObject();
        const activeMask = this.getActiveMaskForSnapshot();
        const activeAnnotation = this.getActiveAnnotationForSnapshot();
        this.hideAllMaskLabels();

        try {
            const after = saveStateImpl({
                canvas: this.canvas,
                activeMaskId: activeMask?.maskId ?? null,
                activeAnnotationId: activeAnnotation?.annotationId ?? null,
                currentScale: this.currentScale,
                currentRotation: this.currentRotation,
                baseImageScale: this.baseImageScale,
                currentImageMimeType: this.currentImageMimeType,
            });
            const before = this.lastSnapshot ?? after;
            if (after === before) {
                return;
            }

            const cmd = new Command(
                async () => {
                    await this.loadFromStateInternal(after, this.withAnimationQueueBypass());
                },
                async () => {
                    await this.loadFromStateInternal(before, this.withAnimationQueueBypass());
                },
            );

            this.historyManager.push(cmd);
            this.lastSnapshot = after;
        } catch (error) {
            reportWarning(this.options, error, 'Failed to capture canvas snapshot.');
        } finally {
            this.restoreActiveObjectAfterSnapshot(activeObj, activeMask, activeAnnotation);
            this.updateUi();
        }
    }

    private restoreActiveObjectAfterSnapshot(
        activeObj: FabricNS.FabricObject | null | undefined,
        activeMask: MaskObject | null,
        activeAnnotation: AnnotationObject | null,
    ): void {
        if (!this.canvas) return;
        const maskToRestore = activeObj && isMaskObject(activeObj) ? activeObj : activeMask;
        const annotationToRestore =
            activeObj && isAnnotationObject(activeObj) ? activeObj : activeAnnotation;
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

    /**
     * Undoes the last recorded action.
     *
     * Routed through {@link animQueue} so that undo is serialized with any
     * in-progress animation and rapid clicks cannot interleave canvas restores.
     * The {@link HistoryManager.isProcessing} lock provides a second line of
     * defence inside the history layer itself.
     *
     * After {@link dispose} the call resolves without touching the canvas.
     * The early return covers the case where dispose has already happened;
     * the inner check covers the case where dispose happens while waiting
     * in the animation queue.
     */
    undo(): Promise<void> {
        if (this.isDisposed) return Promise.resolve();
        if (!this.canRunIdleOperation('undo')) return Promise.resolve();
        this.finalizeActiveTextEditingIfNeeded();
        const context = this.buildCallbackContext('undo', true);
        const job = this.animQueue.add(async () => {
            if (this.isDisposed) return;
            this.activeStateRestoreOperation = 'undo';
            try {
                await this.historyManager.undo();
            } finally {
                this.activeStateRestoreOperation = null;
            }
        });
        this.emitBusyChangeIfChanged(context);
        return job.finally(() => {
            this.refreshUiAfterQueuedAnimation();
            this.emitBusyChangeIfChanged(context);
        });
    }

    /**
     * Redoes the next recorded action.
     *
     * Same serialization and dispose guarantees as {@link undo}.
     */
    redo(): Promise<void> {
        if (this.isDisposed) return Promise.resolve();
        if (!this.canRunIdleOperation('redo')) return Promise.resolve();
        this.finalizeActiveTextEditingIfNeeded();
        const context = this.buildCallbackContext('redo', true);
        const job = this.animQueue.add(async () => {
            if (this.isDisposed) return;
            this.activeStateRestoreOperation = 'redo';
            try {
                await this.historyManager.redo();
            } finally {
                this.activeStateRestoreOperation = null;
            }
        });
        this.emitBusyChangeIfChanged(context);
        return job.finally(() => {
            this.refreshUiAfterQueuedAnimation();
            this.emitBusyChangeIfChanged(context);
        });
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
     * `saveState` → `config.onCreate(mask, canvas)`.
     *
     * @param config - Shape type, dimensions, position, style, and callbacks.
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
        if (!this.canRunIdleOperation('createMask')) return null;
        const callbackContext = this.buildCallbackContext('createMask', false);
        const createMaskContext = this.buildCreateMaskContext();
        const mask = this.withSelectionChangeContext(callbackContext, () =>
            createMaskImpl(createMaskContext, config),
        );
        if (mask) {
            this.emitMasksChanged(callbackContext);
            this.emitImageChanged(callbackContext);
        }
        return mask;
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
        if (!this.canRunIdleOperation('removeSelectedMask')) return;
        const before = this.getMasks().length;
        const callbackContext = this.buildCallbackContext('removeSelectedMask', false);
        const removeMaskContext = this.buildRemoveMaskContext();
        this.withSelectionChangeContext(callbackContext, () =>
            removeSelectedMaskImpl(removeMaskContext),
        );
        this.updateUi();
        if (this.getMasks().length !== before) {
            this.emitMasksChanged(callbackContext);
            this.emitImageChanged(callbackContext);
        }
    }

    /**
     * Removes all masks and their labels.
     *
     * Delegates to {@link removeAllMasks} in `mask/mask-factory.ts`,
     * which removes every mask and label in canvas order, clears the
     * `lastMask` reference, re-renders the mask list
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
        if (!this.canRunIdleOperation('removeAllMasks', options)) return;
        const before = this.getMasks().length;
        const callbackContext = this.buildCallbackContext('removeAllMasks', false);
        const removeMaskContext = this.buildRemoveMaskContext();
        this.withSelectionChangeContext(callbackContext, () =>
            removeAllMasksImpl(removeMaskContext, options),
        );
        this.updateUi();
        if (this.getMasks().length !== before) {
            this.emitMasksChanged(callbackContext);
            this.emitImageChanged(callbackContext);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PRIVATE — mask context builders
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Build the {@link CreateMaskContext} the mask factory reads/writes
     * through. The facade is the single owner of `maskCounter`,
     * `lastMask`, the canvas, and `saveState`, so the context's
     * accessors all bind back to `this` rather than duplicating state.
     */
    private buildCreateMaskContext(): CreateMaskContext {
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

    /**
     * Build the {@link RemoveMaskContext} the mask factory reads/writes
     * through for `removeSelectedMask` / `removeAllMasks`. The facade
     * is the single owner of the canvas, mask label DOM, mask list
     * DOM, history, and `lastMask`, so the context's accessors bind
     * back to `this`.
     */
    private buildRemoveMaskContext(): RemoveMaskContext {
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

    // ═══════════════════════════════════════════════════════════════════════
    // PRIVATE — mask label helpers
    // ═══════════════════════════════════════════════════════════════════════

    private buildMaskLabelContext(): MaskLabelManagerContext | null {
        if (!this.canvas) return null;
        return { fabric: this.fabricModule, canvas: this.canvas, options: this.options };
    }

    private removeLabelForMask(mask: MaskObject): void {
        const context = this.buildMaskLabelContext();
        if (!context) return;
        removeLabelForMask(context, mask);
    }

    private createLabelForMask(mask: MaskObject): void {
        const context = this.buildMaskLabelContext();
        if (!context) return;
        createLabelForMask(context, mask);
    }

    private hideAllMaskLabels(): void {
        const context = this.buildMaskLabelContext();
        if (!context) return;
        hideAllMaskLabels(context);
    }

    private syncMaskLabel(mask: MaskObject): void {
        const context = this.buildMaskLabelContext();
        if (!context) return;
        syncMaskLabel(context, mask);
    }

    private showLabelForMask(mask: MaskObject): void {
        const context = this.buildMaskLabelContext();
        if (!context) return;
        showLabelForMask(context, mask);
    }

    private handleObjectMovingScalingRotating(target: FabricNS.FabricObject): void {
        if (isMaskObject(target)) {
            this.syncMaskLabel(target);
        }
    }

    private handleObjectModified(target: FabricNS.FabricObject): void {
        if (isMaskObject(target)) {
            this.syncMaskLabel(target);
            const context = this.buildCallbackContext('saveState', false);
            this.saveState();
            this.emitMasksChanged(context);
            this.emitImageChanged(context);
            return;
        }
        if (isAnnotationObject(target)) {
            if (isAnnotationLocked(target)) return;
            const context = this.buildCallbackContext('updateAnnotation', false);
            this.saveState();
            this.emitAnnotationsChanged(context);
            this.emitImageChanged(context);
        }
    }

    private handleSelectionChanged(selected: FabricNS.FabricObject[]): void {
        if (!this.canvas) return;
        const selectedMask = selected.find(isMaskObject) ?? null;
        const selectedAnnotation = selected.find(isAnnotationObject) ?? null;
        const masks = this.canvas.getObjects().filter(isMaskObject);

        masks.forEach((maskObject) => {
            if (maskObject !== selectedMask) {
                if (maskObject.labelObject) {
                    this.removeLabelForMask(maskObject);
                }
                applyMaskUnselectedStyle(maskObject);
            } else {
                applyMaskSelectedStyle(maskObject);
            }
        });

        if (selectedMask) this.showLabelForMask(selectedMask);
        this.updateMaskListSelection(selectedMask);
        this.updateAnnotationListSelection(selectedAnnotation);
        this.canvas.requestRenderAll();
        this.updateUi();
        const context =
            this.nextSelectionChangeContext ??
            this.buildCallbackContext(
                (this.activeStateRestoreOperation as ImageEditorOperation | null) ?? 'createMask',
                this.activeStateRestoreOperation === 'undo' ||
                    this.activeStateRestoreOperation === 'redo',
            );
        this.emitOptionCallback('onSelectionChange', [this.buildSelection(selected), context]);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PRIVATE — mask list DOM
    // ═══════════════════════════════════════════════════════════════════════

    private buildMaskListContext(): MaskListContext {
        return {
            canvas: this.canvas,
            getListElementId: () => this.elements.maskList,
            onMaskSelected: (mask) => this.handleSelectionChanged([mask]),
        };
    }

    private updateMaskList(): void {
        renderMaskList(this.buildMaskListContext());
    }

    private updateMaskListSelection(selectedMask: MaskObject | null): void {
        updateMaskListSelection(this.buildMaskListContext(), selectedMask);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PUBLIC — annotations
    // ═══════════════════════════════════════════════════════════════════════

    enterTextMode(): void {
        if (!this.canvas) return;
        if (!this.canRunIdleOperation('enterTextMode')) return;
        if (this.isToolModeActive()) return;
        enterTextModeImpl(this.buildTextControllerContext());
        const callbackContext = this.buildCallbackContext('enterTextMode', false);
        this.emitBusyChangeIfChanged(callbackContext);
        this.emitImageChanged(callbackContext);
    }

    exitTextMode(): void {
        if (!this.canvas || !this.textSession) return;
        if (!this.canRunIdleOperation('exitTextMode')) return;
        exitTextModeImpl(this.buildTextControllerContext());
        const callbackContext = this.buildCallbackContext('exitTextMode', false);
        this.emitBusyChangeIfChanged(callbackContext);
        this.emitImageChanged(callbackContext);
    }

    isTextMode(): boolean {
        return this.textSession !== null;
    }

    createTextAnnotation(config: TextAnnotationConfig = {}): TextAnnotationObject | null {
        if (!this.canvas) return null;
        if (!this.canRunIdleOperation('createTextAnnotation')) return null;
        return createTextAnnotationImpl(this.buildTextControllerContext(), config);
    }

    enterDrawMode(): void {
        if (!this.canvas) return;
        if (!this.canRunIdleOperation('enterDrawMode')) return;
        if (this.isToolModeActive()) return;
        enterDrawModeImpl(this.buildDrawControllerContext());
        const callbackContext = this.buildCallbackContext('enterDrawMode', false);
        this.emitBusyChangeIfChanged(callbackContext);
        this.emitImageChanged(callbackContext);
    }

    exitDrawMode(): void {
        if (!this.canvas || !this.drawSession) return;
        if (!this.canRunIdleOperation('exitDrawMode')) return;
        exitDrawModeImpl(this.buildDrawControllerContext());
        const callbackContext = this.buildCallbackContext('exitDrawMode', false);
        this.emitBusyChangeIfChanged(callbackContext);
        this.emitImageChanged(callbackContext);
    }

    isDrawMode(): boolean {
        return this.drawSession !== null;
    }

    getTextConfig(): Readonly<ResolvedTextAnnotationConfig> {
        return cloneResolvedTextAnnotationConfig(this.currentTextConfig);
    }

    setTextConfig(config: TextAnnotationConfig): void {
        this.applyTextConfigPatch(config, 'setTextConfig');
    }

    resetTextConfig(): void {
        this.applyTextConfigPatch(this.defaultTextConfig, 'resetTextConfig');
    }

    setTextColor(color: string): void {
        this.applyTextConfigPatch({ fill: color }, 'setTextColor');
    }

    setTextFontSize(size: number): void {
        this.applyTextConfigPatch({ fontSize: size }, 'setTextFontSize');
    }

    getDrawConfig(): Readonly<ResolvedDrawConfig> {
        return cloneResolvedDrawConfig(this.currentDrawConfig);
    }

    setDrawConfig(config: DrawConfig): void {
        this.applyDrawConfigPatch(config, 'setDrawConfig');
    }

    resetDrawConfig(): void {
        this.applyDrawConfigPatch(this.defaultDrawConfig, 'resetDrawConfig');
    }

    setDrawColor(color: string): void {
        this.applyDrawConfigPatch({ color }, 'setDrawColor');
    }

    setDrawBrushSize(size: number): void {
        this.applyDrawConfigPatch({ brushSize: size }, 'setDrawBrushSize');
    }

    removeSelectedAnnotation(): void {
        if (!this.canvas) return;
        if (!this.canRunIdleOperation('removeSelectedAnnotation')) return;
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

    removeAllAnnotations(options: RemoveAllAnnotationsOptions = {}): void {
        if (!this.canvas) return;
        if (!this.canRunIdleOperation('removeAllAnnotations', options)) return;
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

    updateAnnotation(annotationId: number, config: AnnotationUpdateConfig): void {
        if (!this.canvas) return;
        if (!this.canRunIdleOperation('updateAnnotation')) return;
        const callbackContext = this.buildCallbackContext('updateAnnotation', false);
        const changed = updateAnnotationImpl(
            this.buildAnnotationManagerContext(),
            annotationId,
            config,
        );
        if (changed) {
            this.updateAnnotationList();
            this.emitAnnotationsChanged(callbackContext);
            this.emitImageChanged(callbackContext);
        }
    }

    updateSelectedAnnotation(config: AnnotationUpdateConfig): void {
        if (!this.canvas) return;
        if (!this.canRunIdleOperation('updateSelectedAnnotation')) return;
        const callbackContext = this.buildCallbackContext('updateSelectedAnnotation', false);
        const changed = updateSelectedAnnotationImpl(this.buildAnnotationManagerContext(), config);
        if (changed) {
            this.updateAnnotationList();
            this.emitAnnotationsChanged(callbackContext);
            this.emitImageChanged(callbackContext);
        }
    }

    deleteSelectedObject(): void {
        if (!this.canvas) return;
        if (!this.canRunIdleOperation('deleteSelectedObject')) return;
        this.finalizeActiveTextEditingIfNeeded();
        const selectedObjects = this.getSelectedCanvasObjects();
        const selectedMasks = selectedObjects.filter(isMaskObject);
        const selectedAnnotations = selectedObjects.filter(
            (object): object is AnnotationObject =>
                isAnnotationObject(object) && isAnnotationUnlocked(object),
        );
        if (selectedMasks.length === 0 && selectedAnnotations.length === 0) return;
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
        if (selectedMasks.length > 0) this.emitMasksChanged(callbackContext);
        if (selectedAnnotations.length > 0) this.emitAnnotationsChanged(callbackContext);
        this.emitImageChanged(callbackContext);
    }

    bringSelectedObjectForward(): void {
        this.moveSelectedEditableObject('bringSelectedObjectForward');
    }

    sendSelectedObjectBackward(): void {
        this.moveSelectedEditableObject('sendSelectedObjectBackward');
    }

    bringSelectedObjectToFront(): void {
        this.moveSelectedEditableObject('bringSelectedObjectToFront');
    }

    sendSelectedObjectToBack(): void {
        this.moveSelectedEditableObject('sendSelectedObjectToBack');
    }

    private buildAnnotationManagerContext(): AnnotationManagerContext {
        return {
            canvas: this.getLiveCanvasOrThrow('annotationManager'),
            saveCanvasState: () => this.saveState(),
            updateUi: () => this.updateUi(),
        };
    }

    private buildAnnotationListContext(): AnnotationListContext {
        return {
            canvas: this.canvas,
            getListElementId: () => this.elements.annotationList,
            onAnnotationSelected: (annotation) => this.handleSelectionChanged([annotation]),
        };
    }

    private updateAnnotationList(): void {
        renderAnnotationList(this.buildAnnotationListContext());
    }

    private updateAnnotationListSelection(selectedAnnotation: AnnotationObject | null): void {
        updateAnnotationListSelection(this.buildAnnotationListContext(), selectedAnnotation);
    }

    private buildTextControllerContext(): TextControllerContext {
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

    private buildDrawControllerContext(): DrawControllerContext {
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

    private applyTextConfigPatch(
        config: TextAnnotationConfig,
        operation: ImageEditorOperation,
    ): void {
        if (!this.canRunIdleOperation(operation)) return;
        const invalidFields = getInvalidTextAnnotationConfigFields(config);
        if (invalidFields.length > 0) {
            reportWarning(
                this.options,
                null,
                `${operation} ignored invalid Text config fields: ${invalidFields.join(', ')}.`,
            );
        }
        const next = mergeTextAnnotationConfigPatch(
            this.currentTextConfig,
            config,
            this.defaultTextConfig,
        );
        if (areResolvedTextAnnotationConfigsEqual(this.currentTextConfig, next)) return;
        this.currentTextConfig = next;
        this.updateInputs();
        this.updateUi();
        this.emitImageChanged(this.buildCallbackContext(operation, false));
    }

    private applyDrawConfigPatch(config: DrawConfig, operation: ImageEditorOperation): void {
        if (!this.canRunIdleOperation(operation)) return;
        const invalidFields = getInvalidDrawConfigFields(config);
        if (invalidFields.length > 0) {
            reportWarning(
                this.options,
                null,
                `${operation} ignored invalid Draw config fields: ${invalidFields.join(', ')}.`,
            );
        }
        const next = mergeDrawConfigPatch(this.currentDrawConfig, config, this.defaultDrawConfig);
        if (areResolvedDrawConfigsEqual(this.currentDrawConfig, next)) return;
        this.currentDrawConfig = next;
        updateDrawBrush(this.buildDrawControllerContext());
        this.updateInputs();
        this.updateUi();
        this.emitImageChanged(this.buildCallbackContext(operation, false));
    }

    private applyTextColorInput(color: string): void {
        if (this.isTextMode()) {
            this.setTextColor(color);
            return;
        }
        const selected = this.canvas?.getActiveObject();
        if (selected && isTextAnnotationObject(selected)) {
            this.updateSelectedAnnotation({ fill: color });
            return;
        }
        this.setTextColor(color);
    }

    private applyTextFontSizeInput(size: number): void {
        if (this.isTextMode()) {
            this.setTextFontSize(size);
            return;
        }
        const selected = this.canvas?.getActiveObject();
        if (selected && isTextAnnotationObject(selected)) {
            this.updateSelectedAnnotation({ fontSize: size });
            return;
        }
        this.setTextFontSize(size);
    }

    private applyDrawColorInput(color: string): void {
        if (this.isDrawMode()) {
            this.setDrawColor(color);
            return;
        }
        const selected = this.canvas?.getActiveObject();
        if (selected && isDrawAnnotationObject(selected)) {
            this.updateSelectedAnnotation({ stroke: color });
            return;
        }
        this.setDrawColor(color);
    }

    private applyDrawBrushSizeInput(size: number): void {
        if (this.isDrawMode()) {
            this.setDrawBrushSize(size);
            return;
        }
        const selected = this.canvas?.getActiveObject();
        if (selected && isDrawAnnotationObject(selected)) {
            this.updateSelectedAnnotation({ strokeWidth: size });
            return;
        }
        this.setDrawBrushSize(size);
    }

    private getSelectedCanvasObjects(): FabricNS.FabricObject[] {
        if (!this.canvas) return [];
        const activeObject = this.canvas.getActiveObject();
        if (!activeObject) return [];
        const type = typeof activeObject.type === 'string' ? activeObject.type.toLowerCase() : '';
        const isActiveSelection =
            type === 'activeselection' ||
            ((activeObject as { isType?: (...types: string[]) => boolean }).isType?.(
                'ActiveSelection',
            ) ??
                false);
        if (!isActiveSelection) return [activeObject];
        const getObjects = (activeObject as { getObjects?: () => FabricNS.FabricObject[] })
            .getObjects;
        return typeof getObjects === 'function' ? getObjects.call(activeObject) : [];
    }

    private moveSelectedEditableObject(operation: ImageEditorOperation): void {
        if (!this.canvas) return;
        if (!this.canRunIdleOperation(operation)) return;
        const selected = this.getSelectedCanvasObjects().filter(isEditableOverlayObject);
        if (selected.length !== 1) {
            if (selected.length > 1) {
                reportWarning(
                    this.options,
                    null,
                    `${operation} skipped: ActiveSelection layer moves are not supported.`,
                );
            }
            return;
        }
        const object = selected[0]!;
        const range = getEditableOverlayRange(this.canvas);
        const overlays = range.overlays;
        const currentOverlayIndex = overlays.indexOf(object);
        if (currentOverlayIndex < 0) return;
        let nextOverlayIndex = currentOverlayIndex;
        if (operation === 'bringSelectedObjectForward') {
            nextOverlayIndex = Math.min(overlays.length - 1, currentOverlayIndex + 1);
        } else if (operation === 'sendSelectedObjectBackward') {
            nextOverlayIndex = Math.max(0, currentOverlayIndex - 1);
        } else if (operation === 'bringSelectedObjectToFront') {
            nextOverlayIndex = overlays.length - 1;
        } else if (operation === 'sendSelectedObjectToBack') {
            nextOverlayIndex = 0;
        }
        if (nextOverlayIndex === currentOverlayIndex) return;
        const reordered = overlays.slice();
        reordered.splice(currentOverlayIndex, 1);
        reordered.splice(nextOverlayIndex, 0, object);
        reordered.forEach((overlay, index) => {
            (
                this.canvas as FabricNS.Canvas & {
                    moveObjectTo?: (target: FabricNS.FabricObject, index: number) => boolean;
                }
            ).moveObjectTo?.(overlay, range.start + index);
        });
        normalizeLayerOrder(this.canvas);
        this.canvas.setActiveObject(object);
        this.canvas.renderAll();
        this.saveState();
        this.updateMaskList();
        this.updateAnnotationList();
        this.updateUi();
        const context = this.buildCallbackContext(operation, false);
        if (isMaskObject(object)) this.emitMasksChanged(context);
        if (isAnnotationObject(object)) this.emitAnnotationsChanged(context);
        this.emitImageChanged(context);
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
     * @returns A promise that resolves when the merge is complete.
     */
    async mergeMasks(): Promise<void> {
        if (!this.canvas) return;
        if (!this.canRunIdleOperation('mergeMasks')) return;
        this.finalizeActiveTextEditingIfNeeded();
        const hasMasks = this.canvas.getObjects().some(isMaskObject);
        if (!hasMasks) return;
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
        } finally {
            this.operationGuard.endBusyOperation(operationToken);
            this.emitBusyChangeIfChanged(callbackContext);
            this.updateUi();
        }
    }

    /**
     * Triggers a browser download of the current canvas.
     *
     * Operation guard: while `isAnimating === true`
     * the call is a no-op (no DOM action, no download triggered).
     *
     * Delegates to {@link downloadImage} in `export/export-service.ts`,
     * which renders through the shared export core and triggers an
     * object-URL-backed anchor download.
     *
     * @param options - Export and download options.
     */
    async downloadImage(options?: ImageExportOptions): Promise<void> {
        if (!this.canvas) return;
        // guarded operation. Silent DOM-no-op shape
        // so a queued scale/rotate animation does not get its export
        // pipeline run concurrently.
        if (!this.canRunIdleOperation('downloadImage')) return;
        this.finalizeActiveTextEditingIfNeeded();
        const callbackContext = this.buildCallbackContext('downloadImage', false);
        const operationToken = this.operationGuard.beginBusyOperation('downloadImage');
        this.emitBusyChangeIfChanged(callbackContext);
        const exportContext = this.buildExportServiceContext();
        try {
            await downloadImageImpl(exportContext, options);
        } finally {
            this.operationGuard.endBusyOperation(operationToken);
            this.emitBusyChangeIfChanged(callbackContext);
        }
    }

    /**
     * Exports the canvas as a Base64-encoded data URL.
     *
     * Delegates to {@link exportImageBase64} in `export/export-service.ts`,
     * which discards any active selection, runs the bake-in/restore
     * bracket for image-area exports, and emits a single
     * `canvas.toDataURL` call with the floored image-bounding-box region
     * after temporarily baking masks into the export when requested.
     *
     * Operation guard: while `isAnimating === true`
     * the call resolves to an empty string so an in-flight scale/rotate
     * animation does not see a mid-frame export of the canvas.
     *
     * @param options - Export options.
     * @returns A promise resolving to a data URL on success, or `''` when
     *          no image is loaded.
     */
    async exportImageBase64(options?: ImageExportOptions): Promise<string> {
        if (!this.canvas) return '';
        // Guarded operation: the canvas, mask styles, and active-object
        // selection are left untouched while an animation is in flight.
        if (!this.canRunIdleOperation('exportImageBase64', options)) return '';
        this.finalizeActiveTextEditingIfNeeded();
        const callbackContext = this.buildCallbackContext('exportImageBase64', false);
        const operationToken = this.operationGuard.beginBusyOperation('exportImageBase64');
        this.emitBusyChangeIfChanged(callbackContext);
        const exportContext = this.buildExportServiceContext();
        try {
            return await exportImageBase64Impl(exportContext, options);
        } finally {
            this.operationGuard.endBusyOperation(operationToken);
            this.emitBusyChangeIfChanged(callbackContext);
        }
    }

    /**
     * Exports the canvas as a browser `File` object.
     *
     * Delegates to {@link exportImageFile} in `export/export-service.ts`,
     * which reuses the base64 pipeline, repaints through an offscreen
     * canvas only when the resulting MIME type does not match the
     * requested `fileType`, and resolves with a `File` whose `type`
     * matches the requested format.
     *
     * Operation guard: while `isAnimating === true`
     * the call rejects via `OperationGuard.assertNotAnimating` because
     * `Promise<File>` has no natural no-op shape. The thrown error
     * embeds the operation label so callers can distinguish the guard
     * rejection from an underlying export failure.
     *
     * @param options - Export and file options.
     * @returns A promise resolving to a `File`.
     * @throws  `ExportNotReadyError` when no image is loaded.
     *
     * @example
     * ```ts
     * const file = await editor.exportImageFile({ fileType: 'png', mergeMasks: false});
     * const formData = new FormData;
     * formData.append('image', file);
     * ```
     */
    async exportImageFile(options?: ImageExportOptions): Promise<File> {
        // Guarded operation: `Promise<File>` has no empty no-op shape, so
        // the operation guard rejects without mutating canvas state.
        this.assertIdleForOperation('exportImageFile', options);
        this.finalizeActiveTextEditingIfNeeded();
        const callbackContext = this.buildCallbackContext('exportImageFile', false);
        const operationToken = this.operationGuard.beginBusyOperation('exportImageFile');
        this.emitBusyChangeIfChanged(callbackContext);
        const exportContext = this.buildExportServiceContext();
        try {
            return await exportImageFileImpl(exportContext, options);
        } finally {
            this.operationGuard.endBusyOperation(operationToken);
            this.emitBusyChangeIfChanged(callbackContext);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PRIVATE — export / merge context builders
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Build the {@link ExportServiceContext} the export service reads
     * through. The facade is the single owner of the canvas, options,
     * and the `originalImage` reference.
     */
    private buildExportServiceContext(): ExportServiceContext {
        return {
            fabric: this.fabricModule,
            canvas: this.getLiveCanvasOrThrow('export'),
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
     */
    private buildMergeMasksContext(operationToken?: OperationToken): MergeMasksContext {
        return {
            ...this.buildExportServiceContext(),
            historyManager: this.historyManager,
            containerElement: this.containerElement,
            loadImage: async (base64, providedOptions) => {
                const geometry = this.captureImageDisplayGeometry();
                await this.loadImageInternal(
                    base64,
                    this.withInternalOperationOptions(operationToken, providedOptions ?? {}),
                );
                this.restoreMergedImageDisplayGeometry(geometry);
            },
            captureSnapshot: () => this.captureSnapshotInternal(),
            loadFromState: (snapshot) =>
                this.loadFromStateInternal(
                    snapshot,
                    this.withInternalOperationOptions(
                        operationToken,
                        this.withAnimationQueueBypass(),
                    ),
                ),
            exportImageBase64: (options) =>
                exportImageBase64Impl(this.buildExportServiceContext(), options),
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
                this.annotationCounter = Math.max(
                    this.annotationCounter,
                    ...objects.map((annotation) => annotation.annotationId),
                    0,
                );
                this.updateAnnotationList();
            },
        };
    }

    private buildMergeAnnotationsContext(operationToken?: OperationToken): MergeAnnotationsContext {
        return {
            ...this.buildExportServiceContext(),
            historyManager: this.historyManager,
            containerElement: this.containerElement,
            loadImage: async (base64, providedOptions) => {
                const geometry = this.captureImageDisplayGeometry();
                await this.loadImageInternal(
                    base64,
                    this.withInternalOperationOptions(operationToken, providedOptions ?? {}),
                );
                this.restoreMergedImageDisplayGeometry(geometry);
            },
            captureSnapshot: () => this.captureSnapshotInternal(),
            loadFromState: (snapshot) =>
                this.loadFromStateInternal(
                    snapshot,
                    this.withInternalOperationOptions(
                        operationToken,
                        this.withAnimationQueueBypass(),
                    ),
                ),
            exportImageBase64: (options) =>
                exportImageBase64Impl(this.buildExportServiceContext(), options),
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
                this.lastMask = objects.reduce<MaskObject | null>(
                    (lastMask, mask) =>
                        !lastMask || mask.maskId > lastMask.maskId ? mask : lastMask,
                    null,
                );
                this.maskCounter = Math.max(
                    this.maskCounter,
                    ...objects.map((mask) => mask.maskId),
                    0,
                );
                this.updateMaskList();
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
     * and does NOT update `lastSnapshot`.
     */
    private captureSnapshotInternal(): string {
        if (!this.canvas) {
            throw new Error(
                '[ImageEditor] Cannot capture canvas snapshot before init or after dispose.',
            );
        }
        const activeMask = this.getActiveMaskForSnapshot();
        const activeAnnotation = this.getActiveAnnotationForSnapshot();
        this.hideAllMaskLabels();
        return saveStateImpl({
            canvas: this.canvas,
            activeMaskId: activeMask?.maskId ?? null,
            activeAnnotationId: activeAnnotation?.annotationId ?? null,
            currentScale: this.currentScale,
            currentRotation: this.currentRotation,
            baseImageScale: this.baseImageScale,
            currentImageMimeType: this.currentImageMimeType,
        });
    }

    private getActiveMaskForSnapshot(): MaskObject | null {
        if (!this.canvas) return null;
        const activeObject = this.canvas.getActiveObject();
        if (activeObject && isMaskObject(activeObject)) return activeObject;
        const labeledMasks = this.canvas
            .getObjects()
            .filter((object): object is MaskObject => isMaskObject(object) && !!object.labelObject);
        return labeledMasks.length === 1 ? (labeledMasks[0] ?? null) : null;
    }

    private getActiveAnnotationForSnapshot(): AnnotationObject | null {
        if (!this.canvas) return null;
        const activeObject = this.canvas.getActiveObject();
        return activeObject && isAnnotationObject(activeObject) ? activeObject : null;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PUBLIC — mosaic mode
    // ═══════════════════════════════════════════════════════════════════════

    enterMosaicMode(): void {
        if (!this.canvas || !this.originalImage) return;
        if (this.mosaicSession) return;
        if (!this.isImageLoaded()) return;
        if (!this.canRunIdleOperation('enterMosaicMode')) return;

        enterMosaicModeImpl(this.buildMosaicControllerContext());
        this.updateInputs();
        this.updateUi();
        const callbackContext = this.buildCallbackContext('enterMosaicMode', false);
        this.emitBusyChangeIfChanged(callbackContext);
        this.emitImageChanged(callbackContext);
    }

    exitMosaicMode(): void {
        if (!this.canvas || !this.mosaicSession) return;
        if (!this.canRunIdleOperation('exitMosaicMode')) return;

        exitMosaicModeImpl(this.buildMosaicControllerContext());
        this.updateInputs();
        this.updateUi();
        const callbackContext = this.buildCallbackContext('exitMosaicMode', false);
        this.emitBusyChangeIfChanged(callbackContext);
        this.emitImageChanged(callbackContext);
    }

    isMosaicMode(): boolean {
        return this.mosaicSession !== null;
    }

    getMosaicConfig(): Readonly<ResolvedMosaicConfig> {
        return cloneResolvedMosaicConfig(this.currentMosaicConfig);
    }

    setMosaicConfig(config: MosaicConfig): void {
        this.applyMosaicConfigPatch(config, 'setMosaicConfig');
    }

    resetMosaicConfig(): void {
        if (this.isDisposed) return;
        const nextConfig = cloneResolvedMosaicConfig(this.defaultMosaicConfig);
        if (areResolvedMosaicConfigsEqual(this.currentMosaicConfig, nextConfig)) return;

        this.currentMosaicConfig = nextConfig;
        if (this.mosaicSession && this.canvas) {
            updateMosaicPreview(this.buildMosaicControllerContext());
        }
        this.updateInputs();
        this.updateUi();
        this.emitImageChanged(this.buildCallbackContext('resetMosaicConfig', false));
    }

    setMosaicBrushSize(size: number): void {
        this.applyMosaicConfigPatch({ brushSize: size }, 'setMosaicBrushSize');
    }

    setMosaicBlockSize(size: number): void {
        this.applyMosaicConfigPatch({ blockSize: size }, 'setMosaicBlockSize');
    }

    private applyMosaicConfigPatch(config: MosaicConfig, operation: ImageEditorOperation): void {
        if (this.isDisposed) return;
        if (config === null || typeof config !== 'object' || Array.isArray(config)) {
            reportWarning(
                this.options,
                new TypeError('[ImageEditor] Invalid Mosaic config object.'),
                'Ignored invalid Mosaic config.',
            );
            return;
        }

        const invalidFields = getInvalidMosaicConfigFields(config);
        if (invalidFields.length > 0) {
            reportWarning(
                this.options,
                new TypeError(
                    `[ImageEditor] Ignored invalid Mosaic config field(s): ` +
                        `${invalidFields.join(', ')}.`,
                ),
                'Ignored invalid Mosaic config fields.',
            );
        }

        const nextConfig = mergeMosaicConfigPatch(this.currentMosaicConfig, config);
        if (areResolvedMosaicConfigsEqual(this.currentMosaicConfig, nextConfig)) return;

        this.currentMosaicConfig = nextConfig;
        if (this.mosaicSession && this.canvas) {
            updateMosaicPreview(this.buildMosaicControllerContext());
        }
        this.updateInputs();
        this.updateUi();
        this.emitImageChanged(this.buildCallbackContext(operation, false));
    }

    private buildMosaicControllerContext(): MosaicControllerContext {
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
            loadFromState: (snapshot) =>
                this.loadFromStateInternal(snapshot, this.withAnimationQueueBypass()),
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
            buildCallbackContext: (operation, isInternal) =>
                this.buildCallbackContext(operation, isInternal),
            getMosaicSession: () => this.mosaicSession,
            setMosaicSession: (session) => {
                this.mosaicSession = session;
            },
        };
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
    enterCropMode(options: CropModeOptions = {}): void {
        if (!this.canvas || !this.originalImage) return;
        if (this.cropSession) return;
        if (!this.isImageLoaded()) return;
        // guarded operation. No DOM action while an
        // animation is in flight: the canvas, selection state, and
        // pre-crop snapshot remain untouched.
        if (!this.canRunIdleOperation('enterCropMode')) return;
        const cropControllerContext = this.buildCropControllerContext();
        enterCropModeImpl(cropControllerContext, options);
        this.updateUi();
        const callbackContext = this.buildCallbackContext('enterCropMode', false);
        this.emitBusyChangeIfChanged(callbackContext);
        this.emitImageChanged(callbackContext);
    }

    /**
     * Updates the active crop rectangle's aspect ratio.
     *
     * No-ops unless crop mode is active. Pass `'free'` to unlock the
     * crop rectangle, a preset such as `'1:1'` or `'16:9'`, or a custom
     * ratio such as `{ width: 2, height: 1 }`.
     */
    setCropAspectRatio(aspectRatio: CropAspectRatio): void {
        if (!this.canvas || !this.cropSession) return;
        if (!this.canRunIdleOperation('setCropAspectRatio')) return;
        const cropControllerContext = this.buildCropControllerContext();
        setCropAspectRatioImpl(cropControllerContext, aspectRatio);
        this.updateUi();
        const callbackContext = this.buildCallbackContext('setCropAspectRatio', false);
        this.emitImageChanged(callbackContext);
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
        if (!this.canvas || !this.cropSession) return;
        if (!this.canRunIdleOperation('cancelCrop')) return;
        const cropControllerContext = this.buildCropControllerContext();
        cancelCropImpl(cropControllerContext);
        this.cropSession = null;
        this.updateUi();
        this.canvas.requestRenderAll();
        const callbackContext = this.buildCallbackContext('cancelCrop', false);
        this.emitBusyChangeIfChanged(callbackContext);
        this.emitImageChanged(callbackContext);
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
     * @returns A promise that resolves when the cropped image is loaded.
     */
    async applyCrop(): Promise<void> {
        if (!this.canvas || !this.cropSession) return;
        // guarded operation. Resolved-promise no-op
        // shape: leave the open crop session alone so the user can
        // re-issue `applyCrop` after the in-flight scale/rotate
        // animation settles. Do not call `cancelCrop` here: the guard must
        // leave editor state untouched.
        if (!this.canRunIdleOperation('applyCrop')) return;
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
        } finally {
            this.operationGuard.endBusyOperation(operationToken);
            this.emitBusyChangeIfChanged(callbackContext);
            this.updateUi();
        }
    }

    /**
     * Build the {@link CropControllerContext} the crop controller reads
     * through. The facade is the single owner of the live crop session
     * pointer (`cropSession`), the canvas, the resolved options, the
     * history manager, and the transactional loader, so the context's
     * accessors all bind back to `this`.
     */
    private buildCropControllerContext(operationToken?: OperationToken): CropControllerContext {
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
            loadFromState: (snapshot) =>
                this.loadFromStateInternal(
                    snapshot,
                    this.withInternalOperationOptions(
                        operationToken,
                        this.withAnimationQueueBypass(),
                    ),
                ),
            loadImage: (base64, providedOptions) =>
                this.loadImageInternal(
                    base64,
                    this.withInternalOperationOptions(operationToken, providedOptions ?? {}),
                ),
            getMaskCounter: () => this.maskCounter,
            setMaskCounter: (n) => {
                this.maskCounter = n;
            },
            updateMaskList: () => {
                this.updateMaskList();
            },
        };
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PRIVATE — UI helpers
    // ═══════════════════════════════════════════════════════════════════════

    private syncInputValue(inputElement: HTMLInputElement | null, value: string): void {
        if (!inputElement) return;
        const ownerDocument = inputElement.ownerDocument;
        if (ownerDocument.activeElement === inputElement && !inputElement.readOnly) return;
        if (inputElement.value !== value) inputElement.value = value;
    }

    private updateInputs(): void {
        const scaleId = this.elements.scalePercentageInput;
        if (scaleId) {
            const scaleInputElement = document.getElementById(scaleId) as HTMLInputElement | null;
            this.syncInputValue(scaleInputElement, String(Math.round(this.currentScale * 100)));
        }

        const mosaicConfig = this.getMosaicConfig();
        const mosaicBrushSizeInputId = this.elements.mosaicBrushSizeInput;
        if (mosaicBrushSizeInputId) {
            const brushInput = document.getElementById(
                mosaicBrushSizeInputId,
            ) as HTMLInputElement | null;
            this.syncInputValue(brushInput, String(mosaicConfig.brushSize));
        }

        const mosaicBlockSizeInputId = this.elements.mosaicBlockSizeInput;
        if (mosaicBlockSizeInputId) {
            const blockInput = document.getElementById(
                mosaicBlockSizeInputId,
            ) as HTMLInputElement | null;
            this.syncInputValue(blockInput, String(mosaicConfig.blockSize));
        }

        const textConfig = this.getTextConfig();
        const textColorInputId = this.elements.textColorInput;
        if (textColorInputId) {
            const textColorInput = document.getElementById(
                textColorInputId,
            ) as HTMLInputElement | null;
            this.syncInputValue(textColorInput, textConfig.fill);
        }
        const textFontSizeInputId = this.elements.textFontSizeInput;
        if (textFontSizeInputId) {
            const fontInput = document.getElementById(
                textFontSizeInputId,
            ) as HTMLInputElement | null;
            this.syncInputValue(fontInput, String(textConfig.fontSize));
        }

        const drawConfig = this.getDrawConfig();
        const drawColorInputId = this.elements.drawColorInput;
        if (drawColorInputId) {
            const drawColorInput = document.getElementById(
                drawColorInputId,
            ) as HTMLInputElement | null;
            this.syncInputValue(drawColorInput, drawConfig.color);
        }
        const drawBrushSizeInputId = this.elements.drawBrushSizeInput;
        if (drawBrushSizeInputId) {
            const brushInput = document.getElementById(
                drawBrushSizeInputId,
            ) as HTMLInputElement | null;
            this.syncInputValue(brushInput, String(drawConfig.brushSize));
        }
    }

    async mergeAnnotations(): Promise<void> {
        if (!this.canvas) return;
        if (!this.canRunIdleOperation('mergeAnnotations')) return;
        this.finalizeActiveTextEditingIfNeeded();
        const hasAnnotations = this.canvas.getObjects().some(isAnnotationObject);
        if (!hasAnnotations) return;
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
            if (this.getMasks().length > 0) this.emitMasksChanged(callbackContext);
            this.emitImageChanged(callbackContext);
        } finally {
            this.operationGuard.endBusyOperation(operationToken);
            this.emitBusyChangeIfChanged(callbackContext);
            this.updateUi();
        }
    }

    private updateUi(): void {
        if (!this.canvas) return;

        const hasImage = !!this.originalImage;
        const masks = hasImage ? this.canvas.getObjects().filter(isMaskObject) : [];
        const annotations = hasImage ? this.canvas.getObjects().filter(isAnnotationObject) : [];
        const hasMasks = masks.length > 0;
        const hasAnnotations = annotations.length > 0;
        const activeObject = this.canvas.getActiveObject();
        const hasSelectedMask = !!(activeObject && isMaskObject(activeObject));
        const hasSelectedAnnotation = !!(activeObject && isAnnotationObject(activeObject));
        const hasSelectedEditableObject = !!activeObject && isEditableOverlayObject(activeObject);
        const isDefaultTransform =
            this.currentScale === 1 &&
            this.currentRotation === 0 &&
            !this.originalImage?.flipX &&
            !this.originalImage?.flipY;
        const canUndo = this.historyManager.canUndo();
        const canRedo = this.historyManager.canRedo();
        const isInCropMode = this.cropSession !== null;
        const isInMosaicMode = this.mosaicSession !== null;
        const isInTextMode = this.textSession !== null;
        const isInDrawMode = this.drawSession !== null;
        const isBusy = this.operationGuard.isBusy() || this.animQueue.isBusy();
        const isMosaicApplying = this.mosaicSession?.isApplying === true;

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
                this.setControlEnabled(
                    key,
                    !isBusy && !isMosaicApplying && MOSAIC_MODE_ENABLED_KEYS.includes(key),
                );
            });
            this.setControlEnabled('imageInput', false);
            return;
        }

        this.setControlEnabled('scalePercentageInput', hasImage && !isBusy);
        this.setControlEnabled('rotateLeftDegreesInput', hasImage && !isBusy);
        this.setControlEnabled('rotateRightDegreesInput', hasImage && !isBusy);
        this.setControlEnabled(
            'zoomInButton',
            hasImage && !isBusy && this.currentScale < this.options.maxScale,
        );
        this.setControlEnabled(
            'zoomOutButton',
            hasImage && !isBusy && this.currentScale > this.options.minScale,
        );
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
        this.setControlEnabled(
            'bringSelectedObjectForwardButton',
            hasSelectedEditableObject && !isBusy,
        );
        this.setControlEnabled(
            'sendSelectedObjectBackwardButton',
            hasSelectedEditableObject && !isBusy,
        );
        this.setControlEnabled(
            'bringSelectedObjectToFrontButton',
            hasSelectedEditableObject && !isBusy,
        );
        this.setControlEnabled(
            'sendSelectedObjectToBackButton',
            hasSelectedEditableObject && !isBusy,
        );
        this.setControlEnabled('downloadImageButton', hasImage && !isBusy);
        this.setControlEnabled(
            'resetImageTransformButton',
            hasImage && !isDefaultTransform && !isBusy,
        );
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

    private setControlEnabled(key: ElementKey, isEnabled: boolean): void {
        const id = this.elements[key];
        if (!id) return;
        const controlElement = document.getElementById(id);
        if (!controlElement) return;
        this.recordElementOriginalState(key, controlElement);
        if ('disabled' in controlElement) {
            const formControl = controlElement as HTMLButtonElement | HTMLInputElement;
            const nextDisabled = !isEnabled;
            if (formControl.disabled !== nextDisabled) formControl.disabled = nextDisabled;
            return;
        }
        if (!isEnabled) {
            controlElement.setAttribute('aria-disabled', 'true');
            controlElement.style.pointerEvents = 'none';
        } else {
            const originalAria = this.elementOriginalAriaDisabledMap.get(key);
            if (originalAria === null || originalAria === undefined) {
                controlElement.removeAttribute('aria-disabled');
            } else {
                controlElement.setAttribute('aria-disabled', originalAria);
            }
            controlElement.style.pointerEvents =
                this.elementOriginalPointerEventsMap.get(key) ?? '';
        }
    }

    private recordElementOriginalState(key: ElementKey, element: HTMLElement): void {
        if (!this.elementOriginalAriaDisabledMap.has(key)) {
            this.elementOriginalAriaDisabledMap.set(key, element.getAttribute('aria-disabled'));
        }
        if (!this.elementOriginalPointerEventsMap.has(key)) {
            this.elementOriginalPointerEventsMap.set(key, element.style.pointerEvents || '');
        }
        if ('disabled' in element && !this.elementOriginalDisabledMap.has(key)) {
            this.elementOriginalDisabledMap.set(
                key,
                !!(element as HTMLButtonElement | HTMLInputElement).disabled,
            );
        }
    }

    private restoreElementOriginalStates(): void {
        for (const key of Object.keys(this.elements) as ElementKey[]) {
            const id = this.elements[key];
            if (!id) continue;
            const element = document.getElementById(id);
            if (!element) continue;
            if ('disabled' in element && this.elementOriginalDisabledMap.has(key)) {
                (element as HTMLButtonElement | HTMLInputElement).disabled =
                    this.elementOriginalDisabledMap.get(key) ?? false;
            }
            if (this.elementOriginalAriaDisabledMap.has(key)) {
                const originalAria = this.elementOriginalAriaDisabledMap.get(key);
                if (originalAria === null || originalAria === undefined) {
                    element.removeAttribute('aria-disabled');
                } else {
                    element.setAttribute('aria-disabled', originalAria);
                }
            }
            if (this.elementOriginalPointerEventsMap.has(key)) {
                element.style.pointerEvents = this.elementOriginalPointerEventsMap.get(key) ?? '';
            }
        }
        this.elementOriginalDisabledMap.clear();
        this.elementOriginalAriaDisabledMap.clear();
        this.elementOriginalPointerEventsMap.clear();
    }

    private updatePlaceholderStatus(): void {
        setPlaceholderVisibleImpl(
            this.placeholderElement,
            this.containerElement,
            this.options.showPlaceholder ? !this.originalImage : false,
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
     * 1. Short-circuit on a second call so `dispose` is idempotent. This
     *    also guards against re-running
     *    the teardown path after the canvas reference has already been
     *    nulled.
     * 2. Set `isDisposed = true` so in-flight animation `onChange`/
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
        if (this.isDisposed) return;
        const context = this.buildCallbackContext('dispose', false);
        const previousImage = this.originalImage;

        // (2) Signal in-flight animations and bound handlers to stop
        //     touching the canvas. Set BEFORE draining the queue so the
        //     active animation's disposed-aware callbacks see `true` on
        //     their next tick. The {@link OperationGuard} mirrors the
        //     same flag so the transform controller and Fabric animation
        //     wrapper short-circuit through the shared guard
        //.
        this.isDisposed = true;
        this.operationGuard.markDisposed();

        // (3) Settle every queued animation. `clear` resolves pending
        //     entries (no rejection reason — the orchestrator's own
        //     dispose guards already prevent further canvas access) so
        //     `await editor.scaleImage(2)` callers do not hang.
        this.animQueue.clear();

        // (4) Detach every recorded DOM listener. The registry handles
        //     missing/already-detached elements internally.
        this.domBindings?.removeAll();
        if (this.keyboardHandler && this.keyboardDocument) {
            try {
                this.keyboardDocument.removeEventListener('keydown', this.keyboardHandler);
            } catch {
                /* ignore */
            }
        }
        this.keyboardHandler = null;
        this.keyboardDocument = null;
        this.restoreElementOriginalStates();

        if (this.cropSession && this.canvas) {
            // (5) Drop the crop session if one was open. The crop
            //     controller's teardownSession is best-effort because
            //     Fabric may have already disposed the rect during a
            //     `loadFromState` rollback.
            try {
                const context = this.buildCropControllerContext();
                cancelCropImpl(context);
            } catch {
                /* ignore */
            }
            this.cropSession = null;
        }

        if (this.mosaicSession && this.canvas) {
            try {
                exitMosaicModeImpl(this.buildMosaicControllerContext());
            } catch {
                /* ignore */
            }
            this.mosaicSession = null;
        }

        if (this.textSession && this.canvas) {
            try {
                exitTextModeImpl(this.buildTextControllerContext());
            } catch {
                /* ignore */
            }
            this.textSession = null;
        }

        if (this.drawSession && this.canvas) {
            try {
                exitDrawModeImpl(this.buildDrawControllerContext());
            } catch {
                /* ignore */
            }
            this.drawSession = null;
        }

        if (this.canvas) {
            try {
                void Promise.resolve(this.canvas.dispose()).catch(() => {
                    /* ignore */
                });
            } catch {
                /* ignore */
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

        // Drop the transform controller — the Fabric canvas reference
        // it captured via `TransformContext.canvas` is now disposed, so
        // the controller would crash if a queued entry somehow ran
        // after dispose. The animQueue.clear above already settles
        // pending entries, but null'ing the controller defends against
        // re-init paths that recreate state after dispose.
        this.transformController = null;

        // Clear the layout-manager viewport cache so a re-instantiation of
        // the editor on the same DOM does not inherit stale measurements.
        this.viewportCache.clear();
        if (previousImage) {
            this.emitOptionCallback('onImageCleared', [previousImage, context]);
        }
        this.emitImageChanged(context);
        this.emitBusyChangeIfChanged(context);
        this.emitOptionCallback('onEditorDisposed', [context]);
    }
}
