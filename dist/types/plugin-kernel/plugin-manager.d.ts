/**
 * Installs and initializes Plugins while enforcing dependencies, capabilities, permissions, operations, and rollback.
 *
 * @module
 */
import type { CapabilityToken } from './capability-token.js';
import { type PluginEventMap } from './committed-event-bus.js';
import { type Disposable } from './disposable.js';
import { type PluginRef } from './plugin-ref.js';
import type { EditorPlugin, EditorPluginDefinition, PluginPermission, SynchronousEditorPlugin } from './plugin-types.js';
import { type PluginErrorSink, type PluginWarningSink } from './reporting.js';
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
export interface PluginBatchInstallOutcome<TEvents extends object> {
    readonly apisByPluginId: ReadonlyMap<string, unknown>;
    readonly installedPlugins: readonly EditorPluginDefinition<TEvents>[];
}
export declare class PluginManager<TEvents extends object = PluginEventMap> implements Disposable {
    private readonly options;
    private readonly capabilityRegistry;
    private readonly operationRegistry;
    private readonly toolCoordinator;
    private readonly eventBus;
    private readonly stateStore;
    private readonly installed;
    private readonly installationOrder;
    private hostState;
    private topLevelInstallActive;
    private disposePromise;
    constructor(options?: PluginManagerOptions);
    get state(): PluginHostState;
    install<TApi>(plugin: EditorPlugin<TApi, TEvents>): Promise<TApi>;
    installSync<TApi>(plugin: SynchronousEditorPlugin<TApi, TEvents>): TApi;
    get<TApi>(ref: PluginRef<TApi>): TApi | null;
    require<TApi>(ref: PluginRef<TApi>): TApi;
    getById(pluginId: string): unknown | null;
    has<TApi>(refOrId: PluginRef<TApi> | string): boolean;
    initialize(): Promise<void>;
    initializeSync(): void;
    notifyImageLoaded(image: unknown): Promise<void>;
    notifyImageCleared(): Promise<void>;
    dispose(): Promise<void>;
    disposeSync(): void;
    private prepareBatch;
    private findDependencyCycle;
    private performPendingInstallSync;
    private rollbackPendingBatchSync;
    private createDependencyError;
    private assertPluginDependenciesInstalled;
    private performInstall;
    private performInstallSync;
    private resolveCapabilities;
    private assertCapabilityPermission;
    private createContexts;
    private rollbackInstalledPlugin;
    private normalizePluginDefinition;
    private performDispose;
    private cleanupAll;
    private cleanupAllSync;
    private assertCanInstall;
    private canRunOperation;
    private operationRejectedByTool;
    private assertLifecycleReady;
    private assertUsable;
}
