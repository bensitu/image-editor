import type * as FabricNS from 'fabric';

import {
    CoreRuntimeError,
    type DefaultMaskConfig,
    type LabelConfig,
    type MaskConfig,
    type MaskObject,
    type OverlayListOrder,
} from '../../core/index.js';
import type {
    CanvasReadPort,
    CanvasResizePort,
    CoreDiagnosticsPort,
    CorePresentationPort,
    Disposable,
    FabricRuntimePort,
    RenderRequestPort,
    SnapshotRegistrationPort,
} from '../../sdk/index.js';
import {
    captureOverlayStateBounds,
    isOverlayStateBoundsGeometry,
    restoreOverlayStateBounds,
    type OverlayFoundationApi,
    type OverlayStateBoundsGeometry,
    type OverlayStatePoint,
} from '../../foundations/overlay/index.js';
import {
    createMask as createMaskFromFactory,
    type CreateMaskContext,
} from '../../mask/mask-factory.js';
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
    create(config?: MaskConfig): Promise<MaskObject>;
    getAll(): readonly MaskObject[];
    remove(id: string): Promise<void>;
    removeSelected(): Promise<void>;
    removeAll(options?: RemoveAllOptions): Promise<void>;
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

type MaskStateKind = 'rect' | 'circle' | 'ellipse' | 'polygon';

interface MaskStateData {
    readonly version: 1;
    readonly kind: MaskStateKind;
    readonly maskId: number;
    readonly name: string;
    readonly fill: string;
    readonly opacity: number;
    readonly stroke: string | null;
    readonly strokeWidth: number;
    readonly strokeDashArray: readonly number[] | null;
    readonly cornerRadiusX: number;
    readonly cornerRadiusY: number;
    readonly points: readonly OverlayStatePoint[] | null;
    readonly hasControls: boolean;
    readonly selectable: boolean;
    readonly evented: boolean;
}

const MASK_PLUGIN_ID = '@bensitu/mask';

type MaskCoreAccess = CoreDiagnosticsPort &
    CorePresentationPort &
    FabricRuntimePort &
    CanvasReadPort &
    RenderRequestPort &
    CanvasResizePort;
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

function isPlainRecord(value: unknown): value is Record<string, unknown> {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}

function maskStateKind(object: FabricNS.FabricObject): MaskStateKind {
    const kind = String(object.type ?? '').toLowerCase();
    if (kind === 'rect' || kind === 'circle' || kind === 'ellipse' || kind === 'polygon') {
        return kind;
    }
    throw new CoreRuntimeError(`[ImageEditor] Mask kind "${kind}" cannot be persisted.`);
}

function normalizedPolygonPoints(
    object: FabricNS.FabricObject,
): readonly OverlayStatePoint[] | null {
    const points = (object as FabricNS.FabricObject & { points?: readonly OverlayStatePoint[] })
        .points;
    if (!Array.isArray(points) || points.length < 3 || points.length > 4_096) return null;
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    const left = Math.min(...xs);
    const top = Math.min(...ys);
    const width = Math.max(...xs) - left;
    const height = Math.max(...ys) - top;
    if (!(width > 0) || !(height > 0)) return null;
    return Object.freeze(
        points.map((point) =>
            Object.freeze({ x: (point.x - left) / width, y: (point.y - top) / height }),
        ),
    );
}

function isMaskStateData(value: unknown): value is MaskStateData {
    if (!isPlainRecord(value) || value.version !== 1) return false;
    const validKind =
        value.kind === 'rect' ||
        value.kind === 'circle' ||
        value.kind === 'ellipse' ||
        value.kind === 'polygon';
    const validPoints =
        value.points === null ||
        (Array.isArray(value.points) &&
            value.points.length >= 3 &&
            value.points.length <= 4_096 &&
            value.points.every(
                (point) =>
                    isPlainRecord(point) &&
                    typeof point.x === 'number' &&
                    Number.isFinite(point.x) &&
                    typeof point.y === 'number' &&
                    Number.isFinite(point.y),
            ));
    return (
        validKind &&
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
                value.strokeDashArray.every(
                    (entry) => typeof entry === 'number' && Number.isFinite(entry) && entry >= 0,
                ))) &&
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
        typeof value.evented === 'boolean'
    );
}

