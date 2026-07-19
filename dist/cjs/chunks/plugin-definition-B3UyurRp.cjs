'use strict';

var pluginManifest = require('./plugin-manifest-BCkXHQr2.cjs');

function definePlugin(definition) {
    if (typeof definition !== 'object' || definition === null) {
        throw new pluginManifest.InvalidPluginDefinitionError('Plugin definition must be an object.');
    }
    if (!pluginManifest.isPluginRef(definition.ref)) {
        throw new pluginManifest.InvalidPluginDefinitionError('Plugin definition must use a PluginRef created by definePluginRef().');
    }
    if (typeof definition.setup !== 'function') {
        throw new pluginManifest.InvalidPluginDefinitionError(`Plugin "${definition.ref.id}" must define setup().`, definition.ref.id);
    }
    const manifest = pluginManifest.validatePluginManifest(definition.ref, definition.manifest);
    return Object.freeze({ ...definition, manifest });
}

exports.definePlugin = definePlugin;
//# sourceMappingURL=plugin-definition-B3UyurRp.cjs.map
