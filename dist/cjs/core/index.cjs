'use strict';

var errors = require('../chunks/errors-DeAfrgDC.cjs');
var affineMatrix = require('../chunks/affine-matrix-DRJ0b89x.cjs');
var pluginManifest = require('../chunks/plugin-manifest-DNqSyjh2.cjs');
var pluginIdentifier = require('../chunks/plugin-identifier-DPwx4Gkd.cjs');
var pluginManager = require('../chunks/plugin-manager-DhGvZdpX.cjs');
var pluginPlan = require('../chunks/plugin-plan-BBOVkUMI.cjs');
var imageBudget = require('../chunks/image-budget-DZeZeVWW.cjs');
var disposable = require('../chunks/disposable-pTo80E0l.cjs');
var coreCapabilities = require('../chunks/core-capabilities-CWNPa1MZ.cjs');

function forceReflow(element) {
    if (!element)
        return;
    void element.offsetWidth;
}

function selectLayoutStrategy(mode) {
    return mode;
}
class ViewportCache {
    constructor() {
        Object.defineProperty(this, "lastVisible", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
    }
    measure(container, fallback, scrollbarSize) {
        var _a;
        if (!container)
            return fallback;
        const containerWidth = Math.floor(container.clientWidth);
        const containerHeight = Math.floor(container.clientHeight);
        if (containerWidth > 0 && containerHeight > 0) {
            this.lastVisible = measureContainerViewport(container, fallback, scrollbarSize);
            return this.lastVisible;
        }
        return (_a = this.lastVisible) !== null && _a !== void 0 ? _a : fallback;
    }
    peek() {
        return this.lastVisible;
    }
    clear() {
        this.lastVisible = null;
    }
}
const OVERFLOW_EPSILON = 0.5;
function normalizeOverflowValue(value) {
    return String(value !== null && value !== void 0 ? value : '')
        .trim()
        .toLowerCase();
}
function getContainerOverflowValues(container) {
    var _a, _b;
    const style = container.style;
    let computedOverflow = '';
    let computedOverflowX = '';
    let computedOverflowY = '';
    const view = (_b = (_a = container.ownerDocument) === null || _a === void 0 ? void 0 : _a.defaultView) !== null && _b !== void 0 ? _b : (typeof window === 'undefined' ? null : window);
    if (typeof (view === null || view === void 0 ? void 0 : view.getComputedStyle) === 'function') {
        const computed = view.getComputedStyle(container);
        computedOverflow = computed.overflow;
        computedOverflowX = computed.overflowX;
        computedOverflowY = computed.overflowY;
    }
    const x = [
        normalizeOverflowValue(style === null || style === void 0 ? void 0 : style.overflow),
        normalizeOverflowValue(style === null || style === void 0 ? void 0 : style.overflowX),
        normalizeOverflowValue(computedOverflow),
        normalizeOverflowValue(computedOverflowX),
    ];
    const y = [
        normalizeOverflowValue(style === null || style === void 0 ? void 0 : style.overflow),
        normalizeOverflowValue(style === null || style === void 0 ? void 0 : style.overflowY),
        normalizeOverflowValue(computedOverflow),
        normalizeOverflowValue(computedOverflowY),
    ];
    return { x, y, all: [...x, ...y] };
}
function isAutoScrollableOverflow(value) {
    return value === 'auto' || value === 'overlay';
}
function measureScrollbarSize(ownerDocument) {
    const doc = ownerDocument !== null && ownerDocument !== void 0 ? ownerDocument : (typeof document === 'undefined' ? null : document);
    if (!(doc === null || doc === void 0 ? void 0 : doc.body))
        return { width: 0, height: 0 };
    const probe = doc.createElement('div');
    probe.style.position = 'absolute';
    probe.style.left = '-9999px';
    probe.style.top = '-9999px';
    probe.style.width = '100px';
    probe.style.height = '100px';
    probe.style.overflow = 'scroll';
    probe.style.visibility = 'hidden';
    probe.style.pointerEvents = 'none';
    doc.body.appendChild(probe);
    const width = Math.max(0, probe.offsetWidth - probe.clientWidth);
    const height = Math.max(0, probe.offsetHeight - probe.clientHeight);
    probe.remove();
    return { width, height };
}
function normalizeScrollbarSize(scrollbarSize) {
    return {
        width: Math.max(0, Number(scrollbarSize === null || scrollbarSize === void 0 ? void 0 : scrollbarSize.width) || 0),
        height: Math.max(0, Number(scrollbarSize === null || scrollbarSize === void 0 ? void 0 : scrollbarSize.height) || 0),
    };
}
function measureContainerViewport(container, fallback, scrollbarSize) {
    if (!container)
        return fallback;
    const clientWidth = Math.floor(container.clientWidth || 0);
    const clientHeight = Math.floor(container.clientHeight || 0);
    if (clientWidth <= 0 || clientHeight <= 0)
        return fallback;
    const overflow = getContainerOverflowValues(container);
    if (overflow.all.includes('scroll')) {
        return { width: clientWidth, height: clientHeight };
    }
    const scrollbar = normalizeScrollbarSize(scrollbarSize);
    const canAutoScrollX = overflow.x.some(isAutoScrollableOverflow);
    const canAutoScrollY = overflow.y.some(isAutoScrollableOverflow);
    const scrollWidth = Math.ceil(container.scrollWidth || 0);
    const scrollHeight = Math.ceil(container.scrollHeight || 0);
    const hasHorizontalScrollbar = canAutoScrollX && scrollWidth > clientWidth + OVERFLOW_EPSILON;
    const hasVerticalScrollbar = canAutoScrollY && scrollHeight > clientHeight + OVERFLOW_EPSILON;
    return {
        width: clientWidth + (hasVerticalScrollbar ? scrollbar.width : 0),
        height: clientHeight + (hasHorizontalScrollbar ? scrollbar.height : 0),
    };
}
function computeScrollableCanvasSize(contentWidth, contentHeight, viewport, scrollbarSize) {
    const viewportW = Math.max(1, viewport.width || 1);
    const viewportH = Math.max(1, viewport.height || 1);
    const scrollbar = normalizeScrollbarSize(scrollbarSize);
    let hasHorizontal = false;
    let hasVertical = false;
    for (let i = 0; i < 4; i += 1) {
        const effectiveW = Math.max(1, viewportW - (hasVertical ? scrollbar.width : 0));
        const effectiveH = Math.max(1, viewportH - (hasHorizontal ? scrollbar.height : 0));
        const nextHorizontal = contentWidth > effectiveW + OVERFLOW_EPSILON;
        const nextVertical = contentHeight > effectiveH + OVERFLOW_EPSILON;
        if (nextHorizontal === hasHorizontal && nextVertical === hasVertical)
            break;
        hasHorizontal = nextHorizontal;
        hasVertical = nextVertical;
    }
    const effectiveW = Math.max(1, viewportW - (hasVertical ? scrollbar.width : 0));
    const effectiveH = Math.max(1, viewportH - (hasHorizontal ? scrollbar.height : 0));
    return {
        width: hasHorizontal ? Math.ceil(contentWidth) : effectiveW,
        height: hasVertical ? Math.ceil(contentHeight) : effectiveH,
    };
}
function computeFitLayout(imageWidth, imageHeight, optionsCanvasWidth, optionsCanvasHeight, containerSize) {
    const canvasWidth = Math.max(1, (containerSize.width || optionsCanvasWidth) - 1);
    const canvasHeight = Math.max(1, (containerSize.height || optionsCanvasHeight) - 1);
    const fitScale = Math.min(canvasWidth / imageWidth, canvasHeight / imageHeight, 1);
    return {
        canvasWidth,
        canvasHeight,
        imageScale: fitScale,
        imageLeft: 0,
        imageTop: 0,
        baseImageScale: fitScale,
    };
}
function computeCoverLayout(imageWidth, imageHeight, optionsCanvasWidth, optionsCanvasHeight, containerSize, scrollbarSize) {
    const viewportW = containerSize.width || optionsCanvasWidth;
    const viewportH = containerSize.height || optionsCanvasHeight;
    const scrollbar = normalizeScrollbarSize(scrollbarSize);
    let hasHorizontal = false;
    let hasVertical = false;
    let coverScale = 1;
    let scaledW = imageWidth;
    let scaledH = imageHeight;
    for (let i = 0; i < 4; i += 1) {
        const effectiveW = Math.max(1, viewportW - (hasVertical ? scrollbar.width : 0));
        const effectiveH = Math.max(1, viewportH - (hasHorizontal ? scrollbar.height : 0));
        coverScale = Math.min(1, Math.max(effectiveW / imageWidth, effectiveH / imageHeight));
        scaledW = imageWidth * coverScale;
        scaledH = imageHeight * coverScale;
        const nextHasHorizontal = scaledW > effectiveW + OVERFLOW_EPSILON;
        const nextHasVertical = scaledH > effectiveH + OVERFLOW_EPSILON;
        if (nextHasHorizontal === hasHorizontal && nextHasVertical === hasVertical)
            break;
        hasHorizontal = nextHasHorizontal;
        hasVertical = nextHasVertical;
    }
    const canvasSize = computeScrollableCanvasSize(scaledW, scaledH, {
        width: viewportW,
        height: viewportH,
    }, scrollbar);
    return {
        canvasWidth: canvasSize.width,
        canvasHeight: canvasSize.height,
        imageScale: coverScale,
        imageLeft: 0,
        imageTop: 0,
        baseImageScale: coverScale,
    };
}
function computeExpandLayout(imageWidth, imageHeight, containerSize) {
    const canvasWidth = Math.max(containerSize.width, Math.floor(imageWidth));
    const canvasHeight = Math.max(containerSize.height, Math.floor(imageHeight));
    return {
        canvasWidth,
        canvasHeight,
        imageScale: 1,
        imageLeft: 0,
        imageTop: 0,
        baseImageScale: 1,
    };
}
function applyCanvasDimensions(canvas, width, height, containerElement) {
    const integerWidth = Math.max(1, Math.round(Number(width) || 1));
    const integerHeight = Math.max(1, Math.round(Number(height) || 1));
    canvas.setDimensions({ width: integerWidth, height: integerHeight });
    forceReflow(containerElement);
}

const DEFAULT_SECURITY_LIMITS = Object.freeze({
    maxDecodedPixels: 50000000,
    maxImageDimension: 32768,
    decodeTimeoutMs: 15000,
});
function isRecord$1(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isPositiveSafeInteger(value) {
    return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}
function isImageMimeType(value) {
    return value === 'image/jpeg' || value === 'image/png' || value === 'image/webp';
}
function isBaseImage(object) {
    return (object.editorObjectKind ===
        'baseImage');
}
class CanvasCoreStateAdapter {
    constructor(access, properties, transientObjects, externalObjects, securityLimits = DEFAULT_SECURITY_LIMITS) {
        Object.defineProperty(this, "access", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: access
        });
        Object.defineProperty(this, "properties", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: properties
        });
        Object.defineProperty(this, "transientObjects", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: transientObjects
        });
        Object.defineProperty(this, "externalObjects", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: externalObjects
        });
        Object.defineProperty(this, "securityLimits", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: securityLimits
        });
    }
    capture(context) {
        const canvas = this.access.getCanvas();
        if (!canvas) {
            return {
                initialized: false,
                canvasWidth: 0,
                canvasHeight: 0,
                canvas: null,
                imageMimeType: null,
                baseImageScale: 1,
                geometryRevision: this.access.getGeometryRevision(),
            };
        }
        const serializableCanvas = canvas;
        const serializedValue = serializableCanvas.toJSON(this.properties.listKeys());
        if (!isRecord$1(serializedValue)) {
            throw new errors.SnapshotValidationError('Fabric canvas serialization must be an object.');
        }
        const serialized = { ...serializedValue };
        const serializedObjects = Array.isArray(serialized.objects) ? serialized.objects : [];
        const liveObjects = canvas.getObjects();
        const propertyKeys = this.properties.listKeys();
        for (let index = 0; index < serializedObjects.length; index += 1) {
            const serializedObject = serializedObjects[index];
            const liveObject = liveObjects[index];
            if (!isRecord$1(serializedObject) || !liveObject)
                continue;
            const liveRecord = liveObject;
            for (const key of propertyKeys) {
                if (liveRecord[key] !== undefined)
                    serializedObject[key] = liveRecord[key];
            }
        }
        serialized.objects = serializedObjects.filter((entry, index) => {
            const liveObject = liveObjects[index];
            if (!entry ||
                !liveObject ||
                this.transientObjects.isTransient(liveObject) ||
                this.externalObjects.isTransient(liveObject))
                return false;
            if (context.mode === 'snapshot')
                return isBaseImage(liveObject);
            return true;
        });
        return {
            initialized: true,
            canvasWidth: canvas.getWidth(),
            canvasHeight: canvas.getHeight(),
            canvas: serialized,
            imageMimeType: this.access.getImageMimeType(),
            baseImageScale: this.access.getBaseImageScale(),
            geometryRevision: this.access.getGeometryRevision(),
        };
    }
    async restore(state, context) {
        var _a, _b, _c;
        if (this.access.isDisposed()) {
            throw new Error('Cannot restore Core state after disposal.');
        }
        const validated = this.validateState(state, context.mode === 'public-snapshot');
        if (!validated.valid)
            throw new errors.SnapshotValidationError(validated.message, validated.path);
        const next = validated.value;
        if (!next.initialized) {
            const canvas = this.access.getCanvas();
            canvas === null || canvas === void 0 ? void 0 : canvas.clear();
            this.access.setBaseImage(null);
            this.access.setImageMimeType(null);
            this.access.setBaseImageScale(1);
            this.access.setGeometryRevision(next.geometryRevision);
            return;
        }
        if (context.signal.aborted)
            throw (_a = context.signal.reason) !== null && _a !== void 0 ? _a : new Error('State restore aborted.');
        const canvas = this.access.getCanvas();
        if (!canvas)
            throw new Error('Core Canvas must be initialized before state restore.');
        this.access.setCanvasSize(next.canvasWidth, next.canvasHeight);
        if (!next.canvas)
            throw new Error('Initialized Core state requires Canvas JSON.');
        const controller = new AbortController();
        const abort = () => controller.abort(context.signal.reason);
        context.signal.addEventListener('abort', abort, { once: true });
        if (context.signal.aborted)
            abort();
        const timeout = setTimeout(() => {
            controller.abort(new errors.SnapshotValidationError(`Canvas decode timed out after ${this.securityLimits.decodeTimeoutMs}ms.`, '$.core.canvas'));
        }, this.securityLimits.decodeTimeoutMs);
        try {
            await canvas.loadFromJSON(next.canvas, undefined, { signal: controller.signal });
        }
        catch (error) {
            if (controller.signal.aborted && controller.signal.reason) {
                throw controller.signal.reason;
            }
            throw error;
        }
        finally {
            clearTimeout(timeout);
            context.signal.removeEventListener('abort', abort);
        }
        if (context.signal.aborted)
            throw (_b = context.signal.reason) !== null && _b !== void 0 ? _b : new Error('State restore aborted.');
        const baseImages = canvas.getObjects().filter(isBaseImage);
        if (baseImages.length > 1)
            throw new Error('Restored Core state contains multiple base images.');
        const baseImage = (_c = baseImages[0]) !== null && _c !== void 0 ? _c : null;
        if (baseImage) {
            baseImage.set({ selectable: false, evented: false });
            baseImage.setCoords();
            canvas.sendObjectToBack(baseImage);
        }
        this.access.setBaseImage(baseImage);
        this.access.setImageMimeType(next.imageMimeType);
        this.access.setBaseImageScale(next.baseImageScale);
        this.access.setGeometryRevision(next.geometryRevision);
    }
    validateSnapshot(value) {
        return this.validateState(value, true);
    }
    validateState(value, publicInput) {
        if (!isRecord$1(value))
            return { valid: false, message: 'Core state must be an object.' };
        if (typeof value.initialized !== 'boolean') {
            return {
                valid: false,
                message: 'initialized must be boolean.',
                path: '$.core.initialized',
            };
        }
        if (!Number.isSafeInteger(value.geometryRevision) || Number(value.geometryRevision) < 0) {
            return {
                valid: false,
                message: 'geometryRevision must be a non-negative integer.',
                path: '$.core:geometryRevision',
            };
        }
        if (!value.initialized) {
            return {
                valid: true,
                value: {
                    initialized: false,
                    canvasWidth: 0,
                    canvasHeight: 0,
                    canvas: null,
                    imageMimeType: null,
                    baseImageScale: 1,
                    geometryRevision: Number(value.geometryRevision),
                },
            };
        }
        if (!isPositiveSafeInteger(value.canvasWidth) ||
            !isPositiveSafeInteger(value.canvasHeight)) {
            return {
                valid: false,
                message: 'Canvas dimensions must be positive safe integers.',
                path: '$.core.canvasWidth',
            };
        }
        if (!imageBudget.isRasterAllocationWithinBudget(value.canvasWidth, value.canvasHeight, {
            maxDimension: this.securityLimits.maxImageDimension,
            maxPixels: this.securityLimits.maxDecodedPixels,
        })) {
            return {
                valid: false,
                message: 'Canvas dimensions exceed the configured Snapshot budget.',
                path: '$.core.canvasWidth',
            };
        }
        if (!isRecord$1(value.canvas)) {
            return { valid: false, message: 'canvas must be an object.', path: '$.core.canvas' };
        }
        if (publicInput) {
            const objects = value.canvas.objects;
            if (!Array.isArray(objects)) {
                return {
                    valid: false,
                    message: 'Canvas objects must be an array.',
                    path: '$.core.canvas.objects',
                };
            }
            for (let index = 0; index < objects.length; index += 1) {
                const object = objects[index];
                if (!isRecord$1(object)) {
                    return {
                        valid: false,
                        message: 'Canvas object must be a record.',
                        path: `$.core.canvas.objects.${index}`,
                    };
                }
                if (object.type !== 'Image') {
                    return {
                        valid: false,
                        message: `unknown Fabric class "${String(object.type)}".`,
                        path: `$.core.canvas.objects.${index}.type`,
                    };
                }
                if (object.editorObjectKind !== 'baseImage') {
                    return {
                        valid: false,
                        message: 'persistent Canvas objects require an installed Object Codec.',
                        path: `$.core.canvas.objects.${index}.editorObjectKind`,
                    };
                }
                if ('filters' in object &&
                    (!Array.isArray(object.filters) || object.filters.length > 0)) {
                    return {
                        valid: false,
                        message: 'Base Image Fabric filters are not accepted in public Snapshots.',
                        path: `$.core.canvas.objects.${index}.filters`,
                    };
                }
            }
            if (objects.length > 1) {
                return {
                    valid: false,
                    message: 'Public Core Snapshot may contain at most one base image.',
                    path: '$.core.canvas.objects',
                };
            }
        }
        if (value.imageMimeType !== null &&
            value.imageMimeType !== undefined &&
            !isImageMimeType(value.imageMimeType)) {
            return {
                valid: false,
                message: 'imageMimeType is unsupported.',
                path: '$.core.imageMimeType',
            };
        }
        if (typeof value.baseImageScale !== 'number' ||
            !Number.isFinite(value.baseImageScale) ||
            value.baseImageScale <= 0) {
            return {
                valid: false,
                message: 'baseImageScale must be positive and finite.',
                path: '$.core.baseImageScale',
            };
        }
        return {
            valid: true,
            value: {
                initialized: true,
                canvasWidth: value.canvasWidth,
                canvasHeight: value.canvasHeight,
                canvas: value.canvas,
                imageMimeType: isImageMimeType(value.imageMimeType) ? value.imageMimeType : null,
                baseImageScale: value.baseImageScale,
                geometryRevision: Number(value.geometryRevision),
            },
        };
    }
}

