'use strict';

var disposable = require('../../chunks/disposable-Sj4tt6Lk.cjs');
var pluginManifest = require('../../chunks/plugin-manifest-BCkXHQr2.cjs');
var pluginDefinition = require('../../chunks/plugin-definition-B3UyurRp.cjs');
var visibleRasterBake = require('../../chunks/visible-raster-bake-B7dAdnmC.cjs');
var coreCapabilities = require('../../chunks/core-capabilities-ewP5YPVJ.cjs');

function isInsideCircle(x, y, centerX, centerY, radiusSquared) {
    const deltaX = x - centerX;
    const deltaY = y - centerY;
    return deltaX * deltaX + deltaY * deltaY <= radiusSquared;
}
function pixelOffset(width, x, y) {
    return (y * width + x) * 4;
}
function getCircularDirtyRectangle(options) {
    const { widthPx, heightPx, centerXPx, centerYPx, radiusPx } = options;
    if (!Number.isSafeInteger(widthPx) ||
        !Number.isSafeInteger(heightPx) ||
        widthPx <= 0 ||
        heightPx <= 0 ||
        !Number.isFinite(centerXPx) ||
        !Number.isFinite(centerYPx) ||
        !Number.isFinite(radiusPx) ||
        radiusPx <= 0) {
        return null;
    }
    const leftPx = Math.max(0, Math.floor(centerXPx - radiusPx));
    const rightPx = Math.min(widthPx - 1, Math.ceil(centerXPx + radiusPx));
    const topPx = Math.max(0, Math.floor(centerYPx - radiusPx));
    const bottomPx = Math.min(heightPx - 1, Math.ceil(centerYPx + radiusPx));
    if (leftPx > rightPx || topPx > bottomPx)
        return null;
    return Object.freeze({
        leftPx,
        topPx,
        widthPx: rightPx - leftPx + 1,
        heightPx: bottomPx - topPx + 1,
    });
}
function mergeDirtyRectangles(current, next) {
    if (!next)
        return current ? Object.freeze({ ...current }) : null;
    if (!current)
        return Object.freeze({ ...next });
    const leftPx = Math.min(current.leftPx, next.leftPx);
    const topPx = Math.min(current.topPx, next.topPx);
    const rightPx = Math.max(current.leftPx + current.widthPx, next.leftPx + next.widthPx);
    const bottomPx = Math.max(current.topPx + current.heightPx, next.topPx + next.heightPx);
    return Object.freeze({
        leftPx,
        topPx,
        widthPx: rightPx - leftPx,
        heightPx: bottomPx - topPx,
    });
}
function interpolateMosaicPoints(start, end, radiusPx) {
    const deltaX = end.xPx - start.xPx;
    const deltaY = end.yPx - start.yPx;
    const distance = Math.hypot(deltaX, deltaY);
    const spacing = Math.max(1, radiusPx / 2);
    const steps = Math.max(1, Math.ceil(distance / spacing));
    return Object.freeze(Array.from(Array.from({ length: steps }).keys(), (index) => {
        const progress = (index + 1) / steps;
        return Object.freeze({
            xPx: start.xPx + deltaX * progress,
            yPx: start.yPx + deltaY * progress,
        });
    }));
}
function applyCircularMosaic(imageData, point) {
    var _a, _b, _c, _d;
    const dirty = getCircularDirtyRectangle({
        widthPx: imageData.width,
        heightPx: imageData.height,
        centerXPx: point.xPx,
        centerYPx: point.yPx,
        radiusPx: point.radiusPx,
    });
    if (!dirty)
        return null;
    const blockSize = Math.max(1, Math.floor(point.blockSizePx));
    const rightPx = dirty.leftPx + dirty.widthPx - 1;
    const bottomPx = dirty.topPx + dirty.heightPx - 1;
    const radiusSquared = point.radiusPx * point.radiusPx;
    let changed = false;
    for (let blockTop = dirty.topPx; blockTop <= bottomPx; blockTop += blockSize) {
        for (let blockLeft = dirty.leftPx; blockLeft <= rightPx; blockLeft += blockSize) {
            const blockRight = Math.min(rightPx, blockLeft + blockSize - 1);
            const blockBottom = Math.min(bottomPx, blockTop + blockSize - 1);
            let sampleOffset = -1;
            for (let y = blockTop; y <= blockBottom && sampleOffset < 0; y += 1) {
                for (let x = blockLeft; x <= blockRight; x += 1) {
                    if (!isInsideCircle(x, y, point.xPx, point.yPx, radiusSquared)) {
                        continue;
                    }
                    sampleOffset = pixelOffset(imageData.width, x, y);
                    break;
                }
            }
            if (sampleOffset < 0)
                continue;
            const red = (_a = imageData.data[sampleOffset]) !== null && _a !== void 0 ? _a : 0;
            const green = (_b = imageData.data[sampleOffset + 1]) !== null && _b !== void 0 ? _b : 0;
            const blue = (_c = imageData.data[sampleOffset + 2]) !== null && _c !== void 0 ? _c : 0;
            const alpha = (_d = imageData.data[sampleOffset + 3]) !== null && _d !== void 0 ? _d : 0;
            for (let y = blockTop; y <= blockBottom; y += 1) {
                for (let x = blockLeft; x <= blockRight; x += 1) {
                    if (!isInsideCircle(x, y, point.xPx, point.yPx, radiusSquared)) {
                        continue;
                    }
                    const offset = pixelOffset(imageData.width, x, y);
                    imageData.data[offset] = red;
                    imageData.data[offset + 1] = green;
                    imageData.data[offset + 2] = blue;
                    imageData.data[offset + 3] = alpha;
                    changed = true;
                }
            }
        }
    }
    return changed ? dirty : null;
}

