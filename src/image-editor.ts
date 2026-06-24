/**
 * @author Ben Situ
 * @license MIT
 * Lightweight canvas-based image editor built on Fabric.js v7.
 * Provides masks, annotations, animated transforms, crop, mosaic, undo/redo,
 * serialization, and export.
 *
 * @module
 */

import type * as FabricNS from 'fabric';
import { reportError, reportWarning } from './core/callback-reporter.js';
import {
    resolveDomElement,
    resolveElementTargets,
    type ElementKey,
} from './core/editor-elements.js';
import {
    cloneResolvedMosaicConfig,
    cloneResolvedDrawConfig,
    cloneResolvedTextAnnotationConfig,
    isLayoutMode,
    resolveOptions,
} from './core/default-options.js';
import type { OperationToken } from './core/operation-guard.js';
import type { CanvasJson } from './core/state-serializer.js';
import {
    captureSnapshotAction,
    loadFromStateAction,
    saveStateAction,
} from './history/editor-state-actions.js';
import { detectFabric } from './fabric/fabric-adapter.js';
import type {
    AnnotationObject,
    AnnotationUpdateConfig,
    CropAspectRatio,
    CropModeOptions,
    DrawConfig,
    EditorToolMode,
    ElementMap,
    FabricModule,
    ImageEditorCallbackContext,
    ImageEditorOperation,
    ImageEditorSelection,
    ImageEditorState,
    ImageEditorOptions,
    ImageExportOptions,
    ImageInfo,
    ImageMimeType,
    LayoutMode,
    LoadImageOptions,
    MaskConfig,
    MaskObject,
    MosaicConfig,
    RemoveAllAnnotationsOptions,
    RemoveAllMasksOptions,
    RelayoutOptions,
    ResizeToContainerOptions,
    ResolvedDrawConfig,
    ResolvedMosaicConfig,
    ResolvedOptions,
    ResolvedTextAnnotationConfig,
    TextAnnotationConfig,
    TextAnnotationObject,
} from './core/public-types.js';
import { isAnnotationObject, isMaskObject } from './core/public-types.js';
import {
    getAnnotations as getAnnotationsImpl,
    renderAnnotationList,
    updateAnnotationListSelection,
    type AnnotationListContext,
    type AnnotationManagerContext,
} from './annotation/annotation-manager.js';
import {
    exitTextMode as exitTextModeImpl,
    finalizeActiveTextEditing,
    type TextControllerContext,
} from './annotation/text-controller.js';
import {
    exitDrawMode as exitDrawModeImpl,
    type DrawControllerContext,
} from './annotation/draw-controller.js';
import {
    createTextAnnotationAction,
    enterDrawModeAction,
    enterTextModeAction,
    exitDrawModeAction,
    exitTextModeAction,
} from './annotation/annotation-mode-actions.js';
import {
    applyDrawBrushSizeInputAction,
    applyDrawColorInputAction,
    applyDrawConfigPatchAction,
    applyTextColorInputAction,
    applyTextConfigPatchAction,
    applyTextFontSizeInputAction,
} from './annotation/annotation-config-actions.js';
import {
    cancelCrop as cancelCropImpl,
    type CropControllerContext,
} from './crop/crop-controller.js';
import {
    applyCropAction,
    cancelCropAction,
    enterCropModeAction,
    setCropAspectRatioAction,
} from './crop/crop-actions.js';
import {
    exitMosaicMode as exitMosaicModeImpl,
    type MosaicControllerContext,
} from './mosaic/mosaic-controller.js';
import {
    applyMosaicConfigPatchAction,
    enterMosaicModeAction,
    exitMosaicModeAction,
    resetMosaicConfigAction,
} from './mosaic/mosaic-actions.js';
import {
    type ExportServiceContext,
    type MergeAnnotationsContext,
    type MergeMasksContext,
} from './export/export-service.js';
import {
    downloadImageAction,
    exportImageBase64Action,
    exportImageFileAction,
    mergeAnnotationsAction,
    mergeMasksAction,
} from './export/export-actions.js';
import { loadImage as loadImageImpl } from './image/image-loader.js';
import { loadImageFile as loadImageFileImpl } from './image/image-file-loader.js';
import {
    captureImageDisplayGeometry as captureImageDisplayGeometryImpl,
    getScrollbarStableViewportCanvasSize as getScrollbarStableViewportCanvasSizeImpl,
    measureLayoutViewport as measureLayoutViewportImpl,
    restoreMergedImageDisplayGeometry as restoreMergedImageDisplayGeometryImpl,
    settleFitCoverScrollbarsAfterStateRestore as settleFitCoverScrollbarsAfterStateRestoreImpl,
    shouldNormalizeCanvasSizeAfterStateRestore as shouldNormalizeCanvasSizeAfterStateRestoreImpl,
    updateCanvasSizeToImageBounds as updateCanvasSizeToImageBoundsImpl,
    type DisplayGeometryContext,
    type ImageDisplayGeometry,
} from './image/display-geometry.js';
import { applyCanvasDimensions, type ViewportSize } from './image/layout-manager.js';
import { TransformController, type TransformContext } from './image/transform-controller.js';
import {
    flipHorizontalAction,
    flipVerticalAction,
    resetImageTransformAction,
    rotateImageAction,
    scaleImageAction,
} from './image/transform-actions.js';
import { EditorContextFactory } from './runtime/editor-contexts.js';
import { EditorActionAccessFactory } from './runtime/editor-action-access.js';
import { createEditorContextFactory } from './runtime/editor-context-factory-access.js';
import { EditorRuntime } from './runtime/editor-runtime.js';
import {
    handleObjectModified as handleObjectModifiedImpl,
    handleObjectMovingScalingRotating as handleObjectMovingScalingRotatingImpl,
    handleSelectionChanged as handleSelectionChangedImpl,
} from './selection/editor-selection-controller.js';
import {
    deleteSelectedEditableObjects,
    moveSelectedEditableObject as moveSelectedEditableObjectImpl,
    removeAllAnnotationsAction,
    removeSelectedAnnotationAction,
    updateAnnotationAction,
    updateSelectedAnnotationAction,
} from './overlay/editable-object-actions.js';
import { type CreateMaskContext, type RemoveMaskContext } from './mask/mask-factory.js';
import {
    createMaskAction,
    removeAllMasksAction as removeAllMasksActionImpl,
    removeSelectedMaskAction,
} from './mask/mask-actions.js';
import {
    createLabelForMask,
    hideAllMaskLabels,
    removeLabelForMask,
    showLabelForMask,
    syncMaskLabel,
    type MaskLabelManagerContext,
} from './mask/mask-label-manager.js';
import { renderMaskList, updateMaskListSelection, type MaskListContext } from './mask/mask-list.js';
import {
    safelyDisposeCanvas,
    safelyExitActiveSession,
    safelyRemoveKeyboardListener,
} from './lifecycle/editor-dispose.js';
import { DomBindings } from './ui/dom-bindings.js';
import { applyEditorControlState } from './ui/editor-control-state.js';
import { buildEditorControlSnapshot } from './ui/editor-control-snapshot.js';
import {
    restoreEditorControlOriginalStates,
    setEditorControlEnabled,
    type EditorControlElementContext,
} from './ui/editor-control-elements.js';
import { bindEditorDomEvents } from './ui/editor-dom-events.js';
import { createEditorDomEventActions } from './ui/editor-dom-actions.js';
import { applyEditorInputState } from './ui/editor-input-state.js';
import {
    bindEditorKeyboardEvents,
    handleEditorKeyboardEvent,
    isFabricTextEditingActive,
} from './ui/editor-keyboard-events.js';
import { setPlaceholderVisible as setPlaceholderVisibleImpl } from './ui/visibility-state.js';
import {
    canRunOperationInToolMode,
    getActiveToolMode as getActiveToolModeFromSnapshot,
    isImageEditorOperation,
    isToolModeActive as isToolModeActiveFromSnapshot,
    type EditorToolModeSnapshot,
} from './tool-mode/tool-mode-policy.js';
import { isSupportedImageDataUrl } from './utils/file.js';
import { detectSourceMimeType } from './image/image-resampler.js';

const INTERNAL_OPERATION_TOKEN = Symbol('ImageEditorInternalOperation');
const INTERNAL_ALLOW_DURING_ANIMATION_QUEUE = Symbol('ImageEditorAllowDuringAnimationQueue');

type InternalOperationOptions = {
    [INTERNAL_OPERATION_TOKEN]?: OperationToken;
    [INTERNAL_ALLOW_DURING_ANIMATION_QUEUE]?: true;
};

function getRuntimeDocument(canvasElement: HTMLCanvasElement | null | undefined): Document | null {
    return canvasElement?.ownerDocument ?? (typeof document !== 'undefined' ? document : null);
}

function isHtmlCanvasElement(element: HTMLElement | null): element is HTMLCanvasElement {
    if (!element) return false;
    const ownerWindow = element.ownerDocument?.defaultView;
    const CanvasCtor = ownerWindow?.HTMLCanvasElement ?? globalThis.HTMLCanvasElement;
    if (typeof CanvasCtor === 'function') return element instanceof CanvasCtor;
    return element.tagName.toLowerCase() === 'canvas';
}

function describeElementTarget(target: unknown): string {
    if (typeof target === 'string') return `"${target}"`;
    if (target === null) return 'null';
    if (target === undefined) return 'undefined';
    return 'provided element';
}

function captureContainerScroll(
    container: HTMLElement | null,
): { left: number; top: number } | null {
    return container ? { left: container.scrollLeft, top: container.scrollTop } : null;
}

function restoreContainerScroll(
    container: HTMLElement | null,
    scroll: { left: number; top: number } | null,
): void {
    if (!container || !scroll) return;
    try {
        container.scrollLeft = scroll.left;
        container.scrollTop = scroll.top;
    } catch (error) {
        console.warn('[ImageEditor] scroll restore failed', error);
    }
}

function isPositiveFiniteDimension(value: number): boolean {
    return Number.isFinite(value) && value > 0;
}

// ─── ImageEditor ─────────────────────────────────────────────────────────────

/**
 * Lightweight Fabric.js v7 image editor with masking/annotation, animated transforms,
 * crop, undo/redo, mosaic and multi-format export.
 *
 * ## Quick start (ESM)
 * ```ts
 * import * as fabric from 'fabric';
 * import { ImageEditor } from '@bensitu/image-editor';
 *
 * const editor = new ImageEditor(fabric, { canvasWidth: 1024, canvasHeight: 768 });
 * editor.init({ canvas: 'myCanvas' });
 * ```
 *
 * ## Quick start (CDN / `<script>` tag)
 * ```ts
 * // Assumes window.fabric is populated by a Fabric.js CDN script
 * const editor = new ImageEditor({ canvasWidth: 1024 });
 * editor.init();
 * ```
 */
