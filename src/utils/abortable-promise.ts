/**
 * Settles abort-aware wrappers promptly and releases values produced after cancellation.
 *
 * @module
 */

/** Races a task against an AbortSignal while observing and cleaning up late results. */
export function settleAbortable<T>(
    task: Promise<T>,
    signal: AbortSignal,
    disposeLateResult?: (value: T) => void,
): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        let settled = false;
        const finish = (body: () => void): void => {
            if (settled) return;
            settled = true;
            signal.removeEventListener('abort', abort);
            body();
        };
        const abort = (): void =>
            finish(() =>
                reject(
                    signal.reason ??
                        new DOMException('The asynchronous task was aborted.', 'AbortError'),
                ),
            );
        signal.addEventListener('abort', abort, { once: true });
        if (signal.aborted) abort();

        task.then(
            (value) => {
                if (settled) {
                    try {
                        disposeLateResult?.(value);
                    } catch {
                        // Late-result cleanup is best effort after the public task settled.
                    }
                    return;
                }
                finish(() => resolve(value));
            },
            (error: unknown) => finish(() => reject(error)),
        );
    });
}
