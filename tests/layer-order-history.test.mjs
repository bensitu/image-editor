/**
 * Type:
 *   Integration regression test
 *
 * Purpose:
 *   Verifies user-defined editable overlay order survives history and state
 *   restoration paths.
 *
 * Scope:
 *   - Layer actions reorder overlays.
 *   - Undo/redo restore overlay order.
 *   - loadFromState preserves the snapshot order.
 *   - Base images stay below overlays.
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
import { requireEditorCanvas } from './helpers/editor-internals.mjs';

const { default: ImageEditor } = await import('../src/index.ts');

async function createSourceEditor(t) {
    const ids = resetEditorDom();
    const editor = new ImageEditor(fabric, {
        canvasWidth: 320,
        canvasHeight: 240,
        animationDuration: 0,
        showPlaceholder: false,
    });
    editor.init(ids);
    t.after(() => disposeEditor(editor));
    await loadFixtureImage(editor);
    return editor;
}

function objectKindName(object) {
    if (object.editorObjectKind === 'baseImage') return 'base';
    if (object.editorObjectKind === 'mask') return object.maskName;
    if (object.editorObjectKind === 'annotation') return object.annotationName;
    if (object.editorObjectKind === 'session') return `session:${object.sessionObjectType}`;
    return 'other';
}

function stackNames(editor) {
    return requireEditorCanvas(editor).getObjects().map(objectKindName);
}

function overlayNames(editor) {
    return requireEditorCanvas(editor)
        .getObjects()
        .filter(
            (object) =>
                object.editorObjectKind === 'mask' || object.editorObjectKind === 'annotation',
        )
        .map(objectKindName);
}

test('layer operations preserve overlay order through save/load and undo/redo', async (t) => {
    const editor = await createSourceEditor(t);
    const mask = editor.createMask({ name: 'Mask ' });
    const annotation = editor.createTextAnnotation({ text: 'Layered', enterEditing: false });
    assert.ok(mask);
    assert.ok(annotation);
    assert.deepEqual(overlayNames(editor), [mask.maskName, annotation.annotationName]);

    editor.sendSelectedObjectToBack();

    assert.deepEqual(overlayNames(editor), [annotation.annotationName, mask.maskName]);
    assert.equal(stackNames(editor)[0], 'base', 'base image remains below overlays');

    const reorderedSnapshot = editor.captureSnapshotInternal();
    await editor.loadFromState(reorderedSnapshot);
    assert.deepEqual(
        overlayNames(editor),
        [annotation.annotationName, mask.maskName],
        'loadFromState restores snapshot overlay order',
    );

    await editor.undo();
    assert.deepEqual(
        overlayNames(editor),
        [mask.maskName, annotation.annotationName],
        'undo restores previous overlay order',
    );

    await editor.redo();
    assert.deepEqual(
        overlayNames(editor),
        [annotation.annotationName, mask.maskName],
        'redo reapplies overlay order',
    );
});
