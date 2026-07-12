import assert from 'node:assert/strict';
import test from 'node:test';

import {
    MementoCaptureError,
    MementoRestoreError,
    StateRegistrationError,
} from '../../src/core-runtime/errors.js';
import { MementoService, StateSliceRegistry } from '../../src/core-runtime/state/index.js';

function valid(value) {
    return { valid: true, value };
}

function createHarness() {
    let core = { value: 1 };
    const registry = new StateSliceRegistry();
    const adapter = {
        capture: () => core,
        restore: (next) => {
            core = { ...next };
        },
        validateSnapshot: (value) => valid(value),
    };
    const service = new MementoService(adapter, registry);
    return {
        registry,
        service,
        getCore: () => core,
        setCore: (next) => {
            core = next;
        },
    };
}

test('MementoService captures empty/core-only state without retaining aliases', async () => {
    const harness = createHarness();
    const source = { value: 2, nested: { enabled: true } };
    harness.setCore(source);
    const memento = harness.service.capture();

    source.nested.enabled = false;
    harness.setCore({ value: 99 });
    await harness.service.restore(memento);

    assert.deepEqual(harness.getCore(), { value: 2, nested: { enabled: true } });
    assert.equal(Object.isFrozen(memento), true);
    assert.equal(Object.isFrozen(memento.core), true);
    assert.deepEqual(Object.keys(memento.plugins), []);
});

test('state slices capture and restore in deterministic registration order', async () => {
    const harness = createHarness();
    const calls = [];
    let first = { count: 1 };
    let second = { count: 2 };
    harness.registry.register({
        id: 'example/first',
        version: 1,
        capture: () => {
            calls.push('capture:first');
            return first;
        },
        validate: (value) => valid(value),
        restore: (value) => {
            calls.push('restore:first');
            first = value;
        },
    });
    harness.registry.register({
        id: 'example/second',
        version: 2,
        capture: () => {
            calls.push('capture:second');
            return second;
        },
        validate: (value) => valid(value),
        restore: (value) => {
            calls.push('restore:second');
            second = value;
        },
    });

    const memento = harness.service.capture();
    first = { count: 10 };
    second = { count: 20 };
    calls.length = 0;
    await harness.service.restore(memento);

    assert.deepEqual(calls, ['capture:first', 'capture:second', 'restore:first', 'restore:second']);
    assert.deepEqual(first, { count: 1 });
    assert.deepEqual(second, { count: 2 });
});

test('duplicate slices and invalid versions fail before registration mutates state', () => {
    const harness = createHarness();
    const definition = {
        id: 'example/state',
        version: 1,
        capture: () => ({}),
        validate: (value) => valid(value),
        restore: () => undefined,
    };
    harness.registry.register(definition);
    assert.throws(() => harness.registry.register(definition), StateRegistrationError);
    assert.throws(
        () => harness.registry.register({ ...definition, id: 'example/invalid', version: 0 }),
        StateRegistrationError,
    );
    assert.equal(harness.registry.list().length, 1);
});

test('slice capture failures identify the owning slice and return no partial memento', () => {
    const harness = createHarness();
    harness.registry.register({
        id: 'example/failing-capture',
        version: 1,
        capture: () => {
            throw new Error('capture failed');
        },
        validate: (value) => valid(value),
        restore: () => undefined,
    });
    assert.throws(
        () => harness.service.capture(),
        (error) =>
            error instanceof MementoCaptureError && error.sliceId === 'example/failing-capture',
    );
});

test('partial restore failure rolls core and earlier slices back to the pre-load state', async () => {
    const harness = createHarness();
    let first = 1;
    let second = 2;
    let shouldFail = false;
    harness.registry.register({
        id: 'example/first',
        version: 1,
        capture: () => first,
        validate: (value) => valid(value),
        restore: (value) => {
            first = value;
        },
    });
    harness.registry.register({
        id: 'example/second',
        version: 1,
        capture: () => second,
        validate: (value) => valid(value),
        restore: (value, context) => {
            if (shouldFail && context.mode !== 'rollback') throw new Error('slice failure');
            second = value;
        },
    });
    const target = harness.service.capture();
    harness.setCore({ value: 90 });
    first = 91;
    second = 92;
    shouldFail = true;

    await assert.rejects(harness.service.restore(target), (error) => {
        assert.equal(error instanceof MementoRestoreError, true);
        assert.equal(error.sliceId, 'example/second');
        return true;
    });
    assert.deepEqual(harness.getCore(), { value: 90 });
    assert.equal(first, 91);
    assert.equal(second, 92);
});

test('trusted restore exposes the internal mode and disposal blocks later access', async () => {
    const harness = createHarness();
    harness.registry.register({
        id: 'example/no-ui',
        version: 1,
        capture: () => ({ value: 1 }),
        validate: (value) => valid(value),
        restore: (_value, context) => {
            assert.equal(context.mode, 'trusted-memento');
        },
    });
    const memento = harness.service.capture();
    await harness.service.restore(memento);
    harness.service.dispose();
    assert.throws(() => harness.service.capture(), StateRegistrationError);
});

test('restore abort and rollback failure are surfaced instead of swallowed', async () => {
    const harness = createHarness();
    let state = 1;
    let failRollback = false;
    harness.registry.register({
        id: 'example/abort',
        version: 1,
        capture: () => state,
        validate: (value) => valid(value),
        restore: (value, context) => {
            if (context.mode === 'rollback' && failRollback) throw new Error('rollback failed');
            state = value;
            if (context.mode !== 'rollback') throw new Error('restore failed');
        },
    });
    const target = harness.service.capture();
    state = 5;
    failRollback = true;
    await assert.rejects(harness.service.restore(target), (error) => {
        assert.equal(error instanceof MementoRestoreError, true);
        assert.equal(error.rollbackErrors.length, 1);
        return true;
    });

    const second = createHarness();
    const controller = new AbortController();
    controller.abort(new Error('cancelled'));
    await assert.rejects(
        second.service.restore(second.service.capture(), { signal: controller.signal }),
    );
});
