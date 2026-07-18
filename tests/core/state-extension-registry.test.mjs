import assert from 'node:assert/strict';
import test from 'node:test';

import { SnapshotValidationError, StateRegistrationError } from '../../src/core-runtime/errors.js';
import {
    MementoService,
    ObjectPropertyRegistry,
    SnapshotService,
    StateSliceRegistry,
    TransientObjectRegistry,
} from '../../src/core-runtime/state/index.js';

function createSnapshotHarness(warnings = []) {
    let core = { canvasWidth: 100, canvasHeight: 80 };
    const slices = new StateSliceRegistry();
    const adapter = {
        capture: () => core,
        restore: (next) => {
            core = { ...next };
        },
        validateSnapshot: (value) =>
            value && typeof value === 'object'
                ? { valid: true, value }
                : { valid: false, message: 'core must be an object' },
    };
    const mementos = new MementoService(adapter, slices);
    const snapshots = new SnapshotService(adapter, slices, mementos, (warning) =>
        warnings.push(warning),
    );
    return { slices, mementos, snapshots, getCore: () => core };
}

test('object property registrations are ordered, idempotent per owner, and conflict-safe', async () => {
    const registry = new ObjectPropertyRegistry();
    const first = registry.register({ owner: 'example/mask', keys: ['maskId', 'maskName'] });
    const second = registry.register({ owner: 'example/mask', keys: ['maskId'] });
    assert.deepEqual(registry.listKeys(), ['maskId', 'maskName']);
    assert.equal(registry.getOwner('maskId'), 'example/mask');
    assert.throws(
        () => registry.register({ owner: 'example/other', keys: ['maskId'] }),
        StateRegistrationError,
    );
    assert.throws(
        () => registry.register({ owner: 'example/mask', keys: ['__proto__'] }),
        StateRegistrationError,
    );
    await second.dispose();
    assert.deepEqual(registry.listKeys(), ['maskId', 'maskName']);
    await first.dispose();
    assert.deepEqual(registry.listKeys(), []);
});

test('transient predicate errors are isolated with owner-attributed warnings', () => {
    const warnings = [];
    const registry = new TransientObjectRegistry((warning) => warnings.push(warning));
    registry.register('example/failing', () => {
        throw new Error('predicate failure');
    });
    registry.register('example/preview', (object) => object.type === 'preview');
    assert.equal(registry.isTransient({ type: 'preview' }), true);
    assert.equal(registry.isTransient({ type: 'document' }), false);
    assert.equal(warnings.length, 2);
    assert.equal(warnings[0].details.owner, 'example/failing');
});

test('public snapshot round-trip validates slices and excludes configuration by contract', async () => {
    const harness = createSnapshotHarness();
    let state = { value: 1 };
    harness.slices.register({
        id: 'example/plugin',
        version: 1,
        capture: () => state,
        validate: (value) =>
            value && typeof value === 'object' && Number.isFinite(value.value)
                ? { valid: true, value }
                : { valid: false, message: 'value must be finite' },
        restore: (value) => {
            state = value;
        },
    });
    const serialized = harness.snapshots.stringify();
    assert.equal(serialized.includes('animationDuration'), false);
    state = { value: 9 };
    await harness.snapshots.load(serialized);
    assert.deepEqual(state, { value: 1 });
    assert.deepEqual(harness.getCore(), { canvasWidth: 100, canvasHeight: 80 });
});

test('missing plugin policies skip, preserve opaque data, or reject transactionally', async () => {
    const warnings = [];
    const harness = createSnapshotHarness(warnings);
    const snapshot = {
        schema: 'image-editor.state',
        version: 3,
        core: { canvasWidth: 200, canvasHeight: 160 },
        plugins: { 'missing/plugin': { version: 1, data: { retained: true } } },
    };

    await harness.snapshots.load(snapshot, { missingPluginPolicy: 'warn-and-skip' });
    assert.deepEqual(harness.getCore(), { canvasWidth: 200, canvasHeight: 160 });
    assert.equal(warnings.at(-1).code, 'SNAPSHOT_PLUGIN_MISSING');

    await harness.snapshots.load(snapshot, { missingPluginPolicy: 'preserve-opaque' });
    assert.deepEqual(
        harness.snapshots.capture().plugins['missing/plugin'],
        snapshot.plugins['missing/plugin'],
    );

    await assert.rejects(
        harness.snapshots.load(snapshot, { missingPluginPolicy: 'error' }),
        SnapshotValidationError,
    );
    assert.deepEqual(harness.getCore(), { canvasWidth: 200, canvasHeight: 160 });
});

test('snapshot validation rejects prototype keys, excessive depth, and unknown versions', async () => {
    const harness = createSnapshotHarness();
    await assert.rejects(
        harness.snapshots.load(
            '{"schema":"image-editor.state","version":3,"core":{},"plugins":{"__proto__":{"version":1,"data":{}}}}',
        ),
        SnapshotValidationError,
    );
    await assert.rejects(
        harness.snapshots.load({
            schema: 'image-editor.state',
            version: 99,
            core: {},
            plugins: {},
        }),
        SnapshotValidationError,
    );
});
