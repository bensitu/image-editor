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
    cloneResolvedMosaicConfig,
    cloneResolvedDrawConfig,
    cloneResolvedTextAnnotationConfig,
    isLayoutMode,
    resolveOptions,
} from './core/default-options.js';
import { OperationGuard, type OperationToken } from './core/operation-guard.js';
import type { CanvasJson } from './core/state-serializer.js';
import { HistoryManager } from './history/history-manager.js';
import {
    captureSnapshotAction,
    loadFromStateAction,
    saveStateAction,
    type EditorStateActionAccess,
} from './history/editor-state-actions.js';
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
import { isAnnotationObject, isEditableOverlayObject, isMaskObject } from './core/public-types.js';
import {
    getAnnotations as getAnnotationsImpl,
    renderAnnotationList,
    updateAnnotationListSelection,
    type AnnotationListContext,
    type AnnotationManagerContext,
} from './annotation/annotation-manager.js';
import {
    exitTextMode as exitTextModeImpl,
    finalizeActiveTextEditing,
    type TextControllerContext,
    type TextSession,
} from './annotation/text-controller.js';
import {
    exitDrawMode as exitDrawModeImpl,
    type DrawControllerContext,
    type DrawSession,
} from './annotation/draw-controller.js';
import {
    createTextAnnotationAction,
    enterDrawModeAction,
    enterTextModeAction,
    exitDrawModeAction,
    exitTextModeAction,
    type AnnotationModeActionAccess,
} from './annotation/annotation-mode-actions.js';
import {
    applyDrawBrushSizeInputAction,
    applyDrawColorInputAction,
    applyDrawConfigPatchAction,
    applyTextColorInputAction,
    applyTextConfigPatchAction,
    applyTextFontSizeInputAction,
    type AnnotationConfigActionAccess,
} from './annotation/annotation-config-actions.js';
import {
    cancelCrop as cancelCropImpl,
    type CropControllerContext,
    type CropSession,
} from './crop/crop-controller.js';
import {
    applyCropAction,
    cancelCropAction,
    enterCropModeAction,
    setCropAspectRatioAction,
    type CropActionAccess,
} from './crop/crop-actions.js';
import {
    exitMosaicMode as exitMosaicModeImpl,
    type MosaicControllerContext,
    type MosaicSession,
} from './mosaic/mosaic-controller.js';
import {
    applyMosaicConfigPatchAction,
    enterMosaicModeAction,
    exitMosaicModeAction,
    resetMosaicConfigAction,
    type MosaicActionAccess,
} from './mosaic/mosaic-actions.js';
import {
    type ExportServiceContext,
    type MergeAnnotationsContext,
    type MergeMasksContext,
} from './export/export-service.js';
import {
    downloadImageAction,
    exportImageBase64Action,
    exportImageFileAction,
    mergeAnnotationsAction,
    mergeMasksAction,
    type ExportActionAccess,
} from './export/export-actions.js';
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
import {
    flipHorizontalAction,
    flipVerticalAction,
    resetImageTransformAction,
    rotateImageAction,
    scaleImageAction,
    type TransformActionAccess,
} from './image/transform-actions.js';
import { EditorContextFactory } from './runtime/editor-contexts.js';
import type { BusyOperationAccess } from './runtime/editor-operation-runner.js';
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
import { type CreateMaskContext, type RemoveMaskContext } from './mask/mask-factory.js';
import {
    createMaskAction,
    removeAllMasksAction as removeAllMasksActionImpl,
    removeSelectedMaskAction,
    type MaskActionAccess,
} from './mask/mask-actions.js';
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
    safelyDisposeCanvas,
    safelyExitActiveSession,
    safelyRemoveKeyboardListener,
} from './lifecycle/editor-dispose.js';
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
     * Accepts ESM (`new ImageEditor(fabric, options?)`) and UMD/CDN
     * (`new ImageEditor(options?)`) forms. Fabric detection and option
     * normalization are delegated to the adapter/resolver modules.
     */
    constructor(
        fabricModuleOrOptions: FabricModule | ImageEditorOptions = {},
        options: ImageEditorOptions = {},
    ) {
        const detected = detectFabric(fabricModuleOrOptions, options);

        this.fabricModule = detected.fabric ?? ({} as FabricModule);
        this.isFabricLoaded = detected.isFabricLoaded;

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

    /** Initializes DOM bindings, canvas state, and the optional initial image. */
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
        // Post-dispose init is a no-op to avoid recreating canvas resources.
        if (this.isDisposed) return;

        this.elements = resolveElementIds(idMap);

        this.initCanvas();
        // Bindings are anchored to the canvas owner document.
        this.domBindings = new DomBindings(
            (key) => this.elements[key],
            () => this.isDisposed,
            () => this.canvasElement?.ownerDocument ?? document,
        );
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

    /** Builds the transform controller context from facade-owned runtime state. */
    private buildTransformContext(): TransformContext {
        return this.contextFactory.buildTransformContext();
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PUBLIC — scale / rotate / reset
    // ═══════════════════════════════════════════════════════════════════════

    private buildTransformActionAccess(): TransformActionAccess {
        return {
            isDisposed: () => this.isDisposed,
            getTransformController: () => this.transformController,
            assertCanQueueAnimation: (operation) => {
                this.assertCanQueueAnimation(operation);
            },
            buildCallbackContext: (operation, isInternalOperation) =>
                this.buildCallbackContext(operation, isInternalOperation),
            enqueueAnimation: (body) => this.animQueue.add(body),
            updateInputs: () => {
                this.updateInputs();
            },
            updateUi: () => {
                this.updateUi();
            },
            refreshUiAfterQueuedAnimation: () => {
                this.refreshUiAfterQueuedAnimation();
            },
            emitImageChanged: (context) => {
                this.emitImageChanged(context);
            },
            emitBusyChangeIfChanged: (context) => {
                this.emitBusyChangeIfChanged(context);
            },
        };
    }

    /** Animates the image to the given scale factor, clamped to configured limits. */
    scaleImage(factor: number): Promise<void> {
        return scaleImageAction(this.buildTransformActionAccess(), factor);
    }

    /** Animates the image to the given rotation angle. Non-finite input no-ops. */
    rotateImage(degrees: number): Promise<void> {
        return rotateImageAction(this.buildTransformActionAccess(), degrees);
    }

    flipHorizontal(): Promise<void> {
        return flipHorizontalAction(this.buildTransformActionAccess());
    }

    flipVertical(): Promise<void> {
        return flipVerticalAction(this.buildTransformActionAccess());
    }

    /** Resets scale, rotation, and flip state as one undoable transform. */
    resetImageTransform(): Promise<void> {
        return resetImageTransformAction(this.buildTransformActionAccess());
    }

    private refreshUiAfterQueuedAnimation(): void {
        if (this.isDisposed || !this.canvas) return;
        this.updateInputs();
        this.updateUi();
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PUBLIC — history
    // ═══════════════════════════════════════════════════════════════════════

    private buildEditorStateActionAccess(): EditorStateActionAccess {
        return {
            getCanvas: () => this.canvas,
            getLiveCanvas: (operationName) => this.getLiveCanvasOrThrow(operationName),
            getOptions: () => this.options,
            isDisposed: () => this.isDisposed,
            canRunIdleOperation: (operation, options) =>
                this.canRunIdleOperation(operation, options),
            getActiveStateRestoreOperation: () => this.activeStateRestoreOperation,
            buildCallbackContext: (operation, isInternalOperation) =>
                this.buildCallbackContext(operation, isInternalOperation),
            getOriginalImage: () => this.originalImage,
            setOriginalImage: (image) => {
                this.originalImage = image;
            },
            getMaskCollectionSignature: () => this.getMaskCollectionSignature(),
            getAnnotationCollectionSignature: () => this.getAnnotationCollectionSignature(),
            setCanvasSize: (widthPx, heightPx) => {
                this.setCanvasSizePx(widthPx, heightPx);
            },
            hideAllMaskLabels: () => {
                this.hideAllMaskLabels();
            },
            inferCurrentImageMimeType: () => this.inferCurrentImageMimeType(),
            setCurrentImageMimeType: (mimeType) => {
                this.currentImageMimeType = mimeType;
            },
            setIsImageLoadedToCanvas: (value) => {
                this.isImageLoadedToCanvas = value;
            },
            setMaskCounter: (value) => {
                this.maskCounter = value;
            },
            setAnnotationCounter: (value) => {
                this.annotationCounter = value;
            },
            setCurrentScale: (value) => {
                this.currentScale = value;
            },
            setCurrentRotation: (value) => {
                this.currentRotation = value;
            },
            setBaseImageScale: (value) => {
                this.baseImageScale = value;
            },
            setLastMask: (mask) => {
                this.lastMask = mask;
            },
            getLastSnapshot: () => this.lastSnapshot,
            setLastSnapshot: (snapshot) => {
                this.lastSnapshot = snapshot;
            },
            shouldNormalizeCanvasSizeAfterStateRestore: () =>
                this.shouldNormalizeCanvasSizeAfterStateRestore(),
            updateCanvasSizeToImageBounds: (options) => {
                this.updateCanvasSizeToImageBounds(options);
            },
            alignObjectBoundingBoxToCanvasTopLeft: (object) => {
                this.alignObjectBoundingBoxToCanvasTopLeft(object);
            },
            settleFitCoverScrollbarsAfterStateRestore: () => {
                this.settleFitCoverScrollbarsAfterStateRestore();
            },
            buildTextControllerContext: () => this.buildTextControllerContext(),
            updateInputs: () => {
                this.updateInputs();
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
            emitImageCleared: (image, context) => {
                this.emitOptionCallback('onImageCleared', [image, context]);
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
            withSelectionChangeContext: (context, callback) =>
                this.withSelectionChangeContext(context, callback),
            handleSelectionChanged: (selected) => {
                this.handleSelectionChanged(selected);
            },
            shouldSuppressSaveState: () => this.shouldSuppressSaveState,
            getCurrentScale: () => this.currentScale,
            getCurrentRotation: () => this.currentRotation,
            getBaseImageScale: () => this.baseImageScale,
            getCurrentImageMimeType: () => this.currentImageMimeType,
            getHistoryManager: () => this.historyManager,
            withAnimationQueueBypass: () => this.withAnimationQueueBypass(),
            showLabelForMask: (mask) => {
                this.showLabelForMask(mask);
            },
            updateMaskListSelection: (mask) => {
                this.updateMaskListSelection(mask);
            },
            updateAnnotationListSelection: (annotation) => {
                this.updateAnnotationListSelection(annotation);
            },
        };
    }

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
        await loadFromStateAction(this.buildEditorStateActionAccess(), jsonString, options);
    }

    /**
     * Captures the current canvas state into the undo/redo history.
     * Called automatically after transforms, mask operations, and crop.
     */
    saveState(): void {
        this.saveStateInternal();
    }

    private saveStateInternal(options?: InternalOperationOptions | null): void {
        saveStateAction(this.buildEditorStateActionAccess(), options);
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

    private buildMaskActionAccess(): MaskActionAccess {
        return {
            getCanvas: () => this.canvas,
            getMasks: () => this.getMasks(),
            canRunIdleOperation: (operation, options) =>
                this.canRunIdleOperation(operation, options),
            buildCallbackContext: (operation, isInternalOperation) =>
                this.buildCallbackContext(operation, isInternalOperation),
            buildCreateMaskContext: () => this.buildCreateMaskContext(),
            buildRemoveMaskContext: () => this.buildRemoveMaskContext(),
            withSelectionChangeContext: (context, callback) =>
                this.withSelectionChangeContext(context, callback),
            updateUi: () => {
                this.updateUi();
            },
            emitMasksChanged: (context) => {
                this.emitMasksChanged(context);
            },
            emitImageChanged: (context) => {
                this.emitImageChanged(context);
            },
        };
    }

    /** Creates and adds a mask shape, returning `null` when the operation cannot run. */
    createMask(config: MaskConfig = {}): MaskObject | null {
        return createMaskAction(this.buildMaskActionAccess(), config);
    }

    /** Removes the currently selected mask and its label. */
    removeSelectedMask(): void {
        removeSelectedMaskAction(this.buildMaskActionAccess());
    }

    /** Removes all masks and labels, or no-ops while guarded operations are active. */
    removeAllMasks(options: RemoveAllMasksOptions = {}): void {
        removeAllMasksActionImpl(this.buildMaskActionAccess(), options);
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

    private buildAnnotationModeActionAccess(): AnnotationModeActionAccess {
        return {
            getCanvas: () => this.canvas,
            getTextSession: () => this.textSession,
            getDrawSession: () => this.drawSession,
            isToolModeActive: () => this.isToolModeActive(),
            canRunIdleOperation: (operation) => this.canRunIdleOperation(operation),
            buildTextControllerContext: () => this.buildTextControllerContext(),
            buildDrawControllerContext: () => this.buildDrawControllerContext(),
            buildCallbackContext: (operation, isInternalOperation) =>
                this.buildCallbackContext(operation, isInternalOperation),
            emitBusyChangeIfChanged: (context) => {
                this.emitBusyChangeIfChanged(context);
            },
            emitImageChanged: (context) => {
                this.emitImageChanged(context);
            },
        };
    }

    enterTextMode(): void {
        enterTextModeAction(this.buildAnnotationModeActionAccess());
    }

    exitTextMode(): void {
        exitTextModeAction(this.buildAnnotationModeActionAccess());
    }

    isTextMode(): boolean {
        return this.textSession !== null;
    }

    createTextAnnotation(config: TextAnnotationConfig = {}): TextAnnotationObject | null {
        return createTextAnnotationAction(this.buildAnnotationModeActionAccess(), config);
    }

    enterDrawMode(): void {
        enterDrawModeAction(this.buildAnnotationModeActionAccess());
    }

    exitDrawMode(): void {
        exitDrawModeAction(this.buildAnnotationModeActionAccess());
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

    private buildAnnotationConfigActionAccess(): AnnotationConfigActionAccess {
        return {
            getCanvas: () => this.canvas,
            isTextMode: () => this.isTextMode(),
            isDrawMode: () => this.isDrawMode(),
            getCurrentTextConfig: () => this.currentTextConfig,
            setCurrentTextConfig: (config) => {
                this.currentTextConfig = config;
            },
            getDefaultTextConfig: () => this.defaultTextConfig,
            getCurrentDrawConfig: () => this.currentDrawConfig,
            setCurrentDrawConfig: (config) => {
                this.currentDrawConfig = config;
            },
            getDefaultDrawConfig: () => this.defaultDrawConfig,
            canRunIdleOperation: (operation) => this.canRunIdleOperation(operation),
            buildDrawControllerContext: () => this.buildDrawControllerContext(),
            buildCallbackContext: (operation, isInternalOperation) =>
                this.buildCallbackContext(operation, isInternalOperation),
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
            reportWarning: (error, message) => {
                reportWarning(this.options, error, message);
            },
            updateInputs: () => {
                this.updateInputs();
            },
            updateUi: () => {
                this.updateUi();
            },
            emitImageChanged: (context) => {
                this.emitImageChanged(context);
            },
        };
    }

    private applyTextConfigPatch(
        config: TextAnnotationConfig,
        operation: ImageEditorOperation,
    ): void {
        applyTextConfigPatchAction(this.buildAnnotationConfigActionAccess(), config, operation);
    }

    private applyDrawConfigPatch(config: DrawConfig, operation: ImageEditorOperation): void {
        applyDrawConfigPatchAction(this.buildAnnotationConfigActionAccess(), config, operation);
    }

    private applyTextColorInput(color: string): void {
        applyTextColorInputAction(this.buildAnnotationConfigActionAccess(), color);
    }

    private applyTextFontSizeInput(size: number): void {
        applyTextFontSizeInputAction(this.buildAnnotationConfigActionAccess(), size);
    }

    private applyDrawColorInput(color: string): void {
        applyDrawColorInputAction(this.buildAnnotationConfigActionAccess(), color);
    }

    private applyDrawBrushSizeInput(size: number): void {
        applyDrawBrushSizeInputAction(this.buildAnnotationConfigActionAccess(), size);
    }

    private moveSelectedEditableObject(operation: ImageEditorOperation): void {
        if (!this.canvas) return;
        if (!this.canRunIdleOperation(operation)) return;
        moveSelectedEditableObjectImpl(this.buildEditableObjectActionAccess(), operation);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PUBLIC — merge / export / download
    // ═══════════════════════════════════════════════════════════════════════

    private buildExportActionAccess(): ExportActionAccess {
        return {
            getCanvas: () => this.canvas,
            getAnnotations: () => this.getAnnotations(),
            getMasks: () => this.getMasks(),
            canRunIdleOperation: (operation, options) =>
                this.canRunIdleOperation(operation, options),
            assertIdleForOperation: (operation, options) => {
                this.assertIdleForOperation(operation, options);
            },
            finalizeActiveTextEditingIfNeeded: () => {
                this.finalizeActiveTextEditingIfNeeded();
            },
            buildExportServiceContext: () => this.buildExportServiceContext(),
            buildMergeMasksContext: (token) => this.buildMergeMasksContext(token),
            buildMergeAnnotationsContext: (token) => this.buildMergeAnnotationsContext(token),
            buildBusyOperationAccess: () => this.buildBusyOperationAccess(),
            updateInputs: () => {
                this.updateInputs();
            },
            updateMaskList: () => {
                this.updateMaskList();
            },
            updateAnnotationList: () => {
                this.updateAnnotationList();
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

    /**
     * Bakes all current masks into the base image and records one history entry.
     * Resolves without mutation while an animation or incompatible tool mode is active.
     */
    async mergeMasks(): Promise<void> {
        await mergeMasksAction(this.buildExportActionAccess());
    }

    /** Triggers a browser download, or no-ops while guarded operations are active. */
    async downloadImage(options?: ImageExportOptions): Promise<void> {
        await downloadImageAction(this.buildExportActionAccess(), options);
    }

    /**
     * Exports the canvas as a Base64 data URL.
     * Returns `''` when no image is loaded or the operation is currently guarded.
     */
    async exportImageBase64(options?: ImageExportOptions): Promise<string> {
        return await exportImageBase64Action(this.buildExportActionAccess(), options);
    }

    /**
     * Exports the canvas as a browser `File`.
     * Rejects when the operation is guarded because `Promise<File>` has no no-op value.
     */
    async exportImageFile(options?: ImageExportOptions): Promise<File> {
        return await exportImageFileAction(this.buildExportActionAccess(), options);
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
        return captureSnapshotAction(this.buildEditorStateActionAccess());
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PUBLIC — mosaic mode
    // ═══════════════════════════════════════════════════════════════════════

    private buildMosaicActionAccess(): MosaicActionAccess {
        return {
            getCanvas: () => this.canvas,
            getOriginalImage: () => this.originalImage,
            getMosaicSession: () => this.mosaicSession,
            getMosaicConfig: () => this.currentMosaicConfig,
            setMosaicConfig: (config) => {
                this.currentMosaicConfig = config;
            },
            getDefaultMosaicConfig: () => this.defaultMosaicConfig,
            getOptions: () => this.options,
            isDisposed: () => this.isDisposed,
            isImageLoaded: () => this.isImageLoaded(),
            canRunIdleOperation: (operation) => this.canRunIdleOperation(operation),
            buildMosaicControllerContext: () => this.buildMosaicControllerContext(),
            buildCallbackContext: (operation, isInternalOperation) =>
                this.buildCallbackContext(operation, isInternalOperation),
            updateInputs: () => {
                this.updateInputs();
            },
            updateUi: () => {
                this.updateUi();
            },
            emitImageChanged: (context) => {
                this.emitImageChanged(context);
            },
            emitBusyChangeIfChanged: (context) => {
                this.emitBusyChangeIfChanged(context);
            },
        };
    }

    enterMosaicMode(): void {
        enterMosaicModeAction(this.buildMosaicActionAccess());
    }

    exitMosaicMode(): void {
        exitMosaicModeAction(this.buildMosaicActionAccess());
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
        resetMosaicConfigAction(this.buildMosaicActionAccess());
    }

    setMosaicBrushSize(size: number): void {
        this.applyMosaicConfigPatch({ brushSize: size }, 'setMosaicBrushSize');
    }

    setMosaicBlockSize(size: number): void {
        this.applyMosaicConfigPatch({ blockSize: size }, 'setMosaicBlockSize');
    }

    private applyMosaicConfigPatch(config: MosaicConfig, operation: ImageEditorOperation): void {
        applyMosaicConfigPatchAction(this.buildMosaicActionAccess(), config, operation);
    }

    private buildMosaicControllerContext(): MosaicControllerContext {
        return this.contextFactory.buildMosaicControllerContext();
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PUBLIC — crop mode
    // ═══════════════════════════════════════════════════════════════════════

    private buildCropActionAccess(): CropActionAccess {
        return {
            getCanvas: () => this.canvas,
            getOriginalImage: () => this.originalImage,
            getCropSession: () => this.cropSession,
            setCropSession: (session) => {
                this.cropSession = session;
            },
            isImageLoaded: () => this.isImageLoaded(),
            canRunIdleOperation: (operation) => this.canRunIdleOperation(operation),
            buildCropControllerContext: (token) => this.buildCropControllerContext(token),
            buildBusyOperationAccess: () => this.buildBusyOperationAccess(),
            buildCallbackContext: (operation, isInternalOperation) =>
                this.buildCallbackContext(operation, isInternalOperation),
            getMasks: () => this.getMasks(),
            updateInputs: () => {
                this.updateInputs();
            },
            updateMaskList: () => {
                this.updateMaskList();
            },
            updateUi: () => {
                this.updateUi();
            },
            emitMasksChanged: (context) => {
                this.emitMasksChanged(context);
            },
            emitImageChanged: (context) => {
                this.emitImageChanged(context);
            },
            emitBusyChangeIfChanged: (context) => {
                this.emitBusyChangeIfChanged(context);
            },
        };
    }

    /**
     * Enters crop mode and adds the interactive crop rectangle.
     * No-ops while an animation or another incompatible operation is active.
     */
    enterCropMode(options: CropModeOptions = {}): void {
        enterCropModeAction(this.buildCropActionAccess(), options);
    }

    /** Updates the active crop rectangle's aspect ratio, or no-ops outside crop mode. */
    setCropAspectRatio(aspectRatio: CropAspectRatio): void {
        setCropAspectRatioAction(this.buildCropActionAccess(), aspectRatio);
    }

    /** Cancels crop mode without applying the crop or pushing history. */
    cancelCrop(): void {
        cancelCropAction(this.buildCropActionAccess());
    }

    /**
     * Applies the current crop rectangle and records one history entry.
     * Guarded no-ops leave the open crop session intact for a later retry.
     */
    async applyCrop(): Promise<void> {
        await applyCropAction(this.buildCropActionAccess());
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
        await mergeAnnotationsAction(this.buildExportActionAccess());
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

        // (5) Drop active tool sessions best-effort. Fabric may already
        //     have disposed session objects during a rollback.
        safelyExitActiveSession(
            this.cropSession !== null,
            this.canvas,
            () => cancelCropImpl(this.buildCropControllerContext()),
            () => {
                this.cropSession = null;
            },
        );
        safelyExitActiveSession(
            this.mosaicSession !== null,
            this.canvas,
            () => exitMosaicModeImpl(this.buildMosaicControllerContext()),
            () => {
                this.mosaicSession = null;
            },
        );
        safelyExitActiveSession(
            this.textSession !== null,
            this.canvas,
            () => exitTextModeImpl(this.buildTextControllerContext()),
            () => {
                this.textSession = null;
            },
        );
        safelyExitActiveSession(
            this.drawSession !== null,
            this.canvas,
            () => exitDrawModeImpl(this.buildDrawControllerContext()),
            () => {
                this.drawSession = null;
            },
        );

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
