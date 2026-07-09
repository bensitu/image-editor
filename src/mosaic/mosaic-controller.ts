/**
 * Mosaic mode controller.
 *
 * Owns the Mosaic session lifecycle, preview objects, Fabric pointer handlers,
 * and the base-image pixel replacement pipeline. The editor runtime owns
 * canonical editor state and passes it in through the context callbacks.
 *
 * @module
 */

import type * as FabricNS from 'fabric';

import { reportError, reportWarning } from '../core/callback-reporter.js';
import { markBaseImageObject, markSessionObject } from '../core/editor-object-kind.js';
import type {
    BaseImageObject,
    FabricModule,
    ImageEditorCallbackContext,
    ImageEditorOperation,
    ImageMimeType,
    ResolvedMosaicConfig,
    ResolvedOptions,
    ResolvedImageFilterConfig,
} from '../core/public-types.js';
import { mimeTypeFor, tryNormalizeImageFormat } from '../export/export-format.js';
import { Command, type HistoryManager } from '../history/history-manager.js';
import { getFilteredBaseImageDataUrl } from '../image/image-filters.js';
import { detectSourceMimeType } from '../image/image-resampler.js';
import { getPointerFromFabricEvent } from '../utils/pointer.js';
import { withTimeout } from '../utils/timeout.js';
import { getMosaicImagePoint, type MosaicImagePoint } from './mosaic-geometry.js';
import { applyCircularMosaicToImageData } from './mosaic-pixelate.js';

interface MosaicPreviewCircle extends FabricNS.Circle {
    isMosaicPreview?: boolean;
}

interface MosaicPreviewImage extends FabricNS.FabricImage {
    isMosaicPreview?: boolean;
}

export interface MosaicSession {
    previewCircle: MosaicPreviewCircle | null;
    previewImage: MosaicPreviewImage | null;
    prevSelection: boolean;
    prevDefaultCursor: string | undefined;
    prevObjectStates: Array<{
        object: FabricNS.FabricObject;
        evented: boolean;
        selectable: boolean;
    }>;
    handlers: Array<{
        eventName: string;
        callback: (event: unknown) => void;
    }>;
    rasterCache: MosaicRasterCache | null;
    pendingCanvasPoints: Array<{ x: number; y: number }>;
    isPointerDown: boolean;
    isApplying: boolean;
    commitRequested: boolean;
    hasUncommittedChanges: boolean;
    lastImagePoint: MosaicImagePoint | null;
}

export interface MosaicControllerContext {
    readonly fabric: FabricModule;
    readonly canvas: FabricNS.Canvas;
    readonly options: ResolvedOptions;
    readonly historyManager: HistoryManager;

    getMosaicConfig(): ResolvedMosaicConfig;
    isImageLoaded(): boolean;
    getOriginalImage(): BaseImageObject | null;
    setOriginalImage(image: BaseImageObject | null): void;
    getCurrentImageMimeType(): ImageMimeType | null;
    setCurrentImageMimeType(mimeType: ImageMimeType | null): void;
    getCurrentImageFilterConfig(): ResolvedImageFilterConfig;
    resetImageFilterState(): void;
    getLastSnapshot(): string | null;
    setLastSnapshot(snapshot: string | null): void;
    captureSnapshot(): string;
    loadFromState(snapshot: string): Promise<void>;
    updateUi(): void;
    updateInputs(): void;
    hideAllMaskLabels(): void;
    emitImageChanged(context: ImageEditorCallbackContext): void;
    emitBusyChangeIfChanged(context: ImageEditorCallbackContext): void;
    buildCallbackContext(
        operation: ImageEditorOperation,
        isInternal?: boolean,
    ): ImageEditorCallbackContext;
    getMosaicSession(): MosaicSession | null;
    setMosaicSession(session: MosaicSession | null): void;
}

interface DecodedImage {
    element: CanvasImageSource;
    width: number;
    height: number;
}

interface MosaicRasterCache {
    offscreenCanvas: HTMLCanvasElement;
    renderingContext: CanvasRenderingContext2D;
    imageData: ImageData;
    source: string;
    width: number;
    height: number;
}

