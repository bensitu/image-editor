/**
 * Adapts Fabric.js property animations to the Transform Plugin's Promise and cancellation model.
 *
 * Fabric returns one animation handle per property and reports completion through callbacks.
 * {@link animateProps} hides that library-specific shape, exposes one Promise, and registers every
 * abortable handle with the owning mutation scope. The Transform controller remains responsible
 * for exact final values, Geometry mutation rollback, state updates, and rendering.
 *
 * @module
 */

import type * as FabricNS from 'fabric';
const ANIMATION_SETTLE_GRACE_MS = 1000;
const ANIMATION_ABORT_QUIESCENCE_MS = 50;

type AbortableAnimation = {
    abort?: () => void;
};

export interface AnimationControl {
    isDisposed(): boolean;
    registerAnimationAborter(abort: () => void): () => void;
}

/**
 * Options accepted by {@link animateProps}.
 *
 * Mirrors the subset of Fabric's animation options used by the Transform Plugin. Additional fields
 * are intentionally omitted so the wrapper exposes one stable internal contract.
 */
export interface AnimateOptions {
    /** Animation duration in milliseconds. */
    duration: number;
    /**
     * Per-frame hook called while the mutation scope remains active. The Transform Plugin uses it
     * to request a render without exposing Fabric animation callbacks to higher layers.
     */
    onChange?: () => void;
}

/**
 * Animate numeric properties on a Fabric object and resolve after every property completes.
 *
 * `object.animate(props, providedOptions)` returns a per-property
 * `Animation[]`-like map and signals completion via the `onComplete`
 * callback. For multi-property tweens (e.g. `scale` requires both
 * `scaleX` and `scaleY`), `onComplete` fires once per property — so we
 * count completions before resolving.
 *
 * Cancellation aborts every handle and waits for a short quiet period after late Fabric callbacks,
 * bounded by an overall settlement grace. The Promise resolves after cancellation so the owning
 * Geometry mutation can finish rollback without hanging.
 *
 * Caller responsibilities:
 *
 * The caller is responsible for the exact post-animation value, coordinate refresh, state update,
 * and rollback. This wrapper never commits document state.
 *
 * @typeParam T - Concrete Fabric object subtype (FabricImage, Rect, etc.).
 * @param object - Fabric object to animate.
 * @param props - Map of property names to target numeric values (e.g.
 *                 `{ scaleX: 1.5, scaleY: 1.5}` or `{ angle: 90}`).
 * @param options - Duration and per-tick hook.
 * @param control - Mutation-scoped cancellation control.
 * @returns        Resolves once every animated property has signalled
 *                 completion. Rejects only if `object.animate` itself throws
 *                 synchronously (an empty `props` map resolves immediately).
 *
 */
