import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { createFullPreset } from '../../src/presets/full/index.js';
import { createMinimalPreset } from '../../src/presets/minimal/index.js';
import {
    SnapshotMigrationError,
    detectSnapshotVersion,
    loadV2Snapshot,
    migrateV2Snapshot,
    v2SnapshotMigration,
} from '../../src/migrate-v2/index.js';
import { fabric, resetEditorDom } from '../helpers/fabric-environment.mjs';

async function fixture(name) {
    return JSON.parse(
        await readFile(new URL(`../fixtures/migrate-v2/${name}.json`, import.meta.url), 'utf8'),
    );
}

test('snapshot generation detection distinguishes source, current, future, and malformed input', async () => {
    const source = await fixture('core-transform-filters');
    assert.deepEqual(detectSnapshotVersion(source), {
        kind: 'source',
        schema: 'image-editor.canvas@2',
        version: 2,
    });
    assert.deepEqual(
        detectSnapshotVersion({
            schema: 'image-editor.state',
            version: 3,
            core: {},
            plugins: {},
        }),
        { kind: 'current', schema: 'image-editor.state', version: 3 },
    );
    assert.deepEqual(
        detectSnapshotVersion({
            schema: 'image-editor.state',
            version: 4,
            core: {},
            plugins: {},
        }),
        { kind: 'unsupported', schema: 'image-editor.state', version: 4 },
    );
    assert.deepEqual(detectSnapshotVersion('{not-json'), { kind: 'unknown' });
    assert.deepEqual(detectSnapshotVersion({ objects: [], _editorState: {} }), {
        kind: 'unknown',
    });
    let getterCalls = 0;
    const accessorInput = {};
    Object.defineProperty(accessorInput, 'objects', {
        enumerable: true,
        get() {
            getterCalls += 1;
            return [];
        },
    });
    assert.deepEqual(detectSnapshotVersion(accessorInput), { kind: 'unknown' });
    assert.equal(getterCalls, 0);
    assert.throws(
        () =>
            migrateV2Snapshot({
                schema: 'image-editor.state',
                version: 4,
                core: {},
                plugins: {},
            }),
        (error) => error instanceof SnapshotMigrationError && error.code === 'schema.unsupported',
    );
});

test('conversion is deterministic, immutable, and maps Core, Transform, and Filters state', async () => {
    const source = await fixture('core-transform-filters');
    const before = structuredClone(source);
    const first = migrateV2Snapshot(source);
    const second = migrateV2Snapshot(JSON.stringify(source));

    assert.deepEqual(first, second);
    assert.deepEqual(source, before);
    assert.equal(first.schema, 'image-editor.state');
    assert.equal(first.version, 3);
    assert.equal(first.core.canvasWidth, 64);
    assert.equal(first.core.canvasHeight, 48);
    assert.equal(first.core.baseImageScale, 0.75);
    assert.equal(first.core.imageMimeType, 'image/png');
    assert.equal(first.core.canvas.objects.length, 1);
    assert.equal(first.core.canvas.objects[0].editorObjectKind, 'baseImage');
    assert.deepEqual(first.core.canvas.objects[0].filters, []);
    assert.deepEqual(first.plugins['plugin:transform'], {
        version: 1,
        data: {
            scale: 1.25,
            rotationDegrees: 90,
            flipX: true,
            flipY: false,
        },
    });
    assert.deepEqual(first.plugins['plugin:filters'], {
        version: 1,
        data: {
            schema: 'image-editor.filters',
            version: 1,
            filters: [{ type: 'brightness', value: 0.2 }, { type: 'grayscale' }],
        },
    });
    assert.equal('foundation:overlay' in first.plugins, false);
    assert.equal('plugin:history' in first.plugins, false);
});

test('conversion maps Mask and every Annotation codec with stable selection', async () => {
    const source = await fixture('overlays-and-selection');
    const snapshot = migrateV2Snapshot(source);
    const overlay = snapshot.plugins['foundation:overlay'];

    assert.ok(overlay);
    assert.equal(overlay.version, 1);
    assert.deepEqual(
        overlay.data.overlays.map((record) => [record.kind, record.codec.type]),
        [
            ['mask:object', 'mask:object'],
            ['annotation:text', 'annotation:textbox'],
            ['annotation:shape', 'annotation:shape-object'],
            ['annotation:draw', 'annotation:draw-path'],
        ],
    );
    assert.deepEqual(overlay.data.selectionIds, ['annotation:draw:13']);
    assert.deepEqual(snapshot.plugins['plugin:mask'], {
        version: 1,
        data: { counter: 7 },
    });
    assert.equal(snapshot.plugins['plugin:history'], undefined);
    assert.equal(snapshot.plugins['plugin:crop'], undefined);
    assert.equal(snapshot.plugins['plugin:mosaic'], undefined);
});

