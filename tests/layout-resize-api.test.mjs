/**
 * Type:
 *   Integration test
 *
 * Purpose:
 *   Verifies the public canvas resize and relayout APIs exposed by ImageEditor.
 *
 * Scope:
 *   - setCanvasSize applies valid dimensions and warns on invalid values.
 *   - resizeToContainer reads live container dimensions or valid fallbacks.
 *   - relayout is safe without a loaded image and after dispose.
 *
 * Out of scope:
 *   - detailed Fit/Cover/Expand layout math, which is covered by layout tests
 *   - visual browser rendering
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    disposeEditor,
    fabric,
    installFabricDom,
    resetEditorDom,
} from './helpers/fabric-environment.mjs';
import { requireEditorCanvas } from './helpers/editor-internals.mjs';

const { ImageEditor } = await import('../src/image-editor.ts');

function setClientSize(element, width, height) {
    Object.defineProperty(element, 'clientWidth', {
        configurable: true,
        value: width,
    });
    Object.defineProperty(element, 'clientHeight', {
        configurable: true,
        value: height,
    });
}

function createResizeEditor(domOptions = {}) {
    installFabricDom();
    const ids = resetEditorDom(domOptions);
    const warnings = [];
    const changes = [];
    const editor = new ImageEditor(fabric, {
        canvasWidth: 320,
        canvasHeight: 240,
        animationDuration: 0,
        showPlaceholder: false,
        onWarning: (error, message) => warnings.push({ error, message }),
        onImageChanged: (state, context) => changes.push({ state, context }),
    });
    editor.init(ids);
    return {
        editor,
        ids,
        warnings,
        changes,
        container: document.getElementById(ids.canvasContainer),
    };
}

test('setCanvasSize applies valid sizes and emits state', (t) => {
    const { editor, changes } = createResizeEditor();
    t.after(() => disposeEditor(editor));

    editor.setCanvasSize(512.4, 333.2);

    const canvas = requireEditorCanvas(editor);
    assert.equal(canvas.getWidth(), 512);
    assert.equal(canvas.getHeight(), 333);
    assert.equal(changes.at(-1).context.operation, 'setCanvasSize');
    assert.equal(changes.at(-1).state.canvasWidth, 512);
    assert.equal(changes.at(-1).state.canvasHeight, 333);
});

test('setCanvasSize warns and no-ops for invalid dimensions', (t) => {
    const { editor, warnings, changes } = createResizeEditor();
    t.after(() => disposeEditor(editor));
    const canvas = requireEditorCanvas(editor);
    const before = { width: canvas.getWidth(), height: canvas.getHeight() };

    editor.setCanvasSize(0, 200);

    assert.equal(canvas.getWidth(), before.width);
    assert.equal(canvas.getHeight(), before.height);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0].message, /invalid canvas dimensions/i);
    assert.equal(changes.length, 0);
});

test('resizeToContainer uses positive container dimensions', (t) => {
    const { editor, container, changes } = createResizeEditor({
        containerWidth: 640,
        containerHeight: 480,
    });
    t.after(() => disposeEditor(editor));
    editor.setCanvasSize(100, 100);
    changes.length = 0;

    setClientSize(container, 640, 480);
    editor.resizeToContainer();

    const canvas = requireEditorCanvas(editor);
    assert.equal(canvas.getWidth(), 640);
    assert.equal(canvas.getHeight(), 480);
    assert.equal(changes.at(-1).context.operation, 'resizeToContainer');
});

test('resizeToContainer uses fallback dimensions when the container is hidden', (t) => {
    const { editor } = createResizeEditor({ containerWidth: 0, containerHeight: 0 });
    t.after(() => disposeEditor(editor));

    editor.resizeToContainer({ fallbackWidth: 450, fallbackHeight: 350 });

    const canvas = requireEditorCanvas(editor);
    assert.equal(canvas.getWidth(), 450);
    assert.equal(canvas.getHeight(), 350);
});

test('relayout does not throw when no image is loaded', (t) => {
    const { editor, container, changes } = createResizeEditor({
        containerWidth: 300,
        containerHeight: 200,
    });
    t.after(() => disposeEditor(editor));

    setClientSize(container, 500, 400);
    assert.doesNotThrow(() => editor.relayout({ preserveScroll: true }));

    const canvas = requireEditorCanvas(editor);
    assert.equal(canvas.getWidth(), 500);
    assert.equal(canvas.getHeight(), 400);
    assert.equal(changes.at(-1).context.operation, 'relayout');
});

test('relayout no-ops after dispose', () => {
    const { editor } = createResizeEditor({ containerWidth: 300, containerHeight: 200 });
    editor.dispose();

    assert.doesNotThrow(() => editor.relayout());
});
