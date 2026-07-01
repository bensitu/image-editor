/**
 * Creates DOM event action handlers for editor controls.
 *
 * The binding layer owns raw DOM events; this module translates them into
 * facade method calls and runtime-derived input values.
 */
import type { CropAspectRatio } from '../core/public-types.js';
import type { EditorRuntime } from '../runtime/editor-runtime.js';
import type { EditorDomEventActions } from './editor-dom-events.js';
export interface EditorDomActionHost {
    reportAsyncActionError(operation: string, error: unknown): void;
    loadImageFile(file: File): Promise<void>;
    scaleImage(scale: number): Promise<void>;
    rotateImage(rotation: number): Promise<void>;
    resetImageTransform(): Promise<void>;
    flipHorizontal(): Promise<void>;
    flipVertical(): Promise<void>;
    createMask(): void;
    removeSelectedMask(): void;
    removeAllMasks(): void;
    mergeMasks(): Promise<void>;
    mergeAnnotations(): Promise<void>;
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
    downloadImage(): Promise<void>;
    undo(): Promise<void>;
    redo(): Promise<void>;
    enterCropMode(options: {
        aspectRatio: CropAspectRatio;
    }): void;
    setCropAspectRatio(aspectRatio: CropAspectRatio): void;
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
export declare function createEditorDomEventActions(runtime: EditorRuntime, ownerDocument: Document, host: EditorDomActionHost): EditorDomEventActions;
