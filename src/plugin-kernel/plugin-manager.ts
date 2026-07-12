import {
    assertCapabilityRequirement,
    type CapabilityIdentity,
    type CapabilityRequirementIdentity,
    type CapabilityToken,
} from './capability-token.js';
import { CapabilityRegistry } from './capability-registry.js';
import {
    CommittedEventBus,
    type CommittedEventListener,
    type PluginEventMap,
} from './committed-event-bus.js';
import { createDisposable, isPromiseLike, type Disposable } from './disposable.js';
import {
    InvalidPluginDefinitionError,
    PluginAggregateError,
    PluginAlreadyInstalledError,
    PluginCapabilityError,
    PluginKernelDisposedError,
    PluginKernelStateError,
    PluginLifecycleError,
    PluginNotInstalledError,
    PluginSetupError,
    PluginVersionMismatchError,
} from './errors.js';
import { OperationRegistry, type OperationDefinition } from './operation-registry.js';
import { isPluginRef, type PluginRef } from './plugin-ref.js';
import { PluginStateStore } from './plugin-state-store.js';
import type {
    EditorPlugin,
    EditorPluginDefinition,
    PluginCapabilityReader,
    PluginCommittedEventAccess,
    PluginCommittedEventSetupAccess,
    PluginLifecycleContext,
    PluginOperationAccess,
    PluginOperationSetupAccess,
    PluginSetupContext,
    PluginToolAccess,
    PluginToolSetupAccess,
    SynchronousEditorPlugin,
} from './plugin-types.js';
import { RegistrationScope } from './registration-scope.js';
import { reportErrorSafely, type PluginErrorSink, type PluginWarningSink } from './reporting.js';
import { isValidSemVer } from './semver.js';
import { ToolCoordinator, type ToolDefinition, type ToolExitReason } from './tool-coordinator.js';

export type PluginHostState = 'created' | 'initializing' | 'initialized' | 'disposing' | 'disposed';

export interface PluginManagerOptions {
    readonly warningSink?: PluginWarningSink;
    readonly errorSink?: PluginErrorSink;
    readonly hostCapabilities?: readonly PluginHostCapabilityProvider[];
}

export interface PluginHostCapabilityProvider {
    readonly token: CapabilityIdentity;
    readonly implementation: unknown;
    readonly providerId?: string;
}

interface InstalledPluginRecord<TEvents extends object> {
    readonly plugin: EditorPluginDefinition<TEvents>;
    readonly refObject: object;
    readonly api: unknown;
    readonly scope: RegistrationScope;
    readonly lifecycleContext: PluginLifecycleContext<TEvents>;
}

interface InstallOutcome {
    readonly api: unknown;
}

interface ResolvedCapability {
    readonly token: object;
    readonly value: unknown | null;
}

function isPluginApi(value: unknown): boolean {
    return (typeof value === 'object' && value !== null) || typeof value === 'function';
}

export class PluginManager<TEvents extends object = PluginEventMap> implements Disposable {
    private readonly capabilityRegistry: CapabilityRegistry;
    private readonly operationRegistry = new OperationRegistry();
    private readonly toolCoordinator: ToolCoordinator;
    private readonly eventBus: CommittedEventBus<TEvents>;
    private readonly stateStore = new PluginStateStore();
    private readonly installed = new Map<string, InstalledPluginRecord<TEvents>>();
    private readonly installationOrder: string[] = [];
    private hostState: PluginHostState = 'created';
    private topLevelInstallActive = false;
    private disposePromise: Promise<void> | null = null;

    constructor(private readonly options: PluginManagerOptions = {}) {
        this.capabilityRegistry = new CapabilityRegistry(options);
        this.toolCoordinator = new ToolCoordinator({ errorSink: options.errorSink });
        this.eventBus = new CommittedEventBus<TEvents>(options);
        for (const provider of options.hostCapabilities ?? []) {
            this.capabilityRegistry.provideHost(
                provider.token,
                provider.implementation,
                provider.providerId,
            );
        }
    }

