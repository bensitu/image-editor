// image-editor.d.ts - TypeScript type definition files

declare module 'image-editor' {
  import { Canvas, Image as FabricImage, Object as FabricObject } from 'fabric';

  // Basic configuration interface
  export interface ImageEditorOptions {
    // Canvas configuration
    canvasWidth?: number;
    canvasHeight?: number;
    backgroundColor?: string;

    // Animation configuration
    animationDuration?: number;
    minScale?: number;
    maxScale?: number;
    scaleStep?: number;
    rotationStep?: number;

    // Image processing configuration
    expandCanvasToImage?: boolean;
    fitImageToCanvas?: boolean;
    downsampleOnLoad?: boolean;
    downsampleMaxPixels?: number;
    downsampleQuality?: number;

    // Export configuration
    exportMultiplier?: number;
    exportImageAreaByDefault?: boolean;

    // Mask configuration
    defaultMaskWidth?: number;
    defaultMaskHeight?: number;
    maskRotatable?: boolean;
    maskLabelOnSelect?: boolean;
    maskLabelOffset?: number;
    maskName?: string;

    // UI configuration
    showPlaceholder?: boolean;
    initialImageBase64?: string | null;
    defaultDownloadFileName?: string;
    language?: 'en' | 'zh' | 'es' | 'fr';
    theme?: 'light' | 'dark';

    // Callback function
    onImageLoaded?: () => void;
    onError?: (error: ImageEditorError) => void;
    onMaskAdded?: (mask: MaskObject) => void;
    onMaskRemoved?: (maskId: number) => void;
  }

  // Element ID Mapping Interface
  export interface ElementIdMap {
    canvas?: string;
    canvasContainer?: string;
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
    imageInput?: string;
    uploadArea?: string;
  }

  // Mask configuration interface
  export interface MaskConfig {
    width?: number;
    height?: number;
    color?: string;
    alpha?: number;
    gap?: number;
    left?: number;
    top?: number;
    selectable?: boolean;
    rotatable?: boolean;
  }

  // Mask Object Interface
  export interface MaskObject extends FabricObject {
    maskId: number;
    maskName: string;
    originalAlpha: number;
    __label?: FabricObject;
  }

  // Export options interface
  export interface ExportOptions {
    format?: 'png' | 'jpeg' | 'webp' | 'svg' | 'json';
    quality?: number;
    multiplier?: number;
    exportImageArea?: boolean;
    fileName?: string;
    includeBackground?: boolean;
  }

  // Event interface
  export interface EventData {
    maskAdded: { mask: MaskObject; count: number };
    maskRemoved: { maskId: number; count: number };
    maskSelected: { mask: MaskObject | null };
    imageLoaded: { image: FabricImage; dimensions: { width: number; height: number } };
    imageScaled: { scale: number; previousScale: number };
    imageRotated: { angle: number; previousAngle: number };
    canvasResized: { width: number; height: number };
    exportStarted: { format: string; options: ExportOptions };
    exportCompleted: { format: string; dataUrl: string };
    error: { type: string; message: string; originalError?: Error };
    stateChanged: { canUndo: boolean; canRedo: boolean };
  }

  // Event callback type
  export type EventCallback<T = any> = (data: T) => void;

  // Error Class
  export class ImageEditorError extends Error {
    code: string;
    originalError?: Error;

    constructor(message: string, code: string, originalError?: Error);
  }

  // History Status Interface
  export interface HistoryState {
    canvasData: string;
    timestamp: number;
    description?: string;
  }

  // Main class definition
  export class ImageEditor {
    // Public attributes
    readonly options: Required<ImageEditorOptions>;
    readonly canvas: Canvas | null;
    readonly canvasEl: HTMLCanvasElement | null;
    readonly containerEl: HTMLElement | null;
    readonly originalImage: FabricImage | null;
    readonly currentScale: number;
    readonly currentRotation: number;
    readonly maskCounter: number;
    readonly isAnimating: boolean;
    readonly isImageLoadedToCanvas: boolean;

    // Constructor
    constructor(options?: ImageEditorOptions);

    // Initialization method
    init(idMap?: ElementIdMap): void;

    // Image operation method
    loadImage(base64: string): Promise<void>;
    isImageLoaded(): boolean;
    scaleImage(factor: number): Promise<void>;
    rotateImage(degrees: number): Promise<void>;
    reset(): Promise<void>;

    // Mask control method
    addMask(config?: MaskConfig): MaskObject | null;
    addCircleMask(config?: MaskConfig & { radius?: number }): MaskObject | null;
    addPolygonMask(points: Array<{ x: number, y: number }>, config?: MaskConfig): MaskObject | null;
    removeSelectedMask(): void;
    removeAllMasks(): void;
    removeMask(maskId: number): boolean;
    getMask(maskId: number): MaskObject | null;
    getAllMasks(): MaskObject[];
    selectMask(maskId: number): boolean;

    // Export method
    merge(): Promise<void>;
    downloadImage(fileName?: string, options?: ExportOptions): Promise<void>;
    getImageBase64(options?: ExportOptions): Promise<string>;
    exportAs(format: ExportOptions['format'], options?: ExportOptions): Promise<string>;

    // Historical control method
    undo(): boolean;
    redo(): boolean;
    canUndo(): boolean;
    canRedo(): boolean;
    saveState(description?: string): void;

    // Event system method
    on<K extends keyof EventData>(event: K, callback: EventCallback<EventData[K]>): void;
    off<K extends keyof EventData>(event: K, callback?: EventCallback<EventData[K]>): void;
    emit<K extends keyof EventData>(event: K, data: EventData[K]): void;

    // Tools
    setTheme(theme: 'light' | 'dark'): void;
    setLanguage(lang: string): void;
    validateOptions(options: ImageEditorOptions): boolean;
    getCanvasDimensions(): { width: number; height: number };
    setCanvasDimensions(width: number, height: number): void;

    // Life cycle method
    dispose(): void;
  }

  // Factory function
  export function createImageEditor(options?: ImageEditorOptions): ImageEditor;

  // Practical type
  export type MaskShape = 'rectangle' | 'circle' | 'polygon' | 'freeform';
  export type ExportFormat = 'png' | 'jpeg' | 'webp' | 'svg' | 'json';
  export type Theme = 'light' | 'dark';
  export type Language = 'en' | 'zh' | 'es' | 'fr';

  // Constants
  export const DEFAULT_OPTIONS: Required<ImageEditorOptions>;
  export const SUPPORTED_FORMATS: readonly ExportFormat[];
  export const SUPPORTED_THEMES: readonly Theme[];
  export const SUPPORTED_LANGUAGES: readonly Language[];

  // Version
  export const VERSION: string;
}