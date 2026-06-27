/**
 * Type:
 *   Integration test
 *
 * Purpose:
 *   Verifies Mosaic mode lifecycle, preview objects, pixel commits, and history
 *   integration through the ImageEditor facade.
 *
 * Scope:
 *   - Entering Mosaic mode without an image is a no-op.
 *   - Preview objects are created, updated, and removed idempotently.
 *   - Click and drag gestures commit mosaic pixels with undo/redo support.
 *   - Exiting Mosaic mode releases the raster cache.
 *
 * Out of scope:
 *   - standalone pixelation algorithm details
 *   - configuration normalization
 *   - browser UI control binding
 *
 * Environment:
 *   - Node.js ESM
 *   - Fabric/canvas test environment
 *
 * Run:
 *   node --test tests/mosaic-mode.test.mjs
 */

import { register } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';

register('./helpers/ts-resolve-hook.mjs', import.meta.url);

import {
    disposeEditor,
    fabric,
    loadFixtureImage,
    resetEditorDom,
    waitForCanvasCallbacks,
} from './helpers/fabric-environment.mjs';
import {
    getHistoryManager,
    getMosaicSession,
    requireEditorCanvas,
    requireOriginalImage,
} from './helpers/editor-internals.mjs';

const { ImageEditor } = await import('../src/image-editor.ts');

function createEditor(options = {}) {
    const ids = resetEditorDom();
    const editor = new ImageEditor({
        canvasWidth: 320,
        canvasHeight: 240,
        animationDuration: 0,
        showPlaceholder: false,
        ...options,
    });
    editor.init(ids);
    return { editor, ids };
}

function makeGradientDataUrl({ width = 24, height = 24 } = {}) {
    const canvas = fabric.document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            ctx.fillStyle = `rgba(${(x * 11) % 255}, ${(y * 13) % 255}, ${((x + y) * 7) % 255}, 1)`;
            ctx.fillRect(x, y, 1, 1);
        }
    }
    return canvas.toDataURL('image/png');
}

function getPreviewObjects(editor) {
    return requireEditorCanvas(editor)
        .getObjects()
        .filter((object) => object.isMosaicPreview === true);
}

function isImageObject(object) {
    const type = typeof object.type === 'string' ? object.type.toLowerCase() : '';
    if (type === 'image') return true;
    return typeof object.isType === 'function' && object.isType('image');
}

function getPreviewImageObjects(editor) {
    return getPreviewObjects(editor).filter(isImageObject);
}

function getImageCenter(editor) {
    const image = requireOriginalImage(editor);
    if (typeof image.getCenterPoint === 'function') return image.getCenterPoint();
    return {
        x: image.left + (image.width * image.scaleX) / 2,
        y: image.top + (image.height * image.scaleY) / 2,
    };
}

test('enterMosaicMode no-ops without an image', async () => {
    const { editor } = await createEditor();
    try {
        editor.enterMosaicMode();
        assert.equal(editor.isMosaicMode(), false);
    } finally {
        disposeEditor(editor);
    }
});

test('Mosaic mode creates and removes the preview object idempotently', async () => {
    const { editor } = await createEditor({
        defaultMosaicConfig: { brushSize: 32, blockSize: 4 },
    });
    try {
        await loadFixtureImage(editor);
        editor.createMask({ shape: 'rect', width: 20, height: 20 });
        const mask = editor.getMasks()[0];
        assert.equal(mask.selectable, true);

        editor.enterMosaicMode();
        editor.enterMosaicMode();

        assert.equal(editor.isMosaicMode(), true);
        assert.equal(getPreviewObjects(editor).length, 1);
        assert.equal(getPreviewObjects(editor)[0].radius, 16);
        assert.equal(mask.selectable, false);
        assert.equal(mask.evented, false);

        editor.exitMosaicMode();
        editor.exitMosaicMode();

        assert.equal(editor.isMosaicMode(), false);
        assert.equal(getPreviewObjects(editor).length, 0);
        assert.equal(mask.selectable, true);
        assert.equal(mask.evented, true);
    } finally {
        disposeEditor(editor);
    }
});

