import type * as FabricNS from 'fabric';

import type { CoreExportOptions, FabricModule } from '../../core-runtime/public-types.js';
import type { GeometryMutationDescriptor } from '../../core-runtime/geometry/index.js';
import type { Disposable, MaybePromise } from '../../plugin-kernel/index.js';

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
    readonly data: unknown;
}

export interface OverlaySerializerContext {
    readonly fabric: FabricModule;
}

export interface OverlaySerializer {
    readonly id: string;
    readonly kind: string;
    readonly ownerPluginId: string;
    serialize(object: FabricNS.FabricObject): unknown;
    validate(data: unknown): boolean;
    deserialize(
        data: unknown,
        context: OverlaySerializerContext,
    ): MaybePromise<FabricNS.FabricObject>;
}

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

export interface FlattenOptions {
    readonly format?: 'png' | 'jpeg' | 'webp';
    readonly quality?: number;
}

export interface OverlayFlattenPort {
    flatten(query?: OverlayQuery, options?: FlattenOptions): Promise<void>;
}

export interface OverlayPort {
    registerKind(definition: OverlayKindDefinition): Disposable;
    list(query?: OverlayQuery): readonly FabricNS.FabricObject[];
    getByPersistentId(id: string): FabricNS.FabricObject | null;
    classify(object: FabricNS.FabricObject): OverlayClassification | null;
    registerGeometryPolicy(policy: OverlayGeometryPolicy): Disposable;
    registerSerializer(serializer: OverlaySerializer): Disposable;
    registerExportRenderer(renderer: OverlayExportRenderer): Disposable;
}

export interface OverlayFoundationApi extends OverlayPort, OverlayFlattenPort {
    getSelection(): OverlaySelectionState;
    select(ids: readonly string[]): void;
    discardSelection(): void;
    onSelectionChange(listener: (state: OverlaySelectionState) => void): Disposable;
    setHidden(id: string, hidden: boolean): void;
    setLocked(id: string, locked: boolean): void;
    bringForward(id: string): void;
    sendBackward(id: string): void;
    bringToFront(id: string): void;
    sendToBack(id: string): void;
}
