/**
 * Function-based mask creation entry point used by the
 * `ImageEditor` orchestrator.
 *
 * ## Owned contracts
 *
 * - On a successful `createMask`, the editor SHALL
 *   increment `maskCounter` and assign the result to `mask.maskId`. Counter
 *   bookkeeping flows through `context.getMaskCounter` / `context.setMaskCounter` so
 *   the editor runtime retains ownership of the field across loadImage and
 *   loadFromState (which reset / restore the counter).
 * - Together with `core/state-serializer.ts`, mask IDs
 *   stay unique across mixed `createMask` / `mergeMasks` / `undo` / `redo`
 *   sequences because the counter is monotonic.
 * - `createMask` is the public mask-creation entry point.
 * - For `'rect' | 'circle' | 'ellipse' | 'polygon'`
 *   the corresponding Fabric shape is built with explicit
 *   `originX: 'left'`, `originY: 'top'`, plus the resolved color, opacity,
 *   angle, and the merged `styles` block.
 * - When `config.fabricGenerator` is supplied it is
 *   called with `(resolvedConfig, canvas, options)` and its return value is
 *   used verbatim as the mask object. Thrown generator errors and invalid
 *   return values are reported through `onWarning` and abort creation before
 *   any mask, history entry, or counter update is committed.
 * - Function-valued numeric fields are isolated at the factory boundary:
 *   if a resolver throws, creation reports a warning and returns `null`.
 * - Post-create order is fixed: add to canvas →
 *   update list DOM → `setActiveObject` (when `selectable !== false`) →
 *   `saveState` → `config.onCreate(mask, canvas)`.
 * - `config.onCreate` is invoked exactly once,
 *   strictly after `saveState` has run.
 * - Falsy values supplied via `options.defaultMaskConfig.styles` or
 *   `config.styles` (`0`, `false`, `null`, `''`, `NaN`) are applied
 *   verbatim. The factory does NOT use `??` to default stroke /
 *   strokeWidth / strokeDashArray when the key is explicitly present on
 *   the merged `styles`.
 * - `hasControls`, `selectable`, `evented`, `transparentCorners`,
 *   `strokeUniform` use the `'foo' in mergedConfig ? … : default` pattern
 *   so that an explicit `false` is preserved.
 * - When a polygon mask is built, its visible
 *   bounding-box top-left SHALL equal the resolved `(left, top)`. Fabric
 *   Fabric's `Polygon` constructor positions the object so the polygon's
 *   `pathOffset` is centered on `(left, top)`, which means the bounding
 *   rect generally does NOT land at `(left, top)`. The factory therefore
 *   constructs the polygon without `left`/`top`, reads the resulting
 *   bounding rect, and shifts the object by the delta so the rendered
 *   bounding box top-left matches the requested coordinate.
 * - Polygon points may be supplied as `{ x, y }`
 *   objects or `[x, y]` tuples; both forms are normalized via
 *   `coercePoint` from `utils/number.ts` before reaching Fabric.
 *
 * - `removeAllMasks(options?)` accepts a
 *   `RemoveAllMasksOptions` argument with `saveHistory` defaulting to
 *   `true`, pushing a single history entry for the batch.
 * - `removeAllMasks({ saveHistory: false})` removes
 *   masks without pushing a history entry (used by merge/crop pipelines).
 * - `removeAllMasks` is operation-guard-rejected
 *   while `isAnimating` is `true`. The guard lives on the editor runtime;
 *   this module is only invoked after the guard has cleared.
 * - `removeAllMasks` clears `lastMask` to `null`,
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
 * - The editor runtime owns the editor-level state (`maskCounter`,
 *   `lastMask`, and the canvas), while the facade supplies history and UI
 *   callbacks. The factory reads/writes those slots through getter/setter
 *   callbacks supplied in {@link CreateMaskContext} so this module is
 *   independent of the `ImageEditor` class shape.
 * - `expandCanvasIfNeeded` is optional. The facade may supply it to
 *   route through `setCanvasSizePx` (which forces a synchronous reflow on
 *   the scroll container, see `image-editor.ts`). When absent, the factory
 *   falls back to the public Fabric API `canvas.setDimensions`.
 *
 * @module
 */

