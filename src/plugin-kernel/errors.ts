/**
 * Structured errors raised by the renderer-neutral Plugin Kernel.
 *
 * @module
 */

export interface PluginErrorOptions {
    readonly pluginId?: string;
    readonly cause?: unknown;
}

function derivePluginErrorName(code: string): string {
    const stem = code
        .replace('PLUGIN_DEPENDENCY_MISSING', 'PLUGIN_DEPENDENCY')
        .replace('PLUGIN_BATCH_INSTALL_FAILED', 'PLUGIN_BATCH_INSTALL')
        .replace('PLUGIN_PERMISSION_REQUIRED', 'PLUGIN_PERMISSION')
        .replace(/_ERROR$/u, '');
    return `${stem.toLowerCase().replace(/(?:^|_)[a-z]/gu, (match) => match.slice(-1).toUpperCase())}Error`;
}

export class PluginError extends Error {
    declare public readonly name: string;
    declare public readonly code: string;
    declare public readonly pluginId: string | undefined;
    declare public readonly cause: unknown;

    constructor(code: string, message: string, options: PluginErrorOptions = {}) {
        super(message);
        this.name = new.target === PluginError ? 'PluginError' : derivePluginErrorName(code);
        this.code = code;
        this.pluginId = options.pluginId;
        this.cause = options.cause;
    }
}

/**
 * Raised when untrusted Plugin metadata does not satisfy the public manifest contract.
 *
 * @remarks
 * Manifest validation completes before Plugin setup starts, so this error never
 * represents a partially installed Plugin.
 */
export class PluginManifestError extends PluginError {
    constructor(message: string, options: PluginErrorOptions = {}) {
        super('PLUGIN_MANIFEST_ERROR', `[ImageEditor] ${message}`, options);
    }
}

/** Raised when a Plugin reference and manifest describe different identities. */
export class PluginIdentityConflictError extends PluginManifestError {
    public override readonly name = 'PluginIdentityConflictError';
    declare public readonly referenceId: string;
    declare public readonly manifestId: string;

    constructor(referenceId: string, manifestId: string) {
        super(
            `Plugin reference "${referenceId}" does not match manifest identity "${manifestId}".`,
            { pluginId: referenceId },
        );
        this.referenceId = referenceId;
        this.manifestId = manifestId;
    }
}

/** Raised when a Plugin manifest targets an unsupported Core engine range. */
export class PluginEngineVersionError extends PluginManifestError {
    public override readonly name = 'PluginEngineVersionError';
    declare public readonly engineRange: string;
    declare public readonly coreApiVersion: string;

    constructor(pluginId: string, engineRange: string, coreApiVersion: string) {
        super(
            `Plugin "${pluginId}" requires engine range "${engineRange}", which does not include Core API "${coreApiVersion}".`,
            { pluginId },
        );
        this.engineRange = engineRange;
        this.coreApiVersion = coreApiVersion;
    }
}

/** Raised when a Plugin reference and manifest disagree about the exposed API version. */
export class PluginApiVersionError extends PluginManifestError {
    public override readonly name = 'PluginApiVersionError';
    declare public readonly referenceApiVersion: string;
    declare public readonly manifestApiVersion: string;

    constructor(pluginId: string, referenceApiVersion: string, manifestApiVersion: string) {
        super(
            `Plugin "${pluginId}" reference API version "${referenceApiVersion}" does not match manifest API version "${manifestApiVersion}".`,
            { pluginId },
        );
        this.referenceApiVersion = referenceApiVersion;
        this.manifestApiVersion = manifestApiVersion;
    }
}

export class PluginAggregateError extends PluginError {
    declare public readonly errors: readonly unknown[];

    constructor(message: string, errors: readonly unknown[], options: PluginErrorOptions = {}) {
        super('PLUGIN_AGGREGATE_ERROR', message, {
            ...options,
            cause: options.cause ?? errors[0],
        });
        this.errors = Object.freeze([...errors]);
    }
}

export class PluginAlreadyInstalledError extends PluginError {
    constructor(pluginId: string) {
        super(
            'PLUGIN_ALREADY_INSTALLED',
            `[ImageEditor] Plugin "${pluginId}" is already installed. Direct duplicate installation is not allowed.`,
            { pluginId },
        );
    }
}

/** Raised when one concrete Plugin Definition is still leased by another live Host. */
export class PluginDefinitionAlreadyBoundError extends PluginError {
    declare public readonly boundHostState: string;

    constructor(pluginId: string, boundHostState: string) {
        super(
            'PLUGIN_DEFINITION_ALREADY_BOUND',
            `[ImageEditor] Plugin Definition "${pluginId}" is already bound to another Host in state "${boundHostState}". Dispose that Host before reusing the same Definition object.`,
            { pluginId },
        );
        this.boundHostState = boundHostState;
    }
}

export class PluginNotInstalledError extends PluginError {
    constructor(pluginId: string) {
        super('PLUGIN_NOT_INSTALLED', `[ImageEditor] Plugin "${pluginId}" is not installed.`, {
            pluginId,
        });
    }
}

