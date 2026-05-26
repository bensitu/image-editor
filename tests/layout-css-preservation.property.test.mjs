// Property 9: CSS preservation across all layout operations
//
// Property statement (design.md §"Property 9"):
//   For any sequence of layout-affecting operations, the editor SHALL
//   preserve the host element inline CSS values for width, height,
//   display, and overflow. Any temporary visibility or overflow changes
//   made by editor-owned transactional operations SHALL be restored
//   before the operation settles or during dispose.
//
// Owner module: `src/image/layout-manager.ts` — `applyCanvasDimensions`
// is the only place in the editor that calls `Canvas.setDimensions`.
// It is contractually forbidden from mutating either the canvas
// element's inline style or the container's inline style; instead it
// updates pixel dimensions atomically through Fabric's two-layer
// canvas API and forces a synchronous reflow on the container by
// reading `offsetWidth` (Requirement 11.3, exercised here as a sanity
// check on the reflow path).
//
// Sub-properties exercised here:
//
//   9.1 No canvas.style mutation (Req 11.1): for any (width, height)
//       input, `applyCanvasDimensions` must NOT change any of
//       `canvas.style.width`, `canvas.style.height`, or
//       `canvas.style.display`.
//   9.2 No container.style mutation (Req 11.1, 11.2): for any input,
//       it must NOT change `container.style.{width,height,display}`
//       and — critically for Requirement 11.2 — must NOT touch
//       `container.style.overflow` while compensating for pre-existing
//       auto scrollbars.
//   9.3 setDimensions called with integers: the mock canvas's
//       `setDimensions` records exactly one call per invocation, with
//       integer `width`/`height` ≥ 1 derived from the input via
//       `max(1, round(Number(input) || 1))`.
//   9.4 forceReflow called (Req 11.3, sanity): the container's
//       `offsetWidth` getter is read at least once after
//       `setDimensions`, confirming the synchronous reflow primitive
//       in `utils/dom.ts` is invoked.
//
// Runtime note: Node 24+ strips TypeScript syntax natively, so the
// test imports the module under test directly from source. The shared
// `ts-resolve-hook` rewrites `.js` import specifiers in
// `layout-manager.ts` (and its `utils/dom.js` dependency) to their
// `.ts` siblings, mirroring the project's `moduleResolution: "bundler"`
// setup. `applyCanvasDimensions` does not need a real Fabric canvas or
// a real `HTMLElement`; duck-typed mocks suffice.

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
 * touching `canvas.style` (Req 11.1), so missing the property would
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
 * - exposes an inline `style` with the four properties Requirement 11
 *   names (`width`, `height`, `display`, `overflow`),
 * - counts reads of `offsetWidth` so the test can assert that
 *   `forceReflow` actually performed its one-shot read (Req 11.3).
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

// ─── Property 9.1 + 9.2: no style mutation on canvas or container ──────────

test('Property 9.1+9.2: applyCanvasDimensions never mutates canvas.style or container.style (Req 11.1, 11.2)', () => {
    fc.assert(
        fc.property(
            widthHeightArb,
            widthHeightArb,
            styleArb,
            (width, height, initialStyle) => {
                const canvas = makeCanvasMock();
                const { container } = makeContainerMock(initialStyle);

                // Snapshot every CSS property the requirement names.
                const before = { ...container.style };

                applyCanvasDimensions(canvas, width, height, container);

                // Every property the requirement names must be byte-for-byte
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

// ─── Property 9.3: setDimensions called with integer pixel dimensions ──────

test('Property 9.3: applyCanvasDimensions calls canvas.setDimensions with integer width/height ≥ 1', () => {
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

// ─── Property 9.4: forceReflow reads container.offsetWidth (Req 11.3) ──────

test('Property 9.4: applyCanvasDimensions forces a synchronous reflow by reading container.offsetWidth (Req 11.3)', () => {
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

// ─── Property 9.5: null container is a safe no-op for the reflow path ─────

test('Property 9.5: applyCanvasDimensions with a null container still resizes and does not throw', () => {
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
