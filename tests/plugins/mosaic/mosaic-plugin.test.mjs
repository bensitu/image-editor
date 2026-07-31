import assert from 'node:assert/strict';
import test from 'node:test';

import { ImageEditorCore } from '../../../src/core/index.js';
import { overlayFoundationPlugin } from '../../../src/foundations/overlay/index.js';
import { cropPlugin } from '../../../src/plugins/crop/index.js';
import { filtersPlugin } from '../../../src/plugins/filters/index.js';
import { historyPlugin } from '../../../src/plugins/history/index.js';
import { maskPlugin } from '../../../src/plugins/mask/index.js';
import { mosaicPlugin } from '../../../src/plugins/mosaic/index.js';
import {
    VISIBLE_RASTER_BAKE_CAPABILITY,
    createCapabilityToken,
    definePlugin,
    definePluginRef,
} from '../../../src/sdk/index.js';
import { fabric, makeImageDataUrl, resetEditorDom } from '../../helpers/fabric-environment.mjs';

const incompatibleVisibleRasterBakeCapability = createCapabilityToken(
    VISIBLE_RASTER_BAKE_CAPABILITY.id,
    '2.0.0',
);

function installCommittedEventObserver(editor, id) {
    const ref = definePluginRef(id, '1.0.0');
    return editor.use(
        definePlugin({
            ref,
            manifest: {
                id: ref.id,
                version: '1.0.0',
                apiVersion: ref.apiVersion,
                engine: '^3.0.0',
            },
            setupMode: 'sync',
            setup(context) {
                const events = [];
                context.disposables.add(
                    context.events.on('document:committed', (descriptor) =>
                        events.push(descriptor),
                    ),
                );
                context.disposables.add(
                    context.events.on('geometry:committed', (descriptor) =>
                        events.push({ operationId: descriptor.operationId, result: descriptor }),
                    ),
                );
                return Object.freeze({ events });
            },
        }),
    );
}

function installIncompatibleBakeProvider(editor, id) {
    const ref = definePluginRef(id, '1.0.0');
    editor.use(
        definePlugin({
            ref,
            manifest: {
                id: ref.id,
                version: '1.0.0',
                apiVersion: ref.apiVersion,
                engine: '^3.0.0',
            },
            setupMode: 'sync',
            setup(context) {
                context.capabilities.provide(
                    incompatibleVisibleRasterBakeCapability,
                    Object.freeze({
                        hasVisibleState: () => true,
                        bakeIntoBase: () =>
                            Promise.reject(new Error('incompatible provider must not run')),
                    }),
                    { version: incompatibleVisibleRasterBakeCapability.version },
                );
                return Object.freeze({ ready: true });
            },
        }),
    );
}

async function createEditor({
    crop = false,
    filters = false,
    historyEnabled = true,
    incompatibleBake = false,
    masks = false,
    mosaicOptions = {},
    id,
} = {}) {
    const elementIds = resetEditorDom({ containerWidth: 320, containerHeight: 240 });
    const editor = new ImageEditorCore(fabric, { canvasWidth: 320, canvasHeight: 240 });
    let masksApi = null;
    if (masks) {
        editor.use(overlayFoundationPlugin());
        masksApi = editor.use(maskPlugin({ label: false }));
    }
    const history = editor.use(historyPlugin({ enabled: historyEnabled }));
    const filtersApi = filters ? editor.use(filtersPlugin()) : null;
    const cropApi = crop ? editor.use(cropPlugin({ paddingPx: 0 })) : null;
    if (incompatibleBake) {
        installIncompatibleBakeProvider(editor, `example:${id}-incompatible-bake`);
    }
    const mosaic = editor.use(mosaicPlugin(mosaicOptions));
    const observer = installCommittedEventObserver(editor, `example:${id}-mosaic-observer`);
    await editor.init({
        canvas: elementIds.canvas,
        canvasContainer: elementIds.canvasContainer,
    });
    return { cropApi, editor, filtersApi, history, masksApi, mosaic, observer };
}

