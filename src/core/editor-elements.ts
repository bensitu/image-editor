/**
 * Canonical DOM element key resolution for ImageEditor.
 *
 * The resolver merges user-provided IDs with built-in defaults so UI binding
 * modules can work with a complete key-to-ID table.
 */

import type { ElementIdMap } from './public-types.js';

export type ElementKey = keyof Required<ElementIdMap>;

export type ResolvedElementIdMap = Record<ElementKey, string | null>;

const DEFAULT_ELEMENT_IDS: ResolvedElementIdMap = {
    canvas: 'canvas',
    canvasContainer: null,
    imagePlaceholder: 'imagePlaceholder',
    scalePercentageInput: 'scalePercentageInput',
    rotateLeftDegreesInput: 'rotateLeftDegreesInput',
    rotateRightDegreesInput: 'rotateRightDegreesInput',
    rotateLeftButton: 'rotateLeftButton',
    rotateRightButton: 'rotateRightButton',
    flipHorizontalButton: 'flipHorizontalButton',
    flipVerticalButton: 'flipVerticalButton',
    createMaskButton: 'createMaskButton',
    removeSelectedMaskButton: 'removeSelectedMaskButton',
    removeAllMasksButton: 'removeAllMasksButton',
    mergeMasksButton: 'mergeMasksButton',
    annotationList: 'annotationList',
    enterTextModeButton: 'enterTextModeButton',
    exitTextModeButton: 'exitTextModeButton',
    textColorInput: 'textColorInput',
    textFontSizeInput: 'textFontSizeInput',
    enterDrawModeButton: 'enterDrawModeButton',
    exitDrawModeButton: 'exitDrawModeButton',
    drawColorInput: 'drawColorInput',
    drawBrushSizeInput: 'drawBrushSizeInput',
    removeSelectedAnnotationButton: 'removeSelectedAnnotationButton',
    removeAllAnnotationsButton: 'removeAllAnnotationsButton',
    deleteSelectedObjectButton: 'deleteSelectedObjectButton',
    mergeAnnotationsButton: 'mergeAnnotationsButton',
    bringSelectedObjectForwardButton: 'bringSelectedObjectForwardButton',
    sendSelectedObjectBackwardButton: 'sendSelectedObjectBackwardButton',
    bringSelectedObjectToFrontButton: 'bringSelectedObjectToFrontButton',
    sendSelectedObjectToBackButton: 'sendSelectedObjectToBackButton',
    downloadImageButton: 'downloadImageButton',
    maskList: 'maskList',
    zoomInButton: 'zoomInButton',
    zoomOutButton: 'zoomOutButton',
    resetImageTransformButton: 'resetImageTransformButton',
    undoButton: 'undoButton',
    redoButton: 'redoButton',
    imageInput: 'imageInput',
    enterCropModeButton: 'enterCropModeButton',
    cropAspectRatioSelect: 'cropAspectRatioSelect',
    applyCropButton: 'applyCropButton',
    cancelCropButton: 'cancelCropButton',
    enterMosaicModeButton: 'enterMosaicModeButton',
    exitMosaicModeButton: 'exitMosaicModeButton',
    mosaicBrushSizeInput: 'mosaicBrushSizeInput',
    mosaicBlockSizeInput: 'mosaicBlockSizeInput',
    uploadArea: 'uploadArea',
};

export function resolveElementIds(idMap: ElementIdMap): ResolvedElementIdMap {
    return { ...DEFAULT_ELEMENT_IDS, ...idMap } as ResolvedElementIdMap;
}
