export class MosaicError extends Error {
    constructor() {
        super(...arguments);
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'MosaicError'
        });
    }
}
export class MosaicSessionError extends MosaicError {
    constructor() {
        super(...arguments);
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'MosaicSessionError'
        });
    }
}
export class MosaicValidationError extends MosaicError {
    constructor() {
        super(...arguments);
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'MosaicValidationError'
        });
    }
}
export class MosaicIntegrationError extends MosaicError {
    constructor() {
        super(...arguments);
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'MosaicIntegrationError'
        });
    }
}
//# sourceMappingURL=mosaic-errors.js.map