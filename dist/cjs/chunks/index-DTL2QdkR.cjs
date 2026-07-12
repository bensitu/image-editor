'use strict';

var errors = require('./errors-CQdnZvQh.cjs');
var disposable = require('./disposable-Sj4tt6Lk.cjs');
var internalCapabilities = require('./internal-capabilities-DIerpWRs.cjs');

function validateProvider(token, implementation, providerPluginId) {
    var _a, _b;
    if (!internalCapabilities.isCapabilityToken(token) || !internalCapabilities.isValidSemVer(token.version)) {
        throw new internalCapabilities.InvalidCapabilityVersionError((_a = token === null || token === void 0 ? void 0 : token.id) !== null && _a !== void 0 ? _a : 'unknown', (_b = token === null || token === void 0 ? void 0 : token.version) !== null && _b !== void 0 ? _b : '', 'version');
    }
    if (providerPluginId.trim().length === 0 || providerPluginId.trim() !== providerPluginId) {
        throw new internalCapabilities.InvalidPluginDefinitionError(`Capability provider id for "${token.id}" must be a non-empty trimmed string.`, providerPluginId);
    }
    if (implementation === null || implementation === undefined) {
        throw new internalCapabilities.PluginCapabilityError({
            consumerPluginId: providerPluginId,
            capabilityId: token.id,
            requestedRange: token.version,
            installedVersion: token.version,
            providerPluginId,
            reason: 'incomplete',
        });
    }
}
class CapabilityRegistry {
    constructor(options = {}) {
        Object.defineProperty(this, "options", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: options
        });
        Object.defineProperty(this, "providers", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "disposed", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
    }
    provide(token, implementation, providerPluginId) {
        const registration = this.providePending(token, implementation, providerPluginId, Symbol(`capability:${token.id}`));
        registration.commit();
        return registration;
    }
    provideHost(token, implementation, providerPluginId = '@bensitu/core') {
        if (!internalCapabilities.isCapabilityToken(token)) {
            throw new internalCapabilities.InvalidPluginDefinitionError('Host capability must use createCapabilityToken().');
        }
        return this.provide(token, implementation, providerPluginId);
    }
    providePending(token, implementation, providerPluginId, transactionId) {
        this.assertActive('provide a capability');
        validateProvider(token, implementation, providerPluginId);
        const existing = this.providers.get(token.id);
        if (existing) {
            const isSameTransaction = existing.providerPluginId === providerPluginId &&
                existing.transactionId === transactionId &&
                existing.token.version === token.version &&
                Object.is(existing.implementation, implementation);
            if (isSameTransaction) {
                const noop = disposable.createNoopDisposable();
                return {
                    commit: () => {
                        existing.complete = true;
                    },
                    dispose: () => noop.dispose(),
                };
            }
            throw new internalCapabilities.CapabilityConflictError(token.id, existing.providerPluginId, providerPluginId);
        }
        const record = {
            token,
            implementation,
            providerPluginId,
            transactionId,
            complete: false,
        };
        this.providers.set(token.id, record);
        const disposable$1 = disposable.createDisposable(() => {
            if (this.providers.get(token.id) === record)
                this.providers.delete(token.id);
        });
        return {
            commit: () => {
                if (this.providers.get(token.id) === record)
                    record.complete = true;
            },
            dispose: () => disposable$1.dispose(),
        };
    }
    require(requirement, consumerPluginId) {
        const value = this.resolve(requirement, consumerPluginId, false);
        return value;
    }
    optional(requirement, consumerPluginId) {
        const value = this.resolve(requirement, consumerPluginId, true);
        return value;
    }
    requireDefinition(requirement, consumerPluginId) {
        return this.resolve(requirement, consumerPluginId, false);
    }
    optionalDefinition(requirement, consumerPluginId) {
        return this.resolve(requirement, consumerPluginId, true);
    }
    getProviderInfo(tokenOrId) {
        this.assertActive('inspect a capability provider');
        const id = typeof tokenOrId === 'string' ? tokenOrId : tokenOrId.id;
        const record = this.providers.get(id);
        if (!record)
            return null;
        return Object.freeze({
            capabilityId: record.token.id,
            version: record.token.version,
            providerPluginId: record.providerPluginId,
            complete: record.complete,
        });
    }
    has(tokenOrId) {
        return this.getProviderInfo(tokenOrId) !== null;
    }
    dispose() {
        if (this.disposed)
            return;
        this.providers.clear();
        this.disposed = true;
    }
    resolve(requirement, consumerPluginId, optional) {
        var _a, _b, _c;
        this.assertActive('resolve a capability');
        try {
            internalCapabilities.assertCapabilityRequirement(requirement);
        }
        catch (error) {
            throw new internalCapabilities.PluginCapabilityError({
                consumerPluginId,
                capabilityId: (_b = (_a = requirement === null || requirement === void 0 ? void 0 : requirement.token) === null || _a === void 0 ? void 0 : _a.id) !== null && _b !== void 0 ? _b : 'unknown',
                requestedRange: (_c = requirement === null || requirement === void 0 ? void 0 : requirement.range) !== null && _c !== void 0 ? _c : '',
                reason: 'invalid-range',
                cause: error,
            });
        }
        const record = this.providers.get(requirement.token.id);
        if (!record) {
            if (optional)
                return null;
            throw new internalCapabilities.PluginCapabilityError({
                consumerPluginId,
                capabilityId: requirement.token.id,
                requestedRange: requirement.range,
                reason: 'missing',
            });
        }
        if (!record.complete) {
            if (optional)
                return null;
            throw new internalCapabilities.PluginCapabilityError({
                consumerPluginId,
                capabilityId: requirement.token.id,
                requestedRange: requirement.range,
                installedVersion: record.token.version,
                providerPluginId: record.providerPluginId,
                reason: 'incomplete',
            });
        }
        if (!internalCapabilities.satisfiesSemVer(record.token.version, requirement.range)) {
            if (!optional) {
                throw new internalCapabilities.PluginCapabilityError({
                    consumerPluginId,
                    capabilityId: requirement.token.id,
                    requestedRange: requirement.range,
                    installedVersion: record.token.version,
                    providerPluginId: record.providerPluginId,
                    reason: 'incompatible',
                });
            }
            disposable.reportWarningSafely(this.options.warningSink, this.options.errorSink, {
                code: 'OPTIONAL_CAPABILITY_INCOMPATIBLE',
                message: `Optional integration "${requirement.token.id}" was disabled for plugin "${consumerPluginId}" because installed version "${record.token.version}" does not satisfy "${requirement.range}".`,
                pluginId: consumerPluginId,
                details: {
                    capabilityId: requirement.token.id,
                    requestedRange: requirement.range,
                    installedVersion: record.token.version,
                    providerPluginId: record.providerPluginId,
                    optionalIntegrationDisabled: true,
                },
            });
            return null;
        }
        return record.implementation;
    }
    assertActive(operation) {
        if (this.disposed)
            throw new internalCapabilities.PluginKernelDisposedError(operation);
    }
}

