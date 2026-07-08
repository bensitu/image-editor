/**
 * Import validated overlay state into a live editor canvas.
 *
 * This module assumes validation has already produced a normalized v1 state.
 * The ImageEditor facade owns operation guards, history bracketing, and
 * rollback; the importer only mutates the supplied canvas.
 *
 * @module
 */
import type * as FabricNS from 'fabric';
import type { BaseImageObject, FabricModule, MaskObject, ResolvedOptions } from '../core/public-types.js';
import type { TextControllerContext } from '../annotation/text-controller.js';
import type { ImportOverlayStateOptions, ImportOverlayStateResult, OverlayState } from './overlay-state-types.js';
export interface OverlayStateImportRuntimeContext {
    fabric: FabricModule;
    canvas: FabricNS.Canvas;
    options: ResolvedOptions;
    originalImage: BaseImageObject;
    getMaskCounter(): number;
    setMaskCounter(value: number): void;
    getAnnotationCounter(): number;
    setAnnotationCounter(value: number): void;
    setLastMask(mask: MaskObject | null): void;
    setCurrentRotation(rotation: number): void;
    removeLabelForMask(mask: MaskObject): void;
    buildTextControllerContext(): TextControllerContext;
}
export declare function importOverlayStateIntoEditor(context: OverlayStateImportRuntimeContext, state: OverlayState, options?: ImportOverlayStateOptions): Promise<ImportOverlayStateResult>;
