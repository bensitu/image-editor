import { type PluginEventMap } from './committed-event-bus.js';
import { type Disposable } from './disposable.js';
import { type PluginRef } from './plugin-ref.js';
import type { EditorPlugin } from './plugin-types.js';
import { type PluginErrorSink, type PluginWarningSink } from './reporting.js';
export type PluginHostState = 'created' | 'initializing' | 'initialized' | 'disposing' | 'disposed';
export interface PluginManagerOptions {
    readonly warningSink?: PluginWarningSink;
    readonly errorSink?: PluginErrorSink;
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
    get<TApi>(ref: PluginRef<TApi>): TApi | null;
    require<TApi>(ref: PluginRef<TApi>): TApi;
    getById(pluginId: string): unknown | null;
    has<TApi>(refOrId: PluginRef<TApi> | string): boolean;
    initialize(): Promise<void>;
    notifyImageLoaded(image: unknown): Promise<void>;
    notifyImageCleared(): Promise<void>;
    dispose(): Promise<void>;
    private performInstall;
    private resolveCapabilities;
    private createContexts;
    private rollbackInstalledPlugin;
    private validatePluginDefinition;
    private performDispose;
    private cleanupAll;
    private assertCanInstall;
    private assertLifecycleReady;
    private assertUsable;
}
