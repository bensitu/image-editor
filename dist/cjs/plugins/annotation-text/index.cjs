'use strict';

var foundations_annotation_index = require('../../foundations/annotation/index.cjs');
var safeFabricSerialization = require('../../chunks/safe-fabric-serialization-CHiQxoA8.cjs');
var disposable = require('../../chunks/disposable-pTo80E0l.cjs');
var foundations_overlay_index = require('../../foundations/overlay/index.cjs');
var pluginManifest = require('../../chunks/plugin-manifest-B4W6-2BB.cjs');
var pluginDefinition = require('../../chunks/plugin-definition-CT9AOCE7.cjs');
var coreCapabilities = require('../../chunks/core-capabilities-DVJQ8w-Z.cjs');
require('../../chunks/plugin-identifier-CjVVyVRY.cjs');
require('../../chunks/image-budget-DZeZeVWW.cjs');
require('../../chunks/errors-DeAfrgDC.cjs');

const TEXT_ANNOTATION_KIND = 'annotation:text';
const TEXT_PLUGIN_ID = 'annotation:text';
const MAX_TEXT_LENGTH = 20000;
const MAX_FONT_FIELD_LENGTH = 256;
const MAX_TEXT_OBJECT_BYTES = 256 * 1024;
const MAX_TEXT_WIDTH = 100000;
const MAX_COORDINATE = 10000000;
function isPlainRecord(value) {
    if (typeof value !== 'object' || value === null || Array.isArray(value))
        return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}
