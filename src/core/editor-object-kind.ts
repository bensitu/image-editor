/**
 * Metadata markers for objects owned by the editor runtime.
 *
 * All base images, masks, annotations, and session-only objects should be
 * marked through these helpers so public type guards can reject legacy
 * duck-typed objects reliably.
 *
 * @module
 */

import type * as FabricNS from 'fabric';

import type {
    AnnotationObject,
    AnnotationType,
    BaseImageObject,
    MaskObject,
    SessionObject,
    SessionObjectType,
} from './public-types.js';

export function markBaseImageObject(image: FabricNS.FabricImage): BaseImageObject {
    const baseImage = image as BaseImageObject;
    baseImage.editorObjectKind = 'baseImage';
    return baseImage;
}

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
    if ('originalStroke' in meta) mask.originalStroke = meta.originalStroke;
    if (typeof meta.originalStrokeWidth === 'number') {
        mask.originalStrokeWidth = meta.originalStrokeWidth;
    }
    return mask;
}

export function markAnnotationObject(
    object: FabricNS.FabricObject,
    meta: {
        annotationId: number;
        annotationType: AnnotationType;
        annotationName: string;
        annotationHidden?: boolean;
        annotationLocked?: boolean;
    },
): AnnotationObject {
    const annotation = object as AnnotationObject;
    annotation.editorObjectKind = 'annotation';
    annotation.annotationId = meta.annotationId;
    annotation.annotationType = meta.annotationType;
    annotation.annotationName = meta.annotationName;
    annotation.annotationHidden = meta.annotationHidden ?? false;
    annotation.annotationLocked = meta.annotationLocked ?? false;
    return annotation;
}

export function markSessionObject<T extends FabricNS.FabricObject>(
    object: T,
    sessionObjectType: SessionObjectType,
): T & SessionObject {
    const sessionObject = object as T & SessionObject;
    sessionObject.editorObjectKind = 'session';
    sessionObject.sessionObjectType = sessionObjectType;
    return sessionObject;
}