test('unsupported persisted state is strict by default and explicit under lossy policy', async () => {
    const source = await fixture('committed-raster');
    source.unsupportedDocumentState = { value: 1 };

    assert.throws(
        () => migrateV2Snapshot(source),
        (error) =>
            error instanceof SnapshotMigrationError &&
            error.code === 'field.unsupported' &&
            error.path === '$.unsupportedDocumentState',
    );

    const warnings = [];
    const migrated = migrateV2Snapshot(source, {
        unsupportedFieldPolicy: 'warn-and-skip',
        onWarning: (warning) => warnings.push(warning),
    });
    assert.equal(migrated.version, 3);
    assert.deepEqual(
        warnings.map((warning) => warning.code),
        ['field.unsupported'],
    );

    const transient = await fixture('committed-raster');
    transient.objects.push({ type: 'Rect', editorObjectKind: 'session', isCropRect: true });
    assert.throws(() => migrateV2Snapshot(transient), /Unsupported Canvas object/);
    const transientWarnings = [];
    const withoutTransient = migrateV2Snapshot(transient, {
        unsupportedFieldPolicy: 'warn-and-skip',
        onWarning: (warning) => transientWarnings.push(warning),
    });
    assert.equal(withoutTransient.core.canvas.objects.length, 1);
    assert.deepEqual(
        transientWarnings.map((warning) => warning.code),
        ['object.transient'],
    );
});

test('conversion enforces input limits and requires explicit dimensions when absent', async () => {
    const source = await fixture('committed-raster');
    delete source.width;
    delete source.height;
    assert.throws(() => migrateV2Snapshot(source), /provide canvasSize/i);
    assert.equal(
        migrateV2Snapshot(source, { canvasSize: { width: 40, height: 32 } }).core.canvasWidth,
        40,
    );
    assert.throws(
        () => migrateV2Snapshot(source, { maxInputBytes: 32 }),
        (error) => error instanceof SnapshotMigrationError && error.code === 'input.bytes',
    );
    const cyclic = await fixture('committed-raster');
    cyclic.self = cyclic;
    assert.throws(
        () => migrateV2Snapshot(cyclic),
        (error) => error instanceof SnapshotMigrationError && error.code === 'input.cycle',
    );
    assert.throws(
        () => migrateV2Snapshot('{"__proto__":{"polluted":true}}'),
        (error) => error instanceof SnapshotMigrationError && error.code === 'input.key',
    );
    const accessor = await fixture('committed-raster');
    let getterCalls = 0;
    Object.defineProperty(accessor, 'dangerousAccessor', {
        enumerable: true,
        get() {
            getterCalls += 1;
            return 'unexpected';
        },
    });
    assert.throws(
        () => migrateV2Snapshot(accessor),
        (error) => error instanceof SnapshotMigrationError && error.code === 'input.accessor',
    );
    assert.equal(getterCalls, 0);

    const toJsonInput = await fixture('committed-raster');
    let toJsonCalls = 0;
    Object.defineProperty(toJsonInput, 'toJSON', {
        value() {
            toJsonCalls += 1;
            return {};
        },
    });
    assert.throws(
        () => migrateV2Snapshot(toJsonInput),
        (error) => error instanceof SnapshotMigrationError && error.code === 'input.property',
    );
    assert.equal(toJsonCalls, 0);

    const sparse = await fixture('committed-raster');
    sparse.objects = new Array(10_000);
    assert.throws(
        () => migrateV2Snapshot(sparse, { maxInputBytes: 256 }),
        (error) => error instanceof SnapshotMigrationError && error.code === 'input.bytes',
    );
});

test('the migration adapter and load helper use only the explicit public load hook', async () => {
    const source = await fixture('committed-raster');
    const migration = v2SnapshotMigration();
    assert.equal(migration.sourceSchema, 'image-editor.canvas@2');
    assert.equal(migration.targetSchema, 'image-editor.state@3');
    assert.equal(migration.canMigrate(source), true);
    assert.equal(migration.canMigrate(migrateV2Snapshot(source)), false);

    let received;
    const editor = {
        async loadFromState(input, options) {
            received = { input, options };
        },
    };
    await loadV2Snapshot(editor, source);
    assert.equal(received.input, source);
    assert.equal(received.options.missingPluginPolicy, 'error');
    assert.equal(received.options.migrations.length, 1);
    assert.equal(received.options.migrations[0].canMigrate(source), true);
});