import type * as FabricNS from 'fabric';
import type {
    DefaultMaskConfig,
    FabricModule,
    MaskConfig,
    MaskObject,
    MaskShapeKind,
    RemoveAllMasksOptions,
    ResolvedMaskConfig,
    ResolvedOptions,
} from '../core/public-types.js';
import { isMaskObject } from '../core/public-types.js';
import { markMaskObject } from '../core/editor-object-kind.js';
import { placeMaskObject } from '../core/layer-order.js';
import { reportWarning } from '../core/callback-reporter.js';
import { copySafeOwnProperties } from '../core/safe-object-copy.js';
import { attachMaskHoverHandlers, detachMaskHoverHandlers } from './mask-style.js';
import { coercePoint, resolveNumeric } from '../utils/number.js';

const POLYGON_AREA_EPSILON = 1e-6;
const BUILT_IN_MASK_SHAPES = new Set<string>(['rect', 'circle', 'ellipse', 'polygon']);

function createMaskUid(maskId: number): string {
    return `mask-${maskId}`;
}

/**
 * State and orchestration callbacks the mask factory needs from the
 * `ImageEditor` orchestrator.
 *
 * The factory does NOT own any of these slots — it only reads and updates
 * them through the supplied accessors so ownership of `maskCounter`,
 * `lastMask`, history snapshots, and the mask list DOM stays on the editor.
 */
export interface CreateMaskContext {
    /** Injected Fabric.js module used to construct the shape. */
    fabric: FabricModule;
    /** The live Fabric canvas the mask is added to. */
    canvas: FabricNS.Canvas;
    /** Fully resolved editor options (defaults already merged). */
    options: ResolvedOptions;
    /** Last mask reference, used for the auto-place-to-right behavior. */
    getLastMask(): MaskObject | null;
    setLastMask(mask: MaskObject | null): void;
    /** Mask counter, owned by the editor runtime. */
    getMaskCounter(): number;
    setMaskCounter(n: number): void;
    /** Re-render the mask list DOM (UI ownership lives in `mask/mask-list.ts`). */
    updateMaskList(): void;
    /** Save canvas state to history. */
    saveCanvasState(): void;
    /**
     * Optional canvas resize hook used when `options.layoutMode` is
     * `'expand'` and the placed mask would extend past the current canvas size.
     * If omitted, the factory calls `canvas.setDimensions` directly. The
     * facade typically passes `setCanvasSizePx` here so the scroll
     * container reflows synchronously with the new canvas size.
     */
    expandCanvasIfNeeded?: (width: number, height: number) => void;
}

function isFabricObjectLike(value: unknown): value is FabricNS.FabricObject {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as {
        set?: unknown;
        on?: unknown;
    };
    return typeof candidate.set === 'function' && typeof candidate.on === 'function';
}

function isStyleObject(value: unknown): value is Partial<FabricNS.FabricObjectProps> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function mergeMaskConfig(defaultMaskConfig: DefaultMaskConfig, config: MaskConfig): MaskConfig {
    const safeDefaultConfig = copySafeOwnProperties<Record<string, unknown>>(defaultMaskConfig);
    const defaultStyles = safeDefaultConfig.styles;
    delete safeDefaultConfig.onCreate;
    delete safeDefaultConfig.fabricGenerator;
    delete safeDefaultConfig.styles;
    const safeConfig = copySafeOwnProperties<Record<string, unknown>>(config);
    const configStyles = copySafeOwnProperties<FabricNS.FabricObjectProps>(config.styles);
    const safeDefaultStyles = copySafeOwnProperties<FabricNS.FabricObjectProps>(
        isStyleObject(defaultStyles) ? defaultStyles : {},
    );

    return {
        ...safeDefaultConfig,
        ...safeConfig,
        styles: {
            ...safeDefaultStyles,
            ...configStyles,
        },
    };
}

function warnInvalidMask(options: ResolvedOptions, reason: string): void {
    reportWarning(options, null, `createMask skipped: ${reason}.`);
}

function isBuiltInMaskShape(value: unknown): value is MaskShapeKind {
    return typeof value === 'string' && BUILT_IN_MASK_SHAPES.has(value);
}

function resolveMaskShape(
    options: ResolvedOptions,
    shape: NonNullable<MaskConfig['shape']>,
): MaskShapeKind {
    if (isBuiltInMaskShape(shape)) return shape;
    reportWarning(
        options,
        null,
        `createMask received unsupported shape "${String(shape)}"; using "rect" instead.`,
    );
    return 'rect';
}

