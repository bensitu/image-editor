/**
 * Owns the editor lifecycle, Canvas, Plugin host, image loading, document mutations, and export.
 *
 * @module
 */

import type * as FabricNS from 'fabric';

import {
    PluginManager,
    PluginLifecycleError,
    PluginNotInstalledError,
    type EditorPlugin,
    type PluginRef,
    type SynchronousEditorPlugin,
} from '../plugin-kernel/index.js';
import type { PluginDefinitionInput } from '../plugin-kernel/plugin-types.js';
import {
    isPluginPlan,
    resolvePluginPlanApis,
    type PluginArrayApis,
    type PluginPlan,
} from '../plugin-kernel/plugin-plan.js';
import {
    applyCanvasDimensions,
    computeCoverLayout,
    computeExpandLayout,
    computeFitLayout,
    computeScrollableCanvasSize,
    measureScrollbarSize,
    selectLayoutStrategy,
    ViewportCache,
} from '../image/layout-manager.js';
import { CanvasCoreStateAdapter } from './core-state-adapter.js';
import {
    CoreRuntimeError,
    EmergencyResetError,
    EditorFaultedError,
    classifyCoreError,
    type CoreDiagnostic,
} from './errors.js';
import { ExportContributorRegistry } from './export-contributor-registry.js';
import {
    GeometryMutationCoordinator,
    IDENTITY_AFFINE_MATRIX,
    type AffineMatrix,
    type BaseImageGeometrySnapshot,
} from './geometry/index.js';
import { HistoryCommitRouter } from './history-commit-router.js';
import {
    BASE_IMAGE_INFO_CAPABILITY,
    BASE_IMAGE_READ_CAPABILITY,
    CANVAS_READ_CAPABILITY,
    CANVAS_RESIZE_CAPABILITY,
    CORE_DIAGNOSTICS_CAPABILITY,
    CORE_ENVIRONMENT_CAPABILITY,
    CORE_PRESENTATION_CAPABILITY,
    CORE_STATUS_CAPABILITY,
    DOCUMENT_MUTATION_CAPABILITY,
    EXPORT_CONTRIBUTION_CAPABILITY,
    FABRIC_RUNTIME_CAPABILITY,
    GEOMETRY_MUTATION_CAPABILITY,
    IMAGE_RESOURCE_POLICY_CAPABILITY,
    MEMENTO_HISTORY_CAPABILITY,
    RASTER_MUTATION_CAPABILITY,
    RENDER_REQUEST_CAPABILITY,
    SNAPSHOT_REGISTRATION_CAPABILITY,
    type BaseImageInfoPort,
    type BaseImageReadPort,
    type CanvasReadPort,
    type CanvasResizePort,
    type CoreDiagnosticsPort,
    type CoreEnvironmentPort,
    type CorePresentationPort,
    type CoreStatusPort,
    type FabricRuntimePort,
    type ImageResourcePolicyPort,
    type MementoHistoryPort,
    type RasterMutationPort,
    type RenderRequestPort,
    type SnapshotRegistrationPort,
} from './internal-capabilities.js';
import { EditorLifecycleController } from './lifecycle.js';
import {
    DocumentMutationCoordinator,
    type DocumentMutationContext,
    type DocumentMutationDescriptor,
} from './mutation/index.js';
import type {
    CoreElementMap,
    CoreEventMap,
    CoreExportOptions,
    CoreImageInfo,
    EditorLifecycleState,
    ElementTarget,
    FabricModule,
    ImageEditorCoreOptions,
    ImageMimeType,
    LayoutMode,
    LoadImageOptions,
    ResolvedImageEditorCoreOptions,
} from './public-types.js';
import {
    MementoService,
    ObjectPropertyRegistry,
    SnapshotService,
    StateSliceRegistry,
    TransientObjectRegistry,
    DEFAULT_SNAPSHOT_LIMITS,
    type CoreMemento,
    type MementoRestoreOptions,
    type MissingPluginPolicy,
    type ObjectPropertyRegistration,
    type StateSliceDefinition,
    type SnapshotMigration,
    type TransientObjectPredicate,
} from './state/index.js';
import { inspectEncodedImageDataUrl } from './state/image-data-url.js';

const DEFAULT_CORE_OPTIONS: ResolvedImageEditorCoreOptions = Object.freeze({
    canvasWidth: 800,
    canvasHeight: 600,
    backgroundColor: '#ffffff',
    layoutMode: 'expand',
    groupSelection: true,
    maxInputBytes: 32 * 1024 * 1024,
    maxInputPixels: 64 * 1024 * 1024,
    imageLoadTimeoutMs: 30_000,
    maxExportPixels: 64 * 1024 * 1024,
    maxExportDimension: 16_384,
    exportMultiplier: 1,
    initialImageBase64: '',
});

function positiveFinite(value: number | undefined, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}

