function fixPrototype(self, ctor) {
    Object.setPrototypeOf(self, ctor.prototype);
}
export class FabricUnavailableError extends Error {
    constructor(message = 'Fabric.js v7 is not available. Pass the Fabric module explicitly to the constructor or expose it as `globalThis.fabric`.') {
        super(message);
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'FabricUnavailableError'
        });
        fixPrototype(this, FabricUnavailableError);
    }
}
export class ImageDecodeError extends Error {
    constructor(message = 'Failed to decode image data URL.', originalError = null) {
        super(message);
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'ImageDecodeError'
        });
        Object.defineProperty(this, "originalError", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.originalError = originalError;
        fixPrototype(this, ImageDecodeError);
    }
}
export class ImageLoadTimeoutError extends Error {
    constructor(label, elapsedMs) {
        super(`Image load timed out after ${elapsedMs}ms during ${label}`);
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'ImageLoadTimeoutError'
        });
        Object.defineProperty(this, "label", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "elapsedMs", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.label = label;
        this.elapsedMs = elapsedMs;
        fixPrototype(this, ImageLoadTimeoutError);
    }
}
export class DownsampleError extends Error {
    constructor(message = 'Failed to obtain a 2D context for downsampling.', originalError = null) {
        super(message);
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'DownsampleError'
        });
        Object.defineProperty(this, "originalError", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.originalError = originalError;
        fixPrototype(this, DownsampleError);
    }
}
export class MergeMasksError extends Error {
    constructor(message = 'Failed to merge masks into the image.', originalError = null) {
        super(message);
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'MergeMasksError'
        });
        Object.defineProperty(this, "originalError", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.originalError = originalError;
        fixPrototype(this, MergeMasksError);
    }
}
export class MergeAnnotationsError extends Error {
    constructor(message = 'Failed to merge annotations into the image.', originalError = null) {
        super(message);
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'MergeAnnotationsError'
        });
        Object.defineProperty(this, "originalError", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.originalError = originalError;
        fixPrototype(this, MergeAnnotationsError);
    }
}
export class CropApplyError extends Error {
    constructor(message = 'Failed to apply crop to the image.', originalError = null) {
        super(message);
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'CropApplyError'
        });
        Object.defineProperty(this, "originalError", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.originalError = originalError;
        fixPrototype(this, CropApplyError);
    }
}
export class ExportNotReadyError extends Error {
    constructor(operation = 'exportImageFile') {
        super(`Cannot ${operation}: no image is loaded on the canvas.`);
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'ExportNotReadyError'
        });
        Object.defineProperty(this, "operation", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.operation = operation;
        fixPrototype(this, ExportNotReadyError);
    }
}
export class ExportError extends Error {
    constructor(message = 'Failed to export image.', originalError = null) {
        super(message);
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'ExportError'
        });
        Object.defineProperty(this, "originalError", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.originalError = originalError;
        fixPrototype(this, ExportError);
    }
}
//# sourceMappingURL=errors.js.map