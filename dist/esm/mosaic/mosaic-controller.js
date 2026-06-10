import { reportError, reportWarning } from '../core/callback-reporter.js';
import { mimeTypeFor, tryNormalizeImageFormat } from '../export/export-format.js';
import { Command } from '../history/history-manager.js';
import { detectSourceMimeType } from '../image/image-resampler.js';
import { withTimeout } from '../utils/timeout.js';
import { getMosaicImagePoint } from './mosaic-geometry.js';
import { applyCircularMosaicToImageData } from './mosaic-pixelate.js';
function getCanvasDocument(context) {
    var _a, _b, _c, _d, _e;
    const element = (_b = (_a = context.canvas).getElement) === null || _b === void 0 ? void 0 : _b.call(_a);
    return ((_e = (_c = element === null || element === void 0 ? void 0 : element.ownerDocument) !== null && _c !== void 0 ? _c : (_d = context.canvas.lowerCanvasEl) === null || _d === void 0 ? void 0 : _d.ownerDocument) !== null && _e !== void 0 ? _e : document);
}
function isFinitePoint(value) {
    const point = value;
    return (!!point &&
        typeof point.x === 'number' &&
        Number.isFinite(point.x) &&
        typeof point.y === 'number' &&
        Number.isFinite(point.y));
}
function getPointerFromFabricEvent(canvas, event) {
    const fabricEvent = event;
    if (isFinitePoint(fabricEvent.scenePoint))
        return fabricEvent.scenePoint;
    if (isFinitePoint(fabricEvent.pointer))
        return fabricEvent.pointer;
    if (isFinitePoint(fabricEvent.absolutePointer))
        return fabricEvent.absolutePointer;
    if (fabricEvent.e && typeof canvas.getPointer === 'function') {
        const pointer = canvas.getPointer(fabricEvent.e);
        if (isFinitePoint(pointer))
            return pointer;
    }
    return null;
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
    var _a;
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
        strokeDashArray: (_a = config.previewStrokeDashArray) !== null && _a !== void 0 ? _a : undefined,
        selectable: false,
        evented: false,
        excludeFromExport: true,
        objectCaching: false,
        visible: false,
    });
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
        context.setOriginalImage(newImage);
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
async function applyMosaicAtPoint(context, canvasPoint) {
    const session = context.getMosaicSession();
    if (!session || session.isApplying)
        return;
    const originalImage = context.getOriginalImage();
    if (!originalImage || !context.isImageLoaded())
        return;
    const config = context.getMosaicConfig();
    const imagePoint = getMosaicImagePoint(context.fabric, originalImage, canvasPoint, config.brushSize);
    if (!imagePoint)
        return;
    const source = getImageSource(originalImage);
    if (!source) {
        reportWarning(context.options, new Error('Mosaic cannot read the current image source.'), 'Mosaic skipped because the image source is unavailable.');
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
            reportError(context.options, new Error('Mosaic could not obtain a 2D canvas context.'), 'Mosaic apply failed.');
            return;
        }
        renderingContext.drawImage(decoded.element, 0, 0, decoded.width, decoded.height);
        let imageData;
        try {
            imageData = renderingContext.getImageData(0, 0, decoded.width, decoded.height);
        }
        catch (error) {
            reportError(context.options, error, 'Mosaic apply failed because the source image pixels could not be read.');
            return;
        }
        const changed = applyCircularMosaicToImageData({
            imageData,
            centerX: imagePoint.sourceX,
            centerY: imagePoint.sourceY,
            radius: imagePoint.sourceRadius,
            blockSize: config.blockSize,
        });
        if (!changed)
            return;
        renderingContext.putImageData(imageData, 0, 0);
        const output = resolveMosaicOutputFormat(context, source);
        const nextDataUrl = output.quality === undefined
            ? offscreen.toDataURL(output.mimeType)
            : offscreen.toDataURL(output.mimeType, output.quality);
        const nextImage = await createFabricImageFromDataUrl(context, nextDataUrl);
        removePreviewCircle(context, session);
        try {
            replaceBaseImage(context, originalImage, nextImage, output.mimeType);
            const after = context.captureSnapshot();
            pushMosaicHistory(context, after);
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
    finally {
        if (context.getMosaicSession() === session) {
            session.isApplying = false;
        }
        context.emitBusyChangeIfChanged(callbackContext);
    }
}
function installMosaicHandlers(context, session) {
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
        if (!pointer)
            return;
        void applyMosaicAtPoint(context, pointer).catch((error) => {
            reportError(context.options, error, 'Mosaic apply failed.');
        });
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
export function exitMosaicMode(context) {
    var _a;
    const session = context.getMosaicSession();
    if (!session)
        return;
    detachCanvasHandlers(context, session);
    removePreviewCircle(context, session);
    restoreObjectStates(session);
    context.canvas.selection = !!session.prevSelection;
    context.canvas.defaultCursor = (_a = session.prevDefaultCursor) !== null && _a !== void 0 ? _a : 'default';
    context.setMosaicSession(null);
    context.canvas.renderAll();
}
export function updateMosaicPreview(context) {
    var _a;
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
        strokeDashArray: (_a = config.previewStrokeDashArray) !== null && _a !== void 0 ? _a : undefined,
    });
    context.canvas.bringObjectToFront(circle);
    safeRender(context.canvas);
}
export function isMosaicPreviewObject(object) {
    return object.isMosaicPreview === true;
}
//# sourceMappingURL=mosaic-controller.js.map