import assert from 'node:assert/strict';
import test from 'node:test';

import { ImageEditorCore, definePluginRef } from '../../../src/core/index.js';
import { SNAPSHOT_REGISTRATION_CAPABILITY } from '../../../src/core-runtime/internal-capabilities.js';
import { overlayFoundationPlugin } from '../../../src/foundations/overlay/index.js';
import { historyPlugin, historyPluginRef } from '../../../src/plugins/history/index.js';
import { maskPlugin } from '../../../src/plugins/mask/index.js';
import { transformPlugin } from '../../../src/plugins/transform/index.js';
import { fabric, makeImageDataUrl, resetEditorDom } from '../../helpers/fabric-environment.mjs';

async function createEditor({ historyOptions = {}, maskOptions = {}, stateFailure } = {}) {
    const ids = resetEditorDom({ containerWidth: 340, containerHeight: 250 });
    const warnings = [];
    const editor = new ImageEditorCore(fabric, {
        canvasWidth: 340,
        canvasHeight: 250,
        onWarning: (error, message) => warnings.push({ error, message }),
    });
    const overlay = editor.use(overlayFoundationPlugin());
    if (stateFailure) stateFailure.install(editor);
    const masks = editor.use(maskPlugin({ label: false, ...maskOptions }));
    const history = editor.use(historyPlugin(historyOptions));
    const transform = editor.use(transformPlugin({ animationDuration: 0 }));
    await editor.init({ canvas: ids.canvas, canvasContainer: ids.canvasContainer });
    return { editor, history, masks, overlay, transform, warnings };
}

async function load(editor) {
    await editor.loadImage(makeImageDataUrl({ width: 130, height: 85 }));
}

async function dispose(editor) {
    await editor.disposeAsync();
    document.body.innerHTML = '';
}

test('History starts empty after image load and records one entry per transform/reset', async () => {
    const states = [];
    const { editor, history, transform } = await createEditor({
        historyOptions: { onChange: (state) => states.push(state) },
    });
    await load(editor);
    assert.deepEqual(history.getState(), {
        isEnabled: true,
        canUndo: false,
        canRedo: false,
        length: 0,
        size: 0,
        position: 0,
    });
    await transform.scale(1.4);
    assert.deepEqual(history.getState(), {
        isEnabled: true,
        canUndo: true,
        canRedo: false,
        length: 1,
        size: 1,
        position: 1,
    });
    await transform.resetImageTransform();
    assert.deepEqual(history.getState(), {
        isEnabled: true,
        canUndo: true,
        canRedo: false,
        length: 2,
        size: 2,
        position: 2,
    });
    await history.undo();
    assert.equal(transform.getState().scale, 1.4);
    assert.equal(history.getState().size, 2);
    assert.equal(history.getState().position, 1);
    await history.redo();
    assert.equal(transform.getState().scale, 1);
    assert.equal(history.getState().position, 2);
    assert.ok(states.length >= 4);
    await dispose(editor);
});

test('max size, redo truncation, clear, and no-op boundaries are deterministic', async () => {
    const { editor, history, transform } = await createEditor({
        historyOptions: { maxSize: 2 },
    });
    await load(editor);
    await transform.rotate(10);
    await transform.rotate(20);
    await transform.rotate(30);
    assert.deepEqual(history.getState(), {
        isEnabled: true,
        canUndo: true,
        canRedo: false,
        length: 2,
        size: 2,
        position: 2,
    });
    await history.undo();
    await history.undo();
    assert.equal(history.canUndo(), false);
    assert.equal(history.canRedo(), true);
    await history.undo();
    assert.equal(history.getState().position, 0);
    await history.redo();
    assert.equal(transform.getState().rotationDegrees, 20);
    await transform.rotate(77);
    assert.equal(history.canRedo(), false);
    assert.equal(history.getState().position, history.getState().size);
    history.clear();
    assert.deepEqual(history.getState(), {
        isEnabled: true,
        canUndo: false,
        canRedo: false,
        length: 0,
        size: 0,
        position: 0,
    });
    await dispose(editor);
});

