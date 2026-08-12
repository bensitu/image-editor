/**
 * Coordinates transactional Filter preview, commit, clear, bake, configuration, and state.
 *
 * @module
 */
import type * as FabricNS from 'fabric';
import type { CoreExportOptions, DocumentMutationContext, DocumentMutationPort, FabricModule, StateRestoreContext, StateValidationResult } from '../../core/index.js';
import { type BaseImageReadPort, type CanvasReadPort, type CoreDiagnosticsPort, type CorePresentationPort, type CoreStatusPort, type Disposable, type ImageResourcePolicyPort, type RasterMutationPort, type RenderRequestPort, type VisibleRasterBakeOptions, type VisibleRasterBakeResult } from '../../sdk/index.js';
import { type FilterDefinition } from './filter-definitions.js';
import { type FilterBakeOptions } from './filtered-image-renderer.js';
declare const FILTERS_STATE_SCHEMA = "image-editor.filters";
declare const FILTERS_STATE_VERSION = 1;
/** Runtime limits for Filter definition processing. */
export interface FiltersConfiguration {
    readonly maxFilterCount: number;
}
/** Construction options for the Filters Plugin. */
export interface FiltersPluginOptions {
    readonly maxFilterCount?: number;
}
/** Serializable committed Filter state. */
export interface FiltersState {
    readonly schema: typeof FILTERS_STATE_SCHEMA;
    readonly version: typeof FILTERS_STATE_VERSION;
    readonly filters: readonly FilterDefinition[];
}
/** Observable Filter preview, commit, and configuration status. */
export interface FiltersStatus {
    readonly isPreviewing: boolean;
    readonly committedFilterCount: number;
    readonly previewFilterCount: number;
    readonly configuration: Readonly<FiltersConfiguration>;
}
/** Listener invoked when Filter status changes. */
export type FiltersStatusListener = (status: FiltersStatus) => void;
/** Public Filter preview, commit, bake, and configuration operations. */
export interface FiltersPluginApi {
    /** Reports whether transient Filter preview is active. */
    readonly isPreviewing: boolean;
    /** Returns immutable committed Filter state. */
    getState(): FiltersState;
    /** Renders transient Filter definitions without changing document state. */
    preview(filters: readonly FilterDefinition[]): Promise<void>;
    /** Commits supplied definitions, or the active preview, as one mutation. */
    commit(filters?: readonly FilterDefinition[]): Promise<void>;
    /** Discards the active transient preview. */
    cancelPreview(): Promise<void>;
    /** Removes all committed Filter definitions. */
    clear(): Promise<void>;
    /** Bakes committed Filter output into the Base Image and clears Filter state. */
    bake(options?: FilterBakeOptions): Promise<void>;
    /** Updates validated Filter resource limits. */
    configure(patch: Partial<FiltersConfiguration>): Promise<void>;
    /** Returns immutable normalized Filter configuration. */
    getConfiguration(): Readonly<FiltersConfiguration>;
    /** Subscribes to Filter status changes. */
    subscribe(listener: FiltersStatusListener): Disposable;
}
export interface FiltersHost extends CoreStatusPort, CoreDiagnosticsPort, CorePresentationPort, CanvasReadPort, BaseImageReadPort, ImageResourcePolicyPort, RenderRequestPort {
    readonly fabric: FabricModule;
}
export interface FiltersOperationPort {
    run<TResult>(operationId: string, task: (signal: AbortSignal) => Promise<TResult>): Promise<TResult>;
}
export declare class FiltersController {
    private readonly host;
    private readonly operations;
    private readonly mutations;
    private readonly raster;
    private configuration;
    private committedState;
    private previewDefinitions;
    private committedVisual;
    private committedSource;
    private previewVisual;
    private previewSource;
    private readonly transientImages;
    private readonly listeners;
    private previewSequence;
    private mutationSequence;
    private disposed;
    constructor(host: FiltersHost, operations: FiltersOperationPort, mutations: DocumentMutationPort, raster: RasterMutationPort, options: FiltersPluginOptions);
    get isPreviewing(): boolean;
    getState(): FiltersState;
    hasVisibleState(): boolean;
    getConfiguration(): Readonly<FiltersConfiguration>;
    subscribe(listener: FiltersStatusListener): Disposable;
    preview(filters: readonly FilterDefinition[]): Promise<void>;
    cancelPreview(): Promise<void>;
    commit(filters?: readonly FilterDefinition[]): Promise<void>;
    clear(): Promise<void>;
    bake(options?: FilterBakeOptions): Promise<void>;
    bakeIntoBase(parent: DocumentMutationContext | null, options?: VisibleRasterBakeOptions): Promise<VisibleRasterBakeResult>;
    configure(patch: Partial<FiltersConfiguration>): Promise<void>;
    captureState(): FiltersState;
    validateState(value: unknown): StateValidationResult<FiltersState>;
    restoreState(state: FiltersState, context: StateRestoreContext): Promise<void>;
    clearState(): void;
    ownsTransient(object: FabricNS.FabricObject): boolean;
    renderExport(canvas: FabricNS.StaticCanvas, options: Readonly<CoreExportOptions>): void;
    synchronizeAfterCommittedMutation(): Promise<void>;
    clearForImage(): void;
    dispose(): void;
    private normalizeDefinitions;
    private normalizeConfigurationPatch;
    private installPreview;
    private cancelPreviewSession;
    private promotePreview;
    private replaceCommittedVisual;
    private attachVisual;
    private detachVisual;
    private disposeDetachedVisual;
    private disposePreviewVisual;
    private disposeCommittedVisual;
    private validateBaseImageInvariant;
    private status;
    private emitStatus;
    private assertImageLoaded;
    private assertActive;
}
export {};
