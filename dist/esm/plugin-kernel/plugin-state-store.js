import { createDisposable } from './disposable.js';
import { InvalidPluginDefinitionError, PluginKernelDisposedError } from './errors.js';
function assertStateKey(key) {
    if (key.trim().length === 0 || key.trim() !== key) {
        throw new InvalidPluginDefinitionError('Plugin state keys must be non-empty trimmed strings.');
    }
}
export class PluginStateStore {
    constructor() {
        Object.defineProperty(this, "stateByPlugin", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "activePluginIds", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Set()
        });
        Object.defineProperty(this, "disposed", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
    }
    createScoped(pluginId, registerCleanup, registerFinalizer, isScopeActive) {
        this.assertActive('create plugin state');
        if (this.activePluginIds.has(pluginId)) {
            throw new InvalidPluginDefinitionError(`Plugin state scope "${pluginId}" is already active.`, pluginId);
        }
        this.activePluginIds.add(pluginId);
        let active = true;
        let cleanupRegistered = false;
        const cleanup = createDisposable(() => {
            this.stateByPlugin.delete(pluginId);
        });
        try {
            registerFinalizer(createDisposable(() => {
                this.stateByPlugin.delete(pluginId);
                this.activePluginIds.delete(pluginId);
                active = false;
            }));
        }
        catch (error) {
            this.activePluginIds.delete(pluginId);
            throw error;
        }
        const assertScopedActive = () => {
            this.assertActive('access plugin state');
            if (!active || !isScopeActive()) {
                throw new PluginKernelDisposedError(`access state for plugin "${pluginId}"`);
            }
        };
        const activate = () => {
            assertScopedActive();
            if (!cleanupRegistered) {
                registerCleanup(cleanup);
                cleanupRegistered = true;
            }
            let namespace = this.stateByPlugin.get(pluginId);
            if (!namespace) {
                namespace = new Map();
                this.stateByPlugin.set(pluginId, namespace);
            }
            return namespace;
        };
        return Object.freeze({
            has: (key) => {
                var _a, _b;
                assertStateKey(key);
                assertScopedActive();
                return (_b = (_a = this.stateByPlugin.get(pluginId)) === null || _a === void 0 ? void 0 : _a.has(key)) !== null && _b !== void 0 ? _b : false;
            },
            get: (key) => {
                var _a;
                assertStateKey(key);
                assertScopedActive();
                return (_a = this.stateByPlugin.get(pluginId)) === null || _a === void 0 ? void 0 : _a.get(key);
            },
            set: (key, value) => {
                assertStateKey(key);
                activate().set(key, value);
            },
            delete: (key) => {
                var _a, _b;
                assertStateKey(key);
                assertScopedActive();
                return (_b = (_a = this.stateByPlugin.get(pluginId)) === null || _a === void 0 ? void 0 : _a.delete(key)) !== null && _b !== void 0 ? _b : false;
            },
            clear: () => {
                var _a;
                assertScopedActive();
                (_a = this.stateByPlugin.get(pluginId)) === null || _a === void 0 ? void 0 : _a.clear();
            },
        });
    }
    hasPluginState(pluginId) {
        this.assertActive('inspect plugin state');
        return this.stateByPlugin.has(pluginId);
    }
    dispose() {
        if (this.disposed)
            return;
        this.stateByPlugin.clear();
        this.activePluginIds.clear();
        this.disposed = true;
    }
    assertActive(operation) {
        if (this.disposed)
            throw new PluginKernelDisposedError(operation);
    }
}
//# sourceMappingURL=plugin-state-store.js.map