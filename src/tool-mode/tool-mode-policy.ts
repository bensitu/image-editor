/**
 * Tool-mode operation policy for ImageEditor.
 *
 * The policy defines which public operations may run while Crop, Mosaic,
 * Text, Draw, or Shape mode owns editor interaction.
 */

import type { EditorToolMode, ImageEditorOperation } from '../core/public-types.js';

export interface EditorToolModeSnapshot {
    hasCropSession: boolean;
    hasMosaicSession: boolean;
    hasTextSession: boolean;
    hasDrawSession: boolean;
    hasShapeSession: boolean;
}

const CROP_SESSION_ALLOWED_OPERATIONS: ReadonlySet<string> = new Set([
    'setCropAspectRatio',
    'applyCrop',
    'cancelCrop',
    'saveState',
]);

const MOSAIC_SESSION_ALLOWED_OPERATIONS: ReadonlySet<string> = new Set([
    'exitMosaicMode',
    'applyMosaic',
    'setMosaicConfig',
    'resetMosaicConfig',
    'setMosaicBrushSize',
    'setMosaicBlockSize',
    'saveState',
]);

const TOOL_MODE_ALLOWED_OPERATIONS: Record<EditorToolMode, ReadonlySet<string>> = {
    crop: CROP_SESSION_ALLOWED_OPERATIONS,
    mosaic: MOSAIC_SESSION_ALLOWED_OPERATIONS,
    text: new Set([
        'exitTextMode',
        'createTextAnnotation',
        'setTextConfig',
        'resetTextConfig',
        'setTextColor',
        'setTextFontSize',
        'saveState',
    ]),
    draw: new Set([
        'exitDrawMode',
        'setDrawConfig',
        'resetDrawConfig',
        'createDrawAnnotation',
        'setDrawColor',
        'setDrawBrushSize',
        'setDrawSubMode',
        'setEraserConfig',
        'resetEraserConfig',
        'commitEraserStroke',
        'saveState',
    ]),
    shape: new Set([
        'enterShapeMode',
        'exitShapeMode',
        'createShapeAnnotation',
        'setShapeConfig',
        'resetShapeConfig',
        'saveState',
    ]),
};

const IMAGE_EDITOR_OPERATIONS: ReadonlySet<ImageEditorOperation> = new Set([
    'init',
    'loadImage',
    'loadFromState',
    'saveState',
    'setCanvasSize',
    'resizeToContainer',
    'relayout',
    'scaleImage',
    'rotateImage',
    'flipHorizontal',
    'flipVertical',
    'resetImageTransform',
    'setImageFilterConfig',
    'resetImageFilterConfig',
    'clearImageFilters',
    'commitImageFilters',
    'createMask',
    'removeSelectedMask',
    'removeAllMasks',
    'mergeMasks',
    'createTextAnnotation',
    'createShapeAnnotation',
    'enterTextMode',
    'exitTextMode',
    'enterShapeMode',
    'exitShapeMode',
    'setShapeConfig',
    'resetShapeConfig',
    'setTextConfig',
    'resetTextConfig',
    'setTextColor',
    'setTextFontSize',
    'enterDrawMode',
    'exitDrawMode',
    'setDrawConfig',
    'resetDrawConfig',
    'createDrawAnnotation',
    'setDrawColor',
    'setDrawBrushSize',
    'setDrawSubMode',
    'setEraserConfig',
    'resetEraserConfig',
    'commitEraserStroke',
    'updateSelectedAnnotation',
    'updateAnnotation',
    'removeSelectedAnnotation',
    'removeAllAnnotations',
    'deleteSelectedObject',
    'mergeAnnotations',
    'bringSelectedObjectForward',
    'sendSelectedObjectBackward',
    'bringSelectedObjectToFront',
    'sendSelectedObjectToBack',
    'enterCropMode',
    'setCropAspectRatio',
    'applyCrop',
    'cancelCrop',
    'enterMosaicMode',
    'exitMosaicMode',
    'applyMosaic',
    'setMosaicConfig',
    'resetMosaicConfig',
    'setMosaicBrushSize',
    'setMosaicBlockSize',
    'undo',
    'redo',
    'exportImageBase64',
    'exportImageFile',
    'downloadImage',
    'dispose',
]);

export function getActiveToolMode(snapshot: EditorToolModeSnapshot): EditorToolMode | null {
    if (snapshot.hasCropSession) return 'crop';
    if (snapshot.hasMosaicSession) return 'mosaic';
    if (snapshot.hasTextSession) return 'text';
    if (snapshot.hasDrawSession) return 'draw';
    if (snapshot.hasShapeSession) return 'shape';
    return null;
}

export function isToolModeActive(snapshot: EditorToolModeSnapshot): boolean {
    return getActiveToolMode(snapshot) !== null;
}

export function getAllowedOperationsForToolMode(mode: EditorToolMode): ReadonlySet<string> {
    return TOOL_MODE_ALLOWED_OPERATIONS[mode];
}

export function canRunOperationInToolMode(
    activeMode: EditorToolMode | null,
    operationName: string,
): boolean {
    return !activeMode || getAllowedOperationsForToolMode(activeMode).has(operationName);
}

export function isImageEditorOperation(value: string | null): value is ImageEditorOperation {
    return value !== null && IMAGE_EDITOR_OPERATIONS.has(value as ImageEditorOperation);
}
