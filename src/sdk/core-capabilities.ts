import type * as FabricNS from 'fabric';

import type {
    CoreExportContributor,
    CoreHistoryCommitPort,
    CoreImageInfo,
    CoreMemento,
    DocumentMutationContext,
    DocumentMutationPort,
    FabricModule,
    GeometryMutationPort,
    LayoutMode,
    MementoRestoreOptions,
    ObjectPropertyRegistration,
    StateSliceDefinition,
    TransientObjectPredicate,
} from '../core/contracts.js';
import { createCapabilityToken } from '../plugin-kernel/capability-token.js';
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
    getCanvasSize(): Readonly<{ width: number; height: number }>;
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
    replaceBaseImage(
        context: DocumentMutationContext,
        image: FabricNS.FabricImage,
        options?: Readonly<{ baseScale?: number; mimeType?: CoreImageInfo['mimeType'] }>,
    ): void;
}

export interface SnapshotRegistrationPort {
    registerSlice<TState>(definition: StateSliceDefinition<TState>): Disposable;
    registerObjectProperties(registration: ObjectPropertyRegistration): Disposable;
    registerTransientObject(
        owner: string,
        predicate: TransientObjectPredicate<FabricNS.FabricObject>,
    ): Disposable;
    registerExternalObject(
        owner: string,
        predicate: TransientObjectPredicate<FabricNS.FabricObject>,
    ): Disposable;
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

export const CORE_STATUS_CAPABILITY = createCapabilityToken<CoreStatusPort>('core.status', '1.0.0');
export const CORE_DIAGNOSTICS_CAPABILITY = createCapabilityToken<CoreDiagnosticsPort>(
    'core.diagnostics',
    '1.0.0',
);
export const CORE_PRESENTATION_CAPABILITY = createCapabilityToken<CorePresentationPort>(
    'core.presentation',
    '1.0.0',
);
export const FABRIC_RUNTIME_CAPABILITY = createCapabilityToken<FabricRuntimePort>(
    'fabric.runtime',
    '1.0.0',
);
export const CANVAS_READ_CAPABILITY = createCapabilityToken<CanvasReadPort>(
    'core.canvas-read',
    '1.0.0',
);
export const BASE_IMAGE_READ_CAPABILITY = createCapabilityToken<BaseImageReadPort>(
    'core.base-image-read',
    '1.0.0',
);
export const BASE_IMAGE_INFO_CAPABILITY = createCapabilityToken<BaseImageInfoPort>(
    'core.base-image-info',
    '1.0.0',
);
export const IMAGE_RESOURCE_POLICY_CAPABILITY = createCapabilityToken<ImageResourcePolicyPort>(
    'core.image-resource-policy',
    '1.0.0',
);
export const RENDER_REQUEST_CAPABILITY = createCapabilityToken<RenderRequestPort>(
    'core.render-request',
    '1.0.0',
);
export const CANVAS_RESIZE_CAPABILITY = createCapabilityToken<CanvasResizePort>(
    'core.canvas-resize',
    '1.0.0',
);
export const RASTER_MUTATION_CAPABILITY = createCapabilityToken<RasterMutationPort>(
    'core.raster-mutation',
    '1.0.0',
);
export const SNAPSHOT_REGISTRATION_CAPABILITY = createCapabilityToken<SnapshotRegistrationPort>(
    'core.snapshot-registration',
    '1.0.0',
);
export const MEMENTO_HISTORY_CAPABILITY = createCapabilityToken<MementoHistoryPort>(
    'core.memento-history',
    '1.0.0',
);
export const GEOMETRY_MUTATION_CAPABILITY = createCapabilityToken<GeometryMutationPort>(
    'core.geometry',
    '1.0.0',
);
export const DOCUMENT_MUTATION_CAPABILITY = createCapabilityToken<DocumentMutationPort>(
    'core.document-mutation',
    '1.0.0',
);
export const EXPORT_CONTRIBUTION_CAPABILITY = createCapabilityToken<ExportContributionPort>(
    'core.export',
    '1.0.0',
);
