export class LatestValueScheduler {
    constructor(worker) {
        Object.defineProperty(this, "worker", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: worker
        });
        Object.defineProperty(this, "pending", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "flushWaiters", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "running", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "cancelled", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "failure", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
    }
    pushLatest(value) {
        if (this.cancelled)
            return Promise.resolve();
        if (this.failure !== null)
            return Promise.reject(this.failure);
        return new Promise((resolve, reject) => {
            var _a;
            (_a = this.pending) === null || _a === void 0 ? void 0 : _a.resolve();
            this.pending = { value, resolve, reject };
            this.startNext();
        });
    }
    flush() {
        if (this.cancelled)
            return Promise.resolve();
        if (this.failure !== null)
            return Promise.reject(this.failure);
        if (!this.running && !this.pending)
            return Promise.resolve();
        return new Promise((resolve, reject) => {
            this.flushWaiters.push({ resolve, reject });
        });
    }
    cancel() {
        var _a;
        if (this.cancelled)
            return;
        this.cancelled = true;
        (_a = this.pending) === null || _a === void 0 ? void 0 : _a.resolve();
        this.pending = null;
        this.settleFlushWaiters();
    }
    startNext() {
        if (this.running || this.cancelled || this.failure !== null)
            return;
        const scheduled = this.pending;
        if (!scheduled) {
            this.settleFlushWaiters();
            return;
        }
        this.pending = null;
        this.running = true;
        void Promise.resolve()
            .then(() => this.worker(scheduled.value))
            .then(() => scheduled.resolve(), (error) => {
            var _a;
            if (this.cancelled) {
                scheduled.resolve();
                return;
            }
            this.failure = error;
            scheduled.reject(error);
            (_a = this.pending) === null || _a === void 0 ? void 0 : _a.reject(error);
            this.pending = null;
        })
            .finally(() => {
            this.running = false;
            if (!this.cancelled && this.failure === null && this.pending) {
                this.startNext();
            }
            else {
                this.settleFlushWaiters();
            }
        });
    }
    settleFlushWaiters() {
        if (this.running && !this.cancelled && this.failure === null)
            return;
        for (const waiter of this.flushWaiters.splice(0)) {
            if (this.failure !== null)
                waiter.reject(this.failure);
            else
                waiter.resolve();
        }
    }
}
//# sourceMappingURL=latest-value-scheduler.js.map