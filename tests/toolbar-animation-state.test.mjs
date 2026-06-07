/**
 * Type:
 *   Unit test
 *
 * Purpose:
 *   Verifies that toolbar controls are re-enabled after queued transform
 *   animations settle. The regression was caused by refreshing UI while the
 *   animation queue still reported itself busy, leaving most controls disabled
 *   after a single zoom or rotate action.
 *
 * Scope:
 *   - ImageEditor facade UI state after scaleImage and rotateImage.
 *   - Minimal Fabric and DOM stubs; no visual rendering.
 *
 * Out of scope:
 *   - Fabric rendering quality
 *   - pointer interaction details
 *   - unrelated mask/crop behavior
 *
 * Environment:
 *   - Node.js ESM
 *   - jsdom
 *
 * Run:
 *   node --test tests/toolbar-animation-state.test.mjs
 */

import { register } from 'node:module';

register('./helpers/ts-resolve-hook.mjs', import.meta.url);

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const { ImageEditor } = await import('../src/image-editor.ts');

const ENABLED_WHEN_IMAGE_LOADED = [
    'scalePercentageInput',
    'rotateLeftDegreesInput',
    'rotateRightDegreesInput',
    'zoomInButton',
    'zoomOutButton',
    'rotateLeftButton',
    'rotateRightButton',
    'createMaskButton',
    'downloadImageButton',
    'enterCropModeButton',
    'imageInput',
];

const ENABLED_AFTER_TRANSFORM = [...ENABLED_WHEN_IMAGE_LOADED, 'resetImageTransformButton'];

function installDom({ containerWidth = 800, containerHeight = 600 } = {}) {
    const dom = new JSDOM(
        `<!DOCTYPE html><html><body>
            <div id="canvasContainer">
                <canvas id="canvas"></canvas>
            </div>
            <div id="imagePlaceholder"></div>
            <input id="scalePercentageInput" value="100">
            <input id="rotateLeftDegreesInput" value="90">
            <input id="rotateRightDegreesInput" value="90">
            <button id="rotateLeftButton"></button>
            <button id="rotateRightButton"></button>
            <button id="createMaskButton"></button>
            <button id="removeSelectedMaskButton"></button>
            <button id="removeAllMasksButton"></button>
            <button id="mergeMasksButton"></button>
            <button id="downloadImageButton"></button>
            <button id="zoomInButton"></button>
            <button id="zoomOutButton"></button>
            <button id="resetImageTransformButton"></button>
            <button id="undoButton"></button>
            <button id="redoButton"></button>
            <button id="enterCropModeButton"></button>
            <button id="applyCropButton"></button>
            <button id="cancelCropButton"></button>
            <input id="imageInput" type="file">
            <div id="uploadArea"></div>
            <ul id="maskList"></ul>
        </body></html>`,
    );

    globalThis.window = dom.window;
    globalThis.document = dom.window.document;
    globalThis.HTMLElement = dom.window.HTMLElement;
    globalThis.HTMLCanvasElement = dom.window.HTMLCanvasElement;
    globalThis.HTMLInputElement = dom.window.HTMLInputElement;

    const container = dom.window.document.getElementById('canvasContainer');
    Object.defineProperty(container, 'clientWidth', {
        value: containerWidth,
        configurable: true,
    });
    Object.defineProperty(container, 'clientHeight', {
        value: containerHeight,
        configurable: true,
    });

    return dom;
}

class FakeImage {
    constructor() {
        this.type = 'image';
        this.width = 1000;
        this.height = 700;
        this.left = 0;
        this.top = 0;
        this.scaleX = 1;
        this.scaleY = 1;
        this.angle = 0;
        this.originX = 'left';
        this.originY = 'top';
        this.selectable = false;
        this.evented = false;
    }

    set(keyOrProps, value) {
        if (typeof keyOrProps === 'string') {
            this[keyOrProps] = value;
            return;
        }
        Object.assign(this, keyOrProps);
    }

    scale(value) {
        this.scaleX = value;
        this.scaleY = value;
    }

