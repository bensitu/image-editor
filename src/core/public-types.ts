/**
 * @file public-types.ts
 * @description Public interfaces and types for `@bensitu/image-editor`.
 *
 * All types declared here are re-exported from the package root
 * (`src/index.ts`) so consumers can import them directly:
 *
 * ```ts
 * import type { ImageEditorOptions, MaskConfig} from '@bensitu/image-editor';
 * ```
 */

import type * as FabricNS from 'fabric';

// ─── Fabric module convenience ───────────────────────────────────────────────

/**
 * The full Fabric.js v7 module type (i.e. `import * as fabric from 'fabric'`).
 * Used when consumers need to type the value they pass into
 * `new ImageEditor(fabric, options)`.
 */
export type FabricModule = typeof FabricNS;

// ─── Image format primitives ─────────────────────────────────────────────────

/**
 * Canonical alpha-aware MIME types supported by export and downsample paths.
 *
 * Used by `ImageEditorOptions.downsampleMimeType` and by the
 * export pipeline when emitting MIME strings.
 */
export type ImageMimeType = 'image/jpeg' | 'image/png' | 'image/webp';

/**
 * Accepted file-type tokens for `Base64ExportOptions` and
 * `ImageFileExportOptions`. The export pipeline normalizes `'jpg'` to
 * `'jpeg'` and accepts both bare format tokens (`'png'`) and full MIME types
 * (`'image/png'`) for ergonomic interop.
 */
export type ImageFileType =
    | 'jpeg'
    | 'jpg'
    | 'png'
    | 'webp'
    | 'image/jpeg'
    | 'image/png'
    | 'image/webp';

/**
 * Normalized format token after collapsing `'jpg'` to `'jpeg'` and stripping
 * the `image/` MIME prefix. Produced by `export/export-format.ts` and consumed
 * by Fabric's `format` argument.
 */
export type NormalizedImageFormat = 'jpeg' | 'png' | 'webp';

// ─── Mask object ─────────────────────────────────────────────────────────────

/**
 * A Fabric.js object augmented with mask-specific runtime properties.
 * Returned from {@link ImageEditor.createMask} and exposed in mask-related
 * event callbacks.
 *
 * The marker flags `isCropRect` and `maskLabel` identify session-only objects
 * (the active crop rectangle and label overlays). They are filtered out of
 * history snapshots by the state serializer.
 */
export interface MaskObject extends FabricNS.FabricObject {
    /** Unique numeric identifier assigned at creation time. */
    maskId: number;
    /** Human-readable label shown in the mask list (`maskName` option + id). */
    maskName: string;
    /** Original opacity stored to support hover highlight / restore. */
    originalAlpha: number;
    /** Original stroke captured for hover/selection style restore. */
    originalStroke?: FabricNS.TFiller | string | null;
    /** Original stroke width captured for hover/selection style restore. */
    originalStrokeWidth?: number;
    /** Active label overlay object, if currently displayed. */
    __label?: FabricNS.FabricObject;
    /** Marker flag — `true` only on the crop rectangle, never on real masks. */
    isCropRect?: boolean;
    /**
     * Marker flag set on label-overlay text objects so the state serializer
 * can exclude them from history snapshots.
     */
    maskLabel?: boolean;
}

/**
 * Type guard — returns `true` when `obj` carries the runtime mask metadata
 * (`maskId: number`) so consumers can filter `canvas.getObjects`
 * deterministically.
 */
export function isMaskObject(obj: FabricNS.FabricObject): obj is MaskObject {
    return 'maskId' in obj && typeof (obj as MaskObject).maskId === 'number';
}

// ─── Label and crop sub-configs ──────────────────────────────────────────────

/**
 * Configuration for the label shown above a selected mask.
 *
 * Consumers can either tweak label text via `getText` and `textOptions`, or
 * fully take over rendering via `create`. `textOptions` is deep-merged with
 * the editor's defaults so unspecified keys remain.
 */
export interface LabelConfig {
    /**
     * Returns the text to render for a given mask.
     *
     * The `maskIndex` argument is the stable creation index (`mask.maskId - 1`)
     * rather than the live list position.
     *
     * @default `(mask) => mask.maskName`
     */
    getText?: (mask: MaskObject, maskIndex: number) => string;

