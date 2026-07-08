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
 * - `exportImageBase64(options?: ImageExportOptions)`
 *   is the canonical base64 export entry point. It accepts both
 *   `fileType` and `format` for ergonomic interop and returns a
 *   `Promise<string>` resolving to a `data:image/...;base64...` data URL.
 * - `exportImageFile(options?: ImageExportOptions)` resolves to a `File`
 *   whose name comes from `options.fileName` or the editor's
 *   `defaultDownloadFileName`, with the final extension resolved from
 *   the output format.
 * - `downloadImage(options?: ImageExportOptions)` triggers a browser
 *   download through a generated object URL. The bytes match the same
 *   rendering core used by `exportImageBase64` and `exportImageFile`.
 * - When `isImageLoaded` is `false`, the three
 *   entry points exhibit the documented "no image loaded" shapes:
 *
 *   | entry point          | shape on no image                   |
 *   | -------------------- | ----------------------------------- |
 *   | `exportImageBase64`  | rejects with `ExportNotReadyError`  |
 *   | `exportImageFile`    | rejects with `ExportNotReadyError`  |
 *   | `downloadImage`      | resolves without throwing           |
 *
 * Each path reports a single warning naming the missing image through
 * the public `onWarning` callback so consumers can route diagnostics
 * consistently.
 * - When `exportArea` resolves
 *   to `'image'` and a valid `originalImage` exists, the export region is
 *   computed from `originalImage.getBoundingRect` and passed directly
 *   as `left`/`top`/`width`/`height` to Fabric's `toDataURL` options.
 *   Sub-pixel width/height values are floored to integer pixels through
 *   the {@link floorRegion} helper before Fabric receives the region.
 *   Offscreen canvas post-processing is reserved for partial-edge
 *   sealing and JPEG background compositing.
 * - When `mergeMasks` is
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

import { isAnnotationObject, isMaskObject, isSessionObject } from '../core/public-types.js';
import type {
    ExportArea,
    FabricModule,
    ImageExportOptions,
    LoadImageOptions,
    AnnotationObject,
    MaskObject,
    NormalizedImageFormat,
    ResolvedOptions,
} from '../core/public-types.js';
import { reportWarning } from '../core/callback-reporter.js';
import { ExportError, ExportNotReadyError } from '../core/errors.js';
import type { HistoryManager } from '../history/history-manager.js';
import { withMaskStyleBackup } from '../mask/mask-style.js';
import {
    getClampedCanvasRegion,
    getObjectBBox,
    getPartialExportEdges,
    hasMeaningfulCanvasRegion,
    type IntegerRegion,
    type PartialExportEdges,
} from '../utils/canvas-region.js';
import { startImageElementLoad } from '../utils/image-element-loader.js';
import { resolveExportFormat, type ResolvedExportFormat } from './export-format.js';
import {
    flattenOverlayGroupToBaseImage,
    type OverlayMergeTransactionContext,
} from './overlay-merge-service.js';

const DOWNLOAD_OBJECT_URL_REVOKE_DELAY_MS = 30000;

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
    mergeMasks: boolean;
    mergeAnnotations: boolean;
    multiplier: number;
    format: ResolvedExportFormat;
}

