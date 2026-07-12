import assert from 'node:assert/strict';
import test from 'node:test';

import {
    GeometryRecoverableObjectError,
    GeometryUnrecoverableError,
} from '../../src/core-runtime/errors.js';
import {
    GeometryMutationCoordinator,
    IDENTITY_AFFINE_MATRIX,
} from '../../src/core-runtime/geometry/index.js';

function createHarness({ historyAvailable = true, eventFailure = false } = {}) {
    const calls = [];
    let value = 1;
    let revision = 1;
    let restores = 0;
    const history = [];
    const events = [];
    const warnings = [];
    const coordinator = new GeometryMutationCoordinator({
        mementos: {
            capture: () => ({ value, revision }),
            restore: async (memento) => {
                calls.push('memento:restore');
                restores += 1;
                value = memento.value;
                revision = memento.revision;
            },
            matches: (memento) => value === memento.value && revision === memento.revision,
        },
        operations: {
            has: (id) => id === 'test:operation',
            acquire: () => ({ dispose: () => calls.push('operation:release') }),
        },
        state: {
            captureGeometry: () => ({
                matrix: IDENTITY_AFFINE_MATRIX,
                boundingBox: { left: 0, top: 0, width: 10, height: 10 },
                canvasWidth: 10,
                canvasHeight: 10,
                revision,
            }),
            finalizeGeometry: () => calls.push('finalize'),
            requestRender: () => calls.push('render'),
            isDisposed: () => false,
        },
        history: {
            isAvailable: () => historyAvailable,
            commit: (record) => history.push(record),
        },
        events: {
            emitCommitted: async (_name, descriptor) => {
                if (eventFailure) throw new Error('listener failure');
                events.push(descriptor);
            },
        },
        warningSink: (warning) => warnings.push(warning),
    });
    return {
        coordinator,
        calls,
        history,
        events,
        warnings,
        getValue: () => value,
        setValue: (next) => {
            value = next;
        },
        getRevision: () => revision,
        setRevision: (next) => {
            revision = next;
        },
        getRestores: () => restores,
    };
}

let mutationSequence = 0;

function mutation(harness, overrides = {}) {
    return {
        id: overrides.id ?? `mutation-${++mutationSequence}`,
        kind: 'transform',
        operationId: 'test:operation',
        mutateBase:
            overrides.mutateBase ??
            (() => {
                harness.calls.push('mutate');
                harness.setValue(2);
                harness.setRevision(2);
            }),
        rollbackBase: overrides.rollbackBase,
    };
}

test('mutateBase failure skips apply/synchronize, restores memento, and writes no commit artifacts', async () => {
    const harness = createHarness();
    harness.coordinator.registerParticipant({
        id: 'participant',
        order: 0,
        supports: () => true,
        prepare: () => harness.calls.push('prepare'),
        apply: () => harness.calls.push('apply'),
        synchronize: () => harness.calls.push('sync'),
    });
    await assert.rejects(
        harness.coordinator.run(
            mutation(harness, {
                mutateBase: () => {
                    harness.calls.push('mutate');
                    harness.setValue(99);
                    throw new Error('base failure');
                },
            }),
        ),
        /base failure/,
    );
    assert.equal(harness.calls.includes('apply'), false);
    assert.equal(harness.calls.includes('sync'), false);
    assert.equal(harness.getValue(), 1);
    assert.equal(harness.getRestores(), 1);
    assert.equal(harness.history.length, 0);
    assert.equal(harness.events.length, 0);
});

test('fatal participant failure rolls applied participants back in reverse order', async () => {
    const harness = createHarness();
    for (const id of ['first', 'second', 'fatal']) {
        harness.coordinator.registerParticipant({
            id,
            order: 0,
            supports: () => true,
            prepare: () => id,
            apply: () => {
                harness.calls.push(`apply:${id}`);
                if (id === 'fatal') throw new Error('participant failure');
            },
            rollback: () => harness.calls.push(`rollback:${id}`),
        });
    }
    await assert.rejects(harness.coordinator.run(mutation(harness)), /participant failure/);
    assert.deepEqual(
        harness.calls.filter((entry) => entry.startsWith('rollback:')),
        ['rollback:fatal', 'rollback:second', 'rollback:first'],
    );
    assert.equal(harness.getValue(), 1);
    assert.equal(harness.history.length, 0);
});

