import { GeometryMutationError } from '../errors.js';
export const IDENTITY_AFFINE_MATRIX = Object.freeze([1, 0, 0, 1, 0, 0]);
export const AFFINE_EPSILON = 1e-10;
export function isFiniteAffineMatrix(value) {
    return (Array.isArray(value) &&
        value.length === 6 &&
        value.every((entry) => typeof entry === 'number' && Number.isFinite(entry)));
}
export function assertAffineMatrix(value, label = 'matrix') {
    if (!isFiniteAffineMatrix(value)) {
        throw new GeometryMutationError('affine', `${label} must contain six finite numbers.`);
    }
}
export function affineDeterminant(matrix) {
    return matrix[0] * matrix[3] - matrix[1] * matrix[2];
}
export function hasAffineReflection(matrix) {
    return affineDeterminant(matrix) < 0;
}
export function multiplyAffine(left, right) {
    const [a1, b1, c1, d1, e1, f1] = left;
    const [a2, b2, c2, d2, e2, f2] = right;
    return Object.freeze([
        a1 * a2 + c1 * b2,
        b1 * a2 + d1 * b2,
        a1 * c2 + c1 * d2,
        b1 * c2 + d1 * d2,
        a1 * e2 + c1 * f2 + e1,
        b1 * e2 + d1 * f2 + f1,
    ]);
}
export function invertAffine(matrix, epsilon = AFFINE_EPSILON) {
    const [a, b, c, d, e, f] = matrix;
    const determinant = affineDeterminant(matrix);
    if (!Number.isFinite(determinant) || Math.abs(determinant) <= epsilon) {
        throw new GeometryMutationError('affine', 'matrix is singular and cannot be inverted.');
    }
    return Object.freeze([
        d / determinant,
        -b / determinant,
        -c / determinant,
        a / determinant,
        (c * f - d * e) / determinant,
        (b * e - a * f) / determinant,
    ]);
}
export function applyAffineToPoint(matrix, point) {
    return Object.freeze({
        x: matrix[0] * point.x + matrix[2] * point.y + matrix[4],
        y: matrix[1] * point.x + matrix[3] * point.y + matrix[5],
    });
}
export function transformRectBounds(matrix, rect) {
    const points = [
        applyAffineToPoint(matrix, { x: rect.left, y: rect.top }),
        applyAffineToPoint(matrix, { x: rect.left + rect.width, y: rect.top }),
        applyAffineToPoint(matrix, { x: rect.left, y: rect.top + rect.height }),
        applyAffineToPoint(matrix, {
            x: rect.left + rect.width,
            y: rect.top + rect.height,
        }),
    ];
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    const left = Math.min(...xs);
    const top = Math.min(...ys);
    return Object.freeze({
        left,
        top,
        width: Math.max(...xs) - left,
        height: Math.max(...ys) - top,
    });
}
export function approximatelyEqualAffine(left, right, epsilon = AFFINE_EPSILON) {
    return left.every((entry, index) => Math.abs(entry - right[index]) <= epsilon);
}
export function sanitizeAffineMatrix(matrix, epsilon = AFFINE_EPSILON) {
    return Object.freeze(matrix.map((entry) => (Math.abs(entry) <= epsilon ? 0 : entry)));
}
export function computeAffineDelta(before, after) {
    return sanitizeAffineMatrix(multiplyAffine(after, invertAffine(before)));
}
//# sourceMappingURL=affine-matrix.js.map