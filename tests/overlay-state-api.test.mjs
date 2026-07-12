/**
 * Type:
 *   Integration test
 *
 * Purpose:
 *   Verifies ImageEditor non-destructive overlay persistence API behavior.
 *
 * Run:
 *   node --test tests/overlay-state-api.test.mjs
 */

import { register } from 'node:module';

register('./helpers/ts-resolve-hook.mjs', import.meta.url);

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    fabric,
    resetEditorDom,
    loadFixtureImage,
    disposeEditor,
} from './helpers/fabric-environment.mjs';
import { requireEditorCanvas, requireOriginalImage } from './helpers/editor-internals.mjs';

const { ImageEditor, isEditableOverlayObject } = await import('../src/index.ts');
const { markAnnotationObject } = await import('../src/core/editor-object-kind.ts');

function createSourceEditor(options = {}) {
    const ids = resetEditorDom();
    const editor = new ImageEditor(fabric, {
        canvasWidth: 220,
        canvasHeight: 180,
        animationDuration: 0,
        showPlaceholder: false,
        ...options,
    });
    editor.init(ids);
    return editor;
}

function overlayPersistentIds(editor) {
    return requireEditorCanvas(editor)
        .getObjects()
        .filter(isEditableOverlayObject)
        .map(
            (object) =>
                object.overlayPersistentId ?? object.maskUid ?? `annotation-${object.annotationId}`,
        );
}

test('exportOverlayState returns JSON-compatible overlay data and stable mask style', async () => {
    const editor = createSourceEditor();
    try {
        await loadFixtureImage(editor, { width: 100, height: 80 });
        const mask = editor.createMask({
            shape: 'rect',
            left: 10,
            top: 16,
            width: 30,
            height: 20,
            color: 'rgba(255,0,0,0.25)',
            alpha: 0.25,
            styles: { stroke: '#123456', strokeWidth: 4 },
        });
        mask.set({ opacity: 0.9, stroke: '#ffffff', strokeWidth: 9 });

        const state = editor.exportOverlayState();
        const reparsed = JSON.parse(JSON.stringify(state));

        assert.deepEqual(reparsed, state);
        assert.equal(state.schema, 'image-editor.overlay-state');
        assert.equal(state.coordinateSpace, 'image-normalized');
        assert.equal(state.overlays.length, 1);
        assert.equal(state.overlays[0].style.alpha, 0.25);
        assert.equal(state.overlays[0].style.stroke, '#123456');
        assert.equal(state.overlays[0].style.strokeWidth, 4);
        assert.equal('selected' in state.overlays[0], false);
    } finally {
        disposeEditor(editor);
    }
});

test('validateOverlayState does not mutate editor state', async () => {
    const editor = createSourceEditor();
    try {
        await loadFixtureImage(editor, { width: 100, height: 80 });
        editor.createMask();
        const before = editor.getEditorState();

        const result = editor.validateOverlayState({ schema: 'bad' });

        assert.equal(result.valid, false);
        assert.deepEqual(editor.getEditorState(), before);
    } finally {
        disposeEditor(editor);
    }
});

test('importOverlayState validates before mutation and skips unknown custom overlays', async () => {
    const editor = createSourceEditor();
    try {
        await loadFixtureImage(editor, { width: 100, height: 80 });
        editor.createMask();
        await assert.rejects(() =>
            editor.importOverlayState({
                schema: 'image-editor.overlay-state',
                version: 2,
                image: { naturalWidth: 100, naturalHeight: 80 },
                coordinateSpace: 'image-normalized',
                overlays: [],
            }),
        );
        assert.equal(editor.getMasks().length, 1);

        const result = await editor.importOverlayState(
            {
                schema: 'image-editor.overlay-state',
                version: 1,
                image: { naturalWidth: 100, naturalHeight: 80 },
                coordinateSpace: 'image-normalized',
                overlays: [
                    {
                        kind: 'custom',
                        id: 'custom-a',
                        customType: 'app.demo.widget',
                        data: { value: 1 },
                    },
                ],
            },
            { mode: 'append' },
        );

        assert.equal(result.importedOverlays, 0);
        assert.equal(result.skippedOverlays, 1);
        assert.equal(editor.getMasks().length, 1);
    } finally {
        disposeEditor(editor);
    }
});

test('mixed overlay order round-trips and import is undoable as one step', async () => {
    const source = createSourceEditor();
    const target = createSourceEditor();
    try {
        await loadFixtureImage(source, { width: 100, height: 80 });
        await loadFixtureImage(target, { width: 100, height: 80 });

        source.createMask({ shape: 'rect', left: 10, top: 10, width: 20, height: 20 });
        source.createTextAnnotation({
            text: 'A',
            left: 30,
            top: 12,
            enterEditing: false,
        });
        source.createMask({ shape: 'circle', left: 48, top: 10, radius: 8 });
        source.createShapeAnnotation({
            shape: 'arrow',
            x1: 20,
            y1: 55,
            x2: 80,
            y2: 55,
        });

        const state = source.exportOverlayState();
        const expectedOrder = state.overlays.map((overlay) => overlay.id);
        target.createMask({ shape: 'rect', left: 1, top: 1, width: 5, height: 5 });

        const result = await target.importOverlayState(state, {
            mode: 'replace',
            idStrategy: 'preserve',
        });

        assert.equal(result.importedMasks, 2);
        assert.equal(result.importedAnnotations, 2);
        assert.deepEqual(overlayPersistentIds(target), expectedOrder);

        await target.undo();
        assert.equal(target.getMasks().length, 1);
        assert.equal(target.getAnnotations().length, 0);

        await target.redo();
        assert.equal(target.getMasks().length, 2);
        assert.equal(target.getAnnotations().length, 2);
        assert.deepEqual(overlayPersistentIds(target), expectedOrder);

        const previousMaxMaskId = Math.max(...target.getMasks().map((mask) => mask.maskId));
        const maskAfterImport = target.createMask({ shape: 'rect', width: 8, height: 8 });
        assert.equal(maskAfterImport.maskId, previousMaxMaskId + 1);
        assert.equal(target.getMasks().length, 3);
    } finally {
        disposeEditor(source);
        disposeEditor(target);
    }
});

