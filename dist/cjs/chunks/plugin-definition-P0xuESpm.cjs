'use strict';

var pluginIdentifier = require('./plugin-identifier-DPwx4Gkd.cjs');
var pluginManifest = require('./plugin-manifest-DNqSyjh2.cjs');

function definePlugin(definition) {
    if (typeof definition !== 'object' || definition === null) {
        throw new pluginIdentifier.InvalidPluginDefinitionError('Plugin definition must be an object.');
    }
    if (!pluginManifest.isPluginRef(definition.ref)) {
        throw new pluginIdentifier.InvalidPluginDefinitionError('Plugin definition must use a PluginRef created by definePluginRef().');
    }
    if (typeof definition.setup !== 'function') {
        throw new pluginIdentifier.InvalidPluginDefinitionError(`Plugin "${definition.ref.id}" must define setup().`, definition.ref.id);
    }
    const manifest = pluginManifest.validatePluginManifest(definition.ref, definition.manifest);
    return Object.freeze({ ...definition, manifest });
}

exports.definePlugin = definePlugin;
//# sourceMappingURL=plugin-definition-P0xuESpm.cjs.map
