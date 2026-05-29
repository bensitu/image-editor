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
    defineGlobal('FileReader', fabric.window.FileReader || globalThis.FileReader);
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
        imagePlaceholder: `imagePlaceholder-${domCounter}`,
        scalePercentageInput: `scalePercentageInput-${domCounter}`,
        rotateLeftDegreesInput: `rotateLeftDegreesInput-${domCounter}`,
        rotateRightDegreesInput: `rotateRightDegreesInput-${domCounter}`,
        rotateLeftButton: `rotateLeftButton-${domCounter}`,
        rotateRightButton: `rotateRightButton-${domCounter}`,
        createMaskButton: `createMaskButton-${domCounter}`,
        removeSelectedMaskButton: `removeSelectedMaskButton-${domCounter}`,
        removeAllMasksButton: `removeAllMasksButton-${domCounter}`,
        mergeMasksButton: `mergeMasksButton-${domCounter}`,
        downloadImageButton: `downloadImageButton-${domCounter}`,
        maskList: `maskList-${domCounter}`,
        zoomInButton: `zoomInButton-${domCounter}`,
        zoomOutButton: `zoomOutButton-${domCounter}`,
        resetImageTransformButton: `resetImageTransformButton-${domCounter}`,
        undoButton: `undoButton-${domCounter}`,
        redoButton: `redoButton-${domCounter}`,
        imageInput: `imageInput-${domCounter}`,
        uploadArea: `uploadArea-${domCounter}`,
        enterCropModeButton: `enterCropModeButton-${domCounter}`,
        applyCropButton: `applyCropButton-${domCounter}`,
        cancelCropButton: `cancelCropButton-${domCounter}`
    };
    ids.imgPlaceholder = ids.imagePlaceholder;
    ids.scaleRate = ids.scalePercentageInput;
    ids.rotationLeftInput = ids.rotateLeftDegreesInput;
    ids.rotationRightInput = ids.rotateRightDegreesInput;
    ids.rotateLeftBtn = ids.rotateLeftButton;
    ids.rotateRightBtn = ids.rotateRightButton;
    ids.addMaskBtn = ids.createMaskButton;
    ids.removeMaskBtn = ids.removeSelectedMaskButton;
    ids.removeAllMasksBtn = ids.removeAllMasksButton;
    ids.mergeBtn = ids.mergeMasksButton;
    ids.downloadBtn = ids.downloadImageButton;
    ids.zoomInBtn = ids.zoomInButton;
    ids.zoomOutBtn = ids.zoomOutButton;
    ids.resetBtn = ids.resetImageTransformButton;
    ids.undoBtn = ids.undoButton;
    ids.redoBtn = ids.redoButton;
    ids.cropBtn = ids.enterCropModeButton;
    ids.applyCropBtn = ids.applyCropButton;
    ids.cancelCropBtn = ids.cancelCropButton;

    document.body.innerHTML = `
        <div id="${ids.imagePlaceholder}" class="d-flex"></div>
        <div id="${ids.uploadArea}"></div>
        <div id="${ids.canvasContainer}"><canvas id="${ids.canvas}"></canvas></div>
        <input id="${ids.scalePercentageInput}" value="100">
        <input id="${ids.rotateLeftDegreesInput}" value="90">
        <input id="${ids.rotateRightDegreesInput}" value="90">
        <button id="${ids.rotateLeftButton}"></button>
        <button id="${ids.rotateRightButton}"></button>
        <button id="${ids.createMaskButton}"></button>
        <button id="${ids.removeSelectedMaskButton}"></button>
        <button id="${ids.removeAllMasksButton}"></button>
        <button id="${ids.mergeMasksButton}"></button>
        <button id="${ids.downloadImageButton}"></button>
        <button id="${ids.zoomInButton}"></button>
        <button id="${ids.zoomOutButton}"></button>
        <button id="${ids.resetImageTransformButton}"></button>
        <button id="${ids.undoButton}"></button>
        <button id="${ids.redoButton}"></button>
        <button id="${ids.enterCropModeButton}"></button>
        <button id="${ids.applyCropButton}"></button>
        <button id="${ids.cancelCropButton}"></button>
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
        const imageElement = new Image();
        imageElement.onload = () => resolve({ width: imageElement.width, height: imageElement.height });
        imageElement.onerror = reject;
        imageElement.src = dataUrl;
    });
}

export async function waitForCanvasCallbacks(ms = 50) {
    await new Promise(resolve => setTimeout(resolve, ms));
}
