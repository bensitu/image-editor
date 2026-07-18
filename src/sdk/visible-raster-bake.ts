import type { CoreImageInfo, DocumentMutationContext } from '../core/contracts.js';
import { createCapabilityToken } from '../plugin-kernel/capability-token.js';

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
    bakeIntoBase(
        context: DocumentMutationContext,
        options?: VisibleRasterBakeOptions,
    ): Promise<VisibleRasterBakeResult>;
}

export const VISIBLE_RASTER_BAKE_CAPABILITY = createCapabilityToken<VisibleRasterBakePort>(
    'raster:visible-bake',
    '1.0.0',
);