function positiveInteger(value: number | undefined, fallback: number): number {
    return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

function resolveOptions(options: ImageEditorCoreOptions): ResolvedImageEditorCoreOptions {
    const layoutMode = options.defaultLayoutMode;
    return Object.freeze({
        canvasWidth: positiveFinite(options.canvasWidth, DEFAULT_CORE_OPTIONS.canvasWidth),
        canvasHeight: positiveFinite(options.canvasHeight, DEFAULT_CORE_OPTIONS.canvasHeight),
        backgroundColor: options.backgroundColor ?? DEFAULT_CORE_OPTIONS.backgroundColor,
        layoutMode:
            layoutMode === 'fit' || layoutMode === 'cover' || layoutMode === 'expand'
                ? layoutMode
                : DEFAULT_CORE_OPTIONS.layoutMode,
        groupSelection: options.groupSelection ?? DEFAULT_CORE_OPTIONS.groupSelection,
        maxInputBytes: positiveInteger(options.maxInputBytes, DEFAULT_CORE_OPTIONS.maxInputBytes),
        maxInputPixels: positiveInteger(
            options.maxInputPixels,
            DEFAULT_CORE_OPTIONS.maxInputPixels,
        ),
        imageLoadTimeoutMs: positiveInteger(
            options.imageLoadTimeoutMs,
            DEFAULT_CORE_OPTIONS.imageLoadTimeoutMs,
        ),
        maxExportPixels: positiveInteger(
            options.maxExportPixels,
            DEFAULT_CORE_OPTIONS.maxExportPixels,
        ),
        maxExportDimension: positiveInteger(
            options.maxExportDimension,
            DEFAULT_CORE_OPTIONS.maxExportDimension,
        ),
        exportMultiplier: positiveFinite(
            options.exportMultiplier,
            DEFAULT_CORE_OPTIONS.exportMultiplier,
        ),
        initialImageBase64: options.initialImageBase64 ?? '',
        onError: options.onError,
        onWarning: options.onWarning,
    });
}

function resolveElement<TElement extends HTMLElement>(
    target: ElementTarget<TElement> | undefined,
    ownerDocument: Document,
): TElement | null {
    if (!target) return null;
    if (typeof target === 'string') return ownerDocument.getElementById(target) as TElement | null;
    return target;
}

function inferMimeType(source: string): ImageMimeType | null {
    const match = /^data:(image\/(?:jpeg|png|webp))(?:[;,])/i.exec(source);
    const mimeType = match?.[1]?.toLowerCase();
    return mimeType === 'image/jpeg' || mimeType === 'image/png' || mimeType === 'image/webp'
        ? mimeType
        : null;
}

function loadAbortError(message: string): DOMException {
    return new DOMException(message, 'AbortError');
}

function loadAbortReason(signal: AbortSignal, message: string): unknown {
    const reason = signal.reason;
    return reason instanceof DOMException && reason.name === 'AbortError'
        ? reason
        : loadAbortError(message);
}

function isLoadCancellation(error: unknown): boolean {
    return (
        typeof error === 'object' &&
        error !== null &&
        'name' in error &&
        error.name === 'AbortError'
    );
}

function withCoreTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    label: string,
    signal: AbortSignal,
): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const startedAt = Date.now();
        let settled = false;
        const finish = (body: () => void): void => {
            if (settled) return;
            settled = true;
            clearTimeout(timeoutId);
            signal.removeEventListener('abort', abort);
            body();
        };
        const abort = (): void =>
            finish(() => reject(loadAbortReason(signal, `${label} was aborted.`)));
        const timeoutId = setTimeout(() => {
            finish(() =>
                reject(
                    new CoreRuntimeError(
                        `[ImageEditor] ${label} timed out after ${Date.now() - startedAt}ms.`,
                        { code: 'IMAGE_LOAD_TIMEOUT' },
                    ),
                ),
            );
        }, timeoutMs);

        signal.addEventListener('abort', abort, { once: true });
        if (signal.aborted) {
            abort();
            return;
        }

        promise.then(
            (value) => finish(() => resolve(value)),
            (error: unknown) => finish(() => reject(error)),
        );
    });
}

function toAffineMatrix(value: readonly number[]): AffineMatrix {
    if (value.length !== 6 || value.some((entry) => !Number.isFinite(entry))) {
        throw new CoreRuntimeError(
            '[ImageEditor] Base image returned a malformed transform matrix.',
        );
    }
    return Object.freeze([value[0]!, value[1]!, value[2]!, value[3]!, value[4]!, value[5]!]);
}

function markBaseImage(image: FabricNS.FabricImage): FabricNS.FabricImage {
    (image as FabricNS.FabricImage & { editorObjectKind?: string }).editorObjectKind = 'baseImage';
    return image;
}

function isCoreImageInfo(value: unknown): value is CoreImageInfo {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as Partial<CoreImageInfo>;
    return (
        typeof candidate.width === 'number' &&
        typeof candidate.height === 'number' &&
        typeof candidate.naturalWidth === 'number' &&
        typeof candidate.naturalHeight === 'number' &&
        typeof candidate.geometryRevision === 'number'
    );
}

function reportSafely(
    callback: ((error: unknown, message: string) => void) | undefined,
    error: unknown,
    message: string,
    fallback: (message?: unknown, ...optional: unknown[]) => void,
): void {
    try {
        callback?.(error, message);
    } catch (callbackError) {
        fallback('[ImageEditor] Error callback failed.', callbackError);
    }
}

function base64ToFile(dataUrl: string, fileName: string): File {
    const [header = '', payload = ''] = dataUrl.split(',', 2);
    const mimeType = /data:([^;]+)/.exec(header)?.[1] ?? 'application/octet-stream';
    const binary = /;base64/i.test(header) ? atob(payload) : decodeURIComponent(payload);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return new File([bytes], fileName, { type: mimeType });
}

export interface LoadStateOptions {
    readonly missingPluginPolicy?: MissingPluginPolicy;
    readonly migrations?: readonly SnapshotMigration[];
    readonly signal?: AbortSignal;
}

interface PlannedPlugin {
    readonly definition: PluginDefinitionInput<CoreEventMap>;
}

function freezePluginDefinition(
    definition: PluginDefinitionInput<CoreEventMap>,
): PluginDefinitionInput<CoreEventMap> {
    if (!('manifest' in definition)) {
        return Object.freeze({
            ...definition,
            requires: definition.requires
                ? Object.freeze(
                      definition.requires.map((requirement) => Object.freeze({ ...requirement })),
                  )
                : undefined,
            optional: definition.optional
                ? Object.freeze(
                      definition.optional.map((requirement) => Object.freeze({ ...requirement })),
                  )
                : undefined,
            permissions: definition.permissions
                ? Object.freeze([...definition.permissions])
                : undefined,
        });
    }
    return Object.freeze({
        ...definition,
        manifest: Object.freeze({
            ...definition.manifest,
            requiresPlugins: definition.manifest.requiresPlugins
                ? Object.freeze([...definition.manifest.requiresPlugins])
                : undefined,
            requires: definition.manifest.requires
                ? Object.freeze(
                      definition.manifest.requires.map((requirement) =>
                          Object.freeze({ ...requirement }),
                      ),
                  )
                : undefined,
            optional: definition.manifest.optional
                ? Object.freeze(
                      definition.manifest.optional.map((requirement) =>
                          Object.freeze({ ...requirement }),
                      ),
                  )
                : undefined,
            permissions: definition.manifest.permissions
                ? Object.freeze([...definition.manifest.permissions])
                : undefined,
        }),
    });
}

