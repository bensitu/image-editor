/**
 * Runs every accepted sample in insertion order and provides an explicit completion barrier.
 *
 * @module
 */

interface ScheduledSample<TSample> {
    readonly sample: TSample;
    readonly resolve: () => void;
    readonly reject: (error: unknown) => void;
}

interface FlushWaiter {
    readonly resolve: () => void;
    readonly reject: (error: unknown) => void;
}

export class OrderedSampleScheduler<TSample> {
    private readonly pending: ScheduledSample<TSample>[] = [];
    private readonly flushWaiters: FlushWaiter[] = [];
    private running = false;
    private cancelled = false;
    private failure: unknown = null;

    constructor(private readonly worker: (sample: TSample) => Promise<void> | void) {}

    push(sample: TSample): Promise<void> {
        if (this.cancelled) return Promise.resolve();
        if (this.failure !== null) return Promise.reject(this.failure);
        return new Promise<void>((resolve, reject) => {
            this.pending.push({ sample, resolve, reject });
            this.startNext();
        });
    }

    flush(): Promise<void> {
        if (this.cancelled) return Promise.resolve();
        if (this.failure !== null) return Promise.reject(this.failure);
        if (!this.running && this.pending.length === 0) return Promise.resolve();
        return new Promise<void>((resolve, reject) => {
            this.flushWaiters.push({ resolve, reject });
        });
    }

    cancel(): void {
        if (this.cancelled) return;
        this.cancelled = true;
        for (const scheduled of this.pending.splice(0)) scheduled.resolve();
        this.settleFlushWaiters();
    }

    private startNext(): void {
        if (this.running || this.cancelled || this.failure !== null) return;
        const scheduled = this.pending.shift();
        if (!scheduled) {
            this.settleFlushWaiters();
            return;
        }
        this.running = true;
        void Promise.resolve()
            .then(() => this.worker(scheduled.sample))
            .then(
                () => scheduled.resolve(),
                (error: unknown) => {
                    if (this.cancelled) {
                        scheduled.resolve();
                        return;
                    }
                    this.failure = error;
                    scheduled.reject(error);
                    for (const pending of this.pending.splice(0)) pending.reject(error);
                },
            )
            .finally(() => {
                this.running = false;
                if (!this.cancelled && this.failure === null && this.pending.length > 0) {
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
