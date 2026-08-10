import { applyAffineToPoint, invertAffine, isFiniteAffineMatrix, } from '../../core/index.js';
export class PointerCoordinateMapper {
    constructor(baseImage) {
        Object.defineProperty(this, "baseImage", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: baseImage
        });
    }
    getGeometryRevision() {
        return this.baseImage.getGeometryRevision();
    }
    toImagePoint(scenePoint) {
        const image = this.baseImage.getBaseImage();
        const imageInfo = this.baseImage.getImageInfo();
        if (!image || !imageInfo)
            return null;
        const matrixValue = image.calcTransformMatrix();
        if (!isFiniteAffineMatrix(matrixValue))
            return null;
        const local = applyAffineToPoint(invertAffine(matrixValue), scenePoint);
        const x = local.x + imageInfo.naturalWidth / 2;
        const y = local.y + imageInfo.naturalHeight / 2;
        if (!Number.isFinite(x) ||
            !Number.isFinite(y) ||
            x < 0 ||
            x >= imageInfo.naturalWidth ||
            y < 0 ||
            y >= imageInfo.naturalHeight) {
            return null;
        }
        return Object.freeze({ x, y });
    }
}
//# sourceMappingURL=pointer-coordinate-mapper.js.map