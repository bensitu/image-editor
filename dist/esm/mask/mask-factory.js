import { isMaskObject } from '../core/public-types.js';
import { reportWarning } from '../core/callback-reporter.js';
import { attachMaskHoverHandlers, detachMaskHoverHandlers } from './mask-style.js';
import { coercePoint, resolveNumeric } from '../utils/number.js';
const POLYGON_AREA_EPSILON = 1e-6;
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
function mergeMaskConfig(defaultMaskConfig, config) {
    const safeDefaultConfig = { ...defaultMaskConfig };
    const defaultStyles = safeDefaultConfig.styles;
    delete safeDefaultConfig.onCreate;
    delete safeDefaultConfig.fabricGenerator;
    delete safeDefaultConfig.styles;
    const configStyles = isStyleObject(config.styles) ? config.styles : {};
    const safeDefaultStyles = isStyleObject(defaultStyles) ? defaultStyles : {};
    return {
        ...safeDefaultConfig,
        ...config,
        styles: {
            ...safeDefaultStyles,
            ...configStyles,
        },
    };
}
function warnInvalidMask(options, reason) {
    reportWarning(options, null, `createMask skipped: ${reason}.`);
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
function polygonArea(points) {
    let area = 0;
    for (let index = 0; index < points.length; index += 1) {
        const current = points[index];
        const next = points[(index + 1) % points.length];
        area += current.x * next.y - next.x * current.y;
    }
    return Math.abs(area) / 2;
}
export function createMask(context, config = {}) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r;
    const { canvas, options, fabric: fabricModule } = context;
    if (!canvas)
        return null;
    const mergedConfig = mergeMaskConfig(options.defaultMaskConfig, config);
    const shapeType = (_a = mergedConfig.shape) !== null && _a !== void 0 ? _a : 'rect';
    if (!validateNumericInputs(options, mergedConfig))
        return null;
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
    const firstOffset = 10;
    let left;
    let top;
    const previousMask = context.getLastMask();
    if (mergedConfig.left === undefined && previousMask) {
        const previousRight = ((_b = previousMask.left) !== null && _b !== void 0 ? _b : 0) +
            (typeof previousMask.getScaledWidth === 'function'
                ? previousMask.getScaledWidth()
                : ((_c = previousMask.width) !== null && _c !== void 0 ? _c : 0) * ((_d = previousMask.scaleX) !== null && _d !== void 0 ? _d : 1));
        left = Math.round(previousRight + ((_e = resolvedConfig.gap) !== null && _e !== void 0 ? _e : 5));
        top = (_f = previousMask.top) !== null && _f !== void 0 ? _f : firstOffset;
    }
    else {
        left = resolveNumeric(mergedConfig.left, 'x', firstOffset, canvas, options);
        top = resolveNumeric(mergedConfig.top, 'y', firstOffset, canvas, options);
    }
    resolvedConfig.width = resolveNumeric(mergedConfig.width, 'x', options.defaultMaskWidth, canvas, options);
    resolvedConfig.height = resolveNumeric(mergedConfig.height, 'y', options.defaultMaskHeight, canvas, options);
    const rx = mergedConfig.rx !== undefined
        ? resolveNumeric(mergedConfig.rx, 'x', 0, canvas, options)
        : undefined;
    const ry = mergedConfig.ry !== undefined
        ? resolveNumeric(mergedConfig.ry, 'y', 0, canvas, options)
        : undefined;
    const radius = shapeType === 'circle'
        ? resolveNumeric(mergedConfig.radius, 'x', Math.min(resolvedConfig.width, resolvedConfig.height) / 2, canvas, options)
        : undefined;
    const polygonPoints = shapeType === 'polygon' ? resolvePolygonPoints(options, mergedConfig.points) : null;
    if (!validateFiniteField(options, 'left', left) ||
        !validateFiniteField(options, 'top', top) ||
        !validatePositiveField(options, 'width', resolvedConfig.width) ||
        !validatePositiveField(options, 'height', resolvedConfig.height) ||
        !validateFiniteField(options, 'gap', resolvedConfig.gap) ||
        !validateFiniteField(options, 'angle', resolvedConfig.angle) ||
        !validateFiniteField(options, 'alpha', resolvedConfig.alpha)) {
        return null;
    }
    if ((rx !== undefined && !validateNonNegativeField(options, 'rx', rx)) ||
        (ry !== undefined && !validateNonNegativeField(options, 'ry', ry)) ||
        (radius !== undefined && !validatePositiveField(options, 'radius', radius)) ||
        (shapeType === 'polygon' && polygonPoints === null)) {
        return null;
    }
    if (options.layoutMode === 'expand') {
        const requiredWidth = Math.ceil(left + resolvedConfig.width + 10);
        const requiredHeight = Math.ceil(top + resolvedConfig.height + 10);
        const nextWidth = Math.max(canvas.getWidth(), requiredWidth);
        const nextHeight = Math.max(canvas.getHeight(), requiredHeight);
        if (nextWidth !== canvas.getWidth() || nextHeight !== canvas.getHeight()) {
            if (context.expandCanvasIfNeeded) {
                context.expandCanvasIfNeeded(nextWidth, nextHeight);
            }
            else {
                canvas.setDimensions({ width: nextWidth, height: nextHeight });
            }
        }
    }
    let mask;
    if (typeof config.fabricGenerator === 'function') {
        const generated = config.fabricGenerator(resolvedConfig, canvas, options);
        if (!isFabricObjectLike(generated)) {
            reportWarning(options, generated, 'createMask skipped: fabricGenerator did not return a Fabric object.');
            return null;
        }
        mask = generated;
    }
    else {
        const originProps = {
            originX: 'left',
            originY: 'top',
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
                    angle: (_g = resolvedConfig.angle) !== null && _g !== void 0 ? _g : 0,
                    ...resolvedConfig.styles,
                });
                break;
            case 'ellipse':
                mask = new fabricModule.Ellipse({
                    left,
                    top,
                    ...originProps,
                    rx: rx !== null && rx !== void 0 ? rx : resolvedConfig.width / 2,
                    ry: ry !== null && ry !== void 0 ? ry : resolvedConfig.height / 2,
                    fill: resolvedConfig.color,
                    opacity: resolvedConfig.alpha,
                    angle: (_h = resolvedConfig.angle) !== null && _h !== void 0 ? _h : 0,
                    ...resolvedConfig.styles,
                });
                break;
            case 'polygon': {
                const polygon = new fabricModule.Polygon(polygonPoints, {
                    ...originProps,
                    fill: resolvedConfig.color,
                    opacity: resolvedConfig.alpha,
                    angle: (_j = resolvedConfig.angle) !== null && _j !== void 0 ? _j : 0,
                    ...resolvedConfig.styles,
                });
                polygon.setCoords();
                const boundingRect = polygon.getBoundingRect();
                const deltaX = left - boundingRect.left;
                const deltaY = top - boundingRect.top;
                polygon.set({
                    left: ((_k = polygon.left) !== null && _k !== void 0 ? _k : 0) + deltaX,
                    top: ((_l = polygon.top) !== null && _l !== void 0 ? _l : 0) + deltaY,
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
                    angle: (_m = resolvedConfig.angle) !== null && _m !== void 0 ? _m : 0,
                    ...(rx !== undefined ? { rx } : {}),
                    ...(ry !== undefined ? { ry } : {}),
                    ...resolvedConfig.styles,
                });
        }
    }
    const maskObject = mask;
    maskObject.selectable = 'selectable' in mergedConfig ? !!mergedConfig.selectable : true;
    maskObject.evented = 'evented' in mergedConfig ? !!mergedConfig.evented : true;
    maskObject.hasControls = 'hasControls' in mergedConfig ? !!mergedConfig.hasControls : true;
    maskObject.transparentCorners =
        'transparentCorners' in mergedConfig ? !!mergedConfig.transparentCorners : false;
    maskObject.strokeUniform =
        'strokeUniform' in mergedConfig ? !!mergedConfig.strokeUniform : true;
    maskObject.lockRotation = !options.maskRotatable;
    maskObject.borderColor = (_o = mergedConfig.borderColor) !== null && _o !== void 0 ? _o : 'red';
    maskObject.cornerColor = (_p = mergedConfig.cornerColor) !== null && _p !== void 0 ? _p : 'black';
    maskObject.cornerSize = (_q = mergedConfig.cornerSize) !== null && _q !== void 0 ? _q : 8;
    const styles = ((_r = resolvedConfig.styles) !== null && _r !== void 0 ? _r : {});
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
    maskObject.originalAlpha = resolvedConfig.alpha;
    maskObject.originalStroke = maskObject.stroke;
    maskObject.originalStrokeWidth = maskObject.strokeWidth;
    attachMaskHoverHandlers(maskObject);
    const nextId = context.getMaskCounter() + 1;
    context.setMaskCounter(nextId);
    maskObject.maskId = nextId;
    maskObject.maskUid = createMaskUid(nextId);
    maskObject.maskName = `${options.maskName}${nextId}`;
    context.setLastMask(maskObject);
    canvas.add(maskObject);
    canvas.bringObjectToFront(maskObject);
    context.updateMaskList();
    if (resolvedConfig.selectable !== false) {
        canvas.setActiveObject(maskObject);
    }
    canvas.renderAll();
    context.saveCanvasState();
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
export function removeSelectedMask(context) {
    const active = context.canvas.getActiveObject();
    if (!active || !isMaskObject(active))
        return;
    context.removeLabelForMask(active);
    detachMaskHoverHandlers(active);
    context.canvas.remove(active);
    context.canvas.discardActiveObject();
    context.updateMaskList();
    context.canvas.renderAll();
    context.saveCanvasState();
}
export function removeAllMasks(context, options = {}) {
    const masks = context.canvas.getObjects().filter(isMaskObject);
    if (masks.length === 0)
        return;
    for (const maskObject of masks) {
        context.removeLabelForMask(maskObject);
        detachMaskHoverHandlers(maskObject);
        context.canvas.remove(maskObject);
    }
    context.canvas.discardActiveObject();
    context.setLastMask(null);
    context.updateMaskList();
    context.canvas.renderAll();
    if (options.saveHistory !== false) {
        context.saveCanvasState();
    }
}
//# sourceMappingURL=mask-factory.js.map