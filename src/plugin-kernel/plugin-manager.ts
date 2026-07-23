/**
 * Installs and initializes Plugins while enforcing dependencies, capabilities, permissions, operations, and rollback.
 *
 * @module
 */

import type { CapabilityToken } from './capability-token.js';
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
    PluginBatchInstallError,
    PluginCapabilityError,
    PluginDefinitionConflictError,
    PluginDependencyCycleError,
    PluginDependencyError,
    PluginKernelDisposedError,
    PluginKernelStateError,
    PluginLifecycleError,
    PluginNotInstalledError,
    PluginPermissionError,
    PluginSetupError,
    PluginVersionMismatchError,
} from './errors.js';
import {
    acquirePluginDefinitionLease,
    releasePluginDefinitionLease,
    resolvePluginDefinitionIdentity,
} from './plugin-definition-lease.js';
import {
    OperationRegistry,
    type OperationDefinition,
    type OperationExecutionContext,
    type OperationRunOptions,
} from './operation-registry.js';
import { validatePluginManifest } from './plugin-manifest.js';
import { isPluginRef, type PluginIdentity, type PluginRef } from './plugin-ref.js';
import { PluginStateStore } from './plugin-state-store.js';
import type {
    CapabilityProviderOptions,
    EditorPlugin,
    EditorPluginDefinition,
    DisposableScope,
    PluginDefinitionInput,
    PluginManifest,
    PluginCapabilityReader,
    PluginCommittedEventAccess,
    PluginCommittedEventSetupAccess,
    PluginLifecycleContext,
    PluginOperationAccess,
    PluginOperationSetupAccess,
    OptionalCapabilityStatus,
    PluginSetupContext,
    PluginToolAccess,
    PluginToolSetupAccess,
    PluginPermission,
    SynchronousEditorPlugin,
} from './plugin-types.js';
import { RegistrationScope } from './registration-scope.js';
import { reportErrorSafely, type PluginErrorSink, type PluginWarningSink } from './reporting.js';
import { ToolCoordinator, type ToolDefinition, type ToolExitReason } from './tool-coordinator.js';

export type PluginHostState = 'created' | 'initializing' | 'initialized' | 'disposing' | 'disposed';

export interface PluginManagerOptions {
    readonly warningSink?: PluginWarningSink;
    readonly errorSink?: PluginErrorSink;
    readonly hostCapabilities?: readonly PluginHostCapabilityProvider[];
}

export interface PluginHostCapabilityProvider {
    readonly token: CapabilityToken<unknown>;
    readonly implementation: unknown;
    readonly providerId?: string;
    readonly requiredPermission?: PluginPermission;
}

interface InstalledPluginRecord<TEvents extends object> {
    readonly plugin: NormalizedPluginDefinition<TEvents>;
    readonly refObject: object;
    readonly api: unknown;
    readonly scope: RegistrationScope;
    readonly lifecycleContext: PluginLifecycleContext<TEvents>;
}

interface NormalizedPluginDefinition<
    TEvents extends object,
> extends EditorPluginDefinition<TEvents> {
    readonly ref: PluginRef<unknown>;
    readonly manifest: PluginManifest;
    readonly setupMode?: 'sync';
    readonly leaseIdentity: object;
}

interface InstallOutcome {
    readonly api: unknown;
}

export interface PluginBatchInstallOutcome<TEvents extends object> {
    readonly apisByPluginId: ReadonlyMap<string, unknown>;
    readonly installedPlugins: readonly EditorPluginDefinition<TEvents>[];
}

interface PreparedBatchPlugin<TEvents extends object> {
    readonly plugin: NormalizedPluginDefinition<TEvents>;
}

interface PreparedBatch<TEvents extends object> {
    readonly ordered: readonly PreparedBatchPlugin<TEvents>[];
    readonly apisByPluginId: Map<string, unknown>;
}

interface ResolvedCapability {
    readonly token: object;
    readonly value: unknown | null;
    readonly status?: OptionalCapabilityStatus;
}