export interface PluginDependencyErrorDetails {
    readonly consumerPluginId: string;
    readonly dependencyId: string;
    readonly requiredApiVersion: string;
    readonly availablePluginIds: readonly string[];
    readonly packageHint?: string;
    readonly planHint: string;
}

/** Raised when an explicitly declared Plugin dependency is unavailable. */
export class PluginDependencyError extends PluginError {
    declare public readonly consumerPluginId: string;
    declare public readonly dependencyId: string;
    declare public readonly requiredApiVersion: string;
    declare public readonly availablePluginIds: readonly string[];
    declare public readonly packageHint: string | undefined;
    declare public readonly planHint: string;

    constructor(details: PluginDependencyErrorDetails) {
        const packageHint = details.packageHint ? ` Package hint: ${details.packageHint}.` : '';
        const available =
            details.availablePluginIds.length > 0 ? details.availablePluginIds.join(', ') : 'none';
        super(
            'PLUGIN_DEPENDENCY_MISSING',
            `[ImageEditor] Plugin "${details.consumerPluginId}" requires Plugin "${details.dependencyId}" API "${details.requiredApiVersion}", but it is not available. Available Plugins: ${available}.${packageHint} ${details.planHint}`,
            { pluginId: details.consumerPluginId },
        );
        this.consumerPluginId = details.consumerPluginId;
        this.dependencyId = details.dependencyId;
        this.requiredApiVersion = details.requiredApiVersion;
        this.availablePluginIds = Object.freeze([...details.availablePluginIds]);
        this.packageHint = details.packageHint;
        this.planHint = details.planHint;
    }
}

/** Raised before setup when the explicit Plugin dependency graph contains a cycle. */
export class PluginDependencyCycleError extends PluginError {
    declare public readonly cycle: readonly string[];

    constructor(cycle: readonly string[]) {
        super(
            'PLUGIN_DEPENDENCY_CYCLE',
            `[ImageEditor] Plugin dependency cycle detected: ${cycle.join(' -> ')}.`,
            { pluginId: cycle[0] },
        );
        this.cycle = Object.freeze([...cycle]);
    }
}

/** Raised when one installation contains incompatible definitions for the same Plugin ID. */
export class PluginDefinitionConflictError extends PluginError {
    constructor(pluginId: string) {
        super(
            'PLUGIN_DEFINITION_CONFLICT',
            `[ImageEditor] Plugin "${pluginId}" has conflicting immutable installation definitions.`,
            { pluginId },
        );
    }
}

/** Raised after an atomic Plugin batch is rolled back. */
export class PluginBatchInstallError extends PluginError {
    declare public readonly cleanupErrors: readonly unknown[];

    constructor(cause: unknown, cleanupErrors: readonly unknown[] = []) {
        super(
            'PLUGIN_BATCH_INSTALL_FAILED',
            '[ImageEditor] Plugin batch installation failed and was rolled back.',
            { cause },
        );
        this.cleanupErrors = Object.freeze([...cleanupErrors]);
    }
}

/** Raised before setup when a Plugin omits a permission required by a Capability. */
export class PluginPermissionError extends PluginError {
    declare public readonly permission: string;
    declare public readonly capabilityId: string;
    declare public readonly operation: string;

    constructor(
        pluginId: string,
        permission: string,
        capabilityId: string,
        operation = 'access a privileged Capability',
    ) {
        super(
            'PLUGIN_PERMISSION_REQUIRED',
            `[ImageEditor] Plugin "${pluginId}" must declare permission "${permission}" to ${operation} "${capabilityId}".`,
            { pluginId },
        );
        this.permission = permission;
        this.capabilityId = capabilityId;
        this.operation = operation;
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

export interface CapabilityMissingErrorDetails {
    readonly consumerPluginId: string;
    readonly capabilityId: string;
    readonly requestedRange: string;
    readonly availableProviders: readonly string[];
}

/** Raised when a required Capability has no active provider. */
export class CapabilityMissingError extends PluginError {
    declare public readonly consumerPluginId: string;
    declare public readonly capabilityId: string;
    declare public readonly requestedRange: string;
    declare public readonly availableProviders: readonly string[];

    constructor(details: CapabilityMissingErrorDetails) {
        const available =
            details.availableProviders.length > 0 ? details.availableProviders.join(', ') : 'none';
        super(
            'CAPABILITY_MISSING',
            `[ImageEditor] Plugin "${details.consumerPluginId}" requires Capability "${details.capabilityId}" range "${details.requestedRange}", but no provider is available. Available providers: ${available}. Include a declared provider in the Plugin Plan.`,
            { pluginId: details.consumerPluginId },
        );
        this.consumerPluginId = details.consumerPluginId;
        this.capabilityId = details.capabilityId;
        this.requestedRange = details.requestedRange;
        this.availableProviders = Object.freeze([...details.availableProviders]);
    }
}

export interface CapabilityVersionErrorDetails {
    readonly capabilityId: string;
    readonly expectedRange: string;
    readonly actualVersion?: string;
    readonly providerPluginId?: string;
    readonly consumerPluginId?: string;
    readonly cause?: unknown;
}

/** Raised when a Capability version is invalid or outside the required range. */
export class CapabilityVersionError extends PluginError {
    declare public readonly capabilityId: string;
    declare public readonly expectedRange: string;
    declare public readonly actualVersion: string | undefined;
    declare public readonly providerPluginId: string | undefined;
    declare public readonly consumerPluginId: string | undefined;

    constructor(
        details: CapabilityVersionErrorDetails,
        code = 'CAPABILITY_VERSION_ERROR',
        message?: string,
    ) {
        const provider = details.providerPluginId
            ? ` from provider "${details.providerPluginId}"`
            : '';
        const consumer = details.consumerPluginId
            ? ` for Plugin "${details.consumerPluginId}"`
            : '';
        super(
            code,
            message ??
                `[ImageEditor] Capability "${details.capabilityId}" version "${details.actualVersion ?? 'unavailable'}"${provider} does not satisfy "${details.expectedRange}"${consumer}.`,
            {
                pluginId: details.consumerPluginId ?? details.providerPluginId,
                cause: details.cause,
            },
        );
        this.capabilityId = details.capabilityId;
        this.expectedRange = details.expectedRange;
        this.actualVersion = details.actualVersion;
        this.providerPluginId = details.providerPluginId;
        this.consumerPluginId = details.consumerPluginId;
    }
}

export class PluginCapabilityError extends PluginError {
    declare public readonly consumerPluginId: string;
    declare public readonly capabilityId: string;
    declare public readonly requestedRange: string;
    declare public readonly installedVersion: string | undefined;
    declare public readonly providerPluginId: string | undefined;
    declare public readonly reason: PluginCapabilityFailureReason;

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
    }
}

export class CapabilityConflictError extends PluginError {
    declare public readonly capabilityId: string;
    declare public readonly installedProviderPluginId: string;
    declare public readonly conflictingProviderPluginId: string;

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
    }
}

