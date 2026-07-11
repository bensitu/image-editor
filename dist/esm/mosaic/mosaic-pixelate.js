function normalizeBlockSize(value) {
    return Number.isFinite(value) && value > 0 ? Math.max(1, Math.floor(value)) : 1;
}
function isInsideCircle(x, y, centerX, centerY, radiusSquared) {
    const dx = x - centerX;
    const dy = y - centerY;
    return dx * dx + dy * dy <= radiusSquared;
}
function pixelOffset(width, x, y) {
    return (y * width + x) * 4;
}
export function getCircularMosaicBounds(options) {
    const width = Number(options.width);
    const height = Number(options.height);
    const centerX = Number(options.centerX);
    const centerY = Number(options.centerY);
    const radius = Number(options.radius);
    if (!Number.isFinite(width) ||
        !Number.isFinite(height) ||
        !Number.isFinite(centerX) ||
        !Number.isFinite(centerY) ||
        !Number.isFinite(radius) ||
        radius <= 0 ||
        width <= 0 ||
        height <= 0) {
        return null;
    }
    const minX = Math.max(0, Math.floor(centerX - radius));
    const maxX = Math.min(width - 1, Math.ceil(centerX + radius));
    const minY = Math.max(0, Math.floor(centerY - radius));
    const maxY = Math.min(height - 1, Math.ceil(centerY + radius));
    return minX <= maxX && minY <= maxY ? { minX, minY, maxX, maxY } : null;
}
export function applyCircularMosaicToImageData(options) {
    var _a, _b, _c, _d;
    const { imageData } = options;
    const { width, height, data } = imageData;
    const centerX = Number(options.centerX);
    const centerY = Number(options.centerY);
    const radius = Number(options.radius);
    const bounds = getCircularMosaicBounds({ width, height, centerX, centerY, radius });
    if (!bounds)
        return false;
    const blockSize = normalizeBlockSize(options.blockSize);
    const { minX, minY, maxX, maxY } = bounds;
    const radiusSquared = radius * radius;
    let processed = false;
    for (let blockY = minY; blockY <= maxY; blockY += blockSize) {
        for (let blockX = minX; blockX <= maxX; blockX += blockSize) {
            const blockMaxX = Math.min(maxX, blockX + blockSize - 1);
            const blockMaxY = Math.min(maxY, blockY + blockSize - 1);
            let sampleOffset = -1;
            for (let y = blockY; y <= blockMaxY && sampleOffset < 0; y += 1) {
                for (let x = blockX; x <= blockMaxX; x += 1) {
                    if (!isInsideCircle(x, y, centerX, centerY, radiusSquared))
                        continue;
                    sampleOffset = pixelOffset(width, x, y);
                    break;
                }
            }
            if (sampleOffset < 0)
                continue;
            const red = (_a = data[sampleOffset]) !== null && _a !== void 0 ? _a : 0;
            const green = (_b = data[sampleOffset + 1]) !== null && _b !== void 0 ? _b : 0;
            const blue = (_c = data[sampleOffset + 2]) !== null && _c !== void 0 ? _c : 0;
            const alpha = (_d = data[sampleOffset + 3]) !== null && _d !== void 0 ? _d : 0;
            for (let y = blockY; y <= blockMaxY; y += 1) {
                for (let x = blockX; x <= blockMaxX; x += 1) {
                    if (!isInsideCircle(x, y, centerX, centerY, radiusSquared))
                        continue;
                    const offset = pixelOffset(width, x, y);
                    data[offset] = red;
                    data[offset + 1] = green;
                    data[offset + 2] = blue;
                    data[offset + 3] = alpha;
                    processed = true;
                }
            }
        }
    }
    return processed;
}
//# sourceMappingURL=mosaic-pixelate.js.map