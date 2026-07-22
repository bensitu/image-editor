import { applyDeltaToObject } from './overlay-transform-delta.js';
function isFinitePoint(value) {
    if (typeof value !== 'object' || value === null)
        return false;
    const point = value;
    return Number.isFinite(point.x) && Number.isFinite(point.y);
}
export function isOverlayStateBoundsGeometry(value) {
    if (typeof value !== 'object' || value === null)
        return false;
    const geometry = value;
    return (geometry.type === 'bounds' &&
        Array.isArray(geometry.corners) &&
        geometry.corners.length === 4 &&
        geometry.corners.every(isFinitePoint));
}
export function captureOverlayStateBounds(object, context) {
    object.setCoords();
    const corners = object.getCoords();
    if (corners.length !== 4) {
        throw new TypeError('Overlay State bounds require four object corners.');
    }
    return Object.freeze({
        type: 'bounds',
        corners: Object.freeze(corners.map((point) => Object.freeze(context.toImageNormalized(point)))),
    });
}
function frameFromCorners(corners) {
    const [topLeft, topRight, , bottomLeft] = corners;
    return [
        topRight.x - topLeft.x,
        topRight.y - topLeft.y,
        bottomLeft.x - topLeft.x,
        bottomLeft.y - topLeft.y,
        topLeft.x,
        topLeft.y,
    ];
}
function cornersMatch(actual, expected, epsilon = 1e-6) {
    const coordinateScale = Math.max(1, ...actual.flatMap(({ x, y }) => [Math.abs(x), Math.abs(y)]), ...expected.flatMap(({ x, y }) => [Math.abs(x), Math.abs(y)]));
    const tolerance = Math.max(epsilon, coordinateScale * 1e-9);
    return actual.every((point, index) => Math.abs(point.x - expected[index].x) <= tolerance &&
        Math.abs(point.y - expected[index].y) <= tolerance);
}
class OverlayStateRestoreError extends TypeError {
    constructor(cause, rollbackError) {
        super('Overlay State bounds failed and the original transform could not be restored.');
        Object.defineProperty(this, "cause", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: cause
        });
        Object.defineProperty(this, "rollbackError", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: rollbackError
        });
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'OverlayStateRestoreError'
        });
    }
}
export function restoreOverlayStateBounds(object, geometry, context, fabric) {
    if (!isOverlayStateBoundsGeometry(geometry)) {
        throw new TypeError('Overlay State bounds are malformed.');
    }
    const targetCorners = geometry.corners.map((point) => context.toCanvasPoint(point));
    const fabricUtil = {
        multiplyTransformMatrices: (left, right) => fabric.util.multiplyTransformMatrices(left, right),
        invertTransform: (matrix) => fabric.util.invertTransform(matrix),
        qrDecompose: (matrix) => fabric.util.qrDecompose(matrix),
        Point: fabric.Point,
    };
    const originalTransform = {
        left: object.left,
        top: object.top,
        angle: object.angle,
        scaleX: object.scaleX,
        scaleY: object.scaleY,
        skewX: object.skewX,
        skewY: object.skewY,
        flipX: object.flipX,
        flipY: object.flipY,
    };
    try {
        for (let attempt = 0; attempt < 8; attempt += 1) {
            object.setCoords();
            const sourceCorners = object.getCoords();
            if (sourceCorners.length !== 4) {
                throw new TypeError('Overlay State bounds require four object corners.');
            }
            if (cornersMatch(sourceCorners, targetCorners))
                return;
            const delta = fabricUtil.multiplyTransformMatrices(frameFromCorners(targetCorners), fabricUtil.invertTransform(frameFromCorners(sourceCorners)));
            applyDeltaToObject(object, delta, { fabricUtil });
        }
        object.setCoords();
        if (!cornersMatch(object.getCoords(), targetCorners)) {
            throw new TypeError('Overlay State bounds could not be restored precisely.');
        }
    }
    catch (error) {
        try {
            object.set(originalTransform);
            object.setCoords();
        }
        catch (rollbackError) {
            throw new OverlayStateRestoreError(error, rollbackError);
        }
        throw error;
    }
}
export function objectPointToCanvas(object, point) {
    var _a, _b;
    const offset = object
        .pathOffset;
    const x = point.x - ((_a = offset === null || offset === void 0 ? void 0 : offset.x) !== null && _a !== void 0 ? _a : 0);
    const y = point.y - ((_b = offset === null || offset === void 0 ? void 0 : offset.y) !== null && _b !== void 0 ? _b : 0);
    const [a, b, c, d, e, f] = object.calcTransformMatrix();
    return Object.freeze({ x: a * x + c * y + e, y: b * x + d * y + f });
}
//# sourceMappingURL=overlay-state-geometry.js.map