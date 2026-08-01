import assert from 'node:assert/strict';
import test from 'node:test';

import { ImageEditorCore, definePluginRef } from '../../../src/core/index.js';
import { GEOMETRY_MUTATION_CAPABILITY } from '../../../src/core-runtime/internal-capabilities.js';
import {
    overlayFoundationPlugin,
    overlayFoundationRef,
} from '../../../src/foundations/overlay/index.js';
import { maskPlugin, maskPluginRef } from '../../../src/plugins/mask/index.js';
import {
    MaskPluginController,
    resolveMaskPluginOptions,
} from '../../../src/plugins/mask/mask-controller.js';
import { syncMaskLabel } from '../../../src/mask/mask-label-manager.js';
import { transformPlugin } from '../../../src/plugins/transform/index.js';
import { disposeInReverse } from '../../../src/plugin-kernel/disposable.js';
import { fabric, makeImageDataUrl, resetEditorDom } from '../../helpers/fabric-environment.mjs';

async function createEditor(
    maskOptions = {},
    { transformOptions = null, beforeMask, coreOptions = {} } = {},
) {
    const ids = resetEditorDom({ containerWidth: 360, containerHeight: 260 });
    const warnings = [];
    const editor = new ImageEditorCore(fabric, {
        canvasWidth: 360,
        canvasHeight: 260,
        ...coreOptions,
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

test('Mask registrations use Plugin scope disposal with complete async error aggregation', async () => {
    const disposalOrder = [];
    const owned = [];
    let registeredKind = null;
    const synchronousFailure = new Error('synthetic synchronous cleanup failure');
    const promiseFailure = new Error('synthetic Promise cleanup failure');
    const thenableFailure = new Error('synthetic thenable cleanup failure');
    const registration = (name, failure = null) => ({
        dispose() {
            disposalOrder.push(name);
            if (failure === 'sync') throw synchronousFailure;
            if (failure === 'promise') return Promise.reject(promiseFailure);
            if (failure === 'thenable') {
                return {
                    then(resolve, reject) {
                        void resolve;
                        reject(thenableFailure);
                    },
                };
            }
            return undefined;
        },
    });
    const disposables = {
        active: true,
        add(disposable) {
            owned.push(disposable);
            return disposable;
        },
    };
    const overlay = {
        registerKind: (definition) => {
            registeredKind = definition;
            return registration('kind');
        },
        registerGeometryPolicy: () => registration('geometry', 'sync'),
        registerExportRenderer: () => registration('export'),
        registerInteractionPolicy: () => registration('interaction'),
        onSelectionChange: () => registration('selection', 'promise'),
    };
    const state = {
        registerTransientObject: () => registration('transient', 'thenable'),
        registerSlice: () => registration('slice'),
    };
    const host = {
        fabric,
        backgroundColor: '#ffffff',
        layoutMode: 'fit',
        getCanvas: () => null,
        requireCanvas: () => {
            throw new Error('Canvas is unavailable in the disposal fixture.');
        },
        requestRender: () => undefined,
        resizeCanvas: () => undefined,
        reportWarning: () => undefined,
        reportError: () => undefined,
    };
    const controller = new MaskPluginController(
        host,
        state,
        overlay,
        disposables,
        resolveMaskPluginOptions({ label: false }),
    );
    assert.equal(registeredKind.exportByDefault, true);

    controller.dispose();
    assert.deepEqual(disposalOrder, []);
    const errors = await disposeInReverse(owned);

    assert.deepEqual(disposalOrder, [
        'selection',
        'slice',
        'transient',
        'interaction',
        'export',
        'geometry',
        'kind',
    ]);
    assert.deepEqual(errors, [promiseFailure, thenableFailure, synchronousFailure]);
});

test('Mask Plugin creates every built-in shape and custom Fabric generators with stable ids', async () => {
    const changes = [];
    let observedFactoryOptions = null;
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
        fabricGenerator: (config, _canvas, options) => {
            observedFactoryOptions = options;
            return new fabric.Triangle({
                width: config.width,
                height: config.height,
                fill: '#111111',
            });
        },
    });
    assert.ok(rect instanceof fabric.Rect);
    assert.ok(circle instanceof fabric.Circle);
    assert.ok(ellipse instanceof fabric.Ellipse);
    assert.ok(polygon instanceof fabric.Polygon);
    assert.ok(custom instanceof fabric.Triangle);
    assert.deepEqual(
        masks.getAll().map((mask) => mask.maskId),
        [5, 4, 3, 2, 1],
    );
    assert.deepEqual(
        masks.getAll().map((mask) => mask.maskName),
        ['mask5', 'mask4', 'mask3', 'mask2', 'mask1'],
    );
    assert.equal(overlay.getByPersistentId('mask-5'), custom);
    assert.equal(changes.length, 5);
    assert.equal(Object.isFrozen(observedFactoryOptions), true);
    assert.deepEqual(Object.keys(observedFactoryOptions).sort(), [
        'defaultMaskConfig',
        'defaultMaskHeight',
        'defaultMaskWidth',
        'label',
        'layoutMode',
        'maskLabelOffset',
        'maskLabelOnSelect',
        'maskListOrder',
        'maskName',
        'maskRotatable',
        'onWarning',
    ]);
    await dispose(editor);
});

test('Mask creation renders synchronously before invoking onCreate', async () => {
    const { editor, masks } = await createEditor({ label: false });
    await load(editor);
    const canvas = editor.getCanvas();
    const originalRenderAll = canvas.renderAll.bind(canvas);
    let renderCount = 0;
    let observedRenderCount = 0;
    canvas.renderAll = (...args) => {
        renderCount += 1;
        return originalRenderAll(...args);
    };

    await masks.create({
        onCreate(mask, callbackCanvas) {
            assert.equal(callbackCanvas, canvas);
            assert.equal(callbackCanvas.getActiveObject(), mask);
            observedRenderCount = renderCount;
        },
    });

    assert.ok(observedRenderCount > 0);
    await dispose(editor);
});

test('repeated moving, scaling, and rotating label syncs request batched paints', () => {
    resetEditorDom();
    const mask = new fabric.Rect({
        left: 20,
        top: 20,
        width: 44,
        height: 36,
        originX: 'left',
        originY: 'top',
    });
    const label = new fabric.FabricText('mask1', {
        left: 0,
        top: 0,
        originX: 'left',
        originY: 'top',
    });
    mask.labelObject = label;
    mask.setCoords();
    let renderAllCalls = 0;
    let requestRenderAllCalls = 0;
    const canvas = {
        renderAll() {
            renderAllCalls += 1;
        },
        requestRenderAll() {
            requestRenderAllCalls += 1;
        },
    };
    const context = {
        fabric,
        canvas,
        options: {
            maskLabelOnSelect: true,
            maskLabelOffset: 5,
        },
    };

    for (const transform of [{ left: 80, top: 65 }, { scaleX: 1.4, scaleY: 1.2 }, { angle: 31 }]) {
        mask.set(transform);
        mask.setCoords();
        for (let index = 0; index < 3; index += 1) syncMaskLabel(context, mask);
    }

    assert.equal(label.angle, 31);
    assert.notDeepEqual({ left: label.left, top: label.top }, { left: 0, top: 0 });
    assert.deepEqual(label.aCoords, label.calcACoords());
    assert.equal(renderAllCalls, 0);
    assert.equal(requestRenderAllCalls, 9);
});

test('Mask creation rejects canvas expansion beyond configured resource budgets', async () => {
    const scenarios = [
        {
            coreOptions: { maxExportDimension: 400, maxExportPixels: 1_000_000 },
            config: { left: 390, top: 10, width: 20, height: 20 },
        },
        {
            coreOptions: { maxExportDimension: 1_000, maxExportPixels: 95_000 },
            config: { left: 350, top: 240, width: 20, height: 20 },
        },
    ];

    for (const { coreOptions, config } of scenarios) {
        const { editor, ids, masks } = await createEditor({ label: false }, { coreOptions });
        try {
            await load(editor);
            const canvas = document.getElementById(ids.canvas);
            assert.ok(canvas instanceof HTMLCanvasElement);
            const before = { width: canvas.width, height: canvas.height };

            await assert.rejects(masks.create(config), /Dimensions exceed the configured budget/);

            assert.deepEqual({ width: canvas.width, height: canvas.height }, before);
            assert.equal(masks.getAll().length, 0);
        } finally {
            await dispose(editor);
        }
    }
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
        [first.maskUid, second.maskUid, third.maskUid],
    );
    await masks.remove(second.maskUid);
    assert.equal(masks.getAll().length, 2);
    overlay.select([first.maskUid]);
    await masks.removeSelected();
    assert.deepEqual(
        masks.getAll().map((mask) => mask.maskUid),
        [third.maskUid],
    );
    await masks.removeAll();
    assert.equal(masks.getAll().length, 0);
    const resetCounterMask = await masks.create();
    assert.equal(resetCounterMask.maskId, 1);
    await dispose(editor);
});