    setCoords() {}

    getCoords() {
        return [{ x: this.left || 0, y: this.top || 0 }];
    }

    getCenterPoint() {
        return {
            x: (this.left || 0) + this.displayWidth() / 2,
            y: (this.top || 0) + this.displayHeight() / 2,
        };
    }

    setPositionByOrigin(point) {
        this.left = point.x;
        this.top = point.y;
    }

    getBoundingRect() {
        const quarterTurn = Math.abs(Math.round((this.angle || 0) / 90)) % 2 === 1;
        const width = quarterTurn ? this.displayHeight() : this.displayWidth();
        const height = quarterTurn ? this.displayWidth() : this.displayHeight();
        return { left: this.left || 0, top: this.top || 0, width, height };
    }

    animate(props, options) {
        Object.assign(this, props);
        options.onChange?.();
        for (const _key of Object.keys(props)) {
            options.onComplete?.();
        }
        return [];
    }

    displayWidth() {
        return Math.abs((this.width || 0) * (this.scaleX || 1));
    }

    displayHeight() {
        return Math.abs((this.height || 0) * (this.scaleY || 1));
    }
}

function makeFabricStub() {
    const fabric = {
        FabricImage: FakeImage,
        Image: FakeImage,
        Rect: class FakeRect {},
        Circle: class FakeCircle {},
        Ellipse: class FakeEllipse {},
        Polygon: class FakePolygon {},
        FabricText: class FakeFabricText {},
    };

    fabric.Canvas = class FakeCanvas {
        constructor(canvasElement, options = {}) {
            this.canvasElement = canvasElement;
            this.width = options.width || 800;
            this.height = options.height || 600;
            this.backgroundColor = options.backgroundColor || 'transparent';
            this.objects = [];
            this.activeObject = null;
            fabric.lastCanvas = this;
        }

        on() {}

        getObjects() {
            return this.objects;
        }

        getActiveObject() {
            return this.activeObject;
        }

        discardActiveObject() {
            this.activeObject = null;
            return this;
        }

        clear() {
            this.objects = [];
        }

        add(obj) {
            this.objects.push(obj);
        }

        sendObjectToBack(obj) {
            const idx = this.objects.indexOf(obj);
            if (idx > 0) {
                this.objects.splice(idx, 1);
                this.objects.unshift(obj);
            }
        }

        requestRenderAll() {}

        renderAll() {}

        setDimensions({ width, height }) {
            this.width = width;
            this.height = height;
        }

        async loadFromJSON(json) {
            this.width = json.width ?? this.width;
            this.height = json.height ?? this.height;
            this.backgroundColor = json.background ?? this.backgroundColor;
            this.objects = (json.objects ?? []).map((objectJson) => {
                const image = new FakeImage();
                Object.assign(image, objectJson);
                return image;
            });
            this.activeObject = null;
            return this;
        }

        getWidth() {
            return this.width;
        }

        getHeight() {
            return this.height;
        }

        toJSON(keys = []) {
            return {
                version: '7.0.0',
                width: this.width,
                height: this.height,
                background: this.backgroundColor,
                objects: this.objects.map((object) => {
                    const json = {
                        type: object.type,
                        left: object.left,
                        top: object.top,
                        width: object.width,
                        height: object.height,
                        scaleX: object.scaleX,
                        scaleY: object.scaleY,
                        angle: object.angle,
                    };
                    for (const key of keys) {
                        if (key in object) json[key] = object[key];
                    }
                    return json;
                }),
            };
        }
    };

    return fabric;
}

function control(id) {
    const el = document.getElementById(id);
    assert.ok(el, `missing control ${id}`);
    return el;
}

function makeEditor(options = {}, viewport = {}) {
    installDom(viewport);
    const fabric = makeFabricStub();
    const editor = new ImageEditor(fabric, {
        animationDuration: 0,
        showPlaceholder: false,
        defaultLayoutMode: 'fit',
        ...options,
    });

    editor.init({});
    const image = new fabric.FabricImage();
    editor.originalImage = image;
    fabric.lastCanvas.add(image);
    editor.updateUi();
    return editor;
}

