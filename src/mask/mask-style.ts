/**
 * @file mask/mask-style.ts
 * @description Hover, selection, and "original style restore" helpers for
 *              mask visual state. Owns the legacy `_getMaskNormalStyle`,
 *              `_withNormalizedMaskStyles`, `_rebindMaskEvents`, and the
 *              selected/unselected stroke logic from `_handleSelectionChanged`
 *              that were inlined on the editor in legacy and are now extracted
 *              into pure(ish) helpers that take a {@link MaskStyleContext}.
 *
 * Two callers consume the same backup shape:
 *
 * - Export bake-in (`export/export-service.ts`) — temporarily forces every
 *   mask to `opacity: 1, fill: '#000', strokeWidth: 0, stroke: null,
 *   selectable: false` so the rendered raster has solid black masks, and
 *   restores the live values inside a `finally` block whether the export
 *   succeeded or threw.
 *
 * - Crop session (`crop/crop-controller.ts`) — backs up the same fields plus
 *   `lockRotation` when entering crop mode and restores them on
 *   `cancelCrop`.
 *
 * Centralizing the backup shape, the hover style literals (`#ff5500`,
 * `strokeWidth: 2`, `opacity = originalAlpha + 0.2`), and the
 * selected/unselected stroke literals (`#ff0000`, `mask.originalStroke ||
 * '#ccc'`) here means the legacy visuals stay pixel-identical and any future
 * tweak happens in one place.
 *
 * ## Owned contracts
 *
 * - {@link captureMaskStyleBackup} captures the prior
 *   live values for `opacity`, `fill`, `stroke`, `strokeWidth`, `selectable`,
 *   and `lockRotation` BEFORE any export-only mutation runs. The backup
 *   shape matches {@link MaskBackup} in `core/public-types.ts`.
 *
 * - {@link withMaskStyleBackup} runs the supplied
 *   mutator → callback inside a `try/finally` so {@link restoreMaskStyleBackup}
 *   is called regardless of whether the callback resolved or threw.
 *
 * - Each restored field is the exact value captured
 *   at the start of the operation; the restore performs no defaulting and
 *   no clamping, so an export-only style is never observable on any mask
 *   after the operation returns.
 *
 * - {@link applyCropHideMaskStyle} sets `opacity: 0`
 *   and `evented: false` on a mask so the user cannot interact with it
 *   while the crop rectangle is the only interactive object. The caller is
 *   expected to have captured a backup via {@link captureMaskStyleBackup}
 *   first.
 *
 * - {@link restoreMaskStyleBackup} restores
 *   `opacity`, `fill`, `strokeWidth`, `stroke`, `selectable`, and
 *   `lockRotation` from the captured {@link MaskBackup}, matching the current
 *   documented `MaskBackup` interface.
 *
 * - **Mirrors legacy hover behavior** — {@link attachMaskHoverHandlers} and
 *   {@link reattachMaskHoverHandlers} bind the same `mouseover`/`mouseout`
 *   handlers legacy's `_rebindMaskEvents` used. The handlers read
 *   `mask.originalAlpha` / `mask.originalStroke` / `mask.originalStrokeWidth`
 *   on each invocation so they always reflect the current "live" state
 *   (e.g. after a stroke change from a selection event).
 *
 * - **Mirrors legacy selection styling** — {@link applyMaskSelectedStyle} sets
 *   the selection-highlight stroke (`#ff0000`, `strokeWidth: 1`) and
 *   {@link applyMaskUnselectedStyle} restores the normal stroke from the
 *   per-mask `originalStroke` / `originalStrokeWidth`. Both literals match
 *   legacy's `_handleSelectionChanged`.
 *
 * ## Out of scope (handled by sibling modules)
 *
 * - Mask creation, falsy-style preservation, polygon placement — see
 *   `mask/mask-factory.ts`.
 * - Mask label overlay — see `mask/mask-label-manager.ts`.
 * - Mask list DOM — see `mask/mask-list.ts`.
 *
 * ## Implementation notes
 *
 * - The orchestrator (`src/image-editor.ts`) owns the canvas reference and
 *   the resolved options. The helpers in this module receive those slots
 *   through a {@link MaskStyleContext} so the module is independent of the
 *   `ImageEditor` class shape and can be unit tested in isolation against
 *   a stub Fabric environment.
 * - Hover handlers do NOT cache the normal/hover style at attach time. They
 *   read `mask.originalAlpha` / `mask.originalStroke` / `mask.originalStrokeWidth`
 *   on every event so the visual matches the live "original" values even
 *   after a stroke or opacity change (matching legacy).
 * - The handlers are tagged on `mask.__imageEditorMaskHandlers` exactly as
 *   legacy did so {@link reattachMaskHoverHandlers} can drop the old pair before
 *   binding fresh ones, avoiding duplicate listeners after `loadFromJSON`.
 */

