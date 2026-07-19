import assert from 'node:assert/strict';
import test from 'node:test';

import { ImageEditorCore } from '../../../src/core/index.js';
import { overlayFoundationPlugin } from '../../../src/foundations/overlay/index.js';
import { cropPlugin } from '../../../src/plugins/crop/index.js';
import { filtersPlugin } from '../../../src/plugins/filters/index.js';
import { historyPlugin } from '../../../src/plugins/history/index.js';
import { maskPlugin } from '../../../src/plugins/mask/index.js';
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
    filters = false,
    historyEnabled = true,
    incompatibleBake = false,
    masks = false,
    maskOptions = {},
    overlays = false,
    cropOptions = {},
    id,
} = {}) {
    const elementIds = resetEditorDom({ containerWidth: 320, containerHeight: 240 });
    const editor = new ImageEditorCore(fabric, { canvasWidth: 320, canvasHeight: 240 });
    let overlay = null;
    let masksApi = null;
    if (masks || overlays) {
        overlay = editor.use(overlayFoundationPlugin());
    }
    if (masks) {
        masksApi = editor.use(
            maskPlugin({ label: false, defaultWidth: 12, defaultHeight: 12, ...maskOptions }),
        );
    }
    const history = editor.use(historyPlugin({ enabled: historyEnabled }));
    const filtersApi = filters ? editor.use(filtersPlugin()) : null;
    if (incompatibleBake) {
        installIncompatibleBakeProvider(editor, `example:${id}-incompatible-bake`);
    }
    const crop = editor.use(cropPlugin({ paddingPx: 0, ...cropOptions }));
    const observer = installCommittedEventObserver(editor, `example:${id}-crop-observer`);
    await editor.init({
        canvas: elementIds.canvas,
        canvasContainer: elementIds.canvasContainer,
    });
    return { crop, editor, elementIds, filtersApi, history, masksApi, observer, overlay };
}

function registerSyntheticAnnotationKind(overlay) {
    const kind = 'example-test:annotation-like';
    overlay.registerKind({
        id: kind,
        ownerPluginId: 'example-test:annotation-owner',
        classify: (object) => object.syntheticOverlayKind === kind,
        getPersistentId: (object) => object.syntheticOverlayId ?? null,
        setPersistentId: (object, id) => {
            object.syntheticOverlayId = id;
        },
        persistence: {
            mode: 'persistent',
            codec: {
                type: kind,
                version: '1.0.0',
                serialize: (object) => ({
                    text: object.text,
                    left: object.left,
                    top: object.top,
                    width: object.width,
                    scaleX: object.scaleX,
                    scaleY: object.scaleY,
                    angle: object.angle,
                    fill: object.fill,
                    fontSize: object.fontSize,
                }),
                validate: (value) =>
                    value !== null &&
                    typeof value === 'object' &&
                    typeof value.text === 'string' &&
                    Number.isFinite(value.left) &&
                    Number.isFinite(value.top) &&
                    Number.isFinite(value.width),
                deserialize: (value, context) => new context.fabric.Textbox(value.text, value),
            },
        },
    });
    return kind;
}

async function load(editor) {
    await editor.loadImage(makeImageDataUrl({ width: 120, height: 80 }));
}

async function dispose(editor) {
    await editor.disposeAsync();
    document.body.innerHTML = '';
}

