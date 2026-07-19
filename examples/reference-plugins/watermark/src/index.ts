import type * as FabricNS from 'fabric';

import type {
    CoreEventMap,
    FabricModule,
    GeometryMutationDescriptor,
} from '@bensitu/image-editor/core';
import {
    FABRIC_RUNTIME_CAPABILITY,
    SNAPSHOT_REGISTRATION_CAPABILITY,
    definePlugin,
    definePluginRef,
    type ConfigurablePluginApi,
    type PluginSetupContext,
    type SynchronousEditorPlugin,
} from '@bensitu/image-editor/sdk';
import {
    OVERLAY_CAPABILITY,
    OVERLAY_REGISTRATION_CAPABILITY,
    type FabricObjectCodec,
    type OverlayRuntimeApi,
} from '@bensitu/image-editor/plugins/overlay';

export interface WatermarkOptions {
    readonly text: string;
    readonly left: number;
    readonly top: number;
    readonly opacity?: number;
    readonly fontSize?: number;
    readonly fill?: string;
}

export interface WatermarkConfiguration {
    readonly defaultOpacity: number;
    readonly defaultFontSize: number;
    readonly defaultFill: string;
}

export interface WatermarkDescriptor {
    readonly id: string;
    readonly text: string;
    readonly left: number;
    readonly top: number;
    readonly opacity: number;
    readonly fontSize: number;
    readonly fill: string;
}

export interface WatermarkPluginApi extends ConfigurablePluginApi<WatermarkConfiguration> {
    add(options: WatermarkOptions): Promise<string>;
    update(id: string, patch: Partial<WatermarkOptions>): Promise<void>;
    remove(id: string): Promise<void>;
    list(): readonly WatermarkDescriptor[];
}

export interface WatermarkPluginOptions {
    readonly configuration?: Partial<WatermarkConfiguration>;
    readonly codec?: FabricObjectCodec<FabricNS.Text, SerializedWatermark>;
}

interface SerializedWatermark {
    readonly text: string;
    readonly left: number;
    readonly top: number;
    readonly opacity: number;
    readonly fontSize: number;
    readonly fill: string;
}

interface WatermarkState {
    readonly counter: number;
    readonly configuration: WatermarkConfiguration;
}

type MarkedText = FabricNS.Text & {
    referenceWatermark?: true;
    referenceWatermarkId?: string;
};

const watermarkKind = 'reference-watermark:text';
const stateSliceId = 'reference-watermark:configuration';
const defaultConfiguration: WatermarkConfiguration = Object.freeze({
    defaultOpacity: 0.65,
    defaultFontSize: 24,
    defaultFill: '#ffffff',
});

export const watermarkPluginRef = definePluginRef<WatermarkPluginApi>(
    'reference:watermark',
    '1.0.0',
);

function finite(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}

function validOpacity(value: unknown): value is number {
    return finite(value) && value >= 0 && value <= 1;
}

function validateConfiguration(value: WatermarkConfiguration): WatermarkConfiguration {
    if (
        !validOpacity(value.defaultOpacity) ||
        !finite(value.defaultFontSize) ||
        value.defaultFontSize <= 0 ||
        typeof value.defaultFill !== 'string' ||
        value.defaultFill.length === 0
    ) {
        throw new TypeError('Watermark configuration is invalid.');
    }
    return Object.freeze({ ...value });
}

function validateSerialized(value: unknown): value is SerializedWatermark {
    if (typeof value !== 'object' || value === null) return false;
    const candidate = value as Partial<SerializedWatermark>;
    return (
        typeof candidate.text === 'string' &&
        finite(candidate.left) &&
        finite(candidate.top) &&
        validOpacity(candidate.opacity) &&
        finite(candidate.fontSize) &&
        candidate.fontSize > 0 &&
        typeof candidate.fill === 'string' &&
        candidate.fill.length > 0
    );
}

