import assert from 'node:assert/strict';
import test from 'node:test';

import { ImageEditorCore } from '../../../src/core/index.js';
import { annotationFoundationPlugin } from '../../../src/foundations/annotation/index.js';
import { overlayFoundationPlugin } from '../../../src/foundations/overlay/index.js';
import { drawAnnotationPlugin } from '../../../src/plugins/annotation-draw/index.js';
import { shapeAnnotationPlugin } from '../../../src/plugins/annotation-shape/index.js';
import { textAnnotationPlugin } from '../../../src/plugins/annotation-text/index.js';
import { cropPlugin } from '../../../src/plugins/crop/index.js';
import { historyPlugin } from '../../../src/plugins/history/index.js';
import { maskPlugin } from '../../../src/plugins/mask/index.js';
import { transformPlugin } from '../../../src/plugins/transform/index.js';
import { fabric, makeImageDataUrl, resetEditorDom } from '../../helpers/fabric-environment.mjs';

async function createEditor({
    drawOptions = {},
    historyEnabled = true,
    text = false,
    shape = false,
    masks = false,
    crop = false,
    transform = false,
} = {}) {
    const ids = resetEditorDom({ containerWidth: 360, containerHeight: 260 });
    const editor = new ImageEditorCore(fabric, { canvasWidth: 360, canvasHeight: 260 });
    editor.use(overlayFoundationPlugin());
    const annotations = editor.use(annotationFoundationPlugin());
    const history = editor.use(historyPlugin({ enabled: historyEnabled, maxSize: 256 }));
    const masksApi = masks ? editor.use(maskPlugin({ label: false })) : null;
    const textApi = text ? editor.use(textAnnotationPlugin()) : null;
    const shapeApi = shape ? editor.use(shapeAnnotationPlugin()) : null;
    const draw = editor.use(drawAnnotationPlugin(drawOptions));
    const cropApi = crop ? editor.use(cropPlugin({ paddingPx: 0 })) : null;
    const transformApi = transform ? editor.use(transformPlugin({ animationDuration: 0 })) : null;
    await editor.init({ canvas: ids.canvas, canvasContainer: ids.canvasContainer });
    return {
        annotations,
        cropApi,
        draw,
        editor,
        history,
        ids,
        masksApi,
        shapeApi,
        textApi,
        transformApi,
    };
}

async function load(editor) {
    await editor.loadImage(makeImageDataUrl({ width: 160, height: 100 }));
}

async function dispose(editor) {
    await editor.disposeAsync();
    document.body.innerHTML = '';
}

function drawObject(editor, id) {
    return editor
        .getCanvas()
        .getObjects()
        .find((object) => object.editorOverlayId === id);
}

async function drawStroke(draw, start, end) {
    await draw.beginStroke(start);
    await draw.appendStroke(end);
    return draw.endStroke();
}

test('Draw Annotation requires the Annotation Foundation', () => {
    const editor = new ImageEditorCore(fabric);
    assert.throws(() => editor.use(drawAnnotationPlugin()), /foundation:annotation|dependency/i);
});

test('brush interpolation creates curved transient previews and persistent paths', async () => {
    const { annotations, draw, editor, history } = await createEditor({
        drawOptions: { brush: { interpolationSpacing: 3, color: '#ff0066', width: 6 } },
    });
    await load(editor);
    const snapshot = editor.saveState();
    await draw.enter();
    await draw.beginStroke({ x: 10, y: 15 });
    await draw.appendStroke({ x: 90, y: 50 });
    assert.ok(draw.getSession().pointCount > 2);
    assert.ok(
        editor
            .getCanvas()
            .getObjects()
            .some((object) => object.editorAnnotationPreviewOwner === 'annotation:draw'),
    );
    assert.equal(editor.saveState(), snapshot);
    assert.equal(history.length, 0);
    const firstId = await draw.endStroke();
    const first = drawObject(editor, firstId);
    assert.ok(first instanceof fabric.Path);
    assert.ok(first.path.some((command) => String(command[0]).toUpperCase() === 'Q'));
    assert.equal(first.stroke, '#ff0066');
    assert.equal(history.length, 1);

    const secondId = await drawStroke(draw, { x: 20, y: 80 }, { x: 120, y: 75 });
    assert.notEqual(firstId, secondId);
    assert.equal(annotations.list().length, 2);
    assert.equal(history.length, 2);
    await draw.exit();
    await dispose(editor);
});