async function load(editor) {
    await editor.loadImage(makeImageDataUrl({ width: 120, height: 80 }));
}

function makeMosaicPatternDataUrl(width = 120, height = 80) {
    const canvas = fabric.document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    for (let y = 0; y < height; y += 2) {
        for (let x = 0; x < width; x += 2) {
            context.fillStyle = (x / 2 + y / 2) % 2 === 0 ? '#102a43' : '#f0b429';
            context.fillRect(x, y, 2, 2);
        }
    }
    return canvas.toDataURL('image/png');
}

async function dispose(editor) {
    await editor.disposeAsync();
    document.body.innerHTML = '';
}

async function drawTwoStrokes(mosaic) {
    await mosaic.beginStroke({ xPx: 20, yPx: 20 });
    await mosaic.appendStroke({ xPx: 40, yPx: 20 });
    await mosaic.endStroke();
    await mosaic.beginStroke({ xPx: 65, yPx: 45 });
    await mosaic.appendStroke({ xPx: 82, yPx: 55 });
    await mosaic.endStroke();
}

test('Mosaic preview uses dirty regions and remains transient through multiple strokes and cancel', async () => {
    const { editor, history, mosaic, observer } = await createEditor({ id: 'session' });
    await assert.rejects(mosaic.enter(), /loaded image/i);
    await load(editor);
    const snapshot = editor.saveState();
    const exported = await editor.exportImageBase64({ format: 'png' });
    const baseImage = editor.getCanvas().getObjects()[0];

    await mosaic.enter();
    await drawTwoStrokes(mosaic);

    const session = mosaic.getSession();
    assert.equal(mosaic.isActive, true);
    assert.equal(session.strokeCount, 2);
    assert.equal(session.pointCount, 4);
    assert.ok(session.dirtyRectangle.widthPx < 120);
    assert.ok(session.dirtyRectangle.heightPx < 80);
    assert.equal(editor.getCanvas().getObjects()[0], baseImage);
    assert.equal(editor.getCanvas().getObjects().length, 3);
    assert.deepEqual(
        editor
            .getCanvas()
            .getObjects()
            .filter((object) => object.editorObjectKind === 'session')
            .map((object) => object.sessionObjectType),
        ['mosaicPreviewImage', 'mosaicPreviewCircle'],
    );
    assert.equal(editor.saveState(), snapshot);
    assert.equal(await editor.exportImageBase64({ format: 'png' }), exported);
    assert.equal(history.length, 0);
    assert.equal(observer.events.length, 0);

    await mosaic.cancel();
    assert.equal(mosaic.isActive, false);
    assert.equal(editor.getCanvas().getObjects().length, 1);
    assert.equal(editor.saveState(), snapshot);
    await dispose(editor);
});

test('Mosaic session preview remains above committed Filters and persistent overlays', async () => {
    const { editor, filtersApi, masksApi, mosaic } = await createEditor({
        filters: true,
        masks: true,
        id: 'layer-authority',
    });
    await load(editor);
    const canvas = editor.getCanvas();
    const baseImage = canvas.getObjects()[0];
    const mask = await masksApi.create({
        left: 30,
        top: 24,
        width: 20,
        height: 16,
    });
    await filtersApi.commit([{ type: 'sepia' }]);
    const committedVisual = canvas
        .getObjects()
        .find((object) => object !== baseImage && object !== mask);
    assert.ok(committedVisual);
    const persistentOrder = masksApi.getAll();

    await mosaic.enter();
    await mosaic.beginStroke({ xPx: 20, yPx: 20 });
    await mosaic.appendStroke({ xPx: 40, yPx: 20 });
    const preview = canvas
        .getObjects()
        .find((object) => object.sessionObjectType === 'mosaicPreviewImage');
    const brushPreview = canvas
        .getObjects()
        .find((object) => object.sessionObjectType === 'mosaicPreviewCircle');
    assert.ok(preview);
    assert.ok(brushPreview);
    const objectsDuringSession = canvas.getObjects();
    assert.equal(objectsDuringSession.indexOf(baseImage), 0);
    assert.ok(objectsDuringSession.indexOf(committedVisual) < objectsDuringSession.indexOf(mask));
    assert.ok(objectsDuringSession.indexOf(mask) < objectsDuringSession.indexOf(preview));
    assert.ok(objectsDuringSession.indexOf(preview) < objectsDuringSession.indexOf(brushPreview));
    assert.equal(preview.editorObjectKind, 'session');
    assert.equal(preview.sessionObjectType, 'mosaicPreviewImage');
    assert.ok(mosaic.getSession().dirtyRectangle.widthPx > 0);

    await mosaic.cancel();
    assert.deepEqual(canvas.getObjects(), [baseImage, committedVisual, mask]);
    assert.deepEqual(masksApi.getAll(), persistentOrder);
    assert.equal(canvas.getObjects().includes(preview), false);
    await dispose(editor);
});

