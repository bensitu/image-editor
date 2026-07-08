/**
 * Export live editor overlays to the renderer-independent overlay state.
 *
 * @module
 */
import type * as FabricNS from 'fabric';
import { type CurrentImageGeometry } from './overlay-coordinate-transform.js';
import type { BaseImageObject, ImageMimeType } from '../core/public-types.js';
import type { ExportOverlayStateOptions, OverlayState } from './overlay-state-types.js';
export interface OverlayStateExportRuntimeContext {
    canvas: FabricNS.Canvas | null;
    originalImage: BaseImageObject | null;
    currentRotation: number;
    currentImageMimeType: ImageMimeType | null;
}
export declare function createCurrentImageGeometry(image: BaseImageObject, currentRotation: number): CurrentImageGeometry;
export declare function exportOverlayState(context: OverlayStateExportRuntimeContext, options?: ExportOverlayStateOptions): OverlayState;
