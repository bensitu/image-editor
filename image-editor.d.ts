// index.d.ts - TypeScript 类型定义文件

declare module 'image-editor' {
  import { Canvas, Image as FabricImage, Object as FabricObject } from 'fabric';

  // 基础配置接口
  export interface ImageEditorOptions {
    // 画布配置
    canvasWidth?: number;
    canvasHeight?: number;
    backgroundColor?: string;

    // 动画配置
    animationDuration?: number;
    minScale?: number;
    maxScale?: number;
    scaleStep?: number;
    rotationStep?: number;

    // 图片处理配置
    expandCanvasToImage?: boolean;
    fitImageToCanvas?: boolean;
    downsampleOnLoad?: boolean;
    downsampleMaxPixels?: number;
    downsampleQuality?: number;

    // 导出配置
    exportMultiplier?: number;
    exportImageAreaByDefault?: boolean;

    // 遮罩配置
    defaultMaskWidth?: number;
    defaultMaskHeight?: number;
    maskRotatable?: boolean;
    maskLabelOnSelect?: boolean;
    maskLabelOffset?: number;
    maskName?: string;

    // UI配置
    showPlaceholder?: boolean;
    initialImageBase64?: string | null;
    defaultDownloadFileName?: string;
    language?: 'en' | 'zh' | 'es' | 'fr';
    theme?: 'light' | 'dark';

    // 回调函数
    onImageLoaded?: () => void;
    onError?: (error: ImageEditorError) => void;
    onMaskAdded?: (mask: MaskObject) => void;
    onMaskRemoved?: (maskId: number) => void;
  }

  // 元素ID映射接口
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

  // 遮罩配置接口
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

  // 遮罩对象接口
  export interface MaskObject extends FabricObject {
    maskId: number;
    maskName: string;
    originalAlpha: number;
    __label?: FabricObject;
  }

  // 导出选项接口
  export interface ExportOptions {
    format?: 'png' | 'jpeg' | 'webp' | 'svg' | 'json';
    quality?: number;
    multiplier?: number;
    exportImageArea?: boolean;
    fileName?: string;
    includeBackground?: boolean;
  }

  // 事件数据接口
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

  // 事件回调类型
  export type EventCallback<T = any> = (data: T) => void;

  // 错误类
  export class ImageEditorError extends Error {
    code: string;
    originalError?: Error;
    
    constructor(message: string, code: string, originalError?: Error);
  }

  // 历史状态接口
  export interface HistoryState {
    canvasData: string;
    timestamp: number;
    description?: string;
  }

  // 主类定义
  export class ImageEditor {
    // 公共属性
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

    // 构造函数
    constructor(options?: ImageEditorOptions);

    // 初始化方法
    init(idMap?: ElementIdMap): void;

    // 图片操作方法
    loadImage(base64: string): Promise<void>;
    isImageLoaded(): boolean;
    scaleImage(factor: number): Promise<void>;
    rotateImage(degrees: number): Promise<void>;
    reset(): Promise<void>;

    // 遮罩操作方法
    addMask(config?: MaskConfig): MaskObject | null;
    addCircleMask(config?: MaskConfig & { radius?: number }): MaskObject | null;
    addPolygonMask(points: Array<{x: number, y: number}>, config?: MaskConfig): MaskObject | null;
    removeSelectedMask(): void;
    removeAllMasks(): void;
    removeMask(maskId: number): boolean;
    getMask(maskId: number): MaskObject | null;
    getAllMasks(): MaskObject[];
    selectMask(maskId: number): boolean;

    // 导出方法
    merge(): Promise<void>;
    downloadImage(fileName?: string, options?: ExportOptions): Promise<void>;
    getImageBase64(options?: ExportOptions): Promise<string>;
    exportAs(format: ExportOptions['format'], options?: ExportOptions): Promise<string>;

    // 历史操作方法
    undo(): boolean;
    redo(): boolean;
    canUndo(): boolean;
    canRedo(): boolean;
    saveState(description?: string): void;

    // 事件系统方法
    on<K extends keyof EventData>(event: K, callback: EventCallback<EventData[K]>): void;
    off<K extends keyof EventData>(event: K, callback?: EventCallback<EventData[K]>): void;
    emit<K extends keyof EventData>(event: K, data: EventData[K]): void;

    // 工具方法
    setTheme(theme: 'light' | 'dark'): void;
    setLanguage(lang: string): void;
    validateOptions(options: ImageEditorOptions): boolean;
    getCanvasDimensions(): { width: number; height: number };
    setCanvasDimensions(width: number, height: number): void;

    // 生命周期方法
    dispose(): void;
  }

  // 工厂函数
  export function createImageEditor(options?: ImageEditorOptions): ImageEditor;

  // 实用类型
  export type MaskShape = 'rectangle' | 'circle' | 'polygon' | 'freeform';
  export type ExportFormat = 'png' | 'jpeg' | 'webp' | 'svg' | 'json';
  export type Theme = 'light' | 'dark';
  export type Language = 'en' | 'zh' | 'es' | 'fr';

  // 常量
  export const DEFAULT_OPTIONS: Required<ImageEditorOptions>;
  export const SUPPORTED_FORMATS: readonly ExportFormat[];
  export const SUPPORTED_THEMES: readonly Theme[];
  export const SUPPORTED_LANGUAGES: readonly Language[];

  // 版本信息
  export const VERSION: string;
}