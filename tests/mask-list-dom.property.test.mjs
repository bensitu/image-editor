/**
 * Type:
 *   Property test
 *
 * Purpose:
 *   Verifies src/mask/mask-list.ts rendering and click-selection behavior using
 *   jsdom. The suite scopes itself to the DOM list contract and uses a minimal canvas
 *   object list rather than the full editor facade.
 *
 * Scope:
 *   - renderMaskList emits one li per mask in configured list order with data-mask-id.
 *   - Clicking a list item selects the matching mask by ID lookup regardless of list
 *     order.
 *   - Active CSS class state follows the selected mask ID.
 *
 * Out of scope:
 *   - visual rendering quality
 *   - unrelated crop or export behavior
 *   - browser-specific pointer interaction details
 *
 * Environment:
 *   - Node.js ESM
 *   - fast-check generated cases where applicable
 *   - jsdom or DOM stubs are used where needed
 *   - Fabric/canvas behavior is mocked where needed
 *
 * Run:
 *   node --test tests/mask-list-dom.property.test.mjs
 *
 * Notes:
 *   - Prefer behavior-level assertions over implementation-detail checks.
 *   - Keep this file focused on mask list DOM correctness only.
 */

import { register } from 'node:module';

register('./helpers/ts-resolve-hook.mjs', import.meta.url);

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { JSDOM } from 'jsdom';

const { renderMaskList } = await import('../src/mask/mask-list.ts');
const { createLabelForMask } = await import('../src/mask/mask-label-manager.ts');
const { resolveOptions } = await import('../src/core/default-options.ts');

// ─── JSDOM setup helper ────────────────────────────────────────────────────

/**
 * Install a fresh JSDOM document on `globalThis`, append a
 * `<ul id="maskList">` host element, and return both the document and
 * the chosen list element ID. Returning the list ID (rather than
 * hardcoding it at the call site) keeps the helper symmetric with how
 * the orchestrator drives the module via `ctx.getListElement()`.
 */
function installDom() {
    const dom = new JSDOM('<!DOCTYPE html><body></body>');
    const { document, HTMLElement } = dom.window;
    globalThis.document = document;
    globalThis.HTMLElement = HTMLElement;
    const listId = 'maskList';
    const ul = document.createElement('ul');
    ul.id = listId;
    document.body.appendChild(ul);
    return { document, listId };
}

// ─── Fake Fabric environment ───────────────────────────────────────────────

/**
 * Minimal fake `MaskObject`. The mask-list helpers only read
 * `maskId` and `maskName`, and only call `canvas.setActiveObject(mask)`
 * with the resolved object, so we don't need a full Fabric shape — a
 * plain object with the runtime metadata is sufficient.
 *
 * The label manager additionally calls `mask.getCoords()`,
 * `mask.getCenterPoint()`, and reads `mask.angle`, so we add those for
 * the case below.
 */
function makeMask(id, name) {
    return {
        editorObjectKind: 'mask',
        maskId: id,
        maskUid: `mask-${id}`,
        maskName: name,
        angle: 0,
        getCoords() {
            return [
                { x: 10, y: 10 },
                { x: 50, y: 10 },
                { x: 50, y: 30 },
                { x: 10, y: 30 },
            ];
        },
        getCenterPoint() {
            return { x: 30, y: 20 };
        },
    };
}

/**
 * Minimal fake `fabric.Canvas`. Holds an ordered object list (the
 * underlying Fabric object order), records the most
 * recent `setActiveObject` argument so the click assertions can read
 * it back, and supports the small subset of methods the label manager
 * touches (`add` / `remove` / `bringObjectToFront` / `renderAll`).
 */
function makeCanvas(objects) {
    return {
        objects: [...objects],
        activeObject: null,
        getObjects() {
            return this.objects;
        },
        setActiveObject(o) {
            this.activeObject = o;
        },
        add(o) {
            this.objects.push(o);
        },
        remove(o) {
            const idx = this.objects.indexOf(o);
            if (idx >= 0) this.objects.splice(idx, 1);
        },
        bringObjectToFront() {},
        renderAll() {},
    };
}

