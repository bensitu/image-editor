import assert from 'node:assert/strict';
import test from 'node:test';

import {
    PluginKernelDisposedError,
    PluginManager,
    PluginSetupError,
    createCapabilityToken,
    createDisposable,
    definePluginRef,
} from '../../src/plugin-kernel/index.js';

const rollbackToken = createCapabilityToken('example.test/rollback-matrix', '1.0.0');

for (const failurePoint of [1, 2, 3, 4, 5]) {
    test(`setup rollback removes every registration after failure point ${failurePoint}`, async () => {
        const manager = new PluginManager();
        const ref = definePluginRef(`example.test/rollback-${failurePoint}`, '1.0.0');
        const operationId = `example.test/operation-${failurePoint}`;
        const toolId = `example.test/tool-${failurePoint}`;
        const eventId = `example.test/event-${failurePoint}`;
        let failedListenerCalls = 0;
        let capturedState;

        const failAt = (point) => {
            if (failurePoint === point) throw new Error(`failure:${point}`);
        };
        const failingPlugin = {
            ref,
            version: '1.0.0',
            setup(context) {
                capturedState = context.state;
                context.capabilities.provide(rollbackToken, { failurePoint });
                failAt(1);
                context.operations.register({ id: operationId, mode: 'busy' });
                failAt(2);
                context.tools.register({
                    id: toolId,
                    enter: () => undefined,
                    exit: () => undefined,
                });
                failAt(3);
                context.events.on(eventId, () => {
                    failedListenerCalls += 1;
                });
                failAt(4);
                context.state.set('session', { failurePoint });
                failAt(5);
                return { unreachable: true };
            },
        };

        await assert.rejects(manager.install(failingPlugin), PluginSetupError);
        assert.equal(manager.has(ref.id), false);
        assert.throws(() => capturedState.get('session'), PluginKernelDisposedError);

        const replacement = {
            ref,
            version: '1.0.0',
            setup(context) {
                context.capabilities.provide(rollbackToken, { replacement: failurePoint });
                context.operations.register({ id: operationId, mode: 'busy' });
                context.tools.register({
                    id: toolId,
                    enter: () => undefined,
                    exit: () => undefined,
                });
                context.events.on(eventId, () => undefined);
                context.state.set('session', { replacement: true });
                return {
                    emit: (payload) => context.events.emitCommitted(eventId, payload),
                };
            },
        };
        const api = await manager.install(replacement);
        await api.emit({ committed: true });
        assert.equal(failedListenerCalls, 0);
        await manager.dispose();
    });
}

test('setup rollback preserves the primary error and aggregates cleanup failures in reverse order', async () => {
    const warnings = [];
    const manager = new PluginManager({ warningSink: (warning) => warnings.push(warning) });
    const ref = definePluginRef('example.test/cleanup-errors', '1.0.0');
    const cleanupOrder = [];
    const primary = new Error('primary setup error');
    const cleanupFailure = new Error('cleanup error');
    const plugin = {
        ref,
        version: '1.0.0',
        setup(context) {
            context.addDisposable(createDisposable(() => cleanupOrder.push('first')));
            context.addDisposable(
                createDisposable(() => {
                    cleanupOrder.push('second');
                    throw cleanupFailure;
                }),
            );
            context.addDisposable(createDisposable(() => cleanupOrder.push('third')));
            throw primary;
        },
    };

    await assert.rejects(manager.install(plugin), (error) => {
        assert.ok(error instanceof PluginSetupError);
        assert.equal(error.cause, primary);
        assert.deepEqual(error.cleanupErrors, [cleanupFailure]);
        return true;
    });
    assert.deepEqual(cleanupOrder, ['third', 'second', 'first']);
    assert.equal(warnings.length, 1);
    assert.equal(warnings[0].code, 'PLUGIN_CLEANUP_FAILED');
    await manager.dispose();
});

test('failed setup exits an active tool and clears an active operation token', async () => {
    const manager = new PluginManager();
    const ref = definePluginRef('example.test/active-rollback', '1.0.0');
    const exitReasons = [];
    let operationToken;
    const plugin = {
        ref,
        version: '1.0.0',
        async setup(context) {
            context.operations.register({ id: 'example.test/active-operation', mode: 'busy' });
            operationToken = context.operations.begin('example.test/active-operation');
            context.tools.register({
                id: 'example.test/active-tool',
                enter: () => undefined,
                exit: (reason) => exitReasons.push(reason),
            });
            await context.tools.enter('example.test/active-tool');
            throw new Error('fail after activation');
        },
    };

    await assert.rejects(manager.install(plugin), PluginSetupError);
    assert.equal(operationToken.active, false);
    assert.deepEqual(exitReasons, ['plugin-dispose']);

    const replacement = {
        ref,
        version: '1.0.0',
        setup(context) {
            context.operations.register({ id: 'example.test/active-operation', mode: 'busy' });
            context.tools.register({
                id: 'example.test/active-tool',
                enter: () => undefined,
                exit: () => undefined,
            });
            return {};
        },
    };
    await manager.install(replacement);
    await manager.dispose();
});
