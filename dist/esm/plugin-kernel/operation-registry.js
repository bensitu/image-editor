import { createDisposable } from './disposable.js';
import { OperationConflictError, OperationRegistrationError, PluginKernelDisposedError, } from './errors.js';
export class OperationRegistry {
    constructor() {
        Object.defineProperty(this, "operations", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "activeToken", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "disposed", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
    }
    register(definition, ownerPluginId) {
        this.assertActive('register an operation');
        if (definition.id.trim().length === 0 || definition.id.trim() !== definition.id) {
            throw new OperationRegistrationError('Operation id must be a non-empty trimmed string.', ownerPluginId);
        }
        if (!['idle', 'busy', 'animation'].includes(definition.mode)) {
            throw new OperationRegistrationError(`Operation "${definition.id}" has invalid mode "${definition.mode}".`, ownerPluginId);
        }
        const existing = this.operations.get(definition.id);
        if (existing) {
            throw new OperationRegistrationError(`Operation "${definition.id}" is already registered by "${existing.ownerPluginId}".`, ownerPluginId);
        }
        const frozenDefinition = Object.freeze({
            ...definition,
            allowedDuringTool: definition.allowedDuringTool
                ? Object.freeze([...definition.allowedDuringTool])
                : undefined,
        });
        const record = { definition: frozenDefinition, ownerPluginId };
        this.operations.set(definition.id, record);
        return createDisposable(() => {
            var _a;
            if (this.operations.get(definition.id) !== record)
                return;
            if (((_a = this.activeToken) === null || _a === void 0 ? void 0 : _a.id) === definition.id)
                this.activeToken.dispose();
            this.operations.delete(definition.id);
        });
    }
    begin(operationId, ownerPluginId) {
        this.assertActive('begin an operation');
        const registered = this.operations.get(operationId);
        if (!registered) {
            throw new OperationConflictError(`Operation "${operationId}" is not registered.`, ownerPluginId);
        }
        if (registered.ownerPluginId !== ownerPluginId) {
            throw new OperationConflictError(`Operation "${operationId}" belongs to "${registered.ownerPluginId}", not "${ownerPluginId}".`, ownerPluginId);
        }
        if (this.activeToken) {
            throw new OperationConflictError(`Operation "${operationId}" cannot start while "${this.activeToken.id}" is active.`, ownerPluginId);
        }
        let active = true;
        const token = {
            id: operationId,
            ownerPluginId,
            get active() {
                return active;
            },
            dispose: () => {
                if (!active)
                    return;
                active = false;
                if (this.activeToken === token)
                    this.activeToken = null;
            },
        };
        this.activeToken = Object.freeze(token);
        return this.activeToken;
    }
    get(operationId) {
        var _a, _b;
        this.assertActive('inspect an operation');
        return (_b = (_a = this.operations.get(operationId)) === null || _a === void 0 ? void 0 : _a.definition) !== null && _b !== void 0 ? _b : null;
    }
    isActive(operationId) {
        var _a;
        this.assertActive('inspect operation state');
        return operationId ? ((_a = this.activeToken) === null || _a === void 0 ? void 0 : _a.id) === operationId : this.activeToken !== null;
    }
    dispose() {
        var _a;
        if (this.disposed)
            return;
        (_a = this.activeToken) === null || _a === void 0 ? void 0 : _a.dispose();
        this.activeToken = null;
        this.operations.clear();
        this.disposed = true;
    }
    assertActive(operation) {
        if (this.disposed)
            throw new PluginKernelDisposedError(operation);
    }
}
//# sourceMappingURL=operation-registry.js.map