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
    resolveElementIds,
    type ElementKey,
    type ResolvedElementIdMap,
} from './core/editor-elements.js';
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
    renderAnnotationList,
    updateAnnotationListSelection,
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
import { syncAnnotationRuntimeStates } from './annotation/annotation-style.js';
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
import { loadImage as loadImageImpl } from './image/image-loader.js';
import { loadImageFile as loadImageFileImpl } from './image/image-file-loader.js';
import {
    captureImageDisplayGeometry as captureImageDisplayGeometryImpl,
    getScrollbarStableViewportCanvasSize as getScrollbarStableViewportCanvasSizeImpl,
    measureLayoutViewport as measureLayoutViewportImpl,
    restoreMergedImageDisplayGeometry as restoreMergedImageDisplayGeometryImpl,
    settleFitCoverScrollbarsAfterStateRestore as settleFitCoverScrollbarsAfterStateRestoreImpl,
    shouldNormalizeCanvasSizeAfterStateRestore as shouldNormalizeCanvasSizeAfterStateRestoreImpl,
    updateCanvasSizeToImageBounds as updateCanvasSizeToImageBoundsImpl,
    type DisplayGeometryContext,
    type ImageDisplayGeometry,
} from './image/display-geometry.js';
import { ViewportCache, applyCanvasDimensions, type ViewportSize } from './image/layout-manager.js';
import { TransformController, type TransformContext } from './image/transform-controller.js';
import { EditorContextFactory } from './runtime/editor-contexts.js';
import { runBusyOperation, type BusyOperationAccess } from './runtime/editor-operation-runner.js';
import {
    handleObjectModified as handleObjectModifiedImpl,
    handleObjectMovingScalingRotating as handleObjectMovingScalingRotatingImpl,
    handleSelectionChanged as handleSelectionChangedImpl,
    type EditorSelectionControllerAccess,
} from './selection/editor-selection-controller.js';
import {
    deleteSelectedEditableObjects,
    moveSelectedEditableObject as moveSelectedEditableObjectImpl,
    removeAllAnnotationsAction,
    removeSelectedAnnotationAction,
    updateAnnotationAction,
    updateSelectedAnnotationAction,
    type EditableObjectActionAccess,
} from './overlay/editable-object-actions.js';
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
import { applyMaskUnselectedStyle, reattachMaskHoverHandlers } from './mask/mask-style.js';
import { safelyDisposeCanvas, safelyRemoveKeyboardListener } from './lifecycle/editor-dispose.js';
import { DomBindings } from './ui/dom-bindings.js';
import { applyEditorControlState, type EditorControlSnapshot } from './ui/editor-control-state.js';
import {
    restoreEditorControlOriginalStates,
    setEditorControlEnabled,
    type EditorControlElementContext,
} from './ui/editor-control-elements.js';
import { bindEditorDomEvents } from './ui/editor-dom-events.js';
import { applyEditorInputState } from './ui/editor-input-state.js';
import {
    bindEditorKeyboardEvents,
    handleEditorKeyboardEvent,
    isFabricTextEditingActive,
} from './ui/editor-keyboard-events.js';
import { setPlaceholderVisible as setPlaceholderVisibleImpl } from './ui/visibility-state.js';
import {
    canRunOperationInToolMode,
    getActiveToolMode as getActiveToolModeFromSnapshot,
    isImageEditorOperation,
    isToolModeActive as isToolModeActiveFromSnapshot,
    type EditorToolModeSnapshot,
} from './tool-mode/tool-mode-policy.js';
import { isSupportedImageDataUrl } from './utils/file.js';
import { detectSourceMimeType } from './image/image-resampler.js';

const INTERNAL_OPERATION_TOKEN = Symbol('ImageEditorInternalOperation');
const INTERNAL_ALLOW_DURING_ANIMATION_QUEUE = Symbol('ImageEditorAllowDuringAnimationQueue');

