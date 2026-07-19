/**
 * Owns Capability providers and resolves versioned requirements transactionally.
 *
 * @module
 */

import {
    assertCapabilityRequirement,
    isCapabilityToken,
    type CapabilityIdentity,
    type CapabilityRequirement,
    type CapabilityRequirementIdentity,
    type CapabilityToken,
} from './capability-token.js';
import {
    createDisposable,
    createNoopDisposable,
    type CommitAwareDisposable,
    type Disposable,
} from './disposable.js';
import {
    CapabilityMissingError,
    CapabilityConflictError,
    CapabilityVersionError,
    InvalidCapabilityVersionError,
    InvalidPluginDefinitionError,
    PluginCapabilityError,
    PluginKernelDisposedError,
} from './errors.js';
import { reportWarningSafely, type PluginErrorSink, type PluginWarningSink } from './reporting.js';
import { isValidSemVer, satisfiesSemVer } from './semver.js';
import { isPluginPermission } from './plugin-manifest.js';
import { isRuntimeIdentifier } from './runtime-identifier.js';
import type { PluginPermission } from './plugin-types.js';

interface CapabilityProviderRecord {
    readonly token: CapabilityIdentity;
    readonly version: string;
    readonly requiredPermission: PluginPermission | undefined;
    readonly implementation: unknown;
    readonly providerPluginId: string;
    readonly transactionId: symbol;
    complete: boolean;
}

export interface CapabilityRegistryOptions {
    readonly warningSink?: PluginWarningSink;
    readonly errorSink?: PluginErrorSink;
}

export interface CapabilityProviderInfo {
    readonly capabilityId: string;
    readonly version: string;
    readonly providerPluginId: string;
    readonly requiredPermission: PluginPermission | undefined;
    readonly complete: boolean;
}

function validateProvider<TPort>(
    token: CapabilityToken<TPort>,
    implementation: TPort,
    providerPluginId: string,
    providerVersion: string,
    requiredPermission: PluginPermission | undefined,
): void {
    if (!isCapabilityToken(token) || !isValidSemVer(token.version)) {
        throw new InvalidCapabilityVersionError(
            token?.id ?? 'unknown',
            token?.version ?? '',
            'version',
        );
    }
    if (!isRuntimeIdentifier(providerPluginId)) {
        throw new InvalidPluginDefinitionError(
            `Capability provider id for "${token.id}" must match "namespace:kebab-case".`,
            providerPluginId,
        );
    }
    if (!isValidSemVer(providerVersion)) {
        throw new InvalidCapabilityVersionError(token.id, providerVersion, 'version');
    }
    if (providerVersion !== token.version) {
        throw new CapabilityVersionError({
            capabilityId: token.id,
            expectedRange: token.version,
            actualVersion: providerVersion,
            providerPluginId,
        });
    }
    if (requiredPermission !== undefined && !isPluginPermission(requiredPermission)) {
        throw new InvalidPluginDefinitionError(
            `Capability "${token.id}" requires an unsupported Plugin permission.`,
            providerPluginId,
        );
    }
    if (implementation === null || implementation === undefined) {
        throw new PluginCapabilityError({
            consumerPluginId: providerPluginId,
            capabilityId: token.id,
            requestedRange: token.version,
            installedVersion: token.version,
            providerPluginId,
            reason: 'incomplete',
        });
    }
}

export class CapabilityRegistry implements Disposable {
    private readonly providers = new Map<string, CapabilityProviderRecord>();
    private disposed = false;

    constructor(private readonly options: CapabilityRegistryOptions = {}) {}

    provide<TPort>(
        token: CapabilityToken<TPort>,
        implementation: TPort,
        providerPluginId: string,
        requiredPermission?: PluginPermission,
    ): Disposable {
        const registration = this.providePending(
            token,
            implementation,
            providerPluginId,
            Symbol(`capability:${token.id}`),
            token.version,
            requiredPermission,
        );
        registration.commit();
        return registration;
    }

