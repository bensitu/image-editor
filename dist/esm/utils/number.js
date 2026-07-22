export function resolveNumeric(val, axis, fallback, canvas, options) {
    if (typeof val === 'number') {
        return Number.isFinite(val) ? val : fallback;
    }
    if (typeof val === 'function') {
        const resolved = val(canvas, options);
        return Number.isFinite(resolved) ? resolved : fallback;
    }
    if (typeof val === 'string' && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?%$/iu.test(val)) {
        const pct = Number(val.slice(0, -1));
        if (!Number.isFinite(pct)) {
            return fallback;
        }
        const dim = axis === 'x' ? canvas.getWidth() : canvas.getHeight();
        return Math.floor(dim * (pct / 100));
    }
    return fallback;
}
export function coercePoint(pt) {
    const coerceCoordinate = (value) => {
        if (value === null ||
            value === undefined ||
            typeof value === 'boolean' ||
            (typeof value === 'string' && value.trim().length === 0)) {
            return Number.NaN;
        }
        const coordinate = Number(value);
        return Number.isFinite(coordinate) ? coordinate : Number.NaN;
    };
    if (Array.isArray(pt)) {
        return { x: coerceCoordinate(pt[0]), y: coerceCoordinate(pt[1]) };
    }
    return { x: coerceCoordinate(pt.x), y: coerceCoordinate(pt.y) };
}
//# sourceMappingURL=number.js.map