function assertControlsEnabled(context, ids) {
    for (const id of ids) {
        assert.equal(control(id).disabled, false, `${context}: ${id} should be enabled`);
    }
}

test('scaleImage re-enables transform toolbar controls after the queue settles', async () => {
    const editor = makeEditor();

    assertControlsEnabled('before scale', ENABLED_WHEN_IMAGE_LOADED);
    await editor.scaleImage(1.05);

    assertControlsEnabled('after scale', ENABLED_AFTER_TRANSFORM);
    assert.equal(control('scalePercentageInput').value, '105');
});

test('rotateImage re-enables transform toolbar controls after the queue settles', async () => {
    const editor = makeEditor();

    assertControlsEnabled('before rotate', ENABLED_WHEN_IMAGE_LOADED);
    await editor.rotateImage(90);

    assertControlsEnabled('after rotate', ENABLED_AFTER_TRANSFORM);
    assert.equal(control('scalePercentageInput').value, '100');
});

test('undo after rotate restores the canvas size for the restored image bounds', async () => {
    const editor = makeEditor(
        {
            defaultLayoutMode: 'cover',
        },
        { containerWidth: 960, containerHeight: 520 },
    );
    const canvas = editor.canvas;
    const image = editor.originalImage;

    image.scale(520 / image.height);
    editor.baseImageScale = image.scaleX;
    canvas.setDimensions({ width: 960, height: 520 });
    editor.lastSnapshot = editor.captureSnapshotInternal();

    await editor.rotateImage(90);

    assert.ok(canvas.height > 520, 'rotated image should expand the vertical canvas range');

    await editor.undo();

    assert.equal(editor.currentRotation, 0);
    assert.equal(canvas.width, 960);
    assert.equal(canvas.height, 520);
    assertControlsEnabled('after undo', ENABLED_WHEN_IMAGE_LOADED);
});

test('loadFromState normalizes stale cover canvas dimensions without shrinking valid snapshots', async () => {
    const editor = makeEditor(
        {
            defaultLayoutMode: 'cover',
        },
        { containerWidth: 960, containerHeight: 520 },
    );
    const canvas = editor.canvas;
    const image = editor.originalImage;

    image.scale(520 / image.height);
    editor.baseImageScale = image.scaleX;
    canvas.setDimensions({ width: 960, height: 900 });

    await editor.loadFromState(editor.captureSnapshotInternal());

    assert.equal(canvas.width, 960);
    assert.equal(canvas.height, 520);

    canvas.setDimensions({ width: 960, height: 520 });

    await editor.loadFromState(editor.captureSnapshotInternal());

    assert.equal(canvas.width, 960);
    assert.equal(canvas.height, 520);
});

test('loadFromState settles a sticky cover scrollbar axis without changing restored size', async () => {
    const editor = makeEditor(
        {
            defaultLayoutMode: 'cover',
        },
        { containerWidth: 960, containerHeight: 520 },
    );
    const canvas = editor.canvas;
    const image = editor.originalImage;
    const container = document.getElementById('canvasContainer');

    image.scale(0.945);
    editor.baseImageScale = image.scaleX;
    canvas.setDimensions({ width: 945, height: 800 });
    const snapshot = editor.captureSnapshotInternal();

    let stickyHorizontalScrollbar = true;
    const setDimensionCalls = [];
    const originalSetDimensions = canvas.setDimensions.bind(canvas);
    canvas.setDimensions = (dims) => {
        setDimensionCalls.push({ width: dims.width, height: dims.height });
        originalSetDimensions(dims);
        if (dims.width < 945) stickyHorizontalScrollbar = false;
    };

    container.style.overflow = 'auto';
    Object.defineProperty(container, 'clientWidth', {
        configurable: true,
        get: () => 945,
    });
    Object.defineProperty(container, 'clientHeight', {
        configurable: true,
        get: () => 520,
    });
    Object.defineProperty(container, 'scrollWidth', {
        configurable: true,
        get: () => (stickyHorizontalScrollbar ? 946 : canvas.width),
    });
    Object.defineProperty(container, 'scrollHeight', {
        configurable: true,
        get: () => canvas.height,
    });

    canvas.setDimensions({ width: 600, height: 400 });
    stickyHorizontalScrollbar = true;
    setDimensionCalls.length = 0;

    await editor.loadFromState(snapshot);

    assert.deepEqual(setDimensionCalls, [
        { width: 945, height: 800 },
        { width: 944, height: 800 },
        { width: 945, height: 800 },
    ]);
    assert.equal(canvas.width, 945);
    assert.equal(canvas.height, 800);
    assert.equal(stickyHorizontalScrollbar, false);
    assert.equal(container.scrollWidth > container.clientWidth + 0.5, false);
});

