/**
 * @file image/image-loader.ts
 * @description Transactional `loadImage` pipeline. Validates the input,
 *              snapshots every field that the pipeline is about to mutate
 *              into a {@link RollbackBundle}, decodes the data URL into an
 *              `HTMLImageElement` under the configured timeout, optionally
 *              downsamples via {@link resampleImage}, awaits
 *              `FabricImage.fromURL` under the same timeout, applies the
 *              layout strategy chosen by `image/layout-manager.ts`, commits
 *              the new image to the canvas, and emits a fresh
 *              `_lastSnapshot` via `core/state-serializer.ts`. Any failure
 *              between the snapshot and the commit replays the bundle and
 *              rejects with the original error.
 *
 * ## Owned contracts
 *
 * - When `loadImage` rejects, the original error is
 *   routed through the public `onError(error, message)` callback via
 *   `core/callback-reporter.ts → reportError`, AFTER `replayRollback` has
 *   restored editor state. Callback exceptions are caught and logged so a
 *   faulty integrator callback cannot mask the original error that the
 *   loader re-throws. The success path does NOT invoke `onError`.
 * - Strings that do not start with `data:image/`
 *   resolve without mutating placeholder visibility, scroll position,
 *   `overflow`, image state, or canvas state. The function returns before
 *   capturing the rollback bundle, so no observable side effect occurs.
 * - On a valid `data:image/` URL, the loader captures
 *   the rollback bundle *before* mutating any of the fields it tracks
 *   (placeholder `hidden`, container `scrollTop`/`scrollLeft`, container
 *   inline `overflow`, `originalImage`, `_lastSnapshot`, the canvas JSON
 *   snapshot, plus the editor transform fields the rollback needs to
 *   restore the live canvas to a consistent state).
 * - Decode, Fabric, downsample, and timeout failures
 *   restore every field captured in the rollback bundle and reject with the
 *   original error.
 * - On success, `isImageLoadedToCanvas` is set to
 *   `true`, `_lastSnapshot` is replaced with a fresh snapshot derived from
 *   the new canvas, and `maskCounter` is reset to `0`.
 * - Either the new image is committed fully, or the
 *   prior committed state is restored fully. No partial state is observable
 *   after the returned promise settles.
 * - Both the decode step and the
 *   `FabricImage.fromURL` step are bounded by `options.imageLoadTimeoutMs`
 *   via {@link withTimeout}.
 * - Timeout failures reject with
 *   {@link ImageLoadTimeoutError} (built by `utils/timeout.ts`) and replay
 *   the rollback bundle.
 * - The 2D-context failure inside
 *   {@link resampleImage} surfaces as {@link DownsampleError}; the loader
 *   catches it and routes through the rollback path.
 * - On success, `maskCounter` is reset to `0`.
 *
 * ## Design notes
 *
 * The loader is an exported **function** that takes its dependencies in a
 * {@link LoadImageContext} parameter rather than a class. The `ImageEditor`
 * facade owns all editor state (the canvas reference, the placeholder
 * element, the editor scalar fields), so the loader must read and write
 * that state through a small set of getter/setter callbacks. The class
 * shape of v1 was a side effect of the monolith; v2 keeps the loader
 * stateless so the rollback bundle is the single source of truth for what
 * the operation has captured.
 *
 * The rollback bundle is built before the loader hides the placeholder or
 * touches the canvas. It captures *every* field listed in the design's
 * RollbackBundle definition plus the editor scalar fields
 * (`isImageLoadedToCanvas`, `maskCounter`, `currentScale`,
 * `currentRotation`, `baseImageScale`) the success path mutates. Restoring
 * those scalars is required for atomic rollback — without them, a failed
 * load that ran past the scalar reset would leave the editor with
 * `currentScale = 1` and `currentRotation = 0` even though
 * `originalImage` (and therefore the live canvas) had been rewound to the
 * previous image.
 *
 * `preserveScroll` is honored on both the success path
 * and the rollback path. On success it is conditional on
 * `loadOptions.preserveScroll === true`; on rollback the bundle is replayed
 * unconditionally, which the rollback contract already requires for
 * transactional rewind. When `preserveScroll` is omitted or `false`, the
 * success path leaves the container scroll untouched, so v1's documented
 * scroll/viewport behavior for the selected layout mode prevails.
 *
 * `onImageLoaded` is invoked from inside
 * this module exactly once on the success path, AFTER every editor scalar
 * (`originalImage`, `currentScale`, `currentRotation`, `baseImageScale`,
 * `maskCounter`, `_lastSnapshot`) and the optional `preserveScroll`
 * restore have completed. Thrown callback errors are caught and logged,
 * never propagated and never used to mutate editor state. The rollback
 * path skips the callback entirely (failed loads do
 * not fire the callback).
 *
 * Owner module references (per the design's "Mapping requirements to
 * modules" table): this module is the canonical owner of the transactional
 * load helpers. It is NOT re-exported from `src/index.ts`.
 */

