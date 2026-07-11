import { assertCapabilityRequirement, isCapabilityToken, } from './capability-token.js';
import { createDisposable, createNoopDisposable, } from './disposable.js';
import { CapabilityConflictError, InvalidCapabilityVersionError, InvalidPluginDefinitionError, PluginCapabilityError, PluginKernelDisposedError, } from './errors.js';
import { reportWarningSafely } from './reporting.js';
import { isValidSemVer, satisfiesSemVer } from './semver.js';
function validateProvider(token, implementation, providerPluginId) {
    var _a, _b;
    if (!isCapabilityToken(token) || !isValidSemVer(token.version)) {
        throw new InvalidCapabilityVersionError((_a = token === null || token === void 0 ? void 0 : token.id) !== null && _a !== void 0 ? _a : 'unknown', (_b = token === null || token === void 0 ? void 0 : token.version) !== null && _b !== void 0 ? _b : '', 'version');
    }
    if (providerPluginId.trim().length === 0 || providerPluginId.trim() !== providerPluginId) {
        throw new InvalidPluginDefinitionError(`Capability provider id for "${token.id}" must be a non-empty trimmed string.`, providerPluginId);
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
    provide(token, implementation, providerPluginId) {
        const registration = this.providePending(token, implementation, providerPluginId, Symbol(`capability:${token.id}`));
        registration.commit();
        return registration;
    }
    providePending(token, implementation, providerPluginId, transactionId) {
        this.assertActive('provide a capability');
        validateProvider(token, implementation, providerPluginId);
        const existing = this.providers.get(token.id);
        if (existing) {
            const isSameTransaction = existing.providerPluginId === providerPluginId &&
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
            throw new CapabilityConflictError(token.id, existing.providerPluginId, providerPluginId);
        }
        const record = {
            token,
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
    requireDefinition(requirement, consumerPluginId) {
        return this.resolve(requirement, consumerPluginId, false);
    }
    optionalDefinition(requirement, consumerPluginId) {
        return this.resolve(requirement, consumerPluginId, true);
    }
    getProviderInfo(tokenOrId) {
        this.assertActive('inspect a capability provider');
        const id = typeof tokenOrId === 'string' ? tokenOrId : tokenOrId.id;
        const record = this.providers.get(id);
        if (!record)
            return null;
        return Object.freeze({
            capabilityId: record.token.id,
            version: record.token.version,
            providerPluginId: record.providerPluginId,
            complete: record.complete,
        });
    }
    has(tokenOrId) {
        return this.getProviderInfo(tokenOrId) !== null;
    }
    dispose() {
        if (this.disposed)
            return;
        this.providers.clear();
        this.disposed = true;
    }
    resolve(requirement, consumerPluginId, optional) {
        var _a, _b, _c;
        this.assertActive('resolve a capability');
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
            throw new PluginCapabilityError({
                consumerPluginId,
                capabilityId: requirement.token.id,
                requestedRange: requirement.range,
                reason: 'missing',
            });
        }
        if (!record.complete) {
            if (optional)
                return null;
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
    assertActive(operation) {
        if (this.disposed)
            throw new PluginKernelDisposedError(operation);
    }
}
//# sourceMappingURL=capability-registry.js.map