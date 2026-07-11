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
    CapabilityConflictError,
    InvalidCapabilityVersionError,
    InvalidPluginDefinitionError,
    PluginCapabilityError,
    PluginKernelDisposedError,
} from './errors.js';
import { reportWarningSafely, type PluginErrorSink, type PluginWarningSink } from './reporting.js';
import { isValidSemVer, satisfiesSemVer } from './semver.js';

interface CapabilityProviderRecord {
    readonly token: CapabilityIdentity;
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
    readonly complete: boolean;
}

function validateProvider<TPort>(
    token: CapabilityToken<TPort>,
    implementation: TPort,
    providerPluginId: string,
): void {
    if (!isCapabilityToken(token) || !isValidSemVer(token.version)) {
        throw new InvalidCapabilityVersionError(
            token?.id ?? 'unknown',
            token?.version ?? '',
            'version',
        );
    }
    if (providerPluginId.trim().length === 0 || providerPluginId.trim() !== providerPluginId) {
        throw new InvalidPluginDefinitionError(
            `Capability provider id for "${token.id}" must be a non-empty trimmed string.`,
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
    ): Disposable {
        const registration = this.providePending(
            token,
            implementation,
            providerPluginId,
            Symbol(`capability:${token.id}`),
        );
        registration.commit();
        return registration;
    }

    /** @internal Used by RegistrationScope to hide provisional providers. */
    providePending<TPort>(
        token: CapabilityToken<TPort>,
        implementation: TPort,
        providerPluginId: string,
        transactionId: symbol,
    ): CommitAwareDisposable {
        this.assertActive('provide a capability');
        validateProvider(token, implementation, providerPluginId);
        const existing = this.providers.get(token.id);

        if (existing) {
            const isSameTransaction =
                existing.providerPluginId === providerPluginId &&
                existing.transactionId === transactionId &&
                existing.token.version === token.version &&
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
    ): unknown {
        return this.resolve(requirement, consumerPluginId, false);
    }

    /** @internal Resolves an erased optional declaration after PluginManager validation. */
    optionalDefinition(
        requirement: CapabilityRequirementIdentity,
        consumerPluginId: string,
    ): unknown | null {
        return this.resolve(requirement, consumerPluginId, true);
    }

    getProviderInfo<TPort>(
        tokenOrId: CapabilityToken<TPort> | string,
    ): CapabilityProviderInfo | null {
        this.assertActive('inspect a capability provider');
        const id = typeof tokenOrId === 'string' ? tokenOrId : tokenOrId.id;
        const record = this.providers.get(id);
        if (!record) return null;
        return Object.freeze({
            capabilityId: record.token.id,
            version: record.token.version,
            providerPluginId: record.providerPluginId,
            complete: record.complete,
        });
    }

    has<TPort>(tokenOrId: CapabilityToken<TPort> | string): boolean {
        return this.getProviderInfo(tokenOrId) !== null;
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
    ): unknown | null {
        this.assertActive('resolve a capability');
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
            throw new PluginCapabilityError({
                consumerPluginId,
                capabilityId: requirement.token.id,
                requestedRange: requirement.range,
                reason: 'missing',
            });
        }

        if (!record.complete) {
            if (optional) return null;
            throw new PluginCapabilityError({
                consumerPluginId,
                capabilityId: requirement.token.id,
                requestedRange: requirement.range,
                installedVersion: record.token.version,
                providerPluginId: record.providerPluginId,
                reason: 'incomplete',
            });
        }

        if (!satisfiesSemVer(record.token.version, requirement.range)) {
            if (!optional) {
                throw new PluginCapabilityError({
                    consumerPluginId,
                    capabilityId: requirement.token.id,
                    requestedRange: requirement.range,
                    installedVersion: record.token.version,
                    providerPluginId: record.providerPluginId,
                    reason: 'incompatible',
                });
            }
            reportWarningSafely(this.options.warningSink, this.options.errorSink, {
                code: 'OPTIONAL_CAPABILITY_INCOMPATIBLE',
                message: `Optional integration "${requirement.token.id}" was disabled for plugin "${consumerPluginId}" because installed version "${record.token.version}" does not satisfy "${requirement.range}".`,
                pluginId: consumerPluginId,
                details: {
                    capabilityId: requirement.token.id,
                    requestedRange: requirement.range,
                    installedVersion: record.token.version,
                    providerPluginId: record.providerPluginId,
                    optionalIntegrationDisabled: true,
                },
            });
            return null;
        }
        return record.implementation;
    }

    private assertActive(operation: string): void {
        if (this.disposed) throw new PluginKernelDisposedError(operation);
    }
}