import type * as FabricNS from 'fabric';

import type {
    FabricModule,
    LoadImageOptions,
    ResolvedOptions,
} from '../core/public-types.js';
import { reportError} from '../core/callback-reporter.js';
import { ImageDecodeError} from '../core/errors.js';
import { saveState, SNAPSHOT_CUSTOM_KEYS} from '../core/state-serializer.js';
import { withTimeout} from '../utils/timeout.js';
import {
    computeCoverLayout,
    computeExpandLayout,
    computeFitLayout,
    selectLayoutStrategy,
    applyCanvasDimensions,
    type LayoutResult,
    type ViewportCache,
} from './layout-manager.js';
import {
    computeDownsampleDimensions,
    detectSourceMimeType,
    resampleImage,
} from './image-resampler.js';

// ─── Rollback bundle ─────────────────────────────────────────────────────────

/**
 * Snapshot of every field the loader is about to mutate, captured before
 * the first mutation so a failure mid-pipeline can rewind the editor to
 * its pre-call state.
 *
 * Mirrors the design's `RollbackBundle` definition with the addition of
 * the editor scalar fields the success path also rewrites
 * (`isImageLoadedToCanvas`, `maskCounter`, `currentScale`,
 * `currentRotation`, `baseImageScale`). Those scalars must be restored
 * together with the canvas JSON for atomic rewind.
 *
 */
export interface RollbackBundle {
    /** `placeholderEl.hidden` immediately before the loader hid it. */
    placeholderHidden: boolean | null;
    /** Container `scrollTop` immediately before the loader started. */
    containerScrollTop: number | null;
    /** Container `scrollLeft` immediately before the loader started. */
    containerScrollLeft: number | null;
    /** Container inline `style.overflow` value before any mutation. */
    containerOverflow: string | null;
    /** The previously-committed `originalImage` reference, if any. */
    originalImage: FabricNS.FabricImage | null;
    /** Whether an image was already committed before this call. */
    isImageLoadedToCanvas: boolean;
    /** Snapshot string used as the history baseline before the call. */
    lastSnapshot: string | null;
    /**
     * Full canvas JSON serialization captured via `canvas.toJSON` with the
     * editor's custom keys. Restored via `loadFromJSON` on rollback.
     */
    canvasJson: string;
    /** Mask counter value before the loader reset it to 0. */
    maskCounter: number;
    /** Image scale factor before the loader reset it to 1. */
    currentScale: number;
    /** Image rotation in degrees before the loader reset it to 0. */
    currentRotation: number;
    /** Base scale chosen by the previous load, restored on rollback. */
    baseImageScale: number;
}

// ─── Load context ────────────────────────────────────────────────────────────

/**
 * Dependency bundle passed by the `ImageEditor` facade into
 * {@link loadImage}. The loader has no class state of its own — every
 * editor field it reads or writes is exposed here as a getter/setter pair
 * so the facade keeps ownership of the canonical state.
 *
 * The facade is responsible for:
 * - constructing the {@link ViewportCache} once and reusing it across
 *   loads (so hidden-tab fallbacks work),
 * - providing a `setPlaceholderVisible` callback that delegates to
 *   `ui/visibility-state.ts`.
 *
 * The loader itself is responsible for invoking `onImageLoaded` from
 * `ctx.options.onImageLoaded` on the success path. The
 * facade does not need to fire it again.
 */
export interface LoadImageContext {
    /** The Fabric module providing `FabricImage.fromURL`. */
    fabric: FabricModule;
    /** The live Fabric canvas. */
    canvas: FabricNS.Canvas;
    /** Resolved editor options (timeouts, downsample knobs, layout flags). */
    options: ResolvedOptions;
    /** Scrollable container wrapping the canvas, or `null`. */
    containerEl: HTMLElement | null;
    /** Empty-state placeholder element, or `null`. */
    placeholderEl: HTMLElement | null;
    /** Hidden-container viewport cache shared with the layout manager. */
    viewportCache: ViewportCache;

