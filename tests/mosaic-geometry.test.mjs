import { register } from 'node:module';

register('./helpers/ts-resolve-hook.mjs', import.meta.url);

import { test } from 'node:test';
import assert from 'node:assert/strict';

const { getMosaicImagePoint } = await import('../src/mosaic/mosaic-geometry.ts');

function makeImage({ width = 100, height = 50, matrix }) {
    return {
        width,
        height,
        calcTransformMatrix() {
            return matrix;
        },
    };
}

function rotationMatrix(angleDegrees, centerX, centerY, scale = 1) {
    const radians = (angleDegrees * Math.PI) / 180;
    const cos = Math.cos(radians) * scale;
    const sin = Math.sin(radians) * scale;
    return [cos, sin, -sin, cos, centerX, centerY];
}

test('untransformed image pointer at visual center maps to source center', () => {
    const image = makeImage({ matrix: [1, 0, 0, 1, 50, 25] });

    const point = getMosaicImagePoint({}, image, { x: 50, y: 25 }, 20);

    assert.deepEqual(
        { sourceX: point.sourceX, sourceY: point.sourceY, sourceRadius: point.sourceRadius },
        { sourceX: 50, sourceY: 25, sourceRadius: 10 },
    );
});

test('translated image offset is handled', () => {
    const image = makeImage({ matrix: [1, 0, 0, 1, 90, 65] });

    const point = getMosaicImagePoint({}, image, { x: 90, y: 65 }, 20);

    assert.equal(point.sourceX, 50);
    assert.equal(point.sourceY, 25);
});

test('scaled image pointer maps back to source coordinates and radius', () => {
    const image = makeImage({ matrix: [2, 0, 0, 2, 100, 50] });

    const point = getMosaicImagePoint({}, image, { x: 50, y: 20 }, 40);

    assert.equal(point.sourceX, 25);
    assert.equal(point.sourceY, 10);
    assert.equal(point.sourceRadius, 10);
});

test('rotated image uses inverse transform instead of bounding box hit testing', () => {
    const image = makeImage({ matrix: rotationMatrix(90, 100, 100) });

    const point = getMosaicImagePoint({}, image, { x: 100, y: 100 }, 20);

    assert.ok(Math.abs(point.sourceX - 50) < 1e-9);
    assert.ok(Math.abs(point.sourceY - 25) < 1e-9);
});

test('pointer outside image source bounds returns null', () => {
    const image = makeImage({ matrix: [1, 0, 0, 1, 50, 25] });

    const point = getMosaicImagePoint({}, image, { x: 160, y: 25 }, 20);

    assert.equal(point, null);
});

test('near-singular transform matrices are rejected', () => {
    const image = makeImage({ matrix: [1e-10, 0, 0, 1, 50, 25] });

    const point = getMosaicImagePoint({}, image, { x: 50, y: 25 }, 20);

    assert.equal(point, null);
});

test('non-uniform scale uses conservative larger source radius', () => {
    const image = makeImage({ matrix: [2, 0, 0, 4, 100, 100] });

    const point = getMosaicImagePoint({}, image, { x: 100, y: 100 }, 40);

    assert.equal(point.sourceRadius, 10);
});
