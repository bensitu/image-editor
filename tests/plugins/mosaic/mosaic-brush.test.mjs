import assert from 'node:assert/strict';
import test from 'node:test';

import {
    applyCircularMosaic,
    getCircularDirtyRectangle,
    interpolateMosaicPoints,
    mergeDirtyRectangles,
} from '../../../src/plugins/mosaic/mosaic-brush.js';
import { writeMosaicDirtyRegion } from '../../../src/plugins/mosaic/mosaic-raster-cache.js';

function makeImageData(width, height) {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let index = 0; index < width * height; index += 1) {
        data[index * 4] = index;
        data[index * 4 + 1] = 255 - index;
        data[index * 4 + 2] = (index * 17) % 255;
        data[index * 4 + 3] = 255;
    }
    return { width, height, data };
}

test('circular Mosaic dirty rectangles clamp edges in natural pixels', () => {
    assert.deepEqual(
        getCircularDirtyRectangle({
            widthPx: 20,
            heightPx: 10,
            centerXPx: 1,
            centerYPx: 2,
            radiusPx: 4,
        }),
        { leftPx: 0, topPx: 0, widthPx: 6, heightPx: 7 },
    );
    assert.equal(
        getCircularDirtyRectangle({
            widthPx: 20,
            heightPx: 10,
            centerXPx: -20,
            centerYPx: -20,
            radiusPx: 2,
        }),
        null,
    );
});

test('dirty rectangles merge overlapping and separate strokes deterministically', () => {
    assert.deepEqual(
        mergeDirtyRectangles(
            { leftPx: 2, topPx: 3, widthPx: 5, heightPx: 4 },
            { leftPx: 10, topPx: 1, widthPx: 3, heightPx: 9 },
        ),
        { leftPx: 2, topPx: 1, widthPx: 11, heightPx: 9 },
    );
    assert.deepEqual(mergeDirtyRectangles(null, { leftPx: 1, topPx: 2, widthPx: 3, heightPx: 4 }), {
        leftPx: 1,
        topPx: 2,
        widthPx: 3,
        heightPx: 4,
    });
});

test('a full-boundary Mosaic brush remains clamped to the natural image', () => {
    assert.deepEqual(
        getCircularDirtyRectangle({
            widthPx: 20,
            heightPx: 10,
            centerXPx: 9.5,
            centerYPx: 4.5,
            radiusPx: 50,
        }),
        { leftPx: 0, topPx: 0, widthPx: 20, heightPx: 10 },
    );
});

test('Mosaic interpolation bounds gaps and pixelation changes only a circular region', () => {
    const points = interpolateMosaicPoints({ xPx: 2, yPx: 2 }, { xPx: 18, yPx: 2 }, 4);
    assert.ok(points.length > 1);
    assert.deepEqual(points.at(-1), { xPx: 18, yPx: 2 });
    const imageData = makeImageData(12, 8);
    const before = new Uint8ClampedArray(imageData.data);
    const dirty = applyCircularMosaic(imageData, {
        xPx: 1,
        yPx: 1,
        radiusPx: 3,
        blockSizePx: 2,
    });
    assert.deepEqual(dirty, { leftPx: 0, topPx: 0, widthPx: 5, heightPx: 5 });
    assert.notDeepEqual(imageData.data, before);
    const outsideOffset = (7 * imageData.width + 11) * 4;
    assert.deepEqual(
        [...imageData.data.slice(outsideOffset, outsideOffset + 4)],
        [...before.slice(outsideOffset, outsideOffset + 4)],
    );
});

test('preview writes only the supplied dirty region instead of the full image', () => {
    const calls = [];
    const context = {
        putImageData: (...args) => calls.push(args),
    };
    const imageData = makeImageData(100, 80);
    writeMosaicDirtyRegion(context, imageData, {
        leftPx: 12,
        topPx: 9,
        widthPx: 20,
        heightPx: 15,
    });
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].slice(1), [0, 0, 12, 9, 20, 15]);
});

test('large synthetic rasters process only the bounded Mosaic dirty region', () => {
    const imageData = makeImageData(1024, 768);
    const beforeCorner = [...imageData.data.slice(-4)];
    const dirty = applyCircularMosaic(imageData, {
        xPx: 512.5,
        yPx: 384.25,
        radiusPx: 12,
        blockSizePx: 4,
    });

    assert.deepEqual(dirty, {
        leftPx: 500,
        topPx: 372,
        widthPx: 26,
        heightPx: 26,
    });
    assert.ok(dirty.widthPx * dirty.heightPx < imageData.width * imageData.height);
    assert.deepEqual([...imageData.data.slice(-4)], beforeCorner);
});
