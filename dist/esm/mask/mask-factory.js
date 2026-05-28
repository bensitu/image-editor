import { isMaskObject } from '../core/public-types.js';
import { reportWarning } from '../core/callback-reporter.js';
import { attachMaskHoverHandlers } from './mask-style.js';
import { coercePoint, resolveNumeric } from '../utils/number.js';
function isFabricObjectLike(value) {
    if (!value || typeof value !== 'object')
        return false;
    const candidate = value;
    return typeof candidate.set === 'function' && typeof candidate.on === 'function';
}
export function createMask(ctx, config = {}) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t;
    const { canvas, options, fabric: fabricModule } = ctx;
    if (!canvas)
        return null;
    const shapeType = (_a = config.shape) !== null && _a !== void 0 ? _a : 'rect';
    const resolvedConfig = {
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
    };
    const firstOffset = 10;
    let left;
    let top;
    const previousMask = ctx.getLastMask();
    if (config.left === undefined && previousMask) {
        const previousRight = ((_b = previousMask.left) !== null && _b !== void 0 ? _b : 0) +
            (typeof previousMask.getScaledWidth === 'function'
                ? previousMask.getScaledWidth()
                : ((_c = previousMask.width) !== null && _c !== void 0 ? _c : 0) * ((_d = previousMask.scaleX) !== null && _d !== void 0 ? _d : 1));
        left = Math.round(previousRight + ((_e = resolvedConfig.gap) !== null && _e !== void 0 ? _e : 5));
        top = (_f = previousMask.top) !== null && _f !== void 0 ? _f : firstOffset;
    }
    else {
        left = resolveNumeric(config.left, 'x', firstOffset, canvas, options);
        top = resolveNumeric(config.top, 'y', firstOffset, canvas, options);
    }
    resolvedConfig.width = resolveNumeric(config.width, 'x', options.defaultMaskWidth, canvas, options);
    resolvedConfig.height = resolveNumeric(config.height, 'y', options.defaultMaskHeight, canvas, options);
    if (options.expandCanvasToImage) {
        const requiredWidth = Math.ceil(left + resolvedConfig.width + 10);
        const requiredHeight = Math.ceil(top + resolvedConfig.height + 10);
        const nextWidth = Math.max(canvas.getWidth(), requiredWidth);
        const nextHeight = Math.max(canvas.getHeight(), requiredHeight);
        if (nextWidth !== canvas.getWidth() || nextHeight !== canvas.getHeight()) {
            if (ctx.expandCanvasIfNeeded) {
                ctx.expandCanvasIfNeeded(nextWidth, nextHeight);
            }
            else {
                canvas.setDimensions({ width: nextWidth, height: nextHeight });
            }
        }
    }
    let mask;
    if (typeof resolvedConfig.fabricGenerator === 'function') {
        const generated = resolvedConfig.fabricGenerator(resolvedConfig, canvas, options);
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
        const rx = config.rx !== undefined
            ? resolveNumeric(config.rx, 'x', 0, canvas, options)
            : undefined;
        const ry = config.ry !== undefined
            ? resolveNumeric(config.ry, 'y', 0, canvas, options)
            : undefined;
        switch (shapeType) {
            case 'circle':
                mask = new fabricModule.Circle({
                    left,
                    top,
                    ...originProps,
                    radius: resolveNumeric(config.radius, 'x', Math.min(resolvedConfig.width, resolvedConfig.height) / 2, canvas, options),
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
                const points = ((_j = config.points) !== null && _j !== void 0 ? _j : []).map(coercePoint);
                const polygon = new fabricModule.Polygon(points, {
                    ...originProps,
                    fill: resolvedConfig.color,
                    opacity: resolvedConfig.alpha,
                    angle: (_k = resolvedConfig.angle) !== null && _k !== void 0 ? _k : 0,
                    ...resolvedConfig.styles,
                });
                polygon.setCoords();
                const boundingRect = polygon.getBoundingRect();
                const deltaX = left - boundingRect.left;
                const deltaY = top - boundingRect.top;
                polygon.set({
                    left: ((_l = polygon.left) !== null && _l !== void 0 ? _l : 0) + deltaX,
                    top: ((_m = polygon.top) !== null && _m !== void 0 ? _m : 0) + deltaY,
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
                    angle: (_o = resolvedConfig.angle) !== null && _o !== void 0 ? _o : 0,
                    ...(rx !== undefined ? { rx } : {}),
                    ...(ry !== undefined ? { ry } : {}),
                    ...resolvedConfig.styles,
                });
        }
    }
    const maskObject = mask;
    maskObject.selectable = 'selectable' in config ? !!config.selectable : true;
    maskObject.hasControls = 'hasControls' in config ? !!config.hasControls : true;
    maskObject.transparentCorners =
        'transparentCorners' in config ? !!config.transparentCorners : false;
    maskObject.strokeUniform = 'strokeUniform' in config ? !!config.strokeUniform : true;
    maskObject.lockRotation = !options.maskRotatable;
    maskObject.borderColor = (_p = config.borderColor) !== null && _p !== void 0 ? _p : 'red';
    maskObject.cornerColor = (_q = config.cornerColor) !== null && _q !== void 0 ? _q : 'black';
    maskObject.cornerSize = (_r = config.cornerSize) !== null && _r !== void 0 ? _r : 8;
    const styles = ((_s = resolvedConfig.styles) !== null && _s !== void 0 ? _s : {});
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
    const nextId = ctx.getMaskCounter() + 1;
    ctx.setMaskCounter(nextId);
    maskObject.maskId = nextId;
    maskObject.maskName = `${options.maskName}${nextId}`;
    ctx.setLastMask(maskObject);
    canvas.add(maskObject);
    canvas.bringObjectToFront(maskObject);
    ctx.updateMaskList();
    if (resolvedConfig.selectable !== false) {
        canvas.setActiveObject(maskObject);
    }
    canvas.renderAll();
    ctx.saveCanvasState();
    (_t = resolvedConfig.onCreate) === null || _t === void 0 ? void 0 : _t.call(resolvedConfig, maskObject, canvas);
    return maskObject;
}
export function removeSelectedMask(ctx) {
    const active = ctx.canvas.getActiveObject();
    if (!active || !isMaskObject(active))
        return;
    ctx.removeLabelForMask(active);
    ctx.canvas.remove(active);
    ctx.canvas.discardActiveObject();
    ctx.updateMaskList();
    ctx.canvas.renderAll();
    ctx.saveCanvasState();
}
export function removeAllMasks(ctx, options = {}) {
    const masks = ctx.canvas.getObjects().filter(isMaskObject);
    if (masks.length === 0)
        return;
    for (const maskObject of masks) {
        ctx.removeLabelForMask(maskObject);
        ctx.canvas.remove(maskObject);
    }
    ctx.canvas.discardActiveObject();
    ctx.setLastMask(null);
    ctx.updateMaskList();
    ctx.canvas.renderAll();
    if (options.saveHistory !== false) {
        ctx.saveCanvasState();
    }
}
//# sourceMappingURL=mask-factory.js.map