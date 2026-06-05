/**
 * Base64, file, and download entry points for the current export
 * pipeline. The orchestrator (`image-editor.ts`) delegates
 * `exportImageBase64`, `exportImageFile`, and `downloadImage`
 * to the helpers in this module so the export logic lives in
 * a single owner module per the documented module-decomposition
 * table.
 *
 * ## Owned contracts
 *
 * - Before computing the export region, every
 *   export entry point SHALL discard any active Fabric `ActiveSelection`
 *   so it is not serialized into the output. The discard is performed
 *   unconditionally; calling `canvas.discardActiveObject` with no active
 *   selection is a documented no-op.
 * - `exportImageBase64(options?: Base64ExportOptions)`
 *   is the only canonical base64 export entry point. It accepts both
 *   `fileType` and `format` for ergonomic interop and
 *   returns a `Promise<string>` resolving to a `data:image/...;base64...`
 *   data URL.
 * - `exportImageFile(options?: ImageFileExportOptions)`
 *   resolves to a `File` whose name comes from `options.fileName` or the
 *   editor's `defaultDownloadFileName`.
 * - `downloadImage(fileName?: string)` triggers a
 *   browser download with the resolved filename. The bytes match the same
 *   pipeline used by `exportImageBase64`.
 * - When `isImageLoaded` is `false`, the three
 *   entry points exhibit the documented "no image loaded" shapes:
 *
 *   | entry point          | shape on no image                   |
 *   | -------------------- | ----------------------------------- |
 *   | `exportImageBase64`  | resolves to `''`                    |
 *   | `exportImageFile`    | rejects with `ExportNotReadyError`  |
 *   | `downloadImage`      | no-op (returns synchronously)       |
 *
 * Each path emits a single `console.warn` naming the missing image so
 * the consumer's logs identify which export attempt was skipped.
 * - When `exportArea` resolves
 *   to `'image'` and a valid `originalImage` exists, the export region is
 *   computed from `originalImage.getBoundingRect` and passed directly
 *   as `left`/`top`/`width`/`height` to Fabric's `toDataURL` options.
 *   No intermediate `<canvas>` element is created, and sub-pixel
 *   width/height values are floored to integer pixels through the
 *   {@link floorRegion} helper before Fabric receives the region.
 * - When `mergeMask` is
 *   `true`, every mask's live style (`opacity`, `fill`, `stroke`,
 *   `strokeWidth`, `selectable`, `lockRotation`) is captured BEFORE the
 *   mutator forces the bake-in style (`opacity: 1, fill: '#000',
 *   strokeWidth: 0, stroke: null, selectable: false`) and restored
 *   inside a `finally` block whether the inner render resolved or
 *   rejected. The backup/restore bracket is owned by
 *   {@link withMaskStyleBackup} in `mask/mask-style.ts`; this module
 *   only contributes the bake-in mutator.
 * - **mergeMasks pre-export** — Before computing the merged
 *   bitmap, {@link mergeMasks} discards any active Fabric
 *   `ActiveSelection`. {@link exportImageBase64} also discards on its
 *   own entry, so the discard runs at most twice (both calls are
 *   idempotent no-ops when nothing is selected).
 * - **mergeMasks atomicity** —
 *   {@link mergeMasks} is the canonical merge entry point
 *   (`Promise<void>`). It captures a pre-merge snapshot suitable for
 *   `loadFromState`, renders the merged bitmap via
 *   {@link exportImageBase64}, removes every mask without history,
 *   reloads the merged data URL through the transactional
 *   `image/image-loader.ts`, and on success pushes exactly one
 *   {@link Command} whose `undo` restores the pre-merge snapshot and
 *   whose `execute` re-applies the merged image. On any failure
 *   between snapshot capture and history push, the pre-merge snapshot
 *   is restored and the promise rejects with
 *   {@link MergeMasksError}. Container scroll position is preserved
 *   across the success path (canonically via
 *   `loadImage(..., { preserveScroll: true})`, with a defensive
 *   restore at the tail of the merge).
 *
 * ## Why a service-shaped module
 *
 * Per the documented "Mapping Contracts to modules" table the export
 * pipeline owns its own module so the orchestrator stays thin. The
 * service is a stateless function-collection (matching
 * `image/image-loader.ts` and `core/state-serializer.ts`) and reads every
 * editor field through an explicit {@link ExportServiceContext} bundle.
 * This keeps the orchestrator authoritative for editor state — the export
 * helpers never store a reference to the canvas or options between
 * invocations — and makes the module trivially mockable from unit and
 * property tests.
 *
 * The module is intentionally NOT re-exported from `src/index.ts`
 * (only `ImageEditor`, `isMaskObject`, and the
 * documented public types are root-exported).
 *
 * @module
 */

import type * as FabricNS from 'fabric';

import { isMaskObject } from '../core/public-types.js';
import { reportError } from '../core/callback-reporter.js';
import type {
    Base64ExportOptions,
    ExportArea,
    FabricModule,
    ImageFileExportOptions,
    LoadImageOptions,
    MaskObject,
    NormalizedImageFormat,
    ResolvedOptions,
} from '../core/public-types.js';
import { ExportError, ExportNotReadyError, MergeMasksError } from '../core/errors.js';
import { Command, type HistoryManager } from '../history/history-manager.js';
import { withMaskStyleBackup } from '../mask/mask-style.js';
import {
    getClampedCanvasRegion,
    getObjectBBox,
    getPartialExportEdges,
    hasMeaningfulCanvasRegion,
    type IntegerRegion,
    type PartialExportEdges,
} from '../utils/canvas-region.js';
import { resolveExportFormat, type ResolvedExportFormat } from './export-format.js';

type LabelBackup = {
    readonly mask: MaskObject;
    readonly label: FabricNS.FabricObject;
    readonly wasOnCanvas: boolean;
    readonly visible: unknown;
};

type CanvasWithSelection = FabricNS.Canvas & {
    getActiveObject?: () => FabricNS.FabricObject | null | undefined;
    setActiveObject?: (object: FabricNS.FabricObject) => FabricNS.Canvas;
};

interface ResolvedExportOptions {
    exportArea: ExportArea;
    mergeMask: boolean;
    multiplier: number;
    format: ResolvedExportFormat;
}

type MaskVisibilityBackup = {
    readonly mask: MaskObject;
    readonly visible: unknown;
};

// ─── Context ─────────────────────────────────────────────────────────────────

