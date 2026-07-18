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
    assert.equal(editor.getCanvas().getObjects().length, 2);
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

test('Mosaic configuration is validated, immutable, and captured by active sessions', async () => {
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
    const captured = mosaic.getSession().configuration;
    await mosaic.configure({ brushSizePx: 30 });
    assert.equal(captured.brushSizePx, 18);
    assert.equal(mosaic.getSession().configuration.brushSizePx, 18);
    assert.equal(mosaic.getConfiguration().brushSizePx, 30);
    await mosaic.cancel();
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
    await mosaic.enter();
    await drawTwoStrokes(mosaic);

    await mosaic.commit({ format: 'jpeg', quality: 0.8 });

    assert.equal(mosaic.isActive, false);
    assert.equal(editor.getCanvas().getObjects().length, 1);
    assert.equal(editor.getCanvas().getObjects()[0].editorObjectKind, 'baseImage');
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
