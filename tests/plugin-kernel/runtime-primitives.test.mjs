import assert from 'node:assert/strict';
import test from 'node:test';

import {
    CommittedEventBus,
    InvalidPluginDefinitionError,
    OperationConflictError,
    OperationRegistrationError,
    OperationRegistry,
    PluginKernelDisposedError,
    ToolCoordinator,
    ToolRegistrationError,
    ToolTransitionError,
} from '../../src/plugin-kernel/index.js';

test('runtime registries reject identifiers outside namespace:kebab-case', () => {
    const operations = new OperationRegistry();
    assert.throws(
        () =>
            operations.register(
                {
                    id: 'invalid.operation',
                    mode: 'busy',
                    conflictDomains: ['document'],
                    reentrancy: 'reject',
                },
                'plugin:owner',
            ),
        OperationRegistrationError,
    );
    assert.throws(
        () =>
            operations.register(
                {
                    id: 'test:operation',
                    mode: 'busy',
                    conflictDomains: ['document'],
                    reentrancy: 'reject',
                },
                'plugin.owner',
            ),
        OperationRegistrationError,
    );

    const tools = new ToolCoordinator();
    assert.throws(
        () =>
            tools.register(
                { id: 'invalid/tool', enter: () => undefined, exit: () => undefined },
                'plugin:owner',
            ),
        ToolRegistrationError,
    );

    const events = new CommittedEventBus();
    assert.throws(() => events.on('invalid.event', () => undefined), InvalidPluginDefinitionError);
});

test('OperationRegistry supports open ids, ownership, reentrancy guards, and disposal', () => {
    const registry = new OperationRegistry();
    const registration = registry.register(
        {
            id: 'third-party-example:analyze',
            mode: 'busy',
            conflictDomains: ['document'],
            reentrancy: 'reject',
        },
        'plugin:owner',
    );

    assert.equal(registry.get('third-party-example:analyze')?.mode, 'busy');
    assert.throws(
        () =>
            registry.register(
                {
                    id: 'third-party-example:analyze',
                    mode: 'busy',
                    conflictDomains: ['document'],
                    reentrancy: 'reject',
                },
                'plugin:other',
            ),
        OperationRegistrationError,
    );
    assert.throws(
        () => registry.begin('third-party-example:analyze', 'plugin:other'),
        OperationConflictError,
    );

    const token = registry.begin('third-party-example:analyze', 'plugin:owner');
    assert.equal(token.active, true);
    assert.equal(registry.isActive('third-party-example:analyze'), true);
    assert.throws(
        () => registry.begin('third-party-example:analyze', 'plugin:owner'),
        OperationConflictError,
    );
    token.dispose();
    token.dispose();
    assert.equal(token.active, false);
    assert.equal(registry.isActive(), false);

    registration.dispose();
    assert.equal(registry.get('third-party-example:analyze'), null);
    registry.dispose();
    assert.throws(() => registry.get('third-party-example:analyze'), PluginKernelDisposedError);
});

test('ToolCoordinator switches tools in order and applies operation policy', async () => {
    const calls = [];
    const coordinator = new ToolCoordinator();
    coordinator.register(
        {
            id: 'third-party-example:first',
            enter: () => calls.push('first:enter'),
            exit: (reason) => calls.push(`first:exit:${reason}`),
            canRunOperation: (operationId) => operationId === 'test:allowed',
        },
        'plugin:first',
    );
    coordinator.register(
        {
            id: 'third-party-example:second',
            enter: async () => {
                await Promise.resolve();
                calls.push('second:enter');
            },
            exit: (reason) => calls.push(`second:exit:${reason}`),
        },
        'plugin:second',
    );

    await coordinator.enter('third-party-example:first', 'plugin:first');
    assert.equal(coordinator.canRunOperation('test:allowed'), true);
    assert.equal(coordinator.canRunOperation('test:blocked'), false);
    await coordinator.enter('third-party-example:second', 'plugin:second');
    assert.equal(coordinator.getActiveToolId(), 'third-party-example:second');
    assert.deepEqual(calls, ['first:enter', 'first:exit:switch', 'second:enter']);
    await coordinator.exit('requested');
    assert.equal(coordinator.getActiveToolId(), null);
    assert.deepEqual(calls.at(-1), 'second:exit:requested');
});

test('ToolCoordinator rejects duplicates and failed enter never leaves active state', async () => {
    const coordinator = new ToolCoordinator();
    coordinator.register(
        {
            id: 'third-party-example:failing-enter',
            enter: () => {
                throw new Error('enter failed');
            },
            exit: () => undefined,
        },
        'plugin:owner',
    );
    assert.throws(
        () =>
            coordinator.register(
                {
                    id: 'third-party-example:failing-enter',
                    enter: () => undefined,
                    exit: () => undefined,
                },
                'plugin:other',
            ),
        ToolRegistrationError,
    );

    await assert.rejects(
        coordinator.enter('third-party-example:failing-enter', 'plugin:owner'),
        ToolTransitionError,
    );
    assert.equal(coordinator.getActiveToolId(), null);
});

