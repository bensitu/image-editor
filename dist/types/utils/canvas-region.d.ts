/**
 * Pure helpers that turn floating-point Fabric.js bounding
 * rectangles into integer pixel regions and provide the
 * bounding-box math that mask preservation across crop and
 * export paths share.
 *
 * ## Owned contracts
 *
 * - Export regions SHALL include partially covered trailing pixels so
 *   sub-pixel image bounds do not lose the right or bottom edge.
 * - Crop regions SHALL exclude trailing partial pixels so crop does not
 *   grow by a transparent row or column.
 * - When `applyCrop` runs with
 *   `preserveMasksAfterCrop === true` and the image has been rotated,
 *   each mask's new `left` and `top` SHALL be expressed in the cropped
 *   image's coordinate frame using the rotation angle.
 * - Across a crop apply, each mask's `angle`,
 *   `scaleX`, and `scaleY` SHALL be preserved so the visible shape does
 *   not change size or orientation.
 *
 * ## Why a dedicated module
 *
 * Region math is shared by export, crop, expand-to-image sizing, and crop
 * rectangle initialization. Centralizing it prevents one call site from
 * drifting from the others (for example, applying `Math.floor` instead of
 * `Math.round`, or forgetting the `width >= 1` floor).
 *
 * ## Design notes
 *
 * - Region floors are total: any non-finite input collapses to a
 *   `1×1` region anchored at `(0, 0)` rather than throwing. The export
 *   and crop pipelines already validate the presence of an
 *   `originalImage` upstream, so a defensive fallback here keeps the
 *   `<canvas>.drawImage` call from being passed `NaN` if Fabric ever
 *   reports a degenerate bounding rect.
 * - `getObjectBBox` calls `setCoords` before reading the bounding
 *   rect because Fabric.js v7's `getBoundingRect` returns the cached
 *   absolute rect; without the refresh a freshly-mutated mask returns
 *   stale coordinates. Callers that have already refreshed coords pay
 *   only a single redundant call, which is cheaper than double-tracking
 *   "is this object's cache fresh?" at every site.
 * - `clampRegionToCanvas` exists for the crop pipeline, where the crop
 *   rectangle's bounding rect can briefly exceed the canvas after a
 *   user drag near the edge; clamping before the `drawImage` keeps the
 *   blit inside the source canvas.
 *
 * ## Non-goals
 *
 * - This module does not perform any coordinate transformation between
 *   pre-crop and post-crop frames; the rotation math for the
 *   rotated-mask coordinate frame lives in `crop/crop-controller.ts`,
 *   which uses
 *   `getObjectBBox` here only as one input to that calculation.
 * - This module does not mutate the Fabric object passed to
 *   `getObjectBBox` beyond the `setCoords` refresh required by
 *   Fabric.js v7's API.
 *
 * @module
 */
import type * as FabricNS from 'fabric';
/**
 * A canvas region whose `left` / `top` / `width` / `height` are all
 * integer pixels suitable for `CanvasRenderingContext2D.drawImage` and
 * Fabric.js `toDataURL({ left, top, width, height})`.
 *
 * Produced by {@link floorRegion} and {@link clampRegionToCanvas}; the
 * `width` and `height` fields are guaranteed to be at least `1` so
 * region exports never collapse to a zero-pixel image.
 */
export interface IntegerRegion {
    left: number;
    top: number;
    width: number;
    height: number;
}
export interface RegionRoundingOptions {
    /**
     * When true, `right` / `bottom` are ceiled to include partially covered
     * trailing pixels. When false, they are floored to exclude them.
     * @default true
     */
    includePartialPixels?: boolean;
}
export interface PartialExportEdges {
    left: boolean;
    top: boolean;
    right: boolean;
    bottom: boolean;
}
export declare function hasMeaningfulCanvasRegion(rect: {
    left: number;
    top: number;
    width: number;
    height: number;
}, canvasWidth?: number, canvasHeight?: number): boolean;
/**
 * Convert a floating-point rectangle into an {@link IntegerRegion}.
 *
 * - `left` / `top` are floored and clamped to `>= 0` so the region
 *   never starts before the source canvas's top-left corner.
 * - `right` / `bottom` are ceiled by default to include partially covered
 *   trailing pixels, or floored when `includePartialPixels` is false.
 * - `width` / `height` are derived from those integer edges and clamped
 *   to `>= 1` so no sub-pixel dimensions reach Fabric's region export.
 * - Non-finite inputs collapse to a `1×1` region at `(0, 0)` rather than
 *   propagating `NaN` into the canvas pipeline.
 *
 * region floor before mask remapping).
 *
 * @param rect - The floating-point bounding rect to discretize.
 * @returns    An {@link IntegerRegion} safe to pass to `drawImage`.
 */
export declare function getClampedCanvasRegion(rect: {
    left: number;
    top: number;
    width: number;
    height: number;
}, canvasWidth?: number, canvasHeight?: number, options?: RegionRoundingOptions): IntegerRegion;
export declare function floorRegion(rect: {
    left: number;
    top: number;
    width: number;
    height: number;
}): IntegerRegion;
export declare function hasFractionalCanvasEdge(value: number): boolean;
export declare function getPartialExportEdges(bounds: {
    left: number;
    top: number;
    width: number;
    height: number;
} | null, angle?: number): PartialExportEdges | null;
/**
 * Read a Fabric.js object's absolute bounding rectangle in canvas-pixel
 * coordinates.
 *
 * `setCoords` is called first because Fabric.js v7's
 * `getBoundingRect` returns the cached absolute rect — the per-frame
 * cache the canvas already maintains. Without the refresh a freshly
 * mutated mask returns stale coordinates, which can make rotated masks
 * drift after crop.
 *
 * The returned rect uses floating-point coordinates; callers that need
 * integer pixel regions should pipe the result through
 * {@link floorRegion}.
 *
 * @param object - The Fabric.js object to measure.
 * @returns   The absolute bounding rect in canvas pixels.
 */
export declare function getObjectBBox(object: FabricNS.FabricObject): {
    left: number;
    top: number;
    width: number;
    height: number;
};
/**
 * Clamp an {@link IntegerRegion} so it fits entirely inside a canvas of
 * `canvasWidth × canvasHeight` pixels.
 *
 * - `left` is clamped to `[0, canvasWidth - 1]`.
 * - `top` is clamped to `[0, canvasHeight - 1]`.
 * - `width` is clamped so `left + width <= canvasWidth`.
 * - `height` is clamped so `top + height <= canvasHeight`.
 *
 * The function preserves the `width >= 1` / `height >= 1` invariant
 * established by {@link floorRegion}, which keeps callers from having
 * to special-case zero-sized regions when the supplied rect lands
 * entirely outside the canvas.
 *
 * canvas before the mask coordinate remap).
 *
 * @param region - The integer region to clamp.
 * @param canvasWidth - The source canvas's pixel width.
 * @param canvasHeight - The source canvas's pixel height.
 * @returns            A clamped {@link IntegerRegion}.
 */
export declare function clampRegionToCanvas(region: IntegerRegion, canvasWidth: number, canvasHeight: number): IntegerRegion;