    /**
     * Fabric.js text property overrides for the label text object.
     * Merged with sensible defaults (monospace 12px white on dark bg).
     */
    textOptions?: Partial<FabricNS.TextProps>;

    /**
     * Advanced: supply a factory that builds the label object directly.
     * When provided, `getText` and `textOptions` are ignored.
     *
     * @returns A Fabric.js Text instance, or `null` to fall back to defaults.
     */
    create?: (mask: MaskObject, fabric: FabricModule) => FabricNS.FabricText | null;
}

/**
 * Crop-mode configuration. Defaults are applied by `core/default-options.ts`.
 *
 * Defaults are applied by `core/default-options.ts`.
 */
export interface CropConfig {
    /** Minimum crop rect width in pixels. @default 100 */
    minWidth?: number;
    /** Minimum crop rect height in pixels. @default 100 */
    minHeight?: number;
    /** Inset from the image bounding box when entering crop mode. @default 10 */
    padding?: number;
    /** Whether to hide masks during crop preview. @default true */
    hideMasksDuringCrop?: boolean;
    /**
     * Whether to keep masks (relative to the new image) after applying crop.
     * @default false
     */
    preserveMasksAfterCrop?: boolean;
    /** Whether the crop rect itself can be rotated. @default false */
    allowRotationOfCropRect?: boolean;
}

// ─── Mask config primitives ──────────────────────────────────────────────────

/**
 * A numeric property that may be provided as:
 *   - a plain `number` in canvas pixels,
 *   - a CSS-style percentage string (`"50%"`) — resolved against the canvas
 *     width or height depending on the field's axis,
 *   - or a factory `(canvas, ResolvedOptions) => number` invoked at apply
 *     time.
 */
export type MaskNumericProp =
    | number
    | `${number}%`
    | string
    | ((canvas: FabricNS.Canvas, options: ResolvedOptions) => number);

/**
 * Polygon vertex accepted by `MaskConfig.points`. Coerced to `{ x, y}`
 * internally regardless of input form.
 */
export type PolygonPoint = { x: number; y: number } | [number, number];

/**
 * Configuration object passed to {@link ImageEditor.createMask}.
 *
 * Falsy values (`0`, `false`, `null`, `''`, `NaN`) supplied via `styles` and
 * via the boolean flags below are applied verbatim — the editor never
 * substitutes a default in their place.
 */
export interface MaskConfig {
    /** Shape type. @default 'rect' */
    shape?: 'rect' | 'circle' | 'ellipse' | 'polygon' | string;

    /**
     * Polygon vertex array. Required when `shape === 'polygon'`.
     * Each element may be `{ x, y}` or `[x, y]`.
     */
    points?: PolygonPoint[];

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
     * Left position. Supports number, `"50%"`, or a factory. Percentages are
     * resolved against canvas width.
     * If omitted and a previous mask exists, auto-placed to its right.
     */
    left?: MaskNumericProp;
    /**
     * Top position. Same flexibility as `left`. Percentages are resolved
     * against canvas height.
     */
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
    /** Whether the mask receives Fabric pointer events. @default true */
    evented?: boolean;
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
     * May include `stroke`, `strokeWidth`, `strokeDashArray`, etc. Falsy
     * values are preserved verbatim.
     */
    styles?: Partial<FabricNS.FabricObjectProps>;

    /**
     * Called synchronously after the mask is created, added to the canvas,
     * and `saveState` has run.
     */
    onCreate?: (mask: MaskObject, canvas: FabricNS.Canvas) => void;

    /**
     * Advanced: bypass the built-in shape logic and supply your own Fabric.js
     * object. Receives the fully resolved config, the canvas, and the
     * resolved editor options.
     */
    fabricGenerator?: (
        cfg: ResolvedMaskConfig,
        canvas: FabricNS.Canvas,
        options: ResolvedOptions,
    ) => FabricNS.FabricObject;
}

/**
 * Internal fully-resolved mask config produced after defaults and percentage
 * resolution have been applied. Retained as a public type because consumers
 * may receive it via `MaskConfig.fabricGenerator`.
 *
 * @internal Implementation detail; shape may be tightened in later tasks.
 */
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

