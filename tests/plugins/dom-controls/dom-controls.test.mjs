import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import { JSDOM } from 'jsdom';

import { ImageEditorCore } from '../../../src/core/index.js';
import {
    overlayFoundationPlugin,
    overlayFoundationRef,
} from '../../../src/foundations/overlay/index.js';
import { cropPlugin, cropPluginRef } from '../../../src/plugins/crop/index.js';
import {
    DomControlsConfigurationError,
    domControlsPlugin,
    domControlsPluginRef,
} from '../../../src/plugins/dom-controls/index.js';
import { filtersPlugin, filtersPluginRef } from '../../../src/plugins/filters/index.js';
import { historyPlugin, historyPluginRef } from '../../../src/plugins/history/index.js';
import { maskPlugin, maskPluginRef } from '../../../src/plugins/mask/index.js';
import { transformPlugin, transformPluginRef } from '../../../src/plugins/transform/index.js';
import { definePlugin, definePluginRef } from '../../../src/sdk/index.js';
import { fabric, makeImageDataUrl, resetEditorDom } from '../../helpers/fabric-environment.mjs';

function binding(editor, ref) {
    return Object.freeze({ ref, resolve: () => editor.requirePlugin(ref) });
}

function tick() {
    return new Promise((resolve) => setTimeout(resolve, 10));
}

async function dispose(editor) {
    await editor.disposeAsync();
    document.body.innerHTML = '';
}

async function createIntegratedEditor() {
    const ids = resetEditorDom({ containerWidth: 360, containerHeight: 260 });
    document.body.insertAdjacentHTML(
        'beforeend',
        `<input id="scale" type="number">
         <button id="zoom-in"></button>
         <button id="undo"></button>
         <button id="redo"></button>
         <button id="crop-enter"></button>
         <button id="crop-cancel"></button>
         <div id="filter-status"></div>
         <div id="masks"></div>`,
    );
    const editor = new ImageEditorCore(fabric, { canvasWidth: 360, canvasHeight: 260 });
    let renderedMaskCount = -1;
    let renderedFilterStatus = null;
    const plugins = [
        overlayFoundationPlugin(),
        historyPlugin(),
        transformPlugin({ animationDuration: 0 }),
        maskPlugin({ label: false }),
        filtersPlugin(),
        cropPlugin(),
        domControlsPlugin({
            ownerDocument: document,
            transform: {
                plugin: binding(editor, transformPluginRef),
                scaleInput: '#scale',
                zoomInButton: '#zoom-in',
            },
            history: {
                plugin: binding(editor, historyPluginRef),
                undoButton: '#undo',
                redoButton: '#redo',
            },
            masks: {
                plugin: binding(editor, maskPluginRef),
                list: {
                    target: '#masks',
                    render: (_target, masks) => {
                        renderedMaskCount = masks.length;
                    },
                },
            },
            filters: {
                plugin: binding(editor, filtersPluginRef),
                status: {
                    target: '#filter-status',
                    render: (_target, status) => {
                        renderedFilterStatus = status;
                    },
                },
            },
            crop: {
                plugin: binding(editor, cropPluginRef),
                enterButton: '#crop-enter',
                cancelButton: '#crop-cancel',
            },
            keyboard: {
                overlays: binding(editor, overlayFoundationRef),
            },
        }),
    ];
    const [overlays, history, transform, masks, filters, crop, dom] = editor.install(plugins);
    await editor.init({ canvas: ids.canvas, canvasContainer: ids.canvasContainer });
    await editor.loadImage(makeImageDataUrl({ width: 160, height: 100 }));
    return {
        crop,
        dom,
        editor,
        filters,
        history,
        masks,
        overlays,
        transform,
        renderedMaskCount: () => renderedMaskCount,
        renderedFilterStatus: () => renderedFilterStatus,
    };
}

test('module import is SSR-safe without browser globals', () => {
    const source = [
        'delete globalThis.window;',
        'delete globalThis.document;',
        'delete globalThis.HTMLElement;',
        "const mod = await import('./src/plugins/dom-controls/index.ts');",
        "if (mod.domControlsPluginRef.id !== 'plugin:dom-controls') process.exit(2);",
    ].join('\n');
    const result = spawnSync(
        process.execPath,
        [
            '--import',
            './tests/helpers/register-ts-loader.mjs',
            '--input-type=module',
            '--eval',
            source,
        ],
        { cwd: process.cwd(), encoding: 'utf8' },
    );
    assert.equal(result.status, 0, result.stderr);
});

