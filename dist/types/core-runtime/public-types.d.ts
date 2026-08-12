/**
 * Publishes renderer-neutral Core construction, lifecycle, image, export, and event contracts.
 *
 * @module
 */
import type * as FabricNS from 'fabric';
import type { DocumentMutationDescriptor } from './mutation/index.js';
/** Fabric.js namespace accepted by {@link ImageEditorCore}. */
export type FabricModule = Omit<typeof FabricNS, 'default'> & {
    readonly default?: unknown;
};
/** Strategy used to place the Base Image within the available viewport. */
export type LayoutMode = 'fit' | 'cover' | 'expand';
/** Raster MIME types supported by image loading and export. */
export type ImageMimeType = 'image/jpeg' | 'image/png' | 'image/webp';
/** Region rendered by a Core export. */
export type ExportArea = 'image' | 'canvas';
/** Observable lifecycle state of an editor instance. */
export type EditorLifecycleState = 'configured' | 'initializing' | 'initialized' | 'disposing' | 'disposed' | 'faulted';
/** DOM element, selector, or explicit absence accepted during initialization. */
export type ElementTarget<TElement extends HTMLElement = HTMLElement> = string | TElement | null;
/** DOM targets required or optionally used by Core initialization. */
export interface CoreElementMap {
    /** Canvas element or selector used to create the Fabric Canvas. */
    readonly canvas: ElementTarget<HTMLCanvasElement>;
    /** Scrollable container used by responsive layout operations. */
    readonly canvasContainer?: ElementTarget<HTMLElement>;
    /** Element whose visibility reflects whether a Base Image is loaded. */
    readonly imagePlaceholder?: ElementTarget<HTMLElement>;
}
/** Construction options for {@link ImageEditorCore}. */
export interface ImageEditorCoreOptions {
    /** Fallback Canvas width when no measurable container is available. @defaultValue `800` */
    readonly canvasWidth?: number;
    /** Fallback Canvas height when no measurable container is available. @defaultValue `600` */
    readonly canvasHeight?: number;
    /** Fabric Canvas background color. @defaultValue `'transparent'` */
    readonly backgroundColor?: string;
    /** Initial image layout strategy. @defaultValue `'fit'` */
    readonly defaultLayoutMode?: LayoutMode;
    /** Default preprocessing applied before decoded images enter the document. */
    readonly imagePreprocessing?: ImagePreprocessingOptions;
    /** Enables Fabric multi-object selection. @defaultValue `false` */
    readonly groupSelection?: boolean;
    /** Maximum encoded image input size in bytes. */
    readonly maxInputBytes?: number;
    /** Maximum decoded pixel count accepted from an image source. */
    readonly maxInputPixels?: number;
    /** Maximum time allowed for browser image decoding. */
    readonly imageLoadTimeoutMs?: number;
    /** Maximum total pixel count produced by an export. */
    readonly maxExportPixels?: number;
    /** Maximum width or height produced by an export. */
    readonly maxExportDimension?: number;
    /** Default export scale multiplier. @defaultValue `1` */
    readonly exportMultiplier?: number;
    /** Defaults merged into each export call. */
    readonly exportDefaults?: CoreExportOptions;
    /** Data URL loaded during asynchronous initialization. */
    readonly initialImageBase64?: string;
    /** Receives operational failures after Core records diagnostics. */
    readonly onError?: (error: unknown, message: string) => void;
    /** Receives recoverable failures and listener errors. */
    readonly onWarning?: (error: unknown, message: string) => void;
}
/** Fully normalized Core configuration exposed by an editor instance. */
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
/** Controls one Data URL or File image load. */
export interface LoadImageOptions {
    /** Restores the container scroll position after a successful layout. */
    readonly preserveScroll?: boolean;
    /** Cancels file reading, preprocessing, or document replacement. */
    readonly signal?: AbortSignal;
    /** Replaces any pending image load; this is the only supported policy. */
    readonly concurrency?: 'replace-pending';
    /** Overrides configured preprocessing for this image. */
    readonly preprocessing?: ImagePreprocessingOptions;
}
/** Browser-side image normalization and downsampling policy. */
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
/** Fully normalized image preprocessing policy. */
export interface ResolvedImagePreprocessingOptions {
    readonly downsample: boolean;
    readonly maxWidth: number;
    readonly maxHeight: number;
    readonly quality: number;
    readonly format: ImageMimeType | null;
    readonly preserveSourceFormat: boolean;
    readonly normalizeExifOrientation: boolean;
}
/** Controls raster export area, encoding, scale, name, and Plugin contributions. */
export interface CoreExportOptions {
    /** Region to render. @defaultValue configured export area */
    readonly area?: ExportArea;
    /** Output encoder. @defaultValue configured export format */
    readonly format?: 'png' | 'jpeg' | 'webp';
    /** Lossy encoding quality from 0 through 1. */
    readonly quality?: number;
    /** Scale applied to the exported raster dimensions. */
    readonly multiplier?: number;
    /** Base file name used by {@link ImageEditorCore.exportImageFile}. */
    readonly fileName?: string;
    /** Per-contributor settings keyed by export contributor identifier. */
    readonly contributors?: Readonly<Record<string, unknown>>;
}
/** Fully normalized raster export configuration. */
export interface ResolvedCoreExportOptions {
    readonly area: ExportArea;
    readonly format: 'png' | 'jpeg' | 'webp';
    readonly quality: number;
    readonly multiplier: number;
    readonly fileName: string;
    readonly contributors: Readonly<Record<string, unknown>>;
}
/** Idempotent subscription handle returned by Core observers. */
export interface CoreSubscription {
    /** Stops future notifications and releases associated resources. */
    dispose(): void;
}
/** Controls an explicit responsive relayout. */
export interface ResponsiveLayoutOptions {
    /** Layout strategy applied before geometry is recomputed. */
    readonly mode?: LayoutMode;
    /** Restore the container scroll offset after layout commits. @defaultValue `false` */
    readonly preserveScroll?: boolean;
}
/** Controls automatic Canvas container observation. */
export interface ContainerObservationOptions {
    /** Resize once when observation starts. @defaultValue `true` */
    readonly resizeImmediately?: boolean;
}
/** Immutable snapshot of host-observable Core state. */
export interface CoreRuntimeStatus {
    readonly lifecycle: EditorLifecycleState;
    readonly initialized: boolean;
    readonly imageLoaded: boolean;
    readonly busy: boolean;
    readonly activeToolId: string | null;
    readonly layoutMode: LayoutMode;
    readonly geometryRevision: number;
}
/** Listener invoked when observable Core status changes. */
export type CoreStatusListener = (status: CoreRuntimeStatus) => void;
/** Listener invoked after the named committed Core event. */
export type CoreEventListener<TPayload> = (payload: TPayload) => void | Promise<void>;
/** Controls status subscription startup behavior. */
export interface CoreStatusSubscriptionOptions {
    /** Emit the current state before returning the subscription. @defaultValue `true` */
    readonly emitCurrent?: boolean;
}
/** Geometry and source information for the current Base Image. */
export interface CoreImageInfo {
    readonly width: number;
    readonly height: number;
    readonly naturalWidth: number;
    readonly naturalHeight: number;
    readonly mimeType: ImageMimeType | null;
    readonly geometryRevision: number;
}
/** Payload map for committed events published by Core. */
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
/** Serializable renderer state owned by Core. */
export interface CoreCanvasState {
    readonly initialized: boolean;
    readonly canvasWidth: number;
    readonly canvasHeight: number;
    readonly canvas: Readonly<Record<string, unknown>> | null;
    readonly imageMimeType: ImageMimeType | null;
    readonly baseImageScale: number;
    readonly geometryRevision: number;
}