/**
 * Dependency bundle passed by the `ImageEditor` facade into every export
 * entry point. The service has no class state of its own — every editor
 * field it reads is exposed here as a value or callback so the facade
 * keeps ownership of the canonical state.
 *
 * Mirrors the shape of {@link import('../image/image-loader.js').LoadImageContext}
 * for consistency across pipeline modules.
 *
 * @see image/image-loader.ts (the same context-bundle pattern)
 */
export interface ExportServiceContext {
    /** The Fabric module providing `Canvas` / `FabricImage`. */
    readonly fabric: FabricModule;
    /** The live Fabric canvas. Always non-null on a constructed editor. */
    readonly canvas: FabricNS.Canvas;
    /** Resolved editor options — supplies `defaultDownloadFileName`,
     *  `downsampleQuality`, `exportMultiplier`, and
     *  `exportAreaByDefault`. */
    readonly options: ResolvedOptions;

    /**
     * Predicate matching `ImageEditor.isImageLoaded`. Returns `true`
     * only when an `originalImage` has been committed and has positive
     * dimensions (reads through this gate).
     */
    isImageLoaded(): boolean;

    /**
     * The currently committed `originalImage`, or `null` when no image is
     * loaded. {@link computeExportRegion} reads it through this callback
     * to derive the floored bounding box for image-area
     * exports. When the image has been disposed or
     * never loaded the seam falls through to a full-canvas export.
     */
    getOriginalImage(): FabricNS.FabricImage | null;
}

// ─── Internal helpers ────────────────────────────────────────────────────────

/**
 * Numeric resolution of `multiplier` against the editor defaults. Mirrors
 * legacy's `options.multiplier || this.options.exportMultiplier || 1` so a
 * caller-supplied `0` or non-finite value falls through to the resolved
 * default and finally to `1`.
 *
 * @param requested - Caller-supplied multiplier from the export options.
 * @param fallback - `options.exportMultiplier` from {@link ResolvedOptions}.
 * @returns          A finite multiplier `>= 1`, never `NaN`.
 */
function resolveMultiplier(requested: unknown, fallback: number): number {
    const num = Number(requested);
    if (Number.isFinite(num) && num > 0) return num;
    const fallbackValue = Number(fallback);
    return Number.isFinite(fallbackValue) && fallbackValue > 0 ? fallbackValue : 1;
}

function resolveExportArea(requested: unknown, fallback: ExportArea): ExportArea {
    if (requested === 'canvas' || requested === 'image') return requested;
    return fallback === 'canvas' ? 'canvas' : 'image';
}

function resolveExportOptions(
    context: ExportServiceContext,
    options?: Base64ExportOptions | ImageFileExportOptions | null,
): ResolvedExportOptions {
    const providedOptions = options ?? {};
    return {
        exportArea: resolveExportArea(
            providedOptions.exportArea,
            context.options.exportAreaByDefault,
        ),
        mergeMask:
            typeof providedOptions.mergeMask === 'boolean'
                ? providedOptions.mergeMask
                : context.options.mergeMaskByDefault,
        multiplier: resolveMultiplier(providedOptions.multiplier, context.options.exportMultiplier),
        format: resolveExportFormat(providedOptions, context.options.downsampleQuality),
    };
}

function readCanvasDimension(
    canvas: FabricNS.Canvas,
    getterName: 'getWidth' | 'getHeight',
    propertyName: 'width' | 'height',
): number {
    const canvasLike = canvas as FabricNS.Canvas & {
        width?: number;
        height?: number;
        getWidth?: () => number;
        getHeight?: () => number;
    };
    const getter = canvasLike[getterName];
    const value = typeof getter === 'function' ? getter.call(canvasLike) : canvasLike[propertyName];
    return Math.max(1, Math.ceil(Number.isFinite(value) ? Number(value) : 1));
}

function assertExportPixelBudget(
    context: ExportServiceContext,
    multiplier: number,
    region: IntegerRegion | null,
): void {
    const sourceWidth = region?.width ?? readCanvasDimension(context.canvas, 'getWidth', 'width');
    const sourceHeight =
        region?.height ?? readCanvasDimension(context.canvas, 'getHeight', 'height');
    const outputWidth = Math.max(1, Math.ceil(sourceWidth * multiplier));
    const outputHeight = Math.max(1, Math.ceil(sourceHeight * multiplier));
    const pixelCount = outputWidth * outputHeight;
    const maxPixels = context.options.maxExportPixels;

    if (!Number.isFinite(pixelCount) || pixelCount > maxPixels) {
        throw new RangeError(
            `[ImageEditor] Export size ${outputWidth}x${outputHeight} ` +
                `(${pixelCount} pixels) exceeds maxExportPixels (${maxPixels}).`,
        );
    }
}

/**
 * Compute the export region passed to Fabric's `toDataURL`. Returns
 * `null` to mean "no region clipping — emit the full canvas", which
 * Fabric treats as omitting `left`/`top`/`width`/`height` from the
 * options object.
 *
 * Region semantics:
 *
 * - When `exportArea` is `'canvas'`, the full canvas is exported
 *   regardless of whether an `originalImage` is present (the masks
 *   stencil is what the consumer asked for).
 * - When `exportArea` is `'image'` and `context.getOriginalImage`
 *   returns a valid image, the image's absolute bounding rect is read
 *   through {@link getObjectBBox} (which calls `setCoords` so a
 *   freshly mutated image returns fresh coordinates) and discretized
 *   through {@link floorRegion}. The resulting integer region is
 *   handed straight to Fabric's region export options — there is no
 *   intermediate `<canvas>`, and the floor on
 *   `width`/`height` prevents the 1-pixel JPEG edge artifact called
 *   out by the integer-region floor.
 * - When `exportArea` is `'image'` but no `originalImage` is
 *   committed (a defensive case the `isImageLoaded` gate above
 *   normally rules out), fall through to a full-canvas export so the
 *   `toDataURL` call still emits a valid frame instead of throwing on
 *   a `null` bounding rect.
 *
 * @param context - Export context for `originalImage` access.
 * @param exportArea - Resolved export-area value (caller default already
 *                         applied by the entry point).
 * @returns                `null` for full-canvas exports; otherwise an
 *                         {@link IntegerRegion} suitable for
 *                         `canvas.toDataURL({ left, top, width, height})`.
 */
