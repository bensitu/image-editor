/**
 * Type:
 *   Integration test
 *
 * Purpose:
 *   Verifies canonical ElementIdMap wiring at the ImageEditor facade boundary.
 *
 * Scope:
 *   - Canonical DOM keys bind controls to public ImageEditor API methods.
 *   - Optional and null DOM bindings are tolerated.
 *   - Removed v1 DOM key names do not attach handlers in v2.
 *   - Fabric global detection is rechecked at init time.
 *
 * Out of scope:
 *   - visual layout and styling
 *   - browser rendering behavior
 *   - image processing correctness
 *
 * Environment:
 *   - Node.js ESM
 *   - JSDOM
 *   - mocked Fabric canvas primitives
 *
 * Run:
 *   node --test tests/dom-canonical-bindings.test.mjs
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
    flipHorizontalButton: 'customFlipHorizontalButton',
    flipVerticalButton: 'customFlipVerticalButton',
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
    cropAspectRatioSelect: 'customCropAspectRatioSelect',
    applyCropButton: 'customApplyCropButton',
    cancelCropButton: 'customCancelCropButton',
    enterMosaicModeButton: 'customEnterMosaicModeButton',
    exitMosaicModeButton: 'customExitMosaicModeButton',
    mosaicBrushSizeInput: 'customMosaicBrushSizeInput',
    mosaicBlockSizeInput: 'customMosaicBlockSizeInput',
    textFontSizeInput: 'customTextFontSizeInput',
    drawBrushSizeInput: 'customDrawBrushSizeInput',
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
    getWidth() {
        return 800;
    }
    getHeight() {
        return 600;
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
    fabric.PencilBrush = class FakePencilBrush {
        constructor(canvas) {
            this.canvas = canvas;
        }
    };
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
            <button id="${CANONICAL_IDS.flipHorizontalButton}"></button>
            <button id="${CANONICAL_IDS.flipVerticalButton}"></button>
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
            <select id="${CANONICAL_IDS.cropAspectRatioSelect}"><option value="free">Free</option></select>
            <button id="${CANONICAL_IDS.applyCropButton}"></button>
            <button id="${CANONICAL_IDS.cancelCropButton}"></button>
            <button id="${CANONICAL_IDS.enterMosaicModeButton}"></button>
            <button id="${CANONICAL_IDS.exitMosaicModeButton}"></button>
            <input id="${CANONICAL_IDS.mosaicBrushSizeInput}" value="48">
            <input id="${CANONICAL_IDS.mosaicBlockSizeInput}" value="8">
            <input id="${CANONICAL_IDS.textFontSizeInput}" value="32">
            <input id="${CANONICAL_IDS.drawBrushSizeInput}" value="8">
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

test('Crop ratio select is passed to enterCropMode and live crop updates', () => {
    const window = installDom();
    const editor = createEditor();
    const calls = [];
    editor.enterCropMode = (options) => calls.push(['enter', options.aspectRatio]);
    editor.setCropAspectRatio = (aspectRatio) => calls.push(['ratio', aspectRatio]);

    const ratioSelect = document.getElementById(CANONICAL_IDS.cropAspectRatioSelect);
    ratioSelect.innerHTML = `
        <option value="free">Free</option>
        <option value="4:3">4:3</option>
        <option value="16:9">16:9</option>
    `;
    ratioSelect.value = '16:9';

    document
        .getElementById(CANONICAL_IDS.enterCropModeButton)
        .dispatchEvent(new window.Event('click', { bubbles: true }));

    editor.cropSession = {};
    ratioSelect.value = '4:3';
    ratioSelect.dispatchEvent(new window.Event('change', { bubbles: true }));

    assert.deepEqual(calls, [
        ['enter', '16:9'],
        ['ratio', '4:3'],
    ]);
});

test('Text mode size input updates live config without overwriting active typing', () => {
    const window = installDom();
    const editor = createEditor();

    editor.textSession = { mode: 'text' };
    editor.canvas.activeObject = {
        editorObjectKind: 'annotation',
        annotationId: 1,
        annotationType: 'text',
        annotationName: 'text1',
    };
    const textSizeInput = document.getElementById(CANONICAL_IDS.textFontSizeInput);
    textSizeInput.focus();
    textSizeInput.value = '44.';
    textSizeInput.dispatchEvent(new window.Event('input', { bubbles: true }));

    assert.equal(editor.getTextConfig().fontSize, 44);
    assert.equal(textSizeInput.value, '44.');
    assert.equal(document.activeElement, textSizeInput);
    assert.equal(textSizeInput.disabled, false);
});

test('Draw mode size input updates live config without overwriting active dragging', () => {
    const window = installDom();
    const editor = createEditor();

    editor.drawSession = { mode: 'draw' };
    editor.canvas.activeObject = {
        editorObjectKind: 'annotation',
        annotationId: 2,
        annotationType: 'draw',
        annotationName: 'draw2',
    };
    const drawSizeInput = document.getElementById(CANONICAL_IDS.drawBrushSizeInput);
    drawSizeInput.focus();
    drawSizeInput.value = '18.';
    drawSizeInput.dispatchEvent(new window.Event('change', { bubbles: true }));

    assert.equal(editor.getDrawConfig().brushSize, 18);
    assert.equal(drawSizeInput.value, '18.');
    assert.equal(document.activeElement, drawSizeInput);
    assert.equal(drawSizeInput.disabled, false);
    assert.equal(editor.canvas.freeDrawingBrush.width, 18);
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
