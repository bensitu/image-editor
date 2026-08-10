import assert from 'node:assert/strict';
import test from 'node:test';

import { LatestValueScheduler } from '../../../src/plugins/canvas-interactions/schedulers/latest-value-scheduler.js';
import { OrderedSampleScheduler } from '../../../src/plugins/canvas-interactions/schedulers/ordered-sample-scheduler.js';

function deferred(): { readonly promise: Promise<void>; resolve(): void } {
    let resolve = (): void => undefined;
    const promise = new Promise<void>((complete) => {
        resolve = complete;
    });
    return { promise, resolve };
}

test('Latest-value scheduling retains one running value and the newest pending value', async () => {
    const releaseFirst = deferred();
    const calls: number[] = [];
    const scheduler = new LatestValueScheduler<number>(async (value) => {
        calls.push(value);
        if (value === 1) await releaseFirst.promise;
    });

    const first = scheduler.pushLatest(1);
    await Promise.resolve();
    const second = scheduler.pushLatest(2);
    const third = scheduler.pushLatest(3);
    const flushed = scheduler.flush();
    assert.deepEqual(calls, [1]);
    releaseFirst.resolve();
    await Promise.all([first, second, third, flushed]);

    assert.deepEqual(calls, [1, 3]);
});

test('Ordered scheduling preserves every sample and flushes before later work continues', async () => {
    const releaseFirst = deferred();
    const calls: number[] = [];
    const scheduler = new OrderedSampleScheduler<number>(async (value) => {
        if (value === 1) await releaseFirst.promise;
        calls.push(value);
    });

    const pending = [scheduler.push(1), scheduler.push(2), scheduler.push(3)];
    const flushed = scheduler.flush().then(() => calls.push(4));
    await Promise.resolve();
    assert.deepEqual(calls, []);
    releaseFirst.resolve();
    await Promise.all([...pending, flushed]);

    assert.deepEqual(calls, [1, 2, 3, 4]);
});

test('Cancelling a scheduler drops pending work without waiting for the active task', async () => {
    const releaseActive = deferred();
    const calls: number[] = [];
    const scheduler = new OrderedSampleScheduler<number>(async (value) => {
        calls.push(value);
        if (value === 1) await releaseActive.promise;
    });

    const first = scheduler.push(1);
    await Promise.resolve();
    const second = scheduler.push(2);
    scheduler.cancel();
    await scheduler.flush();
    assert.deepEqual(calls, [1]);
    releaseActive.resolve();
    await Promise.all([first, second]);
});
