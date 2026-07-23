import { createDisposable, observePromise, } from '../../sdk/index.js';
import { CropIntegrationError, CropSessionError, CropValidationError } from './crop-errors.js';
import { fitCropRectToAspectRatio, normalizeCropAspectRatio, normalizeCropRect, } from './crop-geometry.js';
import { applyCropOverlayPolicy, findCropOverlayCandidates, normalizeCropOverlayPolicy, } from './crop-overlay-policy.js';
import { normalizeCropApplyOptions, renderCropImage } from './crop-renderer.js';
const EMPTY_CANDIDATES = Object.freeze({
    allIds: Object.freeze([]),
    intersectingIds: Object.freeze([]),
});
function positiveSafeInteger(value, fallback, label) {
    if (value === undefined)
        return fallback;
    if (!Number.isSafeInteger(value) || Number(value) <= 0) {
        throw new CropValidationError(`${label} must be a positive safe integer.`);
    }
    return Number(value);
}
function nonNegativeSafeInteger(value, fallback, label) {
    if (value === undefined)
        return fallback;
    if (!Number.isSafeInteger(value) || Number(value) < 0) {
        throw new CropValidationError(`${label} must be a non-negative safe integer.`);
    }
    return Number(value);
}
export function resolveCropConfiguration(options) {
    if (typeof options !== 'object' || options === null || Array.isArray(options)) {
        throw new CropValidationError('Crop Plugin options must be an object.');
    }
    const allowedKeys = new Set(['paddingPx', 'minimumWidthPx', 'minimumHeightPx']);
    if (Object.keys(options).some((key) => !allowedKeys.has(key))) {
        throw new CropValidationError('Crop Plugin options contain unknown keys.');
    }
    return Object.freeze({
        paddingPx: nonNegativeSafeInteger(options.paddingPx, 10, 'Crop paddingPx'),
        minimumWidthPx: positiveSafeInteger(options.minimumWidthPx, 1, 'Crop minimumWidthPx'),
        minimumHeightPx: positiveSafeInteger(options.minimumHeightPx, 1, 'Crop minimumHeightPx'),
    });
}
function cloneSessionState(state) {
    return Object.freeze({
        ...state,
        rect: Object.freeze({ ...state.rect }),
        overlayPolicy: Object.freeze({
            ...state.overlayPolicy,
            ...(state.overlayPolicy.kinds
                ? { kinds: Object.freeze([...state.overlayPolicy.kinds]) }
                : {}),
        }),
    });
}
function isRecord(value) {
    if (typeof value !== 'object' || value === null || Array.isArray(value))
        return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}
