/**
 * Normalizes thrown JavaScript values at typed Plugin Kernel boundaries.
 *
 * @module
 */

/**
 * Preserves Error instances and wraps non-Error thrown values.
 *
 * The original value remains available as a non-enumerable `cause`.
 */
export function normalizeThrownError(cause: unknown, message: string): Error {
    try {
        if (cause instanceof Error) return cause;
    } catch {
        // A hostile cross-realm proxy must not escape the normalization boundary.
    }
    const error = new Error(message);
    Object.defineProperty(error, 'cause', {
        configurable: true,
        value: cause,
    });
    return error;
}
