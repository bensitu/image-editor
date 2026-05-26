/**
 * @file operation-guard.ts
 * @description Animation-state guard used by the {@link ImageEditor} facade
 *              to block stateful public operations while an animation is in
 *              progress, and to centralize the dispose flag that in-flight
 *              animation callbacks check before touching the canvas.
 *
 * ## Owned contracts
 *
 * - While `isAnimating` is `true`, the editor SHALL
 *   reject calls to `mergeMasks`, `exportImageBase64`, `exportImageFile`,
 *   `downloadImage`, `enterCropMode`, `applyCrop`, `removeAllMasks`, and
 *   `loadImage` with a clear error or no-op (documented per method).
 * - `undo` and `redo` are NOT routed through this
 *   guard; they are serialized by the {@link
 *../animation/animation-queue.AnimationQueue} instead. Callers that
 *   would otherwise be blocked by the `isAnimating` flag still flow
 *   through `assertNotAnimating`; `undo` / `redo` skip the guard
 *   entirely (see `image-editor.ts`).
 * - When an animation completes or fails, the
 *   editor SHALL set `isAnimating` to `false` *before* resolving or
 *   rejecting the returned promise. The {@link OperationGuard.runAnimation}
 *   helper enforces this by clearing the flag inside a `finally` block.
 *
 * ## Why the guard owns the dispose flag too
 *
 * The design ("Idempotent dispose with bindings registry" and the Error
 * Handling table) has in-flight animation callbacks check `_disposed`
 * before touching the canvas. Co-locating the disposed flag here keeps
 * both checks behind a single small object so the Fabric animation
 * wrapper (`fabric/fabric-animation.ts`) and the dispose path
 * (`image-editor.ts`) can share state without a circular dependency on
 * the orchestrator.
 *
 * The guard does NOT log on rejection — the contract is "no state mutation
 * and a documented no-op shape per method"; logging is left to the caller
 * so each public method can choose between resolved-promise, empty-string,
 * or rejection-with-typed-error per the design's per-method documentation.
 *
 * Owner module references (per the design's "Mapping requirements to
 * modules" table): the guard is imported by `image-editor.ts` and by
 * `fabric/fabric-animation.ts`. It is intentionally NOT re-exported from
 * `src/index.ts`.
 */
/**
 * Read-only view of the guard state. Useful for diagnostics, property
 * tests, and `fabric/fabric-animation.ts` callbacks that only need to
 * observe (never mutate) the flags.
 */
export interface AnimationState {
    /** `true` while a queued animation is bracketed by begin/endAnimation. */
    readonly isAnimating: boolean;
    /** `true` after {@link OperationGuard.markDisposed} has been called. */
    readonly isDisposed: boolean;
}
/**
 * Tracks the editor's `isAnimating` and `_disposed` flags and exposes the
 * single-line `assertNotAnimating` gate used by every guarded public
 * method.
 *
 * Lifetime is one-per-editor — a fresh `OperationGuard` is created in the
 * `ImageEditor` constructor and disposed alongside the canvas.
 *
 */
export declare class OperationGuard {
    /**
     * Returns `true` while an animation block is open (between
     * {@link beginAnimation} and {@link endAnimation}).
     *
     * Public surface for the orchestrator's `isAnimating` check used by
     * the per-method guards.
     */
    isAnimating(): boolean;
    /**
     * Returns `true` once {@link markDisposed} has been called. Animation
     * callbacks consult this before touching the canvas.
     */
    isDisposed(): boolean;
    /**
     * Begin an animation block. Subsequent calls to {@link assertNotAnimating}
     * will throw until {@link endAnimation} runs.
     *
     * Prefer {@link runAnimation} over manually calling begin/end so the
     * "isAnimating false before resolve/reject" invariant from Requirement
     * 14.3 is enforced by `try/finally` rather than caller discipline.
     */
    beginAnimation(): void;
    /**
     * End an animation block and clear the `isAnimating` flag. Always called
     * from a `finally` so the flag is `false` before the surrounding promise
     * resolves or rejects.
     */
    endAnimation(): void;
    /**
     * Mark the editor disposed. After this call:
     *
     * - `isDisposed` returns `true`.
     * - `isAnimating` is forced to `false` so any post-dispose `finally`
     *   that runs after the animation queue is cleared still leaves the
     *   guard in a quiescent state.
     *
     * Idempotent: calling twice is a no-op.
     */
    markDisposed(): void;
    /**
     * Run an async function inside a `beginAnimation` / `endAnimation`
     * bracket. The bracket is released in a `finally` so the
     * `isAnimating === false` invariant holds even
     * when `fn` rejects.
     *
     * Used by the orchestrator's transform pipeline (`scaleImage`,
     * `rotateImage`, `resetImageTransform`) when wrapping a single Fabric
     * animation. The animation queue (`animation/animation-queue.ts`)
     * enforces FIFO ordering across multiple wrappers, so callers do not
     * need to coordinate begin/end across queue entries.
     *
     * @typeParam T  Resolved value of the wrapped animation.
     * @param fn     Animation function returning a promise.
     * @returns      The promise returned by `fn`, with begin/end bracketing
     *               applied around its lifetime.
     */
    runAnimation<T>(fn: () => Promise<T>): Promise<T>;
    /**
     * Throw if an animation is currently in progress. Used as the gate for
     * the operations enumerated: `mergeMasks`,
     * `exportImageBase64`, `exportImageFile`, `downloadImage`,
     * `enterCropMode`, `applyCrop`, `removeAllMasks`, and `loadImage`.
     *
     * `undo` and `redo` are NOT routed through this gate;
     * they go through the animation queue, which serializes them after any
     * in-flight animation entry.
     *
     * The thrown error is intentionally a plain `Error` rather than one of
     * the typed classes from `core/errors.ts` — the design's per-method
     * contract may translate the failure into a resolved no-op (e.g.
     * `exportImageBase64` returns `''`) before it reaches the consumer, so
     * callers branch on this signal locally and choose the no-op shape
     * documented for that method.
     *
     * @param operationLabel
     *   Short, user-facing operation name (e.g. `'mergeMasks'`).
     *   Embedded in the error message verbatim.
     * @throws Error when {@link isAnimating} returns `true`.
     */
    assertNotAnimating(operationLabel: string): void;
}
//# sourceMappingURL=operation-guard.d.ts.map