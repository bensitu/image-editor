import assert from 'node:assert/strict';
import test from 'node:test';

import { ImageEditorCore, definePluginRef } from '../../../src/core/index.js';
import { GEOMETRY_MUTATION_CAPABILITY } from '../../../src/core-runtime/internal-capabilities.js';
import {
    overlayFoundationPlugin,
    overlayFoundationRef,
} from '../../../src/foundations/overlay/index.js';
import { maskPlugin, maskPluginRef } from '../../../src/plugins/mask/index.js';
import { transformPlugin } from '../../../src/plugins/transform/index.js';
import { fabric, makeImageDataUrl, resetEditorDom } from '../../helpers/fabric-environment.mjs';

async function createEditor(maskOptions = {}, { transformOptions = null, beforeMask } = {}) {
    const ids = resetEditorDom({ containerWidth: 360, containerHeight: 260 });
    const warnings = [];
    const editor = new ImageEditorCore(fabric, {
        canvasWidth: 360,
        canvasHeight: 260,
        onWarning: (error, message) => warnings.push({ error, message }),
    });
    const overlay = editor.use(overlayFoundationPlugin());
    beforeMask?.(editor);
    const masks = editor.use(maskPlugin(maskOptions));
    const transform = transformOptions ? editor.use(transformPlugin(transformOptions)) : null;
    await editor.init({ canvas: ids.canvas, canvasContainer: ids.canvasContainer });
    return { editor, ids, masks, overlay, transform, warnings };
}

async function load(editor) {
    await editor.loadImage(makeImageDataUrl({ width: 140, height: 90 }));
}

async function dispose(editor) {
    await editor.disposeAsync();
    document.body.innerHTML = '';
}

test('Mask Plugin creates every built-in shape and custom Fabric generators with stable ids', async () => {
    const changes = [];
    const { editor, masks, overlay } = await createEditor({
        defaultWidth: 44,
        defaultHeight: 36,
        label: false,
        onChange: (items) => changes.push(items.map((item) => item.maskUid)),
    });
    await load(editor);
    const rect = await masks.create();
    const circle = await masks.create({ shape: 'circle', radius: 12 });
    const ellipse = await masks.create({ shape: 'ellipse', rx: 18, ry: 9 });
    const polygon = await masks.create({
        shape: 'polygon',
        points: [
            [0, 0],
            [30, 0],
            [15, 24],
        ],
    });
    const custom = await masks.create({
        fabricGenerator: (config) =>
            new fabric.Triangle({ width: config.width, height: config.height, fill: '#111111' }),
    });
    assert.ok(rect instanceof fabric.Rect);
    assert.ok(circle instanceof fabric.Circle);
    assert.ok(ellipse instanceof fabric.Ellipse);
    assert.ok(polygon instanceof fabric.Polygon);
    assert.ok(custom instanceof fabric.Triangle);
    assert.deepEqual(
        masks.getAll().map((mask) => mask.maskId),
        [1, 2, 3, 4, 5],
    );
    assert.deepEqual(
        masks.getAll().map((mask) => mask.maskName),
        ['mask1', 'mask2', 'mask3', 'mask4', 'mask5'],
    );
    assert.equal(overlay.getByPersistentId('mask-5'), custom);
    assert.equal(changes.length, 5);
    await dispose(editor);
});

test('create, remove, removeSelected, and removeAll maintain counter and list ordering', async () => {
    const { editor, masks, overlay } = await createEditor({
        label: false,
        listOrder: 'back-to-front',
    });
    await load(editor);
    const first = await masks.create({ left: 10 });
    const second = await masks.create({ left: 60 });
    const third = await masks.create({ left: 110 });
    assert.deepEqual(
        masks.getAll().map((mask) => mask.maskUid),
        [third.maskUid, second.maskUid, first.maskUid],
    );
    await masks.remove(second.maskUid);
    assert.equal(masks.getAll().length, 2);
    overlay.select([first.maskUid]);
    await masks.removeSelected();
    assert.deepEqual(
        masks.getAll().map((mask) => mask.maskUid),
        [third.maskUid],
    );
    await masks.removeAll({ saveHistory: false });
    assert.equal(masks.getAll().length, 0);
    const resetCounterMask = await masks.create();
    assert.equal(resetCounterMask.maskId, 1);
    await dispose(editor);
});

