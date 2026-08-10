/**
 * Pre-decode input-size guards for image loading.
 *
 * The loader uses these helpers before creating an HTMLImageElement so large
 * files and data URLs can be rejected from cheap metadata instead of relying on
 * post-decode downsampling.
 *
 * @module
 */
export interface ImageHeaderDimensions {
    readonly width: number;
    readonly height: number;
}
export interface ImageInputBudgetOptions {
    readonly maxInputBytes: number;
    readonly maxInputPixels: number;
}
export declare function readImageHeaderDimensions(bytes: Uint8Array): ImageHeaderDimensions | null;
export declare function estimateBase64PayloadBytes(dataUrl: string): number | null;
export declare function assertImageDataUrlInputBudget(dataUrl: string, options: ImageInputBudgetOptions): void;
export declare function assertImageFileInputBudget(file: File, options: ImageInputBudgetOptions): Promise<void>;
