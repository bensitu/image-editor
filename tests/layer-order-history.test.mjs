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
 *   - Layer actions preserve list selection highlights after list rerendering.
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

async function createSourceEditorWithLists(t, options = {}) {
    const ids = resetEditorDom();
    if (options.omitLists) {
        ids.maskList = null;
        ids.annotationList = null;
    } else {
        const annotationList = document.createElement('ul');
        annotationList.id = `annotationList-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        document.body.appendChild(annotationList);
        ids.annotationList = annotationList.id;
    }

    const editor = new ImageEditor(fabric, {
        canvasWidth: 320,
        canvasHeight: 240,
        animationDuration: 0,
        showPlaceholder: false,
        ...(options.editorOptions ?? {}),
    });
    editor.init(ids);
    t.after(() => disposeEditor(editor));
    await loadFixtureImage(editor);
    return { editor, ids };
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

function requireListItem(listId, selector) {
    const list = document.getElementById(listId);
    assert.ok(list, `list ${listId} must exist`);
    const item = list.querySelector(selector);
    assert.ok(item, `list item ${selector} must exist`);
    return item;
}

function listDatasetValues(listId, selector, key) {
    const list = document.getElementById(listId);
    assert.ok(list, `list ${listId} must exist`);
    return Array.from(list.querySelectorAll(selector)).map((item) => item.dataset[key]);
}

test('mask and annotation lists default to front-to-back order', async (t) => {
    const { editor, ids } = await createSourceEditorWithLists(t);
    const mask1 = editor.createMask({ name: 'Mask ' });
    const mask2 = editor.createMask({ name: 'Mask ' });
    const annotation1 = editor.createTextAnnotation({ text: 'First', enterEditing: false });
    const annotation2 = editor.createTextAnnotation({ text: 'Second', enterEditing: false });
    assert.ok(mask1);
    assert.ok(mask2);
    assert.ok(annotation1);
    assert.ok(annotation2);

    assert.deepEqual(listDatasetValues(ids.maskList, '.mask-item', 'maskId'), [
        String(mask2.maskId),
        String(mask1.maskId),
    ]);
    assert.deepEqual(listDatasetValues(ids.annotationList, '.annotation-item', 'annotationId'), [
        String(annotation2.annotationId),
        String(annotation1.annotationId),
    ]);
});

test('mask and annotation lists can use back-to-front order', async (t) => {
    const { editor, ids } = await createSourceEditorWithLists(t, {
        editorOptions: {
            maskListOrder: 'back-to-front',
            annotationListOrder: 'back-to-front',
        },
    });
    const mask1 = editor.createMask({ name: 'Mask ' });
    const mask2 = editor.createMask({ name: 'Mask ' });
    const annotation1 = editor.createTextAnnotation({ text: 'First', enterEditing: false });
    const annotation2 = editor.createTextAnnotation({ text: 'Second', enterEditing: false });
    assert.ok(mask1);
    assert.ok(mask2);
    assert.ok(annotation1);
    assert.ok(annotation2);

    assert.deepEqual(listDatasetValues(ids.maskList, '.mask-item', 'maskId'), [
        String(mask1.maskId),
        String(mask2.maskId),
    ]);
    assert.deepEqual(listDatasetValues(ids.annotationList, '.annotation-item', 'annotationId'), [
        String(annotation1.annotationId),
        String(annotation2.annotationId),
    ]);
});
test('layer operations preserve mask list highlight after rerender', async (t) => {
    const { editor, ids } = await createSourceEditorWithLists(t);
    const mask = editor.createMask({ name: 'Mask ' });
    const annotation = editor.createTextAnnotation({ text: 'Layered', enterEditing: false });
    assert.ok(mask);
    assert.ok(annotation);

    requireListItem(ids.maskList, `[data-mask-id="${mask.maskId}"]`).click();
    assert.equal(
        requireListItem(ids.maskList, `[data-mask-id="${mask.maskId}"]`).classList.contains(
            'active',
        ),
        true,
        'mask item is highlighted before layer move',
    );

    editor.bringSelectedObjectToFront();

    assert.deepEqual(overlayNames(editor), [annotation.annotationName, mask.maskName]);
    assert.equal(
        requireListItem(ids.maskList, `[data-mask-id="${mask.maskId}"]`).classList.contains(
            'active',
        ),
        true,
        'mask item remains highlighted after list rerender',
    );
});

test('layer operations preserve annotation list highlight after rerender', async (t) => {
    const { editor, ids } = await createSourceEditorWithLists(t);
    const mask = editor.createMask({ name: 'Mask ' });
    const annotation = editor.createTextAnnotation({ text: 'Layered', enterEditing: false });
    assert.ok(mask);
    assert.ok(annotation);

    requireListItem(
        ids.annotationList,
        `[data-annotation-id="${annotation.annotationId}"]`,
    ).click();
    assert.equal(
        requireListItem(
            ids.annotationList,
            `[data-annotation-id="${annotation.annotationId}"]`,
        ).classList.contains('active'),
        true,
        'annotation item is highlighted before layer move',
    );

    editor.sendSelectedObjectToBack();

    assert.deepEqual(overlayNames(editor), [annotation.annotationName, mask.maskName]);
    assert.equal(
        requireListItem(
            ids.annotationList,
            `[data-annotation-id="${annotation.annotationId}"]`,
        ).classList.contains('active'),
        true,
        'annotation item remains highlighted after list rerender',
    );
});

test('layer operations tolerate omitted mask and annotation lists', async (t) => {
    const { editor } = await createSourceEditorWithLists(t, { omitLists: true });
    const mask = editor.createMask({ name: 'Mask ' });
    const annotation = editor.createTextAnnotation({ text: 'Layered', enterEditing: false });
    assert.ok(mask);
    assert.ok(annotation);

    assert.doesNotThrow(() => {
        editor.sendSelectedObjectToBack();
    });

    assert.deepEqual(overlayNames(editor), [annotation.annotationName, mask.maskName]);
});
