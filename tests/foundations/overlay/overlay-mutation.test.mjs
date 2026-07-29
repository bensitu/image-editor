import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';

import { ImageEditorCore, definePluginRef } from '../../../src/core/index.js';
import {
    OverlayRecoverableObjectError,
    overlayFoundationPlugin,
} from '../../../src/foundations/overlay/index.js';
import { historyPlugin } from '../../../src/plugins/history/index.js';
import { transformPlugin } from '../../../src/plugins/transform/index.js';
import { fabric, makeImageDataUrl, resetEditorDom } from '../../helpers/fabric-environment.mjs';

const TEST_KIND = 'example-test:gesture-rect';
const TEST_OWNER = 'example-test:gesture-plugin';

async function createEditor({ onDocumentCommitted, transform = false } = {}) {
    const ids = resetEditorDom({ containerWidth: 320, containerHeight: 240 });
    const warnings = [];
    const errors = [];
    const editor = new ImageEditorCore(fabric, {
        canvasWidth: 320,
        canvasHeight: 240,
        onWarning: (error, message) => warnings.push({ error, message }),
        onError: (error, message) => errors.push({ error, message }),
    });
    const overlay = editor.use(overlayFoundationPlugin());
    const history = editor.use(historyPlugin());
    const committed = [];
    const geometryCommitted = [];
    editor.use({
        ref: definePluginRef('example-test:overlay-mutation-observer', '1.0.0'),
        version: '1.0.0',
        setupMode: 'sync',
        setup(context) {
            context.events.on('document:committed', (descriptor) => {
                committed.push(descriptor);
                return onDocumentCommitted?.(descriptor);
            });
            context.events.on('geometry:committed', (descriptor) =>
                geometryCommitted.push(descriptor),
            );
            return Object.freeze({ committed, geometryCommitted });
        },
    });
    const transforms = transform ? editor.use(transformPlugin({ animationDuration: 0 })) : null;
    registerRectKind(overlay);
    await editor.init({ canvas: ids.canvas, canvasContainer: ids.canvasContainer });
    await editor.loadImage(makeImageDataUrl({ width: 120, height: 80 }));
    history.clear();
    committed.length = 0;
    geometryCommitted.length = 0;
    return { committed, editor, errors, geometryCommitted, history, overlay, transforms, warnings };
}

function registerRectKind(overlay) {
    overlay.registerKind({
        id: TEST_KIND,
        ownerPluginId: TEST_OWNER,
        classify: (object) => object.editorOverlayKind === TEST_KIND,
        getPersistentId: (object) => object.editorOverlayId ?? null,
        setPersistentId: (object, id) => {
            object.editorOverlayId = id;
        },
        persistence: {
            mode: 'persistent',
            codec: {
                type: TEST_KIND,
                version: '1.0.0',
                serialize: (object) => ({
                    left: object.left,
                    top: object.top,
                    width: object.width,
                    height: object.height,
                    scaleX: object.scaleX,
                    scaleY: object.scaleY,
                    angle: object.angle,
                    fill: object.fill,
                }),
                validate: (value) =>
                    value !== null &&
                    typeof value === 'object' &&
                    Number.isFinite(value.left) &&
                    Number.isFinite(value.top) &&
                    Number.isFinite(value.width) &&
                    Number.isFinite(value.height),
                deserialize: (value, context) => new context.fabric.Rect(value),
            },
        },
    });
}

function addRect(editor, id, options = {}) {
    const rect = new fabric.Rect({
        left: 20,
        top: 18,
        width: 30,
        height: 24,
        fill: '#ff3366',
        ...options,
    });
    rect.editorOverlayKind = TEST_KIND;
    rect.editorOverlayId = id;
    editor.getCanvas().add(rect);
    return rect;
}

test('programmatic insertion rejects unregistered objects before commit', async () => {
    const { committed, editor, history, overlay } = await createEditor();
    const before = editor.saveState();
    const unregistered = new fabric.Rect({ width: 20, height: 12 });

    await assert.rejects(overlay.add([unregistered]), /registered persistent kinds/u);
    assert.equal(editor.saveState(), before);
    assert.equal(history.getState().size, 0);
    assert.equal(committed.length, 0);

    const registered = new fabric.Rect({ width: 20, height: 12 });
    registered.editorOverlayKind = TEST_KIND;
    registered.editorOverlayId = 'rect:inserted';
    await overlay.add([registered]);
    assert.equal(overlay.getByPersistentId('rect:inserted'), registered);
    assert.equal(history.getState().size, 1);
    assert.equal(committed.length, 1);

    await editor.disposeAsync();
});

