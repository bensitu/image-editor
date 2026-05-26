// Direct region export with floored dimensions
//
//   For any original image bounding rectangle with finite coordinates,
//   region export SHALL pass `left`, `top`, `width`, and `height`
//   directly to Fabric without creating an intermediate canvas, and
//   SHALL floor sub-pixel `width` and `height` values to integer
//   pixels.
//
// Owner modules: `src/export/export-service.ts`, `src/utils/canvas-region.ts`.
//
// Sub-properties exercised here:
//
//   23.1 Floored region forwarded to canvas.toDataURL
//:
//        For any sub-pixel bounding rect returned by
//        `originalImage.getBoundingRect()`, the values forwarded to
//        Fabric's `toDataURL({ left, top, width, height })` SHALL
//        match `floorRegion(getObjectBBox(originalImage))` field-for-
//        field, and each value SHALL be a non-negative integer.
//
//   23.2 No intermediate `<canvas>` element allocated
//:
//        For any sub-pixel bounding rect, the region export path
//        SHALL NOT call `document.createElement('canvas')` while
//        producing the data URL — the bytes come straight from the
//        live Fabric canvas's `toDataURL`. The path SHALL invoke
//        `toDataURL` exactly once on the live canvas.
//
// ─── Why a canvas mock instead of a live Fabric.Canvas ──────────────────────
//
// The export service interacts with the live canvas through exactly
// three methods this property cares about:
//
//   discardActiveObject()  — required by the documented contract ()
//   getObjects()           — read by the bake-in/restore bracket
//   toDataURL(options)     — the call site this property asserts
//
// Spinning up a real Fabric canvas would require jsdom plus async
// asset wiring without exercising any new branch inside the region-
// export path. Mirroring `tests/export-service.test.mjs` and
// `tests/active-selection-discard.property.test.mjs`, this test
// drives a small mock canvas and a fake `originalImage` whose
// `getBoundingRect()` returns a randomized sub-pixel rectangle.
//
// Runtime note: Node 24+ strips TypeScript syntax natively. The
// shared `helpers/ts-resolve-hook.mjs` rewrites `.js`-suffixed
// runtime imports to sibling `.ts` files so the test imports
// `export-service.ts` and `canvas-region.ts` directly via dynamic
// `import()` after the hook is registered.

import { register } from 'node:module';

register('./helpers/ts-resolve-hook.mjs', import.meta.url);

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';

const { exportImageBase64 } = await import('../src/export/export-service.ts');
const { floorRegion, getObjectBBox } = await import('../src/utils/canvas-region.ts');

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
            exportImageAreaByDefault: true,
        },
        fabric: {},
        isImageLoaded: () => true,
        getOriginalImage: () => image,
    };
}

// ─── Arbitraries ───────────────────────────────────────────────────────────

/**
 * Sub-pixel bounding rect. Bounds are chosen to cover three branches
 * of `floorRegion`:
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
const subPixelRectArb = fc.record({
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
});

// ─── — floored region forwarded to canvas.toDataURL ──────────

test('exportImageBase64 forwards floor(getObjectBBox(originalImage)) to canvas.toDataURL', async () => {
    await fc.assert(
        fc.asyncProperty(subPixelRectArb, async (rect) => {
            const canvas = makeMockCanvas();
            const image = makeFakeImage(rect);
            const ctx = makeContext(canvas, image);

            await exportImageBase64(ctx, { exportImageArea: true });

            // Exactly one render call — the data URL came straight
            // from `canvas.toDataURL`.
            assert.equal(
                canvas.toDataURLArgs.length,
                1,
                `expected exactly one toDataURL call, got ${canvas.toDataURLArgs.length}`,
            );

            const args = canvas.toDataURLArgs[0];
            const expected = floorRegion(getObjectBBox(image));

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
                `width ${args.width} !== floored ${expected.width} for rect ${JSON.stringify(rect)}`,
            );
            assert.equal(
                args.height,
                expected.height,
                `height ${args.height} !== floored ${expected.height} for rect ${JSON.stringify(rect)}`,
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
            // eslint-disable-next-line no-undef -- intentional global install
            globalThis.document = documentSpy;

            try {
                const canvas = makeMockCanvas();
                const image = makeFakeImage(rect);
                const ctx = makeContext(canvas, image);

                await exportImageBase64(ctx, { exportImageArea: true });

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
                    // eslint-disable-next-line no-undef -- restore prior value
                    globalThis.document = previousDocument;
                }
            }

            return true;
        }),
        { numRuns: 200 },
    );
});
