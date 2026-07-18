export interface PluginTestFabric<TModule extends object> {
    readonly module: TModule;
    assertUnchanged(): void;
}
/** Captures the Fabric namespace surface and detects direct global mutation. */
export declare function createPluginTestFabric<TModule extends object>(module: TModule): PluginTestFabric<TModule>;
