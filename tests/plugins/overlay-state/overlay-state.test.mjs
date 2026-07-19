import assert from 'node:assert/strict';
import test from 'node:test';

import { ImageEditorCore } from '../../../src/core/index.js';
import { annotationFoundationPlugin } from '../../../src/foundations/annotation/index.js';
import { overlayFoundationPlugin } from '../../../src/foundations/overlay/index.js';
import { drawAnnotationPlugin } from '../../../src/plugins/annotation-draw/index.js';
import { shapeAnnotationPlugin } from '../../../src/plugins/annotation-shape/index.js';
import { textAnnotationPlugin } from '../../../src/plugins/annotation-text/index.js';
import { historyPlugin } from '../../../src/plugins/history/index.js';
import { maskPlugin } from '../../../src/plugins/mask/index.js';
import { overlayStatePlugin } from '../../../src/plugins/overlay-state/index.js';
import { transformPlugin } from '../../../src/plugins/transform/index.js';
import { fabric, makeImageDataUrl, resetEditorDom } from '../../helpers/fabric-environment.mjs';

function emptyDocument(overrides = {}) {
    return {
        schema: 'image-editor.overlay-state',
        version: 1,
        coordinateSpace: 'image-normalized',
        image: { naturalWidth: 120, naturalHeight: 80, mimeType: 'image/png' },
        overlays: [],
        ...overrides,
    };
}

async function createEditor(options = {}) {
    const ids = resetEditorDom({ containerWidth: 320, containerHeight: 240 });
    const editor = new ImageEditorCore(fabric, { canvasWidth: 320, canvasHeight: 240 });
    const overlay = editor.use(overlayFoundationPlugin());
    const state = editor.use(overlayStatePlugin(options));
    await editor.init({ canvas: ids.canvas, canvasContainer: ids.canvasContainer });
    return { editor, overlay, state };
}

async function createFeatureEditor({ historyEnabled = true } = {}) {
    const ids = resetEditorDom({ containerWidth: 360, containerHeight: 260 });
    const editor = new ImageEditorCore(fabric, { canvasWidth: 360, canvasHeight: 260 });
    const overlay = editor.use(overlayFoundationPlugin());
    const annotations = editor.use(annotationFoundationPlugin());
    const history = editor.use(historyPlugin({ enabled: historyEnabled }));
    const transform = editor.use(transformPlugin({ animationDuration: 0 }));
    const masks = editor.use(
        maskPlugin({ bindToImageTransform: true, label: false, rotatable: true }),
    );
    const text = editor.use(textAnnotationPlugin({ bindToImageTransform: true }));
    const shape = editor.use(shapeAnnotationPlugin({ bindToImageTransform: true }));
    const draw = editor.use(drawAnnotationPlugin({ bindToImageTransform: true }));
    const state = editor.use(overlayStatePlugin());
    await editor.init({ canvas: ids.canvas, canvasContainer: ids.canvasContainer });
    await editor.loadImage(makeImageDataUrl({ width: 160, height: 100 }));
    return { annotations, draw, editor, history, masks, overlay, shape, state, text, transform };
}

async function createDraw(draw) {
    await draw.enter();
    await draw.beginStroke({ x: 22, y: 72 });
    await draw.appendStroke({ x: 68, y: 54 });
    await draw.appendStroke({ x: 126, y: 66 });
    const id = await draw.endStroke();
    await draw.exit();
    return id;
}

