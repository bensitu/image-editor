/**
 * Validates and freezes bounded Plugin manifests, dependencies, Capability requirements, and permissions.
 *
 * @module
 */

import {
    assertCapabilityRequirement,
    type CapabilityRequirementIdentity,
} from './capability-token.js';
import {
    InvalidPluginDefinitionError,
    PluginApiVersionError,
    PluginEngineVersionError,
    PluginIdentityConflictError,
    PluginManifestError,
} from './errors.js';
import { assertPluginIdentifier } from './plugin-identifier.js';
import { isPluginRef, type PluginRef } from './plugin-ref.js';
import { isValidSemVer, isValidSemVerRange, satisfiesSemVer } from './semver.js';
import type { PluginManifest, PluginPermission } from './plugin-types.js';

export const CORE_API_VERSION = '3.0.0';
export const CORE_API_RANGE = `^${CORE_API_VERSION}`;

const MAX_VERSION_LENGTH = 64;
const MAX_PLUGIN_DEPENDENCIES = 64;
const MAX_CAPABILITY_REQUIREMENTS = 64;
const MAX_PLUGIN_PERMISSIONS = 16;
const supportedPermissions = new Set<PluginPermission>([
    'fabric:objects',
    'fabric:canvas-read',
    'fabric:custom-class',
    'fabric:global-mutation',
    'core:raster-mutation',
    'core:geometry-participant',
    'core:export-contributor',
]);

export function isPluginPermission(value: unknown): value is PluginPermission {
    return typeof value === 'string' && supportedPermissions.has(value as PluginPermission);
}

function assertArrayLimit(value: unknown, fieldName: string, maximum: number): readonly unknown[] {
    if (value === undefined) return [];
    if (!Array.isArray(value) || value.length > maximum) {
        throw new PluginManifestError(
            `${fieldName} must be an array containing at most ${maximum} entries.`,
        );
    }
    return value;
}

function freezeRequirements(
    pluginId: string,
    value: unknown,
    fieldName: string,
): readonly CapabilityRequirementIdentity[] | undefined {
    if (value === undefined) return undefined;
    const requirements = assertArrayLimit(
        value,
        fieldName,
        MAX_CAPABILITY_REQUIREMENTS,
    ) as readonly CapabilityRequirementIdentity[];
    return Object.freeze(
        requirements.map((requirement) => {
            try {
                assertCapabilityRequirement(requirement);
            } catch (cause) {
                throw new PluginManifestError(
                    `Plugin "${pluginId}" has an invalid capability requirement in ${fieldName}.`,
                    { pluginId, cause },
                );
            }
            return Object.freeze({ token: requirement.token, range: requirement.range });
        }),
    );
}

function freezePluginDependencies(
    pluginId: string,
    value: unknown,
): readonly PluginRef<unknown>[] | undefined {
    if (value === undefined) return undefined;
    const dependencies = assertArrayLimit(
        value,
        'Plugin manifest requiresPlugins',
        MAX_PLUGIN_DEPENDENCIES,
    );
    const dependencyIds = new Set<string>();
    const validated = dependencies.map((dependency) => {
        if (!isPluginRef(dependency)) {
            throw new PluginManifestError(
                `Plugin "${pluginId}" requiresPlugins entries must use definePluginRef().`,
                { pluginId },
            );
        }
        if (dependency.id === pluginId) {
            throw new PluginManifestError(`Plugin "${pluginId}" cannot depend on itself.`, {
                pluginId,
            });
        }
        if (dependencyIds.has(dependency.id)) {
            throw new PluginManifestError(
                `Plugin "${pluginId}" declares dependency "${dependency.id}" more than once.`,
                { pluginId },
            );
        }
        dependencyIds.add(dependency.id);
        return dependency;
    });
    return Object.freeze(validated);
}