test('Mask snapshot restores geometry, hidden/locked state, hover handlers, and counter', async () => {
    const { editor, masks, overlay } = await createEditor({ rotatable: true, label: false });
    await load(editor);
    const first = await masks.create({ left: 33, top: 29, angle: 17, alpha: 0.35 });
    const second = await masks.create({ shape: 'circle', left: 92, top: 48, radius: 14 });
    await overlay.setHidden(first.maskUid, true);
    await overlay.setLocked(second.maskUid, true);
    const snapshot = editor.saveState();
    await masks.removeAll({ saveHistory: false });
    await editor.loadFromState(snapshot);
    const restoredFirst = overlay.getByPersistentId(first.maskUid);
    const restoredSecond = overlay.getByPersistentId(second.maskUid);
    assert.ok(restoredFirst);
    assert.ok(restoredSecond);
    assert.equal(restoredFirst.left, 33);
    assert.equal(restoredFirst.angle, 17);
    assert.equal(restoredFirst.visible, false);
    assert.equal(restoredSecond.selectable, false);
    assert.equal(typeof restoredFirst.imageEditorMaskHandlers?.mouseover, 'function');
    const next = await masks.create();
    assert.equal(next.maskId, 3);
    await dispose(editor);
});

test('mask transform binding defaults off and opt-in preserves identity through mixed transforms', async () => {
    const disabled = await createEditor(
        { bindToImageTransform: false, label: false },
        { transformOptions: { animationDuration: 0 } },
    );
    await load(disabled.editor);
    const stationary = await disabled.masks.create({ left: 40, top: 30 });
    const beforeDisabled = {
        left: stationary.left,
        top: stationary.top,
        scaleX: stationary.scaleX,
        angle: stationary.angle,
        flipX: stationary.flipX,
    };
    await disabled.transform.scale(1.4);
    await disabled.transform.rotate(45);
    await disabled.transform.flipHorizontal();
    assert.deepEqual(
        {
            left: stationary.left,
            top: stationary.top,
            scaleX: stationary.scaleX,
            angle: stationary.angle,
            flipX: stationary.flipX,
        },
        beforeDisabled,
    );
    await dispose(disabled.editor);

    const enabled = await createEditor(
        { bindToImageTransform: true, label: false },
        { transformOptions: { animationDuration: 0 } },
    );
    await load(enabled.editor);
    const bound = await enabled.masks.create({ left: 40, top: 30 });
    const identity = bound;
    enabled.overlay.select([bound.maskUid]);
    await enabled.transform.scale(1.4);
    assert.equal(enabled.overlay.getSelection().ids.length, 0);
    await enabled.transform.rotate(45);
    await enabled.transform.flipHorizontal();
    await enabled.transform.flipHorizontal();
    await enabled.transform.flipVertical();
    await enabled.transform.flipVertical();
    assert.equal(enabled.overlay.getByPersistentId(bound.maskUid), identity);
    assert.ok(Math.abs(bound.scaleX - 1.4) < 1e-8);
    assert.ok(Math.abs(bound.skewY) < 1e-8);
    await enabled.transform.resetImageTransform();
    assert.equal(enabled.overlay.getByPersistentId(bound.maskUid), identity);
    await dispose(enabled.editor);
});