class ExportContributorRegistry {
    constructor() {
        Object.defineProperty(this, "contributors", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "registrationSequence", {
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
    register(owner, contributor) {
        this.assertActive('register an export contributor');
        if (!pluginIdentifier.isRuntimeIdentifier(owner)) {
            throw new errors.CoreRuntimeError('[ImageEditor] Invalid Export contributor owner Runtime ID.');
        }
        if (!pluginIdentifier.isRuntimeIdentifier(contributor.id)) {
            throw new errors.CoreRuntimeError('[ImageEditor] Invalid Export contributor Runtime ID.');
        }
        if (!Number.isFinite(contributor.order)) {
            throw new errors.CoreRuntimeError(`[ImageEditor] Export contributor "${contributor.id}" must use a finite order.`);
        }
        const existing = this.contributors.get(contributor.id);
        if (existing) {
            throw new errors.CoreRuntimeError(`[ImageEditor] Export contributor "${contributor.id}" is already registered by "${existing.owner}".`);
        }
        const record = {
            owner,
            contributor: Object.freeze({ ...contributor }),
            registrationOrder: this.registrationSequence++,
        };
        this.contributors.set(contributor.id, record);
        return disposable.createDisposable(() => {
            if (this.contributors.get(contributor.id) === record) {
                this.contributors.delete(contributor.id);
            }
        });
    }
    async render(context) {
        this.assertActive('render export contributors');
        const records = [...this.contributors.values()].sort((left, right) => left.contributor.order - right.contributor.order ||
            left.registrationOrder - right.registrationOrder);
        for (const record of records) {
            let enabled;
            try {
                enabled = record.contributor.isEnabled(context.options);
            }
            catch (error) {
                throw new errors.CoreRuntimeError(`[ImageEditor] Export contributor "${record.contributor.id}" enablement failed.`, { code: 'EXPORT_CONTRIBUTOR_ERROR', cause: error });
            }
            if (!enabled)
                continue;
            try {
                await record.contributor.render(context);
            }
            catch (error) {
                throw new errors.CoreRuntimeError(`[ImageEditor] Export contributor "${record.contributor.id}" render failed.`, { code: 'EXPORT_CONTRIBUTOR_ERROR', cause: error });
            }
        }
    }
    dispose() {
        if (this.disposed)
            return;
        this.contributors.clear();
        this.disposed = true;
    }
    assertActive(operation) {
        if (this.disposed) {
            throw new errors.CoreRuntimeError(`[ImageEditor] Cannot ${operation} after disposal.`);
        }
    }
}

function isObject(value) {
    return typeof value === 'object' && value !== null;
}
function assertSafeStateValue(value, seen = new WeakSet(), path = '$') {
    var _a;
    if (!isObject(value) || seen.has(value))
        return;
    seen.add(value);
    if (value instanceof Map) {
        for (const [key, entry] of value) {
            assertSafeStateValue(key, seen, `${path}.<map-key>`);
            assertSafeStateValue(entry, seen, `${path}.<map-value>`);
        }
        return;
    }
    if (value instanceof Set) {
        for (const entry of value)
            assertSafeStateValue(entry, seen, `${path}.<set-value>`);
        return;
    }
    if (value instanceof Date || value instanceof ArrayBuffer || ArrayBuffer.isView(value))
        return;
    for (const key of Object.getOwnPropertySymbols(value)) {
        if ((_a = Object.getOwnPropertyDescriptor(value, key)) === null || _a === void 0 ? void 0 : _a.enumerable) {
            throw new errors.StateCloneError(`State at ${path} contains an enumerable symbol key.`);
        }
    }
    const descriptors = Object.getOwnPropertyDescriptors(value);
    for (const [key, descriptor] of Object.entries(descriptors)) {
        if (!(descriptor === null || descriptor === void 0 ? void 0 : descriptor.enumerable))
            continue;
        if (pluginIdentifier.isDangerousStateKey(key)) {
            throw new errors.StateCloneError(`State contains dangerous key "${key}".`);
        }
        if (!('value' in descriptor)) {
            throw new errors.StateCloneError(`State at ${path}.${key} contains an accessor property.`);
        }
        assertSafeStateValue(descriptor.value, seen, `${path}.${key}`);
    }
}
function cloneFallback(value, seen) {
    var _a, _b;
    if (!isObject(value)) {
        if (typeof value === 'function' || typeof value === 'symbol') {
            throw new errors.StateCloneError(`State contains an unsupported ${typeof value} value.`);
        }
        return value;
    }
    const existing = seen.get(value);
    if (existing !== undefined)
        return existing;
    if (value instanceof Date)
        return new Date(value.getTime());
    if (value instanceof ArrayBuffer)
        return value.slice(0);
    if (ArrayBuffer.isView(value)) {
        const source = value;
        return new Uint8Array(source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength));
    }
    if (value instanceof Map) {
        const result = new Map();
        seen.set(value, result);
        for (const [key, entry] of value) {
            result.set(cloneFallback(key, seen), cloneFallback(entry, seen));
        }
        return result;
    }
    if (value instanceof Set) {
        const result = new Set();
        seen.set(value, result);
        for (const entry of value)
            result.add(cloneFallback(entry, seen));
        return result;
    }
    if (Array.isArray(value)) {
        const result = [];
        seen.set(value, result);
        for (const entry of value)
            result.push(cloneFallback(entry, seen));
        return result;
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
        throw new errors.StateCloneError(`State contains unsupported object type "${(_b = (_a = prototype === null || prototype === void 0 ? void 0 : prototype.constructor) === null || _a === void 0 ? void 0 : _a.name) !== null && _b !== void 0 ? _b : 'unknown'}".`);
    }
    const result = Object.create(null);
    seen.set(value, result);
    for (const key of Object.keys(value)) {
        if (pluginIdentifier.isDangerousStateKey(key)) {
            throw new errors.StateCloneError(`State contains dangerous key "${key}".`);
        }
        result[key] = cloneFallback(value[key], seen);
    }
    return result;
}
function deepFreeze(value, seen = new WeakSet()) {
    if (!isObject(value) || seen.has(value))
        return value;
    seen.add(value);
    if (value instanceof Map) {
        for (const [key, entry] of value) {
            deepFreeze(key, seen);
            deepFreeze(entry, seen);
        }
    }
    else if (value instanceof Set) {
        for (const entry of value)
            deepFreeze(entry, seen);
    }
    else {
        for (const key of Object.keys(value)) {
            deepFreeze(value[key], seen);
        }
    }
    try {
        Object.freeze(value);
    }
    catch {
    }
    return value;
}
function cloneStateValue(value) {
    try {
        assertSafeStateValue(value);
        const structuredCloneFunction = globalThis.structuredClone;
        const cloned = typeof structuredCloneFunction === 'function'
            ? structuredCloneFunction(value)
            : cloneFallback(value, new Map());
        return deepFreeze(cloned);
    }
    catch (error) {
        if (error instanceof errors.StateCloneError)
            throw error;
        throw new errors.StateCloneError('State could not be cloned safely.', error);
    }
}
function assertSafeImmutableReference(value, path = '$', seen = new WeakSet()) {
    var _a, _b;
    if (typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint') {
        throw new errors.StateCloneError(`Reference state at ${path} contains an unsupported ${typeof value}.`);
    }
    if (typeof value === 'number' && !Number.isFinite(value)) {
        throw new errors.StateCloneError(`Reference state at ${path} contains a non-finite number.`);
    }
    if (!isObject(value))
        return;
    if (seen.has(value)) {
        throw new errors.StateCloneError(`Reference state at ${path} contains a cyclic reference.`);
    }
    if (!Object.isFrozen(value)) {
        throw new errors.StateCloneError(`Reference state at ${path} must be frozen.`);
    }
    const prototype = Object.getPrototypeOf(value);
    if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) {
        throw new errors.StateCloneError(`Reference state at ${path} contains unsupported object type "${(_b = (_a = prototype === null || prototype === void 0 ? void 0 : prototype.constructor) === null || _a === void 0 ? void 0 : _a.name) !== null && _b !== void 0 ? _b : 'unknown'}".`);
    }
    seen.add(value);
    for (const key of Object.keys(value)) {
        if (pluginIdentifier.isDangerousStateKey(key)) {
            throw new errors.StateCloneError(`Reference state at ${path} contains dangerous key "${key}".`);
        }
        assertSafeImmutableReference(value[key], Array.isArray(value) ? `${path}[${key}]` : `${path}.${key}`, seen);
    }
    seen.delete(value);
}

function assertIdentifier$2(value, label) {
    if (value.trim().length === 0 || value.trim() !== value) {
        throw new errors.GeometryMutationError(value || 'unknown', `${label} must be non-empty and trimmed.`);
    }
}
function freezeGeometry(snapshot) {
    if (!affineMatrix.isFiniteAffineMatrix(snapshot.matrix) ||
        !Number.isFinite(snapshot.canvasWidth) ||
        !Number.isFinite(snapshot.canvasHeight) ||
        !Number.isSafeInteger(snapshot.revision) ||
        snapshot.revision < 0) {
        throw new errors.GeometryMutationError('geometry', 'captured geometry is malformed.');
    }
    return Object.freeze({
        ...snapshot,
        matrix: Object.freeze([...snapshot.matrix]),
        boundingBox: Object.freeze({ ...snapshot.boundingBox }),
    });
}
function createDescriptor(request, before, after, metadata, provisional) {
    const affineDelta = provisional
        ? affineMatrix.IDENTITY_AFFINE_MATRIX
        : request.kind === 'raster-replace'
            ? null
            : affineMatrix.computeAffineDelta(before.matrix, after.matrix);
    return Object.freeze({
        id: request.id,
        kind: request.kind,
        operationId: request.operationId,
        before,
        after,
        affineDelta,
        hasReflection: affineDelta ? affineMatrix.hasAffineReflection(affineDelta) : false,
        sourceRect: request.sourceRect ? Object.freeze({ ...request.sourceRect }) : undefined,
        targetSize: request.targetSize ? Object.freeze({ ...request.targetSize }) : undefined,
        metadata,
    });
}
class GeometryMutationCoordinator {
    constructor(options) {
        Object.defineProperty(this, "options", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: options
        });
        Object.defineProperty(this, "participants", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "usedMutationIds", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Set()
        });
        Object.defineProperty(this, "activeControllers", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Set()
        });
        Object.defineProperty(this, "activePromises", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Set()
        });
        Object.defineProperty(this, "registrationCounter", {
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
    get isRunning() {
        return this.activePromises.size > 0;
    }
    registerParticipant(participant) {
        this.assertActive('register a participant');
        assertIdentifier$2(participant.id, 'Participant id');
        if (!Number.isFinite(participant.order)) {
            throw new errors.GeometryRegistrationError(`Geometry participant "${participant.id}" must use a finite order.`, participant.id);
        }
        if (this.participants.has(participant.id)) {
            throw new errors.GeometryRegistrationError(`Geometry participant "${participant.id}" is already registered.`, participant.id);
        }
        const record = {
            participant: Object.freeze({ ...participant }),
            registrationOrder: this.registrationCounter++,
        };
        this.participants.set(participant.id, record);
        return disposable.createDisposable(() => {
            if (this.participants.get(participant.id) === record) {
                this.participants.delete(participant.id);
            }
        });
    }
    run(request) {
        this.assertActive('run a geometry mutation');
        let metadata;
        try {
            metadata = this.validateRequest(request);
        }
        catch (error) {
            return Promise.reject(error);
        }
        const controller = new AbortController();
        this.activeControllers.add(controller);
        const operation = this.performRun(request, metadata, controller.signal);
        this.activePromises.add(operation);
        return operation.finally(() => {
            this.activePromises.delete(operation);
            this.activeControllers.delete(controller);
        });
    }
    async dispose() {
        if (this.disposed)
            return;
        this.disposed = true;
        for (const controller of this.activeControllers) {
            controller.abort(new DOMException('Geometry coordinator was disposed.', 'AbortError'));
        }
        await Promise.allSettled([...this.activePromises]);
        this.participants.clear();
        this.usedMutationIds.clear();
    }
    async abortActive(reason) {
        this.assertActive('abort geometry mutations');
        for (const controller of this.activeControllers)
            controller.abort(reason);
        await Promise.allSettled([...this.activePromises]);
    }
    reset() {
        this.assertActive('reset geometry mutations');
        if (this.activePromises.size > 0) {
            throw new errors.GeometryRegistrationError('Cannot reset while a geometry mutation is active.');
        }
        this.participants.clear();
        this.usedMutationIds.clear();
        this.registrationCounter = 0;
    }
    disposeSync() {
        if (this.disposed)
            return;
        if (this.activePromises.size > 0) {
            throw new errors.GeometryRegistrationError('Cannot synchronously dispose an active geometry mutation.');
        }
        this.disposed = true;
        this.participants.clear();
        this.usedMutationIds.clear();
    }
    async performRun(request, metadata, signal) {
        var _a, _b;
        let before = null;
        let provisional = null;
        const participantSnapshot = Object.freeze([...this.participants.values()].sort((left, right) => left.participant.order - right.participant.order ||
            left.registrationOrder - right.registrationOrder));
        const geometryParticipant = Object.freeze({
            id: 'core:geometry-participants',
            order: 0,
            prepare: async (context) => {
                const capturedBefore = freezeGeometry(this.options.state.captureGeometry());
                const provisionalDescriptor = createDescriptor(request, capturedBefore, capturedBefore, metadata, true);
                before = capturedBefore;
                provisional = provisionalDescriptor;
                const participantContext = this.createParticipantContext(request.id, context.signal);
                const entries = [];
                for (const record of participantSnapshot) {
                    if (!record.participant.supports(provisionalDescriptor))
                        continue;
                    const prepared = record.participant.prepare
                        ? await record.participant.prepare(provisionalDescriptor, participantContext)
                        : undefined;
                    entries.push({ record, prepared });
                }
                return Object.freeze({
                    entries: Object.freeze(entries),
                    context: participantContext,
                });
            },
            apply: async (descriptor, prepared) => {
                for (const entry of prepared.entries) {
                    try {
                        await entry.record.participant.apply(descriptor, entry.prepared, prepared.context);
                    }
                    catch (error) {
                        if (error instanceof errors.GeometryRecoverableObjectError) {
                            this.warnRecoverable(request.id, entry.record.participant.id, error);
                            continue;
                        }
                        throw error;
                    }
                }
            },
            synchronize: async (descriptor, prepared) => {
                var _a, _b;
                for (const entry of prepared.entries) {
                    try {
                        await ((_b = (_a = entry.record.participant).synchronize) === null || _b === void 0 ? void 0 : _b.call(_a, descriptor, prepared.context));
                    }
                    catch (error) {
                        if (error instanceof errors.GeometryRecoverableObjectError) {
                            this.warn({
                                code: 'GEOMETRY_SYNCHRONIZE_WARNING',
                                message: error.message,
                                mutationId: request.id,
                                participantId: entry.record.participant.id,
                                objectIdentity: error.objectIdentity,
                                objectKind: error.objectKind,
                                cause: error.cause,
                            });
                            continue;
                        }
                        throw error;
                    }
                }
            },
            rollback: participantSnapshot.some(({ participant }) => participant.rollback)
                ? async (prepared, rollbackContext) => {
                    var _a, _b, _c;
                    const descriptor = (_a = rollbackContext.result) !== null && _a !== void 0 ? _a : provisional;
                    if (!descriptor)
                        return;
                    for (let index = prepared.entries.length - 1; index >= 0; index -= 1) {
                        const entry = prepared.entries[index];
                        if (!entry)
                            continue;
                        await ((_c = (_b = entry.record.participant).rollback) === null || _c === void 0 ? void 0 : _c.call(_b, descriptor, entry.prepared, prepared.context));
                    }
                }
                : undefined,
        });
        try {
            return await this.options.mutations.run({
                id: request.id,
                kind: 'geometry',
                operationId: request.operationId,
                conflictDomains: ['document', 'base-image', 'geometry', 'overlay', 'state'],
                signal,
                parent: request.parent,
                metadata,
                participants: [geometryParticipant],
                mutate: async (context) => {
                    const capturedBefore = before;
                    if (!capturedBefore) {
                        throw new errors.GeometryMutationError(request.id, 'geometry preparation did not capture the before state.');
                    }
                    await request.mutateBase(Object.freeze({ signal: context.signal, transaction: context }));
                    await this.options.state.finalizeGeometry();
                    const after = freezeGeometry(this.options.state.captureGeometry());
                    if (after.revision <= capturedBefore.revision) {
                        throw new errors.GeometryMutationError(request.id, `geometry revision must increase (${capturedBefore.revision} -> ${after.revision}).`);
                    }
                    return createDescriptor(request, capturedBefore, after, metadata, false);
                },
                rollback: request.rollbackBase
                    ? async (context) => {
                        var _a, _b, _c;
                        await ((_a = request.rollbackBase) === null || _a === void 0 ? void 0 : _a.call(request, Object.freeze({ signal: context.signal, cause: context.cause })));
                        if (before)
                            await ((_c = (_b = this.options.state).restoreGeometry) === null || _c === void 0 ? void 0 : _c.call(_b, before));
                    }
                    : undefined,
            });
        }
        catch (error) {
            const failure = this.toGeometryFailure(request.id, error);
            (_b = (_a = this.options).errorSink) === null || _b === void 0 ? void 0 : _b.call(_a, failure);
            throw failure;
        }
    }
    createParticipantContext(mutationId, signal) {
        return Object.freeze({
            signal,
            warnRecoverable: (error, objectIdentity, objectKind) => {
                this.warn({
                    code: 'GEOMETRY_OBJECT_SKIPPED',
                    message: 'An overlay transform skipped a malformed or unsupported object.',
                    mutationId,
                    objectIdentity,
                    objectKind,
                    cause: error,
                });
            },
        });
    }
    warnRecoverable(mutationId, participantId, error) {
        this.warn({
            code: 'GEOMETRY_OBJECT_SKIPPED',
            message: error.message,
            mutationId,
            participantId,
            objectIdentity: error.objectIdentity,
            objectKind: error.objectKind,
            cause: error.cause,
        });
    }
    toGeometryFailure(mutationId, error) {
        if (error instanceof errors.DocumentMutationUnrecoverableError) {
            return new errors.GeometryUnrecoverableError(mutationId, error.cause, error.rollbackErrors);
        }
        if (error instanceof errors.DocumentMutationError) {
            return new errors.GeometryMutationError(mutationId, error.cause instanceof Error ? error.cause.message : error.message, error.cause, error.rollbackErrors);
        }
        if (error instanceof errors.GeometryMutationError)
            return error;
        return new errors.GeometryMutationError(mutationId, error instanceof Error ? error.message : 'unknown failure.', error);
    }
    validateRequest(request) {
        var _a, _b;
        assertIdentifier$2(request.id, 'Mutation id');
        assertIdentifier$2(request.kind, 'Mutation kind');
        assertIdentifier$2(request.operationId, 'Operation id');
        if (this.usedMutationIds.has(request.id)) {
            throw new errors.GeometryMutationError(request.id, 'mutation id has already been used.');
        }
        if (typeof request.mutateBase !== 'function') {
            throw new errors.GeometryMutationError(request.id, 'mutateBase must be a function.');
        }
        let clonedMetadata;
        let serializedMetadata;
        try {
            clonedMetadata = cloneStateValue((_a = request.metadata) !== null && _a !== void 0 ? _a : {});
            serializedMetadata = JSON.stringify(clonedMetadata);
        }
        catch (error) {
            throw new errors.GeometryMutationError(request.id, 'metadata must be safely JSON-serializable.', error);
        }
        const maxMetadataBytes = (_b = this.options.maxMetadataBytes) !== null && _b !== void 0 ? _b : 64 * 1024;
        if (new TextEncoder().encode(serializedMetadata).byteLength > maxMetadataBytes) {
            throw new errors.GeometryMutationError(request.id, `metadata exceeds ${maxMetadataBytes} bytes.`);
        }
        this.usedMutationIds.add(request.id);
        return clonedMetadata;
    }
    warn(warning) {
        var _a, _b, _c, _d;
        try {
            (_b = (_a = this.options).warningSink) === null || _b === void 0 ? void 0 : _b.call(_a, Object.freeze(warning));
        }
        catch (error) {
            (_d = (_c = this.options).errorSink) === null || _d === void 0 ? void 0 : _d.call(_c, error);
        }
    }
    assertActive(operation) {
        if (this.disposed) {
            throw new errors.GeometryRegistrationError(`Cannot ${operation} after coordinator disposal.`);
        }
    }
}

const unavailableHistory = Object.freeze({
    isAvailable: () => false,
    commit: () => undefined,
});
class HistoryCommitRouter {
    constructor() {
        Object.defineProperty(this, "provider", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: unavailableHistory
        });
        Object.defineProperty(this, "owner", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
    }
    register(owner, provider) {
        if (!pluginIdentifier.isRuntimeIdentifier(owner)) {
            throw new errors.CoreRuntimeError('[ImageEditor] Invalid History provider owner Runtime ID.');
        }
        if (this.owner) {
            throw new errors.CoreRuntimeError(`[ImageEditor] History commit provider is already registered by "${this.owner}".`);
        }
        this.owner = owner;
        this.provider = provider;
        return disposable.createDisposable(() => {
            if (this.owner !== owner || this.provider !== provider)
                return;
            this.owner = null;
            this.provider = unavailableHistory;
        });
    }
    isAvailable() {
        return this.provider.isAvailable();
    }
    commit(record) {
        const coreRecord = Object.freeze({
            operationId: record.operationId,
            before: record.before,
            after: record.after,
            timestamp: record.timestamp,
            detail: record.detail,
        });
        return this.provider.commit(coreRecord);
    }
}

const CORE_ENVIRONMENT_CAPABILITY = pluginManifest.createCapabilityToken('core:environment', '1.0.0');

const ALLOWED_TRANSITIONS = {
    configured: ['initializing', 'disposing'],
    initializing: ['configured', 'initialized', 'faulted'],
    initialized: ['disposing', 'faulted'],
    disposing: ['disposed'],
    disposed: [],
    faulted: ['configured', 'disposing'],
};
class EditorLifecycleController {
    constructor() {
        Object.defineProperty(this, "state", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'configured'
        });
    }
    get current() {
        return this.state;
    }
    beginInitialization() {
        switch (this.state) {
            case 'configured':
                this.transition('initializing');
                return;
            case 'initializing':
                throw new errors.EditorInitializationInProgressError();
            case 'initialized':
                throw new errors.EditorAlreadyInitializedError();
            case 'disposing':
                throw new errors.EditorDisposingError('initialize');
            case 'disposed':
                throw new errors.EditorDisposedError('initialize');
            case 'faulted':
                throw new errors.EditorFaultedError('initialize');
        }
    }
    completeInitialization() {
        this.transition('initialized');
    }
    recoverInitialization() {
        this.transition('configured');
    }
    failInitialization() {
        this.transition('faulted');
    }
    failRuntime() {
        if (this.state === 'faulted')
            return;
        if (this.state !== 'initialized') {
            throw new errors.CoreRuntimeError(`[ImageEditor] Cannot enter faulted from "${this.state}" during runtime.`, { code: 'INVALID_LIFECYCLE_TRANSITION', behavior: 'lifecycle' });
        }
        this.transition('faulted');
    }
    recoverFault() {
        if (this.state !== 'faulted') {
            throw new errors.CoreRuntimeError(`[ImageEditor] Cannot complete emergency reset from "${this.state}".`, { code: 'INVALID_LIFECYCLE_TRANSITION', behavior: 'lifecycle' });
        }
        this.transition('configured');
    }
    beginDisposal() {
        if (this.state === 'disposing' || this.state === 'disposed')
            return false;
        if (this.state === 'initializing') {
            throw new errors.EditorInitializationInProgressError('dispose');
        }
        this.transition('disposing');
        return true;
    }
    completeDisposal() {
        this.transition('disposed');
    }
    assertOperational(operation) {
        switch (this.state) {
            case 'initialized':
                return;
            case 'configured':
                throw new errors.CoreRuntimeError(`[ImageEditor] Cannot ${operation} before initialization.`, { code: 'EDITOR_NOT_INITIALIZED' });
            case 'initializing':
                throw new errors.EditorInitializationInProgressError(operation);
            case 'disposing':
                throw new errors.EditorDisposingError(operation);
            case 'disposed':
                throw new errors.EditorDisposedError(operation);
            case 'faulted':
                throw new errors.EditorFaultedError(operation);
        }
    }
    assertAvailable(operation) {
        switch (this.state) {
            case 'disposing':
                throw new errors.EditorDisposingError(operation);
            case 'disposed':
                throw new errors.EditorDisposedError(operation);
            case 'faulted':
                throw new errors.EditorFaultedError(operation);
            default:
                return;
        }
    }
    transition(next) {
        const allowed = ALLOWED_TRANSITIONS[this.state];
        if (!allowed.includes(next)) {
            throw new errors.CoreRuntimeError(`[ImageEditor] Invalid lifecycle transition from "${this.state}" to "${next}".`, { code: 'INVALID_LIFECYCLE_TRANSITION' });
        }
        this.state = next;
    }
}

