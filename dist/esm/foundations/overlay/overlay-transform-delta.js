export function isFiniteTransformMatrix(matrix) {
    return matrix.length === 6 && matrix.every((value) => Number.isFinite(value));
}
export function isApproximatelyIdentityTransform(matrix, epsilon = 1e-10) {
    const identity = [1, 0, 0, 1, 0, 0];
    return (matrix.length === identity.length &&
        matrix.every((value, index) => Math.abs(value - identity[index]) <= epsilon));
}
export function computeImageTransformDelta(beforeMatrix, afterMatrix, fabricUtil) {
    if (!isFiniteTransformMatrix(beforeMatrix) || !isFiniteTransformMatrix(afterMatrix))
        return [];
    return fabricUtil.multiplyTransformMatrices(afterMatrix, fabricUtil.invertTransform(beforeMatrix));
}
export function deltaHasReflection(delta) {
    if (!isFiniteTransformMatrix(delta))
        return false;
    const [a, b, c, d] = delta;
    return a * d - b * c < 0;
}
export function transformPointByMatrix(point, matrix, fabricUtil) {
    const [a, b, c, d, e, f] = matrix;
    return new fabricUtil.Point(a * point.x + c * point.y + e, b * point.x + d * point.y + f);
}
export function stripReflectionFromDelta(delta, fabricUtil) {
    if (!deltaHasReflection(delta))
        return delta;
    const flipXCandidate = fabricUtil.multiplyTransformMatrices(delta, [-1, 0, 0, 1, 0, 0]);
    const flipYCandidate = fabricUtil.multiplyTransformMatrices(delta, [1, 0, 0, -1, 0, 0]);
    const normalizedAngleMagnitude = (matrix) => {
        try {
            const angle = fabricUtil.qrDecompose(matrix).angle;
            return Number.isFinite(angle)
                ? Math.abs((((angle % 360) + 540) % 360) - 180)
                : Number.POSITIVE_INFINITY;
        }
        catch {
            return Number.POSITIVE_INFINITY;
        }
    };
    return normalizedAngleMagnitude(flipYCandidate) < normalizedAngleMagnitude(flipXCandidate)
        ? flipYCandidate
        : flipXCandidate;
}
export function applyDeltaToObject(object, fullDelta, context) {
    var _a, _b, _c;
    if (!isFiniteTransformMatrix(fullDelta) || isApproximatelyIdentityTransform(fullDelta))
        return;
    const { fabricUtil } = context;
    object.setCoords();
    const previousOriginX = (_a = object.originX) !== null && _a !== void 0 ? _a : 'left';
    const previousOriginY = (_b = object.originY) !== null && _b !== void 0 ? _b : 'top';
    const originalCenter = object.getCenterPoint();
    const targetCenter = transformPointByMatrix(originalCenter, fullDelta, fabricUtil);
    const orientationDelta = context.preserveReadableText
        ? stripReflectionFromDelta(fullDelta, fabricUtil)
        : fullDelta;
    let restoreCenter = originalCenter;
    try {
        object.set({ originX: 'center', originY: 'center' });
        object.setPositionByOrigin(originalCenter, 'center', 'center');
        object.setCoords();
        const nextMatrix = fabricUtil.multiplyTransformMatrices(orientationDelta, object.calcTransformMatrix());
        if (!isFiniteTransformMatrix(nextMatrix))
            return;
        const decomposed = fabricUtil.qrDecompose(nextMatrix);
        object.set({ flipX: false, flipY: false });
        object.set({
            angle: decomposed.angle,
            scaleX: decomposed.scaleX,
            scaleY: decomposed.scaleY,
            skewX: decomposed.skewX,
            skewY: (_c = decomposed.skewY) !== null && _c !== void 0 ? _c : 0,
        });
        if (typeof decomposed.flipX === 'boolean' || typeof decomposed.flipY === 'boolean') {
            object.set({
                ...(typeof decomposed.flipX === 'boolean' ? { flipX: decomposed.flipX } : {}),
                ...(typeof decomposed.flipY === 'boolean' ? { flipY: decomposed.flipY } : {}),
            });
        }
        restoreCenter = targetCenter;
    }
    finally {
        object.set({ originX: previousOriginX, originY: previousOriginY });
        object.setPositionByOrigin(restoreCenter, 'center', 'center');
        object.setCoords();
    }
}
//# sourceMappingURL=overlay-transform-delta.js.map