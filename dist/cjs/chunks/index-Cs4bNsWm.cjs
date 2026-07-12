'use strict';

var internalCapabilities = require('./internal-capabilities-DIerpWRs.cjs');
var errors = require('./errors-CQdnZvQh.cjs');
var disposable = require('./disposable-Sj4tt6Lk.cjs');

function isFiniteTransformMatrix(matrix) {
    return matrix.length === 6 && matrix.every((value) => Number.isFinite(value));
}
function isApproximatelyIdentityTransform(matrix, epsilon = 1e-10) {
    const identity = [1, 0, 0, 1, 0, 0];
    return (matrix.length === identity.length &&
        matrix.every((value, index) => Math.abs(value - identity[index]) <= epsilon));
}
function computeImageTransformDelta(beforeMatrix, afterMatrix, fabricUtil) {
    if (!isFiniteTransformMatrix(beforeMatrix) || !isFiniteTransformMatrix(afterMatrix))
        return [];
    return fabricUtil.multiplyTransformMatrices(afterMatrix, fabricUtil.invertTransform(beforeMatrix));
}
function deltaHasReflection(delta) {
    if (!isFiniteTransformMatrix(delta))
        return false;
    const [a, b, c, d] = delta;
    return a * d - b * c < 0;
}
function transformPointByMatrix(point, matrix, fabricUtil) {
    const [a, b, c, d, e, f] = matrix;
    return new fabricUtil.Point(a * point.x + c * point.y + e, b * point.x + d * point.y + f);
}
function stripReflectionFromDelta(delta, fabricUtil) {
    if (!deltaHasReflection(delta))
        return delta;
    const flipXCandidate = fabricUtil.multiplyTransformMatrices(delta, [-1, 0, 0, 1, 0, 0]);
    const flipYCandidate = fabricUtil.multiplyTransformMatrices(delta, [1, 0, 0, -1, 0, 0]);
    const normalizedAngleMagnitude = (matrix) => {
        try {
            const angle = fabricUtil.qrDecompose(matrix).angle;
            return Number.isFinite(angle)
                ? Math.abs((((angle % 360) + 540) % 360) - 180)
                : Number.POSITIVE_INFINITY;
        }
        catch {
            return Number.POSITIVE_INFINITY;
        }
    };
    return normalizedAngleMagnitude(flipYCandidate) < normalizedAngleMagnitude(flipXCandidate)
        ? flipYCandidate
        : flipXCandidate;
}
function applyDeltaToObject(object, fullDelta, context) {
    var _a, _b, _c;
    if (!isFiniteTransformMatrix(fullDelta) || isApproximatelyIdentityTransform(fullDelta))
        return;
    const { fabricUtil } = context;
    object.setCoords();
    const previousOriginX = (_a = object.originX) !== null && _a !== void 0 ? _a : 'left';
    const previousOriginY = (_b = object.originY) !== null && _b !== void 0 ? _b : 'top';
    const originalCenter = object.getCenterPoint();
    const targetCenter = transformPointByMatrix(originalCenter, fullDelta, fabricUtil);
    const orientationDelta = context.preserveReadableText
        ? stripReflectionFromDelta(fullDelta, fabricUtil)
        : fullDelta;
    let restoreCenter = originalCenter;
    try {
        object.set({ originX: 'center', originY: 'center' });
        object.setPositionByOrigin(originalCenter, 'center', 'center');
        object.setCoords();
        const nextMatrix = fabricUtil.multiplyTransformMatrices(orientationDelta, object.calcTransformMatrix());
        if (!isFiniteTransformMatrix(nextMatrix))
            return;
        const decomposed = fabricUtil.qrDecompose(nextMatrix);
        object.set({ flipX: false, flipY: false });
        object.set({
            angle: decomposed.angle,
            scaleX: decomposed.scaleX,
            scaleY: decomposed.scaleY,
            skewX: decomposed.skewX,
            skewY: (_c = decomposed.skewY) !== null && _c !== void 0 ? _c : 0,
        });
        if (typeof decomposed.flipX === 'boolean' || typeof decomposed.flipY === 'boolean') {
            object.set({
                ...(typeof decomposed.flipX === 'boolean' ? { flipX: decomposed.flipX } : {}),
                ...(typeof decomposed.flipY === 'boolean' ? { flipY: decomposed.flipY } : {}),
            });
        }
        restoreCenter = targetCenter;
    }
    finally {
        object.set({ originX: previousOriginX, originY: previousOriginY });
        object.setPositionByOrigin(restoreCenter, 'center', 'center');
        object.setCoords();
    }
}