function isResolvableNumericInput(value: unknown): boolean {
    if (value === undefined) return true;
    if (typeof value === 'number') return Number.isFinite(value);
    if (typeof value === 'function') return true;
    if (typeof value === 'string' && value.endsWith('%')) {
        return Number.isFinite(Number.parseFloat(value));
    }
    return false;
}

function isFiniteNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}

function validateFiniteField(
    options: ResolvedOptions,
    fieldName: string,
    value: unknown,
): value is number {
    if (isFiniteNumber(value)) return true;
    warnInvalidMask(options, `${fieldName} must resolve to a finite number`);
    return false;
}

function validatePositiveField(
    options: ResolvedOptions,
    fieldName: string,
    value: unknown,
): value is number {
    if (isFiniteNumber(value) && value > 0) return true;
    warnInvalidMask(options, `${fieldName} must resolve to a positive number`);
    return false;
}

function validateNonNegativeField(
    options: ResolvedOptions,
    fieldName: string,
    value: unknown,
): value is number {
    if (isFiniteNumber(value) && value >= 0) return true;
    warnInvalidMask(options, `${fieldName} must resolve to a non-negative number`);
    return false;
}

function validateNumericInputs(options: ResolvedOptions, config: MaskConfig): boolean {
    const fields: Array<[string, unknown]> = [
        ['width', config.width],
        ['height', config.height],
        ['rx', config.rx],
        ['ry', config.ry],
        ['radius', config.radius],
        ['left', config.left],
        ['top', config.top],
    ];
    for (const [fieldName, value] of fields) {
        if (!isResolvableNumericInput(value)) {
            warnInvalidMask(options, `${fieldName} is not a supported numeric value`);
            return false;
        }
    }
    return true;
}

function resolveMaskNumericField(
    options: ResolvedOptions,
    fieldName: string,
    value: MaskConfig[keyof Pick<
        MaskConfig,
        'left' | 'top' | 'width' | 'height' | 'rx' | 'ry' | 'radius'
    >],
    axis: 'x' | 'y',
    fallback: number,
    canvas: FabricNS.Canvas,
): number | null {
    try {
        return resolveNumeric(value, axis, fallback, canvas, options);
    } catch (error) {
        reportWarning(options, error, `createMask skipped: ${fieldName} resolver threw.`);
        return null;
    }
}

function resolvePolygonPoints(
    options: ResolvedOptions,
    points: MaskConfig['points'],
): Array<{ x: number; y: number }> | null {
    if (!Array.isArray(points) || points.length < 3) {
        warnInvalidMask(options, 'polygon masks require at least three points');
        return null;
    }
    const resolvedPoints = points.map(coercePoint);
    const allFinite = resolvedPoints.every(
        (point) => Number.isFinite(point.x) && Number.isFinite(point.y),
    );
    if (!allFinite) {
        warnInvalidMask(options, 'polygon points must contain finite x/y values');
        return null;
    }
    if (polygonArea(resolvedPoints) <= POLYGON_AREA_EPSILON) {
        warnInvalidMask(options, 'polygon points must describe a non-zero area');
        return null;
    }
    return resolvedPoints;
}

function resizeMaskCanvas(context: CreateMaskContext, width: number, height: number): void {
    if (context.expandCanvasIfNeeded) {
        context.expandCanvasIfNeeded(width, height);
    } else {
        context.canvas.setDimensions({ width, height });
    }
}

function polygonArea(points: Array<{ x: number; y: number }>): number {
    let area = 0;
    for (let index = 0; index < points.length; index += 1) {
        const current = points[index]!;
        const next = points[(index + 1) % points.length]!;
        area += current.x * next.y - next.x * current.y;
    }
    return Math.abs(area) / 2;
}

