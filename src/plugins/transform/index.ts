import {
    CORE_HOST_CAPABILITY,
    CORE_STATE_CAPABILITY,
    GEOMETRY_CAPABILITY,
} from '../../core-runtime/internal-capabilities.js';
import type { CoreEventMap } from '../../core-runtime/public-types.js';
import {
    definePluginRef,
    type PluginSetupContext,
    type SynchronousEditorPlugin,
} from '../../plugin-kernel/index.js';
import {
    TransformPluginController,
    resolveTransformOptions,
    type TransformPluginOptions,
    type TransformPluginState,
} from './transform-controller.js';

export interface TransformPluginApi {
    scale(factor: number): Promise<void>;
    zoomIn(): Promise<void>;
    zoomOut(): Promise<void>;
    rotate(degrees: number): Promise<void>;
    flipHorizontal(): Promise<void>;
    flipVertical(): Promise<void>;
    resetImageTransform(): Promise<void>;
    /** @internal Runtime alias retained for the source-level PoC tests. */
    reset(): Promise<void>;
    getState(): TransformPluginState;
    /** @internal Used only by the v2 compatibility facade. */
    synchronizeCompatibilityState(state: TransformPluginState): void;
}

export const transformPluginRef = definePluginRef<TransformPluginApi>(
    '@bensitu/transform',
    '1.0.0',
);

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
    return Object.freeze({
        ref: transformPluginRef,
        version: '1.0.0',
        setupMode: 'sync',
        requires: [
            { token: CORE_HOST_CAPABILITY, range: '^1.0.0' },
            { token: CORE_STATE_CAPABILITY, range: '^1.0.0' },
            { token: GEOMETRY_CAPABILITY, range: '^1.0.0' },
        ],
        setup(context: PluginSetupContext<CoreEventMap>) {
            const host = context.capabilities.require(CORE_HOST_CAPABILITY);
            const state = context.capabilities.require(CORE_STATE_CAPABILITY);
            const geometry = context.capabilities.require(GEOMETRY_CAPABILITY);
            controller = new TransformPluginController(host, geometry, resolved);
            for (const [id, mode] of [
                ['transform:scale', 'animation'],
                ['transform:zoom-in', 'animation'],
                ['transform:zoom-out', 'animation'],
                ['transform:rotate', 'animation'],
                ['transform:flip-horizontal', 'busy'],
                ['transform:flip-vertical', 'busy'],
                ['transform:reset', 'animation'],
            ] as const) {
                context.operations.register({ id, mode });
            }
            context.addDisposable(
                state.slices.register({
                    id: transformPluginRef.id,
                    version: 1,
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
                scale: (factor: number) => requireController().scale(factor),
                zoomIn: () => requireController().zoomIn(),
                zoomOut: () => requireController().zoomOut(),
                rotate: (degrees: number) => requireController().rotate(degrees),
                flipHorizontal: () => requireController().flipHorizontal(),
                flipVertical: () => requireController().flipVertical(),
                resetImageTransform: () => requireController().resetImageTransform(),
                reset: () => requireController().resetImageTransform(),
                getState: () => requireController().getState(),
                synchronizeCompatibilityState: (state: TransformPluginState) =>
                    requireController().restoreState(state),
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
    TransformPluginState,
} from './transform-controller.js';