class CommittedEventBus {
    constructor(options = {}) {
        Object.defineProperty(this, "options", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: options
        });
        Object.defineProperty(this, "listeners", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "disposed", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
    }
    on(eventName, listener) {
        this.assertActive('register a committed event listener');
        let eventListeners = this.listeners.get(eventName);
        if (!eventListeners) {
            eventListeners = [];
            this.listeners.set(eventName, eventListeners);
        }
        const erasedListener = listener;
        eventListeners.push(erasedListener);
        return disposable.createDisposable(() => {
            const current = this.listeners.get(eventName);
            if (!current)
                return;
            const index = current.indexOf(erasedListener);
            if (index >= 0)
                current.splice(index, 1);
            if (current.length === 0)
                this.listeners.delete(eventName);
        });
    }
    async emitCommitted(eventName, payload) {
        var _a, _b;
        this.assertActive('emit a committed event');
        const snapshot = [...((_a = this.listeners.get(eventName)) !== null && _a !== void 0 ? _a : [])];
        for (let index = 0; index < snapshot.length; index += 1) {
            try {
                await ((_b = snapshot[index]) === null || _b === void 0 ? void 0 : _b.call(snapshot, payload));
            }
            catch (error) {
                disposable.reportWarningSafely(this.options.warningSink, this.options.errorSink, {
                    code: 'COMMITTED_EVENT_LISTENER_FAILED',
                    message: `Committed event listener ${index} for "${eventName}" failed; remaining listeners continued.`,
                    cause: error,
                    details: { eventName, listenerIndex: index },
                });
            }
        }
    }
    listenerCount(eventName) {
        var _a, _b;
        this.assertActive('inspect committed event listeners');
        if (eventName)
            return (_b = (_a = this.listeners.get(eventName)) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0;
        let count = 0;
        for (const listeners of this.listeners.values())
            count += listeners.length;
        return count;
    }
    dispose() {
        if (this.disposed)
            return;
        this.listeners.clear();
        this.disposed = true;
    }
    assertActive(operation) {
        if (this.disposed)
            throw new internalCapabilities.PluginKernelDisposedError(operation);
    }
}

class OperationRegistry {
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
            throw new internalCapabilities.OperationRegistrationError('Operation id must be a non-empty trimmed string.', ownerPluginId);
        }
        if (!['idle', 'busy', 'animation'].includes(definition.mode)) {
            throw new internalCapabilities.OperationRegistrationError(`Operation "${definition.id}" has invalid mode "${definition.mode}".`, ownerPluginId);
        }
        const existing = this.operations.get(definition.id);
        if (existing) {
            throw new internalCapabilities.OperationRegistrationError(`Operation "${definition.id}" is already registered by "${existing.ownerPluginId}".`, ownerPluginId);
        }
        const frozenDefinition = Object.freeze({
            ...definition,
            allowedDuringTool: definition.allowedDuringTool
                ? Object.freeze([...definition.allowedDuringTool])
                : undefined,
        });
        const record = { definition: frozenDefinition, ownerPluginId };
        this.operations.set(definition.id, record);
        return disposable.createDisposable(() => {
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
            throw new internalCapabilities.OperationConflictError(`Operation "${operationId}" is not registered.`, ownerPluginId);
        }
        if (registered.ownerPluginId !== ownerPluginId) {
            throw new internalCapabilities.OperationConflictError(`Operation "${operationId}" belongs to "${registered.ownerPluginId}", not "${ownerPluginId}".`, ownerPluginId);
        }
        if (this.activeToken) {
            throw new internalCapabilities.OperationConflictError(`Operation "${operationId}" cannot start while "${this.activeToken.id}" is active.`, ownerPluginId);
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
    beginForHost(operationId) {
        this.assertActive('begin an operation');
        const registered = this.operations.get(operationId);
        if (!registered) {
            throw new internalCapabilities.OperationConflictError(`Operation "${operationId}" is not registered.`, '@bensitu/core');
        }
        return this.begin(operationId, registered.ownerPluginId);
    }
    has(operationId) {
        this.assertActive('inspect an operation');
        return this.operations.has(operationId);
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
            throw new internalCapabilities.PluginKernelDisposedError(operation);
    }
}

function assertStateKey(key) {
    if (key.trim().length === 0 || key.trim() !== key) {
        throw new internalCapabilities.InvalidPluginDefinitionError('Plugin state keys must be non-empty trimmed strings.');
    }
}
class PluginStateStore {
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
            throw new internalCapabilities.InvalidPluginDefinitionError(`Plugin state scope "${pluginId}" is already active.`, pluginId);
        }
        this.activePluginIds.add(pluginId);
        let active = true;
        let cleanupRegistered = false;
        const cleanup = disposable.createDisposable(() => {
            this.stateByPlugin.delete(pluginId);
        });
        try {
            registerFinalizer(disposable.createDisposable(() => {
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
                throw new internalCapabilities.PluginKernelDisposedError(`access state for plugin "${pluginId}"`);
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
            throw new internalCapabilities.PluginKernelDisposedError(operation);
    }
}

class RegistrationScope {
    constructor(pluginId, options = {}) {
        Object.defineProperty(this, "pluginId", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: pluginId
        });
        Object.defineProperty(this, "options", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: options
        });
        Object.defineProperty(this, "transactionId", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "entries", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "finalizers", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "state", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'open'
        });
        this.transactionId = Symbol(`plugin-install:${pluginId}`);
    }
    get active() {
        return this.state !== 'disposed';
    }
    assertOpen(operation = 'register installation resources') {
        if (this.state !== 'open') {
            throw new internalCapabilities.PluginKernelStateError(operation, `registration-scope:${this.state}`);
        }
    }
    add(disposable) {
        this.assertOpen();
        this.entries.push({ disposable, rollbackOnly: false });
        return disposable;
    }
    addRollback(disposable) {
        this.assertOpen();
        this.entries.push({ disposable, rollbackOnly: true });
        return disposable;
    }
    addFinalizer(disposable) {
        this.assertOpen();
        this.finalizers.push(disposable);
        return disposable;
    }
    addCleanup(cleanup) {
        return this.add(disposable.createDisposable(cleanup));
    }
    commit() {
        var _a;
        this.assertOpen('commit plugin installation');
        for (const entry of this.entries) {
            if (!entry.rollbackOnly && 'commit' in entry.disposable) {
                entry.disposable.commit();
            }
        }
        for (let index = this.entries.length - 1; index >= 0; index -= 1) {
            if ((_a = this.entries[index]) === null || _a === void 0 ? void 0 : _a.rollbackOnly)
                this.entries.splice(index, 1);
        }
        this.state = 'committed';
    }
    async rollback() {
        if (this.state === 'disposed')
            return [];
        const errors = [
            ...(await disposable.disposeInReverse(this.entries.map((entry) => entry.disposable), { pluginId: this.pluginId, ...this.options })),
            ...(await disposable.disposeInReverse(this.finalizers, {
                pluginId: this.pluginId,
                ...this.options,
            })),
        ];
        this.entries.length = 0;
        this.finalizers.length = 0;
        this.state = 'disposed';
        return errors;
    }
    rollbackSync() {
        if (this.state === 'disposed')
            return Object.freeze([]);
        const errors = [
            ...disposable.disposeInReverseSync(this.entries.map((entry) => entry.disposable), { pluginId: this.pluginId, ...this.options }),
            ...disposable.disposeInReverseSync(this.finalizers, {
                pluginId: this.pluginId,
                ...this.options,
            }),
        ];
        this.entries.length = 0;
        this.finalizers.length = 0;
        this.state = 'disposed';
        return Object.freeze(errors);
    }
    async dispose() {
        if (this.state === 'disposed')
            return;
        const errors = [
            ...(await disposable.disposeInReverse(this.entries.map((entry) => entry.disposable), { pluginId: this.pluginId, ...this.options })),
            ...(await disposable.disposeInReverse(this.finalizers, {
                pluginId: this.pluginId,
                ...this.options,
            })),
        ];
        this.entries.length = 0;
        this.finalizers.length = 0;
        this.state = 'disposed';
        if (errors.length > 0) {
            throw new internalCapabilities.PluginAggregateError(`[ImageEditor] Plugin "${this.pluginId}" cleanup failed.`, errors, { pluginId: this.pluginId });
        }
    }
    disposeSync() {
        if (this.state === 'disposed')
            return;
        const errors = this.rollbackSync();
        if (errors.length > 0) {
            throw new internalCapabilities.PluginAggregateError(`[ImageEditor] Plugin "${this.pluginId}" synchronous cleanup failed.`, errors, { pluginId: this.pluginId });
        }
    }
}

class ToolCoordinator {
    constructor(options = {}) {
        Object.defineProperty(this, "options", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: options
        });
        Object.defineProperty(this, "tools", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "active", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "transitioning", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "disposed", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
    }
    register(definition, ownerPluginId) {
        this.assertActive('register a tool');
        if (definition.id.trim().length === 0 || definition.id.trim() !== definition.id) {
            throw new internalCapabilities.ToolRegistrationError('Tool id must be a non-empty trimmed string.', ownerPluginId);
        }
        const existing = this.tools.get(definition.id);
        if (existing) {
            throw new internalCapabilities.ToolRegistrationError(`Tool "${definition.id}" is already registered by "${existing.ownerPluginId}".`, ownerPluginId);
        }
        const record = {
            definition,
            ownerPluginId,
            context: Object.freeze({ toolId: definition.id, ownerPluginId }),
        };
        this.tools.set(definition.id, record);
        return disposable.createDisposable(() => {
            if (this.active === record) {
                return this.exitCurrent('plugin-dispose').finally(() => {
                    if (this.tools.get(definition.id) === record)
                        this.tools.delete(definition.id);
                });
            }
            if (this.tools.get(definition.id) === record)
                this.tools.delete(definition.id);
            return undefined;
        });
    }
    disposeSync() {
        if (this.disposed)
            return;
        let exitError;
        try {
            const current = this.active;
            this.active = null;
            if (current) {
                const result = current.definition.exit('host-dispose', current.context);
                if (disposable.isPromiseLike(result)) {
                    void Promise.resolve(result).catch((error) => {
                        disposable.reportErrorSafely(this.options.errorSink, error);
                    });
                    throw new internalCapabilities.ToolTransitionError(current.definition.id, 'returned a Promise during synchronous host disposal', current.ownerPluginId);
                }
            }
        }
        catch (error) {
            exitError = error;
        }
        finally {
            this.active = null;
            this.tools.clear();
            this.disposed = true;
        }
        if (exitError)
            throw exitError;
    }
    async enter(toolId, requesterPluginId) {
        this.assertActive('enter a tool');
        const next = this.tools.get(toolId);
        if (!next)
            throw new internalCapabilities.ToolTransitionError(toolId, 'is not registered', requesterPluginId);
        if (requesterPluginId && requesterPluginId !== next.ownerPluginId) {
            throw new internalCapabilities.ToolTransitionError(toolId, `belongs to "${next.ownerPluginId}", not "${requesterPluginId}"`, requesterPluginId);
        }
        if (this.active === next)
            return;
        await this.runTransition(toolId, async () => {
            if (this.active)
                await this.exitCurrent('switch');
            try {
                await next.definition.enter(next.context);
                this.active = next;
            }
            catch (error) {
                this.active = null;
                const transitionError = new internalCapabilities.ToolTransitionError(toolId, 'failed to enter', next.ownerPluginId, error);
                disposable.reportErrorSafely(this.options.errorSink, transitionError);
                throw transitionError;
            }
        });
    }
    async exit(reason = 'requested') {
        this.assertActive('exit a tool');
        if (!this.active)
            return;
        await this.runTransition(this.active.definition.id, () => this.exitCurrent(reason));
    }
    getActiveToolId() {
        var _a, _b;
        this.assertActive('inspect active tool state');
        return (_b = (_a = this.active) === null || _a === void 0 ? void 0 : _a.definition.id) !== null && _b !== void 0 ? _b : null;
    }
    canRunOperation(operationId) {
        var _a;
        this.assertActive('check tool operation policy');
        if (!((_a = this.active) === null || _a === void 0 ? void 0 : _a.definition.canRunOperation))
            return true;
        try {
            return this.active.definition.canRunOperation(operationId);
        }
        catch (error) {
            const transitionError = new internalCapabilities.ToolTransitionError(this.active.definition.id, `operation policy failed for "${operationId}"`, this.active.ownerPluginId, error);
            disposable.reportErrorSafely(this.options.errorSink, transitionError);
            return false;
        }
    }
    async dispose() {
        if (this.disposed)
            return;
        let exitError;
        try {
            if (this.active)
                await this.exitCurrent('host-dispose');
        }
        catch (error) {
            exitError = error;
        }
        finally {
            this.active = null;
            this.tools.clear();
            this.disposed = true;
        }
        if (exitError)
            throw exitError;
    }
    async exitCurrent(reason) {
        const current = this.active;
        if (!current)
            return;
        this.active = null;
        try {
            await current.definition.exit(reason, current.context);
        }
        catch (error) {
            const transitionError = new internalCapabilities.ToolTransitionError(current.definition.id, `failed to exit for reason "${reason}"`, current.ownerPluginId, error);
            disposable.reportErrorSafely(this.options.errorSink, transitionError);
            throw transitionError;
        }
    }
    async runTransition(toolId, task) {
        if (this.transitioning) {
            throw new internalCapabilities.ToolTransitionError(toolId, 'cannot transition while another transition is active');
        }
        this.transitioning = true;
        try {
            await task();
        }
        finally {
            this.transitioning = false;
        }
    }
    assertActive(operation) {
        if (this.disposed)
            throw new internalCapabilities.PluginKernelDisposedError(operation);
    }
}

function isPluginApi(value) {
    return (typeof value === 'object' && value !== null) || typeof value === 'function';
}
class PluginManager {
    constructor(options = {}) {
        var _a;
        Object.defineProperty(this, "options", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: options
        });
        Object.defineProperty(this, "capabilityRegistry", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "operationRegistry", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new OperationRegistry()
        });
        Object.defineProperty(this, "toolCoordinator", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "eventBus", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "stateStore", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new PluginStateStore()
        });
        Object.defineProperty(this, "installed", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "installationOrder", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "hostState", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'created'
        });
        Object.defineProperty(this, "topLevelInstallActive", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "disposePromise", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        this.capabilityRegistry = new CapabilityRegistry(options);
        this.toolCoordinator = new ToolCoordinator({ errorSink: options.errorSink });
        this.eventBus = new CommittedEventBus(options);
        for (const provider of (_a = options.hostCapabilities) !== null && _a !== void 0 ? _a : []) {
            this.capabilityRegistry.provideHost(provider.token, provider.implementation, provider.providerId);
        }
    }
    get state() {
        return this.hostState;
    }
    async install(plugin) {
        this.assertCanInstall();
        if (this.topLevelInstallActive) {
            throw new internalCapabilities.PluginKernelStateError('start a concurrent plugin installation', this.hostState);
        }
        this.topLevelInstallActive = true;
        try {
            const outcome = await this.performInstall(plugin, 'strict', []);
            return outcome.api;
        }
        finally {
            this.topLevelInstallActive = false;
        }
    }
    installSync(plugin) {
        this.assertCanInstall();
        if (this.topLevelInstallActive) {
            throw new internalCapabilities.PluginKernelStateError('start a concurrent plugin installation', this.hostState);
        }
        this.topLevelInstallActive = true;
        try {
            const outcome = this.performInstallSync(plugin, 'strict', []);
            return outcome.api;
        }
        finally {
            this.topLevelInstallActive = false;
        }
    }
    get(ref) {
        this.assertUsable('query a plugin');
        const record = this.installed.get(ref.id);
        if (!record || record.refObject !== ref)
            return null;
        return record.api;
    }
    require(ref) {
        const api = this.get(ref);
        if (api === null)
            throw new internalCapabilities.PluginNotInstalledError(ref.id);
        return api;
    }
    getById(pluginId) {
        var _a, _b;
        this.assertUsable('query a plugin by id');
        return (_b = (_a = this.installed.get(pluginId)) === null || _a === void 0 ? void 0 : _a.api) !== null && _b !== void 0 ? _b : null;
    }
    has(refOrId) {
        this.assertUsable('inspect installed plugins');
        if (typeof refOrId === 'string')
            return this.installed.has(refOrId);
        const record = this.installed.get(refOrId.id);
        return (record === null || record === void 0 ? void 0 : record.refObject) === refOrId;
    }
    hasOperation(operationId) {
        return this.operationRegistry.has(operationId);
    }
    registerHostOperation(definition) {
        this.assertCanInstall();
        return this.operationRegistry.register(definition, '@bensitu/core');
    }
    beginOperationForHost(operationId) {
        if (!this.toolCoordinator.canRunOperation(operationId)) {
            throw new internalCapabilities.PluginKernelStateError(`run operation "${operationId}" while the active tool rejects it`, this.hostState);
        }
        return this.operationRegistry.beginForHost(operationId);
    }
    emitCommitted(eventName, payload) {
        return this.eventBus.emitCommitted(eventName, payload);
    }
    async initialize() {
        var _a;
        this.assertUsable('initialize the Plugin Kernel');
        if (this.hostState !== 'created' || this.topLevelInstallActive) {
            throw new internalCapabilities.PluginKernelStateError('initialize the Plugin Kernel', this.hostState);
        }
        this.hostState = 'initializing';
        try {
            for (const pluginId of this.installationOrder) {
                const record = this.installed.get(pluginId);
                if (!(record === null || record === void 0 ? void 0 : record.plugin.onInit))
                    continue;
                try {
                    await record.plugin.onInit(record.lifecycleContext);
                }
                catch (error) {
                    throw new internalCapabilities.PluginLifecycleError(pluginId, 'init', error);
                }
            }
            this.hostState = 'initialized';
        }
        catch (error) {
            this.hostState = 'disposing';
            const cleanupErrors = await this.cleanupAll();
            this.hostState = 'disposed';
            const lifecycleError = error instanceof internalCapabilities.PluginLifecycleError
                ? error
                : new internalCapabilities.PluginLifecycleError('plugin-kernel', 'init', error);
            throw new internalCapabilities.PluginLifecycleError((_a = lifecycleError.pluginId) !== null && _a !== void 0 ? _a : 'plugin-kernel', 'init', lifecycleError.cause, cleanupErrors);
        }
    }
    initializeSync() {
        var _a;
        this.assertUsable('initialize the Plugin Kernel');
        if (this.hostState !== 'created' || this.topLevelInstallActive) {
            throw new internalCapabilities.PluginKernelStateError('initialize the Plugin Kernel', this.hostState);
        }
        this.hostState = 'initializing';
        try {
            for (const pluginId of this.installationOrder) {
                const record = this.installed.get(pluginId);
                if (!(record === null || record === void 0 ? void 0 : record.plugin.onInit))
                    continue;
                const result = record.plugin.onInit(record.lifecycleContext);
                if (disposable.isPromiseLike(result)) {
                    throw new internalCapabilities.PluginLifecycleError(pluginId, 'init', new Error('Synchronous plugin onInit returned a Promise.'));
                }
            }
            this.hostState = 'initialized';
        }
        catch (error) {
            this.hostState = 'disposing';
            const cleanupErrors = this.cleanupAllSync();
            this.hostState = 'disposed';
            const lifecycleError = error instanceof internalCapabilities.PluginLifecycleError
                ? error
                : new internalCapabilities.PluginLifecycleError('plugin-kernel', 'init', error);
            throw new internalCapabilities.PluginLifecycleError((_a = lifecycleError.pluginId) !== null && _a !== void 0 ? _a : 'plugin-kernel', 'init', lifecycleError.cause, cleanupErrors);
        }
    }
    async notifyImageLoaded(image) {
        this.assertLifecycleReady('notify plugins that an image loaded');
        for (const pluginId of this.installationOrder) {
            const record = this.installed.get(pluginId);
            if (!(record === null || record === void 0 ? void 0 : record.plugin.onImageLoaded))
                continue;
            try {
                await record.plugin.onImageLoaded(image, record.lifecycleContext);
            }
            catch (error) {
                throw new internalCapabilities.PluginLifecycleError(pluginId, 'image-loaded', error);
            }
        }
    }
    async notifyImageCleared() {
        this.assertLifecycleReady('notify plugins that an image cleared');
        for (const pluginId of this.installationOrder) {
            const record = this.installed.get(pluginId);
            if (!(record === null || record === void 0 ? void 0 : record.plugin.onImageCleared))
                continue;
            try {
                await record.plugin.onImageCleared(record.lifecycleContext);
            }
            catch (error) {
                throw new internalCapabilities.PluginLifecycleError(pluginId, 'image-cleared', error);
            }
        }
    }
    dispose() {
        var _a;
        if (this.hostState === 'disposed')
            return Promise.resolve();
        if (this.hostState === 'disposing')
            return (_a = this.disposePromise) !== null && _a !== void 0 ? _a : Promise.resolve();
        if (this.hostState === 'initializing') {
            return Promise.reject(new internalCapabilities.PluginKernelStateError('dispose the Plugin Kernel', this.hostState));
        }
        this.hostState = 'disposing';
        this.disposePromise = this.performDispose();
        return this.disposePromise;
    }
    disposeSync() {
        if (this.hostState === 'disposed')
            return;
        if (this.hostState === 'disposing' || this.hostState === 'initializing') {
            throw new internalCapabilities.PluginKernelStateError('dispose the Plugin Kernel synchronously', this.hostState);
        }
        this.hostState = 'disposing';
        const errors = this.cleanupAllSync();
        this.hostState = 'disposed';
        if (errors.length > 0) {
            throw new internalCapabilities.PluginAggregateError('[ImageEditor] Plugin Kernel synchronous disposal completed with cleanup errors.', errors);
        }
    }
    async performInstall(plugin, mode, parentStack) {
        this.validatePluginDefinition(plugin);
        const pluginId = plugin.ref.id;
        if (parentStack.includes(pluginId)) {
            throw new internalCapabilities.InvalidPluginDefinitionError(`Plugin dependency cycle detected: ${[...parentStack, pluginId].join(' -> ')}.`, pluginId);
        }
        const existing = this.installed.get(pluginId);
        if (existing) {
            if (mode === 'strict')
                throw new internalCapabilities.PluginAlreadyInstalledError(pluginId);
            const compatible = existing.plugin.version === plugin.version &&
                existing.plugin.ref.apiVersion === plugin.ref.apiVersion &&
                existing.refObject === plugin.ref;
            if (!compatible) {
                throw new internalCapabilities.PluginVersionMismatchError(pluginId, existing.plugin.version, plugin.version, existing.plugin.ref.apiVersion, plugin.ref.apiVersion);
            }
            return { api: existing.api };
        }
        const { required, optional } = this.resolveCapabilities(plugin);
        const scope = new RegistrationScope(pluginId, this.options);
        const stack = [...parentStack, pluginId];
        try {
            const contexts = this.createContexts(pluginId, scope, required, optional, stack);
            const api = await plugin.setup(contexts.setup);
            if (!isPluginApi(api)) {
                throw new internalCapabilities.InvalidPluginDefinitionError(`Plugin "${pluginId}" setup must return a non-null object or function API.`, pluginId);
            }
            scope.commit();
            const record = {
                plugin,
                refObject: plugin.ref,
                api,
                scope,
                lifecycleContext: contexts.lifecycle,
            };
            this.installed.set(pluginId, record);
            this.installationOrder.push(pluginId);
            return { api };
        }
        catch (error) {
            const cleanupErrors = await scope.rollback();
            throw new internalCapabilities.PluginSetupError(pluginId, error, cleanupErrors);
        }
    }
    performInstallSync(plugin, mode, parentStack) {
        this.validatePluginDefinition(plugin);
        if (plugin.setupMode !== 'sync') {
            throw new internalCapabilities.InvalidPluginDefinitionError(`Plugin "${plugin.ref.id}" must declare setupMode "sync" for installSync().`, plugin.ref.id);
        }
        const pluginId = plugin.ref.id;
        if (parentStack.includes(pluginId)) {
            throw new internalCapabilities.InvalidPluginDefinitionError(`Plugin dependency cycle detected: ${[...parentStack, pluginId].join(' -> ')}.`, pluginId);
        }
        const existing = this.installed.get(pluginId);
        if (existing) {
            if (mode === 'strict')
                throw new internalCapabilities.PluginAlreadyInstalledError(pluginId);
            const compatible = existing.plugin.version === plugin.version &&
                existing.plugin.ref.apiVersion === plugin.ref.apiVersion &&
                existing.refObject === plugin.ref;
            if (!compatible) {
                throw new internalCapabilities.PluginVersionMismatchError(pluginId, existing.plugin.version, plugin.version, existing.plugin.ref.apiVersion, plugin.ref.apiVersion);
            }
            return { api: existing.api };
        }
        const { required, optional } = this.resolveCapabilities(plugin);
        const scope = new RegistrationScope(pluginId, this.options);
        try {
            const contexts = this.createContexts(pluginId, scope, required, optional, [
                ...parentStack,
                pluginId,
            ]);
            const api = plugin.setup(contexts.setup);
            if (disposable.isPromiseLike(api)) {
                throw new internalCapabilities.InvalidPluginDefinitionError(`Plugin "${pluginId}" returned a Promise from synchronous setup.`, pluginId);
            }
            if (!isPluginApi(api)) {
                throw new internalCapabilities.InvalidPluginDefinitionError(`Plugin "${pluginId}" setup must return a non-null object or function API.`, pluginId);
            }
            scope.commit();
            this.installed.set(pluginId, {
                plugin,
                refObject: plugin.ref,
                api,
                scope,
                lifecycleContext: contexts.lifecycle,
            });
            this.installationOrder.push(pluginId);
            return { api };
        }
        catch (error) {
            const cleanupErrors = scope.rollbackSync();
            throw new internalCapabilities.PluginSetupError(pluginId, error, cleanupErrors);
        }
    }
    resolveCapabilities(plugin) {
        var _a, _b;
        const required = new Map();
        const optional = new Map();
        for (const requirement of (_a = plugin.requires) !== null && _a !== void 0 ? _a : []) {
            required.set(requirement.token.id, {
                token: requirement.token,
                value: this.capabilityRegistry.requireDefinition(requirement, plugin.ref.id),
            });
        }
        for (const requirement of (_b = plugin.optional) !== null && _b !== void 0 ? _b : []) {
            optional.set(requirement.token.id, {
                token: requirement.token,
                value: this.capabilityRegistry.optionalDefinition(requirement, plugin.ref.id),
            });
        }
        return { required, optional };
    }
    createContexts(pluginId, scope, required, optional, stack) {
        const state = this.stateStore.createScoped(pluginId, (disposable) => scope.add(disposable), (disposable) => scope.addFinalizer(disposable), () => scope.active);
        const capabilities = Object.freeze({
            require: (token) => {
                const resolved = required.get(token.id);
                if (!resolved || resolved.token !== token) {
                    throw new internalCapabilities.PluginCapabilityError({
                        consumerPluginId: pluginId,
                        capabilityId: token.id,
                        requestedRange: 'undeclared-required-capability',
                        reason: 'missing',
                    });
                }
                return resolved.value;
            },
            optional: (token) => {
                const resolved = optional.get(token.id);
                if (!resolved || resolved.token !== token) {
                    throw new internalCapabilities.PluginCapabilityError({
                        consumerPluginId: pluginId,
                        capabilityId: token.id,
                        requestedRange: 'undeclared-optional-capability',
                        reason: 'missing',
                    });
                }
                return resolved.value;
            },
        });
        const operations = Object.freeze({
            begin: (operationId) => this.operationRegistry.begin(operationId, pluginId),
            get: (operationId) => this.operationRegistry.get(operationId),
            isActive: (operationId) => this.operationRegistry.isActive(operationId),
        });
        const tools = Object.freeze({
            enter: (toolId) => this.toolCoordinator.enter(toolId, pluginId),
            exit: (reason) => this.toolCoordinator.exit(reason),
            getActiveToolId: () => this.toolCoordinator.getActiveToolId(),
            canRunOperation: (operationId) => this.toolCoordinator.canRunOperation(operationId),
        });
        const events = Object.freeze({
            emitCommitted: (eventName, payload) => this.eventBus.emitCommitted(eventName, payload),
        });
        const lifecycle = Object.freeze({
            pluginId,
            state,
            capabilities,
            operations,
            tools,
            events,
        });
        const setupCapabilities = Object.freeze({
            ...capabilities,
            provide: (token, implementation) => {
                scope.assertOpen();
                return scope.add(this.capabilityRegistry.providePending(token, implementation, pluginId, scope.transactionId));
            },
        });
        const setupOperations = Object.freeze({
            ...operations,
            register: (definition) => {
                scope.assertOpen();
                return scope.add(this.operationRegistry.register(definition, pluginId));
            },
        });
        const setupTools = Object.freeze({
            ...tools,
            register: (definition) => {
                scope.assertOpen();
                return scope.add(this.toolCoordinator.register(definition, pluginId));
            },
        });
        const setupEvents = Object.freeze({
            ...events,
            on: (eventName, listener) => {
                scope.assertOpen();
                return scope.add(this.eventBus.on(eventName, listener));
            },
        });
        const ensurePluginNow = async (dependency) => {
            scope.assertOpen('ensure a composed plugin dependency');
            const before = new Set(this.installationOrder);
            const outcome = await this.performInstall(dependency, 'ensure', stack);
            const newlyInstalled = this.installationOrder.filter((id) => !before.has(id));
            for (const installedPluginId of newlyInstalled) {
                scope.addRollback(disposable.createDisposable(() => this.rollbackInstalledPlugin(installedPluginId)));
            }
            return outcome.api;
        };
        let ensureQueue = Promise.resolve();
        const ensurePlugin = (dependency) => {
            const result = ensureQueue.then(() => ensurePluginNow(dependency));
            ensureQueue = result.then(() => undefined, () => undefined);
            return result;
        };
        const setup = Object.freeze({
            pluginId,
            state,
            capabilities: setupCapabilities,
            operations: setupOperations,
            tools: setupTools,
            events: setupEvents,
            addDisposable: (disposable) => {
                scope.assertOpen();
                return scope.add(disposable);
            },
            ensure: async (dependency) => {
                const api = await ensurePlugin(dependency);
                return api;
            },
            ensurePlugin,
        });
        return { setup, lifecycle };
    }
    async rollbackInstalledPlugin(pluginId) {
        const record = this.installed.get(pluginId);
        if (!record)
            return;
        this.installed.delete(pluginId);
        const orderIndex = this.installationOrder.lastIndexOf(pluginId);
        if (orderIndex >= 0)
            this.installationOrder.splice(orderIndex, 1);
        const errors = [];
        if (record.plugin.onDispose) {
            try {
                await record.plugin.onDispose(record.lifecycleContext);
            }
            catch (error) {
                errors.push(new internalCapabilities.PluginLifecycleError(pluginId, 'dispose', error));
            }
        }
        try {
            await record.scope.dispose();
        }
        catch (error) {
            errors.push(error);
        }
        if (errors.length > 0) {
            throw new internalCapabilities.PluginAggregateError(`[ImageEditor] Rollback of composed plugin "${pluginId}" failed.`, errors, { pluginId });
        }
    }
    validatePluginDefinition(plugin) {
        if (typeof plugin !== 'object' || plugin === null) {
            throw new internalCapabilities.InvalidPluginDefinitionError('Plugin definition must be an object.');
        }
        if (!internalCapabilities.isPluginRef(plugin.ref)) {
            throw new internalCapabilities.InvalidPluginDefinitionError('Plugin definition must use a PluginRef created by definePluginRef().');
        }
        if (!internalCapabilities.isValidSemVer(plugin.version)) {
            throw new internalCapabilities.InvalidPluginDefinitionError(`Plugin "${plugin.ref.id}" has invalid implementation SemVer "${plugin.version}".`, plugin.ref.id);
        }
        if (typeof plugin.setup !== 'function') {
            throw new internalCapabilities.InvalidPluginDefinitionError(`Plugin "${plugin.ref.id}" must define setup().`, plugin.ref.id);
        }
        const capabilityIds = new Set();
        const validateRequirements = (requirements, kind) => {
            for (const requirement of requirements !== null && requirements !== void 0 ? requirements : []) {
                try {
                    internalCapabilities.assertCapabilityRequirement(requirement);
                }
                catch (error) {
                    throw new internalCapabilities.InvalidPluginDefinitionError(`Plugin "${plugin.ref.id}" has an invalid ${kind} capability requirement.`, plugin.ref.id, error);
                }
                if (capabilityIds.has(requirement.token.id)) {
                    throw new internalCapabilities.InvalidPluginDefinitionError(`Plugin "${plugin.ref.id}" declares capability "${requirement.token.id}" more than once.`, plugin.ref.id);
                }
                capabilityIds.add(requirement.token.id);
            }
        };
        validateRequirements(plugin.requires, 'required');
        validateRequirements(plugin.optional, 'optional');
    }
    async performDispose() {
        const errors = await this.cleanupAll();
        this.hostState = 'disposed';
        if (errors.length > 0) {
            throw new internalCapabilities.PluginAggregateError('[ImageEditor] Plugin Kernel disposal completed with cleanup errors.', errors);
        }
    }
    async cleanupAll() {
        const errors = [];
        const records = [...this.installationOrder]
            .reverse()
            .map((pluginId) => this.installed.get(pluginId))
            .filter((record) => record !== undefined);
        for (const record of records) {
            if (!record.plugin.onDispose)
                continue;
            try {
                await record.plugin.onDispose(record.lifecycleContext);
            }
            catch (error) {
                const lifecycleError = new internalCapabilities.PluginLifecycleError(record.plugin.ref.id, 'dispose', error);
                errors.push(lifecycleError);
                disposable.reportErrorSafely(this.options.errorSink, lifecycleError);
            }
        }
        for (const record of records) {
            try {
                await record.scope.dispose();
            }
            catch (error) {
                errors.push(error);
                disposable.reportErrorSafely(this.options.errorSink, error);
            }
        }
        this.installed.clear();
        this.installationOrder.length = 0;
        const kernelDisposables = [
            this.toolCoordinator,
            this.operationRegistry,
            this.eventBus,
            this.capabilityRegistry,
            this.stateStore,
        ];
        for (const disposable$1 of kernelDisposables) {
            try {
                await disposable$1.dispose();
            }
            catch (error) {
                errors.push(error);
                disposable.reportErrorSafely(this.options.errorSink, error);
            }
        }
        return errors;
    }
    cleanupAllSync() {
        const errors = [];
        const records = [...this.installationOrder]
            .reverse()
            .map((pluginId) => this.installed.get(pluginId))
            .filter((record) => record !== undefined);
        for (const record of records) {
            if (!record.plugin.onDispose)
                continue;
            try {
                const result = record.plugin.onDispose(record.lifecycleContext);
                if (disposable.isPromiseLike(result)) {
                    void Promise.resolve(result).catch((error) => {
                        disposable.reportErrorSafely(this.options.errorSink, error);
                    });
                    throw new internalCapabilities.PluginLifecycleError(record.plugin.ref.id, 'dispose', new Error('Synchronous plugin onDispose returned a Promise.'));
                }
            }
            catch (error) {
                const lifecycleError = error instanceof internalCapabilities.PluginLifecycleError
                    ? error
                    : new internalCapabilities.PluginLifecycleError(record.plugin.ref.id, 'dispose', error);
                errors.push(lifecycleError);
                disposable.reportErrorSafely(this.options.errorSink, lifecycleError);
            }
        }
        for (const record of records) {
            try {
                record.scope.disposeSync();
            }
            catch (error) {
                errors.push(error);
                disposable.reportErrorSafely(this.options.errorSink, error);
            }
        }
        this.installed.clear();
        this.installationOrder.length = 0;
        const cleanup = [
            () => this.toolCoordinator.disposeSync(),
            () => this.operationRegistry.dispose(),
            () => this.eventBus.dispose(),
            () => this.capabilityRegistry.dispose(),
            () => this.stateStore.dispose(),
        ];
        for (const dispose of cleanup) {
            try {
                dispose();
            }
            catch (error) {
                errors.push(error);
                disposable.reportErrorSafely(this.options.errorSink, error);
            }
        }
        return Object.freeze(errors);
    }
    assertCanInstall() {
        this.assertUsable('install a plugin');
        if (this.hostState !== 'created') {
            throw new internalCapabilities.PluginKernelStateError('install a plugin', this.hostState);
        }
    }
    assertLifecycleReady(operation) {
        this.assertUsable(operation);
        if (this.hostState !== 'initialized') {
            throw new internalCapabilities.PluginKernelStateError(operation, this.hostState);
        }
    }
    assertUsable(operation) {
        if (this.hostState === 'disposed' || this.hostState === 'disposing') {
            throw new internalCapabilities.PluginKernelDisposedError(operation);
        }
    }
}

