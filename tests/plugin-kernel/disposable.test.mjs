import assert from 'node:assert/strict';
import test from 'node:test';

import {
    PluginAggregateError,
    createCompositeDisposable,
    createDisposable,
    disposeInReverse,
    disposeInReverseSync,
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

test('recursive disposal observes the in-progress cleanup Promise', async () => {
    let recursiveResult;
    let disposable;
    disposable = createDisposable(async () => {
        recursiveResult = disposable.dispose();
        await Promise.resolve();
    });

    const outerResult = disposable.dispose();
    assert.equal(recursiveResult, outerResult);
    await outerResult;
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

test('synchronous cleanup reports PromiseLike work and observes later rejections', async () => {
    const order = [];
    const warnings = [];
    const nativeFailure = new Error('native Promise cleanup failed');
    const thenableFailure = new Error('thenable cleanup failed');
    const errors = disposeInReverseSync(
        [
            {
                dispose() {
                    order.push('first');
                    return {
                        then(resolve, reject) {
                            void resolve;
                            reject(thenableFailure);
                        },
                    };
                },
            },
            {
                dispose() {
                    order.push('second');
                    return Promise.reject(nativeFailure);
                },
            },
            createDisposable(() => order.push('third')),
        ],
        {
            pluginId: 'example-test:synchronous-cleanup',
            warningSink: (warning) => warnings.push(warning),
        },
    );

    assert.deepEqual(order, ['third', 'second', 'first']);
    assert.equal(errors.length, 2);
    assert.ok(errors.every((error) => /asynchronous disposal path/i.test(error.message)));
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(
        warnings.map((warning) => warning.cause),
        [nativeFailure, thenableFailure],
    );
});
