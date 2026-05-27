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
        Object.defineProperty(this, "_isLoading", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "_activeOperationName", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "_activeOperationToken", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
    }
    isAnimating() {
        return this._isAnimating;
    }
    isDisposed() {
        return this._isDisposed;
    }
    isLoading() {
        return this._isLoading;
    }
    activeOperationName() {
        return this._activeOperationName;
    }
    isBusy() {
        return this._isAnimating || this._isLoading || this._activeOperationToken !== null;
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
        this._isLoading = false;
        this._activeOperationName = null;
        this._activeOperationToken = null;
    }
    beginLoading() {
        this._isLoading = true;
    }
    endLoading() {
        this._isLoading = false;
    }
    beginBusyOperation(operationName) {
        const token = Symbol(operationName);
        this._activeOperationName = operationName;
        this._activeOperationToken = token;
        return token;
    }
    endBusyOperation(token) {
        if (token && token === this._activeOperationToken) {
            this._activeOperationName = null;
            this._activeOperationToken = null;
        }
    }
    isOwnOperation(token) {
        return !!token && token === this._activeOperationToken;
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
    assertIdleForOperation(operationLabel, token) {
        var _a;
        if (this._isDisposed) {
            throw new Error(`[ImageEditor] Cannot run "${operationLabel}" after dispose.`);
        }
        const ownOperation = this.isOwnOperation(token);
        if (this._isAnimating) {
            throw new Error(`[ImageEditor] Cannot run "${operationLabel}" while an animation is in progress.`);
        }
        if (this._isLoading && !ownOperation) {
            throw new Error(`[ImageEditor] Cannot run "${operationLabel}" while an image is loading.`);
        }
        if (this._activeOperationToken && !ownOperation) {
            throw new Error(`[ImageEditor] Cannot run "${operationLabel}" while ` +
                `${(_a = this._activeOperationName) !== null && _a !== void 0 ? _a : 'another operation'} is running.`);
        }
    }
    assertCanQueueAnimation(operationLabel, token) {
        var _a;
        if (this._isDisposed) {
            throw new Error(`[ImageEditor] Cannot run "${operationLabel}" after dispose.`);
        }
        const ownOperation = this.isOwnOperation(token);
        if (this._isLoading && !ownOperation) {
            throw new Error(`[ImageEditor] Cannot run "${operationLabel}" while an image is loading.`);
        }
        if (this._activeOperationToken && !ownOperation) {
            throw new Error(`[ImageEditor] Cannot run "${operationLabel}" while ` +
                `${(_a = this._activeOperationName) !== null && _a !== void 0 ? _a : 'another operation'} is running.`);
        }
    }
}
//# sourceMappingURL=operation-guard.js.map