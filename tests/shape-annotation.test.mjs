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
import { getLastSnapshot } from './helpers/editor-internals.mjs';

const { ImageEditor, isShapeAnnotationObject, isDrawAnnotationObject, isTextAnnotationObject } =
    await import('../src/index.ts');

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

test('createShapeAnnotation creates rect, line, and arrow annotations with shape metadata', async () => {
    const editor = createSourceEditor();
    try {
        await loadFixtureImage(editor, { width: 64, height: 48 });

        const rect = editor.createShapeAnnotation({
            shape: 'rect',
            left: 10,
            top: 12,
            width: 40,
            height: 30,
        });
        const line = editor.createShapeAnnotation({
            shape: 'line',
            x1: 20,
            y1: 20,
            x2: 80,
            y2: 20,
        });
        const arrow = editor.createShapeAnnotation({
            shape: 'arrow',
            x1: 30,
            y1: 30,
            x2: 90,
            y2: 60,
        });

        assert.equal(isShapeAnnotationObject(rect), true);
        assert.equal(rect.shapeAnnotationKind, 'rect');
        assert.equal(isShapeAnnotationObject(line), true);
        assert.equal(line.shapeAnnotationKind, 'line');
        assert.equal(line.type, 'path');
        assert.equal(isShapeAnnotationObject(arrow), true);
        assert.equal(arrow.shapeAnnotationKind, 'arrow');
        assert.equal(arrow.type, 'path');
        assert.equal(editor.getAnnotations().length, 3);
        assert.equal(isTextAnnotationObject(rect), false);
        assert.equal(isDrawAnnotationObject(rect), false);
    } finally {
        disposeEditor(editor);
    }
});

test('shape annotations survive loadFromState and update through annotation API', async () => {
    const editor = createSourceEditor();
    const restored = createSourceEditor();
    try {
        await loadFixtureImage(editor, { width: 64, height: 48 });
        const shape = editor.createShapeAnnotation({
            shape: 'arrow',
            x1: 10,
            y1: 10,
            x2: 80,
            y2: 50,
            stroke: '#00ff00',
        });
        editor.updateAnnotation(shape.annotationId, {
            stroke: '#0000ff',
            strokeWidth: 5,
            opacity: 0.5,
        });
        const snapshot = getLastSnapshot(editor);

        await restored.loadFromState(snapshot);
        const [restoredShape] = restored.getAnnotations();
        assert.equal(isShapeAnnotationObject(restoredShape), true);
        assert.equal(restoredShape.shapeAnnotationKind, 'arrow');
        assert.equal(restoredShape.stroke, '#0000ff');
        assert.equal(restoredShape.strokeWidth, 5);
        assert.equal(restoredShape.opacity, 0.5);
    } finally {
        disposeEditor(editor);
        disposeEditor(restored);
    }
});

test('Shape mode reports active tool mode and cleans cancelled preview on exit', async () => {
    const editor = createSourceEditor();
    try {
        await loadFixtureImage(editor, { width: 64, height: 48 });

        editor.setShapeConfig({ stroke: '#123456', strokeWidth: 4 });
        editor.enterShapeMode('rect');

        assert.equal(editor.isShapeMode(), true);
        assert.equal(editor.getActiveToolMode(), 'shape');
        assert.equal(editor.getShapeConfig().stroke, '#123456');

        editor.exitShapeMode();

        assert.equal(editor.isShapeMode(), false);
        assert.equal(editor.getActiveToolMode(), null);
        assert.equal(
            editor.getAnnotations().some((annotation) => annotation.annotationType === 'shape'),
            false,
        );
    } finally {
        disposeEditor(editor);
    }
});
