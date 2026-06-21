/**
 * Shared mutable runtime state for the ImageEditor facade.
 *
 * The facade owns this object and passes it to focused action and context
 * builders so state mutation stays centralized while modules remain small.
 */

import type * as FabricNS from 'fabric';

import { AnimationQueue } from '../animation/animation-queue.js';
import {
    cloneResolvedDrawConfig,
    cloneResolvedMosaicConfig,
    cloneResolvedTextAnnotationConfig,
} from '../core/default-options.js';
import type { ElementKey, ResolvedElementIdMap } from '../core/editor-elements.js';
import { OperationGuard } from '../core/operation-guard.js';
import type {
    BaseImageObject,
    FabricModule,
    ImageEditorCallbackContext,
    ImageEditorOperation,
    ImageMimeType,
    LayoutMode,
    MaskObject,
    ResolvedDrawConfig,
    ResolvedMosaicConfig,
    ResolvedOptions,
    ResolvedTextAnnotationConfig,
} from '../core/public-types.js';
import { HistoryManager } from '../history/history-manager.js';
import type { TransformController } from '../image/transform-controller.js';
import { ViewportCache } from '../image/layout-manager.js';
import type { CropSession } from '../crop/crop-controller.js';
import type { MosaicSession } from '../mosaic/mosaic-controller.js';
import type { DrawSession } from '../annotation/draw-controller.js';
import type { TextSession } from '../annotation/text-controller.js';
import type { DomBindings } from '../ui/dom-bindings.js';

export class EditorRuntime {
    fabricModule: FabricModule;
    isFabricLoaded: boolean;

    readonly options: ResolvedOptions;
    currentLayoutMode: LayoutMode;
    readonly defaultMosaicConfig: ResolvedMosaicConfig;
    currentMosaicConfig: ResolvedMosaicConfig;
    readonly defaultTextConfig: ResolvedTextAnnotationConfig;
    currentTextConfig: ResolvedTextAnnotationConfig;
    readonly defaultDrawConfig: ResolvedDrawConfig;
    currentDrawConfig: ResolvedDrawConfig;

    canvas: FabricNS.Canvas | null = null;
    canvasElement: HTMLCanvasElement | null = null;
    containerElement: HTMLElement | null = null;
    placeholderElement: HTMLElement | null = null;
    elements: ResolvedElementIdMap = {} as ResolvedElementIdMap;
    readonly elementOriginalDisabledMap = new Map<ElementKey, boolean>();
    readonly elementOriginalAriaDisabledMap = new Map<ElementKey, string | null>();
    readonly elementOriginalPointerEventsMap = new Map<ElementKey, string>();

    originalImage: BaseImageObject | null = null;
    baseImageScale = 1;
    currentScale = 1;
    currentRotation = 0;
    isImageLoadedToCanvas = false;
    currentImageMimeType: ImageMimeType | null = null;

    maskCounter = 0;
    lastMask: MaskObject | null = null;
    annotationCounter = 0;

    lastSnapshot: string | null = null;
    readonly historyManager: HistoryManager;
    readonly operationGuard = new OperationGuard();
    readonly animQueue = new AnimationQueue();
    transformController: TransformController | null = null;
    readonly viewportCache = new ViewportCache();

    cropSession: CropSession | null = null;
    mosaicSession: MosaicSession | null = null;
    textSession: TextSession | null = null;
    drawSession: DrawSession | null = null;

    domBindings: DomBindings | null = null;
    keyboardDocument: Document | null = null;
    keyboardHandler: ((event: KeyboardEvent) => void) | null = null;
    isDisposed = false;
    shouldSuppressSaveState = false;
    lastEmittedIsBusy: boolean | null = null;
    activeStateRestoreOperation: ImageEditorOperation | null = null;
    nextSelectionChangeContext: ImageEditorCallbackContext | null = null;

    constructor(fabricModule: FabricModule, isFabricLoaded: boolean, options: ResolvedOptions) {
        this.fabricModule = fabricModule;
        this.isFabricLoaded = isFabricLoaded;
        this.options = options;
        this.currentLayoutMode = options.layoutMode;
        this.defaultMosaicConfig = options.defaultMosaicConfig;
        this.currentMosaicConfig = cloneResolvedMosaicConfig(this.defaultMosaicConfig);
        this.defaultTextConfig = options.defaultTextConfig;
        this.currentTextConfig = cloneResolvedTextAnnotationConfig(this.defaultTextConfig);
        this.defaultDrawConfig = options.defaultDrawConfig;
        this.currentDrawConfig = cloneResolvedDrawConfig(this.defaultDrawConfig);
        this.historyManager = new HistoryManager(options.maxHistorySize);
    }

    getRuntimeOptions(): ResolvedOptions {
        if (this.currentLayoutMode === this.options.layoutMode) return this.options;
        return Object.freeze({
            ...this.options,
            layoutMode: this.currentLayoutMode,
        }) as ResolvedOptions;
    }

    getLiveCanvasOrThrow(operationName: string): FabricNS.Canvas {
        if (this.isDisposed || !this.canvas) {
            throw new Error(`[ImageEditor] Cannot run "${operationName}" after dispose.`);
        }
        return this.canvas;
    }

    isImageLoaded(): boolean {
        return !!(
            this.originalImage &&
            this.originalImage instanceof this.fabricModule.FabricImage &&
            (this.originalImage.width ?? 0) > 0 &&
            (this.originalImage.height ?? 0) > 0
        );
    }

    isBusy(isToolModeActive = false): boolean {
        return this.operationGuard.isBusy() || this.animQueue.isBusy() || isToolModeActive;
    }

    resetAfterDispose(): void {
        this.canvas = null;
        this.canvasElement = null;
        this.isImageLoadedToCanvas = false;
        this.originalImage = null;
        this.currentImageMimeType = null;
        this.lastMask = null;
        this.maskCounter = 0;
        this.annotationCounter = 0;
        this.currentScale = 1;
        this.currentRotation = 0;
        this.baseImageScale = 1;
        this.lastSnapshot = null;
        this.transformController = null;
        this.viewportCache.clear();
    }
}
