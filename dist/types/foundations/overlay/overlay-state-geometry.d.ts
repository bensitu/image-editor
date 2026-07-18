import type * as FabricNS from 'fabric';
import type { FabricModule } from '../../core/index.js';
import type { OverlayStateCodecContext, OverlayStatePoint } from './overlay-types.js';
export interface OverlayStateBoundsGeometry {
    readonly type: 'bounds';
    readonly corners: readonly [
        OverlayStatePoint,
        OverlayStatePoint,
        OverlayStatePoint,
        OverlayStatePoint
    ];
}
export declare function isOverlayStateBoundsGeometry(value: unknown): value is OverlayStateBoundsGeometry;
export declare function captureOverlayStateBounds(object: FabricNS.FabricObject, context: OverlayStateCodecContext): OverlayStateBoundsGeometry;
export declare function restoreOverlayStateBounds(object: FabricNS.FabricObject, geometry: OverlayStateBoundsGeometry, context: OverlayStateCodecContext, fabric: FabricModule): void;
export declare function objectPointToCanvas(object: FabricNS.FabricObject, point: OverlayStatePoint): OverlayStatePoint;
