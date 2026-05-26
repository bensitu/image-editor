/**
 * @file image/layout-manager.ts
 * @module image/layout-manager
 * @description
 *   Pure layout helpers and a small viewport cache used by the
 *   `image-loader` pipeline. The layout manager owns three concerns
 *   used by the image-load pipeline:
 *
 *   1. Selecting exactly one layout strategy per load using the
 *      precedence `fit > cover > expand`.
 *   2. Computing canvas dimensions and image scale for the selected
 *      strategy.
 *   3. Measuring the visible container viewport with a hidden-tab cache
 *      and a final fall-back to `options.canvasWidth/canvasHeight`.
 *
 *   The module also exposes a single sizing primitive,
 *   `applyCanvasDimensions`, which is the only place in the editor
 *   that calls `Canvas.setDimensions`. It rounds to integer pixels
 *   and forces a synchronous reflow on the container so that auto
 *   scrollbars settle before the next paint.
 *
 *   The layout manager intentionally
 *   does NOT mutate developer CSS:
 *   - it never touches `canvas.style` or `container.style`
 *     (`width`, `height`, `display`, `overflow`),
 *   - it relies on `clientWidth` / `clientHeight` for measurements,
 *     which already exclude pre-existing auto scrollbars without any
 *     `overflow` toggle.
 */

import type * as FabricNS from 'fabric';
import type { ResolvedOptions } from '../core/public-types.js';
import { forceReflow } from '../utils/dom.js';

// ─── Strategy selection ──────────────────────────────────────────────────────

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
export type LayoutFlags = Pick<
    ResolvedOptions,
    'fitImageToCanvas' | 'coverImageToCanvas' | 'expandCanvasToImage'
>;

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
export function selectLayoutStrategy(options: LayoutFlags): LayoutStrategy {
    if (options.fitImageToCanvas) return 'fit';
    if (options.coverImageToCanvas) return 'cover';
    // expandCanvasToImage is the default; covers the all-false fallback too.
    return 'expand';
}

/**
 * Inspect the layout flags and report whether `fitImageToCanvas` and
 * `coverImageToCanvas` are both enabled — the only pairing that is a
 * real conflict because both rescale the image to the canvas viewport
 * but with different aspect-ratio strategies. `expandCanvasToImage`
 * defaults to `true`, so combining it with one of the other two is
 * normal usage (the user opts into a per-load override) and is not
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

export function detectLayoutConflict(
    options: LayoutFlags,
): LayoutConflict | null {
    if (!options.fitImageToCanvas || !options.coverImageToCanvas) return null;
    const enabled: LayoutStrategy[] = ['fit', 'cover'];
    if (options.expandCanvasToImage) enabled.push('expand');
    const selected = selectLayoutStrategy(options);
    return {
        enabled,
        selected,
        message:
            `Layout flags ${enabled.map(s => `\`${s}\``).join(', ')} are enabled simultaneously. ` +
            `Using precedence \`fit > cover > expand\`; selected \`${selected}\`.`,
    };
}

// ─── Viewport measurement and caching ────────────────────────────────────────

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
 * Measurements use `clientWidth` / `clientHeight`, which already
 * exclude space occupied by pre-existing auto scrollbars. This lets
 * the layout manager compensate for scrollbar width without mutating
 * the container's `overflow` style.
 *
 */
export class ViewportCache {
    private lastVisible: ViewportSize | null = null;

    /**
     * Measure the visible viewport for `container`, caching the result
     * when both axes are non-zero. When either axis is zero, return the
     * cached value if one exists, otherwise the supplied `fallback`.
     *
     * `null` containers (no element attached) yield the fallback
     * directly; the cache is left untouched.
     *
     * @param container The scrollable wrapper around the canvas, or
     *                  `null` if no container has been resolved.
     * @param fallback  The size to use when no live measurement and no
     *                  cached measurement is available. Callers should
     *                  pass `(options.canvasWidth, options.canvasHeight)`.
     */
    measure(
        container: HTMLElement | null,
        fallback: ViewportSize,
    ): ViewportSize {
        if (!container) return fallback;
        // `clientWidth` / `clientHeight` already exclude any visible
        // scrollbar gutter, so no `overflow` mutation is needed
        //.
        const cw = Math.floor(container.clientWidth);
        const ch = Math.floor(container.clientHeight);
        if (cw > 0 && ch > 0) {
            this.lastVisible = { width: cw, height: ch };
            return this.lastVisible;
        }
        return this.lastVisible ?? fallback;
    }