test('history and state APIs are guarded while crop mode owns the canvas', async () => {
    const editor = makeEditor();
    editor.currentRotation = 45;
    const snapshot = editor.captureSnapshotInternal();
    editor.currentRotation = 90;
    editor.cropSession = {};

    editor.saveState();
    await editor.loadFromState(snapshot);
    await editor.undo();
    await editor.redo();

    assert.equal(
        editor.currentRotation,
        90,
        'external loadFromState must no-op while crop mode is active',
    );
    assert.equal(
        editor.historyManager.history.length,
        0,
        'external saveState must not push history while crop mode is active',
    );

    editor.cropSession = null;
});

test('history and state APIs are guarded while another operation is active', async () => {
    const editor = makeEditor();
    editor.currentRotation = 45;
    const snapshot = editor.captureSnapshotInternal();
    editor.currentRotation = 90;

    const token = editor.operationGuard.beginBusyOperation('exportImageBase64');
    try {
        editor.saveState();
        await editor.loadFromState(snapshot);
        await editor.undo();
        await editor.redo();
        const base64 = await editor.exportImageBase64();
        await assert.rejects(
            () => editor.exportImageFile(),
            /exportImageBase64 is running/,
            'exportImageFile must reject while another export operation is active',
        );

        assert.equal(base64, '', 'exportImageBase64 must no-op while busy');
        assert.equal(
            editor.currentRotation,
            90,
            'external loadFromState must no-op while another operation is active',
        );
        assert.equal(
            editor.historyManager.history.length,
            0,
            'external saveState must not push history while another operation is active',
        );
    } finally {
        editor.operationGuard.endBusyOperation(token);
    }
});

test('merge load preserves the pre-merge displayed image geometry as the new baseline', async () => {
    const editor = makeEditor(
        {
            defaultLayoutMode: 'cover',
        },
        { containerWidth: 960, containerHeight: 520 },
    );
    const canvas = editor.canvas;
    const image = editor.originalImage;

    image.scale(0.5);
    editor.baseImageScale = 0.5;
    canvas.setDimensions({ width: 620, height: 400 });
    editor.lastSnapshot = editor.captureSnapshotInternal();

    editor.loadImageInternal = async () => {
        const mergedImage = new image.constructor();
        mergedImage.width = 1000;
        mergedImage.height = 700;
        mergedImage.scale(1);
        editor.originalImage = mergedImage;
        canvas.objects = [mergedImage];
        canvas.setDimensions({ width: 960, height: 520 });
        editor.baseImageScale = 1;
        editor.currentScale = 1;
        editor.currentRotation = 0;
        editor.lastSnapshot = editor.captureSnapshotInternal();
    };

    const ctx = editor.buildMergeMasksContext();

    await ctx.loadImage('data:image/png;base64,MERGED', { preserveScroll: true });

    assert.equal(canvas.width, 620);
    assert.equal(canvas.height, 400);
    assert.equal(editor.originalImage.scaleX, 0.5);
    assert.equal(editor.originalImage.scaleY, 0.5);
    assert.equal(editor.baseImageScale, 0.5);
    assert.equal(editor.currentScale, 1);
    assert.equal(editor.currentRotation, 0);
});
