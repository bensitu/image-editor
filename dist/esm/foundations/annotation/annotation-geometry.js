function isFiniteMatrix(matrix) {
    return matrix.length === 6 && matrix.every((value) => Number.isFinite(value));
}
function hasReflection(matrix) {
    return isFiniteMatrix(matrix) && matrix[0] * matrix[3] - matrix[1] * matrix[2] < 0;
}
function stripReflection(matrix, fabric) {
    if (!hasReflection(matrix))
        return matrix;
    const flipX = fabric.multiplyTransformMatrices(matrix, [-1, 0, 0, 1, 0, 0]);
    const flipY = fabric.multiplyTransformMatrices(matrix, [1, 0, 0, -1, 0, 0]);
    const angleMagnitude = (candidate) => {
        const angle = fabric.qrDecompose(candidate).angle;
        return Number.isFinite(angle)
            ? Math.abs((((angle % 360) + 540) % 360) - 180)
            : Number.POSITIVE_INFINITY;
    };
    return angleMagnitude(flipY) < angleMagnitude(flipX) ? flipY : flipX;
}
export function applyAnnotationGeometry(object, mutation, fabricModule, preserveReadable) {
    var _a, _b, _c;
    if (mutation.kind !== 'transform')
        return;
    const delta = mutation.affineDelta;
    if (!delta || !isFiniteMatrix(delta))
        return;
    const fabric = {
        multiplyTransformMatrices: (left, right) => fabricModule.util.multiplyTransformMatrices(left, right),
        qrDecompose: (matrix) => fabricModule.util.qrDecompose(matrix),
        Point: fabricModule.Point,
    };
    object.setCoords();
    const previousOriginX = (_a = object.originX) !== null && _a !== void 0 ? _a : 'left';
    const previousOriginY = (_b = object.originY) !== null && _b !== void 0 ? _b : 'top';
    const originalCenter = object.getCenterPoint();
    const [a = 1, b = 0, c = 0, d = 1, e = 0, f = 0] = delta;
    const targetCenter = new fabric.Point(a * originalCenter.x + c * originalCenter.y + e, b * originalCenter.x + d * originalCenter.y + f);
    const orientationDelta = preserveReadable ? stripReflection(delta, fabric) : delta;
    let restoreCenter = originalCenter;
    try {
        object.set({ originX: 'center', originY: 'center' });
        object.setPositionByOrigin(originalCenter, 'center', 'center');
        object.setCoords();
        const nextMatrix = fabric.multiplyTransformMatrices(orientationDelta, object.calcTransformMatrix());
        if (!isFiniteMatrix(nextMatrix))
            return;
        const decomposed = fabric.qrDecompose(nextMatrix);
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
//# sourceMappingURL=annotation-geometry.js.map