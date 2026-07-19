/**
 * Publishes the Transform Plugin factory, configuration, mutation, state, and API contracts.
 *
 * @module
 */

import type { CoreEventMap } from '../../core/index.js';
import {
    BASE_IMAGE_READ_CAPABILITY,
    CORE_STATUS_CAPABILITY,
    FABRIC_RUNTIME_CAPABILITY,
    GEOMETRY_MUTATION_CAPABILITY,
    RENDER_REQUEST_CAPABILITY,
    SNAPSHOT_REGISTRATION_CAPABILITY,
    definePlugin,
    definePluginRef,
    type PluginSetupContext,
    type SynchronousEditorPlugin,
} from '../../sdk/index.js';
import {
    TransformPluginController,
    resolveTransformOptions,
    type TransformMutationOptions,
    type TransformPluginOptions,
    type TransformPluginState,
} from './transform-controller.js';

export interface TransformPluginApi {
    scale(factor: number, options?: TransformMutationOptions): Promise<void>;
    zoomIn(options?: TransformMutationOptions): Promise<void>;
    zoomOut(options?: TransformMutationOptions): Promise<void>;
    rotate(degrees: number, options?: TransformMutationOptions): Promise<void>;
    flipHorizontal(options?: TransformMutationOptions): Promise<void>;
    flipVertical(options?: TransformMutationOptions): Promise<void>;
    resetImageTransform(options?: TransformMutationOptions): Promise<void>;
    getState(): TransformPluginState;
}

export const transformPluginRef = definePluginRef<TransformPluginApi>('plugin:transform', '1.0.0');

function isTransformState(value: unknown): value is TransformPluginState {
    if (typeof value !== 'object' || value === null) return false;
    const candidate = value as Partial<TransformPluginState>;
    return (
        typeof candidate.scale === 'number' &&
        Number.isFinite(candidate.scale) &&
        candidate.scale > 0 &&
        typeof candidate.rotationDegrees === 'number' &&
        Number.isFinite(candidate.rotationDegrees) &&
        typeof candidate.flipX === 'boolean' &&
        typeof candidate.flipY === 'boolean'
    );
}

export function transformPlugin(
    options: TransformPluginOptions = {},
): SynchronousEditorPlugin<TransformPluginApi, CoreEventMap> {
    const resolved = resolveTransformOptions(options);
    let controller: TransformPluginController | null = null;
    return definePlugin({
        ref: transformPluginRef,
        manifest: {
            id: transformPluginRef.id,
            version: '1.0.0',
            apiVersion: transformPluginRef.apiVersion,
            engine: '^3.0.0',
            requires: [
                { token: CORE_STATUS_CAPABILITY, range: '^1.0.0' },
                { token: FABRIC_RUNTIME_CAPABILITY, range: '^1.0.0' },
                { token: BASE_IMAGE_READ_CAPABILITY, range: '^1.0.0' },
                { token: RENDER_REQUEST_CAPABILITY, range: '^1.0.0' },
                { token: SNAPSHOT_REGISTRATION_CAPABILITY, range: '^1.0.0' },
                { token: GEOMETRY_MUTATION_CAPABILITY, range: '^1.0.0' },
            ],
            permissions: ['fabric:objects', 'core:geometry-participant'],
        },
        setupMode: 'sync',
        setup(context: PluginSetupContext<CoreEventMap>) {
            const status = context.capabilities.require(CORE_STATUS_CAPABILITY);
            const fabricRuntime = context.capabilities.require(FABRIC_RUNTIME_CAPABILITY);
            const baseImage = context.capabilities.require(BASE_IMAGE_READ_CAPABILITY);
            const render = context.capabilities.require(RENDER_REQUEST_CAPABILITY);
            const state = context.capabilities.require(SNAPSHOT_REGISTRATION_CAPABILITY);
            const geometry = context.capabilities.require(GEOMETRY_MUTATION_CAPABILITY);
            controller = new TransformPluginController(
                Object.freeze({ ...status, ...fabricRuntime }),
                baseImage,
                render,
                geometry,
                resolved,
            );
            for (const id of [
                'transform:scale',
                'transform:zoom-in',
                'transform:zoom-out',
                'transform:rotate',
                'transform:flip-horizontal',
                'transform:flip-vertical',
                'transform:reset',
            ] as const) {
                context.operations.register({
                    id,
                    mode:
                        id.includes('flip') || id === 'transform:reset' ? 'mutation' : 'animation',
                    conflictDomains: ['document', 'base-image', 'geometry', 'overlay', 'state'],
                    reentrancy: 'queue',
                });
            }
            context.disposables.add(
                state.registerSlice({
                    id: transformPluginRef.id,
                    version: 1,
                    capturePolicy: 'always',
                    capture: () =>
                        controller?.getState() ?? {
                            scale: 1,
                            rotationDegrees: 0,
                            flipX: false,
                            flipY: false,
                        },
                    validate: (value: unknown) =>
                        isTransformState(value)
                            ? { valid: true, value }
                            : { valid: false, message: 'Transform state is malformed.' },
                    restore: (value: TransformPluginState) => controller?.restoreState(value),
                    clearState: () => controller?.resetStateFromImage(),
                }),
            );
            const requireController = (): TransformPluginController => {
                if (!controller) throw new Error('Transform plugin is not installed.');
                return controller;
            };
            return Object.freeze({
                scale: (factor: number, mutationOptions?: TransformMutationOptions) =>
                    requireController().scale(factor, mutationOptions),
                zoomIn: (mutationOptions?: TransformMutationOptions) =>
                    requireController().zoomIn(mutationOptions),
                zoomOut: (mutationOptions?: TransformMutationOptions) =>
                    requireController().zoomOut(mutationOptions),
                rotate: (degrees: number, mutationOptions?: TransformMutationOptions) =>
                    requireController().rotate(degrees, mutationOptions),
                flipHorizontal: (mutationOptions?: TransformMutationOptions) =>
                    requireController().flipHorizontal(mutationOptions),
                flipVertical: (mutationOptions?: TransformMutationOptions) =>
                    requireController().flipVertical(mutationOptions),
                resetImageTransform: (mutationOptions?: TransformMutationOptions) =>
                    requireController().resetImageTransform(mutationOptions),
                getState: () => requireController().getState(),
            });
        },
        onImageLoaded() {
            controller?.resetStateFromImage();
        },
        onImageCleared() {
            controller?.resetStateFromImage();
        },
        onDispose() {
            controller?.dispose();
            controller = null;
        },
    });
}

export type {
    ResolvedTransformPluginOptions,
    TransformPluginOptions,
    TransformMutationOptions,
    TransformPluginState,
} from './transform-controller.js';
