/**
 * Type:
 *   Unit test
 *
 * Purpose:
 *   Verifies the renderer-independent coordinate helpers used by overlay
 *   persistence.
 *
 * Run:
 *   node --test tests/overlay-coordinate-transform.test.mjs
 */

import { register } from 'node:module';

register('./helpers/ts-resolve-hook.mjs', import.meta.url);

import { test } from 'node:test';
import assert from 'node:assert/strict';

const {
    applyBaseImageTransform,
    canvasToSourcePixel,
    imageNormalizedToSourcePixel,
    sourcePixelToCanvas,
    sourcePixelToImageNormalized,
    unapplyBaseImageTransform,
} = await import('../src/overlay/overlay-coordinate-transform.ts');

const image = { naturalWidth: 100, naturalHeight: 80 };

test('normalized and source pixel conversions round-trip', () => {
    const normalized = { x: 0.25, y: 0.4 };
    const source = imageNormalizedToSourcePixel(normalized, image);

    assert.deepEqual(source, { x: 25, y: 32 });
    assert.deepEqual(sourcePixelToImageNormalized(source, image), normalized);
});

test('base transform order is flipX then flipY then rotation', () => {
    const point = { x: 20, y: 10 };
    const transformed = applyBaseImageTransform(point, image, {
        flipX: true,
        flipY: true,
        rotation: 90,
    });

    assert.equal(Math.round(transformed.x), 20);
    assert.equal(Math.round(transformed.y), 70);
});

test('base transform can be unapplied exactly enough for persisted overlays', () => {
    const point = { x: 12.5, y: 63.25 };
    const transform = { flipX: true, rotation: 37 };
    const transformed = applyBaseImageTransform(point, image, transform);
    const restored = unapplyBaseImageTransform(transformed, image, transform);

    assert.ok(Math.abs(restored.x - point.x) < 1e-9);
    assert.ok(Math.abs(restored.y - point.y) < 1e-9);
});

test('source and canvas conversion round-trip through current image geometry', () => {
    const geometry = {
        naturalWidth: 100,
        naturalHeight: 80,
        canvasCenterX: 240,
        canvasCenterY: 180,
        scaleX: 2,
        scaleY: 2,
        transform: { flipX: true, rotation: 15 },
    };
    const point = { x: 30, y: 20 };
    const canvas = sourcePixelToCanvas(point, geometry);
    const source = canvasToSourcePixel(canvas, geometry);

    assert.ok(Math.abs(source.x - point.x) < 1e-9);
    assert.ok(Math.abs(source.y - point.y) < 1e-9);
});