    /** Reads the previously-committed `originalImage`. */
    getOriginalImage(): FabricNS.FabricImage | null;
    /** Writes `originalImage` (used both on commit and on rollback). */
    setOriginalImage(img: FabricNS.FabricImage | null): void;

    /** Reads `isImageLoadedToCanvas`. */
    getIsImageLoadedToCanvas(): boolean;
    /** Writes `isImageLoadedToCanvas`. */
    setIsImageLoadedToCanvas(v: boolean): void;

    /** Reads `_lastSnapshot`. */
    getLastSnapshot(): string | null;
    /** Writes `_lastSnapshot`. */
    setLastSnapshot(s: string | null): void;

    /** Reads `maskCounter`. */
    getMaskCounter(): number;
    /** Writes `maskCounter`. */
    setMaskCounter(n: number): void;

    /** Reads `currentScale`. */
    getCurrentScale(): number;
    /** Writes `currentScale`. */
    setCurrentScale(n: number): void;

    /** Reads `currentRotation`. */
    getCurrentRotation(): number;
    /** Writes `currentRotation`. */
    setCurrentRotation(n: number): void;

    /** Reads `baseImageScale`. */
    getBaseImageScale(): number;
    /** Writes `baseImageScale`. */
    setBaseImageScale(n: number): void;

    /**
     * Toggle placeholder/canvas-container visibility via
     * `ui/visibility-state.ts`. `show === false` means "an image is now on
     * the canvas — hide the placeholder".
     */
    setPlaceholderVisible(show: boolean): void;
}

// ─── loadImage ───────────────────────────────────────────────────────────────

/**
 * Transactional image loader. Loads a base64 data URL onto the Fabric
 * canvas with full rollback on any failure.
 *
 * Steps, in order:
 *
 * 1. **Validate** — non-`data:image/` strings resolve
 *    immediately without capturing the bundle or touching state.
 * 2. **Snapshot** — capture every field the pipeline
 *    will mutate into a {@link RollbackBundle}.
 * 3. **Hide placeholder** — first observable mutation. Restored on
 *    rollback.
 * 4. **Decode** — race the `<img>.onload` against
 *    `imageLoadTimeoutMs` via {@link withTimeout}.
 * 5. **Downsample** — if the source exceeds the
 *    configured bounds, run {@link resampleImage}; a 2D-context failure
 *    surfaces as {@link DownsampleError} and triggers rollback.
 * 6. **Fabric load** — `FabricImage.fromURL` under the
 *    same timeout.
 * 7. **Layout** — pick a strategy via {@link selectLayoutStrategy} and
 *    apply via {@link applyCanvasDimensions}.
 * 8. **Commit** — set `isImageLoadedToCanvas`,
 *    reset `maskCounter` to 0, reset transforms, and emit a fresh
 *    `_lastSnapshot` via {@link saveState}.
 *
 * Any rejection between step 3 and step 8 routes through {@link replayRollback}
 * before re-throwing the original error. On the rollback
 * path, the original error is also dispatched to the public `onError`
 * callback via {@link reportError}; the helper catches
 * and logs callback exceptions so a faulty integrator callback cannot
 * replace the original error that this function re-throws.
 *
 * `preserveScroll` is honored on success when
 * `loadOptions.preserveScroll === true`: after the canvas has been resized
 * and the new image committed, the captured pre-load `scrollTop` and
 * `scrollLeft` are written back to the container. The rollback path always
 * restores scroll regardless of `preserveScroll` because the rollback
 * requires the bundle to be replayed in full on failure. When
 * `preserveScroll` is omitted or `false`, the success path leaves scroll
 * untouched and v1's documented scroll/viewport behavior for the selected
 * layout mode applies.
 *
 * `onImageLoaded` is invoked exactly once at
 * the very end of the success path, after every editor scalar has been
 * committed and after the optional `preserveScroll` restore. Callback
 * exceptions are caught and logged so a defective integrator callback
 * cannot mutate or roll back editor state. The rollback path
 * intentionally does NOT invoke the callback.
 *
 * @param ctx          Editor dependency bundle.
 * @param imageBase64  Base64 data URL to load (`data:image/...;base64...`).
 * @param loadOptions  Public {@link LoadImageOptions}. Currently only
 *                     `preserveScroll` is consulted; defaults to `false`.
 * @returns Resolved promise on success, rejected with the original error
 *          (after rollback) on failure. Non-data:image inputs resolve
 *          without observable mutation.
 *
 */
