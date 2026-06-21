/**
 * Shared mutable runtime state for the ImageEditor facade.
 *
 * The facade owns this object and passes it to focused action and context
 * builders so state mutation stays centralized while modules remain small.
 */
import type * as FabricNS from 'fabric';
import { AnimationQueue } from '../animation/animation-queue.js';
import type { ResolvedElementIdMap } from '../core/editor-elements.js';
import { OperationGuard } from '../core/operation-guard.js';
import type { BaseImageObject, FabricModule, ImageEditorCallbackContext, ImageEditorOperation, ImageMimeType, LayoutMode, MaskObject, ResolvedDrawConfig, ResolvedMosaicConfig, ResolvedOptions, ResolvedTextAnnotationConfig } from '../core/public-types.js';
import { HistoryManager } from '../history/history-manager.js';
import type { TransformController } from '../image/transform-controller.js';
import { ViewportCache } from '../image/layout-manager.js';
import type { CropSession } from '../crop/crop-controller.js';
import type { MosaicSession } from '../mosaic/mosaic-controller.js';
import type { DrawSession } from '../annotation/draw-controller.js';
import type { TextSession } from '../annotation/text-controller.js';
import type { DomBindings } from '../ui/dom-bindings.js';
export declare class EditorRuntime {
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
    canvas: FabricNS.Canvas | null;
    canvasElement: HTMLCanvasElement | null;
    containerElement: HTMLElement | null;
    placeholderElement: HTMLElement | null;
    elements: ResolvedElementIdMap;
    readonly elementOriginalDisabledMap: Map<keyof import("../index.js").ElementIdMap, boolean>;
    readonly elementOriginalAriaDisabledMap: Map<keyof import("../index.js").ElementIdMap, string | null>;
    readonly elementOriginalPointerEventsMap: Map<keyof import("../index.js").ElementIdMap, string>;
    originalImage: BaseImageObject | null;
    baseImageScale: number;
    currentScale: number;
    currentRotation: number;
    isImageLoadedToCanvas: boolean;
    currentImageMimeType: ImageMimeType | null;
    maskCounter: number;
    lastMask: MaskObject | null;
    annotationCounter: number;
    lastSnapshot: string | null;
    readonly historyManager: HistoryManager;
    readonly operationGuard: OperationGuard;
    readonly animQueue: AnimationQueue;
    transformController: TransformController | null;
    readonly viewportCache: ViewportCache;
    cropSession: CropSession | null;
    mosaicSession: MosaicSession | null;
    textSession: TextSession | null;
    drawSession: DrawSession | null;
    domBindings: DomBindings | null;
    keyboardDocument: Document | null;
    keyboardHandler: ((event: KeyboardEvent) => void) | null;
    isDisposed: boolean;
    shouldSuppressSaveState: boolean;
    lastEmittedIsBusy: boolean | null;
    activeStateRestoreOperation: ImageEditorOperation | null;
    nextSelectionChangeContext: ImageEditorCallbackContext | null;
    constructor(fabricModule: FabricModule, isFabricLoaded: boolean, options: ResolvedOptions);
    getRuntimeOptions(): ResolvedOptions;
    getLiveCanvasOrThrow(operationName: string): FabricNS.Canvas;
    isImageLoaded(): boolean;
    isBusy(isToolModeActive?: boolean): boolean;
    resetAfterDispose(): void;
}
//# sourceMappingURL=editor-runtime.d.ts.map