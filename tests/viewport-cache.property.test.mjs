/**
 * @file viewport-cache.property.test.mjs
 *
 * Type:
 *   Property test
 *
 * Purpose:
 *   Verifies src/image/layout-manager.ts ViewportCache behavior for visible, hidden,
 *   null, reset, and pre-existing auto-scrollbar measurement paths.
 *
 * Scope:
 *   - Visible non-zero measurements are floored, returned, and cached.
 *   - Auto-scrollbar gutters are added back before caching the viewport.
 *   - Hidden or zero-axis measurements use the cached size when present and the
 *     supplied fallback otherwise.
 *   - clear() drops the cache so subsequent hidden measurements fall back again.
 *
 * Out of scope:
 *   - browser layout engine differences
 *   - visual rendering quality
 *   - unrelated editor workflows
 *
 * Environment:
 *   - Node.js ESM
 *   - fast-check generated cases where applicable
 *   - jsdom or DOM stubs are used where needed
 *
 * Run:
 *   node --test tests/viewport-cache.property.test.mjs
 *
 * Notes:
 *   - Prefer behavior-level assertions over implementation-detail checks.
 *   - Keep this file focused on hidden-container viewport cache only.
 */

import { register } from 'node:module';

register('./helpers/ts-resolve-hook.mjs', import.meta.url);

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';

const { ViewportCache, measureContainerViewport } = await import('../src/image/layout-manager.ts');

// ─── Arbitraries ───────────────────────────────────────────────────────────

// `ViewportCache.measure` calls `Math.floor` on `clientWidth` /
// `clientHeight`. We bias toward integer inputs in the realistic
// browser viewport range (1..2000 px). Visible axes are strictly > 0;
// the hidden state is modelled separately by zeroing one or both axes.
const visibleDimArb = fc.integer({ min: 1, max: 2000 });
const fallbackDimArb = fc.integer({ min: 1, max: 2000 });

// A container that is unambiguously visible on both axes.
const visibleContainerArb = fc.record({
    clientWidth: visibleDimArb,
    clientHeight: visibleDimArb,
});

// A fallback size — the caller (image-loader) normally passes
// `(options.canvasWidth, options.canvasHeight)`. The test only requires
// that fallback values be distinguishable from visible measurements,
// so any positive integer pair is fine.
const fallbackArb = fc.record({
    width: fallbackDimArb,
    height: fallbackDimArb,
});

function makeOverflowContainer({
    clientWidth,
    clientHeight,
    scrollWidth,
    scrollHeight,
    overflow = 'auto',
}) {
    return {
        clientWidth,
        clientHeight,
        scrollWidth,
        scrollHeight,
        style: {
            overflow: '',
            overflowX: '',
            overflowY: '',
        },
        ownerDocument: {
            defaultView: {
                getComputedStyle() {
                    return {
                        overflow,
                        overflowX: overflow,
                        overflowY: overflow,
                    };
                },
            },
        },
    };
}

// A container that the cache must treat as hidden: at least one axis
// is exactly zero. We enumerate the three hidden shapes (w=0, h=0,
// both=0) so generation never accidentally drifts into the visible
// branch.
const hiddenContainerArb = fc.oneof(
    fc.record({
        clientWidth: fc.constant(0),
        clientHeight: fc.integer({ min: 0, max: 2000 }),
    }),
    fc.record({
        clientWidth: fc.integer({ min: 0, max: 2000 }),
        clientHeight: fc.constant(0),
    }),
    fc.record({
        clientWidth: fc.constant(0),
        clientHeight: fc.constant(0),
    }),
);

// ─── visible measure caches ──────────────────────────────────

test('visible measure returns floor(clientW/H) and updates the cache', () => {
    fc.assert(
        fc.property(visibleContainerArb, fallbackArb, (container, fallback) => {
            const cache = new ViewportCache();
            const out = cache.measure(container, fallback);
            assert.equal(
                out.width,
                Math.floor(container.clientWidth),
                'measure must return floor(clientWidth) on the visible path',
            );
            assert.equal(
                out.height,
                Math.floor(container.clientHeight),
                'measure must return floor(clientHeight) on the visible path',
            );
            const peeked = cache.peek();
            assert.notEqual(peeked, null, 'peek must report a cached size after a visible measure');
            assert.equal(
                peeked.width,
                out.width,
                'peek().width must match the last visible measurement',
            );
            assert.equal(
                peeked.height,
                out.height,
                'peek().height must match the last visible measurement',
            );
            return true;
        }),
        { numRuns: 100 },
    );
});

test('visible auto-scrollbar measure adds scrollbar gutters back to the viewport', () => {
    const cache = new ViewportCache();
    const container = makeOverflowContainer({
        clientWidth: 945,
        clientHeight: 505,
        scrollWidth: 960,
        scrollHeight: 520,
        overflow: 'auto',
    });

    const out = cache.measure(container, { width: 800, height: 600 }, { width: 15, height: 15 });

    assert.deepEqual(out, { width: 960, height: 520 });
    assert.deepEqual(cache.peek(), out);
});