interface MosaicOutputFormat {
    mimeType: ImageMimeType;
    quality?: number;
}

interface MosaicDirtyRect {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
}

const MAX_PENDING_MOSAIC_POINTS = 4096;

function getCanvasDocument(context: MosaicControllerContext): Document {
    const element = (
        context.canvas as unknown as {
            getElement?: () => HTMLCanvasElement | undefined;
            lowerCanvasEl?: HTMLCanvasElement;
        }
    ).getElement?.();
    return (
        element?.ownerDocument ??
        (context.canvas as unknown as { lowerCanvasEl?: HTMLCanvasElement }).lowerCanvasEl
            ?.ownerDocument ??
        document
    );
}

function safeRender(canvas: FabricNS.Canvas): void {
    try {
        canvas.requestRenderAll();
    } catch {
        try {
            canvas.renderAll();
        } catch {
            /* ignore */
        }
    }
}

function createPreviewCircle(context: MosaicControllerContext): MosaicPreviewCircle {
    const config = context.getMosaicConfig();
    const circle = new context.fabric.Circle({
        left: 0,
        top: 0,
        radius: config.brushSize / 2,
        originX: 'center',
        originY: 'center',
        fill: config.previewFill,
        stroke: config.previewStroke,
        strokeWidth: config.previewStrokeWidth,
        strokeDashArray: config.previewStrokeDashArray
            ? [...config.previewStrokeDashArray]
            : undefined,
        selectable: false,
        evented: false,
        excludeFromExport: true,
        objectCaching: false,
        visible: false,
    } as Partial<FabricNS.CircleProps>) as MosaicPreviewCircle;
    markSessionObject(circle, 'mosaicPreviewCircle');
    circle.isMosaicPreview = true;
    return circle;
}

function ensurePreviewCircle(
    context: MosaicControllerContext,
    session: MosaicSession,
): MosaicPreviewCircle {
    const { canvas } = context;
    const circle = session.previewCircle ?? createPreviewCircle(context);
    session.previewCircle = circle;
    if (!canvas.getObjects().includes(circle)) {
        canvas.add(circle);
    }
    canvas.bringObjectToFront(circle);
    updateMosaicPreview(context);
    return circle;
}

function removePreviewCircle(context: MosaicControllerContext, session: MosaicSession): void {
    const circle = session.previewCircle;
    if (!circle) return;
    try {
        context.canvas.remove(circle);
    } catch {
        /* ignore */
    }
    session.previewCircle = null;
}

function createPreviewImage(
    context: MosaicControllerContext,
    sourceImage: FabricNS.FabricImage,
    rasterCache: MosaicRasterCache,
): MosaicPreviewImage {
    const image = new context.fabric.FabricImage(rasterCache.offscreenCanvas, {
        selectable: false,
        evented: false,
        excludeFromExport: true,
        objectCaching: false,
        visible: true,
    } as Partial<FabricNS.ImageProps>) as MosaicPreviewImage;
    copyBaseImageProperties(image, sourceImage);
    image.set({
        selectable: false,
        evented: false,
        excludeFromExport: true,
        objectCaching: false,
        visible: true,
    } as Partial<FabricNS.ImageProps>);
    markSessionObject(image, 'mosaicPreviewImage');
    image.isMosaicPreview = true;
    return image;
}

function placePreviewImageAfterBase(
    context: MosaicControllerContext,
    previewImage: MosaicPreviewImage,
    sourceImage: FabricNS.FabricImage,
): void {
    const sourceIndex = context.canvas.getObjects().indexOf(sourceImage);
    if (sourceIndex < 0) return;
    try {
        (
            context.canvas as FabricNS.Canvas & {
                moveObjectTo?: (object: FabricNS.FabricObject, index: number) => boolean;
            }
        ).moveObjectTo?.(previewImage, sourceIndex + 1);
    } catch {
        /* best-effort layer ordering */
    }
}