    get state(): PluginHostState {
        return this.hostState;
    }

    async install<TApi>(plugin: EditorPlugin<TApi, TEvents>): Promise<TApi> {
        this.assertCanInstall();
        if (this.topLevelInstallActive) {
            throw new PluginKernelStateError(
                'start a concurrent plugin installation',
                this.hostState,
            );
        }
        this.topLevelInstallActive = true;
        try {
            const outcome = await this.performInstall(plugin, 'strict', []);
            // The installed API was produced by the same typed plugin argument.
            return outcome.api as TApi;
        } finally {
            this.topLevelInstallActive = false;
        }
    }

    installSync<TApi>(plugin: SynchronousEditorPlugin<TApi, TEvents>): TApi {
        this.assertCanInstall();
        if (this.topLevelInstallActive) {
            throw new PluginKernelStateError(
                'start a concurrent plugin installation',
                this.hostState,
            );
        }
        this.topLevelInstallActive = true;
        try {
            const outcome = this.performInstallSync(plugin, 'strict', []);
            return outcome.api as TApi;
        } finally {
            this.topLevelInstallActive = false;
        }
    }

    get<TApi>(ref: PluginRef<TApi>): TApi | null {
        this.assertUsable('query a plugin');
        const record = this.installed.get(ref.id);
        if (!record || record.refObject !== ref) return null;
        // Ref identity and its invariant phantom type protect this boundary cast.
        return record.api as TApi;
    }

    require<TApi>(ref: PluginRef<TApi>): TApi {
        const api = this.get(ref);
        if (api === null) throw new PluginNotInstalledError(ref.id);
        return api;
    }

    getById(pluginId: string): unknown | null {
        this.assertUsable('query a plugin by id');
        return this.installed.get(pluginId)?.api ?? null;
    }

    has<TApi>(refOrId: PluginRef<TApi> | string): boolean {
        this.assertUsable('inspect installed plugins');
        if (typeof refOrId === 'string') return this.installed.has(refOrId);
        const record = this.installed.get(refOrId.id);
        return record?.refObject === refOrId;
    }

    /** @internal Used by Core coordinators after a Feature registered its operation. */
    hasOperation(operationId: string): boolean {
        return this.operationRegistry.has(operationId);
    }

    /** @internal Registers host-owned Core operations before initialization. */
    registerHostOperation(definition: OperationDefinition): Disposable {
        this.assertCanInstall();
        return this.operationRegistry.register(definition, '@bensitu/core');
    }

    /** @internal Used by Core coordinators to acquire a Feature-owned operation. */
    beginOperationForHost(operationId: string) {
        if (!this.toolCoordinator.canRunOperation(operationId)) {
            throw new PluginKernelStateError(
                `run operation "${operationId}" while the active tool rejects it`,
                this.hostState,
            );
        }
        return this.operationRegistry.beginForHost(operationId);
    }

    /** @internal Used by Core services for committed observation. */
    emitCommitted<TKey extends keyof TEvents & string>(eventName: TKey, payload: TEvents[TKey]) {
        return this.eventBus.emitCommitted(eventName, payload);
    }

    async initialize(): Promise<void> {
        this.assertUsable('initialize the Plugin Kernel');
        if (this.hostState !== 'created' || this.topLevelInstallActive) {
            throw new PluginKernelStateError('initialize the Plugin Kernel', this.hostState);
        }
        this.hostState = 'initializing';
        try {
            for (const pluginId of this.installationOrder) {
                const record = this.installed.get(pluginId);
                if (!record?.plugin.onInit) continue;
                try {
                    await record.plugin.onInit(record.lifecycleContext);
                } catch (error) {
                    throw new PluginLifecycleError(pluginId, 'init', error);
                }
            }
            this.hostState = 'initialized';
        } catch (error) {
            this.hostState = 'disposing';
            const cleanupErrors = await this.cleanupAll();
            this.hostState = 'disposed';
            const lifecycleError =
                error instanceof PluginLifecycleError
                    ? error
                    : new PluginLifecycleError('plugin-kernel', 'init', error);
            throw new PluginLifecycleError(
                lifecycleError.pluginId ?? 'plugin-kernel',
                'init',
                lifecycleError.cause,
                cleanupErrors,
            );
        }
    }