function forceReflow(element) {
    if (!element)
        return;
    void element.offsetWidth;
}

function selectLayoutStrategy(mode) {
    return mode;
}
class ViewportCache {
    constructor() {
        Object.defineProperty(this, "lastVisible", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
    }
    measure(container, fallback, scrollbarSize) {
        var _a;
        if (!container)
            return fallback;
        const containerWidth = Math.floor(container.clientWidth);
        const containerHeight = Math.floor(container.clientHeight);
        if (containerWidth > 0 && containerHeight > 0) {
            this.lastVisible = measureContainerViewport(container, fallback, scrollbarSize);
            return this.lastVisible;
        }
        return (_a = this.lastVisible) !== null && _a !== void 0 ? _a : fallback;
    }
    peek() {
        return this.lastVisible;
    }
    clear() {
        this.lastVisible = null;
    }
}
const OVERFLOW_EPSILON = 0.5;
function normalizeOverflowValue(value) {
    return String(value !== null && value !== void 0 ? value : '')
        .trim()
        .toLowerCase();
}
function getContainerOverflowValues(container) {
    var _a, _b;
    const style = container.style;
    let computedOverflow = '';
    let computedOverflowX = '';
    let computedOverflowY = '';
    const view = (_b = (_a = container.ownerDocument) === null || _a === void 0 ? void 0 : _a.defaultView) !== null && _b !== void 0 ? _b : (typeof window === 'undefined' ? null : window);
    if (typeof (view === null || view === void 0 ? void 0 : view.getComputedStyle) === 'function') {
        const computed = view.getComputedStyle(container);
        computedOverflow = computed.overflow;
        computedOverflowX = computed.overflowX;
        computedOverflowY = computed.overflowY;
    }
    const x = [
        normalizeOverflowValue(style === null || style === void 0 ? void 0 : style.overflow),
        normalizeOverflowValue(style === null || style === void 0 ? void 0 : style.overflowX),
        normalizeOverflowValue(computedOverflow),
        normalizeOverflowValue(computedOverflowX),
    ];
    const y = [
        normalizeOverflowValue(style === null || style === void 0 ? void 0 : style.overflow),
        normalizeOverflowValue(style === null || style === void 0 ? void 0 : style.overflowY),
        normalizeOverflowValue(computedOverflow),
        normalizeOverflowValue(computedOverflowY),
    ];
    return { x, y, all: [...x, ...y] };
}
function isAutoScrollableOverflow(value) {
    return value === 'auto' || value === 'overlay';
}
function measureScrollbarSize(ownerDocument) {
    const doc = ownerDocument !== null && ownerDocument !== void 0 ? ownerDocument : (typeof document === 'undefined' ? null : document);
    if (!(doc === null || doc === void 0 ? void 0 : doc.body))
        return { width: 0, height: 0 };
    const probe = doc.createElement('div');
    probe.style.position = 'absolute';
    probe.style.left = '-9999px';
    probe.style.top = '-9999px';
    probe.style.width = '100px';
    probe.style.height = '100px';
    probe.style.overflow = 'scroll';
    probe.style.visibility = 'hidden';
    probe.style.pointerEvents = 'none';
    doc.body.appendChild(probe);
    const width = Math.max(0, probe.offsetWidth - probe.clientWidth);
    const height = Math.max(0, probe.offsetHeight - probe.clientHeight);
    probe.remove();
    return { width, height };
}
function normalizeScrollbarSize(scrollbarSize) {
    return {
        width: Math.max(0, Number(scrollbarSize === null || scrollbarSize === void 0 ? void 0 : scrollbarSize.width) || 0),
        height: Math.max(0, Number(scrollbarSize === null || scrollbarSize === void 0 ? void 0 : scrollbarSize.height) || 0),
    };
}
function measureContainerViewport(container, fallback, scrollbarSize) {
    if (!container)
        return fallback;
    const clientWidth = Math.floor(container.clientWidth || 0);
    const clientHeight = Math.floor(container.clientHeight || 0);
    if (clientWidth <= 0 || clientHeight <= 0)
        return fallback;
    const overflow = getContainerOverflowValues(container);
    if (overflow.all.includes('scroll')) {
        return { width: clientWidth, height: clientHeight };
    }
    const scrollbar = normalizeScrollbarSize(scrollbarSize);
    const canAutoScrollX = overflow.x.some(isAutoScrollableOverflow);
    const canAutoScrollY = overflow.y.some(isAutoScrollableOverflow);
    const scrollWidth = Math.ceil(container.scrollWidth || 0);
    const scrollHeight = Math.ceil(container.scrollHeight || 0);
    const hasHorizontalScrollbar = canAutoScrollX && scrollWidth > clientWidth + OVERFLOW_EPSILON;
    const hasVerticalScrollbar = canAutoScrollY && scrollHeight > clientHeight + OVERFLOW_EPSILON;
    return {
        width: clientWidth + (hasVerticalScrollbar ? scrollbar.width : 0),
        height: clientHeight + (hasHorizontalScrollbar ? scrollbar.height : 0),
    };
}
function computeScrollableCanvasSize(contentWidth, contentHeight, viewport, scrollbarSize) {
    const viewportW = Math.max(1, viewport.width || 1);
    const viewportH = Math.max(1, viewport.height || 1);
    const scrollbar = normalizeScrollbarSize(scrollbarSize);
    let hasHorizontal = false;
    let hasVertical = false;
    for (let i = 0; i < 4; i += 1) {
        const effectiveW = Math.max(1, viewportW - (hasVertical ? scrollbar.width : 0));
        const effectiveH = Math.max(1, viewportH - (hasHorizontal ? scrollbar.height : 0));
        const nextHorizontal = contentWidth > effectiveW + OVERFLOW_EPSILON;
        const nextVertical = contentHeight > effectiveH + OVERFLOW_EPSILON;
        if (nextHorizontal === hasHorizontal && nextVertical === hasVertical)
            break;
        hasHorizontal = nextHorizontal;
        hasVertical = nextVertical;
    }
    const effectiveW = Math.max(1, viewportW - (hasVertical ? scrollbar.width : 0));
    const effectiveH = Math.max(1, viewportH - (hasHorizontal ? scrollbar.height : 0));
    return {
        width: hasHorizontal ? Math.ceil(contentWidth) : effectiveW,
        height: hasVertical ? Math.ceil(contentHeight) : effectiveH,
    };
}
function computeFitLayout(imageWidth, imageHeight, optionsCanvasWidth, optionsCanvasHeight, containerSize) {
    const canvasWidth = Math.max(1, (containerSize.width || optionsCanvasWidth) - 1);
    const canvasHeight = Math.max(1, (containerSize.height || optionsCanvasHeight) - 1);
    const fitScale = Math.min(canvasWidth / imageWidth, canvasHeight / imageHeight, 1);
    return {
        canvasWidth,
        canvasHeight,
        imageScale: fitScale,
        imageLeft: 0,
        imageTop: 0,
        baseImageScale: fitScale,
    };
}
function computeCoverLayout(imageWidth, imageHeight, optionsCanvasWidth, optionsCanvasHeight, containerSize, scrollbarSize) {
    const viewportW = containerSize.width || optionsCanvasWidth;
    const viewportH = containerSize.height || optionsCanvasHeight;
    const scrollbar = normalizeScrollbarSize(scrollbarSize);
    let hasHorizontal = false;
    let hasVertical = false;
    let coverScale = 1;
    let scaledW = imageWidth;
    let scaledH = imageHeight;
    for (let i = 0; i < 4; i += 1) {
        const effectiveW = Math.max(1, viewportW - (hasVertical ? scrollbar.width : 0));
        const effectiveH = Math.max(1, viewportH - (hasHorizontal ? scrollbar.height : 0));
        coverScale = Math.min(1, Math.max(effectiveW / imageWidth, effectiveH / imageHeight));
        scaledW = imageWidth * coverScale;
        scaledH = imageHeight * coverScale;
        const nextHasHorizontal = scaledW > effectiveW + OVERFLOW_EPSILON;
        const nextHasVertical = scaledH > effectiveH + OVERFLOW_EPSILON;
        if (nextHasHorizontal === hasHorizontal && nextHasVertical === hasVertical)
            break;
        hasHorizontal = nextHasHorizontal;
        hasVertical = nextHasVertical;
    }
    const canvasSize = computeScrollableCanvasSize(scaledW, scaledH, {
        width: viewportW,
        height: viewportH,
    }, scrollbar);
    return {
        canvasWidth: canvasSize.width,
        canvasHeight: canvasSize.height,
        imageScale: coverScale,
        imageLeft: 0,
        imageTop: 0,
        baseImageScale: coverScale,
    };
}
function computeExpandLayout(imageWidth, imageHeight, containerSize) {
    const canvasWidth = Math.max(containerSize.width, Math.floor(imageWidth));
    const canvasHeight = Math.max(containerSize.height, Math.floor(imageHeight));
    return {
        canvasWidth,
        canvasHeight,
        imageScale: 1,
        imageLeft: 0,
        imageTop: 0,
        baseImageScale: 1,
    };
}
function applyCanvasDimensions(canvas, width, height, containerElement) {
    const integerWidth = Math.max(1, Math.round(Number(width) || 1));
    const integerHeight = Math.max(1, Math.round(Number(height) || 1));
    canvas.setDimensions({ width: integerWidth, height: integerHeight });
    forceReflow(containerElement);
}

function isRecord$1(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isPositiveFinite(value) {
    return typeof value === 'number' && Number.isFinite(value) && value > 0;
}
function isImageMimeType(value) {
    return value === 'image/jpeg' || value === 'image/png' || value === 'image/webp';
}
function isBaseImage(object) {
    return (object.editorObjectKind ===
        'baseImage');
}
class CanvasCoreStateAdapter {
    constructor(access, properties, transientObjects, externalObjects) {
        Object.defineProperty(this, "access", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: access
        });
        Object.defineProperty(this, "properties", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: properties
        });
        Object.defineProperty(this, "transientObjects", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: transientObjects
        });
        Object.defineProperty(this, "externalObjects", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: externalObjects
        });
    }
    capture(context) {
        const canvas = this.access.getCanvas();
        if (!canvas) {
            return {
                initialized: false,
                canvasWidth: 0,
                canvasHeight: 0,
                canvas: null,
                imageMimeType: null,
                baseImageScale: 1,
                geometryRevision: this.access.getGeometryRevision(),
            };
        }
        const serializableCanvas = canvas;
        const serializedValue = serializableCanvas.toJSON(this.properties.listKeys());
        if (!isRecord$1(serializedValue)) {
            throw new errors.SnapshotValidationError('Fabric canvas serialization must be an object.');
        }
        const serialized = { ...serializedValue };
        const serializedObjects = Array.isArray(serialized.objects) ? serialized.objects : [];
        const liveObjects = canvas.getObjects();
        const propertyKeys = this.properties.listKeys();
        for (let index = 0; index < serializedObjects.length; index += 1) {
            const serializedObject = serializedObjects[index];
            const liveObject = liveObjects[index];
            if (!isRecord$1(serializedObject) || !liveObject)
                continue;
            const liveRecord = liveObject;
            for (const key of propertyKeys) {
                if (liveRecord[key] !== undefined)
                    serializedObject[key] = liveRecord[key];
            }
        }
        serialized.objects = serializedObjects.filter((entry, index) => {
            const liveObject = liveObjects[index];
            if (!entry ||
                !liveObject ||
                this.transientObjects.isTransient(liveObject) ||
                this.externalObjects.isTransient(liveObject))
                return false;
            if (context.mode === 'snapshot')
                return isBaseImage(liveObject);
            return true;
        });
        return {
            initialized: true,
            canvasWidth: canvas.getWidth(),
            canvasHeight: canvas.getHeight(),
            canvas: serialized,
            imageMimeType: this.access.getImageMimeType(),
            baseImageScale: this.access.getBaseImageScale(),
            geometryRevision: this.access.getGeometryRevision(),
        };
    }
    async restore(state, context) {
        var _a, _b, _c;
        if (this.access.isDisposed()) {
            throw new Error('Cannot restore Core state after disposal.');
        }
        const validated = this.validateSnapshot(state);
        if (!validated.valid)
            throw new errors.SnapshotValidationError(validated.message, validated.path);
        const next = validated.value;
        if (!next.initialized) {
            const canvas = this.access.getCanvas();
            canvas === null || canvas === void 0 ? void 0 : canvas.clear();
            this.access.setBaseImage(null);
            this.access.setImageMimeType(null);
            this.access.setBaseImageScale(1);
            this.access.setGeometryRevision(next.geometryRevision);
            return;
        }
        if (context.signal.aborted)
            throw (_a = context.signal.reason) !== null && _a !== void 0 ? _a : new Error('State restore aborted.');
        const canvas = this.access.getCanvas();
        if (!canvas)
            throw new Error('Core Canvas must be initialized before state restore.');
        this.access.setCanvasSize(next.canvasWidth, next.canvasHeight);
        if (!next.canvas)
            throw new Error('Initialized Core state requires Canvas JSON.');
        await canvas.loadFromJSON(next.canvas);
        if (context.signal.aborted)
            throw (_b = context.signal.reason) !== null && _b !== void 0 ? _b : new Error('State restore aborted.');
        const baseImages = canvas.getObjects().filter(isBaseImage);
        if (baseImages.length > 1)
            throw new Error('Restored Core state contains multiple base images.');
        const baseImage = (_c = baseImages[0]) !== null && _c !== void 0 ? _c : null;
        if (baseImage) {
            baseImage.set({ selectable: false, evented: false });
            baseImage.setCoords();
            canvas.sendObjectToBack(baseImage);
        }
        this.access.setBaseImage(baseImage);
        this.access.setImageMimeType(next.imageMimeType);
        this.access.setBaseImageScale(next.baseImageScale);
        this.access.setGeometryRevision(next.geometryRevision);
    }
    validateSnapshot(value) {
        if (!isRecord$1(value))
            return { valid: false, message: 'Core state must be an object.' };
        if (typeof value.initialized !== 'boolean') {
            return {
                valid: false,
                message: 'initialized must be boolean.',
                path: '$.core.initialized',
            };
        }
        if (!Number.isSafeInteger(value.geometryRevision) || Number(value.geometryRevision) < 0) {
            return {
                valid: false,
                message: 'geometryRevision must be a non-negative integer.',
                path: '$.core.geometryRevision',
            };
        }
        if (!value.initialized) {
            return {
                valid: true,
                value: {
                    initialized: false,
                    canvasWidth: 0,
                    canvasHeight: 0,
                    canvas: null,
                    imageMimeType: null,
                    baseImageScale: 1,
                    geometryRevision: Number(value.geometryRevision),
                },
            };
        }
        if (!isPositiveFinite(value.canvasWidth) || !isPositiveFinite(value.canvasHeight)) {
            return {
                valid: false,
                message: 'Canvas dimensions must be positive finite numbers.',
                path: '$.core.canvasWidth',
            };
        }
        if (!isRecord$1(value.canvas)) {
            return { valid: false, message: 'canvas must be an object.', path: '$.core.canvas' };
        }
        if (value.imageMimeType !== null &&
            value.imageMimeType !== undefined &&
            !isImageMimeType(value.imageMimeType)) {
            return {
                valid: false,
                message: 'imageMimeType is unsupported.',
                path: '$.core.imageMimeType',
            };
        }
        if (!isPositiveFinite(value.baseImageScale)) {
            return {
                valid: false,
                message: 'baseImageScale must be positive and finite.',
                path: '$.core.baseImageScale',
            };
        }
        return {
            valid: true,
            value: {
                initialized: true,
                canvasWidth: value.canvasWidth,
                canvasHeight: value.canvasHeight,
                canvas: value.canvas,
                imageMimeType: isImageMimeType(value.imageMimeType) ? value.imageMimeType : null,
                baseImageScale: value.baseImageScale,
                geometryRevision: Number(value.geometryRevision),
            },
        };
    }
}

