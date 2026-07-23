import assert from 'node:assert/strict';
import test from 'node:test';

import {
    DOCUMENT_MUTATION_CAPABILITY,
    SNAPSHOT_REGISTRATION_CAPABILITY,
} from '../../../src/core-runtime/internal-capabilities.js';
import { ImageEditorCore, definePluginRef } from '../../../src/core/index.js';
import { overlayFoundationPlugin } from '../../../src/foundations/overlay/index.js';
import { historyPlugin, historyPluginRef } from '../../../src/plugins/history/index.js';
import { maskPlugin } from '../../../src/plugins/mask/index.js';
import { transformPlugin } from '../../../src/plugins/transform/index.js';
import { fabric, makeImageDataUrl, resetEditorDom } from '../../helpers/fabric-environment.mjs';

function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
    });
    return { promise, resolve, reject };
}

async function createEditor({ historyOptions = {}, installBeforeHistory } = {}) {
    const ids = resetEditorDom({ containerWidth: 340, containerHeight: 250 });
    const editor = new ImageEditorCore(fabric, {
        canvasWidth: 340,
        canvasHeight: 250,
    });
    const overlay = editor.use(overlayFoundationPlugin());
    const extension = installBeforeHistory?.(editor) ?? null;
    const masks = editor.use(maskPlugin({ label: false }));
    const history = editor.use(historyPlugin(historyOptions));
    const transform = editor.use(transformPlugin({ animationDuration: 0 }));
    await editor.init({ canvas: ids.canvas, canvasContainer: ids.canvasContainer });
    return { editor, extension, history, masks, overlay, transform };
}

async function load(editor) {
    await editor.loadImage(makeImageDataUrl({ width: 130, height: 85 }));
}

async function dispose(editor) {
    await editor.disposeAsync();
    document.body.innerHTML = '';
}

function captureProbePlugin() {
    const ref = definePluginRef('example-test:history-capture-probe', '1.0.0');
    let captures = 0;
    let failNext = false;
    return {
        ref,
        version: '1.0.0',
        setupMode: 'sync',
        requires: [{ token: SNAPSHOT_REGISTRATION_CAPABILITY, range: '^1.0.0' }],
        setup(context) {
            const state = context.capabilities.require(SNAPSHOT_REGISTRATION_CAPABILITY);
            context.addDisposable(
                state.registerSlice({
                    id: ref.id,
                    version: 1,
                    capture: () => {
                        captures += 1;
                        if (failNext) {
                            failNext = false;
                            throw new Error('synthetic baseline capture failure');
                        }
                        return { stable: true };
                    },
                    validate: (value) =>
                        value?.stable === true
                            ? { valid: true, value }
                            : { valid: false, message: 'Capture probe state is invalid.' },
                    restore: () => undefined,
                    clearState: () => undefined,
                }),
            );
            return Object.freeze({
                getCaptureCount: () => captures,
                failNextCapture: () => {
                    failNext = true;
                },
            });
        },
    };
}

function controlledStatePlugin() {
    const ref = definePluginRef('example-test:history-controlled-state', '1.0.0');
    let value = 0;
    let sequence = 0;
    return {
        ref,
        version: '1.0.0',
        setupMode: 'sync',
        requires: [
            { token: SNAPSHOT_REGISTRATION_CAPABILITY, range: '^1.0.0' },
            { token: DOCUMENT_MUTATION_CAPABILITY, range: '^1.0.0' },
        ],
        setup(context) {
            const state = context.capabilities.require(SNAPSHOT_REGISTRATION_CAPABILITY);
            const mutations = context.capabilities.require(DOCUMENT_MUTATION_CAPABILITY);
            context.operations.register({
                id: 'example-test:history-controlled-mutation',
                mode: 'mutation',
                conflictDomains: ['document', 'state'],
                reentrancy: 'queue',
            });
            context.addDisposable(
                state.registerSlice({
                    id: ref.id,
                    version: 1,
                    capture: () => ({ value }),
                    validate: (candidate) =>
                        candidate && typeof candidate.value === 'number'
                            ? { valid: true, value: candidate }
                            : { valid: false, message: 'Controlled state is invalid.' },
                    restore: (snapshot) => {
                        value = snapshot.value;
                    },
                    clearState: () => {
                        value = 0;
                    },
                }),
            );
            return Object.freeze({
                getValue: () => value,
                mutate: (nextValue, gate) =>
                    mutations.run({
                        id: `example-test:history-controlled-transaction:${++sequence}`,
                        kind: 'plugin-state',
                        operationId: 'example-test:history-controlled-mutation',
                        conflictDomains: ['document', 'state'],
                        mutate: async () => {
                            gate?.started.resolve();
                            if (gate) await gate.release.promise;
                            value = nextValue;
                        },
                    }),
            });
        },
    };
}

