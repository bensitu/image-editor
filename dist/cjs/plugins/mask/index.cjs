'use strict';

var foundations_overlay_index = require('../../foundations/overlay/index.cjs');
var safeFabricSerialization = require('../../chunks/safe-fabric-serialization-CkTUUf52.cjs');
var pluginIdentifier = require('../../chunks/plugin-identifier-DPwx4Gkd.cjs');
var imageBudget = require('../../chunks/image-budget-DZeZeVWW.cjs');
var errors = require('../../chunks/errors-DeAfrgDC.cjs');
var pluginManifest = require('../../chunks/plugin-manifest-DNqSyjh2.cjs');
var pluginDefinition = require('../../chunks/plugin-definition-C87dytjB.cjs');
var coreCapabilities = require('../../chunks/core-capabilities-CWNPa1MZ.cjs');
require('../../chunks/disposable-pTo80E0l.cjs');

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
function markSessionObject(object, sessionObjectType) {
    const sessionObject = object;
    sessionObject.editorObjectKind = 'session';
    sessionObject.sessionObjectType = sessionObjectType;
    return sessionObject;
}

function isMaskObject$1(object) {
    const candidate = object;
    return (!!candidate &&
        candidate.editorObjectKind === 'mask' &&
        typeof candidate.maskId === 'number' &&
        typeof candidate.maskUid === 'string' &&
        typeof candidate.maskName === 'string');
}
function isSessionObject(object) {
    const candidate = object;
    return (!!candidate &&
        candidate.editorObjectKind === 'session' &&
        typeof candidate.sessionObjectType === 'string');
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
    if (!canvas.getObjects().includes(object)) {
        canvas.add(object);
    }
}
function withoutObject(canvas, object) {
    return canvas.getObjects().filter((candidate) => candidate !== object);
}
function findFirstSessionIndex(objects) {
    return objects.findIndex((object) => isSessionObject(object) || isPropertyMarkedSessionObject(object));
}
function placeMaskObject(canvas, mask) {
    ensureOnCanvas(canvas, mask);
    const objects = withoutObject(canvas, mask);
    const firstSessionIndex = findFirstSessionIndex(objects);
    moveObjectTo(canvas, mask, firstSessionIndex === -1 ? objects.length : firstSessionIndex);
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

function canCopySafeObjectKey(key) {
    return !pluginIdentifier.isDangerousStateKey(key);
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

function resolveNumeric(val, axis, fallback, canvas, options) {
    if (typeof val === 'number') {
        return Number.isFinite(val) ? val : fallback;
    }
    if (typeof val === 'function') {
        const resolved = val(canvas, options);
        return Number.isFinite(resolved) ? resolved : fallback;
    }
    if (typeof val === 'string' && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?%$/iu.test(val)) {
        const pct = Number(val.slice(0, -1));
        if (!Number.isFinite(pct)) {
            return fallback;
        }
        const dim = axis === 'x' ? canvas.getWidth() : canvas.getHeight();
        return Math.floor(dim * (pct / 100));
    }
    return fallback;
}
function coercePoint(pt) {
    const coerceCoordinate = (value) => {
        if (value === null ||
            value === undefined ||
            typeof value === 'boolean' ||
            (typeof value === 'string' && value.trim().length === 0)) {
            return Number.NaN;
        }
        const coordinate = Number(value);
        return Number.isFinite(coordinate) ? coordinate : Number.NaN;
    };
    if (Array.isArray(pt)) {
        return { x: coerceCoordinate(pt[0]), y: coerceCoordinate(pt[1]) };
    }
    return { x: coerceCoordinate(pt.x), y: coerceCoordinate(pt.y) };
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
function copyMaskStyles(value) {
    const styles = copySafeOwnProperties(value);
    if (Array.isArray(styles.strokeDashArray)) {
        styles.strokeDashArray = [...styles.strokeDashArray];
    }
    return styles;
}
function mergeMaskConfig(defaultMaskConfig, config) {
    const safeDefaultConfig = copySafeOwnProperties(defaultMaskConfig);
    const defaultStyles = safeDefaultConfig.styles;
    delete safeDefaultConfig.onCreate;
    delete safeDefaultConfig.fabricGenerator;
    delete safeDefaultConfig.styles;
    const safeConfig = copySafeOwnProperties(config);
    const configStyles = copyMaskStyles(config.styles);
    const safeDefaultStyles = copyMaskStyles(isStyleObject(defaultStyles) ? defaultStyles : {});
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
        if (!context.expandCanvasIfNeeded &&
            (nextWidth > options.maxExportDimension ||
                nextHeight > options.maxExportDimension ||
                !imageBudget.isPixelAreaWithinBudget(nextWidth, nextHeight, options.maxExportPixels))) {
            warnInvalidMask(options, 'canvas expansion exceeds the configured resource budget');
            return null;
        }
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
    if (resolvedConfig.selectable !== false) {
        canvas.setActiveObject(maskObject);
    }
    canvas.renderAll();
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

const MASK_PLUGIN_ID = 'plugin:mask';
const MAX_MASK_OBJECT_BYTES = 512 * 1024;
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
    try {
        const objectDescriptor = Object.getOwnPropertyDescriptor(value, 'object');
        if (!objectDescriptor || !('value' in objectDescriptor))
            return false;
        const serializedObject = objectDescriptor.value;
        return (safeFabricSerialization.isSafeSerializedFabricObject(serializedObject, {
            rootTypes: ['rect', 'circle', 'ellipse', 'polygon'],
        }) &&
            new TextEncoder().encode(JSON.stringify(serializedObject)).byteLength <=
                MAX_MASK_OBJECT_BYTES &&
            Number.isSafeInteger(candidate.maskId) &&
            Number(candidate.maskId) > 0 &&
            typeof candidate.maskUid === 'string' &&
            candidate.maskUid.length > 0 &&
            typeof candidate.maskName === 'string' &&
            typeof candidate.originalAlpha === 'number' &&
            Number.isFinite(candidate.originalAlpha) &&
            (candidate.originalStroke === undefined ||
                candidate.originalStroke === null ||
                typeof candidate.originalStroke === 'string'));
    }
    catch {
        return false;
    }
}
function isPlainRecord(value) {
    if (typeof value !== 'object' || value === null || Array.isArray(value))
        return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}
function maskStateKind(object) {
    var _a;
    const kind = String((_a = object.type) !== null && _a !== void 0 ? _a : '').toLowerCase();
    if (kind === 'rect' || kind === 'circle' || kind === 'ellipse' || kind === 'polygon') {
        return kind;
    }
    throw new errors.CoreRuntimeError(`[ImageEditor] Mask kind "${kind}" cannot be persisted.`);
}
function normalizedPolygonPoints(object) {
    const points = object
        .points;
    if (!Array.isArray(points) || points.length < 3 || points.length > 4096)
        return null;
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    const left = Math.min(...xs);
    const top = Math.min(...ys);
    const width = Math.max(...xs) - left;
    const height = Math.max(...ys) - top;
    if (!(width > 0) || !(height > 0))
        return null;
    return Object.freeze(points.map((point) => Object.freeze({ x: (point.x - left) / width, y: (point.y - top) / height })));
}
function isMaskStateData(value) {
    if (!isPlainRecord(value) || value.version !== 1)
        return false;
    const validKind = value.kind === 'rect' ||
        value.kind === 'circle' ||
        value.kind === 'ellipse' ||
        value.kind === 'polygon';
    const validPoints = value.points === null ||
        (Array.isArray(value.points) &&
            value.points.length >= 3 &&
            value.points.length <= 4096 &&
            value.points.every((point) => isPlainRecord(point) &&
                typeof point.x === 'number' &&
                Number.isFinite(point.x) &&
                typeof point.y === 'number' &&
                Number.isFinite(point.y)));
    return (validKind &&
        Number.isSafeInteger(value.maskId) &&
        Number(value.maskId) > 0 &&
        typeof value.name === 'string' &&
        value.name.length > 0 &&
        value.name.length <= 128 &&
        typeof value.fill === 'string' &&
        value.fill.length <= 128 &&
        typeof value.opacity === 'number' &&
        Number.isFinite(value.opacity) &&
        value.opacity >= 0 &&
        value.opacity <= 1 &&
        (value.stroke === null ||
            (typeof value.stroke === 'string' && value.stroke.length <= 128)) &&
        typeof value.strokeWidth === 'number' &&
        Number.isFinite(value.strokeWidth) &&
        value.strokeWidth >= 0 &&
        (value.strokeDashArray === null ||
            (Array.isArray(value.strokeDashArray) &&
                value.strokeDashArray.length <= 32 &&
                value.strokeDashArray.every((entry) => typeof entry === 'number' && Number.isFinite(entry) && entry >= 0))) &&
        typeof value.cornerRadiusX === 'number' &&
        Number.isFinite(value.cornerRadiusX) &&
        value.cornerRadiusX >= 0 &&
        typeof value.cornerRadiusY === 'number' &&
        Number.isFinite(value.cornerRadiusY) &&
        value.cornerRadiusY >= 0 &&
        validPoints &&
        (value.kind === 'polygon' ? value.points !== null : value.points === null) &&
        typeof value.hasControls === 'boolean' &&
        typeof value.selectable === 'boolean' &&
        typeof value.evented === 'boolean');
}
class MaskPluginController {
    constructor(host, state, overlay, disposables, options) {
        Object.defineProperty(this, "host", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: host
        });
        Object.defineProperty(this, "overlay", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: overlay
        });
        Object.defineProperty(this, "disposables", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: disposables
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
        Object.defineProperty(this, "mutationSequence", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "lastInteractionNotification", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "factoryOptions", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.factoryOptions = Object.freeze({
            layoutMode: host.layoutMode,
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
        this.disposables.add(overlay.registerKind({
            id: 'mask:object',
            ownerPluginId: MASK_PLUGIN_ID,
            classify: isMaskObject,
            getPersistentId: (object) => isMaskObject(object) && object.maskUid ? object.maskUid : null,
            setPersistentId: (object, id) => {
                if (isMaskObject(object))
                    object.maskUid = id;
            },
            persistence: {
                mode: 'persistent',
                codec: {
                    type: 'mask:object',
                    version: '1.0.0',
                    serialize: (object) => this.serializeMask(object),
                    validate: isSerializedMaskData,
                    deserialize: (data, context) => this.deserializeMask(data, context.fabric),
                },
            },
            stateCodec: {
                type: 'mask:object',
                version: '1.0.0',
                serialize: (object, context) => {
                    if (!isMaskObject(object)) {
                        throw new errors.CoreRuntimeError('[ImageEditor] Mask State Codec received a non-mask.');
                    }
                    const kind = maskStateKind(object);
                    const metadata = object
                        .overlayMetadata;
                    return Object.freeze({
                        geometry: foundations_overlay_index.captureOverlayStateBounds(object, context),
                        metadata: isPlainRecord(metadata)
                            ? Object.freeze({ ...metadata })
                            : Object.freeze({}),
                        data: Object.freeze({
                            version: 1,
                            kind,
                            maskId: object.maskId,
                            name: object.maskName,
                            fill: typeof object.fill === 'string' ? object.fill : '#000000',
                            opacity: Number.isFinite(object.opacity) ? object.opacity : 1,
                            stroke: typeof object.stroke === 'string' ? object.stroke : null,
                            strokeWidth: context.toImageNormalizedScalar(Number(object.strokeWidth) || 0),
                            strokeDashArray: Array.isArray(object.strokeDashArray)
                                ? Object.freeze(object.strokeDashArray.map((entry) => context.toImageNormalizedScalar(entry)))
                                : null,
                            cornerRadiusX: context.toImageNormalizedScalar(Number(Reflect.get(object, 'rx')) || 0),
                            cornerRadiusY: context.toImageNormalizedScalar(Number(Reflect.get(object, 'ry')) || 0),
                            points: kind === 'polygon' ? normalizedPolygonPoints(object) : null,
                            hasControls: object.hasControls === true,
                            selectable: object.selectable !== false,
                            evented: object.evented !== false,
                        }),
                    });
                },
                validate: (value) => foundations_overlay_index.isOverlayStateBoundsGeometry(value.geometry) &&
                    isMaskStateData(value.data) &&
                    isPlainRecord(value.metadata),
                deserialize: (value, context) => {
                    if (!foundations_overlay_index.isOverlayStateBoundsGeometry(value.geometry) ||
                        !isMaskStateData(value.data) ||
                        !isPlainRecord(value.metadata)) {
                        throw new errors.CoreRuntimeError('[ImageEditor] Serialized Mask State data is malformed.');
                    }
                    const data = value.data;
                    const common = {
                        left: 0,
                        top: 0,
                        originX: 'left',
                        originY: 'top',
                        fill: data.fill,
                        opacity: data.opacity,
                        stroke: data.stroke,
                        strokeWidth: context.toCanvasScalar(data.strokeWidth),
                        strokeDashArray: data.strokeDashArray
                            ? data.strokeDashArray.map((entry) => context.toCanvasScalar(entry))
                            : undefined,
                        hasControls: data.hasControls,
                        selectable: data.selectable,
                        evented: data.evented,
                        strokeUniform: true,
                    };
                    let object;
                    if (data.kind === 'circle') {
                        object = new this.host.fabric.Circle({ ...common, radius: 0.5 });
                    }
                    else if (data.kind === 'ellipse') {
                        object = new this.host.fabric.Ellipse({ ...common, rx: 0.5, ry: 0.5 });
                    }
                    else if (data.kind === 'polygon') {
                        object = new this.host.fabric.Polygon(data.points.map((point) => ({ x: point.x, y: point.y })), common);
                    }
                    else {
                        object = new this.host.fabric.Rect({
                            ...common,
                            width: 1,
                            height: 1,
                            rx: context.toCanvasScalar(data.cornerRadiusX),
                            ry: context.toCanvasScalar(data.cornerRadiusY),
                        });
                    }
                    const mask = object;
                    mask.editorObjectKind = 'mask';
                    mask.maskId = data.maskId;
                    mask.maskUid = `mask-state-${data.maskId}`;
                    mask.maskName = data.name;
                    mask.originalAlpha = data.opacity;
                    mask.originalStroke = data.stroke;
                    mask.originalStrokeWidth = context.toCanvasScalar(data.strokeWidth);
                    mask.overlayMetadata = Object.freeze({ ...value.metadata });
                    mask.lockRotation = !this.options.rotatable;
                    foundations_overlay_index.restoreOverlayStateBounds(mask, value.geometry, context, this.host.fabric);
                    reattachMaskHoverHandlers(mask);
                    return mask;
                },
            },
        }));
        this.disposables.add(overlay.registerGeometryPolicy({
            id: 'mask:geometry',
            kind: 'mask:object',
            ownerPluginId: MASK_PLUGIN_ID,
            supports: (mutation) => mutation.kind === 'crop' ||
                (options.bindToImageTransform && mutation.kind === 'transform'),
            prepare: () => this.captureSelectionBeforeGeometry(),
            synchronize: () => this.synchronizeAfterGeometry(),
        }));
        this.disposables.add(overlay.registerExportRenderer({
            id: 'mask:export',
            kind: 'mask:object',
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
        this.disposables.add(overlay.registerInteractionPolicy({
            id: 'mask:interaction',
            kind: 'mask:object',
            ownerPluginId: MASK_PLUGIN_ID,
            preview: (object) => {
                if (isMaskObject(object))
                    syncMaskLabel(this.labelContext(), object);
            },
            synchronize: (object, context) => {
                if (isMaskObject(object) && object.labelObject) {
                    syncMaskLabel(this.labelContext(), object);
                }
                if (this.lastInteractionNotification !== context.descriptor.id) {
                    this.lastInteractionNotification = context.descriptor.id;
                    this.notifyChange();
                }
            },
        }));
        this.disposables.add(state.registerTransientObject(MASK_PLUGIN_ID, (object) => {
            const candidate = object;
            return candidate.maskLabel === true;
        }));
        this.disposables.add(state.registerSlice({
            id: MASK_PLUGIN_ID,
            version: 1,
            capturePolicy: 'always',
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
        this.disposables.add(overlay.onSelectionChange(() => this.synchronizeSelection()));
        if (host.getCanvas())
            this.attach();
    }
    attach() {
        this.assertActive('attach Mask plugin');
        if (this.attached)
            return;
        this.attached = true;
        this.reattachRuntimeState();
    }
    create(config = {}) {
        return this.overlay.mutate({
            id: `mask:create:${++this.mutationSequence}`,
            operationId: 'mask:create',
            action: 'create',
            metadata: Object.freeze({ pluginId: MASK_PLUGIN_ID }),
            mutate: () => {
                this.synchronizeCounterFromCanvas();
                const mask = createMask(this.createContext(), config);
                if (!mask) {
                    throw new errors.CoreRuntimeError('[ImageEditor] Mask configuration is invalid.');
                }
                return mask;
            },
            affectedObjects: (mask) => [mask],
            synchronize: () => {
                this.synchronizeSelection();
            },
        });
    }
    getAll() {
        const masks = this.overlay
            .list({ kinds: ['mask:object'], includeHidden: true, includeLocked: true })
            .filter(isMaskObject);
        if (this.options.listOrder === 'back-to-front')
            masks.reverse();
        return Object.freeze(masks);
    }
    remove(id) {
        const object = this.overlay.getByPersistentId(id);
        if (!object || !isMaskObject(object)) {
            return Promise.reject(new errors.CoreRuntimeError(`[ImageEditor] Mask "${id}" was not found.`));
        }
        return this.overlay.mutate({
            id: `mask:remove:${++this.mutationSequence}`,
            operationId: 'mask:remove',
            action: 'delete',
            objectIds: [id],
            metadata: Object.freeze({ pluginId: MASK_PLUGIN_ID }),
            mutate: () => this.removeMaskObject(object),
        });
    }
    removeSelected() {
        const selectedId = this.overlay.getSelection().ids.find((id) => {
            const object = this.overlay.getByPersistentId(id);
            return object ? isMaskObject(object) : false;
        });
        return selectedId ? this.remove(selectedId) : Promise.resolve();
    }
    removeAll(options = {}) {
        const masks = [...this.getAll()];
        if (masks.length === 0)
            return Promise.resolve();
        return this.overlay.mutate({
            id: `mask:remove-all:${++this.mutationSequence}`,
            operationId: 'mask:remove-all',
            action: 'delete',
            objectIds: masks.map((mask) => mask.maskUid),
            metadata: Object.freeze({ pluginId: MASK_PLUGIN_ID, objectCount: masks.length }),
            mutate: () => {
                for (const mask of masks)
                    this.removeMaskObject(mask);
                this.counter = 0;
                this.lastMask = null;
            },
        });
    }
    flatten(options) {
        return this.overlay
            .flatten({ kinds: ['mask:object'], includeHidden: false, includeLocked: true }, options)
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
        this.removeLabels();
        for (const object of (_a = canvas === null || canvas === void 0 ? void 0 : canvas.getObjects()) !== null && _a !== void 0 ? _a : []) {
            if (isMaskObject(object))
                detachMaskHoverHandlers(object);
        }
        this.attached = false;
        this.disposed = true;
    }
    createContext() {
        return {
            fabric: this.host.fabric,
            canvas: this.host.requireCanvas('create a mask'),
            options: this.factoryOptions,
            getLastMask: () => this.lastMask,
            setLastMask: (mask) => {
                this.lastMask = mask;
            },
            getMaskCounter: () => this.counter,
            setMaskCounter: (counter) => {
                this.counter = counter;
            },
            expandCanvasIfNeeded: (width, height) => this.host.resizeCanvas(width, height),
        };
    }
    labelContext() {
        return {
            fabric: this.host.fabric,
            canvas: this.host.requireCanvas('synchronize mask labels'),
            options: this.factoryOptions,
        };
    }
    serializeMask(object) {
        if (!isMaskObject(object))
            throw new errors.CoreRuntimeError('[ImageEditor] Mask serializer received a non-mask.');
        const serializedMask = object;
        return Object.freeze({
            object: object.toObject(MASK_SERIALIZED_OBJECT_PROPERTIES),
            maskId: object.maskId,
            maskUid: object.maskUid,
            maskName: object.maskName,
            originalAlpha: object.originalAlpha,
            originalStroke: object.originalStroke,
            originalStrokeWidth: object.originalStrokeWidth,
            overlayPersistentId: serializedMask.overlayPersistentId,
            overlayMetadata: serializedMask.overlayMetadata,
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
        const serializedMask = mask;
        serializedMask.overlayPersistentId = data.overlayPersistentId;
        serializedMask.overlayMetadata = data.overlayMetadata;
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
            options: this.factoryOptions,
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

const maskPluginRef = pluginManifest.definePluginRef('plugin:mask', '1.0.0');
function maskPlugin(options = {}) {
    const resolved = resolveMaskPluginOptions(options);
    let controller = null;
    return pluginDefinition.definePlugin({
        ref: maskPluginRef,
        manifest: {
            id: maskPluginRef.id,
            version: '1.0.0',
            apiVersion: maskPluginRef.apiVersion,
            engine: '^3.0.0',
            requiresPlugins: [foundations_overlay_index.overlayFoundationRef],
            requires: [
                { token: coreCapabilities.CORE_DIAGNOSTICS_CAPABILITY, range: '^1.0.0' },
                { token: coreCapabilities.CORE_PRESENTATION_CAPABILITY, range: '^1.0.0' },
                { token: coreCapabilities.FABRIC_RUNTIME_CAPABILITY, range: '^1.0.0' },
                { token: coreCapabilities.CANVAS_READ_CAPABILITY, range: '^1.0.0' },
                { token: coreCapabilities.RENDER_REQUEST_CAPABILITY, range: '^1.0.0' },
                { token: coreCapabilities.CANVAS_RESIZE_CAPABILITY, range: '^1.0.0' },
                { token: coreCapabilities.SNAPSHOT_REGISTRATION_CAPABILITY, range: '^1.0.0' },
                { token: foundations_overlay_index.OVERLAY_CAPABILITY, range: '^1.0.0' },
                { token: foundations_overlay_index.OVERLAY_REGISTRATION_CAPABILITY, range: '^1.0.0' },
            ],
            permissions: ['fabric:objects', 'fabric:canvas-read', 'fabric:custom-class'],
        },
        setupMode: 'sync',
        setup(context) {
            const diagnostics = context.capabilities.require(coreCapabilities.CORE_DIAGNOSTICS_CAPABILITY);
            const presentation = context.capabilities.require(coreCapabilities.CORE_PRESENTATION_CAPABILITY);
            const fabricRuntime = context.capabilities.require(coreCapabilities.FABRIC_RUNTIME_CAPABILITY);
            const canvas = context.capabilities.require(coreCapabilities.CANVAS_READ_CAPABILITY);
            const render = context.capabilities.require(coreCapabilities.RENDER_REQUEST_CAPABILITY);
            const resize = context.capabilities.require(coreCapabilities.CANVAS_RESIZE_CAPABILITY);
            const state = context.capabilities.require(coreCapabilities.SNAPSHOT_REGISTRATION_CAPABILITY);
            const overlay = context.capabilities.require(foundations_overlay_index.OVERLAY_CAPABILITY);
            const overlayRegistration = context.capabilities.require(foundations_overlay_index.OVERLAY_REGISTRATION_CAPABILITY);
            const host = Object.freeze({
                ...diagnostics,
                backgroundColor: presentation.backgroundColor,
                get layoutMode() {
                    return presentation.layoutMode;
                },
                ...fabricRuntime,
                ...canvas,
                ...render,
                ...resize,
            });
            for (const operationId of ['mask:create', 'mask:remove', 'mask:remove-all']) {
                context.operations.register({
                    id: operationId,
                    mode: 'mutation',
                    conflictDomains: ['document', 'overlay', 'selection', 'state'],
                    reentrancy: 'reject',
                });
            }
            controller = new MaskPluginController(host, state, Object.freeze({ ...overlay, ...overlayRegistration }), context.disposables, resolved);
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

exports.maskPlugin = maskPlugin;
exports.maskPluginRef = maskPluginRef;
//# sourceMappingURL=index.cjs.map
