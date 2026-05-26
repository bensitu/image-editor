import { isMaskObject } from '../core/public-types.js';
import { coercePoint, resolveNumeric } from '../utils/number.js';
export function createMask(ctx, config = {}) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t;
    const { canvas, options, fabric: fb } = ctx;
    if (!canvas)
        return null;
    const shapeType = (_a = config.shape) !== null && _a !== void 0 ? _a : 'rect';
    const cfg = {
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
    const prev = ctx.getLastMask();
    if (config.left === undefined && prev) {
        const prevRight = ((_b = prev.left) !== null && _b !== void 0 ? _b : 0) +
            (typeof prev.getScaledWidth === 'function'
                ? prev.getScaledWidth()
                : ((_c = prev.width) !== null && _c !== void 0 ? _c : 0) * ((_d = prev.scaleX) !== null && _d !== void 0 ? _d : 1));
        left = Math.round(prevRight + ((_e = cfg.gap) !== null && _e !== void 0 ? _e : 5));
        top = (_f = prev.top) !== null && _f !== void 0 ? _f : firstOffset;
    }
    else {
        left = resolveNumeric(config.left, 'x', firstOffset, canvas, options);
        top = resolveNumeric(config.top, 'y', firstOffset, canvas, options);
    }
    cfg.width = resolveNumeric(config.width, 'x', options.defaultMaskWidth, canvas, options);
    cfg.height = resolveNumeric(config.height, 'y', options.defaultMaskHeight, canvas, options);
    if (options.expandCanvasToImage) {
        const reqW = Math.ceil(left + cfg.width + 10);
        const reqH = Math.ceil(top + cfg.height + 10);
        const newW = Math.max(canvas.getWidth(), reqW);
        const newH = Math.max(canvas.getHeight(), reqH);
        if (newW !== canvas.getWidth() || newH !== canvas.getHeight()) {
            if (ctx.expandCanvasIfNeeded) {
                ctx.expandCanvasIfNeeded(newW, newH);
            }
            else {
                canvas.setDimensions({ width: newW, height: newH });
            }
        }
    }
    let mask;
    if (typeof cfg.fabricGenerator === 'function') {
        mask = cfg.fabricGenerator(cfg, canvas, options);
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
                mask = new fb.Circle({
                    left,
                    top,
                    ...originProps,
                    radius: resolveNumeric(config.radius, 'x', Math.min(cfg.width, cfg.height) / 2, canvas, options),
                    fill: cfg.color,
                    opacity: cfg.alpha,
                    angle: (_g = cfg.angle) !== null && _g !== void 0 ? _g : 0,
                    ...cfg.styles,
                });
                break;
            case 'ellipse':
                mask = new fb.Ellipse({
                    left,
                    top,
                    ...originProps,
                    rx: rx !== null && rx !== void 0 ? rx : cfg.width / 2,
                    ry: ry !== null && ry !== void 0 ? ry : cfg.height / 2,
                    fill: cfg.color,
                    opacity: cfg.alpha,
                    angle: (_h = cfg.angle) !== null && _h !== void 0 ? _h : 0,
                    ...cfg.styles,
                });
                break;
            case 'polygon': {
                const pts = ((_j = config.points) !== null && _j !== void 0 ? _j : []).map(coercePoint);
                const polygon = new fb.Polygon(pts, {
                    ...originProps,
                    fill: cfg.color,
                    opacity: cfg.alpha,
                    angle: (_k = cfg.angle) !== null && _k !== void 0 ? _k : 0,
                    ...cfg.styles,
                });
                polygon.setCoords();
                const br = polygon.getBoundingRect();
                const dx = left - br.left;
                const dy = top - br.top;
                polygon.set({
                    left: ((_l = polygon.left) !== null && _l !== void 0 ? _l : 0) + dx,
                    top: ((_m = polygon.top) !== null && _m !== void 0 ? _m : 0) + dy,
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
                    angle: (_o = cfg.angle) !== null && _o !== void 0 ? _o : 0,
                    ...(rx !== undefined ? { rx } : {}),
                    ...(ry !== undefined ? { ry } : {}),
                    ...cfg.styles,
                });
        }
    }
    const m = mask;
    m.selectable = 'selectable' in config ? !!config.selectable : true;
    m.hasControls = 'hasControls' in config ? !!config.hasControls : true;
    m.transparentCorners =
        'transparentCorners' in config ? !!config.transparentCorners : false;
    m.strokeUniform = 'strokeUniform' in config ? !!config.strokeUniform : true;
    m.lockRotation = !options.maskRotatable;
    m.borderColor = (_p = config.borderColor) !== null && _p !== void 0 ? _p : 'red';
    m.cornerColor = (_q = config.cornerColor) !== null && _q !== void 0 ? _q : 'black';
    m.cornerSize = (_r = config.cornerSize) !== null && _r !== void 0 ? _r : 8;
    const styles = ((_s = cfg.styles) !== null && _s !== void 0 ? _s : {});
    if ('stroke' in styles) {
        m.stroke = styles.stroke;
    }
    else {
        m.stroke = '#ccc';
    }
    if ('strokeWidth' in styles) {
        m.strokeWidth = styles.strokeWidth;
    }
    else {
        m.strokeWidth = 1;
    }
    if ('strokeDashArray' in styles) {
        m.strokeDashArray = styles.strokeDashArray;
    }
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
    m.on('mouseover', () => {
        var _a;
        m.set(hoverStyle);
        (_a = m.canvas) === null || _a === void 0 ? void 0 : _a.requestRenderAll();
    });
    m.on('mouseout', () => {
        var _a;
        m.set(normalStyle);
        (_a = m.canvas) === null || _a === void 0 ? void 0 : _a.requestRenderAll();
    });
    const nextId = ctx.getMaskCounter() + 1;
    ctx.setMaskCounter(nextId);
    m.maskId = nextId;
    m.maskName = `${options.maskName}${nextId}`;
    ctx.setLastMask(m);
    canvas.add(m);
    canvas.bringObjectToFront(m);
    ctx.updateMaskList();
    if (cfg.selectable !== false) {
        canvas.setActiveObject(m);
    }
    canvas.renderAll();
    ctx.saveCanvasState();
    (_t = cfg.onCreate) === null || _t === void 0 ? void 0 : _t.call(cfg, m, canvas);
    return m;
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
    for (const m of masks) {
        ctx.removeLabelForMask(m);
        ctx.canvas.remove(m);
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