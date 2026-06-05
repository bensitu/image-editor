/**
 * Type:
 *   Property test
 *
 * Purpose:
 *   Verifies src/core/state-serializer.ts snapshot save and restore behavior for
 *   arbitrary serializable editor states. The suite uses a focused canvas mock
 *   because the serializer only needs discardActiveObject, toJSON, loadFromJSON,
 *   getObjects, and canvas-size callbacks.
 *
 * Scope:
 *   - saveState followed by loadFromState and saveState yields equivalent parsed
 *     snapshots.
 *   - Canvas size, editor scalar state, original image reference, mask metadata, and
 *     labels round-trip.
 *   - Duplicate-position masks restore one-to-one instead of being matched
 *     ambiguously.
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
 *   node --test tests/state-serializer.property.test.mjs
 *
 * Notes:
 *   - Prefer behavior-level assertions over implementation-detail checks.
 *   - Keep this file focused on history serialization round trip only.
 */

import { register } from 'node:module';

register('./helpers/ts-resolve-hook.mjs', import.meta.url);

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';

const { saveState, loadFromState, SNAPSHOT_CUSTOM_KEYS } =
    await import('../src/core/state-serializer.ts');

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
        this.activeObject = null;
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

    getActiveObject() {
        return this.activeObject;
    }

    setActiveObject(obj) {
        this.activeObject = obj;
    }

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
    currentScale: fc.integer({ min: 1, max: 500 }).map((n) => n / 100),
    currentRotation: fc.integer({ min: -360, max: 360 }),
    baseImageScale: fc.integer({ min: 1, max: 200 }).map((n) => n / 100),
    currentImageMimeType: fc.option(fc.constantFrom('image/png', 'image/jpeg', 'image/webp'), {
        nil: null,
    }),
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
        .map((s) => s.replace(/[^A-Za-z0-9_-]/g, '_'))
        .filter((s) => s.length > 0),
    originalAlpha: fc.integer({ min: 0, max: 100 }).map((n) => n / 100),
    opacity: fc.integer({ min: 0, max: 100 }).map((n) => n / 100),
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
    .map(([dims, editorState, blueprints, transients, originalImage, maskIdPool]) => {
        const masks = blueprints.map((b, i) => ({
            ...b,
            maskId: maskIdPool[i],
            maskUid: `uid-${maskIdPool[i]}`,
        }));
        return {
            dims,
            editorState,
            masks,
            transients,
            originalImage,
        };
    });

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

    assert.equal(j1.width, j2.width, 'the documented contract: canvas width must round-trip');
    assert.equal(j1.height, j2.height, 'the documented contract: canvas height must round-trip');

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
        fc.asyncProperty(scenarioArb, async (scenario) => {
            // ── Build the source canvas ──────────────────────────────
            const src = buildSourceCanvas(scenario);

            // ── First save: produces s1 ──────────────────────────────
            const s1 = saveState({
                canvas: src,
                currentScale: scenario.editorState.currentScale,
                currentRotation: scenario.editorState.currentRotation,
                baseImageScale: scenario.editorState.baseImageScale,
                currentImageMimeType: scenario.editorState.currentImageMimeType,
            });

            // The Pretty_Printer SHALL embed _editorState and
            // SHALL NOT include any session-only object.
            const j1 = JSON.parse(s1);
            assert.ok(
                j1._editorState && typeof j1._editorState === 'object',
                'the documented contract: snapshot must carry _editorState',
            );
            assert.ok(Array.isArray(j1.objects), 'snapshot must carry an objects array');
            assert.ok(
                j1.objects.every((o) => o.isCropRect !== true && o.maskLabel !== true),
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
            const expectedMaxMaskId = scenario.masks.reduce((max, m) => Math.max(max, m.maskId), 0);
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
            // verbatim by `restoreMaskPropsFromJson`. This
            // is the gate that protects the byte-level round-trip from
            // a stale Fabric `_setOptions` regression.
            for (const sourceMask of scenario.masks) {
                const restored = result.objects.find(
                    (o) =>
                        o.type === sourceMask.type &&
                        Math.abs((o.left ?? 0) - sourceMask.left) < 0.5 &&
                        Math.abs((o.top ?? 0) - sourceMask.top) < 0.5 &&
                        o.maskUid === sourceMask.maskUid,
                );
                assert.ok(
                    restored,
                    `the documented contract: mask id=${sourceMask.maskId} must survive round-trip`,
                );
                assert.equal(
                    restored.maskId,
                    sourceMask.maskId,
                    'the documented contract: maskId must round-trip exactly',
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
                result.objects.every((o) => o.isCropRect !== true && o.maskLabel !== true),
                'the documented contract: session-only objects must not appear after a round-trip',
            );

            // ── Second save: produces s2 ─────────────────────────────
            const s2 = saveState({
                canvas: dst,
                currentScale: result.editorState.currentScale,
                currentRotation: result.editorState.currentRotation,
                baseImageScale: result.editorState.baseImageScale,
                currentImageMimeType: result.editorState.currentImageMimeType,
            });

            // the documented contract: the round-trip property — s1 and s2 are
            // equivalent under the canonical snapshot equivalence.
            assertSnapshotsEquivalent(s1, s2, scenario);
        }),
        { numRuns: 100 },
    );
});

