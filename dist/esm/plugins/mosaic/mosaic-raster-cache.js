import { MosaicValidationError } from './mosaic-errors.js';
export function writeMosaicDirtyRegion(context, imageData, dirty) {
    context.putImageData(imageData, 0, 0, dirty.leftPx, dirty.topPx, dirty.widthPx, dirty.heightPx);
}
export function copyMosaicImagePresentation(source, target, transient) {
    target.set({
        left: source.left,
        top: source.top,
        originX: source.originX,
        originY: source.originY,
        scaleX: source.scaleX,
        scaleY: source.scaleY,
        angle: source.angle,
        skewX: source.skewX,
        skewY: source.skewY,
        flipX: source.flipX,
        flipY: source.flipY,
        opacity: source.opacity,
        visible: source.visible,
        selectable: transient ? false : source.selectable,
        evented: transient ? false : source.evented,
        hasControls: transient ? false : source.hasControls,
        hoverCursor: source.hoverCursor,
        excludeFromExport: transient ? true : source.excludeFromExport,
        backgroundColor: source.backgroundColor,
        objectCaching: transient ? false : source.objectCaching,
    });
    target.setCoords();
}
export function createMosaicRasterCache(source) {
    var _a;
    const widthPx = Number(source.width);
    const heightPx = Number(source.height);
    if (!Number.isSafeInteger(widthPx) ||
        !Number.isSafeInteger(heightPx) ||
        widthPx <= 0 ||
        heightPx <= 0) {
        throw new MosaicValidationError('Mosaic source dimensions are invalid.');
    }
    const element = source.getElement();
    const ownerDocument = (_a = element.ownerDocument) !== null && _a !== void 0 ? _a : globalThis.document;
    if (!ownerDocument) {
        throw new MosaicValidationError('Mosaic rendering document is unavailable.');
    }
    const surface = ownerDocument.createElement('canvas');
    surface.width = widthPx;
    surface.height = heightPx;
    const context = surface.getContext('2d');
    if (!context)
        throw new MosaicValidationError('Mosaic rendering context is unavailable.');
    context.drawImage(element, 0, 0, widthPx, heightPx);
    let imageData;
    try {
        imageData = context.getImageData(0, 0, widthPx, heightPx);
    }
    catch {
        throw new MosaicValidationError('Mosaic source pixels could not be read.');
    }
    return Object.freeze({ surface, context, imageData, widthPx, heightPx });
}
export function createMosaicPreviewImage(fabric, source, cache) {
    const preview = new fabric.FabricImage(cache.surface, {
        selectable: false,
        evented: false,
        hasControls: false,
        excludeFromExport: true,
        objectCaching: false,
    });
    copyMosaicImagePresentation(source, preview, true);
    return preview;
}
export function disposeMosaicRasterCache(cache) {
    if (!cache)
        return;
    cache.surface.width = 0;
    cache.surface.height = 0;
}
//# sourceMappingURL=mosaic-raster-cache.js.map