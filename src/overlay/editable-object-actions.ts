import type * as FabricNS from 'fabric';

import {
    removeAllAnnotations as removeAllAnnotationsImpl,
    removeAnnotationObjects,
    removeSelectedAnnotation as removeSelectedAnnotationImpl,
    updateAnnotation as updateAnnotationImpl,
    updateSelectedAnnotation as updateSelectedAnnotationImpl,
    type AnnotationManagerContext,
} from '../annotation/annotation-manager.js';
import { isAnnotationUnlocked } from '../annotation/annotation-lock.js';
import { getEditableOverlayRange, normalizeLayerOrder } from '../core/layer-order.js';
import {
    isAnnotationObject,
    isEditableOverlayObject,
    isMaskObject,
    type AnnotationObject,
    type AnnotationUpdateConfig,
    type ImageEditorCallbackContext,
    type ImageEditorOperation,
    type MaskObject,
    type RemoveAllAnnotationsOptions,
} from '../core/public-types.js';

export interface EditableObjectActionAccess {
    getCanvas(): FabricNS.Canvas | null;
    getLiveCanvas(operationName: string): FabricNS.Canvas;
    buildAnnotationManagerContext(): AnnotationManagerContext;

    getMasks(): MaskObject[];
    getAnnotations(): AnnotationObject[];

    removeLabelForMask(mask: MaskObject): void;
    withSelectionChangeContext<T>(context: ImageEditorCallbackContext, callback: () => T): T;
    buildCallbackContext(
        operation: ImageEditorOperation,
        isInternalOperation: boolean,
    ): ImageEditorCallbackContext;

    saveState(): void;
    updateMaskList(): void;
    updateAnnotationList(): void;
    updateUi(): void;

    emitMasksChanged(context: ImageEditorCallbackContext): void;
    emitAnnotationsChanged(context: ImageEditorCallbackContext): void;
    emitImageChanged(context: ImageEditorCallbackContext): void;
    reportWarning(message: string): void;
}

function getSelectedCanvasObjects(canvas: FabricNS.Canvas): FabricNS.FabricObject[] {
    const activeObject = canvas.getActiveObject();
    if (!activeObject) return [];
    const type = typeof activeObject.type === 'string' ? activeObject.type.toLowerCase() : '';
    const isActiveSelection =
        type === 'activeselection' ||
        ((activeObject as { isType?: (...types: string[]) => boolean }).isType?.(
            'ActiveSelection',
        ) ??
            false);
    if (!isActiveSelection) return [activeObject];
    const getObjects = (activeObject as { getObjects?: () => FabricNS.FabricObject[] }).getObjects;
    return typeof getObjects === 'function' ? getObjects.call(activeObject) : [];
}

export function removeSelectedAnnotationAction(
    access: EditableObjectActionAccess,
    context: ImageEditorCallbackContext,
): void {
    const before = access.getAnnotations().length;
    access.withSelectionChangeContext(context, () => {
        removeSelectedAnnotationImpl(access.buildAnnotationManagerContext());
    });
    access.updateAnnotationList();
    access.updateUi();
    if (access.getAnnotations().length !== before) {
        access.emitAnnotationsChanged(context);
        access.emitImageChanged(context);
    }
}

export function removeAllAnnotationsAction(
    access: EditableObjectActionAccess,
    options: RemoveAllAnnotationsOptions,
    context: ImageEditorCallbackContext,
): void {
    const before = access.getAnnotations().length;
    access.withSelectionChangeContext(context, () => {
        removeAllAnnotationsImpl(access.buildAnnotationManagerContext(), options);
    });
    access.updateAnnotationList();
    access.updateUi();
    if (access.getAnnotations().length !== before) {
        access.emitAnnotationsChanged(context);
        access.emitImageChanged(context);
    }
}

export function updateAnnotationAction(
    access: EditableObjectActionAccess,
    annotationId: number,
    config: AnnotationUpdateConfig,
    context: ImageEditorCallbackContext,
): void {
    const changed = updateAnnotationImpl(
        access.buildAnnotationManagerContext(),
        annotationId,
        config,
    );
    if (changed) {
        access.updateAnnotationList();
        access.emitAnnotationsChanged(context);
        access.emitImageChanged(context);
    }
}

