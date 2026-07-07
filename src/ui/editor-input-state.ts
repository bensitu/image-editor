/**
 * Input value synchronization for editor toolbar controls.
 *
 * The sync logic avoids overwriting focused editable inputs while keeping
 * scale, image filters, Mosaic, Text, Draw, eraser, and Shape controls
 * aligned with runtime state.
 */

import type {
    DrawSubMode,
    ResolvedEraserConfig,
    ResolvedDrawConfig,
    ResolvedImageFilterConfig,
    ResolvedMosaicConfig,
    ResolvedShapeAnnotationConfig,
    ResolvedTextAnnotationConfig,
} from '../core/public-types.js';
import type { ElementKey } from '../core/editor-elements.js';

type EditorValueKey =
    | 'scalePercentageInput'
    | 'imageBrightnessInput'
    | 'imageContrastInput'
    | 'imageSaturationInput'
    | 'imageBlurInput'
    | 'imageSharpenInput'
    | 'mosaicBrushSizeInput'
    | 'mosaicBlockSizeInput'
    | 'textColorInput'
    | 'textFontSizeInput'
    | 'drawColorInput'
    | 'drawBrushSizeInput'
    | 'eraserBrushSizeInput'
    | 'shapeKindSelect'
    | 'shapeStrokeInput'
    | 'shapeStrokeWidthInput'
    | 'shapeFillInput';

type EditorCheckedKey = 'imageGrayscaleInput' | 'imageSepiaInput' | 'imageVintageInput';

type EditorToggleButtonKey = 'drawBrushSubModeButton' | 'drawEraseSubModeButton';

export interface EditorInputSnapshot {
    currentScale: number;
    imageFilterConfig: Readonly<ResolvedImageFilterConfig>;
    mosaicConfig: Readonly<ResolvedMosaicConfig>;
    textConfig: Readonly<ResolvedTextAnnotationConfig>;
    drawConfig: Readonly<ResolvedDrawConfig>;
    drawSubMode: DrawSubMode | null;
    eraserConfig: Readonly<ResolvedEraserConfig>;
    shapeConfig: Readonly<ResolvedShapeAnnotationConfig>;
}

export type EditorInputResolver = (key: ElementKey) => HTMLElement | null;

function isValueControl(
    element: HTMLElement | null,
): element is HTMLInputElement | HTMLSelectElement {
    return !!element && 'value' in element;
}

function isCheckedInput(element: HTMLElement | null): element is HTMLInputElement {
    return !!element && 'checked' in element;
}

function isReadOnlyControl(element: HTMLInputElement | HTMLSelectElement): boolean {
    return 'readOnly' in element && element.readOnly;
}

function syncInputValue(element: HTMLElement | null, value: string): void {
    if (!isValueControl(element)) return;
    const ownerDocument = element.ownerDocument;
    if (ownerDocument.activeElement === element && !isReadOnlyControl(element)) return;
    if (element.value !== value) element.value = value;
}

function syncInputChecked(element: HTMLElement | null, checked: boolean): void {
    if (!isCheckedInput(element)) return;
    if (element.checked !== checked) element.checked = checked;
}

function syncToggleButton(element: HTMLElement | null, pressed: boolean): void {
    if (!element) return;
    const next = pressed ? 'true' : 'false';
    if (element.getAttribute('aria-pressed') !== next) {
        element.setAttribute('aria-pressed', next);
    }
}

function syncValue(getElement: EditorInputResolver, key: EditorValueKey, value: string): void {
    syncInputValue(getElement(key), value);
}

function syncChecked(
    getElement: EditorInputResolver,
    key: EditorCheckedKey,
    checked: boolean,
): void {
    syncInputChecked(getElement(key), checked);
}

function syncPressed(
    getElement: EditorInputResolver,
    key: EditorToggleButtonKey,
    pressed: boolean,
): void {
    syncToggleButton(getElement(key), pressed);
}

export function applyEditorInputState(
    snapshot: EditorInputSnapshot,
    getElement: EditorInputResolver,
): void {
    syncValue(getElement, 'scalePercentageInput', String(Math.round(snapshot.currentScale * 100)));
    syncValue(getElement, 'imageBrightnessInput', String(snapshot.imageFilterConfig.brightness));
    syncValue(getElement, 'imageContrastInput', String(snapshot.imageFilterConfig.contrast));
    syncValue(getElement, 'imageSaturationInput', String(snapshot.imageFilterConfig.saturation));
    syncValue(getElement, 'imageBlurInput', String(snapshot.imageFilterConfig.blur));
    syncValue(getElement, 'imageSharpenInput', String(snapshot.imageFilterConfig.sharpen));
    syncChecked(getElement, 'imageGrayscaleInput', snapshot.imageFilterConfig.grayscale);
    syncChecked(getElement, 'imageSepiaInput', snapshot.imageFilterConfig.sepia);
    syncChecked(getElement, 'imageVintageInput', snapshot.imageFilterConfig.vintage);
    syncValue(getElement, 'mosaicBrushSizeInput', String(snapshot.mosaicConfig.brushSize));
    syncValue(getElement, 'mosaicBlockSizeInput', String(snapshot.mosaicConfig.blockSize));
    syncValue(getElement, 'textColorInput', snapshot.textConfig.fill);
    syncValue(getElement, 'textFontSizeInput', String(snapshot.textConfig.fontSize));
    syncValue(getElement, 'drawColorInput', snapshot.drawConfig.color);
    syncValue(getElement, 'drawBrushSizeInput', String(snapshot.drawConfig.brushSize));
    syncPressed(getElement, 'drawBrushSubModeButton', snapshot.drawSubMode === 'brush');
    syncPressed(getElement, 'drawEraseSubModeButton', snapshot.drawSubMode === 'erase');
    syncValue(getElement, 'eraserBrushSizeInput', String(snapshot.eraserConfig.brushSize));
    syncValue(getElement, 'shapeKindSelect', snapshot.shapeConfig.shape);
    syncValue(getElement, 'shapeStrokeInput', snapshot.shapeConfig.stroke);
    syncValue(getElement, 'shapeStrokeWidthInput', String(snapshot.shapeConfig.strokeWidth));
    syncValue(getElement, 'shapeFillInput', snapshot.shapeConfig.fill);
}
