/**
 * Crop session lifecycle owner. Implements the
 * `enterCropMode → applyCrop` and
 * `enterCropMode → cancelCrop` transitions atop the
 * crop export/load pipeline, plus the dedicated crop rectangle
 * shape, its drag/scale clamps, and the per-object
 * `evented`/`selectable` freeze that keeps only the crop
 * rectangle interactive while a session is open.
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
 *   `context.loadFromState`, the {@link CropSession} is dropped, all
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
 *   the inner `context.loadImage(croppedBase64)` replaces every canvas
 *   object with the cropped base image, so masks disappear naturally
 *   when the option is `false`.
 * - When `options.crop.preserveMasksAfterCrop`
 *   is `true`, `applyCrop` captures each mask's `left`, `top`,
 *   `angle`, `scaleX`, and `scaleY` BEFORE the canvas is exported, and
 *   re-adds the masks AFTER the loader commits the cropped image with
 *   `left` and `top` shifted by `-cropRegion.left, -cropRegion.top`.
 *   Per-mask `angle`, `scaleX`, and `scaleY` are restored verbatim so
 *   the visible mask shape does not change size or orientation. The
 *   cropRegion-relative shift preserves the historical
 *   `_translateObjectByCanvasOffset(mask, -cropRegion.sourceX,
 *   -cropRegion.sourceY)` behavior. Because shifting `left` / `top` by a constant translates
 *   the entire object (including its rotated visual) by the same
 *   constant in canvas pixels, the post-crop position relative to the
 *   new image bounding box matches the pre-crop position relative to
 *   the old image bounding box without any explicit trig in this
 *   module — the rotation angle is encoded in the rotated image's
 *   bounding rect, which moves with the same translation as the masks.
 *
 * ## Post-crop mask preservation
 *
 * Mask visibility during crop mode is owned by the
 * `hideMasksDuringCrop` path above: masks can be hidden on entry and
 * restored on cancel. The apply path separately owns
 * `preserveMasksAfterCrop`: when the option is `true`, the controller
 * captures each mask's `left`, `top`, `angle`, `scaleX`, and `scaleY`
 * before export and re-adds the masks shifted by
 * `-cropRegion.left, -cropRegion.top` after
 * `context.loadImage(croppedBase64)` commits. The intersection filter
 * drops masks that do not overlap the crop region, matching the documented
 * observable behavior: masks fully outside the cropped region are
 * removed, while intersecting masks are preserved.
 *
 * ## Implementation notes
 *
 * - The controller is a set of stateless functions taking a
 *   {@link CropControllerContext}. The `ImageEditor` facade keeps
 *   ownership of the canonical session pointer (`getCropSession` /
 *   `setCropSession`) so multiple editors on the same page do not share
 *   crop state and unit tests can exercise the controller
 *   without instantiating the full facade.
 * - The crop rectangle's drag/scale handlers clamp `scaleX` / `scaleY`
 *   so the rect cannot grow past the available image bounding box and
 *   cannot shrink below the configured `crop.minWidth` / `crop.minHeight`.
 *   This matches legacy's `handleCropRectModified`.
 * - In Fabric v7 crop rectangle controls are configured via
 *   `setControlsVisibility(...)` because `hasRotatingPoint` is silently
 *   ignored. `lockRotation: true` is also set as runtime defence so the
 *   rotation transform itself cannot fire even if the handle were somehow
 *   shown.
 * - The pre-crop snapshot is captured once, in `enterCropMode`, and
 *   reused by `applyCrop`'s history command and rollback path. This
 *   avoids a re-serialization right before the crop, and — more
 *   importantly — avoids the historical fragility of filtering `isCropRect`
 *   objects out of a post-rect snapshot when Fabric's custom-key
 *   serializer occasionally drops the marker.
 *
 * Owner module references (per the documented "Mapping Contracts to
 * modules" table): this module is imported only by `image-editor.ts` and
 * is intentionally NOT re-exported from `src/index.ts`.
 *
 * @module
 */

import type * as FabricNS from 'fabric';

import { CropApplyError } from '../core/errors.js';
import { markSessionObject } from '../core/editor-object-kind.js';
import type {
    CropAspectRatio,
    CropHandler,
    CropModeOptions,
    CropPrevEvented,
    FabricModule,
    ImageMimeType,
    LoadImageOptions,
    MaskBackup,
    MaskObject,
    NormalizedImageFormat,
    ResolvedOptions,
} from '../core/public-types.js';
import { isMaskObject } from '../core/public-types.js';
import { Command, type HistoryManager } from '../history/history-manager.js';
import {
    applyCropHideMaskStyle,
    captureMaskStyleBackup,
    reattachMaskHoverHandlers,
    restoreMaskStyleBackup,
} from '../mask/mask-style.js';
import {
    getClampedCanvasRegion,
    getObjectBBox,
    hasMeaningfulCanvasRegion,
} from '../utils/canvas-region.js';
import {
    clampQuality as clampExportQuality,
    mimeTypeFor,
    tryNormalizeImageFormat,
} from '../export/export-format.js';

// ─── Crop session state ──────────────────────────────────────────────────────

/**
 * Internal state of an open crop session. Built by {@link enterCropMode},
 * consumed and discarded by {@link applyCrop} / {@link cancelCrop}.
 *
 * The editor runtime owns the live pointer to this object; the
 * controller reads and writes it through the
 * {@link CropControllerContext.getCropSession} /
 * {@link CropControllerContext.setCropSession} callbacks so multiple
 * editor instances do not share crop state.
 *
 * Fields:
 *
 * - `beforeJson` — JSON snapshot of the canvas captured BEFORE the crop
 *   rectangle was added. Used as both the rollback target on
 *   `applyCrop` failure and the `undo` payload of
 *   the history entry pushed on success.
 * - `prevSelection` — value of `canvas.selection` immediately before the
 *   controller forced it to `false` to keep only the crop rectangle
 *   interactive. Restored on apply or cancel.
 * - `prevEvented` — list of `{ object, evented, selectable}` records for
 *   every canvas object that was frozen on entry. Restored on apply or
 *   cancel.
 * - `maskBackups` — per-mask style backup list. Populated by
 *   `enterCropMode` when `options.crop.hideMasksDuringCrop` is `true`,
 *   consumed by `cancelCrop` to restore each mask's pre-crop visual
 *   state. Empty when the option is `false`.
 * - `cropRect` — the active crop rectangle, or `null` after the rect has
 *   been removed (so subsequent calls to {@link removeCropRect} are
 *   idempotent on the success and rollback paths).
 * - `aspectRatio` — current crop aspect-ratio lock. `null` means free crop.
 * - `handlers` — bound `modified` / `moving` / `scaling` handler records
 *   on the crop rectangle. Detached when the session ends.
 *
 */