class ExportContributorRegistry {
    constructor() {
        Object.defineProperty(this, "contributors", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "registrationSequence", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "disposed", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
    }
    register(owner, contributor) {
        this.assertActive('register an export contributor');
        if (owner.trim().length === 0 || owner.trim() !== owner) {
            throw new errors.CoreRuntimeError('[ImageEditor] Export contributor owner must be non-empty.');
        }
        if (contributor.id.trim().length === 0 || contributor.id.trim() !== contributor.id) {
            throw new errors.CoreRuntimeError('[ImageEditor] Export contributor id must be non-empty.');
        }
        if (!Number.isFinite(contributor.order)) {
            throw new errors.CoreRuntimeError(`[ImageEditor] Export contributor "${contributor.id}" must use a finite order.`);
        }
        const existing = this.contributors.get(contributor.id);
        if (existing) {
            throw new errors.CoreRuntimeError(`[ImageEditor] Export contributor "${contributor.id}" is already registered by "${existing.owner}".`);
        }
        const record = {
            owner,
            contributor: Object.freeze({ ...contributor }),
            registrationOrder: this.registrationSequence++,
        };
        this.contributors.set(contributor.id, record);
        return disposable.createDisposable(() => {
            if (this.contributors.get(contributor.id) === record) {
                this.contributors.delete(contributor.id);
            }
        });
    }
    async render(context) {
        this.assertActive('render export contributors');
        const records = [...this.contributors.values()].sort((left, right) => left.contributor.order - right.contributor.order ||
            left.registrationOrder - right.registrationOrder);
        for (const record of records) {
            let enabled;
            try {
                enabled = record.contributor.isEnabled(context.options);
            }
            catch (error) {
                throw new errors.CoreRuntimeError(`[ImageEditor] Export contributor "${record.contributor.id}" enablement failed.`, { code: 'EXPORT_CONTRIBUTOR_ERROR', cause: error });
            }
            if (!enabled)
                continue;
            try {
                await record.contributor.render(context);
            }
            catch (error) {
                throw new errors.CoreRuntimeError(`[ImageEditor] Export contributor "${record.contributor.id}" render failed.`, { code: 'EXPORT_CONTRIBUTOR_ERROR', cause: error });
            }
        }
    }
    dispose() {
        if (this.disposed)
            return;
        this.contributors.clear();
        this.disposed = true;
    }
    assertActive(operation) {
        if (this.disposed) {
            throw new errors.CoreRuntimeError(`[ImageEditor] Cannot ${operation} after disposal.`);
        }
    }
}

const IDENTITY_AFFINE_MATRIX = Object.freeze([1, 0, 0, 1, 0, 0]);
const AFFINE_EPSILON = 1e-10;
function isFiniteAffineMatrix(value) {
    return (Array.isArray(value) &&
        value.length === 6 &&
        value.every((entry) => typeof entry === 'number' && Number.isFinite(entry)));
}
function assertAffineMatrix(value, label = 'matrix') {
    if (!isFiniteAffineMatrix(value)) {
        throw new errors.GeometryMutationError('affine', `${label} must contain six finite numbers.`);
    }
}
function affineDeterminant(matrix) {
    return matrix[0] * matrix[3] - matrix[1] * matrix[2];
}
function hasAffineReflection(matrix) {
    return affineDeterminant(matrix) < 0;
}
function multiplyAffine(left, right) {
    const [a1, b1, c1, d1, e1, f1] = left;
    const [a2, b2, c2, d2, e2, f2] = right;
    return Object.freeze([
        a1 * a2 + c1 * b2,
        b1 * a2 + d1 * b2,
        a1 * c2 + c1 * d2,
        b1 * c2 + d1 * d2,
        a1 * e2 + c1 * f2 + e1,
        b1 * e2 + d1 * f2 + f1,
    ]);
}
function invertAffine(matrix, epsilon = AFFINE_EPSILON) {
    const [a, b, c, d, e, f] = matrix;
    const determinant = affineDeterminant(matrix);
    if (!Number.isFinite(determinant) || Math.abs(determinant) <= epsilon) {
        throw new errors.GeometryMutationError('affine', 'matrix is singular and cannot be inverted.');
    }
    return Object.freeze([
        d / determinant,
        -b / determinant,
        -c / determinant,
        a / determinant,
        (c * f - d * e) / determinant,
        (b * e - a * f) / determinant,
    ]);
}
function applyAffineToPoint(matrix, point) {
    return Object.freeze({
        x: matrix[0] * point.x + matrix[2] * point.y + matrix[4],
        y: matrix[1] * point.x + matrix[3] * point.y + matrix[5],
    });
}
function transformRectBounds(matrix, rect) {
    const points = [
        applyAffineToPoint(matrix, { x: rect.left, y: rect.top }),
        applyAffineToPoint(matrix, { x: rect.left + rect.width, y: rect.top }),
        applyAffineToPoint(matrix, { x: rect.left, y: rect.top + rect.height }),
        applyAffineToPoint(matrix, {
            x: rect.left + rect.width,
            y: rect.top + rect.height,
        }),
    ];
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    const left = Math.min(...xs);
    const top = Math.min(...ys);
    return Object.freeze({
        left,
        top,
        width: Math.max(...xs) - left,
        height: Math.max(...ys) - top,
    });
}
function approximatelyEqualAffine(left, right, epsilon = AFFINE_EPSILON) {
    return left.every((entry, index) => Math.abs(entry - right[index]) <= epsilon);
}
function sanitizeAffineMatrix(matrix, epsilon = AFFINE_EPSILON) {
    return Object.freeze(matrix.map((entry) => (Math.abs(entry) <= epsilon ? 0 : entry)));
}
function computeAffineDelta(before, after) {
    return sanitizeAffineMatrix(multiplyAffine(after, invertAffine(before)));
}

const dangerousKeys = new Set(['__proto__', 'constructor', 'prototype']);
function isObject(value) {
    return typeof value === 'object' && value !== null;
}
function cloneFallback(value, seen) {
    var _a, _b;
    if (!isObject(value)) {
        if (typeof value === 'function' || typeof value === 'symbol') {
            throw new errors.StateCloneError(`State contains an unsupported ${typeof value} value.`);
        }
        return value;
    }
    const existing = seen.get(value);
    if (existing !== undefined)
        return existing;
    if (value instanceof Date)
        return new Date(value.getTime());
    if (value instanceof ArrayBuffer)
        return value.slice(0);
    if (ArrayBuffer.isView(value)) {
        const source = value;
        return new Uint8Array(source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength));
    }
    if (value instanceof Map) {
        const result = new Map();
        seen.set(value, result);
        for (const [key, entry] of value) {
            result.set(cloneFallback(key, seen), cloneFallback(entry, seen));
        }
        return result;
    }
    if (value instanceof Set) {
        const result = new Set();
        seen.set(value, result);
        for (const entry of value)
            result.add(cloneFallback(entry, seen));
        return result;
    }
    if (Array.isArray(value)) {
        const result = [];
        seen.set(value, result);
        for (const entry of value)
            result.push(cloneFallback(entry, seen));
        return result;
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
        throw new errors.StateCloneError(`State contains unsupported object type "${(_b = (_a = prototype === null || prototype === void 0 ? void 0 : prototype.constructor) === null || _a === void 0 ? void 0 : _a.name) !== null && _b !== void 0 ? _b : 'unknown'}".`);
    }
    const result = Object.create(null);
    seen.set(value, result);
    for (const key of Object.keys(value)) {
        if (dangerousKeys.has(key)) {
            throw new errors.StateCloneError(`State contains dangerous key "${key}".`);
        }
        result[key] = cloneFallback(value[key], seen);
    }
    return result;
}
function deepFreeze(value, seen = new WeakSet()) {
    if (!isObject(value) || seen.has(value))
        return value;
    seen.add(value);
    if (value instanceof Map) {
        for (const [key, entry] of value) {
            deepFreeze(key, seen);
            deepFreeze(entry, seen);
        }
    }
    else if (value instanceof Set) {
        for (const entry of value)
            deepFreeze(entry, seen);
    }
    else {
        for (const key of Object.keys(value)) {
            deepFreeze(value[key], seen);
        }
    }
    try {
        Object.freeze(value);
    }
    catch {
    }
    return value;
}
function cloneStateValue(value) {
    try {
        const structuredCloneFunction = globalThis.structuredClone;
        const cloned = typeof structuredCloneFunction === 'function'
            ? structuredCloneFunction(value)
            : cloneFallback(value, new Map());
        return deepFreeze(cloned);
    }
    catch (error) {
        if (error instanceof errors.StateCloneError)
            throw error;
        throw new errors.StateCloneError('State could not be cloned safely.', error);
    }
}
function isDangerousStateKey(key) {
    return dangerousKeys.has(key);
}

