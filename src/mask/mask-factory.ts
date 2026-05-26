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
import type {
    FabricModule,
    MaskConfig,
    MaskObject,
    RemoveAllMasksOptions,
    ResolvedMaskConfig,
    ResolvedOptions,
} from '../core/public-types.js';
import { isMaskObject} from '../core/public-types.js';
import { coercePoint, resolveNumeric} from '../utils/number.js';

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
export function createMask(
    ctx: CreateMaskContext,
    config: MaskConfig = {},
): MaskObject | null {
    const { canvas, options, fabric: fb} = ctx;
    if (!canvas) return null;

    const shapeType = config.shape ?? 'rect';

    // ── Resolve config (defaults merged with the user overrides) ──────────
    const cfg: ResolvedMaskConfig = {
        shape: shapeType,
        width: options.defaultMaskWidth,
        height: options.defaultMaskHeight,
        color: 'rgba(0,0,0,0.5)',
        alpha: 0.5,
        gap: 5,
        left: undefined,
        top: undefined,
        angle: 0,
        selectable: true,
...config,
} as ResolvedMaskConfig;

    const firstOffset = 10;

    // ── Resolve placement (auto-place to the right of the previous mask
    //    when the caller did not specify `left`) ───────────────────────────
    let left: number;
    let top: number;
    const prev = ctx.getLastMask();
    if (config.left === undefined && prev) {
        const prevRight =
            (prev.left ?? 0) +
            (typeof prev.getScaledWidth === 'function'
                ? prev.getScaledWidth()
                : (prev.width ?? 0) * (prev.scaleX ?? 1));
        left = Math.round(prevRight + (cfg.gap ?? 5));
        top = prev.top ?? firstOffset;
} else {
        left = resolveNumeric(config.left, 'x', firstOffset, canvas, options);
        top = resolveNumeric(config.top, 'y', firstOffset, canvas, options);
}

    // ── Resolve dimensions (axis-aware percentages) ──
    cfg.width = resolveNumeric(config.width, 'x', options.defaultMaskWidth, canvas, options);
    cfg.height = resolveNumeric(config.height, 'y', options.defaultMaskHeight, canvas, options);

    // ── Expand canvas only when placement would overflow ─────────────────
    //    Never use viewport dimensions as a floor here — that would shrink a
    //    wider-than-viewport canvas (removing its scrollbar).
    if (options.expandCanvasToImage) {
        const reqW = Math.ceil(left + cfg.width + 10);
        const reqH = Math.ceil(top + cfg.height + 10);
        const newW = Math.max(canvas.getWidth(), reqW);
        const newH = Math.max(canvas.getHeight(), reqH);
        if (newW !== canvas.getWidth() || newH !== canvas.getHeight()) {
            if (ctx.expandCanvasIfNeeded) {
                ctx.expandCanvasIfNeeded(newW, newH);
} else {
                canvas.setDimensions({ width: newW, height: newH});
}
}
}

    // ── Build the Fabric shape ──────────────────
    let mask: FabricNS.FabricObject;

    if (typeof cfg.fabricGenerator === 'function') {
        mask = cfg.fabricGenerator(cfg, canvas, options);
} else {
        // v7: All new objects default to originX/Y 'center'/'center'.
        // Masks must declare 'left'/'top' so coordinates refer to the
        // top-left corner, matching the v1 behavior and the placement
        // logic above.
        const originProps = {
            originX: 'left' as FabricNS.TOriginX,
            originY: 'top' as FabricNS.TOriginY,
};
        const rx =
            config.rx !== undefined
                ? resolveNumeric(config.rx, 'x', 0, canvas, options)
                : undefined;
        const ry =
            config.ry !== undefined
                ? resolveNumeric(config.ry, 'y', 0, canvas, options)
                : undefined;

        switch (shapeType) {
            case 'circle':
                mask = new fb.Circle({
                    left,
                    top,
...originProps,
                    radius: resolveNumeric(
                        config.radius,
                        'x',
                        Math.min(cfg.width, cfg.height) / 2,
                        canvas,
                        options,
),
                    fill: cfg.color,
                    opacity: cfg.alpha,
                    angle: cfg.angle ?? 0,
...cfg.styles,
});
                break;
            case 'ellipse':
                mask = new fb.Ellipse({
                    left,
                    top,
...originProps,
                    rx: rx ?? cfg.width / 2,
                    ry: ry ?? cfg.height / 2,
                    fill: cfg.color,
                    opacity: cfg.alpha,
                    angle: cfg.angle ?? 0,
...cfg.styles,
});
                break;
            case 'polygon': {
                // Coerce both `{x,y}` object and `[x,y]` tuple inputs.
                const pts = (config.points ?? []).map(coercePoint);

                // Bounding-box realignment.
                //
                // Fabric.js v7's `Polygon` constructor centers the
                // polygon's `pathOffset` on the supplied `(left, top)`,
                // so passing `(left, top)` directly puts the bounding
                // box somewhere offset from the requested coordinate
                // (the offset depends on the geometry of `pts`). To
                // honor the documented "bounding box top-left maps to
                // (left, top)" contract we:
                //   1. construct the polygon without `left`/`top`,
                //   2. measure where Fabric placed its bounding rect,
                //   3. shift the object by the delta between the
                //      requested `(left, top)` and the actual bounding
                //      rect top-left.
                // After the shift the rendered bounding-box top-left
                // matches the resolved `(left, top)`.
                const polygon = new fb.Polygon(pts, {
...originProps,
                    fill: cfg.color,
                    opacity: cfg.alpha,
                    angle: cfg.angle ?? 0,
...cfg.styles,
});
                polygon.setCoords();
                const br = polygon.getBoundingRect();
                const dx = left - br.left;
                const dy = top - br.top;
                polygon.set({
                    left: (polygon.left ?? 0) + dx,
                    top: (polygon.top ?? 0) + dy,
});
                polygon.setCoords();
                mask = polygon;
                break;
}
            case 'rect':
            default:
                mask = new fb.Rect({
                    left,
                    top,
...originProps,
                    width: cfg.width,
                    height: cfg.height,
                    fill: cfg.color,
                    opacity: cfg.alpha,
                    angle: cfg.angle ?? 0,
...(rx !== undefined ? { rx} : {}),
...(ry !== undefined ? { ry} : {}),
...cfg.styles,
});
}
}

    // ── Common mask properties ─────────────────────────
    //    The four flags below use the `'foo' in config ? … : default`
    //    pattern so that an explicit `false` is preserved as `false` and
    //    `undefined` falls back to the v1 default.
    const m = mask as MaskObject;
    m.selectable = 'selectable' in config ? !!config.selectable : true;
    m.hasControls = 'hasControls' in config ? !!config.hasControls : true;
    m.transparentCorners =
        'transparentCorners' in config ? !!config.transparentCorners : false;
    m.strokeUniform = 'strokeUniform' in config ? !!config.strokeUniform : true;
    m.lockRotation = !options.maskRotatable;
    m.borderColor = config.borderColor ?? 'red';
    m.cornerColor = config.cornerColor ?? 'black';
    m.cornerSize = config.cornerSize ?? 8;

    // ── Stroke defaults — preserve falsy values from `styles` ─────────────
    //    `??` would replace `null` with the default. Use an `in` check so
    //    `styles.stroke = null` (or `''`, `0`) is preserved verbatim.
    const styles = (cfg.styles ?? {}) as Partial<FabricNS.FabricObjectProps>;
    if ('stroke' in styles) {
        m.stroke = styles.stroke as FabricNS.TFiller | string | null;
} else {
        m.stroke = '#ccc';
}
    if ('strokeWidth' in styles) {
        m.strokeWidth = styles.strokeWidth as number;
} else {
        m.strokeWidth = 1;
}
    if ('strokeDashArray' in styles) {
        m.strokeDashArray = styles.strokeDashArray as number[];
}

    // ── Hover highlight (mirrors v1) ──────────────────────────────────────
    m.originalAlpha = cfg.alpha;
    const normalStyle = {
        stroke: m.stroke,
        strokeWidth: m.strokeWidth,
        opacity: m.originalAlpha,
};
    const hoverStyle = {
        stroke: '#ff5500',
        strokeWidth: 2,
        opacity: Math.min(m.originalAlpha + 0.2, 1),
};
    m.on('mouseover',  () => {
        m.set(hoverStyle);
        m.canvas?.requestRenderAll();
});
    m.on('mouseout',  () => {
        m.set(normalStyle);
        m.canvas?.requestRenderAll();
});

    // ── Counter and identity ──────────────────────────
    const nextId = ctx.getMaskCounter() + 1;
    ctx.setMaskCounter(nextId);
    m.maskId = nextId;
    m.maskName = `${options.maskName}${nextId}`;

    ctx.setLastMask(m);

    // ── Post-create order ───────────────────────
    //    add → updateMaskList → setActiveObject → saveCanvasState → onCreate.
    canvas.add(m);
    canvas.bringObjectToFront(m);

    ctx.updateMaskList();

    if (cfg.selectable !== false) {
        // setActiveObject fires 'selection:created' and the orchestrator's
        // selection handler reacts (e.g. by creating the mask label).
        canvas.setActiveObject(m);
}

    canvas.renderAll();
    ctx.saveCanvasState();

    cfg.onCreate?.(m, canvas);

    return m;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mask removal (Task 15.3)
// ─────────────────────────────────────────────────────────────────────────────
//
// `removeSelectedMask` and `removeAllMasks` are the v2 home for the v1 logic
// that used to live inline on `ImageEditor`. They are pure helpers that take
// a {@link RemoveMaskContext} so the orchestrator retains ownership of the
// canvas, label DOM, mask list DOM, history, and `_lastMask` slot.
//
// Owned contracts:
//
// - While `isAnimating` is `true`, `removeAllMasks`
//   SHALL be rejected by the caller (the operation guard, applied on the
//   orchestrator). This module is invoked only after the guard has cleared,
//   so the helpers themselves do not consult `isAnimating`.
// - `removeAllMasks` clears `_lastMask` on success so
//   subsequent `createMask` calls do not auto-place a new mask relative to a
//   removed reference. Combined with the monotonic counter owned by
//   `mask-factory.createMask`, this preserves uniqueness of `maskId` across
//   mixed `createMask` / `removeAllMasks` / `undo` / `redo` sequences.
// - The bulk-removal helper accepts a
//   `RemoveAllMasksOptions` argument with `saveHistory` defaulting to `true`,
//   so a single history entry is pushed for the batch.
// - When `options.saveHistory === false`, the helper
//   removes masks WITHOUT pushing a history entry. The internal merge and
//   crop pipelines pass `{ saveHistory: false}` because they already record
//   one enclosing history entry for the operation as a whole.

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
export function removeSelectedMask(ctx: RemoveMaskContext): void {
    const active = ctx.canvas.getActiveObject();
    if (!active || !isMaskObject(active)) return;
    ctx.removeLabelForMask(active);
    ctx.canvas.remove(active);
    ctx.canvas.discardActiveObject();
    ctx.updateMaskList();
    ctx.canvas.renderAll();
    ctx.saveCanvasState();
}

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
export function removeAllMasks(
    ctx: RemoveMaskContext,
    options: RemoveAllMasksOptions = {},
): void {
    const masks = ctx.canvas.getObjects().filter(isMaskObject);
    if (masks.length === 0) return;

    for (const m of masks) {
        ctx.removeLabelForMask(m);
        ctx.canvas.remove(m);
}
    ctx.canvas.discardActiveObject();
    ctx.setLastMask(null);
    ctx.updateMaskList();
    ctx.canvas.renderAll();

    // Default `saveHistory` is `true`; only skip when the caller explicitly
    // opts out (merge/crop pipelines).
    if (options.saveHistory !== false) {
        ctx.saveCanvasState();
}
}