interface ExportRegionInfo {
    region: IntegerRegion | null;
    partialEdges: PartialExportEdges | null;
}

function computeExportRegion(
    context: ExportServiceContext,
    exportArea: ExportArea,
): ExportRegionInfo {
    if (exportArea === 'canvas') return { region: null, partialEdges: null };
    const originalImage = context.getOriginalImage();
    if (!originalImage) return { region: null, partialEdges: null };
    const bounds = getObjectBBox(originalImage);
    const canvasLike = context.canvas as FabricNS.Canvas & {
        width?: number;
        height?: number;
        getWidth?: () => number;
        getHeight?: () => number;
    };
    const canvasWidth =
        typeof canvasLike.getWidth === 'function' ? canvasLike.getWidth() : canvasLike.width;
    const canvasHeight =
        typeof canvasLike.getHeight === 'function' ? canvasLike.getHeight() : canvasLike.height;
    if (!hasMeaningfulCanvasRegion(bounds, canvasWidth, canvasHeight)) {
        throw new ExportError('exportImageBase64 failed: image export region is empty.');
    }
    return {
        region: getClampedCanvasRegion(bounds, canvasWidth, canvasHeight, {
            includePartialPixels: true,
        }),
        partialEdges: getPartialExportEdges(bounds, Number(originalImage.angle) || 0),
    };
}

/**
 * Bracket helper that captures every mask's live style, applies the
 * export-only bake-in style, runs `callback`, and restores the captured live
 * styles inside a `finally` block — even if `callback` rejected.
 *
 * Bake-in is applied when `mergeMask === true`, matching the merge path's
 * mergeMask path where the rendered raster needs solid black masks so
 * the masked-out regions are flattened into the JPEG/PNG output. When
 * When `mergeMask === false`, masks are hidden for the render and restored.
 *
 * For each mask the bake-in mutator forces:
 *
 *   `opacity: 1, fill: '#000', strokeWidth: 0, stroke: null,
 *    selectable: false`
 *
 * matching legacy's `_mergeMasks`/`exportImageBase64` (`#000000` collapsed to
 * `#000`; both serialize identically through Fabric to a solid black
 * fill). The restoration step is owned by `withMaskStyleBackup` in
 * `mask/mask-style.ts`, which captures `opacity`/`fill`/`stroke`/
 * `strokeWidth`/`selectable`/`lockRotation` BEFORE the mutator runs and
 * restores all six fields in a `finally` even when the inner step
 * rejected.
 *
 * @param context - Export context — supplies the live canvas to
 *                         the canonical backup helper.
 * @param mergeMask - Resolved mask compositing flag. `true` triggers
 *                         bake-in; `false` hides masks during render.
 * @param callback - The async data-URL rendering step. Already
 *                         knows the resolved format/quality/multiplier
 *                         and the export region, and calls
 *                         `canvas.toDataURL` directly.
 * @returns                Whatever `callback` resolves to.
 *
 */
async function withMaskExportState<T>(
    context: ExportServiceContext,
    mergeMask: boolean,
    callback: () => Promise<T>,
): Promise<T> {
    if (!mergeMask) return withMasksHidden(context, callback);
    return withMaskStyleBackup(
        { canvas: context.canvas, options: context.options },
        applyExportBakeInStyle,
        callback,
    );
}

async function withMasksHidden<T>(
    context: ExportServiceContext,
    callback: () => Promise<T>,
): Promise<T> {
    const backups: MaskVisibilityBackup[] = getCanvasObjects(context.canvas)
        .filter(isMaskObject)
        .map((mask) => ({
            mask,
            visible: (mask as { visible?: unknown }).visible,
        }));

    for (const backup of backups) {
        try {
            if (typeof backup.mask.set === 'function') {
                backup.mask.set({ visible: false });
            } else {
                (backup.mask as { visible?: unknown }).visible = false;
            }
        } catch {
            /* ignore — export restoration remains best-effort */
        }
    }

    try {
        return await callback();
    } finally {
        for (const backup of backups) {
            try {
                if (typeof backup.mask.set === 'function') {
                    backup.mask.set({ visible: backup.visible });
                } else {
                    (backup.mask as { visible?: unknown }).visible = backup.visible;
                }
            } catch {
                /* ignore — do not mask the export result */
            }
        }
    }
}

function getCanvasObjects(canvas: FabricNS.Canvas): FabricNS.FabricObject[] {
    try {
        return canvas.getObjects();
    } catch {
        return [];
    }
}

function isObjectOnCanvas(canvas: FabricNS.Canvas, object: FabricNS.FabricObject): boolean {
    return getCanvasObjects(canvas).includes(object);
}

function captureMaskLabelBackups(canvas: FabricNS.Canvas): LabelBackup[] {
    const backups: LabelBackup[] = [];
    for (const object of getCanvasObjects(canvas)) {
        if (!isMaskObject(object)) continue;
        const label = object.labelObject;
        if (!label) continue;
        const wasOnCanvas = isObjectOnCanvas(canvas, label);
        backups.push({
            mask: object,
            label,
            wasOnCanvas,
            visible: (label as { visible?: unknown }).visible,
        });
        try {
            if (typeof label.set === 'function') label.set({ visible: false });
            if (wasOnCanvas) canvas.remove(label);
        } catch {
            /* ignore — stale label references are restored best-effort */
        }
    }
    return backups;
}

function restoreMaskLabelBackups(canvas: FabricNS.Canvas, backups: readonly LabelBackup[]): void {
    for (const backup of backups) {
        try {
            backup.mask.labelObject = backup.label;
            if (typeof backup.label.set === 'function') {
                backup.label.set({ visible: backup.visible });
            } else {
                (backup.label as { visible?: unknown }).visible = backup.visible;
            }
            if (backup.wasOnCanvas && !isObjectOnCanvas(canvas, backup.label)) {
                canvas.add(backup.label);
                canvas.bringObjectToFront(backup.label);
            }
        } catch {
            /* ignore — label restoration is best-effort after export */
        }
    }
}

function captureActiveObject(canvas: FabricNS.Canvas): FabricNS.FabricObject | null {
    try {
        const canvasWithSelection = canvas as CanvasWithSelection;
        if (typeof canvasWithSelection.getActiveObject !== 'function') return null;
        return canvasWithSelection.getActiveObject() ?? null;
    } catch {
        return null;
    }
}

