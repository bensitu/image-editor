/**
 * Internal Plugin Kernel entry. Not exported from the package root.
 *
 * @module
 */

export {
    CapabilityRegistry,
    type CapabilityProviderInfo,
    type CapabilityRegistryOptions,
} from './capability-registry.js';
export {
    assertCapabilityRequirement,
    createCapabilityToken,
    isCapabilityToken,
    type CapabilityIdentity,
    type CapabilityRequirement,
    type CapabilityRequirementIdentity,
    type CapabilityToken,
} from './capability-token.js';
export {
    CommittedEventBus,
    type CommittedEventBusOptions,
    type CommittedEventListener,
    type PluginEventMap,
} from './committed-event-bus.js';
export {
    createDisposable,
    createNoopDisposable,
    disposeInReverse,
    disposeInReverseSync,
    isPromiseLike,
    observePromise,
    type CommitAwareDisposable,
    type Disposable,
    type DisposeInReverseOptions,
    type MaybePromise,
} from './disposable.js';
export {
    CapabilityConflictError,
    CapabilityMissingError,
    CapabilityVersionError,
    InvalidCapabilityVersionError,
    InvalidPluginDefinitionError,
    OperationConflictError,
    OperationRegistrationError,
    PluginAggregateError,
    PluginAlreadyInstalledError,
    PluginBatchInstallError,
    PluginCapabilityError,
    PluginDefinitionConflictError,
    PluginDefinitionAlreadyBoundError,
    PluginDependencyCycleError,
    PluginDependencyError,
    PluginError,
    PluginKernelDisposedError,
    PluginKernelStateError,
    PluginLifecycleError,
    PluginNotInstalledError,
    PluginPermissionError,
    PluginSetupError,
    ToolRegistrationError,
    ToolTransitionError,
    type PluginCapabilityFailureReason,
    type PluginLifecyclePhase,
} from './errors.js';
export {
    OperationRegistry,
    type OperationConflictDomain,
    type OperationDefinition,
    type OperationExecutionContext,
    type OperationId,
    type OperationMode,
    type OperationReentrancy,
    type OperationRunOptions,
    type OperationToken,
} from './operation-registry.js';
export {
    coreOperationIds,
    cropOperationIds,
    historyOperationIds,
    mosaicOperationIds,
} from './operation-ids.js';
export {
    PluginManager,
    type PluginHostState,
    type PluginHostCapabilityProvider,
    type PluginManagerOptions,
} from './plugin-manager.js';
export { definePluginRef, isPluginRef, type PluginIdentity, type PluginRef } from './plugin-ref.js';
export { PluginStateStore, type ScopedPluginStateStore } from './plugin-state-store.js';
export type {
    EditorPlugin,
    EditorPluginDefinition,
    CapabilityProviderOptions,
    PluginCapabilityReader,
    PluginCapabilitySetupAccess,
    PluginCommittedEventAccess,
    PluginCommittedEventSetupAccess,
    PluginImageLifecycleContext,
    PluginLifecycleContext,
    PluginOperationAccess,
    PluginOperationSetupAccess,
    PluginSetupContext,
    PluginToolAccess,
    PluginToolSetupAccess,
    PluginToolStatus,
    PluginToolStatusListener,
    PluginToolStatusSubscriptionOptions,
    SynchronousEditorPlugin,
} from './plugin-types.js';
export { RegistrationScope, type RegistrationScopeOptions } from './registration-scope.js';
export type { PluginErrorSink, PluginKernelWarning, PluginWarningSink } from './reporting.js';
export {
    ToolCoordinator,
    type ToolContext,
    type ToolCoordinatorOptions,
    type ToolDefinition,
    type ToolExitReason,
    type ToolId,
    type ToolStatus,
    type ToolStatusListener,
    type ToolStatusSubscriptionOptions,
} from './tool-coordinator.js';