    /**
     * Return the cached viewport size without re-measuring. Useful for
     * tests and for diagnostic logging. `null` indicates no non-zero
     * measurement has been observed yet.
     */
    peek(): ViewportSize | null {
        return this.lastVisible;
    }

    /**
     * Discard the cached measurement. Intended for `dispose` paths.
     * Calling `measure` again after `clear` behaves as if the editor
     * has just been instantiated.
     */
    clear(): void {
        this.lastVisible = null;
    }
}

// ─── Layout computation ──────────────────────────────────────────────────────

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
 * Compute layout for the `fit` strategy.
 *
 * The canvas is set to the smaller of `(options.canvasWidth/Height)`
 * and the visible container viewport, minus one pixel per axis to
 * leave room for any sub-pixel rounding error and avoid tripping the
 * container's auto scrollbars. The image is uniformly scaled down to
 * fit, but never up (`Math.min(..., 1)`).
 *
 */
export function computeFitLayout(
    imageWidth: number,
    imageHeight: number,
    optionsCanvasWidth: number,
    optionsCanvasHeight: number,
    containerSize: ViewportSize,
): LayoutResult {
    const cw = Math.max(
        1,
        Math.min(optionsCanvasWidth, containerSize.width) - 1,
    );
    const ch = Math.max(
        1,
        Math.min(optionsCanvasHeight, containerSize.height) - 1,
    );
    const fitScale = Math.min(cw / imageWidth, ch / imageHeight, 1);
    return {
        canvasWidth: cw,
        canvasHeight: ch,
        imageScale: fitScale,
        imageLeft: 0,
        imageTop: 0,
        baseImageScale: fitScale,
    };
}

/**
 * Compute layout for the `cover` strategy.
 *
 * The canvas is sized to the visible container viewport (with a final
 * fall-back to the configured canvas dimensions if a viewport axis is
 * zero — the {@link ViewportCache} normally prevents this from
 * happening). The image scale is `max(cw / imgW, ch / imgH)` with
 * **no** upper cap, so an image smaller than the canvas is scaled up
 * until it covers both axes.
 *
 */
export function computeCoverLayout(
    imageWidth: number,
    imageHeight: number,
    optionsCanvasWidth: number,
    optionsCanvasHeight: number,
    containerSize: ViewportSize,
): LayoutResult {
    // Canvas tracks the visible viewport, not Math.max(viewport,
    // optionsCanvas...) — using the larger value would push the canvas
    // wider than the container and create scrollbars with almost-zero
    // scroll range.
    const cw = containerSize.width || optionsCanvasWidth;
    const ch = containerSize.height || optionsCanvasHeight;
    // No `Math.min(..., 1)` cap: cover MUST be allowed to grow the image
    // when it is smaller than the canvas.
    const coverScale = Math.max(cw / imageWidth, ch / imageHeight);
    return {
        canvasWidth: cw,
        canvasHeight: ch,
        imageScale: coverScale,
        imageLeft: 0,
        imageTop: 0,
        baseImageScale: coverScale,
    };
}

/**
 * Compute layout for the `expand` strategy.
 *
 * The canvas grows per-axis to `max(viewport, image)` and the image is
 * placed at `(0, 0)` at its native size. `baseImageScale` is `1` to
 * preserve the image's natural aspect ratio and top-left placement.
 *
 */
export function computeExpandLayout(
    imageWidth: number,
    imageHeight: number,
    _optionsCanvasWidth: number,
    _optionsCanvasHeight: number,
    containerSize: ViewportSize,
): LayoutResult {
    const cw = Math.max(containerSize.width, Math.floor(imageWidth));
    const ch = Math.max(containerSize.height, Math.floor(imageHeight));
    return {
        canvasWidth: cw,
        canvasHeight: ch,
        imageScale: 1,
        imageLeft: 0,
        imageTop: 0,
        baseImageScale: 1,
    };
}

// ─── Canvas dimension application ────────────────────────────────────────────

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
 * @param canvas      The Fabric canvas to resize. Required.
 * @param width       Target pixel width. Clamped to `>= 1` and rounded.
 * @param height      Target pixel height. Clamped to `>= 1` and rounded.
 * @param containerElement The wrapper element to reflow. May be `null`
 *                         when no container has been resolved; in that
 *                         case the reflow is skipped without error.
 */
export function applyCanvasDimensions(
    canvas: FabricNS.Canvas,
    width: number,
    height: number,
    containerElement: HTMLElement | null,
): void {
    const iw = Math.max(1, Math.round(Number(width) || 1));
    const ih = Math.max(1, Math.round(Number(height) || 1));
    canvas.setDimensions({ width: iw, height: ih });
    forceReflow(containerElement);
}
