import assert from 'node:assert/strict';
import test from 'node:test';

import type * as FabricNS from 'fabric';

import {
    fitCropRectToAspectRatio,
    normalizeCropAspectRatio,
    normalizeCropRect,
} from '../../../src/plugins/crop/crop-geometry.js';
import { findCropOverlayCandidates } from '../../../src/plugins/crop/crop-overlay-policy.js';
import type { OverlayRuntimeApi } from '../../../src/foundations/overlay/index.js';

test('Crop aspect ratios preserve established free, preset, numeric, string, and object forms', () => {
    const cases = [
        ['free', null],
        [null, null],
        ['1:1', 1],
        ['3:4', 3 / 4],
        ['4:3', 4 / 3],
        ['3:2', 3 / 2],
        ['2:3', 2 / 3],
        ['9:16', 9 / 16],
        ['16:9', 16 / 9],
        ['10:7', 10 / 7],
        [10 / 7, 10 / 7],
        [{ width: 10, height: 7 }, 10 / 7],
    ];
    for (const [input, expected] of cases) {
        assert.equal(normalizeCropAspectRatio(input), expected);
    }
    for (const invalid of [0, -1, NaN, Infinity, '0:1', '1:0', 'bad', {}, { width: 2 }]) {
        assert.throws(() => normalizeCropAspectRatio(invalid), /aspect ratio/i);
    }
});

test('Crop rectangles use covering integer pixel bounds and reject unsafe input', () => {
    assert.deepEqual(
        normalizeCropRect(
            { leftPx: 2.8, topPx: 3.2, widthPx: 10.1, heightPx: 12.2 },
            { widthPx: 40, heightPx: 30, minimumWidthPx: 2, minimumHeightPx: 2 },
        ),
        { leftPx: 2, topPx: 3, widthPx: 11, heightPx: 13 },
    );
    for (const invalid of [
        null,
        {},
        { leftPx: -1, topPx: 0, widthPx: 4, heightPx: 4 },
        { leftPx: 0, topPx: 0, widthPx: 0, heightPx: 4 },
        { leftPx: 0, topPx: 0, widthPx: 50, heightPx: 4 },
        { leftPx: 0, topPx: 0, widthPx: Infinity, heightPx: 4 },
        { leftPx: 0, topPx: 0, widthPx: 4, heightPx: 4, extra: true },
    ]) {
        assert.throws(
            () =>
                normalizeCropRect(invalid, {
                    widthPx: 40,
                    heightPx: 30,
                    minimumWidthPx: 2,
                    minimumHeightPx: 2,
                }),
            /crop rect/i,
        );
    }
});

test('fixed-ratio fitting remains centered and bounded deterministically', () => {
    assert.deepEqual(
        fitCropRectToAspectRatio({ leftPx: 10, topPx: 10, widthPx: 280, heightPx: 180 }, 1, {
            widthPx: 300,
            heightPx: 200,
        }),
        { leftPx: 60, topPx: 10, widthPx: 180, heightPx: 180 },
    );
    const wide = fitCropRectToAspectRatio(
        { leftPx: 0, topPx: 0, widthPx: 80, heightPx: 40 },
        16 / 9,
        { widthPx: 80, heightPx: 40 },
    );
    assert.ok(wide.leftPx >= 0 && wide.topPx >= 0);
    assert.ok(wide.leftPx + wide.widthPx <= 80);
    assert.ok(wide.topPx + wide.heightPx <= 40);
    assert.ok(Math.abs(wide.widthPx / wide.heightPx - 16 / 9) < 0.05);

    assert.deepEqual(
        fitCropRectToAspectRatio({ leftPx: 0, topPx: 0, widthPx: 100, heightPx: 75 }, 4 / 3, {
            widthPx: 100,
            heightPx: 75,
        }),
        { leftPx: 0, topPx: 0, widthPx: 100, heightPx: 75 },
    );
});

test('Crop candidate selection excludes rotated bounding-box corners', () => {
    const diamond = [
        { x: 50, y: 0 },
        { x: 100, y: 50 },
        { x: 50, y: 100 },
        { x: 0, y: 50 },
    ];
    const corner = {
        getCoords: () => [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 },
            { x: 0, y: 10 },
        ],
    } as unknown as FabricNS.FabricObject;
    const center = {
        getCoords: () => [
            { x: 45, y: 45 },
            { x: 55, y: 45 },
            { x: 55, y: 55 },
            { x: 45, y: 55 },
        ],
    } as unknown as FabricNS.FabricObject;
    const preview = { getCoords: () => diamond } as unknown as FabricNS.FabricObject;
    const overlay = {
        list: () => [corner, center],
        classify: (object: FabricNS.FabricObject) => ({
            persistentId: object === corner ? 'corner' : 'center',
        }),
    } as unknown as OverlayRuntimeApi;

    assert.deepEqual(
        findCropOverlayCandidates(overlay, preview, { preview: 'keep', apply: 'keep' }),
        { allIds: ['corner', 'center'], intersectingIds: ['center'] },
    );
});
