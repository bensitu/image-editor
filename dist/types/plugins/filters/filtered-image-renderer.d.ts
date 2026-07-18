import type * as FabricNS from 'fabric';
import type { FabricModule, ImageMimeType } from '../../core/index.js';
import type { BaseImageInfoPort, ImageResourcePolicyPort } from '../../sdk/index.js';
import type { FilterDefinition } from './filter-definitions.js';
export interface FilterBakeOptions {
    readonly format?: 'png' | 'jpeg' | 'webp';
    readonly quality?: number;
}
export interface BakedImageResult {
    readonly image: FabricNS.FabricImage;
    readonly mimeType: ImageMimeType;
}
export declare function disposeFabricImage(image: FabricNS.FabricImage | null): void;
export declare function copyBaseImagePresentation(source: FabricNS.FabricImage, target: FabricNS.FabricImage, options?: Readonly<{
    backgroundColor?: string;
    transient?: boolean;
}>): void;
export declare function createFilteredImageClone(fabric: FabricModule, baseImage: FabricNS.FabricImage, definitions: readonly FilterDefinition[], signal: AbortSignal, backgroundColor?: string): Promise<FabricNS.FabricImage>;
export declare function normalizeFilterBakeOptions(options: FilterBakeOptions | undefined, sourceMimeType: ImageMimeType | null): Readonly<{
    format: 'png' | 'jpeg' | 'webp';
    quality?: number;
    mimeType: ImageMimeType;
}>;
export declare function renderBakedImage(fabric: FabricModule, baseImage: FabricNS.FabricImage, definitions: readonly FilterDefinition[], options: FilterBakeOptions | undefined, imageInfo: ReturnType<BaseImageInfoPort['getImageInfo']>, policy: ReturnType<ImageResourcePolicyPort['getImageResourcePolicy']>, signal: AbortSignal): Promise<BakedImageResult>;
