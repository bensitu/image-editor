import assert from 'node:assert/strict';
import test from 'node:test';

import { ImageEditorCore } from '../../../src/core/index.js';
import {
    overlayFoundationPlugin,
    overlayFoundationRef,
} from '../../../src/foundations/overlay/index.js';
import { transformPlugin } from '../../../src/plugins/transform/index.js';
import { fabric, makeImageDataUrl, resetEditorDom } from '../../helpers/fabric-environment.mjs';

const TEST_KIND = 'example-test:rect-overlay';
const TEST_OWNER = 'example-test:rect-plugin';

function createEditor(options = {}) {
    const ids = resetEditorDom({ containerWidth: 320, containerHeight: 240 });
    const warnings = [];
    const editor = new ImageEditorCore(fabric, {
        canvasWidth: 320,
        canvasHeight: 240,
        onWarning: (error, message) => warnings.push({ error, message }),
        ...options,
    });
    const overlay = editor.use(overlayFoundationPlugin());
    return { editor, ids, overlay, warnings };
}

function registerRectKind(overlay) {
    const kind = overlay.registerKind({
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
                    flipX: object.flipX,
                    flipY: object.flipY,
                    fill: object.fill,
                }),
                validate: (value) =>
                    typeof value === 'object' &&
                    value !== null &&
                    Number.isFinite(value.left) &&
                    Number.isFinite(value.top) &&
                    Number.isFinite(value.width) &&
                    Number.isFinite(value.height),
                deserialize: (value, context) => new context.fabric.Rect(value),
            },
        },
    });
    return kind;
}

function addRect(editor, id, options = {}) {
    const rect = new fabric.Rect({
        left: 24,
        top: 18,
        width: 32,
        height: 20,
        fill: '#ff3366',
        ...options,
    });
    rect.editorOverlayKind = TEST_KIND;
    rect.editorOverlayId = id;
    editor.getCanvas().add(rect);
    return rect;
}

async function initializeAndLoad(editor, ids) {
    await editor.init({ canvas: ids.canvas, canvasContainer: ids.canvasContainer });
    await editor.loadImage(makeImageDataUrl({ width: 120, height: 80 }));
}

async function dispose(editor) {
    await editor.disposeAsync();
    document.body.innerHTML = '';
}

test('kind registry indexes persistent ids and isolates predicate and duplicate failures', async () => {
    const { editor, ids, overlay, warnings } = createEditor();
    const failingKind = overlay.registerKind({
        id: 'example-test:failing-kind',
        ownerPluginId: 'example-test:failing-owner',
        classify: () => {
            throw new Error('predicate failed');
        },
        getPersistentId: () => null,
        persistence: { mode: 'transient' },
    });
    const registration = registerRectKind(overlay);
    await initializeAndLoad(editor, ids);
    const first = addRect(editor, 'rect:one');
    const duplicate = addRect(editor, 'rect:one', { left: 90 });
    assert.equal(overlay.getByPersistentId('rect:one'), first);
    assert.equal(overlay.classify(first).ownerPluginId, TEST_OWNER);
    assert.equal(overlay.classify(duplicate), null);
    assert.ok(warnings.some((warning) => /predicate/.test(warning.message)));
    assert.ok(warnings.some((warning) => /already in use/.test(warning.message)));
    registration.dispose();
    assert.equal(overlay.getByPersistentId('rect:one'), null);
    failingKind.dispose();
    await dispose(editor);
});

