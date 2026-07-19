/**
 * Applies Core affine geometry mutations to Annotation Fabric objects under the reflection policy.
 *
 * @module
 */

import type * as FabricNS from 'fabric';

import type { FabricModule, GeometryMutationDescriptor } from '../../core/index.js';

interface FabricUtilAccess {
    multiplyTransformMatrices(left: number[], right: number[]): number[];
    qrDecompose(matrix: number[]): {
        angle: number;
        scaleX: number;
        scaleY: number;
        skewX: number;
        skewY?: number;
        flipX?: boolean;
        flipY?: boolean;
    };
    Point: new (x: number, y: number) => FabricNS.Point;
}

function isFiniteMatrix(matrix: readonly number[]): matrix is number[] {
    return matrix.length === 6 && matrix.every((value) => Number.isFinite(value));
}

function hasReflection(matrix: readonly number[]): boolean {
    return isFiniteMatrix(matrix) && matrix[0]! * matrix[3]! - matrix[1]! * matrix[2]! < 0;
}

function stripReflection(matrix: number[], fabric: FabricUtilAccess): number[] {
    if (!hasReflection(matrix)) return matrix;
    const flipX = fabric.multiplyTransformMatrices(matrix, [-1, 0, 0, 1, 0, 0]);
    const flipY = fabric.multiplyTransformMatrices(matrix, [1, 0, 0, -1, 0, 0]);
    const angleMagnitude = (candidate: number[]): number => {
        const angle = fabric.qrDecompose(candidate).angle;
        return Number.isFinite(angle)
            ? Math.abs((((angle % 360) + 540) % 360) - 180)
            : Number.POSITIVE_INFINITY;
    };
    return angleMagnitude(flipY) < angleMagnitude(flipX) ? flipY : flipX;
}

export function applyAnnotationGeometry(
    object: FabricNS.FabricObject,
    mutation: GeometryMutationDescriptor,
    fabricModule: FabricModule,
    preserveReadable: boolean,
): void {
    if (mutation.kind !== 'transform') return;
    const delta = mutation.affineDelta as number[] | null;
    if (!delta || !isFiniteMatrix(delta)) return;
    const fabric: FabricUtilAccess = {
        multiplyTransformMatrices: (left, right) =>
            fabricModule.util.multiplyTransformMatrices(
                left as FabricNS.TMat2D,
                right as FabricNS.TMat2D,
            ) as number[],
        qrDecompose: (matrix) => fabricModule.util.qrDecompose(matrix as FabricNS.TMat2D),
        Point: fabricModule.Point,
    };
    object.setCoords();
    const previousOriginX = object.originX ?? 'left';
    const previousOriginY = object.originY ?? 'top';
    const originalCenter = object.getCenterPoint();
    const [a = 1, b = 0, c = 0, d = 1, e = 0, f = 0] = delta;
    const targetCenter = new fabric.Point(
        a * originalCenter.x + c * originalCenter.y + e,
        b * originalCenter.x + d * originalCenter.y + f,
    );
    const orientationDelta = preserveReadable ? stripReflection(delta, fabric) : delta;
    let restoreCenter = originalCenter;
    try {
        object.set({ originX: 'center', originY: 'center' });
        object.setPositionByOrigin(originalCenter, 'center', 'center');
        object.setCoords();
        const nextMatrix = fabric.multiplyTransformMatrices(
            orientationDelta,
            object.calcTransformMatrix() as number[],
        );
        if (!isFiniteMatrix(nextMatrix)) return;
        const decomposed = fabric.qrDecompose(nextMatrix);
        object.set({ flipX: false, flipY: false });
        object.set({
            angle: decomposed.angle,
            scaleX: decomposed.scaleX,
            scaleY: decomposed.scaleY,
            skewX: decomposed.skewX,
            skewY: decomposed.skewY ?? 0,
        });
        if (typeof decomposed.flipX === 'boolean' || typeof decomposed.flipY === 'boolean') {
            object.set({
                ...(typeof decomposed.flipX === 'boolean' ? { flipX: decomposed.flipX } : {}),
                ...(typeof decomposed.flipY === 'boolean' ? { flipY: decomposed.flipY } : {}),
            });
        }
        restoreCenter = targetCenter;
    } finally {
        object.set({ originX: previousOriginX, originY: previousOriginY });
        object.setPositionByOrigin(restoreCenter, 'center', 'center');
        object.setCoords();
    }
}
