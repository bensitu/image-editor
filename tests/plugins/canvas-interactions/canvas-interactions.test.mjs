import assert from 'node:assert/strict';
import test from 'node:test';

import { ImageEditorCore } from '../../../src/core/index.js';
import { createFullPreset } from '../../../src/presets/full/index.js';
import { shapeAnnotationPluginRef } from '../../../src/plugins/annotation-shape/index.js';
import {
    canvasInteractionsPlugin,
    canvasInteractionsPluginRef,
} from '../../../src/plugins/canvas-interactions/index.js';
import {
    CanvasPropertyLease,
    CanvasPropertyLeaseGroup,
} from '../../../src/plugins/canvas-interactions/canvas-property-lease.js';
import { FabricPointerSource } from '../../../src/plugins/canvas-interactions/fabric-pointer-source.js';
import { PointerCoordinateMapper } from '../../../src/plugins/canvas-interactions/pointer-coordinate-mapper.js';
import { fabric, makeImageDataUrl, resetEditorDom } from '../../helpers/fabric-environment.mjs';

async function waitFor(predicate, message) {
    for (let attempt = 0; attempt < 100; attempt += 1) {
        if (predicate()) return;
        await new Promise((resolve) => setTimeout(resolve, 5));
    }
    assert.fail(message);
}

test('Canvas Interactions installs as an optional Plugin with an isolated status lifecycle', async () => {
    const ids = resetEditorDom({ containerWidth: 320, containerHeight: 240 });
    const editor = new ImageEditorCore(fabric, { canvasWidth: 320, canvasHeight: 240 });
    const interactions = editor.use(canvasInteractionsPlugin());
    const statuses = [];
    const subscription = interactions.subscribe((status) => statuses.push(status));

    await editor.init({ canvas: ids.canvas, canvasContainer: ids.canvasContainer });
    assert.equal(editor.requirePlugin(canvasInteractionsPluginRef), interactions);
    assert.deepEqual(interactions.getStatus(), {
        isBound: true,
        isDisposed: false,
        activeBindingId: null,
        gestureActive: false,
    });
    await interactions.cancel();
    subscription.dispose();
    await editor.disposeAsync();
    document.body.innerHTML = '';

    assert.deepEqual(statuses, [
        {
            isBound: false,
            isDisposed: false,
            activeBindingId: null,
            gestureActive: false,
        },
        {
            isBound: true,
            isDisposed: false,
            activeBindingId: null,
            gestureActive: false,
        },
    ]);
});

test('Canvas property leases restore owned values without overwriting host changes', () => {
    const canvasState = { defaultCursor: 'default', selection: true };
    const leases = new CanvasPropertyLeaseGroup();
    leases.add(new CanvasPropertyLease(canvasState, 'defaultCursor', 'crosshair'));
    leases.add(new CanvasPropertyLease(canvasState, 'selection', false));
    assert.deepEqual(canvasState, { defaultCursor: 'crosshair', selection: false });

    canvasState.defaultCursor = 'wait';
    leases.dispose();
    assert.deepEqual(canvasState, { defaultCursor: 'wait', selection: true });
});

test('Pointer coordinates use the complete Base Image transform and preserve image boundaries', () => {
    const image = new fabric.Rect({
        width: 120,
        height: 80,
        left: 210,
        top: 160,
        originX: 'center',
        originY: 'center',
        angle: 30,
        scaleX: 1.5,
        scaleY: 0.75,
        flipX: true,
    });
    const mapper = new PointerCoordinateMapper({
        getBaseImage: () => image,
        getBaseImageScale: () => 1,
        getGeometryRevision: () => 7,
        getCanvasSize: () => ({ width: 640, height: 480 }),
        getImageInfo: () => ({
            naturalWidth: 120,
            naturalHeight: 80,
            mimeType: 'image/png',
            geometryRevision: 7,
        }),
        isImageLoaded: () => true,
    });
    const insideScene = new fabric.Point(-30, 10).transform(image.calcTransformMatrix());
    const outsideScene = new fabric.Point(61, 0).transform(image.calcTransformMatrix());

    const inside = mapper.toImagePoint(insideScene);
    assert.ok(inside);
    assert.ok(Math.abs(inside.x - 30) < 1e-10);
    assert.ok(Math.abs(inside.y - 50) < 1e-10);
    assert.equal(mapper.toImagePoint(outsideScene), null);
    assert.equal(mapper.getGeometryRevision(), 7);
});

