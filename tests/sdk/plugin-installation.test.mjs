import assert from 'node:assert/strict';
import test from 'node:test';

import { ImageEditorCore } from '../../src/core/index.js';
import {
    PluginBatchInstallError,
    PluginDefinitionConflictError,
    PluginDependencyCycleError,
    PluginDependencyError,
    composePlugins,
    createCapabilityToken,
    definePlugin,
    definePluginRef,
} from '../../src/sdk/index.js';
import { PluginManager } from '../../src/plugin-kernel/plugin-manager.js';
import { createDisposable } from '../../src/plugin-kernel/disposable.js';
import { fabric } from '../helpers/fabric-environment.mjs';

function createPlugin(ref, options = {}) {
    return definePlugin({
        ref,
        manifest: {
            id: ref.id,
            version: options.version ?? '1.0.0',
            apiVersion: ref.apiVersion,
            engine: '^3.0.0',
            requiresPlugins: options.requiresPlugins,
            requires: options.requires,
        },
        setupMode: 'sync',
        setup(context) {
            options.setup?.(context);
            return Object.freeze({ id: ref.id });
        },
        onDispose: options.onDispose,
    });
}

test('single installation rejects a missing Plugin dependency before setup', () => {
    const dependencyRef = definePluginRef('example:dependency', '1.0.0');
    const consumerRef = definePluginRef('example:consumer', '1.0.0');
    let setupCalls = 0;
    const consumer = createPlugin(consumerRef, {
        requiresPlugins: [dependencyRef],
        setup: () => {
            setupCalls += 1;
        },
    });
    const manager = new PluginManager();

    assert.throws(() => manager.installSync(consumer), PluginDependencyError);
    assert.equal(setupCalls, 0);
    manager.disposeSync();
});

test('batch installation uses deterministic topology for an unordered diamond graph', () => {
    const order = [];
    const baseRef = definePluginRef('example:base', '1.0.0');
    const leftRef = definePluginRef('example:left', '1.0.0');
    const rightRef = definePluginRef('example:right', '1.0.0');
    const topRef = definePluginRef('example:top', '1.0.0');
    const base = createPlugin(baseRef, { setup: () => order.push('base') });
    const left = createPlugin(leftRef, {
        requiresPlugins: [baseRef],
        setup: () => order.push('left'),
    });
    const right = createPlugin(rightRef, {
        requiresPlugins: [baseRef],
        setup: () => order.push('right'),
    });
    const top = createPlugin(topRef, {
        requiresPlugins: [leftRef, rightRef],
        setup: () => order.push('top'),
    });
    const manager = new PluginManager();

    const outcome = manager.installBatchSync([top, right, base, left]);

    assert.deepEqual(order, ['base', 'right', 'left', 'top']);
    assert.equal(outcome.apisByPluginId.get(topRef.id)?.id, topRef.id);
    assert.equal(manager.get(topRef)?.id, topRef.id);
    manager.disposeSync();
});

test('batch dependencies can consume a pending Capability without exposing pending APIs', () => {
    const capability = createCapabilityToken('example:pending-port', '1.0.0');
    const providerRef = definePluginRef('example:pending-provider', '1.0.0');
    const consumerRef = definePluginRef('example:pending-consumer', '1.0.0');
    const manager = new PluginManager();
    const provider = createPlugin(providerRef, {
        setup: (context) => {
            assert.equal(manager.get(providerRef), null);
            context.capabilities.provide(capability, Object.freeze({ read: () => 'available' }));
        },
    });
    const consumer = createPlugin(consumerRef, {
        requiresPlugins: [providerRef],
        requires: [{ token: capability, range: '^1.0.0' }],
        setup: (context) => {
            assert.equal(context.capabilities.require(capability).read(), 'available');
            assert.equal(manager.get(consumerRef), null);
        },
    });

    manager.installBatchSync([consumer, provider]);

    assert.equal(manager.get(providerRef)?.id, providerRef.id);
    assert.equal(manager.get(consumerRef)?.id, consumerRef.id);
    manager.disposeSync();
});

