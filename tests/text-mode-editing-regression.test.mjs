/**
 * Type:
 *   Integration regression test
 *
 * Purpose:
 *   Verifies existing text edits and Text mode exits keep callback,
 *   history, and Fabric editing state coherent.
 *
 * Scope:
 *   - Existing text edits emit updateAnnotation.
 *   - Unchanged/cancelled edits do not create history-visible changes.
 *   - Public/DOM Text mode exit commits active Fabric text editing.
 *   - Keyboard Escape keeps its existing cancel-first behavior.
 */

import { register } from 'node:module';

register('./helpers/ts-resolve-hook.mjs', import.meta.url);

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    disposeEditor,
    fabric,
    loadFixtureImage,
    resetEditorDom,
} from './helpers/fabric-environment.mjs';
import { getHistoryManager, requireEditorCanvas } from './helpers/editor-internals.mjs';

const { default: ImageEditor } = await import('../src/index.ts');

async function createSourceEditor(t, options = {}) {
    const ids = resetEditorDom();
    const editor = new ImageEditor(fabric, {
        canvasWidth: 320,
        canvasHeight: 240,
        animationDuration: 0,
        showPlaceholder: false,
        ...options,
    });
    editor.init(ids);
    t.after(() => disposeEditor(editor));
    await loadFixtureImage(editor);
    return { editor, ids };
}

function beginEdit(annotation) {
    annotation.enterEditing();
    assert.equal(annotation.isEditing, true, 'sanity: Fabric text editing started');
}

function setText(annotation, text) {
    annotation.set({ text });
}

test('existing text edit emits updateAnnotation once when editing exits with changes', async (t) => {
    const operations = [];
    const { editor } = await createSourceEditor(t, {
        onAnnotationsChanged: (_annotations, context) =>
            operations.push(['annotations', context.operation]),
        onImageChanged: (_state, context) => operations.push(['image', context.operation]),
    });
    const annotation = editor.createTextAnnotation({ text: 'Before', enterEditing: false });
    assert.ok(annotation);
    const history = getHistoryManager(editor);
    assert.equal(history.canUndo(), true, 'creation pushed history');

    operations.length = 0;
    beginEdit(annotation);
    setText(annotation, 'After');
    annotation.exitEditing();

    assert.deepEqual(operations.slice(), [
        ['annotations', 'updateAnnotation'],
        ['image', 'updateAnnotation'],
    ]);
    assert.equal(history.canUndo(), true);
});

test('unchanged and cancelled text edits do not emit update callbacks', async (t) => {
    const operations = [];
    const { editor } = await createSourceEditor(t, {
        onAnnotationsChanged: (_annotations, context) => operations.push(context.operation),
        onImageChanged: (_state, context) => operations.push(context.operation),
    });
    const annotation = editor.createTextAnnotation({ text: 'Stable', enterEditing: false });
    assert.ok(annotation);

    operations.length = 0;
    beginEdit(annotation);
    annotation.exitEditing();
    assert.deepEqual(operations.slice(), [], 'unchanged edit exits silently');

    beginEdit(annotation);
    setText(annotation, 'Transient');
    const canvas = requireEditorCanvas(editor);
    canvas.setActiveObject(annotation);
    const escape = new window.KeyboardEvent('keydown', { key: 'Escape' });
    document.dispatchEvent(escape);

    assert.equal(annotation.text, 'Stable', 'Escape restores the initial text');
    assert.deepEqual(operations.slice(), [], 'cancelled edit exits silently');
});

test('public exitTextMode commits active Fabric text editing before clearing Text mode', async (t) => {
    const operations = [];
    const { editor } = await createSourceEditor(t, {
        onAnnotationsChanged: (_annotations, context) =>
            operations.push(['annotations', context.operation]),
        onImageChanged: (_state, context) => operations.push(['image', context.operation]),
    });
    editor.enterTextMode();
    const annotation = editor.createTextAnnotation({ text: 'Draft', enterEditing: true });
    assert.ok(annotation);
    assert.equal(annotation.isEditing, true, 'text creation entered Fabric editing');

    operations.length = 0;
    setText(annotation, 'Committed');
    editor.exitTextMode();

    assert.equal(annotation.isEditing, false, 'public exit ends Fabric editing');
    assert.equal(annotation.text, 'Committed', 'public exit commits the active edit');
    assert.deepEqual(operations.slice(), [
        ['annotations', 'updateAnnotation'],
        ['image', 'updateAnnotation'],
        ['image', 'exitTextMode'],
    ]);
});
