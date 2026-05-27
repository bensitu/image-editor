/**
 * @file crop/crop-controller.ts
 * @description Crop session lifecycle owner. Implements the
 *              `enterCropMode → applyCrop` and
 *              `enterCropMode → cancelCrop` transitions atop the
 *              legacy crop pipeline, plus the dedicated crop rectangle
 *              shape, its drag/scale clamps, and the per-object
 *              `evented`/`selectable` freeze that keeps only the crop
 *              rectangle interactive while a session is open.
 *
 * ## Owned contracts
 *
 * - `enterCropMode`, `applyCrop`, and `cancelCrop`
 *   each discard any active Fabric `ActiveSelection` BEFORE mutating crop
 *   state. The state serializer's `saveState` also discards on its own
 *   path, so the explicit call here is a defense-in-depth that keeps the
 *   contract independent of the serializer's internal behaviour.
 * - `enterCropMode` creates a {@link CropSession}
 *   that captures the pre-crop canvas snapshot (without the crop rectangle),
 *   the prior `canvas.selection` setting, and per-object `evented` /
 *   `selectable` values. The pre-crop snapshot is taken *before* the crop
 *   rectangle is added so the JSON is guaranteed crop-rect-free without
 *   relying on Fabric's serialization of the `isCropRect` custom key.
 * - `applyCrop` pushes exactly one
 *   {@link Command} whose `undo` restores the pre-crop snapshot and whose
 *   `execute` re-applies the post-crop snapshot. The command is pushed via
 *   {@link HistoryManager.push} (NOT `execute`) because the cropped state
 *   is already on the canvas — the first `redo` after an `undo` should
 *   re-run the post-crop restore, but the initial commit must not
 *   double-render.
 * - On any failure between the crop region read
 *   and the history push, the pre-crop snapshot is restored via
 *   `ctx.loadFromState`, the {@link CropSession} is dropped, all
 *   crop-specific Fabric event handlers are detached, and the returned
 *   promise rejects with {@link CropApplyError} wrapping the original
 *   cause. A failure inside the rollback itself is logged but does not
 *   mask the original error.
 * - `cancelCrop` restores the pre-crop snapshot
 *   (via the captured `prevEvented` / `prevSelection` values, plus the
 *   per-mask style backups captured on entry), removes the crop
 *   rectangle, and drops the session WITHOUT producing a history entry.
 * - All three transitions detach every Fabric
 *   event handler bound on the crop rectangle when the session ends, so
 *   no stale handlers remain attached to the disposed shape.
 * - `enterCropMode` honours
 *   `options.crop.hideMasksDuringCrop`: when `true`, every mask's prior
 *   live style is captured into `session.maskBackups` via
 *   {@link captureMaskStyleBackup} and the mask is then forced to
 *   `opacity: 0`, `evented: false`, `selectable: false` via
 *   {@link applyCropHideMaskStyle}. Backups are captured BEFORE the
 *   freeze loop so the recorded `selectable` value is the true pre-crop
 *   value and not the freeze-loop's enforced `false`.
 * - `cancelCrop` restores every entry in
 *   `session.maskBackups` via {@link restoreMaskStyleBackup} after the
 *   per-object `evented` / `selectable` restore so the mask backup's
 *   fields (`opacity`, `fill`, `strokeWidth`, `stroke`, `selectable`,
 *   `lockRotation`) are the final word.
 * - `applyCrop` honours
 *   `options.crop.preserveMasksAfterCrop` defaulting to `false` in current:
 *   the inner `ctx.loadImage(croppedBase64)` replaces every canvas
 *   object with the cropped base image, so masks disappear naturally
 *   when the option is `false`.
 * - When `options.crop.preserveMasksAfterCrop`
 *   is `true`, `applyCrop` captures each mask's `left`, `top`,
 *   `angle`, `scaleX`, and `scaleY` BEFORE the canvas is exported, and
 *   re-adds the masks AFTER the loader commits the cropped image with
 *   `left` and `top` shifted by `-cropRegion.left, -cropRegion.top`.
 *   Per-mask `angle`, `scaleX`, and `scaleY` are restored verbatim so
 *   the visible mask shape does not change size or orientation
 *. The cropRegion-relative shift matches legacy's
 *   `_translateObjectByCanvasOffset(mask, -cropRegion.sourceX,
 *   -cropRegion.sourceY)` and is the documented legacy behavior to
 *   preserve. Because shifting `left` / `top` by a constant translates
 *   the entire object (including its rotated visual) by the same
 *   constant in canvas pixels, the post-crop position relative to the
 *   new image bounding box matches the pre-crop position relative to
 *   the old image bounding box without any explicit trig in this
 *   module — the rotation angle is encoded in the rotated image's
 *   bounding rect, which moves with the same translation as the masks.
 *
 * ## Scope of THIS task (20.3)
 *
 * Task 20.2 already implemented hide-on-entry and restore-on-cancel for
 * `hideMasksDuringCrop`. Task 20.3 fills the post-load seam: when
 * `preserveMasksAfterCrop === true`, capture each mask's `left`, `top`,
 * `angle`, `scaleX`, and `scaleY` before the export and re-add the
 * masks shifted by `-cropRegion.left, -cropRegion.top` after
 * `ctx.loadImage(croppedBase64)` commits. The intersection filter
 * (drop masks that do not overlap the crop region) matches legacy
 * observable behavior — masks fully outside the cropped region are
 * removed, masks that intersect are preserved.
 *
 * ## Implementation notes
 *
 * - The controller is a set of stateless functions taking a
 *   {@link CropControllerContext}. The `ImageEditor` facade keeps
 *   ownership of the canonical session pointer (`getCropSession` /
 *   `setCropSession`) so multiple editors on the same page do not share
 *   crop state and a sub-agent unit test can exercise the controller
 *   without instantiating the full facade.
 * - The crop rectangle's drag/scale handlers clamp `scaleX` / `scaleY`
 *   so the rect cannot grow past the available image bounding box and
 *   cannot shrink below the configured `crop.minWidth` / `crop.minHeight`.
 *   This matches legacy's `handleCropRectModified`.
 * - In Fabric v7 the rotation handle (`mtr`) is hidden via
 *   `setControlVisible('mtr', false)` because `hasRotatingPoint` is
 *   silently ignored. `lockRotation: true` is also set as runtime
 *   defence so the rotation transform itself cannot fire even if the
 *   handle were somehow shown.
 * - The pre-crop snapshot is captured once, in `enterCropMode`, and
 *   reused by `applyCrop`'s history command and rollback path. This
 *   avoids a re-serialization right before the crop, and — more
 *   importantly — avoids the legacy fragility of filtering `isCropRect`
 *   objects out of a post-rect snapshot when Fabric's custom-key
 *   serializer occasionally drops the marker.
 *
 * Owner module references (per the documented "Mapping Contracts to
 * modules" table): this module is imported only by `image-editor.ts` and
 * is intentionally NOT re-exported from `src/index.ts`.
 *
 */
