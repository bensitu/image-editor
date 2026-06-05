/**
 * Type:
 *   Property test
 *
 * Purpose:
 *   Verifies that mask ID allocation remains monotonic across createMask,
 *   removeAll-style merges, undo, redo, and further mask creation. The suite models
 *   the ImageEditor-owned counter and state round trips without a full UI.
 *
 * Scope:
 *   - Generated operation sequences cover interleavings of creation, removal, and
 *     restore.
 *   - Restored masks keep their serialized IDs.
 *   - New masks always receive an ID greater than every live or previously restored
 *     mask ID.
 *
 * Out of scope:
 *   - visual rendering quality
 *   - unrelated crop or export behavior
 *   - browser-specific pointer interaction details
 *
 * Environment:
 *   - Node.js ESM
 *   - fast-check generated cases where applicable
 *   - Fabric/canvas behavior is mocked where needed
 *
 * Run:
 *   node --test tests/mask-id-uniqueness.property.test.mjs
 *
 * Notes:
 *   - Prefer behavior-level assertions over implementation-detail checks.
 *   - Keep this file focused on mask ID uniqueness across mixed operations only.
 */

import { register } from 'node:module';

register('./helpers/ts-resolve-hook.mjs', import.meta.url);

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';

const { createMask, removeAllMasks } = await import('../src/mask/mask-factory.ts');
const { saveState, loadFromState } = await import('../src/core/state-serializer.ts');
const { resolveOptions } = await import('../src/core/default-options.ts');

// ─── Mock Fabric module ────────────────────────────────────────────────────

/**
 * Build a fake Fabric module with `Rect`, `Circle`, `Ellipse`, and
 * `Polygon` constructors. Each constructor copies the supplied props
 * onto `this` and exposes the small subset of methods the factory
 * touches after construction (`set`, `setCoords`, `getBoundingRect`,
 * `on`). This mirrors the helper used by
 * `tests/mask-factory.property.test.mjs`.
 */
function makeFabric() {
    const makeShape = (type) =>
        function Shape(props) {
            Object.assign(this, { type, ...props });
            this.set = function (p, v) {
                if (typeof p === 'string') this[p] = v;
                else Object.assign(this, p);
            };
            this.setCoords = function () {};
            this.getBoundingRect = function () {
                return {
                    left: this.left ?? 0,
                    top: this.top ?? 0,
                    width: this.width ?? 50,
                    height: this.height ?? 50,
                };
            };
            this.on = function () {};
        };

    return {
        Rect: makeShape('rect'),
        Circle: makeShape('circle'),
        Ellipse: makeShape('ellipse'),
        Polygon: function Polygon(pts, props) {
            Object.assign(this, { type: 'polygon', points: pts, ...props });
            this.set = function (p, v) {
                if (typeof p === 'string') this[p] = v;
                else Object.assign(this, p);
            };
            this.setCoords = function () {};
            this.getBoundingRect = function () {
                const xs = pts.map((p) => p.x);
                const ys = pts.map((p) => p.y);
                return {
                    left: Math.min(...xs),
                    top: Math.min(...ys),
                    width: Math.max(...xs) - Math.min(...xs),
                    height: Math.max(...ys) - Math.min(...ys),
                };
            };
            this.on = function () {};
        },
    };
}

// ─── Mock Fabric canvas (createMask + state-serializer surfaces) ───────────

/**
 * Fake `fabric.Canvas` covering every method `createMask`,
 * `removeAllMasks`, `saveState`, and `loadFromState` invoke.
 *
 * The implementation is a union of the two mocks already used in the
 * sibling property tests:
 *
 *   - From `mask-factory.property.test.mjs`: `getWidth`, `getHeight`,
 *     `add`, `bringObjectToFront`, `setActiveObject`,
 *     `discardActiveObject`, `setDimensions`, `renderAll`,
 *     `requestRenderAll`.
 *   - From `state-serializer.property.test.mjs`: `toJSON(propertiesToInclude)`
 *     returning the standard Fabric envelope, `loadFromJSON(json)`
 *     rehydrating per-object payloads, `getObjects`, `remove`.
 *
 * `toJSON` only emits per-object payloads with `type`, `left`, `top`,
 * `opacity`, plus any keys requested via `propertiesToInclude`. That
 * matches the behavior the state-serializer relies on for the
 * round-trip property and is sufficient for the maskId-uniqueness
 * checks here because the custom keys (`maskId`, `maskName`,
 * `originalAlpha`) are explicitly listed in `SNAPSHOT_CUSTOM_KEYS`.
 */
