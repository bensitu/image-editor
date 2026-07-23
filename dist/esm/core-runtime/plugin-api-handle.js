import { CoreRuntimeError } from './errors.js';
export function isProxyablePluginApi(value) {
    return (typeof value === 'object' && value !== null) || typeof value === 'function';
}
export class StablePluginApiHandle {
    constructor(pluginId, initialTarget, assertAvailable) {
        Object.defineProperty(this, "pluginId", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: pluginId
        });
        Object.defineProperty(this, "assertAvailable", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: assertAvailable
        });
        Object.defineProperty(this, "target", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "methodWrappers", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "api", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.target = initialTarget;
        const shadowTarget = typeof initialTarget === 'function'
            ? function stablePluginApi() { }
            : Object.create(null);
        this.api = new Proxy(shadowTarget, {
            apply: (shadow, thisArgument, argumentsList) => {
                void shadow;
                const target = this.requireTarget();
                if (typeof target !== 'function') {
                    throw this.incompatibleReplayError('is no longer callable');
                }
                return Reflect.apply(target, thisArgument, argumentsList);
            },
            construct: (shadow, argumentsList, newTarget) => {
                void shadow;
                const target = this.requireTarget();
                if (typeof target !== 'function') {
                    throw this.incompatibleReplayError('is no longer constructable');
                }
                return Reflect.construct(target, argumentsList, newTarget);
            },
            deleteProperty: (shadow, property) => {
                void shadow;
                return Reflect.deleteProperty(this.requireTarget(), property);
            },
            get: (shadow, property) => {
                void shadow;
                if (property === 'then' && (!this.target || !Reflect.has(this.target, property))) {
                    return undefined;
                }
                const target = this.requireTarget();
                const value = Reflect.get(target, property, target);
                if (typeof value !== 'function')
                    return value;
                return this.getMethodWrapper(property);
            },
            has: (shadow, property) => {
                void shadow;
                return Reflect.has(this.requireTarget(), property);
            },
            set: (shadow, property, value) => {
                void shadow;
                const target = this.requireTarget();
                return Reflect.set(target, property, value, target);
            },
        });
    }
    assertCompatible(nextTarget) {
        if (typeof nextTarget !== typeof this.api) {
            throw this.incompatibleReplayError('changed between callable and object forms');
        }
    }
    update(nextTarget) {
        this.assertCompatible(nextTarget);
        this.target = nextTarget;
    }
    clear() {
        this.target = null;
    }
    getMethodWrapper(property) {
        const existing = this.methodWrappers.get(property);
        if (existing)
            return existing;
        const wrapper = (...args) => {
            const target = this.requireTarget();
            const method = Reflect.get(target, property, target);
            if (typeof method !== 'function') {
                throw this.incompatibleReplayError(`no longer exposes method "${String(property)}"`);
            }
            return Reflect.apply(method, target, args);
        };
        this.methodWrappers.set(property, wrapper);
        return wrapper;
    }
    requireTarget() {
        this.assertAvailable(`use Plugin API "${this.pluginId}"`);
        if (!this.target) {
            throw new CoreRuntimeError(`[ImageEditor] Plugin API "${this.pluginId}" is no longer available.`, { code: 'PLUGIN_API_UNAVAILABLE', behavior: 'lifecycle' });
        }
        return this.target;
    }
    incompatibleReplayError(reason) {
        return new CoreRuntimeError(`[ImageEditor] Plugin API "${this.pluginId}" ${reason} during runtime replay.`, { code: 'PLUGIN_API_REPLAY_INCOMPATIBLE', behavior: 'lifecycle' });
    }
}
//# sourceMappingURL=plugin-api-handle.js.map