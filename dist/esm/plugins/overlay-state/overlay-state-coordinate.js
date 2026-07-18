import { affineDeterminant, applyAffineToPoint, invertAffine, isFiniteAffineMatrix, } from '../../core/index.js';
import { OverlayStateImageMissingError } from './overlay-state-errors.js';
export function createOverlayStateContext(baseImagePort) {
    const baseImage = baseImagePort.getBaseImage();
    const imageInfo = baseImagePort.getImageInfo();
    if (!baseImage ||
        !imageInfo ||
        !Number.isSafeInteger(imageInfo.naturalWidth) ||
        imageInfo.naturalWidth <= 0 ||
        !Number.isSafeInteger(imageInfo.naturalHeight) ||
        imageInfo.naturalHeight <= 0) {
        throw new OverlayStateImageMissingError();
    }
    const matrixValue = baseImage.calcTransformMatrix();
    if (!isFiniteAffineMatrix(matrixValue)) {
        throw new TypeError('[ImageEditor] Base Image transform is invalid.');
    }
    const matrix = matrixValue;
    const inverse = invertAffine(matrix);
    const naturalWidth = imageInfo.naturalWidth;
    const naturalHeight = imageInfo.naturalHeight;
    const image = Object.freeze({
        naturalWidth,
        naturalHeight,
        mimeType: imageInfo.mimeType,
    });
    const canvasScale = Math.sqrt(Math.abs(affineDeterminant(matrix)));
    const scalarReference = Math.min(naturalWidth, naturalHeight) * canvasScale;
    if (!Number.isFinite(scalarReference) || scalarReference <= 0) {
        throw new TypeError('[ImageEditor] Base Image transform is singular.');
    }
    const codec = Object.freeze({
        image,
        toImageNormalized(point) {
            const local = applyAffineToPoint(inverse, point);
            return Object.freeze({
                x: (local.x + naturalWidth / 2) / naturalWidth,
                y: (local.y + naturalHeight / 2) / naturalHeight,
            });
        },
        toCanvasPoint(point) {
            return applyAffineToPoint(matrix, {
                x: point.x * naturalWidth - naturalWidth / 2,
                y: point.y * naturalHeight - naturalHeight / 2,
            });
        },
        toImageNormalizedScalar(value) {
            if (!Number.isFinite(value)) {
                throw new TypeError('[ImageEditor] Overlay State scalar must be finite.');
            }
            return value / scalarReference;
        },
        toCanvasScalar(value) {
            if (!Number.isFinite(value)) {
                throw new TypeError('[ImageEditor] Overlay State scalar must be finite.');
            }
            return value * scalarReference;
        },
    });
    return Object.freeze({ codec, image });
}
//# sourceMappingURL=overlay-state-coordinate.js.map