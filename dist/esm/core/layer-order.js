import { isBaseImageObject, isEditableOverlayObject, isSessionObject, } from './public-types.js';
function isLegacySessionObject(object) {
    const candidate = object;
    return (candidate.isCropRect === true ||
        candidate.maskLabel === true ||
        candidate.isMosaicPreview === true);
}
function moveObjectTo(canvas, object, index) {
    const canvasWithLayerApi = canvas;
    if (typeof canvasWithLayerApi.moveObjectTo === 'function') {
        canvasWithLayerApi.moveObjectTo(object, index);
        return;
    }
    try {
        canvas.remove(object);
        canvas.insertAt(index, object);
    }
    catch {
        canvas.add(object);
    }
}
function ensureOnCanvas(canvas, object) {
    if (!canvas.getObjects().includes(object)) {
        canvas.add(object);
    }
}
function getOrderedGroups(canvas) {
    const baseImages = [];
    const overlays = [];
    const sessions = [];
    const others = [];
    for (const object of canvas.getObjects()) {
        if (isBaseImageObject(object)) {
            baseImages.push(object);
        }
        else if (isEditableOverlayObject(object)) {
            overlays.push(object);
        }
        else if (isSessionObject(object) || isLegacySessionObject(object)) {
            sessions.push(object);
        }
        else {
            others.push(object);
        }
    }
    return { baseImages, overlays, sessions, others };
}
export function normalizeLayerOrder(canvas) {
    const groups = getOrderedGroups(canvas);
    const ordered = [
        ...groups.baseImages,
        ...groups.others,
        ...groups.overlays,
        ...groups.sessions,
    ];
    ordered.forEach((object, index) => {
        moveObjectTo(canvas, object, index);
    });
}
export function placeBaseImageObject(canvas, image) {
    ensureOnCanvas(canvas, image);
    normalizeLayerOrder(canvas);
}
export function placeMaskObject(canvas, mask) {
    ensureOnCanvas(canvas, mask);
    normalizeLayerOrder(canvas);
}
export function placeAnnotationObject(canvas, annotation) {
    ensureOnCanvas(canvas, annotation);
    normalizeLayerOrder(canvas);
}
export function placeSessionObject(canvas, sessionObject) {
    ensureOnCanvas(canvas, sessionObject);
    normalizeLayerOrder(canvas);
}
export function getEditableOverlayRange(canvas) {
    const objects = canvas.getObjects();
    const overlayIndexes = objects
        .map((object, index) => ({ object, index }))
        .filter(({ object }) => isEditableOverlayObject(object));
    if (overlayIndexes.length === 0)
        return { start: -1, end: -1, overlays: [] };
    return {
        start: overlayIndexes[0].index,
        end: overlayIndexes[overlayIndexes.length - 1].index,
        overlays: overlayIndexes.map(({ object }) => object),
    };
}
//# sourceMappingURL=layer-order.js.map