function restoreActiveObject(
    canvas: FabricNS.Canvas,
    activeObject: FabricNS.FabricObject | null,
): void {
    if (!activeObject) return;
    try {
        const canvasWithSelection = canvas as CanvasWithSelection;
        if (typeof canvasWithSelection.setActiveObject === 'function') {
            canvasWithSelection.setActiveObject(activeObject);
        }
    } catch {
        /* ignore — selected objects may have been removed during export */
    }
}

function requestRender(canvas: FabricNS.Canvas): void {
    try {
        if (typeof canvas.requestRenderAll === 'function') {
            canvas.requestRenderAll();
        } else {
            canvas.renderAll();
        }
    } catch {
        /* ignore — export restoration must not mask the original result */
    }
}

/**
 * Mutator passed to {@link withMaskStyleBackup} that forces a single
 * mask to the export bake-in style. Matches legacy's mergeMask path
 * literal-for-literal (`#000` ≡ `#000000` once Fabric normalizes the
 * fill). Wrapped in `try/catch` so a stale Fabric reference does not
 * break the iteration over a multi-mask canvas — the surrounding
 * `withMaskStyleBackup` is responsible for the restore regardless.
 */
function applyExportBakeInStyle(mask: MaskObject): void {
    try {
        mask.set({
            opacity: 1,
            fill: '#000',
            strokeWidth: 0,
            stroke: null,
            selectable: false,
        });
        if (typeof mask.setCoords === 'function') mask.setCoords();
    } catch {
        /* ignore — mask may have been removed mid-iteration */
    }
}

/**
 * Produce a base64 data URL from the live canvas using the resolved
 * format, quality, multiplier, and (optional) export region. Calls
 * `canvas.toDataURL` directly — there is no intermediate `<canvas>`.
 *
 * The `region` argument is `null` for full-canvas exports and an
 * {@link IntegerRegion} for image-area exports, where the image bounding
 * box has already been floored to Fabric's integer region coordinates.
 */
function renderCanvasToDataUrl(
    canvas: FabricNS.Canvas,
    format: NormalizedImageFormat,
    quality: number | undefined,
    multiplier: number,
    region: IntegerRegion | null,
): string {
    const fabricOptions: Record<string, unknown> = {
        format,
        multiplier,
    };
    // PNG ignores `quality`; `resolveExportFormat`
    // returns `undefined` for PNG so the key is omitted entirely.
    if (quality !== undefined) fabricOptions.quality = quality;
    if (region) {
        fabricOptions.left = region.left;
        fabricOptions.top = region.top;
        fabricOptions.width = region.width;
        fabricOptions.height = region.height;
    }
    // Cast: Fabric's `TDataUrlOptions` is structurally identical to the
    // shape we built but is not re-exported as a public type from the
    // package surface, so we erase the dictionary type at the boundary.
    return canvas.toDataURL(fabricOptions as Parameters<typeof canvas.toDataURL>[0]);
}

function hasPartialEdges(edges: PartialExportEdges | null): boolean {
    return !!edges && (edges.left || edges.top || edges.right || edges.bottom);
}

function getImageDimensions(imageElement: HTMLImageElement): { width: number; height: number } {
    return {
        width: Math.max(1, imageElement.naturalWidth || imageElement.width || 1),
        height: Math.max(1, imageElement.naturalHeight || imageElement.height || 1),
    };
}

function loadImageElement(dataUrl: string): Promise<HTMLImageElement> {
    return new Promise<HTMLImageElement>((resolve, reject) => {
        const imageElement = new Image();
        imageElement.crossOrigin = 'anonymous';

        const cleanup = (): void => {
            if (typeof imageElement.removeEventListener === 'function') {
                imageElement.removeEventListener('load', handleLoad);
                imageElement.removeEventListener('error', handleError);
            } else {
                imageElement.onload = null;
                imageElement.onerror = null;
            }
        };
        const handleLoad = (): void => {
            cleanup();
            resolve(imageElement);
        };
        const handleError = (): void => {
            cleanup();
            reject(new Error('Failed to decode export data URL'));
        };

        if (typeof imageElement.addEventListener === 'function') {
            imageElement.addEventListener('load', handleLoad, { once: true });
            imageElement.addEventListener('error', handleError, { once: true });
        } else {
            imageElement.onload = handleLoad;
            imageElement.onerror = handleError;
        }
        imageElement.src = dataUrl;
    });
}

async function sealPartialTransparentEdges(
    dataUrl: string,
    edges: PartialExportEdges | null,
): Promise<string> {
    if (!hasPartialEdges(edges)) return dataUrl;

    const imageElement = await loadImageElement(dataUrl);
    const { width, height } = getImageDimensions(imageElement);
    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = width;
    offscreenCanvas.height = height;
    const canvasContext = offscreenCanvas.getContext('2d');
    if (!canvasContext) throw new Error('2D canvas context is unavailable');

    canvasContext.drawImage(imageElement, 0, 0, width, height);
    const imageData = canvasContext.getImageData(0, 0, width, height);
    const pixels = imageData.data;

    const sealPixel = (x: number, y: number, fallbackX: number, fallbackY: number): void => {
        const index = (y * width + x) * 4;
        const fallbackIndex = (fallbackY * width + fallbackX) * 4;
        const alpha = pixels[index + 3] ?? 0;
        const fallbackAlpha = pixels[fallbackIndex + 3] ?? 0;
        if (alpha === 0 && fallbackAlpha > 0) {
            pixels[index] = pixels[fallbackIndex] ?? 0;
            pixels[index + 1] = pixels[fallbackIndex + 1] ?? 0;
            pixels[index + 2] = pixels[fallbackIndex + 2] ?? 0;
            pixels[index + 3] = fallbackAlpha;
        }
        const nextAlpha = pixels[index + 3] ?? 0;
        if (nextAlpha > 0 && nextAlpha < 255) {
            pixels[index + 3] = 255;
        }
    };

    if (edges?.left && width > 1) {
        for (let y = 0; y < height; y += 1) sealPixel(0, y, 1, y);
    }
    if (edges?.right && width > 1) {
        for (let y = 0; y < height; y += 1) sealPixel(width - 1, y, width - 2, y);
    }
    if (edges?.top && height > 1) {
        for (let x = 0; x < width; x += 1) sealPixel(x, 0, x, 1);
    }
    if (edges?.bottom && height > 1) {
        for (let x = 0; x < width; x += 1) sealPixel(x, height - 1, x, height - 2);
    }

    canvasContext.putImageData(imageData, 0, 0);
    return offscreenCanvas.toDataURL('image/png');
}