function validateText(value, label = 'Text') {
    if (typeof value !== 'string' || value.length > MAX_TEXT_LENGTH) {
        throw new foundations_annotation_index.AnnotationValidationError(`${label} must be a string of at most ${MAX_TEXT_LENGTH} characters.`);
    }
    return value;
}
function validateFontField(value, label) {
    if (typeof value !== 'string' ||
        value.length === 0 ||
        value.trim() !== value ||
        value.length > MAX_FONT_FIELD_LENGTH ||
        [...value].some((character) => character.charCodeAt(0) < 32)) {
        throw new foundations_annotation_index.AnnotationValidationError(`${label} is invalid.`);
    }
    return value;
}
function validateFontWeight(value) {
    if ((typeof value === 'string' &&
        value.length > 0 &&
        value.length <= 32 &&
        value.trim() === value) ||
        (typeof value === 'number' && Number.isFinite(value) && value >= 1 && value <= 1000)) {
        return value;
    }
    throw new foundations_annotation_index.AnnotationValidationError('Text font weight is invalid.');
}
function validateFiniteRange(value, label, minimum, maximum) {
    if (typeof value !== 'number' ||
        !Number.isFinite(value) ||
        value < minimum ||
        value > maximum) {
        throw new foundations_annotation_index.AnnotationValidationError(`${label} must be from ${minimum} to ${maximum}.`);
    }
    return value;
}
function validateBoolean(value, label) {
    if (typeof value !== 'boolean')
        throw new foundations_annotation_index.AnnotationValidationError(`${label} must be boolean.`);
    return value;
}
function validateAlignment(value) {
    if (value === 'left' || value === 'center' || value === 'right' || value === 'justify') {
        return value;
    }
    throw new foundations_annotation_index.AnnotationValidationError('Text alignment is invalid.');
}
function validateFallbacks(value) {
    if (!Array.isArray(value) || value.length > 8) {
        throw new foundations_annotation_index.AnnotationValidationError('Text font fallbacks are invalid.');
    }
    return Object.freeze([
        ...new Set(value.map((entry) => validateFontField(entry, 'Text font fallback'))),
    ]);
}
const defaultConfiguration = Object.freeze({
    defaultText: 'Text',
    fontSize: 24,
    fontFamily: 'Arial',
    fontFallbacks: Object.freeze(['sans-serif']),
    fontWeight: 'normal',
    fill: '#111111',
    backgroundColor: '',
    textAlign: 'left',
    width: 220,
    opacity: 1,
    selectable: true,
    evented: true,
    editable: true,
    bindToImageTransform: false,
    reflectionBehavior: 'preserve-readable',
    namePrefix: 'Text',
});
function resolveTextConfiguration(value = {}, base = defaultConfiguration) {
    if (!isPlainRecord(value)) {
        throw new foundations_annotation_index.AnnotationValidationError('Text configuration must be a plain object.');
    }
    const allowed = new Set(Object.keys(defaultConfiguration));
    if (Object.keys(value).some((key) => !allowed.has(key))) {
        throw new foundations_annotation_index.AnnotationValidationError('Text configuration contains unknown keys.');
    }
    const merged = { ...base, ...value };
    if (merged.reflectionBehavior !== 'preserve-readable' &&
        merged.reflectionBehavior !== 'mirror') {
        throw new foundations_annotation_index.AnnotationValidationError('Text reflection behavior is invalid.');
    }
    return Object.freeze({
        defaultText: validateText(merged.defaultText, 'Default Text'),
        fontSize: validateFiniteRange(merged.fontSize, 'Text font size', 1, 512),
        fontFamily: validateFontField(merged.fontFamily, 'Text font family'),
        fontFallbacks: validateFallbacks(merged.fontFallbacks),
        fontWeight: validateFontWeight(merged.fontWeight),
        fill: validateFontField(merged.fill, 'Text fill'),
        backgroundColor: merged.backgroundColor === ''
            ? ''
            : validateFontField(merged.backgroundColor, 'Text background color'),
        textAlign: validateAlignment(merged.textAlign),
        width: validateFiniteRange(merged.width, 'Text width', 1, MAX_TEXT_WIDTH),
        opacity: validateFiniteRange(merged.opacity, 'Text opacity', 0, 1),
        selectable: validateBoolean(merged.selectable, 'Text selectable'),
        evented: validateBoolean(merged.evented, 'Text evented'),
        editable: validateBoolean(merged.editable, 'Text editable'),
        bindToImageTransform: validateBoolean(merged.bindToImageTransform, 'Text transform binding'),
        reflectionBehavior: merged.reflectionBehavior,
        namePrefix: validateFontField(merged.namePrefix, 'Text name prefix'),
    });
}
function resolvedFontFamily(primary, fallbacks) {
    return [primary, ...fallbacks].join(', ');
}
function normalizeFeatureUpdate(value) {
    if (!isPlainRecord(value)) {
        throw new foundations_annotation_index.AnnotationValidationError('Text update must be a plain object.');
    }
    const allowed = new Set([
        'text',
        'fontSize',
        'fontFamily',
        'fontWeight',
        'fill',
        'backgroundColor',
        'textAlign',
        'width',
        'opacity',
    ]);
    if (Object.keys(value).some((key) => !allowed.has(key))) {
        throw new foundations_annotation_index.AnnotationValidationError('Text update contains unknown keys.');
    }
    return Object.freeze({
        ...(value.text !== undefined ? { text: validateText(value.text) } : {}),
        ...(value.fontSize !== undefined
            ? { fontSize: validateFiniteRange(value.fontSize, 'Text font size', 1, 512) }
            : {}),
        ...(value.fontFamily !== undefined
            ? { fontFamily: validateFontField(value.fontFamily, 'Text font family') }
            : {}),
        ...(value.fontWeight !== undefined
            ? { fontWeight: validateFontWeight(value.fontWeight) }
            : {}),
        ...(value.fill !== undefined ? { fill: validateFontField(value.fill, 'Text fill') } : {}),
        ...(value.backgroundColor !== undefined
            ? {
                backgroundColor: value.backgroundColor === ''
                    ? ''
                    : validateFontField(value.backgroundColor, 'Text background color'),
            }
            : {}),
        ...(value.textAlign !== undefined ? { textAlign: validateAlignment(value.textAlign) } : {}),
        ...(value.width !== undefined
            ? { width: validateFiniteRange(value.width, 'Text width', 1, MAX_TEXT_WIDTH) }
            : {}),
        ...(value.opacity !== undefined
            ? { opacity: validateFiniteRange(value.opacity, 'Text opacity', 0, 1) }
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
function featureUpdate(value) {
    var _a;
    const fontFamily = value.fontFamily !== undefined || value.fontFallbacks !== undefined
        ? resolvedFontFamily((_a = value.fontFamily) !== null && _a !== void 0 ? _a : 'Arial', value.fontFallbacks ? validateFallbacks(value.fontFallbacks) : [])
        : undefined;
    return normalizeFeatureUpdate({
        ...(value.text !== undefined ? { text: value.text } : {}),
        ...(value.fontSize !== undefined ? { fontSize: value.fontSize } : {}),
        ...(fontFamily !== undefined ? { fontFamily } : {}),
        ...(value.fontWeight !== undefined ? { fontWeight: value.fontWeight } : {}),
        ...(value.fill !== undefined ? { fill: value.fill } : {}),
        ...(value.backgroundColor !== undefined ? { backgroundColor: value.backgroundColor } : {}),
        ...(value.textAlign !== undefined ? { textAlign: value.textAlign } : {}),
        ...(value.width !== undefined ? { width: value.width } : {}),
        ...(value.opacity !== undefined ? { opacity: value.opacity } : {}),
    });
}
function isSerializedText(value) {
    var _a;
    if (!isPlainRecord(value))
        return false;
    try {
        if (!safeFabricSerialization.isSafeSerializedFabricObject(value, { rootTypes: ['textbox'] }))
            return false;
        const bytes = new TextEncoder().encode(JSON.stringify(value)).byteLength;
        const type = String((_a = value.type) !== null && _a !== void 0 ? _a : '').toLowerCase();
        return (bytes <= MAX_TEXT_OBJECT_BYTES &&
            type === 'textbox' &&
            typeof value.text === 'string' &&
            value.text.length <= MAX_TEXT_LENGTH &&
            Number.isFinite(value.left) &&
            Number.isFinite(value.top) &&
            Number.isFinite(value.width) &&
            Number.isFinite(value.fontSize));
    }
    catch {
        return false;
    }
}
function isTextStateData(value) {
    if (!isPlainRecord(value) || value.version !== 1)
        return false;
    try {
        validateText(value.text);
        validateFiniteRange(value.fontSize, 'Text font size ratio', 1e-7, 100);
        validateFiniteRange(value.width, 'Text width ratio', 1e-7, 100);
        validateFontField(value.fontFamily, 'Text font family');
        validateFontWeight(value.fontWeight);
        validateFontField(value.fill, 'Text fill');
        if (value.backgroundColor !== '') {
            validateFontField(value.backgroundColor, 'Text background color');
        }
        validateAlignment(value.textAlign);
        validateFiniteRange(value.lineHeight, 'Text line height', 0.1, 10);
        validateFiniteRange(value.opacity, 'Text opacity', 0, 1);
        return Object.keys(value).every((key) => [
            'version',
            'text',
            'fontSize',
            'width',
            'fontFamily',
            'fontWeight',
            'fill',
            'backgroundColor',
            'textAlign',
            'lineHeight',
            'opacity',
        ].includes(key));
    }
    catch {
        return false;
    }
}
class TextAnnotationController {
    constructor(host, annotations, authoring, options) {
        Object.defineProperty(this, "host", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: host
        });
        Object.defineProperty(this, "annotations", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: annotations
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
        Object.defineProperty(this, "listeners", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Set()
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
        this.configuration = resolveTextConfiguration(options);
    }
    featureDefinition() {
        const definition = {
            kind: TEXT_ANNOTATION_KIND,
            ownerPluginId: TEXT_PLUGIN_ID,
            classify: (object) => object instanceof this.host.fabric.Textbox,
            codec: {
                type: 'annotation:textbox',
                version: '1.0.0',
                serialize: (object) => object.toObject(),
                validate: isSerializedText,
                deserialize: async (value, context) => {
                    if (!isSerializedText(value)) {
                        throw new foundations_annotation_index.AnnotationValidationError('Serialized Text Annotation data is malformed.');
                    }
                    const objects = await context.fabric.util.enlivenObjects([value]);
                    const object = objects[0];
                    if (!(object instanceof context.fabric.Textbox)) {
                        throw new foundations_annotation_index.AnnotationValidationError('Serialized Text Annotation did not restore a Textbox.');
                    }
                    return object;
                },
            },
            stateCodec: {
                type: 'annotation:text',
                version: '1.0.0',
                serialize: (object, context) => {
                    const text = object;
                    return Object.freeze({
                        geometry: foundations_overlay_index.captureOverlayStateBounds(text, context),
                        data: Object.freeze({
                            version: 1,
                            text: text.text,
                            fontSize: context.toImageNormalizedScalar(text.fontSize),
                            width: context.toImageNormalizedScalar(text.width),
                            fontFamily: text.fontFamily,
                            fontWeight: text.fontWeight,
                            fill: typeof text.fill === 'string' ? text.fill : '#111111',
                            backgroundColor: typeof text.backgroundColor === 'string'
                                ? text.backgroundColor
                                : '',
                            textAlign: validateAlignment(text.textAlign),
                            lineHeight: text.lineHeight,
                            opacity: text.opacity,
                        }),
                    });
                },
                validate: (value) => foundations_overlay_index.isOverlayStateBoundsGeometry(value.geometry) && isTextStateData(value.data),
                deserialize: (value, context) => {
                    if (!foundations_overlay_index.isOverlayStateBoundsGeometry(value.geometry) ||
                        !isTextStateData(value.data)) {
                        throw new foundations_annotation_index.AnnotationValidationError('Serialized Text Annotation State data is malformed.');
                    }
                    const data = value.data;
                    const object = new this.host.fabric.Textbox(data.text, {
                        left: 0,
                        top: 0,
                        width: context.toCanvasScalar(data.width),
                        fontSize: context.toCanvasScalar(data.fontSize),
                        fontFamily: data.fontFamily,
                        fontWeight: data.fontWeight,
                        fill: data.fill,
                        backgroundColor: data.backgroundColor,
                        textAlign: data.textAlign,
                        lineHeight: data.lineHeight,
                        opacity: data.opacity,
                        originX: 'left',
                        originY: 'top',
                    });
                    foundations_overlay_index.restoreOverlayStateBounds(object, value.geometry, context, this.host.fabric);
                    return object;
                },
            },
            normalizeUpdate: normalizeFeatureUpdate,
            hasUpdate: (object, patch) => Object.entries(patch).some(([key, value]) => !Object.is(Reflect.get(object, key), value)),
            applyUpdate: (object, patch) => {
                object.set(patch);
                object.setCoords();
            },
            bindToImageTransform: () => this.configuration.bindToImageTransform,
            preserveReadable: () => this.configuration.reflectionBehavior === 'preserve-readable',
        };
        return Object.freeze(definition);
    }
    async create(options = {}) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r;
        this.assertActive('create Text');
        this.assertImageLoaded();
        if (!isPlainRecord(options)) {
            throw new foundations_annotation_index.AnnotationValidationError('Text creation options must be a plain object.');
        }
        const creation = options;
        const text = validateText((_a = creation.text) !== null && _a !== void 0 ? _a : this.configuration.defaultText);
        const left = validateFiniteRange((_b = creation.left) !== null && _b !== void 0 ? _b : 10, 'Text left', -MAX_COORDINATE, MAX_COORDINATE);
        const top = validateFiniteRange((_c = creation.top) !== null && _c !== void 0 ? _c : 10, 'Text top', -MAX_COORDINATE, MAX_COORDINATE);
        const width = validateFiniteRange((_d = creation.width) !== null && _d !== void 0 ? _d : this.configuration.width, 'Text width', 1, MAX_TEXT_WIDTH);
        const fontSize = validateFiniteRange((_e = creation.fontSize) !== null && _e !== void 0 ? _e : this.configuration.fontSize, 'Text font size', 1, 512);
        const primaryFont = validateFontField((_f = creation.fontFamily) !== null && _f !== void 0 ? _f : this.configuration.fontFamily, 'Text font family');
        const fallbacks = creation.fontFallbacks
            ? validateFallbacks(creation.fontFallbacks)
            : this.configuration.fontFallbacks;
        const object = new this.host.fabric.Textbox(text, {
            left,
            top,
            width,
            fontSize,
            fontFamily: resolvedFontFamily(primaryFont, fallbacks),
            fontWeight: validateFontWeight((_g = creation.fontWeight) !== null && _g !== void 0 ? _g : this.configuration.fontWeight),
            fill: (_h = creation.fill) !== null && _h !== void 0 ? _h : this.configuration.fill,
            backgroundColor: (_j = creation.backgroundColor) !== null && _j !== void 0 ? _j : this.configuration.backgroundColor,
            textAlign: validateAlignment((_k = creation.textAlign) !== null && _k !== void 0 ? _k : this.configuration.textAlign),
            opacity: validateFiniteRange((_l = creation.opacity) !== null && _l !== void 0 ? _l : this.configuration.opacity, 'Text opacity', 0, 1),
            angle: validateFiniteRange((_m = creation.angle) !== null && _m !== void 0 ? _m : 0, 'Text angle', -36e4, 360000),
            selectable: (_o = creation.selectable) !== null && _o !== void 0 ? _o : this.configuration.selectable,
            evented: (_p = creation.evented) !== null && _p !== void 0 ? _p : this.configuration.evented,
            editable: (_q = creation.editable) !== null && _q !== void 0 ? _q : this.configuration.editable,
            originX: 'left',
            originY: 'top',
        });
        return this.authoring.create({
            kind: TEXT_ANNOTATION_KIND,
            object,
            name: (_r = creation.name) !== null && _r !== void 0 ? _r : `${this.configuration.namePrefix} ${++this.nameSequence}`,
            metadata: creation.metadata,
            hidden: creation.hidden,
            locked: creation.locked,
            select: creation.select,
            operationId: 'annotation-text:create',
        });
    }
    async beginEditing(id) {
        var _a;
        this.assertActive('begin Text editing');
        this.assertImageLoaded();
        if (this.session) {
            throw new foundations_annotation_index.AnnotationValidationError('A Text editing session is already active.');
        }
        const descriptor = this.annotations.get(id);
        const source = this.authoring.getObject(id, TEXT_ANNOTATION_KIND);
        if (!descriptor || !source) {
            throw new foundations_annotation_index.AnnotationValidationError(`Text Annotation "${id}" was not found.`);
        }
        if (descriptor.locked) {
            throw new foundations_annotation_index.AnnotationValidationError('Locked Text cannot enter editing.');
        }
        const preview = (await source.clone());
        const previewId = `annotation-text:edit:${++this.previewSequence}`;
        let visibility = null;
        let added = false;
        try {
            preview.set({ visible: true, selectable: true, evented: true, editable: true });
            visibility = this.authoring.hideForPreview([id]);
            this.authoring.addPreview({
                id: previewId,
                ownerKind: TEXT_ANNOTATION_KIND,
                object: preview,
                interactive: true,
                select: false,
            });
            added = true;
            (_a = preview.enterEditing) === null || _a === void 0 ? void 0 : _a.call(preview);
        }
        catch (error) {
            try {
                if (added)
                    this.authoring.removePreview([previewId]);
                else
                    preview.dispose();
            }
            finally {
                visibility === null || visibility === void 0 ? void 0 : visibility.dispose();
            }
            throw error;
        }
        this.session = Object.freeze({ annotationId: id, previewId, preview, visibility });
        this.emitStatus();
    }
    async commitEditing() {
        var _a;
        this.assertActive('commit Text editing');
        const session = this.session;
        if (!session)
            return;
        const patch = normalizeFeatureUpdate({
            text: String((_a = session.preview.text) !== null && _a !== void 0 ? _a : ''),
            fontSize: session.preview.fontSize,
            fontFamily: session.preview.fontFamily,
            fontWeight: session.preview.fontWeight,
            fill: session.preview.fill,
            backgroundColor: session.preview.backgroundColor,
            textAlign: session.preview.textAlign,
            width: session.preview.width,
            opacity: session.preview.opacity,
        });
        this.closeSession();
        await this.authoring.updateFeature({
            id: session.annotationId,
            kind: TEXT_ANNOTATION_KIND,
            patch,
            operationId: 'annotation-text:commit-edit',
        });
    }
    cancelEditing() {
        this.assertActive('cancel Text editing');
        if (!this.session)
            return;
        this.closeSession();
    }
    update(id, patch) {
        var _a;
        this.assertActive('update Text');
        if (!isPlainRecord(patch)) {
            return Promise.reject(new foundations_annotation_index.AnnotationValidationError('Text update must be an object.'));
        }
        if (((_a = this.session) === null || _a === void 0 ? void 0 : _a.annotationId) === id) {
            return Promise.reject(new foundations_annotation_index.AnnotationValidationError('Commit or cancel Text editing before updating it.'));
        }
        return this.authoring.updateFeature({
            id,
            kind: TEXT_ANNOTATION_KIND,
            patch: featureUpdate(patch),
            shared: sharedUpdate(patch),
            operationId: 'annotation-text:update',
        });
    }
    configure(patch) {
        this.assertActive('configure Text');
        this.configuration = resolveTextConfiguration(patch, this.configuration);
        this.emitStatus();
    }
    getConfiguration() {
        this.assertActive('read Text configuration');
        return Object.freeze({
            ...this.configuration,
            fontFallbacks: Object.freeze([...this.configuration.fontFallbacks]),
        });
    }
    getEditingSession() {
        var _a;
        this.assertActive('read Text editing state');
        return this.session
            ? Object.freeze({
                annotationId: this.session.annotationId,
                text: String((_a = this.session.preview.text) !== null && _a !== void 0 ? _a : ''),
            })
            : null;
    }
    subscribe(listener) {
        this.assertActive('subscribe to Text status');
        if (typeof listener !== 'function') {
            throw new foundations_annotation_index.AnnotationValidationError('Text status listener must be a function.');
        }
        this.listeners.add(listener);
        return disposable.createDisposable(() => {
            this.listeners.delete(listener);
        });
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
        this.listeners.clear();
        this.disposed = true;
    }
    closeSession() {
        var _a, _b;
        const session = this.session;
        if (!session)
            return;
        this.session = null;
        (_b = (_a = session.preview).exitEditing) === null || _b === void 0 ? void 0 : _b.call(_a);
        this.authoring.removePreview([session.previewId]);
        session.visibility.dispose();
        this.emitStatus();
    }
    emitStatus() {
        if (this.disposed || this.listeners.size === 0)
            return;
        const status = Object.freeze({
            configuration: this.getConfiguration(),
            editing: this.getEditingSession(),
        });
        for (const listener of [...this.listeners]) {
            try {
                listener(status);
            }
            catch (error) {
                this.host.reportWarning(error, 'A Text Annotation status listener failed.');
            }
        }
    }
    assertImageLoaded() {
        if (!this.host.isImageLoaded()) {
            throw new foundations_annotation_index.AnnotationValidationError('Text Annotation requires a loaded image.');
        }
    }
    assertActive(operation) {
        if (this.disposed) {
            throw new foundations_annotation_index.AnnotationValidationError(`Cannot ${operation} after disposal.`);
        }
    }
}

const TEXT_TOOL_ID = 'annotation:text';
const textAnnotationPluginRef = pluginManifest.definePluginRef('annotation:text', '1.0.0');
function textAnnotationPlugin(options = {}) {
    const initialConfiguration = resolveTextConfiguration(options);
    let controller = null;
    return pluginDefinition.definePlugin({
        ref: textAnnotationPluginRef,
        manifest: {
            id: textAnnotationPluginRef.id,
            version: '1.0.0',
            apiVersion: textAnnotationPluginRef.apiVersion,
            engine: '^3.0.0',
            requiresPlugins: [foundations_annotation_index.annotationFoundationRef],
            requires: [
                { token: foundations_annotation_index.ANNOTATION_CAPABILITY, range: '^1.0.0' },
                { token: foundations_annotation_index.ANNOTATION_AUTHORING_CAPABILITY, range: '^1.0.0' },
                { token: coreCapabilities.CORE_DIAGNOSTICS_CAPABILITY, range: '^1.0.0' },
                { token: coreCapabilities.FABRIC_RUNTIME_CAPABILITY, range: '^1.0.0' },
                { token: coreCapabilities.BASE_IMAGE_INFO_CAPABILITY, range: '^1.0.0' },
            ],
            permissions: ['fabric:objects'],
        },
        setupMode: 'sync',
        setup(context) {
            const annotations = context.capabilities.require(foundations_annotation_index.ANNOTATION_CAPABILITY);
            const authoring = context.capabilities.require(foundations_annotation_index.ANNOTATION_AUTHORING_CAPABILITY);
            const diagnostics = context.capabilities.require(coreCapabilities.CORE_DIAGNOSTICS_CAPABILITY);
            const fabric = context.capabilities.require(coreCapabilities.FABRIC_RUNTIME_CAPABILITY);
            const image = context.capabilities.require(coreCapabilities.BASE_IMAGE_INFO_CAPABILITY);
            controller = new TextAnnotationController(Object.freeze({ ...diagnostics, ...fabric, ...image }), annotations, authoring, initialConfiguration);
            context.disposables.add(authoring.registerFeature(controller.featureDefinition()));
            for (const operationId of [
                'annotation-text:create',
                'annotation-text:update',
                'annotation-text:commit-edit',
            ]) {
                context.disposables.add(context.operations.register({
                    id: operationId,
                    mode: 'mutation',
                    conflictDomains: ['document', 'overlay', 'selection', 'state'],
                    reentrancy: 'reject',
                }));
            }
            for (const operationId of [
                'annotation-text:begin-edit',
                'annotation-text:cancel-edit',
                'annotation-text:configure',
            ]) {
                context.disposables.add(context.operations.register({
                    id: operationId,
                    mode: 'busy',
                    conflictDomains: ['overlay', 'selection', 'state'],
                    reentrancy: 'queue',
                }));
            }
            context.disposables.add(context.tools.register({
                id: TEXT_TOOL_ID,
                enter: () => undefined,
                exit: () => controller === null || controller === void 0 ? void 0 : controller.cancelEditing(),
                canRunOperation: (operationId) => operationId.startsWith('annotation-text:') ||
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
                    throw new Error('Text Annotation Plugin is not installed.');
                return controller;
            };
            const api = {
                create: (createOptions) => requireController().create(createOptions),
                beginEditing: (id) => context.operations.run('annotation-text:begin-edit', id, async (value) => {
                    await context.tools.enter(TEXT_TOOL_ID);
                    try {
                        await requireController().beginEditing(value);
                    }
                    catch (error) {
                        await context.tools.exit('operation');
                        throw error;
                    }
                }),
                commitEditing: async () => {
                    try {
                        await requireController().commitEditing();
                    }
                    finally {
                        if (context.tools.getActiveToolId() === TEXT_TOOL_ID) {
                            await context.tools.exit('operation');
                        }
                    }
                },
                cancelEditing: () => context.operations.run('annotation-text:cancel-edit', undefined, async () => {
                    requireController().cancelEditing();
                    if (context.tools.getActiveToolId() === TEXT_TOOL_ID) {
                        await context.tools.exit('requested');
                    }
                }),
                update: (id, patch) => requireController().update(id, patch),
                configure: (patch) => context.operations.run('annotation-text:configure', patch, (value) => requireController().configure(value)),
                getConfiguration: () => requireController().getConfiguration(),
                getEditingSession: () => requireController().getEditingSession(),
                subscribe: (listener) => requireController().subscribe(listener),
            };
            return Object.freeze(api);
        },
        onImageCleared(context) {
            if (context.tools.getActiveToolId() === TEXT_TOOL_ID) {
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

exports.textAnnotationPlugin = textAnnotationPlugin;
exports.textAnnotationPluginRef = textAnnotationPluginRef;
//# sourceMappingURL=index.cjs.map
