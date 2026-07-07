/**
 * Captures the editor state needed to enable or disable UI controls.
 *
 * Keeping this snapshot builder outside the facade isolates DOM control policy
 * from the editor's public methods.
 */

import { isAnnotationObject, isEditableOverlayObject, isMaskObject } from '../core/public-types.js';
import type { EditorRuntime } from '../runtime/editor-runtime.js';
import type { EditorControlSnapshot } from './editor-control-state.js';

export function buildEditorControlSnapshot(runtime: EditorRuntime): EditorControlSnapshot | null {
    if (!runtime.canvas) return null;
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
        isDefaultTransform:
            runtime.currentScale === 1 &&
            runtime.currentRotation === 0 &&
            !runtime.originalImage?.flipX &&
            !runtime.originalImage?.flipY,
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
        isInShapeMode: runtime.shapeSession !== null,
        isMosaicApplying: runtime.mosaicSession?.isApplying === true,
    };
}
