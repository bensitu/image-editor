/**
 * Base64, file, and download entry points for the current export
 * pipeline. The orchestrator (`image-editor.ts`) delegates
 * `exportImageBase64`, `exportImageFile`, and `downloadImage`
 * to the helpers in this module so the export logic lives in
 * a single owner module per the documented module-decomposition
 * table.
 *
 * ## Owned contracts
 *
 * - Before computing the export region, every
 *   export entry point SHALL discard any active Fabric `ActiveSelection`
 *   so it is not serialized into the output. The discard is performed
 *   unconditionally; calling `canvas.discardActiveObject` with no active
 *   selection is a documented no-op.
 * - `exportImageBase64(options?: ImageExportOptions)`
 *   is the canonical base64 export entry point. It accepts both
 *   `fileType` and `format` for ergonomic interop and returns a
 *   `Promise<string>` resolving to a `data:image/...;base64...` data URL.
 * - `exportImageFile(options?: ImageExportOptions)` resolves to a `File`
 *   whose name comes from `options.fileName` or the editor's
 *   `defaultDownloadFileName`, with the final extension resolved from
 *   the output format.
 * - `downloadImage(options?: ImageExportOptions)` triggers a browser
 *   download through a generated object URL. The bytes match the same
 *   rendering core used by `exportImageBase64` and `exportImageFile`.
 * - When `isImageLoaded` is `false`, the three
 *   entry points exhibit the documented "no image loaded" shapes:
 *
 *   | entry point          | shape on no image                   |
 *   | -------------------- | ----------------------------------- |
 *   | `exportImageBase64`  | rejects with `ExportNotReadyError`  |
 *   | `exportImageFile`    | rejects with `ExportNotReadyError`  |
 *   | `downloadImage`      | resolves without throwing           |
 *
 * Each path reports a single warning naming the missing image through
 * the public `onWarning` callback so consumers can route diagnostics
 * consistently.
 * - When `exportArea` resolves
 *   to `'image'` and a valid `originalImage` exists, the export region is
 *   computed from `originalImage.getBoundingRect` and passed directly
 *   as `left`/`top`/`width`/`height` to Fabric's `toDataURL` options.
 *   Sub-pixel width/height values are floored to integer pixels through
 *   the {@link floorRegion} helper before Fabric receives the region.
 *   Offscreen canvas post-processing is reserved for partial-edge
 *   sealing and JPEG background compositing.
 * - When `mergeMasks` is
 *   `true`, every mask's live style (`opacity`, `fill`, `stroke`,
 *   `strokeWidth`, `selectable`, `lockRotation`) is captured BEFORE the
 *   mutator forces the bake-in style (`opacity: 1, fill: '#000',
 *   strokeWidth: 0, stroke: null, selectable: false`) and restored
 *   inside a `finally` block whether the inner render resolved or
 *   rejected. The backup/restore bracket is owned by
 *   {@link withMaskStyleBackup} in `mask/mask-style.ts`; this module
 *   only contributes the bake-in mutator.
 * - **mergeMasks pre-export** — Before computing the merged
 *   bitmap, {@link mergeMasks} discards any active Fabric
 *   `ActiveSelection`. {@link exportImageBase64} also discards on its
 *   own entry, so the discard runs at most twice (both calls are
 *   idempotent no-ops when nothing is selected).
 * - **mergeMasks atomicity** —
 *   {@link mergeMasks} is the canonical merge entry point
 *   (`Promise<void>`). It captures a pre-merge snapshot suitable for
 *   `loadFromState`, renders the merged bitmap via
 *   {@link exportImageBase64}, removes every mask without history,
 *   reloads the merged data URL through the transactional
 *   `image/image-loader.ts`, and on success pushes exactly one
 *   {@link Command} whose `undo` restores the pre-merge snapshot and
 *   whose `execute` re-applies the merged image. On any failure
 *   between snapshot capture and history push, the pre-merge snapshot
 *   is restored and the promise rejects with
 *   {@link MergeMasksError}. Container scroll position is preserved
 *   across the success path (canonically via
 *   `loadImage(..., { preserveScroll: true})`, with a defensive
 *   restore at the tail of the merge).
 *
 * ## Why a service-shaped module
 *
 * Per the documented "Mapping Contracts to modules" table the export
 * pipeline owns its own module so the orchestrator stays thin. The
 * service is a stateless function-collection (matching
 * `image/image-loader.ts` and `core/state-serializer.ts`) and reads every
 * editor field through an explicit {@link ExportServiceContext} bundle.
 * This keeps the orchestrator authoritative for editor state — the export
 * helpers never store a reference to the canvas or options between
 * invocations — and makes the module trivially mockable from unit and
 * property tests.
 *
 * The module is intentionally NOT re-exported from `src/index.ts`
 * (only `ImageEditor`, `isMaskObject`, and the
 * documented public types are root-exported).
 *
 * @module
 */
