import { type Disposable } from './disposable.js';
export interface ScopedPluginStateStore {
    has(key: string): boolean;
    get<T>(key: string): T | undefined;
    set<T>(key: string, value: T): void;
    delete(key: string): boolean;
    clear(): void;
}
export declare class PluginStateStore implements Disposable {
    private readonly stateByPlugin;
    private readonly activePluginIds;
    private disposed;
    createScoped(pluginId: string, registerCleanup: (disposable: Disposable) => void, registerFinalizer: (disposable: Disposable) => void, isScopeActive: () => boolean): ScopedPluginStateStore;
    hasPluginState(pluginId: string): boolean;
    dispose(): void;
    private assertActive;
}
