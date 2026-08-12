/**
 * Declares Overlay registration, persistence, mutation, interaction, export, and runtime API contracts.
 *
 * @module
 */

import type * as FabricNS from 'fabric';

import type {
    CoreExportOptions,
    DocumentMutationContext,
    FabricModule,
    GeometryMutationDescriptor,
} from '../../core/index.js';
import type { Disposable, MaybePromise } from '../../sdk/index.js';

/** Stable identity, ownership, and visibility classification for an Overlay object. */
export interface OverlayClassification {
    readonly kind: string;
    readonly persistentId: string;
    readonly ownerPluginId: string;
    readonly hidden: boolean;
    readonly locked: boolean;
}

/** Filters Overlay reads and mutations by kind, identity, and presentation state. */
export interface OverlayQuery {
    readonly kinds?: readonly string[];
    readonly ids?: readonly string[];
    readonly includeHidden?: boolean;
    readonly includeLocked?: boolean;
}

/** Registers classification, persistence, export, and state behavior for one Overlay kind. */
export interface OverlayKindDefinition {
    readonly id: string;
    readonly ownerPluginId: string;
    classify(object: FabricNS.FabricObject): boolean;
    getPersistentId(object: FabricNS.FabricObject): string | null;
    setPersistentId?(object: FabricNS.FabricObject, id: string): void;
    isHidden?(object: FabricNS.FabricObject): boolean;
    setHidden?(object: FabricNS.FabricObject, hidden: boolean): void;
    isLocked?(object: FabricNS.FabricObject): boolean;
    setLocked?(object: FabricNS.FabricObject, locked: boolean): void;
    /**
     * Whether objects of this kind participate in export when `includeKinds` is not supplied.
     * An explicit `includeKinds` entry enables the kind for that export call.
     *
     * @defaultValue `true`
     */
    readonly exportByDefault?: boolean;
    readonly exportOrder?: number;
    readonly persistence: OverlayPersistenceDefinition;
    readonly stateCodec?: OverlayStateKindCodec;
}

/** Applies committed Base Image geometry mutations to one Overlay kind. */
export interface OverlayGeometryPolicy {
    readonly id: string;
    readonly kind: string;
    readonly ownerPluginId: string;
    readonly preserveReadable?: boolean;
    supports?(mutation: GeometryMutationDescriptor): boolean;
    prepare?(mutation: GeometryMutationDescriptor): MaybePromise<void>;
    apply?(object: FabricNS.FabricObject, mutation: GeometryMutationDescriptor): MaybePromise<void>;
    synchronize?(mutation: GeometryMutationDescriptor): MaybePromise<void>;
}

/** Renderer-neutral persistent record produced by an Overlay codec. */
export interface SerializedOverlayRecord {
    readonly kind: string;
    readonly persistentId: string;
    readonly hidden: boolean;
    readonly locked: boolean;
    readonly codec: Readonly<{ type: string; version: string }>;
    readonly data: unknown;
}

/** Dependencies available while deserializing persistent Overlay records. */
export interface OverlaySerializerContext {
    readonly fabric: FabricModule;
}

/** Two-dimensional coordinate used by Overlay state codecs. */
export interface OverlayStatePoint {
    readonly x: number;
    readonly y: number;
}

/** Base Image dimensions and MIME context used by Overlay state codecs. */
export interface OverlayStateImageContext {
    readonly naturalWidth: number;
    readonly naturalHeight: number;
    readonly mimeType: 'image/jpeg' | 'image/png' | 'image/webp' | null;
}

/** Converts between Canvas and normalized Base Image coordinates. */
export interface OverlayStateCodecContext {
    readonly image: OverlayStateImageContext;
    toImageNormalized(point: OverlayStatePoint): OverlayStatePoint;
    toCanvasPoint(point: OverlayStatePoint): OverlayStatePoint;
    toImageNormalizedScalar(value: number): number;
    toCanvasScalar(value: number): number;
}

/** Geometry, feature data, and metadata emitted by an Overlay state codec. */
export interface OverlayStateCodecValue {
    readonly geometry: unknown;
    readonly data: unknown;
    readonly metadata?: Readonly<Record<string, unknown>>;
}

/** Validates and converts one Overlay kind to and from portable state. */
export interface OverlayStateKindCodec<
    TObject extends FabricNS.FabricObject = FabricNS.FabricObject,
> {
    readonly type: string;
    readonly version: string;
    serialize(object: TObject, context: OverlayStateCodecContext): OverlayStateCodecValue;
    validate(value: OverlayStateCodecValue): boolean;
    deserialize(
        value: OverlayStateCodecValue,
        context: OverlayStateCodecContext,
    ): MaybePromise<TObject>;
}

