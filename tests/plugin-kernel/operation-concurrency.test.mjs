import assert from 'node:assert/strict';
import test from 'node:test';

import { OperationConflictError, OperationRegistry } from '../../src/plugin-kernel/index.js';

function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
    });
    return { promise, reject, resolve };
}

function definition(id, overrides = {}) {
    return {
        id,
        mode: 'mutation',
        conflictDomains: ['document'],
        reentrancy: 'reject',
        ...overrides,
    };
}

test('reject policy and conflict domains prevent contradictory mutations', async () => {
    const registry = new OperationRegistry();
    registry.register(definition('test:first'), 'plugin:first');
    registry.register(definition('test:second'), 'plugin:second');
    registry.register(
        definition('test:independent', { conflictDomains: ['overlay'] }),
        'plugin:third',
    );
    const gate = deferred();
    const first = registry.run('test:first', 'plugin:first', null, () => gate.promise);

    await assert.rejects(
        registry.run('test:second', 'plugin:second', null, async () => undefined),
        OperationConflictError,
    );
    await registry.run('test:independent', 'plugin:third', null, async () => undefined);
    gate.resolve();
    await first;
    registry.dispose();
});

test('queue policy preserves deterministic start and settlement order', async () => {
    const registry = new OperationRegistry();
    registry.register(definition('test:queue', { reentrancy: 'queue' }), 'plugin:owner');
    const firstGate = deferred();
    const calls = [];
    const first = registry.run('test:queue', 'plugin:owner', 1, async (value) => {
        calls.push(`start:${value}`);
        await firstGate.promise;
        calls.push(`end:${value}`);
        return value;
    });
    const second = registry.run('test:queue', 'plugin:owner', 2, async (value) => {
        calls.push(`start:${value}`);
        calls.push(`end:${value}`);
        return value;
    });

    await Promise.resolve();
    assert.deepEqual(calls, ['start:1']);
    firstGate.resolve();
    assert.deepEqual(await Promise.all([first, second]), [1, 2]);
    assert.deepEqual(calls, ['start:1', 'end:1', 'start:2', 'end:2']);
    registry.dispose();
});

test('coalesce policy combines pending arguments and settles every caller', async () => {
    const registry = new OperationRegistry();
    registry.register(
        definition('test:coalesce', {
            reentrancy: 'coalesce',
            coalesce: (previous, next) => previous + next,
        }),
        'plugin:owner',
    );
    const firstGate = deferred();
    const values = [];
    const first = registry.run('test:coalesce', 'plugin:owner', 1, async (value) => {
        values.push(value);
        await firstGate.promise;
        return value;
    });
    await Promise.resolve();
    const second = registry.run('test:coalesce', 'plugin:owner', 2, async (value) => {
        values.push(value);
        return value;
    });
    const third = registry.run('test:coalesce', 'plugin:owner', 3, async () => {
        throw new Error('the coalesced request must keep one executor');
    });

    firstGate.resolve();
    assert.deepEqual(await Promise.all([first, second, third]), [1, 5, 5]);
    assert.deepEqual(values, [1, 5]);
    registry.dispose();
});

test('a coalesced caller can cancel its own waiter without cancelling the shared request', async () => {
    const registry = new OperationRegistry();
    registry.register(
        definition('test:coalesce-cancel', {
            reentrancy: 'coalesce',
            coalesce: (previous, next) => previous + next,
        }),
        'plugin:owner',
    );
    const activeGate = deferred();
    const active = registry.run(
        'test:coalesce-cancel',
        'plugin:owner',
        1,
        () => activeGate.promise,
    );
    await Promise.resolve();

    const pending = registry.run('test:coalesce-cancel', 'plugin:owner', 2, async (value) => value);
    const controller = new AbortController();
    const cancelled = registry.run(
        'test:coalesce-cancel',
        'plugin:owner',
        3,
        async () => {
            throw new Error('A coalesced request must retain its first executor.');
        },
        { signal: controller.signal },
    );
    controller.abort(new DOMException('Caller no longer needs the result.', 'AbortError'));

    await assert.rejects(cancelled, (error) => error?.name === 'AbortError');
    activeGate.resolve(1);
    assert.equal(await active, 1);
    assert.equal(await pending, 5);
    registry.dispose();
});

test('replace policy retires the active authority and suppresses its late result', async () => {
    const registry = new OperationRegistry();
    registry.register(definition('test:replace', { reentrancy: 'replace' }), 'plugin:owner');
    const firstGate = deferred();
    let firstSignal;
    let secondStarted = false;
    const first = registry.run('test:replace', 'plugin:owner', 'first', async (_, context) => {
        firstSignal = context.signal;
        await firstGate.promise;
        return 'late-first';
    });
    await Promise.resolve();
    const second = registry.run('test:replace', 'plugin:owner', 'second', async () => {
        secondStarted = true;
        return 'second';
    });

    assert.equal(firstSignal.aborted, true);
    assert.equal(await second, 'second');
    assert.equal(secondStarted, true);
    firstGate.resolve();
    await assert.rejects(first, (error) => error?.name === 'AbortError');
    registry.dispose();
});

