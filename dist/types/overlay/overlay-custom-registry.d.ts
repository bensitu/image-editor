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
export declare function registerOverlaySerializer(customType: string, entry: OverlaySerializerRegistryEntry): void;
export declare function getOverlaySerializer(customType: string): OverlaySerializerRegistryEntry | undefined;
