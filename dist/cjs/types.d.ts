/**
 * @file types.ts
 * @description Public interfaces and types for image-editor.
 *
 * All types are re-exported from the library root (index.ts) so consumers
 * can import them directly:
 *
 * ```ts
 * import type { ImageEditorOptions, MaskConfig } from 'image-editor';
 * ```
 */
import type * as FabricNS from 'fabric';
/** The full Fabric.js v7 module type (from `import * as fabric from 'fabric'`). */
export type FabricModule = typeof FabricNS;
/**
 * A Fabric.js object augmented with mask-specific runtime properties.
 * Used as the return type of {@link ImageEditor.addMask} and in event callbacks.
 */
export interface MaskObject extends FabricNS.FabricObject {
    /** Unique numeric identifier assigned at creation time. */
    maskId: number;
    /** Human-readable label shown in the mask list (`maskName` option + id). */
    maskName: string;
    /** Original opacity stored to support hover highlight / restore. */
    originalAlpha: number;
    /** Active label overlay Text object, if currently displayed. */
    __label?: FabricNS.FabricText;
    /** Internal flag used to exclude the crop rect from history snapshots. */
    isCropRect?: boolean;
}
/** Type guard — returns `true` if `obj` is a {@link MaskObject}. */
export declare function isMaskObject(obj: FabricNS.FabricObject): obj is MaskObject;
/**
 * Configuration for the label shown above a selected mask.
 */
export interface LabelConfig {
    /**
     * Returns the text to render for a given mask.
     * @default `(mask) => mask.maskName`
     */
    getText?: (mask: MaskObject, maskIndex: number) => string;
    /**
     * Any valid Fabric.js Text property overrides for the label text object.
     * Merged with sensible defaults (monospace 12px white on dark bg).
     */
    textOptions?: Partial<FabricNS.TextProps>;
    /**
     * Advanced: supply your own factory function to create the label object.
     * If provided, `getText` and `textOptions` are ignored.
     *
     * @returns A Fabric.js Text (or subclass) instance, or `null` to fall back.
     */
    create?: (mask: MaskObject, fabric: FabricModule) => FabricNS.FabricText | null;
}
/** Internal crop-mode configuration. */
export interface CropConfig {
    /** Minimum crop rect width in pixels. @default 100 */
    minWidth?: number;
    /** Minimum crop rect height in pixels. @default 100 */
    minHeight?: number;
    /** Inset from the image bounding box when entering crop mode. @default 10 */
    padding?: number;
    /** Whether to hide masks during crop preview. @default true */
    hideMasksDuringCrop?: boolean;
    /** Whether to keep masks (relative to new image) after crop. @default true */
    preserveMasksAfterCrop?: boolean;
    /** Whether the crop rect itself can be rotated. @default false */
    allowRotationOfCropRect?: boolean;
}
/**
 * A numeric property that can either be a plain number, a CSS-style
 * percentage string (`"50%"`), or a factory function that receives the
 * current canvas and resolved options and returns a number.
 */
export type MaskNumericProp = number | `${number}%` | ((canvas: FabricNS.Canvas, options: ResolvedOptions) => number);
/**
 * Configuration object passed to {@link ImageEditor.addMask}.
 */