    /** @internal Registers a capability owned by the host rather than an installed plugin. */
    provideHost(
        token: CapabilityIdentity,
        implementation: unknown,
        providerPluginId = 'core:host',
        requiredPermission?: PluginPermission,
    ): Disposable {
        if (!isCapabilityToken(token)) {
            throw new InvalidPluginDefinitionError(
                'Host capability must use createCapabilityToken().',
            );
        }
        return this.provide(token, implementation, providerPluginId, requiredPermission);
    }

    /** @internal Used by RegistrationScope to hide provisional providers. */
    providePending<TPort>(
        token: CapabilityToken<TPort>,
        implementation: TPort,
        providerPluginId: string,
        transactionId: symbol,
        providerVersion = token.version,
        requiredPermission?: PluginPermission,
    ): CommitAwareDisposable {
        this.assertActive('provide a capability');
        validateProvider(
            token,
            implementation,
            providerPluginId,
            providerVersion,
            requiredPermission,
        );
        const existing = this.providers.get(token.id);

        if (existing) {
            const isSameTransaction =
                existing.providerPluginId === providerPluginId &&
                existing.transactionId === transactionId &&
                existing.version === providerVersion &&
                existing.requiredPermission === requiredPermission &&
                Object.is(existing.implementation, implementation);
            if (isSameTransaction) {
                const noop = createNoopDisposable();
                return {
                    commit: () => {
                        existing.complete = true;
                    },
                    dispose: () => noop.dispose(),
                };
            }
            throw new CapabilityConflictError(
                token.id,
                existing.providerPluginId,
                providerPluginId,
            );
        }

        const record: CapabilityProviderRecord = {
            token,
            version: providerVersion,
            requiredPermission,
            implementation,
            providerPluginId,
            transactionId,
            complete: false,
        };
        this.providers.set(token.id, record);
        const disposable = createDisposable(() => {
            if (this.providers.get(token.id) === record) this.providers.delete(token.id);
        });
        return {
            commit: () => {
                if (this.providers.get(token.id) === record) record.complete = true;
            },
            dispose: () => disposable.dispose(),
        };
    }

    require<TPort>(requirement: CapabilityRequirement<TPort>, consumerPluginId: string): TPort {
        const value = this.resolve(requirement, consumerPluginId, false);
        // The branded token is the runtime key that makes this boundary cast safe.
        return value as TPort;
    }

    optional<TPort>(
        requirement: CapabilityRequirement<TPort>,
        consumerPluginId: string,
    ): TPort | null {
        const value = this.resolve(requirement, consumerPluginId, true);
        // The branded token is the runtime key that makes this boundary cast safe.
        return value as TPort | null;
    }

    /** @internal Resolves an erased declaration after PluginManager validation. */
    requireDefinition(
        requirement: CapabilityRequirementIdentity,
        consumerPluginId: string,
        visibleTransactions?: ReadonlySet<symbol>,
    ): unknown {
        return this.resolve(requirement, consumerPluginId, false, visibleTransactions);
    }

    /** @internal Resolves an erased optional declaration after PluginManager validation. */
    optionalDefinition(
        requirement: CapabilityRequirementIdentity,
        consumerPluginId: string,
        visibleTransactions?: ReadonlySet<symbol>,
    ): unknown | null {
        return this.resolve(requirement, consumerPluginId, true, visibleTransactions);
    }

    getProviderInfo<TPort>(
        tokenOrId: CapabilityToken<TPort> | string,
    ): CapabilityProviderInfo | null {
        this.assertActive('inspect a capability provider');
        const id = typeof tokenOrId === 'string' ? tokenOrId : tokenOrId.id;
        if (!isRuntimeIdentifier(id)) {
            throw new InvalidPluginDefinitionError(
                'Capability id must match "namespace:kebab-case".',
            );
        }
        const record = this.providers.get(id);
        if (!record) return null;
        return Object.freeze({
            capabilityId: record.token.id,
            version: record.version,
            providerPluginId: record.providerPluginId,
            requiredPermission: record.requiredPermission,
            complete: record.complete,
        });
    }