test('Crop sessions are transient across enter, update, aspect ratio, export, and cancel', async () => {
    const { crop, editor, history, observer } = await createEditor({ id: 'session' });
    await assert.rejects(crop.enter(), /loaded image/i);
    await load(editor);
    const snapshot = editor.saveState();
    const exported = await editor.exportImageBase64({ format: 'png' });
    const baseImage = editor.getCanvas().getObjects()[0];

    await crop.enter();
    assert.equal(crop.isActive, true);
    assert.deepEqual(crop.getSession().rect, {
        leftPx: 0,
        topPx: 0,
        widthPx: 120,
        heightPx: 80,
    });
    assert.equal(editor.getCanvas().getObjects().length, 2);
    assert.equal(editor.getCanvas().getObjects()[0], baseImage);
    assert.equal(editor.saveState(), snapshot);
    assert.equal(await editor.exportImageBase64({ format: 'png' }), exported);

    await crop.updateRect({ leftPx: 10.4, topPx: 8.2, widthPx: 50, heightPx: 40 });
    await crop.setAspectRatio('1:1');
    assert.equal(crop.getSession().aspectRatio, 1);
    assert.equal(crop.getSession().rect.widthPx, crop.getSession().rect.heightPx);
    assert.equal(history.length, 0);
    assert.equal(observer.events.length, 0);

    await crop.cancel();
    assert.equal(crop.isActive, false);
    assert.equal(crop.getSession(), null);
    assert.equal(editor.getCanvas().getObjects().length, 1);
    assert.equal(editor.saveState(), snapshot);
    await dispose(editor);
});

test('Crop apply replaces one Base Image with accurate geometry, MIME, History, and undo', async () => {
    const { crop, editor, history, observer } = await createEditor({ id: 'apply' });
    await load(editor);
    await crop.enter({
        rect: { leftPx: 10, topPx: 8, widthPx: 50, heightPx: 40 },
    });

    await crop.apply({ format: 'jpeg', quality: 0.8 });

    assert.equal(crop.isActive, false);
    assert.equal(editor.getCanvas().getObjects().length, 1);
    assert.equal(editor.getCanvas().getObjects()[0].editorObjectKind, 'baseImage');
    assert.equal(editor.getCanvas().getObjects()[0].selectable, false);
    assert.equal(editor.getCanvas().getObjects()[0].evented, false);
    assert.equal(editor.getImageInfo().naturalWidth, 50);
    assert.equal(editor.getImageInfo().naturalHeight, 40);
    assert.equal(editor.getImageInfo().mimeType, 'image/jpeg');
    assert.equal(history.length, 1);
    assert.equal(observer.events.length, 1);
    assert.equal(observer.events[0].operationId, 'crop:apply');
    assert.deepEqual(observer.events[0].result.sourceRect, {
        left: 10,
        top: 8,
        width: 50,
        height: 40,
    });

    await history.undo();
    assert.equal(editor.getImageInfo().naturalWidth, 120);
    assert.equal(editor.getImageInfo().naturalHeight, 80);
    assert.equal(editor.getImageInfo().mimeType, 'image/png');
    await history.redo();
    assert.equal(editor.getImageInfo().naturalWidth, 50);
    assert.equal(editor.getImageInfo().mimeType, 'image/jpeg');
    await dispose(editor);
});

test('Crop apply bakes committed Filters inside the parent mutation only', async () => {
    const { crop, editor, filtersApi, history, observer } = await createEditor({
        filters: true,
        id: 'filters',
    });
    await load(editor);
    await filtersApi.commit([{ type: 'grayscale' }]);
    history.clear();
    observer.events.length = 0;
    await crop.enter({ rect: { leftPx: 0, topPx: 0, widthPx: 60, heightPx: 80 } });

    await crop.apply();

    assert.deepEqual(filtersApi.getState().filters, []);
    assert.equal(history.length, 1);
    assert.equal(observer.events.length, 1);
    assert.equal(observer.events[0].operationId, 'crop:apply');
    await dispose(editor);
});

