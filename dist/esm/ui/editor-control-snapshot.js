import { isAnnotationObject, isEditableOverlayObject, isMaskObject } from '../core/public-types.js';
export function buildEditorControlSnapshot(runtime) {
    var _a, _b, _c;
    if (!runtime.canvas)
        return null;
    const hasImage = !!runtime.originalImage;
    const masks = hasImage ? runtime.canvas.getObjects().filter(isMaskObject) : [];
    const annotations = hasImage ? runtime.canvas.getObjects().filter(isAnnotationObject) : [];
    const activeObject = runtime.canvas.getActiveObject();
    return {
        hasImage,
        hasMasks: masks.length > 0,
        hasAnnotations: annotations.length > 0,
        hasSelectedMask: !!(activeObject && isMaskObject(activeObject)),
        hasSelectedAnnotation: !!(activeObject && isAnnotationObject(activeObject)),
        hasSelectedEditableObject: !!activeObject && isEditableOverlayObject(activeObject),
        isDefaultTransform: runtime.currentScale === 1 &&
            runtime.currentRotation === 0 &&
            !((_a = runtime.originalImage) === null || _a === void 0 ? void 0 : _a.flipX) &&
            !((_b = runtime.originalImage) === null || _b === void 0 ? void 0 : _b.flipY),
        currentScale: runtime.currentScale,
        minScale: runtime.options.minScale,
        maxScale: runtime.options.maxScale,
        canUndo: runtime.historyManager.canUndo(),
        canRedo: runtime.historyManager.canRedo(),
        isBusy: runtime.operationGuard.isBusy() || runtime.animQueue.isBusy(),
        isDisposed: runtime.isDisposed,
        isInCropMode: runtime.cropSession !== null,
        isInMosaicMode: runtime.mosaicSession !== null,
        isInTextMode: runtime.textSession !== null,
        isInDrawMode: runtime.drawSession !== null,
        isMosaicApplying: ((_c = runtime.mosaicSession) === null || _c === void 0 ? void 0 : _c.isApplying) === true,
    };
}
//# sourceMappingURL=editor-control-snapshot.js.map