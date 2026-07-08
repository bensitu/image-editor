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
import {
    requireEditorCanvas,
    setCropSession,
    setCurrentScale,
    setDrawSession,
    setOriginalImage,
    setTextSession,
} from './helpers/editor-internals.mjs';

const { ImageEditor } = await import('../src/image-editor.ts');
const {
    isCanvasElement,
    isInputElement,
    isInputOrSelectElement,
    resolveDomElement,
    resolveElementTargets,
} = await import('../src/core/editor-elements.ts');

const CANONICAL_IDS = Object.freeze({
    canvas: 'customCanvas',
    canvasContainer: 'customCanvasContainer',
    imagePlaceholder: 'customImagePlaceholder',
    scalePercentageInput: 'customScalePercentageInput',
    imageBrightnessInput: 'customImageBrightnessInput',
    imageContrastInput: 'customImageContrastInput',
    imageSaturationInput: 'customImageSaturationInput',
    imageBlurInput: 'customImageBlurInput',
    imageSharpenInput: 'customImageSharpenInput',
    imageGrayscaleInput: 'customImageGrayscaleInput',
    imageSepiaInput: 'customImageSepiaInput',
    imageVintageInput: 'customImageVintageInput',
    applyImageFiltersButton: 'customApplyImageFiltersButton',
    resetImageFiltersButton: 'customResetImageFiltersButton',
    clearImageFiltersButton: 'customClearImageFiltersButton',
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
    mergeAnnotationsButton: 'customMergeAnnotationsButton',
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
    shapeKindSelect: 'customShapeKindSelect',
    shapeStrokeInput: 'customShapeStrokeInput',
    shapeStrokeWidthInput: 'customShapeStrokeWidthInput',
    shapeFillInput: 'customShapeFillInput',
    createShapeAnnotationButton: 'customCreateShapeAnnotationButton',
    enterShapeModeButton: 'customEnterShapeModeButton',
    exitShapeModeButton: 'customExitShapeModeButton',
    drawBrushSubModeButton: 'customDrawBrushSubModeButton',
    drawEraseSubModeButton: 'customDrawEraseSubModeButton',
    eraserBrushSizeInput: 'customEraserBrushSizeInput',
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
            <input id="${CANONICAL_IDS.imageBrightnessInput}" value="0">
            <input id="${CANONICAL_IDS.imageContrastInput}" value="0">
            <input id="${CANONICAL_IDS.imageSaturationInput}" value="0">
            <input id="${CANONICAL_IDS.imageBlurInput}" value="0">
            <input id="${CANONICAL_IDS.imageSharpenInput}" value="0">
            <input id="${CANONICAL_IDS.imageGrayscaleInput}" type="checkbox">
            <input id="${CANONICAL_IDS.imageSepiaInput}" type="checkbox">
            <input id="${CANONICAL_IDS.imageVintageInput}" type="checkbox">
            <button id="${CANONICAL_IDS.applyImageFiltersButton}"></button>
            <button id="${CANONICAL_IDS.resetImageFiltersButton}"></button>
            <button id="${CANONICAL_IDS.clearImageFiltersButton}"></button>
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
            <button id="${CANONICAL_IDS.mergeAnnotationsButton}"></button>
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
            <select id="${CANONICAL_IDS.shapeKindSelect}">
                <option value="rect">Rectangle</option>
                <option value="line">Line</option>
                <option value="arrow">Arrow</option>
            </select>
            <input id="${CANONICAL_IDS.shapeStrokeInput}" value="#b45309">
            <input id="${CANONICAL_IDS.shapeStrokeWidthInput}" value="4">
            <input id="${CANONICAL_IDS.shapeFillInput}" value="#f59e0b">
            <button id="${CANONICAL_IDS.createShapeAnnotationButton}"></button>
            <button id="${CANONICAL_IDS.enterShapeModeButton}"></button>
            <button id="${CANONICAL_IDS.exitShapeModeButton}"></button>
            <button id="${CANONICAL_IDS.drawBrushSubModeButton}"></button>
            <button id="${CANONICAL_IDS.drawEraseSubModeButton}"></button>
            <input id="${CANONICAL_IDS.eraserBrushSizeInput}" value="18">
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

function createEditor(idMap = CANONICAL_IDS, options = {}) {
    const editor = new ImageEditor(makeFabricStub(), {
        animationDuration: 0,
        showPlaceholder: false,
        ...options,
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

test('download, undo, and redo DOM buttons report async rejections', async () => {
    const window = installDom();
    const errors = [];
    const editor = createEditor(CANONICAL_IDS, {
        onError: (error, message) => {
            errors.push({ error, message });
        },
    });
    editor.downloadImage = () => Promise.reject(new Error('download failed'));
    editor.undo = () => Promise.reject(new Error('undo failed'));
    editor.redo = () => Promise.reject(new Error('redo failed'));

    document
        .getElementById(CANONICAL_IDS.downloadImageButton)
        .dispatchEvent(new window.Event('click', { bubbles: true }));
    document
        .getElementById(CANONICAL_IDS.undoButton)
        .dispatchEvent(new window.Event('click', { bubbles: true }));
    document
        .getElementById(CANONICAL_IDS.redoButton)
        .dispatchEvent(new window.Event('click', { bubbles: true }));

    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.deepEqual(
        errors.map((entry) => [entry.message, entry.error.message]),
        [
            ['downloadImage failed.', 'download failed'],
            ['undo failed.', 'undo failed'],
            ['redo failed.', 'redo failed'],
        ],
    );
});

test('transform, merge, and image-input DOM actions report async rejections', async () => {
    const window = installDom();
    const errors = [];
    const editor = createEditor(CANONICAL_IDS, {
        onError: (error, message) => {
            errors.push({ error, message });
        },
    });
    editor.loadImageFile = () => Promise.reject(new Error('file failed'));
    editor.scaleImage = (scale) => Promise.reject(new Error(`scale ${scale}`));
    editor.resetImageTransform = () => Promise.reject(new Error('reset failed'));
    editor.flipHorizontal = () => Promise.reject(new Error('flip horizontal failed'));
    editor.flipVertical = () => Promise.reject(new Error('flip vertical failed'));
    editor.rotateImage = (rotation) => Promise.reject(new Error(`rotate ${rotation}`));
    editor.mergeMasks = () => Promise.reject(new Error('merge masks failed'));
    editor.mergeAnnotations = () => Promise.reject(new Error('merge annotations failed'));

    const imageInput = document.getElementById(CANONICAL_IDS.imageInput);
    Object.defineProperty(imageInput, 'files', {
        configurable: true,
        value: [new window.File(['x'], 'x.png', { type: 'image/png' })],
    });
    imageInput.dispatchEvent(new window.Event('change', { bubbles: true }));

    for (const key of [
        'zoomInButton',
        'zoomOutButton',
        'resetImageTransformButton',
        'flipHorizontalButton',
        'flipVerticalButton',
        'rotateLeftButton',
        'rotateRightButton',
        'mergeMasksButton',
        'mergeAnnotationsButton',
    ]) {
        document
            .getElementById(CANONICAL_IDS[key])
            .dispatchEvent(new window.Event('click', { bubbles: true }));
    }

    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.deepEqual(
        errors.map((entry) => [entry.message, entry.error.message]),
        [
            ['loadImageFile failed.', 'file failed'],
            ['zoomIn failed.', 'scale 1.05'],
            ['zoomOut failed.', 'scale 0.95'],
            ['resetImageTransform failed.', 'reset failed'],
            ['flipHorizontal failed.', 'flip horizontal failed'],
            ['flipVertical failed.', 'flip vertical failed'],
            ['rotateLeft failed.', 'rotate -90'],
            ['rotateRight failed.', 'rotate 90'],
            ['mergeMasks failed.', 'merge masks failed'],
            ['mergeAnnotations failed.', 'merge annotations failed'],
        ],
    );
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

test('v2.8 image filter DOM controls call the public filter API', () => {
    const window = installDom();
    const editor = createEditor();
    const calls = [];
    editor.setImageFilterConfig = (config) => calls.push(['set', config]);
    editor.commitImageFilters = () => calls.push(['commit']);
    editor.resetImageFilterConfig = () => calls.push(['reset']);
    editor.clearImageFilters = () => calls.push(['clear']);

    const brightnessInput = document.getElementById(CANONICAL_IDS.imageBrightnessInput);
    brightnessInput.value = '0.25';
    brightnessInput.dispatchEvent(new window.Event('input', { bubbles: true }));

    const grayscaleInput = document.getElementById(CANONICAL_IDS.imageGrayscaleInput);
    grayscaleInput.checked = true;
    grayscaleInput.dispatchEvent(new window.Event('change', { bubbles: true }));

    document
        .getElementById(CANONICAL_IDS.applyImageFiltersButton)
        .dispatchEvent(new window.Event('click', { bubbles: true }));
    document
        .getElementById(CANONICAL_IDS.resetImageFiltersButton)
        .dispatchEvent(new window.Event('click', { bubbles: true }));
    document
        .getElementById(CANONICAL_IDS.clearImageFiltersButton)
        .dispatchEvent(new window.Event('click', { bubbles: true }));

    assert.deepEqual(calls, [
        ['set', { brightness: 0.25 }],
        ['set', { grayscale: true }],
        ['commit'],
        ['reset'],
        ['clear'],
    ]);
});

test('image filter range inputs coalesce rapid input events with requestAnimationFrame', () => {
    const hadRequestAnimationFrame = 'requestAnimationFrame' in globalThis;
    const previousRequestAnimationFrame = globalThis.requestAnimationFrame;
    const frames = [];

    globalThis.requestAnimationFrame = (callback) => {
        frames.push(callback);
        return frames.length;
    };

    try {
        const window = installDom();
        const editor = createEditor();
        const calls = [];
        editor.setImageFilterConfig = (config) => calls.push(['set', config]);
        const sharpenInput = document.getElementById(CANONICAL_IDS.imageSharpenInput);
        const dispatch = (value, eventType = 'input') => {
            sharpenInput.value = value;
            sharpenInput.dispatchEvent(new window.Event(eventType, { bubbles: true }));
        };
        const flushNextFrame = () => {
            const callback = frames.shift();
            assert.ok(callback);
            callback(0);
        };
        const flushAllFrames = () => {
            while (frames.length > 0) {
                frames.shift()(0);
            }
        };

        dispatch('0.1');
        dispatch('0.2');
        dispatch('0.3');

        assert.deepEqual(calls, []);
        assert.equal(frames.length, 1);
        flushNextFrame();
        assert.deepEqual(calls, [['set', { sharpen: 0.3 }]]);

        dispatch('0.3');
        flushNextFrame();
        assert.deepEqual(calls, [['set', { sharpen: 0.3 }]]);

        dispatch('0.4');
        dispatch('0.5', 'change');
        assert.deepEqual(calls, [
            ['set', { sharpen: 0.3 }],
            ['set', { sharpen: 0.5 }],
        ]);
        flushAllFrames();
        assert.deepEqual(calls, [
            ['set', { sharpen: 0.3 }],
            ['set', { sharpen: 0.5 }],
        ]);
    } finally {
        if (hadRequestAnimationFrame) {
            globalThis.requestAnimationFrame = previousRequestAnimationFrame;
        } else {
            delete globalThis.requestAnimationFrame;
        }
    }
});

test('v2.8 Shape and Draw eraser DOM controls call the public annotation API', () => {
    const window = installDom();
    const editor = createEditor();
    const calls = [];
    editor.setShapeConfig = (config) => calls.push(['shapeConfig', config]);
    editor.createShapeAnnotation = (config) => calls.push(['createShape', config]);
    editor.enterShapeMode = (shape) => calls.push(['enterShape', shape]);
    editor.exitShapeMode = () => calls.push(['exitShape']);
    editor.setDrawSubMode = (mode) => calls.push(['drawSubMode', mode]);
    editor.setEraserConfig = (config) => calls.push(['eraserConfig', config]);

    const shapeKindSelect = document.getElementById(CANONICAL_IDS.shapeKindSelect);
    shapeKindSelect.value = 'arrow';
    shapeKindSelect.dispatchEvent(new window.Event('change', { bubbles: true }));

    const strokeInput = document.getElementById(CANONICAL_IDS.shapeStrokeInput);
    strokeInput.value = '#112233';
    strokeInput.dispatchEvent(new window.Event('input', { bubbles: true }));

    const strokeWidthInput = document.getElementById(CANONICAL_IDS.shapeStrokeWidthInput);
    strokeWidthInput.value = '9';
    strokeWidthInput.dispatchEvent(new window.Event('input', { bubbles: true }));

    const fillInput = document.getElementById(CANONICAL_IDS.shapeFillInput);
    fillInput.value = '#445566';
    fillInput.dispatchEvent(new window.Event('input', { bubbles: true }));

    document
        .getElementById(CANONICAL_IDS.createShapeAnnotationButton)
        .dispatchEvent(new window.Event('click', { bubbles: true }));
    document
        .getElementById(CANONICAL_IDS.enterShapeModeButton)
        .dispatchEvent(new window.Event('click', { bubbles: true }));
    document
        .getElementById(CANONICAL_IDS.exitShapeModeButton)
        .dispatchEvent(new window.Event('click', { bubbles: true }));
    document
        .getElementById(CANONICAL_IDS.drawBrushSubModeButton)
        .dispatchEvent(new window.Event('click', { bubbles: true }));
    document
        .getElementById(CANONICAL_IDS.drawEraseSubModeButton)
        .dispatchEvent(new window.Event('click', { bubbles: true }));

    const eraserInput = document.getElementById(CANONICAL_IDS.eraserBrushSizeInput);
    eraserInput.value = '31';
    eraserInput.dispatchEvent(new window.Event('input', { bubbles: true }));

    assert.deepEqual(calls, [
        ['shapeConfig', { shape: 'arrow' }],
        ['shapeConfig', { stroke: '#112233' }],
        ['shapeConfig', { strokeWidth: 9 }],
        ['shapeConfig', { fill: '#445566' }],
        ['createShape', undefined],
        ['enterShape', 'arrow'],
        ['exitShape'],
        ['drawSubMode', 'brush'],
        ['drawSubMode', 'erase'],
        ['eraserConfig', { brushSize: 31 }],
    ]);
});

test('invalid shape kind DOM values do not silently default to rect', () => {
    const window = installDom();
    const editor = createEditor();
    const calls = [];
    editor.setShapeConfig = (config) => calls.push(['shapeConfig', config]);
    editor.enterShapeMode = (shape) => calls.push(['enterShape', shape]);

    const shapeKindSelect = document.getElementById(CANONICAL_IDS.shapeKindSelect);
    shapeKindSelect.innerHTML += '<option value="diamond">Diamond</option>';
    shapeKindSelect.value = 'diamond';
    shapeKindSelect.dispatchEvent(new window.Event('change', { bubbles: true }));
    document
        .getElementById(CANONICAL_IDS.enterShapeModeButton)
        .dispatchEvent(new window.Event('click', { bubbles: true }));

    assert.deepEqual(calls, []);
});

test('number DOM inputs skip duplicate change events after input', () => {
    const window = installDom();
    const editor = createEditor();
    const calls = [];
    editor.setMosaicBrushSize = (value) => calls.push(value);

    const brushInput = document.getElementById(CANONICAL_IDS.mosaicBrushSizeInput);
    brushInput.value = '72';
    brushInput.dispatchEvent(new window.Event('input', { bubbles: true }));
    brushInput.dispatchEvent(new window.Event('change', { bubbles: true }));

    brushInput.value = '73';
    brushInput.dispatchEvent(new window.Event('change', { bubbles: true }));

    assert.deepEqual(calls, [72, 73]);
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

    setCropSession(editor, {});
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

    setTextSession(editor, { mode: 'text' });
    requireEditorCanvas(editor).activeObject = {
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

    setDrawSession(editor, { mode: 'draw' });
    requireEditorCanvas(editor).activeObject = {
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
    assert.equal(requireEditorCanvas(editor).freeDrawingBrush.width, 18);
});

test('v2.8 DOM inputs synchronize from editor state', () => {
    installDom();
    const editor = createEditor();
    setOriginalImage(editor, {
        editorObjectKind: 'baseImage',
        width: 10,
        height: 10,
        filters: [],
    });

    editor.setImageFilterConfig({
        brightness: 0.2,
        contrast: -0.3,
        saturation: 0.4,
        blur: 0.1,
        sharpen: 0.5,
        grayscale: true,
        sepia: true,
        vintage: true,
    });
    editor.setShapeConfig({
        shape: 'line',
        stroke: '#123456',
        strokeWidth: 7,
        fill: '#abcdef',
    });
    editor.setEraserConfig({ brushSize: 33 });
    setDrawSession(editor, { mode: 'draw', subMode: 'erase' });
    editor.updateInputs();

    assert.equal(document.getElementById(CANONICAL_IDS.imageBrightnessInput).value, '0.2');
    assert.equal(document.getElementById(CANONICAL_IDS.imageContrastInput).value, '-0.3');
    assert.equal(document.getElementById(CANONICAL_IDS.imageSaturationInput).value, '0.4');
    assert.equal(document.getElementById(CANONICAL_IDS.imageBlurInput).value, '0.1');
    assert.equal(document.getElementById(CANONICAL_IDS.imageSharpenInput).value, '0.5');
    assert.equal(document.getElementById(CANONICAL_IDS.imageGrayscaleInput).checked, true);
    assert.equal(document.getElementById(CANONICAL_IDS.imageSepiaInput).checked, true);
    assert.equal(document.getElementById(CANONICAL_IDS.imageVintageInput).checked, true);
    assert.equal(document.getElementById(CANONICAL_IDS.shapeKindSelect).value, 'line');
    assert.equal(document.getElementById(CANONICAL_IDS.shapeStrokeInput).value, '#123456');
    assert.equal(document.getElementById(CANONICAL_IDS.shapeStrokeWidthInput).value, '7');
    assert.equal(document.getElementById(CANONICAL_IDS.shapeFillInput).value, '#abcdef');
    assert.equal(document.getElementById(CANONICAL_IDS.eraserBrushSizeInput).value, '33');
    assert.equal(
        document.getElementById(CANONICAL_IDS.drawBrushSubModeButton).getAttribute('aria-pressed'),
        'false',
    );
    assert.equal(
        document.getElementById(CANONICAL_IDS.drawEraseSubModeButton).getAttribute('aria-pressed'),
        'true',
    );
});

test('isImageLoaded uses base-image metadata instead of FabricImage instanceof', () => {
    installDom();
    const editor = createEditor();
    setOriginalImage(editor, {
        editorObjectKind: 'baseImage',
        width: 24,
        height: 18,
    });

    assert.equal(editor.isImageLoaded(), true);
    editor.enterDrawMode();
    assert.equal(editor.isDrawMode(), true);
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
        assert.equal(editor.getEditorState().canvasWidth, 800);
    } finally {
        console.error = originalConsoleError;
        globalThis.fabric = originalFabric;
    }
});

function installMinimalRefDom() {
    const dom = new JSDOM(
        `<!doctype html><html><body>
            <section data-editor="a">
                <div class="container-a"><canvas></canvas></div>
                <button class="zoom-in-a"></button>
            </section>
            <section data-editor="b">
                <div class="container-b"><canvas></canvas></div>
                <button class="zoom-in-b"></button>
            </section>
        </body></html>`,
    );
    globalThis.window = dom.window;
    globalThis.document = dom.window.document;
    globalThis.HTMLElement = dom.window.HTMLElement;
    globalThis.HTMLCanvasElement = dom.window.HTMLCanvasElement;
    globalThis.HTMLInputElement = dom.window.HTMLInputElement;
    return dom.window;
}

function withoutOptionalControls(base) {
    return {
        imageInput: null,
        uploadArea: null,
        maskList: null,
        annotationList: null,
        imageBrightnessInput: null,
        imageContrastInput: null,
        imageSaturationInput: null,
        imageBlurInput: null,
        imageSharpenInput: null,
        imageGrayscaleInput: null,
        imageSepiaInput: null,
        imageVintageInput: null,
        applyImageFiltersButton: null,
        resetImageFiltersButton: null,
        clearImageFiltersButton: null,
        zoomOutButton: null,
        rotateLeftButton: null,
        rotateRightButton: null,
        flipHorizontalButton: null,
        flipVerticalButton: null,
        createMaskButton: null,
        removeSelectedMaskButton: null,
        removeAllMasksButton: null,
        mergeMasksButton: null,
        downloadImageButton: null,
        resetImageTransformButton: null,
        undoButton: null,
        redoButton: null,
        enterCropModeButton: null,
        cropAspectRatioSelect: null,
        applyCropButton: null,
        cancelCropButton: null,
        enterMosaicModeButton: null,
        exitMosaicModeButton: null,
        mosaicBrushSizeInput: null,
        mosaicBlockSizeInput: null,
        enterTextModeButton: null,
        exitTextModeButton: null,
        textColorInput: null,
        textFontSizeInput: null,
        enterDrawModeButton: null,
        exitDrawModeButton: null,
        drawColorInput: null,
        drawBrushSizeInput: null,
        drawBrushSubModeButton: null,
        drawEraseSubModeButton: null,
        eraserBrushSizeInput: null,
        shapeKindSelect: null,
        shapeStrokeInput: null,
        shapeStrokeWidthInput: null,
        shapeFillInput: null,
        createShapeAnnotationButton: null,
        enterShapeModeButton: null,
        exitShapeModeButton: null,
        removeSelectedAnnotationButton: null,
        removeAllAnnotationsButton: null,
        deleteSelectedObjectButton: null,
        mergeAnnotationsButton: null,
        bringSelectedObjectForwardButton: null,
        sendSelectedObjectBackwardButton: null,
        bringSelectedObjectToFrontButton: null,
        sendSelectedObjectToBackButton: null,
        ...base,
    };
}

test('init accepts HTMLElement refs for canvas, container, and controls', () => {
    const window = installDom();
    const canvas = document.getElementById(CANONICAL_IDS.canvas);
    const container = document.getElementById(CANONICAL_IDS.canvasContainer);
    const zoomInButton = document.getElementById(CANONICAL_IDS.zoomInButton);
    const editor = createEditor(
        withoutOptionalControls({
            canvas,
            canvasContainer: container,
            zoomInButton,
        }),
    );
    const calls = [];
    editor.scaleImage = (scale) => {
        calls.push(scale);
        return Promise.resolve();
    };

    zoomInButton.dispatchEvent(new window.Event('click', { bubbles: true }));

    assert.deepEqual(calls, [1.05]);
});

test('zoom DOM actions round scale steps to stable precision', () => {
    const window = installDom();
    const editor = createEditor();
    const calls = [];
    editor.scaleImage = (scale) => {
        calls.push(scale);
        return Promise.resolve();
    };

    setCurrentScale(editor, 1.95);
    document
        .getElementById(CANONICAL_IDS.zoomInButton)
        .dispatchEvent(new window.Event('click', { bubbles: true }));

    setCurrentScale(editor, 2);
    document
        .getElementById(CANONICAL_IDS.zoomOutButton)
        .dispatchEvent(new window.Event('click', { bubbles: true }));

    assert.deepEqual(calls, [2, 1.95]);
});

test('init accepts mixed HTMLElement and string targets', () => {
    const window = installDom();
    const canvas = document.getElementById(CANONICAL_IDS.canvas);
    const editor = createEditor(
        withoutOptionalControls({
            canvas,
            zoomOutButton: CANONICAL_IDS.zoomOutButton,
        }),
    );
    const calls = [];
    editor.scaleImage = (scale) => {
        calls.push(scale);
        return Promise.resolve();
    };

    document
        .getElementById(CANONICAL_IDS.zoomOutButton)
        .dispatchEvent(new window.Event('click', { bubbles: true }));

    assert.deepEqual(calls, [0.95]);
});

test('multiple HTMLElement-ref editors do not collide without IDs', () => {
    const window = installMinimalRefDom();
    const editorASection = document.querySelector('[data-editor="a"]');
    const editorBSection = document.querySelector('[data-editor="b"]');
    const editorA = new ImageEditor(makeFabricStub(), {
        animationDuration: 0,
        showPlaceholder: false,
    });
    const editorB = new ImageEditor(makeFabricStub(), {
        animationDuration: 0,
        showPlaceholder: false,
    });
    const calls = [];

    editorA.init(
        withoutOptionalControls({
            canvas: editorASection.querySelector('canvas'),
            canvasContainer: editorASection.querySelector('div'),
            zoomInButton: editorASection.querySelector('button'),
        }),
    );
    editorB.init(
        withoutOptionalControls({
            canvas: editorBSection.querySelector('canvas'),
            canvasContainer: editorBSection.querySelector('div'),
            zoomInButton: editorBSection.querySelector('button'),
        }),
    );
    editorA.scaleImage = (scale) => {
        calls.push(['a', scale]);
        return Promise.resolve();
    };
    editorB.scaleImage = (scale) => {
        calls.push(['b', scale]);
        return Promise.resolve();
    };

    editorASection
        .querySelector('button')
        .dispatchEvent(new window.Event('click', { bubbles: true }));
    editorBSection
        .querySelector('button')
        .dispatchEvent(new window.Event('click', { bubbles: true }));

    assert.deepEqual(calls, [
        ['a', 1.05],
        ['b', 1.05],
    ]);
});

test('dispose remains idempotent and disables HTMLElement-ref handlers', () => {
    const window = installDom();
    const zoomInButton = document.getElementById(CANONICAL_IDS.zoomInButton);
    const editor = createEditor(
        withoutOptionalControls({
            canvas: document.getElementById(CANONICAL_IDS.canvas),
            zoomInButton,
        }),
    );
    let calls = 0;
    editor.scaleImage = () => {
        calls += 1;
        return Promise.resolve();
    };

    zoomInButton.dispatchEvent(new window.Event('click', { bubbles: true }));
    assert.equal(calls, 1);

    assert.doesNotThrow(() => editor.dispose());
    assert.doesNotThrow(() => editor.dispose());
    zoomInButton.dispatchEvent(new window.Event('click', { bubbles: true }));

    assert.equal(calls, 1);
});

test('resolveDomElement returns null when a subtype guard rejects the resolved element', () => {
    installDom();

    const canvas = document.getElementById(CANONICAL_IDS.canvas);
    const placeholder = document.getElementById(CANONICAL_IDS.imagePlaceholder);
    const imageInput = document.getElementById(CANONICAL_IDS.imageInput);
    const cropSelect = document.getElementById(CANONICAL_IDS.cropAspectRatioSelect);

    assert.equal(resolveDomElement(CANONICAL_IDS.canvas, document, isCanvasElement), canvas);
    assert.equal(
        resolveDomElement(CANONICAL_IDS.imagePlaceholder, document, isCanvasElement),
        null,
        'a non-canvas ID must not be returned as HTMLCanvasElement',
    );
    assert.equal(resolveDomElement(imageInput, document, isInputElement), imageInput);
    assert.equal(
        resolveDomElement(cropSelect, document, isInputElement),
        null,
        'a select element must not be returned as HTMLInputElement',
    );
    assert.equal(
        resolveDomElement(CANONICAL_IDS.cropAspectRatioSelect, document, isInputOrSelectElement),
        cropSelect,
    );
    assert.equal(
        resolveDomElement(placeholder, document, isInputOrSelectElement),
        null,
        'a generic HTMLElement must not be returned as an input/select control',
    );
});

test('resolveElementTargets ignores unknown runtime keys', () => {
    const resolved = resolveElementTargets({
        canvas: 'customCanvas',
        __unknownElementKey: 'should-not-be-copied',
    });

    assert.equal(resolved.canvas, 'customCanvas');
    assert.equal(Object.prototype.hasOwnProperty.call(resolved, '__unknownElementKey'), false);
});
