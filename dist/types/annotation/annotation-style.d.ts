/**
 * Runtime Fabric flag synchronization for editor-owned annotations.
 *
 * The metadata fields `annotationHidden` and `annotationLocked` are the
 * durable source of truth; this module projects them onto Fabric visibility,
 * selectability, event handling, and text editability.
 *
 * @module
 */
import { type AnnotationObject } from '../core/public-types.js';
export declare function syncAnnotationRuntimeState(annotation: AnnotationObject): void;
export declare function syncAnnotationRuntimeStates(annotations: AnnotationObject[]): void;
//# sourceMappingURL=annotation-style.d.ts.map