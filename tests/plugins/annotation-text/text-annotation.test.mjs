import assert from 'node:assert/strict';
import test from 'node:test';

import { ImageEditorCore } from '../../../src/core/index.js';
import { annotationFoundationPlugin } from '../../../src/foundations/annotation/index.js';
import { overlayFoundationPlugin } from '../../../src/foundations/overlay/index.js';
import { textAnnotationPlugin } from '../../../src/plugins/annotation-text/index.js';
import { cropPlugin } from '../../../src/plugins/crop/index.js';
import { historyPlugin } from '../../../src/plugins/history/index.js';
import { transformPlugin } from '../../../src/plugins/transform/index.js';
import { fabric, makeImageDataUrl, resetEditorDom } from '../../helpers/fabric-environment.mjs';

async function createEditor({ textOptions = {}, transform = false, crop = false } = {}) {
    const ids = resetEditorDom({ containerWidth: 360, containerHeight: 260 });
    const editor = new ImageEditorCore(fabric, { canvasWidth: 360, canvasHeight: 260 });
    const overlay = editor.use(overlayFoundationPlugin());
    const annotations = editor.use(annotationFoundationPlugin());
    const history = editor.use(historyPlugin());
    const text = editor.use(textAnnotationPlugin(textOptions));
    const transformApi = transform ? editor.use(transformPlugin({ animationDuration: 0 })) : null;
    const cropApi = crop ? editor.use(cropPlugin({ paddingPx: 0 })) : null;
    await editor.init({ canvas: ids.canvas, canvasContainer: ids.canvasContainer });
    return { annotations, cropApi, editor, history, ids, overlay, text, transformApi };
}

async function load(editor) {
    await editor.loadImage(makeImageDataUrl({ width: 140, height: 90 }));
}

async function dispose(editor) {
    await editor.disposeAsync();
    document.body.innerHTML = '';
}

function textObject(editor, id) {
    return editor
        .getCanvas()
        .getObjects()
        .find((object) => object.editorOverlayId === id);
}

function determinant(object) {
    const [a, b, c, d] = object.calcTransformMatrix();
    return a * d - b * c;
}

test('Text Annotation requires the Annotation Foundation', () => {
    const editor = new ImageEditorCore(fabric);
    assert.throws(() => editor.use(textAnnotationPlugin()), /foundation:annotation|dependency/i);
});

test('create applies validated typography, font fallback, identity, and metadata', async () => {
    const { annotations, editor, history, text } = await createEditor({
        textOptions: { fontFamily: 'Inter', fontFallbacks: ['Arial', 'sans-serif'] },
    });
    await assert.rejects(text.create(), /loaded image/i);
    await load(editor);
    const id = await text.create({
        text: 'Review this area',
        left: 24,
        top: 18,
        name: 'Caption',
        metadata: { role: 'review' },
    });
    const object = textObject(editor, id);
    assert.ok(object instanceof fabric.Textbox);
    assert.equal(object.fontFamily, 'Inter, Arial, sans-serif');
    assert.equal(object.text, 'Review this area');
    assert.equal(annotations.get(id).name, 'Caption');
    assert.deepEqual(annotations.get(id).metadata, { role: 'review' });
    assert.equal(history.length, 1);
    await dispose(editor);
});

test('editing preview is transient and commit or cancel uses exact History boundaries', async () => {
    const { editor, history, text } = await createEditor();
    await load(editor);
    const id = await text.create({ text: 'Before' });
    history.clear();
    const snapshot = editor.saveState();

    await text.beginEditing(id);
    const preview = editor
        .getCanvas()
        .getObjects()
        .find((object) => object.editorAnnotationPreviewOwner === 'annotation:text');
    assert.ok(preview instanceof fabric.Textbox);
    assert.equal(editor.saveState(), snapshot);
    assert.equal(history.length, 0);
    preview.set({ text: 'After' });
    await text.commitEditing();
    assert.equal(textObject(editor, id).text, 'After');
    assert.equal(history.length, 1);
    assert.equal(text.getEditingSession(), null);

    const committedSnapshot = editor.saveState();
    await text.beginEditing(id);
    const cancelledPreview = editor
        .getCanvas()
        .getObjects()
        .find((object) => object.editorAnnotationPreviewOwner === 'annotation:text');
    cancelledPreview.set({ text: 'Discarded' });
    await text.cancelEditing();
    assert.equal(textObject(editor, id).text, 'After');
    assert.equal(editor.saveState(), committedSnapshot);
    assert.equal(history.length, 1);
    await dispose(editor);
});