test('replace import removes all adjacent existing overlays', async () => {
    const source = createSourceEditor();
    const target = createSourceEditor();
    try {
        await loadFixtureImage(source, { width: 100, height: 80 });
        await loadFixtureImage(target, { width: 100, height: 80 });

        source.createMask({ shape: 'rect', left: 10, top: 10, width: 20, height: 20 });
        const replacementState = source.exportOverlayState();

        target.createMask({ shape: 'rect', left: 2, top: 2, width: 10, height: 10 });
        target.createMask({ shape: 'rect', left: 14, top: 2, width: 10, height: 10 });
        target.createTextAnnotation({ text: 'old', left: 26, top: 2, enterEditing: false });
        const oldObjects = requireEditorCanvas(target).getObjects().filter(isEditableOverlayObject);
        assert.equal(oldObjects.length, 3);

        await target.importOverlayState(replacementState, {
            mode: 'replace',
            idStrategy: 'preserve',
        });

        const nextObjects = requireEditorCanvas(target)
            .getObjects()
            .filter(isEditableOverlayObject);
        assert.equal(target.getMasks().length, 1);
        assert.equal(target.getAnnotations().length, 0);
        assert.equal(nextObjects.length, 1);
        for (const oldObject of oldObjects) {
            assert.equal(nextObjects.includes(oldObject), false);
        }
    } finally {
        disposeEditor(source);
        disposeEditor(target);
    }
});

test('draw overlay export samples cubic path geometry and round-trips useful points', async () => {
    const source = createSourceEditor();
    const target = createSourceEditor();
    try {
        await loadFixtureImage(source, { width: 100, height: 80 });
        await loadFixtureImage(target, { width: 100, height: 80 });

        const path = new fabric.Path('M 0 0 C 10 0 20 20 30 30', {
            fill: '',
            stroke: '#112233',
            strokeWidth: 3,
            opacity: 1,
            selectable: true,
            evented: true,
            objectCaching: false,
        });
        const draw = markAnnotationObject(path, {
            annotationId: 1,
            annotationType: 'draw',
            annotationName: 'Draw 1',
            annotationSelectable: true,
            annotationEvented: true,
            annotationHasControls: path.hasControls !== false,
        });
        requireEditorCanvas(source).add(draw);

        const state = source.exportOverlayState();
        const drawOverlay = state.overlays.find((overlay) => overlay.annotationType === 'draw');
        assert.ok(drawOverlay);
        assert.ok(
            drawOverlay.strokes[0].points.length > 2,
            'cubic paths must export sampled intermediate points',
        );

        await target.importOverlayState(state, { idStrategy: 'preserve' });
        const roundTripped = target.exportOverlayState();
        const roundTrippedDraw = roundTripped.overlays.find(
            (overlay) => overlay.annotationType === 'draw',
        );
        assert.ok(roundTrippedDraw);
        assert.ok(roundTrippedDraw.strokes[0].points.length > 2);
    } finally {
        disposeEditor(source);
        disposeEditor(target);
    }
});

test('import without baseImageTransform preserves existing base image rotation', async () => {
    const editor = createSourceEditor();
    try {
        await loadFixtureImage(editor, { width: 100, height: 80 });
        await editor.rotateImage(90);
        const beforeAngle = requireOriginalImage(editor).angle;

        await editor.importOverlayState(
            {
                schema: 'image-editor.overlay-state',
                version: 1,
                image: { naturalWidth: 100, naturalHeight: 80 },
                coordinateSpace: 'image-normalized',
                overlays: [],
            },
            { mode: 'append' },
        );

        assert.notEqual(beforeAngle, 0);
        assert.equal(requireOriginalImage(editor).angle, beforeAngle);
    } finally {
        disposeEditor(editor);
    }
});

test('base image flip transform is exported and imported onto overlays', async () => {
    const source = createSourceEditor();
    const target = createSourceEditor();
    try {
        await loadFixtureImage(source, { width: 100, height: 80 });
        await loadFixtureImage(target, { width: 100, height: 80 });

        source.createMask({ shape: 'rect', left: 10, top: 10, width: 20, height: 20 });
        await source.flipHorizontal();
        const state = source.exportOverlayState();

        assert.equal(state.baseImageTransform.flipX, true);
        assert.ok(
            state.overlays[0].geometry.x > 0.8,
            'export stores the source-space coordinate under the persisted flip',
        );

        await target.importOverlayState(state, { idStrategy: 'preserve' });
        assert.equal(target.getEditorState().isFlippedHorizontally, true);
        assert.ok(
            Math.abs(target.getMasks()[0].left - source.getMasks()[0].left) < 1,
            'import maps the flipped source coordinate back to the same visual side',
        );
    } finally {
        disposeEditor(source);
        disposeEditor(target);
    }
});
