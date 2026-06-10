/**
 * Verifies v2 canonical ElementIdMap names at the ImageEditor facade boundary.
 */

import { register } from 'node:module';

register('./helpers/ts-resolve-hook.mjs', import.meta.url);

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const { ImageEditor } = await import('../src/image-editor.ts');

const CANONICAL_IDS = Object.freeze({
    canvas: 'customCanvas',
    canvasContainer: 'customCanvasContainer',
    imagePlaceholder: 'customImagePlaceholder',
    scalePercentageInput: 'customScalePercentageInput',
    rotateLeftDegreesInput: 'customRotateLeftDegreesInput',
    rotateRightDegreesInput: 'customRotateRightDegreesInput',
    rotateLeftButton: 'customRotateLeftButton',
    rotateRightButton: 'customRotateRightButton',
    createMaskButton: 'customCreateMaskButton',
    removeSelectedMaskButton: 'customRemoveSelectedMaskButton',
    removeAllMasksButton: 'customRemoveAllMasksButton',
    mergeMasksButton: 'customMergeMasksButton',
    downloadImageButton: 'customDownloadImageButton',
    maskList: 'customMaskList',
    zoomInButton: 'customZoomInButton',
    zoomOutButton: 'customZoomOutButton',
    resetImageTransformButton: 'customResetImageTransformButton',
    undoButton: 'customUndoButton',
    redoButton: 'customRedoButton',
    imageInput: 'customImageInput',
    uploadArea: 'customUploadArea',
    enterCropModeButton: 'customEnterCropModeButton',
    applyCropButton: 'customApplyCropButton',
    cancelCropButton: 'customCancelCropButton',
    enterMosaicModeButton: 'customEnterMosaicModeButton',
    exitMosaicModeButton: 'customExitMosaicModeButton',
    mosaicBrushSizeInput: 'customMosaicBrushSizeInput',
    mosaicBlockSizeInput: 'customMosaicBlockSizeInput',
});

class MockCanvas {
    constructor() {
        this.objects = [];
        this.activeObject = null;
    }
    on() {}
    getObjects() {
        return [...this.objects];
    }
    getActiveObject() {
        return this.activeObject;
    }
    discardActiveObject() {
        this.activeObject = null;
        return this;
    }
    requestRenderAll() {}
    renderAll() {}
}

function makeFabricStub() {
    class FakeImage {}
    const fabric = {
        Image: FakeImage,
        FabricImage: FakeImage,
        Rect: class FakeRect {},
        Circle: class FakeCircle {},
        Ellipse: class FakeEllipse {},
        Polygon: class FakePolygon {},
        FabricText: class FakeFabricText {},
    };
    fabric.Canvas = class CapturingCanvas extends MockCanvas {};
    return fabric;
}

function installDom() {
    const dom = new JSDOM(
        `<!doctype html><html><body>
            <div id="${CANONICAL_IDS.imagePlaceholder}"></div>
            <div id="${CANONICAL_IDS.uploadArea}"></div>
            <div id="${CANONICAL_IDS.canvasContainer}">
                <canvas id="${CANONICAL_IDS.canvas}"></canvas>
            </div>
            <input id="${CANONICAL_IDS.scalePercentageInput}" value="100">
            <input id="${CANONICAL_IDS.rotateLeftDegreesInput}" value="90">
            <input id="${CANONICAL_IDS.rotateRightDegreesInput}" value="90">
            <button id="${CANONICAL_IDS.rotateLeftButton}"></button>
            <button id="${CANONICAL_IDS.rotateRightButton}"></button>
            <button id="${CANONICAL_IDS.createMaskButton}"></button>
            <button id="${CANONICAL_IDS.removeSelectedMaskButton}"></button>
            <button id="${CANONICAL_IDS.removeAllMasksButton}"></button>
            <button id="${CANONICAL_IDS.mergeMasksButton}"></button>
            <button id="${CANONICAL_IDS.downloadImageButton}"></button>
            <button id="${CANONICAL_IDS.zoomInButton}"></button>
            <button id="${CANONICAL_IDS.zoomOutButton}"></button>
            <button id="${CANONICAL_IDS.resetImageTransformButton}"></button>
            <button id="${CANONICAL_IDS.undoButton}"></button>
            <button id="${CANONICAL_IDS.redoButton}"></button>
            <button id="${CANONICAL_IDS.enterCropModeButton}"></button>
            <button id="${CANONICAL_IDS.applyCropButton}"></button>
            <button id="${CANONICAL_IDS.cancelCropButton}"></button>
            <button id="${CANONICAL_IDS.enterMosaicModeButton}"></button>
            <button id="${CANONICAL_IDS.exitMosaicModeButton}"></button>
            <input id="${CANONICAL_IDS.mosaicBrushSizeInput}" value="48">
            <input id="${CANONICAL_IDS.mosaicBlockSizeInput}" value="8">
            <input id="${CANONICAL_IDS.imageInput}" type="file">
            <ul id="${CANONICAL_IDS.maskList}"></ul>
        </body></html>`,
    );
    globalThis.window = dom.window;
    globalThis.document = dom.window.document;
    globalThis.HTMLElement = dom.window.HTMLElement;
    globalThis.HTMLCanvasElement = dom.window.HTMLCanvasElement;
    globalThis.HTMLInputElement = dom.window.HTMLInputElement;
    return dom.window;
}

