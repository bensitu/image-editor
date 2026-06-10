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
    return editor.canvas.getObjects().filter((object) => object.isMosaicPreview === true);
}

function getImageCenter(editor) {
    const image = editor.originalImage;
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

    assert.equal(editor.canvas, null);
    assert.equal(editor.isMosaicMode(), false);
});

test('Mosaic click commits pixels into the base image and supports undo/redo', async () => {
    const operations = [];
    const { editor } = await createEditor({
        defaultMosaicConfig: { brushSize: 12, blockSize: 4 },
        onImageChanged: (_state, context) => operations.push(context.operation),
    });
    try {
        await editor.loadImage(makeGradientDataUrl());
        const beforeSource = editor.originalImage.getSrc();

        editor.enterMosaicMode();
        editor.canvas.fire('mouse:down', { scenePoint: getImageCenter(editor) });
        await waitForCanvasCallbacks(250);

        const afterSource = editor.originalImage.getSrc();
        assert.notEqual(afterSource, beforeSource);
        assert.equal(editor.historyManager.canUndo(), true);
        assert.ok(operations.includes('applyMosaic'));

        editor.exitMosaicMode();
        await editor.undo();
        assert.equal(editor.originalImage.getSrc(), beforeSource);
        assert.equal(getPreviewObjects(editor).length, 0);

        await editor.redo();
        assert.equal(editor.originalImage.getSrc(), afterSource);
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
        const beforeSource = editor.originalImage.getSrc();

        editor.enterMosaicMode();
        editor.canvas.fire('mouse:down', { scenePoint: { x: -100, y: -100 } });
        await waitForCanvasCallbacks(100);

        assert.equal(editor.originalImage.getSrc(), beforeSource);
        assert.equal(editor.historyManager.canUndo(), false);
    } finally {
        disposeEditor(editor);
    }
});
