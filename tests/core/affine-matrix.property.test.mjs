import assert from 'node:assert/strict';
import test from 'node:test';

import {
    IDENTITY_AFFINE_MATRIX,
    approximatelyEqualAffine,
    computeAffineDelta,
    hasAffineReflection,
    invertAffine,
    multiplyAffine,
    sanitizeAffineMatrix,
    transformRectBounds,
} from '../../src/core-runtime/geometry/index.js';

test('deterministic generated affine cases preserve multiply/invert identity', () => {
    for (let index = 1; index <= 200; index += 1) {
        const angle = (index * Math.PI) / 97;
        const scaleX = 0.25 + (index % 13) / 7;
        const scaleY = 0.3 + (index % 17) / 8;
        const cosine = Math.cos(angle);
        const sine = Math.sin(angle);
        const matrix = [
            cosine * scaleX,
            sine * scaleX,
            -sine * scaleY,
            cosine * scaleY,
            index - 100,
            100 - index / 2,
        ];
        const product = multiplyAffine(matrix, invertAffine(matrix));
        assert.equal(approximatelyEqualAffine(product, IDENTITY_AFFINE_MATRIX, 1e-8), true);
    }
});

test('double reflection produces identity and reflection detection is determinant-based', () => {
    const flipX = [-1, 0, 0, 1, 0, 0];
    assert.equal(hasAffineReflection(flipX), true);
    assert.deepEqual(multiplyAffine(flipX, flipX), IDENTITY_AFFINE_MATRIX);
    assert.equal(hasAffineReflection(multiplyAffine(flipX, flipX)), false);
});

test('delta is computed once from before to after and transformed bounds are finite', () => {
    const before = [1, 0, 0, 1, 10, 20];
    const after = [0, 2, -2, 0, 30, 40];
    const delta = computeAffineDelta(before, after);
    assert.equal(approximatelyEqualAffine(multiplyAffine(delta, before), after, 1e-9), true);
    assert.deepEqual(transformRectBounds(delta, { left: 0, top: 0, width: 10, height: 20 }), {
        left: 30,
        top: 20,
        width: 40,
        height: 20,
    });
});

test('sanitization clears numerical residue that would otherwise surface as skew noise', () => {
    assert.deepEqual(sanitizeAffineMatrix([1, 1e-14, -1e-14, 1, 0, -0]), [1, 0, 0, 1, 0, 0]);
});
