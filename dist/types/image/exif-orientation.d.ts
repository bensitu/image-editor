/**
 * JPEG EXIF orientation parser and file-normalization helpers.
 *
 * This module intentionally parses only the APP1 Exif/TIFF fields required to
 * read orientation tag `0x0112`. It does not preserve or expose arbitrary
 * metadata.
 *
 * @module
 */
import type { ResolvedOptions } from '../core/public-types.js';
export type JpegExifOrientation = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
/**
 * Read the JPEG EXIF orientation value from an ArrayBuffer.
 *
 * Returns `null` for non-JPEG data, missing EXIF metadata, malformed segment
 * structure, truncated TIFF data, or unsupported orientation values.
 */
export declare function readJpegExifOrientation(buffer: ArrayBuffer): JpegExifOrientation | null;
export declare function isJpegFile(file: File): boolean;
/**
 * Normalize a JPEG file data URL when its EXIF orientation requires a canvas
 * transform. Returns `null` when no normalization is needed.
 */
export declare function normalizeJpegOrientationIfNeeded(file: File, dataUrl: string, options: ResolvedOptions, ownerDocument?: Document | null): Promise<string | null>;