import type * as FabricNS from 'fabric';
import type { MaskBackup, MaskObject, ResolvedOptions } from '../core/public-types.js';
import { isMaskObject } from '../core/public-types.js';

// ─── Constants — visual literals (match legacy verbatim) ─────────────────────────

/** Selected-mask highlight stroke (legacy's `_handleSelectionChanged`). */
const SELECTED_STROKE = '#ff0000';
/** Selected-mask highlight stroke width. */
const SELECTED_STROKE_WIDTH = 1;
/** Hover highlight stroke (legacy's `_rebindMaskEvents`). */
const HOVER_STROKE = '#ff5500';
/** Hover highlight stroke width. */
const HOVER_STROKE_WIDTH = 2;
/** Hover bumps opacity by this much, capped at 1. */
const HOVER_OPACITY_BUMP = 0.2;
/** Default fallback stroke when `mask.originalStroke` is unset (legacy: `#ccc`). */
const DEFAULT_STROKE_FALLBACK = '#ccc';
/** Default fallback stroke width when `mask.originalStrokeWidth` is unset. */
const DEFAULT_STROKE_WIDTH_FALLBACK = 1;
/** Default fallback opacity when `mask.originalAlpha` is unset. */
const DEFAULT_ALPHA_FALLBACK = 0.5;

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * State the mask-style helpers read from the `ImageEditor` orchestrator.
 *
 * The module does NOT own any of these slots — it only reads them so
 * ownership of the canvas and resolved options stays on the orchestrator
 * (where legacy left them).
 */
export interface MaskStyleContext {
    /**
     * The live Fabric canvas. May be `null` after `dispose` or before
     * `init` has run; the helpers no-op in that case.
     */
    canvas: FabricNS.Canvas | null;
    /**
     * Fully resolved editor options. Only consulted by helpers that need
     * the export-bake-in fill (`#000` matches legacy) or the crop visibility
     * defaults; most helpers operate on the per-mask `original*` fields
     * and do not need this slot.
     */
    options?: ResolvedOptions;
}

/**
 * The "normal" (non-hover, non-selected) style of a mask, computed from
 * its persisted `original*` fields. Matches the shape returned by legacy's
 * `_getMaskNormalStyle`.
 */
export interface MaskNormalStyle {
    stroke: FabricNS.TFiller | string | null;
    strokeWidth: number;
    opacity: number;
}

/**
 * Tag attached to a mask by {@link attachMaskHoverHandlers} so
 * {@link reattachMaskHoverHandlers} can drop the prior pair before
 * binding fresh ones (matches legacy's `__imageEditorMaskHandlers`).
 *
 * @internal
 */
interface MaskHoverHandlerTag {
    mouseover: () => void;
    mouseout: () => void;
}

/** @internal — narrow type alias for masks carrying the hover-handler tag. */
type MaskWithHoverTag = MaskObject & {
    __imageEditorMaskHandlers?: MaskHoverHandlerTag;
};

// ─── Normal-style readers ────────────────────────────────────────────────────

/**
 * Compute the "normal" (non-hover, non-selected) style of `mask` from its
 * persisted `original*` fields, with legacy-identical fallbacks.
 *
 * - `stroke` → `mask.originalStroke`, falling back to `'#ccc'` (legacy).
 * - `strokeWidth` → `Number(mask.originalStrokeWidth)` if finite, else `1`.
 * - `opacity` → `Number(mask.originalAlpha)` if finite, else `0.5`.
 *
 * The result is used by:
 * - {@link applyMaskNormalStyle} to restore on `mouseout`,
 * - {@link applyMaskUnselectedStyle} to restore the un-highlighted stroke,
 * - export bake-in callers that want a pre-mutation snapshot of the live
 *   visual when no `MaskBackup` is being captured.
 *
 * @param mask The mask to inspect.
 * @returns A {@link MaskNormalStyle} ready to pass to `mask.set(...)`.
 */
