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
    MaskFactoryOptions,
    MaskObject,
    MaskShapeKind,
    ResolvedMaskConfig,
    ResolvedOptions,
} from '../core/public-types.js';
import { markMaskObject } from '../core/editor-object-kind.js';
import { placeMaskObject } from '../utils/internal-layer-placement.js';
import { reportWarning } from '../core/callback-reporter.js';
import { copySafeOwnProperties } from '../core/safe-object-copy.js';
import { attachMaskHoverHandlers } from './mask-style.js';
import { coercePoint, resolveNumeric } from '../utils/number.js';
import { isPixelAreaWithinBudget } from '../utils/image-budget.js';

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
    /** Resolved options required by Mask creation and its public callbacks. */
    options: MaskFactoryOptions &
        Partial<Pick<ResolvedOptions, 'maxExportDimension' | 'maxExportPixels'>>;
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

function copyMaskStyles(value: unknown): Partial<FabricNS.FabricObjectProps> {
    const styles = copySafeOwnProperties<FabricNS.FabricObjectProps>(value);
    if (Array.isArray(styles.strokeDashArray)) {
        styles.strokeDashArray = [...styles.strokeDashArray];
    }
    return styles;
}

function mergeMaskConfig(defaultMaskConfig: DefaultMaskConfig, config: MaskConfig): MaskConfig {
    const safeDefaultConfig = copySafeOwnProperties<Record<string, unknown>>(defaultMaskConfig);
    const defaultStyles = safeDefaultConfig.styles;
    delete safeDefaultConfig.onCreate;
    delete safeDefaultConfig.fabricGenerator;
    delete safeDefaultConfig.styles;
    const safeConfig = copySafeOwnProperties<Record<string, unknown>>(config);
    const configStyles = copyMaskStyles(config.styles);
    const safeDefaultStyles = copyMaskStyles(isStyleObject(defaultStyles) ? defaultStyles : {});

    return {
        ...safeDefaultConfig,
        ...safeConfig,
        styles: {
            ...safeDefaultStyles,
            ...configStyles,
        },
    };
}

function warnInvalidMask(options: CreateMaskContext['options'], reason: string): void {
    reportWarning(options, null, `createMask skipped: ${reason}.`);
}

function isBuiltInMaskShape(value: unknown): value is MaskShapeKind {
    return typeof value === 'string' && BUILT_IN_MASK_SHAPES.has(value);
}

function resolveMaskShape(
    options: CreateMaskContext['options'],
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
    options: CreateMaskContext['options'],
    fieldName: string,
    value: unknown,
): value is number {
    if (isFiniteNumber(value)) return true;
    warnInvalidMask(options, `${fieldName} must resolve to a finite number`);
    return false;
}

function validatePositiveField(
    options: CreateMaskContext['options'],
    fieldName: string,
    value: unknown,
): value is number {
    if (isFiniteNumber(value) && value > 0) return true;
    warnInvalidMask(options, `${fieldName} must resolve to a positive number`);
    return false;
}

function validateNonNegativeField(
    options: CreateMaskContext['options'],
    fieldName: string,
    value: unknown,
): value is number {
    if (isFiniteNumber(value) && value >= 0) return true;
    warnInvalidMask(options, `${fieldName} must resolve to a non-negative number`);
    return false;
}

