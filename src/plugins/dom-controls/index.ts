/**
 * Publishes the DOM Controls Plugin factory, configuration error, and binding contracts.
 *
 * @module
 */

import type { CoreEventMap } from '../../core/index.js';
import {
    CORE_DIAGNOSTICS_CAPABILITY,
    definePlugin,
    definePluginRef,
    type PluginRef,
    type PluginSetupContext,
    type SynchronousEditorPlugin,
} from '../../sdk/index.js';
import { DomControlsConfigurationError, DomControlsController } from './dom-controls-controller.js';
import type {
    DomControlsOptions,
    DomControlsPluginApi,
    DomPluginBinding,
} from './dom-controls-types.js';

export const domControlsPluginRef = definePluginRef<DomControlsPluginApi>(
    'plugin:dom-controls',
    '1.0.0',
);

function collectPluginDependencies(options: DomControlsOptions): readonly PluginRef<unknown>[] {
    if (typeof options !== 'object' || options === null || Array.isArray(options)) {
        throw new DomControlsConfigurationError('DOM Controls options must be an object.');
    }
    const bindings: DomPluginBinding<unknown>[] = [];
    const addBinding = (value: unknown, label: string): void => {
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
            throw new DomControlsConfigurationError(
                `${label} requires a PluginRef and API resolver.`,
            );
        }
        const binding = value as Partial<DomPluginBinding<unknown>>;
        if (!binding.ref || typeof binding.resolve !== 'function') {
            throw new DomControlsConfigurationError(
                `${label} requires a PluginRef and API resolver.`,
            );
        }
        bindings.push(binding as DomPluginBinding<unknown>);
    };
    const addSection = (value: unknown, label: string): void => {
        if (value === undefined) return;
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
            throw new DomControlsConfigurationError(`${label} must be an object.`);
        }
        addBinding((value as Record<string, unknown>).plugin, `${label}.plugin`);
    };
    addSection(options.transform, 'transform');
    addSection(options.history, 'history');
    addSection(options.masks, 'masks');
    addSection(options.filters, 'filters');
    addSection(options.crop, 'crop');
    addSection(options.mosaic, 'mosaic');
    addSection(options.annotations, 'annotations');
    addSection(options.text, 'text');
    addSection(options.shape, 'shape');
    addSection(options.draw, 'draw');
    if (options.keyboard?.overlays !== undefined) {
        addBinding(options.keyboard.overlays, 'keyboard.overlays');
    }
    const dependencies = new Map<string, PluginRef<unknown>>();
    for (const binding of bindings) {
        const existing = dependencies.get(binding.ref.id);
        if (existing && existing !== binding.ref) {
            throw new DomControlsConfigurationError(
                `DOM Controls received conflicting PluginRef objects for "${binding.ref.id}".`,
            );
        }
        dependencies.set(binding.ref.id, binding.ref);
    }
    return Object.freeze([...dependencies.values()]);
}

export function domControlsPlugin(
    options: DomControlsOptions = {},
): SynchronousEditorPlugin<DomControlsPluginApi, CoreEventMap> {
    const requiresPlugins = collectPluginDependencies(options);
    let configuredOptions: DomControlsOptions | null = options;
    let controller: DomControlsController | null = null;
    return definePlugin({
        ref: domControlsPluginRef,
        manifest: {
            id: domControlsPluginRef.id,
            version: '1.0.0',
            apiVersion: domControlsPluginRef.apiVersion,
            engine: '^3.0.0',
            requiresPlugins,
            requires: [{ token: CORE_DIAGNOSTICS_CAPABILITY, range: '^1.0.0' }],
        },
        setupMode: 'sync',
        setup(context: PluginSetupContext<CoreEventMap>) {
            if (!configuredOptions) {
                throw new DomControlsConfigurationError('DOM Controls options are unavailable.');
            }
            controller = new DomControlsController(
                configuredOptions,
                context.capabilities.require(CORE_DIAGNOSTICS_CAPABILITY),
            );
            configuredOptions = null;
            context.disposables.add(controller);
            for (const operationId of ['dom-controls:bind', 'dom-controls:refresh']) {
                context.disposables.add(
                    context.operations.register({
                        id: operationId,
                        mode: 'busy',
                        conflictDomains: ['state'],
                        reentrancy: 'queue',
                    }),
                );
            }
            for (const eventName of [
                'document:committed',
                'geometry:committed',
                'image:loaded',
                'image:cleared',
                'state:loaded',
            ] as const) {
                context.disposables.add(
                    context.events.on(eventName, () => controller?.refreshFromRuntime()),
                );
            }
            const requireController = (): DomControlsController => {
                if (!controller) {
                    throw new DomControlsConfigurationError('DOM Controls are not installed.');
                }
                return controller;
            };
            return Object.freeze({
                refresh: () => requireController().refresh(),
                getStatus: () => requireController().getStatus(),
            });
        },
        onInit() {
            controller?.bind();
        },
        onDispose() {
            controller?.dispose();
            configuredOptions = null;
        },
    });
}

export { DomControlsConfigurationError } from './dom-controls-controller.js';
export type {
    AnnotationControls,
    CropControls,
    DomActionErrorEvent,
    DomActionErrorListener,
    DomButtonTarget,
    DomControlsOptions,
    DomControlsPlugin,
    DomControlsPluginApi,
    DomControlsStatus,
    DomElementTarget,
    DomInputTarget,
    DomPluginBinding,
    DomRenderAdapter,
    DrawControls,
    FiltersControls,
    HistoryControls,
    KeyboardControlsOptions,
    MaskControls,
    MosaicControls,
    ShapeControls,
    TextControls,
    TransformControls,
} from './dom-controls-types.js';
