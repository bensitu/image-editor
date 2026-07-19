/**
 * Captures and restores Overlay bounds in normalized image space for portable state.
 *
 * @module
 */

import type * as FabricNS from 'fabric';

import type { FabricModule } from '../../core/index.js';
import { applyDeltaToObject, type FabricUtilAccess } from './overlay-transform-delta.js';
import type { OverlayStateCodecContext, OverlayStatePoint } from './overlay-types.js';

export interface OverlayStateBoundsGeometry {
    readonly type: 'bounds';
    readonly corners: readonly [
        OverlayStatePoint,
        OverlayStatePoint,
        OverlayStatePoint,
        OverlayStatePoint,
    ];
}

function isFinitePoint(value: unknown): value is OverlayStatePoint {
    if (typeof value !== 'object' || value === null) return false;
    const point = value as Partial<OverlayStatePoint>;
    return Number.isFinite(point.x) && Number.isFinite(point.y);
}

export function isOverlayStateBoundsGeometry(value: unknown): value is OverlayStateBoundsGeometry {
    if (typeof value !== 'object' || value === null) return false;
    const geometry = value as Partial<OverlayStateBoundsGeometry>;
    return (
        geometry.type === 'bounds' &&
        Array.isArray(geometry.corners) &&
        geometry.corners.length === 4 &&
        geometry.corners.every(isFinitePoint)
    );
}

export function captureOverlayStateBounds(
    object: FabricNS.FabricObject,
    context: OverlayStateCodecContext,
): OverlayStateBoundsGeometry {
    object.setCoords();
    const corners = object.getCoords();
    if (corners.length !== 4) {
        throw new TypeError('Overlay State bounds require four object corners.');
    }
    return Object.freeze({
        type: 'bounds',
        corners: Object.freeze(
            corners.map((point) => Object.freeze(context.toImageNormalized(point))) as [
                OverlayStatePoint,
                OverlayStatePoint,
                OverlayStatePoint,
                OverlayStatePoint,
            ],
        ),
    });
}

function frameFromCorners(corners: readonly OverlayStatePoint[]): number[] {
    const [topLeft, topRight, , bottomLeft] = corners;
    return [
        topRight!.x - topLeft!.x,
        topRight!.y - topLeft!.y,
        bottomLeft!.x - topLeft!.x,
        bottomLeft!.y - topLeft!.y,
        topLeft!.x,
        topLeft!.y,
    ];
}

function cornersMatch(
    actual: readonly OverlayStatePoint[],
    expected: readonly OverlayStatePoint[],
    epsilon = 1e-6,
): boolean {
    return actual.every(
        (point, index) =>
            Math.abs(point.x - expected[index]!.x) <= epsilon &&
            Math.abs(point.y - expected[index]!.y) <= epsilon,
    );
}

export function restoreOverlayStateBounds(
    object: FabricNS.FabricObject,
    geometry: OverlayStateBoundsGeometry,
    context: OverlayStateCodecContext,
    fabric: FabricModule,
): void {
    if (!isOverlayStateBoundsGeometry(geometry)) {
        throw new TypeError('Overlay State bounds are malformed.');
    }
    const targetCorners = geometry.corners.map((point) => context.toCanvasPoint(point));
    const fabricUtil: FabricUtilAccess = {
        multiplyTransformMatrices: (left, right) =>
            fabric.util.multiplyTransformMatrices(
                left as FabricNS.TMat2D,
                right as FabricNS.TMat2D,
            ),
        invertTransform: (matrix) => fabric.util.invertTransform(matrix as FabricNS.TMat2D),
        qrDecompose: (matrix) => fabric.util.qrDecompose(matrix as FabricNS.TMat2D),
        Point: fabric.Point,
    };
    // Uniform strokes and path offsets are not scaled with the object transform.
    // Re-measure the rendered bounds so the persisted frame remains authoritative.
    for (let attempt = 0; attempt < 8; attempt += 1) {
        object.setCoords();
        const sourceCorners = object.getCoords();
        if (sourceCorners.length !== 4) {
            throw new TypeError('Overlay State bounds require four object corners.');
        }
        if (cornersMatch(sourceCorners, targetCorners)) return;
        const delta = fabricUtil.multiplyTransformMatrices(
            frameFromCorners(targetCorners),
            fabricUtil.invertTransform(frameFromCorners(sourceCorners)),
        );
        applyDeltaToObject(object, delta, { fabricUtil });
    }
    object.setCoords();
    if (!cornersMatch(object.getCoords(), targetCorners)) {
        throw new TypeError('Overlay State bounds could not be restored precisely.');
    }
}

export function objectPointToCanvas(
    object: FabricNS.FabricObject,
    point: OverlayStatePoint,
): OverlayStatePoint {
    const offset = (object as FabricNS.FabricObject & { pathOffset?: OverlayStatePoint })
        .pathOffset;
    const x = point.x - (offset?.x ?? 0);
    const y = point.y - (offset?.y ?? 0);
    const [a, b, c, d, e, f] = object.calcTransformMatrix() as number[];
    return Object.freeze({ x: a! * x + c! * y + e!, y: b! * x + d! * y + f! });
}
