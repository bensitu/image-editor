// image-editor.d.ts - TypeScript declarations for @bensitu/image-editor

declare module '@bensitu/image-editor' {
  export interface FabricCanvas {
    [key: string]: any;
  }

  export interface FabricObject {
    [key: string]: any;
  }

  export interface FabricImage extends FabricObject {
    width: number;
    height: number;
  }

  export interface LabelOptions {
    /** Receives the mask and its stable zero-based creation index (`mask.maskId - 1`). */
    getText?: (mask: MaskObject, creationIndex: number) => string;
    create?: (mask: MaskObject, fabric: any) => FabricObject;
    textOptions?: Record<string, any>;
  }

  export interface CropOptions {
    /** Minimum crop rectangle width, clamped to the current image bounds. */
    minWidth?: number;
    /** Minimum crop rectangle height, clamped to the current image bounds. */
    minHeight?: number;
    padding?: number;
    hideMasksDuringCrop?: boolean;
    preserveMasksAfterCrop?: boolean;
    allowRotationOfCropRect?: boolean;
  }

  export interface ImageEditorOptions {
    canvasWidth?: number;
    canvasHeight?: number;
    backgroundColor?: string;
    animationDuration?: number;
    minScale?: number;
    maxScale?: number;
    scaleStep?: number;
    rotationStep?: number;

    expandCanvasToImage?: boolean;
    fitImageToCanvas?: boolean;
    coverImageToCanvas?: boolean;

    downsampleOnLoad?: boolean;
    downsampleMaxWidth?: number;
    downsampleMaxHeight?: number;
    downsampleQuality?: number | null;
    preserveSourceFormat?: boolean;
    downsampleMimeType?: 'jpeg' | 'jpg' | 'png' | 'webp' | 'image/jpeg' | 'image/png' | 'image/webp' | null;
    imageLoadTimeoutMs?: number;

    exportMultiplier?: number;
    exportImageAreaByDefault?: boolean;

    defaultMaskWidth?: number;
    defaultMaskHeight?: number;
    maskRotatable?: boolean;
    maskLabelOnSelect?: boolean;
    maskLabelOffset?: number;
    maskName?: string;

    groupSelection?: boolean;

    showPlaceholder?: boolean;
    initialImageBase64?: string | null;
    defaultDownloadFileName?: string;

    label?: LabelOptions;
    crop?: CropOptions;

    onImageLoaded?: () => void;
    onError?: (error: unknown, message: string) => void;
    onWarning?: (error: unknown, message: string) => void;
  }

  export interface ElementIdMap {
    canvas?: string;
    canvasContainer?: string | null;
    imgPlaceholder?: string;
    scaleRate?: string;
    rotationLeftInput?: string;
    rotationRightInput?: string;
    rotateLeftBtn?: string;
    rotateRightBtn?: string;
    addMaskBtn?: string;
    removeMaskBtn?: string;
    removeAllMasksBtn?: string;
    mergeBtn?: string;
    downloadBtn?: string;
    maskList?: string;
    zoomInBtn?: string;
    zoomOutBtn?: string;
    resetBtn?: string;
    undoBtn?: string;
    redoBtn?: string;
    imageInput?: string;
    uploadArea?: string;
    cropBtn?: string;
    applyCropBtn?: string;
    cancelCropBtn?: string;
  }

  export interface MaskConfig {
    shape?: 'rect' | 'circle' | 'ellipse' | 'polygon' | string;
    width?: number | string | ((canvas: FabricCanvas, options: ImageEditorOptions) => number);
    height?: number | string | ((canvas: FabricCanvas, options: ImageEditorOptions) => number);
    radius?: number | string | ((canvas: FabricCanvas, options: ImageEditorOptions) => number);
    rx?: number | string | ((canvas: FabricCanvas, options: ImageEditorOptions) => number);
    ry?: number | string | ((canvas: FabricCanvas, options: ImageEditorOptions) => number);
    points?: Array<{ x: number; y: number }> | Array<[number, number]>;
    color?: string;
    alpha?: number;
    gap?: number;
    left?: number | string | ((canvas: FabricCanvas, options: ImageEditorOptions) => number);
    top?: number | string | ((canvas: FabricCanvas, options: ImageEditorOptions) => number);
    angle?: number;
    selectable?: boolean;
    hasControls?: boolean;
    borderColor?: string;
    cornerColor?: string;
    cornerSize?: number;
    transparentCorners?: boolean;
    strokeUniform?: boolean;
    styles?: Record<string, any>;
    fabricGenerator?: (config: MaskConfig, canvas: FabricCanvas, options: ImageEditorOptions) => FabricObject;
    onCreate?: (mask: MaskObject, canvas: FabricCanvas) => void;
  }

