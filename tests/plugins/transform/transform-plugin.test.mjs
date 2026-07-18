import assert from 'node:assert/strict';
import test from 'node:test';

import { ImageEditorCore, definePluginRef } from '../../../src/core/index.js';
import {
    GEOMETRY_MUTATION_CAPABILITY,
    MEMENTO_HISTORY_CAPABILITY,
} from '../../../src/core-runtime/internal-capabilities.js';
import { transformPlugin, transformPluginRef } from '../../../src/plugins/transform/index.js';
import { resolveTransformOptions } from '../../../src/plugins/transform/transform-controller.js';
import { fabric, makeImageDataUrl, resetEditorDom } from '../../helpers/fabric-environment.mjs';

async function createEditor(transformOptions = {}, coreOptions = {}) {
    const ids = resetEditorDom({ containerWidth: 320, containerHeight: 240 });
    const editor = new ImageEditorCore(fabric, {
        canvasWidth: 320,
        canvasHeight: 240,
        ...coreOptions,
    });
    const transform = editor.use(transformPlugin(transformOptions));
    await editor.init({ canvas: ids.canvas, canvasContainer: ids.canvasContainer });
    return { editor, transform };
}

async function load(editor) {
    await editor.loadImage(makeImageDataUrl({ width: 120, height: 80 }));
}

async function dispose(editor) {
    await editor.disposeAsync();
    document.body.innerHTML = '';
}

test('transform options normalize finite bounds without entering snapshot state', async () => {
    assert.deepEqual(resolveTransformOptions({ minScale: -1, maxScale: 0, scaleStep: 0 }), {
        animationDuration: 300,
        minScale: 0.1,
        maxScale: 5,
        scaleStep: 0.05,
        rotationStep: 90,
    });
    const { editor } = await createEditor({
        animationDuration: 0,
        minScale: 0.25,
        maxScale: 4,
        scaleStep: 0.2,
    });
    await load(editor);
    const snapshot = editor.saveState();
    assert.doesNotMatch(snapshot, /animationDuration|minScale|maxScale|scaleStep/);
    await dispose(editor);
});

test('scale, zoom, arbitrary rotation, double flip, and mixed transforms remain coherent', async () => {
    const { editor, transform } = await createEditor({
        animationDuration: 0,
        minScale: 0.5,
        maxScale: 1.5,
        scaleStep: 0.2,
    });
    await load(editor);
    await transform.scale(-10);
    assert.equal(transform.getState().scale, 0.5);
    await transform.zoomIn();
    assert.equal(transform.getState().scale, 0.7);
    await transform.zoomOut();
    assert.equal(transform.getState().scale, 0.5);
    await transform.rotate(33.5);
    await transform.flipHorizontal();
    await transform.flipHorizontal();
    await transform.flipVertical();
    assert.deepEqual(transform.getState(), {
        scale: 0.5,
        rotationDegrees: 33.5,
        flipX: false,
        flipY: true,
    });
    await dispose(editor);
});

test('queued non-zero-duration transforms serialize through one operation slot', async () => {
    const { editor, transform } = await createEditor({ animationDuration: 15 });
    await load(editor);
    const first = transform.scale(1.2);
    const second = transform.rotate(22);
    await Promise.all([first, second]);
    assert.deepEqual(transform.getState(), {
        scale: 1.2,
        rotationDegrees: 22,
        flipX: false,
        flipY: false,
    });
    await dispose(editor);
});

test('active tool policy rejects a transform before any mutation', async () => {
    const ids = resetEditorDom();
    const editor = new ImageEditorCore(fabric);
    const policyRef = definePluginRef('example.test/transform-policy', '1.0.0');
    const policy = editor.use({
        ref: policyRef,
        version: '1.0.0',
        setupMode: 'sync',
        setup(context) {
            context.tools.register({
                id: 'example.test/block-transform',
                enter: () => undefined,
                exit: () => undefined,
                canRunOperation: (operationId) => !operationId.startsWith('transform:'),
            });
            return { enter: () => context.tools.enter('example.test/block-transform') };
        },
    });
    const transform = editor.use(transformPlugin({ animationDuration: 0 }));
    await editor.init({ canvas: ids.canvas });
    await load(editor);
    await policy.enter();
    const before = transform.getState();
    await assert.rejects(transform.scale(1.4), /active tool rejects/);
    assert.deepEqual(transform.getState(), before);
    await dispose(editor);
});

