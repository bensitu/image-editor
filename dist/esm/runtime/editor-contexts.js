import { attachTextEditingHandlersToAnnotations, } from '../annotation/text-controller.js';
import { removeAllAnnotations as removeAllAnnotationsImpl, } from '../annotation/annotation-manager.js';
import { syncAnnotationRuntimeStates } from '../annotation/annotation-style.js';
import { exportImageBase64 as exportImageBase64Impl, } from '../export/export-service.js';
import { removeAllMasks as removeAllMasksImpl, } from '../mask/mask-factory.js';
import { reattachMaskHoverHandlers } from '../mask/mask-style.js';
import { isMaskObject, } from '../core/public-types.js';
export class EditorContextFactory {
    constructor(access) {
        Object.defineProperty(this, "access", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: access
        });
    }
    buildExportServiceContext() {
        const access = this.access;
        return {
            fabric: access.getFabric(),
            canvas: access.getLiveCanvas('export'),
            options: access.getOptions(),
            isImageLoaded: () => access.isImageLoaded(),
            getOriginalImage: () => access.getOriginalImage(),
        };
    }
    buildLoadImageContext() {
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
    buildTransformContext() {
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
                if (access.isDisposed() || !canvas || !originalImage)
                    return;
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
    buildCreateMaskContext() {
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
    buildRemoveMaskContext() {
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
    buildMaskLabelContext() {
        const canvas = this.access.getCanvas();
        if (!canvas)
            return null;
        return {
            fabric: this.access.getFabric(),
            canvas,
            options: this.access.getOptions(),
        };
    }
    buildMaskListContext() {
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
    buildAnnotationManagerContext() {
        const access = this.access;
        return {
            canvas: access.getLiveCanvas('annotationManager'),
            saveCanvasState: () => access.saveCanvasState(),
            updateUi: () => access.updateUi(),
        };
    }
    buildAnnotationListContext() {
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
    buildTextControllerContext() {
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
    buildDrawControllerContext() {
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
    buildMosaicControllerContext() {
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
            buildCallbackContext: (operation, isInternal) => access.buildCallbackContext(operation, isInternal),
            getMosaicSession: () => access.getMosaicSession(),
            setMosaicSession: (session) => {
                access.setMosaicSession(session);
            },
        };
    }
    buildCropControllerContext(operationToken) {
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
            loadImage: (base64, providedOptions) => access.loadImageForOperation(operationToken, base64, providedOptions),
            getMaskCounter: () => access.getMaskCounter(),
            setMaskCounter: (value) => {
                access.setMaskCounter(value);
            },
            updateMaskList: () => {
                access.updateMaskList();
            },
        };
    }
    buildMergeMasksContext(operationToken) {
        const access = this.access;
        return {
            ...this.buildExportServiceContext(),
            historyManager: access.getHistoryManager(),
            containerElement: access.getContainerElement(),
            loadImage: (base64, providedOptions) => access.loadMergedImage(operationToken, base64, providedOptions),
            captureSnapshot: () => access.captureSnapshot(),
            loadFromState: (snapshot) => access.loadFromStateForOperation(operationToken, snapshot),
            exportImageBase64: (options) => exportImageBase64Impl(this.buildExportServiceContext(), options),
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
                access.setAnnotationCounter(Math.max(access.getAnnotationCounter(), ...objects.map((annotation) => annotation.annotationId), 0));
                access.updateAnnotationList();
            },
        };
    }
    buildMergeAnnotationsContext(operationToken) {
        const access = this.access;
        return {
            ...this.buildExportServiceContext(),
            historyManager: access.getHistoryManager(),
            containerElement: access.getContainerElement(),
            loadImage: (base64, providedOptions) => access.loadMergedImage(operationToken, base64, providedOptions),
            captureSnapshot: () => access.captureSnapshot(),
            loadFromState: (snapshot) => access.loadFromStateForOperation(operationToken, snapshot),
            exportImageBase64: (options) => exportImageBase64Impl(this.buildExportServiceContext(), options),
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
                access.setLastMask(objects.reduce((lastMask, mask) => !lastMask || mask.maskId > lastMask.maskId ? mask : lastMask, null));
                access.setMaskCounter(Math.max(access.getMaskCounter(), ...objects.map((mask) => mask.maskId), 0));
                access.updateMaskList();
            },
        };
    }
}
//# sourceMappingURL=editor-contexts.js.map