    has<TPort>(tokenOrId: CapabilityToken<TPort> | string): boolean {
        return this.getProviderInfo(tokenOrId) !== null;
    }

    /** @internal Reads the engineering boundary attached to a visible provider. */
    getRequiredPermission(
        capabilityId: string,
        visibleTransactions?: ReadonlySet<symbol>,
    ): PluginPermission | undefined {
        this.assertActive('inspect a Capability permission');
        if (!isRuntimeIdentifier(capabilityId)) {
            throw new InvalidPluginDefinitionError(
                'Capability id must match "namespace:kebab-case".',
            );
        }
        const record = this.providers.get(capabilityId);
        if (!record) return undefined;
        if (!record.complete && !visibleTransactions?.has(record.transactionId)) return undefined;
        return record.requiredPermission;
    }

    dispose(): void {
        if (this.disposed) return;
        this.providers.clear();
        this.disposed = true;
    }

    private resolve(
        requirement: CapabilityRequirementIdentity,
        consumerPluginId: string,
        optional: boolean,
        visibleTransactions?: ReadonlySet<symbol>,
    ): unknown | null {
        this.assertActive('resolve a capability');
        if (!isRuntimeIdentifier(consumerPluginId)) {
            throw new InvalidPluginDefinitionError(
                'Capability consumer Plugin id must match "namespace:kebab-case".',
                consumerPluginId,
            );
        }
        try {
            assertCapabilityRequirement(requirement);
        } catch (error) {
            throw new PluginCapabilityError({
                consumerPluginId,
                capabilityId: requirement?.token?.id ?? 'unknown',
                requestedRange: requirement?.range ?? '',
                reason: 'invalid-range',
                cause: error,
            });
        }

        const record = this.providers.get(requirement.token.id);
        if (!record) {
            if (optional) return null;
            throw new CapabilityMissingError({
                consumerPluginId,
                capabilityId: requirement.token.id,
                requestedRange: requirement.range,
                availableProviders: this.describeProviders(),
            });
        }

        if (!record.complete && !visibleTransactions?.has(record.transactionId)) {
            if (optional) return null;
            throw new PluginCapabilityError({
                consumerPluginId,
                capabilityId: requirement.token.id,
                requestedRange: requirement.range,
                installedVersion: record.version,
                providerPluginId: record.providerPluginId,
                reason: 'incomplete',
            });
        }

        if (!satisfiesSemVer(record.version, requirement.range)) {
            if (!optional) {
                throw new CapabilityVersionError({
                    capabilityId: requirement.token.id,
                    expectedRange: requirement.range,
                    actualVersion: record.version,
                    providerPluginId: record.providerPluginId,
                    consumerPluginId,
                });
            }
            reportWarningSafely(this.options.warningSink, this.options.errorSink, {
                code: 'OPTIONAL_CAPABILITY_INCOMPATIBLE',
                message: `Optional integration "${requirement.token.id}" was disabled for plugin "${consumerPluginId}" because installed version "${record.version}" does not satisfy "${requirement.range}".`,
                pluginId: consumerPluginId,
                details: {
                    capabilityId: requirement.token.id,
                    requestedRange: requirement.range,
                    installedVersion: record.version,
                    providerPluginId: record.providerPluginId,
                    optionalIntegrationDisabled: true,
                },
            });
            return null;
        }
        return record.implementation;
    }

    private describeProviders(): readonly string[] {
        return Object.freeze(
            [...this.providers.values()]
                .filter((record) => record.complete)
                .map(
                    (record) => `${record.token.id}@${record.version} (${record.providerPluginId})`,
                )
                .sort(),
        );
    }

    private assertActive(operation: string): void {
        if (this.disposed) throw new PluginKernelDisposedError(operation);
    }
}
