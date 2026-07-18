/**
 * Type:
 *   Property test
 *
 * Purpose:
 *   Verifies src/image/layout-manager.ts computeCoverLayout for arbitrary image and
 *   viewport dimensions. Cover should follow the established behavior: scale
 *   large images down until one viewport axis is filled, do not upscale small
 *   images, and expand the canvas only on axes that need a real scroll range.
 *
 * Scope:
 *   - Canvas dimensions use visible viewport axes with configured options fallback.
 *   - Image scale is uniform and capped at 1.
 *   - Overflowing content axes expand to the scaled image dimension.
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
 *   node --test tests/cover-sizing.property.test.mjs
 */

import { register } from 'node:module';

register('./helpers/ts-resolve-hook.mjs', import.meta.url);

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';

const { computeCoverLayout, computeScrollableCanvasSize } =
    await import('../src/image/layout-manager.ts');

const OVERFLOW_EPSILON = 0.5;

// Bounded positive integers mirror the dimensions a real browser viewport can
// carry in ordinary usage. Container axes may be zero; the layout function then
// falls back to the configured canvas dimension on that axis.
const dimArb = fc.integer({ min: 1, max: 2000 });
const containerDimArb = fc.integer({ min: 0, max: 2000 });
const scrollbarDimArb = fc.integer({ min: 0, max: 80 });

