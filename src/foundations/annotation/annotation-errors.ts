/** Base error for Annotation Foundation operations. */
export class AnnotationError extends Error {
    constructor(message: string) {
        super(`[ImageEditor] ${message}`);
        this.name = 'AnnotationError';
    }
}

/** Thrown when public Annotation data fails validation. */
export class AnnotationValidationError extends AnnotationError {
    constructor(message: string) {
        super(message);
        this.name = 'AnnotationValidationError';
    }
}

/** Thrown when an Annotation or Feature registration cannot be resolved. */
export class AnnotationNotFoundError extends AnnotationError {
    constructor(message: string) {
        super(message);
        this.name = 'AnnotationNotFoundError';
    }
}
