/**
 * Transactional `loadImage` pipeline. Validates the input,
 * snapshots every field that the pipeline is about to mutate
 * into a {@link RollbackBundle}, decodes the data URL into an
 * `HTMLImageElement` under the configured timeout, optionally
 * downsamples via {@link resampleImage}, awaits
 * `FabricImage.fromURL` under the same timeout, applies the
 * layout strategy chosen by `image/layout-manager.ts`, commits
 * the new image to the canvas, and emits a fresh
 * `lastSnapshot` via `core/state-serializer.ts`. Any failure
 * between the snapshot and the commit replays the bundle and
 * rejects with the original error.
 *
 * ## Owned contracts
 *
 * - When `loadImage` rejects, the original error is
 *   routed through the public `onError(error, message)` callback via
 *   `core/callback-reporter.ts → reportError`, AFTER `replayRollback` has
 *   restored editor state. Callback exceptions are caught and logged so a
 *   faulty integrator callback cannot mask the original error that the
 *   loader re-throws. The success path does NOT invoke `onError`.
 * - Strings that are not supported image data URLs
 *   resolve without mutating placeholder visibility, scroll position,
 *   image state, or canvas state. The function returns before
 *   capturing the rollback bundle, so no observable side effect occurs.
 * - On a supported image data URL, the loader captures
 *   the rollback bundle *before* mutating any of the fields it tracks
 *   (placeholder `hidden`, container `scrollTop`/`scrollLeft`, container
 *   `originalImage`, `lastSnapshot`, the canvas JSON
 *   snapshot, plus the editor transform fields the rollback needs to
 *   restore the live canvas to a consistent state).
 * - Decode, Fabric, downsample, and timeout failures
 *   restore every field captured in the rollback bundle and reject with the
 *   original error.
 * - On success, `isImageLoadedToCanvas` is set to
 *   `true`, `lastSnapshot` is replaced with a fresh snapshot derived from
 *   the new canvas, and both overlay counters are reset to `0`.
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
 * - On success, `maskCounter` and `annotationCounter` are reset to `0`.
 *
 * ## Implementation notes
 *
 * The loader is an exported **function** that takes its dependencies in a
 * {@link LoadImageContext} parameter rather than a class. The `ImageEditor`
 * facade owns all editor state (the canvas reference, the placeholder
 * element, the editor scalar fields), so the loader must read and write
 * that state through a small set of getter/setter callbacks. The class
 * shape stays on the facade; the loader remains stateless so the rollback
 * bundle is the single source of truth for what the operation has captured.
 *
 * The rollback bundle is built before the loader hides the placeholder or
 * touches the canvas. It captures *every* field listed in the documented
 * RollbackBundle definition plus the editor scalar fields
 * (`isImageLoadedToCanvas`, `maskCounter`, `annotationCounter`,
 * `currentScale`, `currentRotation`, `baseImageScale`) the success path mutates. Restoring
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
 * success path leaves the container scroll untouched, so the documented
 * scroll/viewport behavior for the selected layout mode prevails.
 *
 * The loader does not invoke public success callbacks. It owns
 * transactional mutation and rollback; the `ImageEditor` facade emits
 * `onImageLoaded`, `onImageChanged`, `onMasksChanged`, and related lifecycle
 * callbacks after this function returns from a committed load. The rollback
 * path still reports load failures through `onError` after replaying the
 * rollback bundle.
 *
 * Owner module references (per the documented "Mapping Contracts to
 * modules" table): this module is the canonical owner of the transactional
 * load helpers. It is NOT re-exported from `src/index.ts`.
 *
 * @module
 */

import type * as FabricNS from 'fabric';

