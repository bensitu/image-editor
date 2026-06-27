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
    void Promise.resolve()
        .then(action)
        .catch((error) => {
            context.actions.reportAsyncActionError(operation, error);
        });
}

function getEventInputValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
}

function bindUploadEvents(context: EditorDomEventContext): void {
    bindElement(context, 'uploadArea', 'click', () => {
        context.actions.openImagePicker();
    });

    bindElement(context, 'imageInput', 'change', (event) => {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (file) void context.actions.loadImageFile(file);
    });
}

function bindTransformEvents(context: EditorDomEventContext): void {
    bindElement(context, 'zoomInButton', 'click', () => {
        void context.actions.zoomIn();
    });
    bindElement(context, 'zoomOutButton', 'click', () => {
        void context.actions.zoomOut();
    });
    bindElement(context, 'resetImageTransformButton', 'click', () => {
        void context.actions.resetImageTransform();
    });
    bindElement(context, 'flipHorizontalButton', 'click', () => {
        void context.actions.flipHorizontal();
    });
    bindElement(context, 'flipVerticalButton', 'click', () => {
        void context.actions.flipVertical();
    });

    bindElement(context, 'rotateLeftButton', 'click', () => {
        const parsedStep = parseInputNumber(context, 'rotateLeftDegreesInput');
        const step = Number.isNaN(parsedStep) ? context.rotationStep : parsedStep;
        void context.actions.rotateLeft(step);
    });
    bindElement(context, 'rotateRightButton', 'click', () => {
        const parsedStep = parseInputNumber(context, 'rotateRightDegreesInput');
        const step = Number.isNaN(parsedStep) ? context.rotationStep : parsedStep;
        void context.actions.rotateRight(step);
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
        void context.actions.mergeMasks();
    });
}

function bindAnnotationEvents(context: EditorDomEventContext): void {
    bindElement(context, 'mergeAnnotationsButton', 'click', () => {
        void context.actions.mergeAnnotations();
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
    key: 'textColorInput' | 'drawColorInput',
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
        | 'drawBrushSizeInput',
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

export function bindEditorDomEvents(context: EditorDomEventContext): void {
    bindUploadEvents(context);
    bindTransformEvents(context);
    bindMaskEvents(context);
    bindAnnotationEvents(context);
    bindHistoryEvents(context);
    bindCropEvents(context);
    bindMosaicEvents(context);
}
