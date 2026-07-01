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
/**
 * Applies blocky pixelation inside a circular brush region.
 *
 * @returns `true` when at least one pixel was processed, otherwise `false`.
 */
export declare function applyCircularMosaicToImageData(options: MosaicPixelateOptions): boolean;