test('selection, hidden, locked, and layer operations preserve the base-image boundary', async () => {
    const { editor, ids, overlay } = createEditor();
    registerRectKind(overlay);
    await initializeAndLoad(editor, ids);
    const first = addRect(editor, 'rect:first', { left: 10 });
    const second = addRect(editor, 'rect:second', { left: 50 });
    const third = addRect(editor, 'rect:third', { left: 90 });

    await overlay.sendToBack('rect:third');
    assert.deepEqual(
        overlay.list({ includeLocked: true }).map((object) => object.editorOverlayId),
        ['rect:third', 'rect:first', 'rect:second'],
    );
    await overlay.bringToFront('rect:third');
    assert.equal(editor.getCanvas().getObjects()[0].editorObjectKind, 'baseImage');
    assert.deepEqual(
        overlay.list({ includeLocked: true }).map((object) => object.editorOverlayId),
        ['rect:first', 'rect:second', 'rect:third'],
    );

    const selections = [];
    const listener = overlay.onSelectionChange((state) => selections.push(state));
    overlay.select(['rect:first', 'rect:second']);
    assert.deepEqual(overlay.getSelection().ids, ['rect:first', 'rect:second']);
    await overlay.setLocked('rect:first', true);
    assert.equal(first.selectable, false);
    assert.equal(overlay.getSelection().ids.length, 0);
    await overlay.setHidden('rect:second', true);
    assert.equal(second.visible, false);
    await overlay.setHidden('rect:second', false);
    assert.equal(second.visible, true);
    assert.ok(selections.length >= 2);
    listener.dispose();
    assert.ok(third.canvas);
    await dispose(editor);
});

test('preview visibility leases remain outside classification, Snapshot, and export', async () => {
    const { editor, ids, overlay } = createEditor();
    registerRectKind(overlay);
    await initializeAndLoad(editor, ids);
    const rect = addRect(editor, 'rect:preview-hidden', { left: 42, top: 31 });
    const snapshot = editor.saveState();
    const exported = await editor.exportImageBase64({ area: 'canvas', format: 'png' });

    const firstLease = overlay.hideForPreview(['rect:preview-hidden']);
    const secondLease = overlay.hideForPreview(['rect:preview-hidden']);
    assert.equal(rect.visible, false);
    assert.equal(overlay.classify(rect).hidden, false);
    assert.equal(overlay.list().includes(rect), true);
    assert.equal(editor.saveState(), snapshot);
    assert.equal(await editor.exportImageBase64({ area: 'canvas', format: 'png' }), exported);

    firstLease.dispose();
    assert.equal(rect.visible, false);
    secondLease.dispose();
    assert.equal(rect.visible, true);

    await overlay.setHidden('rect:preview-hidden', true);
    const hiddenLease = overlay.hideForPreview(['rect:preview-hidden']);
    hiddenLease.dispose();
    assert.equal(rect.visible, false);
    assert.equal(overlay.classify(rect).hidden, true);
    await dispose(editor);
});

test('one Overlay geometry participant applies final transform deltas in place', async () => {
    const { editor, ids, overlay } = createEditor();
    registerRectKind(overlay);
    const transform = editor.use(transformPlugin({ animationDuration: 0 }));
    await initializeAndLoad(editor, ids);
    const rect = addRect(editor, 'rect:bound', { left: 40, top: 30 });
    const identity = rect;
    const beforeCenter = rect.getCenterPoint();
    await transform.scale(1.5);
    assert.equal(overlay.getByPersistentId('rect:bound'), identity);
    assert.ok(Math.abs(rect.scaleX - 1.5) < 1e-8);
    await transform.rotate(90);
    await transform.flipHorizontal();
    const afterCenter = rect.getCenterPoint();
    assert.ok(Number.isFinite(afterCenter.x) && Number.isFinite(afterCenter.y));
    assert.notDeepEqual(
        { x: afterCenter.x, y: afterCenter.y },
        { x: beforeCenter.x, y: beforeCenter.y },
    );
    assert.equal(overlay.getByPersistentId('rect:bound'), rect);
    await dispose(editor);
});

test('snapshot round-trip restores serialized overlays and rejects duplicate ids transactionally', async () => {
    const { editor, ids, overlay } = createEditor();
    registerRectKind(overlay);
    await initializeAndLoad(editor, ids);
    const original = addRect(editor, 'rect:persisted', { left: 73, angle: 17 });
    const snapshot = editor.saveState();
    editor.getCanvas().remove(original);
    assert.equal(overlay.getByPersistentId('rect:persisted'), null);
    await editor.loadFromState(snapshot);
    const restored = overlay.getByPersistentId('rect:persisted');
    assert.ok(restored);
    assert.notEqual(restored, original);
    assert.equal(restored.left, 73);
    assert.equal(restored.angle, 17);

    const malformed = JSON.parse(snapshot);
    malformed.plugins['foundation:overlay'].data.overlays.push({
        ...malformed.plugins['foundation:overlay'].data.overlays[0],
    });
    await assert.rejects(editor.loadFromState(malformed), /Overlay Foundation state is malformed/);
    const afterRejectedLoad = overlay.getByPersistentId('rect:persisted');
    assert.ok(afterRejectedLoad);
    assert.equal(afterRejectedLoad.left, restored.left);
    assert.equal(afterRejectedLoad.angle, restored.angle);
    await dispose(editor);
});