export class ImageEditorCore {
    declare readonly options: ResolvedImageEditorCoreOptions;
    declare private readonly slices: StateSliceRegistry;
    declare private readonly objectProperties: ObjectPropertyRegistry;
    declare private readonly transientObjects: TransientObjectRegistry<FabricNS.FabricObject>;
    declare private readonly externalObjects: TransientObjectRegistry<FabricNS.FabricObject>;
    declare private readonly history: HistoryCommitRouter;
    declare private readonly exportContributors: ExportContributorRegistry;
    declare private readonly mementos: MementoService;
    declare private readonly snapshots: SnapshotService;
    declare private readonly documentMutations: DocumentMutationCoordinator;
    declare private readonly geometry: GeometryMutationCoordinator;
    declare private plugins: PluginManager<CoreEventMap>;
    declare private readonly installationPlan: PlannedPlugin[];
    declare private readonly lifecycle: EditorLifecycleController;
    declare private readonly viewportCache: ViewportCache;
    declare private canvas: FabricNS.Canvas | null;
    declare private canvasElement: HTMLCanvasElement | null;
    declare private containerElement: HTMLElement | null;
    declare private placeholderElement: HTMLElement | null;
    declare private baseImage: FabricNS.FabricImage | null;
    declare private imageMimeType: ImageMimeType | null;
    declare private imageLoaded: boolean;
    declare private baseImageScale: number;
    declare private layoutMode: LayoutMode;
    declare private geometryRevision: number;
    declare private loadSequence: number;
    declare private latestLoadSequence: number;
    declare private stateLoadSequence: number;
    declare private disposePromise: Promise<void> | null;
    declare private emergencyResetPromise: Promise<void> | null;
    declare private readonly diagnostics: CoreDiagnostic[];