export async function loadImage(
    ctx: LoadImageContext,
    imageBase64: string,
    loadOptions: LoadImageOptions = {},
): Promise<void> {
    // 1. bail before capturing the bundle or mutating
    //    anything when the input is not a data:image URL.
    if (typeof imageBase64 !== 'string' || !imageBase64.startsWith('data:image/')) {
        return;
}

    // 2. capture the rollback bundle BEFORE the first
    //    mutation. Reads `style.overflow` (NOT computed style) so the
    //    rollback restores the developer's inline value verbatim
    //    (never invent a new inline style).
    const placeholderHidden =
        ctx.placeholderEl ? !!ctx.placeholderEl.hidden : null;
    const containerScrollTop =
        ctx.containerEl ? ctx.containerEl.scrollTop : null;
    const containerScrollLeft =
        ctx.containerEl ? ctx.containerEl.scrollLeft : null;
    const containerOverflow =
        ctx.containerEl ? ctx.containerEl.style.overflow : null;

    const bundle: RollbackBundle = {
        placeholderHidden,
        containerScrollTop,
        containerScrollLeft,
        containerOverflow,
        originalImage: ctx.getOriginalImage(),
        isImageLoadedToCanvas: ctx.getIsImageLoadedToCanvas(),
        lastSnapshot: ctx.getLastSnapshot(),
        canvasJson: serializeCanvas(ctx.canvas),
        maskCounter: ctx.getMaskCounter(),
        currentScale: ctx.getCurrentScale(),
        currentRotation: ctx.getCurrentRotation(),
        baseImageScale: ctx.getBaseImageScale(),
};

    try {
        // 3. First mutation — hide the placeholder via the visibility
        //    helper. The bundle holds the prior value so rollback can
        //    restore it.
        ctx.setPlaceholderVisible(false);

        // 4. decode under the configured timeout.
        const imgEl = await withTimeout(
            decodeImageElement(imageBase64),
            ctx.options.imageLoadTimeoutMs,
            'image decode',
);

        // 5. optionally downsample. The resampler
        //    throws DownsampleError when the offscreen canvas cannot get
        //    a 2D context; the surrounding catch routes that through the
        //    rollback path.
        const loadSrc = maybeDownsample(imgEl, imageBase64, ctx.options);

        // 6. Fabric image creation under the same
        //    timeout. Cross-origin is requested so canvases stay
        //    untainted for export.
        const fimg = await withTimeout(
            ctx.fabric.FabricImage.fromURL(loadSrc, { crossOrigin: 'anonymous'}),
            ctx.options.imageLoadTimeoutMs,
            'FabricImage.fromURL',
);

        // 7. Apply the new image to the canvas. Discard any prior
        //    selection so the active-selection wrapper does not leak
        //    into the new state, then clear the canvas, then add the
        //    image. Background color is reapplied because `clear`
        //    drops it.
        ctx.canvas.discardActiveObject();
        ctx.canvas.clear();
        ctx.canvas.backgroundColor = ctx.options.backgroundColor;

        fimg.set({
            originX: 'left',
            originY: 'top',
            selectable: false,
            evented: false,
});

        const layout = computeLayout(ctx, fimg);
        applyCanvasDimensions(
            ctx.canvas,
            layout.canvasWidth,
            layout.canvasHeight,
            ctx.containerEl,
);
        fimg.set({ left: layout.imageLeft, top: layout.imageTop});
        fimg.scale(layout.imageScale);

        ctx.canvas.add(fimg);
        ctx.canvas.sendObjectToBack(fimg);

        // 8. commit editor scalar state.
        ctx.setOriginalImage(fimg);
        ctx.setBaseImageScale(layout.baseImageScale);
        ctx.setCurrentScale(1);
        ctx.setCurrentRotation(0);
        ctx.setMaskCounter(0);
        ctx.setIsImageLoadedToCanvas(true);

        ctx.canvas.renderAll();

        // emit a fresh `_lastSnapshot` derived from
        // the new canvas state. `saveState` discards any active
        // selection (already done above) and embeds `_editorState` so
        // the next undo has a correct "before" pointer.
        ctx.setLastSnapshot(
            saveState({
                canvas: ctx.canvas,
                currentScale: 1,
                currentRotation: 0,
                baseImageScale: layout.baseImageScale,
}),
);

        // when the caller opted into `preserveScroll`,
        // restore the container scroll position captured before any
        // mutation. This runs AFTER `applyCanvasDimensions` (which can
        // resize the container's scrollable content) and AFTER the new
        // image is committed, so the write lands against the final
        // post-load scroll metrics. When `preserveScroll` is omitted or
        // `false`, the scroll position is intentionally left untouched
        // so v1's documented scroll/viewport behavior for the selected
        // layout mode applies.
        if (loadOptions.preserveScroll === true && ctx.containerEl) {
            try {
                if (bundle.containerScrollTop !== null) {
                    ctx.containerEl.scrollTop = bundle.containerScrollTop;
}
                if (bundle.containerScrollLeft !== null) {
                    ctx.containerEl.scrollLeft = bundle.containerScrollLeft;
}
} catch (err) {
                console.warn(
                    '[ImageEditor] preserveScroll restore failed',
                    err,
);
}
}

        // invoke `onImageLoaded` exactly once
        // after every editor scalar (`originalImage`, `currentScale`,
        // `currentRotation`, `baseImageScale`, `maskCounter`,
        // `_lastSnapshot`) has been committed and the optional
        // `preserveScroll` restore has run. A thrown callback is caught
        // and logged so a defective integrator callback cannot mutate
        // editor state. The callback is intentionally
        // NOT fired on the rollback path; this invocation lives inside
        // the success branch so a failure between snapshot capture and
        // commit (which routes through `replayRollback` below) skips it
        // entirely.
        const cb = ctx.options.onImageLoaded;
        if (typeof cb === 'function') {
            try {
                cb();
            } catch (err) {
                console.error(
                    '[ImageEditor] onImageLoaded callback threw',
                    err,
                );
            }
        }
} catch (err) {
        // replay the bundle and reject with the
        // original error. Failures inside the rollback itself are
        // logged but do NOT mask the original error.
        await replayRollback(ctx, bundle);

        // route the original error through the public
        // `onError(error, message)` callback. `reportError` catches and
        // logs callback exceptions so a faulty integrator callback cannot
        // mask the original editor error we are about to re-throw. The
        // helper is invoked AFTER `replayRollback` so the editor state
        // observable from inside `onError` matches the pre-call state
        // (atomic rewind).
        const errorMessage = err instanceof Error
            ? `loadImage failed: ${err.message}`
            : 'loadImage failed';
        reportError(ctx.options, err, errorMessage);

        throw err;
}
}