test('Pointer source owns one primary pointer and detaches every listener', () => {
    resetEditorDom();
    const listeners = new Map();
    const upperCanvasEl = document.createElement('canvas');
    const canvas = {
        upperCanvasEl,
        on(name, listener) {
            listeners.set(name, listener);
            return () => listeners.delete(name);
        },
        getScenePoint: () => ({ x: 90, y: 70 }),
    };
    const received = [];
    let cancelled = 0;
    const source = new FabricPointerSource(
        canvas,
        {
            getGeometryRevision: () => 4,
            toImagePoint: ({ x, y }) => ({ x: x / 2, y: y / 2 }),
        },
        {
            down: (sample) => received.push(['down', sample]),
            move: (sample) => received.push(['move', sample]),
            up: (sample) => received.push(['up', sample]),
            cancel: () => {
                cancelled += 1;
            },
        },
    );
    const event = (pointerId, x, y, overrides = {}) => ({
        e: {
            pointerId,
            pointerType: 'mouse',
            isPrimary: true,
            button: 0,
            timeStamp: 25,
            ...overrides,
        },
        scenePoint: { x, y },
        target: null,
    });

    listeners.get('mouse:down')(event(2, 20, 40));
    listeners.get('mouse:down')(event(3, 100, 120));
    listeners.get('mouse:move')(event(3, 30, 50));
    listeners.get('mouse:move')(event(2, 30, 50));
    assert.deepEqual(
        received.map(([kind, sample]) => [kind, sample.canvasPoint, sample.imagePoint]),
        [
            ['down', { x: 20, y: 40 }, { x: 10, y: 20 }],
            ['move', { x: 30, y: 50 }, { x: 15, y: 25 }],
        ],
    );
    assert.ok(Object.isFrozen(received[0][1]));
    assert.ok(Object.isFrozen(received[0][1].canvasPoint));
    assert.equal(received[0][1].geometryRevision, 4);

    window.dispatchEvent(new window.Event('blur'));
    assert.equal(cancelled, 1);
    source.dispose();
    assert.equal(listeners.size, 0);
});

test('Shape pointer interaction commits through the public Feature API and restores Canvas properties', async () => {
    const ids = resetEditorDom({ containerWidth: 360, containerHeight: 260 });
    const preset = createFullPreset(fabric, { core: { canvasWidth: 360, canvasHeight: 260 } });
    const interactions = preset.editor.use(
        canvasInteractionsPlugin({
            shape: {
                plugin: {
                    ref: shapeAnnotationPluginRef,
                    resolve: () => preset.shape,
                },
            },
        }),
    );
    await preset.editor.init({ canvas: ids.canvas, canvasContainer: ids.canvasContainer });
    await preset.editor.loadImage(makeImageDataUrl({ width: 160, height: 100 }));
    const canvas = preset.editor.getCanvas();
    assert.ok(canvas);
    const original = {
        defaultCursor: canvas.defaultCursor,
        hoverCursor: canvas.hoverCursor,
        selection: canvas.selection,
        skipTargetFind: canvas.skipTargetFind,
    };

    await preset.shape.enter({ kind: 'rect' });
    assert.equal(canvas.defaultCursor, 'crosshair');
    assert.equal(canvas.selection, false);
    assert.equal(canvas.skipTargetFind, true);
    const fire = (name, x, y) =>
        canvas.fire(name, {
            e: { button: 0, isPrimary: true, pointerId: 1, pointerType: 'mouse' },
            scenePoint: new fabric.Point(x, y),
            target: null,
        });
    fire('mouse:down', 80, 70);
    fire('mouse:move', 150, 120);
    fire('mouse:up', 170, 140);
    await waitFor(
        () => preset.annotations.list({ kinds: ['annotation:shape'] }).length === 1,
        'Shape interaction did not commit.',
    );
    await waitFor(() => !interactions.getStatus().gestureActive, 'Pointer interaction did not settle.');

    assert.deepEqual(
        {
            defaultCursor: canvas.defaultCursor,
            hoverCursor: canvas.hoverCursor,
            selection: canvas.selection,
            skipTargetFind: canvas.skipTargetFind,
        },
        original,
    );
    await preset.editor.disposeAsync();
    document.body.innerHTML = '';
});
