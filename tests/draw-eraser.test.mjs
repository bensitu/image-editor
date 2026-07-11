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
import { requireEditorCanvas } from './helpers/editor-internals.mjs';
import { markAnnotationObject } from '../src/core/editor-object-kind.ts';
import { syncAnnotationRuntimeState } from '../src/annotation/annotation-style.ts';

const { ImageEditor } = await import('../src/index.ts');

function createSourceEditor(options = {}) {
    const ids = resetEditorDom();
    const editor = new ImageEditor(fabric, {
        canvasWidth: 200,
        canvasHeight: 160,
        animationDuration: 0,
        showPlaceholder: false,
        ...options,
    });
    editor.init(ids);
    return editor;
}

function addDrawAnnotation(editor, id, pathData) {
    const canvas = requireEditorCanvas(editor);
    const path = new fabric.Path(pathData, {
        fill: '',
        stroke: '#ff0000',
        strokeWidth: 8,
        selectable: true,
        evented: true,
    });
    const annotation = markAnnotationObject(path, {
        annotationId: id,
        annotationType: 'draw',
        annotationName: `draw${id}`,
        annotationSelectable: true,
        annotationEvented: true,
        annotationHasControls: true,
    });
    syncAnnotationRuntimeState(annotation);
    canvas.add(annotation);
    canvas.renderAll();
    return annotation;
}

test('Draw erase sub-mode removes intersected draw annotations only', async () => {
    const editor = createSourceEditor();
    try {
        await loadFixtureImage(editor, { width: 80, height: 60 });
        editor.createMask({ left: 8, top: 8, width: 20, height: 20 });
        editor.createTextAnnotation({ text: 'keep', left: 14, top: 14, enterEditing: false });
        editor.createShapeAnnotation({ shape: 'rect', left: 18, top: 18, width: 24, height: 24 });
        const draw = addDrawAnnotation(editor, 99, 'M 20 80 L 100 80');
        editor.saveState();

        editor.enterDrawMode();
        editor.setDrawSubMode('erase');
        editor.setEraserConfig({ brushSize: 20 });

        const canvas = requireEditorCanvas(editor);
        canvas.fire('mouse:down', { scenePoint: { x: 40, y: 80 } });
        canvas.fire('mouse:move', { scenePoint: { x: 60, y: 80 } });
        canvas.fire('mouse:up', { scenePoint: { x: 70, y: 80 } });

        assert.equal(editor.getDrawSubMode(), 'erase');
        assert.equal(editor.getAnnotations().includes(draw), false);
        assert.equal(editor.getMasks().length, 1);
        assert.equal(
            editor.getAnnotations().some((annotation) => annotation.annotationType === 'text'),
            true,
        );
        assert.equal(
            editor.getAnnotations().some((annotation) => annotation.annotationType === 'shape'),
            true,
        );

        editor.exitDrawMode();
        await editor.undo();
        assert.equal(
            editor.getAnnotations().some((annotation) => annotation.annotationType === 'draw'),
            true,
        );
    } finally {
        disposeEditor(editor);
    }
});

test('Draw erase sub-mode leaves non-intersected draw annotations intact', async () => {
    const editor = createSourceEditor();
    try {
        await loadFixtureImage(editor, { width: 80, height: 60 });
        const draw = addDrawAnnotation(editor, 100, 'M 20 100 L 100 100');
        editor.saveState();

        editor.enterDrawMode();
        editor.setDrawSubMode('erase');
        const canvas = requireEditorCanvas(editor);
        canvas.fire('mouse:down', { scenePoint: { x: 20, y: 20 } });
        canvas.fire('mouse:move', { scenePoint: { x: 50, y: 20 } });
        canvas.fire('mouse:up', { scenePoint: { x: 80, y: 20 } });

        assert.equal(editor.getAnnotations().includes(draw), true);
    } finally {
        disposeEditor(editor);
    }
});

