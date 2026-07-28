import { markMaskObject } from '../core/editor-object-kind.js';
import { placeMaskObject } from '../core/layer-order.js';
import { reportWarning } from '../core/callback-reporter.js';
import { copySafeOwnProperties } from '../core/safe-object-copy.js';
import { attachMaskHoverHandlers } from './mask-style.js';
import { coercePoint, resolveNumeric } from '../utils/number.js';
import { isPixelAreaWithinBudget } from '../utils/image-budget.js';
const POLYGON_AREA_EPSILON = 1e-6;
const BUILT_IN_MASK_SHAPES = new Set(['rect', 'circle', 'ellipse', 'polygon']);
function createMaskUid(maskId) {
    return `mask-${maskId}`;
}
function isFabricObjectLike(value) {
    if (!value || typeof value !== 'object')
        return false;
    const candidate = value;
    return typeof candidate.set === 'function' && typeof candidate.on === 'function';
}
function isStyleObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function copyMaskStyles(value) {
    const styles = copySafeOwnProperties(value);
    if (Array.isArray(styles.strokeDashArray)) {
        styles.strokeDashArray = [...styles.strokeDashArray];
    }
    return styles;
}
function mergeMaskConfig(defaultMaskConfig, config) {
    const safeDefaultConfig = copySafeOwnProperties(defaultMaskConfig);
    const defaultStyles = safeDefaultConfig.styles;
    delete safeDefaultConfig.onCreate;
    delete safeDefaultConfig.fabricGenerator;
    delete safeDefaultConfig.styles;
    const safeConfig = copySafeOwnProperties(config);
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
function warnInvalidMask(options, reason) {
    reportWarning(options, null, `createMask skipped: ${reason}.`);
}
function isBuiltInMaskShape(value) {
    return typeof value === 'string' && BUILT_IN_MASK_SHAPES.has(value);
}
function resolveMaskShape(options, shape) {
    if (isBuiltInMaskShape(shape))
        return shape;
    reportWarning(options, null, `createMask received unsupported shape "${String(shape)}"; using "rect" instead.`);
    return 'rect';
}
function isResolvableNumericInput(value) {
    if (value === undefined)
        return true;
    if (typeof value === 'number')
        return Number.isFinite(value);
    if (typeof value === 'function')
        return true;
    if (typeof value === 'string' && value.endsWith('%')) {
        return Number.isFinite(Number.parseFloat(value));
    }
    return false;
}
function isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
}
function validateFiniteField(options, fieldName, value) {
    if (isFiniteNumber(value))
        return true;
    warnInvalidMask(options, `${fieldName} must resolve to a finite number`);
    return false;
}
function validatePositiveField(options, fieldName, value) {
    if (isFiniteNumber(value) && value > 0)
        return true;
    warnInvalidMask(options, `${fieldName} must resolve to a positive number`);
    return false;
}
function validateNonNegativeField(options, fieldName, value) {
    if (isFiniteNumber(value) && value >= 0)
        return true;
    warnInvalidMask(options, `${fieldName} must resolve to a non-negative number`);
    return false;
}
function validateNumericInputs(options, config) {
    const fields = [
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
function resolveMaskNumericField(options, fieldName, value, axis, fallback, canvas) {
    try {
        return resolveNumeric(value, axis, fallback, canvas, options);
    }
    catch (error) {
        reportWarning(options, error, `createMask skipped: ${fieldName} resolver threw.`);
        return null;
    }
}
function resolvePolygonPoints(options, points) {
    if (!Array.isArray(points) || points.length < 3) {
        warnInvalidMask(options, 'polygon masks require at least three points');
        return null;
    }
    const resolvedPoints = points.map(coercePoint);
    const allFinite = resolvedPoints.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
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
function resizeMaskCanvas(context, width, height) {
    if (context.expandCanvasIfNeeded) {
        context.expandCanvasIfNeeded(width, height);
    }
    else {
        context.canvas.setDimensions({ width, height });
    }
}
function polygonArea(points) {
    let area = 0;
    for (let index = 0; index < points.length; index += 1) {
        const current = points[index];
        const next = points[(index + 1) % points.length];
        area += current.x * next.y - next.x * current.y;
    }
    return Math.abs(area) / 2;
}
function prepareMaskConfiguration(context, config) {
    var _a;
    const { options } = context;
    const mergedConfig = mergeMaskConfig(options.defaultMaskConfig, config);
    const requestedShapeType = (_a = mergedConfig.shape) !== null && _a !== void 0 ? _a : 'rect';
    if (!validateNumericInputs(options, mergedConfig))
        return null;
    const shapeType = typeof config.fabricGenerator === 'function'
        ? requestedShapeType
        : resolveMaskShape(options, requestedShapeType);
    const resolvedConfig = {
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
    };
    return { mergedConfig, resolvedConfig, shapeType };
}
function resolveMaskPlacement(context, mergedConfig, resolvedConfig) {
    var _a, _b, _c, _d, _e;
    const { canvas, options } = context;
    const firstOffset = 10;
    const previousMask = context.getLastMask();
    if (mergedConfig.left === undefined && previousMask) {
        const previousRight = ((_a = previousMask.left) !== null && _a !== void 0 ? _a : 0) +
            (typeof previousMask.getScaledWidth === 'function'
                ? previousMask.getScaledWidth()
                : ((_b = previousMask.width) !== null && _b !== void 0 ? _b : 0) * ((_c = previousMask.scaleX) !== null && _c !== void 0 ? _c : 1));
        return {
            left: Math.round(previousRight + ((_d = resolvedConfig.gap) !== null && _d !== void 0 ? _d : 5)),
            top: (_e = previousMask.top) !== null && _e !== void 0 ? _e : firstOffset,
        };
    }
    const left = resolveMaskNumericField(options, 'left', mergedConfig.left, 'x', firstOffset, canvas);
    const top = resolveMaskNumericField(options, 'top', mergedConfig.top, 'y', firstOffset, canvas);
    return left === null || top === null ? null : { left, top };
}
function resolveMaskDimensions(context, mergedConfig, resolvedConfig, shapeType) {
    const { canvas, options } = context;
    const width = resolveMaskNumericField(options, 'width', mergedConfig.width, 'x', options.defaultMaskWidth, canvas);
    const height = resolveMaskNumericField(options, 'height', mergedConfig.height, 'y', options.defaultMaskHeight, canvas);
    if (width === null || height === null)
        return null;
    resolvedConfig.width = width;
    resolvedConfig.height = height;
    let rx;
    if (mergedConfig.rx !== undefined) {
        const resolvedRx = resolveMaskNumericField(options, 'rx', mergedConfig.rx, 'x', 0, canvas);
        if (resolvedRx === null)
            return null;
        rx = resolvedRx;
    }
    let ry;
    if (mergedConfig.ry !== undefined) {
        const resolvedRy = resolveMaskNumericField(options, 'ry', mergedConfig.ry, 'y', 0, canvas);
        if (resolvedRy === null)
            return null;
        ry = resolvedRy;
    }
    let radius;
    if (shapeType === 'circle') {
        const resolvedRadius = resolveMaskNumericField(options, 'radius', mergedConfig.radius, 'x', Math.min(resolvedConfig.width, resolvedConfig.height) / 2, canvas);
        if (resolvedRadius === null)
            return null;
        radius = resolvedRadius;
    }
    return {
        rx,
        ry,
        radius,
        polygonPoints: shapeType === 'polygon' ? resolvePolygonPoints(options, mergedConfig.points) : null,
    };
}
function validateResolvedMask(options, placement, dimensions, resolvedConfig, shapeType) {
    if (!validateFiniteField(options, 'left', placement.left) ||
        !validateFiniteField(options, 'top', placement.top) ||
        !validatePositiveField(options, 'width', resolvedConfig.width) ||
        !validatePositiveField(options, 'height', resolvedConfig.height) ||
        !validateFiniteField(options, 'gap', resolvedConfig.gap) ||
        !validateFiniteField(options, 'angle', resolvedConfig.angle) ||
        !validateFiniteField(options, 'alpha', resolvedConfig.alpha)) {
        return false;
    }
    return !((dimensions.rx !== undefined && !validateNonNegativeField(options, 'rx', dimensions.rx)) ||
        (dimensions.ry !== undefined && !validateNonNegativeField(options, 'ry', dimensions.ry)) ||
        (dimensions.radius !== undefined &&
            !validatePositiveField(options, 'radius', dimensions.radius)) ||
        (shapeType === 'polygon' && dimensions.polygonPoints === null));
}
function expandMaskCanvas(context, placement, resolvedConfig) {
    const { canvas, options } = context;
    let preExpandCanvasSize = null;
    if (options.layoutMode === 'expand') {
        const requiredWidth = Math.ceil(placement.left + resolvedConfig.width + 10);
        const requiredHeight = Math.ceil(placement.top + resolvedConfig.height + 10);
        const nextWidth = Math.max(canvas.getWidth(), requiredWidth);
        const nextHeight = Math.max(canvas.getHeight(), requiredHeight);
        const maxExportDimension = options.maxExportDimension;
        const maxExportPixels = options.maxExportPixels;
        if (!context.expandCanvasIfNeeded &&
            (typeof maxExportDimension !== 'number' ||
                typeof maxExportPixels !== 'number' ||
                nextWidth > maxExportDimension ||
                nextHeight > maxExportDimension ||
                !isPixelAreaWithinBudget(nextWidth, nextHeight, maxExportPixels))) {
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
            if (!preExpandCanvasSize)
                return;
            try {
                resizeMaskCanvas(context, preExpandCanvasSize.width, preExpandCanvasSize.height);
            }
            catch (error) {
                reportWarning(options, error, 'createMask rollback canvas size failed.');
            }
        },
    };
}
function buildFabricShape(context, config, resolvedConfig, shapeType, placement, dimensions, expansion) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const { canvas, options, fabric: fabricModule } = context;
    const { left, top } = placement;
    if (typeof config.fabricGenerator === 'function') {
        let generated;
        try {
            generated = config.fabricGenerator(resolvedConfig, canvas, options);
        }
        catch (error) {
            expansion.rollback();
            reportWarning(options, error, 'createMask skipped: fabricGenerator threw.');
            return null;
        }
        if (!isFabricObjectLike(generated)) {
            expansion.rollback();
            reportWarning(options, generated, 'createMask skipped: fabricGenerator did not return a Fabric object.');
            return null;
        }
        return generated;
    }
    const originProps = {
        originX: 'left',
        originY: 'top',
    };
    switch (shapeType) {
        case 'circle': {
            if (dimensions.radius === undefined) {
                expansion.rollback();
                reportWarning(options, dimensions.radius, 'createMask skipped: circle radius is missing.');
                return null;
            }
            return new fabricModule.Circle({
                left,
                top,
                ...originProps,
                radius: dimensions.radius,
                fill: resolvedConfig.color,
                opacity: resolvedConfig.alpha,
                angle: (_a = resolvedConfig.angle) !== null && _a !== void 0 ? _a : 0,
                ...resolvedConfig.styles,
            });
        }
        case 'ellipse':
            return new fabricModule.Ellipse({
                left,
                top,
                ...originProps,
                rx: (_b = dimensions.rx) !== null && _b !== void 0 ? _b : resolvedConfig.width / 2,
                ry: (_c = dimensions.ry) !== null && _c !== void 0 ? _c : resolvedConfig.height / 2,
                fill: resolvedConfig.color,
                opacity: resolvedConfig.alpha,
                angle: (_d = resolvedConfig.angle) !== null && _d !== void 0 ? _d : 0,
                ...resolvedConfig.styles,
            });
        case 'polygon': {
            const polygon = new fabricModule.Polygon(dimensions.polygonPoints, {
                ...originProps,
                fill: resolvedConfig.color,
                opacity: resolvedConfig.alpha,
                angle: (_e = resolvedConfig.angle) !== null && _e !== void 0 ? _e : 0,
                ...resolvedConfig.styles,
            });
            polygon.setCoords();
            const boundingRect = polygon.getBoundingRect();
            const deltaX = left - boundingRect.left;
            const deltaY = top - boundingRect.top;
            polygon.set({
                left: ((_f = polygon.left) !== null && _f !== void 0 ? _f : 0) + deltaX,
                top: ((_g = polygon.top) !== null && _g !== void 0 ? _g : 0) + deltaY,
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
                angle: (_h = resolvedConfig.angle) !== null && _h !== void 0 ? _h : 0,
                ...(dimensions.rx !== undefined ? { rx: dimensions.rx } : {}),
                ...(dimensions.ry !== undefined ? { ry: dimensions.ry } : {}),
                ...resolvedConfig.styles,
            });
    }
}
function applyCommonMaskProperties(context, mask, mergedConfig, resolvedConfig) {
    var _a, _b, _c, _d;
    const { options } = context;
    const maskObject = mask;
    maskObject.selectable = 'selectable' in mergedConfig ? !!mergedConfig.selectable : true;
    maskObject.evented = 'evented' in mergedConfig ? !!mergedConfig.evented : true;
    maskObject.hasControls = 'hasControls' in mergedConfig ? !!mergedConfig.hasControls : true;
    maskObject.transparentCorners =
        'transparentCorners' in mergedConfig ? !!mergedConfig.transparentCorners : false;
    maskObject.strokeUniform =
        'strokeUniform' in mergedConfig ? !!mergedConfig.strokeUniform : true;
    maskObject.lockRotation = !options.maskRotatable;
    maskObject.borderColor = (_a = mergedConfig.borderColor) !== null && _a !== void 0 ? _a : 'red';
    maskObject.cornerColor = (_b = mergedConfig.cornerColor) !== null && _b !== void 0 ? _b : 'black';
    maskObject.cornerSize = (_c = mergedConfig.cornerSize) !== null && _c !== void 0 ? _c : 8;
    const styles = ((_d = resolvedConfig.styles) !== null && _d !== void 0 ? _d : {});
    if ('stroke' in styles) {
        maskObject.stroke = styles.stroke;
    }
    else {
        maskObject.stroke = '#ccc';
    }
    if ('strokeWidth' in styles) {
        maskObject.strokeWidth = styles.strokeWidth;
    }
    else {
        maskObject.strokeWidth = 1;
    }
    if ('strokeDashArray' in styles) {
        maskObject.strokeDashArray = styles.strokeDashArray;
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
function finalizeMaskAttachment(context, config, resolvedConfig, maskObject) {
    const { canvas, options } = context;
    context.setLastMask(maskObject);
    placeMaskObject(canvas, maskObject);
    if (resolvedConfig.selectable !== false) {
        canvas.setActiveObject(maskObject);
    }
    canvas.renderAll();
    if (typeof config.onCreate === 'function') {
        try {
            config.onCreate(maskObject, canvas);
        }
        catch (error) {
            reportWarning(options, error, 'createMask onCreate callback threw.');
        }
    }
    return maskObject;
}
export function createMask(context, config = {}) {
    const { canvas, options } = context;
    if (!canvas)
        return null;
    const prepared = prepareMaskConfiguration(context, config);
    if (!prepared)
        return null;
    const { mergedConfig, resolvedConfig, shapeType } = prepared;
    const placement = resolveMaskPlacement(context, mergedConfig, resolvedConfig);
    if (!placement)
        return null;
    const dimensions = resolveMaskDimensions(context, mergedConfig, resolvedConfig, shapeType);
    if (!dimensions)
        return null;
    if (!validateResolvedMask(options, placement, dimensions, resolvedConfig, shapeType)) {
        return null;
    }
    const expansion = expandMaskCanvas(context, placement, resolvedConfig);
    if (!expansion)
        return null;
    const mask = buildFabricShape(context, config, resolvedConfig, shapeType, placement, dimensions, expansion);
    if (!mask)
        return null;
    const maskObject = applyCommonMaskProperties(context, mask, mergedConfig, resolvedConfig);
    return finalizeMaskAttachment(context, config, resolvedConfig, maskObject);
}
//# sourceMappingURL=mask-factory.js.map