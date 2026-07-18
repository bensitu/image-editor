import assert from 'node:assert/strict';
import test from 'node:test';

import {
    createControlledImageDecoder,
    createDeferredOperation,
    createPluginTestFabric,
    createPluginTestHost,
} from '../../src/testing/index.js';

test('testing entry publishes isolated host and control helpers', () => {
    for (const value of [
        createControlledImageDecoder,
        createDeferredOperation,
        createPluginTestFabric,
        createPluginTestHost,
    ]) {
        assert.equal(typeof value, 'function');
    }
});

test('deferred operations settle once and expose deterministic state', async () => {
    const deferred = createDeferredOperation();
    assert.equal(deferred.settled, false);
    deferred.resolve('ready');
    deferred.reject(new Error('ignored'));
    assert.equal(await deferred.promise, 'ready');
    assert.equal(deferred.settled, true);
});

test('controlled decoder resolves, rejects, and aborts queued requests', async () => {
    const decoder = createControlledImageDecoder();
    const first = decoder.decode('first');
    const second = decoder.decode('second');
    assert.deepEqual(decoder.pendingInputs, ['first', 'second']);

    decoder.resolveNext({ id: 1 });
    decoder.rejectNext(new Error('decode failed'));
    assert.deepEqual(await first, { id: 1 });
    await assert.rejects(second, /decode failed/);

    const abortController = new AbortController();
    const aborted = decoder.decode('aborted', abortController.signal);
    abortController.abort();
    await assert.rejects(aborted, (error) => error?.name === 'AbortError');
    assert.deepEqual(decoder.pendingInputs, []);
});

test('Fabric test harness detects namespace mutation', () => {
    const fabricModule = { Rect: class Rect {} };
    const harness = createPluginTestFabric(fabricModule);
    assert.equal(harness.module, fabricModule);
    harness.assertUnchanged();

    fabricModule.Circle = class Circle {};
    assert.throws(() => harness.assertUnchanged(), /Fabric namespace changed/);
});

test('test host exposes lifecycle behavior without exposing the manager', async () => {
    const host = createPluginTestHost();
    assert.equal(host.state, 'created');
    assert.equal('manager' in host, false);
    await host.initialize();
    assert.equal(host.state, 'initialized');
    await host.dispose();
    assert.equal(host.state, 'disposed');
});