function assertIdentifier$1(value, label) {
    if (value.trim().length === 0 || value.trim() !== value) {
        throw new errors.GeometryMutationError(value || 'unknown', `${label} must be non-empty and trimmed.`);
    }
}
function freezeGeometry(snapshot) {
    if (!isFiniteAffineMatrix(snapshot.matrix) ||
        !Number.isFinite(snapshot.canvasWidth) ||
        !Number.isFinite(snapshot.canvasHeight) ||
        !Number.isSafeInteger(snapshot.revision) ||
        snapshot.revision < 0) {
        throw new errors.GeometryMutationError('geometry', 'captured geometry is malformed.');
    }
    return Object.freeze({
        ...snapshot,
        matrix: Object.freeze([...snapshot.matrix]),
        boundingBox: Object.freeze({ ...snapshot.boundingBox }),
    });
}
function createDescriptor(request, before, after, metadata, provisional) {
    const affineDelta = provisional
        ? IDENTITY_AFFINE_MATRIX
        : request.kind === 'raster-replace'
            ? null
            : computeAffineDelta(before.matrix, after.matrix);
    return Object.freeze({
        id: request.id,
        kind: request.kind,
        operationId: request.operationId,
        before,
        after,
        affineDelta,
        hasReflection: affineDelta ? hasAffineReflection(affineDelta) : false,
        sourceRect: request.sourceRect ? Object.freeze({ ...request.sourceRect }) : undefined,
        targetSize: request.targetSize ? Object.freeze({ ...request.targetSize }) : undefined,
        metadata,
    });
}
class GeometryMutationCoordinator {
    constructor(options) {
        Object.defineProperty(this, "options", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: options
        });
        Object.defineProperty(this, "participants", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "usedMutationIds", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Set()
        });
        Object.defineProperty(this, "registrationCounter", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "activeController", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "activePromise", {
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
    get isRunning() {
        return this.activePromise !== null;
    }
    registerParticipant(participant) {
        this.assertActive('register a participant');
        assertIdentifier$1(participant.id, 'Participant id');
        if (!Number.isFinite(participant.order)) {
            throw new errors.GeometryRegistrationError(`Geometry participant "${participant.id}" must use a finite order.`, participant.id);
        }
        if (this.participants.has(participant.id)) {
            throw new errors.GeometryRegistrationError(`Geometry participant "${participant.id}" is already registered.`, participant.id);
        }
        const record = {
            participant: Object.freeze({ ...participant }),
            registrationOrder: this.registrationCounter++,
        };
        this.participants.set(participant.id, record);
        return disposable.createDisposable(() => {
            if (this.participants.get(participant.id) === record) {
                this.participants.delete(participant.id);
            }
        });
    }
    run(request) {
        this.assertActive('run a geometry mutation');
        if (this.activePromise) {
            return Promise.reject(new errors.GeometryMutationError(request.id, 'another geometry mutation is active.'));
        }
        try {
            this.validateRequest(request);
        }
        catch (error) {
            return Promise.reject(error);
        }
        const controller = new AbortController();
        this.activeController = controller;
        const operation = this.performRun(request, controller.signal);
        this.activePromise = operation;
        return operation.finally(() => {
            if (this.activePromise === operation)
                this.activePromise = null;
            if (this.activeController === controller)
                this.activeController = null;
        });
    }
    async dispose() {
        var _a;
        if (this.disposed)
            return;
        this.disposed = true;
        (_a = this.activeController) === null || _a === void 0 ? void 0 : _a.abort(new Error('Geometry coordinator was disposed.'));
        try {
            await this.activePromise;
        }
        catch {
        }
        this.participants.clear();
        this.usedMutationIds.clear();
    }
    disposeSync() {
        if (this.disposed)
            return;
        if (this.activePromise) {
            throw new errors.GeometryRegistrationError('Cannot synchronously dispose an active geometry mutation.');
        }
        this.disposed = true;
        this.participants.clear();
        this.usedMutationIds.clear();
    }
    async performRun(request, signal) {
        const operationToken = this.options.operations.acquire(request.operationId);
        try {
            return await this.performTransaction(request, signal);
        }
        finally {
            await operationToken.dispose();
        }
    }
    async performTransaction(request, signal) {
        var _a, _b, _c, _d, _e;
        const beforeMemento = this.options.mementos.capture();
        const before = freezeGeometry(this.options.state.captureGeometry());
        const metadata = cloneStateValue((_a = request.metadata) !== null && _a !== void 0 ? _a : {});
        const participantSnapshot = Object.freeze([...this.participants.values()].sort((left, right) => left.participant.order - right.participant.order ||
            left.registrationOrder - right.registrationOrder));
        const provisional = createDescriptor(request, before, before, metadata, true);
        const prepared = [];
        let finalDescriptor = provisional;
        const participantContext = Object.freeze({
            signal,
            warnRecoverable: (error, objectIdentity, objectKind) => {
                this.warn({
                    code: 'GEOMETRY_OBJECT_SKIPPED',
                    message: 'An overlay transform skipped a malformed or unsupported object.',
                    mutationId: request.id,
                    objectIdentity,
                    objectKind,
                    cause: error,
                });
            },
        });
        try {
            this.throwIfUnavailable(signal);
            for (const record of participantSnapshot) {
                if (!record.participant.supports(provisional))
                    continue;
                const preparedValue = record.participant.prepare
                    ? await record.participant.prepare(provisional, participantContext)
                    : undefined;
                prepared.push({ record, prepared: preparedValue });
            }
            this.throwIfUnavailable(signal);
            await request.mutateBase(Object.freeze({ signal }));
            this.throwIfUnavailable(signal);
            await this.options.state.finalizeGeometry();
            const after = freezeGeometry(this.options.state.captureGeometry());
            if (after.revision <= before.revision) {
                throw new errors.GeometryMutationError(request.id, `geometry revision must increase (${before.revision} -> ${after.revision}).`);
            }
            finalDescriptor = createDescriptor(request, before, after, metadata, false);
            for (const entry of prepared) {
                this.throwIfUnavailable(signal);
                try {
                    await entry.record.participant.apply(finalDescriptor, entry.prepared, participantContext);
                }
                catch (error) {
                    if (error instanceof errors.GeometryRecoverableObjectError) {
                        this.warn({
                            code: 'GEOMETRY_OBJECT_SKIPPED',
                            message: error.message,
                            mutationId: request.id,
                            participantId: entry.record.participant.id,
                            objectIdentity: error.objectIdentity,
                            objectKind: error.objectKind,
                            cause: error.cause,
                        });
                        continue;
                    }
                    throw error;
                }
            }
            for (const entry of prepared) {
                this.throwIfUnavailable(signal);
                try {
                    await ((_c = (_b = entry.record.participant).synchronize) === null || _c === void 0 ? void 0 : _c.call(_b, finalDescriptor, participantContext));
                }
                catch (error) {
                    if (error instanceof errors.GeometryRecoverableObjectError) {
                        this.warn({
                            code: 'GEOMETRY_SYNCHRONIZE_WARNING',
                            message: error.message,
                            mutationId: request.id,
                            participantId: entry.record.participant.id,
                            objectIdentity: error.objectIdentity,
                            objectKind: error.objectKind,
                            cause: error.cause,
                        });
                        continue;
                    }
                    throw error;
                }
            }
            this.throwIfUnavailable(signal);
            this.options.state.requestRender();
            const afterMemento = this.options.mementos.capture();
            if (this.options.history.isAvailable()) {
                await this.options.history.commit(Object.freeze({
                    operationId: request.operationId,
                    before: beforeMemento,
                    after: afterMemento,
                    timestamp: Date.now(),
                    descriptor: finalDescriptor,
                }));
            }
            try {
                await this.options.events.emitCommitted('geometry:committed', finalDescriptor);
            }
            catch (error) {
                this.warn({
                    code: 'COMMITTED_EVENT_LISTENER_FAILED',
                    message: 'A committed geometry observer failed after the transaction committed.',
                    mutationId: request.id,
                    cause: error,
                });
            }
            return finalDescriptor;
        }
        catch (error) {
            const rollbackErrors = await this.rollback(request, finalDescriptor, prepared, participantContext, beforeMemento, error);
            const failure = error instanceof errors.GeometryMutationError
                ? error
                : new errors.GeometryMutationError(request.id, error instanceof Error ? error.message : 'unknown failure.', error, rollbackErrors);
            (_e = (_d = this.options).errorSink) === null || _e === void 0 ? void 0 : _e.call(_d, failure);
            throw failure;
        }
    }
    async rollback(request, descriptor, prepared, participantContext, beforeMemento, cause) {
        var _a, _b;
        const errors$1 = [];
        for (let index = prepared.length - 1; index >= 0; index -= 1) {
            const entry = prepared[index];
            if (!entry)
                continue;
            try {
                await ((_b = (_a = entry.record.participant).rollback) === null || _b === void 0 ? void 0 : _b.call(_a, descriptor, entry.prepared, participantContext));
            }
            catch (error) {
                errors$1.push(error);
            }
        }
        let targetedSucceeded = false;
        if (request.rollbackBase) {
            try {
                await request.rollbackBase(Object.freeze({ signal: new AbortController().signal, cause }));
                targetedSucceeded =
                    errors$1.length === 0 &&
                        (this.options.mementos.matches
                            ? await this.options.mementos.matches(beforeMemento)
                            : true);
            }
            catch (error) {
                errors$1.push(error);
            }
        }
        if (!targetedSucceeded) {
            try {
                await this.options.mementos.restore(beforeMemento);
            }
            catch (restoreError) {
                errors$1.push(restoreError);
                throw new errors.GeometryUnrecoverableError(request.id, cause, Object.freeze(errors$1));
            }
        }
        if (!this.options.state.isDisposed()) {
            try {
                this.options.state.requestRender();
            }
            catch (error) {
                errors$1.push(error);
            }
        }
        return Object.freeze(errors$1);
    }
    validateRequest(request) {
        var _a, _b;
        assertIdentifier$1(request.id, 'Mutation id');
        assertIdentifier$1(request.kind, 'Mutation kind');
        assertIdentifier$1(request.operationId, 'Operation id');
        if (this.usedMutationIds.has(request.id)) {
            throw new errors.GeometryMutationError(request.id, 'mutation id has already been used.');
        }
        if (!this.options.operations.has(request.operationId)) {
            throw new errors.GeometryMutationError(request.id, `operation "${request.operationId}" is not registered.`);
        }
        if (typeof request.mutateBase !== 'function') {
            throw new errors.GeometryMutationError(request.id, 'mutateBase must be a function.');
        }
        const metadata = JSON.stringify((_a = request.metadata) !== null && _a !== void 0 ? _a : {});
        const maxMetadataBytes = (_b = this.options.maxMetadataBytes) !== null && _b !== void 0 ? _b : 64 * 1024;
        if (new TextEncoder().encode(metadata).byteLength > maxMetadataBytes) {
            throw new errors.GeometryMutationError(request.id, `metadata exceeds ${maxMetadataBytes} bytes.`);
        }
        this.usedMutationIds.add(request.id);
    }
    throwIfUnavailable(signal) {
        var _a;
        if (signal.aborted)
            throw (_a = signal.reason) !== null && _a !== void 0 ? _a : new Error('Geometry mutation aborted.');
        if (this.options.state.isDisposed()) {
            throw new errors.GeometryMutationError('disposed', 'core state is disposed.');
        }
    }
    warn(warning) {
        var _a, _b, _c, _d;
        try {
            (_b = (_a = this.options).warningSink) === null || _b === void 0 ? void 0 : _b.call(_a, Object.freeze(warning));
        }
        catch (error) {
            (_d = (_c = this.options).errorSink) === null || _d === void 0 ? void 0 : _d.call(_c, error);
        }
    }
    assertActive(operation) {
        if (this.disposed) {
            throw new errors.GeometryRegistrationError(`Cannot ${operation} after coordinator disposal.`);
        }
    }
}

const unavailableHistory = Object.freeze({
    isAvailable: () => false,
    commit: () => undefined,
});
class HistoryCommitRouter {
    constructor() {
        Object.defineProperty(this, "provider", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: unavailableHistory
        });
        Object.defineProperty(this, "owner", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
    }
    register(owner, provider) {
        if (owner.trim().length === 0 || owner.trim() !== owner) {
            throw new errors.CoreRuntimeError('[ImageEditor] History provider owner must be non-empty.');
        }
        if (this.owner) {
            throw new errors.CoreRuntimeError(`[ImageEditor] History commit provider is already registered by "${this.owner}".`);
        }
        this.owner = owner;
        this.provider = provider;
        return disposable.createDisposable(() => {
            if (this.owner !== owner || this.provider !== provider)
                return;
            this.owner = null;
            this.provider = unavailableHistory;
        });
    }
    isAvailable() {
        return this.provider.isAvailable();
    }
    commit(record) {
        const coreRecord = Object.freeze({
            operationId: record.operationId,
            before: record.before,
            after: record.after,
            timestamp: record.timestamp,
            detail: 'descriptor' in record ? record.descriptor : record.detail,
        });
        return this.provider.commit(coreRecord);
    }
}

function createAbortError(message) {
    if (typeof DOMException === 'function')
        return new DOMException(message, 'AbortError');
    const error = new Error(message);
    error.name = 'AbortError';
    return error;
}
function throwIfAborted(signal) {
    var _a;
    if (signal.aborted)
        throw (_a = signal.reason) !== null && _a !== void 0 ? _a : createAbortError('State restoration was aborted.');
}
class MementoService {
    constructor(coreAdapter, slices) {
        Object.defineProperty(this, "coreAdapter", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: coreAdapter
        });
        Object.defineProperty(this, "slices", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: slices
        });
        Object.defineProperty(this, "trustedMementos", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new WeakSet()
        });
        Object.defineProperty(this, "revision", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "restoring", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "disposed", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
    }
    capture() {
        this.assertActive('capture a memento');
        if (this.restoring) {
            throw new errors.StateRegistrationError('Cannot capture a new memento during restoration.');
        }
        return this.captureInternal();
    }
    isTrusted(value) {
        return typeof value === 'object' && value !== null && this.trustedMementos.has(value);
    }
    async restore(memento, options = {}) {
        this.assertActive('restore a memento');
        if (!this.isTrusted(memento)) {
            throw new errors.MementoRestoreError('core', 'restore', new Error('Untrusted memento.'));
        }
        if (this.restoring) {
            throw new errors.MementoRestoreError('core', 'restore', new Error('Reentrant memento restoration is not allowed.'));
        }
        const controller = new AbortController();
        const providedSignal = options.signal;
        const abort = () => controller.abort(providedSignal === null || providedSignal === void 0 ? void 0 : providedSignal.reason);
        providedSignal === null || providedSignal === void 0 ? void 0 : providedSignal.addEventListener('abort', abort, { once: true });
        if (providedSignal === null || providedSignal === void 0 ? void 0 : providedSignal.aborted)
            abort();
        this.restoring = true;
        let rollback = null;
        try {
            if (options.rollbackOnFailure !== false)
                rollback = this.captureInternal();
            await this.restoreInternal(memento, 'trusted-memento', controller.signal);
        }
        catch (error) {
            if (!rollback) {
                if (error instanceof errors.MementoRestoreError)
                    throw error;
                throw new errors.MementoRestoreError('core', 'restore', error);
            }
            const rollbackErrors = [];
            try {
                await this.restoreInternal(rollback, 'rollback', new AbortController().signal);
            }
            catch (rollbackError) {
                rollbackErrors.push(rollbackError);
            }
            if (error instanceof errors.MementoRestoreError) {
                throw new errors.MementoRestoreError(error.sliceId, 'restore', error.cause, rollbackErrors);
            }
            throw new errors.MementoRestoreError('core', 'restore', error, rollbackErrors);
        }
        finally {
            providedSignal === null || providedSignal === void 0 ? void 0 : providedSignal.removeEventListener('abort', abort);
            this.restoring = false;
        }
    }
    dispose() {
        this.disposed = true;
    }
    captureInternal() {
        const capturedAt = Date.now();
        const context = Object.freeze({ mode: 'memento', capturedAt });
        let core;
        try {
            core = cloneStateValue(this.coreAdapter.capture(context));
        }
        catch (error) {
            throw new errors.MementoCaptureError('core', error);
        }
        const plugins = Object.create(null);
        for (const slice of this.slices.list()) {
            try {
                plugins[slice.id] = Object.freeze({
                    version: slice.version,
                    data: cloneStateValue(slice.capture(context)),
                });
            }
            catch (error) {
                throw new errors.MementoCaptureError(slice.id, error);
            }
        }
        const memento = Object.freeze({
            revision: ++this.revision,
            capturedAt,
            core,
            plugins: Object.freeze(plugins),
        });
        this.trustedMementos.add(memento);
        return memento;
    }
    async restoreInternal(memento, mode, signal) {
        var _a;
        const context = Object.freeze({ mode, signal });
        throwIfAborted(signal);
        try {
            await this.coreAdapter.restore(cloneStateValue(memento.core), context);
        }
        catch (error) {
            throw new errors.MementoRestoreError('core', mode === 'rollback' ? 'rollback' : 'restore', error);
        }
        for (const slice of this.slices.list()) {
            throwIfAborted(signal);
            const entry = memento.plugins[slice.id];
            try {
                if (!entry) {
                    await ((_a = slice.clearState) === null || _a === void 0 ? void 0 : _a.call(slice, context));
                    continue;
                }
                if (entry.version !== slice.version) {
                    throw new Error(`Captured version ${entry.version} does not match installed version ${slice.version}.`);
                }
                await slice.restore(cloneStateValue(entry.data), context);
            }
            catch (error) {
                throw new errors.MementoRestoreError(slice.id, mode === 'rollback' ? 'rollback' : 'restore', error);
            }
        }
    }
    assertActive(operation) {
        if (this.disposed) {
            throw new errors.StateRegistrationError(`Cannot ${operation} after MementoService disposal.`);
        }
    }
}