    initializeSync(): void {
        this.assertUsable('initialize the Plugin Kernel');
        if (this.hostState !== 'created' || this.topLevelInstallActive) {
            throw new PluginKernelStateError('initialize the Plugin Kernel', this.hostState);
        }
        this.hostState = 'initializing';
        try {
            for (const pluginId of this.installationOrder) {
                const record = this.installed.get(pluginId);
                if (!record?.plugin.onInit) continue;
                const result = record.plugin.onInit(record.lifecycleContext);
                if (isPromiseLike(result)) {
                    throw new PluginLifecycleError(
                        pluginId,
                        'init',
                        new Error('Synchronous plugin onInit returned a Promise.'),
                    );
                }
            }
            this.hostState = 'initialized';
        } catch (error) {
            this.hostState = 'disposing';
            const cleanupErrors = this.cleanupAllSync();
            this.hostState = 'disposed';
            const lifecycleError =
                error instanceof PluginLifecycleError
                    ? error
                    : new PluginLifecycleError('plugin-kernel', 'init', error);
            throw new PluginLifecycleError(
                lifecycleError.pluginId ?? 'plugin-kernel',
                'init',
                lifecycleError.cause,
                cleanupErrors,
            );
        }
    }

    async notifyImageLoaded(image: unknown): Promise<void> {
        this.assertLifecycleReady('notify plugins that an image loaded');
        for (const pluginId of this.installationOrder) {
            const record = this.installed.get(pluginId);
            if (!record?.plugin.onImageLoaded) continue;
            try {
                await record.plugin.onImageLoaded(image, record.lifecycleContext);
            } catch (error) {
                throw new PluginLifecycleError(pluginId, 'image-loaded', error);
            }
        }
    }

    async notifyImageCleared(): Promise<void> {
        this.assertLifecycleReady('notify plugins that an image cleared');
        for (const pluginId of this.installationOrder) {
            const record = this.installed.get(pluginId);
            if (!record?.plugin.onImageCleared) continue;
            try {
                await record.plugin.onImageCleared(record.lifecycleContext);
            } catch (error) {
                throw new PluginLifecycleError(pluginId, 'image-cleared', error);
            }
        }
    }

    dispose(): Promise<void> {
        if (this.hostState === 'disposed') return Promise.resolve();
        if (this.hostState === 'disposing') return this.disposePromise ?? Promise.resolve();
        if (this.hostState === 'initializing') {
            return Promise.reject(
                new PluginKernelStateError('dispose the Plugin Kernel', this.hostState),
            );
        }
        this.hostState = 'disposing';
        this.disposePromise = this.performDispose();
        return this.disposePromise;
    }

    disposeSync(): void {
        if (this.hostState === 'disposed') return;
        if (this.hostState === 'disposing' || this.hostState === 'initializing') {
            throw new PluginKernelStateError(
                'dispose the Plugin Kernel synchronously',
                this.hostState,
            );
        }
        this.hostState = 'disposing';
        const errors = this.cleanupAllSync();
        this.hostState = 'disposed';
        if (errors.length > 0) {
            throw new PluginAggregateError(
                '[ImageEditor] Plugin Kernel synchronous disposal completed with cleanup errors.',
                errors,
            );
        }
    }

