import assert from 'node:assert/strict';
import test from 'node:test';

import { ImageEditorCore } from '../../../src/core/index.js';
import { annotationFoundationPlugin } from '../../../src/foundations/annotation/index.js';
import { overlayFoundationPlugin } from '../../../src/foundations/overlay/index.js';
import { shapeAnnotationPlugin } from '../../../src/plugins/annotation-shape/index.js';
import { cropPlugin } from '../../../src/plugins/crop/index.js';
import { historyPlugin } from '../../../src/plugins/history/index.js';
import { mosaicPlugin } from '../../../src/plugins/mosaic/index.js';
import { transformPlugin } from '../../../src/plugins/transform/index.js';
import { fabric, makeImageDataUrl, resetEditorDom } from '../../helpers/fabric-environment.mjs';

async function createEditor({
    shapeOptions = {},
    transform = false,
    crop = false,
    mosaic = false,
    historyEnabled = true,
} = {}) {
    const ids = resetEditorDom({ containerWidth: 360, containerHeight: 260 });
    const editor = new ImageEditorCore(fabric, { canvasWidth: 360, canvasHeight: 260 });
    editor.use(overlayFoundationPlugin());
    const annotations = editor.use(annotationFoundationPlugin());
    const history = editor.use(historyPlugin({ enabled: historyEnabled }));
    const shapes = editor.use(shapeAnnotationPlugin(shapeOptions));
    const transformApi = transform ? editor.use(transformPlugin({ animationDuration: 0 })) : null;
    const cropApi = crop ? editor.use(cropPlugin({ paddingPx: 0 })) : null;
    const mosaicApi = mosaic ? editor.use(mosaicPlugin()) : null;
    await editor.init({ canvas: ids.canvas, canvasContainer: ids.canvasContainer });
    return { annotations, cropApi, editor, history, ids, mosaicApi, shapes, transformApi };
}

async function load(editor) {
    await editor.loadImage(makeImageDataUrl({ width: 140, height: 90 }));
}

function shapeObject(editor, id) {
    return editor
        .getCanvas()
        .getObjects()
        .find((object) => object.editorOverlayId === id);
}

async function dispose(editor) {
    await editor.disposeAsync();
    document.body.innerHTML = '';
}

test('Shape Annotation requires the Annotation Foundation', () => {
    const editor = new ImageEditorCore(fabric);
    assert.throws(() => editor.use(shapeAnnotationPlugin()), /foundation:annotation|dependency/i);
});

test('direct creation supports rect, line, and arrow with stable semantic geometry', async () => {
    const { annotations, editor, history, shapes } = await createEditor();
    await load(editor);
    const rectId = await shapes.create({
        geometry: { kind: 'rect', left: 12, top: 14, width: 40, height: 24 },
        name: 'Rectangle',
    });
    const lineId = await shapes.create({
        geometry: { kind: 'line', start: { x: 20, y: 60 }, end: { x: 90, y: 62 } },
    });
    const arrowId = await shapes.create({
        geometry: { kind: 'arrow', start: { x: 24, y: 72 }, end: { x: 110, y: 30 } },
        arrowHeadLength: 14,
    });
    assert.ok(shapeObject(editor, rectId) instanceof fabric.Rect);
    assert.ok(shapeObject(editor, lineId) instanceof fabric.Line);
    assert.ok(shapeObject(editor, arrowId) instanceof fabric.Path);
    assert.deepEqual(shapeObject(editor, rectId).editorShapeGeometry, {
        kind: 'rect',
        left: 12,
        top: 14,
        width: 40,
        height: 24,
    });
    assert.equal(shapeObject(editor, arrowId).editorShapeKind, 'arrow');
    assert.deepEqual(
        annotations.list().map((entry) => entry.kind),
        ['annotation:shape', 'annotation:shape', 'annotation:shape'],
    );
    assert.equal(history.length, 3);
    await dispose(editor);
});

test('Shape preview is latest-wins and transient through cancel and commit', async () => {
    const { annotations, editor, history, shapes } = await createEditor();
    await load(editor);
    const snapshot = editor.saveState();
    await shapes.enter({ kind: 'rect', stroke: '#ff0000' });
    await shapes.updatePreview({ kind: 'rect', left: 10, top: 10, width: 20, height: 18 });
    const firstPreview = editor
        .getCanvas()
        .getObjects()
        .find((object) => object.editorAnnotationPreviewOwner === 'annotation:shape');
    await shapes.updatePreview({ kind: 'rect', left: 15, top: 16, width: 44, height: 30 });
    const secondPreview = editor
        .getCanvas()
        .getObjects()
        .find((object) => object.editorAnnotationPreviewOwner === 'annotation:shape');
    assert.notEqual(firstPreview, secondPreview);
    assert.equal(editor.saveState(), snapshot);
    assert.equal(history.length, 0);
    await shapes.cancel();
    assert.equal(shapes.getSession(), null);
    assert.equal(editor.saveState(), snapshot);

    await shapes.enter({ kind: 'arrow', name: 'Committed arrow' });
    await shapes.updatePreview({
        kind: 'arrow',
        start: { x: 18, y: 20 },
        end: { x: 100, y: 70 },
    });
    const id = await shapes.commit();
    assert.equal(annotations.get(id).name, 'Committed arrow');
    assert.equal(history.length, 1);
    assert.equal(shapes.getSession(), null);
    await dispose(editor);
});

