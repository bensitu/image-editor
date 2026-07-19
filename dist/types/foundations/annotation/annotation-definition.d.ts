/**
 * Declares Annotation Foundation feature, authoring, query, status, and Plugin API contracts.
 *
 * @module
 */
import type * as FabricNS from 'fabric';
import type { GeometryMutationDescriptor } from '../../core/index.js';
import type { Disposable, MaybePromise } from '../../sdk/index.js';
import type { FlattenOptions, OverlayExportRenderContext, OverlaySerializerContext, OverlayStateKindCodec } from '../overlay/index.js';
export type AnnotationId = string;
export interface AnnotationMetadataObject {
    readonly [key: string]: AnnotationMetadataValue;
}
export type AnnotationMetadataValue = null | boolean | number | string | readonly AnnotationMetadataValue[] | AnnotationMetadataObject;
export type AnnotationMetadata = AnnotationMetadataObject;
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
export interface AnnotationQuery {
    readonly kinds?: readonly string[];
    readonly ids?: readonly AnnotationId[];
    readonly includeHidden?: boolean;
    readonly includeLocked?: boolean;
}
export interface AnnotationUpdate {
    readonly name?: string;
    readonly metadata?: AnnotationMetadata;
    readonly hidden?: boolean;
    readonly locked?: boolean;
}
export type AnnotationFlattenOptions = FlattenOptions;
export interface AnnotationStatus {
    readonly annotations: readonly AnnotationDescriptor[];
    readonly selectionIds: readonly AnnotationId[];
}
export type AnnotationStatusListener = (status: AnnotationStatus) => void;
export interface AnnotationPluginApi {
    list(query?: AnnotationQuery): readonly AnnotationDescriptor[];
    get(id: AnnotationId): AnnotationDescriptor | null;
    update(id: AnnotationId, patch: AnnotationUpdate): Promise<void>;
    remove(id: AnnotationId): Promise<void>;
    removeAll(query?: AnnotationQuery): Promise<void>;
    select(ids: readonly AnnotationId[]): Promise<void>;
    clearSelection(): Promise<void>;
    bringForward(id: AnnotationId): Promise<void>;
    sendBackward(id: AnnotationId): Promise<void>;
    bringToFront(id: AnnotationId): Promise<void>;
    sendToBack(id: AnnotationId): Promise<void>;
    flatten(query?: AnnotationQuery, options?: AnnotationFlattenOptions): Promise<void>;
    subscribe(listener: AnnotationStatusListener): Disposable;
}
export interface AnnotationFeatureCodec<TData = unknown> {
    readonly type: string;
    readonly version: string;
    serialize(object: FabricNS.FabricObject): TData;
    validate(data: unknown): data is TData;
    deserialize(data: TData, context: OverlaySerializerContext): MaybePromise<FabricNS.FabricObject>;
}
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
    synchronize?(object: FabricNS.FabricObject): void;
    render?(context: OverlayExportRenderContext): MaybePromise<void>;
}
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
export interface AnnotationFeatureUpdateRequest<TUpdate = unknown> {
    readonly id: AnnotationId;
    readonly kind: `annotation:${string}`;
    readonly patch: TUpdate;
    readonly shared?: AnnotationUpdate;
    readonly operationId: string;
}
export interface AnnotationFeatureRemoveRequest {
    readonly ids: readonly AnnotationId[];
    readonly kind?: `annotation:${string}`;
    readonly operationId: string;
}
export interface AnnotationPreviewRequest {
    readonly id: string;
    readonly ownerKind: `annotation:${string}`;
    readonly object: FabricNS.FabricObject;
    readonly interactive?: boolean;
    readonly select?: boolean;
}
export interface AnnotationAuthoringPort {
    registerFeature<TUpdate>(definition: AnnotationFeatureDefinition<TUpdate>): Disposable;
    create(request: AnnotationCreateRequest): Promise<AnnotationId>;
    updateFeature<TUpdate>(request: AnnotationFeatureUpdateRequest<TUpdate>): Promise<void>;
    removeFeatures(request: AnnotationFeatureRemoveRequest): Promise<void>;
    getObject(id: AnnotationId, kind?: `annotation:${string}`): FabricNS.FabricObject | null;
    listObjects(kind: `annotation:${string}`): readonly FabricNS.FabricObject[];
    addPreview(request: AnnotationPreviewRequest): void;
    replacePreview(previousIds: readonly string[], request: AnnotationPreviewRequest): void;
    removePreview(ids: readonly string[]): void;
    hideForPreview(ids: readonly AnnotationId[]): Disposable;
    applyGeometry(object: FabricNS.FabricObject, mutation: GeometryMutationDescriptor, preserveReadable: boolean): void;
}
export interface AnnotationFoundationOptions {
    readonly maxAnnotationCount?: number;
}
