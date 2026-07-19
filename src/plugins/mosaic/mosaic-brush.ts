/**
 * Interpolates Mosaic brush strokes, merges dirty rectangles, and mutates bounded circular pixel regions.
 *
 * @module
 */

export interface MosaicImagePoint {
    readonly xPx: number;
    readonly yPx: number;
}

export interface DirtyRectangle {
    readonly leftPx: number;
    readonly topPx: number;
    readonly widthPx: number;
    readonly heightPx: number;
}

export interface CircularDirtyRectangleOptions {
    readonly widthPx: number;
    readonly heightPx: number;
    readonly centerXPx: number;
    readonly centerYPx: number;
    readonly radiusPx: number;
}

export interface MosaicBrushPoint extends MosaicImagePoint {
    readonly radiusPx: number;
    readonly blockSizePx: number;
}

interface MutableImageData {
    readonly width: number;
    readonly height: number;
    readonly data: Uint8ClampedArray;
}

function isInsideCircle(
    x: number,
    y: number,
    centerX: number,
    centerY: number,
    radiusSquared: number,
): boolean {
    const deltaX = x - centerX;
    const deltaY = y - centerY;
    return deltaX * deltaX + deltaY * deltaY <= radiusSquared;
}

function pixelOffset(width: number, x: number, y: number): number {
    return (y * width + x) * 4;
}

export function getCircularDirtyRectangle(
    options: CircularDirtyRectangleOptions,
): DirtyRectangle | null {
    const { widthPx, heightPx, centerXPx, centerYPx, radiusPx } = options;
    if (
        !Number.isSafeInteger(widthPx) ||
        !Number.isSafeInteger(heightPx) ||
        widthPx <= 0 ||
        heightPx <= 0 ||
        !Number.isFinite(centerXPx) ||
        !Number.isFinite(centerYPx) ||
        !Number.isFinite(radiusPx) ||
        radiusPx <= 0
    ) {
        return null;
    }
    const leftPx = Math.max(0, Math.floor(centerXPx - radiusPx));
    const rightPx = Math.min(widthPx - 1, Math.ceil(centerXPx + radiusPx));
    const topPx = Math.max(0, Math.floor(centerYPx - radiusPx));
    const bottomPx = Math.min(heightPx - 1, Math.ceil(centerYPx + radiusPx));
    if (leftPx > rightPx || topPx > bottomPx) return null;
    return Object.freeze({
        leftPx,
        topPx,
        widthPx: rightPx - leftPx + 1,
        heightPx: bottomPx - topPx + 1,
    });
}

export function mergeDirtyRectangles(
    current: DirtyRectangle | null,
    next: DirtyRectangle | null,
): DirtyRectangle | null {
    if (!next) return current ? Object.freeze({ ...current }) : null;
    if (!current) return Object.freeze({ ...next });
    const leftPx = Math.min(current.leftPx, next.leftPx);
    const topPx = Math.min(current.topPx, next.topPx);
    const rightPx = Math.max(current.leftPx + current.widthPx, next.leftPx + next.widthPx);
    const bottomPx = Math.max(current.topPx + current.heightPx, next.topPx + next.heightPx);
    return Object.freeze({
        leftPx,
        topPx,
        widthPx: rightPx - leftPx,
        heightPx: bottomPx - topPx,
    });
}

export function interpolateMosaicPoints(
    start: MosaicImagePoint,
    end: MosaicImagePoint,
    radiusPx: number,
): readonly MosaicImagePoint[] {
    const deltaX = end.xPx - start.xPx;
    const deltaY = end.yPx - start.yPx;
    const distance = Math.hypot(deltaX, deltaY);
    const spacing = Math.max(1, radiusPx / 2);
    const steps = Math.max(1, Math.ceil(distance / spacing));
    return Object.freeze(
        Array.from(Array.from({ length: steps }).keys(), (index) => {
            const progress = (index + 1) / steps;
            return Object.freeze({
                xPx: start.xPx + deltaX * progress,
                yPx: start.yPx + deltaY * progress,
            });
        }),
    );
}

export function applyCircularMosaic(
    imageData: MutableImageData,
    point: MosaicBrushPoint,
): DirtyRectangle | null {
    const dirty = getCircularDirtyRectangle({
        widthPx: imageData.width,
        heightPx: imageData.height,
        centerXPx: point.xPx,
        centerYPx: point.yPx,
        radiusPx: point.radiusPx,
    });
    if (!dirty) return null;
    const blockSize = Math.max(1, Math.floor(point.blockSizePx));
    const rightPx = dirty.leftPx + dirty.widthPx - 1;
    const bottomPx = dirty.topPx + dirty.heightPx - 1;
    const radiusSquared = point.radiusPx * point.radiusPx;
    let changed = false;
    for (let blockTop = dirty.topPx; blockTop <= bottomPx; blockTop += blockSize) {
        for (let blockLeft = dirty.leftPx; blockLeft <= rightPx; blockLeft += blockSize) {
            const blockRight = Math.min(rightPx, blockLeft + blockSize - 1);
            const blockBottom = Math.min(bottomPx, blockTop + blockSize - 1);
            let sampleOffset = -1;
            for (let y = blockTop; y <= blockBottom && sampleOffset < 0; y += 1) {
                for (let x = blockLeft; x <= blockRight; x += 1) {
                    if (!isInsideCircle(x, y, point.xPx, point.yPx, radiusSquared)) {
                        continue;
                    }
                    sampleOffset = pixelOffset(imageData.width, x, y);
                    break;
                }
            }
            if (sampleOffset < 0) continue;
            const red = imageData.data[sampleOffset] ?? 0;
            const green = imageData.data[sampleOffset + 1] ?? 0;
            const blue = imageData.data[sampleOffset + 2] ?? 0;
            const alpha = imageData.data[sampleOffset + 3] ?? 0;
            for (let y = blockTop; y <= blockBottom; y += 1) {
                for (let x = blockLeft; x <= blockRight; x += 1) {
                    if (!isInsideCircle(x, y, point.xPx, point.yPx, radiusSquared)) {
                        continue;
                    }
                    const offset = pixelOffset(imageData.width, x, y);
                    imageData.data[offset] = red;
                    imageData.data[offset + 1] = green;
                    imageData.data[offset + 2] = blue;
                    imageData.data[offset + 3] = alpha;
                    changed = true;
                }
            }
        }
    }
    return changed ? dirty : null;
}
