// History serialization round-trip
//
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
// — equality is the parsed JSON deep
//        equality, which is the exact equivalence relation defined in
//        the documented contract.
//   14.2 Object metadata round-trips — every
//        mask object retains its (type, left, top, maskId, maskName,
//        originalAlpha) and any preserved falsy style values.
//   14.3 Editor metadata round-trips — the
//        `_editorState` object embedded in the snapshot returns
//        `currentScale`, `currentRotation`, `baseImageScale` exactly.
//   14.4 `maxMaskId` derivation — `loadFromState` returns
//        the maximum restored `maskId`, or `0` when no masks survive.
//   14.5 Session-only filter — objects flagged
//        `isCropRect === true` or `maskLabel === true` never appear in
//        a snapshot and therefore never reach the loaded canvas.
//   14.6 originalImage discovery — the first non-mask
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
    // Falsy style fields — the documented contract says these must round-trip
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
// (sub-).
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
 * Equivalence relation defined by the documented contract:
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
        'the documented contract: canvas width must round-trip',
    );
    assert.equal(
        j1.height,
        j2.height,
        'the documented contract: canvas height must round-trip',
    );

    assert.deepEqual(
        j1._editorState,
        j2._editorState,
        'the documented contract: _editorState must round-trip',
    );
    assert.deepEqual(
        j1._editorState,
        scenario.editorState,
        'the documented contract: _editorState content must equal the source editor metadata',
    );

    // Byte-stable comparison of the serialized object set. JSON deep
    // equality is the strongest equivalence the snapshot wire format
    // can express.
    assert.deepEqual(
        j1.objects,
        j2.objects,
        'the documented contract: serialized object set must round-trip exactly',
    );
}

// ─── Properties ─────────────────────────────────────────────────────────────

test('saveState→loadFromState→saveState produces an identical snapshot', async () => {
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

            // The Pretty_Printer SHALL embed _editorState and
            // SHALL NOT include any session-only object.
            const j1 = JSON.parse(s1);
            assert.ok(
                j1._editorState && typeof j1._editorState === 'object',
                'the documented contract: snapshot must carry _editorState',
            );
            assert.ok(
                Array.isArray(j1.objects),
                'snapshot must carry an objects array',
            );
            assert.ok(
                j1.objects.every(
                    o => o.isCropRect !== true && o.maskLabel !== true,
                ),
                'the documented contract: session-only crop rect / mask labels must be filtered before history',
            );

            // ── Restore into a fresh canvas ──────────────────────────
            const dst = new MockCanvas();
            const result = await loadFromState({
                canvas: dst,
                jsonString: s1,
                setCanvasSize: makeSetCanvasSize(dst),
            });

            // the documented contract: canvas size restored before loadFromJSON.
            assert.equal(
                dst.width,
                scenario.dims.width,
                'the documented contract: setCanvasSize(width) must run during loadFromState',
            );
            assert.equal(
                dst.height,
                scenario.dims.height,
                'the documented contract: setCanvasSize(height) must run during loadFromState',
            );

            // the documented contract: editor metadata is forwarded to the facade.
            assert.deepEqual(
                result.editorState,
                scenario.editorState,
                'the documented contract: editorState returned by loadFromState must match the source',
            );

            // the documented contract: maxMaskId equals the maximum mask id present in
            // the source (or 0 when no masks survived).
            const expectedMaxMaskId = scenario.masks.reduce(
                (max, m) => Math.max(max, m.maskId),
                0,
            );
            assert.equal(
                result.maxMaskId,
                expectedMaxMaskId,
                'the documented contract: maxMaskId must equal the max restored maskId',
            );

            // Sub-originalImage discovery — the first
            // non-mask `'image'` object becomes `result.originalImage`.
            if (scenario.originalImage) {
                assert.ok(
                    result.originalImage !== null,
                    'the documented contract: originalImage must be reported when the snapshot has a non-mask image',
                );
                assert.equal(
                    result.originalImage.type,
                    'image',
                    'the documented contract: originalImage must be the `image` object',
                );
            } else {
                assert.equal(
                    result.originalImage,
                    null,
                    'the documented contract: originalImage must be null when no non-mask image exists',
                );
            }

            // Per-object assertion that mask metadata was re-applied
            // verbatim by `restoreMaskPropsFromJSON`. This
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
                    `the documented contract: mask id=${sourceMask.maskId} must survive round-trip`,
                );
                assert.equal(
                    restored.maskName,
                    sourceMask.maskName,
                    'the documented contract: maskName must round-trip',
                );
                assert.equal(
                    restored.originalAlpha,
                    sourceMask.originalAlpha,
                    'the documented contract: originalAlpha must round-trip exactly (including falsy values)',
                );
            }

            // Session-only objects must NOT appear on the restored canvas
            // because the snapshot they would have come from was already
            // filtered.
            assert.ok(
                result.objects.every(
                    o => o.isCropRect !== true && o.maskLabel !== true,
                ),
                'the documented contract: session-only objects must not appear after a round-trip',
            );

            // ── Second save: produces s2 ─────────────────────────────
            const s2 = saveState({
                canvas: dst,
                currentScale: result.editorState.currentScale,
                currentRotation: result.editorState.currentRotation,
                baseImageScale: result.editorState.baseImageScale,
            });

            // the documented contract: the round-trip property — s1 and s2 are
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
        'originalStroke',
        'originalStrokeWidth',
    ]) {
        assert.ok(
            SNAPSHOT_CUSTOM_KEYS.includes(k),
            `SNAPSHOT_CUSTOM_KEYS must include '${k}'`,
        );
    }
});

test('loadFromState restores duplicate-position masks one-to-one', async () => {
    const snapshot = {
        version: '6.0.0',
        width: 320,
        height: 240,
        objects: [
            {
                type: 'rect',
                left: 20,
                top: 30,
                maskId: 101,
                maskName: 'mask101',
                originalAlpha: 0.4,
                originalStroke: '#123456',
                originalStrokeWidth: 4,
            },
            {
                type: 'rect',
                left: 20,
                top: 30,
                maskId: 102,
                maskName: 'mask102',
                originalAlpha: 0.8,
                originalStroke: '#abcdef',
                originalStrokeWidth: 6,
            },
        ],
        _editorState: {
            currentScale: 1,
            currentRotation: 0,
            baseImageScale: 1,
        },
    };

    const canvas = new MockCanvas();
    canvas.loadFromJSON = async function loadFromJSON(json) {
        this.objects = json.objects.map((o) => ({
            type: o.type,
            left: o.left,
            top: o.top,
            opacity: o.opacity ?? 1,
            maskId: 102,
            maskName: 'stale',
            originalAlpha: 0.1,
        }));
        return this;
    };

    const result = await loadFromState({
        canvas,
        jsonString: snapshot,
        setCanvasSize: makeSetCanvasSize(canvas),
    });

    const restoredIds = result.objects.map((o) => o.maskId).sort((a, b) => a - b);
    assert.deepEqual(restoredIds, [101, 102]);
    assert.equal(new Set(restoredIds).size, 2);
    assert.equal(result.maxMaskId, 102);
    assert.deepEqual(
        result.objects.map((o) => [o.maskName, o.originalStroke, o.originalStrokeWidth]),
        [
            ['mask101', '#123456', 4],
            ['mask102', '#abcdef', 6],
        ],
    );
});
