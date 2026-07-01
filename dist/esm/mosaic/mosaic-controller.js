import { reportError, reportWarning } from '../core/callback-reporter.js';
import { markBaseImageObject, markSessionObject } from '../core/editor-object-kind.js';
import { mimeTypeFor, tryNormalizeImageFormat } from '../export/export-format.js';
import { Command } from '../history/history-manager.js';
import { detectSourceMimeType } from '../image/image-resampler.js';
import { getPointerFromFabricEvent } from '../utils/pointer.js';
import { withTimeout } from '../utils/timeout.js';
import { getMosaicImagePoint } from './mosaic-geometry.js';
import { applyCircularMosaicToImageData } from './mosaic-pixelate.js';
const MAX_PENDING_MOSAIC_POINTS = 4096;
function getCanvasDocument(context) {
    var _a, _b, _c, _d, _e;
    const element = (_b = (_a = context.canvas).getElement) === null || _b === void 0 ? void 0 : _b.call(_a);
    return ((_e = (_c = element === null || element === void 0 ? void 0 : element.ownerDocument) !== null && _c !== void 0 ? _c : (_d = context.canvas.lowerCanvasEl) === null || _d === void 0 ? void 0 : _d.ownerDocument) !== null && _e !== void 0 ? _e : document);
}
function safeRender(canvas) {
    try {
        canvas.requestRenderAll();
    }
    catch {
        try {
            canvas.renderAll();
        }
        catch {
        }
    }
}
function createPreviewCircle(context) {
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
    });
    markSessionObject(circle, 'mosaicPreviewCircle');
    circle.isMosaicPreview = true;
    return circle;
}
function ensurePreviewCircle(context, session) {
    var _a;
    const { canvas } = context;
    const circle = (_a = session.previewCircle) !== null && _a !== void 0 ? _a : createPreviewCircle(context);
    session.previewCircle = circle;
    if (!canvas.getObjects().includes(circle)) {
        canvas.add(circle);
    }
    canvas.bringObjectToFront(circle);
    updateMosaicPreview(context);
    return circle;
}
function removePreviewCircle(context, session) {
    const circle = session.previewCircle;
    if (!circle)
        return;
    try {
        context.canvas.remove(circle);
    }
    catch {
    }
    session.previewCircle = null;
}
function createPreviewImage(context, sourceImage, rasterCache) {
    const image = new context.fabric.FabricImage(rasterCache.offscreenCanvas, {
        selectable: false,
        evented: false,
        excludeFromExport: true,
        objectCaching: false,
        visible: true,
    });
    copyBaseImageProperties(image, sourceImage);
    image.set({
        selectable: false,
        evented: false,
        excludeFromExport: true,
        objectCaching: false,
        visible: true,
    });
    markSessionObject(image, 'mosaicPreviewImage');
    image.isMosaicPreview = true;
    return image;
}
function placePreviewImageAfterBase(context, previewImage, sourceImage) {
    var _a, _b;
    const sourceIndex = context.canvas.getObjects().indexOf(sourceImage);
    if (sourceIndex < 0)
        return;
    try {
        (_b = (_a = context.canvas).moveObjectTo) === null || _b === void 0 ? void 0 : _b.call(_a, previewImage, sourceIndex + 1);
    }
    catch {
    }
}
function ensurePreviewImage(context, session, sourceImage) {
    var _a;
    const rasterCache = session.rasterCache;
    if (!rasterCache)
        return null;
    const previewImage = (_a = session.previewImage) !== null && _a !== void 0 ? _a : createPreviewImage(context, sourceImage, rasterCache);
    session.previewImage = previewImage;
    copyBaseImageProperties(previewImage, sourceImage);
    previewImage.set({
        selectable: false,
        evented: false,
        excludeFromExport: true,
        objectCaching: false,
        visible: true,
    });
    previewImage.dirty = true;
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
function removePreviewImage(context, session) {
    const image = session.previewImage;
    if (!image)
        return;
    try {
        context.canvas.remove(image);
    }
    catch {
    }
    session.previewImage = null;
}
function releaseMosaicRasterCache(session) {
    const cache = session.rasterCache;
    if (!cache)
        return;
    try {
        cache.offscreenCanvas.width = 0;
        cache.offscreenCanvas.height = 0;
    }
    catch {
    }
    session.rasterCache = null;
}
async function refreshMosaicRasterCacheFromSource(context, session, source) {
    const rasterCache = session.rasterCache;
    if (!rasterCache)
        return;
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
function hidePreview(context) {
    var _a;
    const circle = (_a = context.getMosaicSession()) === null || _a === void 0 ? void 0 : _a.previewCircle;
    if (!circle)
        return;
    circle.set({ visible: false });
    safeRender(context.canvas);
}
function movePreview(context, point) {
    const session = context.getMosaicSession();
    if (!session)
        return;
    const circle = ensurePreviewCircle(context, session);
    circle.set({ left: point.x, top: point.y, visible: true });
    safeRender(context.canvas);
}
function attachCanvasHandler(context, session, eventName, callback) {
    context.canvas.on(eventName, callback);
    session.handlers.push({ eventName, callback });
}
function detachCanvasHandlers(context, session) {
    for (const record of session.handlers) {
        try {
            context.canvas.off(record.eventName, record.callback);
        }
        catch {
        }
    }
    session.handlers = [];
}
function restoreObjectStates(session) {
    for (const record of session.prevObjectStates) {
        try {
            record.object.set({ evented: record.evented, selectable: record.selectable });
        }
        catch {
        }
    }
    session.prevObjectStates = [];
}
function getImageSource(image) {
    var _a;
    const imageWithSource = image;
    try {
        const src = (_a = imageWithSource.getSrc) === null || _a === void 0 ? void 0 : _a.call(imageWithSource);
        if (typeof src === 'string' && src.length > 0)
            return src;
    }
    catch {
    }
    return typeof imageWithSource.src === 'string' && imageWithSource.src.length > 0
        ? imageWithSource.src
        : null;
}
function imageDimension(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : 0;
}
function decodeImageSource(ownerDocument, source) {
    return new Promise((resolve, reject) => {
        const imageElement = ownerDocument.createElement('img');
        const cleanup = () => {
            if (typeof imageElement.removeEventListener === 'function') {
                imageElement.removeEventListener('load', handleLoad);
                imageElement.removeEventListener('error', handleError);
            }
            else {
                imageElement.onload = null;
                imageElement.onerror = null;
            }
        };
        const handleLoad = () => {
            const width = imageDimension(imageElement.naturalWidth || imageElement.width);
            const height = imageDimension(imageElement.naturalHeight || imageElement.height);
            cleanup();
            if (width <= 0 || height <= 0) {
                reject(new Error('Mosaic image decode failed: source image has no dimensions.'));
                return;
            }
            resolve({ element: imageElement, width, height });
        };
        const handleError = (event) => {
            cleanup();
            const message = typeof event === 'string'
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
        }
        else {
            imageElement.onload = handleLoad;
            imageElement.onerror = handleError;
        }
        imageElement.src = source;
    });
}
function toSupportedMimeType(mimeType) {
    return mimeType === 'image/jpeg' || mimeType === 'image/png' || mimeType === 'image/webp'
        ? mimeType
        : null;
}
function mimeToFormat(mimeType) {
    if (mimeType === 'image/jpeg')
        return 'jpeg';
    if (mimeType === 'image/webp')
        return 'webp';
    return 'png';
}
function resolveMosaicOutputFormat(context, source) {
    var _a, _b, _c, _d;
    const config = context.getMosaicConfig();
    const requested = config.outputFileType;
    const format = requested === 'source'
        ? mimeToFormat((_b = (_a = context.getCurrentImageMimeType()) !== null && _a !== void 0 ? _a : toSupportedMimeType(detectSourceMimeType(source))) !== null && _b !== void 0 ? _b : 'image/png')
        : ((_c = tryNormalizeImageFormat(String(requested))) !== null && _c !== void 0 ? _c : 'png');
    const mimeType = mimeTypeFor(format);
    if (format === 'png')
        return { mimeType };
    return {
        mimeType,
        quality: (_d = config.outputQuality) !== null && _d !== void 0 ? _d : context.options.downsampleQuality,
    };
}
async function createFabricImageFromDataUrl(context, dataUrl) {
    return await withTimeout(context.fabric.FabricImage.fromURL(dataUrl, { crossOrigin: 'anonymous' }), context.options.imageLoadTimeoutMs, 'Mosaic FabricImage.fromURL');
}
function copyBaseImageProperties(target, source) {
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
function replaceBaseImage(context, oldImage, newImage, mimeType) {
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
    }
    catch (error) {
        try {
            if (newAdded)
                canvas.remove(newImage);
            if (oldRemoved && !canvas.getObjects().includes(oldImage)) {
                canvas.add(oldImage);
                canvas.sendObjectToBack(oldImage);
            }
            context.setOriginalImage(oldImage);
        }
        catch {
        }
        throw error;
    }
}
function pushMosaicHistory(context, after) {
    var _a;
    const before = (_a = context.getLastSnapshot()) !== null && _a !== void 0 ? _a : after;
    if (!before || !after || before === after)
        return;
    context.historyManager.push(new Command(async () => {
        await context.loadFromState(after);
    }, async () => {
        await context.loadFromState(before);
    }));
    context.setLastSnapshot(after);
}
async function getOrCreateRasterCache(context, session, source) {
    if (session.rasterCache) {
        if (session.rasterCache.source === source)
            return session.rasterCache;
        releaseMosaicRasterCache(session);
    }
    const ownerDocument = getCanvasDocument(context);
    const decoded = await decodeImageSource(ownerDocument, source);
    const offscreenCanvas = ownerDocument.createElement('canvas');
    offscreenCanvas.width = decoded.width;
    offscreenCanvas.height = decoded.height;
    const renderingContext = offscreenCanvas.getContext('2d');
    if (!renderingContext) {
        reportError(context.options, new Error('Mosaic could not obtain a 2D canvas context.'), 'Mosaic apply failed.');
        return null;
    }
    renderingContext.drawImage(decoded.element, 0, 0, decoded.width, decoded.height);
    let imageData;
    try {
        imageData = renderingContext.getImageData(0, 0, decoded.width, decoded.height);
    }
    catch (error) {
        reportError(context.options, error, 'Mosaic apply failed because the source image pixels could not be read.');
        return null;
    }
    const rasterCache = {
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
function applyMosaicImagePoint(context, session, sourceImage, imagePoint) {
    const rasterCache = session.rasterCache;
    if (!rasterCache)
        return false;
    const config = context.getMosaicConfig();
    const previousPoint = session.lastImagePoint;
    const points = previousPoint
        ? interpolateMosaicPoints(previousPoint, imagePoint)
        : [imagePoint];
    let changed = false;
    for (const point of points) {
        changed =
            applyCircularMosaicToImageData({
                imageData: rasterCache.imageData,
                centerX: point.sourceX,
                centerY: point.sourceY,
                radius: point.sourceRadius,
                blockSize: config.blockSize,
            }) || changed;
    }
    session.lastImagePoint = imagePoint;
    if (changed) {
        session.hasUncommittedChanges = true;
        rasterCache.renderingContext.putImageData(rasterCache.imageData, 0, 0);
        ensurePreviewImage(context, session, sourceImage);
        safeRender(context.canvas);
    }
    return changed;
}
function interpolateMosaicPoints(start, end) {
    const dx = end.sourceX - start.sourceX;
    const dy = end.sourceY - start.sourceY;
    const distance = Math.hypot(dx, dy);
    const minRadius = Math.min(start.sourceRadius, end.sourceRadius);
    const spacing = Math.max(1, minRadius / 2);
    const steps = Math.max(1, Math.ceil(distance / spacing));
    const points = [];
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
async function applyMosaicPointToCache(context, expectedSession, canvasPoint) {
    const session = context.getMosaicSession();
    if (!session || session !== expectedSession)
        return;
    const originalImage = context.getOriginalImage();
    if (!originalImage || !context.isImageLoaded())
        return;
    const config = context.getMosaicConfig();
    const imagePoint = getMosaicImagePoint(context.fabric, originalImage, canvasPoint, config.brushSize);
    if (!imagePoint) {
        session.lastImagePoint = null;
        return;
    }
    const source = getImageSource(originalImage);
    if (!source) {
        reportWarning(context.options, new Error('Mosaic cannot read the current image source.'), 'Mosaic skipped because the image source is unavailable.');
        return;
    }
    const rasterCache = await getOrCreateRasterCache(context, session, source);
    if (!rasterCache)
        return;
    applyMosaicImagePoint(context, session, originalImage, imagePoint);
}
async function commitMosaicChanges(context, session, callbackContext) {
    var _a;
    session.commitRequested = false;
    session.lastImagePoint = null;
    if (!session.hasUncommittedChanges || !session.rasterCache)
        return;
    const originalImage = context.getOriginalImage();
    if (!originalImage || !context.isImageLoaded())
        return;
    const source = (_a = getImageSource(originalImage)) !== null && _a !== void 0 ? _a : session.rasterCache.source;
    const rasterCache = session.rasterCache;
    rasterCache.renderingContext.putImageData(rasterCache.imageData, 0, 0);
    const output = resolveMosaicOutputFormat(context, source);
    const nextDataUrl = output.quality === undefined
        ? rasterCache.offscreenCanvas.toDataURL(output.mimeType)
        : rasterCache.offscreenCanvas.toDataURL(output.mimeType, output.quality);
    const nextImage = await createFabricImageFromDataUrl(context, nextDataUrl);
    removePreviewCircle(context, session);
    removePreviewImage(context, session);
    try {
        replaceBaseImage(context, originalImage, nextImage, output.mimeType);
        const after = context.captureSnapshot();
        pushMosaicHistory(context, after);
        try {
            await refreshMosaicRasterCacheFromSource(context, session, nextDataUrl);
        }
        catch (error) {
            releaseMosaicRasterCache(session);
            reportWarning(context.options, error, 'Mosaic cache refresh failed after commit; the next stroke will rebuild it.');
        }
        session.hasUncommittedChanges = false;
    }
    finally {
        if (context.getMosaicSession() === session) {
            ensurePreviewCircle(context, session);
        }
    }
    context.updateInputs();
    context.updateUi();
    context.emitImageChanged(callbackContext);
}
async function drainMosaicQueue(context, expectedSession) {
    const session = context.getMosaicSession();
    if (!session || session !== expectedSession || session.isApplying)
        return;
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
    }
    finally {
        if (context.getMosaicSession() === session) {
            session.isApplying = false;
        }
        context.emitBusyChangeIfChanged(callbackContext);
        context.updateUi();
        if (context.getMosaicSession() === session &&
            (session.pendingCanvasPoints.length > 0 || session.commitRequested)) {
            void drainMosaicQueue(context, session).catch((error) => {
                reportError(context.options, error, 'Mosaic apply failed.');
            });
        }
    }
}
function enqueueMosaicPoint(context, canvasPoint) {
    const session = context.getMosaicSession();
    if (!session)
        return;
    session.pendingCanvasPoints.push(canvasPoint);
    if (session.pendingCanvasPoints.length > MAX_PENDING_MOSAIC_POINTS) {
        session.pendingCanvasPoints.splice(0, session.pendingCanvasPoints.length - MAX_PENDING_MOSAIC_POINTS);
    }
    void drainMosaicQueue(context, session).catch((error) => {
        reportError(context.options, error, 'Mosaic apply failed.');
    });
}
function requestMosaicCommit(context, session) {
    session.commitRequested = true;
    void drainMosaicQueue(context, session).catch((error) => {
        reportError(context.options, error, 'Mosaic apply failed.');
    });
}
function installMosaicHandlers(context, session) {
    attachCanvasHandler(context, session, 'mouse:move', (event) => {
        const pointer = getPointerFromFabricEvent(context.canvas, event);
        if (!pointer) {
            hidePreview(context);
            return;
        }
        movePreview(context, pointer);
        const currentSession = context.getMosaicSession();
        if (currentSession === null || currentSession === void 0 ? void 0 : currentSession.isPointerDown) {
            enqueueMosaicPoint(context, pointer);
        }
    });
    attachCanvasHandler(context, session, 'mouse:out', () => {
        hidePreview(context);
    });
    attachCanvasHandler(context, session, 'mouse:down', (event) => {
        const pointer = getPointerFromFabricEvent(context.canvas, event);
        if (!pointer)
            return;
        const currentSession = context.getMosaicSession();
        if (!currentSession)
            return;
        currentSession.isPointerDown = true;
        currentSession.lastImagePoint = null;
        enqueueMosaicPoint(context, pointer);
    });
    attachCanvasHandler(context, session, 'mouse:up', (event) => {
        const currentSession = context.getMosaicSession();
        if (!currentSession)
            return;
        const pointer = getPointerFromFabricEvent(context.canvas, event);
        if (pointer) {
            movePreview(context, pointer);
            enqueueMosaicPoint(context, pointer);
        }
        currentSession.isPointerDown = false;
        requestMosaicCommit(context, currentSession);
    });
}
export function enterMosaicMode(context) {
    if (context.getMosaicSession())
        return;
    if (!context.isImageLoaded() || !context.getOriginalImage())
        return;
    const { canvas } = context;
    context.hideAllMaskLabels();
    canvas.discardActiveObject();
    const prevSelection = !!canvas.selection;
    const prevDefaultCursor = canvas.defaultCursor;
    const prevObjectStates = canvas.getObjects().map((object) => {
        var _a, _b;
        return ({
            object,
            evented: (_a = object.evented) !== null && _a !== void 0 ? _a : true,
            selectable: (_b = object.selectable) !== null && _b !== void 0 ? _b : true,
        });
    });
    for (const record of prevObjectStates) {
        try {
            record.object.set({ evented: false, selectable: false });
        }
        catch {
        }
    }
    canvas.selection = false;
    canvas.defaultCursor = 'crosshair';
    const session = {
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
export function exitMosaicMode(context) {
    var _a;
    const session = context.getMosaicSession();
    if (!session)
        return;
    detachCanvasHandlers(context, session);
    removePreviewCircle(context, session);
    removePreviewImage(context, session);
    releaseMosaicRasterCache(session);
    restoreObjectStates(session);
    context.canvas.selection = !!session.prevSelection;
    context.canvas.defaultCursor = (_a = session.prevDefaultCursor) !== null && _a !== void 0 ? _a : 'default';
    context.setMosaicSession(null);
    context.canvas.renderAll();
}
export function updateMosaicPreview(context) {
    const session = context.getMosaicSession();
    const circle = session === null || session === void 0 ? void 0 : session.previewCircle;
    if (!session || !circle)
        return;
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
export function isMosaicPreviewObject(object) {
    return object.isMosaicPreview === true;
}
//# sourceMappingURL=mosaic-controller.js.map