import { type Disposable } from '../../plugin-kernel/disposable.js';
import type { GeometryCommittedEventPort, GeometryErrorSink, GeometryHistoryCommitPort, GeometryMementoPort, GeometryMutationDescriptor, GeometryMutationParticipant, GeometryMutationRequest, GeometryOperationPort, GeometryStatePort, GeometryWarningSink } from './geometry-types.js';
export interface GeometryMutationCoordinatorOptions {
    readonly mementos: GeometryMementoPort;
    readonly operations: GeometryOperationPort;
    readonly state: GeometryStatePort;
    readonly history: GeometryHistoryCommitPort;
    readonly events: GeometryCommittedEventPort;
    readonly warningSink?: GeometryWarningSink;
    readonly errorSink?: GeometryErrorSink;
    readonly maxMetadataBytes?: number;
}
export declare class GeometryMutationCoordinator implements Disposable {
    private readonly options;
    private readonly participants;
    private readonly usedMutationIds;
    private registrationCounter;
    private activeController;
    private activePromise;
    private disposed;
    constructor(options: GeometryMutationCoordinatorOptions);
    get isRunning(): boolean;
    registerParticipant<TPrepared>(participant: GeometryMutationParticipant<TPrepared>): Disposable;
    run(request: GeometryMutationRequest): Promise<GeometryMutationDescriptor>;
    dispose(): Promise<void>;
    disposeSync(): void;
    private performRun;
    private performTransaction;
    private rollback;
    private validateRequest;
    private throwIfUnavailable;
    private warn;
    private assertActive;
}
