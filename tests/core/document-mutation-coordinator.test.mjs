import assert from 'node:assert/strict';
import test from 'node:test';

import {
    DocumentMutationCoordinator,
    DocumentMutationError,
    DocumentMutationUnrecoverableError,
} from '../../src/core-runtime/mutation/index.js';
import { OperationRegistry } from '../../src/plugin-kernel/index.js';

function createHarness({ historyAvailable = true } = {}) {
    const calls = [];
    const events = [];
    const history = [];
    const registry = new OperationRegistry();
    let value = 0;
    let restoreFailure = null;
    let renderFailure = null;
    let captureFailureAt = null;
    let captureSequence = 0;
    const mementos = {
        capture() {
            calls.push('memento:capture');
            if (captureSequence + 1 === captureFailureAt) {
                throw new Error('memento capture failed');
            }
            return Object.freeze({
                revision: ++captureSequence,
                capturedAt: 1,
                core: Object.freeze({ value }),
                plugins: Object.freeze({}),
            });
        },
        async restore(memento) {
            calls.push('memento:restore');
            if (restoreFailure) throw restoreFailure;
            value = memento.core.value;
        },
        matches: (memento) => value === memento.core.value,
    };
    const coordinator = new DocumentMutationCoordinator({
        mementos,
        operations: {
            get: (operationId) => registry.get(operationId),
            has: (operationId) => registry.has(operationId),
            run: (operationId, task, options) =>
                registry.runForHost(operationId, null, (_value, context) => task(context), options),
        },
        state: {
            isDisposed: () => false,
            requestRender: () => {
                calls.push('render');
                if (renderFailure) {
                    const failure = renderFailure;
                    renderFailure = null;
                    throw failure;
                }
            },
        },
        history: {
            isAvailable: () => historyAvailable,
            commit: (record) => {
                calls.push('history');
                history.push(record);
            },
        },
        events: {
            emitCommitted: (descriptor) => {
                calls.push('event');
                events.push(descriptor);
            },
        },
    });

    function registerOperation(id, domains = ['document', 'state']) {
        registry.register(
            {
                id,
                mode: 'mutation',
                conflictDomains: domains,
                reentrancy: 'queue',
            },
            'core:host',
        );
    }

    return {
        calls,
        coordinator,
        events,
        history,
        mementos,
        registerOperation,
        registry,
        get value() {
            return value;
        },
        set value(next) {
            value = next;
        },
        failRestore(error) {
            restoreFailure = error;
        },
        failNextRender(error) {
            renderFailure = error;
        },
        failCaptureAt(sequence) {
            captureFailureAt = sequence;
        },
    };
}

function request(harness, overrides = {}) {
    return {
        id: 'test:transaction',
        kind: 'plugin-state',
        operationId: 'test:mutate',
        conflictDomains: ['document', 'state'],
        mutate: () => {
            harness.calls.push('mutate');
            harness.value = 1;
            return 'result';
        },
        ...overrides,
    };
}

test('successful mutation uses one Memento pair, one History record, and one event', async () => {
    const harness = createHarness();
    harness.registerOperation('test:mutate');
    const participant = {
        id: 'test:participant',
        order: 1,
        prepare: () => {
            harness.calls.push('prepare');
            return 'prepared';
        },
        apply: (result, prepared) => {
            harness.calls.push(`apply:${result}:${prepared}`);
        },
        synchronize: () => harness.calls.push('synchronize'),
        rollback: () => harness.calls.push('rollback'),
    };

    const result = await harness.coordinator.run(
        request(harness, {
            participants: [participant],
            validate: () => harness.calls.push('validate'),
        }),
    );

    assert.equal(result, 'result');
    assert.deepEqual(harness.calls, [
        'memento:capture',
        'prepare',
        'mutate',
        'apply:result:prepared',
        'synchronize',
        'render',
        'validate',
        'memento:capture',
        'history',
        'event',
    ]);
    assert.equal(harness.history.length, 1);
    assert.equal(harness.events.length, 1);
    assert.equal(harness.events[0].transactionId, 'test:transaction');
    assert.deepEqual(harness.events[0].diagnostics, [
        {
            transactionId: 'test:transaction',
            parentTransactionId: null,
            participantIds: ['test:participant'],
            metadata: {},
        },
    ]);
});