export interface CropSession {
    beforeJson: string;
    prevSelection: boolean;
    prevEvented: CropPrevEvented[];
    /** Per-mask style backups captured when masks are hidden during crop mode. */
    maskBackups: MaskBackup[];
    cropRect: FabricNS.Rect | null;
    aspectRatio: NormalizedCropAspectRatio;
    handlers: CropHandler[];
}

// ─── Context ─────────────────────────────────────────────────────────────────

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
 * The `ImageEditor` facade constructs this bundle from its own state.
 */
export interface CropControllerContext {
    /** Fabric module providing `Rect` for the crop rectangle. */
    readonly fabric: FabricModule;
    /** Live Fabric canvas. */
    readonly canvas: FabricNS.Canvas;
    /** Resolved editor options — supplies `crop.padding`, `crop.minWidth`,
     *  `crop.minHeight`, `crop.allowRotationOfCropRect`, and
     *  `downsampleQuality` (used as the lossy crop export fallback quality). */
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

    /**
     * MIME type of the currently committed image, used by source-preserving
     * crop export.
     */
    getCurrentImageMimeType?(): ImageMimeType | null;

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
     * counter to `max(maskId)` after `context.loadImage` reset it to `0`
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
     * legacy's `updateMaskList` call after preserved masks land.
     */
    updateMaskList?(): void;
}

// ─── Crop rectangle visual constants (match legacy verbatim) ─────────────────────

/** Crop rectangle fill (translucent). Matches legacy's `_cropRect` style. */
const CROP_RECT_FILL = 'rgba(0,0,0,0.12)';
/** Crop rectangle stroke colour. */
const CROP_RECT_STROKE = '#00aaff';
/** Crop rectangle stroke dash pattern. */
const CROP_RECT_DASH: [number, number] = [6, 4];
/** Crop rectangle corner size in pixels. */
const CROP_RECT_CORNER_SIZE = 8;
/** Default padding inset when `options.crop.padding` is missing. */
const CROP_DEFAULT_PADDING = 10;
/** Floor for lossy crop export quality if all configured values are invalid. */
const CROPPED_EXPORT_QUALITY_FALLBACK = 0.92;

