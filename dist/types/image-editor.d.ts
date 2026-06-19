/**
 * @author Ben Situ
 * @license MIT
 * Lightweight canvas-based image editor built on Fabric.js v7.
 * Provides masks, annotations, animated transforms, crop, mosaic, undo/redo,
 * serialization, and export.
 *
 * @module
 */
import type { CanvasJson } from './core/state-serializer.js';
import type { AnnotationObject, AnnotationUpdateConfig, CropAspectRatio, CropModeOptions, DrawConfig, ElementIdMap, FabricModule, ImageEditorOptions, ImageExportOptions, LayoutMode, LoadImageOptions, MaskConfig, MaskObject, MosaicConfig, RemoveAllAnnotationsOptions, RemoveAllMasksOptions, ResolvedDrawConfig, ResolvedMosaicConfig, ResolvedTextAnnotationConfig, TextAnnotationConfig, TextAnnotationObject } from './core/public-types.js';
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
export declare class ImageEditor {
    private fabricModule;
    private isFabricLoaded;
    private readonly options;
    private currentLayoutMode;
    private readonly defaultMosaicConfig;
    private currentMosaicConfig;
    private readonly defaultTextConfig;
    private currentTextConfig;
    private readonly defaultDrawConfig;
    private currentDrawConfig;
    private canvas;
    private canvasElement;
    private containerElement;
    private placeholderElement;
    private elements;
    private readonly elementOriginalDisabledMap;
    private readonly elementOriginalAriaDisabledMap;
    private readonly elementOriginalPointerEventsMap;
    private originalImage;
    private baseImageScale;
    private currentScale;
    private currentRotation;
    private isImageLoadedToCanvas;
    private currentImageMimeType;
    private maskCounter;
    private lastMask;
    private annotationCounter;
    private lastSnapshot;
    private readonly historyManager;
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
    private readonly operationGuard;
    private readonly animQueue;
    /**
     * Owns animated `scaleImage`, `rotateImage`, and
     * `resetImageTransform`. The facade enqueues each public method on
     * {@link animQueue} and the controller drives
     * the per-Fabric-animation `runAnimation` bracket through
     * {@link operationGuard}. The controller is constructed in {@link init}
     * once `canvas` is available so its `TransformContext` can hold a
     * stable Fabric canvas reference.
     */
    private transformController;
    private readonly contextFactory;
    /**
     * Hidden-container viewport cache shared across `loadImage` calls. Owned
     * by the facade so the layout manager can reuse the last visible
     * measurement when the editor is hidden inside a tab, modal, or
     * accordion.
     */
    private readonly viewportCache;
    /**
     * Live crop session pointer owned by the facade. The crop controller
     * (`crop/crop-controller.ts`) reads and writes this slot through the
     * `getCropSession`/`setCropSession` callbacks bundled into the
     * controller's context, so the controller has no class state of its
     * own and multiple editors on the same page do not share crop state.
     */
    private cropSession;
    private mosaicSession;
    private textSession;
    private drawSession;
    /**
     * Managed registry of DOM event listeners owned by this editor.
     *
     * Constructed lazily by {@link init} so the registry can read the
     * editor's `isDisposed` flag through a closure that captures `this`.
     * `dispose` drains the registry via {@link DomBindings.removeAll}
     * and the wrapped handlers exit early while
     * `isDisposed === true`.
     */
    private domBindings;
    private keyboardDocument;
    private keyboardHandler;
    private isDisposed;
    /**
     * When `true`, {@link saveState} is a no-op.  Used by
     * {@link resetImageTransform} (via the transform controller) to
     * suppress the intermediate history entries from {@link scaleImage}
     * and {@link rotateImage} so the entire reset is a single undoable
     * step.
     */
    private shouldSuppressSaveState;
    private lastEmittedIsBusy;
    private activeStateRestoreOperation;
    private nextSelectionChangeContext;
    /**
     * Creates a new image editor instance.
     *
     * Accepts ESM (`new ImageEditor(fabric, options?)`) and UMD/CDN
     * (`new ImageEditor(options?)`) forms. Fabric detection and option
     * normalization are delegated to the adapter/resolver modules.
     */
    constructor(fabricModuleOrOptions?: FabricModule | ImageEditorOptions, options?: ImageEditorOptions);
    private createContextFactory;
    /** Initializes DOM bindings, canvas state, and the optional initial image. */
    init(idMap?: ElementIdMap): void;
    private initCanvas;
    private getLiveCanvasOrThrow;
    private bindDomEvents;
    private bindKeyboardEvents;
    private handleKeyboardEvent;
    private finalizeActiveTextEditingIfNeeded;
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
    private loadImageFile;
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
    loadImage(base64: string, options?: LoadImageOptions): Promise<void>;
    private loadImageInternal;
    private getInternalOperationToken;
    private canRunDuringAnimationQueue;
    private withInternalOperationOptions;
    private withAnimationQueueBypass;
    private assertIdleForOperation;
    private canRunIdleOperation;
    private getSelectedCropAspectRatio;
    private isExpectedIdleGuardError;
    private assertCanQueueAnimation;
    /**
     * Returns `true` if a valid image is currently loaded on the canvas.
     */
    isImageLoaded(): boolean;
    /**
     * Returns `true` while the editor is loading, animating, or in crop mode.
     */
    isBusy(): boolean;
    /**
     * Selects the layout strategy used by subsequent image loads.
     *
     * The current canvas is not re-laid out immediately; call this before
     * `loadImage()` to choose how the next image is placed.
     *
     * @param mode - Layout mode to use for future image loads.
     */
    setLayoutMode(mode: LayoutMode): void;
    private getRuntimeOptions;
    private buildCallbackContext;
    private buildBusyOperationAccess;
    private getOperationContext;
    private emitOptionCallback;
    private getImageInfo;
    private getMasks;
    getAnnotations(): AnnotationObject[];
    private getMaskCollectionSignature;
    private getAnnotationCollectionSignature;
    private buildToolModeSnapshot;
    private getActiveToolMode;
    private isToolModeActive;
    private getEditorState;
    private emitImageChanged;
    private emitMasksChanged;
    private emitAnnotationsChanged;
    private emitBusyChangeIfChanged;
    private buildSelection;
    private withSelectionChangeContext;
    private isSupportedImageMimeType;
    private inferCurrentImageMimeType;
    /**
     * Atomically resize the Fabric canvas. Routes through
     * {@link applyCanvasDimensions} so the canvas's lower (render) and
     * upper (event) layers stay in sync and the surrounding container is
     * reflowed before the next paint — matching the contract enforced
     * across the rest of the layout pipeline (see
     * `image/layout-manager.ts`).
     */
    private setCanvasSizePx;
    /**
     * Re-align an object so its bounding-box top-left maps to the
     * object's `(left, top)` reference. Used by the transform pipeline's
     * `afterTransformSnap` hook to absorb floating-point drift on the
     * final animation tick.
     */
    private alignObjectBoundingBoxToCanvasTopLeft;
    private buildDisplayGeometryContext;
    private measureLayoutViewport;
    private getScrollbarStableViewportCanvasSize;
    /**
     * Resize the canvas to fit the transformed image bounds. Used by the
     * transform pipeline's `afterTransformSnap` hook so a post-rotation/scale
     * image that exceeds the viewport gets a real scroll range.
     */
    private updateCanvasSizeToImageBounds;
    private shouldNormalizeCanvasSizeAfterStateRestore;
    private settleFitCoverScrollbarsAfterStateRestore;
    private captureImageDisplayGeometry;
    private restoreMergedImageDisplayGeometry;
    /** Builds the transform controller context from facade-owned runtime state. */
    private buildTransformContext;
    private buildTransformActionAccess;
    /** Animates the image to the given scale factor, clamped to configured limits. */
    scaleImage(factor: number): Promise<void>;
    /** Animates the image to the given rotation angle. Non-finite input no-ops. */
    rotateImage(degrees: number): Promise<void>;
    flipHorizontal(): Promise<void>;
    flipVertical(): Promise<void>;
    /** Resets scale, rotation, and flip state as one undoable transform. */
    resetImageTransform(): Promise<void>;
    private refreshUiAfterQueuedAnimation;
    private buildEditorStateActionAccess;
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
    loadFromState(jsonString: string | CanvasJson): Promise<void>;
    private loadFromStateInternal;
    /**
     * Captures the current canvas state into the undo/redo history.
     * Called automatically after transforms, mask operations, and crop.
     */
    saveState(): void;
    private saveStateInternal;
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
    undo(): Promise<void>;
    /**
     * Redoes the next recorded action.
     *
     * Same serialization and dispose guarantees as {@link undo}.
     */
    redo(): Promise<void>;
    private buildMaskActionAccess;
    /** Creates and adds a mask shape, returning `null` when the operation cannot run. */
    createMask(config?: MaskConfig): MaskObject | null;
    /** Removes the currently selected mask and its label. */
    removeSelectedMask(): void;
    /** Removes all masks and labels, or no-ops while guarded operations are active. */
    removeAllMasks(options?: RemoveAllMasksOptions): void;
    /**
     * Build the {@link CreateMaskContext} the mask factory reads/writes
     * through. The facade is the single owner of `maskCounter`,
     * `lastMask`, the canvas, and `saveState`, so the context's
     * accessors all bind back to `this` rather than duplicating state.
     */
    private buildCreateMaskContext;
    /**
     * Build the {@link RemoveMaskContext} the mask factory reads/writes
     * through for `removeSelectedMask` / `removeAllMasks`. The facade
     * is the single owner of the canvas, mask label DOM, mask list
     * DOM, history, and `lastMask`, so the context's accessors bind
     * back to `this`.
     */
    private buildRemoveMaskContext;
    private buildMaskLabelContext;
    private removeLabelForMask;
    private createLabelForMask;
    private hideAllMaskLabels;
    private syncMaskLabel;
    private showLabelForMask;
    private buildSelectionControllerAccess;
    private handleObjectMovingScalingRotating;
    private handleObjectModified;
    private handleSelectionChanged;
    private buildMaskListContext;
    private updateMaskList;
    private updateMaskListSelection;
    private buildAnnotationModeActionAccess;
    enterTextMode(): void;
    exitTextMode(): void;
    isTextMode(): boolean;
    createTextAnnotation(config?: TextAnnotationConfig): TextAnnotationObject | null;
    enterDrawMode(): void;
    exitDrawMode(): void;
    isDrawMode(): boolean;
    getTextConfig(): Readonly<ResolvedTextAnnotationConfig>;
    setTextConfig(config: TextAnnotationConfig): void;
    resetTextConfig(): void;
    setTextColor(color: string): void;
    setTextFontSize(size: number): void;
    getDrawConfig(): Readonly<ResolvedDrawConfig>;
    setDrawConfig(config: DrawConfig): void;
    resetDrawConfig(): void;
    setDrawColor(color: string): void;
    setDrawBrushSize(size: number): void;
    private buildEditableObjectActionAccess;
    removeSelectedAnnotation(): void;
    removeAllAnnotations(options?: RemoveAllAnnotationsOptions): void;
    updateAnnotation(annotationId: number, config: AnnotationUpdateConfig): void;
    updateSelectedAnnotation(config: AnnotationUpdateConfig): void;
    deleteSelectedObject(): void;
    bringSelectedObjectForward(): void;
    sendSelectedObjectBackward(): void;
    bringSelectedObjectToFront(): void;
    sendSelectedObjectToBack(): void;
    private buildAnnotationManagerContext;
    private buildAnnotationListContext;
    private updateAnnotationList;
    private updateAnnotationListSelection;
    private buildTextControllerContext;
    private buildDrawControllerContext;
    private buildAnnotationConfigActionAccess;
    private applyTextConfigPatch;
    private applyDrawConfigPatch;
    private applyTextColorInput;
    private applyTextFontSizeInput;
    private applyDrawColorInput;
    private applyDrawBrushSizeInput;
    private moveSelectedEditableObject;
    private buildExportActionAccess;
    /**
     * Bakes all current masks into the base image and records one history entry.
     * Resolves without mutation while an animation or incompatible tool mode is active.
     */
    mergeMasks(): Promise<void>;
    /** Triggers a browser download, or no-ops while guarded operations are active. */
    downloadImage(options?: ImageExportOptions): Promise<void>;
    /**
     * Exports the canvas as a Base64 data URL.
     * Returns `''` when no image is loaded or the operation is currently guarded.
     */
    exportImageBase64(options?: ImageExportOptions): Promise<string>;
    /**
     * Exports the canvas as a browser `File`.
     * Rejects when the operation is guarded because `Promise<File>` has no no-op value.
     */
    exportImageFile(options?: ImageExportOptions): Promise<File>;
    /**
     * Build the {@link ExportServiceContext} the export service reads
     * through. The facade is the single owner of the canvas, options,
     * and the `originalImage` reference.
     */
    private buildExportServiceContext;
    /**
     * Build the {@link MergeMasksContext} the merge pipeline reads
     * through. Extends the export-service context with the history
     * manager, container element, transactional `loadImage`, and the
     * `saveState`/`loadFromState`/`removeAllMasksNoHistory` callbacks
     * the merge needs.
     */
    private buildMergeMasksContext;
    private buildMergeAnnotationsContext;
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
    private captureSnapshotInternal;
    private buildMosaicActionAccess;
    enterMosaicMode(): void;
    exitMosaicMode(): void;
    isMosaicMode(): boolean;
    getMosaicConfig(): Readonly<ResolvedMosaicConfig>;
    setMosaicConfig(config: MosaicConfig): void;
    resetMosaicConfig(): void;
    setMosaicBrushSize(size: number): void;
    setMosaicBlockSize(size: number): void;
    private applyMosaicConfigPatch;
    private buildMosaicControllerContext;
    private buildCropActionAccess;
    /**
     * Enters crop mode and adds the interactive crop rectangle.
     * No-ops while an animation or another incompatible operation is active.
     */
    enterCropMode(options?: CropModeOptions): void;
    /** Updates the active crop rectangle's aspect ratio, or no-ops outside crop mode. */
    setCropAspectRatio(aspectRatio: CropAspectRatio): void;
    /** Cancels crop mode without applying the crop or pushing history. */
    cancelCrop(): void;
    /**
     * Applies the current crop rectangle and records one history entry.
     * Guarded no-ops leave the open crop session intact for a later retry.
     */
    applyCrop(): Promise<void>;
    /**
     * Build the {@link CropControllerContext} the crop controller reads
     * through. The facade is the single owner of the live crop session
     * pointer (`cropSession`), the canvas, the resolved options, the
     * history manager, and the transactional loader, so the context's
     * accessors all bind back to `this`.
     */
    private buildCropControllerContext;
    private updateInputs;
    mergeAnnotations(): Promise<void>;
    private updateUi;
    private buildControlSnapshot;
    private buildControlElementContext;
    private setControlEnabled;
    private restoreElementOriginalStates;
    private updatePlaceholderStatus;
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
    dispose(): void;
}
//# sourceMappingURL=image-editor.d.ts.map