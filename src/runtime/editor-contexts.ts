/**
 * Context factory for subsystem controllers and services.
 *
 * The factory converts runtime accessors into the small context objects used
 * by image, mask, crop, export, annotation, and mosaic modules.
 */

import type * as FabricNS from 'fabric';

import {
    attachTextEditingHandlersToAnnotations,
    type TextControllerContext,
    type TextSession,
} from '../annotation/text-controller.js';
import type { DrawControllerContext, DrawSession } from '../annotation/draw-controller.js';
import {
    removeAllAnnotations as removeAllAnnotationsImpl,
    type AnnotationListContext,
    type AnnotationManagerContext,
} from '../annotation/annotation-manager.js';
import { syncAnnotationRuntimeStates } from '../annotation/annotation-style.js';
import type { CropControllerContext, CropSession } from '../crop/crop-controller.js';
import {
    exportImageBase64 as exportImageBase64Impl,
    type ExportServiceContext,
    type MergeAnnotationsContext,
    type MergeMasksContext,
} from '../export/export-service.js';
import type { HistoryManager } from '../history/history-manager.js';
import type { LoadImageContext } from '../image/image-loader.js';
import type { ViewportCache } from '../image/layout-manager.js';
import type { TransformContext } from '../image/transform-controller.js';
import {
    removeAllMasks as removeAllMasksImpl,
    type CreateMaskContext,
    type RemoveMaskContext,
} from '../mask/mask-factory.js';
import type { MaskLabelManagerContext } from '../mask/mask-label-manager.js';
import type { MaskListContext } from '../mask/mask-list.js';
import { reattachMaskHoverHandlers } from '../mask/mask-style.js';
import type { MosaicControllerContext, MosaicSession } from '../mosaic/mosaic-controller.js';
import type { OperationGuard, OperationToken } from '../core/operation-guard.js';
import {
    isMaskObject,
    type AnnotationObject,
    type BaseImageObject,
    type FabricModule,
    type ImageEditorCallbackContext,
    type ImageEditorOperation,
    type ImageMimeType,
    type LoadImageOptions,
    type MaskObject,
    type ResolvedDrawConfig,
    type ResolvedMosaicConfig,
    type ResolvedOptions,
    type ResolvedTextAnnotationConfig,
} from '../core/public-types.js';

export interface EditorContextFactoryAccess {
    getFabric(): FabricModule;
    getOptions(): ResolvedOptions;
    getRuntimeOptions(): ResolvedOptions;
    getHistoryManager(): HistoryManager;
    getOperationGuard(): OperationGuard;
    getCanvas(): FabricNS.Canvas | null;
    getLiveCanvas(operationName: string): FabricNS.Canvas;
    getContainerElement(): HTMLElement | null;
    getPlaceholderElement(): HTMLElement | null;
    getViewportCache(): ViewportCache;
    isDisposed(): boolean;
    isImageLoaded(): boolean;

    getOriginalImage(): BaseImageObject | null;
    setOriginalImage(image: BaseImageObject | null): void;
    getIsImageLoadedToCanvas(): boolean;
    setIsImageLoadedToCanvas(value: boolean): void;
    getCurrentImageMimeType(): ImageMimeType | null;
    setCurrentImageMimeType(mimeType: ImageMimeType | null): void;
    getLastSnapshot(): string | null;
    setLastSnapshot(snapshot: string | null): void;

    getCurrentScale(): number;
    setCurrentScale(scale: number): void;
    getCurrentRotation(): number;
    setCurrentRotation(rotation: number): void;
    getBaseImageScale(): number;
    setBaseImageScale(scale: number): void;
    getMaskCounter(): number;
    setMaskCounter(value: number): void;
    getLastMask(): MaskObject | null;
    setLastMask(mask: MaskObject | null): void;
    getAnnotationCounter(): number;
    setAnnotationCounter(value: number): void;

