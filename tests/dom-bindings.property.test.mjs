// Idempotent dispose with bindings drain
//
//   For any sequence of `init`, DOM binding, public operation, and
//   repeated `dispose()` calls, the bindings registry SHALL remove
//   each listener at most once, clear itself after disposal, make
//   subsequent dispose calls no-ops, and make disposed DOM handlers
//   exit before touching the canvas.
//
// Owner module: `src/ui/dom-bindings.ts` — the registry primitive
// owned by `image-editor.ts`'s init/dispose path. The unit under
// test here is the `DomBindings` class itself; the editor-level
// dispose ordering is exercised separately by .
//
// Sub-properties exercised here:
//
//   29.1 Listeners attach: for any sequence of
//        `bindIfExists` calls with valid keys, each successful call
//        increments `registry.size()` by exactly 1.
//   29.2 Bound handlers gated by disposed: when
//        `isDisposed()` returns `true`, dispatching the bound event
//        does NOT invoke the user-supplied handler.
//   29.3 removeAll detaches all: after `removeAll()`
//        the registry size is 0 and no previously-bound handler
//        fires on a fresh dispatch of its event type.
//   29.4 removeAll idempotent: a second `removeAll()`
//        does not throw and leaves the registry empty.
//   29.5 Missing element silent: `bindIfExists`
//        with a key that does not resolve to an existing element
//        returns `false` and does NOT grow the registry.
//
// Runtime note: Node 24+ strips TypeScript syntax natively, so the
// test imports the module under test directly from source. The
// shared `ts-resolve-hook` rewrites `.js` import specifiers in
// `dom-bindings.ts` to their `.ts` siblings, mirroring the project's
// `moduleResolution: "bundler"` setting. `DomBindings` reaches into
// `document.getElementById`, so the test installs a per-run JSDOM
// document on `globalThis` before exercising the class.

import { register } from 'node:module';

register('./helpers/ts-resolve-hook.mjs', import.meta.url);

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { JSDOM } from 'jsdom';

const { DomBindings } = await import('../src/ui/dom-bindings.ts');

// ─── JSDOM setup helper ────────────────────────────────────────────────────

/**
 * Install a fresh JSDOM document on `globalThis` and append one
 * `<div id=...>` per `elementId` so `document.getElementById(id)`
 * returns a real element with a working event-dispatch path.
 *
 * Returning the `Event` constructor pulled off the JSDOM window makes
 * `new Event('click')` work without leaking the JSDOM globals into
 * the test scope. The caller is expected to discard the returned
 * `dom` once the property iteration is done; JSDOM has no per-iteration
 * cleanup beyond losing references.
 */
function installDom(elementIds) {
    const dom = new JSDOM('<!DOCTYPE html><body></body>');
    const { document, HTMLElement, Event } = dom.window;
    globalThis.document = document;
    globalThis.HTMLElement = HTMLElement;
    for (const id of elementIds) {
        const el = document.createElement('div');
        el.id = id;
        document.body.appendChild(el);
    }
    return { document, Event };
}

// ─── Arbitraries ───────────────────────────────────────────────────────────

// Use a small fixed pool of `ElementKey` strings so each generated
// scenario can refer to keys that may or may not exist in the DOM.
// The pool intentionally includes a mix of canonical keys from
// `ElementIdMap` plus an "unknown" key the resolver maps to `null`,
// so exercises both "key omitted from idMap" and
// "key in idMap but element missing from DOM" paths.
const KEY_POOL = [
    'zoomInBtn',
    'zoomOutBtn',
    'undoBtn',
    'redoBtn',
    'rotateLeftBtn',
    'rotateRightBtn',
    'addMaskBtn',
    'removeMaskBtn',
    'mergeBtn',
    'downloadBtn',
    'unmappedKey', // resolver returns null for this one
];

const keyArb = fc.constantFrom(...KEY_POOL);

// Event types are arbitrary strings as far as the registry is
// concerned. Restrict to a small set so dispatching matches what was
// bound.
const eventTypeArb = fc.constantFrom('click', 'change', 'input', 'keydown');

const bindingArb = fc.record({
    key: keyArb,
    eventType: eventTypeArb,
});

