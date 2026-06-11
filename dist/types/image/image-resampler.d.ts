/**
 * Aspect-preserving downsampling and alpha-aware MIME selection
 * for oversized source images loaded by `image/image-loader.ts`.
 *
 * The resampler is a pure helper module: it does not know about the editor,
 * the canvas, or the rollback bundle. It exposes three small, individually
 * testable building blocks plus one orchestrating function:
 *
 * - {@link computeDownsampleDimensions} — pure aspect-ratio math used by
 *   property tests for the resampler size contract.
 * - {@link selectDownsampleMimeType}   — pure MIME-resolution table used by
 *   property tests for the alpha-preserving fallback path.
 * - {@link detectSourceMimeType}       — extracts the MIME prefix from a
 *   base64 data URL.
 * - {@link resampleImage}              — composes the above with a real
 *   `<canvas>` to produce the downsampled data URL. Throws
 *   {@link DownsampleError} when the offscreen canvas fails to obtain a
 *   2D context so the loader can replay its rollback
 *   bundle transactionally.
 *
 * This module is internal — it is NOT re-exported from `src/index.ts`.
 *
 * @module
 */
import type { ImageMimeType } from '../core/public-types.js';
/**
 * Result returned by {@link resampleImage}.
 *
 * `dataUrl` is the rasterised data URL produced by the offscreen canvas,
 * `width` / `height` are the integer pixel dimensions used for that raster,
 * and `mimeType` is the MIME chosen by {@link selectDownsampleMimeType}.
 */
export interface ResampleResult {
    /** Rasterised data URL (`data:image/...;base64...`). */
    dataUrl: string;
    /** Output width in pixels (integer). */
    width: number;
    /** Output height in pixels (integer). */
    height: number;
    /** Resolved output MIME type. */
    mimeType: ImageMimeType;
}
/**
 * Compute target dimensions while preserving the source aspect ratio.
 *
 * Returns the source dimensions unchanged when both axes are already within
 * `(maxWidth, maxHeight)`. When either bound is exceeded, returns the
 * largest box that fits inside both bounds and matches the source aspect
 * ratio, with each axis rounded to an integer.
 *
 * Pure function — no DOM access, safe to call from property tests.
 *
 * @param srcWidth - Source pixel width (must be > 0 for meaningful output).
 * @param srcHeight - Source pixel height (must be > 0 for meaningful output).
 * @param maxWidth - Maximum allowed output width in pixels.
 * @param maxHeight - Maximum allowed output height in pixels.
 * @returns `{ width, height, needsResize}` where `needsResize` is `true`
 *          only when at least one source axis exceeded its bound.
 *
 */
export declare function computeDownsampleDimensions(srcWidth: number, srcHeight: number, maxWidth: number, maxHeight: number): {
    width: number;
    height: number;
    needsResize: boolean;
};
/**
 * Select the output MIME type for downsampling.
 *
 * Selection table:
 *
 * | sourceMime          | preserveSourceFormat | downsampleMimeType | result               |
 * | ------------------- | -------------------- | ------------------ | -------------------- |
 * | image/png           | true                 | unset              | image/png            |
 * | image/webp          | true                 | unset              | image/webp           |
 * | image/png           | false                | unset              | image/jpeg           |
 * | image/png           | true                 | image/jpeg         | image/jpeg           |
 * | image/jpeg          | (any)                | unset              | image/jpeg           |
 * | image/jpeg          | (any)                | image/webp         | image/webp           |
 * | null / unknown      | (any)                | unset              | image/jpeg           |
 *
 * Pure function — no DOM access, safe to call from property tests.
 *
 * @param sourceMime - Detected source MIME (e.g. from
 *                             {@link detectSourceMimeType}) or `null` if
 *                             unknown.
 * @param preserveSourceFormat - When `true`, alpha-capable source MIMEs
 *                             survive downsampling unless overridden by
 *                             `downsampleMimeType`.
 * @param downsampleMimeType - Explicit MIME override; when truthy, wins over
 *                             both `sourceMime` and `preserveSourceFormat`.
 * @returns The MIME type to emit from the offscreen canvas.
 *
 */
export declare function selectDownsampleMimeType(sourceMime: string | null, preserveSourceFormat: boolean, downsampleMimeType: ImageMimeType | null | undefined): ImageMimeType;
/**
 * Detect the MIME type embedded in a base64 data URL.
 *
 * Matches the standard `data:<mime>;...` prefix. Returns `null` when the
 * input does not start with a recognizable image data URL prefix, so callers
 * can pass the result straight into {@link selectDownsampleMimeType}.
 *
 * @param dataUrl - Base64 data URL (e.g. `data:image/png;base64,iVBOR...`).
 * @returns The lowercased MIME type, or `null` when no `image/*` prefix is
 *          present.
 */
export declare function detectSourceMimeType(dataUrl: string): string | null;
/**
 * Downsample an `HTMLImageElement` to fit within `(maxWidth, maxHeight)` and
 * return the resampled data URL alongside its final dimensions and MIME.
 *
 * The function is the only piece of the resampler that touches the DOM. It
 * creates an offscreen `<canvas>`, paints the source image into it at the
 * computed dimensions, and reads back a data URL using the MIME selected by
 * {@link selectDownsampleMimeType}. PNG output ignores `quality` because PNG
 * is lossless; JPEG and WebP output use `quality` as the
 * lossy compression knob.
 *
 * Failure mode: when `<canvas>.getContext('2d')` returns
 * `null`, this function throws {@link DownsampleError} so
 * `image/image-loader.ts` can replay its Transactional_Load rollback bundle
 * before rejecting the public `loadImage` promise.
 *
 * @param imageElement - Decoded source image element.
 * @param maxWidth - Maximum allowed output width in pixels.
 * @param maxHeight - Maximum allowed output height in pixels.
 * @param sourceMime - Detected source MIME from the original data
 *                             URL (or `null` if unknown).
 * @param preserveSourceFormat - When `true`, alpha-capable MIMEs survive.
 * @param downsampleMimeType - Optional explicit MIME override.
 * @param quality - Lossy compression quality in `[0, 1]` for
 *                             JPEG/WebP output. Ignored for PNG.
 * @returns The resampled data URL plus its dimensions and MIME.
 *
 * @throws {@link DownsampleError} when the offscreen canvas cannot obtain a
 *         2D rendering context.
 *
 */
export declare function resampleImage(imageElement: HTMLImageElement, maxWidth: number, maxHeight: number, sourceMime: string | null, preserveSourceFormat: boolean, downsampleMimeType: ImageMimeType | null | undefined, quality: number, ownerDocument?: Document): ResampleResult;
//# sourceMappingURL=image-resampler.d.ts.map