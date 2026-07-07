/**
 * Creates DOM event action handlers for editor controls.
 *
 * The binding layer owns raw DOM events; this module translates them into
 * facade method calls and runtime-derived input values.
 */

import {
    isInputElement,
    isInputOrSelectElement,
    resolveDomElement,
} from '../core/editor-elements.js';
import type {
    CropAspectRatio,
    ImageFilterConfig,
    ShapeAnnotationConfig,
    ShapeAnnotationKind,
} from '../core/public-types.js';
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
    setImageFilterConfig(config: Partial<ImageFilterConfig>): void;
    resetImageFilterConfig(): void;
    clearImageFilters(): void;
    commitImageFilters(): void;
    createMask(): void;
    removeSelectedMask(): void;
    removeAllMasks(): void;
    mergeMasks(): Promise<void>;
    mergeAnnotations(): Promise<void>;
    enterTextMode(): void;
    exitTextMode(): void;
    enterDrawMode(): void;
    exitDrawMode(): void;
    createShapeAnnotation(config?: ShapeAnnotationConfig): void;
    enterShapeMode(shape: ShapeAnnotationKind): void;
    exitShapeMode(): void;
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
    enterCropMode(options: { aspectRatio: CropAspectRatio }): void;
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
    setDrawSubMode(mode: 'brush' | 'erase'): void;
    setEraserConfig(config: { brushSize: number }): void;
    setShapeConfig(config: ShapeAnnotationConfig): void;
}

function normalizeStepScale(value: number): number {
    const rounded = Math.round(value * 1_000_000) / 1_000_000;
    return Number.isFinite(rounded) ? rounded : 1;
}

export function createEditorDomEventActions(
    runtime: EditorRuntime,
    ownerDocument: Document,
    host: EditorDomActionHost,
): EditorDomEventActions {
    return {
        reportAsyncActionError: (operation, error) => {
            host.reportAsyncActionError(operation, error);
        },
        openImagePicker: () => {
            resolveDomElement<HTMLInputElement>(
                runtime.elements.imageInput,
                ownerDocument,
                isInputElement,
            )?.click();
        },
        loadImageFile: (file) => host.loadImageFile(file),
        zoomIn: () =>
            host.scaleImage(normalizeStepScale(runtime.currentScale + runtime.options.scaleStep)),
        zoomOut: () =>
            host.scaleImage(normalizeStepScale(runtime.currentScale - runtime.options.scaleStep)),
        resetImageTransform: () => host.resetImageTransform(),
        flipHorizontal: () => host.flipHorizontal(),
        flipVertical: () => host.flipVertical(),
        rotateLeft: (degrees) => host.rotateImage(runtime.currentRotation - degrees),
        rotateRight: (degrees) => host.rotateImage(runtime.currentRotation + degrees),
        setImageFilterConfig: (config) => {
            host.setImageFilterConfig(config);
        },
        resetImageFilterConfig: () => {
            host.resetImageFilterConfig();
        },
        clearImageFilters: () => {
            host.clearImageFilters();
        },
        commitImageFilters: () => {
            host.commitImageFilters();
        },
        createMask: () => {
            host.createMask();
        },
        removeSelectedMask: () => {
            host.removeSelectedMask();
        },
        removeAllMasks: () => {
            host.removeAllMasks();
        },
        mergeMasks: () => host.mergeMasks(),
        mergeAnnotations: () => host.mergeAnnotations(),
        enterTextMode: () => {
            host.enterTextMode();
        },
        exitTextMode: () => {
            host.exitTextMode();
        },
        enterDrawMode: () => {
            host.enterDrawMode();
        },
        exitDrawMode: () => {
            host.exitDrawMode();
        },
        createShapeAnnotation: () => {
            host.createShapeAnnotation();
        },
        enterShapeMode: (shape) => {
            host.enterShapeMode(shape);
        },
        exitShapeMode: () => {
            host.exitShapeMode();
        },
        removeSelectedAnnotation: () => {
            host.removeSelectedAnnotation();
        },
        removeAllAnnotations: () => {
            host.removeAllAnnotations();
        },
        deleteSelectedObject: () => {
            host.deleteSelectedObject();
        },
        bringSelectedObjectForward: () => {
            host.bringSelectedObjectForward();
        },
        sendSelectedObjectBackward: () => {
            host.sendSelectedObjectBackward();
        },
        bringSelectedObjectToFront: () => {
            host.bringSelectedObjectToFront();
        },
        sendSelectedObjectToBack: () => {
            host.sendSelectedObjectToBack();
        },
        downloadImage: () => host.downloadImage(),
        undo: () => host.undo(),
        redo: () => host.redo(),
        enterCropMode: () => {
            host.enterCropMode({ aspectRatio: getSelectedCropAspectRatio(runtime, ownerDocument) });
        },
        updateSelectedCropAspectRatio: () => {
            if (runtime.cropSession) {
                host.setCropAspectRatio(getSelectedCropAspectRatio(runtime, ownerDocument));
            }
        },
        applyCrop: () => host.applyCrop(),
        reportCropApplyError: (error) => {
            host.reportCropApplyError(error);
        },
        cancelCrop: () => {
            host.cancelCrop();
        },
        enterMosaicMode: () => {
            host.enterMosaicMode();
        },
        exitMosaicMode: () => {
            host.exitMosaicMode();
        },
        setMosaicBrushSize: (size) => {
            host.setMosaicBrushSize(size);
        },
        setMosaicBlockSize: (size) => {
            host.setMosaicBlockSize(size);
        },
        setTextColor: (color) => {
            host.setTextColor(color);
        },
        setTextFontSize: (size) => {
            host.setTextFontSize(size);
        },
        setDrawColor: (color) => {
            host.setDrawColor(color);
        },
        setDrawBrushSize: (size) => {
            host.setDrawBrushSize(size);
        },
        setDrawSubMode: (mode) => {
            host.setDrawSubMode(mode);
        },
        setEraserBrushSize: (size) => {
            host.setEraserConfig({ brushSize: size });
        },
        setShapeConfig: (config) => {
            host.setShapeConfig(config);
        },
    };
}

function getSelectedCropAspectRatio(
    runtime: EditorRuntime,
    ownerDocument: Document,
): CropAspectRatio {
    const inputEl = resolveDomElement<HTMLInputElement | HTMLSelectElement>(
        runtime.elements.cropAspectRatioSelect,
        ownerDocument,
        isInputOrSelectElement,
    );
    const value = inputEl && 'value' in inputEl ? String(inputEl.value).trim() : '';
    return (value || 'free') as CropAspectRatio;
}
