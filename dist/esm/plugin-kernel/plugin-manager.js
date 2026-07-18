import { CapabilityRegistry } from './capability-registry.js';
import { CommittedEventBus, } from './committed-event-bus.js';
import { createDisposable, isPromiseLike } from './disposable.js';
import { InvalidPluginDefinitionError, PluginAggregateError, PluginAlreadyInstalledError, PluginBatchInstallError, PluginCapabilityError, PluginDefinitionConflictError, PluginDependencyCycleError, PluginDependencyError, PluginKernelDisposedError, PluginKernelStateError, PluginLifecycleError, PluginNotInstalledError, PluginPermissionError, PluginSetupError, PluginVersionMismatchError, } from './errors.js';
import { OperationRegistry, } from './operation-registry.js';
import { validatePluginManifest } from './plugin-manifest.js';
import { isPluginRef } from './plugin-ref.js';
import { PluginStateStore } from './plugin-state-store.js';
import { RegistrationScope } from './registration-scope.js';
import { reportErrorSafely } from './reporting.js';
import { ToolCoordinator } from './tool-coordinator.js';
function isPluginApi(value) {
    return (typeof value === 'object' && value !== null) || typeof value === 'function';
}
function sameArray(left, right, equal) {
    if (left === undefined || right === undefined)
        return left === right;
    return (left.length === right.length &&
        left.every((leftValue, index) => equal(leftValue, right[index])));
}
function sameInstallationDefinition(left, right) {
    return (left.ref === right.ref &&
        left.manifest.id === right.manifest.id &&
        left.manifest.version === right.manifest.version &&
        left.manifest.apiVersion === right.manifest.apiVersion &&
        left.manifest.engine === right.manifest.engine &&
        sameArray(left.manifest.requiresPlugins, right.manifest.requiresPlugins, (leftRef, rightRef) => leftRef === rightRef) &&
        sameArray(left.manifest.requires, right.manifest.requires, (leftRequirement, rightRequirement) => leftRequirement.token === rightRequirement.token &&
            leftRequirement.range === rightRequirement.range) &&
        sameArray(left.manifest.optional, right.manifest.optional, (leftRequirement, rightRequirement) => leftRequirement.token === rightRequirement.token &&
            leftRequirement.range === rightRequirement.range) &&
        sameArray(left.manifest.permissions, right.manifest.permissions, (leftPermission, rightPermission) => leftPermission === rightPermission) &&
        left.setupMode === right.setupMode &&
        left.setup === right.setup &&
        left.onInit === right.onInit &&
        left.onImageLoaded === right.onImageLoaded &&
        left.onImageCleared === right.onImageCleared &&
        left.onDispose === right.onDispose);
}
const pluginPackageHints = new Map([
    ['foundation.overlay', '@bensitu/image-editor/plugins/overlay'],
    ['@bensitu/transform', '@bensitu/image-editor/plugins/transform'],
    ['@bensitu/mask', '@bensitu/image-editor/plugins/mask'],
    ['@bensitu/history', '@bensitu/image-editor/plugins/history'],
    ['@bensitu/filters', '@bensitu/image-editor/plugins/filters'],
]);
export class PluginManager {
    constructor(options = {}) {
        var _a;
        Object.defineProperty(this, "options", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: options
        });
        Object.defineProperty(this, "operationRegistry", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new OperationRegistry()
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
            this.capabilityRegistry.provideHost(provider.token, provider.implementation, provider.providerId, provider.requiredPermission);
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
    installBatchSync(plugins) {
        this.assertCanInstall();
        if (this.topLevelInstallActive) {
            throw new PluginKernelStateError('start a concurrent plugin installation', this.hostState);
        }
        this.topLevelInstallActive = true;
        try {
            const prepared = this.prepareBatch(plugins);
            const visibleTransactions = new Set();
            const pendingRecords = [];
            try {
                for (const entry of prepared.ordered) {
                    const record = this.performPendingInstallSync(entry.plugin, visibleTransactions);
                    pendingRecords.push(record);
                    prepared.apisByPluginId.set(entry.plugin.ref.id, record.api);
                }
                for (const record of pendingRecords)
                    record.scope.commit();
                for (const record of pendingRecords) {
                    const pluginId = record.plugin.ref.id;
                    this.installed.set(pluginId, record);
                    this.installationOrder.push(pluginId);
                }
            }
            catch (cause) {
                const cleanupErrors = [
                    ...(cause instanceof PluginSetupError ? cause.cleanupErrors : []),
                    ...this.rollbackPendingBatchSync(pendingRecords),
                ];
                throw new PluginBatchInstallError(cause, cleanupErrors);
            }
            return Object.freeze({
                apisByPluginId: prepared.apisByPluginId,
                installedPlugins: Object.freeze(pendingRecords.map((record) => record.plugin)),
            });
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
    getOperationForHost(operationId) {
        return this.operationRegistry.get(operationId);
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
    runOperationForHost(operationId, args, task, options = {}) {
        if (!this.toolCoordinator.canRunOperation(operationId)) {
            return Promise.reject(new PluginKernelStateError(`run operation "${operationId}" while the active tool rejects it`, this.hostState));
        }
        return this.operationRegistry.runForHost(operationId, args, task, options);
    }
    waitForOperations() {
        return this.operationRegistry.waitForIdle();
    }
    abortOperationsForHost(reason) {
        return this.operationRegistry.abortAll(reason);
    }
    suspendOperationsForHost(reason) {
        return this.operationRegistry.suspend(reason);
    }
    exitActiveToolForHost() {
        return this.toolCoordinator.exit('host-dispose');
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
    prepareBatch(inputs) {
        var _a;
        if (!Array.isArray(inputs) || inputs.length === 0) {
            throw new InvalidPluginDefinitionError('Plugin batch must contain at least one Plugin.');
        }
        const candidatesById = new Map();
        const apisByPluginId = new Map();
        for (const input of inputs) {
            const plugin = this.normalizePluginDefinition(input);
            const pluginId = plugin.ref.id;
            const existing = this.installed.get(pluginId);
            if (existing) {
                if (!sameInstallationDefinition(existing.plugin, plugin)) {
                    throw new PluginDefinitionConflictError(pluginId);
                }
                apisByPluginId.set(pluginId, existing.api);
                continue;
            }
            const duplicate = candidatesById.get(pluginId);
            if (duplicate) {
                if (!sameInstallationDefinition(duplicate.plugin, plugin)) {
                    throw new PluginDefinitionConflictError(pluginId);
                }
                continue;
            }
            candidatesById.set(pluginId, { plugin });
        }
        const candidates = [...candidatesById.values()];
        const dependencies = new Map();
        for (const candidate of candidates) {
            const pluginDependencies = new Set();
            for (const dependency of (_a = candidate.plugin.manifest.requiresPlugins) !== null && _a !== void 0 ? _a : []) {
                const installedDependency = this.installed.get(dependency.id);
                if ((installedDependency === null || installedDependency === void 0 ? void 0 : installedDependency.refObject) === dependency)
                    continue;
                const batchDependency = candidatesById.get(dependency.id);
                if ((batchDependency === null || batchDependency === void 0 ? void 0 : batchDependency.plugin.ref) === dependency) {
                    pluginDependencies.add(dependency.id);
                    continue;
                }
                throw this.createDependencyError(candidate.plugin.ref.id, dependency, [
                    ...this.installed.keys(),
                    ...candidatesById.keys(),
                ]);
            }
            dependencies.set(candidate.plugin.ref.id, pluginDependencies);
        }
        const remaining = new Set(candidatesById.keys());
        const ordered = [];
        while (remaining.size > 0) {
            const next = candidates.find((candidate) => {
                var _a;
                return remaining.has(candidate.plugin.ref.id) &&
                    [...((_a = dependencies.get(candidate.plugin.ref.id)) !== null && _a !== void 0 ? _a : [])].every((dependencyId) => !remaining.has(dependencyId));
            });
            if (!next) {
                throw new PluginDependencyCycleError(this.findDependencyCycle(remaining, dependencies));
            }
            remaining.delete(next.plugin.ref.id);
            ordered.push(next);
        }
        return { ordered: Object.freeze(ordered), apisByPluginId };
    }
    findDependencyCycle(remaining, dependencies) {
        const visited = new Set();
        const visiting = new Set();
        const stack = [];
        const visit = (pluginId) => {
            var _a;
            if (visiting.has(pluginId)) {
                const start = stack.indexOf(pluginId);
                return Object.freeze([...stack.slice(start), pluginId]);
            }
            if (visited.has(pluginId))
                return null;
            visiting.add(pluginId);
            stack.push(pluginId);
            for (const dependencyId of (_a = dependencies.get(pluginId)) !== null && _a !== void 0 ? _a : []) {
                if (!remaining.has(dependencyId))
                    continue;
                const cycle = visit(dependencyId);
                if (cycle)
                    return cycle;
            }
            stack.pop();
            visiting.delete(pluginId);
            visited.add(pluginId);
            return null;
        };
        for (const pluginId of remaining) {
            const cycle = visit(pluginId);
            if (cycle)
                return cycle;
        }
        return Object.freeze([...remaining, remaining.values().next().value]);
    }
    performPendingInstallSync(plugin, visibleTransactions) {
        if (plugin.setupMode !== 'sync') {
            throw new InvalidPluginDefinitionError(`Plugin "${plugin.ref.id}" must declare setupMode "sync" for install().`, plugin.ref.id);
        }
        const { required, optional } = this.resolveCapabilities(plugin, visibleTransactions);
        const scope = new RegistrationScope(plugin.ref.id, this.options);
        visibleTransactions.add(scope.transactionId);
        try {
            const contexts = this.createContexts(plugin.ref, scope, required, optional, [
                plugin.ref.id,
            ]);
            const api = plugin.setup(contexts.setup);
            if (isPromiseLike(api)) {
                throw new InvalidPluginDefinitionError(`Plugin "${plugin.ref.id}" returned a Promise from synchronous setup.`, plugin.ref.id);
            }
            if (!isPluginApi(api)) {
                throw new InvalidPluginDefinitionError(`Plugin "${plugin.ref.id}" setup must return a non-null object or function API.`, plugin.ref.id);
            }
            return {
                plugin,
                refObject: plugin.ref,
                api,
                scope,
                lifecycleContext: contexts.lifecycle,
            };
        }
        catch (error) {
            visibleTransactions.delete(scope.transactionId);
            const cleanupErrors = scope.rollbackSync();
            throw new PluginSetupError(plugin.ref.id, error, cleanupErrors);
        }
    }
    rollbackPendingBatchSync(pendingRecords) {
        const cleanupErrors = [];
        for (const record of [...pendingRecords].reverse()) {
            if (record.plugin.onDispose) {
                try {
                    const result = record.plugin.onDispose(record.lifecycleContext);
                    if (isPromiseLike(result)) {
                        void Promise.resolve(result).catch((error) => {
                            reportErrorSafely(this.options.errorSink, error);
                        });
                        throw new Error('Synchronous Plugin onDispose returned a Promise.');
                    }
                }
                catch (error) {
                    cleanupErrors.push(new PluginLifecycleError(record.plugin.ref.id, 'dispose', error));
                }
            }
            cleanupErrors.push(...record.scope.rollbackSync());
        }
        return Object.freeze(cleanupErrors);
    }
    createDependencyError(consumerPluginId, dependency, availablePluginIds) {
        return new PluginDependencyError({
            consumerPluginId,
            dependencyId: dependency.id,
            requiredApiVersion: dependency.apiVersion,
            availablePluginIds: Object.freeze([...new Set(availablePluginIds)].sort()),
            packageHint: pluginPackageHints.get(dependency.id),
            planHint: 'Pass the dependency to install([...]) or include it in composePlugins(...).',
        });
    }
    assertPluginDependenciesInstalled(plugin) {
        var _a;
        for (const dependency of (_a = plugin.manifest.requiresPlugins) !== null && _a !== void 0 ? _a : []) {
            const installedDependency = this.installed.get(dependency.id);
            if ((installedDependency === null || installedDependency === void 0 ? void 0 : installedDependency.refObject) === dependency)
                continue;
            throw this.createDependencyError(plugin.ref.id, dependency, [...this.installed.keys()]);
        }
    }
    async performInstall(input, mode, parentStack) {
        const plugin = this.normalizePluginDefinition(input);
        const pluginId = plugin.ref.id;
        if (parentStack.includes(pluginId)) {
            throw new InvalidPluginDefinitionError(`Plugin dependency cycle detected: ${[...parentStack, pluginId].join(' -> ')}.`, pluginId);
        }
        const existing = this.installed.get(pluginId);
        if (existing) {
            if (mode === 'strict')
                throw new PluginAlreadyInstalledError(pluginId);
            const compatible = sameInstallationDefinition(existing.plugin, plugin);
            if (!compatible) {
                throw new PluginVersionMismatchError(pluginId, existing.plugin.manifest.version, plugin.manifest.version, existing.plugin.ref.apiVersion, plugin.ref.apiVersion);
            }
            return { api: existing.api };
        }
        this.assertPluginDependenciesInstalled(plugin);
        const { required, optional } = this.resolveCapabilities(plugin);
        const scope = new RegistrationScope(pluginId, this.options);
        const stack = [...parentStack, pluginId];
        try {
            const contexts = this.createContexts(plugin.ref, scope, required, optional, stack);
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
    performInstallSync(input, mode, parentStack) {
        const plugin = this.normalizePluginDefinition(input);
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
            const compatible = sameInstallationDefinition(existing.plugin, plugin);
            if (!compatible) {
                throw new PluginVersionMismatchError(pluginId, existing.plugin.manifest.version, plugin.manifest.version, existing.plugin.ref.apiVersion, plugin.ref.apiVersion);
            }
            return { api: existing.api };
        }
        this.assertPluginDependenciesInstalled(plugin);
        const { required, optional } = this.resolveCapabilities(plugin);
        const scope = new RegistrationScope(pluginId, this.options);
        try {
            const contexts = this.createContexts(plugin.ref, scope, required, optional, [
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
    resolveCapabilities(plugin, visibleTransactions) {
        var _a, _b;
        const required = new Map();
        const optional = new Map();
        for (const requirement of (_a = plugin.manifest.requires) !== null && _a !== void 0 ? _a : []) {
            this.assertCapabilityPermission(plugin, requirement.token.id, visibleTransactions);
            required.set(requirement.token.id, {
                token: requirement.token,
                value: this.capabilityRegistry.requireDefinition(requirement, plugin.ref.id, visibleTransactions),
            });
        }
        for (const requirement of (_b = plugin.manifest.optional) !== null && _b !== void 0 ? _b : []) {
            this.assertCapabilityPermission(plugin, requirement.token.id, visibleTransactions);
            const value = this.capabilityRegistry.optionalDefinition(requirement, plugin.ref.id, visibleTransactions);
            optional.set(requirement.token.id, {
                token: requirement.token,
                value,
                status: value !== null
                    ? 'available'
                    : this.capabilityRegistry.getProviderInfo(requirement.token.id)
                        ? 'incompatible'
                        : 'missing',
            });
        }
        return { required, optional };
    }
    assertCapabilityPermission(plugin, capabilityId, visibleTransactions) {
        var _a;
        const permission = this.capabilityRegistry.getRequiredPermission(capabilityId, visibleTransactions);
        if (!permission || ((_a = plugin.manifest.permissions) === null || _a === void 0 ? void 0 : _a.includes(permission)))
            return;
        throw new PluginPermissionError(plugin.ref.id, permission, capabilityId);
    }
    createContexts(plugin, scope, required, optional, stack) {
        const pluginId = plugin.id;
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
            getOptionalStatus: (token) => {
                const resolved = optional.get(token.id);
                if (!resolved || resolved.token !== token) {
                    throw new PluginCapabilityError({
                        consumerPluginId: pluginId,
                        capabilityId: token.id,
                        requestedRange: 'undeclared-optional-capability',
                        reason: 'missing',
                    });
                }
                return resolved.status;
            },
        });
        const operations = Object.freeze({
            begin: (operationId) => this.operationRegistry.begin(operationId, pluginId),
            run: (operationId, args, task, options = {}) => this.operationRegistry.run(operationId, pluginId, args, task, options),
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
            plugin,
            pluginId,
            state,
            capabilities,
            operations,
            tools,
            events,
        });
        const setupCapabilities = Object.freeze({
            ...capabilities,
            provide: (token, implementation, options) => {
                var _a;
                scope.assertOpen();
                return scope.add(this.capabilityRegistry.providePending(token, implementation, pluginId, scope.transactionId, (_a = options === null || options === void 0 ? void 0 : options.version) !== null && _a !== void 0 ? _a : token.version, options === null || options === void 0 ? void 0 : options.requiredPermission));
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
        const disposables = Object.freeze({
            get active() {
                return scope.active;
            },
            add: (disposable) => {
                scope.assertOpen();
                return scope.add(disposable);
            },
        });
        const setup = Object.freeze({
            plugin,
            pluginId,
            state,
            capabilities: setupCapabilities,
            operations: setupOperations,
            tools: setupTools,
            events: setupEvents,
            disposables,
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
    normalizePluginDefinition(plugin) {
        if (typeof plugin !== 'object' || plugin === null) {
            throw new InvalidPluginDefinitionError('Plugin definition must be an object.');
        }
        if (!isPluginRef(plugin.ref)) {
            throw new InvalidPluginDefinitionError('Plugin definition must use a PluginRef created by definePluginRef().');
        }
        if (typeof plugin.setup !== 'function') {
            throw new InvalidPluginDefinitionError(`Plugin "${plugin.ref.id}" must define setup().`, plugin.ref.id);
        }
        const manifest = validatePluginManifest(plugin.ref, 'manifest' in plugin
            ? plugin.manifest
            : {
                id: plugin.ref.id,
                version: plugin.version,
                apiVersion: plugin.ref.apiVersion,
                engine: '*',
                requires: plugin.requires,
                optional: plugin.optional,
                permissions: plugin.permissions,
            });
        return Object.freeze({ ...plugin, ref: plugin.ref, manifest });
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