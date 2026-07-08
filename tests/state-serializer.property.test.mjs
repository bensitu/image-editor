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
const { StateRestoreError } = await import('../src/core/errors.ts');

const VALID_IMAGE_SRC = 'data:image/png;base64,AAAA';

// ─── Mock Fabric canvas ─────────────────────────────────────────────────────

/**
 * Stand-in for `fabric.Canvas` covering only the four methods the state
 * serializer touches. The implementation mirrors the subset of Fabric
 * behavior this library relies on: toJSON, loadFromJSON,
 * discardActiveObject, and getObjects.
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
                if ('src' in o) out.src = o.src;
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

function makePublicRestoreInput(canvas, snapshot, overrides = {}) {
    return {
        canvas,
        jsonString: snapshot,
        setCanvasSize: makeSetCanvasSize(canvas),
        ...overrides,
    };
}

function makeTrustedRestoreInput(canvas, snapshot, overrides = {}) {
    return makePublicRestoreInput(canvas, snapshot, {
        restoreTrustLevel: 'trusted',
        ...overrides,
    });
}

async function withMockedTimers(callback) {
    const originalSetTimeout = globalThis.setTimeout;
    const originalClearTimeout = globalThis.clearTimeout;
    const timers = [];
    globalThis.setTimeout = (timerCallback, ms) => {
        const timer = { callback: timerCallback, ms, cleared: false };
        timers.push(timer);
        return timer;
    };
    globalThis.clearTimeout = (timer) => {
        if (timer) timer.cleared = true;
    };

    try {
        return await callback(timers);
    } finally {
        globalThis.setTimeout = originalSetTimeout;
        globalThis.clearTimeout = originalClearTimeout;
    }
}

test('loadFromState wraps malformed JSON in StateRestoreError', async () => {
    const canvas = new MockCanvas();

    await assert.rejects(
        () =>
            loadFromState({
                canvas,
                jsonString: '{"objects":[',
                setCanvasSize: makeSetCanvasSize(canvas),
            }),
        (error) => {
            assert.equal(error instanceof StateRestoreError, true);
            assert.equal(error.name, 'StateRestoreError');
            assert.equal(error.message, 'loadFromState: snapshot JSON is malformed.');
            assert.equal(error.originalError instanceof SyntaxError, true);
            return true;
        },
    );
});

test('loadFromState succeeds when canvas.loadFromJSON resolves before timeout', async () => {
    await withMockedTimers(async (timers) => {
        const canvas = new MockCanvas();
        let loadCalled = false;
        canvas.loadFromJSON = async function loadFromJSON(json) {
            loadCalled = true;
            return MockCanvas.prototype.loadFromJSON.call(this, json);
        };

        const result = await loadFromState(
            makePublicRestoreInput(canvas, {
                version: '6.0.0',
                width: 320,
                height: 240,
                objects: [],
            }),
        );

        assert.equal(loadCalled, true);
        assert.equal(result.objects.length, 0);
        assert.equal(timers.length, 1);
        assert.equal(timers[0].ms, 30000);
        assert.equal(timers[0].cleared, true);
    });
});

test('loadFromState rejects with StateRestoreError when canvas.loadFromJSON times out', async () => {
    for (const [label, makeInput] of [
        ['public', makePublicRestoreInput],
        ['trusted', makeTrustedRestoreInput],
    ]) {
        await withMockedTimers(async (timers) => {
            const canvas = new MockCanvas();
            canvas.loadFromJSON = () => new Promise(() => undefined);

            const restorePromise = loadFromState(
                makeInput(canvas, {
                    version: '6.0.0',
                    width: 320,
                    height: 240,
                    objects: [],
                }),
            );

            assert.equal(timers.length, 1, `${label} restore must schedule one timeout`);
            assert.equal(timers[0].ms, 30000);
            timers[0].callback();

            await assert.rejects(
                () => restorePromise,
                (error) => {
                    assert.equal(error instanceof StateRestoreError, true);
                    assert.equal(error.name, 'StateRestoreError');
                    assert.match(error.message, /loadFromState: canvas\.loadFromJSON timed out/);
                    assert.equal(error.originalError?.name, 'ImageLoadTimeoutError');
                    assert.match(error.originalError?.message ?? '', /canvas\.loadFromJSON/);
                    return true;
                },
            );
        });
    }
});

test('loadFromState rejects oversized canvas dimensions before resizing', async () => {
    const canvas = new MockCanvas();
    let resized = false;

    await assert.rejects(
        () =>
            loadFromState({
                canvas,
                jsonString: {
                    version: '7.0.0',
                    width: 100000,
                    height: 100000,
                    objects: [],
                },
                setCanvasSize: () => {
                    resized = true;
                },
                maxCanvasPixels: 1000000,
                maxRestoreCanvasDimension: 200000,
            }),
        (error) =>
            error instanceof StateRestoreError && /exceeds maxCanvasPixels/.test(error.message),
    );

    assert.equal(resized, false);
});

test('public loadFromState rejects oversized snapshot JSON before parsing', async () => {
    const canvas = new MockCanvas();

    await assert.rejects(
        () =>
            loadFromState(
                makePublicRestoreInput(canvas, '{"version":"7.0.0","objects":[]}', {
                    maxSnapshotBytes: 10,
                }),
            ),
        (error) =>
            error instanceof StateRestoreError && /exceeds maxSnapshotBytes/.test(error.message),
    );
});

test('public loadFromState rejects obviously oversized ASCII snapshots before UTF-8 encoding', async () => {
    const canvas = new MockCanvas();
    const hadTextEncoder = 'TextEncoder' in globalThis;
    const previousTextEncoder = globalThis.TextEncoder;

    Object.defineProperty(globalThis, 'TextEncoder', {
        configurable: true,
        writable: true,
        value: class ThrowingTextEncoder {
            encode() {
                throw new Error('TextEncoder should not run for obviously oversized input');
            }
        },
    });

    try {
        await assert.rejects(
            () =>
                loadFromState(
                    makePublicRestoreInput(canvas, 'x'.repeat(32), {
                        maxSnapshotBytes: 10,
                    }),
                ),
            (error) =>
                error instanceof StateRestoreError &&
                /exceeds maxSnapshotBytes/.test(error.message),
        );
    } finally {
        if (hadTextEncoder) {
            Object.defineProperty(globalThis, 'TextEncoder', {
                configurable: true,
                writable: true,
                value: previousTextEncoder,
            });
        } else {
            delete globalThis.TextEncoder;
        }
    }
});

test('public loadFromState still validates exact UTF-8 byte length near the limit', async () => {
    const canvas = new MockCanvas();
    const snapshot = '{"version":"7.0.0","width":1,"height":1,"objects":[],"note":"あ"}';
    const byteLength = Buffer.byteLength(snapshot, 'utf8');

    assert.ok(snapshot.length < byteLength);
    await assert.rejects(
        () =>
            loadFromState(
                makePublicRestoreInput(canvas, snapshot, {
                    maxSnapshotBytes: snapshot.length + 1,
                }),
            ),
        (error) =>
            error instanceof StateRestoreError &&
            error.message.includes(`snapshot JSON size ${byteLength} bytes`),
    );

    await loadFromState(
        makePublicRestoreInput(new MockCanvas(), '{"version":"7.0.0","objects":[]}', {
            maxSnapshotBytes: Buffer.byteLength('{"version":"7.0.0","objects":[]}', 'utf8'),
        }),
    );
});

test('public loadFromState rejects snapshots with too many objects', async () => {
    const canvas = new MockCanvas();

    await assert.rejects(
        () =>
            loadFromState(
                makePublicRestoreInput(
                    canvas,
                    {
                        version: '7.0.0',
                        width: 320,
                        height: 240,
                        objects: [
                            { type: 'rect', left: 0, top: 0 },
                            { type: 'rect', left: 1, top: 1 },
                        ],
                    },
                    {
                        maxSnapshotObjects: 1,
                    },
                ),
            ),
        (error) =>
            error instanceof StateRestoreError &&
            /exceeding maxSnapshotObjects/.test(error.message),
    );
});

test('public loadFromState does not count the same Fabric object reference twice', async () => {
    const canvas = new MockCanvas();
    const marker = '__duplicate_reference_snapshot__';
    const previousParse = JSON.parse;
    const sharedObject = { type: 'rect', left: 0, top: 0 };
    const snapshot = {
        version: '7.0.0',
        width: 320,
        height: 240,
        objects: [sharedObject],
        clipPath: sharedObject,
    };

    JSON.parse = (text, reviver) => {
        if (text === marker) return snapshot;
        return previousParse.call(JSON, text, reviver);
    };

    try {
        await loadFromState(
            makePublicRestoreInput(canvas, marker, {
                maxSnapshotObjects: 1,
            }),
        );
    } finally {
        JSON.parse = previousParse;
    }

    assert.equal(canvas.objects.length, 1);
});

test('public loadFromState still counts distinct nested Fabric objects', async () => {
    const canvas = new MockCanvas();

    await assert.rejects(
        () =>
            loadFromState(
                makePublicRestoreInput(
                    canvas,
                    {
                        version: '7.0.0',
                        width: 320,
                        height: 240,
                        objects: [{ type: 'rect', left: 0, top: 0 }],
                        clipPath: { type: 'rect', left: 1, top: 1 },
                    },
                    {
                        maxSnapshotObjects: 1,
                    },
                ),
            ),
        (error) =>
            error instanceof StateRestoreError && /more than 1 Fabric objects/.test(error.message),
    );
});

test('public loadFromState honors an explicit single-side dimension limit', async () => {
    const canvas = new MockCanvas();
    let resized = false;

    await assert.rejects(
        () =>
            loadFromState({
                canvas,
                jsonString: {
                    version: '7.0.0',
                    width: 9000,
                    height: 100,
                    objects: [],
                },
                setCanvasSize: () => {
                    resized = true;
                },
                maxRestoreCanvasDimension: 8192,
            }),
        (error) =>
            error instanceof StateRestoreError &&
            /exceeds maxRestoreCanvasDimension/.test(error.message),
    );

    assert.equal(resized, false);
});

test('public loadFromState accepts wide editor snapshots under the pixel budget', async () => {
    const canvas = new MockCanvas();

    await loadFromState({
        canvas,
        jsonString: {
            version: '7.0.0',
            width: 10000,
            height: 4000,
            objects: [],
        },
        setCanvasSize: makeSetCanvasSize(canvas),
        maxCanvasPixels: 50000000,
    });

    assert.equal(canvas.width, 10000);
    assert.equal(canvas.height, 4000);
});

test('public loadFromState rejects unsupported Fabric object types', async () => {
    const canvas = new MockCanvas();

    await assert.rejects(
        () =>
            loadFromState(
                makePublicRestoreInput(canvas, {
                    version: '7.0.0',
                    width: 320,
                    height: 240,
                    objects: [{ type: 'script', left: 0, top: 0 }],
                }),
            ),
        (error) =>
            error instanceof StateRestoreError && /unsupported Fabric type/.test(error.message),
    );
});

test('public loadFromState accepts editor-owned custom mask object types', async () => {
    const canvas = new MockCanvas();

    await loadFromState(
        makePublicRestoreInput(canvas, {
            version: '7.0.0',
            width: 320,
            height: 240,
            objects: [
                {
                    editorObjectKind: 'mask',
                    type: 'triangle',
                    maskId: 1,
                    maskUid: 'mask-1',
                    maskName: 'Mask 1',
                    originalAlpha: 0.5,
                    left: 10,
                    top: 20,
                },
            ],
        }),
    );

    assert.equal(canvas.objects[0].type, 'triangle');
    assert.equal(canvas.objects[0].maskId, 1);
});

test('public loadFromState rejects custom mask object types without strict editor metadata', async () => {
    const canvas = new MockCanvas();

    await assert.rejects(
        () =>
            loadFromState(
                makePublicRestoreInput(canvas, {
                    version: '7.0.0',
                    width: 320,
                    height: 240,
                    objects: [
                        {
                            editorObjectKind: 'mask',
                            type: 'triangle',
                            maskId: 1,
                            maskName: 'Mask 1',
                            left: 10,
                            top: 20,
                        },
                    ],
                }),
            ),
        (error) =>
            error instanceof StateRestoreError && /unsupported Fabric type/.test(error.message),
    );
});

test('public loadFromState rejects unsafe remote image sources', async () => {
    const canvas = new MockCanvas();

    await assert.rejects(
        () =>
            loadFromState(
                makePublicRestoreInput(canvas, {
                    version: '7.0.0',
                    width: 320,
                    height: 240,
                    objects: [
                        {
                            editorObjectKind: 'baseImage',
                            type: 'image',
                            src: 'https://example.com/image.png',
                            left: 0,
                            top: 0,
                        },
                    ],
                }),
            ),
        (error) =>
            error instanceof StateRestoreError && /supported data URL source/.test(error.message),
    );
});

test('public loadFromState rejects unsafe nested source-like fields', async () => {
    const cases = [
        [
            'objects[0].fill.source',
            {
                type: 'rect',
                fill: {
                    type: 'pattern',
                    source: 'https://example.com/pattern.png',
                },
            },
        ],
        [
            'objects[0].fill.gradientSource',
            {
                type: 'rect',
                fill: {
                    type: 'gradient',
                    gradientSource: 'https://example.com/gradient.svg',
                },
            },
        ],
    ];

    for (const [fieldPath, object] of cases) {
        const canvas = new MockCanvas();

        await assert.rejects(
            () =>
                loadFromState(
                    makePublicRestoreInput(canvas, {
                        version: '7.0.0',
                        width: 320,
                        height: 240,
                        objects: [object],
                    }),
                ),
            (error) =>
                error instanceof StateRestoreError &&
                error.message.includes(`field "${fieldPath}"`) &&
                /supported data URL source/.test(error.message),
        );
    }
});

test('public loadFromState rejects unsupported nested Fabric object types', async () => {
    const canvas = new MockCanvas();

    await assert.rejects(
        () =>
            loadFromState(
                makePublicRestoreInput(canvas, {
                    version: '7.0.0',
                    width: 320,
                    height: 240,
                    objects: [
                        {
                            type: 'rect',
                            clipPath: {
                                type: 'script',
                                left: 0,
                                top: 0,
                            },
                        },
                    ],
                }),
            ),
        (error) =>
            error instanceof StateRestoreError &&
            error.message.includes('objects[0].clipPath.type') &&
            /unsupported Fabric type/.test(error.message),
    );
});

test('public loadFromState accepts safe nested Fabric object payloads', async () => {
    const canvas = new MockCanvas();

    await loadFromState(
        makePublicRestoreInput(canvas, {
            version: '7.0.0',
            width: 320,
            height: 240,
            objects: [
                {
                    type: 'rect',
                    clipPath: {
                        type: 'rect',
                        left: 2,
                        top: 4,
                    },
                },
            ],
        }),
    );

    assert.equal(canvas.objects[0].clipPath.type, 'rect');
});

test('public loadFromState accepts supported nested data URL sources', async () => {
    const canvas = new MockCanvas();

    await loadFromState(
        makePublicRestoreInput(canvas, {
            version: '7.0.0',
            width: 320,
            height: 240,
            objects: [
                {
                    type: 'rect',
                    fill: {
                        type: 'pattern',
                        source: VALID_IMAGE_SRC,
                    },
                },
            ],
        }),
    );

    assert.equal(canvas.objects[0].fill.source, VALID_IMAGE_SRC);
});

test('public loadFromState accepts supported data URL image sources', async () => {
    const canvas = new MockCanvas();

    const result = await loadFromState(
        makePublicRestoreInput(canvas, {
            version: '7.0.0',
            width: 320,
            height: 240,
            objects: [
                {
                    editorObjectKind: 'baseImage',
                    type: 'image',
                    src: VALID_IMAGE_SRC,
                    left: 0,
                    top: 0,
                },
            ],
            _editorState: {
                currentScale: 1,
                currentRotation: 0,
                baseImageScale: 1,
            },
        }),
    );

    assert.ok(result.originalImage);
    assert.equal(result.originalImage.src, VALID_IMAGE_SRC);
});

test('trusted loadFromState keeps internal restores working with unvalidated sources', async () => {
    const canvas = new MockCanvas();

    const result = await loadFromState(
        makeTrustedRestoreInput(canvas, {
            version: '7.0.0',
            width: 320,
            height: 240,
            objects: [
                {
                    editorObjectKind: 'baseImage',
                    type: 'image',
                    src: 'https://example.com/internal-history-image.png',
                    clipPath: {
                        type: 'script',
                        src: 'https://example.com/internal-clip.png',
                    },
                    left: 0,
                    top: 0,
                },
            ],
            _editorState: {
                currentScale: 1,
                currentRotation: 0,
                baseImageScale: 1,
            },
        }),
    );

    assert.ok(result.originalImage);
    assert.equal(result.originalImage.src, 'https://example.com/internal-history-image.png');
    assert.equal(result.originalImage.clipPath.type, 'script');
});

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
    // Mosaic preview marker — must be filtered out before history.
    fc.record({
        type: fc.constant('circle'),
        left: fc.integer({ min: 0, max: 600 }),
        top: fc.integer({ min: 0, max: 500 }),
        opacity: fc.constant(1),
        isMosaicPreview: fc.constant(true),
    }),
);

// Optional non-mask `'image'` object simulating the loaded photo. Used
// to exercise `loadFromState`'s `originalImage` discovery path
// (sub-).
const originalImageArb = fc.option(
    fc.record({
        editorObjectKind: fc.constant('baseImage'),
        type: fc.constant('image'),
        src: fc.constant(VALID_IMAGE_SRC),
        left: fc.integer({ min: 0, max: 100 }),
        top: fc.integer({ min: 0, max: 100 }),
        opacity: fc.constant(1),
        flipX: fc.boolean(),
        flipY: fc.boolean(),
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
            editorObjectKind: 'mask',
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
        { ...scenario.editorState, activeObjectKind: null },
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
                j1.objects.every(
                    (o) =>
                        o.isCropRect !== true && o.maskLabel !== true && o.isMosaicPreview !== true,
                ),
                'the documented contract: session-only crop rect / mask labels / Mosaic previews must be filtered before history',
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
                { ...scenario.editorState, activeObjectKind: null },
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
                result.objects.every(
                    (o) =>
                        o.isCropRect !== true && o.maskLabel !== true && o.isMosaicPreview !== true,
                ),
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

test('loadFromState restores strictly marked base image objects', async () => {
    const canvas = new MockCanvas();
    const snapshot = JSON.stringify({
        version: '7.0.0',
        width: 640,
        height: 480,
        objects: [
            {
                editorObjectKind: 'baseImage',
                type: 'Image',
                src: VALID_IMAGE_SRC,
                left: 0,
                top: 0,
                opacity: 1,
            },
        ],
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

    assert.ok(result.originalImage, 'strict base image metadata must be detected');
    assert.equal(result.originalImage.type, 'Image');
});

test('saveState copies mask custom metadata when Fabric omits propertiesToInclude', async () => {
    const canvas = new MockCanvas();
    canvas.width = 320;
    canvas.height = 240;
    const mask = {
        editorObjectKind: 'mask',
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

test('saveState matches live objects when Fabric serializes objects in a different order', () => {
    const canvas = new MockCanvas();
    canvas.width = 320;
    canvas.height = 240;
    canvas.add({
        editorObjectKind: 'baseImage',
        type: 'image',
        src: VALID_IMAGE_SRC,
        left: 0,
        top: 0,
        opacity: 1,
    });
    canvas.add({
        editorObjectKind: 'mask',
        type: 'rect',
        left: 10,
        top: 12,
        opacity: 0.5,
        maskId: 7,
        maskUid: 'uid-7',
        maskName: 'mask7',
        originalAlpha: 0.5,
    });
    canvas.add({
        editorObjectKind: 'annotation',
        type: 'textbox',
        left: 20,
        top: 24,
        opacity: 1,
        annotationId: 3,
        annotationType: 'text',
        annotationName: 'note3',
    });
    canvas.toJSON = function toJSONWithReorderedPlainObjects() {
        return {
            version: '7.0.0',
            width: this.width,
            height: this.height,
            objects: this.objects
                .map((object) => ({
                    type: object.type,
                    left: object.left,
                    top: object.top,
                    opacity: object.opacity,
                }))
                .toReversed(),
        };
    };

    const snapshot = saveState({
        canvas,
        currentScale: 1,
        currentRotation: 0,
        baseImageScale: 1,
        currentImageMimeType: 'image/png',
    });
    const objects = JSON.parse(snapshot).objects;
    const byPosition = new Map(objects.map((object) => [`${object.left},${object.top}`, object]));

    assert.equal(byPosition.get('0,0').editorObjectKind, 'baseImage');
    assert.equal(byPosition.get('10,12').maskId, 7);
    assert.equal(byPosition.get('10,12').maskUid, 'uid-7');
    assert.equal(byPosition.get('20,24').annotationId, 3);
    assert.equal(byPosition.get('20,24').annotationName, 'note3');
});

test('loadFromState restores base image and annotation metadata after Fabric reorder', async () => {
    const snapshot = {
        version: '7.0.0',
        width: 320,
        height: 240,
        objects: [
            {
                editorObjectKind: 'baseImage',
                type: 'image',
                src: VALID_IMAGE_SRC,
                left: 0,
                top: 0,
                opacity: 1,
            },
            {
                editorObjectKind: 'annotation',
                type: 'textbox',
                left: 20,
                top: 24,
                opacity: 1,
                annotationId: 3,
                annotationType: 'text',
                annotationName: 'note3',
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
        this.objects = json.objects.toReversed().map((object) => ({
            type: object.type,
            left: object.left,
            top: object.top,
            opacity: object.opacity,
        }));
        return this;
    };

    const result = await loadFromState({
        canvas,
        jsonString: snapshot,
        setCanvasSize: makeSetCanvasSize(canvas),
    });

    assert.equal(result.originalImage.left, 0);
    assert.equal(result.originalImage.editorObjectKind, 'baseImage');
    assert.equal(result.annotations.length, 1);
    assert.equal(result.annotations[0].left, 20);
    assert.equal(result.annotations[0].annotationId, 3);
    assert.equal(result.annotations[0].annotationName, 'note3');
});

// ─── Sanity checks on the constants the property depends on ────────────────

test('SNAPSHOT_CUSTOM_KEYS includes every key the round-trip property relies on', () => {
    // The property assumes the serializer asks Fabric to carry these
    // keys onto every object payload. If the constant ever drifts,
    // the round-trip assertions above stop being meaningful.
    for (const k of [
        'maskId',
        'editorObjectKind',
        'sessionObjectType',
        'maskUid',
        'maskName',
        'isCropRect',
        'maskLabel',
        'isMosaicPreview',
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
        'annotationId',
        'annotationType',
        'annotationName',
        'annotationHidden',
        'annotationLocked',
    ]) {
        assert.ok(SNAPSHOT_CUSTOM_KEYS.includes(k), `SNAPSHOT_CUSTOM_KEYS must include '${k}'`);
    }
    assert.equal(Object.isFrozen(SNAPSHOT_CUSTOM_KEYS), true);
});

test('loadFromState restores duplicate-position masks one-to-one', async () => {
    const snapshot = {
        version: '6.0.0',
        width: 320,
        height: 240,
        objects: [
            {
                editorObjectKind: 'mask',
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
                editorObjectKind: 'mask',
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

test('loadFromState legacy mask fallback matches duplicate positions by transform', async () => {
    const snapshot = {
        version: '6.0.0',
        width: 320,
        height: 240,
        objects: [
            {
                editorObjectKind: 'mask',
                type: 'rect',
                left: 20,
                top: 30,
                angle: 15,
                scaleX: 1,
                scaleY: 1,
                maskId: 201,
                maskName: 'small',
                originalAlpha: 0.4,
            },
            {
                editorObjectKind: 'mask',
                type: 'rect',
                left: 20,
                top: 30,
                angle: 45,
                scaleX: 2,
                scaleY: 3,
                maskId: 202,
                maskName: 'large',
                originalAlpha: 0.8,
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
            angle: o.angle,
            scaleX: o.scaleX,
            scaleY: o.scaleY,
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

    const byName = new Map(result.objects.map((object) => [object.maskName, object]));
    assert.equal(byName.get('small').maskId, 201);
    assert.equal(byName.get('small').angle, 15);
    assert.equal(byName.get('small').scaleX, 1);
    assert.equal(byName.get('large').maskId, 202);
    assert.equal(byName.get('large').angle, 45);
    assert.equal(byName.get('large').scaleX, 2);
    assert.equal(byName.get('large').scaleY, 3);
});