    getTextConfig(): ResolvedTextAnnotationConfig;
    getDrawConfig(): ResolvedDrawConfig;
    getMosaicConfig(): ResolvedMosaicConfig;
    getTextSession(): TextSession | null;
    setTextSession(session: TextSession | null): void;
    getDrawSession(): DrawSession | null;
    setDrawSession(session: DrawSession | null): void;
    getMosaicSession(): MosaicSession | null;
    setMosaicSession(session: MosaicSession | null): void;
    getCropSession(): CropSession | null;
    setCropSession(session: CropSession | null): void;

    saveCanvasState(): void;
    saveCanvasStateWithAnimationBypass(): void;
    setSuppressSaveState(suppress: boolean): void;
    captureSnapshot(): string;
    loadImageForOperation(
        operationToken: OperationToken | undefined,
        imageBase64: string,
        options?: LoadImageOptions,
    ): Promise<void>;
    loadMergedImage(
        operationToken: OperationToken | undefined,
        imageBase64: string,
        options?: LoadImageOptions,
    ): Promise<void>;
    loadFromStateForOperation(
        operationToken: OperationToken | undefined,
        snapshot: string,
    ): Promise<void>;

    setCanvasSize(widthPx: number, heightPx: number): void;
    updateCanvasSizeToImageBounds(): void;
    alignObjectBoundingBoxToCanvasTopLeft(object: FabricNS.FabricObject): void;
    syncMaskLabel(mask: MaskObject): void;
    removeLabelForMask(mask: MaskObject): void;
    hideAllMaskLabels(): void;
    setPlaceholderVisible(show: boolean): void;
    updateMaskList(): void;
    updateAnnotationList(): void;
    updateUi(): void;
    updateInputs(): void;

    getMaskListElement(): HTMLElement | null | undefined;
    handleMaskSelected(mask: MaskObject): void;
    getAnnotationListElement(): HTMLElement | null | undefined;
    handleAnnotationSelected(annotation: AnnotationObject): void;
    getMasks(): MaskObject[];
    getAnnotations(): AnnotationObject[];

    emitImageChanged(context: ImageEditorCallbackContext): void;
    emitAnnotationsChanged(context: ImageEditorCallbackContext): void;
    emitBusyChangeIfChanged(context: ImageEditorCallbackContext): void;
    buildCallbackContext(
        operation: ImageEditorOperation,
        isInternalOperation?: boolean,
    ): ImageEditorCallbackContext;
}

export class EditorContextFactory {
    constructor(private readonly access: EditorContextFactoryAccess) {}

    buildExportServiceContext(): ExportServiceContext {
        const access = this.access;
        return {
            fabric: access.getFabric(),
            canvas: access.getLiveCanvas('export'),
            options: access.getOptions(),
            isImageLoaded: () => access.isImageLoaded(),
            getOriginalImage: () => access.getOriginalImage(),
        };
    }

    buildLoadImageContext(): LoadImageContext {
        const access = this.access;
        return {
            fabric: access.getFabric(),
            canvas: access.getLiveCanvas('loadImage'),
            options: access.getRuntimeOptions(),
            containerElement: access.getContainerElement(),
            placeholderElement: access.getPlaceholderElement(),
            viewportCache: access.getViewportCache(),
            getOriginalImage: () => access.getOriginalImage(),
            setOriginalImage: (image) => {
                access.setOriginalImage(image);
            },
            getIsImageLoadedToCanvas: () => access.getIsImageLoadedToCanvas(),
            setIsImageLoadedToCanvas: (value) => {
                access.setIsImageLoadedToCanvas(value);
            },
            getLastSnapshot: () => access.getLastSnapshot(),
            setLastSnapshot: (snapshot) => {
                access.setLastSnapshot(snapshot);
            },
            getMaskCounter: () => access.getMaskCounter(),
            setMaskCounter: (value) => {
                access.setMaskCounter(value);
            },
            getAnnotationCounter: () => access.getAnnotationCounter(),
            setAnnotationCounter: (value) => {
                access.setAnnotationCounter(value);
            },
            getCurrentScale: () => access.getCurrentScale(),
            setCurrentScale: (scale) => {
                access.setCurrentScale(scale);
            },
            getCurrentRotation: () => access.getCurrentRotation(),
            setCurrentRotation: (rotation) => {
                access.setCurrentRotation(rotation);
            },
            getBaseImageScale: () => access.getBaseImageScale(),
            setBaseImageScale: (scale) => {
                access.setBaseImageScale(scale);
            },
            getCurrentImageMimeType: () => access.getCurrentImageMimeType(),
            setCurrentImageMimeType: (mimeType) => {
                access.setCurrentImageMimeType(mimeType);
            },
            setPlaceholderVisible: (show) => {
                access.setPlaceholderVisible(show);
            },
        };
    }

