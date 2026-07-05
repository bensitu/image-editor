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
import {
    getHistoryManager,
    getLastSnapshot,
    requireOriginalImage,
} from './helpers/editor-internals.mjs';

const { ImageEditor } = await import('../src/index.ts');

function createSourceEditor(options = {}) {
    const ids = resetEditorDom();
    const editor = new ImageEditor(fabric, {
        canvasWidth: 160,
        canvasHeight: 120,
        animationDuration: 0,
        showPlaceholder: false,
        ...options,
    });
    editor.init(ids);
    return editor;
}

test('image filter preview normalizes config without pushing history', async () => {
    const editor = createSourceEditor();
    try {
        await loadFixtureImage(editor, { width: 32, height: 24 });

        editor.setImageFilterConfig({ brightness: 2, contrast: -2, grayscale: true });

        assert.deepEqual(editor.getImageFilterConfig(), {
            brightness: 1,
            contrast: -1,
            saturation: 0,
            blur: 0,
            sharpen: 0,
            grayscale: true,
            sepia: false,
            vintage: false,
        });
        assert.equal(getHistoryManager(editor).canUndo(), false);
        assert.ok(requireOriginalImage(editor).filters.length >= 3);
    } finally {
        disposeEditor(editor);
    }
});

test('committed image filters restore through undo and redo', async () => {
    const editor = createSourceEditor();
    try {
        await loadFixtureImage(editor, { width: 32, height: 24 });

        editor.setImageFilterConfig({ brightness: 0.4, contrast: 0.2, sepia: true });
        editor.commitImageFilters();

        assert.equal(getHistoryManager(editor).canUndo(), true);
        assert.equal(editor.getImageFilterConfig().brightness, 0.4);
        assert.equal(requireOriginalImage(editor).filters.length, 3);

        await editor.undo();
        assert.equal(editor.getImageFilterConfig().brightness, 0);
        assert.equal(requireOriginalImage(editor).filters.length, 0);

        await editor.redo();
        assert.equal(editor.getImageFilterConfig().brightness, 0.4);
        assert.equal(requireOriginalImage(editor).filters.length, 3);
    } finally {
        disposeEditor(editor);
    }
});

test('image filter config survives loadFromState and resets on loadImage', async () => {
    const editor = createSourceEditor();
    const restored = createSourceEditor();
    try {
        await loadFixtureImage(editor, { width: 32, height: 24 });
        editor.setImageFilterConfig({ saturation: 0.5, vintage: true, sharpen: 0.3 });
        editor.commitImageFilters();
        const snapshot = getLastSnapshot(editor);

        await restored.loadFromState(snapshot);
        assert.equal(restored.getImageFilterConfig().saturation, 0.5);
        assert.equal(restored.getImageFilterConfig().vintage, true);
        assert.equal(restored.getImageFilterConfig().sharpen, 0.3);
        assert.ok(requireOriginalImage(restored).filters.length >= 3);

        await loadFixtureImage(restored, { width: 20, height: 20 });
        assert.deepEqual(restored.getImageFilterConfig(), {
            brightness: 0,
            contrast: 0,
            saturation: 0,
            blur: 0,
            sharpen: 0,
            grayscale: false,
            sepia: false,
            vintage: false,
        });
        assert.equal(requireOriginalImage(restored).filters.length, 0);
    } finally {
        disposeEditor(editor);
        disposeEditor(restored);
    }
});
