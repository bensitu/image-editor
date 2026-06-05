/**
 * Pure layout helpers and a small viewport cache used by the
 * `image-loader` pipeline. The layout manager owns three concerns
 * used by the image-load pipeline:
 *
 * 1. Selecting exactly one layout strategy per load using the
 *    precedence `fit > cover > expand`.
 * 2. Computing canvas dimensions and image scale for the selected
 *    strategy.
 * 3. Measuring the visible container viewport with a hidden-tab cache
 *    and a final fall-back to `options.canvasWidth/canvasHeight`.
 *
 * The module also exposes a single sizing primitive,
 * `applyCanvasDimensions`, which is the only place in the editor
 * that calls `Canvas.setDimensions`. It rounds to integer pixels
 * and forces a synchronous reflow on the container so that auto
 * scrollbars settle before the next paint.
 *
 * The layout manager intentionally
 * does NOT mutate developer CSS:
 * - it never touches `canvas.style` or `container.style`
 *   (`width`, `height`, `display`, `overflow`),
 * - it reads `clientWidth` / `clientHeight` and compensates for
 *   pre-existing auto scrollbars without any `overflow` toggle.
 *
 * @module
 */
import type * as FabricNS from 'fabric';
import type { ResolvedOptions } from '../core/public-types.js';
/**
 * Discriminator for the active layout strategy. Exactly one value is
 * returned by {@link selectLayoutStrategy} per `loadImage` call.
 */
export type LayoutStrategy = 'fit' | 'cover' | 'expand';
/**
 * Subset of {@link ResolvedOptions} consumed by strategy selection.
 *
 * The accepted boolean flags in precedence order are
 * `fitImageToCanvas`, `coverImageToCanvas`, and `expandCanvasToImage`.
 */
export type LayoutFlags = Pick<ResolvedOptions, 'fitImageToCanvas' | 'coverImageToCanvas' | 'expandCanvasToImage'>;
/**
 * Choose the active layout strategy using the documented precedence
 * `fit > cover > expand`.
 *
 * The selection is a pure function of the boolean flags — it is
 * independent of the order in which the option keys were declared,
 * of any prior load, and of any prior canvas state.
 *
 * When all three flags are `false` the function falls back to
 * `'expand'`. This matches the default-options resolution which sets
 * `expandCanvasToImage: true` by default, and gives a deterministic
 * answer even if a consumer disables every layout flag.
 *
 */
export declare function selectLayoutStrategy(options: LayoutFlags): LayoutStrategy;
/**
 * Inspect the layout flags and report whether `fitImageToCanvas` and
 * `coverImageToCanvas` are both enabled — the only pairing that is a
 * real conflict because both rescale the image to the canvas viewport
 * but with different aspect-ratio strategies. `expandCanvasToImage`
 * defaults to `true`, so combining it with one of the other two is
 * normal usage (the user providedOptions into a per-load override) and is not
 * flagged.
 *
 * The selected strategy still follows the precedence in
 * {@link selectLayoutStrategy}; this helper exists so the facade can
 * emit a single warning through the documented reporting path when a
 * real conflict is detected.
 *
 * `null` is returned when no conflict is present.
 */
export interface LayoutConflict {
    /** Strategies the caller had enabled simultaneously. */
    readonly enabled: readonly LayoutStrategy[];
    /** The strategy actually selected by `selectLayoutStrategy`. */
    readonly selected: LayoutStrategy;
    /** Human-readable summary suitable for `onWarning` consumers. */
    readonly message: string;
}
export declare function detectLayoutConflict(options: LayoutFlags): LayoutConflict | null;
/**
 * Two-axis viewport size in CSS pixels.
 *
 * Both axes are non-negative integers. `0` is permitted in transient
 * states (e.g. before the editor is attached) but {@link ViewportCache}
 * treats any axis of `0` as "hidden" and falls back to a cached or
 * default value.
 */
export interface ViewportSize {
    width: number;
    height: number;
}
/** Native scrollbar gutter size in CSS pixels. */
export type ScrollbarSize = ViewportSize;
export type OverflowAxis = 'horizontal' | 'vertical';
/**
 * Hidden-container viewport cache.
 *
 * The editor often runs inside a tab, modal, or accordion that starts
 * collapsed. A naive `clientWidth` read in that state returns `0` and
 * collapses the canvas. The cache remembers the last non-zero
 * measurement and reuses it while the container reports a zero
 * dimension on either axis. When no non-zero
 * measurement has been observed yet, the caller-supplied fallback —
 * normally `(options.canvasWidth, options.canvasHeight)` — is used
 * instead. When the container becomes visible
 * again, the next `measure` call updates the cache so subsequent
 * sizing decisions reflect the new viewport.
 *
 * Measurements compensate for pre-existing auto scrollbars by adding
 * the scrollbar gutter back to the visible client size. This mirrors
 * v1.4.2's viewport recovery while still preserving v2's rule that
 * layout code never mutates the container's `overflow` style.
 *
 */
export declare class ViewportCache {
    private lastVisible;
    /**
     * Measure the visible viewport for `container`, caching the result
     * when both axes are non-zero. When either axis is zero, return the
     * cached value if one exists, otherwise the supplied `fallback`.
     *
     * `null` containers (no element attached) yield the fallback
     * directly; the cache is left untouched.
     *
     * @param container - The scrollable wrapper around the canvas, or
     *                  `null` if no container has been resolved.
     * @param fallback - The size to use when no live measurement and no
     *                  cached measurement is available. Callers should
     *                  pass `(options.canvasWidth, options.canvasHeight)`.
     */
    measure(container: HTMLElement | null, fallback: ViewportSize, scrollbarSize?: Partial<ScrollbarSize> | null): ViewportSize;
    /**
     * Return the cached viewport size without re-measuring. Useful for
     * tests and for diagnostic logging. `null` indicates no non-zero
     * measurement has been observed yet.
     */
    peek(): ViewportSize | null;
    /**
     * Discard the cached measurement. Intended for `dispose` paths.
     * Calling `measure` again after `clear` behaves as if the editor
     * has just been instantiated.
     */
    clear(): void;
}
/**
 * Result of a layout computation. The image-loader applies these
 * values to the Fabric canvas and the image object after a successful
 * decode and Fabric load.
 *
 * `imageScale` is the Fabric `scaleX/scaleY` value that produces the
 * desired on-canvas size for the image. `baseImageScale` is the
 * editor's anchor scale used when computing zoom factors — see
 * `image/transform-controller.ts` for how it is consumed.
 */
