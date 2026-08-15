/**
 * Defines the public configuration error for Canvas interaction bindings.
 *
 * @module
 */

/** Raised when Canvas interaction bindings are structurally invalid or conflict. */
export class CanvasInteractionsConfigurationError extends Error {
    override readonly name = 'CanvasInteractionsConfigurationError';

    constructor(message: string) {
        super(`[ImageEditor] ${message}`);
    }
}