function registerCustomKind(overlay) {
    const kind = 'example:badge';
    overlay.registerKind({
        id: kind,
        ownerPluginId: 'example:badge-plugin',
        classify: (object) => object.editorOverlayKind === kind,
        getPersistentId: (object) => object.editorOverlayId ?? null,
        setPersistentId: (object, id) => {
            object.editorOverlayId = id;
        },
        persistence: {
            mode: 'persistent',
            codec: {
                type: kind,
                version: '1.0.0',
                serialize: (object) => ({
                    left: object.left,
                    top: object.top,
                    width: object.width,
                    height: object.height,
                    fill: object.fill,
                }),
                validate: (value) =>
                    value &&
                    typeof value === 'object' &&
                    Number.isFinite(value.left) &&
                    Number.isFinite(value.top),
                deserialize: (value, context) => new context.fabric.Rect(value),
            },
        },
        stateCodec: {
            type: kind,
            version: '1.0.0',
            serialize: (object, context) => ({
                geometry: {
                    type: 'center',
                    point: context.toImageNormalized(object.getCenterPoint()),
                },
                metadata: { source: 'third-party' },
                data: {
                    width: context.toImageNormalizedScalar(object.getScaledWidth()),
                    height: context.toImageNormalizedScalar(object.getScaledHeight()),
                    fill: typeof object.fill === 'string' ? object.fill : '#3355ff',
                },
            }),
            validate: (value) =>
                value &&
                typeof value === 'object' &&
                value.geometry?.type === 'center' &&
                Number.isFinite(value.geometry.point?.x) &&
                Number.isFinite(value.geometry.point?.y) &&
                Number.isFinite(value.data?.width) &&
                Number.isFinite(value.data?.height) &&
                typeof value.data?.fill === 'string',
            deserialize: (value, context) => {
                const center = context.toCanvasPoint(value.geometry.point);
                return new fabric.Rect({
                    left: center.x,
                    top: center.y,
                    originX: 'center',
                    originY: 'center',
                    width: context.toCanvasScalar(value.data.width),
                    height: context.toCanvasScalar(value.data.height),
                    fill: value.data.fill,
                });
            },
        },
    });
    return kind;
}

async function dispose(editor) {
    await editor.disposeAsync();
    document.body.innerHTML = '';
}

test('Overlay State validates and freezes the renderer-independent schema', async () => {
    const { editor, state } = await createEditor();
    const result = state.validate(emptyDocument());
    assert.equal(result.valid, true);
    assert.equal(result.document.schema, 'image-editor.overlay-state');
    assert.equal(result.document.version, 1);
    assert.equal(result.document.coordinateSpace, 'image-normalized');
    assert.equal(Object.isFrozen(result.document), true);
    assert.equal(Object.isFrozen(result.document.overlays), true);
    assert.deepEqual(state.migrate(emptyDocument()), result.document);
    await dispose(editor);
});

test('Overlay State rejects future versions, unsafe values, cycles, and configured limits', async () => {
    const { editor, state } = await createEditor({ limits: { maxOverlays: 1, maxDepth: 6 } });
    assert.equal(state.validate(emptyDocument({ version: 2 })).valid, false);
    assert.equal(state.validate(emptyDocument({ metadata: { value: Number.NaN } })).valid, false);
    assert.equal(
        state.validate(emptyDocument({ metadata: { constructor: { polluted: true } } })).valid,
        false,
    );
    const cyclic = emptyDocument();
    cyclic.metadata = {};
    cyclic.metadata.self = cyclic.metadata;
    assert.equal(state.validate(cyclic).valid, false);
    assert.equal(state.validate(emptyDocument({ overlays: [{}, {}] })).valid, false);
    await dispose(editor);
});

test('Overlay State export and import require a loaded Base Image', async () => {
    const { editor, state } = await createEditor();
    assert.throws(() => state.exportState(), /Base Image/);
    await assert.rejects(state.importState(emptyDocument()), /Base Image/);
    await editor.loadImage(makeImageDataUrl({ width: 120, height: 80 }));
    assert.deepEqual(state.exportState().overlays, []);
    await dispose(editor);
});

