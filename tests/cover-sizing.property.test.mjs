/**
 * @file cover-sizing.property.test.mjs
 *
 * Type:
 *   Property test
 *
 * Purpose:
 *   Verifies src/image/layout-manager.ts computeCoverLayout for arbitrary image and
 *   viewport dimensions. The function is pure, so the property runs without jsdom and
 *   focuses only on canvas sizing and image scale selection.
 *
 * Scope:
 *   - Canvas dimensions track visible viewport axes and fall back to configured
 *     options for zero axes.
 *   - Image scale is high enough to cover both axes and remains uniform.
 *   - The scale formula is not capped at 1, so small images can scale up.
 *
 * Out of scope:
 *   - unrelated editor features
 *   - visual rendering quality
 *   - browser-specific integration details
 *
 * Environment:
 *   - Node.js ESM
 *   - fast-check generated cases where applicable
 *   - jsdom or DOM stubs are used where needed
 *   - Fabric/canvas behavior is mocked where needed
 *
 * Run:
 *   node --test tests/cover-sizing.property.test.mjs
 *
 * Notes:
 *   - Prefer behavior-level assertions over implementation-detail checks.
 *   - Keep this file focused on cover layout sizing math only.
 */

import { register } from 'node:module';

register('./helpers/ts-resolve-hook.mjs', import.meta.url);

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';

const { computeCoverLayout } = await import(
    '../src/image/layout-manager.ts'
);

// ─── Arbitraries ───────────────────────────────────────────────────────────

// Bounded positive integers mirror the dimensions a real browser
// viewport can carry (1..2000 px). The lower bound of 1 keeps every
// divisor in computeCoverLayout finite for image and configured canvas
// axes. Container axes may be zero — the function falls back to the
// configured canvas dimension on a zero axis.
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

// Constrained generator that guarantees the image is strictly smaller
// than the resolved canvas on both axes. The container is non-zero on
// both axes so it (not the configured canvas) is what `computeCover-
// Layout` selects, which keeps the assertion easy to reason about.
const imageStrictlySmallerArb = fc
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
            width: r.imageWidth + r.deltaWidth,
            height: r.imageHeight + r.deltaHeight,
        },
    }));

// Floating-point comparison tolerance for the cover-fill check. Each
// `coverScale * dim` product can differ from the resolved canvas
// dimension by ~1 ULP under IEEE-754 division rounding, so an absolute
// slack well below a CSS pixel keeps the property meaningful without
// failing on rounding noise.
const FILL_TOLERANCE = 1e-9;

// ─── canvas matches viewport (with options fallback) ─────────

test('canvas tracks the visible viewport, falling back to options on a zero axis', () => {
    fc.assert(
        fc.property(inputsArb, (input) => {
            const out = computeCoverLayout(
                input.imageWidth,
                input.imageHeight,
                input.optsCanvasWidth,
                input.optsCanvasHeight,
                input.container,
            );
            const expectedW =
                input.container.width || input.optsCanvasWidth;
            const expectedH =
                input.container.height || input.optsCanvasHeight;
            assert.equal(
                out.canvasWidth,
                expectedW,
                `canvasWidth mismatch for ${JSON.stringify({
                    container: input.container,
                    optsCanvasWidth: input.optsCanvasWidth,
                })}`,
            );
            assert.equal(
                out.canvasHeight,
                expectedH,
                `canvasHeight mismatch for ${JSON.stringify({
                    container: input.container,
                    optsCanvasHeight: input.optsCanvasHeight,
                })}`,
            );
            return true;
        }),
        { numRuns: 100 },
    );
});

// ─── image scales up when smaller than canvas ────────────────

test('image strictly smaller than the canvas on both axes yields imageScale > 1', () => {
    fc.assert(
        fc.property(imageStrictlySmallerArb, (input) => {
            const out = computeCoverLayout(
                input.imageWidth,
                input.imageHeight,
                input.optsCanvasWidth,
                input.optsCanvasHeight,
                input.container,
            );
            assert.ok(
                out.imageScale > 1,
                `expected imageScale > 1 for ${JSON.stringify({
                    ...input,
                    canvasWidth: out.canvasWidth,
                    canvasHeight: out.canvasHeight,
                })}, got ${out.imageScale}`,
            );
            return true;
        }),
        { numRuns: 100 },
    );
});

