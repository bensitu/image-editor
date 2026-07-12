import type * as FabricNS from 'fabric';

import { createCapabilityToken, type Disposable } from '../plugin-kernel/index.js';
import type {
    CoreExportContributor,
    ExportContributorRegistry,
} from './export-contributor-registry.js';
import type { GeometryMutationCoordinator } from './geometry/index.js';
import type { CoreHistoryCommitPort, CoreHistoryRecord } from './history-commit-router.js';
import type {
    CoreImageInfo,
    FabricModule,
    ResolvedImageEditorCoreOptions,
} from './public-types.js';
import type {
    MementoService,
    ObjectPropertyRegistry,
    SnapshotService,
    StateSliceRegistry,
    TransientObjectRegistry,
} from './state/index.js';

export interface CoreHostPort {
    readonly fabric: FabricModule;
    readonly options: ResolvedImageEditorCoreOptions;
    getCanvas(): FabricNS.Canvas | null;
    requireCanvas(operation: string): FabricNS.Canvas;
    getBaseImage(): FabricNS.FabricImage | null;
    replaceBaseImage(
        image: FabricNS.FabricImage,
        options?: Readonly<{ baseScale?: number; mimeType?: CoreImageInfo['mimeType'] }>,
    ): void;
    getBaseImageScale(): number;
    getGeometryRevision(): number;
    setGeometryRevision(revision: number): void;
    getCanvasSize(): Readonly<{ width: number; height: number }>;
    setCanvasSize(width: number, height: number): void;
    getImageInfo(): CoreImageInfo | null;
    isImageLoaded(): boolean;
    isDisposed(): boolean;
    requestRender(): void;
    finalizeBaseImageGeometry(): void;
    reportWarning(error: unknown, message: string): void;
    reportError(error: unknown, message: string): void;
}

export interface CoreStatePort {
    readonly slices: StateSliceRegistry;
    readonly objectProperties: ObjectPropertyRegistry;
    readonly transientObjects: TransientObjectRegistry<FabricNS.FabricObject>;
    readonly externalObjects: TransientObjectRegistry<FabricNS.FabricObject>;
    readonly mementos: MementoService;
    readonly snapshots: SnapshotService;
    captureHistoryRecord(
        operationId: string,
        before: ReturnType<MementoService['capture']>,
    ): CoreHistoryRecord;
    commitHistory(record: CoreHistoryRecord): void | Promise<void>;
    registerHistoryProvider(owner: string, provider: CoreHistoryCommitPort): Disposable;
}

export interface CoreExportPort {
    register(owner: string, contributor: CoreExportContributor): Disposable;
}

export const CORE_HOST_CAPABILITY = createCapabilityToken<CoreHostPort>('core.host', '1.0.0');
export const CORE_STATE_CAPABILITY = createCapabilityToken<CoreStatePort>('core.state', '1.0.0');
export const GEOMETRY_CAPABILITY = createCapabilityToken<GeometryMutationCoordinator>(
    'core.geometry',
    '1.0.0',
);
export const CORE_EXPORT_CAPABILITY = createCapabilityToken<CoreExportPort>('core.export', '1.0.0');

export type { CoreExportContributor, ExportContributorRegistry };