test('Mosaic configuration updates active sessions and their brush preview between strokes', async () => {
    const { editor, mosaic } = await createEditor({ id: 'configuration' });
    await load(editor);
    await mosaic.configure({ brushSizePx: 18, pixelBlockSizePx: 6, quality: 0.7 });
    assert.deepEqual(mosaic.getConfiguration(), {
        brushSizePx: 18,
        pixelBlockSizePx: 6,
        format: 'source',
        quality: 0.7,
        maxPointCount: 4096,
    });
    assert.equal(Object.isFrozen(mosaic.getConfiguration()), true);
    await assert.rejects(mosaic.configure({ brushSizePx: 0 }), /brushSizePx/i);

    await mosaic.enter();
    const canvas = editor.getCanvas();
    const baseImage = canvas.getObjects()[0];
    const brushPreview = canvas
        .getObjects()
        .find((object) => object.sessionObjectType === 'mosaicPreviewCircle');
    assert.ok(brushPreview);
    assert.equal(brushPreview.visible, false);
    assert.equal(brushPreview.radius, 9);

    const imageCenter = new fabric.Point(0, 0).transform(baseImage.calcTransformMatrix());
    canvas.fire('mouse:move', { scenePoint: imageCenter });
    assert.equal(brushPreview.visible, true);
    assert.equal(brushPreview.left, imageCenter.x);
    assert.equal(brushPreview.top, imageCenter.y);

    await mosaic.configure({ brushSizePx: 30, pixelBlockSizePx: 9 });
    assert.equal(mosaic.getSession().configuration.brushSizePx, 30);
    assert.equal(mosaic.getSession().configuration.pixelBlockSizePx, 9);
    assert.equal(mosaic.getConfiguration().brushSizePx, 30);
    assert.equal(brushPreview.radius, 15);

    await mosaic.beginStroke({ xPx: 60, yPx: 40 });
    await assert.rejects(mosaic.configure({ brushSizePx: 36 }), /end the active mosaic stroke/i);
    await mosaic.endStroke();
    assert.ok(mosaic.getSession().dirtyRectangle.widthPx >= 30);
    canvas.fire('mouse:out', { scenePoint: imageCenter });
    assert.equal(brushPreview.visible, false);
    await mosaic.cancel();
    await dispose(editor);
});

test('Mosaic preserves each completed stroke configuration when committing', async () => {
    const { editor, mosaic } = await createEditor({
        id: 'per-stroke-configuration',
        mosaicOptions: { brushSizePx: 12, pixelBlockSizePx: 3 },
    });
    await editor.loadImage(makeMosaicPatternDataUrl());
    await mosaic.enter();
    await mosaic.beginStroke({ xPx: 64, yPx: 20 });
    await mosaic.appendStroke({ xPx: 72, yPx: 20 });
    await mosaic.endStroke();
    await mosaic.configure({ brushSizePx: 32, pixelBlockSizePx: 11 });
    await mosaic.beginStroke({ xPx: 75, yPx: 45 });
    await mosaic.appendStroke({ xPx: 92, yPx: 55 });
    await mosaic.endStroke();

    const preview = editor
        .getCanvas()
        .getObjects()
        .find((object) => object.sessionObjectType === 'mosaicPreviewImage');
    assert.ok(preview);
    const previewDataUrl = preview.getElement().toDataURL('image/png');

    await mosaic.commit({ format: 'png' });

    assert.equal(editor.getCanvas().getObjects()[0].getElement().src, previewDataUrl);
    await dispose(editor);
});