function beginGesture(editor, target, action) {
    editor.getCanvas().fire('before:transform', { target, transform: { action } });
}

function previewGesture(editor, target, eventName) {
    editor.getCanvas().fire(eventName, { target });
}

function endGesture(editor, target) {
    editor.getCanvas().fire('object:modified', { target });
}

async function dispose(editor) {
    await editor.disposeAsync();
    document.body.innerHTML = '';
}

function createDeferred() {
    let resolve;
    let reject;
    const promise = new Promise((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
    });
    return { promise, reject, resolve };
}

test('move, scale, and rotate previews commit one transaction only at gesture end', async (t) => {
    for (const scenario of [
        {
            name: 'move',
            action: 'drag',
            eventName: 'object:moving',
            apply: (rect) => rect.set({ left: 71, top: 63 }),
        },
        {
            name: 'scale',
            action: 'scale',
            eventName: 'object:scaling',
            apply: (rect) => rect.set({ scaleX: 1.7, scaleY: 1.4 }),
        },
        {
            name: 'rotate',
            action: 'rotate',
            eventName: 'object:rotating',
            apply: (rect) => rect.set({ angle: 47 }),
        },
    ]) {
        await t.test(scenario.name, async () => {
            const { committed, editor, history, overlay } = await createEditor();
            const rect = addRect(editor, `rect:${scenario.name}`);
            overlay.select([rect.editorOverlayId]);
            beginGesture(editor, rect, scenario.action);
            scenario.apply(rect);
            previewGesture(editor, rect, scenario.eventName);
            assert.equal(history.getState().size, 0);
            assert.equal(committed.length, 0);

            endGesture(editor, rect);
            await overlay.waitForIdle();

            assert.equal(history.getState().size, 1);
            assert.equal(committed.length, 1);
            assert.equal(committed[0].result.action, scenario.name);
            assert.deepEqual(committed[0].result.objectIds, [rect.editorOverlayId]);
            await dispose(editor);
        });
    }
});

test('back-to-back gestures preserve independent History boundaries', async () => {
    const { editor, history, overlay } = await createEditor();
    const rect = addRect(editor, 'rect:back-to-back', { left: 10, top: 10 });

    beginGesture(editor, rect, 'drag');
    rect.set({ left: 71, top: 63 });
    previewGesture(editor, rect, 'object:moving');
    endGesture(editor, rect);

    beginGesture(editor, rect, 'drag');
    rect.set({ left: 200, top: 150 });
    previewGesture(editor, rect, 'object:moving');
    endGesture(editor, rect);

    await overlay.waitForIdle();
    assert.equal(history.getState().size, 2);
    assert.equal(history.canUndo(), true);

    await history.undo();
    assert.equal(overlay.getByPersistentId('rect:back-to-back').left, 71);
    assert.equal(overlay.getByPersistentId('rect:back-to-back').top, 63);
    await history.undo();
    assert.equal(overlay.getByPersistentId('rect:back-to-back').left, 10);
    assert.equal(overlay.getByPersistentId('rect:back-to-back').top, 10);
    assert.equal(history.canUndo(), false);

    await history.redo();
    assert.equal(overlay.getByPersistentId('rect:back-to-back').left, 71);
    assert.equal(overlay.getByPersistentId('rect:back-to-back').top, 63);
    await history.redo();
    assert.equal(overlay.getByPersistentId('rect:back-to-back').left, 200);
    assert.equal(overlay.getByPersistentId('rect:back-to-back').top, 150);
    await dispose(editor);
});

