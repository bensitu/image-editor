'use strict';

var internalCapabilities = require('./internal-capabilities-DIerpWRs.cjs');
var foundations_overlay_index = require('./index-Cs4bNsWm.cjs');
var errors = require('./errors-CQdnZvQh.cjs');

function isBaseImageObject(object) {
    return (!!object &&
        typeof object === 'object' &&
        object.editorObjectKind === 'baseImage');
}
function isMaskObject$1(object) {
    const candidate = object;
    return (!!candidate &&
        candidate.editorObjectKind === 'mask' &&
        typeof candidate.maskId === 'number' &&
        typeof candidate.maskUid === 'string' &&
        typeof candidate.maskName === 'string');
}
function isAnnotationObject(object) {
    const candidate = object;
    return (!!candidate &&
        candidate.editorObjectKind === 'annotation' &&
        typeof candidate.annotationId === 'number' &&
        typeof candidate.annotationType === 'string' &&
        typeof candidate.annotationName === 'string');
}
function isTextAnnotationObject(object) {
    return isAnnotationObject(object) && object.annotationType === 'text';
}
function isDrawAnnotationObject(object) {
    return isAnnotationObject(object) && object.annotationType === 'draw';
}
function isShapeAnnotationObject(object) {
    const candidate = object;
    return (isAnnotationObject(candidate) &&
        candidate.annotationType === 'shape' &&
        (candidate.shapeAnnotationKind === 'rect' ||
            candidate.shapeAnnotationKind === 'line' ||
            candidate.shapeAnnotationKind === 'arrow'));
}
function isSessionObject(object) {
    const candidate = object;
    return (!!candidate &&
        candidate.editorObjectKind === 'session' &&
        typeof candidate.sessionObjectType === 'string');
}
function isEditableOverlayObject(object) {
    return isMaskObject$1(object) || isAnnotationObject(object);
}

function markBaseImageObject(image) {
    const baseImage = image;
    baseImage.editorObjectKind = 'baseImage';
    return baseImage;
}
function markMaskObject(object, meta) {
    const mask = object;
    mask.editorObjectKind = 'mask';
    mask.maskId = meta.maskId;
    mask.maskUid = meta.maskUid;
    mask.maskName = meta.maskName;
    mask.originalAlpha = meta.originalAlpha;
    if (meta.originalStroke !== undefined)
        mask.originalStroke = meta.originalStroke;
    if (typeof meta.originalStrokeWidth === 'number') {
        mask.originalStrokeWidth = meta.originalStrokeWidth;
    }
    return mask;
}
function markAnnotationObject(object, meta) {
    var _a, _b;
    const annotation = object;
    annotation.editorObjectKind = 'annotation';
    annotation.annotationId = meta.annotationId;
    annotation.annotationType = meta.annotationType;
    annotation.annotationName = meta.annotationName;
    annotation.annotationHidden = (_a = meta.annotationHidden) !== null && _a !== void 0 ? _a : false;
    annotation.annotationLocked = (_b = meta.annotationLocked) !== null && _b !== void 0 ? _b : false;
    if (typeof meta.annotationSelectable === 'boolean') {
        annotation.annotationSelectable = meta.annotationSelectable;
    }
    if (typeof meta.annotationEvented === 'boolean') {
        annotation.annotationEvented = meta.annotationEvented;
    }
    if (typeof meta.annotationHasControls === 'boolean') {
        annotation.annotationHasControls = meta.annotationHasControls;
    }
    if (typeof meta.annotationEditable === 'boolean') {
        annotation.annotationEditable = meta.annotationEditable;
    }
    if (meta.shapeAnnotationKind) {
        annotation.shapeAnnotationKind = meta.shapeAnnotationKind;
    }
    return annotation;
}
function markSessionObject(object, sessionObjectType) {
    const sessionObject = object;
    sessionObject.editorObjectKind = 'session';
    sessionObject.sessionObjectType = sessionObjectType;
    return sessionObject;
}

function reportWarning(options, error, message) {
    const warningCallback = options.onWarning;
    if (typeof warningCallback !== 'function')
        return;
    try {
        warningCallback(error, message);
    }
    catch (callbackError) {
        console.warn('[ImageEditor] onWarning callback threw', callbackError);
    }
}
function reportError(options, error, message) {
    const errorCallback = options.onError;
    if (typeof errorCallback !== 'function')
        return;
    try {
        errorCallback(error, message);
    }
    catch (callbackError) {
        console.error('[ImageEditor] onError callback threw', callbackError);
    }
}

const UNSAFE_OBJECT_COPY_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
function canCopySafeObjectKey(key) {
    return !UNSAFE_OBJECT_COPY_KEYS.has(key);
}
function copySafeOwnProperties(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        return {};
    const output = Object.create(null);
    for (const [key, nestedValue] of Object.entries(value)) {
        if (!canCopySafeObjectKey(key))
            continue;
        output[key] = nestedValue;
    }
    return output;
}

