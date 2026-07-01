/**
 * Canvas-to-source-image coordinate conversion for Mosaic mode.
 *
 * Fabric object bounding boxes are not sufficient for rotated images. These
 * helpers invert the image transform matrix and convert the pointer into the
 * image's natural pixel coordinate space.
 *
 * @module
 */
import type * as FabricNS from 'fabric';
import type { FabricModule } from '../core/public-types.js';
export interface MosaicImagePoint {
    sourceX: number;
    sourceY: number;
    sourceRadius: number;
}
/**
 * Convert a Fabric canvas pointer into source-image pixels.
 *
 * For non-uniform image scale, `sourceRadius` uses the smaller canvas scale
 * axis, which yields the larger source-space radius. This conservative
 * deterministic strategy ensures the circular canvas brush covers the clicked
 * image area after inverse transformation.
 */
export declare function getMosaicImagePoint(fabric: FabricModule, image: FabricNS.FabricImage, canvasPoint: {
    x: number;
    y: number;
}, brushDiameterCanvasPx: number): MosaicImagePoint | null;
