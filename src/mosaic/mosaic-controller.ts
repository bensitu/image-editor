/**
 * Mosaic mode controller.
 *
 * Owns the Mosaic session lifecycle, preview circle, Fabric pointer handlers,
 * and the base-image pixel replacement pipeline. The ImageEditor facade owns
 * canonical editor state and passes it in through the context callbacks.
 *
 * @module
 */

import type * as FabricNS from 'fabric';

import { reportError, reportWarning } from '../core/callback-reporter.js';
import type {
    FabricModule,
    ImageEditorCallbackContext,
    ImageEditorOperation,
    ImageMimeType,
    ResolvedMosaicConfig,
    ResolvedOptions,
} from '../core/public-types.js';
import { mimeTypeFor, tryNormalizeImageFormat } from '../export/export-format.js';
import { Command, type HistoryManager } from '../history/history-manager.js';
import { detectSourceMimeType } from '../image/image-resampler.js';
import { withTimeout } from '../utils/timeout.js';
import { getMosaicImagePoint } from './mosaic-geometry.js';
import { applyCircularMosaicToImageData } from './mosaic-pixelate.js';

interface MosaicPreviewCircle extends FabricNS.Circle {
    isMosaicPreview?: boolean;
}

export interface MosaicSession {
    previewCircle: MosaicPreviewCircle | null;
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
    isApplying: boolean;
}

export interface MosaicControllerContext {
    readonly fabric: FabricModule;
    readonly canvas: FabricNS.Canvas;
    readonly options: ResolvedOptions;
    readonly historyManager: HistoryManager;

    getMosaicConfig(): ResolvedMosaicConfig;
    isImageLoaded(): boolean;
    getOriginalImage(): FabricNS.FabricImage | null;
    setOriginalImage(image: FabricNS.FabricImage | null): void;
    getCurrentImageMimeType(): ImageMimeType | null;
    setCurrentImageMimeType(mimeType: ImageMimeType | null): void;
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

interface MosaicOutputFormat {
    mimeType: ImageMimeType;
    quality?: number;
}

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

function isFinitePoint(value: unknown): value is { x: number; y: number } {
    const point = value as { x?: unknown; y?: unknown } | null | undefined;
    return (
        !!point &&
        typeof point.x === 'number' &&
        Number.isFinite(point.x) &&
        typeof point.y === 'number' &&
        Number.isFinite(point.y)
    );
}

function getPointerFromFabricEvent(
    canvas: FabricNS.Canvas,
    event: unknown,
): { x: number; y: number } | null {
    const fabricEvent = event as {
        scenePoint?: unknown;
        pointer?: unknown;
        absolutePointer?: unknown;
        e?: Event;
    };

    if (isFinitePoint(fabricEvent.scenePoint)) return fabricEvent.scenePoint;
    if (isFinitePoint(fabricEvent.pointer)) return fabricEvent.pointer;
    if (isFinitePoint(fabricEvent.absolutePointer)) return fabricEvent.absolutePointer;

    if (fabricEvent.e && typeof (canvas as { getPointer?: unknown }).getPointer === 'function') {
        const pointer = (canvas as unknown as { getPointer(e: Event): unknown }).getPointer(
            fabricEvent.e,
        );
        if (isFinitePoint(pointer)) return pointer;
    }

    return null;
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
        strokeDashArray: config.previewStrokeDashArray ?? undefined,
        selectable: false,
        evented: false,
        excludeFromExport: true,
        objectCaching: false,
        visible: false,
    } as Partial<FabricNS.CircleProps>) as MosaicPreviewCircle;
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
    oldImage: FabricNS.FabricImage,
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
        context.setOriginalImage(newImage);
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

async function applyMosaicAtPoint(
    context: MosaicControllerContext,
    canvasPoint: { x: number; y: number },
): Promise<void> {
    const session = context.getMosaicSession();
    if (!session || session.isApplying) return;
    const originalImage = context.getOriginalImage();
    if (!originalImage || !context.isImageLoaded()) return;

    const config = context.getMosaicConfig();
    const imagePoint = getMosaicImagePoint(
        context.fabric,
        originalImage,
        canvasPoint,
        config.brushSize,
    );
    if (!imagePoint) return;

    const source = getImageSource(originalImage);
    if (!source) {
        reportWarning(
            context.options,
            new Error('Mosaic cannot read the current image source.'),
            'Mosaic skipped because the image source is unavailable.',
        );
        return;
    }

    session.isApplying = true;
    const callbackContext = context.buildCallbackContext('applyMosaic', false);
    try {
        const ownerDocument = getCanvasDocument(context);
        const decoded = await decodeImageSource(ownerDocument, source);
        const offscreen = ownerDocument.createElement('canvas');
        offscreen.width = decoded.width;
        offscreen.height = decoded.height;
        const renderingContext = offscreen.getContext('2d');
        if (!renderingContext) {
            reportError(
                context.options,
                new Error('Mosaic could not obtain a 2D canvas context.'),
                'Mosaic apply failed.',
            );
            return;
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
            return;
        }

        const changed = applyCircularMosaicToImageData({
            imageData,
            centerX: imagePoint.sourceX,
            centerY: imagePoint.sourceY,
            radius: imagePoint.sourceRadius,
            blockSize: config.blockSize,
        });
        if (!changed) return;

        renderingContext.putImageData(imageData, 0, 0);
        const output = resolveMosaicOutputFormat(context, source);
        const nextDataUrl =
            output.quality === undefined
                ? offscreen.toDataURL(output.mimeType)
                : offscreen.toDataURL(output.mimeType, output.quality);
        const nextImage = await createFabricImageFromDataUrl(context, nextDataUrl);

        removePreviewCircle(context, session);
        try {
            replaceBaseImage(context, originalImage, nextImage, output.mimeType);
            const after = context.captureSnapshot();
            pushMosaicHistory(context, after);
        } finally {
            if (context.getMosaicSession() === session) {
                ensurePreviewCircle(context, session);
            }
        }

        context.updateInputs();
        context.updateUi();
        context.emitImageChanged(callbackContext);
    } finally {
        if (context.getMosaicSession() === session) {
            session.isApplying = false;
        }
        context.emitBusyChangeIfChanged(callbackContext);
    }
}

function installMosaicHandlers(context: MosaicControllerContext, session: MosaicSession): void {
    attachCanvasHandler(context, session, 'mouse:move', (event) => {
        const pointer = getPointerFromFabricEvent(context.canvas, event);
        if (!pointer) {
            hidePreview(context);
            return;
        }
        movePreview(context, pointer);
    });
    attachCanvasHandler(context, session, 'mouse:out', () => {
        hidePreview(context);
    });
    attachCanvasHandler(context, session, 'mouse:down', (event) => {
        const pointer = getPointerFromFabricEvent(context.canvas, event);
        if (!pointer) return;
        void applyMosaicAtPoint(context, pointer).catch((error) => {
            reportError(context.options, error, 'Mosaic apply failed.');
        });
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
        prevSelection,
        prevDefaultCursor,
        prevObjectStates,
        handlers: [],
        isApplying: false,
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
        strokeDashArray: config.previewStrokeDashArray ?? undefined,
    });
    context.canvas.bringObjectToFront(circle);
    safeRender(context.canvas);
}

export function isMosaicPreviewObject(object: FabricNS.FabricObject): boolean {
    return (object as MosaicPreviewCircle).isMosaicPreview === true;
}
