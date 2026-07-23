import { isSafeSerializedFabricObject } from '../../fabric/safe-fabric-serialization.js';
import { AnnotationValidationError } from '../../foundations/annotation/index.js';
import { objectPointToCanvas } from '../../foundations/overlay/index.js';
import { appendInterpolatedPoints, buildCurvedDrawPath, drawPathIntersects, normalizeDrawPoint, } from './draw-path.js';
export const DRAW_ANNOTATION_KIND = 'annotation:draw';
const DRAW_PLUGIN_ID = 'annotation:draw';
const MAX_DRAW_OBJECT_BYTES = 512 * 1024;
function isPlainRecord(value) {
    if (typeof value !== 'object' || value === null || Array.isArray(value))
        return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}
function finiteRange(value, label, minimum, maximum) {
    if (typeof value !== 'number' ||
        !Number.isFinite(value) ||
        value < minimum ||
        value > maximum) {
        throw new AnnotationValidationError(`${label} must be from ${minimum} to ${maximum}.`);
    }
    return value;
}
function integerRange(value, label, minimum, maximum) {
    if (!Number.isSafeInteger(value) || Number(value) < minimum || Number(value) > maximum) {
        throw new AnnotationValidationError(`${label} must be an integer from ${minimum} to ${maximum}.`);
    }
    return Number(value);
}
function booleanValue(value, label) {
    if (typeof value !== 'boolean')
        throw new AnnotationValidationError(`${label} must be boolean.`);
    return value;
}
function styleString(value, label, allowEmpty = false) {
    if (typeof value !== 'string' ||
        (!allowEmpty && value.length === 0) ||
        value.length > 128 ||
        [...value].some((character) => character.charCodeAt(0) < 32)) {
        throw new AnnotationValidationError(`${label} is invalid.`);
    }
    return value;
}
function lineCap(value) {
    if (value === 'butt' || value === 'round' || value === 'square')
        return value;
    throw new AnnotationValidationError('Draw line cap is invalid.');
}
function lineJoin(value) {
    if (value === 'bevel' || value === 'round' || value === 'miter')
        return value;
    throw new AnnotationValidationError('Draw line join is invalid.');
}
function subMode(value) {
    if (value === 'brush' || value === 'erase')
        return value;
    throw new AnnotationValidationError('Draw sub-mode is invalid.');
}
const defaultBrush = Object.freeze({
    color: '#111111',
    width: 8,
    opacity: 1,
    lineCap: 'round',
    lineJoin: 'round',
    selectable: true,
    evented: true,
    bindToImageTransform: false,
    interpolationSpacing: 2,
    maxPointCount: 8192,
    namePrefix: 'Draw',
});
const defaultEraser = Object.freeze({
    radius: 12,
    previewStroke: '#ffffff',
    previewStrokeWidth: 1,
    previewFill: 'rgba(0,0,0,0.15)',
    interpolationSpacing: 4,
    maxPointCount: 8192,
});
export function resolveBrushConfiguration(value = {}, base = defaultBrush) {
    if (!isPlainRecord(value)) {
        throw new AnnotationValidationError('Draw brush configuration must be a plain object.');
    }
    const allowed = new Set(Object.keys(defaultBrush));
    if (Object.keys(value).some((key) => !allowed.has(key))) {
        throw new AnnotationValidationError('Draw brush configuration contains unknown keys.');
    }
    const merged = { ...base, ...value };
    return Object.freeze({
        color: styleString(merged.color, 'Draw color'),
        width: finiteRange(merged.width, 'Draw width', 0.1, 1000),
        opacity: finiteRange(merged.opacity, 'Draw opacity', 0, 1),
        lineCap: lineCap(merged.lineCap),
        lineJoin: lineJoin(merged.lineJoin),
        selectable: booleanValue(merged.selectable, 'Draw selectable'),
        evented: booleanValue(merged.evented, 'Draw evented'),
        bindToImageTransform: booleanValue(merged.bindToImageTransform, 'Draw transform binding'),
        interpolationSpacing: finiteRange(merged.interpolationSpacing, 'Draw interpolation spacing', 0.25, 1000),
        maxPointCount: integerRange(merged.maxPointCount, 'Draw point count limit', 2, 65536),
        namePrefix: styleString(merged.namePrefix, 'Draw name prefix'),
    });
}
export function resolveEraserConfiguration(value = {}, base = defaultEraser) {
    if (!isPlainRecord(value)) {
        throw new AnnotationValidationError('Eraser configuration must be a plain object.');
    }
    const allowed = new Set(Object.keys(defaultEraser));
    if (Object.keys(value).some((key) => !allowed.has(key))) {
        throw new AnnotationValidationError('Eraser configuration contains unknown keys.');
    }
    const merged = { ...base, ...value };
    return Object.freeze({
        radius: finiteRange(merged.radius, 'Eraser radius', 0.5, 2000),
        previewStroke: styleString(merged.previewStroke, 'Eraser preview stroke'),
        previewStrokeWidth: finiteRange(merged.previewStrokeWidth, 'Eraser preview stroke width', 0, 100),
        previewFill: styleString(merged.previewFill, 'Eraser preview fill', true),
        interpolationSpacing: finiteRange(merged.interpolationSpacing, 'Eraser interpolation spacing', 0.25, 2000),
        maxPointCount: integerRange(merged.maxPointCount, 'Eraser point count limit', 2, 65536),
    });
}
function normalizePoints(value, maximumCount) {
    if (!Array.isArray(value) || value.length < 2 || value.length > maximumCount) {
        throw new AnnotationValidationError('Draw path point data is invalid.');
    }
    try {
        return Object.freeze(value.map(normalizeDrawPoint));
    }
    catch {
        throw new AnnotationValidationError('Draw path contains an invalid point.');
    }
}
function isSerializedDraw(value) {
    if (!isPlainRecord(value))
        return false;
    try {
        const objectDescriptor = Object.getOwnPropertyDescriptor(value, 'object');
        if (!objectDescriptor || !('value' in objectDescriptor))
            return false;
        const serializedObject = objectDescriptor.value;
        if (value.version !== 1 ||
            !isPlainRecord(serializedObject) ||
            !isSafeSerializedFabricObject(serializedObject, { rootTypes: ['path'] })) {
            return false;
        }
        const points = normalizePoints(value.points, 65536);
        const bytes = new TextEncoder().encode(JSON.stringify(serializedObject)).byteLength;
        return (points.length >= 2 &&
            bytes <= MAX_DRAW_OBJECT_BYTES &&
            typeof serializedObject.type === 'string' &&
            serializedObject.type.toLowerCase() === 'path');
    }
    catch {
        return false;
    }
}
function isStatePoint(value) {
    return (isPlainRecord(value) &&
        typeof value.x === 'number' &&
        Number.isFinite(value.x) &&
        typeof value.y === 'number' &&
        Number.isFinite(value.y));
}
function isDrawStateGeometry(value) {
    return (isPlainRecord(value) &&
        value.type === 'path' &&
        Array.isArray(value.points) &&
        value.points.length >= 2 &&
        value.points.length <= 65536 &&
        value.points.every(isStatePoint));
}
function isDrawStateData(value) {
    if (!isPlainRecord(value) || value.version !== 1)
        return false;
    try {
        styleString(value.color, 'Draw color');
        finiteRange(value.width, 'Draw width ratio', 1e-7, 100);
        finiteRange(value.opacity, 'Draw opacity', 0, 1);
        lineCap(value.lineCap);
        lineJoin(value.lineJoin);
        return Object.keys(value).every((key) => ['version', 'color', 'width', 'opacity', 'lineCap', 'lineJoin'].includes(key));
    }
    catch {
        return false;
    }
}
export class DrawAnnotationController {
    constructor(host, authoring, options) {
        Object.defineProperty(this, "host", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: host
        });
        Object.defineProperty(this, "authoring", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: authoring
        });
        Object.defineProperty(this, "brush", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "eraser", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "session", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "previewSequence", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "nameSequence", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "disposed", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        if (!isPlainRecord(options)) {
            throw new AnnotationValidationError('Draw options must be a plain object.');
        }
        if (Object.keys(options).some((key) => key !== 'brush' && key !== 'eraser')) {
            throw new AnnotationValidationError('Draw options contain unknown keys.');
        }
        this.brush = resolveBrushConfiguration(options.brush);
        this.eraser = resolveEraserConfiguration(options.eraser);
    }
    featureDefinition() {
        const definition = {
            kind: DRAW_ANNOTATION_KIND,
            ownerPluginId: DRAW_PLUGIN_ID,
            classify: (object) => object instanceof this.host.fabric.Path &&
                Array.isArray(object.editorDrawPoints),
            codec: {
                type: 'annotation:draw-path',
                version: '1.0.0',
                serialize: (object) => {
                    const draw = object;
                    return Object.freeze({
                        version: 1,
                        points: draw.editorDrawPoints,
                        object: object.toObject(),
                    });
                },
                validate: isSerializedDraw,
                deserialize: async (value, context) => {
                    if (!isSerializedDraw(value)) {
                        throw new AnnotationValidationError('Serialized Draw data is malformed.');
                    }
                    const objects = await context.fabric.util.enlivenObjects([value.object]);
                    const object = objects[0];
                    if (!(object instanceof context.fabric.Path)) {
                        throw new AnnotationValidationError('Fabric did not restore a Draw path.');
                    }
                    object.editorDrawPoints = normalizePoints(value.points, this.brush.maxPointCount);
                    return object;
                },
            },
            stateCodec: {
                type: 'annotation:draw',
                version: '1.0.0',
                serialize: (object, context) => {
                    var _a, _b;
                    const draw = object;
                    const points = normalizePoints(draw.editorDrawPoints, 65536).map((point) => Object.freeze(context.toImageNormalized(objectPointToCanvas(object, point))));
                    return Object.freeze({
                        geometry: Object.freeze({
                            type: 'path',
                            points: Object.freeze(points),
                        }),
                        data: Object.freeze({
                            version: 1,
                            color: typeof object.stroke === 'string' ? object.stroke : '#111111',
                            width: context.toImageNormalizedScalar(Number(object.strokeWidth) || 0.1),
                            opacity: Number.isFinite(object.opacity) ? object.opacity : 1,
                            lineCap: (_a = object.strokeLineCap) !== null && _a !== void 0 ? _a : 'round',
                            lineJoin: (_b = object.strokeLineJoin) !== null && _b !== void 0 ? _b : 'round',
                        }),
                    });
                },
                validate: (value) => isDrawStateGeometry(value.geometry) && isDrawStateData(value.data),
                deserialize: (value, context) => {
                    if (!isDrawStateGeometry(value.geometry) || !isDrawStateData(value.data)) {
                        throw new AnnotationValidationError('Serialized Draw Annotation State data is malformed.');
                    }
                    const points = Object.freeze(value.geometry.points.map((point) => Object.freeze(context.toCanvasPoint(point))));
                    const object = new this.host.fabric.Path(buildCurvedDrawPath(points), {
                        fill: '',
                        stroke: value.data.color,
                        strokeWidth: context.toCanvasScalar(value.data.width),
                        opacity: value.data.opacity,
                        strokeLineCap: value.data.lineCap,
                        strokeLineJoin: value.data.lineJoin,
                        objectCaching: false,
                    });
                    object.editorDrawPoints = points;
                    return object;
                },
            },
            bindToImageTransform: () => this.brush.bindToImageTransform,
        };
        return Object.freeze(definition);
    }
    enter(options = {}) {
        var _a;
        this.assertActive('enter Draw');
        this.assertImageLoaded();
        if (this.session)
            throw new AnnotationValidationError('A Draw session is already active.');
        if (!isPlainRecord(options)) {
            throw new AnnotationValidationError('Draw enter options must be a plain object.');
        }
        if (Object.keys(options).some((key) => key !== 'subMode')) {
            throw new AnnotationValidationError('Draw enter options contain unknown keys.');
        }
        this.session = {
            subMode: subMode((_a = options.subMode) !== null && _a !== void 0 ? _a : 'brush'),
            points: [],
            previewId: null,
        };
    }
    setSubMode(mode) {
        const session = this.requireSession('set Draw sub-mode');
        const normalized = subMode(mode);
        if (session.subMode === normalized)
            return;
        this.clearStroke(session);
        session.subMode = normalized;
    }
    beginStroke(value) {
        const session = this.requireSession('begin Draw stroke');
        if (session.points.length > 0) {
            throw new AnnotationValidationError('A Draw stroke is already active.');
        }
        let point;
        try {
            point = normalizeDrawPoint(value);
        }
        catch {
            throw new AnnotationValidationError('Draw point coordinates must be finite and bounded.');
        }
        session.points = [point];
        this.refreshPreview(session);
    }
    appendStroke(value) {
        const session = this.requireActiveStroke('append Draw stroke');
        let point;
        try {
            point = normalizeDrawPoint(value);
        }
        catch {
            throw new AnnotationValidationError('Draw point coordinates must be finite and bounded.');
        }
        const configuration = session.subMode === 'brush' ? this.brush : this.eraser;
        try {
            appendInterpolatedPoints(session.points, point, configuration.interpolationSpacing, configuration.maxPointCount);
        }
        catch (error) {
            throw new AnnotationValidationError(error instanceof Error ? error.message : 'Draw point limit was exceeded.');
        }
        this.refreshPreview(session);
    }
    async endStroke() {
        const session = this.requireActiveStroke('end Draw stroke');
        const points = Object.freeze([...session.points]);
        const mode = session.subMode;
        this.clearStroke(session);
        if (!this.isMeaningfulStroke(points))
            return null;
        if (mode === 'erase') {
            const ids = this.intersectedDrawIds(points);
            if (ids.length === 0)
                return null;
            await this.authoring.removeFeatures({
                ids,
                kind: DRAW_ANNOTATION_KIND,
                operationId: 'annotation-draw:commit-erase',
            });
            return null;
        }
        const object = this.createPath(points);
        return this.authoring.create({
            kind: DRAW_ANNOTATION_KIND,
            object,
            name: `${this.brush.namePrefix} ${++this.nameSequence}`,
            operationId: 'annotation-draw:commit-stroke',
        });
    }
    cancelStroke() {
        const session = this.requireSession('cancel Draw stroke');
        this.clearStroke(session);
    }
    exit() {
        this.assertActive('exit Draw');
        if (!this.session)
            return;
        this.clearStroke(this.session);
        this.session = null;
    }
    configureBrush(patch) {
        var _a;
        this.assertActive('configure Draw brush');
        if ((_a = this.session) === null || _a === void 0 ? void 0 : _a.points.length) {
            throw new AnnotationValidationError('Cancel the active Draw stroke before configuring it.');
        }
        this.brush = resolveBrushConfiguration(patch, this.brush);
    }
    configureEraser(patch) {
        var _a;
        this.assertActive('configure Eraser');
        if ((_a = this.session) === null || _a === void 0 ? void 0 : _a.points.length) {
            throw new AnnotationValidationError('Cancel the active Eraser stroke before configuring it.');
        }
        this.eraser = resolveEraserConfiguration(patch, this.eraser);
    }
    getConfiguration() {
        this.assertActive('read Draw configuration');
        return Object.freeze({ brush: this.brush, eraser: this.eraser });
    }
    getSession() {
        this.assertActive('read Draw session');
        return this.session
            ? Object.freeze({
                subMode: this.session.subMode,
                isStrokeActive: this.session.points.length > 0,
                pointCount: this.session.points.length,
            })
            : null;
    }
    closeForImage() {
        if (this.session)
            this.exit();
    }
    dispose() {
        if (this.disposed)
            return;
        if (this.session)
            this.exit();
        this.disposed = true;
    }
    createPath(points) {
        const object = new this.host.fabric.Path(buildCurvedDrawPath(points), {
            fill: '',
            stroke: this.brush.color,
            strokeWidth: this.brush.width,
            opacity: this.brush.opacity,
            strokeLineCap: this.brush.lineCap,
            strokeLineJoin: this.brush.lineJoin,
            selectable: this.brush.selectable,
            evented: this.brush.evented,
            objectCaching: false,
        });
        object.editorDrawPoints = Object.freeze([...points]);
        return object;
    }
    refreshPreview(session) {
        let preview;
        if (session.subMode === 'brush') {
            preview = this.createPath(session.points);
        }
        else {
            const point = session.points[session.points.length - 1];
            preview = new this.host.fabric.Circle({
                left: point.x,
                top: point.y,
                radius: this.eraser.radius,
                originX: 'center',
                originY: 'center',
                fill: this.eraser.previewFill,
                stroke: this.eraser.previewStroke,
                strokeWidth: this.eraser.previewStrokeWidth,
                objectCaching: false,
            });
        }
        const previewId = `annotation-draw:preview:${++this.previewSequence}`;
        this.authoring.replacePreview(session.previewId ? [session.previewId] : [], {
            id: previewId,
            ownerKind: DRAW_ANNOTATION_KIND,
            object: preview,
        });
        session.previewId = previewId;
    }
    intersectedDrawIds(points) {
        const ids = [];
        for (const object of this.authoring.listObjects(DRAW_ANNOTATION_KIND)) {
            const draw = object;
            if (draw.editorOverlayHidden || draw.editorOverlayLocked)
                continue;
            if (drawPathIntersects(draw, points, this.eraser.radius)) {
                const id = Reflect.get(draw, 'editorOverlayId');
                if (typeof id === 'string')
                    ids.push(id);
            }
        }
        return Object.freeze(ids);
    }
    isMeaningfulStroke(points) {
        if (points.length < 2)
            return false;
        const first = points[0];
        return points.some((point) => Math.hypot(point.x - first.x, point.y - first.y) >= 0.5);
    }
    clearStroke(session) {
        if (session.previewId)
            this.authoring.removePreview([session.previewId]);
        session.previewId = null;
        session.points = [];
    }
    requireSession(operation) {
        this.assertActive(operation);
        if (!this.session) {
            throw new AnnotationValidationError(`Cannot ${operation} without a Draw session.`);
        }
        return this.session;
    }
    requireActiveStroke(operation) {
        const session = this.requireSession(operation);
        if (session.points.length === 0) {
            throw new AnnotationValidationError(`Cannot ${operation} without an active stroke.`);
        }
        return session;
    }
    assertImageLoaded() {
        if (!this.host.isImageLoaded()) {
            throw new AnnotationValidationError('Draw Annotation requires a loaded image.');
        }
    }
    assertActive(operation) {
        if (this.disposed) {
            throw new AnnotationValidationError(`Cannot ${operation} after disposal.`);
        }
    }
}
//# sourceMappingURL=draw-controller.js.map