/**
 * @file mask/mask-factory.ts
 * @description Function-based mask creation entry point used by the
 *              `ImageEditor` orchestrator. Owns the v1 `addMask` logic that
 *              was inlined on the editor in v1 and is now extracted into a
 *              pure(ish) helper that takes a {@link CreateMaskContext}.
 *
 * ## Owned contracts
 *
 * - On a successful `createMask`, the editor SHALL
 *   increment `maskCounter` and assign the result to `mask.maskId`. Counter
 *   bookkeeping flows through `ctx.getMaskCounter` / `ctx.setMaskCounter` so
 *   the orchestrator retains ownership of the field across loadImage and
 *   loadFromState (which reset / restore the counter).
 * - Together with `core/state-serializer.ts`, mask IDs
 *   stay unique across mixed `createMask` / `mergeMasks` / `undo` / `redo`
 *   sequences because the counter is monotonic.
 * - `createMask` is the only public mask-creation
 *   entry point. The legacy `addMask` alias is intentionally absent
 *   (Deprecated_Alias rule).
 * - For `'rect' | 'circle' | 'ellipse' | 'polygon'`
 *   the corresponding Fabric shape is built with explicit
 *   `originX: 'left'`, `originY: 'top'`, plus the resolved color, opacity,
 *   angle, and the user's `styles` block.
 * - When `config.fabricGenerator` is supplied it is
 *   called with `(resolvedConfig, canvas, options)` and its return value is
 *   used verbatim as the mask object.
 * - Post-create order is fixed: add to canvas →
 *   update list DOM → `setActiveObject` (when `selectable !== false`) →
 *   `saveState` → `config.onCreate(mask, canvas)`.
 * - `config.onCreate` is invoked exactly once,
 *   strictly after `saveState` has run.
 * - Falsy values supplied via `config.styles` (`0`,
 *   `false`, `null`, `''`, `NaN`) are applied verbatim. The factory does
 *   NOT use `??` to default stroke / strokeWidth / strokeDashArray when the
 *   key is explicitly present on `styles`.
 * - `hasControls`, `selectable`, `transparentCorners`,
 *   `strokeUniform` use the `'foo' in config ? … : default` pattern so that
 *   an explicit `false` is preserved.
 * - When a polygon mask is built, its visible
 *   bounding-box top-left SHALL equal the resolved `(left, top)`. Fabric
 *   v7's `Polygon` constructor positions the object so the polygon's
 *   `pathOffset` is centered on `(left, top)`, which means the bounding
 *   rect generally does NOT land at `(left, top)`. The factory therefore
 *   constructs the polygon without `left`/`top`, reads the resulting
 *   bounding rect, and shifts the object by the delta so the rendered
 *   bounding box top-left matches the requested coordinate.
 * - Polygon points may be supplied as `{ x, y}`
 *   objects or `[x, y]` tuples; both forms are normalized via
 *   `coercePoint` from `utils/number.ts` before reaching Fabric.
 *
 * - `removeAllMasks(options?)` accepts a
 *   `RemoveAllMasksOptions` argument with `saveHistory` defaulting to
 *   `true`, pushing a single history entry for the batch.
 * - `removeAllMasks({ saveHistory: false})` removes
 *   masks without pushing a history entry (used by merge/crop pipelines).
 * - `removeAllMasks` is operation-guard-rejected
 *   while `isAnimating` is `true`. The guard lives on the orchestrator;
 *   this module is only invoked after the guard has cleared.
 * - `removeAllMasks` clears `_lastMask` to `null`,
 *   so subsequent `createMask` calls cannot auto-place relative to a
 *   removed reference and `maskId` uniqueness is preserved across mixed
 *   `createMask` / `removeAllMasks` / `undo` / `redo` sequences.
 *
 * ## Out of scope (handled by sibling tasks)
 *
 * - Mask label creation/synchronization — see `mask/mask-label-manager.ts`.
 *
 * ## Design notes
 *
 * - The orchestrator owns the editor-level state (`maskCounter`,
 *   `_lastMask`, the canvas, `saveState`, `_updateMaskList`). The factory
 *   reads/writes those slots through getter/setter callbacks supplied in
 *   {@link CreateMaskContext} so this module is independent of the
 *   `ImageEditor` class shape.
 * - `expandCanvasIfNeeded` is optional. The orchestrator may supply it to
 *   route through `_setCanvasSizeInt` (which forces a synchronous reflow on
 *   the scroll container, see `image-editor.ts`). When absent, the factory
 *   falls back to the public Fabric API `canvas.setDimensions`.
 */
import type * as FabricNS from 'fabric';
import type { FabricModule, MaskConfig, MaskObject, RemoveAllMasksOptions, ResolvedOptions } from '../core/public-types.js';
/**
 * State and orchestration callbacks the mask factory needs from the
 * `ImageEditor` orchestrator.
 *
 * The factory does NOT own any of these slots — it only reads and updates
 * them through the supplied accessors so that ownership of `maskCounter`,
 * `_lastMask`, history snapshots, and the mask list DOM stays on the editor
 * (where v1 left them).
 */