    buildTransformContext(): TransformContext {
        const access = this.access;
        return {
            canvas: access.getLiveCanvas('buildTransformContext'),
            options: access.getOptions(),
            guard: access.getOperationGuard(),
            getOriginalImage: () => access.getOriginalImage(),
            getCurrentScale: () => access.getCurrentScale(),
            setCurrentScale: (scale) => {
                access.setCurrentScale(scale);
            },
            getCurrentRotation: () => access.getCurrentRotation(),
            setCurrentRotation: (rotation) => {
                access.setCurrentRotation(rotation);
            },
            getBaseImageScale: () => access.getBaseImageScale(),
            saveCanvasState: () => {
                access.saveCanvasStateWithAnimationBypass();
            },
            setSuppressSaveState: (suppress) => {
                access.setSuppressSaveState(suppress);
            },
            afterTransformSnap: () => {
                const canvas = access.getCanvas();
                const originalImage = access.getOriginalImage();
                if (access.isDisposed() || !canvas || !originalImage) return;
                access.updateCanvasSizeToImageBounds();
                access.alignObjectBoundingBoxToCanvasTopLeft(originalImage);
                canvas
                    .getObjects()
                    .filter(isMaskObject)
                    .forEach((maskObject) => {
                        access.syncMaskLabel(maskObject);
                    });
            },
        };
    }

    buildCreateMaskContext(): CreateMaskContext {
        const access = this.access;
        return {
            fabric: access.getFabric(),
            canvas: access.getLiveCanvas('createMask'),
            options: access.getRuntimeOptions(),
            getLastMask: () => access.getLastMask(),
            setLastMask: (maskObject) => {
                access.setLastMask(maskObject);
            },
            getMaskCounter: () => access.getMaskCounter(),
            setMaskCounter: (value) => {
                access.setMaskCounter(value);
            },
            updateMaskList: () => {
                access.updateMaskList();
            },
            saveCanvasState: () => {
                access.saveCanvasState();
            },
            expandCanvasIfNeeded: (widthPx, heightPx) => {
                access.setCanvasSize(widthPx, heightPx);
            },
        };
    }

    buildRemoveMaskContext(): RemoveMaskContext {
        const access = this.access;
        return {
            canvas: access.getLiveCanvas('removeMask'),
            removeLabelForMask: (mask) => {
                access.removeLabelForMask(mask);
            },
            updateMaskList: () => {
                access.updateMaskList();
            },
            saveCanvasState: () => {
                access.saveCanvasState();
            },
            setLastMask: (maskObject) => {
                access.setLastMask(maskObject);
            },
        };
    }

    buildMaskLabelContext(): MaskLabelManagerContext | null {
        const canvas = this.access.getCanvas();
        if (!canvas) return null;
        return {
            fabric: this.access.getFabric(),
            canvas,
            options: this.access.getOptions(),
        };
    }

    buildMaskListContext(): MaskListContext {
        const access = this.access;
        return {
            canvas: access.getCanvas(),
            getCanvas: () => access.getCanvas(),
            getListElement: () => access.getMaskListElement(),
            listOrder: access.getOptions().maskListOrder,
            onMaskSelected: (mask) => {
                access.handleMaskSelected(mask);
            },
        };
    }

    buildAnnotationManagerContext(): AnnotationManagerContext {
        const access = this.access;
        return {
            canvas: access.getLiveCanvas('annotationManager'),
            saveCanvasState: () => access.saveCanvasState(),
            updateUi: () => access.updateUi(),
        };
    }

