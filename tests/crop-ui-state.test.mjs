/**
 * @file crop-ui-state.test.mjs
 *
 * Type:
 *   Unit test
 *
 * Purpose:
 *   Verifies the ImageEditor facade UI state machine around crop mode. Entering crop
 *   mode freezes toolbar buttons, the file picker, and numeric transform inputs;
 *   leaving crop mode must restore those same controls through the normal _updateUI
 *   path.
 *
 * Scope:
 *   - The test uses jsdom and a minimal Fabric canvas stub because it only observes
 *     DOM disabled flags.
 *   - apply and cancel crop buttons stay enabled while the crop session is active.
 *   - scalePercentageInput, rotation inputs, and imageInput are re-enabled after the session
 *     ends.
 *
 * Out of scope:
 *   - visual rendering quality
 *   - browser-specific pointer interaction details
 *   - unrelated mask and export features
 *
 * Environment:
 *   - Node.js ESM
 *   - jsdom or DOM stubs are used where needed
 *   - Fabric/canvas behavior is mocked where needed
 *
 * Run:
 *   node --test tests/crop-ui-state.test.mjs
 *
 * Notes:
 *   - Prefer behavior-level assertions over implementation-detail checks.
 *   - Keep this file focused on crop-mode UI state restoration only.
 */

import { register } from 'node:module';

register('./helpers/ts-resolve-hook.mjs', import.meta.url);

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const { ImageEditor } = await import('../src/image-editor.ts');

const CONTROL_KEYS = [
    'scalePercentageInput',
    'rotateLeftDegreesInput',
    'rotateRightDegreesInput',
    'imageInput',
];

class MockCanvas {
    constructor() {
        this._objects = [];
        this._active = null;
    }
    on() {}
    getObjects() {
        return [...this._objects];
    }
    getActiveObject() {
        return this._active;
    }
    discardActiveObject() {
        this._active = null;
        return this;
    }
    requestRenderAll() {}
    renderAll() {}
}

function installDom() {
    const dom = new JSDOM(
        `<!DOCTYPE html><html><body>
            <div id="imagePlaceholder"></div>
            <div id="canvasContainer">
                <canvas id="canvas"></canvas>
            </div>
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
    fabric.Canvas = class CapturingCanvas extends MockCanvas {
        constructor() {
            super();
            fabric.lastCanvas = this;
        }
    };
    return fabric;
}

function getControl(key) {
    const el = document.getElementById(key);
    assert.ok(el, `missing control ${key}`);
    return el;
}

test('leaving crop mode re-enables frozen file and transform inputs', () => {
    installDom();
    const fabric = makeFabricStub();
    const editor = new ImageEditor(fabric, {
        animationDuration: 0,
        showPlaceholder: false,
    });

    editor.init({});
    editor.originalImage = new fabric.FabricImage();

    editor._cropSession = {};
    editor._updateUI();

    for (const key of CONTROL_KEYS) {
        assert.equal(getControl(key).disabled, true, `${key} must be frozen in crop mode`);
    }
    assert.equal(getControl('applyCropButton').disabled, false);
    assert.equal(getControl('cancelCropButton').disabled, false);

    editor._cropSession = null;
    editor._updateUI();

    for (const key of CONTROL_KEYS) {
        assert.equal(getControl(key).disabled, false, `${key} must be restored after crop mode`);
    }
});
