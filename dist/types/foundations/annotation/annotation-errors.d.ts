/** Base error for Annotation Foundation operations. */
export declare class AnnotationError extends Error {
    constructor(message: string);
}
/** Thrown when public Annotation data fails validation. */
export declare class AnnotationValidationError extends AnnotationError {
    constructor(message: string);
}
/** Thrown when an Annotation or Feature registration cannot be resolved. */
export declare class AnnotationNotFoundError extends AnnotationError {
    constructor(message: string);
}