test('exact duplicate objects are deduplicated and exact installed definitions are reused', () => {
    const ref = definePluginRef('example:deduplicated', '1.0.0');
    let setupCalls = 0;
    const plugin = createPlugin(ref, {
        setup: () => {
            setupCalls += 1;
        },
    });
    const manager = new PluginManager();

    const first = manager.installBatchSync([plugin, plugin]);
    const second = manager.installBatchSync([plugin]);

    assert.equal(setupCalls, 1);
    assert.equal(first.installedPlugins.length, 1);
    assert.equal(first.installedPlugins[0], plugin);
    assert.equal(second.installedPlugins.length, 0);
    assert.equal(second.apisByPluginId.get(ref.id), manager.get(ref));
    assert.throws(
        () => manager.installBatchSync([createPlugin(ref)]),
        PluginDefinitionConflictError,
    );
    manager.disposeSync();
});

test('Kernel canonical definitions isolate replay from direct input mutation', () => {
    const requiredCapability = createCapabilityToken('example:canonical-required', '1.0.0');
    const optionalCapability = createCapabilityToken('example:canonical-optional', '1.0.0');
    const dependencyRef = definePluginRef('example:canonical-dependency', '1.0.0');
    const consumerRef = definePluginRef('example:canonical-consumer', '1.0.0');
    const calls = [];
    const dependency = createPlugin(dependencyRef);
    const rawDefinition = {
        ref: consumerRef,
        manifest: {
            id: consumerRef.id,
            version: '1.0.0',
            apiVersion: consumerRef.apiVersion,
            engine: '^3.0.0',
            requiresPlugins: [dependencyRef],
            requires: [{ token: requiredCapability, range: '^1.0.0' }],
            optional: [{ token: optionalCapability, range: '^1.0.0' }],
            permissions: ['fabric:canvas-read'],
        },
        setupMode: 'sync',
        setup(context) {
            calls.push(`setup:${context.capabilities.require(requiredCapability).value}`);
            return Object.freeze({ source: 'canonical' });
        },
        onDispose() {
            calls.push('dispose:canonical');
        },
    };
    const managerOptions = {
        hostCapabilities: [
            {
                token: requiredCapability,
                implementation: Object.freeze({ value: 'available' }),
            },
        ],
    };
    const firstManager = new PluginManager(managerOptions);
    const firstOutcome = firstManager.installBatchSync([rawDefinition, dependency]);
    const canonical = firstOutcome.installedPlugins.find((plugin) => plugin.ref === consumerRef);

    assert.ok(canonical);
    assert.notEqual(canonical, rawDefinition);
    assert.ok(Object.isFrozen(canonical));
    assert.ok(Object.isFrozen(canonical.manifest));
    assert.ok(Object.isFrozen(canonical.manifest.requiresPlugins));
    assert.ok(Object.isFrozen(canonical.manifest.requires));
    assert.ok(Object.isFrozen(canonical.manifest.requires[0]));
    assert.ok(Object.isFrozen(canonical.manifest.optional));
    assert.ok(Object.isFrozen(canonical.manifest.optional[0]));
    assert.ok(Object.isFrozen(canonical.manifest.permissions));

    rawDefinition.manifest.requiresPlugins.length = 0;
    rawDefinition.manifest.requires[0].range = '^2.0.0';
    rawDefinition.manifest.optional.length = 0;
    rawDefinition.manifest.permissions.length = 0;
    rawDefinition.setup = () => {
        calls.push('setup:mutated');
        return Object.freeze({ source: 'mutated' });
    };
    rawDefinition.onDispose = () => calls.push('dispose:mutated');

    firstManager.disposeSync();
    const secondManager = new PluginManager(managerOptions);
    const replayOutcome = secondManager.installBatchSync(firstOutcome.installedPlugins);

    assert.equal(
        replayOutcome.installedPlugins.find((plugin) => plugin.ref === consumerRef),
        canonical,
    );
    assert.deepEqual(calls, ['setup:available', 'dispose:canonical', 'setup:available']);
    secondManager.disposeSync();
    assert.deepEqual(calls, [
        'setup:available',
        'dispose:canonical',
        'setup:available',
        'dispose:canonical',
    ]);
});

