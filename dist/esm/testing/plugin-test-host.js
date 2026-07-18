import { PluginManager } from '../plugin-kernel/plugin-manager.js';
export function createPluginTestHost(options = {}) {
    var _a;
    const warnings = [];
    const errors = [];
    const manager = new PluginManager({
        warningSink: (warning) => warnings.push(warning),
        errorSink: (error) => errors.push(error),
        hostCapabilities: ((_a = options.hostCapabilities) !== null && _a !== void 0 ? _a : []).map((provider) => ({
            token: provider.token,
            implementation: provider.implementation,
            providerId: provider.providerId,
            requiredPermission: provider.requiredPermission,
        })),
    });
    return Object.freeze({
        get state() {
            return manager.state;
        },
        get warnings() {
            return Object.freeze([...warnings]);
        },
        get errors() {
            return Object.freeze([...errors]);
        },
        install: (plugin) => manager.install(plugin),
        installSync: (plugin) => manager.installSync(plugin),
        get: (ref) => manager.get(ref),
        has: (refOrId) => manager.has(refOrId),
        initialize: () => manager.initialize(),
        initializeSync: () => manager.initializeSync(),
        notifyImageLoaded: (image) => manager.notifyImageLoaded(image),
        notifyImageCleared: () => manager.notifyImageCleared(),
        dispose: () => manager.dispose(),
        disposeSync: () => manager.disposeSync(),
    });
}
//# sourceMappingURL=plugin-test-host.js.map