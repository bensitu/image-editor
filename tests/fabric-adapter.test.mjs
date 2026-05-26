/**
 * Unit tests for the Fabric.js v7 adapter detection branches.
 *
 * Owner module: `src/fabric/fabric-adapter.ts` — `detectFabric`.
 *
 * Branches under test:
 *
 *   1. **Explicit module form (4.1)** — first arg has a `Canvas` function
 *      property → treat first arg as the Fabric module and second arg as
 *      the options partial.
 *   2. **Global form (4.2)** — first arg lacks `Canvas` → use first arg as
 *      options and read the Fabric module from `globalScope.fabric`.
 *   3. **Miss (4.3)** — neither path produces a usable module → emit a
 *      single descriptive `console.error` and return
 *      `{ fabric: null, _fabricLoaded: false }`.
 *
 * The "init()/loadImage() are no-ops resolving to undefined" portion of
 * the documented contract is wired into `ImageEditor` itself. This file
 * scopes itself to the adapter's pure detection contract.
 *
 * Runtime note: Node 24+ strips TypeScript syntax natively, so the test
 * imports the module under test directly from source — no separate build
 * step is required to run this unit suite in isolation.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { detectFabric } from '../src/fabric/fabric-adapter.ts';

// ─── Helpers ──────────────────────────────────────────────────────────────

/**
 * Build a minimal stub that satisfies `looksLikeFabricModule`'s structural
 * check: a plain object whose `Canvas` property is a function. The
 * adapter only inspects `Canvas`, so the rest of a real Fabric module is
 * intentionally omitted to keep the test scoped to detection.
 */
function makeFakeFabric() {
    return { Canvas: function FakeCanvas() {} };
}

/**
 * Run `body` with `console.error` replaced by a recorder. Restores the
 * original method on both success and failure so a failing assertion
 * cannot leak the monkey patch into other tests.
 */
function withConsoleError(body) {
    const calls = [];
    const original = console.error;
    console.error = (...args) => {
        calls.push(args);
    };
    try {
        const result = body(calls);
        return { calls, result };
    } finally {
        console.error = original;
    }
}

// ─── Branch 1: explicit module form ─────────────────────

test('detectFabric: explicit module form treats first arg as Fabric and second as options', () => {
    const fakeFabric = makeFakeFabric();
    const userOptions = { canvasWidth: 100 };

    const { calls, result } = withConsoleError(() =>
        detectFabric(fakeFabric, userOptions),
    );

    assert.equal(result.fabric, fakeFabric, 'fabric should be the explicit module');
    assert.equal(result._fabricLoaded, true, '_fabricLoaded must be true on hit');
    assert.deepEqual(result.options, userOptions, 'options must come from the second arg');
    assert.equal(result.options.canvasWidth, 100);
    assert.equal(calls.length, 0, 'no console.error on the explicit-module hit');
});

test('detectFabric: explicit module form normalizes missing options to {}', () => {
    const fakeFabric = makeFakeFabric();

    const { calls, result } = withConsoleError(() =>
        detectFabric(fakeFabric, undefined),
    );

    assert.equal(result.fabric, fakeFabric);
    assert.equal(result._fabricLoaded, true);
    assert.deepEqual(result.options, {}, 'undefined options must collapse to {}');
    assert.equal(calls.length, 0);
});

// ─── Branch 2: global form ──────────────────────────────

test('detectFabric: global form uses globalScope.fabric and treats first arg as options', () => {
    const fakeFabric = makeFakeFabric();
    const globalScope = { fabric: fakeFabric };
    const userOptions = { canvasWidth: 200 };

    const { calls, result } = withConsoleError(() =>
        detectFabric(userOptions, undefined, globalScope),
    );

    assert.equal(result.fabric, fakeFabric, 'fabric must come from globalScope.fabric');
    assert.equal(result._fabricLoaded, true);
    assert.deepEqual(result.options, userOptions, 'first arg must be the options partial');
    assert.equal(result.options.canvasWidth, 200);
    assert.equal(calls.length, 0, 'no console.error on the global-form hit');
});

test('detectFabric: global form accepts null first arg and yields empty options', () => {
    const fakeFabric = makeFakeFabric();
    const globalScope = { fabric: fakeFabric };

    const { calls, result } = withConsoleError(() =>
        detectFabric(null, undefined, globalScope),
    );

    assert.equal(result.fabric, fakeFabric);
    assert.equal(result._fabricLoaded, true);
    assert.deepEqual(result.options, {}, 'null first arg must collapse to {}');
    assert.equal(calls.length, 0);
});

test('detectFabric: global form accepts undefined first arg and yields empty options', () => {
    const fakeFabric = makeFakeFabric();
    const globalScope = { fabric: fakeFabric };

    const { calls, result } = withConsoleError(() =>
        detectFabric(undefined, undefined, globalScope),
    );

    assert.equal(result.fabric, fakeFabric);
    assert.equal(result._fabricLoaded, true);
    assert.deepEqual(result.options, {});
    assert.equal(calls.length, 0);
});

// ─── Branch 3: miss ─────────────────────────────────────

test('detectFabric: miss returns null fabric, false _fabricLoaded, and logs once', () => {
    const userOptions = {};
    const globalScope = {}; // no `fabric` attached

    const { calls, result } = withConsoleError(() =>
        detectFabric(userOptions, undefined, globalScope),
    );

    assert.equal(result.fabric, null, 'fabric must be null on miss');
    assert.equal(result._fabricLoaded, false, '_fabricLoaded must be false on miss');
    assert.deepEqual(result.options, userOptions, 'options must still pass through on miss');

    assert.equal(calls.length, 1, 'console.error must be called exactly once on miss');
    assert.equal(calls[0].length, 1, 'console.error must be called with a single message');
    assert.equal(typeof calls[0][0], 'string', 'console.error message must be a string');
    assert.match(
        calls[0][0],
        /fabric\.js v7 is not available/,
        'console.error message must name the missing dependency',
    );
});

test('detectFabric: miss with null first arg still yields empty options and one log', () => {
    const globalScope = {}; // no `fabric` attached

    const { calls, result } = withConsoleError(() =>
        detectFabric(null, undefined, globalScope),
    );

    assert.equal(result.fabric, null);
    assert.equal(result._fabricLoaded, false);
    assert.deepEqual(result.options, {}, 'null first arg collapses to {} on miss too');
    assert.equal(calls.length, 1, 'console.error must be called exactly once on miss');
    assert.match(calls[0][0], /fabric\.js v7 is not available/);
});

test('detectFabric: miss when globalScope.fabric is present but lacks Canvas', () => {
    // `fabric` is attached but its `Canvas` is not a function — the
    // structural check in `looksLikeFabricModule` must reject it and the
    // adapter must fall through to the miss branch.
    const globalScope = { fabric: { Canvas: 'not-a-function' } };

    const { calls, result } = withConsoleError(() =>
        detectFabric({}, undefined, globalScope),
    );

    assert.equal(result.fabric, null);
    assert.equal(result._fabricLoaded, false);
    assert.equal(calls.length, 1);
    assert.match(calls[0][0], /fabric\.js v7 is not available/);
});
