/**
 * Structured errors raised by the renderer-neutral Plugin Kernel.
 *
 * @module
 */

function fixPrototype(self: Error, prototype: object): void {
    Object.setPrototypeOf(self, prototype);
}

export interface PluginErrorOptions {
    readonly pluginId?: string;
    readonly cause?: unknown;
}

export class PluginError extends Error {
    public override readonly name: string = 'PluginError';
    public readonly code: string;
    public readonly pluginId: string | undefined;
    public readonly cause: unknown;

    constructor(code: string, message: string, options: PluginErrorOptions = {}) {
        super(message);
        this.code = code;
        this.pluginId = options.pluginId;
        this.cause = options.cause;
        fixPrototype(this, new.target.prototype);
    }
}

export class PluginAggregateError extends PluginError {
    public override readonly name = 'PluginAggregateError';
    public readonly errors: readonly unknown[];

    constructor(message: string, errors: readonly unknown[], options: PluginErrorOptions = {}) {
        super('PLUGIN_AGGREGATE_ERROR', message, {
            ...options,
            cause: options.cause ?? errors[0],
        });
        this.errors = Object.freeze([...errors]);
        fixPrototype(this, PluginAggregateError.prototype);
    }
}

export class PluginAlreadyInstalledError extends PluginError {
    public override readonly name = 'PluginAlreadyInstalledError';

    constructor(pluginId: string) {
        super(
            'PLUGIN_ALREADY_INSTALLED',
            `[ImageEditor] Plugin "${pluginId}" is already installed. Direct duplicate installation is not allowed.`,
            { pluginId },
        );
        fixPrototype(this, PluginAlreadyInstalledError.prototype);
    }
}

export class PluginNotInstalledError extends PluginError {
    public override readonly name = 'PluginNotInstalledError';

    constructor(pluginId: string) {
        super('PLUGIN_NOT_INSTALLED', `[ImageEditor] Plugin "${pluginId}" is not installed.`, {
            pluginId,
        });
        fixPrototype(this, PluginNotInstalledError.prototype);
    }
}

export type PluginCapabilityFailureReason =
    'missing' | 'incompatible' | 'incomplete' | 'invalid-range';

export interface PluginCapabilityErrorDetails {
    readonly consumerPluginId: string;
    readonly capabilityId: string;
    readonly requestedRange: string;
    readonly installedVersion?: string;
    readonly providerPluginId?: string;
    readonly reason: PluginCapabilityFailureReason;
    readonly cause?: unknown;
}

export class PluginCapabilityError extends PluginError {
    public override readonly name = 'PluginCapabilityError';
    public readonly consumerPluginId: string;
    public readonly capabilityId: string;
    public readonly requestedRange: string;
    public readonly installedVersion: string | undefined;
    public readonly providerPluginId: string | undefined;
    public readonly reason: PluginCapabilityFailureReason;

    constructor(details: PluginCapabilityErrorDetails) {
        const installed = details.installedVersion ?? 'not installed';
        const provider = details.providerPluginId ?? 'none';
        super(
            'PLUGIN_CAPABILITY_ERROR',
            `[ImageEditor] Plugin "${details.consumerPluginId}" requires capability "${details.capabilityId}" range "${details.requestedRange}", but installed version is "${installed}" from provider "${provider}" (${details.reason}).`,
            { pluginId: details.consumerPluginId, cause: details.cause },
        );
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
    public override readonly name = 'CapabilityConflictError';
    public readonly capabilityId: string;
    public readonly installedProviderPluginId: string;
    public readonly conflictingProviderPluginId: string;

    constructor(
        capabilityId: string,
        installedProviderPluginId: string,
        conflictingProviderPluginId: string,
    ) {
        super(
            'CAPABILITY_CONFLICT',
            `[ImageEditor] Capability "${capabilityId}" is already provided by "${installedProviderPluginId}" and cannot also be provided by "${conflictingProviderPluginId}".`,
            { pluginId: conflictingProviderPluginId },
        );
        this.capabilityId = capabilityId;
        this.installedProviderPluginId = installedProviderPluginId;
        this.conflictingProviderPluginId = conflictingProviderPluginId;
        fixPrototype(this, CapabilityConflictError.prototype);
    }
}

export type PluginLifecyclePhase = 'init' | 'image-loaded' | 'image-cleared' | 'dispose';

export class PluginLifecycleError extends PluginError {
    public override readonly name = 'PluginLifecycleError';
    public readonly phase: PluginLifecyclePhase;
    public readonly cleanupErrors: readonly unknown[];