// ─── loadImage / removeAllMasks options ──────────────────────────────────────

/**
 * Options accepted by `ImageEditor.loadImage(imageBase64, options?)`.
 */
export interface LoadImageOptions {
    /**
     * When `true`, the editor preserves the container's scroll position
     * across both the successful load and rollback paths.
     * @default false
     */
    preserveScroll?: boolean;
}

/**
 * Options accepted by `ImageEditor.removeAllMasks(options?)`.
 */
export interface RemoveAllMasksOptions {
    /**
     * When `true`, push a single history entry for the bulk removal. When
     * `false`, remove masks without creating a history entry — used by
     * internal merge/crop pipelines that already record one enclosing entry.
     * @default true
     */
    saveHistory?: boolean;
}

// ─── Element ID map ──────────────────────────────────────────────────────────

/**
 * Mapping from logical control names to actual DOM element IDs on the page.
 * Any key may be omitted; the default ID is the same as the key name.
 * Unknown or missing element IDs are ignored safely by `ui/dom-bindings.ts`.
 */
export interface ElementIdMap {
    /** The `<canvas>` element. @default 'fabricCanvas' */
    canvas?: string;
    /**
     * Scrollable viewport container that wraps the canvas.
     * Used to determine the visible size for canvas-sizing decisions.
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
    /** Reset transform button. @default 'resetBtn' */
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

// ─── Export options ──────────────────────────────────────────────────────────

/**
 * Options for {@link ImageEditor.exportImageBase64}.
 *
 * Both `fileType` and `format` are accepted — when both are provided,
 * `fileType` wins. The export pipeline normalizes `'jpg'` to `'jpeg'`,
 * derives the MIME type via `export/export-format.ts`, and clamps `quality`
 * to `[0, 1]`. PNG ignores `quality` because it is
 * lossless.
 */
export interface Base64ExportOptions {
    /**
     * When `true`, exports only the image bounding area with masks baked in.
     * When `false`, exports the raw canvas (no mask compositing, no clipping).
     * @default `options.exportImageAreaByDefault`
     */
    exportImageArea?: boolean;
    /**
     * Output resolution multiplier (e.g. `2` for 2× retina).
     * @default `options.exportMultiplier`
     */
    multiplier?: number;
    /** Lossy quality 0–1. Ignored for PNG. @default `options.downsampleQuality` */
    quality?: number;
    /** Output format. Defaults to `'jpeg'`. */
    fileType?: ImageFileType;
    /** Alias for `fileType` accepted for ergonomic interop. */
    format?: ImageFileType;
}

/**
 * Options for {@link ImageEditor.exportImageFile}.
 *
 * `fileName` falls back to `options.defaultDownloadFileName` when omitted.
 * `fileType` follows the same normalization rules as
 * {@link Base64ExportOptions}.
 */
export interface ImageFileExportOptions {
    /** Bake masks into the exported image. @default true */
    mergeMask?: boolean;
    /** Output format. @default 'jpeg' */
    fileType?: ImageFileType;
    /** Lossy quality 0–1. Ignored for PNG. @default `options.downsampleQuality` */
    quality?: number;
    /** Resolution multiplier. @default `options.exportMultiplier` */
    multiplier?: number;
    /** Filename for the resulting `File` object. */
    fileName?: string;
}

// ─── Main options ────────────────────────────────────────────────────────────

/**
 * Configuration passed to the {@link ImageEditor} constructor.
 *
 * All properties are optional; sensible defaults are applied internally by
 * `core/default-options.ts`. Unknown keys are
 * ignored without throwing.
 */
export interface ImageEditorOptions {
    // Canvas size
    /** Initial canvas width in pixels. @default 800 */
    canvasWidth?: number;
    /** Initial canvas height in pixels. @default 600 */
    canvasHeight?: number;
    /** Fabric canvas background color. @default 'transparent' */
    backgroundColor?: string;

    // Animation
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

    // Layout (precedence: fit > cover > expand).1–9.5
    /**
     * Expand the canvas to fit the loaded image (no scroll required for
     * images smaller than their natural size). @default true
     */
    expandCanvasToImage?: boolean;
    /** Scale the image down to fit inside the canvas. @default false */
    fitImageToCanvas?: boolean;
    /** Scale the image up/down so it covers the canvas. @default false */
    coverImageToCanvas?: boolean;