/**
 * Create a mask via the resolved {@link MaskConfig} and add it to the
 * canvas.
 *
 * Creation steps:
 *
 * 1. Resolve the config: apply built-in defaults, host mask size options,
 *    `options.defaultMaskConfig`, and per-call overrides, then resolve
 *    placement (`left`/`top`) and dimensions
 *    (`width`/`height`/`rx`/`ry`/`radius`) via {@link resolveNumeric} so
 *    percentages and factory functions collapse to pixel numbers before
 *    Fabric shape construction.
 * 2. Optionally expand the canvas if the placement would overflow.
 * 3. Build the Fabric shape — switch on the merged `shape`, or call the
 *    per-call `config.fabricGenerator` if provided.
 * 4. Apply common mask properties. Falsy flags (`hasControls`,
 *    `selectable`, `evented`, `transparentCorners`, `strokeUniform`) use
 *    the `'foo' in mergedConfig ? … : default` pattern so an explicit
 *    `false` is preserved. Stroke / strokeWidth / strokeDashArray pulled
 *    out of `styles` use the same `in` check so `null` and `0` are
 *    preserved verbatim.
 * 5. Increment `maskCounter` and assign `maskId`, `maskName`,
 *    `originalAlpha`.
 * 6. Post-create order: add to canvas → `updateMaskList` →
 *    `setActiveObject` (when `selectable !== false`) → `saveCanvasState`
 *    → `config.onCreate(mask, canvas)`.
 *
 * @param context - Orchestration context — see {@link CreateMaskContext}.
 * @param config - User-supplied mask configuration.
 * @returns      The created mask object, or `null` if the canvas is unset.
 */
