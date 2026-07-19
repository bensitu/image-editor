/**
 * Defines Mosaic session, validation, and integration failures for callers and lifecycle control.
 *
 * @module
 */
export declare class MosaicError extends Error {
    readonly name: string;
}
export declare class MosaicSessionError extends MosaicError {
    readonly name: string;
}
export declare class MosaicValidationError extends MosaicError {
    readonly name: string;
}
export declare class MosaicIntegrationError extends MosaicError {
    readonly name: string;
}
