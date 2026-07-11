function fixPrototype(self, prototype) {
    Object.setPrototypeOf(self, prototype);
}
export class PluginError extends Error {
    constructor(code, message, options = {}) {
        super(message);
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'PluginError'
        });
        Object.defineProperty(this, "code", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "pluginId", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "cause", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.code = code;
        this.pluginId = options.pluginId;
        this.cause = options.cause;
        fixPrototype(this, new.target.prototype);
    }
}
export class PluginAggregateError extends PluginError {
    constructor(message, errors, options = {}) {
        var _a;
        super('PLUGIN_AGGREGATE_ERROR', message, {
            ...options,
            cause: (_a = options.cause) !== null && _a !== void 0 ? _a : errors[0],
        });
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'PluginAggregateError'
        });
        Object.defineProperty(this, "errors", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.errors = Object.freeze([...errors]);
        fixPrototype(this, PluginAggregateError.prototype);
    }
}
export class PluginAlreadyInstalledError extends PluginError {
    constructor(pluginId) {
        super('PLUGIN_ALREADY_INSTALLED', `[ImageEditor] Plugin "${pluginId}" is already installed. Direct duplicate installation is not allowed.`, { pluginId });
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'PluginAlreadyInstalledError'
        });
        fixPrototype(this, PluginAlreadyInstalledError.prototype);
    }
}
export class PluginNotInstalledError extends PluginError {
    constructor(pluginId) {
        super('PLUGIN_NOT_INSTALLED', `[ImageEditor] Plugin "${pluginId}" is not installed.`, {
            pluginId,
        });
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'PluginNotInstalledError'
        });
        fixPrototype(this, PluginNotInstalledError.prototype);
    }
}
export class PluginCapabilityError extends PluginError {
    constructor(details) {
        var _a, _b;
        const installed = (_a = details.installedVersion) !== null && _a !== void 0 ? _a : 'not installed';
        const provider = (_b = details.providerPluginId) !== null && _b !== void 0 ? _b : 'none';
        super('PLUGIN_CAPABILITY_ERROR', `[ImageEditor] Plugin "${details.consumerPluginId}" requires capability "${details.capabilityId}" range "${details.requestedRange}", but installed version is "${installed}" from provider "${provider}" (${details.reason}).`, { pluginId: details.consumerPluginId, cause: details.cause });
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'PluginCapabilityError'
        });
        Object.defineProperty(this, "consumerPluginId", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "capabilityId", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "requestedRange", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "installedVersion", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "providerPluginId", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "reason", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.consumerPluginId = details.consumerPluginId;
        this.capabilityId = details.capabilityId;
        this.requestedRange = details.requestedRange;
        this.installedVersion = details.installedVersion;
        this.providerPluginId = details.providerPluginId;
        this.reason = details.reason;
        fixPrototype(this, PluginCapabilityError.prototype);
    }
}
export class CapabilityConflictError extends PluginError {
    constructor(capabilityId, installedProviderPluginId, conflictingProviderPluginId) {
        super('CAPABILITY_CONFLICT', `[ImageEditor] Capability "${capabilityId}" is already provided by "${installedProviderPluginId}" and cannot also be provided by "${conflictingProviderPluginId}".`, { pluginId: conflictingProviderPluginId });
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'CapabilityConflictError'
        });
        Object.defineProperty(this, "capabilityId", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "installedProviderPluginId", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "conflictingProviderPluginId", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.capabilityId = capabilityId;
        this.installedProviderPluginId = installedProviderPluginId;
        this.conflictingProviderPluginId = conflictingProviderPluginId;
        fixPrototype(this, CapabilityConflictError.prototype);
    }
}
export class PluginLifecycleError extends PluginError {
    constructor(pluginId, phase, cause, cleanupErrors = []) {
        super('PLUGIN_LIFECYCLE_ERROR', `[ImageEditor] Plugin "${pluginId}" failed during lifecycle phase "${phase}".`, { pluginId, cause });
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'PluginLifecycleError'
        });
        Object.defineProperty(this, "phase", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "cleanupErrors", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.phase = phase;
        this.cleanupErrors = Object.freeze([...cleanupErrors]);
        fixPrototype(this, PluginLifecycleError.prototype);
    }
}
export class PluginSetupError extends PluginError {
    constructor(pluginId, cause, cleanupErrors = []) {
        super('PLUGIN_SETUP_ERROR', `[ImageEditor] Plugin "${pluginId}" setup failed and its installation was rolled back.`, { pluginId, cause });
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'PluginSetupError'
        });
        Object.defineProperty(this, "cleanupErrors", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.cleanupErrors = Object.freeze([...cleanupErrors]);
        fixPrototype(this, PluginSetupError.prototype);
    }
}
export class InvalidPluginDefinitionError extends PluginError {
    constructor(message, pluginId, cause) {
        super('INVALID_PLUGIN_DEFINITION', `[ImageEditor] ${message}`, { pluginId, cause });
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'InvalidPluginDefinitionError'
        });
        fixPrototype(this, InvalidPluginDefinitionError.prototype);
    }
}
export class InvalidCapabilityVersionError extends PluginError {
    constructor(capabilityId, value, valueKind) {
        super('INVALID_CAPABILITY_VERSION', `[ImageEditor] Capability "${capabilityId}" has invalid SemVer ${valueKind} "${value}".`);
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'InvalidCapabilityVersionError'
        });
        Object.defineProperty(this, "capabilityId", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "value", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "valueKind", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.capabilityId = capabilityId;
        this.value = value;
        this.valueKind = valueKind;
        fixPrototype(this, InvalidCapabilityVersionError.prototype);
    }
}
export class PluginVersionMismatchError extends PluginError {
    constructor(pluginId, installedVersion, requestedVersion, installedApiVersion, requestedApiVersion) {
        super('PLUGIN_VERSION_MISMATCH', `[ImageEditor] Plugin "${pluginId}" cannot be reused: installed implementation/API versions are "${installedVersion}"/"${installedApiVersion}", requested versions are "${requestedVersion}"/"${requestedApiVersion}".`, { pluginId });
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'PluginVersionMismatchError'
        });
        fixPrototype(this, PluginVersionMismatchError.prototype);
    }
}
export class OperationRegistrationError extends PluginError {
    constructor(message, pluginId) {
        super('OPERATION_REGISTRATION_ERROR', `[ImageEditor] ${message}`, { pluginId });
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'OperationRegistrationError'
        });
        fixPrototype(this, OperationRegistrationError.prototype);
    }
}
export class OperationConflictError extends PluginError {
    constructor(message, pluginId) {
        super('OPERATION_CONFLICT', `[ImageEditor] ${message}`, { pluginId });
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'OperationConflictError'
        });
        fixPrototype(this, OperationConflictError.prototype);
    }
}
export class ToolRegistrationError extends PluginError {
    constructor(message, pluginId) {
        super('TOOL_REGISTRATION_ERROR', `[ImageEditor] ${message}`, { pluginId });
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'ToolRegistrationError'
        });
        fixPrototype(this, ToolRegistrationError.prototype);
    }
}
export class ToolTransitionError extends PluginError {
    constructor(toolId, message, pluginId, cause) {
        super('TOOL_TRANSITION_ERROR', `[ImageEditor] Tool "${toolId}" ${message}.`, {
            pluginId,
            cause,
        });
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'ToolTransitionError'
        });
        Object.defineProperty(this, "toolId", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.toolId = toolId;
        fixPrototype(this, ToolTransitionError.prototype);
    }
}
export class PluginKernelDisposedError extends PluginError {
    constructor(operation) {
        super('PLUGIN_KERNEL_DISPOSED', `[ImageEditor] Cannot ${operation} after the Plugin Kernel has been disposed.`);
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'PluginKernelDisposedError'
        });
        fixPrototype(this, PluginKernelDisposedError.prototype);
    }
}
export class PluginKernelStateError extends PluginError {
    constructor(operation, state) {
        super('PLUGIN_KERNEL_STATE_ERROR', `[ImageEditor] Cannot ${operation} while the Plugin Kernel is in state "${state}".`);
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'PluginKernelStateError'
        });
        fixPrototype(this, PluginKernelStateError.prototype);
    }
}
//# sourceMappingURL=errors.js.map