test('ToolCoordinator clears active state and reports failed exits', async () => {
    const errors = [];
    const coordinator = new ToolCoordinator({ errorSink: (error) => errors.push(error) });
    coordinator.register(
        {
            id: 'third-party-example:failing-exit',
            enter: () => undefined,
            exit: () => {
                throw new Error('exit failed');
            },
        },
        'plugin:owner',
    );
    await coordinator.enter('third-party-example:failing-exit', 'plugin:owner');
    await assert.rejects(coordinator.exit(), ToolTransitionError);
    assert.equal(coordinator.getActiveToolId(), null);
    assert.equal(errors.length, 1);
});

test('disposing an active tool registration exits it before removal', async () => {
    const reasons = [];
    const coordinator = new ToolCoordinator();
    const registration = coordinator.register(
        {
            id: 'third-party-example:disposable',
            enter: () => undefined,
            exit: (reason) => reasons.push(reason),
        },
        'plugin:owner',
    );
    await coordinator.enter('third-party-example:disposable', 'plugin:owner');
    await registration.dispose();
    assert.deepEqual(reasons, ['plugin-dispose']);
    assert.equal(coordinator.getActiveToolId(), null);
    await assert.rejects(
        coordinator.enter('third-party-example:disposable', 'plugin:owner'),
        ToolTransitionError,
    );
    await coordinator.dispose();
    assert.throws(() => coordinator.getActiveToolId(), PluginKernelDisposedError);
});

test('disposing a tool while it enters waits and prevents a zombie active tool', async () => {
    const coordinator = new ToolCoordinator();
    const exits = [];
    let releaseEnter;
    let markEnterStarted;
    const enterStarted = new Promise((resolve) => {
        markEnterStarted = resolve;
    });
    const registration = coordinator.register(
        {
            id: 'third-party-example:entering',
            enter: async () => {
                markEnterStarted();
                await new Promise((resolve) => {
                    releaseEnter = resolve;
                });
            },
            exit: (reason) => exits.push(reason),
        },
        'plugin:owner',
    );

    const entering = coordinator.enter('third-party-example:entering', 'plugin:owner');
    await enterStarted;
    const disposing = registration.dispose();
    releaseEnter();
    await Promise.all([entering, disposing]);

    assert.deepEqual(exits, ['plugin-dispose']);
    assert.equal(coordinator.getActiveToolId(), null);
    await assert.rejects(
        coordinator.enter('third-party-example:entering', 'plugin:owner'),
        ToolTransitionError,
    );
});

test('CommittedEventBus preserves registration order and isolates listener failures', async () => {
    const calls = [];
    const warnings = [];
    const bus = new CommittedEventBus({ warningSink: (warning) => warnings.push(warning) });
    const first = bus.on('test:committed', async (payload) => {
        await Promise.resolve();
        calls.push(`first:${payload}`);
    });
    bus.on('test:committed', () => {
        calls.push('second:throw');
        throw new Error('listener failed');
    });
    bus.on('test:committed', (payload) => calls.push(`third:${payload}`));

    await bus.emitCommitted('test:committed', 'one');
    assert.deepEqual(calls, ['first:one', 'second:throw', 'third:one']);
    assert.equal(warnings.length, 1);
    assert.equal(warnings[0].code, 'COMMITTED_EVENT_LISTENER_FAILED');

    first.dispose();
    calls.length = 0;
    await bus.emitCommitted('test:committed', 'two');
    assert.deepEqual(calls, ['second:throw', 'third:two']);
    bus.dispose();
    await assert.rejects(bus.emitCommitted('test:committed', 'three'), PluginKernelDisposedError);
});

test('CommittedEventBus serializes recursive same-name emissions', async () => {
    const bus = new CommittedEventBus();
    const calls = [];
    let nestedEmission;
    let activeListeners = 0;
    let maximumActiveListeners = 0;
    bus.on('test:recursive', async (payload) => {
        activeListeners += 1;
        maximumActiveListeners = Math.max(maximumActiveListeners, activeListeners);
        calls.push(`start:${payload}`);
        if (payload === 'outer') {
            nestedEmission = bus.emitCommitted('test:recursive', 'inner');
        }
        await Promise.resolve();
        calls.push(`end:${payload}`);
        activeListeners -= 1;
    });

    await bus.emitCommitted('test:recursive', 'outer');
    await nestedEmission;

    assert.equal(maximumActiveListeners, 1);
    assert.deepEqual(calls, ['start:outer', 'end:outer', 'start:inner', 'end:inner']);
});