import type * as FabricNS from 'fabric';
import type { FabricModule, LoadImageOptions, ResolvedOptions } from '../core/public-types.js';
import { type HistoryManager } from '../history/history-manager.js';
/**
 * Dependency bundle passed by the `ImageEditor` facade into every crop
 * entry point. The controller has no class state of its own — every
 * editor field it reads is exposed here as a value or callback so the
 * facade keeps ownership of the canonical state.
 *
 * Mirrors the shape of
 * {@link import('../export/export-service.js').MergeMasksContext} for
 * consistency across pipeline modules.
 *
 * The orchestrator wiring (task 21.x) is responsible for constructing
 * this bundle from its own state.
 */
export interface CropControllerContext {
    /** Fabric module providing `Rect` for the crop rectangle. */
    readonly fabric: FabricModule;
    /** Live Fabric canvas. */
    readonly canvas: FabricNS.Canvas;
    /** Resolved editor options — supplies `crop.padding`, `crop.minWidth`,
     *  `crop.minHeight`, `crop.allowRotationOfCropRect`, and
     *  `downsampleQuality` (used as the cropped JPEG export quality). */
    readonly options: ResolvedOptions;
    /** History manager that records the single crop command on success. */
    readonly historyManager: HistoryManager;
    /**
     * Predicate matching `ImageEditor.isImageLoaded`. Returns `true`
     * only when an `originalImage` has been committed and has positive
     * dimensions. `enterCropMode` and `applyCrop` no-op when this is
     * `false` so a caller cannot open a crop session against an empty
     * canvas (matches legacy's `isImageLoaded` gate).
     */
    isImageLoaded(): boolean;
    /**
     * The currently committed `originalImage`, or `null`. Read by
     * {@link enterCropMode} to derive the initial crop rectangle bounds
     * from the image bounding box.
     */
    getOriginalImage(): FabricNS.FabricImage | null;
    /** Reads the live crop session, or `null`. */
    getCropSession(): CropSession | null;
    /** Writes the live crop session pointer (or clears it with `null`). */
    setCropSession(session: CropSession | null): void;
    /**
     * Capture a snapshot suitable for {@link loadFromState}. Used in
     * `enterCropMode` to record the pre-crop state and again in
     * `applyCrop` after the cropped image is on the canvas to record
     * the post-crop state for the redo command.
     */
    saveState(): string;
    /**
     * Restore a snapshot produced by {@link saveState}. Used as the
     * `undo` callback of the crop command and as the rollback step on
     * any `applyCrop` failure.
     */
    loadFromState(snapshot: string): Promise<void>;
    /**
     * Transactional image loader (`image/image-loader.ts`). `applyCrop`
     * routes the cropped data URL through this so a failed reload
     * propagates back here and the rollback path catches it.
     */
    loadImage(imageBase64: string, options?: LoadImageOptions): Promise<void>;
    /**
     * Reads the orchestrator's mask counter. Used by the
     * `preserveMasksAfterCrop` path so re-added masks restore the
     * counter to `max(maskId)` after `ctx.loadImage` reset it to `0`
     * on commit (invariant: subsequent `createMask`
     * calls must not collide with a preserved mask's `maskId`).
     *
     * Optional — only consulted by the preserve path. The orchestrator
     * may omit this in unit-test contexts that never enable
     * `preserveMasksAfterCrop`.
     */
    getMaskCounter?(): number;
    /**
     * Writes the orchestrator's mask counter. See {@link getMaskCounter}
     * for the contract.
     */
    setMaskCounter?(n: number): void;
    /**
     * Re-render the mask list DOM after preserved masks are re-added to
     * the post-crop canvas. Optional — the orchestrator may omit this
     * when no DOM list is wired (e.g., headless unit tests). Mirrors
     * legacy's `_updateMaskList` call after preserved masks land.
     */
    updateMaskList?(): void;
}
/**
 * Open a crop session. Builds a {@link CropSession} that captures:
 *
 * - the pre-crop canvas JSON snapshot (without the crop rectangle),
 * - the prior `canvas.selection` setting,
 * - per-object `evented` / `selectable` values for every existing canvas
 *   object,
 * - per-mask style backups when `options.crop.hideMasksDuringCrop` is
 *   `true` so {@link cancelCrop} can revert the hide.
 *
 * After capturing the session, the function:
 *
 * 1. Adds an interactive crop rectangle inside the image bounding box
 *    (with the configured padding inset) and binds drag/scale clamp
 *    handlers so it cannot grow past the image bounds nor shrink below
 *    `crop.minWidth` / `crop.minHeight`.
 * 2. Forces `canvas.selection = false` and freezes every other canvas
 *    object (`evented = false`, `selectable = false`) so only the crop
 *    rectangle responds to pointer events.
 * 3. Marks the rectangle with the `isCropRect` custom property so the
 *    state serializer's session-only filter excludes it from any future
 *    snapshot taken while the session is open.
 * 4. When `options.crop.hideMasksDuringCrop` is `true`, captures a
 *    {@link MaskBackup} for every mask BEFORE the freeze loop runs and
 *    then applies the crop-mode hide style (`opacity: 0`,
 *    `evented: false`, `selectable: false`) via
 *    {@link applyCropHideMaskStyle}. Capturing first ensures the
 *    backup's `selectable` field reflects the true pre-crop value
 *    rather than the freeze-loop's enforced `false`.
 *
 * No-ops when:
 *
 * - a session is already open (idempotent re-entry),
 * - no `originalImage` is committed,
 * - `isImageLoaded` returns `false`.
 *
 * `discardActiveObject` runs at the very top so the
 * pre-crop snapshot does not capture an `ActiveSelection` wrapper. The
 * state serializer's own discard provides a second line of defence.
 *
 * @param ctx Editor dependency bundle — see {@link CropControllerContext}.
 *
 */
