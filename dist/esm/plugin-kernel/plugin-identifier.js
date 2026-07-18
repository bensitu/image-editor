import { InvalidPluginDefinitionError } from './errors.js';
const MAX_PLUGIN_ID_LENGTH = 128;
const PROHIBITED_PROPERTY_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const PLUGIN_ID_PATTERN = /^[A-Za-z0-9@][A-Za-z0-9@._:/-]*$/u;
export function assertPluginIdentifier(pluginId, fieldName = 'Plugin id') {
    if (typeof pluginId !== 'string' ||
        pluginId.length === 0 ||
        pluginId.length > MAX_PLUGIN_ID_LENGTH ||
        pluginId.trim() !== pluginId ||
        !PLUGIN_ID_PATTERN.test(pluginId)) {
        throw new InvalidPluginDefinitionError(`${fieldName} must be a safe, trimmed identifier no longer than ${MAX_PLUGIN_ID_LENGTH} characters.`, typeof pluginId === 'string' ? pluginId : undefined);
    }
    const segments = pluginId.split(/[.:/]/u);
    if (segments.some((segment) => PROHIBITED_PROPERTY_KEYS.has(segment))) {
        throw new InvalidPluginDefinitionError(`${fieldName} contains a prohibited property key.`, pluginId);
    }
    return pluginId;
}
//# sourceMappingURL=plugin-identifier.js.map