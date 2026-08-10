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
    const bindings: Array<CanvasPluginBinding<unknown> | undefined> = [
        options.text ? options.text.plugin : undefined,
        options.text ? options.text.overlays : undefined,
        options.text ? options.text.annotations : undefined,
        options.shape ? options.shape.plugin : undefined,
        options.draw ? options.draw.plugin : undefined,
        options.mosaic ? options.mosaic.plugin : undefined,
    ];
    const dependencies = new Map<string, PluginRef<unknown>>();
    for (const binding of bindings) {
        if (!binding) continue;
        if (!binding.ref || typeof binding.resolve !== 'function') {
            throw new TypeError(
                '[ImageEditor] Each Canvas interaction requires a PluginRef and API resolver.',
            );
        }
        const existing = dependencies.get(binding.ref.id);
        if (existing && existing !== binding.ref) {
            throw new TypeError(
                `[ImageEditor] Canvas Interactions received conflicting PluginRef objects for "${binding.ref.id}".`,
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
                    ...context.capabilities.require(CORE_DIAGNOSTICS_CAPABILITY),
                }),
            );
            context.disposables.add(controller);
            return controller;
        },
        onInit() {
            controller?.refresh();
        },
        onImageLoaded() {
            controller?.refresh();
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

export default canvasInteractionsPlugin;