function freezePermissions(
    pluginId: string,
    value: unknown,
): readonly PluginPermission[] | undefined {
    if (value === undefined) return undefined;
    const permissions = assertArrayLimit(
        value,
        'Plugin manifest permissions',
        MAX_PLUGIN_PERMISSIONS,
    );
    const permissionSet = new Set<PluginPermission>();
    const validated = permissions.map((permission) => {
        if (typeof permission !== 'string' || !isPluginPermission(permission)) {
            throw new PluginManifestError(
                `Plugin "${pluginId}" declares unsupported permission "${String(permission)}".`,
                { pluginId },
            );
        }
        const typedPermission = permission as PluginPermission;
        if (permissionSet.has(typedPermission)) {
            throw new PluginManifestError(
                `Plugin "${pluginId}" declares permission "${typedPermission}" more than once.`,
                { pluginId },
            );
        }
        permissionSet.add(typedPermission);
        return typedPermission;
    });
    return Object.freeze(validated);
}

/**
 * Validates and freezes metadata before a Plugin setup transaction can start.
 *
 * @throws {@link PluginManifestError} When metadata is malformed or exceeds an input limit.
 * @throws {@link PluginIdentityConflictError} When the reference and manifest IDs differ.
 * @throws {@link PluginApiVersionError} When the reference and manifest API versions differ.
 * @throws {@link PluginEngineVersionError} When the Core API is outside the declared range.
 */
export function validatePluginManifest(
    ref: PluginRef<unknown>,
    manifest: PluginManifest,
): PluginManifest {
    if (typeof manifest !== 'object' || manifest === null) {
        throw new PluginManifestError(`Plugin "${ref.id}" must define a manifest.`, {
            pluginId: ref.id,
        });
    }
    const manifestId = assertPluginIdentifier(manifest.id, 'Plugin manifest id');
    if (manifestId !== ref.id) throw new PluginIdentityConflictError(ref.id, manifestId);
    if (
        typeof manifest.version !== 'string' ||
        manifest.version.length > MAX_VERSION_LENGTH ||
        !isValidSemVer(manifest.version)
    ) {
        throw new PluginManifestError(
            `Plugin "${ref.id}" has invalid implementation SemVer "${String(manifest.version)}".`,
            { pluginId: ref.id },
        );
    }
    if (
        typeof manifest.apiVersion !== 'string' ||
        manifest.apiVersion.length > MAX_VERSION_LENGTH ||
        !isValidSemVer(manifest.apiVersion)
    ) {
        throw new PluginManifestError(
            `Plugin "${ref.id}" has invalid API SemVer "${String(manifest.apiVersion)}".`,
            { pluginId: ref.id },
        );
    }
    if (manifest.apiVersion !== ref.apiVersion) {
        throw new PluginApiVersionError(ref.id, ref.apiVersion, manifest.apiVersion);
    }
    if (
        typeof manifest.engine !== 'string' ||
        manifest.engine.length > MAX_VERSION_LENGTH ||
        !isValidSemVerRange(manifest.engine)
    ) {
        throw new InvalidPluginDefinitionError(
            `Plugin "${ref.id}" has invalid engine SemVer range "${String(manifest.engine)}".`,
            ref.id,
        );
    }
    if (!satisfiesSemVer(CORE_API_VERSION, manifest.engine)) {
        throw new PluginEngineVersionError(ref.id, manifest.engine, CORE_API_VERSION);
    }

    const requiresPlugins = freezePluginDependencies(ref.id, manifest.requiresPlugins);
    const requires = freezeRequirements(ref.id, manifest.requires, 'Plugin manifest requires');
    const optional = freezeRequirements(ref.id, manifest.optional, 'Plugin manifest optional');
    const capabilityIds = new Set<string>();
    for (const requirement of [...(requires ?? []), ...(optional ?? [])]) {
        if (capabilityIds.has(requirement.token.id)) {
            throw new PluginManifestError(
                `Plugin "${ref.id}" declares capability "${requirement.token.id}" more than once.`,
                { pluginId: ref.id },
            );
        }
        capabilityIds.add(requirement.token.id);
    }
    const permissions = freezePermissions(ref.id, manifest.permissions);

    return Object.freeze({
        id: manifestId,
        version: manifest.version,
        apiVersion: manifest.apiVersion,
        engine: manifest.engine,
        requiresPlugins,
        requires,
        optional,
        permissions,
    });
}
