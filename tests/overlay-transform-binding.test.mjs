/**
 * Integration coverage for opt-in base-image transform binding.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    disposeEditor,
    fabric,
    installFabricDom,
    loadFixtureImage,
    makeImageDataUrl,
    resetEditorDom,
} from './helpers/fabric-environment.mjs';
import {
    getHistoryManager,
    requireEditorCanvas,
    requireOriginalImage,
} from './helpers/editor-internals.mjs';
import { syncAnnotationRuntimeState } from '../src/annotation/annotation-style.ts';
import { markAnnotationObject } from '../src/core/editor-object-kind.ts';

installFabricDom();

const { ImageEditor } = await import('../src/index.ts');

const MARKER = new fabric.Point(7, -4);

function createSourceEditor(options = {}) {
    const ids = resetEditorDom();
    const editor = new ImageEditor(fabric, {
        canvasWidth: 320,
        canvasHeight: 240,
        animationDuration: 0,
        showPlaceholder: false,
        ...options,
    });
    editor.init(ids);
    return editor;
}

function determinant(matrix) {
    return matrix[0] * matrix[3] - matrix[1] * matrix[2];
}

function assertClose(actual, expected, message, epsilon = 1e-6) {
    assert.ok(
        Math.abs(actual - expected) <= epsilon,
        `${message}: expected ${expected}, received ${actual}`,
    );
}

function assertPointClose(actual, expected, message, epsilon = 1e-6) {
    assertClose(actual.x, expected.x, `${message} (x)`, epsilon);
    assertClose(actual.y, expected.y, `${message} (y)`, epsilon);
}

function assertMatrixClose(actual, expected, message, epsilon = 1e-6) {
    assert.equal(actual.length, expected.length, `${message} (length)`);
    actual.forEach((value, index) => {
        assertClose(value, expected[index], `${message} [${index}]`, epsilon);
    });
}

function imageInverse(image) {
    image.setCoords();
    return fabric.util.invertTransform(image.calcTransformMatrix());
}

function sourcePointForWorldPoint(point, image) {
    return fabric.util.transformPoint(point, imageInverse(image));
}

function sourceCenter(object, image) {
    object.setCoords();
    return sourcePointForWorldPoint(object.getCenterPoint(), image);
}

function sourceMarker(object, image, marker = MARKER) {
    object.setCoords();
    const worldMarker = fabric.util.transformPoint(marker, object.calcTransformMatrix());
    return sourcePointForWorldPoint(worldMarker, image);
}

function relativeObjectMatrix(object, image) {
    object.setCoords();
    return fabric.util.multiplyTransformMatrices(imageInverse(image), object.calcTransformMatrix());
}

function sourceCorners(object, image) {
    object.setCoords();
    const inverse = imageInverse(image);
    return object.getCoords().map((point) => fabric.util.transformPoint(point, inverse));
}

function captureFullProjection(object, image) {
    return {
        center: sourceCenter(object, image),
        marker: sourceMarker(object, image),
        relativeMatrix: relativeObjectMatrix(object, image),
    };
}

function assertFullProjection(object, image, expected, message, epsilon = 1e-6) {
    assertPointClose(sourceCenter(object, image), expected.center, `${message} center`, epsilon);
    assertPointClose(sourceMarker(object, image), expected.marker, `${message} marker`, epsilon);
    assertMatrixClose(
        relativeObjectMatrix(object, image),
        expected.relativeMatrix,
        `${message} relative matrix`,
        epsilon,
    );
}

function captureProjections(objects, image) {
    return new Map(objects.map((object) => [object, captureFullProjection(object, image)]));
}

function assertProjections(objects, image, expected, message) {
    objects.forEach((object, index) => {
        assertFullProjection(object, image, expected.get(object), `${message} object ${index}`);
    });
}

async function runMixedTransformSequence(editor) {
    await editor.scaleImage(1.3);
    await editor.rotateImage(37);
    await editor.flipHorizontal();
    await editor.flipVertical();
    await editor.rotateImage(125);
    await editor.scaleImage(0.73);
    await editor.flipHorizontal();
    await editor.rotateImage(0);
}

function addDrawAnnotation(editor, id, options = {}) {
    const canvas = requireEditorCanvas(editor);
    const path = new fabric.Path('M 12 18 L 48 25 L 31 57', {
        fill: '',
        stroke: '#ff0000',
        strokeWidth: 5,
        selectable: true,
        evented: true,
        ...options,
    });
    const annotation = markAnnotationObject(path, {
        annotationId: id,
        annotationType: 'draw',
        annotationName: `draw${id}`,
        annotationHidden: options.annotationHidden,
        annotationLocked: options.annotationLocked,
        annotationSelectable: true,
        annotationEvented: true,
        annotationHasControls: true,
    });
    syncAnnotationRuntimeState(annotation);
    canvas.add(annotation);
    canvas.requestRenderAll();
    return annotation;
}

test('default options leave masks and annotations fixed for every image transform', async (t) => {
    const editor = createSourceEditor({ maskLabelOnSelect: false });
    t.after(() => disposeEditor(editor));

    await loadFixtureImage(editor, { width: 120, height: 80 });
    const mask = editor.createMask({ left: 14, top: 12, width: 23, height: 17 });
    const annotation = editor.createTextAnnotation({
        text: 'Default off',
        left: 52,
        top: 28,
        enterEditing: false,
    });
    const maskMatrix = mask.calcTransformMatrix().slice();
    const annotationMatrix = annotation.calcTransformMatrix().slice();

    for (const operation of [
        () => editor.scaleImage(1.4),
        () => editor.rotateImage(37),
        () => editor.flipHorizontal(),
        () => editor.flipVertical(),
        () => editor.resetImageTransform(),
    ]) {
        await operation();
        assert.equal(editor.getMasks()[0], mask, 'mask identity remains live');
        assert.equal(editor.getAnnotations()[0], annotation, 'annotation identity remains live');
        assertMatrixClose(mask.calcTransformMatrix(), maskMatrix, 'default-off mask matrix');
        assertMatrixClose(
            annotation.calcTransformMatrix(),
            annotationMatrix,
            'default-off annotation matrix',
        );
    }
});

test('all built-in mask shapes remain image-local through flips, mixed transforms, reset, undo, and redo', async (t) => {
    const editor = createSourceEditor({
        bindMasksToImageTransform: true,
        maskLabelOnSelect: false,
    });
    t.after(() => disposeEditor(editor));

    await loadFixtureImage(editor, { width: 140, height: 100 });
    const masks = [
        editor.createMask({ shape: 'rect', left: 10, top: 9, width: 28, height: 19, angle: 11 }),
        editor.createMask({ shape: 'circle', left: 44, top: 13, radius: 12, angle: -7 }),
        editor.createMask({ shape: 'ellipse', left: 72, top: 18, rx: 17, ry: 9, angle: 19 }),
        editor.createMask({
            shape: 'polygon',
            left: 24,
            top: 53,
            points: [
                [0, 0],
                [29, 4],
                [17, 26],
                [3, 18],
            ],
            angle: 8,
        }),
    ];
    const image = requireOriginalImage(editor);
    const expected = captureProjections(masks, image);
    const initialMatrices = masks.map((mask) => mask.calcTransformMatrix().slice());

    await editor.flipHorizontal();
    assertProjections(masks, image, expected, 'horizontal flip');
    await editor.flipHorizontal();
    masks.forEach((mask, index) => {
        assertMatrixClose(
            mask.calcTransformMatrix(),
            initialMatrices[index],
            'double horizontal flip',
        );
    });

    await editor.flipVertical();
    assertProjections(masks, image, expected, 'vertical flip');
    await editor.flipVertical();
    masks.forEach((mask, index) => {
        assertMatrixClose(
            mask.calcTransformMatrix(),
            initialMatrices[index],
            'double vertical flip',
        );
    });

    await runMixedTransformSequence(editor);
    assertProjections(masks, image, expected, 'mixed sequence');

    const history = getHistoryManager(editor);
    const historyLengthBeforeReset = history.history.length;
    await editor.resetImageTransform();
    assert.equal(
        history.history.length,
        historyLengthBeforeReset + 1,
        'reset adds one history entry',
    );
    assertProjections(masks, image, expected, 'reset');

    await editor.undo();
    const undoImage = requireOriginalImage(editor);
    const undoMasks = editor.getMasks().sort((a, b) => a.maskId - b.maskId);
    undoMasks.forEach((mask, index) => {
        assertFullProjection(
            mask,
            undoImage,
            [...expected.values()][index],
            `undo mask ${index}`,
            1e-4,
        );
    });

    await editor.redo();
    const redoImage = requireOriginalImage(editor);
    const redoMasks = editor.getMasks().sort((a, b) => a.maskId - b.maskId);
    redoMasks.forEach((mask, index) => {
        assertFullProjection(
            mask,
            redoImage,
            [...expected.values()][index],
            `redo mask ${index}`,
            1e-4,
        );
    });
});

test('mirrored text, shape, line, arrow, and draw annotations preserve full source projection', async (t) => {
    const editor = createSourceEditor({
        bindAnnotationsToImageTransform: true,
        textAnnotationFlipBehavior: 'mirror',
    });
    t.after(() => disposeEditor(editor));

    await loadFixtureImage(editor, { width: 150, height: 110 });
    const text = editor.createTextAnnotation({
        text: 'Mirror',
        left: 13,
        top: 12,
        angle: 9,
        enterEditing: false,
    });
    const rect = editor.createShapeAnnotation({
        shape: 'rect',
        left: 66,
        top: 15,
        width: 31,
        height: 22,
        angle: -13,
        annotationLocked: true,
    });
    const line = editor.createShapeAnnotation({
        shape: 'line',
        x1: 18,
        y1: 63,
        x2: 62,
        y2: 72,
        annotationHidden: true,
    });
    const arrow = editor.createShapeAnnotation({
        shape: 'arrow',
        x1: 76,
        y1: 58,
        x2: 126,
        y2: 89,
    });
    const draw = addDrawAnnotation(editor, 99, {
        annotationLocked: true,
        annotationHidden: true,
    });
    editor.saveState();

    const annotations = [text, rect, line, arrow, draw];
    const image = requireOriginalImage(editor);
    const expected = captureProjections(annotations, image);

    await editor.flipHorizontal();
    assertProjections(annotations, image, expected, 'mirrored annotations');
    annotations.forEach((annotation) => {
        assert.ok(
            determinant(annotation.calcTransformMatrix()) < 0,
            'a single image flip must remain a reflection on every mirrored annotation',
        );
    });
    assert.equal(rect.annotationLocked, true);
    assert.equal(line.annotationHidden, true);
    assert.equal(draw.annotationLocked, true);
    assert.equal(draw.annotationHidden, true);

    await editor.flipHorizontal();
    assertProjections(annotations, image, expected, 'mirrored annotation double flip');
    await runMixedTransformSequence(editor);
    assertProjections(annotations, image, expected, 'mirrored annotation mixed sequence');
});

test('readable text follows full image position without receiving reflection', async (t) => {
    const editor = createSourceEditor({ bindAnnotationsToImageTransform: true });
    t.after(() => disposeEditor(editor));

    await loadFixtureImage(editor, { width: 130, height: 90 });
    const text = editor.createTextAnnotation({
        text: 'Readable',
        left: 21,
        top: 17,
        angle: 12,
        enterEditing: false,
    });
    const shape = editor.createShapeAnnotation({
        shape: 'rect',
        left: 72,
        top: 31,
        width: 29,
        height: 21,
    });
    const image = requireOriginalImage(editor);
    const textSourceCenter = sourceCenter(text, image);
    const shapeProjection = captureFullProjection(shape, image);

    await editor.flipHorizontal();

    assertPointClose(sourceCenter(text, image), textSourceCenter, 'readable text source center');
    assert.ok(determinant(image.calcTransformMatrix()) < 0, 'image matrix contains reflection');
    assert.ok(determinant(shape.calcTransformMatrix()) < 0, 'shape receives full reflection');
    assert.ok(determinant(text.calcTransformMatrix()) > 0, 'text glyph transform is not mirrored');
    assert.equal(text.flipX, false);
    assert.equal(text.flipY, false);
    assertFullProjection(shape, image, shapeProjection, 'shape beside readable text');

    await editor.resetImageTransform();
    await editor.flipVertical();
    assertPointClose(
        sourceCenter(text, requireOriginalImage(editor)),
        textSourceCenter,
        'vertical readable text source center',
    );
    assert.ok(
        determinant(text.calcTransformMatrix()) > 0,
        'vertical flip also avoids text reflection',
    );
});

test('binding discards ActiveSelection while transforming its underlying objects', async (t) => {
    const editor = createSourceEditor({
        bindMasksToImageTransform: true,
        bindAnnotationsToImageTransform: true,
        groupSelection: true,
        maskLabelOnSelect: false,
    });
    t.after(() => disposeEditor(editor));

    await loadFixtureImage(editor, { width: 120, height: 80 });
    const mask = editor.createMask({ left: 12, top: 14, width: 24, height: 18 });
    const annotation = editor.createShapeAnnotation({
        shape: 'rect',
        left: 61,
        top: 24,
        width: 26,
        height: 19,
    });
    const image = requireOriginalImage(editor);
    const maskProjection = captureFullProjection(mask, image);
    const annotationProjection = captureFullProjection(annotation, image);
    const canvas = requireEditorCanvas(editor);
    const selection = new fabric.ActiveSelection([mask, annotation], { canvas });
    canvas.setActiveObject(selection);

    await editor.flipHorizontal();

    assert.equal(
        canvas.getActiveObject(),
        undefined,
        'ActiveSelection is discarded and not restored',
    );
    assertFullProjection(mask, image, maskProjection, 'selected mask');
    assertFullProjection(annotation, image, annotationProjection, 'selected annotation');
});

test('mask labels are session objects synchronized after bound mask geometry changes', async (t) => {
    const editor = createSourceEditor({ bindMasksToImageTransform: true });
    t.after(() => disposeEditor(editor));

    await loadFixtureImage(editor, { width: 120, height: 80 });
    const mask = editor.createMask({ left: 17, top: 13, width: 31, height: 21, angle: 14 });
    assert.ok(mask.labelObject, 'selected mask starts with a label');

    await editor.flipHorizontal();

    const label = mask.labelObject;
    assert.ok(label, 'label is restored after the transform snapshot');
    assert.equal(label.editorObjectKind, 'session');
    assert.equal(label.sessionObjectType, 'maskLabel');
    assert.ok(determinant(mask.calcTransformMatrix()) < 0, 'mask receives reflection');
    assert.ok(determinant(label.calcTransformMatrix()) > 0, 'label is not transformed as a mask');
    assert.equal(label.flipX, false);
    assert.equal(label.flipY, false);
    assert.equal(label.angle, mask.angle);

    const topLeft = mask.getCoords()[0];
    const center = mask.getCenterPoint();
    const vx = center.x - topLeft.x;
    const vy = center.y - topLeft.y;
    const distance = Math.sqrt(vx * vx + vy * vy) || 1;
    assert.equal(label.left, Math.round(topLeft.x + (vx / distance) * 3));
    assert.equal(label.top, Math.round(topLeft.y + (vy / distance) * 3));
});

test('overlay export/import preserves bound source projection without schema changes', async (t) => {
    const source = makeImageDataUrl({ width: 140, height: 100 });
    const options = {
        bindMasksToImageTransform: true,
        bindAnnotationsToImageTransform: true,
        textAnnotationFlipBehavior: 'mirror',
        maskLabelOnSelect: false,
    };
    const editorA = createSourceEditor(options);
    const editorB = createSourceEditor(options);
    t.after(() => {
        disposeEditor(editorA);
        disposeEditor(editorB);
    });

    await editorA.loadImage(source);
    const maskA = editorA.createMask({
        left: 18,
        top: 16,
        width: 27,
        height: 19,
        angle: 7,
        styles: { strokeWidth: 0 },
    });
    const annotationA = editorA.createShapeAnnotation({
        shape: 'rect',
        left: 72,
        top: 37,
        width: 33,
        height: 24,
        angle: -11,
    });
    await editorA.scaleImage(1.25);
    await editorA.rotateImage(37);
    await editorA.flipHorizontal();

    const imageA = requireOriginalImage(editorA);
    const maskCornersA = sourceCorners(maskA, imageA);
    const annotationCornersA = sourceCorners(annotationA, imageA);
    const state = editorA.exportOverlayState();

    assert.equal(state.coordinateSpace, 'image-normalized');
    await editorB.loadImage(source);
    await editorB.importOverlayState(state);

    const imageB = requireOriginalImage(editorB);
    const [maskB] = editorB.getMasks();
    const [annotationB] = editorB.getAnnotations();
    sourceCorners(maskB, imageB).forEach((point, index) => {
        assertPointClose(point, maskCornersA[index], `round-trip mask corner ${index}`);
    });
    sourceCorners(annotationB, imageB).forEach((point, index) => {
        assertPointClose(point, annotationCornersA[index], `round-trip annotation corner ${index}`);
    });
});

test('preserved crop masks remain bindable for later scale, rotate, and flip operations', async (t) => {
    const editor = createSourceEditor({
        bindMasksToImageTransform: true,
        maskLabelOnSelect: false,
        crop: {
            preserveMasksAfterCrop: true,
            hideMasksDuringCrop: false,
        },
    });
    t.after(() => disposeEditor(editor));

    await loadFixtureImage(editor, { width: 120, height: 90 });
    editor.createMask({ left: 31, top: 24, width: 24, height: 18, angle: 9 });
    editor.enterCropMode({ aspectRatio: '1:1' });
    await editor.applyCrop();

    const [mask] = editor.getMasks();
    assert.ok(mask, 'intersecting mask survives crop');
    const image = requireOriginalImage(editor);
    const expected = captureFullProjection(mask, image);

    await editor.scaleImage(1.2);
    await editor.rotateImage(37);
    await editor.flipVertical();

    assertFullProjection(mask, image, expected, 'post-crop bound mask');
});
