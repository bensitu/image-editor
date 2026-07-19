/**
 * Implements affine matrix validation, composition, inversion, and bounds transformation for geometry mutations.
 *
 * @module
 */
export type AffineMatrix = readonly [number, number, number, number, number, number];
export interface Point {
    readonly x: number;
    readonly y: number;
}
export interface Rect {
    readonly left: number;
    readonly top: number;
    readonly width: number;
    readonly height: number;
}
export declare const IDENTITY_AFFINE_MATRIX: AffineMatrix;
export declare const AFFINE_EPSILON = 1e-10;
export declare function isFiniteAffineMatrix(value: unknown): value is AffineMatrix;
export declare function assertAffineMatrix(value: unknown, label?: string): asserts value is AffineMatrix;
export declare function affineDeterminant(matrix: AffineMatrix): number;
export declare function hasAffineReflection(matrix: AffineMatrix): boolean;
export declare function multiplyAffine(left: AffineMatrix, right: AffineMatrix): AffineMatrix;
export declare function invertAffine(matrix: AffineMatrix, epsilon?: number): AffineMatrix;
export declare function applyAffineToPoint(matrix: AffineMatrix, point: Point): Point;
export declare function transformRectBounds(matrix: AffineMatrix, rect: Rect): Rect;
export declare function approximatelyEqualAffine(left: AffineMatrix, right: AffineMatrix, epsilon?: number): boolean;
export declare function sanitizeAffineMatrix(matrix: AffineMatrix, epsilon?: number): AffineMatrix;
/** Computes the one-time world-space delta from the committed before/after matrices. */
export declare function computeAffineDelta(before: AffineMatrix, after: AffineMatrix): AffineMatrix;