function getJpegBackgroundColor(backgroundColor: unknown): string {
    return resolveCanvasFillStyle(backgroundColor);
}

function resolveCanvasFillStyle(backgroundColor: unknown, fallback = '#ffffff'): string {
    const value = String(backgroundColor ?? '').trim();
    if (!value || isTransparentCssColor(value)) return '#ffffff';
    const context = createColorValidationContext();
    if (!context) return fallback;

    context.fillStyle = '#000001';
    const firstSentinel = context.fillStyle;
    context.fillStyle = value;
    const firstResolved = context.fillStyle;
    if (firstResolved !== firstSentinel) return firstResolved;

    context.fillStyle = '#000002';
    const secondSentinel = context.fillStyle;
    context.fillStyle = value;
    const secondResolved = context.fillStyle;
    if (secondResolved !== secondSentinel) return secondResolved;

    return fallback;
}

function createColorValidationContext(): CanvasRenderingContext2D | null {
    try {
        if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
            return null;
        }
        return document.createElement('canvas').getContext('2d');
    } catch {
        return null;
    }
}

function isTransparentCssColor(value: string): boolean {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'transparent') return true;

    const hex = normalized.match(/^#([0-9a-f]{4}|[0-9a-f]{8})$/i);
    if (hex) {
        const digits = hex[1]!;
        const alpha = digits.length === 4 ? digits[3]! : digits.slice(6, 8);
        return /^0+$/.test(alpha);
    }

    const commaAlpha = normalized.match(/^(?:rgba|hsla)\((.*),\s*([^,/)]+)\)$/i);
    if (commaAlpha && isZeroCssAlpha(commaAlpha[2]!)) return true;

    const slashAlpha = normalized.match(/^[a-z][a-z0-9-]*\([^/]+\/\s*([^)]+)\)$/i);
    if (slashAlpha && isZeroCssAlpha(slashAlpha[1]!)) return true;

    return false;
}

function isZeroCssAlpha(value: string): boolean {
    const alpha = value.trim();
    if (alpha.endsWith('%')) {
        const numericPercent = Number.parseFloat(alpha.slice(0, -1));
        return Number.isFinite(numericPercent) && numericPercent === 0;
    }
    const numericAlpha = Number.parseFloat(alpha);
    return Number.isFinite(numericAlpha) && numericAlpha === 0;
}

async function convertDataUrlToOpaqueJpeg(
    dataUrl: string,
    backgroundColor: unknown,
    quality: number | undefined,
): Promise<string> {
    const imageElement = await loadImageElement(dataUrl);
    const { width, height } = getImageDimensions(imageElement);
    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = width;
    offscreenCanvas.height = height;
    const canvasContext = offscreenCanvas.getContext('2d');
    if (!canvasContext) throw new Error('2D canvas context is unavailable');
    canvasContext.fillStyle = getJpegBackgroundColor(backgroundColor);
    canvasContext.fillRect(0, 0, width, height);
    canvasContext.drawImage(imageElement, 0, 0, width, height);
    return offscreenCanvas.toDataURL('image/jpeg', quality);
}

/**
 * Convert a `data:image/...;base64...` URL into the byte array that
 * `new File([...]...)` consumes. Mirrors legacy's reverse-loop decode so
 * large data URLs do not allocate intermediate `Array.from` storage.
 *
 * Splits on the first comma rather than `.split(',')[1]` — some browsers
 * historically embedded base64 padding `=` characters that are safe but
 * not guaranteed to be comma-free in every consumer's downstream
 * pipeline; joining the tail back together preserves the full payload.
 *
 * @throws DOMException if the data URL is malformed and `atob` rejects.
 */
function dataUrlToBytes(dataUrl: string): Uint8Array<ArrayBuffer> {
    const match = /^data:image\/[a-z0-9.+-]+;base64,([A-Za-z0-9+/=\s]+)$/i.exec(dataUrl);
    if (!match || !match[1]?.trim()) {
        throw new Error('exportImageFile received a malformed or empty image data URL.');
    }
    const commaAt = dataUrl.indexOf(',');
    const base64 = dataUrl.slice(commaAt + 1).replace(/\s/g, '');
    if (typeof globalThis.atob === 'function') {
        const binary = globalThis.atob(base64);
        // Explicitly allocate a fresh ArrayBuffer so the resulting
        // Uint8Array's `buffer` is typed as `ArrayBuffer` (rather than
        // `ArrayBufferLike`, which the lib.dom `BlobPart` union rejects
        // because it admits `SharedArrayBuffer`).
        const buffer = new ArrayBuffer(binary.length);
        const bytes = new Uint8Array(buffer);
        for (let i = binary.length - 1; i >= 0; i -= 1) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    }

    const bufferCtor = (
        globalThis as unknown as {
            Buffer?: {
                from(input: string, encoding: 'base64'): Uint8Array;
            };
        }
    ).Buffer;
    if (bufferCtor && typeof bufferCtor.from === 'function') {
        const source = bufferCtor.from(base64, 'base64');
        const buffer = new ArrayBuffer(source.length);
        const bytes = new Uint8Array(buffer);
        bytes.set(source);
        return bytes;
    }

    throw new Error('No base64 decoder is available for exportImageFile.');
}

/**
 * Repaint a base64 data URL through an offscreen `<canvas>` so the
 * resulting URL carries the requested MIME type. Mirrors legacy's behavior
 * for `exportImageFile` — the underlying `canvas.toDataURL` may quietly
 * fall back to PNG when the requested format is unsupported by the
 * browser, and the file output should still match the requested MIME.
 *
 * The conversion only runs when the source URL's MIME prefix does not
 * match the requested format; the matching-prefix fast path returns the
 * URL unchanged and skips the extra decode entirely.
 */
async function reencodeDataUrlAs(
    sourceDataUrl: string,
    target: ResolvedExportFormat,
    backgroundColor: unknown,
): Promise<string> {
    if (sourceDataUrl.startsWith(`data:${target.mimeType}`)) {
        return sourceDataUrl;
    }

    const imageElement = await loadImageElement(sourceDataUrl);
    const { width, height } = getImageDimensions(imageElement);

    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = width;
    offscreenCanvas.height = height;

    const canvasContext = offscreenCanvas.getContext('2d');
    if (!canvasContext) {
        throw new Error('Unable to acquire 2D context for export conversion');
    }

    if (target.format === 'jpeg') {
        canvasContext.fillStyle = getJpegBackgroundColor(backgroundColor);
        canvasContext.fillRect(0, 0, width, height);
    }

    canvasContext.drawImage(imageElement, 0, 0, width, height);

    return offscreenCanvas.toDataURL(target.mimeType, target.quality);
}