test('list selection keeps an overlapping Mask as the canvas interaction target', async () => {
    const { editor, masks, overlay } = await createEditor({ label: false });
    await load(editor);
    const lower = await masks.create({ left: 40, top: 35, width: 64, height: 48 });
    const upper = await masks.create({ left: 40, top: 35, width: 64, height: 48 });
    const canvas = editor.getCanvas();
    const layerOrder = canvas.getObjects().slice();

    overlay.select([lower.maskUid]);
    Object.defineProperty(canvas.upperCanvasEl, 'getBoundingClientRect', {
        configurable: true,
        value: () => ({
            bottom: 260,
            height: 260,
            left: 0,
            right: 360,
            top: 0,
            width: 360,
        }),
    });
    const event = {
        altKey: false,
        clientX: 60,
        clientY: 55,
        target: canvas.upperCanvasEl,
        type: 'mousedown',
    };
    canvas._resetTransformEventData();

    assert.equal(canvas.getActiveObject(), lower);
    assert.equal(canvas.findTarget(event).target, lower);
    assert.deepEqual(canvas.getObjects(), layerOrder);
    assert.ok(canvas.getObjects().indexOf(lower) < canvas.getObjects().indexOf(upper));
    await dispose(editor);
});

test('one pointer click switches between non-overlapping Masks', async () => {
    const { editor, masks, overlay } = await createEditor();
    await load(editor);
    const first = await masks.create({ left: 40, top: 35, width: 64, height: 48 });
    const second = await masks.create({ left: 150, top: 120, width: 64, height: 48 });
    const canvas = editor.getCanvas();
    Object.defineProperty(canvas.upperCanvasEl, 'getBoundingClientRect', {
        configurable: true,
        value: () => ({
            bottom: 260,
            height: 260,
            left: 0,
            right: 360,
            top: 0,
            width: 360,
        }),
    });
    const click = (x, y) => {
        canvas._onMouseDown(
            new window.MouseEvent('mousedown', {
                bubbles: true,
                button: 0,
                clientX: x,
                clientY: y,
            }),
        );
        canvas._onMouseUp(
            new window.MouseEvent('mouseup', {
                bubbles: true,
                button: 0,
                clientX: x,
                clientY: y,
            }),
        );
    };

    click(60, 55);
    await overlay.waitForIdle();
    assert.equal(canvas.getActiveObject(), first);
    assert.equal(overlay.getSelection().primaryId, first.maskUid);

    click(170, 140);
    await overlay.waitForIdle();
    assert.equal(canvas.getActiveObject(), second);
    assert.equal(overlay.getSelection().primaryId, second.maskUid);
    await dispose(editor);
});

