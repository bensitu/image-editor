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
export declare function applyEditorControlState(snapshot: EditorControlSnapshot, setEnabled: ControlEnabler): void;