    buildAnnotationListContext(): AnnotationListContext {
        const access = this.access;
        return {
            canvas: access.getCanvas(),
            getCanvas: () => access.getCanvas(),
            getListElement: () => access.getAnnotationListElement(),
            listOrder: access.getOptions().annotationListOrder,
            onAnnotationSelected: (annotation) => {
                access.handleAnnotationSelected(annotation);
            },
        };
    }

    buildTextControllerContext(): TextControllerContext {
        const access = this.access;
        return {
            fabric: access.getFabric(),
            canvas: access.getLiveCanvas('textController'),
            options: access.getOptions(),
            getOriginalImage: () => access.getOriginalImage(),
            getTextConfig: () => access.getTextConfig(),
            isImageLoaded: () => access.isImageLoaded(),
            getAnnotationCounter: () => access.getAnnotationCounter(),
            setAnnotationCounter: (value) => {
                access.setAnnotationCounter(value);
            },
            getTextSession: () => access.getTextSession(),
            setTextSession: (session) => {
                access.setTextSession(session);
            },
            saveCanvasState: () => access.saveCanvasState(),
            updateAnnotationList: () => access.updateAnnotationList(),
            updateUi: () => access.updateUi(),
            emitAnnotationsChanged: (context) => access.emitAnnotationsChanged(context),
            emitImageChanged: (context) => access.emitImageChanged(context),
            buildCallbackContext: (operation) => access.buildCallbackContext(operation, false),
        };
    }

    buildDrawControllerContext(): DrawControllerContext {
        const access = this.access;
        return {
            fabric: access.getFabric(),
            canvas: access.getLiveCanvas('drawController'),
            options: access.getOptions(),
            getDrawConfig: () => access.getDrawConfig(),
            isImageLoaded: () => access.isImageLoaded(),
            getAnnotationCounter: () => access.getAnnotationCounter(),
            setAnnotationCounter: (value) => {
                access.setAnnotationCounter(value);
            },
            getDrawSession: () => access.getDrawSession(),
            setDrawSession: (session) => {
                access.setDrawSession(session);
            },
            saveCanvasState: () => access.saveCanvasState(),
            updateAnnotationList: () => access.updateAnnotationList(),
            updateUi: () => access.updateUi(),
            emitAnnotationsChanged: (context) => access.emitAnnotationsChanged(context),
            emitImageChanged: (context) => access.emitImageChanged(context),
            buildCallbackContext: (operation) => access.buildCallbackContext(operation, false),
        };
    }

    buildMosaicControllerContext(): MosaicControllerContext {
        const access = this.access;
        return {
            fabric: access.getFabric(),
            canvas: access.getLiveCanvas('mosaicController'),
            options: access.getOptions(),
            historyManager: access.getHistoryManager(),
            getMosaicConfig: () => access.getMosaicConfig(),
            isImageLoaded: () => access.isImageLoaded(),
            getOriginalImage: () => access.getOriginalImage(),
            setOriginalImage: (image) => {
                access.setOriginalImage(image);
            },
            getCurrentImageMimeType: () => access.getCurrentImageMimeType(),
            setCurrentImageMimeType: (mimeType) => {
                access.setCurrentImageMimeType(mimeType);
            },
            getLastSnapshot: () => access.getLastSnapshot(),
            setLastSnapshot: (snapshot) => {
                access.setLastSnapshot(snapshot);
            },
            captureSnapshot: () => access.captureSnapshot(),
            loadFromState: (snapshot) => access.loadFromStateForOperation(undefined, snapshot),
            updateUi: () => access.updateUi(),
            updateInputs: () => access.updateInputs(),
            hideAllMaskLabels: () => access.hideAllMaskLabels(),
            emitImageChanged: (context) => {
                access.emitImageChanged(context);
            },
            emitBusyChangeIfChanged: (context) => {
                access.emitBusyChangeIfChanged(context);
            },
            buildCallbackContext: (operation, isInternal) =>
                access.buildCallbackContext(operation, isInternal),
            getMosaicSession: () => access.getMosaicSession(),
            setMosaicSession: (session) => {
                access.setMosaicSession(session);
            },
        };
    }

