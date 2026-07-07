/**
 * Type:
 *   Unit test
 *
 * Purpose:
 *   Verifies the extracted editor control-state policy independently from the
 *   ImageEditor facade and Fabric runtime.
 *
 * Scope:
 *   - Normal-mode enablement with and without an image.
 *   - Tool-mode priority and the mode-specific enabled controls.
 *   - Busy-state disabling of action controls.
 *
 * Out of scope:
 *   - DOM mutation details handled by ImageEditor.setControlEnabled.
 *   - Fabric object selection mechanics.
 */

import { register } from 'node:module';

register('./helpers/ts-resolve-hook.mjs', import.meta.url);

import { test } from 'node:test';
import assert from 'node:assert/strict';

const { applyEditorControlState } = await import('../src/ui/editor-control-state.ts');

const MODE_CONTROL_KEYS = [
    'scalePercentageInput',
    'imageBrightnessInput',
    'imageContrastInput',
    'imageSaturationInput',
    'imageBlurInput',
    'imageSharpenInput',
    'imageGrayscaleInput',
    'imageSepiaInput',
    'imageVintageInput',
    'applyImageFiltersButton',
    'resetImageFiltersButton',
    'clearImageFiltersButton',
    'rotateLeftDegreesInput',
    'rotateRightDegreesInput',
    'rotateLeftButton',
    'rotateRightButton',
    'flipHorizontalButton',
    'flipVerticalButton',
    'createMaskButton',
    'removeSelectedMaskButton',
    'removeAllMasksButton',
    'mergeMasksButton',
    'mergeAnnotationsButton',
    'enterTextModeButton',
    'exitTextModeButton',
    'textColorInput',
    'textFontSizeInput',
    'enterDrawModeButton',
    'exitDrawModeButton',
    'drawColorInput',
    'drawBrushSizeInput',
    'drawBrushSubModeButton',
    'drawEraseSubModeButton',
    'eraserBrushSizeInput',
    'shapeKindSelect',
    'shapeStrokeInput',
    'shapeStrokeWidthInput',
    'shapeFillInput',
    'createShapeAnnotationButton',
    'enterShapeModeButton',
    'exitShapeModeButton',
    'removeSelectedAnnotationButton',
    'removeAllAnnotationsButton',
    'deleteSelectedObjectButton',
    'bringSelectedObjectForwardButton',
    'sendSelectedObjectBackwardButton',
    'bringSelectedObjectToFrontButton',
    'sendSelectedObjectToBackButton',
    'downloadImageButton',
    'zoomInButton',
    'zoomOutButton',
    'resetImageTransformButton',
    'undoButton',
    'redoButton',
    'imageInput',
    'enterCropModeButton',
    'cropAspectRatioSelect',
    'applyCropButton',
    'cancelCropButton',
    'enterMosaicModeButton',
    'exitMosaicModeButton',
    'mosaicBrushSizeInput',
    'mosaicBlockSizeInput',
];

function makeSnapshot(overrides = {}) {
    return {
        hasImage: false,
        hasMasks: false,
        hasAnnotations: false,
        hasSelectedMask: false,
        hasSelectedAnnotation: false,
        hasSelectedEditableObject: false,
        isDefaultTransform: true,
        currentScale: 1,
        minScale: 0.1,
        maxScale: 4,
        canUndo: false,
        canRedo: false,
        isBusy: false,
        isDisposed: false,
        isInCropMode: false,
        isInMosaicMode: false,
        isInTextMode: false,
        isInDrawMode: false,
        isInShapeMode: false,
        isMosaicApplying: false,
        ...overrides,
    };
}

function collectControlState(snapshot) {
    const calls = [];
    const finalState = new Map();
    applyEditorControlState(snapshot, (key, enabled) => {
        calls.push([key, enabled]);
        finalState.set(key, enabled);
    });
    return { calls, finalState };
}

function assertOnlyEnabled(finalState, expectedEnabled) {
    const expected = new Set(expectedEnabled);
    for (const key of MODE_CONTROL_KEYS) {
        assert.equal(finalState.get(key), expected.has(key), `${key} enabled state mismatch`);
    }
}

test('normal mode with no image disables image actions but leaves file input available', () => {
    const { finalState } = collectControlState(makeSnapshot());

    assert.equal(finalState.get('scalePercentageInput'), false);
    assert.equal(finalState.get('zoomInButton'), false);
    assert.equal(finalState.get('downloadImageButton'), false);
    assert.equal(finalState.get('imageBrightnessInput'), false);
    assert.equal(finalState.get('imageInput'), true);
    assert.equal(finalState.get('mosaicBrushSizeInput'), true);
    assert.equal(finalState.get('textColorInput'), true);
    assert.equal(finalState.get('shapeKindSelect'), true);
    assert.equal(finalState.get('eraserBrushSizeInput'), true);
    assert.equal(finalState.get('drawBrushSubModeButton'), false);
    assert.equal(finalState.get('applyCropButton'), false);
    assert.equal(finalState.get('cancelCropButton'), false);
});