interface ResolvedCropExportFormat {
    format: NormalizedImageFormat;
    mimeType: ImageMimeType;
    quality?: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function finiteNumberOrFallback(value: unknown, fallback: number): number {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
}

/**
 * Map the current committed image MIME type to Fabric's export format token.
 */
function imageMimeToFormat(mimeType: ImageMimeType | null): NormalizedImageFormat | null {
    if (mimeType === 'image/jpeg') return 'jpeg';
    if (mimeType === 'image/png') return 'png';
    if (mimeType === 'image/webp') return 'webp';
    return null;
}

/**
 * Resolve lossy crop export quality to `[0, 1]` for JPEG/WebP outputs.
 */
function resolveLossyCropQuality(cropExportQuality: unknown, downsampleQuality: unknown): number {
    const cropQuality = Number(cropExportQuality);
    if (Number.isFinite(cropQuality)) {
        return clampExportQuality(cropQuality, CROPPED_EXPORT_QUALITY_FALLBACK);
    }
    const fallbackQuality = Number(downsampleQuality);
    if (Number.isFinite(fallbackQuality)) {
        return clampExportQuality(fallbackQuality, CROPPED_EXPORT_QUALITY_FALLBACK);
    }
    return CROPPED_EXPORT_QUALITY_FALLBACK;
}

function resolveCropExportFormat(input: {
    cropExportFileType: unknown;
    currentImageMimeType: ImageMimeType | null;
    cropExportQuality: unknown;
    downsampleQuality: unknown;
}): ResolvedCropExportFormat {
    const requested = input.cropExportFileType;
    const format =
        requested === undefined || requested === null || requested === 'source'
            ? (imageMimeToFormat(input.currentImageMimeType) ?? 'png')
            : (tryNormalizeImageFormat(String(requested)) ?? 'png');
    const mimeType = mimeTypeFor(format);
    if (format === 'png') return { format, mimeType };
    return {
        format,
        mimeType,
        quality: resolveLossyCropQuality(input.cropExportQuality, input.downsampleQuality),
    };
}

function getCropRectContentBounds(cropRect: FabricNS.Rect): {
    left: number;
    top: number;
    width: number;
    height: number;
} {
    const angle = Number(cropRect.angle) || 0;
    const normalizedAngle = Math.abs(angle % 360);
    if (normalizedAngle > 0.01 && Math.abs(normalizedAngle - 360) > 0.01) {
        return getObjectBBox(cropRect);
    }

    return {
        left: Number(cropRect.left) || 0,
        top: Number(cropRect.top) || 0,
        width: Math.max(0, (Number(cropRect.width) || 0) * Math.abs(Number(cropRect.scaleX) || 1)),
        height: Math.max(
            0,
            (Number(cropRect.height) || 0) * Math.abs(Number(cropRect.scaleY) || 1),
        ),
    };
}

/**
 * Detach every handler bound on the crop rectangle and remove the rect
 * from the canvas. Idempotent: if the rect has already been removed
 * (e.g., the success path called this and then the catch ran on a later
 * failure), the function is a no-op.
 *
 */
function removeCropRect(context: CropControllerContext, session: CropSession): void {
    // Detach handlers first.
    for (const targetHandlers of session.handlers) {
        for (const record of targetHandlers.handlers) {
            try {
                (targetHandlers.target as FabricNS.FabricObject).off(
                    record.eventName as keyof FabricNS.ObjectEvents,
                    record.callback,
                );
            } catch {
                /* ignore — handler may already be detached */
            }
        }
    }
    session.handlers = [];

    // Remove the rect — best-effort because Fabric may have already
    // disposed the shape during a `loadFromState` rollback.
    if (session.cropRect) {
        try {
            context.canvas.remove(session.cropRect);
        } catch {
            /* ignore */
        }
        session.cropRect = null;
    }
}

/**
 * Restore the per-object `evented` / `selectable` values captured on
 * `enterCropMode`. Idempotent: clears the list after applying so a
 * second call (e.g., from a catch-then-finally pattern) is a no-op.
 *
 */
function restoreCropObjectState(session: CropSession): void {
    for (const record of session.prevEvented) {
        try {
            record.object.set({ evented: record.evented, selectable: record.selectable });
        } catch {
            /* ignore — object may have been removed mid-session */
        }
    }
    session.prevEvented = [];
}

/**
 * Restore every per-mask style backup captured on `enterCropMode` when
 * `options.crop.hideMasksDuringCrop` was `true`. Reverts the
 * `applyCropHideMaskStyle` mutation (opacity 0, evented/selectable false)
 * along with the rest of the backed-up fields (`fill`, `strokeWidth`,
 * `stroke`, `selectable`, `lockRotation`).
 *
 * Idempotent: clears the list after applying so a second call (e.g.,
 * from a catch-then-finally pattern) is a no-op.
 *
 * Runs AFTER {@link restoreCropObjectState} in {@link teardownSession}
 * so the per-mask backup's `selectable` value wins over the
 * `prevEvented` capture (which was forced to its pre-freeze value).
 * Both happen to record the same "true pre-crop" value because
 * {@link enterCropMode} captures both BEFORE any mutation, but ordering
 * the mask restore last keeps the contract explicit:
 * the mask backup's fields are the final word.
 *
 *
 */
function restoreCropMaskBackups(session: CropSession): void {
    for (const backup of session.maskBackups) {
        restoreMaskStyleBackup(backup);
    }
    session.maskBackups = [];
}

/**
 * Tear down a session in place: detach handlers, remove the rect,
 * restore per-object evented/selectable, restore per-mask style backups
 * (when `options.crop.hideMasksDuringCrop` populated them), and restore
 * `canvas.selection`. Used by both the rollback path of
 * {@link applyCrop} and by {@link cancelCrop}.
 *
 * Does NOT clear the session pointer on the orchestrator — callers
 * decide when to call `context.setCropSession(null)` so the catch path can
 * still read `session.beforeJson` after teardown.
 *
 * Order of operations is significant:
 *
 * 1. `removeCropRect` — detaches handlers and removes the rect so it is
 *    not visible while the rest of the restore runs.
 * 2. `restoreCropObjectState` — reverts every object's `evented` /
 *    `selectable` to the pre-crop value.
 * 3. `restoreCropMaskBackups` — reverts every mask's `opacity`, `fill`,
 *    `strokeWidth`, `stroke`, `selectable`, and `lockRotation`. Runs
 *    AFTER step 2 so the mask backup is the final word on `selectable`
 *    when `hideMasksDuringCrop` was active.
 * 4. `canvas.selection` reset — last so any side-effect of the previous
 *    steps does not flip it back.
 *
 *
 */
function teardownSession(context: CropControllerContext, session: CropSession): void {
    removeCropRect(context, session);
    restoreCropObjectState(session);
    restoreCropMaskBackups(session);
    try {
        context.canvas.selection = !!session.prevSelection;
    } catch {
        /* ignore — canvas may have been disposed mid-session */
    }
}

// ─── Mask preservation across crop ──────────

/**
 * Per-mask record captured BEFORE the crop region is exported, used by
 * the `preserveMasksAfterCrop === true` path to re-add masks after the
 * cropped image has been committed by the transactional loader.
 *
 * Captured fields:
 *
 * - `mask` — the live Fabric mask object. Removed from the canvas by
 *   {@link capturePreservedMasks} so the export does not bake the mask
 *   into the cropped intermediate image (and so the inner `context.loadImage` clear does
 *   not dispose the captured reference); re-added by
 *   {@link reapplyPreservedMasks}.
 * - `left`, `top` — the mask's pre-crop top-left coordinates in canvas
 *   pixels. Captured BEFORE the export so a later transform mutation
 *   inside `context.loadImage` cannot affect the values; the post-crop
 *   placement step shifts these by `-cropRegion.left, -cropRegion.top`
 *   so the mask's position relative to the new image bounding box
 *   matches its prior position relative to the pre-crop image bounding
 *   box. Matches legacy's
 *   `_translateObjectByCanvasOffset(mask, -cropRegion.sourceX,
 *   -cropRegion.sourceY)`.
 * - `angle`, `scaleX`, `scaleY` — preserved verbatim across the crop so
 *   the visible mask shape does not change size or orientation.
 * - `styleBackup` — the pre-crop visual and event state, restored before
 *   the geometry shift so crop-mode hide styles never leak after apply.
 *
 */
interface PreservedMaskRecord {
    mask: MaskObject;
    left: number;
    top: number;
    angle: number;
    scaleX: number;
    scaleY: number;
    styleBackup: MaskBackup;
}

/**
 * Decide whether `mask`'s axis-aligned bounding rect intersects the
 * integer crop region. Matches legacy's `intersectsCrop` predicate so masks
 * fully outside the crop are dropped and masks that overlap survive.
 *
 * The intersection is computed in canvas coordinates because both the
 * mask bbox and the crop region are already in canvas space.
 *
 */
function maskIntersectsRegion(
    mask: MaskObject,
    region: { left: number; top: number; width: number; height: number },
): boolean {
    const bbox = getObjectBBox(mask);
    return (
        bbox.left < region.left + region.width &&
        bbox.left + bbox.width > region.left &&
        bbox.top < region.top + region.height &&
        bbox.top + bbox.height > region.top
    );
}

/**
 * Capture every mask whose bounding rect intersects `cropRegion`,
 * record its pre-crop `left`, `top`, `angle`, `scaleX`, `scaleY`, and
 * remove it from the canvas so the cropped intermediate image export does not bake
 * the mask in (and so the inner `context.loadImage`'s `canvas.clear` does
 * not dispose the captured Fabric reference).
 *
 * Only the masks that survive the intersection filter are returned —
 * masks fully outside the crop region are removed without a record so
 * {@link reapplyPreservedMasks} does not re-add them (matches legacy's
 * `intersectsCrop` filter and observable behavior in the legacy test
 * `'workflow preserveMasksAfterCrop keeps intersecting masks and
 * removes outside masks'`).
 *
 * The captured `left` and `top` are read directly off the live mask
 * (matches legacy's `_translateObjectByCanvasOffset` operating on
 * `mask.left` / `mask.top`) so the post-load reapply step can shift
 * them by `-cropRegion.left, -cropRegion.top` and land the mask at the
 * same canvas position relative to the new image bounding box. Because
 * a constant translation moves the rotated mask's visual by the same
 * constant in canvas pixels, the rotation angle does not need to be
 * re-applied to the offset — `angle` is preserved
 * verbatim.
 *
 * Each removal is wrapped in `try/catch` so a stale Fabric reference
 * mid-iteration cannot break the loop.
 *
 */
function capturePreservedMasks(
    canvas: FabricNS.Canvas,
    cropRegion: { left: number; top: number; width: number; height: number },
    maskBackups: MaskBackup[] = [],
): PreservedMaskRecord[] {
    const records: PreservedMaskRecord[] = [];
    const styleBackupByMask =
        maskBackups.length > 0
            ? new Map(maskBackups.map((backup) => [backup.object, backup]))
            : null;

    const masks = canvas.getObjects().filter(isMaskObject);
    for (const mask of masks) {
        try {
            mask.setCoords();
            const intersects = maskIntersectsRegion(mask, cropRegion);

            if (intersects) {
                const styleBackup = styleBackupByMask?.get(mask) ?? captureMaskStyleBackup(mask);
                records.push({
                    mask,
                    // capture pre-crop
                    // canvas-pixel coordinates verbatim. The post-crop
                    // reapply step shifts these by `-cropRegion.left,
                    // -cropRegion.top` (matches legacy).
                    left: finiteNumberOrFallback(mask.left, 0),
                    top: finiteNumberOrFallback(mask.top, 0),
                    // preserve verbatim.
                    angle: finiteNumberOrFallback(mask.angle, 0),
                    scaleX: finiteNumberOrFallback(mask.scaleX, 1),
                    scaleY: finiteNumberOrFallback(mask.scaleY, 1),
                    styleBackup,
                });
            }

            canvas.remove(mask);
        } catch {
            /* ignore — best-effort: mask may already be detached */
        }
    }

    return records;
}

/**
 * Re-add every captured mask to the post-crop canvas with its `left`
 * and `top` shifted by `-cropRegion.left, -cropRegion.top` so its
 * position relative to the new image bounding box matches its prior
 * position relative to the pre-crop image bounding box.
 *
 * Per-mask `angle`, `scaleX`, and `scaleY` are restored from the captured
 * record so the visible mask shape does not change size or orientation.
 * Hover handlers are reattached because Fabric event
 * listeners are not preserved across `canvas.remove` / `canvas.add`
 * pairs — matches legacy's `_rebindMaskEvents` call after the same
 * remove/re-add round-trip.
 *
 * The orchestrator's mask counter is bumped to
 * `max(getMaskCounter, max(maskId over preserved))` so subsequent
 * `createMask` calls produce unique IDs (the loader resets the counter
 * to `0`). The mask list DOM is re-rendered when the orchestrator
 * supplied an `updateMaskList` callback (matches legacy's `updateMaskList`
 * call after preserved masks land).
 *
 * Each `add` / `set` is wrapped in `try/catch` so a single mask that
 * fails to land does not abort the rest of the preservation work.
 *
 */
function reapplyPreservedMasks(
    context: CropControllerContext,
    cropRegion: { left: number; top: number; width: number; height: number },
    records: PreservedMaskRecord[],
): void {
    if (records.length === 0) return;

    const { canvas } = context;

    let maxRestoredId = 0;
    for (const record of records) {
        try {
            // apply the legacy cropRegion-relative
            // shift: a constant translation in canvas pixels moves the
            // rotated mask visual by the same constant, so the post-crop
            // position relative to the new image bbox matches the
            // pre-crop position relative to the old image bbox.
            //
            // Restore the pre-crop style first so crop-mode opacity,
            // evented, and selectable changes do not leak into the
            // post-crop canvas.
            restoreMaskStyleBackup(record.styleBackup);

            //
            // restore `angle`, `scaleX`, `scaleY`
            // verbatim and force `visible: true` (matches legacy's
            // `mask.set({ visible: true})` after the offset).
            record.mask.set({
                left: record.left - cropRegion.left,
                top: record.top - cropRegion.top,
                angle: record.angle,
                scaleX: record.scaleX,
                scaleY: record.scaleY,
                visible: true,
            });
            record.mask.setCoords();

            canvas.add(record.mask);
            canvas.bringObjectToFront(record.mask);

            // Re-bind hover handlers so the post-crop mask responds the
            // same way as a freshly-created one (matches legacy's
            // `_rebindMaskEvents` after the remove/re-add round-trip).
            reattachMaskHoverHandlers(record.mask);

            const id = Number(record.mask.maskId);
            if (Number.isFinite(id) && id > maxRestoredId) maxRestoredId = id;
        } catch {
            /* ignore — best-effort: Fabric may have torn down the object */
        }
    }

    // restore the mask counter so subsequent
    // `createMask` calls do not collide with preserved mask IDs.
    if (
        typeof context.getMaskCounter === 'function' &&
        typeof context.setMaskCounter === 'function'
    ) {
        const liveCounter = Number(context.getMaskCounter());
        const safeCounter = Number.isFinite(liveCounter) ? liveCounter : 0;
        context.setMaskCounter(Math.max(safeCounter, maxRestoredId));
    }

    // Mirror legacy's `updateMaskList` call after preserved masks land.
    try {
        context.updateMaskList?.();
    } catch {
        /* ignore — DOM list update is best-effort */
    }
}

// ─── enterCropMode ──────────────────────────────────────────────────────────

export type NormalizedCropAspectRatio = number | null;

const CROP_ASPECT_RATIO_PRESETS: Readonly<Record<string, NormalizedCropAspectRatio>> =
    Object.freeze({
        free: null,
        '1:1': 1,
        '3:4': 3 / 4,
        '4:3': 4 / 3,
        '3:2': 3 / 2,
        '2:3': 2 / 3,
        '9:16': 9 / 16,
        '16:9': 16 / 9,
    });

export function normalizeCropAspectRatio(
    input: CropAspectRatio | null | undefined,
): NormalizedCropAspectRatio {
    if (input === null || input === undefined) return null;

    if (typeof input === 'number') {
        return Number.isFinite(input) && input > 0 ? input : null;
    }

    if (typeof input === 'string') {
        const trimmed = input.trim();
        if (Object.prototype.hasOwnProperty.call(CROP_ASPECT_RATIO_PRESETS, trimmed)) {
            return CROP_ASPECT_RATIO_PRESETS[trimmed] ?? null;
        }

        const parts = trimmed.split(':');
        if (parts.length !== 2) return null;
        const width = Number(parts[0]);
        const height = Number(parts[1]);
        return Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0
            ? width / height
            : null;
    }

    if (typeof input === 'object') {
        const width = Number((input as { width?: unknown }).width);
        const height = Number((input as { height?: unknown }).height);
        return Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0
            ? width / height
            : null;
    }

    return null;
}

interface CropSize {
    width: number;
    height: number;
}

function fitAspectRatioInside(maxWidth: number, maxHeight: number, aspectRatio: number): CropSize {
    const safeMaxWidth = Math.max(1, maxWidth);
    const safeMaxHeight = Math.max(1, maxHeight);
    let width = safeMaxWidth;
    let height = width / aspectRatio;

    if (height > safeMaxHeight) {
        height = safeMaxHeight;
        width = height * aspectRatio;
    }

    return {
        width: Math.max(1, width),
        height: Math.max(1, height),
    };
}

function minimumAspectRatioSizeThatFits(
    minWidth: number,
    minHeight: number,
    maxWidth: number,
    maxHeight: number,
    aspectRatio: number,
): CropSize | null {
    let width = Math.max(1, minWidth);
    let height = width / aspectRatio;
    if (height < minHeight) {
        height = Math.max(1, minHeight);
        width = height * aspectRatio;
    }

    return width <= maxWidth && height <= maxHeight ? { width, height } : null;
}

function chooseAspectRatioResizeBasis(
    canvas: FabricNS.Canvas,
    cropRect: FabricNS.Rect,
    scaleX: number,
    scaleY: number,
): 'width' | 'height' {
    const corner = String(
        (cropRect as { __corner?: unknown }).__corner ??
            (canvas as { _currentTransform?: { corner?: unknown } })._currentTransform?.corner ??
            '',
    ).toLowerCase();

    if (corner === 'mt' || corner === 'mb') return 'height';
    if (corner === 'ml' || corner === 'mr') return 'width';
    return Math.abs(scaleY - 1) > Math.abs(scaleX - 1) ? 'height' : 'width';
}

function constrainAspectRatioSize(
    requestedWidth: number,
    requestedHeight: number,
    basis: 'width' | 'height',
    aspectRatio: number,
    minWidth: number,
    minHeight: number,
    maxWidth: number,
    maxHeight: number,
): CropSize {
    const maxSize = fitAspectRatioInside(maxWidth, maxHeight, aspectRatio);
    const minSize =
        minimumAspectRatioSizeThatFits(
            minWidth,
            minHeight,
            maxSize.width,
            maxSize.height,
            aspectRatio,
        ) ?? maxSize;

    let width = basis === 'height' ? requestedHeight * aspectRatio : requestedWidth;
    let height = basis === 'height' ? requestedHeight : requestedWidth / aspectRatio;

    if (width > maxSize.width || height > maxSize.height) {
        ({ width, height } = maxSize);
    }

    if (width < minSize.width || height < minSize.height) {
        ({ width, height } = minSize);
    }

    return { width, height };
}

function resolvePaddedCropArea(
    boundsLeft: number,
    boundsTop: number,
    maxCropWidth: number,
    maxCropHeight: number,
    padding: number,
): { left: number; top: number; width: number; height: number } {
    const insetX = padding * 2 < maxCropWidth ? padding : 0;
    const insetY = padding * 2 < maxCropHeight ? padding : 0;
    return {
        left: boundsLeft + insetX,
        top: boundsTop + insetY,
        width: Math.max(1, maxCropWidth - insetX * 2),
        height: Math.max(1, maxCropHeight - insetY * 2),
    };
}

function resolveCropBounds(context: CropControllerContext): {
    boundsLeft: number;
    boundsTop: number;
    maxCropWidth: number;
    maxCropHeight: number;
    minCropWidth: number;
    minCropHeight: number;
    padding: number;
    imageBounds: { left: number; top: number; width: number; height: number };
} | null {
    const originalImage = context.getOriginalImage();
    if (!originalImage) return null;

    originalImage.setCoords();
    const { options } = context;
    const imageBounds = originalImage.getBoundingRect();
    const padding = Number.isFinite(Number(options.crop.padding))
        ? Number(options.crop.padding)
        : CROP_DEFAULT_PADDING;
    const boundsLeft = Math.max(0, Math.floor(imageBounds.left));
    const boundsTop = Math.max(0, Math.floor(imageBounds.top));
    const maxCropWidth = Math.max(1, Math.floor(imageBounds.width));
    const maxCropHeight = Math.max(1, Math.floor(imageBounds.height));
    const configuredMinWidth = Math.max(1, Number(options.crop.minWidth) || 1);
    const configuredMinHeight = Math.max(1, Number(options.crop.minHeight) || 1);

    return {
        boundsLeft,
        boundsTop,
        maxCropWidth,
        maxCropHeight,
        minCropWidth: Math.min(configuredMinWidth, maxCropWidth),
        minCropHeight: Math.min(configuredMinHeight, maxCropHeight),
        padding,
        imageBounds,
    };
}

function clampCropRectIntoBounds(
    cropRect: FabricNS.Rect,
    bounds: NonNullable<ReturnType<typeof resolveCropBounds>>,
): void {
    const width = Math.min(
        bounds.maxCropWidth,
        Math.max(
            bounds.minCropWidth,
            (Number(cropRect.width) || 1) * (Number(cropRect.scaleX) || 1),
        ),
    );
    const height = Math.min(
        bounds.maxCropHeight,
        Math.max(
            bounds.minCropHeight,
            (Number(cropRect.height) || 1) * (Number(cropRect.scaleY) || 1),
        ),
    );
    const left = Math.min(
        bounds.boundsLeft + bounds.maxCropWidth - width,
        Math.max(bounds.boundsLeft, Number(cropRect.left) || bounds.boundsLeft),
    );
    const top = Math.min(
        bounds.boundsTop + bounds.maxCropHeight - height,
        Math.max(bounds.boundsTop, Number(cropRect.top) || bounds.boundsTop),
    );

    cropRect.set({ left, top, width, height, scaleX: 1, scaleY: 1 });
}

function resizeCropRectToAspectRatio(
    context: CropControllerContext,
    cropRect: FabricNS.Rect,
    aspectRatio: NormalizedCropAspectRatio,
): void {
    const bounds = resolveCropBounds(context);
    if (!bounds) return;

    if (aspectRatio === null) {
        clampCropRectIntoBounds(cropRect, bounds);
        cropRect.setCoords();
        return;
    }

    const available = resolvePaddedCropArea(
        bounds.boundsLeft,
        bounds.boundsTop,
        bounds.maxCropWidth,
        bounds.maxCropHeight,
        bounds.padding,
    );
    const fitted = fitAspectRatioInside(available.width, available.height, aspectRatio);
    cropRect.set({
        left: available.left + (available.width - fitted.width) / 2,
        top: available.top + (available.height - fitted.height) / 2,
        width: fitted.width,
        height: fitted.height,
        scaleX: 1,
        scaleY: 1,
    });
    cropRect.setCoords();
}

function updateCropRectControlVisibility(
    cropRect: FabricNS.Rect,
    aspectRatio: NormalizedCropAspectRatio,
    allowRotationOfCropRect: boolean,
): void {
    const lockedRatio = aspectRatio !== null;

    cropRect.setControlsVisibility({
        tl: true,
        tr: true,
        br: true,
        bl: true,
        mt: !lockedRatio,
        mb: !lockedRatio,
        ml: !lockedRatio,
        mr: !lockedRatio,
        mtr: allowRotationOfCropRect,
    });
    cropRect.setCoords();
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
 * @param context - Editor dependency bundle — see {@link CropControllerContext}.
 *
 */
export function enterCropMode(
    context: CropControllerContext,
    cropModeOptions: CropModeOptions = {},
): void {
    const { canvas, options } = context;
    if (context.getCropSession()) return;
    const originalImage = context.getOriginalImage();
    if (!originalImage) return;
    if (!context.isImageLoaded()) return;

    // discard ActiveSelection BEFORE mutating crop state.
    canvas.discardActiveObject();

    // capture the pre-crop snapshot BEFORE the crop
    // rectangle is added so the JSON is guaranteed crop-rect-free. The
    // state serializer also discards ActiveSelection on its own path.
    const beforeJson = context.saveState();
    const prevSelection = !!canvas.selection;
    canvas.selection = false;

    // Derive the initial crop rectangle bounds from the image bounding
    // box and the configured padding inset. Mirrors legacy's enterCropMode.
    originalImage.setCoords();
    const imageBounds = originalImage.getBoundingRect();
    const padding = Number.isFinite(Number(options.crop.padding))
        ? Number(options.crop.padding)
        : CROP_DEFAULT_PADDING;
    const boundsLeft = Math.max(0, Math.floor(imageBounds.left));
    const boundsTop = Math.max(0, Math.floor(imageBounds.top));
    const maxCropWidth = Math.max(1, Math.floor(imageBounds.width));
    const maxCropHeight = Math.max(1, Math.floor(imageBounds.height));
    const configuredMinWidth = Math.max(1, Number(options.crop.minWidth) || 1);
    const configuredMinHeight = Math.max(1, Number(options.crop.minHeight) || 1);
    const minCropWidth = Math.min(configuredMinWidth, maxCropWidth);
    const minCropHeight = Math.min(configuredMinHeight, maxCropHeight);
    const allowRotation = !!options.crop.allowRotationOfCropRect;
    const aspectRatio = normalizeCropAspectRatio(
        cropModeOptions.aspectRatio ?? options.crop.aspectRatio,
    );

    let rectLeft: number;
    let rectTop: number;
    let rectWidth: number;
    let rectHeight: number;

    const available = resolvePaddedCropArea(
        boundsLeft,
        boundsTop,
        maxCropWidth,
        maxCropHeight,
        padding,
    );
    if (aspectRatio === null) {
        rectWidth = Math.max(minCropWidth, available.width);
        rectHeight = Math.max(minCropHeight, available.height);
        rectLeft = Math.min(
            boundsLeft + maxCropWidth - rectWidth,
            Math.max(boundsLeft, available.left + (available.width - rectWidth) / 2),
        );
        rectTop = Math.min(
            boundsTop + maxCropHeight - rectHeight,
            Math.max(boundsTop, available.top + (available.height - rectHeight) / 2),
        );
    } else {
        const fitted = fitAspectRatioInside(available.width, available.height, aspectRatio);
        rectWidth = fitted.width;
        rectHeight = fitted.height;
        rectLeft = available.left + (available.width - rectWidth) / 2;
        rectTop = available.top + (available.height - rectHeight) / 2;
    }

    const cropRect = new context.fabric.Rect({
        left: rectLeft,
        top: rectTop,
        width: rectWidth,
        height: rectHeight,
        originX: 'left',
        originY: 'top',
        fill: CROP_RECT_FILL,
        stroke: CROP_RECT_STROKE,
        strokeDashArray: CROP_RECT_DASH,
        strokeWidth: 1,
        strokeUniform: true,
        selectable: true,
        lockRotation: !allowRotation,
        cornerSize: CROP_RECT_CORNER_SIZE,
        objectCaching: false,
        lockScalingFlip: true,
    });
    updateCropRectControlVisibility(cropRect, aspectRatio, allowRotation);

    canvas.add(cropRect);
    // Tag the rect so the state serializer's session-only filter
    // excludes it from snapshots taken while the session is open.
    markSessionObject(cropRect, 'cropRect');
    (cropRect as FabricNS.Rect & { isCropRect?: boolean }).isCropRect = true;
    canvas.bringObjectToFront(cropRect);
    canvas.setActiveObject(cropRect);

    // Capture per-mask style backups BEFORE the freeze
    // loop runs and BEFORE any hide-style is applied so the recorded
    // values (`opacity`, `fill`, `strokeWidth`, `stroke`, `selectable`,
    // `lockRotation`) are the true pre-crop live values. The actual hide
    // style is applied AFTER the freeze loop below so the freeze loop's
    // own `prevEvented` capture also sees pre-crop values.
    const hideMasks = !!options.crop.hideMasksDuringCrop;
    const maskBackups: MaskBackup[] = [];
    if (hideMasks) {
        canvas.getObjects().forEach((object) => {
            if (object === cropRect) return;
            if (!isMaskObject(object)) return;
            maskBackups.push(captureMaskStyleBackup(object));
        });
    }

    // freeze every existing object and capture its
    // prior `evented` / `selectable` state. The crop rectangle itself
    // is excluded so it remains interactive.
    const prevEvented: CropPrevEvented[] = [];
    canvas.getObjects().forEach((object) => {
        if (object === cropRect) return;
        prevEvented.push({
            object,
            evented: object.evented ?? true,
            selectable: object.selectable ?? true,
        });
        try {
            object.set({ evented: false, selectable: false });
        } catch {
            /* ignore — best-effort freeze */
        }
    });

    // Apply the crop-mode hide style on every backed-up
    // mask. Runs AFTER the freeze loop so both the mask backup (above)
    // and `prevEvented` (just above) recorded pre-crop values. The hide
    // style additionally forces `opacity: 0` so the mask is visually
    // hidden while the crop session is open.
    if (hideMasks) {
        for (const backup of maskBackups) {
            applyCropHideMaskStyle(backup.object);
        }
    }

    // Bind drag/scale clamps so the rect cannot exit the image bounds
    // nor shrink below the configured minimum dimensions. Matches legacy's
    // `handleCropRectModified`.
    const handleCropRectModified = (): void => {
        try {
            const cropWidth = Math.max(1, Number(cropRect.width) || 1);
            const cropHeight = Math.max(1, Number(cropRect.height) || 1);
            let nextScaleX: number;
            let nextScaleY: number;

            const activeSession = context.getCropSession();
            const activeAspectRatio = activeSession ? activeSession.aspectRatio : aspectRatio;

            if (activeAspectRatio === null) {
                nextScaleX = Math.min(
                    maxCropWidth / cropWidth,
                    Math.max(minCropWidth / cropWidth, Number(cropRect.scaleX) || 1),
                );
                nextScaleY = Math.min(
                    maxCropHeight / cropHeight,
                    Math.max(minCropHeight / cropHeight, Number(cropRect.scaleY) || 1),
                );
            } else {
                const rawScaleX = Math.max(0.0001, Number(cropRect.scaleX) || 1);
                const rawScaleY = Math.max(0.0001, Number(cropRect.scaleY) || 1);
                const basis = chooseAspectRatioResizeBasis(canvas, cropRect, rawScaleX, rawScaleY);
                const constrained = constrainAspectRatioSize(
                    cropWidth * rawScaleX,
                    cropHeight * rawScaleY,
                    basis,
                    activeAspectRatio,
                    minCropWidth,
                    minCropHeight,
                    maxCropWidth,
                    maxCropHeight,
                );
                nextScaleX = constrained.width / cropWidth;
                nextScaleY = constrained.height / cropHeight;
            }

            const scaledWidth = cropWidth * nextScaleX;
            const scaledHeight = cropHeight * nextScaleY;
            const maxLeft = Math.max(boundsLeft, boundsLeft + maxCropWidth - scaledWidth);
            const maxTop = Math.max(boundsTop, boundsTop + maxCropHeight - scaledHeight);
            const nextLeft = Math.min(
                maxLeft,
                Math.max(boundsLeft, Number(cropRect.left) || boundsLeft),
            );
            const nextTop = Math.min(
                maxTop,
                Math.max(boundsTop, Number(cropRect.top) || boundsTop),
            );
            cropRect.set({
                left: nextLeft,
                top: nextTop,
                scaleX: nextScaleX,
                scaleY: nextScaleY,
            });
            cropRect.setCoords();
            canvas.requestRenderAll();
        } catch {
            /* ignore — defensive against torn-down canvases */
        }
    };
    cropRect.on('modified', handleCropRectModified);
    cropRect.on('moving', handleCropRectModified);
    cropRect.on('scaling', handleCropRectModified);

    const session: CropSession = {
        beforeJson,
        prevSelection,
        prevEvented,
        // Populated above when `options.crop.hideMasksDuringCrop` is true;
        // empty array otherwise.
        maskBackups,
        cropRect,
        aspectRatio,
        handlers: [
            {
                target: cropRect,
                handlers: [
                    { eventName: 'modified', callback: handleCropRectModified },
                    { eventName: 'moving', callback: handleCropRectModified },
                    { eventName: 'scaling', callback: handleCropRectModified },
                ],
            },
        ],
    };
    context.setCropSession(session);
    // Paint synchronously so the active crop rectangle is visible before
    // enterCropMode returns to callers that immediately inspect the canvas.
    canvas.renderAll();
}

export function setCropAspectRatio(
    context: CropControllerContext,
    aspectRatioInput: CropAspectRatio | null | undefined,
): void {
    const session = context.getCropSession();
    if (!session?.cropRect) return;

    const aspectRatio = normalizeCropAspectRatio(aspectRatioInput);
    session.aspectRatio = aspectRatio;
    resizeCropRectToAspectRatio(context, session.cropRect, aspectRatio);
    updateCropRectControlVisibility(
        session.cropRect,
        aspectRatio,
        !!context.options.crop.allowRotationOfCropRect,
    );
    context.canvas.setActiveObject(session.cropRect);
    context.canvas.requestRenderAll();
}

// ─── cancelCrop ─────────────────────────────────────────────────────────────

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
 * @param context - Editor dependency bundle — see {@link CropControllerContext}.
 *
 */
export function cancelCrop(context: CropControllerContext): void {
    const session = context.getCropSession();
    if (!session) return;

    // discard ActiveSelection BEFORE mutating crop state.
    context.canvas.discardActiveObject();

    teardownSession(context, session);
    context.setCropSession(null);

    try {
        // The crop rectangle and frozen object flags are restored in this
        // call stack, so flush the visible canvas before returning.
        context.canvas.renderAll();
    } catch {
        /* ignore — canvas may have been disposed mid-cancel */
    }
}

// ─── applyCrop ──────────────────────────────────────────────────────────────

/**
 * Apply the active crop session: export the crop region as an intermediate data
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
 *    remove the masks from the canvas so the cropped intermediate image export does
 *    not bake them in (and so the inner `context.loadImage`'s
 *    `canvas.clear` does not dispose the captured reference). Masks
 *    fully outside the crop region are removed without a record so
 *    they do not reappear after the load (matches legacy's `intersectsCrop`
 *    filter).
 * 4. **Tear down session in place** — restore per-object evented /
 *    selectable values (so the export sees masks in their pre-crop
 *    state) and remove the crop rectangle along with its handlers. The
 *    session pointer is NOT cleared yet
 *    because the catch path may still need `session.beforeJson`.
 * 5. **Restore `canvas.selection`** — back to the pre-crop value before
 *    the cropped image is exported.
 * 6. **Export the crop region** via `canvas.toDataURL` with the
 *    integer region as `left` / `top` / `width` / `height` (matches
 *    legacy's `_exportCanvasRegionToDataURL`). The cropped image uses the resolved crop export
 *    format and lossy quality when applicable.
 * 7. **Reload the cropped image** through `context.loadImage`. The
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
 * - restores the pre-crop snapshot via `context.loadFromState`,
 * - rejects with {@link CropApplyError} wrapping the original cause.
 *
 * Mask handling note: when `options.crop.preserveMasksAfterCrop` is
 * `false` (the current default), the inner
 * `context.loadImage(croppedBase64)` call replaces every canvas object
 * with the cropped base image, so any masks are removed naturally
 * with no extra work in this function. When `preserveMasksAfterCrop`
 * is `true`, masks intersecting the crop region are captured before
 * the export and re-added after the load via
 * {@link capturePreservedMasks} / {@link reapplyPreservedMasks}.
 * Crop-mode mask hiding on entry / restoration on cancel is handled
 * in {@link enterCropMode} and the {@link teardownSession} chain.
 *
 * @param context - Editor dependency bundle — see {@link CropControllerContext}.
 * @returns   Resolves on success; rejects with {@link CropApplyError}
 *            on any pipeline failure (after the pre-crop snapshot has
 *            been restored).
 *
 */
export async function applyCrop(context: CropControllerContext): Promise<void> {
    const session = context.getCropSession();
    if (!session || !session.cropRect) return;
    const { canvas } = context;

    // discard ActiveSelection BEFORE mutating crop state.
    canvas.discardActiveObject();

    const beforeJson = session.beforeJson;
    const cropRect = session.cropRect;
    const preserveMasks = !!context.options.crop.preserveMasksAfterCrop;

    try {
        // 3. Read the crop region. Refresh coords first because Fabric v7
        //    caches the absolute bounding rect; without `setCoords` a
        //    freshly-resized rect returns stale bounds.
        cropRect.setCoords();
        const cropAngle = Number(cropRect.angle) || 0;
        if (!context.options.crop.allowRotationOfCropRect && Math.abs(cropAngle % 360) > 0.01) {
            throw new CropApplyError('applyCrop failed: rotated crop rectangles are disabled.');
        }
        const rectBounds = getCropRectContentBounds(cropRect);
        if (!hasMeaningfulCanvasRegion(rectBounds, canvas.getWidth(), canvas.getHeight())) {
            throw new CropApplyError(
                'applyCrop failed: crop region is empty or outside the canvas.',
            );
        }
        const cropRegion = getClampedCanvasRegion(
            rectBounds,
            canvas.getWidth(),
            canvas.getHeight(),
            { includePartialPixels: false },
        );

        // 3a. when
        //     `preserveMasksAfterCrop` is `true`, capture each mask's
        //     pre-crop `left`, `top`, `angle`, `scaleX`, `scaleY`
        //     BEFORE the export and remove the masks from the canvas
        //     so the cropped intermediate image does not bake them in. Removing the
        //     masks BEFORE `context.loadImage` also keeps the captured
        //     Fabric reference alive across the loader's `canvas.clear`
        //     call (the masks are detached from the canvas but the
        //     records still hold the live objects). The post-load
        //     reapply step shifts each mask by `-cropRegion.left,
        //     -cropRegion.top` (matches legacy's
        //     `_translateObjectByCanvasOffset`).
        //
        //     The intersection filter (matches legacy's `intersectsCrop`)
        //     drops masks fully outside the crop region — they are
        //     removed from the canvas without a record so they do not
        //     reappear after the load.
        const preservedRecords: PreservedMaskRecord[] = preserveMasks
            ? capturePreservedMasks(canvas, cropRegion, session.maskBackups)
            : [];

        // 4. Tear down session in place. Restoring per-object evented and
        //    selectable BEFORE the export means the cropped intermediate image sees
        //    masks (and any other interactive objects) in their original
        //    visual state. Removing the crop rectangle here also keeps
        //    it out of the exported region.
        restoreCropObjectState(session);
        removeCropRect(context, session);

        // 5. Restore `canvas.selection` to its pre-crop value.
        canvas.selection = !!session.prevSelection;

        // 6. Export the crop region. The intermediate format defaults to
        //    source-preserving with a lossless PNG fallback for unknown
        //    sources.
        const cropFormat = resolveCropExportFormat({
            cropExportFileType: context.options.crop.exportFileType,
            currentImageMimeType: context.getCurrentImageMimeType?.() ?? null,
            cropExportQuality: context.options.crop.exportQuality,
            downsampleQuality: context.options.downsampleQuality,
        });
        const exportOptions: Record<string, unknown> = {
            format: cropFormat.format,
            multiplier: 1,
            left: cropRegion.left,
            top: cropRegion.top,
            width: cropRegion.width,
            height: cropRegion.height,
        };
        if (cropFormat.quality !== undefined) {
            exportOptions.quality = cropFormat.quality;
        }
        const croppedBase64 = canvas.toDataURL(
            exportOptions as Parameters<typeof canvas.toDataURL>[0],
        );

        // 7. Reload through the transactional loader. A decode / Fabric /
        //    timeout failure rejects here and the rollback path catches.
        await context.loadImage(croppedBase64);

        // 7a. re-add every captured mask
        //     to the post-crop canvas with its `left` / `top` shifted
        //     by `-cropRegion.left, -cropRegion.top`. The loader has
        //     reset `maskCounter` to 0 and committed a fresh
        //     `originalImage`; the helper bumps the counter back to
        //     `max(maskId)` so subsequent `createMask` calls do not
        //     collide.
        if (preservedRecords.length > 0) {
            reapplyPreservedMasks(context, cropRegion, preservedRecords);
            // Re-added masks must be visible before the post-crop snapshot
            // is captured and before applyCrop resolves.
            canvas.renderAll();
        }

        // 8. Capture the post-crop snapshot for the redo command.
        const afterJson = context.saveState();

        // 9. Drop the session pointer BEFORE pushing the history entry.
        //    The session itself was already torn down in step 4; this
        //    just clears the orchestrator's pointer.
        context.setCropSession(null);

        // 10. push exactly one history entry. Use
        //     `push` (not `execute`) because the cropped state is
        //     already on the canvas; the first `redo` after an `undo`
        //     should re-run the post-crop restore via the command's
        //     `execute`.
        if (beforeJson && afterJson && beforeJson !== afterJson) {
            context.historyManager.push(
                new Command(
                    () => context.loadFromState(afterJson),
                    () => context.loadFromState(beforeJson),
                ),
            );
        }
    } catch (error) {
        // restore the pre-crop snapshot, drop the
        // session, and reject with `CropApplyError`. A failure inside
        // the rollback itself is logged but does NOT mask the original
        // error.
        teardownSession(context, session);
        context.setCropSession(null);

        try {
            await context.loadFromState(beforeJson);
        } catch (rollbackError) {
            console.warn('[ImageEditor] applyCrop: rollback failed', rollbackError);
        }

        if (error instanceof CropApplyError) throw error;
        const message =
            error instanceof Error ? `applyCrop failed: ${error.message}` : 'applyCrop failed';
        throw new CropApplyError(message, error);
    }
}