export interface MaskConfig {
    /** Shape type. @default 'rect' */
    shape?: 'rect' | 'circle' | 'ellipse' | 'polygon';
    /**
     * Polygon vertex array. Required when `shape === 'polygon'`.
     * Each element may be `{ x, y }`.
     */
    points?: Array<{
        x: number;
        y: number;
    }>;
    /** Mask width (rect) / used as diameter hint for circle. */
    width?: MaskNumericProp;
    /** Mask height (rect/ellipse). */
    height?: MaskNumericProp;
    /** Horizontal border-radius for Rect, or x-radius for Ellipse. */
    rx?: MaskNumericProp;
    /** Vertical border-radius for Rect, or y-radius for Ellipse. */
    ry?: MaskNumericProp;
    /** Radius for Circle. Defaults to `min(width, height) / 2`. */
    radius?: MaskNumericProp;
    /**
     * Left position. Supports number, `"50%"`, or a factory.
     * If omitted and a previous mask exists, auto-placed to its right.
     */
    left?: MaskNumericProp;
    /** Top position. Same flexibility as `left`. */
    top?: MaskNumericProp;
    /** Rotation angle in degrees. @default 0 */
    angle?: number;
    /** CSS fill color. @default 'rgba(0,0,0,0.5)' */
    color?: string;
    /** Opacity 0–1. @default 0.5 */
    alpha?: number;
    /** Pixel gap between auto-placed masks. @default 5 */
    gap?: number;
    /** Whether the mask can be selected and moved. @default true */
    selectable?: boolean;
    /** Whether transform handles are shown. @default true */
    hasControls?: boolean;
    /** Keep stroke width visually uniform regardless of scale. @default true */
    strokeUniform?: boolean;
    /** Selection border color. @default 'red' */
    borderColor?: string;
    /** Control corner color. @default 'black' */
    cornerColor?: string;
    /** Control corner size in pixels. @default 8 */
    cornerSize?: number;
    /** Transparent corners. @default false */
    transparentCorners?: boolean;
    /**
     * Additional raw Fabric.js object properties merged into the shape.
     * Can include `stroke`, `strokeWidth`, `strokeDashArray`, etc.
     */
    styles?: Partial<FabricNS.FabricObjectProps>;
    /**
     * Called synchronously after the mask is created and added to the canvas.
     * @param mask   The newly created mask object.
     * @param canvas The Fabric.js Canvas instance.
     */
    onCreate?: (mask: MaskObject, canvas: FabricNS.Canvas) => void;
    /**
     * Advanced: Bypass all built-in shape logic and supply your own
     * Fabric.js object. Receives the fully resolved config.
     */
    fabricGenerator?: (cfg: ResolvedMaskConfig, canvas: FabricNS.Canvas, options: ResolvedOptions) => FabricNS.FabricObject;
}
/** Internal fully-resolved mask config (after defaults are applied). */
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
/**
 * Mapping from logical control names to the actual DOM element IDs on the page.
 * Any key may be omitted; the default ID is the same as the key name.
 */
export interface ElementIdMap {
    /** The `<canvas>` element. @default 'fabricCanvas' */
    canvas?: string;
    /**
     * Scrollable viewport container that wraps the canvas.
     * Used to determine the visible size for canvas sizing decisions.
     * If omitted, `canvas.parentElement` is used.
     */
    canvasContainer?: string | null;
    /** Empty-state placeholder element. @default 'imgPlaceholder' */
    imgPlaceholder?: string;
    /** Scale percentage input/display. @default 'scaleRate' */
    scaleRate?: string;
    /** Left-rotation step input. @default 'rotationLeftInput' */
    rotationLeftInput?: string;
    /** Right-rotation step input. @default 'rotationRightInput' */
    rotationRightInput?: string;
    /** Rotate left button. @default 'rotateLeftBtn' */
    rotateLeftBtn?: string;
    /** Rotate right button. @default 'rotateRightBtn' */
    rotateRightBtn?: string;
    /** Add mask button. @default 'addMaskBtn' */
    addMaskBtn?: string;
    /** Remove selected mask button. @default 'removeMaskBtn' */
    removeMaskBtn?: string;
    /** Remove all masks button. @default 'removeAllMasksBtn' */
    removeAllMasksBtn?: string;
    /** Merge masks into image button. @default 'mergeBtn' */
    mergeBtn?: string;
    /** Download image button. @default 'downloadBtn' */
    downloadBtn?: string;
    /** Mask list container (`<ul>` or `<ol>`). @default 'maskList' */
    maskList?: string;
    /** Zoom in button. @default 'zoomInBtn' */
    zoomInBtn?: string;
    /** Zoom out button. @default 'zoomOutBtn' */
    zoomOutBtn?: string;
    /** Reset (scale=1, angle=0) button. @default 'resetBtn' */
    resetBtn?: string;
    /** Undo button. @default 'undoBtn' */
    undoBtn?: string;
    /** Redo button. @default 'redoBtn' */
    redoBtn?: string;
    /** File input for image selection. @default 'imageInput' */
    imageInput?: string;
    /** Enter crop mode button. @default 'cropBtn' */
    cropBtn?: string;
    /** Apply crop button. @default 'applyCropBtn' */
    applyCropBtn?: string;
    /** Cancel crop button. @default 'cancelCropBtn' */
    cancelCropBtn?: string;
    /** Clickable upload area (delegates to imageInput). @default 'uploadArea' */
    uploadArea?: string;
}
/** Options for {@link ImageEditor.getImageBase64}. */
export interface ExportOptions {
    /**
     * When `true`, exports only the image bounding area with masks baked in as
     * black overlays. When `false`, exports the raw image pixels without masks.
     * @default `options.exportImageAreaByDefault`
     */
    exportImageArea?: boolean;
    /**
     * Output resolution multiplier (e.g. `2` for 2× retina).
     * @default `options.exportMultiplier`
     */
    multiplier?: number;
}
/** Options for {@link ImageEditor.exportImageFile}. */
export interface ExportFileOptions {
    /** Bake masks into the exported image. @default true */
    mergeMask?: boolean;
    /** Output format. @default 'jpeg' */
    fileType?: 'jpeg' | 'jpg' | 'png' | 'webp';
    /** Lossy quality 0–1. @default `options.downsampleQuality` */
    quality?: number;
    /** Resolution multiplier. @default `options.exportMultiplier` */
    multiplier?: number;
    /** Filename for the resulting File object. */
    fileName?: string;
}
/**
 * Configuration passed to the {@link ImageEditor} constructor.
 * All properties are optional; sensible defaults are applied internally.
 */
