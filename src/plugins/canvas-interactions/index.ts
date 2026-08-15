/**
 * Publishes the optional Canvas Interactions Plugin and its public contracts.
 *
 * @module
 */

import type { CoreEventMap } from '../../core/index.js';
import {
    BASE_IMAGE_READ_CAPABILITY,
    CANVAS_READ_CAPABILITY,
    CORE_DIAGNOSTICS_CAPABILITY,
    definePlugin,
    definePluginRef,
    type PluginRef,
    type PluginSetupContext,
    type SynchronousEditorPlugin,
} from '../../sdk/index.js';
import { CanvasInteractionsController } from './canvas-interactions-controller.js';
import { CanvasInteractionsConfigurationError } from './canvas-interactions-error.js';
import { createCanvasInteractionBindings } from './bindings/create-bindings.js';
import type {
    CanvasInteractionsPluginApi,
    CanvasInteractionsPluginOptions,
    CanvasPluginBinding,
} from './canvas-interactions-types.js';

export const canvasInteractionsPluginRef = definePluginRef<CanvasInteractionsPluginApi>(
    'plugin:canvas-interactions',
    '1.0.0',
);

function collectPluginDependencies(
    options: CanvasInteractionsPluginOptions,
): readonly PluginRef<unknown>[] {
    if (typeof options !== 'object' || options === null || Array.isArray(options)) {
        throw new CanvasInteractionsConfigurationError(
            'Canvas Interactions options must be an object.',
        );
    }
    const bindings: CanvasPluginBinding<unknown>[] = [];
    const addBinding = (value: unknown, label: string): void => {
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
            throw new CanvasInteractionsConfigurationError(
                `${label} requires a PluginRef and API resolver.`,
            );
        }
        const binding = value as Partial<CanvasPluginBinding<unknown>>;
        if (!binding.ref || typeof binding.resolve !== 'function') {
            throw new CanvasInteractionsConfigurationError(
                `${label} requires a PluginRef and API resolver.`,
            );
        }
        bindings.push(binding as CanvasPluginBinding<unknown>);
    };
    const addSection = (value: unknown, label: string, bindingNames: readonly string[]): void => {
        if (value === undefined || value === false) return;
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
            throw new CanvasInteractionsConfigurationError(`${label} must be an object or false.`);
        }
        const section = value as Record<string, unknown>;
        for (const bindingName of bindingNames) {
            addBinding(section[bindingName], `${label}.${bindingName}`);
        }
    };
    addSection(options.text, 'text', ['plugin', 'overlays', 'annotations']);
    addSection(options.shape, 'shape', ['plugin']);
    addSection(options.draw, 'draw', ['plugin']);
    addSection(options.mosaic, 'mosaic', ['plugin']);
    const dependencies = new Map<string, PluginRef<unknown>>();
    for (const binding of bindings) {
        const existing = dependencies.get(binding.ref.id);
        if (existing && existing !== binding.ref) {
            throw new CanvasInteractionsConfigurationError(
                `Canvas Interactions received conflicting PluginRef objects for "${binding.ref.id}".`,
            );
        }
        dependencies.set(binding.ref.id, binding.ref);
    }
    return Object.freeze([...dependencies.values()]);
}

export function canvasInteractionsPlugin(
    options: CanvasInteractionsPluginOptions = {},
): SynchronousEditorPlugin<CanvasInteractionsPluginApi, CoreEventMap> {
    const requiresPlugins = collectPluginDependencies(options);
    let controller: CanvasInteractionsController | null = null;
    return definePlugin({
        ref: canvasInteractionsPluginRef,
        manifest: {
            id: canvasInteractionsPluginRef.id,
            version: '1.0.0',
            apiVersion: canvasInteractionsPluginRef.apiVersion,
            engine: '^3.0.0',
            requiresPlugins,
            requires: [
                { token: CANVAS_READ_CAPABILITY, range: '^1.0.0' },
                { token: BASE_IMAGE_READ_CAPABILITY, range: '^1.0.0' },
                { token: CORE_DIAGNOSTICS_CAPABILITY, range: '^1.0.0' },
            ],
            permissions: ['fabric:canvas-read', 'fabric:global-mutation'],
        },
        setupMode: 'sync',
        setup(context: PluginSetupContext<CoreEventMap>) {
            controller = new CanvasInteractionsController(
                Object.freeze({
                    ...context.capabilities.require(CANVAS_READ_CAPABILITY),
                    ...context.capabilities.require(BASE_IMAGE_READ_CAPABILITY),
                    ...context.capabilities.require(CORE_DIAGNOSTICS_CAPABILITY),
                }),
                context.tools,
                options,
                createCanvasInteractionBindings(options),
            );
            context.disposables.add(controller);
            context.disposables.add(
                context.events.on('state:loaded', () =>
                    controller?.invalidateLifecycle('state-loaded'),
                ),
            );
            return controller;
        },
        onInit() {
            controller?.refresh();
        },
        onImageLoaded() {
            controller?.invalidateLifecycle('image-replaced');
            controller?.refresh();
        },
        onImageCleared() {
            controller?.invalidateLifecycle('image-cleared');
        },
        onDispose() {
            controller?.dispose();
            controller = null;
        },
    });
}

export type {
    CanvasCursorOptions,
    CanvasInteractionErrorContext,
    CanvasInteractionsPluginApi,
    CanvasInteractionsPluginOptions,
    CanvasInteractionsStatus,
    CanvasInteractionsStatusListener,
    CanvasPluginBinding,
    DrawCanvasInteractionOptions,
    InteractionCancelReason,
    MosaicCanvasInteractionOptions,
    ShapeCanvasInteractionOptions,
    TextCanvasInteractionOptions,
} from './canvas-interactions-types.js';
export { CanvasInteractionsConfigurationError } from './canvas-interactions-error.js';

export default canvasInteractionsPlugin;
