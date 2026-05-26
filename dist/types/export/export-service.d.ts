/**
 * @file export/export-service.ts
 * @description Base64, file, and download entry points for the v2 export
 *              pipeline. The orchestrator (`image-editor.ts`) delegates
 *              `exportImageBase64`, `exportImageFile`, and `downloadImage`
 *              to the helpers in this module so the export logic lives in
 *              a single owner module per the design's module-decomposition
 *              table.
 *
 * ## Owned contracts (this task — 18.4 builds on 18.3)
 *
 * - Before computing the export region, every
 *   export entry point SHALL discard any active Fabric `ActiveSelection`
 *   so it is not serialized into the output. The discard is performed
 *   unconditionally; calling `canvas.discardActiveObject` with no active
 *   selection is a documented no-op.
 * - `exportImageBase64(options?: Base64ExportOptions)`
 *   is the only canonical base64 export entry point. It accepts both
 *   `fileType` and `format` for ergonomic interop and
 *   returns a `Promise<string>` resolving to a `data:image/...;base64...`
 *   data URL.
 * - `exportImageFile(options?: ImageFileExportOptions)`
 *   resolves to a `File` whose name comes from `options.fileName` or the
 *   editor's `defaultDownloadFileName`.
 * - `downloadImage(fileName?: string)` triggers a
 *   browser download with the resolved filename. The bytes match the same
 *   pipeline used by `exportImageBase64`.
 * - When `isImageLoaded` is `false`, the three
 *   entry points exhibit the documented "no image loaded" shapes:
 *
 *     | entry point          | shape on no image                   |
 *     | -------------------- | ----------------------------------- |
 *     | `exportImageBase64`  | resolves to `''`                    |
 *     | `exportImageFile`    | rejects with `ExportNotReadyError`  |
 *     | `downloadImage`      | no-op (returns synchronously)       |
 *
 *   Each path emits a single `console.warn` naming the missing image so
 *   the consumer's logs identify which export attempt was skipped.
 * - When `exportImageArea` resolves
 *   to `true` and a valid `originalImage` exists, the export region is
 *   computed from `originalImage.getBoundingRect` and passed directly
 *   as `left`/`top`/`width`/`height` to Fabric's `toDataURL` options.
 *   No intermediate `<canvas>` element is created (27.2), and sub-pixel
 *   width/height values are floored to integer pixels (27.3) through
 *   the {@link floorRegion} helper.
 * - When `exportImageArea` is
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
 * Per the design's "Mapping requirements to modules" table the export
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
 */
import type * as FabricNS from 'fabric';
import type { Base64ExportOptions, FabricModule, ImageFileExportOptions, LoadImageOptions, ResolvedOptions } from '../core/public-types.js';
import { type HistoryManager } from '../history/history-manager.js';
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
     *  `exportImageAreaByDefault`. */
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
     * to derive the floored bounding box for `exportImageArea === true`
     * exports. When the image has been disposed or
     * never loaded the seam falls through to a full-canvas export.
     */
    getOriginalImage(): FabricNS.FabricImage | null;
}
/**
 * Render the live canvas to a base64 data URL.
 *
 * Steps, in order:
 *
 * 1. **No-image gate** — when `ctx.isImageLoaded`
 *    is `false`, emit a `console.warn` and resolve to `''` without
 *    touching the canvas.
 * 2. **Discard ActiveSelection** — call
 *    `canvas.discardActiveObject` once before computing the export
 *    region. Subsequent steps render against the post-discard canvas
 *    state, which never carries a top-level `ActiveSelection`.
 * 3. **Resolve format/quality**
 *    via {@link resolveExportFormat}.
 * 4. **Resolve multiplier** — `options.multiplier || exportMultiplier || 1`.
 * 5. **Compute region** — see {@link computeExportRegion}. Returns
 *    `null` for full-canvas exports and a floored {@link IntegerRegion}
 *    when `exportImageArea` is `true` and an `originalImage` is
 *    committed.
 * 6. **Render** through {@link bakeMasksForExport} so mask styles are
 *    captured, the export bake-in (`opacity: 1, fill: '#000',
 *    strokeWidth: 0, stroke: null, selectable: false`) is applied for
 *    `exportImageArea === true` exports, and the live styles are
 *    restored in a `finally` block whether the render resolved or
 *    threw. The inner step is a single
 *    `canvas.toDataURL` call — no intermediate `<canvas>`.
 *
 * @param ctx      Export context bundle.
 * @param options  Optional {@link Base64ExportOptions}. Both `fileType`
 *                 and `format` are accepted; when
 *                 both are supplied, `fileType` wins.
 * @returns        Resolves to a `data:image/...;base64...` URL on
 *                 success, or `''` when no image is loaded.
 *
 */
export declare function exportImageBase64(ctx: ExportServiceContext, options?: Base64ExportOptions): Promise<string>;
/**
 * Render the live canvas to a `File`.
 *
 * The bytes come from {@link exportImageBase64} so format/quality/
 * multiplier resolution stays consistent with the base64 path. The
 * resulting data URL is repainted through an offscreen `<canvas>` only
 * when its MIME prefix does not match the requested type — some browsers
 * silently fall back to PNG when the requested format is unsupported,
 * and the export contract requires the output MIME to match the resolved
 * `fileType`.
 *
 * @param ctx      Export context bundle.
 * @param options  Optional {@link ImageFileExportOptions}.
 * @returns        Resolves with the rendered `File`.
 * @throws         {@link ExportNotReadyError} when no image is loaded.
 *
 */