export function updateSelectedAnnotationAction(
    access: EditableObjectActionAccess,
    config: AnnotationUpdateConfig,
    context: ImageEditorCallbackContext,
): void {
    const changed = updateSelectedAnnotationImpl(access.buildAnnotationManagerContext(), config);
    if (changed) {
        access.updateAnnotationList();
        access.emitAnnotationsChanged(context);
        access.emitImageChanged(context);
    }
}

export function deleteSelectedEditableObjects(
    access: EditableObjectActionAccess,
    context: ImageEditorCallbackContext,
): void {
    const canvas = access.getCanvas();
    if (!canvas) return;

    const selectedObjects = getSelectedCanvasObjects(canvas);
    const selectedMasks = selectedObjects.filter(isMaskObject);
    const selectedAnnotations = selectedObjects.filter(
        (object): object is AnnotationObject =>
            isAnnotationObject(object) && isAnnotationUnlocked(object),
    );
    if (selectedMasks.length === 0 && selectedAnnotations.length === 0) return;

    const liveCanvas = access.getLiveCanvas('deleteSelectedObject');
    access.withSelectionChangeContext(context, () => {
        for (const mask of selectedMasks) {
            access.removeLabelForMask(mask);
            liveCanvas.remove(mask);
        }
        removeAnnotationObjects(access.buildAnnotationManagerContext(), selectedAnnotations, {
            saveHistory: false,
            force: true,
        });
        liveCanvas.discardActiveObject();
        liveCanvas.renderAll();
        access.saveState();
    });
    access.updateMaskList();
    access.updateAnnotationList();
    access.updateUi();
    if (selectedMasks.length > 0) access.emitMasksChanged(context);
    if (selectedAnnotations.length > 0) access.emitAnnotationsChanged(context);
    access.emitImageChanged(context);
}

export function moveSelectedEditableObject(
    access: EditableObjectActionAccess,
    operation: ImageEditorOperation,
): void {
    const canvas = access.getCanvas();
    if (!canvas) return;

    const selected = getSelectedCanvasObjects(canvas).filter(isEditableOverlayObject);
    if (selected.length !== 1) {
        if (selected.length > 1) {
            access.reportWarning(
                `${operation} skipped: ActiveSelection layer moves are not supported.`,
            );
        }
        return;
    }

    const object = selected[0]!;
    const range = getEditableOverlayRange(canvas);
    const overlays = range.overlays;
    const currentOverlayIndex = overlays.indexOf(object);
    if (currentOverlayIndex < 0) return;

    let nextOverlayIndex = currentOverlayIndex;
    if (operation === 'bringSelectedObjectForward') {
        nextOverlayIndex = Math.min(overlays.length - 1, currentOverlayIndex + 1);
    } else if (operation === 'sendSelectedObjectBackward') {
        nextOverlayIndex = Math.max(0, currentOverlayIndex - 1);
    } else if (operation === 'bringSelectedObjectToFront') {
        nextOverlayIndex = overlays.length - 1;
    } else if (operation === 'sendSelectedObjectToBack') {
        nextOverlayIndex = 0;
    }
    if (nextOverlayIndex === currentOverlayIndex) return;

    const reordered = overlays.slice();
    reordered.splice(currentOverlayIndex, 1);
    reordered.splice(nextOverlayIndex, 0, object);
    reordered.forEach((overlay, index) => {
        (
            canvas as FabricNS.Canvas & {
                moveObjectTo?: (target: FabricNS.FabricObject, index: number) => boolean;
            }
        ).moveObjectTo?.(overlay, range.start + index);
    });
    normalizeLayerOrder(canvas);
    canvas.setActiveObject(object);
    canvas.renderAll();
    access.saveState();
    access.updateMaskList();
    access.updateAnnotationList();
    access.updateUi();

    const context = access.buildCallbackContext(operation, false);
    if (isMaskObject(object)) access.emitMasksChanged(context);
    if (isAnnotationObject(object)) access.emitAnnotationsChanged(context);
    access.emitImageChanged(context);
}
