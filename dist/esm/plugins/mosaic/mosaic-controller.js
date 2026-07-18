import { createDisposable, } from '../../sdk/index.js';
import { applyCircularMosaic, interpolateMosaicPoints, mergeDirtyRectangles, } from './mosaic-brush.js';
import { MosaicIntegrationError, MosaicSessionError, MosaicValidationError, } from './mosaic-errors.js';
import { createMosaicPreviewImage, createMosaicRasterCache, disposeMosaicRasterCache, writeMosaicDirtyRegion, } from './mosaic-raster-cache.js';
import { normalizeMosaicCommitOptions, renderMosaicImage } from './mosaic-renderer.js';
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
export function resolveMosaicConfiguration(options) {
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
export class MosaicController {
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
        return createDisposable(() => {
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
//# sourceMappingURL=mosaic-controller.js.map