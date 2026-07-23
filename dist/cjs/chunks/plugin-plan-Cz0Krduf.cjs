'use strict';

var pluginIdentifier = require('./plugin-identifier-DWQ7SALj.cjs');

const pluginPlanDefinition = Symbol('image-editor.plugin-plan.definition');
function isPluginPlan(value) {
    return (typeof value === 'object' &&
        value !== null &&
        pluginPlanDefinition in value &&
        Array.isArray(value.plugins));
}
function assertPluginPlanItem(value, key) {
    if (isPluginPlan(value))
        return;
    if (typeof value !== 'object' || value === null || !('ref' in value) || !('setup' in value)) {
        throw new pluginIdentifier.InvalidPluginDefinitionError(`Plugin Plan entry "${key}" must be a Plugin or nested Plugin Plan.`);
    }
}
function composePlugins(definitions) {
    if (typeof definitions !== 'object' || definitions === null) {
        throw new pluginIdentifier.InvalidPluginDefinitionError('Plugin Plan definitions must be an object.');
    }
    const entries = Object.entries(definitions);
    if (entries.length === 0) {
        throw new pluginIdentifier.InvalidPluginDefinitionError('Plugin Plan must contain at least one Plugin.');
    }
    const plugins = [];
    for (const [key, value] of entries) {
        assertPluginPlanItem(value, key);
        if (isPluginPlan(value))
            plugins.push(...value.plugins);
        else
            plugins.push(value);
    }
    const preservedDefinitions = Object.freeze({ ...definitions });
    return Object.freeze({
        plugins: Object.freeze(plugins),
        [pluginPlanDefinition]: preservedDefinitions,
    });
}
function resolvePluginPlanApis(plan, resolveApi) {
    const result = Object.create(null);
    for (const [key, value] of Object.entries(plan[pluginPlanDefinition])) {
        result[key] = isPluginPlan(value)
            ? resolvePluginPlanApis(value, resolveApi)
            : resolveApi(value);
    }
    return Object.freeze(result);
}

exports.composePlugins = composePlugins;
exports.isPluginPlan = isPluginPlan;
exports.resolvePluginPlanApis = resolvePluginPlanApis;
//# sourceMappingURL=plugin-plan-Cz0Krduf.cjs.map
