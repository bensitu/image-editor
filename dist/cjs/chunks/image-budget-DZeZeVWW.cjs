'use strict';

function resolveRasterAllocation(width, height, multiplier = 1) {
    if (!Number.isFinite(width) ||
        !Number.isFinite(height) ||
        !Number.isFinite(multiplier) ||
        width <= 0 ||
        height <= 0 ||
        multiplier <= 0) {
        return null;
    }
    const allocationWidth = Math.ceil(width * multiplier);
    const allocationHeight = Math.ceil(height * multiplier);
    if (!Number.isSafeInteger(allocationWidth) ||
        !Number.isSafeInteger(allocationHeight) ||
        allocationWidth <= 0 ||
        allocationHeight <= 0) {
        return null;
    }
    const pixels = allocationWidth * allocationHeight;
    if (!Number.isSafeInteger(pixels))
        return null;
    return Object.freeze({ width: allocationWidth, height: allocationHeight, pixels });
}
function isRasterAllocationWithinBudget(width, height, budget, multiplier = 1) {
    const allocation = resolveRasterAllocation(width, height, multiplier);
    return (allocation !== null &&
        Number.isSafeInteger(budget.maxDimension) &&
        Number.isSafeInteger(budget.maxPixels) &&
        budget.maxDimension > 0 &&
        budget.maxPixels > 0 &&
        allocation.width <= budget.maxDimension &&
        allocation.height <= budget.maxDimension &&
        allocation.width <= Math.floor(budget.maxPixels / allocation.height));
}
function isPixelAreaWithinBudget(width, height, maxPixels) {
    return (Number.isSafeInteger(width) &&
        Number.isSafeInteger(height) &&
        Number.isSafeInteger(maxPixels) &&
        width > 0 &&
        height > 0 &&
        maxPixels > 0 &&
        width <= Math.floor(maxPixels / height));
}

exports.isPixelAreaWithinBudget = isPixelAreaWithinBudget;
exports.isRasterAllocationWithinBudget = isRasterAllocationWithinBudget;
//# sourceMappingURL=image-budget-DZeZeVWW.cjs.map
