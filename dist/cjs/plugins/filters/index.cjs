'use strict';

var disposable = require('../../chunks/disposable-Sj4tt6Lk.cjs');
var pluginManifest = require('../../chunks/plugin-manifest-BCkXHQr2.cjs');
var pluginDefinition = require('../../chunks/plugin-definition-B3UyurRp.cjs');
var coreCapabilities = require('../../chunks/core-capabilities-ewP5YPVJ.cjs');
var visibleRasterBake = require('../../chunks/visible-raster-bake-B7dAdnmC.cjs');

class FilterDefinitionError extends TypeError {
    constructor(message, path = '$') {
        super(`[ImageEditor] ${message}`);
        Object.defineProperty(this, "path", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: path
        });
        Object.defineProperty(this, "code", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'FILTER_DEFINITION_INVALID'
        });
        this.name = 'FilterDefinitionError';
    }
}
class FiltersPreviewMissingError extends Error {
    constructor() {
        super('[ImageEditor] Cannot commit Filters without definitions or an active preview.');
        Object.defineProperty(this, "code", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'FILTERS_PREVIEW_MISSING'
        });
        this.name = 'FiltersPreviewMissingError';
    }
}
class FiltersPluginDisposedError extends Error {
    constructor(operation) {
        super(`[ImageEditor] Cannot ${operation} after Filters Plugin disposal.`);
        Object.defineProperty(this, "code", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'FILTERS_PLUGIN_DISPOSED'
        });
        this.name = 'FiltersPluginDisposedError';
    }
}
class FilterImplementationError extends Error {
    constructor(filterType, cause) {
        super(`[ImageEditor] Fabric cannot apply the "${filterType}" Filter.`);
        Object.defineProperty(this, "code", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'FILTER_IMPLEMENTATION_UNAVAILABLE'
        });
        Object.defineProperty(this, "cause", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.name = 'FilterImplementationError';
        this.cause = cause;
    }
}
class FilterBakeValidationError extends Error {
    constructor(message, cause) {
        super(`[ImageEditor] ${message}`);
        Object.defineProperty(this, "code", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'FILTER_BAKE_INVALID'
        });
        Object.defineProperty(this, "cause", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.name = 'FilterBakeValidationError';
        this.cause = cause;
    }
}

const MAX_SUPPORTED_FILTER_COUNT = 8;
const SUPPORTED_FILTER_TYPES = Object.freeze([
    'brightness',
    'contrast',
    'saturation',
    'grayscale',
    'sepia',
    'vintage',
    'blur',
    'sharpen',
]);
const dangerousKeys = new Set(['__proto__', 'constructor', 'prototype']);
const numericRanges = Object.freeze({
    brightness: [-1, 1],
    contrast: [-1, 1],
    saturation: [-1, 1],
    blur: [0, 1],
    sharpen: [0, 1],
});
function isRecord$1(value) {
    if (typeof value !== 'object' || value === null || Array.isArray(value))
        return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}
function validateKeys(value, allowed, path) {
    for (const key of Reflect.ownKeys(value)) {
        if (typeof key !== 'string') {
            throw new FilterDefinitionError('Filter definition contains an unsupported symbol key.', path);
        }
        if (dangerousKeys.has(key)) {
            throw new FilterDefinitionError(`Filter definition contains dangerous key "${key}".`, path);
        }
        if (!allowed.includes(key)) {
            throw new FilterDefinitionError(`Filter definition contains unknown key "${key}".`, path);
        }
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (!descriptor || !('value' in descriptor)) {
            throw new FilterDefinitionError(`Filter definition property "${key}" must be a data property.`, path);
        }
    }
}
function normalizeMaxFilterCount(value) {
    const maxFilterCount = value !== null && value !== void 0 ? value : MAX_SUPPORTED_FILTER_COUNT;
    if (!Number.isSafeInteger(maxFilterCount) ||
        maxFilterCount < 1 ||
        maxFilterCount > MAX_SUPPORTED_FILTER_COUNT) {
        throw new FilterDefinitionError(`maxFilterCount must be an integer from 1 to ${MAX_SUPPORTED_FILTER_COUNT}.`, '$.maxFilterCount');
    }
    return maxFilterCount;
}
function normalizeDefinition(value, index) {
    const path = `$[${index}]`;
    if (!isRecord$1(value)) {
        throw new FilterDefinitionError('Each Filter definition must be a plain object.', path);
    }
    validateKeys(value, ['type', 'value'], path);
    const type = value.type;
    if (typeof type !== 'string' || !SUPPORTED_FILTER_TYPES.includes(type)) {
        throw new FilterDefinitionError(`Unknown Filter type "${String(type)}".`, `${path}.type`);
    }
    if (type === 'grayscale' || type === 'sepia' || type === 'vintage') {
        validateKeys(value, ['type'], path);
        return Object.freeze({ type });
    }
    if (typeof value.value !== 'number' || !Number.isFinite(value.value)) {
        throw new FilterDefinitionError('Filter value must be finite.', `${path}.value`);
    }
    const numericType = type;
    const [minimum, maximum] = numericRanges[numericType];
    if (value.value < minimum || value.value > maximum) {
        throw new FilterDefinitionError(`${type} value must be within [${minimum}, ${maximum}].`, `${path}.value`);
    }
    if (value.value === 0)
        return null;
    return Object.freeze({ type: numericType, value: value.value });
}
function normalizeFilterDefinitions(value, limits = {}) {
    if (!Array.isArray(value)) {
        throw new FilterDefinitionError('Filter definitions must be an array.');
    }
    const maxFilterCount = normalizeMaxFilterCount(limits.maxFilterCount);
    if (value.length > maxFilterCount) {
        throw new FilterDefinitionError(`Filter count exceeds ${maxFilterCount}.`);
    }
    const definitionByType = new Map();
    const seenTypes = new Set();
    for (let index = 0; index < value.length; index += 1) {
        const definition = normalizeDefinition(value[index], index);
        const type = value[index].type;
        if (seenTypes.has(type)) {
            throw new FilterDefinitionError(`Duplicate Filter type "${type}" is not supported.`, `$[${index}].type`);
        }
        seenTypes.add(type);
        if (definition)
            definitionByType.set(definition.type, definition);
    }
    return Object.freeze(SUPPORTED_FILTER_TYPES.flatMap((type) => {
        const definition = definitionByType.get(type);
        return definition ? [definition] : [];
    }));
}
function areFilterDefinitionsEqual(left, right) {
    if (left.length !== right.length)
        return false;
    return left.every((definition, index) => {
        const candidate = right[index];
        if (!candidate || definition.type !== candidate.type)
            return false;
        return (!('value' in definition) ||
            ('value' in candidate && definition.value === candidate.value));
    });
}