function isPluginApi(value: unknown): boolean {
    return (typeof value === 'object' && value !== null) || typeof value === 'function';
}

function sameArray<TValue>(
    left: readonly TValue[] | undefined,
    right: readonly TValue[] | undefined,
    equal: (leftValue: TValue, rightValue: TValue) => boolean,
): boolean {
    if (left === undefined || right === undefined) return left === right;
    return (
        left.length === right.length &&
        left.every((leftValue, index) => equal(leftValue, right[index]!))
    );
}

function sameInstallationDefinition<TEvents extends object>(
    left: NormalizedPluginDefinition<TEvents>,
    right: NormalizedPluginDefinition<TEvents>,
): boolean {
    return (
        left.ref === right.ref &&
        left.manifest.id === right.manifest.id &&
        left.manifest.version === right.manifest.version &&
        left.manifest.apiVersion === right.manifest.apiVersion &&
        left.manifest.engine === right.manifest.engine &&
        sameArray(
            left.manifest.requiresPlugins,
            right.manifest.requiresPlugins,
            (leftRef, rightRef) => leftRef === rightRef,
        ) &&
        sameArray(
            left.manifest.requires,
            right.manifest.requires,
            (leftRequirement, rightRequirement) =>
                leftRequirement.token === rightRequirement.token &&
                leftRequirement.range === rightRequirement.range,
        ) &&
        sameArray(
            left.manifest.optional,
            right.manifest.optional,
            (leftRequirement, rightRequirement) =>
                leftRequirement.token === rightRequirement.token &&
                leftRequirement.range === rightRequirement.range,
        ) &&
        sameArray(
            left.manifest.permissions,
            right.manifest.permissions,
            (leftPermission, rightPermission) => leftPermission === rightPermission,
        ) &&
        left.setupMode === right.setupMode &&
        left.setup === right.setup &&
        left.onInit === right.onInit &&
        left.onImageLoaded === right.onImageLoaded &&
        left.onImageCleared === right.onImageCleared &&
        left.onDispose === right.onDispose
    );
}

const pluginPackageHints = new Map<string, string>([
    ['foundation:overlay', '@bensitu/image-editor/plugins/overlay'],
    ['plugin:transform', '@bensitu/image-editor/plugins/transform'],
    ['plugin:mask', '@bensitu/image-editor/plugins/mask'],
    ['plugin:history', '@bensitu/image-editor/plugins/history'],
    ['plugin:filters', '@bensitu/image-editor/plugins/filters'],
]);

export class PluginManager<TEvents extends object = PluginEventMap> implements Disposable {
    declare private readonly capabilityRegistry: CapabilityRegistry;
    private readonly operationRegistry = new OperationRegistry();
    declare private readonly toolCoordinator: ToolCoordinator;
    declare private readonly eventBus: CommittedEventBus<TEvents>;
    private readonly stateStore = new PluginStateStore();
    private readonly installed = new Map<string, InstalledPluginRecord<TEvents>>();
    private readonly installationOrder: string[] = [];
    private hostState: PluginHostState = 'created';
    private topLevelInstallActive = false;
    private disposePromise: Promise<void> | null = null;

