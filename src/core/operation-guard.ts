/**
 * Animation-state guard used by the {@link ImageEditor} facade
 * to block stateful public operations while an animation is in
 * progress, and to centralize the dispose flag that in-flight
 * animation callbacks check before touching the canvas.
 *
 * ## Owned contracts
 *
 * - While `isAnimating` is `true`, the editor SHALL
 *   reject calls to `mergeMasks`, `exportImageBase64`, `exportImageFile`,
 *   `downloadImage`, `enterCropMode`, `applyCrop`, `removeAllMasks`, and
 *   `loadImage` with a clear error or no-op (documented per method).
 * - `undo` and `redo` are NOT routed through this
 *   guard; they are serialized by the `AnimationQueue` instead. Callers that
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
 * In-flight animation callbacks check `isDisposed` before touching the
 * canvas. Co-locating the disposed flag here keeps both checks behind a
 * single small object so the Fabric animation wrapper
 * (`fabric/fabric-animation.ts`) and the dispose path (`image-editor.ts`)
 * can share state without a circular dependency on the orchestrator.
 *
 * The guard does NOT log on rejection — the contract is "no state mutation
 * and a documented no-op shape per method"; logging is left to the caller
 * so each public method can choose between resolved-promise, empty-string,
 * or rejection-with-typed-error per the documented per-method documentation.
 *
 * The guard is imported by `image-editor.ts` and
 * `fabric/fabric-animation.ts`. It is intentionally NOT re-exported from
 * `src/index.ts`.
 *
 * @module
 */

import { IdleGuardError } from './errors.js';

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

export type OperationToken = symbol;

/**
 * Tracks the editor's `isAnimating` and `isDisposed` flags and exposes the
 * single-line `assertNotAnimating` gate used by every guarded public
 * method.
 *
 * Lifetime is one-per-editor — a fresh `OperationGuard` is created in the
 * `ImageEditor` constructor and disposed alongside the canvas.
 *
 */
export class OperationGuard {
    private isAnimationActive = false;
    private isDisposedFlag = false;
    private isLoadingActive = false;
    private currentOperationName: string | null = null;
    private currentOperationToken: OperationToken | null = null;
    private readonly animationAborters = new Set<() => void>();

    /**
     * Returns `true` while an animation block is open (between
     * {@link beginAnimation} and {@link endAnimation}).
     *
     * Public surface for the orchestrator's `isAnimating` check used by
     * the per-method guards.
     */
    isAnimating(): boolean {
        return this.isAnimationActive;
    }

    /**
     * Returns `true` once {@link markDisposed} has been called. Animation
     * callbacks consult this before touching the canvas.
     */
    isDisposed(): boolean {
        return this.isDisposedFlag;
    }

    /**
     * Returns `true` while a transactional image load is in progress.
     */
    isLoading(): boolean {
        return this.isLoadingActive;
    }

    /**
     * Returns the currently active non-load operation name, if any.
     */
    activeOperationName(): string | null {
        return this.currentOperationName;
    }

    /**
     * Returns `true` while any guard-owned busy state is active.
     */
    isBusy(): boolean {
        return (
            this.isAnimationActive || this.isLoadingActive || this.currentOperationToken !== null
        );
    }

    /**
     * Begin an animation block. Subsequent calls to {@link assertNotAnimating}
     * will throw until {@link endAnimation} runs.
     *
     * Prefer {@link runAnimation} over manually calling begin/end so the
     * "isAnimating false before resolve/reject" invariant is enforced by
     * `try/finally` rather than caller discipline.
     */
    beginAnimation(): void {
        this.isAnimationActive = true;
    }

    /**
     * End an animation block and clear the `isAnimating` flag. Always called
     * from a `finally` so the flag is `false` before the surrounding promise
     * resolves or rejects.
     */
    endAnimation(): void {
        this.isAnimationActive = false;
    }

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
    markDisposed(): void {
        this.isDisposedFlag = true;
        this.isAnimationActive = false;
        this.isLoadingActive = false;
        this.currentOperationName = null;
        this.currentOperationToken = null;
        for (const abort of this.animationAborters) {
            try {
                abort();
            } catch {
                /* ignore */
            }
        }
        this.animationAborters.clear();
    }

