/**
 * Matrix-delta helpers for binding editable overlays to the base image.
 *
 * Runtime callers apply the base image's final affine delta to existing
 * Fabric objects in place so object identity and editor metadata remain
 * stable.
 *
 * @module
 */
import type * as FabricNS from 'fabric';
/** Narrow access to the Fabric matrix helpers used by overlay binding. */
export interface FabricUtilAccess {
    multiplyTransformMatrices(a: number[], b: number[]): number[];
    invertTransform(matrix: number[]): number[];
    qrDecompose(matrix: number[]): {
        angle: number;
        scaleX: number;
        scaleY: number;
        skewX: number;
        skewY?: number;
        translateX: number;
        translateY: number;
        flipX?: boolean;
        flipY?: boolean;
    };
    Point: new (x: number, y: number) => FabricNS.Point;
}
/** Dependencies and behavior switches for applying an image delta. */
export interface OverlayDeltaApplyContext {
    fabricUtil: FabricUtilAccess;
    /**
     * Keep text glyphs readable while their center follows the full image
     * transform. This only changes the object's local orientation delta.
     */
    preserveReadableText?: boolean;
}
/** Return whether a value is a complete, finite 2D affine matrix. */
export declare function isFiniteTransformMatrix(matrix: number[]): boolean;
/** Return whether a matrix is identity within a floating-point tolerance. */
export declare function isApproximatelyIdentityTransform(matrix: number[], epsilon?: number): boolean;
/** Calculate `after * inverse(before)` for two valid image matrices. */
export declare function computeImageTransformDelta(beforeMatrix: number[], afterMatrix: number[], fabricUtil: FabricUtilAccess): number[];
/** Return whether the affine linear component changes handedness. */
export declare function deltaHasReflection(delta: number[]): boolean;
/** Transform a point and return a real Fabric Point instance. */
export declare function transformPointByMatrix(point: FabricNS.Point, matrix: number[], fabricUtil: FabricUtilAccess): FabricNS.Point;
/**
 * Remove one reflection from a delta while retaining its translation,
 * rotation, scale, and skew components.
 */
export declare function stripReflectionFromDelta(delta: number[], fabricUtil: FabricUtilAccess): number[];
/**
 * Apply an affine image delta to a live Fabric overlay object in place.
 * Position always follows the complete delta. Readable text can remove the
 * reflection from its local orientation without changing that position.
 */
export declare function applyDeltaToObject(object: FabricNS.FabricObject, fullDelta: number[], context: OverlayDeltaApplyContext): void;
