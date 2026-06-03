/**
 * @file active-selection-discard.property.test.mjs
 *
 * Type:
 *   Property test
 *
 * Purpose:
 *   Verifies that src/core/state-serializer.ts discards any active Fabric
 *   ActiveSelection before snapshot serialization. Export, merge, and crop paths
 *   assert the same user-visible rule in their own integration suites, so this file
 *   keeps the direct serializer contract small and focused.
 *
 * Scope:
 *   - MockCanvas records discardActiveObject() before toJSON() payload creation
 *     only when the active object is a Fabric ActiveSelection.
 *   - Single active masks stay selected during snapshot serialization so control
 *     border styles do not churn after a mask transform.
 *   - The property checks arbitrary active-selection object lists without requiring a
 *     live Fabric canvas.
 *   - Source imports use the shared TypeScript resolver hook, so no build step is
 *     required for this isolated test.
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
 *   node --test tests/active-selection-discard.property.test.mjs
 *
 * Notes:
 *   - Prefer behavior-level assertions over implementation-detail checks.
 *   - Keep this file focused on activeSelection discard before guarded operations
 *     only.
 */

import { register } from 'node:module';

register('./helpers/ts-resolve-hook.mjs', import.meta.url);

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';

const { saveState } = await import('../src/core/state-serializer.ts');

// ─── Mock Fabric canvas ─────────────────────────────────────────────────────

/**
 * Stand-in for `fabric.Canvas` covering only the surface `saveState`
 * touches, instrumented to count `discardActiveObject` calls and to
 * record the call order relative to `toJSON` so the test can assert
 * that the discard happens BEFORE serialization.
 *
 * Mirrors the public Fabric contract:
 *   https://fabricjs.com/api/classes/canvas/  (toJSON,
 *   discardActiveObject, getObjects)
 */
class MockCanvas {
    constructor(activeObject = null) {
        this.discardCalls = 0;
        this.toJSONCalls = 0;
        this.callOrder = [];
        this.objects = [];
        this.width = 0;
        this.height = 0;
        this.activeObject = activeObject;
    }

    getActiveObject() {
        return this.activeObject;
    }

    discardActiveObject() {
        this.discardCalls++;
        this.callOrder.push('discardActiveObject');
        this.activeObject = null;
        return this;
    }

    add(obj) {
        this.objects.push(obj);
    }

    getObjects() {
        return this.objects;
    }

    toJSON(propertiesToInclude) {
        this.toJSONCalls++;
        this.callOrder.push('toJSON');
        const keys = propertiesToInclude ?? [];
        return {
            version: '6.0.0',
            width: this.width,
            height: this.height,
            objects: this.objects.map((o) => {
                const out = {
                    type: o.type,
                    left: o.left ?? 0,
                    top: o.top ?? 0,
                    opacity: o.opacity ?? 1,
                };
                for (const k of keys) {
                    if (k in o) out[k] = o[k];
                }
                return out;
            }),
        };
    }
}

// ─── Arbitraries ────────────────────────────────────────────────────────────

const dimensionArb = fc.record({
    width: fc.integer({ min: 0, max: 800 }),
    height: fc.integer({ min: 0, max: 600 }),
});

const editorStateArb = fc.record({
    currentScale: fc.integer({ min: 1, max: 500 }).map((n) => n / 100),
    currentRotation: fc.integer({ min: -360, max: 360 }),
    baseImageScale: fc.integer({ min: 1, max: 200 }).map((n) => n / 100),
});

const shapeTypeArb = fc.constantFrom('rect', 'circle', 'ellipse', 'polygon', 'image');

