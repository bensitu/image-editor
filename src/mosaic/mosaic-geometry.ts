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

interface Matrix2D {
    a: number;
    b: number;
    c: number;
    d: number;
    e: number;
    f: number;
}

const MATRIX_DETERMINANT_EPSILON = 1e-8;
const MATRIX_SCALE_EPSILON = 1e-8;

function toMatrix2D(matrix: number[]): Matrix2D | null {
    if (matrix.length < 6) return null;
    const a = matrix[0];
    const b = matrix[1];
    const c = matrix[2];
    const d = matrix[3];
    const e = matrix[4];
    const f = matrix[5];
    if (
        !Number.isFinite(a) ||
        !Number.isFinite(b) ||
        !Number.isFinite(c) ||
        !Number.isFinite(d) ||
        !Number.isFinite(e) ||
        !Number.isFinite(f)
    ) {
        return null;
    }
    return { a: a!, b: b!, c: c!, d: d!, e: e!, f: f! };
}

function invertMatrix(matrix: Matrix2D): Matrix2D | null {
    const determinant = matrix.a * matrix.d - matrix.b * matrix.c;
    if (!Number.isFinite(determinant) || Math.abs(determinant) < MATRIX_DETERMINANT_EPSILON) {
        return null;
    }

    return {
        a: matrix.d / determinant,
        b: -matrix.b / determinant,
        c: -matrix.c / determinant,
        d: matrix.a / determinant,
        e: (matrix.c * matrix.f - matrix.d * matrix.e) / determinant,
        f: (matrix.b * matrix.e - matrix.a * matrix.f) / determinant,
    };
}

function transformPoint(
    point: { x: number; y: number },
    matrix: Matrix2D,
): { x: number; y: number } {
    return {
        x: matrix.a * point.x + matrix.c * point.y + matrix.e,
        y: matrix.b * point.x + matrix.d * point.y + matrix.f,
    };
}

function getSourceRadiusFromMatrix(matrix: Matrix2D, canvasRadius: number): number {
    const scaleX = Math.hypot(matrix.a, matrix.b);
    const scaleY = Math.hypot(matrix.c, matrix.d);
    const minScale = Math.min(
        scaleX > MATRIX_SCALE_EPSILON ? scaleX : Number.POSITIVE_INFINITY,
        scaleY > MATRIX_SCALE_EPSILON ? scaleY : Number.POSITIVE_INFINITY,
    );
    if (!Number.isFinite(minScale) || minScale <= 0) return canvasRadius;
    return canvasRadius / minScale;
}

/**
 * Convert a Fabric canvas pointer into source-image pixels.
 *
 * For non-uniform image scale, `sourceRadius` uses the smaller canvas scale
 * axis, which yields the larger source-space radius. This conservative
 * deterministic strategy ensures the circular canvas brush covers the clicked
 * image area after inverse transformation.
 */
export function getMosaicImagePoint(
    fabric: FabricModule,
    image: FabricNS.FabricImage,
    canvasPoint: { x: number; y: number },
    brushDiameterCanvasPx: number,
): MosaicImagePoint | null {
    void fabric;

    const width = Number(image.width) || 0;
    const height = Number(image.height) || 0;
    const brushDiameter = Number(brushDiameterCanvasPx);
    if (
        width <= 0 ||
        height <= 0 ||
        !Number.isFinite(canvasPoint.x) ||
        !Number.isFinite(canvasPoint.y) ||
        !Number.isFinite(brushDiameter) ||
        brushDiameter <= 0
    ) {
        return null;
    }

    const matrix = toMatrix2D(image.calcTransformMatrix() as number[]);
    if (!matrix) return null;
    const inverse = invertMatrix(matrix);
    if (!inverse) return null;

    const localPoint = transformPoint(canvasPoint, inverse);
    const sourceX = localPoint.x + width / 2;
    const sourceY = localPoint.y + height / 2;

    if (sourceX < 0 || sourceY < 0 || sourceX > width || sourceY > height) {
        return null;
    }

    return {
        sourceX,
        sourceY,
        sourceRadius: getSourceRadiusFromMatrix(matrix, brushDiameter / 2),
    };
}
