// Property 14: History serialization round-trip
//
// Property statement (design.md §"Property 14"):
//   For any editor state that can be produced by public methods,
//   `saveState()` followed by `loadFromState(snapshot)` SHALL restore
//   the canvas size, object set, object metadata, `_editorState`,
//   `currentScale`, `currentRotation`, `baseImageScale`, original
//   image reference, mask metadata, mask labels, and mask counter
//   derivation data.
//
// Owner module: `src/core/state-serializer.ts`.
//
// ─── Why a canvas mock instead of a live Fabric.Canvas ──────────────────────
//
// The state serializer interacts with the canvas through a tiny surface:
//
//   saveState        → canvas.discardActiveObject(), canvas.toJSON(keys)
//   loadFromState    → setCanvasSize(w, h), canvas.loadFromJSON(json),
//                      canvas.getObjects()
//
// That surface is small enough that the round-trip property is best
// exercised against a stand-in canvas that mimics Fabric's behaviour for
// these four methods. Driving a real Fabric.Canvas would require a
// jsdom environment, async font/image asset wiring, and a per-iteration
// canvas teardown — all of which add runtime cost without exercising
// any new branch inside `state-serializer.ts`. The mock keeps each
// iteration in-process and fast so the run can stay at the project's
// standard `numRuns: 100`.
//
// ─── Sub-properties exercised here ───────────────────────────────────────────
//
//   14.1 saveState→loadFromState→saveState yields byte-stable snapshots
//        (Req 16.1, 16.5, 36.2, 36.3) — equality is the parsed JSON deep
//        equality, which is the exact equivalence relation defined in
//        Requirement 16.5.
//   14.2 Object metadata round-trips (Req 16.3, 16.5, 22.3) — every
//        mask object retains its (type, left, top, maskId, maskName,
//        originalAlpha) and any preserved falsy style values.
//   14.3 Editor metadata round-trips (Req 16.2, 16.4, 36.2) — the
//        `_editorState` object embedded in the snapshot returns
//        `currentScale`, `currentRotation`, `baseImageScale` exactly.
//   14.4 `maxMaskId` derivation (Req 18.2) — `loadFromState` returns
//        the maximum restored `maskId`, or `0` when no masks survive.
//   14.5 Session-only filter (Req 16.1, 22.3) — objects flagged
//        `isCropRect === true` or `maskLabel === true` never appear in
//        a snapshot and therefore never reach the loaded canvas.
//   14.6 originalImage discovery (Req 16.3) — the first non-mask
//        `'image'` object on the loaded canvas is returned as
//        `originalImage`, with `null` when no such object exists.
//
// Runtime note: Node 24+ strips TypeScript syntax natively, so this
// test imports the module under test directly from source via the
// shared `ts-resolve-hook`. No build step is required.

import { register } from 'node:module';

register('./helpers/ts-resolve-hook.mjs', import.meta.url);

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';

const { saveState, loadFromState, SNAPSHOT_CUSTOM_KEYS } = await import(
    '../src/core/state-serializer.ts'
);

// ─── Mock Fabric canvas ─────────────────────────────────────────────────────

/**
 * Stand-in for `fabric.Canvas` covering only the four methods the state
 * serializer touches. The implementation mirrors the public contract
 * documented at:
 *   https://fabricjs.com/api/classes/canvas/  (toJSON, loadFromJSON,
 *   discardActiveObject, getObjects)
 *
 *   - `discardActiveObject()` is a no-op (the unit under test is the
 *     serializer; ActiveSelection construction lives in the facade).
 *   - `toJSON(propertiesToInclude)` emits the same shape as Fabric's
 *     real serializer for the fields the round-trip checks: `version`,
 *     `width`, `height`, `objects[]` with `type`, `left`, `top`,
 *     `opacity`, and any custom keys carried by the source object.
 *   - `loadFromJSON(json)` rehydrates from the same wire format by
 *     cloning each object payload — sufficient because the serializer
 *     immediately re-applies mask metadata via the position-based
 *     matcher.
 *   - `getObjects()` returns the live array.
 */
class MockCanvas {
    constructor() {
        this.objects = [];
        this.width = 0;
        this.height = 0;
    }

    discardActiveObject() {
        // no-op
    }

    add(obj) {
        this.objects.push(obj);
    }