    buildCropControllerContext(operationToken?: OperationToken): CropControllerContext {
        const access = this.access;
        return {
            fabric: access.getFabric(),
            canvas: access.getLiveCanvas('cropController'),
            options: access.getOptions(),
            historyManager: access.getHistoryManager(),
            isImageLoaded: () => access.isImageLoaded(),
            getOriginalImage: () => access.getOriginalImage(),
            getCurrentImageMimeType: () => access.getCurrentImageMimeType(),
            getCropSession: () => access.getCropSession(),
            setCropSession: (session) => {
                access.setCropSession(session);
            },
            saveState: () => access.captureSnapshot(),
            loadFromState: (snapshot) => access.loadFromStateForOperation(operationToken, snapshot),
            loadImage: (base64, providedOptions) =>
                access.loadImageForOperation(operationToken, base64, providedOptions),
            getMaskCounter: () => access.getMaskCounter(),
            setMaskCounter: (value) => {
                access.setMaskCounter(value);
            },
            updateMaskList: () => {
                access.updateMaskList();
            },
        };
    }

    buildMergeMasksContext(operationToken?: OperationToken): MergeMasksContext {
        const access = this.access;
        return {
            ...this.buildExportServiceContext(),
            historyManager: access.getHistoryManager(),
            containerElement: access.getContainerElement(),
            loadImage: (base64, providedOptions) =>
                access.loadMergedImage(operationToken, base64, providedOptions),
            captureSnapshot: () => access.captureSnapshot(),
            loadFromState: (snapshot) => access.loadFromStateForOperation(operationToken, snapshot),
            exportImageBase64: (options) =>
                exportImageBase64Impl(this.buildExportServiceContext(), options),
            updateUi: () => access.updateUi(),
            updateInputs: () => access.updateInputs(),
            removeAllMasksNoHistory: () => {
                removeAllMasksImpl(this.buildRemoveMaskContext(), { saveHistory: false });
            },
            getAnnotations: () => access.getAnnotations(),
            restoreAnnotations: (objects) => {
                const canvas = access.getLiveCanvas('restoreAnnotations');
                objects.forEach((annotation) => {
                    canvas.add(annotation);
                });
                syncAnnotationRuntimeStates(objects);
                attachTextEditingHandlersToAnnotations(this.buildTextControllerContext(), objects);
                access.setAnnotationCounter(
                    Math.max(
                        access.getAnnotationCounter(),
                        ...objects.map((annotation) => annotation.annotationId),
                        0,
                    ),
                );
                access.updateAnnotationList();
            },
        };
    }

    buildMergeAnnotationsContext(operationToken?: OperationToken): MergeAnnotationsContext {
        const access = this.access;
        return {
            ...this.buildExportServiceContext(),
            historyManager: access.getHistoryManager(),
            containerElement: access.getContainerElement(),
            loadImage: (base64, providedOptions) =>
                access.loadMergedImage(operationToken, base64, providedOptions),
            captureSnapshot: () => access.captureSnapshot(),
            loadFromState: (snapshot) => access.loadFromStateForOperation(operationToken, snapshot),
            exportImageBase64: (options) =>
                exportImageBase64Impl(this.buildExportServiceContext(), options),
            updateUi: () => access.updateUi(),
            updateInputs: () => access.updateInputs(),
            removeAllAnnotationsNoHistory: () => {
                removeAllAnnotationsImpl(this.buildAnnotationManagerContext(), {
                    saveHistory: false,
                    force: true,
                });
            },
            getMasks: () => access.getMasks(),
            restoreMasks: (objects) => {
                const canvas = access.getLiveCanvas('restoreMasks');
                objects.forEach((mask) => {
                    canvas.add(mask);
                    reattachMaskHoverHandlers(mask);
                });
                access.setLastMask(
                    objects.reduce<MaskObject | null>(
                        (lastMask, mask) =>
                            !lastMask || mask.maskId > lastMask.maskId ? mask : lastMask,
                        null,
                    ),
                );
                access.setMaskCounter(
                    Math.max(access.getMaskCounter(), ...objects.map((mask) => mask.maskId), 0),
                );
                access.updateMaskList();
            },
        };
    }
}
