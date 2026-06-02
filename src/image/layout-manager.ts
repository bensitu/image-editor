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
 *   - it reads `clientWidth` / `clientHeight` and compensates for
 *     pre-existing auto scrollbars without any `overflow` toggle.
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

export function detectLayoutConflict(options: LayoutFlags): LayoutConflict | null {
    if (!options.fitImageToCanvas || !options.coverImageToCanvas) return null;
    const enabled: LayoutStrategy[] = ['fit', 'cover'];
    if (options.expandCanvasToImage) enabled.push('expand');
    const selected = selectLayoutStrategy(options);
    return {
        enabled,
        selected,
        message:
            `Layout flags ${enabled.map((s) => `\`${s}\``).join(', ')} are enabled simultaneously. ` +
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
        scrollbarSize?: Partial<ScrollbarSize> | null,
    ): ViewportSize {
        if (!container) return fallback;
        const containerWidth = Math.floor(container.clientWidth);
        const containerHeight = Math.floor(container.clientHeight);
        if (containerWidth > 0 && containerHeight > 0) {
            this.lastVisible = measureContainerViewport(container, fallback, scrollbarSize);
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

const OVERFLOW_EPSILON = 0.5;

function normalizeOverflowValue(value: unknown): string {
    return String(value ?? '')
        .trim()
        .toLowerCase();
}

function getContainerOverflowValues(container: HTMLElement): {
    x: string[];
    y: string[];
    all: string[];
} {
    const style = container.style;
    let computedOverflow = '';
    let computedOverflowX = '';
    let computedOverflowY = '';
    const view =
        container.ownerDocument?.defaultView ?? (typeof window === 'undefined' ? null : window);

    if (typeof view?.getComputedStyle === 'function') {
        const computed = view.getComputedStyle(container);
        computedOverflow = computed.overflow;
        computedOverflowX = computed.overflowX;
        computedOverflowY = computed.overflowY;
    }

    const x = [
        normalizeOverflowValue(style?.overflow),
        normalizeOverflowValue(style?.overflowX),
        normalizeOverflowValue(computedOverflow),
        normalizeOverflowValue(computedOverflowX),
    ];
    const y = [
        normalizeOverflowValue(style?.overflow),
        normalizeOverflowValue(style?.overflowY),
        normalizeOverflowValue(computedOverflow),
        normalizeOverflowValue(computedOverflowY),
    ];

    return { x, y, all: [...x, ...y] };
}

function isAutoScrollableOverflow(value: string): boolean {
    return value === 'auto' || value === 'overlay';
}

/**
 * Measure the browser's native scrollbar gutter. Overlay-scrollbar
 * environments legitimately return zero on one or both axes.
 */
export function measureScrollbarSize(ownerDocument?: Document | null): ScrollbarSize {
    const doc = ownerDocument ?? (typeof document === 'undefined' ? null : document);
    if (!doc?.body) return { width: 0, height: 0 };

    const probe = doc.createElement('div');
    probe.style.position = 'absolute';
    probe.style.left = '-9999px';
    probe.style.top = '-9999px';
    probe.style.width = '100px';
    probe.style.height = '100px';
    probe.style.overflow = 'scroll';
    probe.style.visibility = 'hidden';
    probe.style.pointerEvents = 'none';

    doc.body.appendChild(probe);
    const width = Math.max(0, probe.offsetWidth - probe.clientWidth);
    const height = Math.max(0, probe.offsetHeight - probe.clientHeight);
    probe.remove();

    return { width, height };
}

function normalizeScrollbarSize(scrollbarSize?: Partial<ScrollbarSize> | null): ScrollbarSize {
    return {
        width: Math.max(0, Number(scrollbarSize?.width) || 0),
        height: Math.max(0, Number(scrollbarSize?.height) || 0),
    };
}

/**
 * Measure the full layout viewport represented by the canvas container.
 *
 * In `overflow: auto` containers, `clientWidth` / `clientHeight` can already
 * be reduced by scrollbars left over from the previous canvas size. v1.4.2
 * avoided using that reduced viewport by adding the gutter back before the
 * next Cover/Fit calculation. v2 keeps the same recovery rule without
 * mutating `style.overflow`.
 */
export function measureContainerViewport(
    container: HTMLElement | null,
    fallback: ViewportSize,
    scrollbarSize?: Partial<ScrollbarSize> | null,
): ViewportSize {
    if (!container) return fallback;

    const clientWidth = Math.floor(container.clientWidth || 0);
    const clientHeight = Math.floor(container.clientHeight || 0);
    if (clientWidth <= 0 || clientHeight <= 0) return fallback;

    const overflow = getContainerOverflowValues(container);
    if (overflow.all.includes('scroll')) {
        return { width: clientWidth, height: clientHeight };
    }

    const scrollbar = normalizeScrollbarSize(scrollbarSize);
    const canAutoScrollX = overflow.x.some(isAutoScrollableOverflow);
    const canAutoScrollY = overflow.y.some(isAutoScrollableOverflow);
    const scrollWidth = Math.ceil(container.scrollWidth || 0);
    const scrollHeight = Math.ceil(container.scrollHeight || 0);
    const hasHorizontalScrollbar = canAutoScrollX && scrollWidth > clientWidth + OVERFLOW_EPSILON;
    const hasVerticalScrollbar = canAutoScrollY && scrollHeight > clientHeight + OVERFLOW_EPSILON;

    return {
        width: clientWidth + (hasVerticalScrollbar ? scrollbar.width : 0),
        height: clientHeight + (hasHorizontalScrollbar ? scrollbar.height : 0),
    };
}

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
export function computeScrollableCanvasSize(
    contentWidth: number,
    contentHeight: number,
    viewport: ViewportSize,
    scrollbarSize?: Partial<ScrollbarSize> | null,
): ViewportSize {
    const viewportW = Math.max(1, viewport.width || 1);
    const viewportH = Math.max(1, viewport.height || 1);
    const scrollbar = normalizeScrollbarSize(scrollbarSize);

    let hasHorizontal = false;
    let hasVertical = false;

    for (let i = 0; i < 4; i += 1) {
        const effectiveW = Math.max(1, viewportW - (hasVertical ? scrollbar.width : 0));
        const effectiveH = Math.max(1, viewportH - (hasHorizontal ? scrollbar.height : 0));
        const nextHorizontal = contentWidth > effectiveW + OVERFLOW_EPSILON;
        const nextVertical = contentHeight > effectiveH + OVERFLOW_EPSILON;

        if (nextHorizontal === hasHorizontal && nextVertical === hasVertical) break;
        hasHorizontal = nextHorizontal;
        hasVertical = nextVertical;
    }

    const effectiveW = Math.max(1, viewportW - (hasVertical ? scrollbar.width : 0));
    const effectiveH = Math.max(1, viewportH - (hasHorizontal ? scrollbar.height : 0));

    return {
        width: hasHorizontal ? Math.ceil(contentWidth) : effectiveW,
        height: hasVertical ? Math.ceil(contentHeight) : effectiveH,
    };
}

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
export function computeFitLayout(
    imageWidth: number,
    imageHeight: number,
    optionsCanvasWidth: number,
    optionsCanvasHeight: number,
    containerSize: ViewportSize,
): LayoutResult {
    const canvasWidth = Math.max(1, (containerSize.width || optionsCanvasWidth) - 1);
    const canvasHeight = Math.max(1, (containerSize.height || optionsCanvasHeight) - 1);
    const fitScale = Math.min(canvasWidth / imageWidth, canvasHeight / imageHeight, 1);
    return {
        canvasWidth,
        canvasHeight,
        imageScale: fitScale,
        imageLeft: 0,
        imageTop: 0,
        baseImageScale: fitScale,
    };
}

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
export function computeCoverLayout(
    imageWidth: number,
    imageHeight: number,
    optionsCanvasWidth: number,
    optionsCanvasHeight: number,
    containerSize: ViewportSize,
    scrollbarSize?: Partial<ScrollbarSize> | null,
): LayoutResult {
    const viewportW = containerSize.width || optionsCanvasWidth;
    const viewportH = containerSize.height || optionsCanvasHeight;
    const scrollbar = normalizeScrollbarSize(scrollbarSize);

    let hasHorizontal = false;
    let hasVertical = false;
    let coverScale = 1;
    let scaledW = imageWidth;
    let scaledH = imageHeight;

    for (let i = 0; i < 4; i += 1) {
        const effectiveW = Math.max(1, viewportW - (hasVertical ? scrollbar.width : 0));
        const effectiveH = Math.max(1, viewportH - (hasHorizontal ? scrollbar.height : 0));
        coverScale = Math.min(1, Math.max(effectiveW / imageWidth, effectiveH / imageHeight));
        scaledW = imageWidth * coverScale;
        scaledH = imageHeight * coverScale;

        const nextHasHorizontal = scaledW > effectiveW + OVERFLOW_EPSILON;
        const nextHasVertical = scaledH > effectiveH + OVERFLOW_EPSILON;

        if (nextHasHorizontal === hasHorizontal && nextHasVertical === hasVertical) break;
        hasHorizontal = nextHasHorizontal;
        hasVertical = nextHasVertical;
    }

    const canvasSize = computeScrollableCanvasSize(
        scaledW,
        scaledH,
        {
            width: viewportW,
            height: viewportH,
        },
        scrollbar,
    );
    return {
        canvasWidth: canvasSize.width,
        canvasHeight: canvasSize.height,
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
    const canvasWidth = Math.max(containerSize.width, Math.floor(imageWidth));
    const canvasHeight = Math.max(containerSize.height, Math.floor(imageHeight));
    return {
        canvasWidth,
        canvasHeight,
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
    const integerWidth = Math.max(1, Math.round(Number(width) || 1));
    const integerHeight = Math.max(1, Math.round(Number(height) || 1));
    canvas.setDimensions({ width: integerWidth, height: integerHeight });
    forceReflow(containerElement);
}
