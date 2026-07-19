import type * as FabricNS from 'fabric';

import type { CoreEventMap, CoreImageInfo } from '@bensitu/image-editor/core';
import {
    BASE_IMAGE_INFO_CAPABILITY,
    DOCUMENT_MUTATION_CAPABILITY,
    FABRIC_RUNTIME_CAPABILITY,
    RASTER_MUTATION_CAPABILITY,
    createDisposable,
    definePlugin,
    definePluginRef,
    type ConfigurablePluginApi,
    type PluginSetupContext,
    type SynchronousEditorPlugin,
} from '@bensitu/image-editor/sdk';
import {
    OVERLAY_CAPABILITY,
    OVERLAY_REGISTRATION_CAPABILITY,
} from '@bensitu/image-editor/plugins/overlay';

export interface BlurRegion {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
}

export interface BlurRegionConfiguration {
    readonly intensity: number;
    readonly previewFill: string;
    readonly previewStroke: string;
}

export type BlurFailurePoint =
    'prepare' | 'decode' | 'raster' | 'synchronize' | 'render' | 'history' | 'rollback';

export interface BlurRasterRequest {
    readonly region: BlurRegion;
    readonly intensity: number;
    readonly image: CoreImageInfo;
    readonly signal: AbortSignal;
}

export interface BlurRegionPluginOptions {
    readonly rasterize: (request: BlurRasterRequest) => Promise<FabricNS.FabricImage>;
    readonly configuration?: Partial<BlurRegionConfiguration>;
    readonly failureInjector?: (point: BlurFailurePoint) => void;
}

export interface BlurRegionPluginApi extends ConfigurablePluginApi<BlurRegionConfiguration> {
    preview(region: BlurRegion): Promise<string>;
    commit(id: string): Promise<void>;
    cancel(id: string): Promise<void>;
    list(): readonly Readonly<{ id: string; region: BlurRegion }>[];
    enterTool(): Promise<void>;
    exitTool(): Promise<void>;
}

type MarkedRegion = FabricNS.Rect & {
    referenceBlurRegion?: true;
    referenceBlurRegionId?: string;
};

const regionKind = 'reference-blur-region:preview';
const operationId = 'reference-blur-region:commit';
const toolId = 'reference-blur-region:tool';
const defaultConfiguration: BlurRegionConfiguration = Object.freeze({
    intensity: 12,
    previewFill: 'rgba(32, 128, 255, 0.18)',
    previewStroke: '#2080ff',
});

export const blurRegionPluginRef = definePluginRef<BlurRegionPluginApi>(
    'reference:blur-region',
    '1.0.0',
);

function validateRegion(value: BlurRegion): BlurRegion {
    if (
        !Number.isFinite(value.x) ||
        !Number.isFinite(value.y) ||
        !Number.isFinite(value.width) ||
        !Number.isFinite(value.height) ||
        value.width <= 0 ||
        value.height <= 0
    ) {
        throw new TypeError('Blur region is invalid.');
    }
    return Object.freeze({ ...value });
}

function validateConfiguration(value: BlurRegionConfiguration): BlurRegionConfiguration {
    if (
        !Number.isFinite(value.intensity) ||
        value.intensity <= 0 ||
        typeof value.previewFill !== 'string' ||
        value.previewFill.length === 0 ||
        typeof value.previewStroke !== 'string' ||
        value.previewStroke.length === 0
    ) {
        throw new TypeError('Blur region configuration is invalid.');
    }
    return Object.freeze({ ...value });
}

