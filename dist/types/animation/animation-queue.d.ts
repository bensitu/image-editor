/**
 * FIFO sequential animation queue that prevents overlapping
 * animations and provides dispose-safe settlement so callers do not
 * hang during `dispose` or hard-reset paths.
 *
 * Implements:
 * - at most one entry runs at a time, in enqueue order.
 * - animation-producing operations (`scaleImage`,
 *   `rotateImage`, `resetImageTransform`, `undo`, `redo`) are routed
 *   through this queue by the orchestrator.
 * - every promise returned by {@link AnimationQueue.add}
 *   eventually settles, even when the queue is drained by
 *   {@link AnimationQueue.clear}.
 * - the active entry's promise settles only after
 *   its function settles, so the orchestrator can flip its
 *   `isAnimating` flag inside the wrapped function before this queue
 *   resolves the caller.
 * - dispose paths can drain pending
 *   entries via {@link AnimationQueue.clear} so queued callers do not
 *   hang. In-flight animation wrappers (see `fabric/fabric-animation.ts`)
 *   check `isDisposed` independently and exit without touching the
 *   canvas; the queue itself never inspects editor state.
 *
 * @module
 */
/**
 * Guarantees that animation-producing operations are executed strictly
 * one after another, in the order they were enqueued.
 *
 * The queue is dispose-aware in the sense that {@link AnimationQueue.clear}
 * settles every pending entry, so callers awaiting an enqueued slot
 * (for example, `await editor.scaleImage(2)`) never hang once the
 * orchestrator tears down. The queue itself does not call into Fabric
 * and does not know whether the editor is disposed; it is the caller's
 * responsibility to invoke `clear` when the underlying work can no
 * longer be performed.
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
    /** Pending entries waiting to start, in FIFO order. */
    private queue;
    /** True while an entry is being awaited inside {@link drainQueue}. */
    private running;
    /**
     * Enqueues an animation function and returns a Promise that settles
     * when that specific entry completes.
     *
     * The promise resolves when `animationFn`'s returned promise resolves
     * and rejects when it rejects, after the queue has popped the entry
     * and before the next entry begins. This preserves FIFO ordering and
     * lets the orchestrator flip its `isAnimating` flag inside
     * `animationFn` before the public promise settles.
     *
     * @param animationFn - Function that performs async work and resolves
     *   when the animation has finished or rejects with the original error.
     * @returns A promise that settles once this specific entry has
     *   completed, been rejected, or been drained by {@link clear}.
     */
    add(animationFn: () => Promise<void>): Promise<void>;
    /**
     * Cancels every pending entry so callers awaiting a queued slot do
     * not hang. Used by `dispose` and hard-reset paths in the editor
     * orchestrator.
     *
     * The currently active entry (if any) is not interrupted by this
     * method; its promise settles when its function settles. Animation
     * wrappers in `fabric/fabric-animation.ts` observe `isDisposed`
     * independently and exit without touching the canvas, so the active
     * entry typically settles promptly after dispose calls `clear`.
     *
     * @param reason - When provided, pending entries reject with this
     *   value (typed errors from `core/errors.ts` are recommended for
     *   diagnostics). When omitted, pending entries resolve normally,
     *   which is the documented dispose default — the orchestrator's
     *   own dispose guards prevent further canvas access.
     */
    clear(reason?: unknown): void;
    /**
     * Reports whether an entry is currently active. Returns `true` only
     * while {@link drainQueue} is awaiting an entry's function; pending
     * entries that have not yet started do not count as running.
     */
    isRunning(): boolean;
    /**
     * Reports whether an entry is active or waiting to run.
     */
    isBusy(): boolean;
    /**
     * Resolves after the active entry and every currently pending entry
     * has settled (resolved or rejected). This is the public hook the
     * orchestrator uses to await a quiescent queue, for example before
     * tearing down the canvas in a hard-reset path.
     *
     * The implementation appends a no-op sentinel so the returned
     * promise inherits the FIFO settlement order. If the queue is
     * already idle, the returned promise resolves on the microtask
     * tick. Sentinel rejections (from {@link clear} with a reason) are
     * swallowed; "settled" includes "rejected" for the purposes of this
     * method.
     */
    waitForIdle(): Promise<void>;
    private drainQueue;
}
//# sourceMappingURL=animation-queue.d.ts.map