test('Snapshot rejects an unregistered object marked as a persistent Overlay', async () => {
    const { editor, ids } = createEditor();
    await initializeAndLoad(editor, ids);
    const unsafe = new fabric.Rect({ left: 12, top: 16, width: 20, height: 18 });
    unsafe.editorOverlayKind = 'example-test:unregistered-persistent-kind';
    unsafe.editorOverlayId = 'unsafe:one';
    editor.getCanvas().add(unsafe);

    assert.throws(() => editor.saveState(), /Persistent overlay kind .* is not registered/);

    await dispose(editor);
});

test('snapshot round-trip restores the persistent overlay selection', async () => {
    const { editor, ids, overlay } = createEditor();
    registerRectKind(overlay);
    await initializeAndLoad(editor, ids);
    addRect(editor, 'rect:selected', { left: 73 });
    overlay.select(['rect:selected']);
    const snapshot = editor.saveState();
    overlay.discardSelection();

    await editor.loadFromState(snapshot);

    assert.deepEqual(overlay.getSelection().ids, ['rect:selected']);
    await dispose(editor);
});

test('export contributors render from a copy and never mutate the live overlay', async () => {
    const { editor, ids, overlay } = createEditor();
    registerRectKind(overlay);
    await initializeAndLoad(editor, ids);
    const rect = addRect(editor, 'rect:export', { left: 42, top: 31, angle: 11 });
    let renderCount = 0;
    const renderer = overlay.registerExportRenderer({
        id: `${TEST_KIND}-renderer`,
        kind: TEST_KIND,
        ownerPluginId: TEST_OWNER,
        order: 10,
        async render(context) {
            renderCount += 1;
            context.targetCanvas.add(await context.source.clone());
        },
    });
    const before = {
        left: rect.left,
        top: rect.top,
        angle: rect.angle,
        canvas: rect.canvas,
        objectCount: editor.getCanvas().getObjects().length,
    };
    const dataUrl = await editor.exportImageBase64({ area: 'canvas', format: 'png' });
    assert.match(dataUrl, /^data:image\/png;base64,/);
    assert.equal(renderCount, 1);
    assert.deepEqual(
        {
            left: rect.left,
            top: rect.top,
            angle: rect.angle,
            canvas: rect.canvas,
            objectCount: editor.getCanvas().getObjects().length,
        },
        before,
    );
    renderer.dispose();
    await dispose(editor);
});

test('flatten replaces the raster once, removes only queried overlays, and keeps index order valid', async () => {
    const { editor, ids, overlay } = createEditor();
    registerRectKind(overlay);
    await initializeAndLoad(editor, ids);
    addRect(editor, 'rect:flatten', { left: 12 });
    const retained = addRect(editor, 'rect:retained', { left: 92 });
    await overlay.flatten({ ids: ['rect:flatten'], includeLocked: true });
    assert.equal(overlay.getByPersistentId('rect:flatten'), null);
    assert.equal(overlay.getByPersistentId('rect:retained'), retained);
    assert.equal(retained.visible, true);
    assert.equal(editor.getCanvas().getObjects()[0].editorObjectKind, 'baseImage');
    assert.equal(editor.isImageLoaded(), true);
    await dispose(editor);
});

test('typed PluginRef retrieves the same Overlay Foundation API instance', async () => {
    const { editor, ids, overlay } = createEditor();
    assert.equal(editor.getPlugin(overlayFoundationRef), overlay);
    await editor.init({ canvas: ids.canvas });
    await dispose(editor);
});
