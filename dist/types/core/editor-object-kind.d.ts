import type * as FabricNS from 'fabric';
import type { AnnotationObject, AnnotationType, BaseImageObject, MaskObject, SessionObject, SessionObjectType } from './public-types.js';
export declare function markBaseImageObject(image: FabricNS.FabricImage): BaseImageObject;
export declare function markMaskObject(object: FabricNS.FabricObject, meta: {
    maskId: number;
    maskUid: string;
    maskName: string;
    originalAlpha: number;
    originalStroke?: FabricNS.TFiller | string | null;
    originalStrokeWidth?: number;
}): MaskObject;
export declare function markAnnotationObject(object: FabricNS.FabricObject, meta: {
    annotationId: number;
    annotationType: AnnotationType;
    annotationName: string;
    annotationHidden?: boolean;
    annotationLocked?: boolean;
}): AnnotationObject;
export declare function markSessionObject<T extends FabricNS.FabricObject>(object: T, sessionObjectType: SessionObjectType): T & SessionObject;
//# sourceMappingURL=editor-object-kind.d.ts.map