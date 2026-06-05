import { isMaskObject } from './public-types.js';
export const SNAPSHOT_CUSTOM_KEYS = [
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
];
function copySnapshotCustomPropsFromCanvas(canvasObjects, jsonObjects) {
    if (!Array.isArray(jsonObjects))
        return;
    for (let index = 0; index < jsonObjects.length; index += 1) {
        const liveObject = canvasObjects[index];
        const jsonObject = jsonObjects[index];
        if (!liveObject || !jsonObject)
            continue;
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
        if (liveObject.isCropRect === true)
            jsonObject.isCropRect = true;
        if (liveObject.maskLabel === true)
            jsonObject.maskLabel = true;
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
        (isType.call(object, 'ActiveSelection') ||
            isType.call(object, 'activeSelection') ||
            isType.call(object, 'activeselection')));
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
    if (isActiveSelectionObject(activeObject)) {
        canvas.discardActiveObject();
    }
    const jsonObj = canvas.toJSON(SNAPSHOT_CUSTOM_KEYS);
    copySnapshotCustomPropsFromCanvas(canvas.getObjects(), jsonObj.objects);
    if (Array.isArray(jsonObj.objects)) {
        jsonObj.objects = jsonObj.objects.filter((o) => o.isCropRect !== true && o.maskLabel !== true);
    }
    jsonObj._editorState = {
        currentScale,
        currentRotation,
        baseImageScale,
        currentImageMimeType: (_c = input.currentImageMimeType) !== null && _c !== void 0 ? _c : null,
    };
    if (activeMaskId !== null)
        jsonObj._editorState.activeMaskId = activeMaskId;
    return JSON.stringify(jsonObj);
}
export async function loadFromState(input) {
    var _a, _b;
    const { canvas, jsonString: snapshotInput, setCanvasSize } = input;
    const jsonString = typeof snapshotInput === 'string' ? snapshotInput : JSON.stringify(snapshotInput);
    const json = JSON.parse(jsonString);
    if (typeof json.width === 'number' &&
        json.width > 0 &&
        typeof json.height === 'number' &&
        json.height > 0) {
        setCanvasSize(json.width, json.height);
    }
    await canvas.loadFromJSON(json);
    const objects = canvas.getObjects();
    restoreMaskPropsFromJson(objects, (_a = json.objects) !== null && _a !== void 0 ? _a : []);
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
    const originalImage = ((_b = objects.find(isOriginalImageObject)) !== null && _b !== void 0 ? _b : null);
    return {
        editorState,
        maxMaskId,
        originalImage,
        objects,
        jsonString,
    };
}
function isOriginalImageObject(object) {
    if (isMaskObject(object))
        return false;
    const type = typeof object.type === 'string' ? object.type.toLowerCase() : '';
    if (type === 'image')
        return true;
    const isType = object.isType;
    return typeof isType === 'function' && isType.call(object, 'image');
}
function restoreMaskPropsFromJson(canvasObjs, jsonObjs) {
    var _a, _b, _c, _d, _e;
    const consumedCanvasIndexes = new Set();
    for (const jObj of jsonObjs) {
        if (typeof jObj.maskId !== 'number')
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
        maskObject.maskId = jObj.maskId;
        if (typeof jObj.maskUid === 'string') {
            maskObject.maskUid = jObj.maskUid;
        }
        maskObject.maskName = String((_d = jObj.maskName) !== null && _d !== void 0 ? _d : '');
        maskObject.originalAlpha =
            typeof jObj.originalAlpha === 'number'
                ? jObj.originalAlpha
                : ((_e = maskObject.opacity) !== null && _e !== void 0 ? _e : 0.5);
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