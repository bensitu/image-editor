import * as fabric from 'fabric';
import {
    ImageEditor,
    type AnnotationObject,
    type CropModeOptions,
    type DrawConfig,
    type EditorToolMode,
    type ImageEditorCallbackContext,
    type ImageEditorOptions,
    type ImageEditorSelection,
    type ImageEditorState,
    type ImageExportOptions,
    type ImageInfo,
    type MaskConfig,
    type MaskObject,
    type TextAnnotationConfig,
} from '@bensitu/image-editor';
import { createFixtureDataUrl, type FixtureName } from '../fixtures/images';

type CallbackName =
    | 'onImageLoadStart'
    | 'onImageLoaded'
    | 'onImageCleared'
    | 'onImageChanged'
    | 'onBusyChange'
    | 'onToolModeChange'
    | 'onHistoryChange'
    | 'onEditorDisposed'
    | 'onMasksChanged'
    | 'onAnnotationsChanged'
    | 'onSelectionChange'
    | 'onError'
    | 'onWarning';

export type CallbackRecord = {
    name: CallbackName;
    operation: string | null;
    isInternalOperation: boolean;
    activeToolMode?: EditorToolMode | null;
    previousToolMode?: EditorToolMode | null;
    history?: { canUndo: boolean; canRedo: boolean };
    state?: ImageEditorState;
    imageInfo?: ImageInfo | null;
    isBusy?: boolean;
    maskCount?: number;
    annotationCount?: number;
    selection?: SelectionSummary;
    message?: string;
    errorName?: string;
};

export type MaskSummary = {
    maskId: number;
    maskName: string;
    left: number | null;
    top: number | null;
    width: number | null;
    height: number | null;
    opacity: number | null;
};

export type AnnotationSummary = {
    annotationId: number;
    annotationName: string;
    annotationType: string;
    left: number | null;
    top: number | null;
};

export type SelectionSummary = {
    selectedObjectKind: 'mask' | 'annotation' | null;
    selectedMaskId: number | null;
    selectedMaskIds: number[];
    selectedAnnotationId: number | null;
    selectedAnnotationIds: number[];
};

export type ExportPreviewResult = {
    dataUrl: string;
    width: number;
    height: number;
};

export type HarnessCreateOptions = {
    editorOptions?: ImageEditorOptions;
    throwingCallbacks?: CallbackName[];
};

export type ImageEditorTestHarness = {
    callbacks: CallbackRecord[];
    createEditor(options?: HarnessCreateOptions): void;
    dispose(): void;
    loadFixture(name: FixtureName): Promise<void>;
    loadInvalidImage(): Promise<void>;
    loadBrokenPng(): Promise<void>;
    createMask(config?: MaskConfig): MaskSummary | null;
    removeSelectedMask(): void;
    createTextAnnotation(config?: TextAnnotationConfig): AnnotationSummary | null;
    enterCropMode(options?: CropModeOptions): void;
    setCropAspectRatio(aspectRatio: NonNullable<CropModeOptions['aspectRatio']>): void;
    applyCrop(): Promise<void>;
    cancelCrop(): void;
    enterMosaicMode(): void;
    exitMosaicMode(): void;
    setMosaicConfig(config: { brushSize?: number; blockSize?: number }): void;
    setDrawConfig(config: DrawConfig): void;
    enterDrawMode(): void;
    exitDrawMode(): void;
    undo(): Promise<void>;
    redo(): Promise<void>;
    exportImageBase64(options?: ImageExportOptions): Promise<string>;
    exportToPreview(options?: ImageExportOptions): Promise<ExportPreviewResult>;
    getState(): ImageEditorState;
    getImageInfo(): ImageInfo | null;
    getMasks(): MaskSummary[];
    getAnnotations(): AnnotationSummary[];
    getSelection(): SelectionSummary;
    getActiveToolMode(): EditorToolMode | null;
    isBusy(): boolean;
    isProcessing(): boolean;
    getCallbackRecords(): CallbackRecord[];
    clearCallbacks(): void;
};

declare global {
    interface Window {
        __imageEditorTest: ImageEditorTestHarness;
    }
}

let editor: ImageEditor | null = null;
let throwingCallbacks = new Set<CallbackName>();
const callbacks: CallbackRecord[] = [];

function requireElement<T extends HTMLElement>(id: string, constructor: new () => T): T {
    const element = document.getElementById(id);
    if (!(element instanceof constructor)) {
        throw new Error(`Missing #${id} test harness element.`);
    }
    return element;
}

function getCanvasElement(): HTMLCanvasElement {
    return requireElement('editor-canvas', HTMLCanvasElement);
}

function getExportPreviewElement(): HTMLImageElement {
    return requireElement('export-preview', HTMLImageElement);
}

function summarizeContext(context?: ImageEditorCallbackContext | null): {
    operation: string | null;
    isInternalOperation: boolean;
} {
    return {
        operation: context?.operation ?? null,
        isInternalOperation: context?.isInternalOperation === true,
    };
}

