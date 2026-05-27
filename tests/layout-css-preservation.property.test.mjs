/**
 * @file layout-css-preservation.property.test.mjs
 *
 * Type:
 *   Property test
 *
 * Purpose:
 *   Verifies src/image/layout-manager.ts canvas-dimension application without
 *   mutating inline style state on the canvas or container. The property uses
 *   lightweight element stubs to observe dimension writes and reflow reads.
 *
 * Scope:
 *   - applyCanvasDimensions writes integer canvas dimensions through setDimensions.
 *   - Existing canvas and container style objects are preserved.
 *   - The helper forces a synchronous reflow by reading container.offsetWidth when a
 *     container is present.
 *
 * Out of scope:
 *   - browser layout engine differences
 *   - visual rendering quality
 *   - unrelated editor workflows
 *
 * Environment:
 *   - Node.js ESM
 *   - fast-check generated cases where applicable
 *   - Fabric/canvas behavior is mocked where needed
 *
 * Run:
 *   node --test tests/layout-css-preservation.property.test.mjs
 *
 * Notes:
 *   - Prefer behavior-level assertions over implementation-detail checks.
 *   - Keep this file focused on cSS preservation across layout operations only.
 */

import { register } from 'node:module';

register('./helpers/ts-resolve-hook.mjs', import.meta.url);

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';

const { applyCanvasDimensions } = await import(
    '../src/image/layout-manager.ts'
);

// ─── Mock factories ────────────────────────────────────────────────────────

/**
 * Build a minimal Fabric canvas stand-in that records every
 * `setDimensions` invocation. The factory must NOT expose any
 * `style`-related fields: `applyCanvasDimensions` is forbidden from
 * touching `canvas.style`, so missing the property would
 * surface as a `TypeError` at the moment of the violation.
 */
function makeCanvasMock() {
    const calls = [];
    return {
        calls,
        setDimensions(dims) {
            // Capture a defensive copy so later mutation on the
            // dimensions object cannot retroactively alter the record.
            calls.push({ width: dims.width, height: dims.height });
        },
    };
}

/**
 * Build a duck-typed container mock that:
 * - exposes an inline `style` with the four properties the documented contract
 *   names (`width`, `height`, `display`, `overflow`),
 * - counts reads of `offsetWidth` so the test can assert that
 *   `forceReflow` actually performed its one-shot read.
 *
 * The `offsetWidth` value itself is fixed; only the read count matters.
 */
function makeContainerMock(initialStyle) {
    let offsetWidthReads = 0;
    const container = {
        style: { ...initialStyle },
        get offsetWidth() {
            offsetWidthReads += 1;
            return 1024;
        },
    };
    return {
        container,
        getReads: () => offsetWidthReads,
    };
}

// ─── Arbitraries ───────────────────────────────────────────────────────────

// Inputs to `applyCanvasDimensions` that should round/clamp to a
// positive integer. The implementation does
// `max(1, round(Number(x) || 1))`, so we cover finite numbers across a
// realistic canvas range, plus zeros/negatives that must clamp to 1.
const widthHeightArb = fc.oneof(
    fc.integer({ min: 1, max: 4096 }),
    fc.float({ min: 0.5, max: 4096, noNaN: true, noDefaultInfinity: true }),
    fc.integer({ min: -10, max: 0 }), // clamps to 1
);

// Plausible developer-defined inline CSS values. We deliberately mix
// CSS keywords, percentage values, pixel values, and the empty string
// (the default for an unset inline style). Including unusual but
// legal strings prevents the implementation from silently relying on
// any specific format.
const cssValueArb = fc.oneof(
    fc.constantFrom(
        '',
        'auto',
        'block',
        'inline-block',
        'flex',
        'grid',
        'none',
        'hidden',
        'visible',
        'scroll',
        'overlay',
    ),
    fc.constantFrom('100%', '50%', '640px', '480px', '1024px', '300pt'),
    // Arbitrary non-empty token to guard against pattern-matching shortcuts.
    fc.string({ minLength: 1, maxLength: 12 }).filter((s) => !s.includes('\u0000')),
);

