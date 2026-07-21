'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var affineMatrix = require('./chunks/affine-matrix-DRJ0b89x.cjs');
var errors = require('./chunks/errors-DeAfrgDC.cjs');
var core_index = require('./core/index.cjs');
var cloneStateValue = require('./chunks/clone-state-value-CnsEsCNe.cjs');
var pluginManifest = require('./chunks/plugin-manifest-BCkXHQr2.cjs');
require('./chunks/plugin-plan-CxkCZnUf.cjs');
require('./chunks/disposable-Sj4tt6Lk.cjs');
require('./chunks/plugin-manager-C-UJ_Yc9.cjs');
require('./chunks/core-capabilities-ewP5YPVJ.cjs');



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
exports.default = core_index.ImageEditorCore;
exports.assertSafeImmutableReference = cloneStateValue.assertSafeImmutableReference;
exports.cloneStateValue = cloneStateValue.cloneStateValue;
exports.isDangerousStateKey = cloneStateValue.isDangerousStateKey;
exports.createCapabilityToken = pluginManifest.createCapabilityToken;
exports.definePluginRef = pluginManifest.definePluginRef;
//# sourceMappingURL=index.cjs.map