function isProxyablePluginApi(value) {
    return (typeof value === 'object' && value !== null) || typeof value === 'function';
}
class StablePluginApiHandle {
    constructor(pluginId, initialTarget, assertAvailable) {
        Object.defineProperty(this, "pluginId", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: pluginId
        });
        Object.defineProperty(this, "assertAvailable", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: assertAvailable
        });
        Object.defineProperty(this, "target", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "methodWrappers", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "api", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.target = initialTarget;
        const shadowTarget = typeof initialTarget === 'function'
            ? function stablePluginApi() { }
            : Object.create(null);
        this.api = new Proxy(shadowTarget, {
            apply: (shadow, thisArgument, argumentsList) => {
                const target = this.requireTarget();
                if (typeof target !== 'function') {
                    throw this.incompatibleReplayError('is no longer callable');
                }
                return Reflect.apply(target, thisArgument, argumentsList);
            },
            construct: (shadow, argumentsList, newTarget) => {
                const target = this.requireTarget();
                if (typeof target !== 'function') {
                    throw this.incompatibleReplayError('is no longer constructable');
                }
                return Reflect.construct(target, argumentsList, newTarget);
            },
            deleteProperty: (shadow, property) => {
                return Reflect.deleteProperty(this.requireTarget(), property);
            },
            get: (shadow, property) => {
                if (property === 'then' && (!this.target || !Reflect.has(this.target, property))) {
                    return undefined;
                }
                const target = this.requireTarget();
                const value = Reflect.get(target, property, target);
                if (typeof value !== 'function')
                    return value;
                return this.getMethodWrapper(property);
            },
            has: (shadow, property) => {
                return Reflect.has(this.requireTarget(), property);
            },
            set: (shadow, property, value) => {
                const target = this.requireTarget();
                return Reflect.set(target, property, value, target);
            },
        });
    }
    assertCompatible(nextTarget) {
        if (typeof nextTarget !== typeof this.api) {
            throw this.incompatibleReplayError('changed between callable and object forms');
        }
    }
    update(nextTarget) {
        this.assertCompatible(nextTarget);
        this.target = nextTarget;
    }
    clear() {
        this.target = null;
    }
    getMethodWrapper(property) {
        const existing = this.methodWrappers.get(property);
        if (existing)
            return existing;
        const wrapper = (...args) => {
            const target = this.requireTarget();
            const method = Reflect.get(target, property, target);
            if (typeof method !== 'function') {
                throw this.incompatibleReplayError(`no longer exposes method "${String(property)}"`);
            }
            return Reflect.apply(method, target, args);
        };
        this.methodWrappers.set(property, wrapper);
        return wrapper;
    }
    requireTarget() {
        this.assertAvailable(`use Plugin API "${this.pluginId}"`);
        if (!this.target) {
            throw new errors.CoreRuntimeError(`[ImageEditor] Plugin API "${this.pluginId}" is no longer available.`, { code: 'PLUGIN_API_UNAVAILABLE', behavior: 'lifecycle' });
        }
        return this.target;
    }
    incompatibleReplayError(reason) {
        return new errors.CoreRuntimeError(`[ImageEditor] Plugin API "${this.pluginId}" ${reason} during runtime replay.`, { code: 'PLUGIN_API_REPLAY_INCOMPATIBLE', behavior: 'lifecycle' });
    }
}

