/**
 * Input value synchronization for editor toolbar controls.
 *
 * The sync logic avoids overwriting focused editable inputs while keeping
 * scale, image filters, Mosaic, Text, Draw, eraser, and Shape controls
 * aligned with runtime state.
 */
import type { DrawSubMode, ResolvedEraserConfig, ResolvedDrawConfig, ResolvedImageFilterConfig, ResolvedMosaicConfig, ResolvedShapeAnnotationConfig, ResolvedTextAnnotationConfig } from '../core/public-types.js';
import type { ElementKey } from '../core/editor-elements.js';
export interface EditorInputSnapshot {
    currentScale: number;
    imageFilterConfig: Readonly<ResolvedImageFilterConfig>;
    mosaicConfig: Readonly<ResolvedMosaicConfig>;
    textConfig: Readonly<ResolvedTextAnnotationConfig>;
    drawConfig: Readonly<ResolvedDrawConfig>;
    drawSubMode: DrawSubMode | null;
    eraserConfig: Readonly<ResolvedEraserConfig>;
    shapeConfig: Readonly<ResolvedShapeAnnotationConfig>;
}
export type EditorInputResolver = (key: ElementKey) => HTMLElement | null;
export declare function applyEditorInputState(snapshot: EditorInputSnapshot, getElement: EditorInputResolver): void;
