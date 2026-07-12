import assert from 'node:assert/strict';
import test from 'node:test';

import { ImageEditorCore, definePluginRef } from '../../src/core/index.js';
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

test('ImageEditorCore installs typed plugins before init and loads a core-only image', async () => {
    const { editor, ids } = createCore();
    const transform = editor.use(transformPlugin({ animationDuration: 0 }));
    assert.equal(editor.getPlugin(transformPluginRef), transform);
    editor.init({
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
    const observerRef = definePluginRef('example.test/geometry-observer', '1.0.0');
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
    editor.init({ canvas: ids.canvas, canvasContainer: ids.canvasContainer });
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
    await transform.reset();
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

test('v3 public snapshot restores Core and Transform state without restoring plugin options', async () => {
    const { editor, ids } = createCore();
    const transform = editor.use(transformPlugin({ animationDuration: 0, maxScale: 3 }));
    editor.init({ canvas: ids.canvas });
    await editor.loadImage(makeImageDataUrl());
    await transform.scale(1.5);
    await transform.rotate(25);
    const snapshot = editor.saveState();
    assert.equal(snapshot.includes('animationDuration'), false);

    await transform.reset();
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
        ref: definePluginRef('example.test/failure-observer', '1.0.0'),
        version: '1.0.0',
        setupMode: 'sync',
        setup: (context) => {
            context.events.on('geometry:committed', (descriptor) => descriptors.push(descriptor));
            return { descriptors };
        },
    });
    const transform = editor.use(transformPlugin({ animationDuration: 0 }));
    editor.init({ canvas: ids.canvas });
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
