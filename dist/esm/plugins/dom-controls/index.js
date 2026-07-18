import { CORE_DIAGNOSTICS_CAPABILITY, definePlugin, definePluginRef, } from '../../sdk/index.js';
import { DomControlsConfigurationError, DomControlsController } from './dom-controls-controller.js';
export const domControlsPluginRef = definePluginRef('plugin:dom-controls', '1.0.0');
function collectPluginDependencies(options) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
    const bindings = [
        (_a = options.transform) === null || _a === void 0 ? void 0 : _a.plugin,
        (_b = options.history) === null || _b === void 0 ? void 0 : _b.plugin,
        (_c = options.masks) === null || _c === void 0 ? void 0 : _c.plugin,
        (_d = options.filters) === null || _d === void 0 ? void 0 : _d.plugin,
        (_e = options.crop) === null || _e === void 0 ? void 0 : _e.plugin,
        (_f = options.mosaic) === null || _f === void 0 ? void 0 : _f.plugin,
        (_g = options.annotations) === null || _g === void 0 ? void 0 : _g.plugin,
        (_h = options.text) === null || _h === void 0 ? void 0 : _h.plugin,
        (_j = options.shape) === null || _j === void 0 ? void 0 : _j.plugin,
        (_k = options.draw) === null || _k === void 0 ? void 0 : _k.plugin,
        (_l = options.keyboard) === null || _l === void 0 ? void 0 : _l.overlays,
    ];
    const dependencies = new Map();
    for (const binding of bindings) {
        if (!binding)
            continue;
        if (!binding.ref || typeof binding.resolve !== 'function') {
            throw new DomControlsConfigurationError('Each configured DOM section requires a PluginRef and API resolver.');
        }
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