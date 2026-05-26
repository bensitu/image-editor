export class OperationGuard {
    constructor() {
        Object.defineProperty(this, "_isAnimating", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "_isDisposed", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
    }
    isAnimating() {
        return this._isAnimating;
    }
    isDisposed() {
        return this._isDisposed;
    }
    beginAnimation() {
        this._isAnimating = true;
    }
    endAnimation() {
        this._isAnimating = false;
    }
    markDisposed() {
        this._isDisposed = true;
        this._isAnimating = false;
    }
    async runAnimation(fn) {
        this.beginAnimation();
        try {
            return await fn();
        }
        finally {
            this.endAnimation();
        }
    }
    assertNotAnimating(operationLabel) {
        if (this._isAnimating) {
            throw new Error(`[ImageEditor] Cannot run "${operationLabel}" while an animation is in progress.`);
        }
    }
}
//# sourceMappingURL=operation-guard.js.map