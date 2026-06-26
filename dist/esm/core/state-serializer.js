import { isAnnotationObject, isBaseImageObject, isMaskObject } from './public-types.js';
import { markAnnotationObject, markBaseImageObject, markMaskObject } from './editor-object-kind.js';
import { StateRestoreError } from './errors.js';
const DEFAULT_MAX_RESTORE_CANVAS_PIXELS = 50000000;
export const SNAPSHOT_CUSTOM_KEYS = [
    'editorObjectKind',
    'sessionObjectType',
    'maskId',
    'maskUid',
    'maskName',
    'isCropRect',
    'maskLabel',
    'originalAlpha',
    'originalStroke',
    'originalStrokeWidth',
    'hasControls',
    'selectable',
    'strokeUniform',
    'lockRotation',
    'transparentCorners',
    'borderColor',
    'cornerColor',
    'cornerSize',
    'flipX',
    'flipY',
    'isMosaicPreview',
    'annotationId',
    'annotationType',
    'annotationName',
    'annotationHidden',
    'annotationLocked',
    'annotationSelectable',
    'annotationEvented',
    'annotationHasControls',
    'annotationEditable',
];
function copySnapshotCustomPropsFromCanvas(canvasObjects, jsonObjects) {
    if (!Array.isArray(jsonObjects))
        return;
    for (let index = 0; index < jsonObjects.length; index += 1) {
        const liveObject = canvasObjects[index];
        const jsonObject = jsonObjects[index];
        if (!liveObject || !jsonObject)
            continue;
        if (typeof liveObject.editorObjectKind === 'string') {
            jsonObject.editorObjectKind = liveObject.editorObjectKind;
        }
        if (typeof liveObject.sessionObjectType === 'string') {
            jsonObject.sessionObjectType = liveObject.sessionObjectType;
        }
        if (typeof liveObject.maskId === 'number')
            jsonObject.maskId = liveObject.maskId;
        if (typeof liveObject.maskUid === 'string')
            jsonObject.maskUid = liveObject.maskUid;
        if (typeof liveObject.maskName === 'string')
            jsonObject.maskName = liveObject.maskName;
        if (typeof liveObject.originalAlpha === 'number') {
            jsonObject.originalAlpha = liveObject.originalAlpha;
        }
        if ('originalStroke' in liveObject)
            jsonObject.originalStroke = liveObject.originalStroke;
        if (typeof liveObject.originalStrokeWidth === 'number') {
            jsonObject.originalStrokeWidth = liveObject.originalStrokeWidth;
        }
        if (typeof liveObject.hasControls === 'boolean') {
            jsonObject.hasControls = liveObject.hasControls;
        }
        if (typeof liveObject.selectable === 'boolean') {
            jsonObject.selectable = liveObject.selectable;
        }
        if (typeof liveObject.strokeUniform === 'boolean') {
            jsonObject.strokeUniform = liveObject.strokeUniform;
        }
        if (typeof liveObject.lockRotation === 'boolean') {
            jsonObject.lockRotation = liveObject.lockRotation;
        }
        if (typeof liveObject.transparentCorners === 'boolean') {
            jsonObject.transparentCorners = liveObject.transparentCorners;
        }
        if (typeof liveObject.borderColor === 'string') {
            jsonObject.borderColor = liveObject.borderColor;
        }
        if (typeof liveObject.cornerColor === 'string') {
            jsonObject.cornerColor = liveObject.cornerColor;
        }
        if (typeof liveObject.cornerSize === 'number') {
            jsonObject.cornerSize = liveObject.cornerSize;
        }
        if (typeof liveObject.flipX === 'boolean') {
            jsonObject.flipX = liveObject.flipX;
        }
        if (typeof liveObject.flipY === 'boolean') {
            jsonObject.flipY = liveObject.flipY;
        }
        if (liveObject.isCropRect === true)
            jsonObject.isCropRect = true;
        if (liveObject.maskLabel === true)
            jsonObject.maskLabel = true;
        if (liveObject.isMosaicPreview === true)
            jsonObject.isMosaicPreview = true;
        if (typeof liveObject.annotationId === 'number') {
            jsonObject.annotationId = liveObject.annotationId;
        }
        if (typeof liveObject.annotationType === 'string') {
            jsonObject.annotationType = liveObject.annotationType;
        }
        if (typeof liveObject.annotationName === 'string') {
            jsonObject.annotationName = liveObject.annotationName;
        }
        if (typeof liveObject.annotationHidden === 'boolean') {
            jsonObject.annotationHidden = liveObject.annotationHidden;
        }
        if (typeof liveObject.annotationLocked === 'boolean') {
            jsonObject.annotationLocked = liveObject.annotationLocked;
        }
        if (typeof liveObject.annotationSelectable === 'boolean') {
            jsonObject.annotationSelectable = liveObject.annotationSelectable;
        }
        if (typeof liveObject.annotationEvented === 'boolean') {
            jsonObject.annotationEvented = liveObject.annotationEvented;
        }
        if (typeof liveObject.annotationHasControls === 'boolean') {
            jsonObject.annotationHasControls = liveObject.annotationHasControls;
        }
        if (typeof liveObject.annotationEditable === 'boolean') {
            jsonObject.annotationEditable = liveObject.annotationEditable;
        }
    }
}
function isActiveSelectionObject(object) {
    if (!object)
        return false;
    const type = typeof object.type === 'string' ? object.type.toLowerCase() : '';
    if (type === 'activeselection')
        return true;
    const isType = object.isType;
    return (typeof isType === 'function' &&
        (isType.call(object, 'ActiveSelection') || isType.call(object, 'activeSelection')));
}
export function saveState(input) {
    var _a, _b, _c;
    const { canvas, currentScale, currentRotation, baseImageScale } = input;
    const activeObject = (_b = (_a = canvas).getActiveObject) === null || _b === void 0 ? void 0 : _b.call(_a);
    const activeMaskId = activeObject && isMaskObject(activeObject)
        ? activeObject.maskId
        : typeof input.activeMaskId === 'number'
            ? input.activeMaskId
            : null;
    const activeAnnotationId = activeObject && isAnnotationObject(activeObject)
        ? activeObject.annotationId
        : typeof input.activeAnnotationId === 'number'
            ? input.activeAnnotationId
            : null;
    if (isActiveSelectionObject(activeObject)) {
        canvas.discardActiveObject();
    }
    const jsonObj = canvas.toJSON(SNAPSHOT_CUSTOM_KEYS);
    copySnapshotCustomPropsFromCanvas(canvas.getObjects(), jsonObj.objects);
    if (Array.isArray(jsonObj.objects)) {
        jsonObj.objects = jsonObj.objects.filter((o) => o.editorObjectKind !== 'session' &&
            o.isCropRect !== true &&
            o.maskLabel !== true &&
            o.isMosaicPreview !== true);
    }
    jsonObj._editorState = {
        currentScale,
        currentRotation,
        baseImageScale,
        currentImageMimeType: (_c = input.currentImageMimeType) !== null && _c !== void 0 ? _c : null,
        activeObjectKind: activeMaskId !== null ? 'mask' : activeAnnotationId !== null ? 'annotation' : null,
    };
    if (activeMaskId !== null)
        jsonObj._editorState.activeMaskId = activeMaskId;
    if (activeAnnotationId !== null) {
        jsonObj._editorState.activeAnnotationId = activeAnnotationId;
    }
    return JSON.stringify(jsonObj);
}
export async function loadFromState(input) {
    var _a, _b, _c;
    const { canvas, jsonString: snapshotInput, setCanvasSize } = input;
    const jsonString = typeof snapshotInput === 'string' ? snapshotInput : JSON.stringify(snapshotInput);
    let json;
    try {
        json = JSON.parse(jsonString);
    }
    catch (error) {
        throw new StateRestoreError('loadFromState: snapshot JSON is malformed.', error);
    }
    if (typeof json.width === 'number' &&
        json.width > 0 &&
        typeof json.height === 'number' &&
        json.height > 0) {
        assertRestoredCanvasSizeAllowed(json.width, json.height, (_a = input.maxCanvasPixels) !== null && _a !== void 0 ? _a : DEFAULT_MAX_RESTORE_CANVAS_PIXELS);
        setCanvasSize(json.width, json.height);
    }
    await canvas.loadFromJSON(json);
    const objects = canvas.getObjects();
    restoreEditorObjectPropsFromJson(objects, (_b = json.objects) !== null && _b !== void 0 ? _b : []);
    const editorState = json._editorState && typeof json._editorState === 'object'
        ? {
            currentScale: typeof json._editorState.currentScale === 'number'
                ? json._editorState.currentScale
                : 1,
            currentRotation: typeof json._editorState.currentRotation === 'number'
                ? json._editorState.currentRotation
                : 0,
            baseImageScale: typeof json._editorState.baseImageScale === 'number'
                ? json._editorState.baseImageScale
                : 1,
        }
        : null;
    if (editorState && json._editorState && typeof json._editorState.activeMaskId === 'number') {
        editorState.activeMaskId = json._editorState.activeMaskId;
    }
    if (editorState &&
        json._editorState &&
        typeof json._editorState.activeAnnotationId === 'number') {
        editorState.activeAnnotationId = json._editorState.activeAnnotationId;
    }
    if (editorState && json._editorState && 'activeObjectKind' in json._editorState) {
        const kind = json._editorState.activeObjectKind;
        editorState.activeObjectKind =
            kind === 'mask' || kind === 'annotation' || kind === null ? kind : null;
    }
    if (editorState && json._editorState && 'currentImageMimeType' in json._editorState) {
        const mimeType = json._editorState.currentImageMimeType;
        editorState.currentImageMimeType =
            mimeType === 'image/jpeg' || mimeType === 'image/png' || mimeType === 'image/webp'
                ? mimeType
                : null;
    }
    const maxMaskId = objects
        .filter(isMaskObject)
        .reduce((max, maskObject) => Math.max(max, maskObject.maskId), 0);
    const maxAnnotationId = objects
        .filter(isAnnotationObject)
        .reduce((max, annotationObject) => Math.max(max, annotationObject.annotationId), 0);
    const masks = objects.filter(isMaskObject);
    const annotations = objects.filter(isAnnotationObject);
    const originalImage = (_c = objects.find(isBaseImageObject)) !== null && _c !== void 0 ? _c : null;
    return {
        editorState,
        maxMaskId,
        maxAnnotationId,
        originalImage,
        objects,
        masks,
        annotations,
        jsonString,
    };
}
function assertRestoredCanvasSizeAllowed(width, height, maxCanvasPixels) {
    const safeMaxCanvasPixels = Number.isFinite(maxCanvasPixels) && maxCanvasPixels > 0
        ? Math.floor(maxCanvasPixels)
        : DEFAULT_MAX_RESTORE_CANVAS_PIXELS;
    const pixelCount = width * height;
    if (!Number.isFinite(pixelCount) || pixelCount > safeMaxCanvasPixels) {
        throw new StateRestoreError(`loadFromState: snapshot canvas size ${width}x${height} exceeds maxCanvasPixels (${safeMaxCanvasPixels}).`);
    }
}
function restoreEditorObjectPropsFromJson(canvasObjs, jsonObjs) {
    var _a, _b, _c, _d;
    jsonObjs.forEach((jObj, index) => {
        const canvasObj = canvasObjs[index];
        if (!canvasObj)
            return;
        if (jObj.editorObjectKind === 'baseImage') {
            markBaseImageObject(canvasObj);
            return;
        }
        if (jObj.editorObjectKind === 'annotation' &&
            typeof jObj.annotationId === 'number' &&
            typeof jObj.annotationType === 'string' &&
            typeof jObj.annotationName === 'string') {
            markAnnotationObject(canvasObj, {
                annotationId: jObj.annotationId,
                annotationType: jObj.annotationType === 'draw' ? 'draw' : 'text',
                annotationName: jObj.annotationName,
                annotationHidden: typeof jObj.annotationHidden === 'boolean' ? jObj.annotationHidden : false,
                annotationLocked: typeof jObj.annotationLocked === 'boolean' ? jObj.annotationLocked : false,
                annotationSelectable: typeof jObj.annotationSelectable === 'boolean'
                    ? jObj.annotationSelectable
                    : undefined,
                annotationEvented: typeof jObj.annotationEvented === 'boolean'
                    ? jObj.annotationEvented
                    : undefined,
                annotationHasControls: typeof jObj.annotationHasControls === 'boolean'
                    ? jObj.annotationHasControls
                    : undefined,
                annotationEditable: typeof jObj.annotationEditable === 'boolean'
                    ? jObj.annotationEditable
                    : undefined,
            });
            return;
        }
        if (jObj.editorObjectKind === 'session' && typeof jObj.sessionObjectType === 'string') {
            canvasObj.editorObjectKind = 'session';
            canvasObj.sessionObjectType = jObj.sessionObjectType;
        }
    });
    const consumedCanvasIndexes = new Set();
    for (const jObj of jsonObjs) {
        if (jObj.editorObjectKind !== 'mask' || typeof jObj.maskId !== 'number')
            continue;
        const jType = String((_a = jObj.type) !== null && _a !== void 0 ? _a : '');
        const jLeft = Number((_b = jObj.left) !== null && _b !== void 0 ? _b : 0);
        const jTop = Number((_c = jObj.top) !== null && _c !== void 0 ? _c : 0);
        const jUid = typeof jObj.maskUid === 'string' ? jObj.maskUid : null;
        let matchIndex = -1;
        if (jUid) {
            matchIndex = canvasObjs.findIndex((o, index) => {
                if (consumedCanvasIndexes.has(index))
                    return false;
                return o.maskUid === jUid;
            });
        }
        if (matchIndex < 0) {
            matchIndex = canvasObjs.findIndex((o, index) => {
                var _a, _b;
                if (consumedCanvasIndexes.has(index))
                    return false;
                if (jType && o.type !== jType)
                    return false;
                return Math.abs(((_a = o.left) !== null && _a !== void 0 ? _a : 0) - jLeft) < 0.5 && Math.abs(((_b = o.top) !== null && _b !== void 0 ? _b : 0) - jTop) < 0.5;
            });
        }
        if (matchIndex < 0)
            continue;
        consumedCanvasIndexes.add(matchIndex);
        const match = canvasObjs[matchIndex];
        const maskObject = match;
        const originalStroke = 'originalStroke' in jObj
            ? jObj.originalStroke
            : undefined;
        markMaskObject(maskObject, {
            maskId: jObj.maskId,
            maskUid: typeof jObj.maskUid === 'string' ? jObj.maskUid : `mask-${jObj.maskId}`,
            maskName: typeof jObj.maskName === 'string' ? jObj.maskName : '',
            originalAlpha: typeof jObj.originalAlpha === 'number'
                ? jObj.originalAlpha
                : ((_d = maskObject.opacity) !== null && _d !== void 0 ? _d : 0.5),
            originalStroke,
            originalStrokeWidth: typeof jObj.originalStrokeWidth === 'number' ? jObj.originalStrokeWidth : undefined,
        });
        if ('originalStroke' in jObj) {
            maskObject.originalStroke = jObj.originalStroke;
        }
        if (typeof jObj.originalStrokeWidth === 'number') {
            maskObject.originalStrokeWidth = jObj.originalStrokeWidth;
        }
        if (typeof jObj.hasControls === 'boolean') {
            maskObject.hasControls = jObj.hasControls;
        }
        if (typeof jObj.selectable === 'boolean') {
            maskObject.selectable = jObj.selectable;
        }
        if (typeof jObj.strokeUniform === 'boolean') {
            maskObject.strokeUniform = jObj.strokeUniform;
        }
        if (typeof jObj.lockRotation === 'boolean') {
            maskObject.lockRotation = jObj.lockRotation;
        }
        if (typeof jObj.transparentCorners === 'boolean') {
            maskObject.transparentCorners = jObj.transparentCorners;
        }
        if (typeof jObj.borderColor === 'string') {
            maskObject.borderColor = jObj.borderColor;
        }
        if (typeof jObj.cornerColor === 'string') {
            maskObject.cornerColor = jObj.cornerColor;
        }
        if (typeof jObj.cornerSize === 'number') {
            maskObject.cornerSize = jObj.cornerSize;
        }
    }
    jsonObjs.forEach((jObj, index) => {
        if (jObj.maskLabel !== true)
            return;
        const canvasObj = canvasObjs[index];
        if (canvasObj) {
            canvasObj.maskLabel = true;
        }
    });
}
//# sourceMappingURL=state-serializer.js.map