/**
 * @file placeholder-visibility.property.test.mjs
 *
 * Type:
 *   Property test
 *
 * Purpose:
 *   Verifies src/ui/visibility-state.ts setPlaceholderVisible for placeholder and
 *   canvas-container visibility transitions. The property focuses on standard DOM
 *   hidden and aria-hidden state and intentionally excludes CSS utility class
 *   mutation.
 *
 * Scope:
 *   - Show and hide transitions set hidden and aria-hidden on both elements.
 *   - Existing class lists are preserved exactly.
 *   - A null container is safe and still updates the placeholder.
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
 *   - Fabric/canvas behavior is mocked where needed
 *
 * Run:
 *   node --test tests/placeholder-visibility.property.test.mjs
 *
 * Notes:
 *   - Prefer behavior-level assertions over implementation-detail checks.
 *   - Keep this file focused on placeholder visibility state only.
 */

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