const DEFAULT_ROLLBACK_TIMEOUT_MS$1 = 30000;
function isCancellation(error) {
    return (typeof error === 'object' &&
        error !== null &&
        'name' in error &&
        error.name === 'AbortError');
}
function assertIdentifier$1(value, label) {
    if (value.trim().length === 0 || value.trim() !== value) {
        throw new errors.DocumentMutationRegistrationError(`${label} must be non-empty and trimmed.`);
    }
}
function immutableMetadata(value) {
    const cloned = cloneStateValue(value !== null && value !== void 0 ? value : {});
    if (typeof cloned !== 'object' || cloned === null || Array.isArray(cloned)) {
        throw new errors.DocumentMutationRegistrationError('Mutation metadata must be an object.');
    }
    return Object.freeze(cloned);
}
class DocumentMutationCoordinator {
    constructor(options) {
        var _a;
        Object.defineProperty(this, "options", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: options
        });
        Object.defineProperty(this, "usedTransactionIds", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Set()
        });
        Object.defineProperty(this, "contextRecords", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new WeakMap()
        });
        Object.defineProperty(this, "activeControllers", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Set()
        });
        Object.defineProperty(this, "activePromises", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Set()
        });
        Object.defineProperty(this, "disposed", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        const rollbackTimeoutMs = (_a = options.rollbackTimeoutMs) !== null && _a !== void 0 ? _a : DEFAULT_ROLLBACK_TIMEOUT_MS$1;
        if (!Number.isSafeInteger(rollbackTimeoutMs) || rollbackTimeoutMs <= 0) {
            throw new errors.DocumentMutationRegistrationError('rollbackTimeoutMs must be a positive safe integer.');
        }
    }
    get isRunning() {
        return this.activePromises.size > 0;
    }
    assertContextActive(context) {
        const record = this.contextRecords.get(context);
        if (!record || record.session.closed || context.signal.aborted) {
            throw new errors.DocumentMutationInvariantError(context.transactionId, new Error('The document mutation context is not active.'));
        }
    }
    run(request) {
        var _a, _b, _c, _d;
        let normalized;
        let parentRecord;
        try {
            this.assertActive('run a document mutation');
            (_b = (_a = this.options.state).assertOperational) === null || _b === void 0 ? void 0 : _b.call(_a, 'run a document mutation');
            normalized = this.normalizeRequest(request);
            parentRecord = normalized.parent ? this.requireParent(normalized.parent) : null;
        }
        catch (error) {
            return Promise.reject(error);
        }
        const controller = new AbortController();
        const abort = () => { var _a; return controller.abort((_a = normalized.signal) === null || _a === void 0 ? void 0 : _a.reason); };
        if ((_c = normalized.signal) === null || _c === void 0 ? void 0 : _c.aborted)
            abort();
        else
            (_d = normalized.signal) === null || _d === void 0 ? void 0 : _d.addEventListener('abort', abort, { once: true });
        this.activeControllers.add(controller);
        const operation = this.options.operations.run(normalized.operationId, (operationContext) => parentRecord
            ? this.performNested(normalized, operationContext.token, parentRecord)
            : this.performTopLevel(normalized, operationContext.token), {
            parent: parentRecord === null || parentRecord === void 0 ? void 0 : parentRecord.operationToken,
            signal: controller.signal,
        });
        this.activePromises.add(operation);
        return operation.finally(() => {
            var _a;
            (_a = normalized.signal) === null || _a === void 0 ? void 0 : _a.removeEventListener('abort', abort);
            this.activeControllers.delete(controller);
            this.activePromises.delete(operation);
        });
    }
    async dispose() {
        if (this.disposed)
            return;
        this.disposed = true;
        const reason = new DOMException('Document Mutation Coordinator was disposed.', 'AbortError');
        for (const controller of this.activeControllers)
            controller.abort(reason);
        await Promise.allSettled([...this.activePromises]);
        this.activeControllers.clear();
        this.usedTransactionIds.clear();
    }
    async abortActive(reason) {
        this.assertActive('abort document mutations');
        for (const controller of this.activeControllers)
            controller.abort(reason);
        await Promise.allSettled([...this.activePromises]);
    }
    reset() {
        this.assertActive('reset document mutations');
        if (this.activePromises.size > 0) {
            throw new errors.DocumentMutationRegistrationError('Cannot reset while a document mutation is active.');
        }
        this.usedTransactionIds.clear();
    }
    disposeSync() {
        if (this.disposed)
            return;
        if (this.activePromises.size > 0) {
            throw new errors.DocumentMutationRegistrationError('Cannot synchronously dispose an active document mutation.');
        }
        this.disposed = true;
        this.usedTransactionIds.clear();
    }
    async performTopLevel(request, operationToken) {
        const before = this.options.mementos.capture();
        const session = {
            before,
            rollbackEntries: [],
            validators: [],
            diagnostics: [],
            failure: null,
            closed: false,
        };
        const context = this.createContext(request, operationToken, session, null);
        let result;
        let committedResult;
        try {
            result = await this.executeRequest(request, context, session);
            if (session.failure)
                throw session.failure;
            this.throwIfUnavailable(context.signal, request.id);
            this.options.state.requestRender();
            for (const validate of session.validators) {
                this.throwIfUnavailable(context.signal, request.id);
                try {
                    await validate();
                }
                catch (error) {
                    throw new errors.DocumentMutationInvariantError(request.id, error);
                }
            }
            this.throwIfUnavailable(context.signal, request.id);
            committedResult = request.describeCommit
                ? await request.describeCommit(result, context)
                : result;
            this.throwIfUnavailable(context.signal, request.id);
        }
        catch (error) {
            session.closed = true;
            throw await this.restoreAfterFailure(request.id, session, error);
        }
        let descriptor;
        try {
            const after = this.options.mementos.capture();
            descriptor = Object.freeze({
                transactionId: request.id,
                parentTransactionId: null,
                kind: request.kind,
                operationId: request.operationId,
                conflictDomains: request.conflictDomains,
                metadata: request.metadata,
                diagnostics: Object.freeze([...session.diagnostics]),
                result: committedResult,
                committedAt: Date.now(),
            });
            if (this.options.history.isAvailable()) {
                await this.options.history.commit(Object.freeze({
                    operationId: request.operationId,
                    before,
                    after,
                    timestamp: descriptor.committedAt,
                    detail: descriptor,
                }));
            }
        }
        catch (error) {
            session.closed = true;
            throw await this.restoreAfterFailure(request.id, session, error);
        }
        session.closed = true;
        try {
            await this.options.events.emitCommitted(descriptor);
        }
        catch (error) {
            this.warn({
                code: 'DOCUMENT_COMMITTED_OBSERVER_FAILED',
                message: 'A committed document observer failed after the transaction committed.',
                transactionId: request.id,
                cause: error,
            });
        }
        return result;
    }
    async performNested(request, operationToken, parentRecord) {
        var _a;
        var _b;
        const parent = request.parent;
        if (!parent) {
            throw new errors.DocumentMutationRegistrationError('Nested mutation requires a parent.');
        }
        const context = this.createContext(request, operationToken, parentRecord.session, parent);
        try {
            return await this.executeRequest(request, context, parentRecord.session);
        }
        catch (error) {
            (_a = (_b = parentRecord.session).failure) !== null && _a !== void 0 ? _a : (_b.failure = error);
            throw error;
        }
    }
    async executeRequest(request, context, session) {
        var _a, _b, _c, _d, _e;
        const outcome = { result: undefined };
        const requestRollback = request.rollback
            ? {
                enabled: false,
                run: async (cause, signal) => {
                    var _a;
                    const rollbackContext = this.createRollbackContext(context, cause, outcome.result, signal);
                    await ((_a = request.rollback) === null || _a === void 0 ? void 0 : _a.call(request, rollbackContext));
                },
            }
            : null;
        if (requestRollback)
            session.rollbackEntries.push(requestRollback);
        const prepared = [];
        for (const participant of request.participants) {
            this.throwIfUnavailable(context.signal, request.id);
            const preparedValue = participant.prepare
                ? await participant.prepare(context)
                : undefined;
            prepared.push({ participant, value: preparedValue });
            if (participant.rollback) {
                session.rollbackEntries.push({
                    enabled: true,
                    run: async (cause, signal) => {
                        var _a;
                        const rollbackContext = this.createRollbackContext(context, cause, outcome.result, signal);
                        await ((_a = participant.rollback) === null || _a === void 0 ? void 0 : _a.call(participant, preparedValue, rollbackContext));
                    },
                });
            }
        }
        this.throwIfUnavailable(context.signal, request.id);
        if (requestRollback)
            requestRollback.enabled = true;
        const result = await request.mutate(context);
        outcome.result = result;
        this.throwIfUnavailable(context.signal, request.id);
        for (const entry of prepared) {
            await ((_b = (_a = entry.participant).apply) === null || _b === void 0 ? void 0 : _b.call(_a, result, entry.value, context));
            this.throwIfUnavailable(context.signal, request.id);
        }
        for (const entry of prepared) {
            await ((_d = (_c = entry.participant).synchronize) === null || _d === void 0 ? void 0 : _d.call(_c, result, entry.value, context));
            this.throwIfUnavailable(context.signal, request.id);
        }
        await ((_e = request.synchronize) === null || _e === void 0 ? void 0 : _e.call(request, result, context));
        this.throwIfUnavailable(context.signal, request.id);
        if (request.validate) {
            session.validators.push(async () => { var _a; return (_a = request.validate) === null || _a === void 0 ? void 0 : _a.call(request, result, context); });
        }
        return result;
    }
    createContext(request, operationToken, session, parent) {
        var _a, _b;
        const participantIds = Object.freeze(request.participants.map(({ id }) => id));
        const context = Object.freeze({
            transactionId: request.id,
            parentTransactionId: (_a = parent === null || parent === void 0 ? void 0 : parent.transactionId) !== null && _a !== void 0 ? _a : null,
            operationId: request.operationId,
            conflictDomains: request.conflictDomains,
            historyOwner: parent ? 'parent' : 'self',
            eventOwner: parent ? 'parent' : 'self',
            signal: operationToken.signal,
            participantIds,
            metadata: request.metadata,
        });
        this.contextRecords.set(context, { session, operationToken });
        session.diagnostics.push(Object.freeze({
            transactionId: request.id,
            parentTransactionId: (_b = parent === null || parent === void 0 ? void 0 : parent.transactionId) !== null && _b !== void 0 ? _b : null,
            participantIds,
            metadata: request.metadata,
        }));
        return context;
    }
    createRollbackContext(context, cause, result, signal) {
        return Object.freeze({
            ...context,
            signal,
            cause,
            result,
        });
    }
    async restoreAfterFailure(transactionId, session, cause) {
        var _a, _b, _c, _d, _e, _f, _g;
        const rollbackErrors = [];
        const rollbackTimeoutMs = (_a = this.options.rollbackTimeoutMs) !== null && _a !== void 0 ? _a : DEFAULT_ROLLBACK_TIMEOUT_MS$1;
        const rollbackController = new AbortController();
        const timeoutError = new Error(`Document mutation rollback timed out after ${rollbackTimeoutMs}ms.`);
        timeoutError.name = 'TimeoutError';
        const timeout = setTimeout(() => rollbackController.abort(timeoutError), rollbackTimeoutMs);
        const runRollbackTask = async (task) => {
            var _a;
            if (rollbackController.signal.aborted) {
                throw (_a = rollbackController.signal.reason) !== null && _a !== void 0 ? _a : timeoutError;
            }
            let removeAbortListener = () => undefined;
            const aborted = new Promise((resolve, reject) => {
                const abort = () => { var _a; return reject((_a = rollbackController.signal.reason) !== null && _a !== void 0 ? _a : timeoutError); };
                removeAbortListener = () => rollbackController.signal.removeEventListener('abort', abort);
                rollbackController.signal.addEventListener('abort', abort, { once: true });
            });
            try {
                await Promise.race([task(), aborted]);
            }
            finally {
                removeAbortListener();
            }
        };
        try {
            for (let index = session.rollbackEntries.length - 1; index >= 0; index -= 1) {
                const entry = session.rollbackEntries[index];
                if (!(entry === null || entry === void 0 ? void 0 : entry.enabled))
                    continue;
                try {
                    await runRollbackTask(() => entry.run(cause, rollbackController.signal));
                }
                catch (error) {
                    rollbackErrors.push(error);
                }
            }
            let targetedStateMatches = false;
            const targetedRollbackRan = session.rollbackEntries.some((entry) => entry.enabled);
            if (targetedRollbackRan &&
                rollbackErrors.length === 0 &&
                this.options.mementos.matches) {
                try {
                    targetedStateMatches = await this.options.mementos.matches(session.before);
                }
                catch (error) {
                    rollbackErrors.push(error);
                }
            }
            if (!targetedStateMatches) {
                try {
                    await runRollbackTask(() => this.options.mementos.restore(session.before, {
                        rollbackOnFailure: false,
                        signal: rollbackController.signal,
                    }));
                }
                catch (restoreError) {
                    rollbackErrors.push(restoreError);
                    const failure = new errors.DocumentMutationUnrecoverableError(transactionId, cause, Object.freeze(rollbackErrors));
                    (_c = (_b = this.options).faultSink) === null || _c === void 0 ? void 0 : _c.call(_b, failure);
                    (_e = (_d = this.options).errorSink) === null || _e === void 0 ? void 0 : _e.call(_d, failure);
                    return failure;
                }
            }
            if (!this.options.state.isDisposed()) {
                try {
                    this.options.state.requestRender();
                }
                catch (error) {
                    rollbackErrors.push(error);
                }
            }
        }
        finally {
            clearTimeout(timeout);
        }
        if (isCancellation(cause))
            return cause;
        const failure = cause instanceof errors.DocumentMutationError
            ? cause
            : new errors.DocumentMutationError(transactionId, cause instanceof Error ? cause.message : 'unknown failure.', cause, Object.freeze(rollbackErrors));
        (_g = (_f = this.options).errorSink) === null || _g === void 0 ? void 0 : _g.call(_f, failure);
        return failure;
    }
    normalizeRequest(request) {
        var _a, _b;
        assertIdentifier$1(request.id, 'Transaction id');
        assertIdentifier$1(request.kind, 'Mutation kind');
        assertIdentifier$1(request.operationId, 'Operation id');
        if (this.usedTransactionIds.has(request.id)) {
            throw new errors.DocumentMutationRegistrationError(`Transaction id "${request.id}" has already been used.`, request.id);
        }
        if (!this.options.operations.has(request.operationId)) {
            throw new errors.DocumentMutationRegistrationError(`Operation "${request.operationId}" is not registered.`, request.id);
        }
        const operation = this.options.operations.get(request.operationId);
        if (!operation) {
            throw new errors.DocumentMutationRegistrationError(`Operation "${request.operationId}" is unavailable.`, request.id);
        }
        if (!Array.isArray(request.conflictDomains) ||
            request.conflictDomains.length === 0 ||
            request.conflictDomains.some((domain) => !operation.conflictDomains.includes(domain))) {
            throw new errors.DocumentMutationRegistrationError('Mutation conflict domains must be covered by its registered operation.', request.id);
        }
        if (typeof request.mutate !== 'function') {
            throw new errors.DocumentMutationRegistrationError('Mutation request must define mutate().', request.id);
        }
        const participants = [...((_a = request.participants) !== null && _a !== void 0 ? _a : [])];
        const participantIds = new Set();
        for (const participant of participants) {
            assertIdentifier$1(participant.id, 'Participant id');
            if (!Number.isFinite(participant.order)) {
                throw new errors.DocumentMutationRegistrationError(`Participant "${participant.id}" must use a finite order.`, request.id);
            }
            if (participantIds.has(participant.id)) {
                throw new errors.DocumentMutationRegistrationError(`Participant "${participant.id}" is duplicated.`, request.id);
            }
            participantIds.add(participant.id);
        }
        participants.sort((left, right) => left.order - right.order);
        let metadata;
        let serializedMetadata;
        try {
            metadata = immutableMetadata(request.metadata);
            serializedMetadata = JSON.stringify(metadata);
        }
        catch (error) {
            if (error instanceof errors.DocumentMutationRegistrationError)
                throw error;
            throw new errors.DocumentMutationRegistrationError('Mutation metadata must be safely JSON-serializable.', request.id);
        }
        const maxMetadataBytes = (_b = this.options.maxMetadataBytes) !== null && _b !== void 0 ? _b : 64 * 1024;
        if (new TextEncoder().encode(serializedMetadata).byteLength > maxMetadataBytes) {
            throw new errors.DocumentMutationRegistrationError(`Mutation metadata exceeds ${maxMetadataBytes} bytes.`, request.id);
        }
        this.usedTransactionIds.add(request.id);
        return Object.freeze({
            ...request,
            conflictDomains: Object.freeze([...request.conflictDomains]),
            participants: Object.freeze(participants),
            metadata,
        });
    }
    requireParent(parent) {
        const record = this.contextRecords.get(parent);
        if (!record || record.session.closed || parent.signal.aborted) {
            throw new errors.DocumentMutationRegistrationError(`Parent transaction "${parent.transactionId}" is not active.`, parent.transactionId);
        }
        return record;
    }
    throwIfUnavailable(signal, transactionId) {
        var _a;
        if (signal.aborted) {
            throw (_a = signal.reason) !== null && _a !== void 0 ? _a : new DOMException('Document mutation was aborted.', 'AbortError');
        }
        if (this.options.state.isDisposed()) {
            throw new errors.DocumentMutationError(transactionId, 'Core state is disposed.');
        }
    }
    warn(warning) {
        var _a, _b, _c, _d;
        try {
            (_b = (_a = this.options).warningSink) === null || _b === void 0 ? void 0 : _b.call(_a, Object.freeze(warning));
        }
        catch (error) {
            (_d = (_c = this.options).errorSink) === null || _d === void 0 ? void 0 : _d.call(_c, error);
        }
    }
    assertActive(operation) {
        if (this.disposed) {
            throw new errors.DocumentMutationRegistrationError(`Cannot ${operation} after coordinator disposal.`);
        }
    }
}

