/**
 * Typed error classes raised by the editor pipelines (load,
 * downsample, merge, crop, export).
 *
 * All errors that may surface to consumers extend {@link Error} directly so
 * callers can discriminate via `instanceof` or `error.name` checks. The
 * hierarchy is intentionally flat — there is no shared `ImageEditorError`
 * base class — to keep `name`/message contracts independent per pipeline
 * and avoid coupling unrelated error contracts.
 *
 * These classes are internal to the package and are NOT re-exported from
 * `src/index.ts`. Consumers see them via promise rejections from public
 * methods (e.g. `loadImage.catch(error =>...)`) and should branch on
 * `error.name` or `instanceof` for fine-grained handling.
 *
 * @module
 */
/**
 * Raised by `fabric/fabric-adapter.ts` when neither constructor argument
 * provides a Fabric module and `globalThis.fabric` is also absent. The
 * editor logs a single descriptive `console.error` and makes `init` and
 * `loadImage` no-ops that resolve to `undefined`.
 *
 * Surfaces to consumer as: a single `console.error`; subsequent public
 * methods are guarded by the adapter's `isFabricLoaded === false` flag.
 *
 */
export declare class FabricUnavailableError extends Error {
    readonly name = "FabricUnavailableError";
    constructor(message?: string);
}
/**
 * Raised by `image/image-loader.ts` when the internal `decodeImageElement`
 * helper rejects (the `<img>` `onerror` fires while decoding the data URL).
 *
 * Surfaces to consumer as: rejection of the `loadImage` promise. The
 * editor restores every field captured in the rollback bundle before
 * rejecting, so `loadImage` is observably atomic.
 *
 */
export declare class ImageDecodeError extends Error {
    readonly name = "ImageDecodeError";
    /** Original error or `ErrorEvent` from the `<img>` element, if any. */
    readonly originalError: unknown;
    constructor(message?: string, originalError?: unknown);
}
/**
 * Raised by `utils/timeout.ts` after `imageLoadTimeoutMs` (default 30000)
 * elapses on either the decode step or the `FabricImage.fromURL` step of
 * `loadImage`. The error message includes both the elapsed milliseconds
 * and the label of the step that timed out, so consumers and logs can
 * tell which phase stalled.
 *
 * Surfaces to consumer as: rejection of the `loadImage` promise after
 * the rollback bundle has been replayed.
 *
 */
export declare class ImageLoadTimeoutError extends Error {
    readonly name = "ImageLoadTimeoutError";
    /** Step label, e.g. `'image decode'` or `'FabricImage.fromURL'`. */
    readonly label: string;
    /** Elapsed milliseconds at the time the timer fired. */
    readonly elapsedMs: number;
    constructor(label: string, elapsedMs: number);
}
/**
 * Raised by `image/image-resampler.ts` when the offscreen canvas required
 * for downsampling cannot obtain a 2D rendering context (i.e.
 * `OffscreenCanvas.getContext('2d')` or the fallback `<canvas>.getContext`
 * returns `null`).
 *
 * Surfaces to consumer as: rejection of the `loadImage` promise. The
 * Transactional_Load rollback runs before the rejection.
 *
 */
export declare class DownsampleError extends Error {
    readonly name = "DownsampleError";
    /** Original error, if any. Usually `null`. */
    readonly originalError: unknown;
    constructor(message?: string, originalError?: unknown);
}
/**
 * Raised by `export/export-service.ts.mergeMasks` when the in-memory render
 * or any post-merge step fails. The pre-merge snapshot is restored before
 * the rejection.
 *
 * Surfaces to consumer as: rejection of the `mergeMasks` promise.
 *
 */
export declare class MergeMasksError extends Error {
    readonly name = "MergeMasksError";
    /** Original error thrown during the merge pipeline. */
    readonly originalError: unknown;
    constructor(message?: string, originalError?: unknown);
}
/**
 * Raised when flattening annotations into the base image fails. The
 * pre-merge snapshot is restored before the rejection.
 */
export declare class MergeAnnotationsError extends Error {
    readonly name = "MergeAnnotationsError";
    /** Original error thrown during the merge pipeline. */
    readonly originalError: unknown;
    constructor(message?: string, originalError?: unknown);
}
/**
 * Raised by `crop/crop-controller.ts.applyCrop` on any failure during the
 * crop pipeline (crop computation, cropped-image load via the loader, or
 * any post-merge step). The pre-crop snapshot is restored, the
 * `CropSession` is dropped, and crop-specific Fabric handlers are detached
 * before the rejection.
 *
 * Surfaces to consumer as: rejection of the `applyCrop` promise.
 *
 */
export declare class CropApplyError extends Error {
    readonly name = "CropApplyError";
    /** Original error thrown during the crop pipeline. */
    readonly originalError: unknown;
    constructor(message?: string, originalError?: unknown);
}
/**
 * Raised by `export/export-service.ts.exportImageFile` when
 * `isImageLoaded` is `false`. A console warning naming the missing image
 * is emitted alongside the rejection.
 *
 * Note: `exportImageBase64` and `downloadImage` do NOT raise this error —
 * they resolve to `''` or no-op respectively, and emit the same warning.
 *
 * Surfaces to consumer as: rejection of the `exportImageFile` promise.
 *
 */
export declare class ExportNotReadyError extends Error {
    readonly name = "ExportNotReadyError";
    /** Name of the export operation that was attempted. */
    readonly operation: string;
    constructor(operation?: string);
}
/**
 * Raised by export helpers when an image is loaded but the export pipeline
 * cannot produce a valid output, for example because the computed image
 * region is empty or the rendered data URL cannot be decoded into bytes.
 *
 * Surfaces to consumer as: rejection of the relevant export promise.
 */
export declare class ExportError extends Error {
    readonly name = "ExportError";
    /** Original error thrown during the export pipeline. */
    readonly originalError: unknown;
    constructor(message?: string, originalError?: unknown);
}
//# sourceMappingURL=errors.d.ts.map