test('Crop rejects incompatible visible-raster bake and permits an explicit unbaked apply', async () => {
    const { crop, editor, history, observer } = await createEditor({
        incompatibleBake: true,
        id: 'incompatible-bake',
    });
    await load(editor);
    const beforeSnapshot = editor.saveState();
    const beforeExport = await editor.exportImageBase64({ format: 'png' });
    await crop.enter({ rect: { leftPx: 4, topPx: 5, widthPx: 60, heightPx: 50 } });

    await assert.rejects(crop.apply(), /visible-raster bake provider is incompatible/i);

    assert.equal(crop.isActive, false);
    assert.equal(editor.saveState(), beforeSnapshot);
    assert.equal(await editor.exportImageBase64({ format: 'png' }), beforeExport);
    assert.equal(history.length, 0);
    assert.equal(observer.events.length, 0);

    await crop.enter({ rect: { leftPx: 4, topPx: 5, widthPx: 60, heightPx: 50 } });
    await crop.apply({ bakeVisibleFilters: false });
    assert.equal(editor.getImageInfo().naturalWidth, 60);
    assert.equal(editor.getImageInfo().naturalHeight, 50);
    assert.equal(history.length, 1);
    assert.equal(observer.events.length, 1);
    await dispose(editor);
});

test('Crop generic Overlay policies hide transiently and preserve only intersecting identities', async () => {
    const { crop, editor, history, masksApi, observer, overlay } = await createEditor({
        masks: true,
        id: 'overlay',
    });
    await load(editor);
    const baseBounds = editor.getCanvas().getObjects()[0].getBoundingRect();
    const inside = await masksApi.create({
        left: baseBounds.left + baseBounds.width * 0.2,
        top: baseBounds.top + baseBounds.height * 0.5,
        width: 10,
        height: 10,
    });
    const outside = await masksApi.create({
        left: baseBounds.left + baseBounds.width * 0.85,
        top: baseBounds.top + baseBounds.height * 0.5,
        width: 10,
        height: 10,
    });
    history.clear();
    observer.events.length = 0;
    overlay.select([inside.maskUid]);
    const beforeSelection = overlay.getSelection();
    const snapshot = editor.saveState();

    await crop.enter({
        rect: { leftPx: 0, topPx: 0, widthPx: 60, heightPx: 80 },
        overlayPolicy: {
            preview: 'hide-participating',
            apply: 'transform-intersecting',
            kinds: ['mask:object'],
        },
    });
    assert.equal(inside.visible, false);
    assert.equal(outside.visible, true);
    assert.equal(overlay.classify(inside).hidden, false);
    assert.equal(editor.saveState(), snapshot);

    await crop.cancel();
    assert.equal(inside.visible, true);
    assert.deepEqual(overlay.getSelection(), beforeSelection);

    await crop.enter({
        rect: { leftPx: 0, topPx: 0, widthPx: 60, heightPx: 80 },
        overlayPolicy: {
            preview: 'keep',
            apply: 'transform-intersecting',
            kinds: ['mask:object'],
        },
    });
    await crop.apply();
    assert.equal(masksApi.getAll().length, 1);
    assert.equal(masksApi.getAll()[0], inside);
    assert.equal(overlay.getByPersistentId(inside.maskUid), inside);
    assert.equal(overlay.getByPersistentId(outside.maskUid), null);
    assert.equal(history.length, 1);
    assert.equal(observer.events.length, 1);
    await dispose(editor);
});

test('Crop preserves a synthetic annotation-like Overlay without concrete Feature coupling', async () => {
    const { crop, editor, history, observer, overlay } = await createEditor({
        overlays: true,
        id: 'synthetic-overlay',
    });
    await load(editor);
    const kind = registerSyntheticAnnotationKind(overlay);
    const bounds = editor.getCanvas().getObjects()[0].getBoundingRect();
    const annotation = new fabric.Textbox('Generic note', {
        left: bounds.left + bounds.width * 0.2,
        top: bounds.top + bounds.height * 0.45,
        width: 36,
        fontSize: 10,
        fill: '#4f46e5',
    });
    annotation.syntheticOverlayKind = kind;
    annotation.syntheticOverlayId = 'annotation:one';
    await overlay.add([annotation]);
    history.clear();
    observer.events.length = 0;
    const snapshot = editor.saveState();

    await crop.enter({
        rect: { leftPx: 0, topPx: 0, widthPx: 60, heightPx: 80 },
        overlayPolicy: {
            preview: 'hide-participating',
            apply: 'transform-intersecting',
            kinds: [kind],
        },
    });
    assert.equal(annotation.visible, false);
    assert.equal(overlay.classify(annotation).hidden, false);
    assert.equal(editor.saveState(), snapshot);
    await crop.cancel();
    assert.equal(annotation.visible, true);

    await crop.enter({
        rect: { leftPx: 0, topPx: 0, widthPx: 60, heightPx: 80 },
        overlayPolicy: {
            preview: 'keep',
            apply: 'transform-intersecting',
            kinds: [kind],
        },
    });
    await crop.apply();

    assert.equal(overlay.getByPersistentId('annotation:one'), annotation);
    assert.equal(overlay.classify(annotation).kind, kind);
    assert.equal(history.length, 1);
    assert.equal(observer.events.length, 1);
    await dispose(editor);
});

