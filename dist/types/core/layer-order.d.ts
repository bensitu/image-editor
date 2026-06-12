import type * as FabricNS from 'fabric';
import { type AnnotationObject, type BaseImageObject, type MaskObject, type SessionObject } from './public-types.js';
export declare function normalizeLayerOrder(canvas: FabricNS.Canvas): void;
export declare function placeBaseImageObject(canvas: FabricNS.Canvas, image: BaseImageObject): void;
export declare function placeMaskObject(canvas: FabricNS.Canvas, mask: MaskObject): void;
export declare function placeAnnotationObject(canvas: FabricNS.Canvas, annotation: AnnotationObject): void;
export declare function placeSessionObject(canvas: FabricNS.Canvas, sessionObject: SessionObject): void;
export declare function getEditableOverlayRange(canvas: FabricNS.Canvas): {
    start: number;
    end: number;
    overlays: Array<MaskObject | AnnotationObject>;
};
//# sourceMappingURL=layer-order.d.ts.map