/** Single source of truth for the "no image" warning text. */
function warnNoImageLoaded(operation: string): void {
    console.warn(`[ImageEditor] ${operation} skipped: no image is loaded on the canvas.`);
}

// ─── exportImageBase64 ───────────────────────────────────────────────────────

/**
 * Render the live canvas to a base64 data URL.
 *
 * Steps, in order:
 *
 * 1. **No-image gate** — when `context.isImageLoaded`
 *    is `false`, emit a `console.warn` and resolve to `''` without
 *    touching the canvas.
 * 2. **Discard ActiveSelection** — call
 *    `canvas.discardActiveObject` once before computing the export
 *    region. Subsequent steps render against the post-discard canvas
 *    state, which never carries a top-level `ActiveSelection`.
 * 3. **Resolve format/quality**
 *    via {@link resolveExportFormat}.
 * 4. **Resolve multiplier** — `options.multiplier || exportMultiplier || 1`.
 * 5. **Compute region** — see {@link computeExportRegion}. Returns
 *    `null` for full-canvas exports and a floored {@link IntegerRegion}
 *    when `exportArea` is `'image'` and an `originalImage` is
 *    committed.
 * 6. **Render** through {@link withMaskExportState} so mask styles are
 *    captured, the export bake-in (`opacity: 1, fill: '#000',
 *    strokeWidth: 0, stroke: null, selectable: false`) is applied for
 *    `mergeMask === true` exports, and the live styles are
 *    restored in a `finally` block whether the render resolved or
 *    threw. The inner step is a single
 *    `canvas.toDataURL` call — no intermediate `<canvas>`.
 *
 * @param context - Export context bundle.
 * @param options - Optional {@link Base64ExportOptions}. Both `fileType`
 *                 and `format` are accepted; when
 *                 both are supplied, `fileType` wins.
 * @returns        Resolves to a `data:image/...;base64...` URL on
 *                 success, or `''` when no image is loaded.
 *
 */
export async function exportImageBase64(
    context: ExportServiceContext,
    options?: Base64ExportOptions,
): Promise<string> {
    if (!context.isImageLoaded()) {
        warnNoImageLoaded('exportImageBase64');
        return '';
    }

    const activeObject = captureActiveObject(context.canvas);
    const labelBackups = captureMaskLabelBackups(context.canvas);
    try {
        // Drop any active selection BEFORE region math. It is restored in
        // the finally block so export does not perturb the editor UI.
        context.canvas.discardActiveObject();

        const resolved = resolveExportOptions(context, options);
        const { region, partialEdges } = computeExportRegion(context, resolved.exportArea);
        assertExportPixelBudget(context, resolved.multiplier, region);
        const renderFormat =
            region && resolved.format.format === 'jpeg' ? 'png' : resolved.format.format;
        const renderQuality = renderFormat === 'png' ? undefined : resolved.format.quality;

        let dataUrl = await withMaskExportState(context, resolved.mergeMask, async () =>
            renderCanvasToDataUrl(
                context.canvas,
                renderFormat,
                renderQuality,
                resolved.multiplier,
                region,
            ),
        );
        if (region) {
            dataUrl = await sealPartialTransparentEdges(dataUrl, partialEdges);
            if (resolved.format.format === 'jpeg') {
                dataUrl = await convertDataUrlToOpaqueJpeg(
                    dataUrl,
                    context.options.backgroundColor,
                    resolved.format.quality,
                );
            }
        }
        return dataUrl;
    } finally {
        restoreMaskLabelBackups(context.canvas, labelBackups);
        restoreActiveObject(context.canvas, activeObject);
        requestRender(context.canvas);
    }
}

// ─── exportImageFile ─────────────────────────────────────────────────────────

/**
 * Render the live canvas to a `File`.
 *
 * The bytes come from {@link exportImageBase64} so format/quality/
 * multiplier resolution stays consistent with the base64 path. The
 * resulting data URL is repainted through an offscreen `<canvas>` only
 * when its MIME prefix does not match the requested type — some browsers
 * silently fall back to PNG when the requested format is unsupported,
 * and the export contract requires the output MIME to match the resolved
 * `fileType`.
 *
 * @param context - Export context bundle.
 * @param options - Optional {@link ImageFileExportOptions}.
 * @returns        Resolves with the rendered `File`.
 * @throws         {@link ExportNotReadyError} when no image is loaded.
 *
 */
export async function exportImageFile(
    context: ExportServiceContext,
    options?: ImageFileExportOptions,
): Promise<File> {
    if (!context.isImageLoaded()) {
        warnNoImageLoaded('exportImageFile');
        throw new ExportNotReadyError('exportImageFile');
    }

    const providedOptions = options ?? {};
    const fileName = providedOptions.fileName ?? context.options.defaultDownloadFileName;
    const resolved = resolveExportFormat(providedOptions, context.options.downsampleQuality);

    // Reuse `exportImageBase64` so format/quality/multiplier resolution,
    // ActiveSelection discard, and the bake-in/restore bracket are all
    // defined once.
    const base64 = await exportImageBase64(context, {
        exportArea: providedOptions.exportArea,
        mergeMask: providedOptions.mergeMask,
        multiplier: providedOptions.multiplier,
        quality: providedOptions.quality,
        fileType: providedOptions.fileType,
    });
    if (!base64) {
        // exportImageBase64 already warned about the missing image; the
        // file path still owes its own typed rejection. In practice this
        // branch is unreachable because the `isImageLoaded` gate above
        // already returned, but the guard keeps the function total even
        // if a caller bypasses the gate by mutating the context between
        // awaits.
        throw new ExportNotReadyError('exportImageFile');
    }

    const finalDataUrl = await reencodeDataUrlAs(base64, resolved, context.options.backgroundColor);
    let bytes: Uint8Array<ArrayBuffer>;
    try {
        bytes = dataUrlToBytes(finalDataUrl);
    } catch (error) {
        throw new ExportError('exportImageFile failed to decode rendered data URL.', error);
    }
    return new File([bytes], fileName, { type: resolved.mimeType });
}