const SELECTED_STROKE = '#ff0000';
const SELECTED_STROKE_WIDTH = 1;
const HOVER_STROKE = '#ff5500';
const HOVER_STROKE_WIDTH = 2;
const HOVER_OPACITY_BUMP = 0.2;
const DEFAULT_STROKE_FALLBACK = '#ccc';
const DEFAULT_STROKE_WIDTH_FALLBACK = 1;
const DEFAULT_ALPHA_FALLBACK = 0.5;
function getMaskNormalStyle(mask) {
    var _a;
    const strokeWidth = Number(mask.originalStrokeWidth);
    const opacity = Number(mask.originalAlpha);
    return {
        stroke: (_a = mask.originalStroke) !== null && _a !== void 0 ? _a : DEFAULT_STROKE_FALLBACK,
        strokeWidth: Number.isFinite(strokeWidth) ? strokeWidth : DEFAULT_STROKE_WIDTH_FALLBACK,
        opacity: Number.isFinite(opacity) ? opacity : DEFAULT_ALPHA_FALLBACK,
    };
}
function getMaskHoverStyle(mask) {
    const opacity = Number(mask.originalAlpha);
    const baseAlpha = Number.isFinite(opacity) ? opacity : DEFAULT_ALPHA_FALLBACK;
    return {
        stroke: HOVER_STROKE,
        strokeWidth: HOVER_STROKE_WIDTH,
        opacity: Math.min(baseAlpha + HOVER_OPACITY_BUMP, 1),
    };
}
function applyMaskSelectedStyle(mask) {
    mask.set({ stroke: SELECTED_STROKE, strokeWidth: SELECTED_STROKE_WIDTH });
}
function applyMaskUnselectedStyle(mask) {
    var _a;
    const strokeWidth = Number(mask.originalStrokeWidth);
    mask.set({
        stroke: (_a = mask.originalStroke) !== null && _a !== void 0 ? _a : DEFAULT_STROKE_FALLBACK,
        strokeWidth: Number.isFinite(strokeWidth) ? strokeWidth : DEFAULT_STROKE_WIDTH_FALLBACK,
    });
}
function attachMaskHoverHandlers(mask) {
    const tagged = mask;
    const mouseover = () => {
        var _a;
        tagged.set(getMaskHoverStyle(tagged));
        (_a = tagged.canvas) === null || _a === void 0 ? void 0 : _a.requestRenderAll();
    };
    const mouseout = () => {
        var _a;
        tagged.set(getMaskNormalStyle(tagged));
        (_a = tagged.canvas) === null || _a === void 0 ? void 0 : _a.requestRenderAll();
    };
    tagged.on('mouseover', mouseover);
    tagged.on('mouseout', mouseout);
    tagged.imageEditorMaskHandlers = { mouseover, mouseout };
}
function reattachMaskHoverHandlers(mask) {
    var _a;
    const tagged = mask;
    if (tagged.imageEditorMaskHandlers) {
        try {
            tagged.off('mouseover', tagged.imageEditorMaskHandlers.mouseover);
            tagged.off('mouseout', tagged.imageEditorMaskHandlers.mouseout);
        }
        catch {
        }
        delete tagged.imageEditorMaskHandlers;
    }
    const patch = {};
    if (!Number.isFinite(Number(tagged.originalAlpha))) {
        const opacity = Number(tagged.opacity);
        patch.originalAlpha = Number.isFinite(opacity) ? opacity : DEFAULT_ALPHA_FALLBACK;
    }
    if (tagged.originalStroke == null) {
        patch.originalStroke = (_a = tagged.stroke) !== null && _a !== void 0 ? _a : DEFAULT_STROKE_FALLBACK;
    }
    if (!Number.isFinite(Number(tagged.originalStrokeWidth))) {
        const sw = Number(tagged.strokeWidth);
        patch.originalStrokeWidth = Number.isFinite(sw) ? sw : DEFAULT_STROKE_WIDTH_FALLBACK;
    }
    if (Object.keys(patch).length > 0)
        tagged.set(patch);
    attachMaskHoverHandlers(tagged);
}
function detachMaskHoverHandlers(mask) {
    const tagged = mask;
    if (!tagged.imageEditorMaskHandlers)
        return;
    try {
        tagged.off('mouseover', tagged.imageEditorMaskHandlers.mouseover);
        tagged.off('mouseout', tagged.imageEditorMaskHandlers.mouseout);
    }
    catch {
    }
    delete tagged.imageEditorMaskHandlers;
}
function captureMaskStyleBackup(mask) {
    var _a, _b, _c, _d, _e, _f, _g;
    return {
        object: mask,
        opacity: (_a = mask.opacity) !== null && _a !== void 0 ? _a : 1,
        fill: ((_b = mask.fill) !== null && _b !== void 0 ? _b : null),
        strokeWidth: (_c = mask.strokeWidth) !== null && _c !== void 0 ? _c : 0,
        stroke: ((_d = mask.stroke) !== null && _d !== void 0 ? _d : null),
        selectable: (_e = mask.selectable) !== null && _e !== void 0 ? _e : true,
        evented: (_f = mask.evented) !== null && _f !== void 0 ? _f : true,
        lockRotation: (_g = mask.lockRotation) !== null && _g !== void 0 ? _g : false,
    };
}
function restoreMaskStyleBackup(backup) {
    try {
        backup.object.set({
            opacity: backup.opacity,
            fill: backup.fill,
            strokeWidth: backup.strokeWidth,
            stroke: backup.stroke,
            selectable: backup.selectable,
            evented: backup.evented,
            lockRotation: backup.lockRotation,
        });
        if (typeof backup.object.setCoords === 'function') {
            backup.object.setCoords();
        }
    }
    catch {
    }
}
async function withMaskStyleBackup(context, mutator, callback) {
    if (!context.canvas)
        return await callback();
    const masks = context.canvas.getObjects().filter(isMaskObject$1);
    const backups = masks.map(captureMaskStyleBackup);
    try {
        masks.forEach((mask, index) => mutator(mask, index));
        return await callback();
    }
    finally {
        for (const backup of backups)
            restoreMaskStyleBackup(backup);
    }
}
function applyCropHideMaskStyle(mask) {
    try {
        mask.set({ opacity: 0, evented: false, selectable: false });
    }
    catch {
    }
}

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
function withoutObject(canvas, object) {
    return canvas.getObjects().filter((candidate) => candidate !== object);
}
function findFirstSessionIndex(objects) {
    return objects.findIndex((object) => isSessionObject(object) || isLegacySessionObject(object));
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
function normalizeLayerOrder(canvas) {
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
function placeMaskObject(canvas, mask) {
    ensureOnCanvas(canvas, mask);
    const objects = withoutObject(canvas, mask);
    const firstSessionIndex = findFirstSessionIndex(objects);
    moveObjectTo(canvas, mask, firstSessionIndex === -1 ? objects.length : firstSessionIndex);
}
function placeAnnotationObject(canvas, annotation) {
    ensureOnCanvas(canvas, annotation);
    const objects = withoutObject(canvas, annotation);
    const firstSessionIndex = findFirstSessionIndex(objects);
    moveObjectTo(canvas, annotation, firstSessionIndex === -1 ? objects.length : firstSessionIndex);
}
function placeSessionObject(canvas, sessionObject) {
    ensureOnCanvas(canvas, sessionObject);
    moveObjectTo(canvas, sessionObject, withoutObject(canvas, sessionObject).length);
}
function getEditableOverlayRange(canvas) {
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

function resolveNumeric(val, axis, fallback, canvas, options) {
    if (typeof val === 'number') {
        return val;
    }
    if (typeof val === 'function') {
        return val(canvas, options);
    }
    if (typeof val === 'string' && val.endsWith('%')) {
        const pct = parseFloat(val);
        if (!Number.isFinite(pct)) {
            return fallback;
        }
        const dim = axis === 'x' ? canvas.getWidth() : canvas.getHeight();
        return Math.floor(dim * (pct / 100));
    }
    return fallback;
}
function coercePoint(pt) {
    if (Array.isArray(pt)) {
        return { x: Number(pt[0]), y: Number(pt[1]) };
    }
    return { x: Number(pt.x), y: Number(pt.y) };
}

const POLYGON_AREA_EPSILON = 1e-6;
const BUILT_IN_MASK_SHAPES = new Set(['rect', 'circle', 'ellipse', 'polygon']);
function createMaskUid(maskId) {
    return `mask-${maskId}`;
}
function isFabricObjectLike(value) {
    if (!value || typeof value !== 'object')
        return false;
    const candidate = value;
    return typeof candidate.set === 'function' && typeof candidate.on === 'function';
}
function isStyleObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function mergeMaskConfig(defaultMaskConfig, config) {
    const safeDefaultConfig = copySafeOwnProperties(defaultMaskConfig);
    const defaultStyles = safeDefaultConfig.styles;
    delete safeDefaultConfig.onCreate;
    delete safeDefaultConfig.fabricGenerator;
    delete safeDefaultConfig.styles;
    const safeConfig = copySafeOwnProperties(config);
    const configStyles = copySafeOwnProperties(config.styles);
    const safeDefaultStyles = copySafeOwnProperties(isStyleObject(defaultStyles) ? defaultStyles : {});
    return {
        ...safeDefaultConfig,
        ...safeConfig,
        styles: {
            ...safeDefaultStyles,
            ...configStyles,
        },
    };
}
function warnInvalidMask(options, reason) {
    reportWarning(options, null, `createMask skipped: ${reason}.`);
}
function isBuiltInMaskShape(value) {
    return typeof value === 'string' && BUILT_IN_MASK_SHAPES.has(value);
}
function resolveMaskShape(options, shape) {
    if (isBuiltInMaskShape(shape))
        return shape;
    reportWarning(options, null, `createMask received unsupported shape "${String(shape)}"; using "rect" instead.`);
    return 'rect';
}
function isResolvableNumericInput(value) {
    if (value === undefined)
        return true;
    if (typeof value === 'number')
        return Number.isFinite(value);
    if (typeof value === 'function')
        return true;
    if (typeof value === 'string' && value.endsWith('%')) {
        return Number.isFinite(Number.parseFloat(value));
    }
    return false;
}
function isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
}
function validateFiniteField(options, fieldName, value) {
    if (isFiniteNumber(value))
        return true;
    warnInvalidMask(options, `${fieldName} must resolve to a finite number`);
    return false;
}
function validatePositiveField(options, fieldName, value) {
    if (isFiniteNumber(value) && value > 0)
        return true;
    warnInvalidMask(options, `${fieldName} must resolve to a positive number`);
    return false;
}
function validateNonNegativeField(options, fieldName, value) {
    if (isFiniteNumber(value) && value >= 0)
        return true;
    warnInvalidMask(options, `${fieldName} must resolve to a non-negative number`);
    return false;
}
function validateNumericInputs(options, config) {
    const fields = [
        ['width', config.width],
        ['height', config.height],
        ['rx', config.rx],
        ['ry', config.ry],
        ['radius', config.radius],
        ['left', config.left],
        ['top', config.top],
    ];
    for (const [fieldName, value] of fields) {
        if (!isResolvableNumericInput(value)) {
            warnInvalidMask(options, `${fieldName} is not a supported numeric value`);
            return false;
        }
    }
    return true;
}
function resolveMaskNumericField(options, fieldName, value, axis, fallback, canvas) {
    try {
        return resolveNumeric(value, axis, fallback, canvas, options);
    }
    catch (error) {
        reportWarning(options, error, `createMask skipped: ${fieldName} resolver threw.`);
        return null;
    }
}
function resolvePolygonPoints(options, points) {
    if (!Array.isArray(points) || points.length < 3) {
        warnInvalidMask(options, 'polygon masks require at least three points');
        return null;
    }
    const resolvedPoints = points.map(coercePoint);
    const allFinite = resolvedPoints.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
    if (!allFinite) {
        warnInvalidMask(options, 'polygon points must contain finite x/y values');
        return null;
    }
    if (polygonArea(resolvedPoints) <= POLYGON_AREA_EPSILON) {
        warnInvalidMask(options, 'polygon points must describe a non-zero area');
        return null;
    }
    return resolvedPoints;
}
function resizeMaskCanvas(context, width, height) {
    if (context.expandCanvasIfNeeded) {
        context.expandCanvasIfNeeded(width, height);
    }
    else {
        context.canvas.setDimensions({ width, height });
    }
}
function polygonArea(points) {
    let area = 0;
    for (let index = 0; index < points.length; index += 1) {
        const current = points[index];
        const next = points[(index + 1) % points.length];
        area += current.x * next.y - next.x * current.y;
    }
    return Math.abs(area) / 2;
}
function createMask(context, config = {}) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r;
    const { canvas, options, fabric: fabricModule } = context;
    if (!canvas)
        return null;
    const mergedConfig = mergeMaskConfig(options.defaultMaskConfig, config);
    const requestedShapeType = (_a = mergedConfig.shape) !== null && _a !== void 0 ? _a : 'rect';
    if (!validateNumericInputs(options, mergedConfig))
        return null;
    const shapeType = typeof config.fabricGenerator === 'function'
        ? requestedShapeType
        : resolveMaskShape(options, requestedShapeType);
    const resolvedConfig = {
        width: options.defaultMaskWidth,
        height: options.defaultMaskHeight,
        color: 'rgba(0,0,0,0.5)',
        alpha: 0.5,
        gap: 5,
        left: undefined,
        top: undefined,
        angle: 0,
        selectable: true,
        ...mergedConfig,
        shape: shapeType,
    };
    const firstOffset = 10;
    let left;
    let top;
    const previousMask = context.getLastMask();
    if (mergedConfig.left === undefined && previousMask) {
        const previousRight = ((_b = previousMask.left) !== null && _b !== void 0 ? _b : 0) +
            (typeof previousMask.getScaledWidth === 'function'
                ? previousMask.getScaledWidth()
                : ((_c = previousMask.width) !== null && _c !== void 0 ? _c : 0) * ((_d = previousMask.scaleX) !== null && _d !== void 0 ? _d : 1));
        left = Math.round(previousRight + ((_e = resolvedConfig.gap) !== null && _e !== void 0 ? _e : 5));
        top = (_f = previousMask.top) !== null && _f !== void 0 ? _f : firstOffset;
    }
    else {
        const resolvedLeft = resolveMaskNumericField(options, 'left', mergedConfig.left, 'x', firstOffset, canvas);
        const resolvedTop = resolveMaskNumericField(options, 'top', mergedConfig.top, 'y', firstOffset, canvas);
        if (resolvedLeft === null || resolvedTop === null)
            return null;
        left = resolvedLeft;
        top = resolvedTop;
    }
    const resolvedWidth = resolveMaskNumericField(options, 'width', mergedConfig.width, 'x', options.defaultMaskWidth, canvas);
    const resolvedHeight = resolveMaskNumericField(options, 'height', mergedConfig.height, 'y', options.defaultMaskHeight, canvas);
    if (resolvedWidth === null || resolvedHeight === null)
        return null;
    resolvedConfig.width = resolvedWidth;
    resolvedConfig.height = resolvedHeight;
    let rx;
    if (mergedConfig.rx !== undefined) {
        const resolvedRx = resolveMaskNumericField(options, 'rx', mergedConfig.rx, 'x', 0, canvas);
        if (resolvedRx === null)
            return null;
        rx = resolvedRx;
    }
    let ry;
    if (mergedConfig.ry !== undefined) {
        const resolvedRy = resolveMaskNumericField(options, 'ry', mergedConfig.ry, 'y', 0, canvas);
        if (resolvedRy === null)
            return null;
        ry = resolvedRy;
    }
    let radius;
    if (shapeType === 'circle') {
        const resolvedRadius = resolveMaskNumericField(options, 'radius', mergedConfig.radius, 'x', Math.min(resolvedConfig.width, resolvedConfig.height) / 2, canvas);
        if (resolvedRadius === null)
            return null;
        radius = resolvedRadius;
    }
    const polygonPoints = shapeType === 'polygon' ? resolvePolygonPoints(options, mergedConfig.points) : null;
    if (!validateFiniteField(options, 'left', left) ||
        !validateFiniteField(options, 'top', top) ||
        !validatePositiveField(options, 'width', resolvedConfig.width) ||
        !validatePositiveField(options, 'height', resolvedConfig.height) ||
        !validateFiniteField(options, 'gap', resolvedConfig.gap) ||
        !validateFiniteField(options, 'angle', resolvedConfig.angle) ||
        !validateFiniteField(options, 'alpha', resolvedConfig.alpha)) {
        return null;
    }
    if ((rx !== undefined && !validateNonNegativeField(options, 'rx', rx)) ||
        (ry !== undefined && !validateNonNegativeField(options, 'ry', ry)) ||
        (radius !== undefined && !validatePositiveField(options, 'radius', radius)) ||
        (shapeType === 'polygon' && polygonPoints === null)) {
        return null;
    }
    let preExpandCanvasSize = null;
    if (options.layoutMode === 'expand') {
        const requiredWidth = Math.ceil(left + resolvedConfig.width + 10);
        const requiredHeight = Math.ceil(top + resolvedConfig.height + 10);
        const nextWidth = Math.max(canvas.getWidth(), requiredWidth);
        const nextHeight = Math.max(canvas.getHeight(), requiredHeight);
        if (nextWidth !== canvas.getWidth() || nextHeight !== canvas.getHeight()) {
            preExpandCanvasSize = { width: canvas.getWidth(), height: canvas.getHeight() };
            resizeMaskCanvas(context, nextWidth, nextHeight);
        }
    }
    const rollbackCanvasExpansion = () => {
        if (!preExpandCanvasSize)
            return;
        try {
            resizeMaskCanvas(context, preExpandCanvasSize.width, preExpandCanvasSize.height);
        }
        catch (error) {
            reportWarning(options, error, 'createMask rollback canvas size failed.');
        }
    };
    let mask;
    if (typeof config.fabricGenerator === 'function') {
        let generated;
        try {
            generated = config.fabricGenerator(resolvedConfig, canvas, options);
        }
        catch (error) {
            rollbackCanvasExpansion();
            reportWarning(options, error, 'createMask skipped: fabricGenerator threw.');
            return null;
        }
        if (!isFabricObjectLike(generated)) {
            rollbackCanvasExpansion();
            reportWarning(options, generated, 'createMask skipped: fabricGenerator did not return a Fabric object.');
            return null;
        }
        mask = generated;
    }
    else {
        const originProps = {
            originX: 'left',
            originY: 'top',
        };
        switch (shapeType) {
            case 'circle':
                mask = new fabricModule.Circle({
                    left,
                    top,
                    ...originProps,
                    radius,
                    fill: resolvedConfig.color,
                    opacity: resolvedConfig.alpha,
                    angle: (_g = resolvedConfig.angle) !== null && _g !== void 0 ? _g : 0,
                    ...resolvedConfig.styles,
                });
                break;
            case 'ellipse':
                mask = new fabricModule.Ellipse({
                    left,
                    top,
                    ...originProps,
                    rx: rx !== null && rx !== void 0 ? rx : resolvedConfig.width / 2,
                    ry: ry !== null && ry !== void 0 ? ry : resolvedConfig.height / 2,
                    fill: resolvedConfig.color,
                    opacity: resolvedConfig.alpha,
                    angle: (_h = resolvedConfig.angle) !== null && _h !== void 0 ? _h : 0,
                    ...resolvedConfig.styles,
                });
                break;
            case 'polygon': {
                const polygon = new fabricModule.Polygon(polygonPoints, {
                    ...originProps,
                    fill: resolvedConfig.color,
                    opacity: resolvedConfig.alpha,
                    angle: (_j = resolvedConfig.angle) !== null && _j !== void 0 ? _j : 0,
                    ...resolvedConfig.styles,
                });
                polygon.setCoords();
                const boundingRect = polygon.getBoundingRect();
                const deltaX = left - boundingRect.left;
                const deltaY = top - boundingRect.top;
                polygon.set({
                    left: ((_k = polygon.left) !== null && _k !== void 0 ? _k : 0) + deltaX,
                    top: ((_l = polygon.top) !== null && _l !== void 0 ? _l : 0) + deltaY,
                });
                polygon.setCoords();
                mask = polygon;
                break;
            }
            case 'rect':
            default:
                mask = new fabricModule.Rect({
                    left,
                    top,
                    ...originProps,
                    width: resolvedConfig.width,
                    height: resolvedConfig.height,
                    fill: resolvedConfig.color,
                    opacity: resolvedConfig.alpha,
                    angle: (_m = resolvedConfig.angle) !== null && _m !== void 0 ? _m : 0,
                    ...(rx !== undefined ? { rx } : {}),
                    ...(ry !== undefined ? { ry } : {}),
                    ...resolvedConfig.styles,
                });
        }
    }
    const maskObject = mask;
    maskObject.selectable = 'selectable' in mergedConfig ? !!mergedConfig.selectable : true;
    maskObject.evented = 'evented' in mergedConfig ? !!mergedConfig.evented : true;
    maskObject.hasControls = 'hasControls' in mergedConfig ? !!mergedConfig.hasControls : true;
    maskObject.transparentCorners =
        'transparentCorners' in mergedConfig ? !!mergedConfig.transparentCorners : false;
    maskObject.strokeUniform =
        'strokeUniform' in mergedConfig ? !!mergedConfig.strokeUniform : true;
    maskObject.lockRotation = !options.maskRotatable;
    maskObject.borderColor = (_o = mergedConfig.borderColor) !== null && _o !== void 0 ? _o : 'red';
    maskObject.cornerColor = (_p = mergedConfig.cornerColor) !== null && _p !== void 0 ? _p : 'black';
    maskObject.cornerSize = (_q = mergedConfig.cornerSize) !== null && _q !== void 0 ? _q : 8;
    const styles = ((_r = resolvedConfig.styles) !== null && _r !== void 0 ? _r : {});
    if ('stroke' in styles) {
        maskObject.stroke = styles.stroke;
    }
    else {
        maskObject.stroke = '#ccc';
    }
    if ('strokeWidth' in styles) {
        maskObject.strokeWidth = styles.strokeWidth;
    }
    else {
        maskObject.strokeWidth = 1;
    }
    if ('strokeDashArray' in styles) {
        maskObject.strokeDashArray = styles.strokeDashArray;
    }
    const nextId = context.getMaskCounter() + 1;
    context.setMaskCounter(nextId);
    markMaskObject(maskObject, {
        maskId: nextId,
        maskUid: createMaskUid(nextId),
        maskName: `${options.maskName}${nextId}`,
        originalAlpha: resolvedConfig.alpha,
        originalStroke: maskObject.stroke,
        originalStrokeWidth: maskObject.strokeWidth,
    });
    attachMaskHoverHandlers(maskObject);
    context.setLastMask(maskObject);
    placeMaskObject(canvas, maskObject);
    context.updateMaskList();
    if (resolvedConfig.selectable !== false) {
        canvas.setActiveObject(maskObject);
    }
    canvas.renderAll();
    context.saveCanvasState();
    if (typeof config.onCreate === 'function') {
        try {
            config.onCreate(maskObject, canvas);
        }
        catch (error) {
            reportWarning(options, error, 'createMask onCreate callback threw.');
        }
    }
    return maskObject;
}
function removeAllMasks(context, options = {}) {
    const masks = context.canvas.getObjects().filter(isMaskObject$1);
    if (masks.length === 0)
        return;
    for (const maskObject of masks) {
        context.removeLabelForMask(maskObject);
        detachMaskHoverHandlers(maskObject);
        context.canvas.remove(maskObject);
    }
    context.canvas.discardActiveObject();
    context.setLastMask(null);
    context.updateMaskList();
    context.canvas.renderAll();
    if (options.saveHistory !== false) {
        context.saveCanvasState();
    }
}

function removeLabelForMask(context, mask) {
    if (!context.canvas || !mask.labelObject)
        return;
    try {
        if (context.canvas.getObjects().includes(mask.labelObject)) {
            context.canvas.remove(mask.labelObject);
        }
    }
    catch {
    }
    try {
        delete mask.labelObject;
    }
    catch {
    }
}
function createLabelForMask(context, mask) {
    var _a;
    const { canvas, options, fabric: fabricModule } = context;
    if (!canvas || !options.maskLabelOnSelect)
        return;
    removeLabelForMask(context, mask);
    let labelTextObject = null;
    if (typeof options.label.create === 'function') {
        try {
            labelTextObject = options.label.create(mask, fabricModule);
        }
        catch (error) {
            reportWarning(options, error, 'label.create callback threw.');
            labelTextObject = null;
        }
    }
    if (!labelTextObject) {
        const indexForGetText = Math.max(0, mask.maskId - 1);
        let labelText = mask.maskName;
        if (typeof options.label.getText === 'function') {
            try {
                labelText = options.label.getText(mask, indexForGetText);
            }
            catch (error) {
                reportWarning(options, error, 'label.getText callback threw.');
                labelText = mask.maskName;
            }
        }
        const textOptions = {
            left: 0,
            top: 0,
            ...((_a = options.label.textOptions) !== null && _a !== void 0 ? _a : {}),
            originX: 'left',
            originY: 'top',
        };
        labelTextObject = new fabricModule.FabricText(labelText, textOptions);
    }
    markSessionObject(labelTextObject, 'maskLabel');
    labelTextObject.maskLabel = true;
    mask.labelObject = labelTextObject;
    canvas.add(labelTextObject);
    canvas.bringObjectToFront(labelTextObject);
    syncMaskLabel(context, mask);
}
function syncMaskLabel(context, mask) {
    var _a, _b, _c;
    const { canvas, options } = context;
    if (!canvas || !options.maskLabelOnSelect || !mask.labelObject)
        return;
    const coords = (_a = mask.getCoords) === null || _a === void 0 ? void 0 : _a.call(mask);
    if (!(coords === null || coords === void 0 ? void 0 : coords.length))
        return;
    const tl = coords[0];
    if (!tl)
        return;
    const center = mask.getCenterPoint();
    const vx = center.x - tl.x;
    const vy = center.y - tl.y;
    const dist = Math.sqrt(vx * vx + vy * vy) || 1;
    const offset = Math.max(0, (_b = options.maskLabelOffset) !== null && _b !== void 0 ? _b : 3);
    mask.labelObject.set({
        left: Math.round(tl.x + (vx / dist) * offset),
        top: Math.round(tl.y + (vy / dist) * offset),
        angle: (_c = mask.angle) !== null && _c !== void 0 ? _c : 0,
        originX: 'left',
        originY: 'top',
        visible: true,
    });
    mask.labelObject.setCoords();
    canvas.renderAll();
}
function showLabelForMask(context, mask) {
    if (!context.options.maskLabelOnSelect)
        return;
    if (!mask.labelObject) {
        createLabelForMask(context, mask);
    }
    if (mask.labelObject) {
        mask.labelObject.visible = true;
        syncMaskLabel(context, mask);
    }
}
function hideAllMaskLabels(context) {
    const { canvas } = context;
    if (!canvas)
        return;
    const objs = canvas.getObjects();
    objs.filter((o) => o.maskLabel).forEach((l) => {
        try {
            canvas.remove(l);
        }
        catch {
        }
    });
    objs.filter(isMaskObject$1).forEach((o) => {
        try {
            delete o.labelObject;
        }
        catch {
        }
    });
}

const MASK_PLUGIN_ID = '@bensitu/mask';
const MASK_SERIALIZED_OBJECT_PROPERTIES = [
    'hasControls',
    'selectable',
    'evented',
    'strokeUniform',
    'lockRotation',
    'transparentCorners',
    'borderColor',
    'cornerColor',
    'cornerSize',
];
const DEFAULT_LABEL = Object.freeze({
    getText: (mask) => mask.maskName,
    textOptions: Object.freeze({
        fontFamily: 'monospace',
        fontSize: 12,
        fill: '#ffffff',
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
    }),
});
function positive(value, fallback) {
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}
function nonNegative(value, fallback) {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;
}
function resolveMaskPluginOptions(options = {}) {
    var _a, _b;
    return Object.freeze({
        defaultWidth: positive(options.defaultWidth, 50),
        defaultHeight: positive(options.defaultHeight, 80),
        defaultConfig: Object.freeze({ ...((_a = options.defaultConfig) !== null && _a !== void 0 ? _a : {}) }),
        rotatable: options.rotatable === true,
        label: options.label === false ? false : Object.freeze({ ...DEFAULT_LABEL, ...options.label }),
        labelOffset: nonNegative(options.labelOffset, 3),
        listOrder: options.listOrder === 'back-to-front' ? 'back-to-front' : 'front-to-back',
        bindToImageTransform: options.bindToImageTransform === true,
        namePrefix: ((_b = options.namePrefix) === null || _b === void 0 ? void 0 : _b.trim()) || 'mask',
        onChange: options.onChange,
    });
}
function isMaskObject(value) {
    return (Reflect.get(value, 'editorObjectKind') === 'mask' &&
        typeof Reflect.get(value, 'maskId') === 'number' &&
        typeof Reflect.get(value, 'maskUid') === 'string' &&
        typeof Reflect.get(value, 'maskName') === 'string');
}
function isSerializedMaskData(value) {
    if (!value || typeof value !== 'object')
        return false;
    const candidate = value;
    return (!!candidate.object &&
        typeof candidate.object === 'object' &&
        Number.isSafeInteger(candidate.maskId) &&
        Number(candidate.maskId) > 0 &&
        typeof candidate.maskUid === 'string' &&
        candidate.maskUid.length > 0 &&
        typeof candidate.maskName === 'string' &&
        typeof candidate.originalAlpha === 'number' &&
        Number.isFinite(candidate.originalAlpha));
}
class MaskPluginController {
    constructor(host, state, overlay, operations, options) {
        Object.defineProperty(this, "host", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: host
        });
        Object.defineProperty(this, "state", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: state
        });
        Object.defineProperty(this, "overlay", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: overlay
        });
        Object.defineProperty(this, "operations", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: operations
        });
        Object.defineProperty(this, "options", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: options
        });
        Object.defineProperty(this, "counter", {
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
        Object.defineProperty(this, "attached", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "disposed", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "selectedMaskBeforeGeometry", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "registrations", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "legacyOptions", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "onObjectTransform", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: (event) => {
                if (event.target && isMaskObject(event.target)) {
                    syncMaskLabel(this.labelContext(), event.target);
                }
            }
        });
        this.legacyOptions = Object.freeze({
            ...host.options,
            defaultMaskWidth: options.defaultWidth,
            defaultMaskHeight: options.defaultHeight,
            defaultMaskConfig: options.defaultConfig,
            maskRotatable: options.rotatable,
            maskLabelOnSelect: options.label !== false,
            maskLabelOffset: options.labelOffset,
            maskName: options.namePrefix,
            maskListOrder: options.listOrder,
            label: options.label === false ? DEFAULT_LABEL : options.label,
            onWarning: (error, message) => host.reportWarning(error, message),
        });
        this.registrations.push(overlay.registerKind({
            id: 'mask',
            ownerPluginId: MASK_PLUGIN_ID,
            classify: isMaskObject,
            getPersistentId: (object) => isMaskObject(object) && object.maskUid ? object.maskUid : null,
            setPersistentId: (object, id) => {
                if (isMaskObject(object))
                    object.maskUid = id;
            },
        }));
        this.registrations.push(overlay.registerGeometryPolicy({
            id: `${MASK_PLUGIN_ID}:geometry`,
            kind: 'mask',
            ownerPluginId: MASK_PLUGIN_ID,
            supports: (mutation) => options.bindToImageTransform && mutation.kind === 'transform',
            prepare: () => this.captureSelectionBeforeGeometry(),
            synchronize: () => this.synchronizeAfterGeometry(),
        }));
        this.registrations.push(overlay.registerSerializer({
            id: `${MASK_PLUGIN_ID}:serializer`,
            kind: 'mask',
            ownerPluginId: MASK_PLUGIN_ID,
            serialize: (object) => this.serializeMask(object),
            validate: isSerializedMaskData,
            deserialize: (data, context) => this.deserializeMask(data, context.fabric),
        }));
        this.registrations.push(overlay.registerExportRenderer({
            id: `${MASK_PLUGIN_ID}:renderer`,
            kind: 'mask',
            ownerPluginId: MASK_PLUGIN_ID,
            order: 100,
            render: async ({ source, targetCanvas }) => {
                const clone = await source.clone();
                clone.set({
                    visible: true,
                    opacity: 1,
                    fill: '#000000',
                    stroke: null,
                    strokeWidth: 0,
                    selectable: false,
                    evented: false,
                });
                targetCanvas.add(clone);
            },
        }));
        this.registrations.push(state.transientObjects.register(MASK_PLUGIN_ID, (object) => {
            const candidate = object;
            return candidate.maskLabel === true;
        }));
        this.registrations.push(state.slices.register({
            id: MASK_PLUGIN_ID,
            version: 1,
            capture: () => Object.freeze({ counter: this.counter }),
            validate: (value) => {
                const counter = value === null || value === void 0 ? void 0 : value.counter;
                return Number.isSafeInteger(counter) && Number(counter) >= 0
                    ? { valid: true, value: { counter: Number(counter) } }
                    : { valid: false, message: 'Mask counter state is malformed.' };
            },
            restore: (value) => {
                var _a;
                this.counter = value.counter;
                const masks = this.getAll();
                this.lastMask = (_a = masks[masks.length - 1]) !== null && _a !== void 0 ? _a : null;
                this.reattachRuntimeState();
            },
            clearState: () => {
                this.counter = 0;
                this.lastMask = null;
                this.removeLabels();
            },
        }));
        this.registrations.push(overlay.onSelectionChange(() => this.synchronizeSelection()));
        if (host.getCanvas())
            this.attach();
    }
    attach() {
        this.assertActive('attach Mask plugin');
        if (this.attached)
            return;
        const canvas = this.host.requireCanvas('attach Mask plugin');
        if (typeof canvas.on === 'function') {
            for (const eventName of [
                'object:moving',
                'object:scaling',
                'object:rotating',
                'object:modified',
            ]) {
                canvas.on(eventName, this.onObjectTransform);
            }
        }
        this.attached = true;
        this.reattachRuntimeState();
    }
    create(config = {}) {
        return this.operations.run('mask:create', () => {
            this.synchronizeCounterFromCanvas();
            const before = this.state.mementos.capture();
            const mask = createMask(this.createContext(), config);
            if (!mask)
                throw new errors.CoreRuntimeError('[ImageEditor] Mask configuration is invalid.');
            this.commitHistory('mask:create', before);
            this.notifyChange();
            this.synchronizeSelection();
            return mask;
        });
    }
    getAll() {
        const masks = this.overlay
            .list({ kinds: ['mask'], includeHidden: true, includeLocked: true })
            .filter(isMaskObject);
        if (this.options.listOrder === 'back-to-front')
            masks.reverse();
        return Object.freeze(masks);
    }
    remove(id) {
        this.operations.run('mask:remove', () => {
            const object = this.overlay.getByPersistentId(id);
            if (!object || !isMaskObject(object)) {
                throw new errors.CoreRuntimeError(`[ImageEditor] Mask "${id}" was not found.`);
            }
            const before = this.state.mementos.capture();
            this.removeMaskObject(object);
            this.commitHistory('mask:remove', before);
            this.notifyChange();
        });
    }
    removeSelected() {
        const selectedId = this.overlay.getSelection().ids.find((id) => {
            const object = this.overlay.getByPersistentId(id);
            return object ? isMaskObject(object) : false;
        });
        if (selectedId)
            this.remove(selectedId);
    }
    removeAll(options = {}) {
        this.operations.run('mask:remove-all', () => {
            const masks = [...this.getAll()];
            if (masks.length === 0)
                return;
            const before = this.state.mementos.capture();
            for (const mask of masks)
                this.removeMaskObject(mask);
            this.counter = 0;
            this.lastMask = null;
            if (options.saveHistory !== false)
                this.commitHistory('mask:remove-all', before);
            this.notifyChange();
        });
    }
    flatten(options) {
        return this.overlay
            .flatten({ kinds: ['mask'], includeHidden: false, includeLocked: true }, options)
            .then(() => {
            var _a;
            const masks = this.getAll();
            this.lastMask = (_a = masks[masks.length - 1]) !== null && _a !== void 0 ? _a : null;
            this.notifyChange();
        });
    }
    resetForImage() {
        this.counter = 0;
        this.lastMask = null;
        this.removeLabels();
    }
    dispose() {
        var _a;
        if (this.disposed)
            return;
        const canvas = this.host.getCanvas();
        if (canvas && typeof canvas.off === 'function') {
            for (const eventName of [
                'object:moving',
                'object:scaling',
                'object:rotating',
                'object:modified',
            ]) {
                canvas.off(eventName, this.onObjectTransform);
            }
        }
        this.removeLabels();
        for (const object of (_a = canvas === null || canvas === void 0 ? void 0 : canvas.getObjects()) !== null && _a !== void 0 ? _a : []) {
            if (isMaskObject(object))
                detachMaskHoverHandlers(object);
        }
        const errors$1 = [];
        for (let index = this.registrations.length - 1; index >= 0; index -= 1) {
            try {
                const result = this.registrations[index].dispose();
                if (result instanceof Promise)
                    void result.catch((error) => errors$1.push(error));
            }
            catch (error) {
                errors$1.push(error);
            }
        }
        this.registrations.length = 0;
        this.attached = false;
        this.disposed = true;
        if (errors$1.length > 0) {
            throw new errors.CoreRuntimeError(`[ImageEditor] Mask disposal had ${errors$1.length} cleanup error(s).`);
        }
    }
    createContext() {
        return {
            fabric: this.host.fabric,
            canvas: this.host.requireCanvas('create a mask'),
            options: this.legacyOptions,
            getLastMask: () => this.lastMask,
            setLastMask: (mask) => {
                this.lastMask = mask;
            },
            getMaskCounter: () => this.counter,
            setMaskCounter: (counter) => {
                this.counter = counter;
            },
            updateMaskList: () => undefined,
            saveCanvasState: () => undefined,
            expandCanvasIfNeeded: (width, height) => this.host.setCanvasSize(width, height),
        };
    }
    labelContext() {
        return {
            fabric: this.host.fabric,
            canvas: this.host.requireCanvas('synchronize mask labels'),
            options: this.legacyOptions,
        };
    }
    serializeMask(object) {
        if (!isMaskObject(object))
            throw new errors.CoreRuntimeError('[ImageEditor] Mask serializer received a non-mask.');
        const compatibility = object;
        return Object.freeze({
            object: object.toObject(MASK_SERIALIZED_OBJECT_PROPERTIES),
            maskId: object.maskId,
            maskUid: object.maskUid,
            maskName: object.maskName,
            originalAlpha: object.originalAlpha,
            originalStroke: object.originalStroke,
            originalStrokeWidth: object.originalStrokeWidth,
            overlayPersistentId: compatibility.overlayPersistentId,
            overlayMetadata: compatibility.overlayMetadata,
        });
    }
    async deserializeMask(data, fabricModule) {
        if (!isSerializedMaskData(data)) {
            throw new errors.CoreRuntimeError('[ImageEditor] Serialized Mask data is malformed.');
        }
        const objects = await fabricModule.util.enlivenObjects([
            data.object,
        ]);
        const object = objects[0];
        if (!object)
            throw new errors.CoreRuntimeError('[ImageEditor] Fabric did not restore a Mask object.');
        const mask = object;
        mask.editorObjectKind = 'mask';
        mask.maskId = data.maskId;
        mask.maskUid = data.maskUid;
        mask.maskName = data.maskName;
        mask.originalAlpha = data.originalAlpha;
        mask.originalStroke = data.originalStroke;
        mask.originalStrokeWidth = data.originalStrokeWidth;
        const compatibility = mask;
        compatibility.overlayPersistentId = data.overlayPersistentId;
        compatibility.overlayMetadata = data.overlayMetadata;
        mask.lockRotation = !this.options.rotatable;
        reattachMaskHoverHandlers(mask);
        return mask;
    }
    synchronizeSelection() {
        if (!this.attached || this.disposed)
            return;
        const masks = this.getAll();
        for (const mask of masks) {
            applyMaskUnselectedStyle(mask);
            removeLabelForMask(this.labelContext(), mask);
        }
        const selection = this.overlay.getSelection();
        if (selection.ids.length !== 1)
            return;
        const selected = this.overlay.getByPersistentId(selection.ids[0]);
        if (!selected || !isMaskObject(selected))
            return;
        applyMaskSelectedStyle(selected);
        showLabelForMask(this.labelContext(), selected);
    }
    syncLabels() {
        if (!this.attached || this.disposed)
            return;
        for (const mask of this.getAll()) {
            if (mask.labelObject)
                syncMaskLabel(this.labelContext(), mask);
        }
    }
    captureSelectionBeforeGeometry() {
        const selection = this.overlay.getSelection();
        if (selection.ids.length !== 1) {
            this.selectedMaskBeforeGeometry = null;
            return;
        }
        const selected = this.overlay.getByPersistentId(selection.ids[0]);
        this.selectedMaskBeforeGeometry =
            selected && isMaskObject(selected) ? selected.maskUid : null;
    }
    synchronizeAfterGeometry() {
        this.syncLabels();
        const selectedId = this.selectedMaskBeforeGeometry;
        this.selectedMaskBeforeGeometry = null;
        if (!selectedId || this.options.label === false)
            return;
        const selected = this.overlay.getByPersistentId(selectedId);
        if (!selected || !isMaskObject(selected))
            return;
        showLabelForMask(this.labelContext(), selected);
        syncMaskLabel(this.labelContext(), selected);
    }
    removeLabels() {
        const canvas = this.host.getCanvas();
        if (!canvas)
            return;
        hideAllMaskLabels({
            fabric: this.host.fabric,
            canvas,
            options: this.legacyOptions,
        });
    }
    reattachRuntimeState() {
        if (!this.attached)
            return;
        for (const mask of this.getAll())
            reattachMaskHoverHandlers(mask);
        this.synchronizeSelection();
    }
    synchronizeCounterFromCanvas() {
        const canvas = this.host.getCanvas();
        if (!canvas)
            return;
        for (const object of canvas.getObjects()) {
            if (isMaskObject(object))
                this.counter = Math.max(this.counter, object.maskId);
        }
    }
    removeMaskObject(mask) {
        var _a, _b;
        removeLabelForMask(this.labelContext(), mask);
        detachMaskHoverHandlers(mask);
        const canvas = this.host.requireCanvas('remove a mask');
        const canvasWithSelection = canvas;
        const activeObjects = typeof canvasWithSelection.getActiveObjects === 'function'
            ? canvasWithSelection.getActiveObjects()
            : [(_a = canvasWithSelection.getActiveObject) === null || _a === void 0 ? void 0 : _a.call(canvasWithSelection)].filter((object) => !!object);
        if (activeObjects.includes(mask))
            canvas.discardActiveObject();
        canvas.remove(mask);
        if (this.lastMask === mask) {
            const masks = this.getAll();
            this.lastMask = (_b = masks[masks.length - 1]) !== null && _b !== void 0 ? _b : null;
        }
        this.host.requestRender();
    }
    commitHistory(operationId, before) {
        const record = this.state.captureHistoryRecord(operationId, before);
        const result = this.state.commitHistory(record);
        if (result instanceof Promise) {
            void result.catch((error) => this.host.reportError(error, `History commit for "${operationId}" failed.`));
        }
    }
    notifyChange() {
        var _a, _b;
        try {
            (_b = (_a = this.options).onChange) === null || _b === void 0 ? void 0 : _b.call(_a, this.getAll());
        }
        catch (error) {
            this.host.reportWarning(error, 'Mask onChange callback failed.');
        }
    }
    assertActive(operation) {
        if (this.disposed)
            throw new errors.CoreRuntimeError(`[ImageEditor] Cannot ${operation} after disposal.`);
    }
}

