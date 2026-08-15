/**
 * Defines the public configuration error for Canvas interaction bindings.
 *
 * @module
 */
/** Raised when Canvas interaction bindings are structurally invalid or conflict. */
export declare class CanvasInteractionsConfigurationError extends Error {
    readonly name = "CanvasInteractionsConfigurationError";
    constructor(message: string);
}
