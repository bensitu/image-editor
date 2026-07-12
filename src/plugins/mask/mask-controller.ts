import type * as FabricNS from 'fabric';

import { CoreRuntimeError } from '../../core-runtime/errors.js';
import type { CoreHostPort, CoreStatePort } from '../../core-runtime/internal-capabilities.js';
import type { OverlayFoundationApi } from '../../foundations/overlay/index.js';
import { createMask as createLegacyMask, type CreateMaskContext } from '../../mask/mask-factory.js';
import {
    hideAllMaskLabels,
    removeLabelForMask,
    showLabelForMask,
    syncMaskLabel,
    type MaskLabelManagerContext,
} from '../../mask/mask-label-manager.js';
import {
    applyMaskSelectedStyle,
    applyMaskUnselectedStyle,
    detachMaskHoverHandlers,
    reattachMaskHoverHandlers,
} from '../../mask/mask-style.js';
import type {
    DefaultMaskConfig,
    LabelConfig,
    MaskConfig,
    MaskObject,
    OverlayListOrder,
    ResolvedOptions,
} from '../../core/public-types.js';
import type { Disposable } from '../../plugin-kernel/index.js';

export interface MaskPluginOptions {
    readonly defaultWidth?: number;
    readonly defaultHeight?: number;
    readonly defaultConfig?: DefaultMaskConfig;
    readonly rotatable?: boolean;
    readonly label?: LabelConfig | false;
    readonly labelOffset?: number;
    readonly listOrder?: OverlayListOrder;
    readonly bindToImageTransform?: boolean;
    readonly namePrefix?: string;
    readonly onChange?: (masks: readonly MaskObject[]) => void;
}

export interface ResolvedMaskPluginOptions {
    readonly defaultWidth: number;
    readonly defaultHeight: number;
    readonly defaultConfig: DefaultMaskConfig;
    readonly rotatable: boolean;
    readonly label: LabelConfig | false;
    readonly labelOffset: number;
    readonly listOrder: OverlayListOrder;
    readonly bindToImageTransform: boolean;
    readonly namePrefix: string;
    readonly onChange?: (masks: readonly MaskObject[]) => void;
}

export interface RemoveAllOptions {
    readonly saveHistory?: boolean;
}

export interface MaskPluginApi {
    create(config?: MaskConfig): MaskObject;
    getAll(): readonly MaskObject[];
    remove(id: string): void;
    removeSelected(): void;
    removeAll(options?: RemoveAllOptions): void;
    flatten(options?: import('../../foundations/overlay/index.js').FlattenOptions): Promise<void>;
}

interface SerializedMaskData {
    readonly object: Readonly<Record<string, unknown>>;
    readonly maskId: number;
    readonly maskUid: string;
    readonly maskName: string;
    readonly originalAlpha: number;
    readonly originalStroke?: FabricNS.TFiller | string | null;
    readonly originalStrokeWidth?: number;
    readonly overlayPersistentId?: string;
    readonly overlayMetadata?: unknown;
}

interface MaskOperationAccess {
    run<TResult>(operationId: string, body: () => TResult): TResult;
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
const DEFAULT_LABEL: LabelConfig = Object.freeze({
    getText: (mask: MaskObject) => mask.maskName,
    textOptions: Object.freeze({
        fontFamily: 'monospace',
        fontSize: 12,
        fill: '#ffffff',
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
    }),
});

function positive(value: number | undefined, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}

function nonNegative(value: number | undefined, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;
}

export function resolveMaskPluginOptions(
    options: MaskPluginOptions = {},
): ResolvedMaskPluginOptions {
    return Object.freeze({
        defaultWidth: positive(options.defaultWidth, 50),
        defaultHeight: positive(options.defaultHeight, 80),
        defaultConfig: Object.freeze({ ...(options.defaultConfig ?? {}) }),
        rotatable: options.rotatable === true,
        label:
            options.label === false ? false : Object.freeze({ ...DEFAULT_LABEL, ...options.label }),
        labelOffset: nonNegative(options.labelOffset, 3),
        listOrder: options.listOrder === 'back-to-front' ? 'back-to-front' : 'front-to-back',
        bindToImageTransform: options.bindToImageTransform === true,
        namePrefix: options.namePrefix?.trim() || 'mask',
        onChange: options.onChange,
    });
}

function isMaskObject(value: FabricNS.FabricObject): value is MaskObject {
    return (
        Reflect.get(value, 'editorObjectKind') === 'mask' &&
        typeof Reflect.get(value, 'maskId') === 'number' &&
        typeof Reflect.get(value, 'maskUid') === 'string' &&
        typeof Reflect.get(value, 'maskName') === 'string'
    );
}

function isSerializedMaskData(value: unknown): value is SerializedMaskData {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as Partial<SerializedMaskData>;
    return (
        !!candidate.object &&
        typeof candidate.object === 'object' &&
        Number.isSafeInteger(candidate.maskId) &&
        Number(candidate.maskId) > 0 &&
        typeof candidate.maskUid === 'string' &&
        candidate.maskUid.length > 0 &&
        typeof candidate.maskName === 'string' &&
        typeof candidate.originalAlpha === 'number' &&
        Number.isFinite(candidate.originalAlpha)
    );
}

export class MaskPluginController implements MaskPluginApi, Disposable {
    private counter = 0;
    private lastMask: MaskObject | null = null;
    private attached = false;
    private disposed = false;
    private selectedMaskBeforeGeometry: string | null = null;
    private readonly registrations: Disposable[] = [];
    private readonly legacyOptions: ResolvedOptions;

