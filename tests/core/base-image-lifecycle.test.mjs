/**
 * Verifies ownership-safe disposal of replaced and rejected Core base images.
 *
 * @module
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { ImageEditorCore, definePluginRef } from '../../src/core/index.js';
import { CanvasCoreStateAdapter } from '../../src/core-runtime/core-state-adapter.js';
import { fabric, makeImageDataUrl, resetEditorDom } from '../helpers/fabric-environment.mjs';

function trackDisposal(image, { error = null } = {}) {
    const originalDispose = image.dispose.bind(image);
    let count = 0;
    image.dispose = () => {
        count += 1;
        if (error) throw error;
        return originalDispose();
    };
    return Object.freeze({
        get count() {
            return count;
        },
    });
}

function queuedFabric(images) {
    const queue = [...images];
    class QueuedFabricImage extends fabric.FabricImage {
        static fromURL() {
            const image = queue.shift();
            if (!image) return Promise.reject(new Error('No queued decoded image.'));
            return Promise.resolve(image);
        }
    }
    return {
        fabric: { ...fabric, FabricImage: QueuedFabricImage },
        remaining: () => queue.length,
    };
}

async function decodeImage(source) {
    return fabric.FabricImage.fromURL(source, { crossOrigin: 'anonymous' });
}

function createLifecyclePlugin(hooks = {}) {
    return {
        ref: definePluginRef(`example-test:base-image-lifecycle-${crypto.randomUUID()}`, '1.0.0'),
        version: '1.0.0',
        setupMode: 'sync',
        setup: () => Object.freeze({}),
        ...hooks,
    };
}

function createFakeImage(kind = 'baseImage') {
    let disposeCount = 0;
    return {
        editorObjectKind: kind,
        dispose() {
            disposeCount += 1;
        },
        get disposeCount() {
            return disposeCount;
        },
        set() {},
        setCoords() {},
    };
}

function createAdapterHarness({ baseImage, canvas }) {
    const state = {
        baseImage,
        baseImageScale: 1,
        canvas,
        geometryRevision: 1,
        imageMimeType: 'image/png',
        size: null,
    };
    const adapter = new CanvasCoreStateAdapter(
        {
            getCanvas: () => state.canvas,
            getBaseImage: () => state.baseImage,
            setBaseImage: (image) => {
                state.baseImage = image;
            },
            getImageMimeType: () => state.imageMimeType,
            setImageMimeType: (value) => {
                state.imageMimeType = value;
            },
            getBaseImageScale: () => state.baseImageScale,
            setBaseImageScale: (value) => {
                state.baseImageScale = value;
            },
            getGeometryRevision: () => state.geometryRevision,
            setGeometryRevision: (value) => {
                state.geometryRevision = value;
            },
            setCanvasSize: (width, height) => {
                state.size = { width, height };
            },
            isDisposed: () => false,
        },
        { listKeys: () => [] },
        { isTransient: () => false },
        { isTransient: () => false },
        {
            maxDecodedPixels: 1_000_000,
            maxImageDimension: 1_000,
            decodeTimeoutMs: 1_000,
        },
    );
    return { adapter, state };
}

function initializedState() {
    return {
        initialized: true,
        canvasWidth: 100,
        canvasHeight: 80,
        canvas: { objects: [] },
        imageMimeType: 'image/png',
        baseImageScale: 1,
        geometryRevision: 2,
    };
}

function uninitializedState() {
    return {
        initialized: false,
        canvasWidth: 0,
        canvasHeight: 0,
        canvas: null,
        imageMimeType: null,
        baseImageScale: 1,
        geometryRevision: 2,
    };
}

function trustedContext(signal = new AbortController().signal) {
    return Object.freeze({ mode: 'trusted-memento', signal });
}

function containsCause(root, expected, visited = new Set()) {
    if (root === expected) return true;
    if (!root || (typeof root !== 'object' && typeof root !== 'function') || visited.has(root)) {
        return false;
    }
    visited.add(root);
    if ('cause' in root && containsCause(root.cause, expected, visited)) return true;
    for (const key of ['causes', 'cleanupErrors', 'rollbackErrors']) {
        if (Array.isArray(root[key])) {
            if (root[key].some((entry) => containsCause(entry, expected, visited))) return true;
        }
    }
    return false;
}

test('image replacement notifies plugins before releasing the previous base image', async () => {
    const ids = resetEditorDom();
    const firstSource = makeImageDataUrl({ width: 80, height: 50, fill: '#aa3344' });
    const secondSource = makeImageDataUrl({ width: 120, height: 70, fill: '#3366aa' });
    const [firstImage, secondImage] = await Promise.all([
        decodeImage(firstSource),
        decodeImage(secondSource),
    ]);
    const controlled = queuedFabric([firstImage, secondImage]);
    const editor = new ImageEditorCore(controlled.fabric);
    const lifecycle = [];
    let firstDisposal;
    editor.use(
        createLifecyclePlugin({
            onImageCleared() {
                lifecycle.push('cleared');
                assert.equal(editor.getCanvas().getObjects()[0], firstImage);
                assert.equal(firstDisposal.count, 0);
            },
            onImageLoaded() {
                lifecycle.push('loaded');
            },
        }),
    );

    await editor.init({ canvas: ids.canvas });
    await editor.loadImage(firstSource);
    firstDisposal = trackDisposal(firstImage);
    lifecycle.length = 0;
    await editor.loadImage(secondSource);

    assert.deepEqual(lifecycle, ['cleared', 'loaded']);
    assert.equal(editor.getCanvas().getObjects()[0], secondImage);
    assert.equal(firstDisposal.count, 1);
    assert.equal(controlled.remaining(), 0);
    await editor.disposeAsync();
});

test('state restore releases the replaced initialized base image exactly once', async () => {
    const ids = resetEditorDom();
    const editor = new ImageEditorCore(fabric);
    await editor.init({ canvas: ids.canvas });
    await editor.loadImage(makeImageDataUrl({ width: 70, height: 40, fill: '#994455' }));
    const firstSnapshot = editor.saveState();
    await editor.loadImage(makeImageDataUrl({ width: 130, height: 90, fill: '#448899' }));
    const replaced = editor.getCanvas().getObjects()[0];
    const disposal = trackDisposal(replaced);

    await editor.loadFromState(firstSnapshot);

    assert.equal(disposal.count, 1);
    assert.notEqual(editor.getCanvas().getObjects()[0], replaced);
    assert.equal(editor.getImageInfo().naturalWidth, 70);
    await editor.disposeAsync();
});

test('state restore to uninitialized releases only the previous base image', async () => {
    const previous = createFakeImage();
    const unrelated = createFakeImage('example-test:overlay');
    let clearCount = 0;
    const canvas = {
        clear() {
            clearCount += 1;
        },
    };
    const { adapter, state } = createAdapterHarness({ baseImage: previous, canvas });

    await adapter.restore(uninitializedState(), trustedContext());

    assert.equal(clearCount, 1);
    assert.equal(previous.disposeCount, 1);
    assert.equal(unrelated.disposeCount, 0);
    assert.equal(state.baseImage, null);
    assert.equal(state.imageMimeType, null);
    assert.equal(state.geometryRevision, 2);
});

test('pre-aborted state restore preserves ownership and performs no Canvas mutation', async () => {
    const previous = createFakeImage();
    let clearCount = 0;
    const canvas = {
        clear() {
            clearCount += 1;
        },
    };
    const { adapter, state } = createAdapterHarness({ baseImage: previous, canvas });
    const controller = new AbortController();
    const reason = new DOMException('Synthetic restore cancellation.', 'AbortError');
    controller.abort(reason);

    await assert.rejects(adapter.restore(uninitializedState(), trustedContext(controller.signal)), {
        name: 'AbortError',
    });

    assert.equal(clearCount, 0);
    assert.equal(previous.disposeCount, 0);
    assert.equal(state.baseImage, previous);
});

test('aborted or failed Canvas decode releases only rejected base images', async (t) => {
    for (const mode of ['abort', 'decode-failure']) {
        await t.test(mode, async () => {
            const previous = createFakeImage();
            const candidate = createFakeImage();
            const unrelated = createFakeImage('example-test:overlay');
            const controller = new AbortController();
            const reason =
                mode === 'abort'
                    ? new DOMException('Synthetic restore cancellation.', 'AbortError')
                    : new Error('Synthetic Canvas decode failure.');
            let objects = [];
            const canvas = {
                async loadFromJSON() {
                    objects = [candidate, unrelated];
                    if (mode === 'abort') {
                        controller.abort(reason);
                        return;
                    }
                    throw reason;
                },
                getObjects: () => objects,
            };
            const { adapter, state } = createAdapterHarness({ baseImage: previous, canvas });

            await assert.rejects(
                adapter.restore(initializedState(), trustedContext(controller.signal)),
                (error) => error === reason,
            );

            assert.equal(candidate.disposeCount, 1);
            assert.equal(unrelated.disposeCount, 0);
            assert.equal(previous.disposeCount, 0);
            assert.equal(state.baseImage, previous);
        });
    }
});

test('state restore protects a replacement with the same object identity', async () => {
    const previous = createFakeImage();
    const canvas = {
        loadFromJSON: async () => undefined,
        getObjects: () => [previous],
        sendObjectToBack: () => undefined,
    };
    const { adapter, state } = createAdapterHarness({ baseImage: previous, canvas });

    await adapter.restore(initializedState(), trustedContext());

    assert.equal(state.baseImage, previous);
    assert.equal(previous.disposeCount, 0);
});

test('a rejected pre-adoption image is released and the prior document is restored', async () => {
    const ids = resetEditorDom();
    const firstSource = makeImageDataUrl({ width: 72, height: 48, fill: '#775533' });
    const secondSource = makeImageDataUrl({ width: 111, height: 67, fill: '#335577' });
    const [firstImage, rejectedImage] = await Promise.all([
        decodeImage(firstSource),
        decodeImage(secondSource),
    ]);
    const rejectedDisposal = trackDisposal(rejectedImage);
    const controlled = queuedFabric([firstImage, rejectedImage]);
    const editor = new ImageEditorCore(controlled.fabric);
    const clearFailure = new Error('Synthetic clear hook failure.');
    let rejectClear = false;
    editor.use(
        createLifecyclePlugin({
            onImageCleared() {
                if (rejectClear) throw clearFailure;
            },
        }),
    );
    await editor.init({ canvas: ids.canvas });
    await editor.loadImage(firstSource);
    rejectClear = true;

    await assert.rejects(editor.loadImage(secondSource), (error) => {
        assert.equal(containsCause(error, clearFailure), true);
        return true;
    });

    assert.equal(rejectedDisposal.count, 1);
    assert.notEqual(editor.getCanvas().getObjects()[0], rejectedImage);
    assert.equal(editor.getImageInfo().naturalWidth, 72);
    await editor.disposeAsync();
});

test('rollback releases an adopted replacement without double-disposal', async () => {
    const ids = resetEditorDom();
    const firstSource = makeImageDataUrl({ width: 74, height: 49, fill: '#557733' });
    const secondSource = makeImageDataUrl({ width: 112, height: 68, fill: '#337755' });
    const [firstImage, rejectedImage] = await Promise.all([
        decodeImage(firstSource),
        decodeImage(secondSource),
    ]);
    const rejectedDisposal = trackDisposal(rejectedImage);
    const controlled = queuedFabric([firstImage, rejectedImage]);
    const editor = new ImageEditorCore(controlled.fabric);
    const loadedFailure = new Error('Synthetic loaded hook failure.');
    let rejectLoaded = false;
    editor.use(
        createLifecyclePlugin({
            onImageLoaded() {
                if (rejectLoaded) throw loadedFailure;
            },
        }),
    );
    await editor.init({ canvas: ids.canvas });
    await editor.loadImage(firstSource);
    rejectLoaded = true;

    await assert.rejects(editor.loadImage(secondSource), (error) => {
        assert.equal(containsCause(error, loadedFailure), true);
        return true;
    });

    assert.equal(rejectedDisposal.count, 1);
    assert.notEqual(editor.getCanvas().getObjects()[0], rejectedImage);
    assert.equal(editor.getImageInfo().naturalWidth, 74);
    await editor.disposeAsync();
    assert.equal(rejectedDisposal.count, 1);
});

test('initial image failure releases the adopted image before Canvas teardown', async () => {
    const ids = resetEditorDom();
    const source = makeImageDataUrl({ width: 76, height: 51, fill: '#663388' });
    const image = await decodeImage(source);
    const disposal = trackDisposal(image);
    const controlled = queuedFabric([image]);
    const editor = new ImageEditorCore(controlled.fabric, { initialImageBase64: source });
    const initialFailure = new Error('Synthetic initial image failure.');
    editor.use(
        createLifecyclePlugin({
            onImageLoaded() {
                throw initialFailure;
            },
        }),
    );

    await assert.rejects(editor.init({ canvas: ids.canvas }), (error) => {
        assert.equal(containsCause(error, initialFailure), true);
        return true;
    });

    assert.equal(disposal.count, 1);
    assert.equal(editor.getCanvas(), null);
    assert.equal(editor.isImageLoaded(), false);
    await editor.disposeAsync();
    assert.equal(disposal.count, 1);
});

test('old-image disposal failures retain their cause and roll back the replacement', async () => {
    const ids = resetEditorDom();
    const firstSource = makeImageDataUrl({ width: 78, height: 52, fill: '#884433' });
    const secondSource = makeImageDataUrl({ width: 118, height: 72, fill: '#338844' });
    const [firstImage, rejectedImage] = await Promise.all([
        decodeImage(firstSource),
        decodeImage(secondSource),
    ]);
    const disposalFailure = new Error('Synthetic previous image disposal failure.');
    trackDisposal(firstImage, { error: disposalFailure });
    const rejectedDisposal = trackDisposal(rejectedImage);
    const controlled = queuedFabric([firstImage, rejectedImage]);
    const editor = new ImageEditorCore(controlled.fabric);
    await editor.init({ canvas: ids.canvas });
    await editor.loadImage(firstSource);

    await assert.rejects(editor.loadImage(secondSource), (error) => {
        assert.equal(containsCause(error, disposalFailure), true);
        return true;
    });

    assert.equal(rejectedDisposal.count, 1);
    assert.notEqual(editor.getCanvas().getObjects()[0], rejectedImage);
    assert.equal(editor.getImageInfo().naturalWidth, 78);
    await editor.disposeAsync();
});
