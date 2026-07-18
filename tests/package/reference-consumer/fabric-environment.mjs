import * as fabricModule from 'fabric';
import { Image as CanvasImage } from 'canvas';
import { JSDOM } from 'jsdom';

export const fabric = {
    ...(fabricModule.fabric ||
        fabricModule.default?.fabric ||
        fabricModule.default ||
        fabricModule),
};

let elementSequence = 0;

function defineGlobal(name, value) {
    Object.defineProperty(globalThis, name, {
        configurable: true,
        enumerable: true,
        writable: true,
        value,
    });
}

export function installFabricEnvironment() {
    const dom = new JSDOM('<!doctype html><html><body></body></html>', {
        pretendToBeVisual: true,
    });
    const { window } = dom;
    const { document } = window;
    const createElement = document.createElement.bind(document);
    document.createElement = function createFabricElement(tagName, options) {
        const tag = String(tagName).toLowerCase();
        if (tag === 'img' || tag === 'image') return new CanvasImage();
        return createElement(tagName, options);
    };
    Object.defineProperty(window, 'Image', {
        configurable: true,
        writable: true,
        value: CanvasImage,
    });
    fabric.setEnv?.({
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
}

export function createEditorElements({ width = 360, height = 260 } = {}) {
    elementSequence += 1;
    const canvas = document.createElement('canvas');
    const container = document.createElement('div');
    const placeholder = document.createElement('div');
    canvas.id = `consumer-canvas-${elementSequence}`;
    container.id = `consumer-container-${elementSequence}`;
    placeholder.id = `consumer-placeholder-${elementSequence}`;
    Object.defineProperty(container, 'clientWidth', { configurable: true, value: width });
    Object.defineProperty(container, 'clientHeight', { configurable: true, value: height });
    container.append(canvas);
    document.body.append(placeholder, container);
    return Object.freeze({
        canvas: canvas.id,
        canvasContainer: container.id,
        imagePlaceholder: placeholder.id,
    });
}

export function makeImageDataUrl({ width = 160, height = 120, fill = '#d7ebff' } = {}) {
    const canvas = fabric.document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    context.fillStyle = fill;
    context.fillRect(0, 0, width, height);
    context.fillStyle = '#2374ab';
    context.fillRect(8, 8, Math.max(1, Math.floor(width / 2)), Math.max(1, Math.floor(height / 2)));
    return canvas.toDataURL('image/png');
}

export async function disposeEditor(editor) {
    await editor.disposeAsync();
}