test('cancel and non-meaningful strokes create zero History or committed state', async () => {
    const { annotations, draw, editor, history } = await createEditor();
    await load(editor);
    await draw.enter();
    await draw.beginStroke({ x: 20, y: 20 });
    await draw.cancelStroke();
    assert.equal(history.length, 0);
    assert.deepEqual(annotations.list(), []);
    await draw.beginStroke({ x: 30, y: 30 });
    assert.equal(await draw.endStroke(), null);
    assert.equal(history.length, 0);
    assert.deepEqual(annotations.list(), []);
    await draw.exit();
    await dispose(editor);
});

test('Eraser whole-object semantics remove Draw only and preserve every non-Draw target', async () => {
    const { annotations, draw, editor, history, masksApi, shapeApi, textApi } = await createEditor({
        masks: true,
        shape: true,
        text: true,
    });
    await load(editor);
    const mask = await masksApi.create({ left: 30, top: 20, width: 30, height: 20 });
    const textId = await textApi.create({ text: 'Protected', left: 20, top: 15 });
    const shapeId = await shapeApi.create({
        geometry: { kind: 'line', start: { x: 10, y: 20 }, end: { x: 100, y: 20 } },
    });
    await draw.enter();
    const erasedId = await drawStroke(draw, { x: 10, y: 20 }, { x: 100, y: 20 });
    const retainedId = await drawStroke(draw, { x: 10, y: 75 }, { x: 110, y: 75 });
    history.clear();
    await draw.setSubMode('erase');
    await draw.beginStroke({ x: 48, y: 20 });
    await draw.appendStroke({ x: 55, y: 20 });
    assert.equal(await draw.endStroke(), null);
    assert.equal(annotations.get(erasedId), null);
    assert.ok(annotations.get(retainedId));
    assert.ok(annotations.get(textId));
    assert.ok(annotations.get(shapeId));
    assert.ok(masksApi.getAll().some((candidate) => candidate.maskUid === mask.maskUid));
    assert.equal(editor.getCanvas().getObjects()[0].editorObjectKind, 'baseImage');
    assert.equal(history.length, 1);
    await history.undo();
    assert.ok(annotations.get(erasedId));
    await history.redo();
    assert.equal(annotations.get(erasedId), null);
    await draw.exit();
    await dispose(editor);
});

test('Eraser no-op and locked or hidden Draw objects produce zero History', async () => {
    const { annotations, draw, editor, history } = await createEditor();
    await load(editor);
    await draw.enter();
    const lockedId = await drawStroke(draw, { x: 20, y: 30 }, { x: 100, y: 30 });
    await annotations.update(lockedId, { locked: true });
    history.clear();
    await draw.setSubMode('erase');
    await draw.beginStroke({ x: 45, y: 30 });
    await draw.appendStroke({ x: 55, y: 30 });
    await draw.endStroke();
    assert.ok(annotations.get(lockedId));
    assert.equal(history.length, 0);
    await draw.beginStroke({ x: 130, y: 90 });
    await draw.appendStroke({ x: 150, y: 90 });
    await draw.endStroke();
    assert.equal(history.length, 0);
    await draw.exit();
    await dispose(editor);
});

test('configuration is bounded, immutable, and cannot change an active stroke', async () => {
    const { draw, editor } = await createEditor();
    await load(editor);
    await draw.configureBrush({ width: 12, lineCap: 'square', maxPointCount: 4 });
    await draw.configureEraser({ radius: 18, previewFill: 'rgba(255,0,0,0.2)' });
    assert.equal(draw.getConfiguration().brush.width, 12);
    assert.equal(draw.getConfiguration().eraser.radius, 18);
    await draw.enter();
    await draw.beginStroke({ x: 10, y: 10 });
    await assert.rejects(draw.configureBrush({ width: 3 }), /active Draw stroke/i);
    await assert.rejects(draw.appendStroke({ x: 100, y: 10 }), /point limit/i);
    await draw.cancelStroke();
    await assert.rejects(draw.configureEraser({ radius: Number.POSITIVE_INFINITY }), /radius/i);
    await draw.exit();
    await dispose(editor);
});

