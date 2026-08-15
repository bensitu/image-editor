const require_plugin_identifier = require('./plugin-identifier-DhlVh5SQ.cjs');
const require_core_capabilities = require('./core-capabilities-BJafsEkA.cjs');

//#region dist/esm/sdk/visible-raster-bake.js
const VISIBLE_RASTER_BAKE_CAPABILITY = require_core_capabilities.createCapabilityToken("raster:visible-bake", "1.0.0");

//#endregion
//#region dist/esm/sdk/plugin-definition.js
function definePlugin(definition) {
	if (typeof definition !== "object" || definition === null) throw new require_plugin_identifier.InvalidPluginDefinitionError("Plugin definition must be an object.");
	if (!require_core_capabilities.isPluginRef(definition.ref)) throw new require_plugin_identifier.InvalidPluginDefinitionError("Plugin definition must use a PluginRef created by definePluginRef().");
	if (typeof definition.setup !== "function") throw new require_plugin_identifier.InvalidPluginDefinitionError(`Plugin "${definition.ref.id}" must define setup().`, definition.ref.id);
	if (definition.setupMode !== "sync") throw new require_plugin_identifier.InvalidPluginDefinitionError(`Plugin "${definition.ref.id}" must declare setupMode "sync" for the public SDK.`, definition.ref.id);
	const manifest = require_core_capabilities.validatePluginManifest(definition.ref, definition.manifest);
	return require_core_capabilities.markCanonicalPluginDefinition(Object.freeze({
		...definition,
		manifest
	}));
}

//#endregion
Object.defineProperty(exports, 'VISIBLE_RASTER_BAKE_CAPABILITY', {
  enumerable: true,
  get: function () {
    return VISIBLE_RASTER_BAKE_CAPABILITY;
  }
});
Object.defineProperty(exports, 'definePlugin', {
  enumerable: true,
  get: function () {
    return definePlugin;
  }
});
//# sourceMappingURL=sdk-DFCNfN_D.cjs.map