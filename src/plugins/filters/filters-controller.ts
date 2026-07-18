import type * as FabricNS from 'fabric';

import type {
    CoreExportOptions,
    DocumentMutationContext,
    DocumentMutationPort,
    FabricModule,
    StateRestoreContext,
    StateValidationResult,
} from '../../core/index.js';
import {
    createDisposable,
    type BaseImageReadPort,
    type CanvasReadPort,
    type CoreDiagnosticsPort,
    type CorePresentationPort,
    type CoreStatusPort,
    type Disposable,
    type ImageResourcePolicyPort,
    type RasterMutationPort,
    type RenderRequestPort,
    type VisibleRasterBakeOptions,
    type VisibleRasterBakeResult,
} from '../../sdk/index.js';
import {
    MAX_SUPPORTED_FILTER_COUNT,
    areFilterDefinitionsEqual,
    normalizeFilterDefinitions,
    type FilterDefinition,
} from './filter-definitions.js';
import { applyFilterDefinitions } from './fabric-filter-factory.js';
import {
    copyBaseImagePresentation,
    createFilteredImageClone,
    disposeFabricImage,
    normalizeFilterBakeOptions,
    renderBakedImage,
    type FilterBakeOptions,
} from './filtered-image-renderer.js';
import {
    FilterDefinitionError,
    FiltersPluginDisposedError,
    FiltersPreviewMissingError,
} from './filters-errors.js';

const FILTERS_STATE_SCHEMA = 'image-editor.filters';
const FILTERS_STATE_VERSION = 1;
const mutationConflictDomains = [
    'document',
    'base-image',
    'geometry',
    'raster',
    'overlay',
    'state',
] as const;

export interface FiltersConfiguration {
    readonly maxFilterCount: number;
}

export interface FiltersPluginOptions {
    readonly maxFilterCount?: number;
}

export interface FiltersState {
    readonly schema: typeof FILTERS_STATE_SCHEMA;
    readonly version: typeof FILTERS_STATE_VERSION;
    readonly filters: readonly FilterDefinition[];
}

export interface FiltersStatus {
    readonly isPreviewing: boolean;
    readonly committedFilterCount: number;
    readonly previewFilterCount: number;
    readonly configuration: Readonly<FiltersConfiguration>;
}

export type FiltersStatusListener = (status: FiltersStatus) => void;

export interface FiltersPluginApi {
    readonly isPreviewing: boolean;
    getState(): FiltersState;
    preview(filters: readonly FilterDefinition[]): Promise<void>;
    commit(filters?: readonly FilterDefinition[]): Promise<void>;
    cancelPreview(): Promise<void>;
    clear(): Promise<void>;
    bake(options?: FilterBakeOptions): Promise<void>;
    configure(patch: Partial<FiltersConfiguration>): Promise<void>;
    getConfiguration(): Readonly<FiltersConfiguration>;
    subscribe(listener: FiltersStatusListener): Disposable;
}

export interface FiltersHost
    extends
        CoreStatusPort,
        CoreDiagnosticsPort,
        CorePresentationPort,
        CanvasReadPort,
        BaseImageReadPort,
        ImageResourcePolicyPort,
        RenderRequestPort {
    readonly fabric: FabricModule;
}

export interface FiltersOperationPort {
    run<TResult>(
        operationId: string,
        task: (signal: AbortSignal) => Promise<TResult>,
    ): Promise<TResult>;
}

function createState(definitions: readonly FilterDefinition[]): FiltersState {
    return Object.freeze({
        schema: FILTERS_STATE_SCHEMA,
        version: FILTERS_STATE_VERSION,
        filters: definitions,
    });
}

const emptyDefinitions = Object.freeze([]) as readonly FilterDefinition[];
const emptyState = createState(emptyDefinitions);

function normalizeConfiguration(options: FiltersPluginOptions): Readonly<FiltersConfiguration> {
    const definitions = normalizeFilterDefinitions([], {
        maxFilterCount: options.maxFilterCount ?? MAX_SUPPORTED_FILTER_COUNT,
    });
    void definitions;
    return Object.freeze({
        maxFilterCount: options.maxFilterCount ?? MAX_SUPPORTED_FILTER_COUNT,
    });
}

