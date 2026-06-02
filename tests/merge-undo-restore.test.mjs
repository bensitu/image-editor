import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createEditor, disposeEditor, loadFixtureImage } from './helpers/fabric-environment.mjs';

const LAYOUT_MODES = [
    {
        name: 'expand',
        options: {
            fitImageToCanvas: false,
            coverImageToCanvas: false,
            expandCanvasToImage: true,
        },
        dom: { containerWidth: 320, containerHeight: 240 },
    },
    {
        name: 'fit',
        options: {
            fitImageToCanvas: true,
            coverImageToCanvas: false,
            expandCanvasToImage: false,
        },
        dom: { containerWidth: 180, containerHeight: 120 },
    },
    {
        name: 'cover',
        options: {
            fitImageToCanvas: false,
            coverImageToCanvas: true,
            expandCanvasToImage: false,
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
                createdMask.__label,
                'sanity: selected mask label must be visible before merge',
            );

            await editor.mergeMasks();
            assert.equal(
                document.getElementById(ids.maskList).children.length,
                0,
                'sanity: merge removes masks from the live list',
            );

            await editor.undo();

            const restoredMasks = editor.canvas
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
                restoredMask.__imageEditorMaskHandlers?.mouseover instanceof Function,
                true,
                'undo must reattach mask hover handlers',
            );

            const activeMask = editor.canvas.getActiveObject();
            assert.equal(activeMask?.maskId, createdMask.maskId, 'undo must reselect the mask');
            assert.ok(restoredMask.__label, 'undo must rebuild the selected mask label');
            assert.equal(restoredMask.__label.maskLabel, true);

            const listItems = [...document.getElementById(ids.maskList).querySelectorAll('li')];
            assert.equal(listItems.length, 1, 'undo must restore the mask list item');
            assert.equal(listItems[0].dataset.maskId, String(createdMask.maskId));
            assert.equal(listItems[0].textContent, createdMask.maskName);
            assert.equal(listItems[0].classList.contains('active'), true);
        });
    }
});