function serialize(object: MarkedText): SerializedWatermark {
    const fill = typeof object.fill === 'string' ? object.fill : defaultConfiguration.defaultFill;
    return Object.freeze({
        text: object.text,
        left: Number(object.left) || 0,
        top: Number(object.top) || 0,
        opacity: validOpacity(object.opacity) ? object.opacity : 1,
        fontSize: Number(object.fontSize) || defaultConfiguration.defaultFontSize,
        fill,
    });
}

function mark(object: FabricNS.Text, id?: string): MarkedText {
    const marked = object as MarkedText;
    marked.referenceWatermark = true;
    if (id) marked.referenceWatermarkId = id;
    return marked;
}

function descriptor(object: MarkedText): WatermarkDescriptor {
    const data = serialize(object);
    return Object.freeze({ id: object.referenceWatermarkId ?? '', ...data });
}

function resolveWatermark(
    options: WatermarkOptions,
    configuration: WatermarkConfiguration,
): SerializedWatermark {
    const resolved = {
        text: options.text,
        left: options.left,
        top: options.top,
        opacity: options.opacity ?? configuration.defaultOpacity,
        fontSize: options.fontSize ?? configuration.defaultFontSize,
        fill: options.fill ?? configuration.defaultFill,
    };
    if (!validateSerialized(resolved)) throw new TypeError('Watermark options are invalid.');
    return Object.freeze(resolved);
}

function createDefaultCodec(
    fabric: FabricModule,
): FabricObjectCodec<FabricNS.Text, SerializedWatermark> {
    return Object.freeze({
        type: 'reference-watermark:text',
        version: '1.0.0',
        serialize,
        validate: validateSerialized,
        deserialize(data: unknown) {
            if (!validateSerialized(data)) throw new TypeError('Watermark payload is invalid.');
            return mark(
                new fabric.Text(data.text, {
                    left: data.left,
                    top: data.top,
                    opacity: data.opacity,
                    fontSize: data.fontSize,
                    fill: data.fill,
                }),
            );
        },
    });
}

function applyGeometry(object: FabricNS.FabricObject, mutation: GeometryMutationDescriptor): void {
    if (!mutation.affineDelta) return;
    const [a, b, c, d, e, f] = mutation.affineDelta;
    const left = Number(object.left) || 0;
    const top = Number(object.top) || 0;
    object.set({ left: a * left + c * top + e, top: b * left + d * top + f });
    object.setCoords();
}

function requireMarked(overlay: OverlayRuntimeApi, id: string): MarkedText {
    const object = overlay.getByPersistentId(id) as MarkedText | null;
    if (!object || object.referenceWatermark !== true) {
        throw new RangeError(`Watermark "${id}" does not exist.`);
    }
    return object;
}

