import assert from 'node:assert/strict';
import test from 'node:test';

import {
    PluginAggregateError,
    createCompositeDisposable,
    createDisposable,
    disposeInReverse,
} from '../../src/plugin-kernel/index.js';

test('disposable cleanup is idempotent for synchronous and asynchronous cleanup', async () => {
    let synchronousCalls = 0;
    let asynchronousCalls = 0;
    const synchronous = createDisposable(() => {
        synchronousCalls += 1;
    });
    const asynchronous = createDisposable(async () => {
        asynchronousCalls += 1;
        await Promise.resolve();
    });

    synchronous.dispose();
    synchronous.dispose();
    await Promise.all([asynchronous.dispose(), asynchronous.dispose()]);
    assert.equal(synchronousCalls, 1);
    assert.equal(asynchronousCalls, 1);
});

test('reverse cleanup continues after errors and reports each failure', async () => {
    const order = [];
    const warnings = [];
    const primaryFailure = new Error('cleanup failed');
    const disposables = [
        createDisposable(() => order.push('first')),
        createDisposable(() => {
            order.push('second');
            throw primaryFailure;
        }),
        createDisposable(() => order.push('third')),
    ];

    const errors = await disposeInReverse(disposables, {
        pluginId: 'example-test:disposable',
        warningSink: (warning) => warnings.push(warning),
    });
    assert.deepEqual(order, ['third', 'second', 'first']);
    assert.deepEqual(errors, [primaryFailure]);
    assert.equal(warnings.length, 1);
    assert.equal(warnings[0].code, 'PLUGIN_CLEANUP_FAILED');
});

test('composite disposable aggregates cleanup errors after completing all cleanup', async () => {
    const order = [];
    const composite = createCompositeDisposable([
        createDisposable(() => order.push(1)),
        createDisposable(() => {
            order.push(2);
            throw new Error('two');
        }),
        createDisposable(() => order.push(3)),
    ]);

    await assert.rejects(composite.dispose(), PluginAggregateError);
    assert.deepEqual(order, [3, 2, 1]);
    await composite.dispose();
});
