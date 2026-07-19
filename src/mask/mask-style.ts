/**
 * Maintains Mask Plugin hover and selection styles and owns their Fabric event handlers.
 *
 * @module
 */

import type * as FabricNS from 'fabric';
import type { MaskObject } from '../core/public-types.js';

// ─── Visual constants ─────────────────────────────────────────────────────────────

/** Selected-mask highlight stroke. */
const SELECTED_STROKE = '#ff0000';
/** Selected-mask highlight stroke width. */
const SELECTED_STROKE_WIDTH = 1;
/** Hover highlight stroke. */
const HOVER_STROKE = '#ff5500';
/** Hover highlight stroke width. */
const HOVER_STROKE_WIDTH = 2;
/** Hover bumps opacity by this much, capped at 1. */
const HOVER_OPACITY_BUMP = 0.2;
/** Default fallback stroke when `mask.originalStroke` is unset. */
const DEFAULT_STROKE_FALLBACK = '#ccc';
/** Default fallback stroke width when `mask.originalStrokeWidth` is unset. */
const DEFAULT_STROKE_WIDTH_FALLBACK = 1;
/** Default fallback opacity when `mask.originalAlpha` is unset. */
const DEFAULT_ALPHA_FALLBACK = 0.5;

/**
 * The "normal" (non-hover, non-selected) style of a mask, computed from
 * its persisted `original*` fields.
 */
interface MaskNormalStyle {
    stroke: FabricNS.TFiller | string | null;
    strokeWidth: number;
    opacity: number;
}

/**
 * Tag attached to a mask by {@link attachMaskHoverHandlers} so
 * {@link reattachMaskHoverHandlers} can drop the prior pair before
 * binding fresh ones.
 *
 */
interface MaskHoverHandlerTag {
    mouseover: () => void;
    mouseout: () => void;
}

/** narrow type alias for masks carrying the hover-handler tag. */
type MaskWithHoverTag = MaskObject & {
    imageEditorMaskHandlers?: MaskHoverHandlerTag;
};

// ─── Normal-style readers ────────────────────────────────────────────────────

/**
 * Compute the "normal" (non-hover, non-selected) style of `mask` from its
 * persisted `original*` fields.
 *
 * - `stroke` → `mask.originalStroke`, falling back to `'#ccc'`.
 * - `strokeWidth` → `Number(mask.originalStrokeWidth)` if finite, else `1`.
 * - `opacity` → `Number(mask.originalAlpha)` if finite, else `0.5`.
 *
 * The hover mouseout handler uses this result to restore the persisted normal style.
 *
 * @param mask - The mask to inspect.
 * @returns A {@link MaskNormalStyle} ready to pass to `mask.set(...)`.
 */
function getMaskNormalStyle(mask: MaskObject): MaskNormalStyle {
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
 * - `stroke` → `'#ff5500'`.
 * - `strokeWidth` → `2`.
 * - `opacity` → `min(originalAlpha + 0.2, 1)`.
 *
 * @param mask - The mask to inspect.
 * @returns A style patch ready to pass to `mask.set(...)`.
 */
function getMaskHoverStyle(mask: MaskObject): MaskNormalStyle {
    const opacity = Number(mask.originalAlpha);
    const baseAlpha = Number.isFinite(opacity) ? opacity : DEFAULT_ALPHA_FALLBACK;
    return {
        stroke: HOVER_STROKE,
        strokeWidth: HOVER_STROKE_WIDTH,
        opacity: Math.min(baseAlpha + HOVER_OPACITY_BUMP, 1),
    };
}

// ─── Selection styling ────────────────────────────────────────────────────────────

/**
 * Apply the selected-mask highlight stroke.
 *
 * Does NOT change opacity — the selection highlight only modifies the
 * outline so the user can still see the mask's tinted fill.
 *
 * @param mask - The mask becoming selected.
 */
export function applyMaskSelectedStyle(mask: MaskObject): void {
    mask.set({ stroke: SELECTED_STROKE, strokeWidth: SELECTED_STROKE_WIDTH });
}

/**
 * Restore the un-highlighted stroke on `mask` after selection moves to a
 * different object. Reads the per-mask `originalStroke`/`originalStrokeWidth`
 * so the value is the one the
 * mask carried before any selection-time mutation.
 *
 * Does NOT touch `opacity` — the un-highlighted state retains the live
 * opacity (which may differ from `originalAlpha` while a hover is in
 * progress, etc.).
 *
 * @param mask - The mask becoming un-selected.
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
 * Bind `mouseover`/`mouseout` handlers on `mask` that toggle the hover
 * highlight. The handlers re-read `mask.originalAlpha` /
 * `mask.originalStroke` / `mask.originalStrokeWidth` on each event so they
 * track any post-attach mutation.
 *
 * Handlers are tagged on `mask.imageEditorMaskHandlers` so
 * {@link reattachMaskHoverHandlers} can drop them before binding a new
 * pair, avoiding duplicates after a `loadFromJSON` restore.
 *
 * Calling this twice binds duplicate listeners; use {@link reattachMaskHoverHandlers}
 * when refreshing an existing mask.
 *
 * @param mask - The mask to bind handlers on.
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
    tagged.imageEditorMaskHandlers = { mouseover, mouseout };
}

/**
 * Drop any previously-attached hover handler pair (best-effort) and bind a
 * fresh pair via {@link attachMaskHoverHandlers}.
 *
 * Used after snapshot restoration because Fabric does not serialize event listeners.
 *
 * Also re-asserts the persisted `original*` metadata when missing so a snapshot
 * that lacks `originalStroke`/`originalStrokeWidth` still hovers
 * correctly. Current snapshots always serialize `originalAlpha`, but we
 * defend against partial payloads here too.
 *
 * @param mask - The mask to refresh handlers on.
 */
export function reattachMaskHoverHandlers(mask: MaskObject): void {
    const tagged = mask as MaskWithHoverTag;

    // Drop the previous pair if present. Fabric's `off(event, callback)`
    // removes that specific handler; `off(event)` removes every handler
    // for the event. We use the specific form so callers that bind their
    // own listeners outside this module are not affected.
    if (tagged.imageEditorMaskHandlers) {
        try {
            tagged.off('mouseover', tagged.imageEditorMaskHandlers.mouseover);
            tagged.off('mouseout', tagged.imageEditorMaskHandlers.mouseout);
        } catch {
            /* ignore — handler may already be detached */
        }
        delete tagged.imageEditorMaskHandlers;
    }

    // Re-assert persisted metadata when missing so freshly bound handlers can
    // read sensible originals from snapshots without the custom keys.
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
 * Best-effort cleanup prevents one stale Fabric reference from interrupting bulk disposal.
 *
 * @param mask - The mask to detach handlers from.
 */
export function detachMaskHoverHandlers(mask: MaskObject): void {
    const tagged = mask as MaskWithHoverTag;
    if (!tagged.imageEditorMaskHandlers) return;
    try {
        tagged.off('mouseover', tagged.imageEditorMaskHandlers.mouseover);
        tagged.off('mouseout', tagged.imageEditorMaskHandlers.mouseout);
    } catch {
        /* ignore */
    }
    delete tagged.imageEditorMaskHandlers;
}