export interface LayoutResult {
    canvasWidth: number;
    canvasHeight: number;
    imageScale: number;
    imageLeft: number;
    imageTop: number;
    baseImageScale: number;
}
/**
 * Measure the browser's native scrollbar gutter. Overlay-scrollbar
 * environments legitimately return zero on one or both axes.
 */
export declare function measureScrollbarSize(ownerDocument?: Document | null): ScrollbarSize;
/**
 * Measure the full layout viewport represented by the canvas container.
 *
 * In `overflow: auto` containers, `clientWidth` / `clientHeight` can already
 * be reduced by scrollbars left over from the previous canvas size. v1.4.2
 * avoided using that reduced viewport by adding the gutter back before the
 * next Cover/Fit calculation. v2 keeps the same recovery rule without
 * mutating `style.overflow`.
 */
export declare function measureContainerViewport(container: HTMLElement | null, fallback: ViewportSize, scrollbarSize?: Partial<ScrollbarSize> | null): ViewportSize;
/**
 * Compute canvas dimensions for content that may overflow the visible
 * viewport.
 *
 * An overflowing axis grows to the content size, while a non-overflowing
 * axis uses the viewport space left after the perpendicular scrollbar
 * gutter is accounted for. This keeps Cover/Fit from accidentally creating
 * a second scrollbar solely because the first scrollbar reduced the cross
 * axis client size.
 */
export declare function computeScrollableCanvasSize(contentWidth: number, contentHeight: number, viewport: ViewportSize, scrollbarSize?: Partial<ScrollbarSize> | null): ViewportSize;
/**
 * Compute layout for the `fit` strategy.
 *
 * The canvas is set to the visible container viewport, falling back to
 * `(options.canvasWidth/Height)` only when no viewport measurement is
 * available, minus one pixel per axis to leave room for any sub-pixel
 * rounding error and avoid tripping the container's auto scrollbars.
 * The image is uniformly scaled down to fit, but never up
 * (`Math.min(..., 1)`).
 *
 */
export declare function computeFitLayout(imageWidth: number, imageHeight: number, optionsCanvasWidth: number, optionsCanvasHeight: number, containerSize: ViewportSize): LayoutResult;
/**
 * Compute layout for the `cover` strategy.
 *
 * The visible viewport determines the cover target (with a final fall-back
 * to the configured canvas dimensions if a viewport axis is zero — the
 * {@link ViewportCache} normally prevents this from happening). Large
 * images are scaled down until Cover fills one axis without upscaling small
 * images. When the filled axis would need a scrollbar, the scale is
 * recomputed against the cross-axis space left after that scrollbar appears;
 * this preserves the Cover invariant that at least one axis stays scroll-free.
 *
 */
export declare function computeCoverLayout(imageWidth: number, imageHeight: number, optionsCanvasWidth: number, optionsCanvasHeight: number, containerSize: ViewportSize, scrollbarSize?: Partial<ScrollbarSize> | null): LayoutResult;
/**
 * Compute layout for the `expand` strategy.
 *
 * The canvas grows per-axis to `max(viewport, image)` and the image is
 * placed at `(0, 0)` at its native size. `baseImageScale` is `1` to
 * preserve the image's natural aspect ratio and top-left placement.
 *
 */
export declare function computeExpandLayout(imageWidth: number, imageHeight: number, optionsCanvasWidth: number, optionsCanvasHeight: number, containerSize: ViewportSize): LayoutResult;
/**
 * Apply canvas pixel dimensions atomically and force a synchronous
 * reflow on the container.
 *
 * In Fabric.js v7 the canvas is a pair of `<canvas>` elements
 * (`lowerCanvasEl` for rendering, `upperCanvasEl` for pointer events).
 * `Canvas.setDimensions` is the only API that updates both layers
 * atomically and keeps their CSS in sync. Manually mutating
 * Direct canvas element style writes only resize the lower layer and
 * misaligns the upper layer's hit-test regions, so the editor always
 * routes through this helper instead of touching the canvas element
 * styles.
 *
 * After `setDimensions`, the container is reflowed by reading
 * `offsetWidth` (see `utils/dom.ts → forceReflow`). This makes
 * `overflow: auto` containers show or hide their scrollbars before
 * the next paint instead of waiting for the following frame.
 *
 * The `width` and `height` arguments are clamped to a minimum of `1`
 * and rounded to integer pixels. Non-finite or non-numeric inputs
 * collapse to `1` rather than crashing the editor.
 *
 * @param canvas - The Fabric canvas to resize. Required.
 * @param width - Target pixel width. Clamped to `>= 1` and rounded.
 * @param height - Target pixel height. Clamped to `>= 1` and rounded.
 * @param containerElement - The wrapper element to reflow. May be `null`
 *                         when no container has been resolved; in that
 *                         case the reflow is skipped without error.
 */
export declare function applyCanvasDimensions(canvas: FabricNS.Canvas, width: number, height: number, containerElement: HTMLElement | null): void;
//# sourceMappingURL=layout-manager.d.ts.map