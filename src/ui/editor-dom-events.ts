/**
 * DOM event binding for ImageEditor controls.
 *
 * This module maps canonical element keys to UI event listeners and delegates
 * the resulting actions through an explicit command surface.
 */

import type { ElementKey } from '../core/editor-elements.js';
import type {
    ImageFilterConfig,
    ShapeAnnotationConfig,
    ShapeAnnotationKind,
} from '../core/public-types.js';
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
    setImageFilterConfig(config: Partial<ImageFilterConfig>): void;
    resetImageFilterConfig(): void;
    clearImageFilters(): void;
    commitImageFilters(): void;

    createMask(): void;
    removeSelectedMask(): void;
    removeAllMasks(): void;
    mergeMasks(): MaybePromise;

    mergeAnnotations(): MaybePromise;
    enterTextMode(): void;
    exitTextMode(): void;
    enterDrawMode(): void;
    exitDrawMode(): void;
    createShapeAnnotation(): void;
    enterShapeMode(shape: ShapeAnnotationKind): void;
    exitShapeMode(): void;
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
    setDrawSubMode(mode: 'brush' | 'erase'): void;
    setEraserBrushSize(size: number): void;

    setShapeConfig(config: ShapeAnnotationConfig): void;
}

export interface EditorDomEventContext {
    bindings: DomBindings;
    rotationStep: number;
    getInputValue(key: ElementKey): string;
    actions: EditorDomEventActions;
}

function bindElement(
    context: EditorDomEventContext,
    key: ElementKey,
    eventType: string,
    handler: EventListener,
): void {
    context.bindings.bindIfExists(key, eventType, handler);
}

function parseInputNumber(context: EditorDomEventContext, key: ElementKey): number {
    return parseFloat(context.getInputValue(key));
}

function parseEventInputNumber(event: Event): number {
    return parseFloat((event.target as HTMLInputElement).value);
}

function handleAsyncAction(
    context: EditorDomEventContext,
    operation: string,
    action: () => MaybePromise,
): void {
    try {
        void Promise.resolve(action()).catch((error) => {
            context.actions.reportAsyncActionError(operation, error);
        });
    } catch (error) {
        context.actions.reportAsyncActionError(operation, error);
    }
}

function getEventInputValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
}

function getEventInputChecked(event: Event): boolean {
    return (event.target as HTMLInputElement).checked;
}

function parseShapeKind(value: string): ShapeAnnotationKind {
    return value === 'line' || value === 'arrow' ? value : 'rect';
}

function bindUploadEvents(context: EditorDomEventContext): void {
    bindElement(context, 'uploadArea', 'click', () => {
        context.actions.openImagePicker();
    });

    bindElement(context, 'imageInput', 'change', (event) => {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (file) {
            handleAsyncAction(context, 'loadImageFile', () => context.actions.loadImageFile(file));
        }
    });
}

function bindImageFilterEvents(context: EditorDomEventContext): void {
    bindNumberInput(context, 'imageBrightnessInput', (value) => {
        context.actions.setImageFilterConfig({ brightness: value });
    });
    bindNumberInput(context, 'imageContrastInput', (value) => {
        context.actions.setImageFilterConfig({ contrast: value });
    });
    bindNumberInput(context, 'imageSaturationInput', (value) => {
        context.actions.setImageFilterConfig({ saturation: value });
    });
    bindNumberInput(context, 'imageBlurInput', (value) => {
        context.actions.setImageFilterConfig({ blur: value });
    });
    bindNumberInput(context, 'imageSharpenInput', (value) => {
        context.actions.setImageFilterConfig({ sharpen: value });
    });
    bindBooleanInput(context, 'imageGrayscaleInput', (value) => {
        context.actions.setImageFilterConfig({ grayscale: value });
    });
    bindBooleanInput(context, 'imageSepiaInput', (value) => {
        context.actions.setImageFilterConfig({ sepia: value });
    });
    bindBooleanInput(context, 'imageVintageInput', (value) => {
        context.actions.setImageFilterConfig({ vintage: value });
    });
    bindElement(context, 'applyImageFiltersButton', 'click', () => {
        context.actions.commitImageFilters();
    });
    bindElement(context, 'resetImageFiltersButton', 'click', () => {
        context.actions.resetImageFilterConfig();
    });
    bindElement(context, 'clearImageFiltersButton', 'click', () => {
        context.actions.clearImageFilters();
    });
}