export function getMaskNormalStyle(mask: MaskObject): MaskNormalStyle {
    const strokeWidth = Number(mask.originalStrokeWidth);
    const opacity = Number(mask.originalAlpha);
    return {
        stroke: mask.originalStroke ?? DEFAULT_STROKE_FALLBACK,
        strokeWidth: Number.isFinite(strokeWidth) ? strokeWidth : DEFAULT_STROKE_WIDTH_FALLBACK,
        opacity: Number.isFinite(opacity) ? opacity : DEFAULT_ALPHA_FALLBACK,
    };
}

/**
 * Compute the "hover" style for `mask`, derived from its normal style.
 *
 * - `stroke` → `'#ff5500'` (legacy).
 * - `strokeWidth` → `2` (legacy).
 * - `opacity` → `min(originalAlpha + 0.2, 1)` (legacy).
 *
 * @param mask The mask to inspect.
 * @returns A style patch ready to pass to `mask.set(...)`.
 */
export function getMaskHoverStyle(mask: MaskObject): MaskNormalStyle {
    const opacity = Number(mask.originalAlpha);
    const baseAlpha = Number.isFinite(opacity) ? opacity : DEFAULT_ALPHA_FALLBACK;
    return {
        stroke: HOVER_STROKE,
        strokeWidth: HOVER_STROKE_WIDTH,
        opacity: Math.min(baseAlpha + HOVER_OPACITY_BUMP, 1),
    };
}

// ─── Selection styling (legacy _handleSelectionChanged) ──────────────────────────

/**
 * Apply the selected-mask highlight stroke. Matches legacy's literal
 * (`stroke: '#ff0000'`, `strokeWidth: 1`).
 *
 * Does NOT change opacity — the selection highlight only modifies the
 * outline so the user can still see the mask's tinted fill.
 *
 * @param mask The mask becoming selected.
 */
export function applyMaskSelectedStyle(mask: MaskObject): void {
    mask.set({ stroke: SELECTED_STROKE, strokeWidth: SELECTED_STROKE_WIDTH });
}

/**
 * Restore the un-highlighted stroke on `mask` after selection moves to a
 * different object. Reads the per-mask `originalStroke`/`originalStrokeWidth`
 * (matching legacy's `_handleSelectionChanged`) so the value is the one the
 * mask carried before any selection-time mutation.
 *
 * Does NOT touch `opacity` — the un-highlighted state retains the live
 * opacity (which may differ from `originalAlpha` while a hover is in
 * progress, etc.).
 *
 * @param mask The mask becoming un-selected.
 */
export function applyMaskUnselectedStyle(mask: MaskObject): void {
    const strokeWidth = Number(mask.originalStrokeWidth);
    mask.set({
        stroke: mask.originalStroke ?? DEFAULT_STROKE_FALLBACK,
        strokeWidth: Number.isFinite(strokeWidth) ? strokeWidth : DEFAULT_STROKE_WIDTH_FALLBACK,
    });
}

// ─── Hover handler attach / reattach ─────────────────────────────────────────

/**
 * Bind `mouseover`/`mouseout` handlers on `mask` that toggle the legacy hover
 * highlight. The handlers re-read `mask.originalAlpha` /
 * `mask.originalStroke` / `mask.originalStrokeWidth` on each event so they
 * track any post-attach mutation (matching legacy's `_rebindMaskEvents`).
 *
 * Handlers are tagged on `mask.__imageEditorMaskHandlers` so
 * {@link reattachMaskHoverHandlers} can drop them before binding a new
 * pair, avoiding duplicates after a `loadFromJSON` restore.
 *
 * Idempotent — calling twice on the same mask without an intervening
 * detach simply produces two pairs of listeners. Use
 * {@link reattachMaskHoverHandlers} to refresh listeners safely.
 *
 * @param mask The mask to bind handlers on.
 */
