import { createDisposable } from '../../sdk/index.js';
import { applyAnnotationGeometry } from './annotation-geometry.js';
import { AnnotationError, AnnotationNotFoundError, AnnotationValidationError, } from './annotation-errors.js';
import { isValidAnnotationMetadata, normalizeAnnotationMetadata, normalizeAnnotationName, } from './annotation-metadata.js';
import { applyAnnotationInteraction, captureAnnotationInteraction, synchronizeAnnotationRuntimeState, } from './annotation-runtime-state.js';
const ANNOTATION_FOUNDATION_ID = 'foundation:annotation';
const ANNOTATION_PREVIEW_KIND = 'annotation:preview';
const featureKindPattern = /^annotation:[a-z][a-z0-9-]{0,63}$/;
const identifierPattern = /^[A-Za-z0-9@][A-Za-z0-9@._:/-]{0,127}$/;
const DEFAULT_MAX_ANNOTATION_COUNT = 2000;
const HARD_MAX_ANNOTATION_COUNT = 10000;
function isPlainRecord(value) {
    if (typeof value !== 'object' || value === null || Array.isArray(value))
        return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}
function isInteractionState(value) {
    if (!isPlainRecord(value))
        return false;
    const keys = Object.keys(value);
    return (keys.every((key) => ['selectable', 'evented', 'hasControls', 'editable'].includes(key)) &&
        typeof value.selectable === 'boolean' &&
        typeof value.evented === 'boolean' &&
        typeof value.hasControls === 'boolean' &&
        (value.editable === undefined || typeof value.editable === 'boolean'));
}
function isEnvelopeShape(value) {
    if (!isPlainRecord(value))
        return false;
    return (Object.keys(value).every((key) => ['version', 'name', 'metadata', 'interaction', 'feature'].includes(key)) &&
        value.version === 1 &&
        typeof value.name === 'string' &&
        isValidAnnotationMetadata(value.metadata) &&
        isInteractionState(value.interaction) &&
        'feature' in value);
}
function equalMetadata(left, right) {
    if (Object.is(left, right))
        return true;
    if (Array.isArray(left) && Array.isArray(right)) {
        return (left.length === right.length &&
            left.every((entry, index) => equalMetadata(entry, right[index])));
    }
    if (isPlainRecord(left) && isPlainRecord(right)) {
        const leftKeys = Object.keys(left).sort();
        const rightKeys = Object.keys(right).sort();
        return (leftKeys.length === rightKeys.length &&
            leftKeys.every((key, index) => key === rightKeys[index] && equalMetadata(left[key], right[key])));
    }
    return false;
}
function freezeEnvelope(object, feature) {
    return Object.freeze({
        version: 1,
        name: normalizeAnnotationName(object.editorAnnotationName),
        metadata: normalizeAnnotationMetadata(object.editorAnnotationMetadata),
        interaction: captureAnnotationInteraction(object),
        feature,
    });
}
function isStateData(value) {
    return (isPlainRecord(value) &&
        Object.keys(value).every((key) => ['version', 'name', 'interaction', 'feature'].includes(key)) &&
        value.version === 1 &&
        typeof value.name === 'string' &&
        isInteractionState(value.interaction) &&
        Object.prototype.hasOwnProperty.call(value, 'feature'));
}
function validateBoolean(value, label) {
    if (value === undefined)
        return undefined;
    if (typeof value !== 'boolean') {
        throw new AnnotationValidationError(`${label} must be boolean.`);
    }
    return value;
}
function normalizeSharedUpdate(value) {
    if (!isPlainRecord(value)) {
        throw new AnnotationValidationError('Annotation update must be a plain object.');
    }
    const allowed = new Set(['name', 'metadata', 'hidden', 'locked']);
    if (Object.keys(value).some((key) => !allowed.has(key))) {
        throw new AnnotationValidationError('Annotation update contains unknown keys.');
    }
    return Object.freeze({
        ...(value.name !== undefined ? { name: normalizeAnnotationName(value.name) } : {}),
        ...(value.metadata !== undefined
            ? { metadata: normalizeAnnotationMetadata(value.metadata) }
            : {}),
        ...(value.hidden !== undefined
            ? { hidden: validateBoolean(value.hidden, 'Annotation hidden state') }
            : {}),
        ...(value.locked !== undefined
            ? { locked: validateBoolean(value.locked, 'Annotation locked state') }
            : {}),
    });
}
function validateStringList(value, label) {
    if (value === undefined)
        return undefined;
    if (!Array.isArray(value) ||
        value.length > 2000 ||
        value.some((entry) => typeof entry !== 'string' ||
            entry.length === 0 ||
            entry.length > 128 ||
            entry.trim() !== entry)) {
        throw new AnnotationValidationError(`${label} is invalid.`);
    }
    return Object.freeze([...new Set(value)]);
}
export class AnnotationController {
    constructor(host, overlay, options) {
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
        Object.defineProperty(this, "features", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "listeners", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Set()
        });
        Object.defineProperty(this, "registrations", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "maxAnnotationCount", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "mutationSequence", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "generatedIdSequence", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "lastInteractionId", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "disposed", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        const configuredLimit = options.maxAnnotationCount;
        if (configuredLimit !== undefined &&
            (!Number.isSafeInteger(configuredLimit) ||
                configuredLimit <= 0 ||
                configuredLimit > HARD_MAX_ANNOTATION_COUNT)) {
            throw new AnnotationValidationError(`Annotation count limit must be an integer from 1 to ${HARD_MAX_ANNOTATION_COUNT}.`);
        }
        this.maxAnnotationCount = configuredLimit !== null && configuredLimit !== void 0 ? configuredLimit : DEFAULT_MAX_ANNOTATION_COUNT;
        this.registrations.push(overlay.registerKind({
            id: ANNOTATION_PREVIEW_KIND,
            ownerPluginId: ANNOTATION_FOUNDATION_ID,
            classify: (object) => object.editorAnnotationPreviewOwner !== undefined &&
                object.editorOverlayKind === ANNOTATION_PREVIEW_KIND,
            getPersistentId: (object) => { var _a; return (_a = object.editorAnnotationPreviewId) !== null && _a !== void 0 ? _a : null; },
            setPersistentId: (object, id) => {
                const preview = object;
                preview.editorAnnotationPreviewId = id;
                preview.editorOverlayId = id;
            },
            persistence: { mode: 'transient' },
        }));
        this.registrations.push(overlay.onSelectionChange(() => this.emitStatus()));
    }
    list(query = {}) {
        this.assertActive('list Annotations');
        const normalized = this.normalizeQuery(query);
        const objects = this.overlay.list({
            kinds: normalized.kinds,
            ids: normalized.ids,
            includeHidden: normalized.includeHidden,
            includeLocked: normalized.includeLocked,
        });
        const selected = new Set(this.overlay.getSelection().ids);
        const allLayers = this.persistentOverlayObjects();
        return Object.freeze(objects
            .filter((object) => this.isAnnotationObject(object))
            .map((object) => this.describe(object, selected, allLayers)));
    }
    get(id) {
        this.assertIdentifier(id, 'Annotation id');
        const object = this.overlay.getByPersistentId(id);
        if (!object || !this.isAnnotationObject(object))
            return null;
        return this.describe(object, new Set(this.overlay.getSelection().ids), this.persistentOverlayObjects());
    }
    async update(id, patch) {
        const object = this.requireAnnotation(id);
        const normalized = normalizeSharedUpdate(patch);
        if (!this.hasSharedUpdate(object, normalized))
            return;
        await this.overlay.mutate({
            id: this.nextMutationId('update'),
            operationId: 'annotation:update',
            action: 'programmatic',
            objectIds: [id],
            metadata: Object.freeze({ annotationKind: object.editorAnnotationKind }),
            mutate: () => this.applySharedUpdate(object, normalized),
            synchronize: () => this.emitStatus(),
        });
    }
    async remove(id) {
        await this.removeFeatures({ ids: [id], operationId: 'annotation:remove' });
    }
    async removeAll(query = {}) {
        const ids = this.list({ ...query, includeHidden: true, includeLocked: true }).map((entry) => entry.id);
        await this.removeFeatures({ ids, operationId: 'annotation:remove-all' });
    }
    async select(ids) {
        var _a;
        const normalized = (_a = validateStringList(ids, 'Annotation selection')) !== null && _a !== void 0 ? _a : [];
        for (const id of normalized) {
            const descriptor = this.get(id);
            if (!descriptor)
                throw new AnnotationNotFoundError(`Annotation "${id}" was not found.`);
            if (descriptor.hidden || descriptor.locked) {
                throw new AnnotationValidationError(`Annotation "${id}" cannot be selected while hidden or locked.`);
            }
        }
        this.overlay.select(normalized);
    }
    async clearSelection() {
        this.overlay.discardSelection();
    }
    bringForward(id) {
        return this.moveLayer(id, 'forward');
    }
    sendBackward(id) {
        return this.moveLayer(id, 'backward');
    }
    bringToFront(id) {
        return this.moveLayer(id, 'front');
    }
    sendToBack(id) {
        return this.moveLayer(id, 'back');
    }
    async flatten(query = {}, options = {}) {
        const matches = this.list({ ...query, includeLocked: true });
        if (matches.length === 0)
            return;
        await this.overlay.flatten({
            ids: matches.map((entry) => entry.id),
            kinds: [...this.features.keys()],
            includeHidden: query.includeHidden === true,
            includeLocked: true,
        }, options);
        this.emitStatus();
    }
    subscribe(listener) {
        this.assertActive('subscribe to Annotation status');
        if (typeof listener !== 'function') {
            throw new AnnotationValidationError('Annotation listener must be a function.');
        }
        this.listeners.add(listener);
        return createDisposable(() => {
            this.listeners.delete(listener);
        });
    }
    registerFeature(definition) {
        this.assertActive('register an Annotation Feature');
        this.validateFeatureDefinition(definition);
        if (this.features.has(definition.kind)) {
            throw new AnnotationError(`Annotation Feature "${definition.kind}" is already registered.`);
        }
        const normalizedDefinition = Object.freeze({
            ...definition,
        });
        const registrations = [];
        try {
            registrations.push(this.overlay.registerKind({
                id: normalizedDefinition.kind,
                ownerPluginId: normalizedDefinition.ownerPluginId,
                classify: (object) => object.editorAnnotationKind ===
                    normalizedDefinition.kind && normalizedDefinition.classify(object),
                getPersistentId: (object) => { var _a; return (_a = object.editorOverlayId) !== null && _a !== void 0 ? _a : null; },
                setPersistentId: (object, id) => {
                    object.editorOverlayId = id;
                },
                isHidden: (object) => object.editorOverlayHidden === true,
                setHidden: (object, hidden) => {
                    const annotation = object;
                    annotation.editorOverlayHidden = hidden;
                    synchronizeAnnotationRuntimeState(annotation);
                },
                isLocked: (object) => object.editorOverlayLocked === true,
                setLocked: (object, locked) => {
                    const annotation = object;
                    annotation.editorOverlayLocked = locked;
                    synchronizeAnnotationRuntimeState(annotation);
                },
                persistence: {
                    mode: 'persistent',
                    codec: {
                        type: normalizedDefinition.codec.type,
                        version: normalizedDefinition.codec.version,
                        serialize: (object) => freezeEnvelope(object, normalizedDefinition.codec.serialize(object)),
                        validate: (value) => isEnvelopeShape(value) &&
                            (() => {
                                try {
                                    normalizeAnnotationName(value.name);
                                    normalizeAnnotationMetadata(value.metadata);
                                    return normalizedDefinition.codec.validate(value.feature);
                                }
                                catch {
                                    return false;
                                }
                            })(),
                        deserialize: async (value, context) => {
                            var _a;
                            if (!isEnvelopeShape(value) ||
                                !normalizedDefinition.codec.validate(value.feature)) {
                                throw new AnnotationValidationError(`Serialized ${normalizedDefinition.kind} data is malformed.`);
                            }
                            const object = (await normalizedDefinition.codec.deserialize(value.feature, context));
                            object.editorAnnotationKind = normalizedDefinition.kind;
                            object.editorAnnotationName = normalizeAnnotationName(value.name);
                            object.editorAnnotationMetadata = normalizeAnnotationMetadata(value.metadata);
                            applyAnnotationInteraction(object, value.interaction);
                            (_a = normalizedDefinition.synchronize) === null || _a === void 0 ? void 0 : _a.call(normalizedDefinition, object);
                            return object;
                        },
                    },
                },
                ...(normalizedDefinition.stateCodec
                    ? {
                        stateCodec: {
                            type: normalizedDefinition.stateCodec.type,
                            version: normalizedDefinition.stateCodec.version,
                            serialize: (object, context) => {
                                const annotation = object;
                                const feature = normalizedDefinition.stateCodec.serialize(object, context);
                                return Object.freeze({
                                    geometry: feature.geometry,
                                    metadata: normalizeAnnotationMetadata(annotation.editorAnnotationMetadata),
                                    data: Object.freeze({
                                        version: 1,
                                        name: normalizeAnnotationName(annotation.editorAnnotationName),
                                        interaction: captureAnnotationInteraction(annotation),
                                        feature: feature.data,
                                    }),
                                });
                            },
                            validate: (value) => {
                                if (!isStateData(value.data) ||
                                    !isValidAnnotationMetadata(value.metadata)) {
                                    return false;
                                }
                                try {
                                    normalizeAnnotationName(value.data.name);
                                    return normalizedDefinition.stateCodec.validate({
                                        geometry: value.geometry,
                                        data: value.data.feature,
                                    });
                                }
                                catch {
                                    return false;
                                }
                            },
                            deserialize: async (value, context) => {
                                var _a;
                                if (!isStateData(value.data) ||
                                    !isValidAnnotationMetadata(value.metadata)) {
                                    throw new AnnotationValidationError(`Serialized ${normalizedDefinition.kind} State data is malformed.`);
                                }
                                const object = (await normalizedDefinition.stateCodec.deserialize({
                                    geometry: value.geometry,
                                    data: value.data.feature,
                                }, context));
                                object.editorAnnotationKind = normalizedDefinition.kind;
                                object.editorAnnotationName = normalizeAnnotationName(value.data.name);
                                object.editorAnnotationMetadata = normalizeAnnotationMetadata(value.metadata);
                                applyAnnotationInteraction(object, value.data.interaction);
                                (_a = normalizedDefinition.synchronize) === null || _a === void 0 ? void 0 : _a.call(normalizedDefinition, object);
                                return object;
                            },
                        },
                    }
                    : {}),
            }));
            registrations.push(this.overlay.registerGeometryPolicy({
                id: `${normalizedDefinition.ownerPluginId}:geometry`,
                kind: normalizedDefinition.kind,
                ownerPluginId: normalizedDefinition.ownerPluginId,
                supports: (mutation) => {
                    var _a;
                    return mutation.kind === 'crop' ||
                        (mutation.kind === 'transform' &&
                            ((_a = normalizedDefinition.bindToImageTransform) === null || _a === void 0 ? void 0 : _a.call(normalizedDefinition)) === true);
                },
                apply: (object, mutation) => {
                    var _a;
                    if (mutation.kind !== 'transform')
                        return;
                    this.applyGeometry(object, mutation, ((_a = normalizedDefinition.preserveReadable) === null || _a === void 0 ? void 0 : _a.call(normalizedDefinition)) === true);
                },
                synchronize: () => {
                    var _a;
                    for (const object of this.listObjects(normalizedDefinition.kind)) {
                        synchronizeAnnotationRuntimeState(object);
                        (_a = normalizedDefinition.synchronize) === null || _a === void 0 ? void 0 : _a.call(normalizedDefinition, object);
                    }
                },
            }));
            registrations.push(this.overlay.registerExportRenderer({
                id: `${normalizedDefinition.ownerPluginId}:export`,
                kind: normalizedDefinition.kind,
                ownerPluginId: normalizedDefinition.ownerPluginId,
                order: 200,
                render: async (context) => {
                    if (normalizedDefinition.render) {
                        await normalizedDefinition.render(context);
                        return;
                    }
                    const clone = await context.source.clone();
                    clone.set({
                        visible: true,
                        selectable: false,
                        evented: false,
                        hasControls: false,
                    });
                    context.targetCanvas.add(clone);
                },
            }));
            registrations.push(this.overlay.registerInteractionPolicy({
                id: `${normalizedDefinition.ownerPluginId}:interaction`,
                kind: normalizedDefinition.kind,
                ownerPluginId: normalizedDefinition.ownerPluginId,
                synchronize: (object, context) => {
                    var _a;
                    synchronizeAnnotationRuntimeState(object);
                    (_a = normalizedDefinition.synchronize) === null || _a === void 0 ? void 0 : _a.call(normalizedDefinition, object);
                    if (this.lastInteractionId !== context.descriptor.id) {
                        this.lastInteractionId = context.descriptor.id;
                        this.emitStatus();
                    }
                },
                validate: (object) => {
                    const annotation = object;
                    normalizeAnnotationName(annotation.editorAnnotationName);
                    normalizeAnnotationMetadata(annotation.editorAnnotationMetadata);
                },
            }));
        }
        catch (error) {
            this.disposeRegistrations(registrations);
            throw error;
        }
        const record = Object.freeze({
            definition: normalizedDefinition,
            registrations: Object.freeze(registrations),
        });
        this.features.set(normalizedDefinition.kind, record);
        return createDisposable(() => {
            if (this.features.get(normalizedDefinition.kind) !== record)
                return;
            this.features.delete(normalizedDefinition.kind);
            this.disposeRegistrations(registrations);
            this.emitStatus();
        });
    }
    async create(request) {
        this.assertActive('create an Annotation');
        const feature = this.requireFeature(request.kind);
        this.assertIdentifier(request.operationId, 'Annotation operation id');
        if (this.list({ includeHidden: true, includeLocked: true }).length >=
            this.maxAnnotationCount) {
            throw new AnnotationValidationError('Annotation count limit was reached.');
        }
        const object = request.object;
        object.editorAnnotationKind = request.kind;
        if (!feature.definition.classify(object)) {
            throw new AnnotationValidationError(`Annotation object does not satisfy Feature "${request.kind}".`);
        }
        const id = this.createAnnotationId();
        object.editorOverlayId = id;
        object.editorAnnotationName = normalizeAnnotationName(request.name);
        object.editorAnnotationMetadata = normalizeAnnotationMetadata(request.metadata);
        object.editorOverlayHidden = request.hidden === true;
        object.editorOverlayLocked = request.locked === true;
        applyAnnotationInteraction(object, captureAnnotationInteraction(object));
        const canvas = this.host.requireCanvas('create an Annotation');
        await this.overlay.mutate({
            id: this.nextMutationId('create'),
            operationId: request.operationId,
            action: 'create',
            metadata: Object.freeze({ annotationKind: request.kind }),
            mutate: () => canvas.add(object),
            affectedObjects: () => [object],
            synchronize: () => {
                if (request.select !== false &&
                    !object.editorOverlayHidden &&
                    !object.editorOverlayLocked) {
                    this.overlay.select([id]);
                }
                this.emitStatus();
            },
        });
        return id;
    }
    async updateFeature(request) {
        this.assertIdentifier(request.operationId, 'Annotation operation id');
        const feature = this.requireFeature(request.kind)
            .definition;
        const object = this.requireAnnotation(request.id, request.kind);
        const normalizedFeaturePatch = feature.normalizeUpdate
            ? feature.normalizeUpdate(request.patch)
            : request.patch;
        const normalizedShared = request.shared
            ? normalizeSharedUpdate(request.shared)
            : Object.freeze({});
        const featureChanged = feature.hasUpdate
            ? feature.hasUpdate(object, normalizedFeaturePatch)
            : false;
        const sharedChanged = this.hasSharedUpdate(object, normalizedShared);
        if (!featureChanged && !sharedChanged)
            return;
        await this.overlay.mutate({
            id: this.nextMutationId('feature-update'),
            operationId: request.operationId,
            action: 'programmatic',
            objectIds: [request.id],
            metadata: Object.freeze({ annotationKind: request.kind }),
            mutate: () => {
                var _a, _b;
                if (featureChanged)
                    (_a = feature.applyUpdate) === null || _a === void 0 ? void 0 : _a.call(feature, object, normalizedFeaturePatch);
                if (sharedChanged)
                    this.applySharedUpdate(object, normalizedShared);
                (_b = feature.synchronize) === null || _b === void 0 ? void 0 : _b.call(feature, object);
            },
            synchronize: () => this.emitStatus(),
        });
    }
    async removeFeatures(request) {
        var _a;
        this.assertIdentifier(request.operationId, 'Annotation operation id');
        const ids = (_a = validateStringList(request.ids, 'Annotation removal ids')) !== null && _a !== void 0 ? _a : [];
        if (ids.length === 0)
            return;
        const objects = ids.map((id) => this.requireAnnotation(id, request.kind));
        await this.overlay.mutate({
            id: this.nextMutationId('remove'),
            operationId: request.operationId,
            action: 'delete',
            objectIds: ids,
            metadata: Object.freeze({
                ...(request.kind ? { annotationKind: request.kind } : {}),
                objectCount: objects.length,
            }),
            mutate: () => {
                const canvas = this.host.requireCanvas('remove Annotations');
                for (const object of objects)
                    canvas.remove(object);
            },
            synchronize: () => this.emitStatus(),
        });
    }
    getObject(id, kind) {
        const object = this.overlay.getByPersistentId(id);
        if (!object || !this.isAnnotationObject(object))
            return null;
        const classification = this.overlay.classify(object);
        return !kind || (classification === null || classification === void 0 ? void 0 : classification.kind) === kind ? object : null;
    }
    listObjects(kind) {
        if (!this.features.has(kind))
            return Object.freeze([]);
        return Object.freeze(this.overlay.list({ kinds: [kind], includeHidden: true, includeLocked: true }));
    }
    addPreview(request) {
        this.assertActive('add an Annotation preview');
        this.assertPreviewRequest(request);
        const canvas = this.host.requireCanvas('add an Annotation preview');
        const preview = request.object;
        preview.editorAnnotationPreviewId = request.id;
        preview.editorAnnotationPreviewOwner = request.ownerKind;
        preview.editorOverlayKind = ANNOTATION_PREVIEW_KIND;
        preview.editorOverlayId = request.id;
        preview.set({
            visible: true,
            selectable: request.interactive === true,
            evented: request.interactive === true,
            hasControls: false,
            excludeFromExport: true,
        });
        canvas.add(preview);
        if (request.select === true)
            canvas.setActiveObject(preview);
        const classification = this.overlay.classify(preview);
        if ((classification === null || classification === void 0 ? void 0 : classification.kind) !== ANNOTATION_PREVIEW_KIND) {
            canvas.remove(preview);
            throw new AnnotationError('Annotation preview was not indexed as transient.');
        }
        this.host.requestRender();
    }
    replacePreview(previousIds, request) {
        this.removePreview(previousIds);
        this.addPreview(request);
    }
    removePreview(ids) {
        var _a;
        const normalized = (_a = validateStringList(ids, 'Annotation preview ids')) !== null && _a !== void 0 ? _a : [];
        const canvas = this.host.getCanvas();
        if (!canvas)
            return;
        for (const id of normalized) {
            const object = this.overlay.getByPersistentId(id);
            if (object === null || object === void 0 ? void 0 : object.editorAnnotationPreviewOwner) {
                if (canvas.getActiveObject() === object)
                    canvas.discardActiveObject();
                canvas.remove(object);
                object.dispose();
            }
        }
        this.host.requestRender();
    }
    hideForPreview(ids) {
        return this.overlay.hideForPreview(ids);
    }
    applyGeometry(object, mutation, preserveReadable) {
        applyAnnotationGeometry(object, mutation, this.host.fabric, preserveReadable);
    }
    resetForImage() {
        this.removeAllPreviews();
        this.emitStatus();
    }
    dispose() {
        if (this.disposed)
            return;
        this.removeAllPreviews();
        this.listeners.clear();
        for (const feature of [...this.features.values()].reverse()) {
            this.disposeRegistrations(feature.registrations);
        }
        this.features.clear();
        this.disposeRegistrations(this.registrations);
        this.registrations.length = 0;
        this.disposed = true;
    }
    normalizeQuery(query) {
        if (!isPlainRecord(query)) {
            throw new AnnotationValidationError('Annotation query must be a plain object.');
        }
        const allowed = new Set(['kinds', 'ids', 'includeHidden', 'includeLocked']);
        if (Object.keys(query).some((key) => !allowed.has(key))) {
            throw new AnnotationValidationError('Annotation query contains unknown keys.');
        }
        const kinds = validateStringList(query.kinds, 'Annotation query kinds');
        if (kinds) {
            for (const kind of kinds)
                this.requireFeature(kind);
        }
        return Object.freeze({
            kinds: kinds !== null && kinds !== void 0 ? kinds : Object.freeze([...this.features.keys()]),
            ids: validateStringList(query.ids, 'Annotation query ids'),
            includeHidden: validateBoolean(query.includeHidden, 'Query includeHidden'),
            includeLocked: validateBoolean(query.includeLocked, 'Query includeLocked'),
        });
    }
    describe(object, selected, layers) {
        const annotation = object;
        const classification = this.overlay.classify(object);
        if (!classification || !this.features.has(classification.kind)) {
            throw new AnnotationError('Annotation descriptor lost its Overlay classification.');
        }
        return Object.freeze({
            id: classification.persistentId,
            kind: classification.kind,
            name: normalizeAnnotationName(annotation.editorAnnotationName),
            hidden: classification.hidden,
            locked: classification.locked,
            selected: selected.has(classification.persistentId),
            layerIndex: layers.indexOf(object),
            metadata: normalizeAnnotationMetadata(annotation.editorAnnotationMetadata),
        });
    }
    hasSharedUpdate(object, patch) {
        return ((patch.name !== undefined && patch.name !== object.editorAnnotationName) ||
            (patch.metadata !== undefined &&
                !equalMetadata(patch.metadata, object.editorAnnotationMetadata)) ||
            (patch.hidden !== undefined &&
                patch.hidden !== (object.editorOverlayHidden === true)) ||
            (patch.locked !== undefined && patch.locked !== (object.editorOverlayLocked === true)));
    }
    applySharedUpdate(object, patch) {
        if (patch.name !== undefined)
            object.editorAnnotationName = patch.name;
        if (patch.metadata !== undefined) {
            object.editorAnnotationMetadata = normalizeAnnotationMetadata(patch.metadata);
        }
        if (patch.hidden !== undefined)
            object.editorOverlayHidden = patch.hidden;
        if (patch.locked !== undefined)
            object.editorOverlayLocked = patch.locked;
        synchronizeAnnotationRuntimeState(object);
    }
    async moveLayer(id, direction) {
        const object = this.requireAnnotation(id);
        const overlays = this.persistentOverlayObjects();
        const index = overlays.indexOf(object);
        if (index < 0 ||
            ((direction === 'forward' || direction === 'front') && index === overlays.length - 1) ||
            ((direction === 'backward' || direction === 'back') && index === 0)) {
            return;
        }
        if (direction === 'forward')
            await this.overlay.bringForward(id);
        else if (direction === 'backward')
            await this.overlay.sendBackward(id);
        else if (direction === 'front')
            await this.overlay.bringToFront(id);
        else
            await this.overlay.sendToBack(id);
        this.emitStatus();
    }
    persistentOverlayObjects() {
        return Object.freeze(this.overlay
            .list({ includeHidden: true, includeLocked: true })
            .filter((object) => { var _a; return ((_a = this.overlay.classify(object)) === null || _a === void 0 ? void 0 : _a.kind) !== ANNOTATION_PREVIEW_KIND; }));
    }
    isAnnotationObject(object) {
        const classification = this.overlay.classify(object);
        return !!classification && this.features.has(classification.kind);
    }
    requireAnnotation(id, kind) {
        this.assertIdentifier(id, 'Annotation id');
        const object = this.getObject(id, kind);
        if (!object) {
            throw new AnnotationNotFoundError(kind
                ? `Annotation "${id}" of kind "${kind}" was not found.`
                : `Annotation "${id}" was not found.`);
        }
        return object;
    }
    requireFeature(kind) {
        if (!featureKindPattern.test(kind) || kind === ANNOTATION_PREVIEW_KIND) {
            throw new AnnotationValidationError(`Annotation Feature kind "${kind}" is invalid.`);
        }
        const feature = this.features.get(kind);
        if (!feature) {
            throw new AnnotationNotFoundError(`Annotation Feature "${kind}" is not installed.`);
        }
        return feature;
    }
    validateFeatureDefinition(definition) {
        if (!isPlainRecord(definition)) {
            throw new AnnotationValidationError('Annotation Feature definition must be an object.');
        }
        if (!featureKindPattern.test(definition.kind) ||
            definition.kind === ANNOTATION_PREVIEW_KIND) {
            throw new AnnotationValidationError('Annotation Feature kind is invalid.');
        }
        this.assertIdentifier(definition.ownerPluginId, 'Annotation Feature owner');
        if (typeof definition.classify !== 'function' ||
            !isPlainRecord(definition.codec) ||
            !identifierPattern.test(definition.codec.type) ||
            !/^\d+\.\d+\.\d+$/.test(definition.codec.version) ||
            typeof definition.codec.serialize !== 'function' ||
            typeof definition.codec.validate !== 'function' ||
            typeof definition.codec.deserialize !== 'function') {
            throw new AnnotationValidationError('Annotation Feature codec is invalid.');
        }
    }
    assertPreviewRequest(request) {
        this.assertIdentifier(request.id, 'Annotation preview id');
        this.requireFeature(request.ownerKind);
        if (!request.object || typeof request.object !== 'object') {
            throw new AnnotationValidationError('Annotation preview object is invalid.');
        }
    }
    removeAllPreviews() {
        const canvas = this.host.getCanvas();
        if (!canvas)
            return;
        for (const object of [...canvas.getObjects()]) {
            if (object.editorOverlayKind !== ANNOTATION_PREVIEW_KIND)
                continue;
            canvas.remove(object);
            object.dispose();
        }
        this.host.requestRender();
    }
    emitStatus() {
        if (this.disposed || this.listeners.size === 0)
            return;
        const status = Object.freeze({
            annotations: this.list({ includeHidden: true, includeLocked: true }),
            selectionIds: Object.freeze(this.overlay.getSelection().ids.filter((id) => this.get(id) !== null)),
        });
        for (const listener of [...this.listeners]) {
            try {
                listener(status);
            }
            catch (error) {
                this.host.reportWarning(error, 'An Annotation status listener failed.');
            }
        }
    }
    createAnnotationId() {
        var _a, _b;
        const randomId = (_b = (_a = globalThis.crypto) === null || _a === void 0 ? void 0 : _a.randomUUID) === null || _b === void 0 ? void 0 : _b.call(_a);
        return randomId
            ? `annotation:${randomId}`
            : `annotation:${Date.now().toString(36)}:${++this.generatedIdSequence}`;
    }
    nextMutationId(action) {
        return `annotation:${action}:${++this.mutationSequence}`;
    }
    disposeRegistrations(registrations) {
        const errors = [];
        for (let index = registrations.length - 1; index >= 0; index -= 1) {
            try {
                const result = registrations[index].dispose();
                if (result instanceof Promise) {
                    void result.catch((error) => this.host.reportWarning(error, 'Annotation cleanup failed.'));
                }
            }
            catch (error) {
                errors.push(error);
            }
        }
        if (errors.length > 0) {
            throw new AnnotationError(`Annotation cleanup had ${errors.length} synchronous error(s).`);
        }
    }
    assertIdentifier(value, label) {
        if (typeof value !== 'string' || !identifierPattern.test(value)) {
            throw new AnnotationValidationError(`${label} is invalid.`);
        }
    }
    assertActive(operation) {
        if (this.disposed)
            throw new AnnotationError(`Cannot ${operation} after disposal.`);
    }
}
//# sourceMappingURL=annotation-controller.js.map