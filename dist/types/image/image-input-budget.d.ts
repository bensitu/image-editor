/**
 * Pre-decode input-size guards for image loading.
 *
 * The loader uses these helpers before creating an HTMLImageElement so large
 * files and data URLs can be rejected from cheap metadata instead of relying on
 * post-decode downsampling.
 *
 * @module
 */
import type { ResolvedOptions } from '../core/public-types.js';
export interface ImageHeaderDimensions {
    readonly width: number;
    readonly height: number;
}
export declare function readImageHeaderDimensions(bytes: Uint8Array): ImageHeaderDimensions | null;
export declare function estimateBase64PayloadBytes(dataUrl: string): number | null;
export declare function assertImageDataUrlInputBudget(dataUrl: string, options: ResolvedOptions): void;
export declare function assertImageFileInputBudget(file: File, options: ResolvedOptions): Promise<void>;