function getFilterRegistry(fabric) {
    var _a;
    return (_a = fabric.filters) !== null && _a !== void 0 ? _a : {};
}
function createFilter(registry, definition) {
    let constructorName;
    let options;
    switch (definition.type) {
        case 'brightness':
            constructorName = 'Brightness';
            options = { brightness: definition.value };
            break;
        case 'contrast':
            constructorName = 'Contrast';
            options = { contrast: definition.value };
            break;
        case 'saturation':
            constructorName = 'Saturation';
            options = { saturation: definition.value };
            break;
        case 'grayscale':
            constructorName = 'Grayscale';
            break;
        case 'sepia':
            constructorName = 'Sepia';
            break;
        case 'vintage':
            constructorName = 'Vintage';
            break;
        case 'blur':
            constructorName = 'Blur';
            options = { blur: definition.value };
            break;
        case 'sharpen': {
            constructorName = 'Convolute';
            const strength = definition.value;
            options = {
                matrix: [0, -strength, 0, -strength, 1 + 4 * strength, -strength, 0, -strength, 0],
            };
            break;
        }
    }
    const FilterConstructor = registry[constructorName];
    if (!FilterConstructor)
        throw new FilterImplementationError(definition.type);
    try {
        return new FilterConstructor(options);
    }
    catch (error) {
        throw new FilterImplementationError(definition.type, error);
    }
}
function createFabricFilters(fabric, definitions) {
    const registry = getFilterRegistry(fabric);
    return definitions.map((definition) => createFilter(registry, definition));
}
function applyFilterDefinitions(fabric, image, definitions) {
    var _a, _b;
    image.filters = [...createFabricFilters(fabric, definitions)];
    try {
        image.applyFilters();
        image.dirty = true;
    }
    catch (error) {
        const type = (_b = (_a = definitions[definitions.length - 1]) === null || _a === void 0 ? void 0 : _a.type) !== null && _b !== void 0 ? _b : 'brightness';
        image.filters = [];
        throw new FilterImplementationError(type, error);
    }
}