// ─── downloadImage ───────────────────────────────────────────────────────────

/**
 * Trigger a browser download of the live canvas.
 *
 * Mirrors legacy's "anchor with `download` attribute" approach: an `<a>`
 * element is created, pointed at the data URL, appended to the document
 * so Firefox dispatches the click, clicked, and removed. The function
 * returns synchronously; the data URL is rendered
 * asynchronously and the click is deferred until that promise resolves.
 *
 * No-image gate emits the same `console.warn` as the
 * other entry points and returns without touching the DOM.
 *
 * Errors raised by the underlying `exportImageBase64` call are reported
 * with `console.error` rather than rethrown — `downloadImage` returns
 * `void` and there is no caller-visible promise to reject.
 *
 * @param context - Export context bundle.
 * @param fileName - Optional filename override. Defaults to
 *                  `options.defaultDownloadFileName`.
 *
 */
export function downloadImage(context: ExportServiceContext, fileName?: string): void {
    if (!context.isImageLoaded()) {
        warnNoImageLoaded('downloadImage');
        return;
    }

    const resolvedFileName = fileName ?? context.options.defaultDownloadFileName;

    // The download path mirrors legacy: an anchor with `download` and an
    // `href` set to the data URL emitted by `exportImageBase64`. The
    // anchor is appended to `document.body` because some browsers
    // (notably Firefox) ignore programmatic clicks on detached nodes.
    void exportImageBase64(context, {
        exportArea: context.options.exportAreaByDefault,
        mergeMask: context.options.mergeMaskByDefault,
        multiplier: context.options.exportMultiplier,
    })
        .then((dataUrl) => {
            if (!dataUrl) return; // already warned by `exportImageBase64`
            const link = document.createElement('a');
            link.download = resolvedFileName;
            link.href = dataUrl;
            document.body.appendChild(link);
            try {
                link.click();
            } finally {
                document.body.removeChild(link);
            }
        })
        .catch((error: unknown) => {
            reportError(context.options, error, 'downloadImage failed.');
            console.error('[ImageEditor] downloadImage failed', error);
        });
}

// ─── mergeMasks ──────────────────────────────────────────────────────────────

/**
 * Dependency bundle passed by the `ImageEditor` facade into
 * {@link mergeMasks}. Extends {@link ExportServiceContext} with the
 * extra slots the merge pipeline needs:
 *
 * - the {@link HistoryManager} that records the merge as one undoable
 *   step;
 * - the canonical `loadImage` entry point (transactional load with
 *   rollback) so a failed reload of the merged bitmap propagates back
 *   to the merge's own rollback path;
 * - the `saveState` / `loadFromState` callbacks the orchestrator
 *   already wires for `undo` / `redo`, so the merge can capture and
 *   restore the pre-merge snapshot through the same
 *   `core/state-serializer.ts` helpers used by the rest of the editor;
 * - a `removeAllMasks(saveHistory: false)` callback so the merge's
 *   single enclosing history entry is the only one pushed for the
 *   operation (exactly one history entry);
 * - the live container element so the success path can preserve scroll
 *   even when the inner `loadImage` did not honor `preserveScroll`.
 *
 * Mirrors the shape of `image/image-loader.ts → LoadImageContext` for
 * consistency across pipeline modules. The `ImageEditor` facade constructs
 * this bundle from its own state.
 *
 */
export interface MergeMasksContext extends ExportServiceContext {
    /** History manager that records the single merge command. */
    readonly historyManager: HistoryManager;
    /**
     * Scrollable container wrapping the canvas, or `null`. Read at the
     * head of `mergeMasks` so the success path can restore the captured
     * scroll position regardless of the layout
     * strategy applied by the inner `loadImage`.
     */
    readonly containerElement: HTMLElement | null;

    /**
     * Transactional image loader. The merge passes
     * `{ preserveScroll: true}` so the inner load tries to keep scroll
     * stable; the merge also restores scroll defensively at the tail of
     * the success path.
     */
    loadImage(imageBase64: string, options?: LoadImageOptions): Promise<void>;

    /**
     * Capture a snapshot suitable for {@link loadFromStateFn}. Reads the
     * orchestrator's `lastSnapshot`-producing path so the merge stores
     * exactly the same wire format used by `undo` / `redo`.
     */
    saveState(): string;

    /**
     * Restore a snapshot produced by {@link saveStateFn}. Used both as
     * the `undo` callback of the merge command and
     * as the rollback step on any merge-pipeline failure.
     */
    loadFromState(snapshot: string): Promise<void>;

    /**
     * Remove every mask from the canvas WITHOUT pushing a history
     * entry. The merge owns the single enclosing history entry, so the
     * inner mask-removal step must opt out
     * of its own history push.
     */
    removeAllMasksNoHistory(): void;
}

/**
 * Flatten every mask into the base image and reload the flattened
 * image as the new canvas state. Atomic with respect to the editor:
 * either the merged image is committed and exactly one history entry
 * is pushed, or the editor is rewound to its pre-merge state and the
 * returned promise rejects with {@link MergeMasksError}.
 *
 * Steps, in order:
 *
 * 1. **No-op gates** — return without mutating anything when no image
 *    is loaded or when the canvas carries no mask objects (matches
 *    legacy's `if (!this.originalImage) return; … if (!masks.length) return;`).
 * 2. **Capture pre-merge snapshot** — call
 *    `context.saveState` so the snapshot is suitable for
 *    `context.loadFromState(...)`. The snapshot is the one source of
 *    truth for both the merge command's `undo` and
 *    the rollback path.
 * 3. **Discard ActiveSelection** — drop any active
 *    selection wrapper before computing the merged bitmap.
 * 4. **Capture container scroll** — read `scrollTop` / `scrollLeft`
 *    from the editor container so the success path can restore them
 *    after the inner `loadImage` runs.
 * 5. **Render the merged bitmap** — delegate to
 *    {@link exportImageBase64} with `exportArea: 'image'` and
 *    `multiplier: options.exportMultiplier`. The bake-in/restore
 *    bracket inside `exportImageBase64` ensures every live mask style
 *    is captured before the export-only style is applied and restored
 *    on both success and failure.
 * 6. **Remove all masks** without pushing history — the merge owns
 *    the single enclosing history entry, so the
 *    inner removal step providedOptions out of its own history push.
 * 7. **Reload the merged image** through the transactional
 *    `image/image-loader.ts` with `preserveScroll: true`. A failed
 *    reload propagates here so the rollback path catches it.
 * 8. **Capture post-merge snapshot** — call `context.saveState` again so
 *    the merge command's `execute` can replay the merged state on
 *    redo.
 * 9. **Restore scroll defensively** — write the
 *    captured `scrollTop` / `scrollLeft` back to the container even
 *    though the inner `loadImage` was asked to preserve scroll, so
 *    the user's view does not jump regardless of the layout strategy
 *    chosen by the loader.
 * 10. **Push exactly one history command** whose
 *    `undo` restores the pre-merge snapshot via `context.loadFromState`
 *    and whose `execute` re-applies the merged snapshot via
 *    `context.loadFromState`. The command is pushed via
 *    {@link HistoryManager.push} (NOT `execute`) because the merged
 *    state is already on the canvas — the first `redo` call should
 *    re-run the merged-state restore, but the initial commit should
 *    not double-render.
 *
 * On any failure between step 3 and step 10, the pre-merge snapshot
 * captured in step 3 is restored via `context.loadFromState` and the
 * promise rejects with {@link MergeMasksError} wrapping the original
 * cause. A failure inside the rollback itself is
 * logged via `console.warn` but does not mask the original error.
 *
 * @param context - Editor dependency bundle — see {@link MergeMasksContext}.
 * @returns   Resolves on success; rejects with
 *            {@link MergeMasksError} on any pipeline failure (after
 *            the pre-merge snapshot has been restored).
 *
 */
