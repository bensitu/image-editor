/**
 * @file lifecycle-callbacks.test.mjs
 *
 * Type:
 *   Integration-style unit test
 *
 * Purpose:
 *   Verifies ImageEditor lifecycle/state callbacks at the public facade layer,
 *   where callback context, state snapshots, transactional load success, and
 *   callback exception isolation are coordinated.
 *
 * Scope:
 *   - load start/loaded ordering and callback payloads
 *   - image cleared/replaced behavior and failed-load rollback behavior
 *   - image changed, busy, disposed, masks changed, and selection changed callbacks
 *   - callback exceptions do not reject successful editor operations
 *
 * Out of scope:
 *   - pixel-perfect rendering
 *   - exhaustive Fabric event integration
 *   - unrelated export/crop internals
 *
 * Environment:
 *   - Node.js ESM
 *   - jsdom + node-canvas Fabric environment from tests/helpers
 *
 * Run:
 *   node --import ./tests/helpers/register-ts-loader.mjs --test tests/lifecycle-callbacks.test.mjs
 *
 * Notes:
 *   - Prefer behavior-level assertions over implementation-detail checks.
 *   - Keep this file focused on public callback behavior only.
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

const { default: ImageEditor } = await import('../src/index.ts');

function createSourceEditor(options = {}, domOptions = {}) {
    installFabricDom();
    const ids = resetEditorDom(domOptions);
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

test('loadImage emits onImageLoadStart before onImageLoaded with image info and context', async (t) => {
    const events = [];
    const { editor } = createSourceEditor({
        onImageLoadStart: (context) => events.push(['start', context.operation]),
        onImageLoaded: (info, context) => {
            events.push(['loaded', context.operation, info.width, info.height, info.canvasWidth]);
        },
    });
    t.after(() => disposeEditor(editor));

    await editor.loadImage(makeImageDataUrl({ width: 32, height: 24 }));

    assert.deepEqual(
        events.map((event) => event[0]),
        ['start', 'loaded'],
    );
    assert.equal(events[0][1], 'loadImage');
    assert.equal(events[1][1], 'loadImage');
    assert.equal(events[1][2], 32);
    assert.equal(events[1][3], 24);
    assert.equal(typeof events[1][4], 'number');
});

test('zero-argument onImageLoaded handlers still work at runtime', async (t) => {
    let calls = 0;
    const { editor } = createSourceEditor({
        onImageLoaded: () => {
            calls += 1;
        },
    });
    t.after(() => disposeEditor(editor));

    await loadFixtureImage(editor);

    assert.equal(calls, 1);
});

test('onImageCleared fires on successful replacement but not on failed rollback', async (t) => {
    const cleared = [];
    const { editor } = createSourceEditor({
        onImageCleared: (previousImage, context) => {
            cleared.push({ previousImage, operation: context.operation });
        },
    });
    t.after(() => disposeEditor(editor));

    await editor.loadImage(makeImageDataUrl({ fill: '#ff0000' }));
    await assert.rejects(() => editor.loadImage('data:image/png;base64,not-image-data'));
    assert.equal(cleared.length, 0, 'failed load must not clear the committed image');

    await editor.loadImage(makeImageDataUrl({ fill: '#00ff00' }));
    assert.equal(cleared.length, 1);
    assert.equal(cleared[0].operation, 'loadImage');
    assert.ok(cleared[0].previousImage);
});

test('onImageChanged reports load, mask, undo, redo, and loadFromState state transitions', async (t) => {
    const operations = [];
    const { editor } = createSourceEditor({
        onImageChanged: (state, context) => {
            operations.push({ operation: context.operation, maskCount: state.maskCount });
        },
    });
    t.after(() => disposeEditor(editor));

    await loadFixtureImage(editor);
    const snapshot = editor._captureSnapshot();
    editor.createMask({ width: 20, height: 20 });
    await editor.undo();
    await editor.redo();
    await editor.loadFromState(snapshot);

    assert.ok(operations.some((event) => event.operation === 'loadImage'));
    assert.ok(operations.some((event) => event.operation === 'createMask'));
    assert.ok(operations.some((event) => event.operation === 'undo'));
    assert.ok(operations.some((event) => event.operation === 'redo'));
    assert.ok(operations.some((event) => event.operation === 'loadFromState'));
});

test('onBusyChange emits only boolean transitions', async (t) => {
    const busyStates = [];
    const { editor } = createSourceEditor({
        onBusyChange: (isBusy) => busyStates.push(isBusy),
    });
    t.after(() => disposeEditor(editor));

    await loadFixtureImage(editor);

    assert.deepEqual(busyStates, [true, false]);
    for (let index = 1; index < busyStates.length; index += 1) {
        assert.notEqual(busyStates[index], busyStates[index - 1]);
    }
});

test('dispose emits image cleared before disposed and remains idempotent', async () => {
    const events = [];
    const { editor } = createSourceEditor({
        onImageCleared: (_previousImage, context) => events.push(`cleared:${context.operation}`),
        onEditorDisposed: (context) => events.push(`disposed:${context.operation}`),
    });

    await loadFixtureImage(editor);
    editor.dispose();
    editor.dispose();

    assert.deepEqual(events, ['cleared:dispose', 'disposed:dispose']);
});

test('onMasksChanged and onSelectionChange reflect public mask collection and selection', async (t) => {
    const maskCounts = [];
    const selections = [];
    const { editor } = createSourceEditor({
        onMasksChanged: (masks, context) => maskCounts.push([context.operation, masks.length]),
        onSelectionChange: (selection) => {
            selections.push(selection.selectedMasks.map((mask) => mask.maskId));
        },
    });
    t.after(() => disposeEditor(editor));

    await loadFixtureImage(editor);
    const mask = editor.createMask({ width: 20, height: 20 });
    assert.ok(mask);
    editor.enterCropMode();
    editor.cancelCrop();
    editor.removeAllMasks();

    assert.deepEqual(maskCounts, [
        ['createMask', 1],
        ['removeAllMasks', 0],
    ]);
    assert.ok(selections.some((ids) => ids.length === 1 && ids[0] === mask.maskId));
    assert.ok(selections.every((ids) => ids.every((id) => typeof id === 'number')));
});

test('throwing lifecycle callbacks are logged and do not reject successful operations', async (t) => {
    const callbackError = new Error('callback exploded');
    const { editor } = createSourceEditor({
        onImageLoaded: () => {
            throw callbackError;
        },
    });
    t.after(() => disposeEditor(editor));

    const errors = await captureConsoleError(async () => {
        await loadFixtureImage(editor);
    });

    assert.equal(editor.isImageLoaded(), true);
    assert.equal(errors.length, 1);
    assert.match(String(errors[0][0]), /onImageLoaded/);
    assert.equal(errors[0][1], callbackError);
});
