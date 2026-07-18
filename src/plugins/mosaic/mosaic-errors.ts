export class MosaicError extends Error {
    override readonly name: string = 'MosaicError';
}

export class MosaicSessionError extends MosaicError {
    override readonly name: string = 'MosaicSessionError';
}

export class MosaicValidationError extends MosaicError {
    override readonly name: string = 'MosaicValidationError';
}

export class MosaicIntegrationError extends MosaicError {
    override readonly name: string = 'MosaicIntegrationError';
}