// ─── cover fills both axes ───────────────────────────────────

test('imageScale * imgW >= canvasWidth and imageScale * imgH >= canvasHeight', () => {
    fc.assert(
        fc.property(inputsArb, (input) => {
            const out = computeCoverLayout(
                input.imageWidth,
                input.imageHeight,
                input.optsCanvasWidth,
                input.optsCanvasHeight,
                input.container,
            );
            const widthCovered =
                out.imageScale * input.imageWidth + FILL_TOLERANCE;
            const heightCovered =
                out.imageScale * input.imageHeight + FILL_TOLERANCE;
            assert.ok(
                widthCovered >= out.canvasWidth,
                `width not covered: scale=${out.imageScale} ` +
                    `* imgW=${input.imageWidth} = ` +
                    `${out.imageScale * input.imageWidth} ` +
                    `< canvasWidth=${out.canvasWidth}`,
            );
            assert.ok(
                heightCovered >= out.canvasHeight,
                `height not covered: scale=${out.imageScale} ` +
                    `* imgH=${input.imageHeight} = ` +
                    `${out.imageScale * input.imageHeight} ` +
                    `< canvasHeight=${out.canvasHeight}`,
            );
            return true;
        }),
        { numRuns: 100 },
    );
});

// ─── aspect-preserving (uniform scale) ───────────────────────

test('imageScale is a single uniform scalar, no scaleX/scaleY split', () => {
    fc.assert(
        fc.property(inputsArb, (input) => {
            const out = computeCoverLayout(
                input.imageWidth,
                input.imageHeight,
                input.optsCanvasWidth,
                input.optsCanvasHeight,
                input.container,
            );
            assert.equal(
                typeof out.imageScale,
                'number',
                'imageScale must be a single numeric scalar',
            );
            assert.ok(
                Number.isFinite(out.imageScale),
                `imageScale must be finite, got ${out.imageScale}`,
            );
            assert.equal(
                out.baseImageScale,
                out.imageScale,
                'baseImageScale must mirror imageScale for cover layout',
            );
            assert.ok(
                !('scaleX' in out),
                'cover layout result must not expose scaleX (would split aspect)',
            );
            assert.ok(
                !('scaleY' in out),
                'cover layout result must not expose scaleY (would split aspect)',
            );
            return true;
        }),
        { numRuns: 100 },
    );
});

// ─── no upper cap on imageScale ──────────────────────────────

test('imageScale is not capped at 1 — it grows with the canvas-to-image ratio', () => {
    fc.assert(
        fc.property(imageStrictlySmallerArb, (input) => {
            const out = computeCoverLayout(
                input.imageWidth,
                input.imageHeight,
                input.optsCanvasWidth,
                input.optsCanvasHeight,
                input.container,
            );
            // Independent reference: cover scale must equal
            // `max(cw/imgW, ch/imgH)`. If the implementation introduced
            // a `Math.min(..., 1)` cap, this equality would break for
            // any input where the analytical maximum exceeds 1.
            const expectedScale = Math.max(
                out.canvasWidth / input.imageWidth,
                out.canvasHeight / input.imageHeight,
            );
            assert.ok(
                expectedScale > 1,
                `generator invariant violated: expected scale > 1, got ${expectedScale}`,
            );
            assert.equal(
                out.imageScale,
                expectedScale,
                `cover scale capped or recomputed: expected ${expectedScale}, ` +
                    `got ${out.imageScale} for ${JSON.stringify(input)}`,
            );
            assert.ok(
                out.imageScale > 1,
                `cover capped at 1 for ${JSON.stringify(input)}: ` +
                    `imageScale=${out.imageScale}`,
            );
            return true;
        }),
        { numRuns: 100 },
    );
});
