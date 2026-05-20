import assert from 'node:assert/strict';
import fabricModule from 'fabric';

export const fabric = fabricModule.fabric || fabricModule;

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
    defineGlobal('window', fabric.window);
    defineGlobal('document', fabric.document);
    defineGlobal('navigator', fabric.window.navigator);
    defineGlobal('Image', fabric.window.Image);
    defineGlobal('File', fabric.window.File || globalThis.File);
    defineGlobal('Blob', fabric.window.Blob || globalThis.Blob);
    defineGlobal('HTMLCanvasElement', fabric.window.HTMLCanvasElement);
    defineGlobal('HTMLImageElement', fabric.window.HTMLImageElement);
    defineGlobal('HTMLElement', fabric.window.HTMLElement);
    defineGlobal('Node', fabric.window.Node);
    defineGlobal('atob', fabric.window.atob.bind(fabric.window));
    defineGlobal('btoa', fabric.window.btoa.bind(fabric.window));
}

export async function loadImageEditorModule() {
    installFabricDom();
    return import('../../dist/image-editor.esm.mjs');
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
    assert.equal(editor.isImageLoadedToCanvas, true);
}

export async function getImageDimensionsFromDataUrl(dataUrl) {
    await installFabricDom();
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve({ width: img.width, height: img.height });
        img.onerror = reject;
        img.src = dataUrl;
    });
}

export async function waitForCanvasCallbacks(ms = 50) {
    await new Promise(resolve => setTimeout(resolve, ms));
}