function bindTransformEvents(context: EditorDomEventContext): void {
    bindElement(context, 'zoomInButton', 'click', () => {
        handleAsyncAction(context, 'zoomIn', () => context.actions.zoomIn());
    });
    bindElement(context, 'zoomOutButton', 'click', () => {
        handleAsyncAction(context, 'zoomOut', () => context.actions.zoomOut());
    });
    bindElement(context, 'resetImageTransformButton', 'click', () => {
        handleAsyncAction(context, 'resetImageTransform', () =>
            context.actions.resetImageTransform(),
        );
    });
    bindElement(context, 'flipHorizontalButton', 'click', () => {
        handleAsyncAction(context, 'flipHorizontal', () => context.actions.flipHorizontal());
    });
    bindElement(context, 'flipVerticalButton', 'click', () => {
        handleAsyncAction(context, 'flipVertical', () => context.actions.flipVertical());
    });

    bindElement(context, 'rotateLeftButton', 'click', () => {
        const parsedStep = parseInputNumber(context, 'rotateLeftDegreesInput');
        const step = Number.isNaN(parsedStep) ? context.rotationStep : parsedStep;
        handleAsyncAction(context, 'rotateLeft', () => context.actions.rotateLeft(step));
    });
    bindElement(context, 'rotateRightButton', 'click', () => {
        const parsedStep = parseInputNumber(context, 'rotateRightDegreesInput');
        const step = Number.isNaN(parsedStep) ? context.rotationStep : parsedStep;
        handleAsyncAction(context, 'rotateRight', () => context.actions.rotateRight(step));
    });
}

function bindMaskEvents(context: EditorDomEventContext): void {
    bindElement(context, 'createMaskButton', 'click', () => {
        context.actions.createMask();
    });
    bindElement(context, 'removeSelectedMaskButton', 'click', () => {
        context.actions.removeSelectedMask();
    });
    bindElement(context, 'removeAllMasksButton', 'click', () => {
        context.actions.removeAllMasks();
    });
    bindElement(context, 'mergeMasksButton', 'click', () => {
        handleAsyncAction(context, 'mergeMasks', () => context.actions.mergeMasks());
    });
}

function bindAnnotationEvents(context: EditorDomEventContext): void {
    bindElement(context, 'mergeAnnotationsButton', 'click', () => {
        handleAsyncAction(context, 'mergeAnnotations', () => context.actions.mergeAnnotations());
    });
    bindElement(context, 'enterTextModeButton', 'click', () => {
        context.actions.enterTextMode();
    });
    bindElement(context, 'exitTextModeButton', 'click', () => {
        context.actions.exitTextMode();
    });
    bindElement(context, 'enterDrawModeButton', 'click', () => {
        context.actions.enterDrawMode();
    });
    bindElement(context, 'exitDrawModeButton', 'click', () => {
        context.actions.exitDrawMode();
    });
    bindElement(context, 'createShapeAnnotationButton', 'click', () => {
        context.actions.createShapeAnnotation();
    });
    bindElement(context, 'enterShapeModeButton', 'click', () => {
        context.actions.enterShapeMode(parseShapeKind(context.getInputValue('shapeKindSelect')));
    });
    bindElement(context, 'exitShapeModeButton', 'click', () => {
        context.actions.exitShapeMode();
    });
    bindElement(context, 'removeSelectedAnnotationButton', 'click', () => {
        context.actions.removeSelectedAnnotation();
    });
    bindElement(context, 'removeAllAnnotationsButton', 'click', () => {
        context.actions.removeAllAnnotations();
    });
    bindElement(context, 'deleteSelectedObjectButton', 'click', () => {
        context.actions.deleteSelectedObject();
    });
    bindElement(context, 'bringSelectedObjectForwardButton', 'click', () => {
        context.actions.bringSelectedObjectForward();
    });
    bindElement(context, 'sendSelectedObjectBackwardButton', 'click', () => {
        context.actions.sendSelectedObjectBackward();
    });
    bindElement(context, 'bringSelectedObjectToFrontButton', 'click', () => {
        context.actions.bringSelectedObjectToFront();
    });
    bindElement(context, 'sendSelectedObjectToBackButton', 'click', () => {
        context.actions.sendSelectedObjectToBack();
    });

    bindStringInput(context, 'textColorInput', (value) => {
        context.actions.setTextColor(value);
    });
    bindNumberInput(context, 'textFontSizeInput', (value) => {
        context.actions.setTextFontSize(value);
    });
    bindStringInput(context, 'drawColorInput', (value) => {
        context.actions.setDrawColor(value);
    });
    bindNumberInput(context, 'drawBrushSizeInput', (value) => {
        context.actions.setDrawBrushSize(value);
    });
    bindElement(context, 'drawBrushSubModeButton', 'click', () => {
        context.actions.setDrawSubMode('brush');
    });
    bindElement(context, 'drawEraseSubModeButton', 'click', () => {
        context.actions.setDrawSubMode('erase');
    });
    bindNumberInput(context, 'eraserBrushSizeInput', (value) => {
        context.actions.setEraserBrushSize(value);
    });
    bindStringInput(context, 'shapeKindSelect', (value) => {
        context.actions.setShapeConfig({ shape: parseShapeKind(value) });
    });
    bindStringInput(context, 'shapeStrokeInput', (value) => {
        context.actions.setShapeConfig({ stroke: value });
    });
    bindNumberInput(context, 'shapeStrokeWidthInput', (value) => {
        context.actions.setShapeConfig({ strokeWidth: value });
    });
    bindStringInput(context, 'shapeFillInput', (value) => {
        context.actions.setShapeConfig({ fill: value });
    });
}