test('normal mode with an image enables available image actions', () => {
    const { finalState } = collectControlState(
        makeSnapshot({
            hasImage: true,
            hasMasks: true,
            hasAnnotations: true,
            hasSelectedMask: true,
            hasSelectedAnnotation: true,
            hasSelectedEditableObject: true,
            isDefaultTransform: false,
            currentScale: 2,
            canUndo: true,
            canRedo: true,
        }),
    );

    assert.equal(finalState.get('scalePercentageInput'), true);
    assert.equal(finalState.get('zoomInButton'), true);
    assert.equal(finalState.get('zoomOutButton'), true);
    assert.equal(finalState.get('removeSelectedMaskButton'), true);
    assert.equal(finalState.get('mergeMasksButton'), true);
    assert.equal(finalState.get('removeSelectedAnnotationButton'), true);
    assert.equal(finalState.get('mergeAnnotationsButton'), true);
    assert.equal(finalState.get('resetImageTransformButton'), true);
    assert.equal(finalState.get('applyImageFiltersButton'), true);
    assert.equal(finalState.get('createShapeAnnotationButton'), true);
    assert.equal(finalState.get('enterShapeModeButton'), true);
    assert.equal(finalState.get('undoButton'), true);
    assert.equal(finalState.get('redoButton'), true);
});

test('crop mode enables only crop controls', () => {
    const { finalState } = collectControlState(
        makeSnapshot({ hasImage: true, isInCropMode: true }),
    );

    assertOnlyEnabled(finalState, ['cropAspectRatioSelect', 'applyCropButton', 'cancelCropButton']);
});

test('text mode enables only text controls', () => {
    const { finalState } = collectControlState(
        makeSnapshot({ hasImage: true, isInTextMode: true }),
    );

    assertOnlyEnabled(finalState, ['exitTextModeButton', 'textColorInput', 'textFontSizeInput']);
});

test('draw mode enables only draw controls', () => {
    const { finalState } = collectControlState(
        makeSnapshot({ hasImage: true, isInDrawMode: true }),
    );

    assertOnlyEnabled(finalState, [
        'exitDrawModeButton',
        'drawColorInput',
        'drawBrushSizeInput',
        'drawBrushSubModeButton',
        'drawEraseSubModeButton',
        'eraserBrushSizeInput',
    ]);
});

test('shape mode enables only shape controls', () => {
    const { finalState } = collectControlState(
        makeSnapshot({ hasImage: true, isInShapeMode: true }),
    );

    assertOnlyEnabled(finalState, [
        'shapeKindSelect',
        'shapeStrokeInput',
        'shapeStrokeWidthInput',
        'shapeFillInput',
        'createShapeAnnotationButton',
        'enterShapeModeButton',
        'exitShapeModeButton',
    ]);
});

test('mosaic mode enables only mosaic controls when not applying', () => {
    const { finalState } = collectControlState(
        makeSnapshot({ hasImage: true, isInMosaicMode: true }),
    );

    assertOnlyEnabled(finalState, [
        'exitMosaicModeButton',
        'mosaicBrushSizeInput',
        'mosaicBlockSizeInput',
    ]);
    assert.equal(finalState.get('imageInput'), false);
});

test('busy state disables normal action controls', () => {
    const { finalState } = collectControlState(
        makeSnapshot({
            hasImage: true,
            hasMasks: true,
            hasAnnotations: true,
            hasSelectedEditableObject: true,
            canUndo: true,
            canRedo: true,
            isBusy: true,
        }),
    );

    assert.equal(finalState.get('zoomInButton'), false);
    assert.equal(finalState.get('createMaskButton'), false);
    assert.equal(finalState.get('mergeMasksButton'), false);
    assert.equal(finalState.get('mergeAnnotationsButton'), false);
    assert.equal(finalState.get('applyImageFiltersButton'), false);
    assert.equal(finalState.get('enterShapeModeButton'), false);
    assert.equal(finalState.get('undoButton'), false);
    assert.equal(finalState.get('redoButton'), false);
    assert.equal(finalState.get('imageInput'), false);
    assert.equal(finalState.get('mosaicBrushSizeInput'), true);
    assert.equal(finalState.get('shapeKindSelect'), true);
});

test('disposed state disables every known control in normal and active modes', () => {
    for (const modeFlags of [
        {},
        { isInCropMode: true },
        { isInTextMode: true },
        { isInDrawMode: true },
        { isInShapeMode: true },
        { isInMosaicMode: true },
    ]) {
        const { finalState } = collectControlState(
            makeSnapshot({
                hasImage: true,
                hasMasks: true,
                hasAnnotations: true,
                hasSelectedMask: true,
                hasSelectedAnnotation: true,
                hasSelectedEditableObject: true,
                isDefaultTransform: false,
                canUndo: true,
                canRedo: true,
                isDisposed: true,
                ...modeFlags,
            }),
        );

        assertOnlyEnabled(finalState, []);
    }
});
