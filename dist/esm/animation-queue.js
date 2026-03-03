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
            this.queue.push({ fn: animationFn, resolve, reject });
            if (!this.running) {
                void this._process();
            }
        });
    }
    async _process() {
        if (this.queue.length === 0) {
            this.running = false;
            return;
        }
        this.running = true;
        const entry = this.queue.shift();
        try {
            await entry.fn();
            entry.resolve();
        }
        catch (err) {
            entry.reject(err);
        }
        void this._process();
    }
}
//# sourceMappingURL=animation-queue.js.map