test('selectors, status streams, programmatic mutations, buttons, and list adapters stay synchronized', async () => {
    const context = await createIntegratedEditor();
    const scale = document.querySelector('#scale');
    const undo = document.querySelector('#undo');
    const redo = document.querySelector('#redo');

    assert.equal(context.dom.getStatus().isBound, true);
    assert.equal(scale.value, '1');
    assert.equal(undo.disabled, true);
    assert.equal(redo.disabled, true);
    assert.equal(context.renderedMaskCount(), 0);
    assert.deepEqual(
        {
            committedFilterCount: context.renderedFilterStatus().committedFilterCount,
            previewFilterCount: context.renderedFilterStatus().previewFilterCount,
        },
        { committedFilterCount: 0, previewFilterCount: 0 },
    );

    await context.transform.scale(1.5);
    assert.equal(scale.value, '1.5');
    assert.equal(undo.disabled, false);

    undo.click();
    assert.equal(undo.disabled, true, 'buttons are disabled while an action is pending');
    await tick();
    assert.equal(context.transform.getState().scale, 1);
    assert.equal(redo.disabled, false);

    await context.masks.create();
    assert.equal(context.renderedMaskCount(), 1);

    await context.filters.preview([{ type: 'brightness', value: 0.25 }]);
    assert.equal(context.renderedFilterStatus().previewFilterCount, 1);
    assert.equal(context.renderedFilterStatus().committedFilterCount, 0);
    await context.filters.commit();
    assert.equal(context.renderedFilterStatus().previewFilterCount, 0);
    assert.equal(context.renderedFilterStatus().committedFilterCount, 1);
    await dispose(context.editor);
});

test('keyboard actions guard editable targets, locked overlays, and handled defaults', async () => {
    const context = await createIntegratedEditor();
    await context.transform.scale(1.4);
    const editable = document.querySelector('#scale');
    const editableUndo = new window.KeyboardEvent('keydown', {
        key: 'z',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
    });
    editable.dispatchEvent(editableUndo);
    await tick();
    assert.equal(editableUndo.defaultPrevented, false);
    assert.equal(context.transform.getState().scale, 1.4);

    const undo = new window.KeyboardEvent('keydown', {
        key: 'z',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
    });
    document.dispatchEvent(undo);
    await tick();
    assert.equal(undo.defaultPrevented, true);
    assert.equal(context.transform.getState().scale, 1);

    await context.crop.enter();
    const escape = new window.KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
    });
    document.dispatchEvent(escape);
    await tick();
    assert.equal(escape.defaultPrevented, true);
    assert.equal(context.crop.isActive, false);

    const removable = await context.masks.create();
    context.overlays.select([removable.maskUid]);
    const remove = new window.KeyboardEvent('keydown', {
        key: 'Delete',
        bubbles: true,
        cancelable: true,
    });
    document.dispatchEvent(remove);
    await tick();
    assert.equal(remove.defaultPrevented, true);
    assert.equal(context.masks.getAll().length, 0);

    const locked = await context.masks.create();
    await context.overlays.setLocked(locked.maskUid, true);
    context.overlays.select([locked.maskUid]);
    const lockedDelete = new window.KeyboardEvent('keydown', {
        key: 'Backspace',
        bubbles: true,
        cancelable: true,
    });
    document.dispatchEvent(lockedDelete);
    await tick();
    assert.equal(lockedDelete.defaultPrevented, false);
    assert.equal(context.masks.getAll().length, 1);
    await dispose(context.editor);
});

function fakeTransformPlugin(api, id = 'test:dom-transform') {
    const ref = definePluginRef(id, '1.0.0');
    return {
        ref,
        plugin: definePlugin({
            ref,
            manifest: {
                id: ref.id,
                version: '1.0.0',
                apiVersion: ref.apiVersion,
                engine: '^3.0.0',
            },
            setupMode: 'sync',
            setup: () => api,
        }),
    };
}