import type * as FabricNS from 'fabric';
import type { FabricModule, ImageExportOptions, LoadImageOptions, AnnotationObject, MaskObject, ResolvedOptions } from '../core/public-types.js';
import type { LegacyHistoryPort } from '../history/history-port.js';
import { type OverlayMergeTransactionContext } from './overlay-merge-service.js';
/**
 * Dependency bundle passed by the `ImageEditor` facade into every export
 * entry point. The service has no class state of its own — every editor
 * field it reads is exposed here as a value or callback so the facade
 * keeps ownership of the canonical state.
 *
 * Mirrors the shape of {@link import('../image/image-loader.js').LoadImageContext}
 * for consistency across pipeline modules.
 *
 * @see image/image-loader.ts (the same context-bundle pattern)
 */
export interface ExportServiceContext {
    /** The Fabric module providing `Canvas` / `FabricImage`. */
    readonly fabric: FabricModule;
    /** The live Fabric canvas. Always non-null on a constructed editor. */
    readonly canvas: FabricNS.Canvas;
    /** Resolved editor options — supplies `defaultDownloadFileName`,
     *  `downsampleQuality`, `exportMultiplier`, and
     *  `exportAreaByDefault`. */
    readonly options: ResolvedOptions;
    /**
     * Predicate matching `ImageEditor.isImageLoaded`. Returns `true`
     * only when an `originalImage` has been committed and has positive
     * dimensions (reads through this gate).
     */
    isImageLoaded(): boolean;
    /**
     * The currently committed `originalImage`, or `null` when no image is
     * loaded. {@link computeExportRegion} reads it through this callback
     * to derive the floored bounding box for image-area
     * exports. When the image has been disposed or
     * never loaded the seam falls through to a full-canvas export.
     */
    getOriginalImage(): FabricNS.FabricImage | null;
    /**
     * Run export-only selection teardown/restoration without emitting public
     * selection lifecycle callbacks.
     */
    withSelectionChangeSuppressed?<T>(callback: () => Promise<T>): Promise<T>;
}
/**
 * Render the live canvas to a base64 data URL.
 *
 * Steps, in order:
 *
 * 1. **No-image gate** — when `context.isImageLoaded`
 *    is `false`, report an `onWarning` and throw `ExportNotReadyError`
 *    without touching the canvas.
 * 2. **Discard ActiveSelection** — call
 *    `canvas.discardActiveObject` once before computing the export
 *    region. Subsequent steps render against the post-discard canvas
 *    state, which never carries a top-level `ActiveSelection`.
 * 3. **Resolve format/quality**
 *    via {@link resolveExportFormat}.
 * 4. **Resolve multiplier** — `options.multiplier || exportMultiplier || 1`.
 * 5. **Compute region** — see {@link computeExportRegion}. Returns
 *    `null` for full-canvas exports and a floored {@link IntegerRegion}
 *    when `exportArea` is `'image'` and an `originalImage` is
 *    committed.
 * 6. **Render** through {@link withMaskExportState} so mask styles are
 *    captured, the export bake-in (`opacity: 1, fill: '#000',
 *    strokeWidth: 0, stroke: null, selectable: false`) is applied for
 *    `mergeMasks === true` exports, and the live styles are
 *    restored in a `finally` block whether the render resolved or
 *    threw. The inner step is a single
 *    `canvas.toDataURL` call — no intermediate `<canvas>`.
 *
 * @param context - Export context bundle.
 * @param options - Optional {@link ImageExportOptions}. Both `fileType`
 *                 and `format` are accepted; when
 *                 both are supplied, `fileType` wins.
 * @returns        Resolves to a `data:image/...;base64...` URL on
 *                 success.
 *
 */