// Subset of keys to materialize as actual DOM nodes for a given run.
// `unmappedKey` is intentionally never included so it always
// represents a missing-element case.
const presentKeysArb = fc
    .subarray(KEY_POOL.filter((k) => k !== 'unmappedKey'), {
        minLength: 0,
        maxLength: KEY_POOL.length - 1,
    });

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Build a resolver and disposed-flag for `DomBindings`. The resolver
 * returns the key itself as the element ID for every key except
 * `unmappedKey`, which returns `null` so `bindIfExists` exercises the
 * "missing key" path.
 */
function makeBindings({ disposed = { value: false } } = {}) {
    const resolve = (key) => (key === 'unmappedKey' ? null : key);
    const isDisposed = () => disposed.value;
    return {
        bindings: new DomBindings(resolve, isDisposed),
        disposed,
    };
}

// ─── registry grows by 1 per successful bind ─────

test('bindIfExists records every successful attachment in the registry', () => {
    fc.assert(
        fc.property(
            presentKeysArb,
            fc.array(bindingArb, { minLength: 0, maxLength: 12 }),
            (presentKeys, bindings) => {
                const { Event } = installDom(presentKeys);
                const { bindings: registry } = makeBindings();

                let expected = 0;
                for (const { key, eventType } of bindings) {
                    const sizeBefore = registry.size();
                    const ok = registry.bindIfExists(
                        key,
                        eventType,
                        () => {},
                    );
                    if (ok) {
                        expected += 1;
                        assert.equal(
                            registry.size(),
                            sizeBefore + 1,
                            'a successful bindIfExists must grow the registry by exactly 1',
                        );
                        // The key must have actually been resolvable AND in
                        // the DOM. Cross-check against the present-keys set
                        // so the resolver/document contract is honored.
                        assert.ok(
                            presentKeys.includes(key),
                            'bindIfExists returned true for a key whose element is not in the DOM',
                        );
                    } else {
                        assert.equal(
                            registry.size(),
                            sizeBefore,
                            'a failed bindIfExists must NOT grow the registry',
                        );
                    }
                }
                assert.equal(
                    registry.size(),
                    expected,
                    'registry size must equal the count of successful bindings',
                );
                // Touch Event so the import is not flagged as unused; also
                // catches a JSDOM regression where the constructor is
                // missing from window.
                assert.equal(typeof Event, 'function');
                return true;
            },
        ),
        { numRuns: 100 },
    );
});

// ─── disposed handlers exit before invoking the user fn ─────

test('bound handlers exit when isDisposed() is true', () => {
    fc.assert(
        fc.property(
            presentKeysArb.filter((arr) => arr.length > 0),
            eventTypeArb,
            (presentKeys, eventType) => {
                const { document, Event } = installDom(presentKeys);
                const disposed = { value: false };
                const { bindings: registry } = makeBindings({ disposed });

                // Bind a handler on every present key for the same event
                // type, then dispatch and confirm it fires while alive.
                let calls = 0;
                for (const key of presentKeys) {
                    const ok = registry.bindIfExists(
                        key,
                        eventType,
                        () => {
                            calls += 1;
                        },
                    );
                    assert.ok(
                        ok,
                        'sanity: present keys must bind successfully',
                    );
                }
                for (const key of presentKeys) {
                    document.getElementById(key).dispatchEvent(
                        new Event(eventType),
                    );
                }
                assert.equal(
                    calls,
                    presentKeys.length,
                    'handlers must fire while not disposed',
                );

                // Flip the disposed flag and dispatch again. The wrapper
                // installed by bindIfExists must short-circuit, so the
                // call counter must NOT advance.
                disposed.value = true;
                const callsBeforeDispatch = calls;
                for (const key of presentKeys) {
                    document.getElementById(key).dispatchEvent(
                        new Event(eventType),
                    );
                }
                assert.equal(
                    calls,
                    callsBeforeDispatch,
                    'handlers must not fire after isDisposed() returns true',
                );
                return true;
            },
        ),
        { numRuns: 100 },
    );
});

// ─── removeAll detaches all and zeros the registry ──────────

