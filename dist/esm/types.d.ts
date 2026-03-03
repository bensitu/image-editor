import type * as FabricNS from 'fabric';
export type FabricModule = typeof FabricNS;
export interface MaskObject extends FabricNS.FabricObject {
    maskId: number;
    maskName: string;
    originalAlpha: number;
    __label?: FabricNS.FabricText;
    isCropRect?: boolean;
}
export declare function isMaskObject(obj: FabricNS.FabricObject): obj is MaskObject;
export interface LabelConfig {
    getText?: (mask: MaskObject, maskIndex: number) => string;
    textOptions?: Partial<FabricNS.TextProps>;
    create?: (mask: MaskObject, fabric: FabricModule) => FabricNS.FabricText | null;
}
export interface CropConfig {
    minWidth?: number;
    minHeight?: number;
    padding?: number;
    hideMasksDuringCrop?: boolean;
    preserveMasksAfterCrop?: boolean;
    allowRotationOfCropRect?: boolean;
}
export type MaskNumericProp = number | `${number}%` | ((canvas: FabricNS.Canvas, options: ResolvedOptions) => number);
export interface MaskConfig {
    shape?: 'rect' | 'circle' | 'ellipse' | 'polygon';
    points?: Array<{
        x: number;
        y: number;
    }>;
    width?: MaskNumericProp;
    height?: MaskNumericProp;
    rx?: MaskNumericProp;
    ry?: MaskNumericProp;
    radius?: MaskNumericProp;
    left?: MaskNumericProp;
    top?: MaskNumericProp;
    angle?: number;
    color?: string;
    alpha?: number;
    gap?: number;
    selectable?: boolean;
    hasControls?: boolean;
    strokeUniform?: boolean;
    borderColor?: string;
    cornerColor?: string;
    cornerSize?: number;
    transparentCorners?: boolean;
    styles?: Partial<FabricNS.FabricObjectProps>;
    onCreate?: (mask: MaskObject, canvas: FabricNS.Canvas) => void;
    fabricGenerator?: (cfg: ResolvedMaskConfig, canvas: FabricNS.Canvas, options: ResolvedOptions) => FabricNS.FabricObject;
}
export interface ResolvedMaskConfig extends MaskConfig {
    shape: NonNullable<MaskConfig['shape']>;
    width: number;
    height: number;
    color: string;
    alpha: number;
    gap: number;
    angle: number;
    selectable: boolean;
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
    cropBtn?: string;
    applyCropBtn?: string;
    cancelCropBtn?: string;
    uploadArea?: string;
}
export interface ExportOptions {
    exportImageArea?: boolean;
    multiplier?: number;
}
export interface ExportFileOptions {
    mergeMask?: boolean;
    fileType?: 'jpeg' | 'jpg' | 'png' | 'webp';
    quality?: number;
    multiplier?: number;
    fileName?: string;
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
    onImageLoaded?: () => void;
}
export interface ResolvedOptions extends Required<ImageEditorOptions> {
    label: LabelConfig;
    crop: Required<CropConfig>;
}
export interface BoundHandler {
    event: string;
    handler: EventListener;
}
export interface CropHandler {
    target: MaskObject | FabricNS.Rect;
    handlers: Array<{
        evt: string;
        fn: () => void;
    }>;
}
export interface CropPrevEvented {
    obj: FabricNS.FabricObject;
    evented: boolean;
    selectable: boolean;
}
export interface MaskBackup {
    obj: MaskObject;
    opacity: number;
    fill: FabricNS.TFiller | string | null;
    strokeWidth: number;
    stroke: FabricNS.TFiller | string | null;
    selectable: boolean;
    lockRotation: boolean;
}
//# sourceMappingURL=types.d.ts.map