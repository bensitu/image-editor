/**
 * Publishes the internal geometry runtime surface used by Core and Plugin contracts.
 *
 * @module
 */

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
} from './affine-matrix.js';
export {
    GeometryMutationCoordinator,
    type GeometryMutationCoordinatorOptions,
} from './geometry-mutation-coordinator.js';
export type {
    BaseImageGeometrySnapshot,
    GeometryErrorSink,
    GeometryMutationBaseContext,
    GeometryMutationDescriptor,
    GeometryMutationParticipant,
    GeometryMutationPort,
    GeometryMutationRequest,
    GeometryMutationRollbackContext,
    GeometryParticipantContext,
    GeometryStatePort,
    GeometryWarning,
    GeometryWarningSink,
    Size,
} from './geometry-types.js';
