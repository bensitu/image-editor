import type { Disposable, MaybePromise } from '../../plugin-kernel/disposable.js';
import type { DocumentMutationContext } from '../mutation/mutation-types.js';
import type { AffineMatrix, Rect } from './affine-matrix.js';

export interface Size {
    readonly width: number;
    readonly height: number;
}

export interface BaseImageGeometrySnapshot {
    readonly matrix: AffineMatrix;
    readonly boundingBox: Rect;
    readonly canvasWidth: number;
    readonly canvasHeight: number;
    readonly revision: number;
}

export interface GeometryMutationBaseContext {
    readonly signal: AbortSignal;
    readonly transaction: DocumentMutationContext;
}

export interface GeometryMutationRollbackContext {
    readonly signal: AbortSignal;
    readonly cause: unknown;
}

export interface GeometryMutationRequest {
    readonly id: string;
    readonly kind: 'transform' | 'crop' | 'raster-replace' | 'flatten' | (string & {});
    readonly operationId: string;
    readonly parent?: DocumentMutationContext;
    mutateBase(context: GeometryMutationBaseContext): MaybePromise<void>;
    rollbackBase?(context: GeometryMutationRollbackContext): MaybePromise<void>;
    readonly metadata?: Readonly<Record<string, unknown>>;
    readonly sourceRect?: Rect;
    readonly targetSize?: Size;
}

export interface GeometryMutationPort {
    run(request: GeometryMutationRequest): Promise<GeometryMutationDescriptor>;
    registerParticipant<TPrepared>(participant: GeometryMutationParticipant<TPrepared>): Disposable;
}

export interface GeometryMutationDescriptor {
    readonly id: string;
    readonly kind: string;
    readonly operationId: string;
    readonly before: BaseImageGeometrySnapshot;
    readonly after: BaseImageGeometrySnapshot;
    readonly affineDelta: AffineMatrix | null;
    readonly hasReflection: boolean;
    readonly sourceRect?: Rect;
    readonly targetSize?: Size;
    readonly metadata: Readonly<Record<string, unknown>>;
}

export interface GeometryParticipantContext {
    readonly signal: AbortSignal;
    warnRecoverable(error: unknown, objectIdentity?: string, objectKind?: string): void;
}

export interface GeometryMutationParticipant<TPrepared = unknown> {
    readonly id: string;
    readonly order: number;
    supports(mutation: GeometryMutationDescriptor): boolean;
    prepare?(
        mutation: GeometryMutationDescriptor,
        context: GeometryParticipantContext,
    ): MaybePromise<TPrepared>;
    apply(
        mutation: GeometryMutationDescriptor,
        prepared: TPrepared,
        context: GeometryParticipantContext,
    ): MaybePromise<void>;
    synchronize?(
        mutation: GeometryMutationDescriptor,
        context: GeometryParticipantContext,
    ): MaybePromise<void>;
    rollback?(
        mutation: GeometryMutationDescriptor,
        prepared: TPrepared,
        context: GeometryParticipantContext,
    ): MaybePromise<void>;
}

export interface GeometryStatePort {
    captureGeometry(): BaseImageGeometrySnapshot;
    finalizeGeometry(): MaybePromise<void>;
    restoreGeometry?(snapshot: BaseImageGeometrySnapshot): MaybePromise<void>;
    requestRender(): void;
    isDisposed(): boolean;
}

export interface GeometryWarning {
    readonly code: string;
    readonly message: string;
    readonly mutationId: string;
    readonly participantId?: string;
    readonly objectIdentity?: string;
    readonly objectKind?: string;
    readonly cause?: unknown;
}

export type GeometryWarningSink = (warning: GeometryWarning) => void;
export type GeometryErrorSink = (error: unknown) => void;
