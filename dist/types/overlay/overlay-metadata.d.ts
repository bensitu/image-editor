/**
 * JSON-compatible metadata validation and cloning helpers.
 *
 * @module
 */
import type { OverlayImportWarning, OverlayMetadata, OverlayValidationError, OverlayValidationOptions } from './overlay-state-types.js';
export declare const DEFAULT_METADATA_DEPTH = 4;
export declare const DEFAULT_METADATA_BYTES = 65536;
export interface MetadataValidationResult {
    value?: OverlayMetadata;
    errors: OverlayValidationError[];
    warnings: OverlayImportWarning[];
}
export declare function validateOverlayMetadata(input: unknown, path: string, options?: OverlayValidationOptions): MetadataValidationResult;
export declare function cloneOverlayMetadata(metadata: OverlayMetadata | undefined): OverlayMetadata | undefined;