test('degenerate and non-finite geometry is rejected without state mutation', async () => {
    const { annotations, editor, history, shapes } = await createEditor();
    await load(editor);
    await assert.rejects(
        shapes.create({
            geometry: { kind: 'line', start: { x: 10, y: 10 }, end: { x: 10, y: 10 } },
        }),
        /distinct/i,
    );
    await assert.rejects(
        shapes.create({
            geometry: { kind: 'rect', left: 0, top: 0, width: Number.NaN, height: 10 },
        }),
        /width/i,
    );
    assert.deepEqual(annotations.list(), []);
    assert.equal(history.length, 0);
    await dispose(editor);
});

test('Shape updates are transactional and restore through undo and redo', async () => {
    const { editor, history, shapes } = await createEditor();
    await load(editor);
    const id = await shapes.create({
        geometry: { kind: 'rect', left: 12, top: 14, width: 40, height: 24 },
    });
    history.clear();
    await shapes.update(id, { stroke: '#0066ff', strokeWidth: 7, opacity: 0.5 });
    assert.equal(history.length, 1);
    assert.equal(shapeObject(editor, id).stroke, '#0066ff');
    await history.undo();
    assert.equal(shapeObject(editor, id).stroke, '#111111');
    await history.redo();
    assert.equal(shapeObject(editor, id).stroke, '#0066ff');
    await dispose(editor);
});

test('Shape transform binding defaults off and opt-in preserves identity', async () => {
    const unbound = await createEditor({ transform: true });
    await load(unbound.editor);
    const unboundId = await unbound.shapes.create({
        geometry: { kind: 'rect', left: 20, top: 18, width: 30, height: 20 },
    });
    const stationary = shapeObject(unbound.editor, unboundId);
    const stationaryMatrix = stationary.calcTransformMatrix();
    await unbound.transformApi.scale(1.5);
    await unbound.transformApi.rotate(45);
    assert.deepEqual(stationary.calcTransformMatrix(), stationaryMatrix);
    await dispose(unbound.editor);

    const bound = await createEditor({
        shapeOptions: { bindToImageTransform: true },
        transform: true,
    });
    await load(bound.editor);
    const boundId = await bound.shapes.create({
        geometry: { kind: 'arrow', start: { x: 20, y: 20 }, end: { x: 90, y: 60 } },
    });
    const identity = shapeObject(bound.editor, boundId);
    const before = identity.calcTransformMatrix();
    await bound.transformApi.scale(1.25);
    await bound.transformApi.rotate(30);
    await bound.transformApi.flipHorizontal();
    assert.equal(shapeObject(bound.editor, boundId), identity);
    assert.notDeepEqual(identity.calcTransformMatrix(), before);
    await dispose(bound.editor);
});

test('Shape Snapshot, export, flatten, and Crop preserve public boundaries', async () => {
    const { annotations, cropApi, editor, history, shapes } = await createEditor({ crop: true });
    await load(editor);
    const rectId = await shapes.create({
        geometry: { kind: 'rect', left: 20, top: 20, width: 35, height: 25 },
    });
    const arrowId = await shapes.create({
        geometry: { kind: 'arrow', start: { x: 40, y: 65 }, end: { x: 110, y: 30 } },
    });
    const snapshot = editor.saveState();
    await editor.loadFromState(snapshot);
    assert.equal(shapeObject(editor, arrowId).editorShapeKind, 'arrow');
    const exported = await editor.exportImageBase64({ format: 'png' });
    assert.match(exported, /^data:image\/png;base64,/);
    await cropApi.enter({ rect: { leftPx: 5, topPx: 5, widthPx: 110, heightPx: 75 } });
    await cropApi.apply({ format: 'png' });
    assert.ok(annotations.get(rectId));
    assert.ok(annotations.get(arrowId));
    history.clear();
    await annotations.flatten({ kinds: ['annotation:shape'] });
    assert.deepEqual(annotations.list(), []);
    assert.equal(history.length, 1);
    await dispose(editor);
});

test('switching from Shape to Mosaic cleans preview without History', async () => {
    const { editor, history, mosaicApi, shapes } = await createEditor({ mosaic: true });
    await load(editor);
    const snapshot = editor.saveState();
    await shapes.enter({ kind: 'line' });
    await shapes.updatePreview({
        kind: 'line',
        start: { x: 10, y: 10 },
        end: { x: 80, y: 60 },
    });
    await mosaicApi.enter();
    assert.equal(shapes.getSession(), null);
    assert.equal(editor.saveState(), snapshot);
    assert.equal(history.length, 0);
    await mosaicApi.cancel();
    await dispose(editor);
});

test('History-disabled Shape commits remain atomic without timeline records', async () => {
    const { annotations, editor, history, shapes } = await createEditor({
        historyEnabled: false,
    });
    await load(editor);
    await shapes.enter({ kind: 'rect' });
    await shapes.updatePreview({ kind: 'rect', left: 10, top: 10, width: 30, height: 20 });
    const id = await shapes.commit();
    assert.ok(annotations.get(id));
    assert.equal(history.length, 0);
    await dispose(editor);
});
