/**
 * Internal custom overlay registry.
 *
 * The public v1 wire format supports custom overlays with namespaced
 * customType values. This internal registry leaves room for future public
 * registration without making Fabric object JSON part of the persistence API.
 *
 * @module
 */

import type { OverlaySerializerRegistryEntry } from './overlay-state-types.js';

const registry = new Map<string, OverlaySerializerRegistryEntry>();

export function registerOverlaySerializer(
    customType: string,
    entry: OverlaySerializerRegistryEntry,
): void {
    registry.set(customType, entry);
}

export function getOverlaySerializer(
    customType: string,
): OverlaySerializerRegistryEntry | undefined {
    return registry.get(customType);
}
