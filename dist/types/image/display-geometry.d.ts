/**
 * Image display geometry helpers for transform, merge, and state restore flows.
 *
 * These functions keep canvas sizing and restored image bounds consistent
 * across Fit, Cover, and Expand layout modes.
 */
import type * as FabricNS from 'fabric';
import type { BaseImageObject, LayoutMode, ResolvedOptions } from '../core/public-types.js';
import { type ViewportCache, type ViewportSize } from './layout-manager.js';
export interface ImageDisplayGeometry {
    canvasWidth: number;
    canvasHeight: number;
    imageDisplayWidth: number;
    imageDisplayHeight: number;
}
export interface DisplayGeometryContext {
    canvas: FabricNS.Canvas | null;
    containerElement: HTMLElement | null;
    options: ResolvedOptions;
    currentLayoutMode: LayoutMode;
    viewportCache: ViewportCache;
    getOriginalImage(): BaseImageObject | null;
    setCanvasSize(widthPx: number, heightPx: number): void;
    setCurrentScale(scale: number): void;
    setCurrentRotation(rotation: number): void;
    setBaseImageScale(scale: number): void;
    captureSnapshot(): string;
    setLastSnapshot(snapshot: string): void;
}
export declare function measureLayoutViewport(context: DisplayGeometryContext, scrollbarSize?: {
    width: number;
    height: number;
}): ViewportSize;
export declare function getScrollbarStableViewportCanvasSize(viewport: ViewportSize): ViewportSize;
/**
 * Resize the canvas to fit the transformed image bounds. Used by the
 * transform pipeline's final image snap so a post-rotation/scale
 * image that exceeds the viewport gets a real scroll range.
 */
export declare function updateCanvasSizeToImageBounds(context: DisplayGeometryContext, options?: {
    stabilizeContainedViewport?: boolean;
}): void;
export declare function shouldNormalizeCanvasSizeAfterStateRestore(context: DisplayGeometryContext): boolean;
export declare function settleFitCoverScrollbarsAfterStateRestore(context: DisplayGeometryContext): void;
export declare function captureImageDisplayGeometry(context: DisplayGeometryContext): ImageDisplayGeometry | null;
export declare function restoreMergedImageDisplayGeometry(context: DisplayGeometryContext, geometry: ImageDisplayGeometry | null): void;
