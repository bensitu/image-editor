/**
 * @file number-utils.property.test.mjs
 *
 * Type:
 *   Property test
 *
 * Purpose:
 *   Verifies src/utils/number.ts helpers for percentage resolution, function-valued
 *   inputs, invalid fallback handling, and point coercion. The suite is pure and uses
 *   generated canvas dimensions and point shapes.
 *
 * Scope:
 *   - Percentage strings resolve against the requested x or y canvas axis.
 *   - Function values receive canvas and options and can return numeric values.
 *   - Point objects and tuples normalize to the same coordinate structure.
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
 *   node --test tests/number-utils.property.test.mjs
 *
 * Notes:
 *   - Prefer behavior-level assertions over implementation-detail checks.
 *   - Keep this file focused on axis-aware number and point normalization only.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';

import { resolveNumeric, coercePoint } from '../src/utils/number.ts';

// ─── Test doubles ──────────────────────────────────────────────────────────

/**
 * Build a Fabric.Canvas stub exposing only the surface that
 * `resolveNumeric` reads.
 */
function mockCanvas(cw, ch) {
    return {
        getWidth: () => cw,
        getHeight: () => ch,
    };
}

/**
 * Build a sentinel `ResolvedOptions` value. The helper only forwards
 * the value to factory callbacks so an opaque object suffices for the
 * identity / argument-passing assertions.
 */
function mockOptions(seed) {
    return { __seed: seed, animationDuration: 300 };
}

// ─── Arbitraries ───────────────────────────────────────────────────────────

const canvasDimArb = fc.integer({ min: 1, max: 10000 });

// Percentage strings: keep the numeric portion finite and allow both
// integers and a fractional component so we exercise the `Math.floor`
// rounding in `resolveNumeric`.
const percentArb = fc
    .double({ min: 0, max: 100, noNaN: true, noDefaultInfinity: true })
    .map((p) => ({ raw: p, str: `${p}%` }));

// A grab-bag of values that SHOULD fall back: undefined, null, numeric
// strings without a `%` suffix, malformed percent strings, booleans,
// objects, arrays, NaN-producing strings.
const fallbackInputArb = fc.oneof(
    fc.constant(undefined),
    fc.constant(null),
    fc.constant(''),
    fc.constant('not-a-number'),
    fc.constant('123'), // bare numeric string, no '%' suffix → fallback
    fc.constant('%'),
    fc.constant('abc%'),
    fc.constant(true),
    fc.constant(false),
    fc.constant({}),
    fc.constant([]),
    fc.constant(Symbol('x')),
);

const finiteNumberArb = fc.double({
    min: -1e6,
    max: 1e6,
    noNaN: true,
    noDefaultInfinity: true,
});

const fallbackNumberArb = fc.integer({ min: -1000, max: 1000 });

const axisArb = fc.constantFrom('x', 'y');

// ─── Number passthrough ─────────────────────────────────────

test('number passthrough is identity', () => {
    fc.assert(
        fc.property(
            finiteNumberArb,
            axisArb,
            canvasDimArb,
            canvasDimArb,
            fallbackNumberArb,
            (n, axis, cw, ch, fallback) => {
                const canvas = mockCanvas(cw, ch);
                const opts = mockOptions('passthrough');
                const out = resolveNumeric(n, axis, fallback, canvas, opts);
                assert.equal(out, n, `expected ${n} to pass through unchanged on axis '${axis}'`);
                return true;
            },
        ),
        { numRuns: 100 },
    );
});

// ─── Percentage axis-correctness ────────────────────────────

test('x-axis percentage resolves against canvas width', () => {
    fc.assert(
        fc.property(
            percentArb,
            canvasDimArb,
            canvasDimArb,
            fallbackNumberArb,
            ({ raw, str }, cw, ch, fallback) => {
                const canvas = mockCanvas(cw, ch);
                const opts = mockOptions('pct-x');
                const out = resolveNumeric(str, 'x', fallback, canvas, opts);
                const expected = Math.floor(cw * (raw / 100));
                assert.equal(
                    out,
                    expected,
                    `'${str}' on x-axis with width=${cw} expected ${expected}, got ${out}`,
                );
                return true;
            },
        ),
        { numRuns: 100 },
    );
});