test('targeted rollback avoids memento fallback only when the state matches', async () => {
    const harness = createHarness();
    harness.coordinator.registerParticipant({
        id: 'fatal',
        order: 0,
        supports: () => true,
        apply: () => {
            throw new Error('fatal');
        },
    });
    await assert.rejects(
        harness.coordinator.run(
            mutation(harness, {
                rollbackBase: () => {
                    harness.calls.push('targeted');
                    harness.setValue(1);
                    harness.setRevision(1);
                },
            }),
        ),
    );
    assert.equal(harness.getRestores(), 0);

    const second = createHarness();
    second.coordinator.registerParticipant({
        id: 'fatal',
        order: 0,
        supports: () => true,
        apply: () => {
            throw new Error('fatal');
        },
    });
    await assert.rejects(
        second.coordinator.run(
            mutation(second, {
                rollbackBase: () => {
                    second.setValue(1);
                    // Revision mismatch deliberately forces the trusted memento fallback.
                },
            }),
        ),
    );
    assert.equal(second.getRestores(), 1);
});

test('recoverable object failure warns and allows the transaction to commit', async () => {
    const harness = createHarness();
    harness.coordinator.registerParticipant({
        id: 'overlay',
        order: 0,
        supports: () => true,
        apply: () => {
            throw new GeometryRecoverableObjectError('bad matrix', 'overlay-7', 'custom');
        },
    });
    await harness.coordinator.run(mutation(harness));
    assert.equal(harness.warnings.length, 1);
    assert.equal(harness.warnings[0].objectIdentity, 'overlay-7');
    assert.equal(harness.history.length, 1);
    assert.equal(harness.events.length, 1);
    assert.equal(harness.getValue(), 2);
});

test('committed observer failure is isolated and never rolls back committed state', async () => {
    const harness = createHarness({ eventFailure: true });
    await harness.coordinator.run(mutation(harness));
    assert.equal(harness.getValue(), 2);
    assert.equal(harness.history.length, 1);
    assert.equal(harness.getRestores(), 0);
    assert.equal(harness.warnings[0].code, 'COMMITTED_EVENT_LISTENER_FAILED');
});

test('no-history failure still restores state and produces zero event', async () => {
    const harness = createHarness({ historyAvailable: false });
    await assert.rejects(
        harness.coordinator.run(
            mutation(harness, {
                mutateBase: () => {
                    harness.setValue(50);
                    throw new Error('failed');
                },
            }),
        ),
    );
    assert.equal(harness.getValue(), 1);
    assert.equal(harness.history.length, 0);
    assert.equal(harness.events.length, 0);
});

test('memento restore failure escalates to an explicit unrecoverable error', async () => {
    let revision = 1;
    const coordinator = new GeometryMutationCoordinator({
        mementos: {
            capture: () => ({ revision }),
            restore: async () => {
                throw new Error('restore failed');
            },
        },
        operations: {
            has: () => true,
            acquire: () => ({ dispose: () => undefined }),
        },
        state: {
            captureGeometry: () => ({
                matrix: IDENTITY_AFFINE_MATRIX,
                boundingBox: { left: 0, top: 0, width: 1, height: 1 },
                canvasWidth: 1,
                canvasHeight: 1,
                revision,
            }),
            finalizeGeometry: () => undefined,
            requestRender: () => undefined,
            isDisposed: () => false,
        },
        history: { isAvailable: () => false, commit: () => undefined },
        events: { emitCommitted: async () => undefined },
    });
    await assert.rejects(
        coordinator.run({
            id: 'unrecoverable',
            kind: 'transform',
            operationId: 'test:operation',
            mutateBase: () => {
                revision = 2;
                throw new Error('mutation failed');
            },
        }),
        GeometryUnrecoverableError,
    );
});

test('operation token is released when initial memento capture fails', async () => {
    let releases = 0;
    const coordinator = new GeometryMutationCoordinator({
        mementos: {
            capture: () => {
                throw new Error('capture failed');
            },
            restore: async () => undefined,
        },
        operations: {
            has: () => true,
            acquire: () => ({
                dispose: () => {
                    releases += 1;
                },
            }),
        },
        state: {
            captureGeometry: () => {
                throw new Error('should not run');
            },
            finalizeGeometry: () => undefined,
            requestRender: () => undefined,
            isDisposed: () => false,
        },
        history: { isAvailable: () => false, commit: () => undefined },
        events: { emitCommitted: async () => undefined },
    });
    await assert.rejects(
        coordinator.run({
            id: 'capture-failure',
            kind: 'transform',
            operationId: 'test:operation',
            mutateBase: () => undefined,
        }),
        /capture failed/,
    );
    assert.equal(releases, 1);
});
