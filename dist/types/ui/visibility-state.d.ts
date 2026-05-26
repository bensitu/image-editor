/**
 * @file visibility-state.ts
 * @description Placeholder/canvas-container visibility helper. Owns the
 *              standard-DOM-state transition that the orchestrator's
 *              private `_setPlaceholderVisible` method delegates to.
 *
 * ## Owned contracts
 *
 * - `setPlaceholderVisible(..., true)` SHALL set the
 *   placeholder's `hidden` to `false` and `aria-hidden` to `'false'`, and
 *   SHALL set the canvas container's `hidden` to `true` and `aria-hidden`
 *   to `'true'`.
 * - `setPlaceholderVisible(..., false)` SHALL set the
 *   placeholder's `hidden` to `true` and `aria-hidden` to `'true'`, and
 *   SHALL set the canvas container's `hidden` to `false` and `aria-hidden`
 *   to `'false'`.
 * - This module SHALL NOT add or remove the
 *   Bootstrap `d-none` class on either element. The host page is free to
 *   style `[hidden]` however it likes; the editor stays out of utility-class
 *   territory so it works with or without Bootstrap.
 * - When `containerElement` is `null`, the
 *   placeholder's `hidden` and `aria-hidden` SHALL still be updated
 *   correctly. A missing container is a partial-DOM scenario, not a fatal
 *   error.
 *
 * ## Why this lives in its own module
 *
 * The helper uses standard DOM state instead of Bootstrap utility classes so
 * the editor works with or without a host stylesheet. Keeping the transition
 * here makes the orchestrator's private method a one-line delegate and keeps
 * the behavior unit-testable in isolation. This module is imported by
 * `image-editor.ts` only and is intentionally not re-exported from
 * `src/index.ts`.
 */
/**
 * Toggle placeholder/canvas-container visibility using only standard DOM
 * state. The function is total: it never throws on null inputs and never
 * touches utility classes.
 *
 * Visibility semantics:
 *
 * - `show === true` means **show the placeholder** (and therefore hide the
 *   canvas container). The placeholder is the "no image yet" affordance, so
 *   showing it implies the live canvas is not the right thing to render.
 * - `show === false` means **hide the placeholder** (and therefore show the
 *   canvas container). This is the post-`loadImage` steady state.
 *
 * In both branches the function:
 *
 * 1. Sets the DOM `hidden` property. Using the
 *    property — not the attribute — keeps the IDL flag and the reflected
 *    attribute in sync without an extra `setAttribute` call.
 * 2. Sets `aria-hidden` to the matching string so assistive technology
 *    tracks the visual state.
 * 3. Leaves every other class and inline style untouched. In particular,
 *    Bootstrap's `d-none` is never added or removed,
 *    which lets the editor coexist with host pages that use `d-none` for
 *    their own purposes.
 *
 * When `containerElement` is `null` (partial DOM, or a host page that does
 * not wrap the canvas in a dedicated container), the placeholder side of
 * the transition still runs to completion. When
 * `placeholderElement` is `null` the function is a no-op for that side; the
 * orchestrator's `_updatePlaceholderStatus` already early-returns in that
 * case, but defending here keeps the helper safe to call from any future
 * code path.
 *
 * @param placeholderElement
 *   The placeholder DOM element shown when no image is loaded, or `null`
 *   when the host page omitted the placeholder slot from the `idMap`.
 * @param containerElement
 *   The canvas container DOM element wrapping the live `<canvas>`, or
 *   `null` when no container is available.
 * @param show
 *   `true` to make the placeholder visible (and hide the canvas container);
 *   `false` to hide the placeholder (and show the canvas container).
 */
export declare function setPlaceholderVisible(placeholderElement: HTMLElement | null, containerElement: HTMLElement | null, show: boolean): void;
//# sourceMappingURL=visibility-state.d.ts.map