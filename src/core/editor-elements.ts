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

export type DomElementGuard<TElement extends HTMLElement> = (
    element: HTMLElement,
) => element is TElement;

const DEFAULT_ELEMENT_TARGETS: Readonly<ResolvedElementMap> = Object.freeze({
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
});

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

function hasTagName(element: HTMLElement, tagName: string): boolean {
    return element.tagName.toLowerCase() === tagName;
}

export function isCanvasElement(element: HTMLElement): element is HTMLCanvasElement {
    return hasTagName(element, 'canvas');
}

export function isInputElement(element: HTMLElement): element is HTMLInputElement {
    return hasTagName(element, 'input');
}

export function isSelectElement(element: HTMLElement): element is HTMLSelectElement {
    return hasTagName(element, 'select');
}

export function isInputOrSelectElement(
    element: HTMLElement,
): element is HTMLInputElement | HTMLSelectElement {
    return isInputElement(element) || isSelectElement(element);
}

/**
 * Resolve a string ID or direct HTMLElement reference to a DOM element.
 *
 * When `guard` is supplied, the resolved element must satisfy that runtime
 * predicate or `null` is returned. Callers that need a specific subtype
 * should pass a guard instead of relying on the generic type parameter alone.
 */
export function resolveDomElement<T extends HTMLElement = HTMLElement>(
    target: string | HTMLElement | null | undefined,
    ownerDocument?: Document | null,
    guard?: DomElementGuard<T>,
): T | null {
    if (target === null || target === undefined) return null;
    const element = isHTMLElementTarget(target)
        ? target
        : (ownerDocument ?? getFallbackDocument())?.getElementById(target);
    if (!element) return null;
    if (guard && !guard(element)) return null;
    return element as T;
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