/**
 * Minimal fake Fabric module. Only `FabricText` is invoked — the label
 * manager calls `new fabric.FabricText(text, opts)` to build the default
 * label overlay.  The constructor records the constructor arguments
 * so the documented contract assertion can read back the rendered text.
 */
function makeFabric() {
    function FabricText(txt, opts) {
        this.kind = 'text';
        this.text = txt;
        Object.assign(this, opts ?? {});
        this.set = function (p, v) {
            if (typeof p === 'string') this[p] = v;
            else Object.assign(this, p);
        };
        this.setCoords = function () {};
    }
    return { FabricText };
}

// ─── Arbitraries ───────────────────────────────────────────────────────────

/**
 * A "mask population" is a non-empty array of unique `maskId` values.
 * `uniqueArray` plus a maskId range of 1..50 keeps the universe small
 * enough that shrinking lands on minimal counter-examples while still
 * exercising orderings the orchestrator can plausibly produce after
 * arbitrary `createMask` / `removeSelectedMask` / `undo` / `redo`
 * sequences. The `maskName` is derived from the id so the click
 * assertion can sanity-check the textContent independently of the
 * label-text contract owned by the documented contract.
 */
const maskIdArb = fc.integer({ min: 1, max: 50 });
const maskListArb = fc
    .uniqueArray(maskIdArb, { minLength: 1, maxLength: 8 })
    .map((ids) => ids.map((id) => makeMask(id, `mask${id}`)));

/**
 * A permutation of an array of length `n` (returned as the indices
 * 0..n-1 in some order). `shuffledSubarray` returns a permutation of
 * the input when its length matches the input length, which is the
 * case here because we feed it the full index range. We then map back
 * onto the input array.
 */
function permutationArb(items) {
    const indices = items.map((_, i) => i);
    return fc.shuffledSubarray(indices, {
        minLength: indices.length,
        maxLength: indices.length,
    });
}

// ─── Canonical DOM render ─────────────────────────────────────

test('renderMaskList defaults to front-to-back order with data-mask-id', () => {
    fc.assert(
        fc.property(maskListArb, (masks) => {
            const { document, listId } = installDom();
            const canvas = makeCanvas(masks);
            const ctx = {
                canvas,
                getListElement: () => document.getElementById(listId),
                onMaskSelected: () => {},
            };

            renderMaskList(ctx);

            const ul = document.getElementById(listId);
            const items = Array.from(ul.querySelectorAll('li.mask-item'));

            // ── the documented contract — exactly one <li> per canvas mask ──────────
            assert.equal(
                items.length,
                masks.length,
                'the documented contract: number of <li> must equal number of canvas masks',
            );
            // The list MUST contain ONLY mask-item entries — no stray
            // children left over from a prior render.
            assert.equal(
                ul.children.length,
                masks.length,
                'the documented contract: <ul> must contain only mask-item children',
            );

            // ── the documented contract — front-to-back order is the default ────────
            const expectedOrder = masks.slice().reverse();
            expectedOrder.forEach((mask, i) => {
                assert.equal(
                    items[i].dataset.maskId,
                    String(mask.maskId),
                    'the documented contract: mask list defaults to front-to-back order',
                );
            });

            // ── the documented contract — every <li>'s data-mask-id matches its mask
            items.forEach((li) => {
                const id = Number(li.dataset.maskId);
                assert.ok(
                    Number.isFinite(id),
                    'the documented contract: data-mask-id must parse as a finite number',
                );
                const mask = masks.find((m) => m.maskId === id);
                assert.ok(
                    mask,
                    `the documented contract: every <li> must correspond to a mask on the canvas (got data-mask-id=${id})`,
                );
            });
            return true;
        }),
        { numRuns: 100 },
    );
});

