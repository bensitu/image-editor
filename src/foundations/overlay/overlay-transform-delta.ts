import type * as FabricNS from 'fabric';

export interface FabricUtilAccess {
    multiplyTransformMatrices(left: number[], right: number[]): number[];
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

export interface OverlayDeltaApplyContext {
    readonly fabricUtil: FabricUtilAccess;
    readonly preserveReadableText?: boolean;
}

export function isFiniteTransformMatrix(matrix: number[]): boolean {
    return matrix.length === 6 && matrix.every((value) => Number.isFinite(value));
}

export function isApproximatelyIdentityTransform(matrix: number[], epsilon = 1e-10): boolean {
    const identity = [1, 0, 0, 1, 0, 0];
    return (
        matrix.length === identity.length &&
        matrix.every((value, index) => Math.abs(value - identity[index]!) <= epsilon)
    );
}

export function computeImageTransformDelta(
    beforeMatrix: number[],
    afterMatrix: number[],
    fabricUtil: FabricUtilAccess,
): number[] {
    if (!isFiniteTransformMatrix(beforeMatrix) || !isFiniteTransformMatrix(afterMatrix)) return [];
    return fabricUtil.multiplyTransformMatrices(
        afterMatrix,
        fabricUtil.invertTransform(beforeMatrix),
    );
}

export function deltaHasReflection(delta: number[]): boolean {
    if (!isFiniteTransformMatrix(delta)) return false;
    const [a, b, c, d] = delta;
    return a! * d! - b! * c! < 0;
}

export function transformPointByMatrix(
    point: FabricNS.Point,
    matrix: number[],
    fabricUtil: FabricUtilAccess,
): FabricNS.Point {
    const [a, b, c, d, e, f] = matrix;
    return new fabricUtil.Point(a! * point.x + c! * point.y + e!, b! * point.x + d! * point.y + f!);
}

export function stripReflectionFromDelta(delta: number[], fabricUtil: FabricUtilAccess): number[] {
    if (!deltaHasReflection(delta)) return delta;
    const flipXCandidate = fabricUtil.multiplyTransformMatrices(delta, [-1, 0, 0, 1, 0, 0]);
    const flipYCandidate = fabricUtil.multiplyTransformMatrices(delta, [1, 0, 0, -1, 0, 0]);
    const normalizedAngleMagnitude = (matrix: number[]): number => {
        try {
            const angle = fabricUtil.qrDecompose(matrix).angle;
            return Number.isFinite(angle)
                ? Math.abs((((angle % 360) + 540) % 360) - 180)
                : Number.POSITIVE_INFINITY;
        } catch {
            return Number.POSITIVE_INFINITY;
        }
    };
    return normalizedAngleMagnitude(flipYCandidate) < normalizedAngleMagnitude(flipXCandidate)
        ? flipYCandidate
        : flipXCandidate;
}

export function applyDeltaToObject(
    object: FabricNS.FabricObject,
    fullDelta: number[],
    context: OverlayDeltaApplyContext,
): void {
    if (!isFiniteTransformMatrix(fullDelta) || isApproximatelyIdentityTransform(fullDelta)) return;
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
        object.set({ originX: 'center', originY: 'center' });
        object.setPositionByOrigin(originalCenter, 'center', 'center');
        object.setCoords();
        const nextMatrix = fabricUtil.multiplyTransformMatrices(
            orientationDelta,
            object.calcTransformMatrix() as number[],
        );
        if (!isFiniteTransformMatrix(nextMatrix)) return;
        const decomposed = fabricUtil.qrDecompose(nextMatrix);
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