function getActiveCanvasObjects(canvas) {
    var _a;
    const candidate = canvas;
    if (typeof candidate.getActiveObjects === 'function')
        return candidate.getActiveObjects();
    const active = (_a = candidate.getActiveObject) === null || _a === void 0 ? void 0 : _a.call(candidate);
    return active ? [active] : [];
}
const OVERLAY_STATE_ID = 'foundation.overlay';
const OVERLAY_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isSerializedRecord(value) {
    return (isRecord(value) &&
        typeof value.kind === 'string' &&
        value.kind.trim().length > 0 &&
        typeof value.persistentId === 'string' &&
        OVERLAY_ID_PATTERN.test(value.persistentId) &&
        typeof value.hidden === 'boolean' &&
        typeof value.locked === 'boolean' &&
        Object.prototype.hasOwnProperty.call(value, 'data'));
}
function validateState(value) {
    return (isRecord(value) &&
        value.version === 1 &&
        Array.isArray(value.overlays) &&
        value.overlays.length <= 100000 &&
        value.overlays.every(isSerializedRecord) &&
        new Set(value.overlays.map((record) => record.persistentId)).size ===
            value.overlays.length &&
        Array.isArray(value.selectionIds) &&
        value.selectionIds.every((persistentId) => typeof persistentId === 'string' && OVERLAY_ID_PATTERN.test(persistentId)) &&
        new Set(value.selectionIds).size === value.selectionIds.length);
}
function getImageExportRegion(image, canvas) {
    image.setCoords();
    const bounds = image.getBoundingRect();
    const canvasWidth = Math.max(1, Math.round(canvas.getWidth()));
    const canvasHeight = Math.max(1, Math.round(canvas.getHeight()));
    const left = Math.min(canvasWidth - 1, Math.max(0, Math.floor(bounds.left)));
    const top = Math.min(canvasHeight - 1, Math.max(0, Math.floor(bounds.top)));
    const right = Math.min(canvasWidth, Math.max(left + 1, Math.ceil(bounds.left + bounds.width)));
    const bottom = Math.min(canvasHeight, Math.max(top + 1, Math.ceil(bounds.top + bounds.height)));
    return Object.freeze({
        left,
        top,
        width: Math.max(1, right - left),
        height: Math.max(1, bottom - top),
    });
}
function captureTransform(object) {
    var _a, _b;
    return Object.freeze({
        left: Number(object.left) || 0,
        top: Number(object.top) || 0,
        scaleX: Number(object.scaleX) || 1,
        scaleY: Number(object.scaleY) || 1,
        angle: Number(object.angle) || 0,
        skewX: Number(object.skewX) || 0,
        skewY: Number(object.skewY) || 0,
        flipX: object.flipX === true,
        flipY: object.flipY === true,
        originX: (_a = object.originX) !== null && _a !== void 0 ? _a : 'left',
        originY: (_b = object.originY) !== null && _b !== void 0 ? _b : 'top',
        visible: object.visible !== false,
        selectable: object.selectable !== false,
        evented: object.evented !== false,
    });
}
function parseExportOptions(value) {
    if (!isRecord(value))
        return {};
    const includeKinds = Array.isArray(value.includeKinds)
        ? value.includeKinds.filter((kind) => typeof kind === 'string')
        : undefined;
    const excludeKinds = Array.isArray(value.excludeKinds)
        ? value.excludeKinds.filter((kind) => typeof kind === 'string')
        : undefined;
    return Object.freeze({
        includeKinds: includeKinds ? Object.freeze(includeKinds) : undefined,
        excludeKinds: excludeKinds ? Object.freeze(excludeKinds) : undefined,
        includeHidden: value.includeHidden === true,
    });
}
class OverlayFoundationController {
    constructor(host, state, geometry, exportPort) {
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
        Object.defineProperty(this, "geometry", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: geometry
        });
        Object.defineProperty(this, "kinds", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "policies", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "serializers", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "renderers", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "byId", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "byObject", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new WeakMap()
        });
        Object.defineProperty(this, "selectionListeners", {
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
        Object.defineProperty(this, "preservedRecords", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "registrationSequence", {
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
        Object.defineProperty(this, "onObjectAdded", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: (event) => {
                if (event.target)
                    this.indexObject(event.target);
            }
        });
        Object.defineProperty(this, "onObjectRemoved", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: (event) => {
                if (event.target)
                    this.unindexObject(event.target);
            }
        });
        Object.defineProperty(this, "onSelectionChanged", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: () => this.emitSelection()
        });
        try {
            this.registrations.push(state.objectProperties.register({
                owner: OVERLAY_STATE_ID,
                keys: [
                    'editorOverlayKind',
                    'editorOverlayId',
                    'editorOverlayHidden',
                    'editorOverlayLocked',
                ],
            }));
            this.registrations.push(state.externalObjects.register(OVERLAY_STATE_ID, (object) => typeof object.editorOverlayKind === 'string'));
            this.registrations.push(state.slices.register({
                id: OVERLAY_STATE_ID,
                version: 1,
                capture: () => this.captureState(),
                validate: (value) => validateState(value)
                    ? { valid: true, value }
                    : { valid: false, message: 'Overlay Foundation state is malformed.' },
                restore: (value) => this.restoreState(value),
                clearState: () => this.resetState(),
            }));
            this.registrations.push(geometry.registerParticipant({
                id: OVERLAY_STATE_ID,
                order: 100,
                supports: () => true,
                prepare: (mutation) => this.prepareGeometry(mutation),
                apply: (mutation, prepared, context) => this.applyGeometry(mutation, prepared, context),
                synchronize: (mutation) => this.synchronizeGeometry(mutation),
                rollback: (mutation, prepared) => {
                    void mutation;
                    this.rollbackGeometry(prepared);
                },
            }));
            this.registrations.push(exportPort.register(OVERLAY_STATE_ID, {
                id: OVERLAY_STATE_ID,
                order: 100,
                isEnabled: () => this.byId.size > 0,
                render: (context) => this.renderExport(context.canvas, context.options),
            }));
        }
        catch (error) {
            disposable.disposeInReverseSync(this.registrations, { pluginId: OVERLAY_STATE_ID });
            this.registrations.length = 0;
            throw error;
        }
        if (host.getCanvas())
            this.attach();
    }
    attach() {
        this.assertActive('attach Overlay Foundation');
        if (this.attached)
            return;
        const canvas = this.host.requireCanvas('attach Overlay Foundation');
        if (typeof canvas.on === 'function') {
            canvas.on('object:added', this.onObjectAdded);
            canvas.on('object:removed', this.onObjectRemoved);
            canvas.on('selection:created', this.onSelectionChanged);
            canvas.on('selection:updated', this.onSelectionChanged);
            canvas.on('selection:cleared', this.onSelectionChanged);
        }
        this.attached = true;
        this.rebuildIndex();
    }
    registerKind(definition) {
        this.assertActive('register an overlay kind');
        this.assertIdentifier(definition.id, 'Overlay kind id');
        this.assertIdentifier(definition.ownerPluginId, 'Overlay kind owner');
        const existing = this.kinds.get(definition.id);
        if (existing) {
            throw new errors.CoreRuntimeError(`[ImageEditor] Overlay kind "${definition.id}" is already registered by "${existing.definition.ownerPluginId}".`);
        }
        const record = {
            definition: Object.freeze({ ...definition }),
            registrationOrder: this.registrationSequence++,
        };
        this.kinds.set(definition.id, record);
        this.rebuildIndex();
        return disposable.createDisposable(() => {
            if (this.kinds.get(definition.id) !== record)
                return;
            this.kinds.delete(definition.id);
            for (const indexed of [...this.byId.values()]) {
                if (indexed.kind === record)
                    this.unindexObject(indexed.object);
            }
            this.rebuildIndex();
        });
    }
    registerGeometryPolicy(policy) {
        this.assertActive('register an overlay geometry policy');
        this.assertIdentifier(policy.id, 'Overlay geometry policy id');
        this.requireKindOwner(policy.kind, policy.ownerPluginId);
        if (this.policies.has(policy.kind)) {
            throw new errors.CoreRuntimeError(`[ImageEditor] Overlay kind "${policy.kind}" already has a geometry policy.`);
        }
        const frozen = Object.freeze({ ...policy });
        this.policies.set(policy.kind, frozen);
        return disposable.createDisposable(() => {
            if (this.policies.get(policy.kind) === frozen)
                this.policies.delete(policy.kind);
        });
    }
    registerSerializer(serializer) {
        this.assertActive('register an overlay serializer');
        this.assertIdentifier(serializer.id, 'Overlay serializer id');
        this.requireKindOwner(serializer.kind, serializer.ownerPluginId);
        if (this.serializers.has(serializer.kind)) {
            throw new errors.CoreRuntimeError(`[ImageEditor] Overlay kind "${serializer.kind}" already has a serializer.`);
        }
        const frozen = Object.freeze({ ...serializer });
        this.serializers.set(serializer.kind, frozen);
        return disposable.createDisposable(() => {
            if (this.serializers.get(serializer.kind) === frozen)
                this.serializers.delete(serializer.kind);
        });
    }
    registerExportRenderer(renderer) {
        this.assertActive('register an overlay export renderer');
        this.assertIdentifier(renderer.id, 'Overlay export renderer id');
        this.requireKindOwner(renderer.kind, renderer.ownerPluginId);
        if (!Number.isFinite(renderer.order)) {
            throw new errors.CoreRuntimeError('[ImageEditor] Overlay export renderer order must be finite.');
        }
        if (this.renderers.has(renderer.kind)) {
            throw new errors.CoreRuntimeError(`[ImageEditor] Overlay kind "${renderer.kind}" already has an export renderer.`);
        }
        const frozen = Object.freeze({ ...renderer });
        this.renderers.set(renderer.kind, frozen);
        return disposable.createDisposable(() => {
            if (this.renderers.get(renderer.kind) === frozen)
                this.renderers.delete(renderer.kind);
        });
    }
    list(query = {}) {
        this.assertActive('list overlays');
        const kinds = query.kinds ? new Set(query.kinds) : null;
        const ids = query.ids ? new Set(query.ids) : null;
        const canvas = this.host.requireCanvas('list overlays');
        return Object.freeze(canvas.getObjects().filter((object) => {
            const indexed = this.byObject.get(object);
            if (!indexed)
                return false;
            const classification = this.classificationFor(indexed);
            return ((!kinds || kinds.has(classification.kind)) &&
                (!ids || ids.has(classification.persistentId)) &&
                (query.includeHidden === true || !classification.hidden) &&
                (query.includeLocked === true || !classification.locked));
        }));
    }
    getByPersistentId(id) {
        var _a, _b;
        this.assertActive('get an overlay');
        return (_b = (_a = this.byId.get(id)) === null || _a === void 0 ? void 0 : _a.object) !== null && _b !== void 0 ? _b : null;
    }
    classify(object) {
        this.assertActive('classify an overlay');
        const indexed = this.byObject.get(object);
        return indexed ? this.classificationFor(indexed) : null;
    }
    getSelection() {
        var _a, _b;
        this.assertActive('read overlay selection');
        const active = getActiveCanvasObjects(this.host.requireCanvas('read overlay selection'));
        const classifications = active
            .map((object) => this.byObject.get(object))
            .filter((entry) => entry !== undefined)
            .map((entry) => this.classificationFor(entry));
        return Object.freeze({
            ids: Object.freeze(classifications.map((entry) => entry.persistentId)),
            primaryId: (_b = (_a = classifications[0]) === null || _a === void 0 ? void 0 : _a.persistentId) !== null && _b !== void 0 ? _b : null,
            kinds: Object.freeze([...new Set(classifications.map((entry) => entry.kind))]),
        });
    }
    select(ids) {
        this.assertActive('select overlays');
        const canvas = this.host.requireCanvas('select overlays');
        const objects = ids.map((id) => this.requireIndexed(id).object);
        if (objects.length === 0) {
            canvas.discardActiveObject();
        }
        else if (objects.length === 1) {
            canvas.setActiveObject(objects[0]);
        }
        else {
            canvas.setActiveObject(new this.host.fabric.ActiveSelection(objects, { canvas }));
        }
        this.host.requestRender();
        this.emitSelection();
    }
    discardSelection() {
        this.assertActive('discard overlay selection');
        this.host.requireCanvas('discard overlay selection').discardActiveObject();
        this.host.requestRender();
        this.emitSelection();
    }
    onSelectionChange(listener) {
        this.assertActive('subscribe to overlay selection');
        this.selectionListeners.add(listener);
        return disposable.createDisposable(() => {
            this.selectionListeners.delete(listener);
        });
    }
    setHidden(id, hidden) {
        const indexed = this.requireIndexed(id);
        const marked = indexed.object;
        marked.editorOverlayHidden = hidden;
        if (indexed.kind.definition.setHidden) {
            indexed.kind.definition.setHidden(indexed.object, hidden);
        }
        else {
            indexed.object.set({ visible: !hidden });
        }
        if (hidden &&
            getActiveCanvasObjects(this.host.requireCanvas('hide an overlay')).includes(indexed.object)) {
            this.discardSelection();
        }
        this.host.requestRender();
    }
    setLocked(id, locked) {
        const indexed = this.requireIndexed(id);
        const marked = indexed.object;
        marked.editorOverlayLocked = locked;
        if (indexed.kind.definition.setLocked) {
            indexed.kind.definition.setLocked(indexed.object, locked);
        }
        else {
            indexed.object.set({ selectable: !locked, evented: !locked });
        }
        if (locked &&
            getActiveCanvasObjects(this.host.requireCanvas('lock an overlay')).includes(indexed.object)) {
            this.discardSelection();
        }
        this.host.requestRender();
    }
    bringForward(id) {
        this.moveRelative(id, 1);
    }
    sendBackward(id) {
        this.moveRelative(id, -1);
    }
    bringToFront(id) {
        const overlays = this.indexedCanvasObjects();
        this.moveToOverlayIndex(id, overlays.length - 1, overlays);
    }
    sendToBack(id) {
        this.moveToOverlayIndex(id, 0, this.indexedCanvasObjects());
    }
    async flatten(query = {}, options = {}) {
        this.assertActive('flatten overlays');
        const selected = this.list({ ...query, includeHidden: false, includeLocked: true });
        if (selected.length === 0)
            return;
        await this.geometry.run({
            id: `overlay:flatten:${Date.now()}:${++this.generatedIdSequence}`,
            kind: 'flatten',
            operationId: 'overlay:flatten',
            metadata: Object.freeze({ overlayCount: selected.length }),
            mutateBase: async () => {
                var _a, _b;
                const canvas = this.host.requireCanvas('flatten overlays');
                const baseImage = this.host.getBaseImage();
                if (!baseImage) {
                    throw new errors.CoreRuntimeError('[ImageEditor] Cannot flatten without a base image.');
                }
                const exportElement = canvas.lowerCanvasEl.ownerDocument.createElement('canvas');
                const exportCanvas = new this.host.fabric.StaticCanvas(exportElement, {
                    width: canvas.getWidth(),
                    height: canvas.getHeight(),
                    backgroundColor: this.host.options.backgroundColor,
                    renderOnAddRemove: false,
                });
                try {
                    const format = (_a = options.format) !== null && _a !== void 0 ? _a : 'png';
                    const quality = Math.max(0, Math.min(1, (_b = options.quality) !== null && _b !== void 0 ? _b : 0.92));
                    const exportOptions = Object.freeze({
                        area: 'image',
                        format,
                        quality,
                        multiplier: 1,
                    });
                    const baseClone = await baseImage.clone();
                    exportCanvas.add(baseClone);
                    exportCanvas.sendObjectToBack(baseClone);
                    await this.renderObjects(exportCanvas, selected, exportOptions);
                    exportCanvas.renderAll();
                    const dataUrl = exportCanvas.toDataURL({
                        format,
                        quality,
                        multiplier: 1,
                        ...getImageExportRegion(baseImage, canvas),
                    });
                    const replacement = await this.host.fabric.FabricImage.fromURL(dataUrl);
                    replacement.set({
                        left: 0,
                        top: 0,
                        originX: 'left',
                        originY: 'top',
                        scaleX: 1,
                        scaleY: 1,
                        selectable: false,
                        evented: false,
                    });
                    replacement.setCoords();
                    this.host.replaceBaseImage(replacement, {
                        baseScale: 1,
                        mimeType: format === 'jpeg' ? 'image/jpeg' : `image/${format}`,
                    });
                    for (const object of selected)
                        canvas.remove(object);
                }
                finally {
                    await exportCanvas.dispose();
                }
            },
        });
    }
    dispose() {
        if (this.disposed)
            return;
        const canvas = this.host.getCanvas();
        if (canvas && typeof canvas.off === 'function') {
            canvas.off('object:added', this.onObjectAdded);
            canvas.off('object:removed', this.onObjectRemoved);
            canvas.off('selection:created', this.onSelectionChanged);
            canvas.off('selection:updated', this.onSelectionChanged);
            canvas.off('selection:cleared', this.onSelectionChanged);
        }
        const registrationErrors = disposable.disposeInReverseSync(this.registrations, {
            pluginId: OVERLAY_STATE_ID,
        });
        this.registrations.length = 0;
        this.selectionListeners.clear();
        this.byId.clear();
        this.kinds.clear();
        this.policies.clear();
        this.serializers.clear();
        this.renderers.clear();
        this.preservedRecords = [];
        this.attached = false;
        this.disposed = true;
        if (registrationErrors.length > 0) {
            throw new errors.CoreRuntimeError(`[ImageEditor] Overlay Foundation disposal had ${registrationErrors.length} registration cleanup error(s).`);
        }
    }
    captureState() {
        const overlays = [];
        for (const object of this.indexedCanvasObjects()) {
            const indexed = this.byObject.get(object);
            const serializer = this.serializers.get(indexed.kind.definition.id);
            if (!serializer) {
                throw new errors.CoreRuntimeError(`[ImageEditor] Overlay kind "${indexed.kind.definition.id}" has no serializer.`);
            }
            const classification = this.classificationFor(indexed);
            overlays.push(Object.freeze({
                kind: classification.kind,
                persistentId: classification.persistentId,
                hidden: classification.hidden,
                locked: classification.locked,
                data: serializer.serialize(object),
            }));
        }
        overlays.push(...this.preservedRecords);
        return Object.freeze({
            version: 1,
            overlays: Object.freeze(overlays),
            selectionIds: this.getSelection().ids,
        });
    }
    async restoreState(value) {
        var _a, _b;
        const canvas = this.host.requireCanvas('restore Overlay Foundation state');
        canvas.discardActiveObject();
        for (const indexed of [...this.byId.values()])
            canvas.remove(indexed.object);
        this.byId.clear();
        this.preservedRecords = [];
        for (const record of value.overlays) {
            const serializer = this.serializers.get(record.kind);
            const kind = this.kinds.get(record.kind);
            if (!serializer || !kind) {
                this.preservedRecords.push(record);
                continue;
            }
            if (!serializer.validate(record.data)) {
                throw new errors.CoreRuntimeError(`[ImageEditor] Serialized overlay "${record.persistentId}" is invalid.`);
            }
            const object = await serializer.deserialize(record.data, { fabric: this.host.fabric });
            const marked = object;
            marked.editorOverlayKind = record.kind;
            marked.editorOverlayId = record.persistentId;
            marked.editorOverlayHidden = record.hidden;
            marked.editorOverlayLocked = record.locked;
            (_b = (_a = kind.definition).setPersistentId) === null || _b === void 0 ? void 0 : _b.call(_a, object, record.persistentId);
            canvas.add(object);
            this.setHidden(record.persistentId, record.hidden);
            this.setLocked(record.persistentId, record.locked);
        }
        this.rebuildIndex();
        const restoredSelection = value.selectionIds.filter((persistentId) => this.byId.has(persistentId));
        if (restoredSelection.length > 0)
            this.select(restoredSelection);
        this.host.requestRender();
    }
    resetState() {
        const canvas = this.host.getCanvas();
        if (canvas) {
            canvas.discardActiveObject();
            for (const indexed of [...this.byId.values()])
                canvas.remove(indexed.object);
        }
        this.byId.clear();
        this.preservedRecords = [];
    }
    async prepareGeometry(mutation) {
        var _a;
        const canvas = this.host.requireCanvas('prepare overlay geometry');
        for (const policy of this.policies.values()) {
            if (!policy.supports || policy.supports(mutation))
                await ((_a = policy.prepare) === null || _a === void 0 ? void 0 : _a.call(policy, mutation));
        }
        canvas.discardActiveObject();
        return Object.freeze(this.indexedCanvasObjects().map((object) => {
            const indexed = this.byObject.get(object);
            return Object.freeze({
                object,
                persistentId: indexed.persistentId,
                kind: indexed.kind.definition.id,
                transform: captureTransform(object),
            });
        }));
    }
    async applyGeometry(mutation, prepared, context) {
        if (mutation.kind === 'flatten')
            return;
        const delta = mutation.affineDelta ? [...mutation.affineDelta] : null;
        for (const entry of prepared) {
            const policy = this.policies.get(entry.kind);
            if ((policy === null || policy === void 0 ? void 0 : policy.supports) && !policy.supports(mutation))
                continue;
            try {
                if (policy === null || policy === void 0 ? void 0 : policy.apply) {
                    await policy.apply(entry.object, mutation);
                }
                else if (delta) {
                    applyDeltaToObject(entry.object, delta, {
                        fabricUtil: this.createFabricUtilAccess(),
                        preserveReadableText: (policy === null || policy === void 0 ? void 0 : policy.preserveReadable) === true,
                    });
                }
            }
            catch (error) {
                context.warnRecoverable(error, entry.persistentId, entry.kind);
            }
        }
    }
    async synchronizeGeometry(mutation) {
        var _a;
        for (const policy of this.policies.values()) {
            if (!policy.supports || policy.supports(mutation))
                await ((_a = policy.synchronize) === null || _a === void 0 ? void 0 : _a.call(policy, mutation));
        }
        this.rebuildIndex();
    }
    rollbackGeometry(prepared) {
        const canvas = this.host.getCanvas();
        if (!canvas)
            return;
        for (let index = prepared.length - 1; index >= 0; index -= 1) {
            const entry = prepared[index];
            if (!canvas.getObjects().includes(entry.object))
                canvas.add(entry.object);
            entry.object.set(entry.transform);
            entry.object.setCoords();
        }
        this.rebuildIndex();
    }
    async renderExport(targetCanvas, options) {
        var _a;
        const overlayOptions = parseExportOptions((_a = options.contributors) === null || _a === void 0 ? void 0 : _a[OVERLAY_STATE_ID]);
        const included = overlayOptions.includeKinds ? new Set(overlayOptions.includeKinds) : null;
        const excluded = overlayOptions.excludeKinds ? new Set(overlayOptions.excludeKinds) : null;
        const objects = this.indexedCanvasObjects().filter((object) => {
            const indexed = this.byObject.get(object);
            const classification = this.classificationFor(indexed);
            if (included && !included.has(classification.kind))
                return false;
            if (excluded === null || excluded === void 0 ? void 0 : excluded.has(classification.kind))
                return false;
            return !classification.hidden || overlayOptions.includeHidden;
        });
        await this.renderObjects(targetCanvas, objects, options);
    }
    async renderObjects(targetCanvas, objects, options) {
        for (const object of objects) {
            const indexed = this.byObject.get(object);
            if (!indexed)
                continue;
            const classification = this.classificationFor(indexed);
            const renderer = this.renderers.get(classification.kind);
            if (renderer) {
                await renderer.render({ source: object, targetCanvas, options });
            }
            else {
                const clone = await object.clone();
                clone.set({ visible: true });
                targetCanvas.add(clone);
            }
        }
    }
    indexObject(object) {
        if (this.byObject.has(object))
            return;
        const records = [...this.kinds.values()].sort((left, right) => left.registrationOrder - right.registrationOrder);
        for (const kind of records) {
            let matches = false;
            try {
                matches = kind.definition.classify(object);
            }
            catch (error) {
                this.host.reportWarning(error, `Overlay kind predicate "${kind.definition.id}" failed.`);
            }
            if (!matches)
                continue;
            let persistentId = kind.definition.getPersistentId(object);
            if (!persistentId && kind.definition.setPersistentId) {
                persistentId = this.generatePersistentId(kind.definition.id);
                kind.definition.setPersistentId(object, persistentId);
            }
            if (!persistentId || !OVERLAY_ID_PATTERN.test(persistentId)) {
                this.host.reportWarning(new Error('Malformed persistent overlay id.'), `Overlay kind "${kind.definition.id}" produced an invalid persistent id.`);
                return;
            }
            const duplicate = this.byId.get(persistentId);
            if (duplicate && duplicate.object !== object) {
                this.host.reportWarning(new Error(`Duplicate overlay id: ${persistentId}`), `Overlay "${persistentId}" was not indexed because its id is already in use.`);
                return;
            }
            const indexed = { object, kind, persistentId };
            this.byId.set(persistentId, indexed);
            this.byObject.set(object, indexed);
            const marked = object;
            marked.editorOverlayKind = kind.definition.id;
            marked.editorOverlayId = persistentId;
            return;
        }
    }
    unindexObject(object) {
        const indexed = this.byObject.get(object);
        if (!indexed)
            return;
        if (this.byId.get(indexed.persistentId) === indexed)
            this.byId.delete(indexed.persistentId);
        this.byObject.delete(object);
    }
    rebuildIndex() {
        const canvas = this.host.getCanvas();
        if (!canvas)
            return;
        const live = new Set(canvas.getObjects());
        for (const indexed of [...this.byId.values()]) {
            if (!live.has(indexed.object))
                this.unindexObject(indexed.object);
        }
        for (const object of canvas.getObjects())
            this.indexObject(object);
    }
    classificationFor(indexed) {
        const definition = indexed.kind.definition;
        const marked = indexed.object;
        return Object.freeze({
            kind: definition.id,
            persistentId: indexed.persistentId,
            ownerPluginId: definition.ownerPluginId,
            hidden: definition.isHidden
                ? definition.isHidden(indexed.object)
                : marked.editorOverlayHidden === true || indexed.object.visible === false,
            locked: definition.isLocked
                ? definition.isLocked(indexed.object)
                : marked.editorOverlayLocked === true,
        });
    }
    indexedCanvasObjects() {
        const canvas = this.host.requireCanvas('inspect overlay order');
        return canvas.getObjects().filter((object) => this.byObject.has(object));
    }
    moveRelative(id, delta) {
        const overlays = this.indexedCanvasObjects();
        const current = overlays.indexOf(this.requireIndexed(id).object);
        this.moveToOverlayIndex(id, Math.max(0, Math.min(overlays.length - 1, current + delta)), overlays);
    }
    moveToOverlayIndex(id, target, overlays) {
        if (overlays.length === 0)
            return;
        const canvas = this.host.requireCanvas('change overlay layer');
        const object = this.requireIndexed(id).object;
        const targetObject = overlays[Math.max(0, Math.min(overlays.length - 1, target))];
        const targetCanvasIndex = canvas.getObjects().indexOf(targetObject);
        const movableCanvas = canvas;
        if (movableCanvas.moveObjectTo) {
            movableCanvas.moveObjectTo(object, targetCanvasIndex);
        }
        else {
            canvas.remove(object);
            canvas.insertAt(targetCanvasIndex, object);
        }
        this.host.requestRender();
    }
    requireIndexed(id) {
        this.assertActive('access an overlay');
        const indexed = this.byId.get(id);
        if (!indexed)
            throw new errors.CoreRuntimeError(`[ImageEditor] Overlay "${id}" was not found.`);
        return indexed;
    }
    requireKindOwner(kindId, ownerPluginId) {
        const kind = this.kinds.get(kindId);
        if (!kind)
            throw new errors.CoreRuntimeError(`[ImageEditor] Overlay kind "${kindId}" is not registered.`);
        if (kind.definition.ownerPluginId !== ownerPluginId) {
            throw new errors.CoreRuntimeError(`[ImageEditor] Overlay kind "${kindId}" belongs to "${kind.definition.ownerPluginId}", not "${ownerPluginId}".`);
        }
    }
    emitSelection() {
        if (this.disposed)
            return;
        const selection = this.getSelection();
        for (const listener of [...this.selectionListeners]) {
            try {
                listener(selection);
            }
            catch (error) {
                this.host.reportWarning(error, 'Overlay selection listener failed.');
            }
        }
    }
    generatePersistentId(kind) {
        var _a, _b;
        const randomId = (_b = (_a = globalThis.crypto) === null || _a === void 0 ? void 0 : _a.randomUUID) === null || _b === void 0 ? void 0 : _b.call(_a);
        return randomId
            ? `${kind}:${randomId}`
            : `${kind}:${Date.now().toString(36)}:${++this.generatedIdSequence}`;
    }
    createFabricUtilAccess() {
        return {
            multiplyTransformMatrices: (left, right) => this.host.fabric.util.multiplyTransformMatrices(left, right),
            invertTransform: (matrix) => this.host.fabric.util.invertTransform(matrix),
            qrDecompose: (matrix) => this.host.fabric.util.qrDecompose(matrix),
            Point: this.host.fabric.Point,
        };
    }
    assertIdentifier(value, label) {
        if (value.trim().length === 0 || value.trim() !== value) {
            throw new errors.CoreRuntimeError(`[ImageEditor] ${label} must be non-empty and trimmed.`);
        }
    }
    assertActive(operation) {
        if (this.disposed)
            throw new errors.CoreRuntimeError(`[ImageEditor] Cannot ${operation} after disposal.`);
    }
}