function numericValue(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function summarizeMask(mask: MaskObject): MaskSummary {
    return {
        maskId: mask.maskId,
        maskName: mask.maskName,
        left: numericValue(mask.left),
        top: numericValue(mask.top),
        width: numericValue(mask.width),
        height: numericValue(mask.height),
        opacity: numericValue(mask.opacity),
    };
}

function summarizeAnnotation(annotation: AnnotationObject): AnnotationSummary {
    return {
        annotationId: annotation.annotationId,
        annotationName: annotation.annotationName,
        annotationType: annotation.annotationType,
        left: numericValue(annotation.left),
        top: numericValue(annotation.top),
    };
}

function summarizeSelection(selection: ImageEditorSelection): SelectionSummary {
    return {
        selectedObjectKind: selection.selectedObjectKind,
        selectedMaskId: selection.selectedMask?.maskId ?? null,
        selectedMaskIds: selection.selectedMasks.map((mask) => mask.maskId),
        selectedAnnotationId: selection.selectedAnnotation?.annotationId ?? null,
        selectedAnnotationIds: selection.selectedAnnotations.map(
            (annotation) => annotation.annotationId,
        ),
    };
}

function recordCallback(record: CallbackRecord): void {
    callbacks.push(record);
    if (throwingCallbacks.has(record.name)) {
        throw new Error(`${record.name} callback failure`);
    }
}

function errorName(error: unknown): string {
    return error instanceof Error ? error.name : typeof error;
}

function createEditorOptions(options: HarnessCreateOptions = {}): ImageEditorOptions {
    return {
        canvasWidth: 320,
        canvasHeight: 240,
        animationDuration: 0,
        defaultLayoutMode: 'expand',
        showPlaceholder: false,
        imageLoadTimeoutMs: 10_000,
        crop: {
            padding: 20,
            minWidth: 20,
            minHeight: 20,
            exportFileType: 'png',
        },
        defaultMosaicConfig: {
            brushSize: 32,
            blockSize: 10,
            outputFileType: 'png',
        },
        defaultTextConfig: {
            text: 'A',
            left: 32,
            top: 32,
            width: 48,
            fontSize: 32,
            fontFamily: 'monospace',
            fill: '#111827',
            backgroundColor: 'rgba(255,255,255,0)',
            enterEditing: false,
        },
        ...options.editorOptions,
        onImageLoadStart(context) {
            recordCallback({ name: 'onImageLoadStart', ...summarizeContext(context) });
        },
        onImageLoaded(imageInfo, context) {
            recordCallback({
                name: 'onImageLoaded',
                ...summarizeContext(context),
                imageInfo,
            });
        },
        onImageCleared(previousImage, context) {
            void previousImage;
            recordCallback({ name: 'onImageCleared', ...summarizeContext(context) });
        },
        onImageChanged(state, context) {
            recordCallback({
                name: 'onImageChanged',
                ...summarizeContext(context),
                state,
            });
        },
        onBusyChange(isBusy, context) {
            recordCallback({
                name: 'onBusyChange',
                ...summarizeContext(context),
                isBusy,
            });
        },
        onToolModeChange(activeToolMode, previousToolMode, context) {
            recordCallback({
                name: 'onToolModeChange',
                ...summarizeContext(context),
                activeToolMode,
                previousToolMode,
            });
        },
        onHistoryChange(history, context) {
            recordCallback({
                name: 'onHistoryChange',
                ...summarizeContext(context),
                history,
            });
        },
        onEditorDisposed(context) {
            recordCallback({ name: 'onEditorDisposed', ...summarizeContext(context) });
        },
        onMasksChanged(masks, context) {
            recordCallback({
                name: 'onMasksChanged',
                ...summarizeContext(context),
                maskCount: masks.length,
            });
        },
        onAnnotationsChanged(annotations, context) {
            recordCallback({
                name: 'onAnnotationsChanged',
                ...summarizeContext(context),
                annotationCount: annotations.length,
            });
        },
        onSelectionChange(selection, context) {
            recordCallback({
                name: 'onSelectionChange',
                ...summarizeContext(context),
                selection: summarizeSelection(selection),
            });
        },
        onError(error, message) {
            recordCallback({
                name: 'onError',
                operation: null,
                isInternalOperation: false,
                message,
                errorName: errorName(error),
            });
        },
        onWarning(error, message) {
            recordCallback({
                name: 'onWarning',
                operation: null,
                isInternalOperation: false,
                message,
                errorName: errorName(error),
            });
        },
    };
}

function ensureEditor(): ImageEditor {
    if (!editor) {
        throw new Error('ImageEditor test harness has not been initialized.');
    }
    return editor;
}

function createEditor(options: HarnessCreateOptions = {}): void {
    editor?.dispose();
    callbacks.length = 0;
    throwingCallbacks = new Set(options.throwingCallbacks ?? []);
    editor = new ImageEditor(fabric, createEditorOptions(options));
    editor.init({
        canvas: getCanvasElement(),
        canvasContainer: requireElement('canvas-container', HTMLDivElement),
        imagePlaceholder: requireElement('image-placeholder', HTMLDivElement),
        maskList: requireElement('mask-list', HTMLUListElement),
        annotationList: requireElement('annotation-list', HTMLUListElement),
    });
}

function dispose(): void {
    editor?.dispose();
}

async function loadFixture(name: FixtureName): Promise<void> {
    await ensureEditor().loadImage(createFixtureDataUrl(name));
}

async function loadInvalidImage(): Promise<void> {
    await ensureEditor().loadImage('not-a-data-url');
}

async function loadBrokenPng(): Promise<void> {
    await ensureEditor().loadImage('data:image/png;base64,not-valid-image-data');
}

function createMask(config: MaskConfig = {}): MaskSummary | null {
    const mask = ensureEditor().createMask(config);
    return mask ? summarizeMask(mask) : null;
}

function removeSelectedMask(): void {
    ensureEditor().removeSelectedMask();
}

function createTextAnnotation(config: TextAnnotationConfig = {}): AnnotationSummary | null {
    const annotation = ensureEditor().createTextAnnotation(config);
    return annotation ? summarizeAnnotation(annotation) : null;
}

function enterCropMode(options: CropModeOptions = {}): void {
    ensureEditor().enterCropMode(options);
}

function setCropAspectRatio(aspectRatio: NonNullable<CropModeOptions['aspectRatio']>): void {
    ensureEditor().setCropAspectRatio(aspectRatio);
}

async function applyCrop(): Promise<void> {
    await ensureEditor().applyCrop();
}

function cancelCrop(): void {
    ensureEditor().cancelCrop();
}

function enterMosaicMode(): void {
    ensureEditor().enterMosaicMode();
}

function exitMosaicMode(): void {
    ensureEditor().exitMosaicMode();
}

function setMosaicConfig(config: { brushSize?: number; blockSize?: number }): void {
    ensureEditor().setMosaicConfig(config);
}

function setDrawConfig(config: DrawConfig): void {
    ensureEditor().setDrawConfig(config);
}

function enterDrawMode(): void {
    ensureEditor().enterDrawMode();
}

function exitDrawMode(): void {
    ensureEditor().exitDrawMode();
}

async function undo(): Promise<void> {
    await ensureEditor().undo();
}

async function redo(): Promise<void> {
    await ensureEditor().redo();
}

async function exportImageBase64(options: ImageExportOptions = {}): Promise<string> {
    return await ensureEditor().exportImageBase64(options);
}

function loadPreview(dataUrl: string): Promise<ExportPreviewResult> {
    const preview = getExportPreviewElement();
    return new Promise((resolve, reject) => {
        preview.onload = () => {
            resolve({
                dataUrl,
                width: preview.naturalWidth,
                height: preview.naturalHeight,
            });
        };
        preview.onerror = () => reject(new Error('Unable to load export preview image.'));
        preview.src = dataUrl;
    });
}

async function exportToPreview(options: ImageExportOptions = {}): Promise<ExportPreviewResult> {
    return await loadPreview(await exportImageBase64(options));
}

function getState(): ImageEditorState {
    return ensureEditor().getEditorState();
}

function getImageInfo(): ImageInfo | null {
    return ensureEditor().getImageInfo();
}

function getMasks(): MaskSummary[] {
    return ensureEditor().getMasks().map(summarizeMask);
}

function getAnnotations(): AnnotationSummary[] {
    return ensureEditor().getAnnotations().map(summarizeAnnotation);
}

function getSelection(): SelectionSummary {
    return summarizeSelection(ensureEditor().getSelection());
}

function getActiveToolMode(): EditorToolMode | null {
    return ensureEditor().getActiveToolMode();
}

function isBusy(): boolean {
    return ensureEditor().isBusy();
}

function isProcessing(): boolean {
    return ensureEditor().isProcessing();
}

function getCallbackRecords(): CallbackRecord[] {
    return callbacks.slice();
}

function clearCallbacks(): void {
    callbacks.length = 0;
}

window.__imageEditorTest = {
    callbacks,
    createEditor,
    dispose,
    loadFixture,
    loadInvalidImage,
    loadBrokenPng,
    createMask,
    removeSelectedMask,
    createTextAnnotation,
    enterCropMode,
    setCropAspectRatio,
    applyCrop,
    cancelCrop,
    enterMosaicMode,
    exitMosaicMode,
    setMosaicConfig,
    setDrawConfig,
    enterDrawMode,
    exitDrawMode,
    undo,
    redo,
    exportImageBase64,
    exportToPreview,
    getState,
    getImageInfo,
    getMasks,
    getAnnotations,
    getSelection,
    getActiveToolMode,
    isBusy,
    isProcessing,
    getCallbackRecords,
    clearCallbacks,
};

createEditor();
window.dispatchEvent(new CustomEvent('image-editor-test-ready'));
