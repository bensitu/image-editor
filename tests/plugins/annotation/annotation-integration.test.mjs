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