class MockCanvas {
    constructor() {
        this.objects = [];
        this.width = 800;
        this.height = 600;
        this.activeObject = null;
    }

    getWidth() {
        return this.width;
    }

    getHeight() {
        return this.height;
    }

    add(o) {
        this.objects.push(o);
    }

    remove(o) {
        const i = this.objects.indexOf(o);
        if (i >= 0) this.objects.splice(i, 1);
    }

    getObjects() {
        return this.objects;
    }

    setActiveObject(o) {
        this.activeObject = o;
    }

    getActiveObject() {
        return this.activeObject;
    }

    discardActiveObject() {
        this.activeObject = null;
    }

    bringObjectToFront(o) {
        const i = this.objects.indexOf(o);
        if (i >= 0) {
            this.objects.splice(i, 1);
            this.objects.push(o);
        }
    }

    setDimensions({ width, height }) {
        if (typeof width === 'number') this.width = width;
        if (typeof height === 'number') this.height = height;
    }

    renderAll() {}
    requestRenderAll() {}

    toJSON(propertiesToInclude) {
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

    async loadFromJSON(json) {
        this.objects = Array.isArray(json.objects) ? json.objects.map((o) => ({ ...o })) : [];
        if (typeof json.width === 'number') this.width = json.width;
        if (typeof json.height === 'number') this.height = json.height;
        this.activeObject = null;
        return this;
    }
}

// ─── Model ─────────────────────────────────────────────────────────────────

/**
 * Build a fresh model — canvas, fabric, options, the mutable counter
 * slot owned by the orchestrator (mirroring `image-editor.ts`), and
 * factory helpers for `CreateMaskContext` / `RemoveMaskContext`.
 *
 * The counter and `lastMask` slots live on the model object so each
 * iteration starts from a clean state and the assertions can read
 * back the orchestrator-owned values directly.
 */
function makeModel() {
    const canvas = new MockCanvas();
    const fabric = makeFabric();
    const options = resolveOptions({});
    // The orchestrator owns these fields in `image-editor.ts`. We hold
    // them here so the factory's `getMaskCounter` / `setMaskCounter`
    // hooks can mutate them and the property assertions can read them
    // back.
    const slots = { counter: 0, lastMask: null };

    return {
        canvas,
        fabric,
        options,
        getCounter: () => slots.counter,
        setCounter: (n) => {
            slots.counter = n;
        },
        // Context objects rebuilt on demand because the factory does
        // not retain them between calls.
        createCtx() {
            return {
                fabric,
                canvas,
                options,
                getLastMask: () => slots.lastMask,
                setLastMask: (m) => {
                    slots.lastMask = m;
                },
                getMaskCounter: () => slots.counter,
                setMaskCounter: (n) => {
                    slots.counter = n;
                },
                updateMaskList: () => {},
                saveCanvasState: () => {},
            };
        },
        removeCtx() {
            return {
                canvas,
                removeLabelForMask: () => {},
                updateMaskList: () => {},
                saveCanvasState: () => {},
                setLastMask: (m) => {
                    slots.lastMask = m;
                },
            };
        },
    };
}

/**
 * Take a snapshot of the live canvas + counter. The snapshot string is
 * the JSON used by `loadFromState`; `counter` is captured separately
 * because `saveState` deliberately does NOT serialize `maskCounter` —
 * it is recomputed from the restored mask population per the documented contract.
 *
 * Capturing both fields here lets the model emulate the orchestrator's
 * undo/redo wiring without leaking the counter into the snapshot.
 */
function takeSnapshot(model) {
    return saveState({
        canvas: model.canvas,
        currentScale: 1,
        currentRotation: 0,
        baseImageScale: 1,
    });
}

/**
 * Restore a snapshot via `loadFromState` and apply the documented contract: set
 * `maskCounter` to the maximum `maskId` observed on the restored
 * canvas (or `0` if none). Returns the loadFromState result so callers
 * can read back `maxMaskId` for further assertions.
 */
async function restoreSnapshot(model, jsonString) {
    const result = await loadFromState({
        canvas: model.canvas,
        jsonString,
        setCanvasSize: (w, h) => {
            model.canvas.width = w;
            model.canvas.height = h;
        },
    });
    // the documented contract — the orchestrator assigns `maskCounter = maxMaskId`.
    model.setCounter(result.maxMaskId);
    return result;
}

/**
 * Read the live `maskId` values from the canvas, in object order.
 * Used for both the uniqueness assertion and the counter
 * monotonicity assertion.
 */
function liveMaskIds(canvas) {
    return canvas
        .getObjects()
        .filter((o) => typeof o.maskId === 'number')
        .map((o) => o.maskId);
}

/**
 * Universal post-step invariants — run after every operation in the
 * randomised sequence.
 *
 * 1. the documented contract — `maskId` values on the canvas are unique.
 * 2. the documented contract — `maskCounter` is strictly greater than
 *    every live `maskId` (or equal when no masks exist), so the next
 *    `createMask` cannot collide with anything currently on the
 *    canvas. The factory uses `counter + 1` as the new ID; combined
 *    with this assertion, it is strictly larger than every existing
 *    ID.
 */
function assertInvariants(model, label) {
    const ids = liveMaskIds(model.canvas);
    assert.equal(
        new Set(ids).size,
        ids.length,
        `${label}: the documented contract — maskIds on the canvas must be unique (got [${ids.join(', ')}])`,
    );

    if (ids.length > 0) {
        const max = Math.max(...ids);
        assert.ok(
            model.getCounter() >= max,
            `${label}: the documented contract — maskCounter (${model.getCounter()}) must be ≥ max(maskId) (${max}) so the next createMask cannot duplicate`,
        );
    }
}

// ─── Operation arbitraries ─────────────────────────────────────────────────

// Polygon placement is covered by ; restrict the random
// shape set to rect / circle / ellipse so this property focuses on
// counter and ID semantics.
const shapeArb = fc.constantFrom('rect', 'circle', 'ellipse');

const operationArb = fc.oneof(
    // Bias toward `create` so most random sequences exercise mask
    // accumulation rather than degenerating into all-undo or
    // all-removeAll runs.
    { weight: 4, arbitrary: fc.record({ kind: fc.constant('create'), shape: shapeArb }) },
    { weight: 1, arbitrary: fc.record({ kind: fc.constant('removeAll') }) },
    { weight: 2, arbitrary: fc.record({ kind: fc.constant('undo') }) },
    { weight: 2, arbitrary: fc.record({ kind: fc.constant('redo') }) },
);

// ─── Property ──────────────────────────────────────────────────────────────

test('mask ID uniqueness across mixed createMask / mergeMasks (simulated removeAll) / undo / redo / additional createMask sequences', async () => {
    await fc.assert(
        fc.asyncProperty(fc.array(operationArb, { minLength: 1, maxLength: 25 }), async (ops) => {
            const model = makeModel();

            // Undo / redo stacks holding snapshot strings. The
            // baseline snapshot represents the empty initial state.
            const undoStack = [takeSnapshot(model)];
            const redoStack = [];

            assertInvariants(model, 'init');

            for (let i = 0; i < ops.length; i++) {
                const op = ops[i];
                const label = `op[${i}]=${op.kind}`;

                switch (op.kind) {
                    case 'create': {
                        const before = model.getCounter();
                        const mask = createMask(model.createCtx(), {
                            shape: op.shape,
                        });
                        assert.ok(mask, `${label}: createMask must succeed`);

                        // the documented contract — counter incremented by exactly 1.
                        assert.equal(
                            model.getCounter(),
                            before + 1,
                            `${label}: the documented contract — maskCounter must increment by exactly 1 (was ${before}, now ${model.getCounter()})`,
                        );

                        // the documented contract — new mask carries the new counter as `maskId`.
                        assert.equal(
                            mask.maskId,
                            model.getCounter(),
                            `${label}: the documented contract — new mask.maskId (${mask.maskId}) must equal updated maskCounter (${model.getCounter()})`,
                        );

                        undoStack.push(takeSnapshot(model));
                        // New action invalidates redo history.
                        redoStack.length = 0;
                        break;
                    }
                    case 'removeAll': {
                        // `mergeMasks` removes every mask before
                        // reloading the merged image. This model only
                        // needs the mask-removal half, because the ID
                        // contract depends on clearing masks without
                        // resetting `maskCounter`.
                        removeAllMasks(model.removeCtx(), {
                            saveHistory: false,
                        });
                        // Per `removeAllMasks` docs: maskCounter is
                        // NOT reset — only `lastMask` is cleared.
                        // We assert that explicitly.
                        assert.equal(
                            liveMaskIds(model.canvas).length,
                            0,
                            `${label}: removeAll must clear all masks`,
                        );

                        undoStack.push(takeSnapshot(model));
                        redoStack.length = 0;
                        break;
                    }
                    case 'undo': {
                        // Undo when there is something to undo to:
                        // need at least 2 entries (current + at
                        // least one prior) on the undo stack.
                        if (undoStack.length > 1) {
                            redoStack.push(undoStack.pop());
                            const target = undoStack[undoStack.length - 1];
                            const result = await restoreSnapshot(model, target);

                            // the documented contract — counter equals max(maskId)
                            // restored from the snapshot, or 0.
                            const ids = liveMaskIds(model.canvas);
                            const expectedMax = ids.length === 0 ? 0 : Math.max(...ids);
                            assert.equal(
                                result.maxMaskId,
                                expectedMax,
                                `${label}: the documented contract — loadFromState.maxMaskId must equal max(restored maskId) (got ${result.maxMaskId}, expected ${expectedMax})`,
                            );
                            assert.equal(
                                model.getCounter(),
                                expectedMax,
                                `${label}: the documented contract — maskCounter must be set to max(restored maskId) after undo (got ${model.getCounter()}, expected ${expectedMax})`,
                            );
                        }
                        break;
                    }
                    case 'redo': {
                        if (redoStack.length > 0) {
                            const target = redoStack.pop();
                            undoStack.push(target);
                            const result = await restoreSnapshot(model, target);

                            const ids = liveMaskIds(model.canvas);
                            const expectedMax = ids.length === 0 ? 0 : Math.max(...ids);
                            assert.equal(
                                result.maxMaskId,
                                expectedMax,
                                `${label}: the documented contract — loadFromState.maxMaskId must equal max(restored maskId) after redo (got ${result.maxMaskId}, expected ${expectedMax})`,
                            );
                            assert.equal(
                                model.getCounter(),
                                expectedMax,
                                `${label}: the documented contract — maskCounter must be set to max(restored maskId) after redo (got ${model.getCounter()}, expected ${expectedMax})`,
                            );
                        }
                        break;
                    }
                }

                assertInvariants(model, label);
            }

            // Final probe: one more `createMask` MUST yield an ID
            // strictly greater than every live `maskId` and
            // therefore preserve uniqueness on the canvas. This is
            // the "next created mask SHALL use an ID greater than
            // every restored live mask ID" half of .
            const liveBefore = liveMaskIds(model.canvas);
            const counterBefore = model.getCounter();
            const probe = createMask(model.createCtx(), {
                shape: 'rect',
            });
            assert.ok(probe, 'final probe createMask must succeed');
            assert.equal(
                probe.maskId,
                counterBefore + 1,
                'final probe: the documented contract — new maskId must be counter+1',
            );
            for (const id of liveBefore) {
                assert.ok(
                    probe.maskId > id,
                    `final probe: the documented contract — next createMask ID (${probe.maskId}) must exceed every restored live maskId (saw ${id})`,
                );
            }
            const liveAfter = liveMaskIds(model.canvas);
            assert.equal(
                new Set(liveAfter).size,
                liveAfter.length,
                'final probe: the documented contract — maskIds must remain unique after the probe create',
            );

            return true;
        }),
        { numRuns: 100 },
    );
});
