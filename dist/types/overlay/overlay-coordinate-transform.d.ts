/**
 * Coordinate helpers for the overlay persistence wire format.
 *
 * Persisted overlay coordinates live in original image pixel space normalized
 * to [0, 1]. Runtime canvas coordinates are derived by applying the base image
 * transform around the original image center, then applying the current image
 * scale and canvas center.
 *
 * @module
 */
import type { OverlayBaseImageTransform, OverlayImageInfo } from './overlay-state-types.js';
export interface OverlayPoint {
    x: number;
    y: number;
}
export interface CurrentImageGeometry {
    naturalWidth: number;
    naturalHeight: number;
    canvasCenterX: number;
    canvasCenterY: number;
    scaleX: number;
    scaleY: number;
    transform?: OverlayBaseImageTransform;
}
export declare function normalizeRotationDegrees(rotation: number | undefined): number;
export declare function imageNormalizedToSourcePixel(point: OverlayPoint, imageInfo: OverlayImageInfo): OverlayPoint;
export declare function sourcePixelToImageNormalized(point: OverlayPoint, imageInfo: OverlayImageInfo): OverlayPoint;
export declare function applyBaseImageTransform(point: OverlayPoint, imageInfo: OverlayImageInfo, transform: OverlayBaseImageTransform | undefined): OverlayPoint;
export declare function unapplyBaseImageTransform(point: OverlayPoint, imageInfo: OverlayImageInfo, transform: OverlayBaseImageTransform | undefined): OverlayPoint;
export declare function sourcePixelToCanvas(point: OverlayPoint, geometry: CurrentImageGeometry): OverlayPoint;
export declare function canvasToSourcePixel(point: OverlayPoint, geometry: CurrentImageGeometry): OverlayPoint;
export declare function getTransformedRectBounds(rect: {
    x: number;
    y: number;
    width: number;
    height: number;
}, imageInfo: OverlayImageInfo, transform: OverlayBaseImageTransform | undefined): {
    x: number;
    y: number;
    width: number;
    height: number;
};
