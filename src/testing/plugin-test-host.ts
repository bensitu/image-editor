import { PluginManager } from '../plugin-kernel/plugin-manager.js';
import type {
    CapabilityToken,
    EditorPlugin,
    PluginPermission,
    PluginRef,
    SynchronousEditorPlugin,
} from '../sdk/index.js';

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

export type PluginTestHostState =
    'created' | 'initializing' | 'initialized' | 'disposing' | 'disposed';

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
export function createPluginTestHost<TEvents extends object = object>(
    options: PluginTestHostOptions = {},
): PluginTestHost<TEvents> {
    const warnings: unknown[] = [];
    const errors: unknown[] = [];
    const manager = new PluginManager<TEvents>({
        warningSink: (warning) => warnings.push(warning),
        errorSink: (error) => errors.push(error),
        hostCapabilities: (options.hostCapabilities ?? []).map((provider) => ({
            token: provider.token,
            implementation: provider.implementation,
            providerId: provider.providerId,
            requiredPermission: provider.requiredPermission,
        })),
    });

    return Object.freeze({
        get state(): PluginTestHostState {
            return manager.state;
        },
        get warnings(): readonly unknown[] {
            return Object.freeze([...warnings]);
        },
        get errors(): readonly unknown[] {
            return Object.freeze([...errors]);
        },
        install: <TApi>(plugin: EditorPlugin<TApi, TEvents>) => manager.install(plugin),
        installSync: <TApi>(plugin: SynchronousEditorPlugin<TApi, TEvents>) =>
            manager.installSync(plugin),
        get: <TApi>(ref: PluginRef<TApi>) => manager.get(ref),
        has: <TApi>(refOrId: PluginRef<TApi> | string) => manager.has(refOrId),
        initialize: () => manager.initialize(),
        initializeSync: () => manager.initializeSync(),
        notifyImageLoaded: (image: unknown) => manager.notifyImageLoaded(image),
        notifyImageCleared: () => manager.notifyImageCleared(),
        dispose: () => manager.dispose(),
        disposeSync: () => manager.disposeSync(),
    });
}