const DEFAULT_ROLLBACK_TIMEOUT_MS = 30000;
function createAbortError(message) {
    if (typeof DOMException === 'function')
        return new DOMException(message, 'AbortError');
    const error = new Error(message);
    error.name = 'AbortError';
    return error;
}
function throwIfAborted(signal) {
    var _a;
    if (signal.aborted)
        throw (_a = signal.reason) !== null && _a !== void 0 ? _a : createAbortError('State restoration was aborted.');
}
async function runBoundedRollback(task, timeoutMs) {
    const controller = new AbortController();
    const timeoutError = new Error(`Memento rollback timed out after ${timeoutMs}ms.`);
    timeoutError.name = 'TimeoutError';
    const timeout = setTimeout(() => controller.abort(timeoutError), timeoutMs);
    let removeAbortListener = () => undefined;
    const aborted = new Promise((resolve, reject) => {
        const abort = () => { var _a; return reject((_a = controller.signal.reason) !== null && _a !== void 0 ? _a : timeoutError); };
        removeAbortListener = () => controller.signal.removeEventListener('abort', abort);
        controller.signal.addEventListener('abort', abort, { once: true });
    });
    try {
        await Promise.race([task(controller.signal), aborted]);
    }
    finally {
        clearTimeout(timeout);
        removeAbortListener();
    }
}
function stateValuesMatch(left, right) {
    if (Object.is(left, right))
        return true;
    if (typeof left !== 'object' || left === null || typeof right !== 'object' || right === null) {
        return false;
    }
    const leftIsArray = Array.isArray(left);
    if (leftIsArray !== Array.isArray(right))
        return false;
    const leftRecord = left;
    const rightRecord = right;
    const leftKeys = Object.keys(leftRecord);
    const rightKeys = Object.keys(rightRecord);
    if (leftKeys.length !== rightKeys.length)
        return false;
    return leftKeys.every((key) => Object.prototype.hasOwnProperty.call(rightRecord, key) &&
        stateValuesMatch(leftRecord[key], rightRecord[key]));
}
class MementoService {
    constructor(coreAdapter, slices) {
        Object.defineProperty(this, "coreAdapter", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: coreAdapter
        });
        Object.defineProperty(this, "slices", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: slices
        });
        Object.defineProperty(this, "trustedMementos", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new WeakSet()
        });
        Object.defineProperty(this, "revision", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "restoring", {
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
    }
    capture() {
        this.assertActive('capture a memento');
        if (this.restoring) {
            throw new errors.StateRegistrationError('Cannot capture a new memento during restoration.');
        }
        return this.captureInternal();
    }
    isTrusted(value) {
        return typeof value === 'object' && value !== null && this.trustedMementos.has(value);
    }
    matches(memento) {
        this.assertActive('compare a memento');
        if (!this.isTrusted(memento))
            return false;
        const current = this.captureInternal(false);
        return (stateValuesMatch(current.core, memento.core) &&
            stateValuesMatch(current.plugins, memento.plugins));
    }
    async restore(memento, options = {}) {
        var _a;
        this.assertActive('restore a memento');
        if (!this.isTrusted(memento)) {
            throw new errors.MementoRestoreError('core', 'restore', new Error('Untrusted memento.'));
        }
        if (this.restoring) {
            throw new errors.MementoRestoreError('core', 'restore', new Error('Reentrant memento restoration is not allowed.'));
        }
        const rollbackTimeoutMs = (_a = options.rollbackTimeoutMs) !== null && _a !== void 0 ? _a : DEFAULT_ROLLBACK_TIMEOUT_MS;
        if (!Number.isSafeInteger(rollbackTimeoutMs) || rollbackTimeoutMs <= 0) {
            throw new errors.MementoRestoreError('core', 'restore', new TypeError('rollbackTimeoutMs must be a positive safe integer.'));
        }
        const controller = new AbortController();
        const providedSignal = options.signal;
        const abort = () => controller.abort(providedSignal === null || providedSignal === void 0 ? void 0 : providedSignal.reason);
        providedSignal === null || providedSignal === void 0 ? void 0 : providedSignal.addEventListener('abort', abort, { once: true });
        if (providedSignal === null || providedSignal === void 0 ? void 0 : providedSignal.aborted)
            abort();
        this.restoring = true;
        let rollback = null;
        try {
            if (options.rollbackOnFailure !== false)
                rollback = this.captureInternal(false);
            await this.restoreInternal(memento, 'trusted-memento', controller.signal);
        }
        catch (error) {
            if (!rollback) {
                if (error instanceof errors.MementoRestoreError)
                    throw error;
                throw new errors.MementoRestoreError('core', 'restore', error);
            }
            const rollbackMemento = rollback;
            const rollbackErrors = [];
            try {
                await runBoundedRollback((signal) => this.restoreInternal(rollbackMemento, 'rollback', signal), rollbackTimeoutMs);
            }
            catch (rollbackError) {
                rollbackErrors.push(rollbackError);
            }
            if (error instanceof errors.MementoRestoreError) {
                throw new errors.MementoRestoreError(error.sliceId, 'restore', error.cause, rollbackErrors);
            }
            throw new errors.MementoRestoreError('core', 'restore', error, rollbackErrors);
        }
        finally {
            providedSignal === null || providedSignal === void 0 ? void 0 : providedSignal.removeEventListener('abort', abort);
            this.restoring = false;
        }
    }
    dispose() {
        this.disposed = true;
    }
    reset() {
        this.assertActive('reset MementoService');
        if (this.restoring) {
            throw new errors.StateRegistrationError('Cannot reset MementoService during restoration.');
        }
        this.trustedMementos = new WeakSet();
        this.revision = 0;
    }
    captureInternal(validateReferenceIdentity = true) {
        var _a;
        const capturedAt = Date.now();
        const context = Object.freeze({ mode: 'memento', capturedAt });
        let core;
        try {
            core = cloneStateValue(this.coreAdapter.capture(context));
            assertSafeImmutableReference(core);
        }
        catch (error) {
            throw new errors.MementoCaptureError('core', error);
        }
        const plugins = Object.create(null);
        for (const slice of this.slices.list()) {
            try {
                const captured = slice.capture(context);
                let capturePolicy = (_a = slice.capturePolicy) !== null && _a !== void 0 ? _a : 'always';
                let data;
                if (capturePolicy === 'reference') {
                    if (validateReferenceIdentity) {
                        const validation = slice.validate(captured, {
                            sliceId: slice.id,
                            version: slice.version,
                        });
                        if (!validation.valid || validation.value !== captured) {
                            throw new Error(validation.valid
                                ? 'Reference validation must preserve the captured identity.'
                                : validation.message);
                        }
                        assertSafeImmutableReference(captured);
                        data = captured;
                    }
                    else {
                        data = cloneStateValue(captured);
                        capturePolicy = 'always';
                    }
                }
                else {
                    data = cloneStateValue(captured);
                }
                assertSafeImmutableReference(data);
                plugins[slice.id] = Object.freeze({
                    version: slice.version,
                    capturePolicy,
                    data,
                });
            }
            catch (error) {
                throw new errors.MementoCaptureError(slice.id, error);
            }
        }
        const memento = Object.freeze({
            revision: ++this.revision,
            capturedAt,
            core,
            plugins: Object.freeze(plugins),
        });
        this.trustedMementos.add(memento);
        return memento;
    }
    async restoreInternal(memento, mode, signal) {
        var _a;
        const context = Object.freeze({ mode, signal });
        throwIfAborted(signal);
        try {
            await this.coreAdapter.restore(cloneStateValue(memento.core), context);
        }
        catch (error) {
            throw new errors.MementoRestoreError('core', mode === 'rollback' ? 'rollback' : 'restore', error);
        }
        for (const slice of this.slices.list()) {
            throwIfAborted(signal);
            const entry = memento.plugins[slice.id];
            try {
                if (!entry) {
                    await ((_a = slice.clearState) === null || _a === void 0 ? void 0 : _a.call(slice, context));
                    continue;
                }
                if (entry.version !== slice.version) {
                    throw new Error(`Captured version ${entry.version} does not match installed version ${slice.version}.`);
                }
                await slice.restore(entry.capturePolicy === 'reference' ? entry.data : cloneStateValue(entry.data), context);
            }
            catch (error) {
                throw new errors.MementoRestoreError(slice.id, mode === 'rollback' ? 'rollback' : 'restore', error);
            }
        }
    }
    assertActive(operation) {
        if (this.disposed) {
            throw new errors.StateRegistrationError(`Cannot ${operation} after MementoService disposal.`);
        }
    }
}

