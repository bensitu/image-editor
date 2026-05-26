// Placeholder visibility uses hidden + aria-hidden only
//
//   For any placeholder/container visibility transition, the
//   visibility service SHALL update only standard DOM state
//   (`hidden` and `aria-hidden`) and SHALL NOT add or remove
//   Bootstrap `d-none` classes. If the container reference is
//   missing, placeholder visibility SHALL still be updated
//   correctly.
//
// Owner module: `src/ui/visibility-state.ts`. The unit under test
// is `setPlaceholderVisible(placeholder, container, show)` — the
// pure function the orchestrator's private
// `_setPlaceholderVisible` delegates to. Centralizing the
// hidden/aria-hidden transition here removes the legacy coupling to
// Bootstrap's `d-none` / `d-flex` utility classes.
//
// Sub-properties exercised here:
//
//   30.1 Show transition: for any starting class set,
//        calling `setPlaceholderVisible(p, c, true)` results in
//        `p.hidden === false`, `p.getAttribute('aria-hidden') === 'false'`,
//        `c.hidden === true`, and `c.getAttribute('aria-hidden') === 'true'`.
//   30.2 Hide transition: for any starting class set,
//        calling `setPlaceholderVisible(p, c, false)` results in
//        `p.hidden === true`, `p.getAttribute('aria-hidden') === 'true'`,
//        `c.hidden === false`, and `c.getAttribute('aria-hidden') === 'false'`.
//   30.3 Class lists are not mutated: for any starting
//        class set on either element — including class sets that
//        contain `d-none` and/or `d-flex` — the function does NOT
//        add or remove any class. The exact set of class tokens is
//        preserved across both `show=true` and `show=false`
//        transitions.
//   30.4 Null container is safe: when `containerElement`
//        is `null`, the placeholder is still updated according to
//        the documented contract and the call does not throw.
//
// Runtime note: Node 24+ strips TypeScript syntax natively, so the
// test imports the module under test directly from source. The
// shared `ts-resolve-hook` rewrites `.js` import specifiers in the
// loaded TypeScript files to their `.ts` siblings, mirroring the
// project's `moduleResolution: "bundler"` setting. The function
// reaches into DOM properties (`hidden`, `setAttribute`, `classList`),
// so the test installs a per-iteration JSDOM document and creates
// real `HTMLElement`s before exercising the helper.

import { register } from 'node:module';

register('./helpers/ts-resolve-hook.mjs', import.meta.url);

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { JSDOM } from 'jsdom';

const { setPlaceholderVisible } = await import(
    '../src/ui/visibility-state.ts'
);

// ─── JSDOM setup helper ────────────────────────────────────────────────────

/**
 * Install a fresh JSDOM document on `globalThis` and return the
 * document so each property iteration can mint its own placeholder
 * and container `<div>`s. Keeping the document install inside the
 * predicate makes each iteration independent: there is no shared
 * mutable state to leak between fast-check shrinks.
 */
function installDom() {
    const dom = new JSDOM('<!DOCTYPE html><body></body>');
    const { document, HTMLElement } = dom.window;
    globalThis.document = document;
    globalThis.HTMLElement = HTMLElement;
    return document;
}

/**
 * Create a `<div>` in the given document, apply the supplied class
 * tokens to it via `classList.add`, and return the element. Using
 * `classList.add` instead of setting `className` directly mirrors
 * how production HTML markup is authored and ensures duplicate
 * tokens in the input array are deduplicated by the DOM exactly
 * once before assertions compare the resulting class set.
 */
function makeElement(document, classTokens) {
    const el = document.createElement('div');
    for (const token of classTokens) {
        el.classList.add(token);
    }
    return el;
}

/**
 * Snapshot the class tokens on an element as a sorted array, which
 * is the comparison shape used by the no-mutation assertions below.
 * Sorting decouples the assertion from token insertion order while
 * still detecting any added or removed token.
 */
function classTokens(el) {
    return Array.from(el.classList).slice().sort();
}

// ─── Arbitraries ───────────────────────────────────────────────────────────

// Pool of class tokens that the generated starting class sets draw
// from. The pool intentionally includes Bootstrap utility classes that the
// helper must leave untouched, plus a few unrelated tokens to confirm the
// helper is class-agnostic rather than `d-none`-specific.
const CLASS_TOKEN_POOL = [
    'd-none',
    'd-flex',
    'image-editor-placeholder',
    'image-editor-container',
    'p-3',
    'rounded',
    'border',
    'bg-light',
];

// A starting class set is a unique subset of the pool. `subarray`
// already preserves uniqueness because it picks distinct indices.
const classSetArb = fc.subarray(CLASS_TOKEN_POOL, {
    minLength: 0,
    maxLength: CLASS_TOKEN_POOL.length,
});

