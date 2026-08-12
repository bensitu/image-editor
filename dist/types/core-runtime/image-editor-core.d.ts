/**
 * Owns the editor lifecycle, Canvas, Plugin host, image loading, document mutations, and export.
 *
 * @module
 */
import type * as FabricNS from 'fabric';
import { type PluginRef, type SynchronousEditorPlugin } from '../plugin-kernel/index.js';
import { type PluginArrayApis, type PluginPlan } from '../plugin-kernel/plugin-plan.js';
import { type CoreDiagnostic } from './errors.js';
import type { CoreElementMap, CoreEventListener, CoreEventMap, CoreExportOptions, CoreImageInfo, ContainerObservationOptions, CoreRuntimeStatus, CoreStatusListener, CoreStatusSubscriptionOptions, CoreSubscription, EditorLifecycleState, FabricModule, ImageEditorCoreOptions, LayoutMode, LoadImageOptions, ResolvedImageEditorCoreOptions, ResponsiveLayoutOptions } from './public-types.js';
import { type MissingPluginPolicy, type SnapshotMigration } from './state/index.js';
/** Controls validation, migration, and cancellation for one state restoration. */
export interface LoadStateOptions {
    /** Handling policy for state slices whose owning Plugin is unavailable. */
    readonly missingPluginPolicy?: MissingPluginPolicy;
    /** Ordered migrations available to the Snapshot service. */
    readonly migrations?: readonly SnapshotMigration[];
    /** Cancels preparation or transactional restoration. */
    readonly signal?: AbortSignal;
}
/**
 * Owns the editor Canvas, Base Image, Plugin runtime, state, exports, and lifecycle.
 *
 * @remarks
 * Install synchronous Plugins before calling {@link ImageEditorCore.init}. Initialization and
 * every mutating operation are instance-scoped; callers should await
 * {@link ImageEditorCore.disposeAsync} before releasing the host DOM.
 */
