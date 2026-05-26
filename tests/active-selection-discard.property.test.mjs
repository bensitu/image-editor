// Property 20: ActiveSelection discard before guarded operations

// Property statement (design.md §"Property 20"):
//   For any active Fabric `ActiveSelection`, snapshot, export, merge,
//   and crop transitions SHALL discard the active selection before
//   serialization or region calculation so the resulting JSON, export,
//   or crop state does not contain a top-level `ActiveSelection`.

// Owner modules: `core/state-serializer.ts`, `export/export-service.ts`,
// `crop/crop-controller.ts`.

// ─── Scope of this test ────────────────────────────

// At this point in the migration only `saveState` has been extracted into
// its owner module (`src/core/state-serializer.ts`, task 12.1). The other
// guarded operations covered by Requirement 23 — `mergeMasks`,
// `exportImageBase64`, `exportImageFile`, `downloadImage`, `enterCropMode`,
// `applyCrop`, `cancelCrop` — still live inside the v1 `image-editor.ts`
// and are exercised at the integration level by the v1 unit tests until
// they are extracted into `export/export-service.ts` and
// `crop/crop-controller.ts` in later tasks.

// Therefore this property test focuses on the half of Property 20 that
// the serializer owns directly:

//   23.1 (covered here): `saveState()` SHALL discard any active Fabric
//        `ActiveSelection` before serializing.

//   23.2 (NOT covered here, deferred): `exportImageBase64`,
//        `exportImageFile`, `downloadImage`, and `mergeMasks` SHALL
//        discard the active selection before computing the export region.
//        These will be exercised once `export/export-service.ts`
//        absorbs the export entry points (see tasks 18.x) and once
//        `mergeMasks` is extracted into its owner module. Until then
//        the v1 production behaviour is preserved by the existing
//        integration-level tests in `tests/image-editor.test.mjs`.

//   23.3 (NOT covered here, deferred): `enterCropMode`, `applyCrop`,
//        and `cancelCrop` SHALL discard the active selection before
//        mutating crop state. These will be exercised once
//        `crop/crop-controller.ts` absorbs the crop session entry
//        points (see tasks elsewhere in section 19). Until then the v1
//        production behaviour is preserved by the existing
//        integration-level tests in `tests/image-editor.test.mjs`.

// ─── Why a canvas mock instead of a live Fabric.Canvas ──────────────────────

// `saveState` interacts with the canvas through three methods:

//   discardActiveObject()   — the call site this property is asserting
//   toJSON(propertiesToInclude) — used to serialize the canvas
//   (no third method is consulted for Req 23.1)

// A real Fabric canvas would require jsdom, async asset wiring, and a
// per-iteration teardown without exercising any new branch inside the
// serializer's discard call. Driving a small `MockCanvas` that counts
// `discardActiveObject` calls is the most direct way to assert
// Requirement 23.1: the serializer must call `discardActiveObject` at
// least once before any object payload is serialized.

// Runtime note: Node 24+ strips TypeScript syntax natively, so this
// test imports the module under test directly from source via the
// shared `ts-resolve-hook`. No build step is required.

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
 * that the discard happens BEFORE serialization (Requirement 23.1).
 *
 * Mirrors the public Fabric contract:
 *   https://fabricjs.com/api/classes/canvas/  (toJSON,
 *   discardActiveObject, getObjects)
 */
class MockCanvas {
    constructor() {
        this.discardCalls = 0;
        this.toJSONCalls = 0;
        this.callOrder = [];
        this.objects = [];
        this.width = 0;
        this.height = 0;
    }

    discardActiveObject() {
        this.discardCalls++;
        this.callOrder.push('discardActiveObject');
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
            objects: this.objects.map(o => {
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
    currentScale: fc.integer({ min: 1, max: 500 }).map(n => n / 100),
    currentRotation: fc.integer({ min: -360, max: 360 }),
    baseImageScale: fc.integer({ min: 1, max: 200 }).map(n => n / 100),
});

const shapeTypeArb = fc.constantFrom(
    'rect',
    'circle',
    'ellipse',
    'polygon',
    'image',
);

// A canvas object payload — masks, transient crop rect markers, label
// text markers, and plain non-mask images are all valid inputs to
// `saveState`. The discard contract holds for every shape of canvas.
const canvasObjectArb = fc.record({
    type: shapeTypeArb,
    left: fc.integer({ min: 0, max: 600 }),
    top: fc.integer({ min: 0, max: 500 }),
    opacity: fc.integer({ min: 0, max: 100 }).map(n => n / 100),
    maskId: fc.option(fc.integer({ min: 1, max: 10_000 }), { nil: undefined }),
    maskName: fc.option(
        fc
            .string({ minLength: 1, maxLength: 8 })
            .map(s => s.replace(/[^A-Za-z0-9_-]/g, '_'))
            .filter(s => s.length > 0),
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
    // serialize (Req 23.1 is unconditional on canvas content).
    objects: fc.array(canvasObjectArb, { minLength: 0, maxLength: 6 }),
});

// ─── Property ───────────────────────────────────────────────────────────────

test('Property 20: saveState discards ActiveSelection before serializing', () => {
    fc.assert(
        fc.property(scenarioArb, scenario => {
            const canvas = new MockCanvas();
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

            // Req 23.1: `saveState()` SHALL discard any active Fabric
            // `ActiveSelection` before serializing. The serializer
            // calls `discardActiveObject` unconditionally — the
            // discard is a no-op when no `ActiveSelection` is present,
            // so the call must happen for every input.
            assert.ok(
                canvas.discardCalls >= 1,
                'Req 23.1: saveState must invoke canvas.discardActiveObject() at least once',
            );

            // Strengthen Req 23.1: the discard SHALL happen BEFORE
            // serialization, not as a post-hoc cleanup. The first
            // observed canvas method during `saveState` must be
            // `discardActiveObject`, and it must precede the first
            // `toJSON` call.
            assert.equal(
                canvas.callOrder[0],
                'discardActiveObject',
                'Req 23.1: discardActiveObject must be the first canvas method called by saveState',
            );
            const firstToJSON = canvas.callOrder.indexOf('toJSON');
            const firstDiscard = canvas.callOrder.indexOf(
                'discardActiveObject',
            );
            assert.ok(
                firstToJSON > firstDiscard,
                'Req 23.1: discardActiveObject must precede toJSON',
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