test('list-selected overlapping Mask keeps its label aligned during a live drag', async () => {
    const { editor, masks, overlay } = await createEditor({ labelOffset: 5 });
    await load(editor);
    const lower = await masks.create({ left: 40, top: 35, width: 64, height: 48 });
    await masks.create({ left: 40, top: 35, width: 64, height: 48 });
    const canvas = editor.getCanvas();

    overlay.select([lower.maskUid]);
    assert.ok(lower.labelObject);
    const label = lower.labelObject;
    const before = { left: label.left, top: label.top };
    const maskLayerOrder = canvas
        .getObjects()
        .filter((object) => object.editorObjectKind === 'mask');

    canvas.fire('before:transform', {
        transform: { action: 'drag', target: lower },
    });
    // Keep the target's aCoords stale to mirror Fabric's drag event order.
    lower.set({ left: 160, top: 95 });
    canvas.fire('object:moving', { target: lower });
    await Promise.resolve();
    await Promise.resolve();

    assert.notDeepEqual({ left: label.left, top: label.top }, before);
    assert.deepEqual(
        canvas.getObjects().filter((object) => object.editorObjectKind === 'mask'),
        maskLayerOrder,
    );

    lower.setCoords();
    canvas.fire('object:modified', { target: lower });
    await overlay.waitForIdle();
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
    await masks.removeAll();
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
    const canvas = editor.getCanvas();
    canvas.fire('before:transform', {
        transform: { action: 'drag', target: mask },
    });
    // Fabric emits object:moving before refreshing the target's aCoords.
    mask.set({ left: 80, top: 65 });
    canvas.fire('object:moving', { target: mask });
    await Promise.resolve();
    await Promise.resolve();
    assert.notDeepEqual({ left: label.left, top: label.top }, before);
    mask.setCoords();
    canvas.fire('object:modified', { target: mask });
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
                        context.disposables.add(
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