test('Mosaic validates natural-pixel points without mutating a rejected stroke', async () => {
    const { editor, mosaic } = await createEditor({ id: 'point-validation' });
    await load(editor);
    await mosaic.enter();

    await assert.rejects(mosaic.beginStroke({ xPx: -0.1, yPx: 1 }), /natural image bounds/i);
    await assert.rejects(mosaic.beginStroke({ xPx: 120, yPx: 1 }), /natural image bounds/i);
    await assert.rejects(mosaic.beginStroke({ xPx: Number.NaN, yPx: 1 }), /natural image bounds/i);
    assert.equal(mosaic.getSession().pointCount, 0);
    assert.equal(mosaic.getSession().strokeCount, 0);

    await mosaic.beginStroke({ xPx: 0.25, yPx: 79.75 });
    await mosaic.endStroke();
    assert.equal(mosaic.getSession().pointCount, 1);
    assert.deepEqual(mosaic.getSession().dirtyRectangle, {
        leftPx: 0,
        topPx: 67,
        widthPx: 14,
        heightPx: 13,
    });
    await mosaic.cancel();
    await dispose(editor);
});

test('Mosaic tracks user points incrementally at the exact configured boundary', async () => {
    const { editor, mosaic, observer } = await createEditor({
        id: 'point-budget',
        mosaicOptions: { maxPointCount: 3 },
    });
    await load(editor);
    await mosaic.enter();

    await mosaic.beginStroke({ xPx: 1, yPx: 1 });
    await mosaic.appendStroke({ xPx: 119, yPx: 79 });
    assert.equal(mosaic.getSession().pointCount, 2);
    await assert.rejects(mosaic.appendStroke({ xPx: 120, yPx: 79 }), /natural image bounds/i);
    assert.equal(mosaic.getSession().pointCount, 2);
    await mosaic.endStroke();
    assert.equal(mosaic.getSession().pointCount, 2);

    await mosaic.beginStroke({ xPx: 40, yPx: 30 });
    assert.equal(mosaic.getSession().pointCount, 3);
    await assert.rejects(
        mosaic.appendStroke({ xPx: 41, yPx: 31 }),
        /point count exceeds maxPointCount/i,
    );
    assert.equal(mosaic.getSession().pointCount, 3);
    await mosaic.endStroke();
    assert.equal(mosaic.getSession().pointCount, 3);

    await mosaic.commit();
    assert.equal(observer.events.length, 1);
    assert.equal(observer.events[0].result.metadata.pointCount, 3);
    assert.equal(observer.events[0].result.metadata.strokeCount, 2);
    await dispose(editor);
});

test('Mosaic re-entry rejects and image replacement or disposal closes the session', async () => {
    const { editor, mosaic } = await createEditor({ id: 'lifecycle' });
    await load(editor);
    await mosaic.enter();
    const session = mosaic.getSession();

    await assert.rejects(mosaic.enter(), /already active/i);
    assert.deepEqual(mosaic.getSession(), session);

    await editor.loadImage(makeImageDataUrl({ width: 64, height: 48 }));
    assert.equal(mosaic.isActive, false);
    assert.equal(mosaic.getSession(), null);
    assert.equal(editor.getCanvas().getObjects().length, 1);
    assert.equal(editor.getImageInfo().naturalWidth, 64);
    assert.equal(editor.getImageInfo().naturalHeight, 48);

    await mosaic.enter();
    await editor.disposeAsync();
    assert.equal(editor.getLifecycleState(), 'disposed');
    document.body.innerHTML = '';
});

