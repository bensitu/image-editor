/**
 * Maps captured Fabric scene points into natural Base Image pixel coordinates.
 *
 * @module
 */

import {
    applyAffineToPoint,
    invertAffine,
    isFiniteAffineMatrix,
    type AffineMatrix,
} from '../../core/index.js';
import type { BaseImageReadPort } from '../../sdk/index.js';
import type { InteractionPoint } from './interaction-types.js';

export class PointerCoordinateMapper {
    constructor(private readonly baseImage: BaseImageReadPort) {}

    getGeometryRevision(): number {
        return this.baseImage.getGeometryRevision();
    }

    toImagePoint(scenePoint: InteractionPoint): InteractionPoint | null {
        const image = this.baseImage.getBaseImage();
        const imageInfo = this.baseImage.getImageInfo();
        if (!image || !imageInfo) return null;
        const matrixValue = image.calcTransformMatrix() as number[];
        if (!isFiniteAffineMatrix(matrixValue)) return null;
        const local = applyAffineToPoint(invertAffine(matrixValue as AffineMatrix), scenePoint);
        const x = local.x + imageInfo.naturalWidth / 2;
        const y = local.y + imageInfo.naturalHeight / 2;
        if (
            !Number.isFinite(x) ||
            !Number.isFinite(y) ||
            x < 0 ||
            x >= imageInfo.naturalWidth ||
            y < 0 ||
            y >= imageInfo.naturalHeight
        ) {
            return null;
        }
        return Object.freeze({ x, y });
    }
}
