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

import type {
    Base64ExportOptions,
    ImageFileExportOptions,
    ImageMimeType,
    NormalizedImageFormat,
} from '../core/public-types.js';

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
 * Mapping table from accepted file-type aliases (bare format tokens and full
 * MIME types, in any case) to the normalized format token consumed by Fabric.
 *
 * Keys are kept lowercase; callers must lowercase the input before lookup.
 *
 */
const FORMAT_ALIAS_TABLE: Readonly<Record<string, NormalizedImageFormat>> = Object.freeze({
    jpeg: 'jpeg',
    jpg: 'jpeg',
    'image/jpeg': 'jpeg',
    png: 'png',
    'image/png': 'png',
    webp: 'webp',
    'image/webp': 'webp',
});

/**
 * MIME table keyed by the normalized format token.
 *
 * Used by {@link mimeTypeFor} so callers do not concatenate `'image/'` with
 * the format string by hand.
 */
const MIME_TABLE: Readonly<Record<NormalizedImageFormat, ImageMimeType>> = Object.freeze({
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
});

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
export function normalizeImageFormat(
    input?: string | null,
): NormalizedImageFormat {
    // Match legacy's `String(format || 'jpeg').toLowerCase` — falsy input
    // (including `null`, `undefined`, and `''`) collapses to `'jpeg'` before
    // the table lookup.
    const key = String(input || 'jpeg').toLowerCase();
    if (Object.prototype.hasOwnProperty.call(FORMAT_ALIAS_TABLE, key)) {
        return FORMAT_ALIAS_TABLE[key] ?? 'jpeg';
    }
    return 'jpeg';
}

/**
 * Derive the `image/...` MIME type for a normalized format token.
 *
 * Pure function — no DOM access, safe to call from property tests.
 *
 * @param format Normalized format token.
 * @returns The matching `ImageMimeType`.
 *
 */
export function mimeTypeFor(format: NormalizedImageFormat): ImageMimeType {
    return MIME_TABLE[format];
}

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
export function clampQuality(quality: unknown, fallback: number): number {
    const numeric = Number(quality);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.max(0, Math.min(1, numeric));
}

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
export function resolveExportFormat(
    options:
        | Pick<Base64ExportOptions, 'fileType' | 'format' | 'quality'>
        | Pick<ImageFileExportOptions, 'fileType' | 'quality'>
        | undefined
        | null,
    downsampleQuality: number,
): ResolvedExportFormat {
    const opts = options ?? {};
    // legacy used `options.fileType || options.format` (logical-or) so falsy
    // `fileType` (e.g. empty string) falls through to `format`. Preserve
    // that to keep observable behavior identical.
    const fileType = (opts as Base64ExportOptions).fileType;
    const formatAlias = (opts as Base64ExportOptions).format;
    const requested = fileType || formatAlias;

    const format = normalizeImageFormat(requested);
    const mimeType = mimeTypeFor(format);

    if (format === 'png') {
        // PNG is lossless — `quality` is meaningless and SHALL be ignored
        //. Returning `undefined` lets call sites omit the
        // argument from `toDataURL` / Fabric's region-export options.
        return { format, mimeType, quality: undefined };
    }

    // For lossy formats, fall back to `downsampleQuality` when the caller
    // omitted `quality` and clamp anything else into
    // `[0, 1]`. Mirrors legacy's
    // `_normalizeQuality(options.quality ?? options.downsampleQuality)`:
    // the `??` resolves the default first, then the clamp is applied
    // uniformly so the result is always in `[0, 1]` regardless of the
    // fallback's source.
    const rawQuality = opts.quality ?? downsampleQuality;
    const quality = clampQuality(rawQuality, downsampleQuality);

    return { format, mimeType, quality };
}
