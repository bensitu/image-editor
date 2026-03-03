/**
 * @file animation-queue.ts
 * @description FIFO sequential animation queue that prevents overlapping animations.
 */
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
export declare class AnimationQueue {
    private queue;
    private running;
    /**
     * Enqueues an animation function and returns a Promise that resolves
     * when that specific animation has finished executing.
     *
     * @param animationFn A function that performs async work and returns a Promise<void>.
     * @returns Promise<void> that settles once `animationFn` completes.
     */
    add(animationFn: () => Promise<void>): Promise<void>;
    /** @internal */
    private _process;
}
//# sourceMappingURL=animation-queue.d.ts.map