/**
 * Publishes the formal Core package entry for runtime, state, geometry, mutation, and selected mask contracts.
 *
 * @module
 */

export { ImageEditorCore, type LoadStateOptions } from '../core-runtime/image-editor-core.js';
export type {
    CoreElementMap,
    CoreEventMap,
    CoreExportOptions,
    CoreImageInfo,
    EditorLifecycleState,
    ElementTarget,
    ExportArea,
    FabricModule,
    ImageEditorCoreOptions,
    ImageMimeType,
    LayoutMode,
    LoadImageOptions,
    ResolvedImageEditorCoreOptions,
} from '../core-runtime/public-types.js';
export {
    CoreRuntimeError,
    DocumentMutationInvariantError,
    EmergencyResetError,
    EditorAlreadyInitializedError,
    EditorDisposedError,
    EditorDisposingError,
    EditorFaultedError,
    EditorInitializationInProgressError,
    SnapshotValidationError,
    SnapshotVersionUnsupportedError,
    classifyCoreError,
    type CoreDiagnostic,
    type CoreErrorBehavior,
    type CoreErrorClassification,
    type CoreErrorSeverity,
} from '../core-runtime/errors.js';
export type {
    CoreHistoryCommitPort,
    CoreHistoryRecord,
} from '../core-runtime/history-commit-router.js';
export type { CoreExportContributor } from '../core-runtime/export-contributor-registry.js';
export {
    AFFINE_EPSILON,
    IDENTITY_AFFINE_MATRIX,
    affineDeterminant,
    applyAffineToPoint,
    approximatelyEqualAffine,
    assertAffineMatrix,
    computeAffineDelta,
    hasAffineReflection,
    invertAffine,
    isFiniteAffineMatrix,
    multiplyAffine,
    sanitizeAffineMatrix,
    transformRectBounds,
    type AffineMatrix,
    type Point,
    type Rect,
} from '../core-runtime/geometry/affine-matrix.js';
export type {
    BaseImageGeometrySnapshot,
    GeometryMutationBaseContext,
    GeometryMutationDescriptor,
    GeometryMutationParticipant,
    GeometryMutationPort,
    GeometryMutationRequest,
    GeometryMutationRollbackContext,
    GeometryParticipantContext,
    Size,
} from '../core-runtime/geometry/geometry-types.js';
export type {
    DocumentMutationContext,
    DocumentMutationDescriptor,
    DocumentMutationPort,
} from '../core-runtime/mutation/index.js';
export type {
    DefaultMaskConfig,
    LabelConfig,
    MaskConfig,
    MaskObject,
    OverlayListOrder,
} from './public-types.js';
export * from '../core-runtime/state/index.js';
export {
    createCapabilityToken,
    definePluginRef,
    type CapabilityRequirement,
    type CapabilityToken,
    type Disposable,
    type PluginLifecycleContext,
    type PluginRef,
    type PluginSetupContext,
    type SynchronousEditorPlugin,
} from '../plugin-kernel/index.js';
