export class CropError extends Error {
    constructor() {
        super(...arguments);
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'CropError'
        });
    }
}
export class CropSessionError extends CropError {
    constructor() {
        super(...arguments);
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'CropSessionError'
        });
    }
}
export class CropValidationError extends CropError {
    constructor() {
        super(...arguments);
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'CropValidationError'
        });
    }
}
export class CropIntegrationError extends CropError {
    constructor() {
        super(...arguments);
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'CropIntegrationError'
        });
    }
}
//# sourceMappingURL=crop-errors.js.map