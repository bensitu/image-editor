import { removeAllAnnotations as removeAllAnnotationsImpl, removeAnnotationObjects, removeSelectedAnnotation as removeSelectedAnnotationImpl, updateAnnotation as updateAnnotationImpl, updateSelectedAnnotation as updateSelectedAnnotationImpl, } from '../annotation/annotation-manager.js';
import { isAnnotationUnlocked } from '../annotation/annotation-lock.js';
import { getEditableOverlayRange, normalizeLayerOrder } from '../core/layer-order.js';
import { isAnnotationObject, isEditableOverlayObject, isMaskObject, } from '../core/public-types.js';
function getSelectedCanvasObjects(canvas) {
    var _a, _b, _c;
    const activeObject = canvas.getActiveObject();
    if (!activeObject)
        return [];
    const type = typeof activeObject.type === 'string' ? activeObject.type.toLowerCase() : '';
    const isActiveSelection = type === 'activeselection' ||
        ((_c = (_b = (_a = activeObject).isType) === null || _b === void 0 ? void 0 : _b.call(_a, 'ActiveSelection')) !== null && _c !== void 0 ? _c : false);
    if (!isActiveSelection)
        return [activeObject];
    const getObjects = activeObject.getObjects;
    return typeof getObjects === 'function' ? getObjects.call(activeObject) : [];
}
export function removeSelectedAnnotationAction(access, context) {
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
export function removeAllAnnotationsAction(access, options, context) {
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
export function updateAnnotationAction(access, annotationId, config, context) {
    const changed = updateAnnotationImpl(access.buildAnnotationManagerContext(), annotationId, config);
    if (changed) {
        access.updateAnnotationList();
        access.emitAnnotationsChanged(context);
        access.emitImageChanged(context);
    }
}
export function updateSelectedAnnotationAction(access, config, context) {
    const changed = updateSelectedAnnotationImpl(access.buildAnnotationManagerContext(), config);
    if (changed) {
        access.updateAnnotationList();
        access.emitAnnotationsChanged(context);
        access.emitImageChanged(context);
    }
}
export function deleteSelectedEditableObjects(access, context) {
    const canvas = access.getCanvas();
    if (!canvas)
        return;
    const selectedObjects = getSelectedCanvasObjects(canvas);
    const selectedMasks = selectedObjects.filter(isMaskObject);
    const selectedAnnotations = selectedObjects.filter((object) => isAnnotationObject(object) && isAnnotationUnlocked(object));
    if (selectedMasks.length === 0 && selectedAnnotations.length === 0)
        return;
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
    if (selectedMasks.length > 0)
        access.emitMasksChanged(context);
    if (selectedAnnotations.length > 0)
        access.emitAnnotationsChanged(context);
    access.emitImageChanged(context);
}
export function moveSelectedEditableObject(access, operation) {
    const canvas = access.getCanvas();
    if (!canvas)
        return;
    const selected = getSelectedCanvasObjects(canvas).filter(isEditableOverlayObject);
    if (selected.length !== 1) {
        if (selected.length > 1) {
            access.reportWarning(`${operation} skipped: ActiveSelection layer moves are not supported.`);
        }
        return;
    }
    const object = selected[0];
    const range = getEditableOverlayRange(canvas);
    const overlays = range.overlays;
    const currentOverlayIndex = overlays.indexOf(object);
    if (currentOverlayIndex < 0)
        return;
    let nextOverlayIndex = currentOverlayIndex;
    if (operation === 'bringSelectedObjectForward') {
        nextOverlayIndex = Math.min(overlays.length - 1, currentOverlayIndex + 1);
    }
    else if (operation === 'sendSelectedObjectBackward') {
        nextOverlayIndex = Math.max(0, currentOverlayIndex - 1);
    }
    else if (operation === 'bringSelectedObjectToFront') {
        nextOverlayIndex = overlays.length - 1;
    }
    else if (operation === 'sendSelectedObjectToBack') {
        nextOverlayIndex = 0;
    }
    if (nextOverlayIndex === currentOverlayIndex)
        return;
    const reordered = overlays.slice();
    reordered.splice(currentOverlayIndex, 1);
    reordered.splice(nextOverlayIndex, 0, object);
    reordered.forEach((overlay, index) => {
        var _a, _b;
        (_b = (_a = canvas).moveObjectTo) === null || _b === void 0 ? void 0 : _b.call(_a, overlay, range.start + index);
    });
    normalizeLayerOrder(canvas);
    canvas.setActiveObject(object);
    canvas.renderAll();
    access.saveState();
    access.updateMaskList();
    access.updateAnnotationList();
    if (isMaskObject(object)) {
        access.updateMaskListSelection(object);
    }
    else if (isAnnotationObject(object)) {
        access.updateAnnotationListSelection(object);
    }
    access.updateUi();
    const context = access.buildCallbackContext(operation, false);
    if (isMaskObject(object))
        access.emitMasksChanged(context);
    if (isAnnotationObject(object))
        access.emitAnnotationsChanged(context);
    access.emitImageChanged(context);
}
//# sourceMappingURL=editable-object-actions.js.map