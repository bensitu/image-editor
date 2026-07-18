import type * as FabricNS from 'fabric';
import type { CoreExportOptions, DocumentMutationContext, FabricModule, GeometryMutationDescriptor } from '../../core/index.js';
import type { Disposable, MaybePromise } from '../../sdk/index.js';
export interface OverlayClassification {
    readonly kind: string;
    readonly persistentId: string;
    readonly ownerPluginId: string;
    readonly hidden: boolean;
    readonly locked: boolean;
}
export interface OverlayQuery {
    readonly kinds?: readonly string[];
    readonly ids?: readonly string[];
    readonly includeHidden?: boolean;
    readonly includeLocked?: boolean;
}
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
    readonly exportOrder?: number;
    readonly persistence: OverlayPersistenceDefinition;
    readonly stateCodec?: OverlayStateKindCodec;
}
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
export interface SerializedOverlayRecord {
    readonly kind: string;
    readonly persistentId: string;
    readonly hidden: boolean;
    readonly locked: boolean;
    readonly codec: Readonly<{
        type: string;
        version: string;
    }>;
    readonly data: unknown;
}
export interface OverlaySerializerContext {
    readonly fabric: FabricModule;
}
export interface OverlayStatePoint {
    readonly x: number;
    readonly y: number;
}
export interface OverlayStateImageContext {
    readonly naturalWidth: number;
    readonly naturalHeight: number;
    readonly mimeType: 'image/jpeg' | 'image/png' | 'image/webp' | null;
}
export interface OverlayStateCodecContext {
    readonly image: OverlayStateImageContext;
    toImageNormalized(point: OverlayStatePoint): OverlayStatePoint;
    toCanvasPoint(point: OverlayStatePoint): OverlayStatePoint;
    toImageNormalizedScalar(value: number): number;
    toCanvasScalar(value: number): number;
}
export interface OverlayStateCodecValue {
    readonly geometry: unknown;
    readonly data: unknown;
    readonly metadata?: Readonly<Record<string, unknown>>;
}
export interface OverlayStateKindCodec<TObject extends FabricNS.FabricObject = FabricNS.FabricObject> {
    readonly type: string;
    readonly version: string;
    serialize(object: TObject, context: OverlayStateCodecContext): OverlayStateCodecValue;
    validate(value: OverlayStateCodecValue): boolean;
    deserialize(value: OverlayStateCodecValue, context: OverlayStateCodecContext): MaybePromise<TObject>;
}
export interface OverlayStateKindAdapter {
    readonly persistence: Readonly<{
        readonly mode: 'transient' | 'persistent';
    }>;
    readonly stateCodec?: OverlayStateKindCodec;
    classify(object: FabricNS.FabricObject): boolean;
    setPersistentId?(object: FabricNS.FabricObject, id: string): void;
    setHidden?(object: FabricNS.FabricObject, hidden: boolean): void;
    setLocked?(object: FabricNS.FabricObject, locked: boolean): void;
}
export interface FabricObjectCodec<TObject extends FabricNS.FabricObject = FabricNS.FabricObject, TData = unknown> {
    readonly type: string;
    readonly version: string;
    serialize(object: TObject): TData;
    validate(data: unknown): boolean;
    deserialize(data: TData, context: OverlaySerializerContext): MaybePromise<TObject>;
}
export type OverlayPersistenceDefinition = Readonly<{
    mode: 'transient';
}> | Readonly<{
    mode: 'persistent';
    codec: FabricObjectCodec;
}>;
export interface OverlayExportOptions {
    readonly includeKinds?: readonly string[];
    readonly excludeKinds?: readonly string[];
    readonly includeHidden?: boolean;
}
export interface OverlayExportRenderContext {
    readonly source: FabricNS.FabricObject;
    readonly targetCanvas: FabricNS.StaticCanvas;
    readonly options: Readonly<CoreExportOptions>;
}
export interface OverlayExportRenderer {
    readonly id: string;
    readonly kind: string;
    readonly ownerPluginId: string;
    readonly order: number;
    render(context: OverlayExportRenderContext): MaybePromise<void>;
}
export interface OverlaySelectionState {
    readonly ids: readonly string[];
    readonly primaryId: string | null;
    readonly kinds: readonly string[];
}
export type OverlayMutationAction = 'move' | 'scale' | 'rotate' | 'create' | 'delete' | 'visibility' | 'locking' | 'layer' | 'programmatic' | (string & {});
export interface OverlayMutationDescriptor {
    readonly id: string;
    readonly operationId: string;
    readonly action: OverlayMutationAction;
    readonly objectIds: readonly string[];
    readonly objectKinds: readonly string[];
    readonly metadata: Readonly<Record<string, unknown>>;
}
export interface OverlayMutationContext {
    readonly transaction: DocumentMutationContext;
    readonly action: OverlayMutationAction;
    readonly objectIds: readonly string[];
}
export interface OverlayInteractionContext extends OverlayMutationContext {
    readonly descriptor: OverlayMutationDescriptor;
    readonly phase: 'preview' | 'synchronize' | 'validate';
}
export interface OverlayInteractionPolicy {
    readonly id: string;
    readonly kind: string;
    readonly ownerPluginId: string;
    preview?(object: FabricNS.FabricObject, context: OverlayInteractionContext): MaybePromise<void>;
    synchronize?(object: FabricNS.FabricObject, context: OverlayInteractionContext): MaybePromise<void>;
    validate?(object: FabricNS.FabricObject, context: OverlayInteractionContext): MaybePromise<void>;
}
export interface OverlayMutationRequest<TResult = void> {
    readonly id: string;
    readonly operationId: string;
    readonly action: OverlayMutationAction;
    readonly objectIds?: readonly string[];
    readonly metadata?: Readonly<Record<string, unknown>>;
    readonly parent?: DocumentMutationContext;
    mutate(context: OverlayMutationContext): MaybePromise<TResult>;
    affectedObjects?(result: TResult, context: OverlayMutationContext): MaybePromise<readonly FabricNS.FabricObject[]>;
    synchronize?(result: TResult, context: OverlayMutationContext): MaybePromise<void>;
    validate?(result: TResult, context: OverlayMutationContext): MaybePromise<void>;
}
export interface OverlayMutationPort {
    mutate<TResult>(request: OverlayMutationRequest<TResult>): Promise<TResult>;
    add(objects: readonly FabricNS.FabricObject[]): Promise<void>;
    addTransient(objects: readonly FabricNS.FabricObject[]): Promise<void>;
    replaceTransient(ids: readonly string[], objects: readonly FabricNS.FabricObject[]): Promise<void>;
    remove(ids: readonly string[]): Promise<void>;
    removeTransient(ids: readonly string[]): Promise<void>;
    cancelActiveGesture(reason?: unknown): Promise<void>;
    waitForIdle(): Promise<void>;
}
export interface FlattenOptions {
    readonly format?: 'png' | 'jpeg' | 'webp';
    readonly quality?: number;
}
export interface OverlayFlattenPort {
    flatten(query?: OverlayQuery, options?: FlattenOptions): Promise<void>;
}
export interface OverlayPort {
    list(query?: OverlayQuery): readonly FabricNS.FabricObject[];
    getByPersistentId(id: string): FabricNS.FabricObject | null;
    classify(object: FabricNS.FabricObject): OverlayClassification | null;
    getStateKind(kind: string): OverlayStateKindAdapter | null;
}
export interface OverlayRegistrationPort {
    registerKind(definition: OverlayKindDefinition): Disposable;
    registerGeometryPolicy(policy: OverlayGeometryPolicy): Disposable;
    registerInteractionPolicy(policy: OverlayInteractionPolicy): Disposable;
    registerExportRenderer(renderer: OverlayExportRenderer): Disposable;
}
export interface OverlayRuntimeApi extends OverlayPort, OverlayFlattenPort, OverlayMutationPort {
    getSelection(): OverlaySelectionState;
    select(ids: readonly string[]): void;
    discardSelection(): void;
    onSelectionChange(listener: (state: OverlaySelectionState) => void): Disposable;
    hideForPreview(ids: readonly string[]): Disposable;
    setHidden(id: string, hidden: boolean): Promise<void>;
    setLocked(id: string, locked: boolean): Promise<void>;
    bringForward(id: string): Promise<void>;
    sendBackward(id: string): Promise<void>;
    bringToFront(id: string): Promise<void>;
    sendToBack(id: string): Promise<void>;
}
export interface OverlayFoundationApi extends OverlayRuntimeApi, OverlayRegistrationPort {
}