test('invalid and duplicate targets fail initialization with partial listener rollback', async () => {
    const ids = resetEditorDom();
    document.body.insertAdjacentHTML('beforeend', '<button id="valid"></button>');
    let actions = 0;
    const dependency = fakeTransformPlugin({ zoomIn: () => actions++ });
    const editor = new ImageEditorCore(fabric);
    editor.install([
        dependency.plugin,
        domControlsPlugin({
            ownerDocument: document,
            transform: {
                plugin: binding(editor, dependency.ref),
                zoomInButton: '#valid',
                zoomOutButton: '#missing',
            },
        }),
    ]);
    await assert.rejects(
        editor.init({ canvas: ids.canvas, canvasContainer: ids.canvasContainer }),
        (error) => error.cause instanceof DomControlsConfigurationError,
    );
    document.querySelector('#valid').click();
    await tick();
    assert.equal(actions, 0);

    const duplicateIds = resetEditorDom();
    document.body.insertAdjacentHTML('beforeend', '<button id="duplicate"></button>');
    const duplicateDependency = fakeTransformPlugin(
        { zoomIn: () => undefined, zoomOut: () => undefined },
        'test:dom-transform-duplicate',
    );
    const duplicateEditor = new ImageEditorCore(fabric);
    duplicateEditor.install([
        duplicateDependency.plugin,
        domControlsPlugin({
            ownerDocument: document,
            transform: {
                plugin: binding(duplicateEditor, duplicateDependency.ref),
                zoomInButton: '#duplicate',
                zoomOutButton: '#duplicate',
            },
        }),
    ]);
    await assert.rejects(
        duplicateEditor.init({
            canvas: duplicateIds.canvas,
            canvasContainer: duplicateIds.canvasContainer,
        }),
        (error) => /cannot bind the "click" event more than once/.test(error.cause?.message),
    );
});

test('async failures are routed without unhandled rejections', async () => {
    const ids = resetEditorDom();
    document.body.insertAdjacentHTML('beforeend', '<button id="reject"></button>');
    const expected = new Error('expected action failure');
    const dependency = fakeTransformPlugin({ zoomIn: () => Promise.reject(expected) });
    const errors = [];
    const diagnostics = [];
    const editor = new ImageEditorCore(fabric, {
        onError: (error, message) => diagnostics.push({ error, message }),
    });
    editor.install([
        dependency.plugin,
        domControlsPlugin({
            ownerDocument: document,
            transform: {
                plugin: binding(editor, dependency.ref),
                zoomInButton: '#reject',
            },
            onActionError: (event) => errors.push(event),
        }),
    ]);
    await editor.init({ canvas: ids.canvas, canvasContainer: ids.canvasContainer });
    document.querySelector('#reject').click();
    await tick();
    assert.equal(errors.length, 1);
    assert.equal(errors[0].error, expected);
    assert.equal(diagnostics.length, 1);
    assert.equal(diagnostics[0].error, expected);
    await dispose(editor);
});

test('bindings are document-scoped and disposal removes listeners idempotently', async () => {
    const ids = resetEditorDom();
    const foreign = new JSDOM('<!doctype html><button id="action"></button>');
    document.body.insertAdjacentHTML('beforeend', '<button id="action"></button>');
    let actions = 0;
    const dependency = fakeTransformPlugin({ zoomIn: () => actions++ });
    const editor = new ImageEditorCore(fabric);
    const foreignButton = foreign.window.document.querySelector('#action');
    const [, dom] = editor.install([
        dependency.plugin,
        domControlsPlugin({
            ownerDocument: foreign.window.document,
            transform: {
                plugin: binding(editor, dependency.ref),
                zoomInButton: foreignButton,
            },
        }),
    ]);
    await editor.init({ canvas: ids.canvas, canvasContainer: ids.canvasContainer });
    document.querySelector('#action').click();
    foreignButton.click();
    await tick();
    assert.equal(actions, 1);
    await editor.disposeAsync();
    await editor.disposeAsync();
    foreignButton.click();
    await tick();
    assert.equal(actions, 1);
    assert.throws(() => dom.getStatus(), /after the editor has been disposed/u);
    foreign.window.close();
});

test('configured feature dependencies are required by exact PluginRef', () => {
    resetEditorDom();
    const editor = new ImageEditorCore(fabric);
    assert.throws(
        () =>
            editor.use(
                domControlsPlugin({
                    ownerDocument: document,
                    transform: {
                        plugin: binding(editor, transformPluginRef),
                        zoomInButton: document.createElement('button'),
                    },
                }),
            ),
        /requires Plugin "plugin:transform"/,
    );
    assert.equal(editor.getPlugin(domControlsPluginRef), null);
});
