import { createDisposable, } from '../../sdk/index.js';
import { isUnsafeObjectKey } from '../../utils/safe-object-key.js';
import { MAX_SUPPORTED_FILTER_COUNT, areFilterDefinitionsEqual, normalizeFilterDefinitions, } from './filter-definitions.js';
import { applyFilterDefinitions } from './fabric-filter-factory.js';
import { copyBaseImagePresentation, createFilteredImageClone, disposeFabricImage, normalizeFilterBakeOptions, renderBakedImage, } from './filtered-image-renderer.js';
import { FilterDefinitionError, FiltersPluginDisposedError, FiltersPreviewMissingError, } from './filters-errors.js';
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
    const definitions = normalizeFilterDefinitions([], {
        maxFilterCount: (_a = options.maxFilterCount) !== null && _a !== void 0 ? _a : MAX_SUPPORTED_FILTER_COUNT,
    });
    void definitions;
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
        if (isUnsafeObjectKey(key)) {
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
export class FiltersController {
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
        return createDisposable(() => {
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
                void result;
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
        void options;
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
            if (isUnsafeObjectKey(key)) {
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
//# sourceMappingURL=filters-controller.js.map