test('loadFromState detects Fabric image objects regardless of type casing', async () => {
    const canvas = new MockCanvas();
    const snapshot = JSON.stringify({
        version: '7.0.0',
        width: 640,
        height: 480,
        objects: [{ type: 'Image', left: 0, top: 0, opacity: 1 }],
        _editorState: {
            currentScale: 1,
            currentRotation: 0,
            baseImageScale: 1,
            currentImageMimeType: 'image/png',
        },
    });

    const result = await loadFromState({
        canvas,
        jsonString: snapshot,
        setCanvasSize: makeSetCanvasSize(canvas),
    });

    assert.ok(result.originalImage, 'capitalized Fabric image type must be detected');
    assert.equal(result.originalImage.type, 'Image');
});

test('saveState copies mask custom metadata when Fabric omits propertiesToInclude', async () => {
    const canvas = new MockCanvas();
    canvas.width = 320;
    canvas.height = 240;
    const mask = {
        type: 'rect',
        left: 10,
        top: 12,
        opacity: 0.5,
        fill: 'rgba(10,20,30,0.4)',
        stroke: '#123456',
        strokeWidth: 4,
        maskId: 7,
        maskUid: 'uid-7',
        maskName: 'mask7',
        originalAlpha: 0.5,
        originalStroke: '#123456',
        originalStrokeWidth: 4,
        hasControls: true,
        selectable: true,
        strokeUniform: true,
        lockRotation: true,
        transparentCorners: false,
        borderColor: 'red',
        cornerColor: 'black',
        cornerSize: 8,
    };
    canvas.add(mask);
    canvas.setActiveObject(mask);
    canvas.toJSON = function toJSONWithoutCustomProps() {
        return {
            version: '7.0.0',
            width: this.width,
            height: this.height,
            objects: this.objects.map((object) => ({
                type: object.type,
                left: object.left,
                top: object.top,
                opacity: object.opacity,
                fill: object.fill,
                stroke: object.stroke,
                strokeWidth: object.strokeWidth,
            })),
        };
    };

    const snapshot = saveState({
        canvas,
        currentScale: 1,
        currentRotation: 0,
        baseImageScale: 1,
        currentImageMimeType: 'image/jpeg',
    });
    const json = JSON.parse(snapshot);

    assert.equal(json.objects[0].maskId, 7);
    assert.equal(json.objects[0].maskUid, 'uid-7');
    assert.equal(json.objects[0].maskName, 'mask7');
    assert.equal(json.objects[0].originalAlpha, 0.5);
    assert.equal(json.objects[0].originalStroke, '#123456');
    assert.equal(json.objects[0].originalStrokeWidth, 4);
    assert.equal(json.objects[0].hasControls, true);
    assert.equal(json.objects[0].selectable, true);
    assert.equal(json.objects[0].strokeUniform, true);
    assert.equal(json.objects[0].lockRotation, true);
    assert.equal(json.objects[0].transparentCorners, false);
    assert.equal(json.objects[0].borderColor, 'red');
    assert.equal(json.objects[0].cornerColor, 'black');
    assert.equal(json.objects[0].cornerSize, 8);
    assert.equal(json._editorState.activeMaskId, 7);

    const restoredCanvas = new MockCanvas();
    const result = await loadFromState({
        canvas: restoredCanvas,
        jsonString: snapshot,
        setCanvasSize: makeSetCanvasSize(restoredCanvas),
    });

    assert.equal(result.editorState.activeMaskId, 7);
    assert.equal(result.maxMaskId, 7);
    assert.equal(result.objects[0].maskId, 7);
    assert.equal(result.objects[0].maskUid, 'uid-7');
    assert.equal(result.objects[0].maskName, 'mask7');
    assert.equal(result.objects[0].originalStroke, '#123456');
    assert.equal(result.objects[0].originalStrokeWidth, 4);
    assert.equal(result.objects[0].hasControls, true);
    assert.equal(result.objects[0].selectable, true);
    assert.equal(result.objects[0].strokeUniform, true);
    assert.equal(result.objects[0].lockRotation, true);
    assert.equal(result.objects[0].transparentCorners, false);
    assert.equal(result.objects[0].borderColor, 'red');
    assert.equal(result.objects[0].cornerColor, 'black');
    assert.equal(result.objects[0].cornerSize, 8);
});

