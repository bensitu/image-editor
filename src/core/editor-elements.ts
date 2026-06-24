/**
 * Canonical DOM target resolution for ImageEditor.
 *
 * The resolver merges user-provided string IDs, HTMLElement refs, and explicit
 * null targets with built-in defaults so UI modules can work with a complete
 * logical key table while still supporting framework-owned DOM nodes.
 */

import type { ElementIdMap } from './public-types.js';

export type ElementKey = keyof Required<ElementIdMap>;

export type ResolvedElementTarget = string | HTMLElement | null;

export type ResolvedElementMap = Record<ElementKey, ResolvedElementTarget>;

/** @deprecated Use ResolvedElementMap. */
export type ResolvedElementIdMap = ResolvedElementMap;

const DEFAULT_ELEMENT_TARGETS: ResolvedElementMap = {
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

function isHTMLElementTarget(value: unknown): value is HTMLElement {
    return (
        !!value &&
        typeof value === 'object' &&
        (value as { nodeType?: unknown }).nodeType === 1 &&
        typeof (value as { addEventListener?: unknown }).addEventListener === 'function'
    );
}

function getFallbackDocument(): Document | null {
    return typeof document !== 'undefined' ? document : null;
}

export function resolveDomElement<T extends HTMLElement>(
    target: string | HTMLElement | null | undefined,
    ownerDocument?: Document | null,
): T | null {
    if (target === null || target === undefined) return null;
    if (isHTMLElementTarget(target)) return target as T;
    const lookupDocument = ownerDocument ?? getFallbackDocument();
    if (!lookupDocument) return null;
    return lookupDocument.getElementById(target) as T | null;
}

export function resolveElementTargets(elementMap: ElementIdMap = {}): ResolvedElementMap {
    const resolved = { ...DEFAULT_ELEMENT_TARGETS } as ResolvedElementMap;
    for (const [key, value] of Object.entries(elementMap) as Array<
        [ElementKey, ResolvedElementTarget | undefined]
    >) {
        resolved[key] = value === undefined ? null : value;
    }
    return resolved;
}

/** @deprecated Use resolveElementTargets. */
export function resolveElementIds(idMap: ElementIdMap = {}): ResolvedElementMap {
    return resolveElementTargets(idMap);
}
