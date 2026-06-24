/**
 * Annotation CRUD, selection, list rendering, and update helpers.
 *
 * The editor runtime owns canvas state and passes a small context bundle
 * into these helpers so Text and Draw annotations share one removal/update
 * implementation.
 *
 * @module
 */
import type * as FabricNS from 'fabric';
import { type AnnotationObject, type AnnotationUpdateConfig, type OverlayListOrder, type RemoveAllAnnotationsOptions } from '../core/public-types.js';
export interface AnnotationManagerContext {
    canvas: FabricNS.Canvas;
    saveCanvasState(): void;
    updateUi(): void;
}
export interface AnnotationListContext {
    canvas: FabricNS.Canvas | null;
    getListElement(): HTMLElement | null | undefined;
    /**
     * DOM render order for the annotation list. 'front-to-back' mirrors
     * layer-panel behavior by showing the topmost overlay first.
     */
    listOrder?: OverlayListOrder;
    onAnnotationSelected(annotation: AnnotationObject): void;
}
export declare function getActiveSelectionObjects(canvas: FabricNS.Canvas): FabricNS.FabricObject[];
export declare function getAnnotations(canvas: FabricNS.Canvas): AnnotationObject[];
export declare function getSelectedAnnotations(canvas: FabricNS.Canvas): AnnotationObject[];
export declare function updateAnnotationObject(annotation: AnnotationObject, config: AnnotationUpdateConfig): boolean;
export declare function updateAnnotation(context: AnnotationManagerContext, annotationId: number, config: AnnotationUpdateConfig): boolean;
export declare function updateSelectedAnnotation(context: AnnotationManagerContext, config: AnnotationUpdateConfig): boolean;
export declare function removeAnnotationObjects(context: AnnotationManagerContext, objects: AnnotationObject[], options?: RemoveAllAnnotationsOptions): number;
export declare function removeSelectedAnnotation(context: AnnotationManagerContext): number;
export declare function removeAllAnnotations(context: AnnotationManagerContext, options?: RemoveAllAnnotationsOptions): number;
export declare function renderAnnotationList(context: AnnotationListContext): void;
export declare function updateAnnotationListSelection(context: AnnotationListContext, selectedAnnotation: AnnotationObject | null): void;
//# sourceMappingURL=annotation-manager.d.ts.map