export declare function exportImageFile(ctx: ExportServiceContext, options?: ImageFileExportOptions): Promise<File>;
/**
 * Trigger a browser download of the live canvas.
 *
 * Mirrors v1's "anchor with `download` attribute" approach: an `<a>`
 * element is created, pointed at the data URL, appended to the document
 * so Firefox dispatches the click, clicked, and removed. The function
 * returns synchronously; the data URL is rendered
 * asynchronously and the click is deferred until that promise resolves.
 *
 * No-image gate emits the same `console.warn` as the
 * other entry points and returns without touching the DOM.
 *
 * Errors raised by the underlying `exportImageBase64` call are reported
 * with `console.error` rather than rethrown — `downloadImage` returns
 * `void` and there is no caller-visible promise to reject.
 *
 * @param ctx       Export context bundle.
 * @param fileName  Optional filename override. Defaults to
 *                  `options.defaultDownloadFileName`.
 *
 */
export declare function downloadImage(ctx: ExportServiceContext, fileName?: string): void;
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
 * consistency across pipeline modules. The orchestrator wiring
 * (task 21.6) is responsible for constructing this bundle from its
 * own state.
 *
 */
export interface MergeMasksContext extends ExportServiceContext {
    /** History manager that records the single merge command. */
    readonly historyManager: HistoryManager;
    /**
     * Scrollable container wrapping the canvas, or `null`. Read at the
     * head of `mergeMasks` so the success path can restore the captured
     * scroll position regardless of the layout
     * strategy applied by the inner `loadImage`.
     */
    readonly containerEl: HTMLElement | null;
    /**
     * Transactional image loader. The merge passes
     * `{ preserveScroll: true}` so the inner load tries to keep scroll
     * stable; the merge also restores scroll defensively at the tail of
     * the success path.
     */
    loadImage(imageBase64: string, options?: LoadImageOptions): Promise<void>;
    /**
     * Capture a snapshot suitable for {@link loadFromStateFn}. Reads the
     * orchestrator's `_lastSnapshot`-producing path so the merge stores
     * exactly the same wire format used by `undo` / `redo`.
     */
    saveState(): string;
    /**
     * Restore a snapshot produced by {@link saveStateFn}. Used both as
     * the `undo` callback of the merge command and
     * as the rollback step on any merge-pipeline failure.
     */
    loadFromState(snapshot: string): Promise<void>;
    /**
     * Remove every mask from the canvas WITHOUT pushing a history
     * entry. The merge owns the single enclosing history entry
     *, so the inner mask-removal step must opt out
     * of its own history push.
     */
    removeAllMasksNoHistory(): void;
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
 *    v1's `if (!this.originalImage) return; … if (!masks.length) return;`).
 * 2. **Discard ActiveSelection** — drop any active
 *    selection wrapper before computing the merged bitmap.
 * 3. **Capture pre-merge snapshot** — call
 *    `ctx.saveState` so the snapshot is suitable for
 *    `ctx.loadFromState(...)`. The snapshot is the one source of
 *    truth for both the merge command's `undo` and
 *    the rollback path.
 * 4. **Capture container scroll** — read `scrollTop` / `scrollLeft`
 *    from the editor container so the success path can restore them
 *    after the inner `loadImage` runs.
 * 5. **Render the merged bitmap** — delegate to
 *    {@link exportImageBase64} with `exportImageArea: true` and
 *    `multiplier: options.exportMultiplier`. The bake-in/restore
 *    bracket inside `exportImageBase64` ensures every live mask style
 *    is captured before the export-only style is applied and restored
 *    on both success and failure.
 * 6. **Remove all masks** without pushing history — the merge owns
 *    the single enclosing history entry, so the
 *    inner removal step opts out of its own history push.
 * 7. **Reload the merged image** through the transactional
 *    `image/image-loader.ts` with `preserveScroll: true`. A failed
 *    reload propagates here so the rollback path catches it.
 * 8. **Capture post-merge snapshot** — call `ctx.saveState` again so
 *    the merge command's `execute` can replay the merged state on
 *    redo.
 * 9. **Restore scroll defensively** — write the
 *    captured `scrollTop` / `scrollLeft` back to the container even
 *    though the inner `loadImage` was asked to preserve scroll, so
 *    the user's view does not jump regardless of the layout strategy
 *    chosen by the loader.
 * 10. **Push exactly one history command** whose
 *    `undo` restores the pre-merge snapshot via `ctx.loadFromState`
 *    and whose `execute` re-applies the merged snapshot via
 *    `ctx.loadFromState`. The command is pushed via
 *    {@link HistoryManager.push} (NOT `execute`) because the merged
 *    state is already on the canvas — the first `redo` call should
 *    re-run the merged-state restore, but the initial commit should
 *    not double-render.
 *
 * On any failure between step 3 and step 10, the pre-merge snapshot
 * captured in step 3 is restored via `ctx.loadFromState` and the
 * promise rejects with {@link MergeMasksError} wrapping the original
 * cause. A failure inside the rollback itself is
 * logged via `console.warn` but does not mask the original error.
 *
 * @param ctx Editor dependency bundle — see {@link MergeMasksContext}.
 * @returns   Resolves on success; rejects with
 *            {@link MergeMasksError} on any pipeline failure (after
 *            the pre-merge snapshot has been restored).
 *
 */
export declare function mergeMasks(ctx: MergeMasksContext): Promise<void>;
//# sourceMappingURL=export-service.d.ts.map