class MosaicError extends Error {
    constructor() {
        super(...arguments);
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'MosaicError'
        });
    }
}
class MosaicSessionError extends MosaicError {
    constructor() {
        super(...arguments);
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'MosaicSessionError'
        });
    }
}
class MosaicValidationError extends MosaicError {
    constructor() {
        super(...arguments);
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'MosaicValidationError'
        });
    }
}
class MosaicIntegrationError extends MosaicError {
    constructor() {
        super(...arguments);
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'MosaicIntegrationError'
        });
    }
}

function writeMosaicDirtyRegion(context, imageData, dirty) {
    context.putImageData(imageData, 0, 0, dirty.leftPx, dirty.topPx, dirty.widthPx, dirty.heightPx);
}
function copyMosaicImagePresentation(source, target, transient) {
    target.set({
        left: source.left,
        top: source.top,
        originX: source.originX,
        originY: source.originY,
        scaleX: source.scaleX,
        scaleY: source.scaleY,
        angle: source.angle,
        skewX: source.skewX,
        skewY: source.skewY,
        flipX: source.flipX,
        flipY: source.flipY,
        opacity: source.opacity,
        visible: source.visible,
        selectable: transient ? false : source.selectable,
        evented: transient ? false : source.evented,
        hasControls: transient ? false : source.hasControls,
        hoverCursor: source.hoverCursor,
        excludeFromExport: transient ? true : source.excludeFromExport,
        backgroundColor: source.backgroundColor,
        objectCaching: transient ? false : source.objectCaching,
    });
    target.setCoords();
}
function createMosaicRasterCache(source) {
    var _a;
    const widthPx = Number(source.width);
    const heightPx = Number(source.height);
    if (!Number.isSafeInteger(widthPx) ||
        !Number.isSafeInteger(heightPx) ||
        widthPx <= 0 ||
        heightPx <= 0) {
        throw new MosaicValidationError('Mosaic source dimensions are invalid.');
    }
    const element = source.getElement();
    const ownerDocument = (_a = element.ownerDocument) !== null && _a !== void 0 ? _a : globalThis.document;
    if (!ownerDocument) {
        throw new MosaicValidationError('Mosaic rendering document is unavailable.');
    }
    const surface = ownerDocument.createElement('canvas');
    surface.width = widthPx;
    surface.height = heightPx;
    const context = surface.getContext('2d');
    if (!context)
        throw new MosaicValidationError('Mosaic rendering context is unavailable.');
    context.drawImage(element, 0, 0, widthPx, heightPx);
    let imageData;
    try {
        imageData = context.getImageData(0, 0, widthPx, heightPx);
    }
    catch {
        throw new MosaicValidationError('Mosaic source pixels could not be read.');
    }
    return Object.freeze({ surface, context, imageData, widthPx, heightPx });
}
function createMosaicPreviewImage(fabric, source, cache) {
    const preview = new fabric.FabricImage(cache.surface, {
        selectable: false,
        evented: false,
        hasControls: false,
        excludeFromExport: true,
        objectCaching: false,
    });
    copyMosaicImagePresentation(source, preview, true);
    return preview;
}
function disposeMosaicRasterCache(cache) {
    if (!cache)
        return;
    cache.surface.width = 0;
    cache.surface.height = 0;
}

function isRecord$1(value) {
    if (typeof value !== 'object' || value === null || Array.isArray(value))
        return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}
