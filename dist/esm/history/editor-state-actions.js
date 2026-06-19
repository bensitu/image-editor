import { reportError, reportWarning } from '../core/callback-reporter.js';
import { loadFromState as loadFromStateImpl, saveState as saveStateImpl, } from '../core/state-serializer.js';
import { isAnnotationObject, isMaskObject, } from '../core/public-types.js';
import { applyMaskUnselectedStyle, reattachMaskHoverHandlers } from '../mask/mask-style.js';
import { syncAnnotationRuntimeStates } from '../annotation/annotation-style.js';
import { attachTextEditingHandlersToAnnotations, } from '../annotation/text-controller.js';
import { Command } from './history-manager.js';
export async function loadFromStateAction(access, jsonString, options) {
    var _a, _b, _c;
    const canvas = access.getCanvas();
    if (!jsonString || !canvas)
        return;
    if (access.isDisposed())
        return;
    if (!access.canRunIdleOperation('loadFromState', options))
        return;
    const activeRestoreOperation = access.getActiveStateRestoreOperation();
    const context = access.buildCallbackContext(activeRestoreOperation !== null && activeRestoreOperation !== void 0 ? activeRestoreOperation : 'loadFromState', activeRestoreOperation === 'undo' || activeRestoreOperation === 'redo');
    const previousImage = access.getOriginalImage();
    const previousMaskSignature = access.getMaskCollectionSignature();
    const previousAnnotationSignature = access.getAnnotationCollectionSignature();
    try {
        const restoredState = await loadFromStateImpl({
            canvas,
            jsonString,
            setCanvasSize: (widthPx, heightPx) => access.setCanvasSize(widthPx, heightPx),
        });
        if (access.isDisposed() || !access.getCanvas())
            return;
        access.hideAllMaskLabels();
        access.setOriginalImage(restoredState.originalImage);
        const originalImage = restoredState.originalImage;
        if (originalImage) {
            originalImage.set({
                originX: 'left',
                originY: 'top',
                selectable: false,
                evented: false,
                hasControls: false,
                hoverCursor: 'default',
            });
            (_a = access.getCanvas()) === null || _a === void 0 ? void 0 : _a.sendObjectToBack(originalImage);
        }
        access.setMaskCounter(restoredState.maxMaskId);
        access.setAnnotationCounter(restoredState.maxAnnotationId);
        const editorState = restoredState.editorState;
        if (editorState) {
            access.setCurrentScale(editorState.currentScale);
            access.setCurrentRotation(editorState.currentRotation);
            access.setBaseImageScale(editorState.baseImageScale);
        }
        if (originalImage) {
            access.setCurrentImageMimeType(editorState && 'currentImageMimeType' in editorState
                ? ((_b = editorState.currentImageMimeType) !== null && _b !== void 0 ? _b : null)
                : access.inferCurrentImageMimeType());
        }
        else {
            access.setCurrentImageMimeType(null);
        }
        access.setIsImageLoadedToCanvas(!!originalImage);
        if (originalImage && access.shouldNormalizeCanvasSizeAfterStateRestore()) {
            access.updateCanvasSizeToImageBounds({ stabilizeContainedViewport: false });
            access.alignObjectBoundingBoxToCanvasTopLeft(originalImage);
        }
        if (originalImage)
            access.settleFitCoverScrollbarsAfterStateRestore();
        const restoredMasks = restoredState.masks;
        access.setLastMask(restoredMasks.reduce((lastMask, maskObject) => !lastMask || maskObject.maskId > lastMask.maskId ? maskObject : lastMask, null));
        restoredMasks.forEach((maskObject) => {
            applyMaskUnselectedStyle(maskObject);
            reattachMaskHoverHandlers(maskObject);
        });
        syncAnnotationRuntimeStates(restoredState.annotations);
        attachTextEditingHandlersToAnnotations(access.buildTextControllerContext(), restoredState.annotations);
        access.setLastSnapshot(captureSnapshotAction(access));
        (_c = access.getCanvas()) === null || _c === void 0 ? void 0 : _c.renderAll();
        access.updateInputs();
        access.updateMaskList();
        access.updateAnnotationList();
        access.updateUi();
        if (previousImage && previousImage !== access.getOriginalImage()) {
            access.emitImageCleared(previousImage, context);
        }
        if (previousMaskSignature !== access.getMaskCollectionSignature()) {
            access.emitMasksChanged(context);
        }
        if (previousAnnotationSignature !== access.getAnnotationCollectionSignature()) {
            access.emitAnnotationsChanged(context);
        }
        access.emitImageChanged(context);
        restoreActiveSelection(access, restoredState, editorState, context);
    }
    catch (error) {
        reportError(access.getOptions(), error, 'Failed to restore canvas state.');
        throw error;
    }
}
export function saveStateAction(access, options) {
    var _a, _b, _c;
    const canvas = access.getCanvas();
    if (!canvas || access.shouldSuppressSaveState())
        return;
    if (!access.canRunIdleOperation('saveState', options))
        return;
    const activeObj = canvas.getActiveObject();
    const activeMask = getActiveMaskForSnapshot(canvas);
    const activeAnnotation = getActiveAnnotationForSnapshot(canvas);
    access.hideAllMaskLabels();
    try {
        const after = saveStateImpl({
            canvas,
            activeMaskId: (_a = activeMask === null || activeMask === void 0 ? void 0 : activeMask.maskId) !== null && _a !== void 0 ? _a : null,
            activeAnnotationId: (_b = activeAnnotation === null || activeAnnotation === void 0 ? void 0 : activeAnnotation.annotationId) !== null && _b !== void 0 ? _b : null,
            currentScale: access.getCurrentScale(),
            currentRotation: access.getCurrentRotation(),
            baseImageScale: access.getBaseImageScale(),
            currentImageMimeType: access.getCurrentImageMimeType(),
        });
        const before = (_c = access.getLastSnapshot()) !== null && _c !== void 0 ? _c : after;
        if (after === before)
            return;
        const cmd = new Command(async () => {
            await loadFromStateAction(access, after, access.withAnimationQueueBypass());
        }, async () => {
            await loadFromStateAction(access, before, access.withAnimationQueueBypass());
        });
        access.getHistoryManager().push(cmd);
        access.setLastSnapshot(after);
    }
    catch (error) {
        reportWarning(access.getOptions(), error, 'Failed to capture canvas snapshot.');
    }
    finally {
        restoreActiveObjectAfterSnapshot(access, activeObj, activeMask, activeAnnotation);
        access.updateUi();
    }
}
export function captureSnapshotAction(access) {
    var _a, _b;
    const canvas = access.getCanvas();
    if (!canvas) {
        throw new Error('[ImageEditor] Cannot capture canvas snapshot before init or after dispose.');
    }
    const activeMask = getActiveMaskForSnapshot(canvas);
    const activeAnnotation = getActiveAnnotationForSnapshot(canvas);
    access.hideAllMaskLabels();
    return saveStateImpl({
        canvas,
        activeMaskId: (_a = activeMask === null || activeMask === void 0 ? void 0 : activeMask.maskId) !== null && _a !== void 0 ? _a : null,
        activeAnnotationId: (_b = activeAnnotation === null || activeAnnotation === void 0 ? void 0 : activeAnnotation.annotationId) !== null && _b !== void 0 ? _b : null,
        currentScale: access.getCurrentScale(),
        currentRotation: access.getCurrentRotation(),
        baseImageScale: access.getBaseImageScale(),
        currentImageMimeType: access.getCurrentImageMimeType(),
    });
}
function restoreActiveSelection(access, restoredState, editorState, context) {
    const canvas = access.getLiveCanvas('loadFromState');
    const activeMaskId = editorState === null || editorState === void 0 ? void 0 : editorState.activeMaskId;
    const activeAnnotationId = editorState === null || editorState === void 0 ? void 0 : editorState.activeAnnotationId;
    if ((editorState === null || editorState === void 0 ? void 0 : editorState.activeObjectKind) === 'mask' && typeof activeMaskId === 'number') {
        const activeMask = restoredState.masks.find((maskObject) => maskObject.maskId === activeMaskId);
        if (activeMask) {
            access.withSelectionChangeContext(context, () => {
                canvas.setActiveObject(activeMask);
                access.handleSelectionChanged([activeMask]);
            });
        }
    }
    else if ((editorState === null || editorState === void 0 ? void 0 : editorState.activeObjectKind) === 'annotation' &&
        typeof activeAnnotationId === 'number') {
        const activeAnnotation = restoredState.annotations.find((annotation) => annotation.annotationId === activeAnnotationId);
        if (activeAnnotation) {
            access.withSelectionChangeContext(context, () => {
                canvas.setActiveObject(activeAnnotation);
                access.handleSelectionChanged([activeAnnotation]);
            });
        }
    }
}
function getActiveMaskForSnapshot(canvas) {
    var _a;
    const activeObject = canvas.getActiveObject();
    if (activeObject && isMaskObject(activeObject))
        return activeObject;
    const labeledMasks = canvas
        .getObjects()
        .filter((object) => isMaskObject(object) && !!object.labelObject);
    return labeledMasks.length === 1 ? ((_a = labeledMasks[0]) !== null && _a !== void 0 ? _a : null) : null;
}
function getActiveAnnotationForSnapshot(canvas) {
    const activeObject = canvas.getActiveObject();
    return activeObject && isAnnotationObject(activeObject) ? activeObject : null;
}
function restoreActiveObjectAfterSnapshot(access, activeObj, activeMask, activeAnnotation) {
    const canvas = access.getCanvas();
    if (!canvas)
        return;
    const maskToRestore = activeObj && isMaskObject(activeObj) ? activeObj : activeMask;
    const annotationToRestore = activeObj && isAnnotationObject(activeObj) ? activeObj : activeAnnotation;
    if (maskToRestore && canvas.getObjects().includes(maskToRestore)) {
        canvas.setActiveObject(maskToRestore);
        access.showLabelForMask(maskToRestore);
        access.updateMaskListSelection(maskToRestore);
        return;
    }
    if (annotationToRestore && canvas.getObjects().includes(annotationToRestore)) {
        canvas.setActiveObject(annotationToRestore);
        access.updateAnnotationListSelection(annotationToRestore);
    }
}
//# sourceMappingURL=editor-state-actions.js.map