test('load helper restores a frozen Snapshot through the Full Preset', async () => {
    const ids = resetEditorDom({ containerWidth: 64, containerHeight: 48 });
    const preset = createFullPreset(fabric, { transform: { animationDuration: 0 } });
    try {
        await preset.editor.init({ canvas: ids.canvas, canvasContainer: ids.canvasContainer });
        await loadV2Snapshot(preset.editor, await fixture('core-transform-filters'));
        const restored = JSON.parse(preset.editor.saveState());
        assert.equal(restored.schema, 'image-editor.state');
        assert.equal(restored.version, 3);
        assert.equal(restored.core.canvasWidth, 64);
        assert.equal(preset.transform.getState().scale, 1.25);
        assert.deepEqual(
            preset.filters.getState().filters.map((filter) => filter.type),
            ['brightness', 'grayscale'],
        );
        assert.equal(preset.history.getState().isEnabled, true);
        assert.equal(preset.history.getState().size, 0);
    } finally {
        await preset.editor.disposeAsync();
        document.body.innerHTML = '';
    }
});

test('load helper supports disabled History and rejects an uninitialized editor', async () => {
    const source = await fixture('committed-raster');
    const uninitialized = createFullPreset(fabric);
    await assert.rejects(
        () => loadV2Snapshot(uninitialized.editor, source),
        /before initialization/i,
    );
    await uninitialized.editor.disposeAsync();

    const ids = resetEditorDom({ containerWidth: 40, containerHeight: 32 });
    const preset = createFullPreset(fabric, {
        history: { enabled: false },
        transform: { animationDuration: 0 },
    });
    try {
        await preset.editor.init({ canvas: ids.canvas, canvasContainer: ids.canvasContainer });
        await loadV2Snapshot(preset.editor, source);
        assert.equal(preset.history.getState().isEnabled, false);
        assert.equal(preset.history.getState().size, 0);
    } finally {
        await preset.editor.disposeAsync();
        document.body.innerHTML = '';
    }
});

test('load helper reports missing Plugins before mutating the document', async () => {
    const ids = resetEditorDom({ containerWidth: 40, containerHeight: 32 });
    const preset = createMinimalPreset(fabric);
    try {
        await preset.editor.init({ canvas: ids.canvas, canvasContainer: ids.canvasContainer });
        const before = preset.editor.saveState();
        const source = await fixture('core-transform-filters');
        await assert.rejects(() => loadV2Snapshot(preset.editor, source), /plugin:filters/);
        assert.equal(preset.editor.saveState(), before);
    } finally {
        await preset.editor.disposeAsync();
        document.body.innerHTML = '';
    }
});

test('load helper rolls back document and History state after deserialization failure', async () => {
    const ids = resetEditorDom({ containerWidth: 64, containerHeight: 64 });
    const preset = createFullPreset(fabric, { transform: { animationDuration: 0 } });
    try {
        await preset.editor.init({ canvas: ids.canvas, canvasContainer: ids.canvasContainer });
        await loadV2Snapshot(preset.editor, await fixture('overlays-and-selection'));
        const beforeState = preset.editor.saveState();
        const beforeHistory = preset.history.getState();
        const malformed = await fixture('overlays-and-selection');
        malformed.objects[2].clipPath = { type: 'UnregisteredSnapshotFixture' };

        await assert.rejects(() => loadV2Snapshot(preset.editor, malformed));
        assert.equal(preset.editor.saveState(), beforeState);
        assert.deepEqual(preset.history.getState(), beforeHistory);
    } finally {
        await preset.editor.disposeAsync();
        document.body.innerHTML = '';
    }
});

test('load helper restores every persistent overlay codec through the Full Preset', async () => {
    const ids = resetEditorDom({ containerWidth: 64, containerHeight: 64 });
    const preset = createFullPreset(fabric, { transform: { animationDuration: 0 } });
    try {
        await preset.editor.init({ canvas: ids.canvas, canvasContainer: ids.canvasContainer });
        await loadV2Snapshot(preset.editor, await fixture('overlays-and-selection'));
        assert.equal(preset.masks.getAll().length, 1);
        assert.equal(preset.annotations.list().length, 3);
        assert.deepEqual(preset.overlays.getSelection().ids, ['annotation:draw:13']);
        const restored = JSON.parse(preset.editor.saveState());
        assert.equal(restored.plugins['foundation:overlay'].data.overlays.length, 4);
    } finally {
        await preset.editor.disposeAsync();
        document.body.innerHTML = '';
    }
});