function normalizeMosaicCommitOptions(value, configuration, sourceMimeType) {
    var _a, _b;
    if (value !== undefined && !isRecord$1(value)) {
        throw new MosaicValidationError('Mosaic commit options must be an object.');
    }
    const record = (value !== null && value !== void 0 ? value : {});
    const allowedKeys = new Set(['format', 'quality', 'bakeVisibleFilters']);
    if (Object.keys(record).some((key) => !allowedKeys.has(key))) {
        throw new MosaicValidationError('Mosaic commit options contain unknown keys.');
    }
    const requestedFormat = (_a = record.format) !== null && _a !== void 0 ? _a : configuration.format;
    if (requestedFormat !== 'source' &&
        requestedFormat !== 'png' &&
        requestedFormat !== 'jpeg' &&
        requestedFormat !== 'webp') {
        throw new MosaicValidationError('Mosaic output format is invalid.');
    }
    const sourceFormat = sourceMimeType === 'image/jpeg' ? 'jpeg' : sourceMimeType === 'image/webp' ? 'webp' : 'png';
    const format = requestedFormat === 'source' ? sourceFormat : requestedFormat;
    const quality = (_b = record.quality) !== null && _b !== void 0 ? _b : configuration.quality;
    if (typeof quality !== 'number' || !Number.isFinite(quality) || quality < 0 || quality > 1) {
        throw new MosaicValidationError('Mosaic output quality must be within [0, 1].');
    }
    if (record.bakeVisibleFilters !== undefined && typeof record.bakeVisibleFilters !== 'boolean') {
        throw new MosaicValidationError('bakeVisibleFilters must be a boolean.');
    }
    return Object.freeze({
        format,
        quality: format === 'png' ? undefined : quality,
        mimeType: format === 'jpeg' ? 'image/jpeg' : `image/${format}`,
        bakeVisibleFilters: record.bakeVisibleFilters !== false,
    });
}
function encodedBytes(dataUrl, expectedMimeType) {
    const commaIndex = dataUrl.indexOf(',');
    if (commaIndex < 0 || !/;base64$/i.test(dataUrl.slice(0, commaIndex))) {
        throw new MosaicValidationError('Mosaic output is not a base64 Data URL.');
    }
    const mimeType = dataUrl.slice(5, dataUrl.indexOf(';'));
    if (mimeType !== expectedMimeType) {
        throw new MosaicValidationError(`Mosaic encoder returned ${mimeType || 'an unknown MIME'} instead of ${expectedMimeType}.`);
    }
    const payload = dataUrl.slice(commaIndex + 1);
    const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0;
    return Math.floor((payload.length * 3) / 4) - padding;
}
async function decodeMosaicImage(fabric, dataUrl, timeoutMs, signal) {
    var _a;
    const controller = new AbortController();
    const abort = () => controller.abort(signal.reason);
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted)
        abort();
    const timeout = setTimeout(() => controller.abort(new MosaicValidationError('Mosaic decode timed out.')), timeoutMs);
    try {
        return await fabric.FabricImage.fromURL(dataUrl, {
            crossOrigin: 'anonymous',
            signal: controller.signal,
        });
    }
    catch (error) {
        if (controller.signal.aborted)
            throw (_a = controller.signal.reason) !== null && _a !== void 0 ? _a : error;
        throw new MosaicValidationError('Mosaic decode failed.');
    }
    finally {
        clearTimeout(timeout);
        signal.removeEventListener('abort', abort);
    }
}
async function renderMosaicImage(host, source, cache, options, signal) {
    const policy = host.getImageResourcePolicy();
    if (cache.widthPx > policy.maxExportDimension ||
        cache.heightPx > policy.maxExportDimension ||
        cache.widthPx * cache.heightPx > Math.min(policy.maxInputPixels, policy.maxExportPixels)) {
        throw new MosaicValidationError('Mosaic dimensions exceed the Core resource policy.');
    }
    cache.context.putImageData(cache.imageData, 0, 0);
    if (signal.aborted)
        throw signal.reason;
    const dataUrl = cache.surface.toDataURL(options.mimeType, options.quality);
    if (encodedBytes(dataUrl, options.mimeType) > policy.maxInputBytes) {
        throw new MosaicValidationError('Mosaic output exceeds the Core input budget.');
    }
    const image = await decodeMosaicImage(host.fabric, dataUrl, policy.imageLoadTimeoutMs, signal);
    try {
        if (image.width !== cache.widthPx || image.height !== cache.heightPx) {
            throw new MosaicValidationError('Mosaic dimensions changed during decode.');
        }
        copyMosaicImagePresentation(source, image, false);
        image.set({ selectable: false, evented: false, hasControls: false });
        image.setCoords();
        return Object.freeze({ image, mimeType: options.mimeType });
    }
    catch (error) {
        image.dispose();
        throw error;
    }
}

const defaultConfiguration = Object.freeze({
    brushSizePx: 24,
    pixelBlockSizePx: 8,
    format: 'source',
    quality: 0.92,
    maxPointCount: 4096,
});
function isRecord(value) {
    if (typeof value !== 'object' || value === null || Array.isArray(value))
        return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}
