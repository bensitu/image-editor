/**
 * Type:
 *   Property test
 *
 * Purpose:
 *   Verifies src/image/layout-manager.ts computeExpandLayout for arbitrary image and
 *   viewport sizes. The expand path should size the canvas to the larger of visible
 *   viewport and image dimensions while leaving image scale at one.
 *
 * Scope:
 *   - Canvas width and height use max(viewport axis, floored image axis).
 *   - baseImageScale and imageScale remain fixed at 1.
 *   - The image origin stays at the top-left of the expanded canvas.
 *
 * Out of scope:
 *   - unrelated editor features
 *   - visual rendering quality
 *   - browser-specific integration details
 *
 * Environment:
 *   - Node.js ESM
 *   - fast-check generated cases where applicable
 *   - Fabric/canvas behavior is mocked where needed
 *
 * Run:
 *   node --test tests/expand-sizing.property.test.mjs
 *
 * Notes:
 *   - Prefer behavior-level assertions over implementation-detail checks.
 *   - Keep this file focused on expand layout sizing math only.
 */

import { register } from 'node:module';

register('./helpers/ts-resolve-hook.mjs', import.meta.url);

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';

const { computeExpandLayout } = await import('../src/image/layout-manager.ts');

// ─── Arbitraries ───────────────────────────────────────────────────────────

// Bounded positive integers mirror the dimensions a real browser
// viewport can carry (1..2000 px). The lower bound of 1 keeps every
// `floor` operation finite and well-defined for the image axes.
// Container axes may be zero — the expand path falls back to the
// image dimension on a zero viewport axis via `Math.max`.
const dimArb = fc.integer({ min: 1, max: 2000 });
const containerDimArb = fc.integer({ min: 0, max: 2000 });

const containerArb = fc.record({
    width: containerDimArb,
    height: containerDimArb,
});

const inputsArb = fc.record({
    imageWidth: dimArb,
    imageHeight: dimArb,
    optsCanvasWidth: dimArb,
    optsCanvasHeight: dimArb,
    container: containerArb,
});

// ─── per-axis max(viewport, image) ───────────────────────────

test('canvas dimensions equal max(viewport, floor(image)) per axis', () => {
    fc.assert(
        fc.property(inputsArb, (input) => {
            const out = computeExpandLayout(
                input.imageWidth,
                input.imageHeight,
                input.optsCanvasWidth,
                input.optsCanvasHeight,
                input.container,
            );
            const expectedW = Math.max(input.container.width, Math.floor(input.imageWidth));
            const expectedH = Math.max(input.container.height, Math.floor(input.imageHeight));
            assert.equal(
                out.canvasWidth,
                expectedW,
                `canvasWidth mismatch for ${JSON.stringify({
                    imageWidth: input.imageWidth,
                    container: input.container,
                })}`,
            );
            assert.equal(
                out.canvasHeight,
                expectedH,
                `canvasHeight mismatch for ${JSON.stringify({
                    imageHeight: input.imageHeight,
                    container: input.container,
                })}`,
            );
            return true;
        }),
        { numRuns: 100 },
    );
});

// ─── baseImageScale === 1 ────────────────────────────────────

test('expand layout fixes baseImageScale to 1', () => {
    fc.assert(
        fc.property(inputsArb, (input) => {
            const out = computeExpandLayout(
                input.imageWidth,
                input.imageHeight,
                input.optsCanvasWidth,
                input.optsCanvasHeight,
                input.container,
            );
            assert.equal(
                out.baseImageScale,
                1,
                `baseImageScale must be exactly 1 for expand layout, got ${out.baseImageScale} ` +
                    `for ${JSON.stringify(input)}`,
            );
            return true;
        }),
        { numRuns: 100 },
    );
});

// ─── image at (0, 0) with scale 1 ────────────────────────────

test('image is placed at (0, 0) with imageScale === 1', () => {
    fc.assert(
        fc.property(inputsArb, (input) => {
            const out = computeExpandLayout(
                input.imageWidth,
                input.imageHeight,
                input.optsCanvasWidth,
                input.optsCanvasHeight,
                input.container,
            );
            assert.equal(
                out.imageLeft,
                0,
                `imageLeft must be 0 for expand layout, got ${out.imageLeft}`,
            );
            assert.equal(
                out.imageTop,
                0,
                `imageTop must be 0 for expand layout, got ${out.imageTop}`,
            );
            assert.equal(
                out.imageScale,
                1,
                `imageScale must be exactly 1 for expand layout, got ${out.imageScale} ` +
                    `for ${JSON.stringify(input)}`,
            );
            return true;
        }),
        { numRuns: 100 },
    );
});