import type {
    BaseImageObject,
    FabricModule,
    ImageMimeType,
    LoadImageOptions,
    ResolvedOptions,
} from '../core/public-types.js';
import { reportError, reportWarning } from '../core/callback-reporter.js';
import { markBaseImageObject } from '../core/editor-object-kind.js';
import { ImageDecodeError } from '../core/errors.js';
import { saveState, SNAPSHOT_CUSTOM_KEYS } from '../core/state-serializer.js';
import { isSupportedImageDataUrl } from '../utils/file.js';
import { startImageElementLoad } from '../utils/image-element-loader.js';
import { withTimeout } from '../utils/timeout.js';
import {
    computeCoverLayout,
    computeExpandLayout,
    computeFitLayout,
    selectLayoutStrategy,
    applyCanvasDimensions,
    measureScrollbarSize,
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
 * Mirrors the documented `RollbackBundle` definition with the addition of
 * the editor scalar fields the success path also rewrites
 * (`isImageLoadedToCanvas`, `maskCounter`, `annotationCounter`,
 * `currentScale`, `currentRotation`, `baseImageScale`). Those scalars must
 * be restored together with the canvas JSON for atomic rewind.
 *
 */
export interface RollbackBundle {
    /** `placeholderElement.hidden` immediately before the loader hid it. */
    placeholderHidden: boolean | null;
    /** Container `scrollTop` immediately before the loader started. */
    containerScrollTop: number | null;
    /** Container `scrollLeft` immediately before the loader started. */
    containerScrollLeft: number | null;
    /** The previously-committed `originalImage` reference, if any. */
    originalImage: BaseImageObject | null;
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
    /** Annotation counter value before the loader reset it to 0. */
    annotationCounter: number;
    /** Image scale factor before the loader reset it to 1. */
    currentScale: number;
    /** Image rotation in degrees before the loader reset it to 0. */
    currentRotation: number;
    /** Base scale chosen by the previous load, restored on rollback. */
    baseImageScale: number;
    /** MIME type of the image committed before the load started. */
    currentImageMimeType: ImageMimeType | null;
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
 * The facade is also responsible for public success lifecycle callbacks after
 * this transactional helper returns. The loader only reports failed loads
 * through `onError` after rollback.
 */
export interface LoadImageContext {
    /** The Fabric module providing `FabricImage.fromURL`. */
    fabric: FabricModule;
    /** The live Fabric canvas. */
    canvas: FabricNS.Canvas;
    /** Resolved editor options (timeouts, downsample knobs, layout flags). */
    options: ResolvedOptions;
    /** Scrollable container wrapping the canvas, or `null`. */
    containerElement: HTMLElement | null;
    /** Empty-state placeholder element, or `null`. */
    placeholderElement: HTMLElement | null;
    /** Hidden-container viewport cache shared with the layout manager. */
    viewportCache: ViewportCache;

    /** Reads the previously-committed `originalImage`. */
    getOriginalImage(): BaseImageObject | null;
    /** Writes `originalImage` (used both on commit and on rollback). */
    setOriginalImage(imageObject: BaseImageObject | null): void;

    /** Reads `isImageLoadedToCanvas`. */
    getIsImageLoadedToCanvas(): boolean;
    /** Writes `isImageLoadedToCanvas`. */
    setIsImageLoadedToCanvas(v: boolean): void;

    /** Reads `lastSnapshot`. */
    getLastSnapshot(): string | null;
    /** Writes `lastSnapshot`. */
    setLastSnapshot(s: string | null): void;

    /** Reads `maskCounter`. */
    getMaskCounter(): number;
    /** Writes `maskCounter`. */
    setMaskCounter(n: number): void;

    /** Reads `annotationCounter`. */
    getAnnotationCounter(): number;
    /** Writes `annotationCounter`. */
    setAnnotationCounter(n: number): void;

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

    /** Reads the MIME type of the currently committed image. */
    getCurrentImageMimeType(): ImageMimeType | null;
    /** Writes the MIME type of the currently committed image. */
    setCurrentImageMimeType(mimeType: ImageMimeType | null): void;

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
 *    reset both overlay counters to 0, reset transforms, and emit a
 *    fresh `lastSnapshot` via {@link saveState}.
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
 * untouched and legacy's documented scroll/viewport behavior for the selected
 * layout mode applies.
 *
 * Public success lifecycle callbacks are emitted by the facade after this
 * helper returns from a committed load. Keeping them outside the loader keeps
 * transactional mutation/rollback separate from facade-level event ordering.
 *
 * @param context - Editor dependency bundle.
 * @param imageBase64 - Supported image data URL to load.
 * @param loadOptions - Public {@link LoadImageOptions}. Currently only
 *                     `preserveScroll` is consulted; defaults to `false`.
 * @returns Resolved promise on success, rejected with the original error
 *          (after rollback) on failure. Unsupported inputs resolve without
 *          observable mutation.
 *
 */
export async function loadImage(
    context: LoadImageContext,
    imageBase64: string,
    loadOptions: LoadImageOptions = {},
): Promise<void> {
    // 1. bail before capturing the bundle or mutating anything when the
    //    input is not one of the supported raster image data URL formats.
    if (!isSupportedImageDataUrl(imageBase64)) return;

    // 2. capture the rollback bundle BEFORE the first mutation.
    const placeholderHidden = context.placeholderElement
        ? !!context.placeholderElement.hidden
        : null;
    const containerScrollTop = context.containerElement ? context.containerElement.scrollTop : null;
    const containerScrollLeft = context.containerElement
        ? context.containerElement.scrollLeft
        : null;

    const bundle: RollbackBundle = {
        placeholderHidden,
        containerScrollTop,
        containerScrollLeft,
        originalImage: context.getOriginalImage(),
        isImageLoadedToCanvas: context.getIsImageLoadedToCanvas(),
        lastSnapshot: context.getLastSnapshot(),
        canvasJson: serializeCanvas(context.canvas),
        maskCounter: context.getMaskCounter(),
        annotationCounter: context.getAnnotationCounter(),
        currentScale: context.getCurrentScale(),
        currentRotation: context.getCurrentRotation(),
        baseImageScale: context.getBaseImageScale(),
        currentImageMimeType: context.getCurrentImageMimeType(),
    };

    try {
        // 3. First mutation — hide the placeholder via the visibility
        //    helper. The bundle holds the prior value so rollback can
        //    restore it.
        context.setPlaceholderVisible(false);

        // 4. decode under the configured timeout.
        const decode = startImageDecode(imageBase64);
        let imageElement: HTMLImageElement;
        try {
            imageElement = await withTimeout(
                decode.promise,
                context.options.imageLoadTimeoutMs,
                'image decode',
            );
        } catch (error) {
            decode.cleanup(true);
            throw error;
        }

        // 5. optionally downsample. The resampler
        //    throws DownsampleError when the offscreen canvas cannot get
        //    a 2D context; the surrounding catch routes that through the
        //    rollback path.
        const loadSource = maybeDownsample(
            imageElement,
            imageBase64,
            context.options,
            getCanvasDocument(context.canvas),
        );

        // 6. Fabric image creation under the same
        //    timeout. Cross-origin is requested so canvases stay
        //    untainted for export.
        const fabricImage = await withTimeout(
            context.fabric.FabricImage.fromURL(loadSource.dataUrl, { crossOrigin: 'anonymous' }),
            context.options.imageLoadTimeoutMs,
            'FabricImage.fromURL',
        );

        // 7. Apply the new image to the canvas. Discard any prior
        //    selection so the active-selection wrapper does not leak
        //    into the new state, then clear the canvas, then add the
        //    image. Background color is reapplied because `clear`
        //    drops it.
        context.canvas.discardActiveObject();
        context.canvas.clear();
        context.canvas.backgroundColor = context.options.backgroundColor;

        const baseImage = markBaseImageObject(fabricImage);
        baseImage.set({
            originX: 'left',
            originY: 'top',
            selectable: false,
            evented: false,
        });

        const layout = computeLayout(context, baseImage);
        applyCanvasDimensions(
            context.canvas,
            layout.canvasWidth,
            layout.canvasHeight,
            context.containerElement,
        );
        baseImage.set({ left: layout.imageLeft, top: layout.imageTop });
        baseImage.scale(layout.imageScale);

        context.canvas.add(baseImage);
        context.canvas.sendObjectToBack(baseImage);

        // 8. commit editor scalar state.
        context.setOriginalImage(baseImage);
        context.setBaseImageScale(layout.baseImageScale);
        context.setCurrentScale(1);
        context.setCurrentRotation(0);
        context.setMaskCounter(0);
        context.setAnnotationCounter(0);
        context.setIsImageLoadedToCanvas(true);
        context.setCurrentImageMimeType(loadSource.mimeType);

        context.canvas.renderAll();

        // emit a fresh `lastSnapshot` derived from
        // the new canvas state. `saveState` discards any active
        // selection (already done above) and embeds `_editorState` so
        // the next undo has a correct "before" pointer.
        context.setLastSnapshot(
            saveState({
                canvas: context.canvas,
                currentScale: 1,
                currentRotation: 0,
                baseImageScale: layout.baseImageScale,
                currentImageMimeType: loadSource.mimeType,
            }),
        );

        // when the caller opted into `preserveScroll`,
        // restore the container scroll position captured before any
        // mutation. This runs AFTER `applyCanvasDimensions` (which can
        // resize the container's scrollable content) and AFTER the new
        // image is committed, so the write lands against the final
        // post-load scroll metrics. When `preserveScroll` is omitted or
        // `false`, the scroll position is intentionally left untouched
        // so legacy's documented scroll/viewport behavior for the selected
        // layout mode applies.
        if (loadOptions.preserveScroll === true && context.containerElement) {
            try {
                if (bundle.containerScrollTop !== null) {
                    context.containerElement.scrollTop = bundle.containerScrollTop;
                }
                if (bundle.containerScrollLeft !== null) {
                    context.containerElement.scrollLeft = bundle.containerScrollLeft;
                }
            } catch (error) {
                console.warn('[ImageEditor] preserveScroll restore failed', error);
            }
        }

        // Public lifecycle callbacks are emitted by the facade after this
        // transactional commit returns, so the loader remains focused on
        // mutation and rollback only.
    } catch (error) {
        // replay the bundle and reject with the
        // original error. Failures inside the rollback itself are
        // logged but do NOT mask the original error.
        await replayRollback(context, bundle);

        // route the original error through the public
        // `onError(error, message)` callback. `reportError` catches and
        // logs callback exceptions so a faulty integrator callback cannot
        // mask the original editor error we are about to re-throw. The
        // helper is invoked AFTER `replayRollback` so the editor state
        // observable from inside `onError` matches the pre-call state
        // (atomic rewind).
        const errorMessage =
            error instanceof Error ? `loadImage failed: ${error.message}` : 'loadImage failed';
        reportError(context.options, error, errorMessage);

        throw error;
    }
}

// ─── Internal helpers ────────────────────────────────────────────────────────

/**
 * Decode a data URL into an `HTMLImageElement`. Rejects with an
 * {@link ImageDecodeError} that wraps the original `ErrorEvent` so the
 * facade's `onError` handler can introspect the cause.
 */
interface ImageDecodeHandle {
    promise: Promise<HTMLImageElement>;
    cleanup(clearSource?: boolean): void;
}

function startImageDecode(dataUrl: string): ImageDecodeHandle {
    return startImageElementLoad(dataUrl, {
        validate: (imageElement) =>
            hasNaturalImageDimensions(imageElement)
                ? null
                : new ImageDecodeError(
                      'Failed to decode image data URL: image has no natural dimensions.',
                      null,
                  ),
        createError: (event) => new ImageDecodeError('Failed to decode image data URL.', event),
    });
}

function hasNaturalImageDimensions(imageElement: HTMLImageElement): boolean {
    return (
        Number.isFinite(imageElement.naturalWidth) &&
        Number.isFinite(imageElement.naturalHeight) &&
        imageElement.naturalWidth > 0 &&
        imageElement.naturalHeight > 0
    );
}

function isPositiveFinite(value: number): boolean {
    return Number.isFinite(value) && value > 0;
}

function toSupportedImageMimeType(mimeType: string | null): ImageMimeType | null {
    return mimeType === 'image/jpeg' || mimeType === 'image/png' || mimeType === 'image/webp'
        ? mimeType
        : null;
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
    imageElement: HTMLImageElement,
    originalDataUrl: string,
    options: ResolvedOptions,
    ownerDocument: Document | undefined,
): { dataUrl: string; mimeType: ImageMimeType | null } {
    const originalMimeType = toSupportedImageMimeType(detectSourceMimeType(originalDataUrl));
    if (!options.downsampleOnLoad) {
        return { dataUrl: originalDataUrl, mimeType: originalMimeType };
    }

    if (
        !isPositiveFinite(options.downsampleMaxWidth) ||
        !isPositiveFinite(options.downsampleMaxHeight)
    ) {
        reportWarning(
            options,
            null,
            'loadImage skipped downsampling because downsample bounds are invalid.',
        );
        return { dataUrl: originalDataUrl, mimeType: originalMimeType };
    }

    const downsampleDimensions = computeDownsampleDimensions(
        imageElement.naturalWidth,
        imageElement.naturalHeight,
        options.downsampleMaxWidth,
        options.downsampleMaxHeight,
    );
    if (!downsampleDimensions.needsResize) {
        return { dataUrl: originalDataUrl, mimeType: originalMimeType };
    }

    const sourceMime = detectSourceMimeType(originalDataUrl);
    const resampledImage = resampleImage(
        imageElement,
        options.downsampleMaxWidth,
        options.downsampleMaxHeight,
        sourceMime,
        options.preserveSourceFormat,
        options.downsampleMimeType,
        options.downsampleQuality,
        ownerDocument,
    );
    const actualMimeType = toSupportedImageMimeType(detectSourceMimeType(resampledImage.dataUrl));
    return {
        dataUrl: resampledImage.dataUrl,
        mimeType: actualMimeType ?? resampledImage.mimeType,
    };
}

function getCanvasDocument(canvas: FabricNS.Canvas): Document | undefined {
    const canvasLike = canvas as FabricNS.Canvas & {
        getElement?: () => HTMLCanvasElement | undefined;
        lowerCanvasEl?: HTMLCanvasElement;
    };
    return (
        canvasLike.getElement?.()?.ownerDocument ??
        canvasLike.lowerCanvasEl?.ownerDocument ??
        (typeof document !== 'undefined' ? document : undefined)
    );
}

/**
 * Pick a layout strategy and compute its result. Pure delegation to
 * {@link selectLayoutStrategy} and the per-strategy computers in
 * `image/layout-manager.ts`.
 */
function computeLayout(context: LoadImageContext, fabricImage: FabricNS.FabricImage): LayoutResult {
    const imageWidth = fabricImage.width ?? 0;
    const imageHeight = fabricImage.height ?? 0;
    const scrollbarSize = measureScrollbarSize(context.containerElement?.ownerDocument ?? null);
    const viewport = context.viewportCache.measure(
        context.containerElement,
        {
            width: context.options.canvasWidth,
            height: context.options.canvasHeight,
        },
        scrollbarSize,
    );

    const strategy = selectLayoutStrategy(context.options.layoutMode);
    if (strategy === 'fit') {
        return computeFitLayout(
            imageWidth,
            imageHeight,
            context.options.canvasWidth,
            context.options.canvasHeight,
            viewport,
        );
    }
    if (strategy === 'cover') {
        return computeCoverLayout(
            imageWidth,
            imageHeight,
            context.options.canvasWidth,
            context.options.canvasHeight,
            viewport,
            scrollbarSize,
        );
    }
    return computeExpandLayout(
        imageWidth,
        imageHeight,
        context.options.canvasWidth,
        context.options.canvasHeight,
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
 * and swallowed: the loader must always reject with the *original* error,
 * so a defective rollback cannot mask the cause.
 */
async function replayRollback(context: LoadImageContext, bundle: RollbackBundle): Promise<void> {
    // 1. Restore canvas JSON via Fabric's loadFromJSON. If this fails
    //    (malformed snapshot, dispose race) we log and continue — the
    //    facade's higher-level rollback paths cannot do better than
    //    surfacing the original error.
    try {
        await (
            context.canvas as unknown as {
                loadFromJSON(json: unknown): Promise<FabricNS.Canvas>;
            }
        ).loadFromJSON(JSON.parse(bundle.canvasJson));
        context.canvas.renderAll();
    } catch (rollbackError) {
        console.warn('[ImageEditor] rollback: loadFromJSON failed', rollbackError);
    }

    // 2. Restore editor scalar state. Done after the canvas restore so
    //    handlers reading these fields during render see the rolled-back
    //    values.
    context.setOriginalImage(bundle.originalImage);
    context.setIsImageLoadedToCanvas(bundle.isImageLoadedToCanvas);
    context.setLastSnapshot(bundle.lastSnapshot);
    context.setMaskCounter(bundle.maskCounter);
    context.setAnnotationCounter(bundle.annotationCounter);
    context.setCurrentScale(bundle.currentScale);
    context.setCurrentRotation(bundle.currentRotation);
    context.setBaseImageScale(bundle.baseImageScale);
    context.setCurrentImageMimeType(bundle.currentImageMimeType);

    // 3. Restore container scroll. After `loadFromJSON` Fabric may have
    //    resized the canvas, which itself can mutate scroll metrics on
    //    the container; restoring scroll last guarantees the captured
    //    values stick (will rely on the same ordering).
    if (context.containerElement) {
        try {
            if (bundle.containerScrollTop !== null) {
                context.containerElement.scrollTop = bundle.containerScrollTop;
            }
            if (bundle.containerScrollLeft !== null) {
                context.containerElement.scrollLeft = bundle.containerScrollLeft;
            }
        } catch (rollbackError) {
            console.warn('[ImageEditor] rollback: scroll restore failed', rollbackError);
        }
    }

    // 4. Restore placeholder visibility. The visibility helper is total
    //    and never throws on null inputs.
    if (bundle.placeholderHidden !== null) {
        // `setPlaceholderVisible(show)` takes the *placeholder* visibility
        // perspective: `show === true` means the placeholder is visible.
        // The bundle stored `placeholderElement.hidden`, so the desired `show`
        // is the inverse.
        context.setPlaceholderVisible(!bundle.placeholderHidden);
    }
}
