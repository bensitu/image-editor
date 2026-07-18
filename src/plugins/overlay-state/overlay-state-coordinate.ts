import {
    affineDeterminant,
    applyAffineToPoint,
    invertAffine,
    isFiniteAffineMatrix,
    type AffineMatrix,
} from '../../core/index.js';
import type {
    OverlayStateCodecContext,
    OverlayStateImageContext,
    OverlayStatePoint,
} from '../../foundations/overlay/index.js';
import type { BaseImageReadPort } from '../../sdk/index.js';
import { OverlayStateImageMissingError } from './overlay-state-errors.js';

export interface ResolvedOverlayStateContext {
    readonly codec: OverlayStateCodecContext;
    readonly image: OverlayStateImageContext;
}

export function createOverlayStateContext(
    baseImagePort: BaseImageReadPort,
): ResolvedOverlayStateContext {
    const baseImage = baseImagePort.getBaseImage();
    const imageInfo = baseImagePort.getImageInfo();
    if (
        !baseImage ||
        !imageInfo ||
        !Number.isSafeInteger(imageInfo.naturalWidth) ||
        imageInfo.naturalWidth <= 0 ||
        !Number.isSafeInteger(imageInfo.naturalHeight) ||
        imageInfo.naturalHeight <= 0
    ) {
        throw new OverlayStateImageMissingError();
    }
    const matrixValue = baseImage.calcTransformMatrix() as number[];
    if (!isFiniteAffineMatrix(matrixValue)) {
        throw new TypeError('[ImageEditor] Base Image transform is invalid.');
    }
    const matrix = matrixValue as AffineMatrix;
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
    const codec: OverlayStateCodecContext = Object.freeze({
        image,
        toImageNormalized(point: OverlayStatePoint): OverlayStatePoint {
            const local = applyAffineToPoint(inverse, point);
            return Object.freeze({
                x: (local.x + naturalWidth / 2) / naturalWidth,
                y: (local.y + naturalHeight / 2) / naturalHeight,
            });
        },
        toCanvasPoint(point: OverlayStatePoint): OverlayStatePoint {
            return applyAffineToPoint(matrix, {
                x: point.x * naturalWidth - naturalWidth / 2,
                y: point.y * naturalHeight - naturalHeight / 2,
            });
        },
        toImageNormalizedScalar(value: number): number {
            if (!Number.isFinite(value)) {
                throw new TypeError('[ImageEditor] Overlay State scalar must be finite.');
            }
            return value / scalarReference;
        },
        toCanvasScalar(value: number): number {
            if (!Number.isFinite(value)) {
                throw new TypeError('[ImageEditor] Overlay State scalar must be finite.');
            }
            return value * scalarReference;
        },
    });
    return Object.freeze({ codec, image });
}