test('Mask create/remove restore Foundation index and counter through undo/redo', async () => {
    const { editor, history, masks, overlay } = await createEditor();
    await load(editor);
    const created = await masks.create({ left: 48, top: 36 });
    assert.equal(history.getState().size, 1);
    await history.undo();
    assert.equal(masks.getAll().length, 0);
    assert.equal(overlay.getByPersistentId(created.maskUid), null);
    await history.redo();
    const restored = overlay.getByPersistentId(created.maskUid);
    assert.ok(restored);
    assert.notEqual(restored, created);
    assert.equal(restored.left, 48);
    assert.equal(masks.getAll().length, 1);
    const next = await masks.create();
    assert.equal(next.maskId, 2);
    await masks.remove(next.maskUid);
    assert.equal(masks.getAll().length, 1);
    await history.undo();
    assert.equal(masks.getAll().length, 2);
    await dispose(editor);
});

test('failed transforms create zero records while successful recovery remains undoable', async () => {
    const { editor, history, transform } = await createEditor();
    await load(editor);
    const image = editor.getCanvas().getObjects()[0];
    const originalGetBoundingRect = image.getBoundingRect.bind(image);
    let failOnce = true;
    image.getBoundingRect = (...args) => {
        if (failOnce) {
            failOnce = false;
            throw new Error('synthetic history transform failure');
        }
        return originalGetBoundingRect(...args);
    };
    await assert.rejects(transform.scale(1.3), /synthetic history transform failure/);
    assert.equal(history.getState().size, 0);
    await transform.scale(1.3);
    assert.equal(history.getState().size, 1);
    await history.undo();
    assert.equal(transform.getState().scale, 1);
    await dispose(editor);
});

test('undo and redo failures rollback the attempted restore and keep the pointer unchanged', async () => {
    let failNextRestore = false;
    const failureRef = definePluginRef('example.test/history-restore-failure', '1.0.0');
    const stateFailure = {
        install(editor) {
            editor.use({
                ref: failureRef,
                version: '1.0.0',
                setupMode: 'sync',
                requires: [{ token: SNAPSHOT_REGISTRATION_CAPABILITY, range: '^1.0.0' }],
                setup(context) {
                    const state = context.capabilities.require(SNAPSHOT_REGISTRATION_CAPABILITY);
                    context.addDisposable(
                        state.registerSlice({
                            id: failureRef.id,
                            version: 1,
                            capture: () => ({ stable: true }),
                            validate: (value) =>
                                value?.stable === true
                                    ? { valid: true, value }
                                    : { valid: false, message: 'invalid failure-test state' },
                            restore: () => {
                                if (failNextRestore) {
                                    failNextRestore = false;
                                    throw new Error('synthetic one-shot restore failure');
                                }
                            },
                            reset: () => undefined,
                        }),
                    );
                    return Object.freeze({});
                },
            });
        },
    };
    const { editor, history, transform } = await createEditor({ stateFailure });
    await load(editor);
    await transform.rotate(25);
    failNextRestore = true;
    await assert.rejects(history.undo(), /History undo failed/);
    assert.equal(history.getState().position, 1);
    assert.equal(transform.getState().rotationDegrees, 25);
    await history.undo();
    assert.equal(history.getState().position, 0);
    failNextRestore = true;
    await assert.rejects(history.redo(), /History redo failed/);
    assert.equal(history.getState().position, 0);
    assert.equal(transform.getState().rotationDegrees, 0);
    await dispose(editor);
});

test('change listener failures are isolated and dispose releases History capability state', async () => {
    let calls = 0;
    const { editor, history, transform, warnings } = await createEditor();
    const unsubscribe = history.onChange(() => {
        calls += 1;
        throw new Error('listener failure');
    });
    await load(editor);
    await transform.scale(1.2);
    assert.equal(calls, 1);
    assert.ok(warnings.some((warning) => /History onChange/.test(warning.message)));
    unsubscribe();
    await transform.rotate(10);
    assert.equal(calls, 1);
    assert.equal(editor.getPlugin(historyPluginRef), history);
    await dispose(editor);
    assert.equal(history.isAvailable(), false);
    assert.throws(() => history.onChange(() => undefined), /History disposal/);
});
