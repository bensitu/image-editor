// Hidden-container viewport cache
//
//   For any hidden container or zero-sized viewport, layout SHALL use
//   the configured canvas dimensions or the last known non-zero
//   viewport dimensions as a fallback. The result SHALL never produce
//   zero or negative canvas dimensions.
//
// Owner module: `src/image/layout-manager.ts` — `ViewportCache` class.
// `ViewportCache.measure(container, fallback)` reads
// `container.clientWidth` / `clientHeight` and runs them through
// `Math.floor`, so plain objects with integer-valued `clientWidth` and
// `clientHeight` properties are sufficient stand-ins for an
// `HTMLElement`. No jsdom is required.
//
// Sub-properties exercised here:
//
//   8.1 Visible measure caches: when both `clientWidth` and
//       `clientHeight` are > 0, `measure(container, fallback)` returns
//       `{ width: floor(clientWidth), height: floor(clientHeight) }`,
//       and `peek()` afterwards returns the same value. The fallback
//       is ignored on the visible path.
//   8.2 Hidden returns cache: once a non-zero measurement
//       has been observed, any subsequent `measure` call where either
//       axis is zero returns the previously cached size — not the
//       fallback. `peek()` keeps reporting the cache.
//   8.3 Fallback when no cache: with a fresh cache and a
//       container reporting any zero axis, `measure` returns the
//       supplied fallback verbatim. `peek()` is `null`.
//   8.4 Null container returns fallback: `measure(null, fallback)`
//       returns the fallback regardless of cache state and never
//       updates the cache.
//   8.5 clear() resets the cache: after `clear()`, `peek()` is `null`
//       and a subsequent hidden-axis measure returns the fallback
//       (i.e. the cache no longer remembers the prior visible size).
//
// Runtime note: Node 24+ strips TypeScript syntax natively, so the
// test imports the module under test directly from source. The shared
// `ts-resolve-hook` rewrites `.js` import specifiers in
// `layout-manager.ts` to their `.ts` siblings, mirroring the project's
// `moduleResolution: "bundler"` setup.

import { register } from 'node:module';

register('./helpers/ts-resolve-hook.mjs', import.meta.url);

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';

const { ViewportCache } = await import('../src/image/layout-manager.ts');

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
            assert.equal(peeked.width, out.width, 'peek().width must match the last visible measurement');
            assert.equal(peeked.height, out.height, 'peek().height must match the last visible measurement');
            return true;
        }),
        { numRuns: 100 },
    );
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
            assert.equal(
                cache.peek(),
                null,
                'hidden-axis read must not populate the cache',
            );
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
                assert.equal(
                    cache.peek(),
                    null,
                    'measure(null, ...) must not populate the cache',
                );

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
                assert.notEqual(
                    cache.peek(),
                    null,
                    'sanity: visible measure populated the cache',
                );
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