test('failures before and during mutate rollback prepared participants in reverse', async (t) => {
    for (const phase of ['prepare', 'mutate']) {
        await t.test(phase, async () => {
            const harness = createHarness();
            harness.registerOperation('test:mutate');
            const participants = [
                {
                    id: 'first',
                    order: 1,
                    prepare: () => {
                        harness.calls.push('prepare:first');
                        return 'first';
                    },
                    rollback: () => harness.calls.push('rollback:first'),
                },
                {
                    id: 'second',
                    order: 2,
                    prepare: () => {
                        harness.calls.push('prepare:second');
                        if (phase === 'prepare') throw new Error('prepare failed');
                        return 'second';
                    },
                    rollback: () => harness.calls.push('rollback:second'),
                },
            ];
            await assert.rejects(
                harness.coordinator.run(
                    request(harness, {
                        participants,
                        mutate: () => {
                            harness.value = 9;
                            throw new Error('mutate failed');
                        },
                    }),
                ),
                DocumentMutationError,
            );
            assert.equal(harness.value, 0);
            assert.equal(harness.history.length, 0);
            assert.equal(harness.events.length, 0);
            assert.deepEqual(
                harness.calls.filter((call) => call.startsWith('rollback:')),
                phase === 'prepare' ? ['rollback:first'] : ['rollback:second', 'rollback:first'],
            );
        });
    }
});

test('synchronize, render, and invariant failures restore the before state', async (t) => {
    for (const phase of ['synchronize', 'render', 'validate']) {
        await t.test(phase, async () => {
            const harness = createHarness();
            harness.registerOperation('test:mutate');
            if (phase === 'render') harness.failNextRender(new Error('render failed'));
            await assert.rejects(
                harness.coordinator.run(
                    request(harness, {
                        synchronize:
                            phase === 'synchronize'
                                ? () => {
                                      throw new Error('synchronize failed');
                                  }
                                : undefined,
                        validate:
                            phase === 'validate'
                                ? () => {
                                      throw new Error('validation failed');
                                  }
                                : undefined,
                    }),
                ),
                DocumentMutationError,
            );
            assert.equal(harness.value, 0);
            assert.equal(harness.history.length, 0);
            assert.equal(harness.events.length, 0);
            assert.ok(harness.calls.includes('memento:restore'));
        });
    }
});

test('failure to capture the after Memento restores the before state', async () => {
    const harness = createHarness();
    harness.registerOperation('test:mutate');
    harness.failCaptureAt(2);

    await assert.rejects(harness.coordinator.run(request(harness)), DocumentMutationError);

    assert.equal(harness.value, 0);
    assert.equal(harness.history.length, 0);
    assert.equal(harness.events.length, 0);
    assert.ok(harness.calls.includes('memento:restore'));
});

test('targeted rollback is accepted only when it matches the before Memento', async (t) => {
    await t.test('matching rollback', async () => {
        const harness = createHarness();
        harness.registerOperation('test:mutate');
        await assert.rejects(
            harness.coordinator.run(
                request(harness, {
                    mutate: () => {
                        harness.value = 7;
                        throw new Error('failure after mutation');
                    },
                    rollback: () => {
                        harness.calls.push('targeted');
                        harness.value = 0;
                    },
                }),
            ),
            DocumentMutationError,
        );
        assert.equal(harness.calls.includes('memento:restore'), false);
    });

    await t.test('rollback failure', async () => {
        const harness = createHarness();
        harness.registerOperation('test:mutate');
        await assert.rejects(
            harness.coordinator.run(
                request(harness, {
                    mutate: () => {
                        harness.value = 7;
                        throw new Error('failure after mutation');
                    },
                    rollback: () => {
                        throw new Error('targeted rollback failed');
                    },
                }),
            ),
            DocumentMutationError,
        );
        assert.equal(harness.value, 0);
        assert.ok(harness.calls.includes('memento:restore'));
    });
});