test('targeted rollback failure falls back to a trusted Core memento', async () => {
    const ids = resetEditorDom();
    const editor = new ImageEditorCore(fabric);
    let transactionFailed = false;
    const failureRef = definePluginRef('example.test/transform-rollback-failure', '1.0.0');
    editor.use({
        ref: failureRef,
        version: '1.0.0',
        setupMode: 'sync',
        requires: [{ token: GEOMETRY_MUTATION_CAPABILITY, range: '^1.0.0' }],
        permissions: ['core:geometry-participant'],
        setup(context) {
            const geometry = context.capabilities.require(GEOMETRY_MUTATION_CAPABILITY);
            context.addDisposable(
                geometry.registerParticipant({
                    id: failureRef.id,
                    order: 100,
                    supports: () => true,
                    apply: () => {
                        transactionFailed = true;
                        throw new Error('synthetic participant failure');
                    },
                }),
            );
            return Object.freeze({});
        },
    });
    const transform = editor.use(transformPlugin({ animationDuration: 0 }));
    await editor.init({ canvas: ids.canvas });
    await load(editor);
    const image = editor.getCanvas().getObjects()[0];
    const originalSetCoords = image.setCoords.bind(image);
    let targetedRollbackFailed = false;
    image.setCoords = (...args) => {
        if (transactionFailed && !targetedRollbackFailed) {
            targetedRollbackFailed = true;
            throw new Error('synthetic targeted rollback failure');
        }
        return originalSetCoords(...args);
    };

    await assert.rejects(transform.scale(1.4), /synthetic participant failure/);
    assert.equal(targetedRollbackFailed, true);
    assert.equal(editor.isImageLoaded(), true);
    assert.deepEqual(transform.getState(), {
        scale: 1,
        rotationDegrees: 0,
        flipX: false,
        flipY: false,
    });
    await dispose(editor);
});

test('failed transforms never reach the registered history provider', async () => {
    const ids = resetEditorDom();
    const editor = new ImageEditorCore(fabric);
    const historyRef = definePluginRef('example.test/transform-history-observer', '1.0.0');
    const history = editor.use({
        ref: historyRef,
        version: '1.0.0',
        setupMode: 'sync',
        requires: [{ token: MEMENTO_HISTORY_CAPABILITY, range: '^1.0.0' }],
        setup(context) {
            const records = [];
            const state = context.capabilities.require(MEMENTO_HISTORY_CAPABILITY);
            context.addDisposable(
                state.registerHistoryProvider(historyRef.id, {
                    isAvailable: () => true,
                    commit: (record) => records.push(record),
                }),
            );
            return { records };
        },
    });
    const transform = editor.use(transformPlugin({ animationDuration: 0 }));
    await editor.init({ canvas: ids.canvas });
    await load(editor);
    history.records.length = 0;
    const image = editor.getCanvas().getObjects()[0];
    const originalGetBoundingRect = image.getBoundingRect.bind(image);
    let failOnce = true;
    image.getBoundingRect = (...args) => {
        if (failOnce) {
            failOnce = false;
            throw new Error('synthetic history gate failure');
        }
        return originalGetBoundingRect(...args);
    };
    await assert.rejects(transform.rotate(45), /synthetic history gate failure/);
    assert.equal(history.records.length, 0);
    await transform.rotate(45);
    assert.equal(history.records.length, 1);
    await dispose(editor);
});

test('invalid transform snapshot state is rejected transactionally', async () => {
    const { editor, transform } = await createEditor({ animationDuration: 0 });
    await load(editor);
    await transform.scale(1.3);
    const before = transform.getState();
    const snapshot = JSON.parse(editor.saveState());
    snapshot.plugins[transformPluginRef.id].data.scale = 0;
    await assert.rejects(editor.loadFromState(snapshot), /Transform state is malformed/);
    assert.deepEqual(transform.getState(), before);
    await dispose(editor);
});

test('dispose during animation aborts promptly, restores state, and releases the Canvas', async () => {
    const { editor, transform } = await createEditor({ animationDuration: 500 });
    await load(editor);
    const before = transform.getState();
    const operation = transform.scale(1.5);
    await new Promise((resolve) => setTimeout(resolve, 10));
    const disposal = editor.disposeAsync();
    const results = await Promise.race([
        Promise.allSettled([operation, disposal]),
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error('dispose during animation timed out')), 1000),
        ),
    ]);
    assert.equal(results[1].status, 'fulfilled');
    assert.deepEqual(before, {
        scale: 1,
        rotationDegrees: 0,
        flipX: false,
        flipY: false,
    });
    assert.equal(editor.getCanvas(), null);
    document.body.innerHTML = '';
});