test('Draw erase sub-mode does not remove a diagonal stroke on bounding-box-only overlap', async () => {
    const editor = createSourceEditor();
    try {
        await loadFixtureImage(editor, { width: 80, height: 60 });
        const draw = addDrawAnnotation(editor, 101, 'M 20 20 L 120 120');
        editor.saveState();

        editor.enterDrawMode();
        editor.setDrawSubMode('erase');
        editor.setEraserConfig({ brushSize: 12 });

        const canvas = requireEditorCanvas(editor);
        canvas.fire('mouse:down', { scenePoint: { x: 105, y: 35 } });
        canvas.fire('mouse:up', { scenePoint: { x: 105, y: 35 } });

        assert.equal(
            editor.getAnnotations().includes(draw),
            true,
            'eraser point inside the diagonal path bounds but far from the stroke must not delete',
        );
    } finally {
        disposeEditor(editor);
    }
});

test('Draw erase sub-mode removes only the touched draw annotation', async () => {
    const editor = createSourceEditor();
    try {
        await loadFixtureImage(editor, { width: 80, height: 60 });
        const touched = addDrawAnnotation(editor, 102, 'M 20 70 L 120 70');
        const untouched = addDrawAnnotation(editor, 103, 'M 20 115 L 120 115');
        editor.saveState();

        editor.enterDrawMode();
        editor.setDrawSubMode('erase');
        editor.setEraserConfig({ brushSize: 18 });

        const canvas = requireEditorCanvas(editor);
        canvas.fire('mouse:down', { scenePoint: { x: 50, y: 70 } });
        canvas.fire('mouse:move', { scenePoint: { x: 80, y: 70 } });
        canvas.fire('mouse:up', { scenePoint: { x: 90, y: 70 } });

        assert.equal(editor.getAnnotations().includes(touched), false);
        assert.equal(editor.getAnnotations().includes(untouched), true);
    } finally {
        disposeEditor(editor);
    }
});

test('Draw erase sub-mode suppresses object targeting and restores the previous setting', async () => {
    const editor = createSourceEditor();
    try {
        await loadFixtureImage(editor, { width: 80, height: 60 });
        const draw = addDrawAnnotation(editor, 104, 'M 20 70 L 120 110');
        const canvas = requireEditorCanvas(editor);
        canvas.skipTargetFind = false;
        canvas.setActiveObject(draw);

        editor.enterDrawMode();
        editor.setDrawSubMode('erase');

        assert.equal(canvas.skipTargetFind, true);
        assert.equal(canvas.getActiveObject(), undefined);

        editor.setDrawSubMode('brush');
        assert.equal(canvas.skipTargetFind, false);

        editor.setDrawSubMode('erase');
        editor.exitDrawMode();
        assert.equal(canvas.skipTargetFind, false);
    } finally {
        disposeEditor(editor);
    }
});

test('Draw path creation reports createDrawAnnotation operation', async () => {
    const operations = [];
    const editor = createSourceEditor({
        onAnnotationsChanged: (_annotations, context) => {
            operations.push(['annotations', context.operation]);
        },
        onImageChanged: (_state, context) => {
            operations.push(['image', context.operation]);
        },
    });
    try {
        await loadFixtureImage(editor, { width: 80, height: 60 });
        editor.enterDrawMode();

        const path = new fabric.Path('M 20 80 L 100 80', {
            fill: '',
            stroke: '#ff0000',
            strokeWidth: 8,
        });
        requireEditorCanvas(editor).fire('path:created', { path });

        assert.deepEqual(operations.filter(([kind]) => kind === 'annotations').at(-1), [
            'annotations',
            'createDrawAnnotation',
        ]);
        assert.deepEqual(operations.at(-1), ['image', 'createDrawAnnotation']);
        assert.notEqual(operations.at(-1)?.[1], 'enterDrawMode');
    } finally {
        disposeEditor(editor);
    }
});