export declare function exportImageBase64(context: ExportServiceContext, options?: ImageExportOptions): Promise<string>;
/**
 * Render the live canvas to a `File`.
 *
 * The bytes come from the same private rendering core used by
 * {@link exportImageBase64}. The resulting data URL is repainted
 * through an offscreen `<canvas>` only
 * when its MIME prefix does not match the requested type — some browsers
 * silently fall back to PNG when the requested format is unsupported,
 * and the export contract requires the output MIME to match the resolved
 * `fileType`.
 *
 * @param context - Export context bundle.
 * @param options - Optional {@link ImageExportOptions}.
 * @returns        Resolves with the rendered `File`.
 * @throws         {@link ExportNotReadyError} when no image is loaded.
 *
 */
export declare function exportImageFile(context: ExportServiceContext, options?: ImageExportOptions): Promise<File>;
/**
 * Trigger a browser download of the live canvas.
 *
 * Mirrors legacy's "anchor with `download` attribute" approach: a `File`
 * is rendered, an object URL is created, and an `<a>` element is appended
 * to the document so Firefox dispatches the click.
 *
 * No-image gate emits the same `onWarning` as the
 * other entry points and returns without touching the DOM.
 *
 * Errors raised by the underlying export reject the returned promise so the
 * caller can report or recover at the UI boundary.
 *
 * @param context - Export context bundle.
 * @param options - Optional {@link ImageExportOptions}.
 *
 */
export declare function downloadImage(context: ExportServiceContext, options?: ImageExportOptions): Promise<void>;
/**
 * Dependency bundle passed by the `ImageEditor` facade into
 * {@link mergeMasks}. Extends {@link ExportServiceContext} with the
 * extra slots the merge pipeline needs:
 *
 * - the {@link HistoryManager} that records the merge as one undoable
 *   step;
 * - the canonical `loadImage` entry point (transactional load with
 *   rollback) so a failed reload of the merged bitmap propagates back
 *   to the merge's own rollback path;
 * - the `saveState` / `loadFromState` callbacks the orchestrator
 *   already wires for `undo` / `redo`, so the merge can capture and
 *   restore the pre-merge snapshot through the same
 *   `core/state-serializer.ts` helpers used by the rest of the editor;
 * - a `removeAllMasks(saveHistory: false)` callback so the merge's
 *   single enclosing history entry is the only one pushed for the
 *   operation (exactly one history entry);
 * - the live container element so the success path can preserve scroll
 *   even when the inner `loadImage` did not honor `preserveScroll`.
 *
 * Mirrors the shape of `image/image-loader.ts → LoadImageContext` for
 * consistency across pipeline modules. The `ImageEditor` facade constructs
 * this bundle from its own state.
 *
 */
