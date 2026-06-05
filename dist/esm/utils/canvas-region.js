export function hasMeaningfulCanvasRegion(rect, canvasWidth, canvasHeight) {
    const left = Number(rect.left);
    const top = Number(rect.top);
    const width = Number(rect.width);
    const height = Number(rect.height);
    if (!Number.isFinite(left) ||
        !Number.isFinite(top) ||
        !Number.isFinite(width) ||
        !Number.isFinite(height) ||
        width <= 0 ||
        height <= 0) {
        return false;
    }
    const right = left + width;
    const bottom = top + height;
    if (!Number.isFinite(right) || !Number.isFinite(bottom))
        return false;
    const safeCanvasWidth = Number(canvasWidth);
    const safeCanvasHeight = Number(canvasHeight);
    if (!Number.isFinite(safeCanvasWidth) ||
        !Number.isFinite(safeCanvasHeight) ||
        safeCanvasWidth <= 0 ||
        safeCanvasHeight <= 0) {
        return true;
    }
    const overlapWidth = Math.min(right, safeCanvasWidth) - Math.max(left, 0);
    const overlapHeight = Math.min(bottom, safeCanvasHeight) - Math.max(top, 0);
    return overlapWidth > 0 && overlapHeight > 0;
}
export function getClampedCanvasRegion(rect, canvasWidth, canvasHeight, options = {}) {
    const safeLeft = Number.isFinite(rect.left) ? rect.left : 0;
    const safeTop = Number.isFinite(rect.top) ? rect.top : 0;
    const safeWidth = Math.max(0, Number.isFinite(rect.width) ? rect.width : 0);
    const safeHeight = Math.max(0, Number.isFinite(rect.height) ? rect.height : 0);
    const includePartialPixels = options.includePartialPixels !== false;
    const roundEnd = includePartialPixels ? Math.ceil : Math.floor;
    const hasCanvasWidth = Number.isFinite(canvasWidth);
    const hasCanvasHeight = Number.isFinite(canvasHeight);
    const safeCanvasWidth = hasCanvasWidth
        ? Math.max(1, Math.round(Number(canvasWidth)))
        : Number.POSITIVE_INFINITY;
    const safeCanvasHeight = hasCanvasHeight
        ? Math.max(1, Math.round(Number(canvasHeight)))
        : Number.POSITIVE_INFINITY;
    const left = Math.min(safeCanvasWidth - 1, Math.max(0, Math.floor(safeLeft)));
    const top = Math.min(safeCanvasHeight - 1, Math.max(0, Math.floor(safeTop)));
    const right = Math.min(safeCanvasWidth, Math.max(left + 1, roundEnd(safeLeft + safeWidth)));
    const bottom = Math.min(safeCanvasHeight, Math.max(top + 1, roundEnd(safeTop + safeHeight)));
    return {
        left,
        top,
        width: Math.max(1, right - left),
        height: Math.max(1, bottom - top),
    };
}
export function floorRegion(rect) {
    return getClampedCanvasRegion(rect, undefined, undefined, { includePartialPixels: false });
}
export function hasFractionalCanvasEdge(value) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue))
        return false;
    return Math.abs(numericValue - Math.round(numericValue)) > 0.01;
}
export function getPartialExportEdges(bounds, angle = 0) {
    if (!bounds)
        return null;
    const normalizedAngle = Math.abs((Number(angle) || 0) % 90);
    const isAxisAligned = normalizedAngle < 0.01 || Math.abs(normalizedAngle - 90) < 0.01;
    if (!isAxisAligned)
        return null;
    const left = Number(bounds.left) || 0;
    const top = Number(bounds.top) || 0;
    return {
        left: hasFractionalCanvasEdge(left),
        top: hasFractionalCanvasEdge(top),
        right: hasFractionalCanvasEdge(left + (Number(bounds.width) || 0)),
        bottom: hasFractionalCanvasEdge(top + (Number(bounds.height) || 0)),
    };
}
export function getObjectBBox(object) {
    object.setCoords();
    const boundingRect = object.getBoundingRect();
    return {
        left: boundingRect.left,
        top: boundingRect.top,
        width: boundingRect.width,
        height: boundingRect.height,
    };
}
export function clampRegionToCanvas(region, canvasWidth, canvasHeight) {
    const safeCw = Math.max(1, Math.floor(Number.isFinite(canvasWidth) ? canvasWidth : 1));
    const safeCh = Math.max(1, Math.floor(Number.isFinite(canvasHeight) ? canvasHeight : 1));
    const left = Math.max(0, Math.min(region.left, safeCw - 1));
    const top = Math.max(0, Math.min(region.top, safeCh - 1));
    const width = Math.max(1, Math.min(region.width, safeCw - left));
    const height = Math.max(1, Math.min(region.height, safeCh - top));
    return { left, top, width, height };
}
//# sourceMappingURL=canvas-region.js.map