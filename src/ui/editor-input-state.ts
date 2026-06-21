/**
 * Input value synchronization for editor toolbar controls.
 *
 * The sync logic avoids overwriting focused editable inputs while keeping
 * scale, Mosaic, Text, and Draw controls aligned with runtime state.
 */

import type {
    ResolvedDrawConfig,
    ResolvedMosaicConfig,
    ResolvedTextAnnotationConfig,
} from '../core/public-types.js';
import type { ElementKey } from '../core/editor-elements.js';

type EditorInputKey =
    | 'scalePercentageInput'
    | 'mosaicBrushSizeInput'
    | 'mosaicBlockSizeInput'
    | 'textColorInput'
    | 'textFontSizeInput'
    | 'drawColorInput'
    | 'drawBrushSizeInput';

export interface EditorInputSnapshot {
    currentScale: number;
    mosaicConfig: Readonly<ResolvedMosaicConfig>;
    textConfig: Readonly<ResolvedTextAnnotationConfig>;
    drawConfig: Readonly<ResolvedDrawConfig>;
}

export type EditorInputResolver = (key: ElementKey) => HTMLInputElement | null;

function syncInputValue(inputElement: HTMLInputElement | null, value: string): void {
    if (!inputElement) return;
    const ownerDocument = inputElement.ownerDocument;
    if (ownerDocument.activeElement === inputElement && !inputElement.readOnly) return;
    if (inputElement.value !== value) inputElement.value = value;
}

function syncInput(getInputElement: EditorInputResolver, key: EditorInputKey, value: string): void {
    syncInputValue(getInputElement(key), value);
}

export function applyEditorInputState(
    snapshot: EditorInputSnapshot,
    getInputElement: EditorInputResolver,
): void {
    syncInput(
        getInputElement,
        'scalePercentageInput',
        String(Math.round(snapshot.currentScale * 100)),
    );
    syncInput(getInputElement, 'mosaicBrushSizeInput', String(snapshot.mosaicConfig.brushSize));
    syncInput(getInputElement, 'mosaicBlockSizeInput', String(snapshot.mosaicConfig.blockSize));
    syncInput(getInputElement, 'textColorInput', snapshot.textConfig.fill);
    syncInput(getInputElement, 'textFontSizeInput', String(snapshot.textConfig.fontSize));
    syncInput(getInputElement, 'drawColorInput', snapshot.drawConfig.color);
    syncInput(getInputElement, 'drawBrushSizeInput', String(snapshot.drawConfig.brushSize));
}