function ensurePreviewImage(
    context: MosaicControllerContext,
    session: MosaicSession,
    sourceImage: FabricNS.FabricImage,
): MosaicPreviewImage | null {
    const rasterCache = session.rasterCache;
    if (!rasterCache) return null;

    const previewImage =
        session.previewImage ?? createPreviewImage(context, sourceImage, rasterCache);
    session.previewImage = previewImage;
    copyBaseImageProperties(previewImage, sourceImage);
    previewImage.set({
        selectable: false,
        evented: false,
        excludeFromExport: true,
        objectCaching: false,
        visible: true,
    } as Partial<FabricNS.ImageProps>);
    (previewImage as MosaicPreviewImage & { dirty?: boolean }).dirty = true;

    if (!context.canvas.getObjects().includes(previewImage)) {
        context.canvas.add(previewImage);
    }
    placePreviewImageAfterBase(context, previewImage, sourceImage);
    const circle = session.previewCircle;
    if (circle && context.canvas.getObjects().includes(circle)) {
        context.canvas.bringObjectToFront(circle);
    }
    return previewImage;
}

function removePreviewImage(context: MosaicControllerContext, session: MosaicSession): void {
    const image = session.previewImage;
    if (!image) return;
    try {
        context.canvas.remove(image);
    } catch {
        /* ignore */
    }
    session.previewImage = null;
}

function releaseMosaicRasterCache(session: MosaicSession): void {
    const cache = session.rasterCache;
    if (!cache) return;

    try {
        cache.offscreenCanvas.width = 0;
        cache.offscreenCanvas.height = 0;
    } catch {
        /* ignore */
    }

    session.rasterCache = null;
}

async function refreshMosaicRasterCacheFromSource(
    context: MosaicControllerContext,
    session: MosaicSession,
    source: string,
): Promise<void> {
    const rasterCache = session.rasterCache;
    if (!rasterCache) return;

    const ownerDocument = getCanvasDocument(context);
    const decoded = await decodeImageSource(ownerDocument, source);
    rasterCache.offscreenCanvas.width = decoded.width;
    rasterCache.offscreenCanvas.height = decoded.height;
    const renderingContext = rasterCache.offscreenCanvas.getContext('2d');
    if (!renderingContext) {
        releaseMosaicRasterCache(session);
        return;
    }

    renderingContext.clearRect(0, 0, decoded.width, decoded.height);
    renderingContext.drawImage(decoded.element, 0, 0, decoded.width, decoded.height);
    rasterCache.renderingContext = renderingContext;
    rasterCache.imageData = renderingContext.getImageData(0, 0, decoded.width, decoded.height);
    rasterCache.source = source;
    rasterCache.width = decoded.width;
    rasterCache.height = decoded.height;
}

function hidePreview(context: MosaicControllerContext): void {
    const circle = context.getMosaicSession()?.previewCircle;
    if (!circle) return;
    circle.set({ visible: false });
    safeRender(context.canvas);
}

function movePreview(context: MosaicControllerContext, point: { x: number; y: number }): void {
    const session = context.getMosaicSession();
    if (!session) return;
    const circle = ensurePreviewCircle(context, session);
    circle.set({ left: point.x, top: point.y, visible: true });
    safeRender(context.canvas);
}

function attachCanvasHandler(
    context: MosaicControllerContext,
    session: MosaicSession,
    eventName: string,
    callback: (event: unknown) => void,
): void {
    (
        context.canvas as unknown as { on(event: string, handler: (event: unknown) => void): void }
    ).on(eventName, callback);
    session.handlers.push({ eventName, callback });
}

function detachCanvasHandlers(context: MosaicControllerContext, session: MosaicSession): void {
    for (const record of session.handlers) {
        try {
            (
                context.canvas as unknown as {
                    off(event: string, handler: (event: unknown) => void): void;
                }
            ).off(record.eventName, record.callback);
        } catch {
            /* ignore */
        }
    }
    session.handlers = [];
}

function restoreObjectStates(session: MosaicSession): void {
    for (const record of session.prevObjectStates) {
        try {
            record.object.set({ evented: record.evented, selectable: record.selectable });
        } catch {
            /* ignore */
        }
    }
    session.prevObjectStates = [];
}

