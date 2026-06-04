/**
 * @file direct-region-export.property.test.mjs
 *
 * Type:
 *   Property test
 *
 * Purpose:
 *   Verifies src/export/export-service.ts and src/utils/canvas-region.ts
 *   region-export behavior for arbitrary original-image bounding rectangles. The test
 *   confirms that export uses Fabric's toDataURL region options directly instead of
 *   allocating an intermediate canvas.
 *
 * Scope:
 *   - Sub-pixel bounding boxes are floored to integer region options.
 *   - The live canvas receives exactly one toDataURL call for the region export.
 *   - A small canvas mock is enough because the property only depends on discard,
 *     object lookup, and toDataURL forwarding.
 *
 * Out of scope:
 *   - visual pixel-quality comparison
 *   - browser download UI details
 *   - unrelated image loading behavior
 *
 * Environment:
 *   - Node.js ESM
 *   - fast-check generated cases where applicable
 *   - Fabric/canvas behavior is mocked where needed
 *
 * Run:
 *   node --test tests/direct-region-export.property.test.mjs
 *
 * Notes:
 *   - Prefer behavior-level assertions over implementation-detail checks.
 *   - Keep this file focused on direct region export with floored dimensions only.
 */

import { register } from 'node:module';

register('./helpers/ts-resolve-hook.mjs', import.meta.url);

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';

const { exportImageBase64 } = await import('../src/export/export-service.ts');
const { getClampedCanvasRegion, getObjectBBox, hasMeaningfulCanvasRegion } =
    await import('../src/utils/canvas-region.ts');

const MOCK_CANVAS_SIZE = 10000;

// ─── Test doubles ───────────────────────────────────────────────────────────

/**
 * Minimal stand-in for `fabric.Canvas`. Records every `toDataURL`
 * argument so the property can assert the floored region keys, and
 * returns an empty mask list so the bake-in/restore bracket inside
 * `withMaskStyleBackup` is a thin pass-through.
 */
function makeMockCanvas(stubDataUrl = 'data:image/jpeg;base64,AAAA') {
    const toDataURLArgs = [];
    return {
        toDataURLArgs,
        getWidth() {
            return MOCK_CANVAS_SIZE;
        },
        getHeight() {
            return MOCK_CANVAS_SIZE;
        },
        getObjects() {
            return [];
        },
        discardActiveObject() {
            return this;
        },
        toDataURL(options) {
            toDataURLArgs.push(options);
            return stubDataUrl;
        },
    };
}

/**
 * Build a fake `originalImage` whose `getBoundingRect()` returns the
 * configured rect verbatim. Mirrors Fabric.js v7 semantics where
 * `getBoundingRect()` reads a cached absolute rect that
 * `getObjectBBox` refreshes via `setCoords()` before reading. The
 * fake's `setCoords()` is a no-op so the rect we hand in is exactly
 * what the property test sees come back out.
 */
function makeFakeImage(rect) {
    return {
        angle: 45,
        setCoords() {
            /* no-op — the rect is already "fresh" */
        },
        getBoundingRect() {
            return { ...rect };
        },
    };
}

function makeContext(canvas, image) {
    return {
        canvas,
        options: {
            defaultDownloadFileName: 'edited_image.jpg',
            downsampleQuality: 0.92,
            exportMultiplier: 1,
            exportAreaByDefault: 'image',
            mergeMaskByDefault: true,
        },
        fabric: {},
        isImageLoaded: () => true,
        getOriginalImage: () => image,
    };
}

// ─── Arbitraries ───────────────────────────────────────────────────────────

/**
 * Sub-pixel bounding rect. Bounds are chosen to cover three branches
 * of `floorRegion`, then filtered to meaningful overlap with the mock
 * canvas because public export now rejects logically empty image regions
 * instead of silently converting them to 1x1 output:
 *
 *   - `left`/`top` may be negative (clamped to `0`).
 *   - `left`/`top` may land on a half-pixel (floored down).
 *   - `width`/`height` may be sub-pixel (rounded then `Math.max(1, …)`).
 *
 * Finite-only doubles keep the property focused on the documented
 * "finite coordinates" precondition from the documented contract (`*For any*
 * original image bounding rectangle with finite coordinates`); the
 * defensive `NaN`/`Infinity` fallback inside `floorRegion` is
 * exercised by direct-helper unit coverage and is not the subject of
 * this property.
 */
const subPixelRectArb = fc
    .record({
        left: fc.double({
            min: -100,
            max: 5000,
            noNaN: true,
            noDefaultInfinity: true,
        }),
        top: fc.double({
            min: -100,
            max: 5000,
            noNaN: true,
            noDefaultInfinity: true,
        }),
        width: fc.double({
            min: Math.fround(0.001),
            max: 5000,
            noNaN: true,
            noDefaultInfinity: true,
        }),
        height: fc.double({
            min: Math.fround(0.001),
            max: 5000,
            noNaN: true,
            noDefaultInfinity: true,
        }),
    })
    .filter((rect) => hasMeaningfulCanvasRegion(rect, MOCK_CANVAS_SIZE, MOCK_CANVAS_SIZE));

// ─── — floored region forwarded to canvas.toDataURL ──────────

