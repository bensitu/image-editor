export const MAX_DRAW_COORDINATE = 10000000;
export function normalizeDrawPoint(value) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw new TypeError('Draw point must be an object.');
    }
    const point = value;
    if (typeof point.x !== 'number' ||
        typeof point.y !== 'number' ||
        !Number.isFinite(point.x) ||
        !Number.isFinite(point.y) ||
        Math.abs(point.x) > MAX_DRAW_COORDINATE ||
        Math.abs(point.y) > MAX_DRAW_COORDINATE) {
        throw new TypeError('Draw point coordinates must be finite and bounded.');
    }
    return Object.freeze({ x: point.x, y: point.y });
}
export function appendInterpolatedPoints(target, point, spacing, maximumCount) {
    const previous = target[target.length - 1];
    if (!previous) {
        target.push(point);
        return;
    }
    const distance = Math.hypot(point.x - previous.x, point.y - previous.y);
    if (distance === 0)
        return;
    const steps = Math.max(1, Math.ceil(distance / spacing));
    if (target.length + steps > maximumCount) {
        throw new RangeError(`Draw stroke exceeds the ${maximumCount}-point limit.`);
    }
    for (let index = 1; index <= steps; index += 1) {
        const ratio = index / steps;
        target.push(Object.freeze({
            x: previous.x + (point.x - previous.x) * ratio,
            y: previous.y + (point.y - previous.y) * ratio,
        }));
    }
}
export function buildCurvedDrawPath(points) {
    const first = points[0];
    if (!first)
        return '';
    if (points.length === 1)
        return `M ${first.x} ${first.y} L ${first.x} ${first.y}`;
    if (points.length === 2) {
        const second = points[1];
        return `M ${first.x} ${first.y} L ${second.x} ${second.y}`;
    }
    const commands = [`M ${first.x} ${first.y}`];
    for (let index = 1; index < points.length - 1; index += 1) {
        const control = points[index];
        const next = points[index + 1];
        const midpoint = { x: (control.x + next.x) / 2, y: (control.y + next.y) / 2 };
        commands.push(`Q ${control.x} ${control.y} ${midpoint.x} ${midpoint.y}`);
    }
    const penultimate = points[points.length - 2];
    const last = points[points.length - 1];
    commands.push(`Q ${penultimate.x} ${penultimate.y} ${last.x} ${last.y}`);
    return commands.join(' ');
}
function transformPathPoint(object, point) {
    var _a;
    const offset = (_a = object.pathOffset) !== null && _a !== void 0 ? _a : { x: 0, y: 0 };
    const localX = point.x - (Number(offset.x) || 0);
    const localY = point.y - (Number(offset.y) || 0);
    const [a = 1, b = 0, c = 0, d = 1, e = 0, f = 0] = object.calcTransformMatrix();
    return {
        x: a * localX + c * localY + e,
        y: b * localX + d * localY + f,
    };
}
function distanceToSegment(point, start, end) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSquared = dx * dx + dy * dy;
    if (lengthSquared === 0)
        return Math.hypot(point.x - start.x, point.y - start.y);
    const ratio = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
    return Math.hypot(point.x - (start.x + ratio * dx), point.y - (start.y + ratio * dy));
}
export function drawPathIntersects(object, eraserPoints, eraserRadius) {
    var _a;
    const points = object.editorDrawPoints;
    if (!points || points.length < 2 || eraserPoints.length === 0)
        return false;
    const bounds = object.getBoundingRect();
    const scale = (_a = object.getObjectScaling) === null || _a === void 0 ? void 0 : _a.call(object);
    const strokeRadius = ((Number(object.strokeWidth) || 0) *
        Math.max(Math.abs(Number(scale === null || scale === void 0 ? void 0 : scale.x) || Number(object.scaleX) || 1), Math.abs(Number(scale === null || scale === void 0 ? void 0 : scale.y) || Number(object.scaleY) || 1))) /
        2;
    const hitRadius = eraserRadius + strokeRadius;
    if (!eraserPoints.some((point) => point.x >= bounds.left - hitRadius &&
        point.x <= bounds.left + bounds.width + hitRadius &&
        point.y >= bounds.top - hitRadius &&
        point.y <= bounds.top + bounds.height + hitRadius)) {
        return false;
    }
    const transformed = points.map((point) => transformPathPoint(object, point));
    for (const eraserPoint of eraserPoints) {
        for (let index = 1; index < transformed.length; index += 1) {
            if (distanceToSegment(eraserPoint, transformed[index - 1], transformed[index]) <=
                hitRadius) {
                return true;
            }
        }
    }
    return false;
}
//# sourceMappingURL=draw-path.js.map