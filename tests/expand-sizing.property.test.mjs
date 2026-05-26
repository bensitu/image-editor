// Property 7: Expand sizing math
//
// Property statement (design.md §"Property 7"):
//   For any image dimensions and configured canvas dimensions, the
//   expand layout path SHALL size the canvas to the image dimensions
//   and SHALL preserve the image's aspect ratio and top-left
//   placement.
//
// Owner module: `src/image/layout-manager.ts` — pure function
// `computeExpandLayout(imageWidth, imageHeight, optionsCanvasWidth,
// optionsCanvasHeight, containerSize)`. The function is pure (no DOM),
// so the property test runs without jsdom.
//
// Sub-properties exercised here:
//
//   7.1 Per-axis max(viewport, image) (Req 9.3, 9.5):
//       `out.canvasWidth === Math.max(container.width, floor(imgW))`
//       and `out.canvasHeight === Math.max(container.height,
//       floor(imgH))`. The expand path grows each axis independently
//       so the canvas always fits the image and never shrinks below
//       the visible viewport.
//   7.2 baseImageScale === 1 (Req 9.5): the editor's anchor scale for
//       the expand strategy is exactly `1`. This is what later guards
//       the image's natural pixel ratio when zoom factors are
//       computed in the transform controller.
//   7.3 Image at (0, 0) with scale 1 (Req 9.5): top-left placement is
//       preserved — `imageLeft === 0`, `imageTop === 0`, and
//       `imageScale === 1` so the image renders 1:1 against the
//       canvas origin.
//
// Runtime note: Node 24+ strips TypeScript syntax natively, so the
// test imports the module under test directly from source — no
// separate build step is required.
//
// `layout-manager.ts` carries runtime `.js`-suffixed imports to
// sibling `.ts` modules (the project compiles for browsers under
// `moduleResolution: "bundler"`). Node's native type stripping does
// not rewrite those specifiers, so we register the shared resolve
// hook that maps relative `.js` requests to `.ts` when the sibling
// source file exists. The layout manager is pulled in via dynamic
// `import()` so the resolver is in place before its specifier is
// resolved.

import { register } from 'node:module';

register('./helpers/ts-resolve-hook.mjs', import.meta.url);

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';

const { computeExpandLayout } = await import(
    '../src/image/layout-manager.ts'
);

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

// ─── Property 7.1: per-axis max(viewport, image) ───────────────────────────

test('Property 7.1: canvas dimensions equal max(viewport, floor(image)) per axis (Req 9.3, 9.5)', () => {
    fc.assert(
        fc.property(inputsArb, (input) => {
            const out = computeExpandLayout(
                input.imageWidth,
                input.imageHeight,
                input.optsCanvasWidth,
                input.optsCanvasHeight,
                input.container,
            );
            const expectedW = Math.max(
                input.container.width,
                Math.floor(input.imageWidth),
            );
            const expectedH = Math.max(
                input.container.height,
                Math.floor(input.imageHeight),
            );
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

// ─── Property 7.2: baseImageScale === 1 ────────────────────────────────────

test('Property 7.2: expand layout fixes baseImageScale to 1 (Req 9.5)', () => {
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

// ─── Property 7.3: image at (0, 0) with scale 1 ────────────────────────────

test('Property 7.3: image is placed at (0, 0) with imageScale === 1 (Req 9.5)', () => {
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