function assertIdentifier(value, label) {
    if (value.trim().length === 0 || value.trim() !== value) {
        throw new errors.StateRegistrationError(`${label} must be a non-empty trimmed string.`);
    }
}
class ObjectPropertyRegistry {
    constructor() {
        Object.defineProperty(this, "properties", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "disposed", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
    }
    register(registration) {
        this.assertActive();
        if (!pluginIdentifier.isRuntimeIdentifier(registration.owner)) {
            throw new errors.StateRegistrationError('Invalid object property owner Runtime ID.', registration.owner);
        }
        if (registration.keys.length === 0) {
            throw new errors.StateRegistrationError(`Object property registration for "${registration.owner}" must include a key.`);
        }
        const keys = [...new Set(registration.keys)];
        for (const key of keys) {
            assertIdentifier(key, 'Object property key');
            if (pluginIdentifier.isDangerousStateKey(key)) {
                throw new errors.StateRegistrationError(`Object property key "${key}" is forbidden.`);
            }
            const existing = this.properties.get(key);
            if (existing && existing.owner !== registration.owner) {
                throw new errors.StateRegistrationError(`Object property "${key}" is already owned by "${existing.owner}".`);
            }
        }
        for (const key of keys) {
            const existing = this.properties.get(key);
            if (existing)
                existing.references += 1;
            else
                this.properties.set(key, { owner: registration.owner, references: 1 });
        }
        return disposable.createDisposable(() => {
            for (const key of keys) {
                const record = this.properties.get(key);
                if (!record || record.owner !== registration.owner)
                    continue;
                record.references -= 1;
                if (record.references === 0)
                    this.properties.delete(key);
            }
        });
    }
    listKeys() {
        this.assertActive();
        return Object.freeze([...this.properties.keys()]);
    }
    getOwner(key) {
        var _a, _b;
        this.assertActive();
        return (_b = (_a = this.properties.get(key)) === null || _a === void 0 ? void 0 : _a.owner) !== null && _b !== void 0 ? _b : null;
    }
    dispose() {
        if (this.disposed)
            return;
        this.properties.clear();
        this.disposed = true;
    }
    assertActive() {
        if (this.disposed)
            throw new errors.StateRegistrationError('Object property registry is disposed.');
    }
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const HEADER_PROBE_BYTES = 256 * 1024;
function matchesAscii(bytes, offset, value) {
    if (offset < 0 || offset + value.length > bytes.length)
        return false;
    for (let index = 0; index < value.length; index += 1) {
        if (bytes[offset + index] !== value.charCodeAt(index))
            return false;
    }
    return true;
}
function uint16BE(bytes, offset) {
    if (offset < 0 || offset + 2 > bytes.length)
        return null;
    return (bytes[offset] << 8) | bytes[offset + 1];
}
function uint16LE(bytes, offset) {
    if (offset < 0 || offset + 2 > bytes.length)
        return null;
    return bytes[offset] | (bytes[offset + 1] << 8);
}
function uint24LE(bytes, offset) {
    if (offset < 0 || offset + 3 > bytes.length)
        return null;
    return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}
function uint32BE(bytes, offset) {
    if (offset < 0 || offset + 4 > bytes.length)
        return null;
    return (bytes[offset] * 0x1000000 +
        ((bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]));
}
function positiveDimensions(width, height) {
    return width !== null && height !== null && width > 0 && height > 0
        ? Object.freeze({ width, height })
        : null;
}
function readPngDimensions(bytes) {
    if (bytes.length < 24 ||
        !PNG_SIGNATURE.every((byte, index) => bytes[index] === byte) ||
        !matchesAscii(bytes, 12, 'IHDR')) {
        return null;
    }
    return positiveDimensions(uint32BE(bytes, 16), uint32BE(bytes, 20));
}
function isJpegStartOfFrame(marker) {
    return ((marker >= 0xc0 && marker <= 0xc3) ||
        (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) ||
        (marker >= 0xcd && marker <= 0xcf));
}
function readJpegDimensions(bytes) {
    if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8)
        return null;
    let offset = 2;
    while (offset + 1 < bytes.length) {
        while (offset < bytes.length && bytes[offset] === 0xff)
            offset += 1;
        if (offset >= bytes.length)
            return null;
        const marker = bytes[offset];
        offset += 1;
        if (marker === 0xda || marker === 0xd9)
            return null;
        if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7))
            continue;
        const length = uint16BE(bytes, offset);
        if (length === null || length < 2 || offset + length > bytes.length)
            return null;
        if (isJpegStartOfFrame(marker) && length >= 7) {
            return positiveDimensions(uint16BE(bytes, offset + 5), uint16BE(bytes, offset + 3));
        }
        offset += length;
    }
    return null;
}
function readWebpDimensions(bytes) {
    var _a, _b;
    if (bytes.length < 20 || !matchesAscii(bytes, 0, 'RIFF') || !matchesAscii(bytes, 8, 'WEBP')) {
        return null;
    }
    if (matchesAscii(bytes, 12, 'VP8X') && bytes.length >= 30) {
        const width = uint24LE(bytes, 24);
        const height = uint24LE(bytes, 27);
        return width === null || height === null
            ? null
            : Object.freeze({ width: width + 1, height: height + 1 });
    }
    if (matchesAscii(bytes, 12, 'VP8 ') && bytes.length >= 30) {
        return positiveDimensions(((_a = uint16LE(bytes, 26)) !== null && _a !== void 0 ? _a : 0) & 0x3fff, ((_b = uint16LE(bytes, 28)) !== null && _b !== void 0 ? _b : 0) & 0x3fff);
    }
    if (matchesAscii(bytes, 12, 'VP8L') && bytes.length >= 25 && bytes[20] === 0x2f) {
        return Object.freeze({
            width: 1 + bytes[21] + ((bytes[22] & 0x3f) << 8),
            height: 1 + (bytes[22] >> 6) + (bytes[23] << 2) + ((bytes[24] & 0x0f) << 10),
        });
    }
    return null;
}
function decodePrefix(base64) {
    const encoded = base64.slice(0, Math.ceil(HEADER_PROBE_BYTES / 3) * 4).replace(/\s+/g, '');
    if (!encoded)
        return new Uint8Array();
    const remainder = encoded.length % 4;
    if (remainder === 1)
        return null;
    const padded = remainder === 0 ? encoded : `${encoded}${'='.repeat(4 - remainder)}`;
    const buffer = globalThis.Buffer;
    if (buffer)
        return buffer.from(padded, 'base64');
    if (typeof globalThis.atob !== 'function')
        return null;
    const binary = globalThis.atob(padded);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
function inspectEncodedImageDataUrl(value) {
    var _a, _b;
    const match = /^data:(image\/(?:png|jpeg|webp));base64,([\s\S]*)$/i.exec(value);
    if (!match)
        return null;
    const mimeType = match[1].toLowerCase();
    const base64 = match[2].replace(/\s+/g, '');
    const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
    const encodedBytes = Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
    const prefix = decodePrefix(base64);
    const dimensions = prefix
        ? ((_b = (_a = readPngDimensions(prefix)) !== null && _a !== void 0 ? _a : readJpegDimensions(prefix)) !== null && _b !== void 0 ? _b : readWebpDimensions(prefix))
        : null;
    return Object.freeze({ mimeType, encodedBytes, dimensions });
}

const EXTERNAL_RESOURCE_KEYS = new Set(['href', 'source', 'src', 'url']);
function isExternalResourceKey(propertyName) {
    if (!propertyName)
        return false;
    const normalized = propertyName.toLowerCase();
    return EXTERNAL_RESOURCE_KEYS.has(normalized) || normalized.endsWith('url');
}
const DEFAULT_SNAPSHOT_LIMITS = Object.freeze({
    maxInputBytes: 16 * 1024 * 1024,
    maxDepth: 64,
    maxObjectCount: 100000,
    maxPluginCount: 256,
    maxPluginPayloadBytes: 4 * 1024 * 1024,
    maxMetadataBytes: 256 * 1024,
    maxStringLength: 16 * 1024 * 1024,
    maxDataUrlBytes: 16 * 1024 * 1024,
    maxDecodedPixels: 50000000,
    maxImageDimension: 32768,
    externalUrlPolicy: 'reject',
});
function byteLength(value) {
    return new TextEncoder().encode(value).byteLength;
}
function inspectTree(value, limits, path = '$', depth = 0, ancestors = new WeakSet(), counter = { count: 0 }, propertyName) {
    if (depth > limits.maxDepth) {
        throw new errors.SnapshotValidationError(`nesting exceeds ${limits.maxDepth}.`, path);
    }
    if (value === null || typeof value !== 'object') {
        if (typeof value === 'number' && !Number.isFinite(value)) {
            throw new errors.SnapshotValidationError('number must be finite.', path);
        }
        if (typeof value === 'string') {
            if (value.length > limits.maxStringLength) {
                throw new errors.SnapshotValidationError(`string length exceeds ${limits.maxStringLength}.`, path);
            }
            if (value.startsWith('data:')) {
                const inspection = inspectEncodedImageDataUrl(value);
                if (!inspection) {
                    throw new errors.SnapshotValidationError('Data URL must be a base64 PNG, JPEG, or WebP image.', path);
                }
                if (inspection.encodedBytes > limits.maxDataUrlBytes) {
                    throw new errors.SnapshotValidationError(`Data URL exceeds ${limits.maxDataUrlBytes} bytes.`, path);
                }
                if (inspection.dimensions) {
                    const { width, height } = inspection.dimensions;
                    if (width * height > limits.maxDecodedPixels) {
                        throw new errors.SnapshotValidationError(`decoded pixel count exceeds ${limits.maxDecodedPixels}.`, path);
                    }
                    if (width > limits.maxImageDimension || height > limits.maxImageDimension) {
                        throw new errors.SnapshotValidationError(`image dimensions exceed ${limits.maxImageDimension}.`, path);
                    }
                }
            }
            else if (limits.externalUrlPolicy === 'reject' &&
                isExternalResourceKey(propertyName) &&
                /^(?:[a-z][a-z\d+.-]*:|\/\/)/iu.test(value)) {
                throw new errors.SnapshotValidationError('external URL references are forbidden.', path);
            }
        }
        if (typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint') {
            throw new errors.SnapshotValidationError(`unsupported ${typeof value} value.`, path);
        }
        return;
    }
    counter.count += 1;
    if (counter.count > limits.maxObjectCount) {
        throw new errors.SnapshotValidationError(`object count exceeds ${limits.maxObjectCount}.`, path);
    }
    if (ancestors.has(value))
        throw new errors.SnapshotValidationError('cyclic value.', path);
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null && !Array.isArray(value)) {
        throw new errors.SnapshotValidationError('only plain objects and arrays are accepted.', path);
    }
    if (Object.prototype.hasOwnProperty.call(value, 'toJSON') ||
        Object.getOwnPropertySymbols(value).length > 0) {
        throw new errors.SnapshotValidationError('toJSON hooks and symbol properties are forbidden.', path);
    }
    ancestors.add(value);
    for (const key of Object.keys(value)) {
        if (pluginIdentifier.isDangerousStateKey(key)) {
            throw new errors.SnapshotValidationError(`dangerous key "${key}" is forbidden.`, `${path}.${key}`);
        }
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (!descriptor || !('value' in descriptor)) {
            throw new errors.SnapshotValidationError('accessor properties are forbidden.', `${path}.${key}`);
        }
        const nestedValue = descriptor.value;
        inspectTree(nestedValue, limits, `${path}.${key}`, depth + 1, ancestors, counter, key);
        if (key === 'metadata' || key.endsWith('Metadata')) {
            const metadataBytes = byteLength(JSON.stringify(nestedValue));
            if (metadataBytes > limits.maxMetadataBytes) {
                throw new errors.SnapshotValidationError(`metadata exceeds ${limits.maxMetadataBytes} bytes.`, `${path}.${key}`);
            }
        }
    }
    ancestors.delete(value);
}
function stableJson(value, limits) {
    inspectTree(value, limits);
    const sortValue = (entry) => {
        if (Array.isArray(entry))
            return entry.map(sortValue);
        if (entry && typeof entry === 'object') {
            const result = {};
            for (const key of Object.keys(entry).sort()) {
                result[key] = sortValue(entry[key]);
            }
            return result;
        }
        return entry;
    };
    return JSON.stringify(sortValue(value));
}
function parseInput(input, limits) {
    if (typeof input !== 'string') {
        inspectTree(input, limits);
        const serialized = JSON.stringify(input);
        if (byteLength(serialized) > limits.maxInputBytes) {
            throw new errors.SnapshotValidationError(`input exceeds ${limits.maxInputBytes} bytes.`);
        }
        return input;
    }
    if (byteLength(input) > limits.maxInputBytes) {
        throw new errors.SnapshotValidationError(`input exceeds ${limits.maxInputBytes} bytes.`);
    }
    try {
        const parsed = JSON.parse(input);
        inspectTree(parsed, limits);
        return parsed;
    }
    catch (error) {
        if (error instanceof errors.SnapshotValidationError)
            throw error;
        throw new errors.SnapshotValidationError('input is not valid JSON.', '$', error);
    }
}
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isUnsupportedCanvasEnvelope(value) {
    if ('schema' in value || !Array.isArray(value.objects) || !isRecord(value._editorState)) {
        return false;
    }
    const editorState = value._editorState;
    return ['currentScale', 'currentRotation', 'baseImageScale'].every((key) => typeof editorState[key] === 'number');
}
class SnapshotService {
    constructor(coreAdapter, slices, mementos, warningSink, limits = DEFAULT_SNAPSHOT_LIMITS) {
        Object.defineProperty(this, "coreAdapter", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: coreAdapter
        });
        Object.defineProperty(this, "slices", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: slices
        });
        Object.defineProperty(this, "mementos", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: mementos
        });
        Object.defineProperty(this, "warningSink", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: warningSink
        });
        Object.defineProperty(this, "limits", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: limits
        });
        Object.defineProperty(this, "opaque", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "prepared", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new WeakSet()
        });
        Object.defineProperty(this, "disposed", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
    }
    capture() {
        this.assertActive('capture a public snapshot');
        const capturedAt = Date.now();
        const context = Object.freeze({ mode: 'snapshot', capturedAt });
        const plugins = Object.create(null);
        for (const [id, entry] of this.opaque)
            plugins[id] = cloneStateValue(entry);
        for (const slice of this.slices.list()) {
            plugins[slice.id] = Object.freeze({
                version: slice.version,
                data: cloneStateValue(slice.capture(context)),
            });
        }
        return Object.freeze({
            schema: 'image-editor.state',
            version: 3,
            core: cloneStateValue(this.coreAdapter.capture(context)),
            plugins: Object.freeze(plugins),
        });
    }
    stringify() {
        return stableJson(this.capture(), this.limits);
    }
    async load(input, options = {}) {
        this.assertActive('load a public snapshot');
        const prepared = await this.prepareForLoad(input, options);
        await this.loadPrepared(prepared, options);
    }
    prepare(input, options = {}) {
        this.assertActive('prepare a public snapshot');
        return this.prepareParsed(parseInput(input, this.limits), options);
    }
    async prepareForLoad(input, options = {}) {
        var _a;
        this.assertActive('prepare a public snapshot');
        const parsed = parseInput(input, this.limits);
        if (!((_a = options.migrations) === null || _a === void 0 ? void 0 : _a.length) ||
            (isRecord(parsed) && parsed.schema === 'image-editor.state' && parsed.version === 3)) {
            return this.prepareParsed(parsed, options);
        }
        const immutableInput = cloneStateValue(parsed);
        const migration = options.migrations.find((candidate) => candidate.canMigrate(immutableInput));
        if (!migration)
            return this.prepareParsed(parsed, options);
        const context = { signal: options.signal };
        const migrated = await migration.migrate(immutableInput, context);
        return this.prepareParsed(parseInput(migrated, this.limits), options);
    }
    prepareParsed(input, options) {
        var _a, _b, _c, _d;
        const snapshot = this.validateEnvelope(input);
        const policy = (_a = options.missingPluginPolicy) !== null && _a !== void 0 ? _a : 'warn-and-skip';
        const coreValidation = this.coreAdapter.validateSnapshot(snapshot.core);
        if (!coreValidation.valid) {
            throw new errors.SnapshotValidationError(coreValidation.message, (_b = coreValidation.path) !== null && _b !== void 0 ? _b : '$.core');
        }
        const validatedSlices = [];
        const opaqueSlices = [];
        for (const [id, entry] of Object.entries(snapshot.plugins)) {
            const serializedBytes = byteLength(stableJson(entry.data, this.limits));
            if (serializedBytes > this.limits.maxPluginPayloadBytes) {
                throw new errors.SnapshotValidationError(`plugin payload exceeds ${this.limits.maxPluginPayloadBytes} bytes.`, `$.plugins.${id}.data`);
            }
            const slice = this.slices.get(id);
            if (!slice) {
                if (policy === 'error') {
                    throw new errors.SnapshotValidationError('required plugin is not installed.', `$.plugins.${id}`);
                }
                if (policy === 'preserve-opaque') {
                    opaqueSlices.push(Object.freeze({ id, entry: cloneStateValue(entry) }));
                }
                (_c = this.warningSink) === null || _c === void 0 ? void 0 : _c.call(this, {
                    code: 'SNAPSHOT_PLUGIN_MISSING',
                    message: `Snapshot data for missing plugin "${id}" was ${policy === 'preserve-opaque' ? 'preserved opaquely' : 'skipped'}.`,
                    sliceId: id,
                });
                continue;
            }
            if (entry.version !== slice.version) {
                throw new errors.SnapshotValidationError(`version ${entry.version} is incompatible with installed version ${slice.version}.`, `$.plugins.${id}.version`);
            }
            const validation = slice.validate(entry.data, {
                sliceId: id,
                version: entry.version,
            });
            if (!validation.valid) {
                throw new errors.SnapshotValidationError(validation.message, (_d = validation.path) !== null && _d !== void 0 ? _d : `$.plugins.${id}.data`);
            }
            validatedSlices.push(Object.freeze({ id, value: cloneStateValue(validation.value) }));
        }
        const prepared = Object.freeze({
            core: cloneStateValue(coreValidation.value),
            validatedSlices: Object.freeze(validatedSlices),
            opaqueSlices: Object.freeze(opaqueSlices),
        });
        this.prepared.add(prepared);
        return prepared;
    }
    async loadPrepared(prepared, options = {}) {
        var _a, _b, _c, _d;
        this.assertActive('load a prepared public snapshot');
        if (!this.prepared.has(prepared)) {
            throw new errors.SnapshotValidationError('prepared snapshot is not trusted.');
        }
        const before = options.rollbackOnFailure === false ? null : this.mementos.capture();
        const controller = new AbortController();
        const abort = () => { var _a; return controller.abort((_a = options.signal) === null || _a === void 0 ? void 0 : _a.reason); };
        (_a = options.signal) === null || _a === void 0 ? void 0 : _a.addEventListener('abort', abort, { once: true });
        if ((_b = options.signal) === null || _b === void 0 ? void 0 : _b.aborted)
            abort();
        const context = Object.freeze({
            mode: 'public-snapshot',
            signal: controller.signal,
        });
        const validatedSlices = new Map(prepared.validatedSlices.map(({ id, value }) => [id, value]));
        const nextOpaque = new Map(prepared.opaqueSlices.map(({ id, entry }) => [id, entry]));
        try {
            await this.coreAdapter.restore(cloneStateValue(prepared.core), context);
            for (const slice of this.slices.list()) {
                if (validatedSlices.has(slice.id)) {
                    await slice.restore(validatedSlices.get(slice.id), context);
                }
                else {
                    await ((_c = slice.clearState) === null || _c === void 0 ? void 0 : _c.call(slice, context));
                }
            }
            this.opaque = nextOpaque;
        }
        catch (error) {
            if (!before)
                throw error;
            try {
                await this.mementos.restore(before, { rollbackOnFailure: false });
            }
            catch (rollbackError) {
                const combinedError = new Error('Snapshot load and rollback both failed.');
                combinedError.causes = Object.freeze([error, rollbackError]);
                throw new errors.SnapshotValidationError('load failed and rollback could not restore the previous state.', '$', combinedError);
            }
            throw error;
        }
        finally {
            (_d = options.signal) === null || _d === void 0 ? void 0 : _d.removeEventListener('abort', abort);
        }
    }
    dispose() {
        this.opaque.clear();
        this.disposed = true;
    }
    reset() {
        this.assertActive('reset SnapshotService');
        this.opaque.clear();
        this.prepared = new WeakSet();
    }
    validateEnvelope(value) {
        if (!isRecord(value))
            throw new errors.SnapshotValidationError('snapshot must be an object.');
        if (isUnsupportedCanvasEnvelope(value)) {
            throw new errors.SnapshotVersionUnsupportedError(typeof value.version === 'number' ? value.version : 'unversioned');
        }
        if (value.schema !== 'image-editor.state') {
            throw new errors.SnapshotValidationError('schema must be "image-editor.state".', '$.schema');
        }
        if (value.version !== 3) {
            throw new errors.SnapshotVersionUnsupportedError(typeof value.version === 'number' ? value.version : 'unversioned');
        }
        if (!isRecord(value.core))
            throw new errors.SnapshotValidationError('core must be an object.', '$.core');
        if (!isRecord(value.plugins)) {
            throw new errors.SnapshotValidationError('plugins must be an object.', '$.plugins');
        }
        const entries = Object.entries(value.plugins);
        if (entries.length > this.limits.maxPluginCount) {
            throw new errors.SnapshotValidationError(`plugin count exceeds ${this.limits.maxPluginCount}.`, '$.plugins');
        }
        const plugins = Object.create(null);
        for (const [id, entry] of entries) {
            if (!pluginIdentifier.isRuntimeIdentifier(id) || pluginIdentifier.isDangerousStateKey(id)) {
                throw new errors.SnapshotValidationError('plugin id is invalid.', `$.plugins.${id}`);
            }
            if (!isRecord(entry) ||
                !Number.isSafeInteger(entry.version) ||
                Number(entry.version) <= 0) {
                throw new errors.SnapshotValidationError('plugin entry requires a positive integer version and data.', `$.plugins.${id}`);
            }
            plugins[id] = Object.freeze({ version: Number(entry.version), data: entry.data });
        }
        return Object.freeze({
            schema: 'image-editor.state',
            version: 3,
            core: cloneStateValue(value.core),
            plugins: Object.freeze(plugins),
        });
    }
    assertActive(operation) {
        if (this.disposed)
            throw new errors.StateRegistrationError(`Cannot ${operation} after disposal.`);
    }
}