test('Overlay State round-trips mixed official and third-party kinds without renderer data', async () => {
    const instance = await createFeatureEditor();
    const customKind = registerCustomKind(instance.overlay);
    const mask = await instance.masks.create({ left: 118, top: 18, width: 26, height: 22 });
    const textId = await instance.text.create({ text: 'Persisted', left: 24, top: 18 });
    const shapeId = await instance.shape.create({
        geometry: { kind: 'arrow', start: { x: 34, y: 42 }, end: { x: 112, y: 50 } },
    });
    const drawId = await createDraw(instance.draw);
    const custom = new fabric.Rect({ left: 76, top: 76, width: 18, height: 12, fill: '#3355ff' });
    custom.editorOverlayKind = customKind;
    custom.editorOverlayId = 'badge:one';
    await instance.overlay.add([custom]);
    await instance.overlay.setHidden(textId, true);
    await instance.overlay.setLocked(shapeId, true);

    const first = instance.state.exportState({ metadata: { document: { owner: 'test' } } });
    const second = instance.state.exportState({ metadata: { document: { owner: 'test' } } });
    assert.equal(JSON.stringify(first), JSON.stringify(second));
    assert.deepEqual(
        first.overlays.map((item) => item.id),
        [mask.maskUid, textId, shapeId, drawId, 'badge:one'],
    );
    assert.deepEqual(
        first.overlays.map((item) => item.kind),
        ['mask:object', 'annotation:text', 'annotation:shape', 'annotation:draw', customKind],
    );
    assert.equal(first.overlays.find((item) => item.id === textId).hidden, true);
    assert.equal(first.overlays.find((item) => item.id === shapeId).locked, true);
    assert.equal(
        first.overlays.find((item) => item.id === 'badge:one').metadata.source,
        'third-party',
    );
    const wire = JSON.stringify(first);
    assert.doesNotMatch(wire, /Fabric|fabric|pathOffset|_objects|activeSelection/);

    instance.history.clear();
    const imported = await instance.state.importState(first);
    assert.equal(imported.imported, 5);
    assert.equal(imported.skipped, 0);
    assert.equal(instance.history.length, 1);
    assert.equal(instance.overlay.list({ includeHidden: true, includeLocked: true }).length, 5);
    assert.equal(
        instance.overlay.classify(instance.overlay.getByPersistentId(textId)).hidden,
        true,
    );
    assert.equal(
        instance.overlay.classify(instance.overlay.getByPersistentId(shapeId)).locked,
        true,
    );
    const roundTrip = instance.state.exportState({ metadata: { document: { owner: 'test' } } });
    assert.deepEqual(
        roundTrip.overlays.map(({ id, kind, hidden, locked, layer }) => ({
            id,
            kind,
            hidden,
            locked,
            layer,
        })),
        first.overlays.map(({ id, kind, hidden, locked, layer }) => ({
            id,
            kind,
            hidden,
            locked,
            layer,
        })),
    );
    const originalMaskCorners = first.overlays.find((item) => item.kind === 'mask:object').geometry
        .corners;
    const importedMaskCorners = roundTrip.overlays.find((item) => item.kind === 'mask:object')
        .geometry.corners;
    originalMaskCorners.forEach((point, index) => {
        assert.ok(Math.abs(point.x - importedMaskCorners[index].x) < 1e-8);
        assert.ok(Math.abs(point.y - importedMaskCorners[index].y) < 1e-8);
    });
    await dispose(instance.editor);
});

test('Overlay State coordinates stay image-relative through scale, rotation, and flips', async () => {
    const instance = await createFeatureEditor();
    await instance.masks.create({ left: 42, top: 31, width: 34, height: 24, angle: 19 });
    const before = instance.state.exportState();
    await instance.transform.scale(1.35);
    await instance.transform.rotate(90);
    await instance.transform.flipHorizontal();
    await instance.transform.flipVertical();
    const after = instance.state.exportState();
    const beforeCorners = before.overlays[0].geometry.corners;
    const afterCorners = after.overlays[0].geometry.corners;
    beforeCorners.forEach((point, index) => {
        assert.ok(
            Math.abs(point.x - afterCorners[index].x) < 0.003,
            JSON.stringify({ before: point, after: afterCorners[index] }),
        );
        assert.ok(
            Math.abs(point.y - afterCorners[index].y) < 0.003,
            JSON.stringify({ before: point, after: afterCorners[index] }),
        );
    });
    await dispose(instance.editor);
});