function isRecord(value: unknown): value is Record<string, unknown> {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}

function validateStateKeys(value: Record<string, unknown>): string | null {
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

function abortError(message: string): DOMException {
    return new DOMException(message, 'AbortError');
}

function operationAbortReason(signal: AbortSignal, fallback: string): unknown {
    return signal.reason ?? abortError(fallback);
}

export class FiltersController {
    private configuration: Readonly<FiltersConfiguration>;
    private committedState: FiltersState = emptyState;
    private previewDefinitions: readonly FilterDefinition[] | null = null;
    private committedVisual: FabricNS.FabricImage | null = null;
    private committedSource: FabricNS.FabricImage | null = null;
    private previewVisual: FabricNS.FabricImage | null = null;
    private previewSource: FabricNS.FabricImage | null = null;
    private readonly transientImages = new Set<FabricNS.FabricImage>();
    private readonly listeners = new Set<FiltersStatusListener>();
    private previewSequence = 0;
    private mutationSequence = 0;
    private disposed = false;

    constructor(
        private readonly host: FiltersHost,
        private readonly operations: FiltersOperationPort,
        private readonly mutations: DocumentMutationPort,
        private readonly raster: RasterMutationPort,
        options: FiltersPluginOptions,
    ) {
        this.configuration = normalizeConfiguration(options);
    }

    get isPreviewing(): boolean {
        return this.previewDefinitions !== null;
    }

    getState(): FiltersState {
        this.assertActive('read Filter state');
        return this.committedState;
    }

    hasVisibleState(): boolean {
        this.assertActive('inspect visible Filter state');
        return this.committedState.filters.length > 0;
    }

    getConfiguration(): Readonly<FiltersConfiguration> {
        this.assertActive('read Filter configuration');
        return this.configuration;
    }

    subscribe(listener: FiltersStatusListener): Disposable {
        this.assertActive('subscribe to Filter status');
        if (typeof listener !== 'function') {
            throw new TypeError('[ImageEditor] Filters status listener must be a function.');
        }
        this.listeners.add(listener);
        return createDisposable(() => {
            this.listeners.delete(listener);
        });
    }

    async preview(filters: readonly FilterDefinition[]): Promise<void> {
        this.assertActive('preview Filters');
        const requestedDefinitions = this.normalizeDefinitions(filters);
        const sequence = ++this.previewSequence;
        await this.operations.run('filters:preview', async (operationSignal) => {
            const definitions = this.normalizeDefinitions(requestedDefinitions);
            this.assertImageLoaded('preview Filters');
            const baseImage = this.host.getBaseImage();
            if (!baseImage)
                throw new Error('[ImageEditor] Cannot preview Filters without a Base Image.');
            const candidate =
                definitions.length === 0
                    ? null
                    : await createFilteredImageClone(
                          this.host.fabric,
                          baseImage,
                          definitions,
                          operationSignal,
                          this.host.backgroundColor,
                      );
            if (this.disposed || operationSignal.aborted || sequence !== this.previewSequence) {
                disposeFabricImage(candidate);
                throw operationAbortReason(operationSignal, 'Filter preview became stale.');
            }
            try {
                this.installPreview(candidate, baseImage, definitions);
            } catch (error) {
                disposeFabricImage(candidate);
                throw error;
            }
        });
    }

    cancelPreview(): Promise<void> {
        this.assertActive('cancel Filter preview');
        this.previewSequence += 1;
        return this.operations.run('filters:cancel-preview', async (signal) => {
            if (signal.aborted)
                throw operationAbortReason(signal, 'Filter preview cancellation aborted.');
            this.cancelPreviewSession(true);
        });
    }

    async commit(filters?: readonly FilterDefinition[]): Promise<void> {
        this.assertActive('commit Filters');
        const usesPreview = filters === undefined;
        if (usesPreview && this.previewDefinitions === null) {
            throw new FiltersPreviewMissingError();
        }
        const definitions = usesPreview
            ? this.previewDefinitions!
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
                if (
                    usesPreview &&
                    this.previewDefinitions !== null &&
                    areFilterDefinitionsEqual(this.previewDefinitions, definitions)
                ) {
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
        if (promotePreviewAfterCommit) this.promotePreview();
        this.emitStatus();
    }

    async clear(): Promise<void> {
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

    async bake(options?: FilterBakeOptions): Promise<void> {
        await this.bakeIntoBase(null, options);
    }

    async bakeIntoBase(
        parent: DocumentMutationContext | null,
        options?: VisibleRasterBakeOptions,
    ): Promise<VisibleRasterBakeResult> {
        this.assertActive('bake Filters');
        normalizeFilterBakeOptions(options, this.host.getImageInfo()?.mimeType ?? null);
        const definitions = this.committedState.filters;
        if (definitions.length === 0) {
            if (parent) {
                this.previewSequence += 1;
                this.cancelPreviewSession(true);
            } else {
                await this.cancelPreview();
            }
            return Object.freeze({
                didBake: false,
                mimeType: this.host.getImageInfo()?.mimeType ?? null,
            });
        }
        this.previewSequence += 1;
        this.cancelPreviewSession(true);
        const baseImage = this.host.getBaseImage();
        if (!baseImage) throw new Error('[ImageEditor] Cannot bake Filters without a Base Image.');
        const baseScale = this.host.getBaseImageScale();
        let replacement: FabricNS.FabricImage | null = null;
        let committed = false;
        const transactionId = `filters:bake:${++this.mutationSequence}`;
        let mimeType = this.host.getImageInfo()?.mimeType ?? null;
        try {
            await this.mutations.run({
                id: transactionId,
                kind: 'compound',
                operationId: parent?.operationId ?? 'filters:bake',
                conflictDomains: mutationConflictDomains,
                parent: parent ?? undefined,
                metadata: Object.freeze({ filterCount: definitions.length }),
                mutate: async (context) => {
                    const baked = await renderBakedImage(
                        this.host.fabric,
                        baseImage,
                        definitions,
                        options,
                        this.host.getImageInfo(),
                        this.host.getImageResourcePolicy(),
                        context.signal,
                    );
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
        } finally {
            if (!committed && replacement && this.host.getBaseImage() !== replacement) {
                disposeFabricImage(replacement);
            }
        }
    }

    async configure(patch: Partial<FiltersConfiguration>): Promise<void> {
        this.assertActive('configure Filters');
        await this.operations.run('filters:configure', async (signal) => {
            if (signal.aborted) throw operationAbortReason(signal, 'Filter configuration aborted.');
            const next = this.normalizeConfigurationPatch(patch);
            this.configuration = next;
            this.emitStatus();
        });
    }

    captureState(): FiltersState {
        return this.committedState;
    }

    validateState(value: unknown): StateValidationResult<FiltersState> {
        if (!isRecord(value)) return { valid: false, message: 'Filters state must be an object.' };
        const keyFailure = validateStateKeys(value);
        if (keyFailure) return { valid: false, message: keyFailure };
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
        } catch (error) {
            return {
                valid: false,
                message: error instanceof Error ? error.message : 'Filters state is malformed.',
                path: error instanceof FilterDefinitionError ? error.path : undefined,
            };
        }
    }

    async restoreState(state: FiltersState, context: StateRestoreContext): Promise<void> {
        this.previewSequence += 1;
        this.cancelPreviewSession(false);
        await this.replaceCommittedVisual(state.filters, context.signal);
        this.committedState = createState(state.filters);
        this.emitStatus();
    }

    clearState(): void {
        this.previewSequence += 1;
        this.cancelPreviewSession(false);
        this.committedState = emptyState;
        this.disposeCommittedVisual();
        this.host.requestRender();
        this.emitStatus();
    }

    ownsTransient(object: FabricNS.FabricObject): boolean {
        return this.transientImages.has(object as FabricNS.FabricImage);
    }

    renderExport(canvas: FabricNS.StaticCanvas, options: Readonly<CoreExportOptions>): void {
        void options;
        if (this.committedState.filters.length === 0) return;
        const baseImage = canvas
            .getObjects()
            .find(
                (object): object is FabricNS.FabricImage =>
                    object instanceof this.host.fabric.FabricImage,
            );
        if (!baseImage) throw new Error('[ImageEditor] Filters export requires a Base Image.');
        applyFilterDefinitions(this.host.fabric, baseImage, this.committedState.filters);
    }

    async synchronizeAfterCommittedMutation(): Promise<void> {
        if (this.disposed) return;
        const baseImage = this.host.getBaseImage();
        if (!baseImage) {
            this.clearForImage();
            return;
        }
        const committedVisualIsCurrent =
            this.committedState.filters.length === 0
                ? this.committedVisual === null
                : this.committedVisual !== null && this.committedSource === baseImage;
        const previewVisualIsCurrent =
            this.previewDefinitions === null || this.previewDefinitions.length === 0
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

    clearForImage(): void {
        if (this.disposed) return;
        this.previewSequence += 1;
        this.previewDefinitions = null;
        this.disposePreviewVisual();
        this.disposeCommittedVisual();
        this.committedState = emptyState;
        this.host.requestRender();
        this.emitStatus();
    }

    dispose(): void {
        if (this.disposed) return;
        this.previewSequence += 1;
        this.previewDefinitions = null;
        this.disposePreviewVisual();
        this.disposeCommittedVisual();
        this.listeners.clear();
        this.disposed = true;
    }

    private normalizeDefinitions(value: unknown): readonly FilterDefinition[] {
        return normalizeFilterDefinitions(value, {
            maxFilterCount: this.configuration.maxFilterCount,
        });
    }

    private normalizeConfigurationPatch(
        patch: Partial<FiltersConfiguration>,
    ): Readonly<FiltersConfiguration> {
        if (!isRecord(patch)) {
            throw new TypeError(
                '[ImageEditor] Filters configuration patch must be a plain object.',
            );
        }
        for (const key of Object.keys(patch)) {
            if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
                throw new TypeError(
                    `[ImageEditor] Filters configuration contains dangerous key "${key}".`,
                );
            }
            if (key !== 'maxFilterCount') {
                throw new TypeError(
                    `[ImageEditor] Filters configuration contains unknown key "${key}".`,
                );
            }
        }
        const maxFilterCount = patch.maxFilterCount ?? this.configuration.maxFilterCount;
        normalizeFilterDefinitions([], { maxFilterCount });
        const requiredCount = Math.max(
            this.committedState.filters.length,
            this.previewDefinitions?.length ?? 0,
        );
        if (maxFilterCount < requiredCount) {
            throw new TypeError(
                `[ImageEditor] maxFilterCount cannot be lower than the active Filter count ${requiredCount}.`,
            );
        }
        return Object.freeze({ maxFilterCount });
    }

    private installPreview(
        candidate: FabricNS.FabricImage | null,
        source: FabricNS.FabricImage,
        definitions: readonly FilterDefinition[],
    ): void {
        if (candidate) this.attachVisual(candidate, source);
        this.detachVisual(this.committedVisual);
        const previous = this.previewVisual;
        this.previewVisual = candidate;
        this.previewSource = candidate ? source : null;
        this.previewDefinitions = definitions;
        if (candidate) this.transientImages.add(candidate);
        this.disposeDetachedVisual(previous);
        this.host.requestRender();
        this.emitStatus();
    }

    private cancelPreviewSession(emit: boolean): boolean {
        if (this.previewDefinitions === null && this.previewVisual === null) return false;
        this.previewDefinitions = null;
        this.disposePreviewVisual();
        const baseImage = this.host.getBaseImage();
        if (this.committedVisual && baseImage) this.attachVisual(this.committedVisual, baseImage);
        this.host.requestRender();
        if (emit) this.emitStatus();
        return true;
    }

    private promotePreview(): void {
        this.disposeCommittedVisual();
        this.committedVisual = this.previewVisual;
        this.committedSource = this.previewSource;
        this.previewVisual = null;
        this.previewSource = null;
        this.previewDefinitions = null;
        this.host.requestRender();
    }

    private async replaceCommittedVisual(
        definitions: readonly FilterDefinition[],
        signal: AbortSignal = new AbortController().signal,
    ): Promise<void> {
        const baseImage = this.host.getBaseImage();
        const candidate =
            definitions.length === 0 || !baseImage
                ? null
                : await createFilteredImageClone(
                      this.host.fabric,
                      baseImage,
                      definitions,
                      signal,
                      this.host.backgroundColor,
                  );
        if (signal.aborted) {
            disposeFabricImage(candidate);
            throw operationAbortReason(signal, 'Filter synchronization aborted.');
        }
        try {
            if (candidate && baseImage) this.attachVisual(candidate, baseImage);
        } catch (error) {
            disposeFabricImage(candidate);
            throw error;
        }
        const previous = this.committedVisual;
        this.committedVisual = candidate;
        this.committedSource = candidate ? baseImage : null;
        if (candidate) this.transientImages.add(candidate);
        this.disposeDetachedVisual(previous);
        this.host.requestRender();
    }

    private attachVisual(image: FabricNS.FabricImage, baseImage: FabricNS.FabricImage): void {
        const canvas = this.host.requireCanvas('render Filters');
        copyBaseImagePresentation(baseImage, image, {
            backgroundColor: this.host.backgroundColor,
            transient: true,
        });
        if (!canvas.getObjects().includes(image)) canvas.add(image);
        const baseIndex = canvas.getObjects().indexOf(baseImage);
        canvas.moveObjectTo(image, Math.max(0, baseIndex + 1));
    }

    private detachVisual(image: FabricNS.FabricImage | null): void {
        const canvas = this.host.getCanvas();
        if (image && canvas?.getObjects().includes(image)) canvas.remove(image);
    }

    private disposeDetachedVisual(image: FabricNS.FabricImage | null): void {
        if (!image) return;
        this.detachVisual(image);
        this.transientImages.delete(image);
        disposeFabricImage(image);
    }

    private disposePreviewVisual(): void {
        this.disposeDetachedVisual(this.previewVisual);
        this.previewVisual = null;
        this.previewSource = null;
    }

    private disposeCommittedVisual(): void {
        this.disposeDetachedVisual(this.committedVisual);
        this.committedVisual = null;
        this.committedSource = null;
    }

    private validateBaseImageInvariant(transactionId: string): void {
        const canvas = this.host.requireCanvas('validate Filters');
        const baseImage = this.host.getBaseImage();
        const baseImages = canvas
            .getObjects()
            .filter(
                (object) =>
                    (object as FabricNS.FabricObject & { editorObjectKind?: unknown })
                        .editorObjectKind === 'baseImage',
            );
        if (!baseImage || baseImages.length !== 1 || baseImages[0] !== baseImage) {
            throw new Error(
                `Filters transaction "${transactionId}" violated the Base Image invariant.`,
            );
        }
    }

    private status(): FiltersStatus {
        return Object.freeze({
            isPreviewing: this.isPreviewing,
            committedFilterCount: this.committedState.filters.length,
            previewFilterCount: this.previewDefinitions?.length ?? 0,
            configuration: this.configuration,
        });
    }

    private emitStatus(): void {
        if (this.disposed || this.listeners.size === 0) return;
        const status = this.status();
        for (const listener of [...this.listeners]) {
            try {
                listener(status);
            } catch (error) {
                this.host.reportWarning(error, 'A Filters status listener failed.');
            }
        }
    }

    private assertImageLoaded(operation: string): void {
        if (!this.host.isImageLoaded()) {
            throw new Error(`[ImageEditor] Cannot ${operation} without a loaded image.`);
        }
    }

    private assertActive(operation: string): void {
        if (this.disposed || this.host.isDisposed()) {
            throw new FiltersPluginDisposedError(operation);
        }
    }
}
