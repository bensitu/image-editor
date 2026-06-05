/**
 * DOM micro-helpers used by sizing and visibility flows.
 *
 * Kept intentionally small: the editor depends on a single synchronous
 * reflow primitive after canvas dimension changes, and exposing it as a
 * named utility lets layout, visibility, and crop flows share the same
 * documented contract.
 */

/**
 * Force a synchronous layout reflow on `element`.
 *
 * Reading an offset/scroll/clientWidth-like property forces the browser
 * to flush queued style and layout work on the spot, before any further
 * script runs. The editor relies on this after `Canvas.setDimensions`
 * so a container with `overflow: auto` shows or hides scrollbars before
 * the next paint, instead of waiting for the next frame.
 *
 * The read is cast to `void` and isolated in this helper so optimizers
 * cannot eliminate it as a dead access. The function is a no-op when
 * `element` is `null` or `undefined`, which keeps callers free of guards in
 * environments where the container element may not yet be attached.
 *
 * @param element - The element whose layout should be flushed. `null` is ignored.
 */
export function forceReflow(element: HTMLElement | null | undefined): void {
    if (!element) return;
    // One-shot read of `offsetWidth` is the documented way to flush layout
    // synchronously. `void` ensures the value is observed by the engine
    // without being assigned anywhere the optimizer might treat as dead.
    void element.offsetWidth;
}
