/**
 * Publishes typed Core Capability ports and their stable Runtime tokens for Plugin authors.
 *
 * @module
 */
import type * as FabricNS from 'fabric';
import type { CoreExportContributor, CoreHistoryCommitPort, CoreImageInfo, CoreMemento, DocumentMutationContext, DocumentMutationPort, FabricModule, GeometryMutationPort, LayoutMode, MementoRestoreOptions, ObjectPropertyRegistration, StateSliceDefinition, TransientObjectPredicate } from '../core/contracts.js';
import type { Disposable } from '../plugin-kernel/disposable.js';
export interface CoreStatusPort {
    isDisposed(): boolean;
}
export interface CoreDiagnosticsPort {
    reportWarning(error: unknown, message: string): void;
    reportError(error: unknown, message: string): void;
}
export interface CorePresentationPort {
    readonly backgroundColor: string;
    readonly layoutMode: LayoutMode;
}
export interface FabricRuntimePort {
    readonly fabric: FabricModule;
}
export interface CanvasReadPort {
    getCanvas(): FabricNS.Canvas | null;
    requireCanvas(operation: string): FabricNS.Canvas;
}
export interface BaseImageInfoPort {
    getBaseImageScale(): number;
    getGeometryRevision(): number;
    getCanvasSize(): Readonly<{
        width: number;
        height: number;
    }>;
    getImageInfo(): CoreImageInfo | null;
    isImageLoaded(): boolean;
}
export interface ImageResourcePolicyPort {
    getImageResourcePolicy(): Readonly<{
        maxInputBytes: number;
        maxInputPixels: number;
        imageLoadTimeoutMs: number;
        maxExportPixels: number;
        maxExportDimension: number;
    }>;
}
export interface BaseImageReadPort extends BaseImageInfoPort {
    getBaseImage(): FabricNS.FabricImage | null;
}
export interface RenderRequestPort {
    requestRender(): void;
}
export interface CanvasResizePort {
    resizeCanvas(width: number, height: number): void;
}
export interface RasterMutationPort {
    replaceBaseImage(context: DocumentMutationContext, image: FabricNS.FabricImage, options?: Readonly<{
        baseScale?: number;
        mimeType?: CoreImageInfo['mimeType'];
    }>): void;
}
export interface SnapshotRegistrationPort {
    registerSlice<TState>(definition: StateSliceDefinition<TState>): Disposable;
    registerObjectProperties(registration: ObjectPropertyRegistration): Disposable;
    registerTransientObject(owner: string, predicate: TransientObjectPredicate<FabricNS.FabricObject>): Disposable;
    registerExternalObject(owner: string, predicate: TransientObjectPredicate<FabricNS.FabricObject>): Disposable;
}
export interface MementoHistoryPort {
    captureMemento(): CoreMemento;
    restoreMemento(memento: CoreMemento, options?: MementoRestoreOptions): Promise<void>;
    registerHistoryProvider(owner: string, provider: CoreHistoryCommitPort): Disposable;
    reportFatal(error: unknown): void;
}
export interface ExportContributionPort {
    register(owner: string, contributor: CoreExportContributor): Disposable;
}
export declare const CORE_STATUS_CAPABILITY: import("./index.js").CapabilityToken<CoreStatusPort>;
export declare const CORE_DIAGNOSTICS_CAPABILITY: import("./index.js").CapabilityToken<CoreDiagnosticsPort>;
export declare const CORE_PRESENTATION_CAPABILITY: import("./index.js").CapabilityToken<CorePresentationPort>;
export declare const FABRIC_RUNTIME_CAPABILITY: import("./index.js").CapabilityToken<FabricRuntimePort>;
export declare const CANVAS_READ_CAPABILITY: import("./index.js").CapabilityToken<CanvasReadPort>;
export declare const BASE_IMAGE_READ_CAPABILITY: import("./index.js").CapabilityToken<BaseImageReadPort>;
export declare const BASE_IMAGE_INFO_CAPABILITY: import("./index.js").CapabilityToken<BaseImageInfoPort>;
export declare const IMAGE_RESOURCE_POLICY_CAPABILITY: import("./index.js").CapabilityToken<ImageResourcePolicyPort>;
export declare const RENDER_REQUEST_CAPABILITY: import("./index.js").CapabilityToken<RenderRequestPort>;
export declare const CANVAS_RESIZE_CAPABILITY: import("./index.js").CapabilityToken<CanvasResizePort>;
export declare const RASTER_MUTATION_CAPABILITY: import("./index.js").CapabilityToken<RasterMutationPort>;
export declare const SNAPSHOT_REGISTRATION_CAPABILITY: import("./index.js").CapabilityToken<SnapshotRegistrationPort>;
export declare const MEMENTO_HISTORY_CAPABILITY: import("./index.js").CapabilityToken<MementoHistoryPort>;
export declare const GEOMETRY_MUTATION_CAPABILITY: import("./index.js").CapabilityToken<GeometryMutationPort>;
export declare const DOCUMENT_MUTATION_CAPABILITY: import("./index.js").CapabilityToken<DocumentMutationPort>;
export declare const EXPORT_CONTRIBUTION_CAPABILITY: import("./index.js").CapabilityToken<ExportContributionPort>;