    private async performInstall(
        plugin: EditorPluginDefinition<TEvents>,
        mode: 'strict' | 'ensure',
        parentStack: readonly string[],
    ): Promise<InstallOutcome> {
        this.validatePluginDefinition(plugin);
        const pluginId = plugin.ref.id;
        if (parentStack.includes(pluginId)) {
            throw new InvalidPluginDefinitionError(
                `Plugin dependency cycle detected: ${[...parentStack, pluginId].join(' -> ')}.`,
                pluginId,
            );
        }

        const existing = this.installed.get(pluginId);
        if (existing) {
            if (mode === 'strict') throw new PluginAlreadyInstalledError(pluginId);
            const compatible =
                existing.plugin.version === plugin.version &&
                existing.plugin.ref.apiVersion === plugin.ref.apiVersion &&
                existing.refObject === plugin.ref;
            if (!compatible) {
                throw new PluginVersionMismatchError(
                    pluginId,
                    existing.plugin.version,
                    plugin.version,
                    existing.plugin.ref.apiVersion,
                    plugin.ref.apiVersion,
                );
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
                throw new InvalidPluginDefinitionError(
                    `Plugin "${pluginId}" setup must return a non-null object or function API.`,
                    pluginId,
                );
            }
            scope.commit();
            const record: InstalledPluginRecord<TEvents> = {
                plugin,
                refObject: plugin.ref,
                api,
                scope,
                lifecycleContext: contexts.lifecycle,
            };
            this.installed.set(pluginId, record);
            this.installationOrder.push(pluginId);
            return { api };
        } catch (error) {
            const cleanupErrors = await scope.rollback();
            throw new PluginSetupError(pluginId, error, cleanupErrors);
        }
    }