  export interface MaskObject extends FabricObject {
    maskId: number;
    maskName: string;
    originalAlpha: number;
    __label?: FabricObject;
  }

  export interface Base64ExportOptions {
    exportImageArea?: boolean;
    multiplier?: number;
    quality?: number;
    fileType?: 'jpeg' | 'jpg' | 'png' | 'webp' | 'image/jpeg' | 'image/png' | 'image/webp';
    format?: 'jpeg' | 'jpg' | 'png' | 'webp' | 'image/jpeg' | 'image/png' | 'image/webp';
  }

  export interface ImageFileExportOptions {
    mergeMask?: boolean;
    fileType?: 'jpeg' | 'jpg' | 'png' | 'webp' | 'image/jpeg' | 'image/png' | 'image/webp';
    quality?: number;
    multiplier?: number;
    fileName?: string;
  }

  export interface RemoveAllMasksOptions {
    saveHistory?: boolean;
  }

  export interface LoadImageOptions {
    preserveScroll?: boolean;
  }

  export class ImageEditor {
    readonly options: ImageEditorOptions;
    readonly canvas: FabricCanvas | null;
    readonly canvasElement: HTMLCanvasElement | null;
    readonly containerElement: HTMLElement | null;
    readonly placeholderElement: HTMLElement | null;
    /** @deprecated Use canvasElement instead. This alias will be removed in v2.0.0. */
    readonly canvasEl: HTMLCanvasElement | null;
    /** @deprecated Use containerElement instead. This alias will be removed in v2.0.0. */
    readonly containerEl: HTMLElement | null;
    /** @deprecated Use placeholderElement instead. This alias will be removed in v2.0.0. */
    readonly placeholderEl: HTMLElement | null;
    readonly originalImage: FabricImage | null;
    readonly currentScale: number;
    readonly currentRotation: number;
    readonly maskCounter: number;
    readonly isAnimating: boolean;
    readonly isImageLoadedToCanvas: boolean;

    constructor(options?: ImageEditorOptions);

    init(idMap?: ElementIdMap): void;
    loadImage(imageBase64: string, options?: LoadImageOptions): Promise<void>;
    isImageLoaded(): boolean;
    isBusy(): boolean;

    /** Public callers should pass only `factor`; internal history control options are intentionally not exposed. */
    scaleImage(factor: number): Promise<void>;
    /** Public callers should pass only `degrees`; internal history control options are intentionally not exposed. */
    rotateImage(degrees: number): Promise<void>;
    resetImageTransform(): Promise<void>;
    /** @deprecated Use resetImageTransform() instead. This alias will be removed in v2.0.0. */
    reset(): Promise<void>;

    createMask(config?: MaskConfig): MaskObject | null;
    /** @deprecated Use createMask() instead. This alias will be removed in v2.0.0. */
    addMask(config?: MaskConfig): MaskObject | null;
    removeSelectedMask(): void;
    removeAllMasks(options?: RemoveAllMasksOptions): void;

    mergeMasks(): Promise<void>;
    /** @deprecated Use mergeMasks() instead. This alias will be removed in v2.0.0. */
    merge(): Promise<void>;
    downloadImage(fileName?: string): void;
    exportImageBase64(options?: Base64ExportOptions): Promise<string>;
    /** @deprecated Use exportImageBase64() instead. This alias will be removed in v2.0.0. */
    getImageBase64(options?: Base64ExportOptions): Promise<string>;
    exportImageFile(options?: ImageFileExportOptions): Promise<File>;

    enterCropMode(): void;
    cancelCrop(): void;
    applyCrop(): Promise<void>;

    undo(): Promise<void>;
    redo(): Promise<void>;
    saveState(): void;
    loadFromState(serializedState: string | object): Promise<void>;

    dispose(): void;
  }

  export default ImageEditor;
}