export class MaskPluginController implements MaskPluginApi, Disposable {
    private counter = 0;
    private lastMask: MaskObject | null = null;
    private attached = false;
    private disposed = false;
    private selectedMaskBeforeGeometry: string | null = null;
    private mutationSequence = 0;
    private lastInteractionNotification: string | null = null;
    private readonly registrations: Disposable[] = [];
    private readonly factoryOptions: CreateMaskContext['options'];

    constructor(
        private readonly host: MaskCoreAccess,
        state: SnapshotRegistrationPort,
        private readonly overlay: OverlayFoundationApi,
        readonly options: ResolvedMaskPluginOptions,
    ) {
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
            onWarning: (error: unknown, message: string) => host.reportWarning(error, message),
        } as CreateMaskContext['options']);

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
                persistence: {
                    mode: 'persistent',
                    codec: {
                        type: 'mask',
                        version: '1.0.0',
                        serialize: (object) => this.serializeMask(object),
                        validate: isSerializedMaskData,
                        deserialize: (data, context) => this.deserializeMask(data, context.fabric),
                    },
                },
                stateCodec: {
                    type: 'mask',
                    version: '1.0.0',
                    serialize: (object, context) => {
                        if (!isMaskObject(object)) {
                            throw new CoreRuntimeError(
                                '[ImageEditor] Mask State Codec received a non-mask.',
                            );
                        }
                        const kind = maskStateKind(object);
                        const metadata = (object as MaskObject & { overlayMetadata?: unknown })
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
                                strokeWidth: context.toImageNormalizedScalar(
                                    Number(object.strokeWidth) || 0,
                                ),
                                strokeDashArray: Array.isArray(object.strokeDashArray)
                                    ? Object.freeze(
                                          object.strokeDashArray.map((entry) =>
                                              context.toImageNormalizedScalar(entry),
                                          ),
                                      )
                                    : null,
                                cornerRadiusX: context.toImageNormalizedScalar(
                                    Number(Reflect.get(object, 'rx')) || 0,
                                ),
                                cornerRadiusY: context.toImageNormalizedScalar(
                                    Number(Reflect.get(object, 'ry')) || 0,
                                ),
                                points: kind === 'polygon' ? normalizedPolygonPoints(object) : null,
                                hasControls: object.hasControls === true,
                                selectable: object.selectable !== false,
                                evented: object.evented !== false,
                            } satisfies MaskStateData),
                        });
                    },
                    validate: (value) =>
                        isOverlayStateBoundsGeometry(value.geometry) &&
                        isMaskStateData(value.data) &&
                        isPlainRecord(value.metadata),
                    deserialize: (value, context) => {
                        if (
                            !isOverlayStateBoundsGeometry(value.geometry) ||
                            !isMaskStateData(value.data) ||
                            !isPlainRecord(value.metadata)
                        ) {
                            throw new CoreRuntimeError(
                                '[ImageEditor] Serialized Mask State data is malformed.',
                            );
                        }
                        const data = value.data;
                        const common = {
                            left: 0,
                            top: 0,
                            originX: 'left' as const,
                            originY: 'top' as const,
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
                        let object: FabricNS.FabricObject;
                        if (data.kind === 'circle') {
                            object = new this.host.fabric.Circle({ ...common, radius: 0.5 });
                        } else if (data.kind === 'ellipse') {
                            object = new this.host.fabric.Ellipse({ ...common, rx: 0.5, ry: 0.5 });
                        } else if (data.kind === 'polygon') {
                            object = new this.host.fabric.Polygon(
                                data.points!.map((point) => ({ x: point.x, y: point.y })),
                                common,
                            );
                        } else {
                            object = new this.host.fabric.Rect({
                                ...common,
                                width: 1,
                                height: 1,
                                rx: context.toCanvasScalar(data.cornerRadiusX),
                                ry: context.toCanvasScalar(data.cornerRadiusY),
                            });
                        }
                        const mask = object as MaskObject & { overlayMetadata?: unknown };
                        mask.editorObjectKind = 'mask';
                        mask.maskId = data.maskId;
                        mask.maskUid = `mask-state-${data.maskId}`;
                        mask.maskName = data.name;
                        mask.originalAlpha = data.opacity;
                        mask.originalStroke = data.stroke;
                        mask.originalStrokeWidth = context.toCanvasScalar(data.strokeWidth);
                        mask.overlayMetadata = Object.freeze({ ...value.metadata });
                        mask.lockRotation = !this.options.rotatable;
                        restoreOverlayStateBounds(
                            mask,
                            value.geometry as OverlayStateBoundsGeometry,
                            context,
                            this.host.fabric,
                        );
                        reattachMaskHoverHandlers(mask);
                        return mask;
                    },
                },
            }),
        );
        this.registrations.push(
            overlay.registerGeometryPolicy({
                id: `${MASK_PLUGIN_ID}:geometry`,
                kind: 'mask',
                ownerPluginId: MASK_PLUGIN_ID,
                supports: (mutation) =>
                    mutation.kind === 'crop' ||
                    (options.bindToImageTransform && mutation.kind === 'transform'),
                prepare: () => this.captureSelectionBeforeGeometry(),
                synchronize: () => this.synchronizeAfterGeometry(),
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
            overlay.registerInteractionPolicy({
                id: `${MASK_PLUGIN_ID}:interaction`,
                kind: 'mask',
                ownerPluginId: MASK_PLUGIN_ID,
                preview: (object) => {
                    if (isMaskObject(object)) syncMaskLabel(this.labelContext(), object);
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
            }),
        );
        this.registrations.push(
            state.registerTransientObject(MASK_PLUGIN_ID, (object) => {
                const candidate = object as FabricNS.FabricObject & { maskLabel?: boolean };
                return candidate.maskLabel === true;
            }),
        );
        this.registrations.push(
            state.registerSlice({
                id: MASK_PLUGIN_ID,
                version: 1,
                capturePolicy: 'always',
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
        this.attached = true;
        this.reattachRuntimeState();
    }

    create(config: MaskConfig = {}): Promise<MaskObject> {
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

    getAll(): readonly MaskObject[] {
        const masks = this.overlay
            .list({ kinds: ['mask'], includeHidden: true, includeLocked: true })
            .filter(isMaskObject);
        if (this.options.listOrder === 'back-to-front') masks.reverse();
        return Object.freeze(masks);
    }

    remove(id: string): Promise<void> {
        const object = this.overlay.getByPersistentId(id);
        if (!object || !isMaskObject(object)) {
            return Promise.reject(
                new CoreRuntimeError(`[ImageEditor] Mask "${id}" was not found.`),
            );
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

    removeSelected(): Promise<void> {
        const selectedId = this.overlay.getSelection().ids.find((id) => {
            const object = this.overlay.getByPersistentId(id);
            return object ? isMaskObject(object) : false;
        });
        return selectedId ? this.remove(selectedId) : Promise.resolve();
    }

    removeAll(options: RemoveAllOptions = {}): Promise<void> {
        void options;
        const masks = [...this.getAll()];
        if (masks.length === 0) return Promise.resolve();
        return this.overlay.mutate({
            id: `mask:remove-all:${++this.mutationSequence}`,
            operationId: 'mask:remove-all',
            action: 'delete',
            objectIds: masks.map((mask) => mask.maskUid),
            metadata: Object.freeze({ pluginId: MASK_PLUGIN_ID, objectCount: masks.length }),
            mutate: () => {
                for (const mask of masks) this.removeMaskObject(mask);
                this.counter = 0;
                this.lastMask = null;
            },
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
            options: this.factoryOptions,
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
            expandCanvasIfNeeded: (width, height) => this.host.resizeCanvas(width, height),
        };
    }

    private labelContext(): MaskLabelManagerContext {
        return {
            fabric: this.host.fabric as MaskLabelManagerContext['fabric'],
            canvas: this.host.requireCanvas('synchronize mask labels'),
            options: this.factoryOptions,
        };
    }

    private serializeMask(object: FabricNS.FabricObject): SerializedMaskData {
        if (!isMaskObject(object))
            throw new CoreRuntimeError('[ImageEditor] Mask serializer received a non-mask.');
        const serializedMask = object as MaskObject & {
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
            overlayPersistentId: serializedMask.overlayPersistentId,
            overlayMetadata: serializedMask.overlayMetadata,
        });
    }

    private async deserializeMask(
        data: unknown,
        fabricModule: FabricRuntimePort['fabric'],
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
        const serializedMask = mask as MaskObject & {
            overlayPersistentId?: string;
            overlayMetadata?: unknown;
        };
        serializedMask.overlayPersistentId = data.overlayPersistentId;
        serializedMask.overlayMetadata = data.overlayMetadata;
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
            options: this.factoryOptions,
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