    constructor(
        readonly fabric: FabricModule,
        options: ImageEditorCoreOptions = {},
    ) {
        this.slices = new StateSliceRegistry();
        this.objectProperties = new ObjectPropertyRegistry();
        this.history = new HistoryCommitRouter();
        this.exportContributors = new ExportContributorRegistry();
        this.installationPlan = [];
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
        if (
            !fabric ||
            typeof fabric.Canvas !== 'function' ||
            typeof fabric.FabricImage !== 'function'
        ) {
            throw new CoreRuntimeError(
                '[ImageEditor] ImageEditorCore requires a supported Fabric.js module.',
            );
        }
        this.options = resolveOptions(options);
        this.layoutMode = this.options.layoutMode;
        this.transientObjects = new TransientObjectRegistry((warning) => {
            this.reportWarning(warning.details?.cause, warning.message);
        });
        this.externalObjects = new TransientObjectRegistry((warning) => {
            this.reportWarning(warning.details?.cause, warning.message);
        });
        this.objectProperties.register({
            owner: 'core:host',
            keys: ['editorObjectKind'],
        });
        const stateAdapter = new CanvasCoreStateAdapter(
            {
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
                setCanvasSize: (width, height) => this.setCanvasSize(width, height, false),
                isDisposed: () => this.lifecycle.current === 'disposed',
            },
            this.objectProperties,
            this.transientObjects,
            this.externalObjects,
            {
                maxDecodedPixels: this.options.maxInputPixels,
                maxImageDimension: DEFAULT_SNAPSHOT_LIMITS.maxImageDimension,
                decodeTimeoutMs: this.options.imageLoadTimeoutMs,
            },
        );
        this.mementos = new MementoService(stateAdapter, this.slices);
        this.snapshots = new SnapshotService(
            stateAdapter,
            this.slices,
            this.mementos,
            (warning) => this.reportWarning(warning.details?.cause, warning.message),
            Object.freeze({
                ...DEFAULT_SNAPSHOT_LIMITS,
                maxInputBytes: Math.ceil((this.options.maxInputBytes * 4) / 3) + 1024 * 1024,
                maxStringLength: Math.ceil((this.options.maxInputBytes * 4) / 3) + 1024,
                maxDataUrlBytes: this.options.maxInputBytes,
                maxDecodedPixels: this.options.maxInputPixels,
            }),
        );

        this.documentMutations = new DocumentMutationCoordinator({
            mementos: this.mementos,
            operations: {
                has: (operationId) => this.plugins?.hasOperation(operationId) ?? false,
                get: (operationId) => this.plugins?.getOperationForHost(operationId) ?? null,
                run: (operationId, task, operationOptions) => {
                    if (!this.plugins) throw new Error('Plugin Manager is not ready.');
                    return this.plugins.runOperationForHost(
                        operationId,
                        null,
                        (args, context) => {
                            void args;
                            return task(context);
                        },
                        operationOptions,
                    );
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
                    this.finalizeBaseImageGeometry();
                    this.baseImage?.setCoords();
                    this.geometryRevision += 1;
                },
                restoreGeometry: (snapshot) => {
                    this.setCanvasSize(snapshot.canvasWidth, snapshot.canvasHeight, false);
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

    use<TApi>(plugin: SynchronousEditorPlugin<TApi, CoreEventMap>): TApi {
        this.lifecycle.assertAvailable('install a plugin');
        const api = this.plugins.installSync(plugin);
        this.installationPlan.push(Object.freeze({ definition: freezePluginDefinition(plugin) }));
        return api;
    }

    install<TApis, TPlugin extends { readonly ref: PluginRef<unknown> }>(
        plan: PluginPlan<TApis, TPlugin>,
    ): TApis;
    install<const TPlugins extends readonly SynchronousEditorPlugin<unknown, CoreEventMap>[]>(
        plugins: TPlugins,
    ): PluginArrayApis<TPlugins>;
    install(
        pluginsOrPlan:
            | PluginPlan<unknown, { readonly ref: PluginRef<unknown> }>
            | readonly SynchronousEditorPlugin<unknown, CoreEventMap>[],
    ): unknown {
        this.lifecycle.assertAvailable('install a plugin batch');
        const plugins = isPluginPlan(pluginsOrPlan) ? pluginsOrPlan.plugins : pluginsOrPlan;
        const outcome = this.plugins.installBatchSync(
            plugins as readonly SynchronousEditorPlugin<unknown, CoreEventMap>[],
        );
        for (const plugin of outcome.installedPlugins) {
            this.installationPlan.push(
                Object.freeze({ definition: freezePluginDefinition(plugin) }),
            );
        }
        const resolveApi = (plugin: { readonly ref: PluginRef<unknown> }): unknown => {
            const api = outcome.apisByPluginId.get(plugin.ref.id);
            if (api === undefined) {
                throw new PluginNotInstalledError(plugin.ref.id);
            }
            return api;
        };
        if (isPluginPlan(pluginsOrPlan)) {
            return resolvePluginPlanApis(pluginsOrPlan, resolveApi);
        }
        return Object.freeze(pluginsOrPlan.map((plugin) => resolveApi(plugin)));
    }

    /** @internal Asynchronous setup is retained for repository-owned integration paths. */
    async useAsync<TApi>(plugin: EditorPlugin<TApi, CoreEventMap>): Promise<TApi> {
        this.lifecycle.assertAvailable('install a plugin');
        const api = await this.plugins.install(plugin);
        this.installationPlan.push(
            Object.freeze({
                definition: freezePluginDefinition(plugin),
            }),
        );
        return api;
    }

    getPlugin<TApi>(ref: PluginRef<TApi>): TApi | null {
        return this.plugins.get(ref);
    }

    requirePlugin<TApi>(ref: PluginRef<TApi>): TApi {
        return this.plugins.require(ref);
    }

    getPluginById(pluginId: string): unknown | null {
        return this.plugins.getById(pluginId);
    }

    getLifecycleState(): EditorLifecycleState {
        return this.lifecycle.current;
    }

    getDiagnostics(): readonly CoreDiagnostic[] {
        return Object.freeze([...this.diagnostics]);
    }

    async init(elements: CoreElementMap): Promise<void> {
        this.lifecycle.beginInitialization();
        let pluginInitializationStarted = false;
        try {
            this.createCanvas(elements);
            pluginInitializationStarted = true;
            await this.plugins.initialize();
            this.lifecycle.completeInitialization();
        } catch (error) {
            const cleanupErrors = await this.rollbackInitialization(
                error,
                pluginInitializationStarted,
            );
            if (cleanupErrors.length > 0) {
                this.lifecycle.failInitialization();
                this.recordDiagnostic(error, 'Initialization failed and cleanup was incomplete.');
                for (const cleanupError of cleanupErrors) {
                    this.recordDiagnostic(cleanupError, 'Initialization cleanup failed.');
                }
            } else {
                this.lifecycle.recoverInitialization();
            }
            throw error;
        }
        this.finishInitialization();
    }

    private createCanvas(elements: CoreElementMap): void {
        const ownerDocument =
            typeof elements.canvas === 'string'
                ? globalThis.document
                : elements.canvas?.ownerDocument;
        if (!ownerDocument)
            throw new CoreRuntimeError('[ImageEditor] Canvas document is unavailable.');
        const canvasElement = resolveElement(elements.canvas, ownerDocument);
        if (!(canvasElement instanceof ownerDocument.defaultView!.HTMLCanvasElement)) {
            throw new CoreRuntimeError('[ImageEditor] Core canvas element was not found.');
        }
        this.canvasElement = canvasElement;
        this.containerElement =
            resolveElement(elements.canvasContainer, ownerDocument) ?? canvasElement.parentElement;
        this.placeholderElement = resolveElement(elements.imagePlaceholder, ownerDocument);
        const containerWidth = Math.floor(this.containerElement?.clientWidth ?? 0);
        const containerHeight = Math.floor(this.containerElement?.clientHeight ?? 0);
        const hasVisibleContainer = containerWidth > 0 && containerHeight > 0;
        this.canvas = new this.fabric.Canvas(canvasElement, {
            width: hasVisibleContainer ? containerWidth : this.options.canvasWidth,
            height: hasVisibleContainer ? containerHeight : this.options.canvasHeight,
            backgroundColor: this.options.backgroundColor,
            selection: this.options.groupSelection,
            preserveObjectStacking: true,
        });
    }

    private finishInitialization(): void {
        if (this.options.initialImageBase64) {
            void this.loadImage(this.options.initialImageBase64).catch(() => undefined);
        } else {
            this.updatePlaceholder();
        }
    }

    async loadImage(source: string, options: LoadImageOptions = {}): Promise<void> {
        this.assertReady('load an image');
        const encodedImage = inspectEncodedImageDataUrl(source);
        if (!inferMimeType(source) || !encodedImage) {
            throw new CoreRuntimeError('[ImageEditor] Unsupported image Data URL.');
        }
        if (encodedImage.encodedBytes > this.options.maxInputBytes) {
            throw new CoreRuntimeError('[ImageEditor] Image input exceeds maxInputBytes.');
        }
        if (
            encodedImage.dimensions &&
            encodedImage.dimensions.width * encodedImage.dimensions.height >
                this.options.maxInputPixels
        ) {
            throw new CoreRuntimeError('[ImageEditor] Image input exceeds maxInputPixels.');
        }
        if (options.concurrency && options.concurrency !== 'replace-pending') {
            throw new CoreRuntimeError('[ImageEditor] Unsupported load concurrency policy.');
        }
        try {
            await this.plugins.runOperationForHost(
                'core:load-image',
                source,
                async (loadSource, operationContext) => {
                    const sequence = ++this.loadSequence;
                    this.latestLoadSequence = sequence;
                    const image = await withCoreTimeout(
                        this.fabric.FabricImage.fromURL(loadSource, {
                            crossOrigin: 'anonymous',
                            signal: operationContext.signal,
                        }),
                        this.options.imageLoadTimeoutMs,
                        'FabricImage.fromURL',
                        operationContext.signal,
                    );
                    this.assertCurrentLoad(sequence, operationContext.signal);
                    const naturalWidth = Number(image.width) || 0;
                    const naturalHeight = Number(image.height) || 0;
                    if (
                        naturalWidth <= 0 ||
                        naturalHeight <= 0 ||
                        naturalWidth * naturalHeight > this.options.maxInputPixels
                    ) {
                        throw new CoreRuntimeError(
                            '[ImageEditor] Decoded image exceeds the pixel budget.',
                        );
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
                            applyCanvasDimensions(
                                canvas,
                                layout.canvasWidth,
                                layout.canvasHeight,
                                this.containerElement,
                            );
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
                },
                { signal: options.signal },
            );
        } catch (error) {
            if (!isLoadCancellation(error)) this.reportError(error, 'loadImage failed.');
            throw error;
        }
    }

    async loadImageFile(file: File, options: LoadImageOptions = {}): Promise<void> {
        if (!(file instanceof File))
            throw new TypeError('[ImageEditor] loadImageFile expects a File.');
        if (file.size > this.options.maxInputBytes) {
            throw new CoreRuntimeError('[ImageEditor] Image file exceeds maxInputBytes.');
        }
        if (options.signal?.aborted) {
            throw loadAbortReason(options.signal, 'Image file read was aborted.');
        }
        const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            const cleanup = (): void => options.signal?.removeEventListener('abort', abort);
            const abort = (): void => {
                reader.abort();
                cleanup();
                reject(loadAbortReason(options.signal!, 'Image file read was aborted.'));
            };
            reader.onerror = () => {
                cleanup();
                reject(reader.error ?? new Error('FileReader failed.'));
            };
            reader.onload = () => {
                cleanup();
                if (typeof reader.result === 'string') resolve(reader.result);
                else reject(new Error('FileReader did not produce a Data URL.'));
            };
            options.signal?.addEventListener('abort', abort, { once: true });
            reader.readAsDataURL(file);
        });
        await this.loadImage(dataUrl, options);
    }

    saveState(): string {
        this.assertReady('save state');
        return this.snapshots.stringify();
    }

    async loadFromState(input: string | unknown, options: LoadStateOptions = {}): Promise<void> {
        this.assertReady('load state');
        const prepared = await this.snapshots.prepareForLoad(input, {
            missingPluginPolicy: options.missingPluginPolicy,
            migrations: options.migrations,
            signal: options.signal,
        });
        const sequence = ++this.stateLoadSequence;
        try {
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
                    return Object.freeze({ schemaVersion: 3 as const });
                },
            });
            this.updatePlaceholder();
        } catch (error) {
            this.reportError(error, 'loadFromState failed.');
            throw error;
        }
    }

    exportImageBase64(options: CoreExportOptions = {}): Promise<string> {
        return this.runExport(options);
    }

    async exportImageFile(options: CoreExportOptions = {}): Promise<File> {
        const dataUrl = await this.runExport(options);
        const format = options.format ?? 'png';
        return base64ToFile(
            dataUrl,
            options.fileName ?? `image.${format === 'jpeg' ? 'jpg' : format}`,
        );
    }

    isImageLoaded(): boolean {
        return this.imageLoaded && this.baseImage !== null;
    }

    getImageInfo(): CoreImageInfo | null {
        const image = this.baseImage;
        if (!image) return null;
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

    getCanvas(): FabricNS.Canvas | null {
        return this.canvas;
    }

    setLayoutMode(mode: LayoutMode): void {
        this.assertNotDisposed('set layout mode');
        this.layoutMode = mode;
        this.viewportCache.clear();
    }

    emergencyReset(): Promise<void> {
        if (this.emergencyResetPromise) return this.emergencyResetPromise;
        if (this.lifecycle.current !== 'faulted') {
            return Promise.reject(
                new CoreRuntimeError(
                    `[ImageEditor] emergencyReset() is available only while the editor is faulted.`,
                    { code: 'EMERGENCY_RESET_NOT_ALLOWED', behavior: 'lifecycle' },
                ),
            );
        }
        const reset = this.performEmergencyReset();
        this.emergencyResetPromise = reset;
        void reset.then(
            () => {
                if (this.emergencyResetPromise === reset) this.emergencyResetPromise = null;
            },
            () => {
                if (this.emergencyResetPromise === reset) this.emergencyResetPromise = null;
            },
        );
        return reset;
    }

    async forceDispose(): Promise<void> {
        if (this.lifecycle.current === 'disposed') return;
        if (this.lifecycle.current !== 'faulted') {
            throw new CoreRuntimeError(
                '[ImageEditor] forceDispose() is available only while the editor is faulted.',
                { code: 'FORCE_DISPOSE_NOT_ALLOWED', behavior: 'lifecycle' },
            );
        }
        try {
            await this.disposeAsync();
        } catch (error) {
            this.recordDiagnostic(error, 'Forced disposal completed with cleanup failures.');
        }
    }

    dispose(): void {
        if (this.lifecycle.current === 'disposed' || this.lifecycle.current === 'disposing') return;
        if (this.geometry.isRunning || this.documentMutations.isRunning) {
            void this.disposeAsync();
            return;
        }
        if (!this.lifecycle.beginDisposal()) return;
        const errors: unknown[] = [];
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
            } catch (error) {
                errors.push(error);
            }
        }
        const canvas = this.canvas;
        this.clearRuntimeReferences();
        if (canvas) {
            const canvasDispose = canvas.dispose();
            if (canvasDispose && typeof canvasDispose.then === 'function') {
                this.disposePromise = Promise.resolve(canvasDispose).then(() => undefined);
            }
        }
        this.lifecycle.completeDisposal();
        if (errors.length > 0) {
            throw new CoreRuntimeError(
                `[ImageEditor] Core disposal completed with ${errors.length} cleanup error(s).`,
                { code: 'CORE_DISPOSE_ERROR', cause: Object.freeze(errors) },
            );
        }
    }

