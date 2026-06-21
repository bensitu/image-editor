/**
 * Type:
 *   Integration regression test
 *
 * Purpose:
 *   Verifies that undoing a successful mask merge restores the editor-owned
 *   mask state that Fabric snapshots alone do not reliably preserve. The suite
 *   runs through the ImageEditor facade with the real Fabric environment so it
 *   can observe restored mask metadata, transient labels, hover handlers, active
 *   selection, and the DOM mask list.
 *
 * Scope:
 *   - Undo after merge restores mask custom metadata and visual style fields.
 *   - Undo rebuilds the selected mask label and reattaches mask hover handlers.
 *   - Undo restores the mask list item and active selection across expand, fit,
 *     and cover layout modes.
 *
 * Out of scope:
 *   - merged bitmap pixel quality
 *   - unrelated crop and export behavior
 *   - browser pointer event synthesis
 *
 * Environment:
 *   - Node.js ESM
 *   - jsdom
 *   - Fabric.js with node-canvas
 *
 * Run:
 *   node --import ./tests/helpers/register-ts-loader.mjs --test tests/merge-undo-restore.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createEditor, disposeEditor, loadFixtureImage } from './helpers/fabric-environment.mjs';
import { requireEditorCanvas } from './helpers/editor-internals.mjs';

const LAYOUT_MODES = [
    {
        name: 'expand',
        options: {
            defaultLayoutMode: 'expand',
        },
        dom: { containerWidth: 320, containerHeight: 240 },
    },
    {
        name: 'fit',
        options: {
            defaultLayoutMode: 'fit',
        },
        dom: { containerWidth: 180, containerHeight: 120 },
    },
    {
        name: 'cover',
        options: {
            defaultLayoutMode: 'cover',
        },
        dom: { containerWidth: 180, containerHeight: 120 },
    },
];

test('merge undo restores mask metadata, label, and mask list in every layout mode', async (t) => {
    for (const mode of LAYOUT_MODES) {
        await t.test(mode.name, async (t) => {
            const { editor, ids } = await createEditor(
                {
                    ...mode.options,
                    exportMultiplier: 1,
                },
                mode.dom,
            );
            t.after(() => disposeEditor(editor));

            await loadFixtureImage(editor, { width: 120, height: 80 });
            const createdMask = editor.createMask({
                left: 10,
                top: 12,
                width: 30,
                height: 20,
                color: 'rgba(10,20,30,0.4)',
                styles: {
                    stroke: '#123456',
                    strokeWidth: 4,
                },
            });
            assert.ok(createdMask, 'sanity: mask must be created before merge');
            assert.ok(
                createdMask.labelObject,
                'sanity: selected mask label must be visible before merge',
            );

            await editor.mergeMasks();
            assert.equal(
                document.getElementById(ids.maskList).children.length,
                0,
                'sanity: merge removes masks from the live list',
            );

            await editor.undo();

            const canvas = requireEditorCanvas(editor);
            const restoredMasks = canvas
                .getObjects()
                .filter((object) => typeof object.maskId === 'number');
            assert.equal(restoredMasks.length, 1, 'undo must restore one mask object');

            const restoredMask = restoredMasks[0];
            assert.equal(restoredMask.maskId, createdMask.maskId);
            assert.equal(restoredMask.maskName, createdMask.maskName);
            assert.equal(restoredMask.fill, 'rgba(10,20,30,0.4)');
            assert.equal(restoredMask.originalAlpha, 0.5);
            assert.equal(restoredMask.originalStroke, '#123456');
            assert.equal(restoredMask.originalStrokeWidth, 4);
            assert.equal(restoredMask.hasControls, createdMask.hasControls);
            assert.equal(restoredMask.selectable, createdMask.selectable);
            assert.equal(restoredMask.strokeUniform, createdMask.strokeUniform);
            assert.equal(restoredMask.lockRotation, createdMask.lockRotation);
            assert.equal(restoredMask.transparentCorners, createdMask.transparentCorners);
            assert.equal(restoredMask.borderColor, createdMask.borderColor);
            assert.equal(restoredMask.cornerColor, createdMask.cornerColor);
            assert.equal(restoredMask.cornerSize, createdMask.cornerSize);
            assert.equal(
                restoredMask.imageEditorMaskHandlers?.mouseover instanceof Function,
                true,
                'undo must reattach mask hover handlers',
            );

            const activeMask = canvas.getActiveObject();
            assert.equal(activeMask?.maskId, createdMask.maskId, 'undo must reselect the mask');
            assert.ok(restoredMask.labelObject, 'undo must rebuild the selected mask label');
            assert.equal(restoredMask.labelObject.maskLabel, true);

            const listItems = [...document.getElementById(ids.maskList).querySelectorAll('li')];
            assert.equal(listItems.length, 1, 'undo must restore the mask list item');
            assert.equal(listItems[0].dataset.maskId, String(createdMask.maskId));
            assert.equal(listItems[0].textContent, createdMask.maskName);
            assert.equal(listItems[0].classList.contains('active'), true);
        });
    }
});