test('Mosaic commit replaces pixels once with accurate MIME, History, and undo', async () => {
    const { editor, history, mosaic, observer } = await createEditor({ id: 'commit' });
    await load(editor);
    const before = await editor.exportImageBase64({ format: 'png' });
    const canvas = editor.getCanvas();
    const originalBaseImage = canvas.getObjects()[0];
    await mosaic.enter();
    await drawTwoStrokes(mosaic);
    const mosaicPreview = canvas
        .getObjects()
        .find((object) => object.sessionObjectType === 'mosaicPreviewImage');
    assert.ok(mosaicPreview);
    const originalRemove = canvas.remove;
    let baseImageAtPreviewRemoval = null;
    canvas.remove = function (...objects) {
        if (objects.includes(mosaicPreview)) {
            baseImageAtPreviewRemoval = this.getObjects().find(
                (object) => object.editorObjectKind === 'baseImage',
            );
        }
        return Reflect.apply(originalRemove, this, objects);
    };

    try {
        await mosaic.commit({ format: 'jpeg', quality: 0.8 });
    } finally {
        canvas.remove = originalRemove;
    }

    assert.equal(mosaic.isActive, false);
    assert.equal(canvas.getObjects().length, 1);
    assert.equal(canvas.getObjects()[0].editorObjectKind, 'baseImage');
    assert.notEqual(baseImageAtPreviewRemoval, originalBaseImage);
    assert.equal(baseImageAtPreviewRemoval, canvas.getObjects()[0]);
    assert.equal(editor.getImageInfo().naturalWidth, 120);
    assert.equal(editor.getImageInfo().naturalHeight, 80);
    assert.equal(editor.getImageInfo().mimeType, 'image/jpeg');
    assert.notEqual(await editor.exportImageBase64({ format: 'png' }), before);
    assert.equal(history.length, 1);
    assert.equal(observer.events.length, 1);
    assert.equal(observer.events[0].operationId, 'mosaic:commit');

    await history.undo();
    assert.equal(await editor.exportImageBase64({ format: 'png' }), before);
    assert.equal(editor.getImageInfo().mimeType, 'image/png');
    await history.redo();
    assert.equal(editor.getImageInfo().mimeType, 'image/jpeg');
    await dispose(editor);
});

test('Mosaic commit bakes Filters in the parent and preserves generic Overlay identity', async () => {
    const { editor, filtersApi, history, masksApi, mosaic, observer } = await createEditor({
        filters: true,
        masks: true,
        id: 'participants',
    });
    await load(editor);
    const baseBounds = editor.getCanvas().getObjects()[0].getBoundingRect();
    const mask = await masksApi.create({
        left: baseBounds.left + 30,
        top: baseBounds.top + 25,
        width: 20,
        height: 16,
    });
    await filtersApi.commit([{ type: 'sepia' }]);
    history.clear();
    observer.events.length = 0;
    await mosaic.enter();
    await drawTwoStrokes(mosaic);

    await mosaic.commit();

    assert.deepEqual(filtersApi.getState().filters, []);
    assert.equal(masksApi.getAll().length, 1);
    assert.equal(masksApi.getAll()[0], mask);
    assert.equal(mask.canvas, editor.getCanvas());
    assert.equal(
        editor
            .getCanvas()
            .getObjects()
            .some(
                (object) =>
                    object.editorLayerRole === 'session' ||
                    object.editorLayerRole === 'rasterVisual',
            ),
        false,
    );
    assert.equal(history.length, 1);
    assert.equal(observer.events.length, 1);
    await dispose(editor);
});

test('Mosaic unbaked commit preserves Filters and refreshes its visual for the new Base Image', async () => {
    const { editor, filtersApi, history, mosaic, observer } = await createEditor({
        filters: true,
        id: 'unbaked-filters',
    });
    await load(editor);
    await filtersApi.commit([{ type: 'sepia' }]);
    const before = await editor.exportImageBase64({ format: 'png' });
    history.clear();
    observer.events.length = 0;

    await mosaic.enter();
    await drawTwoStrokes(mosaic);
    await mosaic.commit({ bakeVisibleFilters: false });

    const objects = editor.getCanvas().getObjects();
    assert.equal(mosaic.isActive, false);
    assert.deepEqual(filtersApi.getState().filters, [{ type: 'sepia' }]);
    assert.equal(objects[0].editorObjectKind, 'baseImage');
    assert.equal(objects[1].editorLayerRole, 'rasterVisual');
    assert.equal(objects.length, 2);
    assert.notEqual(await editor.exportImageBase64({ format: 'png' }), before);
    assert.equal(history.length, 1);
    assert.equal(observer.events.length, 1);
    await dispose(editor);
});