function getImageSource(image: FabricNS.FabricImage): string | null {
    const imageWithSource = image as FabricNS.FabricImage & {
        getSrc?: () => string;
        src?: string;
    };
    try {
        const src = imageWithSource.getSrc?.();
        if (typeof src === 'string' && src.length > 0) return src;
    } catch {
        /* fall through */
    }
    return typeof imageWithSource.src === 'string' && imageWithSource.src.length > 0
        ? imageWithSource.src
        : null;
}

function getMosaicImageSource(
    context: MosaicControllerContext,
    image: FabricNS.FabricImage,
): string | null {
    return getFilteredBaseImageDataUrl(
        image,
        context.getCurrentImageFilterConfig(),
        getImageSource(image),
    );
}

function imageDimension(value: unknown): number {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : 0;
}

function decodeImageSource(ownerDocument: Document, source: string): Promise<DecodedImage> {
    return new Promise((resolve, reject) => {
        const imageElement = ownerDocument.createElement('img') as HTMLImageElement & {
            width?: number;
            height?: number;
        };
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
            const width = imageDimension(imageElement.naturalWidth || imageElement.width);
            const height = imageDimension(imageElement.naturalHeight || imageElement.height);
            cleanup();
            if (width <= 0 || height <= 0) {
                reject(new Error('Mosaic image decode failed: source image has no dimensions.'));
                return;
            }
            resolve({ element: imageElement, width, height });
        };
        const handleError = (event: Event | string): void => {
            cleanup();
            const message =
                typeof event === 'string'
                    ? `Mosaic image decode failed: ${event}`
                    : 'Mosaic image decode failed.';
            reject(new Error(message));
        };

        if (!source.startsWith('data:')) {
            imageElement.crossOrigin = 'anonymous';
        }

        if (typeof imageElement.addEventListener === 'function') {
            imageElement.addEventListener('load', handleLoad, { once: true });
            imageElement.addEventListener('error', handleError, { once: true });
        } else {
            imageElement.onload = handleLoad;
            imageElement.onerror = handleError;
        }
        imageElement.src = source;
    });
}

function toSupportedMimeType(mimeType: string | null): ImageMimeType | null {
    return mimeType === 'image/jpeg' || mimeType === 'image/png' || mimeType === 'image/webp'
        ? mimeType
        : null;
}

function mimeToFormat(mimeType: ImageMimeType): 'jpeg' | 'png' | 'webp' {
    if (mimeType === 'image/jpeg') return 'jpeg';
    if (mimeType === 'image/webp') return 'webp';
    return 'png';
}

function resolveMosaicOutputFormat(
    context: MosaicControllerContext,
    source: string,
): MosaicOutputFormat {
    const config = context.getMosaicConfig();
    const requested = config.outputFileType;
    const format =
        requested === 'source'
            ? mimeToFormat(
                  context.getCurrentImageMimeType() ??
                      toSupportedMimeType(detectSourceMimeType(source)) ??
                      'image/png',
              )
            : (tryNormalizeImageFormat(String(requested)) ?? 'png');
    const mimeType = mimeTypeFor(format);

    if (format === 'png') return { mimeType };
    return {
        mimeType,
        quality: config.outputQuality ?? context.options.downsampleQuality,
    };
}

async function createFabricImageFromDataUrl(
    context: MosaicControllerContext,
    dataUrl: string,
): Promise<FabricNS.FabricImage> {
    return await withTimeout(
        context.fabric.FabricImage.fromURL(dataUrl, { crossOrigin: 'anonymous' }),
        context.options.imageLoadTimeoutMs,
        'Mosaic FabricImage.fromURL',
    );
}

function copyBaseImageProperties(target: FabricNS.FabricImage, source: FabricNS.FabricImage): void {
    target.set({
        left: source.left,
        top: source.top,
        scaleX: source.scaleX,
        scaleY: source.scaleY,
        angle: source.angle,
        skewX: source.skewX,
        skewY: source.skewY,
        flipX: source.flipX,
        flipY: source.flipY,
        originX: source.originX,
        originY: source.originY,
        selectable: source.selectable,
        evented: source.evented,
        hasControls: source.hasControls,
        hoverCursor: source.hoverCursor,
    });
    target.setCoords();
}

