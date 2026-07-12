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
export declare function isFiniteTransformMatrix(matrix: number[]): boolean;
export declare function isApproximatelyIdentityTransform(matrix: number[], epsilon?: number): boolean;
export declare function computeImageTransformDelta(beforeMatrix: number[], afterMatrix: number[], fabricUtil: FabricUtilAccess): number[];
export declare function deltaHasReflection(delta: number[]): boolean;
export declare function transformPointByMatrix(point: FabricNS.Point, matrix: number[], fabricUtil: FabricUtilAccess): FabricNS.Point;
export declare function stripReflectionFromDelta(delta: number[], fabricUtil: FabricUtilAccess): number[];
export declare function applyDeltaToObject(object: FabricNS.FabricObject, fullDelta: number[], context: OverlayDeltaApplyContext): void;
