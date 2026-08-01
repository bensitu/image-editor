/**
 * Declares Annotation Foundation feature, authoring, query, status, and Plugin API contracts.
 *
 * @module
 */

import type * as FabricNS from 'fabric';

import type { GeometryMutationDescriptor, OverlayListOrder } from '../../core/index.js';
import type { Disposable, MaybePromise } from '../../sdk/index.js';
import type {
    FlattenOptions,
    OverlayExportRenderContext,
    OverlaySerializerContext,
    OverlayStateKindCodec,
} from '../overlay/index.js';

export type AnnotationId = string;
export interface AnnotationMetadataObject {
    readonly [key: string]: AnnotationMetadataValue;
}
export type AnnotationMetadataValue =
    | null
    | boolean
    | number
    | string
    | readonly AnnotationMetadataValue[]
    | AnnotationMetadataObject;
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

/** Filters accepted by `removeAll`, plus an explicit locked-object override. */
export interface AnnotationRemoveAllOptions extends AnnotationQuery {
    /** Remove matching locked Annotations as well. @defaultValue `false` */
    readonly force?: boolean;
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
    removeAll(options?: AnnotationRemoveAllOptions): Promise<void>;
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
    deserialize(
        data: TData,
        context: OverlaySerializerContext,
    ): MaybePromise<FabricNS.FabricObject>;
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
    /** Overrides the Foundation export default for this Annotation kind. */
    readonly exportByDefault?: boolean;
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
    applyGeometry(
        object: FabricNS.FabricObject,
        mutation: GeometryMutationDescriptor,
        preserveReadable: boolean,
    ): void;
}

export interface AnnotationFoundationOptions {
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

export interface AnnotationHoverStyle {
    readonly fill?: string | null;
    readonly opacity?: number;
    readonly stroke?: string | null;
    readonly strokeWidth?: number;
}

export interface AnnotationControlStyle {
    readonly borderColor?: string;
    readonly cornerColor?: string;
    readonly cornerStrokeColor?: string;
    readonly cornerSize?: number;
    readonly touchCornerSize?: number;
    readonly transparentCorners?: boolean;
    readonly padding?: number;
}

export interface AnnotationLabelConfig {
    /** Selective labels are shown only while their Annotation is selected. */
    readonly showOn?: 'selected' | 'always';
    readonly offset?: number;
    readonly getText?: (annotation: AnnotationDescriptor) => string;
    readonly textOptions?: Partial<FabricNS.TextProps>;
}

export interface AnnotationLockIndicatorConfig {
    readonly size?: number;
    readonly offset?: number;
    readonly backgroundColor?: string;
    readonly iconColor?: string;
}
