import * as fabricModule from 'fabric';
import { Image as CanvasImage } from 'canvas';
import { JSDOM } from 'jsdom';

export const fabric = {
    ...(fabricModule.fabric ||
        fabricModule.default?.fabric ||
        fabricModule.default ||
        fabricModule),
};

let domCounter = 0;

function defineGlobal(name, value) {
    Object.defineProperty(globalThis, name, {
        configurable: true,
        enumerable: true,
        writable: true,
        value,
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
        if (tag === 'img' || tag === 'image') return new CanvasImage();
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

export function resetEditorDom({ containerWidth = 0, containerHeight = 0 } = {}) {
    installFabricDom();
    domCounter += 1;
    const ids = {
        canvas: `canvas-${domCounter}`,
        canvasContainer: `canvas-container-${domCounter}`,
        imagePlaceholder: `image-placeholder-${domCounter}`,
    };

    document.body.innerHTML = `
        <div id="${ids.imagePlaceholder}"></div>
        <div id="${ids.canvasContainer}"><canvas id="${ids.canvas}"></canvas></div>
    `;
    const container = document.getElementById(ids.canvasContainer);
    Object.defineProperty(container, 'clientWidth', {
        configurable: true,
        value: containerWidth,
    });
    Object.defineProperty(container, 'clientHeight', {
        configurable: true,
        value: containerHeight,
    });
    return ids;
}

export function disposeEditor(editor) {
    if (editor) {
        try {
            editor.dispose();
        } catch {
            // Test teardown must tolerate an intentionally faulted editor.
        }
    }
    document.body.innerHTML = '';
}

export function makeImageDataUrl({
    width = 160,
    height = 120,
    fill = '#d7ebff',
    format = 'image/png',
} = {}) {
    const canvas = fabric.document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    context.fillStyle = fill;
    context.fillRect(0, 0, width, height);
    context.fillStyle = '#2374ab';
    context.fillRect(8, 8, Math.max(1, Math.floor(width / 2)), Math.max(1, Math.floor(height / 2)));
    context.fillStyle = '#f2a541';
    context.fillRect(
        Math.max(1, Math.floor(width / 2)),
        Math.max(1, Math.floor(height / 3)),
        Math.max(1, Math.floor(width / 3)),
        Math.max(1, Math.floor(height / 3)),
    );
    return canvas.toDataURL(format);
}
