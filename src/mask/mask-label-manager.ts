/**
 * Per-mask label overlay creation, positioning, show/hide, and
 * removal.
 *
 * The editor runtime owns the canvas and resolved options; this module
 * receives those dependencies through {@link MaskLabelManagerContext} so
 * label behavior can be tested without the full facade.
 *
 * ## Owned contracts
 *
 * - Label text is computed via
 *   `options.label.getText(mask, mask.maskId - 1)`. The index argument is
 *   the stable creation index (`maskId - 1`), NOT the live canvas list
 *   position. Earlier implementations passed `this.maskCounter` here,
 *   which drifted whenever masks were added or removed; the current
 *   contract pins the index to the
 *   mask's own identity so labels stay consistent across
 *   `createMask` / `removeSelectedMask` / `removeAllMasks` / `undo`/`redo`.
 *
 * - Every label-overlay text object SHALL be
 *   constructed with `originX: 'left'`, `originY: 'top'`, since the label
 *   is positioned by its top-left corner. The defaults injected by this
 *   module set those origins explicitly, and {@link syncMaskLabel}
 *   re-asserts them on every sync so an externally-mutated label still
 *   honors the contract.
 *
 * - **State serializer filter** — Every label object is
 *   tagged with `maskLabel = true` so `core/state-serializer.ts` can
 *   exclude it from history snapshots. Labels are session-only and never
 *   persisted.
 *
 * ## Out of scope (handled by sibling modules)
 *
 * - Mask creation, falsy-style preservation, polygon placement — see
 *   `mask/mask-factory.ts`.
 * - Mask list DOM rendering — see `mask/mask-list.ts`.
 * - Hover/selection appearance — see `mask/mask-style.ts`.
 *
 * ## Implementation notes
 *
 * - The editor runtime owns the canvas reference, resolved options, and
 *   Fabric module. The helpers in this module receive those slots through
 *   a {@link MaskLabelManagerContext} so the module is independent of the
 *   `ImageEditor` class shape and can be unit tested in isolation against
 *   a stub Fabric environment.
 * - When `options.label.create` is supplied, the user owns the full label
 *   build (it may even return `null` to opt out for a particular mask).
 *   When the factory returns `null` or the option is absent, this module
 *   falls back to a default Fabric text constructed from the deep-merged
 *   `options.label.textOptions`. The default already carries
 *   `originX: 'left'`/`originY: 'top'` via `core/default-options.ts`, but
 *   we set them explicitly here as well so the contract holds even when a
 *   caller bypasses `resolveOptions` (e.g. in unit tests).
 *
 * @module
 */

import type * as FabricNS from 'fabric';
import type { FabricModule, MaskObject, ResolvedOptions } from '../core/public-types.js';
import { isMaskObject } from '../core/public-types.js';
import { reportWarning } from '../core/callback-reporter.js';
import { markSessionObject } from '../core/editor-object-kind.js';

/**
 * State the label helpers read from the editor runtime.
 *
 * The module does NOT own any of these slots — it only reads them so
 * ownership of the canvas, Fabric module, and resolved options stays on the
 * runtime.
 */
export interface MaskLabelManagerContext {
    /** Injected Fabric.js v7 module used to construct the label text. */
    fabric: FabricModule;
    /** The live Fabric canvas the label overlay is added to. */
    canvas: FabricNS.Canvas;
    /** Fully resolved editor options (defaults already merged). */
    options: ResolvedOptions;
}

/**
 * Marker flag mixed into label text objects so the state serializer can
 * filter them out of history snapshots.
 *
 * Local helper alias to keep the casts at the use sites readable.
 */
type LabelText = FabricNS.FabricText & { maskLabel?: boolean };

/**
 * Remove the label overlay associated with `mask` (if any).
 *
 * No-op when the canvas is unset or the mask has no `labelObject`. Each
 * removal step is wrapped in `try/catch` so a stale Fabric reference does
 * not break callers that iterate every mask (e.g. {@link hideAllMaskLabels}
 * or `removeAllMasks`).
 *
 * Steps:
 *
 * 1. If `mask.labelObject` is present and still on the canvas, remove it.
 * 2. Delete `mask.labelObject` so subsequent {@link showLabelForMask} calls
 *    rebuild it instead of reusing a stale reference.
 *
 * @param context - Orchestration context — see {@link MaskLabelManagerContext}.
 * @param mask - The mask whose label overlay should be removed.
 */
