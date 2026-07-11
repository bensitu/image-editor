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
export function isFiniteTransformMatrix(matrix: number[]): boolean {
    return (
        Array.isArray(matrix) &&
        matrix.length === 6 &&
        matrix.every((value) => Number.isFinite(value))
    );
}

/** Return whether a matrix is identity within a floating-point tolerance. */
export function isApproximatelyIdentityTransform(matrix: number[], epsilon = 1e-10): boolean {
    const identity = [1, 0, 0, 1, 0, 0];

    return (
        matrix.length === identity.length &&
        matrix.every((value, index) => Math.abs(value - (identity[index] as number)) <= epsilon)
    );
}

/** Calculate `after * inverse(before)` for two valid image matrices. */
export function computeImageTransformDelta(
    beforeMatrix: number[],
    afterMatrix: number[],
    fabricUtil: FabricUtilAccess,
): number[] {
    if (!isFiniteTransformMatrix(beforeMatrix) || !isFiniteTransformMatrix(afterMatrix)) {
        return [];
    }

    return fabricUtil.multiplyTransformMatrices(
        afterMatrix,
        fabricUtil.invertTransform(beforeMatrix),
    );
}

/** Return whether the affine linear component changes handedness. */
export function deltaHasReflection(delta: number[]): boolean {
    if (!isFiniteTransformMatrix(delta)) return false;

    const [a, b, c, d] = delta as [number, number, number, number, number, number];
    return a * d - b * c < 0;
}

/** Transform a point and return a real Fabric Point instance. */
export function transformPointByMatrix(
    point: FabricNS.Point,
    matrix: number[],
    fabricUtil: FabricUtilAccess,
): FabricNS.Point {
    const [a, b, c, d, e, f] = matrix as [number, number, number, number, number, number];

    return new fabricUtil.Point(a * point.x + c * point.y + e, b * point.x + d * point.y + f);
}

/**
 * Remove one reflection from a delta while retaining its translation,
 * rotation, scale, and skew components.
 */
export function stripReflectionFromDelta(delta: number[], fabricUtil: FabricUtilAccess): number[] {
    if (!deltaHasReflection(delta)) return delta;

    const flipXMatrix = [-1, 0, 0, 1, 0, 0];
    const flipYMatrix = [1, 0, 0, -1, 0, 0];
    const flipXCandidate = fabricUtil.multiplyTransformMatrices(delta, flipXMatrix);
    const flipYCandidate = fabricUtil.multiplyTransformMatrices(delta, flipYMatrix);

    const normalizedAngleMagnitude = (matrix: number[]): number => {
        try {
            const angle = fabricUtil.qrDecompose(matrix).angle;
            if (!Number.isFinite(angle)) return Number.POSITIVE_INFINITY;
            return Math.abs((((angle % 360) + 540) % 360) - 180);
        } catch {
            return Number.POSITIVE_INFINITY;
        }
    };

    // A reflected matrix has two equivalent non-reflected decompositions
    // separated by 180 degrees. Prefer the correction with the smaller
    // compensating rotation so a vertical flip does not turn readable text
    // upside down. Ties retain the historical horizontal correction.
    return normalizedAngleMagnitude(flipYCandidate) < normalizedAngleMagnitude(flipXCandidate)
        ? flipYCandidate
        : flipXCandidate;
}

/**
 * Apply an affine image delta to a live Fabric overlay object in place.
 * Position always follows the complete delta. Readable text can remove the
 * reflection from its local orientation without changing that position.
 */
export function applyDeltaToObject(
    object: FabricNS.FabricObject,
    fullDelta: number[],
    context: OverlayDeltaApplyContext,
): void {
    if (!isFiniteTransformMatrix(fullDelta)) return;
    if (isApproximatelyIdentityTransform(fullDelta)) return;

    const { fabricUtil } = context;

    object.setCoords();

    const previousOriginX = object.originX ?? 'left';
    const previousOriginY = object.originY ?? 'top';

    const originalCenter = object.getCenterPoint();
    const targetCenter = transformPointByMatrix(originalCenter, fullDelta, fabricUtil);

    const orientationDelta = context.preserveReadableText
        ? stripReflectionFromDelta(fullDelta, fabricUtil)
        : fullDelta;

    let restoreCenter = originalCenter;
    try {
        object.set({
            originX: 'center',
            originY: 'center',
        });
        object.setPositionByOrigin(originalCenter, 'center', 'center');
        object.setCoords();

        const currentObjectMatrix = object.calcTransformMatrix() as number[];
        const nextMatrix = fabricUtil.multiplyTransformMatrices(
            orientationDelta,
            currentObjectMatrix,
        );

        if (!isFiniteTransformMatrix(nextMatrix)) return;

        const decomposed = fabricUtil.qrDecompose(nextMatrix);

        // Reset first because Fabric 7.4 converts negative scales into flip flags.
        object.set({
            flipX: false,
            flipY: false,
        });

        object.set({
            angle: decomposed.angle,
            scaleX: decomposed.scaleX,
            scaleY: decomposed.scaleY,
            skewX: decomposed.skewX,
        });

        // Newer Fabric versions may expose explicit decomposition flip flags.
        if (typeof decomposed.flipX === 'boolean' || typeof decomposed.flipY === 'boolean') {
            object.set({
                ...(typeof decomposed.flipX === 'boolean' ? { flipX: decomposed.flipX } : {}),
                ...(typeof decomposed.flipY === 'boolean' ? { flipY: decomposed.flipY } : {}),
            });
        }

        restoreCenter = targetCenter;
    } finally {
        object.set({
            originX: previousOriginX,
            originY: previousOriginY,
        });
        object.setPositionByOrigin(restoreCenter, 'center', 'center');
        object.setCoords();
    }
}
