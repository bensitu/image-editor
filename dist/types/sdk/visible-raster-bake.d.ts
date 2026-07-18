import type { CoreImageInfo, DocumentMutationContext } from '../core/contracts.js';
/** Encoding policy used when committed visual effects are folded into the Base Image. */
export interface VisibleRasterBakeOptions {
    readonly format?: 'png' | 'jpeg' | 'webp';
    readonly quality?: number;
}
/** Outcome of preparing the visible Base Image inside a caller-owned mutation. */
export interface VisibleRasterBakeResult {
    readonly didBake: boolean;
    readonly mimeType: CoreImageInfo['mimeType'] | null;
}
/** Optional implementation-free boundary for materializing visible Raster state. */
export interface VisibleRasterBakePort {
    hasVisibleState(): boolean;
    bakeIntoBase(context: DocumentMutationContext, options?: VisibleRasterBakeOptions): Promise<VisibleRasterBakeResult>;
}
export declare const VISIBLE_RASTER_BAKE_CAPABILITY: import("./index.js").CapabilityToken<VisibleRasterBakePort>;