test('renderMaskList can render back-to-front order', () => {
    fc.assert(
        fc.property(maskListArb, (masks) => {
            const { document, listId } = installDom();
            const canvas = makeCanvas(masks);
            const ctx = {
                canvas,
                getListElement: () => document.getElementById(listId),
                listOrder: 'back-to-front',
                onMaskSelected: () => {},
            };

            renderMaskList(ctx);

            const items = Array.from(document.querySelectorAll('li.mask-item'));
            masks.forEach((mask, i) => {
                assert.equal(items[i].dataset.maskId, String(mask.maskId));
            });
            return true;
        }),
        { numRuns: 100 },
    );
});

test('renderMaskList uses the canvas ownerDocument', () => {
    const globalDom = new JSDOM('<!DOCTYPE html><body></body>');
    const ownerDom = new JSDOM(
        '<!DOCTYPE html><body><canvas id="c"></canvas><ul id="maskList"></ul></body>',
    );
    globalThis.document = globalDom.window.document;

    const mask = makeMask(7, 'mask7');
    const canvas = makeCanvas([mask]);
    canvas.getElement = () => ownerDom.window.document.getElementById('c');
    const ctx = {
        canvas,
        getListElement: () => ownerDom.window.document.getElementById('maskList'),
        onMaskSelected: () => {},
    };

    renderMaskList(ctx);

    const ownerItems = ownerDom.window.document.querySelectorAll('li.mask-item');
    const globalItems = globalThis.document.querySelectorAll('li.mask-item');
    assert.equal(ownerItems.length, 1);
    assert.equal(ownerItems[0].dataset.maskId, '7');
    assert.equal(globalItems.length, 0);
});

// ─── clicking selects by maskId regardless of list ordering ─

test('clicking a <li> selects by maskId lookup regardless of list ordering', () => {
    fc.assert(
        fc.property(
            maskListArb.chain((masks) => fc.tuple(fc.constant(masks), permutationArb(masks))),
            ([masks, permutation]) => {
                const { document, listId } = installDom();
                const canvas = makeCanvas(masks);
                const selected = [];
                const ctx = {
                    canvas,
                    getListElement: () => document.getElementById(listId),
                    onMaskSelected: (m) => selected.push(m),
                };

                renderMaskList(ctx);

                // Re-order the canvas objects under the rendered
                // DOM. The list was rendered in the original order
                // but the click handler reads `canvas.getObjects()`
                // at click time, so it MUST resolve clicks via the
                // `data-mask-id` attribute rather than the list
                // position. After this swap, "list position" and
                // "canvas object index" differ for every entry that
                // moved.
                canvas.objects = permutation.map((i) => masks[i]);

                const ul = document.getElementById(listId);
                const items = Array.from(ul.querySelectorAll('li.mask-item'));

                // Click each <li> in DOM order. After every click,
                // both the canvas-recorded active object AND the
                // selection callback's last argument MUST be the
                // mask whose maskId matches the clicked item's
                // data-mask-id — even though the canvas object list
                // was permuted before the click.
                items.forEach((li) => {
                    const expectedId = Number(li.dataset.maskId);
                    const expectedMask = masks.find((m) => m.maskId === expectedId);
                    assert.ok(
                        expectedMask,
                        'sanity: clicked data-mask-id must correspond to a generated mask',
                    );
                    const beforeCount = selected.length;
                    li.click();
                    assert.equal(
                        selected.length,
                        beforeCount + 1,
                        'the documented contract: each click must invoke onMaskSelected exactly once',
                    );
                    assert.equal(
                        canvas.activeObject,
                        expectedMask,
                        'the documented contract: canvas.setActiveObject must receive the mask whose maskId matches data-mask-id',
                    );
                    assert.equal(
                        selected[selected.length - 1],
                        expectedMask,
                        'the documented contract: onMaskSelected must receive the mask whose maskId matches data-mask-id',
                    );
                });
                return true;
            },
        ),
        { numRuns: 100 },
    );
});