test('Memento restore failure escalates to an unrecoverable mutation error', async () => {
    const harness = createHarness();
    harness.registerOperation('test:mutate');
    harness.failRestore(new Error('restore failed'));

    await assert.rejects(
        harness.coordinator.run(
            request(harness, {
                mutate: () => {
                    harness.value = 4;
                    throw new Error('mutation failed');
                },
            }),
        ),
        DocumentMutationUnrecoverableError,
    );
    assert.equal(harness.history.length, 0);
    assert.equal(harness.events.length, 0);
});

test('nested and compound mutations share one top-level commit authority', async () => {
    const harness = createHarness();
    harness.registerOperation('test:parent');
    harness.registerOperation('test:child');
    const contexts = [];

    const result = await harness.coordinator.run(
        request(harness, {
            id: 'test:parent-transaction',
            kind: 'compound',
            operationId: 'test:parent',
            mutate: async (parent) => {
                contexts.push(parent);
                harness.value = 1;
                const childResult = await harness.coordinator.run(
                    request(harness, {
                        id: 'test:child-transaction',
                        operationId: 'test:child',
                        parent,
                        mutate: (child) => {
                            contexts.push(child);
                            harness.value += 2;
                            return 'child';
                        },
                    }),
                );
                return `parent:${childResult}`;
            },
        }),
    );

    assert.equal(result, 'parent:child');
    assert.equal(harness.value, 3);
    assert.equal(harness.calls.filter((call) => call === 'memento:capture').length, 2);
    assert.equal(harness.history.length, 1);
    assert.equal(harness.events.length, 1);
    assert.deepEqual(
        contexts.map(({ transactionId, parentTransactionId, historyOwner, eventOwner }) => ({
            transactionId,
            parentTransactionId,
            historyOwner,
            eventOwner,
        })),
        [
            {
                transactionId: 'test:parent-transaction',
                parentTransactionId: null,
                historyOwner: 'self',
                eventOwner: 'self',
            },
            {
                transactionId: 'test:child-transaction',
                parentTransactionId: 'test:parent-transaction',
                historyOwner: 'parent',
                eventOwner: 'parent',
            },
        ],
    );
    assert.equal(harness.events[0].diagnostics.length, 2);
});

test('a child failure rolls back the compound transaction even when the parent catches it', async () => {
    const harness = createHarness();
    harness.registerOperation('test:parent');
    harness.registerOperation('test:child');

    await assert.rejects(
        harness.coordinator.run(
            request(harness, {
                id: 'test:parent-transaction',
                operationId: 'test:parent',
                mutate: async (parent) => {
                    harness.value = 1;
                    try {
                        await harness.coordinator.run(
                            request(harness, {
                                id: 'test:child-transaction',
                                operationId: 'test:child',
                                parent,
                                mutate: () => {
                                    harness.value = 8;
                                    throw new Error('child failed');
                                },
                            }),
                        );
                    } catch {
                        // A failed child permanently invalidates its top-level transaction.
                    }
                    return 'must-not-commit';
                },
            }),
        ),
        DocumentMutationError,
    );
    assert.equal(harness.value, 0);
    assert.equal(harness.history.length, 0);
    assert.equal(harness.events.length, 0);
});

test('History absence does not weaken rollback or committed observation', async () => {
    const harness = createHarness({ historyAvailable: false });
    harness.registerOperation('test:mutate');
    await harness.coordinator.run(request(harness));
    assert.equal(harness.history.length, 0);
    assert.equal(harness.events.length, 1);

    await assert.rejects(
        harness.coordinator.run(
            request(harness, {
                id: 'test:failed-without-history',
                mutate: () => {
                    harness.value = 10;
                    throw new Error('failure');
                },
            }),
        ),
        DocumentMutationError,
    );
    assert.equal(harness.value, 1);
    assert.equal(harness.events.length, 1);
});
