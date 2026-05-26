/**
 * @file core/callback-reporter.ts
 * @description Helpers that route editor warnings and errors through the
 *              public `onWarning` and `onError` callbacks declared on
 *              {@link ImageEditorOptions}.
 *
 * ## Owned contracts
 *
 * - When the editor reports a recoverable warning
 *   through `onWarning`, the editor SHALL call the callback with
 *   `(error, message)` and SHALL catch and log any callback exception
 *   without changing editor state.
 * - When the editor reports an error through
 *   `onError`, the editor SHALL call the callback with `(error, message)`
 *   and SHALL catch and log any callback exception without masking the
 *   original editor error.
 *
 * The argument order `(error, message)` is part of the public surface and
 * is also enforced by the `ImageEditorOptions` type.
 *
 * ## Why a dedicated module
 *
 * Callback isolation is owned here rather than by the operation guard or
 * the orchestrator. Co-locating warning/error reporting gives every
 * pipeline a single, side-effect-light helper to call when something goes
 * wrong.
 *
 * ## Non-goals
 *
 * - The helpers do NOT throw or rethrow. Callers that need to reject a
 *   promise with the original error should do so explicitly *after*
 *   `reportError(...)` returns. This keeps the "callback failure must not
 *   mask the original editor error" invariant
 *   trivially satisfied.
 * - The helpers do NOT mutate editor state. They only invoke the
 *   user-supplied callback and, on callback exception, write a single
 *   diagnostic line to `console.warn` / `console.error`.
 *
 * The module is intentionally NOT re-exported from `src/index.ts`
 * (only `ImageEditor`, `isMaskObject`, and the
 * documented public types are root-exported).
 */

import type { ResolvedOptions } from './public-types.js';

/**
 * Minimum slice of {@link ResolvedOptions} required to dispatch a warning.
 * Accepting a structural sub-type lets pipeline modules pass either the
 * full `ResolvedOptions` reference or a focused stub (used in unit tests).
 */
export type WarningCallbackHost = Pick<ResolvedOptions, 'onWarning'>;

/**
 * Minimum slice of {@link ResolvedOptions} required to dispatch an error.
 *
 * @see WarningCallbackHost
 */
export type ErrorCallbackHost = Pick<ResolvedOptions, 'onError'>;

/**
 * Report a recoverable warning to the consumer's `onWarning` callback, if
 * one was supplied.
 *
 * The callback is invoked with the public `(error, message)` argument
 * order. The original `error` value is forwarded
 * unchanged — primitives, plain objects, and `Error` instances all flow
 * through verbatim so consumers can introspect them with `instanceof`.
 *
 * If the callback itself throws, the exception is caught and logged with
 * `console.warn`. The helper never throws and never returns a value, so
 * callers can chain it before continuing recovery without a `try`/`catch`
 * of their own.
 *
 * @example
 * ```ts
 * try {
 *   await tryDownsample(...);
 *} catch (err) {
 *   reportWarning(this.options, err, 'Downsample fell back to source format.');
 *   // continue with the un-downsampled image — no rethrow
 *}
 * ```
 *
 * @param options
 *   Object exposing the resolved `onWarning` callback. May be
 *   {@link ResolvedOptions} directly or any structural sub-type
 *   ({@link WarningCallbackHost}).
 * @param error
 *   The original error value. Forwarded as the first callback argument.
 *   Accepts `unknown` because rejected promises and thrown values are not
 *   guaranteed to be `Error` instances.
 * @param message
 *   Human-readable description of what happened. Forwarded as the second
 *   callback argument.
 */
export function reportWarning(
    options: WarningCallbackHost,
    error: unknown,
    message: string,
): void {
    const cb = options.onWarning;
    // The default-options resolver coerces non-functions to `null`, but we
    // re-check at the call site so this helper is safe to call even if a
    // pipeline module is invoked outside the orchestrator's normal lifecycle.
    if (typeof cb !== 'function') return;

    try {
        cb(error, message);
    } catch (callbackError) {
        // catch and log without changing editor state.
        // We do NOT rethrow the callback's error: doing so would convert a
        // recoverable warning into a hard failure inside whatever pipeline
        // happened to be running.
        console.warn('[ImageEditor] onWarning callback threw', callbackError);
    }
}

/**
 * Report an error to the consumer's `onError` callback, if one was
 * supplied.
 *
 * The callback is invoked with the public `(error, message)` argument
 * order. Like {@link reportWarning}, this helper never
 * throws — callbacks that throw are caught and logged with
 * `console.error`.
 *
 * The "do not mask the original editor error" half is
 * a contract on the *caller*: pipelines that intend to reject a promise
 * (or rethrow) with the original `error` MUST do so themselves *after*
 * this helper returns. By keeping reporting and rethrow separate, a
 * faulty `onError` callback cannot replace the original error with the
 * callback's own exception in the consumer's promise chain.
 *
 * @example
 * ```ts
 * try {
 *   await loadFabricImage(dataUrl);
 *} catch (err) {
 *   reportError(this.options, err, `Image load failed: ${describe(err)}`);
 *   throw err; // original error is preserved on the consumer's promise
 *}
 * ```
 *
 * @param options
 *   Object exposing the resolved `onError` callback. May be
 *   {@link ResolvedOptions} directly or any structural sub-type
 *   ({@link ErrorCallbackHost}).
 * @param error
 *   The original error value. Forwarded as the first callback argument.
 * @param message
 *   Human-readable description of what happened. Forwarded as the second
 *   callback argument.
 */
export function reportError(
    options: ErrorCallbackHost,
    error: unknown,
    message: string,
): void {
    const cb = options.onError;
    if (typeof cb !== 'function') return;

    try {
        cb(error, message);
    } catch (callbackError) {
        // catch and log without masking the original
        // editor error. The original `error` is intentionally NOT included
        // in this log line so the diagnostic clearly points at the
        // callback misbehavior; the original error will still surface
        // through whatever throw/reject the caller performs next.
        console.error('[ImageEditor] onError callback threw', callbackError);
    }
}
