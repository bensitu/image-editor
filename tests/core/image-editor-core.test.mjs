import assert from 'node:assert/strict';
import test from 'node:test';

import {
    EditorInitializationInProgressError,
    ImageEditorCore,
    definePluginRef,
} from '../../src/core/index.js';
import { transformPlugin, transformPluginRef } from '../../src/plugins/transform/index.js';
import {
    disposeEditor,
    fabric,
    makeImageDataUrl,
    resetEditorDom,
} from '../helpers/fabric-environment.mjs';

function createCore(options = {}) {
    const ids = resetEditorDom();
    const editor = new ImageEditorCore(fabric, {
        canvasWidth: 320,
        canvasHeight: 240,
        ...options,
    });
    return { editor, ids };
}

test('init resolves only after the configured initial image and Plugin hooks complete', async () => {
    resetEditorDom();
    const initialImageBase64 = makeImageDataUrl({ width: 96, height: 64 });
    const { editor, ids } = createCore({ initialImageBase64 });
    let hookCompleted = false;
    editor.use({
        ref: definePluginRef('example-test:initial-image-observer', '1.0.0'),
        version: '1.0.0',
        setupMode: 'sync',
        setup: () => Object.freeze({}),
        async onImageLoaded() {
            await Promise.resolve();
            hookCompleted = true;
        },
    });

    const initialization = editor.init({ canvas: ids.canvas });
    assert.throws(() => editor.disposeAsync(), EditorInitializationInProgressError);
    await initialization;

    assert.equal(editor.getLifecycleState(), 'initialized');
    assert.equal(editor.isImageLoaded(), true);
    assert.equal(editor.getImageInfo().naturalWidth, 96);
    assert.equal(editor.getImageInfo().naturalHeight, 64);
    assert.equal(hookCompleted, true);
    await editor.disposeAsync();
});

test('initial image failure reports once, rolls back, and permits a clean retry', async () => {
    resetEditorDom();
    const initialImageBase64 = makeImageDataUrl({ width: 80, height: 50 });
    const errors = [];
    const { editor, ids } = createCore({
        initialImageBase64,
        onError: (error, message) => errors.push({ error, message }),
    });
    let setupCount = 0;
    let failImageHook = true;
    editor.use({
        ref: definePluginRef('example-test:initial-image-failure', '1.0.0'),
        version: '1.0.0',
        setupMode: 'sync',
        setup() {
            setupCount += 1;
            return Object.freeze({});
        },
        onImageLoaded() {
            if (failImageHook) throw new Error('synthetic initial image hook failure');
        },
    });

    await assert.rejects(
        editor.init({ canvas: ids.canvas }),
        (error) => error.cause?.cause?.message === 'synthetic initial image hook failure',
    );
    assert.equal(editor.getLifecycleState(), 'configured');
    assert.equal(editor.getCanvas(), null);
    assert.equal(editor.isImageLoaded(), false);
    assert.equal(errors.length, 1);
    assert.equal(setupCount, 2);

    failImageHook = false;
    await editor.init({ canvas: ids.canvas });
    assert.equal(editor.getLifecycleState(), 'initialized');
    assert.equal(editor.isImageLoaded(), true);
    assert.equal(setupCount, 2);
    await editor.disposeAsync();
});

test('invalid configured initial image rejects init without an unhandled background task', async () => {
    const errors = [];
    const { editor, ids } = createCore({
        initialImageBase64: 'not-a-data-url',
        onError: (error, message) => errors.push({ error, message }),
    });

    await assert.rejects(editor.init({ canvas: ids.canvas }), /unsupported image data url/i);

    assert.equal(editor.getLifecycleState(), 'configured');
    assert.equal(editor.getCanvas(), null);
    assert.equal(errors.length, 1);
    await editor.disposeAsync();
});

test('ImageEditorCore installs typed plugins before init and loads a core-only image', async () => {
    const { editor, ids } = createCore();
    const transform = editor.use(transformPlugin({ animationDuration: 0 }));
    assert.equal(editor.getPlugin(transformPluginRef), transform);
    await editor.init({
        canvas: ids.canvas,
        canvasContainer: ids.canvasContainer,
        imagePlaceholder: ids.imagePlaceholder,
    });
    await editor.loadImage(makeImageDataUrl({ width: 120, height: 80 }));
    assert.equal(editor.isImageLoaded(), true);
    assert.equal(editor.getImageInfo().naturalWidth, 120);
    assert.equal(editor.getImageInfo().naturalHeight, 80);
    assert.deepEqual(transform.getState(), {
        scale: 1,
        rotationDegrees: 0,
        flipX: false,
        flipY: false,
    });
    disposeEditor(editor);
});

