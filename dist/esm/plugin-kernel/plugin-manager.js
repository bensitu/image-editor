import { assertCapabilityRequirement, } from './capability-token.js';
import { CapabilityRegistry } from './capability-registry.js';
import { CommittedEventBus, } from './committed-event-bus.js';
import { createDisposable, isPromiseLike } from './disposable.js';
import { InvalidPluginDefinitionError, PluginAggregateError, PluginAlreadyInstalledError, PluginCapabilityError, PluginKernelDisposedError, PluginKernelStateError, PluginLifecycleError, PluginNotInstalledError, PluginSetupError, PluginVersionMismatchError, } from './errors.js';
import { OperationRegistry } from './operation-registry.js';
import { isPluginRef } from './plugin-ref.js';
import { PluginStateStore } from './plugin-state-store.js';
import { RegistrationScope } from './registration-scope.js';
import { reportErrorSafely } from './reporting.js';
import { isValidSemVer } from './semver.js';
import { ToolCoordinator } from './tool-coordinator.js';
function isPluginApi(value) {
    return (typeof value === 'object' && value !== null) || typeof value === 'function';
}
export class PluginManager {
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
            throw new PluginKernelStateError('start a concurrent plugin installation', this.hostState);
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
            throw new PluginKernelStateError('start a concurrent plugin installation', this.hostState);
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
            throw new PluginNotInstalledError(ref.id);
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
            throw new PluginKernelStateError(`run operation "${operationId}" while the active tool rejects it`, this.hostState);
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
            throw new PluginKernelStateError('initialize the Plugin Kernel', this.hostState);
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
                    throw new PluginLifecycleError(pluginId, 'init', error);
                }
            }
            this.hostState = 'initialized';
        }
        catch (error) {
            this.hostState = 'disposing';
            const cleanupErrors = await this.cleanupAll();
            this.hostState = 'disposed';
            const lifecycleError = error instanceof PluginLifecycleError
                ? error
                : new PluginLifecycleError('plugin-kernel', 'init', error);
            throw new PluginLifecycleError((_a = lifecycleError.pluginId) !== null && _a !== void 0 ? _a : 'plugin-kernel', 'init', lifecycleError.cause, cleanupErrors);
        }
    }
    initializeSync() {
        var _a;
        this.assertUsable('initialize the Plugin Kernel');
        if (this.hostState !== 'created' || this.topLevelInstallActive) {
            throw new PluginKernelStateError('initialize the Plugin Kernel', this.hostState);
        }
        this.hostState = 'initializing';
        try {
            for (const pluginId of this.installationOrder) {
                const record = this.installed.get(pluginId);
                if (!(record === null || record === void 0 ? void 0 : record.plugin.onInit))
                    continue;
                const result = record.plugin.onInit(record.lifecycleContext);
                if (isPromiseLike(result)) {
                    throw new PluginLifecycleError(pluginId, 'init', new Error('Synchronous plugin onInit returned a Promise.'));
                }
            }
            this.hostState = 'initialized';
        }
        catch (error) {
            this.hostState = 'disposing';
            const cleanupErrors = this.cleanupAllSync();
            this.hostState = 'disposed';
            const lifecycleError = error instanceof PluginLifecycleError
                ? error
                : new PluginLifecycleError('plugin-kernel', 'init', error);
            throw new PluginLifecycleError((_a = lifecycleError.pluginId) !== null && _a !== void 0 ? _a : 'plugin-kernel', 'init', lifecycleError.cause, cleanupErrors);
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
                throw new PluginLifecycleError(pluginId, 'image-loaded', error);
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
                throw new PluginLifecycleError(pluginId, 'image-cleared', error);
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
            return Promise.reject(new PluginKernelStateError('dispose the Plugin Kernel', this.hostState));
        }
        this.hostState = 'disposing';
        this.disposePromise = this.performDispose();
        return this.disposePromise;
    }
    disposeSync() {
        if (this.hostState === 'disposed')
            return;
        if (this.hostState === 'disposing' || this.hostState === 'initializing') {
            throw new PluginKernelStateError('dispose the Plugin Kernel synchronously', this.hostState);
        }
        this.hostState = 'disposing';
        const errors = this.cleanupAllSync();
        this.hostState = 'disposed';
        if (errors.length > 0) {
            throw new PluginAggregateError('[ImageEditor] Plugin Kernel synchronous disposal completed with cleanup errors.', errors);
        }
    }
    async performInstall(plugin, mode, parentStack) {
        this.validatePluginDefinition(plugin);
        const pluginId = plugin.ref.id;
        if (parentStack.includes(pluginId)) {
            throw new InvalidPluginDefinitionError(`Plugin dependency cycle detected: ${[...parentStack, pluginId].join(' -> ')}.`, pluginId);
        }
        const existing = this.installed.get(pluginId);
        if (existing) {
            if (mode === 'strict')
                throw new PluginAlreadyInstalledError(pluginId);
            const compatible = existing.plugin.version === plugin.version &&
                existing.plugin.ref.apiVersion === plugin.ref.apiVersion &&
                existing.refObject === plugin.ref;
            if (!compatible) {
                throw new PluginVersionMismatchError(pluginId, existing.plugin.version, plugin.version, existing.plugin.ref.apiVersion, plugin.ref.apiVersion);
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
                throw new InvalidPluginDefinitionError(`Plugin "${pluginId}" setup must return a non-null object or function API.`, pluginId);
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
            throw new PluginSetupError(pluginId, error, cleanupErrors);
        }
    }
    performInstallSync(plugin, mode, parentStack) {
        this.validatePluginDefinition(plugin);
        if (plugin.setupMode !== 'sync') {
            throw new InvalidPluginDefinitionError(`Plugin "${plugin.ref.id}" must declare setupMode "sync" for installSync().`, plugin.ref.id);
        }
        const pluginId = plugin.ref.id;
        if (parentStack.includes(pluginId)) {
            throw new InvalidPluginDefinitionError(`Plugin dependency cycle detected: ${[...parentStack, pluginId].join(' -> ')}.`, pluginId);
        }
        const existing = this.installed.get(pluginId);
        if (existing) {
            if (mode === 'strict')
                throw new PluginAlreadyInstalledError(pluginId);
            const compatible = existing.plugin.version === plugin.version &&
                existing.plugin.ref.apiVersion === plugin.ref.apiVersion &&
                existing.refObject === plugin.ref;
            if (!compatible) {
                throw new PluginVersionMismatchError(pluginId, existing.plugin.version, plugin.version, existing.plugin.ref.apiVersion, plugin.ref.apiVersion);
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
            if (isPromiseLike(api)) {
                throw new InvalidPluginDefinitionError(`Plugin "${pluginId}" returned a Promise from synchronous setup.`, pluginId);
            }
            if (!isPluginApi(api)) {
                throw new InvalidPluginDefinitionError(`Plugin "${pluginId}" setup must return a non-null object or function API.`, pluginId);
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
            throw new PluginSetupError(pluginId, error, cleanupErrors);
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
                    throw new PluginCapabilityError({
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
                    throw new PluginCapabilityError({
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
                scope.addRollback(createDisposable(() => this.rollbackInstalledPlugin(installedPluginId)));
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
                errors.push(new PluginLifecycleError(pluginId, 'dispose', error));
            }
        }
        try {
            await record.scope.dispose();
        }
        catch (error) {
            errors.push(error);
        }
        if (errors.length > 0) {
            throw new PluginAggregateError(`[ImageEditor] Rollback of composed plugin "${pluginId}" failed.`, errors, { pluginId });
        }
    }
    validatePluginDefinition(plugin) {
        if (typeof plugin !== 'object' || plugin === null) {
            throw new InvalidPluginDefinitionError('Plugin definition must be an object.');
        }
        if (!isPluginRef(plugin.ref)) {
            throw new InvalidPluginDefinitionError('Plugin definition must use a PluginRef created by definePluginRef().');
        }
        if (!isValidSemVer(plugin.version)) {
            throw new InvalidPluginDefinitionError(`Plugin "${plugin.ref.id}" has invalid implementation SemVer "${plugin.version}".`, plugin.ref.id);
        }
        if (typeof plugin.setup !== 'function') {
            throw new InvalidPluginDefinitionError(`Plugin "${plugin.ref.id}" must define setup().`, plugin.ref.id);
        }
        const capabilityIds = new Set();
        const validateRequirements = (requirements, kind) => {
            for (const requirement of requirements !== null && requirements !== void 0 ? requirements : []) {
                try {
                    assertCapabilityRequirement(requirement);
                }
                catch (error) {
                    throw new InvalidPluginDefinitionError(`Plugin "${plugin.ref.id}" has an invalid ${kind} capability requirement.`, plugin.ref.id, error);
                }
                if (capabilityIds.has(requirement.token.id)) {
                    throw new InvalidPluginDefinitionError(`Plugin "${plugin.ref.id}" declares capability "${requirement.token.id}" more than once.`, plugin.ref.id);
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
            throw new PluginAggregateError('[ImageEditor] Plugin Kernel disposal completed with cleanup errors.', errors);
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
                const lifecycleError = new PluginLifecycleError(record.plugin.ref.id, 'dispose', error);
                errors.push(lifecycleError);
                reportErrorSafely(this.options.errorSink, lifecycleError);
            }
        }
        for (const record of records) {
            try {
                await record.scope.dispose();
            }
            catch (error) {
                errors.push(error);
                reportErrorSafely(this.options.errorSink, error);
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
        for (const disposable of kernelDisposables) {
            try {
                await disposable.dispose();
            }
            catch (error) {
                errors.push(error);
                reportErrorSafely(this.options.errorSink, error);
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
                if (isPromiseLike(result)) {
                    void Promise.resolve(result).catch((error) => {
                        reportErrorSafely(this.options.errorSink, error);
                    });
                    throw new PluginLifecycleError(record.plugin.ref.id, 'dispose', new Error('Synchronous plugin onDispose returned a Promise.'));
                }
            }
            catch (error) {
                const lifecycleError = error instanceof PluginLifecycleError
                    ? error
                    : new PluginLifecycleError(record.plugin.ref.id, 'dispose', error);
                errors.push(lifecycleError);
                reportErrorSafely(this.options.errorSink, lifecycleError);
            }
        }
        for (const record of records) {
            try {
                record.scope.disposeSync();
            }
            catch (error) {
                errors.push(error);
                reportErrorSafely(this.options.errorSink, error);
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
                reportErrorSafely(this.options.errorSink, error);
            }
        }
        return Object.freeze(errors);
    }
    assertCanInstall() {
        this.assertUsable('install a plugin');
        if (this.hostState !== 'created') {
            throw new PluginKernelStateError('install a plugin', this.hostState);
        }
    }
    assertLifecycleReady(operation) {
        this.assertUsable(operation);
        if (this.hostState !== 'initialized') {
            throw new PluginKernelStateError(operation, this.hostState);
        }
    }
    assertUsable(operation) {
        if (this.hostState === 'disposed' || this.hostState === 'disposing') {
            throw new PluginKernelDisposedError(operation);
        }
    }
}
//# sourceMappingURL=plugin-manager.js.map