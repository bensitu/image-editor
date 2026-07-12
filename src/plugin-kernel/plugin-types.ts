import type { CapabilityRequirementIdentity, CapabilityToken } from './capability-token.js';
import type { CommittedEventListener, PluginEventMap } from './committed-event-bus.js';
import type { Disposable, MaybePromise } from './disposable.js';
import type { OperationDefinition, OperationToken } from './operation-registry.js';
import type { PluginIdentity, PluginRef } from './plugin-ref.js';
import type { ScopedPluginStateStore } from './plugin-state-store.js';
import type { ToolDefinition, ToolExitReason } from './tool-coordinator.js';

export interface PluginCapabilityReader {
    require<TPort>(token: CapabilityToken<TPort>): TPort;
    optional<TPort>(token: CapabilityToken<TPort>): TPort | null;
}

export interface PluginCapabilitySetupAccess extends PluginCapabilityReader {
    provide<TPort>(token: CapabilityToken<TPort>, implementation: TPort): Disposable;
}

export interface PluginOperationAccess {
    begin(operationId: string): OperationToken;
    get(operationId: string): OperationDefinition | null;
    isActive(operationId?: string): boolean;
}

export interface PluginOperationSetupAccess extends PluginOperationAccess {
    register(definition: OperationDefinition): Disposable;
}

export interface PluginToolAccess {
    enter(toolId: string): Promise<void>;
    exit(reason?: ToolExitReason): Promise<void>;
    getActiveToolId(): string | null;
    canRunOperation(operationId: string): boolean;
}

export interface PluginToolSetupAccess extends PluginToolAccess {
    register(definition: ToolDefinition): Disposable;
}

export interface PluginCommittedEventAccess<TEvents extends object> {
    emitCommitted<TKey extends keyof TEvents & string>(
        eventName: TKey,
        payload: TEvents[TKey],
    ): Promise<void>;
}

export interface PluginCommittedEventSetupAccess<
    TEvents extends object,
> extends PluginCommittedEventAccess<TEvents> {
    on<TKey extends keyof TEvents & string>(
        eventName: TKey,
        listener: CommittedEventListener<TEvents[TKey]>,
    ): Disposable;
}

export interface PluginLifecycleContext<TEvents extends object = PluginEventMap> {
    readonly pluginId: string;
    readonly state: ScopedPluginStateStore;
    readonly capabilities: PluginCapabilityReader;
    readonly operations: PluginOperationAccess;
    readonly tools: PluginToolAccess;
    readonly events: PluginCommittedEventAccess<TEvents>;
}

export interface PluginSetupContext<TEvents extends object = PluginEventMap> {
    readonly pluginId: string;
    readonly state: ScopedPluginStateStore;
    readonly capabilities: PluginCapabilitySetupAccess;
    readonly operations: PluginOperationSetupAccess;
    readonly tools: PluginToolSetupAccess;
    readonly events: PluginCommittedEventSetupAccess<TEvents>;
    addDisposable(disposable: Disposable): Disposable;
    ensure<TApi>(plugin: EditorPlugin<TApi, TEvents>): Promise<TApi>;
    /** @internal Used by composePlugins while preserving tuple inference. */
    ensurePlugin(plugin: EditorPluginDefinition<TEvents>): Promise<unknown>;
}

export interface EditorPluginDefinition<TEvents extends object = PluginEventMap> {
    readonly ref: PluginIdentity;
    readonly version: string;
    readonly requires?: readonly CapabilityRequirementIdentity[];
    readonly optional?: readonly CapabilityRequirementIdentity[];
    setup(context: PluginSetupContext<TEvents>): MaybePromise<unknown>;
    onInit?(context: PluginLifecycleContext<TEvents>): MaybePromise<void>;
    onImageLoaded?(image: unknown, context: PluginLifecycleContext<TEvents>): MaybePromise<void>;
    onImageCleared?(context: PluginLifecycleContext<TEvents>): MaybePromise<void>;
    onDispose?(context: PluginLifecycleContext<TEvents>): MaybePromise<void>;
}

export interface EditorPlugin<
    TApi = unknown,
    TEvents extends object = PluginEventMap,
> extends EditorPluginDefinition<TEvents> {
    readonly ref: PluginRef<TApi>;
    setup(context: PluginSetupContext<TEvents>): MaybePromise<TApi>;
}

/** A plugin whose setup/init/dispose hooks are safe for the compatibility facade's sync boundary. */
export interface SynchronousEditorPlugin<
    TApi = unknown,
    TEvents extends object = PluginEventMap,
> extends EditorPlugin<TApi, TEvents> {
    readonly setupMode: 'sync';
    setup(context: PluginSetupContext<TEvents>): TApi;
    onInit?(context: PluginLifecycleContext<TEvents>): void;
    onDispose?(context: PluginLifecycleContext<TEvents>): void;
}
