import assert from 'node:assert/strict';
import test from 'node:test';

import { createSerializedEditorMountCoordinator } from '../../examples/shared/serialized-editor-mount.mjs';

function createDeferred() {
    let resolve;
    const promise = new Promise((settle) => {
        resolve = settle;
    });
    return Object.freeze({ promise, resolve });
}

function createOptions(name, initialization, events, published) {
    return {
        create() {
            events.push(`create:${name}`);
            return { name };
        },
        async initialize(owner) {
            events.push(`initialize:${owner.name}`);
            await initialization.promise;
        },
        publish(owner) {
            events.push(`publish:${owner.name}`);
            published.push(owner.name);
        },
        clear() {
            events.push(`clear:${name}`);
        },
        async dispose(owner) {
            events.push(`dispose:${owner.name}`);
        },
        onInitializationError(error) {
            assert.fail(error);
        },
        onDisposalError(error) {
            assert.fail(error);
        },
    };
}

test('React StrictMode cleanup and remount serialize canvas ownership', async () => {
    const coordinator = createSerializedEditorMountCoordinator();
    const firstInitialization = createDeferred();
    const secondInitialization = createDeferred();
    const events = [];
    const published = [];

    const first = coordinator.mount(createOptions('first', firstInitialization, events, published));
    await Promise.resolve();
    first.release();
    const second = coordinator.mount(
        createOptions('second', secondInitialization, events, published),
    );
    await Promise.resolve();

    assert.deepEqual(events, ['create:first', 'initialize:first', 'clear:first']);
    firstInitialization.resolve();
    await first.closed;
    await Promise.resolve();
    assert.deepEqual(events.slice(-3), ['dispose:first', 'create:second', 'initialize:second']);

    secondInitialization.resolve();
    await second.ready;
    assert.deepEqual(published, ['second']);
    second.release();
    await second.closed;
    assert.equal(events.at(-1), 'dispose:second');
});

test('Vue rapid unmount waits for initialization and never publishes stale state', async () => {
    const coordinator = createSerializedEditorMountCoordinator();
    const initialization = createDeferred();
    const events = [];
    const published = [];
    const lease = coordinator.mount(createOptions('vue', initialization, events, published));

    await Promise.resolve();
    lease.release();
    assert.deepEqual(events, ['create:vue', 'initialize:vue', 'clear:vue']);
    initialization.resolve();
    await lease.closed;

    assert.deepEqual(published, []);
    assert.equal(events.at(-1), 'dispose:vue');
});
