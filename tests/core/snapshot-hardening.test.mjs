import assert from 'node:assert/strict';
import test from 'node:test';

import {
    SnapshotValidationError,
    SnapshotVersionUnsupportedError,
} from '../../src/core-runtime/errors.js';
import {
    DEFAULT_SNAPSHOT_LIMITS,
    MementoService,
    SnapshotService,
    StateSliceRegistry,
} from '../../src/core-runtime/state/index.js';
import { ImageEditorCore } from '../../src/core/index.js';
import { overlayFoundationPlugin } from '../../src/foundations/overlay/index.js';
import { fabric, makeImageDataUrl, resetEditorDom } from '../helpers/fabric-environment.mjs';

function valid(value) {
    return { valid: true, value };
}

function createSnapshotHarness(limitOverrides = {}) {
    let core = {};
    const slices = new StateSliceRegistry();
    const adapter = {
        capture: () => core,
        restore: (next) => {
            core = next;
        },
        validateSnapshot: (value) => valid(value),
    };
    const mementos = new MementoService(adapter, slices);
    const snapshots = new SnapshotService(
        adapter,
        slices,
        mementos,
        undefined,
        Object.freeze({ ...DEFAULT_SNAPSHOT_LIMITS, ...limitOverrides }),
    );
    return { snapshots, slices };
}

function snapshotWith(data) {
    return {
        schema: 'image-editor.state',
        version: 3,
        core: {},
        plugins: { 'example-test:payload': { version: 1, data } },
    };
}

function unsupportedCanvasSnapshot(overrides = {}) {
    return {
        version: '7.4.0',
        objects: [],
        _editorState: {
            currentScale: 1,
            currentRotation: 0,
            baseImageScale: 1,
        },
        ...overrides,
    };
}

function pngHeaderDataUrl(width, height) {
    const bytes = Buffer.alloc(24);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(bytes, 0);
    Buffer.from('IHDR').copy(bytes, 12);
    bytes.writeUInt32BE(width, 16);
    bytes.writeUInt32BE(height, 20);
    return `data:image/png;base64,${bytes.toString('base64')}`;
}

test('unsupported Snapshot detection is typed, gives a migration entry, and performs zero mutation', async () => {
    const ids = resetEditorDom();
    const editor = new ImageEditorCore(fabric);
    await editor.init({ canvas: ids.canvas });
    await editor.loadImage(makeImageDataUrl());
    const before = editor.saveState();

    await assert.rejects(editor.loadFromState(unsupportedCanvasSnapshot()), (error) => {
        assert.equal(error instanceof SnapshotVersionUnsupportedError, true);
        assert.equal(error.migrationEntry, '@bensitu/image-editor/migrate-v2');
        return true;
    });

    assert.equal(editor.saveState(), before);
    await editor.disposeAsync();
});

test('unsupported Snapshot detection rejects false positives and future envelopes precisely', async () => {
    const { snapshots } = createSnapshotHarness();

    await assert.rejects(
        snapshots.load({ objects: [], _editorState: {} }),
        (error) =>
            error instanceof SnapshotValidationError &&
            !(error instanceof SnapshotVersionUnsupportedError),
    );
    await assert.rejects(
        snapshots.load({ version: 2 }),
        (error) =>
            error instanceof SnapshotValidationError &&
            !(error instanceof SnapshotVersionUnsupportedError),
    );
    await assert.rejects(
        snapshots.load({
            schema: 'image-editor.state',
            version: 4,
            core: {},
            plugins: {},
        }),
        (error) => error instanceof SnapshotVersionUnsupportedError && error.detectedVersion === 4,
    );
});

test('explicit Snapshot migrations are deterministic, isolated, and revalidated', async () => {
    const { snapshots } = createSnapshotHarness();
    const source = { schema: 'example.source', payload: { value: 1 } };
    const before = structuredClone(source);
    const target = {
        schema: 'image-editor.state',
        version: 3,
        core: { migrated: true },
        plugins: {},
    };
    const migration = {
        sourceSchema: 'example.source@1',
        targetSchema: 'image-editor.state@3',
        canMigrate: (input) => input?.schema === 'example.source',
        migrate: (input) => {
            assert.throws(() => {
                input.payload.value = 2;
            }, TypeError);
            return target;
        },
    };

    await snapshots.load(source, { migrations: [migration] });
    assert.deepEqual(source, before);

    let laterMigrationCalls = 0;
    await snapshots.prepareForLoad(source, {
        migrations: [
            migration,
            {
                ...migration,
                migrate: () => {
                    laterMigrationCalls += 1;
                    return { schema: 'invalid' };
                },
            },
        ],
    });
    assert.equal(laterMigrationCalls, 0);
    await assert.rejects(
        snapshots.prepareForLoad(source, {
            migrations: [{ ...migration, migrate: () => ({ schema: 'invalid' }) }],
        }),
        /schema must be/i,
    );
});