type InternalOperationOptions = {
    [INTERNAL_OPERATION_TOKEN]?: OperationToken;
    [INTERNAL_ALLOW_DURING_ANIMATION_QUEUE]?: true;
};

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
    private readonly contextFactory: EditorContextFactory;

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
        this.contextFactory = this.createContextFactory();
    }

    private createContextFactory(): EditorContextFactory {
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
            loadImageForOperation: (operationToken, base64, providedOptions) =>
                this.loadImageInternal(
                    base64,
                    this.withInternalOperationOptions(operationToken, providedOptions ?? {}),
                ),
            loadMergedImage: async (operationToken, base64, providedOptions) => {
                const geometry = this.captureImageDisplayGeometry();
                await this.loadImageInternal(
                    base64,
                    this.withInternalOperationOptions(operationToken, providedOptions ?? {}),
                );
                this.restoreMergedImageDisplayGeometry(geometry);
            },
            loadFromStateForOperation: (operationToken, snapshot) =>
                this.loadFromStateInternal(
                    snapshot,
                    this.withInternalOperationOptions(
                        operationToken,
                        this.withAnimationQueueBypass(),
                    ),
                ),
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
                setPlaceholderVisibleImpl(
                    this.placeholderElement,
                    this.containerElement,
                    this.options.showPlaceholder ? show : false,
                );
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
            buildCallbackContext: (operation, isInternalOperation) =>
                this.buildCallbackContext(operation, isInternalOperation),
        });
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

        this.elements = resolveElementIds(idMap);

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
        if (!this.domBindings) return;
        const ownerDocument = this.canvasElement?.ownerDocument ?? document;

        bindEditorDomEvents({
            bindings: this.domBindings,
            rotationStep: this.options.rotationStep,
            getInputValue: (key) => {
                const id = this.elements[key];
                const element = id
                    ? (ownerDocument.getElementById(id) as
                          | HTMLInputElement
                          | HTMLSelectElement
                          | null)
                    : null;
                return element?.value ?? '';
            },
            actions: {
                openImagePicker: () => {
                    const inputId = this.elements.imageInput;
                    if (inputId) ownerDocument.getElementById(inputId)?.click();
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

    private bindKeyboardEvents(): void {
        bindEditorKeyboardEvents({
            getOwnerDocument: () => this.canvasElement?.ownerDocument ?? document,
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

    private handleKeyboardEvent(event: KeyboardEvent): void {
        handleEditorKeyboardEvent(
            {
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
            },
            event,
        );
    }

    private finalizeActiveTextEditingIfNeeded(): void {
        if (!this.canvas || !isFabricTextEditingActive(this.canvas)) return;
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
        await loadImageFileImpl(
            {
                options: this.options,
                getInputElement: () => {
                    const inputId = this.elements.imageInput;
                    return inputId
                        ? (document.getElementById(inputId) as HTMLInputElement | null)
                        : null;
                },
                loadImage: (dataUrl) => this.loadImage(dataUrl),
            },
            file,
        );
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
     * @param base64 - Supported image data URL string.
     * @param options - Optional {@link LoadImageOptions}; currently only
     *                `preserveScroll` is consulted.
     * @returns A promise that resolves once the image is on the canvas, or
     *          rejects with the original error after a transactional
     *          rollback. Unsupported image inputs and Fabric-unavailable /
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
        if (!isSupportedImageDataUrl(base64)) return;

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
        const loadImageContext = this.contextFactory.buildLoadImageContext();

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
            !canRunOperationInToolMode(activeToolMode, operationName)
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
            !canRunOperationInToolMode(activeToolMode, operationName)
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

    private buildBusyOperationAccess(): BusyOperationAccess {
        return {
            beginBusyOperation: (operation) => this.operationGuard.beginBusyOperation(operation),
            endBusyOperation: (token) => {
                this.operationGuard.endBusyOperation(token);
            },
            buildCallbackContext: (operation, isInternalOperation) =>
                this.buildCallbackContext(operation, isInternalOperation),
            emitBusyChangeIfChanged: (context) => {
                this.emitBusyChangeIfChanged(context);
            },
            updateUi: () => {
                this.updateUi();
            },
        };
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

    private buildToolModeSnapshot(): EditorToolModeSnapshot {
        return {
            hasCropSession: this.cropSession !== null,
            hasMosaicSession: this.mosaicSession !== null,
            hasTextSession: this.textSession !== null,
            hasDrawSession: this.drawSession !== null,
        };
    }

    private getActiveToolMode(): EditorToolMode | null {
        return getActiveToolModeFromSnapshot(this.buildToolModeSnapshot());
    }

    private isToolModeActive(): boolean {
        return isToolModeActiveFromSnapshot(this.buildToolModeSnapshot());
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

    private buildDisplayGeometryContext(): DisplayGeometryContext {
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

    private measureLayoutViewport(scrollbarSize?: { width: number; height: number }): ViewportSize {
        return measureLayoutViewportImpl(this.buildDisplayGeometryContext(), scrollbarSize);
    }

    private getScrollbarStableViewportCanvasSize(viewport: ViewportSize): ViewportSize {
        return getScrollbarStableViewportCanvasSizeImpl(viewport);
    }

    /**
     * Resize the canvas to fit the transformed image bounds. Used by the
     * transform pipeline's `afterTransformSnap` hook so a post-rotation/scale
     * image that exceeds the viewport gets a real scroll range.
     */
    private updateCanvasSizeToImageBounds(
        options: { stabilizeContainedViewport?: boolean } = {},
    ): void {
        updateCanvasSizeToImageBoundsImpl(this.buildDisplayGeometryContext(), options);
    }

    private shouldNormalizeCanvasSizeAfterStateRestore(): boolean {
        return shouldNormalizeCanvasSizeAfterStateRestoreImpl(this.buildDisplayGeometryContext());
    }

    private settleFitCoverScrollbarsAfterStateRestore(): void {
        settleFitCoverScrollbarsAfterStateRestoreImpl(this.buildDisplayGeometryContext());
    }

    private captureImageDisplayGeometry(): ImageDisplayGeometry | null {
        return captureImageDisplayGeometryImpl(this.buildDisplayGeometryContext());
    }

    private restoreMergedImageDisplayGeometry(geometry: ImageDisplayGeometry | null): void {
        restoreMergedImageDisplayGeometryImpl(this.buildDisplayGeometryContext(), geometry);
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
        return this.contextFactory.buildTransformContext();
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
        return this.contextFactory.buildCreateMaskContext();
    }

    /**
     * Build the {@link RemoveMaskContext} the mask factory reads/writes
     * through for `removeSelectedMask` / `removeAllMasks`. The facade
     * is the single owner of the canvas, mask label DOM, mask list
     * DOM, history, and `lastMask`, so the context's accessors bind
     * back to `this`.
     */
    private buildRemoveMaskContext(): RemoveMaskContext {
        return this.contextFactory.buildRemoveMaskContext();
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PRIVATE — mask label helpers
    // ═══════════════════════════════════════════════════════════════════════

    private buildMaskLabelContext(): MaskLabelManagerContext | null {
        return this.contextFactory.buildMaskLabelContext();
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

    private buildSelectionControllerAccess(): EditorSelectionControllerAccess {
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
            buildCallbackContext: (operation, isHistoryRestore) =>
                this.buildCallbackContext(operation, isHistoryRestore),
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

    private handleObjectMovingScalingRotating(target: FabricNS.FabricObject): void {
        handleObjectMovingScalingRotatingImpl(this.buildSelectionControllerAccess(), target);
    }

    private handleObjectModified(target: FabricNS.FabricObject): void {
        handleObjectModifiedImpl(this.buildSelectionControllerAccess(), target);
    }

    private handleSelectionChanged(selected: FabricNS.FabricObject[]): void {
        handleSelectionChangedImpl(this.buildSelectionControllerAccess(), selected);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PRIVATE — mask list DOM
    // ═══════════════════════════════════════════════════════════════════════

    private buildMaskListContext(): MaskListContext {
        return this.contextFactory.buildMaskListContext();
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

    private buildEditableObjectActionAccess(): EditableObjectActionAccess {
        return {
            getCanvas: () => this.canvas,
            getLiveCanvas: (operationName) => this.getLiveCanvasOrThrow(operationName),
            buildAnnotationManagerContext: () => this.buildAnnotationManagerContext(),
            getMasks: () => this.getMasks(),
            getAnnotations: () => this.getAnnotations(),
            removeLabelForMask: (mask) => {
                this.removeLabelForMask(mask);
            },
            withSelectionChangeContext: (context, callback) =>
                this.withSelectionChangeContext(context, callback),
            buildCallbackContext: (operation, isInternalOperation) =>
                this.buildCallbackContext(operation, isInternalOperation),
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

    removeSelectedAnnotation(): void {
        if (!this.canvas) return;
        if (!this.canRunIdleOperation('removeSelectedAnnotation')) return;
        const callbackContext = this.buildCallbackContext('removeSelectedAnnotation', false);
        removeSelectedAnnotationAction(this.buildEditableObjectActionAccess(), callbackContext);
    }

    removeAllAnnotations(options: RemoveAllAnnotationsOptions = {}): void {
        if (!this.canvas) return;
        if (!this.canRunIdleOperation('removeAllAnnotations', options)) return;
        const callbackContext = this.buildCallbackContext('removeAllAnnotations', false);
        removeAllAnnotationsAction(
            this.buildEditableObjectActionAccess(),
            options,
            callbackContext,
        );
    }

    updateAnnotation(annotationId: number, config: AnnotationUpdateConfig): void {
        if (!this.canvas) return;
        if (!this.canRunIdleOperation('updateAnnotation')) return;
        const callbackContext = this.buildCallbackContext('updateAnnotation', false);
        updateAnnotationAction(
            this.buildEditableObjectActionAccess(),
            annotationId,
            config,
            callbackContext,
        );
    }

    updateSelectedAnnotation(config: AnnotationUpdateConfig): void {
        if (!this.canvas) return;
        if (!this.canRunIdleOperation('updateSelectedAnnotation')) return;
        const callbackContext = this.buildCallbackContext('updateSelectedAnnotation', false);
        updateSelectedAnnotationAction(
            this.buildEditableObjectActionAccess(),
            config,
            callbackContext,
        );
    }

    deleteSelectedObject(): void {
        if (!this.canvas) return;
        if (!this.canRunIdleOperation('deleteSelectedObject')) return;
        this.finalizeActiveTextEditingIfNeeded();
        const callbackContext = this.buildCallbackContext('deleteSelectedObject', false);
        deleteSelectedEditableObjects(this.buildEditableObjectActionAccess(), callbackContext);
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
        return this.contextFactory.buildAnnotationManagerContext();
    }

    private buildAnnotationListContext(): AnnotationListContext {
        return this.contextFactory.buildAnnotationListContext();
    }

    private updateAnnotationList(): void {
        renderAnnotationList(this.buildAnnotationListContext());
    }

    private updateAnnotationListSelection(selectedAnnotation: AnnotationObject | null): void {
        updateAnnotationListSelection(this.buildAnnotationListContext(), selectedAnnotation);
    }

    private buildTextControllerContext(): TextControllerContext {
        return this.contextFactory.buildTextControllerContext();
    }

    private buildDrawControllerContext(): DrawControllerContext {
        return this.contextFactory.buildDrawControllerContext();
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

    private moveSelectedEditableObject(operation: ImageEditorOperation): void {
        if (!this.canvas) return;
        if (!this.canRunIdleOperation(operation)) return;
        moveSelectedEditableObjectImpl(this.buildEditableObjectActionAccess(), operation);
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
        await runBusyOperation(
            this.buildBusyOperationAccess(),
            'mergeMasks',
            async (callbackContext, operationToken) => {
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
            },
        );
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
        return this.contextFactory.buildExportServiceContext();
    }

    /**
     * Build the {@link MergeMasksContext} the merge pipeline reads
     * through. Extends the export-service context with the history
     * manager, container element, transactional `loadImage`, and the
     * `saveState`/`loadFromState`/`removeAllMasksNoHistory` callbacks
     * the merge needs.
     */
    private buildMergeMasksContext(operationToken?: OperationToken): MergeMasksContext {
        return this.contextFactory.buildMergeMasksContext(operationToken);
    }

    private buildMergeAnnotationsContext(operationToken?: OperationToken): MergeAnnotationsContext {
        return this.contextFactory.buildMergeAnnotationsContext(operationToken);
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
        return this.contextFactory.buildMosaicControllerContext();
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
        return this.contextFactory.buildCropControllerContext(operationToken);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PRIVATE — UI helpers
    // ═══════════════════════════════════════════════════════════════════════

    private updateInputs(): void {
        applyEditorInputState(
            {
                currentScale: this.currentScale,
                mosaicConfig: this.getMosaicConfig(),
                textConfig: this.getTextConfig(),
                drawConfig: this.getDrawConfig(),
            },
            (key) => {
                const id = this.elements[key];
                return id ? (document.getElementById(id) as HTMLInputElement | null) : null;
            },
        );
    }

    async mergeAnnotations(): Promise<void> {
        if (!this.canvas) return;
        if (!this.canRunIdleOperation('mergeAnnotations')) return;
        this.finalizeActiveTextEditingIfNeeded();
        const hasAnnotations = this.canvas.getObjects().some(isAnnotationObject);
        if (!hasAnnotations) return;
        await runBusyOperation(
            this.buildBusyOperationAccess(),
            'mergeAnnotations',
            async (callbackContext, operationToken) => {
                await mergeAnnotationsImpl(this.buildMergeAnnotationsContext(operationToken));
                this.updateInputs();
                this.updateMaskList();
                this.updateAnnotationList();
                this.emitAnnotationsChanged(callbackContext);
                if (this.getMasks().length > 0) this.emitMasksChanged(callbackContext);
                this.emitImageChanged(callbackContext);
            },
        );
    }

    private updateUi(): void {
        const snapshot = this.buildControlSnapshot();
        if (!snapshot) return;

        applyEditorControlState(snapshot, (key, enabled) => {
            this.setControlEnabled(key, enabled);
        });
    }

    private buildControlSnapshot(): EditorControlSnapshot | null {
        if (!this.canvas) return null;
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

    private buildControlElementContext(): EditorControlElementContext {
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

    private setControlEnabled(key: ElementKey, isEnabled: boolean): void {
        setEditorControlEnabled(this.buildControlElementContext(), key, isEnabled);
    }

    private restoreElementOriginalStates(): void {
        restoreEditorControlOriginalStates(this.buildControlElementContext());
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
        safelyRemoveKeyboardListener(this.keyboardDocument, this.keyboardHandler);
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
