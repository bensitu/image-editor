export function resolveNumeric(val, axis, fallback, canvas, options) {
    if (typeof val === 'number') {
        return val;
    }
    if (typeof val === 'function') {
        return val(canvas, options);
    }
    if (typeof val === 'string' && val.endsWith('%')) {
        const pct = parseFloat(val);
        if (!Number.isFinite(pct)) {
            return fallback;
        }
        const dim = axis === 'x' ? canvas.getWidth() : canvas.getHeight();
        return Math.floor(dim * (pct / 100));
    }
    return fallback;
}
export function coercePoint(pt) {
    if (Array.isArray(pt)) {
        return { x: Number(pt[0]), y: Number(pt[1]) };
    }
    return { x: Number(pt.x), y: Number(pt.y) };
}
//# sourceMappingURL=number.js.map