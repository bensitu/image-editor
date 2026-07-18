import type { CapabilityRequirementIdentity, CapabilityToken } from './capability-token.js';
import type { CommittedEventListener, PluginEventMap } from './committed-event-bus.js';
import type { Disposable, MaybePromise } from './disposable.js';
import type { OperationDefinition, OperationExecutionContext, OperationRunOptions, OperationToken } from './operation-registry.js';
import type { PluginIdentity, PluginRef } from './plugin-ref.js';
import type { ScopedPluginStateStore } from './plugin-state-store.js';
import type { ToolDefinition, ToolExitReason } from './tool-coordinator.js';
/** Privileged integration boundaries that a Plugin can declare in its manifest. */
export type PluginPermission = 'fabric:objects' | 'fabric:canvas-read' | 'fabric:custom-class' | 'fabric:global-mutation' | 'core:raster-mutation' | 'core:geometry-participant' | 'core:export-contributor';
/** Immutable metadata validated before Plugin setup starts. */
export interface PluginManifest {
    readonly id: string;
    readonly version: string;
    readonly apiVersion: string;
    readonly engine: string;
    readonly requiresPlugins?: readonly PluginRef<unknown>[];
    readonly requires?: readonly CapabilityRequirementIdentity[];
    readonly optional?: readonly CapabilityRequirementIdentity[];
    readonly permissions?: readonly PluginPermission[];
}
/** Declares one typed Capability implementation and its runtime version. */
export interface CapabilityProviderDefinition<TPort> {
    readonly token: CapabilityToken<TPort>;
    readonly implementation: TPort;
    readonly version: string;
}
/** Runtime version declaration supplied when a Plugin provides a Capability. */
export interface CapabilityProviderOptions {
    readonly version: string;
    readonly requiredPermission?: PluginPermission;
}
/** Shared shape for Plugin APIs that own atomic runtime configuration. */
export interface ConfigurablePluginApi<TOptions> {
    configure(patch: Partial<TOptions>): void | Promise<void>;
    getConfiguration(): Readonly<TOptions>;
}
/** Public cleanup ownership available only during Plugin setup. */
export interface DisposableScope {
    readonly active: boolean;
    add<TDisposable extends Disposable>(disposable: TDisposable): TDisposable;
}
/** Availability of one Capability declared through a Plugin manifest's optional list. */
export type OptionalCapabilityStatus = 'available' | 'missing' | 'incompatible';
export interface PluginCapabilityReader {
    require<TPort>(token: CapabilityToken<TPort>): TPort;
    optional<TPort>(token: CapabilityToken<TPort>): TPort | null;
    getOptionalStatus<TPort>(token: CapabilityToken<TPort>): OptionalCapabilityStatus;
}
export interface PluginCapabilitySetupAccess extends PluginCapabilityReader {
    provide<TPort>(token: CapabilityToken<TPort>, implementation: TPort, options: CapabilityProviderOptions): Disposable;
}
export interface PluginOperationAccess {
    begin(operationId: string): OperationToken;
    run<TArgs, TResult>(operationId: string, args: TArgs, task: (args: TArgs, context: OperationExecutionContext) => MaybePromise<TResult>, options?: OperationRunOptions): Promise<TResult>;
    get(operationId: string): OperationDefinition | null;
    isActive(operationId?: string): boolean;
}
export interface PluginOperationSetupAccess extends PluginOperationAccess {
    register<TArgs>(definition: OperationDefinition<TArgs>): Disposable;
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
    emitCommitted<TKey extends keyof TEvents & string>(eventName: TKey, payload: TEvents[TKey]): Promise<void>;
}
export interface PluginCommittedEventSetupAccess<TEvents extends object> extends PluginCommittedEventAccess<TEvents> {
    on<TKey extends keyof TEvents & string>(eventName: TKey, listener: CommittedEventListener<TEvents[TKey]>): Disposable;
}
export interface PluginLifecycleContext<TEvents extends object = PluginEventMap> {
    readonly plugin: PluginIdentity;
    readonly pluginId: string;
    readonly state: ScopedPluginStateStore;
    readonly capabilities: PluginCapabilityReader;
    readonly operations: PluginOperationAccess;
    readonly tools: PluginToolAccess;
    readonly events: PluginCommittedEventAccess<TEvents>;
}
export interface PluginSetupContext<TEvents extends object = PluginEventMap> {
    readonly plugin: PluginIdentity;
    readonly pluginId: string;
    readonly state: ScopedPluginStateStore;
    readonly capabilities: PluginCapabilitySetupAccess;
    readonly operations: PluginOperationSetupAccess;
    readonly tools: PluginToolSetupAccess;
    readonly events: PluginCommittedEventSetupAccess<TEvents>;
    readonly disposables: DisposableScope;
}
export interface EditorPluginDefinition<TEvents extends object = PluginEventMap> {
    readonly ref: PluginIdentity;
    readonly manifest: PluginManifest;
    setup(context: PluginSetupContext<TEvents>): MaybePromise<unknown>;
    onInit?(context: PluginLifecycleContext<TEvents>): MaybePromise<void>;
    onImageLoaded?(image: unknown, context: PluginLifecycleContext<TEvents>): MaybePromise<void>;
    onImageCleared?(context: PluginLifecycleContext<TEvents>): MaybePromise<void>;
    onDispose?(context: PluginLifecycleContext<TEvents>): MaybePromise<void>;
}
export interface EditorPlugin<TApi = unknown, TEvents extends object = PluginEventMap> extends EditorPluginDefinition<TEvents> {
    readonly ref: PluginRef<TApi>;
    setup(context: PluginSetupContext<TEvents>): MaybePromise<TApi>;
}
/** A plugin whose setup/init/dispose hooks are safe for synchronous installation. */
export interface SynchronousEditorPlugin<TApi = unknown, TEvents extends object = PluginEventMap> extends EditorPlugin<TApi, TEvents> {
    readonly setupMode: 'sync';
    setup(context: PluginSetupContext<TEvents>): TApi;
    onInit?(context: PluginLifecycleContext<TEvents>): void;
    onDispose?(context: PluginLifecycleContext<TEvents>): void;
}
