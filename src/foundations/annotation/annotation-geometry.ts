/**
 * Applies Core affine geometry mutations to Annotation Fabric objects under the reflection policy.
 *
 * @module
 */

import type * as FabricNS from 'fabric';

import type { FabricModule, GeometryMutationDescriptor } from '../../core/index.js';

import { applyDeltaToObject } from '../overlay/overlay-transform-delta.js';

export function applyAnnotationGeometry(
    object: FabricNS.FabricObject,
    mutation: GeometryMutationDescriptor,
    fabricModule: FabricModule,
    preserveReadable: boolean,
): void {
    if (mutation.kind !== 'transform' || !mutation.affineDelta) return;
    applyDeltaToObject(object, [...mutation.affineDelta], {
        preserveReadableText: preserveReadable,
        fabricUtil: {
            multiplyTransformMatrices: (left, right) =>
                fabricModule.util.multiplyTransformMatrices(
                    left as FabricNS.TMat2D,
                    right as FabricNS.TMat2D,
                ),
            invertTransform: (matrix) =>
                fabricModule.util.invertTransform(matrix as FabricNS.TMat2D),
            qrDecompose: (matrix) => fabricModule.util.qrDecompose(matrix as FabricNS.TMat2D),
            Point: fabricModule.Point,
        },
    });
}
