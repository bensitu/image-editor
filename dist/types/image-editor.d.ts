/**
 * @author Ben Situ
 * @license MIT
 * Lightweight canvas-based image editor built on Fabric.js v7.
 * Provides masking, animated scale/rotate, crop, undo/redo, and export.
 *
 * @module
 */
import { type CanvasJson } from './core/state-serializer.js';
import type { Base64ExportOptions, ElementIdMap, FabricModule, ImageEditorOptions, ImageFileExportOptions, LayoutMode, LoadImageOptions, MaskConfig, MaskObject, RemoveAllMasksOptions } from './core/public-types.js';
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
    constructor(fabricModuleOrOptions?: FabricModule | ImageEditorOptions, options?: ImageEditorOptions);
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
    init(idMap?: ElementIdMap): void;
    private initCanvas;
    private bindDomEvents;
    private bindElementIfExists;
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
     * @param base64 - Data URL string starting with `data:image/…`.
     * @param options - Optional {@link LoadImageOptions}; currently only
     *                `preserveScroll` is consulted.
     * @returns A promise that resolves once the image is on the canvas, or
     *          rejects with the original error after a transactional
     *          rollback. Non-data:image inputs and Fabric-unavailable /
     *          disposed states resolve without observable mutation.
     */
    loadImage(base64: string, options?: LoadImageOptions): Promise<void>;
    private getInternalOperationToken;
    private canRunDuringAnimationQueue;
    private withInternalOperationOptions;
    private withAnimationQueueBypass;
    private assertIdleForOperation;
    private canRunIdleOperation;
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
    private buildCallbackContext;
    private getOperationContext;
    private emitOptionCallback;
    private getImageInfo;
    private getMasks;
    private getMaskCollectionSignature;
    private getEditorState;
    private emitImageChanged;
    private emitMasksChanged;
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
    private measureLayoutViewport;
    /**
     * Resize the canvas to fit the transformed image bounds. Used by the
     * transform pipeline's `afterTransformSnap` hook so a post-rotation/scale
     * image that exceeds the viewport gets a real scroll range.
     */
    private updateCanvasSizeToImageBounds;
    private shouldNormalizeCanvasSizeAfterStateRestore;
    private captureImageDisplayGeometry;
    private restoreMergedImageDisplayGeometry;
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
    private buildTransformContext;
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
    scaleImage(factor: number): Promise<void>;
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
    rotateImage(degrees: number): Promise<void>;
    /**
     * Resets the image to scale `1` and rotation `0` (animated) and
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
    resetImageTransform(): Promise<void>;
    private refreshUiAfterQueuedAnimation;
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
    private restoreActiveMaskAfterSnapshot;
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
    createMask(config?: MaskConfig): MaskObject | null;
    /**
     * Removes the currently selected mask (and its label).
     *
     * Delegates to {@link removeSelectedMask} in `mask/mask-factory.ts`,
     * which removes the active mask, clears the canvas selection,
     * re-renders the mask list DOM, and pushes a single history entry.
     */
    removeSelectedMask(): void;
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
    private handleSelectionChanged;
    private buildMaskListContext;
    private updateMaskList;
    private updateMaskListSelection;
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
    mergeMasks(): Promise<void>;
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
     * @param fileName - Filename for the downloaded file.
     *   @default `options.defaultDownloadFileName`
     */
    downloadImage(fileName?: string): void;
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
    exportImageBase64(options?: Base64ExportOptions): Promise<string>;
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
     * const file = await editor.exportImageFile({ fileType: 'png', mergeMask: false});
     * const formData = new FormData;
     * formData.append('image', file);
     * ```
     */
    exportImageFile(options?: ImageFileExportOptions): Promise<File>;
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
    private getActiveMaskForSnapshot;
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
    enterCropMode(): void;
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
    cancelCrop(): void;
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
    private updateUi;
    private setControlEnabled;
    private recordElementOriginalState;
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