/**
 * Applies persistent Mask metadata to Fabric objects created by the Mask Plugin.
 *
 * Base Images are marked by Core when they are adopted. Session markers are owned by the shared
 * layer-placement helper, and Annotation identity is owned by the Annotation Foundation.
 *
 * @module
 */

import type * as FabricNS from 'fabric';

import type { MaskObject } from './public-types.js';

export function markMaskObject(
    object: FabricNS.FabricObject,
    meta: {
        maskId: number;
        maskUid: string;
        maskName: string;
        originalAlpha: number;
        originalStroke?: FabricNS.TFiller | string | null;
        originalStrokeWidth?: number;
    },
): MaskObject {
    const mask = object as MaskObject;
    mask.editorObjectKind = 'mask';
    mask.maskId = meta.maskId;
    mask.maskUid = meta.maskUid;
    mask.maskName = meta.maskName;
    mask.originalAlpha = meta.originalAlpha;
    if (meta.originalStroke !== undefined) mask.originalStroke = meta.originalStroke;
    if (typeof meta.originalStrokeWidth === 'number') {
        mask.originalStrokeWidth = meta.originalStrokeWidth;
    }
    return mask;
}