function assertIdentifier(value, label) {
    if (value.trim().length === 0 || value.trim() !== value) {
        throw new errors.StateRegistrationError(`${label} must be a non-empty trimmed string.`);
    }
}
class ObjectPropertyRegistry {
    constructor() {
        Object.defineProperty(this, "properties", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "disposed", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
    }
    register(registration) {
        this.assertActive();
        assertIdentifier(registration.owner, 'Object property owner');
        if (registration.keys.length === 0) {
            throw new errors.StateRegistrationError(`Object property registration for "${registration.owner}" must include a key.`);
        }
        const keys = [...new Set(registration.keys)];
        for (const key of keys) {
            assertIdentifier(key, 'Object property key');
            if (isDangerousStateKey(key)) {
                throw new errors.StateRegistrationError(`Object property key "${key}" is forbidden.`);
            }
            const existing = this.properties.get(key);
            if (existing && existing.owner !== registration.owner) {
                throw new errors.StateRegistrationError(`Object property "${key}" is already owned by "${existing.owner}".`);
            }
        }
        for (const key of keys) {
            const existing = this.properties.get(key);
            if (existing)
                existing.references += 1;
            else
                this.properties.set(key, { owner: registration.owner, references: 1 });
        }
        return disposable.createDisposable(() => {
            for (const key of keys) {
                const record = this.properties.get(key);
                if (!record || record.owner !== registration.owner)
                    continue;
                record.references -= 1;
                if (record.references === 0)
                    this.properties.delete(key);
            }
        });
    }
    listKeys() {
        this.assertActive();
        return Object.freeze([...this.properties.keys()]);
    }
    getOwner(key) {
        var _a, _b;
        this.assertActive();
        return (_b = (_a = this.properties.get(key)) === null || _a === void 0 ? void 0 : _a.owner) !== null && _b !== void 0 ? _b : null;
    }
    dispose() {
        if (this.disposed)
            return;
        this.properties.clear();
        this.disposed = true;
    }
    assertActive() {
        if (this.disposed)
            throw new errors.StateRegistrationError('Object property registry is disposed.');
    }
}

const DEFAULT_SNAPSHOT_LIMITS = Object.freeze({
    maxInputBytes: 16 * 1024 * 1024,
    maxDepth: 64,
    maxPluginCount: 256,
    maxPluginPayloadBytes: 4 * 1024 * 1024,
    maxMetadataBytes: 256 * 1024,
});
function byteLength(value) {
    return new TextEncoder().encode(value).byteLength;
}
function inspectTree(value, limits, path = '$', depth = 0, ancestors = new WeakSet()) {
    if (depth > limits.maxDepth) {
        throw new errors.SnapshotValidationError(`nesting exceeds ${limits.maxDepth}.`, path);
    }
    if (value === null || typeof value !== 'object') {
        if (typeof value === 'number' && !Number.isFinite(value)) {
            throw new errors.SnapshotValidationError('number must be finite.', path);
        }
        if (typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint') {
            throw new errors.SnapshotValidationError(`unsupported ${typeof value} value.`, path);
        }
        return;
    }
    if (ancestors.has(value))
        throw new errors.SnapshotValidationError('cyclic value.', path);
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null && !Array.isArray(value)) {
        throw new errors.SnapshotValidationError('only plain objects and arrays are accepted.', path);
    }
    ancestors.add(value);
    for (const key of Object.keys(value)) {
        if (isDangerousStateKey(key)) {
            throw new errors.SnapshotValidationError(`dangerous key "${key}" is forbidden.`, `${path}.${key}`);
        }
        inspectTree(value[key], limits, `${path}.${key}`, depth + 1, ancestors);
    }
    ancestors.delete(value);
}
function stableJson(value, limits) {
    inspectTree(value, limits);
    const sortValue = (entry) => {
        if (Array.isArray(entry))
            return entry.map(sortValue);
        if (entry && typeof entry === 'object') {
            const result = {};
            for (const key of Object.keys(entry).sort()) {
                result[key] = sortValue(entry[key]);
            }
            return result;
        }
        return entry;
    };
    return JSON.stringify(sortValue(value));
}
function parseInput(input, limits) {
    if (typeof input !== 'string') {
        inspectTree(input, limits);
        return input;
    }
    if (byteLength(input) > limits.maxInputBytes) {
        throw new errors.SnapshotValidationError(`input exceeds ${limits.maxInputBytes} bytes.`);
    }
    try {
        const parsed = JSON.parse(input);
        inspectTree(parsed, limits);
        return parsed;
    }
    catch (error) {
        if (error instanceof errors.SnapshotValidationError)
            throw error;
        throw new errors.SnapshotValidationError('input is not valid JSON.', '$', error);
    }
}
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
class SnapshotService {
    constructor(coreAdapter, slices, mementos, warningSink, limits = DEFAULT_SNAPSHOT_LIMITS) {
        Object.defineProperty(this, "coreAdapter", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: coreAdapter
        });
        Object.defineProperty(this, "slices", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: slices
        });
        Object.defineProperty(this, "mementos", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: mementos
        });
        Object.defineProperty(this, "warningSink", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: warningSink
        });
        Object.defineProperty(this, "limits", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: limits
        });
        Object.defineProperty(this, "opaque", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "disposed", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
    }
    capture() {
        this.assertActive('capture a public snapshot');
        const capturedAt = Date.now();
        const context = Object.freeze({ mode: 'snapshot', capturedAt });
        const plugins = Object.create(null);
        for (const [id, entry] of this.opaque)
            plugins[id] = cloneStateValue(entry);
        for (const slice of this.slices.list()) {
            plugins[slice.id] = Object.freeze({
                version: slice.version,
                data: cloneStateValue(slice.capture(context)),
            });
        }
        return Object.freeze({
            schema: 'image-editor.state',
            version: 3,
            core: cloneStateValue(this.coreAdapter.capture(context)),
            plugins: Object.freeze(plugins),
        });
    }
    stringify() {
        return stableJson(this.capture(), this.limits);
    }
    async load(input, options = {}) {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        this.assertActive('load a public snapshot');
        const snapshot = this.validateEnvelope(parseInput(input, this.limits));
        const policy = (_a = options.missingPluginPolicy) !== null && _a !== void 0 ? _a : 'warn-and-skip';
        const before = this.mementos.capture();
        const controller = new AbortController();
        const abort = () => { var _a; return controller.abort((_a = options.signal) === null || _a === void 0 ? void 0 : _a.reason); };
        (_b = options.signal) === null || _b === void 0 ? void 0 : _b.addEventListener('abort', abort, { once: true });
        if ((_c = options.signal) === null || _c === void 0 ? void 0 : _c.aborted)
            abort();
        const context = Object.freeze({
            mode: 'public-snapshot',
            signal: controller.signal,
        });
        const validatedSlices = new Map();
        const nextOpaque = new Map();
        try {
            const coreValidation = this.coreAdapter.validateSnapshot(snapshot.core);
            if (!coreValidation.valid) {
                throw new errors.SnapshotValidationError(coreValidation.message, (_d = coreValidation.path) !== null && _d !== void 0 ? _d : '$.core');
            }
            for (const [id, entry] of Object.entries(snapshot.plugins)) {
                const serializedBytes = byteLength(stableJson(entry.data, this.limits));
                if (serializedBytes > this.limits.maxPluginPayloadBytes) {
                    throw new errors.SnapshotValidationError(`plugin payload exceeds ${this.limits.maxPluginPayloadBytes} bytes.`, `$.plugins.${id}.data`);
                }
                const slice = this.slices.get(id);
                if (!slice) {
                    if (policy === 'error') {
                        throw new errors.SnapshotValidationError('required plugin is not installed.', `$.plugins.${id}`);
                    }
                    if (policy === 'preserve-opaque')
                        nextOpaque.set(id, cloneStateValue(entry));
                    (_e = this.warningSink) === null || _e === void 0 ? void 0 : _e.call(this, {
                        code: 'SNAPSHOT_PLUGIN_MISSING',
                        message: `Snapshot data for missing plugin "${id}" was ${policy === 'preserve-opaque' ? 'preserved opaquely' : 'skipped'}.`,
                        sliceId: id,
                    });
                    continue;
                }
                if (entry.version !== slice.version) {
                    throw new errors.SnapshotValidationError(`version ${entry.version} is incompatible with installed version ${slice.version}.`, `$.plugins.${id}.version`);
                }
                const validation = slice.validate(entry.data, {
                    sliceId: id,
                    version: entry.version,
                });
                if (!validation.valid) {
                    throw new errors.SnapshotValidationError(validation.message, (_f = validation.path) !== null && _f !== void 0 ? _f : `$.plugins.${id}.data`);
                }
                validatedSlices.set(id, cloneStateValue(validation.value));
            }
            await this.coreAdapter.restore(cloneStateValue(coreValidation.value), context);
            for (const slice of this.slices.list()) {
                if (validatedSlices.has(slice.id)) {
                    await slice.restore(validatedSlices.get(slice.id), context);
                }
                else {
                    await ((_g = slice.clearState) === null || _g === void 0 ? void 0 : _g.call(slice, context));
                }
            }
            this.opaque = nextOpaque;
        }
        catch (error) {
            try {
                await this.mementos.restore(before, { rollbackOnFailure: false });
            }
            catch (rollbackError) {
                const combinedError = new Error('Snapshot load and rollback both failed.');
                combinedError.causes = Object.freeze([error, rollbackError]);
                throw new errors.SnapshotValidationError('load failed and rollback could not restore the previous state.', '$', combinedError);
            }
            throw error;
        }
        finally {
            (_h = options.signal) === null || _h === void 0 ? void 0 : _h.removeEventListener('abort', abort);
        }
    }
    dispose() {
        this.opaque.clear();
        this.disposed = true;
    }
    validateEnvelope(value) {
        if (!isRecord(value))
            throw new errors.SnapshotValidationError('snapshot must be an object.');
        if (value.schema !== 'image-editor.state') {
            throw new errors.SnapshotValidationError('schema must be "image-editor.state".', '$.schema');
        }
        if (value.version !== 3) {
            throw new errors.SnapshotValidationError('version must be 3.', '$.version');
        }
        if (!isRecord(value.core))
            throw new errors.SnapshotValidationError('core must be an object.', '$.core');
        if (!isRecord(value.plugins)) {
            throw new errors.SnapshotValidationError('plugins must be an object.', '$.plugins');
        }
        const entries = Object.entries(value.plugins);
        if (entries.length > this.limits.maxPluginCount) {
            throw new errors.SnapshotValidationError(`plugin count exceeds ${this.limits.maxPluginCount}.`, '$.plugins');
        }
        const plugins = Object.create(null);
        for (const [id, entry] of entries) {
            if (id.trim().length === 0 || isDangerousStateKey(id)) {
                throw new errors.SnapshotValidationError('plugin id is invalid.', `$.plugins.${id}`);
            }
            if (!isRecord(entry) ||
                !Number.isSafeInteger(entry.version) ||
                Number(entry.version) <= 0) {
                throw new errors.SnapshotValidationError('plugin entry requires a positive integer version and data.', `$.plugins.${id}`);
            }
            plugins[id] = Object.freeze({ version: Number(entry.version), data: entry.data });
        }
        return Object.freeze({
            schema: 'image-editor.state',
            version: 3,
            core: cloneStateValue(value.core),
            plugins: Object.freeze(plugins),
        });
    }
    assertActive(operation) {
        if (this.disposed)
            throw new errors.StateRegistrationError(`Cannot ${operation} after disposal.`);
    }
}
function migrateV2SnapshotToV3(input, migratePlugins = () => Object.freeze({})) {
    if (!isRecord(input))
        throw new errors.SnapshotValidationError('v2 snapshot must be an object.');
    if ('schema' in input && input.schema === 'image-editor.state' && input.version === 3) {
        if (!isRecord(input.core) || !isRecord(input.plugins)) {
            throw new errors.SnapshotValidationError('v3 snapshot envelope is incomplete.');
        }
        const plugins = Object.create(null);
        for (const [id, entry] of Object.entries(input.plugins)) {
            if (!isRecord(entry) || !Number.isSafeInteger(entry.version)) {
                throw new errors.SnapshotValidationError('v3 plugin entry is invalid.', `$.plugins.${id}`);
            }
            plugins[id] = Object.freeze({
                version: Number(entry.version),
                data: cloneStateValue(entry.data),
            });
        }
        return {
            snapshot: Object.freeze({
                schema: 'image-editor.state',
                version: 3,
                core: cloneStateValue(input.core),
                plugins: Object.freeze(plugins),
            }),
            warnings: Object.freeze([]),
        };
    }
    const editorState = isRecord(input._editorState) ? input._editorState : {};
    const snapshot = Object.freeze({
        schema: 'image-editor.state',
        version: 3,
        core: cloneStateValue({ canvas: input, legacyEditorState: editorState }),
        plugins: cloneStateValue(migratePlugins(input)),
    });
    return {
        snapshot,
        warnings: Object.freeze([
            'A v2 Canvas JSON snapshot was migrated to the v3 envelope; feature fields require installed migration hooks.',
        ]),
    };
}

