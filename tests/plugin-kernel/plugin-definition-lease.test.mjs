import assert from 'node:assert/strict';
import test from 'node:test';

import { ImageEditorCore } from '../../src/core/index.js';
import { transformPlugin } from '../../src/plugins/transform/index.js';
import {
    PluginBatchInstallError,
    PluginDefinitionAlreadyBoundError,
    definePlugin,
    definePluginRef,
} from '../../src/sdk/index.js';
import { fabric, resetEditorDom } from '../helpers/fabric-environment.mjs';

function createEditor() {
    resetEditorDom();
    return new ImageEditorCore(fabric);
}

test('one official Plugin Definition cannot bind to two live Core hosts', async () => {
    const definition = transformPlugin({ animationDuration: 0 });
    const first = createEditor();
    const second = createEditor();

    first.use(definition);
    assert.throws(
        () => second.use(definition),
        (error) =>
            error instanceof PluginDefinitionAlreadyBoundError &&
            error.pluginId === 'plugin:transform' &&
            error.boundHostState === 'created',
    );

    await first.disposeAsync();
    assert.doesNotThrow(() => second.use(definition));
    await second.disposeAsync();
});

test('separate official factory results remain isolated across Core hosts', async () => {
    const first = createEditor();
    const second = createEditor();

    assert.doesNotThrow(() => first.use(transformPlugin({ animationDuration: 0 })));
    assert.doesNotThrow(() => second.use(transformPlugin({ animationDuration: 0 })));

    await Promise.all([first.disposeAsync(), second.disposeAsync()]);
});

test('a failed Plugin batch releases every acquired Definition lease', async () => {
    const reusableRef = definePluginRef('example-test:reusable-lease', '1.0.0');
    const failingRef = definePluginRef('example-test:failing-lease-batch', '1.0.0');
    const reusable = definePlugin({
        ref: reusableRef,
        manifest: {
            id: reusableRef.id,
            version: '1.0.0',
            apiVersion: reusableRef.apiVersion,
            engine: '^3.0.0',
        },
        setupMode: 'sync',
        setup: () => Object.freeze({ value: 1 }),
    });
    const failing = definePlugin({
        ref: failingRef,
        manifest: {
            id: failingRef.id,
            version: '1.0.0',
            apiVersion: failingRef.apiVersion,
            engine: '^3.0.0',
        },
        setupMode: 'sync',
        setup: () => {
            throw new Error('synthetic batch failure');
        },
    });
    const failedHost = createEditor();
    const retryHost = createEditor();

    assert.throws(() => failedHost.install([reusable, failing]), PluginBatchInstallError);
    assert.doesNotThrow(() => retryHost.use(reusable));

    await Promise.all([failedHost.disposeAsync(), retryHost.disposeAsync()]);
});

test('one third-party Definition fails fast while its first host remains live', async () => {
    const ref = definePluginRef('example-test:third-party-lease', '1.0.0');
    const definition = definePlugin({
        ref,
        manifest: {
            id: ref.id,
            version: '1.0.0',
            apiVersion: ref.apiVersion,
            engine: '^3.0.0',
        },
        setupMode: 'sync',
        setup: () => Object.freeze({ value: crypto.randomUUID() }),
    });
    const first = createEditor();
    const second = createEditor();

    first.use(definition);
    assert.throws(() => second.use(definition), PluginDefinitionAlreadyBoundError);

    await Promise.all([first.disposeAsync(), second.disposeAsync()]);
});