test('Snapshot limits reject resource, structure, image, and source attacks', async (t) => {
    await t.test('top-level bytes for object input', async () => {
        const { snapshots } = createSnapshotHarness({ maxInputBytes: 512 });
        await assert.rejects(snapshots.load(snapshotWith('x'.repeat(1_000))), /input exceeds/i);
    });

    await t.test('object count', async () => {
        const { snapshots } = createSnapshotHarness({ maxObjectCount: 8 });
        await assert.rejects(
            snapshots.load(snapshotWith({ values: [{}, {}, {}, {}, {}] })),
            /object count exceeds/i,
        );
    });

    await t.test('string length', async () => {
        const { snapshots } = createSnapshotHarness({ maxStringLength: 12 });
        await assert.rejects(
            snapshots.load(snapshotWith('x'.repeat(13))),
            /string length exceeds/i,
        );
    });

    await t.test('nesting depth', async () => {
        const { snapshots } = createSnapshotHarness({ maxDepth: 6 });
        await assert.rejects(
            snapshots.load(snapshotWith({ a: { b: { c: { d: { e: {} } } } } })),
            /nesting exceeds/i,
        );
    });

    await t.test('plugin count', async () => {
        const { snapshots } = createSnapshotHarness({ maxPluginCount: 1 });
        await assert.rejects(
            snapshots.load({
                schema: 'image-editor.state',
                version: 3,
                core: {},
                plugins: {
                    'example-test:one': { version: 1, data: {} },
                    'example-test:two': { version: 1, data: {} },
                },
            }),
            /plugin count exceeds/i,
        );
    });

    await t.test('non-finite number', async () => {
        const { snapshots } = createSnapshotHarness();
        await assert.rejects(snapshots.load(snapshotWith(Number.NaN)), /must be finite/i);
    });

    await t.test('Data URL bytes', async () => {
        const { snapshots } = createSnapshotHarness({ maxDataUrlBytes: 4 });
        await assert.rejects(
            snapshots.load(snapshotWith('data:image/png;base64,AAAAAAAA')),
            /Data URL exceeds/i,
        );
    });

    await t.test('pixel bomb', async () => {
        const { snapshots } = createSnapshotHarness({ maxDecodedPixels: 10_000 });
        await assert.rejects(
            snapshots.load(snapshotWith(pngHeaderDataUrl(50_000, 50_000))),
            /decoded pixel count exceeds/i,
        );
    });

    await t.test('image dimensions', async () => {
        const { snapshots } = createSnapshotHarness({
            maxDecodedPixels: 1_000_000,
            maxImageDimension: 100,
        });
        await assert.rejects(
            snapshots.load(snapshotWith(pngHeaderDataUrl(101, 1))),
            /image dimensions exceed/i,
        );
    });

    await t.test('external URL', async () => {
        const { snapshots } = createSnapshotHarness();
        await assert.rejects(
            snapshots.load(snapshotWith({ src: 'https://example.invalid/image.png' })),
            /external URL/i,
        );
    });
});

test('Snapshot rejects an installed Slice version mismatch before mutation', async () => {
    const { snapshots, slices } = createSnapshotHarness();
    slices.register({
        id: 'example-test:payload',
        version: 2,
        capture: () => ({}),
        validate: valid,
        restore: () => undefined,
    });

    await assert.rejects(snapshots.load(snapshotWith({})), /version 1 is incompatible/i);
});

test('Snapshot rejects unknown Fabric classes before Canvas mutation', async () => {
    const ids = resetEditorDom();
    const editor = new ImageEditorCore(fabric);
    await editor.init({ canvas: ids.canvas });
    await editor.loadImage(makeImageDataUrl());
    const snapshot = JSON.parse(editor.saveState());
    snapshot.core.canvas.objects[0].type = 'SyntheticUnknownClass';
    const before = editor.saveState();

    await assert.rejects(editor.loadFromState(snapshot), (error) => {
        assert.equal(error instanceof SnapshotValidationError, true);
        assert.match(error.message, /unknown Fabric class/i);
        return true;
    });
    assert.equal(editor.saveState(), before);
    await editor.disposeAsync();
});

test('Snapshot rejects missing Overlay codecs and persistent ID collisions', async (t) => {
    for (const attack of ['missing-codec', 'duplicate-id']) {
        await t.test(attack, async () => {
            const ids = resetEditorDom();
            const editor = new ImageEditorCore(fabric);
            editor.use(overlayFoundationPlugin());
            await editor.init({ canvas: ids.canvas });
            await editor.loadImage(makeImageDataUrl());
            const snapshot = JSON.parse(editor.saveState());
            const overlayKey = Object.keys(snapshot.plugins).find((key) => /overlay/.test(key));
            assert.ok(overlayKey);
            const record = {
                kind: 'example-test:missing-codec',
                persistentId: 'duplicate',
                hidden: false,
                locked: false,
                codec: { type: 'example-test:missing-codec', version: '1.0.0' },
                data: {},
            };
            snapshot.plugins[overlayKey].data.overlays =
                attack === 'missing-codec'
                    ? [record]
                    : [record, { ...record, kind: 'example-test:another-missing-codec' }];

            await assert.rejects(editor.loadFromState(snapshot), (error) => {
                assert.equal(error instanceof SnapshotValidationError, true);
                assert.match(error.message, attack === 'missing-codec' ? /codec/i : /duplicate/i);
                return true;
            });
            await editor.disposeAsync();
        });
    }
});

test('Snapshot Canvas decode timeout aborts cleanly and preserves the document', async () => {
    const ids = resetEditorDom();
    const editor = new ImageEditorCore(fabric, { imageLoadTimeoutMs: 20 });
    await editor.init({ canvas: ids.canvas });
    await editor.loadImage(makeImageDataUrl());
    const snapshot = editor.saveState();
    const before = editor.saveState();
    const canvas = editor.getCanvas();
    const originalLoad = canvas.loadFromJSON.bind(canvas);
    let calls = 0;
    canvas.loadFromJSON = (value, reviver, options) => {
        calls += 1;
        if (calls > 1) return originalLoad(value, reviver, options);
        return new Promise((resolve, reject) => {
            void resolve;
            options?.signal?.addEventListener('abort', () => reject(options.signal.reason), {
                once: true,
            });
        });
    };

    await assert.rejects(editor.loadFromState(snapshot), /decode timed out/i);
    assert.equal(editor.getLifecycleState(), 'initialized');
    assert.equal(editor.saveState(), before);
    await editor.disposeAsync();
});