    // Down-sampling.1–8.4
    /** Downsample very large images on load. @default true */
    downsampleOnLoad?: boolean;
    /** Max pixel width before downsampling kicks in. @default 4000 */
    downsampleMaxWidth?: number;
    /** Max pixel height before downsampling kicks in. @default 3000 */
    downsampleMaxHeight?: number;
    /** Lossy quality used when downsampling and exporting. @default 0.92 */
    downsampleQuality?: number | null;
    /**
     * When `true`, alpha-capable source MIME types (`image/png`,
     * `image/webp`) are preserved through downsampling unless
     * `downsampleMimeType` is explicitly set.
     * @default true
     */
    preserveSourceFormat?: boolean;
    /**
     * Explicit MIME type to use for downsampled output. When set, overrides
     * `preserveSourceFormat` and forces the resampler to emit this MIME using
     * `downsampleQuality`.
     * @default null
     */
    downsampleMimeType?: ImageMimeType | null;

    // Image-load timeout
    /**
     * Maximum duration (ms) for both decode and Fabric image creation steps
     * during `loadImage`. @default 30000
     */
    imageLoadTimeoutMs?: number;
    /**
     * Maximum number of undo/redo snapshots retained in memory.
     * Each entry stores a full serialized canvas snapshot, so lower this
     * for large images or memory-constrained hosts.
     * Values are normalized to a positive integer. @default 50
     */
    maxHistorySize?: number;

    // Export
    /** Output resolution multiplier for exports. @default 1 */
    exportMultiplier?: number;
    /**
     * When `true`, {@link ImageEditor.downloadImage} clips the export to the
     * image bounding box with masks baked in. @default true
     */
    exportImageAreaByDefault?: boolean;

    // Mask defaults
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

    // Placeholder
    /** Show a placeholder when no image is loaded. @default true */
    showPlaceholder?: boolean;

    /**
     * Base64 data URL to auto-load when the editor is initialized.
     * @default null
     */
    initialImageBase64?: string | null;

    /** Default filename used by {@link ImageEditor.downloadImage}. @default 'edited_image.jpg' */
    defaultDownloadFileName?: string;

    // Callbacks.1–5.5
    /** Called after an image is successfully loaded onto the canvas. */
    onImageLoaded?: () => void;
    /**
     * Called when the editor reports an error.
     *
     * Argument order is `(error, message)` so the original thrown value is
     * preserved as the first argument and a human-readable description is
     * the second. Callback exceptions are caught and
     * logged without masking the original editor error.
     */
    onError?: (error: unknown, message: string) => void;
    /**
     * Called when the editor reports a recoverable warning. Same
     * `(error, message)` argument order as `onError`.
     */
    onWarning?: (error: unknown, message: string) => void;

    // Nested configs (deep-merged with defaults in `core/default-options.ts`)
    /** Selected-mask label configuration. */
    label?: LabelConfig;
    /** Crop-mode configuration. */
    crop?: CropConfig;
}

// ─── Internal resolved options ───────────────────────────────────────────────

/**
 * Fully resolved options with every required field guaranteed present.
 * Produced by `core/default-options.ts` after merging defaults with the
 * user-supplied partial options.
 */
export interface ResolvedOptions extends Required<Omit<
    ImageEditorOptions,
    'label' | 'crop' | 'onImageLoaded' | 'onError' | 'onWarning' | 'downsampleQuality'
>> {
    downsampleQuality: number;
    label: LabelConfig;
    crop: Required<CropConfig>;
    onImageLoaded: (() => void) | null;
    onError: ((error: unknown, message: string) => void) | null;
    onWarning: ((error: unknown, message: string) => void) | null;
}

// ─── Internal event handler bookkeeping (not re-exported from the barrel) ────

/** @internal */
export interface BoundHandler {
    event: string;
    handler: EventListener;
}

/** @internal */
export interface CropHandler {
    target: MaskObject | FabricNS.Rect;
    handlers: Array<{ evt: string; fn: () => void }>;
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
