import assert from 'node:assert/strict';
import test from 'node:test';

import { ImageEditorCore } from '../../../src/core/index.js';
import { annotationFoundationPlugin } from '../../../src/foundations/annotation/index.js';
import { overlayFoundationPlugin } from '../../../src/foundations/overlay/index.js';
import { drawAnnotationPlugin } from '../../../src/plugins/annotation-draw/index.js';
import { shapeAnnotationPlugin } from '../../../src/plugins/annotation-shape/index.js';
import { textAnnotationPlugin } from '../../../src/plugins/annotation-text/index.js';
import { cropPlugin } from '../../../src/plugins/crop/index.js';
import { filtersPlugin } from '../../../src/plugins/filters/index.js';
import { historyPlugin } from '../../../src/plugins/history/index.js';
import { maskPlugin } from '../../../src/plugins/mask/index.js';
import { fabric, makeImageDataUrl, resetEditorDom } from '../../helpers/fabric-environment.mjs';

function appendEditorDom(suffix) {
    const canvasContainer = `annotation-container-${suffix}`;
    const canvas = `annotation-canvas-${suffix}`;
    document.body.insertAdjacentHTML(
        'beforeend',
        `<div id="${canvasContainer}"><canvas id="${canvas}"></canvas></div>`,
    );
    const container = document.getElementById(canvasContainer);
    Object.defineProperty(container, 'clientWidth', { configurable: true, value: 360 });
    Object.defineProperty(container, 'clientHeight', { configurable: true, value: 260 });
    return { canvas, canvasContainer };
}

async function initializeEditor(ids, options = {}) {
    const editor = new ImageEditorCore(fabric, { canvasWidth: 360, canvasHeight: 260 });
    const overlay = editor.use(overlayFoundationPlugin());
    const annotations = editor.use(annotationFoundationPlugin());
    const history = editor.use(historyPlugin({ enabled: options.historyEnabled ?? true }));
    const text = options.text ? editor.use(textAnnotationPlugin()) : null;
    const shape = options.shape ? editor.use(shapeAnnotationPlugin()) : null;
    const draw = options.draw ? editor.use(drawAnnotationPlugin()) : null;
    const masks = options.mask ? editor.use(maskPlugin({ label: false })) : null;
    const crop = options.crop ? editor.use(cropPlugin({ paddingPx: 0 })) : null;
    const filters = options.filters ? editor.use(filtersPlugin()) : null;
    await editor.init({ canvas: ids.canvas, canvasContainer: ids.canvasContainer });
    return { annotations, crop, draw, editor, filters, history, masks, overlay, shape, text };
}

async function createEditor(options = {}) {
    const ids = resetEditorDom({ containerWidth: 360, containerHeight: 260 });
    return initializeEditor(ids, options);
}

async function load(editor) {
    await editor.loadImage(makeImageDataUrl({ width: 160, height: 100 }));
}

async function dispose(...editors) {
    for (const editor of editors) await editor.disposeAsync();
    document.body.innerHTML = '';
}

async function createDrawStroke(draw) {
    await draw.enter();
    await draw.beginStroke({ x: 20, y: 72 });
    await draw.appendStroke({ x: 115, y: 62 });
    const id = await draw.endStroke();
    await draw.exit();
    return id;
}

function commitMoveGesture(editor, object, left, top) {
    const canvas = editor.getCanvas();
    canvas.fire('before:transform', { target: object, transform: { action: 'drag' } });
    object.set({ left, top });
    object.setCoords();
    canvas.fire('object:moving', { target: object });
    canvas.fire('object:modified', { target: object });
}

test('Foundation and every independent Annotation feature combination initialize cleanly', async () => {
    for (const featureSet of [[], ['text'], ['shape'], ['draw'], ['text', 'shape', 'draw']]) {
        const instance = await createEditor({
            text: featureSet.includes('text'),
            shape: featureSet.includes('shape'),
            draw: featureSet.includes('draw'),
        });
        await load(instance.editor);
        assert.deepEqual(instance.annotations.list(), []);
        assert.ok(instance.editor.getCanvas());
        await dispose(instance.editor);
    }
});

