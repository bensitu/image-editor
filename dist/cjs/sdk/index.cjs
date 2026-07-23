'use strict';

var coreCapabilities = require('../chunks/core-capabilities-CWNPa1MZ.cjs');
var visibleRasterBake = require('../chunks/visible-raster-bake-DtHxH8kh.cjs');
var pluginManifest = require('../chunks/plugin-manifest-DNqSyjh2.cjs');
var disposable = require('../chunks/disposable-pTo80E0l.cjs');
var pluginIdentifier = require('../chunks/plugin-identifier-DPwx4Gkd.cjs');
var pluginDefinition = require('../chunks/plugin-definition-P0xuESpm.cjs');
var pluginPlan = require('../chunks/plugin-plan-BBOVkUMI.cjs');



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