test('exportImageBase64 forwards floor(getObjectBBox(originalImage)) to canvas.toDataURL', async () => {
    await fc.assert(
        fc.asyncProperty(subPixelRectArb, async (rect) => {
            const canvas = makeMockCanvas();
            const image = makeFakeImage(rect);
            const ctx = makeContext(canvas, image);

            await exportImageBase64(ctx, {
                exportArea: 'image',
                mergeMask: true,
                fileType: 'png',
            });

            // Exactly one render call — the data URL came straight
            // from `canvas.toDataURL`.
            assert.equal(
                canvas.toDataURLArgs.length,
                1,
                `expected exactly one toDataURL call, got ${canvas.toDataURLArgs.length}`,
            );

            const args = canvas.toDataURLArgs[0];
            const expected = getClampedCanvasRegion(
                getObjectBBox(image),
                canvas.getWidth(),
                canvas.getHeight(),
                { includePartialPixels: true },
            );

            // the documented contract — region keys are derived from the
            // image bounding rect and forwarded to Fabric.
            assert.equal(
                args.left,
                expected.left,
                `left ${args.left} !== floored ${expected.left} for rect ${JSON.stringify(rect)}`,
            );
            assert.equal(
                args.top,
                expected.top,
                `top ${args.top} !== floored ${expected.top} for rect ${JSON.stringify(rect)}`,
            );
            assert.equal(
                args.width,
                expected.width,
                `width ${args.width} !== clamped ${expected.width} for rect ${JSON.stringify(rect)}`,
            );
            assert.equal(
                args.height,
                expected.height,
                `height ${args.height} !== clamped ${expected.height} for rect ${JSON.stringify(rect)}`,
            );

            // the documented contract — every region key is a non-negative
            // integer once it reaches Fabric, regardless of how
            // sub-pixel the source rect was.
            assert.ok(
                Number.isInteger(args.left),
                `left must be integer, got ${args.left} for rect ${JSON.stringify(rect)}`,
            );
            assert.ok(
                Number.isInteger(args.top),
                `top must be integer, got ${args.top} for rect ${JSON.stringify(rect)}`,
            );
            assert.ok(
                Number.isInteger(args.width),
                `width must be integer, got ${args.width} for rect ${JSON.stringify(rect)}`,
            );
            assert.ok(
                Number.isInteger(args.height),
                `height must be integer, got ${args.height} for rect ${JSON.stringify(rect)}`,
            );
            assert.ok(
                args.left >= 0 && args.top >= 0,
                `left/top must be >= 0, got (${args.left}, ${args.top}) for rect ${JSON.stringify(rect)}`,
            );
            assert.ok(
                args.width >= 1 && args.height >= 1,
                `width/height must be >= 1 (no zero-sized region), got (${args.width}, ${args.height}) for rect ${JSON.stringify(rect)}`,
            );

            return true;
        }),
        { numRuns: 200 },
    );
});

// ─── — no intermediate <canvas> element allocated ────────────

test('exportImageBase64 region path does not allocate an intermediate <canvas> element', async () => {
    await fc.assert(
        fc.asyncProperty(subPixelRectArb, async (rect) => {
            // Install a `document.createElement` spy that records the
            // tag of every element the export path tried to allocate.
            // The region-export call site goes straight to Fabric's
            // `canvas.toDataURL`, so the spy must
            // never see a `'canvas'` tag for this property.
            //
            // The Node `node:test` runner does not expose a global
            // `document`, so the spy is installed on `globalThis`
            // and uninstalled in a `finally` block to keep the test
            // hermetic.
            const createdTags = [];
            const previousDocument = globalThis.document;
            const documentSpy = {
                createElement(tag) {
                    createdTags.push(String(tag).toLowerCase());
                    return {};
                },
            };
            globalThis.document = documentSpy;

            try {
                const canvas = makeMockCanvas();
                const image = makeFakeImage(rect);
                const ctx = makeContext(canvas, image);

                await exportImageBase64(ctx, {
                    exportArea: 'image',
                    mergeMask: true,
                    fileType: 'png',
                });

                // the documented contract — no intermediate `<canvas>` is
                // allocated while computing the region export.
                assert.ok(
                    !createdTags.includes('canvas'),
                    `region export must not allocate a <canvas> element; createElement tags = ${JSON.stringify(createdTags)} for rect ${JSON.stringify(rect)}`,
                );
                // Reinforces 27.2 — the data URL came from Fabric in
                // a single call rather than re-rendered through an
                // offscreen canvas.
                assert.equal(
                    canvas.toDataURLArgs.length,
                    1,
                    `expected exactly one toDataURL call on the live canvas, got ${canvas.toDataURLArgs.length} for rect ${JSON.stringify(rect)}`,
                );
            } finally {
                if (previousDocument === undefined) {
                    delete globalThis.document;
                } else {
                    globalThis.document = previousDocument;
                }
            }

            return true;
        }),
        { numRuns: 200 },
    );
});

test('getClampedCanvasRegion includes export partial pixels but excludes crop trailing pixels', () => {
    const rect = { left: 0, top: 0, width: 39.5, height: 59.5 };
    assert.deepEqual(getClampedCanvasRegion(rect, 120, 80, { includePartialPixels: true }), {
        left: 0,
        top: 0,
        width: 40,
        height: 60,
    });
    assert.deepEqual(getClampedCanvasRegion(rect, 120, 80, { includePartialPixels: false }), {
        left: 0,
        top: 0,
        width: 39,
        height: 59,
    });
});
