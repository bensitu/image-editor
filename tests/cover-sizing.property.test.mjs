// Cover sizing math
//
//   For any image dimensions and visible container viewport dimensions,
//   the cover layout path SHALL size the canvas to the viewport and
//   SHALL scale the image high enough to cover the viewport on both
//   axes, including cases where that requires scale greater than `1`.
//
// Owner module: `src/image/layout-manager.ts` — pure function
// `computeCoverLayout(imageWidth, imageHeight, optionsCanvasWidth,
// optionsCanvasHeight, containerSize)`. The function is pure (no DOM),
// so the property test runs without jsdom.
//
// Sub-properties exercised here:
//
//   6.1 Canvas matches viewport: `out.canvasWidth ===
//       container.width || optionsCanvasWidth` — the cover path tracks
//       the visible viewport when an axis is non-zero, falling back to
//       the configured canvas dimension when the axis reads zero.
//       Same invariant on the height axis.
//   6.2 Image scales up if needed: when the image is strictly
//       smaller than the canvas on both axes, `out.imageScale > 1`.
//   6.3 Cover fills both axes: for every input,
//       `out.imageScale * imageWidth >= out.canvasWidth` and
//       `out.imageScale * imageHeight >= out.canvasHeight`, with a
//       small absolute tolerance for IEEE-754 division rounding.
//   6.4 Aspect-preserving: the result exposes a single
//       uniform `imageScale` (no `scaleX` / `scaleY` split) and
//       `baseImageScale` mirrors `imageScale` for cover layout.
//   6.5 No upper cap: the scale formula
//       `max(cw / imgW, ch / imgH)` is **not** clamped at `1`. When the
//       image is much smaller than the canvas, the scale grows in
//       proportion to the canvas-to-image ratio rather than saturating
//       at `1`.
//
// Runtime note: Node 24+ strips TypeScript syntax natively, so the test
// imports the module under test directly from source — no separate build
// step is required.
//
// `layout-manager.ts` carries runtime `.js`-suffixed imports to sibling
// `.ts` modules (the project compiles for browsers under
// `moduleResolution: "bundler"`). Node's native type stripping does not
// rewrite those specifiers, so we register the shared resolve hook that
// maps relative `.js` requests to `.ts` when the sibling source file
// exists. The layout manager is pulled in via dynamic `import()` so the
// resolver is in place before its specifier is resolved.

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
