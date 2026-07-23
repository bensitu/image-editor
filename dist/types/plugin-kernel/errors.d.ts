/**
 * Structured errors raised by the renderer-neutral Plugin Kernel.
 *
 * @module
 */
export interface PluginErrorOptions {
    readonly pluginId?: string;
    readonly cause?: unknown;
}
export declare class PluginError extends Error {
    readonly name: string;
    readonly code: string;
    readonly pluginId: string | undefined;
    readonly cause: unknown;
    constructor(code: string, message: string, options?: PluginErrorOptions);
}
/**
 * Raised when untrusted Plugin metadata does not satisfy the public manifest contract.
 *
 * @remarks
 * Manifest validation completes before Plugin setup starts, so this error never
 * represents a partially installed Plugin.
 */
export declare class PluginManifestError extends PluginError {
    constructor(message: string, options?: PluginErrorOptions);
}
/** Raised when a Plugin reference and manifest describe different identities. */
export declare class PluginIdentityConflictError extends PluginManifestError {
    readonly name = "PluginIdentityConflictError";
    readonly referenceId: string;
    readonly manifestId: string;
    constructor(referenceId: string, manifestId: string);
}
/** Raised when a Plugin manifest targets an unsupported Core engine range. */
export declare class PluginEngineVersionError extends PluginManifestError {
    readonly name = "PluginEngineVersionError";
    readonly engineRange: string;
    readonly coreApiVersion: string;
    constructor(pluginId: string, engineRange: string, coreApiVersion: string);
}
/** Raised when a Plugin reference and manifest disagree about the exposed API version. */
export declare class PluginApiVersionError extends PluginManifestError {
    readonly name = "PluginApiVersionError";
    readonly referenceApiVersion: string;
    readonly manifestApiVersion: string;
    constructor(pluginId: string, referenceApiVersion: string, manifestApiVersion: string);
}
export declare class PluginAggregateError extends PluginError {
    readonly errors: readonly unknown[];
    constructor(message: string, errors: readonly unknown[], options?: PluginErrorOptions);
}
export declare class PluginAlreadyInstalledError extends PluginError {
    constructor(pluginId: string);
}
/** Raised when one concrete Plugin Definition is still leased by another live Host. */
export declare class PluginDefinitionAlreadyBoundError extends PluginError {
    readonly boundHostState: string;
    constructor(pluginId: string, boundHostState: string);
}
export declare class PluginNotInstalledError extends PluginError {
    constructor(pluginId: string);
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
export declare class PluginDependencyError extends PluginError {
    readonly consumerPluginId: string;
    readonly dependencyId: string;
    readonly requiredApiVersion: string;
    readonly availablePluginIds: readonly string[];
    readonly packageHint: string | undefined;
    readonly planHint: string;
    constructor(details: PluginDependencyErrorDetails);
}
/** Raised before setup when the explicit Plugin dependency graph contains a cycle. */
export declare class PluginDependencyCycleError extends PluginError {
    readonly cycle: readonly string[];
    constructor(cycle: readonly string[]);
}
/** Raised when one installation contains incompatible definitions for the same Plugin ID. */
export declare class PluginDefinitionConflictError extends PluginError {
    constructor(pluginId: string);
}
/** Raised after an atomic Plugin batch is rolled back. */
export declare class PluginBatchInstallError extends PluginError {
    readonly cleanupErrors: readonly unknown[];
    constructor(cause: unknown, cleanupErrors?: readonly unknown[]);
}
/** Raised before setup when a Plugin omits a permission required by a Capability. */
export declare class PluginPermissionError extends PluginError {
    readonly permission: string;
    readonly capabilityId: string;
    readonly operation: string;
    constructor(pluginId: string, permission: string, capabilityId: string, operation?: string);
}
export type PluginCapabilityFailureReason = 'missing' | 'incompatible' | 'incomplete' | 'invalid-range';
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
export declare class CapabilityMissingError extends PluginError {
    readonly consumerPluginId: string;
    readonly capabilityId: string;
    readonly requestedRange: string;
    readonly availableProviders: readonly string[];
    constructor(details: CapabilityMissingErrorDetails);
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
export declare class CapabilityVersionError extends PluginError {
    readonly capabilityId: string;
    readonly expectedRange: string;
    readonly actualVersion: string | undefined;
    readonly providerPluginId: string | undefined;
    readonly consumerPluginId: string | undefined;
    constructor(details: CapabilityVersionErrorDetails, code?: string, message?: string);
}
export declare class PluginCapabilityError extends PluginError {
    readonly consumerPluginId: string;
    readonly capabilityId: string;
    readonly requestedRange: string;
    readonly installedVersion: string | undefined;
    readonly providerPluginId: string | undefined;
    readonly reason: PluginCapabilityFailureReason;
    constructor(details: PluginCapabilityErrorDetails);
}
export declare class CapabilityConflictError extends PluginError {
    readonly capabilityId: string;
    readonly installedProviderPluginId: string;
    readonly conflictingProviderPluginId: string;
    constructor(capabilityId: string, installedProviderPluginId: string, conflictingProviderPluginId: string);
}
export type PluginLifecyclePhase = 'init' | 'image-loaded' | 'image-cleared' | 'dispose';
export declare class PluginLifecycleError extends PluginError {
    readonly phase: PluginLifecyclePhase;
    readonly cleanupErrors: readonly unknown[];
    constructor(pluginId: string, phase: PluginLifecyclePhase, cause: unknown, cleanupErrors?: readonly unknown[]);
}
export declare class PluginSetupError extends PluginError {
    readonly cleanupErrors: readonly unknown[];
    constructor(pluginId: string, cause: unknown, cleanupErrors?: readonly unknown[]);
}
export declare class InvalidPluginDefinitionError extends PluginManifestError {
    readonly name = "InvalidPluginDefinitionError";
    constructor(message: string, pluginId?: string, cause?: unknown);
}
export declare class InvalidCapabilityVersionError extends CapabilityVersionError {
    readonly value: string;
    readonly valueKind: 'version' | 'range';
    constructor(capabilityId: string, value: string, valueKind: 'version' | 'range');
}
export declare class PluginVersionMismatchError extends PluginError {
    constructor(pluginId: string, installedVersion: string, requestedVersion: string, installedApiVersion: string, requestedApiVersion: string);
}
export declare class OperationRegistrationError extends PluginError {
    constructor(message: string, pluginId?: string);
}
export declare class OperationConflictError extends PluginError {
    constructor(message: string, pluginId?: string);
}
export declare class ToolRegistrationError extends PluginError {
    constructor(message: string, pluginId?: string);
}
export declare class ToolTransitionError extends PluginError {
    readonly toolId: string;
    constructor(toolId: string, message: string, pluginId?: string, cause?: unknown);
}
export declare class PluginKernelDisposedError extends PluginError {
    constructor(operation: string);
}
export declare class PluginKernelStateError extends PluginError {
    constructor(operation: string, state: string);
}