test('locked Text cannot edit and unlock restores approved interaction', async () => {
    const { annotations, editor, text } = await createEditor();
    await load(editor);
    const id = await text.create({ text: 'Locked', locked: true, editable: true });
    const object = textObject(editor, id);
    assert.equal(object.selectable, false);
    assert.equal(object.evented, false);
    assert.equal(object.editable, false);
    await assert.rejects(text.beginEditing(id), /Locked Text/i);
    await annotations.update(id, { locked: false });
    assert.equal(object.selectable, true);
    assert.equal(object.evented, true);
    assert.equal(object.editable, true);
    await dispose(editor);
});

test('configuration stays outside Snapshot and updates support undo and redo', async () => {
    const { editor, history, text } = await createEditor();
    await load(editor);
    const id = await text.create({ text: 'Initial' });
    const snapshot = editor.saveState();
    await text.configure({ fontSize: 36, fill: '#0066ff' });
    assert.equal(editor.saveState(), snapshot);
    assert.equal(text.getConfiguration().fontSize, 36);
    history.clear();
    await text.update(id, { text: 'Updated', width: 300, hidden: true });
    assert.equal(history.length, 1);
    assert.equal(textObject(editor, id).text, 'Updated');
    assert.equal(textObject(editor, id).visible, false);
    await history.undo();
    assert.equal(textObject(editor, id).text, 'Initial');
    assert.equal(textObject(editor, id).visible, true);
    await history.redo();
    assert.equal(textObject(editor, id).text, 'Updated');
    assert.equal(textObject(editor, id).visible, false);
    await dispose(editor);
});

test('preserve-readable removes reflection while mirror retains glyph reflection', async () => {
    const { editor, text, transformApi } = await createEditor({
        textOptions: {
            bindToImageTransform: true,
            reflectionBehavior: 'preserve-readable',
        },
        transform: true,
    });
    await load(editor);
    const id = await text.create({ text: 'Readable', left: 32, top: 24 });
    await transformApi.flipHorizontal();
    assert.ok(determinant(textObject(editor, id)) > 0);
    await transformApi.flipHorizontal();
    await text.configure({ reflectionBehavior: 'mirror' });
    await transformApi.flipHorizontal();
    assert.ok(determinant(textObject(editor, id)) < 0);
    await historySafeReset(transformApi);
    await dispose(editor);
});

async function historySafeReset(transformApi) {
    await transformApi.resetImageTransform();
}

test('State, export, flatten, and Crop use public Annotation and Overlay contracts', async () => {
    const { annotations, cropApi, editor, history, text } = await createEditor({ crop: true });
    await load(editor);
    const id = await text.create({ text: 'Crop me', left: 30, top: 20 });
    const snapshot = editor.saveState();
    await editor.loadFromState(snapshot);
    assert.equal(textObject(editor, id).text, 'Crop me');
    const exported = await editor.exportImageBase64({ area: 'canvas', format: 'png' });
    assert.match(exported, /^data:image\/png;base64,/);
    await cropApi.enter({ rect: { leftPx: 5, topPx: 5, widthPx: 100, heightPx: 70 } });
    await cropApi.apply({ format: 'png' });
    assert.ok(annotations.get(id));
    history.clear();
    await annotations.flatten({ kinds: ['annotation:text'] });
    assert.equal(annotations.get(id), null);
    assert.equal(history.length, 1);
    await dispose(editor);
});

test('switching to Crop cancels Text editing without committed state', async () => {
    const { cropApi, editor, history, text } = await createEditor({ crop: true });
    await load(editor);
    const id = await text.create({ text: 'Keep' });
    history.clear();
    const snapshot = editor.saveState();
    await text.beginEditing(id);
    await cropApi.enter();
    assert.equal(text.getEditingSession(), null);
    assert.equal(editor.saveState(), snapshot);
    assert.equal(history.length, 0);
    await cropApi.cancel();
    await dispose(editor);
});

test('Text limits reject oversized content and unsafe configuration without mutation', async () => {
    const { annotations, editor, text } = await createEditor();
    await load(editor);
    await assert.rejects(text.create({ text: 'x'.repeat(20_001) }), /at most 20000/i);
    await assert.rejects(text.configure({ fontSize: Number.POSITIVE_INFINITY }), /font size/i);
    await assert.rejects(text.configure({ fontFallbacks: ['__proto__\u0000'] }), /fallback/i);
    assert.deepEqual(annotations.list(), []);
    await dispose(editor);
});
