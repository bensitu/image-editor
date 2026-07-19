/**
 * Declares document mutation participants, transaction contexts, ports, and diagnostic contracts.
 *
 * @module
 */
import type { MaybePromise } from '../../plugin-kernel/disposable.js';
import type { OperationConflictDomain, OperationDefinition, OperationToken } from '../../plugin-kernel/operation-registry.js';
import type { CoreMemento } from '../state/state-types.js';
export type DocumentMutationKind = 'geometry' | 'raster' | 'overlay' | 'plugin-state' | 'compound' | (string & {});
export type MutationCommitOwner = 'self' | 'parent';
export interface DocumentMutationDiagnostic {
    readonly transactionId: string;
    readonly parentTransactionId: string | null;
    readonly participantIds: readonly string[];
    readonly metadata: Readonly<Record<string, unknown>>;
}
export interface DocumentMutationContext {
    readonly transactionId: string;
    readonly parentTransactionId: string | null;
    readonly operationId: string;
    readonly conflictDomains: readonly OperationConflictDomain[];
    readonly historyOwner: MutationCommitOwner;
    readonly eventOwner: MutationCommitOwner;
    readonly signal: AbortSignal;
    readonly participantIds: readonly string[];
    readonly metadata: Readonly<Record<string, unknown>>;
}
export interface DocumentMutationRollbackContext<TResult = unknown> extends DocumentMutationContext {
    readonly cause: unknown;
    readonly result: TResult | undefined;
}
export interface DocumentMutationParticipant<TResult = unknown, TPrepared = unknown> {
    readonly id: string;
    readonly order: number;
    prepare?(context: DocumentMutationContext): MaybePromise<TPrepared>;
    apply?(result: TResult, prepared: TPrepared, context: DocumentMutationContext): MaybePromise<void>;
    synchronize?(result: TResult, prepared: TPrepared, context: DocumentMutationContext): MaybePromise<void>;
    rollback?(prepared: TPrepared, context: DocumentMutationRollbackContext<TResult>): MaybePromise<void>;
}
export interface DocumentMutationRequest<TResult = void> {
    readonly id: string;
    readonly kind: DocumentMutationKind;
    readonly operationId: string;
    readonly conflictDomains: readonly OperationConflictDomain[];
    readonly signal?: AbortSignal;
    readonly parent?: DocumentMutationContext;
    readonly participants?: readonly DocumentMutationParticipant<TResult>[];
    readonly metadata?: Readonly<Record<string, unknown>>;
    mutate(context: DocumentMutationContext): MaybePromise<TResult>;
    synchronize?(result: TResult, context: DocumentMutationContext): MaybePromise<void>;
    validate?(result: TResult, context: DocumentMutationContext): MaybePromise<void>;
    describeCommit?(result: TResult, context: DocumentMutationContext): MaybePromise<unknown>;
    rollback?(context: DocumentMutationRollbackContext<TResult>): MaybePromise<void>;
}
export interface DocumentMutationDescriptor<TResult = unknown> {
    readonly transactionId: string;
    readonly parentTransactionId: null;
    readonly kind: DocumentMutationKind;
    readonly operationId: string;
    readonly conflictDomains: readonly OperationConflictDomain[];
    readonly metadata: Readonly<Record<string, unknown>>;
    readonly diagnostics: readonly DocumentMutationDiagnostic[];
    readonly result: TResult;
    readonly committedAt: number;
}
export interface DocumentMutationHistoryRecord {
    readonly operationId: string;
    readonly before: CoreMemento;
    readonly after: CoreMemento;
    readonly timestamp: number;
    readonly detail: DocumentMutationDescriptor;
}
export interface DocumentMutationMementoPort {
    capture(): CoreMemento;
    restore(memento: CoreMemento, options?: Readonly<{
        rollbackOnFailure?: boolean;
    }>): Promise<void>;
    matches?(memento: CoreMemento): MaybePromise<boolean>;
}
export interface DocumentMutationOperationContext {
    readonly signal: AbortSignal;
    readonly token: OperationToken;
}
export interface DocumentMutationOperationPort {
    has(operationId: string): boolean;
    get(operationId: string): OperationDefinition | null;
    run<TResult>(operationId: string, task: (context: DocumentMutationOperationContext) => MaybePromise<TResult>, options?: Readonly<{
        parent?: OperationToken;
        signal?: AbortSignal;
    }>): Promise<TResult>;
}
export interface DocumentMutationStatePort {
    requestRender(): void;
    isDisposed(): boolean;
    assertOperational?(operation: string): void;
}
export interface DocumentMutationHistoryPort {
    isAvailable(): boolean;
    commit(record: DocumentMutationHistoryRecord): MaybePromise<void>;
}
export interface DocumentMutationEventPort {
    emitCommitted(descriptor: DocumentMutationDescriptor): MaybePromise<void>;
}
export interface DocumentMutationWarning {
    readonly code: string;
    readonly message: string;
    readonly transactionId: string;
    readonly cause?: unknown;
}
export type DocumentMutationWarningSink = (warning: DocumentMutationWarning) => void;
export type DocumentMutationErrorSink = (error: unknown) => void;
export type DocumentMutationFaultSink = (error: unknown) => void;
export interface DocumentMutationCoordinatorOptions {
    readonly mementos: DocumentMutationMementoPort;
    readonly operations: DocumentMutationOperationPort;
    readonly state: DocumentMutationStatePort;
    readonly history: DocumentMutationHistoryPort;
    readonly events: DocumentMutationEventPort;
    readonly warningSink?: DocumentMutationWarningSink;
    readonly errorSink?: DocumentMutationErrorSink;
    readonly faultSink?: DocumentMutationFaultSink;
    readonly maxMetadataBytes?: number;
}
export interface DocumentMutationPort {
    run<TResult>(request: DocumentMutationRequest<TResult>): Promise<TResult>;
}
