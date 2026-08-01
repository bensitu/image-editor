import { PluginLifecycleError, PluginNotInstalledError, } from '../plugin-kernel/index.js';
import { PluginManager } from '../plugin-kernel/plugin-manager.js';
import { isPluginPlan, resolvePluginPlanApis, } from '../plugin-kernel/plugin-plan.js';
import { applyCanvasDimensions, computeCoverLayout, computeExpandLayout, computeFitLayout, computeScrollableCanvasSize, measureScrollbarSize, selectLayoutStrategy, ViewportCache, } from '../image/layout-manager.js';
import { preprocessImageDataUrl, requiresImagePreprocessing } from '../image/image-preprocessor.js';
import { CanvasCoreStateAdapter, disposeReplacedBaseImage } from './core-state-adapter.js';
import { CoreRuntimeError, EmergencyResetError, EditorFaultedError, classifyCoreError, } from './errors.js';
import { ExportContributorRegistry } from './export-contributor-registry.js';
import { GeometryMutationCoordinator, IDENTITY_AFFINE_MATRIX, } from './geometry/index.js';
import { HistoryCommitRouter } from './history-commit-router.js';
import { BASE_IMAGE_INFO_CAPABILITY, BASE_IMAGE_READ_CAPABILITY, CANVAS_READ_CAPABILITY, CANVAS_RESIZE_CAPABILITY, CORE_DIAGNOSTICS_CAPABILITY, CORE_ENVIRONMENT_CAPABILITY, CORE_PRESENTATION_CAPABILITY, CORE_STATUS_CAPABILITY, DOCUMENT_MUTATION_CAPABILITY, EXPORT_CONTRIBUTION_CAPABILITY, FABRIC_RUNTIME_CAPABILITY, GEOMETRY_MUTATION_CAPABILITY, IMAGE_RESOURCE_POLICY_CAPABILITY, MEMENTO_HISTORY_CAPABILITY, RASTER_MUTATION_CAPABILITY, RENDER_REQUEST_CAPABILITY, SNAPSHOT_REGISTRATION_CAPABILITY, } from './internal-capabilities.js';
import { EditorLifecycleController } from './lifecycle.js';
import { isProxyablePluginApi, StablePluginApiHandle } from './plugin-api-handle.js';
import { DocumentMutationCoordinator, } from './mutation/index.js';
import { MementoService, ObjectPropertyRegistry, SnapshotService, StateSliceRegistry, TransientObjectRegistry, DEFAULT_SNAPSHOT_LIMITS, } from './state/index.js';
import { inspectEncodedImageDataUrl } from './state/image-data-url.js';
import { isRasterAllocationWithinBudget } from '../utils/image-budget.js';
import { DOCUMENT_WIDE_MUTATION_CONFLICT_DOMAINS } from '../utils/internal-operation-conflict-domains.js';
const DEFAULT_CORE_OPTIONS = Object.freeze({
    canvasWidth: 800,
    canvasHeight: 600,
    backgroundColor: 'transparent',
    layoutMode: 'expand',
    imagePreprocessing: Object.freeze({
        downsample: true,
        maxWidth: 4000,
        maxHeight: 3000,
        quality: 0.92,
        format: null,
        preserveSourceFormat: true,
        normalizeExifOrientation: true,
    }),
    groupSelection: true,
    maxInputBytes: 32 * 1024 * 1024,
    maxInputPixels: 64 * 1024 * 1024,
    imageLoadTimeoutMs: 30000,
    maxExportPixels: 64 * 1024 * 1024,
    maxExportDimension: 16384,
    exportMultiplier: 1,
    exportDefaults: Object.freeze({
        area: 'image',
        format: 'png',
        quality: 0.92,
        multiplier: 1,
        fileName: 'edited_image',
        contributors: Object.freeze({}),
    }),
    initialImageBase64: '',
});
const MAX_RETAINED_DIAGNOSTICS = 1000;
function positiveFinite(value, fallback) {
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}
function positiveInteger(value, fallback) {
    return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : fallback;
}
function unitInterval(value, fallback) {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
        ? value
        : fallback;
}
function isLayoutMode(value) {
    return value === 'fit' || value === 'cover' || value === 'expand';
}
function isImageMimeType(value) {
    return value === 'image/jpeg' || value === 'image/png' || value === 'image/webp';
}
function resolveImagePreprocessing(options, base = DEFAULT_CORE_OPTIONS.imagePreprocessing) {
    var _a, _b, _c;
    return Object.freeze({
        downsample: (_a = options === null || options === void 0 ? void 0 : options.downsample) !== null && _a !== void 0 ? _a : base.downsample,
        maxWidth: positiveInteger(options === null || options === void 0 ? void 0 : options.maxWidth, base.maxWidth),
        maxHeight: positiveInteger(options === null || options === void 0 ? void 0 : options.maxHeight, base.maxHeight),
        quality: unitInterval(options === null || options === void 0 ? void 0 : options.quality, base.quality),
        format: (options === null || options === void 0 ? void 0 : options.format) === null || isImageMimeType(options === null || options === void 0 ? void 0 : options.format)
            ? options.format
            : base.format,
        preserveSourceFormat: (_b = options === null || options === void 0 ? void 0 : options.preserveSourceFormat) !== null && _b !== void 0 ? _b : base.preserveSourceFormat,
        normalizeExifOrientation: (_c = options === null || options === void 0 ? void 0 : options.normalizeExifOrientation) !== null && _c !== void 0 ? _c : base.normalizeExifOrientation,
    });
}
function exportFormat(value, fallback) {
    return value === 'png' || value === 'jpeg' || value === 'webp' ? value : fallback;
}
function exportArea(value, fallback) {
    return value === 'image' || value === 'canvas' ? value : fallback;
}
function resolveExportDefaults(options, exportMultiplier) {
    var _a, _b;
    const defaults = DEFAULT_CORE_OPTIONS.exportDefaults;
    const fileName = (_a = options === null || options === void 0 ? void 0 : options.fileName) === null || _a === void 0 ? void 0 : _a.trim();
    return Object.freeze({
        area: exportArea(options === null || options === void 0 ? void 0 : options.area, defaults.area),
        format: exportFormat(options === null || options === void 0 ? void 0 : options.format, defaults.format),
        quality: unitInterval(options === null || options === void 0 ? void 0 : options.quality, defaults.quality),
        multiplier: positiveFinite(options === null || options === void 0 ? void 0 : options.multiplier, exportMultiplier),
        fileName: fileName || defaults.fileName,
        contributors: Object.freeze({ ...((_b = options === null || options === void 0 ? void 0 : options.contributors) !== null && _b !== void 0 ? _b : {}) }),
    });
}
function resolveExportOptions(options, defaults) {
    var _a, _b;
    const fileName = (_a = options.fileName) === null || _a === void 0 ? void 0 : _a.trim();
    return Object.freeze({
        area: exportArea(options.area, defaults.area),
        format: exportFormat(options.format, defaults.format),
        quality: unitInterval(options.quality, defaults.quality),
        multiplier: positiveFinite(options.multiplier, defaults.multiplier),
        fileName: fileName || defaults.fileName,
        contributors: Object.freeze({
            ...defaults.contributors,
            ...((_b = options.contributors) !== null && _b !== void 0 ? _b : {}),
        }),
    });
}
function exportFileName(baseName, format) {
    const extension = format === 'jpeg' ? 'jpg' : format;
    const cleaned = [...baseName]
        .filter((character) => { var _a; return ((_a = character.codePointAt(0)) !== null && _a !== void 0 ? _a : 0) >= 0x20; })
        .join('')
        .trim() || 'edited_image';
    return /\.(?:jpe?g|png|webp)$/iu.test(cleaned)
        ? cleaned.replace(/\.(?:jpe?g|png|webp)$/iu, `.${extension}`)
        : `${cleaned}.${extension}`;
}
function resolveOptions(options) {
    var _a, _b, _c;
    const layoutMode = options.defaultLayoutMode;
    const exportMultiplier = positiveFinite(options.exportMultiplier, DEFAULT_CORE_OPTIONS.exportMultiplier);
    return Object.freeze({
        canvasWidth: positiveFinite(options.canvasWidth, DEFAULT_CORE_OPTIONS.canvasWidth),
        canvasHeight: positiveFinite(options.canvasHeight, DEFAULT_CORE_OPTIONS.canvasHeight),
        backgroundColor: (_a = options.backgroundColor) !== null && _a !== void 0 ? _a : DEFAULT_CORE_OPTIONS.backgroundColor,
        layoutMode: isLayoutMode(layoutMode) ? layoutMode : DEFAULT_CORE_OPTIONS.layoutMode,
        imagePreprocessing: resolveImagePreprocessing(options.imagePreprocessing),
        groupSelection: (_b = options.groupSelection) !== null && _b !== void 0 ? _b : DEFAULT_CORE_OPTIONS.groupSelection,
        maxInputBytes: positiveInteger(options.maxInputBytes, DEFAULT_CORE_OPTIONS.maxInputBytes),
        maxInputPixels: positiveInteger(options.maxInputPixels, DEFAULT_CORE_OPTIONS.maxInputPixels),
        imageLoadTimeoutMs: positiveInteger(options.imageLoadTimeoutMs, DEFAULT_CORE_OPTIONS.imageLoadTimeoutMs),
        maxExportPixels: positiveInteger(options.maxExportPixels, DEFAULT_CORE_OPTIONS.maxExportPixels),
        maxExportDimension: positiveInteger(options.maxExportDimension, DEFAULT_CORE_OPTIONS.maxExportDimension),
        exportMultiplier,
        exportDefaults: resolveExportDefaults(options.exportDefaults, exportMultiplier),
        initialImageBase64: (_c = options.initialImageBase64) !== null && _c !== void 0 ? _c : '',
        ...(options.onError ? { onError: options.onError } : {}),
        ...(options.onWarning ? { onWarning: options.onWarning } : {}),
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
function loadAbortError(message) {
    return new DOMException(message, 'AbortError');
}
function loadAbortReason(signal, message) {
    const reason = signal.reason;
    return reason instanceof DOMException && reason.name === 'AbortError'
        ? reason
        : loadAbortError(message);
}
function isLoadCancellation(error) {
    return (typeof error === 'object' &&
        error !== null &&
        'name' in error &&
        error.name === 'AbortError');
}
function withCoreTimeout(task, timeoutMs, label, signal, disposeLateResult) {
    return new Promise((resolve, reject) => {
        const startedAt = Date.now();
        const controller = new AbortController();
        let settled = false;
        const finish = (body) => {
            if (settled)
                return;
            settled = true;
            clearTimeout(timeoutId);
            signal.removeEventListener('abort', abort);
            body();
        };
        const abort = () => {
            const reason = loadAbortReason(signal, `${label} was aborted.`);
            controller.abort(reason);
            finish(() => reject(reason));
        };
        const timeoutId = setTimeout(() => {
            const timeoutError = new CoreRuntimeError(`[ImageEditor] ${label} timed out after ${Date.now() - startedAt}ms.`, { code: 'IMAGE_LOAD_TIMEOUT' });
            controller.abort(timeoutError);
            finish(() => reject(timeoutError));
        }, timeoutMs);
        signal.addEventListener('abort', abort, { once: true });
        if (signal.aborted) {
            abort();
            return;
        }
        try {
            task(controller.signal).then((value) => {
                if (settled) {
                    try {
                        disposeLateResult === null || disposeLateResult === void 0 ? void 0 : disposeLateResult(value);
                    }
                    catch {
                    }
                    return;
                }
                finish(() => resolve(value));
            }, (error) => finish(() => reject(error)));
        }
        catch (error) {
            finish(() => reject(error));
        }
    });
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
function isCoreImageInfo(value) {
    if (!value || typeof value !== 'object')
        return false;
    const candidate = value;
    return (typeof candidate.width === 'number' &&
        typeof candidate.height === 'number' &&
        typeof candidate.naturalWidth === 'number' &&
        typeof candidate.naturalHeight === 'number' &&
        typeof candidate.geometryRevision === 'number');
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
    let bytes;
    if (/;base64/i.test(header)) {
        const buffer = globalThis.Buffer;
        if (buffer) {
            bytes = Uint8Array.from(buffer.from(payload, 'base64'));
        }
        else {
            const binary = atob(payload);
            bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
        }
    }
    else {
        const decoded = decodeURIComponent(payload);
        bytes = new TextEncoder().encode(decoded);
    }
    return new File([bytes.slice().buffer], fileName, { type: mimeType });
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
        Object.defineProperty(this, "documentMutations", {
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
        Object.defineProperty(this, "installationPlan", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "pluginApiHandles", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "lifecycle", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new EditorLifecycleController()
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
        Object.defineProperty(this, "imageLoaded", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
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
        Object.defineProperty(this, "loadSequence", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "latestLoadSequence", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "stateLoadSequence", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "initialImageLoadActive", {
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
        Object.defineProperty(this, "emergencyResetPromise", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "diagnostics", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "statusListeners", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Set()
        });
        Object.defineProperty(this, "lastRuntimeStatus", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "relayoutSequence", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        if (!fabric ||
            typeof fabric.Canvas !== 'function' ||
            typeof fabric.FabricImage !== 'function') {
            throw new CoreRuntimeError('[ImageEditor] ImageEditorCore requires a supported Fabric.js module.');
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
            owner: 'core:host',
            keys: ['editorObjectKind'],
        });
        const stateAdapter = new CanvasCoreStateAdapter({
            getCanvas: () => this.canvas,
            getBaseImage: () => this.baseImage,
            setBaseImage: (image) => {
                this.baseImage = image;
                this.imageLoaded = image !== null;
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
            isDisposed: () => this.lifecycle.current === 'disposed',
        }, this.objectProperties, this.transientObjects, this.externalObjects, {
            maxDecodedPixels: Math.min(this.options.maxInputPixels, this.options.maxExportPixels),
            maxImageDimension: Math.min(DEFAULT_SNAPSHOT_LIMITS.maxImageDimension, this.options.maxExportDimension),
            decodeTimeoutMs: this.options.imageLoadTimeoutMs,
        });
        this.mementos = new MementoService(stateAdapter, this.slices);
        this.snapshots = new SnapshotService(stateAdapter, this.slices, this.mementos, (warning) => { var _a; return this.reportWarning((_a = warning.details) === null || _a === void 0 ? void 0 : _a.cause, warning.message); }, Object.freeze({
            ...DEFAULT_SNAPSHOT_LIMITS,
            maxInputBytes: Math.ceil((this.options.maxInputBytes * 4) / 3) + 1024 * 1024,
            maxStringLength: Math.ceil((this.options.maxInputBytes * 4) / 3) + 1024,
            maxDataUrlBytes: this.options.maxInputBytes,
            maxDecodedPixels: Math.min(this.options.maxInputPixels, this.options.maxExportPixels),
            maxImageDimension: Math.min(DEFAULT_SNAPSHOT_LIMITS.maxImageDimension, this.options.maxExportDimension),
        }));
        this.documentMutations = new DocumentMutationCoordinator({
            mementos: this.mementos,
            operations: {
                has: (operationId) => { var _a, _b; return (_b = (_a = this.plugins) === null || _a === void 0 ? void 0 : _a.hasOperation(operationId)) !== null && _b !== void 0 ? _b : false; },
                get: (operationId) => { var _a, _b; return (_b = (_a = this.plugins) === null || _a === void 0 ? void 0 : _a.getOperationForHost(operationId)) !== null && _b !== void 0 ? _b : null; },
                run: (operationId, task, operationOptions) => {
                    if (!this.plugins)
                        throw new Error('Plugin Manager is not ready.');
                    return this.plugins.runOperationForHost(operationId, null, (args, context) => {
                        void args;
                        return task(context);
                    }, operationOptions);
                },
            },
            state: {
                requestRender: () => this.requestRender(),
                isDisposed: () => this.lifecycle.current === 'disposed',
                assertOperational: (operation) => this.assertDocumentMutationOperational(operation),
            },
            history: this.history,
            events: {
                emitCommitted: (descriptor) => this.emitDocumentCommitted(descriptor),
            },
            warningSink: (warning) => this.reportWarning(warning.cause, warning.message),
            errorSink: (error) => {
                if (!this.initialImageLoadActive) {
                    this.reportError(error, 'Document mutation failed.');
                }
            },
            faultSink: (error) => this.enterFaulted(error),
        });
        this.geometry = new GeometryMutationCoordinator({
            mutations: this.documentMutations,
            state: {
                captureGeometry: () => this.captureGeometry(),
                finalizeGeometry: () => {
                    var _a;
                    this.finalizeBaseImageGeometry();
                    (_a = this.baseImage) === null || _a === void 0 ? void 0 : _a.setCoords();
                    this.geometryRevision += 1;
                },
                restoreGeometry: (snapshot) => {
                    this.setCanvasSize(snapshot.canvasWidth, snapshot.canvasHeight);
                    this.geometryRevision = snapshot.revision;
                },
                requestRender: () => this.requestRender(),
                isDisposed: () => this.isDisposingOrDisposed(),
            },
            warningSink: (warning) => this.reportWarning(warning.cause, warning.message),
            errorSink: (error) => this.reportError(error, 'Geometry mutation failed.'),
        });
        this.plugins = this.createPluginManager();
    }
    use(plugin) {
        this.lifecycle.assertAvailable('install a plugin');
        const outcome = this.plugins.installSyncForHost(plugin);
        this.installationPlan.push(Object.freeze({ definition: outcome.installedPlugin }));
        return this.publishPluginApi(plugin.ref.id, outcome.api);
    }
    install(pluginsOrPlan) {
        this.lifecycle.assertAvailable('install a plugin batch');
        const plugins = isPluginPlan(pluginsOrPlan) ? pluginsOrPlan.plugins : pluginsOrPlan;
        const outcome = this.plugins.installBatchSync(plugins);
        for (const plugin of outcome.installedPlugins) {
            this.installationPlan.push(Object.freeze({ definition: plugin }));
        }
        const resolveApi = (plugin) => {
            const api = outcome.apisByPluginId.get(plugin.ref.id);
            if (api === undefined) {
                throw new PluginNotInstalledError(plugin.ref.id);
            }
            return this.publishPluginApi(plugin.ref.id, api);
        };
        if (isPluginPlan(pluginsOrPlan)) {
            return resolvePluginPlanApis(pluginsOrPlan, resolveApi);
        }
        return Object.freeze(pluginsOrPlan.map((plugin) => resolveApi(plugin)));
    }
    getPlugin(ref) {
        const api = this.plugins.get(ref);
        return api === null ? null : this.publishPluginApi(ref.id, api);
    }
    requirePlugin(ref) {
        const api = this.getPlugin(ref);
        if (api === null)
            throw new PluginNotInstalledError(ref.id);
        return api;
    }
    getPluginById(pluginId) {
        const api = this.plugins.getById(pluginId);
        return api === null ? null : this.publishPluginApi(pluginId, api);
    }
    getLifecycleState() {
        return this.lifecycle.current;
    }
    getRuntimeStatus() {
        const lifecycle = this.lifecycle.current;
        let busy = this.geometry.isRunning || this.documentMutations.isRunning;
        let activeToolId = null;
        if (lifecycle !== 'disposed') {
            try {
                busy = busy || this.plugins.hasRunningOperations();
                activeToolId = this.plugins.getActiveToolIdForHost();
            }
            catch {
            }
        }
        return Object.freeze({
            lifecycle,
            initialized: lifecycle === 'initialized',
            imageLoaded: this.isImageLoaded(),
            busy,
            activeToolId,
            layoutMode: this.layoutMode,
            geometryRevision: this.geometryRevision,
        });
    }
    subscribeStatus(listener, options = {}) {
        this.assertNotDisposed('subscribe to runtime status');
        if (typeof listener !== 'function') {
            throw new TypeError('[ImageEditor] Status listener must be a function.');
        }
        this.statusListeners.add(listener);
        if (options.emitCurrent !== false)
            this.invokeStatusListener(listener, this.getRuntimeStatus());
        let active = true;
        return Object.freeze({
            dispose: () => {
                if (!active)
                    return;
                active = false;
                this.statusListeners.delete(listener);
            },
        });
    }
    on(eventName, listener) {
        this.assertNotDisposed('subscribe to a Core event');
        if (typeof listener !== 'function') {
            throw new TypeError('[ImageEditor] Core event listener must be a function.');
        }
        return this.plugins.onCommittedForHost(eventName, listener);
    }
    getDiagnostics() {
        return Object.freeze([...this.diagnostics]);
    }
    async init(elements) {
        this.lifecycle.beginInitialization();
        this.emitRuntimeStatus();
        let pluginInitializationStarted = false;
        let pluginInitializationCompleted = false;
        let initialImageLoadStarted = false;
        try {
            this.createCanvas(elements);
            pluginInitializationStarted = true;
            await this.plugins.initialize();
            pluginInitializationCompleted = true;
            if (this.options.initialImageBase64) {
                initialImageLoadStarted = true;
                this.initialImageLoadActive = true;
                try {
                    await this.performImageLoad(this.options.initialImageBase64);
                }
                finally {
                    this.initialImageLoadActive = false;
                }
            }
            else {
                this.updatePlaceholder();
            }
            this.lifecycle.completeInitialization();
            this.emitRuntimeStatus();
        }
        catch (error) {
            this.initialImageLoadActive = false;
            const cleanupErrors = await this.rollbackInitialization(error, pluginInitializationStarted, pluginInitializationCompleted);
            if (cleanupErrors.length > 0) {
                this.lifecycle.failInitialization();
                this.recordDiagnostic(error, 'Initialization failed and cleanup was incomplete.');
                for (const cleanupError of cleanupErrors) {
                    this.recordDiagnostic(cleanupError, 'Initialization cleanup failed.');
                }
            }
            else {
                this.lifecycle.recoverInitialization();
            }
            this.emitRuntimeStatus();
            if (initialImageLoadStarted)
                this.reportError(error, 'Initial image load failed.');
            throw error;
        }
    }
    createCanvas(elements) {
        var _a, _b, _c, _d, _e, _f;
        const ownerDocument = typeof elements.canvas === 'string'
            ? globalThis.document
            : (_a = elements.canvas) === null || _a === void 0 ? void 0 : _a.ownerDocument;
        if (!ownerDocument)
            throw new CoreRuntimeError('[ImageEditor] Canvas document is unavailable.');
        const canvasElement = resolveElement(elements.canvas, ownerDocument);
        if (!canvasElement ||
            canvasElement.tagName.toLowerCase() !== 'canvas' ||
            typeof canvasElement.getContext !== 'function') {
            throw new CoreRuntimeError('[ImageEditor] Core canvas element was not found.');
        }
        this.canvasElement = canvasElement;
        this.containerElement =
            (_b = resolveElement(elements.canvasContainer, ownerDocument)) !== null && _b !== void 0 ? _b : canvasElement.parentElement;
        this.placeholderElement = resolveElement(elements.imagePlaceholder, ownerDocument);
        const containerWidth = Math.floor((_d = (_c = this.containerElement) === null || _c === void 0 ? void 0 : _c.clientWidth) !== null && _d !== void 0 ? _d : 0);
        const containerHeight = Math.floor((_f = (_e = this.containerElement) === null || _e === void 0 ? void 0 : _e.clientHeight) !== null && _f !== void 0 ? _f : 0);
        const hasVisibleContainer = containerWidth > 0 && containerHeight > 0;
        const initialWidth = Math.max(1, Math.ceil(hasVisibleContainer ? containerWidth : this.options.canvasWidth));
        const initialHeight = Math.max(1, Math.ceil(hasVisibleContainer ? containerHeight : this.options.canvasHeight));
        this.assertRasterBudget(initialWidth, initialHeight);
        this.canvas = new this.fabric.Canvas(canvasElement, {
            width: initialWidth,
            height: initialHeight,
            backgroundColor: this.options.backgroundColor,
            selection: this.options.groupSelection,
            preserveObjectStacking: false,
        });
    }
    async loadImage(source, options = {}) {
        this.assertReady('load an image');
        await this.performImageLoad(source, options);
    }
    async performImageLoad(source, options = {}) {
        const encodedImage = inspectEncodedImageDataUrl(source);
        const sourceMimeType = inferMimeType(source);
        if (!sourceMimeType || !encodedImage) {
            throw new CoreRuntimeError('[ImageEditor] Unsupported image Data URL.');
        }
        if (encodedImage.encodedBytes > this.options.maxInputBytes) {
            throw new CoreRuntimeError('[ImageEditor] Image input exceeds maxInputBytes.');
        }
        if (encodedImage.dimensions &&
            !this.isInputRasterWithinBudget(encodedImage.dimensions.width, encodedImage.dimensions.height)) {
            throw new CoreRuntimeError('[ImageEditor] Image input dimensions exceed the configured budget.');
        }
        if (options.concurrency && options.concurrency !== 'replace-pending') {
            throw new CoreRuntimeError('[ImageEditor] Unsupported load concurrency policy.');
        }
        const preprocessing = resolveImagePreprocessing(options.preprocessing, this.options.imagePreprocessing);
        try {
            await this.plugins.runOperationForHost('core:load-image', source, async (loadSource, operationContext) => {
                const sequence = ++this.loadSequence;
                this.latestLoadSequence = sequence;
                const dimensions = encodedImage.dimensions;
                const processed = dimensions &&
                    requiresImagePreprocessing(sourceMimeType, dimensions.width, dimensions.height, preprocessing)
                    ? await withCoreTimeout((signal) => {
                        var _a, _b;
                        return preprocessImageDataUrl({
                            source: loadSource,
                            mimeType: sourceMimeType,
                            width: dimensions.width,
                            height: dimensions.height,
                            options: preprocessing,
                            ownerDocument: (_b = (_a = this.canvasElement) === null || _a === void 0 ? void 0 : _a.ownerDocument) !== null && _b !== void 0 ? _b : globalThis.document,
                            signal,
                        });
                    }, this.options.imageLoadTimeoutMs, 'Image preprocessing', operationContext.signal)
                    : Object.freeze({
                        source: loadSource,
                        mimeType: sourceMimeType,
                        width: 0,
                        height: 0,
                        sourceWidth: 0,
                        sourceHeight: 0,
                        orientation: 1,
                        orientationNormalized: false,
                        downsampled: false,
                    });
                const image = await withCoreTimeout((signal) => this.fabric.FabricImage.fromURL(processed.source, {
                    crossOrigin: 'anonymous',
                    signal,
                }), this.options.imageLoadTimeoutMs, 'FabricImage.fromURL', operationContext.signal, (lateImage) => lateImage.dispose());
                let imageAdopted = false;
                let previousScroll;
                try {
                    this.assertCurrentLoad(sequence, operationContext.signal);
                    const naturalWidth = Number(image.width) || 0;
                    const naturalHeight = Number(image.height) || 0;
                    if (!this.isInputRasterWithinBudget(naturalWidth, naturalHeight)) {
                        throw new CoreRuntimeError('[ImageEditor] Decoded image dimensions exceed the configured budget.');
                    }
                    previousScroll = this.containerElement
                        ? {
                            left: this.containerElement.scrollLeft,
                            top: this.containerElement.scrollTop,
                        }
                        : null;
                    await this.documentMutations.run({
                        id: `core:load-image-transaction:${sequence}`,
                        kind: 'raster',
                        operationId: 'core:commit-load-image',
                        conflictDomains: DOCUMENT_WIDE_MUTATION_CONFLICT_DOMAINS,
                        signal: operationContext.signal,
                        metadata: Object.freeze({
                            sequence,
                            downsampled: processed.downsampled,
                            orientationNormalized: processed.orientationNormalized,
                        }),
                        mutate: async (commitContext) => {
                            this.assertCurrentLoad(sequence, commitContext.signal);
                            const previousBaseImage = this.baseImage;
                            if (previousBaseImage) {
                                await this.plugins.notifyImageCleared();
                                this.assertCurrentLoad(sequence, commitContext.signal);
                            }
                            const canvas = this.requireCanvasForImageLoad('loadImage');
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
                            this.setCanvasSize(layout.canvasWidth, layout.canvasHeight);
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
                            imageAdopted = true;
                            this.imageLoaded = true;
                            this.baseImageScale = layout.imageScale;
                            this.imageMimeType = processed.mimeType;
                            this.geometryRevision += 1;
                            disposeReplacedBaseImage(previousBaseImage, baseImage, 'image replacement');
                            const imageInfo = this.getImageInfo();
                            if (!imageInfo) {
                                throw new Error('Loaded image information is unavailable.');
                            }
                            await this.plugins.notifyImageLoaded(imageInfo);
                            this.assertCurrentLoad(sequence, commitContext.signal);
                            return imageInfo;
                        },
                        validate: (imageInfo, commitContext) => {
                            if (!isCoreImageInfo(imageInfo)) {
                                throw new Error('Loaded image information is malformed.');
                            }
                            this.assertCurrentLoad(sequence, commitContext.signal);
                        },
                    });
                }
                catch (error) {
                    if (!imageAdopted) {
                        try {
                            disposeReplacedBaseImage(image, null, 'failed image load');
                        }
                        catch (cleanupError) {
                            throw new CoreRuntimeError('[ImageEditor] Image load failed and decoded image cleanup also failed.', {
                                cause: Object.freeze([error, cleanupError]),
                            });
                        }
                    }
                    throw error;
                }
                if (options.preserveScroll && previousScroll && this.containerElement) {
                    this.containerElement.scrollLeft = previousScroll.left;
                    this.containerElement.scrollTop = previousScroll.top;
                }
                this.updatePlaceholder();
            }, options.signal ? { signal: options.signal } : {});
        }
        catch (error) {
            if (!isLoadCancellation(error) && !this.initialImageLoadActive) {
                this.reportError(error, 'loadImage failed.');
            }
            throw error;
        }
    }
    async loadImageFile(file, options = {}) {
        var _a;
        if (!(file instanceof File))
            throw new TypeError('[ImageEditor] loadImageFile expects a File.');
        if (file.size > this.options.maxInputBytes) {
            throw new CoreRuntimeError('[ImageEditor] Image file exceeds maxInputBytes.');
        }
        if ((_a = options.signal) === null || _a === void 0 ? void 0 : _a.aborted) {
            throw loadAbortReason(options.signal, 'Image file read was aborted.');
        }
        const dataUrl = await new Promise((resolve, reject) => {
            var _a;
            const reader = new FileReader();
            const cleanup = () => { var _a; return (_a = options.signal) === null || _a === void 0 ? void 0 : _a.removeEventListener('abort', abort); };
            const abort = () => {
                reader.abort();
                cleanup();
                reject(loadAbortReason(options.signal, 'Image file read was aborted.'));
            };
            reader.onerror = () => {
                var _a;
                cleanup();
                reject((_a = reader.error) !== null && _a !== void 0 ? _a : new Error('FileReader failed.'));
            };
            reader.onload = () => {
                cleanup();
                if (typeof reader.result === 'string')
                    resolve(reader.result);
                else
                    reject(new Error('FileReader did not produce a Data URL.'));
            };
            (_a = options.signal) === null || _a === void 0 ? void 0 : _a.addEventListener('abort', abort, { once: true });
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
        try {
            const prepared = await this.snapshots.prepareForLoad(input, {
                ...(options.missingPluginPolicy
                    ? { missingPluginPolicy: options.missingPluginPolicy }
                    : {}),
                ...(options.migrations ? { migrations: options.migrations } : {}),
                ...(options.signal ? { signal: options.signal } : {}),
            });
            const sequence = ++this.stateLoadSequence;
            await this.documentMutations.run({
                id: `core:load-state-transaction:${sequence}`,
                kind: 'compound',
                operationId: 'core:load-state',
                conflictDomains: DOCUMENT_WIDE_MUTATION_CONFLICT_DOMAINS,
                ...(options.signal ? { signal: options.signal } : {}),
                metadata: Object.freeze({ sequence }),
                mutate: async (context) => {
                    await this.snapshots.loadPrepared(prepared, {
                        signal: context.signal,
                        rollbackOnFailure: false,
                    });
                    return Object.freeze({ schemaVersion: 3 });
                },
            });
            this.updatePlaceholder();
        }
        catch (error) {
            if (!isLoadCancellation(error))
                this.reportError(error, 'loadFromState failed.');
            throw error;
        }
    }
    exportImageBase64(options = {}) {
        return this.runExport(options);
    }
    async exportImageFile(options = {}) {
        const resolved = resolveExportOptions(options, this.options.exportDefaults);
        const dataUrl = await this.runExport(resolved);
        return base64ToFile(dataUrl, exportFileName(resolved.fileName, resolved.format));
    }
    isImageLoaded() {
        return this.imageLoaded && this.baseImage !== null;
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
        if (!isLayoutMode(mode)) {
            throw new TypeError('[ImageEditor] Layout mode must be "fit", "cover", or "expand".');
        }
        this.layoutMode = mode;
        this.viewportCache.clear();
        this.emitRuntimeStatus();
    }
    resizeCanvas(width, height) {
        var _a;
        this.assertReady('resize the Canvas');
        if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
            throw new TypeError('[ImageEditor] Canvas dimensions must be positive finite numbers.');
        }
        this.setCanvasSize(width, height);
        (_a = this.canvas) === null || _a === void 0 ? void 0 : _a.renderAll();
    }
    resizeToContainer() {
        var _a, _b, _c, _d, _e, _f;
        this.assertReady('resize the Canvas to its container');
        this.viewportCache.clear();
        const scrollbarSize = measureScrollbarSize((_d = (_b = (_a = this.containerElement) === null || _a === void 0 ? void 0 : _a.ownerDocument) !== null && _b !== void 0 ? _b : (_c = this.canvasElement) === null || _c === void 0 ? void 0 : _c.ownerDocument) !== null && _d !== void 0 ? _d : null);
        const viewport = this.viewportCache.measure(this.containerElement, { width: this.options.canvasWidth, height: this.options.canvasHeight }, scrollbarSize);
        const image = this.baseImage;
        if (!image) {
            this.setCanvasSize(viewport.width, viewport.height);
            (_e = this.canvas) === null || _e === void 0 ? void 0 : _e.renderAll();
            return;
        }
        image.setCoords();
        const bounds = image.getBoundingRect();
        const imageFitsViewport = bounds.width <= viewport.width + 0.5 && bounds.height <= viewport.height + 0.5;
        if (imageFitsViewport) {
            this.setCanvasSize(Math.max(1, viewport.width - 1), Math.max(1, viewport.height - 1));
        }
        else if (this.layoutMode === 'fit' || this.layoutMode === 'cover') {
            const size = computeScrollableCanvasSize(bounds.width, bounds.height, viewport, scrollbarSize);
            this.setCanvasSize(size.width, size.height);
        }
        else {
            this.setCanvasSize(Math.max(viewport.width, Math.ceil(bounds.left + bounds.width)), Math.max(viewport.height, Math.ceil(bounds.top + bounds.height)));
        }
        (_f = this.canvas) === null || _f === void 0 ? void 0 : _f.renderAll();
    }
    observeContainer(options = {}) {
        var _a;
        this.assertReady('observe the Canvas container');
        const container = this.containerElement;
        if (!container) {
            throw new CoreRuntimeError('[ImageEditor] Canvas container is unavailable.');
        }
        const ownerWindow = container.ownerDocument.defaultView;
        const ResizeObserverConstructor = (_a = ownerWindow === null || ownerWindow === void 0 ? void 0 : ownerWindow.ResizeObserver) !== null && _a !== void 0 ? _a : globalThis.ResizeObserver;
        if (typeof ResizeObserverConstructor !== 'function') {
            throw new CoreRuntimeError('[ImageEditor] ResizeObserver is unavailable.');
        }
        let active = true;
        let frame = null;
        const resize = () => {
            if (!active || this.isDisposingOrDisposed())
                return;
            try {
                this.resizeToContainer();
            }
            catch (error) {
                this.reportWarning(error, 'Responsive Canvas resize failed.');
            }
        };
        const observer = new ResizeObserverConstructor(() => {
            if (frame !== null)
                return;
            if (ownerWindow === null || ownerWindow === void 0 ? void 0 : ownerWindow.requestAnimationFrame) {
                frame = ownerWindow.requestAnimationFrame(() => {
                    frame = null;
                    resize();
                });
            }
            else {
                queueMicrotask(resize);
            }
        });
        observer.observe(container);
        if (options.resizeImmediately !== false)
            resize();
        return Object.freeze({
            dispose: () => {
                if (!active)
                    return;
                active = false;
                observer.disconnect();
                if (frame !== null && (ownerWindow === null || ownerWindow === void 0 ? void 0 : ownerWindow.cancelAnimationFrame)) {
                    ownerWindow.cancelAnimationFrame(frame);
                }
                frame = null;
            },
        });
    }
    async relayout(options = {}) {
        var _a;
        this.assertReady('recompute the image layout');
        const mode = (_a = options.mode) !== null && _a !== void 0 ? _a : this.layoutMode;
        if (!isLayoutMode(mode)) {
            throw new TypeError('[ImageEditor] Layout mode must be "fit", "cover", or "expand".');
        }
        const image = this.baseImage;
        if (!image) {
            this.layoutMode = mode;
            this.resizeToContainer();
            this.emitRuntimeStatus();
            return;
        }
        const canvas = this.requireCanvas('recompute the image layout');
        const rollback = Object.freeze({
            left: image.left,
            top: image.top,
            scaleX: image.scaleX,
            scaleY: image.scaleY,
            canvasWidth: canvas.getWidth(),
            canvasHeight: canvas.getHeight(),
            baseImageScale: this.baseImageScale,
            layoutMode: this.layoutMode,
        });
        const scroll = this.containerElement
            ? Object.freeze({
                left: this.containerElement.scrollLeft,
                top: this.containerElement.scrollTop,
            })
            : null;
        await this.geometry.run({
            id: `core:relayout:${++this.relayoutSequence}`,
            kind: 'transform',
            operationId: 'core:relayout',
            metadata: Object.freeze({ mode }),
            mutateBase: () => {
                this.layoutMode = mode;
                this.viewportCache.clear();
                const layout = this.computeLayout(image);
                this.setCanvasSize(layout.canvasWidth, layout.canvasHeight);
                image.set({
                    left: layout.imageLeft,
                    top: layout.imageTop,
                    scaleX: layout.imageScale,
                    scaleY: layout.imageScale,
                });
                image.setCoords();
                this.baseImageScale = layout.baseImageScale;
            },
            rollbackBase: () => {
                this.layoutMode = rollback.layoutMode;
                this.baseImageScale = rollback.baseImageScale;
                this.setCanvasSize(rollback.canvasWidth, rollback.canvasHeight);
                image.set({
                    left: rollback.left,
                    top: rollback.top,
                    scaleX: rollback.scaleX,
                    scaleY: rollback.scaleY,
                });
                image.setCoords();
            },
        });
        if (options.preserveScroll && scroll && this.containerElement) {
            this.containerElement.scrollLeft = scroll.left;
            this.containerElement.scrollTop = scroll.top;
        }
        this.emitRuntimeStatus();
    }
    emergencyReset() {
        if (this.emergencyResetPromise)
            return this.emergencyResetPromise;
        if (this.lifecycle.current !== 'faulted') {
            return Promise.reject(new CoreRuntimeError(`[ImageEditor] emergencyReset() is available only while the editor is faulted.`, { code: 'EMERGENCY_RESET_NOT_ALLOWED', behavior: 'lifecycle' }));
        }
        const reset = this.performEmergencyReset();
        this.emergencyResetPromise = reset;
        void reset.then(() => {
            if (this.emergencyResetPromise === reset)
                this.emergencyResetPromise = null;
        }, () => {
            if (this.emergencyResetPromise === reset)
                this.emergencyResetPromise = null;
        });
        return reset;
    }
    async forceDispose() {
        if (this.lifecycle.current === 'disposed')
            return;
        if (this.lifecycle.current !== 'faulted') {
            throw new CoreRuntimeError('[ImageEditor] forceDispose() is available only while the editor is faulted.', { code: 'FORCE_DISPOSE_NOT_ALLOWED', behavior: 'lifecycle' });
        }
        try {
            await this.disposeAsync();
        }
        catch (error) {
            this.recordDiagnostic(error, 'Forced disposal completed with cleanup failures.');
        }
    }
    dispose() {
        if (this.lifecycle.current === 'disposed' || this.lifecycle.current === 'disposing')
            return;
        if (this.geometry.isRunning ||
            this.documentMutations.isRunning ||
            this.plugins.hasRunningOperations()) {
            this.observeDetachedDisposal(this.disposeAsync());
            return;
        }
        if (!this.lifecycle.beginDisposal())
            return;
        this.emitRuntimeStatus();
        const errors = [];
        for (const cleanup of [
            () => this.plugins.disposeSync(),
            () => this.geometry.disposeSync(),
            () => this.documentMutations.disposeSync(),
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
        const canvas = this.canvas;
        try {
            this.clearRuntimeReferences();
        }
        catch (error) {
            errors.push(error);
        }
        let canvasDispose;
        if (canvas) {
            try {
                canvasDispose = canvas.dispose();
            }
            catch (error) {
                errors.push(error);
            }
        }
        if (canvasDispose && typeof canvasDispose.then === 'function') {
            const disposal = Promise.resolve(canvasDispose).then(() => this.completeDisposal(errors, 'Core disposal'), (error) => {
                errors.push(error);
                this.completeDisposal(errors, 'Core disposal');
            });
            this.disposePromise = disposal;
            this.observeDetachedDisposal(disposal);
            return;
        }
        try {
            this.completeDisposal(errors, 'Core disposal');
        }
        catch (error) {
            this.recordDiagnostic(error, 'Synchronous Core disposal completed with failures.');
            this.reportError(error, 'Synchronous Core disposal completed with failures.');
            throw error;
        }
    }
    disposeAsync() {
        var _a;
        if (this.disposePromise)
            return this.disposePromise;
        if (this.lifecycle.current === 'disposed')
            return Promise.resolve();
        if (!this.lifecycle.beginDisposal())
            return (_a = this.disposePromise) !== null && _a !== void 0 ? _a : Promise.resolve();
        this.emitRuntimeStatus();
        this.disposePromise = this.performDisposeAsync();
        return this.disposePromise;
    }
    async performEmergencyReset() {
        const failures = [];
        const abortReason = new DOMException('Core emergency reset aborted active work.', 'AbortError');
        await Promise.all([
            this.runEmergencyStep(failures, 'Operation abort failed during emergency reset.', () => this.plugins.abortOperationsForHost(abortReason)),
            this.runEmergencyStep(failures, 'Document mutation abort failed during emergency reset.', () => this.documentMutations.abortActive(abortReason)),
            this.runEmergencyStep(failures, 'Geometry mutation abort failed during emergency reset.', () => this.geometry.abortActive(abortReason)),
        ]);
        await this.runEmergencyStep(failures, 'Tool exit failed during emergency reset.', () => this.plugins.exitActiveToolForHost());
        const canvas = this.canvas;
        if (canvas) {
            await this.runEmergencyStep(failures, 'Canvas disposal failed during emergency reset.', () => canvas.dispose());
        }
        this.clearRuntimeReferences();
        await this.runEmergencyStep(failures, 'Plugin scope disposal failed during emergency reset.', () => this.plugins.dispose());
        await this.runEmergencyStep(failures, 'Snapshot reset failed during emergency reset.', () => this.snapshots.reset());
        await this.runEmergencyStep(failures, 'Memento reset failed during emergency reset.', () => this.mementos.reset());
        await this.runEmergencyStep(failures, 'Document mutation reset failed during emergency reset.', () => this.documentMutations.reset());
        await this.runEmergencyStep(failures, 'Geometry mutation reset failed during emergency reset.', () => this.geometry.reset());
        this.geometryRevision = 0;
        this.loadSequence = 0;
        this.latestLoadSequence = 0;
        this.stateLoadSequence = 0;
        this.layoutMode = this.options.layoutMode;
        this.disposePromise = null;
        if (failures.length > 0) {
            const failure = new CoreRuntimeError(`[ImageEditor] Emergency reset cleanup failed in ${failures.length} step(s).`, {
                code: 'EMERGENCY_RESET_CLEANUP_ERROR',
                cause: Object.freeze([...failures]),
                behavior: 'lifecycle',
            });
            await this.failEmergencyReset(failure);
        }
        try {
            await this.replayInstallationPlan();
        }
        catch (error) {
            this.recordDiagnostic(error, 'Plugin replay failed during emergency reset.');
            await this.failEmergencyReset(error);
        }
        this.lifecycle.recoverFault();
        this.emitRuntimeStatus();
    }
    async runEmergencyStep(failures, message, task) {
        try {
            await task();
        }
        catch (error) {
            failures.push(error);
            this.recordDiagnostic(error, message);
        }
    }
    async failEmergencyReset(cause) {
        await this.disposeAfterEmergencyFailure();
        throw new EmergencyResetError(this.getDiagnostics(), cause);
    }
    async disposeAfterEmergencyFailure() {
        if (!this.lifecycle.beginDisposal())
            return;
        this.emitRuntimeStatus();
        const cleanupSteps = [
            ['Plugin cleanup failed after emergency reset.', () => this.plugins.dispose()],
            ['Geometry cleanup failed after emergency reset.', () => this.geometry.dispose()],
            [
                'Document mutation cleanup failed after emergency reset.',
                () => this.documentMutations.dispose(),
            ],
            ['Snapshot cleanup failed after emergency reset.', () => this.snapshots.dispose()],
            [
                'Export registry cleanup failed after emergency reset.',
                () => this.exportContributors.dispose(),
            ],
            ['Memento cleanup failed after emergency reset.', () => this.mementos.dispose()],
            [
                'Transient registry cleanup failed after emergency reset.',
                () => this.transientObjects.dispose(),
            ],
            [
                'External object registry cleanup failed after emergency reset.',
                () => this.externalObjects.dispose(),
            ],
            [
                'Object property registry cleanup failed after emergency reset.',
                () => this.objectProperties.dispose(),
            ],
            ['State Slice cleanup failed after emergency reset.', () => this.slices.dispose()],
        ];
        for (const [message, cleanup] of cleanupSteps) {
            try {
                await cleanup();
            }
            catch (error) {
                this.recordDiagnostic(error, message);
            }
        }
        this.clearRuntimeReferences();
        this.lifecycle.completeDisposal();
        this.clearPluginApiHandles();
        this.emitRuntimeStatus();
        this.statusListeners.clear();
    }
    createPluginManager() {
        const manager = new PluginManager({
            warningSink: (warning) => this.reportWarning(warning.cause, warning.message),
            errorSink: (error) => this.reportError(error, 'Plugin lifecycle failed.'),
            activitySink: () => this.emitRuntimeStatus(),
            hostCapabilities: [
                {
                    token: CORE_ENVIRONMENT_CAPABILITY,
                    implementation: this.createEnvironmentPort(),
                },
                {
                    token: CORE_STATUS_CAPABILITY,
                    implementation: this.createStatusPort(),
                },
                {
                    token: CORE_DIAGNOSTICS_CAPABILITY,
                    implementation: this.createDiagnosticsPort(),
                },
                {
                    token: CORE_PRESENTATION_CAPABILITY,
                    implementation: this.createPresentationPort(),
                },
                {
                    token: FABRIC_RUNTIME_CAPABILITY,
                    implementation: this.createFabricRuntimePort(),
                    requiredPermission: 'fabric:objects',
                },
                {
                    token: CANVAS_READ_CAPABILITY,
                    implementation: this.createCanvasReadPort(),
                    requiredPermission: 'fabric:canvas-read',
                },
                {
                    token: BASE_IMAGE_READ_CAPABILITY,
                    implementation: this.createBaseImageReadPort(),
                },
                {
                    token: BASE_IMAGE_INFO_CAPABILITY,
                    implementation: this.createBaseImageInfoPort(),
                },
                {
                    token: IMAGE_RESOURCE_POLICY_CAPABILITY,
                    implementation: this.createImageResourcePolicyPort(),
                },
                {
                    token: RENDER_REQUEST_CAPABILITY,
                    implementation: this.createRenderRequestPort(),
                },
                {
                    token: CANVAS_RESIZE_CAPABILITY,
                    implementation: this.createCanvasResizePort(),
                },
                {
                    token: RASTER_MUTATION_CAPABILITY,
                    implementation: this.createRasterMutationPort(),
                    requiredPermission: 'core:raster-mutation',
                },
                {
                    token: SNAPSHOT_REGISTRATION_CAPABILITY,
                    implementation: this.createSnapshotRegistrationPort(),
                },
                {
                    token: MEMENTO_HISTORY_CAPABILITY,
                    implementation: this.createMementoHistoryPort(),
                },
                {
                    token: GEOMETRY_MUTATION_CAPABILITY,
                    implementation: this.geometry,
                    requiredPermission: 'core:geometry-participant',
                },
                { token: DOCUMENT_MUTATION_CAPABILITY, implementation: this.documentMutations },
                {
                    token: EXPORT_CONTRIBUTION_CAPABILITY,
                    implementation: this.exportContributors,
                    requiredPermission: 'core:export-contributor',
                },
            ],
        });
        manager.registerHostOperation({
            id: 'core:load-image',
            mode: 'busy',
            conflictDomains: ['image-decode'],
            reentrancy: 'replace',
        });
        manager.registerHostOperation({
            id: 'core:commit-load-image',
            mode: 'mutation',
            conflictDomains: DOCUMENT_WIDE_MUTATION_CONFLICT_DOMAINS,
            reentrancy: 'queue',
        });
        manager.registerHostOperation({
            id: 'core:load-state',
            mode: 'mutation',
            conflictDomains: DOCUMENT_WIDE_MUTATION_CONFLICT_DOMAINS,
            reentrancy: 'reject',
        });
        manager.registerHostOperation({
            id: 'core:export',
            mode: 'read',
            conflictDomains: ['document', 'base-image', 'overlay', 'export', 'state'],
            reentrancy: 'queue',
        });
        manager.registerHostOperation({
            id: 'core:relayout',
            mode: 'mutation',
            conflictDomains: [
                'document',
                'base-image',
                'geometry',
                'overlay',
                'selection',
                'state',
            ],
            reentrancy: 'replace',
        });
        return manager;
    }
    async rollbackInitialization(failure, pluginInitializationStarted, pluginInitializationCompleted) {
        const cleanupErrors = this.getInitializationCleanupErrors(failure);
        const canvas = this.canvas;
        if (pluginInitializationCompleted) {
            try {
                await this.plugins.dispose();
            }
            catch (error) {
                cleanupErrors.push(error);
            }
        }
        this.clearRuntimeReferences();
        if (canvas) {
            try {
                await canvas.dispose();
            }
            catch (error) {
                cleanupErrors.push(error);
            }
        }
        if (pluginInitializationStarted && cleanupErrors.length === 0) {
            try {
                await this.replayInstallationPlan();
            }
            catch (error) {
                cleanupErrors.push(error);
            }
        }
        return Object.freeze(cleanupErrors);
    }
    getInitializationCleanupErrors(failure) {
        return failure instanceof PluginLifecycleError ? [...failure.cleanupErrors] : [];
    }
    async replayInstallationPlan() {
        var _a, _b;
        const manager = this.createPluginManager();
        try {
            for (const planned of this.installationPlan) {
                manager.installSync(planned.definition);
            }
            const replayedApis = new Map();
            for (const pluginId of this.pluginApiHandles.keys()) {
                const api = manager.getById(pluginId);
                if (!isProxyablePluginApi(api)) {
                    throw new CoreRuntimeError(`[ImageEditor] Replayed Plugin "${pluginId}" did not return a stable object API.`, { code: 'PLUGIN_API_REPLAY_INCOMPATIBLE', behavior: 'lifecycle' });
                }
                replayedApis.set(pluginId, api);
            }
            for (const [pluginId, api] of replayedApis) {
                (_a = this.pluginApiHandles.get(pluginId)) === null || _a === void 0 ? void 0 : _a.handle.assertCompatible(api);
            }
            for (const [pluginId, api] of replayedApis) {
                (_b = this.pluginApiHandles.get(pluginId)) === null || _b === void 0 ? void 0 : _b.handle.update(api);
            }
        }
        catch (error) {
            await manager.dispose().catch(() => undefined);
            throw error;
        }
        this.plugins = manager;
    }
    publishPluginApi(pluginId, api) {
        if (!isProxyablePluginApi(api))
            return api;
        const existing = this.pluginApiHandles.get(pluginId);
        if (existing) {
            existing.handle.update(api);
            return existing.handle.api;
        }
        const lifecycle = this.lifecycle;
        const handle = new StablePluginApiHandle(pluginId, api, (operation) => {
            if (lifecycle.current !== 'disposing')
                lifecycle.assertAvailable(operation);
        });
        this.pluginApiHandles.set(pluginId, Object.freeze({ handle }));
        return handle.api;
    }
    clearPluginApiHandles() {
        for (const { handle } of this.pluginApiHandles.values())
            handle.clear();
    }
    createEnvironmentPort() {
        return Object.freeze({
            options: this.options,
            isDisposed: () => this.isDisposingOrDisposed(),
            reportWarning: (error, message) => this.reportWarning(error, message),
            reportError: (error, message) => this.reportError(error, message),
        });
    }
    createStatusPort() {
        return Object.freeze({ isDisposed: () => this.isDisposingOrDisposed() });
    }
    createDiagnosticsPort() {
        return Object.freeze({
            reportWarning: (error, message) => this.reportWarning(error, message),
            reportError: (error, message) => this.reportError(error, message),
        });
    }
    createPresentationPort() {
        const resolveLayoutMode = () => this.layoutMode;
        return Object.freeze({
            backgroundColor: this.options.backgroundColor,
            get layoutMode() {
                return resolveLayoutMode();
            },
        });
    }
    createFabricRuntimePort() {
        return Object.freeze({ fabric: this.fabric });
    }
    createCanvasReadPort() {
        return Object.freeze({
            getCanvas: () => this.canvas,
            requireCanvas: (operation) => this.requireCanvasForPlugin(operation),
        });
    }
    createBaseImageReadPort() {
        return Object.freeze({
            getBaseImage: () => this.baseImage,
            ...this.createBaseImageInfoPort(),
        });
    }
    createBaseImageInfoPort() {
        return Object.freeze({
            getBaseImageScale: () => this.baseImageScale,
            getGeometryRevision: () => this.geometryRevision,
            getCanvasSize: () => {
                var _a, _b, _c, _d;
                return Object.freeze({
                    width: (_b = (_a = this.canvas) === null || _a === void 0 ? void 0 : _a.getWidth()) !== null && _b !== void 0 ? _b : 0,
                    height: (_d = (_c = this.canvas) === null || _c === void 0 ? void 0 : _c.getHeight()) !== null && _d !== void 0 ? _d : 0,
                });
            },
            getImageInfo: () => this.getImageInfo(),
            isImageLoaded: () => this.isImageLoaded(),
        });
    }
    createImageResourcePolicyPort() {
        return Object.freeze({
            getImageResourcePolicy: () => Object.freeze({
                maxInputBytes: this.options.maxInputBytes,
                maxInputPixels: this.options.maxInputPixels,
                imageLoadTimeoutMs: this.options.imageLoadTimeoutMs,
                maxExportPixels: this.options.maxExportPixels,
                maxExportDimension: this.options.maxExportDimension,
            }),
        });
    }
    createRenderRequestPort() {
        return Object.freeze({ requestRender: () => this.requestRender() });
    }
    createCanvasResizePort() {
        return Object.freeze({
            resizeCanvas: (width, height) => this.setCanvasSize(width, height),
        });
    }
    createRasterMutationPort() {
        return Object.freeze({
            replaceBaseImage: (context, image, replacementOptions) => {
                var _a;
                this.documentMutations.assertContextActive(context);
                const canvas = this.requireCanvasForPlugin('replace the base image');
                if (this.baseImage && this.baseImage !== image)
                    canvas.remove(this.baseImage);
                markBaseImage(image);
                if (!canvas.getObjects().includes(image))
                    canvas.add(image);
                canvas.sendObjectToBack(image);
                this.baseImage = image;
                this.imageLoaded = true;
                this.baseImageScale = positiveFinite(replacementOptions === null || replacementOptions === void 0 ? void 0 : replacementOptions.baseScale, 1);
                this.imageMimeType = (_a = replacementOptions === null || replacementOptions === void 0 ? void 0 : replacementOptions.mimeType) !== null && _a !== void 0 ? _a : this.imageMimeType;
                this.geometryRevision += 1;
                this.updatePlaceholder();
            },
        });
    }
    createSnapshotRegistrationPort() {
        return Object.freeze({
            registerSlice: (definition) => this.slices.register(definition),
            registerObjectProperties: (registration) => this.objectProperties.register(registration),
            registerTransientObject: (owner, predicate) => this.transientObjects.register(owner, predicate),
            registerExternalObject: (owner, predicate) => this.externalObjects.register(owner, predicate),
        });
    }
    createMementoHistoryPort() {
        return Object.freeze({
            captureMemento: () => this.mementos.capture(),
            restoreMemento: (memento, options) => this.mementos.restore(memento, options),
            registerHistoryProvider: (owner, provider) => this.history.register(owner, provider),
            reportFatal: (error) => this.enterFaulted(error),
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
        canvas.renderAll();
    }
    setCanvasSize(width, height) {
        if (!this.canvas)
            return;
        const nextWidth = Math.max(1, Math.ceil(width));
        const nextHeight = Math.max(1, Math.ceil(height));
        this.assertRasterBudget(nextWidth, nextHeight);
        applyCanvasDimensions(this.canvas, nextWidth, nextHeight, this.containerElement);
    }
    isInputRasterWithinBudget(width, height) {
        return isRasterAllocationWithinBudget(width, height, {
            maxDimension: this.options.maxExportDimension,
            maxPixels: Math.min(this.options.maxInputPixels, this.options.maxExportPixels),
        });
    }
    assertRasterBudget(width, height, multiplier = 1) {
        if (!isRasterAllocationWithinBudget(width, height, {
            maxDimension: this.options.maxExportDimension,
            maxPixels: this.options.maxExportPixels,
        }, multiplier)) {
            throw new CoreRuntimeError('[ImageEditor] Dimensions exceed the configured budget.');
        }
    }
    async runExport(options) {
        var _a;
        this.assertReady('export an image');
        const resolved = resolveExportOptions(options, this.options.exportDefaults);
        const operation = this.plugins.beginOperationForHost('core:export');
        try {
            const canvas = this.requireCanvas('exportImageBase64');
            const multiplier = resolved.multiplier;
            const format = resolved.format;
            const quality = resolved.quality;
            let left = 0;
            let top = 0;
            let width = canvas.getWidth();
            let height = canvas.getHeight();
            if (resolved.area === 'image') {
                if (!this.baseImage)
                    throw new CoreRuntimeError('[ImageEditor] No image is loaded.');
                this.baseImage.setCoords();
                const bounds = this.baseImage.getBoundingRect();
                left = bounds.left;
                top = bounds.top;
                width = bounds.width;
                height = bounds.height;
            }
            this.assertRasterBudget(width, height, multiplier);
            this.assertRasterBudget(canvas.getWidth(), canvas.getHeight());
            const exportElement = (_a = this.canvasElement) === null || _a === void 0 ? void 0 : _a.ownerDocument.createElement('canvas');
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
                await this.exportContributors.render({ canvas: exportCanvas, options: resolved });
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
    async emitDocumentCommitted(descriptor) {
        var _a, _b, _c, _d;
        if (descriptor.kind === 'geometry') {
            await ((_a = this.plugins) === null || _a === void 0 ? void 0 : _a.emitCommitted('geometry:committed', descriptor.result));
            return;
        }
        if (descriptor.operationId === 'core:commit-load-image' &&
            isCoreImageInfo(descriptor.result)) {
            await ((_b = this.plugins) === null || _b === void 0 ? void 0 : _b.emitCommitted('image:loaded', descriptor.result));
            return;
        }
        if (descriptor.operationId === 'core:load-state') {
            await ((_c = this.plugins) === null || _c === void 0 ? void 0 : _c.emitCommitted('state:loaded', { schemaVersion: 3 }));
            return;
        }
        await ((_d = this.plugins) === null || _d === void 0 ? void 0 : _d.emitCommitted('document:committed', descriptor));
    }
    assertCurrentLoad(sequence, signal) {
        if (signal.aborted) {
            throw loadAbortReason(signal, 'Image load was aborted.');
        }
        if (sequence !== this.latestLoadSequence) {
            throw loadAbortError('Image load result is stale.');
        }
    }
    requireCanvas(operation) {
        this.assertReady(operation);
        if (!this.canvas)
            throw new CoreRuntimeError(`[ImageEditor] Cannot ${operation} without Canvas.`);
        return this.canvas;
    }
    requireCanvasForImageLoad(operation) {
        if (!this.initialImageLoadActive || this.lifecycle.current !== 'initializing') {
            return this.requireCanvas(operation);
        }
        if (!this.canvas)
            throw new CoreRuntimeError(`[ImageEditor] Cannot ${operation} without Canvas.`);
        return this.canvas;
    }
    requireCanvasForPlugin(operation) {
        if (this.lifecycle.current !== 'initializing')
            this.lifecycle.assertOperational(operation);
        if (!this.canvas)
            throw new CoreRuntimeError(`[ImageEditor] Cannot ${operation} without Canvas.`);
        return this.canvas;
    }
    requestRender() {
        var _a;
        if (this.lifecycle.current !== 'disposed')
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
    emitRuntimeStatus() {
        if (this.statusListeners.size === 0)
            return;
        const status = this.getRuntimeStatus();
        const previous = this.lastRuntimeStatus;
        if (previous &&
            previous.lifecycle === status.lifecycle &&
            previous.initialized === status.initialized &&
            previous.imageLoaded === status.imageLoaded &&
            previous.busy === status.busy &&
            previous.activeToolId === status.activeToolId &&
            previous.layoutMode === status.layoutMode &&
            previous.geometryRevision === status.geometryRevision) {
            return;
        }
        this.lastRuntimeStatus = status;
        for (const listener of [...this.statusListeners]) {
            this.invokeStatusListener(listener, status);
        }
    }
    invokeStatusListener(listener, status) {
        try {
            listener(status);
        }
        catch (error) {
            this.reportWarning(error, 'Runtime status listener failed.');
        }
    }
    enterFaulted(error) {
        const state = this.lifecycle.current;
        if (state === 'disposed' || state === 'disposing')
            return;
        if (state === 'initialized')
            this.lifecycle.failRuntime();
        else if (state !== 'faulted') {
            this.recordDiagnostic(error, `A fatal error occurred while Core was ${state}.`);
            return;
        }
        const suspension = this.plugins.suspendOperationsForHost(new EditorFaultedError('run an operation'));
        void suspension.catch((suspensionError) => {
            this.recordDiagnostic(suspensionError, 'Faulted operation suspension failed.');
        });
        this.recordDiagnostic(error);
        this.reportError(error, 'Core entered the faulted lifecycle state.');
        this.emitRuntimeStatus();
    }
    recordDiagnostic(error, message) {
        const classification = classifyCoreError(error);
        let errorCode;
        if (error && typeof error === 'object') {
            try {
                errorCode = Reflect.get(error, 'code');
            }
            catch {
                errorCode = undefined;
            }
        }
        const code = typeof errorCode === 'string' ? errorCode : 'UNCLASSIFIED_CORE_ERROR';
        const diagnostic = Object.freeze({
            ...classification,
            timestamp: Date.now(),
            code,
            message: message !== null && message !== void 0 ? message : (error instanceof Error ? error.message : String(error)),
            cause: error instanceof CoreRuntimeError && error.cause !== undefined
                ? error.cause
                : error,
        });
        this.diagnostics.push(diagnostic);
        if (this.diagnostics.length > MAX_RETAINED_DIAGNOSTICS) {
            this.diagnostics.splice(0, this.diagnostics.length - MAX_RETAINED_DIAGNOSTICS);
        }
        return diagnostic;
    }
    assertReady(operation) {
        this.lifecycle.assertOperational(operation);
        if (!this.canvas)
            throw new CoreRuntimeError(`[ImageEditor] Cannot ${operation} without Canvas.`);
    }
    assertDocumentMutationOperational(operation) {
        if (this.initialImageLoadActive && this.lifecycle.current === 'initializing')
            return;
        this.lifecycle.assertOperational(operation);
    }
    assertNotDisposed(operation) {
        this.lifecycle.assertAvailable(operation);
    }
    isDisposingOrDisposed() {
        return this.lifecycle.current === 'disposing' || this.lifecycle.current === 'disposed';
    }
    clearRuntimeReferences() {
        this.canvas = null;
        this.canvasElement = null;
        this.containerElement = null;
        this.placeholderElement = null;
        this.baseImage = null;
        this.imageLoaded = false;
        this.imageMimeType = null;
        this.baseImageScale = 1;
        this.viewportCache.clear();
    }
    async performDisposeAsync() {
        const errors = [];
        for (const cleanup of [
            () => this.geometry.dispose(),
            () => this.documentMutations.dispose(),
            () => this.plugins.dispose(),
            () => this.snapshots.dispose(),
            () => this.exportContributors.dispose(),
            () => this.mementos.dispose(),
            () => this.transientObjects.dispose(),
            () => this.externalObjects.dispose(),
            () => this.objectProperties.dispose(),
            () => this.slices.dispose(),
        ]) {
            try {
                await Promise.resolve(cleanup());
            }
            catch (error) {
                errors.push(error);
            }
        }
        const canvas = this.canvas;
        try {
            this.clearRuntimeReferences();
        }
        catch (error) {
            errors.push(error);
        }
        if (canvas) {
            try {
                await canvas.dispose();
            }
            catch (error) {
                errors.push(error);
            }
        }
        this.completeDisposal(errors, 'Async disposal');
    }
    completeDisposal(errors, label) {
        this.lifecycle.completeDisposal();
        this.clearPluginApiHandles();
        this.emitRuntimeStatus();
        this.statusListeners.clear();
        if (errors.length > 0) {
            throw new CoreRuntimeError(`[ImageEditor] ${label} completed with ${errors.length} cleanup error(s).`, { code: 'CORE_DISPOSE_ERROR', cause: Object.freeze(errors) });
        }
    }
    observeDetachedDisposal(disposal) {
        void disposal.catch((error) => {
            this.recordDiagnostic(error, 'Detached Core disposal completed with cleanup failures.');
            this.reportError(error, 'Detached Core disposal completed with cleanup failures.');
        });
    }
}
//# sourceMappingURL=image-editor-core.js.map