export function createWatermarkPlugin(
    options: WatermarkPluginOptions = {},
): SynchronousEditorPlugin<WatermarkPluginApi, CoreEventMap> {
    let configuration = validateConfiguration({
        ...defaultConfiguration,
        ...options.configuration,
    });
    let counter = 0;
    let transactionCounter = 0;

    return definePlugin({
        ref: watermarkPluginRef,
        manifest: {
            id: watermarkPluginRef.id,
            version: '1.0.0',
            apiVersion: watermarkPluginRef.apiVersion,
            engine: '^3.0.0',
            requires: [
                { token: FABRIC_RUNTIME_CAPABILITY, range: '^1.0.0' },
                { token: SNAPSHOT_REGISTRATION_CAPABILITY, range: '^1.0.0' },
                { token: OVERLAY_CAPABILITY, range: '^1.0.0' },
                { token: OVERLAY_REGISTRATION_CAPABILITY, range: '^1.0.0' },
            ],
            permissions: ['fabric:objects', 'fabric:custom-class'],
        },
        setupMode: 'sync',
        setup(context: PluginSetupContext<CoreEventMap>) {
            const fabric = context.capabilities.require(FABRIC_RUNTIME_CAPABILITY).fabric;
            const state = context.capabilities.require(SNAPSHOT_REGISTRATION_CAPABILITY);
            const overlay = context.capabilities.require(OVERLAY_CAPABILITY);
            const registration = context.capabilities.require(OVERLAY_REGISTRATION_CAPABILITY);
            const codec = options.codec ?? createDefaultCodec(fabric);

            context.disposables.add(
                registration.registerKind({
                    id: watermarkKind,
                    ownerPluginId: watermarkPluginRef.id,
                    classify: (object) => (object as MarkedText).referenceWatermark === true,
                    getPersistentId: (object) =>
                        (object as MarkedText).referenceWatermarkId ?? null,
                    setPersistentId: (object, id) => {
                        (object as MarkedText).referenceWatermarkId = id;
                    },
                    persistence: { mode: 'persistent', codec },
                    exportOrder: 500,
                }),
            );
            context.disposables.add(
                registration.registerGeometryPolicy({
                    id: 'reference-watermark:geometry',
                    kind: watermarkKind,
                    ownerPluginId: watermarkPluginRef.id,
                    preserveReadable: true,
                    apply: applyGeometry,
                }),
            );
            context.disposables.add(
                registration.registerExportRenderer({
                    id: 'reference-watermark:export',
                    kind: watermarkKind,
                    ownerPluginId: watermarkPluginRef.id,
                    order: 500,
                    async render({ source, targetCanvas }) {
                        const clone = await source.clone();
                        clone.set({ selectable: false, evented: false });
                        targetCanvas.add(clone);
                    },
                }),
            );
            context.disposables.add(
                state.registerSlice<WatermarkState>({
                    id: stateSliceId,
                    version: 1,
                    capturePolicy: 'always',
                    capture: () => Object.freeze({ counter, configuration }),
                    validate(value) {
                        if (typeof value !== 'object' || value === null) {
                            return { valid: false, message: 'Watermark state must be an object.' };
                        }
                        const candidate = value as Partial<WatermarkState>;
                        try {
                            if (
                                !Number.isSafeInteger(candidate.counter) ||
                                candidate.counter! < 0
                            ) {
                                throw new TypeError('Watermark counter is invalid.');
                            }
                            const resolved = validateConfiguration(
                                candidate.configuration as WatermarkConfiguration,
                            );
                            return {
                                valid: true,
                                value: Object.freeze({
                                    counter: candidate.counter!,
                                    configuration: resolved,
                                }),
                            };
                        } catch (error) {
                            return {
                                valid: false,
                                message: error instanceof Error ? error.message : String(error),
                            };
                        }
                    },
                    restore(value) {
                        counter = value.counter;
                        configuration = validateConfiguration(value.configuration);
                    },
                    clearState() {
                        counter = 0;
                        configuration = validateConfiguration(defaultConfiguration);
                    },
                }),
            );

            const api: WatermarkPluginApi = {
                async add(input) {
                    const resolved = resolveWatermark(input, configuration);
                    const id = `watermark-${++counter}`;
                    const object = mark(
                        new fabric.Text(resolved.text, {
                            left: resolved.left,
                            top: resolved.top,
                            opacity: resolved.opacity,
                            fontSize: resolved.fontSize,
                            fill: resolved.fill,
                        }),
                        id,
                    );
                    await overlay.add([object]);
                    return id;
                },
                async update(id, patch) {
                    const object = requireMarked(overlay, id);
                    const resolved = resolveWatermark(
                        { ...descriptor(object), ...patch },
                        configuration,
                    );
                    await overlay.mutate({
                        id: `watermark:update:${++transactionCounter}`,
                        operationId: 'overlay:add',
                        action: 'programmatic',
                        objectIds: [id],
                        metadata: Object.freeze({ id }),
                        mutate: () => {
                            object.set(resolved);
                            object.setCoords();
                        },
                    });
                },
                remove: (id) => overlay.remove([id]),
                list: () =>
                    Object.freeze(
                        overlay
                            .list({
                                kinds: [watermarkKind],
                                includeHidden: true,
                                includeLocked: true,
                            })
                            .map((object) => descriptor(object as MarkedText)),
                    ),
                configure(patch) {
                    configuration = validateConfiguration({ ...configuration, ...patch });
                },
                getConfiguration: () => Object.freeze({ ...configuration }),
            };
            return Object.freeze(api);
        },
    });
}