export function removeLabelForMask(context: MaskLabelManagerContext, mask: MaskObject): void {
    if (!context.canvas || !mask.labelObject) return;
    try {
        if (context.canvas.getObjects().includes(mask.labelObject)) {
            context.canvas.remove(mask.labelObject);
        }
    } catch {
        /* ignore — label may already be detached */
    }
    try {
        delete mask.labelObject;
    } catch {
        /* ignore — label property may be non-configurable on some engines */
    }
}

/**
 * Create (or recreate) the label overlay for `mask`.
 *
 * No-op when the canvas is unset or `options.maskLabelOnSelect` is `false`.
 *
 * Steps:
 *
 * 1. Remove any existing label so a stale reference is never reused.
 * 2. If `options.label.create` is a function, call it with
 *    `(mask, fabric)` and use its return value when truthy. The factory
 *    may return `null` to opt out, in which case the default builder runs.
 * 3. Otherwise (or when the factory returned `null`), compute label text
 *    via `options.label.getText(mask, mask.maskId - 1)` so the index is
 *    the stable creation index rather than the live list position. Build
 *    a Fabric text using `options.label.textOptions` with `originX: 'left'`
 *    and `originY: 'top'` re-asserted explicitly.
 * 4. Tag the resulting object with `maskLabel = true` so the state
 *    serializer filters it out of history snapshots.
 * 5. Attach the label to the mask, add it to the canvas, bring it to the
 *    front, and run an initial {@link syncMaskLabel} to position it.
 *
 * @param context - Orchestration context — see {@link MaskLabelManagerContext}.
 * @param mask - The mask the label overlay is being created for.
 */
export function createLabelForMask(context: MaskLabelManagerContext, mask: MaskObject): void {
    const { canvas, options, fabric: fabricModule } = context;
    if (!canvas || !options.maskLabelOnSelect) return;

    // Always start from a clean slate — drop any existing label so a stale
    // reference does not survive a recreate.
    removeLabelForMask(context, mask);

    let labelTextObject: FabricNS.FabricText | null = null;

    // ── 1) Optional user-supplied factory ─────────────────────────────────
    if (typeof options.label.create === 'function') {
        try {
            labelTextObject = options.label.create(mask, fabricModule);
        } catch (error) {
            reportWarning(options, error, 'label.create callback threw.');
            labelTextObject = null;
        }
    }

    // ── 2) Default builder ────────────────────────────────────────────────
    //    Used when there is no `label.create` or it returned `null`.
    if (!labelTextObject) {
        // index is the stable creation index, not the
        // live list position. legacy passed `this.maskCounter` here.
        const indexForGetText = mask.maskId - 1;
        let labelText = mask.maskName;
        if (typeof options.label.getText === 'function') {
            try {
                labelText = options.label.getText(mask, indexForGetText);
            } catch (error) {
                reportWarning(options, error, 'label.getText callback threw.');
                labelText = mask.maskName;
            }
        }

        // the label is positioned by its top-left corner,
        // so `originX: 'left'` and `originY: 'top'` MUST be set. The
        // resolved `options.label.textOptions` already carries these via
        // `core/default-options.ts`, but we re-assert them so the contract
        // holds even if a caller bypassed `resolveOptions`. The user's
        // textOptions can override font/fill/etc. but the origin is
        // re-pinned afterwards because syncMaskLabel positions by top-left.
        const textOptions: Partial<FabricNS.TextProps> = {
            left: 0,
            top: 0,
            ...(options.label.textOptions ?? {}),
            originX: 'left',
            originY: 'top',
        };

        labelTextObject = new fabricModule.FabricText(labelText, textOptions);
    }

    // Mark as session-only so the state serializer excludes it from history
    // snapshots.
    markSessionObject(labelTextObject, 'maskLabel');
    (labelTextObject as LabelText).maskLabel = true;

    mask.labelObject = labelTextObject;
    canvas.add(labelTextObject);
    // v7: bringObjectToFront (renamed from v5 `bringToFront`).
    canvas.bringObjectToFront(labelTextObject);

    syncMaskLabel(context, mask);
}

