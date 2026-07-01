/**
 * Promise-shaped wrapper around Fabric.js v7's
 * {@link FabricNS.FabricObject.animate} for the current transform
 * pipeline. v7's `animate(props, providedOptions)` returns an
 * `Animation[]`-like map of contexts (one per animated
 * property) and signals completion through the `onComplete`
 * callback rather than a Promise. To plug it into the
 * `AnimationQueue`, we wrap
 * the call into a single Promise that resolves only after
 * every property animation has fired its callback.
 *
 * ## Owned contracts
 *
 * - Wrap only Fabric v7-compatible APIs. v7's
 *   `object.animate` returns `Animation[]` (a map of per-property contexts)
 *   and reports completion via `onComplete`; multi-property tweens fire
 *   the callback once per property. {@link animateProps} hides that shape
 *   behind a single Promise so callers do not encode v7-specific shapes.
 * - `scaleImage(factor)` animates the original
 *   image over `options.animationDuration`. `scaleX` and `scaleY` are
 *   tweened together, so the resolution count is two — see
 *   {@link animateProps}.
 * - `rotateImage(degrees)` animates `angle` over
 *   `options.animationDuration`. The single-property case still flows
 *   through the same wrapper and resolves on the first `onComplete`.
 * - In-flight animation callbacks check
 *   `isDisposed` (via `OperationGuard.isDisposed()`)
 *   before touching the canvas. {@link animateProps} short-circuits the
 *   `onChange` invocation when the editor has been disposed and still
 *   settles its Promise so queued callers never hang
 *   (the `AnimationQueue` contract).
 * - Rotation animations temporarily set the image
 *   origin to `'center'/'center'` so Fabric tweens around the visual
 *   centroid. If dispose interrupts the animation between begin and the
 *   post-animation origin restore in `image/transform-controller.ts`,
 *   {@link restoreOrigin} replays the origin restore on the original
 *   image so it is not left in the temporary center-origin state.
 *
 * The wrapper does not call `saveState`, mark the queue, or set
 * `isAnimating` — those live in the orchestrator and {@link OperationGuard}.
 * This file is intentionally
 * tiny: it owns one Fabric v7 quirk (the `Animation[]` return shape) and
 * one dispose-safety detail (origin restore on interrupt). Per the
 * Module Responsibilities table, it is NOT re-exported from
 * `src/index.ts`.
 *
 * @module
 */

import type * as FabricNS from 'fabric';
import type { OperationGuard } from '../core/operation-guard.js';

const ANIMATION_SETTLE_GRACE_MS = 1000;

type AbortableAnimation = {
    abort?: () => void;
};

/**
 * Options accepted by {@link animateProps}.
 *
 * Mirrors the subset of Fabric's `AnimationOptions` that the current transform
 * pipeline uses. Additional fields (easing, duration jitter, etc.) are
 * intentionally omitted so the wrapper has a single observable shape per
 */
export interface AnimateOptions {
    /** Animation duration in milliseconds (matches `options.animationDuration`). */
    duration: number;
    /**
     * Per-frame hook. Called on every Fabric animation tick while the
     * editor is not disposed. Typically used to call
     * `canvas.requestRenderAll`.
     *
     * The wrapper guards this call with {@link OperationGuard.isDisposed}
     * so post-dispose ticks become no-ops.
     */
    onChange?: () => void;
}

/**
 * Animate one or more numeric properties on a Fabric object and resolve
 * a single Promise once **all** property animations have completed.
 *
 * In Fabric v7, `object.animate(props, providedOptions)` returns a per-property
 * `Animation[]`-like map and signals completion via the `onComplete`
 * callback. For multi-property tweens (e.g. `scale` requires both
 * `scaleX` and `scaleY`), `onComplete` fires once per property — so we
 * count completions before resolving.
 *
 * Dispose safety:
 *
 * - When the editor is disposed mid-animation, {@link AnimateOptions.onChange}
 *   becomes a no-op so canvas references that may already be torn down
 *   are not touched.
 * - The Promise still settles (resolves) so the
 *   `AnimationQueue` can drain queued
 *   callers without hanging.
 *
 * Caller responsibilities:
 *
 * - The caller (transform controller) is responsible for the post-animation
 *   `object.set({...}); object.setCoords;` snap so the final value is exact even
 *   if Fabric rounds the last tick. The wrapper does not commit values.
 * - The caller is responsible for `OperationGuard.runAnimation` bracketing
 *   so `isAnimating` is `false` before the returned Promise resolves.
 *
 * @typeParam T - Concrete Fabric object subtype (FabricImage, Rect, etc.).
 * @param object - Fabric object to animate.
 * @param props - Map of property names to target numeric values (e.g.
 *                 `{ scaleX: 1.5, scaleY: 1.5}` or `{ angle: 90}`).
 * @param options - Duration and per-tick hook.
 * @param guard - Operation guard providing the `isDisposed` flag that
 *                 inner callbacks consult before touching the canvas.
 * @returns        Resolves once every animated property has signalled
 *                 completion. Rejects only if `object.animate` itself throws
 *                 synchronously (an empty `props` map resolves immediately).
 *
 */