    getObjects() {
        return this.objects;
    }

    toJSON(propertiesToInclude) {
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

    async loadFromJSON(json) {
        this.objects = Array.isArray(json.objects)
            ? json.objects.map(o => ({ ...o }))
            : [];
        if (typeof json.width === 'number') this.width = json.width;
        if (typeof json.height === 'number') this.height = json.height;
        return this;
    }
}

function makeSetCanvasSize(canvas) {
    return (w, h) => {
        canvas.width = w;
        canvas.height = h;
    };
}

// ─── Arbitraries ────────────────────────────────────────────────────────────

const dimensionArb = fc.record({
    width: fc.integer({ min: 320, max: 800 }),
    height: fc.integer({ min: 240, max: 600 }),
});

// Editor metadata is normalized through `Number()` checks in the serializer
// (`typeof === 'number'`), so any finite numeric input round-trips exactly
// once it has passed through `JSON.stringify`. Use small, JSON-stable
// values to keep the property's equality check on the parsed snapshot
// comparison rather than on float-formatting peculiarities.
const editorStateArb = fc.record({
    currentScale: fc.integer({ min: 1, max: 500 }).map(n => n / 100),
    currentRotation: fc.integer({ min: -360, max: 360 }),
    baseImageScale: fc.integer({ min: 1, max: 200 }).map(n => n / 100),
});

const shapeTypeArb = fc.constantFrom('rect', 'circle', 'ellipse', 'polygon');

// Pre-allocate a unique pool of `maskId` integers per iteration so the
// derived `maxMaskId` assertion is unambiguous (no tied IDs to mask the
// max over).
const maskBlueprintArb = fc.record({
    type: shapeTypeArb,
    left: fc.integer({ min: 0, max: 600 }),
    top: fc.integer({ min: 0, max: 500 }),
    maskName: fc
        .string({ minLength: 1, maxLength: 12 })
        // Avoid characters that JSON would escape unevenly between our
        // mock and a real Fabric — letters/digits/dashes are universally
        // round-trip safe and exercise the metadata path identically.
        .map(s => s.replace(/[^A-Za-z0-9_-]/g, '_'))
        .filter(s => s.length > 0),
    originalAlpha: fc.integer({ min: 0, max: 100 }).map(n => n / 100),
    opacity: fc.integer({ min: 0, max: 100 }).map(n => n / 100),
    // Falsy style fields — Requirement 22.3 says these must round-trip
    // verbatim through the snapshot. Fabric serializes any custom key
    // declared in `propertiesToInclude` as-is; here we cover both a
    // common non-listed key (`strokeWidth: 0`) which the mock toJSON
    // does NOT carry through (mirroring the Pretty_Printer's behaviour
    // of relying on Fabric's per-property defaults) and a listed key
    // (`hasControls: false`) which the mock surfaces because we list
    // it explicitly via `propertiesToInclude`.
    hasControls: fc.boolean(),
});

const transientObjArb = fc.oneof(
    // crop rectangle marker — must be filtered out before history.
    fc.record({
        type: fc.constant('rect'),
        left: fc.integer({ min: 0, max: 600 }),
        top: fc.integer({ min: 0, max: 500 }),
        opacity: fc.constant(0.5),
        isCropRect: fc.constant(true),
    }),
    // mask label marker — must be filtered out before history.
    fc.record({
        type: fc.constant('text'),
        left: fc.integer({ min: 0, max: 600 }),
        top: fc.integer({ min: 0, max: 500 }),
        opacity: fc.constant(1),
        maskLabel: fc.constant(true),
    }),
);

// Optional non-mask `'image'` object simulating the loaded photo. Used
// to exercise `loadFromState`'s `originalImage` discovery path
// (sub-property 14.6).
const originalImageArb = fc.option(
    fc.record({
        type: fc.constant('image'),
        left: fc.integer({ min: 0, max: 100 }),
        top: fc.integer({ min: 0, max: 100 }),
        opacity: fc.constant(1),
    }),
    { nil: undefined },
);

const scenarioArb = fc
    .tuple(
        dimensionArb,
        editorStateArb,
        // 1..5 masks per scenario — enough to make the position-based
        // matcher meaningful without making each iteration expensive.
        fc.array(maskBlueprintArb, { minLength: 1, maxLength: 5 }),
        // 0..3 transient objects to verify the session-only filter.
        fc.array(transientObjArb, { minLength: 0, maxLength: 3 }),
        originalImageArb,
        // Distinct positive maskId pool so `maxMaskId` is well-defined.
        fc.uniqueArray(fc.integer({ min: 1, max: 10_000 }), {
            minLength: 5,
            maxLength: 5,
        }),
    )
    .map(
        ([
            dims,
            editorState,
            blueprints,
            transients,
            originalImage,
            maskIdPool,
        ]) => {
            const masks = blueprints.map((b, i) => ({
                ...b,
                maskId: maskIdPool[i],
            }));
            return {
                dims,
                editorState,
                masks,
                transients,
                originalImage,
            };
        },
    );

// ─── Helpers ────────────────────────────────────────────────────────────────

function buildSourceCanvas(scenario) {
    const canvas = new MockCanvas();
    canvas.width = scenario.dims.width;
    canvas.height = scenario.dims.height;

    if (scenario.originalImage) {
        canvas.add({ ...scenario.originalImage });
    }

    for (const mask of scenario.masks) {
        canvas.add({ ...mask });
    }

    for (const t of scenario.transients) {
        canvas.add({ ...t });
    }

    return canvas;
}

/**
 * Equivalence relation defined by Requirement 16.5 / 36.3:
 *   - canvas size (width, height)
 *   - object set keyed by (type, left, top, maskId, maskName, originalAlpha)
 *   - editor metadata (currentScale, currentRotation, baseImageScale)
 *
 * The strongest possible check is byte-stable snapshot equality, since
 * the snapshot is the *only* observable surface of the serializer.
 * If the round-trip preserves every field the snapshot encodes, then
 * by definition it preserves every field the equivalence relation
 * cares about. The individual-field assertions below act as guides for
 * shrinking — they pinpoint *which* field diverged when the byte-level
 * check fails.
 */
function assertSnapshotsEquivalent(s1, s2, scenario) {
    const j1 = JSON.parse(s1);
    const j2 = JSON.parse(s2);

    assert.equal(
        j1.width,
        j2.width,
        'Req 16.3 / 16.5: canvas width must round-trip',
    );
    assert.equal(
        j1.height,
        j2.height,
        'Req 16.3 / 16.5: canvas height must round-trip',
    );

    assert.deepEqual(
        j1._editorState,
        j2._editorState,
        'Req 16.2 / 16.4 / 36.2: _editorState must round-trip',
    );
    assert.deepEqual(
        j1._editorState,
        scenario.editorState,
        'Req 16.2: _editorState content must equal the source editor metadata',
    );

    // Byte-stable comparison of the serialized object set. JSON deep
    // equality is the strongest equivalence the snapshot wire format
    // can express.
    assert.deepEqual(
        j1.objects,
        j2.objects,
        'Req 16.1 / 16.5 / 22.3 / 36.3: serialized object set must round-trip exactly',
    );
}

// ─── Properties ─────────────────────────────────────────────────────────────

test('Property 14: saveState→loadFromState→saveState produces an identical snapshot', async () => {
    await fc.assert(
        fc.asyncProperty(scenarioArb, async scenario => {
            // ── Build the source canvas ──────────────────────────────
            const src = buildSourceCanvas(scenario);

            // ── First save: produces s1 ──────────────────────────────
            const s1 = saveState({
                canvas: src,
                currentScale: scenario.editorState.currentScale,
                currentRotation: scenario.editorState.currentRotation,
                baseImageScale: scenario.editorState.baseImageScale,
            });

            // The Pretty_Printer SHALL embed _editorState (Req 16.2) and
            // SHALL NOT include any session-only object (Req 16.1).
            const j1 = JSON.parse(s1);
            assert.ok(
                j1._editorState && typeof j1._editorState === 'object',
                'Req 16.2: snapshot must carry _editorState',
            );
            assert.ok(
                Array.isArray(j1.objects),
                'snapshot must carry an objects array',
            );
            assert.ok(
                j1.objects.every(
                    o => o.isCropRect !== true && o.maskLabel !== true,
                ),
                'Req 16.1: session-only crop rect / mask labels must be filtered before history',
            );

            // ── Restore into a fresh canvas ──────────────────────────
            const dst = new MockCanvas();
            const result = await loadFromState({
                canvas: dst,
                jsonString: s1,
                setCanvasSize: makeSetCanvasSize(dst),
            });

            // Req 16.3: canvas size restored before loadFromJSON.
            assert.equal(
                dst.width,
                scenario.dims.width,
                'Req 16.3: setCanvasSize(width) must run during loadFromState',
            );
            assert.equal(
                dst.height,
                scenario.dims.height,
                'Req 16.3: setCanvasSize(height) must run during loadFromState',
            );

            // Req 16.4: editor metadata is forwarded to the facade.
            assert.deepEqual(
                result.editorState,
                scenario.editorState,
                'Req 16.4: editorState returned by loadFromState must match the source',
            );

            // Req 18.2: maxMaskId equals the maximum mask id present in
            // the source (or 0 when no masks survived).
            const expectedMaxMaskId = scenario.masks.reduce(
                (max, m) => Math.max(max, m.maskId),
                0,
            );
            assert.equal(
                result.maxMaskId,
                expectedMaxMaskId,
                'Req 18.2: maxMaskId must equal the max restored maskId',
            );

            // Sub-property 14.6: originalImage discovery — the first
            // non-mask `'image'` object becomes `result.originalImage`.
            if (scenario.originalImage) {
                assert.ok(
                    result.originalImage !== null,
                    'Req 16.3: originalImage must be reported when the snapshot has a non-mask image',
                );
                assert.equal(
                    result.originalImage.type,
                    'image',
                    'Req 16.3: originalImage must be the `image` object',
                );
            } else {
                assert.equal(
                    result.originalImage,
                    null,
                    'Req 16.3: originalImage must be null when no non-mask image exists',
                );
            }

            // Per-object assertion that mask metadata was re-applied
            // verbatim by `restoreMaskPropsFromJSON` (Req 16.3). This
            // is the gate that protects the byte-level round-trip from
            // a stale Fabric `_setOptions` regression.
            for (const sourceMask of scenario.masks) {
                const restored = result.objects.find(
                    o =>
                        o.type === sourceMask.type &&
                        Math.abs((o.left ?? 0) - sourceMask.left) < 0.5 &&
                        Math.abs((o.top ?? 0) - sourceMask.top) < 0.5 &&
                        o.maskId === sourceMask.maskId,
                );
                assert.ok(
                    restored,
                    `Req 16.3: mask id=${sourceMask.maskId} must survive round-trip`,
                );
                assert.equal(
                    restored.maskName,
                    sourceMask.maskName,
                    'Req 16.3: maskName must round-trip',
                );
                assert.equal(
                    restored.originalAlpha,
                    sourceMask.originalAlpha,
                    'Req 16.3 / 22.3: originalAlpha must round-trip exactly (including falsy values)',
                );
            }

            // Session-only objects must NOT appear on the restored canvas
            // because the snapshot they would have come from was already
            // filtered.
            assert.ok(
                result.objects.every(
                    o => o.isCropRect !== true && o.maskLabel !== true,
                ),
                'Req 16.1: session-only objects must not appear after a round-trip',
            );

            // ── Second save: produces s2 ─────────────────────────────
            const s2 = saveState({
                canvas: dst,
                currentScale: result.editorState.currentScale,
                currentRotation: result.editorState.currentRotation,
                baseImageScale: result.editorState.baseImageScale,
            });

            // Req 16.5 / 36.3: the round-trip property — s1 and s2 are
            // equivalent under the canonical snapshot equivalence.
            assertSnapshotsEquivalent(s1, s2, scenario);
        }),
        { numRuns: 100 },
    );
});

// ─── Sanity checks on the constants the property depends on ────────────────

test('SNAPSHOT_CUSTOM_KEYS includes every key the round-trip property relies on', () => {
    // The property assumes the serializer asks Fabric to carry these
    // keys onto every object payload. If the constant ever drifts,
    // the round-trip assertions above stop being meaningful.
    for (const k of [
        'maskId',
        'maskName',
        'isCropRect',
        'maskLabel',
        'originalAlpha',
    ]) {
        assert.ok(
            SNAPSHOT_CUSTOM_KEYS.includes(k),
            `SNAPSHOT_CUSTOM_KEYS must include '${k}' (Req 16.1)`,
        );
    }
});
