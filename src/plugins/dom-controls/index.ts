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
    const bindings: Array<DomPluginBinding<unknown> | undefined> = [
        options.transform?.plugin,
        options.history?.plugin,
        options.masks?.plugin,
        options.filters?.plugin,
        options.crop?.plugin,
        options.mosaic?.plugin,
        options.annotations?.plugin,
        options.text?.plugin,
        options.shape?.plugin,
        options.draw?.plugin,
        options.keyboard?.overlays,
    ];
    const dependencies = new Map<string, PluginRef<unknown>>();
    for (const binding of bindings) {
        if (!binding) continue;
        if (!binding.ref || typeof binding.resolve !== 'function') {
            throw new DomControlsConfigurationError(
                'Each configured DOM section requires a PluginRef and API resolver.',
            );
        }
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