function replaceBaseImage(
    context: MosaicControllerContext,
    oldImage: BaseImageObject,
    newImage: FabricNS.FabricImage,
    mimeType: ImageMimeType,
): void {
    const { canvas } = context;
    let oldRemoved = false;
    let newAdded = false;

    try {
        copyBaseImageProperties(newImage, oldImage);
        canvas.remove(oldImage);
        oldRemoved = true;
        canvas.add(newImage);
        newAdded = true;
        canvas.sendObjectToBack(newImage);
        context.setOriginalImage(markBaseImageObject(newImage));
        context.setCurrentImageMimeType(mimeType);
        canvas.renderAll();
    } catch (error) {
        try {
            if (newAdded) canvas.remove(newImage);
            if (oldRemoved && !canvas.getObjects().includes(oldImage)) {
                canvas.add(oldImage);
                canvas.sendObjectToBack(oldImage);
            }
            context.setOriginalImage(oldImage);
        } catch {
            /* ignore restoration failure; report original error */
        }
        throw error;
    }
}

function pushMosaicHistory(context: MosaicControllerContext, after: string): void {
    const before = context.getLastSnapshot() ?? after;
    if (!before || !after || before === after) return;

    context.historyManager.push(
        new Command(
            async () => {
                await context.loadFromState(after);
            },
            async () => {
                await context.loadFromState(before);
            },
        ),
    );
    context.setLastSnapshot(after);
}

async function getOrCreateRasterCache(
    context: MosaicControllerContext,
    session: MosaicSession,
    source: string,
): Promise<MosaicRasterCache | null> {
    if (session.rasterCache) {
        if (session.rasterCache.source === source) return session.rasterCache;
        releaseMosaicRasterCache(session);
    }

    const ownerDocument = getCanvasDocument(context);
    const decoded = await decodeImageSource(ownerDocument, source);
    const offscreenCanvas = ownerDocument.createElement('canvas');
    offscreenCanvas.width = decoded.width;
    offscreenCanvas.height = decoded.height;
    const renderingContext = offscreenCanvas.getContext('2d');
    if (!renderingContext) {
        reportError(
            context.options,
            new Error('Mosaic could not obtain a 2D canvas context.'),
            'Mosaic apply failed.',
        );
        return null;
    }

    renderingContext.drawImage(decoded.element, 0, 0, decoded.width, decoded.height);

    let imageData: ImageData;
    try {
        imageData = renderingContext.getImageData(0, 0, decoded.width, decoded.height);
    } catch (error) {
        reportError(
            context.options,
            error,
            'Mosaic apply failed because the source image pixels could not be read.',
        );
        return null;
    }

    const rasterCache: MosaicRasterCache = {
        offscreenCanvas,
        renderingContext,
        imageData,
        source,
        width: decoded.width,
        height: decoded.height,
    };
    session.rasterCache = rasterCache;
    return rasterCache;
}

function applyMosaicImagePoint(
    context: MosaicControllerContext,
    session: MosaicSession,
    sourceImage: FabricNS.FabricImage,
    imagePoint: MosaicImagePoint,
): boolean {
    const rasterCache = session.rasterCache;
    if (!rasterCache) return false;

    const config = context.getMosaicConfig();
    const previousPoint = session.lastImagePoint;
    const points = previousPoint
        ? interpolateMosaicPoints(previousPoint, imagePoint)
        : [imagePoint];

    let changed = false;
    let dirtyRect: MosaicDirtyRect | null = null;
    for (const point of points) {
        const pointChanged = applyCircularMosaicToImageData({
            imageData: rasterCache.imageData,
            centerX: point.sourceX,
            centerY: point.sourceY,
            radius: point.sourceRadius,
            blockSize: config.blockSize,
        });
        if (!pointChanged) continue;
        dirtyRect = mergeMosaicDirtyRects(
            dirtyRect,
            getMosaicPointDirtyRect(rasterCache.imageData, point),
        );
        changed = true;
    }

    session.lastImagePoint = imagePoint;
    if (changed) {
        session.hasUncommittedChanges = true;
        putMosaicImageData(rasterCache, dirtyRect);
        ensurePreviewImage(context, session, sourceImage);
        safeRender(context.canvas);
    }
    return changed;
}