const maskPluginRef = internalCapabilities.definePluginRef('@bensitu/mask', '1.0.0');
function maskPlugin(options = {}) {
    const resolved = resolveMaskPluginOptions(options);
    let controller = null;
    return Object.freeze({
        ref: maskPluginRef,
        version: '1.0.0',
        setupMode: 'sync',
        requires: [
            { token: internalCapabilities.CORE_HOST_CAPABILITY, range: '^1.0.0' },
            { token: internalCapabilities.CORE_STATE_CAPABILITY, range: '^1.0.0' },
            { token: foundations_overlay_index.OVERLAY_CAPABILITY, range: '^1.0.0' },
        ],
        setup(context) {
            const host = context.capabilities.require(internalCapabilities.CORE_HOST_CAPABILITY);
            const state = context.capabilities.require(internalCapabilities.CORE_STATE_CAPABILITY);
            const overlay = context.capabilities.require(foundations_overlay_index.OVERLAY_CAPABILITY);
            for (const operationId of ['mask:create', 'mask:remove', 'mask:remove-all']) {
                context.operations.register({ id: operationId, mode: 'busy' });
            }
            controller = new MaskPluginController(host, state, overlay, {
                run: (operationId, body) => {
                    const token = context.operations.begin(operationId);
                    try {
                        return body();
                    }
                    finally {
                        const cleanup = token.dispose();
                        if (cleanup instanceof Promise) {
                            void cleanup.catch((error) => host.reportError(error, 'Mask operation cleanup failed.'));
                        }
                    }
                },
            }, resolved);
            return controller;
        },
        onInit() {
            controller === null || controller === void 0 ? void 0 : controller.attach();
        },
        onImageCleared() {
            controller === null || controller === void 0 ? void 0 : controller.resetForImage();
        },
        onDispose() {
            controller === null || controller === void 0 ? void 0 : controller.dispose();
            controller = null;
        },
    });
}