// ─── Internal helpers ────────────────────────────────────────────────────────

/**
 * Decode a data URL into an `HTMLImageElement`. Rejects with an
 * {@link ImageDecodeError} that wraps the original `ErrorEvent` so the
 * facade's `onError` handler can introspect the cause.
 */
function decodeImageElement(dataUrl: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload =  () => {
            img.onload = img.onerror = null;
            resolve(img);
};
        img.onerror = (e) => {
            img.onload = img.onerror = null;
            reject(new ImageDecodeError('Failed to decode image data URL.', e));
};
        img.src = dataUrl;
});
}

/**
 * Run the resampler when the source image exceeds the configured bounds
 * and downsampling is enabled. Returns the (possibly rewritten) data URL
 * to hand to `FabricImage.fromURL`.
 *
 * Errors from the resampler (`DownsampleError`)
 * propagate to the caller's catch.
 */
function maybeDownsample(
    imgEl: HTMLImageElement,
    originalDataUrl: string,
    options: ResolvedOptions,
): string {
    if (!options.downsampleOnLoad) return originalDataUrl;

    const dims = computeDownsampleDimensions(
        imgEl.naturalWidth,
        imgEl.naturalHeight,
        options.downsampleMaxWidth,
        options.downsampleMaxHeight,
);
    if (!dims.needsResize) return originalDataUrl;

    const sourceMime = detectSourceMimeType(originalDataUrl);
    return resampleImage(
        imgEl,
        options.downsampleMaxWidth,
        options.downsampleMaxHeight,
        sourceMime,
        options.preserveSourceFormat,
        options.downsampleMimeType,
        options.downsampleQuality,
).dataUrl;
}

/**
 * Pick a layout strategy and compute its result. Pure delegation to
 * {@link selectLayoutStrategy} and the per-strategy computers in
 * `image/layout-manager.ts`.
 */
