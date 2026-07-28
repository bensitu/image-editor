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
    const empty = registry.listKeys();
    assert.strictEqual(registry.listKeys(), empty);
    assert.equal(Object.isFrozen(empty), true);

    const first = registry.register({ owner: 'example:mask', keys: ['maskId', 'maskName'] });
    const registered = registry.listKeys();
    assert.notStrictEqual(registered, empty);
    const second = registry.register({ owner: 'example:mask', keys: ['maskId'] });
    assert.strictEqual(registry.listKeys(), registered);
    assert.deepEqual(registered, ['maskId', 'maskName']);
    assert.throws(() => registered.push('externalMutation'), TypeError);
    assert.equal(registry.getOwner('maskId'), 'example:mask');
    assert.throws(
        () => registry.register({ owner: 'example:other', keys: ['maskId'] }),
        StateRegistrationError,
    );
    assert.throws(
        () => registry.register({ owner: 'example:mask', keys: ['__proto__'] }),
        StateRegistrationError,
    );
    await second.dispose();
    assert.strictEqual(registry.listKeys(), registered);
    await first.dispose();
    const released = registry.listKeys();
    assert.notStrictEqual(released, registered);
    assert.deepEqual(released, []);
});

test('state slice listings retain immutable identity until the registry changes', async () => {
    const registry = new StateSliceRegistry();
    const empty = registry.list();
    assert.strictEqual(registry.list(), empty);
    assert.equal(Object.isFrozen(empty), true);

    const definition = (id) => ({
        id,
        version: 1,
        capture: () => ({ id }),
        validate: (value) => ({ valid: true, value }),
        restore: () => undefined,
    });
    const firstRegistration = registry.register(definition('example:first'));
    const first = registry.list();
    assert.notStrictEqual(first, empty);
    assert.strictEqual(registry.list(), first);
    assert.throws(() => first.push(definition('example:external')), TypeError);

    const secondRegistration = registry.register(definition('example:second'));
    const second = registry.list();
    assert.notStrictEqual(second, first);
    assert.deepEqual(
        second.map((entry) => entry.id),
        ['example:first', 'example:second'],
    );
    assert.strictEqual(registry.list(), second);

    await firstRegistration.dispose();
    const afterDelete = registry.list();
    assert.notStrictEqual(afterDelete, second);
    assert.deepEqual(
        afterDelete.map((entry) => entry.id),
        ['example:second'],
    );
    await secondRegistration.dispose();
    assert.deepEqual(registry.list(), []);
});

test('transient predicate errors are isolated with owner-attributed warnings', () => {
    const warnings = [];
    const registry = new TransientObjectRegistry((warning) => warnings.push(warning));
    registry.register('example:failing', () => {
        throw new Error('predicate failure');
    });
    registry.register('example:preview', (object) => object.type === 'preview');
    assert.equal(registry.isTransient({ type: 'preview' }), true);
    assert.equal(registry.isTransient({ type: 'document' }), false);
    assert.equal(warnings.length, 2);
    assert.equal(warnings[0].details.owner, 'example:failing');
});

test('transient predicate snapshots survive self-unregistration for the active call', () => {
    const registry = new TransientObjectRegistry();
    const calls = [];
    let selfRegistration;
    selfRegistration = registry.register('example:self-removing', () => {
        calls.push('self-removing');
        selfRegistration.dispose();
        return false;
    });
    registry.register('example:remaining', () => {
        calls.push('remaining');
        return true;
    });

    assert.equal(registry.isTransient({}), true);
    assert.deepEqual(calls, ['self-removing', 'remaining']);

    calls.length = 0;
    assert.equal(registry.isTransient({}), true);
    assert.deepEqual(calls, ['remaining']);
    registry.dispose();
});

test('public snapshot round-trip validates slices and excludes configuration by contract', async () => {
    const harness = createSnapshotHarness();
    let state = { value: 1 };
    harness.slices.register({
        id: 'example:plugin',
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
        plugins: { 'missing:plugin': { version: 1, data: { retained: true } } },
    };

    await harness.snapshots.load(snapshot, { missingPluginPolicy: 'warn-and-skip' });
    assert.deepEqual(harness.getCore(), { canvasWidth: 200, canvasHeight: 160 });
    assert.equal(warnings.at(-1).code, 'SNAPSHOT_PLUGIN_MISSING');

    await harness.snapshots.load(snapshot, { missingPluginPolicy: 'preserve-opaque' });
    assert.deepEqual(
        harness.snapshots.capture().plugins['missing:plugin'],
        snapshot.plugins['missing:plugin'],
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