function validateNumericInputs(options: CreateMaskContext['options'], config: MaskConfig): boolean {
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
    options: CreateMaskContext['options'],
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
    options: CreateMaskContext['options'],
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

interface PreparedMaskConfiguration {
    readonly mergedConfig: MaskConfig;
    readonly resolvedConfig: ResolvedMaskConfig;
    readonly shapeType: NonNullable<MaskConfig['shape']>;
}

interface ResolvedMaskPlacement {
    readonly left: number;
    readonly top: number;
}

interface ResolvedMaskDimensions {
    readonly rx: number | undefined;
    readonly ry: number | undefined;
    readonly radius: number | undefined;
    readonly polygonPoints: Array<{ x: number; y: number }> | null;
}

interface MaskCanvasExpansion {
    rollback(): void;
}

function prepareMaskConfiguration(
    context: CreateMaskContext,
    config: MaskConfig,
): PreparedMaskConfiguration | null {
    const { options } = context;
    const mergedConfig = mergeMaskConfig(options.defaultMaskConfig, config);
    const requestedShapeType = mergedConfig.shape ?? 'rect';
    if (!validateNumericInputs(options, mergedConfig)) return null;

    const shapeType =
        typeof config.fabricGenerator === 'function'
            ? requestedShapeType
            : resolveMaskShape(options, requestedShapeType);
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

    return { mergedConfig, resolvedConfig, shapeType };
}

function resolveMaskPlacement(
    context: CreateMaskContext,
    mergedConfig: MaskConfig,
    resolvedConfig: ResolvedMaskConfig,
): ResolvedMaskPlacement | null {
    const { canvas, options } = context;
    const firstOffset = 10;
    const previousMask = context.getLastMask();
    if (mergedConfig.left === undefined && previousMask) {
        const previousRight =
            (previousMask.left ?? 0) +
            (typeof previousMask.getScaledWidth === 'function'
                ? previousMask.getScaledWidth()
                : (previousMask.width ?? 0) * (previousMask.scaleX ?? 1));
        return {
            left: Math.round(previousRight + (resolvedConfig.gap ?? 5)),
            top: previousMask.top ?? firstOffset,
        };
    }

    const left = resolveMaskNumericField(
        options,
        'left',
        mergedConfig.left,
        'x',
        firstOffset,
        canvas,
    );
    const top = resolveMaskNumericField(options, 'top', mergedConfig.top, 'y', firstOffset, canvas);
    return left === null || top === null ? null : { left, top };
}

function resolveMaskDimensions(
    context: CreateMaskContext,
    mergedConfig: MaskConfig,
    resolvedConfig: ResolvedMaskConfig,
    shapeType: NonNullable<MaskConfig['shape']>,
): ResolvedMaskDimensions | null {
    const { canvas, options } = context;
    const width = resolveMaskNumericField(
        options,
        'width',
        mergedConfig.width,
        'x',
        options.defaultMaskWidth,
        canvas,
    );
    const height = resolveMaskNumericField(
        options,
        'height',
        mergedConfig.height,
        'y',
        options.defaultMaskHeight,
        canvas,
    );
    if (width === null || height === null) return null;
    resolvedConfig.width = width;
    resolvedConfig.height = height;

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

    return {
        rx,
        ry,
        radius,
        polygonPoints:
            shapeType === 'polygon' ? resolvePolygonPoints(options, mergedConfig.points) : null,
    };
}

function validateResolvedMask(
    options: CreateMaskContext['options'],
    placement: ResolvedMaskPlacement,
    dimensions: ResolvedMaskDimensions,
    resolvedConfig: ResolvedMaskConfig,
    shapeType: NonNullable<MaskConfig['shape']>,
): boolean {
    if (
        !validateFiniteField(options, 'left', placement.left) ||
        !validateFiniteField(options, 'top', placement.top) ||
        !validatePositiveField(options, 'width', resolvedConfig.width) ||
        !validatePositiveField(options, 'height', resolvedConfig.height) ||
        !validateFiniteField(options, 'gap', resolvedConfig.gap) ||
        !validateFiniteField(options, 'angle', resolvedConfig.angle) ||
        !validateFiniteField(options, 'alpha', resolvedConfig.alpha)
    ) {
        return false;
    }
    return !(
        (dimensions.rx !== undefined && !validateNonNegativeField(options, 'rx', dimensions.rx)) ||
        (dimensions.ry !== undefined && !validateNonNegativeField(options, 'ry', dimensions.ry)) ||
        (dimensions.radius !== undefined &&
            !validatePositiveField(options, 'radius', dimensions.radius)) ||
        (shapeType === 'polygon' && dimensions.polygonPoints === null)
    );
}

function expandMaskCanvas(
    context: CreateMaskContext,
    placement: ResolvedMaskPlacement,
    resolvedConfig: ResolvedMaskConfig,
): MaskCanvasExpansion | null {
    const { canvas, options } = context;
    let preExpandCanvasSize: { width: number; height: number } | null = null;
    if (options.layoutMode === 'expand') {
        const requiredWidth = Math.ceil(placement.left + resolvedConfig.width + 10);
        const requiredHeight = Math.ceil(placement.top + resolvedConfig.height + 10);
        const nextWidth = Math.max(canvas.getWidth(), requiredWidth);
        const nextHeight = Math.max(canvas.getHeight(), requiredHeight);
        const maxExportDimension = options.maxExportDimension;
        const maxExportPixels = options.maxExportPixels;
        if (
            !context.expandCanvasIfNeeded &&
            (typeof maxExportDimension !== 'number' ||
                typeof maxExportPixels !== 'number' ||
                nextWidth > maxExportDimension ||
                nextHeight > maxExportDimension ||
                !isPixelAreaWithinBudget(nextWidth, nextHeight, maxExportPixels))
        ) {
            warnInvalidMask(options, 'canvas expansion exceeds the configured resource budget');
            return null;
        }
        if (nextWidth !== canvas.getWidth() || nextHeight !== canvas.getHeight()) {
            preExpandCanvasSize = { width: canvas.getWidth(), height: canvas.getHeight() };
            resizeMaskCanvas(context, nextWidth, nextHeight);
        }
    }

    return {
        rollback() {
            if (!preExpandCanvasSize) return;
            try {
                resizeMaskCanvas(context, preExpandCanvasSize.width, preExpandCanvasSize.height);
            } catch (error) {
                reportWarning(options, error, 'createMask rollback canvas size failed.');
            }
        },
    };
}

function buildFabricShape(
    context: CreateMaskContext,
    config: MaskConfig,
    resolvedConfig: ResolvedMaskConfig,
    shapeType: NonNullable<MaskConfig['shape']>,
    placement: ResolvedMaskPlacement,
    dimensions: ResolvedMaskDimensions,
    expansion: MaskCanvasExpansion,
): FabricNS.FabricObject | null {
    const { canvas, options, fabric: fabricModule } = context;
    const { left, top } = placement;

    if (typeof config.fabricGenerator === 'function') {
        let generated: unknown;
        try {
            generated = config.fabricGenerator(resolvedConfig, canvas, options) as unknown;
        } catch (error) {
            expansion.rollback();
            reportWarning(options, error, 'createMask skipped: fabricGenerator threw.');
            return null;
        }
        if (!isFabricObjectLike(generated)) {
            expansion.rollback();
            reportWarning(
                options,
                generated,
                'createMask skipped: fabricGenerator did not return a Fabric object.',
            );
            return null;
        }
        return generated;
    }

    // Fabric objects default to originX/Y 'center'/'center'. Masks must declare
    // 'left'/'top' so coordinates refer to the top-left corner used by placement.
    const originProps = {
        originX: 'left' as FabricNS.TOriginX,
        originY: 'top' as FabricNS.TOriginY,
    };

    switch (shapeType) {
        case 'circle': {
            if (dimensions.radius === undefined) {
                expansion.rollback();
                reportWarning(
                    options,
                    dimensions.radius,
                    'createMask skipped: circle radius is missing.',
                );
                return null;
            }
            return new fabricModule.Circle({
                left,
                top,
                ...originProps,
                radius: dimensions.radius,
                fill: resolvedConfig.color,
                opacity: resolvedConfig.alpha,
                angle: resolvedConfig.angle ?? 0,
                ...resolvedConfig.styles,
            });
        }
        case 'ellipse':
            return new fabricModule.Ellipse({
                left,
                top,
                ...originProps,
                rx: dimensions.rx ?? resolvedConfig.width / 2,
                ry: dimensions.ry ?? resolvedConfig.height / 2,
                fill: resolvedConfig.color,
                opacity: resolvedConfig.alpha,
                angle: resolvedConfig.angle ?? 0,
                ...resolvedConfig.styles,
            });
        case 'polygon': {
            // Fabric centers Polygon pathOffset on its supplied position. Construct
            // first, then shift its rendered bounding box to the requested top-left.
            const polygon = new fabricModule.Polygon(dimensions.polygonPoints!, {
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
            return polygon;
        }
        case 'rect':
        default:
            return new fabricModule.Rect({
                left,
                top,
                ...originProps,
                width: resolvedConfig.width,
                height: resolvedConfig.height,
                fill: resolvedConfig.color,
                opacity: resolvedConfig.alpha,
                angle: resolvedConfig.angle ?? 0,
                ...(dimensions.rx !== undefined ? { rx: dimensions.rx } : {}),
                ...(dimensions.ry !== undefined ? { ry: dimensions.ry } : {}),
                ...resolvedConfig.styles,
            });
    }
}

function applyCommonMaskProperties(
    context: CreateMaskContext,
    mask: FabricNS.FabricObject,
    mergedConfig: MaskConfig,
    resolvedConfig: ResolvedMaskConfig,
): MaskObject {
    const { options } = context;
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
    return maskObject;
}

function finalizeMaskAttachment(
    context: CreateMaskContext,
    config: MaskConfig,
    resolvedConfig: ResolvedMaskConfig,
    maskObject: MaskObject,
): MaskObject {
    const { canvas, options } = context;
    context.setLastMask(maskObject);
    placeMaskObject(canvas, maskObject);

    if (resolvedConfig.selectable !== false) {
        // setActiveObject fires selection events after the mask is attached.
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
    const { canvas, options } = context;
    if (!canvas) return null;

    const prepared = prepareMaskConfiguration(context, config);
    if (!prepared) return null;
    const { mergedConfig, resolvedConfig, shapeType } = prepared;

    const placement = resolveMaskPlacement(context, mergedConfig, resolvedConfig);
    if (!placement) return null;
    const dimensions = resolveMaskDimensions(context, mergedConfig, resolvedConfig, shapeType);
    if (!dimensions) return null;
    if (!validateResolvedMask(options, placement, dimensions, resolvedConfig, shapeType)) {
        return null;
    }

    // Never use viewport dimensions as an expansion floor; doing so could shrink
    // a wider-than-viewport Canvas and remove its scrollbar.
    const expansion = expandMaskCanvas(context, placement, resolvedConfig);
    if (!expansion) return null;
    const mask = buildFabricShape(
        context,
        config,
        resolvedConfig,
        shapeType,
        placement,
        dimensions,
        expansion,
    );
    if (!mask) return null;

    const maskObject = applyCommonMaskProperties(context, mask, mergedConfig, resolvedConfig);
    return finalizeMaskAttachment(context, config, resolvedConfig, maskObject);
}
