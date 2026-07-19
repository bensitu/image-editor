/**
 * Creates immutable branded Plugin references with Runtime ID and API-version validation.
 *
 * @module
 */
declare const pluginRefBrand: unique symbol;
export interface PluginIdentity {
    readonly id: string;
    readonly apiVersion: string;
}
export interface PluginRef<TApi> extends PluginIdentity {
    /** Phantom API type. Runtime code never reads this field. */
    readonly __apiType?: TApi;
    readonly [pluginRefBrand]: true;
}
export declare function definePluginRef<TApi>(id: string, apiVersion: string): PluginRef<TApi>;
export declare function isPluginRef(value: unknown): value is PluginRef<unknown>;
export {};
