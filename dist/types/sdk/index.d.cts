/**
 * Public Plugin authoring contracts and runtime factories.
 *
 * @module
 */
export * from './core-capabilities.js';
export * from './visible-raster-bake.js';
export { createCapabilityToken, type CapabilityRequirement, type CapabilityToken, } from '../plugin-kernel/capability-token.js';
export { createDisposable, disposeInReverseSync, type Disposable, type MaybePromise, } from '../plugin-kernel/disposable.js';
export { isRuntimeIdentifier } from '../plugin-kernel/plugin-identifier.js';
export { isValidSemVer } from '../plugin-kernel/semver.js';
export { CapabilityConflictError, CapabilityMissingError, CapabilityVersionError, PluginApiVersionError, PluginBatchInstallError, PluginDefinitionConflictError, PluginDefinitionAlreadyBoundError, PluginDependencyCycleError, PluginDependencyError, PluginEngineVersionError, PluginError, PluginIdentityConflictError, PluginManifestError, PluginNotInstalledError, PluginPermissionError, PluginSetupError, } from '../plugin-kernel/errors.js';
export { definePluginRef, type PluginRef } from '../plugin-kernel/plugin-ref.js';
export type { CapabilityProviderDefinition, CapabilityProviderOptions, ConfigurablePluginApi, DisposableScope, EditorPlugin, PluginManifest, OptionalCapabilityStatus, PluginPermission, PluginSetupContext, SynchronousEditorPlugin, } from '../plugin-kernel/plugin-types.js';
export { definePlugin } from './plugin-definition.js';
export { CORE_API_VERSION, validatePluginManifest } from './plugin-manifest.js';
export { composePlugins, type PluginArrayApis, type PluginPlan, type PluginPlanApis, } from './plugin-plan.js';
