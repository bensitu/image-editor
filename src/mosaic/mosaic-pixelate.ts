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

function normalizeBlockSize(value: number): number {
    return Number.isFinite(value) && value > 0 ? Math.max(1, Math.floor(value)) : 1;
}

function isInsideCircle(
    x: number,
    y: number,
    centerX: number,
    centerY: number,
    radiusSquared: number,
): boolean {
    const dx = x - centerX;
    const dy = y - centerY;
    return dx * dx + dy * dy <= radiusSquared;
}

function pixelOffset(width: number, x: number, y: number): number {
    return (y * width + x) * 4;
}

/**
 * Applies blocky pixelation inside a circular brush region.
 *
 * @returns `true` when at least one pixel was processed, otherwise `false`.
 */
export function applyCircularMosaicToImageData(options: MosaicPixelateOptions): boolean {
    const { imageData } = options;
    const { width, height, data } = imageData;
    const centerX = Number(options.centerX);
    const centerY = Number(options.centerY);
    const radius = Number(options.radius);

    if (
        !Number.isFinite(centerX) ||
        !Number.isFinite(centerY) ||
        !Number.isFinite(radius) ||
        radius <= 0 ||
        width <= 0 ||
        height <= 0
    ) {
        return false;
    }

    const blockSize = normalizeBlockSize(options.blockSize);
    const minX = Math.max(0, Math.floor(centerX - radius));
    const maxX = Math.min(width - 1, Math.ceil(centerX + radius));
    const minY = Math.max(0, Math.floor(centerY - radius));
    const maxY = Math.min(height - 1, Math.ceil(centerY + radius));

    if (minX > maxX || minY > maxY) return false;

    const radiusSquared = radius * radius;
    let processed = false;

    for (let blockY = minY; blockY <= maxY; blockY += blockSize) {
        for (let blockX = minX; blockX <= maxX; blockX += blockSize) {
            const blockMaxX = Math.min(maxX, blockX + blockSize - 1);
            const blockMaxY = Math.min(maxY, blockY + blockSize - 1);
            let sampleOffset = -1;

            for (let y = blockY; y <= blockMaxY && sampleOffset < 0; y += 1) {
                for (let x = blockX; x <= blockMaxX; x += 1) {
                    if (!isInsideCircle(x, y, centerX, centerY, radiusSquared)) continue;
                    sampleOffset = pixelOffset(width, x, y);
                    break;
                }
            }

            if (sampleOffset < 0) continue;

            const red = data[sampleOffset] ?? 0;
            const green = data[sampleOffset + 1] ?? 0;
            const blue = data[sampleOffset + 2] ?? 0;
            const alpha = data[sampleOffset + 3] ?? 0;

            for (let y = blockY; y <= blockMaxY; y += 1) {
                for (let x = blockX; x <= blockMaxX; x += 1) {
                    if (!isInsideCircle(x, y, centerX, centerY, radiusSquared)) continue;
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
