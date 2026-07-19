/**
 * Builds configured Fabric mask objects for the Mask Plugin.
 *
 * Shape resolution, stable identity assignment, placement, and callback ordering are kept in
 * one boundary so the Plugin controller retains ownership of transactions and lifecycle state.
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
    ResolvedMaskConfig,
    ResolvedOptions,
} from '../core/public-types.js';
import { markMaskObject } from '../core/editor-object-kind.js';
import { placeMaskObject } from '../core/layer-order.js';
import { reportWarning } from '../core/callback-reporter.js';
import { copySafeOwnProperties } from '../core/safe-object-copy.js';
import { attachMaskHoverHandlers } from './mask-style.js';
import { coercePoint, resolveNumeric } from '../utils/number.js';

const POLYGON_AREA_EPSILON = 1e-6;
const BUILT_IN_MASK_SHAPES = new Set<string>(['rect', 'circle', 'ellipse', 'polygon']);

function createMaskUid(maskId: number): string {
    return `mask-${maskId}`;
}

/**
 * State and host callbacks required to create and commit a mask.
 *
 * Canvas, counter, and resize ownership remains with the caller.
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
    /**
     * Optional canvas resize hook used when `options.layoutMode` is
     * `'expand'` and the placed mask would extend past the current canvas size.
     * If omitted, the factory calls `canvas.setDimensions` directly. The host may use
     * this hook to keep its viewport measurement synchronized with the Canvas size.
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
 * 6. Post-create order: add to Canvas → activate when selectable → render →
 *    `config.onCreate(mask, canvas)`.
 *
 * @param context - Orchestration context — see {@link CreateMaskContext}.
 * @param config - User-supplied mask configuration.
 * @returns The created mask, or `null` when input resolution or a custom generator fails.
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

    placeMaskObject(canvas, maskObject);

    if (resolvedConfig.selectable !== false) {
        // setActiveObject fires 'selection:created' and the orchestrator's
        // selection handler reacts (e.g. by creating the mask label).
        canvas.setActiveObject(maskObject);
    }

    // Paint the active style before an onCreate callback inspects the Canvas.
    canvas.renderAll();

    if (typeof config.onCreate === 'function') {
        try {
            config.onCreate(maskObject, canvas);
        } catch (error) {
            reportWarning(options, error, 'createMask onCreate callback threw.');
        }
    }

    return maskObject;
}