function getMosaicPointDirtyRect(
    imageData: ImageData,
    point: MosaicImagePoint,
): MosaicDirtyRect | null {
    const centerX = Number(point.sourceX);
    const centerY = Number(point.sourceY);
    const radius = Number(point.sourceRadius);
    if (
        !Number.isFinite(centerX) ||
        !Number.isFinite(centerY) ||
        !Number.isFinite(radius) ||
        radius <= 0 ||
        imageData.width <= 0 ||
        imageData.height <= 0
    ) {
        return null;
    }

    const minX = Math.max(0, Math.floor(centerX - radius));
    const maxX = Math.min(imageData.width - 1, Math.ceil(centerX + radius));
    const minY = Math.max(0, Math.floor(centerY - radius));
    const maxY = Math.min(imageData.height - 1, Math.ceil(centerY + radius));
    if (minX > maxX || minY > maxY) return null;
    return { minX, minY, maxX, maxY };
}

function mergeMosaicDirtyRects(
    current: MosaicDirtyRect | null,
    next: MosaicDirtyRect | null,
): MosaicDirtyRect | null {
    if (!next) return current;
    if (!current) return next;
    return {
        minX: Math.min(current.minX, next.minX),
        minY: Math.min(current.minY, next.minY),
        maxX: Math.max(current.maxX, next.maxX),
        maxY: Math.max(current.maxY, next.maxY),
    };
}

function putMosaicImageData(
    rasterCache: MosaicRasterCache,
    dirtyRect: MosaicDirtyRect | null,
): void {
    if (!dirtyRect) {
        rasterCache.renderingContext.putImageData(rasterCache.imageData, 0, 0);
        return;
    }

    rasterCache.renderingContext.putImageData(
        rasterCache.imageData,
        0,
        0,
        dirtyRect.minX,
        dirtyRect.minY,
        dirtyRect.maxX - dirtyRect.minX + 1,
        dirtyRect.maxY - dirtyRect.minY + 1,
    );
}

function interpolateMosaicPoints(
    start: MosaicImagePoint,
    end: MosaicImagePoint,
): MosaicImagePoint[] {
    const dx = end.sourceX - start.sourceX;
    const dy = end.sourceY - start.sourceY;
    const distance = Math.hypot(dx, dy);
    const minRadius = Math.min(start.sourceRadius, end.sourceRadius);
    const spacing = Math.max(1, minRadius / 2);
    const steps = Math.max(1, Math.ceil(distance / spacing));
    const points: MosaicImagePoint[] = [];

    for (let index = 1; index <= steps; index += 1) {
        const t = index / steps;
        points.push({
            sourceX: start.sourceX + dx * t,
            sourceY: start.sourceY + dy * t,
            sourceRadius: start.sourceRadius + (end.sourceRadius - start.sourceRadius) * t,
        });
    }
    return points;
}

async function applyMosaicPointToCache(
    context: MosaicControllerContext,
    expectedSession: MosaicSession,
    canvasPoint: { x: number; y: number },
): Promise<void> {
    const session = context.getMosaicSession();
    if (!session || session !== expectedSession) return;
    const originalImage = context.getOriginalImage();
    if (!originalImage || !context.isImageLoaded()) return;

    const config = context.getMosaicConfig();
    const imagePoint = getMosaicImagePoint(
        context.fabric,
        originalImage,
        canvasPoint,
        config.brushSize,
    );
    if (!imagePoint) {
        session.lastImagePoint = null;
        return;
    }

    const source = getMosaicImageSource(context, originalImage);
    if (!source) {
        reportWarning(
            context.options,
            new Error('Mosaic cannot read the current image source.'),
            'Mosaic skipped because the image source is unavailable.',
        );
        return;
    }

    const rasterCache = await getOrCreateRasterCache(context, session, source);
    if (!rasterCache) return;
    applyMosaicImagePoint(context, session, originalImage, imagePoint);
}

