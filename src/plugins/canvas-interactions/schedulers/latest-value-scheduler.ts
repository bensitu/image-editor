/**
 * Runs one value at a time while retaining only the newest pending value.
 *
 * @module
 */

interface ScheduledValue<TValue> {
    readonly value: TValue;
    readonly resolve: () => void;
    readonly reject: (error: unknown) => void;
}

interface FlushWaiter {
    readonly resolve: () => void;
    readonly reject: (error: unknown) => void;
}

export class LatestValueScheduler<TValue> {
    private pending: ScheduledValue<TValue> | null = null;
    private readonly flushWaiters: FlushWaiter[] = [];
    private running = false;
    private cancelled = false;
    private failure: unknown = null;

    constructor(private readonly worker: (value: TValue) => Promise<void> | void) {}

    pushLatest(value: TValue): Promise<void> {
        if (this.cancelled) return Promise.resolve();
        if (this.failure !== null) return Promise.reject(this.failure);
        return new Promise<void>((resolve, reject) => {
            this.pending?.resolve();
            this.pending = { value, resolve, reject };
            this.startNext();
        });
    }

    flush(): Promise<void> {
        if (this.cancelled) return Promise.resolve();
        if (this.failure !== null) return Promise.reject(this.failure);
        if (!this.running && !this.pending) return Promise.resolve();
        return new Promise<void>((resolve, reject) => {
            this.flushWaiters.push({ resolve, reject });
        });
    }

    cancel(): void {
        if (this.cancelled) return;
        this.cancelled = true;
        this.pending?.resolve();
        this.pending = null;
        this.settleFlushWaiters();
    }

    private startNext(): void {
        if (this.running || this.cancelled || this.failure !== null) return;
        const scheduled = this.pending;
        if (!scheduled) {
            this.settleFlushWaiters();
            return;
        }
        this.pending = null;
        this.running = true;
        void Promise.resolve()
            .then(() => this.worker(scheduled.value))
            .then(
                () => scheduled.resolve(),
                (error: unknown) => {
                    if (this.cancelled) {
                        scheduled.resolve();
                        return;
                    }
                    this.failure = error;
                    scheduled.reject(error);
                    this.pending?.reject(error);
                    this.pending = null;
                },
            )
            .finally(() => {
                this.running = false;
                if (!this.cancelled && this.failure === null && this.pending) {
                    this.startNext();
                } else {
                    this.settleFlushWaiters();
                }
            });
    }

    private settleFlushWaiters(): void {
        if (this.running && !this.cancelled && this.failure === null) return;
        for (const waiter of this.flushWaiters.splice(0)) {
            if (this.failure !== null) waiter.reject(this.failure);
            else waiter.resolve();
        }
    }
}
