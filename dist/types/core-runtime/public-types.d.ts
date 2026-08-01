/**
 * Publishes renderer-neutral Core construction, lifecycle, image, export, and event contracts.
 *
 * @module
 */
import type * as FabricNS from 'fabric';
import type { DocumentMutationDescriptor } from './mutation/index.js';
export type FabricModule = Omit<typeof FabricNS, 'default'> & {
    readonly default?: unknown;
};
export type LayoutMode = 'fit' | 'cover' | 'expand';
export type ImageMimeType = 'image/jpeg' | 'image/png' | 'image/webp';
export type ExportArea = 'image' | 'canvas';
export type EditorLifecycleState = 'configured' | 'initializing' | 'initialized' | 'disposing' | 'disposed' | 'faulted';
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
    readonly imagePreprocessing?: ImagePreprocessingOptions;
    readonly groupSelection?: boolean;
    readonly maxInputBytes?: number;
    readonly maxInputPixels?: number;
    readonly imageLoadTimeoutMs?: number;
    readonly maxExportPixels?: number;
    readonly maxExportDimension?: number;
    readonly exportMultiplier?: number;
    readonly exportDefaults?: CoreExportOptions;
    readonly initialImageBase64?: string;
    readonly onError?: (error: unknown, message: string) => void;
    readonly onWarning?: (error: unknown, message: string) => void;
}
export interface ResolvedImageEditorCoreOptions {
    readonly canvasWidth: number;
    readonly canvasHeight: number;
    readonly backgroundColor: string;
    readonly layoutMode: LayoutMode;
    readonly imagePreprocessing: ResolvedImagePreprocessingOptions;
    readonly groupSelection: boolean;
    readonly maxInputBytes: number;
    readonly maxInputPixels: number;
    readonly imageLoadTimeoutMs: number;
    readonly maxExportPixels: number;
    readonly maxExportDimension: number;
    readonly exportMultiplier: number;
    readonly exportDefaults: ResolvedCoreExportOptions;
    readonly initialImageBase64: string;
    readonly onError?: (error: unknown, message: string) => void;
    readonly onWarning?: (error: unknown, message: string) => void;
}
export interface LoadImageOptions {
    readonly preserveScroll?: boolean;
    readonly signal?: AbortSignal;
    readonly concurrency?: 'replace-pending';
    readonly preprocessing?: ImagePreprocessingOptions;
}
export interface ImagePreprocessingOptions {
    /** Downsample images that exceed the configured dimensions. @defaultValue `true` */
    readonly downsample?: boolean;
    /** Maximum oriented width retained by preprocessing. @defaultValue `4000` */
    readonly maxWidth?: number;
    /** Maximum oriented height retained by preprocessing. @defaultValue `3000` */
    readonly maxHeight?: number;
    /** Lossy encoding quality from 0 through 1. @defaultValue `0.92` */
    readonly quality?: number;
    /** Explicit output MIME type. `null` delegates to source-format policy. @defaultValue `null` */
    readonly format?: ImageMimeType | null;
    /** Preserve the source MIME type when no explicit format is set. @defaultValue `true` */
    readonly preserveSourceFormat?: boolean;
    /** Parse and normalize supported JPEG EXIF orientation values. @defaultValue `true` */
    readonly normalizeExifOrientation?: boolean;
}
export interface ResolvedImagePreprocessingOptions {
    readonly downsample: boolean;
    readonly maxWidth: number;
    readonly maxHeight: number;
    readonly quality: number;
    readonly format: ImageMimeType | null;
    readonly preserveSourceFormat: boolean;
    readonly normalizeExifOrientation: boolean;
}
export interface CoreExportOptions {
    readonly area?: ExportArea;
    readonly format?: 'png' | 'jpeg' | 'webp';
    readonly quality?: number;
    readonly multiplier?: number;
    readonly fileName?: string;
    readonly contributors?: Readonly<Record<string, unknown>>;
}
export interface ResolvedCoreExportOptions {
    readonly area: ExportArea;
    readonly format: 'png' | 'jpeg' | 'webp';
    readonly quality: number;
    readonly multiplier: number;
    readonly fileName: string;
    readonly contributors: Readonly<Record<string, unknown>>;
}
export interface CoreSubscription {
    dispose(): void;
}
export interface ResponsiveLayoutOptions {
    /** Layout strategy applied before geometry is recomputed. */
    readonly mode?: LayoutMode;
    /** Restore the container scroll offset after layout commits. @defaultValue `false` */
    readonly preserveScroll?: boolean;
}
export interface ContainerObservationOptions {
    /** Resize once when observation starts. @defaultValue `true` */
    readonly resizeImmediately?: boolean;
}
export interface CoreRuntimeStatus {
    readonly lifecycle: EditorLifecycleState;
    readonly initialized: boolean;
    readonly imageLoaded: boolean;
    readonly busy: boolean;
    readonly activeToolId: string | null;
    readonly layoutMode: LayoutMode;
    readonly geometryRevision: number;
}
export type CoreStatusListener = (status: CoreRuntimeStatus) => void;
export type CoreEventListener<TPayload> = (payload: TPayload) => void | Promise<void>;
export interface CoreStatusSubscriptionOptions {
    /** Emit the current state before returning the subscription. @defaultValue `true` */
    readonly emitCurrent?: boolean;
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
    readonly 'document:committed': DocumentMutationDescriptor;
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
