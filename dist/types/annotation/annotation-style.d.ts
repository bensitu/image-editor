/**
 * Runtime Fabric flag synchronization for editor-owned annotations.
 *
 * `annotationHidden` and `annotationLocked` are business-level state. The
 * `annotationSelectable` / `annotationEvented` / `annotationHasControls` /
 * `annotationEditable` fields preserve the annotation's base interactivity so
 * locking can temporarily disable interaction without destroying user intent.
 *
 * @module
 */
import { type AnnotationObject } from '../core/public-types.js';
export declare function syncAnnotationRuntimeState(annotation: AnnotationObject): void;
export declare function syncAnnotationRuntimeStates(annotations: AnnotationObject[]): void;