export function attachMaskHoverHandlers(mask: MaskObject): void {
    const tagged = mask as MaskWithHoverTag;

    const mouseover = (): void => {
        tagged.set(getMaskHoverStyle(tagged));
        tagged.canvas?.requestRenderAll();
    };
    const mouseout = (): void => {
        tagged.set(getMaskNormalStyle(tagged));
        tagged.canvas?.requestRenderAll();
    };

    tagged.on('mouseover', mouseover);
    tagged.on('mouseout', mouseout);
    tagged.__imageEditorMaskHandlers = { mouseover, mouseout };
}

/**
 * Drop any previously-attached hover handler pair (best-effort) and bind a
 * fresh pair via {@link attachMaskHoverHandlers}.
 *
 * Used after `canvas.loadFromJSON` in `core/state-serializer.ts`'s
 * `loadFromState` flow, because Fabric never serializes event listeners,
 * so masks restored from history have lost their hover styling. The
 * orchestrator re-runs this helper for every restored mask.
 *
 * Also re-asserts the persisted `original*` metadata when missing — legacy's
 * `_rebindMaskEvents` did the same so a snapshot from an older format that
 * happens to lack `originalStroke`/`originalStrokeWidth` still hovers
 * correctly. The current Pretty_Printer always serializes
 * `originalAlpha`, but we defend against partial payloads here too.
 *
 * @param mask The mask to refresh handlers on.
 */
export function reattachMaskHoverHandlers(mask: MaskObject): void {
    const tagged = mask as MaskWithHoverTag;

    // Drop the previous pair if present. Fabric v7's `off(event, fn)`
    // removes that specific handler; `off(event)` removes every handler
    // for the event. We use the specific form so callers that bind their
    // own listeners outside this module are not affected.
    if (tagged.__imageEditorMaskHandlers) {
        try {
            tagged.off('mouseover', tagged.__imageEditorMaskHandlers.mouseover);
            tagged.off('mouseout', tagged.__imageEditorMaskHandlers.mouseout);
        } catch {
            /* ignore — handler may already be detached */
        }
        delete tagged.__imageEditorMaskHandlers;
    }

    // Re-assert persisted metadata when missing so the freshly-bound
    // handlers can read sensible originals. legacy did this in
    // `_rebindMaskEvents` to defend against snapshots without the custom
    // keys.
    const patch: Partial<{
        originalAlpha: number;
        originalStroke: FabricNS.TFiller | string | null;
        originalStrokeWidth: number;
    }> = {};
    if (!Number.isFinite(Number(tagged.originalAlpha))) {
        const opacity = Number(tagged.opacity);
        patch.originalAlpha = Number.isFinite(opacity) ? opacity : DEFAULT_ALPHA_FALLBACK;
    }
    if (tagged.originalStroke == null) {
        patch.originalStroke = tagged.stroke ?? DEFAULT_STROKE_FALLBACK;
    }
    if (!Number.isFinite(Number(tagged.originalStrokeWidth))) {
        const sw = Number(tagged.strokeWidth);
        patch.originalStrokeWidth = Number.isFinite(sw) ? sw : DEFAULT_STROKE_WIDTH_FALLBACK;
    }
    if (Object.keys(patch).length > 0) tagged.set(patch);

    attachMaskHoverHandlers(tagged);
}

/**
 * Detach the hover handler pair previously bound by
 * {@link attachMaskHoverHandlers} (or {@link reattachMaskHoverHandlers}).
 *
 * Best-effort — wraps each `off(...)` in `try/catch` so a stale Fabric
 * reference does not break callers that iterate every mask (e.g. the
 * `dispose` path or `removeAllMasks`).
 *
 * @param mask The mask to detach handlers from.
 */
export function detachMaskHoverHandlers(mask: MaskObject): void {
    const tagged = mask as MaskWithHoverTag;
    if (!tagged.__imageEditorMaskHandlers) return;
    try {
        tagged.off('mouseover', tagged.__imageEditorMaskHandlers.mouseover);
        tagged.off('mouseout', tagged.__imageEditorMaskHandlers.mouseout);
    } catch {
        /* ignore */
    }
    delete tagged.__imageEditorMaskHandlers;
}

// ─── Mask style backup (export bake-in + crop session) ───────────────────────