export declare function enterCropMode(ctx: CropControllerContext): void;
/**
 * Close an open crop session WITHOUT applying the crop. Restores the
 * pre-crop `canvas.selection`, the per-object `evented` / `selectable`
 * values, removes the crop rectangle, detaches every crop-bound Fabric
 * handler, and drops the session.
 *
 * Produces NO history entry — the user explicitly chose to abandon the
 * crop, and the canvas state at the end of `cancelCrop` is the same one
 * the previous history entry already covers.
 *
 * No-op when no session is open.
 *
 * `discardActiveObject` runs at the very top so any
 * currently-active selection (typically the crop rectangle itself) is
 * cleared before the rect is removed.
 *
 * @param ctx Editor dependency bundle — see {@link CropControllerContext}.
 *
 */
export declare function cancelCrop(ctx: CropControllerContext): void;
/**
 * Apply the active crop session: export the crop region as a JPEG data
 * URL, reload it as the new base image through the transactional
 * loader, and push exactly one history entry whose `undo` restores the
 * pre-crop snapshot and whose `execute` re-applies the post-crop
 * snapshot.
 *
 * Atomic: either the cropped image is committed and one history entry
 * is pushed, or the editor is rewound to its pre-crop state and the
 * returned promise rejects with {@link CropApplyError}.
 *
 * Steps, in order:
 *
 * 1. **No-op gates** — return without mutating anything when no session
 *    is open or the session has no crop rectangle.
 * 2. **Discard ActiveSelection** — drop any active
 *    selection wrapper before reading the crop rect's bounding box so
 *    the export region is computed against the rect itself.
 * 3. **Read crop region** — refresh the rect's coordinate cache, read
 *    its bounding rect, convert it to an integer region with trailing
 *    partial pixels excluded, and clamp it to the source canvas.
 * 3a. **Capture preserved masks** — when
 *    `options.crop.preserveMasksAfterCrop === true`, capture each mask's
 *    pre-crop `left`, `top`, `angle`, `scaleX`, and `scaleY`, then
 *    remove the masks from the canvas so the cropped JPEG export does
 *    not bake them in (and so the inner `ctx.loadImage`'s
 *    `canvas.clear` does not dispose the captured reference). Masks
 *    fully outside the crop region are removed without a record so
 *    they do not reappear after the load (matches legacy's `intersectsCrop`
 *    filter).
 * 4. **Tear down session in place** — restore per-object evented /
 *    selectable values (so the export sees masks in their pre-crop
 *    state) and remove the crop rectangle along with its handlers
 *. The session pointer is NOT cleared yet
 *    because the catch path may still need `session.beforeJson`.
 * 5. **Restore `canvas.selection`** — back to the pre-crop value before
 *    the cropped image is exported.
 * 6. **Export the crop region** via `canvas.toDataURL` with the
 *    integer region as `left` / `top` / `width` / `height` (matches
 *    legacy's `_exportCanvasRegionToDataURL`). The cropped image is JPEG
 *    at the configured downsample quality.
 * 7. **Reload the cropped image** through `ctx.loadImage`. The
 *    transactional loader either commits the new image or rolls back —
 *    a failure propagates here so the rollback path below catches it.
 * 7a. **Reapply preserved masks** — when
 *    records were captured in step 3a, re-add each mask to the
 *    post-crop canvas with `left` and `top` shifted by
 *    `-cropRegion.left, -cropRegion.top` and `angle`, `scaleX`,
 *    `scaleY` restored verbatim. Restores the orchestrator's mask
 *    counter to `max(maskId)` so subsequent `createMask` calls do not
 *    collide with preserved IDs.
 * 8. **Capture post-crop snapshot** for the redo command.
 * 9. **Drop the session pointer** before pushing history.
 * 10. **Push exactly one history command** whose
 *    `undo` restores the pre-crop snapshot and whose `execute`
 *    re-applies the post-crop snapshot.
 *
 * On any failure between step 3 and step 10, the helper:
 *
 * - tears down the session (handlers detached, rect removed,
 *   per-object state restored, `canvas.selection` reverted) so no
 *   stale crop state remains,
 * - clears the session pointer,
 * - restores the pre-crop snapshot via `ctx.loadFromState`,
 * - rejects with {@link CropApplyError} wrapping the original cause.
 *
 * Mask handling note: when `options.crop.preserveMasksAfterCrop` is
 * `false` (the current default), the inner
 * `ctx.loadImage(croppedBase64)` call replaces every canvas object
 * with the cropped base image, so any masks are removed naturally
 * with no extra work in this function. When `preserveMasksAfterCrop`
 * is `true`, masks intersecting the crop region are captured before
 * the export and re-added after the load via
 * {@link capturePreservedMasks} / {@link reapplyPreservedMasks}.
 * Crop-mode mask hiding on entry / restoration on cancel is handled
 * in {@link enterCropMode} and the {@link teardownSession} chain.
 *
 * @param ctx Editor dependency bundle — see {@link CropControllerContext}.
 * @returns   Resolves on success; rejects with {@link CropApplyError}
 *            on any pipeline failure (after the pre-crop snapshot has
 *            been restored).
 *
 */
export declare function applyCrop(ctx: CropControllerContext): Promise<void>;
//# sourceMappingURL=crop-controller.d.ts.map