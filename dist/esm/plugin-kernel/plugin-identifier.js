import { InvalidPluginDefinitionError } from './errors.js';
const RUNTIME_IDENTIFIER_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*:[a-z0-9]+(?:-[a-z0-9]+)*$/u;
export function isDangerousStateKey(key) {
    return key === '__proto__' || key === 'constructor' || key === 'prototype';
}
export function isRuntimeIdentifier(value) {
    return (typeof value === 'string' &&
        value.length < 129 &&
        RUNTIME_IDENTIFIER_PATTERN.test(value) &&
        !value.split(':').some(isDangerousStateKey));
}
export function assertPluginIdentifier(pluginId, fieldName = 'Plugin id') {
    if (!isRuntimeIdentifier(pluginId)) {
        throw new InvalidPluginDefinitionError(`${fieldName} must use namespace:kebab-case and be at most 128 characters.`, typeof pluginId === 'string' ? pluginId : undefined);
    }
    return pluginId;
}
//# sourceMappingURL=plugin-identifier.js.map