export class CropController {
    constructor(host, geometry, raster, overlay, visibleRasterBake, visibleRasterBakeStatus, configuration) {
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
        Object.defineProperty(this, "overlay", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: overlay
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
            value: configuration
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
    }
    get isActive() {
        return this.session !== null;
    }
    getSession() {
        this.assertActive('read the Crop session');
        return this.session ? cloneSessionState(this.session.state) : null;
    }
    subscribe(listener) {
        this.assertActive('subscribe to Crop status');
        if (typeof listener !== 'function') {
            throw new TypeError('[ImageEditor] Crop status listener must be a function.');
        }
        this.listeners.add(listener);
        return createDisposable(() => {
            this.listeners.delete(listener);
        });
    }
    enter(options = {}) {
        var _a, _b, _c;
        this.assertActive('enter Crop');
        if (this.session)
            throw new CropSessionError('Crop is already active.');
        if (!this.host.isImageLoaded()) {
            throw new CropSessionError('Crop requires a loaded image.');
        }
        if (!isRecord(options))
            throw new CropValidationError('Crop enter options must be an object.');
        const allowedKeys = new Set(['rect', 'aspectRatio', 'overlayPolicy']);
        if (Object.keys(options).some((key) => !allowedKeys.has(key))) {
            throw new CropValidationError('Crop enter options contain unknown keys.');
        }
        const baseImage = this.requireBaseImage();
        const widthPx = Number(baseImage.width);
        const heightPx = Number(baseImage.height);
        if (!Number.isSafeInteger(widthPx) ||
            !Number.isSafeInteger(heightPx) ||
            widthPx <= 0 ||
            heightPx <= 0) {
            throw new CropValidationError('Base Image dimensions are invalid for Crop.');
        }
        if (this.configuration.minimumWidthPx > widthPx ||
            this.configuration.minimumHeightPx > heightPx) {
            throw new CropValidationError('Crop minimum dimensions exceed the Base Image.');
        }
        const limits = {
            widthPx,
            heightPx,
            minimumWidthPx: this.configuration.minimumWidthPx,
            minimumHeightPx: this.configuration.minimumHeightPx,
        };
        const padding = Math.min(this.configuration.paddingPx, Math.floor((widthPx - this.configuration.minimumWidthPx) / 2), Math.floor((heightPx - this.configuration.minimumHeightPx) / 2));
        const aspectRatio = normalizeCropAspectRatio(options.aspectRatio);
        let rect = normalizeCropRect((_a = options.rect) !== null && _a !== void 0 ? _a : {
            leftPx: padding,
            topPx: padding,
            widthPx: widthPx - padding * 2,
            heightPx: heightPx - padding * 2,
        }, limits);
        if (aspectRatio !== null) {
            rect = normalizeCropRect(fitCropRectToAspectRatio(rect, aspectRatio, { widthPx, heightPx }), limits);
        }
        const overlayPolicy = normalizeCropOverlayPolicy(options.overlayPolicy);
        const preview = this.createPreview(baseImage, rect);
        const canvas = this.host.requireCanvas('enter Crop');
        canvas.add(preview);
        canvas.bringObjectToFront(preview);
        const state = Object.freeze({
            rect,
            aspectRatio,
            sourceRevision: this.host.getGeometryRevision(),
            sourceWidthPx: widthPx,
            sourceHeightPx: heightPx,
            overlayPolicy,
        });
        this.session = {
            state,
            preview,
            previewVisibility: null,
            candidates: EMPTY_CANDIDATES,
            selectionIds: (_c = (_b = this.overlay) === null || _b === void 0 ? void 0 : _b.getSelection().ids) !== null && _c !== void 0 ? _c : Object.freeze([]),
        };
        this.refreshPreview(this.session);
        this.emitStatus();
    }
    updateRect(value) {
        const session = this.requireSession('update the Crop rect');
        this.assertSourceCurrent(session);
        const limits = this.limits(session);
        let rect = normalizeCropRect(value, limits);
        if (session.state.aspectRatio !== null) {
            rect = normalizeCropRect(fitCropRectToAspectRatio(rect, session.state.aspectRatio, {
                widthPx: session.state.sourceWidthPx,
                heightPx: session.state.sourceHeightPx,
            }), limits);
        }
        session.state = Object.freeze({ ...session.state, rect });
        this.refreshPreview(session);
        this.emitStatus();
    }
    setAspectRatio(value) {
        const session = this.requireSession('set the Crop aspect ratio');
        this.assertSourceCurrent(session);
        const aspectRatio = normalizeCropAspectRatio(value);
        let rect = session.state.rect;
        if (aspectRatio !== null) {
            rect = normalizeCropRect(fitCropRectToAspectRatio(rect, aspectRatio, {
                widthPx: session.state.sourceWidthPx,
                heightPx: session.state.sourceHeightPx,
            }), this.limits(session));
        }
        session.state = Object.freeze({ ...session.state, rect, aspectRatio });
        this.refreshPreview(session);
        this.emitStatus();
    }
    cancel() {
        this.assertActive('cancel Crop');
        if (!this.session)
            return;
        this.closeSession(true);
    }
    async apply(options) {
        var _a, _b;
        const session = this.requireSession('apply Crop');
        this.assertSourceCurrent(session);
        const normalizedOptions = normalizeCropApplyOptions(options, (_b = (_a = this.host.getImageInfo()) === null || _a === void 0 ? void 0 : _a.mimeType) !== null && _b !== void 0 ? _b : null);
        const rect = session.state.rect;
        const candidates = findCropOverlayCandidates(this.overlay, session.preview.getBoundingRect(), session.state.overlayPolicy);
        const state = session.state;
        const selectionIds = session.selectionIds;
        this.closeSession(true);
        const mutationId = `crop:apply:${++this.mutationSequence}`;
        const resources = { replacement: null, replacedSource: null };
        let committed = false;
        try {
            await this.geometry.run({
                id: mutationId,
                kind: 'crop',
                operationId: 'crop:apply',
                sourceRect: {
                    left: rect.leftPx,
                    top: rect.topPx,
                    width: rect.widthPx,
                    height: rect.heightPx,
                },
                targetSize: { width: rect.widthPx, height: rect.heightPx },
                metadata: Object.freeze({
                    sourceRevision: state.sourceRevision,
                    overlayPolicy: state.overlayPolicy.apply,
                    bakeVisibleFilters: normalizedOptions.bakeVisibleFilters,
                }),
                mutateBase: async ({ transaction, signal }) => {
                    var _a;
                    if (normalizedOptions.bakeVisibleFilters &&
                        this.visibleRasterBakeStatus === 'incompatible') {
                        throw new CropIntegrationError('The installed visible-raster bake provider is incompatible.');
                    }
                    if (normalizedOptions.bakeVisibleFilters &&
                        ((_a = this.visibleRasterBake) === null || _a === void 0 ? void 0 : _a.hasVisibleState())) {
                        await this.visibleRasterBake.bakeIntoBase(transaction);
                    }
                    this.assertSourceDimensions(state);
                    const source = this.requireBaseImage();
                    const rendered = await renderCropImage(this.host, source, rect, normalizedOptions, signal);
                    resources.replacement = rendered.image;
                    resources.replacedSource = source;
                    this.raster.replaceBaseImage(transaction, rendered.image, {
                        baseScale: this.host.getBaseImageScale(),
                        mimeType: rendered.mimeType,
                    });
                    await applyCropOverlayPolicy(this.overlay, this.host.requireCanvas('apply Crop overlay policy'), transaction, state.overlayPolicy, candidates, mutationId);
                    if (this.overlay) {
                        this.overlay.select(selectionIds.filter((id) => { var _a; return ((_a = this.overlay) === null || _a === void 0 ? void 0 : _a.getByPersistentId(id)) !== null; }));
                    }
                    this.validateBaseImage(rendered.image, rect);
                },
            });
            committed = true;
            if (resources.replacedSource && resources.replacedSource !== this.host.getBaseImage()) {
                resources.replacedSource.dispose();
            }
        }
        finally {
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
            this.closeSession(false);
    }
    dispose() {
        if (this.disposed)
            return;
        if (this.session)
            this.closeSession(false);
        this.listeners.clear();
        this.disposed = true;
    }
    createPreview(baseImage, rect) {
        const preview = new this.host.fabric.Rect({
            width: rect.widthPx,
            height: rect.heightPx,
            originX: 'center',
            originY: 'center',
            fill: 'rgba(0, 170, 255, 0.08)',
            stroke: '#00aaff',
            strokeWidth: 1,
            strokeDashArray: [6, 4],
            strokeUniform: true,
            selectable: false,
            evented: false,
            hasControls: false,
            excludeFromExport: true,
        });
        this.applyPreviewPresentation(baseImage, preview, rect);
        return preview;
    }
    applyPreviewPresentation(baseImage, preview, rect) {
        const matrix = baseImage.calcTransformMatrix();
        const offsetX = rect.leftPx + rect.widthPx / 2 - Number(baseImage.width) / 2;
        const offsetY = rect.topPx + rect.heightPx / 2 - Number(baseImage.height) / 2;
        preview.set({
            left: matrix[0] * offsetX + matrix[2] * offsetY + matrix[4],
            top: matrix[1] * offsetX + matrix[3] * offsetY + matrix[5],
            width: rect.widthPx,
            height: rect.heightPx,
            scaleX: baseImage.scaleX,
            scaleY: baseImage.scaleY,
            angle: baseImage.angle,
            skewX: baseImage.skewX,
            skewY: baseImage.skewY,
            flipX: baseImage.flipX,
            flipY: baseImage.flipY,
        });
        preview.setCoords();
    }
    refreshPreview(session) {
        const baseImage = this.requireBaseImage();
        this.applyPreviewPresentation(baseImage, session.preview, session.state.rect);
        const canvas = this.host.requireCanvas('refresh Crop preview');
        canvas.bringObjectToFront(session.preview);
        if (session.previewVisibility) {
            observePromise(Promise.resolve(session.previewVisibility.dispose()), (error) => {
                this.host.reportWarning(error, 'Crop preview visibility cleanup failed.');
            });
        }
        session.previewVisibility = null;
        session.candidates = findCropOverlayCandidates(this.overlay, session.preview.getBoundingRect(), session.state.overlayPolicy);
        if (this.overlay &&
            session.state.overlayPolicy.preview === 'hide-participating' &&
            session.candidates.intersectingIds.length > 0) {
            session.previewVisibility = this.overlay.hideForPreview(session.candidates.intersectingIds);
        }
        this.host.requestRender();
    }
    closeSession(restoreSelection) {
        const session = this.session;
        if (!session)
            return;
        this.session = null;
        if (session.previewVisibility) {
            observePromise(Promise.resolve(session.previewVisibility.dispose()), (error) => {
                this.host.reportWarning(error, 'Crop preview visibility cleanup failed.');
            });
        }
        const canvas = this.host.getCanvas();
        if (canvas === null || canvas === void 0 ? void 0 : canvas.getObjects().includes(session.preview))
            canvas.remove(session.preview);
        session.preview.dispose();
        if (restoreSelection && this.overlay) {
            try {
                const liveIds = session.selectionIds.filter((id) => { var _a; return ((_a = this.overlay) === null || _a === void 0 ? void 0 : _a.getByPersistentId(id)) !== null; });
                this.overlay.select(liveIds);
            }
            catch (error) {
                this.host.reportWarning(error, 'Crop could not restore the Overlay selection.');
            }
        }
        this.host.requestRender();
        this.emitStatus();
    }
    requireSession(operation) {
        this.assertActive(operation);
        if (!this.session)
            throw new CropSessionError(`Cannot ${operation} without an active Crop.`);
        return this.session;
    }
    requireBaseImage() {
        const baseImage = this.host.getBaseImage();
        if (!baseImage)
            throw new CropSessionError('Crop requires a loaded image.');
        return baseImage;
    }
    assertSourceCurrent(session) {
        if (!this.host.isImageLoaded() ||
            this.host.getGeometryRevision() !== session.state.sourceRevision) {
            throw new CropSessionError('Crop source revision is stale.');
        }
        this.assertSourceDimensions(session.state);
    }
    assertSourceDimensions(state) {
        const baseImage = this.requireBaseImage();
        if (Number(baseImage.width) !== state.sourceWidthPx ||
            Number(baseImage.height) !== state.sourceHeightPx) {
            throw new CropSessionError('Crop source dimensions changed during the session.');
        }
    }
    limits(session) {
        return {
            widthPx: session.state.sourceWidthPx,
            heightPx: session.state.sourceHeightPx,
            minimumWidthPx: this.configuration.minimumWidthPx,
            minimumHeightPx: this.configuration.minimumHeightPx,
        };
    }
    validateBaseImage(image, rect) {
        const canvas = this.host.requireCanvas('validate Crop');
        const baseImages = canvas
            .getObjects()
            .filter((object) => object
            .editorObjectKind === 'baseImage');
        if (this.host.getBaseImage() !== image ||
            baseImages.length !== 1 ||
            baseImages[0] !== image ||
            canvas.getObjects()[0] !== image ||
            image.width !== rect.widthPx ||
            image.height !== rect.heightPx ||
            image.selectable !== false ||
            image.evented !== false) {
            throw new CropValidationError('Crop violated the Base Image invariant.');
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
                this.host.reportWarning(error, 'A Crop status listener failed.');
            }
        }
    }
    assertActive(operation) {
        if (this.disposed || this.host.isDisposed()) {
            throw new CropSessionError(`Cannot ${operation} after Crop disposal.`);
        }
    }
}
//# sourceMappingURL=crop-controller.js.map