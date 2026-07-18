import { OverlayStateCodecError, OverlayStateIdConflictError, OverlayStatePluginDisposedError, OverlayStateValidationError, } from './overlay-state-errors.js';
import { createOverlayStateContext } from './overlay-state-coordinate.js';
import { OVERLAY_STATE_COORDINATE_SPACE, OVERLAY_STATE_SCHEMA, OVERLAY_STATE_WIRE_VERSION, } from './overlay-state-types.js';
import { resolveOverlayStateLimits, validateOverlayStateDocument, } from './overlay-state-validation.js';
const IMPORT_OPERATION_ID = 'overlay-state:import';
const MAX_PERSISTENT_ID_LENGTH = 128;
const CODEC_TYPE_PATTERN = /^[A-Za-z0-9@][A-Za-z0-9@._:/-]{0,127}$/;
const SEMVER_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
function invalidResult(issues) {
    return Object.freeze({ valid: false, errors: Object.freeze([...issues]) });
}
function immutableIdMap(entries) {
    return Object.freeze(Object.fromEntries(entries));
}
function stateValue(document, index) {
    const item = document.overlays[index];
    return Object.freeze({
        geometry: item.geometry,
        data: item.data,
        ...(item.metadata !== undefined ? { metadata: item.metadata } : {}),
    });
}
function nextAvailableId(id, reserved) {
    for (let sequence = 1; sequence <= Number.MAX_SAFE_INTEGER; sequence += 1) {
        const suffix = `:copy-${sequence}`;
        const prefixLength = MAX_PERSISTENT_ID_LENGTH - suffix.length;
        const candidate = `${id.slice(0, Math.max(1, prefixLength))}${suffix}`;
        if (!reserved.has(candidate))
            return candidate;
    }
    throw new OverlayStateIdConflictError(id);
}
function isCodecValue(value) {
    return (typeof value === 'object' &&
        value !== null &&
        Object.prototype.hasOwnProperty.call(value, 'geometry') &&
        Object.prototype.hasOwnProperty.call(value, 'data'));
}
function resolveStateKind(overlay, kind) {
    const adapter = overlay.getStateKind(kind);
    const codec = adapter === null || adapter === void 0 ? void 0 : adapter.stateCodec;
    if ((adapter === null || adapter === void 0 ? void 0 : adapter.persistence.mode) !== 'persistent' ||
        !codec ||
        typeof codec.type !== 'string' ||
        !CODEC_TYPE_PATTERN.test(codec.type) ||
        typeof codec.version !== 'string' ||
        !SEMVER_PATTERN.test(codec.version) ||
        typeof codec.serialize !== 'function' ||
        typeof codec.validate !== 'function' ||
        typeof codec.deserialize !== 'function') {
        return null;
    }
    return Object.freeze({ adapter, codec });
}
function codecAccepts(codec, value) {
    if (!isCodecValue(value))
        return false;
    try {
        return codec.validate(value);
    }
    catch {
        return false;
    }
}
export class OverlayStateController {
    constructor(overlay, baseImage, canvas, configuredLimits) {
        Object.defineProperty(this, "overlay", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: overlay
        });
        Object.defineProperty(this, "baseImage", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: baseImage
        });
        Object.defineProperty(this, "canvas", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: canvas
        });
        Object.defineProperty(this, "configuredLimits", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: configuredLimits
        });
        Object.defineProperty(this, "sequence", {
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
    }
    validate(payload, options = {}) {
        var _a;
        this.assertActive('validate Overlay State');
        const limits = resolveOverlayStateLimits(this.configuredLimits, options.limits);
        const structural = validateOverlayStateDocument(payload, limits);
        if (!structural.valid || !structural.document)
            return structural;
        const issues = this.validateCodecs(structural.document, (_a = options.missingKindPolicy) !== null && _a !== void 0 ? _a : 'error');
        return issues.length > 0
            ? invalidResult(issues)
            : Object.freeze({
                valid: true,
                document: structural.document,
                errors: Object.freeze([]),
            });
    }
    migrate(payload, options = {}) {
        this.assertActive('migrate Overlay State');
        const limits = resolveOverlayStateLimits(this.configuredLimits, options.limits);
        const result = validateOverlayStateDocument(payload, limits);
        if (!result.valid || !result.document)
            throw new OverlayStateValidationError(result.errors);
        return result.document;
    }
    exportState(options = {}) {
        var _a, _b;
        this.assertActive('export Overlay State');
        const context = createOverlayStateContext(this.baseImage);
        const includeHidden = (_a = options.includeHidden) !== null && _a !== void 0 ? _a : true;
        const missingKindPolicy = (_b = options.missingKindPolicy) !== null && _b !== void 0 ? _b : 'error';
        const kinds = options.kinds ? new Set(options.kinds) : null;
        const objects = this.overlay.list({ includeHidden: true, includeLocked: true });
        const overlays = [];
        objects.forEach((object, layer) => {
            const classification = this.overlay.classify(object);
            if (!classification)
                return;
            const adapter = this.overlay.getStateKind(classification.kind);
            if ((adapter === null || adapter === void 0 ? void 0 : adapter.persistence.mode) === 'transient')
                return;
            if (kinds && !kinds.has(classification.kind))
                return;
            if (!includeHidden && classification.hidden)
                return;
            const resolved = resolveStateKind(this.overlay, classification.kind);
            if (!resolved) {
                if (missingKindPolicy === 'skip')
                    return;
                throw new OverlayStateCodecError(classification.kind);
            }
            const value = resolved.codec.serialize(object, context.codec);
            if (!codecAccepts(resolved.codec, value)) {
                throw new OverlayStateCodecError(classification.kind, `produced invalid State Codec data for "${classification.persistentId}"`);
            }
            overlays.push({
                id: classification.persistentId,
                kind: classification.kind,
                codec: Object.freeze({
                    type: resolved.codec.type,
                    version: resolved.codec.version,
                }),
                geometry: value.geometry,
                layer,
                hidden: classification.hidden,
                locked: classification.locked,
                ...(value.metadata !== undefined ? { metadata: value.metadata } : {}),
                data: value.data,
            });
        });
        const rawDocument = {
            schema: OVERLAY_STATE_SCHEMA,
            version: OVERLAY_STATE_WIRE_VERSION,
            coordinateSpace: OVERLAY_STATE_COORDINATE_SPACE,
            image: {
                naturalWidth: context.image.naturalWidth,
                naturalHeight: context.image.naturalHeight,
                ...(context.image.mimeType ? { mimeType: context.image.mimeType } : {}),
            },
            overlays,
            ...(options.metadata !== undefined ? { metadata: options.metadata } : {}),
        };
        const result = this.validate(rawDocument, { missingKindPolicy: 'error' });
        if (!result.valid || !result.document)
            throw new OverlayStateValidationError(result.errors);
        return result.document;
    }
    async importState(payload, options = {}) {
        var _a, _b, _c, _d, _e, _f;
        this.assertActive('import Overlay State');
        const mode = (_a = options.mode) !== null && _a !== void 0 ? _a : 'replace';
        const idConflict = (_b = options.idConflict) !== null && _b !== void 0 ? _b : 'error';
        const missingKindPolicy = (_c = options.missingKindPolicy) !== null && _c !== void 0 ? _c : 'error';
        const validated = this.validate(payload, {
            missingKindPolicy,
            limits: options.limits,
        });
        if (!validated.valid || !validated.document) {
            throw new OverlayStateValidationError(validated.errors);
        }
        const document = validated.document;
        const context = createOverlayStateContext(this.baseImage);
        const existingObjects = this.overlay.list({ includeHidden: true, includeLocked: true });
        const persistentIds = [];
        const persistentObjects = [];
        const allIds = new Set();
        for (const object of existingObjects) {
            const classification = this.overlay.classify(object);
            if (!classification)
                continue;
            allIds.add(classification.persistentId);
            if (((_d = this.overlay.getStateKind(classification.kind)) === null || _d === void 0 ? void 0 : _d.persistence.mode) === 'persistent') {
                persistentIds.push(classification.persistentId);
                persistentObjects.push(object);
            }
        }
        const removeIds = mode === 'replace' ? Object.freeze(persistentIds) : Object.freeze([]);
        const removeObjects = mode === 'replace' ? Object.freeze(persistentObjects) : Object.freeze([]);
        const reserved = new Set(allIds);
        if (mode === 'replace') {
            for (const id of removeIds)
                reserved.delete(id);
        }
        const idMapEntries = [];
        const additions = [];
        let skipped = 0;
        const ordered = document.overlays
            .map((item, index) => ({ item, index }))
            .sort((left, right) => left.item.layer - right.item.layer);
        for (const { item, index } of ordered) {
            const resolved = resolveStateKind(this.overlay, item.kind);
            if (!resolved ||
                resolved.codec.type !== item.codec.type ||
                resolved.codec.version !== item.codec.version) {
                if (missingKindPolicy === 'skip') {
                    skipped += 1;
                    continue;
                }
                throw new OverlayStateCodecError(item.kind);
            }
            let persistentId = item.id;
            if (reserved.has(persistentId)) {
                if (idConflict === 'error')
                    throw new OverlayStateIdConflictError(persistentId);
                const regenerated = nextAvailableId(persistentId, reserved);
                idMapEntries.push(Object.freeze([persistentId, regenerated]));
                persistentId = regenerated;
            }
            reserved.add(persistentId);
            const value = stateValue(document, index);
            const object = await resolved.codec.deserialize(value, context.codec);
            if (!object || typeof object !== 'object' || object.canvas) {
                throw new OverlayStateCodecError(item.kind, 'restored an incompatible object');
            }
            const marked = object;
            marked.editorOverlayKind = item.kind;
            marked.editorOverlayId = persistentId;
            marked.editorOverlayHidden = item.hidden;
            marked.editorOverlayLocked = item.locked;
            (_f = (_e = resolved.adapter).setPersistentId) === null || _f === void 0 ? void 0 : _f.call(_e, object, persistentId);
            if (!resolved.adapter.classify(object)) {
                throw new OverlayStateCodecError(item.kind, 'restored an incompatible object');
            }
            if (resolved.adapter.setHidden)
                resolved.adapter.setHidden(object, item.hidden);
            else
                object.set({ visible: !item.hidden });
            if (resolved.adapter.setLocked)
                resolved.adapter.setLocked(object, item.locked);
            else
                object.set({ selectable: !item.locked, evented: !item.locked });
            additions.push(Object.freeze({ kind: item.kind, persistentId, object }));
        }
        const additionObjects = Object.freeze(additions.map((entry) => entry.object));
        if (new Set(additionObjects).size !== additionObjects.length) {
            throw new OverlayStateCodecError('multiple', 'restored duplicate object identities');
        }
        if (removeIds.length > 0 || additions.length > 0) {
            await this.overlay.mutate({
                id: `overlay-state:import-${++this.sequence}`,
                operationId: IMPORT_OPERATION_ID,
                action: 'delete',
                objectIds: removeIds,
                mutate: () => {
                    const canvas = this.canvas.requireCanvas('import Overlay State');
                    canvas.discardActiveObject();
                    for (const object of removeObjects)
                        canvas.remove(object);
                    for (const object of additionObjects)
                        canvas.add(object);
                },
                affectedObjects: () => additionObjects,
                validate: () => {
                    for (const addition of additions) {
                        if (this.overlay.getByPersistentId(addition.persistentId) !==
                            addition.object) {
                            throw new OverlayStateCodecError(addition.kind, `did not restore "${addition.persistentId}"`);
                        }
                    }
                },
                metadata: Object.freeze({ mode, imported: additions.length, skipped }),
            });
        }
        return Object.freeze({
            mode,
            imported: additions.length,
            skipped,
            idMap: immutableIdMap(idMapEntries),
        });
    }
    dispose() {
        this.disposed = true;
    }
    validateCodecs(document, missingKindPolicy) {
        const issues = [];
        document.overlays.forEach((item, index) => {
            const resolved = resolveStateKind(this.overlay, item.kind);
            if (!resolved ||
                resolved.codec.type !== item.codec.type ||
                resolved.codec.version !== item.codec.version) {
                if (missingKindPolicy === 'error') {
                    issues.push(Object.freeze({
                        code: 'codec.unavailable',
                        path: `$.overlays[${index}].codec`,
                        message: `No compatible State Codec is installed for "${item.kind}".`,
                    }));
                }
                return;
            }
            if (!codecAccepts(resolved.codec, stateValue(document, index))) {
                issues.push(Object.freeze({
                    code: 'codec.payloadInvalid',
                    path: `$.overlays[${index}]`,
                    message: `State Codec payload for "${item.kind}" is invalid.`,
                }));
            }
        });
        return Object.freeze(issues);
    }
    assertActive(operation) {
        if (this.disposed)
            throw new OverlayStatePluginDisposedError(operation);
    }
}
//# sourceMappingURL=overlay-state-controller.js.map