/** State capabilities exposed for a registered Overlay kind. */
export interface OverlayStateKindAdapter {
    readonly persistence: Readonly<{ readonly mode: 'transient' | 'persistent' }>;
    readonly stateCodec?: OverlayStateKindCodec;
    classify(object: FabricNS.FabricObject): boolean;
    setPersistentId?(object: FabricNS.FabricObject, id: string): void;
    setHidden?(object: FabricNS.FabricObject, hidden: boolean): void;
    setLocked?(object: FabricNS.FabricObject, locked: boolean): void;
}

/** Validates and converts a persistent Fabric object representation. */
export interface FabricObjectCodec<
    TObject extends FabricNS.FabricObject = FabricNS.FabricObject,
    TData = unknown,
> {
    readonly type: string;
    readonly version: string;
    serialize(object: TObject): TData;
    validate(data: unknown): boolean;
    deserialize(data: TData, context: OverlaySerializerContext): MaybePromise<TObject>;
}

/** Selects transient or codec-backed persistence for an Overlay kind. */
export type OverlayPersistenceDefinition =
    | Readonly<{ mode: 'transient' }>
    | Readonly<{
          mode: 'persistent';
          codec: FabricObjectCodec;
      }>;

/** Selects Overlay kinds and visibility for an export. */
export interface OverlayExportOptions {
    readonly includeKinds?: readonly string[];
    readonly excludeKinds?: readonly string[];
    readonly includeHidden?: boolean;
}

/** Immutable source, target, and export options supplied to an Overlay renderer. */
export interface OverlayExportRenderContext {
    readonly source: FabricNS.FabricObject;
    readonly targetCanvas: FabricNS.StaticCanvas;
    readonly options: Readonly<CoreExportOptions>;
}

/** Renders one Overlay kind into an isolated export Canvas. */
export interface OverlayExportRenderer {
    readonly id: string;
    readonly kind: string;
    readonly ownerPluginId: string;
    readonly order: number;
    render(context: OverlayExportRenderContext): MaybePromise<void>;
}

/** Immutable persistent-id view of the current Canvas selection. */
export interface OverlaySelectionState {
    readonly ids: readonly string[];
    readonly primaryId: string | null;
    readonly kinds: readonly string[];
}

/** Semantic action attached to an Overlay mutation. */
export type OverlayMutationAction =
    | 'move'
    | 'scale'
    | 'rotate'
    | 'create'
    | 'delete'
    | 'visibility'
    | 'locking'
    | 'layer'
    | 'programmatic'
    | (string & {});

/** Public description of a committed Overlay mutation. */
export interface OverlayMutationDescriptor {
    readonly id: string;
    readonly operationId: string;
    readonly action: OverlayMutationAction;
    readonly objectIds: readonly string[];
    readonly objectKinds: readonly string[];
    readonly metadata: Readonly<Record<string, unknown>>;
}

/** Transaction and affected identity context available during an Overlay mutation. */
export interface OverlayMutationContext {
    readonly transaction: DocumentMutationContext;
    readonly action: OverlayMutationAction;
    readonly objectIds: readonly string[];
}

/** Lifecycle context supplied to interactive Overlay policies. */
export interface OverlayInteractionContext extends OverlayMutationContext {
    readonly descriptor: OverlayMutationDescriptor;
    readonly phase: 'preview' | 'synchronize' | 'validate';
}

/** Synchronizes, validates, or previews interactive changes for one Overlay kind. */
export interface OverlayInteractionPolicy {
    readonly id: string;
    readonly kind: string;
    readonly ownerPluginId: string;
    preview?(object: FabricNS.FabricObject, context: OverlayInteractionContext): MaybePromise<void>;
    synchronize?(
        object: FabricNS.FabricObject,
        context: OverlayInteractionContext,
    ): MaybePromise<void>;
    validate?(
        object: FabricNS.FabricObject,
        context: OverlayInteractionContext,
    ): MaybePromise<void>;
}

/** Defines one transactional Overlay mutation and its post-mutation policies. */
export interface OverlayMutationRequest<TResult = void> {
    readonly id: string;
    readonly operationId: string;
    readonly action: OverlayMutationAction;
    readonly objectIds?: readonly string[];
    readonly metadata?: Readonly<Record<string, unknown>>;
    readonly parent?: DocumentMutationContext;
    mutate(context: OverlayMutationContext): MaybePromise<TResult>;
    affectedObjects?(
        result: TResult,
        context: OverlayMutationContext,
    ): MaybePromise<readonly FabricNS.FabricObject[]>;
    synchronize?(result: TResult, context: OverlayMutationContext): MaybePromise<void>;
    validate?(result: TResult, context: OverlayMutationContext): MaybePromise<void>;
}