const sliceIdPattern = /^@?[a-z0-9][a-z0-9._:/@-]*$/i;
function assertDefinition(definition) {
    if (!sliceIdPattern.test(definition.id) || definition.id.trim() !== definition.id) {
        throw new errors.StateRegistrationError('State slice ids must be non-empty, trimmed, and namespace-safe.', definition.id);
    }
    if (!Number.isSafeInteger(definition.version) || definition.version <= 0) {
        throw new errors.StateRegistrationError(`State slice "${definition.id}" must use a positive integer version.`, definition.id);
    }
    if (typeof definition.capture !== 'function' ||
        typeof definition.validate !== 'function' ||
        typeof definition.restore !== 'function') {
        throw new errors.StateRegistrationError(`State slice "${definition.id}" has an incomplete contract.`, definition.id);
    }
}
class StateSliceRegistry {
    constructor() {
        Object.defineProperty(this, "definitions", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "disposed", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
    }
    register(definition) {
        this.assertActive();
        assertDefinition(definition);
        if (this.definitions.has(definition.id)) {
            throw new errors.StateRegistrationError(`State slice "${definition.id}" is already registered.`, definition.id);
        }
        const stored = Object.freeze({ ...definition });
        this.definitions.set(definition.id, stored);
        return disposable.createDisposable(() => {
            if (this.definitions.get(definition.id) === stored) {
                this.definitions.delete(definition.id);
            }
        });
    }
    get(id) {
        var _a;
        this.assertActive();
        return (_a = this.definitions.get(id)) !== null && _a !== void 0 ? _a : null;
    }
    list() {
        this.assertActive();
        return Object.freeze([...this.definitions.values()]);
    }
    dispose() {
        if (this.disposed)
            return;
        this.definitions.clear();
        this.disposed = true;
    }
    assertActive() {
        if (this.disposed)
            throw new errors.StateRegistrationError('State slice registry is disposed.');
    }
}

class TransientObjectRegistry {
    constructor(warningSink) {
        Object.defineProperty(this, "warningSink", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: warningSink
        });
        Object.defineProperty(this, "predicates", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "disposed", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
    }
    register(owner, predicate) {
        this.assertActive();
        if (owner.trim().length === 0 || owner.trim() !== owner) {
            throw new errors.StateRegistrationError('Transient predicate owner must be non-empty and trimmed.');
        }
        if (typeof predicate !== 'function') {
            throw new errors.StateRegistrationError(`Transient predicate for "${owner}" must be a function.`);
        }
        const record = { owner, predicate };
        this.predicates.push(record);
        return disposable.createDisposable(() => {
            const index = this.predicates.indexOf(record);
            if (index >= 0)
                this.predicates.splice(index, 1);
        });
    }
    isTransient(object) {
        var _a;
        this.assertActive();
        for (const record of [...this.predicates]) {
            try {
                if (record.predicate(object))
                    return true;
            }
            catch (error) {
                (_a = this.warningSink) === null || _a === void 0 ? void 0 : _a.call(this, {
                    code: 'TRANSIENT_PREDICATE_FAILED',
                    message: `Transient object predicate owned by "${record.owner}" failed and was ignored.`,
                    details: Object.freeze({ owner: record.owner, cause: error }),
                });
            }
        }
        return false;
    }
    dispose() {
        if (this.disposed)
            return;
        this.predicates.length = 0;
        this.disposed = true;
    }
    assertActive() {
        if (this.disposed)
            throw new errors.StateRegistrationError('Transient object registry is disposed.');
    }
}

const DEFAULT_CORE_OPTIONS = Object.freeze({
    canvasWidth: 800,
    canvasHeight: 600,
    backgroundColor: '#ffffff',
    layoutMode: 'expand',
    groupSelection: true,
    maxInputBytes: 32 * 1024 * 1024,
    maxInputPixels: 64 * 1024 * 1024,
    imageLoadTimeoutMs: 30000,
    maxExportPixels: 64 * 1024 * 1024,
    maxExportDimension: 16384,
    exportMultiplier: 1,
    initialImageBase64: '',
});
function positiveFinite(value, fallback) {
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}
function positiveInteger(value, fallback) {
    return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : fallback;
}
function resolveOptions(options) {
    var _a, _b, _c;
    const layoutMode = options.defaultLayoutMode;
    return Object.freeze({
        canvasWidth: positiveFinite(options.canvasWidth, DEFAULT_CORE_OPTIONS.canvasWidth),
        canvasHeight: positiveFinite(options.canvasHeight, DEFAULT_CORE_OPTIONS.canvasHeight),
        backgroundColor: (_a = options.backgroundColor) !== null && _a !== void 0 ? _a : DEFAULT_CORE_OPTIONS.backgroundColor,
        layoutMode: layoutMode === 'fit' || layoutMode === 'cover' || layoutMode === 'expand'
            ? layoutMode
            : DEFAULT_CORE_OPTIONS.layoutMode,
        groupSelection: (_b = options.groupSelection) !== null && _b !== void 0 ? _b : DEFAULT_CORE_OPTIONS.groupSelection,
        maxInputBytes: positiveInteger(options.maxInputBytes, DEFAULT_CORE_OPTIONS.maxInputBytes),
        maxInputPixels: positiveInteger(options.maxInputPixels, DEFAULT_CORE_OPTIONS.maxInputPixels),
        imageLoadTimeoutMs: positiveInteger(options.imageLoadTimeoutMs, DEFAULT_CORE_OPTIONS.imageLoadTimeoutMs),
        maxExportPixels: positiveInteger(options.maxExportPixels, DEFAULT_CORE_OPTIONS.maxExportPixels),
        maxExportDimension: positiveInteger(options.maxExportDimension, DEFAULT_CORE_OPTIONS.maxExportDimension),
        exportMultiplier: positiveFinite(options.exportMultiplier, DEFAULT_CORE_OPTIONS.exportMultiplier),
        initialImageBase64: (_c = options.initialImageBase64) !== null && _c !== void 0 ? _c : '',
        onError: options.onError,
        onWarning: options.onWarning,
    });
}
function resolveElement(target, ownerDocument) {
    if (!target)
        return null;
    if (typeof target === 'string')
        return ownerDocument.getElementById(target);
    return target;
}
function inferMimeType(source) {
    var _a;
    const match = /^data:(image\/(?:jpeg|png|webp))(?:[;,])/i.exec(source);
    const mimeType = (_a = match === null || match === void 0 ? void 0 : match[1]) === null || _a === void 0 ? void 0 : _a.toLowerCase();
    return mimeType === 'image/jpeg' || mimeType === 'image/png' || mimeType === 'image/webp'
        ? mimeType
        : null;
}
function withCoreTimeout(promise, timeoutMs, label) {
    return new Promise((resolve, reject) => {
        const startedAt = Date.now();
        const timeoutId = setTimeout(() => {
            reject(new errors.CoreRuntimeError(`[ImageEditor] ${label} timed out after ${Date.now() - startedAt}ms.`, { code: 'IMAGE_LOAD_TIMEOUT' }));
        }, timeoutMs);
        promise.then((value) => {
            clearTimeout(timeoutId);
            resolve(value);
        }, (error) => {
            clearTimeout(timeoutId);
            reject(error);
        });
    });
}
function estimateDataUrlBytes(source) {
    const comma = source.indexOf(',');
    if (comma < 0)
        return source.length;
    const metadata = source.slice(0, comma);
    const payload = source.length - comma - 1;
    return /;base64/i.test(metadata) ? Math.ceil((payload * 3) / 4) : payload;
}
function toAffineMatrix(value) {
    if (value.length !== 6 || value.some((entry) => !Number.isFinite(entry))) {
        throw new errors.CoreRuntimeError('[ImageEditor] Base image returned a malformed transform matrix.');
    }
    return Object.freeze([value[0], value[1], value[2], value[3], value[4], value[5]]);
}
function markBaseImage(image) {
    image.editorObjectKind = 'baseImage';
    return image;
}
function reportSafely(callback, error, message, fallback) {
    try {
        callback === null || callback === void 0 ? void 0 : callback(error, message);
    }
    catch (callbackError) {
        fallback('[ImageEditor] Error callback failed.', callbackError);
    }
}
function base64ToFile(dataUrl, fileName) {
    var _a, _b;
    const [header = '', payload = ''] = dataUrl.split(',', 2);
    const mimeType = (_b = (_a = /data:([^;]+)/.exec(header)) === null || _a === void 0 ? void 0 : _a[1]) !== null && _b !== void 0 ? _b : 'application/octet-stream';
    const binary = /;base64/i.test(header) ? atob(payload) : decodeURIComponent(payload);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1)
        bytes[index] = binary.charCodeAt(index);
    return new File([bytes], fileName, { type: mimeType });
}
class ImageEditorCore {
    constructor(fabric, options = {}) {
        Object.defineProperty(this, "fabric", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: fabric
        });
        Object.defineProperty(this, "options", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "slices", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new StateSliceRegistry()
        });
        Object.defineProperty(this, "objectProperties", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new ObjectPropertyRegistry()
        });
        Object.defineProperty(this, "transientObjects", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "externalObjects", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "history", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new HistoryCommitRouter()
        });
        Object.defineProperty(this, "exportContributors", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new ExportContributorRegistry()
        });
        Object.defineProperty(this, "mementos", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "snapshots", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "geometry", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "plugins", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "viewportCache", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new ViewportCache()
        });
        Object.defineProperty(this, "canvas", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "canvasElement", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "containerElement", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "placeholderElement", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "baseImage", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "imageMimeType", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "baseImageScale", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 1
        });
        Object.defineProperty(this, "geometryRevision", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "initialized", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "ownsCanvas", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "compatibilityHostStateListener", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "compatibilityGeometryFinalizer", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "disposing", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "disposed", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "disposePromise", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        if (!fabric ||
            typeof fabric.Canvas !== 'function' ||
            typeof fabric.FabricImage !== 'function') {
            throw new errors.CoreRuntimeError('[ImageEditor] ImageEditorCore requires a Fabric.js v7 module.');
        }
        this.options = resolveOptions(options);
        this.transientObjects = new TransientObjectRegistry((warning) => {
            var _a;
            this.reportWarning((_a = warning.details) === null || _a === void 0 ? void 0 : _a.cause, warning.message);
        });
        this.externalObjects = new TransientObjectRegistry((warning) => {
            var _a;
            this.reportWarning((_a = warning.details) === null || _a === void 0 ? void 0 : _a.cause, warning.message);
        });
        this.objectProperties.register({
            owner: '@bensitu/core',
            keys: ['editorObjectKind'],
        });
        const stateAdapter = new CanvasCoreStateAdapter({
            getCanvas: () => this.canvas,
            getBaseImage: () => this.baseImage,
            setBaseImage: (image) => {
                this.baseImage = image;
            },
            getImageMimeType: () => this.imageMimeType,
            setImageMimeType: (value) => {
                this.imageMimeType = value;
            },
            getBaseImageScale: () => this.baseImageScale,
            setBaseImageScale: (value) => {
                this.baseImageScale = value;
            },
            getGeometryRevision: () => this.geometryRevision,
            setGeometryRevision: (value) => {
                this.geometryRevision = value;
            },
            setCanvasSize: (width, height) => this.setCanvasSize(width, height),
            isDisposed: () => this.disposed,
        }, this.objectProperties, this.transientObjects, this.externalObjects);
        this.mementos = new MementoService(stateAdapter, this.slices);
        this.snapshots = new SnapshotService(stateAdapter, this.slices, this.mementos, (warning) => { var _a; return this.reportWarning((_a = warning.details) === null || _a === void 0 ? void 0 : _a.cause, warning.message); });
        let pluginManager = null;
        this.geometry = new GeometryMutationCoordinator({
            mementos: this.mementos,
            operations: {
                has: (operationId) => { var _a; return (_a = pluginManager === null || pluginManager === void 0 ? void 0 : pluginManager.hasOperation(operationId)) !== null && _a !== void 0 ? _a : false; },
                acquire: (operationId) => {
                    if (!pluginManager)
                        throw new Error('Plugin Manager is not ready.');
                    return pluginManager.beginOperationForHost(operationId);
                },
            },
            state: {
                captureGeometry: () => this.captureGeometry(),
                finalizeGeometry: () => {
                    var _a;
                    (_a = this.baseImage) === null || _a === void 0 ? void 0 : _a.setCoords();
                    this.geometryRevision += 1;
                },
                requestRender: () => this.requestRender(),
                isDisposed: () => this.disposed,
            },
            history: this.history,
            events: {
                emitCommitted: async (eventName, descriptor) => {
                    if (eventName !== 'geometry:committed')
                        return;
                    await (pluginManager === null || pluginManager === void 0 ? void 0 : pluginManager.emitCommitted('geometry:committed', descriptor));
                },
            },
            warningSink: (warning) => this.reportWarning(warning.cause, warning.message),
            errorSink: (error) => this.reportError(error, 'Geometry mutation failed.'),
        });
        const hostPort = this.createHostPort();
        const statePort = this.createStatePort();
        this.plugins = new PluginManager({
            warningSink: (warning) => this.reportWarning(warning.cause, warning.message),
            errorSink: (error) => this.reportError(error, 'Plugin lifecycle failed.'),
            hostCapabilities: [
                { token: internalCapabilities.CORE_HOST_CAPABILITY, implementation: hostPort },
                { token: internalCapabilities.CORE_STATE_CAPABILITY, implementation: statePort },
                { token: internalCapabilities.GEOMETRY_CAPABILITY, implementation: this.geometry },
                { token: internalCapabilities.CORE_EXPORT_CAPABILITY, implementation: this.exportContributors },
            ],
        });
        pluginManager = this.plugins;
        for (const operationId of ['core:load-image', 'core:load-state', 'core:export']) {
            this.plugins.registerHostOperation({ id: operationId, mode: 'busy' });
        }
    }
    use(plugin) {
        this.assertNotDisposed('install a plugin');
        return this.plugins.installSync(plugin);
    }
    useAsync(plugin) {
        this.assertNotDisposed('install a plugin');
        return this.plugins.install(plugin);
    }
    getPlugin(ref) {
        return this.plugins.get(ref);
    }
    requirePlugin(ref) {
        return this.plugins.require(ref);
    }
    getPluginById(pluginId) {
        return this.plugins.getById(pluginId);
    }
    init(elements) {
        var _a, _b, _c, _d, _e, _f;
        this.assertNotDisposed('initialize');
        if (this.initialized)
            throw new errors.CoreRuntimeError('[ImageEditor] Core is already initialized.');
        const ownerDocument = typeof elements.canvas === 'string'
            ? globalThis.document
            : (_a = elements.canvas) === null || _a === void 0 ? void 0 : _a.ownerDocument;
        if (!ownerDocument)
            throw new errors.CoreRuntimeError('[ImageEditor] Canvas document is unavailable.');
        const canvasElement = resolveElement(elements.canvas, ownerDocument);
        if (!(canvasElement instanceof ownerDocument.defaultView.HTMLCanvasElement)) {
            throw new errors.CoreRuntimeError('[ImageEditor] Core canvas element was not found.');
        }
        this.canvasElement = canvasElement;
        this.containerElement =
            (_b = resolveElement(elements.canvasContainer, ownerDocument)) !== null && _b !== void 0 ? _b : canvasElement.parentElement;
        this.placeholderElement = resolveElement(elements.imagePlaceholder, ownerDocument);
        const containerWidth = Math.floor((_d = (_c = this.containerElement) === null || _c === void 0 ? void 0 : _c.clientWidth) !== null && _d !== void 0 ? _d : 0);
        const containerHeight = Math.floor((_f = (_e = this.containerElement) === null || _e === void 0 ? void 0 : _e.clientHeight) !== null && _f !== void 0 ? _f : 0);
        this.canvas = new this.fabric.Canvas(canvasElement, {
            width: containerWidth > 0 ? containerWidth : this.options.canvasWidth,
            height: containerHeight > 0 ? containerHeight : this.options.canvasHeight,
            backgroundColor: this.options.backgroundColor,
            selection: this.options.groupSelection,
            preserveObjectStacking: true,
        });
        this.ownsCanvas = true;
        this.initialized = true;
        try {
            this.plugins.initializeSync();
        }
        catch (error) {
            void this.canvas.dispose();
            this.canvas = null;
            this.initialized = false;
            throw error;
        }
        if (this.options.initialImageBase64) {
            void this.loadImage(this.options.initialImageBase64).catch(() => undefined);
        }
        else {
            this.updatePlaceholder();
        }
    }
    async loadImage(source, options = {}) {
        this.assertReady('load an image');
        if (!inferMimeType(source)) {
            throw new errors.CoreRuntimeError('[ImageEditor] Unsupported image Data URL.');
        }
        if (estimateDataUrlBytes(source) > this.options.maxInputBytes) {
            throw new errors.CoreRuntimeError('[ImageEditor] Image input exceeds maxInputBytes.');
        }
        const operation = this.plugins.beginOperationForHost('core:load-image');
        const before = this.mementos.capture();
        const previousScroll = this.containerElement
            ? { left: this.containerElement.scrollLeft, top: this.containerElement.scrollTop }
            : null;
        try {
            const image = await withCoreTimeout(this.fabric.FabricImage.fromURL(source, { crossOrigin: 'anonymous' }), this.options.imageLoadTimeoutMs, 'FabricImage.fromURL');
            const naturalWidth = Number(image.width) || 0;
            const naturalHeight = Number(image.height) || 0;
            if (naturalWidth <= 0 ||
                naturalHeight <= 0 ||
                naturalWidth * naturalHeight > this.options.maxInputPixels) {
                throw new errors.CoreRuntimeError('[ImageEditor] Decoded image exceeds the pixel budget.');
            }
            if (this.baseImage)
                await this.plugins.notifyImageCleared();
            const canvas = this.requireCanvas('loadImage');
            canvas.discardActiveObject();
            canvas.clear();
            canvas.backgroundColor = this.options.backgroundColor;
            const baseImage = markBaseImage(image);
            baseImage.set({
                originX: 'left',
                originY: 'top',
                selectable: false,
                evented: false,
            });
            const layout = this.computeLayout(baseImage);
            applyCanvasDimensions(canvas, layout.canvasWidth, layout.canvasHeight, this.containerElement);
            baseImage.set({
                left: layout.imageLeft,
                top: layout.imageTop,
                scaleX: layout.imageScale,
                scaleY: layout.imageScale,
            });
            baseImage.setCoords();
            canvas.add(baseImage);
            canvas.sendObjectToBack(baseImage);
            this.baseImage = baseImage;
            this.baseImageScale = layout.imageScale;
            this.imageMimeType = inferMimeType(source);
            this.geometryRevision += 1;
            const imageInfo = this.getImageInfo();
            if (!imageInfo)
                throw new Error('Loaded image information is unavailable.');
            await this.plugins.notifyImageLoaded(imageInfo);
            this.requestRender();
            const after = this.mementos.capture();
            await this.commitHistory({
                operationId: 'core:load-image',
                before,
                after,
                timestamp: Date.now(),
            });
            await this.plugins.emitCommitted('image:loaded', imageInfo);
            if (options.preserveScroll && previousScroll && this.containerElement) {
                this.containerElement.scrollLeft = previousScroll.left;
                this.containerElement.scrollTop = previousScroll.top;
            }
            this.updatePlaceholder();
        }
        catch (error) {
            await this.mementos.restore(before, { rollbackOnFailure: false });
            this.requestRender();
            this.reportError(error, 'loadImage failed.');
            throw error;
        }
        finally {
            await operation.dispose();
        }
    }
    async loadImageFile(file, options = {}) {
        if (!(file instanceof File))
            throw new TypeError('[ImageEditor] loadImageFile expects a File.');
        if (file.size > this.options.maxInputBytes) {
            throw new errors.CoreRuntimeError('[ImageEditor] Image file exceeds maxInputBytes.');
        }
        const dataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = () => { var _a; return reject((_a = reader.error) !== null && _a !== void 0 ? _a : new Error('FileReader failed.')); };
            reader.onload = () => typeof reader.result === 'string'
                ? resolve(reader.result)
                : reject(new Error('FileReader did not produce a Data URL.'));
            reader.readAsDataURL(file);
        });
        await this.loadImage(dataUrl, options);
    }
    saveState() {
        this.assertReady('save state');
        return this.snapshots.stringify();
    }
    async loadFromState(input, options = {}) {
        this.assertReady('load state');
        const operation = this.plugins.beginOperationForHost('core:load-state');
        const before = this.mementos.capture();
        try {
            let value = input;
            if (typeof input === 'string') {
                try {
                    const parsed = JSON.parse(input);
                    if (!parsed ||
                        typeof parsed !== 'object' ||
                        !('schema' in parsed) ||
                        !('version' in parsed)) {
                        value = migrateV2SnapshotToV3(parsed).snapshot;
                    }
                }
                catch (error) {
                    if (error instanceof SyntaxError)
                        throw new errors.SnapshotValidationError('invalid JSON.');
                    throw error;
                }
            }
            await this.snapshots.load(value, {
                missingPluginPolicy: options.missingPluginPolicy,
            });
            const after = this.mementos.capture();
            await this.commitHistory({
                operationId: 'core:load-state',
                before,
                after,
                timestamp: Date.now(),
            });
            await this.plugins.emitCommitted('state:loaded', { schemaVersion: 3 });
            this.requestRender();
            this.updatePlaceholder();
        }
        catch (error) {
            this.reportError(error, 'loadFromState failed.');
            throw error;
        }
        finally {
            await operation.dispose();
        }
    }
    exportImageBase64(options = {}) {
        return this.runExport(options);
    }
    async exportImageFile(options = {}) {
        var _a, _b;
        const dataUrl = await this.runExport(options);
        const format = (_a = options.format) !== null && _a !== void 0 ? _a : 'png';
        return base64ToFile(dataUrl, (_b = options.fileName) !== null && _b !== void 0 ? _b : `image.${format === 'jpeg' ? 'jpg' : format}`);
    }
    isImageLoaded() {
        return this.baseImage !== null;
    }
    getImageInfo() {
        const image = this.baseImage;
        if (!image)
            return null;
        image.setCoords();
        const bounds = image.getBoundingRect();
        return Object.freeze({
            width: bounds.width,
            height: bounds.height,
            naturalWidth: Number(image.width) || 0,
            naturalHeight: Number(image.height) || 0,
            mimeType: this.imageMimeType,
            geometryRevision: this.geometryRevision,
        });
    }
    getCanvas() {
        return this.canvas;
    }
    attachExistingCanvas(canvas, elements) {
        var _a, _b, _c, _d;
        this.assertNotDisposed('attach an existing Canvas');
        if (this.initialized) {
            throw new errors.CoreRuntimeError('[ImageEditor] Core is already initialized.');
        }
        this.canvas = canvas;
        this.canvasElement = elements.canvasElement;
        this.containerElement = (_a = elements.containerElement) !== null && _a !== void 0 ? _a : canvas.lowerCanvasEl.parentElement;
        this.placeholderElement = (_b = elements.placeholderElement) !== null && _b !== void 0 ? _b : null;
        this.compatibilityHostStateListener = (_c = elements.onHostStateChange) !== null && _c !== void 0 ? _c : null;
        this.compatibilityGeometryFinalizer = (_d = elements.finalizeBaseImageGeometry) !== null && _d !== void 0 ? _d : null;
        this.ownsCanvas = false;
        this.initialized = true;
        try {
            this.plugins.initializeSync();
            this.updatePlaceholder();
        }
        catch (error) {
            this.clearRuntimeReferences();
            throw error;
        }
    }
    async synchronizeCompatibilityImage(state) {
        var _a;
        this.assertReady('synchronize compatibility state');
        const previousImage = this.baseImage;
        if (state.baseImage)
            markBaseImage(state.baseImage);
        this.baseImage = state.baseImage;
        this.baseImageScale = positiveFinite(state.baseImageScale, 1);
        this.imageMimeType = state.imageMimeType;
        this.geometryRevision += 1;
        this.notifyCompatibilityHostState();
        const lifecycle = (_a = state.lifecycle) !== null && _a !== void 0 ? _a : 'none';
        if (lifecycle === 'cleared') {
            await this.plugins.notifyImageCleared();
        }
        else if (lifecycle === 'loaded') {
            if (previousImage && previousImage !== state.baseImage) {
                await this.plugins.notifyImageCleared();
            }
            const imageInfo = this.getImageInfo();
            if (imageInfo)
                await this.plugins.notifyImageLoaded(imageInfo);
        }
        this.updatePlaceholder();
    }
    captureCompatibilityMemento() {
        return this.mementos.capture();
    }
    hasActiveCompatibilityMutation() {
        return this.geometry.isRunning;
    }
    dispose() {
        if (this.disposed || this.disposing)
            return;
        if (this.geometry.isRunning) {
            void this.disposeAsync();
            return;
        }
        this.disposing = true;
        const errors$1 = [];
        for (const cleanup of [
            () => this.plugins.disposeSync(),
            () => this.geometry.disposeSync(),
            () => this.exportContributors.dispose(),
            () => this.snapshots.dispose(),
            () => this.mementos.dispose(),
            () => this.transientObjects.dispose(),
            () => this.externalObjects.dispose(),
            () => this.objectProperties.dispose(),
            () => this.slices.dispose(),
        ]) {
            try {
                cleanup();
            }
            catch (error) {
                errors$1.push(error);
            }
        }
        this.disposed = true;
        this.disposing = false;
        const canvas = this.ownsCanvas ? this.canvas : null;
        this.clearRuntimeReferences();
        if (canvas)
            void canvas.dispose();
        if (errors$1.length > 0) {
            throw new errors.CoreRuntimeError(`[ImageEditor] Core disposal completed with ${errors$1.length} cleanup error(s).`, { code: 'CORE_DISPOSE_ERROR', cause: Object.freeze(errors$1) });
        }
    }
    disposeAsync() {
        if (this.disposePromise)
            return this.disposePromise;
        if (this.disposed)
            return Promise.resolve();
        this.disposing = true;
        this.disposePromise = this.performDisposeAsync();
        return this.disposePromise;
    }
    createHostPort() {
        return Object.freeze({
            fabric: this.fabric,
            options: this.options,
            getCanvas: () => this.canvas,
            requireCanvas: (operation) => this.requireCanvas(operation),
            getBaseImage: () => this.baseImage,
            replaceBaseImage: (image, replacementOptions) => {
                var _a;
                const canvas = this.requireCanvas('replace the base image');
                if (this.baseImage && this.baseImage !== image)
                    canvas.remove(this.baseImage);
                markBaseImage(image);
                if (!canvas.getObjects().includes(image))
                    canvas.add(image);
                canvas.sendObjectToBack(image);
                this.baseImage = image;
                this.baseImageScale = positiveFinite(replacementOptions === null || replacementOptions === void 0 ? void 0 : replacementOptions.baseScale, 1);
                this.imageMimeType = (_a = replacementOptions === null || replacementOptions === void 0 ? void 0 : replacementOptions.mimeType) !== null && _a !== void 0 ? _a : this.imageMimeType;
                this.geometryRevision += 1;
                this.notifyCompatibilityHostState();
                this.updatePlaceholder();
            },
            getBaseImageScale: () => this.baseImageScale,
            getGeometryRevision: () => this.geometryRevision,
            setGeometryRevision: (revision) => {
                this.geometryRevision = revision;
            },
            getCanvasSize: () => {
                var _a, _b, _c, _d;
                return Object.freeze({
                    width: (_b = (_a = this.canvas) === null || _a === void 0 ? void 0 : _a.getWidth()) !== null && _b !== void 0 ? _b : 0,
                    height: (_d = (_c = this.canvas) === null || _c === void 0 ? void 0 : _c.getHeight()) !== null && _d !== void 0 ? _d : 0,
                });
            },
            setCanvasSize: (width, height) => this.setCanvasSize(width, height),
            getImageInfo: () => this.getImageInfo(),
            isImageLoaded: () => this.isImageLoaded(),
            isDisposed: () => this.disposed,
            requestRender: () => this.requestRender(),
            finalizeBaseImageGeometry: () => this.finalizeBaseImageGeometry(),
            reportWarning: (error, message) => this.reportWarning(error, message),
            reportError: (error, message) => this.reportError(error, message),
        });
    }
    createStatePort() {
        return Object.freeze({
            slices: this.slices,
            objectProperties: this.objectProperties,
            transientObjects: this.transientObjects,
            externalObjects: this.externalObjects,
            mementos: this.mementos,
            snapshots: this.snapshots,
            captureHistoryRecord: (operationId, before) => Object.freeze({
                operationId,
                before,
                after: this.mementos.capture(),
                timestamp: Date.now(),
            }),
            commitHistory: (record) => this.history.isAvailable() ? this.history.commit(record) : undefined,
            registerHistoryProvider: (owner, provider) => this.history.register(owner, provider),
        });
    }
    computeLayout(image) {
        var _a, _b;
        const scrollbarSize = measureScrollbarSize((_b = (_a = this.containerElement) === null || _a === void 0 ? void 0 : _a.ownerDocument) !== null && _b !== void 0 ? _b : null);
        const viewport = this.viewportCache.measure(this.containerElement, { width: this.options.canvasWidth, height: this.options.canvasHeight }, scrollbarSize);
        const strategy = selectLayoutStrategy(this.options.layoutMode);
        const width = Number(image.width) || 0;
        const height = Number(image.height) || 0;
        if (strategy === 'fit') {
            return computeFitLayout(width, height, this.options.canvasWidth, this.options.canvasHeight, viewport);
        }
        if (strategy === 'cover') {
            return computeCoverLayout(width, height, this.options.canvasWidth, this.options.canvasHeight, viewport, scrollbarSize);
        }
        return computeExpandLayout(width, height, viewport);
    }
    captureGeometry() {
        const canvas = this.requireCanvas('capture base-image geometry');
        const image = this.baseImage;
        if (!image) {
            return Object.freeze({
                matrix: IDENTITY_AFFINE_MATRIX,
                boundingBox: Object.freeze({ left: 0, top: 0, width: 0, height: 0 }),
                canvasWidth: canvas.getWidth(),
                canvasHeight: canvas.getHeight(),
                revision: this.geometryRevision,
            });
        }
        image.setCoords();
        const bounds = image.getBoundingRect();
        return Object.freeze({
            matrix: toAffineMatrix(image.calcTransformMatrix()),
            boundingBox: Object.freeze({
                left: bounds.left,
                top: bounds.top,
                width: bounds.width,
                height: bounds.height,
            }),
            canvasWidth: canvas.getWidth(),
            canvasHeight: canvas.getHeight(),
            revision: this.geometryRevision,
        });
    }
    finalizeBaseImageGeometry() {
        var _a, _b, _c, _d;
        const image = this.baseImage;
        const canvas = this.canvas;
        if (!image || !canvas)
            return;
        if (this.compatibilityGeometryFinalizer) {
            this.compatibilityGeometryFinalizer();
            return;
        }
        image.setCoords();
        const bounds = image.getBoundingRect();
        const viewportWidth = Math.max(1, Math.floor(((_a = this.containerElement) === null || _a === void 0 ? void 0 : _a.clientWidth) || this.options.canvasWidth));
        const viewportHeight = Math.max(1, Math.floor(((_b = this.containerElement) === null || _b === void 0 ? void 0 : _b.clientHeight) || this.options.canvasHeight));
        this.setCanvasSize(Math.max(viewportWidth, Math.ceil(bounds.width)), Math.max(viewportHeight, Math.ceil(bounds.height)));
        image.set({ left: ((_c = image.left) !== null && _c !== void 0 ? _c : 0) - bounds.left, top: ((_d = image.top) !== null && _d !== void 0 ? _d : 0) - bounds.top });
        image.setCoords();
        canvas.sendObjectToBack(image);
    }
    setCanvasSize(width, height) {
        if (!this.canvas)
            return;
        applyCanvasDimensions(this.canvas, Math.max(1, Math.ceil(width)), Math.max(1, Math.ceil(height)), this.containerElement);
    }
    async runExport(options) {
        var _a, _b, _c, _d;
        this.assertReady('export an image');
        const operation = this.plugins.beginOperationForHost('core:export');
        try {
            const canvas = this.requireCanvas('exportImageBase64');
            const multiplier = positiveFinite(options.multiplier, this.options.exportMultiplier);
            const format = (_a = options.format) !== null && _a !== void 0 ? _a : 'png';
            const quality = Math.max(0, Math.min(1, (_b = options.quality) !== null && _b !== void 0 ? _b : 0.92));
            let left = 0;
            let top = 0;
            let width = canvas.getWidth();
            let height = canvas.getHeight();
            if (((_c = options.area) !== null && _c !== void 0 ? _c : 'image') === 'image') {
                if (!this.baseImage)
                    throw new errors.CoreRuntimeError('[ImageEditor] No image is loaded.');
                this.baseImage.setCoords();
                const bounds = this.baseImage.getBoundingRect();
                left = bounds.left;
                top = bounds.top;
                width = bounds.width;
                height = bounds.height;
            }
            if (width * multiplier > this.options.maxExportDimension ||
                height * multiplier > this.options.maxExportDimension ||
                width * height * multiplier * multiplier > this.options.maxExportPixels) {
                throw new errors.CoreRuntimeError('[ImageEditor] Export dimensions exceed the configured budget.');
            }
            const exportElement = (_d = this.canvasElement) === null || _d === void 0 ? void 0 : _d.ownerDocument.createElement('canvas');
            if (!exportElement) {
                throw new errors.CoreRuntimeError('[ImageEditor] Export requires an initialized Canvas.');
            }
            const exportCanvas = new this.fabric.StaticCanvas(exportElement, {
                width: canvas.getWidth(),
                height: canvas.getHeight(),
                backgroundColor: this.options.backgroundColor,
                renderOnAddRemove: false,
            });
            try {
                if (this.baseImage) {
                    const clonedBaseImage = await this.baseImage.clone();
                    exportCanvas.add(clonedBaseImage);
                    exportCanvas.sendObjectToBack(clonedBaseImage);
                }
                await this.exportContributors.render({ canvas: exportCanvas, options });
                exportCanvas.renderAll();
                return exportCanvas.toDataURL({
                    format,
                    quality,
                    multiplier,
                    left,
                    top,
                    width,
                    height,
                });
            }
            finally {
                await exportCanvas.dispose();
            }
        }
        finally {
            await operation.dispose();
        }
    }
    async commitHistory(record) {
        if (this.history.isAvailable())
            await this.history.commit(record);
    }
    requireCanvas(operation) {
        this.assertReady(operation);
        if (!this.canvas)
            throw new errors.CoreRuntimeError(`[ImageEditor] Cannot ${operation} without Canvas.`);
        return this.canvas;
    }
    requestRender() {
        var _a;
        if (!this.disposed)
            (_a = this.canvas) === null || _a === void 0 ? void 0 : _a.requestRenderAll();
    }
    updatePlaceholder() {
        if (this.placeholderElement)
            this.placeholderElement.hidden = this.baseImage !== null;
    }
    notifyCompatibilityHostState() {
        var _a;
        (_a = this.compatibilityHostStateListener) === null || _a === void 0 ? void 0 : _a.call(this, Object.freeze({
            baseImage: this.baseImage,
            baseImageScale: this.baseImageScale,
            imageMimeType: this.imageMimeType,
        }));
    }
    reportWarning(error, message) {
        reportSafely(this.options.onWarning, error, message, console.warn);
    }
    reportError(error, message) {
        reportSafely(this.options.onError, error, message, console.error);
    }
    assertReady(operation) {
        this.assertNotDisposed(operation);
        if (!this.initialized || !this.canvas) {
            throw new errors.CoreRuntimeError(`[ImageEditor] Cannot ${operation} before init().`);
        }
    }
    assertNotDisposed(operation) {
        if (this.disposed || this.disposing)
            throw new errors.CoreRuntimeError(`[ImageEditor] Cannot ${operation} after dispose.`);
    }
    clearRuntimeReferences() {
        this.canvas = null;
        this.canvasElement = null;
        this.containerElement = null;
        this.placeholderElement = null;
        this.baseImage = null;
        this.imageMimeType = null;
        this.baseImageScale = 1;
        this.initialized = false;
        this.ownsCanvas = false;
        this.compatibilityHostStateListener = null;
        this.compatibilityGeometryFinalizer = null;
        this.viewportCache.clear();
    }
    async performDisposeAsync() {
        const errors$1 = [];
        for (const cleanup of [() => this.geometry.dispose(), () => this.plugins.dispose()]) {
            try {
                await cleanup();
            }
            catch (error) {
                errors$1.push(error);
            }
        }
        this.disposed = true;
        this.disposing = false;
        this.snapshots.dispose();
        this.exportContributors.dispose();
        this.mementos.dispose();
        this.transientObjects.dispose();
        this.externalObjects.dispose();
        this.objectProperties.dispose();
        this.slices.dispose();
        const canvas = this.ownsCanvas ? this.canvas : null;
        this.clearRuntimeReferences();
        if (canvas) {
            try {
                await canvas.dispose();
            }
            catch (error) {
                errors$1.push(error);
            }
        }
        if (errors$1.length > 0) {
            throw new errors.CoreRuntimeError(`[ImageEditor] Async disposal completed with ${errors$1.length} cleanup error(s).`, { code: 'CORE_DISPOSE_ERROR', cause: Object.freeze(errors$1) });
        }
    }
}