export function createMask(context: CreateMaskContext, config: MaskConfig = {}): MaskObject | null {
    const { canvas, options, fabric: fabricModule } = context;
    if (!canvas) return null;

    const mergedConfig = mergeMaskConfig(options.defaultMaskConfig, config);
    const requestedShapeType = mergedConfig.shape ?? 'rect';
    if (!validateNumericInputs(options, mergedConfig)) return null;

    const shapeType =
        typeof config.fabricGenerator === 'function'
            ? requestedShapeType
            : resolveMaskShape(options, requestedShapeType);

    // ── Resolve config (defaults merged with the user overrides) ──────────
    const resolvedConfig: ResolvedMaskConfig = {
        width: options.defaultMaskWidth,
        height: options.defaultMaskHeight,
        color: 'rgba(0,0,0,0.5)',
        alpha: 0.5,
        gap: 5,
        left: undefined,
        top: undefined,
        angle: 0,
        selectable: true,
        ...mergedConfig,
        shape: shapeType,
    } as ResolvedMaskConfig;

    const firstOffset = 10;

    // ── Resolve placement (auto-place to the right of the previous mask
    //    when the caller did not specify `left`) ───────────────────────────
    let left: number;
    let top: number;
    const previousMask = context.getLastMask();
    if (mergedConfig.left === undefined && previousMask) {
        const previousRight =
            (previousMask.left ?? 0) +
            (typeof previousMask.getScaledWidth === 'function'
                ? previousMask.getScaledWidth()
                : (previousMask.width ?? 0) * (previousMask.scaleX ?? 1));
        left = Math.round(previousRight + (resolvedConfig.gap ?? 5));
        top = previousMask.top ?? firstOffset;
    } else {
        const resolvedLeft = resolveMaskNumericField(
            options,
            'left',
            mergedConfig.left,
            'x',
            firstOffset,
            canvas,
        );
        const resolvedTop = resolveMaskNumericField(
            options,
            'top',
            mergedConfig.top,
            'y',
            firstOffset,
            canvas,
        );
        if (resolvedLeft === null || resolvedTop === null) return null;
        left = resolvedLeft;
        top = resolvedTop;
    }

    // ── Resolve dimensions (axis-aware percentages) ──
    const resolvedWidth = resolveMaskNumericField(
        options,
        'width',
        mergedConfig.width,
        'x',
        options.defaultMaskWidth,
        canvas,
    );
    const resolvedHeight = resolveMaskNumericField(
        options,
        'height',
        mergedConfig.height,
        'y',
        options.defaultMaskHeight,
        canvas,
    );
    if (resolvedWidth === null || resolvedHeight === null) return null;
    resolvedConfig.width = resolvedWidth;
    resolvedConfig.height = resolvedHeight;

    let rx: number | undefined;
    if (mergedConfig.rx !== undefined) {
        const resolvedRx = resolveMaskNumericField(options, 'rx', mergedConfig.rx, 'x', 0, canvas);
        if (resolvedRx === null) return null;
        rx = resolvedRx;
    }
    let ry: number | undefined;
    if (mergedConfig.ry !== undefined) {
        const resolvedRy = resolveMaskNumericField(options, 'ry', mergedConfig.ry, 'y', 0, canvas);
        if (resolvedRy === null) return null;
        ry = resolvedRy;
    }
    let radius: number | undefined;
    if (shapeType === 'circle') {
        const resolvedRadius = resolveMaskNumericField(
            options,
            'radius',
            mergedConfig.radius,
            'x',
            Math.min(resolvedConfig.width, resolvedConfig.height) / 2,
            canvas,
        );
        if (resolvedRadius === null) return null;
        radius = resolvedRadius;
    }
    const polygonPoints =
        shapeType === 'polygon' ? resolvePolygonPoints(options, mergedConfig.points) : null;

    if (
        !validateFiniteField(options, 'left', left) ||
        !validateFiniteField(options, 'top', top) ||
        !validatePositiveField(options, 'width', resolvedConfig.width) ||
        !validatePositiveField(options, 'height', resolvedConfig.height) ||
        !validateFiniteField(options, 'gap', resolvedConfig.gap) ||
        !validateFiniteField(options, 'angle', resolvedConfig.angle) ||
        !validateFiniteField(options, 'alpha', resolvedConfig.alpha)
    ) {
        return null;
    }
    if (
        (rx !== undefined && !validateNonNegativeField(options, 'rx', rx)) ||
        (ry !== undefined && !validateNonNegativeField(options, 'ry', ry)) ||
        (radius !== undefined && !validatePositiveField(options, 'radius', radius)) ||
        (shapeType === 'polygon' && polygonPoints === null)
    ) {
        return null;
    }

    // ── Expand canvas only when placement would overflow ─────────────────
    //    Never use viewport dimensions as a floor here — that would shrink a
    //    wider-than-viewport canvas (removing its scrollbar).
    let preExpandCanvasSize: { width: number; height: number } | null = null;
    if (options.layoutMode === 'expand') {
        const requiredWidth = Math.ceil(left + resolvedConfig.width + 10);
        const requiredHeight = Math.ceil(top + resolvedConfig.height + 10);
        const nextWidth = Math.max(canvas.getWidth(), requiredWidth);
        const nextHeight = Math.max(canvas.getHeight(), requiredHeight);
        if (nextWidth !== canvas.getWidth() || nextHeight !== canvas.getHeight()) {
            preExpandCanvasSize = { width: canvas.getWidth(), height: canvas.getHeight() };
            resizeMaskCanvas(context, nextWidth, nextHeight);
        }
    }

    const rollbackCanvasExpansion = (): void => {
        if (!preExpandCanvasSize) return;
        try {
            resizeMaskCanvas(context, preExpandCanvasSize.width, preExpandCanvasSize.height);
        } catch (error) {
            reportWarning(options, error, 'createMask rollback canvas size failed.');
        }
    };

    // ── Build the Fabric shape ──────────────────
    let mask: FabricNS.FabricObject;

    if (typeof config.fabricGenerator === 'function') {
        let generated: unknown;
        try {
            generated = config.fabricGenerator(resolvedConfig, canvas, options) as unknown;
        } catch (error) {
            rollbackCanvasExpansion();
            reportWarning(options, error, 'createMask skipped: fabricGenerator threw.');
            return null;
        }
        if (!isFabricObjectLike(generated)) {
            rollbackCanvasExpansion();
            reportWarning(
                options,
                generated,
                'createMask skipped: fabricGenerator did not return a Fabric object.',
            );
            return null;
        }
        mask = generated;
    } else {
        // Fabric objects default to originX/Y 'center'/'center'.
        // Masks must declare 'left'/'top' so coordinates refer to the
        // top-left corner used by the placement logic above.
        const originProps = {
            originX: 'left' as FabricNS.TOriginX,
            originY: 'top' as FabricNS.TOriginY,
        };

        switch (shapeType) {
            case 'circle':
                mask = new fabricModule.Circle({
                    left,
                    top,
                    ...originProps,
                    radius,
                    fill: resolvedConfig.color,
                    opacity: resolvedConfig.alpha,
                    angle: resolvedConfig.angle ?? 0,
                    ...resolvedConfig.styles,
                });
                break;
            case 'ellipse':
                mask = new fabricModule.Ellipse({
                    left,
                    top,
                    ...originProps,
                    rx: rx ?? resolvedConfig.width / 2,
                    ry: ry ?? resolvedConfig.height / 2,
                    fill: resolvedConfig.color,
                    opacity: resolvedConfig.alpha,
                    angle: resolvedConfig.angle ?? 0,
                    ...resolvedConfig.styles,
                });
                break;
            case 'polygon': {
                // Bounding-box realignment.
                //
                // Fabric.js `Polygon` constructor centers the
                // polygon's `pathOffset` on the supplied `(left, top)`,
                // so passing `(left, top)` directly puts the bounding
                // box somewhere offset from the requested coordinate
                // (the offset depends on the geometry of `points`). To
                // honor the documented "bounding box top-left maps to
                // (left, top)" contract we:
                //   1. construct the polygon without `left`/`top`,
                //   2. measure where Fabric placed its bounding rect,
                //   3. shift the object by the delta between the
                //      requested `(left, top)` and the actual bounding
                //      rect top-left.
                // After the shift the rendered bounding-box top-left
                // matches the resolved `(left, top)`.
                const polygon = new fabricModule.Polygon(polygonPoints!, {
                    ...originProps,
                    fill: resolvedConfig.color,
                    opacity: resolvedConfig.alpha,
                    angle: resolvedConfig.angle ?? 0,
                    ...resolvedConfig.styles,
                });
                polygon.setCoords();
                const boundingRect = polygon.getBoundingRect();
                const deltaX = left - boundingRect.left;
                const deltaY = top - boundingRect.top;
                polygon.set({
                    left: (polygon.left ?? 0) + deltaX,
                    top: (polygon.top ?? 0) + deltaY,
                });
                polygon.setCoords();
                mask = polygon;
                break;
            }
            case 'rect':
            default:
                mask = new fabricModule.Rect({
                    left,
                    top,
                    ...originProps,
                    width: resolvedConfig.width,
                    height: resolvedConfig.height,
                    fill: resolvedConfig.color,
                    opacity: resolvedConfig.alpha,
                    angle: resolvedConfig.angle ?? 0,
                    ...(rx !== undefined ? { rx } : {}),
                    ...(ry !== undefined ? { ry } : {}),
                    ...resolvedConfig.styles,
                });
        }
    }

    // ── Common mask properties ─────────────────────────
    //    The flags below use the `'foo' in mergedConfig ? … : default`
    //    pattern so that an explicit `false` is preserved as `false` and
    //    `undefined` falls back to the documented default.
    const maskObject = mask as MaskObject;
    maskObject.selectable = 'selectable' in mergedConfig ? !!mergedConfig.selectable : true;
    maskObject.evented = 'evented' in mergedConfig ? !!mergedConfig.evented : true;
    maskObject.hasControls = 'hasControls' in mergedConfig ? !!mergedConfig.hasControls : true;
    maskObject.transparentCorners =
        'transparentCorners' in mergedConfig ? !!mergedConfig.transparentCorners : false;
    maskObject.strokeUniform =
        'strokeUniform' in mergedConfig ? !!mergedConfig.strokeUniform : true;
    maskObject.lockRotation = !options.maskRotatable;
    maskObject.borderColor = mergedConfig.borderColor ?? 'red';
    maskObject.cornerColor = mergedConfig.cornerColor ?? 'black';
    maskObject.cornerSize = mergedConfig.cornerSize ?? 8;

    // ── Stroke defaults — preserve falsy values from `styles` ─────────────
    //    `??` would replace `null` with the default. Use an `in` check so
    //    `styles.stroke = null` (or `''`, `0`) is preserved verbatim.
    const styles = (resolvedConfig.styles ?? {}) as Partial<FabricNS.FabricObjectProps>;
    if ('stroke' in styles) {
        maskObject.stroke = styles.stroke as FabricNS.TFiller | string | null;
    } else {
        maskObject.stroke = '#ccc';
    }
    if ('strokeWidth' in styles) {
        maskObject.strokeWidth = styles.strokeWidth as number;
    } else {
        maskObject.strokeWidth = 1;
    }
    if ('strokeDashArray' in styles) {
        maskObject.strokeDashArray = styles.strokeDashArray as number[];
    }

    // ── Counter and identity ──────────────────────────
    const nextId = context.getMaskCounter() + 1;
    context.setMaskCounter(nextId);
    markMaskObject(maskObject, {
        maskId: nextId,
        maskUid: createMaskUid(nextId),
        maskName: `${options.maskName}${nextId}`,
        originalAlpha: resolvedConfig.alpha,
        originalStroke: maskObject.stroke,
        originalStrokeWidth: maskObject.strokeWidth,
    });
    attachMaskHoverHandlers(maskObject);

    context.setLastMask(maskObject);

    // ── Post-create order ───────────────────────
    //    add → updateMaskList → setActiveObject → saveCanvasState → onCreate.
    placeMaskObject(canvas, maskObject);

    context.updateMaskList();

    if (resolvedConfig.selectable !== false) {
        // setActiveObject fires 'selection:created' and the orchestrator's
        // selection handler reacts (e.g. by creating the mask label).
        canvas.setActiveObject(maskObject);
    }

    // Keep the newly active mask painted before history capture and
    // onCreate callbacks that may inspect the canvas immediately.
    canvas.renderAll();
    context.saveCanvasState();

    if (typeof config.onCreate === 'function') {
        try {
            config.onCreate(maskObject, canvas);
        } catch (error) {
            reportWarning(options, error, 'createMask onCreate callback threw.');
        }
    }

    return maskObject;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mask removal
// ─────────────────────────────────────────────────────────────────────────────
//
// `removeSelectedMask` and `removeAllMasks` are pure helpers that take a
// {@link RemoveMaskContext} so the runtime retains ownership of the canvas,
// history, and `lastMask` slot while the facade owns DOM callbacks.
//
// Owned contracts:
//
// - While `isAnimating` is `true`, `removeAllMasks`
//   SHALL be rejected by the caller (the runtime operation guard). This
//   module is invoked only after the guard has cleared,
//   so the helpers themselves do not consult `isAnimating`.
// - `removeAllMasks` clears `lastMask` on success so
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
 * canvas, mask label DOM, mask list DOM, history, and `lastMask` stays on
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
     * Reset the orchestrator's `lastMask` reference. Called with `null`
     * when every mask is removed so the next `createMask` does not
     * auto-place relative to a removed mask.
     */
    setLastMask(mask: MaskObject | null): void;
}

