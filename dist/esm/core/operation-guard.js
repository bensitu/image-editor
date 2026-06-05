export class OperationGuard {
    constructor() {
        Object.defineProperty(this, "isAnimationActive", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "isDisposedFlag", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "isLoadingActive", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "currentOperationName", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "currentOperationToken", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
    }
    isAnimating() {
        return this.isAnimationActive;
    }
    isDisposed() {
        return this.isDisposedFlag;
    }
    isLoading() {
        return this.isLoadingActive;
    }
    activeOperationName() {
        return this.currentOperationName;
    }
    isBusy() {
        return (this.isAnimationActive || this.isLoadingActive || this.currentOperationToken !== null);
    }
    beginAnimation() {
        this.isAnimationActive = true;
    }
    endAnimation() {
        this.isAnimationActive = false;
    }
    markDisposed() {
        this.isDisposedFlag = true;
        this.isAnimationActive = false;
        this.isLoadingActive = false;
        this.currentOperationName = null;
        this.currentOperationToken = null;
    }
    beginLoading() {
        this.isLoadingActive = true;
    }
    endLoading() {
        this.isLoadingActive = false;
    }
    beginBusyOperation(operationName) {
        const token = Symbol(operationName);
        this.currentOperationName = operationName;
        this.currentOperationToken = token;
        return token;
    }
    endBusyOperation(token) {
        if (token && token === this.currentOperationToken) {
            this.currentOperationName = null;
            this.currentOperationToken = null;
        }
    }
    isOwnOperation(token) {
        return !!token && token === this.currentOperationToken;
    }
    async runAnimation(animationTask) {
        this.beginAnimation();
        try {
            return await animationTask();
        }
        finally {
            this.endAnimation();
        }
    }
    assertNotAnimating(operationLabel) {
        if (this.isAnimationActive) {
            throw new Error(`[ImageEditor] Cannot run "${operationLabel}" while an animation is in progress.`);
        }
    }
    assertIdleForOperation(operationLabel, token) {
        var _a;
        if (this.isDisposedFlag) {
            throw new Error(`[ImageEditor] Cannot run "${operationLabel}" after dispose.`);
        }
        const ownOperation = this.isOwnOperation(token);
        if (this.isAnimationActive) {
            throw new Error(`[ImageEditor] Cannot run "${operationLabel}" while an animation is in progress.`);
        }
        if (this.isLoadingActive && !ownOperation) {
            throw new Error(`[ImageEditor] Cannot run "${operationLabel}" while an image is loading.`);
        }
        if (this.currentOperationToken && !ownOperation) {
            throw new Error(`[ImageEditor] Cannot run "${operationLabel}" while ` +
                `${(_a = this.currentOperationName) !== null && _a !== void 0 ? _a : 'another operation'} is running.`);
        }
    }
    assertCanQueueAnimation(operationLabel, token) {
        var _a;
        if (this.isDisposedFlag) {
            throw new Error(`[ImageEditor] Cannot run "${operationLabel}" after dispose.`);
        }
        const ownOperation = this.isOwnOperation(token);
        if (this.isLoadingActive && !ownOperation) {
            throw new Error(`[ImageEditor] Cannot run "${operationLabel}" while an image is loading.`);
        }
        if (this.currentOperationToken && !ownOperation) {
            throw new Error(`[ImageEditor] Cannot run "${operationLabel}" while ` +
                `${(_a = this.currentOperationName) !== null && _a !== void 0 ? _a : 'another operation'} is running.`);
        }
    }
}
//# sourceMappingURL=operation-guard.js.map