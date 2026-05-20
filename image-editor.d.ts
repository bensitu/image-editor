// image-editor.d.ts - TypeScript declarations for @bensitu/image-editor

declare module '@bensitu/image-editor' {
  import { Canvas, Image as FabricImage, Object as FabricObject } from 'fabric';

  export interface LabelOptions {
    getText?: (mask: MaskObject, maskIndex: number) => string;
    create?: (mask: MaskObject, fabric: any) => FabricObject;
    textOptions?: Record<string, any>;
  }

  export interface CropOptions {
    minWidth?: number;
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
    downsampleQuality?: number;

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
    width?: number | string | ((canvas: Canvas, options: ImageEditorOptions) => number);
    height?: number | string | ((canvas: Canvas, options: ImageEditorOptions) => number);
    radius?: number | string | ((canvas: Canvas, options: ImageEditorOptions) => number);
    rx?: number | string | ((canvas: Canvas, options: ImageEditorOptions) => number);
    ry?: number | string | ((canvas: Canvas, options: ImageEditorOptions) => number);
    points?: Array<{ x: number; y: number }>;
    color?: string;
    alpha?: number;
    gap?: number;
    left?: number | string | ((canvas: Canvas, options: ImageEditorOptions) => number);
    top?: number | string | ((canvas: Canvas, options: ImageEditorOptions) => number);
    angle?: number;
    selectable?: boolean;
    hasControls?: boolean;
    borderColor?: string;
    cornerColor?: string;
    cornerSize?: number;
    transparentCorners?: boolean;
    strokeUniform?: boolean;
    styles?: Record<string, any>;
    fabricGenerator?: (config: MaskConfig, canvas: Canvas, options: ImageEditorOptions) => FabricObject;
    onCreate?: (mask: MaskObject, canvas: Canvas) => void;
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
  }

  export interface ImageFileExportOptions {
    mergeMask?: boolean;
    fileType?: 'jpeg' | 'jpg' | 'png' | 'webp' | 'image/jpeg' | 'image/png' | 'image/webp';
    quality?: number;
    multiplier?: number;
    fileName?: string;
  }

  export class ImageEditor {
    readonly options: ImageEditorOptions;
    readonly canvas: Canvas | null;
    readonly canvasEl: HTMLCanvasElement | null;
    readonly containerEl: HTMLElement | null;
    readonly originalImage: FabricImage | null;
    readonly currentScale: number;
    readonly currentRotation: number;
    readonly maskCounter: number;
    readonly isAnimating: boolean;
    readonly isImageLoadedToCanvas: boolean;

    constructor(options?: ImageEditorOptions);

    init(idMap?: ElementIdMap): void;
    loadImage(base64: string): Promise<void>;
    isImageLoaded(): boolean;

    scaleImage(factor: number): Promise<void>;
    rotateImage(degrees: number): Promise<void>;
    reset(): Promise<void>;

    addMask(config?: MaskConfig): MaskObject | null;
    removeSelectedMask(): void;
    removeAllMasks(): void;

    merge(): Promise<void>;
    downloadImage(fileName?: string): void;
    getImageBase64(opts?: Base64ExportOptions): Promise<string>;
    exportImageFile(opts?: ImageFileExportOptions): Promise<File>;

    enterCropMode(): void;
    cancelCrop(): void;
    applyCrop(): Promise<void>;

    undo(): void;
    redo(): void;
    saveState(): void;
    loadFromState(jsonString: string | object): void;

    dispose(): void;
  }

  export default ImageEditor;
}
