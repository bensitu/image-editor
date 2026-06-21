/**
 * DOM event binding for ImageEditor controls.
 *
 * This module maps canonical element keys to UI event listeners and delegates
 * the resulting actions through an explicit command surface.
 */
import type { ElementKey } from '../core/editor-elements.js';
import type { DomBindings } from './dom-bindings.js';
type MaybePromise<T = void> = T | Promise<T>;
export interface EditorDomEventActions {
    reportAsyncActionError(operation: string, error: unknown): void;
    openImagePicker(): void;
    loadImageFile(file: File): MaybePromise;
    zoomIn(): MaybePromise;
    zoomOut(): MaybePromise;
    resetImageTransform(): MaybePromise;
    flipHorizontal(): MaybePromise;
    flipVertical(): MaybePromise;
    rotateLeft(degrees: number): MaybePromise;
    rotateRight(degrees: number): MaybePromise;
    createMask(): void;
    removeSelectedMask(): void;
    removeAllMasks(): void;
    mergeMasks(): MaybePromise;
    mergeAnnotations(): MaybePromise;
    enterTextMode(): void;
    exitTextMode(): void;
    enterDrawMode(): void;
    exitDrawMode(): void;
    removeSelectedAnnotation(): void;
    removeAllAnnotations(): void;
    deleteSelectedObject(): void;
    bringSelectedObjectForward(): void;
    sendSelectedObjectBackward(): void;
    bringSelectedObjectToFront(): void;
    sendSelectedObjectToBack(): void;
    downloadImage(): MaybePromise;
    undo(): MaybePromise;
    redo(): MaybePromise;
    enterCropMode(): void;
    updateSelectedCropAspectRatio(): void;
    applyCrop(): Promise<void>;
    reportCropApplyError(error: unknown): void;
    cancelCrop(): void;
    enterMosaicMode(): void;
    exitMosaicMode(): void;
    setMosaicBrushSize(size: number): void;
    setMosaicBlockSize(size: number): void;
    setTextColor(color: string): void;
    setTextFontSize(size: number): void;
    setDrawColor(color: string): void;
    setDrawBrushSize(size: number): void;
}
export interface EditorDomEventContext {
    bindings: DomBindings;
    rotationStep: number;
    getInputValue(key: ElementKey): string;
    actions: EditorDomEventActions;
}
export declare function bindEditorDomEvents(context: EditorDomEventContext): void;
export {};
//# sourceMappingURL=editor-dom-events.d.ts.map