const styleArb = fc.record({
    width: cssValueArb,
    height: cssValueArb,
    display: cssValueArb,
    overflow: cssValueArb,
});

// ─── No style mutation on canvas or container ──────────

test('applyCanvasDimensions never mutates canvas.style or container.style', () => {
    fc.assert(
        fc.property(
            widthHeightArb,
            widthHeightArb,
            styleArb,
            (width, height, initialStyle) => {
                const canvas = makeCanvasMock();
                const { container } = makeContainerMock(initialStyle);

                // Snapshot every CSS property the Contract names.
                const before = { ...container.style };

                applyCanvasDimensions(canvas, width, height, container);

                // Every property the Contract names must be byte-for-byte
                // equal to its pre-call value. Using strict equality on each
                // key (rather than deepEqual on the whole object) gives a
                // precise failure message that names which property changed.
                for (const key of ['width', 'height', 'display', 'overflow']) {
                    assert.equal(
                        container.style[key],
                        before[key],
                        `container.style.${key} must not change`,
                    );
                }

                // The canvas mock has no `style` field; reading
                // `canvas.style` would yield `undefined`, and any attempt
                // by `applyCanvasDimensions` to assign through it would
                // throw. The assertion is made explicit so the test
                // documents the contract.
                assert.equal(
                    canvas.style,
                    undefined,
                    'applyCanvasDimensions must not access canvas.style at all',
                );

                return true;
            },
        ),
        { numRuns: 100 },
    );
});

// ─── setDimensions called with integer pixel dimensions ──────

test('applyCanvasDimensions calls canvas.setDimensions with integer width/height ≥ 1', () => {
    fc.assert(
        fc.property(
            widthHeightArb,
            widthHeightArb,
            styleArb,
            (width, height, initialStyle) => {
                const canvas = makeCanvasMock();
                const { container } = makeContainerMock(initialStyle);

                applyCanvasDimensions(canvas, width, height, container);

                assert.equal(
                    canvas.calls.length,
                    1,
                    'setDimensions must be called exactly once',
                );
                const call = canvas.calls[0];
                const expectedW = Math.max(1, Math.round(Number(width) || 1));
                const expectedH = Math.max(1, Math.round(Number(height) || 1));
                assert.equal(
                    call.width,
                    expectedW,
                    'width must be rounded and clamped to ≥ 1',
                );
                assert.equal(
                    call.height,
                    expectedH,
                    'height must be rounded and clamped to ≥ 1',
                );
                assert.ok(
                    Number.isInteger(call.width) && call.width >= 1,
                    'width passed to setDimensions must be a positive integer',
                );
                assert.ok(
                    Number.isInteger(call.height) && call.height >= 1,
                    'height passed to setDimensions must be a positive integer',
                );
                return true;
            },
        ),
        { numRuns: 100 },
    );
});

// ─── forceReflow reads container.offsetWidth ──────

test('applyCanvasDimensions forces a synchronous reflow by reading container.offsetWidth', () => {
    fc.assert(
        fc.property(
            widthHeightArb,
            widthHeightArb,
            styleArb,
            (width, height, initialStyle) => {
                const canvas = makeCanvasMock();
                const { container, getReads } = makeContainerMock(initialStyle);

                assert.equal(
                    getReads(),
                    0,
                    'sanity: offsetWidth has not been read before the call',
                );

                applyCanvasDimensions(canvas, width, height, container);

                assert.ok(
                    getReads() >= 1,
                    'forceReflow must read container.offsetWidth at least once',
                );
                return true;
            },
        ),
        { numRuns: 100 },
    );
});

// ─── null container is a safe no-op for the reflow path ─────

test('applyCanvasDimensions with a null container still resizes and does not throw', () => {
    fc.assert(
        fc.property(
            widthHeightArb,
            widthHeightArb,
            (width, height) => {
                const canvas = makeCanvasMock();
                // Should not throw — `forceReflow(null)` is a documented no-op.
                applyCanvasDimensions(canvas, width, height, null);
                assert.equal(
                    canvas.calls.length,
                    1,
                    'setDimensions must still be called when container is null',
                );
                return true;
            },
        ),
        { numRuns: 100 },
    );
});