test('History installs enabled by default and can be installed disabled before initialization', async () => {
    const defaultFixture = await createEditor();
    assert.equal(defaultFixture.history.isEnabled, true);
    assert.equal(defaultFixture.history.isAvailable(), true);
    await dispose(defaultFixture.editor);

    const disabledFixture = await createEditor({ historyOptions: { enabled: false } });
    assert.equal(disabledFixture.history.isEnabled, false);
    assert.equal(disabledFixture.history.isAvailable(), true);
    assert.equal(disabledFixture.editor.getPlugin(historyPluginRef), disabledFixture.history);
    await load(disabledFixture.editor);
    await disabledFixture.transform.scale(1.3);
    assert.deepEqual(disabledFixture.history.getState(), {
        isEnabled: false,
        canUndo: false,
        canRedo: false,
        length: 0,
        size: 0,
        position: 0,
    });
    await dispose(disabledFixture.editor);
    assert.throws(() => disabledFixture.history.isEnabled, /after the editor has been disposed/u);
    assert.throws(
        () => disabledFixture.history.enable({ baseline: 'current' }),
        /after the editor has been disposed/u,
    );
});

test('History cannot be attached after editor initialization', async () => {
    const ids = resetEditorDom();
    const editor = new ImageEditorCore(fabric);
    await editor.init({ canvas: ids.canvas });
    assert.throws(() => editor.use(historyPlugin({ enabled: false })), /initializ/u);
    await dispose(editor);
});

test('History recording can be enabled and disabled while the editor is configured', async () => {
    const ids = resetEditorDom();
    const editor = new ImageEditorCore(fabric);
    const history = editor.use(historyPlugin({ enabled: false }));

    await history.enable({ baseline: 'current' });
    assert.equal(history.isEnabled, true);
    await history.disable({ clear: false });
    assert.equal(history.isEnabled, false);

    await editor.init({ canvas: ids.canvas });
    assert.equal(editor.getPlugin(historyPluginRef), history);
    await dispose(editor);
});

test('enable captures the current baseline and excludes earlier operations from undo', async () => {
    const states = [];
    const { editor, history, masks, transform } = await createEditor({
        historyOptions: { enabled: false, onChange: (state) => states.push(state) },
    });
    await load(editor);
    await transform.scale(1.25);
    const mask = await masks.create({ left: 44, top: 36 });
    assert.equal(history.length, 0);

    await history.enable({ baseline: 'current' });
    assert.equal(history.isEnabled, true);
    assert.equal(history.canUndo(), false);
    assert.equal(history.canRedo(), false);
    assert.equal(states.length, 1);

    await transform.rotate(30);
    assert.equal(history.length, 1);
    await history.undo();
    assert.equal(transform.getState().rotationDegrees, 0);
    assert.equal(transform.getState().scale, 1.25);
    assert.ok(masks.getAll().some((candidate) => candidate.maskUid === mask.maskUid));
    await history.undo();
    assert.equal(transform.getState().scale, 1.25);
    assert.equal(masks.getAll().length, 1);
    await dispose(editor);
});

