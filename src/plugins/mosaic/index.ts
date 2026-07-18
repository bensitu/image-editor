import type { CoreEventMap } from '../../core/index.js';
import {
    BASE_IMAGE_READ_CAPABILITY,
    CANVAS_READ_CAPABILITY,
    CORE_DIAGNOSTICS_CAPABILITY,
    CORE_STATUS_CAPABILITY,
    FABRIC_RUNTIME_CAPABILITY,
    GEOMETRY_MUTATION_CAPABILITY,
    IMAGE_RESOURCE_POLICY_CAPABILITY,
    RASTER_MUTATION_CAPABILITY,
    RENDER_REQUEST_CAPABILITY,
    SNAPSHOT_REGISTRATION_CAPABILITY,
    VISIBLE_RASTER_BAKE_CAPABILITY,
    definePlugin,
    definePluginRef,
    type PluginSetupContext,
    type SynchronousEditorPlugin,
} from '../../sdk/index.js';
import type { MosaicImagePoint } from './mosaic-brush.js';
import { MosaicController, resolveMosaicConfiguration } from './mosaic-controller.js';
import type {
    MosaicCommitOptions,
    MosaicConfiguration,
    MosaicEnterOptions,
    MosaicPluginApi,
    MosaicPluginOptions,
    MosaicStatusListener,
} from './mosaic-session.js';

const MOSAIC_TOOL_ID = 'plugin:mosaic';
const mosaicPreviewDomains = ['base-image', 'overlay', 'selection', 'state'] as const;
const mosaicMutationDomains = [
    'document',
    'base-image',
    'geometry',
    'raster',
    'overlay',
    'selection',
    'state',
] as const;

export const mosaicPluginRef = definePluginRef<MosaicPluginApi>('@bensitu/mosaic', '1.0.0');

