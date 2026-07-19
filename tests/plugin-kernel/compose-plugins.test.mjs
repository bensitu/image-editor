import assert from 'node:assert/strict';
import test from 'node:test';

import {
    PluginAlreadyInstalledError,
    PluginManager,
    PluginSetupError,
    PluginVersionMismatchError,
    composePlugins,
    definePluginRef,
} from '../../src/plugin-kernel/index.js';

function simplePlugin(ref, overrides = {}) {
    return {
        ref,
        version: overrides.version ?? '1.0.0',
        setup: overrides.setup ?? (() => ({ id: ref.id })),
        onDispose: overrides.onDispose,
    };
}

test('composed plugins ensure shared dependencies once while direct duplicate install remains strict', async () => {
    const manager = new PluginManager();
    const foundationRef = definePluginRef('example-test:foundation', '1.0.0');
    let foundationSetups = 0;
    let foundationDisposals = 0;
    const foundation = simplePlugin(foundationRef, {
        setup: () => ({ instance: ++foundationSetups }),
        onDispose: () => {
            foundationDisposals += 1;
        },
    });
    const first = composePlugins({
        ref: definePluginRef('example-test:composite-first', '1.0.0'),
        version: '1.0.0',
        plugins: [foundation],
        createApi: ([foundationApi]) => ({ foundation: foundationApi, composite: 'first' }),
    });
    const second = composePlugins({
        ref: definePluginRef('example-test:composite-second', '1.0.0'),
        version: '1.0.0',
        plugins: [foundation],
        createApi: ([foundationApi]) => ({ foundation: foundationApi, composite: 'second' }),
    });

    const firstApi = await manager.install(first);
    const secondApi = await manager.install(second);
    assert.equal(foundationSetups, 1);
    assert.equal(firstApi.foundation, secondApi.foundation);
    await assert.rejects(manager.install(foundation), PluginAlreadyInstalledError);
    await manager.dispose();
    assert.equal(foundationDisposals, 1);
});

test('composed install failure removes only dependencies newly installed by that composition', async () => {
    const manager = new PluginManager();
    const foundationRef = definePluginRef('example-test:preexisting-foundation', '1.0.0');
    const childRef = definePluginRef('example-test:new-child', '1.0.0');
    const failingRef = definePluginRef('example-test:failing-child', '1.0.0');
    const foundation = simplePlugin(foundationRef);
    const disposeOrder = [];
    const child = simplePlugin(childRef, {
        onDispose: () => disposeOrder.push('child'),
    });
    const failing = simplePlugin(failingRef, {
        setup: () => {
            throw new Error('child setup failed');
        },
    });
    await manager.install(foundation);

    const composite = composePlugins({
        ref: definePluginRef('example-test:failing-composite', '1.0.0'),
        version: '1.0.0',
        plugins: [foundation, child, failing],
        createApi: () => ({ unreachable: true }),
    });
    await assert.rejects(manager.install(composite), PluginSetupError);
    assert.equal(manager.has(foundationRef), true);
    assert.equal(manager.has(childRef), false);
    assert.equal(manager.has(failingRef), false);
    assert.equal(manager.has(composite.ref), false);
    assert.deepEqual(disposeOrder, ['child']);

    await manager.install(child);
    await manager.dispose();
});

test('createApi failure rolls back newly installed children in reverse order', async () => {
    const manager = new PluginManager();
    const disposeOrder = [];
    const firstRef = definePluginRef('example-test:api-child-first', '1.0.0');
    const secondRef = definePluginRef('example-test:api-child-second', '1.0.0');
    const first = simplePlugin(firstRef, { onDispose: () => disposeOrder.push('first') });
    const second = simplePlugin(secondRef, { onDispose: () => disposeOrder.push('second') });
    const composite = composePlugins({
        ref: definePluginRef('example-test:api-failing-composite', '1.0.0'),
        version: '1.0.0',
        plugins: [first, second],
        createApi: () => {
            throw new Error('API composition failed');
        },
    });

    await assert.rejects(manager.install(composite), PluginSetupError);
    assert.equal(manager.has(firstRef), false);
    assert.equal(manager.has(secondRef), false);
    assert.deepEqual(disposeOrder, ['second', 'first']);
    await manager.dispose();
});

test('ensure refuses an incompatible implementation version without replacing the provider', async () => {
    const manager = new PluginManager();
    const foundationRef = definePluginRef('example-test:versioned-foundation', '1.0.0');
    const installed = simplePlugin(foundationRef, { version: '1.0.0' });
    const incompatible = simplePlugin(foundationRef, { version: '2.0.0' });
    await manager.install(installed);
    const composite = composePlugins({
        ref: definePluginRef('example-test:versioned-composite', '1.0.0'),
        version: '1.0.0',
        plugins: [incompatible],
        createApi: ([api]) => api,
    });

    await assert.rejects(
        manager.install(composite),
        (error) =>
            error instanceof PluginSetupError && error.cause instanceof PluginVersionMismatchError,
    );
    assert.equal(manager.get(foundationRef)?.id, foundationRef.id);
    await manager.dispose();
});

test('outer composition rollback removes dependencies installed by a nested composition', async () => {
    const manager = new PluginManager();
    const disposeOrder = [];
    const foundationRef = definePluginRef('example-test:nested-foundation', '1.0.0');
    const featureRef = definePluginRef('example-test:nested-feature', '1.0.0');
    const foundation = simplePlugin(foundationRef, {
        onDispose: () => disposeOrder.push('foundation'),
    });
    const feature = simplePlugin(featureRef, {
        onDispose: () => disposeOrder.push('feature'),
    });
    const inner = composePlugins({
        ref: definePluginRef('example-test:inner-composite', '1.0.0'),
        version: '1.0.0',
        plugins: [foundation, feature],
        createApi: ([foundationApi, featureApi]) => ({ foundationApi, featureApi }),
    });
    const outer = composePlugins({
        ref: definePluginRef('example-test:outer-composite', '1.0.0'),
        version: '1.0.0',
        plugins: [inner],
        createApi: () => {
            throw new Error('outer failed');
        },
    });

    await assert.rejects(manager.install(outer), PluginSetupError);
    assert.equal(manager.has(foundationRef), false);
    assert.equal(manager.has(featureRef), false);
    assert.equal(manager.has(inner.ref), false);
    assert.equal(manager.has(outer.ref), false);
    assert.deepEqual(disposeOrder, ['feature', 'foundation']);
    await manager.dispose();
});