test('failed baseline capture preserves disabled state and retained records', async () => {
    const states = [];
    const { editor, extension, history, transform } = await createEditor({
        installBeforeHistory: (instance) => instance.use(captureProbePlugin()),
    });
    await load(editor);
    await transform.rotate(15);
    await history.disable({ clear: false });
    history.onChange((state) => states.push(state));
    extension.failNextCapture();

    await assert.rejects(
        history.enable({ baseline: 'current' }),
        (error) =>
            error?.code === 'MEMENTO_CAPTURE_ERROR' &&
            error?.sliceId === 'example-test:history-capture-probe' &&
            /synthetic baseline capture failure/u.test(error?.cause?.message),
    );
    assert.equal(history.isEnabled, false);
    assert.equal(history.length, 1);
    assert.equal(states.length, 0);

    await history.enable({ baseline: 'current' });
    assert.equal(history.isEnabled, true);
    assert.equal(history.length, 0);
    assert.equal(states.length, 1);
    await dispose(editor);
});

test('enable is idempotent and does not recapture or clear an active timeline', async () => {
    const states = [];
    const { editor, extension, history, transform } = await createEditor({
        historyOptions: { enabled: false },
        installBeforeHistory: (instance) => instance.use(captureProbePlugin()),
    });
    await load(editor);
    history.onChange((state) => states.push(state));
    const beforeEnable = extension.getCaptureCount();
    await history.enable({ baseline: 'current' });
    assert.equal(extension.getCaptureCount(), beforeEnable + 1);
    await transform.rotate(12);
    const beforeRepeatedEnable = extension.getCaptureCount();
    const stateEvents = states.length;

    await history.enable({ baseline: 'current' });
    assert.equal(extension.getCaptureCount(), beforeRepeatedEnable);
    assert.equal(history.length, 1);
    assert.equal(states.length, stateEvents);
    await dispose(editor);
});

test('disable clears records by default and repeated no-op transitions publish nothing', async () => {
    const states = [];
    const { editor, history, transform } = await createEditor();
    await load(editor);
    await transform.rotate(10);
    await transform.rotate(20);
    history.onChange((state) => states.push(state));

    await history.disable();
    assert.deepEqual(history.getState(), {
        isEnabled: false,
        canUndo: false,
        canRedo: false,
        length: 0,
        size: 0,
        position: 0,
    });
    assert.equal(states.length, 1);
    await transform.rotate(30);
    assert.equal(history.length, 0);
    await history.disable({ clear: true });
    assert.equal(states.length, 1);
    await dispose(editor);
});

test('retained records stay bounded and inactive, then re-enable starts a new timeline', async () => {
    const { editor, history, transform } = await createEditor({
        historyOptions: { maxSize: 2 },
    });
    await load(editor);
    await transform.rotate(10);
    await transform.rotate(20);
    await transform.rotate(30);
    assert.equal(history.length, 2);

    await history.disable({ clear: false });
    assert.equal(history.length, 2);
    assert.equal(history.canUndo(), false);
    assert.equal(history.canRedo(), false);
    await history.undo();
    assert.equal(transform.getState().rotationDegrees, 30);
    await transform.rotate(70);
    assert.equal(history.length, 2);

    await history.enable({ baseline: 'current' });
    assert.equal(history.length, 0);
    await transform.rotate(90);
    await history.undo();
    assert.equal(transform.getState().rotationDegrees, 70);
    await history.undo();
    assert.equal(transform.getState().rotationDegrees, 70);
    await dispose(editor);
});

test('clear removes retained inactive records and emits only observable status changes', async () => {
    const states = [];
    const { editor, history, transform } = await createEditor();
    await load(editor);
    await transform.rotate(20);
    history.onChange((state) => states.push(state));

    await history.disable({ clear: false });
    assert.equal(history.length, 1);
    await history.disable({ clear: false });
    assert.equal(states.length, 1);
    history.clear();
    assert.equal(history.length, 0);
    assert.equal(states.length, 2);
    history.clear();
    await history.disable({ clear: true });
    assert.equal(states.length, 2);
    await dispose(editor);
});

