import { InvalidPluginDefinitionError } from './errors.js';
export function composePlugins(options) {
    if (options.plugins.length === 0) {
        throw new InvalidPluginDefinitionError(`Composed plugin "${options.ref.id}" must declare at least one child plugin.`, options.ref.id);
    }
    if (typeof options.createApi !== 'function') {
        throw new InvalidPluginDefinitionError(`Composed plugin "${options.ref.id}" must define createApi().`, options.ref.id);
    }
    const plugins = Object.freeze([...options.plugins]);
    return Object.freeze({
        ref: options.ref,
        manifest: Object.freeze({
            id: options.ref.id,
            version: options.version,
            apiVersion: options.ref.apiVersion,
            engine: '^3.0.0',
        }),
        async setup(context) {
            const childApis = [];
            for (const plugin of plugins) {
                childApis.push(await context.ensurePlugin(plugin));
            }
            return options.createApi(Object.freeze(childApis), context);
        },
    });
}
//# sourceMappingURL=compose-plugins.js.map