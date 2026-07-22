import assert from 'node:assert/strict';
import test from 'node:test';

import {
    CapabilityMissingError,
    InvalidPluginDefinitionError,
    PluginAggregateError,
    PluginAlreadyInstalledError,
    PluginCapabilityError,
    PluginKernelDisposedError,
    PluginKernelStateError,
    PluginLifecycleError,
    PluginManager,
    PluginNotInstalledError,
    PluginSetupError,
    PluginStateStore,
    RegistrationScope,
    createCapabilityToken,
    createDisposable,
    definePluginRef,
} from '../../src/plugin-kernel/index.js';

function pluginDefinition(id, overrides = {}) {
    const ref = overrides.ref ?? definePluginRef(id, overrides.apiVersion ?? '1.0.0');
    return {
        ref,
        version: overrides.version ?? '1.0.0',
        requires: overrides.requires,
        optional: overrides.optional,
        setup: overrides.setup ?? (() => ({ id })),
        onInit: overrides.onInit,
        onImageLoaded: overrides.onImageLoaded,
        onImageCleared: overrides.onImageCleared,
        onDispose: overrides.onDispose,
    };
}

test('PluginManager installs async plugins and provides typed-ref runtime queries', async () => {
    const manager = new PluginManager();
    const plugin = pluginDefinition('example-test:async', {
        setup: async () => {
            await Promise.resolve();
            return { answer: 42 };
        },
    });

    const api = await manager.install(plugin);
    assert.deepEqual(api, { answer: 42 });
    assert.equal(manager.get(plugin.ref), api);
    assert.equal(manager.require(plugin.ref), api);
    assert.equal(manager.getById(plugin.ref.id), api);
    assert.equal(manager.has(plugin.ref), true);
    assert.equal(manager.has(plugin.ref.id), true);

    const missingRef = definePluginRef('example-test:missing', '1.0.0');
    assert.equal(manager.get(missingRef), null);
    assert.throws(() => manager.require(missingRef), PluginNotInstalledError);
    await manager.dispose();
});

test('PluginManager synchronous path supports host capabilities and sync lifecycle boundaries', () => {
    const token = createCapabilityToken('core:example', '1.0.0');
    const calls = [];
    const manager = new PluginManager({
        hostCapabilities: [{ token, implementation: { answer: 42 } }],
    });
    const ref = definePluginRef('example-test:sync', '1.0.0');
    const plugin = {
        ref,
        version: '1.0.0',
        setupMode: 'sync',
        requires: [{ token, range: '^1.0.0' }],
        setup: (context) => {
            calls.push('setup');
            return { answer: context.capabilities.require(token).answer };
        },
        onInit: () => calls.push('init'),
        onDispose: () => calls.push('dispose'),
    };

    const api = manager.installSync(plugin);
    assert.deepEqual(api, { answer: 42 });
    manager.initializeSync();
    manager.disposeSync();
    assert.deepEqual(calls, ['setup', 'init', 'dispose']);
});

test('synchronous install rejects a Promise setup and rolls registrations back', () => {
    const manager = new PluginManager();
    const plugin = {
        ref: definePluginRef('example-test:invalid-sync', '1.0.0'),
        version: '1.0.0',
        setupMode: 'sync',
        setup: () => Promise.resolve({ invalid: true }),
    };
    assert.throws(() => manager.installSync(plugin), PluginSetupError);
    assert.equal(manager.get(plugin.ref), null);
    manager.disposeSync();
});

test('direct duplicate installation is strict and install after initialization is rejected', async () => {
    const manager = new PluginManager();
    const plugin = pluginDefinition('example-test:duplicate');
    await manager.install(plugin);
    await assert.rejects(manager.install(plugin), PluginAlreadyInstalledError);
    await manager.initialize();
    await assert.rejects(
        manager.install(pluginDefinition('example-test:late')),
        PluginKernelStateError,
    );
    await assert.rejects(manager.initialize(), PluginKernelStateError);
    await manager.dispose();
});

test('lifecycle callbacks use install order and dispose uses reverse order', async () => {
    const calls = [];
    const manager = new PluginManager();
    const createLifecyclePlugin = (name) =>
        pluginDefinition(`example-test:${name}`, {
            setup: (context) => {
                calls.push(`setup:${name}`);
                context.addDisposable(createDisposable(() => calls.push(`cleanup:${name}`)));
                return { name };
            },
            onInit: async () => {
                await Promise.resolve();
                calls.push(`init:${name}`);
            },
            onImageLoaded: (image) => calls.push(`loaded:${name}:${image.revision}`),
            onImageCleared: () => calls.push(`cleared:${name}`),
            onDispose: () => calls.push(`dispose:${name}`),
        });

    await manager.install(createLifecyclePlugin('first'));
    await manager.install(createLifecyclePlugin('second'));
    await manager.initialize();
    await manager.notifyImageLoaded({ revision: 7 });
    await manager.notifyImageCleared();
    await manager.dispose();

    assert.deepEqual(calls, [
        'setup:first',
        'setup:second',
        'init:first',
        'init:second',
        'loaded:first:7',
        'loaded:second:7',
        'cleared:first',
        'cleared:second',
        'dispose:second',
        'dispose:first',
        'cleanup:second',
        'cleanup:first',
    ]);
});