type VisibilityBackup = {
    readonly object: FabricNS.FabricObject;
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

    /**
     * Run export-only selection teardown/restoration without emitting public
     * selection lifecycle callbacks.
     */
    withSelectionChangeSuppressed?<T>(callback: () => Promise<T>): Promise<T>;
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
    options?: ImageExportOptions | null,
): ResolvedExportOptions {
    const providedOptions = options ?? {};
    return {
        exportArea: resolveExportArea(
            providedOptions.exportArea,
            context.options.exportAreaByDefault,
        ),
        mergeMasks:
            typeof providedOptions.mergeMasks === 'boolean'
                ? providedOptions.mergeMasks
                : context.options.mergeMasksByDefault,
        mergeAnnotations:
            typeof providedOptions.mergeAnnotations === 'boolean'
                ? providedOptions.mergeAnnotations
                : context.options.mergeAnnotationsByDefault,
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
    const maxDimension = context.options.maxExportDimension;

    if (!Number.isFinite(pixelCount) || pixelCount > maxPixels) {
        throw new RangeError(
            `[ImageEditor] Export size ${outputWidth}x${outputHeight} ` +
                `(${pixelCount} pixels) exceeds maxExportPixels (${maxPixels}).`,
        );
    }
    if (outputWidth > maxDimension || outputHeight > maxDimension) {
        throw new RangeError(
            `[ImageEditor] Export size ${outputWidth}x${outputHeight} ` +
                `exceeds maxExportDimension (${maxDimension}).`,
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
 * Bake-in is applied when `mergeMasks === true`, matching the merge path's
 * mask merge path where the rendered raster needs solid black masks so
 * the masked-out regions are flattened into the JPEG/PNG output. When
 * When `mergeMasks === false`, masks are hidden for the render and restored.
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
 * @param mergeMasks - Resolved mask compositing flag. `true` triggers
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
    mergeMasks: boolean,
    callback: () => Promise<T>,
): Promise<T> {
    if (!mergeMasks) {
        return withObjectsHidden(context.canvas, isMaskObject, callback);
    }
    return withMaskStyleBackup(
        { canvas: context.canvas, options: context.options },
        applyExportBakeInStyle,
        callback,
    );
}

async function withObjectsHidden<T>(
    canvas: FabricNS.Canvas,
    predicate: (object: FabricNS.FabricObject) => boolean,
    callback: () => Promise<T>,
): Promise<T> {
    const backups: VisibilityBackup[] = getCanvasObjects(canvas)
        .filter(predicate)
        .map((object) => ({
            object,
            visible: (object as { visible?: unknown }).visible ?? true,
        }));

    for (const backup of backups) {
        try {
            if (typeof backup.object.set === 'function') {
                backup.object.set({ visible: false });
            } else {
                (backup.object as { visible?: unknown }).visible = false;
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
                if (typeof backup.object.set === 'function') {
                    backup.object.set({ visible: backup.visible });
                } else {
                    (backup.object as { visible?: unknown }).visible = backup.visible;
                }
            } catch {
                /* ignore — do not mask the export result */
            }
        }
        requestRender(canvas);
    }
}

async function withSessionObjectsHidden<T>(
    context: ExportServiceContext,
    callback: () => Promise<T>,
): Promise<T> {
    return withObjectsHidden(
        context.canvas,
        (object) =>
            isSessionObject(object) ||
            (object as { isCropRect?: unknown }).isCropRect === true ||
            (object as { maskLabel?: unknown }).maskLabel === true ||
            (object as { isMosaicPreview?: unknown }).isMosaicPreview === true,
        callback,
    );
}

async function withAnnotationsExportState<T>(
    context: ExportServiceContext,
    mergeAnnotations: boolean,
    callback: () => Promise<T>,
): Promise<T> {
    if (!mergeAnnotations) {
        return withObjectsHidden(context.canvas, isAnnotationObject, callback);
    }
    return withObjectsHidden(
        context.canvas,
        (object) => isAnnotationObject(object) && object.annotationHidden === true,
        callback,
    );
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
            visible: (label as { visible?: unknown }).visible ?? true,
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
    if (!canvas.getObjects().includes(activeObject)) return;
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
 * mask to the export bake-in style. Matches the mask merge path
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
    return startImageElementLoad(dataUrl, {
        crossOrigin: 'anonymous',
        createError: () => new Error('Failed to decode export data URL'),
    }).promise;
}

function sealPartialTransparentEdges(
    canvasContext: CanvasRenderingContext2D,
    width: number,
    height: number,
    edges: PartialExportEdges | null,
): void {
    if (!hasPartialEdges(edges)) return;

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
    if (edges?.left && edges?.top && width > 1 && height > 1) {
        sealPixel(0, 0, 1, 1);
    }
    if (edges?.right && edges?.top && width > 1 && height > 1) {
        sealPixel(width - 1, 0, width - 2, 1);
    }
    if (edges?.left && edges?.bottom && width > 1 && height > 1) {
        sealPixel(0, height - 1, 1, height - 2);
    }
    if (edges?.right && edges?.bottom && width > 1 && height > 1) {
        sealPixel(width - 1, height - 1, width - 2, height - 2);
    }

    canvasContext.putImageData(imageData, 0, 0);
}

function getJpegBackgroundColor(backgroundColor: unknown, ownerDocument: Document): string {
    return resolveCanvasFillStyle(backgroundColor, ownerDocument);
}

const colorValidationContexts = new WeakMap<Document, CanvasRenderingContext2D | null>();

function resolveCanvasFillStyle(
    backgroundColor: unknown,
    ownerDocument: Document,
    fallback = '#ffffff',
): string {
    const value = String(backgroundColor ?? '').trim();
    if (!value || isTransparentCssColor(value)) return '#ffffff';
    const css = ownerDocument.defaultView?.CSS ?? globalThis.CSS;
    const supportsColor = typeof css?.supports === 'function' ? css.supports('color', value) : null;
    if (supportsColor === false) return fallback;

    const context = createColorValidationContext(ownerDocument);
    if (!context) return supportsColor === true ? value : fallback;

    if (supportsColor === true) {
        context.fillStyle = value;
        return context.fillStyle;
    }

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

function createColorValidationContext(ownerDocument: Document): CanvasRenderingContext2D | null {
    if (colorValidationContexts.has(ownerDocument)) {
        return colorValidationContexts.get(ownerDocument) ?? null;
    }
    try {
        const context = ownerDocument.createElement('canvas').getContext('2d');
        colorValidationContexts.set(ownerDocument, context);
        return context;
    } catch {
        colorValidationContexts.set(ownerDocument, null);
        return null;
    }
}

function detectDataUrlMimeType(dataUrl: string): string | null {
    const match = /^data:([^;,]+)(?:[;,])/i.exec(dataUrl);
    return match?.[1]?.toLowerCase() ?? null;
}

function assertDataUrlMimeType(
    dataUrl: string,
    target: ResolvedExportFormat,
    operation: string,
): void {
    const actualMimeType = detectDataUrlMimeType(dataUrl);
    if (actualMimeType !== target.mimeType) {
        throw new ExportError(
            `${operation} failed: browser encoded ${actualMimeType ?? 'unknown MIME'} instead of requested ${target.mimeType}.`,
        );
    }
}

function encodeCanvasAsDataUrl(
    canvas: HTMLCanvasElement,
    target: ResolvedExportFormat,
    operation: string,
): string {
    const encoded =
        target.quality === undefined
            ? canvas.toDataURL(target.mimeType)
            : canvas.toDataURL(target.mimeType, target.quality);
    assertDataUrlMimeType(encoded, target, operation);
    return encoded;
}

function getCanvasDocument(canvas: FabricNS.Canvas): Document {
    const canvasLike = canvas as FabricNS.Canvas & {
        getElement?: () => HTMLCanvasElement | undefined;
        lowerCanvasEl?: HTMLCanvasElement;
    };
    const ownerDocument =
        canvasLike.getElement?.()?.ownerDocument ?? canvasLike.lowerCanvasEl?.ownerDocument;
    if (ownerDocument) return ownerDocument;
    if (typeof document !== 'undefined') return document;
    throw new Error('Document is unavailable for export canvas creation.');
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

    const commaAlpha = normalized.match(/^(?:rgba|hsla)\(([^)]{0,200}),\s*([^,/)]{0,50})\)$/i);
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

async function postProcessRegionDataUrl(
    dataUrl: string,
    edges: PartialExportEdges | null,
    target: ResolvedExportFormat,
    backgroundColor: unknown,
    ownerDocument: Document,
): Promise<string> {
    const shouldSealEdges = hasPartialEdges(edges);
    const shouldCompositeJpegBackground = target.format === 'jpeg';
    if (!shouldSealEdges && !shouldCompositeJpegBackground) return dataUrl;

    const imageElement = await loadImageElement(dataUrl);
    const { width, height } = getImageDimensions(imageElement);
    const offscreenCanvas = ownerDocument.createElement('canvas');
    offscreenCanvas.width = width;
    offscreenCanvas.height = height;
    const canvasContext = offscreenCanvas.getContext('2d');
    if (!canvasContext) throw new Error('2D canvas context is unavailable');
    canvasContext.drawImage(imageElement, 0, 0, width, height);

    if (shouldSealEdges) {
        sealPartialTransparentEdges(canvasContext, width, height, edges);
    }

    if (shouldCompositeJpegBackground) {
        canvasContext.globalCompositeOperation = 'destination-over';
        canvasContext.fillStyle = getJpegBackgroundColor(backgroundColor, ownerDocument);
        canvasContext.fillRect(0, 0, width, height);
        canvasContext.globalCompositeOperation = 'source-over';
    }

    return encodeCanvasAsDataUrl(offscreenCanvas, target, 'exportImageBase64');
}

/**
 * Convert a `data:image/...;base64...` URL into the byte array that
 * `new File([...]...)` consumes without allocating intermediate
 * `Array.from` storage.
 *
 * The payload must be strict base64; embedded whitespace is rejected
 * before the decoder runs.
 *
 * @throws DOMException if the data URL is malformed and `atob` rejects.
 */
function dataUrlToBytes(dataUrl: string): Uint8Array<ArrayBuffer> {
    const match = /^data:image\/[a-z0-9.+-]+;base64,([A-Za-z0-9+/=]+)$/i.exec(dataUrl);
    const base64 = match?.[1] ?? '';
    if (!base64) {
        throw new Error('exportImageFile received a malformed or empty image data URL.');
    }
    if (typeof globalThis.atob === 'function') {
        const binary = globalThis.atob(base64);
        const bytes = new Uint8Array(binary.length) as Uint8Array<ArrayBuffer>;
        for (let index = 0; index < binary.length; index += 1) {
            bytes[index] = binary.charCodeAt(index);
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
 * resulting URL carries the requested MIME type. The browser may quietly
 * fall back to PNG when the requested format is unsupported, so every
 * offscreen encode is checked and rejected when the MIME prefix differs.
 *
 * The conversion only runs when the source URL's MIME prefix does not
 * match the requested format; the matching-prefix fast path returns the
 * URL unchanged and skips the extra decode entirely.
 */
async function reencodeDataUrlAs(
    sourceDataUrl: string,
    target: ResolvedExportFormat,
    backgroundColor: unknown,
    canvas: FabricNS.Canvas,
): Promise<string> {
    if (detectDataUrlMimeType(sourceDataUrl) === target.mimeType) {
        return sourceDataUrl;
    }

    const imageElement = await loadImageElement(sourceDataUrl);
    const { width, height } = getImageDimensions(imageElement);
    const ownerDocument = getCanvasDocument(canvas);

    const offscreenCanvas = ownerDocument.createElement('canvas');
    offscreenCanvas.width = width;
    offscreenCanvas.height = height;

    const canvasContext = offscreenCanvas.getContext('2d');
    if (!canvasContext) {
        throw new Error('Unable to acquire 2D context for export conversion');
    }

    if (target.format === 'jpeg') {
        canvasContext.fillStyle = getJpegBackgroundColor(backgroundColor, ownerDocument);
        canvasContext.fillRect(0, 0, width, height);
    }

    canvasContext.drawImage(imageElement, 0, 0, width, height);

    return encodeCanvasAsDataUrl(offscreenCanvas, target, 'exportImageFile');
}

/** Single source of truth for the "no image" warning text. */
function warnNoImageLoaded(options: ResolvedOptions, operation: string): void {
    reportWarning(options, null, `${operation} skipped: no image is loaded on the canvas.`);
}

function extensionForFormat(format: NormalizedImageFormat): string {
    return format === 'jpeg' ? 'jpg' : format;
}

const MAX_EXPORT_FILE_BASENAME_LENGTH = 120;

function replaceUnsafeFileNameCharacters(value: string): string {
    let output = '';
    let lastWasReplacement = false;

    for (const char of value) {
        const code = char.charCodeAt(0);
        const unsafe = code <= 31 || code === 127 || '<>:"|?*'.includes(char);
        if (unsafe) {
            if (!lastWasReplacement) output += '_';
            lastWasReplacement = true;
            continue;
        }

        output += char;
        lastWasReplacement = false;
    }

    return output;
}

function sanitizeFileNameBase(value: string): string {
    const withoutPathSeparators = value.replace(/[\\/]+/g, '_');
    const sanitized = replaceUnsafeFileNameCharacters(withoutPathSeparators)
        .replace(/\.\.+/g, '.')
        .replace(/^\.+|\.+$/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, MAX_EXPORT_FILE_BASENAME_LENGTH)
        .trim();
    return sanitized || 'edited_image';
}

function resolveFileName(baseName: string, format: ResolvedExportFormat): string {
    const fallback = 'edited_image';
    const trimmed = String(baseName || fallback).trim() || fallback;
    const ext = extensionForFormat(format.format);
    const baseWithoutExtension = trimmed.replace(/\.(jpe?g|png|webp)$/i, '');
    const safeBase = sanitizeFileNameBase(baseWithoutExtension);

    return `${safeBase}.${ext}`;
}

async function renderExportDataUrl(
    context: ExportServiceContext,
    resolved: ResolvedExportOptions,
    validateMimeType = true,
): Promise<string> {
    const render = async (): Promise<string> => {
        const activeObject = captureActiveObject(context.canvas);
        const labelBackups = captureMaskLabelBackups(context.canvas);

        try {
            // Drop any active selection BEFORE region math. It is restored in
            // the finally block so export does not perturb the editor UI.
            context.canvas.discardActiveObject();

            const { region, partialEdges } = computeExportRegion(context, resolved.exportArea);
            assertExportPixelBudget(context, resolved.multiplier, region);

            const renderFormat =
                region && resolved.format.format === 'jpeg' ? 'png' : resolved.format.format;
            const renderQuality = renderFormat === 'png' ? undefined : resolved.format.quality;

            let dataUrl = await withSessionObjectsHidden(context, async () =>
                withMaskExportState(context, resolved.mergeMasks, async () =>
                    withAnnotationsExportState(context, resolved.mergeAnnotations, async () =>
                        renderCanvasToDataUrl(
                            context.canvas,
                            renderFormat,
                            renderQuality,
                            resolved.multiplier,
                            region,
                        ),
                    ),
                ),
            );

            if (region && (hasPartialEdges(partialEdges) || resolved.format.format === 'jpeg')) {
                dataUrl = await postProcessRegionDataUrl(
                    dataUrl,
                    partialEdges,
                    resolved.format,
                    context.options.backgroundColor,
                    getCanvasDocument(context.canvas),
                );
            }

            if (validateMimeType) {
                assertDataUrlMimeType(dataUrl, resolved.format, 'exportImageBase64');
            }
            return dataUrl;
        } finally {
            restoreMaskLabelBackups(context.canvas, labelBackups);
            restoreActiveObject(context.canvas, activeObject);
            requestRender(context.canvas);
        }
    };

    return context.withSelectionChangeSuppressed
        ? context.withSelectionChangeSuppressed(render)
        : render();
}

// ─── exportImageBase64 ───────────────────────────────────────────────────────

/**
 * Render the live canvas to a base64 data URL.
 *
 * Steps, in order:
 *
 * 1. **No-image gate** — when `context.isImageLoaded`
 *    is `false`, report an `onWarning` and throw `ExportNotReadyError`
 *    without touching the canvas.
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
 *    `mergeMasks === true` exports, and the live styles are
 *    restored in a `finally` block whether the render resolved or
 *    threw. The inner step is a single
 *    `canvas.toDataURL` call — no intermediate `<canvas>`.
 *
 * @param context - Export context bundle.
 * @param options - Optional {@link ImageExportOptions}. Both `fileType`
 *                 and `format` are accepted; when
 *                 both are supplied, `fileType` wins.
 * @returns        Resolves to a `data:image/...;base64...` URL on
 *                 success.
 *
 */
export async function exportImageBase64(
    context: ExportServiceContext,
    options?: ImageExportOptions,
): Promise<string> {
    if (!context.isImageLoaded()) {
        warnNoImageLoaded(context.options, 'exportImageBase64');
        throw new ExportNotReadyError('exportImageBase64');
    }

    const resolved = resolveExportOptions(context, options);
    return renderExportDataUrl(context, resolved);
}

// ─── exportImageFile ─────────────────────────────────────────────────────────

/**
 * Render the live canvas to a `File`.
 *
 * The bytes come from the same private rendering core used by
 * {@link exportImageBase64}. The resulting data URL is repainted
 * through an offscreen `<canvas>` only
 * when its MIME prefix does not match the requested type — some browsers
 * silently fall back to PNG when the requested format is unsupported,
 * and the export contract requires the output MIME to match the resolved
 * `fileType`.
 *
 * @param context - Export context bundle.
 * @param options - Optional {@link ImageExportOptions}.
 * @returns        Resolves with the rendered `File`.
 * @throws         {@link ExportNotReadyError} when no image is loaded.
 *
 */
export async function exportImageFile(
    context: ExportServiceContext,
    options?: ImageExportOptions,
): Promise<File> {
    if (!context.isImageLoaded()) {
        warnNoImageLoaded(context.options, 'exportImageFile');
        throw new ExportNotReadyError('exportImageFile');
    }

    const providedOptions = options ?? {};
    const resolved = resolveExportOptions(context, providedOptions);
    const rawDataUrl = await renderExportDataUrl(context, resolved, false);

    const finalDataUrl = await reencodeDataUrlAs(
        rawDataUrl,
        resolved.format,
        context.options.backgroundColor,
        context.canvas,
    );
    let bytes: Uint8Array<ArrayBuffer>;
    try {
        bytes = dataUrlToBytes(finalDataUrl);
    } catch (error) {
        throw new ExportError('exportImageFile failed to decode rendered data URL.', error);
    }
    const fileName = resolveFileName(
        providedOptions.fileName ?? context.options.defaultDownloadFileName,
        resolved.format,
    );

    return new File([bytes], fileName, { type: resolved.format.mimeType });
}

// ─── downloadImage ───────────────────────────────────────────────────────────

/**
 * Trigger a browser download of the live canvas.
 *
 * Mirrors legacy's "anchor with `download` attribute" approach: a `File`
 * is rendered, an object URL is created, and an `<a>` element is appended
 * to the document so Firefox dispatches the click.
 *
 * No-image gate emits the same `onWarning` as the
 * other entry points and returns without touching the DOM.
 *
 * Errors raised by the underlying export reject the returned promise so the
 * caller can report or recover at the UI boundary.
 *
 * @param context - Export context bundle.
 * @param options - Optional {@link ImageExportOptions}.
 *
 */
export async function downloadImage(
    context: ExportServiceContext,
    options?: ImageExportOptions,
): Promise<void> {
    if (!context.isImageLoaded()) {
        warnNoImageLoaded(context.options, 'downloadImage');
        return;
    }

    if (options !== undefined && options !== null && typeof options !== 'object') {
        throw new TypeError(
            '[ImageEditor] downloadImage(options) expects an ImageExportOptions object.',
        );
    }

    const file = await exportImageFile(context, options);
    triggerFileDownload(context, file);
}

function triggerFileDownload(context: ExportServiceContext, file: File): void {
    const ownerDocument = getCanvasDocument(context.canvas);
    const objectUrl = URL.createObjectURL(file);
    const link = ownerDocument.createElement('a');

    link.download = file.name;
    link.href = objectUrl;

    const body = ownerDocument.body ?? ownerDocument.documentElement;
    if (!body) throw new Error('Document body is unavailable for download trigger.');
    body.appendChild(link);

    try {
        link.click();
    } finally {
        body.removeChild(link);
        scheduleObjectUrlRevoke(objectUrl);
    }
}

function scheduleObjectUrlRevoke(objectUrl: string): void {
    if (typeof globalThis.setTimeout === 'function') {
        const timeoutId = globalThis.setTimeout(() => {
            safeRevokeObjectUrl(objectUrl);
        }, DOWNLOAD_OBJECT_URL_REVOKE_DELAY_MS);
        (timeoutId as { unref?: () => void }).unref?.();
        return;
    }

    void Promise.resolve().then(() => {
        safeRevokeObjectUrl(objectUrl);
    });
}

function safeRevokeObjectUrl(objectUrl: string): void {
    try {
        if (typeof URL.revokeObjectURL === 'function') {
            URL.revokeObjectURL(objectUrl);
        }
    } catch {
        /* Download cleanup must not mask the already-triggered download. */
    }
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
export interface MergeMasksContext extends ExportServiceContext, OverlayMergeTransactionContext {
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
    getAnnotations(): AnnotationObject[];
    restoreAnnotations(objects: AnnotationObject[]): void | Promise<void>;
}

export interface MergeAnnotationsContext
    extends ExportServiceContext, OverlayMergeTransactionContext {
    readonly historyManager: HistoryManager;
    readonly containerElement: HTMLElement | null;
    loadImage(imageBase64: string, options?: LoadImageOptions): Promise<void>;
    captureSnapshot(): string;
    loadFromState(snapshot: string): Promise<void>;
    removeAllAnnotationsNoHistory(): void;
    getMasks(): MaskObject[];
    restoreMasks(objects: MaskObject[]): void | Promise<void>;
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
 * cause. A failure inside the rollback itself is reported via
 * `onWarning` but does not mask the original error.
 *
 * @param context - Editor dependency bundle — see {@link MergeMasksContext}.
 * @returns   Resolves on success; rejects with
 *            {@link MergeMasksError} on any pipeline failure (after
 *            the pre-merge snapshot has been restored).
 *
 */
export async function mergeMasks(context: MergeMasksContext): Promise<void> {
    await flattenOverlayGroupToBaseImage(context, {
        operation: 'mergeMasks',
        exportOptions: {
            exportArea: 'image',
            mergeMasks: true,
            mergeAnnotations: false,
            multiplier: context.options.exportMultiplier,
            fileType: 'png',
        },
        getTargets: () => context.canvas.getObjects().filter(isMaskObject),
        getPreservedObjects: () => context.getAnnotations(),
        removeTargetsNoHistory: () => {
            context.removeAllMasksNoHistory();
        },
        restorePreservedObjects: (objects) => context.restoreAnnotations(objects),
    });
}

export async function mergeAnnotations(context: MergeAnnotationsContext): Promise<void> {
    await flattenOverlayGroupToBaseImage(context, {
        operation: 'mergeAnnotations',
        exportOptions: {
            exportArea: 'image',
            mergeMasks: false,
            mergeAnnotations: true,
            multiplier: context.options.exportMultiplier,
            fileType: 'png',
        },
        getTargets: () => context.canvas.getObjects().filter(isAnnotationObject),
        getPreservedObjects: () => context.getMasks(),
        removeTargetsNoHistory: () => {
            context.removeAllAnnotationsNoHistory();
        },
        restorePreservedObjects: (objects) => context.restoreMasks(objects),
    });
}