test('dispose cleans an active Mosaic preview object', async () => {
    const { editor } = await createEditor();
    await loadFixtureImage(editor);
    editor.enterMosaicMode();

    assert.equal(getPreviewObjects(editor).length, 1);
    disposeEditor(editor);

    assert.deepEqual(editor.getEditorState(), {
        hasImage: false,
        image: null,
        maskCount: 0,
        annotationCount: 0,
        currentScale: 1,
        currentRotation: 0,
        isFlippedHorizontally: false,
        isFlippedVertically: false,
        isBusy: false,
        activeToolMode: null,
        isCropMode: false,
        isMosaicMode: false,
        isTextMode: false,
        isDrawMode: false,
        canUndo: false,
        canRedo: false,
        canvasWidth: 0,
        canvasHeight: 0,
    });
});

test('Mosaic click commits pixels into the base image and supports undo/redo', async () => {
    const operations = [];
    const { editor } = await createEditor({
        defaultMosaicConfig: { brushSize: 12, blockSize: 4 },
        onImageChanged: (_state, context) => operations.push(context.operation),
    });
    try {
        await editor.loadImage(makeGradientDataUrl());
        const canvas = requireEditorCanvas(editor);
        const beforeSource = requireOriginalImage(editor).getSrc();

        editor.enterMosaicMode();
        canvas.fire('mouse:down', { scenePoint: getImageCenter(editor) });
        canvas.fire('mouse:up', { scenePoint: getImageCenter(editor) });
        await waitForCanvasCallbacks(250);

        const afterSource = requireOriginalImage(editor).getSrc();
        assert.notEqual(afterSource, beforeSource);
        assert.equal(getHistoryManager(editor).canUndo(), true);
        assert.ok(operations.includes('applyMosaic'));

        editor.exitMosaicMode();
        await editor.undo();
        assert.equal(requireOriginalImage(editor).getSrc(), beforeSource);
        assert.equal(getPreviewObjects(editor).length, 0);

        await editor.redo();
        assert.equal(requireOriginalImage(editor).getSrc(), afterSource);
        assert.equal(getPreviewObjects(editor).length, 0);
    } finally {
        disposeEditor(editor);
    }
});

test('Mosaic click outside the image is a no-op with no history entry', async () => {
    const { editor } = await createEditor({
        defaultMosaicConfig: { brushSize: 12, blockSize: 4 },
    });
    try {
        await editor.loadImage(makeGradientDataUrl());
        const canvas = requireEditorCanvas(editor);
        const beforeSource = requireOriginalImage(editor).getSrc();

        editor.enterMosaicMode();
        canvas.fire('mouse:down', { scenePoint: { x: -100, y: -100 } });
        canvas.fire('mouse:up', { scenePoint: { x: -100, y: -100 } });
        await waitForCanvasCallbacks(100);

        assert.equal(requireOriginalImage(editor).getSrc(), beforeSource);
        assert.equal(getHistoryManager(editor).canUndo(), false);
    } finally {
        disposeEditor(editor);
    }
});