test('Overlay State append rejects conflicts or returns an immutable regenerated ID map', async () => {
    const instance = await createFeatureEditor();
    const mask = await instance.masks.create({ left: 52, top: 38 });
    const document = instance.state.exportState();
    await assert.rejects(
        instance.state.importState(document, { mode: 'append' }),
        /already exists/,
    );
    const result = await instance.state.importState(document, {
        mode: 'append',
        idConflict: 'regenerate',
    });
    assert.equal(result.imported, 1);
    assert.equal(result.idMap[mask.maskUid], `${mask.maskUid}:copy-1`);
    assert.equal(Object.isFrozen(result.idMap), true);
    assert.throws(() => {
        result.idMap[mask.maskUid] = 'changed';
    }, TypeError);
    assert.ok(instance.overlay.getByPersistentId(`${mask.maskUid}:copy-1`));
    await dispose(instance.editor);
});

test('Overlay State missing-kind skip never accepts malformed installed codec data', async () => {
    const instance = await createFeatureEditor();
    await instance.masks.create();
    const document = instance.state.exportState();
    const unavailable = structuredClone(document);
    unavailable.overlays[0].kind = 'example:missing';
    unavailable.overlays[0].codec = { type: 'example:missing', version: '1.0.0' };
    assert.equal(instance.state.validate(unavailable).valid, false);
    assert.equal(instance.state.validate(unavailable, { missingKindPolicy: 'skip' }).valid, true);
    const skipped = await instance.state.importState(unavailable, {
        mode: 'append',
        missingKindPolicy: 'skip',
    });
    assert.equal(skipped.imported, 0);
    assert.equal(skipped.skipped, 1);

    const malformed = structuredClone(document);
    malformed.overlays[0].data.maskId = -1;
    assert.equal(instance.state.validate(malformed, { missingKindPolicy: 'skip' }).valid, false);
    await dispose(instance.editor);
});

test('Overlay State import rolls back an applied replacement when rendering fails', async () => {
    const instance = await createFeatureEditor();
    const original = await instance.masks.create({ left: 38, top: 28 });
    const document = instance.state.exportState();
    const changed = structuredClone(document);
    changed.overlays[0].data.name = 'replacement';
    const canvas = instance.editor.getCanvas();
    const requestRenderAll = canvas.requestRenderAll.bind(canvas);
    let failOnce = true;
    canvas.requestRenderAll = () => {
        if (failOnce) {
            failOnce = false;
            throw new Error('synthetic Overlay State render failure');
        }
        return requestRenderAll();
    };
    await assert.rejects(
        instance.state.importState(changed),
        /synthetic Overlay State render failure/,
    );
    const restored = instance.overlay.getByPersistentId(original.maskUid);
    assert.ok(restored);
    assert.equal(restored.maskName, original.maskName);
    canvas.requestRenderAll = requestRenderAll;
    await dispose(instance.editor);
});

test('Overlay State import remains atomic without History and isolates editor instances', async () => {
    const first = await createFeatureEditor({ historyEnabled: false });
    const firstMask = await first.masks.create({ left: 44, top: 32 });
    const document = first.state.exportState();
    first.history.clear();
    await first.state.importState(document);
    assert.equal(first.history.length, 0);

    const second = await createFeatureEditor({ historyEnabled: false });
    assert.equal(second.overlay.getByPersistentId(firstMask.maskUid), null);
    await second.state.importState(document);
    assert.ok(second.overlay.getByPersistentId(firstMask.maskUid));
    assert.ok(first.overlay.getByPersistentId(firstMask.maskUid));
    await dispose(first.editor, second.editor);
});
