/**
 * Provides overflow-safe validation for bounded raster dimensions.
 *
 * @module
 */

export interface RasterDimensionBudget {
    readonly maxDimension: number;
    readonly maxPixels: number;
}

export interface RasterAllocation {
    readonly width: number;
    readonly height: number;
    readonly pixels: number;
}

/**
 * Resolves the integer Canvas allocation required for a source region and multiplier.
 *
 * Invalid, non-positive, or unsafe values return `null` without multiplying unsafe integers.
 */
export function resolveRasterAllocation(
    width: number,
    height: number,
    multiplier = 1,
): RasterAllocation | null {
    if (
        !Number.isFinite(width) ||
        !Number.isFinite(height) ||
        !Number.isFinite(multiplier) ||
        width <= 0 ||
        height <= 0 ||
        multiplier <= 0
    ) {
        return null;
    }
    const allocationWidth = Math.ceil(width * multiplier);
    const allocationHeight = Math.ceil(height * multiplier);
    if (
        !Number.isSafeInteger(allocationWidth) ||
        !Number.isSafeInteger(allocationHeight) ||
        allocationWidth <= 0 ||
        allocationHeight <= 0
    ) {
        return null;
    }
    const pixels = allocationWidth * allocationHeight;
    if (!Number.isSafeInteger(pixels)) return null;
    return Object.freeze({ width: allocationWidth, height: allocationHeight, pixels });
}

/** Returns true only when the requested raster allocation fits both policy limits. */
export function isRasterAllocationWithinBudget(
    width: number,
    height: number,
    budget: RasterDimensionBudget,
    multiplier = 1,
): boolean {
    const allocation = resolveRasterAllocation(width, height, multiplier);
    return (
        allocation !== null &&
        Number.isSafeInteger(budget.maxDimension) &&
        Number.isSafeInteger(budget.maxPixels) &&
        budget.maxDimension > 0 &&
        budget.maxPixels > 0 &&
        allocation.width <= budget.maxDimension &&
        allocation.height <= budget.maxDimension &&
        allocation.width <= Math.floor(budget.maxPixels / allocation.height)
    );
}

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