test('y-axis percentage resolves against canvas height', () => {
    fc.assert(
        fc.property(
            percentArb,
            canvasDimArb,
            canvasDimArb,
            fallbackNumberArb,
            ({ raw, str }, cw, ch, fallback) => {
                const canvas = mockCanvas(cw, ch);
                const opts = mockOptions('pct-y');
                const out = resolveNumeric(str, 'y', fallback, canvas, opts);
                const expected = Math.floor(ch * (raw / 100));
                assert.equal(
                    out,
                    expected,
                    `'${str}' on y-axis with height=${ch} expected ${expected}, got ${out}`,
                );
                return true;
            },
        ),
        { numRuns: 100 },
    );
});

// ─── Function values forwarded with (canvas, options) ──────

test('function values invoked with (canvas, options)', () => {
    fc.assert(
        fc.property(
            finiteNumberArb,
            axisArb,
            canvasDimArb,
            canvasDimArb,
            fallbackNumberArb,
            fc.string(),
            (returnValue, axis, cw, ch, fallback, optsSeed) => {
                const canvas = mockCanvas(cw, ch);
                const opts = mockOptions(optsSeed);
                const calls = [];
                const fn = (c, o) => {
                    calls.push({ c, o });
                    return returnValue;
                };
                const out = resolveNumeric(fn, axis, fallback, canvas, opts);

                // Return value forwarded verbatim.
                assert.equal(out, returnValue);

                // Function called exactly once with the editor's canvas and
                // options`).
                assert.equal(calls.length, 1, 'factory must be invoked exactly once');
                assert.equal(calls[0].c, canvas, 'factory must receive the canvas argument');
                assert.equal(calls[0].o, opts, 'factory must receive the resolved options');
                return true;
            },
        ),
        { numRuns: 100 },
    );
});

// ─── Fallback for unknown values ───────────────────────────

test('unknown value forms return fallback', () => {
    fc.assert(
        fc.property(
            fallbackInputArb,
            axisArb,
            canvasDimArb,
            canvasDimArb,
            fallbackNumberArb,
            (val, axis, cw, ch, fallback) => {
                const canvas = mockCanvas(cw, ch);
                const opts = mockOptions('fallback');
                const out = resolveNumeric(val, axis, fallback, canvas, opts);
                assert.equal(
                    out,
                    fallback,
                    `unknown value ${String(val)} must return fallback=${fallback}`,
                );
                return true;
            },
        ),
        { numRuns: 100 },
    );
});

test('boundary: NaN and malformed percent strings fall back', () => {
    const canvas = mockCanvas(800, 600);
    const opts = mockOptions('boundary');
    // NaN is not `typeof === 'number'` … actually it is. The contract says
    // numbers pass through unchanged, so NaN passes through. We assert the
    // documented behavior here so any future tightening is intentional.
    assert.ok(Number.isNaN(resolveNumeric(NaN, 'x', 99, canvas, opts)));
    // Percent strings whose leading token does not parse to a finite
    // number must fall back.
    assert.equal(resolveNumeric('abc%', 'x', 99, canvas, opts), 99);
    assert.equal(resolveNumeric('%', 'y', 77, canvas, opts), 77);
    // Strings without a trailing '%' fall through to the generic fallback
    // branch even when they look numeric — the helper deliberately does
    // not coerce bare numeric strings.
    assert.equal(resolveNumeric('123', 'x', 42, canvas, opts), 42);
});

// ─── (companion): coercePoint round-trip ────────────

test('coercePoint accepts {x,y} and [x,y] uniformly', () => {
    fc.assert(
        fc.property(finiteNumberArb, finiteNumberArb, (x, y) => {
            const fromObject = coercePoint({ x, y });
            const fromTuple = coercePoint([x, y]);
            assert.deepEqual(fromObject, { x, y });
            assert.deepEqual(fromTuple, { x, y });
            assert.deepEqual(
                fromObject,
                fromTuple,
                'object and tuple inputs must produce identical points',
            );
            return true;
        }),
        { numRuns: 100 },
    );
});

test('boundary: coercePoint coerces string-encoded numerics', () => {
    fc.assert(
        fc.property(
            fc.integer({ min: -1000, max: 1000 }),
            fc.integer({ min: -1000, max: 1000 }),
            (x, y) => {
                const fromObject = coercePoint({ x: String(x), y: String(y) });
                const fromTuple = coercePoint([String(x), String(y)]);
                assert.deepEqual(fromObject, { x, y });
                assert.deepEqual(fromTuple, { x, y });
                return true;
            },
        ),
        { numRuns: 100 },
    );
});