test('a duplicate Capability provider fails the batch and removes the first provider API', () => {
    const capability = createCapabilityToken('example:conflicting-port', '1.0.0');
    const firstRef = definePluginRef('example:first-provider', '1.0.0');
    const secondRef = definePluginRef('example:second-provider', '1.0.0');
    const provide = (context) => {
        context.capabilities.provide(capability, Object.freeze({ ready: true }));
    };
    const first = createPlugin(firstRef, { setup: provide });
    const second = createPlugin(secondRef, { setup: provide });
    const manager = new PluginManager();

    assert.throws(() => manager.installBatchSync([first, second]), PluginBatchInstallError);
    assert.equal(manager.get(firstRef), null);
    assert.equal(manager.get(secondRef), null);
    manager.disposeSync();
});

test('batch validation rejects cycles and conflicting duplicate definitions before setup', () => {
    const firstRef = definePluginRef('example:cycle-first', '1.0.0');
    const secondRef = definePluginRef('example:cycle-second', '1.0.0');
    let setupCalls = 0;
    const first = createPlugin(firstRef, {
        requiresPlugins: [secondRef],
        setup: () => {
            setupCalls += 1;
        },
    });
    const second = createPlugin(secondRef, {
        requiresPlugins: [firstRef],
        setup: () => {
            setupCalls += 1;
        },
    });
    const manager = new PluginManager();

    assert.throws(() => manager.installBatchSync([first, second]), PluginDependencyCycleError);
    assert.equal(setupCalls, 0);

    const duplicateRef = definePluginRef('example:duplicate', '1.0.0');
    assert.throws(
        () => manager.installBatchSync([createPlugin(duplicateRef), createPlugin(duplicateRef)]),
        PluginDefinitionConflictError,
    );
    manager.disposeSync();
});

test('batch failure removes only current APIs and aggregates reverse cleanup failures', () => {
    const cleanup = [];
    const retainedRef = definePluginRef('example:retained', '1.0.0');
    const firstRef = definePluginRef('example:batch-first', '1.0.0');
    const failingRef = definePluginRef('example:batch-failing', '1.0.0');
    const retained = createPlugin(retainedRef);
    const first = createPlugin(firstRef, {
        setup: (context) => {
            context.disposables.add(
                createDisposable(() => {
                    cleanup.push('first-registration');
                    throw new Error('cleanup failed');
                }),
            );
        },
        onDispose: () => cleanup.push('first-dispose'),
    });
    const failing = createPlugin(failingRef, {
        requiresPlugins: [firstRef],
        setup: () => {
            throw new Error('setup failed');
        },
    });
    const manager = new PluginManager();
    manager.installSync(retained);

    assert.throws(
        () => manager.installBatchSync([failing, first]),
        (error) => {
            assert.ok(error instanceof PluginBatchInstallError);
            assert.match(String(error.cause), /setup failed/u);
            assert.equal(error.cleanupErrors.length, 1);
            return true;
        },
    );
    assert.deepEqual(cleanup, ['first-dispose', 'first-registration']);
    assert.equal(manager.get(retainedRef)?.id, retainedRef.id);
    assert.equal(manager.get(firstRef), null);
    assert.equal(manager.get(failingRef), null);
    manager.disposeSync();
});

test('nested Plugin Plans preserve child identity and typed API mapping at runtime', () => {
    const baseRef = definePluginRef('example:plan-base', '1.0.0');
    const topRef = definePluginRef('example:plan-top', '1.0.0');
    const base = createPlugin(baseRef);
    const top = createPlugin(topRef, { requiresPlugins: [baseRef] });
    const plan = composePlugins({
        nested: composePlugins({ base }),
        top,
    });
    const editor = new ImageEditorCore(fabric);

    const apis = editor.install(plan);

    assert.equal(apis.nested.base.id, baseRef.id);
    assert.equal(apis.top.id, topRef.id);
    assert.equal(editor.getPlugin(baseRef)?.id, baseRef.id);
    assert.equal(editor.getPlugin(topRef)?.id, topRef.id);
    editor.dispose();
});
