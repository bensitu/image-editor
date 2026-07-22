'use strict';

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
//# sourceMappingURL=image-budget-e-EIVZb3.cjs.map
