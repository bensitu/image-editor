'use strict';

var foundations_annotation_index = require('../../foundations/annotation/index.cjs');
var foundations_overlay_index = require('../../foundations/overlay/index.cjs');
var pluginManifest = require('../../chunks/plugin-manifest-Cap1WbD8.cjs');
var pluginDefinition = require('../../chunks/plugin-definition-Zpkh5kaP.cjs');
var coreCapabilities = require('../../chunks/core-capabilities-3osq1B3M.cjs');
require('../../chunks/disposable-Sj4tt6Lk.cjs');
require('../../chunks/errors-DeAfrgDC.cjs');

const SHAPE_ANNOTATION_KIND = 'annotation:shape';
const SHAPE_PLUGIN_ID = 'annotation:shape';
const MAX_COORDINATE = 10000000;
const MAX_SHAPE_OBJECT_BYTES = 256 * 1024;
const MIN_GEOMETRY_SIZE = 0.5;
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
        throw new foundations_annotation_index.AnnotationValidationError(`${label} must be from ${minimum} to ${maximum}.`);
    }
    return value;
}
function booleanValue(value, label) {
    if (typeof value !== 'boolean')
        throw new foundations_annotation_index.AnnotationValidationError(`${label} must be boolean.`);
    return value;
}
function styleString(value, label, allowEmpty = false) {
    if (typeof value !== 'string' ||
        (!allowEmpty && value.length === 0) ||
        value.length > 128 ||
        [...value].some((character) => character.charCodeAt(0) < 32)) {
        throw new foundations_annotation_index.AnnotationValidationError(`${label} is invalid.`);
    }
    return value;
}
function dashArray(value) {
    if (value === null)
        return null;
    if (!Array.isArray(value) ||
        value.length > 16 ||
        value.some((entry) => typeof entry !== 'number' || !Number.isFinite(entry) || entry < 0 || entry > 1000)) {
        throw new foundations_annotation_index.AnnotationValidationError('Shape stroke dash array is invalid.');
    }
    return Object.freeze([...value]);
}
function shapeKind(value) {
    if (value === 'rect' || value === 'line' || value === 'arrow')
        return value;
    throw new foundations_annotation_index.AnnotationValidationError('Shape kind is invalid.');
}
function point(value, label) {
    if (!isPlainRecord(value))
        throw new foundations_annotation_index.AnnotationValidationError(`${label} is invalid.`);
    return Object.freeze({
        x: finiteRange(value.x, `${label} x`, -MAX_COORDINATE, MAX_COORDINATE),
        y: finiteRange(value.y, `${label} y`, -MAX_COORDINATE, MAX_COORDINATE),
    });
}
function normalizeShapeGeometry(value) {
    if (!isPlainRecord(value)) {
        throw new foundations_annotation_index.AnnotationValidationError('Shape geometry must be a plain object.');
    }
    const kind = shapeKind(value.kind);
    if (kind === 'rect') {
        const geometry = Object.freeze({
            kind,
            left: finiteRange(value.left, 'Shape left', -MAX_COORDINATE, MAX_COORDINATE),
            top: finiteRange(value.top, 'Shape top', -MAX_COORDINATE, MAX_COORDINATE),
            width: finiteRange(value.width, 'Shape width', MIN_GEOMETRY_SIZE, MAX_COORDINATE),
            height: finiteRange(value.height, 'Shape height', MIN_GEOMETRY_SIZE, MAX_COORDINATE),
        });
        return geometry;
    }
    const start = point(value.start, 'Shape start point');
    const end = point(value.end, 'Shape end point');
    if (Math.hypot(end.x - start.x, end.y - start.y) < MIN_GEOMETRY_SIZE) {
        throw new foundations_annotation_index.AnnotationValidationError('Shape line and arrow endpoints must be distinct.');
    }
    const geometry = Object.freeze({ kind, start, end });
    return geometry;
}
const defaultConfiguration = Object.freeze({
    stroke: '#111111',
    strokeWidth: 3,
    fill: 'rgba(0,0,0,0)',
    opacity: 1,
    strokeDashArray: null,
    arrowHeadLength: 16,
    selectable: true,
    evented: true,
    bindToImageTransform: false,
    namePrefix: 'Shape',
});
function resolveShapeConfiguration(value = {}, base = defaultConfiguration) {
    if (!isPlainRecord(value)) {
        throw new foundations_annotation_index.AnnotationValidationError('Shape configuration must be a plain object.');
    }
    const allowed = new Set(Object.keys(defaultConfiguration));
    if (Object.keys(value).some((key) => !allowed.has(key))) {
        throw new foundations_annotation_index.AnnotationValidationError('Shape configuration contains unknown keys.');
    }
    const merged = { ...base, ...value };
    return Object.freeze({
        stroke: styleString(merged.stroke, 'Shape stroke'),
        strokeWidth: finiteRange(merged.strokeWidth, 'Shape stroke width', 0.1, 1000),
        fill: styleString(merged.fill, 'Shape fill', true),
        opacity: finiteRange(merged.opacity, 'Shape opacity', 0, 1),
        strokeDashArray: dashArray(merged.strokeDashArray),
        arrowHeadLength: finiteRange(merged.arrowHeadLength, 'Arrow head length', 1, 1000),
        selectable: booleanValue(merged.selectable, 'Shape selectable'),
        evented: booleanValue(merged.evented, 'Shape evented'),
        bindToImageTransform: booleanValue(merged.bindToImageTransform, 'Shape transform binding'),
        namePrefix: styleString(merged.namePrefix, 'Shape name prefix'),
    });
}
function normalizeFeatureUpdate(value) {
    if (!isPlainRecord(value)) {
        throw new foundations_annotation_index.AnnotationValidationError('Shape update must be a plain object.');
    }
    const allowed = new Set(['stroke', 'strokeWidth', 'fill', 'opacity', 'strokeDashArray']);
    if (Object.keys(value).some((key) => !allowed.has(key))) {
        throw new foundations_annotation_index.AnnotationValidationError('Shape update contains unknown keys.');
    }
    return Object.freeze({
        ...(value.stroke !== undefined
            ? { stroke: styleString(value.stroke, 'Shape stroke') }
            : {}),
        ...(value.strokeWidth !== undefined
            ? {
                strokeWidth: finiteRange(value.strokeWidth, 'Shape stroke width', 0.1, 1000),
            }
            : {}),
        ...(value.fill !== undefined ? { fill: styleString(value.fill, 'Shape fill', true) } : {}),
        ...(value.opacity !== undefined
            ? { opacity: finiteRange(value.opacity, 'Shape opacity', 0, 1) }
            : {}),
        ...(value.strokeDashArray !== undefined
            ? { strokeDashArray: dashArray(value.strokeDashArray) }
            : {}),
    });
}
function sharedUpdate(value) {
    return Object.freeze({
        ...(value.name !== undefined ? { name: value.name } : {}),
        ...(value.metadata !== undefined ? { metadata: value.metadata } : {}),
        ...(value.hidden !== undefined ? { hidden: value.hidden } : {}),
        ...(value.locked !== undefined ? { locked: value.locked } : {}),
    });
}
function buildArrowPath(geometry, headLength) {
    const angle = Math.atan2(geometry.end.y - geometry.start.y, geometry.end.x - geometry.start.x);
    const wing = Math.PI / 7;
    const first = {
        x: geometry.end.x - headLength * Math.cos(angle - wing),
        y: geometry.end.y - headLength * Math.sin(angle - wing),
    };
    const second = {
        x: geometry.end.x - headLength * Math.cos(angle + wing),
        y: geometry.end.y - headLength * Math.sin(angle + wing),
    };
    return `M ${geometry.start.x} ${geometry.start.y} L ${geometry.end.x} ${geometry.end.y} M ${geometry.end.x} ${geometry.end.y} L ${first.x} ${first.y} M ${geometry.end.x} ${geometry.end.y} L ${second.x} ${second.y}`;
}
function isStatePoint(value) {
    return (isPlainRecord(value) &&
        typeof value.x === 'number' &&
        Number.isFinite(value.x) &&
        typeof value.y === 'number' &&
        Number.isFinite(value.y));
}
function isShapeStateGeometry(value) {
    if (!isPlainRecord(value))
        return false;
    if (value.kind === 'rect')
        return foundations_overlay_index.isOverlayStateBoundsGeometry(value.bounds);
    return ((value.kind === 'line' || value.kind === 'arrow') &&
        isStatePoint(value.start) &&
        isStatePoint(value.end));
}
function isShapeStateData(value) {
    if (!isPlainRecord(value) || value.version !== 1)
        return false;
    try {
        styleString(value.stroke, 'Shape stroke');
        finiteRange(value.strokeWidth, 'Shape stroke width ratio', 1e-7, 100);
        styleString(value.fill, 'Shape fill', true);
        finiteRange(value.opacity, 'Shape opacity', 0, 1);
        dashArray(value.strokeDashArray);
        finiteRange(value.arrowHeadLength, 'Arrow head ratio', 1e-7, 100);
        return Object.keys(value).every((key) => [
            'version',
            'stroke',
            'strokeWidth',
            'fill',
            'opacity',
            'strokeDashArray',
            'arrowHeadLength',
        ].includes(key));
    }
    catch {
        return false;
    }
}
function isSerializedShape(value) {
    var _a;
    if (!isPlainRecord(value) || value.version !== 1 || !isPlainRecord(value.object))
        return false;
    try {
        const geometry = normalizeShapeGeometry(value.geometry);
        const bytes = new TextEncoder().encode(JSON.stringify(value.object)).byteLength;
        const type = String((_a = value.object.type) !== null && _a !== void 0 ? _a : '').toLowerCase();
        return (bytes <= MAX_SHAPE_OBJECT_BYTES &&
            geometry.kind === value.shapeKind &&
            ((geometry.kind === 'rect' && type === 'rect') ||
                (geometry.kind === 'line' && type === 'line') ||
                (geometry.kind === 'arrow' && type === 'path')));
    }
    catch {
        return false;
    }
}
class ShapeAnnotationController {
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
        Object.defineProperty(this, "configuration", {
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
        Object.defineProperty(this, "nameSequence", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "previewSequence", {
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
        this.configuration = resolveShapeConfiguration(options);
    }
    featureDefinition() {
        const definition = {
            kind: SHAPE_ANNOTATION_KIND,
            ownerPluginId: SHAPE_PLUGIN_ID,
            classify: (object) => {
                const shape = object;
                return ((shape.editorShapeKind === 'rect' && object instanceof this.host.fabric.Rect) ||
                    (shape.editorShapeKind === 'line' && object instanceof this.host.fabric.Line) ||
                    (shape.editorShapeKind === 'arrow' && object instanceof this.host.fabric.Path));
            },
            codec: {
                type: 'annotation:shape-object',
                version: '1.0.0',
                serialize: (object) => {
                    const shape = object;
                    return Object.freeze({
                        version: 1,
                        shapeKind: shape.editorShapeKind,
                        geometry: shape.editorShapeGeometry,
                        object: object.toObject(),
                    });
                },
                validate: isSerializedShape,
                deserialize: async (value, context) => {
                    if (!isSerializedShape(value)) {
                        throw new foundations_annotation_index.AnnotationValidationError('Serialized Shape data is malformed.');
                    }
                    const objects = await context.fabric.util.enlivenObjects([value.object]);
                    const object = objects[0];
                    if (!object) {
                        throw new foundations_annotation_index.AnnotationValidationError('Fabric did not restore a Shape.');
                    }
                    object.editorShapeKind = value.shapeKind;
                    object.editorShapeGeometry = normalizeShapeGeometry(value.geometry);
                    return object;
                },
            },
            stateCodec: {
                type: 'annotation:shape',
                version: '1.0.0',
                serialize: (object, context) => {
                    const shape = object;
                    const geometry = normalizeShapeGeometry(shape.editorShapeGeometry);
                    const stateGeometry = geometry.kind === 'rect'
                        ? Object.freeze({
                            kind: 'rect',
                            bounds: foundations_overlay_index.captureOverlayStateBounds(object, context),
                        })
                        : Object.freeze({
                            kind: geometry.kind,
                            start: Object.freeze(context.toImageNormalized(foundations_overlay_index.objectPointToCanvas(object, geometry.start))),
                            end: Object.freeze(context.toImageNormalized(foundations_overlay_index.objectPointToCanvas(object, geometry.end))),
                        });
                    const strokeDashArray = Array.isArray(object.strokeDashArray)
                        ? Object.freeze(object.strokeDashArray.map((entry) => context.toImageNormalizedScalar(entry)))
                        : null;
                    return Object.freeze({
                        geometry: stateGeometry,
                        data: Object.freeze({
                            version: 1,
                            stroke: typeof object.stroke === 'string' ? object.stroke : '#111111',
                            strokeWidth: context.toImageNormalizedScalar(Number(object.strokeWidth) || 0.1),
                            fill: typeof object.fill === 'string' ? object.fill : '',
                            opacity: Number.isFinite(object.opacity) ? object.opacity : 1,
                            strokeDashArray,
                            arrowHeadLength: context.toImageNormalizedScalar(this.configuration.arrowHeadLength),
                        }),
                    });
                },
                validate: (value) => isShapeStateGeometry(value.geometry) && isShapeStateData(value.data),
                deserialize: (value, context) => {
                    if (!isShapeStateGeometry(value.geometry) || !isShapeStateData(value.data)) {
                        throw new foundations_annotation_index.AnnotationValidationError('Serialized Shape Annotation State data is malformed.');
                    }
                    const data = value.data;
                    const common = {
                        stroke: data.stroke,
                        strokeWidth: context.toCanvasScalar(data.strokeWidth),
                        fill: data.fill,
                        opacity: data.opacity,
                        strokeDashArray: data.strokeDashArray
                            ? data.strokeDashArray.map((entry) => context.toCanvasScalar(entry))
                            : null,
                        arrowHeadLength: context.toCanvasScalar(data.arrowHeadLength),
                    };
                    if (value.geometry.kind === 'rect') {
                        const geometry = {
                            kind: 'rect',
                            left: 0,
                            top: 0,
                            width: 1,
                            height: 1,
                        };
                        const object = this.createObject(geometry, { geometry, ...common });
                        foundations_overlay_index.restoreOverlayStateBounds(object, value.geometry.bounds, context, this.host.fabric);
                        return object;
                    }
                    const geometry = {
                        kind: value.geometry.kind,
                        start: context.toCanvasPoint(value.geometry.start),
                        end: context.toCanvasPoint(value.geometry.end),
                    };
                    return this.createObject(geometry, { geometry, ...common });
                },
            },
            normalizeUpdate: normalizeFeatureUpdate,
            hasUpdate: (object, patch) => Object.entries(patch).some(([key, value]) => {
                const current = Reflect.get(object, key);
                return Array.isArray(value)
                    ? JSON.stringify(current) !== JSON.stringify(value)
                    : !Object.is(current, value);
            }),
            applyUpdate: (object, patch) => {
                object.set({
                    ...patch,
                    ...(patch.strokeDashArray
                        ? { strokeDashArray: [...patch.strokeDashArray] }
                        : {}),
                });
                object.setCoords();
            },
            bindToImageTransform: () => this.configuration.bindToImageTransform,
        };
        return Object.freeze(definition);
    }
    enter(options) {
        this.assertActive('enter Shape');
        this.assertImageLoaded();
        if (this.session)
            throw new foundations_annotation_index.AnnotationValidationError('A Shape session is already active.');
        if (!isPlainRecord(options)) {
            throw new foundations_annotation_index.AnnotationValidationError('Shape session options must be a plain object.');
        }
        shapeKind(options.kind);
        this.resolveStyle(options);
        this.session = { options: Object.freeze({ ...options }), geometry: null, previewId: null };
    }
    updatePreview(geometryInput) {
        const session = this.requireSession('update Shape preview');
        const geometry = normalizeShapeGeometry(geometryInput);
        if (geometry.kind !== session.options.kind) {
            throw new foundations_annotation_index.AnnotationValidationError('Shape preview kind does not match the session.');
        }
        const preview = this.createObject(geometry, session.options);
        const previewId = `annotation-shape:preview:${++this.previewSequence}`;
        this.authoring.replacePreview(session.previewId ? [session.previewId] : [], {
            id: previewId,
            ownerKind: SHAPE_ANNOTATION_KIND,
            object: preview,
        });
        session.geometry = geometry;
        session.previewId = previewId;
    }
    async commit() {
        const session = this.requireSession('commit Shape');
        if (!session.geometry) {
            throw new foundations_annotation_index.AnnotationValidationError('Shape commit requires preview geometry.');
        }
        const definition = {
            ...session.options,
            geometry: session.geometry,
        };
        this.closeSession();
        return this.createDefinition(definition, 'annotation-shape:commit');
    }
    cancel() {
        this.assertActive('cancel Shape');
        if (this.session)
            this.closeSession();
    }
    create(definition) {
        return this.createDefinition(definition, 'annotation-shape:create');
    }
    createDefinition(definition, operationId) {
        var _a;
        this.assertActive('create Shape');
        this.assertImageLoaded();
        if (!isPlainRecord(definition)) {
            return Promise.reject(new foundations_annotation_index.AnnotationValidationError('Shape definition must be a plain object.'));
        }
        const geometry = normalizeShapeGeometry(definition.geometry);
        const object = this.createObject(geometry, definition);
        return this.authoring.create({
            kind: SHAPE_ANNOTATION_KIND,
            object,
            name: (_a = definition.name) !== null && _a !== void 0 ? _a : `${this.configuration.namePrefix} ${++this.nameSequence}`,
            metadata: definition.metadata,
            hidden: definition.hidden,
            locked: definition.locked,
            select: definition.select,
            operationId,
        });
    }
    update(id, patch) {
        this.assertActive('update Shape');
        if (!isPlainRecord(patch)) {
            return Promise.reject(new foundations_annotation_index.AnnotationValidationError('Shape update must be an object.'));
        }
        const featurePatch = normalizeFeatureUpdate({
            ...(patch.stroke !== undefined ? { stroke: patch.stroke } : {}),
            ...(patch.strokeWidth !== undefined ? { strokeWidth: patch.strokeWidth } : {}),
            ...(patch.fill !== undefined ? { fill: patch.fill } : {}),
            ...(patch.opacity !== undefined ? { opacity: patch.opacity } : {}),
            ...(patch.strokeDashArray !== undefined
                ? { strokeDashArray: patch.strokeDashArray }
                : {}),
        });
        return this.authoring.updateFeature({
            id,
            kind: SHAPE_ANNOTATION_KIND,
            patch: featurePatch,
            shared: sharedUpdate(patch),
            operationId: 'annotation-shape:update',
        });
    }
    configure(patch) {
        this.assertActive('configure Shape');
        this.configuration = resolveShapeConfiguration(patch, this.configuration);
    }
    getConfiguration() {
        this.assertActive('read Shape configuration');
        return Object.freeze({
            ...this.configuration,
            strokeDashArray: this.configuration.strokeDashArray
                ? Object.freeze([...this.configuration.strokeDashArray])
                : null,
        });
    }
    getSession() {
        this.assertActive('read Shape session');
        return this.session
            ? Object.freeze({
                kind: this.session.options.kind,
                geometry: this.session.geometry,
            })
            : null;
    }
    closeForImage() {
        if (this.session)
            this.closeSession();
    }
    dispose() {
        if (this.disposed)
            return;
        if (this.session)
            this.closeSession();
        this.disposed = true;
    }
    createObject(geometry, style) {
        const resolved = this.resolveStyle(style);
        const common = {
            stroke: resolved.stroke,
            strokeWidth: resolved.strokeWidth,
            fill: resolved.fill,
            opacity: resolved.opacity,
            strokeDashArray: resolved.strokeDashArray ? [...resolved.strokeDashArray] : undefined,
            selectable: resolved.selectable,
            evented: resolved.evented,
            strokeLineCap: 'round',
            strokeLineJoin: 'round',
            objectCaching: false,
        };
        let object;
        if (geometry.kind === 'rect') {
            object = new this.host.fabric.Rect({
                ...common,
                left: geometry.left,
                top: geometry.top,
                width: geometry.width,
                height: geometry.height,
                originX: 'left',
                originY: 'top',
            });
        }
        else if (geometry.kind === 'line') {
            object = new this.host.fabric.Line([geometry.start.x, geometry.start.y, geometry.end.x, geometry.end.y], common);
        }
        else {
            object = new this.host.fabric.Path(buildArrowPath(geometry, resolved.arrowHeadLength), common);
        }
        object.editorShapeKind = geometry.kind;
        object.editorShapeGeometry = geometry;
        return object;
    }
    resolveStyle(value) {
        var _a, _b, _c, _d, _e, _f, _g;
        return resolveShapeConfiguration({
            stroke: (_a = value.stroke) !== null && _a !== void 0 ? _a : this.configuration.stroke,
            strokeWidth: (_b = value.strokeWidth) !== null && _b !== void 0 ? _b : this.configuration.strokeWidth,
            fill: (_c = value.fill) !== null && _c !== void 0 ? _c : this.configuration.fill,
            opacity: (_d = value.opacity) !== null && _d !== void 0 ? _d : this.configuration.opacity,
            strokeDashArray: value.strokeDashArray === undefined
                ? this.configuration.strokeDashArray
                : value.strokeDashArray,
            arrowHeadLength: (_e = value.arrowHeadLength) !== null && _e !== void 0 ? _e : this.configuration.arrowHeadLength,
            selectable: (_f = value.selectable) !== null && _f !== void 0 ? _f : this.configuration.selectable,
            evented: (_g = value.evented) !== null && _g !== void 0 ? _g : this.configuration.evented,
            bindToImageTransform: this.configuration.bindToImageTransform,
            namePrefix: this.configuration.namePrefix,
        });
    }
    closeSession() {
        const session = this.session;
        if (!session)
            return;
        this.session = null;
        if (session.previewId)
            this.authoring.removePreview([session.previewId]);
    }
    requireSession(operation) {
        this.assertActive(operation);
        if (!this.session) {
            throw new foundations_annotation_index.AnnotationValidationError(`Cannot ${operation} without a Shape session.`);
        }
        return this.session;
    }
    assertImageLoaded() {
        if (!this.host.isImageLoaded()) {
            throw new foundations_annotation_index.AnnotationValidationError('Shape Annotation requires a loaded image.');
        }
    }
    assertActive(operation) {
        if (this.disposed) {
            throw new foundations_annotation_index.AnnotationValidationError(`Cannot ${operation} after disposal.`);
        }
    }
}

const SHAPE_TOOL_ID = 'annotation:shape';
const shapeAnnotationPluginRef = pluginManifest.definePluginRef('annotation:shape', '1.0.0');
function shapeAnnotationPlugin(options = {}) {
    const initialConfiguration = resolveShapeConfiguration(options);
    let controller = null;
    return pluginDefinition.definePlugin({
        ref: shapeAnnotationPluginRef,
        manifest: {
            id: shapeAnnotationPluginRef.id,
            version: '1.0.0',
            apiVersion: shapeAnnotationPluginRef.apiVersion,
            engine: '^3.0.0',
            requiresPlugins: [foundations_annotation_index.annotationFoundationRef],
            requires: [
                { token: foundations_annotation_index.ANNOTATION_AUTHORING_CAPABILITY, range: '^1.0.0' },
                { token: coreCapabilities.CORE_DIAGNOSTICS_CAPABILITY, range: '^1.0.0' },
                { token: coreCapabilities.FABRIC_RUNTIME_CAPABILITY, range: '^1.0.0' },
                { token: coreCapabilities.BASE_IMAGE_INFO_CAPABILITY, range: '^1.0.0' },
            ],
            permissions: ['fabric:objects'],
        },
        setupMode: 'sync',
        setup(context) {
            const authoring = context.capabilities.require(foundations_annotation_index.ANNOTATION_AUTHORING_CAPABILITY);
            const diagnostics = context.capabilities.require(coreCapabilities.CORE_DIAGNOSTICS_CAPABILITY);
            const fabric = context.capabilities.require(coreCapabilities.FABRIC_RUNTIME_CAPABILITY);
            const image = context.capabilities.require(coreCapabilities.BASE_IMAGE_INFO_CAPABILITY);
            controller = new ShapeAnnotationController(Object.freeze({ ...diagnostics, ...fabric, ...image }), authoring, initialConfiguration);
            context.disposables.add(authoring.registerFeature(controller.featureDefinition()));
            for (const operationId of [
                'annotation-shape:create',
                'annotation-shape:update',
                'annotation-shape:commit',
            ]) {
                context.disposables.add(context.operations.register({
                    id: operationId,
                    mode: 'mutation',
                    conflictDomains: ['document', 'overlay', 'selection', 'state'],
                    reentrancy: 'reject',
                }));
            }
            for (const operationId of [
                'annotation-shape:enter',
                'annotation-shape:update-preview',
                'annotation-shape:cancel',
                'annotation-shape:configure',
            ]) {
                context.disposables.add(context.operations.register({
                    id: operationId,
                    mode: 'busy',
                    conflictDomains: ['overlay', 'selection', 'state'],
                    reentrancy: 'queue',
                }));
            }
            context.disposables.add(context.tools.register({
                id: SHAPE_TOOL_ID,
                enter: () => undefined,
                exit: () => controller === null || controller === void 0 ? void 0 : controller.cancel(),
                canRunOperation: (operationId) => operationId.startsWith('annotation-shape:') ||
                    operationId.startsWith('annotation:') ||
                    operationId.endsWith(':enter') ||
                    operationId === 'crop:enter' ||
                    operationId === 'mosaic:enter' ||
                    operationId === 'core:load-image' ||
                    operationId === 'core:commit-load-image' ||
                    operationId === 'core:load-state' ||
                    operationId === 'core:export',
            }));
            const requireController = () => {
                if (!controller)
                    throw new Error('Shape Annotation Plugin is not installed.');
                return controller;
            };
            const api = {
                enter: (enterOptions) => context.operations.run('annotation-shape:enter', enterOptions, async (value) => {
                    await context.tools.enter(SHAPE_TOOL_ID);
                    try {
                        requireController().enter(value);
                    }
                    catch (error) {
                        await context.tools.exit('operation');
                        throw error;
                    }
                }),
                updatePreview: (geometry) => context.operations.run('annotation-shape:update-preview', geometry, (value) => requireController().updatePreview(value)),
                commit: async () => {
                    try {
                        return await requireController().commit();
                    }
                    finally {
                        if (context.tools.getActiveToolId() === SHAPE_TOOL_ID) {
                            await context.tools.exit('operation');
                        }
                    }
                },
                cancel: () => context.operations.run('annotation-shape:cancel', undefined, async () => {
                    requireController().cancel();
                    if (context.tools.getActiveToolId() === SHAPE_TOOL_ID) {
                        await context.tools.exit('requested');
                    }
                }),
                create: async (definition) => requireController().create(definition),
                update: async (id, patch) => requireController().update(id, patch),
                configure: (patch) => context.operations.run('annotation-shape:configure', patch, (value) => requireController().configure(value)),
                getConfiguration: () => requireController().getConfiguration(),
                getSession: () => requireController().getSession(),
            };
            return Object.freeze(api);
        },
        onImageCleared(context) {
            if (context.tools.getActiveToolId() === SHAPE_TOOL_ID) {
                return context.tools.exit('operation');
            }
            controller === null || controller === void 0 ? void 0 : controller.closeForImage();
            return undefined;
        },
        onDispose() {
            controller === null || controller === void 0 ? void 0 : controller.dispose();
            controller = null;
        },
    });
}

exports.shapeAnnotationPlugin = shapeAnnotationPlugin;
exports.shapeAnnotationPluginRef = shapeAnnotationPluginRef;
//# sourceMappingURL=index.cjs.map