test('mixed back-to-back transforms preserve every History boundary', async () => {
    const { editor, history, overlay } = await createEditor();
    const id = 'rect:mixed-transforms';
    const rect = addRect(editor, id, { left: 10, top: 10 });
    const initial = {
        left: 10,
        top: 10,
        scaleX: 1,
        scaleY: 1,
        angle: 0,
    };
    const steps = [
        {
            action: 'drag',
            eventName: 'object:moving',
            patch: { left: 71, top: 63 },
        },
        {
            action: 'drag',
            eventName: 'object:moving',
            patch: { left: 90, top: 75 },
        },
        {
            action: 'scale',
            eventName: 'object:scaling',
            patch: { scaleX: 1.5, scaleY: 1.25 },
        },
        {
            action: 'scale',
            eventName: 'object:scaling',
            patch: { scaleX: 2, scaleY: 0.8 },
        },
        {
            action: 'rotate',
            eventName: 'object:rotating',
            patch: { angle: 35 },
        },
        {
            action: 'rotate',
            eventName: 'object:rotating',
            patch: { angle: 80 },
        },
        {
            action: 'drag',
            eventName: 'object:moving',
            patch: { left: 120, top: 95 },
        },
    ];
    const expected = [];
    let state = initial;

    for (const step of steps) {
        beginGesture(editor, rect, step.action);
        rect.set(step.patch);
        previewGesture(editor, rect, step.eventName);
        endGesture(editor, rect);
        state = { ...state, ...step.patch };
        expected.push(state);
    }

    await overlay.waitForIdle();
    assert.equal(history.getState().size, steps.length);

    for (let index = expected.length - 1; index >= 0; index -= 1) {
        await history.undo();
        const restored = overlay.getByPersistentId(id);
        assert.deepEqual(
            {
                left: restored.left,
                top: restored.top,
                scaleX: restored.scaleX,
                scaleY: restored.scaleY,
                angle: restored.angle,
            },
            index === 0 ? initial : expected[index - 1],
        );
    }

    for (const expectedState of expected) {
        await history.redo();
        const restored = overlay.getByPersistentId(id);
        assert.deepEqual(
            {
                left: restored.left,
                top: restored.top,
                scaleX: restored.scaleX,
                scaleY: restored.scaleY,
                angle: restored.angle,
            },
            expectedState,
        );
    }
    await dispose(editor);
});

test('repeated before:transform events remain idempotent within one gesture', async () => {
    const { committed, editor, errors, history, overlay } = await createEditor();
    const rect = addRect(editor, 'rect:idempotent', { left: 10, top: 10 });

    beginGesture(editor, rect, 'drag');
    beginGesture(editor, rect, 'drag');
    rect.set({ left: 71, top: 63 });
    previewGesture(editor, rect, 'object:moving');
    endGesture(editor, rect);
    await overlay.waitForIdle();

    assert.equal(history.getState().size, 1);
    assert.equal(committed.length, 1);
    assert.deepEqual(errors, []);
    await dispose(editor);
});

test('slow committed observers do not retain the input gesture slot', async () => {
    const observerStarted = createDeferred();
    const releaseObserver = createDeferred();
    let observerCount = 0;
    const { editor, errors, history, overlay } = await createEditor({
        onDocumentCommitted: async () => {
            observerCount += 1;
            if (observerCount !== 1) return;
            observerStarted.resolve();
            await releaseObserver.promise;
        },
    });
    const id = 'rect:slow-observer';
    const rect = addRect(editor, id, { left: 10, top: 10 });

    beginGesture(editor, rect, 'drag');
    rect.set({ left: 71, top: 63 });
    previewGesture(editor, rect, 'object:moving');
    endGesture(editor, rect);
    await observerStarted.promise;
    assert.equal(history.getState().size, 1);

    beginGesture(editor, rect, 'drag');
    rect.set({ left: 200, top: 150 });
    previewGesture(editor, rect, 'object:moving');
    endGesture(editor, rect);
    releaseObserver.resolve();
    await overlay.waitForIdle();

    assert.equal(history.getState().size, 2);
    assert.deepEqual(errors, []);
    await history.undo();
    assert.equal(overlay.getByPersistentId(id).left, 71);
    assert.equal(overlay.getByPersistentId(id).top, 63);
    await dispose(editor);
});

test('repeated gesture targets are idempotent while changed targets abort', async () => {
    const { committed, editor, history, overlay } = await createEditor();
    const first = addRect(editor, 'rect:gesture:first');
    const second = addRect(editor, 'rect:gesture:second');

    beginGesture(editor, first, 'drag');
    const transaction = overlay.waitForIdle();
    beginGesture(editor, first, 'drag');
    beginGesture(editor, second, 'drag');

    await assert.rejects(transaction, /superseded by another target/u);
    assert.equal(history.getState().size, 0);
    assert.equal(committed.length, 0);
    await dispose(editor);
});

test('programmatic delete commits once and keeps the overlay index coherent', async () => {
    const { committed, editor, history, overlay } = await createEditor();
    addRect(editor, 'rect:delete');

    await overlay.remove(['rect:delete']);

    assert.equal(overlay.getByPersistentId('rect:delete'), null);
    assert.equal(history.getState().size, 1);
    assert.equal(committed.length, 1);
    assert.equal(committed[0].result.action, 'delete');
    await dispose(editor);
});