const OVERLAY_CAPABILITY = internalCapabilities.createCapabilityToken('foundation.overlay', '1.0.0');
const overlayFoundationRef = internalCapabilities.definePluginRef('foundation.overlay', '1.0.0');
function overlayFoundationPlugin() {
    let controller = null;
    return Object.freeze({
        ref: overlayFoundationRef,
        version: '1.0.0',
        setupMode: 'sync',
        requires: [
            { token: internalCapabilities.CORE_HOST_CAPABILITY, range: '^1.0.0' },
            { token: internalCapabilities.CORE_STATE_CAPABILITY, range: '^1.0.0' },
            { token: internalCapabilities.GEOMETRY_CAPABILITY, range: '^1.0.0' },
            { token: internalCapabilities.CORE_EXPORT_CAPABILITY, range: '^1.0.0' },
        ],
        setup(context) {
            const host = context.capabilities.require(internalCapabilities.CORE_HOST_CAPABILITY);
            const state = context.capabilities.require(internalCapabilities.CORE_STATE_CAPABILITY);
            const geometry = context.capabilities.require(internalCapabilities.GEOMETRY_CAPABILITY);
            const exportPort = context.capabilities.require(internalCapabilities.CORE_EXPORT_CAPABILITY);
            context.operations.register({ id: 'overlay:flatten', mode: 'busy' });
            controller = new OverlayFoundationController(host, state, geometry, exportPort);
            context.capabilities.provide(OVERLAY_CAPABILITY, controller);
            return controller;
        },
        onInit() {
            controller === null || controller === void 0 ? void 0 : controller.attach();
        },
        onDispose() {
            controller === null || controller === void 0 ? void 0 : controller.dispose();
            controller = null;
        },
    });
}

exports.OVERLAY_CAPABILITY = OVERLAY_CAPABILITY;
exports.applyDeltaToObject = applyDeltaToObject;
exports.computeImageTransformDelta = computeImageTransformDelta;
exports.isApproximatelyIdentityTransform = isApproximatelyIdentityTransform;
exports.isFiniteTransformMatrix = isFiniteTransformMatrix;
exports.overlayFoundationPlugin = overlayFoundationPlugin;
exports.overlayFoundationRef = overlayFoundationRef;
//# sourceMappingURL=index-Cs4bNsWm.cjs.map
