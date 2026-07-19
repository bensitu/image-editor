import { InvalidPluginDefinitionError } from './errors.js';
const RUNTIME_IDENTIFIER_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*:[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const PROHIBITED_RUNTIME_IDENTIFIER_SEGMENT = /(^|:)(constructor|prototype)(:|$)/u;
export function isRuntimeIdentifier(value) {
    return (typeof value === 'string' &&
        value.length < 129 &&
        RUNTIME_IDENTIFIER_PATTERN.test(value) &&
        !PROHIBITED_RUNTIME_IDENTIFIER_SEGMENT.test(value));
}
export function assertPluginIdentifier(pluginId, fieldName = 'Plugin id') {
    if (!isRuntimeIdentifier(pluginId)) {
        throw new InvalidPluginDefinitionError(`${fieldName} must use namespace:kebab-case and be at most 128 characters.`, typeof pluginId === 'string' ? pluginId : undefined);
    }
    return pluginId;
}
//# sourceMappingURL=plugin-identifier.js.map