test('Crop preserves mixed Overlay geometry, layer state, and ActiveSelection', async () => {
    const { crop, editor, history, masksApi, observer, overlay } = await createEditor({
        masks: true,
        id: 'mixed-overlays',
    });
    await load(editor);
    const kind = registerSyntheticAnnotationKind(overlay);
    const bounds = editor.getCanvas().getObjects()[0].getBoundingRect();
    const first = await masksApi.create({
        left: bounds.left + 12,
        top: bounds.top + 45,
        width: 14,
        height: 12,
    });
    const second = await masksApi.create({
        left: bounds.left + 32,
        top: bounds.top + 70,
        width: 16,
        height: 14,
    });
    const guarded = await masksApi.create({
        left: bounds.left + 50,
        top: bounds.top + 95,
        width: 12,
        height: 12,
    });
    const annotation = new fabric.Textbox('Mixed note', {
        left: bounds.left + 58,
        top: bounds.top + 38,
        width: 10,
        fontSize: 9,
        fill: '#7c3aed',
    });
    annotation.syntheticOverlayKind = kind;
    annotation.syntheticOverlayId = 'annotation:mixed';
    await overlay.add([annotation]);
    await overlay.setHidden(guarded.maskUid, true);
    await overlay.setLocked(guarded.maskUid, true);
    overlay.select([first.maskUid, second.maskUid, 'annotation:mixed']);
    const selection = overlay.getSelection();
    const layerOrder = overlay
        .list({ includeHidden: true, includeLocked: true })
        .map((object) => overlay.classify(object).persistentId);
    const firstBounds = first.getBoundingRect();
    const annotationBounds = annotation.getBoundingRect();
    history.clear();
    observer.events.length = 0;

    await crop.enter({
        rect: { leftPx: 0, topPx: 0, widthPx: 75, heightPx: 80 },
        overlayPolicy: { preview: 'keep', apply: 'keep' },
    });
    await crop.apply();

    assert.equal(overlay.getByPersistentId(first.maskUid), first);
    assert.equal(overlay.getByPersistentId(second.maskUid), second);
    assert.equal(overlay.getByPersistentId(guarded.maskUid), guarded);
    assert.equal(overlay.getByPersistentId('annotation:mixed'), annotation);
    assert.deepEqual(first.getBoundingRect(), firstBounds);
    assert.deepEqual(annotation.getBoundingRect(), annotationBounds);
    assert.equal(overlay.classify(guarded).hidden, true);
    assert.equal(overlay.classify(guarded).locked, true);
    assert.deepEqual(overlay.getSelection(), selection);
    assert.deepEqual(
        overlay
            .list({ includeHidden: true, includeLocked: true })
            .map((object) => overlay.classify(object).persistentId),
        layerOrder,
    );
    assert.equal(history.length, 1);
    assert.equal(observer.events.length, 1);
    await dispose(editor);
});

