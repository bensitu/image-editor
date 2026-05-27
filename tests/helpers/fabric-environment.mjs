import assert from 'node:assert/strict';
import * as fabricModule from 'fabric';
import { JSDOM } from 'jsdom';
import { Image as CanvasImage } from 'canvas';

export const fabric = { ...(fabricModule.fabric || fabricModule.default?.fabric || fabricModule.default || fabricModule) };

let domCounter = 0;

function defineGlobal(name, value) {
    Object.defineProperty(globalThis, name, {
        configurable: true,
        enumerable: true,
        writable: true,
        value
    });
}

export function installFabricDom() {
    const dom = new JSDOM('<!doctype html><html><body></body></html>', {
        pretendToBeVisual: true,
    });
    const { window } = dom;
    const { document } = window;
    const createElement = document.createElement.bind(document);
    document.createElement = function patchedCreateElement(tagName, options) {
        const tag = String(tagName).toLowerCase();
        if (tag === 'img' || tag === 'image') {
            return new CanvasImage();
        }
        return createElement(tagName, options);
    };
    Object.defineProperty(window, 'Image', {
        configurable: true,
        writable: true,
        value: CanvasImage,
    });

    if (typeof fabric.setEnv === 'function') {
        fabric.setEnv({
            document,
            window,
            isTouchSupported: false,
            WebGLProbe: {
                isSupported: () => false,
                queryWebGL: () => undefined,
            },
            dispose: () => undefined,
            copyPasteData: {},
        });
    }

    fabric.window = window;
    fabric.document = document;

    defineGlobal('window', window);
    defineGlobal('document', document);
    defineGlobal('navigator', window.navigator);
    defineGlobal('Image', CanvasImage);
    defineGlobal('File', window.File || globalThis.File);
    defineGlobal('FileReader', window.FileReader || globalThis.FileReader);
    defineGlobal('Blob', window.Blob || globalThis.Blob);
    defineGlobal('HTMLCanvasElement', window.HTMLCanvasElement);
    defineGlobal('HTMLImageElement', window.HTMLImageElement);
    defineGlobal('HTMLElement', window.HTMLElement);
    defineGlobal('Node', window.Node);
    defineGlobal('atob', window.atob.bind(window));
    defineGlobal('btoa', window.btoa.bind(window));
    defineGlobal('fabric', fabric);
}

export async function loadImageEditorModule() {
    installFabricDom();
    return import('../../dist/esm/index.js');
}