test('Mosaic rejects incompatible visible-raster bake and permits an explicit unbaked commit', async () => {
    const { editor, history, mosaic, observer } = await createEditor({
        incompatibleBake: true,
        id: 'incompatible-bake',
    });
    await load(editor);
    const beforeSnapshot = editor.saveState();
    const beforeExport = await editor.exportImageBase64({ format: 'png' });
    await mosaic.enter();
    await mosaic.beginStroke({ xPx: 20, yPx: 20 });
    await mosaic.endStroke();

    await assert.rejects(mosaic.commit(), /visible-raster bake provider is incompatible/i);

    assert.equal(mosaic.isActive, false);
    assert.equal(editor.saveState(), beforeSnapshot);
    assert.equal(await editor.exportImageBase64({ format: 'png' }), beforeExport);
    assert.equal(history.length, 0);
    assert.equal(observer.events.length, 0);

    await mosaic.enter();
    await mosaic.beginStroke({ xPx: 20, yPx: 20 });
    await mosaic.endStroke();
    await mosaic.commit({ bakeVisibleFilters: false });
    assert.equal(history.length, 1);
    assert.equal(observer.events.length, 1);
    await dispose(editor);
});

test('Mosaic commit failure closes preview and restores Raster without publication', async () => {
    const { editor, history, mosaic, observer } = await createEditor({ id: 'failure' });
    await load(editor);
    const beforeSnapshot = editor.saveState();
    const beforeExport = await editor.exportImageBase64({ format: 'png' });
    await mosaic.enter();
    await drawTwoStrokes(mosaic);
    editor.getCanvas().getObjects()[0].getElement = () => {
        throw new Error('synthetic Mosaic cache creation failure');
    };

    await assert.rejects(mosaic.commit(), /synthetic Mosaic cache creation failure/);

    assert.equal(mosaic.isActive, false);
    assert.equal(editor.saveState(), beforeSnapshot);
    assert.equal(await editor.exportImageBase64({ format: 'png' }), beforeExport);
    assert.equal(history.length, 0);
    assert.equal(observer.events.length, 0);
    assert.equal(editor.getLifecycleState(), 'initialized');
    await dispose(editor);
});

test('Mosaic no-op and History-disabled commits use deterministic publication', async () => {
    const { editor, history, mosaic, observer } = await createEditor({
        historyEnabled: false,
        id: 'history-disabled',
    });
    await load(editor);
    await mosaic.enter();
    await mosaic.commit();
    assert.equal(history.length, 0);
    assert.equal(observer.events.length, 0);

    await mosaic.enter();
    await mosaic.beginStroke({ xPx: 20, yPx: 20 });
    await mosaic.endStroke();
    await mosaic.commit();
    assert.equal(history.length, 0);
    assert.equal(observer.events.length, 1);
    await dispose(editor);
});

test('Crop and Mosaic share one Tool Coordinator and switch with exact cleanup', async () => {
    const { cropApi, editor, mosaic } = await createEditor({ crop: true, id: 'tools' });
    await load(editor);
    await cropApi.enter();
    assert.equal(cropApi.isActive, true);
    await mosaic.enter();
    assert.equal(cropApi.isActive, false);
    assert.equal(mosaic.isActive, true);
    await cropApi.enter();
    assert.equal(mosaic.isActive, false);
    assert.equal(cropApi.isActive, true);
    await cropApi.cancel();
    assert.equal(editor.getCanvas().getObjects().length, 1);
    await dispose(editor);
});
