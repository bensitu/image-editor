import { PluginDefinitionAlreadyBoundError } from './errors.js';
const definitionAliases = new WeakMap();
const definitionLeases = new WeakMap();
export function resolvePluginDefinitionIdentity(definition) {
    let current = definition;
    const visited = new Set();
    while (definitionAliases.has(current) && !visited.has(current)) {
        visited.add(current);
        current = definitionAliases.get(current);
    }
    return current;
}
function aliasPluginDefinitionIdentity(snapshot, source) {
    definitionAliases.set(snapshot, resolvePluginDefinitionIdentity(source));
    return snapshot;
}
export function markCanonicalPluginDefinition(definition, source = definition) {
    return aliasPluginDefinitionIdentity(definition, source);
}
export function isCanonicalPluginDefinition(definition) {
    return ((typeof definition === 'object' || typeof definition === 'function') &&
        definition !== null &&
        definitionAliases.has(definition));
}
export function acquirePluginDefinitionLease(definition, host, pluginId) {
    const identity = resolvePluginDefinitionIdentity(definition);
    const boundHost = definitionLeases.get(identity);
    if (boundHost && boundHost !== host) {
        throw new PluginDefinitionAlreadyBoundError(pluginId, boundHost.state);
    }
    definitionLeases.set(identity, host);
    return identity;
}
export function releasePluginDefinitionLease(definition, host) {
    const identity = resolvePluginDefinitionIdentity(definition);
    if (definitionLeases.get(identity) === host)
        definitionLeases.delete(identity);
}
//# sourceMappingURL=plugin-definition-lease.js.map