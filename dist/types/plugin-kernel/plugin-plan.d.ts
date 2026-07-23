/**
 * Builds typed Plugin Plans and resolves installed APIs from nested plan inputs.
 *
 * @module
 */
import type { PluginRef } from './plugin-ref.js';
declare const pluginPlanDefinition: unique symbol;
interface PluginPlanCompatible {
    readonly ref: PluginRef<unknown>;
}
type PluginPlanItem = PluginPlanCompatible | PluginPlan<unknown, PluginPlanCompatible>;
type PluginPlanDefinitions = Readonly<Record<string, PluginPlanItem>>;
export interface PluginPlan<TApis, TPlugin extends PluginPlanCompatible = PluginPlanCompatible> {
    readonly plugins: readonly TPlugin[];
    /** Phantom type used to infer the API mapping returned by installation. */
    readonly __apis?: TApis;
    readonly [pluginPlanDefinition]: PluginPlanDefinitions;
}
type PluginApiOf<TItem> = TItem extends PluginPlan<infer TApis, PluginPlanCompatible> ? TApis : TItem extends {
    readonly ref: PluginRef<infer TApi>;
} ? TApi : never;
type FlattenedPluginOf<TItem> = TItem extends PluginPlan<unknown, infer TPlugin> ? TPlugin : TItem extends PluginPlanCompatible ? TItem : never;
export type PluginPlanApis<TDefinitions extends Readonly<Record<string, PluginPlanItem>>> = {
    readonly [TKey in keyof TDefinitions]: PluginApiOf<TDefinitions[TKey]>;
};
export type PluginArrayApis<TPlugins extends readonly PluginPlanCompatible[]> = {
    readonly [TIndex in keyof TPlugins]: PluginApiOf<TPlugins[TIndex]>;
};
/** Creates an immutable declarative Plugin collection without installing it. */
export declare function composePlugins<const TDefinitions extends Readonly<Record<string, PluginPlanItem>>>(definitions: TDefinitions): PluginPlan<PluginPlanApis<TDefinitions>, FlattenedPluginOf<TDefinitions[keyof TDefinitions]>>;
export {};
