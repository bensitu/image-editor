/**
 * Tracks the live Plugin Host lease for each concrete Plugin Definition object.
 *
 * @module
 */

import { PluginDefinitionAlreadyBoundError } from './errors.js';

interface PluginDefinitionLeaseHost {
    readonly state: string;
}

const definitionAliases = new WeakMap<object, object>();
const definitionLeases = new WeakMap<object, PluginDefinitionLeaseHost>();

export function resolvePluginDefinitionIdentity(definition: object): object {
    let current = definition;
    const visited = new Set<object>();
    while (definitionAliases.has(current) && !visited.has(current)) {
        visited.add(current);
        current = definitionAliases.get(current)!;
    }
    return current;
}

export function aliasPluginDefinitionIdentity<TDefinition extends object>(
    snapshot: TDefinition,
    source: object,
): TDefinition {
    definitionAliases.set(snapshot, resolvePluginDefinitionIdentity(source));
    return snapshot;
}

/** @internal Marks an immutable Kernel-owned definition without changing its public shape. */
export function markCanonicalPluginDefinition<TDefinition extends object>(
    definition: TDefinition,
    source: object = definition,
): TDefinition {
    return aliasPluginDefinitionIdentity(definition, source);
}

/** @internal Recognizes definitions already validated and frozen by the Kernel boundary. */
export function isCanonicalPluginDefinition(definition: unknown): boolean {
    return (
        (typeof definition === 'object' || typeof definition === 'function') &&
        definition !== null &&
        definitionAliases.has(definition)
    );
}

export function acquirePluginDefinitionLease(
    definition: object,
    host: PluginDefinitionLeaseHost,
    pluginId: string,
): object {
    const identity = resolvePluginDefinitionIdentity(definition);
    const boundHost = definitionLeases.get(identity);
    if (boundHost && boundHost !== host) {
        throw new PluginDefinitionAlreadyBoundError(pluginId, boundHost.state);
    }
    definitionLeases.set(identity, host);
    return identity;
}

export function releasePluginDefinitionLease(
    definition: object,
    host: PluginDefinitionLeaseHost,
): void {
    const identity = resolvePluginDefinitionIdentity(definition);
    if (definitionLeases.get(identity) === host) definitionLeases.delete(identity);
}
