/**
 * Type:
 *   Integration regression test
 *
 * Purpose:
 *   Verifies annotation hidden/locked runtime projection preserves the
 *   annotation's base interactivity intent.
 *
 * Scope:
 *   - Text annotation creation flags.
 *   - updateSelectedAnnotation base selectable/evented metadata.
 *   - lock/unlock override restoration.
 *   - saveState/loadFromState persistence.
 *   - mergeMasks live annotation preservation.
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
    return editor;
}

function assertTextInteractivity(annotation, expected, label) {
    assert.equal(annotation.selectable, expected.selectable, `${label}: selectable`);
    assert.equal(annotation.evented, expected.evented, `${label}: evented`);
    assert.equal(annotation.hasControls, expected.hasControls, `${label}: hasControls`);
    assert.equal(annotation.editable, expected.editable, `${label}: editable`);
    assert.equal(
        annotation.annotationSelectable,
        expected.selectable,
        `${label}: metadata selectable`,
    );
    assert.equal(annotation.annotationEvented, expected.evented, `${label}: metadata evented`);
    assert.equal(
        annotation.annotationHasControls,
        expected.hasControls,
        `${label}: metadata controls`,
    );
    assert.equal(annotation.annotationEditable, expected.editable, `${label}: metadata editable`);
}

test('text annotation creation preserves non-default interactivity flags', async (t) => {
    const editor = await createSourceEditor(t);

    const annotation = editor.createTextAnnotation({
        text: 'Locked intent',
        selectable: false,
        evented: false,
        editable: false,
        enterEditing: false,
        styles: { hasControls: false },
    });

    assert.ok(annotation);
    assertTextInteractivity(
        annotation,
        { selectable: false, evented: false, hasControls: false, editable: false },
        'created annotation',
    );
});

test('updateSelectedAnnotation stores base interactivity and lock/unlock restores it', async (t) => {
    const editor = await createSourceEditor(t);
    const annotation = editor.createTextAnnotation({ text: 'A', enterEditing: false });
    assert.ok(annotation);

    editor.updateSelectedAnnotation({ selectable: false, evented: false });

    assert.equal(annotation.selectable, false, 'selectable update remains applied');
    assert.equal(annotation.evented, false, 'evented update remains applied');
    assert.equal(annotation.annotationSelectable, false, 'selectable intent is stored');
    assert.equal(annotation.annotationEvented, false, 'evented intent is stored');

    editor.updateAnnotation(annotation.annotationId, { annotationLocked: true });

    assert.equal(annotation.annotationLocked, true);
    assert.equal(annotation.selectable, false);
    assert.equal(annotation.evented, false);
    assert.equal(annotation.hasControls, false);
    assert.equal(annotation.editable, false);

    editor.updateAnnotation(annotation.annotationId, { annotationLocked: false });

    assert.equal(annotation.annotationLocked, false);
    assert.equal(annotation.selectable, false, 'unlock restores selectable intent');
    assert.equal(annotation.evented, false, 'unlock restores evented intent');
    assert.equal(annotation.hasControls, true, 'unlock restores default controls intent');
    assert.equal(annotation.editable, true, 'unlock restores default editable intent');
});

test('annotation interactivity metadata survives saveState and loadFromState', async (t) => {
    const editor = await createSourceEditor(t);
    const annotation = editor.createTextAnnotation({
        text: 'Persisted',
        selectable: false,
        evented: false,
        editable: false,
        enterEditing: false,
        styles: { hasControls: false },
    });
    assert.ok(annotation);

    const snapshot = editor.saveState();
    await editor.loadFromState(snapshot);

    const [restored] = editor.getAnnotations();
    assert.ok(restored);
    assertTextInteractivity(
        restored,
        { selectable: false, evented: false, hasControls: false, editable: false },
        'restored annotation',
    );
});

test('mergeMasks preserves text annotation interactivity intent', async (t) => {
    const editor = await createSourceEditor(t);
    const annotation = editor.createTextAnnotation({
        text: 'Preserved',
        selectable: false,
        evented: false,
        editable: false,
        enterEditing: false,
        styles: { hasControls: false },
    });
    assert.ok(annotation);
    editor.createMask();

    await editor.mergeMasks();

    const [preserved] = editor.getAnnotations();
    assert.ok(preserved);
    assertTextInteractivity(
        preserved,
        { selectable: false, evented: false, hasControls: false, editable: false },
        'preserved annotation',
    );
});

test('mergeAnnotations preserves mask runtime state across undo and redo', async (t) => {
    const editor = await createSourceEditor(t);
    const mask = editor.createMask({ left: 10, top: 12, width: 30, height: 20 });
    const annotation = editor.createTextAnnotation({ text: 'Bake me', enterEditing: false });
    assert.ok(mask);
    assert.ok(annotation);

    await editor.mergeAnnotations();

    let canvas = requireEditorCanvas(editor);
    let masks = canvas.getObjects().filter((object) => object.editorObjectKind === 'mask');
    assert.equal(masks.length, 1, 'mergeAnnotations preserves masks');
    assert.equal(editor.getAnnotations().length, 0, 'mergeAnnotations removes annotations');
    assert.equal(
        masks[0].imageEditorMaskHandlers?.mouseover instanceof Function,
        true,
        'preserved mask keeps hover behavior',
    );

    await editor.undo();

    canvas = requireEditorCanvas(editor);
    masks = canvas.getObjects().filter((object) => object.editorObjectKind === 'mask');
    assert.equal(masks.length, 1, 'undo restores the preserved mask');
    assert.equal(editor.getAnnotations().length, 1, 'undo restores merged annotations');

    await editor.redo();

    canvas = requireEditorCanvas(editor);
    masks = canvas.getObjects().filter((object) => object.editorObjectKind === 'mask');
    assert.equal(masks.length, 1, 'redo keeps masks while annotations are merged');
    assert.equal(editor.getAnnotations().length, 0, 'redo reapplies annotation merge');
});