test('fixed scrollbars use the measured client viewport without auto compensation', () => {
    const container = makeOverflowContainer({
        clientWidth: 945,
        clientHeight: 505,
        scrollWidth: 960,
        scrollHeight: 520,
        overflow: 'scroll',
    });

    const out = measureContainerViewport(
        container,
        { width: 800, height: 600 },
        { width: 15, height: 15 },
    );

    assert.deepEqual(out, { width: 945, height: 505 });
});

// ─── hidden returns cached value when one exists ─────────────

test('hidden measure returns the cached lastVisible size, not the fallback', () => {
    fc.assert(
        fc.property(
            visibleContainerArb,
            hiddenContainerArb,
            fallbackArb,
            (visibleContainer, hiddenContainer, fallback) => {
                const cache = new ViewportCache();
                // Prime the cache with a visible measurement.
                const cached = cache.measure(visibleContainer, fallback);
                // Subsequent hidden read MUST return the cached size,
                // not the fallback.
                const hiddenOut = cache.measure(hiddenContainer, fallback);
                assert.equal(
                    hiddenOut.width,
                    cached.width,
                    'hidden measure must reuse cached width',
                );
                assert.equal(
                    hiddenOut.height,
                    cached.height,
                    'hidden measure must reuse cached height',
                );
                // The cache is unchanged by a hidden read.
                const peeked = cache.peek();
                assert.equal(peeked.width, cached.width);
                assert.equal(peeked.height, cached.height);
                return true;
            },
        ),
        { numRuns: 100 },
    );
});

// ─── fallback when no cache yet ──────────────────────────────

test('hidden measure with empty cache returns the fallback', () => {
    fc.assert(
        fc.property(hiddenContainerArb, fallbackArb, (container, fallback) => {
            const cache = new ViewportCache();
            assert.equal(cache.peek(), null, 'cache starts empty');
            const out = cache.measure(container, fallback);
            assert.equal(
                out.width,
                fallback.width,
                'fallback width must be returned when no cache and container is hidden',
            );
            assert.equal(
                out.height,
                fallback.height,
                'fallback height must be returned when no cache and container is hidden',
            );
            // A hidden read must not seed the cache, so peek is still null.
            assert.equal(cache.peek(), null, 'hidden-axis read must not populate the cache');
            return true;
        }),
        { numRuns: 100 },
    );
});

// ─── null container returns fallback unchanged ───────────────

test('null container yields the fallback verbatim and never mutates the cache', () => {
    fc.assert(
        fc.property(
            visibleContainerArb,
            fallbackArb,
            fallbackArb,
            (visibleContainer, primingFallback, nullFallback) => {
                const cache = new ViewportCache();
                // Case A: fresh cache.
                const outFresh = cache.measure(null, nullFallback);
                assert.equal(outFresh.width, nullFallback.width);
                assert.equal(outFresh.height, nullFallback.height);
                assert.equal(cache.peek(), null, 'measure(null, ...) must not populate the cache');

                // Case B: primed cache. Null container still returns
                // the fallback (mirrors the implementation: a missing
                // element short-circuits before touching the cache).
                cache.measure(visibleContainer, primingFallback);
                const cachedSnapshot = cache.peek();
                const outPrimed = cache.measure(null, nullFallback);
                assert.equal(outPrimed.width, nullFallback.width);
                assert.equal(outPrimed.height, nullFallback.height);
                // Cache remains pinned to the visible measurement.
                const after = cache.peek();
                assert.equal(after.width, cachedSnapshot.width);
                assert.equal(after.height, cachedSnapshot.height);
                return true;
            },
        ),
        { numRuns: 100 },
    );
});

// ─── clear() resets the cache ────────────────────────────────

test('clear() resets the cache; next hidden measure returns fallback', () => {
    fc.assert(
        fc.property(
            visibleContainerArb,
            hiddenContainerArb,
            fallbackArb,
            (visibleContainer, hiddenContainer, fallback) => {
                const cache = new ViewportCache();
                cache.measure(visibleContainer, fallback);
                assert.notEqual(cache.peek(), null, 'sanity: visible measure populated the cache');
                cache.clear();
                assert.equal(
                    cache.peek(),
                    null,
                    'clear() must drop the cached lastVisible measurement',
                );
                const afterClear = cache.measure(hiddenContainer, fallback);
                assert.equal(
                    afterClear.width,
                    fallback.width,
                    'after clear, hidden measure must fall back to the supplied fallback width',
                );
                assert.equal(
                    afterClear.height,
                    fallback.height,
                    'after clear, hidden measure must fall back to the supplied fallback height',
                );
                return true;
            },
        ),
        { numRuns: 100 },
    );
});
