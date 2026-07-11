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
export declare class PluginAggregateError extends PluginError {
    readonly name = "PluginAggregateError";
    readonly errors: readonly unknown[];
    constructor(message: string, errors: readonly unknown[], options?: PluginErrorOptions);
}
export declare class PluginAlreadyInstalledError extends PluginError {
    readonly name = "PluginAlreadyInstalledError";
    constructor(pluginId: string);
}
export declare class PluginNotInstalledError extends PluginError {
    readonly name = "PluginNotInstalledError";
    constructor(pluginId: string);
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
export declare class PluginCapabilityError extends PluginError {
    readonly name = "PluginCapabilityError";
    readonly consumerPluginId: string;
    readonly capabilityId: string;
    readonly requestedRange: string;
    readonly installedVersion: string | undefined;
    readonly providerPluginId: string | undefined;
    readonly reason: PluginCapabilityFailureReason;
    constructor(details: PluginCapabilityErrorDetails);
}
export declare class CapabilityConflictError extends PluginError {
    readonly name = "CapabilityConflictError";
    readonly capabilityId: string;
    readonly installedProviderPluginId: string;
    readonly conflictingProviderPluginId: string;
    constructor(capabilityId: string, installedProviderPluginId: string, conflictingProviderPluginId: string);
}
export type PluginLifecyclePhase = 'init' | 'image-loaded' | 'image-cleared' | 'dispose';
export declare class PluginLifecycleError extends PluginError {
    readonly name = "PluginLifecycleError";
    readonly phase: PluginLifecyclePhase;
    readonly cleanupErrors: readonly unknown[];
    constructor(pluginId: string, phase: PluginLifecyclePhase, cause: unknown, cleanupErrors?: readonly unknown[]);
}
export declare class PluginSetupError extends PluginError {
    readonly name = "PluginSetupError";
    readonly cleanupErrors: readonly unknown[];
    constructor(pluginId: string, cause: unknown, cleanupErrors?: readonly unknown[]);
}
export declare class InvalidPluginDefinitionError extends PluginError {
    readonly name = "InvalidPluginDefinitionError";
    constructor(message: string, pluginId?: string, cause?: unknown);
}
export declare class InvalidCapabilityVersionError extends PluginError {
    readonly name = "InvalidCapabilityVersionError";
    readonly capabilityId: string;
    readonly value: string;
    readonly valueKind: 'version' | 'range';
    constructor(capabilityId: string, value: string, valueKind: 'version' | 'range');
}
export declare class PluginVersionMismatchError extends PluginError {
    readonly name = "PluginVersionMismatchError";
    constructor(pluginId: string, installedVersion: string, requestedVersion: string, installedApiVersion: string, requestedApiVersion: string);
}
export declare class OperationRegistrationError extends PluginError {
    readonly name = "OperationRegistrationError";
    constructor(message: string, pluginId?: string);
}
export declare class OperationConflictError extends PluginError {
    readonly name = "OperationConflictError";
    constructor(message: string, pluginId?: string);
}
export declare class ToolRegistrationError extends PluginError {
    readonly name = "ToolRegistrationError";
    constructor(message: string, pluginId?: string);
}
export declare class ToolTransitionError extends PluginError {
    readonly name = "ToolTransitionError";
    readonly toolId: string;
    constructor(toolId: string, message: string, pluginId?: string, cause?: unknown);
}
export declare class PluginKernelDisposedError extends PluginError {
    readonly name = "PluginKernelDisposedError";
    constructor(operation: string);
}
export declare class PluginKernelStateError extends PluginError {
    readonly name = "PluginKernelStateError";
    constructor(operation: string, state: string);
}