async function commitMosaicChanges(
    context: MosaicControllerContext,
    session: MosaicSession,
    callbackContext: ImageEditorCallbackContext,
): Promise<void> {
    session.commitRequested = false;
    session.lastImagePoint = null;
    if (!session.hasUncommittedChanges || !session.rasterCache) return;

    const originalImage = context.getOriginalImage();
    if (!originalImage || !context.isImageLoaded()) return;

    const source = getMosaicImageSource(context, originalImage) ?? session.rasterCache.source;
    const rasterCache = session.rasterCache;
    rasterCache.renderingContext.putImageData(rasterCache.imageData, 0, 0);
    const output = resolveMosaicOutputFormat(context, source);
    const nextDataUrl =
        output.quality === undefined
            ? rasterCache.offscreenCanvas.toDataURL(output.mimeType)
            : rasterCache.offscreenCanvas.toDataURL(output.mimeType, output.quality);
    const nextImage = await createFabricImageFromDataUrl(context, nextDataUrl);

    removePreviewCircle(context, session);
    removePreviewImage(context, session);
    try {
        replaceBaseImage(context, originalImage, nextImage, output.mimeType);
        context.resetImageFilterState();
        const after = context.captureSnapshot();
        pushMosaicHistory(context, after);
        try {
            await refreshMosaicRasterCacheFromSource(context, session, nextDataUrl);
        } catch (error) {
            releaseMosaicRasterCache(session);
            reportWarning(
                context.options,
                error,
                'Mosaic cache refresh failed after commit; the next stroke will rebuild it.',
            );
        }
        session.hasUncommittedChanges = false;
    } finally {
        if (context.getMosaicSession() === session) {
            ensurePreviewCircle(context, session);
        }
    }

    context.updateInputs();
    context.updateUi();
    context.emitImageChanged(callbackContext);
}

async function drainMosaicQueue(
    context: MosaicControllerContext,
    expectedSession: MosaicSession,
): Promise<void> {
    const session = context.getMosaicSession();
    if (!session || session !== expectedSession || session.isApplying) return;

    session.isApplying = true;
    const callbackContext = context.buildCallbackContext('applyMosaic', false);
    context.emitBusyChangeIfChanged(callbackContext);
    context.updateUi();
    try {
        while (context.getMosaicSession() === session && session.pendingCanvasPoints.length > 0) {
            const point = session.pendingCanvasPoints.shift();
            if (point) {
                await applyMosaicPointToCache(context, session, point);
            }
        }

        if (context.getMosaicSession() === session && session.commitRequested) {
            await commitMosaicChanges(context, session, callbackContext);
        }
    } finally {
        if (context.getMosaicSession() === session) {
            session.isApplying = false;
        }
        context.emitBusyChangeIfChanged(callbackContext);
        context.updateUi();
        if (
            context.getMosaicSession() === session &&
            (session.pendingCanvasPoints.length > 0 || session.commitRequested)
        ) {
            void drainMosaicQueue(context, session).catch((error) => {
                reportError(context.options, error, 'Mosaic apply failed.');
            });
        }
    }
}

function enqueueMosaicPoint(
    context: MosaicControllerContext,
    canvasPoint: { x: number; y: number },
): void {
    const session = context.getMosaicSession();
    if (!session) return;

    session.pendingCanvasPoints.push(canvasPoint);
    if (session.pendingCanvasPoints.length > MAX_PENDING_MOSAIC_POINTS) {
        session.pendingCanvasPoints.splice(
            0,
            session.pendingCanvasPoints.length - MAX_PENDING_MOSAIC_POINTS,
        );
    }

    void drainMosaicQueue(context, session).catch((error) => {
        reportError(context.options, error, 'Mosaic apply failed.');
    });
}

function requestMosaicCommit(context: MosaicControllerContext, session: MosaicSession): void {
    session.commitRequested = true;
    void drainMosaicQueue(context, session).catch((error) => {
        reportError(context.options, error, 'Mosaic apply failed.');
    });
}