function abortError$1(message) {
    return new DOMException(message, 'AbortError');
}
function throwIfAborted(signal) {
    var _a;
    if (signal.aborted)
        throw (_a = signal.reason) !== null && _a !== void 0 ? _a : abortError$1('Filter rendering was aborted.');
}
function disposeFabricImage(image) {
    if (!image)
        return;
    image.dispose();
}
function copyBaseImagePresentation(source, target, options = {}) {
    var _a;
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
        opacity: source.opacity,
        visible: source.visible,
        selectable: options.transient ? false : source.selectable,
        evented: options.transient ? false : source.evented,
        hasControls: options.transient ? false : source.hasControls,
        hoverCursor: source.hoverCursor,
        excludeFromExport: source.excludeFromExport,
        backgroundColor: (_a = options.backgroundColor) !== null && _a !== void 0 ? _a : source.backgroundColor,
    });
    target.setCoords();
}
async function createFilteredImageClone(fabric, baseImage, definitions, signal, backgroundColor) {
    throwIfAborted(signal);
    const clone = await baseImage.clone();
    try {
        throwIfAborted(signal);
        applyFilterDefinitions(fabric, clone, definitions);
        copyBaseImagePresentation(baseImage, clone, { backgroundColor, transient: true });
        throwIfAborted(signal);
        return clone;
    }
    catch (error) {
        disposeFabricImage(clone);
        throw error;
    }
}
function normalizeFilterBakeOptions(options, sourceMimeType) {
    var _a;
    if (options !== undefined && (typeof options !== 'object' || options === null)) {
        throw new FilterBakeValidationError('Filter bake options must be an object.');
    }
    const record = (options !== null && options !== void 0 ? options : {});
    for (const key of Object.keys(record)) {
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
            throw new FilterBakeValidationError(`Filter bake options contain dangerous key "${key}".`);
        }
        if (key !== 'format' && key !== 'quality') {
            throw new FilterBakeValidationError(`Filter bake options contain unknown key "${key}".`);
        }
    }
    const sourceFormat = sourceMimeType === 'image/jpeg' ? 'jpeg' : sourceMimeType === 'image/webp' ? 'webp' : 'png';
    const format = (_a = record.format) !== null && _a !== void 0 ? _a : sourceFormat;
    if (format !== 'png' && format !== 'jpeg' && format !== 'webp') {
        throw new FilterBakeValidationError('Filter bake format must be png, jpeg, or webp.');
    }
    const quality = record.quality;
    if (quality !== undefined && (typeof quality !== 'number' || !Number.isFinite(quality))) {
        throw new FilterBakeValidationError('Filter bake quality must be finite.');
    }
    if (typeof quality === 'number' && (quality < 0 || quality > 1)) {
        throw new FilterBakeValidationError('Filter bake quality must be within [0, 1].');
    }
    return Object.freeze({
        format,
        quality: quality,
        mimeType: format === 'jpeg' ? 'image/jpeg' : `image/${format}`,
    });
}
function encodedBytes(dataUrl) {
    const commaIndex = dataUrl.indexOf(',');
    if (commaIndex < 0 || !/;base64$/i.test(dataUrl.slice(0, commaIndex))) {
        throw new FilterBakeValidationError('Filtered Raster output is not a base64 Data URL.');
    }
    const payload = dataUrl.slice(commaIndex + 1);
    const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0;
    return Math.floor((payload.length * 3) / 4) - padding;
}
async function decodeBakedImage(fabric, dataUrl, timeoutMs, signal) {
    var _a;
    const controller = new AbortController();
    const abort = () => controller.abort(signal.reason);
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted)
        abort();
    const timeout = setTimeout(() => controller.abort(new FilterBakeValidationError('Filtered Raster decode timed out.')), timeoutMs);
    try {
        return await fabric.FabricImage.fromURL(dataUrl, {
            crossOrigin: 'anonymous',
            signal: controller.signal,
        });
    }
    catch (error) {
        if (controller.signal.aborted)
            throw (_a = controller.signal.reason) !== null && _a !== void 0 ? _a : error;
        throw new FilterBakeValidationError('Filtered Raster decode failed.', error);
    }
    finally {
        clearTimeout(timeout);
        signal.removeEventListener('abort', abort);
    }
}
async function renderBakedImage(fabric, baseImage, definitions, options, imageInfo, policy, signal) {
    var _a;
    const normalizedOptions = normalizeFilterBakeOptions(options, (_a = imageInfo === null || imageInfo === void 0 ? void 0 : imageInfo.mimeType) !== null && _a !== void 0 ? _a : null);
    const width = Number(baseImage.width);
    const height = Number(baseImage.height);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
        throw new FilterBakeValidationError('Base Image dimensions are invalid.');
    }
    if (width > policy.maxExportDimension ||
        height > policy.maxExportDimension ||
        width * height > Math.min(policy.maxInputPixels, policy.maxExportPixels)) {
        throw new FilterBakeValidationError('Filtered Raster dimensions exceed the Core policy.');
    }
    const clone = await createFilteredImageClone(fabric, baseImage, definitions, signal);
    let replacement = null;
    try {
        throwIfAborted(signal);
        const dataUrl = clone.toDataURL({
            format: normalizedOptions.format,
            quality: normalizedOptions.quality,
            multiplier: 1,
            withoutTransform: true,
            withoutShadow: true,
            enableRetinaScaling: false,
        });
        if (encodedBytes(dataUrl) > policy.maxInputBytes) {
            throw new FilterBakeValidationError('Filtered Raster exceeds the Core input budget.');
        }
        replacement = await decodeBakedImage(fabric, dataUrl, policy.imageLoadTimeoutMs, signal);
        throwIfAborted(signal);
        if (replacement.width !== width || replacement.height !== height) {
            throw new FilterBakeValidationError('Filtered Raster dimensions changed during decode.');
        }
        copyBaseImagePresentation(baseImage, replacement);
        return Object.freeze({ image: replacement, mimeType: normalizedOptions.mimeType });
    }
    catch (error) {
        disposeFabricImage(replacement);
        throw error;
    }
    finally {
        disposeFabricImage(clone);
    }
}

const FILTERS_STATE_SCHEMA = 'image-editor.filters';
const FILTERS_STATE_VERSION = 1;
const mutationConflictDomains = [
    'document',
    'base-image',
    'geometry',
    'raster',
    'overlay',
    'state',
];
function createState(definitions) {
    return Object.freeze({
        schema: FILTERS_STATE_SCHEMA,
        version: FILTERS_STATE_VERSION,
        filters: definitions,
    });
}
const emptyDefinitions = Object.freeze([]);
const emptyState = createState(emptyDefinitions);
function normalizeConfiguration(options) {
    var _a, _b;
    normalizeFilterDefinitions([], {
        maxFilterCount: (_a = options.maxFilterCount) !== null && _a !== void 0 ? _a : MAX_SUPPORTED_FILTER_COUNT,
    });
    return Object.freeze({
        maxFilterCount: (_b = options.maxFilterCount) !== null && _b !== void 0 ? _b : MAX_SUPPORTED_FILTER_COUNT,
    });
}
function isRecord(value) {
    if (typeof value !== 'object' || value === null || Array.isArray(value))
        return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}