export function animateProps<T extends FabricNS.FabricObject>(
    object: T,
    props: Record<string, number>,
    options: AnimateOptions,
    guard: OperationGuard,
): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        const propCount = Object.keys(props).length;
        if (propCount === 0 || guard.isDisposed()) {
            // Nothing to animate — settle immediately so callers (the
            // animation queue) can advance to the next entry.
            resolve();
            return;
        }

        let completed = 0;
        let settled = false;
        let aborters: Array<() => void> = [];
        let timeoutId: ReturnType<typeof setTimeout> | null = null;
        let unregisterAborter: (() => void) | null = null;

        const cleanup = (): void => {
            if (timeoutId !== null) {
                clearTimeout(timeoutId);
                timeoutId = null;
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

        const abortAndSettle = (): void => {
            for (const abort of aborters) {
                try {
                    abort();
                } catch {
                    /* ignore */
                }
            }
            settle();
        };

        const duration = Number.isFinite(options.duration) ? Math.max(0, options.duration) : 0;
        timeoutId = setTimeout(abortAndSettle, duration + ANIMATION_SETTLE_GRACE_MS);
        unregisterAborter = guard.registerAnimationAborter(abortAndSettle);

        try {
            // v7: `animate` returns `Record<string, TAnimation>` (one
            // entry per property). Completion is signalled per-property
            // via `onComplete`, so we count callbacks before resolving.
            const animationResult = object.animate(props, {
                duration,
                onChange: () => {
                    if (guard.isDisposed()) return;
                    options.onChange?.();
                },
                onComplete: () => {
                    // Settle the wrapper Promise even when disposed so the
                    // AnimationQueue does not hang. The orchestrator's
                    // post-animation snap (set/setCoords) already self-guards
                    // against `isDisposed`.
                    if (++completed >= propCount) settle();
                },
            });
            aborters = collectAnimationAborters(animationResult);
        } catch (error) {
            // `object.animate` is not documented to throw synchronously, but
            // a corrupted Fabric prototype or a bad property name could
            // throw. Reject so the queue moves on instead of waiting on
            // a callback that will never fire.
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
 * Restore the `originX` / `originY` pair on a Fabric object after a
 * rotation animation has been interrupted by dispose.
 *
 * `image/transform-controller.ts.rotateImage` temporarily sets the image
 * origin to `'center'/'center'` so Fabric tweens the angle around the
 * visual centroid (Fabric v7 defaults `originX`/`originY` to `'center'`,
 * but the compatibility path uses `'left'/'top'` for placement math). The
 * controller restores the original origin after the animation resolves.
 * If dispose runs between begin and the post-animation restore, the
 * controller's restore branch is skipped — leaving the image in the
 * temporary center-origin state. This helper replays the restore so a
 * post-dispose inspector (or a re-init that reuses the image reference)
 * sees the documented top-left origin.
 *
 * The helper is intentionally side-effect-tolerant:
 *
 * - Errors are swallowed because the canvas may already have been
 *   disposed and `setCoords` could throw on a torn-down object. The
 *   point of the helper is best-effort cleanup, not a hard guarantee.
 * - It does NOT request a render. The canvas is, by contract, on its way
 *   out (this is only called from the dispose path).
 *
 * @param object - Fabric object whose origin pair needs restoring.
 *                 In practice this is the editor's `originalImage`.
 * @param originX - Origin to restore on the X axis (typically `'left'`).
 * @param originY - Origin to restore on the Y axis (typically `'top'`).
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
        // Object may already be detached from a disposed canvas; the
        // helper is documented as silent best-effort cleanup so we
        // intentionally swallow.
    }
}