    disposeAsync(): Promise<void> {
        if (this.disposePromise) return this.disposePromise;
        if (this.lifecycle.current === 'disposed') return Promise.resolve();
        if (!this.lifecycle.beginDisposal()) return this.disposePromise ?? Promise.resolve();
        this.disposePromise = this.performDisposeAsync();
        return this.disposePromise;
    }

    private async performEmergencyReset(): Promise<void> {
        const failures: unknown[] = [];
        const abortReason = new DOMException(
            'Core emergency reset aborted active work.',
            'AbortError',
        );

        await Promise.all([
            this.runEmergencyStep(failures, 'Operation abort failed during emergency reset.', () =>
                this.plugins.abortOperationsForHost(abortReason),
            ),
            this.runEmergencyStep(
                failures,
                'Document mutation abort failed during emergency reset.',
                () => this.documentMutations.abortActive(abortReason),
            ),
            this.runEmergencyStep(
                failures,
                'Geometry mutation abort failed during emergency reset.',
                () => this.geometry.abortActive(abortReason),
            ),
        ]);
        await this.runEmergencyStep(failures, 'Tool exit failed during emergency reset.', () =>
            this.plugins.exitActiveToolForHost(),
        );

        const canvas = this.canvas;
        if (canvas) {
            await this.runEmergencyStep(
                failures,
                'Canvas disposal failed during emergency reset.',
                () => canvas.dispose(),
            );
        }
        this.clearRuntimeReferences();

        await this.runEmergencyStep(
            failures,
            'Plugin scope disposal failed during emergency reset.',
            () => this.plugins.dispose(),
        );
        await this.runEmergencyStep(failures, 'Snapshot reset failed during emergency reset.', () =>
            this.snapshots.reset(),
        );
        await this.runEmergencyStep(failures, 'Memento reset failed during emergency reset.', () =>
            this.mementos.reset(),
        );
        await this.runEmergencyStep(
            failures,
            'Document mutation reset failed during emergency reset.',
            () => this.documentMutations.reset(),
        );
        await this.runEmergencyStep(
            failures,
            'Geometry mutation reset failed during emergency reset.',
            () => this.geometry.reset(),
        );

        this.geometryRevision = 0;
        this.loadSequence = 0;
        this.latestLoadSequence = 0;
        this.stateLoadSequence = 0;
        this.layoutMode = this.options.layoutMode;
        this.disposePromise = null;

        if (failures.length > 0) {
            const failure = new CoreRuntimeError(
                `[ImageEditor] Emergency reset cleanup failed in ${failures.length} step(s).`,
                {
                    code: 'EMERGENCY_RESET_CLEANUP_ERROR',
                    cause: Object.freeze([...failures]),
                    behavior: 'lifecycle',
                },
            );
            await this.failEmergencyReset(failure);
        }

        try {
            await this.replayInstallationPlan();
        } catch (error) {
            this.recordDiagnostic(error, 'Plugin replay failed during emergency reset.');
            await this.failEmergencyReset(error);
        }
        this.lifecycle.recoverFault();
    }

