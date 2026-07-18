import type { CapabilityToken, EditorPlugin, PluginPermission, PluginRef, SynchronousEditorPlugin } from '../sdk/index.js';
export interface PluginTestCapabilityProvider<TPort = unknown> {
    readonly token: CapabilityToken<TPort>;
    readonly implementation: TPort;
    readonly providerId?: string;
    readonly requiredPermission?: PluginPermission;
    verifyCleanup?(): void | Promise<void>;
}
export interface PluginTestHostOptions {
    readonly hostCapabilities?: readonly PluginTestCapabilityProvider[];
}
export type PluginTestHostState = 'created' | 'initializing' | 'initialized' | 'disposing' | 'disposed';
export interface PluginTestHost<TEvents extends object = object> {
    readonly state: PluginTestHostState;
    readonly warnings: readonly unknown[];
    readonly errors: readonly unknown[];
    install<TApi>(plugin: EditorPlugin<TApi, TEvents>): Promise<TApi>;
    installSync<TApi>(plugin: SynchronousEditorPlugin<TApi, TEvents>): TApi;
    get<TApi>(ref: PluginRef<TApi>): TApi | null;
    has<TApi>(refOrId: PluginRef<TApi> | string): boolean;
    initialize(): Promise<void>;
    initializeSync(): void;
    notifyImageLoaded(image: unknown): Promise<void>;
    notifyImageCleared(): Promise<void>;
    dispose(): Promise<void>;
    disposeSync(): void;
}
/** Creates a narrow, renderer-free host for isolated Plugin tests. */
export declare function createPluginTestHost<TEvents extends object = object>(options?: PluginTestHostOptions): PluginTestHost<TEvents>;
