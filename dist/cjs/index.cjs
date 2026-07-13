'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var internalCapabilities = require('./chunks/internal-capabilities-DIerpWRs.cjs');
var plugins_mask_index = require('./chunks/index-DGTy4zAa.cjs');
var plugins_transform_index = require('./chunks/index-CboFlSRG.cjs');
var foundations_overlay_index = require('./chunks/index-Cs4bNsWm.cjs');
var core_index = require('./chunks/index-CeRMDho6.cjs');
var plugins_history_index = require('./plugins/history/index.cjs');
require('./chunks/errors-CQdnZvQh.cjs');
require('./chunks/disposable-Sj4tt6Lk.cjs');

const FULL_FACADE_STATE_ID = '@bensitu/full-facade';
const COMPATIBILITY_OBJECT_PROPERTIES = Object.freeze([
    'sessionObjectType',
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
    'shapeAnnotationKind',
    'annotationName',
    'annotationHidden',
    'annotationLocked',
    'annotationSelectable',
    'annotationEvented',
    'annotationHasControls',
    'annotationEditable',
    'overlayPersistentId',
    'overlayMetadata',
]);
function isRecord$1(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isFiniteNumber$1(value) {
    return typeof value === 'number' && Number.isFinite(value);
}
function isImageMimeType$1(value) {
    return (value === null || value === 'image/jpeg' || value === 'image/png' || value === 'image/webp');
}
function validateState(value) {
    if (!isRecord$1(value))
        return false;
    return (isFiniteNumber$1(value.currentScale) &&
        value.currentScale > 0 &&
        isFiniteNumber$1(value.currentRotation) &&
        isFiniteNumber$1(value.baseImageScale) &&
        value.baseImageScale > 0 &&
        isImageMimeType$1(value.imageMimeType) &&
        Number.isSafeInteger(value.annotationCounter) &&
        Number(value.annotationCounter) >= 0 &&
        isRecord$1(value.imageFilterConfig) &&
        isRecord$1(value.lastCommittedImageFilterConfig) &&
        Array.isArray(value.selectedAnnotationIds) &&
        value.selectedAnnotationIds.every((id) => Number.isSafeInteger(id) && Number(id) > 0));
}
const fullFacadeStatePluginRef = internalCapabilities.definePluginRef(FULL_FACADE_STATE_ID, '1.0.0');
function fullFacadeStatePlugin(access) {
    return Object.freeze({
        ref: fullFacadeStatePluginRef,
        version: '1.0.0',
        setupMode: 'sync',
        requires: [{ token: internalCapabilities.CORE_STATE_CAPABILITY, range: '^1.0.0' }],
        setup(context) {
            const state = context.capabilities.require(internalCapabilities.CORE_STATE_CAPABILITY);
            context.addDisposable(state.objectProperties.register({
                owner: FULL_FACADE_STATE_ID,
                keys: COMPATIBILITY_OBJECT_PROPERTIES,
            }));
            context.addDisposable(state.transientObjects.register(FULL_FACADE_STATE_ID, (object) => {
                const candidate = object;
                return (candidate.isCropRect === true ||
                    candidate.maskLabel === true ||
                    candidate.isMosaicPreview === true ||
                    typeof candidate.sessionObjectType === 'string');
            }));
            context.addDisposable(state.slices.register({
                id: FULL_FACADE_STATE_ID,
                version: 1,
                capture: () => access.capture(),
                validate: (value) => validateState(value)
                    ? { valid: true, value }
                    : {
                        valid: false,
                        message: 'Full facade compatibility state is malformed.',
                    },
                restore: (value) => access.restore(value),
                clearState: () => access.clearState(),
            }));
            return Object.freeze({});
        },
    });
}

function isAnnotationLocked(annotation) {
    return annotation.annotationLocked === true;
}
function isAnnotationUnlocked(annotation) {
    return !isAnnotationLocked(annotation);
}

function setObjectProps(object, props) {
    object.set(props);
}
function readBoolean$1(value, fallback) {
    return typeof value === 'boolean' ? value : fallback;
}
function getBaseSelectable(annotation) {
    return readBoolean$1(annotation.annotationSelectable, readBoolean$1(annotation.selectable, true));
}
function getBaseEvented(annotation) {
    return readBoolean$1(annotation.annotationEvented, readBoolean$1(annotation.evented, true));
}
function getBaseHasControls(annotation) {
    return readBoolean$1(annotation.annotationHasControls, readBoolean$1(annotation.hasControls, true));
}
function getBaseEditable(annotation) {
    return readBoolean$1(annotation.annotationEditable, readBoolean$1(annotation.editable, true));
}
function syncTextEditability(annotation, editable) {
    const textObject = annotation;
    textObject.editable = editable;
}
function ensureBaseInteractivityMetadata(annotation) {
    if (typeof annotation.annotationSelectable !== 'boolean') {
        annotation.annotationSelectable = readBoolean$1(annotation.selectable, true);
    }
    if (typeof annotation.annotationEvented !== 'boolean') {
        annotation.annotationEvented = readBoolean$1(annotation.evented, true);
    }
    if (typeof annotation.annotationHasControls !== 'boolean') {
        annotation.annotationHasControls = readBoolean$1(annotation.hasControls, true);
    }
    if (plugins_mask_index.isTextAnnotationObject(annotation) && typeof annotation.annotationEditable !== 'boolean') {
        annotation.annotationEditable = getBaseEditable(annotation);
    }
}
function syncAnnotationRuntimeState(annotation) {
    var _a, _b;
    const hidden = annotation.annotationHidden === true;
    const locked = isAnnotationLocked(annotation);
    if (locked) {
        ensureBaseInteractivityMetadata(annotation);
        setObjectProps(annotation, {
            visible: !hidden,
            selectable: false,
            evented: false,
            hasControls: false,
            lockMovementX: true,
            lockMovementY: true,
            lockScalingX: true,
            lockScalingY: true,
            lockRotation: true,
        });
        if (plugins_mask_index.isTextAnnotationObject(annotation)) {
            syncTextEditability(annotation, false);
        }
        (_a = annotation.setCoords) === null || _a === void 0 ? void 0 : _a.call(annotation);
        return;
    }
    setObjectProps(annotation, {
        visible: !hidden,
        selectable: getBaseSelectable(annotation),
        evented: getBaseEvented(annotation),
        hasControls: getBaseHasControls(annotation),
        lockMovementX: false,
        lockMovementY: false,
        lockScalingX: false,
        lockScalingY: false,
        lockRotation: false,
    });
    if (plugins_mask_index.isTextAnnotationObject(annotation)) {
        syncTextEditability(annotation, getBaseEditable(annotation));
    }
    (_b = annotation.setCoords) === null || _b === void 0 ? void 0 : _b.call(annotation);
}
function syncAnnotationRuntimeStates(annotations) {
    annotations.forEach(syncAnnotationRuntimeState);
}

const DEFAULT_IMAGE_FILTER_CONFIG = Object.freeze({
    brightness: 0,
    contrast: 0,
    saturation: 0,
    blur: 0,
    sharpen: 0,
    grayscale: false,
    sepia: false,
    vintage: false,
});
function isConfigObject$1(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function hasOwn$1(object, key) {
    return Object.prototype.hasOwnProperty.call(object, key);
}
function normalizeNumberField(raw, key, fallback, min, max, warnings) {
    if (!hasOwn$1(raw, key))
        return fallback;
    const value = raw[key];
    if (value === undefined || value === null)
        return 0;
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        warnings.push(key);
        return fallback;
    }
    if (value < min || value > max) {
        warnings.push(key);
        return Math.max(min, Math.min(max, value));
    }
    return value;
}
function normalizeBooleanField(raw, key, fallback, warnings) {
    if (!hasOwn$1(raw, key))
        return fallback;
    const value = raw[key];
    if (value === undefined || value === null)
        return false;
    if (typeof value !== 'boolean') {
        warnings.push(key);
        return fallback;
    }
    return value;
}
function cloneResolvedImageFilterConfig(config) {
    return { ...config };
}
function mergeImageFilterConfigPatch(current, patch) {
    const raw = isConfigObject$1(patch) ? patch : {};
    const warnings = [];
    const config = {
        brightness: normalizeNumberField(raw, 'brightness', current.brightness, -1, 1, warnings),
        contrast: normalizeNumberField(raw, 'contrast', current.contrast, -1, 1, warnings),
        saturation: normalizeNumberField(raw, 'saturation', current.saturation, -1, 1, warnings),
        blur: normalizeNumberField(raw, 'blur', current.blur, 0, 1, warnings),
        sharpen: normalizeNumberField(raw, 'sharpen', current.sharpen, 0, 1, warnings),
        grayscale: normalizeBooleanField(raw, 'grayscale', current.grayscale, warnings),
        sepia: normalizeBooleanField(raw, 'sepia', current.sepia, warnings),
        vintage: normalizeBooleanField(raw, 'vintage', current.vintage, warnings),
    };
    return { config, warnings };
}
function normalizeImageFilterConfigSnapshot(value) {
    if (!isConfigObject$1(value))
        return cloneResolvedImageFilterConfig(DEFAULT_IMAGE_FILTER_CONFIG);
    return mergeImageFilterConfigPatch(cloneResolvedImageFilterConfig(DEFAULT_IMAGE_FILTER_CONFIG), value).config;
}
function areResolvedImageFilterConfigsEqual(left, right) {
    return (left.brightness === right.brightness &&
        left.contrast === right.contrast &&
        left.saturation === right.saturation &&
        left.blur === right.blur &&
        left.sharpen === right.sharpen &&
        left.grayscale === right.grayscale &&
        left.sepia === right.sepia &&
        left.vintage === right.vintage);
}
function hasActiveImageFilters(config) {
    return (config.brightness !== 0 ||
        config.contrast !== 0 ||
        config.saturation !== 0 ||
        config.blur !== 0 ||
        config.sharpen !== 0 ||
        config.grayscale ||
        config.sepia ||
        config.vintage);
}

const SUPPORTED_IMAGE_EXTENSIONS = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
};
const SUPPORTED_IMAGE_MIME_TYPES = new Set(Object.values(SUPPORTED_IMAGE_EXTENSIONS));
function isSupportedImageDataUrl(value) {
    if (typeof value !== 'string')
        return false;
    if (!value.toLowerCase().startsWith('data:image/'))
        return false;
    const match = /^data:(image\/[^;,]+)(?:[;,])/i.exec(value);
    if (!match)
        return false;
    return SUPPORTED_IMAGE_MIME_TYPES.has(match[1].toLowerCase());
}
function inferImageMimeType(file) {
    var _a, _b;
    if (file.type && SUPPORTED_IMAGE_MIME_TYPES.has(file.type))
        return file.type;
    if (file.type)
        return null;
    const match = /\.([a-z0-9]+)$/i.exec(file.name);
    const ext = (_a = match === null || match === void 0 ? void 0 : match[1]) === null || _a === void 0 ? void 0 : _a.toLowerCase();
    if (!ext)
        return null;
    return (_b = SUPPORTED_IMAGE_EXTENSIONS[ext]) !== null && _b !== void 0 ? _b : null;
}
function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const fileReaderResult = reader.result;
            if (typeof fileReaderResult === 'string') {
                resolve(fileReaderResult);
            }
            else {
                reject(new Error('FileReader returned a non-string result'));
            }
        };
        reader.onerror = () => {
            var _a;
            reject((_a = reader.error) !== null && _a !== void 0 ? _a : new Error('FileReader error'));
        };
        reader.onabort = () => {
            reject(new Error('FileReader read aborted'));
        };
        reader.readAsDataURL(file);
    });
}
function readFileAsArrayBuffer(file) {
    if (typeof file.arrayBuffer === 'function') {
        return file.arrayBuffer();
    }
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result;
            if (result instanceof ArrayBuffer) {
                resolve(result);
            }
            else {
                reject(new Error('FileReader returned a non-ArrayBuffer result'));
            }
        };
        reader.onerror = () => {
            var _a;
            reject((_a = reader.error) !== null && _a !== void 0 ? _a : new Error('FileReader error'));
        };
        reader.onabort = () => {
            reject(new Error('FileReader read aborted'));
        };
        reader.readAsArrayBuffer(file);
    });
}
function resetFileInput(input) {
    if (!input)
        return;
    try {
        input.value = '';
    }
    catch {
    }
}

function withTimeout(promise, ms, label, onTimeout) {
    return new Promise((resolve, reject) => {
        const start = Date.now();
        const timeoutId = setTimeout(() => {
            try {
                onTimeout === null || onTimeout === void 0 ? void 0 : onTimeout();
            }
            catch {
            }
            reject(new plugins_transform_index.ImageLoadTimeoutError(label, Date.now() - start));
        }, ms);
        promise.then((value) => {
            clearTimeout(timeoutId);
            resolve(value);
        }, (err) => {
            clearTimeout(timeoutId);
            reject(err);
        });
    });
}

const DEFAULT_MAX_RESTORE_CANVAS_PIXELS = 50000000;
const DEFAULT_MAX_RESTORE_CANVAS_DIMENSION = 16384;
const DEFAULT_MAX_SNAPSHOT_BYTES = 50 * 1024 * 1024;
const DEFAULT_MAX_SNAPSHOT_OBJECTS = 5000;
const DEFAULT_MAX_PUBLIC_RESTORE_NESTING_DEPTH = 100;
const DEFAULT_STATE_RESTORE_TIMEOUT_MS = 30000;
const PUBLIC_RESTORE_IMAGE_SOURCE_KEYS = new Set(['src', 'source']);
const PUBLIC_RESTORE_FABRIC_OBJECT_KEYS = new Set(['clipPath', 'backgroundImage', 'overlayImage']);
const PUBLIC_RESTORE_FABRIC_OBJECT_ARRAY_KEYS = new Set(['objects']);
const ALLOWED_PUBLIC_RESTORE_OBJECT_TYPES = new Set([
    'circle',
    'ellipse',
    'image',
    'line',
    'path',
    'polygon',
    'polyline',
    'rect',
    'text',
    'textbox',
]);
const SNAPSHOT_CUSTOM_KEYS = Object.freeze([
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
    'shapeAnnotationKind',
    'annotationName',
    'annotationHidden',
    'annotationLocked',
    'annotationSelectable',
    'annotationEvented',
    'annotationHasControls',
    'annotationEditable',
    'overlayPersistentId',
    'overlayMetadata',
]);
function readFiniteNumber(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
}
function serializedTypeMatches(liveObject, jsonObject) {
    const jsonType = typeof jsonObject.type === 'string' ? jsonObject.type.toLowerCase() : '';
    const liveType = typeof liveObject.type === 'string' ? liveObject.type.toLowerCase() : '';
    return !jsonType || liveType === jsonType;
}
function serializedPositionMatches(liveObject, jsonObject) {
    var _a, _b;
    const jsonLeft = readFiniteNumber(jsonObject.left);
    const jsonTop = readFiniteNumber(jsonObject.top);
    if (jsonLeft === null || jsonTop === null)
        return true;
    return (Math.abs(((_a = liveObject.left) !== null && _a !== void 0 ? _a : 0) - jsonLeft) < 0.5 &&
        Math.abs(((_b = liveObject.top) !== null && _b !== void 0 ? _b : 0) - jsonTop) < 0.5);
}
function serializedNumberMatches(liveValue, jsonValue, fallback, tolerance) {
    var _a;
    const jsonNumber = readFiniteNumber(jsonValue);
    if (jsonNumber === null)
        return true;
    const liveNumber = (_a = readFiniteNumber(liveValue)) !== null && _a !== void 0 ? _a : fallback;
    return Math.abs(liveNumber - jsonNumber) < tolerance;
}
function serializedTransformMatches(liveObject, jsonObject) {
    return (serializedNumberMatches(liveObject.angle, jsonObject.angle, 0, 0.5) &&
        serializedNumberMatches(liveObject.scaleX, jsonObject.scaleX, 1, 0.0001) &&
        serializedNumberMatches(liveObject.scaleY, jsonObject.scaleY, 1, 0.0001));
}
function serializedObjectMatches(liveObject, jsonObject) {
    const live = liveObject;
    if (typeof jsonObject.maskUid === 'string' && typeof live.maskUid === 'string') {
        return live.maskUid === jsonObject.maskUid;
    }
    if (typeof jsonObject.maskId === 'number' && typeof live.maskId === 'number') {
        return live.maskId === jsonObject.maskId;
    }
    if (typeof jsonObject.annotationId === 'number' && typeof live.annotationId === 'number') {
        return live.annotationId === jsonObject.annotationId;
    }
    if (typeof jsonObject.sessionObjectType === 'string' &&
        typeof live.sessionObjectType === 'string') {
        return live.sessionObjectType === jsonObject.sessionObjectType;
    }
    if (typeof jsonObject.editorObjectKind === 'string' &&
        typeof live.editorObjectKind === 'string' &&
        live.editorObjectKind !== jsonObject.editorObjectKind) {
        return false;
    }
    return (serializedTypeMatches(liveObject, jsonObject) &&
        serializedPositionMatches(liveObject, jsonObject) &&
        serializedTransformMatches(liveObject, jsonObject));
}
function findCanvasObjectForJson(canvasObjects, jsonObject, preferredIndex, consumedIndexes) {
    const preferred = canvasObjects[preferredIndex];
    if (preferred &&
        !consumedIndexes.has(preferredIndex) &&
        serializedObjectMatches(preferred, jsonObject)) {
        consumedIndexes.add(preferredIndex);
        return { object: preferred, index: preferredIndex };
    }
    const matchedIndex = canvasObjects.findIndex((candidate, index) => !consumedIndexes.has(index) && serializedObjectMatches(candidate, jsonObject));
    if (matchedIndex < 0)
        return null;
    consumedIndexes.add(matchedIndex);
    return { object: canvasObjects[matchedIndex], index: matchedIndex };
}
function copySnapshotCustomPropsFromCanvas(canvasObjects, jsonObjects) {
    if (!Array.isArray(jsonObjects))
        return;
    const consumedIndexes = new Set();
    for (let index = 0; index < jsonObjects.length; index += 1) {
        const jsonObject = jsonObjects[index];
        if (!jsonObject)
            continue;
        const match = findCanvasObjectForJson(canvasObjects, jsonObject, index, consumedIndexes);
        if (!match)
            continue;
        const liveObject = match.object;
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
        if (liveObject.originalStroke !== undefined) {
            jsonObject.originalStroke = liveObject.originalStroke;
        }
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
        if (typeof liveObject.shapeAnnotationKind === 'string') {
            jsonObject.shapeAnnotationKind = liveObject.shapeAnnotationKind;
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
        if (typeof liveObject.overlayPersistentId === 'string') {
            jsonObject.overlayPersistentId = liveObject.overlayPersistentId;
        }
        if (liveObject.overlayMetadata !== undefined) {
            jsonObject.overlayMetadata = liveObject.overlayMetadata;
        }
    }
}
function isActiveSelectionObject$2(object) {
    if (!object)
        return false;
    const type = typeof object.type === 'string' ? object.type.toLowerCase() : '';
    if (type === 'activeselection')
        return true;
    const isType = object.isType;
    return (typeof isType === 'function' &&
        (isType.call(object, 'ActiveSelection') || isType.call(object, 'activeSelection')));
}
function saveState(input) {
    var _a, _b, _c, _d;
    const { canvas, currentScale, currentRotation, baseImageScale } = input;
    const activeObject = (_b = (_a = canvas).getActiveObject) === null || _b === void 0 ? void 0 : _b.call(_a);
    const activeMaskId = activeObject && plugins_mask_index.isMaskObject(activeObject)
        ? activeObject.maskId
        : typeof input.activeMaskId === 'number'
            ? input.activeMaskId
            : null;
    const activeAnnotationId = activeObject && plugins_mask_index.isAnnotationObject(activeObject)
        ? activeObject.annotationId
        : typeof input.activeAnnotationId === 'number'
            ? input.activeAnnotationId
            : null;
    if (isActiveSelectionObject$2(activeObject)) {
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
    const imageFilterConfig = cloneResolvedImageFilterConfig((_d = input.imageFilterConfig) !== null && _d !== void 0 ? _d : DEFAULT_IMAGE_FILTER_CONFIG);
    if (hasActiveImageFilters(imageFilterConfig)) {
        jsonObj._editorState.imageFilterConfig = imageFilterConfig;
    }
    if (activeMaskId !== null)
        jsonObj._editorState.activeMaskId = activeMaskId;
    if (activeAnnotationId !== null) {
        jsonObj._editorState.activeAnnotationId = activeAnnotationId;
    }
    return JSON.stringify(jsonObj);
}
async function loadFromState(input) {
    var _a, _b, _c, _d, _e, _f, _g;
    const { canvas, jsonString: snapshotInput, setCanvasSize } = input;
    const restoreTrustLevel = (_a = input.restoreTrustLevel) !== null && _a !== void 0 ? _a : 'public';
    const isPublicRestore = restoreTrustLevel === 'public';
    let jsonString;
    try {
        jsonString =
            typeof snapshotInput === 'string' ? snapshotInput : JSON.stringify(snapshotInput);
    }
    catch (error) {
        throw new plugins_transform_index.StateRestoreError('loadFromState: snapshot JSON is malformed.', error);
    }
    if (isPublicRestore) {
        assertSnapshotByteSizeAllowed(jsonString, (_b = input.maxSnapshotBytes) !== null && _b !== void 0 ? _b : DEFAULT_MAX_SNAPSHOT_BYTES);
    }
    let json;
    try {
        json = JSON.parse(jsonString);
    }
    catch (error) {
        throw new plugins_transform_index.StateRestoreError('loadFromState: snapshot JSON is malformed.', error);
    }
    if (isPublicRestore) {
        validatePublicSnapshot(json, {
            maxSnapshotObjects: (_c = input.maxSnapshotObjects) !== null && _c !== void 0 ? _c : DEFAULT_MAX_SNAPSHOT_OBJECTS,
        });
    }
    if (typeof json.width === 'number' &&
        json.width > 0 &&
        typeof json.height === 'number' &&
        json.height > 0) {
        assertRestoredCanvasSizeAllowed(json.width, json.height, (_d = input.maxCanvasPixels) !== null && _d !== void 0 ? _d : DEFAULT_MAX_RESTORE_CANVAS_PIXELS, isPublicRestore
            ? ((_e = input.maxRestoreCanvasDimension) !== null && _e !== void 0 ? _e : DEFAULT_MAX_RESTORE_CANVAS_DIMENSION)
            : null);
        setCanvasSize(json.width, json.height);
    }
    const loadFromJsonPromise = canvas.loadFromJSON(json);
    try {
        await withTimeout(loadFromJsonPromise, DEFAULT_STATE_RESTORE_TIMEOUT_MS, 'canvas.loadFromJSON');
    }
    catch (error) {
        if (error instanceof plugins_transform_index.ImageLoadTimeoutError) {
            throw new plugins_transform_index.StateRestoreError('loadFromState: canvas.loadFromJSON timed out while restoring editor state.', error);
        }
        throw error;
    }
    const objects = canvas.getObjects();
    restoreEditorObjectPropsFromJson(objects, (_f = json.objects) !== null && _f !== void 0 ? _f : []);
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
    if (editorState && json._editorState && 'imageFilterConfig' in json._editorState) {
        editorState.imageFilterConfig = normalizeImageFilterConfigSnapshot(json._editorState.imageFilterConfig);
    }
    const maxMaskId = objects
        .filter(plugins_mask_index.isMaskObject)
        .reduce((max, maskObject) => Math.max(max, maskObject.maskId), 0);
    const maxAnnotationId = objects
        .filter(plugins_mask_index.isAnnotationObject)
        .reduce((max, annotationObject) => Math.max(max, annotationObject.annotationId), 0);
    const masks = objects.filter(plugins_mask_index.isMaskObject);
    const annotations = objects.filter(plugins_mask_index.isAnnotationObject);
    const originalImage = (_g = objects.find(plugins_mask_index.isBaseImageObject)) !== null && _g !== void 0 ? _g : null;
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
function assertRestoredCanvasSizeAllowed(width, height, maxCanvasPixels, maxCanvasDimension) {
    const safeMaxCanvasPixels = Number.isFinite(maxCanvasPixels) && maxCanvasPixels > 0
        ? Math.floor(maxCanvasPixels)
        : DEFAULT_MAX_RESTORE_CANVAS_PIXELS;
    const safeMaxCanvasDimension = maxCanvasDimension !== null && Number.isFinite(maxCanvasDimension) && maxCanvasDimension > 0
        ? Math.floor(maxCanvasDimension)
        : null;
    if (safeMaxCanvasDimension !== null &&
        (width > safeMaxCanvasDimension || height > safeMaxCanvasDimension)) {
        throw new plugins_transform_index.StateRestoreError(`loadFromState: snapshot canvas size ${width}x${height} exceeds maxRestoreCanvasDimension (${safeMaxCanvasDimension}).`);
    }
    const pixelCount = width * height;
    if (!Number.isFinite(pixelCount) || pixelCount > safeMaxCanvasPixels) {
        throw new plugins_transform_index.StateRestoreError(`loadFromState: snapshot canvas size ${width}x${height} exceeds maxCanvasPixels (${safeMaxCanvasPixels}).`);
    }
}
function getUtf8ByteLength$1(value) {
    if (typeof TextEncoder === 'function') {
        return new TextEncoder().encode(value).byteLength;
    }
    return value.length;
}
function toPositiveIntegerLimit(value, fallback) {
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}
function assertSnapshotByteSizeAllowed(jsonString, maxSnapshotBytes) {
    const safeMaxSnapshotBytes = toPositiveIntegerLimit(maxSnapshotBytes, DEFAULT_MAX_SNAPSHOT_BYTES);
    if (jsonString.length > safeMaxSnapshotBytes) {
        throw new plugins_transform_index.StateRestoreError(`loadFromState: snapshot JSON size exceeds maxSnapshotBytes (${safeMaxSnapshotBytes}).`);
    }
    const worstCaseUtf8Bytes = jsonString.length * 3;
    if (worstCaseUtf8Bytes <= safeMaxSnapshotBytes)
        return;
    const byteLength = getUtf8ByteLength$1(jsonString);
    if (byteLength > safeMaxSnapshotBytes) {
        throw new plugins_transform_index.StateRestoreError(`loadFromState: snapshot JSON size ${byteLength} bytes exceeds maxSnapshotBytes (${safeMaxSnapshotBytes}).`);
    }
}
function validatePublicSnapshot(json, options) {
    var _a;
    if (json.objects !== undefined && !Array.isArray(json.objects)) {
        throw new plugins_transform_index.StateRestoreError('loadFromState: snapshot objects must be an array.');
    }
    const objects = (_a = json.objects) !== null && _a !== void 0 ? _a : [];
    const safeMaxSnapshotObjects = toPositiveIntegerLimit(options.maxSnapshotObjects, DEFAULT_MAX_SNAPSHOT_OBJECTS);
    if (objects.length > safeMaxSnapshotObjects) {
        throw new plugins_transform_index.StateRestoreError(`loadFromState: snapshot contains ${objects.length} objects, exceeding maxSnapshotObjects (${safeMaxSnapshotObjects}).`);
    }
    const context = {
        maxSnapshotObjects: safeMaxSnapshotObjects,
        objectCount: 0,
        seen: new WeakSet(),
        countedFabricObjects: new WeakSet(),
    };
    objects.forEach((object, index) => validatePublicSnapshotValue(object, `objects[${index}]`, {
        validateFabricObject: true,
        allowEditorOwnedCustomMask: true,
        arrayEntriesAreFabricObjects: false,
    }, context, 0));
    for (const [key, value] of Object.entries(json)) {
        if (key === 'objects')
            continue;
        validatePublicSnapshotValue(value, key, {
            validateFabricObject: PUBLIC_RESTORE_FABRIC_OBJECT_KEYS.has(key),
            allowEditorOwnedCustomMask: false,
            arrayEntriesAreFabricObjects: PUBLIC_RESTORE_FABRIC_OBJECT_ARRAY_KEYS.has(key),
        }, context, 0);
    }
}
function validatePublicSnapshotValue(value, path, options, context, depth) {
    if (depth > DEFAULT_MAX_PUBLIC_RESTORE_NESTING_DEPTH) {
        throw new plugins_transform_index.StateRestoreError(`loadFromState: snapshot field "${path}" exceeds max nested object depth (${DEFAULT_MAX_PUBLIC_RESTORE_NESTING_DEPTH}).`);
    }
    if (!value || typeof value !== 'object')
        return;
    const alreadySeen = context.seen.has(value);
    if (!alreadySeen)
        context.seen.add(value);
    if (options.validateFabricObject) {
        validatePublicSnapshotFabricObjectPayload(value, path, options.allowEditorOwnedCustomMask, context);
    }
    if (alreadySeen)
        return;
    if (Array.isArray(value)) {
        value.forEach((entry, entryIndex) => validatePublicSnapshotValue(entry, `${path}[${entryIndex}]`, {
            validateFabricObject: options.arrayEntriesAreFabricObjects,
            allowEditorOwnedCustomMask: false,
            arrayEntriesAreFabricObjects: false,
        }, context, depth + 1));
        return;
    }
    for (const [key, nestedValue] of Object.entries(value)) {
        const nestedPath = path ? `${path}.${key}` : key;
        if (typeof nestedValue === 'string' &&
            nestedValue.trim() !== '' &&
            isPublicRestoreImageSourceKey(key) &&
            !isSupportedImageDataUrl(nestedValue)) {
            throw new plugins_transform_index.StateRestoreError(`loadFromState: snapshot field "${nestedPath}" must use a supported data URL source.`);
        }
        validatePublicSnapshotValue(nestedValue, nestedPath, {
            validateFabricObject: shouldValidatePublicRestoreNestedFabricObject(key, nestedValue),
            allowEditorOwnedCustomMask: false,
            arrayEntriesAreFabricObjects: PUBLIC_RESTORE_FABRIC_OBJECT_ARRAY_KEYS.has(key),
        }, context, depth + 1);
    }
}
function validatePublicSnapshotFabricObjectPayload(value, path, allowEditorOwnedCustomMask, context) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new plugins_transform_index.StateRestoreError(`loadFromState: snapshot field "${path}" is invalid.`);
    }
    if (!context.countedFabricObjects.has(value)) {
        context.countedFabricObjects.add(value);
        context.objectCount += 1;
        if (context.objectCount > context.maxSnapshotObjects) {
            throw new plugins_transform_index.StateRestoreError(`loadFromState: snapshot contains more than ${context.maxSnapshotObjects} Fabric objects.`);
        }
    }
    const object = value;
    const type = typeof object.type === 'string' ? object.type.toLowerCase() : '';
    if (type && ALLOWED_PUBLIC_RESTORE_OBJECT_TYPES.has(type))
        return;
    if (allowEditorOwnedCustomMask && isPublicRestoreEditorOwnedCustomMaskPayload(object))
        return;
    const typePath = path ? `${path}.type` : 'type';
    if (!type) {
        throw new plugins_transform_index.StateRestoreError(`loadFromState: snapshot field "${typePath}" must be a supported Fabric type.`);
    }
    throw new plugins_transform_index.StateRestoreError(`loadFromState: snapshot field "${typePath}" has unsupported Fabric type "${String(object.type)}".`);
}
function shouldValidatePublicRestoreNestedFabricObject(key, value) {
    if (PUBLIC_RESTORE_FABRIC_OBJECT_KEYS.has(key))
        return true;
    return isPublicRestoreImageSourceKey(key) && hasFabricObjectType(value);
}
function hasFabricObjectType(value) {
    return (!!value && typeof value === 'object' && typeof value.type === 'string');
}
function isPublicRestoreEditorOwnedCustomMaskPayload(value) {
    if (!plugins_mask_index.isMaskObject(value))
        return false;
    const candidate = value;
    const expectedMaskUid = typeof candidate.maskId === 'number' ? `mask-${candidate.maskId}` : null;
    return (Number.isInteger(candidate.maskId) &&
        typeof candidate.maskId === 'number' &&
        candidate.maskId > 0 &&
        typeof candidate.maskUid === 'string' &&
        candidate.maskUid === expectedMaskUid &&
        typeof candidate.maskName === 'string' &&
        candidate.maskName.trim() !== '' &&
        typeof candidate.originalAlpha === 'number' &&
        Number.isFinite(candidate.originalAlpha));
}
function isPublicRestoreImageSourceKey(key) {
    const normalized = key.toLowerCase();
    return (PUBLIC_RESTORE_IMAGE_SOURCE_KEYS.has(normalized) ||
        normalized.endsWith('src') ||
        normalized.endsWith('source'));
}
function restoreEditorObjectPropsFromJson(canvasObjs, jsonObjs) {
    var _a, _b, _c, _d;
    const consumedMetadataIndexes = new Set();
    jsonObjs.forEach((jObj, index) => {
        if (jObj.editorObjectKind !== 'baseImage' &&
            jObj.editorObjectKind !== 'annotation' &&
            jObj.editorObjectKind !== 'session') {
            return;
        }
        const match = findCanvasObjectForJson(canvasObjs, jObj, index, consumedMetadataIndexes);
        const canvasObj = match === null || match === void 0 ? void 0 : match.object;
        if (!canvasObj)
            return;
        if (jObj.editorObjectKind === 'baseImage') {
            plugins_mask_index.markBaseImageObject(canvasObj);
            return;
        }
        if (jObj.editorObjectKind === 'annotation' &&
            typeof jObj.annotationId === 'number' &&
            typeof jObj.annotationType === 'string' &&
            typeof jObj.annotationName === 'string') {
            const annotationType = jObj.annotationType === 'draw'
                ? 'draw'
                : jObj.annotationType === 'shape'
                    ? 'shape'
                    : 'text';
            const shapeAnnotationKind = jObj.shapeAnnotationKind === 'line' || jObj.shapeAnnotationKind === 'arrow'
                ? jObj.shapeAnnotationKind
                : 'rect';
            plugins_mask_index.markAnnotationObject(canvasObj, {
                annotationId: jObj.annotationId,
                annotationType,
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
                shapeAnnotationKind: annotationType === 'shape' ? shapeAnnotationKind : undefined,
            });
            if (typeof jObj.overlayPersistentId === 'string') {
                canvasObj.overlayPersistentId =
                    jObj.overlayPersistentId;
            }
            if (jObj.overlayMetadata !== undefined) {
                canvasObj.overlayMetadata = jObj.overlayMetadata;
            }
            return;
        }
        if (jObj.editorObjectKind === 'session' && typeof jObj.sessionObjectType === 'string') {
            canvasObj.editorObjectKind = 'session';
            canvasObj.sessionObjectType = jObj.sessionObjectType;
        }
    });
    const consumedCanvasIndexes = new Set();
    const canvasIndexesByMaskUid = new Map();
    canvasObjs.forEach((canvasObj, index) => {
        const maskUid = canvasObj.maskUid;
        if (typeof maskUid !== 'string')
            return;
        const indexes = canvasIndexesByMaskUid.get(maskUid);
        if (indexes) {
            indexes.push(index);
        }
        else {
            canvasIndexesByMaskUid.set(maskUid, [index]);
        }
    });
    const takeUnconsumedCanvasIndex = (indexes) => {
        if (!indexes)
            return -1;
        while (indexes.length > 0) {
            const index = indexes.shift();
            if (!consumedCanvasIndexes.has(index))
                return index;
        }
        return -1;
    };
    for (const jObj of jsonObjs) {
        if (jObj.editorObjectKind !== 'mask' || typeof jObj.maskId !== 'number')
            continue;
        const jType = String((_a = jObj.type) !== null && _a !== void 0 ? _a : '');
        const jLeft = Number((_b = jObj.left) !== null && _b !== void 0 ? _b : 0);
        const jTop = Number((_c = jObj.top) !== null && _c !== void 0 ? _c : 0);
        const jUid = typeof jObj.maskUid === 'string' ? jObj.maskUid : null;
        let matchIndex = -1;
        if (jUid) {
            matchIndex = takeUnconsumedCanvasIndex(canvasIndexesByMaskUid.get(jUid));
        }
        if (matchIndex < 0) {
            matchIndex = canvasObjs.findIndex((o, index) => {
                var _a, _b;
                if (consumedCanvasIndexes.has(index))
                    return false;
                if (jType && o.type !== jType)
                    return false;
                return (Math.abs(((_a = o.left) !== null && _a !== void 0 ? _a : 0) - jLeft) < 0.5 &&
                    Math.abs(((_b = o.top) !== null && _b !== void 0 ? _b : 0) - jTop) < 0.5 &&
                    serializedTransformMatches(o, jObj));
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
        plugins_mask_index.markMaskObject(maskObject, {
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
        if (typeof jObj.overlayPersistentId === 'string') {
            maskObject.overlayPersistentId = jObj.overlayPersistentId;
        }
        if (jObj.overlayMetadata !== undefined) {
            maskObject.overlayMetadata = jObj.overlayMetadata;
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

const ANNOTATION_BRIDGE_ID = '@bensitu/full-facade-annotation';
function isSerializedAnnotationData(value) {
    if (!value || typeof value !== 'object')
        return false;
    const candidate = value;
    return (!!candidate.object &&
        typeof candidate.object === 'object' &&
        Number.isSafeInteger(candidate.annotationId) &&
        Number(candidate.annotationId) > 0 &&
        typeof candidate.annotationType === 'string' &&
        candidate.annotationType.length > 0 &&
        typeof candidate.annotationName === 'string');
}
function readPersistentId(object) {
    if (!plugins_mask_index.isAnnotationObject(object))
        return null;
    const persistent = object
        .overlayPersistentId;
    return typeof persistent === 'string' && persistent.length > 0
        ? persistent
        : `annotation-${object.annotationId}`;
}
function serializeAnnotation(object) {
    if (!plugins_mask_index.isAnnotationObject(object))
        throw new Error('Expected an Annotation object.');
    const annotation = object;
    const serializedObject = annotation.toObject(SNAPSHOT_CUSTOM_KEYS);
    for (const key of SNAPSHOT_CUSTOM_KEYS) {
        const value = Reflect.get(annotation, key);
        if (value !== undefined)
            serializedObject[key] = value;
    }
    return Object.freeze({
        object: serializedObject,
        annotationId: annotation.annotationId,
        annotationType: annotation.annotationType,
        annotationName: annotation.annotationName,
        shapeAnnotationKind: annotation.shapeAnnotationKind,
        annotationSelectable: annotation.annotationSelectable,
        annotationEvented: annotation.annotationEvented,
        annotationHasControls: annotation.annotationHasControls,
        annotationEditable: annotation.annotationEditable,
        overlayPersistentId: annotation.overlayPersistentId,
        overlayMetadata: annotation.overlayMetadata,
    });
}
async function deserializeAnnotation(value, fabric) {
    if (!isSerializedAnnotationData(value)) {
        throw new Error('Serialized Annotation data is malformed.');
    }
    const objects = await fabric.util.enlivenObjects([value.object]);
    const object = objects[0];
    if (!object)
        throw new Error('Fabric did not restore an Annotation object.');
    const annotation = object;
    annotation.editorObjectKind = 'annotation';
    annotation.annotationId = value.annotationId;
    annotation.annotationType = value.annotationType;
    annotation.annotationName = value.annotationName;
    annotation.shapeAnnotationKind = value.shapeAnnotationKind;
    annotation.annotationSelectable = value.annotationSelectable;
    annotation.annotationEvented = value.annotationEvented;
    annotation.annotationHasControls = value.annotationHasControls;
    annotation.annotationEditable = value.annotationEditable;
    annotation.overlayPersistentId = value.overlayPersistentId;
    annotation.overlayMetadata = value.overlayMetadata;
    syncAnnotationRuntimeState(annotation);
    return annotation;
}
const fullFacadeAnnotationPluginRef = internalCapabilities.definePluginRef(ANNOTATION_BRIDGE_ID, '1.0.0');
function fullFacadeAnnotationPlugin(options) {
    return Object.freeze({
        ref: fullFacadeAnnotationPluginRef,
        version: '1.0.0',
        setupMode: 'sync',
        requires: [
            { token: internalCapabilities.CORE_HOST_CAPABILITY, range: '^1.0.0' },
            { token: foundations_overlay_index.OVERLAY_CAPABILITY, range: '^1.0.0' },
        ],
        setup(context) {
            const host = context.capabilities.require(internalCapabilities.CORE_HOST_CAPABILITY);
            const overlay = context.capabilities.require(foundations_overlay_index.OVERLAY_CAPABILITY);
            context.addDisposable(overlay.registerKind({
                id: 'annotation',
                ownerPluginId: ANNOTATION_BRIDGE_ID,
                classify: plugins_mask_index.isAnnotationObject,
                getPersistentId: readPersistentId,
                setPersistentId: (object, id) => {
                    if (plugins_mask_index.isAnnotationObject(object)) {
                        object.overlayPersistentId = id;
                    }
                },
                isHidden: (object) => plugins_mask_index.isAnnotationObject(object) && object.annotationHidden === true,
                setHidden: (object, hidden) => {
                    if (!plugins_mask_index.isAnnotationObject(object))
                        return;
                    object.annotationHidden = hidden;
                    syncAnnotationRuntimeState(object);
                },
                isLocked: (object) => plugins_mask_index.isAnnotationObject(object) && object.annotationLocked === true,
                setLocked: (object, locked) => {
                    if (!plugins_mask_index.isAnnotationObject(object))
                        return;
                    object.annotationLocked = locked;
                    syncAnnotationRuntimeState(object);
                },
            }));
            context.addDisposable(overlay.registerGeometryPolicy({
                id: `${ANNOTATION_BRIDGE_ID}:geometry`,
                kind: 'annotation',
                ownerPluginId: ANNOTATION_BRIDGE_ID,
                supports: (mutation) => options.bindToImageTransform && mutation.kind === 'transform',
                apply: (object, mutation) => {
                    if (!mutation.affineDelta)
                        return;
                    foundations_overlay_index.applyDeltaToObject(object, [...mutation.affineDelta], {
                        fabricUtil: {
                            multiplyTransformMatrices: (left, right) => host.fabric.util.multiplyTransformMatrices(left, right),
                            invertTransform: (matrix) => host.fabric.util.invertTransform(matrix),
                            qrDecompose: (matrix) => host.fabric.util.qrDecompose(matrix),
                            Point: host.fabric.Point,
                        },
                        preserveReadableText: options.textFlipBehavior === 'preserve-readable' &&
                            plugins_mask_index.isAnnotationObject(object) &&
                            object.annotationType === 'text',
                    });
                },
            }));
            context.addDisposable(overlay.registerSerializer({
                id: `${ANNOTATION_BRIDGE_ID}:serializer`,
                kind: 'annotation',
                ownerPluginId: ANNOTATION_BRIDGE_ID,
                serialize: serializeAnnotation,
                validate: isSerializedAnnotationData,
                deserialize: (value, serializerContext) => deserializeAnnotation(value, serializerContext.fabric),
            }));
            return Object.freeze({});
        },
    });
}

class DeferredHistoryPort {
    constructor(maxSize) {
        Object.defineProperty(this, "maxSize", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: maxSize
        });
        Object.defineProperty(this, "delegate", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
    }
    get history() {
        var _a;
        const candidate = this.delegate;
        return Object.freeze(new Array((_a = candidate === null || candidate === void 0 ? void 0 : candidate.retainedCount) !== null && _a !== void 0 ? _a : 0).fill(undefined));
    }
    attach(delegate) {
        if (this.delegate)
            throw new Error('[ImageEditor] History plugin is already attached.');
        this.delegate = delegate;
    }
    detach(delegate) {
        if (this.delegate === delegate)
            this.delegate = null;
    }
    execute(command) {
        var _a, _b;
        return (_b = (_a = this.delegate) === null || _a === void 0 ? void 0 : _a.execute(command)) !== null && _b !== void 0 ? _b : Promise.resolve();
    }
    push(command) {
        var _a;
        (_a = this.delegate) === null || _a === void 0 ? void 0 : _a.push(command);
    }
    clear() {
        var _a;
        (_a = this.delegate) === null || _a === void 0 ? void 0 : _a.clear();
    }
    canUndo() {
        var _a, _b;
        return (_b = (_a = this.delegate) === null || _a === void 0 ? void 0 : _a.canUndo()) !== null && _b !== void 0 ? _b : false;
    }
    canRedo() {
        var _a, _b;
        return (_b = (_a = this.delegate) === null || _a === void 0 ? void 0 : _a.canRedo()) !== null && _b !== void 0 ? _b : false;
    }
    undo() {
        var _a, _b;
        return (_b = (_a = this.delegate) === null || _a === void 0 ? void 0 : _a.undo()) !== null && _b !== void 0 ? _b : Promise.resolve();
    }
    redo() {
        var _a, _b;
        return (_b = (_a = this.delegate) === null || _a === void 0 ? void 0 : _a.redo()) !== null && _b !== void 0 ? _b : Promise.resolve();
    }
}
class PluginHistoryAdapter {
    constructor(core, history, maxSize, onChange) {
        Object.defineProperty(this, "core", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: core
        });
        Object.defineProperty(this, "history", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: history
        });
        Object.defineProperty(this, "maxSize", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: maxSize
        });
        Object.defineProperty(this, "baseline", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "unsubscribe", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "disposed", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        this.unsubscribe = history.onChange((state) => {
            this.refreshBaseline();
            onChange(state);
        });
    }
    get retainedCount() {
        return this.history.getState().size;
    }
    async execute(command) {
        this.assertActive();
        await command.execute();
        this.push(command);
    }
    push(command) {
        var _a;
        this.assertActive();
        const after = this.core.captureCompatibilityMemento();
        const before = (_a = this.baseline) !== null && _a !== void 0 ? _a : after;
        this.history.push(Object.freeze({
            operationId: 'compatibility:state-change',
            before,
            after,
            timestamp: Date.now(),
            detail: Object.freeze({ source: 'full-facade' }),
        }));
        this.baseline = after;
    }
    clear() {
        if (this.disposed)
            return;
        this.history.clear();
        this.refreshBaseline();
    }
    canUndo() {
        return !this.disposed && this.history.canUndo();
    }
    canRedo() {
        return !this.disposed && this.history.canRedo();
    }
    async undo() {
        if (this.disposed)
            return;
        await this.history.undo();
        this.refreshBaseline();
    }
    async redo() {
        if (this.disposed)
            return;
        await this.history.redo();
        this.refreshBaseline();
    }
    resetBaseline() {
        if (this.disposed)
            return;
        this.refreshBaseline();
    }
    dispose() {
        if (this.disposed)
            return;
        this.unsubscribe();
        this.baseline = null;
        this.disposed = true;
    }
    refreshBaseline() {
        try {
            this.baseline = this.core.captureCompatibilityMemento();
        }
        catch {
            this.baseline = null;
        }
    }
    assertActive() {
        if (this.disposed)
            throw new Error('[ImageEditor] History adapter is disposed.');
    }
}

function adaptLegacyOptions(options) {
    var _a, _b;
    return Object.freeze({
        core: Object.freeze({
            canvasWidth: options.canvasWidth,
            canvasHeight: options.canvasHeight,
            backgroundColor: options.backgroundColor,
            defaultLayoutMode: options.layoutMode,
            groupSelection: options.groupSelection,
            maxInputBytes: options.maxInputBytes,
            maxInputPixels: options.maxInputPixels,
            imageLoadTimeoutMs: options.imageLoadTimeoutMs,
            maxExportPixels: options.maxExportPixels,
            maxExportDimension: options.maxExportDimension,
            exportMultiplier: options.exportMultiplier,
            onError: (_a = options.onError) !== null && _a !== void 0 ? _a : undefined,
            onWarning: (_b = options.onWarning) !== null && _b !== void 0 ? _b : undefined,
        }),
        history: Object.freeze({ maxSize: options.maxHistorySize }),
        transform: Object.freeze({
            animationDuration: options.animationDuration,
            minScale: options.minScale,
            maxScale: options.maxScale,
            scaleStep: options.scaleStep,
            rotationStep: options.rotationStep,
        }),
        mask: Object.freeze({
            defaultWidth: options.defaultMaskWidth,
            defaultHeight: options.defaultMaskHeight,
            defaultConfig: options.defaultMaskConfig,
            rotatable: options.maskRotatable,
            label: options.maskLabelOnSelect ? options.label : false,
            labelOffset: options.maskLabelOffset,
            listOrder: options.maskListOrder,
            bindToImageTransform: options.bindMasksToImageTransform,
            namePrefix: options.maskName,
        }),
    });
}

function createFullCompatibilityComposition(fabric, options, legacyFeatures) {
    const mapped = adaptLegacyOptions(options);
    const core = new core_index.ImageEditorCore(fabric, mapped.core);
    try {
        const history = core.use(plugins_history_index.historyPlugin(mapped.history));
        core.use(foundations_overlay_index.overlayFoundationPlugin());
        const transform = core.use(plugins_transform_index.transformPlugin(mapped.transform));
        const masks = core.use(plugins_mask_index.maskPlugin(mapped.mask));
        let disposePromise = null;
        let disposeStarted = false;
        const disposeCore = () => {
            core.dispose();
            return core.disposeAsync();
        };
        const beginAsyncDispose = () => {
            if (disposePromise)
                return disposePromise;
            if (disposeStarted)
                return core.disposeAsync();
            disposeStarted = true;
            try {
                const legacyDispose = legacyFeatures.dispose();
                disposePromise =
                    legacyDispose && typeof legacyDispose.then === 'function'
                        ? Promise.resolve(legacyDispose).then(disposeCore)
                        : disposeCore();
            }
            catch (error) {
                disposePromise = core.disposeAsync().then(() => Promise.reject(error));
            }
            return disposePromise;
        };
        return Object.freeze({
            core,
            history,
            transform,
            masks,
            legacyFeatures,
            dispose() {
                if (disposeStarted)
                    return disposePromise !== null && disposePromise !== void 0 ? disposePromise : undefined;
                disposeStarted = true;
                try {
                    const legacyDispose = legacyFeatures.dispose();
                    if (legacyDispose && typeof legacyDispose.then === 'function') {
                        disposePromise = Promise.resolve(legacyDispose).then(() => core.disposeAsync());
                        return disposePromise;
                    }
                    disposePromise = disposeCore();
                    return disposePromise;
                }
                catch (error) {
                    disposePromise = core.disposeAsync().then(() => Promise.reject(error));
                    return disposePromise;
                }
            },
            disposeAsync() {
                return beginAsyncDispose();
            },
        });
    }
    catch (error) {
        core.dispose();
        throw error;
    }
}

function createLegacyFeatureCompatibilityPort() {
    let attached = false;
    return Object.freeze({
        get attached() {
            return attached;
        },
        attach() {
            attached = true;
        },
        dispose() {
            attached = false;
        },
    });
}

const DEFAULT_ELEMENT_TARGETS = Object.freeze({
    canvas: 'canvas',
    canvasContainer: null,
    imagePlaceholder: 'imagePlaceholder',
    scalePercentageInput: 'scalePercentageInput',
    imageBrightnessInput: 'imageBrightnessInput',
    imageContrastInput: 'imageContrastInput',
    imageSaturationInput: 'imageSaturationInput',
    imageBlurInput: 'imageBlurInput',
    imageSharpenInput: 'imageSharpenInput',
    imageGrayscaleInput: 'imageGrayscaleInput',
    imageSepiaInput: 'imageSepiaInput',
    imageVintageInput: 'imageVintageInput',
    applyImageFiltersButton: 'applyImageFiltersButton',
    resetImageFiltersButton: 'resetImageFiltersButton',
    clearImageFiltersButton: 'clearImageFiltersButton',
    rotateLeftDegreesInput: 'rotateLeftDegreesInput',
    rotateRightDegreesInput: 'rotateRightDegreesInput',
    rotateLeftButton: 'rotateLeftButton',
    rotateRightButton: 'rotateRightButton',
    flipHorizontalButton: 'flipHorizontalButton',
    flipVerticalButton: 'flipVerticalButton',
    createMaskButton: 'createMaskButton',
    removeSelectedMaskButton: 'removeSelectedMaskButton',
    removeAllMasksButton: 'removeAllMasksButton',
    mergeMasksButton: 'mergeMasksButton',
    annotationList: 'annotationList',
    enterTextModeButton: 'enterTextModeButton',
    exitTextModeButton: 'exitTextModeButton',
    textColorInput: 'textColorInput',
    textFontSizeInput: 'textFontSizeInput',
    enterDrawModeButton: 'enterDrawModeButton',
    exitDrawModeButton: 'exitDrawModeButton',
    drawColorInput: 'drawColorInput',
    drawBrushSizeInput: 'drawBrushSizeInput',
    drawBrushSubModeButton: 'drawBrushSubModeButton',
    drawEraseSubModeButton: 'drawEraseSubModeButton',
    eraserBrushSizeInput: 'eraserBrushSizeInput',
    shapeKindSelect: 'shapeKindSelect',
    shapeStrokeInput: 'shapeStrokeInput',
    shapeStrokeWidthInput: 'shapeStrokeWidthInput',
    shapeFillInput: 'shapeFillInput',
    createShapeAnnotationButton: 'createShapeAnnotationButton',
    enterShapeModeButton: 'enterShapeModeButton',
    exitShapeModeButton: 'exitShapeModeButton',
    removeSelectedAnnotationButton: 'removeSelectedAnnotationButton',
    removeAllAnnotationsButton: 'removeAllAnnotationsButton',
    deleteSelectedObjectButton: 'deleteSelectedObjectButton',
    mergeAnnotationsButton: 'mergeAnnotationsButton',
    bringSelectedObjectForwardButton: 'bringSelectedObjectForwardButton',
    sendSelectedObjectBackwardButton: 'sendSelectedObjectBackwardButton',
    bringSelectedObjectToFrontButton: 'bringSelectedObjectToFrontButton',
    sendSelectedObjectToBackButton: 'sendSelectedObjectToBackButton',
    downloadImageButton: 'downloadImageButton',
    maskList: 'maskList',
    zoomInButton: 'zoomInButton',
    zoomOutButton: 'zoomOutButton',
    resetImageTransformButton: 'resetImageTransformButton',
    undoButton: 'undoButton',
    redoButton: 'redoButton',
    imageInput: 'imageInput',
    enterCropModeButton: 'enterCropModeButton',
    cropAspectRatioSelect: 'cropAspectRatioSelect',
    applyCropButton: 'applyCropButton',
    cancelCropButton: 'cancelCropButton',
    enterMosaicModeButton: 'enterMosaicModeButton',
    exitMosaicModeButton: 'exitMosaicModeButton',
    mosaicBrushSizeInput: 'mosaicBrushSizeInput',
    mosaicBlockSizeInput: 'mosaicBlockSizeInput',
    uploadArea: 'uploadArea',
});
const ELEMENT_KEYS = Object.freeze(Object.keys(DEFAULT_ELEMENT_TARGETS));
const ELEMENT_KEY_SET = new Set(ELEMENT_KEYS);
function isElementKey(value) {
    return ELEMENT_KEY_SET.has(value);
}
function isHTMLElementTarget(value) {
    return (!!value &&
        typeof value === 'object' &&
        value.nodeType === 1 &&
        typeof value.addEventListener === 'function');
}
function getFallbackDocument() {
    return typeof document !== 'undefined' ? document : null;
}
function hasTagName(element, tagName) {
    return element.tagName.toLowerCase() === tagName;
}
function isCanvasElement(element) {
    return hasTagName(element, 'canvas');
}
function isInputElement(element) {
    return hasTagName(element, 'input');
}
function isSelectElement(element) {
    return hasTagName(element, 'select');
}
function isInputOrSelectElement(element) {
    return isInputElement(element) || isSelectElement(element);
}
function resolveDomElement(target, ownerDocument, guard) {
    var _a;
    if (target === null || target === undefined)
        return null;
    const element = isHTMLElementTarget(target)
        ? target
        : (_a = (ownerDocument !== null && ownerDocument !== void 0 ? ownerDocument : getFallbackDocument())) === null || _a === void 0 ? void 0 : _a.getElementById(target);
    if (!element)
        return null;
    if (guard && !guard(element))
        return null;
    return element;
}
function resolveElementTargets(elementMap = {}) {
    const resolved = { ...DEFAULT_ELEMENT_TARGETS };
    for (const [key, value] of Object.entries(elementMap)) {
        if (!isElementKey(key))
            continue;
        resolved[key] = value === undefined ? null : value;
    }
    return resolved;
}

const FORMAT_ALIAS_TABLE = Object.freeze({
    jpeg: 'jpeg',
    jpg: 'jpeg',
    'image/jpeg': 'jpeg',
    png: 'png',
    'image/png': 'png',
    webp: 'webp',
    'image/webp': 'webp',
});
const MIME_TABLE = Object.freeze({
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
});
function normalizeImageFormat(input) {
    var _a;
    return (_a = tryNormalizeImageFormat(input)) !== null && _a !== void 0 ? _a : 'jpeg';
}
function tryNormalizeImageFormat(input) {
    var _a;
    if (!input)
        return null;
    const key = String(input).toLowerCase();
    if (Object.prototype.hasOwnProperty.call(FORMAT_ALIAS_TABLE, key)) {
        return (_a = FORMAT_ALIAS_TABLE[key]) !== null && _a !== void 0 ? _a : null;
    }
    return null;
}
function mimeTypeFor(format) {
    return MIME_TABLE[format];
}
function clampQuality(quality, fallback) {
    const numeric = Number(quality);
    if (!Number.isFinite(numeric))
        return fallback;
    return Math.max(0, Math.min(1, numeric));
}
function resolveExportFormat(options, downsampleQuality) {
    var _a;
    const providedOptions = options !== null && options !== void 0 ? options : {};
    const fileType = providedOptions.fileType;
    const formatAlias = providedOptions.format;
    const requested = fileType || formatAlias;
    const format = normalizeImageFormat(requested);
    const mimeType = mimeTypeFor(format);
    if (format === 'png') {
        return { format, mimeType, quality: undefined };
    }
    const rawQuality = (_a = providedOptions.quality) !== null && _a !== void 0 ? _a : downsampleQuality;
    const quality = clampQuality(rawQuality, downsampleQuality);
    return { format, mimeType, quality };
}

const EMPTY_DEFAULT_MASK_CONFIG = Object.freeze({});
const DEFAULT_LAYOUT_MODE = 'expand';
const DEFAULT_OVERLAY_LIST_ORDER = 'front-to-back';
const DEFAULT_OPTIONS = {
    canvasWidth: 800,
    canvasHeight: 600,
    backgroundColor: 'transparent',
    animationDuration: 300,
    minScale: 0.1,
    maxScale: 5.0,
    scaleStep: 0.05,
    rotationStep: 90,
    bindMasksToImageTransform: false,
    bindAnnotationsToImageTransform: false,
    textAnnotationFlipBehavior: 'preserve-readable',
    defaultLayoutMode: DEFAULT_LAYOUT_MODE,
    layoutMode: DEFAULT_LAYOUT_MODE,
    downsampleOnLoad: true,
    downsampleMaxWidth: 4000,
    downsampleMaxHeight: 3000,
    downsampleQuality: 0.92,
    preserveSourceFormat: true,
    downsampleMimeType: null,
    autoOrientImage: true,
    autoOrientImageQuality: null,
    maxInputBytes: 50000000,
    maxInputPixels: 50000000,
    imageLoadTimeoutMs: 30000,
    maxHistorySize: 50,
    exportMultiplier: 1,
    maxExportPixels: 50000000,
    maxExportDimension: 16384,
    exportAreaByDefault: 'image',
    mergeMasksByDefault: true,
    mergeAnnotationsByDefault: true,
    defaultMaskWidth: 50,
    defaultMaskHeight: 80,
    defaultMaskConfig: EMPTY_DEFAULT_MASK_CONFIG,
    maskRotatable: false,
    maskLabelOnSelect: true,
    maskLabelOffset: 3,
    maskName: 'mask',
    textAnnotationName: 'text',
    drawAnnotationName: 'draw',
    shapeAnnotationName: 'shape',
    maskListOrder: DEFAULT_OVERLAY_LIST_ORDER,
    annotationListOrder: DEFAULT_OVERLAY_LIST_ORDER,
    groupSelection: false,
    showPlaceholder: true,
    initialImageBase64: null,
    defaultDownloadFileName: 'edited_image',
    onImageLoadStart: null,
    onImageLoaded: null,
    onImageCleared: null,
    onImageChanged: null,
    onBusyChange: null,
    onToolModeChange: null,
    onHistoryChange: null,
    onEditorDisposed: null,
    onMasksChanged: null,
    onAnnotationsChanged: null,
    onSelectionChange: null,
    onError: null,
    onWarning: null,
};
const DEFAULT_LABEL_TEXT_OPTIONS = {
    fontSize: 12,
    fill: '#fff',
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 2,
    fontFamily: 'monospace',
    fontWeight: 'bold',
    selectable: false,
    evented: false,
    originX: 'left',
    originY: 'top',
};
const DEFAULT_LABEL = {
    getText: (mask) => mask.maskName};
const DEFAULT_CROP = {
    aspectRatio: 'free',
    minWidth: 100,
    minHeight: 100,
    padding: 10,
    hideMasksDuringCrop: true,
    preserveMasksAfterCrop: false,
    allowRotationOfCropRect: false,
    exportFileType: 'source'};
const DEFAULT_MOSAIC_CONFIG = Object.freeze({
    brushSize: 48,
    blockSize: 8,
    previewStroke: '#333',
    previewStrokeWidth: 1,
    previewStrokeDashArray: Object.freeze([4, 4]),
    previewFill: 'rgba(0,0,0,0)',
    outputFileType: 'source',
    outputQuality: undefined,
});
const DEFAULT_TEXT_ANNOTATION_CONFIG = Object.freeze({
    text: 'Text',
    left: undefined,
    top: undefined,
    width: 200,
    fontSize: 32,
    fontFamily: 'sans-serif',
    fontWeight: 'normal',
    fill: '#ff0000',
    backgroundColor: 'rgba(255,255,255,0)',
    textAlign: 'left',
    angle: 0,
    selectable: true,
    evented: true,
    editable: true,
    enterEditing: true,
    annotationHidden: false,
    annotationLocked: false,
    styles: Object.freeze({}),
});
const DEFAULT_DRAW_CONFIG = Object.freeze({
    brushSize: 8,
    color: '#ff0000',
    opacity: 1,
    lineCap: 'round',
    lineJoin: 'round',
    selectable: true,
    evented: true,
    annotationHidden: false,
    annotationLocked: false,
});
const DEFAULT_ERASER_CONFIG = Object.freeze({
    brushSize: 18,
    target: 'drawAnnotations',
    previewStroke: '#111',
    previewStrokeWidth: 1,
    previewFill: 'rgba(255,255,255,0.28)',
});
const DEFAULT_SHAPE_ANNOTATION_CONFIG = Object.freeze({
    shape: 'rect',
    left: undefined,
    top: undefined,
    width: 120,
    height: 80,
    x1: undefined,
    y1: undefined,
    x2: undefined,
    y2: undefined,
    stroke: '#ff0000',
    strokeWidth: 3,
    fill: 'rgba(255,0,0,0.08)',
    opacity: 1,
    angle: 0,
    selectable: true,
    evented: true,
    annotationHidden: false,
    annotationLocked: false,
    strokeDashArray: null,
    arrowHeadLength: 18,
    styles: Object.freeze({}),
});
const KNOWN_TOP_LEVEL_KEYS = new Set([
    'canvasWidth',
    'canvasHeight',
    'backgroundColor',
    'animationDuration',
    'minScale',
    'maxScale',
    'scaleStep',
    'rotationStep',
    'bindMasksToImageTransform',
    'bindAnnotationsToImageTransform',
    'textAnnotationFlipBehavior',
    'defaultLayoutMode',
    'downsampleOnLoad',
    'downsampleMaxWidth',
    'downsampleMaxHeight',
    'downsampleQuality',
    'preserveSourceFormat',
    'downsampleMimeType',
    'autoOrientImage',
    'autoOrientImageQuality',
    'maxInputBytes',
    'maxInputPixels',
    'imageLoadTimeoutMs',
    'maxHistorySize',
    'exportMultiplier',
    'maxExportPixels',
    'maxExportDimension',
    'exportAreaByDefault',
    'mergeMasksByDefault',
    'mergeAnnotationsByDefault',
    'defaultMaskWidth',
    'defaultMaskHeight',
    'defaultMaskConfig',
    'maskRotatable',
    'maskLabelOnSelect',
    'maskLabelOffset',
    'maskName',
    'textAnnotationName',
    'drawAnnotationName',
    'shapeAnnotationName',
    'maskListOrder',
    'annotationListOrder',
    'groupSelection',
    'showPlaceholder',
    'initialImageBase64',
    'defaultDownloadFileName',
    'onImageLoadStart',
    'onImageLoaded',
    'onImageCleared',
    'onImageChanged',
    'onBusyChange',
    'onToolModeChange',
    'onHistoryChange',
    'onEditorDisposed',
    'onMasksChanged',
    'onAnnotationsChanged',
    'onSelectionChange',
    'onError',
    'onWarning',
    'label',
    'crop',
    'defaultMosaicConfig',
    'defaultTextConfig',
    'defaultDrawConfig',
    'defaultEraserConfig',
    'defaultShapeConfig',
]);
function normalizeCallback(value) {
    return typeof value === 'function' ? value : null;
}
function isLayoutMode(value) {
    return value === 'fit' || value === 'cover' || value === 'expand';
}
function normalizeLayoutMode(value) {
    return isLayoutMode(value) ? value : DEFAULT_LAYOUT_MODE;
}
function isConfigObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function canCopyObjectConfigKey(key) {
    return plugins_mask_index.canCopySafeObjectKey(key);
}
function copyDefaultMaskConfigValue(value) {
    if (Array.isArray(value)) {
        return Object.freeze(value.map((item) => copyDefaultMaskConfigValue(item)));
    }
    if (!isConfigObject(value))
        return value;
    const copy = Object.create(null);
    for (const [key, nestedValue] of Object.entries(value)) {
        if (!canCopyObjectConfigKey(key))
            continue;
        copy[key] = copyDefaultMaskConfigValue(nestedValue);
    }
    return Object.freeze(copy);
}
function normalizeDefaultMaskConfig(value) {
    if (!isConfigObject(value))
        return EMPTY_DEFAULT_MASK_CONFIG;
    const normalized = Object.create(null);
    for (const [key, optionValue] of Object.entries(value)) {
        if (!canCopyObjectConfigKey(key))
            continue;
        if (key === 'onCreate' || key === 'fabricGenerator' || key === 'styles')
            continue;
        normalized[key] = copyDefaultMaskConfigValue(optionValue);
    }
    const styles = value.styles;
    if (isConfigObject(styles)) {
        const copiedStyles = Object.create(null);
        for (const [key, styleValue] of Object.entries(styles)) {
            if (!canCopyObjectConfigKey(key))
                continue;
            copiedStyles[key] = copyDefaultMaskConfigValue(styleValue);
        }
        Object.freeze(copiedStyles);
        normalized.styles = copiedStyles;
    }
    Object.freeze(normalized);
    return normalized;
}
function normalizePositiveInteger(value, fallback) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0)
        return fallback;
    return Math.max(1, Math.floor(numeric));
}
function normalizePositiveFiniteNumber(value, fallback) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0)
        return fallback;
    return numeric;
}
function normalizeNonNegativeFiniteNumber(value, fallback) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0)
        return fallback;
    return numeric;
}
function normalizeFiniteNumber(value, fallback) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric))
        return fallback;
    return numeric;
}
function normalizeMaxHistorySize(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric))
        return DEFAULT_OPTIONS.maxHistorySize;
    return Math.max(1, Math.floor(numeric));
}
function normalizeQualityOption(value) {
    if (value == null)
        return DEFAULT_OPTIONS.downsampleQuality;
    const numeric = Number(value);
    if (!Number.isFinite(numeric))
        return DEFAULT_OPTIONS.downsampleQuality;
    return Math.max(0, Math.min(1, numeric));
}
function normalizeNullableQualityOption(value) {
    if (value == null)
        return null;
    const numeric = Number(value);
    if (!Number.isFinite(numeric))
        return null;
    return Math.max(0, Math.min(1, numeric));
}
function normalizeMaxExportPixels(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0)
        return DEFAULT_OPTIONS.maxExportPixels;
    return Math.max(1, Math.floor(numeric));
}
function normalizeMaxExportDimension(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0)
        return DEFAULT_OPTIONS.maxExportDimension;
    return Math.max(1, Math.floor(numeric));
}
function normalizeMaxInputBytes(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0)
        return DEFAULT_OPTIONS.maxInputBytes;
    return Math.max(1, Math.floor(numeric));
}
function normalizeMaxInputPixels(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0)
        return DEFAULT_OPTIONS.maxInputPixels;
    return Math.max(1, Math.floor(numeric));
}
function normalizeExportArea(value) {
    return value === 'canvas' || value === 'image' ? value : DEFAULT_OPTIONS.exportAreaByDefault;
}
function normalizeOverlayListOrder(value, fallback) {
    return value === 'front-to-back' || value === 'back-to-front' ? value : fallback;
}
function isImageMimeType(value) {
    return value === 'image/jpeg' || value === 'image/png' || value === 'image/webp';
}
function normalizeImageMimeTypeOption(value, fallback) {
    if (value === null)
        return null;
    return isImageMimeType(value) ? value : fallback;
}
function normalizeNullableString(value, fallback) {
    if (value === null)
        return null;
    return typeof value === 'string' ? value : fallback;
}
const CROP_ASPECT_RATIO_PRESETS$1 = new Set([
    'free',
    '1:1',
    '3:4',
    '4:3',
    '3:2',
    '2:3',
    '9:16',
    '16:9',
]);
function hasValidCropRatioParts(width, height) {
    return (typeof width === 'number' &&
        typeof height === 'number' &&
        Number.isFinite(width) &&
        Number.isFinite(height) &&
        width > 0 &&
        height > 0);
}
function normalizeCropAspectRatioOption(value) {
    if (value === undefined || value === null)
        return DEFAULT_CROP.aspectRatio;
    if (typeof value === 'number') {
        return Number.isFinite(value) && value > 0 ? value : DEFAULT_CROP.aspectRatio;
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (CROP_ASPECT_RATIO_PRESETS$1.has(trimmed))
            return trimmed;
        const parts = trimmed.split(':');
        if (parts.length === 2) {
            const width = Number(parts[0]);
            const height = Number(parts[1]);
            if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
                return trimmed;
            }
        }
        return DEFAULT_CROP.aspectRatio;
    }
    if (isConfigObject(value) && hasValidCropRatioParts(value.width, value.height)) {
        return { width: value.width, height: value.height };
    }
    return DEFAULT_CROP.aspectRatio;
}
function normalizeCropExportFileTypeOption(value) {
    if (value === undefined || value === null)
        return DEFAULT_CROP.exportFileType;
    if (value === 'source')
        return 'source';
    const normalized = typeof value === 'string' ? tryNormalizeImageFormat(value) : null;
    return normalized !== null && normalized !== void 0 ? normalized : DEFAULT_CROP.exportFileType;
}
function normalizeOptionalQuality(value) {
    if (value === undefined || value === null)
        return undefined;
    const numeric = Number(value);
    if (!Number.isFinite(numeric))
        return undefined;
    return Math.max(0, Math.min(1, numeric));
}
function hasOwn(object, key) {
    return Object.prototype.hasOwnProperty.call(object, key);
}
function isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
}
function normalizeMosaicPositiveNumber(value, fallback) {
    return isFiniteNumber(value) && value > 0 ? value : fallback;
}
function normalizeMosaicBlockSize(value, fallback) {
    return isFiniteNumber(value) && value > 0 ? Math.max(1, Math.floor(value)) : fallback;
}
function normalizeMosaicNonNegativeNumber(value, fallback) {
    return isFiniteNumber(value) && value >= 0 ? value : fallback;
}
function normalizeMosaicDashArray(value, fallback) {
    if (value === null)
        return null;
    if (Array.isArray(value) &&
        value.every((entry) => typeof entry === 'number' && Number.isFinite(entry) && entry >= 0)) {
        return [...value];
    }
    return fallback ? [...fallback] : null;
}
function normalizeMosaicOutputFileType(value, fallback) {
    var _a;
    if (value === 'source')
        return 'source';
    if (typeof value !== 'string')
        return fallback;
    return (_a = tryNormalizeImageFormat(value)) !== null && _a !== void 0 ? _a : fallback;
}
function normalizeMosaicOutputQuality(value, fallback) {
    if (value === undefined || value === null)
        return undefined;
    if (!isFiniteNumber(value))
        return fallback;
    return Math.max(0, Math.min(1, value));
}
function cloneResolvedMosaicConfig(config) {
    return {
        ...config,
        previewStrokeDashArray: config.previewStrokeDashArray
            ? [...config.previewStrokeDashArray]
            : null,
    };
}
function normalizeMosaicConfig(input, fallback) {
    if (!isConfigObject(input))
        return cloneResolvedMosaicConfig(fallback);
    return mergeMosaicConfigPatch(fallback, input);
}
function mergeMosaicConfigPatch(current, patch, fallback = current) {
    const raw = isConfigObject(patch) ? patch : {};
    const next = cloneResolvedMosaicConfig(current);
    if (hasOwn(raw, 'brushSize')) {
        next.brushSize = normalizeMosaicPositiveNumber(raw.brushSize, fallback.brushSize);
    }
    if (hasOwn(raw, 'blockSize')) {
        next.blockSize = normalizeMosaicBlockSize(raw.blockSize, fallback.blockSize);
    }
    if (hasOwn(raw, 'previewStroke')) {
        next.previewStroke =
            typeof raw.previewStroke === 'string' ? raw.previewStroke : fallback.previewStroke;
    }
    if (hasOwn(raw, 'previewStrokeWidth')) {
        next.previewStrokeWidth = normalizeMosaicNonNegativeNumber(raw.previewStrokeWidth, fallback.previewStrokeWidth);
    }
    if (hasOwn(raw, 'previewStrokeDashArray')) {
        next.previewStrokeDashArray = normalizeMosaicDashArray(raw.previewStrokeDashArray, fallback.previewStrokeDashArray);
    }
    if (hasOwn(raw, 'previewFill')) {
        next.previewFill =
            typeof raw.previewFill === 'string' ? raw.previewFill : fallback.previewFill;
    }
    if (hasOwn(raw, 'outputFileType')) {
        next.outputFileType = normalizeMosaicOutputFileType(raw.outputFileType, fallback.outputFileType);
    }
    if (hasOwn(raw, 'outputQuality')) {
        next.outputQuality = normalizeMosaicOutputQuality(raw.outputQuality, fallback.outputQuality);
    }
    return next;
}
function getInvalidMosaicConfigFields(input) {
    const raw = isConfigObject(input) ? input : {};
    const invalid = [];
    if (hasOwn(raw, 'brushSize') &&
        !(typeof raw.brushSize === 'number' && Number.isFinite(raw.brushSize) && raw.brushSize > 0)) {
        invalid.push('brushSize');
    }
    if (hasOwn(raw, 'blockSize') &&
        !(typeof raw.blockSize === 'number' && Number.isFinite(raw.blockSize) && raw.blockSize > 0)) {
        invalid.push('blockSize');
    }
    if (hasOwn(raw, 'previewStroke') && typeof raw.previewStroke !== 'string') {
        invalid.push('previewStroke');
    }
    if (hasOwn(raw, 'previewStrokeWidth') &&
        !(typeof raw.previewStrokeWidth === 'number' &&
            Number.isFinite(raw.previewStrokeWidth) &&
            raw.previewStrokeWidth >= 0)) {
        invalid.push('previewStrokeWidth');
    }
    if (hasOwn(raw, 'previewStrokeDashArray')) {
        const value = raw.previewStrokeDashArray;
        const valid = value === null ||
            (Array.isArray(value) &&
                value.every((entry) => typeof entry === 'number' && Number.isFinite(entry) && entry >= 0));
        if (!valid)
            invalid.push('previewStrokeDashArray');
    }
    if (hasOwn(raw, 'previewFill') && typeof raw.previewFill !== 'string') {
        invalid.push('previewFill');
    }
    if (hasOwn(raw, 'outputFileType')) {
        const value = raw.outputFileType;
        const valid = value === 'source' || (typeof value === 'string' && tryNormalizeImageFormat(value));
        if (!valid)
            invalid.push('outputFileType');
    }
    if (hasOwn(raw, 'outputQuality') &&
        raw.outputQuality !== undefined &&
        raw.outputQuality !== null &&
        !(typeof raw.outputQuality === 'number' && Number.isFinite(raw.outputQuality))) {
        invalid.push('outputQuality');
    }
    return invalid;
}
function areResolvedMosaicConfigsEqual(left, right) {
    const leftDash = left.previewStrokeDashArray;
    const rightDash = right.previewStrokeDashArray;
    const dashEqual = leftDash === rightDash ||
        (Array.isArray(leftDash) &&
            Array.isArray(rightDash) &&
            leftDash.length === rightDash.length &&
            leftDash.every((value, index) => value === rightDash[index]));
    return (left.brushSize === right.brushSize &&
        left.blockSize === right.blockSize &&
        left.previewStroke === right.previewStroke &&
        left.previewStrokeWidth === right.previewStrokeWidth &&
        dashEqual &&
        left.previewFill === right.previewFill &&
        left.outputFileType === right.outputFileType &&
        left.outputQuality === right.outputQuality);
}
function cloneResolvedTextAnnotationConfig(config) {
    return {
        ...config,
        styles: { ...config.styles },
    };
}
function cloneResolvedDrawConfig(config) {
    return { ...config };
}
function cloneResolvedEraserConfig(config) {
    return { ...config };
}
function cloneResolvedShapeAnnotationConfig(config) {
    return {
        ...config,
        strokeDashArray: config.strokeDashArray ? [...config.strokeDashArray] : null,
        styles: { ...config.styles },
    };
}
function normalizeTextAlign(value, fallback) {
    return value === 'left' || value === 'center' || value === 'right' || value === 'justify'
        ? value
        : fallback;
}
function normalizePositiveNumber(value, fallback) {
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}
function normalizeBoolean(value, fallback) {
    return typeof value === 'boolean' ? value : fallback;
}
function normalizeString(value, fallback) {
    return typeof value === 'string' ? value : fallback;
}
function normalizeTextLeftTop(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}
function normalizeTextboxStyles(value) {
    return plugins_mask_index.copySafeOwnProperties(value);
}
function normalizeFabricObjectStyles(value) {
    return plugins_mask_index.copySafeOwnProperties(value);
}
function mergeTextAnnotationConfigPatch(current, patch, fallback = current) {
    const raw = isConfigObject(patch) ? patch : {};
    const next = cloneResolvedTextAnnotationConfig(current);
    if (hasOwn(raw, 'text'))
        next.text = normalizeString(raw.text, fallback.text);
    if (hasOwn(raw, 'left'))
        next.left = normalizeTextLeftTop(raw.left);
    if (hasOwn(raw, 'top'))
        next.top = normalizeTextLeftTop(raw.top);
    if (hasOwn(raw, 'width'))
        next.width = normalizePositiveNumber(raw.width, fallback.width);
    if (hasOwn(raw, 'fontSize')) {
        next.fontSize = normalizePositiveNumber(raw.fontSize, fallback.fontSize);
    }
    if (hasOwn(raw, 'fontFamily')) {
        next.fontFamily = normalizeString(raw.fontFamily, fallback.fontFamily);
    }
    if (hasOwn(raw, 'fontWeight')) {
        next.fontWeight =
            typeof raw.fontWeight === 'string' || typeof raw.fontWeight === 'number'
                ? raw.fontWeight
                : fallback.fontWeight;
    }
    if (hasOwn(raw, 'fill'))
        next.fill = normalizeString(raw.fill, fallback.fill);
    if (hasOwn(raw, 'backgroundColor')) {
        next.backgroundColor = normalizeString(raw.backgroundColor, fallback.backgroundColor);
    }
    if (hasOwn(raw, 'textAlign'))
        next.textAlign = normalizeTextAlign(raw.textAlign, fallback.textAlign);
    if (hasOwn(raw, 'angle'))
        next.angle = normalizeFiniteNumber(raw.angle, fallback.angle);
    if (hasOwn(raw, 'selectable'))
        next.selectable = normalizeBoolean(raw.selectable, fallback.selectable);
    if (hasOwn(raw, 'evented'))
        next.evented = normalizeBoolean(raw.evented, fallback.evented);
    if (hasOwn(raw, 'editable'))
        next.editable = normalizeBoolean(raw.editable, fallback.editable);
    if (hasOwn(raw, 'enterEditing')) {
        next.enterEditing = normalizeBoolean(raw.enterEditing, fallback.enterEditing);
    }
    if (hasOwn(raw, 'annotationHidden')) {
        next.annotationHidden = normalizeBoolean(raw.annotationHidden, fallback.annotationHidden);
    }
    if (hasOwn(raw, 'annotationLocked')) {
        next.annotationLocked = normalizeBoolean(raw.annotationLocked, fallback.annotationLocked);
    }
    if (hasOwn(raw, 'styles')) {
        next.styles = {
            ...next.styles,
            ...normalizeTextboxStyles(raw.styles),
        };
    }
    return next;
}
function normalizeTextAnnotationConfig(input, fallback) {
    if (!isConfigObject(input))
        return cloneResolvedTextAnnotationConfig(fallback);
    return mergeTextAnnotationConfigPatch(fallback, input);
}
function normalizeLineCap(value, fallback) {
    return value === 'butt' || value === 'round' || value === 'square' ? value : fallback;
}
function normalizeLineJoin(value, fallback) {
    return value === 'bevel' || value === 'round' || value === 'miter' ? value : fallback;
}
function normalizeOpacity(value, fallback) {
    if (typeof value !== 'number' || !Number.isFinite(value))
        return fallback;
    return Math.max(0, Math.min(1, value));
}
function mergeDrawConfigPatch(current, patch, fallback = current) {
    const raw = isConfigObject(patch) ? patch : {};
    const next = cloneResolvedDrawConfig(current);
    if (hasOwn(raw, 'brushSize')) {
        next.brushSize = normalizePositiveNumber(raw.brushSize, fallback.brushSize);
    }
    if (hasOwn(raw, 'color'))
        next.color = normalizeString(raw.color, fallback.color);
    if (hasOwn(raw, 'opacity'))
        next.opacity = normalizeOpacity(raw.opacity, fallback.opacity);
    if (hasOwn(raw, 'lineCap'))
        next.lineCap = normalizeLineCap(raw.lineCap, fallback.lineCap);
    if (hasOwn(raw, 'lineJoin'))
        next.lineJoin = normalizeLineJoin(raw.lineJoin, fallback.lineJoin);
    if (hasOwn(raw, 'selectable'))
        next.selectable = normalizeBoolean(raw.selectable, fallback.selectable);
    if (hasOwn(raw, 'evented'))
        next.evented = normalizeBoolean(raw.evented, fallback.evented);
    if (hasOwn(raw, 'annotationHidden')) {
        next.annotationHidden = normalizeBoolean(raw.annotationHidden, fallback.annotationHidden);
    }
    if (hasOwn(raw, 'annotationLocked')) {
        next.annotationLocked = normalizeBoolean(raw.annotationLocked, fallback.annotationLocked);
    }
    return next;
}
function normalizeDrawConfig(input, fallback) {
    if (!isConfigObject(input))
        return cloneResolvedDrawConfig(fallback);
    return mergeDrawConfigPatch(fallback, input);
}
function mergeEraserConfigPatch(current, patch, fallback = current) {
    const raw = isConfigObject(patch) ? patch : {};
    const next = cloneResolvedEraserConfig(current);
    if (hasOwn(raw, 'brushSize')) {
        next.brushSize = normalizePositiveNumber(raw.brushSize, fallback.brushSize);
    }
    if (hasOwn(raw, 'target')) {
        next.target = raw.target === 'drawAnnotations' ? 'drawAnnotations' : fallback.target;
    }
    if (hasOwn(raw, 'previewStroke')) {
        next.previewStroke = normalizeString(raw.previewStroke, fallback.previewStroke);
    }
    if (hasOwn(raw, 'previewStrokeWidth')) {
        next.previewStrokeWidth = normalizeMosaicNonNegativeNumber(raw.previewStrokeWidth, fallback.previewStrokeWidth);
    }
    if (hasOwn(raw, 'previewFill')) {
        next.previewFill = normalizeString(raw.previewFill, fallback.previewFill);
    }
    return next;
}
function normalizeEraserConfig(input, fallback) {
    if (!isConfigObject(input))
        return cloneResolvedEraserConfig(fallback);
    return mergeEraserConfigPatch(fallback, input);
}
function normalizeShapeKind(value, fallback) {
    return value === 'rect' || value === 'line' || value === 'arrow' ? value : fallback;
}
function normalizeNullableDashArray(value, fallback) {
    if (value === null)
        return null;
    if (Array.isArray(value) &&
        value.every((entry) => typeof entry === 'number' && Number.isFinite(entry) && entry >= 0)) {
        return [...value];
    }
    return fallback ? [...fallback] : null;
}
function mergeShapeAnnotationConfigPatch(current, patch, fallback = current) {
    const raw = isConfigObject(patch) ? patch : {};
    const next = cloneResolvedShapeAnnotationConfig(current);
    if (hasOwn(raw, 'shape'))
        next.shape = normalizeShapeKind(raw.shape, fallback.shape);
    if (hasOwn(raw, 'left'))
        next.left = normalizeTextLeftTop(raw.left);
    if (hasOwn(raw, 'top'))
        next.top = normalizeTextLeftTop(raw.top);
    if (hasOwn(raw, 'width'))
        next.width = normalizePositiveNumber(raw.width, fallback.width);
    if (hasOwn(raw, 'height'))
        next.height = normalizePositiveNumber(raw.height, fallback.height);
    if (hasOwn(raw, 'x1'))
        next.x1 = normalizeTextLeftTop(raw.x1);
    if (hasOwn(raw, 'y1'))
        next.y1 = normalizeTextLeftTop(raw.y1);
    if (hasOwn(raw, 'x2'))
        next.x2 = normalizeTextLeftTop(raw.x2);
    if (hasOwn(raw, 'y2'))
        next.y2 = normalizeTextLeftTop(raw.y2);
    if (hasOwn(raw, 'stroke'))
        next.stroke = normalizeString(raw.stroke, fallback.stroke);
    if (hasOwn(raw, 'strokeWidth')) {
        next.strokeWidth = normalizePositiveNumber(raw.strokeWidth, fallback.strokeWidth);
    }
    if (hasOwn(raw, 'fill'))
        next.fill = normalizeString(raw.fill, fallback.fill);
    if (hasOwn(raw, 'opacity'))
        next.opacity = normalizeOpacity(raw.opacity, fallback.opacity);
    if (hasOwn(raw, 'angle'))
        next.angle = normalizeFiniteNumber(raw.angle, fallback.angle);
    if (hasOwn(raw, 'selectable')) {
        next.selectable = normalizeBoolean(raw.selectable, fallback.selectable);
    }
    if (hasOwn(raw, 'evented'))
        next.evented = normalizeBoolean(raw.evented, fallback.evented);
    if (hasOwn(raw, 'annotationHidden')) {
        next.annotationHidden = normalizeBoolean(raw.annotationHidden, fallback.annotationHidden);
    }
    if (hasOwn(raw, 'annotationLocked')) {
        next.annotationLocked = normalizeBoolean(raw.annotationLocked, fallback.annotationLocked);
    }
    if (hasOwn(raw, 'strokeDashArray')) {
        next.strokeDashArray = normalizeNullableDashArray(raw.strokeDashArray, fallback.strokeDashArray);
    }
    if (hasOwn(raw, 'arrowHeadLength')) {
        next.arrowHeadLength = normalizePositiveNumber(raw.arrowHeadLength, fallback.arrowHeadLength);
    }
    if (hasOwn(raw, 'styles')) {
        next.styles = {
            ...next.styles,
            ...normalizeFabricObjectStyles(raw.styles),
        };
    }
    return next;
}
function normalizeShapeAnnotationConfig(input, fallback) {
    if (!isConfigObject(input))
        return cloneResolvedShapeAnnotationConfig(fallback);
    return mergeShapeAnnotationConfigPatch(fallback, input);
}
function areResolvedTextAnnotationConfigsEqual(left, right) {
    return (left.text === right.text &&
        left.left === right.left &&
        left.top === right.top &&
        left.width === right.width &&
        left.fontSize === right.fontSize &&
        left.fontFamily === right.fontFamily &&
        left.fontWeight === right.fontWeight &&
        left.fill === right.fill &&
        left.backgroundColor === right.backgroundColor &&
        left.textAlign === right.textAlign &&
        left.angle === right.angle &&
        left.selectable === right.selectable &&
        left.evented === right.evented &&
        left.editable === right.editable &&
        left.enterEditing === right.enterEditing &&
        left.annotationHidden === right.annotationHidden &&
        left.annotationLocked === right.annotationLocked &&
        areStyleRecordsEqual(left.styles, right.styles));
}
function areStyleRecordsEqual(left, right) {
    return areStyleValuesEqual(left, right, new WeakMap());
}
function areStyleValuesEqual(left, right, seen) {
    if (Object.is(left, right))
        return true;
    if (!left || !right || typeof left !== 'object' || typeof right !== 'object')
        return false;
    let seenRights = seen.get(left);
    if (seenRights === null || seenRights === void 0 ? void 0 : seenRights.has(right))
        return true;
    if (!seenRights) {
        seenRights = new WeakSet();
        seen.set(left, seenRights);
    }
    seenRights.add(right);
    if (Array.isArray(left) || Array.isArray(right)) {
        return (Array.isArray(left) &&
            Array.isArray(right) &&
            left.length === right.length &&
            left.every((value, index) => areStyleValuesEqual(value, right[index], seen)));
    }
    const leftRecord = left;
    const rightRecord = right;
    const leftKeys = Object.keys(leftRecord);
    const rightKeys = Object.keys(rightRecord);
    if (leftKeys.length !== rightKeys.length)
        return false;
    return leftKeys.every((key) => {
        if (!hasOwn(rightRecord, key))
            return false;
        return areStyleValuesEqual(leftRecord[key], rightRecord[key], seen);
    });
}
function areResolvedDrawConfigsEqual(left, right) {
    return (left.brushSize === right.brushSize &&
        left.color === right.color &&
        left.opacity === right.opacity &&
        left.lineCap === right.lineCap &&
        left.lineJoin === right.lineJoin &&
        left.selectable === right.selectable &&
        left.evented === right.evented &&
        left.annotationHidden === right.annotationHidden &&
        left.annotationLocked === right.annotationLocked);
}
function areResolvedEraserConfigsEqual(left, right) {
    return (left.brushSize === right.brushSize &&
        left.target === right.target &&
        left.previewStroke === right.previewStroke &&
        left.previewStrokeWidth === right.previewStrokeWidth &&
        left.previewFill === right.previewFill);
}
function areResolvedShapeAnnotationConfigsEqual(left, right) {
    const leftDash = left.strokeDashArray;
    const rightDash = right.strokeDashArray;
    const dashEqual = leftDash === rightDash ||
        (Array.isArray(leftDash) &&
            Array.isArray(rightDash) &&
            leftDash.length === rightDash.length &&
            leftDash.every((value, index) => value === rightDash[index]));
    return (left.shape === right.shape &&
        left.left === right.left &&
        left.top === right.top &&
        left.width === right.width &&
        left.height === right.height &&
        left.x1 === right.x1 &&
        left.y1 === right.y1 &&
        left.x2 === right.x2 &&
        left.y2 === right.y2 &&
        left.stroke === right.stroke &&
        left.strokeWidth === right.strokeWidth &&
        left.fill === right.fill &&
        left.opacity === right.opacity &&
        left.angle === right.angle &&
        left.selectable === right.selectable &&
        left.evented === right.evented &&
        left.annotationHidden === right.annotationHidden &&
        left.annotationLocked === right.annotationLocked &&
        dashEqual &&
        left.arrowHeadLength === right.arrowHeadLength &&
        areStyleRecordsEqual(left.styles, right.styles));
}
function getInvalidTextAnnotationConfigFields(input) {
    const raw = isConfigObject(input) ? input : {};
    const invalid = [];
    if (hasOwn(raw, 'text') && typeof raw.text !== 'string')
        invalid.push('text');
    if (hasOwn(raw, 'width') && !isFiniteNumber(raw.width))
        invalid.push('width');
    if (hasOwn(raw, 'fontSize') && !isFiniteNumber(raw.fontSize))
        invalid.push('fontSize');
    if (hasOwn(raw, 'fontFamily') && typeof raw.fontFamily !== 'string')
        invalid.push('fontFamily');
    if (hasOwn(raw, 'fill') && typeof raw.fill !== 'string') {
        invalid.push('fill');
    }
    return invalid;
}
function getInvalidDrawConfigFields(input) {
    const raw = isConfigObject(input) ? input : {};
    const invalid = [];
    if (hasOwn(raw, 'brushSize') && !isFiniteNumber(raw.brushSize))
        invalid.push('brushSize');
    if (hasOwn(raw, 'color') && typeof raw.color !== 'string')
        invalid.push('color');
    if (hasOwn(raw, 'opacity') && !isFiniteNumber(raw.opacity))
        invalid.push('opacity');
    return invalid;
}
function getInvalidEraserConfigFields(input) {
    const raw = isConfigObject(input) ? input : {};
    const invalid = [];
    if (hasOwn(raw, 'brushSize') && !isFiniteNumber(raw.brushSize))
        invalid.push('brushSize');
    if (hasOwn(raw, 'target') && raw.target !== 'drawAnnotations')
        invalid.push('target');
    if (hasOwn(raw, 'previewStroke') && typeof raw.previewStroke !== 'string') {
        invalid.push('previewStroke');
    }
    if (hasOwn(raw, 'previewStrokeWidth') && !isFiniteNumber(raw.previewStrokeWidth)) {
        invalid.push('previewStrokeWidth');
    }
    if (hasOwn(raw, 'previewFill') && typeof raw.previewFill !== 'string') {
        invalid.push('previewFill');
    }
    return invalid;
}
function getInvalidShapeAnnotationConfigFields(input) {
    const raw = isConfigObject(input) ? input : {};
    const invalid = [];
    if (hasOwn(raw, 'shape') &&
        raw.shape !== 'rect' &&
        raw.shape !== 'line' &&
        raw.shape !== 'arrow') {
        invalid.push('shape');
    }
    if (hasOwn(raw, 'width') && !isFiniteNumber(raw.width))
        invalid.push('width');
    if (hasOwn(raw, 'height') && !isFiniteNumber(raw.height))
        invalid.push('height');
    if (hasOwn(raw, 'stroke') && typeof raw.stroke !== 'string')
        invalid.push('stroke');
    if (hasOwn(raw, 'strokeWidth') && !isFiniteNumber(raw.strokeWidth)) {
        invalid.push('strokeWidth');
    }
    if (hasOwn(raw, 'fill') && typeof raw.fill !== 'string')
        invalid.push('fill');
    if (hasOwn(raw, 'opacity') && !isFiniteNumber(raw.opacity))
        invalid.push('opacity');
    if (hasOwn(raw, 'arrowHeadLength') && !isFiniteNumber(raw.arrowHeadLength)) {
        invalid.push('arrowHeadLength');
    }
    if (hasOwn(raw, 'strokeDashArray')) {
        const value = raw.strokeDashArray;
        const valid = value === null ||
            (Array.isArray(value) &&
                value.every((entry) => typeof entry === 'number' && Number.isFinite(entry) && entry >= 0));
        if (!valid)
            invalid.push('strokeDashArray');
    }
    return invalid;
}
function resolveOptions(input) {
    const raw = input !== null && input !== void 0 ? input : {};
    const resolved = { ...DEFAULT_OPTIONS };
    for (const key of Object.keys(raw)) {
        if (!KNOWN_TOP_LEVEL_KEYS.has(key))
            continue;
        if (key === 'label' ||
            key === 'crop' ||
            key === 'defaultMosaicConfig' ||
            key === 'defaultTextConfig' ||
            key === 'defaultDrawConfig' ||
            key === 'defaultEraserConfig' ||
            key === 'defaultShapeConfig') {
            continue;
        }
        if (key === 'onImageLoadStart' ||
            key === 'onImageLoaded' ||
            key === 'onImageCleared' ||
            key === 'onImageChanged' ||
            key === 'onBusyChange' ||
            key === 'onToolModeChange' ||
            key === 'onHistoryChange' ||
            key === 'onEditorDisposed' ||
            key === 'onMasksChanged' ||
            key === 'onAnnotationsChanged' ||
            key === 'onSelectionChange' ||
            key === 'onError' ||
            key === 'onWarning') {
            continue;
        }
        const value = raw[key];
        if (value === undefined)
            continue;
        if (key === 'backgroundColor') {
            resolved.backgroundColor = normalizeString(value, DEFAULT_OPTIONS.backgroundColor);
            continue;
        }
        if (key === 'bindMasksToImageTransform') {
            resolved.bindMasksToImageTransform = normalizeBoolean(value, DEFAULT_OPTIONS.bindMasksToImageTransform);
            continue;
        }
        if (key === 'bindAnnotationsToImageTransform') {
            resolved.bindAnnotationsToImageTransform = normalizeBoolean(value, DEFAULT_OPTIONS.bindAnnotationsToImageTransform);
            continue;
        }
        if (key === 'textAnnotationFlipBehavior') {
            resolved.textAnnotationFlipBehavior =
                value === 'mirror' ? 'mirror' : 'preserve-readable';
            continue;
        }
        if (key === 'downsampleOnLoad') {
            resolved.downsampleOnLoad = normalizeBoolean(value, DEFAULT_OPTIONS.downsampleOnLoad);
            continue;
        }
        if (key === 'preserveSourceFormat') {
            resolved.preserveSourceFormat = normalizeBoolean(value, DEFAULT_OPTIONS.preserveSourceFormat);
            continue;
        }
        if (key === 'downsampleMimeType') {
            resolved.downsampleMimeType = normalizeImageMimeTypeOption(value, DEFAULT_OPTIONS.downsampleMimeType);
            continue;
        }
        if (key === 'autoOrientImage') {
            resolved.autoOrientImage = normalizeBoolean(value, DEFAULT_OPTIONS.autoOrientImage);
            continue;
        }
        if (key === 'autoOrientImageQuality') {
            resolved.autoOrientImageQuality = normalizeNullableQualityOption(value);
            continue;
        }
        if (key === 'maxInputBytes') {
            resolved.maxInputBytes = normalizeMaxInputBytes(value);
            continue;
        }
        if (key === 'maxInputPixels') {
            resolved.maxInputPixels = normalizeMaxInputPixels(value);
            continue;
        }
        if (key === 'mergeMasksByDefault') {
            resolved.mergeMasksByDefault = normalizeBoolean(value, DEFAULT_OPTIONS.mergeMasksByDefault);
            continue;
        }
        if (key === 'mergeAnnotationsByDefault') {
            resolved.mergeAnnotationsByDefault = normalizeBoolean(value, DEFAULT_OPTIONS.mergeAnnotationsByDefault);
            continue;
        }
        if (key === 'maskRotatable') {
            resolved.maskRotatable = normalizeBoolean(value, DEFAULT_OPTIONS.maskRotatable);
            continue;
        }
        if (key === 'maskLabelOnSelect') {
            resolved.maskLabelOnSelect = normalizeBoolean(value, DEFAULT_OPTIONS.maskLabelOnSelect);
            continue;
        }
        if (key === 'maskName') {
            resolved.maskName = normalizeString(value, DEFAULT_OPTIONS.maskName);
            continue;
        }
        if (key === 'textAnnotationName') {
            resolved.textAnnotationName = normalizeString(value, DEFAULT_OPTIONS.textAnnotationName);
            continue;
        }
        if (key === 'drawAnnotationName') {
            resolved.drawAnnotationName = normalizeString(value, DEFAULT_OPTIONS.drawAnnotationName);
            continue;
        }
        if (key === 'shapeAnnotationName') {
            resolved.shapeAnnotationName = normalizeString(value, DEFAULT_OPTIONS.shapeAnnotationName);
            continue;
        }
        if (key === 'groupSelection') {
            resolved.groupSelection = normalizeBoolean(value, DEFAULT_OPTIONS.groupSelection);
            continue;
        }
        if (key === 'showPlaceholder') {
            resolved.showPlaceholder = normalizeBoolean(value, DEFAULT_OPTIONS.showPlaceholder);
            continue;
        }
        if (key === 'initialImageBase64') {
            resolved.initialImageBase64 = normalizeNullableString(value, DEFAULT_OPTIONS.initialImageBase64);
            continue;
        }
        if (key === 'defaultDownloadFileName') {
            resolved.defaultDownloadFileName = normalizeString(value, DEFAULT_OPTIONS.defaultDownloadFileName);
            continue;
        }
        if (key === 'downsampleQuality') {
            resolved.downsampleQuality = normalizeQualityOption(value);
            continue;
        }
        if (key === 'maxExportPixels') {
            resolved.maxExportPixels = normalizeMaxExportPixels(value);
            continue;
        }
        if (key === 'maxExportDimension') {
            resolved.maxExportDimension = normalizeMaxExportDimension(value);
            continue;
        }
        if (key === 'exportAreaByDefault') {
            resolved.exportAreaByDefault = normalizeExportArea(value);
            continue;
        }
        if (key === 'maskListOrder') {
            resolved.maskListOrder = normalizeOverlayListOrder(value, DEFAULT_OPTIONS.maskListOrder);
            continue;
        }
        if (key === 'annotationListOrder') {
            resolved.annotationListOrder = normalizeOverlayListOrder(value, DEFAULT_OPTIONS.annotationListOrder);
            continue;
        }
        if (key === 'defaultLayoutMode') {
            const layoutMode = normalizeLayoutMode(value);
            resolved.defaultLayoutMode = layoutMode;
            resolved.layoutMode = layoutMode;
            continue;
        }
        if (key === 'canvasWidth') {
            resolved.canvasWidth = normalizePositiveInteger(value, DEFAULT_OPTIONS.canvasWidth);
            continue;
        }
        if (key === 'canvasHeight') {
            resolved.canvasHeight = normalizePositiveInteger(value, DEFAULT_OPTIONS.canvasHeight);
            continue;
        }
        if (key === 'animationDuration') {
            resolved.animationDuration = normalizeNonNegativeFiniteNumber(value, DEFAULT_OPTIONS.animationDuration);
            continue;
        }
        if (key === 'minScale') {
            resolved.minScale = normalizePositiveFiniteNumber(value, DEFAULT_OPTIONS.minScale);
            continue;
        }
        if (key === 'maxScale') {
            resolved.maxScale = normalizePositiveFiniteNumber(value, DEFAULT_OPTIONS.maxScale);
            continue;
        }
        if (key === 'scaleStep') {
            resolved.scaleStep = normalizePositiveFiniteNumber(value, DEFAULT_OPTIONS.scaleStep);
            continue;
        }
        if (key === 'rotationStep') {
            resolved.rotationStep = normalizeFiniteNumber(value, DEFAULT_OPTIONS.rotationStep);
            continue;
        }
        if (key === 'downsampleMaxWidth') {
            resolved.downsampleMaxWidth = normalizePositiveInteger(value, DEFAULT_OPTIONS.downsampleMaxWidth);
            continue;
        }
        if (key === 'downsampleMaxHeight') {
            resolved.downsampleMaxHeight = normalizePositiveInteger(value, DEFAULT_OPTIONS.downsampleMaxHeight);
            continue;
        }
        if (key === 'imageLoadTimeoutMs') {
            resolved.imageLoadTimeoutMs = normalizePositiveInteger(value, DEFAULT_OPTIONS.imageLoadTimeoutMs);
            continue;
        }
        if (key === 'exportMultiplier') {
            resolved.exportMultiplier = normalizePositiveFiniteNumber(value, DEFAULT_OPTIONS.exportMultiplier);
            continue;
        }
        if (key === 'defaultMaskWidth') {
            resolved.defaultMaskWidth = normalizePositiveFiniteNumber(value, DEFAULT_OPTIONS.defaultMaskWidth);
            continue;
        }
        if (key === 'defaultMaskHeight') {
            resolved.defaultMaskHeight = normalizePositiveFiniteNumber(value, DEFAULT_OPTIONS.defaultMaskHeight);
            continue;
        }
        if (key === 'defaultMaskConfig') {
            resolved.defaultMaskConfig = normalizeDefaultMaskConfig(value);
            continue;
        }
        if (key === 'maskLabelOffset') {
            resolved.maskLabelOffset = normalizeNonNegativeFiniteNumber(value, DEFAULT_OPTIONS.maskLabelOffset);
            continue;
        }
        resolved[key] = value;
    }
    resolved.onImageLoadStart = normalizeCallback(raw.onImageLoadStart);
    resolved.onImageLoaded = normalizeCallback(raw.onImageLoaded);
    resolved.onImageCleared = normalizeCallback(raw.onImageCleared);
    resolved.onImageChanged = normalizeCallback(raw.onImageChanged);
    resolved.onBusyChange = normalizeCallback(raw.onBusyChange);
    resolved.onToolModeChange = normalizeCallback(raw.onToolModeChange);
    resolved.onHistoryChange = normalizeCallback(raw.onHistoryChange);
    resolved.onEditorDisposed = normalizeCallback(raw.onEditorDisposed);
    resolved.onMasksChanged = normalizeCallback(raw.onMasksChanged);
    resolved.onAnnotationsChanged = normalizeCallback(raw.onAnnotationsChanged);
    resolved.onSelectionChange = normalizeCallback(raw.onSelectionChange);
    resolved.onError = normalizeCallback(raw.onError);
    resolved.onWarning = normalizeCallback(raw.onWarning);
    resolved.maxHistorySize = normalizeMaxHistorySize(resolved.maxHistorySize);
    if (resolved.minScale > resolved.maxScale) {
        const minScale = resolved.minScale;
        resolved.minScale = resolved.maxScale;
        resolved.maxScale = minScale;
    }
    const userLabel = raw.label && typeof raw.label === 'object' ? raw.label : {};
    const mergedTextOptions = {
        ...DEFAULT_LABEL_TEXT_OPTIONS,
        ...(userLabel.textOptions && typeof userLabel.textOptions === 'object'
            ? userLabel.textOptions
            : {}),
    };
    const label = {
        getText: typeof userLabel.getText === 'function' ? userLabel.getText : DEFAULT_LABEL.getText,
        textOptions: mergedTextOptions,
    };
    if (typeof userLabel.create === 'function') {
        label.create = userLabel.create;
    }
    Object.freeze(label.textOptions);
    Object.freeze(label);
    const userCrop = raw.crop && typeof raw.crop === 'object' ? raw.crop : {};
    const crop = {
        aspectRatio: normalizeCropAspectRatioOption(userCrop.aspectRatio),
        minWidth: normalizePositiveFiniteNumber(userCrop.minWidth, DEFAULT_CROP.minWidth),
        minHeight: normalizePositiveFiniteNumber(userCrop.minHeight, DEFAULT_CROP.minHeight),
        padding: normalizeNonNegativeFiniteNumber(userCrop.padding, DEFAULT_CROP.padding),
        hideMasksDuringCrop: normalizeBoolean(userCrop.hideMasksDuringCrop, DEFAULT_CROP.hideMasksDuringCrop),
        preserveMasksAfterCrop: normalizeBoolean(userCrop.preserveMasksAfterCrop, DEFAULT_CROP.preserveMasksAfterCrop),
        allowRotationOfCropRect: normalizeBoolean(userCrop.allowRotationOfCropRect, DEFAULT_CROP.allowRotationOfCropRect),
        exportFileType: normalizeCropExportFileTypeOption(userCrop.exportFileType),
        exportQuality: normalizeOptionalQuality(userCrop.exportQuality),
    };
    Object.freeze(crop);
    const defaultMosaicConfig = normalizeMosaicConfig(raw.defaultMosaicConfig, DEFAULT_MOSAIC_CONFIG);
    if (defaultMosaicConfig.previewStrokeDashArray) {
        Object.freeze(defaultMosaicConfig.previewStrokeDashArray);
    }
    Object.freeze(defaultMosaicConfig);
    const defaultTextConfig = normalizeTextAnnotationConfig(raw.defaultTextConfig, DEFAULT_TEXT_ANNOTATION_CONFIG);
    Object.freeze(defaultTextConfig.styles);
    Object.freeze(defaultTextConfig);
    const defaultDrawConfig = normalizeDrawConfig(raw.defaultDrawConfig, DEFAULT_DRAW_CONFIG);
    Object.freeze(defaultDrawConfig);
    const defaultEraserConfig = normalizeEraserConfig(raw.defaultEraserConfig, DEFAULT_ERASER_CONFIG);
    Object.freeze(defaultEraserConfig);
    const defaultShapeConfig = normalizeShapeAnnotationConfig(raw.defaultShapeConfig, DEFAULT_SHAPE_ANNOTATION_CONFIG);
    Object.freeze(defaultShapeConfig.styles);
    Object.freeze(defaultShapeConfig);
    return Object.freeze({
        ...resolved,
        label,
        crop,
        defaultMosaicConfig,
        defaultTextConfig,
        defaultDrawConfig,
        defaultEraserConfig,
        defaultShapeConfig,
    });
}

function hasMeaningfulCanvasRegion(rect, canvasWidth, canvasHeight) {
    const left = Number(rect.left);
    const top = Number(rect.top);
    const width = Number(rect.width);
    const height = Number(rect.height);
    if (!Number.isFinite(left) ||
        !Number.isFinite(top) ||
        !Number.isFinite(width) ||
        !Number.isFinite(height) ||
        width <= 0 ||
        height <= 0) {
        return false;
    }
    const right = left + width;
    const bottom = top + height;
    if (!Number.isFinite(right) || !Number.isFinite(bottom))
        return false;
    const safeCanvasWidth = Number(canvasWidth);
    const safeCanvasHeight = Number(canvasHeight);
    if (!Number.isFinite(safeCanvasWidth) ||
        !Number.isFinite(safeCanvasHeight) ||
        safeCanvasWidth <= 0 ||
        safeCanvasHeight <= 0) {
        return true;
    }
    const overlapWidth = Math.min(right, safeCanvasWidth) - Math.max(left, 0);
    const overlapHeight = Math.min(bottom, safeCanvasHeight) - Math.max(top, 0);
    return overlapWidth > 0 && overlapHeight > 0;
}
function getClampedCanvasRegion(rect, canvasWidth, canvasHeight, options = {}) {
    const safeLeft = Number.isFinite(rect.left) ? rect.left : 0;
    const safeTop = Number.isFinite(rect.top) ? rect.top : 0;
    const safeWidth = Math.max(0, Number.isFinite(rect.width) ? rect.width : 0);
    const safeHeight = Math.max(0, Number.isFinite(rect.height) ? rect.height : 0);
    const includePartialPixels = options.includePartialPixels !== false;
    const roundEnd = includePartialPixels ? Math.ceil : Math.floor;
    const hasCanvasWidth = Number.isFinite(canvasWidth);
    const hasCanvasHeight = Number.isFinite(canvasHeight);
    const safeCanvasWidth = hasCanvasWidth
        ? Math.max(1, Math.round(Number(canvasWidth)))
        : Number.POSITIVE_INFINITY;
    const safeCanvasHeight = hasCanvasHeight
        ? Math.max(1, Math.round(Number(canvasHeight)))
        : Number.POSITIVE_INFINITY;
    const left = Math.min(safeCanvasWidth - 1, Math.max(0, Math.floor(safeLeft)));
    const top = Math.min(safeCanvasHeight - 1, Math.max(0, Math.floor(safeTop)));
    const right = Math.min(safeCanvasWidth, Math.max(left + 1, roundEnd(safeLeft + safeWidth)));
    const bottom = Math.min(safeCanvasHeight, Math.max(top + 1, roundEnd(safeTop + safeHeight)));
    return {
        left,
        top,
        width: Math.max(1, right - left),
        height: Math.max(1, bottom - top),
    };
}
function hasFractionalCanvasEdge(value) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue))
        return false;
    return Math.abs(numericValue - Math.round(numericValue)) > 0.01;
}
function getPartialExportEdges(bounds, angle = 0) {
    if (!bounds)
        return null;
    const normalizedAngle = Math.abs((Number(angle) || 0) % 90);
    const isAxisAligned = normalizedAngle < 0.01 || Math.abs(normalizedAngle - 90) < 0.01;
    if (!isAxisAligned)
        return null;
    const left = Number(bounds.left) || 0;
    const top = Number(bounds.top) || 0;
    return {
        left: hasFractionalCanvasEdge(left),
        top: hasFractionalCanvasEdge(top),
        right: hasFractionalCanvasEdge(left + (Number(bounds.width) || 0)),
        bottom: hasFractionalCanvasEdge(top + (Number(bounds.height) || 0)),
    };
}
function getObjectBBox(object) {
    object.setCoords();
    const boundingRect = object.getBoundingRect();
    return {
        left: boundingRect.left,
        top: boundingRect.top,
        width: boundingRect.width,
        height: boundingRect.height,
    };
}

function isFinitePoint(value) {
    const point = value;
    return (!!point &&
        typeof point.x === 'number' &&
        Number.isFinite(point.x) &&
        typeof point.y === 'number' &&
        Number.isFinite(point.y));
}
function getPointerFromFabricEvent(canvas, event) {
    const fabricEvent = event && typeof event === 'object'
        ? event
        : null;
    if (!fabricEvent)
        return null;
    if (isFinitePoint(fabricEvent.scenePoint))
        return { ...fabricEvent.scenePoint };
    if (isFinitePoint(fabricEvent.pointer))
        return { ...fabricEvent.pointer };
    if (isFinitePoint(fabricEvent.absolutePointer))
        return { ...fabricEvent.absolutePointer };
    if (fabricEvent.e && typeof canvas.getPointer === 'function') {
        const pointer = canvas.getPointer(fabricEvent.e);
        if (isFinitePoint(pointer))
            return { ...pointer };
    }
    return null;
}

function resolveDefaultTextPosition(context) {
    const image = context.getOriginalImage();
    if (image) {
        const bounds = getObjectBBox(image);
        return { left: Math.round(bounds.left + 10), top: Math.round(bounds.top + 10) };
    }
    return { left: 10, top: 10 };
}
function resolveTextCreationConfig(context, config) {
    var _a, _b;
    const base = mergeTextAnnotationConfigPatch(context.getTextConfig(), config);
    const fallback = resolveDefaultTextPosition(context);
    const leftInput = (_a = config.left) !== null && _a !== void 0 ? _a : base.left;
    const topInput = (_b = config.top) !== null && _b !== void 0 ? _b : base.top;
    return {
        ...base,
        left: plugins_mask_index.resolveNumeric(leftInput, 'x', fallback.left, context.canvas, context.options),
        top: plugins_mask_index.resolveNumeric(topInput, 'y', fallback.top, context.canvas, context.options),
    };
}
function nextAnnotationMeta(context, config) {
    const annotationId = context.getAnnotationCounter() + 1;
    context.setAnnotationCounter(annotationId);
    return {
        annotationId,
        annotationName: `${context.options.textAnnotationName}${annotationId}`,
        annotationHidden: config.annotationHidden,
        annotationLocked: config.annotationLocked,
    };
}
function attachTextEditingHandlers(context, annotation) {
    const textObject = annotation;
    if (textObject.imageEditorTextEditingHandlers) {
        try {
            textObject.off('editing:entered', textObject.imageEditorTextEditingHandlers.entered);
            textObject.off('editing:exited', textObject.imageEditorTextEditingHandlers.exited);
        }
        catch {
        }
    }
    const entered = () => {
        var _a;
        textObject.imageEditorTextEditingInitialText = String((_a = textObject.text) !== null && _a !== void 0 ? _a : '');
        textObject.imageEditorTextEditingCancel = false;
        delete textObject.imageEditorTextEditingHandledChange;
    };
    const exited = () => {
        var _a;
        const initial = textObject.imageEditorTextEditingInitialText;
        const finalText = String((_a = textObject.text) !== null && _a !== void 0 ? _a : '');
        const cancel = textObject.imageEditorTextEditingCancel === true;
        if (initial !== undefined) {
            textObject.imageEditorTextEditingHandledChange = true;
            queueMicrotask(() => {
                if (textObject.imageEditorTextEditingHandledChange === true) {
                    delete textObject.imageEditorTextEditingHandledChange;
                }
            });
        }
        if (cancel && initial !== undefined) {
            textObject.set({ text: initial });
        }
        delete textObject.imageEditorTextEditingInitialText;
        delete textObject.imageEditorTextEditingCancel;
        if (!cancel && initial !== undefined && initial !== finalText) {
            context.saveCanvasState();
            const callbackContext = context.buildCallbackContext('updateAnnotation');
            context.emitAnnotationsChanged(callbackContext);
            context.emitImageChanged(callbackContext);
        }
    };
    textObject.on('editing:entered', entered);
    textObject.on('editing:exited', exited);
    textObject.imageEditorTextEditingHandlers = { entered, exited };
}
function selectAllText(annotation) {
    var _a;
    const textObject = annotation;
    const textLength = String((_a = textObject.text) !== null && _a !== void 0 ? _a : '').length;
    if (textLength <= 0)
        return;
    if (typeof textObject.selectAll === 'function') {
        textObject.selectAll();
        return;
    }
    if (typeof textObject.setSelectionStart === 'function' &&
        typeof textObject.setSelectionEnd === 'function') {
        textObject.setSelectionStart(0);
        textObject.setSelectionEnd(textLength);
        return;
    }
    textObject.selectionStart = 0;
    textObject.selectionEnd = textLength;
}
function createTextAnnotation(context, config = {}) {
    var _a, _b;
    if (!context.isImageLoaded())
        return null;
    const resolved = resolveTextCreationConfig(context, config);
    const textbox = new context.fabric.Textbox(resolved.text, {
        left: resolved.left,
        top: resolved.top,
        width: resolved.width,
        fontSize: resolved.fontSize,
        fontFamily: resolved.fontFamily,
        fontWeight: resolved.fontWeight,
        fill: resolved.fill,
        backgroundColor: resolved.backgroundColor,
        textAlign: resolved.textAlign,
        angle: resolved.angle,
        selectable: resolved.selectable,
        evented: resolved.evented,
        editable: resolved.editable,
        originX: 'left',
        originY: 'top',
        ...resolved.styles,
    });
    const meta = nextAnnotationMeta(context, resolved);
    const annotation = plugins_mask_index.markAnnotationObject(textbox, {
        annotationId: meta.annotationId,
        annotationType: 'text',
        annotationName: meta.annotationName,
        annotationHidden: meta.annotationHidden,
        annotationLocked: meta.annotationLocked,
        annotationSelectable: resolved.selectable,
        annotationEvented: resolved.evented,
        annotationHasControls: textbox.hasControls !== false,
        annotationEditable: resolved.editable,
    });
    syncAnnotationRuntimeState(annotation);
    attachTextEditingHandlers(context, annotation);
    plugins_mask_index.placeAnnotationObject(context.canvas, annotation);
    if (resolved.selectable !== false && isAnnotationUnlocked(annotation)) {
        context.canvas.setActiveObject(annotation);
    }
    context.canvas.renderAll();
    context.updateAnnotationList();
    context.saveCanvasState();
    const callbackContext = context.buildCallbackContext('createTextAnnotation');
    context.emitAnnotationsChanged(callbackContext);
    context.emitImageChanged(callbackContext);
    if (resolved.enterEditing && isAnnotationUnlocked(annotation)) {
        (_b = (_a = annotation).enterEditing) === null || _b === void 0 ? void 0 : _b.call(_a);
        selectAllText(annotation);
    }
    return annotation;
}
function handleTextModePointer(context, event) {
    var _a, _b;
    const fabricEvent = event;
    const target = fabricEvent.target;
    if (target && plugins_mask_index.isTextAnnotationObject(target) && isAnnotationUnlocked(target)) {
        context.canvas.setActiveObject(target);
        (_b = (_a = target).enterEditing) === null || _b === void 0 ? void 0 : _b.call(_a);
        return;
    }
    const pointer = getPointerFromFabricEvent(context.canvas, event);
    if (!pointer)
        return;
    createTextAnnotation(context, {
        left: pointer.x,
        top: pointer.y,
    });
}
function enterTextMode(context) {
    if (context.getTextSession())
        return;
    if (!context.isImageLoaded())
        return;
    const { canvas } = context;
    const previousCanvasSelection = !!canvas.selection;
    const previousDefaultCursor = canvas.defaultCursor;
    canvas.selection = true;
    canvas.defaultCursor = 'text';
    const callback = (event) => handleTextModePointer(context, event);
    canvas.on('mouse:down', callback);
    const session = {
        mode: 'text',
        previousCanvasSelection,
        previousDefaultCursor,
        handlers: [{ eventName: 'mouse:down', callback }],
        dispose: () => {
            try {
                canvas.off('mouse:down', callback);
            }
            catch {
            }
            canvas.selection = previousCanvasSelection;
            canvas.defaultCursor = previousDefaultCursor !== null && previousDefaultCursor !== void 0 ? previousDefaultCursor : 'default';
        },
    };
    context.setTextSession(session);
    context.updateUi();
}
function exitTextMode(context) {
    const session = context.getTextSession();
    if (!session)
        return;
    finalizeActiveTextEditing(context, { commit: true });
    session.dispose();
    context.setTextSession(null);
    context.canvas.requestRenderAll();
    context.updateUi();
}
function finalizeActiveTextEditing(context, options) {
    var _a;
    const active = context.canvas.getActiveObject();
    if (!active || !plugins_mask_index.isTextAnnotationObject(active))
        return;
    const textObject = active;
    if (textObject.isEditing !== true)
        return;
    textObject.imageEditorTextEditingCancel = !options.commit;
    (_a = textObject.exitEditing) === null || _a === void 0 ? void 0 : _a.call(textObject);
    context.canvas.requestRenderAll();
}
function attachTextEditingHandlersToAnnotations(context, annotations) {
    annotations.filter(plugins_mask_index.isTextAnnotationObject).forEach((annotation) => {
        attachTextEditingHandlers(context, annotation);
    });
}

class Command {
    constructor(execute, undo) {
        Object.defineProperty(this, "execute", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: execute
        });
        Object.defineProperty(this, "undo", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: undo
        });
    }
}

const TRUSTED_STATE_RESTORE = Symbol('ImageEditorTrustedStateRestore');
async function loadFromStateAction(access, jsonString, options) {
    var _a, _b, _c, _d;
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
        const restoredState = await loadFromState({
            canvas,
            jsonString,
            setCanvasSize: (widthPx, heightPx) => access.setCanvasSize(widthPx, heightPx),
            maxCanvasPixels: access.getOptions().maxExportPixels,
            maxRestoreCanvasDimension: access.getOptions().maxExportDimension,
            restoreTrustLevel: isTrustedStateRestoreOptions(options) ? 'trusted' : 'public',
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
            access.restoreImageFilterConfig((_c = editorState === null || editorState === void 0 ? void 0 : editorState.imageFilterConfig) !== null && _c !== void 0 ? _c : null);
        }
        else {
            access.setCurrentImageMimeType(null);
            access.restoreImageFilterConfig(null);
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
            plugins_mask_index.applyMaskUnselectedStyle(maskObject);
            plugins_mask_index.reattachMaskHoverHandlers(maskObject);
        });
        syncAnnotationRuntimeStates(restoredState.annotations);
        attachTextEditingHandlersToAnnotations(access.buildTextControllerContext(), restoredState.annotations);
        access.setLastSnapshot(captureSnapshotAction(access));
        (_d = access.getCanvas()) === null || _d === void 0 ? void 0 : _d.renderAll();
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
        plugins_mask_index.reportError(access.getOptions(), error, 'Failed to restore canvas state.');
        throw error;
    }
}
function isTrustedStateRestoreOptions(options) {
    return !!(options === null || options === void 0 ? void 0 : options[TRUSTED_STATE_RESTORE]);
}
function saveStateAction(access, options) {
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
        const after = saveState({
            canvas,
            activeMaskId: (_a = activeMask === null || activeMask === void 0 ? void 0 : activeMask.maskId) !== null && _a !== void 0 ? _a : null,
            activeAnnotationId: (_b = activeAnnotation === null || activeAnnotation === void 0 ? void 0 : activeAnnotation.annotationId) !== null && _b !== void 0 ? _b : null,
            currentScale: access.getCurrentScale(),
            currentRotation: access.getCurrentRotation(),
            baseImageScale: access.getBaseImageScale(),
            currentImageMimeType: access.getCurrentImageMimeType(),
            imageFilterConfig: access.getCurrentImageFilterConfig(),
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
        plugins_mask_index.reportWarning(access.getOptions(), error, 'Failed to capture canvas snapshot.');
    }
    finally {
        restoreActiveObjectAfterSnapshot(access, activeObj, activeMask, activeAnnotation);
        access.updateUi();
    }
}
function captureSnapshotAction(access) {
    var _a, _b;
    const canvas = access.getCanvas();
    if (!canvas) {
        throw new Error('[ImageEditor] Cannot capture canvas snapshot before init or after dispose.');
    }
    const activeMask = getActiveMaskForSnapshot(canvas);
    const activeAnnotation = getActiveAnnotationForSnapshot(canvas);
    access.hideAllMaskLabels();
    return saveState({
        canvas,
        activeMaskId: (_a = activeMask === null || activeMask === void 0 ? void 0 : activeMask.maskId) !== null && _a !== void 0 ? _a : null,
        activeAnnotationId: (_b = activeAnnotation === null || activeAnnotation === void 0 ? void 0 : activeAnnotation.annotationId) !== null && _b !== void 0 ? _b : null,
        currentScale: access.getCurrentScale(),
        currentRotation: access.getCurrentRotation(),
        baseImageScale: access.getBaseImageScale(),
        currentImageMimeType: access.getCurrentImageMimeType(),
        imageFilterConfig: access.getCurrentImageFilterConfig(),
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
    const activeObject = canvas.getActiveObject();
    return activeObject && plugins_mask_index.isMaskObject(activeObject) ? activeObject : null;
}
function getActiveAnnotationForSnapshot(canvas) {
    const activeObject = canvas.getActiveObject();
    return activeObject && plugins_mask_index.isAnnotationObject(activeObject) ? activeObject : null;
}
function restoreActiveObjectAfterSnapshot(access, activeObj, activeMask, activeAnnotation) {
    const canvas = access.getCanvas();
    if (!canvas)
        return;
    const maskToRestore = activeObj && plugins_mask_index.isMaskObject(activeObj) ? activeObj : activeMask;
    const annotationToRestore = activeObj && plugins_mask_index.isAnnotationObject(activeObj) ? activeObj : activeAnnotation;
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

function looksLikeFabricModule(value) {
    if (value === null || typeof value !== 'object')
        return false;
    const candidate = value.Canvas;
    return typeof candidate === 'function';
}
function readGlobalFabric(globalScope) {
    return globalScope.fabric;
}
function detectFabric(fabricOrOptions, maybeOptions, globalScope = globalThis) {
    var _a;
    if (looksLikeFabricModule(fabricOrOptions)) {
        return {
            fabric: fabricOrOptions,
            isFabricLoaded: true,
            options: maybeOptions !== null && maybeOptions !== void 0 ? maybeOptions : {},
        };
    }
    const options = (_a = fabricOrOptions) !== null && _a !== void 0 ? _a : {};
    const globalFabric = readGlobalFabric(globalScope);
    if (looksLikeFabricModule(globalFabric)) {
        return {
            fabric: globalFabric,
            isFabricLoaded: true,
            options,
        };
    }
    console.error('[ImageEditor] fabric.js v7 is not available. ' +
        'Pass it as the first constructor argument (ESM) or ' +
        'load it as a global <script> before instantiation.');
    return {
        fabric: null,
        isFabricLoaded: false,
        options,
    };
}

function isActiveSelectionObject$1(object) {
    if (!object)
        return false;
    const type = typeof object.type === 'string' ? object.type.toLowerCase() : '';
    if (type === 'activeselection')
        return true;
    const isType = object.isType;
    return (typeof isType === 'function' &&
        (isType.call(object, 'ActiveSelection') || isType.call(object, 'activeSelection')));
}
function getActiveSelectionObjects(canvas) {
    const active = canvas.getActiveObject();
    if (!active)
        return [];
    if (!isActiveSelectionObject$1(active))
        return [active];
    const getObjects = active.getObjects;
    return typeof getObjects === 'function' ? getObjects.call(active) : [];
}
function getAnnotations(canvas) {
    return canvas.getObjects().filter(plugins_mask_index.isAnnotationObject).slice();
}
function orderAnnotationsForList(annotations, order) {
    const ordered = annotations.slice();
    return order === 'back-to-front' ? ordered : ordered.reverse();
}
function getSelectedAnnotations(canvas) {
    return getActiveSelectionObjects(canvas).filter(plugins_mask_index.isAnnotationObject);
}
function snapshotAnnotation(annotation) {
    return JSON.stringify({
        text: annotation.text,
        fontSize: annotation.fontSize,
        fontFamily: annotation.fontFamily,
        fontWeight: annotation.fontWeight,
        fill: annotation.fill,
        backgroundColor: annotation.backgroundColor,
        textAlign: annotation.textAlign,
        width: annotation.width,
        stroke: annotation.stroke,
        strokeWidth: annotation.strokeWidth,
        opacity: annotation.opacity,
        visible: annotation.visible,
        selectable: annotation.selectable,
        evented: annotation.evented,
        hasControls: annotation.hasControls,
        editable: plugins_mask_index.isTextAnnotationObject(annotation)
            ? annotation.editable
            : undefined,
        annotationHidden: annotation.annotationHidden,
        annotationLocked: annotation.annotationLocked,
        annotationSelectable: annotation.annotationSelectable,
        annotationEvented: annotation.annotationEvented,
        annotationHasControls: annotation.annotationHasControls,
        annotationEditable: annotation.annotationEditable,
    });
}
function setAnnotationProps(annotation, props) {
    annotation.set(props);
}
function getCurrentAnnotationListCanvas(context) {
    var _a, _b;
    return (_b = (_a = context.getCanvas) === null || _a === void 0 ? void 0 : _a.call(context)) !== null && _b !== void 0 ? _b : context.canvas;
}
function updateTextAnnotation(annotation, config) {
    const props = {};
    const raw = config;
    if (typeof raw.text === 'string')
        props.text = raw.text;
    if (typeof raw.fontSize === 'number' && Number.isFinite(raw.fontSize) && raw.fontSize > 0) {
        props.fontSize = raw.fontSize;
    }
    if (typeof raw.fontFamily === 'string')
        props.fontFamily = raw.fontFamily;
    if (typeof raw.fontWeight === 'string' || typeof raw.fontWeight === 'number') {
        props.fontWeight = raw.fontWeight;
    }
    if (typeof raw.fill === 'string')
        props.fill = raw.fill;
    if (typeof raw.backgroundColor === 'string')
        props.backgroundColor = raw.backgroundColor;
    if (raw.textAlign === 'left' ||
        raw.textAlign === 'center' ||
        raw.textAlign === 'right' ||
        raw.textAlign === 'justify') {
        props.textAlign = raw.textAlign;
    }
    if (typeof raw.width === 'number' && Number.isFinite(raw.width) && raw.width > 0) {
        props.width = raw.width;
    }
    if (Object.keys(props).length > 0)
        setAnnotationProps(annotation, props);
}
function updateDrawAnnotation(annotation, config) {
    const props = {};
    const raw = config;
    if (typeof raw.stroke === 'string')
        props.stroke = raw.stroke;
    if (typeof raw.strokeWidth === 'number' &&
        Number.isFinite(raw.strokeWidth) &&
        raw.strokeWidth > 0) {
        props.strokeWidth = raw.strokeWidth;
    }
    if (typeof raw.opacity === 'number' && Number.isFinite(raw.opacity)) {
        props.opacity = Math.max(0, Math.min(1, raw.opacity));
    }
    if (Object.keys(props).length > 0)
        setAnnotationProps(annotation, props);
}
function updateShapeAnnotation(annotation, config) {
    const props = {};
    const raw = config;
    if (typeof raw.stroke === 'string')
        props.stroke = raw.stroke;
    if (typeof raw.strokeWidth === 'number' &&
        Number.isFinite(raw.strokeWidth) &&
        raw.strokeWidth > 0) {
        props.strokeWidth = raw.strokeWidth;
    }
    if (typeof raw.fill === 'string')
        props.fill = raw.fill;
    if (typeof raw.opacity === 'number' && Number.isFinite(raw.opacity)) {
        props.opacity = Math.max(0, Math.min(1, raw.opacity));
    }
    if (Object.keys(props).length > 0)
        setAnnotationProps(annotation, props);
}
function updateAnnotationObject(annotation, config) {
    const before = snapshotAnnotation(annotation);
    const raw = config;
    if (typeof raw.annotationHidden === 'boolean') {
        annotation.annotationHidden = raw.annotationHidden;
    }
    if (typeof raw.annotationLocked === 'boolean') {
        annotation.annotationLocked = raw.annotationLocked;
    }
    const lockedAfter = isAnnotationLocked(annotation);
    if (!lockedAfter) {
        if (typeof raw.selectable === 'boolean') {
            annotation.annotationSelectable = raw.selectable;
        }
        if (typeof raw.evented === 'boolean') {
            annotation.annotationEvented = raw.evented;
        }
        if (typeof raw.hasControls === 'boolean') {
            annotation.annotationHasControls = raw.hasControls;
        }
        if (plugins_mask_index.isTextAnnotationObject(annotation)) {
            if (typeof raw.editable === 'boolean') {
                annotation.annotationEditable = raw.editable;
            }
            updateTextAnnotation(annotation, config);
        }
        if (plugins_mask_index.isDrawAnnotationObject(annotation))
            updateDrawAnnotation(annotation, config);
        if (plugins_mask_index.isShapeAnnotationObject(annotation))
            updateShapeAnnotation(annotation, config);
    }
    syncAnnotationRuntimeState(annotation);
    return snapshotAnnotation(annotation) !== before;
}
function updateAnnotation(context, annotationId, config) {
    const target = getAnnotations(context.canvas).find((annotation) => annotation.annotationId === annotationId);
    if (!target)
        return false;
    const changed = updateAnnotationObject(target, config);
    if (!changed)
        return false;
    context.canvas.requestRenderAll();
    context.saveCanvasState();
    context.updateUi();
    return true;
}
function updateSelectedAnnotation(context, config) {
    const selectedAnnotations = getSelectedAnnotations(context.canvas);
    if (selectedAnnotations.length === 0)
        return false;
    const changed = selectedAnnotations
        .map((annotation) => updateAnnotationObject(annotation, config))
        .some(Boolean);
    if (!changed)
        return false;
    context.canvas.requestRenderAll();
    context.saveCanvasState();
    context.updateUi();
    return true;
}
function removeAnnotationObjects(context, objects, options = {}) {
    const force = options.force === true;
    const removable = objects.filter((annotation) => force || isAnnotationUnlocked(annotation));
    if (removable.length === 0)
        return 0;
    for (const annotation of removable) {
        context.canvas.remove(annotation);
    }
    context.canvas.discardActiveObject();
    context.canvas.renderAll();
    if (options.saveHistory !== false)
        context.saveCanvasState();
    context.updateUi();
    return removable.length;
}
function removeSelectedAnnotation(context) {
    return removeAnnotationObjects(context, getSelectedAnnotations(context.canvas));
}
function removeAllAnnotations(context, options = {}) {
    return removeAnnotationObjects(context, getAnnotations(context.canvas), options);
}
function renderAnnotationList(context) {
    const listEl = context.getListElement();
    const canvas = getCurrentAnnotationListCanvas(context);
    if (!listEl || !canvas)
        return;
    const ownerDocument = listEl.ownerDocument;
    listEl.innerHTML = '';
    orderAnnotationsForList(getAnnotations(canvas), context.listOrder).forEach((annotation) => {
        const item = ownerDocument.createElement('li');
        item.className = 'list-group-item annotation-item';
        item.textContent = annotation.annotationName;
        item.dataset.annotationId = String(annotation.annotationId);
        item.addEventListener('click', () => {
            const id = Number(item.dataset.annotationId);
            if (!Number.isFinite(id))
                return;
            const liveCanvas = getCurrentAnnotationListCanvas(context);
            if (!liveCanvas)
                return;
            const target = getAnnotations(liveCanvas).find((candidate) => candidate.annotationId === id);
            if (!target)
                return;
            liveCanvas.setActiveObject(target);
            context.onAnnotationSelected(target);
        });
        listEl.appendChild(item);
    });
}
function updateAnnotationListSelection(context, selectedAnnotation) {
    const listEl = context.getListElement();
    if (!listEl)
        return;
    const selectedId = selectedAnnotation ? String(selectedAnnotation.annotationId) : null;
    listEl.querySelectorAll('.annotation-item').forEach((item) => {
        item.classList.toggle('active', selectedId !== null && item.dataset.annotationId === selectedId);
    });
}

function isPathCommand(value) {
    return (Array.isArray(value) &&
        typeof value[0] === 'string' &&
        value.slice(1).every((entry) => typeof entry === 'number' && Number.isFinite(entry)));
}
function identity(point) {
    return point;
}
function toAbsolutePoint(x, y, current, isRelative) {
    return isRelative ? { x: current.x + x, y: current.y + y } : { x, y };
}
function pathValue(values, index) {
    var _a;
    return (_a = values[index]) !== null && _a !== void 0 ? _a : 0;
}
function addSegment(segments, transformPoint, start, end) {
    segments.push({
        start: transformPoint(start),
        end: transformPoint(end),
    });
}
function cubicPoint(start, c1, c2, end, t) {
    const mt = 1 - t;
    return {
        x: mt * mt * mt * start.x +
            3 * mt * mt * t * c1.x +
            3 * mt * t * t * c2.x +
            t * t * t * end.x,
        y: mt * mt * mt * start.y +
            3 * mt * mt * t * c1.y +
            3 * mt * t * t * c2.y +
            t * t * t * end.y,
    };
}
function quadraticPoint(start, c, end, t) {
    const mt = 1 - t;
    return {
        x: mt * mt * start.x + 2 * mt * t * c.x + t * t * end.x,
        y: mt * mt * start.y + 2 * mt * t * c.y + t * t * end.y,
    };
}
function addSampledCurve(segments, transformPoint, start, end, samplePoint) {
    const approximateLength = Math.hypot(end.x - start.x, end.y - start.y);
    const steps = Math.max(8, Math.min(48, Math.ceil(approximateLength / 6)));
    let previous = start;
    for (let index = 1; index <= steps; index += 1) {
        const next = samplePoint(index / steps);
        addSegment(segments, transformPoint, previous, next);
        previous = next;
    }
}
function getPathSegments(pathData, transformPoint = identity) {
    if (!Array.isArray(pathData))
        return [];
    const segments = [];
    let current = { x: 0, y: 0 };
    let subpathStart = null;
    for (const rawCommand of pathData) {
        if (!isPathCommand(rawCommand))
            continue;
        const rawName = rawCommand[0];
        const command = rawName.toUpperCase();
        const isRelative = rawName !== command;
        const values = rawCommand.slice(1);
        if (command === 'M') {
            for (let index = 0; index + 1 < values.length; index += 2) {
                const next = toAbsolutePoint(pathValue(values, index), pathValue(values, index + 1), current, isRelative);
                if (index > 0)
                    addSegment(segments, transformPoint, current, next);
                current = next;
                if (index === 0)
                    subpathStart = next;
            }
            continue;
        }
        if (command === 'L') {
            for (let index = 0; index + 1 < values.length; index += 2) {
                const next = toAbsolutePoint(pathValue(values, index), pathValue(values, index + 1), current, isRelative);
                addSegment(segments, transformPoint, current, next);
                current = next;
            }
            continue;
        }
        if (command === 'H') {
            for (const value of values) {
                const next = { x: isRelative ? current.x + value : value, y: current.y };
                addSegment(segments, transformPoint, current, next);
                current = next;
            }
            continue;
        }
        if (command === 'V') {
            for (const value of values) {
                const next = { x: current.x, y: isRelative ? current.y + value : value };
                addSegment(segments, transformPoint, current, next);
                current = next;
            }
            continue;
        }
        if (command === 'C') {
            for (let index = 0; index + 5 < values.length; index += 6) {
                const start = current;
                const c1 = toAbsolutePoint(pathValue(values, index), pathValue(values, index + 1), current, isRelative);
                const c2 = toAbsolutePoint(pathValue(values, index + 2), pathValue(values, index + 3), current, isRelative);
                const end = toAbsolutePoint(pathValue(values, index + 4), pathValue(values, index + 5), current, isRelative);
                addSampledCurve(segments, transformPoint, start, end, (t) => cubicPoint(start, c1, c2, end, t));
                current = end;
            }
            continue;
        }
        if (command === 'Q') {
            for (let index = 0; index + 3 < values.length; index += 4) {
                const start = current;
                const control = toAbsolutePoint(pathValue(values, index), pathValue(values, index + 1), current, isRelative);
                const end = toAbsolutePoint(pathValue(values, index + 2), pathValue(values, index + 3), current, isRelative);
                addSampledCurve(segments, transformPoint, start, end, (t) => quadraticPoint(start, control, end, t));
                current = end;
            }
            continue;
        }
        if (command === 'A') {
            for (let index = 0; index + 6 < values.length; index += 7) {
                const next = toAbsolutePoint(pathValue(values, index + 5), pathValue(values, index + 6), current, isRelative);
                addSegment(segments, transformPoint, current, next);
                current = next;
            }
            continue;
        }
        if (command === 'Z' && subpathStart) {
            addSegment(segments, transformPoint, current, subpathStart);
            current = subpathStart;
        }
    }
    return segments;
}
function getPathPoints(pathData, transformPoint = identity) {
    const points = [];
    for (const segment of getPathSegments(pathData, transformPoint)) {
        const previous = points[points.length - 1];
        if (!previous || previous.x !== segment.start.x || previous.y !== segment.start.y) {
            points.push(segment.start);
        }
        points.push(segment.end);
    }
    return points;
}

function colorWithOpacity(color, opacity) {
    const alpha = Math.max(0, Math.min(1, opacity));
    if (alpha >= 1)
        return color;
    if (/^#([0-9a-f]{6})$/i.test(color)) {
        const hex = color.slice(1);
        const r = Number.parseInt(hex.slice(0, 2), 16);
        const g = Number.parseInt(hex.slice(2, 4), 16);
        const b = Number.parseInt(hex.slice(4, 6), 16);
        return `rgba(${r},${g},${b},${alpha})`;
    }
    return color;
}
function configureBrush(context) {
    const config = context.getDrawConfig();
    const canvasWithBrush = context.canvas;
    canvasWithBrush.freeDrawingBrush = new context.fabric.PencilBrush(context.canvas);
    canvasWithBrush.freeDrawingBrush.width = config.brushSize;
    canvasWithBrush.freeDrawingBrush.color = colorWithOpacity(config.color, config.opacity);
    canvasWithBrush.freeDrawingBrush.strokeLineCap = config.lineCap;
    canvasWithBrush.freeDrawingBrush.strokeLineJoin = config.lineJoin;
}
function setDrawingMode(context, enabled) {
    const canvasWithDrawing = context.canvas;
    canvasWithDrawing.isDrawingMode = enabled;
}
function createEraserPreview(context) {
    const config = context.getEraserConfig();
    const circle = new context.fabric.Circle({
        left: 0,
        top: 0,
        radius: config.brushSize / 2,
        originX: 'center',
        originY: 'center',
        fill: config.previewFill,
        stroke: config.previewStroke,
        strokeWidth: config.previewStrokeWidth,
        selectable: false,
        evented: false,
        excludeFromExport: true,
        objectCaching: false,
        visible: false,
    });
    return plugins_mask_index.markSessionObject(circle, 'eraserPreview');
}
function ensureEraserPreview(context, session) {
    var _a;
    const preview = (_a = session.eraserPreview) !== null && _a !== void 0 ? _a : createEraserPreview(context);
    session.eraserPreview = preview;
    const config = context.getEraserConfig();
    preview.set({
        radius: config.brushSize / 2,
        fill: config.previewFill,
        stroke: config.previewStroke,
        strokeWidth: config.previewStrokeWidth,
    });
    if (!context.canvas.getObjects().includes(preview)) {
        context.canvas.add(preview);
    }
    plugins_mask_index.placeSessionObject(context.canvas, preview);
    return preview;
}
function hideEraserPreview(context, session) {
    if (!session.eraserPreview)
        return;
    session.eraserPreview.set({ visible: false });
    context.canvas.requestRenderAll();
}
function removeEraserPreview(context, session) {
    if (!session.eraserPreview)
        return;
    try {
        context.canvas.remove(session.eraserPreview);
    }
    catch {
    }
    session.eraserPreview = null;
}
function moveEraserPreview(context, session, point) {
    const preview = ensureEraserPreview(context, session);
    preview.set({ left: point.x, top: point.y, visible: session.subMode === 'erase' });
    context.canvas.requestRenderAll();
}
function pushEraserPoint(context, session, point) {
    const previous = session.eraserPoints[session.eraserPoints.length - 1];
    if (!previous) {
        session.eraserPoints.push(point);
        return;
    }
    const radius = Math.max(1, context.getEraserConfig().brushSize / 2);
    const spacing = Math.max(1, radius / 2);
    const distance = Math.hypot(point.x - previous.x, point.y - previous.y);
    const steps = Math.max(1, Math.ceil(distance / spacing));
    for (let index = 1; index <= steps; index += 1) {
        const t = index / steps;
        session.eraserPoints.push({
            x: previous.x + (point.x - previous.x) * t,
            y: previous.y + (point.y - previous.y) * t,
        });
    }
}
function pointIntersectsExpandedBounds(point, bounds, radius) {
    return (point.x >= bounds.left - radius &&
        point.x <= bounds.left + bounds.width + radius &&
        point.y >= bounds.top - radius &&
        point.y <= bounds.top + bounds.height + radius);
}
function transformPathPoint$1(annotation, point) {
    var _a, _b;
    const pathLike = annotation;
    const offset = (_a = pathLike.pathOffset) !== null && _a !== void 0 ? _a : { x: 0, y: 0 };
    const x = point.x - (Number(offset.x) || 0);
    const y = point.y - (Number(offset.y) || 0);
    const matrix = (_b = pathLike.calcTransformMatrix) === null || _b === void 0 ? void 0 : _b.call(pathLike);
    if (!Array.isArray(matrix) || matrix.length < 6)
        return { x: point.x, y: point.y };
    const [a = 1, b = 0, c = 0, d = 1, e = 0, f = 0] = matrix;
    return {
        x: a * x + c * y + e,
        y: b * x + d * y + f,
    };
}
function getDrawAnnotationPathSegments(annotation) {
    const pathData = annotation.path;
    return getPathSegments(pathData, (point) => transformPathPoint$1(annotation, point));
}
function getEffectiveStrokeRadius(annotation) {
    var _a;
    const scalable = annotation;
    const strokeWidth = Number(annotation.strokeWidth) || 0;
    const scale = (_a = scalable.getObjectScaling) === null || _a === void 0 ? void 0 : _a.call(scalable);
    if (scalable.strokeUniform) {
        return Math.max(0, strokeWidth / 2);
    }
    const scaleX = Math.abs(Number(scale === null || scale === void 0 ? void 0 : scale.x) || Number(annotation.scaleX) || 1);
    const scaleY = Math.abs(Number(scale === null || scale === void 0 ? void 0 : scale.y) || Number(annotation.scaleY) || 1);
    return Math.max(0, (strokeWidth * Math.max(scaleX, scaleY)) / 2);
}
function pointDistanceToSegment(point, segment) {
    const dx = segment.end.x - segment.start.x;
    const dy = segment.end.y - segment.start.y;
    const lengthSquared = dx * dx + dy * dy;
    if (lengthSquared === 0) {
        return Math.hypot(point.x - segment.start.x, point.y - segment.start.y);
    }
    const t = Math.max(0, Math.min(1, ((point.x - segment.start.x) * dx + (point.y - segment.start.y) * dy) / lengthSquared));
    const nearest = {
        x: segment.start.x + t * dx,
        y: segment.start.y + t * dy,
    };
    return Math.hypot(point.x - nearest.x, point.y - nearest.y);
}
function annotationIntersectsEraserPath(annotation, points, eraserRadius) {
    const hitRadius = eraserRadius + getEffectiveStrokeRadius(annotation);
    const bounds = getObjectBBox(annotation);
    if (!points.some((point) => pointIntersectsExpandedBounds(point, bounds, hitRadius))) {
        return false;
    }
    const segments = getDrawAnnotationPathSegments(annotation);
    if (segments.length === 0)
        return false;
    return points.some((point) => segments.some((segment) => pointDistanceToSegment(point, segment) <= hitRadius));
}
function getIntersectedDrawAnnotations(context, points) {
    if (points.length === 0)
        return [];
    const radius = Math.max(1, context.getEraserConfig().brushSize / 2);
    return context.canvas
        .getObjects()
        .filter(plugins_mask_index.isDrawAnnotationObject)
        .filter((annotation) => annotationIntersectsEraserPath(annotation, points, radius));
}
function commitEraserStroke(context, session) {
    const removed = getIntersectedDrawAnnotations(context, session.eraserPoints);
    session.eraserPoints = [];
    session.isErasing = false;
    if (removed.length === 0)
        return;
    removed.forEach((annotation) => {
        context.canvas.remove(annotation);
    });
    context.canvas.discardActiveObject();
    context.canvas.renderAll();
    context.saveCanvasState();
    context.updateAnnotationList();
    context.updateUi();
    const callbackContext = context.buildCallbackContext('commitEraserStroke');
    context.emitAnnotationsChanged(callbackContext);
    context.emitImageChanged(callbackContext);
}
function handleEraserPointerDown(context, event) {
    const session = context.getDrawSession();
    if (!session || session.subMode !== 'erase')
        return;
    const pointer = getPointerFromFabricEvent(context.canvas, event);
    if (!pointer)
        return;
    session.isErasing = true;
    session.eraserPoints = [];
    pushEraserPoint(context, session, pointer);
    moveEraserPreview(context, session, pointer);
}
function handleEraserPointerMove(context, event) {
    const session = context.getDrawSession();
    if (!session || session.subMode !== 'erase')
        return;
    const pointer = getPointerFromFabricEvent(context.canvas, event);
    if (!pointer) {
        hideEraserPreview(context, session);
        return;
    }
    moveEraserPreview(context, session, pointer);
    if (session.isErasing)
        pushEraserPoint(context, session, pointer);
}
function handleEraserPointerUp(context, event) {
    const session = context.getDrawSession();
    if (!session || session.subMode !== 'erase')
        return;
    const pointer = getPointerFromFabricEvent(context.canvas, event);
    if (pointer) {
        pushEraserPoint(context, session, pointer);
        moveEraserPreview(context, session, pointer);
    }
    commitEraserStroke(context, session);
}
function markPathAsDrawAnnotation(context, path) {
    const config = context.getDrawConfig();
    const annotationId = context.getAnnotationCounter() + 1;
    context.setAnnotationCounter(annotationId);
    path.set({
        selectable: config.selectable,
        evented: config.evented,
        opacity: config.opacity,
        stroke: config.color,
        strokeWidth: config.brushSize,
    });
    const annotation = plugins_mask_index.markAnnotationObject(path, {
        annotationId,
        annotationType: 'draw',
        annotationName: `${context.options.drawAnnotationName}${annotationId}`,
        annotationHidden: config.annotationHidden,
        annotationLocked: config.annotationLocked,
        annotationSelectable: config.selectable,
        annotationEvented: config.evented,
        annotationHasControls: path.hasControls !== false,
    });
    syncAnnotationRuntimeState(annotation);
    return annotation;
}
function handlePathCreated(context, event) {
    const path = event.path;
    if (!path)
        return;
    const annotation = markPathAsDrawAnnotation(context, path);
    plugins_mask_index.placeAnnotationObject(context.canvas, annotation);
    context.canvas.setActiveObject(annotation);
    context.canvas.renderAll();
    context.updateAnnotationList();
    context.saveCanvasState();
    const callbackContext = context.buildCallbackContext('createDrawAnnotation');
    context.emitAnnotationsChanged(callbackContext);
    context.emitImageChanged(callbackContext);
}
function enterDrawMode(context) {
    if (context.getDrawSession())
        return;
    if (!context.isImageLoaded())
        return;
    const { canvas } = context;
    const canvasWithDrawing = canvas;
    const previousDrawingMode = !!canvasWithDrawing.isDrawingMode;
    const previousBrush = canvasWithDrawing.freeDrawingBrush;
    const previousCanvasSelection = !!canvas.selection;
    const previousSkipTargetFind = !!canvas.skipTargetFind;
    const previousDefaultCursor = canvas.defaultCursor;
    canvas.selection = false;
    canvas.defaultCursor = 'crosshair';
    canvasWithDrawing.isDrawingMode = true;
    configureBrush(context);
    const pathCreatedCallback = (event) => handlePathCreated(context, event);
    canvas.on('path:created', pathCreatedCallback);
    const mouseDownCallback = (event) => handleEraserPointerDown(context, event);
    const mouseMoveCallback = (event) => handleEraserPointerMove(context, event);
    const mouseUpCallback = (event) => handleEraserPointerUp(context, event);
    const mouseOutCallback = () => {
        const session = context.getDrawSession();
        if (session)
            hideEraserPreview(context, session);
    };
    canvas.on('mouse:down', mouseDownCallback);
    canvas.on('mouse:move', mouseMoveCallback);
    canvas.on('mouse:up', mouseUpCallback);
    canvas.on('mouse:out', mouseOutCallback);
    const session = {
        mode: 'draw',
        subMode: 'brush',
        previousDrawingMode,
        previousBrush,
        previousCanvasSelection,
        previousSkipTargetFind,
        previousDefaultCursor,
        eraserPreview: null,
        eraserPoints: [],
        isErasing: false,
        handlers: [
            { eventName: 'path:created', callback: pathCreatedCallback },
            { eventName: 'mouse:down', callback: mouseDownCallback },
            { eventName: 'mouse:move', callback: mouseMoveCallback },
            { eventName: 'mouse:up', callback: mouseUpCallback },
            { eventName: 'mouse:out', callback: mouseOutCallback },
        ],
        dispose: () => {
            for (const record of session.handlers) {
                try {
                    canvas.off(record.eventName, record.callback);
                }
                catch {
                }
            }
            removeEraserPreview(context, session);
            canvasWithDrawing.isDrawingMode = previousDrawingMode;
            canvasWithDrawing.freeDrawingBrush = previousBrush;
            canvas.selection = previousCanvasSelection;
            canvas.skipTargetFind = previousSkipTargetFind;
            canvas.defaultCursor = previousDefaultCursor !== null && previousDefaultCursor !== void 0 ? previousDefaultCursor : 'default';
        },
    };
    context.setDrawSession(session);
    context.updateUi();
}
function exitDrawMode(context) {
    const session = context.getDrawSession();
    if (!session)
        return;
    session.dispose();
    context.setDrawSession(null);
    context.canvas.requestRenderAll();
    context.updateUi();
}
function updateDrawBrush(context) {
    if (!context.getDrawSession())
        return;
    configureBrush(context);
}
function setDrawSubMode(context, subMode) {
    const session = context.getDrawSession();
    if (!session)
        return;
    if (session.subMode === subMode)
        return;
    session.subMode = subMode;
    session.isErasing = false;
    session.eraserPoints = [];
    if (subMode === 'brush') {
        context.canvas.skipTargetFind = session.previousSkipTargetFind;
        hideEraserPreview(context, session);
        configureBrush(context);
        setDrawingMode(context, true);
    }
    else {
        context.canvas.discardActiveObject();
        context.canvas.skipTargetFind = true;
        setDrawingMode(context, false);
        ensureEraserPreview(context, session).set({ visible: false });
    }
    context.canvas.requestRenderAll();
    context.updateUi();
}
function updateEraserPreview(context) {
    const session = context.getDrawSession();
    if (!session || session.subMode !== 'erase')
        return;
    const preview = ensureEraserPreview(context, session);
    preview.set({ visible: false });
    context.canvas.requestRenderAll();
}

const MIN_INTERACTIVE_SHAPE_SIZE = 2;
function resolveDefaultShapePosition(context) {
    const image = context.getOriginalImage();
    if (image) {
        const bounds = getObjectBBox(image);
        return { left: Math.round(bounds.left + 16), top: Math.round(bounds.top + 16) };
    }
    return { left: 16, top: 16 };
}
function resolveShapeCreationConfig(context, config) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const base = mergeShapeAnnotationConfigPatch(context.getShapeConfig(), config);
    const fallback = resolveDefaultShapePosition(context);
    const leftInput = (_a = config.left) !== null && _a !== void 0 ? _a : base.left;
    const topInput = (_b = config.top) !== null && _b !== void 0 ? _b : base.top;
    const x1Input = (_d = (_c = config.x1) !== null && _c !== void 0 ? _c : base.x1) !== null && _d !== void 0 ? _d : leftInput;
    const y1Input = (_f = (_e = config.y1) !== null && _e !== void 0 ? _e : base.y1) !== null && _f !== void 0 ? _f : topInput;
    const x2Input = (_g = config.x2) !== null && _g !== void 0 ? _g : base.x2;
    const y2Input = (_h = config.y2) !== null && _h !== void 0 ? _h : base.y2;
    const left = plugins_mask_index.resolveNumeric(leftInput, 'x', fallback.left, context.canvas, context.options);
    const top = plugins_mask_index.resolveNumeric(topInput, 'y', fallback.top, context.canvas, context.options);
    const x1 = plugins_mask_index.resolveNumeric(x1Input, 'x', left, context.canvas, context.options);
    const y1 = plugins_mask_index.resolveNumeric(y1Input, 'y', top, context.canvas, context.options);
    return {
        ...base,
        left,
        top,
        x1,
        y1,
        x2: plugins_mask_index.resolveNumeric(x2Input, 'x', x1 + base.width, context.canvas, context.options),
        y2: plugins_mask_index.resolveNumeric(y2Input, 'y', y1 + base.height, context.canvas, context.options),
    };
}
function geometryFromResolved(config) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const x1 = (_b = (_a = config.x1) !== null && _a !== void 0 ? _a : config.left) !== null && _b !== void 0 ? _b : 0;
    const y1 = (_d = (_c = config.y1) !== null && _c !== void 0 ? _c : config.top) !== null && _d !== void 0 ? _d : 0;
    const x2 = (_e = config.x2) !== null && _e !== void 0 ? _e : x1 + config.width;
    const y2 = (_f = config.y2) !== null && _f !== void 0 ? _f : y1 + config.height;
    return {
        left: (_g = config.left) !== null && _g !== void 0 ? _g : Math.min(x1, x2),
        top: (_h = config.top) !== null && _h !== void 0 ? _h : Math.min(y1, y2),
        width: config.width,
        height: config.height,
        x1,
        y1,
        x2,
        y2,
    };
}
function geometryFromPoints(start, end) {
    return {
        left: Math.min(start.x, end.x),
        top: Math.min(start.y, end.y),
        width: Math.abs(end.x - start.x),
        height: Math.abs(end.y - start.y),
        x1: start.x,
        y1: start.y,
        x2: end.x,
        y2: end.y,
    };
}
function buildArrowPath$1(geometry, headLength) {
    const { x1, y1, x2, y2 } = geometry;
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const length = Math.max(1, headLength);
    const wingAngle = Math.PI / 7;
    const head1x = x2 - length * Math.cos(angle - wingAngle);
    const head1y = y2 - length * Math.sin(angle - wingAngle);
    const head2x = x2 - length * Math.cos(angle + wingAngle);
    const head2y = y2 - length * Math.sin(angle + wingAngle);
    return `M ${x1} ${y1} L ${x2} ${y2} M ${x2} ${y2} L ${head1x} ${head1y} M ${x2} ${y2} L ${head2x} ${head2y}`;
}
function createShapeFabricObject(context, shape, geometry, config) {
    const common = {
        stroke: config.stroke,
        strokeWidth: config.strokeWidth,
        strokeDashArray: config.strokeDashArray ? [...config.strokeDashArray] : undefined,
        opacity: config.opacity,
        angle: config.angle,
        selectable: config.selectable,
        evented: config.evented,
        originX: 'left',
        originY: 'top',
        ...config.styles,
    };
    if (shape === 'rect') {
        return new context.fabric.Rect({
            left: geometry.left,
            top: geometry.top,
            width: Math.max(MIN_INTERACTIVE_SHAPE_SIZE, geometry.width),
            height: Math.max(MIN_INTERACTIVE_SHAPE_SIZE, geometry.height),
            fill: config.fill,
            ...common,
        });
    }
    const path = shape === 'arrow'
        ? buildArrowPath$1(geometry, config.arrowHeadLength)
        : `M ${geometry.x1} ${geometry.y1} L ${geometry.x2} ${geometry.y2}`;
    return new context.fabric.Path(path, {
        fill: '',
        strokeLineCap: 'round',
        strokeLineJoin: 'round',
        objectCaching: false,
        ...common,
    });
}
function nextShapeAnnotationMeta(context, config) {
    const annotationId = context.getAnnotationCounter() + 1;
    context.setAnnotationCounter(annotationId);
    return {
        annotationId,
        annotationName: `${context.options.shapeAnnotationName}${annotationId}`,
        annotationHidden: config.annotationHidden,
        annotationLocked: config.annotationLocked,
    };
}
function markShapeAnnotation(context, object, config) {
    const meta = nextShapeAnnotationMeta(context, config);
    const annotation = plugins_mask_index.markAnnotationObject(object, {
        annotationId: meta.annotationId,
        annotationType: 'shape',
        annotationName: meta.annotationName,
        annotationHidden: meta.annotationHidden,
        annotationLocked: meta.annotationLocked,
        annotationSelectable: config.selectable,
        annotationEvented: config.evented,
        annotationHasControls: object.hasControls !== false,
    });
    annotation.shapeAnnotationKind = config.shape;
    syncAnnotationRuntimeState(annotation);
    return annotation;
}
function createShapeAnnotation(context, config = {}) {
    if (!context.isImageLoaded())
        return null;
    const resolved = resolveShapeCreationConfig(context, config);
    const geometry = geometryFromResolved(resolved);
    const object = createShapeFabricObject(context, resolved.shape, geometry, resolved);
    const annotation = markShapeAnnotation(context, object, resolved);
    plugins_mask_index.placeAnnotationObject(context.canvas, annotation);
    if (resolved.selectable !== false && isAnnotationUnlocked(annotation)) {
        context.canvas.setActiveObject(annotation);
    }
    context.canvas.renderAll();
    context.updateAnnotationList();
    context.saveCanvasState();
    const callbackContext = context.buildCallbackContext('createShapeAnnotation');
    context.emitAnnotationsChanged(callbackContext);
    context.emitImageChanged(callbackContext);
    return annotation;
}
function isMeaningfulGeometry(shape, geometry) {
    if (shape === 'rect') {
        return (geometry.width >= MIN_INTERACTIVE_SHAPE_SIZE &&
            geometry.height >= MIN_INTERACTIVE_SHAPE_SIZE);
    }
    return (Math.hypot(geometry.x2 - geometry.x1, geometry.y2 - geometry.y1) >=
        MIN_INTERACTIVE_SHAPE_SIZE);
}
function createPreviewObject(context, shape, geometry) {
    const config = { ...context.getShapeConfig()};
    const preview = createShapeFabricObject(context, shape, geometry, config);
    preview.set({
        selectable: false,
        evented: false,
        excludeFromExport: true,
        objectCaching: false,
    });
    plugins_mask_index.markSessionObject(preview, 'shapePreview');
    return preview;
}
function removePreview(context, session) {
    if (!session.previewObject)
        return;
    try {
        context.canvas.remove(session.previewObject);
    }
    catch {
    }
    session.previewObject = null;
}
function updateActiveSessionShape(context, session, shape) {
    const changed = session.shape !== shape;
    session.shape = shape;
    session.startPoint = null;
    removePreview(context, session);
    if (changed) {
        context.canvas.requestRenderAll();
        context.updateUi();
    }
}
function updatePreview(context, session, pointer) {
    if (!session.startPoint)
        return;
    const geometry = geometryFromPoints(session.startPoint, pointer);
    removePreview(context, session);
    if (!isMeaningfulGeometry(session.shape, geometry)) {
        context.canvas.requestRenderAll();
        return;
    }
    const preview = createPreviewObject(context, session.shape, geometry);
    session.previewObject = preview;
    plugins_mask_index.placeSessionObject(context.canvas, preview);
    context.canvas.requestRenderAll();
}
function completeInteractiveShape(context, session, pointer) {
    if (!session.startPoint)
        return;
    const geometry = geometryFromPoints(session.startPoint, pointer);
    session.startPoint = null;
    removePreview(context, session);
    if (!isMeaningfulGeometry(session.shape, geometry)) {
        context.canvas.requestRenderAll();
        return;
    }
    if (session.shape === 'rect') {
        createShapeAnnotation(context, {
            shape: 'rect',
            left: geometry.left,
            top: geometry.top,
            width: geometry.width,
            height: geometry.height,
        });
        return;
    }
    createShapeAnnotation(context, {
        shape: session.shape,
        x1: geometry.x1,
        y1: geometry.y1,
        x2: geometry.x2,
        y2: geometry.y2,
    });
}
function attachCanvasHandler$1(context, session, eventName, callback) {
    context.canvas.on(eventName, callback);
    session.handlers.push({ eventName, callback });
}
function detachCanvasHandlers$1(context, session) {
    for (const record of session.handlers) {
        try {
            context.canvas.off(record.eventName, record.callback);
        }
        catch {
        }
    }
    session.handlers = [];
}
function enterShapeMode(context, shape) {
    const existingSession = context.getShapeSession();
    if (existingSession) {
        updateActiveSessionShape(context, existingSession, shape);
        return;
    }
    if (!context.isImageLoaded())
        return;
    const { canvas } = context;
    const previousCanvasSelection = !!canvas.selection;
    const previousDefaultCursor = canvas.defaultCursor;
    canvas.selection = false;
    canvas.defaultCursor = 'crosshair';
    const session = {
        mode: 'shape',
        shape,
        previousCanvasSelection,
        previousDefaultCursor,
        startPoint: null,
        previewObject: null,
        handlers: [],
        dispose: () => {
            detachCanvasHandlers$1(context, session);
            removePreview(context, session);
            canvas.selection = previousCanvasSelection;
            canvas.defaultCursor = previousDefaultCursor !== null && previousDefaultCursor !== void 0 ? previousDefaultCursor : 'default';
        },
    };
    attachCanvasHandler$1(context, session, 'mouse:down', (event) => {
        const pointer = getPointerFromFabricEvent(canvas, event);
        if (!pointer)
            return;
        canvas.discardActiveObject();
        session.startPoint = pointer;
    });
    attachCanvasHandler$1(context, session, 'mouse:move', (event) => {
        const pointer = getPointerFromFabricEvent(canvas, event);
        if (!pointer || !session.startPoint)
            return;
        updatePreview(context, session, pointer);
    });
    attachCanvasHandler$1(context, session, 'mouse:up', (event) => {
        const pointer = getPointerFromFabricEvent(canvas, event);
        if (!pointer) {
            session.startPoint = null;
            removePreview(context, session);
            return;
        }
        completeInteractiveShape(context, session, pointer);
    });
    context.setShapeSession(session);
    context.updateUi();
}
function syncShapeModeConfig(context) {
    const session = context.getShapeSession();
    if (!session)
        return;
    updateActiveSessionShape(context, session, context.getShapeConfig().shape);
}
function exitShapeMode(context) {
    const session = context.getShapeSession();
    if (!session)
        return;
    session.dispose();
    context.setShapeSession(null);
    context.canvas.requestRenderAll();
    context.updateUi();
}

function enterTextModeAction(access) {
    if (!access.getCanvas())
        return;
    if (!access.canRunIdleOperation('enterTextMode'))
        return;
    if (access.isToolModeActive())
        return;
    enterTextMode(access.buildTextControllerContext());
    const callbackContext = access.buildCallbackContext('enterTextMode', false);
    access.emitBusyChangeIfChanged(callbackContext);
    access.emitImageChanged(callbackContext);
}
function exitTextModeAction(access) {
    if (!access.getCanvas() || !access.getTextSession())
        return;
    if (!access.canRunIdleOperation('exitTextMode'))
        return;
    exitTextMode(access.buildTextControllerContext());
    const callbackContext = access.buildCallbackContext('exitTextMode', false);
    access.emitBusyChangeIfChanged(callbackContext);
    access.emitImageChanged(callbackContext);
}
function createTextAnnotationAction(access, config = {}) {
    if (!access.getCanvas())
        return null;
    if (!access.canRunIdleOperation('createTextAnnotation'))
        return null;
    return createTextAnnotation(access.buildTextControllerContext(), config);
}
function enterDrawModeAction(access) {
    if (!access.getCanvas())
        return;
    if (!access.canRunIdleOperation('enterDrawMode'))
        return;
    if (access.isToolModeActive())
        return;
    enterDrawMode(access.buildDrawControllerContext());
    access.updateInputs();
    const callbackContext = access.buildCallbackContext('enterDrawMode', false);
    access.emitBusyChangeIfChanged(callbackContext);
    access.emitImageChanged(callbackContext);
}
function exitDrawModeAction(access) {
    if (!access.getCanvas() || !access.getDrawSession())
        return;
    if (!access.canRunIdleOperation('exitDrawMode'))
        return;
    exitDrawMode(access.buildDrawControllerContext());
    access.updateInputs();
    const callbackContext = access.buildCallbackContext('exitDrawMode', false);
    access.emitBusyChangeIfChanged(callbackContext);
    access.emitImageChanged(callbackContext);
}

function applyTextConfigPatchAction(access, config, operation) {
    if (!access.canRunIdleOperation(operation))
        return;
    const invalidFields = getInvalidTextAnnotationConfigFields(config);
    if (invalidFields.length > 0) {
        access.reportWarning(null, `${operation} ignored invalid Text config fields: ${invalidFields.join(', ')}.`);
    }
    const next = mergeTextAnnotationConfigPatch(access.getCurrentTextConfig(), config, access.getDefaultTextConfig());
    if (areResolvedTextAnnotationConfigsEqual(access.getCurrentTextConfig(), next))
        return;
    access.setCurrentTextConfig(next);
    access.updateInputs();
    access.updateUi();
    access.emitImageChanged(access.buildCallbackContext(operation, false));
}
function applyDrawConfigPatchAction(access, config, operation) {
    if (!access.canRunIdleOperation(operation))
        return;
    const invalidFields = getInvalidDrawConfigFields(config);
    if (invalidFields.length > 0) {
        access.reportWarning(null, `${operation} ignored invalid Draw config fields: ${invalidFields.join(', ')}.`);
    }
    const next = mergeDrawConfigPatch(access.getCurrentDrawConfig(), config, access.getDefaultDrawConfig());
    if (areResolvedDrawConfigsEqual(access.getCurrentDrawConfig(), next))
        return;
    access.setCurrentDrawConfig(next);
    updateDrawBrush(access.buildDrawControllerContext());
    access.updateInputs();
    access.updateUi();
    access.emitImageChanged(access.buildCallbackContext(operation, false));
}
function applyTextColorInputAction(access, color) {
    var _a;
    if (access.isTextMode()) {
        access.setTextColor(color);
        return;
    }
    const selected = (_a = access.getCanvas()) === null || _a === void 0 ? void 0 : _a.getActiveObject();
    if (selected && plugins_mask_index.isTextAnnotationObject(selected)) {
        access.updateSelectedAnnotation({ fill: color });
        return;
    }
    access.setTextColor(color);
}
function applyTextFontSizeInputAction(access, size) {
    var _a;
    if (access.isTextMode()) {
        access.setTextFontSize(size);
        return;
    }
    const selected = (_a = access.getCanvas()) === null || _a === void 0 ? void 0 : _a.getActiveObject();
    if (selected && plugins_mask_index.isTextAnnotationObject(selected)) {
        access.updateSelectedAnnotation({ fontSize: size });
        return;
    }
    access.setTextFontSize(size);
}
function applyDrawColorInputAction(access, color) {
    var _a;
    if (access.isDrawMode()) {
        access.setDrawColor(color);
        return;
    }
    const selected = (_a = access.getCanvas()) === null || _a === void 0 ? void 0 : _a.getActiveObject();
    if (selected && plugins_mask_index.isDrawAnnotationObject(selected)) {
        access.updateSelectedAnnotation({ stroke: color });
        return;
    }
    access.setDrawColor(color);
}
function applyDrawBrushSizeInputAction(access, size) {
    var _a;
    if (access.isDrawMode()) {
        access.setDrawBrushSize(size);
        return;
    }
    const selected = (_a = access.getCanvas()) === null || _a === void 0 ? void 0 : _a.getActiveObject();
    if (selected && plugins_mask_index.isDrawAnnotationObject(selected)) {
        access.updateSelectedAnnotation({ strokeWidth: size });
        return;
    }
    access.setDrawBrushSize(size);
}

const CROP_RECT_FILL = 'rgba(0,0,0,0.12)';
const CROP_RECT_STROKE = '#00aaff';
const CROP_RECT_DASH = [6, 4];
const CROP_RECT_CORNER_SIZE = 8;
const CROP_DEFAULT_PADDING = 10;
const CROPPED_EXPORT_QUALITY_FALLBACK = 0.92;
function finiteNumberOrFallback(value, fallback) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
}
function imageMimeToFormat(mimeType) {
    if (mimeType === 'image/jpeg')
        return 'jpeg';
    if (mimeType === 'image/png')
        return 'png';
    if (mimeType === 'image/webp')
        return 'webp';
    return null;
}
function resolveLossyCropQuality(cropExportQuality, downsampleQuality) {
    const cropQuality = Number(cropExportQuality);
    if (Number.isFinite(cropQuality)) {
        return clampQuality(cropQuality, CROPPED_EXPORT_QUALITY_FALLBACK);
    }
    const fallbackQuality = Number(downsampleQuality);
    if (Number.isFinite(fallbackQuality)) {
        return clampQuality(fallbackQuality, CROPPED_EXPORT_QUALITY_FALLBACK);
    }
    return CROPPED_EXPORT_QUALITY_FALLBACK;
}
function resolveCropExportFormat(input) {
    var _a, _b;
    const requested = input.cropExportFileType;
    const format = requested === undefined || requested === null || requested === 'source'
        ? ((_a = imageMimeToFormat(input.currentImageMimeType)) !== null && _a !== void 0 ? _a : 'png')
        : ((_b = tryNormalizeImageFormat(String(requested))) !== null && _b !== void 0 ? _b : 'png');
    const mimeType = mimeTypeFor(format);
    if (format === 'png')
        return { format, mimeType };
    return {
        format,
        mimeType,
        quality: resolveLossyCropQuality(input.cropExportQuality, input.downsampleQuality),
    };
}
function getCropRectContentBounds(cropRect) {
    const angle = Number(cropRect.angle) || 0;
    const normalizedAngle = Math.abs(angle % 360);
    if (normalizedAngle > 0.01 && Math.abs(normalizedAngle - 360) > 0.01) {
        return getObjectBBox(cropRect);
    }
    return {
        left: Number(cropRect.left) || 0,
        top: Number(cropRect.top) || 0,
        width: Math.max(0, (Number(cropRect.width) || 0) * Math.abs(Number(cropRect.scaleX) || 1)),
        height: Math.max(0, (Number(cropRect.height) || 0) * Math.abs(Number(cropRect.scaleY) || 1)),
    };
}
function removeCropRect(context, session) {
    for (const targetHandlers of session.handlers) {
        for (const record of targetHandlers.handlers) {
            try {
                targetHandlers.target.off(record.eventName, record.callback);
            }
            catch {
            }
        }
    }
    session.handlers = [];
    if (session.cropRect) {
        try {
            context.canvas.remove(session.cropRect);
        }
        catch {
        }
        session.cropRect = null;
    }
}
function restoreCropObjectState(session) {
    for (const record of session.prevEvented) {
        try {
            record.object.set({ evented: record.evented, selectable: record.selectable });
        }
        catch {
        }
    }
    session.prevEvented = [];
}
function restoreCropMaskBackups(session) {
    for (const backup of session.maskBackups) {
        plugins_mask_index.restoreMaskStyleBackup(backup);
    }
    session.maskBackups = [];
}
function teardownSession(context, session) {
    removeCropRect(context, session);
    restoreCropObjectState(session);
    restoreCropMaskBackups(session);
    try {
        context.canvas.selection = !!session.prevSelection;
    }
    catch {
    }
}
function finitePositiveRatio(numerator, denominator) {
    const ratio = Number(numerator) / Number(denominator);
    return Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
}
function resolvePostCropMaskPlacement(context, cropRegion) {
    const postCropImage = context.getOriginalImage();
    if (!postCropImage) {
        return { left: 0, top: 0, scaleX: 1, scaleY: 1 };
    }
    postCropImage.setCoords();
    const imageBounds = postCropImage.getBoundingRect();
    return {
        left: finiteNumberOrFallback(imageBounds.left, 0),
        top: finiteNumberOrFallback(imageBounds.top, 0),
        scaleX: finitePositiveRatio(imageBounds.width, cropRegion.width),
        scaleY: finitePositiveRatio(imageBounds.height, cropRegion.height),
    };
}
function maskIntersectsRegion(mask, region) {
    const bbox = getObjectBBox(mask);
    return (bbox.left < region.left + region.width &&
        bbox.left + bbox.width > region.left &&
        bbox.top < region.top + region.height &&
        bbox.top + bbox.height > region.top);
}
function capturePreservedMasks(canvas, cropRegion, maskBackups = []) {
    var _a;
    const records = [];
    const styleBackupByMask = maskBackups.length > 0
        ? new Map(maskBackups.map((backup) => [backup.object, backup]))
        : null;
    const masks = canvas.getObjects().filter(plugins_mask_index.isMaskObject);
    for (const mask of masks) {
        try {
            mask.setCoords();
            const intersects = maskIntersectsRegion(mask, cropRegion);
            if (intersects) {
                const styleBackup = (_a = styleBackupByMask === null || styleBackupByMask === void 0 ? void 0 : styleBackupByMask.get(mask)) !== null && _a !== void 0 ? _a : plugins_mask_index.captureMaskStyleBackup(mask);
                records.push({
                    mask,
                    left: finiteNumberOrFallback(mask.left, 0),
                    top: finiteNumberOrFallback(mask.top, 0),
                    angle: finiteNumberOrFallback(mask.angle, 0),
                    scaleX: finiteNumberOrFallback(mask.scaleX, 1),
                    scaleY: finiteNumberOrFallback(mask.scaleY, 1),
                    styleBackup,
                });
            }
            canvas.remove(mask);
        }
        catch {
        }
    }
    return records;
}
function reapplyPreservedMasks(context, cropRegion, records) {
    var _a;
    if (records.length === 0)
        return;
    const { canvas } = context;
    const placement = resolvePostCropMaskPlacement(context, cropRegion);
    let maxRestoredId = 0;
    for (const record of records) {
        try {
            plugins_mask_index.restoreMaskStyleBackup(record.styleBackup);
            record.mask.set({
                left: placement.left + (record.left - cropRegion.left) * placement.scaleX,
                top: placement.top + (record.top - cropRegion.top) * placement.scaleY,
                angle: record.angle,
                scaleX: record.scaleX * placement.scaleX,
                scaleY: record.scaleY * placement.scaleY,
                visible: true,
            });
            record.mask.setCoords();
            canvas.add(record.mask);
            canvas.bringObjectToFront(record.mask);
            plugins_mask_index.reattachMaskHoverHandlers(record.mask);
            const id = Number(record.mask.maskId);
            if (Number.isFinite(id) && id > maxRestoredId)
                maxRestoredId = id;
        }
        catch {
        }
    }
    if (typeof context.getMaskCounter === 'function' &&
        typeof context.setMaskCounter === 'function') {
        const liveCounter = Number(context.getMaskCounter());
        const safeCounter = Number.isFinite(liveCounter) ? liveCounter : 0;
        context.setMaskCounter(Math.max(safeCounter, maxRestoredId));
    }
    try {
        (_a = context.updateMaskList) === null || _a === void 0 ? void 0 : _a.call(context);
    }
    catch {
    }
}
const CROP_ASPECT_RATIO_PRESETS = Object.freeze({
    free: null,
    '1:1': 1,
    '3:4': 3 / 4,
    '4:3': 4 / 3,
    '3:2': 3 / 2,
    '2:3': 2 / 3,
    '9:16': 9 / 16,
    '16:9': 16 / 9,
});
function normalizeCropAspectRatio(input) {
    var _a;
    if (input === null || input === undefined)
        return null;
    if (typeof input === 'number') {
        return Number.isFinite(input) && input > 0 ? input : null;
    }
    if (typeof input === 'string') {
        const trimmed = input.trim();
        if (Object.prototype.hasOwnProperty.call(CROP_ASPECT_RATIO_PRESETS, trimmed)) {
            return (_a = CROP_ASPECT_RATIO_PRESETS[trimmed]) !== null && _a !== void 0 ? _a : null;
        }
        const parts = trimmed.split(':');
        if (parts.length !== 2)
            return null;
        const width = Number(parts[0]);
        const height = Number(parts[1]);
        return Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0
            ? width / height
            : null;
    }
    if (typeof input === 'object') {
        const width = Number(input.width);
        const height = Number(input.height);
        return Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0
            ? width / height
            : null;
    }
    return null;
}
function fitAspectRatioInside(maxWidth, maxHeight, aspectRatio) {
    const safeMaxWidth = Math.max(1, maxWidth);
    const safeMaxHeight = Math.max(1, maxHeight);
    let width = safeMaxWidth;
    let height = width / aspectRatio;
    if (height > safeMaxHeight) {
        height = safeMaxHeight;
        width = height * aspectRatio;
    }
    return {
        width: Math.max(1, width),
        height: Math.max(1, height),
    };
}
function minimumAspectRatioSizeThatFits(minWidth, minHeight, maxWidth, maxHeight, aspectRatio) {
    let width = Math.max(1, minWidth);
    let height = width / aspectRatio;
    if (height < minHeight) {
        height = Math.max(1, minHeight);
        width = height * aspectRatio;
    }
    return width <= maxWidth && height <= maxHeight ? { width, height } : null;
}
function chooseAspectRatioResizeBasis(canvas, cropRect, scaleX, scaleY) {
    var _a, _b, _c;
    const corner = String((_c = (_a = cropRect.__corner) !== null && _a !== void 0 ? _a : (_b = canvas._currentTransform) === null || _b === void 0 ? void 0 : _b.corner) !== null && _c !== void 0 ? _c : '').toLowerCase();
    if (corner === 'mt' || corner === 'mb')
        return 'height';
    if (corner === 'ml' || corner === 'mr')
        return 'width';
    return Math.abs(scaleY - 1) > Math.abs(scaleX - 1) ? 'height' : 'width';
}
function constrainAspectRatioSize(requestedWidth, requestedHeight, basis, aspectRatio, minWidth, minHeight, maxWidth, maxHeight) {
    var _a;
    const maxSize = fitAspectRatioInside(maxWidth, maxHeight, aspectRatio);
    const minSize = (_a = minimumAspectRatioSizeThatFits(minWidth, minHeight, maxSize.width, maxSize.height, aspectRatio)) !== null && _a !== void 0 ? _a : maxSize;
    let width = basis === 'height' ? requestedHeight * aspectRatio : requestedWidth;
    let height = basis === 'height' ? requestedHeight : requestedWidth / aspectRatio;
    if (width > maxSize.width || height > maxSize.height) {
        ({ width, height } = maxSize);
    }
    if (width < minSize.width || height < minSize.height) {
        ({ width, height } = minSize);
    }
    return { width, height };
}
function resolvePaddedCropArea(boundsLeft, boundsTop, maxCropWidth, maxCropHeight, padding) {
    const insetX = padding * 2 < maxCropWidth ? padding : 0;
    const insetY = padding * 2 < maxCropHeight ? padding : 0;
    return {
        left: boundsLeft + insetX,
        top: boundsTop + insetY,
        width: Math.max(1, maxCropWidth - insetX * 2),
        height: Math.max(1, maxCropHeight - insetY * 2),
    };
}
function resolveCropBounds(context) {
    const originalImage = context.getOriginalImage();
    if (!originalImage)
        return null;
    originalImage.setCoords();
    const { options } = context;
    const imageBounds = originalImage.getBoundingRect();
    const padding = Number.isFinite(Number(options.crop.padding))
        ? Number(options.crop.padding)
        : CROP_DEFAULT_PADDING;
    const boundsLeft = Math.max(0, Math.floor(imageBounds.left));
    const boundsTop = Math.max(0, Math.floor(imageBounds.top));
    const maxCropWidth = Math.max(1, Math.floor(imageBounds.width));
    const maxCropHeight = Math.max(1, Math.floor(imageBounds.height));
    const configuredMinWidth = Math.max(1, Number(options.crop.minWidth) || 1);
    const configuredMinHeight = Math.max(1, Number(options.crop.minHeight) || 1);
    return {
        boundsLeft,
        boundsTop,
        maxCropWidth,
        maxCropHeight,
        minCropWidth: Math.min(configuredMinWidth, maxCropWidth),
        minCropHeight: Math.min(configuredMinHeight, maxCropHeight),
        padding,
        imageBounds,
    };
}
function clampCropRectIntoBounds(cropRect, bounds) {
    const width = Math.min(bounds.maxCropWidth, Math.max(bounds.minCropWidth, (Number(cropRect.width) || 1) * (Number(cropRect.scaleX) || 1)));
    const height = Math.min(bounds.maxCropHeight, Math.max(bounds.minCropHeight, (Number(cropRect.height) || 1) * (Number(cropRect.scaleY) || 1)));
    const left = Math.min(bounds.boundsLeft + bounds.maxCropWidth - width, Math.max(bounds.boundsLeft, Number(cropRect.left) || bounds.boundsLeft));
    const top = Math.min(bounds.boundsTop + bounds.maxCropHeight - height, Math.max(bounds.boundsTop, Number(cropRect.top) || bounds.boundsTop));
    cropRect.set({ left, top, width, height, scaleX: 1, scaleY: 1 });
}
function resizeCropRectToAspectRatio(context, cropRect, aspectRatio) {
    const bounds = resolveCropBounds(context);
    if (!bounds)
        return;
    if (aspectRatio === null) {
        clampCropRectIntoBounds(cropRect, bounds);
        cropRect.setCoords();
        return;
    }
    const available = resolvePaddedCropArea(bounds.boundsLeft, bounds.boundsTop, bounds.maxCropWidth, bounds.maxCropHeight, bounds.padding);
    const fitted = fitAspectRatioInside(available.width, available.height, aspectRatio);
    cropRect.set({
        left: available.left + (available.width - fitted.width) / 2,
        top: available.top + (available.height - fitted.height) / 2,
        width: fitted.width,
        height: fitted.height,
        scaleX: 1,
        scaleY: 1,
    });
    cropRect.setCoords();
}
function updateCropRectControlVisibility(cropRect, aspectRatio, allowRotationOfCropRect) {
    const lockedRatio = aspectRatio !== null;
    cropRect.setControlsVisibility({
        tl: true,
        tr: true,
        br: true,
        bl: true,
        mt: !lockedRatio,
        mb: !lockedRatio,
        ml: !lockedRatio,
        mr: !lockedRatio,
        mtr: allowRotationOfCropRect,
    });
    cropRect.setCoords();
}
function enterCropMode(context, cropModeOptions = {}) {
    var _a;
    const { canvas, options } = context;
    if (context.getCropSession())
        return;
    const originalImage = context.getOriginalImage();
    if (!originalImage)
        return;
    if (!context.isImageLoaded())
        return;
    canvas.discardActiveObject();
    const beforeJson = context.saveState();
    const prevSelection = !!canvas.selection;
    canvas.selection = false;
    originalImage.setCoords();
    const imageBounds = originalImage.getBoundingRect();
    const padding = Number.isFinite(Number(options.crop.padding))
        ? Number(options.crop.padding)
        : CROP_DEFAULT_PADDING;
    const boundsLeft = Math.max(0, Math.floor(imageBounds.left));
    const boundsTop = Math.max(0, Math.floor(imageBounds.top));
    const maxCropWidth = Math.max(1, Math.floor(imageBounds.width));
    const maxCropHeight = Math.max(1, Math.floor(imageBounds.height));
    const configuredMinWidth = Math.max(1, Number(options.crop.minWidth) || 1);
    const configuredMinHeight = Math.max(1, Number(options.crop.minHeight) || 1);
    const minCropWidth = Math.min(configuredMinWidth, maxCropWidth);
    const minCropHeight = Math.min(configuredMinHeight, maxCropHeight);
    const allowRotation = !!options.crop.allowRotationOfCropRect;
    const aspectRatio = normalizeCropAspectRatio((_a = cropModeOptions.aspectRatio) !== null && _a !== void 0 ? _a : options.crop.aspectRatio);
    let rectLeft;
    let rectTop;
    let rectWidth;
    let rectHeight;
    const available = resolvePaddedCropArea(boundsLeft, boundsTop, maxCropWidth, maxCropHeight, padding);
    if (aspectRatio === null) {
        rectWidth = Math.max(minCropWidth, available.width);
        rectHeight = Math.max(minCropHeight, available.height);
        rectLeft = Math.min(boundsLeft + maxCropWidth - rectWidth, Math.max(boundsLeft, available.left + (available.width - rectWidth) / 2));
        rectTop = Math.min(boundsTop + maxCropHeight - rectHeight, Math.max(boundsTop, available.top + (available.height - rectHeight) / 2));
    }
    else {
        const fitted = fitAspectRatioInside(available.width, available.height, aspectRatio);
        rectWidth = fitted.width;
        rectHeight = fitted.height;
        rectLeft = available.left + (available.width - rectWidth) / 2;
        rectTop = available.top + (available.height - rectHeight) / 2;
    }
    const cropRect = new context.fabric.Rect({
        left: rectLeft,
        top: rectTop,
        width: rectWidth,
        height: rectHeight,
        originX: 'left',
        originY: 'top',
        fill: CROP_RECT_FILL,
        stroke: CROP_RECT_STROKE,
        strokeDashArray: CROP_RECT_DASH,
        strokeWidth: 1,
        strokeUniform: true,
        selectable: true,
        lockRotation: !allowRotation,
        cornerSize: CROP_RECT_CORNER_SIZE,
        objectCaching: false,
        lockScalingFlip: true,
    });
    updateCropRectControlVisibility(cropRect, aspectRatio, allowRotation);
    canvas.add(cropRect);
    plugins_mask_index.markSessionObject(cropRect, 'cropRect');
    cropRect.isCropRect = true;
    canvas.bringObjectToFront(cropRect);
    canvas.setActiveObject(cropRect);
    const hideMasks = !!options.crop.hideMasksDuringCrop;
    const maskBackups = [];
    if (hideMasks) {
        canvas.getObjects().forEach((object) => {
            if (object === cropRect)
                return;
            if (!plugins_mask_index.isMaskObject(object))
                return;
            maskBackups.push(plugins_mask_index.captureMaskStyleBackup(object));
        });
    }
    const prevEvented = [];
    canvas.getObjects().forEach((object) => {
        var _a, _b;
        if (object === cropRect)
            return;
        prevEvented.push({
            object,
            evented: (_a = object.evented) !== null && _a !== void 0 ? _a : true,
            selectable: (_b = object.selectable) !== null && _b !== void 0 ? _b : true,
        });
        try {
            object.set({ evented: false, selectable: false });
        }
        catch {
        }
    });
    if (hideMasks) {
        for (const backup of maskBackups) {
            plugins_mask_index.applyCropHideMaskStyle(backup.object);
        }
    }
    const handleCropRectModified = () => {
        try {
            const cropWidth = Math.max(1, Number(cropRect.width) || 1);
            const cropHeight = Math.max(1, Number(cropRect.height) || 1);
            let nextScaleX;
            let nextScaleY;
            const activeSession = context.getCropSession();
            const activeAspectRatio = activeSession ? activeSession.aspectRatio : aspectRatio;
            if (activeAspectRatio === null) {
                nextScaleX = Math.min(maxCropWidth / cropWidth, Math.max(minCropWidth / cropWidth, Number(cropRect.scaleX) || 1));
                nextScaleY = Math.min(maxCropHeight / cropHeight, Math.max(minCropHeight / cropHeight, Number(cropRect.scaleY) || 1));
            }
            else {
                const rawScaleX = Math.max(0.0001, Number(cropRect.scaleX) || 1);
                const rawScaleY = Math.max(0.0001, Number(cropRect.scaleY) || 1);
                const basis = chooseAspectRatioResizeBasis(canvas, cropRect, rawScaleX, rawScaleY);
                const constrained = constrainAspectRatioSize(cropWidth * rawScaleX, cropHeight * rawScaleY, basis, activeAspectRatio, minCropWidth, minCropHeight, maxCropWidth, maxCropHeight);
                nextScaleX = constrained.width / cropWidth;
                nextScaleY = constrained.height / cropHeight;
            }
            const scaledWidth = cropWidth * nextScaleX;
            const scaledHeight = cropHeight * nextScaleY;
            const maxLeft = Math.max(boundsLeft, boundsLeft + maxCropWidth - scaledWidth);
            const maxTop = Math.max(boundsTop, boundsTop + maxCropHeight - scaledHeight);
            const nextLeft = Math.min(maxLeft, Math.max(boundsLeft, Number(cropRect.left) || boundsLeft));
            const nextTop = Math.min(maxTop, Math.max(boundsTop, Number(cropRect.top) || boundsTop));
            cropRect.set({
                left: nextLeft,
                top: nextTop,
                scaleX: nextScaleX,
                scaleY: nextScaleY,
            });
            cropRect.setCoords();
            canvas.requestRenderAll();
        }
        catch {
        }
    };
    cropRect.on('modified', handleCropRectModified);
    cropRect.on('moving', handleCropRectModified);
    cropRect.on('scaling', handleCropRectModified);
    const session = {
        beforeJson,
        prevSelection,
        prevEvented,
        maskBackups,
        cropRect,
        aspectRatio,
        handlers: [
            {
                target: cropRect,
                handlers: [
                    { eventName: 'modified', callback: handleCropRectModified },
                    { eventName: 'moving', callback: handleCropRectModified },
                    { eventName: 'scaling', callback: handleCropRectModified },
                ],
            },
        ],
    };
    context.setCropSession(session);
    canvas.renderAll();
}
function setCropAspectRatio(context, aspectRatioInput) {
    const session = context.getCropSession();
    if (!(session === null || session === void 0 ? void 0 : session.cropRect))
        return;
    const aspectRatio = normalizeCropAspectRatio(aspectRatioInput);
    session.aspectRatio = aspectRatio;
    resizeCropRectToAspectRatio(context, session.cropRect, aspectRatio);
    updateCropRectControlVisibility(session.cropRect, aspectRatio, !!context.options.crop.allowRotationOfCropRect);
    context.canvas.setActiveObject(session.cropRect);
    context.canvas.requestRenderAll();
}
function cancelCrop(context) {
    const session = context.getCropSession();
    if (!session)
        return;
    context.canvas.discardActiveObject();
    teardownSession(context, session);
    context.setCropSession(null);
    try {
        context.canvas.renderAll();
    }
    catch {
    }
}
async function applyCrop(context) {
    var _a, _b;
    const session = context.getCropSession();
    if (!session || !session.cropRect)
        return;
    const { canvas } = context;
    canvas.discardActiveObject();
    const beforeJson = session.beforeJson;
    const cropRect = session.cropRect;
    const preserveMasks = !!context.options.crop.preserveMasksAfterCrop;
    try {
        cropRect.setCoords();
        const cropAngle = Number(cropRect.angle) || 0;
        if (!context.options.crop.allowRotationOfCropRect && Math.abs(cropAngle % 360) > 0.01) {
            throw new plugins_transform_index.CropApplyError('applyCrop failed: rotated crop rectangles are disabled.');
        }
        const rectBounds = getCropRectContentBounds(cropRect);
        if (!hasMeaningfulCanvasRegion(rectBounds, canvas.getWidth(), canvas.getHeight())) {
            throw new plugins_transform_index.CropApplyError('applyCrop failed: crop region is empty or outside the canvas.');
        }
        const cropRegion = getClampedCanvasRegion(rectBounds, canvas.getWidth(), canvas.getHeight(), { includePartialPixels: false });
        const preservedRecords = preserveMasks
            ? capturePreservedMasks(canvas, cropRegion, session.maskBackups)
            : [];
        restoreCropObjectState(session);
        removeCropRect(context, session);
        canvas.selection = !!session.prevSelection;
        const cropFormat = resolveCropExportFormat({
            cropExportFileType: context.options.crop.exportFileType,
            currentImageMimeType: (_b = (_a = context.getCurrentImageMimeType) === null || _a === void 0 ? void 0 : _a.call(context)) !== null && _b !== void 0 ? _b : null,
            cropExportQuality: context.options.crop.exportQuality,
            downsampleQuality: context.options.downsampleQuality,
        });
        const exportOptions = {
            format: cropFormat.format,
            multiplier: 1,
            left: cropRegion.left,
            top: cropRegion.top,
            width: cropRegion.width,
            height: cropRegion.height,
        };
        if (cropFormat.quality !== undefined) {
            exportOptions.quality = cropFormat.quality;
        }
        const croppedBase64 = canvas.toDataURL(exportOptions);
        await context.loadImage(croppedBase64);
        if (preservedRecords.length > 0) {
            reapplyPreservedMasks(context, cropRegion, preservedRecords);
            canvas.renderAll();
        }
        const afterJson = context.saveState();
        context.setCropSession(null);
        if (beforeJson && afterJson && beforeJson !== afterJson) {
            context.historyManager.push(new Command(() => context.loadFromState(afterJson), () => context.loadFromState(beforeJson)));
        }
    }
    catch (error) {
        teardownSession(context, session);
        context.setCropSession(null);
        try {
            await context.loadFromState(beforeJson);
        }
        catch (rollbackError) {
            plugins_mask_index.reportWarning(context.options, rollbackError, 'applyCrop rollback failed.');
        }
        if (error instanceof plugins_transform_index.CropApplyError)
            throw error;
        const message = error instanceof Error ? `applyCrop failed: ${error.message}` : 'applyCrop failed';
        throw new plugins_transform_index.CropApplyError(message, error);
    }
}

async function runBusyOperation(access, operation, body) {
    const context = access.buildCallbackContext(operation, false);
    const token = access.beginBusyOperation(operation);
    access.emitBusyChangeIfChanged(context);
    access.updateUi();
    try {
        return await body(context, token);
    }
    finally {
        access.endBusyOperation(token);
        access.emitBusyChangeIfChanged(context);
        access.updateUi();
    }
}
async function runBusyOperationWithoutUi(access, operation, body) {
    const context = access.buildCallbackContext(operation, false);
    const token = access.beginBusyOperation(operation);
    access.emitBusyChangeIfChanged(context);
    try {
        return await body(context, token);
    }
    finally {
        access.endBusyOperation(token);
        access.emitBusyChangeIfChanged(context);
    }
}

function enterCropModeAction(access, options = {}) {
    if (!access.getCanvas() || !access.getOriginalImage())
        return;
    if (access.getCropSession())
        return;
    if (!access.isImageLoaded())
        return;
    if (!access.canRunIdleOperation('enterCropMode'))
        return;
    enterCropMode(access.buildCropControllerContext(), options);
    access.updateUi();
    const callbackContext = access.buildCallbackContext('enterCropMode', false);
    access.emitBusyChangeIfChanged(callbackContext);
    access.emitImageChanged(callbackContext);
}
function setCropAspectRatioAction(access, aspectRatio) {
    if (!access.getCanvas() || !access.getCropSession())
        return;
    if (!access.canRunIdleOperation('setCropAspectRatio'))
        return;
    setCropAspectRatio(access.buildCropControllerContext(), aspectRatio);
    access.updateUi();
    const callbackContext = access.buildCallbackContext('setCropAspectRatio', false);
    access.emitImageChanged(callbackContext);
}
function cancelCropAction(access) {
    const canvas = access.getCanvas();
    if (!canvas || !access.getCropSession())
        return;
    if (!access.canRunIdleOperation('cancelCrop'))
        return;
    cancelCrop(access.buildCropControllerContext());
    access.setCropSession(null);
    access.updateUi();
    canvas.requestRenderAll();
    const callbackContext = access.buildCallbackContext('cancelCrop', false);
    access.emitBusyChangeIfChanged(callbackContext);
    access.emitImageChanged(callbackContext);
}
async function applyCropAction(access) {
    if (!access.getCanvas() || !access.getCropSession())
        return;
    if (!access.canRunIdleOperation('applyCrop'))
        return;
    const hadMasks = access.getMasks().length > 0;
    await runBusyOperation(access.buildBusyOperationAccess(), 'applyCrop', async (callbackContext, operationToken) => {
        await applyCrop(access.buildCropControllerContext(operationToken));
        access.updateInputs();
        access.updateMaskList();
        if (hadMasks || access.getMasks().length > 0) {
            access.emitMasksChanged(callbackContext);
        }
        access.emitImageChanged(callbackContext);
    });
}

function getFiltersRegistry(fabric) {
    var _a;
    return ((_a = fabric.filters) !== null && _a !== void 0 ? _a : {});
}
function createFilter(registry, name, options) {
    const FilterConstructor = registry[name];
    return FilterConstructor ? new FilterConstructor(options) : null;
}
function createMissingFilterError(missing) {
    return new TypeError(`[ImageEditor] Fabric image filter constructor(s) unavailable: ${missing.join(', ')}.`);
}
function reportMissingImageFilters(missing, reportMissing) {
    if (missing.length === 0 || !reportMissing)
        return;
    reportMissing(createMissingFilterError(missing), `Image filter(s) not supported by the active Fabric build: ${missing.join(', ')}.`);
}
function buildFabricImageFilters(fabric, config) {
    const registry = getFiltersRegistry(fabric);
    const filters = [];
    const missing = [];
    const push = (configKey, filterName, options) => {
        const filter = createFilter(registry, filterName, options);
        if (filter)
            filters.push(filter);
        else
            missing.push(configKey);
    };
    if (config.brightness !== 0) {
        push('brightness', 'Brightness', { brightness: config.brightness });
    }
    if (config.contrast !== 0) {
        push('contrast', 'Contrast', { contrast: config.contrast });
    }
    if (config.saturation !== 0) {
        push('saturation', 'Saturation', { saturation: config.saturation });
    }
    if (config.grayscale)
        push('grayscale', 'Grayscale');
    if (config.sepia)
        push('sepia', 'Sepia');
    if (config.vintage)
        push('vintage', 'Vintage');
    if (config.blur > 0)
        push('blur', 'Blur', { blur: config.blur });
    if (config.sharpen > 0) {
        const s = config.sharpen;
        push('sharpen', 'Convolute', {
            matrix: [0, -s, 0, -s, 1 + 4 * s, -s, 0, -s, 0],
        });
    }
    return { filters, missing };
}
function applyImageFilterConfigToImage(fabric, image, config, reportMissing) {
    var _a;
    const imageWithFilters = image;
    const result = buildFabricImageFilters(fabric, config);
    imageWithFilters.filters = result.filters;
    (_a = imageWithFilters.applyFilters) === null || _a === void 0 ? void 0 : _a.call(imageWithFilters);
    imageWithFilters.dirty = true;
    reportMissingImageFilters(result.missing, reportMissing);
    return result;
}
function getFilteredBaseImageDataUrl(image, config, fallback) {
    if (!hasActiveImageFilters(config))
        return fallback;
    try {
        return image.toDataURL({ format: 'png', multiplier: 1 });
    }
    catch {
        return fallback;
    }
}

function computeDownsampleDimensions(srcWidth, srcHeight, maxWidth, maxHeight) {
    if (!isPositiveFinite$1(srcWidth) ||
        !isPositiveFinite$1(srcHeight) ||
        !isPositiveFinite$1(maxWidth) ||
        !isPositiveFinite$1(maxHeight)) {
        return {
            width: Math.max(1, Math.round(srcWidth) || 1),
            height: Math.max(1, Math.round(srcHeight) || 1),
            needsResize: false,
        };
    }
    const needsResize = srcWidth > maxWidth || srcHeight > maxHeight;
    if (!needsResize) {
        return { width: srcWidth, height: srcHeight, needsResize: false };
    }
    const ratio = Math.min(maxWidth / srcWidth, maxHeight / srcHeight);
    return {
        width: Math.max(1, Math.round(srcWidth * ratio)),
        height: Math.max(1, Math.round(srcHeight * ratio)),
        needsResize: true,
    };
}
function isPositiveFinite$1(value) {
    return Number.isFinite(value) && value > 0;
}
function selectDownsampleMimeType(sourceMime, preserveSourceFormat, downsampleMimeType) {
    if (downsampleMimeType)
        return downsampleMimeType;
    if (preserveSourceFormat && (sourceMime === 'image/png' || sourceMime === 'image/webp')) {
        return sourceMime;
    }
    return 'image/jpeg';
}
function detectSourceMimeType(dataUrl) {
    const match = /^data:(image\/[a-z0-9+\-.]+)\s*;/i.exec(dataUrl);
    return match ? match[1].toLowerCase() : null;
}
function resampleImage(imageElement, maxWidth, maxHeight, sourceMime, preserveSourceFormat, downsampleMimeType, quality, ownerDocument) {
    var _a;
    const { width, height } = computeDownsampleDimensions(imageElement.naturalWidth, imageElement.naturalHeight, maxWidth, maxHeight);
    const mimeType = selectDownsampleMimeType(sourceMime, preserveSourceFormat, downsampleMimeType);
    const documentForCanvas = (_a = ownerDocument !== null && ownerDocument !== void 0 ? ownerDocument : imageElement.ownerDocument) !== null && _a !== void 0 ? _a : null;
    if (!documentForCanvas) {
        throw new plugins_transform_index.DownsampleError('Failed to obtain an owner document for downsampling.');
    }
    const offscreenCanvas = documentForCanvas.createElement('canvas');
    offscreenCanvas.width = width;
    offscreenCanvas.height = height;
    const context = offscreenCanvas.getContext('2d');
    if (!context) {
        throw new plugins_transform_index.DownsampleError('Failed to obtain a 2D context for downsampling.');
    }
    context.drawImage(imageElement, 0, 0, imageElement.naturalWidth, imageElement.naturalHeight, 0, 0, width, height);
    const dataUrl = mimeType === 'image/png'
        ? offscreenCanvas.toDataURL(mimeType)
        : offscreenCanvas.toDataURL(mimeType, quality);
    return { dataUrl, width, height, mimeType };
}

const MATRIX_DETERMINANT_EPSILON = 1e-8;
const MATRIX_SCALE_EPSILON = 1e-8;
function toMatrix2D(matrix) {
    if (matrix.length < 6)
        return null;
    const a = matrix[0];
    const b = matrix[1];
    const c = matrix[2];
    const d = matrix[3];
    const e = matrix[4];
    const f = matrix[5];
    if (!Number.isFinite(a) ||
        !Number.isFinite(b) ||
        !Number.isFinite(c) ||
        !Number.isFinite(d) ||
        !Number.isFinite(e) ||
        !Number.isFinite(f)) {
        return null;
    }
    return { a: a, b: b, c: c, d: d, e: e, f: f };
}
function invertMatrix(matrix) {
    const determinant = matrix.a * matrix.d - matrix.b * matrix.c;
    if (!Number.isFinite(determinant) || Math.abs(determinant) < MATRIX_DETERMINANT_EPSILON) {
        return null;
    }
    return {
        a: matrix.d / determinant,
        b: -matrix.b / determinant,
        c: -matrix.c / determinant,
        d: matrix.a / determinant,
        e: (matrix.c * matrix.f - matrix.d * matrix.e) / determinant,
        f: (matrix.b * matrix.e - matrix.a * matrix.f) / determinant,
    };
}
function transformPoint(point, matrix) {
    return {
        x: matrix.a * point.x + matrix.c * point.y + matrix.e,
        y: matrix.b * point.x + matrix.d * point.y + matrix.f,
    };
}
function getSourceRadiusFromMatrix(matrix, canvasRadius) {
    const scaleX = Math.hypot(matrix.a, matrix.b);
    const scaleY = Math.hypot(matrix.c, matrix.d);
    const minScale = Math.min(scaleX > MATRIX_SCALE_EPSILON ? scaleX : Number.POSITIVE_INFINITY, scaleY > MATRIX_SCALE_EPSILON ? scaleY : Number.POSITIVE_INFINITY);
    if (!Number.isFinite(minScale) || minScale <= 0)
        return canvasRadius;
    return canvasRadius / minScale;
}
function getMosaicImagePoint(fabric, image, canvasPoint, brushDiameterCanvasPx) {
    const width = Number(image.width) || 0;
    const height = Number(image.height) || 0;
    const brushDiameter = Number(brushDiameterCanvasPx);
    if (width <= 0 ||
        height <= 0 ||
        !Number.isFinite(canvasPoint.x) ||
        !Number.isFinite(canvasPoint.y) ||
        !Number.isFinite(brushDiameter) ||
        brushDiameter <= 0) {
        return null;
    }
    const matrix = toMatrix2D(image.calcTransformMatrix());
    if (!matrix)
        return null;
    const inverse = invertMatrix(matrix);
    if (!inverse)
        return null;
    const localPoint = transformPoint(canvasPoint, inverse);
    const sourceX = localPoint.x + width / 2;
    const sourceY = localPoint.y + height / 2;
    if (sourceX < 0 || sourceY < 0 || sourceX > width || sourceY > height) {
        return null;
    }
    return {
        sourceX,
        sourceY,
        sourceRadius: getSourceRadiusFromMatrix(matrix, brushDiameter / 2),
    };
}

function normalizeBlockSize(value) {
    return Number.isFinite(value) && value > 0 ? Math.max(1, Math.floor(value)) : 1;
}
function isInsideCircle(x, y, centerX, centerY, radiusSquared) {
    const dx = x - centerX;
    const dy = y - centerY;
    return dx * dx + dy * dy <= radiusSquared;
}
function pixelOffset(width, x, y) {
    return (y * width + x) * 4;
}
function getCircularMosaicBounds(options) {
    const width = Number(options.width);
    const height = Number(options.height);
    const centerX = Number(options.centerX);
    const centerY = Number(options.centerY);
    const radius = Number(options.radius);
    if (!Number.isFinite(width) ||
        !Number.isFinite(height) ||
        !Number.isFinite(centerX) ||
        !Number.isFinite(centerY) ||
        !Number.isFinite(radius) ||
        radius <= 0 ||
        width <= 0 ||
        height <= 0) {
        return null;
    }
    const minX = Math.max(0, Math.floor(centerX - radius));
    const maxX = Math.min(width - 1, Math.ceil(centerX + radius));
    const minY = Math.max(0, Math.floor(centerY - radius));
    const maxY = Math.min(height - 1, Math.ceil(centerY + radius));
    return minX <= maxX && minY <= maxY ? { minX, minY, maxX, maxY } : null;
}
function applyCircularMosaicToImageData(options) {
    var _a, _b, _c, _d;
    const { imageData } = options;
    const { width, height, data } = imageData;
    const centerX = Number(options.centerX);
    const centerY = Number(options.centerY);
    const radius = Number(options.radius);
    const bounds = getCircularMosaicBounds({ width, height, centerX, centerY, radius });
    if (!bounds)
        return false;
    const blockSize = normalizeBlockSize(options.blockSize);
    const { minX, minY, maxX, maxY } = bounds;
    const radiusSquared = radius * radius;
    let processed = false;
    for (let blockY = minY; blockY <= maxY; blockY += blockSize) {
        for (let blockX = minX; blockX <= maxX; blockX += blockSize) {
            const blockMaxX = Math.min(maxX, blockX + blockSize - 1);
            const blockMaxY = Math.min(maxY, blockY + blockSize - 1);
            let sampleOffset = -1;
            for (let y = blockY; y <= blockMaxY && sampleOffset < 0; y += 1) {
                for (let x = blockX; x <= blockMaxX; x += 1) {
                    if (!isInsideCircle(x, y, centerX, centerY, radiusSquared))
                        continue;
                    sampleOffset = pixelOffset(width, x, y);
                    break;
                }
            }
            if (sampleOffset < 0)
                continue;
            const red = (_a = data[sampleOffset]) !== null && _a !== void 0 ? _a : 0;
            const green = (_b = data[sampleOffset + 1]) !== null && _b !== void 0 ? _b : 0;
            const blue = (_c = data[sampleOffset + 2]) !== null && _c !== void 0 ? _c : 0;
            const alpha = (_d = data[sampleOffset + 3]) !== null && _d !== void 0 ? _d : 0;
            for (let y = blockY; y <= blockMaxY; y += 1) {
                for (let x = blockX; x <= blockMaxX; x += 1) {
                    if (!isInsideCircle(x, y, centerX, centerY, radiusSquared))
                        continue;
                    const offset = pixelOffset(width, x, y);
                    data[offset] = red;
                    data[offset + 1] = green;
                    data[offset + 2] = blue;
                    data[offset + 3] = alpha;
                    processed = true;
                }
            }
        }
    }
    return processed;
}

const MAX_PENDING_MOSAIC_POINTS = 4096;
function getCanvasDocument$3(context) {
    var _a, _b, _c, _d, _e;
    const element = (_b = (_a = context.canvas).getElement) === null || _b === void 0 ? void 0 : _b.call(_a);
    return ((_e = (_c = element === null || element === void 0 ? void 0 : element.ownerDocument) !== null && _c !== void 0 ? _c : (_d = context.canvas.lowerCanvasEl) === null || _d === void 0 ? void 0 : _d.ownerDocument) !== null && _e !== void 0 ? _e : document);
}
function safeRender(canvas) {
    try {
        canvas.requestRenderAll();
    }
    catch {
        try {
            canvas.renderAll();
        }
        catch {
        }
    }
}
function createPreviewCircle(context) {
    const config = context.getMosaicConfig();
    const circle = new context.fabric.Circle({
        left: 0,
        top: 0,
        radius: config.brushSize / 2,
        originX: 'center',
        originY: 'center',
        fill: config.previewFill,
        stroke: config.previewStroke,
        strokeWidth: config.previewStrokeWidth,
        strokeDashArray: config.previewStrokeDashArray
            ? [...config.previewStrokeDashArray]
            : undefined,
        selectable: false,
        evented: false,
        excludeFromExport: true,
        objectCaching: false,
        visible: false,
    });
    plugins_mask_index.markSessionObject(circle, 'mosaicPreviewCircle');
    circle.isMosaicPreview = true;
    return circle;
}
function ensurePreviewCircle(context, session) {
    var _a;
    const { canvas } = context;
    const circle = (_a = session.previewCircle) !== null && _a !== void 0 ? _a : createPreviewCircle(context);
    session.previewCircle = circle;
    if (!canvas.getObjects().includes(circle)) {
        canvas.add(circle);
    }
    canvas.bringObjectToFront(circle);
    updateMosaicPreview(context);
    return circle;
}
function removePreviewCircle(context, session) {
    const circle = session.previewCircle;
    if (!circle)
        return;
    try {
        context.canvas.remove(circle);
    }
    catch {
    }
    session.previewCircle = null;
}
function createPreviewImage(context, sourceImage, rasterCache) {
    const image = new context.fabric.FabricImage(rasterCache.offscreenCanvas, {
        selectable: false,
        evented: false,
        excludeFromExport: true,
        objectCaching: false,
        visible: true,
    });
    copyBaseImageProperties(image, sourceImage);
    image.set({
        selectable: false,
        evented: false,
        excludeFromExport: true,
        objectCaching: false,
        visible: true,
    });
    plugins_mask_index.markSessionObject(image, 'mosaicPreviewImage');
    image.isMosaicPreview = true;
    return image;
}
function placePreviewImageAfterBase(context, previewImage, sourceImage) {
    var _a, _b;
    const sourceIndex = context.canvas.getObjects().indexOf(sourceImage);
    if (sourceIndex < 0)
        return;
    try {
        (_b = (_a = context.canvas).moveObjectTo) === null || _b === void 0 ? void 0 : _b.call(_a, previewImage, sourceIndex + 1);
    }
    catch {
    }
}
function ensurePreviewImage(context, session, sourceImage) {
    var _a;
    const rasterCache = session.rasterCache;
    if (!rasterCache)
        return null;
    const previewImage = (_a = session.previewImage) !== null && _a !== void 0 ? _a : createPreviewImage(context, sourceImage, rasterCache);
    session.previewImage = previewImage;
    copyBaseImageProperties(previewImage, sourceImage);
    previewImage.set({
        selectable: false,
        evented: false,
        excludeFromExport: true,
        objectCaching: false,
        visible: true,
    });
    previewImage.dirty = true;
    if (!context.canvas.getObjects().includes(previewImage)) {
        context.canvas.add(previewImage);
    }
    placePreviewImageAfterBase(context, previewImage, sourceImage);
    const circle = session.previewCircle;
    if (circle && context.canvas.getObjects().includes(circle)) {
        context.canvas.bringObjectToFront(circle);
    }
    return previewImage;
}
function removePreviewImage(context, session) {
    const image = session.previewImage;
    if (!image)
        return;
    try {
        context.canvas.remove(image);
    }
    catch {
    }
    session.previewImage = null;
}
function releaseMosaicRasterCache(session) {
    const cache = session.rasterCache;
    if (!cache)
        return;
    try {
        cache.offscreenCanvas.width = 0;
        cache.offscreenCanvas.height = 0;
    }
    catch {
    }
    session.rasterCache = null;
}
async function refreshMosaicRasterCacheFromSource(context, session, source) {
    const rasterCache = session.rasterCache;
    if (!rasterCache)
        return;
    const ownerDocument = getCanvasDocument$3(context);
    const decoded = await decodeImageSource(ownerDocument, source);
    rasterCache.offscreenCanvas.width = decoded.width;
    rasterCache.offscreenCanvas.height = decoded.height;
    const renderingContext = rasterCache.offscreenCanvas.getContext('2d');
    if (!renderingContext) {
        releaseMosaicRasterCache(session);
        return;
    }
    renderingContext.clearRect(0, 0, decoded.width, decoded.height);
    renderingContext.drawImage(decoded.element, 0, 0, decoded.width, decoded.height);
    rasterCache.renderingContext = renderingContext;
    rasterCache.imageData = renderingContext.getImageData(0, 0, decoded.width, decoded.height);
    rasterCache.source = source;
    rasterCache.width = decoded.width;
    rasterCache.height = decoded.height;
}
function hidePreview(context) {
    var _a;
    const circle = (_a = context.getMosaicSession()) === null || _a === void 0 ? void 0 : _a.previewCircle;
    if (!circle)
        return;
    circle.set({ visible: false });
    safeRender(context.canvas);
}
function movePreview(context, point) {
    const session = context.getMosaicSession();
    if (!session)
        return;
    const circle = ensurePreviewCircle(context, session);
    circle.set({ left: point.x, top: point.y, visible: true });
    safeRender(context.canvas);
}
function attachCanvasHandler(context, session, eventName, callback) {
    context.canvas.on(eventName, callback);
    session.handlers.push({ eventName, callback });
}
function detachCanvasHandlers(context, session) {
    for (const record of session.handlers) {
        try {
            context.canvas.off(record.eventName, record.callback);
        }
        catch {
        }
    }
    session.handlers = [];
}
function restoreObjectStates(session) {
    for (const record of session.prevObjectStates) {
        try {
            record.object.set({ evented: record.evented, selectable: record.selectable });
        }
        catch {
        }
    }
    session.prevObjectStates = [];
}
function getImageSource(image) {
    var _a;
    const imageWithSource = image;
    try {
        const src = (_a = imageWithSource.getSrc) === null || _a === void 0 ? void 0 : _a.call(imageWithSource);
        if (typeof src === 'string' && src.length > 0)
            return src;
    }
    catch {
    }
    return typeof imageWithSource.src === 'string' && imageWithSource.src.length > 0
        ? imageWithSource.src
        : null;
}
function getMosaicImageSource(context, image) {
    return getFilteredBaseImageDataUrl(image, context.getCurrentImageFilterConfig(), getImageSource(image));
}
function imageDimension(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : 0;
}
function decodeImageSource(ownerDocument, source) {
    return new Promise((resolve, reject) => {
        const imageElement = ownerDocument.createElement('img');
        const cleanup = () => {
            if (typeof imageElement.removeEventListener === 'function') {
                imageElement.removeEventListener('load', handleLoad);
                imageElement.removeEventListener('error', handleError);
            }
            else {
                imageElement.onload = null;
                imageElement.onerror = null;
            }
        };
        const handleLoad = () => {
            const width = imageDimension(imageElement.naturalWidth || imageElement.width);
            const height = imageDimension(imageElement.naturalHeight || imageElement.height);
            cleanup();
            if (width <= 0 || height <= 0) {
                reject(new Error('Mosaic image decode failed: source image has no dimensions.'));
                return;
            }
            resolve({ element: imageElement, width, height });
        };
        const handleError = (event) => {
            cleanup();
            const message = typeof event === 'string'
                ? `Mosaic image decode failed: ${event}`
                : 'Mosaic image decode failed.';
            reject(new Error(message));
        };
        if (!source.startsWith('data:')) {
            imageElement.crossOrigin = 'anonymous';
        }
        if (typeof imageElement.addEventListener === 'function') {
            imageElement.addEventListener('load', handleLoad, { once: true });
            imageElement.addEventListener('error', handleError, { once: true });
        }
        else {
            imageElement.onload = handleLoad;
            imageElement.onerror = handleError;
        }
        imageElement.src = source;
    });
}
function toSupportedMimeType(mimeType) {
    return mimeType === 'image/jpeg' || mimeType === 'image/png' || mimeType === 'image/webp'
        ? mimeType
        : null;
}
function mimeToFormat(mimeType) {
    if (mimeType === 'image/jpeg')
        return 'jpeg';
    if (mimeType === 'image/webp')
        return 'webp';
    return 'png';
}
function resolveMosaicOutputFormat(context, source) {
    var _a, _b, _c, _d;
    const config = context.getMosaicConfig();
    const requested = config.outputFileType;
    const format = requested === 'source'
        ? mimeToFormat((_b = (_a = context.getCurrentImageMimeType()) !== null && _a !== void 0 ? _a : toSupportedMimeType(detectSourceMimeType(source))) !== null && _b !== void 0 ? _b : 'image/png')
        : ((_c = tryNormalizeImageFormat(String(requested))) !== null && _c !== void 0 ? _c : 'png');
    const mimeType = mimeTypeFor(format);
    if (format === 'png')
        return { mimeType };
    return {
        mimeType,
        quality: (_d = config.outputQuality) !== null && _d !== void 0 ? _d : context.options.downsampleQuality,
    };
}
async function createFabricImageFromDataUrl(context, dataUrl) {
    return await withTimeout(context.fabric.FabricImage.fromURL(dataUrl, { crossOrigin: 'anonymous' }), context.options.imageLoadTimeoutMs, 'Mosaic FabricImage.fromURL');
}
function copyBaseImageProperties(target, source) {
    target.set({
        left: source.left,
        top: source.top,
        scaleX: source.scaleX,
        scaleY: source.scaleY,
        angle: source.angle,
        skewX: source.skewX,
        skewY: source.skewY,
        flipX: source.flipX,
        flipY: source.flipY,
        originX: source.originX,
        originY: source.originY,
        selectable: source.selectable,
        evented: source.evented,
        hasControls: source.hasControls,
        hoverCursor: source.hoverCursor,
    });
    target.setCoords();
}
function replaceBaseImage(context, oldImage, newImage, mimeType) {
    const { canvas } = context;
    let oldRemoved = false;
    let newAdded = false;
    try {
        copyBaseImageProperties(newImage, oldImage);
        canvas.remove(oldImage);
        oldRemoved = true;
        canvas.add(newImage);
        newAdded = true;
        canvas.sendObjectToBack(newImage);
        context.setOriginalImage(plugins_mask_index.markBaseImageObject(newImage));
        context.setCurrentImageMimeType(mimeType);
        canvas.renderAll();
    }
    catch (error) {
        try {
            if (newAdded)
                canvas.remove(newImage);
            if (oldRemoved && !canvas.getObjects().includes(oldImage)) {
                canvas.add(oldImage);
                canvas.sendObjectToBack(oldImage);
            }
            context.setOriginalImage(oldImage);
        }
        catch {
        }
        throw error;
    }
}
function pushMosaicHistory(context, after) {
    var _a;
    const before = (_a = context.getLastSnapshot()) !== null && _a !== void 0 ? _a : after;
    if (!before || !after || before === after)
        return;
    context.historyManager.push(new Command(async () => {
        await context.loadFromState(after);
    }, async () => {
        await context.loadFromState(before);
    }));
    context.setLastSnapshot(after);
}
async function getOrCreateRasterCache(context, session, source) {
    if (session.rasterCache) {
        if (session.rasterCache.source === source)
            return session.rasterCache;
        releaseMosaicRasterCache(session);
    }
    const ownerDocument = getCanvasDocument$3(context);
    const decoded = await decodeImageSource(ownerDocument, source);
    const offscreenCanvas = ownerDocument.createElement('canvas');
    offscreenCanvas.width = decoded.width;
    offscreenCanvas.height = decoded.height;
    const renderingContext = offscreenCanvas.getContext('2d');
    if (!renderingContext) {
        plugins_mask_index.reportError(context.options, new Error('Mosaic could not obtain a 2D canvas context.'), 'Mosaic apply failed.');
        return null;
    }
    renderingContext.drawImage(decoded.element, 0, 0, decoded.width, decoded.height);
    let imageData;
    try {
        imageData = renderingContext.getImageData(0, 0, decoded.width, decoded.height);
    }
    catch (error) {
        plugins_mask_index.reportError(context.options, error, 'Mosaic apply failed because the source image pixels could not be read.');
        return null;
    }
    const rasterCache = {
        offscreenCanvas,
        renderingContext,
        imageData,
        source,
        width: decoded.width,
        height: decoded.height,
    };
    session.rasterCache = rasterCache;
    return rasterCache;
}
function applyMosaicImagePoint(context, session, sourceImage, imagePoint) {
    const rasterCache = session.rasterCache;
    if (!rasterCache)
        return false;
    const config = context.getMosaicConfig();
    const previousPoint = session.lastImagePoint;
    const points = previousPoint
        ? interpolateMosaicPoints(previousPoint, imagePoint)
        : [imagePoint];
    let changed = false;
    let dirtyRect = null;
    for (const point of points) {
        const pointChanged = applyCircularMosaicToImageData({
            imageData: rasterCache.imageData,
            centerX: point.sourceX,
            centerY: point.sourceY,
            radius: point.sourceRadius,
            blockSize: config.blockSize,
        });
        if (!pointChanged)
            continue;
        dirtyRect = mergeMosaicDirtyRects(dirtyRect, getMosaicPointDirtyRect(rasterCache.imageData, point));
        changed = true;
    }
    session.lastImagePoint = imagePoint;
    if (changed) {
        session.hasUncommittedChanges = true;
        putMosaicImageData(rasterCache, dirtyRect);
        ensurePreviewImage(context, session, sourceImage);
        safeRender(context.canvas);
    }
    return changed;
}
function getMosaicPointDirtyRect(imageData, point) {
    return getCircularMosaicBounds({
        width: imageData.width,
        height: imageData.height,
        centerX: point.sourceX,
        centerY: point.sourceY,
        radius: point.sourceRadius,
    });
}
function mergeMosaicDirtyRects(current, next) {
    if (!next)
        return current;
    if (!current)
        return next;
    return {
        minX: Math.min(current.minX, next.minX),
        minY: Math.min(current.minY, next.minY),
        maxX: Math.max(current.maxX, next.maxX),
        maxY: Math.max(current.maxY, next.maxY),
    };
}
function putMosaicImageData(rasterCache, dirtyRect) {
    if (!dirtyRect) {
        rasterCache.renderingContext.putImageData(rasterCache.imageData, 0, 0);
        return;
    }
    rasterCache.renderingContext.putImageData(rasterCache.imageData, 0, 0, dirtyRect.minX, dirtyRect.minY, dirtyRect.maxX - dirtyRect.minX + 1, dirtyRect.maxY - dirtyRect.minY + 1);
}
function interpolateMosaicPoints(start, end) {
    const dx = end.sourceX - start.sourceX;
    const dy = end.sourceY - start.sourceY;
    const distance = Math.hypot(dx, dy);
    const minRadius = Math.min(start.sourceRadius, end.sourceRadius);
    const spacing = Math.max(1, minRadius / 2);
    const steps = Math.max(1, Math.ceil(distance / spacing));
    const points = [];
    for (let index = 1; index <= steps; index += 1) {
        const t = index / steps;
        points.push({
            sourceX: start.sourceX + dx * t,
            sourceY: start.sourceY + dy * t,
            sourceRadius: start.sourceRadius + (end.sourceRadius - start.sourceRadius) * t,
        });
    }
    return points;
}
async function applyMosaicPointToCache(context, expectedSession, canvasPoint) {
    const session = context.getMosaicSession();
    if (!session || session !== expectedSession)
        return;
    const originalImage = context.getOriginalImage();
    if (!originalImage || !context.isImageLoaded())
        return;
    const config = context.getMosaicConfig();
    const imagePoint = getMosaicImagePoint(context.fabric, originalImage, canvasPoint, config.brushSize);
    if (!imagePoint) {
        session.lastImagePoint = null;
        return;
    }
    const source = getMosaicImageSource(context, originalImage);
    if (!source) {
        plugins_mask_index.reportWarning(context.options, new Error('Mosaic cannot read the current image source.'), 'Mosaic skipped because the image source is unavailable.');
        return;
    }
    const rasterCache = await getOrCreateRasterCache(context, session, source);
    if (!rasterCache)
        return;
    applyMosaicImagePoint(context, session, originalImage, imagePoint);
}
async function commitMosaicChanges(context, session, callbackContext) {
    var _a;
    session.commitRequested = false;
    session.lastImagePoint = null;
    if (!session.hasUncommittedChanges || !session.rasterCache)
        return;
    const originalImage = context.getOriginalImage();
    if (!originalImage || !context.isImageLoaded())
        return;
    const source = (_a = getMosaicImageSource(context, originalImage)) !== null && _a !== void 0 ? _a : session.rasterCache.source;
    const rasterCache = session.rasterCache;
    rasterCache.renderingContext.putImageData(rasterCache.imageData, 0, 0);
    const output = resolveMosaicOutputFormat(context, source);
    const nextDataUrl = output.quality === undefined
        ? rasterCache.offscreenCanvas.toDataURL(output.mimeType)
        : rasterCache.offscreenCanvas.toDataURL(output.mimeType, output.quality);
    const nextImage = await createFabricImageFromDataUrl(context, nextDataUrl);
    removePreviewCircle(context, session);
    removePreviewImage(context, session);
    try {
        replaceBaseImage(context, originalImage, nextImage, output.mimeType);
        context.resetImageFilterState();
        const after = context.captureSnapshot();
        pushMosaicHistory(context, after);
        try {
            await refreshMosaicRasterCacheFromSource(context, session, nextDataUrl);
        }
        catch (error) {
            releaseMosaicRasterCache(session);
            plugins_mask_index.reportWarning(context.options, error, 'Mosaic cache refresh failed after commit; the next stroke will rebuild it.');
        }
        session.hasUncommittedChanges = false;
    }
    finally {
        if (context.getMosaicSession() === session) {
            ensurePreviewCircle(context, session);
        }
    }
    context.updateInputs();
    context.updateUi();
    context.emitImageChanged(callbackContext);
}
async function drainMosaicQueue(context, expectedSession) {
    const session = context.getMosaicSession();
    if (!session || session !== expectedSession || session.isApplying)
        return;
    session.isApplying = true;
    const callbackContext = context.buildCallbackContext('applyMosaic', false);
    context.emitBusyChangeIfChanged(callbackContext);
    context.updateUi();
    try {
        while (context.getMosaicSession() === session && session.pendingCanvasPoints.length > 0) {
            const point = session.pendingCanvasPoints.shift();
            if (point) {
                await applyMosaicPointToCache(context, session, point);
            }
        }
        if (context.getMosaicSession() === session && session.commitRequested) {
            await commitMosaicChanges(context, session, callbackContext);
        }
    }
    finally {
        if (context.getMosaicSession() === session) {
            session.isApplying = false;
        }
        context.emitBusyChangeIfChanged(callbackContext);
        context.updateUi();
        if (context.getMosaicSession() === session &&
            (session.pendingCanvasPoints.length > 0 || session.commitRequested)) {
            void drainMosaicQueue(context, session).catch((error) => {
                plugins_mask_index.reportError(context.options, error, 'Mosaic apply failed.');
            });
        }
    }
}
function enqueueMosaicPoint(context, canvasPoint) {
    const session = context.getMosaicSession();
    if (!session)
        return;
    session.pendingCanvasPoints.push(canvasPoint);
    if (session.pendingCanvasPoints.length > MAX_PENDING_MOSAIC_POINTS) {
        session.pendingCanvasPoints.splice(0, session.pendingCanvasPoints.length - MAX_PENDING_MOSAIC_POINTS);
    }
    void drainMosaicQueue(context, session).catch((error) => {
        plugins_mask_index.reportError(context.options, error, 'Mosaic apply failed.');
    });
}
function requestMosaicCommit(context, session) {
    session.commitRequested = true;
    void drainMosaicQueue(context, session).catch((error) => {
        plugins_mask_index.reportError(context.options, error, 'Mosaic apply failed.');
    });
}
function installMosaicHandlers(context, session) {
    attachCanvasHandler(context, session, 'mouse:move', (event) => {
        const pointer = getPointerFromFabricEvent(context.canvas, event);
        if (!pointer) {
            hidePreview(context);
            return;
        }
        movePreview(context, pointer);
        const currentSession = context.getMosaicSession();
        if (currentSession === null || currentSession === void 0 ? void 0 : currentSession.isPointerDown) {
            enqueueMosaicPoint(context, pointer);
        }
    });
    attachCanvasHandler(context, session, 'mouse:out', () => {
        hidePreview(context);
    });
    attachCanvasHandler(context, session, 'mouse:down', (event) => {
        const pointer = getPointerFromFabricEvent(context.canvas, event);
        if (!pointer)
            return;
        const currentSession = context.getMosaicSession();
        if (!currentSession)
            return;
        currentSession.isPointerDown = true;
        currentSession.lastImagePoint = null;
        enqueueMosaicPoint(context, pointer);
    });
    attachCanvasHandler(context, session, 'mouse:up', (event) => {
        const currentSession = context.getMosaicSession();
        if (!currentSession)
            return;
        const pointer = getPointerFromFabricEvent(context.canvas, event);
        if (pointer) {
            movePreview(context, pointer);
            enqueueMosaicPoint(context, pointer);
        }
        currentSession.isPointerDown = false;
        requestMosaicCommit(context, currentSession);
    });
}
function enterMosaicMode(context) {
    if (context.getMosaicSession())
        return;
    if (!context.isImageLoaded() || !context.getOriginalImage())
        return;
    const { canvas } = context;
    context.hideAllMaskLabels();
    canvas.discardActiveObject();
    const prevSelection = !!canvas.selection;
    const prevDefaultCursor = canvas.defaultCursor;
    const prevObjectStates = canvas.getObjects().map((object) => {
        var _a, _b;
        return ({
            object,
            evented: (_a = object.evented) !== null && _a !== void 0 ? _a : true,
            selectable: (_b = object.selectable) !== null && _b !== void 0 ? _b : true,
        });
    });
    for (const record of prevObjectStates) {
        try {
            record.object.set({ evented: false, selectable: false });
        }
        catch {
        }
    }
    canvas.selection = false;
    canvas.defaultCursor = 'crosshair';
    const session = {
        previewCircle: null,
        previewImage: null,
        prevSelection,
        prevDefaultCursor,
        prevObjectStates,
        handlers: [],
        rasterCache: null,
        pendingCanvasPoints: [],
        isPointerDown: false,
        isApplying: false,
        commitRequested: false,
        hasUncommittedChanges: false,
        lastImagePoint: null,
    };
    context.setMosaicSession(session);
    ensurePreviewCircle(context, session);
    installMosaicHandlers(context, session);
    canvas.renderAll();
}
function exitMosaicMode(context) {
    var _a;
    const session = context.getMosaicSession();
    if (!session)
        return;
    detachCanvasHandlers(context, session);
    removePreviewCircle(context, session);
    removePreviewImage(context, session);
    releaseMosaicRasterCache(session);
    restoreObjectStates(session);
    context.canvas.selection = !!session.prevSelection;
    context.canvas.defaultCursor = (_a = session.prevDefaultCursor) !== null && _a !== void 0 ? _a : 'default';
    context.setMosaicSession(null);
    context.canvas.renderAll();
}
function updateMosaicPreview(context) {
    const session = context.getMosaicSession();
    const circle = session === null || session === void 0 ? void 0 : session.previewCircle;
    if (!session || !circle)
        return;
    const config = context.getMosaicConfig();
    circle.set({
        radius: config.brushSize / 2,
        fill: config.previewFill,
        stroke: config.previewStroke,
        strokeWidth: config.previewStrokeWidth,
        strokeDashArray: config.previewStrokeDashArray
            ? [...config.previewStrokeDashArray]
            : undefined,
    });
    context.canvas.bringObjectToFront(circle);
    safeRender(context.canvas);
}

function enterMosaicModeAction(access) {
    if (!access.getCanvas() || !access.getOriginalImage())
        return;
    if (access.getMosaicSession())
        return;
    if (!access.isImageLoaded())
        return;
    if (!access.canRunIdleOperation('enterMosaicMode'))
        return;
    enterMosaicMode(access.buildMosaicControllerContext());
    access.updateInputs();
    access.updateUi();
    const callbackContext = access.buildCallbackContext('enterMosaicMode', false);
    access.emitBusyChangeIfChanged(callbackContext);
    access.emitImageChanged(callbackContext);
}
function exitMosaicModeAction(access) {
    if (!access.getCanvas() || !access.getMosaicSession())
        return;
    if (!access.canRunIdleOperation('exitMosaicMode'))
        return;
    exitMosaicMode(access.buildMosaicControllerContext());
    access.updateInputs();
    access.updateUi();
    const callbackContext = access.buildCallbackContext('exitMosaicMode', false);
    access.emitBusyChangeIfChanged(callbackContext);
    access.emitImageChanged(callbackContext);
}
function resetMosaicConfigAction(access) {
    if (access.isDisposed())
        return;
    const nextConfig = cloneResolvedMosaicConfig(access.getDefaultMosaicConfig());
    if (areResolvedMosaicConfigsEqual(access.getMosaicConfig(), nextConfig))
        return;
    access.setMosaicConfig(nextConfig);
    updateActivePreview(access);
    access.updateInputs();
    access.updateUi();
    access.emitImageChanged(access.buildCallbackContext('resetMosaicConfig', false));
}
function applyMosaicConfigPatchAction(access, config, operation) {
    if (access.isDisposed())
        return;
    if (config === null || typeof config !== 'object' || Array.isArray(config)) {
        plugins_mask_index.reportWarning(access.getOptions(), new TypeError('[ImageEditor] Invalid Mosaic config object.'), 'Ignored invalid Mosaic config.');
        return;
    }
    const invalidFields = getInvalidMosaicConfigFields(config);
    if (invalidFields.length > 0) {
        plugins_mask_index.reportWarning(access.getOptions(), new TypeError(`[ImageEditor] Ignored invalid Mosaic config field(s): ` +
            `${invalidFields.join(', ')}.`), 'Ignored invalid Mosaic config fields.');
    }
    const nextConfig = mergeMosaicConfigPatch(access.getMosaicConfig(), config);
    if (areResolvedMosaicConfigsEqual(access.getMosaicConfig(), nextConfig))
        return;
    access.setMosaicConfig(nextConfig);
    updateActivePreview(access);
    access.updateInputs();
    access.updateUi();
    access.emitImageChanged(access.buildCallbackContext(operation, false));
}
function updateActivePreview(access) {
    if (access.getMosaicSession() && access.getCanvas()) {
        updateMosaicPreview(access.buildMosaicControllerContext());
    }
}

function startImageElementLoad(dataUrl, options) {
    const imageElement = new Image();
    if (options.crossOrigin !== undefined) {
        imageElement.crossOrigin = options.crossOrigin;
    }
    const cleanup = (clearSource = false) => {
        if (typeof imageElement.removeEventListener === 'function') {
            imageElement.removeEventListener('load', handleLoad);
            imageElement.removeEventListener('error', handleError);
        }
        else {
            imageElement.onload = null;
            imageElement.onerror = null;
        }
        if (clearSource) {
            try {
                imageElement.src = '';
            }
            catch {
            }
        }
    };
    const handleLoad = () => {
        var _a, _b;
        const validationError = (_b = (_a = options.validate) === null || _a === void 0 ? void 0 : _a.call(options, imageElement)) !== null && _b !== void 0 ? _b : null;
        if (validationError) {
            cleanup(true);
            rejectImage(validationError);
            return;
        }
        cleanup(false);
        resolveImage(imageElement);
    };
    const handleError = (event) => {
        cleanup(true);
        rejectImage(options.createError(event));
    };
    let resolveImage;
    let rejectImage;
    const promise = new Promise((resolve, reject) => {
        resolveImage = resolve;
        rejectImage = reject;
        if (typeof imageElement.addEventListener === 'function') {
            imageElement.addEventListener('load', handleLoad, { once: true });
            imageElement.addEventListener('error', handleError, { once: true });
        }
        else {
            imageElement.onload = handleLoad;
            imageElement.onerror = handleError;
        }
        imageElement.src = dataUrl;
    });
    return { promise, cleanup };
}

function createMergeError(operation, error) {
    if (operation === 'mergeAnnotations') {
        if (error instanceof plugins_transform_index.MergeAnnotationsError)
            return error;
        const message = error instanceof Error
            ? `mergeAnnotations failed: ${error.message}`
            : 'mergeAnnotations failed';
        return new plugins_transform_index.MergeAnnotationsError(message, error);
    }
    if (error instanceof plugins_transform_index.MergeMasksError)
        return error;
    const message = error instanceof Error ? `mergeMasks failed: ${error.message}` : 'mergeMasks failed';
    return new plugins_transform_index.MergeMasksError(message, error);
}
function detachObjects(canvas, objects) {
    for (const object of objects) {
        if (!canvas.getObjects().includes(object))
            continue;
        canvas.remove(object);
    }
    canvas.discardActiveObject();
    canvas.renderAll();
}
async function flattenOverlayGroupToBaseImage(context, options) {
    if (!context.isImageLoaded())
        return;
    if (options.getTargets().length === 0)
        return;
    const beforeSnapshot = context.captureSnapshot();
    const preservedObjects = options.getPreservedObjects();
    const preScrollTop = context.containerElement ? context.containerElement.scrollTop : null;
    const preScrollLeft = context.containerElement ? context.containerElement.scrollLeft : null;
    try {
        const detachPreservedObjects = async () => {
            detachObjects(context.canvas, preservedObjects);
        };
        if (context.withSelectionChangeSuppressed) {
            await context.withSelectionChangeSuppressed(detachPreservedObjects);
        }
        else {
            await detachPreservedObjects();
        }
        const exportedDataUrl = await context.exportImageBase64(options.exportOptions);
        if (!exportedDataUrl) {
            throw createMergeError(options.operation, `${options.operation}: exportImageBase64 returned an empty data URL.`);
        }
        options.removeTargetsNoHistory();
        await context.loadImage(exportedDataUrl, { preserveScroll: true });
        await options.restorePreservedObjects(preservedObjects);
        plugins_mask_index.normalizeLayerOrder(context.canvas);
        context.canvas.renderAll();
        context.updateInputs();
        context.updateUi();
        if (context.containerElement) {
            try {
                if (preScrollTop !== null)
                    context.containerElement.scrollTop = preScrollTop;
                if (preScrollLeft !== null)
                    context.containerElement.scrollLeft = preScrollLeft;
            }
            catch (scrollError) {
                plugins_mask_index.reportWarning(context.options, scrollError, `${options.operation}: scroll restore failed.`);
            }
        }
        const afterSnapshot = context.captureSnapshot();
        if (beforeSnapshot && afterSnapshot && beforeSnapshot !== afterSnapshot) {
            context.historyManager.push(new Command(() => context.loadFromState(afterSnapshot), () => context.loadFromState(beforeSnapshot)));
        }
    }
    catch (error) {
        try {
            await context.loadFromState(beforeSnapshot);
        }
        catch (rollbackError) {
            plugins_mask_index.reportWarning(context.options, rollbackError, `${options.operation}: rollback failed.`);
        }
        throw createMergeError(options.operation, error);
    }
}

const DOWNLOAD_OBJECT_URL_REVOKE_DELAY_MS = 30000;
function resolveMultiplier(requested, fallback) {
    const num = Number(requested);
    if (Number.isFinite(num) && num > 0)
        return num;
    const fallbackValue = Number(fallback);
    return Number.isFinite(fallbackValue) && fallbackValue > 0 ? fallbackValue : 1;
}
function resolveExportArea(requested, fallback) {
    if (requested === 'canvas' || requested === 'image')
        return requested;
    return fallback === 'canvas' ? 'canvas' : 'image';
}
function resolveExportOptions(context, options) {
    const providedOptions = options !== null && options !== void 0 ? options : {};
    return {
        exportArea: resolveExportArea(providedOptions.exportArea, context.options.exportAreaByDefault),
        mergeMasks: typeof providedOptions.mergeMasks === 'boolean'
            ? providedOptions.mergeMasks
            : context.options.mergeMasksByDefault,
        mergeAnnotations: typeof providedOptions.mergeAnnotations === 'boolean'
            ? providedOptions.mergeAnnotations
            : context.options.mergeAnnotationsByDefault,
        multiplier: resolveMultiplier(providedOptions.multiplier, context.options.exportMultiplier),
        format: resolveExportFormat(providedOptions, context.options.downsampleQuality),
    };
}
function readCanvasDimension(canvas, getterName, propertyName) {
    const canvasLike = canvas;
    const getter = canvasLike[getterName];
    const value = typeof getter === 'function' ? getter.call(canvasLike) : canvasLike[propertyName];
    return Math.max(1, Math.ceil(Number.isFinite(value) ? Number(value) : 1));
}
function assertExportPixelBudget(context, multiplier, region) {
    var _a, _b;
    const sourceWidth = (_a = region === null || region === void 0 ? void 0 : region.width) !== null && _a !== void 0 ? _a : readCanvasDimension(context.canvas, 'getWidth', 'width');
    const sourceHeight = (_b = region === null || region === void 0 ? void 0 : region.height) !== null && _b !== void 0 ? _b : readCanvasDimension(context.canvas, 'getHeight', 'height');
    const outputWidth = Math.max(1, Math.ceil(sourceWidth * multiplier));
    const outputHeight = Math.max(1, Math.ceil(sourceHeight * multiplier));
    const pixelCount = outputWidth * outputHeight;
    const maxPixels = context.options.maxExportPixels;
    const maxDimension = context.options.maxExportDimension;
    if (!Number.isFinite(pixelCount) || pixelCount > maxPixels) {
        throw new RangeError(`[ImageEditor] Export size ${outputWidth}x${outputHeight} ` +
            `(${pixelCount} pixels) exceeds maxExportPixels (${maxPixels}).`);
    }
    if (outputWidth > maxDimension || outputHeight > maxDimension) {
        throw new RangeError(`[ImageEditor] Export size ${outputWidth}x${outputHeight} ` +
            `exceeds maxExportDimension (${maxDimension}).`);
    }
}
function computeExportRegion(context, exportArea) {
    if (exportArea === 'canvas')
        return { region: null, partialEdges: null };
    const originalImage = context.getOriginalImage();
    if (!originalImage)
        return { region: null, partialEdges: null };
    const bounds = getObjectBBox(originalImage);
    const canvasLike = context.canvas;
    const canvasWidth = typeof canvasLike.getWidth === 'function' ? canvasLike.getWidth() : canvasLike.width;
    const canvasHeight = typeof canvasLike.getHeight === 'function' ? canvasLike.getHeight() : canvasLike.height;
    if (!hasMeaningfulCanvasRegion(bounds, canvasWidth, canvasHeight)) {
        throw new plugins_transform_index.ExportError('exportImageBase64 failed: image export region is empty.');
    }
    return {
        region: getClampedCanvasRegion(bounds, canvasWidth, canvasHeight, {
            includePartialPixels: true,
        }),
        partialEdges: getPartialExportEdges(bounds, Number(originalImage.angle) || 0),
    };
}
async function withMaskExportState(context, mergeMasks, callback) {
    if (!mergeMasks) {
        return withObjectsHidden(context.canvas, plugins_mask_index.isMaskObject, callback);
    }
    return plugins_mask_index.withMaskStyleBackup({ canvas: context.canvas, options: context.options }, applyExportBakeInStyle, callback);
}
async function withObjectsHidden(canvas, predicate, callback) {
    const backups = getCanvasObjects(canvas)
        .filter(predicate)
        .map((object) => {
        var _a;
        return ({
            object,
            visible: (_a = object.visible) !== null && _a !== void 0 ? _a : true,
        });
    });
    for (const backup of backups) {
        try {
            if (typeof backup.object.set === 'function') {
                backup.object.set({ visible: false });
            }
            else {
                backup.object.visible = false;
            }
        }
        catch {
        }
    }
    try {
        return await callback();
    }
    finally {
        for (const backup of backups) {
            try {
                if (typeof backup.object.set === 'function') {
                    backup.object.set({ visible: backup.visible });
                }
                else {
                    backup.object.visible = backup.visible;
                }
            }
            catch {
            }
        }
        requestRender(canvas);
    }
}
async function withSessionObjectsHidden(context, callback) {
    return withObjectsHidden(context.canvas, (object) => plugins_mask_index.isSessionObject(object) ||
        object.isCropRect === true ||
        object.maskLabel === true ||
        object.isMosaicPreview === true, callback);
}
async function withAnnotationsExportState(context, mergeAnnotations, callback) {
    if (!mergeAnnotations) {
        return withObjectsHidden(context.canvas, plugins_mask_index.isAnnotationObject, callback);
    }
    return withObjectsHidden(context.canvas, (object) => plugins_mask_index.isAnnotationObject(object) && object.annotationHidden === true, callback);
}
function getCanvasObjects(canvas) {
    try {
        return canvas.getObjects();
    }
    catch {
        return [];
    }
}
function isObjectOnCanvas(canvas, object) {
    return getCanvasObjects(canvas).includes(object);
}
function captureMaskLabelBackups(canvas) {
    var _a;
    const backups = [];
    for (const object of getCanvasObjects(canvas)) {
        if (!plugins_mask_index.isMaskObject(object))
            continue;
        const label = object.labelObject;
        if (!label)
            continue;
        const wasOnCanvas = isObjectOnCanvas(canvas, label);
        backups.push({
            mask: object,
            label,
            wasOnCanvas,
            visible: (_a = label.visible) !== null && _a !== void 0 ? _a : true,
        });
        try {
            if (typeof label.set === 'function')
                label.set({ visible: false });
            if (wasOnCanvas)
                canvas.remove(label);
        }
        catch {
        }
    }
    return backups;
}
function restoreMaskLabelBackups(canvas, backups) {
    for (const backup of backups) {
        try {
            backup.mask.labelObject = backup.label;
            if (typeof backup.label.set === 'function') {
                backup.label.set({ visible: backup.visible });
            }
            else {
                backup.label.visible = backup.visible;
            }
            if (backup.wasOnCanvas && !isObjectOnCanvas(canvas, backup.label)) {
                canvas.add(backup.label);
                canvas.bringObjectToFront(backup.label);
            }
        }
        catch {
        }
    }
}
function captureActiveObject(canvas) {
    var _a;
    try {
        const canvasWithSelection = canvas;
        if (typeof canvasWithSelection.getActiveObject !== 'function')
            return null;
        return (_a = canvasWithSelection.getActiveObject()) !== null && _a !== void 0 ? _a : null;
    }
    catch {
        return null;
    }
}
function restoreActiveObject(canvas, activeObject) {
    if (!activeObject)
        return;
    if (!canvas.getObjects().includes(activeObject))
        return;
    try {
        const canvasWithSelection = canvas;
        if (typeof canvasWithSelection.setActiveObject === 'function') {
            canvasWithSelection.setActiveObject(activeObject);
        }
    }
    catch {
    }
}
function requestRender(canvas) {
    try {
        if (typeof canvas.requestRenderAll === 'function') {
            canvas.requestRenderAll();
        }
        else {
            canvas.renderAll();
        }
    }
    catch {
    }
}
function applyExportBakeInStyle(mask) {
    try {
        mask.set({
            opacity: 1,
            fill: '#000',
            strokeWidth: 0,
            stroke: null,
            selectable: false,
        });
        if (typeof mask.setCoords === 'function')
            mask.setCoords();
    }
    catch {
    }
}
function renderCanvasToDataUrl(canvas, format, quality, multiplier, region) {
    const fabricOptions = {
        format,
        multiplier,
    };
    if (quality !== undefined)
        fabricOptions.quality = quality;
    if (region) {
        fabricOptions.left = region.left;
        fabricOptions.top = region.top;
        fabricOptions.width = region.width;
        fabricOptions.height = region.height;
    }
    return canvas.toDataURL(fabricOptions);
}
function hasPartialEdges(edges) {
    return !!edges && (edges.left || edges.top || edges.right || edges.bottom);
}
function getImageDimensions(imageElement) {
    return {
        width: Math.max(1, imageElement.naturalWidth || imageElement.width || 1),
        height: Math.max(1, imageElement.naturalHeight || imageElement.height || 1),
    };
}
function loadImageElement(dataUrl) {
    return startImageElementLoad(dataUrl, {
        crossOrigin: 'anonymous',
        createError: () => new Error('Failed to decode export data URL'),
    }).promise;
}
function sealPartialTransparentEdges(canvasContext, width, height, edges) {
    if (!hasPartialEdges(edges))
        return;
    const imageData = canvasContext.getImageData(0, 0, width, height);
    const pixels = imageData.data;
    const sealPixel = (x, y, fallbackX, fallbackY) => {
        var _a, _b, _c, _d, _e, _f;
        const index = (y * width + x) * 4;
        const fallbackIndex = (fallbackY * width + fallbackX) * 4;
        const alpha = (_a = pixels[index + 3]) !== null && _a !== void 0 ? _a : 0;
        const fallbackAlpha = (_b = pixels[fallbackIndex + 3]) !== null && _b !== void 0 ? _b : 0;
        if (alpha === 0 && fallbackAlpha > 0) {
            pixels[index] = (_c = pixels[fallbackIndex]) !== null && _c !== void 0 ? _c : 0;
            pixels[index + 1] = (_d = pixels[fallbackIndex + 1]) !== null && _d !== void 0 ? _d : 0;
            pixels[index + 2] = (_e = pixels[fallbackIndex + 2]) !== null && _e !== void 0 ? _e : 0;
            pixels[index + 3] = fallbackAlpha;
        }
        const nextAlpha = (_f = pixels[index + 3]) !== null && _f !== void 0 ? _f : 0;
        if (nextAlpha > 0 && nextAlpha < 255) {
            pixels[index + 3] = 255;
        }
    };
    if ((edges === null || edges === void 0 ? void 0 : edges.left) && width > 1) {
        for (let y = 0; y < height; y += 1)
            sealPixel(0, y, 1, y);
    }
    if ((edges === null || edges === void 0 ? void 0 : edges.right) && width > 1) {
        for (let y = 0; y < height; y += 1)
            sealPixel(width - 1, y, width - 2, y);
    }
    if ((edges === null || edges === void 0 ? void 0 : edges.top) && height > 1) {
        for (let x = 0; x < width; x += 1)
            sealPixel(x, 0, x, 1);
    }
    if ((edges === null || edges === void 0 ? void 0 : edges.bottom) && height > 1) {
        for (let x = 0; x < width; x += 1)
            sealPixel(x, height - 1, x, height - 2);
    }
    if ((edges === null || edges === void 0 ? void 0 : edges.left) && (edges === null || edges === void 0 ? void 0 : edges.top) && width > 1 && height > 1) {
        sealPixel(0, 0, 1, 1);
    }
    if ((edges === null || edges === void 0 ? void 0 : edges.right) && (edges === null || edges === void 0 ? void 0 : edges.top) && width > 1 && height > 1) {
        sealPixel(width - 1, 0, width - 2, 1);
    }
    if ((edges === null || edges === void 0 ? void 0 : edges.left) && (edges === null || edges === void 0 ? void 0 : edges.bottom) && width > 1 && height > 1) {
        sealPixel(0, height - 1, 1, height - 2);
    }
    if ((edges === null || edges === void 0 ? void 0 : edges.right) && (edges === null || edges === void 0 ? void 0 : edges.bottom) && width > 1 && height > 1) {
        sealPixel(width - 1, height - 1, width - 2, height - 2);
    }
    canvasContext.putImageData(imageData, 0, 0);
}
function getJpegBackgroundColor(backgroundColor, ownerDocument) {
    return resolveCanvasFillStyle(backgroundColor, ownerDocument);
}
const colorValidationContexts = new WeakMap();
function resolveCanvasFillStyle(backgroundColor, ownerDocument, fallback = '#ffffff') {
    var _a, _b;
    const value = String(backgroundColor !== null && backgroundColor !== void 0 ? backgroundColor : '').trim();
    if (!value || isTransparentCssColor(value))
        return '#ffffff';
    const css = (_b = (_a = ownerDocument.defaultView) === null || _a === void 0 ? void 0 : _a.CSS) !== null && _b !== void 0 ? _b : globalThis.CSS;
    const supportsColor = typeof (css === null || css === void 0 ? void 0 : css.supports) === 'function' ? css.supports('color', value) : null;
    if (supportsColor === false)
        return fallback;
    const context = createColorValidationContext(ownerDocument);
    if (!context)
        return supportsColor === true ? value : fallback;
    if (supportsColor === true) {
        context.fillStyle = value;
        return context.fillStyle;
    }
    context.fillStyle = '#000001';
    const firstSentinel = context.fillStyle;
    context.fillStyle = value;
    const firstResolved = context.fillStyle;
    if (firstResolved !== firstSentinel)
        return firstResolved;
    context.fillStyle = '#000002';
    const secondSentinel = context.fillStyle;
    context.fillStyle = value;
    const secondResolved = context.fillStyle;
    if (secondResolved !== secondSentinel)
        return secondResolved;
    return fallback;
}
function createColorValidationContext(ownerDocument) {
    var _a;
    if (colorValidationContexts.has(ownerDocument)) {
        return (_a = colorValidationContexts.get(ownerDocument)) !== null && _a !== void 0 ? _a : null;
    }
    try {
        const context = ownerDocument.createElement('canvas').getContext('2d');
        colorValidationContexts.set(ownerDocument, context);
        return context;
    }
    catch {
        colorValidationContexts.set(ownerDocument, null);
        return null;
    }
}
function detectDataUrlMimeType(dataUrl) {
    var _a, _b;
    const match = /^data:([^;,]+)(?:[;,])/i.exec(dataUrl);
    return (_b = (_a = match === null || match === void 0 ? void 0 : match[1]) === null || _a === void 0 ? void 0 : _a.toLowerCase()) !== null && _b !== void 0 ? _b : null;
}
function assertDataUrlMimeType(dataUrl, target, operation) {
    const actualMimeType = detectDataUrlMimeType(dataUrl);
    if (actualMimeType !== target.mimeType) {
        throw new plugins_transform_index.ExportError(`${operation} failed: browser encoded ${actualMimeType !== null && actualMimeType !== void 0 ? actualMimeType : 'unknown MIME'} instead of requested ${target.mimeType}.`);
    }
}
function encodeCanvasAsDataUrl(canvas, target, operation) {
    const encoded = target.quality === undefined
        ? canvas.toDataURL(target.mimeType)
        : canvas.toDataURL(target.mimeType, target.quality);
    assertDataUrlMimeType(encoded, target, operation);
    return encoded;
}
function getCanvasDocument$2(canvas) {
    var _a, _b, _c, _d;
    const canvasLike = canvas;
    const ownerDocument = (_c = (_b = (_a = canvasLike.getElement) === null || _a === void 0 ? void 0 : _a.call(canvasLike)) === null || _b === void 0 ? void 0 : _b.ownerDocument) !== null && _c !== void 0 ? _c : (_d = canvasLike.lowerCanvasEl) === null || _d === void 0 ? void 0 : _d.ownerDocument;
    if (ownerDocument)
        return ownerDocument;
    if (typeof document !== 'undefined')
        return document;
    throw new Error('Document is unavailable for export canvas creation.');
}
function isTransparentCssColor(value) {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'transparent')
        return true;
    const hex = normalized.match(/^#([0-9a-f]{4}|[0-9a-f]{8})$/i);
    if (hex) {
        const digits = hex[1];
        const alpha = digits.length === 4 ? digits[3] : digits.slice(6, 8);
        return /^0+$/.test(alpha);
    }
    const commaAlpha = normalized.match(/^(?:rgba|hsla)\(([^)]{0,200}),\s*([^,/)]{0,50})\)$/i);
    if (commaAlpha && isZeroCssAlpha(commaAlpha[2]))
        return true;
    const slashAlpha = normalized.match(/^[a-z][a-z0-9-]*\([^/]+\/\s*([^)]+)\)$/i);
    if (slashAlpha && isZeroCssAlpha(slashAlpha[1]))
        return true;
    return false;
}
function isZeroCssAlpha(value) {
    const alpha = value.trim();
    if (alpha.endsWith('%')) {
        const numericPercent = Number.parseFloat(alpha.slice(0, -1));
        return Number.isFinite(numericPercent) && numericPercent === 0;
    }
    const numericAlpha = Number.parseFloat(alpha);
    return Number.isFinite(numericAlpha) && numericAlpha === 0;
}
async function postProcessRegionDataUrl(dataUrl, edges, target, backgroundColor, ownerDocument) {
    const shouldSealEdges = hasPartialEdges(edges);
    const shouldCompositeJpegBackground = target.format === 'jpeg';
    if (!shouldSealEdges && !shouldCompositeJpegBackground)
        return dataUrl;
    const imageElement = await loadImageElement(dataUrl);
    const { width, height } = getImageDimensions(imageElement);
    const offscreenCanvas = ownerDocument.createElement('canvas');
    offscreenCanvas.width = width;
    offscreenCanvas.height = height;
    const canvasContext = offscreenCanvas.getContext('2d');
    if (!canvasContext)
        throw new Error('2D canvas context is unavailable');
    canvasContext.drawImage(imageElement, 0, 0, width, height);
    if (shouldSealEdges) {
        sealPartialTransparentEdges(canvasContext, width, height, edges);
    }
    if (shouldCompositeJpegBackground) {
        canvasContext.globalCompositeOperation = 'destination-over';
        canvasContext.fillStyle = getJpegBackgroundColor(backgroundColor, ownerDocument);
        canvasContext.fillRect(0, 0, width, height);
        canvasContext.globalCompositeOperation = 'source-over';
    }
    return encodeCanvasAsDataUrl(offscreenCanvas, target, 'exportImageBase64');
}
function dataUrlToBytes(dataUrl) {
    var _a;
    const match = /^data:image\/[a-z0-9.+-]+;base64,([A-Za-z0-9+/=]+)$/i.exec(dataUrl);
    const base64 = (_a = match === null || match === void 0 ? void 0 : match[1]) !== null && _a !== void 0 ? _a : '';
    if (!base64) {
        throw new Error('exportImageFile received a malformed or empty image data URL.');
    }
    if (typeof globalThis.atob === 'function') {
        const binary = globalThis.atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index += 1) {
            bytes[index] = binary.charCodeAt(index);
        }
        return bytes;
    }
    const bufferCtor = globalThis.Buffer;
    if (bufferCtor && typeof bufferCtor.from === 'function') {
        const source = bufferCtor.from(base64, 'base64');
        const buffer = new ArrayBuffer(source.length);
        const bytes = new Uint8Array(buffer);
        bytes.set(source);
        return bytes;
    }
    throw new Error('No base64 decoder is available for exportImageFile.');
}
async function reencodeDataUrlAs(sourceDataUrl, target, backgroundColor, canvas) {
    if (detectDataUrlMimeType(sourceDataUrl) === target.mimeType) {
        return sourceDataUrl;
    }
    const imageElement = await loadImageElement(sourceDataUrl);
    const { width, height } = getImageDimensions(imageElement);
    const ownerDocument = getCanvasDocument$2(canvas);
    const offscreenCanvas = ownerDocument.createElement('canvas');
    offscreenCanvas.width = width;
    offscreenCanvas.height = height;
    const canvasContext = offscreenCanvas.getContext('2d');
    if (!canvasContext) {
        throw new Error('Unable to acquire 2D context for export conversion');
    }
    if (target.format === 'jpeg') {
        canvasContext.fillStyle = getJpegBackgroundColor(backgroundColor, ownerDocument);
        canvasContext.fillRect(0, 0, width, height);
    }
    canvasContext.drawImage(imageElement, 0, 0, width, height);
    return encodeCanvasAsDataUrl(offscreenCanvas, target, 'exportImageFile');
}
function warnNoImageLoaded(options, operation) {
    plugins_mask_index.reportWarning(options, null, `${operation} skipped: no image is loaded on the canvas.`);
}
function extensionForFormat(format) {
    return format === 'jpeg' ? 'jpg' : format;
}
const MAX_EXPORT_FILE_BASENAME_LENGTH = 120;
function replaceUnsafeFileNameCharacters(value) {
    let output = '';
    let lastWasReplacement = false;
    for (const char of value) {
        const code = char.charCodeAt(0);
        const unsafe = code <= 31 || code === 127 || '<>:"|?*'.includes(char);
        if (unsafe) {
            if (!lastWasReplacement)
                output += '_';
            lastWasReplacement = true;
            continue;
        }
        output += char;
        lastWasReplacement = false;
    }
    return output;
}
function sanitizeFileNameBase(value) {
    const withoutPathSeparators = value.replace(/[\\/]+/g, '_');
    const sanitized = replaceUnsafeFileNameCharacters(withoutPathSeparators)
        .replace(/\.\.+/g, '.')
        .replace(/^\.+|\.+$/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, MAX_EXPORT_FILE_BASENAME_LENGTH)
        .trim();
    return sanitized || 'edited_image';
}
function resolveFileName(baseName, format) {
    const fallback = 'edited_image';
    const trimmed = String(baseName || fallback).trim() || fallback;
    const ext = extensionForFormat(format.format);
    const baseWithoutExtension = trimmed.replace(/\.(jpe?g|png|webp)$/i, '');
    const safeBase = sanitizeFileNameBase(baseWithoutExtension);
    return `${safeBase}.${ext}`;
}
async function renderExportDataUrl(context, resolved, validateMimeType = true) {
    const render = async () => {
        const activeObject = captureActiveObject(context.canvas);
        const labelBackups = captureMaskLabelBackups(context.canvas);
        try {
            context.canvas.discardActiveObject();
            const { region, partialEdges } = computeExportRegion(context, resolved.exportArea);
            assertExportPixelBudget(context, resolved.multiplier, region);
            const renderFormat = region && resolved.format.format === 'jpeg' ? 'png' : resolved.format.format;
            const renderQuality = renderFormat === 'png' ? undefined : resolved.format.quality;
            let dataUrl = await withSessionObjectsHidden(context, async () => withMaskExportState(context, resolved.mergeMasks, async () => withAnnotationsExportState(context, resolved.mergeAnnotations, async () => renderCanvasToDataUrl(context.canvas, renderFormat, renderQuality, resolved.multiplier, region))));
            if (region && (hasPartialEdges(partialEdges) || resolved.format.format === 'jpeg')) {
                dataUrl = await postProcessRegionDataUrl(dataUrl, partialEdges, resolved.format, context.options.backgroundColor, getCanvasDocument$2(context.canvas));
            }
            if (validateMimeType) {
                assertDataUrlMimeType(dataUrl, resolved.format, 'exportImageBase64');
            }
            return dataUrl;
        }
        finally {
            restoreMaskLabelBackups(context.canvas, labelBackups);
            restoreActiveObject(context.canvas, activeObject);
            requestRender(context.canvas);
        }
    };
    return context.withSelectionChangeSuppressed
        ? context.withSelectionChangeSuppressed(render)
        : render();
}
async function exportImageBase64(context, options) {
    if (!context.isImageLoaded()) {
        warnNoImageLoaded(context.options, 'exportImageBase64');
        throw new plugins_transform_index.ExportNotReadyError('exportImageBase64');
    }
    const resolved = resolveExportOptions(context, options);
    return renderExportDataUrl(context, resolved);
}
async function exportImageFile(context, options) {
    var _a;
    if (!context.isImageLoaded()) {
        warnNoImageLoaded(context.options, 'exportImageFile');
        throw new plugins_transform_index.ExportNotReadyError('exportImageFile');
    }
    const providedOptions = options !== null && options !== void 0 ? options : {};
    const resolved = resolveExportOptions(context, providedOptions);
    const rawDataUrl = await renderExportDataUrl(context, resolved, false);
    const finalDataUrl = await reencodeDataUrlAs(rawDataUrl, resolved.format, context.options.backgroundColor, context.canvas);
    let bytes;
    try {
        bytes = dataUrlToBytes(finalDataUrl);
    }
    catch (error) {
        throw new plugins_transform_index.ExportError('exportImageFile failed to decode rendered data URL.', error);
    }
    const fileName = resolveFileName((_a = providedOptions.fileName) !== null && _a !== void 0 ? _a : context.options.defaultDownloadFileName, resolved.format);
    return new File([bytes], fileName, { type: resolved.format.mimeType });
}
async function downloadImage(context, options) {
    if (!context.isImageLoaded()) {
        warnNoImageLoaded(context.options, 'downloadImage');
        return;
    }
    if (options !== undefined && options !== null && typeof options !== 'object') {
        throw new TypeError('[ImageEditor] downloadImage(options) expects an ImageExportOptions object.');
    }
    const file = await exportImageFile(context, options);
    triggerFileDownload(context, file);
}
function triggerFileDownload(context, file) {
    var _a;
    const ownerDocument = getCanvasDocument$2(context.canvas);
    const objectUrl = URL.createObjectURL(file);
    const link = ownerDocument.createElement('a');
    link.download = file.name;
    link.href = objectUrl;
    const body = (_a = ownerDocument.body) !== null && _a !== void 0 ? _a : ownerDocument.documentElement;
    if (!body)
        throw new Error('Document body is unavailable for download trigger.');
    body.appendChild(link);
    try {
        link.click();
    }
    finally {
        body.removeChild(link);
        scheduleObjectUrlRevoke(objectUrl);
    }
}
function scheduleObjectUrlRevoke(objectUrl) {
    var _a, _b;
    if (typeof globalThis.setTimeout !== 'function') {
        return;
    }
    const timeoutId = globalThis.setTimeout(() => {
        safeRevokeObjectUrl(objectUrl);
    }, DOWNLOAD_OBJECT_URL_REVOKE_DELAY_MS);
    (_b = (_a = timeoutId).unref) === null || _b === void 0 ? void 0 : _b.call(_a);
}
function safeRevokeObjectUrl(objectUrl) {
    try {
        if (typeof URL.revokeObjectURL === 'function') {
            URL.revokeObjectURL(objectUrl);
        }
    }
    catch {
    }
}
async function mergeAnnotations(context) {
    await flattenOverlayGroupToBaseImage(context, {
        operation: 'mergeAnnotations',
        exportOptions: {
            exportArea: 'image',
            mergeMasks: false,
            mergeAnnotations: true,
            multiplier: context.options.exportMultiplier,
            fileType: 'png',
        },
        getTargets: () => context.canvas.getObjects().filter(plugins_mask_index.isAnnotationObject),
        getPreservedObjects: () => context.getMasks(),
        removeTargetsNoHistory: () => {
            context.removeAllAnnotationsNoHistory();
        },
        restorePreservedObjects: (objects) => context.restoreMasks(objects),
    });
}

async function mergeAnnotationsAction(access) {
    const canvas = access.getCanvas();
    if (!canvas)
        return;
    if (!access.canRunIdleOperation('mergeAnnotations'))
        return;
    access.finalizeActiveTextEditingIfNeeded();
    const hasAnnotations = canvas.getObjects().some(plugins_mask_index.isAnnotationObject);
    if (!hasAnnotations)
        return;
    await runBusyOperation(access.buildBusyOperationAccess(), 'mergeAnnotations', async (callbackContext, operationToken) => {
        await mergeAnnotations(access.buildMergeAnnotationsContext(operationToken));
        access.updateInputs();
        access.updateMaskList();
        access.updateAnnotationList();
        access.emitAnnotationsChanged(callbackContext);
        if (access.getMasks().length > 0)
            access.emitMasksChanged(callbackContext);
        access.emitImageChanged(callbackContext);
    });
}
async function downloadImageAction(access, options) {
    if (!access.getCanvas())
        return;
    if (!access.canRunIdleOperation('downloadImage'))
        return;
    access.finalizeActiveTextEditingIfNeeded();
    await runBusyOperationWithoutUi(access.buildBusyOperationAccess(), 'downloadImage', async () => {
        await downloadImage(access.buildExportServiceContext(), options);
    });
}
async function exportImageBase64Action(access, options) {
    if (!access.getCanvas()) {
        throw new plugins_transform_index.ExportNotReadyError('exportImageBase64', 'editor is not initialized');
    }
    access.assertIdleForOperation('exportImageBase64', options);
    access.finalizeActiveTextEditingIfNeeded();
    return runBusyOperationWithoutUi(access.buildBusyOperationAccess(), 'exportImageBase64', () => exportImageBase64(access.buildExportServiceContext(), options));
}
async function exportImageFileAction(access, options) {
    if (!access.getCanvas()) {
        throw new plugins_transform_index.ExportNotReadyError('exportImageFile', 'editor is not initialized');
    }
    access.assertIdleForOperation('exportImageFile', options);
    access.finalizeActiveTextEditingIfNeeded();
    return runBusyOperationWithoutUi(access.buildBusyOperationAccess(), 'exportImageFile', () => exportImageFile(access.buildExportServiceContext(), options));
}

const HEADER_PROBE_BYTES = 256 * 1024;
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_SOF_DIMENSIONS_MIN_SEGMENT_LENGTH = 7;
function hasPositiveDimensions$1(width, height) {
    return Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0;
}
function readUint16BE(bytes, offset) {
    if (offset < 0 || offset + 2 > bytes.length)
        return null;
    return (bytes[offset] << 8) | bytes[offset + 1];
}
function readUint32BE(bytes, offset) {
    if (offset < 0 || offset + 4 > bytes.length)
        return null;
    return (bytes[offset] * 0x1000000 +
        ((bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]));
}
function readUint16LE(bytes, offset) {
    if (offset < 0 || offset + 2 > bytes.length)
        return null;
    return bytes[offset] | (bytes[offset + 1] << 8);
}
function readUint24LE(bytes, offset) {
    if (offset < 0 || offset + 3 > bytes.length)
        return null;
    return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}
function matchesAscii(bytes, offset, value) {
    if (offset < 0 || offset + value.length > bytes.length)
        return false;
    for (let index = 0; index < value.length; index += 1) {
        if (bytes[offset + index] !== value.charCodeAt(index))
            return false;
    }
    return true;
}
function readPngDimensions(bytes) {
    if (bytes.length < 24)
        return null;
    if (!PNG_SIGNATURE.every((byte, index) => bytes[index] === byte))
        return null;
    if (!matchesAscii(bytes, 12, 'IHDR'))
        return null;
    const width = readUint32BE(bytes, 16);
    const height = readUint32BE(bytes, 20);
    return width !== null && height !== null && hasPositiveDimensions$1(width, height)
        ? { width, height }
        : null;
}
function isJpegStartOfFrame(marker) {
    return ((marker >= 0xc0 && marker <= 0xc3) ||
        (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) ||
        (marker >= 0xcd && marker <= 0xcf));
}
function isStandaloneJpegMarker(marker) {
    return marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7);
}
function readJpegDimensions(bytes) {
    if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8)
        return null;
    let offset = 2;
    while (offset + 1 < bytes.length) {
        while (offset < bytes.length && bytes[offset] === 0xff)
            offset += 1;
        if (offset >= bytes.length)
            return null;
        const marker = bytes[offset];
        offset += 1;
        if (marker === 0xda || marker === 0xd9)
            return null;
        if (isStandaloneJpegMarker(marker))
            continue;
        const segmentLength = readUint16BE(bytes, offset);
        if (segmentLength === null || segmentLength < 2)
            return null;
        const segmentStart = offset + 2;
        const segmentEnd = offset + segmentLength;
        if (segmentEnd > bytes.length)
            return null;
        if (isJpegStartOfFrame(marker)) {
            if (segmentLength < JPEG_SOF_DIMENSIONS_MIN_SEGMENT_LENGTH ||
                segmentStart + 5 > segmentEnd) {
                return null;
            }
            const height = readUint16BE(bytes, segmentStart + 1);
            const width = readUint16BE(bytes, segmentStart + 3);
            return width !== null && height !== null && hasPositiveDimensions$1(width, height)
                ? { width, height }
                : null;
        }
        offset = segmentEnd;
    }
    return null;
}
function readWebpDimensions(bytes) {
    if (bytes.length < 20 || !matchesAscii(bytes, 0, 'RIFF') || !matchesAscii(bytes, 8, 'WEBP')) {
        return null;
    }
    if (matchesAscii(bytes, 12, 'VP8X') && bytes.length >= 30) {
        const rawWidth = readUint24LE(bytes, 24);
        const rawHeight = readUint24LE(bytes, 27);
        if (rawWidth === null || rawHeight === null)
            return null;
        return { width: rawWidth + 1, height: rawHeight + 1 };
    }
    if (matchesAscii(bytes, 12, 'VP8 ') && bytes.length >= 30) {
        if (bytes[23] !== 0x9d || bytes[24] !== 0x01 || bytes[25] !== 0x2a)
            return null;
        const rawWidth = readUint16LE(bytes, 26);
        const rawHeight = readUint16LE(bytes, 28);
        if (rawWidth === null || rawHeight === null)
            return null;
        return { width: rawWidth & 0x3fff, height: rawHeight & 0x3fff };
    }
    if (matchesAscii(bytes, 12, 'VP8L') && bytes.length >= 25 && bytes[20] === 0x2f) {
        const byte1 = bytes[21];
        const byte2 = bytes[22];
        const byte3 = bytes[23];
        const byte4 = bytes[24];
        return {
            width: 1 + byte1 + ((byte2 & 0x3f) << 8),
            height: 1 + (byte2 >> 6) + (byte3 << 2) + ((byte4 & 0x0f) << 10),
        };
    }
    return null;
}
function readImageHeaderDimensions(bytes) {
    var _a, _b;
    return (_b = (_a = readPngDimensions(bytes)) !== null && _a !== void 0 ? _a : readJpegDimensions(bytes)) !== null && _b !== void 0 ? _b : readWebpDimensions(bytes);
}
function estimateBase64PayloadBytes(dataUrl) {
    const commaIndex = dataUrl.indexOf(',');
    if (commaIndex < 0)
        return null;
    const header = dataUrl.slice(0, commaIndex).toLowerCase();
    if (!header.endsWith(';base64'))
        return null;
    const base64 = dataUrl.slice(commaIndex + 1).replace(/\s+/g, '');
    if (!base64)
        return 0;
    const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
    return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}
function decodeBase64Prefix(dataUrl, maxBytes) {
    const commaIndex = dataUrl.indexOf(',');
    if (commaIndex < 0)
        return null;
    const header = dataUrl.slice(0, commaIndex).toLowerCase();
    if (!header.endsWith(';base64'))
        return null;
    const encodedLength = Math.ceil(maxBytes / 3) * 4;
    const base64 = dataUrl
        .slice(commaIndex + 1, commaIndex + 1 + encodedLength)
        .replace(/\s+/g, '');
    if (!base64)
        return new Uint8Array(0);
    const paddedBase64 = padBase64(base64);
    if (paddedBase64 === null)
        return null;
    const bufferCtor = globalThis.Buffer;
    if (bufferCtor && typeof bufferCtor.from === 'function') {
        return bufferCtor.from(paddedBase64, 'base64');
    }
    if (typeof globalThis.atob === 'function') {
        const binary = globalThis.atob(paddedBase64);
        const bytes = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index += 1) {
            bytes[index] = binary.charCodeAt(index);
        }
        return bytes;
    }
    return null;
}
function padBase64(base64) {
    const remainder = base64.length % 4;
    if (remainder === 0)
        return base64;
    if (remainder === 1)
        return null;
    return `${base64}${'='.repeat(4 - remainder)}`;
}
async function readBlobAsArrayBuffer(blob) {
    if (typeof blob.arrayBuffer === 'function') {
        return blob.arrayBuffer();
    }
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result;
            if (result instanceof ArrayBuffer) {
                resolve(result);
            }
            else {
                reject(new Error('FileReader returned a non-ArrayBuffer result'));
            }
        };
        reader.onerror = () => {
            var _a;
            reject((_a = reader.error) !== null && _a !== void 0 ? _a : new Error('FileReader error'));
        };
        reader.onabort = () => {
            reject(new Error('FileReader read aborted'));
        };
        reader.readAsArrayBuffer(blob);
    });
}
function assertInputByteBudget(bytes, maxInputBytes) {
    if (bytes === null)
        return;
    if (bytes > maxInputBytes) {
        throw new plugins_transform_index.ImageDecodeError(`Image input byte length ${bytes} exceeds maxInputBytes (${maxInputBytes}).`);
    }
}
function assertInputPixelBudget(dimensions, maxInputPixels) {
    if (!dimensions)
        return;
    const pixels = dimensions.width * dimensions.height;
    if (pixels > maxInputPixels) {
        throw new plugins_transform_index.ImageDecodeError(`Image input dimensions ${dimensions.width}x${dimensions.height} exceed maxInputPixels (${maxInputPixels}).`);
    }
}
function assertImageDataUrlInputBudget(dataUrl, options) {
    assertInputByteBudget(estimateBase64PayloadBytes(dataUrl), options.maxInputBytes);
    const headerBytes = decodeBase64Prefix(dataUrl, HEADER_PROBE_BYTES);
    assertInputPixelBudget(headerBytes ? readImageHeaderDimensions(headerBytes) : null, options.maxInputPixels);
}
async function assertImageFileInputBudget(file, options) {
    assertInputByteBudget(file.size, options.maxInputBytes);
    const probeBlob = typeof file.slice === 'function' ? file.slice(0, HEADER_PROBE_BYTES) : file;
    const probeBuffer = await readBlobAsArrayBuffer(probeBlob);
    assertInputPixelBudget(readImageHeaderDimensions(new Uint8Array(probeBuffer)), options.maxInputPixels);
}

const MIN_FABRIC_IMAGE_LOAD_BUDGET_MS = 10;
async function loadImage(context, imageBase64, loadOptions = {}) {
    if (!isSupportedImageDataUrl(imageBase64))
        return;
    try {
        assertImageDataUrlInputBudget(imageBase64, context.options);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? `loadImage failed: ${error.message}` : 'loadImage failed';
        plugins_mask_index.reportError(context.options, error, errorMessage);
        throw error;
    }
    const placeholderHidden = context.placeholderElement
        ? !!context.placeholderElement.hidden
        : null;
    const containerScrollTop = context.containerElement ? context.containerElement.scrollTop : null;
    const containerScrollLeft = context.containerElement
        ? context.containerElement.scrollLeft
        : null;
    const bundle = {
        placeholderHidden,
        containerScrollTop,
        containerScrollLeft,
        isImageLoadedToCanvas: context.getIsImageLoadedToCanvas(),
        lastSnapshot: context.getLastSnapshot(),
        stateJson: captureRollbackState(context),
        maskCounter: context.getMaskCounter(),
        annotationCounter: context.getAnnotationCounter(),
        currentScale: context.getCurrentScale(),
        currentRotation: context.getCurrentRotation(),
        baseImageScale: context.getBaseImageScale(),
        currentImageMimeType: context.getCurrentImageMimeType(),
        currentImageFilterConfig: context.getCurrentImageFilterConfig(),
    };
    try {
        const loadDeadline = Date.now() + context.options.imageLoadTimeoutMs;
        context.setPlaceholderVisible(false);
        const decode = startImageDecode(imageBase64);
        let imageElement;
        try {
            imageElement = await withTimeout(decode.promise, Math.max(1, getRemainingLoadTimeout(loadDeadline)), 'image decode');
        }
        catch (error) {
            decode.cleanup(true);
            throw error;
        }
        const loadSource = maybeDownsample(imageElement, imageBase64, context.options, getCanvasDocument$1(context.canvas));
        const fabricLoadTimeoutMs = getRemainingLoadTimeout(loadDeadline);
        assertMinimumLoadBudget('FabricImage.fromURL', fabricLoadTimeoutMs, MIN_FABRIC_IMAGE_LOAD_BUDGET_MS);
        const fabricAbort = createAbortController();
        const fabricCrossOrigin = 'anonymous';
        const fabricLoadOptions = fabricAbort
            ? { crossOrigin: fabricCrossOrigin, signal: fabricAbort.signal }
            : { crossOrigin: fabricCrossOrigin };
        const fabricImage = await withTimeout(context.fabric.FabricImage.fromURL(loadSource.dataUrl, fabricLoadOptions), Math.max(1, fabricLoadTimeoutMs), 'FabricImage.fromURL', () => {
            fabricAbort === null || fabricAbort === void 0 ? void 0 : fabricAbort.abort();
        });
        context.canvas.discardActiveObject();
        context.canvas.clear();
        context.canvas.backgroundColor = context.options.backgroundColor;
        const baseImage = plugins_mask_index.markBaseImageObject(fabricImage);
        baseImage.set({
            originX: 'left',
            originY: 'top',
            selectable: false,
            evented: false,
        });
        const layout = computeLayout(context, baseImage);
        core_index.applyCanvasDimensions(context.canvas, layout.canvasWidth, layout.canvasHeight, context.containerElement);
        baseImage.set({
            left: layout.imageLeft,
            top: layout.imageTop,
            scaleX: layout.imageScale,
            scaleY: layout.imageScale,
        });
        context.canvas.add(baseImage);
        context.canvas.sendObjectToBack(baseImage);
        context.setOriginalImage(baseImage);
        context.setBaseImageScale(layout.baseImageScale);
        context.setCurrentScale(1);
        context.setCurrentRotation(0);
        context.setMaskCounter(0);
        context.setAnnotationCounter(0);
        context.setIsImageLoadedToCanvas(true);
        context.setCurrentImageMimeType(loadSource.mimeType);
        context.resetImageFilterState();
        context.canvas.renderAll();
        context.setLastSnapshot(saveState({
            canvas: context.canvas,
            currentScale: 1,
            currentRotation: 0,
            baseImageScale: layout.baseImageScale,
            currentImageMimeType: loadSource.mimeType,
            imageFilterConfig: context.getCurrentImageFilterConfig(),
        }));
        if (loadOptions.preserveScroll === true && context.containerElement) {
            try {
                if (bundle.containerScrollTop !== null) {
                    context.containerElement.scrollTop = bundle.containerScrollTop;
                }
                if (bundle.containerScrollLeft !== null) {
                    context.containerElement.scrollLeft = bundle.containerScrollLeft;
                }
            }
            catch (error) {
                plugins_mask_index.reportWarning(context.options, error, 'preserveScroll restore failed.');
            }
        }
    }
    catch (error) {
        await replayRollback(context, bundle);
        const errorMessage = error instanceof Error ? `loadImage failed: ${error.message}` : 'loadImage failed';
        plugins_mask_index.reportError(context.options, error, errorMessage);
        throw error;
    }
}
function startImageDecode(dataUrl) {
    return startImageElementLoad(dataUrl, {
        validate: (imageElement) => hasNaturalImageDimensions(imageElement)
            ? null
            : new plugins_transform_index.ImageDecodeError('Failed to decode image data URL: image has no natural dimensions.', null),
        createError: (event) => new plugins_transform_index.ImageDecodeError('Failed to decode image data URL.', event),
    });
}
function hasNaturalImageDimensions(imageElement) {
    return (Number.isFinite(imageElement.naturalWidth) &&
        Number.isFinite(imageElement.naturalHeight) &&
        imageElement.naturalWidth > 0 &&
        imageElement.naturalHeight > 0);
}
function isPositiveFinite(value) {
    return Number.isFinite(value) && value > 0;
}
function toSupportedImageMimeType(mimeType) {
    return mimeType === 'image/jpeg' || mimeType === 'image/png' || mimeType === 'image/webp'
        ? mimeType
        : null;
}
function maybeDownsample(imageElement, originalDataUrl, options, ownerDocument) {
    const originalMimeType = toSupportedImageMimeType(detectSourceMimeType(originalDataUrl));
    if (!options.downsampleOnLoad) {
        return { dataUrl: originalDataUrl, mimeType: originalMimeType };
    }
    if (!isPositiveFinite(options.downsampleMaxWidth) ||
        !isPositiveFinite(options.downsampleMaxHeight)) {
        plugins_mask_index.reportWarning(options, null, 'loadImage skipped downsampling because downsample bounds are invalid.');
        return { dataUrl: originalDataUrl, mimeType: originalMimeType };
    }
    const downsampleDimensions = computeDownsampleDimensions(imageElement.naturalWidth, imageElement.naturalHeight, options.downsampleMaxWidth, options.downsampleMaxHeight);
    if (!downsampleDimensions.needsResize) {
        return { dataUrl: originalDataUrl, mimeType: originalMimeType };
    }
    const sourceMime = detectSourceMimeType(originalDataUrl);
    const resampledImage = resampleImage(imageElement, options.downsampleMaxWidth, options.downsampleMaxHeight, sourceMime, options.preserveSourceFormat, options.downsampleMimeType, options.downsampleQuality, ownerDocument);
    const actualMimeType = toSupportedImageMimeType(detectSourceMimeType(resampledImage.dataUrl));
    return {
        dataUrl: resampledImage.dataUrl,
        mimeType: actualMimeType !== null && actualMimeType !== void 0 ? actualMimeType : resampledImage.mimeType,
    };
}
function getCanvasDocument$1(canvas) {
    var _a, _b, _c, _d;
    const canvasLike = canvas;
    return (_c = (_b = (_a = canvasLike.getElement) === null || _a === void 0 ? void 0 : _a.call(canvasLike)) === null || _b === void 0 ? void 0 : _b.ownerDocument) !== null && _c !== void 0 ? _c : (_d = canvasLike.lowerCanvasEl) === null || _d === void 0 ? void 0 : _d.ownerDocument;
}
function computeLayout(context, fabricImage) {
    var _a, _b, _c, _d;
    const imageWidth = (_a = fabricImage.width) !== null && _a !== void 0 ? _a : 0;
    const imageHeight = (_b = fabricImage.height) !== null && _b !== void 0 ? _b : 0;
    const scrollbarSize = core_index.measureScrollbarSize((_d = (_c = context.containerElement) === null || _c === void 0 ? void 0 : _c.ownerDocument) !== null && _d !== void 0 ? _d : null);
    const viewport = context.viewportCache.measure(context.containerElement, {
        width: context.options.canvasWidth,
        height: context.options.canvasHeight,
    }, scrollbarSize);
    const strategy = core_index.selectLayoutStrategy(context.options.layoutMode);
    if (strategy === 'fit') {
        return core_index.computeFitLayout(imageWidth, imageHeight, context.options.canvasWidth, context.options.canvasHeight, viewport);
    }
    if (strategy === 'cover') {
        return core_index.computeCoverLayout(imageWidth, imageHeight, context.options.canvasWidth, context.options.canvasHeight, viewport, scrollbarSize);
    }
    return core_index.computeExpandLayout(imageWidth, imageHeight, viewport);
}
function captureRollbackState(context) {
    return saveState({
        canvas: context.canvas,
        currentScale: context.getCurrentScale(),
        currentRotation: context.getCurrentRotation(),
        baseImageScale: context.getBaseImageScale(),
        currentImageMimeType: context.getCurrentImageMimeType(),
        imageFilterConfig: context.getCurrentImageFilterConfig(),
    });
}
function getRemainingLoadTimeout(deadline) {
    return deadline - Date.now();
}
function assertMinimumLoadBudget(label, remainingMs, minimumMs) {
    if (remainingMs >= minimumMs)
        return;
    throw new plugins_transform_index.ImageLoadBudgetExhaustedError(label, remainingMs, minimumMs);
}
function createAbortController() {
    return typeof AbortController === 'function' ? new AbortController() : null;
}
async function replayRollback(context, bundle) {
    var _a, _b;
    try {
        const restoredState = await loadFromState({
            canvas: context.canvas,
            jsonString: bundle.stateJson,
            setCanvasSize: (width, height) => {
                context.setCanvasSize(width, height);
            },
            maxCanvasPixels: context.options.maxExportPixels,
            restoreTrustLevel: 'trusted',
        });
        context.applyRollbackRestoredState(restoredState);
        context.setOriginalImage(restoredState.originalImage);
        context.setIsImageLoadedToCanvas(bundle.isImageLoadedToCanvas && restoredState.originalImage !== null);
        context.setLastSnapshot(bundle.lastSnapshot);
        context.setMaskCounter(Math.max(bundle.maskCounter, restoredState.maxMaskId));
        context.setAnnotationCounter(Math.max(bundle.annotationCounter, restoredState.maxAnnotationId));
        context.setCurrentScale(bundle.currentScale);
        context.setCurrentRotation(bundle.currentRotation);
        context.setBaseImageScale(bundle.baseImageScale);
        context.setCurrentImageMimeType(bundle.currentImageMimeType);
        context.restoreImageFilterConfig((_b = (_a = restoredState.editorState) === null || _a === void 0 ? void 0 : _a.imageFilterConfig) !== null && _b !== void 0 ? _b : bundle.currentImageFilterConfig);
        context.canvas.renderAll();
    }
    catch (rollbackError) {
        plugins_mask_index.reportWarning(context.options, rollbackError, 'loadImage rollback failed while restoring the previous canvas state; editor state was cleared.');
        context.resetAfterRollbackFailure();
    }
    if (context.containerElement) {
        try {
            if (bundle.containerScrollTop !== null) {
                context.containerElement.scrollTop = bundle.containerScrollTop;
            }
            if (bundle.containerScrollLeft !== null) {
                context.containerElement.scrollLeft = bundle.containerScrollLeft;
            }
        }
        catch (rollbackError) {
            plugins_mask_index.reportWarning(context.options, rollbackError, 'loadImage rollback scroll restore failed.');
        }
    }
    if (bundle.placeholderHidden !== null) {
        context.setPlaceholderVisible(!bundle.placeholderHidden);
    }
}

const JPEG_MARKER_PREFIX = 0xff;
const JPEG_SOI = 0xd8;
const JPEG_SOS = 0xda;
const JPEG_EOI = 0xd9;
const JPEG_APP1 = 0xe1;
const TIFF_TAG_ORIENTATION = 0x0112;
const TIFF_TYPE_SHORT = 3;
const TIFF_TYPE_LONG = 4;
const EXIF_HEADER = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00];
function isValidOrientation(value) {
    return Number.isInteger(value) && value >= 1 && value <= 8;
}
function readUint16(view, offset, littleEndian) {
    if (offset < 0 || offset + 2 > view.byteLength)
        return null;
    return view.getUint16(offset, littleEndian);
}
function readUint32(view, offset, littleEndian) {
    if (offset < 0 || offset + 4 > view.byteLength)
        return null;
    return view.getUint32(offset, littleEndian);
}
function hasExifHeader(view, offset, end) {
    if (offset + EXIF_HEADER.length > end)
        return false;
    return EXIF_HEADER.every((byte, index) => view.getUint8(offset + index) === byte);
}
function isStandaloneMarker(marker) {
    return marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7);
}
function readJpegExifOrientation(buffer) {
    const view = new DataView(buffer);
    if (view.byteLength < 4)
        return null;
    if (view.getUint8(0) !== JPEG_MARKER_PREFIX || view.getUint8(1) !== JPEG_SOI) {
        return null;
    }
    let offset = 2;
    while (offset < view.byteLength) {
        if (view.getUint8(offset) !== JPEG_MARKER_PREFIX)
            return null;
        while (offset < view.byteLength && view.getUint8(offset) === JPEG_MARKER_PREFIX) {
            offset += 1;
        }
        if (offset >= view.byteLength)
            return null;
        const marker = view.getUint8(offset);
        offset += 1;
        if (marker === JPEG_SOS || marker === JPEG_EOI)
            return null;
        if (isStandaloneMarker(marker))
            continue;
        if (offset + 2 > view.byteLength)
            return null;
        const segmentLength = view.getUint16(offset, false);
        if (segmentLength < 2)
            return null;
        const segmentStart = offset + 2;
        const segmentEnd = offset + segmentLength;
        if (segmentEnd > view.byteLength)
            return null;
        if (marker === JPEG_APP1 && hasExifHeader(view, segmentStart, segmentEnd)) {
            return readExifSegmentOrientation(view, segmentStart + EXIF_HEADER.length, segmentEnd);
        }
        offset = segmentEnd;
    }
    return null;
}
function readExifSegmentOrientation(view, tiffStart, segmentEnd) {
    if (tiffStart + 8 > segmentEnd)
        return null;
    const byteOrderA = view.getUint8(tiffStart);
    const byteOrderB = view.getUint8(tiffStart + 1);
    const littleEndian = byteOrderA === 0x49 && byteOrderB === 0x49
        ? true
        : byteOrderA === 0x4d && byteOrderB === 0x4d
            ? false
            : null;
    if (littleEndian === null)
        return null;
    const tiffMagic = readUint16(view, tiffStart + 2, littleEndian);
    if (tiffMagic !== 0x002a)
        return null;
    const ifdOffset = readUint32(view, tiffStart + 4, littleEndian);
    if (ifdOffset === null)
        return null;
    const ifdStart = tiffStart + ifdOffset;
    if (ifdStart < tiffStart || ifdStart + 2 > segmentEnd)
        return null;
    const entryCount = readUint16(view, ifdStart, littleEndian);
    if (entryCount === null)
        return null;
    const entriesStart = ifdStart + 2;
    const entriesEnd = entriesStart + entryCount * 12;
    if (entriesEnd > segmentEnd)
        return null;
    for (let index = 0; index < entryCount; index += 1) {
        const entryOffset = entriesStart + index * 12;
        const tag = readUint16(view, entryOffset, littleEndian);
        if (tag !== TIFF_TAG_ORIENTATION)
            continue;
        const type = readUint16(view, entryOffset + 2, littleEndian);
        const count = readUint32(view, entryOffset + 4, littleEndian);
        if (count !== 1)
            return null;
        const value = type === TIFF_TYPE_SHORT
            ? readUint16(view, entryOffset + 8, littleEndian)
            : type === TIFF_TYPE_LONG
                ? readUint32(view, entryOffset + 8, littleEndian)
                : null;
        if (value === null)
            return null;
        return isValidOrientation(value) ? value : null;
    }
    return null;
}
function isJpegFile(file) {
    var _a, _b;
    const type = (_b = (_a = file.type) === null || _a === void 0 ? void 0 : _a.toLowerCase()) !== null && _b !== void 0 ? _b : '';
    if (type)
        return type === 'image/jpeg';
    return /\.(?:jpe?g)$/i.test(file.name);
}
async function readFileOrientation(file) {
    try {
        return readJpegExifOrientation(await readFileAsArrayBuffer(file));
    }
    catch {
        return null;
    }
}
async function createRawImageBitmap(file) {
    if (typeof createImageBitmap !== 'function') {
        throw new Error('createImageBitmap with imageOrientation: "none" is required for safe EXIF orientation normalization.');
    }
    try {
        const bitmap = await createImageBitmap(file, { imageOrientation: 'none' });
        if (!hasPositiveDimensions(bitmap.width, bitmap.height)) {
            bitmap.close();
            throw new Error('Decoded image bitmap has no dimensions.');
        }
        return {
            source: bitmap,
            width: bitmap.width,
            height: bitmap.height,
            close: () => {
                bitmap.close();
            },
        };
    }
    catch (error) {
        throw Object.assign(new Error(error instanceof Error
            ? `createImageBitmap EXIF orientation decode failed: ${error.message}`
            : 'createImageBitmap EXIF orientation decode failed.'), { cause: error });
    }
}
function hasPositiveDimensions(width, height) {
    return Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0;
}
function getCanvasDocument(ownerDocument) {
    const resolvedDocument = ownerDocument !== null && ownerDocument !== void 0 ? ownerDocument : (typeof document !== 'undefined' ? document : null);
    if (!resolvedDocument) {
        throw new Error('A document is required to normalize JPEG EXIF orientation.');
    }
    return resolvedDocument;
}
function createCanvas(ownerDocument) {
    return getCanvasDocument(ownerDocument).createElement('canvas');
}
function isRotatedRightAngle(orientation) {
    return orientation >= 5 && orientation <= 8;
}
function applyOrientationTransform(context, orientation, width, height) {
    switch (orientation) {
        case 2:
            context.transform(-1, 0, 0, 1, width, 0);
            break;
        case 3:
            context.transform(-1, 0, 0, -1, width, height);
            break;
        case 4:
            context.transform(1, 0, 0, -1, 0, height);
            break;
        case 5:
            context.transform(0, 1, 1, 0, 0, 0);
            break;
        case 6:
            context.transform(0, 1, -1, 0, height, 0);
            break;
        case 7:
            context.transform(0, -1, -1, 0, height, width);
            break;
        case 8:
            context.transform(0, -1, 1, 0, 0, width);
            break;
    }
}
function drawOrientedImage(decoded, orientation, options, ownerDocument) {
    var _a;
    const canvas = createCanvas(ownerDocument);
    const outputWidth = isRotatedRightAngle(orientation) ? decoded.height : decoded.width;
    const outputHeight = isRotatedRightAngle(orientation) ? decoded.width : decoded.height;
    canvas.width = outputWidth;
    canvas.height = outputHeight;
    const context = canvas.getContext('2d');
    if (!context) {
        throw new Error('Unable to create a canvas context for JPEG EXIF orientation.');
    }
    applyOrientationTransform(context, orientation, decoded.width, decoded.height);
    context.drawImage(decoded.source, 0, 0, decoded.width, decoded.height);
    return canvas.toDataURL('image/jpeg', (_a = options.autoOrientImageQuality) !== null && _a !== void 0 ? _a : options.downsampleQuality);
}
async function normalizeJpegOrientationIfNeeded(file, dataUrl, options, ownerDocument) {
    if (!options.autoOrientImage || !isJpegFile(file))
        return null;
    const orientation = await readFileOrientation(file);
    if (orientation === null || orientation === 1)
        return null;
    const decoded = await createRawImageBitmap(file);
    try {
        return drawOrientedImage(decoded, orientation, options, ownerDocument);
    }
    finally {
        decoded.close();
    }
}

async function loadImageFile(context, file) {
    var _a;
    const inputElement = context.getInputElement();
    const mime = inferImageMimeType(file);
    if (!mime) {
        plugins_mask_index.reportWarning(context.options, null, `Unsupported image file type: ${file.type || file.name || 'unknown'}.`);
        resetFileInput(inputElement);
        return;
    }
    try {
        await assertImageFileInputBudget(file, context.options);
    }
    catch (error) {
        plugins_mask_index.reportWarning(context.options, error, error instanceof Error ? error.message : 'Image file exceeds configured input limits.');
        resetFileInput(inputElement);
        return;
    }
    let dataUrl;
    try {
        dataUrl = await readFileAsDataUrl(file);
    }
    catch (error) {
        plugins_mask_index.reportError(context.options, error, 'Failed to read selected image file.');
        resetFileInput(inputElement);
        return;
    }
    try {
        try {
            dataUrl =
                (_a = (await normalizeJpegOrientationIfNeeded(file, dataUrl, context.options, inputElement === null || inputElement === void 0 ? void 0 : inputElement.ownerDocument))) !== null && _a !== void 0 ? _a : dataUrl;
        }
        catch (error) {
            plugins_mask_index.reportWarning(context.options, error, 'JPEG EXIF orientation normalization failed; loading the original file data.');
        }
        await context.loadImage(dataUrl);
    }
    finally {
        resetFileInput(inputElement);
    }
}

const LAYOUT_EPSILON = 0.5;
const SCROLLBAR_SETTLE_EPSILON = 1;
function measureLayoutViewport(context, scrollbarSize) {
    return context.viewportCache.measure(context.containerElement, {
        width: context.options.canvasWidth,
        height: context.options.canvasHeight,
    }, scrollbarSize);
}
function getScrollbarStableViewportCanvasSize(viewport) {
    return {
        width: Math.max(1, viewport.width - 1),
        height: Math.max(1, viewport.height - 1),
    };
}
function updateCanvasSizeToImageBounds(context, options = {}) {
    var _a, _b;
    const originalImage = context.getOriginalImage();
    if (!originalImage)
        return;
    originalImage.setCoords();
    const boundingRect = originalImage.getBoundingRect();
    const scrollbarSize = core_index.measureScrollbarSize((_b = (_a = context.containerElement) === null || _a === void 0 ? void 0 : _a.ownerDocument) !== null && _b !== void 0 ? _b : null);
    const viewport = measureLayoutViewport(context, scrollbarSize);
    const shouldStabilizeContainedViewport = options.stabilizeContainedViewport !== false;
    const imageFitsViewport = boundingRect.width <= viewport.width + LAYOUT_EPSILON &&
        boundingRect.height <= viewport.height + LAYOUT_EPSILON;
    if (context.currentLayoutMode === 'fit' || context.currentLayoutMode === 'cover') {
        if (imageFitsViewport) {
            const canvasSize = shouldStabilizeContainedViewport
                ? getScrollbarStableViewportCanvasSize(viewport)
                : viewport;
            context.setCanvasSize(canvasSize.width, canvasSize.height);
            return;
        }
        const canvasSize = core_index.computeScrollableCanvasSize(boundingRect.width, boundingRect.height, viewport, scrollbarSize);
        context.setCanvasSize(canvasSize.width, canvasSize.height);
        return;
    }
    if (imageFitsViewport) {
        const canvasSize = shouldStabilizeContainedViewport
            ? getScrollbarStableViewportCanvasSize(viewport)
            : viewport;
        context.setCanvasSize(canvasSize.width, canvasSize.height);
        return;
    }
    context.setCanvasSize(Math.max(viewport.width, Math.ceil(boundingRect.width)), Math.max(viewport.height, Math.ceil(boundingRect.height)));
}
function shouldNormalizeCanvasSizeAfterStateRestore(context) {
    var _a, _b;
    const originalImage = context.getOriginalImage();
    if (!context.canvas || !originalImage)
        return false;
    originalImage.setCoords();
    const boundingRect = originalImage.getBoundingRect();
    const viewport = measureLayoutViewport(context, core_index.measureScrollbarSize((_b = (_a = context.containerElement) === null || _a === void 0 ? void 0 : _a.ownerDocument) !== null && _b !== void 0 ? _b : null));
    const canvasW = Math.ceil(context.canvas.getWidth());
    const canvasH = Math.ceil(context.canvas.getHeight());
    const clipsImage = boundingRect.width > canvasW + LAYOUT_EPSILON ||
        boundingRect.height > canvasH + LAYOUT_EPSILON;
    if (context.currentLayoutMode === 'fit' || context.currentLayoutMode === 'cover') {
        const staleOverflowWidth = canvasW > viewport.width + LAYOUT_EPSILON &&
            boundingRect.width <= viewport.width + LAYOUT_EPSILON;
        const staleOverflowHeight = canvasH > viewport.height + LAYOUT_EPSILON &&
            boundingRect.height <= viewport.height + LAYOUT_EPSILON;
        return clipsImage || staleOverflowWidth || staleOverflowHeight;
    }
    if (context.currentLayoutMode === 'expand') {
        const expectedW = Math.max(viewport.width, Math.ceil(boundingRect.width));
        const expectedH = Math.max(viewport.height, Math.ceil(boundingRect.height));
        return (Math.abs(canvasW - expectedW) > LAYOUT_EPSILON ||
            Math.abs(canvasH - expectedH) > LAYOUT_EPSILON);
    }
    return clipsImage;
}
function settleFitCoverScrollbarsAfterStateRestore(context) {
    if (!context.canvas ||
        !context.containerElement ||
        (context.currentLayoutMode !== 'fit' && context.currentLayoutMode !== 'cover')) {
        return;
    }
    const canvasW = Math.ceil(context.canvas.getWidth());
    const canvasH = Math.ceil(context.canvas.getHeight());
    if (canvasW <= 1 || canvasH <= 1)
        return;
    const clientW = Math.floor(context.containerElement.clientWidth || 0);
    const clientH = Math.floor(context.containerElement.clientHeight || 0);
    if (clientW <= 0 || clientH <= 0)
        return;
    const scrollW = Math.ceil(context.containerElement.scrollWidth || 0);
    const scrollH = Math.ceil(context.containerElement.scrollHeight || 0);
    const hasHorizontalScrollbar = scrollW > clientW + LAYOUT_EPSILON;
    const hasVerticalScrollbar = scrollH > clientH + LAYOUT_EPSILON;
    if (!hasHorizontalScrollbar && !hasVerticalScrollbar)
        return;
    const nudgeWidth = hasVerticalScrollbar && Math.abs(canvasW - clientW) <= SCROLLBAR_SETTLE_EPSILON;
    const nudgeHeight = hasHorizontalScrollbar && Math.abs(canvasH - clientH) <= SCROLLBAR_SETTLE_EPSILON;
    if (!nudgeWidth && !nudgeHeight)
        return;
    context.setCanvasSize(nudgeWidth ? canvasW - 1 : canvasW, nudgeHeight ? canvasH - 1 : canvasH);
    context.setCanvasSize(canvasW, canvasH);
}
function captureImageDisplayGeometry(context) {
    const originalImage = context.getOriginalImage();
    if (!context.canvas || !originalImage)
        return null;
    originalImage.setCoords();
    const boundingRect = originalImage.getBoundingRect();
    return {
        canvasWidth: context.canvas.getWidth(),
        canvasHeight: context.canvas.getHeight(),
        imageDisplayWidth: Math.max(1, boundingRect.width),
        imageDisplayHeight: Math.max(1, boundingRect.height),
    };
}
function restoreMergedImageDisplayGeometry(context, geometry) {
    const originalImage = context.getOriginalImage();
    if (!geometry || !context.canvas || !originalImage)
        return;
    context.setCanvasSize(geometry.canvasWidth, geometry.canvasHeight);
    const sourceW = Math.max(1, originalImage.width || geometry.imageDisplayWidth);
    const sourceH = Math.max(1, originalImage.height || geometry.imageDisplayHeight);
    const scale = Math.min(geometry.imageDisplayWidth / sourceW, geometry.imageDisplayHeight / sourceH);
    originalImage.set({
        left: 0,
        top: 0,
        angle: 0,
        scaleX: scale,
        scaleY: scale,
        originX: 'left',
        originY: 'top',
        selectable: false,
        evented: false,
        hasControls: false,
        hoverCursor: 'default',
    });
    originalImage.setCoords();
    context.canvas.sendObjectToBack(originalImage);
    context.setCurrentScale(1);
    context.setCurrentRotation(0);
    context.setBaseImageScale(scale);
    context.setLastSnapshot(context.captureSnapshot());
    context.canvas.renderAll();
}

function scaleImageAction(access, factor) {
    if (!Number.isFinite(factor))
        return Promise.resolve();
    return runQueuedTransformAction(access, 'scaleImage', (controller) => controller.scaleImage(factor));
}
function rotateImageAction(access, degrees) {
    if (!Number.isFinite(degrees))
        return Promise.resolve();
    return runQueuedTransformAction(access, 'rotateImage', (controller) => controller.rotateImage(degrees));
}
function flipHorizontalAction(access) {
    return runQueuedTransformAction(access, 'flipHorizontal', (controller) => controller.flipHorizontal());
}
function flipVerticalAction(access) {
    return runQueuedTransformAction(access, 'flipVertical', (controller) => controller.flipVertical());
}
function resetImageTransformAction(access) {
    return runQueuedTransformAction(access, 'resetImageTransform', (controller) => controller.resetImageTransform());
}
function runQueuedTransformAction(access, operation, runControllerAction) {
    const controller = access.getTransformController();
    if (access.isDisposed() || !controller)
        return Promise.resolve();
    try {
        access.assertCanQueueAnimation(operation);
    }
    catch (error) {
        return Promise.reject(error);
    }
    const context = access.buildCallbackContext(operation, false);
    const job = access.enqueueAnimation(async () => {
        if (access.isDisposed())
            return;
        access.updateUi();
        try {
            await runControllerAction(controller);
            if (!access.isDisposed())
                access.emitImageChanged(context);
        }
        finally {
            if (!access.isDisposed()) {
                access.updateInputs();
            }
        }
    });
    access.emitBusyChangeIfChanged(context);
    return job.finally(() => {
        if (!access.isDisposed()) {
            access.refreshUiAfterQueuedAnimation();
            access.emitBusyChangeIfChanged(context);
        }
    });
}

class EditorActionAccessFactory {
    constructor(runtime, callbacks, contextFactory) {
        Object.defineProperty(this, "runtime", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: runtime
        });
        Object.defineProperty(this, "callbacks", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: callbacks
        });
        Object.defineProperty(this, "contextFactory", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: contextFactory
        });
    }
    buildBusyOperationAccess() {
        const { runtime, callbacks } = this;
        return {
            beginBusyOperation: (operation) => runtime.operationGuard.beginBusyOperation(operation),
            endBusyOperation: (token) => {
                runtime.operationGuard.endBusyOperation(token);
            },
            buildCallbackContext: (operation, isInternalOperation) => callbacks.buildCallbackContext(operation, isInternalOperation),
            emitBusyChangeIfChanged: (context) => {
                callbacks.emitBusyChangeIfChanged(context);
            },
            updateUi: () => {
                callbacks.updateUi();
            },
        };
    }
    buildTransformActionAccess() {
        const { runtime, callbacks } = this;
        return {
            isDisposed: () => runtime.isDisposed,
            getTransformController: () => runtime.transformController,
            assertCanQueueAnimation: (operation) => {
                callbacks.assertCanQueueAnimation(operation);
            },
            buildCallbackContext: (operation, isInternalOperation) => callbacks.buildCallbackContext(operation, isInternalOperation),
            enqueueAnimation: (body) => runtime.animQueue.add(body),
            updateInputs: () => {
                callbacks.updateInputs();
            },
            updateUi: () => {
                callbacks.updateUi();
            },
            refreshUiAfterQueuedAnimation: () => {
                callbacks.refreshUiAfterQueuedAnimation();
            },
            emitImageChanged: (context) => {
                callbacks.emitImageChanged(context);
            },
            emitBusyChangeIfChanged: (context) => {
                callbacks.emitBusyChangeIfChanged(context);
            },
        };
    }
    buildEditorStateActionAccess() {
        const { runtime, callbacks } = this;
        return {
            getCanvas: () => runtime.canvas,
            getLiveCanvas: (operationName) => runtime.getLiveCanvasOrThrow(operationName),
            getOptions: () => runtime.options,
            isDisposed: () => runtime.isDisposed,
            canRunIdleOperation: (operation, options) => callbacks.canRunIdleOperation(operation, options),
            getActiveStateRestoreOperation: () => runtime.activeStateRestoreOperation,
            buildCallbackContext: (operation, isInternalOperation) => callbacks.buildCallbackContext(operation, isInternalOperation),
            getOriginalImage: () => runtime.originalImage,
            setOriginalImage: (image) => {
                runtime.originalImage = image;
            },
            getMaskCollectionSignature: () => callbacks.getMaskCollectionSignature(),
            getAnnotationCollectionSignature: () => callbacks.getAnnotationCollectionSignature(),
            setCanvasSize: (widthPx, heightPx) => {
                callbacks.setCanvasSize(widthPx, heightPx);
            },
            hideAllMaskLabels: () => {
                callbacks.hideAllMaskLabels();
            },
            inferCurrentImageMimeType: () => callbacks.inferCurrentImageMimeType(),
            setCurrentImageMimeType: (mimeType) => {
                runtime.currentImageMimeType = mimeType;
            },
            getCurrentImageFilterConfig: () => runtime.currentImageFilterConfig,
            restoreImageFilterConfig: (config) => {
                const next = cloneResolvedImageFilterConfig(config !== null && config !== void 0 ? config : DEFAULT_IMAGE_FILTER_CONFIG);
                runtime.currentImageFilterConfig = next;
                runtime.lastCommittedImageFilterConfig = cloneResolvedImageFilterConfig(next);
                if (runtime.originalImage) {
                    applyImageFilterConfigToImage(runtime.fabricModule, runtime.originalImage, next, (error, message) => {
                        callbacks.reportWarning(error, message);
                    });
                }
            },
            setIsImageLoadedToCanvas: (value) => {
                runtime.isImageLoadedToCanvas = value;
            },
            setMaskCounter: (value) => {
                runtime.maskCounter = value;
            },
            setAnnotationCounter: (value) => {
                runtime.annotationCounter = value;
            },
            setCurrentScale: (value) => {
                runtime.currentScale = value;
            },
            setCurrentRotation: (value) => {
                runtime.currentRotation = value;
            },
            setBaseImageScale: (value) => {
                runtime.baseImageScale = value;
            },
            setLastMask: (mask) => {
                runtime.lastMask = mask;
            },
            getLastSnapshot: () => runtime.lastSnapshot,
            setLastSnapshot: (snapshot) => {
                runtime.lastSnapshot = snapshot;
            },
            shouldNormalizeCanvasSizeAfterStateRestore: () => callbacks.shouldNormalizeCanvasSizeAfterStateRestore(),
            updateCanvasSizeToImageBounds: (options) => {
                callbacks.updateCanvasSizeToImageBounds(options);
            },
            alignObjectBoundingBoxToCanvasTopLeft: (object) => {
                callbacks.alignObjectBoundingBoxToCanvasTopLeft(object);
            },
            settleFitCoverScrollbarsAfterStateRestore: () => {
                callbacks.settleFitCoverScrollbarsAfterStateRestore();
            },
            buildTextControllerContext: () => this.contextFactory.buildTextControllerContext(),
            updateInputs: () => {
                callbacks.updateInputs();
            },
            updateMaskList: () => {
                callbacks.updateMaskList();
            },
            updateAnnotationList: () => {
                callbacks.updateAnnotationList();
            },
            updateUi: () => {
                callbacks.updateUi();
            },
            emitImageCleared: (image, context) => {
                callbacks.emitImageCleared(image, context);
            },
            emitMasksChanged: (context) => {
                callbacks.emitMasksChanged(context);
            },
            emitAnnotationsChanged: (context) => {
                callbacks.emitAnnotationsChanged(context);
            },
            emitImageChanged: (context) => {
                callbacks.emitImageChanged(context);
            },
            withSelectionChangeContext: (context, callback) => callbacks.withSelectionChangeContext(context, callback),
            handleSelectionChanged: (selected) => {
                callbacks.handleSelectionChanged(selected);
            },
            shouldSuppressSaveState: () => runtime.shouldSuppressSaveState,
            getCurrentScale: () => runtime.currentScale,
            getCurrentRotation: () => runtime.currentRotation,
            getBaseImageScale: () => runtime.baseImageScale,
            getCurrentImageMimeType: () => runtime.currentImageMimeType,
            getHistoryManager: () => runtime.historyManager,
            withAnimationQueueBypass: () => callbacks.withAnimationQueueBypass(),
            showLabelForMask: (mask) => {
                callbacks.showLabelForMask(mask);
            },
            updateMaskListSelection: (mask) => {
                callbacks.updateMaskListSelection(mask);
            },
            updateAnnotationListSelection: (annotation) => {
                callbacks.updateAnnotationListSelection(annotation);
            },
        };
    }
    buildMaskActionAccess() {
        const { runtime, callbacks } = this;
        return {
            getCanvas: () => runtime.canvas,
            getMasks: () => callbacks.getMasks(),
            canRunIdleOperation: (operation, options) => callbacks.canRunIdleOperation(operation, options),
            buildCallbackContext: (operation, isInternalOperation) => callbacks.buildCallbackContext(operation, isInternalOperation),
            buildCreateMaskContext: () => this.contextFactory.buildCreateMaskContext(),
            buildRemoveMaskContext: () => this.contextFactory.buildRemoveMaskContext(),
            withSelectionChangeContext: (context, callback) => callbacks.withSelectionChangeContext(context, callback),
            updateUi: () => {
                callbacks.updateUi();
            },
            emitMasksChanged: (context) => {
                callbacks.emitMasksChanged(context);
            },
            emitImageChanged: (context) => {
                callbacks.emitImageChanged(context);
            },
        };
    }
    buildSelectionControllerAccess() {
        const { runtime, callbacks } = this;
        return {
            getCanvas: () => runtime.canvas,
            removeLabelForMask: (mask) => {
                callbacks.removeLabelForMask(mask);
            },
            showLabelForMask: (mask) => {
                callbacks.showLabelForMask(mask);
            },
            syncMaskLabel: (mask) => {
                callbacks.syncMaskLabel(mask);
            },
            updateMaskListSelection: (mask) => {
                callbacks.updateMaskListSelection(mask);
            },
            updateAnnotationListSelection: (annotation) => {
                callbacks.updateAnnotationListSelection(annotation);
            },
            updateUi: () => {
                callbacks.updateUi();
            },
            saveState: () => {
                callbacks.saveState();
            },
            getNextSelectionChangeContext: () => runtime.nextSelectionChangeContext,
            getActiveStateRestoreOperation: () => runtime.activeStateRestoreOperation,
            shouldSuppressSelectionChange: () => runtime.shouldSuppressSelectionChange,
            buildSelection: (selected) => callbacks.buildSelection(selected),
            buildCallbackContext: (operation, isHistoryRestore) => callbacks.buildCallbackContext(operation, isHistoryRestore),
            emitSelectionChange: (selection, context) => {
                callbacks.emitSelectionChange(selection, context);
            },
            emitMasksChanged: (context) => {
                callbacks.emitMasksChanged(context);
            },
            emitAnnotationsChanged: (context) => {
                callbacks.emitAnnotationsChanged(context);
            },
            emitImageChanged: (context) => {
                callbacks.emitImageChanged(context);
            },
        };
    }
    buildAnnotationModeActionAccess() {
        const { runtime, callbacks } = this;
        return {
            getCanvas: () => runtime.canvas,
            getTextSession: () => runtime.textSession,
            getDrawSession: () => runtime.drawSession,
            isToolModeActive: () => runtime.cropSession !== null ||
                runtime.mosaicSession !== null ||
                runtime.textSession !== null ||
                runtime.drawSession !== null ||
                runtime.shapeSession !== null,
            canRunIdleOperation: (operation, options) => callbacks.canRunIdleOperation(operation, options),
            buildTextControllerContext: () => this.contextFactory.buildTextControllerContext(),
            buildDrawControllerContext: () => this.contextFactory.buildDrawControllerContext(),
            buildCallbackContext: (operation, isInternalOperation) => callbacks.buildCallbackContext(operation, isInternalOperation),
            updateInputs: () => {
                callbacks.updateInputs();
            },
            emitBusyChangeIfChanged: (context) => {
                callbacks.emitBusyChangeIfChanged(context);
            },
            emitImageChanged: (context) => {
                callbacks.emitImageChanged(context);
            },
        };
    }
    buildEditableObjectActionAccess() {
        const { runtime, callbacks } = this;
        return {
            getCanvas: () => runtime.canvas,
            getLiveCanvas: (operationName) => runtime.getLiveCanvasOrThrow(operationName),
            buildAnnotationManagerContext: () => this.contextFactory.buildAnnotationManagerContext(),
            getMasks: () => callbacks.getMasks(),
            getAnnotations: () => callbacks.getAnnotations(),
            removeLabelForMask: (mask) => {
                callbacks.removeLabelForMask(mask);
            },
            withSelectionChangeContext: (context, callback) => callbacks.withSelectionChangeContext(context, callback),
            buildCallbackContext: (operation, isInternalOperation) => callbacks.buildCallbackContext(operation, isInternalOperation),
            saveState: () => {
                callbacks.saveState();
            },
            updateMaskList: () => {
                callbacks.updateMaskList();
            },
            updateMaskListSelection: (mask) => {
                callbacks.updateMaskListSelection(mask);
            },
            updateAnnotationList: () => {
                callbacks.updateAnnotationList();
            },
            updateAnnotationListSelection: (annotation) => {
                callbacks.updateAnnotationListSelection(annotation);
            },
            updateUi: () => {
                callbacks.updateUi();
            },
            emitMasksChanged: (context) => {
                callbacks.emitMasksChanged(context);
            },
            emitAnnotationsChanged: (context) => {
                callbacks.emitAnnotationsChanged(context);
            },
            emitImageChanged: (context) => {
                callbacks.emitImageChanged(context);
            },
            reportWarning: (message) => {
                callbacks.reportWarning(null, message);
            },
        };
    }
    buildAnnotationConfigActionAccess() {
        const { runtime, callbacks } = this;
        return {
            getCanvas: () => runtime.canvas,
            isTextMode: () => runtime.textSession !== null,
            isDrawMode: () => runtime.drawSession !== null,
            getCurrentTextConfig: () => runtime.currentTextConfig,
            setCurrentTextConfig: (config) => {
                runtime.currentTextConfig = config;
            },
            getDefaultTextConfig: () => runtime.defaultTextConfig,
            getCurrentDrawConfig: () => runtime.currentDrawConfig,
            setCurrentDrawConfig: (config) => {
                runtime.currentDrawConfig = config;
            },
            getDefaultDrawConfig: () => runtime.defaultDrawConfig,
            canRunIdleOperation: (operation, options) => callbacks.canRunIdleOperation(operation, options),
            buildDrawControllerContext: () => this.contextFactory.buildDrawControllerContext(),
            buildCallbackContext: (operation, isInternalOperation) => callbacks.buildCallbackContext(operation, isInternalOperation),
            updateSelectedAnnotation: (config) => {
                callbacks.updateSelectedAnnotation(config);
            },
            setTextColor: (color) => {
                callbacks.setTextColor(color);
            },
            setTextFontSize: (size) => {
                callbacks.setTextFontSize(size);
            },
            setDrawColor: (color) => {
                callbacks.setDrawColor(color);
            },
            setDrawBrushSize: (size) => {
                callbacks.setDrawBrushSize(size);
            },
            reportWarning: (error, message) => {
                callbacks.reportWarning(error, message);
            },
            updateInputs: () => {
                callbacks.updateInputs();
            },
            updateUi: () => {
                callbacks.updateUi();
            },
            emitImageChanged: (context) => {
                callbacks.emitImageChanged(context);
            },
        };
    }
    buildExportActionAccess() {
        const { runtime, callbacks } = this;
        return {
            getCanvas: () => runtime.canvas,
            getAnnotations: () => callbacks.getAnnotations(),
            getMasks: () => callbacks.getMasks(),
            canRunIdleOperation: (operation, options) => callbacks.canRunIdleOperation(operation, options),
            assertIdleForOperation: (operation, options) => {
                callbacks.assertIdleForOperation(operation, options);
            },
            finalizeActiveTextEditingIfNeeded: () => {
                callbacks.finalizeActiveTextEditingIfNeeded();
            },
            buildExportServiceContext: () => this.contextFactory.buildExportServiceContext(),
            buildMergeMasksContext: (token) => this.contextFactory.buildMergeMasksContext(token),
            buildMergeAnnotationsContext: (token) => this.contextFactory.buildMergeAnnotationsContext(token),
            buildBusyOperationAccess: () => this.buildBusyOperationAccess(),
            updateInputs: () => {
                callbacks.updateInputs();
            },
            updateMaskList: () => {
                callbacks.updateMaskList();
            },
            updateAnnotationList: () => {
                callbacks.updateAnnotationList();
            },
            emitMasksChanged: (context) => {
                callbacks.emitMasksChanged(context);
            },
            emitAnnotationsChanged: (context) => {
                callbacks.emitAnnotationsChanged(context);
            },
            emitImageChanged: (context) => {
                callbacks.emitImageChanged(context);
            },
        };
    }
    buildMosaicActionAccess() {
        const { runtime, callbacks } = this;
        return {
            getCanvas: () => runtime.canvas,
            getOriginalImage: () => runtime.originalImage,
            getMosaicSession: () => runtime.mosaicSession,
            getMosaicConfig: () => runtime.currentMosaicConfig,
            setMosaicConfig: (config) => {
                runtime.currentMosaicConfig = config;
            },
            getDefaultMosaicConfig: () => runtime.defaultMosaicConfig,
            getOptions: () => runtime.options,
            isDisposed: () => runtime.isDisposed,
            isImageLoaded: () => runtime.isImageLoaded(),
            canRunIdleOperation: (operation, options) => callbacks.canRunIdleOperation(operation, options),
            buildMosaicControllerContext: () => this.contextFactory.buildMosaicControllerContext(),
            buildCallbackContext: (operation, isInternalOperation) => callbacks.buildCallbackContext(operation, isInternalOperation),
            updateInputs: () => {
                callbacks.updateInputs();
            },
            updateUi: () => {
                callbacks.updateUi();
            },
            emitImageChanged: (context) => {
                callbacks.emitImageChanged(context);
            },
            emitBusyChangeIfChanged: (context) => {
                callbacks.emitBusyChangeIfChanged(context);
            },
        };
    }
    buildCropActionAccess() {
        const { runtime, callbacks } = this;
        return {
            getCanvas: () => runtime.canvas,
            getOriginalImage: () => runtime.originalImage,
            getCropSession: () => runtime.cropSession,
            setCropSession: (session) => {
                runtime.cropSession = session;
            },
            isImageLoaded: () => runtime.isImageLoaded(),
            canRunIdleOperation: (operation, options) => callbacks.canRunIdleOperation(operation, options),
            buildCropControllerContext: (token) => this.contextFactory.buildCropControllerContext(token),
            buildBusyOperationAccess: () => this.buildBusyOperationAccess(),
            buildCallbackContext: (operation, isInternalOperation) => callbacks.buildCallbackContext(operation, isInternalOperation),
            getMasks: () => callbacks.getMasks(),
            updateInputs: () => {
                callbacks.updateInputs();
            },
            updateMaskList: () => {
                callbacks.updateMaskList();
            },
            updateUi: () => {
                callbacks.updateUi();
            },
            emitMasksChanged: (context) => {
                callbacks.emitMasksChanged(context);
            },
            emitImageChanged: (context) => {
                callbacks.emitImageChanged(context);
            },
            emitBusyChangeIfChanged: (context) => {
                callbacks.emitBusyChangeIfChanged(context);
            },
        };
    }
}

function setPlaceholderVisible(placeholderElement, containerElement, show) {
    if (placeholderElement) {
        placeholderElement.hidden = !show;
        placeholderElement.setAttribute('aria-hidden', show ? 'false' : 'true');
    }
    if (containerElement) {
        containerElement.hidden = show;
        containerElement.setAttribute('aria-hidden', show ? 'true' : 'false');
    }
}

function asFabricTransformMatrix(matrix) {
    return matrix;
}
function createFabricUtilAccess(fabricModule) {
    return {
        multiplyTransformMatrices: (a, b) => fabricModule.util.multiplyTransformMatrices(asFabricTransformMatrix(a), asFabricTransformMatrix(b)),
        invertTransform: (matrix) => fabricModule.util.invertTransform(asFabricTransformMatrix(matrix)),
        qrDecompose: (matrix) => fabricModule.util.qrDecompose(asFabricTransformMatrix(matrix)),
        Point: fabricModule.Point,
    };
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
class EditorContextFactory {
    constructor(access) {
        Object.defineProperty(this, "access", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: access
        });
    }
    buildExportServiceContext() {
        const access = this.access;
        return {
            fabric: access.getFabric(),
            canvas: access.getLiveCanvas('export'),
            options: access.getOptions(),
            isImageLoaded: () => access.isImageLoaded(),
            getOriginalImage: () => access.getOriginalImage(),
            withSelectionChangeSuppressed: (callback) => access.withSelectionChangeSuppressed(callback),
        };
    }
    buildLoadImageContext() {
        const access = this.access;
        return {
            fabric: access.getFabric(),
            canvas: access.getLiveCanvas('loadImage'),
            options: access.getRuntimeOptions(),
            containerElement: access.getContainerElement(),
            placeholderElement: access.getPlaceholderElement(),
            viewportCache: access.getViewportCache(),
            getOriginalImage: () => access.getOriginalImage(),
            setOriginalImage: (image) => {
                access.setOriginalImage(image);
            },
            getIsImageLoadedToCanvas: () => access.getIsImageLoadedToCanvas(),
            setIsImageLoadedToCanvas: (value) => {
                access.setIsImageLoadedToCanvas(value);
            },
            getLastSnapshot: () => access.getLastSnapshot(),
            setLastSnapshot: (snapshot) => {
                access.setLastSnapshot(snapshot);
            },
            getMaskCounter: () => access.getMaskCounter(),
            setMaskCounter: (value) => {
                access.setMaskCounter(value);
            },
            getAnnotationCounter: () => access.getAnnotationCounter(),
            setAnnotationCounter: (value) => {
                access.setAnnotationCounter(value);
            },
            getCurrentScale: () => access.getCurrentScale(),
            setCurrentScale: (scale) => {
                access.setCurrentScale(scale);
            },
            getCurrentRotation: () => access.getCurrentRotation(),
            setCurrentRotation: (rotation) => {
                access.setCurrentRotation(rotation);
            },
            getBaseImageScale: () => access.getBaseImageScale(),
            setBaseImageScale: (scale) => {
                access.setBaseImageScale(scale);
            },
            getCurrentImageMimeType: () => access.getCurrentImageMimeType(),
            setCurrentImageMimeType: (mimeType) => {
                access.setCurrentImageMimeType(mimeType);
            },
            getCurrentImageFilterConfig: () => access.getCurrentImageFilterConfig(),
            resetImageFilterState: () => {
                access.resetImageFilterState();
            },
            restoreImageFilterConfig: (config) => {
                access.restoreImageFilterConfig(config);
            },
            setCanvasSize: (width, height) => {
                access.setCanvasSize(width, height);
            },
            applyRollbackRestoredState: (restoredState) => {
                var _a, _b;
                access.hideAllMaskLabels();
                const canvas = access.getCanvas();
                const originalImage = restoredState.originalImage;
                access.setOriginalImage(originalImage);
                if (originalImage) {
                    originalImage.set({
                        originX: 'left',
                        originY: 'top',
                        selectable: false,
                        evented: false,
                        hasControls: false,
                        hoverCursor: 'default',
                    });
                    canvas === null || canvas === void 0 ? void 0 : canvas.sendObjectToBack(originalImage);
                }
                access.restoreImageFilterConfig((_b = (_a = restoredState.editorState) === null || _a === void 0 ? void 0 : _a.imageFilterConfig) !== null && _b !== void 0 ? _b : null);
                const restoredMasks = restoredState.masks;
                access.setLastMask(restoredMasks.reduce((lastMask, maskObject) => !lastMask || maskObject.maskId > lastMask.maskId
                    ? maskObject
                    : lastMask, null));
                restoredMasks.forEach((maskObject) => {
                    plugins_mask_index.applyMaskUnselectedStyle(maskObject);
                    plugins_mask_index.reattachMaskHoverHandlers(maskObject);
                });
                syncAnnotationRuntimeStates(restoredState.annotations);
                attachTextEditingHandlersToAnnotations(this.buildTextControllerContext(), restoredState.annotations);
                access.updateMaskList();
                access.updateAnnotationList();
                access.updateInputs();
                access.updateUi();
            },
            resetAfterRollbackFailure: () => {
                const canvas = access.getCanvas();
                try {
                    canvas === null || canvas === void 0 ? void 0 : canvas.clear();
                    if (canvas) {
                        canvas.backgroundColor = access.getOptions().backgroundColor;
                        canvas.renderAll();
                    }
                }
                catch {
                }
                access.setOriginalImage(null);
                access.setIsImageLoadedToCanvas(false);
                access.setCurrentImageMimeType(null);
                access.resetImageFilterState();
                access.setLastSnapshot(null);
                access.setLastMask(null);
                access.setMaskCounter(0);
                access.setAnnotationCounter(0);
                access.setCurrentScale(1);
                access.setCurrentRotation(0);
                access.setBaseImageScale(1);
                access.updateMaskList();
                access.updateAnnotationList();
                access.updateInputs();
                access.updateUi();
            },
            setPlaceholderVisible: (show) => {
                access.setPlaceholderVisible(show);
            },
        };
    }
    buildTransformContext() {
        const access = this.access;
        const fabricUtil = createFabricUtilAccess(access.getFabric());
        let suppressOverlaySync = false;
        const getBoundOverlayTargets = (kind) => {
            const canvas = access.getCanvas();
            const options = access.getOptions();
            if (!canvas)
                return [];
            if (kind === 'masks') {
                if (!options.bindMasksToImageTransform)
                    return [];
                return canvas.getObjects().filter(plugins_mask_index.isMaskObject);
            }
            if (!options.bindAnnotationsToImageTransform)
                return [];
            return canvas.getObjects().filter(plugins_mask_index.isAnnotationObject);
        };
        const shouldPreserveReadableForAnnotation = (object) => {
            const options = access.getOptions();
            return (options.bindAnnotationsToImageTransform &&
                options.textAnnotationFlipBehavior === 'preserve-readable' &&
                plugins_mask_index.isAnnotationObject(object) &&
                object.annotationType === 'text');
        };
        return {
            canvas: access.getLiveCanvas('buildTransformContext'),
            options: access.getOptions(),
            guard: access.getOperationGuard(),
            getOriginalImage: () => access.getOriginalImage(),
            getCurrentScale: () => access.getCurrentScale(),
            setCurrentScale: (scale) => {
                access.setCurrentScale(scale);
            },
            getCurrentRotation: () => access.getCurrentRotation(),
            setCurrentRotation: (rotation) => {
                access.setCurrentRotation(rotation);
            },
            getBaseImageScale: () => access.getBaseImageScale(),
            saveCanvasState: () => {
                access.saveCanvasStateWithAnimationBypass();
            },
            setSuppressSaveState: (suppress) => {
                access.setSuppressSaveState(suppress);
            },
            getFabricUtil: () => fabricUtil,
            getBoundOverlayTargets,
            shouldPreserveReadableForAnnotation,
            finalizeImageTransformSnap: () => {
                const canvas = access.getCanvas();
                const originalImage = access.getOriginalImage();
                if (access.isDisposed() || !canvas || !originalImage)
                    return;
                access.updateCanvasSizeToImageBounds();
                access.alignObjectBoundingBoxToCanvasTopLeft(originalImage);
            },
            applyOverlayTransformDelta: (beforeMatrix) => {
                if (suppressOverlaySync)
                    return;
                const canvas = access.getCanvas();
                const originalImage = access.getOriginalImage();
                if (access.isDisposed() || !canvas || !originalImage)
                    return;
                const targets = [
                    ...getBoundOverlayTargets('masks'),
                    ...getBoundOverlayTargets('annotations'),
                ];
                if (targets.length === 0)
                    return;
                originalImage.setCoords();
                const afterMatrix = originalImage.calcTransformMatrix();
                const delta = foundations_overlay_index.computeImageTransformDelta(beforeMatrix, afterMatrix, fabricUtil);
                if (!foundations_overlay_index.isFiniteTransformMatrix(delta) || foundations_overlay_index.isApproximatelyIdentityTransform(delta)) {
                    return;
                }
                if (isActiveSelectionObject(canvas.getActiveObject())) {
                    canvas.discardActiveObject();
                }
                for (const object of targets) {
                    try {
                        foundations_overlay_index.applyDeltaToObject(object, delta, {
                            fabricUtil,
                            preserveReadableText: shouldPreserveReadableForAnnotation(object),
                        });
                    }
                    catch (error) {
                        plugins_mask_index.reportWarning(access.getOptions(), error, 'Overlay transform skipped an object after its Fabric transform failed.');
                    }
                }
                canvas.requestRenderAll();
            },
            syncOverlayAfterTransform: () => {
                const canvas = access.getCanvas();
                if (access.isDisposed() || !canvas)
                    return;
                canvas
                    .getObjects()
                    .filter(plugins_mask_index.isMaskObject)
                    .forEach((maskObject) => {
                    access.syncMaskLabel(maskObject);
                });
                canvas.requestRenderAll();
            },
            setSuppressOverlaySync: (suppress) => {
                suppressOverlaySync = suppress;
            },
            isOverlaySyncSuppressed: () => suppressOverlaySync,
        };
    }
    buildCreateMaskContext() {
        const access = this.access;
        return {
            fabric: access.getFabric(),
            canvas: access.getLiveCanvas('createMask'),
            options: access.getRuntimeOptions(),
            getLastMask: () => access.getLastMask(),
            setLastMask: (maskObject) => {
                access.setLastMask(maskObject);
            },
            getMaskCounter: () => access.getMaskCounter(),
            setMaskCounter: (value) => {
                access.setMaskCounter(value);
            },
            updateMaskList: () => {
                access.updateMaskList();
            },
            saveCanvasState: () => {
                access.saveCanvasState();
            },
            expandCanvasIfNeeded: (widthPx, heightPx) => {
                access.setCanvasSize(widthPx, heightPx);
            },
        };
    }
    buildRemoveMaskContext() {
        const access = this.access;
        return {
            canvas: access.getLiveCanvas('removeMask'),
            removeLabelForMask: (mask) => {
                access.removeLabelForMask(mask);
            },
            updateMaskList: () => {
                access.updateMaskList();
            },
            saveCanvasState: () => {
                access.saveCanvasState();
            },
            setLastMask: (maskObject) => {
                access.setLastMask(maskObject);
            },
        };
    }
    buildMaskLabelContext() {
        const canvas = this.access.getCanvas();
        if (!canvas)
            return null;
        return {
            fabric: this.access.getFabric(),
            canvas,
            options: this.access.getOptions(),
        };
    }
    buildMaskListContext() {
        const access = this.access;
        return {
            canvas: access.getCanvas(),
            getCanvas: () => access.getCanvas(),
            getListElement: () => access.getMaskListElement(),
            listOrder: access.getOptions().maskListOrder,
            onMaskSelected: (mask) => {
                access.handleMaskSelected(mask);
            },
        };
    }
    buildAnnotationManagerContext() {
        const access = this.access;
        return {
            canvas: access.getLiveCanvas('annotationManager'),
            saveCanvasState: () => access.saveCanvasState(),
            updateUi: () => access.updateUi(),
        };
    }
    buildAnnotationListContext() {
        const access = this.access;
        return {
            canvas: access.getCanvas(),
            getCanvas: () => access.getCanvas(),
            getListElement: () => access.getAnnotationListElement(),
            listOrder: access.getOptions().annotationListOrder,
            onAnnotationSelected: (annotation) => {
                access.handleAnnotationSelected(annotation);
            },
        };
    }
    buildTextControllerContext() {
        const access = this.access;
        return {
            fabric: access.getFabric(),
            canvas: access.getLiveCanvas('textController'),
            options: access.getOptions(),
            getOriginalImage: () => access.getOriginalImage(),
            getTextConfig: () => access.getTextConfig(),
            isImageLoaded: () => access.isImageLoaded(),
            getAnnotationCounter: () => access.getAnnotationCounter(),
            setAnnotationCounter: (value) => {
                access.setAnnotationCounter(value);
            },
            getTextSession: () => access.getTextSession(),
            setTextSession: (session) => {
                access.setTextSession(session);
            },
            saveCanvasState: () => access.saveCanvasState(),
            updateAnnotationList: () => access.updateAnnotationList(),
            updateUi: () => access.updateUi(),
            emitAnnotationsChanged: (context) => access.emitAnnotationsChanged(context),
            emitImageChanged: (context) => access.emitImageChanged(context),
            buildCallbackContext: (operation) => access.buildCallbackContext(operation, false),
        };
    }
    buildDrawControllerContext() {
        const access = this.access;
        return {
            fabric: access.getFabric(),
            canvas: access.getLiveCanvas('drawController'),
            options: access.getOptions(),
            getDrawConfig: () => access.getDrawConfig(),
            getEraserConfig: () => access.getEraserConfig(),
            isImageLoaded: () => access.isImageLoaded(),
            getAnnotationCounter: () => access.getAnnotationCounter(),
            setAnnotationCounter: (value) => {
                access.setAnnotationCounter(value);
            },
            getDrawSession: () => access.getDrawSession(),
            setDrawSession: (session) => {
                access.setDrawSession(session);
            },
            saveCanvasState: () => access.saveCanvasState(),
            updateAnnotationList: () => access.updateAnnotationList(),
            updateUi: () => access.updateUi(),
            emitAnnotationsChanged: (context) => access.emitAnnotationsChanged(context),
            emitImageChanged: (context) => access.emitImageChanged(context),
            buildCallbackContext: (operation) => access.buildCallbackContext(operation, false),
        };
    }
    buildShapeControllerContext() {
        const access = this.access;
        return {
            fabric: access.getFabric(),
            canvas: access.getLiveCanvas('shapeController'),
            options: access.getOptions(),
            getOriginalImage: () => access.getOriginalImage(),
            getShapeConfig: () => access.getShapeConfig(),
            isImageLoaded: () => access.isImageLoaded(),
            getAnnotationCounter: () => access.getAnnotationCounter(),
            setAnnotationCounter: (value) => {
                access.setAnnotationCounter(value);
            },
            getShapeSession: () => access.getShapeSession(),
            setShapeSession: (session) => {
                access.setShapeSession(session);
            },
            saveCanvasState: () => access.saveCanvasState(),
            updateAnnotationList: () => access.updateAnnotationList(),
            updateUi: () => access.updateUi(),
            emitAnnotationsChanged: (context) => access.emitAnnotationsChanged(context),
            emitImageChanged: (context) => access.emitImageChanged(context),
            buildCallbackContext: (operation) => access.buildCallbackContext(operation, false),
        };
    }
    buildMosaicControllerContext() {
        const access = this.access;
        return {
            fabric: access.getFabric(),
            canvas: access.getLiveCanvas('mosaicController'),
            options: access.getOptions(),
            historyManager: access.getHistoryManager(),
            getMosaicConfig: () => access.getMosaicConfig(),
            isImageLoaded: () => access.isImageLoaded(),
            getOriginalImage: () => access.getOriginalImage(),
            setOriginalImage: (image) => {
                access.setOriginalImage(image);
            },
            getCurrentImageMimeType: () => access.getCurrentImageMimeType(),
            setCurrentImageMimeType: (mimeType) => {
                access.setCurrentImageMimeType(mimeType);
            },
            getCurrentImageFilterConfig: () => access.getCurrentImageFilterConfig(),
            resetImageFilterState: () => {
                access.resetImageFilterState();
            },
            getLastSnapshot: () => access.getLastSnapshot(),
            setLastSnapshot: (snapshot) => {
                access.setLastSnapshot(snapshot);
            },
            captureSnapshot: () => access.captureSnapshot(),
            loadFromState: (snapshot) => access.loadFromStateForOperation(undefined, snapshot),
            updateUi: () => access.updateUi(),
            updateInputs: () => access.updateInputs(),
            hideAllMaskLabels: () => access.hideAllMaskLabels(),
            emitImageChanged: (context) => {
                access.emitImageChanged(context);
            },
            emitBusyChangeIfChanged: (context) => {
                access.emitBusyChangeIfChanged(context);
            },
            buildCallbackContext: (operation, isInternal) => access.buildCallbackContext(operation, isInternal),
            getMosaicSession: () => access.getMosaicSession(),
            setMosaicSession: (session) => {
                access.setMosaicSession(session);
            },
        };
    }
    buildCropControllerContext(operationToken) {
        const access = this.access;
        return {
            fabric: access.getFabric(),
            canvas: access.getLiveCanvas('cropController'),
            options: access.getOptions(),
            historyManager: access.getHistoryManager(),
            isImageLoaded: () => access.isImageLoaded(),
            getOriginalImage: () => access.getOriginalImage(),
            getCurrentImageMimeType: () => access.getCurrentImageMimeType(),
            getCropSession: () => access.getCropSession(),
            setCropSession: (session) => {
                access.setCropSession(session);
            },
            saveState: () => access.captureSnapshot(),
            loadFromState: (snapshot) => access.loadFromStateForOperation(operationToken, snapshot),
            loadImage: (base64, providedOptions) => access.loadImageForOperation(operationToken, base64, providedOptions),
            getMaskCounter: () => access.getMaskCounter(),
            setMaskCounter: (value) => {
                access.setMaskCounter(value);
            },
            updateMaskList: () => {
                access.updateMaskList();
            },
        };
    }
    buildMergeMasksContext(operationToken) {
        const access = this.access;
        return {
            ...this.buildExportServiceContext(),
            historyManager: access.getHistoryManager(),
            containerElement: access.getContainerElement(),
            loadImage: (base64, providedOptions) => access.loadMergedImage(operationToken, base64, providedOptions),
            captureSnapshot: () => access.captureSnapshot(),
            loadFromState: (snapshot) => access.loadFromStateForOperation(operationToken, snapshot),
            exportImageBase64: (options) => exportImageBase64(this.buildExportServiceContext(), options),
            updateUi: () => access.updateUi(),
            updateInputs: () => access.updateInputs(),
            removeAllMasksNoHistory: () => {
                plugins_mask_index.removeAllMasks(this.buildRemoveMaskContext(), { saveHistory: false });
            },
            getAnnotations: () => access.getAnnotations(),
            restoreAnnotations: (objects) => {
                const canvas = access.getLiveCanvas('restoreAnnotations');
                objects.forEach((annotation) => {
                    canvas.add(annotation);
                });
                syncAnnotationRuntimeStates(objects);
                attachTextEditingHandlersToAnnotations(this.buildTextControllerContext(), objects);
                access.setAnnotationCounter(Math.max(access.getAnnotationCounter(), ...objects.map((annotation) => annotation.annotationId), 0));
                access.updateAnnotationList();
            },
        };
    }
    buildMergeAnnotationsContext(operationToken) {
        const access = this.access;
        return {
            ...this.buildExportServiceContext(),
            historyManager: access.getHistoryManager(),
            containerElement: access.getContainerElement(),
            loadImage: (base64, providedOptions) => access.loadMergedImage(operationToken, base64, providedOptions),
            captureSnapshot: () => access.captureSnapshot(),
            loadFromState: (snapshot) => access.loadFromStateForOperation(operationToken, snapshot),
            exportImageBase64: (options) => exportImageBase64(this.buildExportServiceContext(), options),
            updateUi: () => access.updateUi(),
            updateInputs: () => access.updateInputs(),
            removeAllAnnotationsNoHistory: () => {
                removeAllAnnotations(this.buildAnnotationManagerContext(), {
                    saveHistory: false,
                    force: true,
                });
            },
            getMasks: () => access.getMasks(),
            restoreMasks: (objects) => {
                const canvas = access.getLiveCanvas('restoreMasks');
                objects.forEach((mask) => {
                    canvas.add(mask);
                    plugins_mask_index.reattachMaskHoverHandlers(mask);
                });
                access.setLastMask(objects.reduce((lastMask, mask) => !lastMask || mask.maskId > lastMask.maskId ? mask : lastMask, null));
                access.setMaskCounter(Math.max(access.getMaskCounter(), ...objects.map((mask) => mask.maskId), 0));
                access.updateMaskList();
            },
        };
    }
}

function createEditorContextFactory(runtime, callbacks) {
    return new EditorContextFactory({
        getFabric: () => runtime.fabricModule,
        getOptions: () => runtime.options,
        getRuntimeOptions: () => runtime.getRuntimeOptions(),
        getHistoryManager: () => runtime.historyManager,
        getOperationGuard: () => runtime.operationGuard,
        getCanvas: () => runtime.canvas,
        getLiveCanvas: (operationName) => runtime.getLiveCanvasOrThrow(operationName),
        getContainerElement: () => runtime.containerElement,
        getPlaceholderElement: () => runtime.placeholderElement,
        getViewportCache: () => runtime.viewportCache,
        isDisposed: () => runtime.isDisposed,
        isImageLoaded: () => runtime.isImageLoaded(),
        getOriginalImage: () => runtime.originalImage,
        setOriginalImage: (image) => {
            runtime.originalImage = image;
        },
        getIsImageLoadedToCanvas: () => runtime.isImageLoadedToCanvas,
        setIsImageLoadedToCanvas: (value) => {
            runtime.isImageLoadedToCanvas = value;
        },
        getCurrentImageMimeType: () => runtime.currentImageMimeType,
        setCurrentImageMimeType: (mimeType) => {
            runtime.currentImageMimeType = mimeType;
        },
        getCurrentImageFilterConfig: () => cloneResolvedImageFilterConfig(runtime.currentImageFilterConfig),
        resetImageFilterState: () => {
            const next = cloneResolvedImageFilterConfig(DEFAULT_IMAGE_FILTER_CONFIG);
            runtime.currentImageFilterConfig = next;
            runtime.lastCommittedImageFilterConfig = cloneResolvedImageFilterConfig(next);
            if (runtime.originalImage) {
                applyImageFilterConfigToImage(runtime.fabricModule, runtime.originalImage, next, (error, message) => {
                    callbacks.reportWarning(error, message);
                });
            }
        },
        restoreImageFilterConfig: (config) => {
            const next = cloneResolvedImageFilterConfig(config !== null && config !== void 0 ? config : DEFAULT_IMAGE_FILTER_CONFIG);
            runtime.currentImageFilterConfig = next;
            runtime.lastCommittedImageFilterConfig = cloneResolvedImageFilterConfig(next);
            if (runtime.originalImage) {
                applyImageFilterConfigToImage(runtime.fabricModule, runtime.originalImage, next, (error, message) => {
                    callbacks.reportWarning(error, message);
                });
            }
        },
        getLastSnapshot: () => runtime.lastSnapshot,
        setLastSnapshot: (snapshot) => {
            runtime.lastSnapshot = snapshot;
        },
        getCurrentScale: () => runtime.currentScale,
        setCurrentScale: (scale) => {
            runtime.currentScale = scale;
        },
        getCurrentRotation: () => runtime.currentRotation,
        setCurrentRotation: (rotation) => {
            runtime.currentRotation = rotation;
        },
        getBaseImageScale: () => runtime.baseImageScale,
        setBaseImageScale: (scale) => {
            runtime.baseImageScale = scale;
        },
        getMaskCounter: () => runtime.maskCounter,
        setMaskCounter: (value) => {
            runtime.maskCounter = value;
        },
        getLastMask: () => runtime.lastMask,
        setLastMask: (mask) => {
            runtime.lastMask = mask;
        },
        getAnnotationCounter: () => runtime.annotationCounter,
        setAnnotationCounter: (value) => {
            runtime.annotationCounter = value;
        },
        getTextConfig: () => runtime.currentTextConfig,
        getDrawConfig: () => runtime.currentDrawConfig,
        getEraserConfig: () => cloneResolvedEraserConfig(runtime.currentEraserConfig),
        getShapeConfig: () => cloneResolvedShapeAnnotationConfig(runtime.currentShapeConfig),
        getMosaicConfig: () => cloneResolvedMosaicConfig(runtime.currentMosaicConfig),
        getTextSession: () => runtime.textSession,
        setTextSession: (session) => {
            runtime.textSession = session;
        },
        getDrawSession: () => runtime.drawSession,
        setDrawSession: (session) => {
            runtime.drawSession = session;
        },
        getShapeSession: () => runtime.shapeSession,
        setShapeSession: (session) => {
            runtime.shapeSession = session;
        },
        getMosaicSession: () => runtime.mosaicSession,
        setMosaicSession: (session) => {
            runtime.mosaicSession = session;
        },
        getCropSession: () => runtime.cropSession,
        setCropSession: (session) => {
            runtime.cropSession = session;
        },
        saveCanvasState: () => callbacks.saveCanvasState(),
        saveCanvasStateWithAnimationBypass: () => callbacks.saveCanvasStateWithAnimationBypass(),
        setSuppressSaveState: (suppress) => {
            runtime.shouldSuppressSaveState = suppress;
        },
        withSelectionChangeSuppressed: async (callback) => {
            const previous = runtime.shouldSuppressSelectionChange;
            runtime.shouldSuppressSelectionChange = true;
            try {
                return await callback();
            }
            finally {
                runtime.shouldSuppressSelectionChange = previous;
            }
        },
        captureSnapshot: () => callbacks.captureSnapshot(),
        loadImageForOperation: (operationToken, base64, providedOptions) => callbacks.loadImageForOperation(operationToken, base64, providedOptions),
        loadMergedImage: (operationToken, base64, providedOptions) => callbacks.loadMergedImage(operationToken, base64, providedOptions),
        loadFromStateForOperation: (operationToken, snapshot) => callbacks.loadFromStateForOperation(operationToken, snapshot),
        setCanvasSize: (widthPx, heightPx) => {
            callbacks.setCanvasSize(widthPx, heightPx);
        },
        updateCanvasSizeToImageBounds: () => callbacks.updateCanvasSizeToImageBounds(),
        alignObjectBoundingBoxToCanvasTopLeft: (object) => {
            callbacks.alignObjectBoundingBoxToCanvasTopLeft(object);
        },
        syncMaskLabel: (mask) => {
            callbacks.syncMaskLabel(mask);
        },
        removeLabelForMask: (mask) => {
            callbacks.removeLabelForMask(mask);
        },
        hideAllMaskLabels: () => {
            callbacks.hideAllMaskLabels();
        },
        setPlaceholderVisible: (show) => {
            setPlaceholderVisible(runtime.placeholderElement, runtime.containerElement, runtime.options.showPlaceholder ? show : false);
        },
        updateMaskList: () => callbacks.updateMaskList(),
        updateAnnotationList: () => callbacks.updateAnnotationList(),
        updateUi: () => callbacks.updateUi(),
        updateInputs: () => callbacks.updateInputs(),
        getMaskListElement: () => {
            var _a;
            return resolveDomElement(runtime.elements.maskList, (_a = runtime.canvasElement) === null || _a === void 0 ? void 0 : _a.ownerDocument);
        },
        handleMaskSelected: (mask) => callbacks.handleSelectionChanged([mask]),
        getAnnotationListElement: () => {
            var _a;
            return resolveDomElement(runtime.elements.annotationList, (_a = runtime.canvasElement) === null || _a === void 0 ? void 0 : _a.ownerDocument);
        },
        handleAnnotationSelected: (annotation) => callbacks.handleSelectionChanged([annotation]),
        getMasks: () => callbacks.getMasks(),
        getAnnotations: () => callbacks.getAnnotations(),
        emitImageChanged: (context) => {
            callbacks.emitImageChanged(context);
        },
        emitAnnotationsChanged: (context) => {
            callbacks.emitAnnotationsChanged(context);
        },
        emitBusyChangeIfChanged: (context) => {
            callbacks.emitBusyChangeIfChanged(context);
        },
        buildCallbackContext: (operation, isInternalOperation) => callbacks.buildCallbackContext(operation, isInternalOperation),
    });
}

function createEditorRuntimeWiring(runtime, hooks) {
    const contextFactory = createContextFactory(runtime, hooks);
    return {
        contextFactory,
        actionAccessFactory: new EditorActionAccessFactory(runtime, createActionCallbacks(hooks), contextFactory),
    };
}
function createContextFactory(runtime, hooks) {
    return createEditorContextFactory(runtime, {
        saveCanvasState: () => {
            hooks.state.saveCanvasState();
        },
        saveCanvasStateWithAnimationBypass: () => {
            hooks.state.saveCanvasState(hooks.operations.withAnimationQueueBypass());
        },
        captureSnapshot: () => hooks.state.captureSnapshot(),
        loadImageForOperation: (operationToken, base64, providedOptions) => hooks.state.loadImage(base64, hooks.operations.withInternalOperationOptions(operationToken, providedOptions !== null && providedOptions !== void 0 ? providedOptions : {})),
        loadMergedImage: async (operationToken, base64, providedOptions) => {
            const geometry = hooks.display.captureImageDisplayGeometry();
            try {
                await hooks.state.loadImage(base64, hooks.operations.withInternalOperationOptions(operationToken, providedOptions !== null && providedOptions !== void 0 ? providedOptions : {}));
            }
            finally {
                hooks.display.restoreMergedImageDisplayGeometry(geometry);
            }
        },
        loadFromStateForOperation: (operationToken, snapshot) => hooks.state.loadFromState(snapshot, hooks.operations.withInternalOperationOptions(operationToken, hooks.operations.withAnimationQueueBypass())),
        setCanvasSize: (widthPx, heightPx) => {
            hooks.display.setCanvasSize(widthPx, heightPx);
        },
        updateCanvasSizeToImageBounds: () => hooks.display.updateCanvasSizeToImageBounds(),
        alignObjectBoundingBoxToCanvasTopLeft: (object) => {
            hooks.display.alignObjectBoundingBoxToCanvasTopLeft(object);
        },
        syncMaskLabel: (mask) => {
            hooks.labels.syncMaskLabel(mask);
        },
        removeLabelForMask: (mask) => {
            hooks.labels.removeLabelForMask(mask);
        },
        hideAllMaskLabels: () => {
            hooks.labels.hideAllMaskLabels();
        },
        updateMaskList: () => {
            hooks.ui.updateMaskList();
        },
        updateAnnotationList: () => {
            hooks.ui.updateAnnotationList();
        },
        updateUi: () => {
            hooks.ui.updateUi();
        },
        updateInputs: () => {
            hooks.ui.updateInputs();
        },
        handleSelectionChanged: (selected) => {
            hooks.selection.handleSelectionChanged(selected);
        },
        getMasks: () => hooks.selection.getMasks(),
        getAnnotations: () => hooks.selection.getAnnotations(),
        emitImageChanged: (context) => {
            hooks.callbacks.emitImageChanged(context);
        },
        emitAnnotationsChanged: (context) => {
            hooks.callbacks.emitAnnotationsChanged(context);
        },
        emitBusyChangeIfChanged: (context) => {
            hooks.callbacks.emitBusyChangeIfChanged(context);
        },
        reportWarning: (error, message) => {
            hooks.callbacks.reportWarning(error, message);
        },
        buildCallbackContext: (operation, isInternalOperation) => hooks.callbacks.buildCallbackContext(operation, isInternalOperation !== null && isInternalOperation !== void 0 ? isInternalOperation : false),
    });
}
function createActionCallbacks(hooks) {
    return {
        canRunIdleOperation: (operation, options) => hooks.operations.canRunIdleOperation(operation, options),
        assertIdleForOperation: (operation, options) => {
            hooks.operations.assertIdleForOperation(operation, options);
        },
        assertCanQueueAnimation: (operation) => {
            hooks.operations.assertCanQueueAnimation(operation);
        },
        finalizeActiveTextEditingIfNeeded: () => {
            hooks.operations.finalizeActiveTextEditingIfNeeded();
        },
        buildCallbackContext: (operation, isInternalOperation) => hooks.callbacks.buildCallbackContext(operation, isInternalOperation),
        withSelectionChangeContext: (context, callback) => hooks.operations.withSelectionChangeContext(context, callback),
        buildSelection: (selected) => hooks.selection.buildSelection(selected),
        getMasks: () => hooks.selection.getMasks(),
        getAnnotations: () => hooks.selection.getAnnotations(),
        getMaskCollectionSignature: () => hooks.selection.getMaskCollectionSignature(),
        getAnnotationCollectionSignature: () => hooks.selection.getAnnotationCollectionSignature(),
        inferCurrentImageMimeType: () => hooks.display.inferCurrentImageMimeType(),
        shouldNormalizeCanvasSizeAfterStateRestore: () => hooks.display.shouldNormalizeCanvasSizeAfterStateRestore(),
        updateCanvasSizeToImageBounds: (options) => {
            hooks.display.updateCanvasSizeToImageBounds(options);
        },
        alignObjectBoundingBoxToCanvasTopLeft: (object) => {
            hooks.display.alignObjectBoundingBoxToCanvasTopLeft(object);
        },
        settleFitCoverScrollbarsAfterStateRestore: () => {
            hooks.display.settleFitCoverScrollbarsAfterStateRestore();
        },
        setCanvasSize: (widthPx, heightPx) => {
            hooks.display.setCanvasSize(widthPx, heightPx);
        },
        refreshUiAfterQueuedAnimation: () => {
            hooks.ui.refreshUiAfterQueuedAnimation();
        },
        updateInputs: () => {
            hooks.ui.updateInputs();
        },
        updateMaskList: () => {
            hooks.ui.updateMaskList();
        },
        updateMaskListSelection: (mask) => {
            hooks.ui.updateMaskListSelection(mask);
        },
        updateAnnotationList: () => {
            hooks.ui.updateAnnotationList();
        },
        updateAnnotationListSelection: (annotation) => {
            hooks.ui.updateAnnotationListSelection(annotation);
        },
        updateUi: () => {
            hooks.ui.updateUi();
        },
        saveState: () => {
            hooks.state.saveCanvasState();
        },
        removeLabelForMask: (mask) => {
            hooks.labels.removeLabelForMask(mask);
        },
        showLabelForMask: (mask) => {
            hooks.labels.showLabelForMask(mask);
        },
        syncMaskLabel: (mask) => {
            hooks.labels.syncMaskLabel(mask);
        },
        hideAllMaskLabels: () => {
            hooks.labels.hideAllMaskLabels();
        },
        handleSelectionChanged: (selected) => {
            hooks.selection.handleSelectionChanged(selected);
        },
        updateSelectedAnnotation: (config) => {
            hooks.config.updateSelectedAnnotation(config);
        },
        setTextColor: (color) => {
            hooks.config.setTextColor(color);
        },
        setTextFontSize: (size) => {
            hooks.config.setTextFontSize(size);
        },
        setDrawColor: (color) => {
            hooks.config.setDrawColor(color);
        },
        setDrawBrushSize: (size) => {
            hooks.config.setDrawBrushSize(size);
        },
        emitImageCleared: (image, context) => {
            hooks.callbacks.emitImageCleared(image, context);
        },
        emitSelectionChange: (selection, context) => {
            hooks.callbacks.emitSelectionChange(selection, context);
        },
        emitMasksChanged: (context) => {
            hooks.callbacks.emitMasksChanged(context);
        },
        emitAnnotationsChanged: (context) => {
            hooks.callbacks.emitAnnotationsChanged(context);
        },
        emitImageChanged: (context) => {
            hooks.callbacks.emitImageChanged(context);
        },
        emitBusyChangeIfChanged: (context) => {
            hooks.callbacks.emitBusyChangeIfChanged(context);
        },
        reportWarning: (error, message) => {
            hooks.callbacks.reportWarning(error, message);
        },
        withAnimationQueueBypass: () => hooks.operations.withAnimationQueueBypass(),
    };
}

class EditorRuntime {
    constructor(fabricModule, isFabricLoaded, options, historyManager = new DeferredHistoryPort(options.maxHistorySize)) {
        Object.defineProperty(this, "fabricModule", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "isFabricLoaded", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "options", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "currentLayoutMode", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "defaultMosaicConfig", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "currentMosaicConfig", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "defaultTextConfig", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "currentTextConfig", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "defaultDrawConfig", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "currentDrawConfig", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "defaultEraserConfig", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "currentEraserConfig", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "defaultShapeConfig", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "currentShapeConfig", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "canvas", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "canvasElement", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "containerElement", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "placeholderElement", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "elements", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: {}
        });
        Object.defineProperty(this, "elementOriginalDisabledMap", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "elementOriginalAriaDisabledMap", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "elementOriginalPointerEventsMap", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "originalImage", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "baseImageScale", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 1
        });
        Object.defineProperty(this, "currentScale", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 1
        });
        Object.defineProperty(this, "currentRotation", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "isImageLoadedToCanvas", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "currentImageMimeType", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "currentImageFilterConfig", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "lastCommittedImageFilterConfig", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "maskCounter", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "lastMask", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "annotationCounter", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "lastSnapshot", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "historyManager", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "operationGuard", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new plugins_transform_index.OperationGuard()
        });
        Object.defineProperty(this, "animQueue", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new plugins_transform_index.AnimationQueue()
        });
        Object.defineProperty(this, "transformController", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "viewportCache", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new core_index.ViewportCache()
        });
        Object.defineProperty(this, "cropSession", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "mosaicSession", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "textSession", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "drawSession", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "shapeSession", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "domBindings", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "keyboardDocument", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "keyboardHandler", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "isDisposed", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "shouldSuppressSaveState", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "shouldSuppressSelectionChange", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "lastEmittedIsBusy", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "lastEmittedToolMode", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "lastEmittedHistoryState", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "activeStateRestoreOperation", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "nextSelectionChangeContext", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        this.fabricModule = fabricModule;
        this.isFabricLoaded = isFabricLoaded;
        this.options = options;
        this.currentLayoutMode = options.layoutMode;
        this.defaultMosaicConfig = options.defaultMosaicConfig;
        this.currentMosaicConfig = cloneResolvedMosaicConfig(this.defaultMosaicConfig);
        this.defaultTextConfig = options.defaultTextConfig;
        this.currentTextConfig = cloneResolvedTextAnnotationConfig(this.defaultTextConfig);
        this.defaultDrawConfig = options.defaultDrawConfig;
        this.currentDrawConfig = cloneResolvedDrawConfig(this.defaultDrawConfig);
        this.defaultEraserConfig = options.defaultEraserConfig;
        this.currentEraserConfig = cloneResolvedEraserConfig(this.defaultEraserConfig);
        this.defaultShapeConfig = options.defaultShapeConfig;
        this.currentShapeConfig = cloneResolvedShapeAnnotationConfig(this.defaultShapeConfig);
        this.currentImageFilterConfig = cloneResolvedImageFilterConfig(DEFAULT_IMAGE_FILTER_CONFIG);
        this.lastCommittedImageFilterConfig = cloneResolvedImageFilterConfig(DEFAULT_IMAGE_FILTER_CONFIG);
        this.historyManager = historyManager;
        this.lastEmittedHistoryState = {
            canUndo: this.historyManager.canUndo(),
            canRedo: this.historyManager.canRedo(),
        };
    }
    getRuntimeOptions() {
        if (this.currentLayoutMode === this.options.layoutMode)
            return this.options;
        return Object.freeze({
            ...this.options,
            layoutMode: this.currentLayoutMode,
        });
    }
    getLiveCanvasOrThrow(operationName) {
        if (this.isDisposed || !this.canvas) {
            throw new Error(`[ImageEditor] Cannot run "${operationName}" after dispose.`);
        }
        return this.canvas;
    }
    isImageLoaded() {
        return !!(this.originalImage &&
            plugins_mask_index.isBaseImageObject(this.originalImage) &&
            Number(this.originalImage.width) > 0 &&
            Number(this.originalImage.height) > 0);
    }
    isBusy(isToolModeActive = false) {
        return this.operationGuard.isBusy() || this.animQueue.isBusy() || isToolModeActive;
    }
    resetAfterDispose() {
        this.canvas = null;
        this.canvasElement = null;
        this.containerElement = null;
        this.placeholderElement = null;
        this.elements = {};
        this.elementOriginalDisabledMap.clear();
        this.elementOriginalAriaDisabledMap.clear();
        this.elementOriginalPointerEventsMap.clear();
        this.isImageLoadedToCanvas = false;
        this.originalImage = null;
        this.currentImageMimeType = null;
        this.currentImageFilterConfig = cloneResolvedImageFilterConfig(DEFAULT_IMAGE_FILTER_CONFIG);
        this.lastCommittedImageFilterConfig = cloneResolvedImageFilterConfig(DEFAULT_IMAGE_FILTER_CONFIG);
        this.lastMask = null;
        this.maskCounter = 0;
        this.annotationCounter = 0;
        this.currentScale = 1;
        this.currentRotation = 0;
        this.baseImageScale = 1;
        this.lastSnapshot = null;
        this.historyManager.clear();
        this.transformController = null;
        this.cropSession = null;
        this.mosaicSession = null;
        this.textSession = null;
        this.drawSession = null;
        this.shapeSession = null;
        this.domBindings = null;
        this.keyboardDocument = null;
        this.keyboardHandler = null;
        this.currentMosaicConfig = cloneResolvedMosaicConfig(this.defaultMosaicConfig);
        this.currentTextConfig = cloneResolvedTextAnnotationConfig(this.defaultTextConfig);
        this.currentDrawConfig = cloneResolvedDrawConfig(this.defaultDrawConfig);
        this.currentEraserConfig = cloneResolvedEraserConfig(this.defaultEraserConfig);
        this.currentShapeConfig = cloneResolvedShapeAnnotationConfig(this.defaultShapeConfig);
        this.shouldSuppressSaveState = false;
        this.shouldSuppressSelectionChange = false;
        this.lastEmittedIsBusy = null;
        this.lastEmittedToolMode = null;
        this.lastEmittedHistoryState = { canUndo: false, canRedo: false };
        this.activeStateRestoreOperation = null;
        this.nextSelectionChangeContext = null;
        this.viewportCache.clear();
    }
}

function handleSelectionChanged(access, selected) {
    var _a, _b, _c;
    const canvas = access.getCanvas();
    if (!canvas)
        return;
    const selectedMask = (_a = selected.find(plugins_mask_index.isMaskObject)) !== null && _a !== void 0 ? _a : null;
    const selectedAnnotation = (_b = selected.find(plugins_mask_index.isAnnotationObject)) !== null && _b !== void 0 ? _b : null;
    const masks = canvas.getObjects().filter(plugins_mask_index.isMaskObject);
    masks.forEach((maskObject) => {
        if (maskObject !== selectedMask) {
            if (maskObject.labelObject) {
                access.removeLabelForMask(maskObject);
            }
            plugins_mask_index.applyMaskUnselectedStyle(maskObject);
        }
        else {
            plugins_mask_index.applyMaskSelectedStyle(maskObject);
        }
    });
    if (selectedMask)
        access.showLabelForMask(selectedMask);
    access.updateMaskListSelection(selectedMask);
    access.updateAnnotationListSelection(selectedAnnotation);
    canvas.requestRenderAll();
    access.updateUi();
    if (access.shouldSuppressSelectionChange())
        return;
    const activeStateRestoreOperation = access.getActiveStateRestoreOperation();
    const context = (_c = access.getNextSelectionChangeContext()) !== null && _c !== void 0 ? _c : access.buildCallbackContext(activeStateRestoreOperation !== null && activeStateRestoreOperation !== void 0 ? activeStateRestoreOperation : 'createMask', activeStateRestoreOperation === 'undo' || activeStateRestoreOperation === 'redo');
    access.emitSelectionChange(access.buildSelection(selected), context);
}
function handleObjectMovingScalingRotating(access, target) {
    if (plugins_mask_index.isMaskObject(target)) {
        access.syncMaskLabel(target);
    }
}
function handleObjectModified(access, target) {
    if (plugins_mask_index.isMaskObject(target)) {
        access.syncMaskLabel(target);
        const context = access.buildCallbackContext('saveState', false);
        access.saveState();
        access.emitMasksChanged(context);
        access.emitImageChanged(context);
        return;
    }
    if (plugins_mask_index.isAnnotationObject(target)) {
        if (isAnnotationLocked(target))
            return;
        if (plugins_mask_index.isTextAnnotationObject(target)) {
            const textTarget = target;
            if (textTarget.imageEditorTextEditingHandledChange === true) {
                delete textTarget.imageEditorTextEditingHandledChange;
                return;
            }
        }
        const context = access.buildCallbackContext('updateAnnotation', false);
        access.saveState();
        access.emitAnnotationsChanged(context);
        access.emitImageChanged(context);
    }
}

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
function removeSelectedAnnotationAction(access, context) {
    const before = access.getAnnotations().length;
    access.withSelectionChangeContext(context, () => {
        removeSelectedAnnotation(access.buildAnnotationManagerContext());
    });
    access.updateAnnotationList();
    access.updateUi();
    if (access.getAnnotations().length !== before) {
        access.emitAnnotationsChanged(context);
        access.emitImageChanged(context);
    }
}
function removeAllAnnotationsAction(access, options, context) {
    const before = access.getAnnotations().length;
    access.withSelectionChangeContext(context, () => {
        removeAllAnnotations(access.buildAnnotationManagerContext(), options);
    });
    access.updateAnnotationList();
    access.updateUi();
    if (access.getAnnotations().length !== before) {
        access.emitAnnotationsChanged(context);
        access.emitImageChanged(context);
    }
}
function updateAnnotationAction(access, annotationId, config, context) {
    const changed = updateAnnotation(access.buildAnnotationManagerContext(), annotationId, config);
    if (changed) {
        access.updateAnnotationList();
        access.emitAnnotationsChanged(context);
        access.emitImageChanged(context);
    }
}
function updateSelectedAnnotationAction(access, config, context) {
    const changed = updateSelectedAnnotation(access.buildAnnotationManagerContext(), config);
    if (changed) {
        access.updateAnnotationList();
        access.emitAnnotationsChanged(context);
        access.emitImageChanged(context);
    }
}
function deleteSelectedEditableObjects(access, context) {
    const canvas = access.getCanvas();
    if (!canvas)
        return;
    const selectedObjects = getSelectedCanvasObjects(canvas);
    const selectedMasks = selectedObjects.filter(plugins_mask_index.isMaskObject);
    const selectedAnnotations = selectedObjects.filter((object) => plugins_mask_index.isAnnotationObject(object) && isAnnotationUnlocked(object));
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
function moveSelectedEditableObject(access, operation) {
    const canvas = access.getCanvas();
    if (!canvas)
        return;
    const selected = getSelectedCanvasObjects(canvas).filter(plugins_mask_index.isEditableOverlayObject);
    if (selected.length !== 1) {
        if (selected.length > 1) {
            access.reportWarning(`${operation} skipped: ActiveSelection layer moves are not supported.`);
        }
        return;
    }
    const object = selected[0];
    const range = plugins_mask_index.getEditableOverlayRange(canvas);
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
    plugins_mask_index.normalizeLayerOrder(canvas);
    canvas.setActiveObject(object);
    canvas.renderAll();
    access.saveState();
    access.updateMaskList();
    access.updateAnnotationList();
    if (plugins_mask_index.isMaskObject(object)) {
        access.updateMaskListSelection(object);
    }
    else if (plugins_mask_index.isAnnotationObject(object)) {
        access.updateAnnotationListSelection(object);
    }
    access.updateUi();
    const context = access.buildCallbackContext(operation, false);
    if (plugins_mask_index.isMaskObject(object))
        access.emitMasksChanged(context);
    if (plugins_mask_index.isAnnotationObject(object))
        access.emitAnnotationsChanged(context);
    access.emitImageChanged(context);
}

function normalizeRotationDegrees(rotation) {
    const value = Number(rotation !== null && rotation !== void 0 ? rotation : 0);
    if (!Number.isFinite(value))
        return 0;
    return ((value % 360) + 360) % 360;
}
function imageNormalizedToSourcePixel(point, imageInfo) {
    return {
        x: point.x * imageInfo.naturalWidth,
        y: point.y * imageInfo.naturalHeight,
    };
}
function sourcePixelToImageNormalized(point, imageInfo) {
    return {
        x: point.x / imageInfo.naturalWidth,
        y: point.y / imageInfo.naturalHeight,
    };
}
function applyBaseImageTransform(point, imageInfo, transform) {
    const centerX = imageInfo.naturalWidth / 2;
    const centerY = imageInfo.naturalHeight / 2;
    let x = point.x - centerX;
    let y = point.y - centerY;
    if ((transform === null || transform === void 0 ? void 0 : transform.flipX) === true)
        x = -x;
    if ((transform === null || transform === void 0 ? void 0 : transform.flipY) === true)
        y = -y;
    const radians = (normalizeRotationDegrees(transform === null || transform === void 0 ? void 0 : transform.rotation) * Math.PI) / 180;
    if (radians !== 0) {
        const cos = Math.cos(radians);
        const sin = Math.sin(radians);
        const nextX = x * cos - y * sin;
        const nextY = x * sin + y * cos;
        x = nextX;
        y = nextY;
    }
    return { x: centerX + x, y: centerY + y };
}
function unapplyBaseImageTransform(point, imageInfo, transform) {
    const centerX = imageInfo.naturalWidth / 2;
    const centerY = imageInfo.naturalHeight / 2;
    let x = point.x - centerX;
    let y = point.y - centerY;
    const radians = (-normalizeRotationDegrees(transform === null || transform === void 0 ? void 0 : transform.rotation) * Math.PI) / 180;
    if (radians !== 0) {
        const cos = Math.cos(radians);
        const sin = Math.sin(radians);
        const nextX = x * cos - y * sin;
        const nextY = x * sin + y * cos;
        x = nextX;
        y = nextY;
    }
    if ((transform === null || transform === void 0 ? void 0 : transform.flipY) === true)
        y = -y;
    if ((transform === null || transform === void 0 ? void 0 : transform.flipX) === true)
        x = -x;
    return { x: centerX + x, y: centerY + y };
}
function sourcePixelToCanvas(point, geometry) {
    const transformed = applyBaseImageTransform(point, {
        naturalWidth: geometry.naturalWidth,
        naturalHeight: geometry.naturalHeight,
    }, geometry.transform);
    return {
        x: geometry.canvasCenterX + (transformed.x - geometry.naturalWidth / 2) * geometry.scaleX,
        y: geometry.canvasCenterY + (transformed.y - geometry.naturalHeight / 2) * geometry.scaleY,
    };
}
function canvasToSourcePixel(point, geometry) {
    const transformed = {
        x: geometry.naturalWidth / 2 + (point.x - geometry.canvasCenterX) / geometry.scaleX,
        y: geometry.naturalHeight / 2 + (point.y - geometry.canvasCenterY) / geometry.scaleY,
    };
    return unapplyBaseImageTransform(transformed, {
        naturalWidth: geometry.naturalWidth,
        naturalHeight: geometry.naturalHeight,
    }, geometry.transform);
}

const HEX_SHORT = /^#([0-9a-f]{3}|[0-9a-f]{4})$/i;
const HEX_LONG = /^#([0-9a-f]{6}|[0-9a-f]{8})$/i;
const RGB_FUNCTION = /^rgba?\((.+)\)$/i;
function toHexByte(value) {
    return Math.max(0, Math.min(255, Math.round(value)))
        .toString(16)
        .padStart(2, '0')
        .toUpperCase();
}
function normalizeHex(value) {
    const trimmed = value.trim();
    if (HEX_LONG.test(trimmed))
        return `#${trimmed.slice(1).toUpperCase()}`;
    if (!HEX_SHORT.test(trimmed))
        return null;
    const digits = trimmed.slice(1);
    const expanded = digits
        .split('')
        .map((digit) => `${digit}${digit}`)
        .join('')
        .toUpperCase();
    return `#${expanded}`;
}
function parseRgbChannel(value) {
    const trimmed = value.trim();
    if (trimmed.endsWith('%')) {
        const percent = Number(trimmed.slice(0, -1));
        if (!Number.isFinite(percent))
            return null;
        return Math.max(0, Math.min(100, percent)) * 2.55;
    }
    const numeric = Number(trimmed);
    return Number.isFinite(numeric) ? numeric : null;
}
function parseAlpha(value) {
    if (value === undefined)
        return 1;
    const trimmed = value.trim();
    if (trimmed.endsWith('%')) {
        const percent = Number(trimmed.slice(0, -1));
        if (!Number.isFinite(percent))
            return null;
        return Math.max(0, Math.min(100, percent)) / 100;
    }
    const numeric = Number(trimmed);
    return Number.isFinite(numeric) ? Math.max(0, Math.min(1, numeric)) : null;
}
function normalizeRgbFunction(value) {
    const match = value.trim().match(RGB_FUNCTION);
    if (!match)
        return null;
    const parts = match[1].split(',').map((part) => part.trim());
    if (parts.length !== 3 && parts.length !== 4)
        return null;
    const r = parseRgbChannel(parts[0]);
    const g = parseRgbChannel(parts[1]);
    const b = parseRgbChannel(parts[2]);
    const alpha = parseAlpha(parts[3]);
    if (r === null || g === null || b === null || alpha === null)
        return null;
    const rgb = `${toHexByte(r)}${toHexByte(g)}${toHexByte(b)}`;
    return alpha >= 1 ? `#${rgb}` : `#${rgb}${toHexByte(alpha * 255)}`;
}
function tryNormalizeOverlayColor(value) {
    var _a;
    if (typeof value !== 'string')
        return null;
    if (value.trim().toLowerCase() === 'transparent')
        return '#00000000';
    return (_a = normalizeHex(value)) !== null && _a !== void 0 ? _a : normalizeRgbFunction(value);
}
function normalizeOverlayColor(value, fallback) {
    var _a;
    return (_a = tryNormalizeOverlayColor(value)) !== null && _a !== void 0 ? _a : fallback;
}

const DEFAULT_METADATA_DEPTH = 4;
const DEFAULT_METADATA_BYTES = 65536;
const METADATA_NAMESPACE = /^(core|app|plugin)\.[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*$/;
function getUtf8ByteLength(value) {
    if (typeof TextEncoder === 'function')
        return new TextEncoder().encode(value).byteLength;
    return value.length;
}
function metadataLimit(value, fallback) {
    return Number.isFinite(value) && Number(value) > 0 ? Math.floor(Number(value)) : fallback;
}
function addError$1(errors, path, code, message) {
    errors.push({ path, code, message });
}
function cloneJsonValue(input, path, depth, maxDepth, seen, errors) {
    if (input === null ||
        typeof input === 'string' ||
        typeof input === 'number' ||
        typeof input === 'boolean') {
        if (typeof input === 'number' && !Number.isFinite(input)) {
            addError$1(errors, path, 'metadata.invalidNumber', 'Metadata numbers must be finite.');
            return undefined;
        }
        return input;
    }
    if (input === undefined || typeof input === 'function' || typeof input === 'symbol') {
        addError$1(errors, path, 'metadata.invalidValue', 'Metadata must be JSON-compatible.');
        return undefined;
    }
    if (typeof input === 'bigint') {
        addError$1(errors, path, 'metadata.invalidBigInt', 'Metadata must not contain bigint.');
        return undefined;
    }
    if (!input || typeof input !== 'object')
        return input;
    if (seen.has(input)) {
        addError$1(errors, path, 'metadata.cyclic', 'Metadata must not contain cyclic references.');
        return undefined;
    }
    if (depth > maxDepth) {
        addError$1(errors, path, 'metadata.maxDepth', `Metadata exceeds max depth ${maxDepth}.`);
        return undefined;
    }
    seen.add(input);
    if (Array.isArray(input)) {
        const output = input.map((entry, index) => cloneJsonValue(entry, `${path}[${index}]`, depth + 1, maxDepth, seen, errors));
        seen.delete(input);
        return output;
    }
    const output = {};
    for (const [key, value] of Object.entries(input)) {
        if (key === '__proto__' || key === 'constructor' || key === 'prototype')
            continue;
        output[key] = cloneJsonValue(value, `${path}.${key}`, depth + 1, maxDepth, seen, errors);
    }
    seen.delete(input);
    return output;
}
function validateOverlayMetadata(input, path, options = {}) {
    const errors = [];
    const warnings = [];
    if (input === undefined)
        return { errors, warnings };
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
        addError$1(errors, path, 'metadata.invalidRoot', 'Metadata must be an object.');
        return { errors, warnings };
    }
    const maxDepth = metadataLimit(options.maxMetadataDepth, DEFAULT_METADATA_DEPTH);
    const maxBytes = metadataLimit(options.maxMetadataBytes, DEFAULT_METADATA_BYTES);
    const output = {};
    for (const [namespace, namespaceValue] of Object.entries(input)) {
        const namespacePath = `${path}.${namespace}`;
        if (!METADATA_NAMESPACE.test(namespace)) {
            addError$1(errors, namespacePath, 'metadata.invalidNamespace', `Metadata namespace "${namespace}" is not valid.`);
            continue;
        }
        if (!namespaceValue ||
            typeof namespaceValue !== 'object' ||
            Array.isArray(namespaceValue)) {
            addError$1(errors, namespacePath, 'metadata.invalidNamespaceValue', 'Metadata namespace values must be objects.');
            continue;
        }
        const cloned = cloneJsonValue(namespaceValue, namespacePath, 1, maxDepth, new WeakSet(), errors);
        if (cloned && typeof cloned === 'object' && !Array.isArray(cloned)) {
            output[namespace] = cloned;
        }
    }
    if (errors.length === 0) {
        const bytes = getUtf8ByteLength(JSON.stringify(output));
        if (bytes > maxBytes) {
            addError$1(errors, path, 'metadata.maxBytes', `Metadata size ${bytes} bytes exceeds maxMetadataBytes ${maxBytes}.`);
        }
    }
    return {
        value: errors.length === 0 ? output : undefined,
        errors,
        warnings,
    };
}
function cloneOverlayMetadata(metadata) {
    if (!metadata)
        return undefined;
    return JSON.parse(JSON.stringify(metadata));
}

function finiteNumber$1(value, fallback = 0) {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}
function clamp01(value) {
    if (!Number.isFinite(value))
        return 0;
    return Math.max(0, Math.min(1, value));
}
function normalizedPoint(point, geometry) {
    const source = canvasToSourcePixel(point, geometry);
    const normalized = sourcePixelToImageNormalized(source, {
        naturalWidth: geometry.naturalWidth,
        naturalHeight: geometry.naturalHeight,
    });
    return { x: clamp01(normalized.x), y: clamp01(normalized.y) };
}
function normalizedCanvasLengthX(length, geometry) {
    return clamp01(Math.abs(length / geometry.scaleX / geometry.naturalWidth));
}
function normalizedCanvasLengthY(length, geometry) {
    return clamp01(Math.abs(length / geometry.scaleY / geometry.naturalHeight));
}
function getObjectCenter$1(object) {
    var _a;
    const center = (_a = object.getCenterPoint) === null || _a === void 0 ? void 0 : _a.call(object);
    if (center)
        return { x: center.x, y: center.y };
    return {
        x: finiteNumber$1(object.left) + finiteNumber$1(object.width) / 2,
        y: finiteNumber$1(object.top) + finiteNumber$1(object.height) / 2,
    };
}
function createCurrentImageGeometry(image, currentRotation) {
    const center = getObjectCenter$1(image);
    return {
        naturalWidth: Math.max(1, finiteNumber$1(image.width, 1)),
        naturalHeight: Math.max(1, finiteNumber$1(image.height, 1)),
        canvasCenterX: center.x,
        canvasCenterY: center.y,
        scaleX: Math.max(0.000001, Math.abs(finiteNumber$1(image.scaleX, 1))),
        scaleY: Math.max(0.000001, Math.abs(finiteNumber$1(image.scaleY, 1))),
        transform: {
            rotation: normalizeRotationDegrees(currentRotation),
            flipX: image.flipX === true,
            flipY: image.flipY === true,
        },
    };
}
function getBaseImageTransform(image, currentRotation) {
    const rotation = normalizeRotationDegrees(currentRotation);
    const flipX = image.flipX === true;
    const flipY = image.flipY === true;
    if (rotation === 0 && !flipX && !flipY)
        return undefined;
    return {
        ...(rotation !== 0 ? { rotation } : {}),
        ...(flipX ? { flipX } : {}),
        ...(flipY ? { flipY } : {}),
    };
}
function getImageInfo(image, mimeType) {
    return {
        naturalWidth: Math.max(1, finiteNumber$1(image.width, 1)),
        naturalHeight: Math.max(1, finiteNumber$1(image.height, 1)),
        ...(mimeType ? { mimeType } : {}),
        orientation: 1,
    };
}
function getPersistentId(object) {
    const persistent = object.overlayPersistentId;
    if (typeof persistent === 'string' && persistent.trim() !== '')
        return persistent;
    if (plugins_mask_index.isMaskObject(object))
        return object.maskUid || `mask-${object.maskId}`;
    return `annotation-${object.annotationId}`;
}
function getPersistentMetadata(object, includeMetadata) {
    if (!includeMetadata)
        return undefined;
    const metadata = object.overlayMetadata;
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata))
        return undefined;
    return cloneOverlayMetadata(metadata);
}
function isHidden(object) {
    if (plugins_mask_index.isAnnotationObject(object) && object.annotationHidden === true)
        return true;
    return object.visible === false;
}
function isLocked(object) {
    return plugins_mask_index.isAnnotationObject(object) && object.annotationLocked === true;
}
function overlayBase(object, options) {
    const hidden = isHidden(object);
    const metadata = getPersistentMetadata(object, options.includeMetadata);
    return {
        id: getPersistentId(object),
        ...(hidden ? { hidden: true } : {}),
        ...(metadata ? { metadata } : {}),
    };
}
function localOverlayAngle(object, geometry) {
    var _a;
    const objectAngle = finiteNumber$1(object.angle);
    const baseRotation = normalizeRotationDegrees((_a = geometry.transform) === null || _a === void 0 ? void 0 : _a.rotation);
    const local = objectAngle - baseRotation;
    return Math.abs(local) < 0.000001 ? 0 : local;
}
function applyOptionalAngle(output, object, geometry) {
    const angle = localOverlayAngle(object, geometry);
    const target = output;
    if (angle !== 0)
        target.angle = angle;
    return target;
}
function exportMask(mask, geometry, options) {
    var _a, _b;
    const type = String((_a = mask.type) !== null && _a !== void 0 ? _a : '').toLowerCase();
    const base = overlayBase(mask, options);
    const fill = normalizeOverlayColor(mask.fill, '#000000');
    const alpha = clamp01(finiteNumber$1(mask.originalAlpha, finiteNumber$1(mask.opacity, 0.5)));
    const strokeSource = mask.originalStroke !== undefined ? mask.originalStroke : mask.stroke;
    const stroke = strokeSource === null
        ? null
        : strokeSource === undefined
            ? undefined
            : normalizeOverlayColor(strokeSource, '#000000');
    const strokeWidth = finiteNumber$1(mask.originalStrokeWidth, finiteNumber$1(mask.strokeWidth, 1));
    const style = {
        fill,
        alpha,
        ...(stroke !== undefined ? { stroke } : {}),
        strokeWidth,
        ...(Array.isArray(mask.strokeDashArray)
            ? { strokeDashArray: mask.strokeDashArray.map((entry) => finiteNumber$1(entry)) }
            : {}),
        ...(typeof mask.selectable === 'boolean' ? { selectable: mask.selectable } : {}),
        ...(typeof mask.evented === 'boolean' ? { evented: mask.evented } : {}),
        ...(typeof mask.hasControls === 'boolean' ? { hasControls: mask.hasControls } : {}),
    };
    if (type === 'rect') {
        const point = normalizedPoint({ x: finiteNumber$1(mask.left), y: finiteNumber$1(mask.top) }, geometry);
        return {
            kind: 'mask',
            ...base,
            maskShape: 'rect',
            geometry: applyOptionalAngle({
                type: 'rect',
                x: point.x,
                y: point.y,
                width: normalizedCanvasLengthX(finiteNumber$1(mask.width) * finiteNumber$1(mask.scaleX, 1), geometry),
                height: normalizedCanvasLengthY(finiteNumber$1(mask.height) * finiteNumber$1(mask.scaleY, 1), geometry),
                ...(finiteNumber$1(mask.rx) > 0
                    ? {
                        rx: normalizedCanvasLengthX(finiteNumber$1(mask.rx), geometry),
                    }
                    : {}),
                ...(finiteNumber$1(mask.ry) > 0
                    ? {
                        ry: normalizedCanvasLengthY(finiteNumber$1(mask.ry), geometry),
                    }
                    : {}),
            }, mask, geometry),
            style,
        };
    }
    if (type === 'circle') {
        const radius = finiteNumber$1(mask.radius) * finiteNumber$1(mask.scaleX, 1);
        const center = normalizedPoint({
            x: finiteNumber$1(mask.left) + radius,
            y: finiteNumber$1(mask.top) + radius,
        }, geometry);
        return {
            kind: 'mask',
            ...base,
            maskShape: 'circle',
            geometry: applyOptionalAngle({
                type: 'circle',
                cx: center.x,
                cy: center.y,
                radius: normalizedCanvasLengthX(radius, geometry),
            }, mask, geometry),
            style,
        };
    }
    if (type === 'ellipse') {
        const rx = finiteNumber$1(mask.rx) * finiteNumber$1(mask.scaleX, 1);
        const ry = finiteNumber$1(mask.ry) * finiteNumber$1(mask.scaleY, 1);
        const center = normalizedPoint({
            x: finiteNumber$1(mask.left) + rx,
            y: finiteNumber$1(mask.top) + ry,
        }, geometry);
        return {
            kind: 'mask',
            ...base,
            maskShape: 'ellipse',
            geometry: applyOptionalAngle({
                type: 'ellipse',
                cx: center.x,
                cy: center.y,
                rx: normalizedCanvasLengthX(rx, geometry),
                ry: normalizedCanvasLengthY(ry, geometry),
            }, mask, geometry),
            style,
        };
    }
    if (type === 'polygon' && Array.isArray(mask.points)) {
        const points = ((_b = mask.points) !== null && _b !== void 0 ? _b : []).map((point) => normalizedPoint({
            x: finiteNumber$1(mask.left) + finiteNumber$1(point.x),
            y: finiteNumber$1(mask.top) + finiteNumber$1(point.y),
        }, geometry));
        return {
            kind: 'mask',
            ...base,
            maskShape: 'polygon',
            geometry: applyOptionalAngle({ type: 'polygon', points }, mask, geometry),
            style,
        };
    }
    return null;
}
function transformPathPoint(annotation, point) {
    var _a, _b;
    const pathLike = annotation;
    const offset = (_a = pathLike.pathOffset) !== null && _a !== void 0 ? _a : { x: 0, y: 0 };
    const x = point.x - finiteNumber$1(offset.x);
    const y = point.y - finiteNumber$1(offset.y);
    const matrix = (_b = pathLike.calcTransformMatrix) === null || _b === void 0 ? void 0 : _b.call(pathLike);
    if (!Array.isArray(matrix) || matrix.length < 6) {
        return {
            x: finiteNumber$1(annotation.left) + point.x,
            y: finiteNumber$1(annotation.top) + point.y,
        };
    }
    const [a = 1, b = 0, c = 0, d = 1, e = 0, f = 0] = matrix;
    return {
        x: a * x + c * y + e,
        y: b * x + d * y + f,
    };
}
function extractPathPoints(annotation) {
    const pathData = annotation.path;
    return getPathPoints(pathData, (point) => transformPathPoint(annotation, point));
}
function exportTextAnnotation(annotation, geometry, options) {
    var _a;
    const text = annotation;
    const point = normalizedPoint({ x: finiteNumber$1(annotation.left), y: finiteNumber$1(annotation.top) }, geometry);
    const angle = localOverlayAngle(annotation, geometry);
    const width = finiteNumber$1(annotation.width) * finiteNumber$1(annotation.scaleX, 1);
    return {
        kind: 'annotation',
        annotationType: 'text',
        ...overlayBase(annotation, options),
        geometry: {
            x: point.x,
            y: point.y,
            ...(width > 0 ? { width: normalizedCanvasLengthX(width, geometry) } : {}),
            ...(angle !== 0 ? { angle } : {}),
        },
        text: { value: String((_a = text.text) !== null && _a !== void 0 ? _a : '') },
        style: {
            ...(finiteNumber$1(text.fontSize) > 0 ? { fontSize: finiteNumber$1(text.fontSize) } : {}),
            ...(typeof text.fontFamily === 'string' ? { fontFamily: text.fontFamily } : {}),
            ...(typeof text.fontWeight === 'string' || typeof text.fontWeight === 'number'
                ? { fontWeight: text.fontWeight }
                : {}),
            ...(text.fill !== undefined
                ? { fill: normalizeOverlayColor(text.fill, '#000000') }
                : {}),
            ...(text.backgroundColor !== undefined
                ? { backgroundColor: normalizeOverlayColor(text.backgroundColor, '#00000000') }
                : {}),
            ...(text.textAlign === 'left' ||
                text.textAlign === 'center' ||
                text.textAlign === 'right' ||
                text.textAlign === 'justify'
                ? { textAlign: text.textAlign }
                : {}),
            ...(finiteNumber$1(text.lineHeight) > 0
                ? { lineHeight: finiteNumber$1(text.lineHeight) }
                : {}),
        },
        ...(annotation.annotationLocked === true ? { locked: true } : {}),
    };
}
function exportShapeAnnotation(annotation, geometry, options) {
    const baseStyle = {
        ...(annotation.stroke !== undefined
            ? { stroke: normalizeOverlayColor(annotation.stroke, '#000000') }
            : {}),
        ...(finiteNumber$1(annotation.strokeWidth) >= 0
            ? { strokeWidth: finiteNumber$1(annotation.strokeWidth) }
            : {}),
        ...(annotation.fill !== undefined
            ? { fill: normalizeOverlayColor(annotation.fill, '#00000000') }
            : {}),
        ...(finiteNumber$1(annotation.opacity, 1) !== 1
            ? { opacity: clamp01(finiteNumber$1(annotation.opacity, 1)) }
            : {}),
        ...(Array.isArray(annotation.strokeDashArray)
            ? { strokeDashArray: annotation.strokeDashArray.map((entry) => finiteNumber$1(entry)) }
            : {}),
        ...(typeof annotation.selectable === 'boolean'
            ? { selectable: annotation.selectable }
            : {}),
        ...(typeof annotation.evented === 'boolean' ? { evented: annotation.evented } : {}),
    };
    const shape = annotation.shapeAnnotationKind;
    if (shape === 'rect') {
        const point = normalizedPoint({ x: finiteNumber$1(annotation.left), y: finiteNumber$1(annotation.top) }, geometry);
        const angle = localOverlayAngle(annotation, geometry);
        return {
            kind: 'annotation',
            annotationType: 'shape',
            ...overlayBase(annotation, options),
            shape: 'rect',
            geometry: {
                type: 'rect',
                x: point.x,
                y: point.y,
                width: normalizedCanvasLengthX(finiteNumber$1(annotation.width) * finiteNumber$1(annotation.scaleX, 1), geometry),
                height: normalizedCanvasLengthY(finiteNumber$1(annotation.height) * finiteNumber$1(annotation.scaleY, 1), geometry),
                ...(angle !== 0 ? { angle } : {}),
            },
            style: baseStyle,
            ...(annotation.annotationLocked === true ? { locked: true } : {}),
        };
    }
    const points = extractPathPoints(annotation);
    if (points.length < 2)
        return null;
    const first = normalizedPoint(points[0], geometry);
    const second = normalizedPoint(points[1], geometry);
    if (shape === 'line') {
        return {
            kind: 'annotation',
            annotationType: 'shape',
            ...overlayBase(annotation, options),
            shape: 'line',
            geometry: { type: 'line', x1: first.x, y1: first.y, x2: second.x, y2: second.y },
            style: baseStyle,
            ...(annotation.annotationLocked === true ? { locked: true } : {}),
        };
    }
    return {
        kind: 'annotation',
        annotationType: 'shape',
        ...overlayBase(annotation, options),
        shape: 'arrow',
        geometry: { type: 'arrow', x1: first.x, y1: first.y, x2: second.x, y2: second.y },
        style: baseStyle,
        ...(annotation.annotationLocked === true ? { locked: true } : {}),
    };
}
function exportDrawAnnotation(annotation, geometry, options) {
    const points = extractPathPoints(annotation).map((point) => normalizedPoint(point, geometry));
    return {
        kind: 'annotation',
        annotationType: 'draw',
        ...overlayBase(annotation, options),
        strokes: [
            {
                id: `${getPersistentId(annotation)}-stroke-1`,
                points,
                brush: {
                    color: normalizeOverlayColor(annotation.stroke, '#000000'),
                    width: finiteNumber$1(annotation.strokeWidth, 1),
                    ...(finiteNumber$1(annotation.opacity, 1) !== 1
                        ? { opacity: clamp01(finiteNumber$1(annotation.opacity, 1)) }
                        : {}),
                    lineCap: 'round',
                    lineJoin: 'round',
                },
            },
        ],
        ...(annotation.annotationLocked === true ? { locked: true } : {}),
    };
}
function exportAnnotation(annotation, geometry, options) {
    if (plugins_mask_index.isTextAnnotationObject(annotation)) {
        return exportTextAnnotation(annotation, geometry, options);
    }
    if (plugins_mask_index.isShapeAnnotationObject(annotation)) {
        return exportShapeAnnotation(annotation, geometry, options);
    }
    if (plugins_mask_index.isDrawAnnotationObject(annotation)) {
        return exportDrawAnnotation(annotation, geometry, options);
    }
    return null;
}
function exportOverlayState(context, options = {}) {
    const canvas = context.canvas;
    const image = context.originalImage;
    if (!canvas || !image) {
        throw new Error('[ImageEditor] exportOverlayState requires a loaded image.');
    }
    const resolvedOptions = {
        includeHidden: options.includeHidden !== false,
        includeLocked: options.includeLocked !== false,
        includeMetadata: options.includeMetadata !== false,
    };
    const imageInfo = getImageInfo(image, context.currentImageMimeType);
    const geometry = createCurrentImageGeometry(image, context.currentRotation);
    const overlays = canvas
        .getObjects()
        .filter(plugins_mask_index.isEditableOverlayObject)
        .filter((object) => resolvedOptions.includeHidden || !isHidden(object))
        .filter((object) => resolvedOptions.includeLocked || !isLocked(object))
        .map((object) => {
        if (plugins_mask_index.isMaskObject(object))
            return exportMask(object, geometry, resolvedOptions);
        if (plugins_mask_index.isAnnotationObject(object))
            return exportAnnotation(object, geometry, resolvedOptions);
        return null;
    })
        .filter((overlay) => !!overlay);
    const baseImageTransform = getBaseImageTransform(image, context.currentRotation);
    return {
        schema: 'image-editor.overlay-state',
        version: 1,
        image: imageInfo,
        coordinateSpace: 'image-normalized',
        ...(baseImageTransform ? { baseImageTransform } : {}),
        overlays,
    };
}

const registry = new Map();
function getOverlaySerializer(customType) {
    return registry.get(customType);
}

function finiteNumber(value, fallback = 0) {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}
function cloneMetadata(metadata) {
    return metadata ? JSON.parse(JSON.stringify(metadata)) : undefined;
}
function getObjectCenter(object) {
    var _a;
    const center = (_a = object.getCenterPoint) === null || _a === void 0 ? void 0 : _a.call(object);
    if (center)
        return { x: center.x, y: center.y };
    return {
        x: finiteNumber(object.left) + finiteNumber(object.width) / 2,
        y: finiteNumber(object.top) + finiteNumber(object.height) / 2,
    };
}
function createImportGeometry(image, transform) {
    const center = getObjectCenter(image);
    return {
        naturalWidth: Math.max(1, finiteNumber(image.width, 1)),
        naturalHeight: Math.max(1, finiteNumber(image.height, 1)),
        canvasCenterX: center.x,
        canvasCenterY: center.y,
        scaleX: Math.max(0.000001, Math.abs(finiteNumber(image.scaleX, 1))),
        scaleY: Math.max(0.000001, Math.abs(finiteNumber(image.scaleY, 1))),
        transform: {
            rotation: normalizeRotationDegrees(transform === null || transform === void 0 ? void 0 : transform.rotation),
            flipX: (transform === null || transform === void 0 ? void 0 : transform.flipX) === true,
            flipY: (transform === null || transform === void 0 ? void 0 : transform.flipY) === true,
        },
    };
}
function sourcePointFromNormalized(point, state) {
    return imageNormalizedToSourcePixel(point, state.image);
}
function canvasPointFromNormalized(point, state, geometry) {
    return sourcePixelToCanvas(sourcePointFromNormalized(point, state), geometry);
}
function normalizedLengthX(value, geometry) {
    return value * geometry.naturalWidth * geometry.scaleX;
}
function normalizedLengthY(value, geometry) {
    return value * geometry.naturalHeight * geometry.scaleY;
}
function nextMaskId(context) {
    const id = context.getMaskCounter() + 1;
    context.setMaskCounter(id);
    return id;
}
function nextAnnotationId(context) {
    const id = context.getAnnotationCounter() + 1;
    context.setAnnotationCounter(id);
    return id;
}
function newPersistentId(overlay, kind, runtimeId, options, existingPersistentIds, result) {
    if (options.idStrategy === 'preserve' && !existingPersistentIds.has(overlay.id)) {
        existingPersistentIds.add(overlay.id);
        return overlay.id;
    }
    const generated = `${kind}-${runtimeId}`;
    existingPersistentIds.add(generated);
    if (generated !== overlay.id) {
        result.regeneratedIds.push({ originalId: overlay.id, newId: generated });
    }
    return generated;
}
function assignPersistentFields(object, overlay, persistentId) {
    const target = object;
    target.overlayPersistentId = persistentId;
    const metadata = cloneMetadata(overlay.metadata);
    if (metadata)
        target.overlayMetadata = metadata;
}
function maskStyleProps(style) {
    var _a, _b, _c, _d, _e, _f;
    return {
        fill: style.fill,
        opacity: style.alpha,
        stroke: (_a = style.stroke) !== null && _a !== void 0 ? _a : undefined,
        strokeWidth: (_b = style.strokeWidth) !== null && _b !== void 0 ? _b : 1,
        strokeDashArray: (_c = style.strokeDashArray) !== null && _c !== void 0 ? _c : undefined,
        selectable: (_d = style.selectable) !== null && _d !== void 0 ? _d : true,
        evented: (_e = style.evented) !== null && _e !== void 0 ? _e : true,
        hasControls: (_f = style.hasControls) !== null && _f !== void 0 ? _f : true,
        originX: 'left',
        originY: 'top',
        strokeUniform: true,
    };
}
function createMaskObject(context, state, overlay, geometry) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    const fabric = context.fabric;
    let object;
    if (overlay.geometry.type === 'rect') {
        const point = canvasPointFromNormalized({ x: overlay.geometry.x, y: overlay.geometry.y }, state, geometry);
        object = new fabric.Rect({
            ...maskStyleProps(overlay.style),
            left: point.x,
            top: point.y,
            width: normalizedLengthX(overlay.geometry.width, geometry),
            height: normalizedLengthY(overlay.geometry.height, geometry),
            rx: overlay.geometry.rx !== undefined
                ? normalizedLengthX(overlay.geometry.rx, geometry)
                : undefined,
            ry: overlay.geometry.ry !== undefined
                ? normalizedLengthY(overlay.geometry.ry, geometry)
                : undefined,
            angle: normalizeRotationDegrees((_a = state.baseImageTransform) === null || _a === void 0 ? void 0 : _a.rotation) +
                finiteNumber(overlay.geometry.angle),
        });
    }
    else if (overlay.geometry.type === 'circle') {
        const radius = normalizedLengthX(overlay.geometry.radius, geometry);
        const center = canvasPointFromNormalized({ x: overlay.geometry.cx, y: overlay.geometry.cy }, state, geometry);
        object = new fabric.Circle({
            ...maskStyleProps(overlay.style),
            left: center.x - radius,
            top: center.y - radius,
            radius,
            angle: normalizeRotationDegrees((_b = state.baseImageTransform) === null || _b === void 0 ? void 0 : _b.rotation) +
                finiteNumber(overlay.geometry.angle),
        });
    }
    else if (overlay.geometry.type === 'ellipse') {
        const rx = normalizedLengthX(overlay.geometry.rx, geometry);
        const ry = normalizedLengthY(overlay.geometry.ry, geometry);
        const center = canvasPointFromNormalized({ x: overlay.geometry.cx, y: overlay.geometry.cy }, state, geometry);
        object = new fabric.Ellipse({
            ...maskStyleProps(overlay.style),
            left: center.x - rx,
            top: center.y - ry,
            rx,
            ry,
            angle: normalizeRotationDegrees((_c = state.baseImageTransform) === null || _c === void 0 ? void 0 : _c.rotation) +
                finiteNumber(overlay.geometry.angle),
        });
    }
    else {
        const points = overlay.geometry.points.map((point) => canvasPointFromNormalized(point, state, geometry));
        const minX = Math.min(...points.map((point) => point.x));
        const minY = Math.min(...points.map((point) => point.y));
        object = new fabric.Polygon(points.map((point) => ({ x: point.x - minX, y: point.y - minY })), {
            ...maskStyleProps(overlay.style),
            left: minX,
            top: minY,
            angle: normalizeRotationDegrees((_d = state.baseImageTransform) === null || _d === void 0 ? void 0 : _d.rotation) +
                finiteNumber(overlay.geometry.angle),
        });
    }
    const maskId = nextMaskId(context);
    const mask = plugins_mask_index.markMaskObject(object, {
        maskId,
        maskUid: `mask-${maskId}`,
        maskName: `${context.options.maskName}${maskId}`,
        originalAlpha: overlay.style.alpha,
        originalStroke: (_e = overlay.style.stroke) !== null && _e !== void 0 ? _e : null,
        originalStrokeWidth: (_f = overlay.style.strokeWidth) !== null && _f !== void 0 ? _f : 1,
    });
    mask.selectable = (_g = overlay.style.selectable) !== null && _g !== void 0 ? _g : true;
    mask.evented = (_h = overlay.style.evented) !== null && _h !== void 0 ? _h : true;
    mask.hasControls = (_j = overlay.style.hasControls) !== null && _j !== void 0 ? _j : true;
    mask.transparentCorners = false;
    mask.strokeUniform = true;
    plugins_mask_index.attachMaskHoverHandlers(mask);
    return mask;
}
function annotationBaseProps(locked) {
    return {
        annotationHidden: false,
        annotationLocked: locked === true,
    };
}
function createTextObject(context, state, overlay, geometry, warnings) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const point = canvasPointFromNormalized({ x: overlay.geometry.x, y: overlay.geometry.y }, state, geometry);
    const requestedFont = overlay.style.fontFamily;
    const fontFamily = requestedFont || context.options.defaultTextConfig.fontFamily;
    const metadata = (_a = cloneMetadata(overlay.metadata)) !== null && _a !== void 0 ? _a : {};
    if (requestedFont) {
        metadata['core.font'] = {
            ...((_b = metadata['core.font']) !== null && _b !== void 0 ? _b : {}),
            requestedFontFamily: requestedFont,
        };
        warnings.push({
            code: 'text.fontFamily.requested',
            path: `overlays.${overlay.id}.style.fontFamily`,
            message: `Text overlay requested fontFamily "${requestedFont}". Runtime font availability is host-dependent.`,
            details: { fontFamily: requestedFont },
        });
    }
    const textbox = new context.fabric.Textbox(overlay.text.value, {
        left: point.x,
        top: point.y,
        width: overlay.geometry.width !== undefined
            ? normalizedLengthX(overlay.geometry.width, geometry)
            : context.options.defaultTextConfig.width,
        fontSize: (_c = overlay.style.fontSize) !== null && _c !== void 0 ? _c : context.options.defaultTextConfig.fontSize,
        fontFamily,
        fontWeight: (_d = overlay.style.fontWeight) !== null && _d !== void 0 ? _d : context.options.defaultTextConfig.fontWeight,
        fill: (_e = overlay.style.fill) !== null && _e !== void 0 ? _e : context.options.defaultTextConfig.fill,
        backgroundColor: (_f = overlay.style.backgroundColor) !== null && _f !== void 0 ? _f : context.options.defaultTextConfig.backgroundColor,
        textAlign: (_g = overlay.style.textAlign) !== null && _g !== void 0 ? _g : context.options.defaultTextConfig.textAlign,
        lineHeight: overlay.style.lineHeight,
        angle: normalizeRotationDegrees((_h = state.baseImageTransform) === null || _h === void 0 ? void 0 : _h.rotation) +
            finiteNumber(overlay.geometry.angle),
        originX: 'left',
        originY: 'top',
        selectable: true,
        evented: true,
        editable: true,
    });
    const annotationId = nextAnnotationId(context);
    const annotation = plugins_mask_index.markAnnotationObject(textbox, {
        annotationId,
        annotationType: 'text',
        annotationName: `${context.options.textAnnotationName}${annotationId}`,
        annotationSelectable: true,
        annotationEvented: true,
        annotationHasControls: textbox.hasControls !== false,
        annotationEditable: true,
        ...annotationBaseProps(overlay.locked),
    });
    if (Object.keys(metadata).length > 0) {
        annotation.overlayMetadata = metadata;
    }
    syncAnnotationRuntimeState(annotation);
    attachTextEditingHandlers(context.buildTextControllerContext(), annotation);
    return annotation;
}
function buildArrowPath(x1, y1, x2, y2, headLength) {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const length = Math.max(1, headLength);
    const wingAngle = Math.PI / 7;
    const head1x = x2 - length * Math.cos(angle - wingAngle);
    const head1y = y2 - length * Math.sin(angle - wingAngle);
    const head2x = x2 - length * Math.cos(angle + wingAngle);
    const head2y = y2 - length * Math.sin(angle + wingAngle);
    return `M ${x1} ${y1} L ${x2} ${y2} M ${x2} ${y2} L ${head1x} ${head1y} M ${x2} ${y2} L ${head2x} ${head2y}`;
}
function createShapeObject(context, state, overlay, geometry) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
    const style = {
        stroke: (_a = overlay.style.stroke) !== null && _a !== void 0 ? _a : context.options.defaultShapeConfig.stroke,
        strokeWidth: (_b = overlay.style.strokeWidth) !== null && _b !== void 0 ? _b : context.options.defaultShapeConfig.strokeWidth,
        fill: (_c = overlay.style.fill) !== null && _c !== void 0 ? _c : context.options.defaultShapeConfig.fill,
        opacity: (_d = overlay.style.opacity) !== null && _d !== void 0 ? _d : context.options.defaultShapeConfig.opacity,
        strokeDashArray: (_e = overlay.style.strokeDashArray) !== null && _e !== void 0 ? _e : undefined,
        selectable: (_f = overlay.style.selectable) !== null && _f !== void 0 ? _f : true,
        evented: (_g = overlay.style.evented) !== null && _g !== void 0 ? _g : true,
        originX: 'left',
        originY: 'top',
    };
    let object;
    if (overlay.geometry.type === 'rect') {
        const point = canvasPointFromNormalized({ x: overlay.geometry.x, y: overlay.geometry.y }, state, geometry);
        object = new context.fabric.Rect({
            ...style,
            left: point.x,
            top: point.y,
            width: normalizedLengthX(overlay.geometry.width, geometry),
            height: normalizedLengthY(overlay.geometry.height, geometry),
            angle: normalizeRotationDegrees((_h = state.baseImageTransform) === null || _h === void 0 ? void 0 : _h.rotation) +
                finiteNumber(overlay.geometry.angle),
        });
    }
    else {
        const start = canvasPointFromNormalized({ x: overlay.geometry.x1, y: overlay.geometry.y1 }, state, geometry);
        const end = canvasPointFromNormalized({ x: overlay.geometry.x2, y: overlay.geometry.y2 }, state, geometry);
        const path = overlay.geometry.type === 'arrow'
            ? buildArrowPath(start.x, start.y, end.x, end.y, (_j = overlay.geometry.arrowHeadLength) !== null && _j !== void 0 ? _j : context.options.defaultShapeConfig.arrowHeadLength)
            : `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
        object = new context.fabric.Path(path, {
            ...style,
            fill: '',
            strokeLineCap: 'round',
            strokeLineJoin: 'round',
            objectCaching: false,
            angle: normalizeRotationDegrees((_k = state.baseImageTransform) === null || _k === void 0 ? void 0 : _k.rotation) +
                finiteNumber(overlay.geometry.angle),
        });
    }
    const annotationId = nextAnnotationId(context);
    const annotation = plugins_mask_index.markAnnotationObject(object, {
        annotationId,
        annotationType: 'shape',
        annotationName: `${context.options.shapeAnnotationName}${annotationId}`,
        annotationSelectable: (_l = overlay.style.selectable) !== null && _l !== void 0 ? _l : true,
        annotationEvented: (_m = overlay.style.evented) !== null && _m !== void 0 ? _m : true,
        annotationHasControls: object.hasControls !== false,
        shapeAnnotationKind: overlay.shape,
        ...annotationBaseProps(overlay.locked),
    });
    syncAnnotationRuntimeState(annotation);
    return annotation;
}
function createDrawObject(context, state, overlay, geometry) {
    var _a, _b, _c, _d;
    const commands = [];
    const firstStroke = overlay.strokes[0];
    const brush = (_a = firstStroke === null || firstStroke === void 0 ? void 0 : firstStroke.brush) !== null && _a !== void 0 ? _a : {
        color: context.options.defaultDrawConfig.color,
        width: context.options.defaultDrawConfig.brushSize,
    };
    for (const stroke of overlay.strokes) {
        stroke.points.forEach((point, index) => {
            const canvasPoint = canvasPointFromNormalized(point, state, geometry);
            commands.push(`${index === 0 ? 'M' : 'L'} ${canvasPoint.x} ${canvasPoint.y}`);
        });
    }
    const object = new context.fabric.Path(commands.join(' '), {
        fill: '',
        stroke: brush.color,
        strokeWidth: brush.width,
        opacity: (_b = brush.opacity) !== null && _b !== void 0 ? _b : context.options.defaultDrawConfig.opacity,
        strokeLineCap: (_c = brush.lineCap) !== null && _c !== void 0 ? _c : context.options.defaultDrawConfig.lineCap,
        strokeLineJoin: (_d = brush.lineJoin) !== null && _d !== void 0 ? _d : context.options.defaultDrawConfig.lineJoin,
        selectable: true,
        evented: true,
        objectCaching: false,
    });
    const annotationId = nextAnnotationId(context);
    const annotation = plugins_mask_index.markAnnotationObject(object, {
        annotationId,
        annotationType: 'draw',
        annotationName: `${context.options.drawAnnotationName}${annotationId}`,
        annotationSelectable: true,
        annotationEvented: true,
        annotationHasControls: object.hasControls !== false,
        ...annotationBaseProps(overlay.locked),
    });
    syncAnnotationRuntimeState(annotation);
    return annotation;
}
function removeExistingOverlays(context) {
    const objects = [...context.canvas.getObjects()];
    for (const object of objects) {
        if (plugins_mask_index.isMaskObject(object)) {
            context.removeLabelForMask(object);
            plugins_mask_index.detachMaskHoverHandlers(object);
            context.canvas.remove(object);
        }
        else if (plugins_mask_index.isAnnotationObject(object)) {
            context.canvas.remove(object);
        }
    }
    context.canvas.discardActiveObject();
    context.setLastMask(null);
}
function readExistingPersistentIds(canvas) {
    const ids = new Set();
    canvas.getObjects().forEach((object) => {
        const id = object.overlayPersistentId;
        if (typeof id === 'string')
            ids.add(id);
    });
    return ids;
}
function computeTopLeftPoint(object) {
    object.setCoords();
    const coords = object.getCoords();
    const first = coords[0];
    if (first)
        return first;
    const boundingRect = object.getBoundingRect();
    return { x: boundingRect.left, y: boundingRect.top };
}
function applyBaseTransformToImage(context, transform) {
    if (transform === undefined)
        return;
    const image = context.originalImage;
    const rotation = normalizeRotationDegrees(transform.rotation);
    const flipX = transform.flipX === true;
    const flipY = transform.flipY === true;
    const center = image.getCenterPoint();
    image.set({ originX: 'center', originY: 'center' });
    image.setPositionByOrigin(center, 'center', 'center');
    image.set({ angle: rotation, flipX, flipY });
    image.setCoords();
    const nextTopLeft = computeTopLeftPoint(image);
    image.set({ originX: 'left', originY: 'top' });
    image.setPositionByOrigin(nextTopLeft, 'left', 'top');
    image.setCoords();
    context.setCurrentRotation(rotation);
}
function skipCustomOverlay(overlay, result) {
    result.skippedOverlays += 1;
    result.warnings.push({
        code: 'custom.unknownType',
        path: `overlays.${overlay.id}`,
        message: `Custom overlay type "${overlay.customType}" has no registered importer and was skipped.`,
        details: { customType: overlay.customType },
    });
}
async function importOverlayStateIntoEditor(context, state, options = {}) {
    var _a;
    const result = {
        importedOverlays: 0,
        importedMasks: 0,
        importedAnnotations: 0,
        skippedOverlays: 0,
        regeneratedIds: [],
        warnings: [],
    };
    const mode = (_a = options.mode) !== null && _a !== void 0 ? _a : 'replace';
    if (mode === 'replace')
        removeExistingOverlays(context);
    applyBaseTransformToImage(context, state.baseImageTransform);
    const geometry = createImportGeometry(context.originalImage, state.baseImageTransform);
    const existingPersistentIds = readExistingPersistentIds(context.canvas);
    for (const overlay of state.overlays) {
        if (overlay.kind === 'custom') {
            const entry = getOverlaySerializer(overlay.customType);
            if (!entry) {
                skipCustomOverlay(overlay, result);
                continue;
            }
            await entry.import(overlay.data, { state });
            result.importedOverlays += 1;
            continue;
        }
        if (overlay.kind === 'mask') {
            const mask = createMaskObject(context, state, overlay, geometry);
            const persistentId = newPersistentId(overlay, 'mask', mask.maskId, options, existingPersistentIds, result);
            assignPersistentFields(mask, overlay, persistentId);
            plugins_mask_index.placeMaskObject(context.canvas, mask);
            context.setLastMask(mask);
            result.importedOverlays += 1;
            result.importedMasks += 1;
            continue;
        }
        let annotation;
        if (overlay.annotationType === 'text') {
            annotation = createTextObject(context, state, overlay, geometry, result.warnings);
        }
        else if (overlay.annotationType === 'shape') {
            annotation = createShapeObject(context, state, overlay, geometry);
        }
        else {
            annotation = createDrawObject(context, state, overlay, geometry);
        }
        const persistentId = newPersistentId(overlay, 'annotation', annotation.annotationId, options, existingPersistentIds, result);
        assignPersistentFields(annotation, overlay, persistentId);
        plugins_mask_index.placeAnnotationObject(context.canvas, annotation);
        if (annotation.selectable !== false && isAnnotationUnlocked(annotation)) {
            context.canvas.setActiveObject(annotation);
        }
        result.importedOverlays += 1;
        result.importedAnnotations += 1;
    }
    plugins_mask_index.normalizeLayerOrder(context.canvas);
    if (options.preserveSelection !== true) {
        context.canvas.discardActiveObject();
    }
    context.canvas.renderAll();
    return result;
}

function error(path, code, message) {
    return { path, code, message };
}
function migrateOverlayState(input) {
    const errors = [];
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
        errors.push(error('', 'state.invalidRoot', 'Overlay state must be an object.'));
        return { errors, warnings: [] };
    }
    const candidate = input;
    if (candidate.schema !== 'image-editor.overlay-state') {
        errors.push(error('schema', 'state.unsupportedSchema', 'Overlay state schema must be "image-editor.overlay-state".'));
        return { errors, warnings: [] };
    }
    if (typeof candidate.version !== 'number' || !Number.isInteger(candidate.version)) {
        errors.push(error('version', 'state.invalidVersion', 'Overlay state version is invalid.'));
        return { errors, warnings: [] };
    }
    if (candidate.version > 1) {
        errors.push(error('version', 'state.futureVersion', `Overlay state version ${candidate.version} is newer than supported overlay-state schema version 1.`));
        return { errors, warnings: [] };
    }
    if (candidate.version !== 1) {
        errors.push(error('version', 'state.unsupportedVersion', `Overlay state version ${candidate.version} is not supported.`));
        return { errors, warnings: [] };
    }
    return { state: candidate, errors, warnings: [] };
}

const DEFAULT_OVERLAY_VALIDATION_LIMITS = Object.freeze({
    maxOverlays: 500,
    maxPolygonPoints: 1000,
    maxDrawStrokes: 500,
    maxDrawPointsPerStroke: 5000,
    maxDrawTotalPoints: 100000,
    maxTextLength: 10000,
    maxMetadataDepth: DEFAULT_METADATA_DEPTH,
    maxMetadataBytes: DEFAULT_METADATA_BYTES,
});
function resolveLimits(options = {}) {
    const positive = (value, fallback) => Number.isFinite(value) && Number(value) > 0 ? Math.floor(Number(value)) : fallback;
    return {
        maxOverlays: positive(options.maxOverlays, DEFAULT_OVERLAY_VALIDATION_LIMITS.maxOverlays),
        maxPolygonPoints: positive(options.maxPolygonPoints, DEFAULT_OVERLAY_VALIDATION_LIMITS.maxPolygonPoints),
        maxDrawStrokes: positive(options.maxDrawStrokes, DEFAULT_OVERLAY_VALIDATION_LIMITS.maxDrawStrokes),
        maxDrawPointsPerStroke: positive(options.maxDrawPointsPerStroke, DEFAULT_OVERLAY_VALIDATION_LIMITS.maxDrawPointsPerStroke),
        maxDrawTotalPoints: positive(options.maxDrawTotalPoints, DEFAULT_OVERLAY_VALIDATION_LIMITS.maxDrawTotalPoints),
        maxTextLength: positive(options.maxTextLength, DEFAULT_OVERLAY_VALIDATION_LIMITS.maxTextLength),
        maxMetadataDepth: positive(options.maxMetadataDepth, DEFAULT_OVERLAY_VALIDATION_LIMITS.maxMetadataDepth),
        maxMetadataBytes: positive(options.maxMetadataBytes, DEFAULT_OVERLAY_VALIDATION_LIMITS.maxMetadataBytes),
    };
}
function addError(context, path, code, message) {
    context.errors.push({ path, code, message });
}
function addWarning(context, path, code, message, details) {
    context.warnings.push({ path, code, message, ...(details ? { details } : {}) });
}
function hasCycle(value, seen = new WeakSet()) {
    if (!value || typeof value !== 'object')
        return false;
    if (seen.has(value))
        return true;
    seen.add(value);
    if (Array.isArray(value))
        return value.some((entry) => hasCycle(entry, seen));
    return Object.values(value).some((entry) => hasCycle(entry, seen));
}
function isRecord(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}
function finite(value) {
    return typeof value === 'number' && Number.isFinite(value);
}
function readFinite(context, object, key, path, options = {}) {
    const value = object[key];
    if (value === undefined) {
        if (options.required)
            addError(context, path, 'number.required', `${path} is required.`);
        return undefined;
    }
    if (!finite(value)) {
        addError(context, path, 'number.invalid', `${path} must be a finite number.`);
        return undefined;
    }
    if (options.min !== undefined && value < options.min) {
        addError(context, path, 'number.min', `${path} must be >= ${options.min}.`);
    }
    if (options.max !== undefined && value > options.max) {
        addError(context, path, 'number.max', `${path} must be <= ${options.max}.`);
    }
    return value;
}
function readNormalized(context, object, key, path, required = true) {
    return readFinite(context, object, key, path, {
        required,
        min: 0,
        max: 1,
    });
}
function readBoolean(context, object, key, path) {
    const value = object[key];
    if (value === undefined)
        return undefined;
    if (typeof value !== 'boolean') {
        addError(context, path, 'boolean.invalid', `${path} must be a boolean.`);
        return undefined;
    }
    return value;
}
function readString(context, object, key, path, required = false) {
    const value = object[key];
    if (value === undefined) {
        if (required)
            addError(context, path, 'string.required', `${path} is required.`);
        return undefined;
    }
    if (typeof value !== 'string') {
        addError(context, path, 'string.invalid', `${path} must be a string.`);
        return undefined;
    }
    return value;
}
function normalizeColorField(context, value, path, required) {
    if (value === undefined || value === null) {
        if (required)
            addError(context, path, 'color.required', `${path} is required.`);
        return undefined;
    }
    const normalized = tryNormalizeOverlayColor(value);
    if (!normalized) {
        addError(context, path, 'color.invalid', `${path} must be #RRGGBB, #RRGGBBAA, rgb(), or rgba().`);
        return undefined;
    }
    return normalized;
}
function normalizeDashArray(context, value, path) {
    if (value === undefined)
        return undefined;
    if (value === null)
        return null;
    if (!Array.isArray(value)) {
        addError(context, path, 'dash.invalid', `${path} must be an array or null.`);
        return undefined;
    }
    const output = [];
    value.forEach((entry, index) => {
        if (!finite(entry) || entry < 0) {
            addError(context, `${path}[${index}]`, 'dash.invalidEntry', 'Dash entries must be non-negative finite numbers.');
            return;
        }
        output.push(entry);
    });
    return output;
}
function normalizeMetadata(context, value, path) {
    const result = validateOverlayMetadata(value, path, {
        maxMetadataDepth: context.limits.maxMetadataDepth,
        maxMetadataBytes: context.limits.maxMetadataBytes,
    });
    context.errors.push(...result.errors);
    context.warnings.push(...result.warnings);
    return result.value;
}
function normalizeOverlayId(context, value, path) {
    if (typeof value !== 'string' || value.trim() === '') {
        addError(context, path, 'overlay.id.invalid', `${path} must be a non-empty string.`);
        return '';
    }
    if (value.length > 256 || !/^[A-Za-z0-9._:-]+$/.test(value)) {
        addError(context, path, 'overlay.id.unsupported', `${path} contains unsupported characters.`);
    }
    return value;
}
function normalizeBaseOverlay(context, overlay, path) {
    const id = normalizeOverlayId(context, overlay.id, `${path}.id`);
    const version = overlay.overlayVersion;
    let overlayVersion;
    if (version !== undefined) {
        if (!Number.isInteger(version) || Number(version) <= 0) {
            addError(context, `${path}.overlayVersion`, 'overlay.version.invalid', 'overlayVersion must be a positive integer.');
        }
        else {
            overlayVersion = Number(version);
        }
    }
    const hidden = readBoolean(context, overlay, 'hidden', `${path}.hidden`);
    const metadata = normalizeMetadata(context, overlay.metadata, `${path}.metadata`);
    return {
        id,
        ...(overlayVersion !== undefined ? { overlayVersion } : {}),
        ...(hidden !== undefined ? { hidden } : {}),
        ...(metadata !== undefined ? { metadata } : {}),
    };
}
function validateImageInfo(context, value) {
    if (!isRecord(value)) {
        addError(context, 'image', 'image.invalid', 'image must be an object.');
        return undefined;
    }
    const naturalWidth = readFinite(context, value, 'naturalWidth', 'image.naturalWidth', {
        required: true,
        min: 1,
    });
    const naturalHeight = readFinite(context, value, 'naturalHeight', 'image.naturalHeight', {
        required: true,
        min: 1,
    });
    const mimeType = value.mimeType;
    const orientation = value.orientation;
    const sourceId = readString(context, value, 'sourceId', 'image.sourceId');
    const checksum = readString(context, value, 'checksum', 'image.checksum');
    if (mimeType !== undefined &&
        mimeType !== 'image/jpeg' &&
        mimeType !== 'image/png' &&
        mimeType !== 'image/webp') {
        addError(context, 'image.mimeType', 'image.mimeType.invalid', 'Unsupported image MIME type.');
    }
    if (orientation !== undefined && ![1, 2, 3, 4, 5, 6, 7, 8].includes(orientation)) {
        addError(context, 'image.orientation', 'image.orientation.invalid', 'EXIF orientation must be 1 through 8.');
    }
    if (naturalWidth === undefined || naturalHeight === undefined)
        return undefined;
    return {
        naturalWidth,
        naturalHeight,
        ...(typeof mimeType === 'string'
            ? { mimeType: mimeType }
            : {}),
        ...(typeof orientation === 'number'
            ? { orientation: orientation }
            : {}),
        ...(sourceId !== undefined ? { sourceId } : {}),
        ...(checksum !== undefined ? { checksum } : {}),
    };
}
function validateBaseImageTransform(context, value) {
    if (value === undefined)
        return undefined;
    if (!isRecord(value)) {
        addError(context, 'baseImageTransform', 'baseTransform.invalid', 'baseImageTransform must be an object.');
        return undefined;
    }
    const rotation = readFinite(context, value, 'rotation', 'baseImageTransform.rotation', {
        required: false,
    });
    const flipX = readBoolean(context, value, 'flipX', 'baseImageTransform.flipX');
    const flipY = readBoolean(context, value, 'flipY', 'baseImageTransform.flipY');
    return {
        ...(rotation !== undefined ? { rotation } : {}),
        ...(flipX !== undefined ? { flipX } : {}),
        ...(flipY !== undefined ? { flipY } : {}),
    };
}
function validateMaskOverlay(context, overlay, path) {
    const base = normalizeBaseOverlay(context, overlay, path);
    const maskShape = overlay.maskShape;
    if (maskShape !== 'rect' &&
        maskShape !== 'circle' &&
        maskShape !== 'ellipse' &&
        maskShape !== 'polygon') {
        addError(context, `${path}.maskShape`, 'mask.shape.invalid', 'Unsupported mask shape.');
        return null;
    }
    if (!isRecord(overlay.geometry)) {
        addError(context, `${path}.geometry`, 'mask.geometry.invalid', 'Mask geometry must be an object.');
        return null;
    }
    if (!isRecord(overlay.style)) {
        addError(context, `${path}.style`, 'mask.style.invalid', 'Mask style must be an object.');
        return null;
    }
    const geometry = overlay.geometry;
    let normalizedGeometry = null;
    if (maskShape === 'rect' && geometry.type === 'rect') {
        const x = readNormalized(context, geometry, 'x', `${path}.geometry.x`);
        const y = readNormalized(context, geometry, 'y', `${path}.geometry.y`);
        const width = readNormalized(context, geometry, 'width', `${path}.geometry.width`);
        const height = readNormalized(context, geometry, 'height', `${path}.geometry.height`);
        const rx = readNormalized(context, geometry, 'rx', `${path}.geometry.rx`, false);
        const ry = readNormalized(context, geometry, 'ry', `${path}.geometry.ry`, false);
        const angle = readFinite(context, geometry, 'angle', `${path}.geometry.angle`);
        if (x !== undefined && y !== undefined && width !== undefined && height !== undefined) {
            normalizedGeometry = {
                type: 'rect',
                x,
                y,
                width,
                height,
                ...(rx !== undefined ? { rx } : {}),
                ...(ry !== undefined ? { ry } : {}),
                ...(angle !== undefined ? { angle } : {}),
            };
        }
    }
    else if (maskShape === 'circle' && geometry.type === 'circle') {
        const cx = readNormalized(context, geometry, 'cx', `${path}.geometry.cx`);
        const cy = readNormalized(context, geometry, 'cy', `${path}.geometry.cy`);
        const radius = readNormalized(context, geometry, 'radius', `${path}.geometry.radius`);
        const angle = readFinite(context, geometry, 'angle', `${path}.geometry.angle`);
        if (cx !== undefined && cy !== undefined && radius !== undefined) {
            normalizedGeometry = {
                type: 'circle',
                cx,
                cy,
                radius,
                ...(angle !== undefined ? { angle } : {}),
            };
        }
    }
    else if (maskShape === 'ellipse' && geometry.type === 'ellipse') {
        const cx = readNormalized(context, geometry, 'cx', `${path}.geometry.cx`);
        const cy = readNormalized(context, geometry, 'cy', `${path}.geometry.cy`);
        const rx = readNormalized(context, geometry, 'rx', `${path}.geometry.rx`);
        const ry = readNormalized(context, geometry, 'ry', `${path}.geometry.ry`);
        const angle = readFinite(context, geometry, 'angle', `${path}.geometry.angle`);
        if (cx !== undefined && cy !== undefined && rx !== undefined && ry !== undefined) {
            normalizedGeometry = {
                type: 'ellipse',
                cx,
                cy,
                rx,
                ry,
                ...(angle !== undefined ? { angle } : {}),
            };
        }
    }
    else if (maskShape === 'polygon' && geometry.type === 'polygon') {
        if (!Array.isArray(geometry.points)) {
            addError(context, `${path}.geometry.points`, 'mask.polygon.points.invalid', 'Polygon points must be an array.');
        }
        else if (geometry.points.length > context.limits.maxPolygonPoints) {
            addError(context, `${path}.geometry.points`, 'mask.polygon.points.max', `Polygon has ${geometry.points.length} points, exceeding maxPolygonPoints ${context.limits.maxPolygonPoints}.`);
        }
        else {
            const points = geometry.points.map((point, index) => {
                var _a, _b;
                if (!isRecord(point)) {
                    addError(context, `${path}.geometry.points[${index}]`, 'mask.polygon.point.invalid', 'Polygon point must be an object.');
                    return { x: 0, y: 0 };
                }
                return {
                    x: (_a = readNormalized(context, point, 'x', `${path}.geometry.points[${index}].x`)) !== null && _a !== void 0 ? _a : 0,
                    y: (_b = readNormalized(context, point, 'y', `${path}.geometry.points[${index}].y`)) !== null && _b !== void 0 ? _b : 0,
                };
            });
            const angle = readFinite(context, geometry, 'angle', `${path}.geometry.angle`);
            normalizedGeometry = {
                type: 'polygon',
                points,
                ...(angle !== undefined ? { angle } : {}),
            };
        }
    }
    else {
        addError(context, `${path}.geometry.type`, 'mask.geometry.typeMismatch', 'Mask geometry type must match maskShape.');
    }
    const style = overlay.style;
    const fill = normalizeColorField(context, style.fill, `${path}.style.fill`, true);
    const alpha = readFinite(context, style, 'alpha', `${path}.style.alpha`, {
        required: true,
        min: 0,
        max: 1,
    });
    const stroke = style.stroke === null
        ? null
        : normalizeColorField(context, style.stroke, `${path}.style.stroke`, false);
    const strokeWidth = readFinite(context, style, 'strokeWidth', `${path}.style.strokeWidth`, {
        min: 0,
    });
    const strokeDashArray = normalizeDashArray(context, style.strokeDashArray, `${path}.style.strokeDashArray`);
    const selectable = readBoolean(context, style, 'selectable', `${path}.style.selectable`);
    const evented = readBoolean(context, style, 'evented', `${path}.style.evented`);
    const hasControls = readBoolean(context, style, 'hasControls', `${path}.style.hasControls`);
    if (!normalizedGeometry || !fill || alpha === undefined)
        return null;
    return {
        kind: 'mask',
        ...base,
        maskShape,
        geometry: normalizedGeometry,
        style: {
            fill,
            alpha,
            ...(stroke !== undefined ? { stroke } : {}),
            ...(strokeWidth !== undefined ? { strokeWidth } : {}),
            ...(strokeDashArray !== undefined ? { strokeDashArray } : {}),
            ...(selectable !== undefined ? { selectable } : {}),
            ...(evented !== undefined ? { evented } : {}),
            ...(hasControls !== undefined ? { hasControls } : {}),
        },
    };
}
function validateTextOverlay(context, overlay, path) {
    var _a;
    const base = normalizeBaseOverlay(context, overlay, path);
    if (!isRecord(overlay.geometry) || !isRecord(overlay.text) || !isRecord(overlay.style)) {
        addError(context, path, 'text.invalid', 'Text overlays require geometry, text, and style objects.');
        return null;
    }
    const x = readNormalized(context, overlay.geometry, 'x', `${path}.geometry.x`);
    const y = readNormalized(context, overlay.geometry, 'y', `${path}.geometry.y`);
    const width = readNormalized(context, overlay.geometry, 'width', `${path}.geometry.width`, false);
    const angle = readFinite(context, overlay.geometry, 'angle', `${path}.geometry.angle`);
    const value = (_a = readString(context, overlay.text, 'value', `${path}.text.value`, true)) !== null && _a !== void 0 ? _a : '';
    if (value.length > context.limits.maxTextLength) {
        addError(context, `${path}.text.value`, 'text.maxLength', `Text length exceeds maxTextLength ${context.limits.maxTextLength}.`);
    }
    const fontSize = readFinite(context, overlay.style, 'fontSize', `${path}.style.fontSize`, {
        min: 0,
    });
    const fontFamily = readString(context, overlay.style, 'fontFamily', `${path}.style.fontFamily`);
    const fontWeight = overlay.style.fontWeight;
    if (fontWeight !== undefined &&
        typeof fontWeight !== 'string' &&
        (typeof fontWeight !== 'number' || !Number.isFinite(fontWeight))) {
        addError(context, `${path}.style.fontWeight`, 'text.fontWeight.invalid', 'fontWeight must be a string or finite number.');
    }
    const fill = normalizeColorField(context, overlay.style.fill, `${path}.style.fill`, false);
    const backgroundColor = normalizeColorField(context, overlay.style.backgroundColor, `${path}.style.backgroundColor`, false);
    const textAlign = overlay.style.textAlign;
    if (textAlign !== undefined &&
        textAlign !== 'left' &&
        textAlign !== 'center' &&
        textAlign !== 'right' &&
        textAlign !== 'justify') {
        addError(context, `${path}.style.textAlign`, 'text.align.invalid', 'Unsupported textAlign.');
    }
    const lineHeight = readFinite(context, overlay.style, 'lineHeight', `${path}.style.lineHeight`, { min: 0 });
    const locked = readBoolean(context, overlay, 'locked', `${path}.locked`);
    if (x === undefined || y === undefined)
        return null;
    return {
        kind: 'annotation',
        annotationType: 'text',
        ...base,
        geometry: {
            x,
            y,
            ...(width !== undefined ? { width } : {}),
            ...(angle !== undefined ? { angle } : {}),
        },
        text: { value },
        style: {
            ...(fontSize !== undefined ? { fontSize } : {}),
            ...(fontFamily !== undefined ? { fontFamily } : {}),
            ...(fontWeight !== undefined ? { fontWeight: fontWeight } : {}),
            ...(fill !== undefined ? { fill } : {}),
            ...(backgroundColor !== undefined ? { backgroundColor } : {}),
            ...(typeof textAlign === 'string'
                ? { textAlign: textAlign }
                : {}),
            ...(lineHeight !== undefined ? { lineHeight } : {}),
        },
        ...(locked !== undefined ? { locked } : {}),
    };
}
function validateShapeOverlay(context, overlay, path) {
    const base = normalizeBaseOverlay(context, overlay, path);
    const shape = overlay.shape;
    if (shape !== 'rect' && shape !== 'line' && shape !== 'arrow') {
        addError(context, `${path}.shape`, 'shape.invalid', 'Unsupported shape annotation kind.');
        return null;
    }
    if (!isRecord(overlay.geometry) || !isRecord(overlay.style)) {
        addError(context, path, 'shape.invalidObjects', 'Shape overlays require geometry and style objects.');
        return null;
    }
    let geometry = null;
    if (shape === 'rect' && overlay.geometry.type === 'rect') {
        const x = readNormalized(context, overlay.geometry, 'x', `${path}.geometry.x`);
        const y = readNormalized(context, overlay.geometry, 'y', `${path}.geometry.y`);
        const width = readNormalized(context, overlay.geometry, 'width', `${path}.geometry.width`);
        const height = readNormalized(context, overlay.geometry, 'height', `${path}.geometry.height`);
        const angle = readFinite(context, overlay.geometry, 'angle', `${path}.geometry.angle`);
        if (x !== undefined && y !== undefined && width !== undefined && height !== undefined) {
            geometry = {
                type: 'rect',
                x,
                y,
                width,
                height,
                ...(angle !== undefined ? { angle } : {}),
            };
        }
    }
    else if ((shape === 'line' || shape === 'arrow') && overlay.geometry.type === shape) {
        const x1 = readNormalized(context, overlay.geometry, 'x1', `${path}.geometry.x1`);
        const y1 = readNormalized(context, overlay.geometry, 'y1', `${path}.geometry.y1`);
        const x2 = readNormalized(context, overlay.geometry, 'x2', `${path}.geometry.x2`);
        const y2 = readNormalized(context, overlay.geometry, 'y2', `${path}.geometry.y2`);
        const angle = readFinite(context, overlay.geometry, 'angle', `${path}.geometry.angle`);
        if (x1 !== undefined && y1 !== undefined && x2 !== undefined && y2 !== undefined) {
            if (shape === 'line') {
                geometry = {
                    type: 'line',
                    x1,
                    y1,
                    x2,
                    y2,
                    ...(angle !== undefined ? { angle } : {}),
                };
            }
            else {
                const arrowHeadLength = readFinite(context, overlay.geometry, 'arrowHeadLength', `${path}.geometry.arrowHeadLength`, { min: 0 });
                geometry = {
                    type: 'arrow',
                    x1,
                    y1,
                    x2,
                    y2,
                    ...(arrowHeadLength !== undefined ? { arrowHeadLength } : {}),
                    ...(angle !== undefined ? { angle } : {}),
                };
            }
        }
    }
    else {
        addError(context, `${path}.geometry.type`, 'shape.geometry.typeMismatch', 'Shape geometry type must match shape.');
    }
    const stroke = normalizeColorField(context, overlay.style.stroke, `${path}.style.stroke`, false);
    const strokeWidth = readFinite(context, overlay.style, 'strokeWidth', `${path}.style.strokeWidth`, { min: 0 });
    const fill = normalizeColorField(context, overlay.style.fill, `${path}.style.fill`, false);
    const opacity = readFinite(context, overlay.style, 'opacity', `${path}.style.opacity`, {
        min: 0,
        max: 1,
    });
    const strokeDashArray = normalizeDashArray(context, overlay.style.strokeDashArray, `${path}.style.strokeDashArray`);
    const selectable = readBoolean(context, overlay.style, 'selectable', `${path}.style.selectable`);
    const evented = readBoolean(context, overlay.style, 'evented', `${path}.style.evented`);
    const locked = readBoolean(context, overlay, 'locked', `${path}.locked`);
    if (!geometry)
        return null;
    return {
        kind: 'annotation',
        annotationType: 'shape',
        ...base,
        shape,
        geometry,
        style: {
            ...(stroke !== undefined ? { stroke } : {}),
            ...(strokeWidth !== undefined ? { strokeWidth } : {}),
            ...(fill !== undefined ? { fill } : {}),
            ...(opacity !== undefined ? { opacity } : {}),
            ...(strokeDashArray !== undefined ? { strokeDashArray } : {}),
            ...(selectable !== undefined ? { selectable } : {}),
            ...(evented !== undefined ? { evented } : {}),
        },
        ...(locked !== undefined ? { locked } : {}),
    };
}
function normalizeDrawBrush(context, value, path) {
    if (!isRecord(value)) {
        addError(context, path, 'draw.brush.invalid', 'Draw brush must be an object.');
        return null;
    }
    const color = normalizeColorField(context, value.color, `${path}.color`, true);
    const width = readFinite(context, value, 'width', `${path}.width`, { required: true, min: 0 });
    const opacity = readFinite(context, value, 'opacity', `${path}.opacity`, { min: 0, max: 1 });
    const lineCap = value.lineCap;
    const lineJoin = value.lineJoin;
    if (lineCap !== undefined &&
        lineCap !== 'butt' &&
        lineCap !== 'round' &&
        lineCap !== 'square') {
        addError(context, `${path}.lineCap`, 'draw.lineCap.invalid', 'Unsupported lineCap.');
    }
    if (lineJoin !== undefined &&
        lineJoin !== 'bevel' &&
        lineJoin !== 'round' &&
        lineJoin !== 'miter') {
        addError(context, `${path}.lineJoin`, 'draw.lineJoin.invalid', 'Unsupported lineJoin.');
    }
    if (!color || width === undefined)
        return null;
    return {
        color,
        width,
        ...(opacity !== undefined ? { opacity } : {}),
        ...(typeof lineCap === 'string' ? { lineCap: lineCap } : {}),
        ...(typeof lineJoin === 'string' ? { lineJoin: lineJoin } : {}),
    };
}
function normalizeDrawPoint(context, value, path) {
    if (!isRecord(value)) {
        addError(context, path, 'draw.point.invalid', 'Draw points must be objects.');
        return null;
    }
    const x = readNormalized(context, value, 'x', `${path}.x`);
    const y = readNormalized(context, value, 'y', `${path}.y`);
    const pressure = readFinite(context, value, 'pressure', `${path}.pressure`, { min: 0, max: 1 });
    const t = readFinite(context, value, 't', `${path}.t`, { min: 0 });
    if (x === undefined || y === undefined)
        return null;
    return {
        x,
        y,
        ...(pressure !== undefined ? { pressure } : {}),
        ...(t !== undefined ? { t } : {}),
    };
}
function validateDrawOverlay(context, overlay, path) {
    const base = normalizeBaseOverlay(context, overlay, path);
    if (!Array.isArray(overlay.strokes)) {
        addError(context, `${path}.strokes`, 'draw.strokes.invalid', 'Draw strokes must be an array.');
        return null;
    }
    if (overlay.strokes.length > context.limits.maxDrawStrokes) {
        addError(context, `${path}.strokes`, 'draw.strokes.max', `Draw strokes exceed maxDrawStrokes ${context.limits.maxDrawStrokes}.`);
        return null;
    }
    const strokes = [];
    overlay.strokes.forEach((strokeValue, strokeIndex) => {
        const strokePath = `${path}.strokes[${strokeIndex}]`;
        if (!isRecord(strokeValue)) {
            addError(context, strokePath, 'draw.stroke.invalid', 'Draw stroke must be an object.');
            return;
        }
        const id = readString(context, strokeValue, 'id', `${strokePath}.id`);
        if (!Array.isArray(strokeValue.points)) {
            addError(context, `${strokePath}.points`, 'draw.points.invalid', 'Draw stroke points must be an array.');
            return;
        }
        if (strokeValue.points.length > context.limits.maxDrawPointsPerStroke) {
            addError(context, `${strokePath}.points`, 'draw.points.maxPerStroke', `Draw stroke exceeds maxDrawPointsPerStroke ${context.limits.maxDrawPointsPerStroke}.`);
        }
        const points = strokeValue.points
            .map((point, pointIndex) => normalizeDrawPoint(context, point, `${strokePath}.points[${pointIndex}]`))
            .filter((point) => !!point);
        context.drawTotalPoints += points.length;
        if (context.drawTotalPoints > context.limits.maxDrawTotalPoints) {
            addError(context, `${strokePath}.points`, 'draw.points.maxTotal', `Draw points exceed maxDrawTotalPoints ${context.limits.maxDrawTotalPoints}.`);
        }
        let previousT = -Infinity;
        points.forEach((point, pointIndex) => {
            if (point.t === undefined)
                return;
            if (point.t < previousT) {
                addError(context, `${strokePath}.points[${pointIndex}].t`, 'draw.t.notMonotonic', 'Draw point t values must be monotonically non-decreasing.');
            }
            previousT = point.t;
        });
        const brush = normalizeDrawBrush(context, strokeValue.brush, `${strokePath}.brush`);
        if (brush)
            strokes.push({ ...(id !== undefined ? { id } : {}), points, brush });
    });
    const locked = readBoolean(context, overlay, 'locked', `${path}.locked`);
    return {
        kind: 'annotation',
        annotationType: 'draw',
        ...base,
        strokes,
        ...(locked !== undefined ? { locked } : {}),
    };
}
function validateCustomOverlay(context, overlay, path) {
    const base = normalizeBaseOverlay(context, overlay, path);
    const customType = readString(context, overlay, 'customType', `${path}.customType`, true);
    if (customType &&
        !/^(builtin|app|plugin)\.[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*$/.test(customType)) {
        addError(context, `${path}.customType`, 'custom.type.invalid', 'customType must be namespaced.');
    }
    if (!isRecord(overlay.data)) {
        addError(context, `${path}.data`, 'custom.data.invalid', 'Custom overlay data must be an object.');
        return null;
    }
    const metadataResult = validateOverlayMetadata({ 'app.customData': overlay.data }, `${path}.data`, {
        maxMetadataDepth: context.limits.maxMetadataDepth,
        maxMetadataBytes: context.limits.maxMetadataBytes,
    });
    context.errors.push(...metadataResult.errors);
    if (customType && !getOverlaySerializer(customType)) {
        addWarning(context, path, 'custom.unknownType', `Custom overlay type "${customType}" has no registered importer and will be skipped.`, { customType });
    }
    return customType
        ? {
            kind: 'custom',
            ...base,
            customType,
            data: JSON.parse(JSON.stringify(overlay.data)),
        }
        : null;
}
function validateOverlay(context, value, index) {
    const path = `overlays[${index}]`;
    if (!isRecord(value)) {
        addError(context, path, 'overlay.invalid', 'Overlay must be an object.');
        return null;
    }
    if (value.kind === 'mask')
        return validateMaskOverlay(context, value, path);
    if (value.kind === 'custom')
        return validateCustomOverlay(context, value, path);
    if (value.kind === 'annotation') {
        if (value.annotationType === 'text')
            return validateTextOverlay(context, value, path);
        if (value.annotationType === 'shape')
            return validateShapeOverlay(context, value, path);
        if (value.annotationType === 'draw')
            return validateDrawOverlay(context, value, path);
        addError(context, `${path}.annotationType`, 'annotation.type.invalid', 'Unsupported annotation type.');
        return null;
    }
    addError(context, `${path}.kind`, 'overlay.kind.invalid', 'Unsupported overlay kind.');
    return null;
}
function validateOverlayState(input, options = {}) {
    const context = {
        limits: resolveLimits(options),
        errors: [],
        warnings: [],
        drawTotalPoints: 0,
    };
    if (hasCycle(input)) {
        addError(context, '', 'state.cyclic', 'Overlay state must not contain cyclic objects.');
        return { valid: false, errors: context.errors, warnings: context.warnings };
    }
    const migration = migrateOverlayState(input);
    context.errors.push(...migration.errors);
    context.warnings.push(...migration.warnings);
    if (!migration.state || context.errors.length > 0) {
        return { valid: false, errors: context.errors, warnings: context.warnings };
    }
    const raw = migration.state;
    const image = validateImageInfo(context, raw.image);
    if (raw.coordinateSpace !== 'image-normalized') {
        addError(context, 'coordinateSpace', 'state.coordinateSpace.invalid', 'coordinateSpace must be "image-normalized".');
    }
    const baseImageTransform = validateBaseImageTransform(context, raw.baseImageTransform);
    if (!Array.isArray(raw.overlays)) {
        addError(context, 'overlays', 'overlays.invalid', 'overlays must be an array.');
    }
    else if (raw.overlays.length > context.limits.maxOverlays) {
        addError(context, 'overlays', 'overlays.max', `Overlay count ${raw.overlays.length} exceeds maxOverlays ${context.limits.maxOverlays}.`);
    }
    const metadata = normalizeMetadata(context, raw.metadata, 'metadata');
    const overlays = Array.isArray(raw.overlays)
        ? raw.overlays
            .map((overlay, index) => validateOverlay(context, overlay, index))
            .filter((overlay) => !!overlay)
        : [];
    if (!image || context.errors.length > 0) {
        return { valid: false, errors: context.errors, warnings: context.warnings };
    }
    const state = {
        schema: 'image-editor.overlay-state',
        version: 1,
        image,
        coordinateSpace: 'image-normalized',
        ...(baseImageTransform !== undefined ? { baseImageTransform } : {}),
        overlays,
        ...(metadata !== undefined ? { metadata } : {}),
    };
    return { valid: true, state, errors: [], warnings: context.warnings };
}

function getCurrentMaskListCanvas(context) {
    var _a, _b;
    return (_b = (_a = context.getCanvas) === null || _a === void 0 ? void 0 : _a.call(context)) !== null && _b !== void 0 ? _b : context.canvas;
}
function orderMasksForList(masks, order) {
    const ordered = masks.slice();
    return order === 'back-to-front' ? ordered : ordered.reverse();
}
function renderMaskList(context) {
    const listEl = context.getListElement();
    const canvas = getCurrentMaskListCanvas(context);
    if (!listEl || !canvas)
        return;
    const ownerDocument = listEl.ownerDocument;
    listEl.innerHTML = '';
    orderMasksForList(canvas.getObjects().filter(plugins_mask_index.isMaskObject), context.listOrder).forEach((mask) => {
        const listItemElement = ownerDocument.createElement('li');
        listItemElement.className = 'list-group-item mask-item';
        listItemElement.textContent = mask.maskName;
        listItemElement.dataset.maskId = String(mask.maskId);
        listItemElement.addEventListener('click', () => {
            const id = Number(listItemElement.dataset.maskId);
            if (!Number.isFinite(id))
                return;
            const liveCanvas = getCurrentMaskListCanvas(context);
            if (!liveCanvas)
                return;
            const target = liveCanvas
                .getObjects()
                .find((o) => plugins_mask_index.isMaskObject(o) && o.maskId === id);
            if (!target)
                return;
            liveCanvas.setActiveObject(target);
            context.onMaskSelected(target);
        });
        listEl.appendChild(listItemElement);
    });
}
function updateMaskListSelection(context, selectedMask) {
    const listEl = context.getListElement();
    if (!listEl)
        return;
    const selectedId = selectedMask ? String(selectedMask.maskId) : null;
    listEl.querySelectorAll('.mask-item').forEach((item) => {
        const isSelected = selectedId !== null && item.dataset.maskId === selectedId;
        item.classList.toggle('active', isSelected);
    });
}

function safelyRemoveKeyboardListener(keyboardDocument, keyboardHandler) {
    if (!keyboardDocument || !keyboardHandler)
        return;
    try {
        keyboardDocument.removeEventListener('keydown', keyboardHandler);
    }
    catch {
    }
}
function safelyExitActiveSession(hasSession, canvas, exitSession, clearSession) {
    if (!hasSession || !canvas)
        return;
    try {
        exitSession();
    }
    catch {
    }
    clearSession();
}

class DomBindings {
    constructor(resolveElement, isDisposed) {
        Object.defineProperty(this, "registry", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "resolveElement", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "isDisposed", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.resolveElement = resolveElement;
        this.isDisposed = isDisposed;
    }
    bindIfExists(key, eventType, handler) {
        const element = this.resolveElement(key);
        if (!element)
            return false;
        const wrapped = (event) => {
            if (this.isDisposed())
                return;
            handler(event);
        };
        element.addEventListener(eventType, wrapped);
        this.registry.push({ elementKey: key, element, eventType, handler: wrapped });
        return true;
    }
    removeAll() {
        for (const entry of this.registry) {
            try {
                entry.element.removeEventListener(entry.eventType, entry.handler);
            }
            catch {
            }
        }
        this.registry = [];
    }
    size() {
        return this.registry.length;
    }
}

const CROP_MODE_CONTROL_KEYS = [
    'scalePercentageInput',
    'imageBrightnessInput',
    'imageContrastInput',
    'imageSaturationInput',
    'imageBlurInput',
    'imageSharpenInput',
    'imageGrayscaleInput',
    'imageSepiaInput',
    'imageVintageInput',
    'applyImageFiltersButton',
    'resetImageFiltersButton',
    'clearImageFiltersButton',
    'rotateLeftDegreesInput',
    'rotateRightDegreesInput',
    'rotateLeftButton',
    'rotateRightButton',
    'flipHorizontalButton',
    'flipVerticalButton',
    'createMaskButton',
    'removeSelectedMaskButton',
    'removeAllMasksButton',
    'mergeMasksButton',
    'mergeAnnotationsButton',
    'enterTextModeButton',
    'exitTextModeButton',
    'textColorInput',
    'textFontSizeInput',
    'enterDrawModeButton',
    'exitDrawModeButton',
    'drawColorInput',
    'drawBrushSizeInput',
    'drawBrushSubModeButton',
    'drawEraseSubModeButton',
    'eraserBrushSizeInput',
    'shapeKindSelect',
    'shapeStrokeInput',
    'shapeStrokeWidthInput',
    'shapeFillInput',
    'createShapeAnnotationButton',
    'enterShapeModeButton',
    'exitShapeModeButton',
    'removeSelectedAnnotationButton',
    'removeAllAnnotationsButton',
    'deleteSelectedObjectButton',
    'bringSelectedObjectForwardButton',
    'sendSelectedObjectBackwardButton',
    'bringSelectedObjectToFrontButton',
    'sendSelectedObjectToBackButton',
    'downloadImageButton',
    'zoomInButton',
    'zoomOutButton',
    'resetImageTransformButton',
    'undoButton',
    'redoButton',
    'imageInput',
    'enterCropModeButton',
    'cropAspectRatioSelect',
    'applyCropButton',
    'cancelCropButton',
    'enterMosaicModeButton',
    'exitMosaicModeButton',
    'mosaicBrushSizeInput',
    'mosaicBlockSizeInput',
];
const CROP_MODE_ENABLED_KEYS = [
    'cropAspectRatioSelect',
    'applyCropButton',
    'cancelCropButton',
];
const TEXT_MODE_CONTROL_KEYS = CROP_MODE_CONTROL_KEYS;
const TEXT_MODE_ENABLED_KEYS = [
    'exitTextModeButton',
    'textColorInput',
    'textFontSizeInput',
];
const DRAW_MODE_CONTROL_KEYS = CROP_MODE_CONTROL_KEYS;
const DRAW_MODE_ENABLED_KEYS = [
    'exitDrawModeButton',
    'drawColorInput',
    'drawBrushSizeInput',
    'drawBrushSubModeButton',
    'drawEraseSubModeButton',
    'eraserBrushSizeInput',
];
const SHAPE_MODE_CONTROL_KEYS = CROP_MODE_CONTROL_KEYS;
const SHAPE_MODE_ENABLED_KEYS = [
    'shapeKindSelect',
    'shapeStrokeInput',
    'shapeStrokeWidthInput',
    'shapeFillInput',
    'createShapeAnnotationButton',
    'enterShapeModeButton',
    'exitShapeModeButton',
];
const MOSAIC_MODE_CONTROL_KEYS = [
    'scalePercentageInput',
    'imageBrightnessInput',
    'imageContrastInput',
    'imageSaturationInput',
    'imageBlurInput',
    'imageSharpenInput',
    'imageGrayscaleInput',
    'imageSepiaInput',
    'imageVintageInput',
    'applyImageFiltersButton',
    'resetImageFiltersButton',
    'clearImageFiltersButton',
    'rotateLeftDegreesInput',
    'rotateRightDegreesInput',
    'rotateLeftButton',
    'rotateRightButton',
    'flipHorizontalButton',
    'flipVerticalButton',
    'createMaskButton',
    'removeSelectedMaskButton',
    'removeAllMasksButton',
    'mergeMasksButton',
    'mergeAnnotationsButton',
    'enterTextModeButton',
    'exitTextModeButton',
    'textColorInput',
    'textFontSizeInput',
    'enterDrawModeButton',
    'exitDrawModeButton',
    'drawColorInput',
    'drawBrushSizeInput',
    'drawBrushSubModeButton',
    'drawEraseSubModeButton',
    'eraserBrushSizeInput',
    'shapeKindSelect',
    'shapeStrokeInput',
    'shapeStrokeWidthInput',
    'shapeFillInput',
    'createShapeAnnotationButton',
    'enterShapeModeButton',
    'exitShapeModeButton',
    'removeSelectedAnnotationButton',
    'removeAllAnnotationsButton',
    'deleteSelectedObjectButton',
    'bringSelectedObjectForwardButton',
    'sendSelectedObjectBackwardButton',
    'bringSelectedObjectToFrontButton',
    'sendSelectedObjectToBackButton',
    'downloadImageButton',
    'zoomInButton',
    'zoomOutButton',
    'resetImageTransformButton',
    'undoButton',
    'redoButton',
    'imageInput',
    'enterCropModeButton',
    'cropAspectRatioSelect',
    'applyCropButton',
    'cancelCropButton',
    'enterMosaicModeButton',
    'exitMosaicModeButton',
    'mosaicBrushSizeInput',
    'mosaicBlockSizeInput',
];
const MOSAIC_MODE_ENABLED_KEYS = [
    'exitMosaicModeButton',
    'mosaicBrushSizeInput',
    'mosaicBlockSizeInput',
];
function setModeControlState(controlKeys, enabledKeys, snapshot, setEnabled) {
    controlKeys.forEach((key) => {
        setEnabled(key, !snapshot.isBusy && enabledKeys.includes(key));
    });
}
function applyEditorControlState(snapshot, setEnabled) {
    if (snapshot.isDisposed) {
        CROP_MODE_CONTROL_KEYS.forEach((key) => {
            setEnabled(key, false);
        });
        return;
    }
    if (snapshot.isInCropMode) {
        setModeControlState(CROP_MODE_CONTROL_KEYS, CROP_MODE_ENABLED_KEYS, snapshot, setEnabled);
        return;
    }
    if (snapshot.isInTextMode) {
        setModeControlState(TEXT_MODE_CONTROL_KEYS, TEXT_MODE_ENABLED_KEYS, snapshot, setEnabled);
        return;
    }
    if (snapshot.isInDrawMode) {
        setModeControlState(DRAW_MODE_CONTROL_KEYS, DRAW_MODE_ENABLED_KEYS, snapshot, setEnabled);
        return;
    }
    if (snapshot.isInShapeMode) {
        setModeControlState(SHAPE_MODE_CONTROL_KEYS, SHAPE_MODE_ENABLED_KEYS, snapshot, setEnabled);
        return;
    }
    if (snapshot.isInMosaicMode) {
        MOSAIC_MODE_CONTROL_KEYS.forEach((key) => {
            setEnabled(key, !snapshot.isBusy &&
                !snapshot.isMosaicApplying &&
                MOSAIC_MODE_ENABLED_KEYS.includes(key));
        });
        setEnabled('imageInput', false);
        return;
    }
    setEnabled('scalePercentageInput', snapshot.hasImage && !snapshot.isBusy);
    setEnabled('imageBrightnessInput', snapshot.hasImage && !snapshot.isBusy);
    setEnabled('imageContrastInput', snapshot.hasImage && !snapshot.isBusy);
    setEnabled('imageSaturationInput', snapshot.hasImage && !snapshot.isBusy);
    setEnabled('imageBlurInput', snapshot.hasImage && !snapshot.isBusy);
    setEnabled('imageSharpenInput', snapshot.hasImage && !snapshot.isBusy);
    setEnabled('imageGrayscaleInput', snapshot.hasImage && !snapshot.isBusy);
    setEnabled('imageSepiaInput', snapshot.hasImage && !snapshot.isBusy);
    setEnabled('imageVintageInput', snapshot.hasImage && !snapshot.isBusy);
    setEnabled('applyImageFiltersButton', snapshot.hasImage && !snapshot.isBusy);
    setEnabled('resetImageFiltersButton', snapshot.hasImage && !snapshot.isBusy);
    setEnabled('clearImageFiltersButton', snapshot.hasImage && !snapshot.isBusy);
    setEnabled('rotateLeftDegreesInput', snapshot.hasImage && !snapshot.isBusy);
    setEnabled('rotateRightDegreesInput', snapshot.hasImage && !snapshot.isBusy);
    setEnabled('zoomInButton', snapshot.hasImage && !snapshot.isBusy && snapshot.currentScale < snapshot.maxScale);
    setEnabled('zoomOutButton', snapshot.hasImage && !snapshot.isBusy && snapshot.currentScale > snapshot.minScale);
    setEnabled('rotateLeftButton', snapshot.hasImage && !snapshot.isBusy);
    setEnabled('rotateRightButton', snapshot.hasImage && !snapshot.isBusy);
    setEnabled('flipHorizontalButton', snapshot.hasImage && !snapshot.isBusy);
    setEnabled('flipVerticalButton', snapshot.hasImage && !snapshot.isBusy);
    setEnabled('createMaskButton', snapshot.hasImage && !snapshot.isBusy);
    setEnabled('removeSelectedMaskButton', snapshot.hasSelectedMask && !snapshot.isBusy);
    setEnabled('removeAllMasksButton', snapshot.hasMasks && !snapshot.isBusy);
    setEnabled('mergeMasksButton', snapshot.hasImage && snapshot.hasMasks && !snapshot.isBusy);
    setEnabled('removeSelectedAnnotationButton', snapshot.hasSelectedAnnotation && !snapshot.isBusy);
    setEnabled('removeAllAnnotationsButton', snapshot.hasAnnotations && !snapshot.isBusy);
    setEnabled('deleteSelectedObjectButton', snapshot.hasSelectedEditableObject && !snapshot.isBusy);
    setEnabled('mergeAnnotationsButton', snapshot.hasImage && snapshot.hasAnnotations && !snapshot.isBusy);
    setEnabled('bringSelectedObjectForwardButton', snapshot.hasSelectedEditableObject && !snapshot.isBusy);
    setEnabled('sendSelectedObjectBackwardButton', snapshot.hasSelectedEditableObject && !snapshot.isBusy);
    setEnabled('bringSelectedObjectToFrontButton', snapshot.hasSelectedEditableObject && !snapshot.isBusy);
    setEnabled('sendSelectedObjectToBackButton', snapshot.hasSelectedEditableObject && !snapshot.isBusy);
    setEnabled('downloadImageButton', snapshot.hasImage && !snapshot.isBusy);
    setEnabled('resetImageTransformButton', snapshot.hasImage && !snapshot.isDefaultTransform && !snapshot.isBusy);
    setEnabled('undoButton', snapshot.hasImage && !snapshot.isBusy && snapshot.canUndo);
    setEnabled('redoButton', snapshot.hasImage && !snapshot.isBusy && snapshot.canRedo);
    setEnabled('enterCropModeButton', snapshot.hasImage && !snapshot.isBusy);
    setEnabled('cropAspectRatioSelect', snapshot.hasImage && !snapshot.isBusy);
    setEnabled('enterMosaicModeButton', snapshot.hasImage && !snapshot.isBusy);
    setEnabled('enterTextModeButton', snapshot.hasImage && !snapshot.isBusy);
    setEnabled('enterDrawModeButton', snapshot.hasImage && !snapshot.isBusy);
    setEnabled('enterShapeModeButton', snapshot.hasImage && !snapshot.isBusy);
    setEnabled('createShapeAnnotationButton', snapshot.hasImage && !snapshot.isBusy);
    setEnabled('exitMosaicModeButton', false);
    setEnabled('exitTextModeButton', false);
    setEnabled('exitDrawModeButton', false);
    setEnabled('exitShapeModeButton', false);
    setEnabled('mosaicBrushSizeInput', !snapshot.isDisposed);
    setEnabled('mosaicBlockSizeInput', !snapshot.isDisposed);
    setEnabled('textColorInput', !snapshot.isDisposed);
    setEnabled('textFontSizeInput', !snapshot.isDisposed);
    setEnabled('drawColorInput', !snapshot.isDisposed);
    setEnabled('drawBrushSizeInput', !snapshot.isDisposed);
    setEnabled('drawBrushSubModeButton', false);
    setEnabled('drawEraseSubModeButton', false);
    setEnabled('eraserBrushSizeInput', !snapshot.isDisposed);
    setEnabled('shapeKindSelect', !snapshot.isDisposed);
    setEnabled('shapeStrokeInput', !snapshot.isDisposed);
    setEnabled('shapeStrokeWidthInput', !snapshot.isDisposed);
    setEnabled('shapeFillInput', !snapshot.isDisposed);
    setEnabled('imageInput', !snapshot.isBusy);
    setEnabled('applyCropButton', false);
    setEnabled('cancelCropButton', false);
}

function buildEditorControlSnapshot(runtime) {
    var _a, _b, _c;
    if (!runtime.canvas)
        return null;
    const hasImage = !!runtime.originalImage;
    const masks = hasImage ? runtime.canvas.getObjects().filter(plugins_mask_index.isMaskObject) : [];
    const annotations = hasImage ? runtime.canvas.getObjects().filter(plugins_mask_index.isAnnotationObject) : [];
    const activeObject = runtime.canvas.getActiveObject();
    return {
        hasImage,
        hasMasks: masks.length > 0,
        hasAnnotations: annotations.length > 0,
        hasSelectedMask: !!(activeObject && plugins_mask_index.isMaskObject(activeObject)),
        hasSelectedAnnotation: !!(activeObject && plugins_mask_index.isAnnotationObject(activeObject)),
        hasSelectedEditableObject: !!activeObject && plugins_mask_index.isEditableOverlayObject(activeObject),
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
        isInShapeMode: runtime.shapeSession !== null,
        isMosaicApplying: ((_c = runtime.mosaicSession) === null || _c === void 0 ? void 0 : _c.isApplying) === true,
    };
}

function recordElementOriginalState(context, key, element) {
    if (!context.originalAriaDisabledMap.has(key)) {
        context.originalAriaDisabledMap.set(key, element.getAttribute('aria-disabled'));
    }
    if (!context.originalPointerEventsMap.has(key)) {
        context.originalPointerEventsMap.set(key, element.style.pointerEvents || '');
    }
    if ('disabled' in element && !context.originalDisabledMap.has(key)) {
        context.originalDisabledMap.set(key, !!element.disabled);
    }
}
function setEditorControlEnabled(context, key, isEnabled) {
    var _a;
    const controlElement = context.getElement(key);
    if (!controlElement)
        return;
    recordElementOriginalState(context, key, controlElement);
    if ('disabled' in controlElement) {
        const formControl = controlElement;
        const nextDisabled = !isEnabled;
        if (formControl.disabled !== nextDisabled)
            formControl.disabled = nextDisabled;
        return;
    }
    if (!isEnabled) {
        controlElement.setAttribute('aria-disabled', 'true');
        controlElement.style.pointerEvents = 'none';
    }
    else {
        const originalAria = context.originalAriaDisabledMap.get(key);
        if (originalAria === null || originalAria === undefined) {
            controlElement.removeAttribute('aria-disabled');
        }
        else {
            controlElement.setAttribute('aria-disabled', originalAria);
        }
        controlElement.style.pointerEvents = (_a = context.originalPointerEventsMap.get(key)) !== null && _a !== void 0 ? _a : '';
    }
}
function restoreEditorControlOriginalStates(context) {
    var _a, _b;
    for (const key of Object.keys(context.elements)) {
        const element = context.getElement(key);
        if (!element)
            continue;
        if ('disabled' in element && context.originalDisabledMap.has(key)) {
            element.disabled =
                (_a = context.originalDisabledMap.get(key)) !== null && _a !== void 0 ? _a : false;
        }
        if (context.originalAriaDisabledMap.has(key)) {
            const originalAria = context.originalAriaDisabledMap.get(key);
            if (originalAria === null || originalAria === undefined) {
                element.removeAttribute('aria-disabled');
            }
            else {
                element.setAttribute('aria-disabled', originalAria);
            }
        }
        if (context.originalPointerEventsMap.has(key)) {
            element.style.pointerEvents = (_b = context.originalPointerEventsMap.get(key)) !== null && _b !== void 0 ? _b : '';
        }
    }
    context.originalDisabledMap.clear();
    context.originalAriaDisabledMap.clear();
    context.originalPointerEventsMap.clear();
}

function bindElement(context, key, eventType, handler) {
    context.bindings.bindIfExists(key, eventType, handler);
}
function parseInputNumber(context, key) {
    return parseFloat(context.getInputValue(key));
}
function parseEventInputNumber(event) {
    return parseFloat(event.target.value);
}
function handleAsyncAction(context, operation, action) {
    try {
        void Promise.resolve(action()).catch((error) => {
            context.actions.reportAsyncActionError(operation, error);
        });
    }
    catch (error) {
        context.actions.reportAsyncActionError(operation, error);
    }
}
function getEventInputValue(event) {
    return event.target.value;
}
function getEventInputChecked(event) {
    return event.target.checked;
}
function parseShapeKind(value) {
    if (value === 'rect' || value === 'line' || value === 'arrow')
        return value;
    return null;
}
function bindUploadEvents(context) {
    bindElement(context, 'uploadArea', 'click', () => {
        context.actions.openImagePicker();
    });
    bindElement(context, 'imageInput', 'change', (event) => {
        var _a;
        const file = (_a = event.target.files) === null || _a === void 0 ? void 0 : _a[0];
        if (file) {
            handleAsyncAction(context, 'loadImageFile', () => context.actions.loadImageFile(file));
        }
    });
}
function bindImageFilterEvents(context) {
    bindThrottledNumberInput(context, 'imageBrightnessInput', (value) => {
        context.actions.setImageFilterConfig({ brightness: value });
    });
    bindThrottledNumberInput(context, 'imageContrastInput', (value) => {
        context.actions.setImageFilterConfig({ contrast: value });
    });
    bindThrottledNumberInput(context, 'imageSaturationInput', (value) => {
        context.actions.setImageFilterConfig({ saturation: value });
    });
    bindThrottledNumberInput(context, 'imageBlurInput', (value) => {
        context.actions.setImageFilterConfig({ blur: value });
    });
    bindThrottledNumberInput(context, 'imageSharpenInput', (value) => {
        context.actions.setImageFilterConfig({ sharpen: value });
    });
    bindBooleanInput(context, 'imageGrayscaleInput', (value) => {
        context.actions.setImageFilterConfig({ grayscale: value });
    });
    bindBooleanInput(context, 'imageSepiaInput', (value) => {
        context.actions.setImageFilterConfig({ sepia: value });
    });
    bindBooleanInput(context, 'imageVintageInput', (value) => {
        context.actions.setImageFilterConfig({ vintage: value });
    });
    bindElement(context, 'applyImageFiltersButton', 'click', () => {
        context.actions.commitImageFilters();
    });
    bindElement(context, 'resetImageFiltersButton', 'click', () => {
        context.actions.resetImageFilterConfig();
    });
    bindElement(context, 'clearImageFiltersButton', 'click', () => {
        context.actions.clearImageFilters();
    });
}
function bindTransformEvents(context) {
    bindElement(context, 'zoomInButton', 'click', () => {
        handleAsyncAction(context, 'zoomIn', () => context.actions.zoomIn());
    });
    bindElement(context, 'zoomOutButton', 'click', () => {
        handleAsyncAction(context, 'zoomOut', () => context.actions.zoomOut());
    });
    bindElement(context, 'resetImageTransformButton', 'click', () => {
        handleAsyncAction(context, 'resetImageTransform', () => context.actions.resetImageTransform());
    });
    bindElement(context, 'flipHorizontalButton', 'click', () => {
        handleAsyncAction(context, 'flipHorizontal', () => context.actions.flipHorizontal());
    });
    bindElement(context, 'flipVerticalButton', 'click', () => {
        handleAsyncAction(context, 'flipVertical', () => context.actions.flipVertical());
    });
    bindElement(context, 'rotateLeftButton', 'click', () => {
        const parsedStep = parseInputNumber(context, 'rotateLeftDegreesInput');
        const step = Number.isNaN(parsedStep) ? context.rotationStep : parsedStep;
        handleAsyncAction(context, 'rotateLeft', () => context.actions.rotateLeft(step));
    });
    bindElement(context, 'rotateRightButton', 'click', () => {
        const parsedStep = parseInputNumber(context, 'rotateRightDegreesInput');
        const step = Number.isNaN(parsedStep) ? context.rotationStep : parsedStep;
        handleAsyncAction(context, 'rotateRight', () => context.actions.rotateRight(step));
    });
}
function bindMaskEvents(context) {
    bindElement(context, 'createMaskButton', 'click', () => {
        context.actions.createMask();
    });
    bindElement(context, 'removeSelectedMaskButton', 'click', () => {
        context.actions.removeSelectedMask();
    });
    bindElement(context, 'removeAllMasksButton', 'click', () => {
        context.actions.removeAllMasks();
    });
    bindElement(context, 'mergeMasksButton', 'click', () => {
        handleAsyncAction(context, 'mergeMasks', () => context.actions.mergeMasks());
    });
}
function bindAnnotationEvents(context) {
    bindElement(context, 'mergeAnnotationsButton', 'click', () => {
        handleAsyncAction(context, 'mergeAnnotations', () => context.actions.mergeAnnotations());
    });
    bindElement(context, 'enterTextModeButton', 'click', () => {
        context.actions.enterTextMode();
    });
    bindElement(context, 'exitTextModeButton', 'click', () => {
        context.actions.exitTextMode();
    });
    bindElement(context, 'enterDrawModeButton', 'click', () => {
        context.actions.enterDrawMode();
    });
    bindElement(context, 'exitDrawModeButton', 'click', () => {
        context.actions.exitDrawMode();
    });
    bindElement(context, 'createShapeAnnotationButton', 'click', () => {
        context.actions.createShapeAnnotation();
    });
    bindElement(context, 'enterShapeModeButton', 'click', () => {
        const shape = parseShapeKind(context.getInputValue('shapeKindSelect'));
        if (!shape)
            return;
        context.actions.enterShapeMode(shape);
    });
    bindElement(context, 'exitShapeModeButton', 'click', () => {
        context.actions.exitShapeMode();
    });
    bindElement(context, 'removeSelectedAnnotationButton', 'click', () => {
        context.actions.removeSelectedAnnotation();
    });
    bindElement(context, 'removeAllAnnotationsButton', 'click', () => {
        context.actions.removeAllAnnotations();
    });
    bindElement(context, 'deleteSelectedObjectButton', 'click', () => {
        context.actions.deleteSelectedObject();
    });
    bindElement(context, 'bringSelectedObjectForwardButton', 'click', () => {
        context.actions.bringSelectedObjectForward();
    });
    bindElement(context, 'sendSelectedObjectBackwardButton', 'click', () => {
        context.actions.sendSelectedObjectBackward();
    });
    bindElement(context, 'bringSelectedObjectToFrontButton', 'click', () => {
        context.actions.bringSelectedObjectToFront();
    });
    bindElement(context, 'sendSelectedObjectToBackButton', 'click', () => {
        context.actions.sendSelectedObjectToBack();
    });
    bindStringInput(context, 'textColorInput', (value) => {
        context.actions.setTextColor(value);
    });
    bindNumberInput(context, 'textFontSizeInput', (value) => {
        context.actions.setTextFontSize(value);
    });
    bindStringInput(context, 'drawColorInput', (value) => {
        context.actions.setDrawColor(value);
    });
    bindNumberInput(context, 'drawBrushSizeInput', (value) => {
        context.actions.setDrawBrushSize(value);
    });
    bindElement(context, 'drawBrushSubModeButton', 'click', () => {
        context.actions.setDrawSubMode('brush');
    });
    bindElement(context, 'drawEraseSubModeButton', 'click', () => {
        context.actions.setDrawSubMode('erase');
    });
    bindNumberInput(context, 'eraserBrushSizeInput', (value) => {
        context.actions.setEraserBrushSize(value);
    });
    bindStringInput(context, 'shapeKindSelect', (value) => {
        const shape = parseShapeKind(value);
        if (!shape)
            return;
        context.actions.setShapeConfig({ shape });
    });
    bindStringInput(context, 'shapeStrokeInput', (value) => {
        context.actions.setShapeConfig({ stroke: value });
    });
    bindNumberInput(context, 'shapeStrokeWidthInput', (value) => {
        context.actions.setShapeConfig({ strokeWidth: value });
    });
    bindStringInput(context, 'shapeFillInput', (value) => {
        context.actions.setShapeConfig({ fill: value });
    });
}
function bindHistoryEvents(context) {
    bindElement(context, 'downloadImageButton', 'click', () => {
        handleAsyncAction(context, 'downloadImage', () => context.actions.downloadImage());
    });
    bindElement(context, 'undoButton', 'click', () => {
        handleAsyncAction(context, 'undo', () => context.actions.undo());
    });
    bindElement(context, 'redoButton', 'click', () => {
        handleAsyncAction(context, 'redo', () => context.actions.redo());
    });
}
function bindCropEvents(context) {
    bindElement(context, 'enterCropModeButton', 'click', () => {
        context.actions.enterCropMode();
    });
    bindElement(context, 'cropAspectRatioSelect', 'change', () => {
        context.actions.updateSelectedCropAspectRatio();
    });
    bindElement(context, 'applyCropButton', 'click', () => {
        void context.actions.applyCrop().catch((error) => {
            context.actions.reportCropApplyError(error);
        });
    });
    bindElement(context, 'cancelCropButton', 'click', () => {
        context.actions.cancelCrop();
    });
}
function bindMosaicEvents(context) {
    bindElement(context, 'enterMosaicModeButton', 'click', () => {
        context.actions.enterMosaicMode();
    });
    bindElement(context, 'exitMosaicModeButton', 'click', () => {
        context.actions.exitMosaicMode();
    });
    bindNumberInput(context, 'mosaicBrushSizeInput', (value) => {
        context.actions.setMosaicBrushSize(value);
    });
    bindNumberInput(context, 'mosaicBlockSizeInput', (value) => {
        context.actions.setMosaicBlockSize(value);
    });
}
function bindStringInput(context, key, applyValue) {
    let lastAppliedValue = null;
    const handler = (event) => {
        const value = getEventInputValue(event);
        if (value === lastAppliedValue)
            return;
        lastAppliedValue = value;
        applyValue(value);
    };
    bindElement(context, key, 'input', handler);
    bindElement(context, key, 'change', handler);
}
function bindThrottledNumberInput(context, key, applyValue) {
    let lastAppliedValue = null;
    let pendingValue = 0;
    let hasPendingValue = false;
    let scheduled = false;
    const applyIfChanged = (value) => {
        if (lastAppliedValue !== null && Object.is(value, lastAppliedValue))
            return;
        lastAppliedValue = value;
        applyValue(value);
    };
    const flush = () => {
        scheduled = false;
        if (!hasPendingValue)
            return;
        const value = pendingValue;
        hasPendingValue = false;
        applyIfChanged(value);
    };
    const scheduleFlush = () => {
        if (scheduled)
            return;
        scheduled = true;
        if (typeof globalThis.requestAnimationFrame === 'function') {
            globalThis.requestAnimationFrame(() => flush());
            return;
        }
        flush();
    };
    const inputHandler = (event) => {
        pendingValue = parseEventInputNumber(event);
        hasPendingValue = true;
        scheduleFlush();
    };
    const changeHandler = (event) => {
        pendingValue = parseEventInputNumber(event);
        hasPendingValue = true;
        flush();
    };
    bindElement(context, key, 'input', inputHandler);
    bindElement(context, key, 'change', changeHandler);
}
function bindNumberInput(context, key, applyValue) {
    let lastAppliedValue = null;
    const handler = (event) => {
        const value = parseEventInputNumber(event);
        if (lastAppliedValue !== null && Object.is(value, lastAppliedValue))
            return;
        lastAppliedValue = value;
        applyValue(value);
    };
    bindElement(context, key, 'input', handler);
    bindElement(context, key, 'change', handler);
}
function bindBooleanInput(context, key, applyValue) {
    let lastAppliedValue = null;
    const handler = (event) => {
        const value = getEventInputChecked(event);
        if (lastAppliedValue !== null && value === lastAppliedValue)
            return;
        lastAppliedValue = value;
        applyValue(value);
    };
    bindElement(context, key, 'input', handler);
    bindElement(context, key, 'change', handler);
}
function bindEditorDomEvents(context) {
    bindUploadEvents(context);
    bindImageFilterEvents(context);
    bindTransformEvents(context);
    bindMaskEvents(context);
    bindAnnotationEvents(context);
    bindHistoryEvents(context);
    bindCropEvents(context);
    bindMosaicEvents(context);
}

function normalizeStepScale(value) {
    const rounded = Math.round(value * 1000000) / 1000000;
    return Number.isFinite(rounded) ? rounded : 1;
}
function createEditorDomEventActions(runtime, ownerDocument, host) {
    return {
        reportAsyncActionError: (operation, error) => {
            host.reportAsyncActionError(operation, error);
        },
        openImagePicker: () => {
            var _a;
            (_a = resolveDomElement(runtime.elements.imageInput, ownerDocument, isInputElement)) === null || _a === void 0 ? void 0 : _a.click();
        },
        loadImageFile: (file) => host.loadImageFile(file),
        zoomIn: () => host.scaleImage(normalizeStepScale(runtime.currentScale + runtime.options.scaleStep)),
        zoomOut: () => host.scaleImage(normalizeStepScale(runtime.currentScale - runtime.options.scaleStep)),
        resetImageTransform: () => host.resetImageTransform(),
        flipHorizontal: () => host.flipHorizontal(),
        flipVertical: () => host.flipVertical(),
        rotateLeft: (degrees) => host.rotateImage(runtime.currentRotation - degrees),
        rotateRight: (degrees) => host.rotateImage(runtime.currentRotation + degrees),
        setImageFilterConfig: (config) => {
            host.setImageFilterConfig(config);
        },
        resetImageFilterConfig: () => {
            host.resetImageFilterConfig();
        },
        clearImageFilters: () => {
            host.clearImageFilters();
        },
        commitImageFilters: () => {
            host.commitImageFilters();
        },
        createMask: () => {
            host.createMask();
        },
        removeSelectedMask: () => {
            host.removeSelectedMask();
        },
        removeAllMasks: () => {
            host.removeAllMasks();
        },
        mergeMasks: () => host.mergeMasks(),
        mergeAnnotations: () => host.mergeAnnotations(),
        enterTextMode: () => {
            host.enterTextMode();
        },
        exitTextMode: () => {
            host.exitTextMode();
        },
        enterDrawMode: () => {
            host.enterDrawMode();
        },
        exitDrawMode: () => {
            host.exitDrawMode();
        },
        createShapeAnnotation: () => {
            host.createShapeAnnotation();
        },
        enterShapeMode: (shape) => {
            host.enterShapeMode(shape);
        },
        exitShapeMode: () => {
            host.exitShapeMode();
        },
        removeSelectedAnnotation: () => {
            host.removeSelectedAnnotation();
        },
        removeAllAnnotations: () => {
            host.removeAllAnnotations();
        },
        deleteSelectedObject: () => {
            host.deleteSelectedObject();
        },
        bringSelectedObjectForward: () => {
            host.bringSelectedObjectForward();
        },
        sendSelectedObjectBackward: () => {
            host.sendSelectedObjectBackward();
        },
        bringSelectedObjectToFront: () => {
            host.bringSelectedObjectToFront();
        },
        sendSelectedObjectToBack: () => {
            host.sendSelectedObjectToBack();
        },
        downloadImage: () => host.downloadImage(),
        undo: () => host.undo(),
        redo: () => host.redo(),
        enterCropMode: () => {
            host.enterCropMode({ aspectRatio: getSelectedCropAspectRatio(runtime, ownerDocument) });
        },
        updateSelectedCropAspectRatio: () => {
            if (runtime.cropSession) {
                host.setCropAspectRatio(getSelectedCropAspectRatio(runtime, ownerDocument));
            }
        },
        applyCrop: () => host.applyCrop(),
        reportCropApplyError: (error) => {
            host.reportCropApplyError(error);
        },
        cancelCrop: () => {
            host.cancelCrop();
        },
        enterMosaicMode: () => {
            host.enterMosaicMode();
        },
        exitMosaicMode: () => {
            host.exitMosaicMode();
        },
        setMosaicBrushSize: (size) => {
            host.setMosaicBrushSize(size);
        },
        setMosaicBlockSize: (size) => {
            host.setMosaicBlockSize(size);
        },
        setTextColor: (color) => {
            host.setTextColor(color);
        },
        setTextFontSize: (size) => {
            host.setTextFontSize(size);
        },
        setDrawColor: (color) => {
            host.setDrawColor(color);
        },
        setDrawBrushSize: (size) => {
            host.setDrawBrushSize(size);
        },
        setDrawSubMode: (mode) => {
            host.setDrawSubMode(mode);
        },
        setEraserBrushSize: (size) => {
            host.setEraserConfig({ brushSize: size });
        },
        setShapeConfig: (config) => {
            host.setShapeConfig(config);
        },
    };
}
function getSelectedCropAspectRatio(runtime, ownerDocument) {
    const inputEl = resolveDomElement(runtime.elements.cropAspectRatioSelect, ownerDocument, isInputOrSelectElement);
    const value = inputEl && 'value' in inputEl ? String(inputEl.value).trim() : '';
    return (value || 'free');
}

function isValueControl(element) {
    return !!element && 'value' in element;
}
function isCheckedInput(element) {
    return !!element && 'checked' in element;
}
function isReadOnlyControl(element) {
    return 'readOnly' in element && element.readOnly;
}
function isColorInput(element) {
    return element.tagName.toLowerCase() === 'input' && element.type === 'color';
}
function syncInputValue(element, value) {
    if (!isValueControl(element))
        return;
    const ownerDocument = element.ownerDocument;
    if (ownerDocument.activeElement === element && !isReadOnlyControl(element))
        return;
    if (isColorInput(element) && !/^#[0-9a-f]{6}$/i.test(value))
        return;
    if (element.value !== value)
        element.value = value;
}
function syncInputChecked(element, checked) {
    if (!isCheckedInput(element))
        return;
    if (element.checked !== checked)
        element.checked = checked;
}
function syncToggleButton(element, pressed) {
    if (!element)
        return;
    const next = pressed ? 'true' : 'false';
    if (element.getAttribute('aria-pressed') !== next) {
        element.setAttribute('aria-pressed', next);
    }
}
function syncValue(getElement, key, value) {
    syncInputValue(getElement(key), value);
}
function syncChecked(getElement, key, checked) {
    syncInputChecked(getElement(key), checked);
}
function syncPressed(getElement, key, pressed) {
    syncToggleButton(getElement(key), pressed);
}
function applyEditorInputState(snapshot, getElement) {
    syncValue(getElement, 'scalePercentageInput', String(Math.round(snapshot.currentScale * 100)));
    syncValue(getElement, 'imageBrightnessInput', String(snapshot.imageFilterConfig.brightness));
    syncValue(getElement, 'imageContrastInput', String(snapshot.imageFilterConfig.contrast));
    syncValue(getElement, 'imageSaturationInput', String(snapshot.imageFilterConfig.saturation));
    syncValue(getElement, 'imageBlurInput', String(snapshot.imageFilterConfig.blur));
    syncValue(getElement, 'imageSharpenInput', String(snapshot.imageFilterConfig.sharpen));
    syncChecked(getElement, 'imageGrayscaleInput', snapshot.imageFilterConfig.grayscale);
    syncChecked(getElement, 'imageSepiaInput', snapshot.imageFilterConfig.sepia);
    syncChecked(getElement, 'imageVintageInput', snapshot.imageFilterConfig.vintage);
    syncValue(getElement, 'mosaicBrushSizeInput', String(snapshot.mosaicConfig.brushSize));
    syncValue(getElement, 'mosaicBlockSizeInput', String(snapshot.mosaicConfig.blockSize));
    syncValue(getElement, 'textColorInput', snapshot.textConfig.fill);
    syncValue(getElement, 'textFontSizeInput', String(snapshot.textConfig.fontSize));
    syncValue(getElement, 'drawColorInput', snapshot.drawConfig.color);
    syncValue(getElement, 'drawBrushSizeInput', String(snapshot.drawConfig.brushSize));
    syncPressed(getElement, 'drawBrushSubModeButton', snapshot.drawSubMode === 'brush');
    syncPressed(getElement, 'drawEraseSubModeButton', snapshot.drawSubMode === 'erase');
    syncValue(getElement, 'eraserBrushSizeInput', String(snapshot.eraserConfig.brushSize));
    syncValue(getElement, 'shapeKindSelect', snapshot.shapeConfig.shape);
    syncValue(getElement, 'shapeStrokeInput', snapshot.shapeConfig.stroke);
    syncValue(getElement, 'shapeStrokeWidthInput', String(snapshot.shapeConfig.strokeWidth));
    syncValue(getElement, 'shapeFillInput', snapshot.shapeConfig.fill);
}

function bindEditorKeyboardEvents(access) {
    const ownerDocument = access.getOwnerDocument();
    const keyboardDocument = access.getKeyboardDocument();
    const keyboardHandler = access.getKeyboardHandler();
    if (keyboardHandler && keyboardDocument) {
        access.removeKeyboardListener(keyboardDocument, keyboardHandler);
    }
    const handler = (event) => {
        access.handleKeyboardEvent(event);
    };
    access.setKeyboardBinding(ownerDocument, handler);
    ownerDocument.addEventListener('keydown', handler);
}
function isNativeEditableElement(element) {
    var _a;
    if (!element)
        return false;
    const activeElement = element;
    const tagName = String((_a = activeElement.tagName) !== null && _a !== void 0 ? _a : '').toLowerCase();
    return (tagName === 'input' ||
        tagName === 'textarea' ||
        tagName === 'select' ||
        activeElement.isContentEditable === true);
}
function getDeepActiveElement(root) {
    var _a, _b;
    let activeElement = (_a = root === null || root === void 0 ? void 0 : root.activeElement) !== null && _a !== void 0 ? _a : null;
    while ((_b = activeElement === null || activeElement === void 0 ? void 0 : activeElement.shadowRoot) === null || _b === void 0 ? void 0 : _b.activeElement) {
        activeElement = activeElement.shadowRoot.activeElement;
    }
    return activeElement;
}
function isNativeTextInputActive(keyboardDocument, event) {
    const composedPath = typeof (event === null || event === void 0 ? void 0 : event.composedPath) === 'function' ? event.composedPath() : undefined;
    if (composedPath === null || composedPath === void 0 ? void 0 : composedPath.some(isNativeEditableElement))
        return true;
    return isNativeEditableElement(getDeepActiveElement(keyboardDocument));
}
function isFabricTextEditingActive(canvas) {
    const activeObject = canvas === null || canvas === void 0 ? void 0 : canvas.getActiveObject();
    return !!(activeObject &&
        plugins_mask_index.isTextAnnotationObject(activeObject) &&
        activeObject.isEditing === true);
}
function handleEditorKeyboardEvent(access, event) {
    if (access.isDisposed())
        return;
    const canvas = access.getCanvas();
    if (event.key === 'Delete' || event.key === 'Backspace') {
        if (isNativeTextInputActive(access.getKeyboardDocument(), event) ||
            isFabricTextEditingActive(canvas)) {
            return;
        }
        event.preventDefault();
        access.deleteSelectedObject();
        return;
    }
    if (event.key !== 'Escape')
        return;
    if (isFabricTextEditingActive(canvas) && canvas) {
        access.finalizeActiveTextEditing(false);
        event.preventDefault();
        return;
    }
    if (access.hasTextSession()) {
        event.preventDefault();
        access.exitTextMode();
    }
    else if (access.hasDrawSession()) {
        event.preventDefault();
        access.exitDrawMode();
    }
    else if (access.hasMosaicSession()) {
        event.preventDefault();
        access.exitMosaicMode();
    }
    else if (access.hasCropSession()) {
        event.preventDefault();
        access.cancelCrop();
    }
}

const CROP_SESSION_ALLOWED_OPERATIONS = new Set([
    'setCropAspectRatio',
    'applyCrop',
    'cancelCrop',
    'saveState',
]);
const MOSAIC_SESSION_ALLOWED_OPERATIONS = new Set([
    'exitMosaicMode',
    'applyMosaic',
    'setMosaicConfig',
    'resetMosaicConfig',
    'setMosaicBrushSize',
    'setMosaicBlockSize',
    'saveState',
]);
const TOOL_MODE_ALLOWED_OPERATIONS = {
    crop: CROP_SESSION_ALLOWED_OPERATIONS,
    mosaic: MOSAIC_SESSION_ALLOWED_OPERATIONS,
    text: new Set([
        'exitTextMode',
        'createTextAnnotation',
        'setTextConfig',
        'resetTextConfig',
        'setTextColor',
        'setTextFontSize',
        'saveState',
    ]),
    draw: new Set([
        'exitDrawMode',
        'setDrawConfig',
        'resetDrawConfig',
        'createDrawAnnotation',
        'setDrawColor',
        'setDrawBrushSize',
        'setDrawSubMode',
        'setEraserConfig',
        'resetEraserConfig',
        'commitEraserStroke',
        'saveState',
    ]),
    shape: new Set([
        'enterShapeMode',
        'exitShapeMode',
        'createShapeAnnotation',
        'setShapeConfig',
        'resetShapeConfig',
        'saveState',
    ]),
};
const IMAGE_EDITOR_OPERATIONS = new Set([
    'init',
    'loadImage',
    'loadFromState',
    'saveState',
    'setCanvasSize',
    'resizeToContainer',
    'relayout',
    'scaleImage',
    'rotateImage',
    'flipHorizontal',
    'flipVertical',
    'resetImageTransform',
    'setImageFilterConfig',
    'resetImageFilterConfig',
    'clearImageFilters',
    'commitImageFilters',
    'createMask',
    'removeSelectedMask',
    'removeAllMasks',
    'mergeMasks',
    'createTextAnnotation',
    'createShapeAnnotation',
    'enterTextMode',
    'exitTextMode',
    'enterShapeMode',
    'exitShapeMode',
    'setShapeConfig',
    'resetShapeConfig',
    'setTextConfig',
    'resetTextConfig',
    'setTextColor',
    'setTextFontSize',
    'enterDrawMode',
    'exitDrawMode',
    'setDrawConfig',
    'resetDrawConfig',
    'createDrawAnnotation',
    'setDrawColor',
    'setDrawBrushSize',
    'setDrawSubMode',
    'setEraserConfig',
    'resetEraserConfig',
    'commitEraserStroke',
    'updateSelectedAnnotation',
    'updateAnnotation',
    'removeSelectedAnnotation',
    'removeAllAnnotations',
    'deleteSelectedObject',
    'mergeAnnotations',
    'bringSelectedObjectForward',
    'sendSelectedObjectBackward',
    'bringSelectedObjectToFront',
    'sendSelectedObjectToBack',
    'enterCropMode',
    'setCropAspectRatio',
    'applyCrop',
    'cancelCrop',
    'enterMosaicMode',
    'exitMosaicMode',
    'applyMosaic',
    'setMosaicConfig',
    'resetMosaicConfig',
    'setMosaicBrushSize',
    'setMosaicBlockSize',
    'undo',
    'redo',
    'exportOverlayState',
    'validateOverlayState',
    'importOverlayState',
    'exportImageBase64',
    'exportImageFile',
    'downloadImage',
    'dispose',
]);
function getActiveToolMode(snapshot) {
    if (snapshot.hasCropSession)
        return 'crop';
    if (snapshot.hasMosaicSession)
        return 'mosaic';
    if (snapshot.hasTextSession)
        return 'text';
    if (snapshot.hasDrawSession)
        return 'draw';
    if (snapshot.hasShapeSession)
        return 'shape';
    return null;
}
function isToolModeActive(snapshot) {
    return getActiveToolMode(snapshot) !== null;
}
function getAllowedOperationsForToolMode(mode) {
    return TOOL_MODE_ALLOWED_OPERATIONS[mode];
}
function canRunOperationInToolMode(activeMode, operationName) {
    return !activeMode || getAllowedOperationsForToolMode(activeMode).has(operationName);
}
function isImageEditorOperation(value) {
    return value !== null && IMAGE_EDITOR_OPERATIONS.has(value);
}

const INTERNAL_OPERATION_TOKEN = Symbol('ImageEditorInternalOperation');
const INTERNAL_ALLOW_DURING_ANIMATION_QUEUE = Symbol('ImageEditorAllowDuringAnimationQueue');
function getRuntimeDocument(canvasElement) {
    var _a;
    return (_a = canvasElement === null || canvasElement === void 0 ? void 0 : canvasElement.ownerDocument) !== null && _a !== void 0 ? _a : (typeof document !== 'undefined' ? document : null);
}
function describeElementTarget(target) {
    if (typeof target === 'string')
        return `"${target}"`;
    if (target === null)
        return 'null';
    if (target === undefined)
        return 'undefined';
    return 'provided element';
}
function captureContainerScroll(container) {
    return container ? { left: container.scrollLeft, top: container.scrollTop } : null;
}
function restoreContainerScroll(container, scroll, options) {
    if (!container || !scroll)
        return;
    try {
        container.scrollLeft = scroll.left;
        container.scrollTop = scroll.top;
    }
    catch (error) {
        plugins_mask_index.reportWarning(options, error, 'Scroll restore failed.');
    }
}
function isPositiveFiniteDimension(value) {
    return Number.isFinite(value) && value > 0;
}
function getCanvasActiveObjects(canvas) {
    var _a;
    if (!canvas)
        return [];
    const candidate = canvas;
    if (typeof candidate.getActiveObjects === 'function')
        return candidate.getActiveObjects();
    const active = (_a = candidate.getActiveObject) === null || _a === void 0 ? void 0 : _a.call(candidate);
    return active ? [active] : [];
}
class ImageEditor {
    constructor(fabricModuleOrOptions = {}, options = {}) {
        var _a;
        Object.defineProperty(this, "runtime", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "contextFactory", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "actionAccessFactory", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "historyFacade", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "pluginComposition", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "pluginCore", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "pluginHistoryAdapter", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "transformPluginApi", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "maskPluginApi", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        const detected = detectFabric(fabricModuleOrOptions, options);
        const resolvedOptions = resolveOptions(detected.options);
        this.historyFacade = new DeferredHistoryPort(resolvedOptions.maxHistorySize);
        this.runtime = new EditorRuntime((_a = detected.fabric) !== null && _a !== void 0 ? _a : {}, detected.isFabricLoaded, resolvedOptions, this.historyFacade);
        const rawDefaultLayoutMode = detected.options
            .defaultLayoutMode;
        if (rawDefaultLayoutMode !== undefined && !isLayoutMode(rawDefaultLayoutMode)) {
            plugins_mask_index.reportWarning(this.runtime.options, new TypeError(`[ImageEditor] Unsupported defaultLayoutMode ` +
                `${JSON.stringify(rawDefaultLayoutMode)}. ` +
                'Expected "fit", "cover", or "expand".'), 'Invalid defaultLayoutMode fell back to "expand".');
        }
        const rawDefaultMaskConfig = detected.options
            .defaultMaskConfig;
        if (rawDefaultMaskConfig &&
            typeof rawDefaultMaskConfig === 'object' &&
            !Array.isArray(rawDefaultMaskConfig) &&
            ('onCreate' in rawDefaultMaskConfig || 'fabricGenerator' in rawDefaultMaskConfig)) {
            plugins_mask_index.reportWarning(this.runtime.options, new TypeError('[ImageEditor] defaultMaskConfig does not support onCreate or fabricGenerator. Pass those fields to createMask() instead.'), 'Ignored unsupported defaultMaskConfig lifecycle/factory fields.');
        }
        const wiring = this.createRuntimeWiring();
        this.contextFactory = wiring.contextFactory;
        this.actionAccessFactory = wiring.actionAccessFactory;
    }
    initializePluginRuntime() {
        if (this.pluginComposition)
            return;
        const options = this.runtime.options;
        const composition = createFullCompatibilityComposition(this.runtime.fabricModule, Object.freeze({
            ...options,
            layoutMode: this.runtime.currentLayoutMode,
        }), createLegacyFeatureCompatibilityPort());
        const { core, history, transform, masks } = composition;
        let historyAdapter = null;
        try {
            core.use(fullFacadeAnnotationPlugin({
                bindToImageTransform: options.bindAnnotationsToImageTransform,
                textFlipBehavior: options.textAnnotationFlipBehavior,
            }));
            core.use(fullFacadeStatePlugin({
                capture: () => this.captureFullFacadeMementoState(),
                restore: (state) => this.restoreFullFacadeMementoState(state),
                clearState: () => this.resetFullFacadeMementoState(),
            }));
            historyAdapter = new PluginHistoryAdapter(core, history, options.maxHistorySize, () => undefined);
            this.historyFacade.attach(historyAdapter);
            this.pluginComposition = composition;
            this.pluginCore = core;
            this.pluginHistoryAdapter = historyAdapter;
            this.transformPluginApi = transform;
            this.maskPluginApi = masks;
            this.runtime.transformController = Object.freeze({
                scaleImage: async (factor) => {
                    await this.preparePluginOwnedImageState();
                    await transform.scale(factor);
                    this.synchronizeRuntimeTransformState();
                },
                rotateImage: async (degrees) => {
                    await this.preparePluginOwnedImageState();
                    await transform.rotate(degrees);
                    this.synchronizeRuntimeTransformState();
                },
                flipHorizontal: async () => {
                    await this.preparePluginOwnedImageState();
                    await transform.flipHorizontal();
                    this.synchronizeRuntimeTransformState();
                },
                flipVertical: async () => {
                    await this.preparePluginOwnedImageState();
                    await transform.flipVertical();
                    this.synchronizeRuntimeTransformState();
                },
                resetImageTransform: async () => {
                    await this.preparePluginOwnedImageState();
                    await transform.resetImageTransform();
                    this.synchronizeRuntimeTransformState();
                },
            });
        }
        catch (error) {
            if (historyAdapter) {
                this.historyFacade.detach(historyAdapter);
                historyAdapter.dispose();
            }
            try {
                composition.legacyFeatures.dispose();
                core.dispose();
            }
            catch (disposeError) {
                plugins_mask_index.reportWarning(this.runtime.options, disposeError, 'Plugin cleanup failed during initialization rollback.');
            }
            throw error;
        }
    }
    async preparePluginOwnedImageState() {
        var _a, _b, _c;
        if (!this.pluginCore || !this.runtime.canvas || this.runtime.isDisposed)
            return;
        (_a = this.transformPluginApi) === null || _a === void 0 ? void 0 : _a.synchronizeCompatibilityState({
            scale: this.runtime.currentScale,
            rotationDegrees: this.runtime.currentRotation,
            flipX: ((_b = this.runtime.originalImage) === null || _b === void 0 ? void 0 : _b.flipX) === true,
            flipY: ((_c = this.runtime.originalImage) === null || _c === void 0 ? void 0 : _c.flipY) === true,
        });
        await this.pluginCore.adoptLegacyImageState({
            baseImage: this.runtime.originalImage,
            baseImageScale: this.runtime.baseImageScale,
            imageMimeType: this.runtime.currentImageMimeType,
            lifecycle: 'none',
        });
    }
    synchronizeRuntimeTransformState() {
        var _a;
        const state = (_a = this.transformPluginApi) === null || _a === void 0 ? void 0 : _a.getState();
        if (!state)
            return;
        this.runtime.currentScale = state.scale;
        this.runtime.currentRotation = state.rotationDegrees;
    }
    captureFullFacadeMementoState() {
        var _a, _b, _c;
        const transformState = (_a = this.transformPluginApi) === null || _a === void 0 ? void 0 : _a.getState();
        const selectedAnnotationIds = getCanvasActiveObjects(this.runtime.canvas)
            .filter(plugins_mask_index.isAnnotationObject)
            .map((annotation) => annotation.annotationId);
        return Object.freeze({
            currentScale: (_b = transformState === null || transformState === void 0 ? void 0 : transformState.scale) !== null && _b !== void 0 ? _b : this.runtime.currentScale,
            currentRotation: (_c = transformState === null || transformState === void 0 ? void 0 : transformState.rotationDegrees) !== null && _c !== void 0 ? _c : this.runtime.currentRotation,
            baseImageScale: this.runtime.baseImageScale,
            imageMimeType: this.runtime.currentImageMimeType,
            annotationCounter: this.runtime.annotationCounter,
            imageFilterConfig: cloneResolvedImageFilterConfig(this.runtime.currentImageFilterConfig),
            lastCommittedImageFilterConfig: cloneResolvedImageFilterConfig(this.runtime.lastCommittedImageFilterConfig),
            selectedAnnotationIds: Object.freeze(selectedAnnotationIds),
        });
    }
    restoreFullFacadeMementoState(state) {
        var _a, _b, _c;
        const canvas = this.runtime.canvas;
        if (!canvas || this.runtime.isDisposed)
            return;
        const annotations = canvas.getObjects().filter(plugins_mask_index.isAnnotationObject);
        const originalImage = (_a = canvas.getObjects().find(plugins_mask_index.isBaseImageObject)) !== null && _a !== void 0 ? _a : null;
        this.runtime.originalImage = originalImage;
        this.runtime.isImageLoadedToCanvas = originalImage !== null;
        this.runtime.currentScale = state.currentScale;
        this.runtime.currentRotation = state.currentRotation;
        this.runtime.baseImageScale = state.baseImageScale;
        this.runtime.currentImageMimeType = state.imageMimeType;
        this.runtime.annotationCounter = Math.max(state.annotationCounter, ...annotations.map((annotation) => annotation.annotationId));
        this.runtime.maskCounter = this.getMasks().reduce((maximum, mask) => Math.max(maximum, mask.maskId), 0);
        this.runtime.currentImageFilterConfig = cloneResolvedImageFilterConfig(state.imageFilterConfig);
        this.runtime.lastCommittedImageFilterConfig = cloneResolvedImageFilterConfig(state.lastCommittedImageFilterConfig);
        (_b = this.transformPluginApi) === null || _b === void 0 ? void 0 : _b.synchronizeCompatibilityState({
            scale: state.currentScale,
            rotationDegrees: state.currentRotation,
            flipX: (originalImage === null || originalImage === void 0 ? void 0 : originalImage.flipX) === true,
            flipY: (originalImage === null || originalImage === void 0 ? void 0 : originalImage.flipY) === true,
        });
        syncAnnotationRuntimeStates(annotations);
        attachTextEditingHandlersToAnnotations(this.buildTextControllerContext(), annotations);
        const selectedAnnotations = annotations.filter((annotation) => state.selectedAnnotationIds.includes(annotation.annotationId));
        if (selectedAnnotations.length === 1)
            canvas.setActiveObject(selectedAnnotations[0]);
        try {
            this.runtime.lastSnapshot = this.captureSnapshotInternal();
        }
        catch (error) {
            plugins_mask_index.reportWarning(this.runtime.options, error, 'Compatibility snapshot refresh failed.');
        }
        canvas.requestRenderAll();
        this.updateInputs();
        this.updateMaskList();
        this.updateAnnotationList();
        this.updateUi();
        this.updatePlaceholderStatus();
        const operation = (_c = this.runtime.activeStateRestoreOperation) !== null && _c !== void 0 ? _c : 'loadFromState';
        const context = this.buildCallbackContext(operation, true);
        this.handleSelectionChanged(getCanvasActiveObjects(canvas));
        this.emitMasksChanged(context);
        this.emitAnnotationsChanged(context);
        this.emitImageChanged(context);
    }
    resetFullFacadeMementoState() {
        this.restoreFullFacadeMementoState({
            currentScale: 1,
            currentRotation: 0,
            baseImageScale: 1,
            imageMimeType: null,
            annotationCounter: 0,
            imageFilterConfig: cloneResolvedImageFilterConfig(DEFAULT_IMAGE_FILTER_CONFIG),
            lastCommittedImageFilterConfig: cloneResolvedImageFilterConfig(DEFAULT_IMAGE_FILTER_CONFIG),
            selectedAnnotationIds: Object.freeze([]),
        });
    }
    createRuntimeWiring() {
        return createEditorRuntimeWiring(this.runtime, {
            operations: {
                canRunIdleOperation: (operation, options) => this.canRunIdleOperation(operation, options),
                assertIdleForOperation: (operation, options) => {
                    this.assertIdleForOperation(operation, options);
                },
                assertCanQueueAnimation: (operation) => {
                    this.assertCanQueueAnimation(operation);
                },
                finalizeActiveTextEditingIfNeeded: () => {
                    this.finalizeActiveTextEditingIfNeeded();
                },
                withSelectionChangeContext: (context, callback) => this.withSelectionChangeContext(context, callback),
                withInternalOperationOptions: (token, options = {}) => this.withInternalOperationOptions(token, options),
                withAnimationQueueBypass: (options = {}) => this.withAnimationQueueBypass(options),
            },
            state: {
                saveCanvasState: (options) => {
                    this.saveStateInternal(options);
                },
                captureSnapshot: () => this.captureSnapshotInternal(),
                loadImage: (base64, options) => this.loadImageInternal(base64, options),
                loadFromState: (snapshot, options) => this.loadFromStateInternal(snapshot, options),
            },
            display: {
                inferCurrentImageMimeType: () => this.inferCurrentImageMimeType(),
                shouldNormalizeCanvasSizeAfterStateRestore: () => this.shouldNormalizeCanvasSizeAfterStateRestore(),
                updateCanvasSizeToImageBounds: (options) => this.updateCanvasSizeToImageBounds(options),
                alignObjectBoundingBoxToCanvasTopLeft: (object) => {
                    this.alignObjectBoundingBoxToCanvasTopLeft(object);
                },
                settleFitCoverScrollbarsAfterStateRestore: () => {
                    this.settleFitCoverScrollbarsAfterStateRestore();
                },
                setCanvasSize: (widthPx, heightPx) => {
                    this.setCanvasSizePx(widthPx, heightPx);
                },
                captureImageDisplayGeometry: () => this.captureImageDisplayGeometry(),
                restoreMergedImageDisplayGeometry: (geometry) => {
                    this.restoreMergedImageDisplayGeometry(geometry);
                },
            },
            selection: {
                buildSelection: (selected) => this.buildSelection(selected),
                handleSelectionChanged: (selected) => {
                    this.handleSelectionChanged(selected);
                },
                getMasks: () => this.getMasks(),
                getAnnotations: () => this.getAnnotations(),
                getMaskCollectionSignature: () => this.getMaskCollectionSignature(),
                getAnnotationCollectionSignature: () => this.getAnnotationCollectionSignature(),
            },
            ui: {
                refreshUiAfterQueuedAnimation: () => {
                    this.refreshUiAfterQueuedAnimation();
                },
                updateInputs: () => {
                    this.updateInputs();
                },
                updateMaskList: () => {
                    this.updateMaskList();
                },
                updateMaskListSelection: (mask) => {
                    this.updateMaskListSelection(mask);
                },
                updateAnnotationList: () => {
                    this.updateAnnotationList();
                },
                updateAnnotationListSelection: (annotation) => {
                    this.updateAnnotationListSelection(annotation);
                },
                updateUi: () => {
                    this.updateUi();
                },
            },
            labels: {
                removeLabelForMask: (mask) => {
                    this.removeLabelForMask(mask);
                },
                showLabelForMask: (mask) => {
                    this.showLabelForMask(mask);
                },
                syncMaskLabel: (mask) => {
                    this.syncMaskLabel(mask);
                },
                hideAllMaskLabels: () => {
                    this.hideAllMaskLabels();
                },
            },
            config: {
                updateSelectedAnnotation: (config) => {
                    this.updateSelectedAnnotation(config);
                },
                setTextColor: (color) => {
                    this.setTextColor(color);
                },
                setTextFontSize: (size) => {
                    this.setTextFontSize(size);
                },
                setDrawColor: (color) => {
                    this.setDrawColor(color);
                },
                setDrawBrushSize: (size) => {
                    this.setDrawBrushSize(size);
                },
            },
            callbacks: {
                buildCallbackContext: (operation, isInternalOperation) => this.buildCallbackContext(operation, isInternalOperation),
                emitImageCleared: (image, context) => {
                    this.emitOptionCallback('onImageCleared', [image, context]);
                },
                emitSelectionChange: (selection, context) => {
                    this.emitOptionCallback('onSelectionChange', [selection, context]);
                },
                emitMasksChanged: (context) => {
                    this.emitMasksChanged(context);
                },
                emitAnnotationsChanged: (context) => {
                    this.emitAnnotationsChanged(context);
                },
                emitImageChanged: (context) => {
                    this.emitImageChanged(context);
                },
                emitBusyChangeIfChanged: (context) => {
                    this.emitBusyChangeIfChanged(context);
                },
                reportWarning: (error, message) => {
                    plugins_mask_index.reportWarning(this.runtime.options, error, message);
                },
            },
        });
    }
    init(elementMap = {}) {
        var _a;
        if (!this.runtime.isFabricLoaded) {
            const globalFabric = globalThis.fabric;
            if (!globalFabric ||
                typeof globalFabric.Canvas !== 'function') {
                plugins_mask_index.reportWarning(this.runtime.options, null, '[ImageEditor] init() skipped: fabric.js is not loaded. Pass a Fabric module or load Fabric before init().');
                return;
            }
            this.runtime.fabricModule = globalFabric;
            this.runtime.isFabricLoaded = true;
        }
        if (this.runtime.isDisposed)
            return;
        if (this.runtime.canvas || this.runtime.domBindings || this.runtime.keyboardHandler) {
            plugins_mask_index.reportWarning(this.runtime.options, null, '[ImageEditor] init() skipped: editor is already initialized. Call dispose() before reinitializing.');
            return;
        }
        this.runtime.elements = resolveElementTargets(elementMap);
        this.initializePluginRuntime();
        try {
            this.initCanvas();
            this.runtime.domBindings = new DomBindings((key) => this.resolveElement(key), () => this.runtime.isDisposed);
            this.bindDomEvents();
            this.updateInputs();
            this.updateMaskList();
            this.updateAnnotationList();
            this.updateUi();
        }
        catch (error) {
            (_a = this.runtime.domBindings) === null || _a === void 0 ? void 0 : _a.removeAll();
            safelyRemoveKeyboardListener(this.runtime.keyboardDocument, this.runtime.keyboardHandler);
            this.rollbackPluginRuntimeAfterInitFailure();
            throw error;
        }
        if (this.runtime.options.initialImageBase64) {
            void this.loadImage(this.runtime.options.initialImageBase64).catch(() => {
            });
        }
        else {
            this.updatePlaceholderStatus();
        }
    }
    initCanvas() {
        var _a, _b, _c;
        const canvasTarget = this.runtime.elements.canvas;
        const canvasCandidate = resolveDomElement(canvasTarget, getRuntimeDocument(null), isCanvasElement);
        if (!canvasCandidate) {
            throw new Error(`[ImageEditor] Canvas element not found: ${describeElementTarget(canvasTarget)}`);
        }
        const canvasElement = canvasCandidate;
        this.runtime.canvasElement = canvasElement;
        const ownerDocument = canvasElement.ownerDocument;
        this.runtime.containerElement =
            (_a = resolveDomElement(this.runtime.elements.canvasContainer, ownerDocument)) !== null && _a !== void 0 ? _a : canvasElement.parentElement;
        this.runtime.placeholderElement = resolveDomElement(this.runtime.elements.imagePlaceholder, ownerDocument);
        const core = this.pluginCore;
        if (!core)
            throw new Error('[ImageEditor] Full composition is unavailable.');
        core.init({
            canvas: canvasElement,
            canvasContainer: this.runtime.containerElement,
            imagePlaceholder: this.runtime.placeholderElement,
        });
        const canvas = core.getCanvas();
        if (!canvas)
            throw new Error('[ImageEditor] Core did not initialize a Canvas.');
        this.runtime.canvas = canvas;
        (_b = this.pluginComposition) === null || _b === void 0 ? void 0 : _b.legacyFeatures.attach();
        (_c = this.pluginHistoryAdapter) === null || _c === void 0 ? void 0 : _c.resetBaseline();
        canvas.on('selection:created', (e) => {
            this.handleSelectionChanged(e.selected);
        });
        canvas.on('selection:updated', (e) => {
            this.handleSelectionChanged(e.selected);
        });
        canvas.on('selection:cleared', () => this.handleSelectionChanged([]));
        const onObjectEvent = (e) => {
            if (e.target)
                this.handleObjectMovingScalingRotating(e.target);
        };
        const onObjectModified = (e) => {
            if (e.target)
                this.handleObjectModified(e.target);
        };
        canvas.on('object:moving', onObjectEvent);
        canvas.on('object:scaling', onObjectEvent);
        canvas.on('object:rotating', onObjectEvent);
        canvas.on('object:modified', onObjectModified);
    }
    rollbackPluginRuntimeAfterInitFailure() {
        const composition = this.pluginComposition;
        const historyAdapter = this.pluginHistoryAdapter;
        if (historyAdapter) {
            this.historyFacade.detach(historyAdapter);
            historyAdapter.dispose();
        }
        this.pluginComposition = null;
        this.pluginCore = null;
        this.pluginHistoryAdapter = null;
        this.transformPluginApi = null;
        this.maskPluginApi = null;
        this.runtime.resetAfterDispose();
        void Promise.resolve(composition === null || composition === void 0 ? void 0 : composition.dispose()).catch((error) => {
            plugins_mask_index.reportWarning(this.runtime.options, error, 'Plugin cleanup failed during initialization rollback.');
        });
    }
    resolveElement(key, ownerDocument = getRuntimeDocument(this.runtime.canvasElement), guard) {
        return resolveDomElement(this.runtime.elements[key], ownerDocument, guard);
    }
    bindDomEvents() {
        if (!this.runtime.domBindings)
            return;
        const ownerDocument = getRuntimeDocument(this.runtime.canvasElement);
        if (!ownerDocument)
            return;
        bindEditorDomEvents({
            bindings: this.runtime.domBindings,
            rotationStep: this.runtime.options.rotationStep,
            getInputValue: (key) => {
                var _a;
                const element = this.resolveElement(key, ownerDocument, isInputOrSelectElement);
                return (_a = element === null || element === void 0 ? void 0 : element.value) !== null && _a !== void 0 ? _a : '';
            },
            actions: createEditorDomEventActions(this.runtime, ownerDocument, {
                reportAsyncActionError: (operation, error) => {
                    plugins_mask_index.reportError(this.runtime.options, error, `${operation} failed.`);
                },
                loadImageFile: (file) => this.loadImageFile(file),
                scaleImage: (scale) => this.scaleImage(scale),
                rotateImage: (rotation) => this.rotateImage(rotation),
                resetImageTransform: () => this.resetImageTransform(),
                flipHorizontal: () => this.flipHorizontal(),
                flipVertical: () => this.flipVertical(),
                setImageFilterConfig: (config) => {
                    this.setImageFilterConfig(config);
                },
                resetImageFilterConfig: () => {
                    this.resetImageFilterConfig();
                },
                clearImageFilters: () => {
                    this.clearImageFilters();
                },
                commitImageFilters: () => {
                    this.commitImageFilters();
                },
                createMask: () => {
                    this.createMask();
                },
                removeSelectedMask: () => {
                    this.removeSelectedMask();
                },
                removeAllMasks: () => {
                    this.removeAllMasks();
                },
                mergeMasks: () => this.mergeMasks(),
                mergeAnnotations: () => this.mergeAnnotations(),
                enterTextMode: () => {
                    this.enterTextMode();
                },
                exitTextMode: () => {
                    this.exitTextMode();
                },
                enterDrawMode: () => {
                    this.enterDrawMode();
                },
                exitDrawMode: () => {
                    this.exitDrawMode();
                },
                createShapeAnnotation: (config) => {
                    this.createShapeAnnotation(config);
                },
                enterShapeMode: (shape) => {
                    this.enterShapeMode(shape);
                },
                exitShapeMode: () => {
                    this.exitShapeMode();
                },
                removeSelectedAnnotation: () => {
                    this.removeSelectedAnnotation();
                },
                removeAllAnnotations: () => {
                    this.removeAllAnnotations();
                },
                deleteSelectedObject: () => {
                    this.deleteSelectedObject();
                },
                bringSelectedObjectForward: () => {
                    this.bringSelectedObjectForward();
                },
                sendSelectedObjectBackward: () => {
                    this.sendSelectedObjectBackward();
                },
                bringSelectedObjectToFront: () => {
                    this.bringSelectedObjectToFront();
                },
                sendSelectedObjectToBack: () => {
                    this.sendSelectedObjectToBack();
                },
                downloadImage: () => this.downloadImage(),
                undo: () => this.undo(),
                redo: () => this.redo(),
                enterCropMode: (options) => {
                    this.enterCropMode(options);
                },
                setCropAspectRatio: (aspectRatio) => {
                    this.setCropAspectRatio(aspectRatio);
                },
                applyCrop: () => this.applyCrop(),
                reportCropApplyError: (error) => {
                    plugins_mask_index.reportError(this.runtime.options, error, 'Crop apply failed.');
                },
                cancelCrop: () => {
                    this.cancelCrop();
                },
                enterMosaicMode: () => {
                    this.enterMosaicMode();
                },
                exitMosaicMode: () => {
                    this.exitMosaicMode();
                },
                setMosaicBrushSize: (size) => {
                    this.setMosaicBrushSize(size);
                },
                setMosaicBlockSize: (size) => {
                    this.setMosaicBlockSize(size);
                },
                setTextColor: (color) => {
                    this.applyTextColorInput(color);
                },
                setTextFontSize: (size) => {
                    this.applyTextFontSizeInput(size);
                },
                setDrawColor: (color) => {
                    this.applyDrawColorInput(color);
                },
                setDrawBrushSize: (size) => {
                    this.applyDrawBrushSizeInput(size);
                },
                setDrawSubMode: (mode) => {
                    this.setDrawSubMode(mode);
                },
                setEraserConfig: (config) => {
                    this.setEraserConfig(config);
                },
                setShapeConfig: (config) => {
                    this.setShapeConfig(config);
                },
            }),
        });
        this.bindKeyboardEvents(ownerDocument);
    }
    bindKeyboardEvents(ownerDocument) {
        bindEditorKeyboardEvents({
            getOwnerDocument: () => ownerDocument,
            getKeyboardDocument: () => this.runtime.keyboardDocument,
            getKeyboardHandler: () => this.runtime.keyboardHandler,
            setKeyboardBinding: (keyboardDocument, keyboardHandler) => {
                this.runtime.keyboardDocument = keyboardDocument;
                this.runtime.keyboardHandler = keyboardHandler;
            },
            removeKeyboardListener: (keyboardDocument, keyboardHandler) => {
                safelyRemoveKeyboardListener(keyboardDocument, keyboardHandler);
            },
            handleKeyboardEvent: (event) => {
                this.handleKeyboardEvent(event);
            },
        });
    }
    handleKeyboardEvent(event) {
        handleEditorKeyboardEvent({
            isDisposed: () => this.runtime.isDisposed,
            getCanvas: () => this.runtime.canvas,
            getKeyboardDocument: () => this.runtime.keyboardDocument,
            hasTextSession: () => this.runtime.textSession !== null,
            hasDrawSession: () => this.runtime.drawSession !== null,
            hasMosaicSession: () => this.runtime.mosaicSession !== null,
            hasCropSession: () => this.runtime.cropSession !== null,
            deleteSelectedObject: () => {
                this.deleteSelectedObject();
            },
            finalizeActiveTextEditing: (commit) => {
                finalizeActiveTextEditing(this.buildTextControllerContext(), { commit });
            },
            exitTextMode: () => {
                this.exitTextMode();
            },
            exitDrawMode: () => {
                this.exitDrawMode();
            },
            exitMosaicMode: () => {
                this.exitMosaicMode();
            },
            cancelCrop: () => {
                this.cancelCrop();
            },
        }, event);
    }
    finalizeActiveTextEditingIfNeeded() {
        if (!this.runtime.canvas || !isFabricTextEditingActive(this.runtime.canvas))
            return;
        finalizeActiveTextEditing(this.buildTextControllerContext(), { commit: true });
    }
    async loadImageFile(file) {
        await loadImageFile({
            options: this.runtime.options,
            getInputElement: () => this.resolveElement('imageInput', undefined, isInputElement),
            loadImage: (dataUrl) => this.loadImage(dataUrl),
        }, file);
    }
    async loadImage(base64, options = {}) {
        return this.loadImageInternal(base64, options);
    }
    async loadImageInternal(base64, options = {}) {
        var _a, _b;
        if (!this.runtime.isFabricLoaded || !this.runtime.canvas) {
            plugins_mask_index.reportWarning(this.runtime.options, null, 'loadImage skipped: editor is not initialized.');
            return;
        }
        if (this.runtime.isDisposed) {
            plugins_mask_index.reportWarning(this.runtime.options, null, 'loadImage skipped: editor is disposed.');
            return;
        }
        if (!isSupportedImageDataUrl(base64)) {
            plugins_mask_index.reportWarning(this.runtime.options, new TypeError('[ImageEditor] Unsupported image Data URL.'), 'loadImage skipped: input is not a supported PNG, JPEG, or WebP Data URL.');
            return;
        }
        try {
            this.assertIdleForOperation('loadImage', options);
        }
        catch (error) {
            if (this.isExpectedIdleGuardError(error, 'loadImage')) {
                plugins_mask_index.reportWarning(this.runtime.options, error, error.message);
                return;
            }
            throw error;
        }
        this.finalizeActiveTextEditingIfNeeded();
        const callbackContext = this.getOperationContext('loadImage', options);
        const previousImage = this.runtime.originalImage;
        const hadMasks = this.getMasks().length > 0;
        const hadAnnotations = this.getAnnotations().length > 0;
        this.emitOptionCallback('onImageLoadStart', [callbackContext]);
        this.runtime.operationGuard.beginLoading();
        this.emitBusyChangeIfChanged(callbackContext);
        this.updateUi();
        const loadImageContext = this.contextFactory.buildLoadImageContext();
        try {
            try {
                assertImageDataUrlInputBudget(base64, this.runtime.options);
            }
            catch (error) {
                const errorMessage = error instanceof Error
                    ? `loadImage failed: ${error.message}`
                    : 'loadImage failed';
                plugins_mask_index.reportError(this.runtime.options, error, errorMessage);
                throw error;
            }
            this.hideAllMaskLabels();
            await loadImage(loadImageContext, base64, options);
            const isInternalLoad = options[TRUSTED_STATE_RESTORE] === true ||
                options[INTERNAL_OPERATION_TOKEN] !== undefined;
            await ((_a = this.pluginCore) === null || _a === void 0 ? void 0 : _a.adoptLegacyImageState({
                baseImage: this.runtime.originalImage,
                baseImageScale: this.runtime.baseImageScale,
                imageMimeType: this.runtime.currentImageMimeType,
                lifecycle: isInternalLoad ? 'none' : 'loaded',
            }));
            if (!isInternalLoad)
                (_b = this.pluginHistoryAdapter) === null || _b === void 0 ? void 0 : _b.resetBaseline();
        }
        finally {
            this.runtime.operationGuard.endLoading();
            this.emitBusyChangeIfChanged(callbackContext);
            if (!this.runtime.isDisposed && this.runtime.canvas)
                this.updateUi();
        }
        this.runtime.lastMask = null;
        this.updateInputs();
        this.updateMaskList();
        this.updateAnnotationList();
        this.updateUi();
        if (previousImage && previousImage !== this.runtime.originalImage) {
            this.emitOptionCallback('onImageCleared', [previousImage, callbackContext]);
        }
        const imageInfo = this.getImageInfo();
        if (imageInfo) {
            this.emitOptionCallback('onImageLoaded', [imageInfo, callbackContext]);
        }
        if (hadMasks) {
            this.emitMasksChanged(callbackContext);
        }
        if (hadAnnotations) {
            this.emitAnnotationsChanged(callbackContext);
        }
        this.emitImageChanged(callbackContext);
    }
    getInternalOperationToken(options) {
        var _a;
        return ((_a = options === null || options === void 0 ? void 0 : options[INTERNAL_OPERATION_TOKEN]) !== null && _a !== void 0 ? _a : null);
    }
    canRunDuringAnimationQueue(options) {
        return !!(options === null || options === void 0 ? void 0 : options[INTERNAL_ALLOW_DURING_ANIMATION_QUEUE]);
    }
    withInternalOperationOptions(token, options = {}) {
        return {
            ...options,
            ...(token ? { [INTERNAL_OPERATION_TOKEN]: token } : {}),
            [TRUSTED_STATE_RESTORE]: true,
        };
    }
    withAnimationQueueBypass(options = {}) {
        return {
            ...options,
            [INTERNAL_ALLOW_DURING_ANIMATION_QUEUE]: true,
            [TRUSTED_STATE_RESTORE]: true,
        };
    }
    assertIdleForOperation(operationName, options) {
        const token = this.getInternalOperationToken(options);
        this.runtime.operationGuard.assertIdleForOperation(operationName, token);
        const activeToolMode = this.getActiveToolMode();
        if (activeToolMode &&
            !this.runtime.operationGuard.isOwnOperation(token) &&
            !canRunOperationInToolMode(activeToolMode, operationName)) {
            throw new plugins_transform_index.IdleGuardError(operationName, `while ${activeToolMode} mode is active`);
        }
        if (this.runtime.animQueue.isBusy() && !this.canRunDuringAnimationQueue(options)) {
            throw new plugins_transform_index.IdleGuardError(operationName, 'while an animation is queued');
        }
    }
    canRunIdleOperation(operationName, options) {
        try {
            this.assertIdleForOperation(operationName, options);
            return true;
        }
        catch (error) {
            if (!this.isExpectedIdleGuardError(error, operationName)) {
                throw error;
            }
            return false;
        }
    }
    isExpectedIdleGuardError(error, operationName) {
        return error instanceof plugins_transform_index.IdleGuardError && error.operation === operationName;
    }
    assertCanQueueAnimation(operationName, options) {
        const token = this.getInternalOperationToken(options);
        this.runtime.operationGuard.assertCanQueueAnimation(operationName, token);
        const activeToolMode = this.getActiveToolMode();
        if (activeToolMode &&
            !this.runtime.operationGuard.isOwnOperation(token) &&
            !canRunOperationInToolMode(activeToolMode, operationName)) {
            throw new Error(`[ImageEditor] Cannot run "${operationName}" while ${activeToolMode} mode is active.`);
        }
    }
    isImageLoaded() {
        const image = this.runtime.originalImage;
        return !!(image &&
            plugins_mask_index.isBaseImageObject(image) &&
            Number(image.width) > 0 &&
            Number(image.height) > 0);
    }
    isBusy() {
        return (this.runtime.operationGuard.isBusy() ||
            this.runtime.animQueue.isBusy() ||
            this.isToolModeActive());
    }
    isProcessing() {
        return this.runtime.operationGuard.isBusy() || this.runtime.animQueue.isBusy();
    }
    setImageFilterConfig(config) {
        if (!this.runtime.canvas || !this.runtime.originalImage)
            return;
        if (!this.canRunIdleOperation('setImageFilterConfig'))
            return;
        const result = mergeImageFilterConfigPatch(this.runtime.currentImageFilterConfig, config);
        if (result.warnings.length > 0) {
            plugins_mask_index.reportWarning(this.runtime.options, new TypeError(`[ImageEditor] Invalid or out-of-range image filter field(s): ${result.warnings.join(', ')}.`), 'Image filter config was normalized.');
        }
        if (areResolvedImageFilterConfigsEqual(this.runtime.currentImageFilterConfig, result.config)) {
            return;
        }
        this.runtime.currentImageFilterConfig = cloneResolvedImageFilterConfig(result.config);
        this.applyCurrentImageFilters();
        this.updateInputs();
        this.runtime.canvas.requestRenderAll();
        this.emitImageChanged(this.buildCallbackContext('setImageFilterConfig', false));
    }
    getImageFilterConfig() {
        return cloneResolvedImageFilterConfig(this.runtime.currentImageFilterConfig);
    }
    resetImageFilterConfig() {
        if (!this.runtime.canvas || !this.runtime.originalImage)
            return;
        if (!this.canRunIdleOperation('resetImageFilterConfig'))
            return;
        const next = cloneResolvedImageFilterConfig(this.runtime.lastCommittedImageFilterConfig);
        if (areResolvedImageFilterConfigsEqual(this.runtime.currentImageFilterConfig, next))
            return;
        this.runtime.currentImageFilterConfig = next;
        this.applyCurrentImageFilters();
        this.updateInputs();
        this.runtime.canvas.requestRenderAll();
        this.emitImageChanged(this.buildCallbackContext('resetImageFilterConfig', false));
    }
    clearImageFilters() {
        if (!this.runtime.canvas || !this.runtime.originalImage)
            return;
        if (!this.canRunIdleOperation('clearImageFilters'))
            return;
        this.runtime.currentImageFilterConfig = cloneResolvedImageFilterConfig(DEFAULT_IMAGE_FILTER_CONFIG);
        this.applyCurrentImageFilters();
        this.updateInputs();
        this.commitImageFiltersInternal('clearImageFilters');
    }
    commitImageFilters() {
        this.commitImageFiltersInternal('commitImageFilters');
    }
    commitImageFiltersInternal(operation) {
        if (!this.runtime.canvas || !this.runtime.originalImage)
            return;
        if (!this.canRunIdleOperation(operation))
            return;
        if (areResolvedImageFilterConfigsEqual(this.runtime.currentImageFilterConfig, this.runtime.lastCommittedImageFilterConfig)) {
            return;
        }
        this.saveStateInternal();
        this.runtime.lastCommittedImageFilterConfig = cloneResolvedImageFilterConfig(this.runtime.currentImageFilterConfig);
        const context = this.buildCallbackContext(operation, false);
        this.emitHistoryChangeIfChanged(context);
        this.emitImageChanged(context);
    }
    applyCurrentImageFilters() {
        const image = this.runtime.originalImage;
        if (!image)
            return;
        applyImageFilterConfigToImage(this.runtime.fabricModule, image, this.runtime.currentImageFilterConfig, (error, message) => {
            plugins_mask_index.reportWarning(this.runtime.options, error, message);
        });
    }
    setLayoutMode(mode) {
        var _a;
        if (!isLayoutMode(mode)) {
            plugins_mask_index.reportWarning(this.runtime.options, new TypeError(`[ImageEditor] Unsupported layout mode ${JSON.stringify(mode)}. ` +
                'Expected "fit", "cover", or "expand".'), 'Ignored invalid layout mode.');
            return;
        }
        this.runtime.currentLayoutMode = mode;
        (_a = this.pluginCore) === null || _a === void 0 ? void 0 : _a.setLayoutMode(mode);
    }
    setCanvasSize(widthPx, heightPx) {
        this.applyPublicCanvasSize(widthPx, heightPx, 'setCanvasSize');
    }
    resizeToContainer(options = {}) {
        if (!this.canRunPublicLayoutOperation('resizeToContainer'))
            return;
        const size = this.resolveContainerResizeSize(options);
        if (!size) {
            plugins_mask_index.reportWarning(this.runtime.options, new TypeError('[ImageEditor] Container dimensions are not available.'), 'resizeToContainer ignored because no valid container or fallback size was available.');
            return;
        }
        this.applyPublicCanvasSize(size.width, size.height, 'resizeToContainer', {
            skipGuard: true,
            preserveScroll: true,
        });
    }
    relayout(options = {}) {
        var _a;
        if (!this.canRunPublicLayoutOperation('relayout'))
            return;
        if (options.mode !== undefined) {
            if (!isLayoutMode(options.mode)) {
                plugins_mask_index.reportWarning(this.runtime.options, new TypeError(`[ImageEditor] Unsupported relayout mode ${JSON.stringify(options.mode)}. ` +
                    'Expected "fit", "cover", or "expand".'), 'Ignored invalid relayout mode.');
                return;
            }
            this.runtime.currentLayoutMode = options.mode;
        }
        const scroll = options.preserveScroll
            ? captureContainerScroll(this.runtime.containerElement)
            : null;
        const viewport = this.runtime.containerElement ? this.measureLayoutViewport() : null;
        if (viewport)
            this.setCanvasSizePx(viewport.width, viewport.height);
        if (this.runtime.originalImage) {
            this.updateCanvasSizeToImageBounds();
        }
        restoreContainerScroll(this.runtime.containerElement, scroll, this.runtime.options);
        (_a = this.runtime.canvas) === null || _a === void 0 ? void 0 : _a.renderAll();
        this.refreshAfterCanvasLayoutChange('relayout');
    }
    buildCallbackContext(operation, isInternalOperation = false) {
        return { operation, isInternalOperation };
    }
    getOperationContext(fallback, options) {
        const internal = this.getInternalOperationToken(options);
        const activeOperation = this.runtime.operationGuard.activeOperationName();
        if (internal && activeOperation) {
            return this.buildCallbackContext(isImageEditorOperation(activeOperation) ? activeOperation : fallback, true);
        }
        return this.buildCallbackContext(fallback, false);
    }
    emitOptionCallback(callbackName, args) {
        const callback = this.runtime.options[callbackName];
        if (typeof callback !== 'function')
            return;
        try {
            callback(...args);
        }
        catch (error) {
            console.error(`[ImageEditor] ${callbackName} callback threw`, error);
        }
    }
    getImageInfo() {
        if (!this.runtime.canvas || !this.runtime.originalImage || !this.isImageLoaded()) {
            return null;
        }
        const canvasWidth = this.runtime.canvas.getWidth();
        const canvasHeight = this.runtime.canvas.getHeight();
        let displayWidth;
        let displayHeight;
        try {
            this.runtime.originalImage.setCoords();
            const bounds = this.runtime.originalImage.getBoundingRect();
            displayWidth = Math.max(0, Number(bounds.width) || 0);
            displayHeight = Math.max(0, Number(bounds.height) || 0);
        }
        catch (error) {
            plugins_mask_index.reportWarning(this.runtime.options, error, 'getImageInfo used fallback dimensions because Fabric getBoundingRect failed.');
            displayWidth = Math.max(0, (Number(this.runtime.originalImage.width) || 0) *
                Math.abs(Number(this.runtime.originalImage.scaleX) || 1));
            displayHeight = Math.max(0, (Number(this.runtime.originalImage.height) || 0) *
                Math.abs(Number(this.runtime.originalImage.scaleY) || 1));
        }
        return {
            width: Math.max(0, Number(this.runtime.originalImage.width) || 0),
            height: Math.max(0, Number(this.runtime.originalImage.height) || 0),
            displayWidth,
            displayHeight,
            scale: this.runtime.currentScale,
            rotation: this.runtime.currentRotation,
            canvasWidth,
            canvasHeight,
        };
    }
    getMasks() {
        return this.maskPluginApi ? [...this.maskPluginApi.getAll()] : [];
    }
    getAnnotations() {
        if (!this.runtime.canvas)
            return [];
        return getAnnotations(this.runtime.canvas);
    }
    exportOverlayState(options = {}) {
        this.assertIdleForOperation('exportOverlayState');
        return exportOverlayState(this.buildOverlayStateExportContext(), options);
    }
    validateOverlayState(input, options = {}) {
        return validateOverlayState(input, options);
    }
    async importOverlayState(input, options = {}) {
        var _a, _b;
        const validation = validateOverlayState(input, options);
        if (!validation.valid || !validation.state) {
            const message = (_b = (_a = validation.errors[0]) === null || _a === void 0 ? void 0 : _a.message) !== null && _b !== void 0 ? _b : 'Overlay state validation failed before import.';
            const error = new Error(`[ImageEditor] importOverlayState failed: ${message}`);
            error.validation = validation;
            throw error;
        }
        if (!this.runtime.canvas || !this.runtime.originalImage) {
            throw new Error('[ImageEditor] importOverlayState requires a loaded image.');
        }
        this.assertIdleForOperation('importOverlayState');
        const token = this.runtime.operationGuard.beginBusyOperation('importOverlayState');
        const callbackContext = this.buildCallbackContext('importOverlayState', false);
        const beforeSnapshot = this.captureSnapshotInternal();
        const previousActiveObject = this.runtime.canvas.getActiveObject();
        const previousSuppressSaveState = this.runtime.shouldSuppressSaveState;
        const previousMaskSignature = this.getMaskCollectionSignature();
        const previousAnnotationSignature = this.getAnnotationCollectionSignature();
        let result;
        this.finalizeActiveTextEditingIfNeeded();
        this.runtime.shouldSuppressSaveState = true;
        this.emitBusyChangeIfChanged(callbackContext);
        this.updateUi();
        try {
            result = await importOverlayStateIntoEditor(this.buildOverlayStateImportContext(), validation.state, options);
            this.runtime.shouldSuppressSaveState = previousSuppressSaveState;
            if (options.preserveSelection === true &&
                previousActiveObject &&
                this.runtime.canvas.getObjects().includes(previousActiveObject)) {
                this.runtime.canvas.setActiveObject(previousActiveObject);
            }
            if (options.saveHistory !== false) {
                this.saveStateInternal(this.withInternalOperationOptions(token));
            }
            else {
                this.runtime.lastSnapshot = this.captureSnapshotInternal();
            }
            this.updateInputs();
            this.updateMaskList();
            this.updateAnnotationList();
            this.updateUi();
            if (previousMaskSignature !== this.getMaskCollectionSignature()) {
                this.emitMasksChanged(callbackContext);
            }
            if (previousAnnotationSignature !== this.getAnnotationCollectionSignature()) {
                this.emitAnnotationsChanged(callbackContext);
            }
            this.emitImageChanged(callbackContext);
            return {
                ...result,
                warnings: [...validation.warnings, ...result.warnings],
            };
        }
        catch (error) {
            this.runtime.shouldSuppressSaveState = previousSuppressSaveState;
            try {
                await this.loadFromStateInternal(beforeSnapshot, this.withInternalOperationOptions(token));
            }
            catch (rollbackError) {
                plugins_mask_index.reportWarning(this.runtime.options, rollbackError, 'importOverlayState rollback failed.');
            }
            throw error;
        }
        finally {
            this.runtime.shouldSuppressSaveState = previousSuppressSaveState;
            this.runtime.operationGuard.endBusyOperation(token);
            this.emitBusyChangeIfChanged(callbackContext);
            if (!this.runtime.isDisposed && this.runtime.canvas)
                this.updateUi();
        }
    }
    buildOverlayStateExportContext() {
        return {
            canvas: this.runtime.canvas,
            originalImage: this.runtime.originalImage,
            currentRotation: this.runtime.currentRotation,
            currentImageMimeType: this.runtime.currentImageMimeType,
        };
    }
    buildOverlayStateImportContext() {
        return {
            fabric: this.runtime.fabricModule,
            canvas: this.runtime.getLiveCanvasOrThrow('importOverlayState'),
            options: this.runtime.getRuntimeOptions(),
            originalImage: this.runtime.originalImage,
            getMaskCounter: () => this.runtime.maskCounter,
            setMaskCounter: (value) => {
                this.runtime.maskCounter = value;
            },
            getAnnotationCounter: () => this.runtime.annotationCounter,
            setAnnotationCounter: (value) => {
                this.runtime.annotationCounter = value;
            },
            setLastMask: (mask) => {
                this.runtime.lastMask = mask;
            },
            setCurrentRotation: (rotation) => {
                this.runtime.currentRotation = rotation;
            },
            removeLabelForMask: (mask) => {
                this.removeLabelForMask(mask);
            },
            buildTextControllerContext: () => this.buildTextControllerContext(),
        };
    }
    getMaskCollectionSignature() {
        return this.getMasks()
            .map((mask) => `${mask.maskId}:${mask.maskName}`)
            .join('|');
    }
    getAnnotationCollectionSignature() {
        return this.getAnnotations()
            .map((annotation) => `${annotation.annotationId}:${annotation.annotationName}`)
            .join('|');
    }
    buildToolModeSnapshot() {
        return {
            hasCropSession: this.runtime.cropSession !== null,
            hasMosaicSession: this.runtime.mosaicSession !== null,
            hasTextSession: this.runtime.textSession !== null,
            hasDrawSession: this.runtime.drawSession !== null,
            hasShapeSession: this.runtime.shapeSession !== null,
        };
    }
    getActiveToolMode() {
        return getActiveToolMode(this.buildToolModeSnapshot());
    }
    isToolModeActive() {
        return isToolModeActive(this.buildToolModeSnapshot());
    }
    getEditorState() {
        var _a, _b;
        const canvasWidth = this.runtime.canvas ? this.runtime.canvas.getWidth() : 0;
        const canvasHeight = this.runtime.canvas ? this.runtime.canvas.getHeight() : 0;
        const image = this.getImageInfo();
        return {
            hasImage: image !== null,
            image,
            maskCount: this.getMasks().length,
            annotationCount: this.getAnnotations().length,
            currentScale: this.runtime.currentScale,
            currentRotation: this.runtime.currentRotation,
            isFlippedHorizontally: !!((_a = this.runtime.originalImage) === null || _a === void 0 ? void 0 : _a.flipX),
            isFlippedVertically: !!((_b = this.runtime.originalImage) === null || _b === void 0 ? void 0 : _b.flipY),
            isBusy: this.isBusy(),
            activeToolMode: this.getActiveToolMode(),
            isCropMode: this.runtime.cropSession !== null,
            isMosaicMode: this.runtime.mosaicSession !== null,
            isTextMode: this.runtime.textSession !== null,
            isDrawMode: this.runtime.drawSession !== null,
            isShapeMode: this.runtime.shapeSession !== null,
            canUndo: this.runtime.historyManager.canUndo(),
            canRedo: this.runtime.historyManager.canRedo(),
            canvasWidth,
            canvasHeight,
        };
    }
    emitImageChanged(context) {
        this.emitOptionCallback('onImageChanged', [this.getEditorState(), context]);
        this.emitToolModeChangeIfChanged(context);
        this.emitHistoryChangeIfChanged(context);
    }
    emitMasksChanged(context) {
        this.emitOptionCallback('onMasksChanged', [this.getMasks(), context]);
    }
    emitAnnotationsChanged(context) {
        this.emitOptionCallback('onAnnotationsChanged', [this.getAnnotations(), context]);
    }
    emitBusyChangeIfChanged(context) {
        const isBusy = this.isBusy();
        if (this.runtime.lastEmittedIsBusy === isBusy)
            return;
        this.runtime.lastEmittedIsBusy = isBusy;
        this.emitOptionCallback('onBusyChange', [isBusy, context]);
    }
    emitToolModeChangeIfChanged(context) {
        const activeToolMode = this.getActiveToolMode();
        const previousToolMode = this.runtime.lastEmittedToolMode;
        if (previousToolMode === activeToolMode)
            return;
        this.runtime.lastEmittedToolMode = activeToolMode;
        this.emitOptionCallback('onToolModeChange', [activeToolMode, previousToolMode, context]);
    }
    emitHistoryChangeIfChanged(context) {
        const history = {
            canUndo: this.runtime.historyManager.canUndo(),
            canRedo: this.runtime.historyManager.canRedo(),
        };
        const previous = this.runtime.lastEmittedHistoryState;
        if (previous.canUndo === history.canUndo && previous.canRedo === history.canRedo)
            return;
        this.runtime.lastEmittedHistoryState = history;
        this.emitOptionCallback('onHistoryChange', [history, context]);
    }
    buildSelection(selected) {
        var _a, _b;
        const selectedMasks = selected.filter(plugins_mask_index.isMaskObject);
        const selectedAnnotations = selected.filter(plugins_mask_index.isAnnotationObject);
        const selectedObjectKind = selectedMasks.length === 1 && selectedAnnotations.length === 0
            ? 'mask'
            : selectedAnnotations.length === 1 && selectedMasks.length === 0
                ? 'annotation'
                : null;
        return {
            selectedMask: (_a = selectedMasks[0]) !== null && _a !== void 0 ? _a : null,
            selectedMasks,
            selectedAnnotation: (_b = selectedAnnotations[0]) !== null && _b !== void 0 ? _b : null,
            selectedAnnotations,
            selectedObjectKind,
        };
    }
    getSelection() {
        if (!this.runtime.canvas)
            return this.buildSelection([]);
        return this.buildSelection(getActiveSelectionObjects(this.runtime.canvas));
    }
    withSelectionChangeContext(context, callback) {
        const previous = this.runtime.nextSelectionChangeContext;
        this.runtime.nextSelectionChangeContext = context;
        try {
            return callback();
        }
        finally {
            this.runtime.nextSelectionChangeContext = previous;
        }
    }
    isSupportedImageMimeType(mimeType) {
        return mimeType === 'image/jpeg' || mimeType === 'image/png' || mimeType === 'image/webp';
    }
    inferCurrentImageMimeType() {
        const image = this.runtime.originalImage;
        if (!image)
            return null;
        let source = null;
        try {
            if (typeof image.getSrc === 'function')
                source = image.getSrc();
            else if (typeof image.src === 'string')
                source = image.src;
        }
        catch {
            source = null;
        }
        const mimeType = source ? detectSourceMimeType(source) : null;
        return this.isSupportedImageMimeType(mimeType) ? mimeType : null;
    }
    canRunPublicLayoutOperation(operation) {
        if (this.runtime.isDisposed || !this.runtime.canvas)
            return false;
        return this.canRunIdleOperation(operation);
    }
    normalizeCanvasDimension(value, operation) {
        const numericValue = Number(value);
        if (isPositiveFiniteDimension(numericValue))
            return Math.round(numericValue);
        plugins_mask_index.reportWarning(this.runtime.options, new TypeError(`[ImageEditor] ${operation} expected positive finite canvas dimensions.`), `${operation} ignored invalid canvas dimensions.`);
        return null;
    }
    validatePublicCanvasSizeBudget(width, height, operation) {
        const { maxExportDimension, maxExportPixels } = this.runtime.options;
        if (width > maxExportDimension || height > maxExportDimension) {
            const message = `${operation} ignored because canvas size ${width}x${height} exceeds maxExportDimension (${maxExportDimension}).`;
            plugins_mask_index.reportWarning(this.runtime.options, new RangeError(`[ImageEditor] ${message}`), message);
            return false;
        }
        const pixelCount = width * height;
        if (pixelCount > maxExportPixels) {
            const message = `${operation} ignored because canvas size ${width}x${height} exceeds maxExportPixels (${maxExportPixels}).`;
            plugins_mask_index.reportWarning(this.runtime.options, new RangeError(`[ImageEditor] ${message}`), message);
            return false;
        }
        return true;
    }
    applyPublicCanvasSize(widthPx, heightPx, operation, options = {}) {
        var _a;
        if (!options.skipGuard && !this.canRunPublicLayoutOperation(operation))
            return false;
        const width = this.normalizeCanvasDimension(widthPx, operation);
        const height = this.normalizeCanvasDimension(heightPx, operation);
        if (width === null || height === null)
            return false;
        if (!this.validatePublicCanvasSizeBudget(width, height, operation))
            return false;
        const scroll = options.preserveScroll
            ? captureContainerScroll(this.runtime.containerElement)
            : null;
        this.setCanvasSizePx(width, height);
        restoreContainerScroll(this.runtime.containerElement, scroll, this.runtime.options);
        (_a = this.runtime.canvas) === null || _a === void 0 ? void 0 : _a.renderAll();
        this.refreshAfterCanvasLayoutChange(operation);
        return true;
    }
    resolveContainerResizeSize(options) {
        var _a, _b;
        const container = this.runtime.containerElement;
        const containerWidth = Math.floor((_a = container === null || container === void 0 ? void 0 : container.clientWidth) !== null && _a !== void 0 ? _a : 0);
        const containerHeight = Math.floor((_b = container === null || container === void 0 ? void 0 : container.clientHeight) !== null && _b !== void 0 ? _b : 0);
        if (containerWidth > 0 && containerHeight > 0) {
            return { width: containerWidth, height: containerHeight };
        }
        const fallbackWidth = Number(options.fallbackWidth);
        const fallbackHeight = Number(options.fallbackHeight);
        if (isPositiveFiniteDimension(fallbackWidth) && isPositiveFiniteDimension(fallbackHeight)) {
            return { width: Math.round(fallbackWidth), height: Math.round(fallbackHeight) };
        }
        return null;
    }
    refreshAfterCanvasLayoutChange(operation) {
        const context = this.buildCallbackContext(operation, false);
        this.updateInputs();
        this.updateUi();
        this.updatePlaceholderStatus();
        this.emitImageChanged(context);
        this.emitBusyChangeIfChanged(context);
    }
    setCanvasSizePx(widthPx, heightPx) {
        if (!this.runtime.canvas)
            return;
        core_index.applyCanvasDimensions(this.runtime.canvas, widthPx, heightPx, this.runtime.containerElement);
    }
    alignObjectBoundingBoxToCanvasTopLeft(object) {
        var _a, _b, _c;
        object.setCoords();
        const boundingRect = object.getBoundingRect();
        object.set({
            left: ((_a = object.left) !== null && _a !== void 0 ? _a : 0) - boundingRect.left,
            top: ((_b = object.top) !== null && _b !== void 0 ? _b : 0) - boundingRect.top,
        });
        object.setCoords();
        (_c = this.runtime.canvas) === null || _c === void 0 ? void 0 : _c.renderAll();
    }
    buildDisplayGeometryContext() {
        return {
            canvas: this.runtime.canvas,
            containerElement: this.runtime.containerElement,
            options: this.runtime.options,
            currentLayoutMode: this.runtime.currentLayoutMode,
            viewportCache: this.runtime.viewportCache,
            getOriginalImage: () => this.runtime.originalImage,
            setCanvasSize: (widthPx, heightPx) => {
                this.setCanvasSizePx(widthPx, heightPx);
            },
            setCurrentScale: (scale) => {
                this.runtime.currentScale = scale;
            },
            setCurrentRotation: (rotation) => {
                this.runtime.currentRotation = rotation;
            },
            setBaseImageScale: (scale) => {
                this.runtime.baseImageScale = scale;
            },
            captureSnapshot: () => this.captureSnapshotInternal(),
            setLastSnapshot: (snapshot) => {
                this.runtime.lastSnapshot = snapshot;
            },
        };
    }
    measureLayoutViewport(scrollbarSize) {
        return measureLayoutViewport(this.buildDisplayGeometryContext(), scrollbarSize);
    }
    updateCanvasSizeToImageBounds(options = {}) {
        updateCanvasSizeToImageBounds(this.buildDisplayGeometryContext(), options);
    }
    shouldNormalizeCanvasSizeAfterStateRestore() {
        return shouldNormalizeCanvasSizeAfterStateRestore(this.buildDisplayGeometryContext());
    }
    settleFitCoverScrollbarsAfterStateRestore() {
        settleFitCoverScrollbarsAfterStateRestore(this.buildDisplayGeometryContext());
    }
    captureImageDisplayGeometry() {
        return captureImageDisplayGeometry(this.buildDisplayGeometryContext());
    }
    restoreMergedImageDisplayGeometry(geometry) {
        restoreMergedImageDisplayGeometry(this.buildDisplayGeometryContext(), geometry);
    }
    scaleImage(factor) {
        return scaleImageAction(this.actionAccessFactory.buildTransformActionAccess(), factor);
    }
    rotateImage(degrees) {
        return rotateImageAction(this.actionAccessFactory.buildTransformActionAccess(), degrees);
    }
    flipHorizontal() {
        return flipHorizontalAction(this.actionAccessFactory.buildTransformActionAccess());
    }
    flipVertical() {
        return flipVerticalAction(this.actionAccessFactory.buildTransformActionAccess());
    }
    resetImageTransform() {
        return resetImageTransformAction(this.actionAccessFactory.buildTransformActionAccess());
    }
    refreshUiAfterQueuedAnimation() {
        if (this.runtime.isDisposed || !this.runtime.canvas)
            return;
        this.updateInputs();
        this.updateUi();
    }
    async loadFromState(jsonString) {
        return this.loadFromStateInternal(jsonString);
    }
    async loadFromStateInternal(jsonString, options) {
        var _a, _b;
        await loadFromStateAction(this.actionAccessFactory.buildEditorStateActionAccess(), jsonString, options);
        await ((_a = this.pluginCore) === null || _a === void 0 ? void 0 : _a.adoptLegacyImageState({
            baseImage: this.runtime.originalImage,
            baseImageScale: this.runtime.baseImageScale,
            imageMimeType: this.runtime.currentImageMimeType,
            lifecycle: 'none',
        }));
        (_b = this.pluginHistoryAdapter) === null || _b === void 0 ? void 0 : _b.resetBaseline();
    }
    saveState() {
        this.saveStateInternal();
        this.emitHistoryChangeIfChanged(this.buildCallbackContext('saveState', false));
    }
    saveStateInternal(options) {
        saveStateAction(this.actionAccessFactory.buildEditorStateActionAccess(), options);
    }
    undo() {
        if (this.runtime.isDisposed)
            return Promise.resolve();
        if (!this.canRunIdleOperation('undo'))
            return Promise.resolve();
        this.finalizeActiveTextEditingIfNeeded();
        const context = this.buildCallbackContext('undo', true);
        const job = this.runtime.animQueue.add(async () => {
            if (this.runtime.isDisposed)
                return;
            this.runtime.activeStateRestoreOperation = 'undo';
            try {
                await this.runtime.historyManager.undo();
                this.emitHistoryChangeIfChanged(context);
            }
            finally {
                this.runtime.activeStateRestoreOperation = null;
            }
        });
        this.emitBusyChangeIfChanged(context);
        return job.finally(() => {
            this.refreshUiAfterQueuedAnimation();
            this.emitBusyChangeIfChanged(context);
        });
    }
    redo() {
        if (this.runtime.isDisposed)
            return Promise.resolve();
        if (!this.canRunIdleOperation('redo'))
            return Promise.resolve();
        this.finalizeActiveTextEditingIfNeeded();
        const context = this.buildCallbackContext('redo', true);
        const job = this.runtime.animQueue.add(async () => {
            if (this.runtime.isDisposed)
                return;
            this.runtime.activeStateRestoreOperation = 'redo';
            try {
                await this.runtime.historyManager.redo();
                this.emitHistoryChangeIfChanged(context);
            }
            finally {
                this.runtime.activeStateRestoreOperation = null;
            }
        });
        this.emitBusyChangeIfChanged(context);
        return job.finally(() => {
            this.refreshUiAfterQueuedAnimation();
            this.emitBusyChangeIfChanged(context);
        });
    }
    createMask(config = {}) {
        if (!this.runtime.canvas || !this.runtime.originalImage || !this.maskPluginApi)
            return null;
        if (!this.canRunIdleOperation('createMask'))
            return null;
        const context = this.buildCallbackContext('createMask', false);
        let mask;
        try {
            void this.preparePluginOwnedImageState();
            mask = this.withSelectionChangeContext(context, () => this.maskPluginApi.create(config));
        }
        catch (error) {
            plugins_mask_index.reportWarning(this.runtime.options, error, 'Mask creation failed.');
            return null;
        }
        this.runtime.lastMask = mask;
        this.runtime.maskCounter = Math.max(this.runtime.maskCounter, mask.maskId);
        this.updateMaskList();
        this.updateUi();
        this.emitMasksChanged(context);
        this.emitImageChanged(context);
        return mask;
    }
    removeSelectedMask() {
        var _a;
        if (!this.runtime.canvas || !this.maskPluginApi)
            return;
        if (!this.canRunIdleOperation('removeSelectedMask'))
            return;
        const active = this.runtime.canvas.getActiveObject();
        if (!active || !plugins_mask_index.isMaskObject(active))
            return;
        const before = this.getMasks().length;
        const context = this.buildCallbackContext('removeSelectedMask', false);
        this.withSelectionChangeContext(context, () => this.maskPluginApi.remove(active.maskUid));
        const remainingMasks = this.getMasks();
        this.runtime.lastMask = (_a = remainingMasks[remainingMasks.length - 1]) !== null && _a !== void 0 ? _a : null;
        this.updateMaskList();
        this.updateUi();
        if (this.getMasks().length !== before) {
            this.emitMasksChanged(context);
            this.emitImageChanged(context);
        }
    }
    removeAllMasks(options = {}) {
        if (!this.runtime.canvas || !this.maskPluginApi)
            return;
        if (!this.canRunIdleOperation('removeAllMasks', options))
            return;
        const before = this.getMasks().length;
        const context = this.buildCallbackContext('removeAllMasks', false);
        this.withSelectionChangeContext(context, () => this.maskPluginApi.removeAll({ saveHistory: options.saveHistory }));
        this.runtime.lastMask = null;
        this.runtime.maskCounter = 0;
        this.updateMaskList();
        this.updateUi();
        if (before > 0) {
            this.emitMasksChanged(context);
            this.emitImageChanged(context);
        }
    }
    buildMaskLabelContext() {
        return this.contextFactory.buildMaskLabelContext();
    }
    removeLabelForMask(mask) {
        const context = this.buildMaskLabelContext();
        if (!context)
            return;
        plugins_mask_index.removeLabelForMask(context, mask);
    }
    hideAllMaskLabels() {
        const context = this.buildMaskLabelContext();
        if (!context)
            return;
        plugins_mask_index.hideAllMaskLabels(context);
    }
    syncMaskLabel(mask) {
        const context = this.buildMaskLabelContext();
        if (!context)
            return;
        plugins_mask_index.syncMaskLabel(context, mask);
    }
    showLabelForMask(mask) {
        const context = this.buildMaskLabelContext();
        if (!context)
            return;
        plugins_mask_index.showLabelForMask(context, mask);
    }
    handleObjectMovingScalingRotating(target) {
        handleObjectMovingScalingRotating(this.actionAccessFactory.buildSelectionControllerAccess(), target);
    }
    handleObjectModified(target) {
        handleObjectModified(this.actionAccessFactory.buildSelectionControllerAccess(), target);
    }
    handleSelectionChanged(selected) {
        handleSelectionChanged(this.actionAccessFactory.buildSelectionControllerAccess(), selected);
    }
    buildMaskListContext() {
        return this.contextFactory.buildMaskListContext();
    }
    updateMaskList() {
        renderMaskList(this.buildMaskListContext());
    }
    updateMaskListSelection(selectedMask) {
        updateMaskListSelection(this.buildMaskListContext(), selectedMask);
    }
    enterTextMode() {
        enterTextModeAction(this.actionAccessFactory.buildAnnotationModeActionAccess());
    }
    exitTextMode() {
        exitTextModeAction(this.actionAccessFactory.buildAnnotationModeActionAccess());
    }
    isTextMode() {
        return this.runtime.textSession !== null;
    }
    createTextAnnotation(config = {}) {
        return createTextAnnotationAction(this.actionAccessFactory.buildAnnotationModeActionAccess(), config);
    }
    enterDrawMode() {
        enterDrawModeAction(this.actionAccessFactory.buildAnnotationModeActionAccess());
    }
    exitDrawMode() {
        exitDrawModeAction(this.actionAccessFactory.buildAnnotationModeActionAccess());
    }
    isDrawMode() {
        return this.runtime.drawSession !== null;
    }
    getTextConfig() {
        return cloneResolvedTextAnnotationConfig(this.runtime.currentTextConfig);
    }
    setTextConfig(config) {
        this.applyTextConfigPatch(config, 'setTextConfig');
    }
    resetTextConfig() {
        this.applyTextConfigPatch(this.runtime.defaultTextConfig, 'resetTextConfig');
    }
    setTextColor(color) {
        this.applyTextConfigPatch({ fill: color }, 'setTextColor');
    }
    setTextFontSize(size) {
        this.applyTextConfigPatch({ fontSize: size }, 'setTextFontSize');
    }
    getDrawConfig() {
        return cloneResolvedDrawConfig(this.runtime.currentDrawConfig);
    }
    setDrawConfig(config) {
        this.applyDrawConfigPatch(config, 'setDrawConfig');
    }
    resetDrawConfig() {
        this.applyDrawConfigPatch(this.runtime.defaultDrawConfig, 'resetDrawConfig');
    }
    setDrawColor(color) {
        this.applyDrawConfigPatch({ color }, 'setDrawColor');
    }
    setDrawBrushSize(size) {
        this.applyDrawConfigPatch({ brushSize: size }, 'setDrawBrushSize');
    }
    setDrawSubMode(mode) {
        if (!this.runtime.canvas || !this.runtime.drawSession)
            return;
        if (!this.canRunIdleOperation('setDrawSubMode'))
            return;
        if (mode !== 'brush' && mode !== 'erase') {
            plugins_mask_index.reportWarning(this.runtime.options, new TypeError('[ImageEditor] setDrawSubMode expected "brush" or "erase".'), 'Ignored invalid Draw sub-mode.');
            return;
        }
        setDrawSubMode(this.buildDrawControllerContext(), mode);
        this.updateInputs();
        this.emitImageChanged(this.buildCallbackContext('setDrawSubMode', false));
    }
    getDrawSubMode() {
        var _a, _b;
        return (_b = (_a = this.runtime.drawSession) === null || _a === void 0 ? void 0 : _a.subMode) !== null && _b !== void 0 ? _b : null;
    }
    getEraserConfig() {
        return cloneResolvedEraserConfig(this.runtime.currentEraserConfig);
    }
    setEraserConfig(config) {
        this.applyEraserConfigPatch(config, 'setEraserConfig');
    }
    resetEraserConfig() {
        this.applyEraserConfigPatch(this.runtime.defaultEraserConfig, 'resetEraserConfig');
    }
    createShapeAnnotation(config = {}) {
        if (!this.runtime.canvas)
            return null;
        if (!this.canRunIdleOperation('createShapeAnnotation'))
            return null;
        return createShapeAnnotation(this.buildShapeControllerContext(), config);
    }
    enterShapeMode(shape = this.runtime.currentShapeConfig.shape) {
        if (!this.runtime.canvas)
            return;
        if (!this.canRunIdleOperation('enterShapeMode'))
            return;
        enterShapeMode(this.buildShapeControllerContext(), shape);
        const callbackContext = this.buildCallbackContext('enterShapeMode', false);
        this.emitBusyChangeIfChanged(callbackContext);
        this.emitImageChanged(callbackContext);
    }
    exitShapeMode() {
        if (!this.runtime.canvas || !this.runtime.shapeSession)
            return;
        if (!this.canRunIdleOperation('exitShapeMode'))
            return;
        exitShapeMode(this.buildShapeControllerContext());
        const callbackContext = this.buildCallbackContext('exitShapeMode', false);
        this.emitBusyChangeIfChanged(callbackContext);
        this.emitImageChanged(callbackContext);
    }
    isShapeMode() {
        return this.runtime.shapeSession !== null;
    }
    getShapeConfig() {
        return cloneResolvedShapeAnnotationConfig(this.runtime.currentShapeConfig);
    }
    setShapeConfig(config) {
        this.applyShapeConfigPatch(config, 'setShapeConfig');
    }
    resetShapeConfig() {
        this.applyShapeConfigPatch(this.runtime.defaultShapeConfig, 'resetShapeConfig');
    }
    removeSelectedAnnotation() {
        if (!this.runtime.canvas)
            return;
        if (!this.canRunIdleOperation('removeSelectedAnnotation'))
            return;
        const callbackContext = this.buildCallbackContext('removeSelectedAnnotation', false);
        removeSelectedAnnotationAction(this.actionAccessFactory.buildEditableObjectActionAccess(), callbackContext);
    }
    removeAllAnnotations(options = {}) {
        if (!this.runtime.canvas)
            return;
        if (!this.canRunIdleOperation('removeAllAnnotations', options))
            return;
        const callbackContext = this.buildCallbackContext('removeAllAnnotations', false);
        removeAllAnnotationsAction(this.actionAccessFactory.buildEditableObjectActionAccess(), options, callbackContext);
    }
    updateAnnotation(annotationId, config) {
        if (!this.runtime.canvas)
            return;
        if (!this.canRunIdleOperation('updateAnnotation'))
            return;
        const callbackContext = this.buildCallbackContext('updateAnnotation', false);
        updateAnnotationAction(this.actionAccessFactory.buildEditableObjectActionAccess(), annotationId, config, callbackContext);
    }
    updateSelectedAnnotation(config) {
        if (!this.runtime.canvas)
            return;
        if (!this.canRunIdleOperation('updateSelectedAnnotation'))
            return;
        const callbackContext = this.buildCallbackContext('updateSelectedAnnotation', false);
        updateSelectedAnnotationAction(this.actionAccessFactory.buildEditableObjectActionAccess(), config, callbackContext);
    }
    deleteSelectedObject() {
        if (!this.runtime.canvas)
            return;
        if (!this.canRunIdleOperation('deleteSelectedObject'))
            return;
        this.finalizeActiveTextEditingIfNeeded();
        const callbackContext = this.buildCallbackContext('deleteSelectedObject', false);
        deleteSelectedEditableObjects(this.actionAccessFactory.buildEditableObjectActionAccess(), callbackContext);
    }
    bringSelectedObjectForward() {
        this.moveSelectedEditableObject('bringSelectedObjectForward');
    }
    sendSelectedObjectBackward() {
        this.moveSelectedEditableObject('sendSelectedObjectBackward');
    }
    bringSelectedObjectToFront() {
        this.moveSelectedEditableObject('bringSelectedObjectToFront');
    }
    sendSelectedObjectToBack() {
        this.moveSelectedEditableObject('sendSelectedObjectToBack');
    }
    buildAnnotationListContext() {
        return this.contextFactory.buildAnnotationListContext();
    }
    updateAnnotationList() {
        renderAnnotationList(this.buildAnnotationListContext());
    }
    updateAnnotationListSelection(selectedAnnotation) {
        updateAnnotationListSelection(this.buildAnnotationListContext(), selectedAnnotation);
    }
    buildTextControllerContext() {
        return this.contextFactory.buildTextControllerContext();
    }
    buildDrawControllerContext() {
        return this.contextFactory.buildDrawControllerContext();
    }
    buildShapeControllerContext() {
        return this.contextFactory.buildShapeControllerContext();
    }
    applyTextConfigPatch(config, operation) {
        applyTextConfigPatchAction(this.actionAccessFactory.buildAnnotationConfigActionAccess(), config, operation);
    }
    applyDrawConfigPatch(config, operation) {
        applyDrawConfigPatchAction(this.actionAccessFactory.buildAnnotationConfigActionAccess(), config, operation);
    }
    applyEraserConfigPatch(config, operation) {
        if (!this.runtime.canvas)
            return;
        if (!this.canRunIdleOperation(operation))
            return;
        const invalidFields = getInvalidEraserConfigFields(config);
        if (invalidFields.length > 0) {
            plugins_mask_index.reportWarning(this.runtime.options, null, `${operation} ignored invalid Eraser config fields: ${invalidFields.join(', ')}.`);
        }
        const next = mergeEraserConfigPatch(this.runtime.currentEraserConfig, config, this.runtime.defaultEraserConfig);
        if (areResolvedEraserConfigsEqual(this.runtime.currentEraserConfig, next))
            return;
        this.runtime.currentEraserConfig = next;
        updateEraserPreview(this.buildDrawControllerContext());
        this.updateInputs();
        this.updateUi();
        this.emitImageChanged(this.buildCallbackContext(operation, false));
    }
    applyShapeConfigPatch(config, operation) {
        if (!this.runtime.canvas)
            return;
        if (!this.canRunIdleOperation(operation))
            return;
        const invalidFields = getInvalidShapeAnnotationConfigFields(config);
        if (invalidFields.length > 0) {
            plugins_mask_index.reportWarning(this.runtime.options, null, `${operation} ignored invalid Shape config fields: ${invalidFields.join(', ')}.`);
        }
        const next = mergeShapeAnnotationConfigPatch(this.runtime.currentShapeConfig, config, this.runtime.defaultShapeConfig);
        if (areResolvedShapeAnnotationConfigsEqual(this.runtime.currentShapeConfig, next))
            return;
        this.runtime.currentShapeConfig = next;
        syncShapeModeConfig(this.buildShapeControllerContext());
        this.updateInputs();
        this.updateUi();
        this.emitImageChanged(this.buildCallbackContext(operation, false));
    }
    applyTextColorInput(color) {
        applyTextColorInputAction(this.actionAccessFactory.buildAnnotationConfigActionAccess(), color);
    }
    applyTextFontSizeInput(size) {
        applyTextFontSizeInputAction(this.actionAccessFactory.buildAnnotationConfigActionAccess(), size);
    }
    applyDrawColorInput(color) {
        applyDrawColorInputAction(this.actionAccessFactory.buildAnnotationConfigActionAccess(), color);
    }
    applyDrawBrushSizeInput(size) {
        applyDrawBrushSizeInputAction(this.actionAccessFactory.buildAnnotationConfigActionAccess(), size);
    }
    moveSelectedEditableObject(operation) {
        if (!this.runtime.canvas)
            return;
        if (!this.canRunIdleOperation(operation))
            return;
        moveSelectedEditableObject(this.actionAccessFactory.buildEditableObjectActionAccess(), operation);
    }
    async mergeMasks() {
        if (!this.runtime.canvas || !this.runtime.originalImage || !this.maskPluginApi)
            return;
        if (!this.canRunIdleOperation('mergeMasks'))
            return;
        const before = this.getMasks().length;
        if (before === 0)
            return;
        const context = this.buildCallbackContext('mergeMasks', false);
        await this.maskPluginApi.flatten();
        this.runtime.lastMask = null;
        this.runtime.maskCounter = 0;
        this.updateInputs();
        this.updateMaskList();
        this.updateUi();
        this.emitMasksChanged(context);
        this.emitImageChanged(context);
    }
    async downloadImage(options) {
        await downloadImageAction(this.actionAccessFactory.buildExportActionAccess(), options);
    }
    async exportImageBase64(options) {
        return exportImageBase64Action(this.actionAccessFactory.buildExportActionAccess(), options);
    }
    async exportImageFile(options) {
        return exportImageFileAction(this.actionAccessFactory.buildExportActionAccess(), options);
    }
    captureSnapshotInternal() {
        return captureSnapshotAction(this.actionAccessFactory.buildEditorStateActionAccess());
    }
    enterMosaicMode() {
        enterMosaicModeAction(this.actionAccessFactory.buildMosaicActionAccess());
    }
    exitMosaicMode() {
        exitMosaicModeAction(this.actionAccessFactory.buildMosaicActionAccess());
    }
    isMosaicMode() {
        return this.runtime.mosaicSession !== null;
    }
    getMosaicConfig() {
        return cloneResolvedMosaicConfig(this.runtime.currentMosaicConfig);
    }
    setMosaicConfig(config) {
        this.applyMosaicConfigPatch(config, 'setMosaicConfig');
    }
    resetMosaicConfig() {
        resetMosaicConfigAction(this.actionAccessFactory.buildMosaicActionAccess());
    }
    setMosaicBrushSize(size) {
        this.applyMosaicConfigPatch({ brushSize: size }, 'setMosaicBrushSize');
    }
    setMosaicBlockSize(size) {
        this.applyMosaicConfigPatch({ blockSize: size }, 'setMosaicBlockSize');
    }
    applyMosaicConfigPatch(config, operation) {
        applyMosaicConfigPatchAction(this.actionAccessFactory.buildMosaicActionAccess(), config, operation);
    }
    buildMosaicControllerContext() {
        return this.contextFactory.buildMosaicControllerContext();
    }
    enterCropMode(options = {}) {
        enterCropModeAction(this.actionAccessFactory.buildCropActionAccess(), options);
    }
    setCropAspectRatio(aspectRatio) {
        setCropAspectRatioAction(this.actionAccessFactory.buildCropActionAccess(), aspectRatio);
    }
    cancelCrop() {
        cancelCropAction(this.actionAccessFactory.buildCropActionAccess());
    }
    async applyCrop() {
        await applyCropAction(this.actionAccessFactory.buildCropActionAccess());
    }
    buildCropControllerContext(operationToken) {
        return this.contextFactory.buildCropControllerContext(operationToken);
    }
    updateInputs() {
        applyEditorInputState({
            currentScale: this.runtime.currentScale,
            imageFilterConfig: this.getImageFilterConfig(),
            mosaicConfig: this.getMosaicConfig(),
            textConfig: this.getTextConfig(),
            drawConfig: this.getDrawConfig(),
            drawSubMode: this.getDrawSubMode(),
            eraserConfig: this.getEraserConfig(),
            shapeConfig: this.getShapeConfig(),
        }, (key) => this.resolveElement(key));
    }
    async mergeAnnotations() {
        await mergeAnnotationsAction(this.actionAccessFactory.buildExportActionAccess());
    }
    updateUi() {
        const snapshot = buildEditorControlSnapshot(this.runtime);
        if (!snapshot)
            return;
        applyEditorControlState(snapshot, (key, enabled) => {
            this.setControlEnabled(key, enabled);
        });
    }
    buildControlElementContext() {
        return {
            elements: this.runtime.elements,
            originalDisabledMap: this.runtime.elementOriginalDisabledMap,
            originalAriaDisabledMap: this.runtime.elementOriginalAriaDisabledMap,
            originalPointerEventsMap: this.runtime.elementOriginalPointerEventsMap,
            getElement: (key) => this.resolveElement(key),
        };
    }
    setControlEnabled(key, isEnabled) {
        setEditorControlEnabled(this.buildControlElementContext(), key, isEnabled);
    }
    restoreElementOriginalStates() {
        restoreEditorControlOriginalStates(this.buildControlElementContext());
    }
    updatePlaceholderStatus() {
        setPlaceholderVisible(this.runtime.placeholderElement, this.runtime.containerElement, this.runtime.options.showPlaceholder ? !this.runtime.originalImage : false);
    }
    dispose() {
        void this.disposeInternal(false);
    }
    async disposeAsync() {
        await this.disposeInternal(true);
    }
    disposeInternal(waitForCanvasDispose) {
        var _a, _b, _c;
        if (this.runtime.isDisposed) {
            return waitForCanvasDispose ? Promise.resolve() : undefined;
        }
        const context = this.buildCallbackContext('dispose', false);
        const previousImage = this.runtime.originalImage;
        this.runtime.isDisposed = true;
        this.runtime.operationGuard.markDisposed();
        this.runtime.animQueue.clear();
        (_a = this.runtime.domBindings) === null || _a === void 0 ? void 0 : _a.removeAll();
        safelyRemoveKeyboardListener(this.runtime.keyboardDocument, this.runtime.keyboardHandler);
        this.runtime.keyboardHandler = null;
        this.runtime.keyboardDocument = null;
        this.restoreElementOriginalStates();
        safelyExitActiveSession(this.runtime.cropSession !== null, this.runtime.canvas, () => cancelCrop(this.buildCropControllerContext()), () => {
            this.runtime.cropSession = null;
        });
        safelyExitActiveSession(this.runtime.mosaicSession !== null, this.runtime.canvas, () => exitMosaicMode(this.buildMosaicControllerContext()), () => {
            this.runtime.mosaicSession = null;
        });
        safelyExitActiveSession(this.runtime.textSession !== null, this.runtime.canvas, () => exitTextMode(this.buildTextControllerContext()), () => {
            this.runtime.textSession = null;
        });
        safelyExitActiveSession(this.runtime.drawSession !== null, this.runtime.canvas, () => exitDrawMode(this.buildDrawControllerContext()), () => {
            this.runtime.drawSession = null;
        });
        safelyExitActiveSession(this.runtime.shapeSession !== null, this.runtime.canvas, () => exitShapeMode(this.buildShapeControllerContext()), () => {
            this.runtime.shapeSession = null;
        });
        const composition = this.pluginComposition;
        const pluginCore = this.pluginCore;
        const historyAdapter = this.pluginHistoryAdapter;
        if (historyAdapter) {
            this.historyFacade.detach(historyAdapter);
            historyAdapter.dispose();
        }
        this.pluginComposition = null;
        this.pluginCore = null;
        this.pluginHistoryAdapter = null;
        this.transformPluginApi = null;
        this.maskPluginApi = null;
        let canvasDispose;
        try {
            const disposal = waitForCanvasDispose
                ? ((_b = composition === null || composition === void 0 ? void 0 : composition.disposeAsync()) !== null && _b !== void 0 ? _b : pluginCore === null || pluginCore === void 0 ? void 0 : pluginCore.disposeAsync())
                : ((_c = composition === null || composition === void 0 ? void 0 : composition.dispose()) !== null && _c !== void 0 ? _c : pluginCore === null || pluginCore === void 0 ? void 0 : pluginCore.dispose());
            canvasDispose = Promise.resolve(disposal);
        }
        catch (error) {
            plugins_mask_index.reportWarning(this.runtime.options, error, 'Plugin cleanup failed during dispose.');
            canvasDispose = Promise.resolve();
        }
        canvasDispose = canvasDispose.catch((error) => {
            plugins_mask_index.reportWarning(this.runtime.options, error, 'Plugin cleanup failed during dispose.');
        });
        this.runtime.resetAfterDispose();
        if (previousImage) {
            this.emitOptionCallback('onImageCleared', [previousImage, context]);
        }
        this.emitImageChanged(context);
        this.emitBusyChangeIfChanged(context);
        this.emitOptionCallback('onEditorDisposed', [context]);
        if (waitForCanvasDispose)
            return canvasDispose;
        void canvasDispose.catch((error) => {
            plugins_mask_index.reportWarning(this.runtime.options, error, 'Canvas cleanup failed during dispose.');
        });
        return undefined;
    }
}

exports.isAnnotationObject = plugins_mask_index.isAnnotationObject;
exports.isBaseImageObject = plugins_mask_index.isBaseImageObject;
exports.isDrawAnnotationObject = plugins_mask_index.isDrawAnnotationObject;
exports.isEditableOverlayObject = plugins_mask_index.isEditableOverlayObject;
exports.isMaskObject = plugins_mask_index.isMaskObject;
exports.isSessionObject = plugins_mask_index.isSessionObject;
exports.isShapeAnnotationObject = plugins_mask_index.isShapeAnnotationObject;
exports.isTextAnnotationObject = plugins_mask_index.isTextAnnotationObject;
exports.ImageEditor = ImageEditor;
exports.default = ImageEditor;
//# sourceMappingURL=index.cjs.map
