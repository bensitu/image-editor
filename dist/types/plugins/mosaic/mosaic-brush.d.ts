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
export declare function getCircularDirtyRectangle(options: CircularDirtyRectangleOptions): DirtyRectangle | null;
export declare function mergeDirtyRectangles(current: DirtyRectangle | null, next: DirtyRectangle | null): DirtyRectangle | null;
export declare function interpolateMosaicPoints(start: MosaicImagePoint, end: MosaicImagePoint, radiusPx: number): readonly MosaicImagePoint[];
export declare function applyCircularMosaic(imageData: MutableImageData, point: MosaicBrushPoint): DirtyRectangle | null;
export {};
