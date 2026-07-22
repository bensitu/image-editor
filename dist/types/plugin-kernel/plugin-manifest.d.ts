/**
 * Validates and freezes bounded Plugin manifests, dependencies, Capability requirements, and permissions.
 *
 * @module
 */
import { type PluginRef } from './plugin-ref.js';
import type { PluginManifest, PluginPermission } from './plugin-types.js';
export declare const CORE_API_VERSION = "3.0.0";
export declare const CORE_API_RANGE = "^3.0.0";
export declare function isPluginPermission(value: unknown): value is PluginPermission;
/**
 * Validates and freezes metadata before a Plugin setup transaction can start.
 *
 * @throws {@link PluginManifestError} When metadata is malformed or exceeds an input limit.
 * @throws {@link PluginIdentityConflictError} When the reference and manifest IDs differ.
 * @throws {@link PluginApiVersionError} When the reference and manifest API versions differ.
 * @throws {@link PluginEngineVersionError} When the Core API is outside the declared range.
 */
export declare function validatePluginManifest(ref: PluginRef<unknown>, manifest: PluginManifest): PluginManifest;
