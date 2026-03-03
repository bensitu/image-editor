/**
 * @file image-editor.ts
 * @module image-editor
 * @version 2.0.0
 * @author Ben Situ
 * @license MIT
 * @description Lightweight canvas-based image editor built on Fabric.js v7.
 *              Provides masking, animated scale/rotate, crop, undo/redo, and export.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Fabric.js v5 → v7 migration notes (kept here for historical reference)
 * ─────────────────────────────────────────────────────────────────────────────
 *  1. Image.fromURL()           — now Promise-based; no callback parameter.
 *  2. Canvas.loadFromJSON()     — now Promise-based; no callback parameter.
 *  3. FabricObject.animate()    — returns Animation[] (NOT a Promise).
 *                                 Wrap with new Promise() + onComplete callback.
 *                                 Multi-prop animation fires onComplete per prop;
 *                                 count completions to detect full finish.
 *  4. canvas.bringToFront(o)    → canvas.bringObjectToFront(o)
 *     canvas.sendToBack(o)      → canvas.sendObjectToBack(o)
 *  5. canvas.calcOffset()       — removed; managed internally.
 *  6. canvas.setBackgroundColor(c, cb) → `canvas.backgroundColor = c`
 *  7. getBoundingRect(abs,calc) — signature removed; always returns absolute rect.
 *  8. canvas.renderAll()        — replaced with requestRenderAll() in animation loop.
 *  9. canvas.setWidth()/setHeight() → canvas.setDimensions({ width, height })
 *     CRITICAL: setDimensions keeps the upper (event) canvas in sync with the
 *     lower (render) canvas. Manual style mutation breaks pointer-event mapping.
 * 10. All new FabricObject origins now default to 'center'/'center'.
 *     Masks must declare originX:'left', originY:'top' explicitly to keep the
 *     left/top coordinate system matching the top-left corner of the shape.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import type * as FabricNS from 'fabric';
import { HistoryManager } from './history.js';
import type { ElementIdMap, ExportFileOptions, ExportOptions, FabricModule, ImageEditorOptions, MaskConfig, MaskObject, ResolvedOptions } from './types.js';
interface CanvasJSONObject {
    isCropRect?: boolean;
    maskId?: number;
    maskName?: string;
    type?: string;
    [key: string]: unknown;
}
interface CanvasJSON {
    objects?: CanvasJSONObject[];
    [key: string]: unknown;
}
/**
 * Lightweight Fabric.js v7 image editor with masking, animated transforms,
 * crop, undo/redo, and multi-format export.
 *
 * ## Quick start (ESM)
 * ```ts
 * import * as fabric from 'fabric';
 * import { ImageEditor } from 'image-editor';
 *
 * const editor = new ImageEditor(fabric, { canvasWidth: 1024, canvasHeight: 768 });
 * editor.init({ canvas: 'myCanvas' });
 * ```
 *
 * ## Quick start (CDN / `<script>` tag)
 * ```ts
 * // Assumes window.fabric is populated by a Fabric.js CDN script
 * const editor = new ImageEditor({ canvasWidth: 1024 });
 * editor.init();
 * ```
 */
