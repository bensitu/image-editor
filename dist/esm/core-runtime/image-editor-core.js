import { PluginManager, } from '../plugin-kernel/index.js';
import { applyCanvasDimensions, computeCoverLayout, computeExpandLayout, computeFitLayout, computeScrollableCanvasSize, measureScrollbarSize, selectLayoutStrategy, ViewportCache, } from '../image/layout-manager.js';
import { CanvasCoreStateAdapter } from './core-state-adapter.js';
import { CoreRuntimeError, SnapshotValidationError } from './errors.js';
import { ExportContributorRegistry } from './export-contributor-registry.js';
import { GeometryMutationCoordinator, IDENTITY_AFFINE_MATRIX, } from './geometry/index.js';
import { HistoryCommitRouter } from './history-commit-router.js';
import { CORE_EXPORT_CAPABILITY, CORE_HOST_CAPABILITY, CORE_STATE_CAPABILITY, GEOMETRY_CAPABILITY, } from './internal-capabilities.js';
import { MementoService, ObjectPropertyRegistry, SnapshotService, StateSliceRegistry, TransientObjectRegistry, migrateV2SnapshotToV3, } from './state/index.js';
const DEFAULT_CORE_OPTIONS = Object.freeze({
    canvasWidth: 800,
    canvasHeight: 600,
    backgroundColor: '#ffffff',
    layoutMode: 'expand',
    groupSelection: true,
    maxInputBytes: 32 * 1024 * 1024,
    maxInputPixels: 64 * 1024 * 1024,
    imageLoadTimeoutMs: 30000,
    maxExportPixels: 64 * 1024 * 1024,
    maxExportDimension: 16384,
    exportMultiplier: 1,
    initialImageBase64: '',
});
function positiveFinite(value, fallback) {
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}
function positiveInteger(value, fallback) {
    return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : fallback;
}
function resolveOptions(options) {
    var _a, _b, _c;
    const layoutMode = options.defaultLayoutMode;
    return Object.freeze({
        canvasWidth: positiveFinite(options.canvasWidth, DEFAULT_CORE_OPTIONS.canvasWidth),
        canvasHeight: positiveFinite(options.canvasHeight, DEFAULT_CORE_OPTIONS.canvasHeight),
        backgroundColor: (_a = options.backgroundColor) !== null && _a !== void 0 ? _a : DEFAULT_CORE_OPTIONS.backgroundColor,
        layoutMode: layoutMode === 'fit' || layoutMode === 'cover' || layoutMode === 'expand'
            ? layoutMode
            : DEFAULT_CORE_OPTIONS.layoutMode,
        groupSelection: (_b = options.groupSelection) !== null && _b !== void 0 ? _b : DEFAULT_CORE_OPTIONS.groupSelection,
        maxInputBytes: positiveInteger(options.maxInputBytes, DEFAULT_CORE_OPTIONS.maxInputBytes),
        maxInputPixels: positiveInteger(options.maxInputPixels, DEFAULT_CORE_OPTIONS.maxInputPixels),
        imageLoadTimeoutMs: positiveInteger(options.imageLoadTimeoutMs, DEFAULT_CORE_OPTIONS.imageLoadTimeoutMs),
        maxExportPixels: positiveInteger(options.maxExportPixels, DEFAULT_CORE_OPTIONS.maxExportPixels),
        maxExportDimension: positiveInteger(options.maxExportDimension, DEFAULT_CORE_OPTIONS.maxExportDimension),
        exportMultiplier: positiveFinite(options.exportMultiplier, DEFAULT_CORE_OPTIONS.exportMultiplier),
        initialImageBase64: (_c = options.initialImageBase64) !== null && _c !== void 0 ? _c : '',
        onError: options.onError,
        onWarning: options.onWarning,
    });
}
function resolveElement(target, ownerDocument) {
    if (!target)
        return null;
    if (typeof target === 'string')
        return ownerDocument.getElementById(target);
    return target;
}
function inferMimeType(source) {
    var _a;
    const match = /^data:(image\/(?:jpeg|png|webp))(?:[;,])/i.exec(source);
    const mimeType = (_a = match === null || match === void 0 ? void 0 : match[1]) === null || _a === void 0 ? void 0 : _a.toLowerCase();
    return mimeType === 'image/jpeg' || mimeType === 'image/png' || mimeType === 'image/webp'
        ? mimeType
        : null;
}
function withCoreTimeout(promise, timeoutMs, label) {
    return new Promise((resolve, reject) => {
        const startedAt = Date.now();
        const timeoutId = setTimeout(() => {
            reject(new CoreRuntimeError(`[ImageEditor] ${label} timed out after ${Date.now() - startedAt}ms.`, { code: 'IMAGE_LOAD_TIMEOUT' }));
        }, timeoutMs);
        promise.then((value) => {
            clearTimeout(timeoutId);
            resolve(value);
        }, (error) => {
            clearTimeout(timeoutId);
            reject(error);
        });
    });
}
function estimateDataUrlBytes(source) {
    const comma = source.indexOf(',');
    if (comma < 0)
        return source.length;
    const metadata = source.slice(0, comma);
    const payload = source.length - comma - 1;
    return /;base64/i.test(metadata) ? Math.ceil((payload * 3) / 4) : payload;
}
function toAffineMatrix(value) {
    if (value.length !== 6 || value.some((entry) => !Number.isFinite(entry))) {
        throw new CoreRuntimeError('[ImageEditor] Base image returned a malformed transform matrix.');
    }
    return Object.freeze([value[0], value[1], value[2], value[3], value[4], value[5]]);
}
function markBaseImage(image) {
    image.editorObjectKind = 'baseImage';
    return image;
}
function reportSafely(callback, error, message, fallback) {
    try {
        callback === null || callback === void 0 ? void 0 : callback(error, message);
    }
    catch (callbackError) {
        fallback('[ImageEditor] Error callback failed.', callbackError);
    }
}
function base64ToFile(dataUrl, fileName) {
    var _a, _b;
    const [header = '', payload = ''] = dataUrl.split(',', 2);
    const mimeType = (_b = (_a = /data:([^;]+)/.exec(header)) === null || _a === void 0 ? void 0 : _a[1]) !== null && _b !== void 0 ? _b : 'application/octet-stream';
    const binary = /;base64/i.test(header) ? atob(payload) : decodeURIComponent(payload);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1)
        bytes[index] = binary.charCodeAt(index);
    return new File([bytes], fileName, { type: mimeType });
}
export class ImageEditorCore {
    constructor(fabric, options = {}) {
        Object.defineProperty(this, "fabric", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: fabric
        });
        Object.defineProperty(this, "options", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "slices", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new StateSliceRegistry()
        });
        Object.defineProperty(this, "objectProperties", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new ObjectPropertyRegistry()
        });
        Object.defineProperty(this, "transientObjects", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "externalObjects", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "history", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new HistoryCommitRouter()
        });
        Object.defineProperty(this, "exportContributors", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new ExportContributorRegistry()
        });
        Object.defineProperty(this, "mementos", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "snapshots", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "geometry", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "plugins", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "viewportCache", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new ViewportCache()
        });
        Object.defineProperty(this, "canvas", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "canvasElement", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "containerElement", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "placeholderElement", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "baseImage", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "imageMimeType", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "baseImageScale", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 1
        });
        Object.defineProperty(this, "layoutMode", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "geometryRevision", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "initialized", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "disposing", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "disposed", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "disposePromise", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        if (!fabric ||
            typeof fabric.Canvas !== 'function' ||
            typeof fabric.FabricImage !== 'function') {
            throw new CoreRuntimeError('[ImageEditor] ImageEditorCore requires a Fabric.js v7 module.');
        }
        this.options = resolveOptions(options);
        this.layoutMode = this.options.layoutMode;
        this.transientObjects = new TransientObjectRegistry((warning) => {
            var _a;
            this.reportWarning((_a = warning.details) === null || _a === void 0 ? void 0 : _a.cause, warning.message);
        });
        this.externalObjects = new TransientObjectRegistry((warning) => {
            var _a;
            this.reportWarning((_a = warning.details) === null || _a === void 0 ? void 0 : _a.cause, warning.message);
        });
        this.objectProperties.register({
            owner: '@bensitu/core',
            keys: ['editorObjectKind'],
        });
        const stateAdapter = new CanvasCoreStateAdapter({
            getCanvas: () => this.canvas,
            getBaseImage: () => this.baseImage,
            setBaseImage: (image) => {
                this.baseImage = image;
            },
            getImageMimeType: () => this.imageMimeType,
            setImageMimeType: (value) => {
                this.imageMimeType = value;
            },
            getBaseImageScale: () => this.baseImageScale,
            setBaseImageScale: (value) => {
                this.baseImageScale = value;
            },
            getGeometryRevision: () => this.geometryRevision,
            setGeometryRevision: (value) => {
                this.geometryRevision = value;
            },
            setCanvasSize: (width, height) => this.setCanvasSize(width, height),
            isDisposed: () => this.disposed,
        }, this.objectProperties, this.transientObjects, this.externalObjects);
        this.mementos = new MementoService(stateAdapter, this.slices);
        this.snapshots = new SnapshotService(stateAdapter, this.slices, this.mementos, (warning) => { var _a; return this.reportWarning((_a = warning.details) === null || _a === void 0 ? void 0 : _a.cause, warning.message); });
        let pluginManager = null;
        this.geometry = new GeometryMutationCoordinator({
            mementos: this.mementos,
            operations: {
                has: (operationId) => { var _a; return (_a = pluginManager === null || pluginManager === void 0 ? void 0 : pluginManager.hasOperation(operationId)) !== null && _a !== void 0 ? _a : false; },
                acquire: (operationId) => {
                    if (!pluginManager)
                        throw new Error('Plugin Manager is not ready.');
                    return pluginManager.beginOperationForHost(operationId);
                },
            },
            state: {
                captureGeometry: () => this.captureGeometry(),
                finalizeGeometry: () => {
                    var _a;
                    (_a = this.baseImage) === null || _a === void 0 ? void 0 : _a.setCoords();
                    this.geometryRevision += 1;
                },
                requestRender: () => this.requestRender(),
                isDisposed: () => this.disposed,
            },
            history: this.history,
            events: {
                emitCommitted: async (eventName, descriptor) => {
                    if (eventName !== 'geometry:committed')
                        return;
                    await (pluginManager === null || pluginManager === void 0 ? void 0 : pluginManager.emitCommitted('geometry:committed', descriptor));
                },
            },
            warningSink: (warning) => this.reportWarning(warning.cause, warning.message),
            errorSink: (error) => this.reportError(error, 'Geometry mutation failed.'),
        });
        const hostPort = this.createHostPort();
        const statePort = this.createStatePort();
        this.plugins = new PluginManager({
            warningSink: (warning) => this.reportWarning(warning.cause, warning.message),
            errorSink: (error) => this.reportError(error, 'Plugin lifecycle failed.'),
            hostCapabilities: [
                { token: CORE_HOST_CAPABILITY, implementation: hostPort },
                { token: CORE_STATE_CAPABILITY, implementation: statePort },
                { token: GEOMETRY_CAPABILITY, implementation: this.geometry },
                { token: CORE_EXPORT_CAPABILITY, implementation: this.exportContributors },
            ],
        });
        pluginManager = this.plugins;
        for (const operationId of ['core:load-image', 'core:load-state', 'core:export']) {
            this.plugins.registerHostOperation({ id: operationId, mode: 'busy' });
        }
    }
    use(plugin) {
        this.assertNotDisposed('install a plugin');
        return this.plugins.installSync(plugin);
    }
    useAsync(plugin) {
        this.assertNotDisposed('install a plugin');
        return this.plugins.install(plugin);
    }
    getPlugin(ref) {
        return this.plugins.get(ref);
    }
    requirePlugin(ref) {
        return this.plugins.require(ref);
    }
    getPluginById(pluginId) {
        return this.plugins.getById(pluginId);
    }
    init(elements) {
        var _a, _b, _c, _d, _e, _f;
        this.assertNotDisposed('initialize');
        if (this.initialized)
            throw new CoreRuntimeError('[ImageEditor] Core is already initialized.');
        const ownerDocument = typeof elements.canvas === 'string'
            ? globalThis.document
            : (_a = elements.canvas) === null || _a === void 0 ? void 0 : _a.ownerDocument;
        if (!ownerDocument)
            throw new CoreRuntimeError('[ImageEditor] Canvas document is unavailable.');
        const canvasElement = resolveElement(elements.canvas, ownerDocument);
        if (!(canvasElement instanceof ownerDocument.defaultView.HTMLCanvasElement)) {
            throw new CoreRuntimeError('[ImageEditor] Core canvas element was not found.');
        }
        this.canvasElement = canvasElement;
        this.containerElement =
            (_b = resolveElement(elements.canvasContainer, ownerDocument)) !== null && _b !== void 0 ? _b : canvasElement.parentElement;
        this.placeholderElement = resolveElement(elements.imagePlaceholder, ownerDocument);
        const containerWidth = Math.floor((_d = (_c = this.containerElement) === null || _c === void 0 ? void 0 : _c.clientWidth) !== null && _d !== void 0 ? _d : 0);
        const containerHeight = Math.floor((_f = (_e = this.containerElement) === null || _e === void 0 ? void 0 : _e.clientHeight) !== null && _f !== void 0 ? _f : 0);
        const hasVisibleContainer = containerWidth > 0 && containerHeight > 0;
        this.canvas = new this.fabric.Canvas(canvasElement, {
            width: hasVisibleContainer ? containerWidth : this.options.canvasWidth,
            height: hasVisibleContainer ? containerHeight : this.options.canvasHeight,
            backgroundColor: this.options.backgroundColor,
            selection: this.options.groupSelection,
            preserveObjectStacking: true,
        });
        this.initialized = true;
        try {
            this.plugins.initializeSync();
        }
        catch (error) {
            void this.canvas.dispose();
            this.canvas = null;
            this.initialized = false;
            throw error;
        }
        if (this.options.initialImageBase64) {
            void this.loadImage(this.options.initialImageBase64).catch(() => undefined);
        }
        else {
            this.updatePlaceholder();
        }
    }
    async loadImage(source, options = {}) {
        this.assertReady('load an image');
        if (!inferMimeType(source)) {
            throw new CoreRuntimeError('[ImageEditor] Unsupported image Data URL.');
        }
        if (estimateDataUrlBytes(source) > this.options.maxInputBytes) {
            throw new CoreRuntimeError('[ImageEditor] Image input exceeds maxInputBytes.');
        }
        const operation = this.plugins.beginOperationForHost('core:load-image');
        const before = this.mementos.capture();
        const previousScroll = this.containerElement
            ? { left: this.containerElement.scrollLeft, top: this.containerElement.scrollTop }
            : null;
        try {
            const image = await withCoreTimeout(this.fabric.FabricImage.fromURL(source, { crossOrigin: 'anonymous' }), this.options.imageLoadTimeoutMs, 'FabricImage.fromURL');
            const naturalWidth = Number(image.width) || 0;
            const naturalHeight = Number(image.height) || 0;
            if (naturalWidth <= 0 ||
                naturalHeight <= 0 ||
                naturalWidth * naturalHeight > this.options.maxInputPixels) {
                throw new CoreRuntimeError('[ImageEditor] Decoded image exceeds the pixel budget.');
            }
            if (this.baseImage)
                await this.plugins.notifyImageCleared();
            const canvas = this.requireCanvas('loadImage');
            canvas.discardActiveObject();
            canvas.clear();
            canvas.backgroundColor = this.options.backgroundColor;
            const baseImage = markBaseImage(image);
            baseImage.set({
                originX: 'left',
                originY: 'top',
                selectable: false,
                evented: false,
            });
            const layout = this.computeLayout(baseImage);
            applyCanvasDimensions(canvas, layout.canvasWidth, layout.canvasHeight, this.containerElement);
            baseImage.set({
                left: layout.imageLeft,
                top: layout.imageTop,
                scaleX: layout.imageScale,
                scaleY: layout.imageScale,
            });
            baseImage.setCoords();
            canvas.add(baseImage);
            canvas.sendObjectToBack(baseImage);
            this.baseImage = baseImage;
            this.baseImageScale = layout.imageScale;
            this.imageMimeType = inferMimeType(source);
            this.geometryRevision += 1;
            const imageInfo = this.getImageInfo();
            if (!imageInfo)
                throw new Error('Loaded image information is unavailable.');
            await this.plugins.notifyImageLoaded(imageInfo);
            this.requestRender();
            const after = this.mementos.capture();
            await this.commitHistory({
                operationId: 'core:load-image',
                before,
                after,
                timestamp: Date.now(),
            });
            await this.plugins.emitCommitted('image:loaded', imageInfo);
            if (options.preserveScroll && previousScroll && this.containerElement) {
                this.containerElement.scrollLeft = previousScroll.left;
                this.containerElement.scrollTop = previousScroll.top;
            }
            this.updatePlaceholder();
        }
        catch (error) {
            await this.mementos.restore(before, { rollbackOnFailure: false });
            this.requestRender();
            this.reportError(error, 'loadImage failed.');
            throw error;
        }
        finally {
            await operation.dispose();
        }
    }
    async loadImageFile(file, options = {}) {
        if (!(file instanceof File))
            throw new TypeError('[ImageEditor] loadImageFile expects a File.');
        if (file.size > this.options.maxInputBytes) {
            throw new CoreRuntimeError('[ImageEditor] Image file exceeds maxInputBytes.');
        }
        const dataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = () => { var _a; return reject((_a = reader.error) !== null && _a !== void 0 ? _a : new Error('FileReader failed.')); };
            reader.onload = () => typeof reader.result === 'string'
                ? resolve(reader.result)
                : reject(new Error('FileReader did not produce a Data URL.'));
            reader.readAsDataURL(file);
        });
        await this.loadImage(dataUrl, options);
    }
    saveState() {
        this.assertReady('save state');
        return this.snapshots.stringify();
    }
    async loadFromState(input, options = {}) {
        this.assertReady('load state');
        const operation = this.plugins.beginOperationForHost('core:load-state');
        const before = this.mementos.capture();
        try {
            let value = input;
            if (typeof input === 'string') {
                try {
                    const parsed = JSON.parse(input);
                    if (!parsed ||
                        typeof parsed !== 'object' ||
                        !('schema' in parsed) ||
                        !('version' in parsed)) {
                        value = migrateV2SnapshotToV3(parsed).snapshot;
                    }
                }
                catch (error) {
                    if (error instanceof SyntaxError)
                        throw new SnapshotValidationError('invalid JSON.');
                    throw error;
                }
            }
            await this.snapshots.load(value, {
                missingPluginPolicy: options.missingPluginPolicy,
            });
            const after = this.mementos.capture();
            await this.commitHistory({
                operationId: 'core:load-state',
                before,
                after,
                timestamp: Date.now(),
            });
            await this.plugins.emitCommitted('state:loaded', { schemaVersion: 3 });
            this.requestRender();
            this.updatePlaceholder();
        }
        catch (error) {
            this.reportError(error, 'loadFromState failed.');
            throw error;
        }
        finally {
            await operation.dispose();
        }
    }
    exportImageBase64(options = {}) {
        return this.runExport(options);
    }
    async exportImageFile(options = {}) {
        var _a, _b;
        const dataUrl = await this.runExport(options);
        const format = (_a = options.format) !== null && _a !== void 0 ? _a : 'png';
        return base64ToFile(dataUrl, (_b = options.fileName) !== null && _b !== void 0 ? _b : `image.${format === 'jpeg' ? 'jpg' : format}`);
    }
    isImageLoaded() {
        return this.baseImage !== null;
    }
    getImageInfo() {
        const image = this.baseImage;
        if (!image)
            return null;
        image.setCoords();
        const bounds = image.getBoundingRect();
        return Object.freeze({
            width: bounds.width,
            height: bounds.height,
            naturalWidth: Number(image.width) || 0,
            naturalHeight: Number(image.height) || 0,
            mimeType: this.imageMimeType,
            geometryRevision: this.geometryRevision,
        });
    }
    getCanvas() {
        return this.canvas;
    }
    setLayoutMode(mode) {
        this.assertNotDisposed('set layout mode');
        this.layoutMode = mode;
        this.viewportCache.clear();
    }
    async adoptLegacyImageState(state) {
        var _a;
        this.assertReady('adopt legacy image state');
        const canvas = this.requireCanvas('adopt legacy image state');
        const previousImage = this.baseImage;
        if (state.baseImage) {
            if (!canvas.getObjects().includes(state.baseImage)) {
                throw new CoreRuntimeError('[ImageEditor] Cannot adopt a base image that is not on the Core Canvas.');
            }
            markBaseImage(state.baseImage);
        }
        this.baseImage = state.baseImage;
        this.baseImageScale = positiveFinite(state.baseImageScale, 1);
        this.imageMimeType = state.imageMimeType;
        this.geometryRevision += 1;
        const lifecycle = (_a = state.lifecycle) !== null && _a !== void 0 ? _a : 'none';
        if (lifecycle === 'cleared') {
            await this.plugins.notifyImageCleared();
        }
        else if (lifecycle === 'loaded') {
            if (previousImage && previousImage !== state.baseImage) {
                await this.plugins.notifyImageCleared();
            }
            const imageInfo = this.getImageInfo();
            if (imageInfo)
                await this.plugins.notifyImageLoaded(imageInfo);
        }
        this.updatePlaceholder();
    }
    captureCompatibilityMemento() {
        return this.mementos.capture();
    }
    dispose() {
        if (this.disposed || this.disposing)
            return;
        if (this.geometry.isRunning) {
            void this.disposeAsync();
            return;
        }
        this.disposing = true;
        const errors = [];
        for (const cleanup of [
            () => this.plugins.disposeSync(),
            () => this.geometry.disposeSync(),
            () => this.exportContributors.dispose(),
            () => this.snapshots.dispose(),
            () => this.mementos.dispose(),
            () => this.transientObjects.dispose(),
            () => this.externalObjects.dispose(),
            () => this.objectProperties.dispose(),
            () => this.slices.dispose(),
        ]) {
            try {
                cleanup();
            }
            catch (error) {
                errors.push(error);
            }
        }
        this.disposed = true;
        this.disposing = false;
        const canvas = this.canvas;
        this.clearRuntimeReferences();
        if (canvas) {
            const canvasDispose = canvas.dispose();
            if (canvasDispose && typeof canvasDispose.then === 'function') {
                this.disposePromise = Promise.resolve(canvasDispose).then(() => undefined);
            }
        }
        if (errors.length > 0) {
            throw new CoreRuntimeError(`[ImageEditor] Core disposal completed with ${errors.length} cleanup error(s).`, { code: 'CORE_DISPOSE_ERROR', cause: Object.freeze(errors) });
        }
    }
    disposeAsync() {
        if (this.disposePromise)
            return this.disposePromise;
        if (this.disposed)
            return Promise.resolve();
        this.disposing = true;
        this.disposePromise = this.performDisposeAsync();
        return this.disposePromise;
    }
    createHostPort() {
        return Object.freeze({
            fabric: this.fabric,
            options: this.options,
            getCanvas: () => this.canvas,
            requireCanvas: (operation) => this.requireCanvas(operation),
            getBaseImage: () => this.baseImage,
            replaceBaseImage: (image, replacementOptions) => {
                var _a;
                const canvas = this.requireCanvas('replace the base image');
                if (this.baseImage && this.baseImage !== image)
                    canvas.remove(this.baseImage);
                markBaseImage(image);
                if (!canvas.getObjects().includes(image))
                    canvas.add(image);
                canvas.sendObjectToBack(image);
                this.baseImage = image;
                this.baseImageScale = positiveFinite(replacementOptions === null || replacementOptions === void 0 ? void 0 : replacementOptions.baseScale, 1);
                this.imageMimeType = (_a = replacementOptions === null || replacementOptions === void 0 ? void 0 : replacementOptions.mimeType) !== null && _a !== void 0 ? _a : this.imageMimeType;
                this.geometryRevision += 1;
                this.updatePlaceholder();
            },
            getBaseImageScale: () => this.baseImageScale,
            getGeometryRevision: () => this.geometryRevision,
            setGeometryRevision: (revision) => {
                this.geometryRevision = revision;
            },
            getCanvasSize: () => {
                var _a, _b, _c, _d;
                return Object.freeze({
                    width: (_b = (_a = this.canvas) === null || _a === void 0 ? void 0 : _a.getWidth()) !== null && _b !== void 0 ? _b : 0,
                    height: (_d = (_c = this.canvas) === null || _c === void 0 ? void 0 : _c.getHeight()) !== null && _d !== void 0 ? _d : 0,
                });
            },
            setCanvasSize: (width, height) => this.setCanvasSize(width, height),
            getImageInfo: () => this.getImageInfo(),
            isImageLoaded: () => this.isImageLoaded(),
            isDisposed: () => this.disposed,
            requestRender: () => this.requestRender(),
            finalizeBaseImageGeometry: () => this.finalizeBaseImageGeometry(),
            reportWarning: (error, message) => this.reportWarning(error, message),
            reportError: (error, message) => this.reportError(error, message),
        });
    }
    createStatePort() {
        return Object.freeze({
            slices: this.slices,
            objectProperties: this.objectProperties,
            transientObjects: this.transientObjects,
            externalObjects: this.externalObjects,
            mementos: this.mementos,
            snapshots: this.snapshots,
            captureHistoryRecord: (operationId, before) => Object.freeze({
                operationId,
                before,
                after: this.mementos.capture(),
                timestamp: Date.now(),
            }),
            commitHistory: (record) => this.history.isAvailable() ? this.history.commit(record) : undefined,
            registerHistoryProvider: (owner, provider) => this.history.register(owner, provider),
        });
    }
    computeLayout(image) {
        var _a, _b;
        const scrollbarSize = measureScrollbarSize((_b = (_a = this.containerElement) === null || _a === void 0 ? void 0 : _a.ownerDocument) !== null && _b !== void 0 ? _b : null);
        const viewport = this.viewportCache.measure(this.containerElement, { width: this.options.canvasWidth, height: this.options.canvasHeight }, scrollbarSize);
        const strategy = selectLayoutStrategy(this.layoutMode);
        const width = Number(image.width) || 0;
        const height = Number(image.height) || 0;
        if (strategy === 'fit') {
            return computeFitLayout(width, height, this.options.canvasWidth, this.options.canvasHeight, viewport);
        }
        if (strategy === 'cover') {
            return computeCoverLayout(width, height, this.options.canvasWidth, this.options.canvasHeight, viewport, scrollbarSize);
        }
        return computeExpandLayout(width, height, viewport);
    }
    captureGeometry() {
        const canvas = this.requireCanvas('capture base-image geometry');
        const image = this.baseImage;
        if (!image) {
            return Object.freeze({
                matrix: IDENTITY_AFFINE_MATRIX,
                boundingBox: Object.freeze({ left: 0, top: 0, width: 0, height: 0 }),
                canvasWidth: canvas.getWidth(),
                canvasHeight: canvas.getHeight(),
                revision: this.geometryRevision,
            });
        }
        image.setCoords();
        const bounds = image.getBoundingRect();
        return Object.freeze({
            matrix: toAffineMatrix(image.calcTransformMatrix()),
            boundingBox: Object.freeze({
                left: bounds.left,
                top: bounds.top,
                width: bounds.width,
                height: bounds.height,
            }),
            canvasWidth: canvas.getWidth(),
            canvasHeight: canvas.getHeight(),
            revision: this.geometryRevision,
        });
    }
    finalizeBaseImageGeometry() {
        var _a, _b, _c, _d, _e, _f;
        const image = this.baseImage;
        const canvas = this.canvas;
        if (!image || !canvas)
            return;
        image.setCoords();
        const bounds = image.getBoundingRect();
        const scrollbarSize = measureScrollbarSize((_d = (_b = (_a = this.containerElement) === null || _a === void 0 ? void 0 : _a.ownerDocument) !== null && _b !== void 0 ? _b : (_c = this.canvasElement) === null || _c === void 0 ? void 0 : _c.ownerDocument) !== null && _d !== void 0 ? _d : null);
        const viewport = this.viewportCache.measure(this.containerElement, { width: this.options.canvasWidth, height: this.options.canvasHeight }, scrollbarSize);
        const imageFitsViewport = bounds.width <= viewport.width + 0.5 && bounds.height <= viewport.height + 0.5;
        if (imageFitsViewport) {
            this.setCanvasSize(Math.max(1, viewport.width - 1), Math.max(1, viewport.height - 1));
        }
        else if (this.layoutMode === 'fit' || this.layoutMode === 'cover') {
            const size = computeScrollableCanvasSize(bounds.width, bounds.height, viewport, scrollbarSize);
            this.setCanvasSize(size.width, size.height);
        }
        else {
            this.setCanvasSize(Math.max(viewport.width, Math.ceil(bounds.width)), Math.max(viewport.height, Math.ceil(bounds.height)));
        }
        image.set({ left: ((_e = image.left) !== null && _e !== void 0 ? _e : 0) - bounds.left, top: ((_f = image.top) !== null && _f !== void 0 ? _f : 0) - bounds.top });
        image.setCoords();
        canvas.sendObjectToBack(image);
    }
    setCanvasSize(width, height) {
        if (!this.canvas)
            return;
        applyCanvasDimensions(this.canvas, Math.max(1, Math.ceil(width)), Math.max(1, Math.ceil(height)), this.containerElement);
    }
    async runExport(options) {
        var _a, _b, _c, _d;
        this.assertReady('export an image');
        const operation = this.plugins.beginOperationForHost('core:export');
        try {
            const canvas = this.requireCanvas('exportImageBase64');
            const multiplier = positiveFinite(options.multiplier, this.options.exportMultiplier);
            const format = (_a = options.format) !== null && _a !== void 0 ? _a : 'png';
            const quality = Math.max(0, Math.min(1, (_b = options.quality) !== null && _b !== void 0 ? _b : 0.92));
            let left = 0;
            let top = 0;
            let width = canvas.getWidth();
            let height = canvas.getHeight();
            if (((_c = options.area) !== null && _c !== void 0 ? _c : 'image') === 'image') {
                if (!this.baseImage)
                    throw new CoreRuntimeError('[ImageEditor] No image is loaded.');
                this.baseImage.setCoords();
                const bounds = this.baseImage.getBoundingRect();
                left = bounds.left;
                top = bounds.top;
                width = bounds.width;
                height = bounds.height;
            }
            if (width * multiplier > this.options.maxExportDimension ||
                height * multiplier > this.options.maxExportDimension ||
                width * height * multiplier * multiplier > this.options.maxExportPixels) {
                throw new CoreRuntimeError('[ImageEditor] Export dimensions exceed the configured budget.');
            }
            const exportElement = (_d = this.canvasElement) === null || _d === void 0 ? void 0 : _d.ownerDocument.createElement('canvas');
            if (!exportElement) {
                throw new CoreRuntimeError('[ImageEditor] Export requires an initialized Canvas.');
            }
            const exportCanvas = new this.fabric.StaticCanvas(exportElement, {
                width: canvas.getWidth(),
                height: canvas.getHeight(),
                backgroundColor: this.options.backgroundColor,
                renderOnAddRemove: false,
            });
            try {
                if (this.baseImage) {
                    const clonedBaseImage = await this.baseImage.clone();
                    exportCanvas.add(clonedBaseImage);
                    exportCanvas.sendObjectToBack(clonedBaseImage);
                }
                await this.exportContributors.render({ canvas: exportCanvas, options });
                exportCanvas.renderAll();
                return exportCanvas.toDataURL({
                    format,
                    quality,
                    multiplier,
                    left,
                    top,
                    width,
                    height,
                });
            }
            finally {
                await exportCanvas.dispose();
            }
        }
        finally {
            await operation.dispose();
        }
    }
    async commitHistory(record) {
        if (this.history.isAvailable())
            await this.history.commit(record);
    }
    requireCanvas(operation) {
        this.assertReady(operation);
        if (!this.canvas)
            throw new CoreRuntimeError(`[ImageEditor] Cannot ${operation} without Canvas.`);
        return this.canvas;
    }
    requestRender() {
        var _a;
        if (!this.disposed)
            (_a = this.canvas) === null || _a === void 0 ? void 0 : _a.requestRenderAll();
    }
    updatePlaceholder() {
        if (this.placeholderElement)
            this.placeholderElement.hidden = this.baseImage !== null;
    }
    reportWarning(error, message) {
        reportSafely(this.options.onWarning, error, message, console.warn);
    }
    reportError(error, message) {
        reportSafely(this.options.onError, error, message, console.error);
    }
    assertReady(operation) {
        this.assertNotDisposed(operation);
        if (!this.initialized || !this.canvas) {
            throw new CoreRuntimeError(`[ImageEditor] Cannot ${operation} before init().`);
        }
    }
    assertNotDisposed(operation) {
        if (this.disposed || this.disposing)
            throw new CoreRuntimeError(`[ImageEditor] Cannot ${operation} after dispose.`);
    }
    clearRuntimeReferences() {
        this.canvas = null;
        this.canvasElement = null;
        this.containerElement = null;
        this.placeholderElement = null;
        this.baseImage = null;
        this.imageMimeType = null;
        this.baseImageScale = 1;
        this.initialized = false;
        this.viewportCache.clear();
    }
    async performDisposeAsync() {
        const errors = [];
        for (const cleanup of [() => this.geometry.dispose(), () => this.plugins.dispose()]) {
            try {
                await cleanup();
            }
            catch (error) {
                errors.push(error);
            }
        }
        this.disposed = true;
        this.disposing = false;
        this.snapshots.dispose();
        this.exportContributors.dispose();
        this.mementos.dispose();
        this.transientObjects.dispose();
        this.externalObjects.dispose();
        this.objectProperties.dispose();
        this.slices.dispose();
        const canvas = this.canvas;
        this.clearRuntimeReferences();
        if (canvas) {
            try {
                await canvas.dispose();
            }
            catch (error) {
                errors.push(error);
            }
        }
        if (errors.length > 0) {
            throw new CoreRuntimeError(`[ImageEditor] Async disposal completed with ${errors.length} cleanup error(s).`, { code: 'CORE_DISPOSE_ERROR', cause: Object.freeze(errors) });
        }
    }
}
//# sourceMappingURL=image-editor-core.js.map