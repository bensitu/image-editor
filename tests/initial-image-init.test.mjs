/**
 * Verifies initialImageBase64 failures are reported without unhandled rejections.
 */

import { register } from 'node:module';

register('./helpers/ts-resolve-hook.mjs', import.meta.url);

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const { ImageEditor } = await import('../src/image-editor.ts');

class ErrorImage {
    constructor() {
        this.naturalWidth = 0;
        this.naturalHeight = 0;
        this.listeners = new Map();
    }
    addEventListener(event, handler) {
        this.listeners.set(event, handler);
    }
    removeEventListener(event) {
        this.listeners.delete(event);
    }
    set src(value) {
        this.source = value;
        queueMicrotask(() => {
            this.listeners.get('error')?.(new Event('error'));
        });
    }
    get src() {
        return this.source;
    }
}

class MockCanvas {
    constructor(_canvasElement, options = {}) {
        this.width = options.width ?? 300;
        this.height = options.height ?? 150;
        this.backgroundColor = options.backgroundColor ?? 'transparent';
        this.objects = [];
    }
    on() {}
    getObjects() {
        return [...this.objects];
    }
    getActiveObject() {
        return null;
    }
    discardActiveObject() {
        return this;
    }
    toJSON() {
        return {
            width: this.width,
            height: this.height,
            background: this.backgroundColor,
            objects: [],
        };
    }
    async loadFromJSON(json) {
        this.width = json.width ?? this.width;
        this.height = json.height ?? this.height;
        this.objects = Array.isArray(json.objects) ? json.objects : [];
        return this;
    }
    setDimensions({ width, height }) {
        this.width = width;
        this.height = height;
    }
    renderAll() {}
    requestRenderAll() {}
}

function installDom() {
    const dom = new JSDOM(
        `<!doctype html><html><body>
            <div id="imagePlaceholder"></div>
            <div id="uploadArea"></div>
            <div id="canvasContainer"><canvas id="canvas"></canvas></div>
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
            <ul id="maskList"></ul>
        </body></html>`,
        { pretendToBeVisual: true },
    );
    globalThis.window = dom.window;
    globalThis.document = dom.window.document;
    globalThis.Event = dom.window.Event;
    globalThis.HTMLElement = dom.window.HTMLElement;
    globalThis.HTMLCanvasElement = dom.window.HTMLCanvasElement;
    globalThis.HTMLInputElement = dom.window.HTMLInputElement;
    globalThis.Image = ErrorImage;
    return dom.window.document;
}

test('initialImageBase64 failure reports once and does not create an unhandled rejection', async () => {
    const document = installDom();
    const errors = [];
    let loaded = 0;
    const unhandled = [];
    const onUnhandled = (reason) => {
        unhandled.push(reason);
    };
    process.on('unhandledRejection', onUnhandled);

    try {
        const editor = new ImageEditor(
            {
                Canvas: MockCanvas,
                FabricImage: class FakeFabricImage {},
            },
            {
                initialImageBase64: 'data:image/png;base64,invalid',
                onError: (error, message) => errors.push({ error, message }),
                onImageLoaded: () => {
                    loaded += 1;
                },
            },
        );

        editor.init();
        await new Promise((resolve) => setTimeout(resolve, 20));
    } finally {
        process.off('unhandledRejection', onUnhandled);
    }

    assert.equal(errors.length, 1, 'initial image failure must call onError exactly once');
    assert.match(errors[0].message, /loadImage failed/);
    assert.equal(loaded, 0, 'failed initial image must not call onImageLoaded');
    assert.deepEqual(unhandled, [], 'initial image failure must not be unhandled');
    assert.equal(
        document.getElementById('imagePlaceholder').hidden,
        false,
        'placeholder must remain visible after failed initial load',
    );
});
