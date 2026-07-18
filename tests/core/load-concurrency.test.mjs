import assert from 'node:assert/strict';
import test from 'node:test';

import { ImageEditorCore, definePluginRef } from '../../src/core/index.js';
import { fabric, makeImageDataUrl, resetEditorDom } from '../helpers/fabric-environment.mjs';

function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
    });
    return { promise, reject, resolve };
}

function controlledFabric({ abortAware = false } = {}) {
    const requests = [];
    class ControlledFabricImage extends fabric.FabricImage {
        static fromURL(source, options = {}) {
            const gate = deferred();
            const request = { gate, options, source };
            requests.push(request);
            if (abortAware && options.signal) {
                const abort = () =>
                    gate.reject(
                        options.signal.reason ??
                            new DOMException('Image decode was aborted.', 'AbortError'),
                    );
                if (options.signal.aborted) abort();
                else options.signal.addEventListener('abort', abort, { once: true });
            }
            return gate.promise;
        }
    }
    return {
        fabric: { ...fabric, FabricImage: ControlledFabricImage },
        requests,
    };
}

async function makeDecodedImage(source) {
    return fabric.FabricImage.fromURL(source, { crossOrigin: 'anonymous' });
}

async function createEditor(controlled, { onImageLoaded, onError } = {}) {
    const ids = resetEditorDom();
    const committed = [];
    const editor = new ImageEditorCore(controlled.fabric, {
        canvasWidth: 320,
        canvasHeight: 240,
        onError,
    });
    editor.use({
        ref: definePluginRef(`example.test/load-observer-${crypto.randomUUID()}`, '1.0.0'),
        version: '1.0.0',
        setupMode: 'sync',
        setup(context) {
            context.events.on('image:loaded', (info) => committed.push(info));
            return Object.freeze({});
        },
        onImageLoaded,
    });
    await editor.init({ canvas: ids.canvas, canvasContainer: ids.canvasContainer });
    return { committed, editor };
}

test('latest load wins while an aborted decode that finishes late cannot commit', async () => {
    resetEditorDom();
    const firstSource = makeImageDataUrl({ width: 91, height: 61, fill: '#cc3344' });
    const secondSource = makeImageDataUrl({ width: 143, height: 87, fill: '#3388cc' });
    const [firstImage, secondImage] = await Promise.all([
        makeDecodedImage(firstSource),
        makeDecodedImage(secondSource),
    ]);
    const controlled = controlledFabric();
    const errors = [];
    const { committed, editor } = await createEditor(controlled, {
        onError: (error, message) => errors.push({ error, message }),
    });

    const first = editor.loadImage(firstSource, { concurrency: 'replace-pending' });
    void first.catch(() => undefined);
    assert.equal(controlled.requests.length, 1);
    const second = editor.loadImage(secondSource, { concurrency: 'replace-pending' });

    assert.equal(controlled.requests.length, 2);
    assert.equal(controlled.requests[0].options.signal.aborted, true);
    controlled.requests[1].gate.resolve(secondImage);
    await second;
    controlled.requests[0].gate.resolve(firstImage);
    await assert.rejects(first, (error) => error?.name === 'AbortError');

    assert.equal(editor.getCanvas().getObjects()[0], secondImage);
    assert.deepEqual(editor.getImageInfo(), {
        width: 143,
        height: 87,
        naturalWidth: 143,
        naturalHeight: 87,
        mimeType: 'image/png',
        geometryRevision: 1,
    });
    assert.deepEqual(
        committed.map(({ naturalWidth, naturalHeight }) => [naturalWidth, naturalHeight]),
        [[143, 87]],
    );
    assert.deepEqual(errors, []);
    await editor.disposeAsync();
});

test('a pre-aborted external signal prevents decode and leaves the document untouched', async () => {
    const controlled = controlledFabric();
    const { committed, editor } = await createEditor(controlled);
    const controller = new AbortController();
    controller.abort(new DOMException('Cancelled before decode.', 'AbortError'));

    await assert.rejects(
        editor.loadImage(makeImageDataUrl(), { signal: controller.signal }),
        (error) => error?.name === 'AbortError',
    );
    assert.equal(controlled.requests.length, 0);
    assert.equal(editor.getImageInfo(), null);
    assert.deepEqual(committed, []);
    await editor.disposeAsync();
});

test('dispose aborts an active decode without publishing a committed load', async () => {
    const controlled = controlledFabric({ abortAware: true });
    const { committed, editor } = await createEditor(controlled);
    const loading = editor.loadImage(makeImageDataUrl());
    void loading.catch(() => undefined);
    assert.equal(controlled.requests.length, 1);

    const disposal = editor.disposeAsync();
    await assert.rejects(loading, (error) => error?.name === 'AbortError');
    await disposal;

    assert.equal(controlled.requests[0].options.signal.aborted, true);
    assert.deepEqual(committed, []);
    assert.equal(editor.getLifecycleState(), 'disposed');
});

test('external cancellation at the commit boundary restores the before state', async () => {
    const source = makeImageDataUrl({ width: 109, height: 73 });
    const decoded = await makeDecodedImage(source);
    const controlled = controlledFabric();
    const hookStarted = deferred();
    const releaseHook = deferred();
    const errors = [];
    const { committed, editor } = await createEditor(controlled, {
        onError: (error, message) => errors.push({ error, message }),
        onImageLoaded: async () => {
            hookStarted.resolve();
            await releaseHook.promise;
        },
    });
    const controller = new AbortController();
    const loading = editor.loadImage(source, { signal: controller.signal });
    void loading.catch(() => undefined);
    controlled.requests[0].gate.resolve(decoded);
    await hookStarted.promise;

    controller.abort(new DOMException('Cancelled during commit.', 'AbortError'));
    releaseHook.resolve();
    await assert.rejects(loading, (error) => error?.name === 'AbortError');

    assert.equal(editor.getImageInfo(), null);
    assert.equal(editor.getCanvas().getObjects().length, 0);
    assert.deepEqual(committed, []);
    assert.deepEqual(errors, []);
    await editor.disposeAsync();
});