export declare class ImageEditor {
    /** @internal */ private readonly _fabric;
    /** @internal */ private readonly _fabricLoaded;
    /** @internal */ readonly options: ResolvedOptions;
    /** The underlying Fabric.js Canvas instance (available after {@link init}). */
    canvas: FabricNS.Canvas | null;
    /** @internal */ private canvasEl;
    /** @internal */ private containerEl;
    /** @internal */ private placeholderEl;
    /** @internal */ private elements;
    /** The primary image object on the canvas (set after a successful {@link loadImage}). */
    originalImage: FabricNS.FabricImage | null;
    /** @internal */ private baseImageScale;
    /** Current scale factor (1 = original size). */
    currentScale: number;
    /** Current rotation angle in degrees. */
    currentRotation: number;
    /** Whether a valid image is currently rendered on the canvas. */
    isImageLoadedToCanvas: boolean;
    /** @internal */ private maskCounter;
    /** @internal */ private _lastMask;
    /** @internal */ private _lastMaskInitialLeft;
    /** @internal */ private _lastMaskInitialTop;
    /** @internal */ private _lastMaskInitialWidth;
    /** @internal */ private _lastSnapshot;
    /** @internal */ readonly historyManager: HistoryManager;
    /** Maximum history entries retained. */
    readonly maxHistorySize: number;
    /** @internal */ private isAnimating;
    /** @internal */ private readonly animQueue;
    /** @internal */ private _cropMode;
    /** @internal */ private _cropRect;
    /** @internal */ private _cropHandlers;
    /** @internal */ private _cropPrevEvented;
    /** @internal */ private _prevSelectionSetting;
    /** @internal */ private _boundHandlers;
    /** Optional callback invoked once each time an image finishes loading. */
    onImageLoaded: (() => void) | null;
    /**
     * @param fabricModuleOrOptions
     *   Pass the Fabric.js **module** (`import * as fabric from 'fabric'`) when
     *   using ESM, or pass the **options** object directly when using a CDN global
     *   (`window.fabric`).
     * @param options
     *   Editor options. Only used when `fabricModuleOrOptions` is the fabric module.
     */
    constructor(fabricModuleOrOptions?: FabricModule | ImageEditorOptions, options?: ImageEditorOptions);
    /**
     * Initializes the editor: connects to DOM elements, wires events,
     * and optionally loads the `initialImageBase64` from options.
     *
     * Must be called once before any other method is used.
     *
     * @param idMap Optional mapping from logical names to DOM element IDs.
     *
     * @example
     * ```ts
     * editor.init({ canvas: 'myCanvas', downloadBtn: 'dlBtn' });
     * ```
     */
    init(idMap?: ElementIdMap): void;
    /** @internal */
    private _initCanvas;
    /** @internal */
    private _bindEvents;
    /** @internal */
    private _bindIfExists;
    /** @internal */
    private _loadImageFile;
    /**
     * Loads a Base64-encoded image data URL onto the canvas.
     * Clears any existing image, masks and resets transform state.
     *
     * @param base64 Data URL string starting with `data:image/…`.
     * @returns Promise that resolves once the image is on the canvas.
     */
    loadImage(base64: string): Promise<void>;
    /**
     * Returns `true` if a valid image is currently loaded on the canvas.
     */
    isImageLoaded(): boolean;
    /** @internal */
    private _createImageElement;
    /** @internal */
    private _resampleImageToDataURL;
    /**
     * Resizes the Fabric.js Canvas using `setDimensions()`.
     *
     * CRITICAL: In Fabric.js v7 the canvas is split into two `<canvas>` elements:
     * - **lowerCanvasEl** — renders objects
     * - **upperCanvasEl** — captures pointer events (invisible overlay)
     *
     * `setDimensions({ width, height })` updates **both** layers atomically and
     * keeps their CSS in sync.  Manually mutating `canvasEl.style.width/height`
     * only touches the lower layer → the upper layer's hit-test regions become
     * misaligned → objects appear unselectable and click positions drift.
     *
     * @internal
     */
    private _setCanvasSizeInt;
    /** @internal */
    private _getObjectTopLeftPoint;
    /** @internal */
    private _setObjectOriginKeepingPosition;
    /** @internal */
    private _alignObjectBoundingBoxToCanvasTopLeft;
    /** @internal */
    private _updateCanvasSizeToImageBounds;
    /**
     * Animates the image to the given scale factor.
     * The factor is clamped to `[options.minScale, options.maxScale]`.
     * Queued — concurrent calls are serialized.
     *
     * @returns Promise that resolves when the animation finishes.
     */
    scaleImage(factor: number): Promise<void>;
    /** @internal */
    private _scaleImageImpl;
    /**
     * Animates the image to the given rotation angle.
     * Queued — concurrent calls are serialized.
     *
     * @param degrees Target rotation angle in degrees.
     * @returns Promise that resolves when the animation finishes.
     */
    rotateImage(degrees: number): Promise<void>;
    /** @internal */
    private _rotateImageImpl;
    /**
     * Resets the image to scale 1 and rotation 0 (animated).
     * @returns Promise that resolves when complete.
     */
    reset(): Promise<void>;
    /**
     * Restores a previously serialized canvas state.
     *
     * @param jsonString JSON string returned by `canvas.toJSON()` (or parsed object).
     */
    loadFromState(jsonString: string | CanvasJSON): Promise<void>;
    /**
     * Captures the current canvas state into the undo/redo history.
     * Called automatically after transforms, mask operations, and crop.
     */
    saveState(): void;
    /** Undoes the last recorded action. */
    undo(): void;
    /** Redoes the next recorded action. */
    redo(): void;
    /**
     * Creates and adds a mask shape to the canvas.
     *
     * @param config  Shape type, dimensions, position, style, and callbacks.
     * @returns The created mask object, or `null` if the canvas is unavailable.
     *
     * @example
     * ```ts
     * // Simple rect mask
     * editor.addMask();
     *
     * // Circle with custom size
     * editor.addMask({ shape: 'circle', radius: 60, color: 'rgba(255,0,0,0.4)' });
     *
     * // Positioned at 20% from the left
     * editor.addMask({ left: '20%', top: 40 });
     * ```
     */
    addMask(config?: MaskConfig): MaskObject | null;
    /**
     * Removes the currently selected mask (and its label).
     */
    removeSelectedMask(): void;
    /**
     * Removes all masks and their labels.
     */
    removeAllMasks(): void;
    /** @internal */
    private _removeLabelForMask;
    /** @internal */
    private _createLabelForMask;
    /** @internal */
    private _hideAllMaskLabels;
    /** @internal */
    private _syncMaskLabel;
    /** @internal */
    private _showLabelForMask;
    /** @internal */
    private _onSelectionChanged;
    /** @internal */
    private _updateMaskList;
    /** @internal */
    private _updateMaskListSelection;
    /**
     * Bakes all current masks into the image:
     * exports the masked image, removes the masks, and re-imports the result
     * as the new base image.
     *
     * @returns Promise that resolves when the merge is complete.
     */
    merge(): Promise<void>;
    /**
     * Triggers a browser download of the current canvas as a JPEG.
     *
     * @param fileName Filename for the downloaded file.
     *   @default `options.defaultDownloadFileName`
     */
    downloadImage(fileName?: string): void;
    /**
     * Exports the canvas as a Base64-encoded JPEG data URL.
     *
     * When `exportImageArea` is `true`, the canvas is rendered with masks
     * baked in as solid black overlays and cropped to the image bounding box.
     * When `false`, the raw image pixels are returned without any masks.
     *
     * @param options Export options.
     * @returns Promise resolving to a JPEG data URL.
     * @throws If no image is loaded.
     */
    getImageBase64(options?: ExportOptions): Promise<string>;
    /**
     * Exports the canvas as a browser `File` object.
     *
     * @param options Export and file options.
     * @returns Promise resolving to a `File`.
     * @throws If no image is loaded.
     *
     * @example
     * ```ts
     * const file = await editor.exportImageFile({ fileType: 'png', mergeMask: false });
     * const formData = new FormData();
     * formData.append('image', file);
     * ```
     */
    exportImageFile(options?: ExportFileOptions): Promise<File>;
    /**
     * Enters crop mode: adds a resizable selection rect to the canvas.
     * All other controls are disabled until {@link applyCrop} or {@link cancelCrop} is called.
     */
    enterCropMode(): void;
    /**
     * Cancels crop mode and removes the crop rectangle without applying it.
     */
    cancelCrop(): void;
    /**
     * Applies the current crop rectangle: crops the image and reloads it.
     * Pushes the operation onto the undo/redo history.
     *
     * @returns Promise that resolves when the cropped image is loaded.
     */
    applyCrop(): Promise<void>;
    /** @internal */
    private _updateInputs;
    /** @internal */
    private _updateUI;
    /** @internal */
    private _setDisabled;
    /** @internal */
    private _updatePlaceholderStatus;
    /** @internal */
    private _setPlaceholderVisible;
    /**
     * Cleans up all DOM event listeners and disposes the Fabric.js Canvas.
     * Call this when the editor is no longer needed to prevent memory leaks.
     */
    dispose(): void;
}
export {};
//# sourceMappingURL=image-editor.d.ts.map