export declare class ImageEditorCore {
    readonly fabric: FabricModule;
    /** Immutable normalized construction options. */
    readonly options: ResolvedImageEditorCoreOptions;
    private readonly slices;
    private readonly objectProperties;
    private readonly transientObjects;
    private readonly externalObjects;
    private readonly history;
    private readonly exportContributors;
    private readonly mementos;
    private readonly snapshots;
    private readonly documentMutations;
    private readonly geometry;
    private plugins;
    private readonly installationPlan;
    private readonly pluginApiHandles;
    private readonly lifecycle;
    private readonly viewportCache;
    private canvas;
    private canvasElement;
    private containerElement;
    private placeholderElement;
    private baseImage;
    private imageMimeType;
    private imageLoaded;
    private baseImageScale;
    private layoutMode;
    private geometryRevision;
    private loadSequence;
    private latestLoadSequence;
    private stateLoadSequence;
    private initialImageLoadActive;
    private disposePromise;
    private emergencyResetPromise;
    private readonly diagnostics;
    private readonly statusListeners;
    private readonly responsiveSubscriptions;
    private lastRuntimeStatus;
    private relayoutSequence;
    /**
     * Creates a configured editor without accessing the DOM.
     *
     * @param fabric - Supported Fabric.js module namespace.
     * @param options - Core resource limits, layout policy, export defaults, and diagnostics.
     */
    constructor(fabric: FabricModule, options?: ImageEditorCoreOptions);
    /** Installs one synchronous Plugin before initialization and returns its stable API. */
    use<TApi>(plugin: SynchronousEditorPlugin<TApi, CoreEventMap>): TApi;
    /**
     * Installs a synchronous Plugin plan or array as one dependency-ordered batch.
     *
     * @remarks If installation fails, registrations created by the batch are rolled back.
     */
    install<TApis, TPlugin extends {
        readonly ref: PluginRef<unknown>;
    }>(plan: PluginPlan<TApis, TPlugin>): TApis;
    install<const TPlugins extends readonly SynchronousEditorPlugin<unknown, CoreEventMap>[]>(plugins: TPlugins): PluginArrayApis<TPlugins>;
    /** Returns a stable installed Plugin API, or `null` when the Plugin is unavailable. */
    getPlugin<TApi>(ref: PluginRef<TApi>): TApi | null;
    /**
     * Returns a stable installed Plugin API.
     *
     * @throws {@link PluginNotInstalledError} When the referenced Plugin is unavailable.
     */
    requirePlugin<TApi>(ref: PluginRef<TApi>): TApi;
    /** Returns an installed Plugin API by runtime identifier without compile-time API typing. */
    getPluginById(pluginId: string): unknown | null;
    /** Returns the current lifecycle state. */
    getLifecycleState(): EditorLifecycleState;
    /** Returns an immutable snapshot of host-observable runtime state. */
    getRuntimeStatus(): CoreRuntimeStatus;
    /**
     * Subscribes to lifecycle, image, operation, tool, layout, and geometry status changes.
     *
     * @returns An idempotent subscription handle.
     */
    subscribeStatus(listener: CoreStatusListener, options?: CoreStatusSubscriptionOptions): CoreSubscription;
    /**
     * Subscribes to a committed Core event.
     *
     * @remarks Listener failures are reported as warnings and do not roll back committed work.
     */
    on<TKey extends keyof CoreEventMap & string>(eventName: TKey, listener: CoreEventListener<CoreEventMap[TKey]>): CoreSubscription;
    /** Returns an immutable copy of diagnostics recorded by this editor instance. */
    getDiagnostics(): readonly CoreDiagnostic[];
    /**
     * Creates the Fabric Canvas and initializes installed Plugins.
     *
     * @remarks An `initialImageBase64` value is fully loaded before this promise resolves.
     * @throws When DOM resolution, Canvas creation, image loading, or Plugin initialization fails.
     */
    init(elements: CoreElementMap): Promise<void>;
    private createCanvas;
    /**
     * Replaces the document image from a supported Base64 Data URL.
     *
     * @remarks The replacement is transactional and supersedes any pending image load.
     */
    loadImage(source: string, options?: LoadImageOptions): Promise<void>;
    private performImageLoad;
    /** Reads a browser `File` and replaces the document image transactionally. */
    loadImageFile(file: File, options?: LoadImageOptions): Promise<void>;
    /** Serializes the current persistent document state. */
    saveState(): string;
    /**
     * Validates, migrates, and transactionally restores serialized document state.
     *
     * @remarks A failed or cancelled restoration leaves the preceding document intact.
     */
    loadFromState(input: string | unknown, options?: LoadStateOptions): Promise<void>;
    /** Renders the requested export area and returns an encoded Data URL. */
    exportImageBase64(options?: CoreExportOptions): Promise<string>;
    /** Renders the requested export area and returns a named browser `File`. */
    exportImageFile(options?: CoreExportOptions): Promise<File>;
    /** Reports whether a committed Base Image is available. */
    isImageLoaded(): boolean;
    /** Returns current Base Image geometry and source metadata, or `null` when absent. */
    getImageInfo(): CoreImageInfo | null;
    /**
     * Returns the owned Fabric Canvas after initialization.
     *
     * @remarks Host code must not dispose the returned Canvas.
     */
    getCanvas(): FabricNS.Canvas | null;
    /** Sets the strategy used by future image layout operations. */
    setLayoutMode(mode: LayoutMode): void;
    /** Resizes the Canvas viewport without changing document geometry. */
    resizeCanvas(width: number, height: number): void;
    /** Resizes the Canvas viewport to its measured container without scaling the document. */
    resizeToContainer(): void;
    /**
     * Observes the configured container and schedules responsive viewport resizing.
     *
     * @throws When no container or `ResizeObserver` implementation is available.
     */
    observeContainer(options?: ContainerObservationOptions): CoreSubscription;
    /** Recomputes Base Image geometry with the selected layout strategy as one mutation. */
    relayout(options?: ResponsiveLayoutOptions): Promise<void>;
    /**
     * Rebuilds runtime services after an unrecoverable transactional failure.
     *
     * @throws When the editor is not in the `faulted` lifecycle state.
     */
    emergencyReset(): Promise<void>;
    /**
     * Performs best-effort cleanup of a faulted editor and records cleanup failures.
     *
     * @throws When the editor is not in the `faulted` lifecycle state.
     */
    forceDispose(): Promise<void>;
    /**
     * Starts best-effort disposal and may return before asynchronous cleanup settles.
     *
     * @deprecated Use `disposeAsync()` to await completion and observe cleanup failures.
     */
    dispose(): void;
    /**
     * Aborts active work, disposes Plugins and Canvas resources, and awaits cleanup completion.
     *
     * @remarks Repeated calls return the same in-flight disposal promise.
     */
    disposeAsync(): Promise<void>;
    private performEmergencyReset;
    private runEmergencyStep;
    private failEmergencyReset;
    private disposeAfterEmergencyFailure;
    private createPluginManager;
    private rollbackInitialization;
    private getInitializationCleanupErrors;
    private replayInstallationPlan;
    private publishPluginApi;
    private clearPluginApiHandles;
    private createEnvironmentPort;
    private createStatusPort;
    private createDiagnosticsPort;
    private createPresentationPort;
    private createFabricRuntimePort;
    private createCanvasReadPort;
    private createBaseImageReadPort;
    private createBaseImageInfoPort;
    private createImageResourcePolicyPort;
    private createRenderRequestPort;
    private createCanvasResizePort;
    private createRasterMutationPort;
    private createSnapshotRegistrationPort;
    private createMementoHistoryPort;
    private computeLayout;
    private captureGeometry;
    private finalizeBaseImageGeometry;
    private setCanvasSize;
    private isInputRasterWithinBudget;
    private assertRasterBudget;
    private runExport;
    private emitDocumentCommitted;
    private assertCurrentLoad;
    private requireCanvas;
    private requireCanvasForImageLoad;
    private requireCanvasForPlugin;
    private requestRender;
    private updatePlaceholder;
    private reportWarning;
    private reportError;
    private emitRuntimeStatus;
    private invokeStatusListener;
    private enterFaulted;
    private recordDiagnostic;
    private assertReady;
    private assertDocumentMutationOperational;
    private assertNotDisposed;
    private isDisposingOrDisposed;
    private clearRuntimeReferences;
    private performDisposeAsync;
    private completeDisposal;
    private disposeResponsiveSubscriptions;
    private observeDetachedDisposal;
}
