/**
 * Owns the editor lifecycle, Canvas, Plugin host, image loading, document mutations, and export.
 *
 * @module
 */
import type * as FabricNS from 'fabric';
import { type PluginRef, type SynchronousEditorPlugin } from '../plugin-kernel/index.js';
import { type PluginArrayApis, type PluginPlan } from '../plugin-kernel/plugin-plan.js';
import { type CoreDiagnostic } from './errors.js';
import type { CoreElementMap, CoreEventMap, CoreExportOptions, CoreImageInfo, EditorLifecycleState, FabricModule, ImageEditorCoreOptions, LayoutMode, LoadImageOptions, ResolvedImageEditorCoreOptions } from './public-types.js';
import { type MissingPluginPolicy, type SnapshotMigration } from './state/index.js';
export interface LoadStateOptions {
    readonly missingPluginPolicy?: MissingPluginPolicy;
    readonly migrations?: readonly SnapshotMigration[];
    readonly signal?: AbortSignal;
}
export declare class ImageEditorCore {
    readonly fabric: FabricModule;
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
    private disposePromise;
    private emergencyResetPromise;
    private readonly diagnostics;
    constructor(fabric: FabricModule, options?: ImageEditorCoreOptions);
    use<TApi>(plugin: SynchronousEditorPlugin<TApi, CoreEventMap>): TApi;
    install<TApis, TPlugin extends {
        readonly ref: PluginRef<unknown>;
    }>(plan: PluginPlan<TApis, TPlugin>): TApis;
    install<const TPlugins extends readonly SynchronousEditorPlugin<unknown, CoreEventMap>[]>(plugins: TPlugins): PluginArrayApis<TPlugins>;
    getPlugin<TApi>(ref: PluginRef<TApi>): TApi | null;
    requirePlugin<TApi>(ref: PluginRef<TApi>): TApi;
    getPluginById(pluginId: string): unknown | null;
    getLifecycleState(): EditorLifecycleState;
    getDiagnostics(): readonly CoreDiagnostic[];
    init(elements: CoreElementMap): Promise<void>;
    private createCanvas;
    private finishInitialization;
    loadImage(source: string, options?: LoadImageOptions): Promise<void>;
    loadImageFile(file: File, options?: LoadImageOptions): Promise<void>;
    saveState(): string;
    loadFromState(input: string | unknown, options?: LoadStateOptions): Promise<void>;
    exportImageBase64(options?: CoreExportOptions): Promise<string>;
    exportImageFile(options?: CoreExportOptions): Promise<File>;
    isImageLoaded(): boolean;
    getImageInfo(): CoreImageInfo | null;
    getCanvas(): FabricNS.Canvas | null;
    setLayoutMode(mode: LayoutMode): void;
    emergencyReset(): Promise<void>;
    forceDispose(): Promise<void>;
    /**
     * Starts best-effort disposal and may return before asynchronous cleanup settles.
     *
     * @deprecated Use `disposeAsync()` to await completion and observe cleanup failures.
     */
    dispose(): void;
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
    private requireCanvasForPlugin;
    private requestRender;
    private updatePlaceholder;
    private reportWarning;
    private reportError;
    private enterFaulted;
    private recordDiagnostic;
    private assertReady;
    private assertNotDisposed;
    private isDisposingOrDisposed;
    private clearRuntimeReferences;
    private performDisposeAsync;
    private completeDisposal;
    private observeDetachedDisposal;
}