export interface ImageEditorOptions {
    /** Initial canvas width in pixels. @default 800 */
    canvasWidth?: number;
    /** Initial canvas height in pixels. @default 600 */
    canvasHeight?: number;
    /** Fabric canvas background color. @default 'transparent' */
    backgroundColor?: string;
    /** Duration of scale/rotate animations in ms. @default 300 */
    animationDuration?: number;
    /** Minimum allowed scale factor. @default 0.1 */
    minScale?: number;
    /** Maximum allowed scale factor. @default 5.0 */
    maxScale?: number;
    /** Scale delta per zoom step. @default 0.05 */
    scaleStep?: number;
    /** Rotation step in degrees. @default 90 */
    rotationStep?: number;
    /**
     * Expand the canvas to fit the loaded image (no scroll required for
     * images smaller than their natural size). @default true
     */
    expandCanvasToImage?: boolean;
    /** Scale the image down to fit inside the canvas. @default false */
    fitImageToCanvas?: boolean;
    /** Scale the image up/down so it covers the canvas. @default false */
    coverImageToCanvas?: boolean;
    /** Downsample very large images on load. @default true */
    downsampleOnLoad?: boolean;
    /** Max pixel width before downsampling kicks in. @default 4000 */
    downsampleMaxWidth?: number;
    /** Max pixel height before downsampling kicks in. @default 3000 */
    downsampleMaxHeight?: number;
    /** JPEG quality used when downsampling and exporting. @default 0.92 */
    downsampleQuality?: number;
    /** Output resolution multiplier for exports. @default 1 */
    exportMultiplier?: number;
    /**
     * When `true`, {@link ImageEditor.downloadImage} clips the export to the
     * image bounding box with masks baked in. @default true
     */
    exportImageAreaByDefault?: boolean;
    /** Default width for new rect/ellipse masks. @default 50 */
    defaultMaskWidth?: number;
    /** Default height for new rect/ellipse masks. @default 80 */
    defaultMaskHeight?: number;
    /** Allow masks to be rotated by the user. @default false */
    maskRotatable?: boolean;
    /** Show a name label above a selected mask. @default true */
    maskLabelOnSelect?: boolean;
    /** Pixel offset of the label from the mask's top-left corner. @default 3 */
    maskLabelOffset?: number;
    /** Name prefix for auto-generated mask names. @default 'mask' */
    maskName?: string;
    /** Allow multi-object group selection on the canvas. @default false */
    groupSelection?: boolean;
    /** Show a placeholder when no image is loaded. @default true */
    showPlaceholder?: boolean;
    /**
     * Base64 data URL to auto-load when the editor is initialized.
     * @default null
     */
    initialImageBase64?: string | null;
    /** Default filename used by {@link ImageEditor.downloadImage}. @default 'edited_image.jpg' */
    defaultDownloadFileName?: string;
    /** Called after an image is successfully loaded onto the canvas. */
    onImageLoaded?: () => void;
}
/**
 * Fully resolved options with all required fields guaranteed to be present.
 * Used internally after merging defaults.
 * @internal
 */
export interface ResolvedOptions extends Required<ImageEditorOptions> {
    label: LabelConfig;
    crop: Required<CropConfig>;
}
/** @internal */
export interface BoundHandler {
    event: string;
    handler: EventListener;
}
/** @internal */
export interface CropHandler {
    target: MaskObject | FabricNS.Rect;
    handlers: Array<{
        evt: string;
        fn: () => void;
    }>;
}
/** @internal */
export interface CropPrevEvented {
    obj: FabricNS.FabricObject;
    evented: boolean;
    selectable: boolean;
}
/** @internal */
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