function createEditor(idMap = CANONICAL_IDS) {
    const editor = new ImageEditor(makeFabricStub(), {
        animationDuration: 0,
        showPlaceholder: false,
    });
    assert.doesNotThrow(() => editor.init(idMap));
    return editor;
}

test('init accepts every canonical DOM key and custom uploadArea delegates to imageInput.click()', () => {
    const window = installDom();
    const input = document.getElementById(CANONICAL_IDS.imageInput);
    let clicks = 0;
    input.click = () => {
        clicks += 1;
    };

    createEditor();
    document
        .getElementById(CANONICAL_IDS.uploadArea)
        .dispatchEvent(new window.Event('click', { bubbles: true }));

    assert.equal(clicks, 1, 'custom uploadArea must delegate to the configured imageInput');
});

test('uploadArea null disables the built-in upload click binding', () => {
    const window = installDom();
    const input = document.getElementById(CANONICAL_IDS.imageInput);
    let clicks = 0;
    input.click = () => {
        clicks += 1;
    };

    createEditor({ ...CANONICAL_IDS, uploadArea: null });
    document
        .getElementById(CANONICAL_IDS.uploadArea)
        .dispatchEvent(new window.Event('click', { bubbles: true }));

    assert.equal(clicks, 0, 'uploadArea: null must not bind a click listener');
});

test('optional DOM bindings accept null values without binding', () => {
    const window = installDom();
    const input = document.getElementById(CANONICAL_IDS.imageInput);
    let clicks = 0;
    input.click = () => {
        clicks += 1;
    };

    assert.doesNotThrow(() =>
        createEditor({
            ...CANONICAL_IDS,
            imageInput: null,
            maskList: null,
            uploadArea: null,
        }),
    );
    document
        .getElementById(CANONICAL_IDS.uploadArea)
        .dispatchEvent(new window.Event('click', { bubbles: true }));

    assert.equal(clicks, 0, 'nullable optional DOM keys must not install bindings');
});

test('Mosaic DOM buttons and size inputs call the public Mosaic API', () => {
    const window = installDom();
    const editor = createEditor();
    const calls = [];
    editor.enterMosaicMode = () => calls.push('enter');
    editor.exitMosaicMode = () => calls.push('exit');
    editor.setMosaicBrushSize = (value) => calls.push(['brush', value]);
    editor.setMosaicBlockSize = (value) => calls.push(['block', value]);

    document
        .getElementById(CANONICAL_IDS.enterMosaicModeButton)
        .dispatchEvent(new window.Event('click', { bubbles: true }));
    document
        .getElementById(CANONICAL_IDS.exitMosaicModeButton)
        .dispatchEvent(new window.Event('click', { bubbles: true }));

    const brushInput = document.getElementById(CANONICAL_IDS.mosaicBrushSizeInput);
    brushInput.value = '72';
    brushInput.dispatchEvent(new window.Event('input', { bubbles: true }));

    const blockInput = document.getElementById(CANONICAL_IDS.mosaicBlockSizeInput);
    blockInput.value = '11';
    blockInput.dispatchEvent(new window.Event('change', { bubbles: true }));

    assert.deepEqual(calls, ['enter', 'exit', ['brush', 72], ['block', 11]]);
});

test('removed v1 DOM key names are ignored at runtime', () => {
    const window = installDom();
    const removedCreateMaskKey = ['add', 'Mask', 'Btn'].join('');
    const removedButton = document.createElement('button');
    removedButton.id = 'legacyCreateMaskButton';
    document.body.appendChild(removedButton);

    const editor = createEditor({
        ...CANONICAL_IDS,
        createMaskButton: 'missingCanonicalCreateMaskButton',
        [removedCreateMaskKey]: removedButton.id,
    });
    let calls = 0;
    editor.createMask = () => {
        calls += 1;
        return null;
    };

    removedButton.dispatchEvent(new window.Event('click', { bubbles: true }));

    assert.equal(calls, 0, 'removed v1 DOM key names must not bind handlers in v2');
});

test('init re-checks global Fabric when construction happened before Fabric loaded', () => {
    installDom();
    const originalFabric = globalThis.fabric;
    const originalConsoleError = console.error;
    const errors = [];
    globalThis.fabric = undefined;
    console.error = (...args) => {
        errors.push(args);
    };

    try {
        const editor = new ImageEditor({ animationDuration: 0, showPlaceholder: false });
        assert.equal(errors.length, 1, 'constructor should report the missing Fabric module once');

        globalThis.fabric = makeFabricStub();
        assert.doesNotThrow(() => editor.init(CANONICAL_IDS));
        assert.ok(editor.canvas, 'init must recover once global Fabric is available');
    } finally {
        console.error = originalConsoleError;
        globalThis.fabric = originalFabric;
    }
});
