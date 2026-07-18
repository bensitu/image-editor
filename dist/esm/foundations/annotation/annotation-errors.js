export class AnnotationError extends Error {
    constructor(message) {
        super(`[ImageEditor] ${message}`);
        this.name = 'AnnotationError';
    }
}
export class AnnotationValidationError extends AnnotationError {
    constructor(message) {
        super(message);
        this.name = 'AnnotationValidationError';
    }
}
export class AnnotationNotFoundError extends AnnotationError {
    constructor(message) {
        super(message);
        this.name = 'AnnotationNotFoundError';
    }
}
//# sourceMappingURL=annotation-errors.js.map