export function createBlurRegionPlugin(
    options: BlurRegionPluginOptions,
): SynchronousEditorPlugin<BlurRegionPluginApi, CoreEventMap> {
    if (!options || typeof options.rasterize !== 'function') {
        throw new TypeError('Blur region rasterize adapter is required.');
    }
    let configuration = validateConfiguration({
        ...defaultConfiguration,
        ...options.configuration,
    });
    let regionCounter = 0;
    let transactionCounter = 0;
    const regions = new Map<string, Readonly<{ object: MarkedRegion; region: BlurRegion }>>();
    const inject = (point: BlurFailurePoint): void => options.failureInjector?.(point);

    return definePlugin({
        ref: blurRegionPluginRef,
        manifest: {
            id: blurRegionPluginRef.id,
            version: '1.0.0',
            apiVersion: blurRegionPluginRef.apiVersion,
            engine: '^3.0.0',
            requires: [
                { token: BASE_IMAGE_INFO_CAPABILITY, range: '^1.0.0' },
                { token: DOCUMENT_MUTATION_CAPABILITY, range: '^1.0.0' },
                { token: FABRIC_RUNTIME_CAPABILITY, range: '^1.0.0' },
                { token: RASTER_MUTATION_CAPABILITY, range: '^1.0.0' },
                { token: OVERLAY_CAPABILITY, range: '^1.0.0' },
                { token: OVERLAY_REGISTRATION_CAPABILITY, range: '^1.0.0' },
            ],
            permissions: ['fabric:objects', 'fabric:custom-class', 'core:raster-mutation'],
        },
        setupMode: 'sync',
        setup(context: PluginSetupContext<CoreEventMap>) {
            const baseImage = context.capabilities.require(BASE_IMAGE_INFO_CAPABILITY);
            const mutations = context.capabilities.require(DOCUMENT_MUTATION_CAPABILITY);
            const fabric = context.capabilities.require(FABRIC_RUNTIME_CAPABILITY).fabric;
            const raster = context.capabilities.require(RASTER_MUTATION_CAPABILITY);
            const overlay = context.capabilities.require(OVERLAY_CAPABILITY);
            const registration = context.capabilities.require(OVERLAY_REGISTRATION_CAPABILITY);
            context.disposables.add(
                registration.registerKind({
                    id: regionKind,
                    ownerPluginId: blurRegionPluginRef.id,
                    classify: (object) => (object as MarkedRegion).referenceBlurRegion === true,
                    getPersistentId: (object) =>
                        (object as MarkedRegion).referenceBlurRegionId ?? null,
                    persistence: { mode: 'transient' },
                }),
            );
            context.operations.register({
                id: operationId,
                mode: 'mutation',
                conflictDomains: ['document', 'base-image', 'raster', 'overlay', 'state'],
                reentrancy: 'reject',
            });
            context.tools.register({
                id: toolId,
                enter: () => undefined,
                exit: () => undefined,
                canRunOperation: (requestedOperationId) =>
                    requestedOperationId === operationId ||
                    requestedOperationId === 'overlay:transient',
            });
            context.disposables.add(createDisposable(() => regions.clear()));

            const api: BlurRegionPluginApi = {
                async preview(input) {
                    const region = validateRegion(input);
                    const id = `blur-region-${++regionCounter}`;
                    const object = new fabric.Rect({
                        left: region.x,
                        top: region.y,
                        width: region.width,
                        height: region.height,
                        fill: configuration.previewFill,
                        stroke: configuration.previewStroke,
                        strokeWidth: 1,
                        selectable: true,
                        evented: true,
                        excludeFromExport: true,
                    }) as MarkedRegion;
                    object.referenceBlurRegion = true;
                    object.referenceBlurRegionId = id;
                    await overlay.addTransient([object]);
                    regions.set(id, Object.freeze({ object, region }));
                    return id;
                },
                async commit(id) {
                    const entry = regions.get(id);
                    if (!entry) throw new RangeError(`Blur region "${id}" does not exist.`);
                    const image = baseImage.getImageInfo();
                    if (!image) throw new Error('Blur region commit requires a loaded image.');
                    const transactionId = `blur-region:commit:${++transactionCounter}`;
                    await mutations.run({
                        id: transactionId,
                        kind: 'raster',
                        operationId,
                        conflictDomains: ['document', 'base-image', 'raster', 'overlay', 'state'],
                        metadata: Object.freeze({ regionId: id }),
                        participants: [
                            {
                                id: 'reference-blur-region:prepare',
                                order: 10,
                                prepare: () => inject('prepare'),
                            },
                        ],
                        async mutate(transaction) {
                            inject('decode');
                            const replacement = await options.rasterize({
                                region: entry.region,
                                intensity: configuration.intensity,
                                image,
                                signal: transaction.signal,
                            });
                            inject('raster');
                            raster.replaceBaseImage(transaction, replacement, {
                                baseScale: baseImage.getBaseImageScale(),
                                mimeType: image.mimeType ?? null,
                            });
                        },
                        synchronize: () => {
                            inject('synchronize');
                            inject('render');
                        },
                        validate: () => {
                            const committed = baseImage.getImageInfo();
                            if (
                                !committed ||
                                committed.naturalWidth !== image.naturalWidth ||
                                committed.naturalHeight !== image.naturalHeight
                            ) {
                                throw new Error(
                                    'Raster replacement changed Base Image dimensions.',
                                );
                            }
                        },
                        describeCommit: () => {
                            inject('history');
                            return Object.freeze({
                                regionId: id,
                                intensity: configuration.intensity,
                            });
                        },
                        rollback: () => inject('rollback'),
                    });
                    await overlay.removeTransient([id]);
                    regions.delete(id);
                },
                async cancel(id) {
                    if (!regions.has(id)) return;
                    await overlay.removeTransient([id]);
                    regions.delete(id);
                },
                list: () =>
                    Object.freeze(
                        [...regions.entries()].map(([id, entry]) =>
                            Object.freeze({ id, region: entry.region }),
                        ),
                    ),
                enterTool: () => context.tools.enter(toolId),
                exitTool: () => context.tools.exit('requested'),
                configure(patch) {
                    configuration = validateConfiguration({ ...configuration, ...patch });
                },
                getConfiguration: () => Object.freeze({ ...configuration }),
            };
            return Object.freeze(api);
        },
    });
}