test('Transform plugin preserves scale clamp, zoom, rotation, flips, and one-mutation reset', async () => {
    const { editor, ids } = createCore();
    const descriptors = [];
    const observerRef = definePluginRef('example-test:geometry-observer', '1.0.0');
    editor.use({
        ref: observerRef,
        version: '1.0.0',
        setupMode: 'sync',
        setup: (context) => {
            context.events.on('geometry:committed', (descriptor) => descriptors.push(descriptor));
            return { descriptors };
        },
    });
    const transform = editor.use(
        transformPlugin({
            animationDuration: 0,
            minScale: 0.5,
            maxScale: 2,
            scaleStep: 0.25,
        }),
    );
    await editor.init({ canvas: ids.canvas, canvasContainer: ids.canvasContainer });
    await editor.loadImage(makeImageDataUrl());

    await transform.scale(10);
    assert.equal(transform.getState().scale, 2);
    await transform.zoomOut();
    assert.equal(transform.getState().scale, 1.75);
    assert.equal(descriptors.at(-1).operationId, 'transform:zoom-out');
    await transform.rotate(37);
    assert.equal(transform.getState().rotationDegrees, 37);
    await transform.flipHorizontal();
    await transform.flipVertical();
    assert.deepEqual(
        { flipX: transform.getState().flipX, flipY: transform.getState().flipY },
        { flipX: true, flipY: true },
    );
    const beforeResetEvents = descriptors.length;
    await transform.resetImageTransform();
    assert.deepEqual(transform.getState(), {
        scale: 1,
        rotationDegrees: 0,
        flipX: false,
        flipY: false,
    });
    assert.equal(descriptors.length, beforeResetEvents + 1);
    assert.equal(descriptors.at(-1).operationId, 'transform:reset');
    disposeEditor(editor);
});

test('public Snapshot restores Core and Transform state without restoring Plugin options', async () => {
    const { editor, ids } = createCore();
    const transform = editor.use(transformPlugin({ animationDuration: 0, maxScale: 3 }));
    await editor.init({ canvas: ids.canvas });
    await editor.loadImage(makeImageDataUrl());
    await transform.scale(1.5);
    await transform.rotate(25);
    const snapshot = editor.saveState();
    assert.equal(snapshot.includes('animationDuration'), false);

    await transform.resetImageTransform();
    await editor.loadFromState(snapshot);
    assert.deepEqual(transform.getState(), {
        scale: 1.5,
        rotationDegrees: 25,
        flipX: false,
        flipY: false,
    });
    assert.equal(editor.isImageLoaded(), true);
    disposeEditor(editor);
});

test('Transform failure uses targeted rollback and emits no committed event', async () => {
    const { editor, ids } = createCore();
    const descriptors = [];
    editor.use({
        ref: definePluginRef('example-test:failure-observer', '1.0.0'),
        version: '1.0.0',
        setupMode: 'sync',
        setup: (context) => {
            context.events.on('geometry:committed', (descriptor) => descriptors.push(descriptor));
            return { descriptors };
        },
    });
    const transform = editor.use(transformPlugin({ animationDuration: 0 }));
    await editor.init({ canvas: ids.canvas });
    await editor.loadImage(makeImageDataUrl());
    const image = editor.getCanvas().getObjects()[0];
    const originalGetBoundingRect = image.getBoundingRect.bind(image);
    let failOnce = true;
    image.getBoundingRect = (...args) => {
        if (failOnce) {
            failOnce = false;
            throw new Error('synthetic final-snap failure');
        }
        return originalGetBoundingRect(...args);
    };
    const before = transform.getState();
    await assert.rejects(transform.scale(1.4), /synthetic final-snap failure/);
    assert.deepEqual(transform.getState(), before);
    assert.equal(descriptors.length, 0);
    disposeEditor(editor);
});