export class ImageEditor {
    private readonly runtime: EditorRuntime;
    private readonly contextFactory: EditorContextFactory;
    private readonly actionAccessFactory: EditorActionAccessFactory;

    // ── Callbacks ───────────────────────────────────────────────────────────
    // The `onImageLoaded`, `onError`, and `onWarning` callbacks live on the
    // resolved runtime options and are read directly by the pipeline modules.
    // The facade does not cache them on a separate field so a single source
    // of truth survives the module decomposition.

    // ═══════════════════════════════════════════════════════════════════════
    // Constructor
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Creates a new image editor instance.
     *
     * Accepts ESM (`new ImageEditor(fabric, options?)`) and UMD/CDN
     * (`new ImageEditor(options?)`) forms. Fabric detection and option
     * normalization are delegated to the adapter/resolver modules.
     */
    constructor(
        fabricModuleOrOptions: FabricModule | ImageEditorOptions = {},
        options: ImageEditorOptions = {},
    ) {
        const detected = detectFabric(fabricModuleOrOptions, options);
        const resolvedOptions = resolveOptions(detected.options);

        this.runtime = new EditorRuntime(
            detected.fabric ?? ({} as FabricModule),
            detected.isFabricLoaded,
            resolvedOptions,
        );

        const rawDefaultLayoutMode = (detected.options as Record<string, unknown>)
            .defaultLayoutMode;
        if (rawDefaultLayoutMode !== undefined && !isLayoutMode(rawDefaultLayoutMode)) {
            reportWarning(
                this.runtime.options,
                new TypeError(
                    `[ImageEditor] Unsupported defaultLayoutMode ` +
                        `${JSON.stringify(rawDefaultLayoutMode)}. ` +
                        'Expected "fit", "cover", or "expand".',
                ),
                'Invalid defaultLayoutMode fell back to "expand".',
            );
        }

        this.contextFactory = this.createContextFactory();
        this.actionAccessFactory = this.createActionAccessFactory();
    }

    private createContextFactory(): EditorContextFactory {
        return createEditorContextFactory(this.runtime, {
            saveCanvasState: () => this.saveState(),
            saveCanvasStateWithAnimationBypass: () => {
                this.saveStateInternal(this.withAnimationQueueBypass());
            },
            captureSnapshot: () => this.captureSnapshotInternal(),
            loadImageForOperation: (operationToken, base64, providedOptions) =>
                this.loadImageInternal(
                    base64,
                    this.withInternalOperationOptions(operationToken, providedOptions ?? {}),
                ),
            loadMergedImage: async (operationToken, base64, providedOptions) => {
                const geometry = this.captureImageDisplayGeometry();
                await this.loadImageInternal(
                    base64,
                    this.withInternalOperationOptions(operationToken, providedOptions ?? {}),
                );
                this.restoreMergedImageDisplayGeometry(geometry);
            },
            loadFromStateForOperation: (operationToken, snapshot) =>
                this.loadFromStateInternal(
                    snapshot,
                    this.withInternalOperationOptions(
                        operationToken,
                        this.withAnimationQueueBypass(),
                    ),
                ),
            setCanvasSize: (widthPx, heightPx) => {
                this.setCanvasSizePx(widthPx, heightPx);
            },
            updateCanvasSizeToImageBounds: () => this.updateCanvasSizeToImageBounds(),
            alignObjectBoundingBoxToCanvasTopLeft: (object) => {
                this.alignObjectBoundingBoxToCanvasTopLeft(object);
            },
            syncMaskLabel: (mask) => {
                this.syncMaskLabel(mask);
            },
            removeLabelForMask: (mask) => {
                this.removeLabelForMask(mask);
            },
            hideAllMaskLabels: () => {
                this.hideAllMaskLabels();
            },
            updateMaskList: () => {
                this.updateMaskList();
            },
            updateAnnotationList: () => {
                this.updateAnnotationList();
            },
            updateUi: () => {
                this.updateUi();
            },
            updateInputs: () => {
                this.updateInputs();
            },
            handleSelectionChanged: (selected) => {
                this.handleSelectionChanged(selected);
            },
            getMasks: () => this.getMasks(),
            getAnnotations: () => this.getAnnotations(),
            emitImageChanged: (context) => {
                this.emitImageChanged(context);
            },
            emitAnnotationsChanged: (context) => {
                this.emitAnnotationsChanged(context);
            },
            emitBusyChangeIfChanged: (context) => {
                this.emitBusyChangeIfChanged(context);
            },
            buildCallbackContext: (operation, isInternalOperation) =>
                this.buildCallbackContext(operation, isInternalOperation),
        });
    }