const inputsArb = fc.record({
    imageWidth: dimArb,
    imageHeight: dimArb,
    optsCanvasWidth: dimArb,
    optsCanvasHeight: dimArb,
    container: fc.record({
        width: containerDimArb,
        height: containerDimArb,
    }),
    scrollbar: fc.record({
        width: scrollbarDimArb,
        height: scrollbarDimArb,
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
        scrollbar: fc.record({
            width: scrollbarDimArb,
            height: scrollbarDimArb,
        }),
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
        scrollbar: r.scrollbar,
    }));

function referenceCover(input) {
    const viewportW = input.container.width || input.optsCanvasWidth;
    const viewportH = input.container.height || input.optsCanvasHeight;
    let hasHorizontal = false;
    let hasVertical = false;
    let imageScale = 1;
    let contentW = input.imageWidth;
    let contentH = input.imageHeight;

    for (let i = 0; i < 4; i += 1) {
        const effectiveW = Math.max(1, viewportW - (hasVertical ? input.scrollbar.width : 0));
        const effectiveH = Math.max(1, viewportH - (hasHorizontal ? input.scrollbar.height : 0));
        imageScale = Math.min(
            1,
            Math.max(effectiveW / input.imageWidth, effectiveH / input.imageHeight),
        );
        contentW = input.imageWidth * imageScale;
        contentH = input.imageHeight * imageScale;

        const nextHasHorizontal = contentW > effectiveW + OVERFLOW_EPSILON;
        const nextHasVertical = contentH > effectiveH + OVERFLOW_EPSILON;

        if (nextHasHorizontal === hasHorizontal && nextHasVertical === hasVertical) break;
        hasHorizontal = nextHasHorizontal;
        hasVertical = nextHasVertical;
    }

    const canvasSize = referenceScrollableCanvasSize(
        contentW,
        contentH,
        {
            width: viewportW,
            height: viewportH,
        },
        input.scrollbar,
    );
    return {
        imageScale,
        contentW,
        contentH,
        canvasSize,
        viewport: { width: viewportW, height: viewportH },
        scrollbar: input.scrollbar,
    };
}

function referenceScrollableCanvasSize(contentWidth, contentHeight, viewport, scrollbar = {}) {
    const viewportW = Math.max(1, viewport.width || 1);
    const viewportH = Math.max(1, viewport.height || 1);
    const scrollbarW = Math.max(0, Number(scrollbar.width) || 0);
    const scrollbarH = Math.max(0, Number(scrollbar.height) || 0);
    let hasHorizontal = false;
    let hasVertical = false;

    for (let i = 0; i < 4; i += 1) {
        const effectiveW = Math.max(1, viewportW - (hasVertical ? scrollbarW : 0));
        const effectiveH = Math.max(1, viewportH - (hasHorizontal ? scrollbarH : 0));
        const nextHorizontal = contentWidth > effectiveW + OVERFLOW_EPSILON;
        const nextVertical = contentHeight > effectiveH + OVERFLOW_EPSILON;

        if (nextHorizontal === hasHorizontal && nextVertical === hasVertical) break;
        hasHorizontal = nextHorizontal;
        hasVertical = nextVertical;
    }

    const effectiveW = Math.max(1, viewportW - (hasVertical ? scrollbarW : 0));
    const effectiveH = Math.max(1, viewportH - (hasHorizontal ? scrollbarH : 0));

    return {
        width: hasHorizontal ? Math.ceil(contentWidth) : effectiveW,
        height: hasVertical ? Math.ceil(contentHeight) : effectiveH,
    };
}

function finalScrollbarState(canvasSize, viewport, scrollbar) {
    let hasHorizontal = false;
    let hasVertical = false;

    for (let i = 0; i < 4; i += 1) {
        const effectiveW = Math.max(1, viewport.width - (hasVertical ? scrollbar.width : 0));
        const effectiveH = Math.max(1, viewport.height - (hasHorizontal ? scrollbar.height : 0));
        const nextHorizontal = canvasSize.width > effectiveW + OVERFLOW_EPSILON;
        const nextVertical = canvasSize.height > effectiveH + OVERFLOW_EPSILON;

        if (nextHorizontal === hasHorizontal && nextVertical === hasVertical) break;
        hasHorizontal = nextHorizontal;
        hasVertical = nextVertical;
    }

    return { hasHorizontal, hasVertical };
}

function fillsSettledViewportAxis(contentSize, effectiveViewportSize) {
    // Cover sizing uses OVERFLOW_EPSILON when deciding whether an axis
    // actually needs a scrollbar. A dimension up to that tolerance over
    // the final safe viewport axis is still considered settled, so the
    // property must use the same tolerance instead of exact equality.
    return (
        contentSize + 1e-9 >= effectiveViewportSize &&
        contentSize <= effectiveViewportSize + OVERFLOW_EPSILON + 1e-9
    );
}

test('cover layout matches the scrollbar-aware scroll-safe reference formula', () => {
    fc.assert(
        fc.property(inputsArb, (input) => {
            const out = computeCoverLayout(
                input.imageWidth,
                input.imageHeight,
                input.optsCanvasWidth,
                input.optsCanvasHeight,
                input.container,
                input.scrollbar,
            );
            const expected = referenceCover(input);

            assert.equal(out.canvasWidth, expected.canvasSize.width);
            assert.equal(out.canvasHeight, expected.canvasSize.height);
            assert.equal(out.imageScale, expected.imageScale);
            assert.equal(out.baseImageScale, expected.imageScale);
            assert.equal(out.imageLeft, 0);
            assert.equal(out.imageTop, 0);
            return true;
        }),
        { numRuns: 100 },
    );
});

test('cover scale is capped at 1 so small images are not upscaled', () => {
    fc.assert(
        fc.property(smallImageArb, (input) => {
            const out = computeCoverLayout(
                input.imageWidth,
                input.imageHeight,
                input.optsCanvasWidth,
                input.optsCanvasHeight,
                input.container,
                input.scrollbar,
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

test('large cover images fill at least one safe viewport axis', () => {
    fc.assert(
        fc.property(inputsArb, (input) => {
            const out = computeCoverLayout(
                input.imageWidth,
                input.imageHeight,
                input.optsCanvasWidth,
                input.optsCanvasHeight,
                input.container,
                input.scrollbar,
            );
            const expected = referenceCover(input);
            const contentW = input.imageWidth * out.imageScale;
            const contentH = input.imageHeight * out.imageScale;
            const state = finalScrollbarState(
                { width: out.canvasWidth, height: out.canvasHeight },
                expected.viewport,
                expected.scrollbar,
            );
            const effectiveW = Math.max(
                1,
                expected.viewport.width - (state.hasVertical ? expected.scrollbar.width : 0),
            );
            const effectiveH = Math.max(
                1,
                expected.viewport.height - (state.hasHorizontal ? expected.scrollbar.height : 0),
            );

            if (expected.imageScale < 1) {
                assert.ok(
                    fillsSettledViewportAxis(contentW, effectiveW) ||
                        fillsSettledViewportAxis(contentH, effectiveH),
                    `scaled cover image must fill one final viewport axis for ${JSON.stringify(input)}`,
                );
            }
            assert.ok(out.imageScale <= 1, 'cover must not upscale above native image size');
            return true;
        }),
        { numRuns: 100 },
    );
});

test('cover layout does not require scrollbars on both axes after scrollbar gutters settle', () => {
    fc.assert(
        fc.property(inputsArb, (input) => {
            const out = computeCoverLayout(
                input.imageWidth,
                input.imageHeight,
                input.optsCanvasWidth,
                input.optsCanvasHeight,
                input.container,
                input.scrollbar,
            );
            const expected = referenceCover(input);
            const state = finalScrollbarState(
                { width: out.canvasWidth, height: out.canvasHeight },
                expected.viewport,
                expected.scrollbar,
            );

            assert.ok(
                !(state.hasHorizontal && state.hasVertical),
                `cover must not create both scrollbar axes for ${JSON.stringify(input)}`,
            );
            return true;
        }),
        { numRuns: 100 },
    );
});

test('cover layout suppresses the short-axis near-scrollbar when scrollbar gutter changes the viewport', () => {
    const out = computeCoverLayout(
        2867,
        1511,
        800,
        600,
        { width: 960, height: 520 },
        { width: 15, height: 15 },
    );
    const state = finalScrollbarState(
        { width: out.canvasWidth, height: out.canvasHeight },
        { width: 960, height: 520 },
        { width: 15, height: 15 },
    );

    assert.ok(
        !(state.hasHorizontal && state.hasVertical),
        'cover must not leave a one-pixel short-axis scrollbar',
    );
});

test('scrollable canvas sizing expands only axes with overflowing content', () => {
    fc.assert(
        fc.property(inputsArb, (input) => {
            const expected = referenceCover(input);
            const out = computeScrollableCanvasSize(
                expected.contentW,
                expected.contentH,
                {
                    width: input.container.width || input.optsCanvasWidth,
                    height: input.container.height || input.optsCanvasHeight,
                },
                input.scrollbar,
            );
            const ref = referenceScrollableCanvasSize(
                expected.contentW,
                expected.contentH,
                {
                    width: input.container.width || input.optsCanvasWidth,
                    height: input.container.height || input.optsCanvasHeight,
                },
                input.scrollbar,
            );
            assert.deepEqual(out, ref);
            return true;
        }),
        { numRuns: 100 },
    );
});
