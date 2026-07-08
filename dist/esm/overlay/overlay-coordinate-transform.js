export function normalizeRotationDegrees(rotation) {
    const value = Number(rotation !== null && rotation !== void 0 ? rotation : 0);
    if (!Number.isFinite(value))
        return 0;
    return ((value % 360) + 360) % 360;
}
export function imageNormalizedToSourcePixel(point, imageInfo) {
    return {
        x: point.x * imageInfo.naturalWidth,
        y: point.y * imageInfo.naturalHeight,
    };
}
export function sourcePixelToImageNormalized(point, imageInfo) {
    return {
        x: point.x / imageInfo.naturalWidth,
        y: point.y / imageInfo.naturalHeight,
    };
}
export function applyBaseImageTransform(point, imageInfo, transform) {
    const centerX = imageInfo.naturalWidth / 2;
    const centerY = imageInfo.naturalHeight / 2;
    let x = point.x - centerX;
    let y = point.y - centerY;
    if ((transform === null || transform === void 0 ? void 0 : transform.flipX) === true)
        x = -x;
    if ((transform === null || transform === void 0 ? void 0 : transform.flipY) === true)
        y = -y;
    const radians = (normalizeRotationDegrees(transform === null || transform === void 0 ? void 0 : transform.rotation) * Math.PI) / 180;
    if (radians !== 0) {
        const cos = Math.cos(radians);
        const sin = Math.sin(radians);
        const nextX = x * cos - y * sin;
        const nextY = x * sin + y * cos;
        x = nextX;
        y = nextY;
    }
    return { x: centerX + x, y: centerY + y };
}
export function unapplyBaseImageTransform(point, imageInfo, transform) {
    const centerX = imageInfo.naturalWidth / 2;
    const centerY = imageInfo.naturalHeight / 2;
    let x = point.x - centerX;
    let y = point.y - centerY;
    const radians = (-normalizeRotationDegrees(transform === null || transform === void 0 ? void 0 : transform.rotation) * Math.PI) / 180;
    if (radians !== 0) {
        const cos = Math.cos(radians);
        const sin = Math.sin(radians);
        const nextX = x * cos - y * sin;
        const nextY = x * sin + y * cos;
        x = nextX;
        y = nextY;
    }
    if ((transform === null || transform === void 0 ? void 0 : transform.flipY) === true)
        y = -y;
    if ((transform === null || transform === void 0 ? void 0 : transform.flipX) === true)
        x = -x;
    return { x: centerX + x, y: centerY + y };
}
export function sourcePixelToCanvas(point, geometry) {
    const transformed = applyBaseImageTransform(point, {
        naturalWidth: geometry.naturalWidth,
        naturalHeight: geometry.naturalHeight,
    }, geometry.transform);
    return {
        x: geometry.canvasCenterX + (transformed.x - geometry.naturalWidth / 2) * geometry.scaleX,
        y: geometry.canvasCenterY + (transformed.y - geometry.naturalHeight / 2) * geometry.scaleY,
    };
}
export function canvasToSourcePixel(point, geometry) {
    const transformed = {
        x: geometry.naturalWidth / 2 + (point.x - geometry.canvasCenterX) / geometry.scaleX,
        y: geometry.naturalHeight / 2 + (point.y - geometry.canvasCenterY) / geometry.scaleY,
    };
    return unapplyBaseImageTransform(transformed, {
        naturalWidth: geometry.naturalWidth,
        naturalHeight: geometry.naturalHeight,
    }, geometry.transform);
}
export function getTransformedRectBounds(rect, imageInfo, transform) {
    const corners = [
        { x: rect.x, y: rect.y },
        { x: rect.x + rect.width, y: rect.y },
        { x: rect.x, y: rect.y + rect.height },
        { x: rect.x + rect.width, y: rect.y + rect.height },
    ].map((point) => applyBaseImageTransform(point, imageInfo, transform));
    const xs = corners.map((point) => point.x);
    const ys = corners.map((point) => point.y);
    const left = Math.min(...xs);
    const top = Math.min(...ys);
    const right = Math.max(...xs);
    const bottom = Math.max(...ys);
    return {
        x: left,
        y: top,
        width: right - left,
        height: bottom - top,
    };
}
//# sourceMappingURL=overlay-coordinate-transform.js.map