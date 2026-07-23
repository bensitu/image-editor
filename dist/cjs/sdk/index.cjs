'use strict';

var coreCapabilities = require('../chunks/core-capabilities-DryMPZoj.cjs');
var visibleRasterBake = require('../chunks/visible-raster-bake-C1mtU9Tv.cjs');
var pluginManifest = require('../chunks/plugin-manifest-5BctrtYS.cjs');
var disposable = require('../chunks/disposable-y_ve7ZXe.cjs');
var pluginIdentifier = require('../chunks/plugin-identifier-DWQ7SALj.cjs');
var pluginDefinition = require('../chunks/plugin-definition-DtyrZUJz.cjs');
var pluginPlan = require('../chunks/plugin-plan-Cz0Krduf.cjs');



exports.BASE_IMAGE_INFO_CAPABILITY = coreCapabilities.BASE_IMAGE_INFO_CAPABILITY;
exports.BASE_IMAGE_READ_CAPABILITY = coreCapabilities.BASE_IMAGE_READ_CAPABILITY;
exports.CANVAS_READ_CAPABILITY = coreCapabilities.CANVAS_READ_CAPABILITY;
exports.CANVAS_RESIZE_CAPABILITY = coreCapabilities.CANVAS_RESIZE_CAPABILITY;
exports.CORE_DIAGNOSTICS_CAPABILITY = coreCapabilities.CORE_DIAGNOSTICS_CAPABILITY;
exports.CORE_PRESENTATION_CAPABILITY = coreCapabilities.CORE_PRESENTATION_CAPABILITY;
exports.CORE_STATUS_CAPABILITY = coreCapabilities.CORE_STATUS_CAPABILITY;
exports.DOCUMENT_MUTATION_CAPABILITY = coreCapabilities.DOCUMENT_MUTATION_CAPABILITY;
exports.EXPORT_CONTRIBUTION_CAPABILITY = coreCapabilities.EXPORT_CONTRIBUTION_CAPABILITY;
exports.FABRIC_RUNTIME_CAPABILITY = coreCapabilities.FABRIC_RUNTIME_CAPABILITY;
exports.GEOMETRY_MUTATION_CAPABILITY = coreCapabilities.GEOMETRY_MUTATION_CAPABILITY;
exports.IMAGE_RESOURCE_POLICY_CAPABILITY = coreCapabilities.IMAGE_RESOURCE_POLICY_CAPABILITY;
exports.MEMENTO_HISTORY_CAPABILITY = coreCapabilities.MEMENTO_HISTORY_CAPABILITY;
exports.RASTER_MUTATION_CAPABILITY = coreCapabilities.RASTER_MUTATION_CAPABILITY;
exports.RENDER_REQUEST_CAPABILITY = coreCapabilities.RENDER_REQUEST_CAPABILITY;
exports.SNAPSHOT_REGISTRATION_CAPABILITY = coreCapabilities.SNAPSHOT_REGISTRATION_CAPABILITY;
exports.VISIBLE_RASTER_BAKE_CAPABILITY = visibleRasterBake.VISIBLE_RASTER_BAKE_CAPABILITY;
exports.CORE_API_VERSION = pluginManifest.CORE_API_VERSION;
exports.createCapabilityToken = pluginManifest.createCapabilityToken;
exports.definePluginRef = pluginManifest.definePluginRef;
exports.isValidSemVer = pluginManifest.isValidSemVer;
exports.validatePluginManifest = pluginManifest.validatePluginManifest;
exports.createDisposable = disposable.createDisposable;
exports.disposeInReverseSync = disposable.disposeInReverseSync;
exports.observePromise = disposable.observePromise;
exports.CapabilityConflictError = pluginIdentifier.CapabilityConflictError;
exports.CapabilityMissingError = pluginIdentifier.CapabilityMissingError;
exports.CapabilityVersionError = pluginIdentifier.CapabilityVersionError;
exports.PluginApiVersionError = pluginIdentifier.PluginApiVersionError;
exports.PluginBatchInstallError = pluginIdentifier.PluginBatchInstallError;
exports.PluginDefinitionAlreadyBoundError = pluginIdentifier.PluginDefinitionAlreadyBoundError;
exports.PluginDefinitionConflictError = pluginIdentifier.PluginDefinitionConflictError;
exports.PluginDependencyCycleError = pluginIdentifier.PluginDependencyCycleError;
exports.PluginDependencyError = pluginIdentifier.PluginDependencyError;
exports.PluginEngineVersionError = pluginIdentifier.PluginEngineVersionError;
exports.PluginError = pluginIdentifier.PluginError;
exports.PluginIdentityConflictError = pluginIdentifier.PluginIdentityConflictError;
exports.PluginManifestError = pluginIdentifier.PluginManifestError;
exports.PluginNotInstalledError = pluginIdentifier.PluginNotInstalledError;
exports.PluginPermissionError = pluginIdentifier.PluginPermissionError;
exports.PluginSetupError = pluginIdentifier.PluginSetupError;
exports.isRuntimeIdentifier = pluginIdentifier.isRuntimeIdentifier;
exports.definePlugin = pluginDefinition.definePlugin;
exports.composePlugins = pluginPlan.composePlugins;
//# sourceMappingURL=index.cjs.map
