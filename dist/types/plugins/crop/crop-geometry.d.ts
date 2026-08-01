/**
 * Normalizes Crop rectangles and aspect ratios and computes bounded rectangle intersections.
 *
 * @module
 */
export interface CropRect {
    readonly leftPx: number;
    readonly topPx: number;
    readonly widthPx: number;
    readonly heightPx: number;
}
export type CropAspectRatio = 'free' | number | string | Readonly<{
    width: number;
    height: number;
}> | null;
export interface CropImageBounds {
    readonly widthPx: number;
    readonly heightPx: number;
}
export interface CropRectLimits extends CropImageBounds {
    readonly minimumWidthPx: number;
    readonly minimumHeightPx: number;
}
export declare function normalizeCropRotation(value: unknown): number;
export declare function constrainCropRectToRotation(value: CropRect, rotationDegrees: number, limits: CropRectLimits): CropRect;
export declare function normalizeCropAspectRatio(value: unknown): number | null;
export declare function normalizeCropRect(value: unknown, limits: CropRectLimits): CropRect;
export declare function fitCropRectToAspectRatio(rect: CropRect, ratio: number, bounds: CropImageBounds): CropRect;
