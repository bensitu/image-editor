/** Internal Phase 1 Plugin Kernel entry. Not exported from the package root. */
export { CapabilityRegistry, type CapabilityProviderInfo, type CapabilityRegistryOptions, } from './capability-registry.js';
export { assertCapabilityRequirement, createCapabilityToken, isCapabilityToken, type CapabilityIdentity, type CapabilityRequirement, type CapabilityRequirementIdentity, type CapabilityToken, } from './capability-token.js';
export { CommittedEventBus, type CommittedEventBusOptions, type CommittedEventListener, type PluginEventMap, } from './committed-event-bus.js';
export { composePlugins, type ComposePluginsOptions, type PluginApiOf, type PluginApiTuple, } from './compose-plugins.js';
export { createCompositeDisposable, createDisposable, createNoopDisposable, disposeInReverse, disposeInReverseSync, isPromiseLike, type CommitAwareDisposable, type Disposable, type DisposeInReverseOptions, type MaybePromise, } from './disposable.js';
export { CapabilityConflictError, InvalidCapabilityVersionError, InvalidPluginDefinitionError, OperationConflictError, OperationRegistrationError, PluginAggregateError, PluginAlreadyInstalledError, PluginCapabilityError, PluginError, PluginKernelDisposedError, PluginKernelStateError, PluginLifecycleError, PluginNotInstalledError, PluginSetupError, PluginVersionMismatchError, ToolRegistrationError, ToolTransitionError, type PluginCapabilityFailureReason, type PluginLifecyclePhase, } from './errors.js';
export { OperationRegistry, type OperationDefinition, type OperationId, type OperationMode, type OperationToken, } from './operation-registry.js';
export { PluginManager, type PluginHostState, type PluginHostCapabilityProvider, type PluginManagerOptions, } from './plugin-manager.js';
export { definePluginRef, isPluginRef, type PluginIdentity, type PluginRef } from './plugin-ref.js';
export { PluginStateStore, type ScopedPluginStateStore } from './plugin-state-store.js';
export type { EditorPlugin, EditorPluginDefinition, PluginCapabilityReader, PluginCapabilitySetupAccess, PluginCommittedEventAccess, PluginCommittedEventSetupAccess, PluginLifecycleContext, PluginOperationAccess, PluginOperationSetupAccess, PluginSetupContext, PluginToolAccess, PluginToolSetupAccess, SynchronousEditorPlugin, } from './plugin-types.js';
export { RegistrationScope, type RegistrationScopeOptions } from './registration-scope.js';
export type { PluginErrorSink, PluginKernelWarning, PluginWarningSink } from './reporting.js';
export { ToolCoordinator, type ToolContext, type ToolCoordinatorOptions, type ToolDefinition, type ToolExitReason, type ToolId, } from './tool-coordinator.js';
