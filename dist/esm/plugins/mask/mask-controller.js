import { CoreRuntimeError } from '../../core-runtime/errors.js';
import { createMask as createLegacyMask } from '../../mask/mask-factory.js';
import { hideAllMaskLabels, removeLabelForMask, showLabelForMask, syncMaskLabel, } from '../../mask/mask-label-manager.js';
import { applyMaskSelectedStyle, applyMaskUnselectedStyle, detachMaskHoverHandlers, reattachMaskHoverHandlers, } from '../../mask/mask-style.js';
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
export class MaskPluginController {
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
            const mask = createLegacyMask(this.createContext(), config);
            if (!mask)
                throw new CoreRuntimeError('[ImageEditor] Mask configuration is invalid.');
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
                throw new CoreRuntimeError(`[ImageEditor] Mask "${id}" was not found.`);
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
            throw new CoreRuntimeError('[ImageEditor] Mask serializer received a non-mask.');
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
            throw new CoreRuntimeError(`[ImageEditor] Cannot ${operation} after disposal.`);
    }
}
//# sourceMappingURL=mask-controller.js.map