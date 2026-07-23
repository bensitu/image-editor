'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var affineMatrix = require('./chunks/affine-matrix-DRJ0b89x.cjs');
var errors = require('./chunks/errors-DeAfrgDC.cjs');
var core_index = require('./core/index.cjs');
var pluginManifest = require('./chunks/plugin-manifest-DNqSyjh2.cjs');
var pluginIdentifier = require('./chunks/plugin-identifier-DPwx4Gkd.cjs');
require('./chunks/plugin-manager-CXW0nIYm.cjs');
require('./chunks/disposable-pTo80E0l.cjs');
require('./chunks/plugin-plan-BBOVkUMI.cjs');
require('./chunks/image-budget-DZeZeVWW.cjs');
require('./chunks/core-capabilities-CWNPa1MZ.cjs');



exports.AFFINE_EPSILON = affineMatrix.AFFINE_EPSILON;
exports.IDENTITY_AFFINE_MATRIX = affineMatrix.IDENTITY_AFFINE_MATRIX;
exports.affineDeterminant = affineMatrix.affineDeterminant;
exports.applyAffineToPoint = affineMatrix.applyAffineToPoint;
exports.approximatelyEqualAffine = affineMatrix.approximatelyEqualAffine;
exports.assertAffineMatrix = affineMatrix.assertAffineMatrix;
exports.computeAffineDelta = affineMatrix.computeAffineDelta;
exports.hasAffineReflection = affineMatrix.hasAffineReflection;
exports.invertAffine = affineMatrix.invertAffine;
exports.isFiniteAffineMatrix = affineMatrix.isFiniteAffineMatrix;
exports.multiplyAffine = affineMatrix.multiplyAffine;
exports.sanitizeAffineMatrix = affineMatrix.sanitizeAffineMatrix;
exports.transformRectBounds = affineMatrix.transformRectBounds;
exports.CoreRuntimeError = errors.CoreRuntimeError;
exports.DocumentMutationInvariantError = errors.DocumentMutationInvariantError;
exports.EditorAlreadyInitializedError = errors.EditorAlreadyInitializedError;
exports.EditorDisposedError = errors.EditorDisposedError;
exports.EditorDisposingError = errors.EditorDisposingError;
exports.EditorFaultedError = errors.EditorFaultedError;
exports.EditorInitializationInProgressError = errors.EditorInitializationInProgressError;
exports.EmergencyResetError = errors.EmergencyResetError;
exports.SnapshotValidationError = errors.SnapshotValidationError;
exports.SnapshotVersionUnsupportedError = errors.SnapshotVersionUnsupportedError;
exports.classifyCoreError = errors.classifyCoreError;
exports.DEFAULT_SNAPSHOT_LIMITS = core_index.DEFAULT_SNAPSHOT_LIMITS;
exports.ImageEditor = core_index.ImageEditorCore;
exports.ImageEditorCore = core_index.ImageEditorCore;
exports.MementoService = core_index.MementoService;
exports.ObjectPropertyRegistry = core_index.ObjectPropertyRegistry;
exports.SnapshotService = core_index.SnapshotService;
exports.StateSliceRegistry = core_index.StateSliceRegistry;
exports.TransientObjectRegistry = core_index.TransientObjectRegistry;
exports.assertSafeImmutableReference = core_index.assertSafeImmutableReference;
exports.cloneStateValue = core_index.cloneStateValue;
exports.default = core_index.ImageEditorCore;
exports.createCapabilityToken = pluginManifest.createCapabilityToken;
exports.definePluginRef = pluginManifest.definePluginRef;
exports.isDangerousStateKey = pluginIdentifier.isDangerousStateKey;
//# sourceMappingURL=index.cjs.map