    private performInstallSync<TApi>(
        plugin: SynchronousEditorPlugin<TApi, TEvents>,
        mode: 'strict' | 'ensure',
        parentStack: readonly string[],
    ): InstallOutcome {
        this.validatePluginDefinition(plugin);
        if (plugin.setupMode !== 'sync') {
            throw new InvalidPluginDefinitionError(
                `Plugin "${plugin.ref.id}" must declare setupMode "sync" for installSync().`,
                plugin.ref.id,
            );
        }
        const pluginId = plugin.ref.id;
        if (parentStack.includes(pluginId)) {
            throw new InvalidPluginDefinitionError(
                `Plugin dependency cycle detected: ${[...parentStack, pluginId].join(' -> ')}.`,
                pluginId,
            );
        }
        const existing = this.installed.get(pluginId);
        if (existing) {
            if (mode === 'strict') throw new PluginAlreadyInstalledError(pluginId);
            const compatible =
                existing.plugin.version === plugin.version &&
                existing.plugin.ref.apiVersion === plugin.ref.apiVersion &&
                existing.refObject === plugin.ref;
            if (!compatible) {
                throw new PluginVersionMismatchError(
                    pluginId,
                    existing.plugin.version,
                    plugin.version,
                    existing.plugin.ref.apiVersion,
                    plugin.ref.apiVersion,
                );
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
                throw new InvalidPluginDefinitionError(
                    `Plugin "${pluginId}" returned a Promise from synchronous setup.`,
                    pluginId,
                );
            }
            if (!isPluginApi(api)) {
                throw new InvalidPluginDefinitionError(
                    `Plugin "${pluginId}" setup must return a non-null object or function API.`,
                    pluginId,
                );
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
        } catch (error) {
            const cleanupErrors = scope.rollbackSync();
            throw new PluginSetupError(pluginId, error, cleanupErrors);
        }
    }

    private resolveCapabilities(plugin: EditorPluginDefinition<TEvents>): {
        readonly required: ReadonlyMap<string, ResolvedCapability>;
        readonly optional: ReadonlyMap<string, ResolvedCapability>;
    } {
        const required = new Map<string, ResolvedCapability>();
        const optional = new Map<string, ResolvedCapability>();
        for (const requirement of plugin.requires ?? []) {
            required.set(requirement.token.id, {
                token: requirement.token,
                value: this.capabilityRegistry.requireDefinition(requirement, plugin.ref.id),
            });
        }
        for (const requirement of plugin.optional ?? []) {
            optional.set(requirement.token.id, {
                token: requirement.token,
                value: this.capabilityRegistry.optionalDefinition(requirement, plugin.ref.id),
            });
        }
        return { required, optional };
    }

    private createContexts(
        pluginId: string,
        scope: RegistrationScope,
        required: ReadonlyMap<string, ResolvedCapability>,
        optional: ReadonlyMap<string, ResolvedCapability>,
        stack: readonly string[],
    ): {
        readonly setup: PluginSetupContext<TEvents>;
        readonly lifecycle: PluginLifecycleContext<TEvents>;
    } {
        const state = this.stateStore.createScoped(
            pluginId,
            (disposable) => scope.add(disposable),
            (disposable) => scope.addFinalizer(disposable),
            () => scope.active,
        );
        const capabilities: PluginCapabilityReader = Object.freeze({
            require: <TPort>(token: CapabilityToken<TPort>): TPort => {
                const resolved = required.get(token.id);
                if (!resolved || resolved.token !== token) {
                    throw new PluginCapabilityError({
                        consumerPluginId: pluginId,
                        capabilityId: token.id,
                        requestedRange: 'undeclared-required-capability',
                        reason: 'missing',
                    });
                }
                return resolved.value as TPort;
            },
            optional: <TPort>(token: CapabilityToken<TPort>): TPort | null => {
                const resolved = optional.get(token.id);
                if (!resolved || resolved.token !== token) {
                    throw new PluginCapabilityError({
                        consumerPluginId: pluginId,
                        capabilityId: token.id,
                        requestedRange: 'undeclared-optional-capability',
                        reason: 'missing',
                    });
                }
                return resolved.value as TPort | null;
            },
        });
        const operations: PluginOperationAccess = Object.freeze({
            begin: (operationId: string) => this.operationRegistry.begin(operationId, pluginId),
            get: (operationId: string) => this.operationRegistry.get(operationId),
            isActive: (operationId?: string) => this.operationRegistry.isActive(operationId),
        });
        const tools: PluginToolAccess = Object.freeze({
            enter: (toolId: string) => this.toolCoordinator.enter(toolId, pluginId),
            exit: (reason?: ToolExitReason) => this.toolCoordinator.exit(reason),
            getActiveToolId: () => this.toolCoordinator.getActiveToolId(),
            canRunOperation: (operationId: string) =>
                this.toolCoordinator.canRunOperation(operationId),
        });
        const events: PluginCommittedEventAccess<TEvents> = Object.freeze({
            emitCommitted: <TKey extends keyof TEvents & string>(
                eventName: TKey,
                payload: TEvents[TKey],
            ) => this.eventBus.emitCommitted(eventName, payload),
        });
        const lifecycle: PluginLifecycleContext<TEvents> = Object.freeze({
            pluginId,
            state,
            capabilities,
            operations,
            tools,
            events,
        });

        const setupCapabilities = Object.freeze({
            ...capabilities,
            provide: <TPort>(token: CapabilityToken<TPort>, implementation: TPort): Disposable => {
                scope.assertOpen();
                return scope.add(
                    this.capabilityRegistry.providePending(
                        token,
                        implementation,
                        pluginId,
                        scope.transactionId,
                    ),
                );
            },
        });
        const setupOperations: PluginOperationSetupAccess = Object.freeze({
            ...operations,
            register: (definition: OperationDefinition) => {
                scope.assertOpen();
                return scope.add(this.operationRegistry.register(definition, pluginId));
            },
        });
        const setupTools: PluginToolSetupAccess = Object.freeze({
            ...tools,
            register: (definition: ToolDefinition) => {
                scope.assertOpen();
                return scope.add(this.toolCoordinator.register(definition, pluginId));
            },
        });
        const setupEvents: PluginCommittedEventSetupAccess<TEvents> = Object.freeze({
            ...events,
            on: <TKey extends keyof TEvents & string>(
                eventName: TKey,
                listener: CommittedEventListener<TEvents[TKey]>,
            ) => {
                scope.assertOpen();
                return scope.add(this.eventBus.on(eventName, listener));
            },
        });

        const ensurePluginNow = async (
            dependency: EditorPluginDefinition<TEvents>,
        ): Promise<unknown> => {
            scope.assertOpen('ensure a composed plugin dependency');
            const before = new Set(this.installationOrder);
            const outcome = await this.performInstall(dependency, 'ensure', stack);
            const newlyInstalled = this.installationOrder.filter((id) => !before.has(id));
            for (const installedPluginId of newlyInstalled) {
                scope.addRollback(
                    createDisposable(() => this.rollbackInstalledPlugin(installedPluginId)),
                );
            }
            return outcome.api;
        };
        let ensureQueue: Promise<void> = Promise.resolve();
        const ensurePlugin = (dependency: EditorPluginDefinition<TEvents>): Promise<unknown> => {
            const result = ensureQueue.then(() => ensurePluginNow(dependency));
            ensureQueue = result.then(
                () => undefined,
                () => undefined,
            );
            return result;
        };
        const setup: PluginSetupContext<TEvents> = Object.freeze({
            pluginId,
            state,
            capabilities: setupCapabilities,
            operations: setupOperations,
            tools: setupTools,
            events: setupEvents,
            addDisposable: (disposable: Disposable): Disposable => {
                scope.assertOpen();
                return scope.add(disposable);
            },
            ensure: async <TApi>(dependency: EditorPlugin<TApi, TEvents>): Promise<TApi> => {
                const api = await ensurePlugin(dependency);
                return api as TApi;
            },
            ensurePlugin,
        });
        return { setup, lifecycle };
    }

    private async rollbackInstalledPlugin(pluginId: string): Promise<void> {
        const record = this.installed.get(pluginId);
        if (!record) return;
        this.installed.delete(pluginId);
        const orderIndex = this.installationOrder.lastIndexOf(pluginId);
        if (orderIndex >= 0) this.installationOrder.splice(orderIndex, 1);
        const errors: unknown[] = [];

        if (record.plugin.onDispose) {
            try {
                await record.plugin.onDispose(record.lifecycleContext);
            } catch (error) {
                errors.push(new PluginLifecycleError(pluginId, 'dispose', error));
            }
        }
        try {
            await record.scope.dispose();
        } catch (error) {
            errors.push(error);
        }
        if (errors.length > 0) {
            throw new PluginAggregateError(
                `[ImageEditor] Rollback of composed plugin "${pluginId}" failed.`,
                errors,
                { pluginId },
            );
        }
    }

    private validatePluginDefinition(plugin: EditorPluginDefinition<TEvents>): void {
        if (typeof plugin !== 'object' || plugin === null) {
            throw new InvalidPluginDefinitionError('Plugin definition must be an object.');
        }
        if (!isPluginRef(plugin.ref)) {
            throw new InvalidPluginDefinitionError(
                'Plugin definition must use a PluginRef created by definePluginRef().',
            );
        }
        if (!isValidSemVer(plugin.version)) {
            throw new InvalidPluginDefinitionError(
                `Plugin "${plugin.ref.id}" has invalid implementation SemVer "${plugin.version}".`,
                plugin.ref.id,
            );
        }
        if (typeof plugin.setup !== 'function') {
            throw new InvalidPluginDefinitionError(
                `Plugin "${plugin.ref.id}" must define setup().`,
                plugin.ref.id,
            );
        }

        const capabilityIds = new Set<string>();
        const validateRequirements = (
            requirements: readonly CapabilityRequirementIdentity[] | undefined,
            kind: 'required' | 'optional',
        ): void => {
            for (const requirement of requirements ?? []) {
                try {
                    assertCapabilityRequirement(requirement);
                } catch (error) {
                    throw new InvalidPluginDefinitionError(
                        `Plugin "${plugin.ref.id}" has an invalid ${kind} capability requirement.`,
                        plugin.ref.id,
                        error,
                    );
                }
                if (capabilityIds.has(requirement.token.id)) {
                    throw new InvalidPluginDefinitionError(
                        `Plugin "${plugin.ref.id}" declares capability "${requirement.token.id}" more than once.`,
                        plugin.ref.id,
                    );
                }
                capabilityIds.add(requirement.token.id);
            }
        };
        validateRequirements(plugin.requires, 'required');
        validateRequirements(plugin.optional, 'optional');
    }

    private async performDispose(): Promise<void> {
        const errors = await this.cleanupAll();
        this.hostState = 'disposed';
        if (errors.length > 0) {
            throw new PluginAggregateError(
                '[ImageEditor] Plugin Kernel disposal completed with cleanup errors.',
                errors,
            );
        }
    }

    private async cleanupAll(): Promise<readonly unknown[]> {
        const errors: unknown[] = [];
        const records = [...this.installationOrder]
            .reverse()
            .map((pluginId) => this.installed.get(pluginId))
            .filter((record): record is InstalledPluginRecord<TEvents> => record !== undefined);

        for (const record of records) {
            if (!record.plugin.onDispose) continue;
            try {
                await record.plugin.onDispose(record.lifecycleContext);
            } catch (error) {
                const lifecycleError = new PluginLifecycleError(
                    record.plugin.ref.id,
                    'dispose',
                    error,
                );
                errors.push(lifecycleError);
                reportErrorSafely(this.options.errorSink, lifecycleError);
            }
        }
        for (const record of records) {
            try {
                await record.scope.dispose();
            } catch (error) {
                errors.push(error);
                reportErrorSafely(this.options.errorSink, error);
            }
        }

        this.installed.clear();
        this.installationOrder.length = 0;
        const kernelDisposables: readonly Disposable[] = [
            this.toolCoordinator,
            this.operationRegistry,
            this.eventBus,
            this.capabilityRegistry,
            this.stateStore,
        ];
        for (const disposable of kernelDisposables) {
            try {
                await disposable.dispose();
            } catch (error) {
                errors.push(error);
                reportErrorSafely(this.options.errorSink, error);
            }
        }
        return errors;
    }

    private cleanupAllSync(): readonly unknown[] {
        const errors: unknown[] = [];
        const records = [...this.installationOrder]
            .reverse()
            .map((pluginId) => this.installed.get(pluginId))
            .filter((record): record is InstalledPluginRecord<TEvents> => record !== undefined);

        for (const record of records) {
            if (!record.plugin.onDispose) continue;
            try {
                const result = record.plugin.onDispose(record.lifecycleContext);
                if (isPromiseLike(result)) {
                    void Promise.resolve(result).catch((error: unknown) => {
                        reportErrorSafely(this.options.errorSink, error);
                    });
                    throw new PluginLifecycleError(
                        record.plugin.ref.id,
                        'dispose',
                        new Error('Synchronous plugin onDispose returned a Promise.'),
                    );
                }
            } catch (error) {
                const lifecycleError =
                    error instanceof PluginLifecycleError
                        ? error
                        : new PluginLifecycleError(record.plugin.ref.id, 'dispose', error);
                errors.push(lifecycleError);
                reportErrorSafely(this.options.errorSink, lifecycleError);
            }
        }
        for (const record of records) {
            try {
                record.scope.disposeSync();
            } catch (error) {
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
            } catch (error) {
                errors.push(error);
                reportErrorSafely(this.options.errorSink, error);
            }
        }
        return Object.freeze(errors);
    }

    private assertCanInstall(): void {
        this.assertUsable('install a plugin');
        if (this.hostState !== 'created') {
            throw new PluginKernelStateError('install a plugin', this.hostState);
        }
    }

    private assertLifecycleReady(operation: string): void {
        this.assertUsable(operation);
        if (this.hostState !== 'initialized') {
            throw new PluginKernelStateError(operation, this.hostState);
        }
    }

    private assertUsable(operation: string): void {
        if (this.hostState === 'disposed' || this.hostState === 'disposing') {
            throw new PluginKernelDisposedError(operation);
        }
    }
}
