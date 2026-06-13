/**
 * Lock-state helpers for editor-owned annotation objects.
 *
 * The convention is intentionally strict: an annotation is locked only when
 * `annotationLocked === true`; missing metadata behaves the same as `false`.
 *
 * @module
 */

import type { AnnotationObject } from '../core/public-types.js';

export function isAnnotationLocked(
    annotation: Pick<AnnotationObject, 'annotationLocked'>,
): boolean {
    return annotation.annotationLocked === true;
}

export function isAnnotationUnlocked(
    annotation: Pick<AnnotationObject, 'annotationLocked'>,
): boolean {
    return !isAnnotationLocked(annotation);
}
