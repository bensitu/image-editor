/**
 * @file utils/timeout.ts
 * @description Promise/timer race helper used by the image-loader pipeline
 *              to bound the decode and `FabricImage.fromURL` steps.
 *
 * ## Owned contracts
 *
 * - `loadImage(base64)` decode of the data URL into
 *   an `HTMLImageElement` SHALL be bounded by `options.imageLoadTimeoutMs`.
 * - `loadImage(base64)` `FabricImage.fromURL` step
 *   SHALL be bounded by the same `options.imageLoadTimeoutMs`.
 * - If either timeout elapses, the returned promise
 *   SHALL reject with a timeout error whose message includes the elapsed
 *   milliseconds. The {@link ImageLoadTimeoutError} class owns the message
 *   format; this module simply produces the error with the correct
 *   `(label, elapsedMs)` pair.
 *
 * ## Why a dedicated module
 *
 * The image-loader needs to apply the *same* timeout policy to two
 * independent async steps (decode and Fabric image creation). Centralizing
 * the race in one helper keeps the loader straight-line, ensures both
 * steps reject with the same error type, and gives the timeout logic a
 * single place to evolve (for example, future cancellation hooks).
 *
 * ## Design notes
 *
 * - The race is implemented with a `setTimeout`-based timer that is
 *   cleared as soon as the wrapped promise settles, so a slow-but-eventual
 *   resolution does not leave a dangling timer (and the elapsed-time
 *   measurement remains tight).
 * - On timeout, the helper computes elapsed ms from a `Date.now` taken
 *   at the start of the race. This avoids drift versus the `ms` argument
 *   for callers that want to log the actual wall-clock duration.
 * - On rejection of the wrapped promise, the original error is forwarded
 *   verbatim so the loader can branch on its specific type
 *   (`ImageDecodeError`, `DownsampleError`, etc.) rather than always
 *   seeing a `ImageLoadTimeoutError`.
 *
 * ## Non-goals
 *
 * - The helper does NOT cancel the wrapped promise. JavaScript promises
 *   have no built-in cancellation; the caller is responsible for any
 *   cleanup of the underlying work (e.g. clearing an `<img>.src`).
 * - The helper does NOT validate `ms`. Callers pass the resolved
 *   `imageLoadTimeoutMs` from `default-options.ts`, which is already
 *   coerced to a finite non-negative number.
 */
/**
 * Race a promise against a timer. If the timer fires first, reject with
 * an {@link ImageLoadTimeoutError} whose message includes `label` and the
 * elapsed milliseconds. If the wrapped promise settles
 * first, the timer is cleared and the original outcome is forwarded.
 *
 * Used by `image/image-loader.ts` to bound the decode step (Requirement
 * 7.1) and the `FabricImage.fromURL` step of
 * `loadImage`.
 *
 * @example
 * ```ts
 * await withTimeout(
 *   decodeImageElement(base64),
 *   options.imageLoadTimeoutMs,
 *   'image decode',
 *);
 * ```
 *
 * @typeParam T  Resolved value type of the wrapped promise.
 *
 * @param promise
 *   The async work to race. Forwarded verbatim on resolution; rejection
 *   reasons are forwarded unchanged so callers can branch on the original
 *   error type.
 * @param ms
 *   Timeout duration in milliseconds. Expected to be a finite,
 *   non-negative number; the caller (typically `default-options.ts`) is
 *   responsible for coercion.
 * @param label
 *   Human-readable step label embedded in the timeout error message
 *   (e.g. `'image decode'`, `'FabricImage.fromURL'`).
 *
 * @returns A promise that resolves to the wrapped promise's value, or
 *   rejects with the wrapped promise's reason, or rejects with
 *   {@link ImageLoadTimeoutError} if the timer fires first.
 */
export declare function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T>;
//# sourceMappingURL=timeout.d.ts.map