// A canvas object payload — masks, transient crop rect markers, label
// text markers, and plain non-mask images are all valid inputs to
// `saveState`. The discard contract holds for every shape of canvas.
const canvasObjectArb = fc.record({
    type: shapeTypeArb,
    left: fc.integer({ min: 0, max: 600 }),
    top: fc.integer({ min: 0, max: 500 }),
    opacity: fc.integer({ min: 0, max: 100 }).map((n) => n / 100),
    maskId: fc.option(fc.integer({ min: 1, max: 10_000 }), { nil: undefined }),
    maskName: fc.option(
        fc
            .string({ minLength: 1, maxLength: 8 })
            .map((s) => s.replace(/[^A-Za-z0-9_-]/g, '_'))
            .filter((s) => s.length > 0),
        { nil: undefined },
    ),
    isCropRect: fc.option(fc.constant(true), { nil: undefined }),
    maskLabel: fc.option(fc.constant(true), { nil: undefined }),
});

const scenarioArb = fc.record({
    dims: dimensionArb,
    editorState: editorStateArb,
    // 0..6 objects per scenario — including the empty case so the
    // discard contract is asserted even when there is nothing to
    // serialize.
    objects: fc.array(canvasObjectArb, { minLength: 0, maxLength: 6 }),
});

// ─── Property ───────────────────────────────────────────────────────────────

test('saveState discards ActiveSelection before serializing', () => {
    fc.assert(
        fc.property(scenarioArb, (scenario) => {
            const canvas = new MockCanvas({ type: 'activeselection' });
            canvas.width = scenario.dims.width;
            canvas.height = scenario.dims.height;
            for (const o of scenario.objects) {
                canvas.add({ ...o });
            }

            // Sanity-check the instrumentation before the call. If the
            // counters are not zero here the rest of the assertions
            // would be meaningless.
            assert.equal(canvas.discardCalls, 0);
            assert.equal(canvas.toJSONCalls, 0);

            const snapshot = saveState({
                canvas,
                currentScale: scenario.editorState.currentScale,
                currentRotation: scenario.editorState.currentRotation,
                baseImageScale: scenario.editorState.baseImageScale,
            });

            // the documented contract: `saveState()` SHALL discard any active Fabric
            // `ActiveSelection` before serializing.
            assert.equal(
                canvas.discardCalls,
                1,
                'the documented contract: saveState must invoke canvas.discardActiveObject() for ActiveSelection',
            );

            // Strengthen the documented contract: the discard SHALL happen BEFORE
            // serialization, not as a post-hoc cleanup. The first
            // observed canvas method during `saveState` must be
            // `discardActiveObject`, and it must precede the first
            // `toJSON` call.
            assert.equal(
                canvas.callOrder[0],
                'discardActiveObject',
                'the documented contract: discardActiveObject must be the first canvas method called by saveState',
            );
            const firstToJSON = canvas.callOrder.indexOf('toJSON');
            const firstDiscard = canvas.callOrder.indexOf('discardActiveObject');
            assert.ok(
                firstToJSON > firstDiscard,
                'the documented contract: discardActiveObject must precede toJSON',
            );

            // The serializer must still produce a parseable snapshot
            // for any input — this guards against a regression where
            // the discard call throws or short-circuits the function.
            const json = JSON.parse(snapshot);
            assert.ok(
                json && typeof json === 'object',
                'saveState must still return a valid JSON snapshot',
            );
        }),
        { numRuns: 100 },
    );
});

test('saveState preserves a single active mask while serializing', () => {
    const activeMask = {
        type: 'rect',
        left: 10,
        top: 20,
        opacity: 0.5,
        maskId: 7,
        maskName: 'mask7',
    };
    const canvas = new MockCanvas(activeMask);
    canvas.width = 320;
    canvas.height = 240;
    canvas.add(activeMask);

    const snapshot = saveState({
        canvas,
        currentScale: 1,
        currentRotation: 0,
        baseImageScale: 1,
    });

    assert.equal(
        canvas.discardCalls,
        0,
        'single active masks must not be discarded during saveState',
    );
    assert.equal(canvas.callOrder[0], 'toJSON', 'snapshot serialization should start directly');

    const json = JSON.parse(snapshot);
    assert.equal(json._editorState.activeMaskId, 7, 'active mask identity should be preserved');
});
