export { ImageEditorCore } from '../core-runtime/image-editor-core.js';
export { CoreRuntimeError, DocumentMutationInvariantError, EmergencyResetError, EditorAlreadyInitializedError, EditorDisposedError, EditorDisposingError, EditorFaultedError, EditorInitializationInProgressError, SnapshotValidationError, SnapshotVersionUnsupportedError, classifyCoreError, } from '../core-runtime/errors.js';
export { AFFINE_EPSILON, IDENTITY_AFFINE_MATRIX, affineDeterminant, applyAffineToPoint, approximatelyEqualAffine, assertAffineMatrix, computeAffineDelta, hasAffineReflection, invertAffine, isFiniteAffineMatrix, multiplyAffine, sanitizeAffineMatrix, transformRectBounds, } from '../core-runtime/geometry/affine-matrix.js';
export * from '../core-runtime/state/index.js';
export { createCapabilityToken, definePluginRef, } from '../plugin-kernel/index.js';
//# sourceMappingURL=index.js.map