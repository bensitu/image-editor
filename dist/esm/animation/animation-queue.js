export class AnimationQueue {
    constructor() {
        Object.defineProperty(this, "queue", {
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
    }
    add(animationFn) {
        return new Promise((resolve, reject) => {
            this.queue.push({ run: animationFn, resolve, reject });
            if (!this.running) {
                void this.drainQueue();
            }
        });
    }
    clear(reason) {
        const pending = this.queue;
        this.queue = [];
        if (reason !== undefined) {
            for (const entry of pending) {
                entry.reject(reason);
            }
        }
        else {
            for (const entry of pending) {
                entry.resolve();
            }
        }
    }
    isRunning() {
        return this.running;
    }
    isBusy() {
        return this.running || this.queue.length > 0;
    }
    waitForIdle() {
        if (!this.running && this.queue.length === 0) {
            return Promise.resolve();
        }
        return this.add(() => Promise.resolve()).then(() => undefined, () => undefined);
    }
    async drainQueue() {
        if (this.running)
            return;
        this.running = true;
        try {
            while (this.queue.length > 0) {
                const entry = this.queue.shift();
                try {
                    await entry.run();
                    entry.resolve();
                }
                catch (error) {
                    entry.reject(error);
                }
            }
        }
        finally {
            this.running = false;
            if (this.queue.length > 0) {
                void this.drainQueue();
            }
        }
    }
}
//# sourceMappingURL=animation-queue.js.map