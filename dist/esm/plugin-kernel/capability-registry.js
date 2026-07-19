import { assertCapabilityRequirement, isCapabilityToken, } from './capability-token.js';
import { createDisposable, createNoopDisposable, } from './disposable.js';
import { CapabilityMissingError, CapabilityConflictError, CapabilityVersionError, InvalidCapabilityVersionError, InvalidPluginDefinitionError, PluginCapabilityError, PluginKernelDisposedError, } from './errors.js';
import { reportWarningSafely } from './reporting.js';
import { isValidSemVer, satisfiesSemVer } from './semver.js';
import { isPluginPermission } from './plugin-manifest.js';
import { isRuntimeIdentifier } from './runtime-identifier.js';
function validateProvider(token, implementation, providerPluginId, providerVersion, requiredPermission) {
    var _a, _b;
    if (!isCapabilityToken(token) || !isValidSemVer(token.version)) {
        throw new InvalidCapabilityVersionError((_a = token === null || token === void 0 ? void 0 : token.id) !== null && _a !== void 0 ? _a : 'unknown', (_b = token === null || token === void 0 ? void 0 : token.version) !== null && _b !== void 0 ? _b : '', 'version');
    }
    if (!isRuntimeIdentifier(providerPluginId)) {
        throw new InvalidPluginDefinitionError(`Capability provider id for "${token.id}" must match "namespace:kebab-case".`, providerPluginId);
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
        throw new InvalidPluginDefinitionError(`Capability "${token.id}" requires an unsupported Plugin permission.`, providerPluginId);
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
export class CapabilityRegistry {
    constructor(options = {}) {
        Object.defineProperty(this, "options", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: options
        });
        Object.defineProperty(this, "providers", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "disposed", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
    }
    provide(token, implementation, providerPluginId, requiredPermission) {
        const registration = this.providePending(token, implementation, providerPluginId, Symbol(`capability:${token.id}`), token.version, requiredPermission);
        registration.commit();
        return registration;
    }
    provideHost(token, implementation, providerPluginId = 'core:host', requiredPermission) {
        if (!isCapabilityToken(token)) {
            throw new InvalidPluginDefinitionError('Host capability must use createCapabilityToken().');
        }
        return this.provide(token, implementation, providerPluginId, requiredPermission);
    }
    providePending(token, implementation, providerPluginId, transactionId, providerVersion = token.version, requiredPermission) {
        this.assertActive('provide a capability');
        validateProvider(token, implementation, providerPluginId, providerVersion, requiredPermission);
        const existing = this.providers.get(token.id);
        if (existing) {
            const isSameTransaction = existing.providerPluginId === providerPluginId &&
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
            throw new CapabilityConflictError(token.id, existing.providerPluginId, providerPluginId);
        }
        const record = {
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
            if (this.providers.get(token.id) === record)
                this.providers.delete(token.id);
        });
        return {
            commit: () => {
                if (this.providers.get(token.id) === record)
                    record.complete = true;
            },
            dispose: () => disposable.dispose(),
        };
    }
    require(requirement, consumerPluginId) {
        const value = this.resolve(requirement, consumerPluginId, false);
        return value;
    }
    optional(requirement, consumerPluginId) {
        const value = this.resolve(requirement, consumerPluginId, true);
        return value;
    }
    requireDefinition(requirement, consumerPluginId, visibleTransactions) {
        return this.resolve(requirement, consumerPluginId, false, visibleTransactions);
    }
    optionalDefinition(requirement, consumerPluginId, visibleTransactions) {
        return this.resolve(requirement, consumerPluginId, true, visibleTransactions);
    }
    getProviderInfo(tokenOrId) {
        this.assertActive('inspect a capability provider');
        const id = typeof tokenOrId === 'string' ? tokenOrId : tokenOrId.id;
        if (!isRuntimeIdentifier(id)) {
            throw new InvalidPluginDefinitionError('Capability id must match "namespace:kebab-case".');
        }
        const record = this.providers.get(id);
        if (!record)
            return null;
        return Object.freeze({
            capabilityId: record.token.id,
            version: record.version,
            providerPluginId: record.providerPluginId,
            requiredPermission: record.requiredPermission,
            complete: record.complete,
        });
    }
    has(tokenOrId) {
        return this.getProviderInfo(tokenOrId) !== null;
    }
    getRequiredPermission(capabilityId, visibleTransactions) {
        this.assertActive('inspect a Capability permission');
        if (!isRuntimeIdentifier(capabilityId)) {
            throw new InvalidPluginDefinitionError('Capability id must match "namespace:kebab-case".');
        }
        const record = this.providers.get(capabilityId);
        if (!record)
            return undefined;
        if (!record.complete && !(visibleTransactions === null || visibleTransactions === void 0 ? void 0 : visibleTransactions.has(record.transactionId)))
            return undefined;
        return record.requiredPermission;
    }
    dispose() {
        if (this.disposed)
            return;
        this.providers.clear();
        this.disposed = true;
    }
    resolve(requirement, consumerPluginId, optional, visibleTransactions) {
        var _a, _b, _c;
        this.assertActive('resolve a capability');
        if (!isRuntimeIdentifier(consumerPluginId)) {
            throw new InvalidPluginDefinitionError('Capability consumer Plugin id must match "namespace:kebab-case".', consumerPluginId);
        }
        try {
            assertCapabilityRequirement(requirement);
        }
        catch (error) {
            throw new PluginCapabilityError({
                consumerPluginId,
                capabilityId: (_b = (_a = requirement === null || requirement === void 0 ? void 0 : requirement.token) === null || _a === void 0 ? void 0 : _a.id) !== null && _b !== void 0 ? _b : 'unknown',
                requestedRange: (_c = requirement === null || requirement === void 0 ? void 0 : requirement.range) !== null && _c !== void 0 ? _c : '',
                reason: 'invalid-range',
                cause: error,
            });
        }
        const record = this.providers.get(requirement.token.id);
        if (!record) {
            if (optional)
                return null;
            throw new CapabilityMissingError({
                consumerPluginId,
                capabilityId: requirement.token.id,
                requestedRange: requirement.range,
                availableProviders: this.describeProviders(),
            });
        }
        if (!record.complete && !(visibleTransactions === null || visibleTransactions === void 0 ? void 0 : visibleTransactions.has(record.transactionId))) {
            if (optional)
                return null;
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
    describeProviders() {
        return Object.freeze([...this.providers.values()]
            .filter((record) => record.complete)
            .map((record) => `${record.token.id}@${record.version} (${record.providerPluginId})`)
            .sort());
    }
    assertActive(operation) {
        if (this.disposed)
            throw new PluginKernelDisposedError(operation);
    }
}
//# sourceMappingURL=capability-registry.js.map