/**
 * Snapshot the current live values of the fields that both the export
 * bake-in path and the crop session need to restore later.
 *
 * Captured fields:
 *
 * - `opacity` — restored when the export ends or the crop is canceled.
 * - `fill` — export bake-in temporarily forces `'#000'`; crop never
 *   changes fill but captures it so a single restore call works for both.
 * - `strokeWidth` — export bake-in forces `0`.
 * - `stroke` — export bake-in forces `null`.
 * - `selectable` — both paths force `false` so the mask is not draggable
 *   while the operation is in progress.
 * - `lockRotation` — the crop session captures this because some integrators
 *   set `maskRotatable: true` and the rotation lock is part of the
 *   per-mask state.
 *
 * Defaults match legacy: missing `opacity` → `1`, missing `selectable` →
 * `true`, missing `lockRotation` → `false`. They never override a
 * caller-supplied value because the snapshot reads from the live mask.
 *
 * @param mask The mask whose live style should be captured.
 * @returns A {@link MaskBackup} suitable for passing to
 *          {@link restoreMaskStyleBackup}.
 */
export function captureMaskStyleBackup(mask: MaskObject): MaskBackup {
    return {
        obj: mask,
        opacity: mask.opacity ?? 1,
        fill: (mask.fill ?? null) as FabricNS.TFiller | string | null,
        strokeWidth: mask.strokeWidth ?? 0,
        stroke: (mask.stroke ?? null) as FabricNS.TFiller | string | null,
        selectable: mask.selectable ?? true,
        lockRotation: mask.lockRotation ?? false,
    };
}

/**
 * Restore every backed-up field from a {@link MaskBackup} onto the mask
 * referenced by `backup.obj`.
 *
 * Wraps the `set(...)` call in `try/catch` so a stale Fabric reference (a
 * mask removed after the backup was captured but before the restore
 * finally block ran) does not break callers iterating multiple backups.
 * After a successful restore, `setCoords` is called to keep Fabric's
 * cached bounding rect in sync (matching legacy's mergeMasks restore).
 *
 * @param backup The backup produced by {@link captureMaskStyleBackup}.
 *
 */
export function restoreMaskStyleBackup(backup: MaskBackup): void {
    try {
        backup.obj.set({
            opacity: backup.opacity,
            fill: backup.fill,
            strokeWidth: backup.strokeWidth,
            stroke: backup.stroke,
            selectable: backup.selectable,
            lockRotation: backup.lockRotation,
        });
        if (typeof backup.obj.setCoords === 'function') {
            backup.obj.setCoords();
        }
    } catch {
        /* ignore — mask may have been removed after the backup was captured */
    }
}

// ─── withMaskStyleBackup — export-only style restoration ───────

/**
 * Captured "live" style of a mask, used only by
 * {@link withNormalizedMaskStyles}.
 *
 * @internal
 */
interface NormalizedStylePatch {
    obj: MaskObject;
    /** Original values BEFORE the patch was applied (used by the finally restore). */
    snapshot: Partial<MaskNormalStyle>;
}

/**
 * Run `callback` with every mask's stroke/strokeWidth/opacity reset to the
 * persisted "normal" style ({@link getMaskNormalStyle}), then restore each
 * mutated field inside a `finally` block.
 *
 * Mirrors legacy's `_withNormalizedMaskStyles`. The two callers are:
 *
 * - The pre-snapshot pass in some history paths that wants the snapshot
 *   to capture a "clean" un-hovered, un-selected canvas regardless of the
 *   live UI state.
 * - The crop-cancel restore path that wants to clear any selection
 *   highlight before re-rendering.
 *
 * Only fields that ACTUALLY changed are captured and restored — if a mask
 * is already at its normal style, no patch is recorded for it.
 *
 * The `finally` block runs whether `callback` returned, threw, or
 * rejected. The function returns whatever `callback` returns (sync or
 * Promise), preserving the caller's control flow.
 *
 * @param ctx      Orchestration context — see {@link MaskStyleContext}.
 * @param callback Body to execute with normalized mask styles.
 * @returns        The value returned by `callback` (or the promise it returned).
 */