    private async runEmergencyStep(
        failures: unknown[],
        message: string,
        task: () => unknown | Promise<unknown>,
    ): Promise<void> {
        try {
            await task();
        } catch (error) {
            failures.push(error);
            this.recordDiagnostic(error, message);
        }
    }

    private async failEmergencyReset(cause: unknown): Promise<never> {
        await this.disposeAfterEmergencyFailure();
        throw new EmergencyResetError(this.getDiagnostics(), cause);
    }

    private async disposeAfterEmergencyFailure(): Promise<void> {
        if (!this.lifecycle.beginDisposal()) return;
        const cleanupSteps: ReadonlyArray<readonly [string, () => void | Promise<void>]> = [
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
            } catch (error) {
                this.recordDiagnostic(error, message);
            }
        }
        this.clearRuntimeReferences();
        this.lifecycle.completeDisposal();
    }

    private createPluginManager(): PluginManager<CoreEventMap> {
        const manager = new PluginManager<CoreEventMap>({
            warningSink: (warning) => this.reportWarning(warning.cause, warning.message),
            errorSink: (error) => this.reportError(error, 'Plugin lifecycle failed.'),
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

    private async rollbackInitialization(
        failure: unknown,
        pluginInitializationStarted: boolean,
    ): Promise<readonly unknown[]> {
        const cleanupErrors = this.getInitializationCleanupErrors(failure);
        const canvas = this.canvas;
        this.clearRuntimeReferences();
        if (canvas) {
            try {
                await canvas.dispose();
            } catch (error) {
                cleanupErrors.push(error);
            }
        }
        if (pluginInitializationStarted && cleanupErrors.length === 0) {
            try {
                await this.replayInstallationPlan();
            } catch (error) {
                cleanupErrors.push(error);
            }
        }
        return Object.freeze(cleanupErrors);
    }

    private getInitializationCleanupErrors(failure: unknown): unknown[] {
        return failure instanceof PluginLifecycleError ? [...failure.cleanupErrors] : [];
    }

    private async replayInstallationPlan(): Promise<void> {
        const manager = this.createPluginManager();
        try {
            for (const planned of this.installationPlan) {
                await manager.install(planned.definition as EditorPlugin<unknown, CoreEventMap>);
            }
        } catch (error) {
            await manager.dispose().catch(() => undefined);
            throw error;
        }
        this.plugins = manager;
    }

    private createEnvironmentPort(): CoreEnvironmentPort {
        return Object.freeze({
            options: this.options,
            isDisposed: () => this.isDisposingOrDisposed(),
            reportWarning: (error: unknown, message: string) => this.reportWarning(error, message),
            reportError: (error: unknown, message: string) => this.reportError(error, message),
        });
    }

    private createStatusPort(): CoreStatusPort {
        return Object.freeze({ isDisposed: () => this.isDisposingOrDisposed() });
    }

    private createDiagnosticsPort(): CoreDiagnosticsPort {
        return Object.freeze({
            reportWarning: (error: unknown, message: string) => this.reportWarning(error, message),
            reportError: (error: unknown, message: string) => this.reportError(error, message),
        });
    }

    private createPresentationPort(): CorePresentationPort {
        return Object.freeze({
            backgroundColor: this.options.backgroundColor,
            layoutMode: this.layoutMode,
        });
    }

    private createFabricRuntimePort(): FabricRuntimePort {
        return Object.freeze({ fabric: this.fabric });
    }

    private createCanvasReadPort(): CanvasReadPort {
        return Object.freeze({
            getCanvas: () => this.canvas,
            requireCanvas: (operation: string) => this.requireCanvasForPlugin(operation),
        });
    }

    private createBaseImageReadPort(): BaseImageReadPort {
        return Object.freeze({
            getBaseImage: () => this.baseImage,
            ...this.createBaseImageInfoPort(),
        });
    }

    private createBaseImageInfoPort(): BaseImageInfoPort {
        return Object.freeze({
            getBaseImageScale: () => this.baseImageScale,
            getGeometryRevision: () => this.geometryRevision,
            getCanvasSize: () =>
                Object.freeze({
                    width: this.canvas?.getWidth() ?? 0,
                    height: this.canvas?.getHeight() ?? 0,
                }),
            getImageInfo: () => this.getImageInfo(),
            isImageLoaded: () => this.isImageLoaded(),
        });
    }

    private createImageResourcePolicyPort(): ImageResourcePolicyPort {
        return Object.freeze({
            getImageResourcePolicy: () =>
                Object.freeze({
                    maxInputBytes: this.options.maxInputBytes,
                    maxInputPixels: this.options.maxInputPixels,
                    imageLoadTimeoutMs: this.options.imageLoadTimeoutMs,
                    maxExportPixels: this.options.maxExportPixels,
                    maxExportDimension: this.options.maxExportDimension,
                }),
        });
    }

    private createRenderRequestPort(): RenderRequestPort {
        return Object.freeze({ requestRender: () => this.requestRender() });
    }

    private createCanvasResizePort(): CanvasResizePort {
        return Object.freeze({
            resizeCanvas: (width: number, height: number) => this.setCanvasSize(width, height),
        });
    }

    private createRasterMutationPort(): RasterMutationPort {
        return Object.freeze({
            replaceBaseImage: (
                context: DocumentMutationContext,
                image: FabricNS.FabricImage,
                replacementOptions?: Readonly<{
                    baseScale?: number;
                    mimeType?: CoreImageInfo['mimeType'];
                }>,
            ) => {
                this.documentMutations.assertContextActive(context);
                const canvas = this.requireCanvasForPlugin('replace the base image');
                if (this.baseImage && this.baseImage !== image) canvas.remove(this.baseImage);
                markBaseImage(image);
                if (!canvas.getObjects().includes(image)) canvas.add(image);
                canvas.sendObjectToBack(image);
                this.baseImage = image;
                this.imageLoaded = true;
                this.baseImageScale = positiveFinite(replacementOptions?.baseScale, 1);
                this.imageMimeType = replacementOptions?.mimeType ?? this.imageMimeType;
                this.geometryRevision += 1;
                this.updatePlaceholder();
            },
        });
    }

    private createSnapshotRegistrationPort(): SnapshotRegistrationPort {
        return Object.freeze({
            registerSlice: <TState>(definition: StateSliceDefinition<TState>) =>
                this.slices.register(definition),
            registerObjectProperties: (registration: ObjectPropertyRegistration) =>
                this.objectProperties.register(registration),
            registerTransientObject: (
                owner: string,
                predicate: TransientObjectPredicate<FabricNS.FabricObject>,
            ) => this.transientObjects.register(owner, predicate),
            registerExternalObject: (
                owner: string,
                predicate: TransientObjectPredicate<FabricNS.FabricObject>,
            ) => this.externalObjects.register(owner, predicate),
        });
    }

    private createMementoHistoryPort(): MementoHistoryPort {
        return Object.freeze({
            captureMemento: () => this.mementos.capture(),
            restoreMemento: (memento: CoreMemento, options?: MementoRestoreOptions) =>
                this.mementos.restore(memento, options),
            registerHistoryProvider: (
                owner: string,
                provider: Parameters<HistoryCommitRouter['register']>[1],
            ) => this.history.register(owner, provider),
            reportFatal: (error: unknown) => this.enterFaulted(error),
        });
    }

    private computeLayout(image: FabricNS.FabricImage) {
        const scrollbarSize = measureScrollbarSize(this.containerElement?.ownerDocument ?? null);
        const viewport = this.viewportCache.measure(
            this.containerElement,
            { width: this.options.canvasWidth, height: this.options.canvasHeight },
            scrollbarSize,
        );
        const strategy = selectLayoutStrategy(this.layoutMode);
        const width = Number(image.width) || 0;
        const height = Number(image.height) || 0;
        if (strategy === 'fit') {
            return computeFitLayout(
                width,
                height,
                this.options.canvasWidth,
                this.options.canvasHeight,
                viewport,
            );
        }
        if (strategy === 'cover') {
            return computeCoverLayout(
                width,
                height,
                this.options.canvasWidth,
                this.options.canvasHeight,
                viewport,
                scrollbarSize,
            );
        }
        return computeExpandLayout(width, height, viewport);
    }

    private captureGeometry(): BaseImageGeometrySnapshot {
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

    private finalizeBaseImageGeometry(): void {
        const image = this.baseImage;
        const canvas = this.canvas;
        if (!image || !canvas) return;
        image.setCoords();
        const bounds = image.getBoundingRect();
        const scrollbarSize = measureScrollbarSize(
            this.containerElement?.ownerDocument ?? this.canvasElement?.ownerDocument ?? null,
        );
        const viewport = this.viewportCache.measure(
            this.containerElement,
            { width: this.options.canvasWidth, height: this.options.canvasHeight },
            scrollbarSize,
        );
        const imageFitsViewport =
            bounds.width <= viewport.width + 0.5 && bounds.height <= viewport.height + 0.5;
        if (imageFitsViewport) {
            this.setCanvasSize(Math.max(1, viewport.width - 1), Math.max(1, viewport.height - 1));
        } else if (this.layoutMode === 'fit' || this.layoutMode === 'cover') {
            const size = computeScrollableCanvasSize(
                bounds.width,
                bounds.height,
                viewport,
                scrollbarSize,
            );
            this.setCanvasSize(size.width, size.height);
        } else {
            this.setCanvasSize(
                Math.max(viewport.width, Math.ceil(bounds.width)),
                Math.max(viewport.height, Math.ceil(bounds.height)),
            );
        }
        image.set({ left: (image.left ?? 0) - bounds.left, top: (image.top ?? 0) - bounds.top });
        image.setCoords();
        canvas.sendObjectToBack(image);
    }

    private setCanvasSize(width: number, height: number, enforceBudget = true): void {
        if (!this.canvas) return;
        const nextWidth = Math.max(1, Math.ceil(width));
        const nextHeight = Math.max(1, Math.ceil(height));
        const nextPixels = nextWidth * nextHeight;
        if (
            enforceBudget &&
            (!Number.isSafeInteger(nextPixels) ||
                Math.max(nextWidth, nextHeight) > this.options.maxExportDimension ||
                nextPixels > this.options.maxExportPixels)
        ) {
            throw new CoreRuntimeError('[ImageEditor] Dimensions exceed the configured budget.');
        }
        applyCanvasDimensions(this.canvas, nextWidth, nextHeight, this.containerElement);
    }

    private async runExport(options: CoreExportOptions): Promise<string> {
        this.assertReady('export an image');
        const operation = this.plugins.beginOperationForHost('core:export');
        try {
            const canvas = this.requireCanvas('exportImageBase64');
            const multiplier = positiveFinite(options.multiplier, this.options.exportMultiplier);
            const format = options.format ?? 'png';
            const quality = Math.max(0, Math.min(1, options.quality ?? 0.92));
            let left = 0;
            let top = 0;
            let width = canvas.getWidth();
            let height = canvas.getHeight();
            if ((options.area ?? 'image') === 'image') {
                if (!this.baseImage)
                    throw new CoreRuntimeError('[ImageEditor] No image is loaded.');
                this.baseImage.setCoords();
                const bounds = this.baseImage.getBoundingRect();
                left = bounds.left;
                top = bounds.top;
                width = bounds.width;
                height = bounds.height;
            }
            if (
                width * multiplier > this.options.maxExportDimension ||
                height * multiplier > this.options.maxExportDimension ||
                width * height * multiplier * multiplier > this.options.maxExportPixels
            ) {
                throw new CoreRuntimeError(
                    '[ImageEditor] Dimensions exceed the configured budget.',
                );
            }
            const exportElement = this.canvasElement?.ownerDocument.createElement('canvas');
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
            } finally {
                await exportCanvas.dispose();
            }
        } finally {
            await operation.dispose();
        }
    }

    private async emitDocumentCommitted(descriptor: DocumentMutationDescriptor): Promise<void> {
        if (descriptor.kind === 'geometry') {
            await this.plugins?.emitCommitted('geometry:committed', descriptor.result);
            return;
        }
        if (
            descriptor.operationId === 'core:commit-load-image' &&
            isCoreImageInfo(descriptor.result)
        ) {
            await this.plugins?.emitCommitted('image:loaded', descriptor.result);
            return;
        }
        if (descriptor.operationId === 'core:load-state') {
            await this.plugins?.emitCommitted('state:loaded', { schemaVersion: 3 });
            return;
        }
        await this.plugins?.emitCommitted('document:committed', descriptor);
    }

    private assertCurrentLoad(sequence: number, signal: AbortSignal): void {
        if (signal.aborted) {
            throw loadAbortReason(signal, 'Image load was aborted.');
        }
        if (sequence !== this.latestLoadSequence) {
            throw loadAbortError('Image load result is stale.');
        }
    }

    private requireCanvas(operation: string): FabricNS.Canvas {
        this.assertReady(operation);
        if (!this.canvas)
            throw new CoreRuntimeError(`[ImageEditor] Cannot ${operation} without Canvas.`);
        return this.canvas;
    }

    private requireCanvasForPlugin(operation: string): FabricNS.Canvas {
        if (this.lifecycle.current !== 'initializing') this.lifecycle.assertOperational(operation);
        if (!this.canvas)
            throw new CoreRuntimeError(`[ImageEditor] Cannot ${operation} without Canvas.`);
        return this.canvas;
    }

    private requestRender(): void {
        if (this.lifecycle.current !== 'disposed') this.canvas?.requestRenderAll();
    }

    private updatePlaceholder(): void {
        if (this.placeholderElement) this.placeholderElement.hidden = this.baseImage !== null;
    }

    private reportWarning(error: unknown, message: string): void {
        reportSafely(this.options.onWarning, error, message, console.warn);
    }

    private reportError(error: unknown, message: string): void {
        reportSafely(this.options.onError, error, message, console.error);
    }

    private enterFaulted(error: unknown): void {
        const state = this.lifecycle.current;
        if (state === 'disposed' || state === 'disposing') return;
        if (state === 'initialized') this.lifecycle.failRuntime();
        else if (state !== 'faulted') {
            this.recordDiagnostic(error, `A fatal error occurred while Core was ${state}.`);
            return;
        }
        const suspension = this.plugins.suspendOperationsForHost(
            new EditorFaultedError('run an operation'),
        );
        void suspension.catch((suspensionError: unknown) => {
            this.recordDiagnostic(suspensionError, 'Faulted operation suspension failed.');
        });
        this.recordDiagnostic(error);
        this.reportError(error, 'Core entered the faulted lifecycle state.');
    }

    private recordDiagnostic(error: unknown, message?: string): CoreDiagnostic {
        const classification = classifyCoreError(error);
        const code =
            error && typeof error === 'object' && typeof Reflect.get(error, 'code') === 'string'
                ? String(Reflect.get(error, 'code'))
                : 'UNCLASSIFIED_CORE_ERROR';
        const diagnostic = Object.freeze({
            ...classification,
            timestamp: Date.now(),
            code,
            message: message ?? (error instanceof Error ? error.message : String(error)),
            cause:
                error instanceof CoreRuntimeError && error.cause !== undefined
                    ? error.cause
                    : error,
        });
        this.diagnostics.push(diagnostic);
        return diagnostic;
    }

    private assertReady(operation: string): void {
        this.lifecycle.assertOperational(operation);
        if (!this.canvas)
            throw new CoreRuntimeError(`[ImageEditor] Cannot ${operation} without Canvas.`);
    }

    private assertNotDisposed(operation: string): void {
        this.lifecycle.assertAvailable(operation);
    }

    private isDisposingOrDisposed(): boolean {
        return this.lifecycle.current === 'disposing' || this.lifecycle.current === 'disposed';
    }

    private clearRuntimeReferences(): void {
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

    private async performDisposeAsync(): Promise<void> {
        const errors: unknown[] = [];
        for (const cleanup of [
            () => this.geometry.dispose(),
            () => this.documentMutations.dispose(),
            () => this.plugins.dispose(),
        ]) {
            try {
                await cleanup();
            } catch (error) {
                errors.push(error);
            }
        }
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
            } catch (error) {
                errors.push(error);
            }
        }
        this.lifecycle.completeDisposal();
        if (errors.length > 0) {
            throw new CoreRuntimeError(
                `[ImageEditor] Async disposal completed with ${errors.length} cleanup error(s).`,
                { code: 'CORE_DISPOSE_ERROR', cause: Object.freeze(errors) },
            );
        }
    }
}
