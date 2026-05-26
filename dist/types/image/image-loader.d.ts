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
 * ## Implementation notes
 *
 * The loader is an exported **function** that takes its dependencies in a
 * {@link LoadImageContext} parameter rather than a class. The `ImageEditor`
 * facade owns all editor state (the canvas reference, the placeholder
 * element, the editor scalar fields), so the loader must read and write
 * that state through a small set of getter/setter callbacks. The class
 * shape of legacy was a side effect of the monolith; current keeps the loader
 * stateless so the rollback bundle is the single source of truth for what
 * the operation has captured.
 *
 * The rollback bundle is built before the loader hides the placeholder or
 * touches the canvas. It captures *every* field listed in the documented
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
 * success path leaves the container scroll untouched, so legacy's documented
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
 * Owner module references (per the documented "Mapping Contracts to
 * modules" table): this module is the canonical owner of the transactional
 * load helpers. It is NOT re-exported from `src/index.ts`.
 */
import type * as FabricNS from 'fabric';
import type { FabricModule, LoadImageOptions, ResolvedOptions } from '../core/public-types.js';
import { type ViewportCache } from './layout-manager.js';
/**
 * Snapshot of every field the loader is about to mutate, captured before
 * the first mutation so a failure mid-pipeline can rewind the editor to
 * its pre-call state.
 *
 * Mirrors the documented `RollbackBundle` definition with the addition of
 * the editor scalar fields the success path also rewrites
 * (`isImageLoadedToCanvas`, `maskCounter`, `currentScale`,
 * `currentRotation`, `baseImageScale`). Those scalars must be restored
 * together with the canvas JSON for atomic rewind.
 *
 */
export interface RollbackBundle {
    /** `placeholderElement.hidden` immediately before the loader hid it. */
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
    containerElement: HTMLElement | null;
    /** Empty-state placeholder element, or `null`. */
    placeholderElement: HTMLElement | null;
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
 * untouched and legacy's documented scroll/viewport behavior for the selected
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
export declare function loadImage(ctx: LoadImageContext, imageBase64: string, loadOptions?: LoadImageOptions): Promise<void>;
//# sourceMappingURL=image-loader.d.ts.map