/**
 * Composes child Plugins into one installation unit with typed APIs and dependency rollback.
 *
 * @module
 */
import type { PluginEventMap } from './committed-event-bus.js';
import type { PluginRef } from './plugin-ref.js';
import type { EditorPlugin, EditorPluginDefinition, PluginSetupContext } from './plugin-types.js';
export type PluginApiOf<TPlugin> = TPlugin extends EditorPlugin<infer TApi, infer TEvents> ? TEvents extends object ? TApi : never : never;
export type PluginApiTuple<TPlugins extends readonly EditorPluginDefinition<object>[]> = {
    readonly [TIndex in keyof TPlugins]: PluginApiOf<TPlugins[TIndex]>;
};
export interface ComposePluginsOptions<TApi, TPlugins extends readonly EditorPluginDefinition<TEvents>[], TEvents extends object = PluginEventMap> {
    readonly ref: PluginRef<TApi>;
    readonly version: string;
    readonly plugins: TPlugins;
    createApi(apis: PluginApiTuple<TPlugins>, context: PluginSetupContext<TEvents>): TApi | Promise<TApi>;
}
export declare function composePlugins<TEvents extends object = PluginEventMap, const TPlugins extends readonly EditorPluginDefinition<TEvents>[] = readonly EditorPluginDefinition<TEvents>[], TApi = unknown>(options: ComposePluginsOptions<TApi, TPlugins, TEvents>): EditorPlugin<TApi, TEvents>;
