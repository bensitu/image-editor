/**
 * Owns the editor lifecycle, Canvas, Plugin host, image loading, document mutations, and export.
 *
 * @module
 */

import type * as FabricNS from 'fabric';

import {
    PluginLifecycleError,
    PluginNotInstalledError,
    type PluginRef,
    type SynchronousEditorPlugin,
} from '../plugin-kernel/index.js';
import { PluginManager } from '../plugin-kernel/plugin-manager.js';
import { coreOperationIds } from '../plugin-kernel/operation-ids.js';
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
import { preprocessImageDataUrl, requiresImagePreprocessing } from '../image/image-preprocessor.js';
import { CanvasCoreStateAdapter, disposeReplacedBaseImage } from './core-state-adapter.js';
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
import { isProxyablePluginApi, StablePluginApiHandle } from './plugin-api-handle.js';
import {
    DocumentMutationCoordinator,
    type DocumentMutationContext,
    type DocumentMutationDescriptor,
} from './mutation/index.js';
import type {
    CoreElementMap,
    CoreEventListener,
    CoreEventMap,
    CoreExportOptions,
    CoreImageInfo,
    ContainerObservationOptions,
    CoreRuntimeStatus,
    CoreStatusListener,
    CoreStatusSubscriptionOptions,
    CoreSubscription,
    EditorLifecycleState,
    ElementTarget,
    FabricModule,
    ImageEditorCoreOptions,
    ImageMimeType,
    ImagePreprocessingOptions,
    LayoutMode,
    LoadImageOptions,
    ResolvedCoreExportOptions,
    ResolvedImagePreprocessingOptions,
    ResolvedImageEditorCoreOptions,
    ResponsiveLayoutOptions,
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
import { isRasterAllocationWithinBudget } from '../utils/image-budget.js';
import { DOCUMENT_WIDE_MUTATION_CONFLICT_DOMAINS } from '../utils/internal-operation-conflict-domains.js';

const DEFAULT_EXPORT_FILE_NAME = 'edited_image';
const DEFAULT_CORE_OPTIONS: ResolvedImageEditorCoreOptions = Object.freeze({
    canvasWidth: 800,
    canvasHeight: 600,
    backgroundColor: 'transparent',
    layoutMode: 'expand',
    imagePreprocessing: Object.freeze({
        downsample: true,
        maxWidth: 4_000,
        maxHeight: 3_000,
        quality: 0.92,
        format: null,
        preserveSourceFormat: true,
        normalizeExifOrientation: true,
    }),
    groupSelection: true,
    maxInputBytes: 32 * 1024 * 1024,
    maxInputPixels: 64 * 1024 * 1024,
    imageLoadTimeoutMs: 30_000,
    maxExportPixels: 64 * 1024 * 1024,
    maxExportDimension: 16_384,
    exportMultiplier: 1,
    exportDefaults: Object.freeze({
        area: 'image',
        format: 'png',
        quality: 0.92,
        multiplier: 1,
        fileName: DEFAULT_EXPORT_FILE_NAME,
        contributors: Object.freeze({}),
    }),
    initialImageBase64: '',
});
const MAX_RETAINED_DIAGNOSTICS = 1_000;

function positiveFinite(value: number | undefined, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}

function positiveInteger(value: number | undefined, fallback: number): number {
    return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

function unitInterval(value: number | undefined, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
        ? value
        : fallback;
}

function isLayoutMode(value: unknown): value is LayoutMode {
    return value === 'fit' || value === 'cover' || value === 'expand';
}

function isImageMimeType(value: unknown): value is ImageMimeType {
    return value === 'image/jpeg' || value === 'image/png' || value === 'image/webp';
}

function resolveImagePreprocessing(
    options: ImagePreprocessingOptions | undefined,
    base: ResolvedImagePreprocessingOptions = DEFAULT_CORE_OPTIONS.imagePreprocessing,
): ResolvedImagePreprocessingOptions {
    return Object.freeze({
        downsample: options?.downsample ?? base.downsample,
        maxWidth: positiveInteger(options?.maxWidth, base.maxWidth),
        maxHeight: positiveInteger(options?.maxHeight, base.maxHeight),
        quality: unitInterval(options?.quality, base.quality),
        format:
            options?.format === null || isImageMimeType(options?.format)
                ? options.format
                : base.format,
        preserveSourceFormat: options?.preserveSourceFormat ?? base.preserveSourceFormat,
        normalizeExifOrientation:
            options?.normalizeExifOrientation ?? base.normalizeExifOrientation,
    });
}

function exportFormat(value: unknown, fallback: ResolvedCoreExportOptions['format']) {
    return value === 'png' || value === 'jpeg' || value === 'webp' ? value : fallback;
}

function exportArea(value: unknown, fallback: ResolvedCoreExportOptions['area']) {
    return value === 'image' || value === 'canvas' ? value : fallback;
}

function resolveExportDefaults(
    options: CoreExportOptions | undefined,
    exportMultiplier: number,
): ResolvedCoreExportOptions {
    const defaults = DEFAULT_CORE_OPTIONS.exportDefaults;
    const fileName = options?.fileName?.trim();
    return Object.freeze({
        area: exportArea(options?.area, defaults.area),
        format: exportFormat(options?.format, defaults.format),
        quality: unitInterval(options?.quality, defaults.quality),
        multiplier: positiveFinite(options?.multiplier, exportMultiplier),
        fileName: fileName || defaults.fileName,
        contributors: Object.freeze({ ...(options?.contributors ?? {}) }),
    });
}

function resolveExportOptions(
    options: CoreExportOptions,
    defaults: ResolvedCoreExportOptions,
): ResolvedCoreExportOptions {
    const fileName = options.fileName?.trim();
    return Object.freeze({
        area: exportArea(options.area, defaults.area),
        format: exportFormat(options.format, defaults.format),
        quality: unitInterval(options.quality, defaults.quality),
        multiplier: positiveFinite(options.multiplier, defaults.multiplier),
        fileName: fileName || defaults.fileName,
        contributors: Object.freeze({
            ...defaults.contributors,
            ...(options.contributors ?? {}),
        }),
    });
}

function exportFileName(baseName: string, format: ResolvedCoreExportOptions['format']): string {
    const extension = format === 'jpeg' ? 'jpg' : format;
    const cleaned =
        [...baseName]
            .filter((character) => (character.codePointAt(0) ?? 0) >= 0x20)
            .join('')
            .trim() || DEFAULT_EXPORT_FILE_NAME;
    return /\.(?:jpe?g|png|webp)$/iu.test(cleaned)
        ? cleaned.replace(/\.(?:jpe?g|png|webp)$/iu, `.${extension}`)
        : `${cleaned}.${extension}`;
}

function resolveOptions(options: ImageEditorCoreOptions): ResolvedImageEditorCoreOptions {
    const layoutMode = options.defaultLayoutMode;
    const exportMultiplier = positiveFinite(
        options.exportMultiplier,
        DEFAULT_CORE_OPTIONS.exportMultiplier,
    );
    return Object.freeze({
        canvasWidth: positiveFinite(options.canvasWidth, DEFAULT_CORE_OPTIONS.canvasWidth),
        canvasHeight: positiveFinite(options.canvasHeight, DEFAULT_CORE_OPTIONS.canvasHeight),
        backgroundColor: options.backgroundColor ?? DEFAULT_CORE_OPTIONS.backgroundColor,
        layoutMode: isLayoutMode(layoutMode) ? layoutMode : DEFAULT_CORE_OPTIONS.layoutMode,
        imagePreprocessing: resolveImagePreprocessing(options.imagePreprocessing),
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
        exportMultiplier,
        exportDefaults: resolveExportDefaults(options.exportDefaults, exportMultiplier),
        initialImageBase64: options.initialImageBase64 ?? '',
        ...(options.onError ? { onError: options.onError } : {}),
        ...(options.onWarning ? { onWarning: options.onWarning } : {}),
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
    task: (signal: AbortSignal) => Promise<T>,
    timeoutMs: number,
    label: string,
    signal: AbortSignal,
    disposeLateResult?: (value: T) => void,
): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const startedAt = Date.now();
        const controller = new AbortController();
        let settled = false;
        const finish = (body: () => void): void => {
            if (settled) return;
            settled = true;
            clearTimeout(timeoutId);
            signal.removeEventListener('abort', abort);
            body();
        };
        const abort = (): void => {
            const reason = loadAbortReason(signal, `${label} was aborted.`);
            controller.abort(reason);
            finish(() => reject(reason));
        };
        const timeoutId = setTimeout(() => {
            const timeoutError = new CoreRuntimeError(
                `[ImageEditor] ${label} timed out after ${Date.now() - startedAt}ms.`,
                { code: 'IMAGE_LOAD_TIMEOUT' },
            );
            controller.abort(timeoutError);
            finish(() => reject(timeoutError));
        }, timeoutMs);

        signal.addEventListener('abort', abort, { once: true });
        if (signal.aborted) {
            abort();
            return;
        }

        try {
            task(controller.signal).then(
                (value) => {
                    if (settled) {
                        try {
                            disposeLateResult?.(value);
                        } catch {
                            // Late-result cleanup is best effort after the public operation settled.
                        }
                        return;
                    }
                    finish(() => resolve(value));
                },
                (error: unknown) => finish(() => reject(error)),
            );
        } catch (error) {
            finish(() => reject(error));
        }
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
        (candidate.mimeType === null || isImageMimeType(candidate.mimeType)) &&
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

function dataUrlToFile(dataUrl: string, fileName: string): File {
    const commaIndex = dataUrl.indexOf(',');
    const header = commaIndex < 0 ? '' : dataUrl.slice(0, commaIndex);
    const mimeType = /^data:([^;,]+);base64$/iu.exec(header)?.[1];
    if (!mimeType) {
        throw new CoreRuntimeError('[ImageEditor] Export did not produce a base64 Data URL.');
    }
    const payload = dataUrl.slice(commaIndex + 1);
    const buffer = (
        globalThis as typeof globalThis & {
            Buffer?: { from(input: string, encoding: 'base64'): Uint8Array };
        }
    ).Buffer;
    let bytes: Uint8Array;
    if (buffer) {
        bytes = Uint8Array.from(buffer.from(payload, 'base64'));
    } else {
        const binary = atob(payload);
        bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    }
    return new File([bytes.slice().buffer as ArrayBuffer], fileName, { type: mimeType });
}

/** Controls validation, migration, and cancellation for one state restoration. */
export interface LoadStateOptions {
    /** Handling policy for state slices whose owning Plugin is unavailable. */
    readonly missingPluginPolicy?: MissingPluginPolicy;
    /** Ordered migrations available to the Snapshot service. */
    readonly migrations?: readonly SnapshotMigration[];
    /** Cancels preparation or transactional restoration. */
    readonly signal?: AbortSignal;
}

interface PlannedPlugin {
    readonly definition: PluginDefinitionInput<CoreEventMap>;
}

interface PublishedPluginApi {
    readonly handle: StablePluginApiHandle;
}

/**
 * Owns the editor Canvas, Base Image, Plugin runtime, state, exports, and lifecycle.
 *
 * @remarks
 * Install synchronous Plugins before calling {@link ImageEditorCore.init}. Initialization and
 * every mutating operation are instance-scoped; callers should await
 * {@link ImageEditorCore.disposeAsync} before releasing the host DOM.
 */
export class ImageEditorCore {
    /** Immutable normalized construction options. */
    readonly options: ResolvedImageEditorCoreOptions;
    private readonly slices = new StateSliceRegistry();
    private readonly objectProperties = new ObjectPropertyRegistry();
    private readonly transientObjects: TransientObjectRegistry<FabricNS.FabricObject>;
    private readonly externalObjects: TransientObjectRegistry<FabricNS.FabricObject>;
    private readonly history = new HistoryCommitRouter();
    private readonly exportContributors = new ExportContributorRegistry();
    private readonly mementos: MementoService;
    private readonly snapshots: SnapshotService;
    private readonly documentMutations: DocumentMutationCoordinator;
    private readonly geometry: GeometryMutationCoordinator;
    private plugins: PluginManager<CoreEventMap>;
    private readonly installationPlan: PlannedPlugin[] = [];
    private readonly pluginApiHandles = new Map<string, PublishedPluginApi>();
    private readonly lifecycle = new EditorLifecycleController();
    private readonly viewportCache = new ViewportCache();
    private canvas: FabricNS.Canvas | null = null;
    private canvasElement: HTMLCanvasElement | null = null;
    private containerElement: HTMLElement | null = null;
    private placeholderElement: HTMLElement | null = null;
    private baseImage: FabricNS.FabricImage | null = null;
    private imageMimeType: ImageMimeType | null = null;
    private imageLoaded = false;
    private baseImageScale = 1;
    private layoutMode: LayoutMode;
    private geometryRevision = 0;
    private loadSequence = 0;
    private latestLoadSequence = 0;
    private stateLoadSequence = 0;
    private initialImageLoadActive = false;
    private disposePromise: Promise<void> | null = null;
    private emergencyResetPromise: Promise<void> | null = null;
    private readonly diagnostics: CoreDiagnostic[] = [];
    private readonly statusListeners = new Set<CoreStatusListener>();
    private readonly responsiveSubscriptions = new Set<CoreSubscription>();
    private lastRuntimeStatus: CoreRuntimeStatus | null = null;
    private relayoutSequence = 0;

    /**
     * Creates a configured editor without accessing the DOM.
     *
     * @param fabric - Supported Fabric.js module namespace.
     * @param options - Core resource limits, layout policy, export defaults, and diagnostics.
     */
    constructor(
        readonly fabric: FabricModule,
        options: ImageEditorCoreOptions = {},
    ) {
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
                setCanvasSize: (width, height) => this.setCanvasSize(width, height),
                isDisposed: () => this.lifecycle.current === 'disposed',
            },
            this.objectProperties,
            this.transientObjects,
            this.externalObjects,
            {
                maxDecodedPixels: Math.min(
                    this.options.maxInputPixels,
                    this.options.maxExportPixels,
                ),
                maxImageDimension: Math.min(
                    DEFAULT_SNAPSHOT_LIMITS.maxImageDimension,
                    this.options.maxExportDimension,
                ),
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
                maxDecodedPixels: Math.min(
                    this.options.maxInputPixels,
                    this.options.maxExportPixels,
                ),
                maxImageDimension: Math.min(
                    DEFAULT_SNAPSHOT_LIMITS.maxImageDimension,
                    this.options.maxExportDimension,
                ),
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
                    this.finalizeBaseImageGeometry();
                    this.baseImage?.setCoords();
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

    /** Installs one synchronous Plugin before initialization and returns its stable API. */
    use<TApi>(plugin: SynchronousEditorPlugin<TApi, CoreEventMap>): TApi {
        this.lifecycle.assertAvailable('install a plugin');
        const outcome = this.plugins.installSyncForHost(plugin);
        this.installationPlan.push(Object.freeze({ definition: outcome.installedPlugin }));
        return this.publishPluginApi(plugin.ref.id, outcome.api);
    }

    /**
     * Installs a synchronous Plugin plan or array as one dependency-ordered batch.
     *
     * @remarks If installation fails, registrations created by the batch are rolled back.
     */
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
            this.installationPlan.push(Object.freeze({ definition: plugin }));
        }
        const resolveApi = (plugin: { readonly ref: PluginRef<unknown> }): unknown => {
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

    /** Returns a stable installed Plugin API, or `null` when the Plugin is unavailable. */
    getPlugin<TApi>(ref: PluginRef<TApi>): TApi | null {
        const api = this.plugins.get(ref);
        return api === null ? null : this.publishPluginApi(ref.id, api);
    }

    /**
     * Returns a stable installed Plugin API.
     *
     * @throws {@link PluginNotInstalledError} When the referenced Plugin is unavailable.
     */
    requirePlugin<TApi>(ref: PluginRef<TApi>): TApi {
        const api = this.getPlugin(ref);
        if (api === null) throw new PluginNotInstalledError(ref.id);
        return api;
    }

    /** Returns an installed Plugin API by runtime identifier without compile-time API typing. */
    getPluginById(pluginId: string): unknown | null {
        const api = this.plugins.getById(pluginId);
        return api === null ? null : this.publishPluginApi(pluginId, api);
    }

    /** Returns the current lifecycle state. */
    getLifecycleState(): EditorLifecycleState {
        return this.lifecycle.current;
    }

    /** Returns an immutable snapshot of host-observable runtime state. */
    getRuntimeStatus(): CoreRuntimeStatus {
        const lifecycle = this.lifecycle.current;
        let busy = this.geometry.isRunning || this.documentMutations.isRunning;
        let activeToolId: string | null = null;
        if (lifecycle !== 'disposed') {
            try {
                busy = busy || this.plugins.hasRunningOperations();
                activeToolId = this.plugins.getActiveToolIdForHost();
            } catch {
                // A status read remains available while runtime services are being replaced.
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

    /**
     * Subscribes to lifecycle, image, operation, tool, layout, and geometry status changes.
     *
     * @returns An idempotent subscription handle.
     */
    subscribeStatus(
        listener: CoreStatusListener,
        options: CoreStatusSubscriptionOptions = {},
    ): CoreSubscription {
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
                if (!active) return;
                active = false;
                this.statusListeners.delete(listener);
            },
        });
    }

    /**
     * Subscribes to a committed Core event.
     *
     * @remarks Listener failures are reported as warnings and do not roll back committed work.
     */
    on<TKey extends keyof CoreEventMap & string>(
        eventName: TKey,
        listener: CoreEventListener<CoreEventMap[TKey]>,
    ): CoreSubscription {
        this.assertNotDisposed('subscribe to a Core event');
        if (typeof listener !== 'function') {
            throw new TypeError('[ImageEditor] Core event listener must be a function.');
        }
        return this.plugins.onCommittedForHost(eventName, listener);
    }

    /** Returns an immutable copy of diagnostics recorded by this editor instance. */
    getDiagnostics(): readonly CoreDiagnostic[] {
        return Object.freeze([...this.diagnostics]);
    }

    /**
     * Creates the Fabric Canvas and initializes installed Plugins.
     *
     * @remarks An `initialImageBase64` value is fully loaded before this promise resolves.
     * @throws When DOM resolution, Canvas creation, image loading, or Plugin initialization fails.
     */
    async init(elements: CoreElementMap): Promise<void> {
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
                } finally {
                    this.initialImageLoadActive = false;
                }
            } else {
                this.updatePlaceholder();
            }
            this.lifecycle.completeInitialization();
            this.emitRuntimeStatus();
        } catch (error) {
            this.initialImageLoadActive = false;
            const cleanupErrors = await this.rollbackInitialization(
                error,
                pluginInitializationStarted,
                pluginInitializationCompleted,
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
            this.emitRuntimeStatus();
            if (initialImageLoadStarted) this.reportError(error, 'Initial image load failed.');
            throw error;
        }
    }

    private createCanvas(elements: CoreElementMap): void {
        const ownerDocument =
            typeof elements.canvas === 'string'
                ? globalThis.document
                : elements.canvas?.ownerDocument;
        if (!ownerDocument)
            throw new CoreRuntimeError('[ImageEditor] Canvas document is unavailable.');
        const canvasElement = resolveElement(elements.canvas, ownerDocument);
        if (
            !canvasElement ||
            canvasElement.tagName.toLowerCase() !== 'canvas' ||
            typeof canvasElement.getContext !== 'function'
        ) {
            throw new CoreRuntimeError('[ImageEditor] Core canvas element was not found.');
        }
        this.canvasElement = canvasElement;
        this.containerElement =
            resolveElement(elements.canvasContainer, ownerDocument) ?? canvasElement.parentElement;
        this.placeholderElement = resolveElement(elements.imagePlaceholder, ownerDocument);
        const containerWidth = Math.floor(this.containerElement?.clientWidth ?? 0);
        const containerHeight = Math.floor(this.containerElement?.clientHeight ?? 0);
        const hasVisibleContainer = containerWidth > 0 && containerHeight > 0;
        const initialWidth = Math.max(
            1,
            Math.ceil(hasVisibleContainer ? containerWidth : this.options.canvasWidth),
        );
        const initialHeight = Math.max(
            1,
            Math.ceil(hasVisibleContainer ? containerHeight : this.options.canvasHeight),
        );
        this.assertRasterBudget(initialWidth, initialHeight);
        this.canvas = new this.fabric.Canvas(canvasElement, {
            width: initialWidth,
            height: initialHeight,
            backgroundColor: this.options.backgroundColor,
            selection: this.options.groupSelection,
            // Fabric temporarily presents the active object above overlapping
            // siblings while retaining their persistent layer order. This keeps
            // list-driven Mask and Annotation selection authoritative on canvas.
            preserveObjectStacking: false,
        });
    }

    /**
     * Replaces the document image from a supported Base64 Data URL.
     *
     * @remarks The replacement is transactional and supersedes any pending image load.
     */
    async loadImage(source: string, options: LoadImageOptions = {}): Promise<void> {
        this.assertReady('load an image');
        await this.performImageLoad(source, options);
    }

    private async performImageLoad(source: string, options: LoadImageOptions = {}): Promise<void> {
        const encodedImage = inspectEncodedImageDataUrl(source);
        const sourceMimeType = inferMimeType(source);
        if (!sourceMimeType || !encodedImage) {
            throw new CoreRuntimeError('[ImageEditor] Unsupported image Data URL.');
        }
        if (encodedImage.encodedBytes > this.options.maxInputBytes) {
            throw new CoreRuntimeError('[ImageEditor] Image input exceeds maxInputBytes.');
        }
        if (
            encodedImage.dimensions &&
            !this.isInputRasterWithinBudget(
                encodedImage.dimensions.width,
                encodedImage.dimensions.height,
            )
        ) {
            throw new CoreRuntimeError(
                '[ImageEditor] Image input dimensions exceed the configured budget.',
            );
        }
        if (options.concurrency && options.concurrency !== 'replace-pending') {
            throw new CoreRuntimeError('[ImageEditor] Unsupported load concurrency policy.');
        }
        const preprocessing = resolveImagePreprocessing(
            options.preprocessing,
            this.options.imagePreprocessing,
        );
        try {
            await this.plugins.runOperationForHost(
                coreOperationIds.loadImage,
                source,
                async (loadSource, operationContext) => {
                    const sequence = ++this.loadSequence;
                    this.latestLoadSequence = sequence;
                    const dimensions = encodedImage.dimensions;
                    const processed =
                        dimensions &&
                        requiresImagePreprocessing(
                            sourceMimeType,
                            dimensions.width,
                            dimensions.height,
                            preprocessing,
                        )
                            ? await withCoreTimeout(
                                  (signal) =>
                                      preprocessImageDataUrl({
                                          source: loadSource,
                                          mimeType: sourceMimeType,
                                          width: dimensions.width,
                                          height: dimensions.height,
                                          options: preprocessing,
                                          ownerDocument:
                                              this.canvasElement?.ownerDocument ??
                                              globalThis.document,
                                          signal,
                                      }),
                                  this.options.imageLoadTimeoutMs,
                                  'Image preprocessing',
                                  operationContext.signal,
                              )
                            : Object.freeze({
                                  source: loadSource,
                                  mimeType: sourceMimeType,
                                  width: 0,
                                  height: 0,
                                  sourceWidth: 0,
                                  sourceHeight: 0,
                                  orientation: 1 as const,
                                  orientationNormalized: false,
                                  downsampled: false,
                              });
                    const image = await withCoreTimeout(
                        (signal) =>
                            this.fabric.FabricImage.fromURL(processed.source, {
                                crossOrigin: 'anonymous',
                                signal,
                            }),
                        this.options.imageLoadTimeoutMs,
                        'FabricImage.fromURL',
                        operationContext.signal,
                        (lateImage) => lateImage.dispose(),
                    );
                    let imageAdopted = false;
                    let previousScroll: Readonly<{ left: number; top: number }> | null;
                    try {
                        this.assertCurrentLoad(sequence, operationContext.signal);
                        const naturalWidth = Number(image.width) || 0;
                        const naturalHeight = Number(image.height) || 0;
                        if (!this.isInputRasterWithinBudget(naturalWidth, naturalHeight)) {
                            throw new CoreRuntimeError(
                                '[ImageEditor] Decoded image dimensions exceed the configured budget.',
                            );
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
                            operationId: coreOperationIds.commitLoadImage,
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
                                    await this.plugins.notifyImageCleared(commitContext.signal);
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
                                disposeReplacedBaseImage(
                                    previousBaseImage,
                                    baseImage,
                                    'image replacement',
                                );
                                const imageInfo = this.getImageInfo();
                                if (!imageInfo) {
                                    throw new Error('Loaded image information is unavailable.');
                                }
                                await this.plugins.notifyImageLoaded(
                                    imageInfo,
                                    commitContext.signal,
                                );
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
                    } catch (error) {
                        if (!imageAdopted) {
                            try {
                                disposeReplacedBaseImage(image, null, 'failed image load');
                            } catch (cleanupError) {
                                throw new CoreRuntimeError(
                                    '[ImageEditor] Image load failed and decoded image cleanup also failed.',
                                    {
                                        cause: Object.freeze([error, cleanupError]),
                                    },
                                );
                            }
                        }
                        throw error;
                    }
                    if (options.preserveScroll && previousScroll && this.containerElement) {
                        this.containerElement.scrollLeft = previousScroll.left;
                        this.containerElement.scrollTop = previousScroll.top;
                    }
                    this.updatePlaceholder();
                },
                options.signal ? { signal: options.signal } : {},
            );
        } catch (error) {
            if (!isLoadCancellation(error) && !this.initialImageLoadActive) {
                this.reportError(error, 'loadImage failed.');
            }
            throw error;
        }
    }

    /** Reads a browser `File` and replaces the document image transactionally. */
    async loadImageFile(file: File, options: LoadImageOptions = {}): Promise<void> {
        if (!(file instanceof File))
            throw new TypeError('[ImageEditor] loadImageFile expects a File.');
        if (file.size === 0) {
            throw new CoreRuntimeError('[ImageEditor] Image file is empty.', {
                code: 'IMAGE_FILE_EMPTY',
            });
        }
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
                reject(
                    new CoreRuntimeError('[ImageEditor] Image file could not be read.', {
                        code: 'IMAGE_FILE_READ_FAILED',
                        cause: reader.error,
                    }),
                );
            };
            reader.onload = () => {
                cleanup();
                if (typeof reader.result === 'string' && reader.result.startsWith('data:')) {
                    resolve(reader.result);
                } else {
                    reject(
                        new CoreRuntimeError(
                            '[ImageEditor] Image file reader did not produce a Data URL.',
                            { code: 'IMAGE_FILE_RESULT_INVALID' },
                        ),
                    );
                }
            };
            options.signal?.addEventListener('abort', abort, { once: true });
            reader.readAsDataURL(file);
        });
        await this.loadImage(dataUrl, options);
    }

    /** Serializes the current persistent document state. */
    saveState(): string {
        this.assertReady('save state');
        return this.snapshots.stringify();
    }

    /**
     * Validates, migrates, and transactionally restores serialized document state.
     *
     * @remarks A failed or cancelled restoration leaves the preceding document intact.
     */
    async loadFromState(input: string | unknown, options: LoadStateOptions = {}): Promise<void> {
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
                operationId: coreOperationIds.loadState,
                conflictDomains: DOCUMENT_WIDE_MUTATION_CONFLICT_DOMAINS,
                ...(options.signal ? { signal: options.signal } : {}),
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
            if (!isLoadCancellation(error)) this.reportError(error, 'loadFromState failed.');
            throw error;
        }
    }

    /** Renders the requested export area and returns an encoded Data URL. */
    exportImageBase64(options: CoreExportOptions = {}): Promise<string> {
        return this.runExport(options);
    }

    /** Renders the requested export area and returns a named browser `File`. */
    async exportImageFile(options: CoreExportOptions = {}): Promise<File> {
        const resolved = resolveExportOptions(options, this.options.exportDefaults);
        const dataUrl = await this.runExport(resolved);
        return dataUrlToFile(dataUrl, exportFileName(resolved.fileName, resolved.format));
    }

    /** Reports whether a committed Base Image is available. */
    isImageLoaded(): boolean {
        return this.imageLoaded && this.baseImage !== null;
    }

    /** Returns current Base Image geometry and source metadata, or `null` when absent. */
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

    /**
     * Returns the owned Fabric Canvas after initialization.
     *
     * @remarks Host code must not dispose the returned Canvas.
     */
    getCanvas(): FabricNS.Canvas | null {
        return this.canvas;
    }

    /** Sets the strategy used by future image layout operations. */
    setLayoutMode(mode: LayoutMode): void {
        this.assertNotDisposed('set layout mode');
        if (!isLayoutMode(mode)) {
            throw new TypeError('[ImageEditor] Layout mode must be "fit", "cover", or "expand".');
        }
        this.layoutMode = mode;
        this.viewportCache.clear();
        this.emitRuntimeStatus();
    }

    /** Resizes the Canvas viewport without changing document geometry. */
    resizeCanvas(width: number, height: number): void {
        this.assertReady('resize the Canvas');
        if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
            throw new TypeError('[ImageEditor] Canvas dimensions must be positive finite numbers.');
        }
        this.setCanvasSize(width, height);
        this.canvas?.renderAll();
    }

    /** Resizes the Canvas viewport to its measured container without scaling the document. */
    resizeToContainer(): void {
        this.assertReady('resize the Canvas to its container');
        this.viewportCache.clear();
        const scrollbarSize = measureScrollbarSize(
            this.containerElement?.ownerDocument ?? this.canvasElement?.ownerDocument ?? null,
        );
        const viewport = this.viewportCache.measure(
            this.containerElement,
            { width: this.options.canvasWidth, height: this.options.canvasHeight },
            scrollbarSize,
        );
        const image = this.baseImage;
        if (!image) {
            this.setCanvasSize(viewport.width, viewport.height);
            this.canvas?.renderAll();
            return;
        }
        image.setCoords();
        const bounds = image.getBoundingRect();
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
                Math.max(viewport.width, Math.ceil(bounds.left + bounds.width)),
                Math.max(viewport.height, Math.ceil(bounds.top + bounds.height)),
            );
        }
        this.canvas?.renderAll();
    }

    /**
     * Observes the configured container and schedules responsive viewport resizing.
     *
     * @throws When no container or `ResizeObserver` implementation is available.
     */
    observeContainer(options: ContainerObservationOptions = {}): CoreSubscription {
        this.assertReady('observe the Canvas container');
        const container = this.containerElement;
        if (!container) {
            throw new CoreRuntimeError('[ImageEditor] Canvas container is unavailable.');
        }
        const ownerWindow = container.ownerDocument.defaultView;
        const ResizeObserverConstructor = ownerWindow?.ResizeObserver ?? globalThis.ResizeObserver;
        if (typeof ResizeObserverConstructor !== 'function') {
            throw new CoreRuntimeError('[ImageEditor] ResizeObserver is unavailable.');
        }
        let active = true;
        let frame: number | null = null;
        let scheduled = false;
        const resize = (): void => {
            if (!active || this.isDisposingOrDisposed()) return;
            try {
                this.resizeToContainer();
            } catch (error) {
                this.reportWarning(error, 'Responsive Canvas resize failed.');
            }
        };
        const observer = new ResizeObserverConstructor(() => {
            if (scheduled) return;
            scheduled = true;
            if (ownerWindow?.requestAnimationFrame) {
                frame = ownerWindow.requestAnimationFrame(() => {
                    frame = null;
                    scheduled = false;
                    resize();
                });
            } else {
                queueMicrotask(() => {
                    scheduled = false;
                    resize();
                });
            }
        });
        observer.observe(container);
        if (options.resizeImmediately !== false) resize();
        const subscription: CoreSubscription = Object.freeze({
            dispose: () => {
                if (!active) return;
                active = false;
                this.responsiveSubscriptions.delete(subscription);
                observer.disconnect();
                if (frame !== null && ownerWindow?.cancelAnimationFrame) {
                    ownerWindow.cancelAnimationFrame(frame);
                }
                frame = null;
                scheduled = false;
            },
        });
        this.responsiveSubscriptions.add(subscription);
        return subscription;
    }

    /** Recomputes Base Image geometry with the selected layout strategy as one mutation. */
    async relayout(options: ResponsiveLayoutOptions = {}): Promise<void> {
        this.assertReady('recompute the image layout');
        const mode = options.mode ?? this.layoutMode;
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
            operationId: coreOperationIds.relayout,
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

    /**
     * Rebuilds runtime services after an unrecoverable transactional failure.
     *
     * @throws When the editor is not in the `faulted` lifecycle state.
     */
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

    /**
     * Performs best-effort cleanup of a faulted editor and records cleanup failures.
     *
     * @throws When the editor is not in the `faulted` lifecycle state.
     */
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

    /**
     * Starts best-effort disposal and may return before asynchronous cleanup settles.
     *
     * @deprecated Use `disposeAsync()` to await completion and observe cleanup failures.
     */
    dispose(): void {
        if (this.lifecycle.current === 'disposed' || this.lifecycle.current === 'disposing') return;
        if (
            this.geometry.isRunning ||
            this.documentMutations.isRunning ||
            this.plugins.hasRunningOperations()
        ) {
            this.observeDetachedDisposal(this.disposeAsync());
            return;
        }
        if (!this.lifecycle.beginDisposal()) return;
        this.emitRuntimeStatus();
        const errors: unknown[] = [];
        for (const cleanup of [
            () => this.disposeResponsiveSubscriptions(),
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
        try {
            this.clearRuntimeReferences();
        } catch (error) {
            errors.push(error);
        }
        let canvasDispose: unknown;
        if (canvas) {
            try {
                canvasDispose = canvas.dispose();
            } catch (error) {
                errors.push(error);
            }
        }
        if (canvasDispose && typeof (canvasDispose as PromiseLike<unknown>).then === 'function') {
            const disposal = Promise.resolve(canvasDispose).then(
                () => this.completeDisposal(errors, 'Core disposal'),
                (error: unknown) => {
                    errors.push(error);
                    this.completeDisposal(errors, 'Core disposal');
                },
            );
            this.disposePromise = disposal;
            this.observeDetachedDisposal(disposal);
            return;
        }
        try {
            this.completeDisposal(errors, 'Core disposal');
        } catch (error) {
            this.recordDiagnostic(error, 'Synchronous Core disposal completed with failures.');
            this.reportError(error, 'Synchronous Core disposal completed with failures.');
            throw error;
        }
    }

    /**
     * Aborts active work, disposes Plugins and Canvas resources, and awaits cleanup completion.
     *
     * @remarks Repeated calls return the same in-flight disposal promise.
     */
    disposeAsync(): Promise<void> {
        if (this.disposePromise) return this.disposePromise;
        if (this.lifecycle.current === 'disposed') return Promise.resolve();
        if (!this.lifecycle.beginDisposal()) return this.disposePromise ?? Promise.resolve();
        this.emitRuntimeStatus();
        this.disposePromise = this.performDisposeAsync();
        return this.disposePromise;
    }

    private async performEmergencyReset(): Promise<void> {
        const failures: unknown[] = [];
        const abortReason = new DOMException(
            'Core emergency reset aborted active work.',
            'AbortError',
        );
        await this.runEmergencyStep(
            failures,
            'Responsive subscription cleanup failed during emergency reset.',
            () => this.disposeResponsiveSubscriptions(),
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
        this.emitRuntimeStatus();
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
        this.emitRuntimeStatus();
        const cleanupSteps: ReadonlyArray<readonly [string, () => void | Promise<void>]> = [
            [
                'Responsive subscription cleanup failed after emergency reset.',
                () => this.disposeResponsiveSubscriptions(),
            ],
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
        this.clearPluginApiHandles();
        this.emitRuntimeStatus();
        this.statusListeners.clear();
    }

    private createPluginManager(): PluginManager<CoreEventMap> {
        const manager = new PluginManager<CoreEventMap>({
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
            id: coreOperationIds.loadImage,
            mode: 'busy',
            conflictDomains: ['image-decode'],
            reentrancy: 'replace',
        });
        manager.registerHostOperation({
            id: coreOperationIds.commitLoadImage,
            mode: 'mutation',
            conflictDomains: DOCUMENT_WIDE_MUTATION_CONFLICT_DOMAINS,
            reentrancy: 'queue',
        });
        manager.registerHostOperation({
            id: coreOperationIds.loadState,
            mode: 'mutation',
            conflictDomains: DOCUMENT_WIDE_MUTATION_CONFLICT_DOMAINS,
            reentrancy: 'reject',
        });
        manager.registerHostOperation({
            id: coreOperationIds.export,
            mode: 'read',
            conflictDomains: ['document', 'base-image', 'overlay', 'export', 'state'],
            reentrancy: 'queue',
        });
        manager.registerHostOperation({
            id: coreOperationIds.relayout,
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

    private async rollbackInitialization(
        failure: unknown,
        pluginInitializationStarted: boolean,
        pluginInitializationCompleted: boolean,
    ): Promise<readonly unknown[]> {
        const cleanupErrors = this.getInitializationCleanupErrors(failure);
        const canvas = this.canvas;
        if (pluginInitializationCompleted) {
            try {
                await this.plugins.dispose();
            } catch (error) {
                cleanupErrors.push(error);
            }
        }
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
                manager.installSync(
                    planned.definition as SynchronousEditorPlugin<unknown, CoreEventMap>,
                );
            }
            const replayedApis = new Map<string, object | ((...args: unknown[]) => unknown)>();
            for (const pluginId of this.pluginApiHandles.keys()) {
                const api = manager.getById(pluginId);
                if (!isProxyablePluginApi(api)) {
                    throw new CoreRuntimeError(
                        `[ImageEditor] Replayed Plugin "${pluginId}" did not return a stable object API.`,
                        { code: 'PLUGIN_API_REPLAY_INCOMPATIBLE', behavior: 'lifecycle' },
                    );
                }
                replayedApis.set(pluginId, api);
            }
            for (const [pluginId, api] of replayedApis) {
                this.pluginApiHandles.get(pluginId)?.handle.assertCompatible(api);
            }
            for (const [pluginId, api] of replayedApis) {
                this.pluginApiHandles.get(pluginId)?.handle.update(api);
            }
        } catch (error) {
            await manager.dispose().catch(() => undefined);
            throw error;
        }
        this.plugins = manager;
    }

    private publishPluginApi<TApi>(pluginId: string, api: TApi): TApi {
        if (!isProxyablePluginApi(api)) return api;
        const existing = this.pluginApiHandles.get(pluginId);
        if (existing) {
            existing.handle.update(api);
            return existing.handle.api as TApi;
        }
        const lifecycle = this.lifecycle;
        const handle = new StablePluginApiHandle(pluginId, api, (operation) => {
            if (lifecycle.current !== 'disposing') lifecycle.assertAvailable(operation);
        });
        this.pluginApiHandles.set(pluginId, Object.freeze({ handle }));
        return handle.api as TApi;
    }

    private clearPluginApiHandles(): void {
        for (const { handle } of this.pluginApiHandles.values()) handle.clear();
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
        const resolveLayoutMode = (): LayoutMode => this.layoutMode;
        return Object.freeze({
            backgroundColor: this.options.backgroundColor,
            get layoutMode() {
                return resolveLayoutMode();
            },
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
        // Fabric clears both backing stores when setDimensions changes the canvas size. Render the
        // finalized scene synchronously so the browser cannot paint that cleared state before the
        // requestRenderAll callback scheduled by Fabric runs on the next animation frame.
        canvas.renderAll();
    }

    private setCanvasSize(width: number, height: number): void {
        if (!this.canvas) return;
        const nextWidth = Math.max(1, Math.ceil(width));
        const nextHeight = Math.max(1, Math.ceil(height));
        this.assertRasterBudget(nextWidth, nextHeight);
        applyCanvasDimensions(this.canvas, nextWidth, nextHeight, this.containerElement);
    }

    private isInputRasterWithinBudget(width: number, height: number): boolean {
        return isRasterAllocationWithinBudget(width, height, {
            maxDimension: this.options.maxExportDimension,
            maxPixels: Math.min(this.options.maxInputPixels, this.options.maxExportPixels),
        });
    }

    private assertRasterBudget(width: number, height: number, multiplier = 1): void {
        if (
            !isRasterAllocationWithinBudget(
                width,
                height,
                {
                    maxDimension: this.options.maxExportDimension,
                    maxPixels: this.options.maxExportPixels,
                },
                multiplier,
            )
        ) {
            throw new CoreRuntimeError('[ImageEditor] Dimensions exceed the configured budget.');
        }
    }

    private async runExport(options: CoreExportOptions): Promise<string> {
        this.assertReady('export an image');
        const resolved = resolveExportOptions(options, this.options.exportDefaults);
        const operation = this.plugins.beginOperationForHost(coreOperationIds.export);
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
            descriptor.operationId === coreOperationIds.commitLoadImage &&
            isCoreImageInfo(descriptor.result)
        ) {
            await this.plugins?.emitCommitted('image:loaded', descriptor.result);
            return;
        }
        if (descriptor.operationId === coreOperationIds.loadState) {
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

    private requireCanvasForImageLoad(operation: string): FabricNS.Canvas {
        if (!this.initialImageLoadActive || this.lifecycle.current !== 'initializing') {
            return this.requireCanvas(operation);
        }
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

    private emitRuntimeStatus(): void {
        if (this.statusListeners.size === 0) return;
        const status = this.getRuntimeStatus();
        const previous = this.lastRuntimeStatus;
        if (
            previous &&
            previous.lifecycle === status.lifecycle &&
            previous.initialized === status.initialized &&
            previous.imageLoaded === status.imageLoaded &&
            previous.busy === status.busy &&
            previous.activeToolId === status.activeToolId &&
            previous.layoutMode === status.layoutMode &&
            previous.geometryRevision === status.geometryRevision
        ) {
            return;
        }
        this.lastRuntimeStatus = status;
        for (const listener of [...this.statusListeners]) {
            this.invokeStatusListener(listener, status);
        }
    }

    private invokeStatusListener(listener: CoreStatusListener, status: CoreRuntimeStatus): void {
        try {
            listener(status);
        } catch (error) {
            this.reportWarning(error, 'Runtime status listener failed.');
        }
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
        this.emitRuntimeStatus();
    }

    private recordDiagnostic(error: unknown, message?: string): CoreDiagnostic {
        const classification = classifyCoreError(error);
        let errorCode: unknown;
        if (error && typeof error === 'object') {
            try {
                errorCode = Reflect.get(error, 'code');
            } catch {
                errorCode = undefined;
            }
        }
        const code = typeof errorCode === 'string' ? errorCode : 'UNCLASSIFIED_CORE_ERROR';
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
        if (this.diagnostics.length > MAX_RETAINED_DIAGNOSTICS) {
            this.diagnostics.splice(0, this.diagnostics.length - MAX_RETAINED_DIAGNOSTICS);
        }
        return diagnostic;
    }

    private assertReady(operation: string): void {
        this.lifecycle.assertOperational(operation);
        if (!this.canvas)
            throw new CoreRuntimeError(`[ImageEditor] Cannot ${operation} without Canvas.`);
    }

    private assertDocumentMutationOperational(operation: string): void {
        if (this.initialImageLoadActive && this.lifecycle.current === 'initializing') return;
        this.lifecycle.assertOperational(operation);
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
            () => this.disposeResponsiveSubscriptions(),
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
            } catch (error) {
                errors.push(error);
            }
        }
        const canvas = this.canvas;
        try {
            this.clearRuntimeReferences();
        } catch (error) {
            errors.push(error);
        }
        if (canvas) {
            try {
                await canvas.dispose();
            } catch (error) {
                errors.push(error);
            }
        }
        this.completeDisposal(errors, 'Async disposal');
    }

    private completeDisposal(errors: unknown[], label: string): void {
        this.lifecycle.completeDisposal();
        this.clearPluginApiHandles();
        this.emitRuntimeStatus();
        this.statusListeners.clear();
        if (errors.length > 0) {
            throw new CoreRuntimeError(
                `[ImageEditor] ${label} completed with ${errors.length} cleanup error(s).`,
                { code: 'CORE_DISPOSE_ERROR', cause: Object.freeze(errors) },
            );
        }
    }

    private disposeResponsiveSubscriptions(): void {
        for (const subscription of [...this.responsiveSubscriptions]) subscription.dispose();
        this.responsiveSubscriptions.clear();
    }

    private observeDetachedDisposal(disposal: Promise<void>): void {
        void disposal.catch((error: unknown) => {
            this.recordDiagnostic(error, 'Detached Core disposal completed with cleanup failures.');
            this.reportError(error, 'Detached Core disposal completed with cleanup failures.');
        });
    }
}
