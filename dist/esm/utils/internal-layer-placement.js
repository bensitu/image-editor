import { isBaseImageObject, isSessionObject, } from '../core/public-types.js';
function isRasterVisualObject(object) {
    return (object.editorLayerRole ===
        'rasterVisual');
}
function isInternallyMarkedSessionObject(object) {
    return (object.editorLayerRole ===
        'session');
}
function isPropertyMarkedSessionObject(object) {
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
    if (!canvas.getObjects().includes(object))
        canvas.add(object);
}
function withoutObject(canvas, object) {
    return canvas.getObjects().filter((candidate) => candidate !== object);
}
function findFirstSessionIndex(objects) {
    return objects.findIndex((object) => isSessionObject(object) ||
        isInternallyMarkedSessionObject(object) ||
        isPropertyMarkedSessionObject(object));
}
export function markRasterVisualObject(object) {
    const rasterVisual = object;
    rasterVisual.editorLayerRole = 'rasterVisual';
    return rasterVisual;
}
export function placeRasterVisualObject(canvas, rasterVisual) {
    const markedVisual = markRasterVisualObject(rasterVisual);
    ensureOnCanvas(canvas, markedVisual);
    const objects = withoutObject(canvas, markedVisual);
    const targetIndex = objects.filter(isBaseImageObject).length + objects.filter(isRasterVisualObject).length;
    moveObjectTo(canvas, markedVisual, targetIndex);
}
export function placeMaskObject(canvas, mask) {
    ensureOnCanvas(canvas, mask);
    const objects = withoutObject(canvas, mask);
    const firstSessionIndex = findFirstSessionIndex(objects);
    moveObjectTo(canvas, mask, firstSessionIndex === -1 ? objects.length : firstSessionIndex);
}
export function markSessionObject(object, sessionObjectType) {
    const sessionObject = object;
    sessionObject.editorObjectKind = 'session';
    sessionObject.sessionObjectType = sessionObjectType;
    return sessionObject;
}
export function placeSessionObject(canvas, sessionObject) {
    sessionObject.editorLayerRole = 'session';
    ensureOnCanvas(canvas, sessionObject);
    moveObjectTo(canvas, sessionObject, withoutObject(canvas, sessionObject).length);
}
//# sourceMappingURL=internal-layer-placement.js.map