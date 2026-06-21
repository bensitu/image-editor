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
export declare function removeLabelForMask(context: MaskLabelManagerContext, mask: MaskObject): void;
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
export declare function createLabelForMask(context: MaskLabelManagerContext, mask: MaskObject): void;
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
export declare function syncMaskLabel(context: MaskLabelManagerContext, mask: MaskObject): void;
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
export declare function showLabelForMask(context: MaskLabelManagerContext, mask: MaskObject): void;
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
export declare function hideAllMaskLabels(context: MaskLabelManagerContext): void;
//# sourceMappingURL=mask-label-manager.d.ts.map