test('removeAll() detaches every recorded listener and clears the registry', () => {
    fc.assert(
        fc.property(
            presentKeysArb.filter((arr) => arr.length > 0),
            fc.array(bindingArb, { minLength: 1, maxLength: 12 }),
            (presentKeys, bindings) => {
                const { document, Event } = installDom(presentKeys);
                const { bindings: registry } = makeBindings();

                let calls = 0;
                const successfulBinds = [];
                for (const { key, eventType } of bindings) {
                    const ok = registry.bindIfExists(
                        key,
                        eventType,
                        () => {
                            calls += 1;
                        },
                    );
                    if (ok) successfulBinds.push({ key, eventType });
                }

                // Dispatch each *unique* (key, eventType) pair exactly
                // once. A single dispatch fires every listener attached
                // to that pair, so total handler invocations must equal
                // the number of successful bindings — duplicate
                // (key, eventType) inputs intentionally bind multiple
                // distinct wrappers on the same element/event.
                const dispatched = new Set();
                for (const { key, eventType } of successfulBinds) {
                    const tag = `${key}\u0000${eventType}`;
                    if (dispatched.has(tag)) continue;
                    dispatched.add(tag);
                    document.getElementById(key).dispatchEvent(
                        new Event(eventType),
                    );
                }
                assert.equal(
                    calls,
                    successfulBinds.length,
                    'sanity: every bound handler should fire exactly once across the unique-pair dispatch sweep',
                );

                registry.removeAll();
                assert.equal(
                    registry.size(),
                    0,
                    'removeAll() must zero the registry size',
                );

                // After removeAll, dispatching the same events must NOT
                // increment the call counter — every listener was
                // detached with the same wrapper reference that was
                // attached.
                const callsBeforeDispatch = calls;
                const dispatchedAfter = new Set();
                for (const { key, eventType } of successfulBinds) {
                    const tag = `${key}\u0000${eventType}`;
                    if (dispatchedAfter.has(tag)) continue;
                    dispatchedAfter.add(tag);
                    document.getElementById(key).dispatchEvent(
                        new Event(eventType),
                    );
                }
                assert.equal(
                    calls,
                    callsBeforeDispatch,
                    'no detached handler may fire after removeAll()',
                );
                return true;
            },
        ),
        { numRuns: 100 },
    );
});

// ─── removeAll is idempotent (second call is a no-op) ───────

test('removeAll() is idempotent', () => {
    fc.assert(
        fc.property(
            presentKeysArb,
            fc.array(bindingArb, { minLength: 0, maxLength: 12 }),
            (presentKeys, bindings) => {
                installDom(presentKeys);
                const { bindings: registry } = makeBindings();

                for (const { key, eventType } of bindings) {
                    registry.bindIfExists(key, eventType, () => {});
                }

                // First removeAll empties the registry.
                registry.removeAll();
                assert.equal(registry.size(), 0);

                // Second removeAll must not throw and must leave the
                // registry empty.
                assert.doesNotThrow(
                    () => registry.removeAll(),
                    'second removeAll must not throw',
                );
                assert.equal(
                    registry.size(),
                    0,
                    'second removeAll must leave the registry empty',
                );

                // A third call for good measure — the contract is
                // "any number of repeats is a no-op", not just two.
                assert.doesNotThrow(() => registry.removeAll());
                assert.equal(registry.size(), 0);
                return true;
            },
        ),
        { numRuns: 100 },
    );
});

// ─── missing element is silent and registry-neutral ─────────

test('bindIfExists returns false and leaves the registry unchanged when the element is missing', () => {
    fc.assert(
        fc.property(
            presentKeysArb,
            keyArb,
            eventTypeArb,
            (presentKeys, key, eventType) => {
                installDom(presentKeys);
                const { bindings: registry } = makeBindings();

                const sizeBefore = registry.size();
                const elementMissing =
                    key === 'unmappedKey' || !presentKeys.includes(key);

                const ok = registry.bindIfExists(
                    key,
                    eventType,
                    () => {},
                );

                if (elementMissing) {
                    assert.equal(
                        ok,
                        false,
                        'bindIfExists must return false when the element cannot be resolved',
                    );
                    assert.equal(
                        registry.size(),
                        sizeBefore,
                        'registry size must not change for a missing element',
                    );
                } else {
                    assert.equal(
                        ok,
                        true,
                        'bindIfExists must return true when the element exists',
                    );
                    assert.equal(
                        registry.size(),
                        sizeBefore + 1,
                        'registry size must grow by 1 on a successful bind',
                    );
                }
                return true;
            },
        ),
        { numRuns: 100 },
    );
});
