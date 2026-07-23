function derivePluginErrorName(code) {
    const stem = code
        .replace('PLUGIN_DEPENDENCY_MISSING', 'PLUGIN_DEPENDENCY')
        .replace('PLUGIN_BATCH_INSTALL_FAILED', 'PLUGIN_BATCH_INSTALL')
        .replace('PLUGIN_PERMISSION_REQUIRED', 'PLUGIN_PERMISSION')
        .replace(/_ERROR$/u, '');
    return `${stem.toLowerCase().replace(/(?:^|_)[a-z]/gu, (match) => match.slice(-1).toUpperCase())}Error`;
}
export class PluginError extends Error {
    constructor(code, message, options = {}) {
        super(message);
        this.name = new.target === PluginError ? 'PluginError' : derivePluginErrorName(code);
        this.code = code;
        this.pluginId = options.pluginId;
        this.cause = options.cause;
    }
}
export class PluginManifestError extends PluginError {
    constructor(message, options = {}) {
        super('PLUGIN_MANIFEST_ERROR', `[ImageEditor] ${message}`, options);
    }
}
export class PluginIdentityConflictError extends PluginManifestError {
    constructor(referenceId, manifestId) {
        super(`Plugin reference "${referenceId}" does not match manifest identity "${manifestId}".`, { pluginId: referenceId });
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'PluginIdentityConflictError'
        });
        this.referenceId = referenceId;
        this.manifestId = manifestId;
    }
}
export class PluginEngineVersionError extends PluginManifestError {
    constructor(pluginId, engineRange, coreApiVersion) {
        super(`Plugin "${pluginId}" requires engine range "${engineRange}", which does not include Core API "${coreApiVersion}".`, { pluginId });
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'PluginEngineVersionError'
        });
        this.engineRange = engineRange;
        this.coreApiVersion = coreApiVersion;
    }
}
export class PluginApiVersionError extends PluginManifestError {
    constructor(pluginId, referenceApiVersion, manifestApiVersion) {
        super(`Plugin "${pluginId}" reference API version "${referenceApiVersion}" does not match manifest API version "${manifestApiVersion}".`, { pluginId });
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'PluginApiVersionError'
        });
        this.referenceApiVersion = referenceApiVersion;
        this.manifestApiVersion = manifestApiVersion;
    }
}
export class PluginAggregateError extends PluginError {
    constructor(message, errors, options = {}) {
        var _a;
        super('PLUGIN_AGGREGATE_ERROR', message, {
            ...options,
            cause: (_a = options.cause) !== null && _a !== void 0 ? _a : errors[0],
        });
        this.errors = Object.freeze([...errors]);
    }
}
export class PluginAlreadyInstalledError extends PluginError {
    constructor(pluginId) {
        super('PLUGIN_ALREADY_INSTALLED', `[ImageEditor] Plugin "${pluginId}" is already installed. Direct duplicate installation is not allowed.`, { pluginId });
    }
}
export class PluginDefinitionAlreadyBoundError extends PluginError {
    constructor(pluginId, boundHostState) {
        super('PLUGIN_DEFINITION_ALREADY_BOUND', `[ImageEditor] Plugin Definition "${pluginId}" is already bound to another Host in state "${boundHostState}". Dispose that Host before reusing the same Definition object.`, { pluginId });
        this.boundHostState = boundHostState;
    }
}
export class PluginNotInstalledError extends PluginError {
    constructor(pluginId) {
        super('PLUGIN_NOT_INSTALLED', `[ImageEditor] Plugin "${pluginId}" is not installed.`, {
            pluginId,
        });
    }
}
export class PluginDependencyError extends PluginError {
    constructor(details) {
        const packageHint = details.packageHint ? ` Package hint: ${details.packageHint}.` : '';
        const available = details.availablePluginIds.length > 0 ? details.availablePluginIds.join(', ') : 'none';
        super('PLUGIN_DEPENDENCY_MISSING', `[ImageEditor] Plugin "${details.consumerPluginId}" requires Plugin "${details.dependencyId}" API "${details.requiredApiVersion}", but it is not available. Available Plugins: ${available}.${packageHint} ${details.planHint}`, { pluginId: details.consumerPluginId });
        this.consumerPluginId = details.consumerPluginId;
        this.dependencyId = details.dependencyId;
        this.requiredApiVersion = details.requiredApiVersion;
        this.availablePluginIds = Object.freeze([...details.availablePluginIds]);
        this.packageHint = details.packageHint;
        this.planHint = details.planHint;
    }
}
export class PluginDependencyCycleError extends PluginError {
    constructor(cycle) {
        super('PLUGIN_DEPENDENCY_CYCLE', `[ImageEditor] Plugin dependency cycle detected: ${cycle.join(' -> ')}.`, { pluginId: cycle[0] });
        this.cycle = Object.freeze([...cycle]);
    }
}
export class PluginDefinitionConflictError extends PluginError {
    constructor(pluginId) {
        super('PLUGIN_DEFINITION_CONFLICT', `[ImageEditor] Plugin "${pluginId}" has conflicting immutable installation definitions.`, { pluginId });
    }
}
export class PluginBatchInstallError extends PluginError {
    constructor(cause, cleanupErrors = []) {
        super('PLUGIN_BATCH_INSTALL_FAILED', '[ImageEditor] Plugin batch installation failed and was rolled back.', { cause });
        this.cleanupErrors = Object.freeze([...cleanupErrors]);
    }
}
export class PluginPermissionError extends PluginError {
    constructor(pluginId, permission, capabilityId, operation = 'access a privileged Capability') {
        super('PLUGIN_PERMISSION_REQUIRED', `[ImageEditor] Plugin "${pluginId}" must declare permission "${permission}" to ${operation} "${capabilityId}".`, { pluginId });
        this.permission = permission;
        this.capabilityId = capabilityId;
        this.operation = operation;
    }
}
export class CapabilityMissingError extends PluginError {
    constructor(details) {
        const available = details.availableProviders.length > 0 ? details.availableProviders.join(', ') : 'none';
        super('CAPABILITY_MISSING', `[ImageEditor] Plugin "${details.consumerPluginId}" requires Capability "${details.capabilityId}" range "${details.requestedRange}", but no provider is available. Available providers: ${available}. Include a declared provider in the Plugin Plan.`, { pluginId: details.consumerPluginId });
        this.consumerPluginId = details.consumerPluginId;
        this.capabilityId = details.capabilityId;
        this.requestedRange = details.requestedRange;
        this.availableProviders = Object.freeze([...details.availableProviders]);
    }
}
export class CapabilityVersionError extends PluginError {
    constructor(details, code = 'CAPABILITY_VERSION_ERROR', message) {
        var _a, _b;
        const provider = details.providerPluginId
            ? ` from provider "${details.providerPluginId}"`
            : '';
        const consumer = details.consumerPluginId
            ? ` for Plugin "${details.consumerPluginId}"`
            : '';
        super(code, message !== null && message !== void 0 ? message : `[ImageEditor] Capability "${details.capabilityId}" version "${(_a = details.actualVersion) !== null && _a !== void 0 ? _a : 'unavailable'}"${provider} does not satisfy "${details.expectedRange}"${consumer}.`, {
            pluginId: (_b = details.consumerPluginId) !== null && _b !== void 0 ? _b : details.providerPluginId,
            cause: details.cause,
        });
        this.capabilityId = details.capabilityId;
        this.expectedRange = details.expectedRange;
        this.actualVersion = details.actualVersion;
        this.providerPluginId = details.providerPluginId;
        this.consumerPluginId = details.consumerPluginId;
    }
}
export class PluginCapabilityError extends PluginError {
    constructor(details) {
        var _a, _b;
        const installed = (_a = details.installedVersion) !== null && _a !== void 0 ? _a : 'not installed';
        const provider = (_b = details.providerPluginId) !== null && _b !== void 0 ? _b : 'none';
        super('PLUGIN_CAPABILITY_ERROR', `[ImageEditor] Plugin "${details.consumerPluginId}" requires capability "${details.capabilityId}" range "${details.requestedRange}", but installed version is "${installed}" from provider "${provider}" (${details.reason}).`, { pluginId: details.consumerPluginId, cause: details.cause });
        this.consumerPluginId = details.consumerPluginId;
        this.capabilityId = details.capabilityId;
        this.requestedRange = details.requestedRange;
        this.installedVersion = details.installedVersion;
        this.providerPluginId = details.providerPluginId;
        this.reason = details.reason;
    }
}
export class CapabilityConflictError extends PluginError {
    constructor(capabilityId, installedProviderPluginId, conflictingProviderPluginId) {
        super('CAPABILITY_CONFLICT', `[ImageEditor] Capability "${capabilityId}" is already provided by "${installedProviderPluginId}" and cannot also be provided by "${conflictingProviderPluginId}".`, { pluginId: conflictingProviderPluginId });
        this.capabilityId = capabilityId;
        this.installedProviderPluginId = installedProviderPluginId;
        this.conflictingProviderPluginId = conflictingProviderPluginId;
    }
}
export class PluginLifecycleError extends PluginError {
    constructor(pluginId, phase, cause, cleanupErrors = []) {
        super('PLUGIN_LIFECYCLE_ERROR', `[ImageEditor] Plugin "${pluginId}" failed during lifecycle phase "${phase}".`, { pluginId, cause });
        this.phase = phase;
        this.cleanupErrors = Object.freeze([...cleanupErrors]);
    }
}
export class PluginSetupError extends PluginError {
    constructor(pluginId, cause, cleanupErrors = []) {
        super('PLUGIN_SETUP_ERROR', `[ImageEditor] Plugin "${pluginId}" setup failed and its installation was rolled back.`, { pluginId, cause });
        this.cleanupErrors = Object.freeze([...cleanupErrors]);
    }
}
export class InvalidPluginDefinitionError extends PluginManifestError {
    constructor(message, pluginId, cause) {
        super(message, { pluginId, cause });
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'InvalidPluginDefinitionError'
        });
    }
}
export class InvalidCapabilityVersionError extends CapabilityVersionError {
    constructor(capabilityId, value, valueKind) {
        super({
            capabilityId,
            expectedRange: `valid SemVer ${valueKind}`,
            actualVersion: value,
        }, 'INVALID_CAPABILITY_VERSION', `[ImageEditor] Capability "${capabilityId}" has invalid SemVer ${valueKind} "${value}".`);
        this.value = value;
        this.valueKind = valueKind;
    }
}
export class PluginVersionMismatchError extends PluginError {
    constructor(pluginId, installedVersion, requestedVersion, installedApiVersion, requestedApiVersion) {
        super('PLUGIN_VERSION_MISMATCH', `[ImageEditor] Plugin "${pluginId}" cannot be reused: installed implementation/API versions are "${installedVersion}"/"${installedApiVersion}", requested versions are "${requestedVersion}"/"${requestedApiVersion}".`, { pluginId });
    }
}
export class OperationRegistrationError extends PluginError {
    constructor(message, pluginId) {
        super('OPERATION_REGISTRATION_ERROR', `[ImageEditor] ${message}`, { pluginId });
    }
}
export class OperationConflictError extends PluginError {
    constructor(message, pluginId) {
        super('OPERATION_CONFLICT', `[ImageEditor] ${message}`, { pluginId });
    }
}
export class ToolRegistrationError extends PluginError {
    constructor(message, pluginId) {
        super('TOOL_REGISTRATION_ERROR', `[ImageEditor] ${message}`, { pluginId });
    }
}
export class ToolTransitionError extends PluginError {
    constructor(toolId, message, pluginId, cause) {
        super('TOOL_TRANSITION_ERROR', `[ImageEditor] Tool "${toolId}" ${message}.`, {
            pluginId,
            cause,
        });
        this.toolId = toolId;
    }
}
export class PluginKernelDisposedError extends PluginError {
    constructor(operation) {
        super('PLUGIN_KERNEL_DISPOSED', `[ImageEditor] Cannot ${operation} after the Plugin Kernel has been disposed.`);
    }
}
export class PluginKernelStateError extends PluginError {
    constructor(operation, state) {
        super('PLUGIN_KERNEL_STATE_ERROR', `[ImageEditor] Cannot ${operation} while the Plugin Kernel is in state "${state}".`);
    }
}
//# sourceMappingURL=errors.js.map