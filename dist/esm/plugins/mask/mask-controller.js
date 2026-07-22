import { isSafeSerializedFabricObject } from '../../fabric/safe-fabric-serialization.js';
import { CoreRuntimeError, } from '../../core/index.js';
import { captureOverlayStateBounds, isOverlayStateBoundsGeometry, restoreOverlayStateBounds, } from '../../foundations/overlay/index.js';
import { createMask as createMaskFromFactory, } from '../../mask/mask-factory.js';
import { hideAllMaskLabels, removeLabelForMask, showLabelForMask, syncMaskLabel, } from '../../mask/mask-label-manager.js';
import { applyMaskSelectedStyle, applyMaskUnselectedStyle, detachMaskHoverHandlers, reattachMaskHoverHandlers, } from '../../mask/mask-style.js';
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
export function resolveMaskPluginOptions(options = {}) {
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
        return (isSafeSerializedFabricObject(serializedObject, {
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
    throw new CoreRuntimeError(`[ImageEditor] Mask kind "${kind}" cannot be persisted.`);
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
export class MaskPluginController {
    constructor(host, state, overlay, options) {
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
        Object.defineProperty(this, "registrations", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
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
        this.registrations.push(overlay.registerKind({
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
                        throw new CoreRuntimeError('[ImageEditor] Mask State Codec received a non-mask.');
                    }
                    const kind = maskStateKind(object);
                    const metadata = object
                        .overlayMetadata;
                    return Object.freeze({
                        geometry: captureOverlayStateBounds(object, context),
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
                validate: (value) => isOverlayStateBoundsGeometry(value.geometry) &&
                    isMaskStateData(value.data) &&
                    isPlainRecord(value.metadata),
                deserialize: (value, context) => {
                    if (!isOverlayStateBoundsGeometry(value.geometry) ||
                        !isMaskStateData(value.data) ||
                        !isPlainRecord(value.metadata)) {
                        throw new CoreRuntimeError('[ImageEditor] Serialized Mask State data is malformed.');
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
                    restoreOverlayStateBounds(mask, value.geometry, context, this.host.fabric);
                    reattachMaskHoverHandlers(mask);
                    return mask;
                },
            },
        }));
        this.registrations.push(overlay.registerGeometryPolicy({
            id: 'mask:geometry',
            kind: 'mask:object',
            ownerPluginId: MASK_PLUGIN_ID,
            supports: (mutation) => mutation.kind === 'crop' ||
                (options.bindToImageTransform && mutation.kind === 'transform'),
            prepare: () => this.captureSelectionBeforeGeometry(),
            synchronize: () => this.synchronizeAfterGeometry(),
        }));
        this.registrations.push(overlay.registerExportRenderer({
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
        this.registrations.push(overlay.registerInteractionPolicy({
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
        this.registrations.push(state.registerTransientObject(MASK_PLUGIN_ID, (object) => {
            const candidate = object;
            return candidate.maskLabel === true;
        }));
        this.registrations.push(state.registerSlice({
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
        this.registrations.push(overlay.onSelectionChange(() => this.synchronizeSelection()));
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
                const mask = createMaskFromFactory(this.createContext(), config);
                if (!mask) {
                    throw new CoreRuntimeError('[ImageEditor] Mask configuration is invalid.');
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
            return Promise.reject(new CoreRuntimeError(`[ImageEditor] Mask "${id}" was not found.`));
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
        void options;
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
        const errors = [];
        for (let index = this.registrations.length - 1; index >= 0; index -= 1) {
            try {
                const result = this.registrations[index].dispose();
                if (result instanceof Promise)
                    void result.catch((error) => errors.push(error));
            }
            catch (error) {
                errors.push(error);
            }
        }
        this.registrations.length = 0;
        this.attached = false;
        this.disposed = true;
        if (errors.length > 0) {
            throw new CoreRuntimeError(`[ImageEditor] Mask disposal had ${errors.length} cleanup error(s).`);
        }
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
            throw new CoreRuntimeError('[ImageEditor] Mask serializer received a non-mask.');
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
            throw new CoreRuntimeError('[ImageEditor] Serialized Mask data is malformed.');
        }
        const objects = await fabricModule.util.enlivenObjects([
            data.object,
        ]);
        const object = objects[0];
        if (!object)
            throw new CoreRuntimeError('[ImageEditor] Fabric did not restore a Mask object.');
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
            throw new CoreRuntimeError(`[ImageEditor] Cannot ${operation} after disposal.`);
    }
}
//# sourceMappingURL=mask-controller.js.map