function validateStateKeys(value) {
    for (const key of Object.keys(value)) {
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
            return `Filters state contains dangerous key "${key}".`;
        }
        if (key !== 'schema' && key !== 'version' && key !== 'filters') {
            return `Filters state contains unknown key "${key}".`;
        }
    }
    return null;
}
function abortError(message) {
    return new DOMException(message, 'AbortError');
}
function operationAbortReason(signal, fallback) {
    var _a;
    return (_a = signal.reason) !== null && _a !== void 0 ? _a : abortError(fallback);
}
class FiltersController {
    constructor(host, operations, mutations, raster, options) {
        Object.defineProperty(this, "host", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: host
        });
        Object.defineProperty(this, "operations", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: operations
        });
        Object.defineProperty(this, "mutations", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: mutations
        });
        Object.defineProperty(this, "raster", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: raster
        });
        Object.defineProperty(this, "configuration", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "committedState", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: emptyState
        });
        Object.defineProperty(this, "previewDefinitions", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "committedVisual", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "committedSource", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "previewVisual", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "previewSource", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "transientImages", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Set()
        });
        Object.defineProperty(this, "listeners", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Set()
        });
        Object.defineProperty(this, "previewSequence", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
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
        this.configuration = normalizeConfiguration(options);
    }
    get isPreviewing() {
        return this.previewDefinitions !== null;
    }
    getState() {
        this.assertActive('read Filter state');
        return this.committedState;
    }
    hasVisibleState() {
        this.assertActive('inspect visible Filter state');
        return this.committedState.filters.length > 0;
    }
    getConfiguration() {
        this.assertActive('read Filter configuration');
        return this.configuration;
    }
    subscribe(listener) {
        this.assertActive('subscribe to Filter status');
        if (typeof listener !== 'function') {
            throw new TypeError('[ImageEditor] Filters status listener must be a function.');
        }
        this.listeners.add(listener);
        return disposable.createDisposable(() => {
            this.listeners.delete(listener);
        });
    }
    async preview(filters) {
        this.assertActive('preview Filters');
        const requestedDefinitions = this.normalizeDefinitions(filters);
        const sequence = ++this.previewSequence;
        await this.operations.run('filters:preview', async (operationSignal) => {
            const definitions = this.normalizeDefinitions(requestedDefinitions);
            this.assertImageLoaded('preview Filters');
            const baseImage = this.host.getBaseImage();
            if (!baseImage)
                throw new Error('[ImageEditor] Cannot preview Filters without a Base Image.');
            const candidate = definitions.length === 0
                ? null
                : await createFilteredImageClone(this.host.fabric, baseImage, definitions, operationSignal, this.host.backgroundColor);
            if (this.disposed || operationSignal.aborted || sequence !== this.previewSequence) {
                disposeFabricImage(candidate);
                throw operationAbortReason(operationSignal, 'Filter preview became stale.');
            }
            try {
                this.installPreview(candidate, baseImage, definitions);
            }
            catch (error) {
                disposeFabricImage(candidate);
                throw error;
            }
        });
    }
    cancelPreview() {
        this.assertActive('cancel Filter preview');
        this.previewSequence += 1;
        return this.operations.run('filters:cancel-preview', async (signal) => {
            if (signal.aborted)
                throw operationAbortReason(signal, 'Filter preview cancellation aborted.');
            this.cancelPreviewSession(true);
        });
    }
    async commit(filters) {
        this.assertActive('commit Filters');
        const usesPreview = filters === undefined;
        if (usesPreview && this.previewDefinitions === null) {
            throw new FiltersPreviewMissingError();
        }
        const definitions = usesPreview
            ? this.previewDefinitions
            : this.normalizeDefinitions(filters);
        if (areFilterDefinitionsEqual(definitions, this.committedState.filters)) {
            await this.cancelPreview();
            return;
        }
        if (!usesPreview) {
            this.previewSequence += 1;
            this.cancelPreviewSession(true);
        }
        const previousState = this.committedState;
        let promotePreviewAfterCommit = false;
        const transactionId = `filters:commit:${++this.mutationSequence}`;
        await this.mutations.run({
            id: transactionId,
            kind: 'plugin-state',
            operationId: 'filters:commit',
            conflictDomains: mutationConflictDomains,
            metadata: Object.freeze({ filterCount: definitions.length }),
            mutate: () => {
                this.committedState = createState(this.normalizeDefinitions(definitions));
                return this.committedState;
            },
            synchronize: async (result, context) => {
                if (usesPreview &&
                    this.previewDefinitions !== null &&
                    areFilterDefinitionsEqual(this.previewDefinitions, definitions)) {
                    promotePreviewAfterCommit = true;
                    return;
                }
                await this.replaceCommittedVisual(definitions, context.signal);
            },
            validate: () => this.validateBaseImageInvariant(transactionId),
            describeCommit: () => Object.freeze({ filterCount: definitions.length }),
            rollback: usesPreview
                ? () => {
                    this.committedState = previousState;
                    promotePreviewAfterCommit = false;
                }
                : undefined,
        });
        if (promotePreviewAfterCommit)
            this.promotePreview();
        this.emitStatus();
    }
    async clear() {
        this.assertActive('clear Filters');
        if (this.committedState.filters.length === 0) {
            await this.cancelPreview();
            return;
        }
        this.previewSequence += 1;
        this.cancelPreviewSession(true);
        const transactionId = `filters:clear:${++this.mutationSequence}`;
        await this.mutations.run({
            id: transactionId,
            kind: 'plugin-state',
            operationId: 'filters:clear',
            conflictDomains: mutationConflictDomains,
            mutate: () => {
                this.committedState = emptyState;
            },
            synchronize: () => this.replaceCommittedVisual(emptyDefinitions),
            validate: () => this.validateBaseImageInvariant(transactionId),
            describeCommit: () => Object.freeze({ filterCount: 0 }),
        });
        this.emitStatus();
    }
    async bake(options) {
        await this.bakeIntoBase(null, options);
    }
    async bakeIntoBase(parent, options) {
        var _a, _b, _c, _d, _e, _f, _g;
        this.assertActive('bake Filters');
        normalizeFilterBakeOptions(options, (_b = (_a = this.host.getImageInfo()) === null || _a === void 0 ? void 0 : _a.mimeType) !== null && _b !== void 0 ? _b : null);
        const definitions = this.committedState.filters;
        if (definitions.length === 0) {
            if (parent) {
                this.previewSequence += 1;
                this.cancelPreviewSession(true);
            }
            else {
                await this.cancelPreview();
            }
            return Object.freeze({
                didBake: false,
                mimeType: (_d = (_c = this.host.getImageInfo()) === null || _c === void 0 ? void 0 : _c.mimeType) !== null && _d !== void 0 ? _d : null,
            });
        }
        this.previewSequence += 1;
        this.cancelPreviewSession(true);
        const baseImage = this.host.getBaseImage();
        if (!baseImage)
            throw new Error('[ImageEditor] Cannot bake Filters without a Base Image.');
        const baseScale = this.host.getBaseImageScale();
        let replacement = null;
        let committed = false;
        const transactionId = `filters:bake:${++this.mutationSequence}`;
        let mimeType = (_f = (_e = this.host.getImageInfo()) === null || _e === void 0 ? void 0 : _e.mimeType) !== null && _f !== void 0 ? _f : null;
        try {
            await this.mutations.run({
                id: transactionId,
                kind: 'compound',
                operationId: (_g = parent === null || parent === void 0 ? void 0 : parent.operationId) !== null && _g !== void 0 ? _g : 'filters:bake',
                conflictDomains: mutationConflictDomains,
                parent: parent !== null && parent !== void 0 ? parent : undefined,
                metadata: Object.freeze({ filterCount: definitions.length }),
                mutate: async (context) => {
                    const baked = await renderBakedImage(this.host.fabric, baseImage, definitions, options, this.host.getImageInfo(), this.host.getImageResourcePolicy(), context.signal);
                    replacement = baked.image;
                    mimeType = baked.mimeType;
                    this.raster.replaceBaseImage(context, baked.image, {
                        baseScale,
                        mimeType: baked.mimeType,
                    });
                    this.committedState = emptyState;
                    return baked.image;
                },
                synchronize: () => this.replaceCommittedVisual(emptyDefinitions),
                validate: (image) => {
                    if (!parent && this.host.getBaseImage() !== image) {
                        throw new Error('Raster Commit did not retain the baked Base Image.');
                    }
                    if (this.committedState.filters.length !== 0) {
                        throw new Error('Raster Commit did not clear the baked Filter state.');
                    }
                    this.validateBaseImageInvariant(transactionId);
                },
                describeCommit: () => Object.freeze({ filterCount: definitions.length }),
            });
            committed = true;
            disposeFabricImage(baseImage);
            this.emitStatus();
            return Object.freeze({ didBake: true, mimeType });
        }
        finally {
            if (!committed && replacement && this.host.getBaseImage() !== replacement) {
                disposeFabricImage(replacement);
            }
        }
    }
    async configure(patch) {
        this.assertActive('configure Filters');
        await this.operations.run('filters:configure', async (signal) => {
            if (signal.aborted)
                throw operationAbortReason(signal, 'Filter configuration aborted.');
            const next = this.normalizeConfigurationPatch(patch);
            this.configuration = next;
            this.emitStatus();
        });
    }
    captureState() {
        return this.committedState;
    }
    validateState(value) {
        if (!isRecord(value))
            return { valid: false, message: 'Filters state must be an object.' };
        const keyFailure = validateStateKeys(value);
        if (keyFailure)
            return { valid: false, message: keyFailure };
        if (value.schema !== FILTERS_STATE_SCHEMA) {
            return {
                valid: false,
                message: `Filters state schema must be "${FILTERS_STATE_SCHEMA}".`,
            };
        }
        if (value.version !== FILTERS_STATE_VERSION) {
            return {
                valid: false,
                message: `Filters state version ${String(value.version)} is unsupported.`,
            };
        }
        try {
            return {
                valid: true,
                value: createState(this.normalizeDefinitions(value.filters)),
            };
        }
        catch (error) {
            return {
                valid: false,
                message: error instanceof Error ? error.message : 'Filters state is malformed.',
                path: error instanceof FilterDefinitionError ? error.path : undefined,
            };
        }
    }
    async restoreState(state, context) {
        this.previewSequence += 1;
        this.cancelPreviewSession(false);
        await this.replaceCommittedVisual(state.filters, context.signal);
        this.committedState = createState(state.filters);
        this.emitStatus();
    }
    clearState() {
        this.previewSequence += 1;
        this.cancelPreviewSession(false);
        this.committedState = emptyState;
        this.disposeCommittedVisual();
        this.host.requestRender();
        this.emitStatus();
    }
    ownsTransient(object) {
        return this.transientImages.has(object);
    }
    renderExport(canvas, options) {
        if (this.committedState.filters.length === 0)
            return;
        const baseImage = canvas
            .getObjects()
            .find((object) => object instanceof this.host.fabric.FabricImage);
        if (!baseImage)
            throw new Error('[ImageEditor] Filters export requires a Base Image.');
        applyFilterDefinitions(this.host.fabric, baseImage, this.committedState.filters);
    }
    async synchronizeAfterCommittedMutation() {
        if (this.disposed)
            return;
        const baseImage = this.host.getBaseImage();
        if (!baseImage) {
            this.clearForImage();
            return;
        }
        const committedVisualIsCurrent = this.committedState.filters.length === 0
            ? this.committedVisual === null
            : this.committedVisual !== null && this.committedSource === baseImage;
        const previewVisualIsCurrent = this.previewDefinitions === null || this.previewDefinitions.length === 0
            ? this.previewVisual === null
            : this.previewVisual !== null && this.previewSource === baseImage;
        if (committedVisualIsCurrent && previewVisualIsCurrent) {
            if (this.committedVisual) {
                copyBaseImagePresentation(baseImage, this.committedVisual, {
                    backgroundColor: this.host.backgroundColor,
                    transient: true,
                });
            }
            if (this.previewVisual) {
                copyBaseImagePresentation(baseImage, this.previewVisual, {
                    backgroundColor: this.host.backgroundColor,
                    transient: true,
                });
            }
            this.host.requestRender();
            return;
        }
        this.previewSequence += 1;
        this.cancelPreviewSession(true);
        await this.replaceCommittedVisual(this.committedState.filters);
    }
    clearForImage() {
        if (this.disposed)
            return;
        this.previewSequence += 1;
        this.previewDefinitions = null;
        this.disposePreviewVisual();
        this.disposeCommittedVisual();
        this.committedState = emptyState;
        this.host.requestRender();
        this.emitStatus();
    }
    dispose() {
        if (this.disposed)
            return;
        this.previewSequence += 1;
        this.previewDefinitions = null;
        this.disposePreviewVisual();
        this.disposeCommittedVisual();
        this.listeners.clear();
        this.disposed = true;
    }
    normalizeDefinitions(value) {
        return normalizeFilterDefinitions(value, {
            maxFilterCount: this.configuration.maxFilterCount,
        });
    }
    normalizeConfigurationPatch(patch) {
        var _a, _b, _c;
        if (!isRecord(patch)) {
            throw new TypeError('[ImageEditor] Filters configuration patch must be a plain object.');
        }
        for (const key of Object.keys(patch)) {
            if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
                throw new TypeError(`[ImageEditor] Filters configuration contains dangerous key "${key}".`);
            }
            if (key !== 'maxFilterCount') {
                throw new TypeError(`[ImageEditor] Filters configuration contains unknown key "${key}".`);
            }
        }
        const maxFilterCount = (_a = patch.maxFilterCount) !== null && _a !== void 0 ? _a : this.configuration.maxFilterCount;
        normalizeFilterDefinitions([], { maxFilterCount });
        const requiredCount = Math.max(this.committedState.filters.length, (_c = (_b = this.previewDefinitions) === null || _b === void 0 ? void 0 : _b.length) !== null && _c !== void 0 ? _c : 0);
        if (maxFilterCount < requiredCount) {
            throw new TypeError(`[ImageEditor] maxFilterCount cannot be lower than the active Filter count ${requiredCount}.`);
        }
        return Object.freeze({ maxFilterCount });
    }
    installPreview(candidate, source, definitions) {
        if (candidate)
            this.attachVisual(candidate, source);
        this.detachVisual(this.committedVisual);
        const previous = this.previewVisual;
        this.previewVisual = candidate;
        this.previewSource = candidate ? source : null;
        this.previewDefinitions = definitions;
        if (candidate)
            this.transientImages.add(candidate);
        this.disposeDetachedVisual(previous);
        this.host.requestRender();
        this.emitStatus();
    }
    cancelPreviewSession(emit) {
        if (this.previewDefinitions === null && this.previewVisual === null)
            return false;
        this.previewDefinitions = null;
        this.disposePreviewVisual();
        const baseImage = this.host.getBaseImage();
        if (this.committedVisual && baseImage)
            this.attachVisual(this.committedVisual, baseImage);
        this.host.requestRender();
        if (emit)
            this.emitStatus();
        return true;
    }
    promotePreview() {
        this.disposeCommittedVisual();
        this.committedVisual = this.previewVisual;
        this.committedSource = this.previewSource;
        this.previewVisual = null;
        this.previewSource = null;
        this.previewDefinitions = null;
        this.host.requestRender();
    }
    async replaceCommittedVisual(definitions, signal = new AbortController().signal) {
        const baseImage = this.host.getBaseImage();
        const candidate = definitions.length === 0 || !baseImage
            ? null
            : await createFilteredImageClone(this.host.fabric, baseImage, definitions, signal, this.host.backgroundColor);
        if (signal.aborted) {
            disposeFabricImage(candidate);
            throw operationAbortReason(signal, 'Filter synchronization aborted.');
        }
        try {
            if (candidate && baseImage)
                this.attachVisual(candidate, baseImage);
        }
        catch (error) {
            disposeFabricImage(candidate);
            throw error;
        }
        const previous = this.committedVisual;
        this.committedVisual = candidate;
        this.committedSource = candidate ? baseImage : null;
        if (candidate)
            this.transientImages.add(candidate);
        this.disposeDetachedVisual(previous);
        this.host.requestRender();
    }
    attachVisual(image, baseImage) {
        const canvas = this.host.requireCanvas('render Filters');
        copyBaseImagePresentation(baseImage, image, {
            backgroundColor: this.host.backgroundColor,
            transient: true,
        });
        if (!canvas.getObjects().includes(image))
            canvas.add(image);
        const baseIndex = canvas.getObjects().indexOf(baseImage);
        canvas.moveObjectTo(image, Math.max(0, baseIndex + 1));
    }
    detachVisual(image) {
        const canvas = this.host.getCanvas();
        if (image && (canvas === null || canvas === void 0 ? void 0 : canvas.getObjects().includes(image)))
            canvas.remove(image);
    }
    disposeDetachedVisual(image) {
        if (!image)
            return;
        this.detachVisual(image);
        this.transientImages.delete(image);
        disposeFabricImage(image);
    }
    disposePreviewVisual() {
        this.disposeDetachedVisual(this.previewVisual);
        this.previewVisual = null;
        this.previewSource = null;
    }
    disposeCommittedVisual() {
        this.disposeDetachedVisual(this.committedVisual);
        this.committedVisual = null;
        this.committedSource = null;
    }
    validateBaseImageInvariant(transactionId) {
        const canvas = this.host.requireCanvas('validate Filters');
        const baseImage = this.host.getBaseImage();
        const baseImages = canvas
            .getObjects()
            .filter((object) => object
            .editorObjectKind === 'baseImage');
        if (!baseImage || baseImages.length !== 1 || baseImages[0] !== baseImage) {
            throw new Error(`Filters transaction "${transactionId}" violated the Base Image invariant.`);
        }
    }
    status() {
        var _a, _b;
        return Object.freeze({
            isPreviewing: this.isPreviewing,
            committedFilterCount: this.committedState.filters.length,
            previewFilterCount: (_b = (_a = this.previewDefinitions) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0,
            configuration: this.configuration,
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
                this.host.reportWarning(error, 'A Filters status listener failed.');
            }
        }
    }
    assertImageLoaded(operation) {
        if (!this.host.isImageLoaded()) {
            throw new Error(`[ImageEditor] Cannot ${operation} without a loaded image.`);
        }
    }
    assertActive(operation) {
        if (this.disposed || this.host.isDisposed()) {
            throw new FiltersPluginDisposedError(operation);
        }
    }
}

