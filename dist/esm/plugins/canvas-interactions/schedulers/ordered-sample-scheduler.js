export class OrderedSampleScheduler {
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
            value: []
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
    push(sample) {
        if (this.cancelled)
            return Promise.resolve();
        if (this.failure !== null)
            return Promise.reject(this.failure);
        return new Promise((resolve, reject) => {
            this.pending.push({ sample, resolve, reject });
            this.startNext();
        });
    }
    flush() {
        if (this.cancelled)
            return Promise.resolve();
        if (this.failure !== null)
            return Promise.reject(this.failure);
        if (!this.running && this.pending.length === 0)
            return Promise.resolve();
        return new Promise((resolve, reject) => {
            this.flushWaiters.push({ resolve, reject });
        });
    }
    cancel() {
        if (this.cancelled)
            return;
        this.cancelled = true;
        for (const scheduled of this.pending.splice(0))
            scheduled.resolve();
        this.settleFlushWaiters();
    }
    startNext() {
        if (this.running || this.cancelled || this.failure !== null)
            return;
        const scheduled = this.pending.shift();
        if (!scheduled) {
            this.settleFlushWaiters();
            return;
        }
        this.running = true;
        void Promise.resolve()
            .then(() => this.worker(scheduled.sample))
            .then(() => scheduled.resolve(), (error) => {
            if (this.cancelled) {
                scheduled.resolve();
                return;
            }
            this.failure = error;
            scheduled.reject(error);
            for (const pending of this.pending.splice(0))
                pending.reject(error);
        })
            .finally(() => {
            this.running = false;
            if (!this.cancelled && this.failure === null && this.pending.length > 0) {
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
//# sourceMappingURL=ordered-sample-scheduler.js.map