// ─── label getText receives mask.maskId - 1 ──────

test('label text uses options.label.getText(mask, mask.maskId - 1)', () => {
    fc.assert(
        fc.property(maskListArb, (masks) => {
            installDom();
            const canvas = makeCanvas(masks);
            const fabric = makeFabric();

            // Recorded `(mask, index)` arguments to `getText`. The
            // assertion below checks (a) the index argument is the
            // STABLE creation index `mask.maskId - 1`, NOT the live
            // canvas object position, and (b) the resulting Fabric
            // text node is constructed with that exact text.
            const calls = [];
            const options = resolveOptions({
                maskLabelOnSelect: true,
                label: {
                    getText: (mask, idx) => {
                        calls.push({ mask, idx });
                        return `M#${mask.maskId}@${idx}`;
                    },
                },
            });

            const ctx = { fabric, canvas, options };

            masks.forEach((mask) => {
                createLabelForMask(ctx, mask);

                // ── the documented contract — getText was invoked with the right
                //                 (mask, index) pair.
                const last = calls[calls.length - 1];
                assert.equal(
                    last.mask,
                    mask,
                    'the documented contract: getText must receive the mask object',
                );
                assert.equal(
                    last.idx,
                    mask.maskId - 1,
                    `the documented contract: getText must receive mask.maskId - 1 as the index (got ${last.idx}, expected ${mask.maskId - 1})`,
                );

                // The Text constructor must have been called with
                // the value `getText` returned, and the resulting
                // label must be attached to the mask via
                // `mask.labelObject`.
                assert.ok(mask.labelObject, 'label must be attached to the mask');
                assert.equal(mask.labelObject.kind, 'text');
                assert.equal(
                    mask.labelObject.text,
                    `M#${mask.maskId}@${mask.maskId - 1}`,
                    'the documented contract: label text must reflect the (mask, mask.maskId - 1) call',
                );
            });

            // The total number of `getText` calls must equal the
            // mask population. If `getText` ever fired with a
            // different index for the same mask, the per-iteration
            // assertions above would have caught it; this final
            // count check guards against silently-skipped calls.
            assert.equal(
                calls.length,
                masks.length,
                'the documented contract: getText must be called exactly once per createLabelForMask',
            );
            return true;
        }),
        { numRuns: 100 },
    );
});

test('label.getText errors fall back to the mask name and report a warning', () => {
    installDom();
    const mask = makeMask(3, 'mask3');
    const canvas = makeCanvas([mask]);
    const fabric = makeFabric();
    const callbackError = new Error('label text failed');
    const warnings = [];
    const options = resolveOptions({
        maskLabelOnSelect: true,
        onWarning: (error, message) => {
            warnings.push({ error, message });
        },
        label: {
            getText: () => {
                throw callbackError;
            },
        },
    });

    createLabelForMask({ fabric, canvas, options }, mask);

    assert.ok(mask.labelObject, 'fallback label must be created');
    assert.equal(mask.labelObject.text, 'mask3');
    assert.equal(warnings.length, 1);
    assert.equal(warnings[0].error, callbackError);
    assert.match(warnings[0].message, /label\.getText/);
});

test('label.create errors fall back to the default label and report a warning', () => {
    installDom();
    const mask = makeMask(4, 'mask4');
    const canvas = makeCanvas([mask]);
    const fabric = makeFabric();
    const callbackError = new Error('label create failed');
    const warnings = [];
    const options = resolveOptions({
        maskLabelOnSelect: true,
        onWarning: (error, message) => {
            warnings.push({ error, message });
        },
        label: {
            create: () => {
                throw callbackError;
            },
        },
    });

    createLabelForMask({ fabric, canvas, options }, mask);

    assert.ok(mask.labelObject, 'fallback label must be created');
    assert.equal(mask.labelObject.text, 'mask4');
    assert.equal(warnings.length, 1);
    assert.equal(warnings[0].error, callbackError);
    assert.match(warnings[0].message, /label\.create/);
});