const filtersPluginRef = pluginManifest.definePluginRef('plugin:filters', '1.0.0');
function filtersPlugin(options = {}) {
    let controller = null;
    return pluginDefinition.definePlugin({
        ref: filtersPluginRef,
        manifest: {
            id: filtersPluginRef.id,
            version: '1.0.0',
            apiVersion: filtersPluginRef.apiVersion,
            engine: '^3.0.0',
            requires: [
                { token: coreCapabilities.CORE_STATUS_CAPABILITY, range: '^1.0.0' },
                { token: coreCapabilities.CORE_DIAGNOSTICS_CAPABILITY, range: '^1.0.0' },
                { token: coreCapabilities.CORE_PRESENTATION_CAPABILITY, range: '^1.0.0' },
                { token: coreCapabilities.FABRIC_RUNTIME_CAPABILITY, range: '^1.0.0' },
                { token: coreCapabilities.CANVAS_READ_CAPABILITY, range: '^1.0.0' },
                { token: coreCapabilities.BASE_IMAGE_READ_CAPABILITY, range: '^1.0.0' },
                { token: coreCapabilities.IMAGE_RESOURCE_POLICY_CAPABILITY, range: '^1.0.0' },
                { token: coreCapabilities.RENDER_REQUEST_CAPABILITY, range: '^1.0.0' },
                { token: coreCapabilities.RASTER_MUTATION_CAPABILITY, range: '^1.0.0' },
                { token: coreCapabilities.SNAPSHOT_REGISTRATION_CAPABILITY, range: '^1.0.0' },
                { token: coreCapabilities.DOCUMENT_MUTATION_CAPABILITY, range: '^1.0.0' },
                { token: coreCapabilities.EXPORT_CONTRIBUTION_CAPABILITY, range: '^1.0.0' },
            ],
            permissions: [
                'fabric:objects',
                'fabric:canvas-read',
                'core:raster-mutation',
                'core:export-contributor',
            ],
        },
        setupMode: 'sync',
        setup(context) {
            const status = context.capabilities.require(coreCapabilities.CORE_STATUS_CAPABILITY);
            const diagnostics = context.capabilities.require(coreCapabilities.CORE_DIAGNOSTICS_CAPABILITY);
            const presentation = context.capabilities.require(coreCapabilities.CORE_PRESENTATION_CAPABILITY);
            const fabricRuntime = context.capabilities.require(coreCapabilities.FABRIC_RUNTIME_CAPABILITY);
            const canvas = context.capabilities.require(coreCapabilities.CANVAS_READ_CAPABILITY);
            const baseImage = context.capabilities.require(coreCapabilities.BASE_IMAGE_READ_CAPABILITY);
            const resourcePolicy = context.capabilities.require(coreCapabilities.IMAGE_RESOURCE_POLICY_CAPABILITY);
            const render = context.capabilities.require(coreCapabilities.RENDER_REQUEST_CAPABILITY);
            const raster = context.capabilities.require(coreCapabilities.RASTER_MUTATION_CAPABILITY);
            const snapshots = context.capabilities.require(coreCapabilities.SNAPSHOT_REGISTRATION_CAPABILITY);
            const mutations = context.capabilities.require(coreCapabilities.DOCUMENT_MUTATION_CAPABILITY);
            const exports = context.capabilities.require(coreCapabilities.EXPORT_CONTRIBUTION_CAPABILITY);
            for (const definition of [
                {
                    id: 'filters:preview',
                    mode: 'busy',
                    conflictDomains: ['base-image', 'export', 'state'],
                    reentrancy: 'replace',
                },
                {
                    id: 'filters:cancel-preview',
                    mode: 'busy',
                    conflictDomains: ['state'],
                    reentrancy: 'replace',
                },
                {
                    id: 'filters:commit',
                    mode: 'mutation',
                    conflictDomains: [
                        'document',
                        'base-image',
                        'geometry',
                        'raster',
                        'overlay',
                        'state',
                    ],
                    reentrancy: 'queue',
                },
                {
                    id: 'filters:clear',
                    mode: 'mutation',
                    conflictDomains: [
                        'document',
                        'base-image',
                        'geometry',
                        'raster',
                        'overlay',
                        'state',
                    ],
                    reentrancy: 'queue',
                },
                {
                    id: 'filters:bake',
                    mode: 'mutation',
                    conflictDomains: [
                        'document',
                        'base-image',
                        'geometry',
                        'raster',
                        'overlay',
                        'state',
                    ],
                    reentrancy: 'queue',
                },
                {
                    id: 'filters:configure',
                    mode: 'mutation',
                    conflictDomains: ['state'],
                    reentrancy: 'queue',
                },
            ]) {
                context.disposables.add(context.operations.register(definition));
            }
            controller = new FiltersController(Object.freeze({
                ...status,
                ...diagnostics,
                ...presentation,
                ...fabricRuntime,
                ...canvas,
                ...baseImage,
                ...resourcePolicy,
                ...render,
            }), Object.freeze({
                run: (operationId, task) => context.operations.run(operationId, undefined, (args, operationContext) => {
                    return task(operationContext.signal);
                }),
            }), mutations, raster, options);
            const requireController = () => {
                if (!controller)
                    throw new Error('Filters Plugin is not installed.');
                return controller;
            };
            const visibleRasterBake$1 = Object.freeze({
                hasVisibleState: () => requireController().hasVisibleState(),
                bakeIntoBase: (parent, bakeOptions) => requireController().bakeIntoBase(parent, bakeOptions),
            });
            context.capabilities.provide(visibleRasterBake.VISIBLE_RASTER_BAKE_CAPABILITY, visibleRasterBake$1, {
                version: visibleRasterBake.VISIBLE_RASTER_BAKE_CAPABILITY.version,
            });
            context.disposables.add(snapshots.registerTransientObject(filtersPluginRef.id, (object) => { var _a; return (_a = controller === null || controller === void 0 ? void 0 : controller.ownsTransient(object)) !== null && _a !== void 0 ? _a : false; }));
            context.disposables.add(snapshots.registerSlice({
                id: filtersPluginRef.id,
                version: 1,
                capturePolicy: 'always',
                capture: () => requireController().captureState(),
                validate: (value) => requireController().validateState(value),
                restore: (state, restoreContext) => requireController().restoreState(state, restoreContext),
                clearState: () => requireController().clearState(),
            }));
            context.disposables.add(exports.register(filtersPluginRef.id, {
                id: 'filters:committed',
                order: -100,
                isEnabled: () => requireController().getState().filters.length > 0,
                render: ({ canvas: targetCanvas, options: exportOptions }) => requireController().renderExport(targetCanvas, exportOptions),
            }));
            context.disposables.add(context.events.on('geometry:committed', () => controller === null || controller === void 0 ? void 0 : controller.synchronizeAfterCommittedMutation()));
            context.disposables.add(context.events.on('document:committed', (descriptor) => {
                if (descriptor.operationId.startsWith('filters:'))
                    return;
                return controller === null || controller === void 0 ? void 0 : controller.synchronizeAfterCommittedMutation();
            }));
            return Object.freeze({
                get isPreviewing() {
                    return requireController().isPreviewing;
                },
                getState: () => requireController().getState(),
                preview: (definitions) => requireController().preview(definitions),
                commit: (definitions) => requireController().commit(definitions),
                cancelPreview: () => requireController().cancelPreview(),
                clear: () => requireController().clear(),
                bake: (bakeOptions) => requireController().bake(bakeOptions),
                configure: (patch) => requireController().configure(patch),
                getConfiguration: () => requireController().getConfiguration(),
                subscribe: (listener) => requireController().subscribe(listener),
            });
        },
        onImageCleared() {
            controller === null || controller === void 0 ? void 0 : controller.clearForImage();
        },
        onDispose() {
            controller === null || controller === void 0 ? void 0 : controller.dispose();
            controller = null;
        },
    });
}

exports.FilterBakeValidationError = FilterBakeValidationError;
exports.FilterDefinitionError = FilterDefinitionError;
exports.FilterImplementationError = FilterImplementationError;
exports.FiltersPluginDisposedError = FiltersPluginDisposedError;
exports.FiltersPreviewMissingError = FiltersPreviewMissingError;
exports.MAX_SUPPORTED_FILTER_COUNT = MAX_SUPPORTED_FILTER_COUNT;
exports.SUPPORTED_FILTER_TYPES = SUPPORTED_FILTER_TYPES;
exports.areFilterDefinitionsEqual = areFilterDefinitionsEqual;
exports.filtersPlugin = filtersPlugin;
exports.filtersPluginRef = filtersPluginRef;
exports.normalizeFilterDefinitions = normalizeFilterDefinitions;
//# sourceMappingURL=index.cjs.map