test('mixed Mask and Annotation selection, Crop, export, and flatten share Overlay authority', async () => {
    const instance = await createEditor({
        crop: true,
        draw: true,
        filters: true,
        mask: true,
        shape: true,
        text: true,
    });
    await load(instance.editor);
    const mask = await instance.masks.create({ left: 118, top: 16, width: 24, height: 20 });
    const textId = await instance.text.create({ text: 'Mixed', left: 20, top: 14 });
    const shapeId = await instance.shape.create({
        geometry: { kind: 'rect', left: 60, top: 28, width: 34, height: 24 },
    });
    const drawId = await createDrawStroke(instance.draw);

    instance.overlay.select([mask.maskUid, textId, shapeId]);
    assert.equal(instance.editor.getCanvas().getActiveObject()?.type, 'activeselection');
    assert.deepEqual(
        instance.annotations
            .list()
            .filter((entry) => entry.selected)
            .map((entry) => entry.id)
            .sort(),
        [shapeId, textId].sort(),
    );
    await instance.annotations.bringToFront(drawId);
    const snapshot = instance.editor.saveState();
    await instance.editor.loadFromState(snapshot);
    assert.equal(instance.annotations.list().length, 3);
    assert.ok(instance.masks.getAll().some((candidate) => candidate.maskUid === mask.maskUid));

    await instance.filters.commit([{ type: 'brightness', value: 0.05 }]);
    const exported = await instance.editor.exportImageBase64({ format: 'png' });
    assert.match(exported, /^data:image\/png;base64,/);
    await instance.crop.enter({ rect: { leftPx: 4, topPx: 4, widthPx: 145, heightPx: 88 } });
    await instance.crop.apply({ format: 'png' });
    assert.equal(instance.annotations.list().length, 3);

    instance.history.clear();
    await instance.annotations.flatten();
    assert.deepEqual(instance.annotations.list(), []);
    assert.ok(instance.masks.getAll().some((candidate) => candidate.maskUid === mask.maskUid));
    assert.equal(instance.history.length, 1);
    await dispose(instance.editor);
});

test('list selection keeps an overlapping Annotation as the canvas interaction target', async () => {
    const instance = await createEditor({ shape: true });
    await load(instance.editor);
    const geometry = { kind: 'rect', left: 40, top: 35, width: 64, height: 48 };
    const lowerId = await instance.shape.create({ geometry });
    const upperId = await instance.shape.create({ geometry });
    const lower = instance.overlay.getByPersistentId(lowerId);
    const upper = instance.overlay.getByPersistentId(upperId);
    const canvas = instance.editor.getCanvas();
    const layerOrder = canvas.getObjects().slice();

    await instance.annotations.select([lowerId]);
    Object.defineProperty(canvas.upperCanvasEl, 'getBoundingClientRect', {
        configurable: true,
        value: () => ({
            bottom: 260,
            height: 260,
            left: 0,
            right: 360,
            top: 0,
            width: 360,
        }),
    });
    const event = {
        altKey: false,
        clientX: 60,
        clientY: 55,
        target: canvas.upperCanvasEl,
        type: 'mousedown',
    };
    canvas._resetTransformEventData();

    assert.equal(canvas.getActiveObject(), lower);
    assert.equal(canvas.findTarget(event).target, lower);
    assert.deepEqual(canvas.getObjects(), layerOrder);
    assert.ok(canvas.getObjects().indexOf(lower) < canvas.getObjects().indexOf(upper));
    await dispose(instance.editor);
});