    registerAnimationAborter(abort: () => void): () => void {
        if (this.isDisposedFlag) {
            try {
                abort();
            } catch {
                /* ignore */
            }
            return () => undefined;
        }

        this.animationAborters.add(abort);
        return () => {
            this.animationAborters.delete(abort);
        };
    }

    /**
     * Mark a transactional image load as active.
     */
    beginLoading(): void {
        this.isLoadingActive = true;
    }

    /**
     * Clear the transactional image load flag.
     */
    endLoading(): void {
        this.isLoadingActive = false;
    }

    /**
     * Mark a longer-running public operation active and return the token
     * that authorizes its internal calls.
     */
    beginBusyOperation(operationName: string): OperationToken {
        const token = Symbol(operationName);
        this.currentOperationName = operationName;
        this.currentOperationToken = token;
        return token;
    }

    /**
     * Clear the active operation only when the matching token finishes.
     */
    endBusyOperation(token: OperationToken | null | undefined): void {
        if (token && token === this.currentOperationToken) {
            this.currentOperationName = null;
            this.currentOperationToken = null;
        }
    }

    /**
     * Returns `true` when `token` belongs to the currently active operation.
     */
    isOwnOperation(token: OperationToken | null | undefined): boolean {
        return !!token && token === this.currentOperationToken;
    }

    /**
     * Run an async function inside a `beginAnimation` / `endAnimation`
     * bracket. The bracket is released in a `finally` so the
     * `isAnimating === false` invariant holds even
     * when `animationTask` rejects.
     *
     * Used by the orchestrator's transform pipeline (`scaleImage`,
     * `rotateImage`, `resetImageTransform`) when wrapping a single Fabric
     * animation. The animation queue (`animation/animation-queue.ts`)
     * enforces FIFO ordering across multiple wrappers, so callers do not
     * need to coordinate begin/end across queue entries.
     *
     * @typeParam T - Resolved value of the wrapped animation.
     * @param animationTask - Animation function returning a promise.
     * @returns      The promise returned by `animationTask`, with begin/end bracketing
     *               applied around its lifetime.
     */
    async runAnimation<T>(animationTask: () => Promise<T>): Promise<T> {
        this.beginAnimation();
        try {
            return await animationTask();
        } finally {
            this.endAnimation();
        }
    }

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
     * the typed classes from `core/errors.ts`; some public methods translate
     * the failure into a documented no-op shape before it reaches the
     * consumer.
     *
     * @param operationLabel - Short, user-facing operation name (e.g. `'mergeMasks'`).
     *   Embedded in the error message verbatim.
     * @throws Error when {@link isAnimating} returns `true`.
     */
    assertNotAnimating(operationLabel: string): void {
        if (this.isAnimationActive) {
            throw new IdleGuardError(operationLabel, 'while an animation is in progress');
        }
    }

    /**
     * Throw when a public operation would overlap loading, animation, or
     * another active transaction. Internal calls may pass their active
     * operation token to proceed.
     */
    assertIdleForOperation(operationLabel: string, token?: OperationToken | null): void {
        if (this.isDisposedFlag) {
            throw new IdleGuardError(operationLabel, 'after dispose');
        }
        const ownOperation = this.isOwnOperation(token);
        if (this.isAnimationActive) {
            throw new IdleGuardError(operationLabel, 'while an animation is in progress');
        }
        if (this.isLoadingActive && !ownOperation) {
            throw new IdleGuardError(operationLabel, 'while an image is loading');
        }
        if (this.currentOperationToken && !ownOperation) {
            throw new IdleGuardError(
                operationLabel,
                `while ${this.currentOperationName ?? 'another operation'} is running`,
            );
        }
    }

    /**
     * Throw when an animation cannot even be queued because a load or
     * transaction is currently active. Existing animations are intentionally
     * left to the animation queue.
     */
    assertCanQueueAnimation(operationLabel: string, token?: OperationToken | null): void {
        if (this.isDisposedFlag) {
            throw new IdleGuardError(operationLabel, 'after dispose');
        }
        const ownOperation = this.isOwnOperation(token);
        if (this.isLoadingActive && !ownOperation) {
            throw new IdleGuardError(operationLabel, 'while an image is loading');
        }
        if (this.currentOperationToken && !ownOperation) {
            throw new IdleGuardError(
                operationLabel,
                `while ${this.currentOperationName ?? 'another operation'} is running`,
            );
        }
    }
}
