/**
 * Isolates Mask callback failures from the mutation that triggered them.
 *
 * The shared Mask helpers use this boundary because they receive a narrow options object rather
 * than Core's diagnostics Capability. Warning callbacks are observational: a callback failure is
 * logged and never changes Mask creation or label synchronization control flow.
 *
 * @module
 */

export interface WarningCallbackHost {
    readonly onWarning?: ((error: unknown, message: string) => void) | null;
}

/**
 * Reports a recoverable Mask warning using the public `(error, message)` argument order.
 *
 * The original thrown value is forwarded unchanged. If the consumer callback throws, that failure
 * is logged and contained so it cannot replace the Mask operation's result.
 */
export function reportWarning(options: WarningCallbackHost, error: unknown, message: string): void {
    const warningCallback = options.onWarning;
    if (typeof warningCallback !== 'function') return;

    try {
        warningCallback(error, message);
    } catch (callbackError) {
        console.warn('[ImageEditor] onWarning callback threw', callbackError);
    }
}
