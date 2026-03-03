/**
 * @file animation-queue.ts
 * @description FIFO sequential animation queue that prevents overlapping animations.
 */

interface QueueEntry {
    fn: () => Promise<void>;
    resolve: () => void;
    reject: (err: unknown) => void;
}

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
export class AnimationQueue {
    private queue: QueueEntry[] = [];
    private running = false;

    /**
     * Enqueues an animation function and returns a Promise that resolves
     * when that specific animation has finished executing.
     *
     * @param animationFn A function that performs async work and returns a Promise<void>.
     * @returns Promise<void> that settles once `animationFn` completes.
     */
    add(animationFn: () => Promise<void>): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this.queue.push({ fn: animationFn, resolve, reject });
            if (!this.running) {
                void this._process();
            }
        });
    }

    /** @internal */
    private async _process(): Promise<void> {
        if (this.queue.length === 0) {
            this.running = false;
            return;
        }

        this.running = true;
        const entry = this.queue.shift()!;

        try {
            await entry.fn();
            entry.resolve();
        } catch (err) {
            entry.reject(err);
        }

        void this._process();
    }
}