/** Transactional write operations supplied by the Overlay Foundation. */
export interface OverlayMutationPort {
    /** Executes a fully described Overlay mutation. */
    mutate<TResult>(request: OverlayMutationRequest<TResult>): Promise<TResult>;
    /** Adds persistent objects as one committed mutation. */
    add(objects: readonly FabricNS.FabricObject[]): Promise<void>;
    /** Adds objects excluded from persistence, History, and export. */
    addTransient(objects: readonly FabricNS.FabricObject[]): Promise<void>;
    /** Atomically replaces transient objects identified by persistent or preview identifiers. */
    replaceTransient(
        ids: readonly string[],
        objects: readonly FabricNS.FabricObject[],
    ): Promise<void>;
    /** Removes persistent objects by identifier as one committed mutation. */
    remove(ids: readonly string[]): Promise<void>;
    /** Removes transient objects without creating document History. */
    removeTransient(ids: readonly string[]): Promise<void>;
    /** Cancels an active Canvas transform and restores its preceding state. */
    cancelActiveGesture(reason?: unknown): Promise<void>;
    /** Resolves after active Overlay mutation and gesture work settles. */
    waitForIdle(): Promise<void>;
}

/** Encoder settings used when flattening Overlays into the Base Image. */
export interface FlattenOptions {
    readonly format?: 'png' | 'jpeg' | 'webp';
    readonly quality?: number;
}

/** Rasterizes matching Overlays into the Base Image. */
export interface OverlayFlattenPort {
    /** Flattens matching Overlays and removes their live objects transactionally. */
    flatten(query?: OverlayQuery, options?: FlattenOptions): Promise<void>;
}

/** Read-only Overlay classification and state-kind lookup operations. */
export interface OverlayPort {
    /** Lists matching persistent Overlay objects in Canvas layer order. */
    list(query?: OverlayQuery): readonly FabricNS.FabricObject[];
    /** Resolves one persistent Overlay object by identity. */
    getByPersistentId(id: string): FabricNS.FabricObject | null;
    /** Classifies an object through registered Overlay kind definitions. */
    classify(object: FabricNS.FabricObject): OverlayClassification | null;
    /** Returns the registered state adapter for a kind, or `null` when unavailable. */
    getStateKind(kind: string): OverlayStateKindAdapter | null;
}

/** Registration operations used by Overlay-producing Plugins. */
export interface OverlayRegistrationPort {
    /** Registers one Overlay kind until the returned handle is disposed. */
    registerKind(definition: OverlayKindDefinition): Disposable;
    /** Registers one geometry policy until the returned handle is disposed. */
    registerGeometryPolicy(policy: OverlayGeometryPolicy): Disposable;
    /** Registers one interaction policy until the returned handle is disposed. */
    registerInteractionPolicy(policy: OverlayInteractionPolicy): Disposable;
    /** Registers one export renderer until the returned handle is disposed. */
    registerExportRenderer(renderer: OverlayExportRenderer): Disposable;
}

/** Host and Plugin operations exposed by the active Overlay Foundation. */
export interface OverlayRuntimeApi extends OverlayPort, OverlayFlattenPort, OverlayMutationPort {
    /** Returns an immutable persistent-id view of the current selection. */
    getSelection(): OverlaySelectionState;
    /** Selects available Overlay objects without changing persistent layer order. */
    select(ids: readonly string[]): void;
    /** Clears the current Canvas selection. */
    discardSelection(): void;
    /** Subscribes to selection changes. */
    onSelectionChange(listener: (state: OverlaySelectionState) => void): Disposable;
    /** Temporarily hides matching Overlays until the returned handle is disposed. */
    hideForPreview(ids: readonly string[]): Disposable;
    /** Commits one Overlay visibility change. */
    setHidden(id: string, hidden: boolean): Promise<void>;
    /** Commits one Overlay locking change. */
    setLocked(id: string, locked: boolean): Promise<void>;
    /** Moves an Overlay one persistent layer toward the front. */
    bringForward(id: string): Promise<void>;
    /** Moves an Overlay one persistent layer toward the back. */
    sendBackward(id: string): Promise<void>;
    /** Moves an Overlay to the front of the persistent layer stack. */
    bringToFront(id: string): Promise<void>;
    /** Moves an Overlay to the back of the persistent layer stack. */
    sendToBack(id: string): Promise<void>;
}

/** Complete read, mutation, selection, flattening, and registration API for Overlays. */
export interface OverlayFoundationApi extends OverlayRuntimeApi, OverlayRegistrationPort {}
