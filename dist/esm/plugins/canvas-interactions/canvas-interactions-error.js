export class CanvasInteractionsConfigurationError extends Error {
    constructor(message) {
        super(`[ImageEditor] ${message}`);
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'CanvasInteractionsConfigurationError'
        });
    }
}
//# sourceMappingURL=canvas-interactions-error.js.map