/**
 * Type:
 *   Integration test
 *
 * Purpose:
 *   Verifies public base-image flip APIs, history, and state restoration.
 *
 * Scope:
 *   - flipHorizontal and flipVertical mutate only the committed base image.
 *   - Masks and annotations keep their geometry and flip state while the base
 *     image is flipped.
 *   - Flip operations are rejected while crop, mosaic, text, or draw mode owns
 *     the canvas.
 *   - Undo, redo, loadFromState, and resetImageTransform preserve or clear flip
 *     state according to the public transform contract.
 *   - Loading a new image resets flip state and failed load rollback preserves
 *     the previous image flip state.
 *   - Flip APIs are safe no-ops before an image is loaded and after dispose.
 *
 * Out of scope:
 *   - pixel-level export verification
 *   - DOM toolbar button wiring
 *   - crop, mosaic, and annotation editing behavior beyond ensuring those
 *     objects are not mutated by base-image flips
 *
 * Environment:
 *   - Node.js ESM
 *   - shared Fabric/JSDOM editor fixture helpers
 *   - source TypeScript loaded through the test resolver hook
 *
 * Run:
 *   node --import ./tests/helpers/register-ts-loader.mjs --test tests/flip-transform.test.mjs
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

test('flipHorizontal and flipVertical affect only the base image and participate in history', async (t) => {
    const { editor } = createSourceEditor();
    t.after(() => disposeEditor(editor));

    await loadFixtureImage(editor, { width: 120, height: 80 });
    const mask = editor.createMask({ width: 20, height: 20, left: 10, top: 10 });
    const annotation = editor.createTextAnnotation({ text: 'A', left: 40, top: 30 });
    const maskBefore = {
        left: mask.left,
        top: mask.top,
        flipX: !!mask.flipX,
        flipY: !!mask.flipY,
    };
    const annotationBefore = {
        left: annotation.left,
        top: annotation.top,
        flipX: !!annotation.flipX,
        flipY: !!annotation.flipY,
    };

    await editor.flipHorizontal();

    assert.equal(editor.originalImage.flipX, true);
    assert.equal(editor.originalImage.flipY, false);
    assert.deepEqual(
        { left: mask.left, top: mask.top, flipX: !!mask.flipX, flipY: !!mask.flipY },
        maskBefore,
        'horizontal flip must not mutate masks',
    );
    assert.deepEqual(
        {
            left: annotation.left,
            top: annotation.top,
            flipX: !!annotation.flipX,
            flipY: !!annotation.flipY,
        },
        annotationBefore,
        'horizontal flip must not mutate annotations',
    );

    await editor.undo();
    assert.equal(editor.originalImage.flipX, false, 'undo restores previous flipX');

    await editor.redo();
    assert.equal(editor.originalImage.flipX, true, 'redo reapplies flipX');

    await editor.flipVertical();
    assert.equal(editor.originalImage.flipX, true);
    assert.equal(editor.originalImage.flipY, true);

    const snapshot = editor.captureSnapshotInternal();
    await editor.flipHorizontal();
    assert.equal(editor.originalImage.flipX, false);
    await editor.loadFromState(snapshot);
    assert.equal(editor.originalImage.flipX, true, 'loadFromState preserves flipX');
    assert.equal(editor.originalImage.flipY, true, 'loadFromState preserves flipY');

    await editor.resetImageTransform();
    assert.equal(editor.originalImage.flipX, false, 'reset clears flipX');
    assert.equal(editor.originalImage.flipY, false, 'reset clears flipY');

    await editor.undo();
    assert.equal(editor.originalImage.flipX, true, 'undo after reset restores flipX');
    assert.equal(editor.originalImage.flipY, true, 'undo after reset restores flipY');

    await editor.redo();
    assert.equal(editor.originalImage.flipX, false, 'redo after reset clears flipX again');
    assert.equal(editor.originalImage.flipY, false, 'redo after reset clears flipY again');
});

test('flip APIs are no-ops without an image and after dispose', async () => {
    const { editor } = createSourceEditor();

    await editor.flipHorizontal();
    await editor.flipVertical();
    assert.equal(editor.isImageLoaded(), false);

    editor.dispose();
    await editor.flipHorizontal();
    await editor.flipVertical();
});

test('flip APIs are blocked while tool modes are active', async (t) => {
    const cases = [
        ['crop', (editor) => editor.enterCropMode(), (editor) => editor.cropSession !== null],
        ['mosaic', (editor) => editor.enterMosaicMode(), (editor) => editor.isMosaicMode()],
        ['text', (editor) => editor.enterTextMode(), (editor) => editor.isTextMode()],
        ['draw', (editor) => editor.enterDrawMode(), (editor) => editor.isDrawMode()],
    ];

    for (const [mode, enterMode, isModeActive] of cases) {
        await t.test(mode, async (subtest) => {
            const { editor } = createSourceEditor();
            subtest.after(() => disposeEditor(editor));

            await loadFixtureImage(editor, { width: 120, height: 80 });
            enterMode(editor);

            assert.equal(isModeActive(editor), true);
            await assert.rejects(
                () => editor.flipHorizontal(),
                new RegExp(`Cannot run "flipHorizontal" while ${mode} mode is active`),
            );
            await assert.rejects(
                () => editor.flipVertical(),
                new RegExp(`Cannot run "flipVertical" while ${mode} mode is active`),
            );
            assert.equal(editor.originalImage.flipX, false);
            assert.equal(editor.originalImage.flipY, false);
        });
    }
});

test('loadImage resets new image flip state and preserves flip on failed rollback', async (t) => {
    const states = [];
    const { editor } = createSourceEditor({
        onImageChanged: (state, context) => {
            states.push({
                operation: context.operation,
                isFlippedHorizontally: state.isFlippedHorizontally,
                isFlippedVertically: state.isFlippedVertically,
            });
        },
    });
    t.after(() => disposeEditor(editor));

    await loadFixtureImage(editor, { width: 120, height: 80, fill: '#d7ebff' });
    await editor.flipHorizontal();
    await editor.flipVertical();

    assert.equal(editor.originalImage.flipX, true);
    assert.equal(editor.originalImage.flipY, true);
    assert.deepEqual(states.at(-1), {
        operation: 'flipVertical',
        isFlippedHorizontally: true,
        isFlippedVertically: true,
    });

    await assert.rejects(() => editor.loadImage('data:image/png;base64,not-image-data'));
    assert.equal(editor.originalImage.flipX, true, 'failed load rollback preserves flipX');
    assert.equal(editor.originalImage.flipY, true, 'failed load rollback preserves flipY');

    await loadFixtureImage(editor, { width: 64, height: 64, fill: '#f2a541' });
    assert.equal(!!editor.originalImage.flipX, false, 'new image starts unflipped horizontally');
    assert.equal(!!editor.originalImage.flipY, false, 'new image starts unflipped vertically');
    assert.deepEqual(states.at(-1), {
        operation: 'loadImage',
        isFlippedHorizontally: false,
        isFlippedVertically: false,
    });
});
