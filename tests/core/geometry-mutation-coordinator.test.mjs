import assert from 'node:assert/strict';
import test from 'node:test';

import {
    GeometryMutationCoordinator,
    IDENTITY_AFFINE_MATRIX,
} from '../../src/core-runtime/geometry/index.js';

function geometry(revision, matrix = IDENTITY_AFFINE_MATRIX) {
    return {
        matrix,
        boundingBox: { left: 0, top: 0, width: 100, height: 80 },
        canvasWidth: 100,
        canvasHeight: 80,
        revision,
    };
}

function createHarness({ historyAvailable = true, onRender = () => undefined } = {}) {
    const calls = [];
    let currentGeometry = geometry(1);
    let stateValue = 1;
    let active = false;
    let disposed = false;
    const history = [];
    const events = [];
    const warnings = [];
    const errors = [];
    let restores = 0;
    const options = {
        mementos: {
            capture: () => ({ stateValue, currentGeometry }),
            restore: async (memento) => {
                calls.push('memento:restore');
                restores += 1;
                stateValue = memento.stateValue;
                currentGeometry = memento.currentGeometry;
            },
            matches: (memento) =>
                stateValue === memento.stateValue &&
                currentGeometry.revision === memento.currentGeometry.revision,
        },
        operations: {
            has: (id) => id === 'test:mutate',
            acquire: (id) => {
                assert.equal(active, false);
                active = true;
                calls.push(`operation:acquire:${id}`);
                return {
                    dispose: () => {
                        active = false;
                        calls.push(`operation:release:${id}`);
                    },
                };
            },
        },
        state: {
            captureGeometry: () => currentGeometry,
            finalizeGeometry: () => calls.push('geometry:finalize'),
            requestRender: () => {
                onRender();
                calls.push('render');
            },
            isDisposed: () => disposed,
        },
        history: {
            isAvailable: () => historyAvailable,
            commit: (record) => {
                calls.push('history:commit');
                history.push(record);
            },
        },
        events: {
            emitCommitted: async (name, descriptor) => {
                calls.push(`event:${name}`);
                events.push(descriptor);
            },
        },
        warningSink: (warning) => warnings.push(warning),
        errorSink: (error) => errors.push(error),
    };
    const coordinator = new GeometryMutationCoordinator(options);
    return {
        coordinator,
        calls,
        history,
        events,
        warnings,
        errors,
        getRestores: () => restores,
        getState: () => stateValue,
        setState: (value) => {
            stateValue = value;
        },
        getGeometry: () => currentGeometry,
        setGeometry: (next) => {
            currentGeometry = next;
        },
        setDisposed: (value) => {
            disposed = value;
        },
    };
}

function request(harness, overrides = {}) {
    return {
        id: overrides.id ?? 'mutation-1',
        kind: overrides.kind ?? 'transform',
        operationId: 'test:mutate',
        mutateBase:
            overrides.mutateBase ??
            (() => {
                harness.calls.push('mutate');
                harness.setState(2);
                harness.setGeometry(geometry(2, [2, 0, 0, 2, 10, 20]));
            }),
        rollbackBase: overrides.rollbackBase,
        metadata: overrides.metadata,
    };
}

test('coordinator executes deterministic prepare, mutate, apply, synchronize, history, event order', async () => {
    const harness = createHarness();
    for (const [id, order] of [
        ['late', 20],
        ['first', 10],
        ['second', 10],
    ]) {
        harness.coordinator.registerParticipant({
            id,
            order,
            supports: () => true,
            prepare: () => {
                harness.calls.push(`prepare:${id}`);
                return `${id}:prepared`;
            },
            apply: (_descriptor, prepared) => {
                harness.calls.push(`apply:${prepared}`);
            },
            synchronize: () => harness.calls.push(`sync:${id}`),
        });
    }

    const descriptor = await harness.coordinator.run(request(harness));
    assert.deepEqual(harness.calls, [
        'operation:acquire:test:mutate',
        'prepare:first',
        'prepare:second',
        'prepare:late',
        'mutate',
        'geometry:finalize',
        'apply:first:prepared',
        'apply:second:prepared',
        'apply:late:prepared',
        'sync:first',
        'sync:second',
        'sync:late',
        'render',
        'history:commit',
        'event:geometry:committed',
        'operation:release:test:mutate',
    ]);
    assert.deepEqual(descriptor.affineDelta, [2, 0, 0, 2, 10, 20]);
    assert.equal(harness.history.length, 1);
    assert.equal(harness.events.length, 1);
    assert.equal(harness.getRestores(), 0);
});

test('participant snapshot stays stable while registrations change during a mutation', async () => {
    const harness = createHarness();
    let disposeSecond;
    harness.coordinator.registerParticipant({
        id: 'first',
        order: 0,
        supports: () => true,
        prepare: async () => {
            harness.calls.push('prepare:first');
            await disposeSecond.dispose();
            harness.coordinator.registerParticipant({
                id: 'third',
                order: 0,
                supports: () => true,
                apply: () => harness.calls.push('apply:third'),
            });
        },
        apply: () => harness.calls.push('apply:first'),
    });
    disposeSecond = harness.coordinator.registerParticipant({
        id: 'second',
        order: 1,
        supports: () => true,
        apply: () => harness.calls.push('apply:second'),
    });

    await harness.coordinator.run(request(harness));
    assert.equal(harness.calls.includes('apply:second'), true);
    assert.equal(harness.calls.includes('apply:third'), false);
});

test('no-history mode still commits atomically and emits one committed event', async () => {
    const harness = createHarness({ historyAvailable: false });
    await harness.coordinator.run(request(harness));
    assert.equal(harness.history.length, 0);
    assert.equal(harness.events.length, 1);
    assert.equal(harness.getState(), 2);
});

test('reentrant and duplicate mutation IDs are rejected', async () => {
    const harness = createHarness();
    let release;
    const pending = harness.coordinator.run(
        request(harness, {
            mutateBase: () =>
                new Promise((resolve) => {
                    release = () => {
                        harness.setState(2);
                        harness.setGeometry(geometry(2));
                        resolve();
                    };
                }),
        }),
    );
    await assert.rejects(
        harness.coordinator.run(request(harness, { id: 'mutation-2' })),
        /another geometry mutation is active/,
    );
    release();
    await pending;
    await assert.rejects(harness.coordinator.run(request(harness)), /already been used/);
});

test('dispose aborts an active mutation and waits for rollback before the host releases canvas state', async () => {
    let hostCanvasDisposed = false;
    const harness = createHarness({
        onRender: () => assert.equal(hostCanvasDisposed, false),
    });
    const pending = harness.coordinator.run(
        request(harness, {
            id: 'dispose-active',
            mutateBase: ({ signal }) =>
                new Promise((_resolve, reject) => {
                    signal.addEventListener(
                        'abort',
                        () => reject(signal.reason ?? new Error('aborted')),
                        { once: true },
                    );
                }),
        }),
    );
    const observedFailure = pending.catch((error) => error);
    await harness.coordinator.dispose();
    assert.equal(hostCanvasDisposed, false);
    hostCanvasDisposed = true;
    assert.equal((await observedFailure) instanceof Error, true);
    assert.equal(harness.getRestores(), 1);
    assert.equal(harness.calls.at(-1), 'operation:release:test:mutate');
});
