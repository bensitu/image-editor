/**
 * Type:
 *   Unit test
 *
 * Purpose:
 *   Verifies tool-mode policy outside the ImageEditor facade.
 *
 * Scope:
 *   - Active tool-mode priority.
 *   - Mode-specific operation allow lists.
 *   - Operation rejection policy during active modes.
 *
 * Out of scope:
 *   - OperationGuard busy/animation checks.
 *   - Fabric session lifecycle.
 */

import { register } from 'node:module';

register('./helpers/ts-resolve-hook.mjs', import.meta.url);

import { test } from 'node:test';
import assert from 'node:assert/strict';

const {
    canRunOperationInToolMode,
    getActiveToolMode,
    getAllowedOperationsForToolMode,
    isImageEditorOperation,
    isToolModeActive,
} = await import('../src/tool-mode/tool-mode-policy.ts');

function snapshot(overrides = {}) {
    return {
        hasCropSession: false,
        hasMosaicSession: false,
        hasTextSession: false,
        hasDrawSession: false,
        hasShapeSession: false,
        ...overrides,
    };
}

test('no active mode returns null and is inactive', () => {
    const state = snapshot();

    assert.equal(getActiveToolMode(state), null);
    assert.equal(isToolModeActive(state), false);
    assert.equal(canRunOperationInToolMode(null, 'scaleImage'), true);
});

test('each active mode is detected individually', () => {
    assert.equal(getActiveToolMode(snapshot({ hasCropSession: true })), 'crop');
    assert.equal(getActiveToolMode(snapshot({ hasMosaicSession: true })), 'mosaic');
    assert.equal(getActiveToolMode(snapshot({ hasTextSession: true })), 'text');
    assert.equal(getActiveToolMode(snapshot({ hasDrawSession: true })), 'draw');
    assert.equal(getActiveToolMode(snapshot({ hasShapeSession: true })), 'shape');
    assert.equal(isToolModeActive(snapshot({ hasDrawSession: true })), true);
});

test('multiple active modes preserve facade priority', () => {
    assert.equal(
        getActiveToolMode(
            snapshot({
                hasCropSession: true,
                hasMosaicSession: true,
                hasTextSession: true,
                hasDrawSession: true,
                hasShapeSession: true,
            }),
        ),
        'crop',
    );
    assert.equal(
        getActiveToolMode(
            snapshot({
                hasMosaicSession: true,
                hasTextSession: true,
                hasDrawSession: true,
                hasShapeSession: true,
            }),
        ),
        'mosaic',
    );
    assert.equal(
        getActiveToolMode(snapshot({ hasTextSession: true, hasDrawSession: true })),
        'text',
    );
});

test('crop mode allows only crop-session operations', () => {
    const allowed = getAllowedOperationsForToolMode('crop');

    assert.equal(allowed.has('setCropAspectRatio'), true);
    assert.equal(allowed.has('applyCrop'), true);
    assert.equal(allowed.has('cancelCrop'), true);
    assert.equal(allowed.has('saveState'), true);
    assert.equal(canRunOperationInToolMode('crop', 'scaleImage'), false);
});

test('mosaic mode allows mosaic configuration and save operations', () => {
    const allowed = getAllowedOperationsForToolMode('mosaic');

    assert.equal(allowed.has('exitMosaicMode'), true);
    assert.equal(allowed.has('applyMosaic'), true);
    assert.equal(allowed.has('setMosaicConfig'), true);
    assert.equal(allowed.has('resetMosaicConfig'), true);
    assert.equal(allowed.has('setMosaicBrushSize'), true);
    assert.equal(allowed.has('setMosaicBlockSize'), true);
    assert.equal(allowed.has('saveState'), true);
    assert.equal(canRunOperationInToolMode('mosaic', 'mergeMasks'), false);
});

test('text mode allows text-session operations', () => {
    const allowed = getAllowedOperationsForToolMode('text');

    assert.equal(allowed.has('exitTextMode'), true);
    assert.equal(allowed.has('createTextAnnotation'), true);
    assert.equal(allowed.has('setTextConfig'), true);
    assert.equal(allowed.has('resetTextConfig'), true);
    assert.equal(allowed.has('setTextColor'), true);
    assert.equal(allowed.has('setTextFontSize'), true);
    assert.equal(allowed.has('saveState'), true);
    assert.equal(canRunOperationInToolMode('text', 'enterDrawMode'), false);
});

test('draw mode allows draw-session operations', () => {
    const allowed = getAllowedOperationsForToolMode('draw');

    assert.equal(allowed.has('exitDrawMode'), true);
    assert.equal(allowed.has('setDrawConfig'), true);
    assert.equal(allowed.has('resetDrawConfig'), true);
    assert.equal(allowed.has('setDrawColor'), true);
    assert.equal(allowed.has('setDrawBrushSize'), true);
    assert.equal(allowed.has('setDrawSubMode'), true);
    assert.equal(allowed.has('setEraserConfig'), true);
    assert.equal(allowed.has('resetEraserConfig'), true);
    assert.equal(allowed.has('commitEraserStroke'), true);
    assert.equal(allowed.has('saveState'), true);
    assert.equal(canRunOperationInToolMode('draw', 'createTextAnnotation'), false);
});

test('shape mode allows shape-session operations', () => {
    const allowed = getAllowedOperationsForToolMode('shape');

    assert.equal(allowed.has('enterShapeMode'), true);
    assert.equal(allowed.has('exitShapeMode'), true);
    assert.equal(allowed.has('createShapeAnnotation'), true);
    assert.equal(allowed.has('setShapeConfig'), true);
    assert.equal(allowed.has('resetShapeConfig'), true);
    assert.equal(allowed.has('saveState'), true);
    assert.equal(canRunOperationInToolMode('shape', 'enterDrawMode'), false);
});

test('text and draw modes block unrelated mutating and export operations', () => {
    const blocked = [
        'exportImageBase64',
        'exportImageFile',
        'downloadImage',
        'mergeMasks',
        'mergeAnnotations',
        'undo',
        'redo',
        'deleteSelectedObject',
        'scaleImage',
        'rotateImage',
        'flipHorizontal',
        'flipVertical',
        'resetImageTransform',
        'loadImage',
        'loadFromState',
        'setCanvasSize',
        'resizeToContainer',
        'relayout',
    ];

    for (const operation of blocked) {
        assert.equal(
            canRunOperationInToolMode('text', operation),
            false,
            `text blocks ${operation}`,
        );
        assert.equal(
            canRunOperationInToolMode('draw', operation),
            false,
            `draw blocks ${operation}`,
        );
        assert.equal(
            canRunOperationInToolMode('shape', operation),
            false,
            `shape blocks ${operation}`,
        );
    }
});
test('operation name guard recognizes public operation names only', () => {
    assert.equal(isImageEditorOperation('mergeMasks'), true);
    assert.equal(isImageEditorOperation('commitImageFilters'), true);
    assert.equal(isImageEditorOperation('createShapeAnnotation'), true);
    assert.equal(isImageEditorOperation('setDrawSubMode'), true);
    assert.equal(isImageEditorOperation('setCanvasSize'), true);
    assert.equal(isImageEditorOperation('resizeToContainer'), true);
    assert.equal(isImageEditorOperation('relayout'), true);
    assert.equal(isImageEditorOperation('dispose'), true);
    assert.equal(isImageEditorOperation('notAnOperation'), false);
    assert.equal(isImageEditorOperation(null), false);
});