    private readonly onObjectTransform = (event: { target?: FabricNS.FabricObject }): void => {
        if (event.target && isMaskObject(event.target)) {
            syncMaskLabel(this.labelContext(), event.target);
        }
    };

    constructor(
        private readonly host: CoreHostPort,
        private readonly state: CoreStatePort,
        private readonly overlay: OverlayFoundationApi,
        private readonly operations: MaskOperationAccess,
        readonly options: ResolvedMaskPluginOptions,
    ) {
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
            onWarning: (error: unknown, message: string) => host.reportWarning(error, message),
        } as ResolvedOptions);

        this.registrations.push(
            overlay.registerKind({
                id: 'mask',
                ownerPluginId: MASK_PLUGIN_ID,
                classify: isMaskObject,
                getPersistentId: (object) =>
                    isMaskObject(object) && object.maskUid ? object.maskUid : null,
                setPersistentId: (object, id) => {
                    if (isMaskObject(object)) object.maskUid = id;
                },
            }),
        );
        this.registrations.push(
            overlay.registerGeometryPolicy({
                id: `${MASK_PLUGIN_ID}:geometry`,
                kind: 'mask',
                ownerPluginId: MASK_PLUGIN_ID,
                supports: (mutation) =>
                    options.bindToImageTransform && mutation.kind === 'transform',
                prepare: () => this.captureSelectionBeforeGeometry(),
                synchronize: () => this.synchronizeAfterGeometry(),
            }),
        );
        this.registrations.push(
            overlay.registerSerializer({
                id: `${MASK_PLUGIN_ID}:serializer`,
                kind: 'mask',
                ownerPluginId: MASK_PLUGIN_ID,
                serialize: (object) => this.serializeMask(object),
                validate: isSerializedMaskData,
                deserialize: (data, context) => this.deserializeMask(data, context.fabric),
            }),
        );
        this.registrations.push(
            overlay.registerExportRenderer({
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
            }),
        );
        this.registrations.push(
            state.transientObjects.register(MASK_PLUGIN_ID, (object) => {
                const candidate = object as FabricNS.FabricObject & { maskLabel?: boolean };
                return candidate.maskLabel === true;
            }),
        );
        this.registrations.push(
            state.slices.register({
                id: MASK_PLUGIN_ID,
                version: 1,
                capture: () => Object.freeze({ counter: this.counter }),
                validate: (value) => {
                    const counter = (value as { counter?: unknown } | null)?.counter;
                    return Number.isSafeInteger(counter) && Number(counter) >= 0
                        ? { valid: true, value: { counter: Number(counter) } }
                        : { valid: false, message: 'Mask counter state is malformed.' };
                },
                restore: (value: { counter: number }) => {
                    this.counter = value.counter;
                    const masks = this.getAll();
                    this.lastMask = masks[masks.length - 1] ?? null;
                    this.reattachRuntimeState();
                },
                clearState: () => {
                    this.counter = 0;
                    this.lastMask = null;
                    this.removeLabels();
                },
            }),
        );
        this.registrations.push(overlay.onSelectionChange(() => this.synchronizeSelection()));
        if (host.getCanvas()) this.attach();
    }

    attach(): void {
        this.assertActive('attach Mask plugin');
        if (this.attached) return;
        const canvas = this.host.requireCanvas('attach Mask plugin');
        if (typeof canvas.on === 'function') {
            for (const eventName of [
                'object:moving',
                'object:scaling',
                'object:rotating',
                'object:modified',
            ] as const) {
                canvas.on(eventName, this.onObjectTransform);
            }
        }
        this.attached = true;
        this.reattachRuntimeState();
    }

    create(config: MaskConfig = {}): MaskObject {
        return this.operations.run('mask:create', () => {
            this.synchronizeCounterFromCanvas();
            const before = this.state.mementos.capture();
            const mask = createLegacyMask(this.createContext(), config);
            if (!mask) throw new CoreRuntimeError('[ImageEditor] Mask configuration is invalid.');
            this.commitHistory('mask:create', before);
            this.notifyChange();
            this.synchronizeSelection();
            return mask;
        });
    }

    getAll(): readonly MaskObject[] {
        const masks = this.overlay
            .list({ kinds: ['mask'], includeHidden: true, includeLocked: true })
            .filter(isMaskObject);
        if (this.options.listOrder === 'back-to-front') masks.reverse();
        return Object.freeze(masks);
    }

    remove(id: string): void {
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

    removeSelected(): void {
        const selectedId = this.overlay.getSelection().ids.find((id) => {
            const object = this.overlay.getByPersistentId(id);
            return object ? isMaskObject(object) : false;
        });
        if (selectedId) this.remove(selectedId);
    }

    removeAll(options: RemoveAllOptions = {}): void {
        this.operations.run('mask:remove-all', () => {
            const masks = [...this.getAll()];
            if (masks.length === 0) return;
            const before = this.state.mementos.capture();
            for (const mask of masks) this.removeMaskObject(mask);
            this.counter = 0;
            this.lastMask = null;
            if (options.saveHistory !== false) this.commitHistory('mask:remove-all', before);
            this.notifyChange();
        });
    }

    flatten(options?: import('../../foundations/overlay/index.js').FlattenOptions): Promise<void> {
        return this.overlay
            .flatten({ kinds: ['mask'], includeHidden: false, includeLocked: true }, options)
            .then(() => {
                const masks = this.getAll();
                this.lastMask = masks[masks.length - 1] ?? null;
                this.notifyChange();
            });
    }

    resetForImage(): void {
        this.counter = 0;
        this.lastMask = null;
        this.removeLabels();
    }

    dispose(): void {
        if (this.disposed) return;
        const canvas = this.host.getCanvas();
        if (canvas && typeof canvas.off === 'function') {
            for (const eventName of [
                'object:moving',
                'object:scaling',
                'object:rotating',
                'object:modified',
            ] as const) {
                canvas.off(eventName, this.onObjectTransform);
            }
        }
        this.removeLabels();
        for (const object of canvas?.getObjects() ?? []) {
            if (isMaskObject(object)) detachMaskHoverHandlers(object);
        }
        const errors: unknown[] = [];
        for (let index = this.registrations.length - 1; index >= 0; index -= 1) {
            try {
                const result = this.registrations[index]!.dispose();
                if (result instanceof Promise)
                    void result.catch((error: unknown) => errors.push(error));
            } catch (error) {
                errors.push(error);
            }
        }
        this.registrations.length = 0;
        this.attached = false;
        this.disposed = true;
        if (errors.length > 0) {
            throw new CoreRuntimeError(
                `[ImageEditor] Mask disposal had ${errors.length} cleanup error(s).`,
            );
        }
    }

    private createContext(): CreateMaskContext {
        return {
            fabric: this.host.fabric as CreateMaskContext['fabric'],
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

    private labelContext(): MaskLabelManagerContext {
        return {
            fabric: this.host.fabric as MaskLabelManagerContext['fabric'],
            canvas: this.host.requireCanvas('synchronize mask labels'),
            options: this.legacyOptions,
        };
    }

    private serializeMask(object: FabricNS.FabricObject): SerializedMaskData {
        if (!isMaskObject(object))
            throw new CoreRuntimeError('[ImageEditor] Mask serializer received a non-mask.');
        const compatibility = object as MaskObject & {
            overlayPersistentId?: string;
            overlayMetadata?: unknown;
        };
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

    private async deserializeMask(
        data: unknown,
        fabricModule: CoreHostPort['fabric'],
    ): Promise<MaskObject> {
        if (!isSerializedMaskData(data)) {
            throw new CoreRuntimeError('[ImageEditor] Serialized Mask data is malformed.');
        }
        const objects = await fabricModule.util.enlivenObjects<FabricNS.FabricObject>([
            data.object,
        ]);
        const object = objects[0];
        if (!object)
            throw new CoreRuntimeError('[ImageEditor] Fabric did not restore a Mask object.');
        const mask = object as MaskObject;
        mask.editorObjectKind = 'mask';
        mask.maskId = data.maskId;
        mask.maskUid = data.maskUid;
        mask.maskName = data.maskName;
        mask.originalAlpha = data.originalAlpha;
        mask.originalStroke = data.originalStroke;
        mask.originalStrokeWidth = data.originalStrokeWidth;
        const compatibility = mask as MaskObject & {
            overlayPersistentId?: string;
            overlayMetadata?: unknown;
        };
        compatibility.overlayPersistentId = data.overlayPersistentId;
        compatibility.overlayMetadata = data.overlayMetadata;
        mask.lockRotation = !this.options.rotatable;
        reattachMaskHoverHandlers(mask);
        return mask;
    }

    private synchronizeSelection(): void {
        if (!this.attached || this.disposed) return;
        const masks = this.getAll();
        for (const mask of masks) {
            applyMaskUnselectedStyle(mask);
            removeLabelForMask(this.labelContext(), mask);
        }
        const selection = this.overlay.getSelection();
        if (selection.ids.length !== 1) return;
        const selected = this.overlay.getByPersistentId(selection.ids[0]!);
        if (!selected || !isMaskObject(selected)) return;
        applyMaskSelectedStyle(selected);
        showLabelForMask(this.labelContext(), selected);
    }

    private syncLabels(): void {
        if (!this.attached || this.disposed) return;
        for (const mask of this.getAll()) {
            if (mask.labelObject) syncMaskLabel(this.labelContext(), mask);
        }
    }

    private captureSelectionBeforeGeometry(): void {
        const selection = this.overlay.getSelection();
        if (selection.ids.length !== 1) {
            this.selectedMaskBeforeGeometry = null;
            return;
        }
        const selected = this.overlay.getByPersistentId(selection.ids[0]!);
        this.selectedMaskBeforeGeometry =
            selected && isMaskObject(selected) ? selected.maskUid : null;
    }

    private synchronizeAfterGeometry(): void {
        this.syncLabels();
        const selectedId = this.selectedMaskBeforeGeometry;
        this.selectedMaskBeforeGeometry = null;
        if (!selectedId || this.options.label === false) return;
        const selected = this.overlay.getByPersistentId(selectedId);
        if (!selected || !isMaskObject(selected)) return;
        showLabelForMask(this.labelContext(), selected);
        syncMaskLabel(this.labelContext(), selected);
    }

    private removeLabels(): void {
        const canvas = this.host.getCanvas();
        if (!canvas) return;
        hideAllMaskLabels({
            fabric: this.host.fabric as MaskLabelManagerContext['fabric'],
            canvas,
            options: this.legacyOptions,
        });
    }

    private reattachRuntimeState(): void {
        if (!this.attached) return;
        for (const mask of this.getAll()) reattachMaskHoverHandlers(mask);
        this.synchronizeSelection();
    }

    private synchronizeCounterFromCanvas(): void {
        const canvas = this.host.getCanvas();
        if (!canvas) return;
        for (const object of canvas.getObjects()) {
            if (isMaskObject(object)) this.counter = Math.max(this.counter, object.maskId);
        }
    }

    private removeMaskObject(mask: MaskObject): void {
        removeLabelForMask(this.labelContext(), mask);
        detachMaskHoverHandlers(mask);
        const canvas = this.host.requireCanvas('remove a mask');
        const canvasWithSelection = canvas as FabricNS.Canvas & {
            getActiveObjects?: () => FabricNS.FabricObject[];
            getActiveObject?: () => FabricNS.FabricObject | null;
        };
        const activeObjects =
            typeof canvasWithSelection.getActiveObjects === 'function'
                ? canvasWithSelection.getActiveObjects()
                : [canvasWithSelection.getActiveObject?.()].filter(
                      (object): object is FabricNS.FabricObject => !!object,
                  );
        if (activeObjects.includes(mask)) canvas.discardActiveObject();
        canvas.remove(mask);
        if (this.lastMask === mask) {
            const masks = this.getAll();
            this.lastMask = masks[masks.length - 1] ?? null;
        }
        this.host.requestRender();
    }

    private commitHistory(
        operationId: string,
        before: ReturnType<CoreStatePort['mementos']['capture']>,
    ): void {
        const record = this.state.captureHistoryRecord(operationId, before);
        const result = this.state.commitHistory(record);
        if (result instanceof Promise) {
            void result.catch((error: unknown) =>
                this.host.reportError(error, `History commit for "${operationId}" failed.`),
            );
        }
    }

    private notifyChange(): void {
        try {
            this.options.onChange?.(this.getAll());
        } catch (error) {
            this.host.reportWarning(error, 'Mask onChange callback failed.');
        }
    }

    private assertActive(operation: string): void {
        if (this.disposed)
            throw new CoreRuntimeError(`[ImageEditor] Cannot ${operation} after disposal.`);
    }
}