function installMosaicHandlers(context: MosaicControllerContext, session: MosaicSession): void {
    attachCanvasHandler(context, session, 'mouse:move', (event) => {
        const pointer = getPointerFromFabricEvent(context.canvas, event);
        if (!pointer) {
            hidePreview(context);
            return;
        }
        movePreview(context, pointer);
        const currentSession = context.getMosaicSession();
        if (currentSession?.isPointerDown) {
            enqueueMosaicPoint(context, pointer);
        }
    });
    attachCanvasHandler(context, session, 'mouse:out', () => {
        hidePreview(context);
    });
    attachCanvasHandler(context, session, 'mouse:down', (event) => {
        const pointer = getPointerFromFabricEvent(context.canvas, event);
        if (!pointer) return;
        const currentSession = context.getMosaicSession();
        if (!currentSession) return;
        currentSession.isPointerDown = true;
        currentSession.lastImagePoint = null;
        enqueueMosaicPoint(context, pointer);
    });
    attachCanvasHandler(context, session, 'mouse:up', (event) => {
        const currentSession = context.getMosaicSession();
        if (!currentSession) return;
        const pointer = getPointerFromFabricEvent(context.canvas, event);
        if (pointer) {
            movePreview(context, pointer);
            enqueueMosaicPoint(context, pointer);
        }
        currentSession.isPointerDown = false;
        requestMosaicCommit(context, currentSession);
    });
}

export function enterMosaicMode(context: MosaicControllerContext): void {
    if (context.getMosaicSession()) return;
    if (!context.isImageLoaded() || !context.getOriginalImage()) return;

    const { canvas } = context;
    context.hideAllMaskLabels();
    canvas.discardActiveObject();

    const prevSelection = !!canvas.selection;
    const prevDefaultCursor = canvas.defaultCursor;
    const prevObjectStates = canvas.getObjects().map((object) => ({
        object,
        evented: object.evented ?? true,
        selectable: object.selectable ?? true,
    }));

    for (const record of prevObjectStates) {
        try {
            record.object.set({ evented: false, selectable: false });
        } catch {
            /* ignore */
        }
    }

    canvas.selection = false;
    canvas.defaultCursor = 'crosshair';

    const session: MosaicSession = {
        previewCircle: null,
        previewImage: null,
        prevSelection,
        prevDefaultCursor,
        prevObjectStates,
        handlers: [],
        rasterCache: null,
        pendingCanvasPoints: [],
        isPointerDown: false,
        isApplying: false,
        commitRequested: false,
        hasUncommittedChanges: false,
        lastImagePoint: null,
    };
    context.setMosaicSession(session);
    ensurePreviewCircle(context, session);
    installMosaicHandlers(context, session);
    canvas.renderAll();
}

export function exitMosaicMode(context: MosaicControllerContext): void {
    const session = context.getMosaicSession();
    if (!session) return;

    detachCanvasHandlers(context, session);
    removePreviewCircle(context, session);
    removePreviewImage(context, session);
    releaseMosaicRasterCache(session);
    restoreObjectStates(session);
    context.canvas.selection = !!session.prevSelection;
    context.canvas.defaultCursor = session.prevDefaultCursor ?? 'default';
    context.setMosaicSession(null);
    context.canvas.renderAll();
}

export function updateMosaicPreview(context: MosaicControllerContext): void {
    const session = context.getMosaicSession();
    const circle = session?.previewCircle;
    if (!session || !circle) return;
    const config = context.getMosaicConfig();
    circle.set({
        radius: config.brushSize / 2,
        fill: config.previewFill,
        stroke: config.previewStroke,
        strokeWidth: config.previewStrokeWidth,
        strokeDashArray: config.previewStrokeDashArray
            ? [...config.previewStrokeDashArray]
            : undefined,
    });
    context.canvas.bringObjectToFront(circle);
    safeRender(context.canvas);
}

export function isMosaicPreviewObject(object: FabricNS.FabricObject): boolean {
    return (object as MosaicPreviewCircle).isMosaicPreview === true;
}
