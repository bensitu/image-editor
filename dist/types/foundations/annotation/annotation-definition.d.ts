/**
 * Declares Annotation Foundation feature, authoring, query, status, and Plugin API contracts.
 *
 * @module
 */
import type * as FabricNS from 'fabric';
import type { GeometryMutationDescriptor, OverlayListOrder } from '../../core/index.js';
import type { Disposable, MaybePromise } from '../../sdk/index.js';
import type { FlattenOptions, OverlayExportRenderContext, OverlaySerializerContext, OverlayStateKindCodec } from '../overlay/index.js';
/** Persistent identifier assigned to an Annotation. */
export type AnnotationId = string;
/** Recursive JSON-compatible metadata object stored with an Annotation. */
export interface AnnotationMetadataObject {
    readonly [key: string]: AnnotationMetadataValue;
}
/** JSON-compatible value accepted in Annotation metadata. */
export type AnnotationMetadataValue = null | boolean | number | string | readonly AnnotationMetadataValue[] | AnnotationMetadataObject;
/** Metadata record stored with an Annotation. */
export type AnnotationMetadata = AnnotationMetadataObject;
/** Immutable host-facing description of one Annotation. */
export interface AnnotationDescriptor {
    readonly id: AnnotationId;
    readonly kind: string;
    readonly name: string;
    readonly hidden: boolean;
    readonly locked: boolean;
    readonly selected: boolean;
    readonly layerIndex: number;
    readonly metadata: AnnotationMetadata;
}
/** Filters Annotation operations by kind, identity, visibility, and locking. */
export interface AnnotationQuery {
    readonly kinds?: readonly string[];
    readonly ids?: readonly AnnotationId[];
    readonly includeHidden?: boolean;
    readonly includeLocked?: boolean;
}
/** Filters accepted by `removeAll`, plus an explicit locked-object override. */
export interface AnnotationRemoveAllOptions extends AnnotationQuery {
    /** Remove matching locked Annotations as well. @defaultValue `false` */
    readonly force?: boolean;
}
/** Shared metadata and presentation changes supported by every Annotation kind. */
export interface AnnotationUpdate {
    readonly name?: string;
    readonly metadata?: AnnotationMetadata;
    readonly hidden?: boolean;
    readonly locked?: boolean;
}
/** Raster encoding settings used when flattening Annotations. */
export type AnnotationFlattenOptions = FlattenOptions;
/** Observable Annotation list and selection state. */
export interface AnnotationStatus {
    readonly annotations: readonly AnnotationDescriptor[];
    readonly selectionIds: readonly AnnotationId[];
}
/** Listener invoked after committed Annotation or selection changes. */
export type AnnotationStatusListener = (status: AnnotationStatus) => void;
/** Public Annotation query, mutation, selection, layer, and flattening operations. */
export interface AnnotationPluginApi {
    /** Lists matching Annotations in the configured order. */
    list(query?: AnnotationQuery): readonly AnnotationDescriptor[];
    /** Returns one Annotation description, or `null` when unavailable. */
    get(id: AnnotationId): AnnotationDescriptor | null;
    /** Applies shared metadata or presentation changes transactionally. */
    update(id: AnnotationId, patch: AnnotationUpdate): Promise<void>;
    /** Removes one unlocked Annotation. */
    remove(id: AnnotationId): Promise<void>;
    /** Removes matching Annotations while preserving locked objects unless forced. */
    removeAll(options?: AnnotationRemoveAllOptions): Promise<void>;
    /** Selects available Annotations without changing persistent layer order. */
    select(ids: readonly AnnotationId[]): Promise<void>;
    /** Clears Annotation selection. */
    clearSelection(): Promise<void>;
    /** Moves an Annotation one persistent layer toward the front. */
    bringForward(id: AnnotationId): Promise<void>;
    /** Moves an Annotation one persistent layer toward the back. */
    sendBackward(id: AnnotationId): Promise<void>;
    /** Moves an Annotation to the front of the persistent layer stack. */
    bringToFront(id: AnnotationId): Promise<void>;
    /** Moves an Annotation to the back of the persistent layer stack. */
    sendToBack(id: AnnotationId): Promise<void>;
    /** Bakes matching Annotations into the Base Image and removes their live objects. */
    flatten(query?: AnnotationQuery, options?: AnnotationFlattenOptions): Promise<void>;
    /** Subscribes to Annotation list and selection changes. */
    subscribe(listener: AnnotationStatusListener): Disposable;
}
/** Serializes and restores feature-specific Annotation data. */
export interface AnnotationFeatureCodec<TData = unknown> {
    readonly type: string;
    readonly version: string;
    serialize(object: FabricNS.FabricObject): TData;
    validate(data: unknown): data is TData;
    deserialize(data: TData, context: OverlaySerializerContext): MaybePromise<FabricNS.FabricObject>;
}
/** Registers one Annotation kind with classification, state, update, and export behavior. */
export interface AnnotationFeatureDefinition<TUpdate = unknown> {
    readonly kind: `annotation:${string}`;
    readonly ownerPluginId: string;
    classify(object: FabricNS.FabricObject): boolean;
    readonly codec: AnnotationFeatureCodec;
    readonly stateCodec?: OverlayStateKindCodec;
    normalizeUpdate?(patch: unknown): TUpdate;
    hasUpdate?(object: FabricNS.FabricObject, patch: TUpdate): boolean;
    applyUpdate?(object: FabricNS.FabricObject, patch: TUpdate): void;
    bindToImageTransform?(): boolean;
    preserveReadable?(): boolean;
    /** Overrides the Foundation export default for this Annotation kind. */
    readonly exportByDefault?: boolean;
    synchronize?(object: FabricNS.FabricObject): void;
    render?(context: OverlayExportRenderContext): MaybePromise<void>;
}
/** Describes one transactional Annotation creation. */
export interface AnnotationCreateRequest {
    readonly kind: `annotation:${string}`;
    readonly object: FabricNS.FabricObject;
    readonly name: string;
    readonly metadata?: AnnotationMetadata;
    readonly hidden?: boolean;
    readonly locked?: boolean;
    readonly select?: boolean;
    readonly operationId: string;
}
/** Describes one feature-specific Annotation update. */
export interface AnnotationFeatureUpdateRequest<TUpdate = unknown> {
    readonly id: AnnotationId;
    readonly kind: `annotation:${string}`;
    readonly patch: TUpdate;
    readonly shared?: AnnotationUpdate;
    readonly operationId: string;
}
/** Describes one feature-owned Annotation removal. */
export interface AnnotationFeatureRemoveRequest {
    readonly ids: readonly AnnotationId[];
    readonly kind?: `annotation:${string}`;
    readonly operationId: string;
}
/** Describes one transient Annotation preview object. */
export interface AnnotationPreviewRequest {
    readonly id: string;
    readonly ownerKind: `annotation:${string}`;
    readonly object: FabricNS.FabricObject;
    readonly interactive?: boolean;
    readonly select?: boolean;
}
/** Authoring operations supplied to Annotation feature Plugins. */
export interface AnnotationAuthoringPort {
    /** Registers one feature definition until the returned handle is disposed. */
    registerFeature<TUpdate>(definition: AnnotationFeatureDefinition<TUpdate>): Disposable;
    /** Creates one persistent Annotation as a committed mutation. */
    create(request: AnnotationCreateRequest): Promise<AnnotationId>;
    /** Applies a feature-specific update as a committed mutation. */
    updateFeature<TUpdate>(request: AnnotationFeatureUpdateRequest<TUpdate>): Promise<void>;
    /** Removes feature-owned Annotations as one committed mutation. */
    removeFeatures(request: AnnotationFeatureRemoveRequest): Promise<void>;
    /** Resolves the live object for an Annotation identity and optional kind. */
    getObject(id: AnnotationId, kind?: `annotation:${string}`): FabricNS.FabricObject | null;
    /** Lists live objects owned by one Annotation kind. */
    listObjects(kind: `annotation:${string}`): readonly FabricNS.FabricObject[];
    /** Adds one transient preview object. */
    addPreview(request: AnnotationPreviewRequest): void;
    /** Atomically replaces transient previews. */
    replacePreview(previousIds: readonly string[], request: AnnotationPreviewRequest): void;
    /** Removes transient previews by identifier. */
    removePreview(ids: readonly string[]): void;
    /** Temporarily hides persistent Annotations until the returned handle is disposed. */
    hideForPreview(ids: readonly AnnotationId[]): Disposable;
    /** Applies a Base Image geometry mutation to one Annotation object. */
    applyGeometry(object: FabricNS.FabricObject, mutation: GeometryMutationDescriptor, preserveReadable: boolean): void;
}
/** Configures Annotation limits, ordering, export, and Canvas presentation. */
export interface AnnotationFoundationOptions {
    /** Maximum number of persistent Annotations allowed in one document. */
    readonly maxAnnotationCount?: number;
    /** Whether registered Annotation kinds participate in exports by default. */
    readonly exportByDefault?: boolean;
    /** Temporary style applied while the pointer is over an unlocked Annotation. */
    readonly hoverStyle?: AnnotationHoverStyle | false;
    /** Fabric selection-control appearance applied to each Annotation. */
    readonly controlStyle?: AnnotationControlStyle;
    /** Optional transient label presentation. Labels never enter state or exports. */
    readonly label?: AnnotationLabelConfig | false;
    /** Transient lock indicator presentation. @defaultValue enabled */
    readonly lockIndicator?: AnnotationLockIndicatorConfig | false;
    /**
     * Ordering used by `AnnotationPluginApi.list()`.
     *
     * `front-to-back` returns the topmost Annotation first. `back-to-front` follows Fabric's
     * bottom-to-top Canvas order.
     *
     * @defaultValue `'front-to-back'`
     */
    readonly listOrder?: OverlayListOrder;
}
/** Temporary appearance applied while an unlocked Annotation is hovered. */
export interface AnnotationHoverStyle {
    readonly fill?: string | null;
    readonly opacity?: number;
    readonly stroke?: string | null;
    readonly strokeWidth?: number;
}
/** Fabric selection-control appearance applied to Annotation objects. */
export interface AnnotationControlStyle {
    readonly borderColor?: string;
    readonly cornerColor?: string;
    readonly cornerStrokeColor?: string;
    readonly cornerSize?: number;
    readonly touchCornerSize?: number;
    readonly transparentCorners?: boolean;
    readonly padding?: number;
}
/** Transient Annotation label presentation. */
export interface AnnotationLabelConfig {
    /** Selective labels are shown only while their Annotation is selected. */
    readonly showOn?: 'selected' | 'always';
    readonly offset?: number;
    readonly getText?: (annotation: AnnotationDescriptor) => string;
    readonly textOptions?: Partial<FabricNS.TextProps>;
}
/** Transient indicator presentation for locked Annotation objects. */
export interface AnnotationLockIndicatorConfig {
    readonly size?: number;
    readonly offset?: number;
    readonly backgroundColor?: string;
    readonly iconColor?: string;
}
