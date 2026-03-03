"use strict";
/**
 * @file animation-queue.ts
 * @description FIFO sequential animation queue that prevents overlapping animations.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnimationQueue = void 0;
/**
 * Guarantees that animations are executed strictly one after another.
 *
 * @example
 * ```ts
 * const queue = new AnimationQueue();
 * queue.add(() => object.scale(2, { duration: 300 }));
 * queue.add(() => object.rotate(90, { duration: 300 }));
 * // The rotate starts only after the scale completes.
 * ```
 */
class AnimationQueue {
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
    /**
     * Enqueues an animation function and returns a Promise that resolves
     * when that specific animation has finished executing.
     *
     * @param animationFn A function that performs async work and returns a Promise<void>.
     * @returns Promise<void> that settles once `animationFn` completes.
     */
    add(animationFn) {
        return new Promise((resolve, reject) => {
            this.queue.push({ fn: animationFn, resolve, reject });
            if (!this.running) {
                void this._process();
            }
        });
    }
    /** @internal */
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
exports.AnimationQueue = AnimationQueue;
//# sourceMappingURL=animation-queue.js.map