exports.applyCropHideMaskStyle = applyCropHideMaskStyle;
exports.applyMaskSelectedStyle = applyMaskSelectedStyle;
exports.applyMaskUnselectedStyle = applyMaskUnselectedStyle;
exports.attachMaskHoverHandlers = attachMaskHoverHandlers;
exports.canCopySafeObjectKey = canCopySafeObjectKey;
exports.captureMaskStyleBackup = captureMaskStyleBackup;
exports.copySafeOwnProperties = copySafeOwnProperties;
exports.detachMaskHoverHandlers = detachMaskHoverHandlers;
exports.getEditableOverlayRange = getEditableOverlayRange;
exports.hideAllMaskLabels = hideAllMaskLabels;
exports.isAnnotationObject = isAnnotationObject;
exports.isBaseImageObject = isBaseImageObject;
exports.isDrawAnnotationObject = isDrawAnnotationObject;
exports.isEditableOverlayObject = isEditableOverlayObject;
exports.isMaskObject = isMaskObject$1;
exports.isSessionObject = isSessionObject;
exports.isShapeAnnotationObject = isShapeAnnotationObject;
exports.isTextAnnotationObject = isTextAnnotationObject;
exports.markAnnotationObject = markAnnotationObject;
exports.markBaseImageObject = markBaseImageObject;
exports.markMaskObject = markMaskObject;
exports.markSessionObject = markSessionObject;
exports.maskPlugin = maskPlugin;
exports.maskPluginRef = maskPluginRef;
exports.normalizeLayerOrder = normalizeLayerOrder;
exports.placeAnnotationObject = placeAnnotationObject;
exports.placeMaskObject = placeMaskObject;
exports.placeSessionObject = placeSessionObject;
exports.reattachMaskHoverHandlers = reattachMaskHoverHandlers;
exports.removeAllMasks = removeAllMasks;
exports.removeLabelForMask = removeLabelForMask;
exports.reportError = reportError;
exports.reportWarning = reportWarning;
exports.resolveNumeric = resolveNumeric;
exports.restoreMaskStyleBackup = restoreMaskStyleBackup;
exports.showLabelForMask = showLabelForMask;
exports.syncMaskLabel = syncMaskLabel;
exports.withMaskStyleBackup = withMaskStyleBackup;
//# sourceMappingURL=index-C01oMxk8.cjs.map
