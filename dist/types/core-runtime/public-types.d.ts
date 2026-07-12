import type * as FabricNS from 'fabric';
export type FabricModule = Omit<typeof FabricNS, 'default'> & {
    readonly default?: unknown;
};
export type LayoutMode = 'fit' | 'cover' | 'expand';
export type ImageMimeType = 'image/jpeg' | 'image/png' | 'image/webp';
export type ExportArea = 'image' | 'canvas';
export type ElementTarget<TElement extends HTMLElement = HTMLElement> = string | TElement | null;
export interface CoreElementMap {
    readonly canvas: ElementTarget<HTMLCanvasElement>;
    readonly canvasContainer?: ElementTarget<HTMLElement>;
    readonly imagePlaceholder?: ElementTarget<HTMLElement>;
}
export interface ImageEditorCoreOptions {
    readonly canvasWidth?: number;
    readonly canvasHeight?: number;
    readonly backgroundColor?: string;
    readonly defaultLayoutMode?: LayoutMode;
    readonly groupSelection?: boolean;
    readonly maxInputBytes?: number;
    readonly maxInputPixels?: number;
    readonly imageLoadTimeoutMs?: number;
    readonly maxExportPixels?: number;
    readonly maxExportDimension?: number;
    readonly exportMultiplier?: number;
    readonly initialImageBase64?: string;
    readonly onError?: (error: unknown, message: string) => void;
    readonly onWarning?: (error: unknown, message: string) => void;
}
export interface ResolvedImageEditorCoreOptions {
    readonly canvasWidth: number;
    readonly canvasHeight: number;
    readonly backgroundColor: string;
    readonly layoutMode: LayoutMode;
    readonly groupSelection: boolean;
    readonly maxInputBytes: number;
    readonly maxInputPixels: number;
    readonly imageLoadTimeoutMs: number;
    readonly maxExportPixels: number;
    readonly maxExportDimension: number;
    readonly exportMultiplier: number;
    readonly initialImageBase64: string;
    readonly onError?: (error: unknown, message: string) => void;
    readonly onWarning?: (error: unknown, message: string) => void;
}
export interface LoadImageOptions {
    readonly preserveScroll?: boolean;
}
export interface CoreExportOptions {
    readonly area?: ExportArea;
    readonly format?: 'png' | 'jpeg' | 'webp';
    readonly quality?: number;
    readonly multiplier?: number;
    readonly fileName?: string;
    readonly contributors?: Readonly<Record<string, unknown>>;
}
export interface CoreImageInfo {
    readonly width: number;
    readonly height: number;
    readonly naturalWidth: number;
    readonly naturalHeight: number;
    readonly mimeType: ImageMimeType | null;
    readonly geometryRevision: number;
}
export interface CoreEventMap {
    readonly 'geometry:committed': unknown;
    readonly 'image:loaded': CoreImageInfo;
    readonly 'image:cleared': Readonly<{
        geometryRevision: number;
    }>;
    readonly 'state:loaded': Readonly<{
        schemaVersion: 3;
    }>;
    readonly 'raster:committed': Readonly<{
        operationId: string;
    }>;
}
export interface CoreCanvasState {
    readonly initialized: boolean;
    readonly canvasWidth: number;
    readonly canvasHeight: number;
    readonly canvas: Readonly<Record<string, unknown>> | null;
    readonly imageMimeType: ImageMimeType | null;
    readonly baseImageScale: number;
    readonly geometryRevision: number;
}
