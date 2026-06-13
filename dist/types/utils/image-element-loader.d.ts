/**
 * Shared browser image element loading primitive.
 *
 * Callers provide their own error factory and validation so image loading and
 * export pipelines can share listener cleanup without sharing domain errors.
 *
 * @module
 */
export interface ImageElementLoadHandle {
    promise: Promise<HTMLImageElement>;
    cleanup(clearSource?: boolean): void;
}
export interface ImageElementLoadOptions {
    crossOrigin?: string;
    validate?: (imageElement: HTMLImageElement) => Error | null;
    createError: (event: Event | string) => Error;
}
export declare function startImageElementLoad(dataUrl: string, options: ImageElementLoadOptions): ImageElementLoadHandle;
//# sourceMappingURL=image-element-loader.d.ts.map