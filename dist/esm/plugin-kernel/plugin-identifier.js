import { InvalidPluginDefinitionError } from './errors.js';
import { isRuntimeIdentifier } from './runtime-identifier.js';
export function assertPluginIdentifier(pluginId, fieldName = 'Plugin id') {
    if (!isRuntimeIdentifier(pluginId)) {
        throw new InvalidPluginDefinitionError(`${fieldName} must match "namespace:kebab-case" and be no longer than 128 characters.`, typeof pluginId === 'string' ? pluginId : undefined);
    }
    return pluginId;
}
//# sourceMappingURL=plugin-identifier.js.map