export interface CreateMaskContext {
    /** Injected Fabric.js v7 module used to construct the shape. */
    fabric: FabricModule;
    /** The live Fabric canvas the mask is added to. */
    canvas: FabricNS.Canvas;
    /** Fully resolved editor options (defaults already merged). */
    options: ResolvedOptions;
    /** Last mask reference, used for the auto-place-to-right behavior. */
    getLastMask(): MaskObject | null;
    setLastMask(mask: MaskObject | null): void;
    /** Mask counter — owned by the orchestrator. */
    getMaskCounter(): number;
    setMaskCounter(n: number): void;
    /** Re-render the mask list DOM (UI ownership lives in `mask/mask-list.ts`). */
    updateMaskList(): void;
    /** Save canvas state to history. */
    saveCanvasState(): void;
    /**
     * Optional canvas resize hook used when `options.expandCanvasToImage` is
     * `true` and the placed mask would extend past the current canvas size.
     * If omitted, the factory calls `canvas.setDimensions` directly. The
     * orchestrator typically passes `_setCanvasSizeInt` here to preserve the
     * v1 synchronous reflow trick that keeps `overflow: auto` scrollbars in
     * sync with the new canvas size.
     */
    expandCanvasIfNeeded?: (width: number, height: number) => void;
}
/**
 * Create a mask via the resolved {@link MaskConfig} and add it to the
 * canvas.
 *
 * Steps (19.5):
 *
 * 1. Resolve the config: apply defaults, then resolve placement
 *    (`left`/`top`) and dimensions (`width`/`height`/`rx`/`ry`/`radius`)
 *    via {@link resolveNumeric} so percentages and factory functions
 *    collapse to pixel numbers (20.3).
 * 2. Optionally expand the canvas if the placement would overflow.
 * 3. Build the Fabric shape — switch on `config.shape`, or call
 *    `config.fabricGenerator` if provided.
 * 4. Apply common mask properties. Falsy flags (`hasControls`,
 *    `selectable`, `transparentCorners`, `strokeUniform`) use the
 *    `'foo' in config ? … : default` pattern so an explicit `false` is
 *    preserved. Stroke / strokeWidth /
 *    strokeDashArray pulled out of `styles` use the same `in` check so
 *    `null` and `0` are preserved verbatim.
 * 5. Increment `maskCounter` and assign `maskId`, `maskName`,
 *    `originalAlpha`.
 * 6. Post-create order: add to canvas → `updateMaskList` →
 *    `setActiveObject` (when `selectable !== false`) → `saveCanvasState`
 *    → `config.onCreate(mask, canvas)`.
 *
 * @param ctx    Orchestration context — see {@link CreateMaskContext}.
 * @param config User-supplied mask configuration.
 * @returns      The created mask object, or `null` if the canvas is unset.
 */
export declare function createMask(ctx: CreateMaskContext, config?: MaskConfig): MaskObject | null;
/**
 * Orchestration callbacks needed by {@link removeSelectedMask} and
 * {@link removeAllMasks}. The helpers do NOT own any of these slots — they
 * read and update them through the supplied accessors so ownership of the
 * canvas, mask label DOM, mask list DOM, history, and `_lastMask` stays on
 * the editor.
 */
export interface RemoveMaskContext {
    /** The live Fabric canvas the mask(s) are removed from. */
    canvas: FabricNS.Canvas;
    /**
     * Remove the label overlay associated with `mask` (if any). The
     * orchestrator typically delegates to `mask/mask-label-manager.ts`.
     */
    removeLabelForMask(mask: MaskObject): void;
    /** Re-render the mask list DOM (UI ownership in `mask/mask-list.ts`). */
    updateMaskList(): void;
    /** Push a single history entry for the removal batch. */
    saveCanvasState(): void;
    /**
     * Reset the orchestrator's `_lastMask` reference. Called with `null`
     * when every mask is removed so the next `createMask` does not
     * auto-place relative to a removed mask.
     */
    setLastMask(mask: MaskObject | null): void;
}
/**
 * Remove the currently selected mask (if it is a {@link MaskObject}).
 *
 * Steps:
 *
 * 1. Read the active object from the canvas. No-op if missing or not a mask.
 * 2. Remove the mask's label overlay via {@link RemoveMaskContext.removeLabelForMask}.
 * 3. Remove the mask object from the canvas and clear the active selection.
 * 4. Re-render the mask list DOM and the canvas.
 * 5. Push a single history entry via {@link RemoveMaskContext.saveCanvasState}.
 *
 * Requirements: 14.1 (guarded by the orchestrator), 18.4 (uniqueness), 19.6.
 *
 * @param ctx Orchestration context — see {@link RemoveMaskContext}.
 */
export declare function removeSelectedMask(ctx: RemoveMaskContext): void;
/**
 * Remove all masks (and their label overlays) from the canvas.
 *
 * When `options.saveHistory` is `false`, the helper does NOT push a history
 * entry — used by the internal `mergeMasks` and `applyCrop` pipelines, which
 * already record one enclosing history entry for the operation. The default
 * (and the public-facing call from `ImageEditor.removeAllMasks`) is
 * `saveHistory: true`, which pushes a single entry for the batch.
 *
 * Steps:
 *
 * 1. Collect every {@link MaskObject} on the canvas. No-op if none.
 * 2. For each mask: remove its label overlay, then remove the mask object
 *    from the canvas.
 * 3. Clear the active selection.
 * 4. Reset `_lastMask` to `null` so the next `createMask` does not
 *    auto-place relative to a removed reference.
 * 5. Re-render the mask list DOM and the canvas.
 * 6. Conditionally push a history entry depending on
 *    `options.saveHistory`.
 *
 * Requirements: 14.1 (guarded by the orchestrator), 18.4 (uniqueness),
 * 19.6, 19.7.
 *
 * @param ctx     Orchestration context — see {@link RemoveMaskContext}.
 * @param options Bulk-removal options. Defaults to `{ saveHistory: true}`.
 */
export declare function removeAllMasks(ctx: RemoveMaskContext, options?: RemoveAllMasksOptions): void;
//# sourceMappingURL=mask-factory.d.ts.map