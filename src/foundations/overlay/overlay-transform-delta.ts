/** Shares Fabric transform calculations with Overlay geometry consumers. */
export {
    applyDeltaToObject,
    deltaHasReflection,
    isApproximatelyIdentityTransform,
    isFiniteTransformMatrix,
    stripReflectionFromDelta,
    transformPointByMatrix,
    type FabricDeltaApplyContext as OverlayDeltaApplyContext,
    type FabricUtilAccess,
} from '../../fabric/fabric-transform-delta.js';
