export class CanvasInteractionsController {
    constructor(host) {
        Object.defineProperty(this, "host", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: host
        });
        Object.defineProperty(this, "listeners", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Set()
        });
        Object.defineProperty(this, "disposed", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
    }
    refresh() {
        this.assertActive('refresh Canvas interactions');
    }
    async cancel(_reason = 'requested') {
        this.assertActive('cancel Canvas interactions');
    }
    getStatus() {
        return this.status();
    }
    subscribe(listener) {
        this.assertActive('subscribe to Canvas interaction status');
        if (typeof listener !== 'function') {
            throw new TypeError('[ImageEditor] Canvas interaction status listener must be a function.');
        }
        this.listeners.add(listener);
        this.invokeListener(listener, this.status());
        let active = true;
        return Object.freeze({
            dispose: () => {
                if (!active)
                    return;
                active = false;
                this.listeners.delete(listener);
            },
        });
    }
    dispose() {
        if (this.disposed)
            return;
        this.disposed = true;
        const status = this.status();
        for (const listener of [...this.listeners])
            this.invokeListener(listener, status);
        this.listeners.clear();
    }
    status() {
        return Object.freeze({
            isBound: false,
            isDisposed: this.disposed,
            activeBindingId: null,
            gestureActive: false,
        });
    }
    invokeListener(listener, status) {
        try {
            listener(status);
        }
        catch (error) {
            this.host.reportWarning(error, 'A Canvas interaction status listener failed.');
        }
    }
    assertActive(operation) {
        if (this.disposed) {
            throw new Error(`[ImageEditor] Cannot ${operation} after Canvas Interactions disposal.`);
        }
    }
}
//# sourceMappingURL=canvas-interactions-controller.js.map