import * as fabric from 'fabric';
import { ImageEditorCore } from '@bensitu/image-editor';
import {
    domControlsPlugin,
    type DomControlsPluginApi,
    type DomPluginBinding,
} from '@bensitu/image-editor/plugins/dom-controls';
import {
    historyPlugin,
    historyPluginRef,
    type HistoryPort,
} from '@bensitu/image-editor/plugins/history';
import {
    transformPlugin,
    transformPluginRef,
    type TransformPluginApi,
} from '@bensitu/image-editor/plugins/transform';
import { createFixtureDataUrl } from '../fixtures/images';

interface DomControlsBrowserHarness {
    create(): Promise<void>;
    load(): Promise<void>;
    scale(value: number): Promise<void>;
    dispose(): Promise<void>;
    state(): Readonly<{
        scale: number;
        inputValue: string;
        canUndo: boolean;
        canRedo: boolean;
        bound: boolean;
    }>;
}

declare global {
    interface Window {
        __domControlsTest: DomControlsBrowserHarness;
    }
}

let editor: ImageEditorCore | null = null;
let transform: TransformPluginApi | null = null;
let history: HistoryPort | null = null;
let controls: DomControlsPluginApi | null = null;

function bind<TApi>(ref: DomPluginBinding<TApi>['ref']): DomPluginBinding<TApi> {
    return Object.freeze({
        ref,
        resolve: () => {
            if (!editor) throw new Error('Editor is not available.');
            return editor.requirePlugin(ref);
        },
    });
}

function requireTransform(): TransformPluginApi {
    if (!transform) throw new Error('Transform is not available.');
    return transform;
}

function requireHistory(): HistoryPort {
    if (!history) throw new Error('History is not available.');
    return history;
}

window.__domControlsTest = Object.freeze({
    async create() {
        if (editor) await editor.disposeAsync();
        editor = new ImageEditorCore(fabric, { canvasWidth: 320, canvasHeight: 240 });
        const installed = editor.install([
            transformPlugin({ animationDuration: 0 }),
            historyPlugin(),
            domControlsPlugin({
                ownerDocument: document,
                transform: {
                    plugin: bind(transformPluginRef),
                    scaleInput: '#scale',
                    zoomInButton: '#zoom-in',
                },
                history: {
                    plugin: bind(historyPluginRef),
                    undoButton: '#undo',
                    redoButton: '#redo',
                },
                keyboard: {},
            }),
        ]);
        [transform, history, controls] = installed;
        await editor.init({ canvas: 'editor-canvas', canvasContainer: 'canvas-container' });
    },
    async load() {
        if (!editor) throw new Error('Editor is not available.');
        await editor.loadImage(createFixtureDataUrl('test-image.png'));
    },
    scale(value: number) {
        return requireTransform().scale(value);
    },
    async dispose() {
        if (editor) await editor.disposeAsync();
    },
    state() {
        const input = document.querySelector<HTMLInputElement>('#scale');
        if (!input || !controls) throw new Error('DOM Controls are not available.');
        return Object.freeze({
            scale: requireTransform().getState().scale,
            inputValue: input.value,
            canUndo: requireHistory().canUndo(),
            canRedo: requireHistory().canRedo(),
            bound: controls.getStatus().isBound,
        });
    },
});