test('Transform, Overlay, and Mask recording follow the enabled state', async () => {
    const { editor, history, masks, overlay, transform } = await createEditor({
        historyOptions: { enabled: false },
    });
    await load(editor);
    await transform.scale(1.2);
    const mask = await masks.create({ left: 48, top: 34 });
    assert.equal(history.length, 0);

    await history.enable({ baseline: 'current' });
    await transform.rotate(25);
    await overlay.setHidden(mask.maskUid, true);
    await masks.remove(mask.maskUid);
    assert.equal(history.length, 3);

    await history.undo();
    assert.ok(overlay.getByPersistentId(mask.maskUid));
    await history.undo();
    assert.equal(overlay.getByPersistentId(mask.maskUid).visible, true);
    await history.undo();
    assert.equal(transform.getState().rotationDegrees, 0);
    assert.equal(transform.getState().scale, 1.2);
    assert.ok(overlay.getByPersistentId(mask.maskUid));
    await dispose(editor);
});

test('Core rollback remains active while History recording is disabled', async () => {
    const { editor, history, transform } = await createEditor({
        historyOptions: { enabled: false },
    });
    await load(editor);
    const image = editor.getCanvas().getObjects()[0];
    const originalGetBoundingRect = image.getBoundingRect.bind(image);
    let failOnce = true;
    image.getBoundingRect = (...arguments_) => {
        if (failOnce) {
            failOnce = false;
            throw new Error('synthetic disabled-history transform failure');
        }
        return originalGetBoundingRect(...arguments_);
    };

    await assert.rejects(transform.scale(1.4), /synthetic disabled-history transform failure/u);
    assert.deepEqual(transform.getState(), {
        scale: 1,
        rotationDegrees: 0,
        flipX: false,
        flipY: false,
    });
    assert.equal(history.length, 0);
    await transform.scale(1.4);
    assert.equal(transform.getState().scale, 1.4);
    assert.equal(history.length, 0);
    await dispose(editor);
});

test('enable waits for an active mutation and captures its committed state', async () => {
    const { editor, extension, history } = await createEditor({
        historyOptions: { enabled: false },
        installBeforeHistory: (instance) => instance.use(controlledStatePlugin()),
    });
    const gate = { started: deferred(), release: deferred() };
    const mutation = extension.mutate(7, gate);
    await gate.started.promise;
    let enabled = false;
    const enabling = history.enable({ baseline: 'current' }).then(() => {
        enabled = true;
    });
    await Promise.resolve();
    assert.equal(enabled, false);

    gate.release.resolve();
    await mutation;
    await enabling;
    assert.equal(extension.getValue(), 7);
    assert.equal(history.isEnabled, true);
    assert.equal(history.length, 0);

    await extension.mutate(9);
    assert.equal(history.length, 1);
    await history.undo();
    assert.equal(extension.getValue(), 7);
    await dispose(editor);
});

test('disable waits for an active mutation and applies its clear policy atomically', async () => {
    const { editor, extension, history } = await createEditor({
        installBeforeHistory: (instance) => instance.use(controlledStatePlugin()),
    });
    const gate = { started: deferred(), release: deferred() };
    const mutation = extension.mutate(5, gate);
    await gate.started.promise;
    let disabled = false;
    const disabling = history.disable({ clear: true }).then(() => {
        disabled = true;
    });
    await Promise.resolve();
    assert.equal(disabled, false);

    gate.release.resolve();
    await mutation;
    await disabling;
    assert.equal(extension.getValue(), 5);
    assert.equal(history.isEnabled, false);
    assert.equal(history.length, 0);
    await dispose(editor);
});