export async function mergeMasks(context: MergeMasksContext): Promise<void> {
    // 1. No-op gates — match legacy's `if (!this.originalImage) return; …
    //    if (!masks.length) return;`. These run before the snapshot is
    //    captured so a no-op merge does not produce an empty history
    //    entry.
    if (!context.isImageLoaded()) return;

    const masks = context.canvas
        .getObjects()
        .filter(
            (o): o is MaskObject =>
                'maskId' in o && typeof (o as { maskId?: unknown }).maskId === 'number',
        );
    if (masks.length === 0) return;

    // 2. capture a snapshot suitable for
    //    `loadFromState`. The snapshot is the single source of truth
    //    for both the rollback path and the merge
    //    command's `undo`. Capture before the explicit discard below
    //    so the serializer can record the active mask id and the facade
    //    can rebuild the transient label/list selection on undo.
    const beforeSnapshot = context.saveState();

    // 3. drop any active selection BEFORE computing
    //    the merged bitmap. `discardActiveObject` is a no-op when no
    //    selection is active. `context.saveState` already discarded once;
    //    the duplicate call is harmless and keeps this function
    //    readable as a self-contained pipeline.
    context.canvas.discardActiveObject();
    context.canvas.renderAll();

    // 4. Capture pre-merge container scroll. Read
    //    BEFORE any mutation so the values reflect the user's pre-merge
    //    viewport, not the post-merge canvas size.
    const preScrollTop = context.containerElement ? context.containerElement.scrollTop : null;
    const preScrollLeft = context.containerElement ? context.containerElement.scrollLeft : null;

    try {
        // 5. Render the merged bitmap. `exportImageBase64` runs the
        //    bake-in/restore bracket internally.
        const merged = await exportImageBase64(context, {
            exportArea: 'image',
            mergeMask: true,
            multiplier: context.options.exportMultiplier,
            fileType: 'png',
        });
        if (!merged) {
            // `exportImageBase64` only resolves to '' when no image is
            // loaded. The `isImageLoaded` gate at the top should
            // prevent this branch, but a defensive throw keeps the
            // pipeline total even if the orchestrator's predicate
            // disagrees with the bake-in step about image presence.
            throw new MergeMasksError('mergeMasks: exportImageBase64 returned an empty data URL.');
        }

        // 6. Remove every mask WITHOUT pushing a history entry. The
        //    merge owns the single enclosing entry.
        context.removeAllMasksNoHistory();

        // 7. Reload the merged image through the transactional loader
        //    so a decode/Fabric/timeout failure propagates back here
        //    and the rollback path catches it. `preserveScroll: true`
        //    nudges the loader to preserve scroll for the layouts that
        //    honor it; the explicit step 9 below handles the layouts
        //    that don't.
        await context.loadImage(merged, { preserveScroll: true });

        // 8. Capture the post-merge snapshot for the merge command's
        //    `execute` (used on redo).
        const afterSnapshot = context.saveState();

        // 9. Defensive scroll restore — even when
        //    the inner `loadImage` honored `preserveScroll`, the layout
        //    strategy may have resized the canvas in a way that
        //    altered scroll metrics. Writing the captured values back
        //    here guarantees the user's view does not jump regardless
        //    of which layout strategy was selected for the merged
        //    image.
        if (context.containerElement) {
            try {
                if (preScrollTop !== null) {
                    context.containerElement.scrollTop = preScrollTop;
                }
                if (preScrollLeft !== null) {
                    context.containerElement.scrollLeft = preScrollLeft;
                }
            } catch (scrollError) {
                console.warn('[ImageEditor] mergeMasks: scroll restore failed', scrollError);
            }
        }

        // 10. push exactly one history entry. Use
        //     `push` (not `execute`) because the merged state is
        //     already on the canvas; the first `redo` after an `undo`
        //     should re-run the merged-state restore via the
        //     command's `execute`.
        if (beforeSnapshot && afterSnapshot && beforeSnapshot !== afterSnapshot) {
            context.historyManager.push(
                new Command(
                    () => context.loadFromState(afterSnapshot),
                    () => context.loadFromState(beforeSnapshot),
                ),
            );
        }
    } catch (error) {
        // restore the pre-merge snapshot and
        // reject with `MergeMasksError`. A failure inside the rollback
        // itself is logged but does NOT mask the original error.
        try {
            await context.loadFromState(beforeSnapshot);
        } catch (rollbackError) {
            console.warn('[ImageEditor] mergeMasks: rollback failed', rollbackError);
        }
        // If the inner step already raised a `MergeMasksError`, keep
        // it; otherwise wrap so the public surface always reports a
        // consistent error type.
        if (error instanceof MergeMasksError) throw error;
        const message =
            error instanceof Error ? `mergeMasks failed: ${error.message}` : 'mergeMasks failed';
        throw new MergeMasksError(message, error);
    }
}
