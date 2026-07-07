/**
 * Editor control enablement policy.
 *
 * Applies a compact state snapshot to toolbar, mode, history, and upload
 * controls so competing operations stay disabled while a tool owns the canvas.
 */

import type { ElementKey } from '../core/editor-elements.js';

export interface EditorControlSnapshot {
    hasImage: boolean;
    hasMasks: boolean;
    hasAnnotations: boolean;
    hasSelectedMask: boolean;
    hasSelectedAnnotation: boolean;
    hasSelectedEditableObject: boolean;
    isDefaultTransform: boolean;
    currentScale: number;
    minScale: number;
    maxScale: number;
    canUndo: boolean;
    canRedo: boolean;
    isBusy: boolean;
    isDisposed: boolean;
    isInCropMode: boolean;
    isInMosaicMode: boolean;
    isInTextMode: boolean;
    isInDrawMode: boolean;
    isInShapeMode: boolean;
    isMosaicApplying: boolean;
}

export type ControlEnabler = (key: ElementKey, enabled: boolean) => void;

// Crop mode freezes both toolbar buttons and form controls that can
// start competing editor actions while a crop session owns the canvas.
const CROP_MODE_CONTROL_KEYS: readonly ElementKey[] = [
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

const CROP_MODE_ENABLED_KEYS: readonly ElementKey[] = [
    'cropAspectRatioSelect',
    'applyCropButton',
    'cancelCropButton',
];

const TEXT_MODE_CONTROL_KEYS: readonly ElementKey[] = CROP_MODE_CONTROL_KEYS;
const TEXT_MODE_ENABLED_KEYS: readonly ElementKey[] = [
    'exitTextModeButton',
    'textColorInput',
    'textFontSizeInput',
];

const DRAW_MODE_CONTROL_KEYS: readonly ElementKey[] = CROP_MODE_CONTROL_KEYS;
const DRAW_MODE_ENABLED_KEYS: readonly ElementKey[] = [
    'exitDrawModeButton',
    'drawColorInput',
    'drawBrushSizeInput',
    'drawBrushSubModeButton',
    'drawEraseSubModeButton',
    'eraserBrushSizeInput',
];

const SHAPE_MODE_CONTROL_KEYS: readonly ElementKey[] = CROP_MODE_CONTROL_KEYS;
const SHAPE_MODE_ENABLED_KEYS: readonly ElementKey[] = [
    'shapeKindSelect',
    'shapeStrokeInput',
    'shapeStrokeWidthInput',
    'shapeFillInput',
    'createShapeAnnotationButton',
    'enterShapeModeButton',
    'exitShapeModeButton',
];

// Mosaic mode owns pointer interaction on the canvas. While active, controls
// that could replace objects, mutate masks, or restore history are disabled;
// only Mosaic config controls and the exit action remain enabled.
const MOSAIC_MODE_CONTROL_KEYS: readonly ElementKey[] = [
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

const MOSAIC_MODE_ENABLED_KEYS: readonly ElementKey[] = [
    'exitMosaicModeButton',
    'mosaicBrushSizeInput',
    'mosaicBlockSizeInput',
];

function setModeControlState(
    controlKeys: readonly ElementKey[],
    enabledKeys: readonly ElementKey[],
    snapshot: EditorControlSnapshot,
    setEnabled: ControlEnabler,
): void {
    controlKeys.forEach((key) => {
        setEnabled(key, !snapshot.isBusy && enabledKeys.includes(key));
    });
}

export function applyEditorControlState(
    snapshot: EditorControlSnapshot,
    setEnabled: ControlEnabler,
): void {
    if (snapshot.isDisposed) {
        CROP_MODE_CONTROL_KEYS.forEach((key) => {
            setEnabled(key, false);
        });
        return;
    }

    if (snapshot.isInCropMode) {
        setModeControlState(CROP_MODE_CONTROL_KEYS, CROP_MODE_ENABLED_KEYS, snapshot, setEnabled);
        return;
    }

    if (snapshot.isInTextMode) {
        setModeControlState(TEXT_MODE_CONTROL_KEYS, TEXT_MODE_ENABLED_KEYS, snapshot, setEnabled);
        return;
    }

    if (snapshot.isInDrawMode) {
        setModeControlState(DRAW_MODE_CONTROL_KEYS, DRAW_MODE_ENABLED_KEYS, snapshot, setEnabled);
        return;
    }

    if (snapshot.isInShapeMode) {
        setModeControlState(SHAPE_MODE_CONTROL_KEYS, SHAPE_MODE_ENABLED_KEYS, snapshot, setEnabled);
        return;
    }

    if (snapshot.isInMosaicMode) {
        MOSAIC_MODE_CONTROL_KEYS.forEach((key) => {
            setEnabled(
                key,
                !snapshot.isBusy &&
                    !snapshot.isMosaicApplying &&
                    MOSAIC_MODE_ENABLED_KEYS.includes(key),
            );
        });
        setEnabled('imageInput', false);
        return;
    }

    setEnabled('scalePercentageInput', snapshot.hasImage && !snapshot.isBusy);
    setEnabled('imageBrightnessInput', snapshot.hasImage && !snapshot.isBusy);
    setEnabled('imageContrastInput', snapshot.hasImage && !snapshot.isBusy);
    setEnabled('imageSaturationInput', snapshot.hasImage && !snapshot.isBusy);
    setEnabled('imageBlurInput', snapshot.hasImage && !snapshot.isBusy);
    setEnabled('imageSharpenInput', snapshot.hasImage && !snapshot.isBusy);
    setEnabled('imageGrayscaleInput', snapshot.hasImage && !snapshot.isBusy);
    setEnabled('imageSepiaInput', snapshot.hasImage && !snapshot.isBusy);
    setEnabled('imageVintageInput', snapshot.hasImage && !snapshot.isBusy);
    setEnabled('applyImageFiltersButton', snapshot.hasImage && !snapshot.isBusy);
    setEnabled('resetImageFiltersButton', snapshot.hasImage && !snapshot.isBusy);
    setEnabled('clearImageFiltersButton', snapshot.hasImage && !snapshot.isBusy);
    setEnabled('rotateLeftDegreesInput', snapshot.hasImage && !snapshot.isBusy);
    setEnabled('rotateRightDegreesInput', snapshot.hasImage && !snapshot.isBusy);
    setEnabled(
        'zoomInButton',
        snapshot.hasImage && !snapshot.isBusy && snapshot.currentScale < snapshot.maxScale,
    );
    setEnabled(
        'zoomOutButton',
        snapshot.hasImage && !snapshot.isBusy && snapshot.currentScale > snapshot.minScale,
    );
    setEnabled('rotateLeftButton', snapshot.hasImage && !snapshot.isBusy);
    setEnabled('rotateRightButton', snapshot.hasImage && !snapshot.isBusy);
    setEnabled('flipHorizontalButton', snapshot.hasImage && !snapshot.isBusy);
    setEnabled('flipVerticalButton', snapshot.hasImage && !snapshot.isBusy);
    setEnabled('createMaskButton', snapshot.hasImage && !snapshot.isBusy);
    setEnabled('removeSelectedMaskButton', snapshot.hasSelectedMask && !snapshot.isBusy);
    setEnabled('removeAllMasksButton', snapshot.hasMasks && !snapshot.isBusy);
    setEnabled('mergeMasksButton', snapshot.hasImage && snapshot.hasMasks && !snapshot.isBusy);
    setEnabled(
        'removeSelectedAnnotationButton',
        snapshot.hasSelectedAnnotation && !snapshot.isBusy,
    );
    setEnabled('removeAllAnnotationsButton', snapshot.hasAnnotations && !snapshot.isBusy);
    setEnabled(
        'deleteSelectedObjectButton',
        snapshot.hasSelectedEditableObject && !snapshot.isBusy,
    );
    setEnabled(
        'mergeAnnotationsButton',
        snapshot.hasImage && snapshot.hasAnnotations && !snapshot.isBusy,
    );
    setEnabled(
        'bringSelectedObjectForwardButton',
        snapshot.hasSelectedEditableObject && !snapshot.isBusy,
    );
    setEnabled(
        'sendSelectedObjectBackwardButton',
        snapshot.hasSelectedEditableObject && !snapshot.isBusy,
    );
    setEnabled(
        'bringSelectedObjectToFrontButton',
        snapshot.hasSelectedEditableObject && !snapshot.isBusy,
    );
    setEnabled(
        'sendSelectedObjectToBackButton',
        snapshot.hasSelectedEditableObject && !snapshot.isBusy,
    );
    setEnabled('downloadImageButton', snapshot.hasImage && !snapshot.isBusy);
    setEnabled(
        'resetImageTransformButton',
        snapshot.hasImage && !snapshot.isDefaultTransform && !snapshot.isBusy,
    );
    setEnabled('undoButton', snapshot.hasImage && !snapshot.isBusy && snapshot.canUndo);
    setEnabled('redoButton', snapshot.hasImage && !snapshot.isBusy && snapshot.canRedo);
    setEnabled('enterCropModeButton', snapshot.hasImage && !snapshot.isBusy);
    setEnabled('cropAspectRatioSelect', snapshot.hasImage && !snapshot.isBusy);
    setEnabled('enterMosaicModeButton', snapshot.hasImage && !snapshot.isBusy);
    setEnabled('enterTextModeButton', snapshot.hasImage && !snapshot.isBusy);
    setEnabled('enterDrawModeButton', snapshot.hasImage && !snapshot.isBusy);
    setEnabled('enterShapeModeButton', snapshot.hasImage && !snapshot.isBusy);
    setEnabled('createShapeAnnotationButton', snapshot.hasImage && !snapshot.isBusy);
    setEnabled('exitMosaicModeButton', false);
    setEnabled('exitTextModeButton', false);
    setEnabled('exitDrawModeButton', false);
    setEnabled('exitShapeModeButton', false);
    setEnabled('mosaicBrushSizeInput', !snapshot.isDisposed);
    setEnabled('mosaicBlockSizeInput', !snapshot.isDisposed);
    setEnabled('textColorInput', !snapshot.isDisposed);
    setEnabled('textFontSizeInput', !snapshot.isDisposed);
    setEnabled('drawColorInput', !snapshot.isDisposed);
    setEnabled('drawBrushSizeInput', !snapshot.isDisposed);
    setEnabled('drawBrushSubModeButton', false);
    setEnabled('drawEraseSubModeButton', false);
    setEnabled('eraserBrushSizeInput', !snapshot.isDisposed);
    setEnabled('shapeKindSelect', !snapshot.isDisposed);
    setEnabled('shapeStrokeInput', !snapshot.isDisposed);
    setEnabled('shapeStrokeWidthInput', !snapshot.isDisposed);
    setEnabled('shapeFillInput', !snapshot.isDisposed);
    setEnabled('imageInput', !snapshot.isBusy);
    setEnabled('applyCropButton', false);
    setEnabled('cancelCropButton', false);
}