function computeLayout(
    ctx: LoadImageContext,
    fimg: FabricNS.FabricImage,
): LayoutResult {
    const imgW = fimg.width ?? 0;
    const imgH = fimg.height ?? 0;
    const viewport = ctx.viewportCache.measure(ctx.containerEl, {
        width: ctx.options.canvasWidth,
        height: ctx.options.canvasHeight,
});

    const strategy = selectLayoutStrategy(ctx.options);
    if (strategy === 'fit') {
        return computeFitLayout(
            imgW,
            imgH,
            ctx.options.canvasWidth,
            ctx.options.canvasHeight,
            viewport,
);
}
    if (strategy === 'cover') {
        return computeCoverLayout(
            imgW,
            imgH,
            ctx.options.canvasWidth,
            ctx.options.canvasHeight,
            viewport,
);
}
    return computeExpandLayout(
        imgW,
        imgH,
        ctx.options.canvasWidth,
        ctx.options.canvasHeight,
        viewport,
);
}

/**
 * Serialize the canvas using the same custom keys that `saveState` uses,
 * so a rollback restores the full editor metadata (including `maskId`,
 * `maskName`, `originalAlpha`, and the session-only marker flags). Active
 * selections are discarded first to keep the wrapper out of the rolled-back
 * snapshot.
 */
function serializeCanvas(canvas: FabricNS.Canvas): string {
    canvas.discardActiveObject();
    const json = (
        canvas as unknown as {
            toJSON(propertiesToInclude: readonly string[]): unknown;
}
).toJSON(SNAPSHOT_CUSTOM_KEYS);
    return JSON.stringify(json);
}

/**
 * Replay the rollback bundle in the documented reverse-of-capture order.
 *
 * Errors thrown during the rollback itself are logged via `console.warn`
 * and swallowed: the loader must always reject with the *original* error
 *, so a defective rollback cannot mask the cause.
 */
async function replayRollback(
    ctx: LoadImageContext,
    bundle: RollbackBundle,
): Promise<void> {
    // 1. Restore container `overflow` inline value first so subsequent
    //    DOM reads (scroll metrics, layout) see the developer's CSS.
    if (ctx.containerEl && bundle.containerOverflow !== null) {
        try {
            ctx.containerEl.style.overflow = bundle.containerOverflow;
} catch (err) {
            console.warn('[ImageEditor] rollback: overflow restore failed', err);
}
}

    // 2. Restore canvas JSON via Fabric's loadFromJSON. If this fails
    //    (malformed snapshot, dispose race) we log and continue — the
    //    facade's higher-level rollback paths cannot do better than
    //    surfacing the original error.
    try {
        await (
            ctx.canvas as unknown as {
                loadFromJSON(json: unknown): Promise<FabricNS.Canvas>;
}
).loadFromJSON(JSON.parse(bundle.canvasJson));
        ctx.canvas.renderAll();
} catch (err) {
        console.warn('[ImageEditor] rollback: loadFromJSON failed', err);
}

    // 3. Restore editor scalar state. Done after the canvas restore so
    //    handlers reading these fields during render see the rolled-back
    //    values.
    ctx.setOriginalImage(bundle.originalImage);
    ctx.setIsImageLoadedToCanvas(bundle.isImageLoadedToCanvas);
    ctx.setLastSnapshot(bundle.lastSnapshot);
    ctx.setMaskCounter(bundle.maskCounter);
    ctx.setCurrentScale(bundle.currentScale);
    ctx.setCurrentRotation(bundle.currentRotation);
    ctx.setBaseImageScale(bundle.baseImageScale);

    // 4. Restore container scroll. After `loadFromJSON` Fabric may have
    //    resized the canvas, which itself can mutate scroll metrics on
    //    the container; restoring scroll last guarantees the captured
    //    values stick (will rely on the same ordering).
    if (ctx.containerEl) {
        try {
            if (bundle.containerScrollTop !== null) {
                ctx.containerEl.scrollTop = bundle.containerScrollTop;
}
            if (bundle.containerScrollLeft !== null) {
                ctx.containerEl.scrollLeft = bundle.containerScrollLeft;
}
} catch (err) {
            console.warn('[ImageEditor] rollback: scroll restore failed', err);
}
}

    // 5. Restore placeholder visibility. The visibility helper is total
    //    and never throws on null inputs.
    if (bundle.placeholderHidden !== null) {
        // `setPlaceholderVisible(show)` takes the *placeholder* visibility
        // perspective: `show === true` means the placeholder is visible.
        // The bundle stored `placeholderEl.hidden`, so the desired `show`
        // is the inverse.
        ctx.setPlaceholderVisible(!bundle.placeholderHidden);
}
}