test('Draw transform binding, Snapshot, export, flatten, and Crop remain transactional', async () => {
    const { annotations, cropApi, draw, editor, history, transformApi } = await createEditor({
        crop: true,
        drawOptions: { brush: { bindToImageTransform: true } },
        transform: true,
    });
    await load(editor);
    await draw.enter();
    const id = await drawStroke(draw, { x: 20, y: 20 }, { x: 100, y: 60 });
    await draw.exit();
    const identity = drawObject(editor, id);
    const beforeMatrix = identity.calcTransformMatrix();
    await transformApi.scale(1.2);
    await transformApi.rotate(25);
    assert.equal(drawObject(editor, id), identity);
    assert.notDeepEqual(identity.calcTransformMatrix(), beforeMatrix);
    const snapshot = editor.saveState();
    await editor.loadFromState(snapshot);
    assert.ok(drawObject(editor, id).editorDrawPoints.length > 2);
    const exported = await editor.exportImageBase64({ format: 'png' });
    assert.match(exported, /^data:image\/png;base64,/);
    await cropApi.enter({ rect: { leftPx: 5, topPx: 5, widthPx: 120, heightPx: 80 } });
    await cropApi.apply({ format: 'png' });
    assert.ok(annotations.get(id));
    history.clear();
    await annotations.flatten({ kinds: ['annotation:draw'] });
    assert.equal(annotations.get(id), null);
    assert.equal(history.length, 1);
    await dispose(editor);
});

test('high object counts keep deterministic Draw-only Eraser isolation', async () => {
    const { annotations, draw, editor } = await createEditor({
        historyEnabled: false,
        drawOptions: { brush: { width: 1 }, eraser: { radius: 1 } },
    });
    await load(editor);
    await draw.enter();
    const ids = [];
    for (let index = 0; index < 80; index += 1) {
        ids.push(await drawStroke(draw, { x: 5, y: 5 + index * 4 }, { x: 15, y: 5 + index * 4 }));
    }
    await draw.setSubMode('erase');
    await draw.beginStroke({ x: 10, y: 321 });
    await draw.appendStroke({ x: 12, y: 321 });
    await draw.endStroke();
    assert.equal(annotations.list().length, 79);
    assert.equal(annotations.get(ids[79]), null);
    assert.ok(annotations.get(ids[0]));
    await draw.exit();
    await dispose(editor);
});

test('switching Tools and image replacement clean Draw previews and sessions', async () => {
    const { draw, editor, history, shapeApi } = await createEditor({ shape: true });
    await load(editor);
    const snapshot = editor.saveState();
    await draw.enter();
    await draw.beginStroke({ x: 10, y: 10 });
    await draw.appendStroke({ x: 60, y: 40 });
    await shapeApi.enter({ kind: 'rect' });
    assert.equal(draw.getSession(), null);
    assert.equal(editor.saveState(), snapshot);
    assert.equal(history.length, 0);
    await shapeApi.cancel();
    await draw.enter();
    await draw.beginStroke({ x: 20, y: 20 });
    await editor.loadImage(makeImageDataUrl({ width: 100, height: 70 }));
    assert.equal(draw.getSession(), null);
    assert.deepEqual(
        editor
            .getCanvas()
            .getObjects()
            .filter((object) => object.editorAnnotationPreviewOwner === 'annotation:draw'),
        [],
    );
    await dispose(editor);
});

test('History-disabled Draw and Eraser commits retain zero timeline records', async () => {
    const { annotations, draw, editor, history } = await createEditor({
        historyEnabled: false,
    });
    await load(editor);
    await draw.enter();
    const id = await drawStroke(draw, { x: 10, y: 20 }, { x: 100, y: 20 });
    assert.equal(history.length, 0);
    await draw.setSubMode('erase');
    await draw.beginStroke({ x: 45, y: 20 });
    await draw.appendStroke({ x: 55, y: 20 });
    await draw.endStroke();
    assert.equal(annotations.get(id), null);
    assert.equal(history.length, 0);
    await draw.exit();
    await dispose(editor);
});
