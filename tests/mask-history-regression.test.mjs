/**
 * @file mask-history-regression.test.mjs
 *
 * Type:
 *   Integration regression test
 *
 * Purpose:
 *   Verifies mask-specific undo/redo behavior for user-driven Fabric object
 *   edits and merge undo placement. These cases use the ImageEditor facade
 *   with the real Fabric environment because the regressions depended on
 *   event wiring and restored editor-owned placement state.
 *
 * Scope:
 *   - Mask `object:modified` events push a history entry after control
 *     transforms such as scale and rotate.
 *   - `loadFromState` restores the editor's last-mask placement reference so
 *     a new mask created after merge undo is placed next to the restored mask.
 *
 * Out of scope:
 *   - merge image pixel quality
 *   - unrelated crop and export behavior
 *   - browser pointer event synthesis
 *
 * Environment:
 *   - Node.js ESM
 *   - jsdom
 *   - Fabric.js with node-canvas
 *
 * Run:
 *   node --import ./tests/helpers/register-ts-loader.mjs --test tests/mask-history-regression.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    disposeEditor,
    fabric,
    loadFixtureImage,
    resetEditorDom,
} from './helpers/fabric-environment.mjs';

const { ImageEditor } = await import('../src/image-editor.ts');

function isMask(object) {
    return typeof object?.maskId === 'number';
}

async function createSourceEditor(options = {}, domOptions = {}) {
    const ids = resetEditorDom(domOptions);
    const editor = new ImageEditor(fabric, {
        canvasWidth: 320,
        canvasHeight: 240,
        animationDuration: 0,
        showPlaceholder: false,
        exportMultiplier: 1,
        ...options,
    });
    editor.init(ids);
    return { editor, ids };
}

test('undo after a mask control transform restores the previous mask geometry', async (t) => {
    const { editor } = await createSourceEditor();
    t.after(() => disposeEditor(editor));

    await loadFixtureImage(editor, { width: 120, height: 80 });
    const mask = editor.createMask({
        left: 10,
        top: 12,
        width: 30,
        height: 20,
    });
    assert.ok(mask, 'sanity: mask must be created');

    const original = {
        maskId: mask.maskId,
        scaleX: mask.scaleX ?? 1,
        scaleY: mask.scaleY ?? 1,
        angle: mask.angle ?? 0,
    };

    mask.set({ scaleX: 1.75, scaleY: 1.5, angle: 35 });
    mask.setCoords();
    editor.canvas.fire('object:modified', { target: mask });

    await editor.undo();

    const restoredMasks = editor.canvas.getObjects().filter(isMask);
    assert.equal(restoredMasks.length, 1, 'undo must keep the mask instead of removing it');
    const restoredMask = restoredMasks[0];
    assert.equal(restoredMask.maskId, original.maskId);
    assert.equal(restoredMask.scaleX ?? 1, original.scaleX);
    assert.equal(restoredMask.scaleY ?? 1, original.scaleY);
    assert.equal(restoredMask.angle ?? 0, original.angle);
});

test('creating a mask after merge undo places it next to the restored last mask', async (t) => {
    const { editor } = await createSourceEditor();
    t.after(() => disposeEditor(editor));

    await loadFixtureImage(editor, { width: 120, height: 80 });
    const firstMask = editor.createMask({
        width: 30,
        height: 20,
    });
    assert.ok(firstMask, 'sanity: first mask must be created');

    await editor.mergeMasks();
    await editor.undo();

    const restoredFirstMask = editor.canvas
        .getObjects()
        .filter(isMask)
        .find((mask) => mask.maskId === firstMask.maskId);
    assert.ok(restoredFirstMask, 'sanity: merge undo must restore the first mask');

    const secondMask = editor.createMask({
        width: 30,
        height: 20,
    });
    assert.ok(secondMask, 'sanity: second mask must be created');

    const expectedLeft = Math.round(
        (restoredFirstMask.left ?? 0) + restoredFirstMask.getScaledWidth() + 5,
    );
    assert.equal(secondMask.left, expectedLeft);
    assert.equal(secondMask.top, restoredFirstMask.top);
});