// ─── Sanity checks on the constants the property depends on ────────────────

test('SNAPSHOT_CUSTOM_KEYS includes every key the round-trip property relies on', () => {
    // The property assumes the serializer asks Fabric to carry these
    // keys onto every object payload. If the constant ever drifts,
    // the round-trip assertions above stop being meaningful.
    for (const k of [
        'maskId',
        'maskUid',
        'maskName',
        'isCropRect',
        'maskLabel',
        'originalAlpha',
        'originalStroke',
        'originalStrokeWidth',
        'hasControls',
        'selectable',
        'strokeUniform',
        'lockRotation',
        'transparentCorners',
        'borderColor',
        'cornerColor',
        'cornerSize',
    ]) {
        assert.ok(SNAPSHOT_CUSTOM_KEYS.includes(k), `SNAPSHOT_CUSTOM_KEYS must include '${k}'`);
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
                maskUid: 'uid-101',
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
                maskUid: 'uid-102',
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
            currentImageMimeType: 'image/png',
        },
    };

    const canvas = new MockCanvas();
    canvas.loadFromJSON = async function loadFromJSON(json) {
        this.objects = json.objects.toReversed().map((o) => ({
            type: o.type,
            left: o.left,
            top: o.top,
            opacity: o.opacity ?? 1,
            maskUid: o.maskUid,
            maskId: 999,
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
    const byUid = new Map(result.objects.map((object) => [object.maskUid, object]));
    assert.equal(byUid.get('uid-101').maskId, 101);
    assert.equal(byUid.get('uid-101').maskName, 'mask101');
    assert.equal(byUid.get('uid-101').originalStroke, '#123456');
    assert.equal(byUid.get('uid-101').originalStrokeWidth, 4);
    assert.equal(byUid.get('uid-102').maskId, 102);
    assert.equal(byUid.get('uid-102').maskName, 'mask102');
    assert.equal(byUid.get('uid-102').originalStroke, '#abcdef');
    assert.equal(byUid.get('uid-102').originalStrokeWidth, 6);
});