function normalizeConfiguration(current, patch) {
    var _a, _b, _c, _d, _e;
    if (!isRecord(patch)) {
        throw new MosaicValidationError('Mosaic configuration patch must be an object.');
    }
    const allowedKeys = new Set([
        'brushSizePx',
        'pixelBlockSizePx',
        'format',
        'quality',
        'maxPointCount',
    ]);
    if (Object.keys(patch).some((key) => !allowedKeys.has(key))) {
        throw new MosaicValidationError('Mosaic configuration contains unknown keys.');
    }
    const brushSizePx = (_a = patch.brushSizePx) !== null && _a !== void 0 ? _a : current.brushSizePx;
    const pixelBlockSizePx = (_b = patch.pixelBlockSizePx) !== null && _b !== void 0 ? _b : current.pixelBlockSizePx;
    const format = (_c = patch.format) !== null && _c !== void 0 ? _c : current.format;
    const quality = (_d = patch.quality) !== null && _d !== void 0 ? _d : current.quality;
    const maxPointCount = (_e = patch.maxPointCount) !== null && _e !== void 0 ? _e : current.maxPointCount;
    if (typeof brushSizePx !== 'number' ||
        !Number.isFinite(brushSizePx) ||
        brushSizePx < 1 ||
        brushSizePx > 4096) {
        throw new MosaicValidationError('Mosaic brushSizePx must be within [1, 4096].');
    }
    if (typeof pixelBlockSizePx !== 'number' ||
        !Number.isSafeInteger(pixelBlockSizePx) ||
        pixelBlockSizePx < 1 ||
        pixelBlockSizePx > 1024) {
        throw new MosaicValidationError('Mosaic pixelBlockSizePx must be within [1, 1024].');
    }
    if (format !== 'source' && format !== 'png' && format !== 'jpeg' && format !== 'webp') {
        throw new MosaicValidationError('Mosaic format is invalid.');
    }
    if (typeof quality !== 'number' || !Number.isFinite(quality) || quality < 0 || quality > 1) {
        throw new MosaicValidationError('Mosaic quality must be within [0, 1].');
    }
    if (typeof maxPointCount !== 'number' ||
        !Number.isSafeInteger(maxPointCount) ||
        maxPointCount < 1 ||
        maxPointCount > 100000) {
        throw new MosaicValidationError('Mosaic maxPointCount must be within [1, 100000].');
    }
    return Object.freeze({
        brushSizePx,
        pixelBlockSizePx,
        format,
        quality,
        maxPointCount,
    });
}
function resolveMosaicConfiguration(options) {
    return normalizeConfiguration(defaultConfiguration, options);
}
function cloneDirtyRectangle(rectangle) {
    return rectangle ? Object.freeze({ ...rectangle }) : null;
}
function cloneSessionState(state) {
    return Object.freeze({
        ...state,
        dirtyRectangle: cloneDirtyRectangle(state.dirtyRectangle),
        configuration: Object.freeze({ ...state.configuration }),
    });
}
function replayStroke(cache, stroke, configuration) {
    let dirty = null;
    let previous = null;
    for (const point of stroke) {
        const points = previous
            ? interpolateMosaicPoints(previous, point, configuration.brushSizePx / 2)
            : [point];
        for (const interpolated of points) {
            dirty = mergeDirtyRectangles(dirty, applyCircularMosaic(cache.imageData, {
                ...interpolated,
                radiusPx: configuration.brushSizePx / 2,
                blockSizePx: configuration.pixelBlockSizePx,
            }));
        }
        previous = point;
    }
    return dirty;
}
class MosaicController {
    constructor(host, geometry, raster, visibleRasterBake, visibleRasterBakeStatus, configuration) {
        Object.defineProperty(this, "host", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: host
        });
        Object.defineProperty(this, "geometry", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: geometry
        });
        Object.defineProperty(this, "raster", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: raster
        });
        Object.defineProperty(this, "visibleRasterBake", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: visibleRasterBake
        });
        Object.defineProperty(this, "visibleRasterBakeStatus", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: visibleRasterBakeStatus
        });
        Object.defineProperty(this, "configuration", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "session", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "listeners", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Set()
        });
        Object.defineProperty(this, "mutationSequence", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "disposed", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        this.configuration = configuration;
    }
    get isActive() {
        return this.session !== null;
    }
    getConfiguration() {
        this.assertActive('read Mosaic configuration');
        return this.configuration;
    }
    configure(patch) {
        this.assertActive('configure Mosaic');
        this.configuration = normalizeConfiguration(this.configuration, patch);
        this.emitStatus();
    }
    getSession() {
        this.assertActive('read the Mosaic session');
        return this.session ? cloneSessionState(this.session.state) : null;
    }
    subscribe(listener) {
        this.assertActive('subscribe to Mosaic status');
        if (typeof listener !== 'function') {
            throw new TypeError('[ImageEditor] Mosaic status listener must be a function.');
        }
        this.listeners.add(listener);
        return disposable.createDisposable(() => {
            this.listeners.delete(listener);
        });
    }
    enter(options = {}) {
        this.assertActive('enter Mosaic');
        if (this.session)
            throw new MosaicSessionError('Mosaic is already active.');
        if (!this.host.isImageLoaded()) {
            throw new MosaicSessionError('Mosaic requires a loaded image.');
        }
        if (!isRecord(options)) {
            throw new MosaicValidationError('Mosaic enter options must be an object.');
        }
        if (Object.keys(options).some((key) => key !== 'configuration')) {
            throw new MosaicValidationError('Mosaic enter options contain unknown keys.');
        }
        const configuration = options.configuration
            ? normalizeConfiguration(this.configuration, options.configuration)
            : this.configuration;
        const source = this.requireBaseImage();
        const cache = createMosaicRasterCache(source);
        this.assertCachePolicy(cache);
        const preview = createMosaicPreviewImage(this.host.fabric, source, cache);
        const canvas = this.host.requireCanvas('enter Mosaic');
        canvas.add(preview);
        const sourceIndex = canvas.getObjects().indexOf(source);
        canvas.moveObjectTo(preview, Math.max(0, sourceIndex + 1));
        const state = Object.freeze({
            sourceRevision: this.host.getGeometryRevision(),
            sourceWidthPx: cache.widthPx,
            sourceHeightPx: cache.heightPx,
            strokeCount: 0,
            pointCount: 0,
            isStrokeActive: false,
            dirtyRectangle: null,
            configuration,
        });
        this.session = {
            state,
            cache,
            preview,
            strokes: [],
            activeStrokeIndex: null,
        };
        this.host.requestRender();
        this.emitStatus();
    }
    beginStroke(value) {
        const session = this.requireSession('begin a Mosaic stroke');
        this.assertSourceCurrent(session);
        if (session.activeStrokeIndex !== null) {
            throw new MosaicSessionError('A Mosaic stroke is already active.');
        }
        const point = this.normalizePoint(value, session);
        this.assertPointBudget(session);
        session.strokes.push([point]);
        session.activeStrokeIndex = session.strokes.length - 1;
        this.applyPreviewPoints(session, [point]);
        this.updateSessionState(session, true);
    }
    appendStroke(value) {
        const session = this.requireSession('append a Mosaic stroke');
        this.assertSourceCurrent(session);
        const strokeIndex = session.activeStrokeIndex;
        if (strokeIndex === null) {
            throw new MosaicSessionError('Mosaic appendStroke requires an active stroke.');
        }
        const stroke = session.strokes[strokeIndex];
        const point = this.normalizePoint(value, session);
        this.assertPointBudget(session);
        const previous = stroke[stroke.length - 1];
        stroke.push(point);
        this.applyPreviewPoints(session, interpolateMosaicPoints(previous, point, session.state.configuration.brushSizePx / 2));
        this.updateSessionState(session, true);
    }
    endStroke() {
        const session = this.requireSession('end a Mosaic stroke');
        if (session.activeStrokeIndex === null) {
            throw new MosaicSessionError('Mosaic endStroke requires an active stroke.');
        }
        session.activeStrokeIndex = null;
        this.updateSessionState(session, false);
    }
    cancel() {
        this.assertActive('cancel Mosaic');
        if (this.session)
            this.closeSession();
    }
    async commit(options) {
        var _a, _b;
        const session = this.requireSession('commit Mosaic');
        this.assertSourceCurrent(session);
        if (session.activeStrokeIndex !== null) {
            throw new MosaicSessionError('End the active Mosaic stroke before commit.');
        }
        const normalizedOptions = normalizeMosaicCommitOptions(options, session.state.configuration, (_b = (_a = this.host.getImageInfo()) === null || _a === void 0 ? void 0 : _a.mimeType) !== null && _b !== void 0 ? _b : null);
        const strokes = Object.freeze(session.strokes.map((stroke) => Object.freeze(stroke.map((point) => Object.freeze({ ...point })))));
        const state = session.state;
        this.closeSession();
        if (state.pointCount === 0)
            return;
        const mutationId = `mosaic:commit:${++this.mutationSequence}`;
        const resources = { cache: null, replacement: null, replacedSource: null };
        let committed = false;
        try {
            await this.geometry.run({
                id: mutationId,
                kind: 'raster-replace',
                operationId: 'mosaic:commit',
                targetSize: { width: state.sourceWidthPx, height: state.sourceHeightPx },
                metadata: Object.freeze({
                    sourceRevision: state.sourceRevision,
                    strokeCount: state.strokeCount,
                    pointCount: state.pointCount,
                    dirtyRectangle: state.dirtyRectangle,
                    bakeVisibleFilters: normalizedOptions.bakeVisibleFilters,
                }),
                mutateBase: async ({ transaction, signal }) => {
                    var _a;
                    if (normalizedOptions.bakeVisibleFilters &&
                        this.visibleRasterBakeStatus === 'incompatible') {
                        throw new MosaicIntegrationError('The installed visible-raster bake provider is incompatible.');
                    }
                    if (normalizedOptions.bakeVisibleFilters &&
                        ((_a = this.visibleRasterBake) === null || _a === void 0 ? void 0 : _a.hasVisibleState())) {
                        await this.visibleRasterBake.bakeIntoBase(transaction);
                    }
                    this.assertSourceDimensions(state);
                    const source = this.requireBaseImage();
                    const cache = createMosaicRasterCache(source);
                    resources.cache = cache;
                    this.assertCachePolicy(cache);
                    for (const stroke of strokes) {
                        replayStroke(cache, stroke, state.configuration);
                    }
                    const rendered = await renderMosaicImage(this.host, source, cache, normalizedOptions, signal);
                    resources.replacement = rendered.image;
                    resources.replacedSource = source;
                    this.raster.replaceBaseImage(transaction, rendered.image, {
                        baseScale: this.host.getBaseImageScale(),
                        mimeType: rendered.mimeType,
                    });
                    this.validateBaseImage(rendered.image, state);
                },
            });
            committed = true;
            if (resources.replacedSource && resources.replacedSource !== this.host.getBaseImage()) {
                resources.replacedSource.dispose();
            }
        }
        finally {
            disposeMosaicRasterCache(resources.cache);
            if (!committed &&
                resources.replacement &&
                this.host.getBaseImage() !== resources.replacement) {
                resources.replacement.dispose();
            }
        }
    }
    ownsPreview(object) {
        var _a;
        return ((_a = this.session) === null || _a === void 0 ? void 0 : _a.preview) === object;
    }
    closeForImage() {
        if (this.session)
            this.closeSession();
    }
    dispose() {
        if (this.disposed)
            return;
        if (this.session)
            this.closeSession();
        this.listeners.clear();
        this.disposed = true;
    }
    applyPreviewPoints(session, points) {
        let dirty = null;
        for (const point of points) {
            dirty = mergeDirtyRectangles(dirty, applyCircularMosaic(session.cache.imageData, {
                ...point,
                radiusPx: session.state.configuration.brushSizePx / 2,
                blockSizePx: session.state.configuration.pixelBlockSizePx,
            }));
        }
        if (!dirty)
            return;
        writeMosaicDirtyRegion(session.cache.context, session.cache.imageData, dirty);
        session.preview.dirty = true;
        session.state = Object.freeze({
            ...session.state,
            dirtyRectangle: mergeDirtyRectangles(session.state.dirtyRectangle, dirty),
        });
        this.host.requestRender();
    }
    updateSessionState(session, isStrokeActive) {
        const pointCount = session.strokes.reduce((count, stroke) => count + stroke.length, 0);
        session.state = Object.freeze({
            ...session.state,
            strokeCount: session.strokes.length,
            pointCount,
            isStrokeActive,
        });
        this.emitStatus();
    }
    normalizePoint(value, session) {
        if (!isRecord(value))
            throw new MosaicValidationError('Mosaic point must be an object.');
        if (Object.keys(value).some((key) => key !== 'xPx' && key !== 'yPx')) {
            throw new MosaicValidationError('Mosaic point contains unknown keys.');
        }
        const xPx = value.xPx;
        const yPx = value.yPx;
        if (typeof xPx !== 'number' ||
            typeof yPx !== 'number' ||
            !Number.isFinite(xPx) ||
            !Number.isFinite(yPx) ||
            xPx < 0 ||
            yPx < 0 ||
            xPx >= session.state.sourceWidthPx ||
            yPx >= session.state.sourceHeightPx) {
            throw new MosaicValidationError('Mosaic point must be finite and within natural image bounds.');
        }
        return Object.freeze({ xPx, yPx });
    }
    assertPointBudget(session) {
        const pointCount = session.strokes.reduce((count, stroke) => count + stroke.length, 0);
        if (pointCount >= session.state.configuration.maxPointCount) {
            throw new MosaicValidationError('Mosaic point count exceeds maxPointCount.');
        }
    }
    closeSession() {
        const session = this.session;
        if (!session)
            return;
        this.session = null;
        const canvas = this.host.getCanvas();
        if (canvas === null || canvas === void 0 ? void 0 : canvas.getObjects().includes(session.preview))
            canvas.remove(session.preview);
        session.preview.dispose();
        disposeMosaicRasterCache(session.cache);
        this.host.requestRender();
        this.emitStatus();
    }
    requireSession(operation) {
        this.assertActive(operation);
        if (!this.session) {
            throw new MosaicSessionError(`Cannot ${operation} without an active Mosaic session.`);
        }
        return this.session;
    }
    requireBaseImage() {
        const baseImage = this.host.getBaseImage();
        if (!baseImage)
            throw new MosaicSessionError('Mosaic requires a loaded image.');
        return baseImage;
    }
    assertSourceCurrent(session) {
        if (!this.host.isImageLoaded() ||
            this.host.getGeometryRevision() !== session.state.sourceRevision) {
            throw new MosaicSessionError('Mosaic source revision is stale.');
        }
        this.assertSourceDimensions(session.state);
    }
    assertSourceDimensions(state) {
        const baseImage = this.requireBaseImage();
        if (Number(baseImage.width) !== state.sourceWidthPx ||
            Number(baseImage.height) !== state.sourceHeightPx) {
            throw new MosaicSessionError('Mosaic source dimensions changed during the session.');
        }
    }
    assertCachePolicy(cache) {
        const policy = this.host.getImageResourcePolicy();
        if (cache.widthPx > policy.maxExportDimension ||
            cache.heightPx > policy.maxExportDimension ||
            cache.widthPx * cache.heightPx > Math.min(policy.maxInputPixels, policy.maxExportPixels)) {
            disposeMosaicRasterCache(cache);
            throw new MosaicValidationError('Mosaic dimensions exceed the Core resource policy.');
        }
    }
    validateBaseImage(image, state) {
        const canvas = this.host.requireCanvas('validate Mosaic');
        const baseImages = canvas
            .getObjects()
            .filter((object) => object
            .editorObjectKind === 'baseImage');
        if (this.host.getBaseImage() !== image ||
            baseImages.length !== 1 ||
            baseImages[0] !== image ||
            canvas.getObjects()[0] !== image ||
            image.width !== state.sourceWidthPx ||
            image.height !== state.sourceHeightPx ||
            image.selectable !== false ||
            image.evented !== false) {
            throw new MosaicValidationError('Mosaic violated the Base Image invariant.');
        }
    }
    status() {
        return Object.freeze({
            isActive: this.isActive,
            session: this.session ? cloneSessionState(this.session.state) : null,
        });
    }
    emitStatus() {
        if (this.disposed || this.listeners.size === 0)
            return;
        const status = this.status();
        for (const listener of [...this.listeners]) {
            try {
                listener(status);
            }
            catch (error) {
                this.host.reportWarning(error, 'A Mosaic status listener failed.');
            }
        }
    }
    assertActive(operation) {
        if (this.disposed || this.host.isDisposed()) {
            throw new MosaicSessionError(`Cannot ${operation} after Mosaic disposal.`);
        }
    }
}

