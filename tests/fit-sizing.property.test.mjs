/**
 * @file fit-sizing.property.test.mjs
 *
 * Type:
 *   Property test
 *
 * Purpose:
 *   Verifies src/image/layout-manager.ts computeFitLayout for arbitrary image and
 *   viewport dimensions. Fit should size the canvas from the visible workspace
 *   rather than the default configured canvas, then uniformly scale the image down
 *   so both displayed sides fit inside that canvas.
 *
 * Scope:
 *   - Canvas dimensions use visible viewport axes with configured options fallback.
 *   - Image scale is uniform and capped at 1.
 *   - Displayed image dimensions never exceed the computed canvas dimensions.
 *
 * Out of scope:
 *   - unrelated editor features
 *   - visual rendering quality
 *   - browser-specific integration details
 *
 * Environment:
 *   - Node.js ESM
 *   - fast-check generated cases where applicable
 *
 * Run:
 *   node --test tests/fit-sizing.property.test.mjs
 */

import { register } from 'node:module';

register('./helpers/ts-resolve-hook.mjs', import.meta.url);

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';

const { computeFitLayout } = await import('../src/image/layout-manager.ts');

const dimArb = fc.integer({ min: 1, max: 2000 });
const containerDimArb = fc.integer({ min: 0, max: 2000 });

const inputsArb = fc.record({
    imageWidth: dimArb,
    imageHeight: dimArb,
    optsCanvasWidth: dimArb,
    optsCanvasHeight: dimArb,
    container: fc.record({
        width: containerDimArb,
        height: containerDimArb,
    }),
});

const smallImageArb = fc
    .record({
        imageWidth: dimArb,
        imageHeight: dimArb,
        deltaWidth: fc.integer({ min: 1, max: 2000 }),
        deltaHeight: fc.integer({ min: 1, max: 2000 }),
        optsCanvasWidth: dimArb,
        optsCanvasHeight: dimArb,
    })
    .map((r) => ({
        imageWidth: r.imageWidth,
        imageHeight: r.imageHeight,
        optsCanvasWidth: r.optsCanvasWidth,
        optsCanvasHeight: r.optsCanvasHeight,
        container: {
            width: r.imageWidth + r.deltaWidth + 1,
            height: r.imageHeight + r.deltaHeight + 1,
        },
    }));

function expectedFit(input) {
    const canvasWidth = Math.max(1, (input.container.width || input.optsCanvasWidth) - 1);
    const canvasHeight = Math.max(1, (input.container.height || input.optsCanvasHeight) - 1);
    const imageScale = Math.min(
        canvasWidth / input.imageWidth,
        canvasHeight / input.imageHeight,
        1,
    );
    return { canvasWidth, canvasHeight, imageScale };
}

test('fit canvas uses visible viewport axes instead of clamping to configured defaults', () => {
    fc.assert(
        fc.property(inputsArb, (input) => {
            const out = computeFitLayout(
                input.imageWidth,
                input.imageHeight,
                input.optsCanvasWidth,
                input.optsCanvasHeight,
                input.container,
            );
            const expected = expectedFit(input);

            assert.equal(out.canvasWidth, expected.canvasWidth);
            assert.equal(out.canvasHeight, expected.canvasHeight);
            assert.equal(out.imageScale, expected.imageScale);
            assert.equal(out.baseImageScale, expected.imageScale);
            return true;
        }),
        { numRuns: 100 },
    );
});

test('fit displayed image dimensions stay inside the computed canvas', () => {
    fc.assert(
        fc.property(inputsArb, (input) => {
            const out = computeFitLayout(
                input.imageWidth,
                input.imageHeight,
                input.optsCanvasWidth,
                input.optsCanvasHeight,
                input.container,
            );
            assert.ok(input.imageWidth * out.imageScale <= out.canvasWidth + 1e-9);
            assert.ok(input.imageHeight * out.imageScale <= out.canvasHeight + 1e-9);
            assert.ok(out.imageScale <= 1, 'fit must not upscale above native image size');
            return true;
        }),
        { numRuns: 100 },
    );
});

test('fit scale remains 1 when the image is already smaller than the visible canvas', () => {
    fc.assert(
        fc.property(smallImageArb, (input) => {
            const out = computeFitLayout(
                input.imageWidth,
                input.imageHeight,
                input.optsCanvasWidth,
                input.optsCanvasHeight,
                input.container,
            );
            assert.equal(
                out.imageScale,
                1,
                `small image was upscaled for ${JSON.stringify(input)}`,
            );
            return true;
        }),
        { numRuns: 100 },
    );
});