test('Crop synchronizes a selected Mask label through crop geometry', async () => {
    const { crop, editor, masksApi, overlay } = await createEditor({
        masks: true,
        maskOptions: {
            label: {
                getText: () => 'Crop label',
                textOptions: { fontSize: 10 },
            },
            labelOffset: 4,
        },
        id: 'mask-label',
    });
    await load(editor);
    const bounds = editor.getCanvas().getObjects()[0].getBoundingRect();
    const mask = await masksApi.create({
        left: bounds.left + 45,
        top: bounds.top + 70,
        width: 18,
        height: 16,
    });
    overlay.select([mask.maskUid]);
    const label = mask.labelObject;
    assert.ok(label);
    const before = { left: label.left, top: label.top };

    await crop.enter({ rect: { leftPx: 0, topPx: 0, widthPx: 60, heightPx: 80 } });
    await crop.apply();

    const synchronizedLabel = mask.labelObject;
    assert.ok(synchronizedLabel);
    assert.deepEqual({ left: synchronizedLabel.left, top: synchronizedLabel.top }, before);
    const topLeft = mask.getCoords()[0];
    assert.ok(
        Math.hypot(synchronizedLabel.left - topLeft.x, synchronizedLabel.top - topLeft.y) <= 6,
    );
    assert.deepEqual(overlay.getSelection().ids, [mask.maskUid]);
    await dispose(editor);
});

test('Crop re-entry rejects deterministically and image replacement closes the session', async () => {
    const { crop, editor } = await createEditor({ id: 'lifecycle' });
    await load(editor);
    await crop.enter({ rect: { leftPx: 8, topPx: 6, widthPx: 70, heightPx: 50 } });
    const session = crop.getSession();

    await assert.rejects(crop.enter(), /already active/i);
    assert.deepEqual(crop.getSession(), session);

    await editor.loadImage(makeImageDataUrl({ width: 64, height: 48 }));
    assert.equal(crop.isActive, false);
    assert.equal(crop.getSession(), null);
    assert.equal(editor.getCanvas().getObjects().length, 1);
    assert.deepEqual(
        {
            naturalWidth: editor.getImageInfo().naturalWidth,
            naturalHeight: editor.getImageInfo().naturalHeight,
            mimeType: editor.getImageInfo().mimeType,
        },
        {
            naturalWidth: 64,
            naturalHeight: 48,
            mimeType: 'image/png',
        },
    );

    await crop.enter();
    await editor.disposeAsync();
    document.body.innerHTML = '';
});

test('Crop failures close the session and restore the exact document without publication', async () => {
    const { crop, editor, history, observer } = await createEditor({ id: 'failure' });
    await load(editor);
    const beforeSnapshot = editor.saveState();
    const beforeExport = await editor.exportImageBase64({ format: 'png' });
    const baseImage = editor.getCanvas().getObjects()[0];
    baseImage.getElement = () => {
        throw new Error('synthetic Crop source export failure');
    };
    await crop.enter({ rect: { leftPx: 4, topPx: 5, widthPx: 60, heightPx: 50 } });

    await assert.rejects(crop.apply(), /synthetic Crop source export failure/);

    assert.equal(crop.isActive, false);
    assert.equal(editor.saveState(), beforeSnapshot);
    assert.equal(await editor.exportImageBase64({ format: 'png' }), beforeExport);
    assert.equal(history.length, 0);
    assert.equal(observer.events.length, 0);
    assert.equal(editor.getLifecycleState(), 'initialized');
    await dispose(editor);
});

test('Crop apply remains committed when History is disabled', async () => {
    const { crop, editor, history, observer } = await createEditor({
        historyEnabled: false,
        id: 'history-disabled',
    });
    await load(editor);
    await crop.enter({ rect: { leftPx: 0, topPx: 0, widthPx: 80, heightPx: 60 } });
    await crop.apply();
    assert.equal(editor.getImageInfo().naturalWidth, 80);
    assert.equal(history.length, 0);
    assert.equal(observer.events.length, 1);
    await dispose(editor);
});
