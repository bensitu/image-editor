import { InvalidPluginDefinitionError } from './errors.js';
import type { PluginRef } from './plugin-ref.js';
import type { EditorPlugin } from './plugin-types.js';

const pluginPlanDefinition = Symbol('image-editor.plugin-plan.definition');

interface PluginPlanCompatible {
    readonly ref: PluginRef<unknown>;
}

type PluginPlanItem = PluginPlanCompatible | PluginPlan<unknown, PluginPlanCompatible>;
type PluginPlanDefinitions = Readonly<Record<string, PluginPlanItem>>;

export interface PluginPlan<TApis, TPlugin extends PluginPlanCompatible = EditorPlugin<unknown>> {
    readonly plugins: readonly TPlugin[];
    /** Phantom type used to infer the API mapping returned by installation. */
    readonly __apis?: TApis;
    readonly [pluginPlanDefinition]: PluginPlanDefinitions;
}

type PluginApiOf<TItem> =
    TItem extends PluginPlan<infer TApis, PluginPlanCompatible>
        ? TApis
        : TItem extends { readonly ref: PluginRef<infer TApi> }
          ? TApi
          : never;

type FlattenedPluginOf<TItem> =
    TItem extends PluginPlan<unknown, infer TPlugin>
        ? TPlugin
        : TItem extends PluginPlanCompatible
          ? TItem
          : never;

export type PluginPlanApis<TDefinitions extends Readonly<Record<string, PluginPlanItem>>> = {
    readonly [TKey in keyof TDefinitions]: PluginApiOf<TDefinitions[TKey]>;
};

export type PluginArrayApis<TPlugins extends readonly PluginPlanCompatible[]> = {
    readonly [TIndex in keyof TPlugins]: PluginApiOf<TPlugins[TIndex]>;
};

/** @internal Distinguishes plans from Plugin definitions without relying on object shape. */
export function isPluginPlan(value: unknown): value is PluginPlan<unknown, PluginPlanCompatible> {
    return (
        typeof value === 'object' &&
        value !== null &&
        pluginPlanDefinition in value &&
        Array.isArray((value as Partial<PluginPlan<unknown, PluginPlanCompatible>>).plugins)
    );
}

function assertPluginPlanItem(value: unknown, key: string): asserts value is PluginPlanItem {
    if (isPluginPlan(value)) return;
    if (typeof value !== 'object' || value === null || !('ref' in value) || !('setup' in value)) {
        throw new InvalidPluginDefinitionError(
            `Plugin Plan entry "${key}" must be a Plugin or nested Plugin Plan.`,
        );
    }
}

/** Creates an immutable declarative Plugin collection without installing it. */
export function composePlugins<const TDefinitions extends Readonly<Record<string, PluginPlanItem>>>(
    definitions: TDefinitions,
): PluginPlan<PluginPlanApis<TDefinitions>, FlattenedPluginOf<TDefinitions[keyof TDefinitions]>> {
    if (typeof definitions !== 'object' || definitions === null) {
        throw new InvalidPluginDefinitionError('Plugin Plan definitions must be an object.');
    }
    const entries = Object.entries(definitions);
    if (entries.length === 0) {
        throw new InvalidPluginDefinitionError('Plugin Plan must contain at least one Plugin.');
    }
    const plugins: PluginPlanCompatible[] = [];
    for (const [key, value] of entries) {
        assertPluginPlanItem(value, key);
        if (isPluginPlan(value)) plugins.push(...value.plugins);
        else plugins.push(value);
    }
    const preservedDefinitions = Object.freeze({ ...definitions }) as PluginPlanDefinitions;
    return Object.freeze({
        plugins: Object.freeze(plugins),
        [pluginPlanDefinition]: preservedDefinitions,
    }) as PluginPlan<
        PluginPlanApis<TDefinitions>,
        FlattenedPluginOf<TDefinitions[keyof TDefinitions]>
    >;
}

/** @internal Reconstructs the typed key mapping after every child Plugin has committed. */
export function resolvePluginPlanApis<TApis>(
    plan: PluginPlan<TApis, PluginPlanCompatible>,
    resolveApi: (plugin: PluginPlanCompatible) => unknown,
): TApis {
    const result: Record<string, unknown> = Object.create(null);
    for (const [key, value] of Object.entries(plan[pluginPlanDefinition])) {
        result[key] = isPluginPlan(value)
            ? resolvePluginPlanApis(value, resolveApi)
            : resolveApi(value);
    }
    return Object.freeze(result) as TApis;
}
