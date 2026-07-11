/**
 * Pure pixelation helpers for Mosaic mode.
 *
 * The helpers mutate caller-supplied ImageData in place and do not touch DOM
 * or Fabric state, which keeps the algorithm deterministic and directly
 * testable.
 *
 * @module
 */
export interface MosaicPixelateOptions {
    imageData: ImageData;
    centerX: number;
    centerY: number;
    radius: number;
    blockSize: number;
}
export interface CircularMosaicBoundsOptions {
    width: number;
    height: number;
    centerX: number;
    centerY: number;
    radius: number;
}
export interface MosaicPixelBounds {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
}
/** Resolve the clipped inclusive pixel bounds for a circular Mosaic brush. */
export declare function getCircularMosaicBounds(options: CircularMosaicBoundsOptions): MosaicPixelBounds | null;
/**
 * Applies blocky pixelation inside a circular brush region.
 *
 * @returns `true` when at least one pixel was processed, otherwise `false`.
 */
export declare function applyCircularMosaicToImageData(options: MosaicPixelateOptions): boolean;