function assertDefinition(definition) {
    if (!pluginIdentifier.isRuntimeIdentifier(definition.id)) {
        throw new errors.StateRegistrationError('Invalid State Slice Runtime ID.', definition.id);
    }
    if (!Number.isSafeInteger(definition.version) || definition.version <= 0) {
        throw new errors.StateRegistrationError(`State slice "${definition.id}" must use a positive integer version.`, definition.id);
    }
    if (typeof definition.capture !== 'function' ||
        typeof definition.validate !== 'function' ||
        typeof definition.restore !== 'function') {
        throw new errors.StateRegistrationError(`State slice "${definition.id}" has an incomplete contract.`, definition.id);
    }
    if (definition.capturePolicy !== undefined &&
        definition.capturePolicy !== 'always' &&
        definition.capturePolicy !== 'reference') {
        throw new errors.StateRegistrationError(`State slice "${definition.id}" capturePolicy must be "always" or "reference".`, definition.id);
    }
}
class StateSliceRegistry {
    constructor() {
        Object.defineProperty(this, "definitions", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "disposed", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
    }
    register(definition) {
        var _a;
        this.assertActive();
        assertDefinition(definition);
        if (this.definitions.has(definition.id)) {
            throw new errors.StateRegistrationError(`State slice "${definition.id}" is already registered.`, definition.id);
        }
        const stored = Object.freeze({
            ...definition,
            capturePolicy: (_a = definition.capturePolicy) !== null && _a !== void 0 ? _a : 'always',
        });
        this.definitions.set(definition.id, stored);
        return disposable.createDisposable(() => {
            if (this.definitions.get(definition.id) === stored) {
                this.definitions.delete(definition.id);
            }
        });
    }
    get(id) {
        var _a;
        this.assertActive();
        return (_a = this.definitions.get(id)) !== null && _a !== void 0 ? _a : null;
    }
    list() {
        this.assertActive();
        return Object.freeze([...this.definitions.values()]);
    }
    dispose() {
        if (this.disposed)
            return;
        this.definitions.clear();
        this.disposed = true;
    }
    assertActive() {
        if (this.disposed)
            throw new errors.StateRegistrationError('State slice registry is disposed.');
    }
}

class TransientObjectRegistry {
    constructor(warningSink) {
        Object.defineProperty(this, "warningSink", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: warningSink
        });
        Object.defineProperty(this, "predicates", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "disposed", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
    }
    register(owner, predicate) {
        this.assertActive();
        if (!pluginIdentifier.isRuntimeIdentifier(owner)) {
            throw new errors.StateRegistrationError('Invalid transient predicate owner Runtime ID.');
        }
        if (typeof predicate !== 'function') {
            throw new errors.StateRegistrationError(`Transient predicate for "${owner}" must be a function.`);
        }
        const record = { owner, predicate };
        this.predicates.push(record);
        return disposable.createDisposable(() => {
            const index = this.predicates.indexOf(record);
            if (index >= 0)
                this.predicates.splice(index, 1);
        });
    }
    isTransient(object) {
        var _a;
        this.assertActive();
        for (const record of [...this.predicates]) {
            try {
                if (record.predicate(object))
                    return true;
            }
            catch (error) {
                (_a = this.warningSink) === null || _a === void 0 ? void 0 : _a.call(this, {
                    code: 'TRANSIENT_PREDICATE_FAILED',
                    message: `Transient object predicate owned by "${record.owner}" failed and was ignored.`,
                    details: Object.freeze({ owner: record.owner, cause: error }),
                });
            }
        }
        return false;
    }
    dispose() {
        if (this.disposed)
            return;
        this.predicates.length = 0;
        this.disposed = true;
    }
    assertActive() {
        if (this.disposed)
            throw new errors.StateRegistrationError('Transient object registry is disposed.');
    }
}

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
const MAX_RETAINED_DIAGNOSTICS = 1000;
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
            const timeoutError = new errors.CoreRuntimeError(`[ImageEditor] ${label} timed out after ${Date.now() - startedAt}ms.`, { code: 'IMAGE_LOAD_TIMEOUT' });
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
        throw new errors.CoreRuntimeError('[ImageEditor] Base image returned a malformed transform matrix.');
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
    const binary = /;base64/i.test(header) ? atob(payload) : decodeURIComponent(payload);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1)
        bytes[index] = binary.charCodeAt(index);
    return new File([bytes], fileName, { type: mimeType });
}
function freezePluginDefinition(definition) {
    if (!('manifest' in definition)) {
        return pluginManager.aliasPluginDefinitionIdentity(Object.freeze({
            ...definition,
            requires: definition.requires
                ? Object.freeze(definition.requires.map((requirement) => Object.freeze({ ...requirement })))
                : undefined,
            optional: definition.optional
                ? Object.freeze(definition.optional.map((requirement) => Object.freeze({ ...requirement })))
                : undefined,
            permissions: definition.permissions
                ? Object.freeze([...definition.permissions])
                : undefined,
        }), definition);
    }
    return pluginManager.aliasPluginDefinitionIdentity(Object.freeze({
        ...definition,
        manifest: Object.freeze({
            ...definition.manifest,
            requiresPlugins: definition.manifest.requiresPlugins
                ? Object.freeze([...definition.manifest.requiresPlugins])
                : undefined,
            requires: definition.manifest.requires
                ? Object.freeze(definition.manifest.requires.map((requirement) => Object.freeze({ ...requirement })))
                : undefined,
            optional: definition.manifest.optional
                ? Object.freeze(definition.manifest.optional.map((requirement) => Object.freeze({ ...requirement })))
                : undefined,
            permissions: definition.manifest.permissions
                ? Object.freeze([...definition.manifest.permissions])
                : undefined,
        }),
    }), definition);
}
class ImageEditorCore {
    constructor(fabric, options = {}) {
        Object.defineProperty(this, "fabric", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: fabric
        });
        this.slices = new StateSliceRegistry();
        this.objectProperties = new ObjectPropertyRegistry();
        this.history = new HistoryCommitRouter();
        this.exportContributors = new ExportContributorRegistry();
        this.installationPlan = [];
        this.pluginApiHandles = new Map();
        this.lifecycle = new EditorLifecycleController();
        this.viewportCache = new ViewportCache();
        this.canvas = null;
        this.canvasElement = null;
        this.containerElement = null;
        this.placeholderElement = null;
        this.baseImage = null;
        this.imageMimeType = null;
        this.imageLoaded = false;
        this.baseImageScale = 1;
        this.geometryRevision = 0;
        this.loadSequence = 0;
        this.latestLoadSequence = 0;
        this.stateLoadSequence = 0;
        this.disposePromise = null;
        this.emergencyResetPromise = null;
        this.diagnostics = [];
        if (!fabric ||
            typeof fabric.Canvas !== 'function' ||
            typeof fabric.FabricImage !== 'function') {
            throw new errors.CoreRuntimeError('[ImageEditor] ImageEditorCore requires a supported Fabric.js module.');
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
                        return task(context);
                    }, operationOptions);
                },
            },
            state: {
                requestRender: () => this.requestRender(),
                isDisposed: () => this.lifecycle.current === 'disposed',
                assertOperational: (operation) => this.lifecycle.assertOperational(operation),
            },
            history: this.history,
            events: {
                emitCommitted: (descriptor) => this.emitDocumentCommitted(descriptor),
            },
            warningSink: (warning) => this.reportWarning(warning.cause, warning.message),
            errorSink: (error) => this.reportError(error, 'Document mutation failed.'),
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
        const api = this.plugins.installSync(plugin);
        this.installationPlan.push(Object.freeze({ definition: freezePluginDefinition(plugin) }));
        return this.publishPluginApi(plugin.ref.id, api);
    }
    install(pluginsOrPlan) {
        this.lifecycle.assertAvailable('install a plugin batch');
        const plugins = pluginPlan.isPluginPlan(pluginsOrPlan) ? pluginsOrPlan.plugins : pluginsOrPlan;
        const outcome = this.plugins.installBatchSync(plugins);
        for (const plugin of outcome.installedPlugins) {
            this.installationPlan.push(Object.freeze({ definition: freezePluginDefinition(plugin) }));
        }
        const resolveApi = (plugin) => {
            const api = outcome.apisByPluginId.get(plugin.ref.id);
            if (api === undefined) {
                throw new pluginIdentifier.PluginNotInstalledError(plugin.ref.id);
            }
            return this.publishPluginApi(plugin.ref.id, api);
        };
        if (pluginPlan.isPluginPlan(pluginsOrPlan)) {
            return pluginPlan.resolvePluginPlanApis(pluginsOrPlan, resolveApi);
        }
        return Object.freeze(pluginsOrPlan.map((plugin) => resolveApi(plugin)));
    }
    async useAsync(plugin) {
        this.lifecycle.assertAvailable('install a plugin');
        const api = await this.plugins.install(plugin);
        this.installationPlan.push(Object.freeze({
            definition: freezePluginDefinition(plugin),
        }));
        return this.publishPluginApi(plugin.ref.id, api);
    }
    getPlugin(ref) {
        const api = this.plugins.get(ref);
        return api === null ? null : this.publishPluginApi(ref.id, api);
    }
    requirePlugin(ref) {
        const api = this.getPlugin(ref);
        if (api === null)
            throw new pluginIdentifier.PluginNotInstalledError(ref.id);
        return api;
    }
    getPluginById(pluginId) {
        const api = this.plugins.getById(pluginId);
        return api === null ? null : this.publishPluginApi(pluginId, api);
    }
    getLifecycleState() {
        return this.lifecycle.current;
    }
    getDiagnostics() {
        return Object.freeze([...this.diagnostics]);
    }
    async init(elements) {
        this.lifecycle.beginInitialization();
        let pluginInitializationStarted = false;
        try {
            this.createCanvas(elements);
            pluginInitializationStarted = true;
            await this.plugins.initialize();
            this.lifecycle.completeInitialization();
        }
        catch (error) {
            const cleanupErrors = await this.rollbackInitialization(error, pluginInitializationStarted);
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
            throw error;
        }
        this.finishInitialization();
    }
    createCanvas(elements) {
        var _a, _b, _c, _d, _e, _f;
        const ownerDocument = typeof elements.canvas === 'string'
            ? globalThis.document
            : (_a = elements.canvas) === null || _a === void 0 ? void 0 : _a.ownerDocument;
        if (!ownerDocument)
            throw new errors.CoreRuntimeError('[ImageEditor] Canvas document is unavailable.');
        const canvasElement = resolveElement(elements.canvas, ownerDocument);
        if (!canvasElement ||
            canvasElement.tagName.toLowerCase() !== 'canvas' ||
            typeof canvasElement.getContext !== 'function') {
            throw new errors.CoreRuntimeError('[ImageEditor] Core canvas element was not found.');
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
            preserveObjectStacking: true,
        });
    }
    finishInitialization() {
        if (this.options.initialImageBase64) {
            void this.loadImage(this.options.initialImageBase64).catch(() => undefined);
        }
        else {
            this.updatePlaceholder();
        }
    }
    async loadImage(source, options = {}) {
        this.assertReady('load an image');
        const encodedImage = inspectEncodedImageDataUrl(source);
        if (!inferMimeType(source) || !encodedImage) {
            throw new errors.CoreRuntimeError('[ImageEditor] Unsupported image Data URL.');
        }
        if (encodedImage.encodedBytes > this.options.maxInputBytes) {
            throw new errors.CoreRuntimeError('[ImageEditor] Image input exceeds maxInputBytes.');
        }
        if (encodedImage.dimensions &&
            !this.isInputRasterWithinBudget(encodedImage.dimensions.width, encodedImage.dimensions.height)) {
            throw new errors.CoreRuntimeError('[ImageEditor] Image input dimensions exceed the configured budget.');
        }
        if (options.concurrency && options.concurrency !== 'replace-pending') {
            throw new errors.CoreRuntimeError('[ImageEditor] Unsupported load concurrency policy.');
        }
        try {
            await this.plugins.runOperationForHost('core:load-image', source, async (loadSource, operationContext) => {
                const sequence = ++this.loadSequence;
                this.latestLoadSequence = sequence;
                const image = await withCoreTimeout((signal) => this.fabric.FabricImage.fromURL(loadSource, {
                    crossOrigin: 'anonymous',
                    signal,
                }), this.options.imageLoadTimeoutMs, 'FabricImage.fromURL', operationContext.signal, (lateImage) => lateImage.dispose());
                this.assertCurrentLoad(sequence, operationContext.signal);
                const naturalWidth = Number(image.width) || 0;
                const naturalHeight = Number(image.height) || 0;
                if (!this.isInputRasterWithinBudget(naturalWidth, naturalHeight)) {
                    const budgetError = new errors.CoreRuntimeError('[ImageEditor] Decoded image dimensions exceed the configured budget.');
                    try {
                        await image.dispose();
                    }
                    catch (cleanupError) {
                        throw new errors.CoreRuntimeError('[ImageEditor] Rejected image cleanup failed.', { cause: Object.freeze([budgetError, cleanupError]) });
                    }
                    throw budgetError;
                }
                const previousScroll = this.containerElement
                    ? {
                        left: this.containerElement.scrollLeft,
                        top: this.containerElement.scrollTop,
                    }
                    : null;
                await this.documentMutations.run({
                    id: `core:load-image-transaction:${sequence}`,
                    kind: 'raster',
                    operationId: 'core:commit-load-image',
                    conflictDomains: [
                        'document',
                        'base-image',
                        'geometry',
                        'raster',
                        'overlay',
                        'state',
                    ],
                    signal: operationContext.signal,
                    metadata: Object.freeze({ sequence }),
                    mutate: async (commitContext) => {
                        this.assertCurrentLoad(sequence, commitContext.signal);
                        if (this.baseImage) {
                            await this.plugins.notifyImageCleared();
                            this.assertCurrentLoad(sequence, commitContext.signal);
                        }
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
                        this.imageLoaded = true;
                        this.baseImageScale = layout.imageScale;
                        this.imageMimeType = inferMimeType(loadSource);
                        this.geometryRevision += 1;
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
                if (options.preserveScroll && previousScroll && this.containerElement) {
                    this.containerElement.scrollLeft = previousScroll.left;
                    this.containerElement.scrollTop = previousScroll.top;
                }
                this.updatePlaceholder();
            }, { signal: options.signal });
        }
        catch (error) {
            if (!isLoadCancellation(error))
                this.reportError(error, 'loadImage failed.');
            throw error;
        }
    }
    async loadImageFile(file, options = {}) {
        var _a;
        if (!(file instanceof File))
            throw new TypeError('[ImageEditor] loadImageFile expects a File.');
        if (file.size > this.options.maxInputBytes) {
            throw new errors.CoreRuntimeError('[ImageEditor] Image file exceeds maxInputBytes.');
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
                missingPluginPolicy: options.missingPluginPolicy,
                migrations: options.migrations,
                signal: options.signal,
            });
            const sequence = ++this.stateLoadSequence;
            await this.documentMutations.run({
                id: `core:load-state-transaction:${sequence}`,
                kind: 'compound',
                operationId: 'core:load-state',
                conflictDomains: [
                    'document',
                    'base-image',
                    'geometry',
                    'raster',
                    'overlay',
                    'state',
                ],
                signal: options.signal,
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
        var _a, _b;
        const dataUrl = await this.runExport(options);
        const format = (_a = options.format) !== null && _a !== void 0 ? _a : 'png';
        return base64ToFile(dataUrl, (_b = options.fileName) !== null && _b !== void 0 ? _b : `image.${format === 'jpeg' ? 'jpg' : format}`);
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
        this.layoutMode = mode;
        this.viewportCache.clear();
    }
    emergencyReset() {
        if (this.emergencyResetPromise)
            return this.emergencyResetPromise;
        if (this.lifecycle.current !== 'faulted') {
            return Promise.reject(new errors.CoreRuntimeError(`[ImageEditor] emergencyReset() is available only while the editor is faulted.`, { code: 'EMERGENCY_RESET_NOT_ALLOWED', behavior: 'lifecycle' }));
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
            throw new errors.CoreRuntimeError('[ImageEditor] forceDispose() is available only while the editor is faulted.', { code: 'FORCE_DISPOSE_NOT_ALLOWED', behavior: 'lifecycle' });
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
            const failure = new errors.CoreRuntimeError(`[ImageEditor] Emergency reset cleanup failed in ${failures.length} step(s).`, {
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
        throw new errors.EmergencyResetError(this.getDiagnostics(), cause);
    }
    async disposeAfterEmergencyFailure() {
        if (!this.lifecycle.beginDisposal())
            return;
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
    }
    createPluginManager() {
        const manager = new pluginManager.PluginManager({
            warningSink: (warning) => this.reportWarning(warning.cause, warning.message),
            errorSink: (error) => this.reportError(error, 'Plugin lifecycle failed.'),
            hostCapabilities: [
                {
                    token: CORE_ENVIRONMENT_CAPABILITY,
                    implementation: this.createEnvironmentPort(),
                },
                {
                    token: coreCapabilities.CORE_STATUS_CAPABILITY,
                    implementation: this.createStatusPort(),
                },
                {
                    token: coreCapabilities.CORE_DIAGNOSTICS_CAPABILITY,
                    implementation: this.createDiagnosticsPort(),
                },
                {
                    token: coreCapabilities.CORE_PRESENTATION_CAPABILITY,
                    implementation: this.createPresentationPort(),
                },
                {
                    token: coreCapabilities.FABRIC_RUNTIME_CAPABILITY,
                    implementation: this.createFabricRuntimePort(),
                    requiredPermission: 'fabric:objects',
                },
                {
                    token: coreCapabilities.CANVAS_READ_CAPABILITY,
                    implementation: this.createCanvasReadPort(),
                    requiredPermission: 'fabric:canvas-read',
                },
                {
                    token: coreCapabilities.BASE_IMAGE_READ_CAPABILITY,
                    implementation: this.createBaseImageReadPort(),
                },
                {
                    token: coreCapabilities.BASE_IMAGE_INFO_CAPABILITY,
                    implementation: this.createBaseImageInfoPort(),
                },
                {
                    token: coreCapabilities.IMAGE_RESOURCE_POLICY_CAPABILITY,
                    implementation: this.createImageResourcePolicyPort(),
                },
                {
                    token: coreCapabilities.RENDER_REQUEST_CAPABILITY,
                    implementation: this.createRenderRequestPort(),
                },
                {
                    token: coreCapabilities.CANVAS_RESIZE_CAPABILITY,
                    implementation: this.createCanvasResizePort(),
                },
                {
                    token: coreCapabilities.RASTER_MUTATION_CAPABILITY,
                    implementation: this.createRasterMutationPort(),
                    requiredPermission: 'core:raster-mutation',
                },
                {
                    token: coreCapabilities.SNAPSHOT_REGISTRATION_CAPABILITY,
                    implementation: this.createSnapshotRegistrationPort(),
                },
                {
                    token: coreCapabilities.MEMENTO_HISTORY_CAPABILITY,
                    implementation: this.createMementoHistoryPort(),
                },
                {
                    token: coreCapabilities.GEOMETRY_MUTATION_CAPABILITY,
                    implementation: this.geometry,
                    requiredPermission: 'core:geometry-participant',
                },
                { token: coreCapabilities.DOCUMENT_MUTATION_CAPABILITY, implementation: this.documentMutations },
                {
                    token: coreCapabilities.EXPORT_CONTRIBUTION_CAPABILITY,
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
            conflictDomains: ['document', 'base-image', 'geometry', 'raster', 'overlay', 'state'],
            reentrancy: 'queue',
        });
        manager.registerHostOperation({
            id: 'core:load-state',
            mode: 'mutation',
            conflictDomains: ['document', 'base-image', 'geometry', 'raster', 'overlay', 'state'],
            reentrancy: 'reject',
        });
        manager.registerHostOperation({
            id: 'core:export',
            mode: 'read',
            conflictDomains: ['document', 'base-image', 'overlay', 'export', 'state'],
            reentrancy: 'queue',
        });
        return manager;
    }
    async rollbackInitialization(failure, pluginInitializationStarted) {
        const cleanupErrors = this.getInitializationCleanupErrors(failure);
        const canvas = this.canvas;
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
        return failure instanceof pluginIdentifier.PluginLifecycleError ? [...failure.cleanupErrors] : [];
    }
    async replayInstallationPlan() {
        var _a, _b;
        const manager = this.createPluginManager();
        try {
            for (const planned of this.installationPlan) {
                await manager.install(planned.definition);
            }
            const replayedApis = new Map();
            for (const pluginId of this.pluginApiHandles.keys()) {
                const api = manager.getById(pluginId);
                if (!isProxyablePluginApi(api)) {
                    throw new errors.CoreRuntimeError(`[ImageEditor] Replayed Plugin "${pluginId}" did not return a stable object API.`, { code: 'PLUGIN_API_REPLAY_INCOMPATIBLE', behavior: 'lifecycle' });
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
                matrix: affineMatrix.IDENTITY_AFFINE_MATRIX,
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
        const nextWidth = Math.max(1, Math.ceil(width));
        const nextHeight = Math.max(1, Math.ceil(height));
        this.assertRasterBudget(nextWidth, nextHeight);
        applyCanvasDimensions(this.canvas, nextWidth, nextHeight, this.containerElement);
    }
    isInputRasterWithinBudget(width, height) {
        return imageBudget.isRasterAllocationWithinBudget(width, height, {
            maxDimension: this.options.maxExportDimension,
            maxPixels: Math.min(this.options.maxInputPixels, this.options.maxExportPixels),
        });
    }
    assertRasterBudget(width, height, multiplier = 1) {
        if (!imageBudget.isRasterAllocationWithinBudget(width, height, {
            maxDimension: this.options.maxExportDimension,
            maxPixels: this.options.maxExportPixels,
        }, multiplier)) {
            throw new errors.CoreRuntimeError('[ImageEditor] Dimensions exceed the configured budget.');
        }
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
                    throw new errors.CoreRuntimeError('[ImageEditor] No image is loaded.');
                this.baseImage.setCoords();
                const bounds = this.baseImage.getBoundingRect();
                left = bounds.left;
                top = bounds.top;
                width = bounds.width;
                height = bounds.height;
            }
            this.assertRasterBudget(width, height, multiplier);
            this.assertRasterBudget(canvas.getWidth(), canvas.getHeight());
            const exportElement = (_d = this.canvasElement) === null || _d === void 0 ? void 0 : _d.ownerDocument.createElement('canvas');
            if (!exportElement) {
                throw new errors.CoreRuntimeError('[ImageEditor] Export requires an initialized Canvas.');
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
            throw new errors.CoreRuntimeError(`[ImageEditor] Cannot ${operation} without Canvas.`);
        return this.canvas;
    }
    requireCanvasForPlugin(operation) {
        if (this.lifecycle.current !== 'initializing')
            this.lifecycle.assertOperational(operation);
        if (!this.canvas)
            throw new errors.CoreRuntimeError(`[ImageEditor] Cannot ${operation} without Canvas.`);
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
        const suspension = this.plugins.suspendOperationsForHost(new errors.EditorFaultedError('run an operation'));
        void suspension.catch((suspensionError) => {
            this.recordDiagnostic(suspensionError, 'Faulted operation suspension failed.');
        });
        this.recordDiagnostic(error);
        this.reportError(error, 'Core entered the faulted lifecycle state.');
    }
    recordDiagnostic(error, message) {
        const classification = errors.classifyCoreError(error);
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
            cause: error instanceof errors.CoreRuntimeError && error.cause !== undefined
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
            throw new errors.CoreRuntimeError(`[ImageEditor] Cannot ${operation} without Canvas.`);
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
                await cleanup();
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
    completeDisposal(errors$1, label) {
        this.lifecycle.completeDisposal();
        this.clearPluginApiHandles();
        if (errors$1.length > 0) {
            throw new errors.CoreRuntimeError(`[ImageEditor] ${label} completed with ${errors$1.length} cleanup error(s).`, { code: 'CORE_DISPOSE_ERROR', cause: Object.freeze(errors$1) });
        }
    }
    observeDetachedDisposal(disposal) {
        void disposal.catch((error) => {
            this.recordDiagnostic(error, 'Detached Core disposal completed with cleanup failures.');
            this.reportError(error, 'Detached Core disposal completed with cleanup failures.');
        });
    }
}

exports.CoreRuntimeError = errors.CoreRuntimeError;
exports.DocumentMutationInvariantError = errors.DocumentMutationInvariantError;
exports.EditorAlreadyInitializedError = errors.EditorAlreadyInitializedError;
exports.EditorDisposedError = errors.EditorDisposedError;
exports.EditorDisposingError = errors.EditorDisposingError;
exports.EditorFaultedError = errors.EditorFaultedError;
exports.EditorInitializationInProgressError = errors.EditorInitializationInProgressError;
exports.EmergencyResetError = errors.EmergencyResetError;
exports.SnapshotValidationError = errors.SnapshotValidationError;
exports.SnapshotVersionUnsupportedError = errors.SnapshotVersionUnsupportedError;
exports.classifyCoreError = errors.classifyCoreError;
exports.AFFINE_EPSILON = affineMatrix.AFFINE_EPSILON;
exports.IDENTITY_AFFINE_MATRIX = affineMatrix.IDENTITY_AFFINE_MATRIX;
exports.affineDeterminant = affineMatrix.affineDeterminant;
exports.applyAffineToPoint = affineMatrix.applyAffineToPoint;
exports.approximatelyEqualAffine = affineMatrix.approximatelyEqualAffine;
exports.assertAffineMatrix = affineMatrix.assertAffineMatrix;
exports.computeAffineDelta = affineMatrix.computeAffineDelta;
exports.hasAffineReflection = affineMatrix.hasAffineReflection;
exports.invertAffine = affineMatrix.invertAffine;
exports.isFiniteAffineMatrix = affineMatrix.isFiniteAffineMatrix;
exports.multiplyAffine = affineMatrix.multiplyAffine;
exports.sanitizeAffineMatrix = affineMatrix.sanitizeAffineMatrix;
exports.transformRectBounds = affineMatrix.transformRectBounds;
exports.createCapabilityToken = pluginManifest.createCapabilityToken;
exports.definePluginRef = pluginManifest.definePluginRef;
exports.isDangerousStateKey = pluginIdentifier.isDangerousStateKey;
exports.DEFAULT_SNAPSHOT_LIMITS = DEFAULT_SNAPSHOT_LIMITS;
exports.ImageEditorCore = ImageEditorCore;
exports.MementoService = MementoService;
exports.ObjectPropertyRegistry = ObjectPropertyRegistry;
exports.SnapshotService = SnapshotService;
exports.StateSliceRegistry = StateSliceRegistry;
exports.TransientObjectRegistry = TransientObjectRegistry;
exports.assertSafeImmutableReference = assertSafeImmutableReference;
exports.cloneStateValue = cloneStateValue;
//# sourceMappingURL=index.cjs.map