function isActiveSelectionObject(object: FabricNS.FabricObject | null | undefined): boolean {
    if (!object) return false;
    const type = typeof object.type === 'string' ? object.type.toLowerCase() : '';
    if (type === 'activeselection') return true;
    const isType = (object as { isType?: (...types: string[]) => boolean }).isType;
    return (
        typeof isType === 'function' &&
        (isType.call(object, 'ActiveSelection') || isType.call(object, 'activeSelection'))
    );
}

function getSelectedMaskObjects(canvas: FabricNS.Canvas): MaskObject[] {
    const active = canvas.getActiveObject();
    if (!active) return [];
    if (!isActiveSelectionObject(active)) return isMaskObject(active) ? [active] : [];
    const getObjects = (active as { getObjects?: () => FabricNS.FabricObject[] }).getObjects;
    const objects = typeof getObjects === 'function' ? getObjects.call(active) : [];
    return objects.filter(isMaskObject);
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
 * @param context - Orchestration context — see {@link RemoveMaskContext}.
 */
export function removeSelectedMask(context: RemoveMaskContext): void {
    const selectedMasks = getSelectedMaskObjects(context.canvas);
    if (selectedMasks.length === 0) return;
    for (const mask of selectedMasks) {
        context.removeLabelForMask(mask);
        detachMaskHoverHandlers(mask);
        context.canvas.remove(mask);
    }
    context.canvas.discardActiveObject();
    context.updateMaskList();
    // Removal helpers are synchronous APIs; callers should observe the
    // canvas without waiting for a deferred paint.
    context.canvas.renderAll();
    context.saveCanvasState();
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
 * 4. Reset `lastMask` to `null` so the next `createMask` does not
 *    auto-place relative to a removed reference.
 * 5. Re-render the mask list DOM and the canvas.
 * 6. Conditionally push a history entry depending on
 *    `options.saveHistory`.
 *
 * @param context - Orchestration context — see {@link RemoveMaskContext}.
 * @param options - Bulk-removal options. Defaults to `{ saveHistory: true}`.
 */
export function removeAllMasks(
    context: RemoveMaskContext,
    options: RemoveAllMasksOptions = {},
): void {
    const masks = context.canvas.getObjects().filter(isMaskObject);
    if (masks.length === 0) return;

    for (const maskObject of masks) {
        context.removeLabelForMask(maskObject);
        detachMaskHoverHandlers(maskObject);
        context.canvas.remove(maskObject);
    }
    context.canvas.discardActiveObject();
    context.setLastMask(null);
    context.updateMaskList();
    // Match single-mask removal: the batch is fully visible before the
    // optional history entry is recorded.
    context.canvas.renderAll();

    // Default `saveHistory` is `true`; only skip when the caller explicitly
    // providedOptions out (merge/crop pipelines).
    if (options.saveHistory !== false) {
        context.saveCanvasState();
    }
}
