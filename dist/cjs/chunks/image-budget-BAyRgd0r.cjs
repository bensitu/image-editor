// dist/esm/utils/base64-payload.js
const STANDARD_BASE64_BODY_PATTERN = /^[A-Za-z0-9+/]*$/u;
function base64PayloadByteLength(payload) {
	const firstPaddingIndex = payload.indexOf("=");
	const body = firstPaddingIndex === -1 ? payload : payload.slice(0, firstPaddingIndex);
	const padding = firstPaddingIndex === -1 ? "" : payload.slice(firstPaddingIndex);
	if (!STANDARD_BASE64_BODY_PATTERN.test(body) || padding !== "" && !/^={1,2}$/u.test(padding)) throw new TypeError("Base64 payload contains non-standard characters or padding.");
	const remainder = payload.length % 4;
	if (remainder === 1 || padding.length > 0 && remainder !== 0) throw new RangeError("Base64 payload length is malformed.");
	return Math.floor(payload.length * 3 / 4) - padding.length;
}

// dist/esm/utils/raster-output.js
function inspectRasterOutput(dataUrl, expectedMimeType) {
	const match = /^data:(image\/(?:png|jpeg|webp));base64,/u.exec(dataUrl);
	if (!match) throw new TypeError("Raster encoding did not produce a supported image Data URL.");
	const mimeType = match[1];
	if (expectedMimeType && mimeType !== expectedMimeType) throw new TypeError(`Raster encoder returned ${mimeType} instead of ${expectedMimeType}.`);
	const bytes = base64PayloadByteLength(dataUrl.slice(match[0].length));
	if (bytes === 0) throw new TypeError("Raster encoding produced an empty image.");
	return Object.freeze({
		mimeType,
		bytes
	});
}
function rasterBackground(format, background) {
	return format === "jpeg" && (!background || background.trim().toLowerCase() === "transparent") ? "#ffffff" : background;
}

// dist/esm/utils/image-budget.js
function resolveRasterAllocation(width, height, multiplier = 1) {
	if (!Number.isFinite(width) || !Number.isFinite(height) || !Number.isFinite(multiplier) || width <= 0 || height <= 0 || multiplier <= 0) return null;
	const allocationWidth = Math.ceil(width * multiplier);
	const allocationHeight = Math.ceil(height * multiplier);
	if (!Number.isSafeInteger(allocationWidth) || !Number.isSafeInteger(allocationHeight) || allocationWidth <= 0 || allocationHeight <= 0) return null;
	const pixels = allocationWidth * allocationHeight;
	if (!Number.isSafeInteger(pixels)) return null;
	return Object.freeze({
		width: allocationWidth,
		height: allocationHeight,
		pixels
	});
}
function isRasterAllocationWithinBudget(width, height, budget, multiplier = 1) {
	const allocation = resolveRasterAllocation(width, height, multiplier);
	return allocation !== null && Number.isSafeInteger(budget.maxDimension) && Number.isSafeInteger(budget.maxPixels) && budget.maxDimension > 0 && budget.maxPixels > 0 && allocation.width <= budget.maxDimension && allocation.height <= budget.maxDimension && allocation.width <= Math.floor(budget.maxPixels / allocation.height);
}
function isPixelAreaWithinBudget(width, height, maxPixels) {
	return Number.isSafeInteger(width) && Number.isSafeInteger(height) && Number.isSafeInteger(maxPixels) && width > 0 && height > 0 && maxPixels > 0 && width <= Math.floor(maxPixels / height);
}

Object.defineProperty(exports, "inspectRasterOutput", {
  enumerable: true,
  get: function () {
    return inspectRasterOutput;
  }
});
Object.defineProperty(exports, "isPixelAreaWithinBudget", {
  enumerable: true,
  get: function () {
    return isPixelAreaWithinBudget;
  }
});
Object.defineProperty(exports, "isRasterAllocationWithinBudget", {
  enumerable: true,
  get: function () {
    return isRasterAllocationWithinBudget;
  }
});
Object.defineProperty(exports, "rasterBackground", {
  enumerable: true,
  get: function () {
    return rasterBackground;
  }
});
//# sourceMappingURL=image-budget-BAyRgd0r.cjs.map