test('Mask and every Annotation object keep back-to-back transform History boundaries', async () => {
    const instance = await createEditor({
        draw: true,
        mask: true,
        shape: true,
        text: true,
    });
    await load(instance.editor);
    const mask = await instance.masks.create({ left: 118, top: 16, width: 24, height: 20 });
    const textId = await instance.text.create({ text: 'Gesture', left: 20, top: 14 });
    const shapeId = await instance.shape.create({
        geometry: { kind: 'rect', left: 60, top: 28, width: 34, height: 24 },
    });
    const drawId = await createDrawStroke(instance.draw);
    const entries = [mask.maskUid, textId, shapeId, drawId].map((id) => {
        const object = instance.overlay.getByPersistentId(id);
        assert.ok(object);
        return {
            id,
            start: { left: object.left, top: object.top },
            first: { left: object.left + 11, top: object.top + 7 },
            second: { left: object.left + 23, top: object.top + 15 },
        };
    });
    instance.history.clear();

    for (const entry of entries) {
        const object = instance.overlay.getByPersistentId(entry.id);
        commitMoveGesture(instance.editor, object, entry.first.left, entry.first.top);
        commitMoveGesture(instance.editor, object, entry.second.left, entry.second.top);
    }
    await instance.overlay.waitForIdle();
    assert.equal(instance.history.length, entries.length * 2);

    for (const entry of [...entries].reverse()) {
        await instance.history.undo();
        assert.deepEqual(
            {
                left: instance.overlay.getByPersistentId(entry.id).left,
                top: instance.overlay.getByPersistentId(entry.id).top,
            },
            entry.first,
        );
        await instance.history.undo();
        assert.deepEqual(
            {
                left: instance.overlay.getByPersistentId(entry.id).left,
                top: instance.overlay.getByPersistentId(entry.id).top,
            },
            entry.start,
        );
    }

    for (const entry of entries) {
        await instance.history.redo();
        assert.deepEqual(
            {
                left: instance.overlay.getByPersistentId(entry.id).left,
                top: instance.overlay.getByPersistentId(entry.id).top,
            },
            entry.first,
        );
        await instance.history.redo();
        assert.deepEqual(
            {
                left: instance.overlay.getByPersistentId(entry.id).left,
                top: instance.overlay.getByPersistentId(entry.id).top,
            },
            entry.second,
        );
    }
    await dispose(instance.editor);
});

test('Annotation authorities remain isolated across simultaneous editor instances', async () => {
    resetEditorDom({ containerWidth: 360, containerHeight: 260 });
    const first = await initializeEditor(appendEditorDom('first'), { text: true });
    const second = await initializeEditor(appendEditorDom('second'), { text: true });
    await Promise.all([load(first.editor), load(second.editor)]);
    const firstId = await first.text.create({ text: 'First instance' });
    assert.equal(first.annotations.list().length, 1);
    assert.deepEqual(second.annotations.list(), []);
    const secondId = await second.text.create({ text: 'Second instance' });
    assert.notEqual(firstId, secondId);
    assert.equal(first.annotations.get(secondId), null);
    assert.equal(second.annotations.get(firstId), null);
    await dispose(first.editor, second.editor);
});

test('all Annotation commits keep History disabled without weakening document mutation', async () => {
    const instance = await createEditor({
        draw: true,
        historyEnabled: false,
        shape: true,
        text: true,
    });
    await load(instance.editor);
    const textId = await instance.text.create({ text: 'No timeline' });
    const shapeId = await instance.shape.create({
        geometry: { kind: 'line', start: { x: 20, y: 20 }, end: { x: 100, y: 40 } },
    });
    const drawId = await createDrawStroke(instance.draw);
    await instance.annotations.update(textId, { name: 'Updated without History' });
    await instance.annotations.remove(shapeId);
    assert.ok(instance.annotations.get(textId));
    assert.ok(instance.annotations.get(drawId));
    assert.equal(instance.annotations.get(shapeId), null);
    assert.equal(instance.history.length, 0);
    await dispose(instance.editor);
});