test('read operations sharing a domain remain compatible', async () => {
    const registry = new OperationRegistry();
    registry.register(
        definition('test:read-one', { mode: 'read', conflictDomains: ['state'] }),
        'plugin:one',
    );
    registry.register(
        definition('test:read-two', { mode: 'read', conflictDomains: ['state'] }),
        'plugin:two',
    );
    const gate = deferred();
    const first = registry.run('test:read-one', 'plugin:one', null, () => gate.promise);
    await registry.run('test:read-two', 'plugin:two', null, async () => undefined);
    gate.resolve();
    await first;
    registry.dispose();
});

test('nested child operations inherit top-level ownership without a second history owner', async () => {
    const registry = new OperationRegistry();
    registry.register(definition('test:parent', { reentrancy: 'queue' }), 'plugin:parent');
    registry.register(definition('test:child', { reentrancy: 'queue' }), 'plugin:child');
    const observations = [];

    await registry.run('test:parent', 'plugin:parent', null, async (_, parentContext) => {
        observations.push({
            id: parentContext.token.id,
            ownsHistory: parentContext.ownsHistory,
            topLevel: parentContext.topLevel,
        });
        await registry.run(
            'test:child',
            'plugin:child',
            null,
            async (_, childContext) => {
                observations.push({
                    id: childContext.token.id,
                    ownsHistory: childContext.ownsHistory,
                    parentId: childContext.token.parentId,
                    topLevel: childContext.topLevel,
                });
            },
            { parent: parentContext.token },
        );
    });

    assert.deepEqual(observations, [
        { id: 'test:parent', ownsHistory: true, topLevel: true },
        {
            id: 'test:child',
            ownsHistory: false,
            parentId: 'test:parent',
            topLevel: false,
        },
    ]);
    registry.dispose();
});

test('cancellation holds the conflict authority until cleanup settles', async () => {
    const registry = new OperationRegistry();
    registry.register(definition('test:cancel', { reentrancy: 'queue' }), 'plugin:owner');
    const controller = new AbortController();
    const cleanupGate = deferred();
    const calls = [];
    const first = registry.run(
        'test:cancel',
        'plugin:owner',
        'first',
        async (value) => {
            calls.push(`start:${value}`);
            await cleanupGate.promise;
            calls.push(`cleanup:${value}`);
        },
        { signal: controller.signal },
    );
    void first.catch(() => undefined);
    let firstSettled = false;
    void first
        .finally(() => {
            firstSettled = true;
        })
        .catch(() => undefined);
    const second = registry.run('test:cancel', 'plugin:owner', 'second', async (value) => {
        calls.push(`start:${value}`);
    });

    controller.abort(new DOMException('Cancel the first operation.', 'AbortError'));
    await Promise.resolve();
    assert.deepEqual(calls, ['start:first']);
    assert.equal(firstSettled, false);
    cleanupGate.resolve();
    await assert.rejects(first, (error) => error?.name === 'AbortError');
    await second;
    await registry.waitForIdle();
    assert.deepEqual(calls, ['start:first', 'cleanup:first', 'start:second']);
    registry.dispose();
});

test('suspension aborts active work and rejects all future operations', async () => {
    const registry = new OperationRegistry();
    registry.register(definition('test:suspend', { reentrancy: 'queue' }), 'plugin:owner');
    const reason = new Error('Core is faulted.');
    const running = registry.run('test:suspend', 'plugin:owner', null, (_, context) => {
        return new Promise((resolve, reject) => {
            void resolve;
            context.signal.addEventListener('abort', () => reject(context.signal.reason), {
                once: true,
            });
        });
    });

    await registry.suspend(reason);
    await assert.rejects(running, (error) => error === reason);
    await assert.rejects(
        registry.run('test:suspend', 'plugin:owner', null, async () => undefined),
        (error) => error === reason,
    );
    assert.throws(
        () => registry.begin('test:suspend', 'plugin:owner'),
        (error) => error === reason,
    );
    registry.dispose();
});

test('disposal aborts active work and waitForIdle observes its final settlement', async () => {
    const registry = new OperationRegistry();
    registry.register(definition('test:dispose', { reentrancy: 'queue' }), 'plugin:owner');
    const gate = deferred();
    const running = registry.run('test:dispose', 'plugin:owner', null, () => gate.promise);
    void running.catch(() => undefined);

    registry.dispose();
    let idle = false;
    const waiting = registry.waitForIdle().then(() => {
        idle = true;
    });
    await Promise.resolve();
    assert.equal(idle, false);
    gate.resolve();
    await assert.rejects(running, (error) => error?.name === 'AbortError');
    await waiting;
    assert.equal(idle, true);
});