export function animateProps<T extends FabricNS.FabricObject>(
    object: T,
    props: Record<string, number>,
    options: AnimateOptions,
    control: AnimationControl,
): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        const propCount = Object.keys(props).length;
        if (propCount === 0 || control.isDisposed()) {
            // Nothing can animate, so allow the owning mutation to continue immediately.
            resolve();
            return;
        }

        let completed = 0;
        let settled = false;
        let aborters: Array<() => void> = [];
        let timeoutId: ReturnType<typeof setTimeout> | null = null;
        let abortDeadlineId: ReturnType<typeof setTimeout> | null = null;
        let quiescenceTimeoutId: ReturnType<typeof setTimeout> | null = null;
        let unregisterAborter: (() => void) | null = null;
        let aborting = false;
        let abortedHandleCount = 0;

        const cleanup = (): void => {
            if (timeoutId !== null) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
            if (abortDeadlineId !== null) {
                clearTimeout(abortDeadlineId);
                abortDeadlineId = null;
            }
            if (quiescenceTimeoutId !== null) {
                clearTimeout(quiescenceTimeoutId);
                quiescenceTimeoutId = null;
            }
            unregisterAborter?.();
            unregisterAborter = null;
        };

        const settle = (): void => {
            if (settled) return;
            settled = true;
            cleanup();
            resolve();
        };

        const fail = (error: unknown): void => {
            if (settled) return;
            settled = true;
            cleanup();
            reject(error);
        };

        const abortAnimationHandles = (): void => {
            for (
                let index = abortedHandleCount;
                index < aborters.length;
                index += 1, abortedHandleCount += 1
            ) {
                const abort = aborters[index];
                if (!abort) continue;
                try {
                    abort();
                } catch {
                    // Cancellation must continue across independent Fabric handles.
                }
            }
        };

        const scheduleQuiescenceSettlement = (): void => {
            if (quiescenceTimeoutId !== null) clearTimeout(quiescenceTimeoutId);
            quiescenceTimeoutId = setTimeout(settle, ANIMATION_ABORT_QUIESCENCE_MS);
        };

        const abortAndQuiesce = (): void => {
            if (settled) return;
            if (!aborting) {
                aborting = true;
                if (timeoutId !== null) {
                    clearTimeout(timeoutId);
                    timeoutId = null;
                }
                abortDeadlineId = setTimeout(settle, ANIMATION_SETTLE_GRACE_MS);
            }
            abortAnimationHandles();
            scheduleQuiescenceSettlement();
        };

        const duration = Number.isFinite(options.duration) ? Math.max(0, options.duration) : 0;
        timeoutId = setTimeout(abortAndQuiesce, duration + ANIMATION_SETTLE_GRACE_MS);
        unregisterAborter = control.registerAnimationAborter(abortAndQuiesce);

        try {
            // `animate` returns `Record<string, TAnimation>` (one
            // entry per property). Completion is signalled per-property
            // via `onComplete`, so we count callbacks before resolving.
            const animationResult = object.animate(props, {
                duration,
                onChange: () => {
                    if (aborting) {
                        scheduleQuiescenceSettlement();
                        return;
                    }
                    if (control.isDisposed()) return;
                    options.onChange?.();
                },
                onComplete: () => {
                    if (aborting) {
                        scheduleQuiescenceSettlement();
                        return;
                    }
                    // Settlement after disposal allows the owning mutation to complete rollback.
                    if (++completed >= propCount) settle();
                },
            });
            aborters = collectAnimationAborters(animationResult);
            if (aborting) abortAnimationHandles();
        } catch (error) {
            // Reject synchronous Fabric failures instead of waiting for callbacks that cannot run.
            fail(error);
        }
    });
}

function collectAnimationAborters(animationResult: unknown): Array<() => void> {
    const handles = Array.isArray(animationResult)
        ? animationResult
        : animationResult && typeof animationResult === 'object'
          ? Object.values(animationResult as Record<string, unknown>)
          : [animationResult];

    return handles.flatMap((handle): Array<() => void> => {
        const abort = (handle as AbortableAnimation | null | undefined)?.abort;
        return typeof abort === 'function' ? [() => abort.call(handle)] : [];
    });
}

/**
 * Restore a Fabric object's origin after a rotation animation is interrupted by disposal.
 *
 * The Transform controller temporarily uses a centered origin while rotating and normally restores
 * top-left placement after the animation. Disposal can interrupt that sequence, so this helper
 * performs best-effort cleanup on the retained image reference.
 *
 * The helper is intentionally side-effect-tolerant:
 *
 * Errors are swallowed because the object may already be detached. No render is requested during
 * disposal.
 *
 * @param object - Fabric object whose origin pair needs restoring.
 * @param originX - Origin to restore on the X axis.
 * @param originY - Origin to restore on the Y axis.
 *
 */
export function restoreOrigin(
    object: FabricNS.FabricObject,
    originX: FabricNS.TOriginX,
    originY: FabricNS.TOriginY,
): void {
    try {
        object.set({ originX, originY });
        object.setCoords();
    } catch {
        // The object may already be detached from a disposed canvas.
    }
}