test('image lifecycle cannot run before initialization', async () => {
    const manager = new PluginManager();
    await manager.install(pluginDefinition('example-test:lifecycle-guard'));
    await assert.rejects(manager.notifyImageLoaded({}), PluginKernelStateError);
    await assert.rejects(manager.notifyImageCleared(), PluginKernelStateError);
    await manager.dispose();
});

test('required capabilities resolve before setup and undeclared capability access is denied', async () => {
    const manager = new PluginManager();
    const token = createCapabilityToken('example-test:declared-port', '1.2.0');
    const undeclaredToken = createCapabilityToken('example-test:undeclared-port', '1.0.0');
    let setupCalled = false;
    const missing = pluginDefinition('example-test:missing-consumer', {
        requires: [{ token, range: '^1.0.0' }],
        setup: () => {
            setupCalled = true;
            return {};
        },
    });
    await assert.rejects(manager.install(missing), CapabilityMissingError);
    assert.equal(setupCalled, false);

    const provider = pluginDefinition('example-test:provider', {
        setup: (context) => {
            context.capabilities.provide(token, { value: 'port' });
            return { provider: true };
        },
    });
    await manager.install(provider);
    const consumer = pluginDefinition('example-test:consumer', {
        requires: [{ token, range: '^1.0.0' }],
        setup: (context) => ({ port: context.capabilities.require(token) }),
    });
    assert.deepEqual(await manager.install(consumer), { port: { value: 'port' } });

    const unauthorized = pluginDefinition('example-test:unauthorized', {
        setup: (context) => {
            context.capabilities.optional(undeclaredToken);
            return {};
        },
    });
    await assert.rejects(
        manager.install(unauthorized),
        (error) =>
            error instanceof PluginSetupError && error.cause instanceof PluginCapabilityError,
    );
    await manager.dispose();
});

test('setup failure rolls back registrations and never installs a partial API', async () => {
    const manager = new PluginManager();
    const token = createCapabilityToken('example-test:rollback-port', '1.0.0');
    const ref = definePluginRef('example-test:failing-setup', '1.0.0');
    const primary = new Error('primary setup failure');
    let failedInitCalls = 0;
    const failing = pluginDefinition(ref.id, {
        ref,
        setup: (context) => {
            context.capabilities.provide(token, { stale: true });
            throw primary;
        },
        onInit: () => {
            failedInitCalls += 1;
        },
    });

    await assert.rejects(manager.install(failing), (error) => {
        assert.ok(error instanceof PluginSetupError);
        assert.equal(error.pluginId, ref.id);
        assert.equal(error.cause, primary);
        assert.deepEqual(error.cleanupErrors, []);
        return true;
    });
    assert.equal(manager.get(ref), null);
    assert.equal(manager.has(ref.id), false);

    const replacement = pluginDefinition('example-test:replacement-provider', {
        setup: (context) => {
            context.capabilities.provide(token, { stale: false });
            return { installed: true };
        },
    });
    await manager.install(replacement);
    await manager.initialize();
    assert.equal(failedInitCalls, 0);
    await manager.dispose();
});

test('invalid setup API is rejected and rolled back', async () => {
    const manager = new PluginManager();
    const plugin = pluginDefinition('example-test:invalid-api', { setup: () => undefined });
    await assert.rejects(
        manager.install(plugin),
        (error) =>
            error instanceof PluginSetupError &&
            error.cause instanceof InvalidPluginDefinitionError,
    );
    assert.equal(manager.has(plugin.ref.id), false);
    await manager.dispose();
});

test('onInit failure disposes all installed plugins and preserves cleanup failures', async () => {
    const calls = [];
    const manager = new PluginManager();
    await manager.install(
        pluginDefinition('example-test:init-first', {
            onInit: () => calls.push('init:first'),
            onDispose: () => calls.push('dispose:first'),
        }),
    );
    await manager.install(
        pluginDefinition('example-test:init-failing', {
            onInit: () => {
                calls.push('init:failing');
                throw new Error('init failed');
            },
            onDispose: () => {
                calls.push('dispose:failing');
                throw new Error('dispose after init failure');
            },
        }),
    );

    await assert.rejects(manager.initialize(), (error) => {
        assert.ok(error instanceof PluginLifecycleError);
        assert.equal(error.phase, 'init');
        assert.equal(error.cleanupErrors.length, 1);
        assert.ok(error.cleanupErrors[0] instanceof PluginLifecycleError);
        return true;
    });
    assert.equal(manager.state, 'disposed');
    assert.deepEqual(calls, ['init:first', 'init:failing', 'dispose:failing', 'dispose:first']);
    await manager.dispose();
});

