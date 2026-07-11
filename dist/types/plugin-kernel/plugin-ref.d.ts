declare const pluginRefBrand: unique symbol;
export interface PluginIdentity {
    readonly id: string;
    readonly apiVersion: string;
}
export interface PluginRef<TApi> extends PluginIdentity {
    /** Phantom invariant type. Runtime code never reads this field. */
    readonly __apiType?: (api: TApi) => TApi;
    readonly [pluginRefBrand]: true;
}
export declare function definePluginRef<TApi>(id: string, apiVersion: string): PluginRef<TApi>;
export declare function isPluginRef(value: unknown): value is PluginRef<unknown>;
export {};