export function withNormalizedMaskStyles<T>(ctx: MaskStyleContext, callback: () => T): T {
    if (!ctx.canvas) return callback();
    const masks = ctx.canvas.getObjects().filter(isMaskObject);
    const patches: NormalizedStylePatch[] = [];

    try {
        for (const mask of masks) {
            const normal = getMaskNormalStyle(mask);
            const snapshot: Partial<MaskNormalStyle> = {};
            const stylePatch: Partial<MaskNormalStyle> = {};
            (Object.keys(normal) as Array<keyof MaskNormalStyle>).forEach((key) => {
                const live = (mask as unknown as Record<string, unknown>)[key];
                if (live !== normal[key]) {
                    snapshot[key] = live as never;
                    stylePatch[key] = normal[key] as never;
                }
            });
            if (Object.keys(stylePatch).length === 0) continue;
            patches.push({ obj: mask, snapshot });
            mask.set(stylePatch);
        }
        return callback();
    } finally {
        // Restore live values, even if `callback` threw. Each restore is
        // guarded so a stale mask does not break the loop.
        for (const patch of patches) {
            try {
                patch.obj.set(patch.snapshot as Partial<FabricNS.FabricObjectProps>);
            } catch {
                /* ignore */
            }
        }
    }
}

/**
 * Captures every mask's live style via {@link captureMaskStyleBackup},
 * runs the supplied async `callback` (which is allowed to mutate masks
 * freely — typically by forcing the export bake-in style of
 * `opacity: 1, fill: '#000', strokeWidth: 0, stroke: null,
 * selectable: false`), then restores every mask's pre-callback state in a
 * `finally` block — even if `callback` rejected.
 *
 * This is the canonical owner of the "export-only style restoration"
 * contract. Callers in
 * `export/export-service.ts` use this so they never need to write their
 * own `try/finally` block — and so a future refactor cannot accidentally
 * forget the restore step on an early return path.
 *
 * The function returns whatever `callback` resolves to.
 *
 * @typeParam T      The return type of `callback`.
 * @param ctx        Orchestration context — see {@link MaskStyleContext}.
 * @param mutator    Synchronous function applied to each captured mask
 *                   BEFORE `callback` runs. Typically applies the export
 *                   bake-in style. Called once per mask in canvas object
 *                   order with `(mask, index)`. Backups are captured BEFORE
 *                   the mutator runs so an exception in the mutator still
 *                   triggers the `finally` restore for already-mutated
 *                   masks.
 * @param callback   The export body to run after every mutator pass
 *                   completed. Typically `canvas.toDataURL` plus any
 *                   post-processing.
 * @returns          The value `callback` resolved to.
 *
 */
export async function withMaskStyleBackup<T>(
    ctx: MaskStyleContext,
    mutator: (mask: MaskObject, index: number) => void,
    callback: () => Promise<T> | T,
): Promise<T> {
    if (!ctx.canvas) return await callback();

    const masks = ctx.canvas.getObjects().filter(isMaskObject);
    // Capture every backup BEFORE applying any mutator so an exception
    // mid-loop still restores already-mutated masks.
    const backups: MaskBackup[] = masks.map(captureMaskStyleBackup);

    try {
        masks.forEach((mask, idx) => mutator(mask, idx));
        return await callback();
    } finally {
        // Run the restore inside the finally so the on-screen canvas is
        // guaranteed to match its pre-call state regardless of how
        // `callback` settled.
        for (const backup of backups) restoreMaskStyleBackup(backup);
    }
}

// ─── Crop session helpers ──────────────────────────

/**
 * Apply the crop-mode hide style on `mask`: opacity 0 + non-interactive.
 *
 * Used by `crop/crop-controller.ts` when entering crop mode with
 * `options.crop.hideMasksDuringCrop === true`. Callers MUST capture a
 * {@link MaskBackup} via {@link captureMaskStyleBackup} BEFORE calling
 * this helper so {@link restoreMaskStyleBackup} can revert the change on
 * `cancelCrop`.
 *
 * Sets `evented: false` and `selectable: false` so the user cannot
 * interact with the mask while only the crop rectangle should respond to
 * pointer events. Wraps the `set(...)` in `try/catch` so a removed mask
 * does not break the loop in the controller.
 *
 * @param mask The mask to hide.
 */
export function applyCropHideMaskStyle(mask: MaskObject): void {
    try {
        mask.set({ opacity: 0, evented: false, selectable: false });
    } catch {
        /* ignore — mask may have been removed mid-iteration */
    }
}
