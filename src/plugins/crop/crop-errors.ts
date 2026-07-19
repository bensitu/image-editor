/**
 * Defines Crop session, validation, and integration failures for callers and lifecycle control.
 *
 * @module
 */

export class CropError extends Error {
    override readonly name: string = 'CropError';
}

export class CropSessionError extends CropError {
    override readonly name: string = 'CropSessionError';
}

export class CropValidationError extends CropError {
    override readonly name: string = 'CropValidationError';
}

export class CropIntegrationError extends CropError {
    override readonly name: string = 'CropIntegrationError';
}