test('Mosaic drag shows live preview before mouseup commits the stroke', async () => {
    const operations = [];
    const { editor } = await createEditor({
        defaultMosaicConfig: { brushSize: 14, blockSize: 4 },
        onImageChanged: (_state, context) => operations.push(context.operation),
    });
    try {
        await editor.loadImage(makeGradientDataUrl({ width: 48, height: 48 }));
        const canvas = requireEditorCanvas(editor);
        const beforeSource = requireOriginalImage(editor).getSrc();
        const center = getImageCenter(editor);

        editor.enterMosaicMode();
        canvas.fire('mouse:down', { scenePoint: center });
        await waitForCanvasCallbacks(250);

        assert.equal(requireOriginalImage(editor).getSrc(), beforeSource);
        assert.equal(getHistoryManager(editor).canUndo(), false);
        assert.equal(getPreviewImageObjects(editor).length, 1);
        assert.equal(
            operations.filter((operation) => operation === 'applyMosaic').length,
            0,
            'live preview must not emit a committed image change',
        );

        canvas.fire('mouse:move', {
            scenePoint: { x: center.x + 24, y: center.y + 4 },
        });
        await waitForCanvasCallbacks(120);
        assert.equal(getPreviewImageObjects(editor).length, 1);

        canvas.fire('mouse:up', {
            scenePoint: { x: center.x + 24, y: center.y + 4 },
        });
        await waitForCanvasCallbacks(350);

        assert.notEqual(requireOriginalImage(editor).getSrc(), beforeSource);
        assert.equal(getPreviewImageObjects(editor).length, 0);
        assert.equal(getHistoryManager(editor).canUndo(), true);
        assert.equal(
            operations.filter((operation) => operation === 'applyMosaic').length,
            1,
            'mouseup should commit the live preview as one image change',
        );
    } finally {
        disposeEditor(editor);
    }
});

test('exitMosaicMode releases the raster cache', async () => {
    const { editor } = await createEditor({
        defaultMosaicConfig: { brushSize: 14, blockSize: 4 },
    });
    try {
        await editor.loadImage(makeGradientDataUrl({ width: 48, height: 48 }));
        const canvas = requireEditorCanvas(editor);
        const center = getImageCenter(editor);

        editor.enterMosaicMode();
        canvas.fire('mouse:down', { scenePoint: center });
        await waitForCanvasCallbacks(250);

        const session = getMosaicSession(editor);
        assert.ok(session?.rasterCache, 'mosaic stroke should create a raster cache');
        const offscreenCanvas = session.rasterCache.offscreenCanvas;
        assert.ok(offscreenCanvas.width > 0);
        assert.ok(offscreenCanvas.height > 0);

        editor.exitMosaicMode();

        assert.equal(editor.isMosaicMode(), false);
        assert.equal(session.rasterCache, null);
        assert.equal(offscreenCanvas.width, 0);
        assert.equal(offscreenCanvas.height, 0);
    } finally {
        disposeEditor(editor);
    }
});

test('Mosaic drag commits one undoable stroke after mouseup', async () => {
    const operations = [];
    const { editor } = await createEditor({
        defaultMosaicConfig: { brushSize: 14, blockSize: 4 },
        onImageChanged: (_state, context) => operations.push(context.operation),
    });
    try {
        await editor.loadImage(makeGradientDataUrl({ width: 48, height: 48 }));
        const canvas = requireEditorCanvas(editor);
        const beforeSource = requireOriginalImage(editor).getSrc();
        const center = getImageCenter(editor);

        editor.enterMosaicMode();
        canvas.fire('mouse:down', { scenePoint: center });
        canvas.fire('mouse:move', {
            scenePoint: { x: center.x + 20, y: center.y },
        });
        canvas.fire('mouse:move', {
            scenePoint: { x: center.x + 40, y: center.y + 8 },
        });
        canvas.fire('mouse:up', {
            scenePoint: { x: center.x + 60, y: center.y + 8 },
        });
        await waitForCanvasCallbacks(350);

        const afterSource = requireOriginalImage(editor).getSrc();
        assert.notEqual(afterSource, beforeSource);
        assert.equal(
            operations.filter((operation) => operation === 'applyMosaic').length,
            1,
            'a drag stroke should commit once',
        );
        assert.equal(getHistoryManager(editor).canUndo(), true);

        editor.exitMosaicMode();
        await editor.undo();
        assert.equal(requireOriginalImage(editor).getSrc(), beforeSource);
        assert.equal(getHistoryManager(editor).canUndo(), false);
    } finally {
        disposeEditor(editor);
    }
});
