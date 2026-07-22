/**
 * Provides overflow-safe validation for bounded raster dimensions.
 *
 * @module
 */

/** Returns true only when positive integer dimensions fit the supplied pixel budget. */
export function isPixelAreaWithinBudget(width: number, height: number, maxPixels: number): boolean {
    return (
        Number.isSafeInteger(width) &&
        Number.isSafeInteger(height) &&
        Number.isSafeInteger(maxPixels) &&
        width > 0 &&
        height > 0 &&
        maxPixels > 0 &&
        width <= Math.floor(maxPixels / height)
    );
}
