import { applyDeltaToObject } from '../../fabric/fabric-transform-delta.js';
export function applyAnnotationGeometry(object, mutation, fabricModule, preserveReadable) {
    if (mutation.kind !== 'transform' || !mutation.affineDelta)
        return;
    applyDeltaToObject(object, [...mutation.affineDelta], {
        preserveReadableText: preserveReadable,
        fabricUtil: {
            multiplyTransformMatrices: (left, right) => fabricModule.util.multiplyTransformMatrices(left, right),
            invertTransform: (matrix) => fabricModule.util.invertTransform(matrix),
            qrDecompose: (matrix) => fabricModule.util.qrDecompose(matrix),
            Point: fabricModule.Point,
        },
    });
}
//# sourceMappingURL=annotation-geometry.js.map