/**
 * Re-position the label overlay to track its mask's current bounding box,
 * angle, and visibility.
 *
 * No-op when the canvas is unset, `options.maskLabelOnSelect` is `false`,
 * or the mask has no `labelObject`. Designed to be called from Fabric event
 * handlers (`object:moving`, `object:scaling`, `object:rotating`,
 * `object:modified`) without checking those guards at every call site.
 *
 * Geometry (matches legacy):
 *
 * - The label's top-left is placed `options.maskLabelOffset` pixels from
 *   the mask's top-left corner, along the vector from the top-left to the
 *   center of the rotated bounding box. This keeps the offset visually
 *   consistent regardless of mask rotation.
 * - The label inherits the mask's `angle` so it rotates with the mask.
 * - `originX: 'left'` and `originY: 'top'` are re-asserted on every sync
 *   to.
 *
 * @param context - Orchestration context — see {@link MaskLabelManagerContext}.
 * @param mask - The mask whose label should be repositioned.
 */
export function syncMaskLabel(context: MaskLabelManagerContext, mask: MaskObject): void {
    const { canvas, options } = context;
    if (!canvas || !options.maskLabelOnSelect || !mask.labelObject) return;

    const coords = mask.getCoords?.();
    if (!coords?.length) return;

    const tl = coords[0];
    if (!tl) return;
    const center = mask.getCenterPoint();
    const vx = center.x - tl.x;
    const vy = center.y - tl.y;
    const dist = Math.sqrt(vx * vx + vy * vy) || 1;
    const offset = Math.max(0, options.maskLabelOffset ?? 3);

    mask.labelObject.set({
        left: Math.round(tl.x + (vx / dist) * offset),
        top: Math.round(tl.y + (vy / dist) * offset),
        angle: mask.angle ?? 0,
        originX: 'left',
        originY: 'top',
        visible: true,
    });
    mask.labelObject.setCoords();
    // Label movement tracks selection and object transforms synchronously
    // so DOM list selection and canvas text stay in the same frame.
    canvas.renderAll();
}

/**
 * Ensure the label for `mask` is present and visible.
 *
 * No-op when `options.maskLabelOnSelect` is `false`. Creates a fresh label
 * via {@link createLabelForMask} when the mask has none, otherwise toggles
 * `visible` to `true` and re-syncs the position. Used by the orchestrator's
 * selection handler when a single mask becomes the active object.
 *
 * @param context - Orchestration context — see {@link MaskLabelManagerContext}.
 * @param mask - The mask whose label should be shown.
 */
export function showLabelForMask(context: MaskLabelManagerContext, mask: MaskObject): void {
    if (!context.options.maskLabelOnSelect) return;
    if (!mask.labelObject) {
        createLabelForMask(context, mask);
    }
    if (mask.labelObject) {
        mask.labelObject.visible = true;
        syncMaskLabel(context, mask);
    }
}

/**
 * Remove every label overlay currently on the canvas and detach the
 * `labelObject` reference from every mask.
 *
 * Called by the orchestrator before serialization (`saveState`) and
 * after `loadFromJSON`-driven restores so that label objects — which
 * Fabric DOES serialize unless filtered — never leak into history.
 *
 * Steps:
 *
 * 1. Remove every object flagged with `maskLabel === true` from the
 *    canvas. Each removal is wrapped in `try/catch` so a stale Fabric
 *    reference does not break the loop.
 * 2. Delete `labelObject` from every mask object so a subsequent
 *    {@link showLabelForMask} rebuilds the label rather than reusing a
 *    detached reference.
 *
 * @param context - Orchestration context — see {@link MaskLabelManagerContext}.
 */
export function hideAllMaskLabels(context: MaskLabelManagerContext): void {
    const { canvas } = context;
    if (!canvas) return;

    const objs = canvas.getObjects();

    objs.filter((o) => (o as FabricNS.FabricObject & { maskLabel?: boolean }).maskLabel).forEach(
        (l) => {
            try {
                canvas.remove(l);
            } catch {
                /* ignore — label may already be detached */
            }
        },
    );

    objs.filter(isMaskObject).forEach((o) => {
        try {
            delete o.labelObject;
        } catch {
            /* ignore — label property may be non-configurable on some engines */
        }
    });
}