    constructor(private readonly options: PluginManagerOptions = {}) {
        this.capabilityRegistry = new CapabilityRegistry(options);
        this.toolCoordinator = new ToolCoordinator(
            options.errorSink ? { errorSink: options.errorSink } : {},
        );
        this.eventBus = new CommittedEventBus<TEvents>(options);
        for (const provider of options.hostCapabilities ?? []) {
            this.capabilityRegistry.provideHost(
                provider.token,
                provider.implementation,
                provider.providerId,
                provider.requiredPermission,
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

    /** @internal Core-facing atomic installation primitive for Plugin arrays and Plans. */
    installBatchSync(
        plugins: readonly PluginDefinitionInput<TEvents>[],
    ): PluginBatchInstallOutcome<TEvents> {
        this.assertCanInstall();
        if (this.topLevelInstallActive) {
            throw new PluginKernelStateError(
                'start a concurrent plugin installation',
                this.hostState,
            );
        }
        this.topLevelInstallActive = true;
        try {
            const prepared = this.prepareBatch(plugins);
            const visibleTransactions = new Set<symbol>();
            const pendingRecords: InstalledPluginRecord<TEvents>[] = [];
            try {
                for (const entry of prepared.ordered) {
                    const record = this.performPendingInstallSync(
                        entry.plugin,
                        visibleTransactions,
                    );
                    pendingRecords.push(record);
                    prepared.apisByPluginId.set(entry.plugin.ref.id, record.api);
                }
                for (const record of pendingRecords) record.scope.commit();
                for (const record of pendingRecords) {
                    const pluginId = record.plugin.ref.id;
                    this.installed.set(pluginId, record);
                    this.installationOrder.push(pluginId);
                }
            } catch (cause) {
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
        } finally {
            this.topLevelInstallActive = false;
        }
    }

    get<TApi>(ref: PluginRef<TApi>): TApi | null {
        this.assertUsable('query a plugin');
        const record = this.installed.get(ref.id);
        if (!record || record.refObject !== ref) return null;
        // Ref identity and its phantom API type protect this boundary cast.
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

    /** @internal Reads a registered operation definition for Core validation. */
    getOperationForHost(operationId: string): OperationDefinition | null {
        return this.operationRegistry.get(operationId);
    }

    /** @internal Registers host-owned Core operations before initialization. */
    registerHostOperation(definition: OperationDefinition): Disposable {
        this.assertCanInstall();
        return this.operationRegistry.register(definition, 'core:host');
    }

    /** @internal Used by Core coordinators to acquire a Feature-owned operation. */
    beginOperationForHost(operationId: string) {
        if (!this.canRunOperation(operationId)) {
            throw new PluginKernelStateError(
                `run operation "${operationId}" while the active tool rejects it`,
                this.hostState,
            );
        }
        return this.operationRegistry.beginForHost(operationId);
    }

    /** @internal Runs a registered operation on behalf of a Core coordinator. */
    runOperationForHost<TArgs, TResult>(
        operationId: string,
        args: TArgs,
        task: (args: TArgs, context: OperationExecutionContext) => Promise<TResult> | TResult,
        options: OperationRunOptions = {},
    ): Promise<TResult> {
        if (!this.canRunOperation(operationId)) {
            return Promise.reject(
                new PluginKernelStateError(
                    `run operation "${operationId}" while the active tool rejects it`,
                    this.hostState,
                ),
            );
        }
        return this.operationRegistry.runForHost(operationId, args, task, options);
    }

    /** @internal Resolves after active and pending operations have settled. */
    waitForOperations(): Promise<void> {
        return this.operationRegistry.waitForIdle();
    }

    /** @internal Reports whether synchronous Core disposal would race Plugin work. */
    hasRunningOperations(): boolean {
        return this.operationRegistry.hasInFlightOperations();
    }

    /** @internal Aborts active and pending operations during Core fault recovery. */
    abortOperationsForHost(reason: unknown): Promise<void> {
        return this.operationRegistry.abortAll(reason);
    }

    /** @internal Prevents new operations after Core enters the faulted state. */
    suspendOperationsForHost(reason: unknown): Promise<void> {
        return this.operationRegistry.suspend(reason);
    }

    /** @internal Exits the active tool before Core tears down the Canvas. */
    exitActiveToolForHost(): Promise<void> {
        return this.toolCoordinator.exit('host-dispose');
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
        if (this.operationRegistry.hasInFlightOperations()) {
            throw new PluginKernelStateError(
                'dispose the Plugin Kernel synchronously while operations are running',
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

    private prepareBatch(
        inputs: readonly PluginDefinitionInput<TEvents>[],
    ): PreparedBatch<TEvents> {
        if (!Array.isArray(inputs) || inputs.length === 0) {
            throw new InvalidPluginDefinitionError(
                'Plugin batch must contain at least one Plugin.',
            );
        }
        const candidatesById = new Map<string, PreparedBatchPlugin<TEvents>>();
        const apisByPluginId = new Map<string, unknown>();
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
        const dependencies = new Map<string, Set<string>>();
        for (const candidate of candidates) {
            const pluginDependencies = new Set<string>();
            for (const dependency of candidate.plugin.manifest.requiresPlugins ?? []) {
                const installedDependency = this.installed.get(dependency.id);
                if (installedDependency?.refObject === dependency) continue;
                const batchDependency = candidatesById.get(dependency.id);
                if (batchDependency?.plugin.ref === dependency) {
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
        const ordered: PreparedBatchPlugin<TEvents>[] = [];
        while (remaining.size > 0) {
            const next = candidates.find(
                (candidate) =>
                    remaining.has(candidate.plugin.ref.id) &&
                    [...(dependencies.get(candidate.plugin.ref.id) ?? [])].every(
                        (dependencyId) => !remaining.has(dependencyId),
                    ),
            );
            if (!next) {
                throw new PluginDependencyCycleError(
                    this.findDependencyCycle(remaining, dependencies),
                );
            }
            remaining.delete(next.plugin.ref.id);
            ordered.push(next);
        }
        return { ordered: Object.freeze(ordered), apisByPluginId };
    }

    private findDependencyCycle(
        remaining: ReadonlySet<string>,
        dependencies: ReadonlyMap<string, ReadonlySet<string>>,
    ): readonly string[] {
        const visited = new Set<string>();
        const visiting = new Set<string>();
        const stack: string[] = [];
        const visit = (pluginId: string): readonly string[] | null => {
            if (visiting.has(pluginId)) {
                const start = stack.indexOf(pluginId);
                return Object.freeze([...stack.slice(start), pluginId]);
            }
            if (visited.has(pluginId)) return null;
            visiting.add(pluginId);
            stack.push(pluginId);
            for (const dependencyId of dependencies.get(pluginId) ?? []) {
                if (!remaining.has(dependencyId)) continue;
                const cycle = visit(dependencyId);
                if (cycle) return cycle;
            }
            stack.pop();
            visiting.delete(pluginId);
            visited.add(pluginId);
            return null;
        };
        for (const pluginId of remaining) {
            const cycle = visit(pluginId);
            if (cycle) return cycle;
        }
        return Object.freeze([...remaining, remaining.values().next().value as string]);
    }

    private performPendingInstallSync(
        plugin: NormalizedPluginDefinition<TEvents>,
        visibleTransactions: Set<symbol>,
    ): InstalledPluginRecord<TEvents> {
        if (plugin.setupMode !== 'sync') {
            throw new InvalidPluginDefinitionError(
                `Plugin "${plugin.ref.id}" must declare setupMode "sync" for install().`,
                plugin.ref.id,
            );
        }
        const { required, optional } = this.resolveCapabilities(plugin, visibleTransactions);
        acquirePluginDefinitionLease(plugin.leaseIdentity, this, plugin.ref.id);
        const scope = new RegistrationScope(plugin.ref.id, this.options);
        visibleTransactions.add(scope.transactionId);
        try {
            const contexts = this.createContexts(plugin.ref, scope, required, optional, [
                plugin.ref.id,
            ]);
            const api = plugin.setup(contexts.setup);
            if (isPromiseLike(api)) {
                throw new InvalidPluginDefinitionError(
                    `Plugin "${plugin.ref.id}" returned a Promise from synchronous setup.`,
                    plugin.ref.id,
                );
            }
            if (!isPluginApi(api)) {
                throw new InvalidPluginDefinitionError(
                    `Plugin "${plugin.ref.id}" setup must return a non-null object or function API.`,
                    plugin.ref.id,
                );
            }
            return {
                plugin,
                refObject: plugin.ref,
                api,
                scope,
                lifecycleContext: contexts.lifecycle,
            };
        } catch (error) {
            visibleTransactions.delete(scope.transactionId);
            const cleanupErrors = scope.rollbackSync();
            releasePluginDefinitionLease(plugin.leaseIdentity, this);
            throw new PluginSetupError(plugin.ref.id, error, cleanupErrors);
        }
    }

    private rollbackPendingBatchSync(
        pendingRecords: readonly InstalledPluginRecord<TEvents>[],
    ): readonly unknown[] {
        const cleanupErrors: unknown[] = [];
        for (const record of [...pendingRecords].reverse()) {
            if (record.plugin.onDispose) {
                try {
                    const result = record.plugin.onDispose(record.lifecycleContext);
                    if (isPromiseLike(result)) {
                        void Promise.resolve(result).catch((error: unknown) => {
                            reportErrorSafely(this.options.errorSink, error);
                        });
                        throw new Error('Synchronous Plugin onDispose returned a Promise.');
                    }
                } catch (error) {
                    cleanupErrors.push(
                        new PluginLifecycleError(record.plugin.ref.id, 'dispose', error),
                    );
                }
            }
            cleanupErrors.push(...record.scope.rollbackSync());
            releasePluginDefinitionLease(record.plugin.leaseIdentity, this);
        }
        return Object.freeze(cleanupErrors);
    }

    private createDependencyError(
        consumerPluginId: string,
        dependency: PluginRef<unknown>,
        availablePluginIds: readonly string[],
    ): PluginDependencyError {
        return new PluginDependencyError({
            consumerPluginId,
            dependencyId: dependency.id,
            requiredApiVersion: dependency.apiVersion,
            availablePluginIds: Object.freeze([...new Set(availablePluginIds)].sort()),
            ...(pluginPackageHints.has(dependency.id)
                ? { packageHint: pluginPackageHints.get(dependency.id)! }
                : {}),
            planHint: 'Pass the dependency to install([...]) or include it in composePlugins(...).',
        });
    }

    private assertPluginDependenciesInstalled(plugin: NormalizedPluginDefinition<TEvents>): void {
        for (const dependency of plugin.manifest.requiresPlugins ?? []) {
            const installedDependency = this.installed.get(dependency.id);
            if (installedDependency?.refObject === dependency) continue;
            throw this.createDependencyError(plugin.ref.id, dependency, [...this.installed.keys()]);
        }
    }

    private async performInstall(
        input: PluginDefinitionInput<TEvents>,
        mode: 'strict' | 'ensure',
        parentStack: readonly string[],
    ): Promise<InstallOutcome> {
        const plugin = this.normalizePluginDefinition(input);
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
            const compatible = sameInstallationDefinition(existing.plugin, plugin);
            if (!compatible) {
                throw new PluginVersionMismatchError(
                    pluginId,
                    existing.plugin.manifest.version,
                    plugin.manifest.version,
                    existing.plugin.ref.apiVersion,
                    plugin.ref.apiVersion,
                );
            }
            return { api: existing.api };
        }

        this.assertPluginDependenciesInstalled(plugin);
        const { required, optional } = this.resolveCapabilities(plugin);
        acquirePluginDefinitionLease(plugin.leaseIdentity, this, pluginId);
        const scope = new RegistrationScope(pluginId, this.options);
        const stack = [...parentStack, pluginId];

        try {
            const contexts = this.createContexts(plugin.ref, scope, required, optional, stack);
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
            releasePluginDefinitionLease(plugin.leaseIdentity, this);
            throw new PluginSetupError(pluginId, error, cleanupErrors);
        }
    }

    private performInstallSync<TApi>(
        input: SynchronousEditorPlugin<TApi, TEvents>,
        mode: 'strict' | 'ensure',
        parentStack: readonly string[],
    ): InstallOutcome {
        const plugin = this.normalizePluginDefinition(input);
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
            const compatible = sameInstallationDefinition(existing.plugin, plugin);
            if (!compatible) {
                throw new PluginVersionMismatchError(
                    pluginId,
                    existing.plugin.manifest.version,
                    plugin.manifest.version,
                    existing.plugin.ref.apiVersion,
                    plugin.ref.apiVersion,
                );
            }
            return { api: existing.api };
        }
        this.assertPluginDependenciesInstalled(plugin);
        const { required, optional } = this.resolveCapabilities(plugin);
        acquirePluginDefinitionLease(plugin.leaseIdentity, this, pluginId);
        const scope = new RegistrationScope(pluginId, this.options);
        try {
            const contexts = this.createContexts(plugin.ref, scope, required, optional, [
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
            releasePluginDefinitionLease(plugin.leaseIdentity, this);
            throw new PluginSetupError(pluginId, error, cleanupErrors);
        }
    }

    private resolveCapabilities(
        plugin: NormalizedPluginDefinition<TEvents>,
        visibleTransactions?: ReadonlySet<symbol>,
    ): {
        readonly required: ReadonlyMap<string, ResolvedCapability>;
        readonly optional: ReadonlyMap<string, ResolvedCapability>;
    } {
        const required = new Map<string, ResolvedCapability>();
        const optional = new Map<string, ResolvedCapability>();
        for (const requirement of plugin.manifest.requires ?? []) {
            this.assertCapabilityPermission(plugin, requirement.token.id, visibleTransactions);
            required.set(requirement.token.id, {
                token: requirement.token,
                value: this.capabilityRegistry.requireDefinition(
                    requirement,
                    plugin.ref.id,
                    visibleTransactions,
                ),
            });
        }
        for (const requirement of plugin.manifest.optional ?? []) {
            this.assertCapabilityPermission(plugin, requirement.token.id, visibleTransactions);
            const value = this.capabilityRegistry.optionalDefinition(
                requirement,
                plugin.ref.id,
                visibleTransactions,
            );
            optional.set(requirement.token.id, {
                token: requirement.token,
                value,
                status:
                    value !== null
                        ? 'available'
                        : this.capabilityRegistry.getProviderInfo(requirement.token.id)
                          ? 'incompatible'
                          : 'missing',
            });
        }
        return { required, optional };
    }

    private assertCapabilityPermission(
        plugin: NormalizedPluginDefinition<TEvents>,
        capabilityId: string,
        visibleTransactions?: ReadonlySet<symbol>,
    ): void {
        const permission = this.capabilityRegistry.getRequiredPermission(
            capabilityId,
            visibleTransactions,
        );
        if (!permission || plugin.manifest.permissions?.includes(permission)) return;
        throw new PluginPermissionError(plugin.ref.id, permission, capabilityId);
    }

    private createContexts(
        plugin: PluginIdentity,
        scope: RegistrationScope,
        required: ReadonlyMap<string, ResolvedCapability>,
        optional: ReadonlyMap<string, ResolvedCapability>,
        stack: readonly string[],
    ): {
        readonly setup: PluginSetupContext<TEvents>;
        readonly lifecycle: PluginLifecycleContext<TEvents>;
    } {
        const pluginId = plugin.id;
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
            getOptionalStatus: <TPort>(token: CapabilityToken<TPort>): OptionalCapabilityStatus => {
                const resolved = optional.get(token.id);
                if (!resolved || resolved.token !== token) {
                    throw new PluginCapabilityError({
                        consumerPluginId: pluginId,
                        capabilityId: token.id,
                        requestedRange: 'undeclared-optional-capability',
                        reason: 'missing',
                    });
                }
                return resolved.status as OptionalCapabilityStatus;
            },
        });
        const operations: PluginOperationAccess = Object.freeze({
            begin: (operationId: string) => {
                if (!this.canRunOperation(operationId)) {
                    throw this.operationRejectedByTool(operationId);
                }
                return this.operationRegistry.begin(operationId, pluginId);
            },
            run: <TArgs, TResult>(
                operationId: string,
                args: TArgs,
                task: (
                    args: TArgs,
                    context: OperationExecutionContext,
                ) => Promise<TResult> | TResult,
                options: OperationRunOptions = {},
            ) =>
                this.canRunOperation(operationId)
                    ? this.operationRegistry.run(operationId, pluginId, args, task, options)
                    : Promise.reject(this.operationRejectedByTool(operationId)),
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
            provide: <TPort>(
                token: CapabilityToken<TPort>,
                implementation: TPort,
                options?: CapabilityProviderOptions,
            ): Disposable => {
                scope.assertOpen();
                return scope.add(
                    this.capabilityRegistry.providePending(
                        token,
                        implementation,
                        pluginId,
                        scope.transactionId,
                        options?.version ?? token.version,
                        options?.requiredPermission,
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
            dependency: PluginDefinitionInput<TEvents>,
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
        const ensurePlugin = (dependency: PluginDefinitionInput<TEvents>): Promise<unknown> => {
            const result = ensureQueue.then(() => ensurePluginNow(dependency));
            ensureQueue = result.then(
                () => undefined,
                () => undefined,
            );
            return result;
        };
        const disposables: DisposableScope = Object.freeze({
            get active(): boolean {
                return scope.active;
            },
            add: <TDisposable extends Disposable>(disposable: TDisposable): TDisposable => {
                scope.assertOpen();
                return scope.add(disposable);
            },
        });
        const setup: PluginSetupContext<TEvents> = Object.freeze({
            plugin,
            pluginId,
            state,
            capabilities: setupCapabilities,
            operations: setupOperations,
            tools: setupTools,
            events: setupEvents,
            disposables,
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
        releasePluginDefinitionLease(record.plugin.leaseIdentity, this);
        if (errors.length > 0) {
            throw new PluginAggregateError(
                `[ImageEditor] Rollback of composed plugin "${pluginId}" failed.`,
                errors,
                { pluginId },
            );
        }
    }

    private normalizePluginDefinition(
        plugin: PluginDefinitionInput<TEvents>,
    ): NormalizedPluginDefinition<TEvents> {
        if (typeof plugin !== 'object' || plugin === null) {
            throw new InvalidPluginDefinitionError('Plugin definition must be an object.');
        }
        if (!isPluginRef(plugin.ref)) {
            throw new InvalidPluginDefinitionError(
                'Plugin definition must use a PluginRef created by definePluginRef().',
            );
        }
        if (typeof plugin.setup !== 'function') {
            throw new InvalidPluginDefinitionError(
                `Plugin "${plugin.ref.id}" must define setup().`,
                plugin.ref.id,
            );
        }

        const manifest = validatePluginManifest(
            plugin.ref,
            'manifest' in plugin
                ? plugin.manifest
                : {
                      id: plugin.ref.id,
                      version: plugin.version,
                      apiVersion: plugin.ref.apiVersion,
                      engine: '*',
                      ...(plugin.requires ? { requires: plugin.requires } : {}),
                      ...(plugin.optional ? { optional: plugin.optional } : {}),
                      ...(plugin.permissions ? { permissions: plugin.permissions } : {}),
                  },
        );
        return Object.freeze({
            ...plugin,
            ref: plugin.ref,
            manifest,
            leaseIdentity: resolvePluginDefinitionIdentity(plugin),
        });
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
        try {
            await this.operationRegistry.suspend(
                new DOMException('Plugin Kernel disposal aborted active operations.', 'AbortError'),
            );
        } catch (error) {
            errors.push(error);
            reportErrorSafely(this.options.errorSink, error);
        }
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
            releasePluginDefinitionLease(record.plugin.leaseIdentity, this);
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
            releasePluginDefinitionLease(record.plugin.leaseIdentity, this);
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

    private canRunOperation(operationId: string): boolean {
        const activeToolId = this.toolCoordinator.getActiveToolId();
        const operation = this.operationRegistry.get(operationId);
        if (activeToolId && operation?.allowedDuringTool?.includes(activeToolId)) return true;
        return this.toolCoordinator.canRunOperation(operationId);
    }

    private operationRejectedByTool(operationId: string): PluginKernelStateError {
        return new PluginKernelStateError(
            `run operation "${operationId}" while the active tool rejects it`,
            this.hostState,
        );
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