exports.AFFINE_EPSILON = AFFINE_EPSILON;
exports.DEFAULT_SNAPSHOT_LIMITS = DEFAULT_SNAPSHOT_LIMITS;
exports.GeometryMutationCoordinator = GeometryMutationCoordinator;
exports.IDENTITY_AFFINE_MATRIX = IDENTITY_AFFINE_MATRIX;
exports.ImageEditorCore = ImageEditorCore;
exports.MementoService = MementoService;
exports.ObjectPropertyRegistry = ObjectPropertyRegistry;
exports.SnapshotService = SnapshotService;
exports.StateSliceRegistry = StateSliceRegistry;
exports.TransientObjectRegistry = TransientObjectRegistry;
exports.ViewportCache = ViewportCache;
exports.affineDeterminant = affineDeterminant;
exports.applyAffineToPoint = applyAffineToPoint;
exports.applyCanvasDimensions = applyCanvasDimensions;
exports.approximatelyEqualAffine = approximatelyEqualAffine;
exports.assertAffineMatrix = assertAffineMatrix;
exports.cloneStateValue = cloneStateValue;
exports.computeAffineDelta = computeAffineDelta;
exports.computeCoverLayout = computeCoverLayout;
exports.computeExpandLayout = computeExpandLayout;
exports.computeFitLayout = computeFitLayout;
exports.computeScrollableCanvasSize = computeScrollableCanvasSize;
exports.hasAffineReflection = hasAffineReflection;
exports.invertAffine = invertAffine;
exports.isDangerousStateKey = isDangerousStateKey;
exports.isFiniteAffineMatrix = isFiniteAffineMatrix;
exports.measureScrollbarSize = measureScrollbarSize;
exports.migrateV2SnapshotToV3 = migrateV2SnapshotToV3;
exports.multiplyAffine = multiplyAffine;
exports.sanitizeAffineMatrix = sanitizeAffineMatrix;
exports.selectLayoutStrategy = selectLayoutStrategy;
exports.transformRectBounds = transformRectBounds;
//# sourceMappingURL=index-DTL2QdkR.cjs.map