export function mosaicPlugin(
    options: MosaicPluginOptions = {},
): SynchronousEditorPlugin<MosaicPluginApi, CoreEventMap> {
    const configuration = resolveMosaicConfiguration(options);
    let controller: MosaicController | null = null;
    return definePlugin({
        ref: mosaicPluginRef,
        manifest: {
            id: mosaicPluginRef.id,
            version: '1.0.0',
            apiVersion: mosaicPluginRef.apiVersion,
            engine: '^3.0.0',
            requires: [
                { token: CORE_STATUS_CAPABILITY, range: '^1.0.0' },
                { token: CORE_DIAGNOSTICS_CAPABILITY, range: '^1.0.0' },
                { token: FABRIC_RUNTIME_CAPABILITY, range: '^1.0.0' },
                { token: CANVAS_READ_CAPABILITY, range: '^1.0.0' },
                { token: BASE_IMAGE_READ_CAPABILITY, range: '^1.0.0' },
                { token: IMAGE_RESOURCE_POLICY_CAPABILITY, range: '^1.0.0' },
                { token: RENDER_REQUEST_CAPABILITY, range: '^1.0.0' },
                { token: RASTER_MUTATION_CAPABILITY, range: '^1.0.0' },
                { token: SNAPSHOT_REGISTRATION_CAPABILITY, range: '^1.0.0' },
                { token: GEOMETRY_MUTATION_CAPABILITY, range: '^1.0.0' },
            ],
            optional: [{ token: VISIBLE_RASTER_BAKE_CAPABILITY, range: '^1.0.0' }],
            permissions: [
                'fabric:objects',
                'fabric:canvas-read',
                'core:raster-mutation',
                'core:geometry-participant',
            ],
        },
        setupMode: 'sync',
        setup(context: PluginSetupContext<CoreEventMap>) {
            const status = context.capabilities.require(CORE_STATUS_CAPABILITY);
            const diagnostics = context.capabilities.require(CORE_DIAGNOSTICS_CAPABILITY);
            const fabricRuntime = context.capabilities.require(FABRIC_RUNTIME_CAPABILITY);
            const canvas = context.capabilities.require(CANVAS_READ_CAPABILITY);
            const baseImage = context.capabilities.require(BASE_IMAGE_READ_CAPABILITY);
            const resourcePolicy = context.capabilities.require(IMAGE_RESOURCE_POLICY_CAPABILITY);
            const render = context.capabilities.require(RENDER_REQUEST_CAPABILITY);
            const raster = context.capabilities.require(RASTER_MUTATION_CAPABILITY);
            const snapshots = context.capabilities.require(SNAPSHOT_REGISTRATION_CAPABILITY);
            const geometry = context.capabilities.require(GEOMETRY_MUTATION_CAPABILITY);
            const visibleRasterBake = context.capabilities.optional(VISIBLE_RASTER_BAKE_CAPABILITY);
            controller = new MosaicController(
                Object.freeze({
                    ...status,
                    ...diagnostics,
                    ...fabricRuntime,
                    ...canvas,
                    ...baseImage,
                    ...resourcePolicy,
                    ...render,
                }),
                geometry,
                raster,
                visibleRasterBake,
                context.capabilities.getOptionalStatus(VISIBLE_RASTER_BAKE_CAPABILITY),
                configuration,
            );
            const requireController = (): MosaicController => {
                if (!controller) throw new Error('Mosaic Plugin is not installed.');
                return controller;
            };
            for (const operationId of [
                'mosaic:enter',
                'mosaic:begin-stroke',
                'mosaic:append-stroke',
                'mosaic:end-stroke',
                'mosaic:cancel',
                'mosaic:configure',
            ]) {
                context.disposables.add(
                    context.operations.register({
                        id: operationId,
                        mode: 'busy',
                        conflictDomains: mosaicPreviewDomains,
                        reentrancy: 'queue',
                    }),
                );
            }
            context.disposables.add(
                context.operations.register({
                    id: 'mosaic:commit',
                    mode: 'mutation',
                    conflictDomains: mosaicMutationDomains,
                    reentrancy: 'queue',
                }),
            );
            context.disposables.add(
                context.tools.register({
                    id: MOSAIC_TOOL_ID,
                    enter: () => undefined,
                    exit: () => {
                        if (controller?.isActive) controller.cancel();
                    },
                    canRunOperation: (operationId) =>
                        operationId.startsWith('mosaic:') ||
                        operationId === 'crop:enter' ||
                        operationId === 'core:load-image' ||
                        operationId === 'core:commit-load-image' ||
                        operationId === 'core:load-state' ||
                        operationId === 'core:export',
                }),
            );
            context.disposables.add(
                snapshots.registerTransientObject(
                    mosaicPluginRef.id,
                    (object) => controller?.ownsPreview(object) ?? false,
                ),
            );
            const runPreviewOperation = <TValue>(
                operationId: string,
                value: TValue,
                task: (controller: MosaicController, value: TValue) => void | Promise<void>,
            ): Promise<void> =>
                context.operations.run(operationId, value, (args) =>
                    task(requireController(), args),
                );
            return Object.freeze({
                get isActive() {
                    return requireController().isActive;
                },
                enter: (enterOptions?: MosaicEnterOptions) =>
                    runPreviewOperation(
                        'mosaic:enter',
                        enterOptions ?? {},
                        async (mosaic, value) => {
                            if (mosaic.isActive) {
                                mosaic.enter(value);
                                return;
                            }
                            await context.tools.enter(MOSAIC_TOOL_ID);
                            try {
                                mosaic.enter(value);
                            } catch (error) {
                                await context.tools.exit('operation');
                                throw error;
                            }
                        },
                    ),
                beginStroke: (point: MosaicImagePoint) =>
                    runPreviewOperation('mosaic:begin-stroke', point, (mosaic, value) =>
                        mosaic.beginStroke(value),
                    ),
                appendStroke: (point: MosaicImagePoint) =>
                    runPreviewOperation('mosaic:append-stroke', point, (mosaic, value) =>
                        mosaic.appendStroke(value),
                    ),
                endStroke: () =>
                    runPreviewOperation('mosaic:end-stroke', undefined, (mosaic) =>
                        mosaic.endStroke(),
                    ),
                commit: async (commitOptions?: MosaicCommitOptions) => {
                    try {
                        await requireController().commit(commitOptions);
                    } finally {
                        if (context.tools.getActiveToolId() === MOSAIC_TOOL_ID) {
                            await context.tools.exit('operation');
                        }
                    }
                },
                cancel: () =>
                    runPreviewOperation('mosaic:cancel', undefined, async (mosaic) => {
                        mosaic.cancel();
                        if (context.tools.getActiveToolId() === MOSAIC_TOOL_ID) {
                            await context.tools.exit('requested');
                        }
                    }),
                configure: (patch: Partial<MosaicConfiguration>) =>
                    runPreviewOperation('mosaic:configure', patch, (mosaic, value) =>
                        mosaic.configure(value),
                    ),
                getConfiguration: () => requireController().getConfiguration(),
                getSession: () => requireController().getSession(),
                subscribe: (listener: MosaicStatusListener) =>
                    requireController().subscribe(listener),
            });
        },
        onImageCleared(context) {
            if (context.tools.getActiveToolId() === MOSAIC_TOOL_ID) {
                return context.tools.exit('operation');
            }
            controller?.closeForImage();
            return undefined;
        },
        onDispose() {
            controller?.dispose();
            controller = null;
        },
    });
}

export type {
    MosaicCommitOptions,
    MosaicConfiguration,
    MosaicEnterOptions,
    MosaicOutputFormat,
    MosaicPluginApi,
    MosaicPluginOptions,
    MosaicSessionState,
    MosaicStatus,
    MosaicStatusListener,
} from './mosaic-session.js';
export type { DirtyRectangle, MosaicImagePoint } from './mosaic-brush.js';
export {
    MosaicError,
    MosaicIntegrationError,
    MosaicSessionError,
    MosaicValidationError,
} from './mosaic-errors.js';
