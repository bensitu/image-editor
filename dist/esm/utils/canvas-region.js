export function floorRegion(rect) {
    const safeLeft = Number.isFinite(rect.left) ? rect.left : 0;
    const safeTop = Number.isFinite(rect.top) ? rect.top : 0;
    const safeWidth = Number.isFinite(rect.width) ? rect.width : 1;
    const safeHeight = Number.isFinite(rect.height) ? rect.height : 1;
    const left = Math.max(0, Math.floor(safeLeft));
    const top = Math.max(0, Math.floor(safeTop));
    const width = Math.max(1, Math.round(safeWidth));
    const height = Math.max(1, Math.round(safeHeight));
    return { left, top, width, height };
}
export function getObjectBBox(obj) {
    obj.setCoords();
    const br = obj.getBoundingRect();
    return { left: br.left, top: br.top, width: br.width, height: br.height };
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