// ─── show=true updates standard DOM state ────────

test('setPlaceholderVisible(p, c, true) sets hidden/aria-hidden per the documented contract', () => {
    fc.assert(
        fc.property(classSetArb, classSetArb, (placeholderClasses, containerClasses) => {
            const document = installDom();
            const placeholder = makeElement(document, placeholderClasses);
            const container = makeElement(document, containerClasses);

            setPlaceholderVisible(placeholder, container, true);

            assert.equal(
                placeholder.hidden,
                false,
                'show=true must set placeholder.hidden = false',
            );
            assert.equal(
                placeholder.getAttribute('aria-hidden'),
                'false',
                "show=true must set placeholder aria-hidden = 'false'",
            );
            assert.equal(
                container.hidden,
                true,
                'show=true must set container.hidden = true',
            );
            assert.equal(
                container.getAttribute('aria-hidden'),
                'true',
                "show=true must set container aria-hidden = 'true'",
            );
            return true;
        }),
        { numRuns: 100 },
    );
});

// ─── show=false updates standard DOM state ───────

test('setPlaceholderVisible(p, c, false) sets hidden/aria-hidden per the documented contract', () => {
    fc.assert(
        fc.property(classSetArb, classSetArb, (placeholderClasses, containerClasses) => {
            const document = installDom();
            const placeholder = makeElement(document, placeholderClasses);
            const container = makeElement(document, containerClasses);

            setPlaceholderVisible(placeholder, container, false);

            assert.equal(
                placeholder.hidden,
                true,
                'show=false must set placeholder.hidden = true',
            );
            assert.equal(
                placeholder.getAttribute('aria-hidden'),
                'true',
                "show=false must set placeholder aria-hidden = 'true'",
            );
            assert.equal(
                container.hidden,
                false,
                'show=false must set container.hidden = false',
            );
            assert.equal(
                container.getAttribute('aria-hidden'),
                'false',
                "show=false must set container aria-hidden = 'false'",
            );
            return true;
        }),
        { numRuns: 100 },
    );
});

// ─── classList is never mutated ──────────────────

test('setPlaceholderVisible never adds or removes class tokens', () => {
    fc.assert(
        fc.property(classSetArb, classSetArb, (placeholderClasses, containerClasses) => {
            const document = installDom();
            const placeholder = makeElement(document, placeholderClasses);
            const container = makeElement(document, containerClasses);

            const placeholderBefore = classTokens(placeholder);
            const containerBefore = classTokens(container);

            // Drive the helper through both transitions in sequence.
            // `d-none` may be present in the starting set; the helper
            // must leave it alone in both directions, since legacy
            // toggled `d-none` / `d-flex` and current must not.
            setPlaceholderVisible(placeholder, container, true);

            assert.deepEqual(
                classTokens(placeholder),
                placeholderBefore,
                'show=true must not add or remove placeholder class tokens',
            );
            assert.deepEqual(
                classTokens(container),
                containerBefore,
                'show=true must not add or remove container class tokens',
            );

            setPlaceholderVisible(placeholder, container, false);

            assert.deepEqual(
                classTokens(placeholder),
                placeholderBefore,
                'show=false must not add or remove placeholder class tokens',
            );
            assert.deepEqual(
                classTokens(container),
                containerBefore,
                'show=false must not add or remove container class tokens',
            );
            return true;
        }),
        { numRuns: 100 },
    );
});

// ─── null container is safe ──────────────────────

test('setPlaceholderVisible updates the placeholder when container is null', () => {
    fc.assert(
        fc.property(classSetArb, fc.boolean(), (placeholderClasses, show) => {
            const document = installDom();
            const placeholder = makeElement(document, placeholderClasses);
            const placeholderBefore = classTokens(placeholder);

            // Helper must not throw with a null container reference,
            // and must still apply the show/hide branch to the
            // placeholder side.
            assert.doesNotThrow(() => {
                setPlaceholderVisible(placeholder, null, show);
            }, 'null container must not cause setPlaceholderVisible to throw');

            assert.equal(
                placeholder.hidden,
                !show,
                'placeholder.hidden must be the inverse of show, even when container is null',
            );
            assert.equal(
                placeholder.getAttribute('aria-hidden'),
                show ? 'false' : 'true',
                "placeholder aria-hidden must mirror show, even when container is null",
            );
            assert.deepEqual(
                classTokens(placeholder),
                placeholderBefore,
                'placeholder class tokens must not change when container is null',
            );
            return true;
        }),
        { numRuns: 100 },
    );
});
