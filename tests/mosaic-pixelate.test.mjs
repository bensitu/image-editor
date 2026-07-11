/**
 * Type:
 *   Unit test
 *
 * Purpose:
 *   Verifies the circular Mosaic pixelation algorithm mutates only intended
 *   source pixels and handles boundary inputs safely.
 *
 * Scope:
 *   - Pixels inside the circular brush region are sampled into mosaic blocks.
 *   - Pixels outside the brush region remain unchanged.
 *   - Brushes partially outside image bounds are clipped safely.
 *   - Block size and alpha edge cases are handled without throwing.
 *
 * Out of scope:
 *   - canvas event handling
 *   - ImageEditor mode lifecycle
 *   - undo/redo integration
 *
 * Environment:
 *   - Node.js ESM
 *   - ImageData-like typed array fixtures
 *
 * Run:
 *   node --test tests/mosaic-pixelate.test.mjs
 */

import { register } from 'node:module';

register('./helpers/ts-resolve-hook.mjs', import.meta.url);

import { test } from 'node:test';
import assert from 'node:assert/strict';

const { applyCircularMosaicToImageData, getCircularMosaicBounds } =
    await import('../src/mosaic/mosaic-pixelate.ts');

test('circular Mosaic bounds clip to the image and reject empty intersections', () => {
    assert.deepEqual(
        getCircularMosaicBounds({
            width: 10,
            height: 8,
            centerX: 1.2,
            centerY: 6.5,
            radius: 3,
        }),
        { minX: 0, minY: 3, maxX: 5, maxY: 7 },
    );
    assert.equal(
        getCircularMosaicBounds({
            width: 10,
            height: 8,
            centerX: 20,
            centerY: 20,
            radius: 2,
        }),
        null,
    );
});

function makeImageData(width, height) {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            const offset = (y * width + x) * 4;
            data[offset] = x * 20;
            data[offset + 1] = y * 20;
            data[offset + 2] = x + y;
            data[offset + 3] = 50 + x + y;
        }
    }
    return { width, height, data };
}

function pixel(imageData, x, y) {
    const offset = (y * imageData.width + x) * 4;
    return Array.from(imageData.data.slice(offset, offset + 4));
}

test('pixelates only inside the circular region and leaves outside pixels unchanged', () => {
    const imageData = makeImageData(8, 8);
    const beforeCorner = pixel(imageData, 0, 0);
    const beforeInside = pixel(imageData, 5, 5);

    const changed = applyCircularMosaicToImageData({
        imageData,
        centerX: 4,
        centerY: 4,
        radius: 3,
        blockSize: 3,
    });

    assert.equal(changed, true);
    assert.deepEqual(pixel(imageData, 0, 0), beforeCorner);
    assert.notDeepEqual(pixel(imageData, 5, 5), beforeInside);
});

test('handles a brush partially outside image bounds', () => {
    const imageData = makeImageData(4, 4);

    assert.equal(
        applyCircularMosaicToImageData({
            imageData,
            centerX: -1,
            centerY: 1,
            radius: 3,
            blockSize: 2,
        }),
        true,
    );
});

test('blockSize 1 processes pixels without throwing', () => {
    const imageData = makeImageData(3, 3);
    const before = Array.from(imageData.data);

    const changed = applyCircularMosaicToImageData({
        imageData,
        centerX: 1,
        centerY: 1,
        radius: 2,
        blockSize: 1,
    });

    assert.equal(changed, true);
    assert.deepEqual(Array.from(imageData.data), before);
});

test('block size larger than region still applies a sampled block color', () => {
    const imageData = makeImageData(5, 5);

    const changed = applyCircularMosaicToImageData({
        imageData,
        centerX: 2,
        centerY: 2,
        radius: 2,
        blockSize: 20,
    });

    assert.equal(changed, true);
    assert.deepEqual(pixel(imageData, 2, 2), pixel(imageData, 0, 2));
});

test('preserves sampled alpha instead of forcing opaque pixels', () => {
    const imageData = makeImageData(4, 4);

    applyCircularMosaicToImageData({
        imageData,
        centerX: 1,
        centerY: 1,
        radius: 2,
        blockSize: 2,
    });

    assert.equal(pixel(imageData, 1, 1)[3], pixel(imageData, 0, 0)[3]);
    assert.notEqual(pixel(imageData, 1, 1)[3], 255);
});

test('returns false for completely outside or invalid regions', () => {
    const imageData = makeImageData(3, 3);

    assert.equal(
        applyCircularMosaicToImageData({
            imageData,
            centerX: 100,
            centerY: 100,
            radius: 2,
            blockSize: 2,
        }),
        false,
    );
    assert.equal(
        applyCircularMosaicToImageData({
            imageData,
            centerX: 1,
            centerY: 1,
            radius: 0,
            blockSize: 2,
        }),
        false,
    );
});

test('does not throw for tiny images', () => {
    const imageData = makeImageData(1, 1);

    assert.doesNotThrow(() =>
        applyCircularMosaicToImageData({
            imageData,
            centerX: 0,
            centerY: 0,
            radius: 10,
            blockSize: 5,
        }),
    );
});