test('cancel restores the before state with zero History and zero committed event', async () => {
    const { committed, editor, history, overlay } = await createEditor();
    const rect = addRect(editor, 'rect:cancel', { left: 31, top: 29 });
    overlay.select(['rect:cancel']);
    beginGesture(editor, rect, 'drag');
    rect.set({ left: 130, top: 111 });
    previewGesture(editor, rect, 'object:moving');

    await overlay.cancelActiveGesture();

    const restored = overlay.getByPersistentId('rect:cancel');
    assert.ok(restored);
    assert.equal(restored.left, 31);
    assert.equal(restored.top, 29);
    assert.deepEqual(overlay.getSelection().ids, ['rect:cancel']);
    assert.equal(history.getState().size, 0);
    assert.equal(committed.length, 0);
    await dispose(editor);
});

test('fatal policy failure rolls back while a recoverable object failure still commits', async (t) => {
    await t.test('fatal', async () => {
        const { committed, editor, errors, history, overlay, warnings } = await createEditor();
        const rect = addRect(editor, 'rect:fatal', { left: 22 });
        overlay.registerInteractionPolicy({
            id: 'example-test:fatal-policy',
            kind: TEST_KIND,
            ownerPluginId: TEST_OWNER,
            synchronize: () => {
                throw new Error('synthetic fatal overlay policy failure');
            },
        });
        beginGesture(editor, rect, 'drag');
        rect.set({ left: 91 });
        previewGesture(editor, rect, 'object:moving');
        endGesture(editor, rect);

        await assert.rejects(overlay.waitForIdle(), /synthetic fatal overlay policy failure/);
        assert.equal(overlay.getByPersistentId('rect:fatal').left, 22);
        assert.equal(history.getState().size, 0);
        assert.equal(committed.length, 0);
        assert.equal(warnings.length, 0);
        assert.ok(
            errors.some(({ error }) =>
                /synthetic fatal overlay policy failure/.test(
                    error.cause?.message ?? error.message,
                ),
            ),
        );
        await dispose(editor);
    });

    await t.test('recoverable', async () => {
        const { committed, editor, history, overlay, warnings } = await createEditor();
        const rect = addRect(editor, 'rect:recoverable', { left: 22 });
        overlay.registerInteractionPolicy({
            id: 'example-test:recoverable-policy',
            kind: TEST_KIND,
            ownerPluginId: TEST_OWNER,
            synchronize: () => {
                throw new OverlayRecoverableObjectError(
                    'synthetic recoverable overlay policy failure',
                );
            },
        });
        beginGesture(editor, rect, 'drag');
        rect.set({ left: 91 });
        previewGesture(editor, rect, 'object:moving');
        endGesture(editor, rect);
        await overlay.waitForIdle();

        assert.equal(overlay.getByPersistentId('rect:recoverable'), rect);
        assert.equal(rect.left, 91);
        assert.equal(history.getState().size, 1);
        assert.equal(committed.length, 1);
        assert.ok(warnings.some(({ message }) => /recoverable overlay/.test(message)));
        await dispose(editor);
    });
});

test('a failed second gesture rolls back only its sealed boundary', async () => {
    const { committed, editor, history, overlay } = await createEditor();
    const id = 'rect:second-failure';
    const rect = addRect(editor, id, { left: 10, top: 10 });
    let synchronizeCount = 0;
    overlay.registerInteractionPolicy({
        id: 'example-test:second-gesture-failure',
        kind: TEST_KIND,
        ownerPluginId: TEST_OWNER,
        synchronize: () => {
            synchronizeCount += 1;
            if (synchronizeCount === 2) {
                throw new Error('synthetic second gesture failure');
            }
        },
    });

    beginGesture(editor, rect, 'drag');
    rect.set({ left: 71, top: 63 });
    previewGesture(editor, rect, 'object:moving');
    endGesture(editor, rect);
    beginGesture(editor, rect, 'drag');
    rect.set({ left: 200, top: 150 });
    previewGesture(editor, rect, 'object:moving');
    endGesture(editor, rect);

    await assert.rejects(overlay.waitForIdle(), /synthetic second gesture failure/u);
    const restored = overlay.getByPersistentId(id);
    assert.equal(restored.left, 71);
    assert.equal(restored.top, 63);
    assert.equal(history.getState().size, 1);
    assert.equal(committed.length, 1);
    await dispose(editor);
});