test('Mask labels are transient, track object movement, and never enter Snapshot or export', async () => {
    const { editor, masks, overlay } = await createEditor({ labelOffset: 5 });
    await load(editor);
    const mask = await masks.create({ left: 20, top: 20 });
    assert.ok(mask.labelObject);
    const label = mask.labelObject;
    const before = { left: label.left, top: label.top };
    mask.set({ left: 80, top: 65 });
    mask.setCoords();
    editor.getCanvas().fire('before:transform', {
        target: mask,
        transform: { action: 'drag' },
    });
    editor.getCanvas().fire('object:moving', { target: mask });
    editor.getCanvas().fire('object:modified', { target: mask });
    await overlay.waitForIdle();
    assert.notDeepEqual({ left: label.left, top: label.top }, before);
    const snapshot = editor.saveState();
    assert.doesNotMatch(snapshot, /maskLabel/);
    const liveStyle = {
        opacity: mask.opacity,
        fill: mask.fill,
        stroke: mask.stroke,
        strokeWidth: mask.strokeWidth,
        objectCount: editor.getCanvas().getObjects().length,
    };
    const exported = await editor.exportImageBase64({ area: 'canvas', format: 'png' });
    assert.match(exported, /^data:image\/png;base64,/);
    assert.deepEqual(
        {
            opacity: mask.opacity,
            fill: mask.fill,
            stroke: mask.stroke,
            strokeWidth: mask.strokeWidth,
            objectCount: editor.getCanvas().getObjects().length,
        },
        liveStyle,
    );
    overlay.discardSelection();
    assert.equal(mask.labelObject, undefined);
    await dispose(editor);
});

test('transform failure rolls Mask geometry and index back without replacing object identity', async () => {
    let failApply = false;
    const failureRef = definePluginRef('example-test:mask-transform-failure', '1.0.0');
    const { editor, masks, overlay, transform } = await createEditor(
        { bindToImageTransform: true, label: false },
        {
            transformOptions: { animationDuration: 0 },
            beforeMask(instance) {
                instance.use({
                    ref: failureRef,
                    version: '1.0.0',
                    setupMode: 'sync',
                    requires: [{ token: GEOMETRY_MUTATION_CAPABILITY, range: '^1.0.0' }],
                    permissions: ['core:geometry-participant'],
                    setup(context) {
                        const geometry = context.capabilities.require(GEOMETRY_MUTATION_CAPABILITY);
                        context.addDisposable(
                            geometry.registerParticipant({
                                id: failureRef.id,
                                order: 200,
                                supports: () => true,
                                apply: () => {
                                    if (failApply)
                                        throw new Error('synthetic mask transform failure');
                                },
                            }),
                        );
                        return Object.freeze({});
                    },
                });
            },
        },
    );
    await load(editor);
    const mask = await masks.create({ left: 50, top: 36 });
    const before = { left: mask.left, top: mask.top, scaleX: mask.scaleX, angle: mask.angle };
    failApply = true;
    await assert.rejects(transform.rotate(60), /synthetic mask transform failure/);
    assert.equal(overlay.getByPersistentId(mask.maskUid), mask);
    assert.deepEqual(
        { left: mask.left, top: mask.top, scaleX: mask.scaleX, angle: mask.angle },
        before,
    );
    await dispose(editor);
});

test('Mask flatten removes masks through the Foundation and plugin disposal detaches handlers', async () => {
    const { editor, masks, overlay } = await createEditor({ label: false });
    await load(editor);
    await masks.create();
    assert.equal(editor.getPlugin(maskPluginRef), masks);
    assert.equal(editor.getPlugin(overlayFoundationRef), overlay);
    await masks.flatten();
    assert.equal(masks.getAll().length, 0);
    assert.equal(editor.isImageLoaded(), true);

    const next = await masks.create();
    assert.ok(next.imageEditorMaskHandlers);
    const canvas = editor.getCanvas();
    await dispose(editor);
    assert.equal(next.imageEditorMaskHandlers, undefined);
    assert.equal(canvas.__eventListeners?.['object:moving']?.length ?? 0, 0);
});
