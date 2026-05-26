import { isMaskObject } from './public-types.js';
export const SNAPSHOT_CUSTOM_KEYS = [
    'maskId',
    'maskName',
    'isCropRect',
    'maskLabel',
    'originalAlpha',
    'originalStroke',
    'originalStrokeWidth',
];
export function saveState(input) {
    const { canvas, currentScale, currentRotation, baseImageScale } = input;
    canvas.discardActiveObject();
    const jsonObj = canvas.toJSON(SNAPSHOT_CUSTOM_KEYS);
    if (Array.isArray(jsonObj.objects)) {
        jsonObj.objects = jsonObj.objects.filter(o => o.isCropRect !== true && o.maskLabel !== true);
    }
    jsonObj._editorState = {
        currentScale,
        currentRotation,
        baseImageScale,
    };
    return JSON.stringify(jsonObj);
}
export async function loadFromState(input) {
    var _a, _b;
    const { canvas, jsonString: snapshotInput, setCanvasSize } = input;
    const jsonString = typeof snapshotInput === 'string'
        ? snapshotInput
        : JSON.stringify(snapshotInput);
    const json = JSON.parse(jsonString);
    if (typeof json.width === 'number' &&
        json.width > 0 &&
        typeof json.height === 'number' &&
        json.height > 0) {
        setCanvasSize(json.width, json.height);
    }
    await canvas.loadFromJSON(json);
    const objects = canvas.getObjects();
    restoreMaskPropsFromJSON(objects, (_a = json.objects) !== null && _a !== void 0 ? _a : []);
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
    const maxMaskId = objects
        .filter(isMaskObject)
        .reduce((max, maskObject) => Math.max(max, maskObject.maskId), 0);
    const originalImage = ((_b = objects.find(o => o.type === 'image' && !isMaskObject(o))) !== null && _b !== void 0 ? _b : null);
    return {
        editorState,
        maxMaskId,
        originalImage,
        objects,
        jsonString,
    };
}
function restoreMaskPropsFromJSON(canvasObjs, jsonObjs) {
    var _a, _b, _c, _d, _e;
    const consumedCanvasIndexes = new Set();
    for (const jObj of jsonObjs) {
        if (typeof jObj.maskId !== 'number')
            continue;
        const jType = String((_a = jObj.type) !== null && _a !== void 0 ? _a : '');
        const jLeft = Number((_b = jObj.left) !== null && _b !== void 0 ? _b : 0);
        const jTop = Number((_c = jObj.top) !== null && _c !== void 0 ? _c : 0);
        const matchIndex = canvasObjs.findIndex((o, index) => {
            var _a, _b;
            if (consumedCanvasIndexes.has(index))
                return false;
            if (jType && o.type !== jType)
                return false;
            return (Math.abs(((_a = o.left) !== null && _a !== void 0 ? _a : 0) - jLeft) < 0.5 &&
                Math.abs(((_b = o.top) !== null && _b !== void 0 ? _b : 0) - jTop) < 0.5);
        });
        if (matchIndex < 0)
            continue;
        consumedCanvasIndexes.add(matchIndex);
        const match = canvasObjs[matchIndex];
        const maskObject = match;
        maskObject.maskId = jObj.maskId;
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
    }
    jsonObjs.forEach((jObj, idx) => {
        if (jObj.maskLabel !== true)
            return;
        const canvasObj = canvasObjs[idx];
        if (canvasObj) {
            canvasObj.maskLabel = true;
        }
    });
}
//# sourceMappingURL=state-serializer.js.map