export interface MergeMasksContext extends ExportServiceContext, OverlayMergeTransactionContext {
    /** History manager that records the single merge command. */
    readonly historyManager: LegacyHistoryPort;
    /**
     * Scrollable container wrapping the canvas, or `null`. Read at the
     * head of `mergeMasks` so the success path can restore the captured
     * scroll position regardless of the layout
     * strategy applied by the inner `loadImage`.
     */
    readonly containerElement: HTMLElement | null;
    /**
     * Transactional image loader. The merge passes
     * `{ preserveScroll: true}` so the inner load tries to keep scroll
     * stable; the merge also restores scroll defensively at the tail of
     * the success path.
     */
    loadImage(imageBase64: string, options?: LoadImageOptions): Promise<void>;
    /**
     * Restore a snapshot produced by {@link saveStateFn}. Used both as
     * the `undo` callback of the merge command and
     * as the rollback step on any merge-pipeline failure.
     */
    loadFromState(snapshot: string): Promise<void>;
    /**
     * Remove every mask from the canvas WITHOUT pushing a history
     * entry. The merge owns the single enclosing history entry, so the
     * inner mask-removal step must opt out
     * of its own history push.
     */
    removeAllMasksNoHistory(): void;
    getAnnotations(): AnnotationObject[];
    restoreAnnotations(objects: AnnotationObject[]): void | Promise<void>;
}
export interface MergeAnnotationsContext extends ExportServiceContext, OverlayMergeTransactionContext {
    readonly historyManager: LegacyHistoryPort;
    readonly containerElement: HTMLElement | null;
    loadImage(imageBase64: string, options?: LoadImageOptions): Promise<void>;
    captureSnapshot(): string;
    loadFromState(snapshot: string): Promise<void>;
    removeAllAnnotationsNoHistory(): void;
    getMasks(): MaskObject[];
    restoreMasks(objects: MaskObject[]): void | Promise<void>;
}
/**
 * Flatten every mask into the base image and reload the flattened
 * image as the new canvas state. Atomic with respect to the editor:
 * either the merged image is committed and exactly one history entry
 * is pushed, or the editor is rewound to its pre-merge state and the
 * returned promise rejects with {@link MergeMasksError}.
 *
 * Steps, in order:
 *
 * 1. **No-op gates** — return without mutating anything when no image
 *    is loaded or when the canvas carries no mask objects (matches
 *    legacy's `if (!this.originalImage) return; … if (!masks.length) return;`).
 * 2. **Capture pre-merge snapshot** — call
 *    `context.saveState` so the snapshot is suitable for
 *    `context.loadFromState(...)`. The snapshot is the one source of
 *    truth for both the merge command's `undo` and
 *    the rollback path.
 * 3. **Discard ActiveSelection** — drop any active
 *    selection wrapper before computing the merged bitmap.
 * 4. **Capture container scroll** — read `scrollTop` / `scrollLeft`
 *    from the editor container so the success path can restore them
 *    after the inner `loadImage` runs.
 * 5. **Render the merged bitmap** — delegate to
 *    {@link exportImageBase64} with `exportArea: 'image'` and
 *    `multiplier: options.exportMultiplier`. The bake-in/restore
 *    bracket inside `exportImageBase64` ensures every live mask style
 *    is captured before the export-only style is applied and restored
 *    on both success and failure.
 * 6. **Remove all masks** without pushing history — the merge owns
 *    the single enclosing history entry, so the
 *    inner removal step providedOptions out of its own history push.
 * 7. **Reload the merged image** through the transactional
 *    `image/image-loader.ts` with `preserveScroll: true`. A failed
 *    reload propagates here so the rollback path catches it.
 * 8. **Capture post-merge snapshot** — call `context.saveState` again so
 *    the merge command's `execute` can replay the merged state on
 *    redo.
 * 9. **Restore scroll defensively** — write the
 *    captured `scrollTop` / `scrollLeft` back to the container even
 *    though the inner `loadImage` was asked to preserve scroll, so
 *    the user's view does not jump regardless of the layout strategy
 *    chosen by the loader.
 * 10. **Push exactly one history command** whose
 *    `undo` restores the pre-merge snapshot via `context.loadFromState`
 *    and whose `execute` re-applies the merged snapshot via
 *    `context.loadFromState`. The command is pushed via
 *    {@link HistoryManager.push} (NOT `execute`) because the merged
 *    state is already on the canvas — the first `redo` call should
 *    re-run the merged-state restore, but the initial commit should
 *    not double-render.
 *
 * On any failure between step 3 and step 10, the pre-merge snapshot
 * captured in step 3 is restored via `context.loadFromState` and the
 * promise rejects with {@link MergeMasksError} wrapping the original
 * cause. A failure inside the rollback itself is reported via
 * `onWarning` but does not mask the original error.
 *
 * @param context - Editor dependency bundle — see {@link MergeMasksContext}.
 * @returns   Resolves on success; rejects with
 *            {@link MergeMasksError} on any pipeline failure (after
 *            the pre-merge snapshot has been restored).
 *
 */
export declare function mergeMasks(context: MergeMasksContext): Promise<void>;
export declare function mergeAnnotations(context: MergeAnnotationsContext): Promise<void>;
