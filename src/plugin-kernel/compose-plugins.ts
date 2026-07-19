/**
 * Composes child Plugins into one installation unit with typed APIs and dependency rollback.
 *
 * @module
 */

import type { PluginEventMap } from './committed-event-bus.js';
import { InvalidPluginDefinitionError } from './errors.js';
import type { PluginRef } from './plugin-ref.js';
import type { EditorPlugin, EditorPluginDefinition, PluginSetupContext } from './plugin-types.js';

export type PluginApiOf<TPlugin> =
    TPlugin extends EditorPlugin<infer TApi, infer TEvents>
        ? TEvents extends object
            ? TApi
            : never
        : never;

export type PluginApiTuple<TPlugins extends readonly EditorPluginDefinition<object>[]> = {
    readonly [TIndex in keyof TPlugins]: PluginApiOf<TPlugins[TIndex]>;
};

export interface ComposePluginsOptions<
    TApi,
    TPlugins extends readonly EditorPluginDefinition<TEvents>[],
    TEvents extends object = PluginEventMap,
> {
    readonly ref: PluginRef<TApi>;
    readonly version: string;
    readonly plugins: TPlugins;
    createApi(
        apis: PluginApiTuple<TPlugins>,
        context: PluginSetupContext<TEvents>,
    ): TApi | Promise<TApi>;
}

export function composePlugins<
    TEvents extends object = PluginEventMap,
    const TPlugins extends readonly EditorPluginDefinition<TEvents>[] =
        readonly EditorPluginDefinition<TEvents>[],
    TApi = unknown,
>(options: ComposePluginsOptions<TApi, TPlugins, TEvents>): EditorPlugin<TApi, TEvents> {
    if (options.plugins.length === 0) {
        throw new InvalidPluginDefinitionError(
            `Composed plugin "${options.ref.id}" must declare at least one child plugin.`,
            options.ref.id,
        );
    }
    if (typeof options.createApi !== 'function') {
        throw new InvalidPluginDefinitionError(
            `Composed plugin "${options.ref.id}" must define createApi().`,
            options.ref.id,
        );
    }

    const plugins = Object.freeze([...options.plugins]) as TPlugins;
    return Object.freeze({
        ref: options.ref,
        manifest: Object.freeze({
            id: options.ref.id,
            version: options.version,
            apiVersion: options.ref.apiVersion,
            engine: '^3.0.0',
        }),
        async setup(context: PluginSetupContext<TEvents>): Promise<TApi> {
            const childApis: unknown[] = [];
            for (const plugin of plugins) {
                childApis.push(await context.ensurePlugin(plugin));
            }
            // The array is populated in the same order as the preserved plugin tuple.
            return options.createApi(Object.freeze(childApis) as PluginApiTuple<TPlugins>, context);
        },
    });
}
