/**
 * @file export-format.ts
 * @description Pure helpers that normalize the user-facing
 * `Base64ExportOptions` / `ImageFileExportOptions` surface into the
 * canvas-/Fabric-shaped values consumed by `export/export-service.ts`.
 *
 * The module owns three small, individually testable building blocks plus
 * one orchestrating function, mirroring the shape of
 * `image/image-resampler.ts`:
 *
 *   - {@link normalizeImageFormat} — collapses `'jpg'` to `'jpeg'`, strips
 *     the `image/` MIME prefix, and falls back to `'jpeg'` for unknown or
 *     omitted input.
 *   - {@link mimeTypeFor}          — derives the matching `image/...` MIME
 *     for a normalized format token.
 *   - {@link clampQuality}         — coerces input to a finite number and
 *     clamps it into `[0, 1]`, falling back to a caller-supplied default
 *     when the input is not finite.
 *   - {@link resolveExportFormat}  — composes the above with the documented
 *     `fileType`-wins-over-`format` precedence and drops `quality` for PNG
 *     output.
 *
 * legacy parity:
 *   - The format mapping table mirrors `_normalizeImageFormat` from
 *     `src/image-editor.js@legacy.4.0`, including the lowercase lookup and the
 *     `'jpeg'` default for unknown input.
 *   - The quality clamp mirrors `_normalizeQuality` from the same legacy file:
 *     non-finite input falls back to `options.downsampleQuality`, finite
 *     input is clamped to `[0, 1]`.
 *
 * This module is internal — it is NOT re-exported from `src/index.ts`.
 *
 *      Fabric.
 *      lossless.
 *      `quality` defaulting to `options.downsampleQuality`.
 */
import type { Base64ExportOptions, ImageFileExportOptions, ImageMimeType, NormalizedImageFormat } from '../core/public-types.js';
/**
 * Result of {@link resolveExportFormat}.
 *
 * `quality` is `undefined` when the resolved format is `'png'` so callers can
 * omit it from `toDataURL` / Fabric's region-export options without an extra
 * branch.
 */
export interface ResolvedExportFormat {
    /** Canvas-/Fabric-compatible format token. */
    format: NormalizedImageFormat;
    /** Matching MIME type for `toDataURL` / `Blob` construction. */
    mimeType: ImageMimeType;
    /** Lossy quality in `[0, 1]`, or `undefined` for PNG. */
    quality: number | undefined;
}
/**
 * Collapse a public `ImageFileType` (or any string-ish input) to the
 * canonical `NormalizedImageFormat` token consumed by Fabric.
 *
 * Behavior:
 *   - `'jpg'` (and `'JPG'`, `'image/jpeg'`, `'IMAGE/JPEG'`, …) → `'jpeg'`.
 *   - `'png'` / `'image/png'` → `'png'` (case-insensitive).
 *   - `'webp'` / `'image/webp'` → `'webp'` (case-insensitive).
 *   - `null` / `undefined` / empty / unknown → `'jpeg'`.
 *
 * Pure function — no DOM access, safe to call from property tests.
 *
 * @param input Requested file type or MIME alias (case-insensitive).
 * @returns The normalized format token to pass to Fabric's `format` arg.
 *
 */
export declare function normalizeImageFormat(input?: string | null): NormalizedImageFormat;
/**
 * Collapse a public file type or MIME alias to a normalized format token.
 * Returns `null` for omitted or unknown input so call sites with a different
 * fallback policy can decide explicitly.
 *
 * Pure function — no DOM access, safe to call from property tests.
 */
export declare function tryNormalizeImageFormat(input?: string | null): NormalizedImageFormat | null;
/**
 * Derive the `image/...` MIME type for a normalized format token.
 *
 * Pure function — no DOM access, safe to call from property tests.
 *
 * @param format Normalized format token.
 * @returns The matching `ImageMimeType`.
 *
 */
export declare function mimeTypeFor(format: NormalizedImageFormat): ImageMimeType;
/**
 * Coerce `quality` to a finite number and clamp it into `[0, 1]`.
 *
 * Behavior:
 *   - `Number(quality)` is finite → `Math.max(0, Math.min(1, n))`.
 *   - Otherwise (`NaN`, `Infinity`, non-numeric strings, `null`, `undefined`,
 *     objects, …) → `fallback` (NOT re-clamped; the editor pre-validates
 *     `downsampleQuality` at construction time).
 *
 * Pure function — no DOM access, safe to call from property tests.
 *
 * @param quality  Caller-supplied quality (may be any type).
 * @param fallback Quality to use when `quality` is not a finite number.
 *                 Typically `options.downsampleQuality`.
 * @returns A finite quality value in `[0, 1]`, or the `fallback` when input
 *          was not finite.
 *
 */
export declare function clampQuality(quality: unknown, fallback: number): number;
/**
 * Resolve the user-facing export options into the canvas-/Fabric-shaped
 * values consumed by `export/export-service.ts`.
 *
 * Precedence (matches legacy `exportImageBase64` / `exportImageFile`):
 *   1. `options.fileType` wins over `options.format` when both are supplied
 *      and `options.fileType` is truthy. Falsy `fileType` falls through to
 *      `options.format`. Both omitted → `'jpeg'`.
 *   2. `options.quality` is normalized through {@link clampQuality} with
 *      `downsampleQuality` as the fallback. When `options.quality` is
 *      `undefined` or `null`, the fallback is used directly (Contract
 *      26.4).
 *   3. When the resolved format is `'png'`, `quality` is dropped from the
 *      result so call sites pass `undefined` to `toDataURL` (Contract
 *      26.3).
 *
 * Pure function — no DOM access, safe to call from property tests.
 *
 * @param options            Subset of `Base64ExportOptions` /
 *                           `ImageFileExportOptions` carrying `fileType`,
 *                           `format`, and `quality`. Other fields are
 *                           ignored. `format` is only read from options
 *                           that declare it (i.e. `Base64ExportOptions`).
 * @param downsampleQuality  Default quality used when `options.quality` is
 *                           omitted or non-finite. Sourced from
 *                           `ResolvedOptions.downsampleQuality`.
 * @returns The resolved `{ format, mimeType, quality}` triple.
 *
 */
export declare function resolveExportFormat(options: Pick<Base64ExportOptions, 'fileType' | 'format' | 'quality'> | Pick<ImageFileExportOptions, 'fileType' | 'quality'> | undefined | null, downsampleQuality: number): ResolvedExportFormat;
//# sourceMappingURL=export-format.d.ts.map