export function resetEditorDom({ containerWidth = 0, containerHeight = 0 } = {}) {
    installFabricDom();
    domCounter += 1;

    const ids = {
        canvas: `fabricCanvas-${domCounter}`,
        canvasContainer: `canvasContainer-${domCounter}`,
        imgPlaceholder: `imgPlaceholder-${domCounter}`,
        scaleRate: `scaleRate-${domCounter}`,
        rotationLeftInput: `rotationLeftInput-${domCounter}`,
        rotationRightInput: `rotationRightInput-${domCounter}`,
        rotateLeftBtn: `rotateLeftBtn-${domCounter}`,
        rotateRightBtn: `rotateRightBtn-${domCounter}`,
        addMaskBtn: `addMaskBtn-${domCounter}`,
        removeMaskBtn: `removeMaskBtn-${domCounter}`,
        removeAllMasksBtn: `removeAllMasksBtn-${domCounter}`,
        mergeBtn: `mergeBtn-${domCounter}`,
        downloadBtn: `downloadBtn-${domCounter}`,
        maskList: `maskList-${domCounter}`,
        zoomInBtn: `zoomInBtn-${domCounter}`,
        zoomOutBtn: `zoomOutBtn-${domCounter}`,
        resetBtn: `resetBtn-${domCounter}`,
        undoBtn: `undoBtn-${domCounter}`,
        redoBtn: `redoBtn-${domCounter}`,
        imageInput: `imageInput-${domCounter}`,
        uploadArea: `uploadArea-${domCounter}`,
        cropBtn: `cropBtn-${domCounter}`,
        applyCropBtn: `applyCropBtn-${domCounter}`,
        cancelCropBtn: `cancelCropBtn-${domCounter}`
    };

    document.body.innerHTML = `
        <div id="${ids.imgPlaceholder}" class="d-flex"></div>
        <div id="${ids.uploadArea}"></div>
        <div id="${ids.canvasContainer}"><canvas id="${ids.canvas}"></canvas></div>
        <input id="${ids.scaleRate}" value="100">
        <input id="${ids.rotationLeftInput}" value="90">
        <input id="${ids.rotationRightInput}" value="90">
        <button id="${ids.rotateLeftBtn}"></button>
        <button id="${ids.rotateRightBtn}"></button>
        <button id="${ids.addMaskBtn}"></button>
        <button id="${ids.removeMaskBtn}"></button>
        <button id="${ids.removeAllMasksBtn}"></button>
        <button id="${ids.mergeBtn}"></button>
        <button id="${ids.downloadBtn}"></button>
        <button id="${ids.zoomInBtn}"></button>
        <button id="${ids.zoomOutBtn}"></button>
        <button id="${ids.resetBtn}"></button>
        <button id="${ids.undoBtn}"></button>
        <button id="${ids.redoBtn}"></button>
        <button id="${ids.cropBtn}"></button>
        <button id="${ids.applyCropBtn}"></button>
        <button id="${ids.cancelCropBtn}"></button>
        <input id="${ids.imageInput}" type="file">
        <ul id="${ids.maskList}"></ul>
    `;

    const container = document.getElementById(ids.canvasContainer);
    Object.defineProperty(container, 'clientWidth', {
        configurable: true,
        value: containerWidth
    });
    Object.defineProperty(container, 'clientHeight', {
        configurable: true,
        value: containerHeight
    });

    return ids;
}

export async function createEditor(options = {}, domOptions = {}) {
    const { default: ImageEditor } = await loadImageEditorModule();
    const ids = resetEditorDom(domOptions);
    const editor = new ImageEditor({
        canvasWidth: 320,
        canvasHeight: 240,
        animationDuration: 0,
        showPlaceholder: false,
        ...options
    });

    editor.init(ids);
    return { editor, ids, ImageEditor };
}

export function disposeEditor(editor) {
    if (editor) {
        try {
            editor.dispose();
        } catch (error) {
            void error;
        }
    }
    document.body.innerHTML = '';
}

export function makeImageDataUrl({
    width = 160,
    height = 120,
    fill = '#d7ebff',
    format = 'image/png'
} = {}) {
    const canvas = fabric.document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = fill;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#2374ab';
    ctx.fillRect(8, 8, Math.max(1, Math.floor(width / 2)), Math.max(1, Math.floor(height / 2)));
    ctx.fillStyle = '#f2a541';
    ctx.fillRect(Math.max(1, Math.floor(width / 2)), Math.max(1, Math.floor(height / 3)), Math.max(1, Math.floor(width / 3)), Math.max(1, Math.floor(height / 3)));
    return canvas.toDataURL(format);
}

export async function loadFixtureImage(editor, options = {}) {
    const loaded = await editor.loadImage(makeImageDataUrl(options));
    assert.equal(loaded, undefined);
    assert.equal(editor.isImageLoaded(), true);
}

export async function getImageDimensionsFromDataUrl(dataUrl) {
    await installFabricDom();
    return new Promise((resolve, reject) => {
        const imageElement = new Image();
        imageElement.onload = () => resolve({ width: imageElement.width, height: imageElement.height });
        imageElement.onerror = reject;
        imageElement.src = dataUrl;
    });
}

export async function waitForCanvasCallbacks(ms = 50) {
    await new Promise(resolve => setTimeout(resolve, ms));
}