    private createActionAccessFactory(): EditorActionAccessFactory {
        return new EditorActionAccessFactory(
            this.runtime,
            {
                canRunIdleOperation: (operation, options) =>
                    this.canRunIdleOperation(operation, options),
                assertIdleForOperation: (operation, options) => {
                    this.assertIdleForOperation(operation, options);
                },
                assertCanQueueAnimation: (operation) => {
                    this.assertCanQueueAnimation(operation);
                },
                finalizeActiveTextEditingIfNeeded: () => {
                    this.finalizeActiveTextEditingIfNeeded();
                },
                buildCallbackContext: (operation, isInternalOperation) =>
                    this.buildCallbackContext(operation, isInternalOperation),
                withSelectionChangeContext: (context, callback) =>
                    this.withSelectionChangeContext(context, callback),
                buildSelection: (selected) => this.buildSelection(selected),
                getMasks: () => this.getMasks(),
                getAnnotations: () => this.getAnnotations(),
                getMaskCollectionSignature: () => this.getMaskCollectionSignature(),
                getAnnotationCollectionSignature: () => this.getAnnotationCollectionSignature(),
                inferCurrentImageMimeType: () => this.inferCurrentImageMimeType(),
                shouldNormalizeCanvasSizeAfterStateRestore: () =>
                    this.shouldNormalizeCanvasSizeAfterStateRestore(),
                updateCanvasSizeToImageBounds: (options) =>
                    this.updateCanvasSizeToImageBounds(options),
                alignObjectBoundingBoxToCanvasTopLeft: (object) => {
                    this.alignObjectBoundingBoxToCanvasTopLeft(object);
                },
                settleFitCoverScrollbarsAfterStateRestore: () => {
                    this.settleFitCoverScrollbarsAfterStateRestore();
                },
                setCanvasSize: (widthPx, heightPx) => {
                    this.setCanvasSizePx(widthPx, heightPx);
                },
                refreshUiAfterQueuedAnimation: () => {
                    this.refreshUiAfterQueuedAnimation();
                },
                updateInputs: () => {
                    this.updateInputs();
                },
                updateMaskList: () => {
                    this.updateMaskList();
                },
                updateMaskListSelection: (mask) => {
                    this.updateMaskListSelection(mask);
                },
                updateAnnotationList: () => {
                    this.updateAnnotationList();
                },
                updateAnnotationListSelection: (annotation) => {
                    this.updateAnnotationListSelection(annotation);
                },
                updateUi: () => {
                    this.updateUi();
                },
                saveState: () => {
                    this.saveState();
                },
                removeLabelForMask: (mask) => {
                    this.removeLabelForMask(mask);
                },
                showLabelForMask: (mask) => {
                    this.showLabelForMask(mask);
                },
                syncMaskLabel: (mask) => {
                    this.syncMaskLabel(mask);
                },
                hideAllMaskLabels: () => {
                    this.hideAllMaskLabels();
                },
                handleSelectionChanged: (selected) => {
                    this.handleSelectionChanged(selected);
                },
                updateSelectedAnnotation: (config) => {
                    this.updateSelectedAnnotation(config as AnnotationUpdateConfig);
                },
                setTextColor: (color) => {
                    this.setTextColor(color);
                },
                setTextFontSize: (size) => {
                    this.setTextFontSize(size);
                },
                setDrawColor: (color) => {
                    this.setDrawColor(color);
                },
                setDrawBrushSize: (size) => {
                    this.setDrawBrushSize(size);
                },
                emitImageCleared: (image, context) => {
                    this.emitOptionCallback('onImageCleared', [image, context]);
                },
                emitSelectionChange: (selection, context) => {
                    this.emitOptionCallback('onSelectionChange', [selection, context]);
                },
                emitMasksChanged: (context) => {
                    this.emitMasksChanged(context);
                },
                emitAnnotationsChanged: (context) => {
                    this.emitAnnotationsChanged(context);
                },
                emitImageChanged: (context) => {
                    this.emitImageChanged(context);
                },
                emitBusyChangeIfChanged: (context) => {
                    this.emitBusyChangeIfChanged(context);
                },
                reportWarning: (error, message) => {
                    reportWarning(this.runtime.options, error, message);
                },
                withAnimationQueueBypass: () => this.withAnimationQueueBypass(),
            },
            this.contextFactory,
        );
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PUBLIC — init
    // ═══════════════════════════════════════════════════════════════════════

    /** Initializes DOM bindings, canvas state, and the optional initial image. */
    init(elementMap: ElementMap = {}): void {
        if (!this.runtime.isFabricLoaded) {
            const globalFabric = (globalThis as unknown as { fabric?: unknown }).fabric;
            if (
                !globalFabric ||
                typeof (globalFabric as { Canvas?: unknown }).Canvas !== 'function'
            ) {
                return;
            }
            this.runtime.fabricModule = globalFabric as FabricModule;
            this.runtime.isFabricLoaded = true;
        }
        // Post-dispose init is a no-op to avoid recreating canvas resources.
        if (this.runtime.isDisposed) return;

        this.runtime.elements = resolveElementTargets(elementMap);

        this.initCanvas();
        // Bindings are anchored to the canvas owner document.
        this.runtime.domBindings = new DomBindings(
            (key) => this.resolveElement(key),
            () => this.runtime.isDisposed,
        );
        this.runtime.transformController = new TransformController(this.buildTransformContext());
        this.bindDomEvents();
        this.updateInputs();
        this.updateMaskList();
        this.updateAnnotationList();
        this.updateUi();

        if (this.runtime.options.initialImageBase64) {
            void this.loadImage(this.runtime.options.initialImageBase64).catch(() => {
                // loadImage already restores state and routes the error through onError.
            });
        } else {
            this.updatePlaceholderStatus();
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PRIVATE — canvas setup
    // ═══════════════════════════════════════════════════════════════════════

    private initCanvas(): void {
        const canvasTarget = this.runtime.elements.canvas;
        const canvasCandidate = resolveDomElement<HTMLElement>(
            canvasTarget,
            getRuntimeDocument(null),
        );
        if (!isHtmlCanvasElement(canvasCandidate)) {
            throw new Error(
                `[ImageEditor] Canvas element not found: ${describeElementTarget(canvasTarget)}`,
            );
        }

        const canvasElement = canvasCandidate;
        this.runtime.canvasElement = canvasElement;
        const ownerDocument = canvasElement.ownerDocument;

        this.runtime.containerElement =
            resolveDomElement<HTMLElement>(this.runtime.elements.canvasContainer, ownerDocument) ??
            canvasElement.parentElement;

        this.runtime.placeholderElement = resolveDomElement<HTMLElement>(
            this.runtime.elements.imagePlaceholder,
            ownerDocument,
        );

        let initialWidth = this.runtime.options.canvasWidth;
        let initialHeight = this.runtime.options.canvasHeight;
        if (this.runtime.containerElement) {
            const containerWidth = Math.floor(this.runtime.containerElement.clientWidth);
            const containerHeight = Math.floor(this.runtime.containerElement.clientHeight);
            if (containerWidth > 0 && containerHeight > 0) {
                initialWidth = containerWidth;
                initialHeight = containerHeight;
            }
        }

        this.runtime.canvas = new this.runtime.fabricModule.Canvas(canvasElement, {
            width: initialWidth,
            height: initialHeight,
            backgroundColor: this.runtime.options.backgroundColor,
            selection: this.runtime.options.groupSelection,
            preserveObjectStacking: true,
        });

        this.runtime.canvas.on('selection:created', (e) => {
            this.handleSelectionChanged((e as { selected: FabricNS.FabricObject[] }).selected);
        });
        this.runtime.canvas.on('selection:updated', (e) => {
            this.handleSelectionChanged((e as { selected: FabricNS.FabricObject[] }).selected);
        });
        this.runtime.canvas.on('selection:cleared', () => this.handleSelectionChanged([]));

        const onObjectEvent = (e: { target?: FabricNS.FabricObject }) => {
            if (e.target) this.handleObjectMovingScalingRotating(e.target);
        };
        const onObjectModified = (e: { target?: FabricNS.FabricObject }) => {
            if (e.target) this.handleObjectModified(e.target);
        };
        this.runtime.canvas.on('object:moving', onObjectEvent);
        this.runtime.canvas.on('object:scaling', onObjectEvent);
        this.runtime.canvas.on('object:rotating', onObjectEvent);
        this.runtime.canvas.on('object:modified', onObjectModified);
    }
    private resolveElement<T extends HTMLElement>(
        key: ElementKey,
        ownerDocument: Document | null = getRuntimeDocument(this.runtime.canvasElement),
    ): T | null {
        return resolveDomElement<T>(this.runtime.elements[key] as string | T | null, ownerDocument);
    }

    private getLiveCanvasOrThrow(operationName: string): FabricNS.Canvas {
        if (this.runtime.isDisposed || !this.runtime.canvas) {
            throw new Error(`[ImageEditor] Cannot run "${operationName}" after dispose.`);
        }
        return this.runtime.canvas;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PRIVATE — DOM / UI bindings
    // ═══════════════════════════════════════════════════════════════════════

    private bindDomEvents(): void {
        if (!this.runtime.domBindings) return;
        const ownerDocument = getRuntimeDocument(this.runtime.canvasElement);
        if (!ownerDocument) return;

        bindEditorDomEvents({
            bindings: this.runtime.domBindings,
            rotationStep: this.runtime.options.rotationStep,
            getInputValue: (key) => {
                const element = this.resolveElement<HTMLInputElement | HTMLSelectElement>(
                    key,
                    ownerDocument,
                );
                return element?.value ?? '';
            },
            actions: createEditorDomEventActions(this.runtime, ownerDocument, {
                reportAsyncActionError: (operation, error) => {
                    reportError(this.runtime.options, error, `${operation} failed.`);
                },
                loadImageFile: (file) => this.loadImageFile(file),
                scaleImage: (scale) => this.scaleImage(scale),
                rotateImage: (rotation) => this.rotateImage(rotation),
                resetImageTransform: () => this.resetImageTransform(),
                flipHorizontal: () => this.flipHorizontal(),
                flipVertical: () => this.flipVertical(),
                createMask: () => {
                    this.createMask();
                },
                removeSelectedMask: () => {
                    this.removeSelectedMask();
                },
                removeAllMasks: () => {
                    this.removeAllMasks();
                },
                mergeMasks: () => this.mergeMasks(),
                mergeAnnotations: () => this.mergeAnnotations(),
                enterTextMode: () => {
                    this.enterTextMode();
                },
                exitTextMode: () => {
                    this.exitTextMode();
                },
                enterDrawMode: () => {
                    this.enterDrawMode();
                },
                exitDrawMode: () => {
                    this.exitDrawMode();
                },
                removeSelectedAnnotation: () => {
                    this.removeSelectedAnnotation();
                },
                removeAllAnnotations: () => {
                    this.removeAllAnnotations();
                },
                deleteSelectedObject: () => {
                    this.deleteSelectedObject();
                },
                bringSelectedObjectForward: () => {
                    this.bringSelectedObjectForward();
                },
                sendSelectedObjectBackward: () => {
                    this.sendSelectedObjectBackward();
                },
                bringSelectedObjectToFront: () => {
                    this.bringSelectedObjectToFront();
                },
                sendSelectedObjectToBack: () => {
                    this.sendSelectedObjectToBack();
                },
                downloadImage: () => this.downloadImage(),
                undo: () => this.undo(),
                redo: () => this.redo(),
                enterCropMode: (options) => {
                    this.enterCropMode(options);
                },
                setCropAspectRatio: (aspectRatio) => {
                    this.setCropAspectRatio(aspectRatio);
                },
                applyCrop: () => this.applyCrop(),
                reportCropApplyError: (error) => {
                    reportError(this.runtime.options, error, 'Crop apply failed.');
                },
                cancelCrop: () => {
                    this.cancelCrop();
                },
                enterMosaicMode: () => {
                    this.enterMosaicMode();
                },
                exitMosaicMode: () => {
                    this.exitMosaicMode();
                },
                setMosaicBrushSize: (size) => {
                    this.setMosaicBrushSize(size);
                },
                setMosaicBlockSize: (size) => {
                    this.setMosaicBlockSize(size);
                },
                setTextColor: (color) => {
                    this.applyTextColorInput(color);
                },
                setTextFontSize: (size) => {
                    this.applyTextFontSizeInput(size);
                },
                setDrawColor: (color) => {
                    this.applyDrawColorInput(color);
                },
                setDrawBrushSize: (size) => {
                    this.applyDrawBrushSizeInput(size);
                },
            }),
        });
        this.bindKeyboardEvents(ownerDocument);
    }

    private bindKeyboardEvents(ownerDocument: Document): void {
        bindEditorKeyboardEvents({
            getOwnerDocument: () => ownerDocument,
            getKeyboardDocument: () => this.runtime.keyboardDocument,
            getKeyboardHandler: () => this.runtime.keyboardHandler,
            setKeyboardBinding: (keyboardDocument, keyboardHandler) => {
                this.runtime.keyboardDocument = keyboardDocument;
                this.runtime.keyboardHandler = keyboardHandler;
            },
            removeKeyboardListener: (keyboardDocument, keyboardHandler) => {
                safelyRemoveKeyboardListener(keyboardDocument, keyboardHandler);
            },
            handleKeyboardEvent: (event) => {
                this.handleKeyboardEvent(event);
            },
        });
    }

    private handleKeyboardEvent(event: KeyboardEvent): void {
        handleEditorKeyboardEvent(
            {
                isDisposed: () => this.runtime.isDisposed,
                getCanvas: () => this.runtime.canvas,
                getKeyboardDocument: () => this.runtime.keyboardDocument,
                hasTextSession: () => this.runtime.textSession !== null,
                hasDrawSession: () => this.runtime.drawSession !== null,
                hasMosaicSession: () => this.runtime.mosaicSession !== null,
                hasCropSession: () => this.runtime.cropSession !== null,
                deleteSelectedObject: () => {
                    this.deleteSelectedObject();
                },
                finalizeActiveTextEditing: (commit) => {
                    finalizeActiveTextEditing(this.buildTextControllerContext(), { commit });
                },
                exitTextMode: () => {
                    this.exitTextMode();
                },
                exitDrawMode: () => {
                    this.exitDrawMode();
                },
                exitMosaicMode: () => {
                    this.exitMosaicMode();
                },
                cancelCrop: () => {
                    this.cancelCrop();
                },
            },
            event,
        );
    }

    private finalizeActiveTextEditingIfNeeded(): void {
        if (!this.runtime.canvas || !isFabricTextEditingActive(this.runtime.canvas)) return;
        finalizeActiveTextEditing(this.buildTextControllerContext(), { commit: true });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PRIVATE — image loading
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Read a `File` selected via the upload control as a base64 data URL
     * and route it through the transactional `loadImage` pipeline.
     *
     * Routes through `utils/file.ts` so MIME inference (including the
     * empty-`file.type` extension fallback), `FileReader` plumbing, and
     * input reset live in one place. The input is reset on both success
     * and failure so re-selecting the same file fires a fresh `change`
     * event.
     */
    private async loadImageFile(file: File): Promise<void> {
        await loadImageFileImpl(
            {
                options: this.runtime.options,
                getInputElement: () => this.resolveElement<HTMLInputElement>('imageInput'),
                loadImage: (dataUrl) => this.loadImage(dataUrl),
            },
            file,
        );
    }

    /**
     * Loads a Base64-encoded image data URL onto the canvas.
     *
     * The transactional pipeline lives in `image/image-loader.ts`; this
     * facade method delegates to it so all rollback, downsample, layout,
     * and `onImageLoaded` ordering rules are owned in one place.
     *
     * Pipeline contract preserved end-to-end:
     *
     * - Non-`data:image/` strings resolve without mutation.
     * - On a valid data URL, the loader captures a rollback bundle BEFORE
     *   the first mutation. Decode, downsample, Fabric, timeout, or layout
     *   failures replay the bundle and reject with the original error.
     * - On commit, the loader sets `originalImage`, `currentScale = 1`,
     *   `currentRotation = 0`, `baseImageScale`, `maskCounter = 0`,
     *   `lastSnapshot`, and `isImageLoadedToCanvas = true`. It also
     *   honours `LoadImageOptions.preserveScroll` and invokes
     *   `onImageLoaded` exactly once after every scalar is committed.
     *
     * Operation guard: `loadImage` is one of the
     * guarded operations. While `isAnimating === true` the facade rejects
     * the call as a documented no-op so a queued scale/rotate animation
     * cannot be torn down by a concurrent reload.
     *
     * @param base64 - Supported image data URL string.
     * @param options - Optional {@link LoadImageOptions}; currently only
     *                `preserveScroll` is consulted.
     * @returns A promise that resolves once the image is on the canvas, or
     *          rejects with the original error after a transactional
     *          rollback. Unsupported image inputs and Fabric-unavailable /
     *          disposed states resolve without observable mutation.
     */
    async loadImage(base64: string, options: LoadImageOptions = {}): Promise<void> {
        return this.loadImageInternal(
            base64,
            options as LoadImageOptions & InternalOperationOptions,
        );
    }

    private async loadImageInternal(
        base64: string,
        options: LoadImageOptions & InternalOperationOptions = {},
    ): Promise<void> {
        // Fabric-unavailable and disposed gates mirror "init and
        // loadImage are no-ops" contract.
        if (!this.runtime.isFabricLoaded || !this.runtime.canvas) return;
        if (this.runtime.isDisposed) return;
        if (!isSupportedImageDataUrl(base64)) return;

        if (!this.canRunIdleOperation('loadImage', options)) return;
        this.finalizeActiveTextEditingIfNeeded();
        const callbackContext = this.getOperationContext('loadImage', options);
        const previousImage = this.runtime.originalImage;
        const hadMasks = this.getMasks().length > 0;
        const hadAnnotations = this.getAnnotations().length > 0;
        this.emitOptionCallback('onImageLoadStart', [callbackContext]);
        this.runtime.operationGuard.beginLoading();
        this.emitBusyChangeIfChanged(callbackContext);
        this.updateUi();

        // Drop any stale label objects BEFORE the loader clears the
        // canvas. The loader does call `canvas.clear` itself, but the
        // facade also tracks `mask.labelObject` references on the mask
        // objects and will leak those references onto stale objects
        // unless we hide them up-front.
        this.hideAllMaskLabels();

        // Build the dependency bundle the loader consumes. Each closure
        // reads/writes the canonical facade state so the loader has no
        // class state of its own.
        const loadImageContext = this.contextFactory.buildLoadImageContext();

        try {
            await loadImageImpl(loadImageContext, base64, options);
        } finally {
            this.runtime.operationGuard.endLoading();
            this.emitBusyChangeIfChanged(callbackContext);
            if (!this.runtime.isDisposed && this.runtime.canvas) this.updateUi();
        }

        // ── Facade-only post-commit bookkeeping ─────────────────────────
        // The loader owns canvas state, transform scalars, and
        // lastSnapshot. Everything below is facade-specific UI,
        // lifecycle-callback, and mask-placement memo state that the
        // loader has no visibility into. The block runs only when the
        // load committed — a thrown error short-circuits it via the
        // `throw` above, which matches the loader's "no observable
        // change on rollback" contract.
        this.runtime.lastMask = null;

        this.updateInputs();
        this.updateMaskList();
        this.updateAnnotationList();
        this.updateUi();
        if (previousImage && previousImage !== this.runtime.originalImage) {
            this.emitOptionCallback('onImageCleared', [previousImage, callbackContext]);
        }
        const imageInfo = this.getImageInfo();
        if (imageInfo) {
            this.emitOptionCallback('onImageLoaded', [imageInfo, callbackContext]);
        }
        if (hadMasks) {
            this.emitMasksChanged(callbackContext);
        }
        if (hadAnnotations) {
            this.emitAnnotationsChanged(callbackContext);
        }
        this.emitImageChanged(callbackContext);
    }

    private getInternalOperationToken(options?: object | null): OperationToken | null {
        return (
            (options as InternalOperationOptions | null | undefined)?.[INTERNAL_OPERATION_TOKEN] ??
            null
        );
    }

    private canRunDuringAnimationQueue(options?: object | null): boolean {
        return !!(options as InternalOperationOptions | null | undefined)?.[
            INTERNAL_ALLOW_DURING_ANIMATION_QUEUE
        ];
    }

    private withInternalOperationOptions<T extends object>(
        token: OperationToken | null | undefined,
        options: T = {} as T,
    ): T & InternalOperationOptions {
        return {
            ...options,
            ...(token ? { [INTERNAL_OPERATION_TOKEN]: token } : {}),
        } as T & InternalOperationOptions;
    }

    private withAnimationQueueBypass<T extends object>(
        options: T = {} as T,
    ): T & InternalOperationOptions {
        return {
            ...options,
            [INTERNAL_ALLOW_DURING_ANIMATION_QUEUE]: true,
        } as T & InternalOperationOptions;
    }

    private assertIdleForOperation(operationName: string, options?: object | null): void {
        const token = this.getInternalOperationToken(options);
        this.runtime.operationGuard.assertIdleForOperation(operationName, token);
        const activeToolMode = this.getActiveToolMode();
        if (
            activeToolMode &&
            !this.runtime.operationGuard.isOwnOperation(token) &&
            !canRunOperationInToolMode(activeToolMode, operationName)
        ) {
            throw new Error(
                `[ImageEditor] Cannot run "${operationName}" while ${activeToolMode} mode is active.`,
            );
        }
        if (this.runtime.animQueue.isBusy() && !this.canRunDuringAnimationQueue(options)) {
            throw new Error(
                `[ImageEditor] Cannot run "${operationName}" while an animation is queued.`,
            );
        }
    }

    private canRunIdleOperation(operationName: string, options?: object | null): boolean {
        try {
            this.assertIdleForOperation(operationName, options);
            return true;
        } catch (error) {
            if (!this.isExpectedIdleGuardError(error, operationName)) {
                throw error;
            }
            return false;
        }
    }

    private isExpectedIdleGuardError(error: unknown, operationName: string): boolean {
        return (
            error instanceof Error &&
            error.message.startsWith(`[ImageEditor] Cannot run "${operationName}" `)
        );
    }

    private assertCanQueueAnimation(operationName: string, options?: object | null): void {
        const token = this.getInternalOperationToken(options);
        this.runtime.operationGuard.assertCanQueueAnimation(operationName, token);
        const activeToolMode = this.getActiveToolMode();
        if (
            activeToolMode &&
            !this.runtime.operationGuard.isOwnOperation(token) &&
            !canRunOperationInToolMode(activeToolMode, operationName)
        ) {
            throw new Error(
                `[ImageEditor] Cannot run "${operationName}" while ${activeToolMode} mode is active.`,
            );
        }
    }

    /**
     * Returns `true` if a valid image is currently loaded on the canvas.
     */
    isImageLoaded(): boolean {
        return !!(
            this.runtime.originalImage &&
            this.runtime.originalImage instanceof this.runtime.fabricModule.FabricImage &&
            (this.runtime.originalImage.width ?? 0) > 0 &&
            (this.runtime.originalImage.height ?? 0) > 0
        );
    }

    /**
     * Returns `true` while the editor is loading, animating, or in crop mode.
     */
    isBusy(): boolean {
        return (
            this.runtime.operationGuard.isBusy() ||
            this.runtime.animQueue.isBusy() ||
            this.isToolModeActive()
        );
    }

    /**
     * Selects the layout strategy used by subsequent image loads.
     *
     * The current canvas is not re-laid out immediately; call this before
     * `loadImage()` to choose how the next image is placed.
     *
     * @param mode - Layout mode to use for future image loads.
     */
    setLayoutMode(mode: LayoutMode): void {
        if (!isLayoutMode(mode)) {
            reportWarning(
                this.runtime.options,
                new TypeError(
                    `[ImageEditor] Unsupported layout mode ${JSON.stringify(mode)}. ` +
                        'Expected "fit", "cover", or "expand".',
                ),
                'Ignored invalid layout mode.',
            );
            return;
        }

        this.runtime.currentLayoutMode = mode;
    }

    /**
     * Resize the Fabric canvas to explicit CSS pixel dimensions.
     * Invalid, non-finite, or non-positive dimensions are reported through
     * `onWarning` and ignored.
     */
    setCanvasSize(widthPx: number, heightPx: number): void {
        this.applyPublicCanvasSize(widthPx, heightPx, 'setCanvasSize');
    }

    /**
     * Resize the Fabric canvas to the current container client size.
     * Hidden containers can use `fallbackWidth` and `fallbackHeight`.
     */
    resizeToContainer(options: ResizeToContainerOptions = {}): void {
        if (!this.canRunPublicLayoutOperation('resizeToContainer')) return;
        const size = this.resolveContainerResizeSize(options);
        if (!size) {
            reportWarning(
                this.runtime.options,
                new TypeError('[ImageEditor] Container dimensions are not available.'),
                'resizeToContainer ignored because no valid container or fallback size was available.',
            );
            return;
        }
        this.applyPublicCanvasSize(size.width, size.height, 'resizeToContainer', {
            skipGuard: true,
            preserveScroll: true,
        });
    }

    /**
     * Re-measure the host layout and refresh canvas geometry.
     *
     * This conservative relayout keeps the existing image and overlays in place;
     * it does not reload the image or reset user transforms. When an image is
     * already loaded, canvas bounds are recalculated around the current image
     * geometry using the active layout mode.
     */
    relayout(options: RelayoutOptions = {}): void {
        if (!this.canRunPublicLayoutOperation('relayout')) return;
        if (options.mode !== undefined) {
            if (!isLayoutMode(options.mode)) {
                reportWarning(
                    this.runtime.options,
                    new TypeError(
                        `[ImageEditor] Unsupported relayout mode ${JSON.stringify(options.mode)}. ` +
                            'Expected "fit", "cover", or "expand".',
                    ),
                    'Ignored invalid relayout mode.',
                );
                return;
            }
            this.runtime.currentLayoutMode = options.mode;
        }

        const scroll = options.preserveScroll
            ? captureContainerScroll(this.runtime.containerElement)
            : null;
        const viewport = this.runtime.containerElement ? this.measureLayoutViewport() : null;
        if (viewport) this.setCanvasSizePx(viewport.width, viewport.height);
        if (this.runtime.originalImage) {
            this.updateCanvasSizeToImageBounds();
        }
        restoreContainerScroll(this.runtime.containerElement, scroll);
        this.runtime.canvas?.renderAll();
        this.refreshAfterCanvasLayoutChange('relayout');
    }
    private getRuntimeOptions(): ResolvedOptions {
        if (this.runtime.currentLayoutMode === this.runtime.options.layoutMode)
            return this.runtime.options;
        return Object.freeze({
            ...this.runtime.options,
            layoutMode: this.runtime.currentLayoutMode,
        }) as ResolvedOptions;
    }

    private buildCallbackContext(
        operation: ImageEditorOperation,
        isInternalOperation = false,
    ): ImageEditorCallbackContext {
        return { operation, isInternalOperation };
    }

    private getOperationContext(
        fallback: ImageEditorOperation,
        options?: object | null,
    ): ImageEditorCallbackContext {
        const internal = this.getInternalOperationToken(options as InternalOperationOptions | null);
        const activeOperation = this.runtime.operationGuard.activeOperationName();
        if (internal && activeOperation) {
            return this.buildCallbackContext(
                isImageEditorOperation(activeOperation) ? activeOperation : fallback,
                true,
            );
        }
        return this.buildCallbackContext(fallback, false);
    }

    private emitOptionCallback(
        callbackName:
            | 'onImageLoadStart'
            | 'onImageLoaded'
            | 'onImageCleared'
            | 'onImageChanged'
            | 'onBusyChange'
            | 'onEditorDisposed'
            | 'onMasksChanged'
            | 'onAnnotationsChanged'
            | 'onSelectionChange',
        args: unknown[],
    ): void {
        const callback = this.runtime.options[callbackName] as
            | ((...callbackArgs: never[]) => unknown)
            | null;
        if (typeof callback !== 'function') return;
        try {
            callback(...(args as never[]));
        } catch (error) {
            console.error(`[ImageEditor] ${callbackName} callback threw`, error);
        }
    }

    private getImageInfo(): ImageInfo | null {
        if (!this.runtime.canvas || !this.runtime.originalImage) return null;
        const canvasWidth = this.runtime.canvas.getWidth();
        const canvasHeight = this.runtime.canvas.getHeight();
        let displayWidth: number;
        let displayHeight: number;
        try {
            this.runtime.originalImage.setCoords();
            const bounds = this.runtime.originalImage.getBoundingRect();
            displayWidth = Math.max(0, Number(bounds.width) || 0);
            displayHeight = Math.max(0, Number(bounds.height) || 0);
        } catch {
            displayWidth = Math.max(
                0,
                (Number(this.runtime.originalImage.width) || 0) *
                    Math.abs(Number(this.runtime.originalImage.scaleX) || 1),
            );
            displayHeight = Math.max(
                0,
                (Number(this.runtime.originalImage.height) || 0) *
                    Math.abs(Number(this.runtime.originalImage.scaleY) || 1),
            );
        }
        return {
            width: Math.max(0, Number(this.runtime.originalImage.width) || 0),
            height: Math.max(0, Number(this.runtime.originalImage.height) || 0),
            displayWidth,
            displayHeight,
            scale: this.runtime.currentScale,
            rotation: this.runtime.currentRotation,
            canvasWidth,
            canvasHeight,
        };
    }

    private getMasks(): MaskObject[] {
        if (!this.runtime.canvas) return [];
        return this.runtime.canvas.getObjects().filter(isMaskObject).slice();
    }

    getAnnotations(): AnnotationObject[] {
        if (!this.runtime.canvas) return [];
        return getAnnotationsImpl(this.runtime.canvas);
    }

    private getMaskCollectionSignature(): string {
        return this.getMasks()
            .map((mask) => `${mask.maskId}:${mask.maskName}`)
            .join('|');
    }

    private getAnnotationCollectionSignature(): string {
        return this.getAnnotations()
            .map((annotation) => `${annotation.annotationId}:${annotation.annotationName}`)
            .join('|');
    }

    private buildToolModeSnapshot(): EditorToolModeSnapshot {
        return {
            hasCropSession: this.runtime.cropSession !== null,
            hasMosaicSession: this.runtime.mosaicSession !== null,
            hasTextSession: this.runtime.textSession !== null,
            hasDrawSession: this.runtime.drawSession !== null,
        };
    }

    private getActiveToolMode(): EditorToolMode | null {
        return getActiveToolModeFromSnapshot(this.buildToolModeSnapshot());
    }

    private isToolModeActive(): boolean {
        return isToolModeActiveFromSnapshot(this.buildToolModeSnapshot());
    }

    private getEditorState(): ImageEditorState {
        const canvasWidth = this.runtime.canvas ? this.runtime.canvas.getWidth() : 0;
        const canvasHeight = this.runtime.canvas ? this.runtime.canvas.getHeight() : 0;
        const image = this.getImageInfo();
        return {
            hasImage: image !== null,
            image,
            maskCount: this.getMasks().length,
            annotationCount: this.getAnnotations().length,
            currentScale: this.runtime.currentScale,
            currentRotation: this.runtime.currentRotation,
            isFlippedHorizontally: !!this.runtime.originalImage?.flipX,
            isFlippedVertically: !!this.runtime.originalImage?.flipY,
            isBusy: this.isBusy(),
            activeToolMode: this.getActiveToolMode(),
            isCropMode: this.runtime.cropSession !== null,
            isMosaicMode: this.runtime.mosaicSession !== null,
            isTextMode: this.runtime.textSession !== null,
            isDrawMode: this.runtime.drawSession !== null,
            canUndo: this.runtime.historyManager.canUndo(),
            canRedo: this.runtime.historyManager.canRedo(),
            canvasWidth,
            canvasHeight,
        };
    }

    private emitImageChanged(context: ImageEditorCallbackContext): void {
        this.emitOptionCallback('onImageChanged', [this.getEditorState(), context]);
    }

    private emitMasksChanged(context: ImageEditorCallbackContext): void {
        this.emitOptionCallback('onMasksChanged', [this.getMasks(), context]);
    }

    private emitAnnotationsChanged(context: ImageEditorCallbackContext): void {
        this.emitOptionCallback('onAnnotationsChanged', [this.getAnnotations(), context]);
    }

    private emitBusyChangeIfChanged(context: ImageEditorCallbackContext): void {
        const isBusy = this.isBusy();
        if (this.runtime.lastEmittedIsBusy === isBusy) return;
        this.runtime.lastEmittedIsBusy = isBusy;
        this.emitOptionCallback('onBusyChange', [isBusy, context]);
    }

    private buildSelection(selected: FabricNS.FabricObject[]): ImageEditorSelection {
        const selectedMasks = selected.filter(isMaskObject);
        const selectedAnnotations = selected.filter(isAnnotationObject);
        const selectedObjectKind =
            selectedMasks.length === 1 && selectedAnnotations.length === 0
                ? 'mask'
                : selectedAnnotations.length === 1 && selectedMasks.length === 0
                  ? 'annotation'
                  : null;
        return {
            selectedMask: selectedMasks[0] ?? null,
            selectedMasks,
            selectedAnnotation: selectedAnnotations[0] ?? null,
            selectedAnnotations,
            selectedObjectKind,
        };
    }

    private withSelectionChangeContext<T>(
        context: ImageEditorCallbackContext,
        callback: () => T,
    ): T {
        const previous = this.runtime.nextSelectionChangeContext;
        this.runtime.nextSelectionChangeContext = context;
        try {
            return callback();
        } finally {
            this.runtime.nextSelectionChangeContext = previous;
        }
    }

    private isSupportedImageMimeType(mimeType: string | null): mimeType is ImageMimeType {
        return mimeType === 'image/jpeg' || mimeType === 'image/png' || mimeType === 'image/webp';
    }

    private inferCurrentImageMimeType(): ImageMimeType | null {
        const image = this.runtime.originalImage as
            | (FabricNS.FabricImage & {
                  getSrc?: () => string;
                  src?: string;
              })
            | null;
        if (!image) return null;
        let source: string | null = null;
        try {
            if (typeof image.getSrc === 'function') source = image.getSrc();
            else if (typeof image.src === 'string') source = image.src;
        } catch {
            source = null;
        }
        const mimeType = source ? detectSourceMimeType(source) : null;
        return this.isSupportedImageMimeType(mimeType) ? mimeType : null;
    }

    private canRunPublicLayoutOperation(operation: ImageEditorOperation): boolean {
        if (this.runtime.isDisposed || !this.runtime.canvas) return false;
        return this.canRunIdleOperation(operation);
    }

    private normalizeCanvasDimension(
        value: number,
        operation: ImageEditorOperation,
    ): number | null {
        const numericValue = Number(value);
        if (isPositiveFiniteDimension(numericValue)) return Math.round(numericValue);
        reportWarning(
            this.runtime.options,
            new TypeError(`[ImageEditor] ${operation} expected positive finite canvas dimensions.`),
            `${operation} ignored invalid canvas dimensions.`,
        );
        return null;
    }

    private applyPublicCanvasSize(
        widthPx: number,
        heightPx: number,
        operation: ImageEditorOperation,
        options: { skipGuard?: boolean; preserveScroll?: boolean } = {},
    ): boolean {
        if (!options.skipGuard && !this.canRunPublicLayoutOperation(operation)) return false;
        const width = this.normalizeCanvasDimension(widthPx, operation);
        const height = this.normalizeCanvasDimension(heightPx, operation);
        if (width === null || height === null) return false;

        const scroll = options.preserveScroll
            ? captureContainerScroll(this.runtime.containerElement)
            : null;
        this.setCanvasSizePx(width, height);
        restoreContainerScroll(this.runtime.containerElement, scroll);
        this.runtime.canvas?.renderAll();
        this.refreshAfterCanvasLayoutChange(operation);
        return true;
    }

    private resolveContainerResizeSize(
        options: ResizeToContainerOptions,
    ): { width: number; height: number } | null {
        const container = this.runtime.containerElement;
        const containerWidth = Math.floor(container?.clientWidth ?? 0);
        const containerHeight = Math.floor(container?.clientHeight ?? 0);
        if (containerWidth > 0 && containerHeight > 0) {
            return { width: containerWidth, height: containerHeight };
        }

        const fallbackWidth = Number(options.fallbackWidth);
        const fallbackHeight = Number(options.fallbackHeight);
        if (isPositiveFiniteDimension(fallbackWidth) && isPositiveFiniteDimension(fallbackHeight)) {
            return { width: Math.round(fallbackWidth), height: Math.round(fallbackHeight) };
        }
        return null;
    }

    private refreshAfterCanvasLayoutChange(operation: ImageEditorOperation): void {
        const context = this.buildCallbackContext(operation, false);
        this.updateInputs();
        this.updateUi();
        this.updatePlaceholderStatus();
        this.emitImageChanged(context);
        this.emitBusyChangeIfChanged(context);
    }

    /**
     * Atomically resize the Fabric canvas. Routes through
     * {@link applyCanvasDimensions} so the canvas's lower (render) and
     * upper (event) layers stay in sync and the surrounding container is
     * reflowed before the next paint — matching the contract enforced
     * across the rest of the layout pipeline (see
     * `image/layout-manager.ts`).
     */
    private setCanvasSizePx(widthPx: number, heightPx: number): void {
        if (!this.runtime.canvas) return;
        applyCanvasDimensions(
            this.runtime.canvas,
            widthPx,
            heightPx,
            this.runtime.containerElement,
        );
    }
    // ═══════════════════════════════════════════════════════════════════════
    // PRIVATE — geometry helpers
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Re-align an object so its bounding-box top-left maps to the
     * object's `(left, top)` reference. Used by the transform pipeline's
     * `afterTransformSnap` hook to absorb floating-point drift on the
     * final animation tick.
     */
    private alignObjectBoundingBoxToCanvasTopLeft(object: FabricNS.FabricObject): void {
        object.setCoords();
        const boundingRect = object.getBoundingRect(); // v7: always absolute, no params
        object.set({
            left: (object.left ?? 0) - boundingRect.left,
            top: (object.top ?? 0) - boundingRect.top,
        });
        object.setCoords();
        // Flush the final snapped geometry before the transform promise
        // settles; callers may read layout immediately after awaiting it.
        this.runtime.canvas?.renderAll();
    }

    private buildDisplayGeometryContext(): DisplayGeometryContext {
        return {
            canvas: this.runtime.canvas,
            containerElement: this.runtime.containerElement,
            options: this.runtime.options,
            currentLayoutMode: this.runtime.currentLayoutMode,
            viewportCache: this.runtime.viewportCache,
            getOriginalImage: () => this.runtime.originalImage,
            setCanvasSize: (widthPx, heightPx) => {
                this.setCanvasSizePx(widthPx, heightPx);
            },
            setCurrentScale: (scale) => {
                this.runtime.currentScale = scale;
            },
            setCurrentRotation: (rotation) => {
                this.runtime.currentRotation = rotation;
            },
            setBaseImageScale: (scale) => {
                this.runtime.baseImageScale = scale;
            },
            captureSnapshot: () => this.captureSnapshotInternal(),
            setLastSnapshot: (snapshot) => {
                this.runtime.lastSnapshot = snapshot;
            },
        };
    }

    private measureLayoutViewport(scrollbarSize?: { width: number; height: number }): ViewportSize {
        return measureLayoutViewportImpl(this.buildDisplayGeometryContext(), scrollbarSize);
    }

    private getScrollbarStableViewportCanvasSize(viewport: ViewportSize): ViewportSize {
        return getScrollbarStableViewportCanvasSizeImpl(viewport);
    }

    /**
     * Resize the canvas to fit the transformed image bounds. Used by the
     * transform pipeline's `afterTransformSnap` hook so a post-rotation/scale
     * image that exceeds the viewport gets a real scroll range.
     */
    private updateCanvasSizeToImageBounds(
        options: { stabilizeContainedViewport?: boolean } = {},
    ): void {
        updateCanvasSizeToImageBoundsImpl(this.buildDisplayGeometryContext(), options);
    }

    private shouldNormalizeCanvasSizeAfterStateRestore(): boolean {
        return shouldNormalizeCanvasSizeAfterStateRestoreImpl(this.buildDisplayGeometryContext());
    }

    private settleFitCoverScrollbarsAfterStateRestore(): void {
        settleFitCoverScrollbarsAfterStateRestoreImpl(this.buildDisplayGeometryContext());
    }

    private captureImageDisplayGeometry(): ImageDisplayGeometry | null {
        return captureImageDisplayGeometryImpl(this.buildDisplayGeometryContext());
    }

    private restoreMergedImageDisplayGeometry(geometry: ImageDisplayGeometry | null): void {
        restoreMergedImageDisplayGeometryImpl(this.buildDisplayGeometryContext(), geometry);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PRIVATE — transform controller wiring
    // ═══════════════════════════════════════════════════════════════════════

    /** Builds the transform controller context from the shared runtime state. */
    private buildTransformContext(): TransformContext {
        return this.contextFactory.buildTransformContext();
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PUBLIC — scale / rotate / reset
    // ═══════════════════════════════════════════════════════════════════════

    /** Animates the image to the given scale factor, clamped to configured limits. */
    scaleImage(factor: number): Promise<void> {
        return scaleImageAction(this.actionAccessFactory.buildTransformActionAccess(), factor);
    }

    /** Animates the image to the given rotation angle. Non-finite input no-ops. */
    rotateImage(degrees: number): Promise<void> {
        return rotateImageAction(this.actionAccessFactory.buildTransformActionAccess(), degrees);
    }

    flipHorizontal(): Promise<void> {
        return flipHorizontalAction(this.actionAccessFactory.buildTransformActionAccess());
    }

    flipVertical(): Promise<void> {
        return flipVerticalAction(this.actionAccessFactory.buildTransformActionAccess());
    }

    /** Resets scale, rotation, and flip state as one undoable transform. */
    resetImageTransform(): Promise<void> {
        return resetImageTransformAction(this.actionAccessFactory.buildTransformActionAccess());
    }

    private refreshUiAfterQueuedAnimation(): void {
        if (this.runtime.isDisposed || !this.runtime.canvas) return;
        this.updateInputs();
        this.updateUi();
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PUBLIC — history
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Restores a previously serialized canvas state.
     *
     * Delegates the snapshot-format-aware steps (parse, canvas resize,
     * `loadFromJSON`, position-based mask metadata restore) to
     * {@link loadFromStateImpl} in `core/state-serializer.ts` so the
     * facade and the merge/crop pipelines share one production path.
     *
     * Errors are routed through the documented `onError` callback. The
     * promise rejects with the original error so the history manager
     * leaves `currentIndex` untouched on a failed undo/redo restore.
     *
     * @param jsonString - JSON string returned by `saveState` (or parsed object).
     */
    async loadFromState(jsonString: string | CanvasJson): Promise<void> {
        return this.loadFromStateInternal(jsonString);
    }

    private async loadFromStateInternal(
        jsonString: string | CanvasJson,
        options?: InternalOperationOptions | null,
    ): Promise<void> {
        await loadFromStateAction(
            this.actionAccessFactory.buildEditorStateActionAccess(),
            jsonString,
            options,
        );
    }

    /**
     * Captures the current canvas state into the undo/redo history.
     * Called automatically after transforms, mask operations, and crop.
     */
    saveState(): void {
        this.saveStateInternal();
    }

    private saveStateInternal(options?: InternalOperationOptions | null): void {
        saveStateAction(this.actionAccessFactory.buildEditorStateActionAccess(), options);
    }

    /**
     * Undoes the last recorded action.
     *
     * Routed through {@link animQueue} so that undo is serialized with any
     * in-progress animation and rapid clicks cannot interleave canvas restores.
     * The {@link HistoryManager.isProcessing} lock provides a second line of
     * defence inside the history layer itself.
     *
     * After {@link dispose} the call resolves without touching the canvas.
     * The early return covers the case where dispose has already happened;
     * the inner check covers the case where dispose happens while waiting
     * in the animation queue.
     */
    undo(): Promise<void> {
        if (this.runtime.isDisposed) return Promise.resolve();
        if (!this.canRunIdleOperation('undo')) return Promise.resolve();
        this.finalizeActiveTextEditingIfNeeded();
        const context = this.buildCallbackContext('undo', true);
        const job = this.runtime.animQueue.add(async () => {
            if (this.runtime.isDisposed) return;
            this.runtime.activeStateRestoreOperation = 'undo';
            try {
                await this.runtime.historyManager.undo();
            } finally {
                this.runtime.activeStateRestoreOperation = null;
            }
        });
        this.emitBusyChangeIfChanged(context);
        return job.finally(() => {
            this.refreshUiAfterQueuedAnimation();
            this.emitBusyChangeIfChanged(context);
        });
    }

    /**
     * Redoes the next recorded action.
     *
     * Same serialization and dispose guarantees as {@link undo}.
     */
    redo(): Promise<void> {
        if (this.runtime.isDisposed) return Promise.resolve();
        if (!this.canRunIdleOperation('redo')) return Promise.resolve();
        this.finalizeActiveTextEditingIfNeeded();
        const context = this.buildCallbackContext('redo', true);
        const job = this.runtime.animQueue.add(async () => {
            if (this.runtime.isDisposed) return;
            this.runtime.activeStateRestoreOperation = 'redo';
            try {
                await this.runtime.historyManager.redo();
            } finally {
                this.runtime.activeStateRestoreOperation = null;
            }
        });
        this.emitBusyChangeIfChanged(context);
        return job.finally(() => {
            this.refreshUiAfterQueuedAnimation();
            this.emitBusyChangeIfChanged(context);
        });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PUBLIC — mask management
    // ═══════════════════════════════════════════════════════════════════════

    /** Creates and adds a mask shape, returning `null` when the operation cannot run. */
    createMask(config: MaskConfig = {}): MaskObject | null {
        return createMaskAction(this.actionAccessFactory.buildMaskActionAccess(), config);
    }

    /** Removes the currently selected mask and its label. */
    removeSelectedMask(): void {
        removeSelectedMaskAction(this.actionAccessFactory.buildMaskActionAccess());
    }

    /** Removes all masks and labels, or no-ops while guarded operations are active. */
    removeAllMasks(options: RemoveAllMasksOptions = {}): void {
        removeAllMasksActionImpl(this.actionAccessFactory.buildMaskActionAccess(), options);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PRIVATE — mask context builders
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Build the {@link CreateMaskContext} the mask factory reads/writes
     * through. The runtime owns `maskCounter`, `lastMask`, the canvas,
     * and history state; the context forwards access without duplicating
     * those fields.
     */
    private buildCreateMaskContext(): CreateMaskContext {
        return this.contextFactory.buildCreateMaskContext();
    }

    /**
     * Build the {@link RemoveMaskContext} the mask factory reads/writes
     * through for `removeSelectedMask` / `removeAllMasks`. The runtime
     * owns the canvas, history, and `lastMask`; the facade supplies the
     * DOM and label callbacks the factory needs.
     */
    private buildRemoveMaskContext(): RemoveMaskContext {
        return this.contextFactory.buildRemoveMaskContext();
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PRIVATE — mask label helpers
    // ═══════════════════════════════════════════════════════════════════════

    private buildMaskLabelContext(): MaskLabelManagerContext | null {
        return this.contextFactory.buildMaskLabelContext();
    }

    private removeLabelForMask(mask: MaskObject): void {
        const context = this.buildMaskLabelContext();
        if (!context) return;
        removeLabelForMask(context, mask);
    }

    private createLabelForMask(mask: MaskObject): void {
        const context = this.buildMaskLabelContext();
        if (!context) return;
        createLabelForMask(context, mask);
    }

    private hideAllMaskLabels(): void {
        const context = this.buildMaskLabelContext();
        if (!context) return;
        hideAllMaskLabels(context);
    }

    private syncMaskLabel(mask: MaskObject): void {
        const context = this.buildMaskLabelContext();
        if (!context) return;
        syncMaskLabel(context, mask);
    }

    private showLabelForMask(mask: MaskObject): void {
        const context = this.buildMaskLabelContext();
        if (!context) return;
        showLabelForMask(context, mask);
    }

    private handleObjectMovingScalingRotating(target: FabricNS.FabricObject): void {
        handleObjectMovingScalingRotatingImpl(
            this.actionAccessFactory.buildSelectionControllerAccess(),
            target,
        );
    }

    private handleObjectModified(target: FabricNS.FabricObject): void {
        handleObjectModifiedImpl(this.actionAccessFactory.buildSelectionControllerAccess(), target);
    }

    private handleSelectionChanged(selected: FabricNS.FabricObject[]): void {
        handleSelectionChangedImpl(
            this.actionAccessFactory.buildSelectionControllerAccess(),
            selected,
        );
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PRIVATE — mask list DOM
    // ═══════════════════════════════════════════════════════════════════════

    private buildMaskListContext(): MaskListContext {
        return this.contextFactory.buildMaskListContext();
    }

    private updateMaskList(): void {
        renderMaskList(this.buildMaskListContext());
    }

    private updateMaskListSelection(selectedMask: MaskObject | null): void {
        updateMaskListSelection(this.buildMaskListContext(), selectedMask);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PUBLIC — annotations
    // ═══════════════════════════════════════════════════════════════════════

    enterTextMode(): void {
        enterTextModeAction(this.actionAccessFactory.buildAnnotationModeActionAccess());
    }

    exitTextMode(): void {
        exitTextModeAction(this.actionAccessFactory.buildAnnotationModeActionAccess());
    }

    isTextMode(): boolean {
        return this.runtime.textSession !== null;
    }

    createTextAnnotation(config: TextAnnotationConfig = {}): TextAnnotationObject | null {
        return createTextAnnotationAction(
            this.actionAccessFactory.buildAnnotationModeActionAccess(),
            config,
        );
    }

    enterDrawMode(): void {
        enterDrawModeAction(this.actionAccessFactory.buildAnnotationModeActionAccess());
    }

    exitDrawMode(): void {
        exitDrawModeAction(this.actionAccessFactory.buildAnnotationModeActionAccess());
    }

    isDrawMode(): boolean {
        return this.runtime.drawSession !== null;
    }

    getTextConfig(): Readonly<ResolvedTextAnnotationConfig> {
        return cloneResolvedTextAnnotationConfig(this.runtime.currentTextConfig);
    }

    setTextConfig(config: TextAnnotationConfig): void {
        this.applyTextConfigPatch(config, 'setTextConfig');
    }

    resetTextConfig(): void {
        this.applyTextConfigPatch(this.runtime.defaultTextConfig, 'resetTextConfig');
    }

    setTextColor(color: string): void {
        this.applyTextConfigPatch({ fill: color }, 'setTextColor');
    }

    setTextFontSize(size: number): void {
        this.applyTextConfigPatch({ fontSize: size }, 'setTextFontSize');
    }

    getDrawConfig(): Readonly<ResolvedDrawConfig> {
        return cloneResolvedDrawConfig(this.runtime.currentDrawConfig);
    }

    setDrawConfig(config: DrawConfig): void {
        this.applyDrawConfigPatch(config, 'setDrawConfig');
    }

    resetDrawConfig(): void {
        this.applyDrawConfigPatch(this.runtime.defaultDrawConfig, 'resetDrawConfig');
    }

    setDrawColor(color: string): void {
        this.applyDrawConfigPatch({ color }, 'setDrawColor');
    }

    setDrawBrushSize(size: number): void {
        this.applyDrawConfigPatch({ brushSize: size }, 'setDrawBrushSize');
    }

    removeSelectedAnnotation(): void {
        if (!this.runtime.canvas) return;
        if (!this.canRunIdleOperation('removeSelectedAnnotation')) return;
        const callbackContext = this.buildCallbackContext('removeSelectedAnnotation', false);
        removeSelectedAnnotationAction(
            this.actionAccessFactory.buildEditableObjectActionAccess(),
            callbackContext,
        );
    }

    removeAllAnnotations(options: RemoveAllAnnotationsOptions = {}): void {
        if (!this.runtime.canvas) return;
        if (!this.canRunIdleOperation('removeAllAnnotations', options)) return;
        const callbackContext = this.buildCallbackContext('removeAllAnnotations', false);
        removeAllAnnotationsAction(
            this.actionAccessFactory.buildEditableObjectActionAccess(),
            options,
            callbackContext,
        );
    }

    updateAnnotation(annotationId: number, config: AnnotationUpdateConfig): void {
        if (!this.runtime.canvas) return;
        if (!this.canRunIdleOperation('updateAnnotation')) return;
        const callbackContext = this.buildCallbackContext('updateAnnotation', false);
        updateAnnotationAction(
            this.actionAccessFactory.buildEditableObjectActionAccess(),
            annotationId,
            config,
            callbackContext,
        );
    }

    updateSelectedAnnotation(config: AnnotationUpdateConfig): void {
        if (!this.runtime.canvas) return;
        if (!this.canRunIdleOperation('updateSelectedAnnotation')) return;
        const callbackContext = this.buildCallbackContext('updateSelectedAnnotation', false);
        updateSelectedAnnotationAction(
            this.actionAccessFactory.buildEditableObjectActionAccess(),
            config,
            callbackContext,
        );
    }

    deleteSelectedObject(): void {
        if (!this.runtime.canvas) return;
        if (!this.canRunIdleOperation('deleteSelectedObject')) return;
        this.finalizeActiveTextEditingIfNeeded();
        const callbackContext = this.buildCallbackContext('deleteSelectedObject', false);
        deleteSelectedEditableObjects(
            this.actionAccessFactory.buildEditableObjectActionAccess(),
            callbackContext,
        );
    }

    bringSelectedObjectForward(): void {
        this.moveSelectedEditableObject('bringSelectedObjectForward');
    }

    sendSelectedObjectBackward(): void {
        this.moveSelectedEditableObject('sendSelectedObjectBackward');
    }

    bringSelectedObjectToFront(): void {
        this.moveSelectedEditableObject('bringSelectedObjectToFront');
    }

    sendSelectedObjectToBack(): void {
        this.moveSelectedEditableObject('sendSelectedObjectToBack');
    }

    private buildAnnotationManagerContext(): AnnotationManagerContext {
        return this.contextFactory.buildAnnotationManagerContext();
    }

    private buildAnnotationListContext(): AnnotationListContext {
        return this.contextFactory.buildAnnotationListContext();
    }

    private updateAnnotationList(): void {
        renderAnnotationList(this.buildAnnotationListContext());
    }

    private updateAnnotationListSelection(selectedAnnotation: AnnotationObject | null): void {
        updateAnnotationListSelection(this.buildAnnotationListContext(), selectedAnnotation);
    }

    private buildTextControllerContext(): TextControllerContext {
        return this.contextFactory.buildTextControllerContext();
    }

    private buildDrawControllerContext(): DrawControllerContext {
        return this.contextFactory.buildDrawControllerContext();
    }

    private applyTextConfigPatch(
        config: TextAnnotationConfig,
        operation: ImageEditorOperation,
    ): void {
        applyTextConfigPatchAction(
            this.actionAccessFactory.buildAnnotationConfigActionAccess(),
            config,
            operation,
        );
    }

    private applyDrawConfigPatch(config: DrawConfig, operation: ImageEditorOperation): void {
        applyDrawConfigPatchAction(
            this.actionAccessFactory.buildAnnotationConfigActionAccess(),
            config,
            operation,
        );
    }

    private applyTextColorInput(color: string): void {
        applyTextColorInputAction(
            this.actionAccessFactory.buildAnnotationConfigActionAccess(),
            color,
        );
    }

    private applyTextFontSizeInput(size: number): void {
        applyTextFontSizeInputAction(
            this.actionAccessFactory.buildAnnotationConfigActionAccess(),
            size,
        );
    }

    private applyDrawColorInput(color: string): void {
        applyDrawColorInputAction(
            this.actionAccessFactory.buildAnnotationConfigActionAccess(),
            color,
        );
    }

    private applyDrawBrushSizeInput(size: number): void {
        applyDrawBrushSizeInputAction(
            this.actionAccessFactory.buildAnnotationConfigActionAccess(),
            size,
        );
    }

    private moveSelectedEditableObject(operation: ImageEditorOperation): void {
        if (!this.runtime.canvas) return;
        if (!this.canRunIdleOperation(operation)) return;
        moveSelectedEditableObjectImpl(
            this.actionAccessFactory.buildEditableObjectActionAccess(),
            operation,
        );
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PUBLIC — merge / export / download
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Bakes all current masks into the base image and records one history entry.
     * Resolves without mutation while an animation or incompatible tool mode is active.
     */
    async mergeMasks(): Promise<void> {
        await mergeMasksAction(this.actionAccessFactory.buildExportActionAccess());
    }

    /** Triggers a browser download, or no-ops while guarded operations are active. */
    async downloadImage(options?: ImageExportOptions): Promise<void> {
        await downloadImageAction(this.actionAccessFactory.buildExportActionAccess(), options);
    }

    /**
     * Exports the canvas as a Base64 data URL.
     * Returns `''` when no image is loaded or the operation is currently guarded.
     */
    async exportImageBase64(options?: ImageExportOptions): Promise<string> {
        return await exportImageBase64Action(
            this.actionAccessFactory.buildExportActionAccess(),
            options,
        );
    }

    /**
     * Exports the canvas as a browser `File`.
     * Rejects when the operation is guarded because `Promise<File>` has no no-op value.
     */
    async exportImageFile(options?: ImageExportOptions): Promise<File> {
        return await exportImageFileAction(
            this.actionAccessFactory.buildExportActionAccess(),
            options,
        );
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PRIVATE — export / merge context builders
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Build the {@link ExportServiceContext} the export service reads
     * through. The runtime owns the canvas, options, and `originalImage`
     * reference; the context exposes only the export-facing accessors.
     */
    private buildExportServiceContext(): ExportServiceContext {
        return this.contextFactory.buildExportServiceContext();
    }

    /**
     * Build the {@link MergeMasksContext} the merge pipeline reads
     * through. Extends the export-service context with the history
     * manager, container element, transactional `loadImage`, and the
     * `saveState`/`loadFromState`/`removeAllMasksNoHistory` callbacks
     * the merge needs.
     */
    private buildMergeMasksContext(operationToken?: OperationToken): MergeMasksContext {
        return this.contextFactory.buildMergeMasksContext(operationToken);
    }

    private buildMergeAnnotationsContext(operationToken?: OperationToken): MergeAnnotationsContext {
        return this.contextFactory.buildMergeAnnotationsContext(operationToken);
    }

    /**
     * Capture a snapshot string suitable for `loadFromState` without
     * pushing it onto the history stack. Used by the merge and crop
     * pipelines, which manage their own enclosing history entries and
     * need the same wire format `saveState` writes to history.
     *
     * Routes through `core/state-serializer.ts` so the snapshot wire
     * format has one production path. Does NOT push a history entry
     * and does NOT update `lastSnapshot`.
     */
    private captureSnapshotInternal(): string {
        return captureSnapshotAction(this.actionAccessFactory.buildEditorStateActionAccess());
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PUBLIC — mosaic mode
    // ═══════════════════════════════════════════════════════════════════════

    enterMosaicMode(): void {
        enterMosaicModeAction(this.actionAccessFactory.buildMosaicActionAccess());
    }

    exitMosaicMode(): void {
        exitMosaicModeAction(this.actionAccessFactory.buildMosaicActionAccess());
    }

    isMosaicMode(): boolean {
        return this.runtime.mosaicSession !== null;
    }

    getMosaicConfig(): Readonly<ResolvedMosaicConfig> {
        return cloneResolvedMosaicConfig(this.runtime.currentMosaicConfig);
    }

    setMosaicConfig(config: MosaicConfig): void {
        this.applyMosaicConfigPatch(config, 'setMosaicConfig');
    }

    resetMosaicConfig(): void {
        resetMosaicConfigAction(this.actionAccessFactory.buildMosaicActionAccess());
    }

    setMosaicBrushSize(size: number): void {
        this.applyMosaicConfigPatch({ brushSize: size }, 'setMosaicBrushSize');
    }

    setMosaicBlockSize(size: number): void {
        this.applyMosaicConfigPatch({ blockSize: size }, 'setMosaicBlockSize');
    }

    private applyMosaicConfigPatch(config: MosaicConfig, operation: ImageEditorOperation): void {
        applyMosaicConfigPatchAction(
            this.actionAccessFactory.buildMosaicActionAccess(),
            config,
            operation,
        );
    }

    private buildMosaicControllerContext(): MosaicControllerContext {
        return this.contextFactory.buildMosaicControllerContext();
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PUBLIC — crop mode
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Enters crop mode and adds the interactive crop rectangle.
     * No-ops while an animation or another incompatible operation is active.
     */
    enterCropMode(options: CropModeOptions = {}): void {
        enterCropModeAction(this.actionAccessFactory.buildCropActionAccess(), options);
    }

    /** Updates the active crop rectangle's aspect ratio, or no-ops outside crop mode. */
    setCropAspectRatio(aspectRatio: CropAspectRatio): void {
        setCropAspectRatioAction(this.actionAccessFactory.buildCropActionAccess(), aspectRatio);
    }

    /** Cancels crop mode without applying the crop or pushing history. */
    cancelCrop(): void {
        cancelCropAction(this.actionAccessFactory.buildCropActionAccess());
    }

    /**
     * Applies the current crop rectangle and records one history entry.
     * Guarded no-ops leave the open crop session intact for a later retry.
     */
    async applyCrop(): Promise<void> {
        await applyCropAction(this.actionAccessFactory.buildCropActionAccess());
    }

    /**
     * Build the {@link CropControllerContext} the crop controller reads
     * through. The runtime owns the crop session pointer, canvas,
     * resolved options, and history manager while the facade supplies
     * transactional loader and UI callbacks.
     */
    private buildCropControllerContext(operationToken?: OperationToken): CropControllerContext {
        return this.contextFactory.buildCropControllerContext(operationToken);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PRIVATE — UI helpers
    // ═══════════════════════════════════════════════════════════════════════

    private updateInputs(): void {
        applyEditorInputState(
            {
                currentScale: this.runtime.currentScale,
                mosaicConfig: this.getMosaicConfig(),
                textConfig: this.getTextConfig(),
                drawConfig: this.getDrawConfig(),
            },
            (key) => this.resolveElement<HTMLInputElement>(key),
        );
    }

    async mergeAnnotations(): Promise<void> {
        await mergeAnnotationsAction(this.actionAccessFactory.buildExportActionAccess());
    }

    private updateUi(): void {
        const snapshot = buildEditorControlSnapshot(this.runtime);
        if (!snapshot) return;

        applyEditorControlState(snapshot, (key, enabled) => {
            this.setControlEnabled(key, enabled);
        });
    }

    private buildControlElementContext(): EditorControlElementContext {
        return {
            elements: this.runtime.elements,
            originalDisabledMap: this.runtime.elementOriginalDisabledMap,
            originalAriaDisabledMap: this.runtime.elementOriginalAriaDisabledMap,
            originalPointerEventsMap: this.runtime.elementOriginalPointerEventsMap,
            getElement: (key) => this.resolveElement(key),
        };
    }

    private setControlEnabled(key: ElementKey, isEnabled: boolean): void {
        setEditorControlEnabled(this.buildControlElementContext(), key, isEnabled);
    }

    private restoreElementOriginalStates(): void {
        restoreEditorControlOriginalStates(this.buildControlElementContext());
    }

    private updatePlaceholderStatus(): void {
        setPlaceholderVisibleImpl(
            this.runtime.placeholderElement,
            this.runtime.containerElement,
            this.runtime.options.showPlaceholder ? !this.runtime.originalImage : false,
        );
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PUBLIC — dispose
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Cleans up all DOM event listeners and disposes the Fabric.js Canvas.
     * Call this when the editor is no longer needed to prevent memory leaks.
     *
     * Teardown sequence:
     *
     * 1. Short-circuit on a second call so `dispose` is idempotent. This
     *    also guards against re-running
     *    the teardown path after the canvas reference has already been
     *    nulled.
     * 2. Set `isDisposed = true` so in-flight animation `onChange`/
     *    `onComplete` callbacks bail before touching the canvas
     * and so disposed-aware DOM handlers
     *    exit early.
     * 3. Drain the {@link AnimationQueue} so callers awaiting an enqueued
     *    slot do not hang after teardown.
     *    The currently-executing entry, if any, is not interrupted but
     *    settles promptly because its disposed-aware callbacks see the
     *    flag and exit.
     * 4. Detach every DOM listener via the bindings registry's
     *    `removeAll`, wrapped in try/catch
     *    inside the registry so already-detached listeners do not throw.
     * 5. Drop the crop rectangle if a crop session was open and dispose
     *    the underlying Fabric canvas, matching teardown order.
     */
    dispose(): void {
        // (1) Idempotent: a second `dispose` is a no-op.
        if (this.runtime.isDisposed) return;
        const context = this.buildCallbackContext('dispose', false);
        const previousImage = this.runtime.originalImage;

        // (2) Signal in-flight animations and bound handlers to stop
        //     touching the canvas. Set BEFORE draining the queue so the
        //     active animation's disposed-aware callbacks see `true` on
        //     their next tick. The {@link OperationGuard} mirrors the
        //     same flag so the transform controller and Fabric animation
        //     wrapper short-circuit through the shared guard
        //.
        this.runtime.isDisposed = true;
        this.runtime.operationGuard.markDisposed();

        // (3) Settle every queued animation. `clear` resolves pending
        //     entries (no rejection reason — the orchestrator's own
        //     dispose guards already prevent further canvas access) so
        //     `await editor.scaleImage(2)` callers do not hang.
        this.runtime.animQueue.clear();

        // (4) Detach every recorded DOM listener. The registry handles
        //     missing/already-detached elements internally.
        this.runtime.domBindings?.removeAll();
        safelyRemoveKeyboardListener(this.runtime.keyboardDocument, this.runtime.keyboardHandler);
        this.runtime.keyboardHandler = null;
        this.runtime.keyboardDocument = null;
        this.restoreElementOriginalStates();

        // (5) Drop active tool sessions best-effort. Fabric may already
        //     have disposed session objects during a rollback.
        safelyExitActiveSession(
            this.runtime.cropSession !== null,
            this.runtime.canvas,
            () => cancelCropImpl(this.buildCropControllerContext()),
            () => {
                this.runtime.cropSession = null;
            },
        );
        safelyExitActiveSession(
            this.runtime.mosaicSession !== null,
            this.runtime.canvas,
            () => exitMosaicModeImpl(this.buildMosaicControllerContext()),
            () => {
                this.runtime.mosaicSession = null;
            },
        );
        safelyExitActiveSession(
            this.runtime.textSession !== null,
            this.runtime.canvas,
            () => exitTextModeImpl(this.buildTextControllerContext()),
            () => {
                this.runtime.textSession = null;
            },
        );
        safelyExitActiveSession(
            this.runtime.drawSession !== null,
            this.runtime.canvas,
            () => exitDrawModeImpl(this.buildDrawControllerContext()),
            () => {
                this.runtime.drawSession = null;
            },
        );

        if (this.runtime.canvas) {
            safelyDisposeCanvas(this.runtime.canvas);
            this.runtime.canvas = null;
            this.runtime.canvasElement = null;
            this.runtime.isImageLoadedToCanvas = false;
        }
        this.runtime.originalImage = null;
        this.runtime.currentImageMimeType = null;
        this.runtime.lastMask = null;
        this.runtime.maskCounter = 0;
        this.runtime.annotationCounter = 0;
        this.runtime.currentScale = 1;
        this.runtime.currentRotation = 0;
        this.runtime.baseImageScale = 1;
        this.runtime.lastSnapshot = null;

        // Drop the transform controller — the Fabric canvas reference
        // it captured via `TransformContext.canvas` is now disposed, so
        // the controller would crash if a queued entry somehow ran
        // after dispose. The animQueue.clear above already settles
        // pending entries, but null'ing the controller defends against
        // re-init paths that recreate state after dispose.
        this.runtime.transformController = null;

        // Clear the layout-manager viewport cache so a re-instantiation of
        // the editor on the same DOM does not inherit stale measurements.
        this.runtime.viewportCache.clear();
        if (previousImage) {
            this.emitOptionCallback('onImageCleared', [previousImage, context]);
        }
        this.emitImageChanged(context);
        this.emitBusyChangeIfChanged(context);
        this.emitOptionCallback('onEditorDisposed', [context]);
    }
}
