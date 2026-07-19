/**
 * Creates and updates bounded Mosaic raster caches and preview Fabric images.
 *
 * @module
 */

import type * as FabricNS from 'fabric';

import type { FabricModule } from '../../core/index.js';
import type { DirtyRectangle } from './mosaic-brush.js';
import { MosaicValidationError } from './mosaic-errors.js';

export interface MosaicImageDataWriter {
    putImageData(
        imageData: ImageData,
        dx: number,
        dy: number,
        dirtyX?: number,
        dirtyY?: number,
        dirtyWidth?: number,
        dirtyHeight?: number,
    ): void;
}

export function writeMosaicDirtyRegion(
    context: MosaicImageDataWriter,
    imageData: ImageData,
    dirty: DirtyRectangle,
): void {
    context.putImageData(imageData, 0, 0, dirty.leftPx, dirty.topPx, dirty.widthPx, dirty.heightPx);
}

export interface MosaicRasterCache {
    readonly surface: HTMLCanvasElement;
    readonly context: CanvasRenderingContext2D;
    readonly imageData: ImageData;
    readonly widthPx: number;
    readonly heightPx: number;
}

export function copyMosaicImagePresentation(
    source: FabricNS.FabricImage,
    target: FabricNS.FabricImage,
    transient: boolean,
): void {
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

export function createMosaicRasterCache(source: FabricNS.FabricImage): MosaicRasterCache {
    const widthPx = Number(source.width);
    const heightPx = Number(source.height);
    if (
        !Number.isSafeInteger(widthPx) ||
        !Number.isSafeInteger(heightPx) ||
        widthPx <= 0 ||
        heightPx <= 0
    ) {
        throw new MosaicValidationError('Mosaic source dimensions are invalid.');
    }
    const element = source.getElement();
    const ownerDocument = element.ownerDocument ?? globalThis.document;
    if (!ownerDocument) {
        throw new MosaicValidationError('Mosaic rendering document is unavailable.');
    }
    const surface = ownerDocument.createElement('canvas');
    surface.width = widthPx;
    surface.height = heightPx;
    const context = surface.getContext('2d');
    if (!context) throw new MosaicValidationError('Mosaic rendering context is unavailable.');
    context.drawImage(element as CanvasImageSource, 0, 0, widthPx, heightPx);
    let imageData: ImageData;
    try {
        imageData = context.getImageData(0, 0, widthPx, heightPx);
    } catch {
        throw new MosaicValidationError('Mosaic source pixels could not be read.');
    }
    return Object.freeze({ surface, context, imageData, widthPx, heightPx });
}

export function createMosaicPreviewImage(
    fabric: FabricModule,
    source: FabricNS.FabricImage,
    cache: MosaicRasterCache,
): FabricNS.FabricImage {
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

export function disposeMosaicRasterCache(cache: MosaicRasterCache | null): void {
    if (!cache) return;
    cache.surface.width = 0;
    cache.surface.height = 0;
}