function bindHistoryEvents(context: EditorDomEventContext): void {
    bindElement(context, 'downloadImageButton', 'click', () => {
        handleAsyncAction(context, 'downloadImage', () => context.actions.downloadImage());
    });
    bindElement(context, 'undoButton', 'click', () => {
        handleAsyncAction(context, 'undo', () => context.actions.undo());
    });
    bindElement(context, 'redoButton', 'click', () => {
        handleAsyncAction(context, 'redo', () => context.actions.redo());
    });
}

function bindCropEvents(context: EditorDomEventContext): void {
    bindElement(context, 'enterCropModeButton', 'click', () => {
        context.actions.enterCropMode();
    });
    bindElement(context, 'cropAspectRatioSelect', 'change', () => {
        context.actions.updateSelectedCropAspectRatio();
    });
    bindElement(context, 'applyCropButton', 'click', () => {
        void context.actions.applyCrop().catch((error) => {
            context.actions.reportCropApplyError(error);
        });
    });
    bindElement(context, 'cancelCropButton', 'click', () => {
        context.actions.cancelCrop();
    });
}

function bindMosaicEvents(context: EditorDomEventContext): void {
    bindElement(context, 'enterMosaicModeButton', 'click', () => {
        context.actions.enterMosaicMode();
    });
    bindElement(context, 'exitMosaicModeButton', 'click', () => {
        context.actions.exitMosaicMode();
    });

    bindNumberInput(context, 'mosaicBrushSizeInput', (value) => {
        context.actions.setMosaicBrushSize(value);
    });
    bindNumberInput(context, 'mosaicBlockSizeInput', (value) => {
        context.actions.setMosaicBlockSize(value);
    });
}

function bindStringInput(
    context: EditorDomEventContext,
    key:
        | 'textColorInput'
        | 'drawColorInput'
        | 'shapeKindSelect'
        | 'shapeStrokeInput'
        | 'shapeFillInput',
    applyValue: (value: string) => void,
): void {
    let lastAppliedValue: string | null = null;
    const handler: EventListener = (event) => {
        const value = getEventInputValue(event);
        if (value === lastAppliedValue) return;
        lastAppliedValue = value;
        applyValue(value);
    };
    bindElement(context, key, 'input', handler);
    bindElement(context, key, 'change', handler);
}

function bindNumberInput(
    context: EditorDomEventContext,
    key:
        | 'mosaicBrushSizeInput'
        | 'mosaicBlockSizeInput'
        | 'textFontSizeInput'
        | 'drawBrushSizeInput'
        | 'imageBrightnessInput'
        | 'imageContrastInput'
        | 'imageSaturationInput'
        | 'imageBlurInput'
        | 'imageSharpenInput'
        | 'eraserBrushSizeInput'
        | 'shapeStrokeWidthInput',
    applyValue: (value: number) => void,
): void {
    let lastAppliedValue: number | null = null;
    const handler: EventListener = (event) => {
        const value = parseEventInputNumber(event);
        if (lastAppliedValue !== null && Object.is(value, lastAppliedValue)) return;
        lastAppliedValue = value;
        applyValue(value);
    };
    bindElement(context, key, 'input', handler);
    bindElement(context, key, 'change', handler);
}

function bindBooleanInput(
    context: EditorDomEventContext,
    key: 'imageGrayscaleInput' | 'imageSepiaInput' | 'imageVintageInput',
    applyValue: (value: boolean) => void,
): void {
    let lastAppliedValue: boolean | null = null;
    const handler: EventListener = (event) => {
        const value = getEventInputChecked(event);
        if (lastAppliedValue !== null && value === lastAppliedValue) return;
        lastAppliedValue = value;
        applyValue(value);
    };
    bindElement(context, key, 'input', handler);
    bindElement(context, key, 'change', handler);
}

export function bindEditorDomEvents(context: EditorDomEventContext): void {
    bindUploadEvents(context);
    bindImageFilterEvents(context);
    bindTransformEvents(context);
    bindMaskEvents(context);
    bindAnnotationEvents(context);
    bindHistoryEvents(context);
    bindCropEvents(context);
    bindMosaicEvents(context);
}