export type PluginLifecyclePhase = 'init' | 'image-loaded' | 'image-cleared' | 'dispose';

export class PluginLifecycleError extends PluginError {
    declare public readonly phase: PluginLifecyclePhase;
    declare public readonly cleanupErrors: readonly unknown[];

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
    }
}

export class PluginSetupError extends PluginError {
    declare public readonly cleanupErrors: readonly unknown[];

    constructor(pluginId: string, cause: unknown, cleanupErrors: readonly unknown[] = []) {
        super(
            'PLUGIN_SETUP_ERROR',
            `[ImageEditor] Plugin "${pluginId}" setup failed and its installation was rolled back.`,
            { pluginId, cause },
        );
        this.cleanupErrors = Object.freeze([...cleanupErrors]);
    }
}

export class InvalidPluginDefinitionError extends PluginManifestError {
    public override readonly name = 'InvalidPluginDefinitionError';

    constructor(message: string, pluginId?: string, cause?: unknown) {
        super(message, { pluginId, cause });
    }
}

export class InvalidCapabilityVersionError extends CapabilityVersionError {
    declare public readonly value: string;
    declare public readonly valueKind: 'version' | 'range';

    constructor(capabilityId: string, value: string, valueKind: 'version' | 'range') {
        super(
            {
                capabilityId,
                expectedRange: `valid SemVer ${valueKind}`,
                actualVersion: value,
            },
            'INVALID_CAPABILITY_VERSION',
            `[ImageEditor] Capability "${capabilityId}" has invalid SemVer ${valueKind} "${value}".`,
        );
        this.value = value;
        this.valueKind = valueKind;
    }
}

export class PluginVersionMismatchError extends PluginError {
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
    }
}

export class OperationRegistrationError extends PluginError {
    constructor(message: string, pluginId?: string) {
        super('OPERATION_REGISTRATION_ERROR', `[ImageEditor] ${message}`, { pluginId });
    }
}

export class OperationConflictError extends PluginError {
    constructor(message: string, pluginId?: string) {
        super('OPERATION_CONFLICT', `[ImageEditor] ${message}`, { pluginId });
    }
}

export class ToolRegistrationError extends PluginError {
    constructor(message: string, pluginId?: string) {
        super('TOOL_REGISTRATION_ERROR', `[ImageEditor] ${message}`, { pluginId });
    }
}

export class ToolTransitionError extends PluginError {
    declare public readonly toolId: string;

    constructor(toolId: string, message: string, pluginId?: string, cause?: unknown) {
        super('TOOL_TRANSITION_ERROR', `[ImageEditor] Tool "${toolId}" ${message}.`, {
            pluginId,
            cause,
        });
        this.toolId = toolId;
    }
}

export class PluginKernelDisposedError extends PluginError {
    constructor(operation: string) {
        super(
            'PLUGIN_KERNEL_DISPOSED',
            `[ImageEditor] Cannot ${operation} after the Plugin Kernel has been disposed.`,
        );
    }
}

export class PluginKernelStateError extends PluginError {
    constructor(operation: string, state: string) {
        super(
            'PLUGIN_KERNEL_STATE_ERROR',
            `[ImageEditor] Cannot ${operation} while the Plugin Kernel is in state "${state}".`,
        );
    }
}
