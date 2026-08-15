import { CORE_DIAGNOSTICS_CAPABILITY, definePlugin, definePluginRef, } from '../../sdk/index.js';
import { DomControlsConfigurationError, DomControlsController } from './dom-controls-controller.js';
export const domControlsPluginRef = definePluginRef('plugin:dom-controls', '1.0.0');
function collectPluginDependencies(options) {
    var _a;
    if (typeof options !== 'object' || options === null || Array.isArray(options)) {
        throw new DomControlsConfigurationError('DOM Controls options must be an object.');
    }
    const bindings = [];
    const addBinding = (value, label) => {
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
            throw new DomControlsConfigurationError(`${label} requires a PluginRef and API resolver.`);
        }
        const binding = value;
        if (!binding.ref || typeof binding.resolve !== 'function') {
            throw new DomControlsConfigurationError(`${label} requires a PluginRef and API resolver.`);
        }
        bindings.push(binding);
    };
    const addSection = (value, label) => {
        if (value === undefined)
            return;
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
            throw new DomControlsConfigurationError(`${label} must be an object.`);
        }
        addBinding(value.plugin, `${label}.plugin`);
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
    if (((_a = options.keyboard) === null || _a === void 0 ? void 0 : _a.overlays) !== undefined) {
        addBinding(options.keyboard.overlays, 'keyboard.overlays');
    }
    const dependencies = new Map();
    for (const binding of bindings) {
        const existing = dependencies.get(binding.ref.id);
        if (existing && existing !== binding.ref) {
            throw new DomControlsConfigurationError(`DOM Controls received conflicting PluginRef objects for "${binding.ref.id}".`);
        }
        dependencies.set(binding.ref.id, binding.ref);
    }
    return Object.freeze([...dependencies.values()]);
}
export function domControlsPlugin(options = {}) {
    const requiresPlugins = collectPluginDependencies(options);
    let configuredOptions = options;
    let controller = null;
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
        setup(context) {
            if (!configuredOptions) {
                throw new DomControlsConfigurationError('DOM Controls options are unavailable.');
            }
            controller = new DomControlsController(configuredOptions, context.capabilities.require(CORE_DIAGNOSTICS_CAPABILITY));
            configuredOptions = null;
            context.disposables.add(controller);
            for (const operationId of ['dom-controls:bind', 'dom-controls:refresh']) {
                context.disposables.add(context.operations.register({
                    id: operationId,
                    mode: 'busy',
                    conflictDomains: ['state'],
                    reentrancy: 'queue',
                }));
            }
            for (const eventName of [
                'document:committed',
                'geometry:committed',
                'image:loaded',
                'image:cleared',
                'state:loaded',
            ]) {
                context.disposables.add(context.events.on(eventName, () => controller === null || controller === void 0 ? void 0 : controller.refreshFromRuntime()));
            }
            const requireController = () => {
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
            controller === null || controller === void 0 ? void 0 : controller.bind();
        },
        onDispose() {
            controller === null || controller === void 0 ? void 0 : controller.dispose();
            configuredOptions = null;
        },
    });
}
export { DomControlsConfigurationError } from './dom-controls-controller.js';
//# sourceMappingURL=index.js.map