const MOSAIC_TOOL_ID = 'plugin:mosaic';
const mosaicPreviewDomains = ['base-image', 'overlay', 'selection', 'state'];
const mosaicMutationDomains = [
    'document',
    'base-image',
    'geometry',
    'raster',
    'overlay',
    'selection',
    'state',
];
const mosaicPluginRef = pluginManifest.definePluginRef('plugin:mosaic', '1.0.0');
function mosaicPlugin(options = {}) {
    const configuration = resolveMosaicConfiguration(options);
    let controller = null;
    return pluginDefinition.definePlugin({
        ref: mosaicPluginRef,
        manifest: {
            id: mosaicPluginRef.id,
            version: '1.0.0',
            apiVersion: mosaicPluginRef.apiVersion,
            engine: '^3.0.0',
            requires: [
                { token: coreCapabilities.CORE_STATUS_CAPABILITY, range: '^1.0.0' },
                { token: coreCapabilities.CORE_DIAGNOSTICS_CAPABILITY, range: '^1.0.0' },
                { token: coreCapabilities.FABRIC_RUNTIME_CAPABILITY, range: '^1.0.0' },
                { token: coreCapabilities.CANVAS_READ_CAPABILITY, range: '^1.0.0' },
                { token: coreCapabilities.BASE_IMAGE_READ_CAPABILITY, range: '^1.0.0' },
                { token: coreCapabilities.IMAGE_RESOURCE_POLICY_CAPABILITY, range: '^1.0.0' },
                { token: coreCapabilities.RENDER_REQUEST_CAPABILITY, range: '^1.0.0' },
                { token: coreCapabilities.RASTER_MUTATION_CAPABILITY, range: '^1.0.0' },
                { token: coreCapabilities.SNAPSHOT_REGISTRATION_CAPABILITY, range: '^1.0.0' },
                { token: coreCapabilities.GEOMETRY_MUTATION_CAPABILITY, range: '^1.0.0' },
            ],
            optional: [{ token: visibleRasterBake.VISIBLE_RASTER_BAKE_CAPABILITY, range: '^1.0.0' }],
            permissions: [
                'fabric:objects',
                'fabric:canvas-read',
                'core:raster-mutation',
                'core:geometry-participant',
            ],
        },
        setupMode: 'sync',
        setup(context) {
            const status = context.capabilities.require(coreCapabilities.CORE_STATUS_CAPABILITY);
            const diagnostics = context.capabilities.require(coreCapabilities.CORE_DIAGNOSTICS_CAPABILITY);
            const fabricRuntime = context.capabilities.require(coreCapabilities.FABRIC_RUNTIME_CAPABILITY);
            const canvas = context.capabilities.require(coreCapabilities.CANVAS_READ_CAPABILITY);
            const baseImage = context.capabilities.require(coreCapabilities.BASE_IMAGE_READ_CAPABILITY);
            const resourcePolicy = context.capabilities.require(coreCapabilities.IMAGE_RESOURCE_POLICY_CAPABILITY);
            const render = context.capabilities.require(coreCapabilities.RENDER_REQUEST_CAPABILITY);
            const raster = context.capabilities.require(coreCapabilities.RASTER_MUTATION_CAPABILITY);
            const snapshots = context.capabilities.require(coreCapabilities.SNAPSHOT_REGISTRATION_CAPABILITY);
            const geometry = context.capabilities.require(coreCapabilities.GEOMETRY_MUTATION_CAPABILITY);
            const visibleRasterBake$1 = context.capabilities.optional(visibleRasterBake.VISIBLE_RASTER_BAKE_CAPABILITY);
            controller = new MosaicController(Object.freeze({
                ...status,
                ...diagnostics,
                ...fabricRuntime,
                ...canvas,
                ...baseImage,
                ...resourcePolicy,
                ...render,
            }), geometry, raster, visibleRasterBake$1, context.capabilities.getOptionalStatus(visibleRasterBake.VISIBLE_RASTER_BAKE_CAPABILITY), configuration);
            const requireController = () => {
                if (!controller)
                    throw new Error('Mosaic Plugin is not installed.');
                return controller;
            };
            for (const operationId of [
                'mosaic:enter',
                'mosaic:begin-stroke',
                'mosaic:append-stroke',
                'mosaic:end-stroke',
                'mosaic:cancel',
                'mosaic:configure',
            ]) {
                context.disposables.add(context.operations.register({
                    id: operationId,
                    mode: 'busy',
                    conflictDomains: mosaicPreviewDomains,
                    reentrancy: 'queue',
                }));
            }
            context.disposables.add(context.operations.register({
                id: 'mosaic:commit',
                mode: 'mutation',
                conflictDomains: mosaicMutationDomains,
                reentrancy: 'queue',
            }));
            context.disposables.add(context.tools.register({
                id: MOSAIC_TOOL_ID,
                enter: () => undefined,
                exit: () => {
                    if (controller === null || controller === void 0 ? void 0 : controller.isActive)
                        controller.cancel();
                },
                canRunOperation: (operationId) => operationId.startsWith('mosaic:') ||
                    operationId === 'crop:enter' ||
                    operationId === 'core:load-image' ||
                    operationId === 'core:commit-load-image' ||
                    operationId === 'core:load-state' ||
                    operationId === 'core:export',
            }));
            context.disposables.add(snapshots.registerTransientObject(mosaicPluginRef.id, (object) => { var _a; return (_a = controller === null || controller === void 0 ? void 0 : controller.ownsPreview(object)) !== null && _a !== void 0 ? _a : false; }));
            const runPreviewOperation = (operationId, value, task) => context.operations.run(operationId, value, (args) => task(requireController(), args));
            return Object.freeze({
                get isActive() {
                    return requireController().isActive;
                },
                enter: (enterOptions) => runPreviewOperation('mosaic:enter', enterOptions !== null && enterOptions !== void 0 ? enterOptions : {}, async (mosaic, value) => {
                    if (mosaic.isActive) {
                        mosaic.enter(value);
                        return;
                    }
                    await context.tools.enter(MOSAIC_TOOL_ID);
                    try {
                        mosaic.enter(value);
                    }
                    catch (error) {
                        await context.tools.exit('operation');
                        throw error;
                    }
                }),
                beginStroke: (point) => runPreviewOperation('mosaic:begin-stroke', point, (mosaic, value) => mosaic.beginStroke(value)),
                appendStroke: (point) => runPreviewOperation('mosaic:append-stroke', point, (mosaic, value) => mosaic.appendStroke(value)),
                endStroke: () => runPreviewOperation('mosaic:end-stroke', undefined, (mosaic) => mosaic.endStroke()),
                commit: async (commitOptions) => {
                    try {
                        await requireController().commit(commitOptions);
                    }
                    finally {
                        if (context.tools.getActiveToolId() === MOSAIC_TOOL_ID) {
                            await context.tools.exit('operation');
                        }
                    }
                },
                cancel: () => runPreviewOperation('mosaic:cancel', undefined, async (mosaic) => {
                    mosaic.cancel();
                    if (context.tools.getActiveToolId() === MOSAIC_TOOL_ID) {
                        await context.tools.exit('requested');
                    }
                }),
                configure: (patch) => runPreviewOperation('mosaic:configure', patch, (mosaic, value) => mosaic.configure(value)),
                getConfiguration: () => requireController().getConfiguration(),
                getSession: () => requireController().getSession(),
                subscribe: (listener) => requireController().subscribe(listener),
            });
        },
        onImageCleared(context) {
            if (context.tools.getActiveToolId() === MOSAIC_TOOL_ID) {
                return context.tools.exit('operation');
            }
            controller === null || controller === void 0 ? void 0 : controller.closeForImage();
            return undefined;
        },
        onDispose() {
            controller === null || controller === void 0 ? void 0 : controller.dispose();
            controller = null;
        },
    });
}

exports.MosaicError = MosaicError;
exports.MosaicIntegrationError = MosaicIntegrationError;
exports.MosaicSessionError = MosaicSessionError;
exports.MosaicValidationError = MosaicValidationError;
exports.mosaicPlugin = mosaicPlugin;
exports.mosaicPluginRef = mosaicPluginRef;
//# sourceMappingURL=index.cjs.map