test('dispose continues after plugin failures, aggregates them, and remains idempotent', async () => {
    const calls = [];
    const manager = new PluginManager();
    await manager.install(
        pluginDefinition('example-test:dispose-first', {
            onDispose: () => calls.push('dispose:first'),
        }),
    );
    await manager.install(
        pluginDefinition('example-test:dispose-failing', {
            onDispose: () => {
                calls.push('dispose:failing');
                throw new Error('dispose failed');
            },
        }),
    );

    await assert.rejects(manager.dispose(), PluginAggregateError);
    assert.deepEqual(calls, ['dispose:failing', 'dispose:first']);
    assert.equal(manager.state, 'disposed');
    await manager.dispose();
    assert.throws(() => manager.getById('example-test:dispose-first'), PluginKernelDisposedError);
});

test('Plugin operations cannot bypass the active Tool policy', async () => {
    const manager = new PluginManager();
    const api = await manager.install(
        pluginDefinition('example-test:tool-policy', {
            setup: (context) => {
                context.operations.register({
                    id: 'example-test:blocked-operation',
                    mode: 'mutation',
                    conflictDomains: ['document'],
                    reentrancy: 'reject',
                });
                context.operations.register({
                    id: 'example-test:explicitly-allowed-operation',
                    mode: 'mutation',
                    conflictDomains: ['document'],
                    reentrancy: 'reject',
                    allowedDuringTool: ['example-test:restrictive-tool'],
                });
                context.tools.register({
                    id: 'example-test:restrictive-tool',
                    enter: () => undefined,
                    exit: () => undefined,
                    canRunOperation: () => false,
                });
                return {
                    beginBlocked: () => context.operations.begin('example-test:blocked-operation'),
                    enter: () =>
                        context.tools.enter('example-test:restrictive-tool').then(() => undefined),
                    runAllowed: () =>
                        context.operations.run(
                            'example-test:explicitly-allowed-operation',
                            null,
                            async () => 'allowed',
                        ),
                    runBlocked: () =>
                        context.operations.run(
                            'example-test:blocked-operation',
                            null,
                            async () => 'blocked',
                        ),
                };
            },
        }),
    );
    await manager.initialize();
    await api.enter();

    assert.throws(api.beginBlocked, PluginKernelStateError);
    await assert.rejects(api.runBlocked(), PluginKernelStateError);
    assert.equal(await api.runAllowed(), 'allowed');
    await manager.dispose();
});

test('Plugin disposal aborts and awaits active operations before lifecycle teardown', async () => {
    const manager = new PluginManager();
    const cleanupGate = (() => {
        let resolve;
        const promise = new Promise((resolvePromise) => {
            resolve = resolvePromise;
        });
        return { promise, resolve };
    })();
    const calls = [];
    const api = await manager.install(
        pluginDefinition('example-test:dispose-operation', {
            setup: (context) => {
                context.operations.register({
                    id: 'example-test:dispose-operation-run',
                    mode: 'mutation',
                    conflictDomains: ['document'],
                    reentrancy: 'queue',
                });
                return {
                    run: () =>
                        context.operations.run(
                            'example-test:dispose-operation-run',
                            null,
                            async (_args, operation) => {
                                calls.push('operation:start');
                                await new Promise((resolve) => {
                                    operation.signal.addEventListener('abort', resolve, {
                                        once: true,
                                    });
                                });
                                calls.push('operation:aborted');
                                await cleanupGate.promise;
                                calls.push('operation:settled');
                            },
                        ),
                };
            },
            onDispose: () => calls.push('plugin:dispose'),
        }),
    );
    await manager.initialize();
    const running = api.run();
    void running.catch(() => undefined);
    await Promise.resolve();

    let disposed = false;
    const disposal = manager.dispose().then(() => {
        disposed = true;
    });
    await Promise.resolve();
    assert.equal(disposed, false);
    assert.deepEqual(calls, ['operation:start', 'operation:aborted']);

    cleanupGate.resolve();
    await assert.rejects(running, (error) => error?.name === 'AbortError');
    await disposal;
    assert.deepEqual(calls, [
        'operation:start',
        'operation:aborted',
        'operation:settled',
        'plugin:dispose',
    ]);
});

test('importing the Kernel does not install plugins or create shared singleton state', async () => {
    const first = new PluginManager();
    const second = new PluginManager();
    const plugin = pluginDefinition('example-test:instance-local');
    await first.install(plugin);

    assert.equal(first.has(plugin.ref), true);
    assert.equal(second.has(plugin.ref), false);
    await first.dispose();
    await second.dispose();
});

test('PluginStateStore rejects colliding live plugin scopes and releases ids on disposal', async () => {
    const stateStore = new PluginStateStore();
    const firstScope = new RegistrationScope('example-test:state-collision');
    const createState = (scope) =>
        stateStore.createScoped(
            'example-test:state-collision',
            (disposable) => scope.add(disposable),
            (disposable) => scope.addFinalizer(disposable),
            () => scope.active,
        );

    createState(firstScope);
    const secondScope = new RegistrationScope('example-test:state-collision');
    assert.throws(() => createState(secondScope), InvalidPluginDefinitionError);
    await firstScope.dispose();

    const thirdScope = new RegistrationScope('example-test:state-collision');
    const state = createState(thirdScope);
    state.set('value', 1);
    assert.equal(state.get('value'), 1);
    await thirdScope.dispose();
    stateStore.dispose();
});