test('a failed earlier gesture cancels queued commits without leaving unrecorded state', async () => {
    const { committed, editor, history, overlay } = await createEditor();
    const id = 'rect:earlier-failure';
    let rect = addRect(editor, id, { left: 10, top: 10 });
    let synchronizeCount = 0;
    overlay.registerInteractionPolicy({
        id: 'example-test:earlier-gesture-failure',
        kind: TEST_KIND,
        ownerPluginId: TEST_OWNER,
        synchronize: () => {
            synchronizeCount += 1;
            if (synchronizeCount === 1) {
                throw new Error('synthetic earlier gesture failure');
            }
        },
    });

    beginGesture(editor, rect, 'drag');
    rect.set({ left: 71, top: 63 });
    previewGesture(editor, rect, 'object:moving');
    endGesture(editor, rect);
    beginGesture(editor, rect, 'drag');
    rect.set({ left: 200, top: 150 });
    previewGesture(editor, rect, 'object:moving');
    endGesture(editor, rect);

    await assert.rejects(overlay.waitForIdle(), /synthetic earlier gesture failure/u);
    rect = overlay.getByPersistentId(id);
    assert.equal(rect.left, 10);
    assert.equal(rect.top, 10);
    assert.equal(history.getState().size, 0);
    assert.equal(committed.length, 0);

    beginGesture(editor, rect, 'drag');
    rect.set({ left: 55, top: 45 });
    previewGesture(editor, rect, 'object:moving');
    endGesture(editor, rect);
    await overlay.waitForIdle();
    assert.equal(history.getState().size, 1);
    assert.equal(overlay.getByPersistentId(id).left, 55);
    assert.equal(overlay.getByPersistentId(id).top, 45);
    await dispose(editor);
});

test('ActiveSelection transforms two and many objects as one atomic gesture', async (t) => {
    for (const count of [2, 6]) {
        await t.test(`${count} objects`, async () => {
            const { committed, editor, history, overlay } = await createEditor();
            const rects = Array.from({ length: count }, (_, index) =>
                addRect(editor, `rect:group:${index}`, { left: 20 + index * 35 }),
            );
            overlay.select(rects.map((rect) => rect.editorOverlayId));
            const selection = editor.getCanvas().getActiveObject();
            beginGesture(editor, selection, 'drag');
            rects.forEach((rect, index) => rect.set({ top: 40 + index }));
            previewGesture(editor, selection, 'object:moving');
            assert.equal(history.getState().size, 0);
            endGesture(editor, selection);
            await overlay.waitForIdle();

            assert.equal(history.getState().size, 1);
            assert.equal(committed.length, 1);
            assert.deepEqual(
                new Set(committed[0].result.objectIds),
                new Set(rects.map((rect) => rect.editorOverlayId)),
            );
            assert.deepEqual(
                new Set(overlay.getSelection().ids),
                new Set(rects.map((rect) => rect.editorOverlayId)),
            );
            await dispose(editor);
        });
    }
});

test('parent Geometry mutation produces no nested Overlay History or event', async () => {
    const { committed, editor, geometryCommitted, history, overlay, transforms } =
        await createEditor({ transform: true });
    addRect(editor, 'rect:geometry', { left: 41, top: 37 });

    await transforms.rotate(35);

    assert.equal(history.getState().size, 1);
    assert.equal(geometryCommitted.length, 1);
    assert.equal(committed.length, 0);
    assert.equal(overlay.getByPersistentId('rect:geometry').editorOverlayId, 'rect:geometry');
    await dispose(editor);
});

test('dispose during a gesture aborts the transaction before releasing Core state', async () => {
    const { committed, editor, overlay } = await createEditor();
    const rect = addRect(editor, 'rect:dispose', { left: 28 });
    beginGesture(editor, rect, 'drag');
    rect.set({ left: 109 });
    previewGesture(editor, rect, 'object:moving');
    const gesture = overlay.waitForIdle();

    await editor.disposeAsync();

    await assert.rejects(gesture, /disposed|aborted/i);
    assert.equal(committed.length, 0);
    document.body.innerHTML = '';
});

test('Overlay Foundation is the only official Feature Fabric transform and History route', async () => {
    const [foundationSource, maskSource] = await Promise.all([
        fs.readFile(
            new URL(
                '../../../src/foundations/overlay/overlay-foundation-controller.ts',
                import.meta.url,
            ),
            'utf8',
        ),
        fs.readFile(
            new URL('../../../src/plugins/mask/mask-controller.ts', import.meta.url),
            'utf8',
        ),
    ]);

    for (const eventName of [
        'object:moving',
        'object:scaling',
        'object:rotating',
        'object:modified',
    ]) {
        assert.match(foundationSource, new RegExp(`canvas\\.on\\('${eventName}'`));
        assert.doesNotMatch(maskSource, new RegExp(eventName));
    }
    assert.doesNotMatch(maskSource, /captureHistoryRecord|commitHistory|mementos\.capture/);
});
