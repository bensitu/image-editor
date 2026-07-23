'use strict';

var pluginIdentifier = require('./plugin-identifier-DWQ7SALj.cjs');
var pluginManifest = require('./plugin-manifest-5BctrtYS.cjs');

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
    if (definition.setupMode !== 'sync') {
        throw new pluginIdentifier.InvalidPluginDefinitionError(`Plugin "${definition.ref.id}" must declare setupMode "sync" for the public SDK.`, definition.ref.id);
    }
    const manifest = pluginManifest.validatePluginManifest(definition.ref, definition.manifest);
    return Object.freeze({ ...definition, manifest });
}

exports.definePlugin = definePlugin;
//# sourceMappingURL=plugin-definition-DtyrZUJz.cjs.map
