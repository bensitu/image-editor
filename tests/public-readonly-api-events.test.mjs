/**
 * Type:
 *   Integration-style unit test
 *
 * Purpose:
 *   Verifies the v2.6.0 public read-only API and lifecycle callbacks at the
 *   ImageEditor facade layer.
 *
 * Scope:
 *   - public state, image info, mask, selection, and active-tool accessors
 *   - tool-mode lifecycle callbacks
 *   - undo/redo availability callbacks
 *   - callback exception isolation for the new callbacks
 *
 * Environment:
 *   - Node.js ESM
 *   - jsdom + node-canvas Fabric environment from tests/helpers
 *
 * Run:
 *   node --import ./tests/helpers/register-ts-loader.mjs --test tests/public-readonly-api-events.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    disposeEditor,
    fabric,
    installFabricDom,
    loadFixtureImage,
    resetEditorDom,
} from './helpers/fabric-environment.mjs';

const { default: ImageEditor } = await import('../src/index.ts');

function createSourceEditor(options = {}) {
    installFabricDom();
    const ids = resetEditorDom();
    const editor = new ImageEditor(fabric, {
        canvasWidth: 320,
        canvasHeight: 240,
        animationDuration: 0,
        showPlaceholder: false,
        ...options,
    });
    editor.init(ids);
    return { editor, ids };
}

async function captureConsoleError(fn) {
    const original = console.error;
    const calls = [];
    console.error = (...args) => {
        calls.push(args);
    };
    try {
        await fn(calls);
    } finally {
        console.error = original;
    }
    return calls;
}

test('public read-only accessors return safe snapshots and current collections', async (t) => {
    const selections = [];
    const { editor } = createSourceEditor({
        onSelectionChange: (selection) => selections.push(selection),
    });
    t.after(() => disposeEditor(editor));

    assert.equal(editor.getImageInfo(), null);
    assert.equal(editor.getActiveToolMode(), null);
    assert.deepEqual(editor.getMasks(), []);
    assert.deepEqual(editor.getSelection(), {
        selectedMask: null,
        selectedMasks: [],
        selectedAnnotation: null,
        selectedAnnotations: [],
        selectedObjectKind: null,
    });

    const initialState = editor.getEditorState();
    assert.equal(initialState.hasImage, false);
    assert.equal(initialState.image, null);
    assert.equal(initialState.maskCount, 0);
    assert.equal(initialState.canUndo, false);
    assert.equal(initialState.canRedo, false);

    await loadFixtureImage(editor, { width: 48, height: 32 });

    const imageInfo = editor.getImageInfo();
    assert.ok(imageInfo);
    assert.equal(imageInfo.width, 48);
    assert.equal(imageInfo.height, 32);
    assert.equal(typeof imageInfo.displayWidth, 'number');

    const loadedState = editor.getEditorState();
    assert.equal(loadedState.hasImage, true);
    assert.equal(loadedState.image?.width, 48);
    assert.equal(loadedState.image?.height, 32);
    assert.notEqual(loadedState, editor.getEditorState());
    loadedState.image.width = 1;
    assert.equal(editor.getEditorState().image?.width, 48);

    const mask = editor.createMask({ width: 20, height: 20 });
    assert.ok(mask);

    const masks = editor.getMasks();
    assert.equal(masks.length, 1);
    assert.equal(masks[0], mask);
    masks.pop();
    assert.equal(editor.getMasks().length, 1, 'getMasks must not expose the internal array');

    const selection = editor.getSelection();
    assert.equal(selection.selectedMask, mask);
    assert.deepEqual(selection.selectedMasks, [mask]);
    assert.equal(selection.selectedAnnotation, null);
    assert.deepEqual(selection.selectedAnnotations, []);
    assert.equal(selection.selectedObjectKind, 'mask');

    const lastSelection = selections.at(-1);
    assert.ok(lastSelection, 'createMask should select the created mask');
    assert.deepEqual(Object.keys(selection).sort(), Object.keys(lastSelection).sort());
    assert.deepEqual(
        selection.selectedMasks.map((selectedMask) => selectedMask.maskId),
        lastSelection.selectedMasks.map((selectedMask) => selectedMask.maskId),
    );
});

test('getActiveToolMode reflects crop, mosaic, text, draw, and null states', async (t) => {
    const { editor } = createSourceEditor();
    t.after(() => disposeEditor(editor));

    await loadFixtureImage(editor);

    assert.equal(editor.getActiveToolMode(), null);
    editor.enterCropMode();
    assert.equal(editor.getActiveToolMode(), 'crop');
    editor.cancelCrop();
    assert.equal(editor.getActiveToolMode(), null);

    editor.enterMosaicMode();
    assert.equal(editor.getActiveToolMode(), 'mosaic');
    editor.exitMosaicMode();
    assert.equal(editor.getActiveToolMode(), null);

    editor.enterTextMode();
    assert.equal(editor.getActiveToolMode(), 'text');
    editor.exitTextMode();
    assert.equal(editor.getActiveToolMode(), null);

    editor.enterDrawMode();
    assert.equal(editor.getActiveToolMode(), 'draw');
    editor.exitDrawMode();
    assert.equal(editor.getActiveToolMode(), null);
});

test('onToolModeChange fires only for real active-tool transitions', async (t) => {
    const events = [];
    const { editor } = createSourceEditor({
        onToolModeChange: (active, previous, context) => {
            events.push([previous, active, context.operation]);
        },
    });
    t.after(() => disposeEditor(editor));

    await loadFixtureImage(editor);
    assert.deepEqual(events, []);

    editor.enterCropMode();
    editor.enterCropMode();
    editor.cancelCrop();
    editor.cancelCrop();

    editor.enterMosaicMode();
    editor.enterMosaicMode();
    editor.exitMosaicMode();
    editor.exitMosaicMode();

    editor.enterTextMode();
    editor.enterTextMode();
    editor.exitTextMode();
    editor.exitTextMode();

    editor.enterDrawMode();
    editor.enterDrawMode();
    editor.exitDrawMode();
    editor.exitDrawMode();

    assert.deepEqual(events, [
        [null, 'crop', 'enterCropMode'],
        ['crop', null, 'cancelCrop'],
        [null, 'mosaic', 'enterMosaicMode'],
        ['mosaic', null, 'exitMosaicMode'],
        [null, 'text', 'enterTextMode'],
        ['text', null, 'exitTextMode'],
        [null, 'draw', 'enterDrawMode'],
        ['draw', null, 'exitDrawMode'],
    ]);
});

test('onHistoryChange fires only when undo/redo availability changes', async (t) => {
    const events = [];
    const { editor } = createSourceEditor({
        onHistoryChange: (history, context) => {
            events.push([context.operation, history.canUndo, history.canRedo]);
        },
    });
    t.after(() => disposeEditor(editor));

    await loadFixtureImage(editor);
    assert.deepEqual(
        events,
        [],
        'loadImage should not emit when history availability is unchanged',
    );

    editor.createMask({ width: 20, height: 20 });
    assert.deepEqual(events, [['createMask', true, false]]);

    editor.createMask({ width: 20, height: 20 });
    assert.deepEqual(
        events,
        [['createMask', true, false]],
        'a second push with the same availability must not emit',
    );

    await editor.undo();
    await editor.redo();
    await editor.undo();
    editor.createMask({ width: 20, height: 20 });

    assert.deepEqual(events, [
        ['createMask', true, false],
        ['undo', true, true],
        ['redo', true, false],
        ['undo', true, true],
        ['createMask', true, false],
    ]);
});

test('new lifecycle callback exceptions are logged and do not break editor operations', async (t) => {
    const toolError = new Error('tool callback failed');
    const historyError = new Error('history callback failed');
    const { editor } = createSourceEditor({
        onToolModeChange: () => {
            throw toolError;
        },
        onHistoryChange: () => {
            throw historyError;
        },
    });
    t.after(() => disposeEditor(editor));

    await loadFixtureImage(editor);

    const errors = await captureConsoleError(async () => {
        editor.enterCropMode();
        assert.equal(editor.getActiveToolMode(), 'crop');
        editor.cancelCrop();
        assert.equal(editor.getActiveToolMode(), null);
        const mask = editor.createMask({ width: 20, height: 20 });
        assert.ok(mask);
    });

    assert.ok(
        errors.some(
            (entry) => String(entry[0]).includes('onToolModeChange') && entry[1] === toolError,
        ),
        'onToolModeChange callback exceptions must be logged',
    );
    assert.ok(
        errors.some(
            (entry) => String(entry[0]).includes('onHistoryChange') && entry[1] === historyError,
        ),
        'onHistoryChange callback exceptions must be logged',
    );
});