    constructor(
        pluginId: string,
        phase: PluginLifecyclePhase,
        cause: unknown,
        cleanupErrors: readonly unknown[] = [],
    ) {
        super(
            'PLUGIN_LIFECYCLE_ERROR',
            `[ImageEditor] Plugin "${pluginId}" failed during lifecycle phase "${phase}".`,
            { pluginId, cause },
        );
        this.phase = phase;
        this.cleanupErrors = Object.freeze([...cleanupErrors]);
        fixPrototype(this, PluginLifecycleError.prototype);
    }
}

export class PluginSetupError extends PluginError {
    public override readonly name = 'PluginSetupError';
    public readonly cleanupErrors: readonly unknown[];

    constructor(pluginId: string, cause: unknown, cleanupErrors: readonly unknown[] = []) {
        super(
            'PLUGIN_SETUP_ERROR',
            `[ImageEditor] Plugin "${pluginId}" setup failed and its installation was rolled back.`,
            { pluginId, cause },
        );
        this.cleanupErrors = Object.freeze([...cleanupErrors]);
        fixPrototype(this, PluginSetupError.prototype);
    }
}

export class InvalidPluginDefinitionError extends PluginError {
    public override readonly name = 'InvalidPluginDefinitionError';

    constructor(message: string, pluginId?: string, cause?: unknown) {
        super('INVALID_PLUGIN_DEFINITION', `[ImageEditor] ${message}`, { pluginId, cause });
        fixPrototype(this, InvalidPluginDefinitionError.prototype);
    }
}

export class InvalidCapabilityVersionError extends PluginError {
    public override readonly name = 'InvalidCapabilityVersionError';
    public readonly capabilityId: string;
    public readonly value: string;
    public readonly valueKind: 'version' | 'range';

    constructor(capabilityId: string, value: string, valueKind: 'version' | 'range') {
        super(
            'INVALID_CAPABILITY_VERSION',
            `[ImageEditor] Capability "${capabilityId}" has invalid SemVer ${valueKind} "${value}".`,
        );
        this.capabilityId = capabilityId;
        this.value = value;
        this.valueKind = valueKind;
        fixPrototype(this, InvalidCapabilityVersionError.prototype);
    }
}

export class PluginVersionMismatchError extends PluginError {
    public override readonly name = 'PluginVersionMismatchError';

    constructor(
        pluginId: string,
        installedVersion: string,
        requestedVersion: string,
        installedApiVersion: string,
        requestedApiVersion: string,
    ) {
        super(
            'PLUGIN_VERSION_MISMATCH',
            `[ImageEditor] Plugin "${pluginId}" cannot be reused: installed implementation/API versions are "${installedVersion}"/"${installedApiVersion}", requested versions are "${requestedVersion}"/"${requestedApiVersion}".`,
            { pluginId },
        );
        fixPrototype(this, PluginVersionMismatchError.prototype);
    }
}

export class OperationRegistrationError extends PluginError {
    public override readonly name = 'OperationRegistrationError';

    constructor(message: string, pluginId?: string) {
        super('OPERATION_REGISTRATION_ERROR', `[ImageEditor] ${message}`, { pluginId });
        fixPrototype(this, OperationRegistrationError.prototype);
    }
}

export class OperationConflictError extends PluginError {
    public override readonly name = 'OperationConflictError';

    constructor(message: string, pluginId?: string) {
        super('OPERATION_CONFLICT', `[ImageEditor] ${message}`, { pluginId });
        fixPrototype(this, OperationConflictError.prototype);
    }
}

export class ToolRegistrationError extends PluginError {
    public override readonly name = 'ToolRegistrationError';

    constructor(message: string, pluginId?: string) {
        super('TOOL_REGISTRATION_ERROR', `[ImageEditor] ${message}`, { pluginId });
        fixPrototype(this, ToolRegistrationError.prototype);
    }
}

export class ToolTransitionError extends PluginError {
    public override readonly name = 'ToolTransitionError';
    public readonly toolId: string;

    constructor(toolId: string, message: string, pluginId?: string, cause?: unknown) {
        super('TOOL_TRANSITION_ERROR', `[ImageEditor] Tool "${toolId}" ${message}.`, {
            pluginId,
            cause,
        });
        this.toolId = toolId;
        fixPrototype(this, ToolTransitionError.prototype);
    }
}

export class PluginKernelDisposedError extends PluginError {
    public override readonly name = 'PluginKernelDisposedError';

    constructor(operation: string) {
        super(
            'PLUGIN_KERNEL_DISPOSED',
            `[ImageEditor] Cannot ${operation} after the Plugin Kernel has been disposed.`,
        );
        fixPrototype(this, PluginKernelDisposedError.prototype);
    }
}

export class PluginKernelStateError extends PluginError {
    public override readonly name = 'PluginKernelStateError';

    constructor(operation: string, state: string) {
        super(
            'PLUGIN_KERNEL_STATE_ERROR',
            `[ImageEditor] Cannot ${operation} while the Plugin Kernel is in state "${state}".`,
        );
        fixPrototype(this, PluginKernelStateError.prototype);
    }
}
