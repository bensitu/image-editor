'use strict';

var pluginManifest = require('./plugin-manifest-B4W6-2BB.cjs');

const CORE_STATUS_CAPABILITY = pluginManifest.createCapabilityToken('core:status', '1.0.0');
const CORE_DIAGNOSTICS_CAPABILITY = pluginManifest.createCapabilityToken('core:diagnostics', '1.0.0');
const CORE_PRESENTATION_CAPABILITY = pluginManifest.createCapabilityToken('core:presentation', '1.0.0');
const FABRIC_RUNTIME_CAPABILITY = pluginManifest.createCapabilityToken('fabric:runtime', '1.0.0');
const CANVAS_READ_CAPABILITY = pluginManifest.createCapabilityToken('core:canvas-read', '1.0.0');
const BASE_IMAGE_READ_CAPABILITY = pluginManifest.createCapabilityToken('core:base-image-read', '1.0.0');
const BASE_IMAGE_INFO_CAPABILITY = pluginManifest.createCapabilityToken('core:base-image-info', '1.0.0');
const IMAGE_RESOURCE_POLICY_CAPABILITY = pluginManifest.createCapabilityToken('core:image-resource-policy', '1.0.0');
const RENDER_REQUEST_CAPABILITY = pluginManifest.createCapabilityToken('core:render-request', '1.0.0');
const CANVAS_RESIZE_CAPABILITY = pluginManifest.createCapabilityToken('core:canvas-resize', '1.0.0');
const RASTER_MUTATION_CAPABILITY = pluginManifest.createCapabilityToken('core:raster-mutation', '1.0.0');
const SNAPSHOT_REGISTRATION_CAPABILITY = pluginManifest.createCapabilityToken('core:snapshot-registration', '1.0.0');
const MEMENTO_HISTORY_CAPABILITY = pluginManifest.createCapabilityToken('core:memento-history', '1.0.0');
const GEOMETRY_MUTATION_CAPABILITY = pluginManifest.createCapabilityToken('core:geometry', '1.0.0');
const DOCUMENT_MUTATION_CAPABILITY = pluginManifest.createCapabilityToken('core:document-mutation', '1.0.0');
const EXPORT_CONTRIBUTION_CAPABILITY = pluginManifest.createCapabilityToken('core:export', '1.0.0');

exports.BASE_IMAGE_INFO_CAPABILITY = BASE_IMAGE_INFO_CAPABILITY;
exports.BASE_IMAGE_READ_CAPABILITY = BASE_IMAGE_READ_CAPABILITY;
exports.CANVAS_READ_CAPABILITY = CANVAS_READ_CAPABILITY;
exports.CANVAS_RESIZE_CAPABILITY = CANVAS_RESIZE_CAPABILITY;
exports.CORE_DIAGNOSTICS_CAPABILITY = CORE_DIAGNOSTICS_CAPABILITY;
exports.CORE_PRESENTATION_CAPABILITY = CORE_PRESENTATION_CAPABILITY;
exports.CORE_STATUS_CAPABILITY = CORE_STATUS_CAPABILITY;
exports.DOCUMENT_MUTATION_CAPABILITY = DOCUMENT_MUTATION_CAPABILITY;
exports.EXPORT_CONTRIBUTION_CAPABILITY = EXPORT_CONTRIBUTION_CAPABILITY;
exports.FABRIC_RUNTIME_CAPABILITY = FABRIC_RUNTIME_CAPABILITY;
exports.GEOMETRY_MUTATION_CAPABILITY = GEOMETRY_MUTATION_CAPABILITY;
exports.IMAGE_RESOURCE_POLICY_CAPABILITY = IMAGE_RESOURCE_POLICY_CAPABILITY;
exports.MEMENTO_HISTORY_CAPABILITY = MEMENTO_HISTORY_CAPABILITY;
exports.RASTER_MUTATION_CAPABILITY = RASTER_MUTATION_CAPABILITY;
exports.RENDER_REQUEST_CAPABILITY = RENDER_REQUEST_CAPABILITY;
exports.SNAPSHOT_REGISTRATION_CAPABILITY = SNAPSHOT_REGISTRATION_CAPABILITY;
//# sourceMappingURL=core-capabilities-DVJQ8w-Z.cjs.map
